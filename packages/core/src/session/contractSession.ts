import { ValidationError } from "../errors/axionveraError";
import type { StellarClient } from "../client/stellarClient";
import type { WalletConnector } from "../wallet/walletConnector";
import type {
  ContractContext,
  RegisterContractParams,
  SessionConfig,
  SessionSnapshot,
  SessionStatus,
} from "./types";

/** Monotonic counter used to generate unique session ids within a process. */
let sessionCounter = 0;

/**
 * A session coordinating interactions across multiple active contracts.
 *
 * A `ContractSession` groups several contracts that participate in a single
 * workflow and lets them share resources — one RPC client ({@link StellarClient})
 * and one optional {@link WalletConnector} — instead of each contract holding its
 * own. It also tracks lifecycle state so callers can suspend, resume, and close
 * a workflow safely.
 *
 * Sessions are usually created through a {@link SessionManager}, but can be
 * instantiated directly.
 *
 * @example
 * ```typescript
 * const session = new ContractSession({ client, wallet });
 * session.registerContract({ name: "vault", contractId: vaultId });
 * session.registerContract({ name: "rewards", contractId: rewardsId });
 *
 * await session.run(async (s) => {
 *   const vault = s.getContract("vault");
 *   // ...coordinate calls across contracts...
 * });
 *
 * session.close();
 * ```
 */
export class ContractSession {
  /** Unique session identifier. */
  readonly id: string;
  /** Shared RPC client used by every contract in this session. */
  readonly client: StellarClient;
  /** Shared wallet connector for signing, if provided. */
  readonly wallet?: WalletConnector;
  /** Epoch milliseconds at which the session was created. */
  readonly createdAt: number;
  /** Caller-supplied session metadata. */
  readonly metadata: Record<string, unknown>;

  private _status: SessionStatus = "active";
  private _updatedAt: number;
  private readonly _contracts = new Map<string, ContractContext>();

  /**
   * Creates a new session.
   * @param config - Session configuration. A `client` is required.
   * @throws {ValidationError} If no client is supplied or a contract is invalid.
   */
  constructor(config: SessionConfig) {
    if (!config || !config.client) {
      throw new ValidationError("A StellarClient is required to create a session");
    }

    this.id = (config.id ?? "").trim() || ContractSession.generateId();
    this.client = config.client;
    if (config.wallet !== undefined) {
      this.wallet = config.wallet;
    }
    this.createdAt = Date.now();
    this._updatedAt = this.createdAt;
    this.metadata = { ...(config.metadata ?? {}) };

    for (const contract of config.contracts ?? []) {
      this.registerContract(contract);
    }
  }

  /** Generates a process-unique session id. */
  static generateId(): string {
    sessionCounter += 1;
    return `session-${sessionCounter}`;
  }

  /** The current lifecycle status. */
  get status(): SessionStatus {
    return this._status;
  }

  /** Epoch milliseconds of the most recent mutation. */
  get updatedAt(): number {
    return this._updatedAt;
  }

  /** The network the shared client is connected to. */
  get network(): string {
    return this.client.network;
  }

  /** Whether the session is currently active (not suspended or closed). */
  get isActive(): boolean {
    return this._status === "active";
  }

  /** Whether the session has been closed. */
  get isClosed(): boolean {
    return this._status === "closed";
  }

  /** Number of contracts registered in this session. */
  get size(): number {
    return this._contracts.size;
  }

  /**
   * Registers a contract in the session.
   * @param params - The contract to register.
   * @returns The created {@link ContractContext}.
   * @throws {ValidationError} If the session is closed, the name/id is empty,
   *   or a contract with the same name is already registered.
   */
  registerContract<TInstance = unknown>(
    params: RegisterContractParams<TInstance>
  ): ContractContext<TInstance> {
    this.assertNotClosed();

    const name = params?.name?.trim();
    if (!name) {
      throw new ValidationError("A non-empty contract name is required");
    }

    const contractId = params?.contractId?.trim();
    if (!contractId) {
      throw new ValidationError(`A non-empty contract id is required for "${name}"`);
    }

    if (this._contracts.has(name)) {
      throw new ValidationError(
        `A contract named "${name}" is already registered in session "${this.id}"`
      );
    }

    const context: ContractContext<TInstance> = {
      name,
      contractId,
      registeredAt: Date.now(),
      metadata: { ...(params.metadata ?? {}) },
      ...(params.instance !== undefined ? { instance: params.instance } : {}),
    };

    this._contracts.set(name, context as ContractContext);
    this.touch();
    return context;
  }

  /**
   * Removes a contract from the session.
   * @param name - The contract name.
   * @returns `true` if a contract was removed, `false` if it was not registered.
   * @throws {ValidationError} If the session is closed.
   */
  unregisterContract(name: string): boolean {
    this.assertNotClosed();
    const removed = this._contracts.delete(name);
    if (removed) {
      this.touch();
    }
    return removed;
  }

  /**
   * Checks whether a contract is registered.
   * @param name - The contract name.
   */
  hasContract(name: string): boolean {
    return this._contracts.has(name);
  }

  /**
   * Retrieves a registered contract context.
   * @param name - The contract name.
   * @throws {ValidationError} If no contract with that name is registered.
   */
  getContract<TInstance = unknown>(name: string): ContractContext<TInstance> {
    const context = this._contracts.get(name);
    if (!context) {
      throw new ValidationError(
        `No contract named "${name}" is registered in session "${this.id}"`
      );
    }
    return context as ContractContext<TInstance>;
  }

  /**
   * Retrieves the live wrapper instance attached to a registered contract.
   * @param name - The contract name.
   * @throws {ValidationError} If the contract is missing or has no instance.
   */
  getContractInstance<TInstance>(name: string): TInstance {
    const context = this.getContract<TInstance>(name);
    if (context.instance === undefined) {
      throw new ValidationError(
        `Contract "${name}" in session "${this.id}" has no instance attached`
      );
    }
    return context.instance;
  }

  /** Returns all registered contract contexts. */
  listContracts(): ContractContext[] {
    return [...this._contracts.values()];
  }

  /**
   * Suspends the session. A suspended session rejects {@link run} calls until
   * {@link resume} is invoked. No-op if already suspended.
   * @throws {ValidationError} If the session is closed.
   */
  suspend(): void {
    this.assertNotClosed();
    if (this._status === "active") {
      this._status = "suspended";
      this.touch();
    }
  }

  /**
   * Resumes a suspended session. No-op if already active.
   * @throws {ValidationError} If the session is closed.
   */
  resume(): void {
    this.assertNotClosed();
    if (this._status === "suspended") {
      this._status = "active";
      this.touch();
    }
  }

  /**
   * Closes the session and releases its contract registry. Idempotent.
   *
   * The shared `client` and `wallet` are intentionally **not** torn down here —
   * they may be shared with other sessions and are owned by the caller (or the
   * {@link SessionManager}).
   */
  close(): void {
    if (this._status === "closed") {
      return;
    }
    this._status = "closed";
    this._contracts.clear();
    this.touch();
  }

  /**
   * Runs a unit of work against the session, guaranteeing it is active first.
   * @param fn - Callback receiving this session.
   * @returns The callback's result.
   * @throws {ValidationError} If the session is suspended or closed.
   */
  async run<T>(fn: (session: this) => Promise<T> | T): Promise<T> {
    this.assertActive();
    return fn(this);
  }

  /**
   * Validates that the session is in a usable state and has its resources.
   * @throws {ValidationError} If the session is closed or missing its client.
   */
  validate(): void {
    if (this._status === "closed") {
      throw new ValidationError(`Session "${this.id}" is closed`);
    }
    if (!this.client) {
      throw new ValidationError(`Session "${this.id}" is missing its StellarClient`);
    }
  }

  /** Produces a serializable snapshot of the session state. */
  toJSON(): SessionSnapshot {
    return {
      id: this.id,
      status: this._status,
      network: this.network,
      hasWallet: this.wallet !== undefined,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
      contracts: this.listContracts().map((c) => ({
        name: c.name,
        contractId: c.contractId,
        registeredAt: c.registeredAt,
        metadata: c.metadata,
      })),
      metadata: this.metadata,
    };
  }

  private assertActive(): void {
    if (this._status === "closed") {
      throw new ValidationError(`Session "${this.id}" is closed and cannot be used`);
    }
    if (this._status === "suspended") {
      throw new ValidationError(`Session "${this.id}" is suspended; call resume() first`);
    }
  }

  private assertNotClosed(): void {
    if (this._status === "closed") {
      throw new ValidationError(`Session "${this.id}" is closed and cannot be modified`);
    }
  }

  private touch(): void {
    this._updatedAt = Date.now();
  }
}
