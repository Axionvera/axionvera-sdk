import {
  Address,
  rpc,
  nativeToScVal,
  xdr
} from "@stellar/stellar-sdk";

import { StellarClient } from "../client/stellarClient";
import { WalletConnector } from "../wallet/walletConnector";
import { TransactionSigner, ContractCallParams } from "../transaction/transactionSigner";

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
};

/**
 * Parameters for withdraw operations.
 */
export type WithdrawParams = {
  /** The amount to withdraw */
  amount: bigint;
  /** The destination account (optional, defaults to wallet public key) */
  to?: string;
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
 * @example
 * ```typescript
 * const vault = new VaultContract({
 *   client,
 *   contractId: "C...",
 *   wallet
 * });
 * 
 * const result = await vault.deposit({ amount: 1000n });
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
   * @param params - Deposit parameters
   * @returns The transaction result
   */
  async deposit(params: DepositParams): Promise<any> {
    const from = params.from ?? await this.wallet.getPublicKey();
    
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
   * @param params - Withdraw parameters
   * @returns The transaction result
   */
  async withdraw(params: WithdrawParams): Promise<any> {
    const to = params.to ?? await this.wallet.getPublicKey();
    
    const contractCall: ContractCallParams = {
      contractId: this.contractId,
      method: "withdraw",
      args: [
        nativeToScVal(params.amount, { type: "i128" }),
        new Address(to).toScVal()
      ]
    };

    return await this.transactionSigner.buildAndSignTransaction({
      sourceAccount: await this.wallet.getPublicKey(),
      operations: [contractCall]
    });
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

    // Parse the return value (assuming it returns an i128)
    const returnValue = result.xdr;
    const scVal = xdr.ScVal.fromXDR(returnValue, 'base64');
    
    // Convert ScVal to bigint (this is a simplified conversion)
    if (scVal.switch() === xdr.ScValType.scvI128()) {
      const i128 = scVal.i128();
      return BigInt(i128.low().toString()) + (BigInt(i128.high().toString()) << 64n);
    }

    throw new Error("Unexpected return value type");
  }

  /**
   * Claims pending rewards for the caller.
   * @returns The transaction result
   */
  async claimRewards(): Promise<any> {
    const contractCall: ContractCallParams = {
      contractId: this.contractId,
      method: "claim_rewards",
      args: []
    };

    return await this.transactionSigner.buildAndSignTransaction({
      sourceAccount: await this.wallet.getPublicKey(),
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

    // Parse the complex return value
    // This is a simplified implementation - actual parsing would depend on the contract's return structure
    const returnValue = result.xdr;
    const _scVal = xdr.ScVal.fromXDR(returnValue, 'base64');
    
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
