import {
  Account,
  Address,
  Contract,
  FeeBumpTransaction,
  Keypair,
  nativeToScVal,
  rpc,
  Transaction,
  TransactionBuilder,
  xdr
} from "@stellar/stellar-sdk";

import {
  AxionveraNetwork,
  getNetworkPassphrase,
  resolveNetworkConfig
} from "../utils/networkConfig";
import { ConcurrencyConfig, DEFAULT_CONCURRENCY_CONFIG, createConcurrencyControlledClient } from "../utils/concurrencyQueue";
import { RetryConfig, createHttpClientWithRetry, retry } from "../utils/httpInterceptor";
import { NetworkError, toAxionveraError, InsecureNetworkError, AxionveraError } from "../errors/axionveraError";
import { LogLevel, Logger } from "../utils/logger";
import { WebSocketManager, EventFilter, SorobanEvent, WebSocketConfig } from "./websocket";
import { CloudWatchConfig } from "../utils/logging/cloudwatch";
import {
  FetchTransactionHistoryOptions,
  TransactionHistoryResult,
  parseTransaction,
  sortByTimestamp,
  filterByActionType
} from "../utils/transactionHistory";

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
  logLevel?: LogLevel;
  webSocketConfig?: WebSocketConfig;
  cloudWatchConfig?: CloudWatchConfig;
  customHeaders?: Record<string, string>;
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
export abstract class BaseStellarRpcClient {
  // ...
}

export class StellarClient extends BaseStellarRpcClient {
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
  private readonly concurrencyConfig: ConcurrencyConfig;
  /** Indicates whether concurrency control was explicitly enabled. */
  private readonly concurrencyEnabled: boolean;
  /** The internal logger instance. */
  private readonly logger: Logger;
  /** WebSocket manager for real-time events. */
  private webSocketManager: WebSocketManager | null = null;

   /**
    * Creates a new StellarClient instance.
    * @param options - Configuration options
    */
    constructor(options?: StellarClientOptions) {
      const config = resolveNetworkConfig(options);
      const rpcUrl = config.rpcUrl;
      const network = config.network;
      const networkPassphrase = config.networkPassphrase;

      // Validate RPC URL has a protocol
      if (!rpcUrl.startsWith('http://') && !rpcUrl.startsWith('https://')) {
        throw new AxionveraError('RPC URL must include a protocol (http:// or https://)');
      }

      // Security guard: prevent insecure HTTP in production unless explicitly allowed
      const isProduction = process.env.NODE_ENV === 'production';
      const isHttp = rpcUrl.startsWith('http://');
      const isLocalhost = isLocalhostUrl(rpcUrl);
      const allowHttp = options?.allowHttp ?? false;

      if (isProduction && isHttp && !isLocalhost && !allowHttp) {
        throw new InsecureNetworkError(
          'Insecure RPC connection in production: HTTP endpoint detected. ' +
          'Use HTTPS for production or set allowHttp: true to override. ' +
          'Note: localhost endpoints are always permitted.'
        );
      }

      super();

      this.network = network;
      this.rpcUrl = rpcUrl;
      this.networkPassphrase = networkPassphrase;

     this.concurrencyConfig = {
      ...DEFAULT_CONCURRENCY_CONFIG,
      ...options?.concurrencyConfig
    };
    this.concurrencyEnabled = !!options?.concurrencyConfig;
    this.retryConfig = options?.retryConfig ?? {};
    this.httpClient = createHttpClientWithRetry(this.retryConfig);
    this.logger = new Logger(options?.logLevel ?? 'none', options?.cloudWatchConfig);

    this.logger.info(`Initializing StellarClient for ${this.network} at ${this.rpcUrl}`);

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
  async getHealth(): Promise<unknown> {
    this.logger.debug("Fetching network health");
    return this.executeWithErrorHandling(
      () => retry(() => this.rpc.getHealth(), this.retryConfig),
      "Failed to fetch network health"
    );
  }

  /**
   * Retrieves the network configuration from the RPC server.
   * Automatically retries on failure.
   * @returns The network configuration
   */
  async getNetwork(): Promise<unknown> {
    this.logger.debug("Fetching network configuration");
    return this.executeWithErrorHandling(
      () => retry(() => this.rpc.getNetwork(), this.retryConfig),
      "Failed to fetch network configuration"
    );
  }

  /**
   * Gets the latest ledger sequence number.
   * Automatically retries on failure.
   * @returns The latest ledger info
   */
  async getLatestLedger(): Promise<unknown> {
    this.logger.debug("Fetching latest ledger");
    return this.executeWithErrorHandling(
      () => retry(() => this.rpc.getLatestLedger(), this.retryConfig),
      "Failed to fetch latest ledger"
    );
  }

  /**
   * Retrieves an account's information from the network.
   * Automatically retries on failure.
   * @param publicKey - The account's public key
   * @returns The account information
   */
  async getAccount(publicKey: string): Promise<Account> {
    this.logger.debug(`Fetching account ${publicKey}`);
    return this.executeWithErrorHandling(
      () => retry(() => this.rpc.getAccount(publicKey), this.retryConfig),
      `Failed to fetch account ${publicKey}`
    );
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
    this.logger.debug("Simulating transaction");
    return this.executeWithErrorHandling(
      () => this.rpc.simulateTransaction(tx),
      "Failed to simulate transaction"
    );
  }

  /**
   * Simulates a pure read-only contract call without requiring a source account or sequence number.
   * This dramatically speeds up dashboard loading times because the SDK doesn't need to fetch 
   * the user's ledger sequence number before checking a read-only balance.
   * 
   * @param contractId - The contract ID to call
   * @param method - The method name to call
   * @param args - The arguments to pass to the method (optional)
   * @returns The unwrapped scVal result directly
   */
  async simulateRead(
    contractId: string,
    method: string,
    args?: any[]
  ): Promise<xdr.ScVal> {
    this.logger.debug(`Simulating read-only call to ${contractId}.${method}`);

    return this.executeWithErrorHandling(async () => {
      // Create a dummy account with zeroed-out sequence for read-only simulation
      const dummyAccount = new Account(
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH", // All zeros public key
        "0" // Zero sequence number
      );

      // Convert args to ScVal if provided
      const scVals = args ? args.map(arg => {
        if (typeof arg === 'string') {
          try {
            // Try to parse as address first
            return Address.fromString(arg).toScVal();
          } catch {
            // Fall back to native conversion
            return nativeToScVal(arg);
          }
        } else if (typeof arg === 'number' || typeof arg === 'bigint') {
          return nativeToScVal(arg);
        } else if (typeof arg === 'boolean') {
          return nativeToScVal(arg);
        } else if (arg === null || arg === undefined) {
          return xdr.ScVal.scvVoid();
        } else {
          return nativeToScVal(arg);
        }
      }) : [];

      // Create the contract call operation
      const contract = new Contract(contractId);
      const operation = contract.call(method, ...scVals);

      // Build a minimal transaction for simulation
      const tx = new TransactionBuilder(dummyAccount, {
        fee: "100", // Minimal fee for simulation
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(operation)
        .setTimeout(30) // Short timeout for read operations
        .build();

      // Simulate the transaction
      const simulationResult = await this.rpc.simulateTransaction(tx);

      // Check for simulation errors
      if (simulationResult.error) {
        throw new NetworkError(`Simulation failed: ${simulationResult.error}`);
      }

      // Extract the result from the simulation
      if (!simulationResult.result) {
        throw new NetworkError('No result returned from simulation');
      }

      // Return the first (and typically only) result
      const results = simulationResult.result;
      if (results.length === 0) {
        throw new NetworkError('No results returned from simulation');
      }

      const firstResult = results[0];
      if (!firstResult) {
        throw new NetworkError('Empty result returned from simulation');
      }

      return firstResult;
    }, `Failed to simulate read call to ${contractId}.${method}`);
  }

  /**
   * Prepares a transaction by fetching the current ledger sequence
   * and setting the correct min sequence age.
   * @param tx - The transaction to prepare
   * @returns The prepared transaction
   */
  async prepareTransaction(tx: Transaction | FeeBumpTransaction): Promise<Transaction> {
    this.logger.debug("Preparing transaction");
    return this.executeWithErrorHandling(
      () => this.rpc.prepareTransaction(tx),
      "Failed to prepare transaction"
    );
  }

  /**
   * Submits a signed transaction to the network.
   * @param tx - The signed transaction to submit
   * @returns The submission result containing hash and status
   */
  async sendTransaction(tx: Transaction | FeeBumpTransaction): Promise<TransactionSendResult> {
    this.logger.info("Sending transaction");
    return this.executeWithErrorHandling(async () => {
      const result = await this.rpc.sendTransaction(tx);
      const hash = (result as any).hash ?? (result as any).id ?? "";
      const status = (result as any).status ?? (result as any).statusText ?? "unknown";
      this.logger.info(`Transaction submitted: ${hash} (Status: ${status})`);
      return { hash, status, raw: result };
    }, "Failed to send transaction");
  }

  /**
   * Retrieves the status of a submitted transaction.
   * Automatically retries on failure.
   * @param hash - The transaction hash
   * @returns The transaction status response
   */
  async getTransaction(hash: string): Promise<unknown> {
    this.logger.debug(`Fetching transaction status for ${hash}`);
    return this.executeWithErrorHandling(
      () => retry(() => this.rpc.getTransaction(hash), this.retryConfig),
      `Failed to fetch transaction ${hash}`
    );
  }

  /**
   * Polls for a transaction to be confirmed or rejected.
   * @param hash - The transaction hash to wait for
   * @param params - Polling parameters
   * @param params.timeoutMs - Maximum time to wait in milliseconds (default: 30000)
   * @param params.intervalMs - Time between polls in milliseconds (default: 1000)
   * @returns The transaction result when it reaches a final state
   * @throws Error if the transaction times out
   */
  async pollTransaction(
    hash: string,
    params?: {
      timeoutMs?: number;
      intervalMs?: number;
      onProgress?: (status: string, ledger: number) => void | Promise<void>;
    }
  ): Promise<unknown> {
    return this.executeWithErrorHandling(async () => {
      const timeoutMs = params?.timeoutMs ?? 30_000;
      const intervalMs = params?.intervalMs ?? 1_000;
      const onProgress = params?.onProgress;

      const deadline = Date.now() + timeoutMs;

      while (Date.now() < deadline) {
        const res = await this.getTransaction(hash);

        const status = (res as any)?.status ?? "UNKNOWN";
        const ledger = (res as any)?.ledger ?? 0;

        // ✅ NON-BLOCKING progress callback
        if (onProgress) {
          Promise.resolve()
            .then(() => onProgress(status, ledger))
            .catch((err) => {
              this.logger.warn("onProgress callback error", err);
            });
        }

        // existing exit logic
        if (status && status !== "NOT_FOUND") {
          return res;
        }

        await new Promise((r) => setTimeout(r, intervalMs));
      }

      throw new NetworkError(`Timed out waiting for transaction ${hash}`);
    }, `Failed while polling transaction ${hash}`);
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
   * Serializes an unsigned transaction to a Base64 JSON string for offline signing.
   * This is critical for air-gapped signing workflows or hardware security module (HSM) integrations.
   * @param tx - The transaction to serialize (Transaction or FeeBumpTransaction)
   * @returns Base64-encoded JSON string containing transaction XDR, network passphrase, and timeout limits
   */
  serializeTransaction(tx: Transaction | FeeBumpTransaction): string {
    const serializedData = {
      xdr: tx.toXDR(),
      networkPassphrase: this.networkPassphrase,
      timeout: tx.timeBounds?.maxTime || null,
      fee: tx.fee.toString(),
      sourceAccount: tx.sourceAccount().accountId(),
      sequence: tx.sequence,
      memo: tx.memo ? tx.memo.value : null,
      operations: tx.operations.map((op: any) => ({
        type: op.type,
        source: op.source ? op.source : null,
        // Basic operation serialization - can be extended based on needs
      }))
    };
    
    if (typeof Buffer === 'undefined') {
      throw new Error('Buffer is not defined. Please polyfill Buffer for React Native/mobile environments.');
    }
    return Buffer.from(JSON.stringify(serializedData)).toString('base64');
  }


  /**
   * Deserializes a transaction from a Base64 JSON string.
   * Reconstructs the exact Transaction or FeeBumpTransaction object.
   * @param jsonString - The Base64-encoded JSON string from serializeTransaction
   * @returns The reconstructed Transaction or FeeBumpTransaction
   */
  deserializeTransaction(jsonString: string): Transaction | FeeBumpTransaction {
    if (typeof Buffer === 'undefined') {
      throw new Error('Buffer is not defined. Please polyfill Buffer for React Native/mobile environments.');
    }
    try {
      const decodedJson = Buffer.from(jsonString, 'base64').toString('utf8');

      const serializedData = JSON.parse(decodedJson);

      // Validate required fields
      if (!serializedData.xdr || !serializedData.networkPassphrase) {
        throw new Error('Invalid serialized transaction: missing required fields');
      }

      // Parse the transaction from XDR
      const tx = TransactionBuilder.fromXDR(serializedData.xdr, serializedData.networkPassphrase);

      return tx;
    } catch (error) {
      throw new Error(`Failed to deserialize transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verifies that a deserialized transaction matches the hash of the original.
   * @param originalTx - The original transaction
   * @param deserializedTx - The deserialized transaction
   * @returns True if the hashes match
   */
  static verifyTransactionHash(
    originalTx: Transaction | FeeBumpTransaction,
    deserializedTx: Transaction | FeeBumpTransaction
  ): boolean {
    const originalHash = originalTx.hash().toString('hex');
    const deserializedHash = deserializedTx.hash().toString('hex');
    return originalHash === deserializedHash;
  }

  /**
   * Gets the default network passphrase for a given network.
   * @param network - The network ("testnet" or "mainnet")
   * @returns The corresponding network passphrase
   */
  static getDefaultNetworkPassphrase(network: AxionveraNetwork): string {
    return getNetworkPassphrase(network);
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

  /**
   * Get detailed queue status for monitoring
   */
  getQueueStatus() {
    if (!this.concurrencyEnabled) {
      return {
        enabled: false,
        message: 'Concurrency control is not enabled'
      };
    }

    // Try to get detailed status from the wrapped client if it has the method
    if ('getQueueStatus' in this.rpc && typeof this.rpc.getQueueStatus === 'function') {
      return {
        enabled: true,
        ...this.rpc.getQueueStatus()
      };
    }

    // Fallback to basic stats
    return this.getConcurrencyStats();
  }

  /**
   * Subscribe to real-time events via WebSocket.
   * @param filter - Event filter criteria
   * @param callback - Callback function for received events
   * @returns Subscription ID that can be used to unsubscribe
   */
  async subscribeToEvents(
    filter: EventFilter,
    callback: (event: SorobanEvent) => void
  ): Promise<string> {
    if (!this.webSocketManager) {
      throw new NetworkError('WebSocket manager not initialized. Please provide webSocketConfig in constructor.');
    }

    // Connect WebSocket if not already connected
    if (!this.webSocketManager.isConnected()) {
      await this.webSocketManager.connect();
    }

    return this.webSocketManager.subscribe(filter, callback);
  }

  /**
   * Unsubscribe from real-time events.
   * @param subscriptionId - The subscription ID returned by subscribeToEvents
   */
  unsubscribeFromEvents(subscriptionId: string): void {
    if (this.webSocketManager) {
      this.webSocketManager.unsubscribe(subscriptionId);
    }
  }

  /**
   * Get WebSocket connection status and statistics.
   */
  getWebSocketStatus() {
    if (!this.webSocketManager) {
      return {
        enabled: false,
        connected: false,
        subscriptions: 0,
        message: 'WebSocket manager not initialized'
      };
    }

    return {
      enabled: true,
      connected: this.webSocketManager.isConnected(),
      subscriptions: this.webSocketManager.getSubscriptionCount(),
    };
  }

  /**
   * Disconnect WebSocket and cleanup resources.
   */
  disconnectWebSocket(): void {
    if (this.webSocketManager) {
      this.webSocketManager.disconnect();
    }
  }

  /**
   * Get CloudWatch logging statistics.
   */
  getCloudWatchStats() {
    return this.logger.getCloudWatchStats();
  }

  /**
   * Alias for cleanup(). Removes all active subscriptions and listeners.
   * Useful in React useEffect cleanup blocks.
   * 
   * @example
   * ```typescript
   * useEffect(() => {
   *   return () => client.removeAllListeners();
   * }, [client]);
   * ```
   */
  public removeAllListeners(): void {
    this.cleanup();
  }

  /**
   * Cleanup all async resources including WebSocket and CloudWatch.
   */
  async cleanup(): Promise<void> {
    this.disconnectWebSocket();
    await this.logger.destroy();
  }

  private async executeWithErrorHandling<T>(fn: () => Promise<T>, fallbackMessage: string): Promise<T> {
    try {
      return await fn();
    } catch (error: unknown) {
      this.logger.error(fallbackMessage, error);
      throw toAxionveraError(error, fallbackMessage);
    }
  }
}

/**
 * Extracts cursor parameter from a URL.
 * @param url - The URL to extract cursor from
 * @returns The cursor value or undefined
 */
function extractCursor(url: string): string | undefined {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('cursor') ?? undefined;
  } catch {
    return undefined;
  }
}
