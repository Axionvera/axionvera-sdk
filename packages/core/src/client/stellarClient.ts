import {
  Account,
  FeeBumpTransaction,
  Keypair,
  rpc,
  Transaction,
  TransactionBuilder
} from "@stellar/stellar-sdk";

import {
  AxionveraNetwork,
  getNetworkPassphrase,
  resolveNetworkConfig
} from "../utils/networkConfig";
import { ConcurrencyConfig, DEFAULT_CONCURRENCY_CONFIG, createConcurrencyControlledClient } from "../utils/concurrencyQueue";
import { RetryConfig, createHttpClientWithRetry, retry } from "../utils/httpInterceptor";
import { NetworkError, toAxionveraError } from "../errors/axionveraError";
import { LogLevel, Logger } from "../utils/logger";
import { WebSocketManager, EventFilter, SorobanEvent, WebSocketConfig } from "./websocket";
import { CloudWatchConfig } from "../utils/logging/cloudwatch";

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
    this.network = config.network;
    this.rpcUrl = config.rpcUrl;
    this.networkPassphrase = config.networkPassphrase;

    if (this.network === 'mainnet' && !this.rpcUrl.startsWith('https://')) {
      throw new AxionveraError('RPC URL must use https for mainnet');
    }

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
    params?: { timeoutMs?: number; intervalMs?: number }
  ): Promise<unknown> {
    return this.executeWithErrorHandling(async () => {
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
