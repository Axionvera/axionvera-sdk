import {
  Address,
  rpc,
  nativeToScVal,
  xdr,
  TransactionBuilder
} from "@stellar/stellar-sdk";

import { StellarClient } from "../client/stellarClient";
import { WalletConnector } from "../wallet/walletConnector";
import { TransactionSigner, ContractCallParams } from "../transaction/transactionSigner";
import { buildContractCallOperation } from "../utils/transactionBuilder";
import { decodeXdrBase64 } from "../utils/xdrCache";
import { SlippageToleranceExceededError } from "../errors/axionveraError";

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
  /**
   * Minimum acceptable shares to receive in exchange for the deposit.
   * If provided, the SDK runs a read-only simulation before requesting a
   * wallet signature and throws SlippageToleranceExceededError when the
   * simulated shares are below this threshold. Ignored when txBuilder is
   * provided since the final composite transaction shape is unknown.
   */
  minSharesOut?: bigint;
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
  /**
   * Maximum acceptable assets the caller is willing to spend (in shares
   * burned) for the withdrawal. If provided, the SDK runs a read-only
   * simulation before requesting a wallet signature and throws
   * SlippageToleranceExceededError when the simulated cost exceeds this
   * threshold. Ignored when txBuilder is provided.
   */
  maxAssetsIn?: bigint;
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
   * When `minSharesOut` is supplied, the SDK simulates the call read-only
   * before requesting a wallet signature and throws
   * SlippageToleranceExceededError if the simulated shares would fall below
   * that threshold. The check is skipped when `txBuilder` is provided because
   * the final composite transaction is built and signed by the caller.
   *
   * @param params - Deposit parameters
   * @returns The transaction result, or the transaction builder if txBuilder was provided
   * @throws SlippageToleranceExceededError when the simulated shares are below `minSharesOut`
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

    if (params.minSharesOut !== undefined) {
      const simulatedShares = await this.simulateI128Result({
        sourceAccount: from,
        operations: [contractCall]
      });
      if (simulatedShares < params.minSharesOut) {
        throw new SlippageToleranceExceededError(
          params.minSharesOut,
          simulatedShares,
          params.minSharesOut
        );
      }
    }

    return await this.transactionSigner.buildAndSignTransaction({
      sourceAccount: from,
      operations: [contractCall]
    });
  }

  /**
   * Withdraws tokens from the vault.
   *
   * When `maxAssetsIn` is supplied, the SDK simulates the call read-only
   * before requesting a wallet signature and throws
   * SlippageToleranceExceededError if the simulated assets required exceed
   * that threshold. The check is skipped when `txBuilder` is provided.
   *
   * @param params - Withdraw parameters
   * @returns The transaction result, or the transaction builder if txBuilder was provided
   * @throws SlippageToleranceExceededError when the simulated assets-in exceeds `maxAssetsIn`
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

    if (params.maxAssetsIn !== undefined) {
      const simulatedAssetsIn = await this.simulateI128Result({
        sourceAccount,
        operations: [contractCall]
      });
      if (simulatedAssetsIn > params.maxAssetsIn) {
        throw new SlippageToleranceExceededError(
          params.maxAssetsIn,
          simulatedAssetsIn,
          params.maxAssetsIn
        );
      }
    }

    return await this.transactionSigner.buildAndSignTransaction({
      sourceAccount,
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

  /**
   * Builds a read-only transaction, simulates it, and decodes the first
   * return value as an i128 bigint. Used by the slippage protection path so
   * the SDK can compare the simulated outcome against the caller's tolerance
   * before requesting a wallet signature.
   */
  private async simulateI128Result(params: {
    sourceAccount: string;
    operations: ContractCallParams[];
  }): Promise<bigint> {
    const transaction = await this.transactionSigner.buildTransaction(params);
    const simulation = await this.client.simulateTransaction(transaction);

    if (!rpc.Api.isSimulationSuccess(simulation)) {
      throw new Error(`Slippage simulation failed: ${simulation.error}`);
    }

    const result = simulation.results?.[0];
    if (!result) {
      throw new Error("No result in slippage simulation");
    }

    const scVal = decodeXdrBase64(result.xdr);
    if (scVal.switch() !== xdr.ScValType.scvI128()) {
      throw new Error("Unexpected simulation return type for slippage check");
    }

    const i128 = scVal.i128();
    return BigInt(i128.low().toString()) + (BigInt(i128.high().toString()) << 64n);
  }
}
