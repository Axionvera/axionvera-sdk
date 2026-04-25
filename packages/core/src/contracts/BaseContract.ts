import { TransactionBuilder, xdr } from '@stellar/stellar-sdk';

import { StellarClient } from '../client/stellarClient';
import { TransactionSigner, ContractCallParams, TransactionResult } from '../transaction/transactionSigner';
import { WalletConnector } from '../wallet/walletConnector';
import { buildContractCallOperation } from '../utils/transactionBuilder';
import { addAuthEntry, SorobanAuthEntry } from '../utils/sorobanAuth';

export type BaseContractConfig = {
  /** The stellar client for network operations. */
  client: StellarClient;
  /** The on-chain contract ID (C…). */
  contractId: string;
  /** The wallet connector used for signing. */
  wallet: WalletConnector;
};

/** Options forwarded to every invokeMethod call. */
export type InvokeMethodOptions = {
  /**
   * When provided, the operation is appended to this builder and the builder
   * is returned instead of signing/submitting a new transaction. Useful for
   * composing multiple operations into a single atomic transaction.
   */
  txBuilder?: TransactionBuilder;
  /**
   * Additional Soroban authorization entries to inject into the transaction
   * envelope after simulation — e.g. for multisig or delegated-authority flows.
   * Entries are applied in order via {@link addAuthEntry}.
   */
  authEntries?: SorobanAuthEntry[];
  /** Override the source account (defaults to the wallet's public key). */
  sourceAccount?: string;
};

/**
 * Abstract base for Soroban contract wrappers.
 *
 * Provides a generic `invokeMethod` helper that enforces strongly-typed
 * argument interfaces at compile time and handles the full
 * build → simulate → (inject auth) → sign → submit lifecycle.
 *
 * Concrete contracts extend this class and call `invokeMethod` with their
 * own typed arg interfaces, so that a typo like `{ amout: 1n }` instead of
 * `{ amount: 1n }` is caught immediately in the consumer's IDE.
 *
 * @example
 * ```ts
 * class VaultContract extends BaseContract {
 *   async deposit(params: DepositParams) {
 *     return this.invokeMethod<DepositArgs, TransactionResult>(
 *       'deposit',
 *       { amount: params.amount, from: params.from },
 *       (args) => [
 *         nativeToScVal(args.amount, { type: 'i128' }),
 *         new Address(args.from!).toScVal(),
 *       ],
 *       { txBuilder: params.txBuilder, authEntries: params.authEntries },
 *     );
 *   }
 * }
 * ```
 */
export abstract class BaseContract {
  protected readonly client: StellarClient;
  protected readonly contractId: string;
  protected readonly wallet: WalletConnector;
  protected readonly transactionSigner: TransactionSigner;

  constructor(config: BaseContractConfig) {
    this.client = config.client;
    this.contractId = config.contractId;
    this.wallet = config.wallet;
    this.transactionSigner = new TransactionSigner({
      client: this.client,
      wallet: this.wallet,
    });
  }

  /**
   * Invokes a Soroban contract method with strongly-typed arguments.
   *
   * The generic `TArgs` parameter is the precise argument interface for this
   * method — passing an object with a misspelled or extra key is a compile-time
   * error. `TReturn` links the return type at the call site.
   *
   * When `options.txBuilder` is provided the operation is added to the builder
   * and the builder is returned (no network call). Otherwise the full
   * build → simulate → [inject custom auth] → sign → submit flow runs.
   *
   * @param method    - The Soroban function name to call.
   * @param args      - Strongly-typed arguments consumed by `toScVals`.
   * @param toScVals  - Maps `TArgs` to the `xdr.ScVal[]` the contract expects.
   * @param options   - txBuilder, authEntries, sourceAccount overrides.
   */
  protected async invokeMethod<TArgs extends object, TReturn = TransactionResult>(
    method: string,
    args: TArgs,
    toScVals: (args: TArgs) => xdr.ScVal[],
    options?: InvokeMethodOptions,
  ): Promise<TReturn> {
    const scVals = toScVals(args);
    const sourceAccount =
      options?.sourceAccount ?? (await this.wallet.getPublicKey());

    const operation = buildContractCallOperation({
      contractId: this.contractId,
      method,
      args: scVals,
    });

    // ── txBuilder (compose) path ────────────────────────────────────────────
    if (options?.txBuilder) {
      options.txBuilder.addOperation(operation);
      return options.txBuilder as unknown as TReturn;
    }

    const contractCallParams: ContractCallParams = {
      contractId: this.contractId,
      method,
      args: scVals,
    };

    // ── Auth-entries path ───────────────────────────────────────────────────
    if (options?.authEntries?.length) {
      // Build → simulate → prepare → inject custom auth → sign → submit.
      const tx = await this.transactionSigner.buildTransaction({
        sourceAccount,
        operations: [contractCallParams],
      });

      const simulation = await this.client.simulateTransaction(tx);

      const { rpc } = await import('@stellar/stellar-sdk');
      if (!rpc.Api.isSimulationSuccess(simulation)) {
        throw new Error(`Transaction simulation failed: ${(simulation as any).error}`);
      }

      const preparedTx = await this.client.prepareTransaction(tx, simulation);

      // Inject each custom auth entry after the standard auth is assembled.
      let envelopeXdr = preparedTx.toXDR();
      for (const entry of options.authEntries) {
        envelopeXdr = addAuthEntry(envelopeXdr, entry);
      }

      const signedXdr = await this.wallet.signTransaction(
        envelopeXdr,
        this.client.networkPassphrase,
      );

      const sendResult = await this.client.sendTransaction(signedXdr);
      const finalResult = await this.client.pollTransaction(sendResult.hash);

      return {
        hash: sendResult.hash,
        status: finalResult.status,
        successful: finalResult.status === 'SUCCESS',
        raw: finalResult,
        signedXdr,
        simulation,
      } as unknown as TReturn;
    }

    // ── Standard path ───────────────────────────────────────────────────────
    const result = await this.transactionSigner.buildAndSignTransaction({
      sourceAccount,
      operations: [contractCallParams],
    });

    return result as unknown as TReturn;
  }
}
