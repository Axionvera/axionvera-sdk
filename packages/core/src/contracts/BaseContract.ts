import { Address, nativeToScVal, rpc, TransactionBuilder, xdr } from '@stellar/stellar-sdk';

import { StellarClient } from '../client/stellarClient';
import { TransactionSigner, ContractCallParams, TransactionResult } from '../transaction/transactionSigner';
import { WalletConnector } from '../wallet/walletConnector';
import { buildContractCallOperation, ContractCallArg } from '../utils/transactionBuilder';
import { addAuthEntry, SorobanAuthEntry } from '../utils/sorobanAuth';

/** Configuration required to instantiate any contract wrapper. */
export type BaseContractConfig = {
  /** The Stellar client for network operations. */
  client: StellarClient;
  /** The on-chain contract ID (C…). */
  contractId: string;
  /** The wallet connector used for signing. */
  wallet: WalletConnector;
};

/** Alias kept for backward compatibility with older generated wrappers. */
export type ContractConfig = BaseContractConfig;

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
   */
  authEntries?: SorobanAuthEntry[];
  /** Override the source account (defaults to the wallet's public key). */
  sourceAccount?: string;
};

/**
 * Abstract base class for Soroban contract wrappers.
 *
 * Provides a generic `invokeMethod` helper that enforces strongly-typed
 * argument interfaces at compile time and handles the full
 * build → simulate → (inject auth) → sign → submit lifecycle.
 *
 * Concrete contracts extend this class and call `invokeMethod` or `query`
 * with their own typed arg interfaces.
 *
 * @example
 * ```ts
 * class TokenContract extends BaseContract {
 *   async transfer(params: TransferParams) {
 *     const from = params.from ?? await this.wallet.getPublicKey();
 *     return this.invokeMethod<TransferArgs>(
 *       'transfer',
 *       { from, to: params.to, amount: params.amount },
 *       (args) => [
 *         new Address(args.from).toScVal(),
 *         new Address(args.to).toScVal(),
 *         nativeToScVal(args.amount, { type: 'i128' }),
 *       ],
 *     );
 *   }
 * }
 * ```
 */
export abstract class BaseContract {
  protected readonly client: StellarClient;
  protected readonly contractId: string;
  protected readonly wallet: WalletConnector;
  protected readonly signer: TransactionSigner;

  constructor(config: BaseContractConfig) {
    this.client = config.client;
    this.contractId = config.contractId;
    this.wallet = config.wallet;
    this.signer = new TransactionSigner({ client: this.client, wallet: this.wallet });
  }

  /**
   * Invokes a Soroban contract method with strongly-typed arguments.
   *
   * The generic `TArgs` parameter is the precise argument interface for this
   * method — passing an object with a misspelled or extra key is a compile-time
   * error.
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

    // ── txBuilder (compose) path ──────────────────────────────────────────
    if (options?.txBuilder) {
      options.txBuilder.addOperation(operation);
      return options.txBuilder as unknown as TReturn;
    }

    const contractCallParams: ContractCallParams = {
      contractId: this.contractId,
      method,
      args: scVals,
    };

    // ── Auth-entries path ─────────────────────────────────────────────────
    if (options?.authEntries?.length) {
      const tx = await this.signer.buildTransaction({
        sourceAccount,
        operations: [contractCallParams],
      });

      const simulation = await this.client.simulateTransaction(tx);

      if (!rpc.Api.isSimulationSuccess(simulation)) {
        throw new Error(`Transaction simulation failed: ${(simulation as any).error}`);
      }

      const preparedTx = await this.client.prepareTransaction(tx);
      let envelopeXdr = preparedTx.toXDR();
      for (const entry of options.authEntries) {
        envelopeXdr = addAuthEntry(envelopeXdr, entry);
      }

      const signedXdr = await this.wallet.signTransaction(
        envelopeXdr,
        this.client.networkPassphrase,
      );
      const signedTransaction = TransactionBuilder.fromXDR(
        signedXdr,
        this.client.networkPassphrase,
      );
      const sendResult = await this.client.sendTransaction(signedTransaction);
      const finalResult = await this.client.pollTransaction(sendResult.hash);
      const finalStatus = (finalResult as { status?: string } | null | undefined)?.status ?? 'UNKNOWN';

      return {
        hash: sendResult.hash,
        status: finalStatus,
        successful: finalStatus === 'SUCCESS',
        raw: finalResult,
        signedXdr,
        simulation,
      } as unknown as TReturn;
    }

    // ── Standard path ─────────────────────────────────────────────────────
    const result = await this.signer.buildAndSignTransaction({
      sourceAccount,
      operations: [contractCallParams],
    });

    return result as unknown as TReturn;
  }

  /**
   * Queries a read-only contract method via simulation (no transaction submitted).
   *
   * @param method - The Soroban function name.
   * @param args   - ScVal arguments for the call.
   * @returns The decoded ScVal return value.
   */
  protected async query(method: string, args: ContractCallArg[] = []): Promise<xdr.ScVal> {
    const sourceAccount = await this.wallet.getPublicKey();
    const call: ContractCallParams = { contractId: this.contractId, method, args };
    const tx = await this.signer.buildTransaction({ sourceAccount, operations: [call] });
    const simulation = await this.client.simulateTransaction(tx);

    if (!rpc.Api.isSimulationSuccess(simulation)) {
      throw new Error(`Simulation failed for ${method}: ${(simulation as any).error}`);
    }

    const result = simulation.result?.retval;
    if (!result) throw new Error(`No simulation result for ${method}`);
    return result;
  }

  // ── Typed decode helpers ───────────────────────────────────────────────

  /** Decode an i128 ScVal to bigint. */
  protected decodeI128(val: xdr.ScVal): bigint {
    if (val.switch() !== xdr.ScValType.scvI128()) throw new Error('Expected i128');
    const i = val.i128();
    return BigInt(i.lo().toString()) + (BigInt(i.hi().toString()) << 64n);
  }

  /** Decode a u128 ScVal to bigint. */
  protected decodeU128(val: xdr.ScVal): bigint {
    if (val.switch() !== xdr.ScValType.scvU128()) throw new Error('Expected u128');
    const u = val.u128();
    return BigInt(u.lo().toString()) + (BigInt(u.hi().toString()) << 64n);
  }

  /** Decode a u64 ScVal to bigint. */
  protected decodeU64(val: xdr.ScVal): bigint {
    if (val.switch() !== xdr.ScValType.scvU64()) throw new Error('Expected u64');
    return BigInt(val.u64().toString());
  }

  /** Decode a bool ScVal. */
  protected decodeBool(val: xdr.ScVal): boolean {
    if (val.switch() !== xdr.ScValType.scvBool()) throw new Error('Expected bool');
    return val.b();
  }

  /** Decode a string/symbol ScVal. */
  protected decodeString(val: xdr.ScVal): string {
    const t = val.switch();
    if (t === xdr.ScValType.scvString()) return val.str().toString();
    if (t === xdr.ScValType.scvSymbol()) return val.sym().toString();
    throw new Error('Expected string or symbol');
  }

  // ── Typed encode helpers ───────────────────────────────────────────────

  /** Encode an address arg. */
  protected encodeAddress(addr: string): xdr.ScVal {
    return new Address(addr).toScVal();
  }

  /** Encode a bigint as i128. */
  protected encodeI128(n: bigint): xdr.ScVal {
    return nativeToScVal(n, { type: 'i128' });
  }

  /** Encode a bigint as u128. */
  protected encodeU128(n: bigint): xdr.ScVal {
    return nativeToScVal(n, { type: 'u128' });
  }
}
