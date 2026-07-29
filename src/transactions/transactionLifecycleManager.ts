import {
  LifecycleEvent,
  LifecycleEventEmitter,
  LifecycleEventListener,
  LifecycleEventFilter,
} from '../events';
import { TransactionNotTrackedError, LifecycleStateMachine } from '../lifecycle';
import { TERMINAL_STATES, TransactionLifecycleState } from '../lifecycle';
import {
  CreateTransactionOptions,
  TransactionLifecycleRecord,
  TransactionStatusQuery,
} from './types';

/** Generates a simple unique id without external dependencies. */
function uid(): string {
  return `tx-${Date.now().toString()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toErrorInfo(error: unknown): { name: string; message: string } {
  return {
    name: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message : String(error),
  };
}

/**
 * Tracks transactions through their full lifecycle — creation, simulation,
 * signing, submission, confirmation, and completion — validating transitions,
 * recording history, and emitting lifecycle events.
 *
 * @example
 * ```typescript
 * const manager = new TransactionLifecycleManager();
 * const { id } = manager.create({ metadata: { contractId: 'C123' } });
 * manager.markSimulating(id);
 * manager.markSimulated(id, { simulationResult: { cost: 100n } });
 * manager.markSigning(id);
 * manager.markSigned(id);
 * manager.markSubmitting(id);
 * manager.markSubmitted(id, { txHash: 'abc123' });
 * manager.markConfirming(id);
 * manager.markConfirmed(id, { ledger: 12345 });
 * manager.markCompleted(id);
 * manager.getStatus(id); // TransactionLifecycleState.COMPLETED
 * ```
 */
export class TransactionLifecycleManager {
  private readonly records = new Map<string, TransactionLifecycleRecord>();
  private readonly stateMachine: LifecycleStateMachine;
  private readonly emitter: LifecycleEventEmitter;

  constructor(
    stateMachine: LifecycleStateMachine = new LifecycleStateMachine(),
    emitter: LifecycleEventEmitter = new LifecycleEventEmitter()
  ) {
    this.stateMachine = stateMachine;
    this.emitter = emitter;
  }

  /** Begins tracking a new transaction in the `CREATED` state. */
  create(options: CreateTransactionOptions = {}): TransactionLifecycleRecord {
    const id = options.id ?? uid();
    if (this.records.has(id)) {
      throw new Error(`A transaction with id "${id}" is already being tracked`);
    }

    const now = Date.now();
    const record: TransactionLifecycleRecord = {
      id,
      state: TransactionLifecycleState.CREATED,
      createdAt: now,
      updatedAt: now,
      metadata: { ...options.metadata },
      history: [{ from: null, to: TransactionLifecycleState.CREATED, timestamp: now }],
    };
    this.records.set(id, record);

    this.emitter.emit({
      type: 'created',
      transactionId: id,
      previousState: null,
      state: record.state,
      timestamp: now,
    });

    return this.cloneRecord(record);
  }

  /**
   * Moves a tracked transaction to a new lifecycle state, validating that the
   * transition is allowed and recording it in the transaction's history.
   */
  transition(
    id: string,
    to: TransactionLifecycleState,
    details?: Record<string, unknown>
  ): TransactionLifecycleRecord {
    const record = this.requireRecord(id);
    this.stateMachine.assertTransition(record.state, to);

    const from = record.state;
    const now = Date.now();

    record.state = to;
    record.updatedAt = now;
    record.history.push({ from, to, timestamp: now, details });
    if (details) {
      record.metadata = { ...record.metadata, ...details };
    }
    if (to === TransactionLifecycleState.FAILED && details?.error !== undefined) {
      record.error = toErrorInfo(details.error);
    }

    const event: LifecycleEvent = {
      type:
        to === TransactionLifecycleState.FAILED
          ? 'failed'
          : to === TransactionLifecycleState.COMPLETED
            ? 'completed'
            : 'transition',
      transactionId: id,
      previousState: from,
      state: to,
      timestamp: now,
      details,
      error: record.error,
    };
    this.emitter.emit(event);

    return this.cloneRecord(record);
  }

  markSimulating(id: string, details?: Record<string, unknown>): TransactionLifecycleRecord {
    return this.transition(id, TransactionLifecycleState.SIMULATING, details);
  }

  markSimulated(id: string, details?: Record<string, unknown>): TransactionLifecycleRecord {
    return this.transition(id, TransactionLifecycleState.SIMULATED, details);
  }

  markSigning(id: string, details?: Record<string, unknown>): TransactionLifecycleRecord {
    return this.transition(id, TransactionLifecycleState.SIGNING, details);
  }

  markSigned(id: string, details?: Record<string, unknown>): TransactionLifecycleRecord {
    return this.transition(id, TransactionLifecycleState.SIGNED, details);
  }

  markSubmitting(id: string, details?: Record<string, unknown>): TransactionLifecycleRecord {
    return this.transition(id, TransactionLifecycleState.SUBMITTING, details);
  }

  markSubmitted(id: string, details?: Record<string, unknown>): TransactionLifecycleRecord {
    return this.transition(id, TransactionLifecycleState.SUBMITTED, details);
  }

  markConfirming(id: string, details?: Record<string, unknown>): TransactionLifecycleRecord {
    return this.transition(id, TransactionLifecycleState.CONFIRMING, details);
  }

  markConfirmed(id: string, details?: Record<string, unknown>): TransactionLifecycleRecord {
    return this.transition(id, TransactionLifecycleState.CONFIRMED, details);
  }

  markCompleted(id: string, details?: Record<string, unknown>): TransactionLifecycleRecord {
    return this.transition(id, TransactionLifecycleState.COMPLETED, details);
  }

  /** Marks a transaction as failed from whatever state it is currently in. */
  fail(id: string, error: unknown, details?: Record<string, unknown>): TransactionLifecycleRecord {
    return this.transition(id, TransactionLifecycleState.FAILED, { ...details, error });
  }

  /** Returns the current lifecycle state of a tracked transaction. */
  getStatus(id: string): TransactionLifecycleState {
    return this.requireRecord(id).state;
  }

  /** Returns a snapshot of the full tracked record for a transaction. */
  getRecord(id: string): TransactionLifecycleRecord {
    return this.cloneRecord(this.requireRecord(id));
  }

  /** Returns the ordered history of transitions for a transaction. */
  getHistory(id: string): TransactionLifecycleRecord['history'] {
    return [...this.requireRecord(id).history];
  }

  /** Returns whether a transaction has reached a terminal state (`COMPLETED` or `FAILED`). */
  isTerminal(id: string): boolean {
    return TERMINAL_STATES.has(this.requireRecord(id).state);
  }

  /** Returns whether a transaction id is currently tracked. */
  has(id: string): boolean {
    return this.records.has(id);
  }

  /** Lists tracked transactions, optionally filtered by state or terminality. */
  list(query: TransactionStatusQuery = {}): TransactionLifecycleRecord[] {
    const results: TransactionLifecycleRecord[] = [];
    for (const record of this.records.values()) {
      if (query.state && record.state !== query.state) continue;
      if (query.terminalOnly && !TERMINAL_STATES.has(record.state)) continue;
      results.push(this.cloneRecord(record));
    }
    return results;
  }

  /** Stops tracking a transaction. Returns false if it wasn't tracked. */
  remove(id: string): boolean {
    return this.records.delete(id);
  }

  /** Stops tracking all transactions. */
  clear(): void {
    this.records.clear();
  }

  /** Subscribes to lifecycle events, optionally filtered by transaction id or event type. */
  onEvent(listener: LifecycleEventListener, filter?: LifecycleEventFilter): string {
    return this.emitter.subscribe(listener, filter);
  }

  /** Unsubscribes a previously registered lifecycle event listener. */
  offEvent(subscriptionId: string): boolean {
    return this.emitter.unsubscribe(subscriptionId);
  }

  private requireRecord(id: string): TransactionLifecycleRecord {
    const record = this.records.get(id);
    if (!record) {
      throw new TransactionNotTrackedError(id);
    }
    return record;
  }

  private cloneRecord(record: TransactionLifecycleRecord): TransactionLifecycleRecord {
    return {
      ...record,
      metadata: { ...record.metadata },
      history: record.history.map((entry) => ({ ...entry })),
    };
  }
}
