import { Account, Address, Keypair, nativeToScVal, rpc, scValToNative, TransactionBuilder } from '@stellar/stellar-sdk';

import { BaseContract, BaseContractConfig, InvokeMethodOptions } from './BaseContract';
import { SlippageToleranceExceededError } from '../errors/axionveraError';
import { SorobanAuthEntry } from '../utils/sorobanAuth';
import { buildContractCallOperation } from '../utils/transactionBuilder';

// Re-export so consumers never need to import BaseContract separately.
export type { BaseContractConfig };

/** Alias kept for backward compatibility. */
export type VaultConfig = BaseContractConfig;

// ─── Strict argument interfaces ────────────────────────────────────────────────
// These enforce compile-time typo detection (e.g. { amout } instead of { amount }).

/** Core arguments for the vault `deposit` contract call. */
export type DepositArgs = {
  /** Amount of tokens to deposit (i128). */
  readonly amount: bigint;
  /** Depositing address; defaults to the wallet's public key when omitted. */
  readonly from?: string;
};

/** Core arguments for the vault `withdraw` contract call. */
export type WithdrawArgs = {
  /** Amount of tokens to withdraw (i128). */
  readonly amount: bigint;
  /** Destination address; defaults to the wallet's public key when omitted. */
  readonly to?: string;
};

/** Core arguments for the vault `claim_rewards` contract call (no required fields). */
export type ClaimArgs = Record<string, never>;

// ─── Extended param types (args + SDK plumbing) ────────────────────────────────

/**
 * Parameters for deposit operations.
 */
export type DepositParams = DepositArgs & {
  /** Optional transaction builder to append operation to existing transaction. */
  txBuilder?: TransactionBuilder;
  /**
   * Minimum acceptable shares to receive. If provided, the SDK runs a
   * read-only simulation before requesting a wallet signature and throws
   * SlippageToleranceExceededError when the simulated shares are below this
   * threshold. Ignored when txBuilder is provided.
   */
  minSharesOut?: bigint;
  /** Additional Soroban auth entries for multisig / delegation flows. */
  authEntries?: SorobanAuthEntry[];
};

/**
 * Parameters for withdraw operations.
 */
export type WithdrawParams = WithdrawArgs & {
  /** Optional transaction builder to append operation to existing transaction. */
  txBuilder?: TransactionBuilder;
  /**
   * Maximum acceptable assets to spend. If provided, the SDK runs a
   * read-only simulation before requesting a wallet signature and throws
   * SlippageToleranceExceededError when the simulated cost exceeds this
   * threshold. Ignored when txBuilder is provided.
   */
  maxAssetsIn?: bigint;
  /** Additional Soroban auth entries for multisig / delegation flows. */
  authEntries?: SorobanAuthEntry[];
};

/**
 * Parameters for claim rewards operations.
 */
export type ClaimRewardsParams = {
  /** Optional transaction builder to append operation to existing transaction. */
  txBuilder?: TransactionBuilder;
  /** Additional Soroban auth entries for multisig / delegation flows. */
  authEntries?: SorobanAuthEntry[];
};

/** Vault contract information. */
export type VaultInfo = {
  totalAssets: bigint;
  totalSupply: bigint;
  apy: number;
  lockPeriod: number;
};

/**
 * High-level wrapper for the Axionvera Vault smart contract.
 *
 * Extends {@link BaseContract} to inherit the strongly-typed generic
 * `invokeMethod` helper and the full build → simulate → sign → submit lifecycle.
 *
 * @example
 * ```typescript
 * const vault = new VaultContract({ client, contractId: 'C...', wallet });
 *
 * // Simple deposit
 * const result = await vault.deposit({ amount: 1000n });
 *
 * // Deposit with slippage protection
 * const result = await vault.deposit({ amount: 1000n, minSharesOut: 950n });
 *
 * // Composite transaction: Deposit + Claim Rewards (atomic)
 * const builder = buildBaseTransaction({ sourceAccount: account, networkPassphrase });
 * await vault.deposit({ amount: 1000n, txBuilder: builder });
 * await vault.claimRewards({ txBuilder: builder });
 * const tx = builder.build();
 * ```
 */
export class VaultContract extends BaseContract {
  constructor(config: VaultConfig) {
    super(config);
  }

  /**
   * Deposits tokens into the vault and receives vault shares in return.
   *
   * When `minSharesOut` is supplied, the SDK simulates the call read-only
   * before requesting a wallet signature and throws
   * {@link SlippageToleranceExceededError} if the simulated shares would fall
   * below that threshold.
   *
   * @param params - Deposit parameters (see {@link DepositParams}).
   * @returns The transaction result, or the transaction builder if txBuilder was provided.
   * @throws SlippageToleranceExceededError when simulated shares < minSharesOut.
   */
  async deposit(params: DepositParams): Promise<any> {
    const from = params.from ?? (await this.wallet.getPublicKey());

    if (params.minSharesOut !== undefined && !params.txBuilder) {
      const simulatedShares = await this.simulateReadOnly('preview_deposit', params.amount);
      if (simulatedShares < params.minSharesOut) {
        throw new SlippageToleranceExceededError(
          params.minSharesOut,
          simulatedShares,
          params.minSharesOut,
        );
      }
    }

    const options: InvokeMethodOptions = {
      sourceAccount: from,
      ...(params.txBuilder !== undefined && { txBuilder: params.txBuilder }),
      ...(params.authEntries !== undefined && { authEntries: params.authEntries }),
    };

    return this.invokeMethod<DepositArgs>(
      'deposit',
      { amount: params.amount, from },
      (args) => [
        nativeToScVal(args.amount, { type: 'i128' }),
        new Address(args.from!).toScVal(),
      ],
      options,
    );
  }

  /**
   * Withdraws tokens from the vault by burning vault shares.
   *
   * When `maxAssetsIn` is supplied, the SDK simulates the call read-only
   * before requesting a wallet signature and throws
   * {@link SlippageToleranceExceededError} when the simulated cost exceeds
   * that threshold.
   *
   * @param params - Withdraw parameters (see {@link WithdrawParams}).
   * @returns The transaction result, or the transaction builder if txBuilder was provided.
   * @throws SlippageToleranceExceededError when simulated assets-in > maxAssetsIn.
   */
  async withdraw(params: WithdrawParams): Promise<any> {
    const to = params.to ?? (await this.wallet.getPublicKey());
    const sourceAccount = await this.wallet.getPublicKey();

    if (params.maxAssetsIn !== undefined && !params.txBuilder) {
      const simulatedAssetsIn = await this.simulateReadOnly('preview_withdraw', params.amount);
      if (simulatedAssetsIn > params.maxAssetsIn) {
        throw new SlippageToleranceExceededError(
          params.maxAssetsIn,
          simulatedAssetsIn,
          params.maxAssetsIn,
        );
      }
    }

    const options: InvokeMethodOptions = {
      sourceAccount,
      ...(params.txBuilder !== undefined && { txBuilder: params.txBuilder }),
      ...(params.authEntries !== undefined && { authEntries: params.authEntries }),
    };

    return this.invokeMethod<WithdrawArgs>(
      'withdraw',
      { amount: params.amount, to },
      (args) => [
        nativeToScVal(args.amount, { type: 'i128' }),
        new Address(args.to!).toScVal(),
      ],
      options,
    );
  }

  /**
   * Claims pending rewards for the caller.
   *
   * @param params - Optional parameters including txBuilder and authEntries.
   * @returns The transaction result, or the transaction builder if txBuilder was provided.
   */
  async claimRewards(params?: ClaimRewardsParams): Promise<any> {
    const sourceAccount = await this.wallet.getPublicKey();

    const options: InvokeMethodOptions = {
      sourceAccount,
      ...(params?.txBuilder !== undefined && { txBuilder: params.txBuilder }),
      ...(params?.authEntries !== undefined && { authEntries: params.authEntries }),
    };

    return this.invokeMethod<ClaimArgs>(
      'claim_rewards',
      {},
      () => [],
      options,
    );
  }

  /**
   * Simulates a deposit to calculate the expected number of vault shares
   * received for a given asset amount.
   *
   * This is a **read-only** call — it does NOT prompt the wallet for a
   * signature and never invokes the wallet connector.
   *
   * @param assets - The amount of assets to deposit (in base units as bigint).
   * @returns The estimated number of vault shares that would be minted.
   */
  async previewDeposit(assets: bigint): Promise<bigint> {
    return this.simulateReadOnly('preview_deposit', assets);
  }

  /**
   * Simulates a withdrawal to calculate the expected asset amount returned
   * when redeeming a given number of vault shares.
   *
   * This is a **read-only** call — it does NOT prompt the wallet and never
   * invokes the wallet connector.
   *
   * @param shares - The number of vault shares to redeem (as bigint).
   * @returns The estimated amount of assets that would be returned.
   */
  async previewWithdraw(shares: bigint): Promise<bigint> {
    return this.simulateReadOnly('preview_withdraw', shares);
  }

  /**
   * Retrieves the vault balance for a specific account.
   *
   * @param account - The account address to check (defaults to wallet public key).
   * @returns The vault balance as a bigint.
   */
  async getBalance(account?: string): Promise<bigint> {
    const targetAccount = account ?? (await this.wallet.getPublicKey());
    const scVal = await this.query('balance', [new Address(targetAccount).toScVal()]);
    return this.decodeI128(scVal);
  }

  /**
   * Retrieves the user's balance of vault share tokens.
   *
   * @param account - The account address to check (defaults to wallet public key).
   * @returns The vault share balance as a bigint.
   */
  async getVaultShares(account?: string): Promise<bigint> {
    const targetAccount = account ?? (await this.wallet.getPublicKey());
    const scVal = await this.query('shares_of', [new Address(targetAccount).toScVal()]);
    return this.decodeI128(scVal);
  }

  /**
   * Queries the current exchange rate between 1 share and the underlying asset.
   *
   * @returns The exchange rate as a bigint (in the contract's base precision).
   */
  async getExchangeRate(): Promise<bigint> {
    const scVal = await this.query('exchange_rate', []);
    return this.decodeI128(scVal);
  }

  /**
   * Builds an in-memory transaction (no wallet calls), simulates it against
   * Soroban RPC, and decodes the i128 return value to bigint.
   * Powers the read-only preview methods and slippage checks.
   */
  private async simulateReadOnly(method: string, arg: bigint): Promise<bigint> {
    const operation = buildContractCallOperation({
      contractId: this.contractId,
      method,
      args: [nativeToScVal(arg, { type: 'i128' })],
    });

    // Use a synthetic source account — Soroban RPC does not require it to
    // exist on-chain, and this keeps the call completely wallet-free.
    const dummyAccount = new Account(Keypair.random().publicKey(), '0');
    const transaction = new TransactionBuilder(dummyAccount, {
      fee: '100',
      networkPassphrase: this.client.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(0)
      .build();

    const simulation = await this.client.simulateTransaction(transaction);

    if (!rpc.Api.isSimulationSuccess(simulation)) {
      throw new Error(`Vault preview simulation failed for ${method}: ${simulation.error}`);
    }

    const retval = simulation.result?.retval;
    if (!retval) {
      throw new Error(`Vault preview simulation for ${method} returned no value`);
    }

    const native = scValToNative(retval);
    if (typeof native !== 'bigint') {
      throw new Error(`Vault preview for ${method} returned unexpected type ${typeof native}`);
    }
    return native;
  }
}
