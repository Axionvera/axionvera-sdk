import {
  Account,
  Address,
  Keypair,
  rpc,
  nativeToScVal,
  scValToNative,
  TransactionBuilder,
  xdr
} from "@stellar/stellar-sdk";

import { StellarClient } from "../client/stellarClient";
import { WalletConnector } from "../wallet/walletConnector";
import { TransactionSigner, ContractCallParams } from "../transaction/transactionSigner";
import { buildContractCallOperation } from "../utils/transactionBuilder";
import { decodeXdrBase64 } from "../utils/xdrCache";

/**
 * Configuration for the Vault contract wrapper.
 */
export type VaultConfig = {
  /** The stellar client for network operations */
  client: StellarClient;
  /** The contract ID of the Vault */
  contractId: string;
  /** The wallet connector for signing transactions */
  wallet: WalletConnector;
};

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
export class VaultContract {
  private readonly client: StellarClient;
  private readonly contractId: string;
  private readonly wallet: WalletConnector;
  private readonly transactionSigner: TransactionSigner;

  /**
   * Creates a new VaultContract instance.
   * @param config - Configuration for the vault contract
   */
  constructor(config: VaultConfig) {
    this.client = config.client;
    this.contractId = config.contractId;
    this.wallet = config.wallet;
    this.transactionSigner = new TransactionSigner({
      client: this.client,
      wallet: this.wallet
    });
  }

  /**
   * Deposits tokens into the vault.
   * 
   * @param params - Deposit parameters
   * @returns The transaction result, or the transaction builder if txBuilder was provided
   */
  async deposit(params: DepositParams): Promise<any> {
    const from = params.from ?? await this.wallet.getPublicKey();

    const operation = buildContractCallOperation({
      contractId: this.contractId,
      method: "deposit",
      args: [
        nativeToScVal(params.amount, { type: "i128" }),
        new Address(from).toScVal()
      ]
    });

    // If txBuilder is provided, append operation and return the builder
    if (params.txBuilder) {
      params.txBuilder.addOperation(operation);
      return params.txBuilder;
    }

    // Otherwise, build and sign the transaction normally
    const contractCall: ContractCallParams = {
      contractId: this.contractId,
      method: "deposit",
      args: [
        nativeToScVal(params.amount, { type: "i128" }),
        new Address(from).toScVal()
      ]
    };

    return await this.transactionSigner.buildAndSignTransaction({
      sourceAccount: from,
      operations: [contractCall]
    });
  }

  /**
   * Withdraws tokens from the vault.
   * 
   * @param params - Withdraw parameters
   * @returns The transaction result, or the transaction builder if txBuilder was provided
   */
  async withdraw(params: WithdrawParams): Promise<any> {
    const to = params.to ?? await this.wallet.getPublicKey();
    const sourceAccount = await this.wallet.getPublicKey();

    const operation = buildContractCallOperation({
      contractId: this.contractId,
      method: "withdraw",
      args: [
        nativeToScVal(params.amount, { type: "i128" }),
        new Address(to).toScVal()
      ]
    });

    // If txBuilder is provided, append operation and return the builder
    if (params.txBuilder) {
      params.txBuilder.addOperation(operation);
      return params.txBuilder;
    }

    // Otherwise, build and sign the transaction normally
    const contractCall: ContractCallParams = {
      contractId: this.contractId,
      method: "withdraw",
      args: [
        nativeToScVal(params.amount, { type: "i128" }),
        new Address(to).toScVal()
      ]
    };

    return await this.transactionSigner.buildAndSignTransaction({
      sourceAccount,
      operations: [contractCall]
    });
  }

  /**
   * Simulates a deposit to calculate the expected number of vault shares
   * received for a given asset amount, at the current exchange rate and TVL.
   *
   * This is a **read-only** call. It does NOT prompt the user's wallet for a
   * signature and never invokes the wallet connector — only Soroban RPC is
   * touched. The returned value is an estimate based on current on-chain
   * state and may be affected by slippage if state changes between this call
   * and actual execution.
   *
   * @param assets - The amount of assets to deposit (in base units as bigint)
   * @returns The estimated number of vault shares that would be minted
   *
   * @example
   * ```typescript
   * const estimatedShares = await vault.previewDeposit(1000n);
   * console.log(`You will receive approximately ${estimatedShares} shares`);
   * ```
   */
  async previewDeposit(assets: bigint): Promise<bigint> {
    return this.simulateReadOnly("preview_deposit", assets);
  }

  /**
   * Simulates a withdrawal to calculate the expected asset amount returned
   * when redeeming a given number of vault shares, at the current exchange
   * rate.
   *
   * This is a **read-only** call. It does NOT prompt the user's wallet and
   * never invokes the wallet connector. The returned value reflects current
   * TVL and exchange rate and may shift before the actual withdrawal is
   * executed.
   *
   * @param shares - The number of vault shares to redeem (as bigint)
   * @returns The estimated amount of assets that would be returned
   *
   * @example
   * ```typescript
   * const estimatedAssets = await vault.previewWithdraw(500n);
   * console.log(`Redeeming 500 shares returns ~${estimatedAssets} assets`);
   * ```
   */
  async previewWithdraw(shares: bigint): Promise<bigint> {
    return this.simulateReadOnly("preview_withdraw", shares);
  }

  /**
   * Builds an in-memory transaction (no `rpc.getAccount`, no wallet calls),
   * simulates it against Soroban RPC, and decodes the i128 return value to
   * a bigint. Powers the read-only preview methods.
   */
  private async simulateReadOnly(method: string, arg: bigint): Promise<bigint> {
    const operation = buildContractCallOperation({
      contractId: this.contractId,
      method,
      args: [nativeToScVal(arg, { type: "i128" })]
    });

    // Use a synthetic source account for simulation — Soroban RPC does not
    // require it to exist on chain, and this keeps the call wallet-free.
    const dummyAccount = new Account(Keypair.random().publicKey(), "0");
    const transaction = new TransactionBuilder(dummyAccount, {
      fee: "100",
      networkPassphrase: this.client.networkPassphrase
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
    if (typeof native !== "bigint") {
      throw new Error(`Vault preview for ${method} returned unexpected type ${typeof native}`);
    }
    return native;
  }

  /**
   * Gets the vault balance for a specific account.
   * @param account - The account to check (optional, defaults to wallet public key)
   * @returns The vault balance
   */
  async getBalance(account?: string): Promise<bigint> {
    const targetAccount = account ?? await this.wallet.getPublicKey();

    const contractCall: ContractCallParams = {
      contractId: this.contractId,
      method: "balance",
      args: [new Address(targetAccount).toScVal()]
    };

    // Build a read-only transaction for querying
    const transaction = await this.transactionSigner.buildTransaction({
      sourceAccount: targetAccount,
      operations: [contractCall]
    });

    // Simulate to get the result
    const simulation = await this.client.simulateTransaction(transaction);

    if (!rpc.Api.isSimulationSuccess(simulation)) {
      throw new Error(`Failed to get balance: ${simulation.error}`);
    }

    // Extract the return value from simulation
    const result = simulation.results?.[0];
    if (!result) {
      throw new Error("No result in simulation");
    }

    // Decode only the return value of the first result; cache avoids redundant
    // XDR parsing when the same account balance is queried multiple times.
    const returnValue = result.xdr;
    const scVal = decodeXdrBase64(returnValue);

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
    const sourceAccount = await this.wallet.getPublicKey();

    const operation = buildContractCallOperation({
      contractId: this.contractId,
      method: "claim_rewards",
      args: []
    });

    // If txBuilder is provided, append operation and return the builder
    if (params?.txBuilder) {
      params.txBuilder.addOperation(operation);
      return params.txBuilder;
    }

    // Otherwise, build and sign the transaction normally
    const contractCall: ContractCallParams = {
      contractId: this.contractId,
      method: "claim_rewards",
      args: []
    };

    return await this.transactionSigner.buildAndSignTransaction({
      sourceAccount,
      operations: [contractCall]
    });
  }

  /**
   * Gets general vault information.
   * @returns Vault information
   */
  async getVaultInfo(): Promise<VaultInfo> {
    const contractCall: ContractCallParams = {
      contractId: this.contractId,
      method: "get_vault_info",
      args: []
    };

    const transaction = await this.transactionSigner.buildTransaction({
      sourceAccount: await this.wallet.getPublicKey(),
      operations: [contractCall]
    });

    const simulation = await this.client.simulateTransaction(transaction);

    if (!rpc.Api.isSimulationSuccess(simulation)) {
      throw new Error(`Failed to get vault info: ${simulation.error}`);
    }

    const result = simulation.results?.[0];
    if (!result) {
      throw new Error("No result in simulation");
    }

    // Decode only the return value of the first result; cache avoids redundant
    // XDR parsing when vault info is queried repeatedly.
    const returnValue = result.xdr;
    const _scVal = decodeXdrBase64(returnValue);

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
    const contractCall: ContractCallParams = {
      contractId: this.contractId,
      method: "deposit",
      args: [
        nativeToScVal(amount, { type: "i128" }),
        new Address(await this.wallet.getPublicKey()).toScVal()
      ]
    };

    return await this.transactionSigner.estimateOptimalFee({
      sourceAccount: await this.wallet.getPublicKey(),
      operations: [contractCall]
    });
  }

  /**
   * Estimates the gas fee for a withdraw operation.
   * @param amount - The withdraw amount
   * @returns Estimated fee in stroops
   */
  async estimateWithdrawFee(amount: bigint): Promise<number> {
    const contractCall: ContractCallParams = {
      contractId: this.contractId,
      method: "withdraw",
      args: [
        nativeToScVal(amount, { type: "i128" }),
        new Address(await this.wallet.getPublicKey()).toScVal()
      ]
    };

    return await this.transactionSigner.estimateOptimalFee({
      sourceAccount: await this.wallet.getPublicKey(),
      operations: [contractCall]
    });
  }
}
