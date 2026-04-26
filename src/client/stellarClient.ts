import {
  Account,
  FeeBumpTransaction,
  Keypair,
  Networks,
  rpc,
  Transaction,
  TransactionBuilder
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

/** Snapshot version for forward-compatibility of (de)serialized state. */
export const HYDRATION_STATE_VERSION = 1 as const;

/** A JSON-serializable value, with Date allowed inside simulation context. */
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
  /** Resolves with the final transaction result; rejects on error/timeout. */
  promise: Promise<unknown>;
  /** Cancels the polling loop without rejecting outstanding awaiters. */
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
  /** Absolute deadline; takes precedence over timeoutMs when restoring. */
  deadline?: Date;
  label?: string;
}

const DATE_MARKER = "__date" as const;

/** Walk a value, replacing Date instances with `{ __date: ISO }` markers. */
function freezeDates(value: SerializableValue): SerializableValue {
  if (value instanceof Date) {
    return { [DATE_MARKER]: value.toISOString() };
  }
  if (Array.isArray(value)) {
    return value.map((item) => freezeDates(item));
  }
  if (value !== null && typeof value === "object") {
    const out: { [key: string]: SerializableValue } = {};
    for (const key of Object.keys(value)) {
      out[key] = freezeDates((value as { [key: string]: SerializableValue })[key] as SerializableValue);
    }
    return out;
  }
  return value;
}

/** Walk a value, restoring `{ __date: ISO }` markers into Date instances. */
function thawDates(value: SerializableValue): SerializableValue {
  if (Array.isArray(value)) {
    return value.map((item) => thawDates(item));
  }
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    const obj = value as { [key: string]: SerializableValue };
    const marker = obj[DATE_MARKER];
    if (typeof marker === "string" && Object.keys(obj).length === 1) {
      const parsed = new Date(marker);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
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
  /** In-memory registry of currently polling transactions. */
  private readonly pendingTransactions = new Map<string, TrackedTransaction>();

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
   *
   * The transaction is also registered in the in-memory pending-transaction
   * registry so that {@link exportState} can capture it for later
   * {@link importState} hydration (e.g. after a page refresh).
   *
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
    const tracked = this.trackTransaction({
      hash,
      timeoutMs: params?.timeoutMs,
      intervalMs: params?.intervalMs,
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
   *
   * @param options - Tracking options including hash, optional simulation
   * context, polling cadence, and timeout/deadline.
   */
  trackTransaction(options: TrackTransactionOptions): TrackedTransaction {
    const existing = this.pendingTransactions.get(options.hash);
    if (existing) return existing;

    const intervalMs = options.intervalMs ?? 1_000;
    const submittedAt = new Date();
    const deadline =
      options.deadline ??
      new Date(submittedAt.getTime() + (options.timeoutMs ?? 30_000));

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

    tracked.promise = (async (): Promise<unknown> => {
      try {
        while (!cancelled && Date.now() < deadline.getTime()) {
          const res = await this.getTransaction(options.hash);
          const status = (res as { status?: string } | null | undefined)?.status;
          if (status && status !== "NOT_FOUND") {
            return res;
          }
          await new Promise<void>((r) => setTimeout(r, intervalMs));
        }
        if (cancelled) {
          throw new AxionveraError(
            `Transaction tracking cancelled for ${options.hash}`
          );
        }
        throw new TimeoutError(
          `Timed out waiting for transaction ${options.hash} after ${String(
            deadline.getTime() - submittedAt.getTime()
          )}ms`
        );
      } finally {
        this.pendingTransactions.delete(options.hash);
      }
    })();

    // Avoid unhandled-rejection warnings if the caller ignores the promise.
    tracked.promise.catch(() => undefined);

    return tracked;
  }

  /**
   * Returns the list of currently polling transactions (a live view).
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
   *
   * @returns The list of restored {@link TrackedTransaction}s.
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
