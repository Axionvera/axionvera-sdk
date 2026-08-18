import {
  Account,
  Address,
  Contract,
  FeeBumpTransaction,
  Keypair,
  nativeToScVal,
  scValToNative,
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
import { NetworkError, InsecureNetworkError, AxionveraError, ValidationError } from "../errors/axionveraError";
import {
  validateRpcResponse,
  GetHealthResponseSchema,
  SimulateTransactionResponseSchema,
  GetTransactionResponseSchema,
  ValidatedGetHealthResponse,
  ValidatedGetTransactionResponse,
} from "../utils/rpcSchemas";
import { LogLevel, Logger } from "../utils/logger";
import { WebSocketManager, WebSocketConfig } from "./websocket";
import { CloudWatchConfig } from "../utils/logging/cloudwatch";
import {
  FetchTransactionHistoryOptions,
  TransactionHistoryResult,
  parseTransaction,
  sortByTimestamp,
  filterByActionType
} from "../utils/transactionHistory";

import {
  RpcEndpointStatus,
  RpcHealthMonitor,
  RpcHealthMonitorConfig,
  RpcHealthStatusReport
} from "../monitoring";

const DEFAULT_FEE_BUFFER_MULTIPLIER = 1.15;

/**
* Checks if a URL points to a localhost address.
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
  rpcUrls?: string[];
  networkPassphrase?: string;
  concurrencyConfig?: Partial<ConcurrencyConfig>;
  retryConfig?: Partial<RetryConfig>;
  logLevel?: LogLevel;
  webSocketConfig?: WebSocketConfig;
  cloudWatchConfig?: CloudWatchConfig;
  monitoringConfig?: Partial<Omit<RpcHealthMonitorConfig, "endpoints">> & {
    enabled?: boolean;
  };
  customHeaders?: Record<string, string>;
  feeBufferMultiplier?: number;
  maxFeeLimit?: number;
  allowHttp?: boolean;
  accountFetchTimeoutMs?: number;
  cacheTtlMs?: number;
};

export interface ContractEventResult {
  id: string;
  type: rpc.Api.EventType;
  contractId?: string;
  topic: xdr.ScVal[];
  topicNames: string[];
  value: xdr.ScVal;
  ledger: number;
  ledgerClosedAt: string;
  transactionIndex: number;
  operationIndex: number;
  inSuccessfulContractCall: boolean;
  txHash: string;
};

export type TransactionSendResult = {
  hash: string;
  status: string;
  raw: unknown;
};

export type GetContractEventsOptions = {
  startLedger?: number;
  endLedger?: number;
  limit?: number;
  cursor?: string;
  fetchAll?: boolean;
  startTime?: Date | string | number | "last24Hours";
};

export type GetContractEventsResult = {
  events: ContractEventResult[];
  pagingToken?: string;
};

/** Snapshot version for forward-compatibility of (de)serialized state. */
export const HYDRATION_STATE_VERSION = 1 as const;

export type SerializableValue =
  | string
  | number
  | boolean
  | null
  | Date
  | SerializableValue[]
  | { [key: string]: SerializableValue };

export type SimulationContext = { [key: string]: SerializableValue };

export interface PendingTransaction {
  hash: string;
  simulationContext?: SimulationContext;
  submittedAt: Date;
  intervalMs: number;
  deadline: Date;
  label?: string;
}

export interface TrackedTransaction extends PendingTransaction {
  promise: Promise<unknown>;
  cancel: () => void;
}

export interface SerializedPendingTransaction {
  hash: string;
  simulationContext?: SimulationContext;
  submittedAt: string;
  intervalMs: number;
  deadline: string;
  label?: string;
}

export interface ExportedState {
  version: typeof HYDRATION_STATE_VERSION;
  exportedAt: string;
  pending: SerializedPendingTransaction[];
}

export interface TrackTransactionOptions {
  hash: string;
  simulationContext?: SimulationContext;
  intervalMs?: number;
  timeoutMs?: number;
  deadline?: Date;
  label?: string;
}

const DATE_MARKER = "__date" as const;

function freezeDates(value: SerializableValue): SerializableValue {
  if (value instanceof Date) return { [DATE_MARKER]: value.toISOString() };
  if (Array.isArray(value)) return value.map((item) => freezeDates(item));
  if (value !== null && typeof value === "object") {
    const out: { [key: string]: SerializableValue } = {};
    for (const key of Object.keys(value)) {
      out[key] = freezeDates((value as { [key: string]: SerializableValue })[key] as SerializableValue);
    }
    return out;
  }
  return value;
}

function thawDates(value: SerializableValue): SerializableValue {
  if (Array.isArray(value)) return value.map((item) => thawDates(item));
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    const obj = value as { [key: string]: SerializableValue };
    const marker = obj[DATE_MARKER];
    if (typeof marker === "string" && Object.keys(obj).length === 1) {
      const parsed = new Date(marker);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    const out: { [key: string]: SerializableValue } = {};
    for (const key of Object.keys(obj)) {
      out[key] = thawDates(obj[key] as SerializableValue);
    }
    return out;
  }
  return value;
}

function freezeContext(ctx: SimulationContext | undefined): SimulationContext | undefined {
  if (!ctx) return undefined;
  return freezeDates(ctx) as SimulationContext;
}

function thawContext(ctx: SimulationContext | undefined): SimulationContext | undefined {
  if (!ctx) return undefined;
  return thawDates(ctx) as SimulationContext;
}

type TransactionResponseRecord = Record<string, unknown>;

export type TransactionPollResult = TransactionResponseRecord & {
  status: string;
  ledger: number | null;
};

export abstract class BaseStellarRpcClient {
  abstract executeWithErrorHandling<T>(action: () => Promise<T>, message: string): Promise<T>;
}

export class StellarClient extends BaseStellarRpcClient {
  readonly network: AxionveraNetwork;
  /** The RPC URL(s) this client uses (for failover). */
  readonly rpcUrls: string[];
  /** The current RPC URL index being used. */
  private currentRpcIndex: number;
  /** The network passphrase for transaction signing. */
  readonly networkPassphrase: string;
  /** The underlying RPC server instances (one per URL). */
  private rpcServers: rpc.Server[];
  /** The HTTP client with retry interceptors. */
  readonly httpClient;
  readonly retryConfig: Partial<RetryConfig>;
  private readonly concurrencyConfig: ConcurrencyConfig;
  private readonly concurrencyEnabled: boolean;
  private readonly logger: Logger;
  private webSocketManager: WebSocketManager | null = null;
  /** Optional RPC endpoint health monitor. */
  readonly healthMonitor?: RpcHealthMonitor;
  private readonly pendingTransactions = new Map<string, TrackedTransaction>();
  readonly accountFetchTimeoutMs: number;
  readonly cacheTtlMs: number;
  private accountSequenceCache: Map<string, { sequence: bigint; timestamp: number }>;
  private readonly feeBufferMultiplier: number;
  private readonly maxFeeLimit?: bigint;

  /** Get the current RPC URL in use. */
  get rpcUrl(): string {
    return this.rpcUrls[this.currentRpcIndex];
  }

  /** Get the current RPC server in use. */
  get rpc(): rpc.Server {
    return this.rpcServers[this.currentRpcIndex];
  }

   /**
    * Creates a new StellarClient instance.
    * @param options - Configuration options
    */
    constructor(options?: StellarClientOptions) {
      const config = resolveNetworkConfig(options);
      const rpcUrls = config.rpcUrls;
      const network = config.network;
      const networkPassphrase = config.networkPassphrase;
      const allowHttp = options?.allowHttp ?? false;

      // Validate all RPC URLs have a protocol
      for (const url of rpcUrls) {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          throw new AxionveraError('RPC URL must include a protocol (http:// or https://)');
        }

        // Security guard: prevent insecure HTTP in production unless explicitly allowed
        const isProduction = process.env.NODE_ENV === 'production';
        const isHttp = url.startsWith('http://');
        const isLocalhost = isLocalhostUrl(url);

        if (isProduction && isHttp && !isLocalhost && !allowHttp) {
          throw new InsecureNetworkError(
            'Insecure RPC connection in production: HTTP endpoint detected. ' +
            'Use HTTPS for production or set allowHttp: true to override. ' +
            'Note: localhost endpoints are always permitted.'
          );
        }
      }

    super();
    this.network = network;
    this.rpcUrls = rpcUrls;
    this.currentRpcIndex = 0;
    this.networkPassphrase = networkPassphrase;
    this.concurrencyConfig = { ...DEFAULT_CONCURRENCY_CONFIG, ...options?.concurrencyConfig };
    this.concurrencyEnabled = !!options?.concurrencyConfig;
    this.retryConfig = options?.retryConfig ?? {};
    this.httpClient = createHttpClientWithRetry(this.retryConfig);
    this.logger = new Logger(options?.logLevel ?? 'none', options?.cloudWatchConfig);
    this.accountFetchTimeoutMs = options?.accountFetchTimeoutMs ?? 2000;
    this.cacheTtlMs = options?.cacheTtlMs ?? 5000;
    this.accountSequenceCache = new Map();
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

    this.logger.info(`Initializing StellarClient for ${this.network} with RPC URLs: ${this.rpcUrls.join(', ')}`);

    // Initialize RPC servers for all URLs
    this.rpcServers = this.rpcUrls.map((url) => {
      const isHttp = url.startsWith("http://");
      const baseRpc = new rpc.Server(url, { allowHttp: isHttp || allowHttp });
      if (this.concurrencyEnabled) {
        return createConcurrencyControlledClient(baseRpc, this.concurrencyConfig);
      }
      return baseRpc;
    });

    if (options?.webSocketConfig) {
      this.webSocketManager = new WebSocketManager(this.rpcUrl, options.webSocketConfig, {
          onEvent: (event) => this.logger.debug('WebSocket event received:', event),
          onConnectionChange: (connected) => this.logger.debug(`WebSocket connection changed: ${connected}`),
          logger: this.logger,
      });
    }

    if (options?.monitoringConfig?.enabled) {
      const monitorConfig: RpcHealthMonitorConfig = {
        endpoints: this.rpcUrls.map((url, index) => ({
          id: `${this.network}:${url}`,
          url,
          network: this.network,
          rpcClient: this.rpcServers[index],
          allowHttp,
        })),
      };

      if (options.monitoringConfig.intervalMs !== undefined) {
        monitorConfig.intervalMs = options.monitoringConfig.intervalMs;
      }

      if (options.monitoringConfig.timeoutMs !== undefined) {
        monitorConfig.timeoutMs = options.monitoringConfig.timeoutMs;
      }

      if (options.monitoringConfig.degradedLatencyMs !== undefined) {
        monitorConfig.degradedLatencyMs = options.monitoringConfig.degradedLatencyMs;
      }

      if (options.monitoringConfig.unhealthyAfterFailures !== undefined) {
        monitorConfig.unhealthyAfterFailures = options.monitoringConfig.unhealthyAfterFailures;
      }

      if (options.monitoringConfig.autoStart !== undefined) {
        monitorConfig.autoStart = options.monitoringConfig.autoStart;
      }

      this.healthMonitor = new RpcHealthMonitor(monitorConfig);
    }
  }

  async executeWithErrorHandling<T>(
    action: () => Promise<T>,
    message = 'Stellar client operation failed'
  ): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof AxionveraError) {
        throw error;
      }

      throw new NetworkError(message, { originalError: error });
    }
  }

  /**
   * Tries to switch to the next available RPC URL.
   * @returns Whether a new RPC server was successfully switched to
   */
  private trySwitchToNextRpc(): boolean {
    if (this.rpcUrls.length <= 1) {
      return false;
    }

    this.currentRpcIndex = (this.currentRpcIndex + 1) % this.rpcUrls.length;
    this.logger.info(`Switched to RPC URL: ${this.rpcUrl}`);
    return true;
  }

  /**
   * Executes an RPC function with failover support.
   * @param fn The function that uses the current RPC server
   * @returns The result of the function
   */
  private async executeWithFailover<T>(fn: (rpc: rpc.Server) => Promise<T>): Promise<T> {
    let lastError: unknown;
    let attempts = 0;
    const maxAttempts = this.rpcUrls.length;

    while (attempts < maxAttempts) {
      try {
        return await fn(this.rpc);
      } catch (error: unknown) {
        lastError = error;
        attempts++;
        
        if (attempts < maxAttempts) {
          this.logger.warn(`RPC call failed to ${this.rpcUrl}, trying next URL...`);
          this.trySwitchToNextRpc();
        }
      }
    }

    throw lastError;
  }

  /**
   * Checks the health of the RPC server.
   * Automatically retries and fails over to backup URLs on failure.
   * @returns The health check response
   */
  async getHealth(): Promise<ValidatedGetHealthResponse> {
    this.logger.debug("Fetching network health");
    return this.executeWithErrorHandling(async () => {
      const response = await this.executeWithFailover(rpc => 
        retry(() => rpc.getHealth(), this.retryConfig)
      );
      return validateRpcResponse(GetHealthResponseSchema, response, 'getHealth');
    }, "Failed to fetch network health");
  }

  /**
   * Runs a health check for this client's configured RPC endpoint.
   * Monitoring must be enabled with monitoringConfig.enabled.
   */
  async runEndpointHealthCheck(): Promise<RpcEndpointStatus> {
    if (!this.healthMonitor) {
      throw new AxionveraError('RPC health monitoring is not enabled for this client');
    }

    const [status] = await this.healthMonitor.runHealthChecks();
    return status;
  }

  /**
   * Returns the latest known health status for this client's current RPC endpoint.
   */
  getEndpointHealthStatus(): RpcEndpointStatus | undefined {
    return this.healthMonitor?.getEndpointStatus(`${this.network}:${this.rpcUrl}`);
  }

  /**
   * Returns a full health report for this client's monitored RPC endpoints.
   */
  getHealthStatusReport(): RpcHealthStatusReport | undefined {
    return this.healthMonitor?.getHealthReport();
  }

  startHealthMonitoring(): void {
    if (!this.healthMonitor) {
      throw new AxionveraError('RPC health monitoring is not enabled for this client');
    }

    this.healthMonitor.start();
  }

  stopHealthMonitoring(): void {
    this.healthMonitor?.stop();
  }

  /**
   * Retrieves the network configuration from the RPC server.
   * Automatically retries and fails over to backup URLs on failure.
   * @returns The network configuration
   */
  async getNetwork(): Promise<unknown> {
    this.logger.debug("Fetching network configuration");
    return this.executeWithErrorHandling(
      () => this.executeWithFailover(rpc => 
        retry(() => rpc.getNetwork(), this.retryConfig)
      ),
      "Failed to fetch network configuration"
    );
  }

  /**
   * Gets the latest ledger sequence number.
   * Automatically retries and fails over to backup URLs on failure.
   * @returns The latest ledger info
   */
  async getLatestLedger(): Promise<unknown> {
    this.logger.debug("Fetching latest ledger");
    return this.executeWithErrorHandling(
      () => this.executeWithFailover(rpc => 
        retry(() => rpc.getLatestLedger(), this.retryConfig)
      ),
      "Failed to fetch latest ledger"
    );
  }

  async getContractEvents(
    contractId: string,
    topicFilters?: string[][],
    options: GetContractEventsOptions = {}
  ): Promise<GetContractEventsResult> {
    this.logger.debug(`Fetching contract events for ${contractId}`);
    return this.executeWithErrorHandling(async () => {
      const endLedger = await this.resolveEndLedger(options.endLedger);
      const startLedger = this.resolveStartLedger(options, endLedger);
      const normalizedStartLedger = Math.min(startLedger, endLedger);
      const normalizedEndLedger = Math.max(startLedger, endLedger);

      const rangeParams: Parameters<typeof this.fetchContractEventsRange>[0] = {
        contractId,
        startLedger: normalizedStartLedger,
        endLedger: normalizedEndLedger,
        fetchAll: options.fetchAll ?? false,
      };
      if (topicFilters !== undefined) rangeParams.topicFilters = topicFilters;
      if (options.limit !== undefined) rangeParams.limit = options.limit;
      if (options.cursor !== undefined) rangeParams.cursor = options.cursor;

      return this.fetchContractEventsRange(rangeParams);
    }, `Failed to fetch contract events for ${contractId}`);
  }

  /**
   * Retrieves an account's information from the network.
   * Automatically retries and fails over to backup URLs on failure.
   * @param publicKey - The account's public key
   * @returns The account information
   */
  async getAccount(publicKey: string): Promise<Account> {
    this.logger.debug(`Fetching account ${publicKey}`);
    return this.executeWithErrorHandling(
      () => this.executeWithFailover(rpc => 
        retry(() => rpc.getAccount(publicKey), this.retryConfig)
      ),
      `Failed to fetch account ${publicKey}`
    );
  }

  async getAccountWithCache(publicKey: string): Promise<Account> {
    try {
      const account = await this.getAccountWithTimeout(publicKey, this.accountFetchTimeoutMs);
      this.updateCache(publicKey, account.sequenceNumber().toString());
      return account;
    } catch (error) {
      const cached = this.getCachedSequence(publicKey);
      if (cached) {
        this.logger.debug(`Using cached sequence for ${publicKey}: ${cached.sequence}`);
        const newSequence = cached.sequence + 1n;
        this.updateCache(publicKey, newSequence.toString());
        return new Account(publicKey, newSequence.toString());
      }
      throw new AxionveraError(`Failed to fetch account and no valid cache available for ${publicKey}`, { originalError: error });
    }
  }

  private async getAccountWithTimeout(publicKey: string, timeoutMs: number): Promise<Account> {
    return Promise.race([
      this.getAccount(publicKey),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Account fetch timeout after ${timeoutMs}ms`)), timeoutMs)
)
]);
}

private updateCache(publicKey: string, sequence: string): void {
    this.accountSequenceCache.set(publicKey, {
      sequence: BigInt(sequence),
      timestamp: Date.now()
    });
  }

  private getCachedSequence(publicKey: string): { sequence: bigint; timestamp: number } | undefined {
    const cached = this.accountSequenceCache.get(publicKey);
    if (!cached) return undefined;
    const now = Date.now();
    if (now - cached.timestamp > this.cacheTtlMs) {
      this.accountSequenceCache.delete(publicKey);
      return undefined;
    }
    return cached;
  }

  clearCache(publicKey?: string): void {
    if (publicKey) this.accountSequenceCache.delete(publicKey);
    else this.accountSequenceCache.clear();
  }

  handleSubmissionError(error: unknown, publicKey?: string): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const sequenceErrorPatterns = ['tx_bad_seq', 'bad sequence', 'sequence number', 'sequence mismatch'];
    const isSequenceError = sequenceErrorPatterns.some(pattern => errorMessage.toLowerCase().includes(pattern));

    if (isSequenceError) {
      this.logger.warn(`Sequence error detected, clearing cache for ${publicKey || 'all accounts'}`);
      this.clearCache(publicKey);
      return true;
    }
    return false;
  }

  cleanupExpiredCache(): number {
    let removed = 0;
    const now = Date.now();
    for (const [publicKey, cached] of this.accountSequenceCache.entries()) {
      if (now - cached.timestamp > this.cacheTtlMs) {
        this.accountSequenceCache.delete(publicKey);
        removed++;
      }
    }
    if (removed > 0) this.logger.debug(`Cleaned up ${removed} expired cache entries`);
    return removed;
  }

  async submitTransactionsSequentially(
    transactions: (Transaction | FeeBumpTransaction)[],
    options?: { onProgress?: (index: number, result: TransactionSendResult) => void; sourcePublicKey?: string; }
  ): Promise<TransactionSendResult[]> {
    const results: TransactionSendResult[] = [];
    for (let i = 0; i < transactions.length; i++) {
      try {
        const result = await this.sendTransaction(transactions[i]);
        results.push(result);
        if (options?.onProgress) options.onProgress(i, result);
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        const wasSequenceError = this.handleSubmissionError(error, options?.sourcePublicKey);
        throw new Error(`Transaction ${i + 1}/${transactions.length} failed${wasSequenceError ? ' (cache cleared due to sequence error)' : ''}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return results;
  }

  async validateFee(
    transaction: Transaction,
    options?: { minFee?: number; maxFee?: number; simulate?: boolean; }
  ): Promise<number> {
    const simulate = options?.simulate ?? true;
    const minFee = options?.minFee ?? 100_000;
    const maxFee = options?.maxFee ?? 1_000_000;
    const currentFee = parseInt(transaction.fee);

    if (currentFee < minFee) throw new Error(`Transaction fee ${currentFee} is below minimum ${minFee}`);
    if (currentFee > maxFee) throw new Error(`Transaction fee ${currentFee} exceeds maximum ${maxFee}`);

    if (simulate) {
      try {
        const simulation = await this.simulateTransaction(transaction);
        if (rpc.Api.isSimulationSuccess(simulation)) {
          const minResourceFee = simulation.minResourceFee ?? 100_000;
          const recommendedFee = parseInt(minResourceFee.toString());
          if (recommendedFee > currentFee * 1.2) {
            this.logger.info(`Recommended fee ${recommendedFee} is significantly higher than current ${currentFee}`);
            return recommendedFee;
          }
        }
      } catch (error) {
        this.logger.warn(`Fee simulation failed, using original fee: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return currentFee;
  }

  async simulateTransaction(tx: Transaction | FeeBumpTransaction): Promise<rpc.Api.SimulateTransactionResponse> {
    this.logger.debug("Simulating transaction");
    return this.executeWithErrorHandling(async () => {
      const response = await this.rpc.simulateTransaction(tx);
      validateRpcResponse(SimulateTransactionResponseSchema, response, 'simulateTransaction');
      return response;
    }, "Failed to simulate transaction");
  }

  async simulateBatch(params: {
    operations: xdr.Operation[];
    sourceAccount: Account;
    fee?: number;
    timeoutInSeconds?: number;
  }): Promise<rpc.Api.SimulateTransactionResponse['result']> {
    this.logger.debug(`Simulating batch of ${params.operations.length} operations`);
    return this.executeWithErrorHandling(async () => {
      if (!params.operations || params.operations.length === 0) throw new AxionveraError('At least one operation is required for batch simulation');
      const operationCount = params.operations.length;
      const feePerOperation = params.fee ?? 100_000;
      const totalFee = (feePerOperation * operationCount).toString();
      const timeoutInSeconds = params.timeoutInSeconds ?? 60;
      const builder = new TransactionBuilder(params.sourceAccount, { fee: totalFee, networkPassphrase: this.networkPassphrase });
      for (const operation of params.operations) builder.addOperation(operation);
      const tx = builder.setTimeout(timeoutInSeconds).build();

      // Simulate the combined transaction
      const result = await this.executeWithFailover(rpc => 
        retry(() => rpc.simulateTransaction(tx), this.retryConfig)
      );

      // Return only the results array
      if (!result.result) {
        throw new NetworkError('No results returned from batch simulation');
      }

      return result.result;
    }, `Failed to simulate batch of ${params.operations.length} operations`);
  }

  async simulateRead(contractId: string, method: string, args?: any[]): Promise<xdr.ScVal> {
    this.logger.debug(`Simulating read-only call to ${contractId}.${method}`);
    return this.executeWithErrorHandling(async () => {
      const dummyAccount = new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH", "0");
      const scVals = args ? args.map(arg => {
        if (typeof arg === 'string') {
          try { return Address.fromString(arg).toScVal(); }
          catch { return nativeToScVal(arg); }
        } else if (typeof arg === 'number' || typeof arg === 'bigint') return nativeToScVal(arg);
        else if (typeof arg === 'boolean') return nativeToScVal(arg);
        else if (arg === null || arg === undefined) return xdr.ScVal.scvVoid();
        else return nativeToScVal(arg);
      }) : [];

      const contract = new Contract(contractId);
      const operation = contract.call(method, ...scVals);
      const tx = new TransactionBuilder(dummyAccount, { fee: "100", networkPassphrase: this.networkPassphrase })
        .addOperation(operation)
        .setTimeout(30)
        .build();

      const simulationResult = await this.rpc.simulateTransaction(tx);
      if (simulationResult.error) throw new NetworkError(`Simulation failed: ${simulationResult.error}`);
      if (!simulationResult.result) throw new NetworkError('No result returned from simulation');

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
    if (tx instanceof FeeBumpTransaction) {
      return this.executeWithErrorHandling(
        () => this.rpc.prepareTransaction(tx),
        "Failed to prepare transaction"
      );
    }

    return this.executeWithErrorHandling(
      async () => {
        const simulation = await this.simulateTransaction(tx);
        const assembledTx = rpc.assembleTransaction(tx, simulation).build();
        return this.applyFeeBuffer(assembledTx);
      },
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
   * Automatically retries and fails over to backup URLs on failure.
   * @param hash - The transaction hash
   * @returns The transaction status response
   */
  async getTransaction(hash: string): Promise<ValidatedGetTransactionResponse> {
    this.logger.debug(`Fetching transaction status for ${hash}`);
    return this.executeWithErrorHandling(async () => {
      const response = await this.executeWithFailover(rpc => 
        retry(() => rpc.getTransaction(hash), this.retryConfig)
      );
      return validateRpcResponse(GetTransactionResponseSchema, response, 'getTransaction');
    }, `Failed to fetch transaction ${hash}`);
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
    const tracked = this.trackTransaction({
      hash,
      timeoutMs: params?.timeoutMs,
      intervalMs: params?.intervalMs,
      onProgress: params?.onProgress,
    });
    return tracked.promise;
  }

  /**
   * Registers a transaction in the pending-transaction registry and starts a
   * polling loop in the background. The returned object exposes the polling
   * promise and a cancel handle.
   *
   * If the same hash is already tracked, the existing entry is returned and
   * no new poll is started.
   */
  trackTransaction(
    options: TrackTransactionOptions & {
      onProgress?: (status: string, ledger: number) => void | Promise<void>;
    }
  ): TrackedTransaction {
    const existing = this.pendingTransactions.get(options.hash);
    if (existing) return existing;

    const intervalMs = options.intervalMs ?? 1_000;
    const submittedAt = new Date();
    const deadline =
      options.deadline ??
      new Date(submittedAt.getTime() + (options.timeoutMs ?? 30_000));
    const onProgress = options.onProgress;

    let cancelled: boolean = false;
    const cancel = (): void => {
      cancelled = true;
    };

    // Register the entry *before* starting the polling loop so that the
    // very first getTransaction() call already sees the tracked state.
    const tracked: TrackedTransaction = {
      hash: options.hash,
      simulationContext: options.simulationContext,
      submittedAt,
      intervalMs,
      deadline,
      label: options.label,
      promise: Promise.resolve(),
      cancel,
    };
    this.pendingTransactions.set(options.hash, tracked);

    tracked.promise = this.executeWithErrorHandling(async () => {
      try {
        while (!cancelled && Date.now() < deadline.getTime()) {
          const res = await this.getTransaction(options.hash);

          const status =
            (res as { status?: string } | null | undefined)?.status ?? "UNKNOWN";
          const ledger =
            (res as { ledger?: number } | null | undefined)?.ledger ?? 0;

          if (onProgress) {
            Promise.resolve()
              .then(() => onProgress(status, ledger))
              .catch((err) => {
                this.logger.warn("onProgress callback error", err);
              });
          }

          if (status && status !== "NOT_FOUND" && status !== "UNKNOWN") {
            return res;
          }

          await new Promise<void>((r) => setTimeout(r, intervalMs));
        }
        if (cancelled) {
          throw new AxionveraError(
            `Transaction tracking cancelled for ${options.hash}`
          );
        }
        throw new NetworkError(`Timed out waiting for transaction ${options.hash}`);
      } finally {
        this.pendingTransactions.delete(options.hash);
      }
    }, `Failed while polling transaction ${options.hash}`);

    tracked.promise.catch(() => undefined);

    return tracked;
  }

  /**
   * Returns the list of currently polling transactions (a snapshot).
   */
  getPendingTransactions(): PendingTransaction[] {
    return Array.from(this.pendingTransactions.values()).map((t) => ({
      hash: t.hash,
      simulationContext: t.simulationContext,
      submittedAt: t.submittedAt,
      intervalMs: t.intervalMs,
      deadline: t.deadline,
      label: t.label,
    }));
  }

  /**
   * Serializes the currently polling transactions to a JSON-safe object so
   * the dApp can persist it (e.g. to localStorage) and survive a page
   * refresh.
   *
   * Dates inside `simulationContext` are encoded with a `{ __date: ISO }`
   * marker so {@link importState} can revive them losslessly.
   */
  exportState(): ExportedState {
    const pending: SerializedPendingTransaction[] = [];
    for (const tx of this.pendingTransactions.values()) {
      pending.push({
        hash: tx.hash,
        simulationContext: freezeContext(tx.simulationContext),
        submittedAt: tx.submittedAt.toISOString(),
        intervalMs: tx.intervalMs,
        deadline: tx.deadline.toISOString(),
        label: tx.label,
      });
    }
    return {
      version: HYDRATION_STATE_VERSION,
      exportedAt: new Date().toISOString(),
      pending,
    };
  }

  /**
   * Re-initializes polling loops from a previously {@link exportState}'d
   * snapshot. Accepts the snapshot object or a JSON string.
   *
   * - Entries whose `deadline` has already passed are dropped.
   * - Entries whose hash is already being tracked are kept as-is (idempotent).
   * - Date markers inside `simulationContext` are revived back into Date
   *   instances.
   */
  importState(state: ExportedState | string): TrackedTransaction[] {
    const raw: unknown = typeof state === "string" ? JSON.parse(state) : state;
    if (!raw || typeof raw !== "object") {
      throw new AxionveraError("Invalid hydration state: expected object or JSON string");
    }
    const parsed = raw as { version?: unknown; pending?: unknown };
    if (parsed.version !== HYDRATION_STATE_VERSION) {
      throw new AxionveraError(
        `Unsupported hydration state version: ${String(parsed.version)} (expected ${String(HYDRATION_STATE_VERSION)})`
      );
    }
    if (!Array.isArray(parsed.pending)) {
      throw new AxionveraError("Invalid hydration state: `pending` must be an array");
    }

    const restored: TrackedTransaction[] = [];
    const now = Date.now();
    for (const candidate of parsed.pending as unknown[]) {
      if (!candidate || typeof candidate !== "object") continue;
      const entry = candidate as Partial<SerializedPendingTransaction>;
      if (typeof entry.hash !== "string" || entry.hash.length === 0) continue;

      const existing = this.pendingTransactions.get(entry.hash);
      if (existing) {
        restored.push(existing);
        continue;
      }
      const deadline =
        typeof entry.deadline === "string" ? new Date(entry.deadline) : new Date(NaN);
      if (Number.isNaN(deadline.getTime()) || deadline.getTime() <= now) continue;

      const intervalMs =
        typeof entry.intervalMs === "number" && entry.intervalMs > 0
          ? entry.intervalMs
          : 1_000;
      const tracked = this.trackTransaction({
        hash: entry.hash,
        simulationContext: thawContext(entry.simulationContext),
        intervalMs,
        deadline,
        label: entry.label,
      });
      restored.push(tracked);
    }
    return restored;
  }


  /**
   * Waits for a transaction to be confirmed or rejected with a Promise-based API.
   * 
   * This is a convenience wrapper around pollTransaction that provides a simpler,
   * more intuitive API for the common use case of waiting for a transaction to complete.
   * It resolves when the transaction reaches a final state (SUCCESS or FAILED),
   * or rejects if the transaction times out.
   * 
   * Similar to waitForTransactionReceipt in EVM libraries like viem, making it easier
   * for developers moving from Ethereum to Stellar/Soroban.
   * 
   * @param hash - The transaction hash to wait for
   * @param params - Wait parameters
   * @param params.timeoutMs - Maximum time to wait in milliseconds (default: 30_000)
   * @param params.intervalMs - Time between polls in milliseconds (default: 1_000)
   * @param params.onProgress - Optional callback to track polling progress
   * @returns Promise that resolves with the transaction result when confirmed, or rejects on timeout
   * @throws NetworkError if the transaction doesn't reach a final state within timeoutMs
   * 
   * @example
   * ```typescript
   * // Simple usage - wait for transaction with defaults (30 seconds)
   * const result = await client.waitForTransaction(txHash);
   * console.log('Transaction confirmed:', result);
   * 
   * // With custom timeout and polling interval
   * const result = await client.waitForTransaction(txHash, {
   *   timeoutMs: 60_000,     // Wait up to 60 seconds
   *   intervalMs: 500        // Poll every 500ms
   * });
   * 
   * // With progress tracking
   * const result = await client.waitForTransaction(txHash, {
   *   onProgress: (status, ledger) => {
   *     console.log(`Status: ${status}, Ledger: ${ledger}`);
   *   }
   * });
   * 
   * // In a typical usage flow
   * const signed = await client.sendTransaction(tx);
   * try {
   *   const confirmed = await client.waitForTransaction(signed.hash);
   *   console.log('Success:', confirmed);
   * } catch (error) {
   *   if (error instanceof NetworkError) {
   *     console.log('Transaction took too long to confirm');
   *   } else {
   *     console.log('Transaction failed or errored:', error);
   *   }
   * }
   * ```
   */
  async waitForTransaction(
    hash: string,
    params?: {
      timeoutMs?: number;
      intervalMs?: number;
      onProgress?: (status: string, ledger: number) => void | Promise<void>;
    }
  ): Promise<unknown> {
    return this.pollTransaction(hash, params);
  }

  /**
   * Retrieves the status of a transaction.
   * Alias for getTransaction() - provided for compatibility and clarity.
   * @param hash - The transaction hash
   * @returns The transaction status
   * @deprecated Use getTransaction() instead
   */
  async getTransactionStatus(hash: string): Promise<unknown> {
    this.logger.debug(`Fetching transaction status for ${hash}`);
    return this.executeWithErrorHandling(
      () => retry(() => this.rpc.getTransaction(hash), this.retryConfig),
      `Failed to fetch transaction ${hash}`
    );
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

  private async resolveEndLedger(providedEndLedger?: number): Promise<number> {
    if (providedEndLedger !== undefined) {
      return Math.max(1, providedEndLedger);
    }

    const latestLedger = await this.getLatestLedger();
    const sequence = Number((latestLedger as any).sequence);
    return Number.isFinite(sequence) && sequence > 0 ? sequence : 1;
  }

  private resolveStartLedger(options: GetContractEventsOptions, endLedger: number): number {
    if (options.startLedger !== undefined) {
      return Math.max(1, options.startLedger);
    }

    if (options.startTime === undefined) {
      return endLedger;
    }

    const nowMs = Date.now();
    const timestampMs = this.resolveStartTimeMs(options.startTime, nowMs);
    const elapsedMs = Math.max(0, nowMs - timestampMs);
    const ledgersToRewind = Math.ceil(elapsedMs / 5_000);
    return Math.max(1, endLedger - ledgersToRewind);
  }

  private resolveStartTimeMs(startTime: Date | string | number | "last24Hours", nowMs: number): number {
    if (startTime === 'last24Hours') {
      return nowMs - 24 * 60 * 60 * 1_000;
    }

    if (startTime instanceof Date) {
      return startTime.getTime();
    }

    if (typeof startTime === 'number') {
      return startTime;
    }

    const parsed = Date.parse(startTime);
    if (!Number.isFinite(parsed)) {
      throw new AxionveraError(`Invalid startTime value: ${startTime}`);
    }

    return parsed;
  }

  private async fetchContractEventsRange(params: {
    contractId: string;
    topicFilters?: string[][];
    startLedger: number;
    endLedger: number;
    limit?: number;
    cursor?: string;
    fetchAll: boolean;
  }): Promise<GetContractEventsResult> {
    let cursor = params.cursor;
    const events: ContractEventResult[] = [];
    let pagingToken: string | undefined;
    const seenPagingTokens = new Set<string>();

    while (true) {
      try {
        const response = await retry(() => this.rpc.getEvents(this.buildGetEventsRequest(params, cursor)), this.retryConfig);
        const pageEvents = Array.isArray((response as any).events)
          ? ((response as any).events as rpc.Api.EventResponse[])
          : [];

        events.push(...pageEvents.map((event) => this.decodeContractEvent(event)));

        pagingToken = this.extractPagingToken(response, pageEvents);
        if (!params.fetchAll || !pagingToken) {
          const result: GetContractEventsResult = { events };
          if (pagingToken !== undefined) result.pagingToken = pagingToken;
          return result;
        }

        if (seenPagingTokens.has(pagingToken)) {
          const result: GetContractEventsResult = { events };
          if (pagingToken !== undefined) result.pagingToken = pagingToken;
          return result;
        }

        seenPagingTokens.add(pagingToken);
        cursor = pagingToken;
      } catch (error) {
        if (this.isPayloadTooLarge(error) && params.startLedger < params.endLedger) {
          const midpoint = Math.floor((params.startLedger + params.endLedger) / 2);
          const firstHalfParams: Parameters<typeof this.fetchContractEventsRange>[0] = {
            contractId: params.contractId,
            startLedger: params.startLedger,
            endLedger: midpoint,
            fetchAll: params.fetchAll,
          };
          if (params.topicFilters !== undefined) firstHalfParams.topicFilters = params.topicFilters;
          if (params.limit !== undefined) firstHalfParams.limit = params.limit;
          if (cursor !== undefined) firstHalfParams.cursor = cursor;
          const firstHalf = await this.fetchContractEventsRange(firstHalfParams);

          if (!params.fetchAll) {
            return firstHalf;
          }

          const secondHalfParams: Parameters<typeof this.fetchContractEventsRange>[0] = {
            contractId: params.contractId,
            startLedger: midpoint + 1,
            endLedger: params.endLedger,
            fetchAll: params.fetchAll,
          };
          if (params.topicFilters !== undefined) secondHalfParams.topicFilters = params.topicFilters;
          if (params.limit !== undefined) secondHalfParams.limit = params.limit;
          const secondHalf = await this.fetchContractEventsRange(secondHalfParams);

          const mergedToken = secondHalf.pagingToken ?? firstHalf.pagingToken;
          const merged: GetContractEventsResult = {
            events: [...firstHalf.events, ...secondHalf.events]
          };
          if (mergedToken !== undefined) merged.pagingToken = mergedToken;
          return merged;
        }

        throw error;
      }
    }
  }

  private buildGetEventsRequest(
    params: {
      contractId: string;
      topicFilters?: string[][];
      startLedger: number;
      endLedger: number;
      limit?: number;
    },
    cursor?: string
  ): any {
    const filter: any = {
      type: 'contract',
      contractIds: [params.contractId]
    };

    if (params.topicFilters && params.topicFilters.length > 0) {
      filter.topics = params.topicFilters;
    }

    const request: any = {
      startLedger: params.startLedger,
      endLedger: params.endLedger,
      filters: [filter]
    };

    if (params.limit !== undefined || cursor !== undefined) {
      request.pagination = {};
      if (params.limit !== undefined) {
        request.pagination.limit = params.limit;
      }
      if (cursor !== undefined) {
        request.pagination.cursor = cursor;
      }
    }

    return request;
  }

  private decodeContractEvent(event: rpc.Api.EventResponse): ContractEventResult {
    const decodedTopic = Array.isArray((event as any).topic)
      ? ((event as any).topic as string[]).map((entry) => this.decodeScVal(entry))
      : [];
    const decodedValue = typeof (event as any).value === 'string'
      ? this.decodeScVal((event as any).value)
      : (event as any).value;

    return {
      ...(event as any),
      topic: decodedTopic,
      value: decodedValue
    };
  }

  private decodeScVal(encodedScVal: string): unknown {
    try {
      return scValToNative(xdr.ScVal.fromXDR(encodedScVal, 'base64'));
    } catch {
      return encodedScVal;
    }
  }

  private extractPagingToken(response: unknown, events: rpc.Api.EventResponse[]): string | undefined {
    const responseToken = (response as any).pagingToken;
    if (typeof responseToken === 'string' && responseToken.length > 0) {
      return responseToken;
    }

    const lastEvent = events[events.length - 1] as any;
    const eventToken = lastEvent?.pagingToken;
    if (typeof eventToken === 'string' && eventToken.length > 0) {
      return eventToken;
    }

    return undefined;
  }

  private isPayloadTooLarge(error: unknown): boolean {
    const statusCode = (error as any)?.response?.status ?? (error as any)?.status;
    const message = typeof (error as any)?.message === 'string' ? (error as any).message : '';
    return statusCode === 413 || /payload too large|request entity too large|413/i.test(message);
  }
}
