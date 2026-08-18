import { ValidationError } from "../errors/axionveraError";
import type { StellarClient } from "../client/stellarClient";
import type { WalletConnector } from "../wallet/walletConnector";
import { ContractSession } from "./contractSession";
import type { SessionConfig, SessionManagerConfig } from "./types";

/**
 * Coordinates multiple {@link ContractSession} instances.
 *
 * The manager is the entry point for multi-contract workflows. It owns a
 * registry of live sessions, optionally provides shared default resources
 * (an RPC {@link StellarClient} and a {@link WalletConnector}) so many sessions
 * can reuse a single connection, and exposes lifecycle operations to create,
 * look up, and tear down sessions safely.
 *
 * @example
 * ```typescript
 * const manager = new SessionManager({ client, wallet });
 *
 * const session = manager.createSession({
 *   contracts: [
 *     { name: "vault", contractId: vaultId },
 *     { name: "rewards", contractId: rewardsId },
 *   ],
 * });
 *
 * // ...use the session...
 *
 * manager.closeSession(session.id);
 * ```
 */
export class SessionManager {
  private readonly _sessions = new Map<string, ContractSession>();
  private readonly _defaultClient: StellarClient | undefined;
  private readonly _defaultWallet: WalletConnector | undefined;
  private readonly _maxSessions: number;

  /**
   * Creates a new session manager.
   * @param config - Optional default resources and limits.
   * @throws {ValidationError} If `maxSessions` is not a positive number.
   */
  constructor(config: SessionManagerConfig = {}) {
    this._defaultClient = config.client;
    this._defaultWallet = config.wallet;
    this._maxSessions = config.maxSessions ?? Number.POSITIVE_INFINITY;

    if (this._maxSessions <= 0) {
      throw new ValidationError("maxSessions must be a positive number");
    }
  }

  /** Number of currently open sessions. */
  get size(): number {
    return this._sessions.size;
  }

  /**
   * Creates and registers a new session.
   *
   * The session inherits the manager's default `client`/`wallet` unless the
   * call supplies its own. This is how multiple sessions safely share a single
   * RPC connection.
   *
   * @param config - Per-session overrides. `client` is optional only when the
   *   manager was constructed with a default client.
   * @returns The newly created session.
   * @throws {ValidationError} If the session limit is reached, no client is
   *   available, or the requested id is already in use.
   */
  createSession(config: Partial<SessionConfig> = {}): ContractSession {
    if (this._sessions.size >= this._maxSessions) {
      throw new ValidationError(
        `Cannot create session: maximum of ${this._maxSessions} open sessions reached`
      );
    }

    const client = config.client ?? this._defaultClient;
    if (!client) {
      throw new ValidationError(
        "No StellarClient provided and no default client configured on the SessionManager"
      );
    }

    if (config.id && this._sessions.has(config.id)) {
      throw new ValidationError(`A session with id "${config.id}" already exists`);
    }

    const wallet = config.wallet ?? this._defaultWallet;

    const session = new ContractSession({
      ...config,
      client,
      ...(wallet !== undefined ? { wallet } : {}),
    });

    // Guard against a generated id colliding with an existing session.
    if (this._sessions.has(session.id)) {
      throw new ValidationError(`A session with id "${session.id}" already exists`);
    }

    this._sessions.set(session.id, session);
    return session;
  }

  /**
   * Checks whether a session exists.
   * @param id - The session id.
   */
  hasSession(id: string): boolean {
    return this._sessions.has(id);
  }

  /**
   * Retrieves a session by id.
   * @param id - The session id.
   * @throws {ValidationError} If no session with that id exists.
   */
  getSession(id: string): ContractSession {
    const session = this._sessions.get(id);
    if (!session) {
      throw new ValidationError(`No session found with id "${id}"`);
    }
    return session;
  }

  /**
   * Retrieves a session by id without throwing.
   * @param id - The session id.
   * @returns The session, or `undefined` if not found.
   */
  tryGetSession(id: string): ContractSession | undefined {
    return this._sessions.get(id);
  }

  /** Returns all open sessions. */
  listSessions(): ContractSession[] {
    return [...this._sessions.values()];
  }

  /**
   * Finds every session that has a contract registered with the given id.
   * Useful for coordinating shared on-chain resources across workflows.
   * @param contractId - The on-chain contract identifier.
   */
  findByContract(contractId: string): ContractSession[] {
    return this.listSessions().filter((session) =>
      session.listContracts().some((c) => c.contractId === contractId)
    );
  }

  /**
   * Closes a session and removes it from the manager.
   * @param id - The session id.
   * @returns `true` if a session was closed, `false` if it did not exist.
   */
  closeSession(id: string): boolean {
    const session = this._sessions.get(id);
    if (!session) {
      return false;
    }
    session.close();
    this._sessions.delete(id);
    return true;
  }

  /** Closes and removes every session. */
  closeAll(): void {
    for (const session of this._sessions.values()) {
      session.close();
    }
    this._sessions.clear();
  }
}
