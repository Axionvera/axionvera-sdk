import {
  TransactionBuilder,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";

import { StellarClient } from "../client/stellarClient";
import { WalletConnector } from "../wallet/walletConnector";
import { TransactionSigner, ContractCallParams, TransactionResult } from "../transaction/transactionSigner";
import { buildContractCallOperation, ContractCallArg } from "../utils/transactionBuilder";
import { decodeXdrBase64 } from "../utils/xdrCache";

/**
 * Configuration for the contract wrapper.
 */
export type ContractConfig = {
  /** The stellar client for network operations */
  client: StellarClient;
  /** The contract ID */
  contractId: string;
  /** The wallet connector for signing transactions */
  wallet: WalletConnector;
};

/**
 * Base class for all Axionvera contract wrappers.
 * 
 * Provides shared logic for transaction building, simulation, signing, and polling.
 * This allows specialized contract wrappers to focus on defining their specific methods
 * and type conversions.
 */
export abstract class BaseContract {
  protected readonly client: StellarClient;
  protected readonly contractId: string;
  protected readonly wallet: WalletConnector;
  protected readonly transactionSigner: TransactionSigner;

  /**
   * Creates a new BaseContract instance.
   * @param config - Configuration for the contract
   */
  constructor(config: ContractConfig) {
    this.client = config.client;
    this.contractId = config.contractId;
    this.wallet = config.wallet;
    this.transactionSigner = new TransactionSigner({
      client: this.client,
      wallet: this.wallet
    });
  }

  /**
   * Invokes a contract method that modifies state.
   * 
   * This method handles simulation, transaction building, wallet signing, and polling automatically.
   * If a txBuilder is provided, the operation is appended to it and the builder is returned.
   * 
   * @param methodName - The name of the contract method to invoke
   * @param args - Arguments for the contract method
   * @param txBuilder - Optional transaction builder for composite transactions
   * @returns The transaction result, or the transaction builder if provided
   */
  protected async invokeMethod(
    methodName: string,
    args: ContractCallArg[] = [],
    txBuilder?: TransactionBuilder
  ): Promise<TransactionResult | TransactionBuilder> {
    const sourceAccount = await this.wallet.getPublicKey();

    const operation = buildContractCallOperation({
      contractId: this.contractId,
      method: methodName,
      args
    });

    // If txBuilder is provided, append operation and return the builder
    if (txBuilder) {
      txBuilder.addOperation(operation);
      return txBuilder;
    }

    // Otherwise, build and sign the transaction normally
    const contractCall: ContractCallParams = {
      contractId: this.contractId,
      method: methodName,
      args
    };

    return await this.transactionSigner.buildAndSignTransaction({
      sourceAccount,
      operations: [contractCall]
    });
  }

  /**
   * Queries a contract method (read-only).
   * 
   * This method builds a transaction and simulates it to get the return value.
   * 
   * @param methodName - The name of the contract method to query
   * @param args - Arguments for the contract method
   * @param sourceAccount - Optional source account for the query (defaults to wallet public key)
   * @returns The decoded ScVal result from the simulation
   */
  protected async queryMethod(
    methodName: string,
    args: ContractCallArg[] = [],
    sourceAccount?: string
  ): Promise<xdr.ScVal> {
    const targetAccount = sourceAccount ?? await this.wallet.getPublicKey();

    const contractCall: ContractCallParams = {
      contractId: this.contractId,
      method: methodName,
      args
    };

    // Build a read-only transaction for querying
    const transaction = await this.transactionSigner.buildTransaction({
      sourceAccount: targetAccount,
      operations: [contractCall]
    });

    // Simulate to get the result
    const simulation = await this.client.simulateTransaction(transaction);

    if (!rpc.Api.isSimulationSuccess(simulation)) {
      throw new Error(`Query failed: ${simulation.error}`);
    }

    // Extract the return value from simulation
    const result = simulation.results?.[0];
    if (!result) {
      throw new Error("No result in simulation");
    }

    return decodeXdrBase64(result.xdr);
  }

  /**
   * Estimates the optimal fee for a contract method call.
   * 
   * @param methodName - The name of the contract method
   * @param args - Arguments for the contract method
   * @param sourceAccount - Optional source account for estimation (defaults to wallet public key)
   * @returns Estimated fee in stroops
   */
  protected async estimateFee(
    methodName: string,
    args: ContractCallArg[] = [],
    sourceAccount?: string
  ): Promise<number> {
    const targetAccount = sourceAccount ?? await this.wallet.getPublicKey();

    const contractCall: ContractCallParams = {
      contractId: this.contractId,
      method: methodName,
      args
    };

    return await this.transactionSigner.estimateOptimalFee({
      sourceAccount: targetAccount,
      operations: [contractCall]
    });
  }
}
