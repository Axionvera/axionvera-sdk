import {
  Address,
  nativeToScVal,
  xdr,
  TransactionBuilder
} from "@stellar/stellar-sdk";

import { BaseContract, ContractConfig } from "./BaseContract";

/**
 * Configuration for the Vault contract wrapper.
 */
export type VaultConfig = ContractConfig;

/**
 * Parameters for deposit operations.
 */
export type DepositParams = {
  /** The amount to deposit */
  amount: bigint;
  /** The source account (optional, defaults to wallet public key) */
  from?: string;
  /** Optional transaction builder to append operation to existing transaction */
  txBuilder?: TransactionBuilder;
};

/**
 * Parameters for withdraw operations.
 */
export type WithdrawParams = {
  /** The amount to withdraw */
  amount: bigint;
  /** The destination account (optional, defaults to wallet public key) */
  to?: string;
  /** Optional transaction builder to append operation to existing transaction */
  txBuilder?: TransactionBuilder;
};

/**
 * Parameters for claim rewards operations.
 */
export type ClaimRewardsParams = {
  /** Optional transaction builder to append operation to existing transaction */
  txBuilder?: TransactionBuilder;
};

/**
 * Vault contract information.
 */
export type VaultInfo = {
  /** Total assets in the vault */
  totalAssets: bigint;
  /** Total supply of vault tokens */
  totalSupply: bigint;
  /** Current APY */
  apy: number;
  /** Lock period in seconds */
  lockPeriod: number;
};

/**
 * High-level wrapper for the Axionvera Vault smart contract.
 * 
 * This class provides a convenient interface for interacting with the Vault contract,
 * handling transaction building, signing, and submission automatically.
 * 
 * Supports composing multiple operations into a single transaction via the optional
 * txBuilder parameter, enabling atomic multi-operation transactions.
 * 
 * @example
 * ```typescript
 * const vault = new VaultContract({
 *   client,
 *   contractId: "C...",
 *   wallet
 * });
 * 
 * // Simple deposit
 * const result = await vault.deposit({ amount: 1000n });
 * 
 * // Composite transaction: Deposit + Claim Rewards
 * const { buildBaseTransaction } = await import('axionvera-sdk');
 * const account = await client.rpc.getAccount(publicKey);
 * const builder = buildBaseTransaction({
 *   sourceAccount: account,
 *   networkPassphrase: client.networkPassphrase
 * });
 * 
 * await vault.deposit({ amount: 1000n, txBuilder: builder });
 * await vault.claimRewards({ txBuilder: builder });
 * 
 * const tx = builder.build();
 * // Now sign and submit the composite transaction
 * ```
 */
export class VaultContract extends BaseContract {
  /**
   * Creates a new VaultContract instance.
   * @param config - Configuration for the vault contract
   */
  constructor(config: VaultConfig) {
    super(config);
  }

  /**
   * Deposits tokens into the vault.
   * 
   * @param params - Deposit parameters
   * @returns The transaction result, or the transaction builder if txBuilder was provided
   */
  async deposit(params: DepositParams): Promise<any> {
    const from = params.from ?? await this.wallet.getPublicKey();

    return await this.invokeMethod("deposit", [
      nativeToScVal(params.amount, { type: "i128" }),
      new Address(from).toScVal()
    ], params.txBuilder);
  }

  /**
   * Withdraws tokens from the vault.
   * 
   * @param params - Withdraw parameters
   * @returns The transaction result, or the transaction builder if txBuilder was provided
   */
  async withdraw(params: WithdrawParams): Promise<any> {
    const to = params.to ?? await this.wallet.getPublicKey();

    return await this.invokeMethod("withdraw", [
      nativeToScVal(params.amount, { type: "i128" }),
      new Address(to).toScVal()
    ], params.txBuilder);
  }

  /**
   * Gets the vault balance for a specific account.
   * @param account - The account to check (optional, defaults to wallet public key)
   * @returns The vault balance
   */
  async getBalance(account?: string): Promise<bigint> {
    const targetAccount = account ?? await this.wallet.getPublicKey();

    const scVal = await this.queryMethod("balance", [
      new Address(targetAccount).toScVal()
    ]);

    // Convert ScVal to bigint (this is a simplified conversion)
    if (scVal.switch() === xdr.ScValType.scvI128()) {
      const i128 = scVal.i128();
      return BigInt(i128.low().toString()) + (BigInt(i128.high().toString()) << 64n);
    }

    throw new Error("Unexpected return value type");
  }

  /**
   * Claims pending rewards for the caller.
   * 
   * @param params - Claim rewards parameters (optional)
   * @returns The transaction result, or the transaction builder if txBuilder was provided
   */
  async claimRewards(params?: ClaimRewardsParams): Promise<any> {
    return await this.invokeMethod("claim_rewards", [], params?.txBuilder);
  }

  /**
   * Gets general vault information.
   * @returns Vault information
   */
  async getVaultInfo(): Promise<VaultInfo> {
    const _scVal = await this.queryMethod("get_vault_info", []);

    // For now, return mock data - in practice, you'd parse the actual contract response
    return {
      totalAssets: 0n,
      totalSupply: 0n,
      apy: 0,
      lockPeriod: 0
    };
  }

  /**
   * Estimates the gas fee for a deposit operation.
   * @param amount - The deposit amount
   * @returns Estimated fee in stroops
   */
  async estimateDepositFee(amount: bigint): Promise<number> {
    const from = await this.wallet.getPublicKey();
    return await this.estimateFee("deposit", [
      nativeToScVal(amount, { type: "i128" }),
      new Address(from).toScVal()
    ]);
  }

  /**
   * Estimates the gas fee for a withdraw operation.
   * @param amount - The withdraw amount
   * @returns Estimated fee in stroops
   */
  async estimateWithdrawFee(amount: bigint): Promise<number> {
    const to = await this.wallet.getPublicKey();
    return await this.estimateFee("withdraw", [
      nativeToScVal(amount, { type: "i128" }),
      new Address(to).toScVal()
    ]);
  }
}

