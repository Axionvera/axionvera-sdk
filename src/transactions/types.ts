import { LifecycleTransitionRecord, TransactionLifecycleState } from '../lifecycle';

/** The full tracked state of a single transaction as it moves through its lifecycle. */
export interface TransactionLifecycleRecord {
  id: string;
  state: TransactionLifecycleState;
  createdAt: number;
  updatedAt: number;
  history: LifecycleTransitionRecord[];
  metadata: Record<string, unknown>;
  error?: { name: string; message: string };
}

/** Options accepted when starting to track a new transaction. */
export interface CreateTransactionOptions {
  /** Caller-supplied id (e.g. a transaction hash). A random id is generated if omitted. */
  id?: string;
  metadata?: Record<string, unknown>;
}

/** Filter accepted by {@link TransactionLifecycleManager.list}. */
export interface TransactionStatusQuery {
  state?: TransactionLifecycleState;
  terminalOnly?: boolean;
}
