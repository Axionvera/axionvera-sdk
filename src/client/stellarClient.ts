import {
  Account,
  FeeBumpTransaction,
  Keypair,
  Networks,
  rpc,
  Transaction,
  TransactionBuilder,
  xdr
} from "@stellar/stellar-sdk";

import { AxionveraNetwork, resolveNetworkConfig } from "../utils/networkConfig";
import { ConcurrencyConfig, DEFAULT_CONCURRENCY_CONFIG, createConcurrencyControlledClient } from "../utils/concurrencyQueue";
import { RetryConfig, createHttpClientWithRetry, retry } from "../utils/httpInterceptor";
import { normalizeRpcError, normalizeTransactionError, TimeoutError, InsecureNetworkError, AxionveraError, AxionveraRPCError, SimulationFailedError } from "../errors/axionveraError";
import { WebSocketManager } from "./websocket/websocketManager";
import { WebSocketConfig } from "./websocket/types";
import { Logger } from "../utils/logger";

/**
 * Checks if a URL points to a localhost address.
 * @param url - The URL to check
 * @returns true if the URL hostname is localhost, 127.0.0.1, or ::1
 */
function isLocalhostUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname === 'localhost' ||
           hostname === '127.0.0.1' ||
           hostname === '::1';
  } catch {
    return false;
  }
}

export type StellarClientOptions = {
  network?: AxionveraNetwork;
  rpcUrl?: string;
  networkPassphrase?: string;
  rpcClient?: rpc.Server;
  concurrencyConfig?: Partial<ConcurrencyConfig>;
  retryConfig?: Partial<RetryConfig>;
  webSocketConfig?: WebSocketConfig;
  logger?: Logger;
  allowHttp?: boolean;
};

export type TransactionSendResult = {
  hash: string;
  status: string;
  raw: unknown;
};

/**
 * RPC gateway for interacting with Soroban networks.
 *
 * Provides methods for querying network state, simulating transactions,
 * preparing transactions with fees, and submitting signed transactions.
 *
 * @example
 * ```typescript
 * import { StellarClient } from "axionvera-sdk";
 *
 * const client = new StellarClient({ network: "testnet" });
 * const health = await client.getHealth();
 * ```
 */
export class StellarClient {
  /** The network this client is connected to. */
  readonly network: AxionveraNetwork;
  /** The RPC URL this client uses. */
  readonly rpcUrl: string;
  /** The network passphrase for transaction signing. */
  readonly networkPassphrase: string;
  /** The underlying RPC server instance. */
  readonly rpc: rpc.Server;
  /** The HTTP client with retry interceptors. */
  readonly httpClient;
  /** The effective retry configuration after merging with defaults. */
  readonly retryConfig: Partial<RetryConfig>;
  /** The effective concurrency configuration after merging with defaults. */
  readonly concurrencyConfig: ConcurrencyConfig;
  /** Whether concurrency control is enabled. */
  readonly concurrencyEnabled: boolean;
  /** WebSocket manager for real-time event subscriptions. */
  readonly webSocketManager?: WebSocketManager;
  /** Logger instance for debugging and monitoring. */
  readonly logger: Logger;

  /**
   * Creates a new StellarClient instance.
   * @param options - Configuration options
   */
   constructor(options?: StellarClientOptions) {
     const config = resolveNetworkConfig(options);
     this.network = config.network;
     this.rpcUrl = config.rpcUrl;
     this.networkPassphrase = config.networkPassphrase;

     // Validate RPC URL has a protocol
     if (!this.rpcUrl.startsWith('http://') && !this.rpcUrl.startsWith('https://')) {
       throw new AxionveraError('RPC URL must include a protocol (http:// or https://)');
     }

     // Security guard: prevent insecure HTTP in production unless explicitly allowed
     const isProduction = process.env.NODE_ENV === 'production';
     const isHttp = this.rpcUrl.startsWith('http://');
     const isLocalhost = isLocalhostUrl(this.rpcUrl);
     const allowHttp = options?.allowHttp ?? false;

     if (isProduction && isHttp && !isLocalhost && !allowHttp) {
       throw new InsecureNetworkError(
         'Insecure RPC connection in production: HTTP endpoint detected. ' +
         'Use HTTPS for production or set allowHttp: true to override. ' +
         'Note: localhost endpoints are always permitted.'
       );
     }

     this.concurrencyConfig = {
      ...DEFAULT_CONCURRENCY_CONFIG,
      ...options?.concurrencyConfig
    };
    this.concurrencyEnabled = !!options?.concurrencyConfig;
    this.retryConfig = options?.retryConfig ?? {};
    this.httpClient = createHttpClientWithRetry(this.retryConfig);
    this.logger = options?.logger ?? new Logger();

    // Initialize WebSocket manager if configuration is provided
    if (options?.webSocketConfig) {
      this.webSocketManager = new WebSocketManager(
        this.rpcUrl,
        options.webSocketConfig,
        {
          onEvent: (event) => this.logger.debug('WebSocket event received:', event),
          onConnectionChange: (connected) => this.logger.debug(`WebSocket connection changed: ${connected}`),
        }
      );
    }

    if (options?.rpcClient) {
      this.rpc = options.rpcClient;
    } else {
      const allowHttp = this.rpcUrl.startsWith("http://");
      const baseRpc = new rpc.Server(this.rpcUrl, { allowHttp });

      // Apply concurrency control if enabled
      if (this.concurrencyEnabled) {
        this.rpc = createConcurrencyControlledClient(baseRpc, this.concurrencyConfig);
      } else {
        this.rpc = baseRpc;
      }
    }
  }

  /**
   * Checks the health of the RPC server.
   * Automatically retries on failure.
   * @returns The health check response
   */
  async getHealth(): Promise<rpc.Api.GetHealthResponse> {
    try {
      return await retry(() => this.rpc.getHealth(), this.retryConfig);
    } catch (error) {
      throw new AxionveraRPCError(
        error instanceof Error ? error.message : 'RPC operation failed: getHealth',
        'getHealth',
        { originalError: error }
      );
    }
  }

  async getNetwork(): Promise<rpc.Api.GetNetworkResponse> {
    try {
      return await retry(() => this.rpc.getNetwork(), this.retryConfig);
    } catch (error) {
      throw new AxionveraRPCError(
        error instanceof Error ? error.message : 'RPC operation failed: getNetwork',
        'getNetwork',
        { originalError: error }
      );
    }
  }

  async getLatestLedger(): Promise<rpc.Api.GetLatestLedgerResponse> {
    try {
      return await retry(() => this.rpc.getLatestLedger(), this.retryConfig);
    } catch (error) {
      throw new AxionveraRPCError(
        error instanceof Error ? error.message : 'RPC operation failed: getLatestLedger',
        'getLatestLedger',
        { originalError: error }
      );
    }
  }

  /**
   * Retrieves an account's information from the network.
   * Automatically retries on failure.
   * @param publicKey - The account's public key
   * @returns The account information
   */
  async getAccount(publicKey: string): Promise<Account> {
    return retry(() => this.rpc.getAccount(publicKey), this.retryConfig);
  }

  /**
   * Simulates a transaction without submitting it.
   * This is useful for testing transaction validity and getting expected costs.
   * @param tx - The transaction to simulate
   * @returns The simulation result
   */
  async simulateTransaction(
    tx: Transaction | FeeBumpTransaction
  ): Promise<rpc.Api.SimulateTransactionResponse> {
    try {
      const result = await this.rpc.simulateTransaction(tx);
      if (rpc.Api.isSimulationError(result)) {
        throw new SimulationFailedError(result.error, { simulationResult: result });
      }
      return result;
    } catch (error) {
      if (error instanceof SimulationFailedError) throw error;
      throw new SimulationFailedError(
        error instanceof Error ? error.message : 'Transaction simulation failed',
        { originalError: error }
      );
    }
  }

  /**
   * Simulates multiple operations in a single batch transaction.
   * This is more efficient than simulating operations one by one, especially when
   * a user wants to perform multiple actions (e.g., deposit into 3 vaults).
   *
   * All operations are combined into a single transaction and sent to the Soroban RPC
   * simulateTransaction endpoint, which returns results for each operation.
   *
   * Note: Be aware of Soroban transaction limits. A large batch may fail if it exceeds
   * the maximum CPU/RAM limits for a single transaction.
   *
   * @param params - Batch simulation parameters
   * @param params.operations - Array of XDR operations to simulate
   * @param params.sourceAccount - The source account for the transaction
   * @param params.fee - The fee per operation (default: 100_000)
   * @param params.timeoutInSeconds - Transaction timeout in seconds (default: 60)
   * @returns Array of simulation results, one for each operation
   * @throws SimulationFailedError if the batch simulation fails
   * @throws AxionveraError if the transaction building fails
   *
   * @example
   * ```typescript
   * const client = new StellarClient({ network: "testnet" });
   * const account = await client.getAccount(publicKey);
   *
   * // Build three deposit operations
   * const op1 = buildContractCallOperation({
   *   contractId: vault1,
   *   method: "deposit",
   *   args: [amount1]
   * });
   * const op2 = buildContractCallOperation({
   *   contractId: vault2,
   *   method: "deposit",
   *   args: [amount2]
   * });
   * const op3 = buildContractCallOperation({
   *   contractId: vault3,
   *   method: "deposit",
   *   args: [amount3]
   * });
   *
   * // Simulate all three in one call
   * const results = await client.simulateBatch({
   *   operations: [op1, op2, op3],
   *   sourceAccount: account
   * });
   *
   * // results[0], results[1], results[2] contain the individual results
   * ```
   */
  async simulateBatch(params: {
    operations: xdr.Operation[];
    sourceAccount: Account;
    fee?: number;
    timeoutInSeconds?: number;
  }): Promise<rpc.Api.SimulateTransactionResponse['result']> {
    try {
      if (!params.operations || params.operations.length === 0) {
        throw new AxionveraError('At least one operation is required for batch simulation');
      }

      // Calculate fee: multiply by number of operations
      const operationCount = params.operations.length;
      const feePerOperation = params.fee ?? 100_000;
      const totalFee = (feePerOperation * operationCount).toString();
      const timeoutInSeconds = params.timeoutInSeconds ?? 60;

      // Build a transaction with all operations
      const builder = new TransactionBuilder(params.sourceAccount, {
        fee: totalFee,
        networkPassphrase: this.networkPassphrase
      });

      // Add all operations to the transaction
      for (const operation of params.operations) {
        builder.addOperation(operation);
      }

      const tx = builder.setTimeout(timeoutInSeconds).build();

      // Simulate the combined transaction
      const result = await this.rpc.simulateTransaction(tx);

      if (rpc.Api.isSimulationError(result)) {
        throw new SimulationFailedError(result.error, { simulationResult: result });
      }

      // Return only the results array
      if (!result.result) {
        throw new SimulationFailedError(
          'No results returned from batch simulation',
          { simulationResult: result }
        );
      }

      return result.result;
    } catch (error) {
      if (error instanceof SimulationFailedError) throw error;
      if (error instanceof AxionveraError) throw error;
      throw new SimulationFailedError(
        error instanceof Error ? error.message : 'Batch simulation failed',
        { originalError: error }
      );
    }
  }

  /**
   * Prepares a transaction by fetching the current ledger sequence
   * and setting the correct min sequence age.
   * @param tx - The transaction to prepare
   * @returns The prepared transaction
   */
  async prepareTransaction(tx: Transaction | FeeBumpTransaction): Promise<Transaction> {
    return this.rpc.prepareTransaction(tx);
  }

  /**
   * Submits a signed transaction to the network.
   * @param tx - The signed transaction to submit
   * @returns The submission result containing hash and status
   */
  async sendTransaction(tx: Transaction | FeeBumpTransaction): Promise<TransactionSendResult> {
    let finalTx: Transaction | FeeBumpTransaction = tx;

    try {
      // If a wallet is available, sign the transaction before submission
      if ((this as any).wallet) {
        const wallet = (this as any).wallet;

        // Convert transaction to XDR for wallet signing
        const txXdr = tx.toXDR();

        // Sign via wallet connector
        const signedXdr = await wallet.signTransaction(
          txXdr,
          this.networkPassphrase
        );

        // Reconstruct signed transaction from XDR
        finalTx = TransactionBuilder.fromXDR(
          signedXdr,
          this.networkPassphrase
        );
      }

      // Submit either original or signed transaction
      const result = await this.rpc.sendTransaction(finalTx);
      const hash = (result as any).hash ?? (result as any).id ?? "";
      const status = (result as any).status ?? (result as any).statusText ?? "unknown";
      return { hash, status, raw: result };
    } catch (error) {
      throw normalizeTransactionError(error);
    }
  }


  /**
   * Retrieves the status of a submitted transaction.
   * Automatically retries on failure.
   * @param hash - The transaction hash
   * @returns The transaction status response
   */
  async getTransaction(hash: string): Promise<unknown> {
    return retry(() => this.rpc.getTransaction(hash), this.retryConfig);
  }

  /**
   * Polls for a transaction to be confirmed or rejected.
   * @param hash - The transaction hash to wait for
   * @param params - Polling parameters
   * @param params.timeoutMs - Maximum time to wait in milliseconds (default: 30000)
   * @param params.intervalMs - Time between polls in milliseconds (default: 1000)
   * @returns The transaction result when it reaches a final state
   * @throws TimeoutError if the transaction times out
   */
  async pollTransaction(
    hash: string,
    params?: { timeoutMs?: number; intervalMs?: number }
  ): Promise<unknown> {
    const timeoutMs = params?.timeoutMs ?? 30_000;
    const intervalMs = params?.intervalMs ?? 1_000;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const res = await this.getTransaction(hash);
      const status = (res as any)?.status;
      if (status && status !== "NOT_FOUND") {
        return res;
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }

    throw new TimeoutError(`Timed out waiting for transaction ${hash} after ${timeoutMs}ms`);
  }

  /**
   * Signs a transaction using a local Keypair.
   * This is a convenience method for local signing without a wallet connector.
   * @param tx - The transaction to sign
   * @param keypair - The keypair to sign with
   * @returns The signed transaction
   */
  async signWithKeypair(tx: Transaction, keypair: Keypair): Promise<Transaction> {
    tx.sign(keypair);
    return tx;
  }

  /**
   * Parses a base64-encoded transaction XDR string.
   * @param transactionXdr - The base64-encoded transaction
   * @param networkPassphrase - The network passphrase
   * @returns The parsed Transaction or FeeBumpTransaction
   */
  static parseTransactionXdr(
    transactionXdr: string,
    networkPassphrase: string
  ): Transaction | FeeBumpTransaction {
    return TransactionBuilder.fromXDR(transactionXdr, networkPassphrase);
  }

  /**
   * Gets the default network passphrase for a given network.
   * @param network - The network ("testnet" or "mainnet")
   * @returns The corresponding network passphrase
   */
  static getDefaultNetworkPassphrase(network: AxionveraNetwork): string {
    switch (network) {
      case "testnet":
        return Networks.TESTNET;
      case "mainnet":
        return Networks.PUBLIC;
      default:
        throw new AxionveraError(`Unknown network: ${network}`);
    }
  }

  /**
   * Get concurrency control statistics
   */
  getConcurrencyStats() {
    if (!this.concurrencyEnabled) {
      return {
        enabled: false,
        message: 'Concurrency control is not enabled'
      };
    }

    // Try to get stats from the wrapped client if it has the method
    if ('getStats' in this.rpc && typeof this.rpc.getStats === 'function') {
      return {
        enabled: true,
        ...this.rpc.getStats()
      };
    }

    return {
      enabled: true,
      maxConcurrentRequests: this.concurrencyConfig.maxConcurrentRequests,
      queueTimeout: this.concurrencyConfig.queueTimeout,
      message: 'Stats not available from wrapped client'
    };
  }
}
