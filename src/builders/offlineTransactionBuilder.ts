import {
  Account,
  FeeBumpTransaction,
  Memo,
  StrKey,
  Transaction,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import { ContractCallArg, buildContractCallOperation } from '../utils';
import { assertValidXDR } from '../utils';
import { InvalidXDRError, ValidationError } from '../errors';
import {
  OFFLINE_TRANSACTION_PACKAGE_VERSION,
  OfflineSourceAccount,
  OfflineTransactionBuilderOptions,
  OfflineTransactionPackage,
  OfflineTransactionValidationResult,
} from '../types';

const DEFAULT_FEE = 100_000;
const DEFAULT_TIMEOUT_SECONDS = 60;

/** Maximum number of operations Stellar allows in a single transaction. */
export const MAX_OPERATIONS_PER_TRANSACTION = 100;

/**
 * Builds, validates, and (de)serializes unsigned Stellar/Soroban transactions
 * entirely from locally-known data — no RPC calls are made anywhere in this
 * class. This makes it suitable for air-gapped machines, hardware wallet
 * pairing flows, and any workflow where transaction *preparation* must happen
 * separately from submission.
 *
 * The caller is responsible for sourcing the account's current sequence
 * number ahead of time (e.g. from a prior online session, or from a
 * co-located online machine), since fetching it live would require network
 * access.
 *
 * The {@link Transaction} produced by {@link build} is a standard
 * `@stellar/stellar-sdk` transaction, so it remains fully compatible with
 * existing signing workflows (`WalletConnector.signTransaction`,
 * `LocalKeypairWalletConnector`, `TransactionBuilder.fromXDR(...).sign(...)`, etc.).
 *
 * @example
 * ```typescript
 * const builder = new OfflineTransactionBuilder({
 *   sourceAccount: { accountId: 'GABC...', sequence: '123456789' },
 *   networkPassphrase: Networks.TESTNET,
 * });
 *
 * builder.addContractCall({ contractId: 'CABC...', method: 'deposit', args: [1000n] });
 *
 * const transaction = builder.build();
 * const offlinePackage = builder.export(transaction);
 *
 * // Carry `offlinePackage` to a signing device, then later:
 * const restored = OfflineTransactionBuilder.import(offlinePackage);
 * const signed = restored; // restored.sign(keypair) on the signing device
 * ```
 */
export class OfflineTransactionBuilder {
  private readonly sourceAccount: OfflineSourceAccount;
  private readonly networkPassphrase: string;
  private readonly fee: number;
  private readonly timeoutInSeconds: number;
  private readonly memo?: string;
  private readonly operations: xdr.Operation[] = [];

  constructor(options: OfflineTransactionBuilderOptions) {
    const accountId = options.sourceAccount.accountId;
    const sequence = options.sourceAccount.sequence;

    if (!accountId || !StrKey.isValidEd25519PublicKey(accountId)) {
      throw new ValidationError(
        'OfflineTransactionBuilder: sourceAccount.accountId must be a valid G-prefixed Stellar account ID'
      );
    }
    if (!sequence || !/^\d+$/.test(sequence)) {
      throw new ValidationError(
        'OfflineTransactionBuilder: sourceAccount.sequence must be a non-negative integer string'
      );
    }
    if (!options.networkPassphrase) {
      throw new ValidationError('OfflineTransactionBuilder: networkPassphrase is required');
    }
    if (options.fee !== undefined && (!Number.isInteger(options.fee) || options.fee <= 0)) {
      throw new ValidationError('OfflineTransactionBuilder: fee must be a positive integer');
    }
    if (
      options.timeoutInSeconds !== undefined &&
      (!Number.isInteger(options.timeoutInSeconds) || options.timeoutInSeconds < 0)
    ) {
      throw new ValidationError(
        'OfflineTransactionBuilder: timeoutInSeconds must be a non-negative integer'
      );
    }

    this.sourceAccount = { accountId, sequence };
    this.networkPassphrase = options.networkPassphrase;
    this.fee = options.fee ?? DEFAULT_FEE;
    this.timeoutInSeconds = options.timeoutInSeconds ?? DEFAULT_TIMEOUT_SECONDS;
    this.memo = options.memo;
  }

  /** Appends a raw, already-constructed operation. */
  addOperation(operation: xdr.Operation): this {
    this.operations.push(operation);
    return this;
  }

  /** Appends a Soroban contract call operation, built locally without any network access. */
  addContractCall(params: { contractId: string; method: string; args?: ContractCallArg[] }): this {
    return this.addOperation(buildContractCallOperation(params));
  }

  /** Returns the number of operations queued so far. */
  operationCount(): number {
    return this.operations.length;
  }

  /**
   * Builds the unsigned transaction from the queued operations.
   * Performs no network I/O: the source account is constructed directly
   * from the caller-supplied account ID and sequence number.
   *
   * @throws {ValidationError} if no operations were added, too many were
   * added, or the resulting transaction fails {@link OfflineTransactionBuilder.validate}.
   */
  build(): Transaction {
    if (this.operations.length === 0) {
      throw new ValidationError(
        'OfflineTransactionBuilder: at least one operation is required to build a transaction'
      );
    }
    if (this.operations.length > MAX_OPERATIONS_PER_TRANSACTION) {
      throw new ValidationError(
        `OfflineTransactionBuilder: a transaction cannot contain more than ${MAX_OPERATIONS_PER_TRANSACTION.toString()} operations`
      );
    }

    const account = new Account(this.sourceAccount.accountId, this.sourceAccount.sequence);
    const txBuilder = new TransactionBuilder(account, {
      fee: this.fee.toString(),
      networkPassphrase: this.networkPassphrase,
    });

    for (const operation of this.operations) {
      txBuilder.addOperation(operation);
    }

    if (this.memo) {
      txBuilder.addMemo(Memo.text(this.memo));
    }

    txBuilder.setTimeout(this.timeoutInSeconds);

    const transaction = txBuilder.build();

    const validation = OfflineTransactionBuilder.validate(transaction);
    if (!validation.valid) {
      throw new ValidationError(
        `OfflineTransactionBuilder: built transaction failed validation: ${validation.errors.join('; ')}`
      );
    }

    return transaction;
  }

  /**
   * Serializes a built transaction into a transportable {@link OfflineTransactionPackage}.
   * @throws {ValidationError} if the transaction does not pass {@link OfflineTransactionBuilder.validate}.
   */
  export(transaction: Transaction): OfflineTransactionPackage {
    const validation = OfflineTransactionBuilder.validate(transaction);
    if (!validation.valid) {
      throw new ValidationError(
        `OfflineTransactionBuilder: cannot export an invalid transaction: ${validation.errors.join('; ')}`
      );
    }

    return {
      version: OFFLINE_TRANSACTION_PACKAGE_VERSION,
      xdr: transaction.toXDR(),
      networkPassphrase: this.networkPassphrase,
      sourceAccountId: this.sourceAccount.accountId,
      sequence: this.sourceAccount.sequence,
      operationCount: transaction.operations.length,
      createdAt: Date.now(),
    };
  }

  /**
   * Reconstructs a {@link Transaction} from a previously exported package.
   * @throws {ValidationError} if the package's schema version is unsupported.
   * @throws {InvalidXDRError} if the embedded XDR fails sanitization or parsing.
   */
  static import(pkg: OfflineTransactionPackage): Transaction {
    if (pkg.version !== OFFLINE_TRANSACTION_PACKAGE_VERSION) {
      throw new ValidationError(
        `OfflineTransactionBuilder: unsupported offline package version "${pkg.version.toString()}"`
      );
    }

    return OfflineTransactionBuilder.fromXDR(pkg.xdr, pkg.networkPassphrase);
  }

  /**
   * Parses a transaction XDR string, guarding against malformed or oversized
   * input before it ever reaches the stellar-sdk parser.
   *
   * @throws {InvalidXDRError} if the input is not safe, well-formed XDR.
   * @throws {ValidationError} if the XDR decodes to a fee bump envelope
   * (this builder only deals with inner transactions).
   */
  static fromXDR(xdrString: string, networkPassphrase: string): Transaction {
    assertValidXDR(xdrString, 'OfflineTransactionBuilder.fromXDR');

    let parsed: Transaction | FeeBumpTransaction;
    try {
      parsed = TransactionBuilder.fromXDR(xdrString, networkPassphrase);
    } catch (err) {
      throw new InvalidXDRError(
        `OfflineTransactionBuilder.fromXDR: failed to parse XDR: ${
          err instanceof Error ? err.message : String(err)
        }`,
        xdrString,
        { originalError: err }
      );
    }

    if (parsed instanceof FeeBumpTransaction) {
      throw new ValidationError(
        'OfflineTransactionBuilder.fromXDR: expected an inner transaction, received a fee bump transaction envelope'
      );
    }

    return parsed;
  }

  /**
   * Runs purely local, offline structural checks against a transaction —
   * no network access and no simulation. This validates shape (operation
   * count, fee, source account, time bounds) rather than on-chain outcomes,
   * since outcomes can only be confirmed once the transaction is submitted.
   */
  static validate(transaction: Transaction): OfflineTransactionValidationResult {
    const errors: string[] = [];

    if (transaction.operations.length === 0) {
      errors.push('Transaction must contain at least one operation');
    }
    if (transaction.operations.length > MAX_OPERATIONS_PER_TRANSACTION) {
      errors.push(
        `Transaction exceeds the maximum of ${MAX_OPERATIONS_PER_TRANSACTION.toString()} operations`
      );
    }

    const fee = Number(transaction.fee);
    if (!Number.isFinite(fee) || fee <= 0) {
      errors.push('Transaction fee must be a positive number');
    }

    if (!transaction.source || !StrKey.isValidEd25519PublicKey(transaction.source)) {
      errors.push('Transaction must have a valid source account');
    }

    if (!transaction.sequence || !/^\d+$/.test(transaction.sequence)) {
      errors.push('Transaction must have a valid numeric sequence number');
    }

    if (!transaction.timeBounds) {
      errors.push('Transaction must have time bounds set (call setTimeout before building)');
    }

    return { valid: errors.length === 0, errors };
  }
}
