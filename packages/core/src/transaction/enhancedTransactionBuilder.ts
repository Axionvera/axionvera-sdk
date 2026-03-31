/**
 * Enhanced transaction builder with additional utilities for complex scenarios.
 * 
 * This module provides utilities for building multi-operation transactions,
 * handling edge cases, and managing transaction lifecycle.
 */

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
  Memo,
  MemoType
} from "@stellar/stellar-sdk";

import { StellarClient } from "../client/stellarClient";
import { WalletConnector } from "../wallet/walletConnector";
import { ContractCallParams, TransactionSigner, TransactionBuildParams, ContractCallArg } from "./transactionSigner";
import { buildContractCallOperation, toScVal } from "../utils/transactionBuilder";

/**
 * Parameters for building multi-step transactions.
 */
export type MultiStepTransactionParams = {
  /** The source account for the transaction */
  sourceAccount: string;
  /** Array of contract calls to execute in sequence */
  steps: ContractCallParams[];
  /** Whether to continue on failure (default: false) */
  continueOnError?: boolean;
  /** Custom fee per operation (default: uses signer default) */
  feePerOperation?: number;
  /** Transaction timeout in seconds */
  timeoutInSeconds?: number;
  /** Memo for the transaction */
  memo?: string;
};

/**
 * Parameters for batch transaction processing.
 */
export type BatchTransactionParams = {
  /** Array of transactions to process */
  transactions: TransactionBuildParams[];
  /** Whether to process in parallel (default: false) */
  parallel?: boolean;
  /** Delay between transactions in milliseconds (for sequential processing) */
  delayBetween?: number;
};

/**
 * Result of batch transaction processing.
 */
export type BatchTransactionResult = {
  /** Array of individual transaction results */
  results: TransactionResult[];
  /** Summary statistics */
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
};

/**
 * Enhanced transaction builder with support for complex scenarios.
 */
export class EnhancedTransactionBuilder extends TransactionSigner {
  /**
   * Builds and signs a multi-step transaction with multiple contract calls.
   * @param params - Multi-step transaction parameters
   * @returns The transaction result
   */
  async buildAndSignMultiStepTransaction(params: MultiStepTransactionParams): Promise<TransactionResult> {
    // Calculate total fee
    const totalFee = (params.feePerOperation ?? this.defaultFee) * params.steps.length;
    
    // Build as a single transaction with multiple operations
    const buildParams: TransactionBuildParams = {
      sourceAccount: params.sourceAccount,
      operations: params.steps,
      fee: totalFee,
      timeoutInSeconds: params.timeoutInSeconds,
      memo: params.memo
    };

    return await this.buildAndSignTransaction(buildParams);
  }

  /**
   * Processes multiple transactions in batch.
   * @param params - Batch transaction parameters
   * @returns The batch transaction result
   */
  async processBatchTransactions(params: BatchTransactionParams): Promise<BatchTransactionResult> {
    const results: TransactionResult[] = [];
    const parallel = params.parallel ?? false;

    if (parallel) {
      // Process all transactions in parallel
      const promises = params.transactions.map(tx => 
        this.buildAndSignTransaction(tx).catch(error => ({
          hash: '',
          status: 'FAILED',
          successful: false,
          raw: { error: error.message },
          signedXdr: ''
        }))
      );
      
      const resolvedResults = await Promise.all(promises);
      results.push(...resolvedResults as TransactionResult[]);
    } else {
      // Process transactions sequentially
      for (const txParams of params.transactions) {
        try {
          const result = await this.buildAndSignTransaction(txParams);
          results.push(result);
          
          // Add delay if specified
          if (params.delayBetween && params.delayBetween > 0) {
            await new Promise(resolve => setTimeout(resolve, params.delayBetween));
          }
        } catch (error) {
          results.push({
            hash: '',
            status: 'FAILED',
            successful: false,
            raw: { error: error instanceof Error ? error.message : 'Unknown error' },
            signedXdr: ''
          });
        }
      }
    }

    // Calculate summary
    const summary = {
      total: results.length,
      successful: results.filter(r => r.successful).length,
      failed: results.filter(r => !r.successful).length
    };

    return { results, summary };
  }

  /**
   * Creates a transaction with conditional operations.
   * @param sourceAccount - The source account
   * @param operations - Array of operations with conditions
   * @returns The built transaction
   */
  async buildConditionalTransaction(
    sourceAccount: string,
    operations: Array<{
      operation: ContractCallParams;
      condition?: (simulation: rpc.SimulateTransactionResponse) => boolean;
    }>
  ): Promise<Transaction> {
    // Build initial transaction
    const buildParams: TransactionBuildParams = {
      sourceAccount,
      operations: operations.map(op => op.operation)
    };

    const transaction = await this.buildTransaction(buildParams);
    
    // Simulate to check conditions
    const simulation = await this.client.simulateTransaction(transaction);
    
    if (!rpc.Api.isSimulationSuccess(simulation)) {
      throw new Error(`Conditional transaction simulation failed: ${simulation.error}`);
    }

    // Filter operations based on conditions
    const filteredOperations = operations.filter((op, index) => {
      if (!op.condition) return true;
      
      const operationResult = simulation.results?.[index];
      if (!operationResult) return false;
      
      return op.condition(simulation);
    });

    // Rebuild transaction with filtered operations
    if (filteredOperations.length === 0) {
      throw new Error('All operations were filtered out by conditions');
    }

    const filteredParams: TransactionBuildParams = {
      sourceAccount,
      operations: filteredOperations.map(op => op.operation)
    };

    return await this.buildTransaction(filteredParams);
  }

  /**
   * Creates a transaction with time-locked operations.
   * @param sourceAccount - The source account
   * @param operations - Array of operations with time locks
   * @returns The built transaction
   */
  async buildTimeLockedTransaction(
    sourceAccount: string,
    operations: Array<{
      operation: ContractCallParams;
      unlockTime: Date;
    }>
  ): Promise<Transaction> {
    // Check if any operations are still time-locked
    const now = new Date();
    const availableOperations = operations.filter(op => op.unlockTime <= now);
    
    if (availableOperations.length === 0) {
      throw new Error('All operations are still time-locked');
    }

    const buildParams: TransactionBuildParams = {
      sourceAccount,
      operations: availableOperations.map(op => op.operation),
      memo: `Time-locked tx: ${availableOperations.length}/${operations.length} ops available`
    };

    return await this.buildTransaction(buildParams);
  }

  /**
   * Estimates the cost of a batch of transactions.
   * @param transactions - Array of transaction parameters
   * @returns Array of cost estimates
   */
  async estimateBatchCost(transactions: TransactionBuildParams[]): Promise<Array<{
    transaction: TransactionBuildParams;
    estimatedFee: number;
    estimatedCpu: number;
    estimatedMemory: number;
  }>> {
    const estimates = await Promise.all(
      transactions.map(async (tx) => {
        try {
          const simulation = await this.simulateTransaction(tx);
          return {
            transaction: tx,
            estimatedFee: simulation.recommendedFee,
            estimatedCpu: simulation.cpuInstructions,
            estimatedMemory: simulation.memoryBytes
          };
        } catch (error) {
          return {
            transaction: tx,
            estimatedFee: this.defaultFee,
            estimatedCpu: 0,
            estimatedMemory: 0
          };
        }
      })
    );

    return estimates;
  }

  /**
   * Creates a transaction with a custom memo.
   * @param sourceAccount - The source account
   * @param operations - Array of operations
   * @param memo - Memo configuration
   * @returns The built transaction
   */
  async buildTransactionWithMemo(
    sourceAccount: string,
    operations: ContractCallParams[],
    memo: {
      type: 'text' | 'id' | 'hash' | 'return';
      value: string | Buffer;
    }
  ): Promise<Transaction> {
    const buildParams: TransactionBuildParams = {
      sourceAccount,
      operations,
      memo: memo.type === 'text' ? memo.value as string : undefined
    };

    const transaction = await this.buildTransaction(buildParams);
    
    // Replace the memo if it's not a text memo
    if (memo.type !== 'text') {
      const account = await this.client.rpc.getAccount(sourceAccount);
      
      let memoObj: Memo;
      switch (memo.type) {
        case 'id':
          memoObj = Memo.id(memo.value.toString());
          break;
        case 'hash':
          memoObj = Memo.hash(memo.value as Buffer);
          break;
        case 'return':
          memoObj = Memo.return(memo.value as Buffer);
          break;
        default:
          throw new Error(`Unsupported memo type: ${memo.type}`);
      }

      return new TransactionBuilder(account, {
        fee: this.defaultFee.toString(),
        networkPassphrase: this.client.networkPassphrase
      })
        .addMemo(memoObj)
        .setTimeout(this.defaultTimeout)
        .build();
    }

    return transaction;
  }

  /**
   * Validates a transaction before signing.
   * @param transaction - The transaction to validate
   * @returns Validation result
   */
  async validateTransaction(transaction: Transaction): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Simulate the transaction
      const simulation = await this.client.simulateTransaction(transaction);
      
      if (!rpc.Api.isSimulationSuccess(simulation)) {
        errors.push(`Simulation failed: ${simulation.error}`);
      }

      // Check fee
      const fee = parseInt(transaction.fee);
      if (fee < 100) {
        warnings.push('Transaction fee is very low, may not be accepted');
      }

      // Check operations
      if (transaction.operations.length === 0) {
        errors.push('Transaction has no operations');
      }

      // Check timeout
      if (transaction.timeBounds?.maxTime === 0) {
        warnings.push('Transaction has no timeout');
      }

    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}
