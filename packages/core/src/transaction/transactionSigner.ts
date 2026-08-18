import {
  Memo,
  Transaction,
  TransactionBuilder,
  rpc,
  xdr
} from "@stellar/stellar-sdk";

import { StellarClient } from "../client/stellarClient";
import { WalletConnector } from "../wallet/walletConnector";
import { NetworkMismatchError } from "../errors/axionveraError";
import {
  buildContractCallOperation,
  bumpTransactionFee,
  ContractCallArg
} from "../utils/transactionBuilder";

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
  simulation?: rpc.Api.SimulateTransactionResponse;
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
  raw: rpc.Api.SimulateTransactionResponse;
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
  private readonly wallet: WalletConnector;
  protected readonly defaultFee: number;
  protected readonly defaultTimeout: number;
  private readonly autoSimulate: boolean;

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
   * Validates that the wallet's network matches the client's network.
   * @throws NetworkMismatchError if networks don't match
   */
  private async validateNetworks(): Promise<void> {
    const walletNetwork = await this.wallet.getNetwork();
    
    if (walletNetwork !== this.client.network) {
      throw new NetworkMismatchError(
        `Network mismatch: Expected ${this.client.network}, but wallet is connected to ${walletNetwork}`
      );
    }
  }

  /**
   * Builds, simulates, signs, and submits a transaction in one operation.
   * @param params - Transaction build parameters
   * @returns The transaction result
   */
  async buildAndSignTransaction(params: TransactionBuildParams): Promise<TransactionResult> {
    // Validate that wallet and client are on the same network
    await this.validateNetworks();

    // Build the transaction
    const transaction = await this.buildTransaction(params);

    // Simulate if enabled
    let simulation: rpc.Api.SimulateTransactionResponse | undefined;
    if (this.autoSimulate) {
      simulation = await this.client.simulateTransaction(transaction);

      if (!rpc.Api.isSimulationSuccess(simulation)) {
        throw new Error(`Transaction simulation failed: ${simulation.error}`);
      }
    }

    // Prepare the transaction with simulation results
    const preparedTransaction = simulation
      ? await this.client.prepareTransaction(transaction)
      : transaction;

    // Sign the transaction
    const signedXdr = await this.wallet.signTransaction(
      preparedTransaction.toXDR(),
      this.client.networkPassphrase
    );

    // Submit the transaction
    const signedTransaction = TransactionBuilder.fromXDR(
      signedXdr,
      this.client.networkPassphrase
    );
    const result = await this.client.sendTransaction(signedTransaction);

    // Poll for completion
    const finalResult = await this.client.pollTransaction(result.hash, {
      ...(params.onProgress !== undefined && { onProgress: params.onProgress }),
    });
    const finalStatus = (finalResult as { status?: string } | null | undefined)?.status ?? 'UNKNOWN';

    return {
      hash: result.hash,
      status: finalStatus,
      successful: finalStatus === 'SUCCESS',
      raw: finalResult,
      signedXdr,
      ...(simulation !== undefined && { simulation })
    };
  }

  /**
   * Builds a transaction without signing or submitting.
   * @param params - Transaction build parameters
   * @returns The built transaction
   */
  async buildTransaction(params: TransactionBuildParams): Promise<Transaction> {
    // Get account information with cache fallback for offline resilience
    const account = await this.client.getAccountWithCache(params.sourceAccount);

    // Build operations
    const operations: xdr.Operation[] = params.operations.map(op =>
      buildContractCallOperation({
        contractId: op.contractId,
        method: op.method,
        ...(op.args !== undefined && { args: op.args })
      })
    );

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

    if (!rpc.Api.isSimulationSuccess(simulation)) {
      return {
        cpuInstructions: 0,
        memoryBytes: 0,
        recommendedFee: this.defaultFee,
        success: false,
        error: simulation.error,
        raw: simulation
      };
    }

    const resources = simulation.transactionData.build().resources();
    const cpuInstructions = resources.instructions();
    const memoryBytes = resources.diskReadBytes() + resources.writeBytes();
    const recommendedFee = Number(simulation.minResourceFee);

    return {
      cpuInstructions,
      memoryBytes,
      recommendedFee,
      success: true,
      raw: simulation
    };
  }

  /**
   * Creates and signs a fee bump transaction.
   * @param params - Fee bump parameters
   * @returns The signed fee bump transaction XDR
   */
  async createFeeBumpTransaction(params: FeeBumpParams): Promise<string> {
    const feeBumpEnvelopeXdr = bumpTransactionFee(
      params.innerTransaction,
      params.baseFee,
      {
        feeSource: params.feeSource,
        networkPassphrase: this.client.networkPassphrase
      }
    );

    // Sign the fee bump transaction
    return await this.wallet.signTransaction(
      feeBumpEnvelopeXdr,
      this.client.networkPassphrase
    );
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
    const signedTransaction = TransactionBuilder.fromXDR(
      signedXdr,
      this.client.networkPassphrase
    );
    const result = await this.client.sendTransaction(signedTransaction);

    const finalResult = await this.client.pollTransaction(result.hash, {
      ...(options?.onProgress !== undefined && { onProgress: options.onProgress }),
    });
    const finalStatus = (finalResult as { status?: string } | null | undefined)?.status ?? 'UNKNOWN';

    return {
      hash: result.hash,
      status: finalStatus,
      successful: finalStatus === 'SUCCESS',
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
