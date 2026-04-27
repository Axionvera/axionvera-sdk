import {
  Account,
  FeeBumpTransaction,
  Keypair,
  Networks,
  rpc,
  SorobanDataBuilder,
  Transaction,
  TransactionBuilder
} from "@stellar/stellar-sdk";

import { AxionveraNetwork, resolveNetworkConfig } from "../utils/networkConfig";
import { ConcurrencyConfig, DEFAULT_CONCURRENCY_CONFIG, createConcurrencyControlledClient } from "../utils/concurrencyQueue";
import { RetryConfig, createHttpClientWithRetry, retry } from "../utils/httpInterceptor";
import { normalizeRpcError, normalizeTransactionError, TransactionTimeoutError, InsecureNetworkError, AxionveraError, AxionveraRPCError, SimulationFailedError, ValidationError, toAxionveraError } from "../errors/axionveraError";
import { WebSocketManager } from "./websocket/websocketManager";
import { WebSocketConfig } from "./websocket/types";
import { Logger } from "../utils/logger";

const DEFAULT_FEE_BUFFER_MULTIPLIER = 1.15;

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
  /** Multiplier applied to simulated Soroban resources and fees (default: 1.15). */
  feeBufferMultiplier?: number;
  /** Hard ceiling for the total prepared fee in stroops. */
  maxFeeLimit?: number;
  allowHttp?: boolean;
};

export type TransactionSendResult = {
  hash: string;
  status: string;
  raw: unknown;
};

type TransactionResponseRecord = Record<string, unknown>;

export type TransactionPollResult = TransactionResponseRecord & {
  status: string;
  ledger: number | null;
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
  /** Multiplier applied to simulated Soroban resources and fees. */
  readonly feeBufferMultiplier: number;
  /** Optional hard ceiling for the total prepared fee. */
  readonly maxFeeLimit?: bigint;

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
    this.feeBufferMultiplier = options?.feeBufferMultiplier ?? DEFAULT_FEE_BUFFER_MULTIPLIER;

    if (!Number.isFinite(this.feeBufferMultiplier) || this.feeBufferMultiplier < 1) {
      throw new ValidationError("feeBufferMultiplier must be a finite number greater than or equal to 1");
    }

    if (options?.maxFeeLimit !== undefined) {
      if (!Number.isInteger(options.maxFeeLimit) || options.maxFeeLimit <= 0) {
        throw new ValidationError("maxFeeLimit must be a positive integer");
      }

      this.maxFeeLimit = BigInt(options.maxFeeLimit);
    }

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
   * Prepares a transaction by fetching the current ledger sequence
   * and setting the correct min sequence age.
   * @param tx - The transaction to prepare
   * @returns The prepared transaction
   */
  async prepareTransaction(tx: Transaction | FeeBumpTransaction): Promise<Transaction> {
    if (tx instanceof FeeBumpTransaction) {
      try {
        return await this.rpc.prepareTransaction(tx);
      } catch (error) {
        throw toAxionveraError(error, "Failed to prepare transaction");
      }
    }

    try {
      const simulation = await this.simulateTransaction(tx);
      const assembledTx = rpc.assembleTransaction(tx, simulation).build();
      return this.applyFeeBuffer(assembledTx);
    } catch (error) {
      if (error instanceof AxionveraError) {
        throw error;
      }

      throw toAxionveraError(error, "Failed to prepare transaction");
    }
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
   * @throws TransactionTimeoutError if the transaction does not reach a final status in time
   */
  async pollTransaction(
    hash: string,
    params?: { timeoutMs?: number; intervalMs?: number }
  ): Promise<TransactionPollResult> {
    const timeoutMs = params?.timeoutMs ?? 30_000;
    const intervalMs = params?.intervalMs ?? 1_000;

    validatePollingInterval(timeoutMs, "timeoutMs", true);
    validatePollingInterval(intervalMs, "intervalMs", false);

    return new Promise<TransactionPollResult>((resolve, reject) => {
      let settled = false;
      let pollTimer: ReturnType<typeof setTimeout> | undefined;

      const clearTimers = () => {
        clearTimeout(timeoutTimer);
        if (pollTimer) {
          clearTimeout(pollTimer);
        }
      };

      const settle = (callback: () => void) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimers();
        callback();
      };

      const scheduleNextPoll = () => {
        if (settled) {
          return;
        }

        pollTimer = setTimeout(() => {
          void pollOnce();
        }, intervalMs);
      };

      const timeoutTimer = setTimeout(() => {
        settle(() => {
          reject(
            new TransactionTimeoutError(
              `Timed out waiting for transaction ${hash} after ${timeoutMs}ms`
            )
          );
        });
      }, timeoutMs);

      const pollOnce = async () => {
        try {
          const res = await this.getTransaction(hash);
          if (settled) {
            return;
          }

          const parsed = parseTransactionPollResult(res);
          if (parsed.status === "SUCCESS" || parsed.status === "FAILED") {
            settle(() => resolve(parsed));
            return;
          }

          scheduleNextPoll();
        } catch (error) {
          if (settled) {
            return;
          }

          settle(() => reject(error));
        }
      };

      void pollOnce();
    });
  }

  private applyFeeBuffer(tx: Transaction): Transaction {
    const sorobanData = tx.toEnvelope().v1().tx().ext().value();
    if (!sorobanData) {
      return tx;
    }

    const resources = sorobanData.resources();
    const simulatedResourceFee = sorobanData.resourceFee().toBigInt();
    const simulatedTotalFee = BigInt(tx.fee);
    const simulatedBaseFee = simulatedTotalFee > simulatedResourceFee
      ? simulatedTotalFee - simulatedResourceFee
      : BigInt(0);

    const bufferedResourceFee = multiplyAndCeil(simulatedResourceFee, this.feeBufferMultiplier);
    const bufferedBaseFee = multiplyAndCeil(simulatedBaseFee, this.feeBufferMultiplier);
    const bufferedTotalFee = bufferedBaseFee + bufferedResourceFee;

    if (this.maxFeeLimit !== undefined) {
      if (this.maxFeeLimit < simulatedTotalFee) {
        throw new ValidationError(
          `maxFeeLimit (${this.maxFeeLimit.toString()}) is below the simulated minimum fee (${simulatedTotalFee.toString()})`
        );
      }

      if (bufferedTotalFee > this.maxFeeLimit) {
        throw new ValidationError(
          `Buffered fee (${bufferedTotalFee.toString()}) exceeds maxFeeLimit (${this.maxFeeLimit.toString()})`
        );
      }
    }

    const bufferedSorobanData = new SorobanDataBuilder(sorobanData)
      .setResources(
        multiplyAndCeil(resources.instructions(), this.feeBufferMultiplier),
        multiplyAndCeil(resources.diskReadBytes(), this.feeBufferMultiplier),
        multiplyAndCeil(resources.writeBytes(), this.feeBufferMultiplier)
      )
      .setResourceFee(bufferedResourceFee.toString())
      .build();

    return TransactionBuilder.cloneFrom(tx, {
      fee: bufferedBaseFee.toString(),
      networkPassphrase: tx.networkPassphrase,
      sorobanData: bufferedSorobanData
    }).build();
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

function multiplyAndCeil(value: number | bigint | string, multiplier: number): bigint {
  const scaledValue = typeof value === "bigint" ? value : BigInt(String(value));
  if (scaledValue < BigInt(0)) {
    throw new ValidationError("Cannot buffer a non-finite or negative resource value");
  }

  const { numerator, denominator } = toFraction(multiplier);
  return (scaledValue * numerator + (denominator - BigInt(1))) / denominator;
}

function toFraction(multiplier: number): { numerator: bigint; denominator: bigint } {
  if (!Number.isFinite(multiplier) || multiplier < 0) {
    throw new ValidationError("feeBufferMultiplier must be a finite number greater than or equal to 0");
  }

  const decimalString = multiplier.toString().includes("e")
    ? multiplier.toFixed(12).replace(/0+$/, "").replace(/\.$/, "")
    : multiplier.toString();
  const [wholePart, fractionalPart = ""] = decimalString.split(".");

  if (!/^\d+$/.test(wholePart) || !/^\d*$/.test(fractionalPart)) {
    throw new ValidationError("feeBufferMultiplier must be a valid decimal number");
  }

  const denominator = BigInt(10) ** BigInt(fractionalPart.length);
  const numerator = BigInt(`${wholePart}${fractionalPart}`);

  return {
    numerator,
    denominator: denominator === BigInt(0) ? BigInt(1) : denominator
  };
}

function validatePollingInterval(value: number, fieldName: string, allowZero: boolean): void {
  const valid = Number.isFinite(value) && (allowZero ? value >= 0 : value > 0);
  if (!valid) {
    throw new ValidationError(`${fieldName} must be a finite ${allowZero ? "non-negative" : "positive"} number`);
  }
}

function parseTransactionPollResult(response: unknown): TransactionPollResult {
  const record = isRecord(response) ? response : {};
  const status = typeof record.status === "string" ? record.status : "UNKNOWN";

  return {
    ...record,
    status,
    ledger: normalizeLedger(record.ledger)
  };
}

function normalizeLedger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function isRecord(value: unknown): value is TransactionResponseRecord {
  return typeof value === "object" && value !== null;
}
