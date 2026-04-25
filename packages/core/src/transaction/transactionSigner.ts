import {
  Account,
  Address,
  Contract,
  FeeBumpTransaction,
  Keypair,
  Transaction,
  TransactionBuilder,
  rpc,
  xdr,
  Operation,
  Memo
} from "@stellar/stellar-sdk";

import { StellarClient } from "../client/stellarClient";
import { WalletConnector } from "../wallet/walletConnector";
import { buildContractCallOperation, toScVal, ContractCallArg } from "../utils/transactionBuilder";

/**
 * Configuration for building and signing transactions.
 */
export type TransactionSignerConfig = {
  /** The stellar client for network operations */
  client: StellarClient;
  /** The wallet connector for signing */
  wallet: WalletConnector;
  /** Default fee in stroops (default: 100000) */
  defaultFee?: number;
  /** Default timeout in seconds (default: 60) */
  defaultTimeout?: number;
  /** Whether to auto-simulate before signing (default: true) */
  autoSimulate?: boolean;
};

/**
 * Parameters for a contract call operation.
 */
export type ContractCallParams = {
  /** The contract ID to call */
  contractId: string;
  /** The method name to call */
  method: string;
  /** The arguments to pass to the method */
  args?: ContractCallArg[];
};

/**
 * Parameters for building a transaction.
 */
export type TransactionBuildParams = {
  /** The source account for the transaction */
  sourceAccount: string;
  /** Contract call operations to include */
  operations: ContractCallParams[];
  /** The fee for the transaction (overrides default) */
  fee?: number;
  /** Transaction timeout in seconds (overrides default) */
  timeoutInSeconds?: number;
  /** Memo for the transaction */
  memo?: string;

  onProgress?: (status: string, ledger: number) => void | Promise<void>;
};

/**
 * Result of a successful transaction signing and submission.
 */
export type TransactionResult = {
  /** The transaction hash */
  hash: string;
  /** The final status of the transaction */
  status: string;
  /** Whether the transaction was successful */
  successful: boolean;
  /** The raw response from the network */
  raw: unknown;
  /** The signed transaction XDR */
  signedXdr: string;
  /** The simulation result (if available) */
  simulation?: rpc.Api.RawSimulateTransactionResponse;
};

/**
 * Simulation result with resource estimates.
 */
export type SimulationResult = {
  /** CPU instructions required */
  cpuInstructions: number;
  /** Memory bytes required */
  memoryBytes: number;
  /** Recommended fee in stroops */
  recommendedFee: number;
  /** Whether the simulation was successful */
  success: boolean;
  /** Error details if simulation failed */
  error?: string;
  /** Raw simulation response */
  raw: rpc.Api.RawSimulateTransactionResponse;
};

/**
 * Fee bump transaction parameters.
 */
export type FeeBumpParams = {
  /** The inner transaction to fee bump */
  innerTransaction: string;
  /** The fee source account */
  feeSource: string;
  /** The base fee to use */
  baseFee: number;
  /** The max fee to pay */
  maxFee?: number;
};

/**
 * High-level transaction signer that handles building, simulating, and signing Soroban transactions.
 * 
 * This class provides a safe, user-friendly interface for constructing and signing transactions
 * without manual XDR handling. It automatically handles simulation for resource estimation,
 * fee calculation, and supports both local keypairs and external wallet providers.
 * 
 * @example
 * ```typescript
 * const signer = new TransactionSigner({ client, wallet });
 * 
 * const result = await signer.buildAndSignTransaction({
 *   sourceAccount: "G...",
 *   operations: [
 *     {
 *       contractId: "C...",
 *       method: "deposit",
 *       args: [1000n]
 *     }
 *   ]
 * });
 * ```
 */
export class TransactionSigner {
  protected readonly client: StellarClient;
  protected readonly wallet: WalletConnector;
  protected readonly defaultFee: number;
  protected readonly defaultTimeout: number;
  protected readonly autoSimulate: boolean;

  /**
   * Creates a new TransactionSigner instance.
   * @param config - Configuration for the transaction signer
   */
  constructor(config: TransactionSignerConfig) {
    this.client = config.client;
    this.wallet = config.wallet;
    this.defaultFee = config.defaultFee ?? 100_000;
    this.defaultTimeout = config.defaultTimeout ?? 60;
    this.autoSimulate = config.autoSimulate ?? true;
  }

  /**
   * Builds, simulates, signs, and submits a transaction in one operation.
   * @param params - Transaction build parameters
   * @returns The transaction result
   */
  async buildAndSignTransaction(params: TransactionBuildParams): Promise<TransactionResult> {
    // Build the transaction
    const transaction = await this.buildTransaction(params);

    // Simulate if enabled
    let simulation: rpc.Api.RawSimulateTransactionResponse | undefined;
    if (this.autoSimulate) {
      simulation = await this.client.simulateTransaction(transaction);

      if (simulation.error) {
        throw new Error(`Transaction simulation failed: ${simulation.error}`);
      }
    }

    // Prepare the transaction (fills in Soroban tx data, sequence, etc.)
    const preparedTransaction = await this.client.prepareTransaction(transaction);

    // Sign the transaction
    const signedXdr = await this.wallet.signTransaction(
      preparedTransaction.toXDR(),
      this.client.networkPassphrase
    );

    // Submit the transaction
    const signedTx = TransactionBuilder.fromXDR(signedXdr, this.client.networkPassphrase);
    const result = await this.client.sendTransaction(signedTx);

    // Poll for completion
    const pollParams: Parameters<typeof this.client.pollTransaction>[1] = {};
    if (params.onProgress) {
      pollParams.onProgress = params.onProgress;
    }
    const finalResult = await this.client.pollTransaction(result.hash, pollParams);

    const txResult: TransactionResult = {
      hash: result.hash,
      status: (finalResult as any)?.status ?? "UNKNOWN",
      successful: ((finalResult as any)?.status ?? "UNKNOWN") === "SUCCESS",
      raw: finalResult,
      signedXdr,
    };
    if (simulation) {
      txResult.simulation = simulation;
    }
    return txResult;
  }

  /**
   * Builds a transaction without signing or submitting.
   * @param params - Transaction build parameters
   * @returns The built transaction
   */
  async buildTransaction(params: TransactionBuildParams): Promise<Transaction> {
    // Get account information
    const account = await this.client.rpc.getAccount(params.sourceAccount);

    // Build operations
    const operations = params.operations.map(op => {
      const opParams: Parameters<typeof buildContractCallOperation>[0] = {
        contractId: op.contractId,
        method: op.method,
      };
      if (op.args) {
        opParams.args = op.args;
      }
      return buildContractCallOperation(opParams);
    });

    // Start building the transaction
    let builder = new TransactionBuilder(account, {
      fee: (params.fee ?? this.defaultFee).toString(),
      networkPassphrase: this.client.networkPassphrase
    });

    // Add operations
    operations.forEach(op => builder.addOperation(op));

    // Add memo if provided
    if (params.memo) {
      builder = builder.addMemo(Memo.text(params.memo));
    }

    // Set timeout
    const timeout = params.timeoutInSeconds ?? this.defaultTimeout;
    return builder.setTimeout(timeout).build();
  }

  /**
   * Simulates a transaction to estimate resource requirements.
   * @param params - Transaction build parameters
   * @returns The simulation result
   */
  async simulateTransaction(params: TransactionBuildParams): Promise<SimulationResult> {
    const transaction = await this.buildTransaction(params);
    const simulation = await this.client.simulateTransaction(transaction);

    if (simulation.error) {
      const fail: SimulationResult = {
        cpuInstructions: 0,
        memoryBytes: 0,
        recommendedFee: this.defaultFee,
        success: false,
        raw: simulation,
      };
      if (simulation.error) {
        fail.error = simulation.error;
      }
      return fail;
    }

    // Raw simulation responses don't expose cpu/memory metrics in the typed surface.
    // We can still suggest a fee from Soroban's minResourceFee when present.
    const minResourceFee = simulation.minResourceFee ? Number.parseInt(simulation.minResourceFee, 10) : undefined;

    return {
      cpuInstructions: 0,
      memoryBytes: 0,
      recommendedFee: Number.isFinite(minResourceFee) ? (minResourceFee as number) : this.defaultFee,
      success: true,
      raw: simulation,
    };
  }

  /**
   * Creates and signs a fee bump transaction.
   * @param params - Fee bump parameters
   * @returns The signed fee bump transaction XDR
   */
  async createFeeBumpTransaction(params: FeeBumpParams): Promise<string> {
    // Fee-bump transaction construction differs across stellar-sdk versions.
    // Keep this method explicitly unsupported until implemented with tests.
    void params;
    throw new Error("Fee bump transactions are not supported in this SDK build yet.");
  }

  /**
   * Submits a pre-signed transaction to the network.
   * @param signedXdr - The signed transaction XDR
   * @returns The transaction result
   */
  async submitSignedTransaction(
    signedXdr: string,
    options?: {
      onProgress?: (status: string, ledger: number) => void | Promise<void>;
    }
  ): Promise<TransactionResult> {
    const signedTx = TransactionBuilder.fromXDR(signedXdr, this.client.networkPassphrase);
    const result = await this.client.sendTransaction(signedTx);

    const pollParams: Parameters<typeof this.client.pollTransaction>[1] = {};
    if (options?.onProgress) {
      pollParams.onProgress = options.onProgress;
    }
    const finalResult = await this.client.pollTransaction(result.hash, pollParams);

    return {
      hash: result.hash,
      status: (finalResult as any)?.status ?? "UNKNOWN",
      successful: ((finalResult as any)?.status ?? "UNKNOWN") === "SUCCESS",
      raw: finalResult,
      signedXdr
    };
  }

  /**
   * Gets the public key of the connected wallet.
   * @returns The public key
   */
  async getPublicKey(): Promise<string> {
    return await this.wallet.getPublicKey();
  }

  /**
   * Estimates the optimal fee for a transaction based on simulation.
   * @param params - Transaction build parameters
   * @returns The recommended fee in stroops
   */
  async estimateOptimalFee(params: TransactionBuildParams): Promise<number> {
    const simulation = await this.simulateTransaction(params);

    if (!simulation.success) {
      throw new Error(`Fee estimation failed: ${simulation.error}`);
    }

    return simulation.recommendedFee;
  }
}
