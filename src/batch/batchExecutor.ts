import { TransactionBuilder } from '@stellar/stellar-sdk';
import { BatchExecutionError, BatchValidationError, SimulationFailedError } from '../errors';
import type { BatchConfig, BatchResult, BatchTransaction, BatchTransactionResult } from './types';
import { batchValidator } from './batchValidator';

/**
 * Signature of a function that can simulate and submit a single Stellar
 * transaction. The SDK's {@link StellarClient} satisfies this contract.
 */
export type BatchRpcClient = {
  simulateTransaction(tx: unknown): Promise<unknown>;
  sendTransaction(tx: unknown): Promise<unknown>;
};

/**
 * Executes a batch of transactions sequentially, respecting dependencies
 * and the configured failure policy.
 *
 * @example
 * ```typescript
 * const executor = new BatchExecutor(client);
 * const result = await executor.execute(transactions, config);
 *
 * if (result.allSucceeded) {
 *   console.log(`All ${result.successCount} transactions completed`);
 * } else {
 *   console.error(`${result.failureCount} failures`);
 *   for (const tx of result.transactions) {
 *     if (!tx.success) {
 *       console.error(`  ${tx.label}: ${tx.error?.message}`);
 *     }
 *   }
 * }
 * ```
 */
export class BatchExecutor {
  private readonly rpcClient: BatchRpcClient;

  constructor(rpcClient: BatchRpcClient) {
    this.rpcClient = rpcClient;
  }

  /**
   * Validates and executes the entire batch sequentially.
   *
   * @param transactions - Ordered list of batch transactions
   * @param config - Batch execution configuration
   * @returns A {@link BatchResult} summarising the outcome of every transaction
   */
  async execute(
    transactions: BatchTransaction[],
    config: BatchConfig
  ): Promise<BatchResult> {
    // Pre-execution validation
    const validation = batchValidator.validate(transactions, config);
    if (!validation.valid) {
      throw new BatchValidationError(validation);
    }

    const batchStart = Date.now();
    const results: BatchTransactionResult[] = [];
    const skippedIndices: number[] = [];
    const completedIndices = new Set<number>();

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];

      // Check if we should stop due to a previous failure
      if (config.stopOnFailure === true && results.some((r) => !r.success)) {
        skippedIndices.push(i);
        results.push({
          index: i,
          label: tx.label,
          success: false,
          error: {
            name: 'BatchSkippedError',
            message: `Skipped due to stopOnFailure after a previous transaction failed`,
          },
          durationMs: 0,
        });
        continue;
      }

      // Check dependency satisfaction
      if (tx.dependencies && tx.dependencies.length > 0) {
        const unmet = tx.dependencies.filter((dep) => !completedIndices.has(dep.dependsOnIndex));
        if (unmet.length > 0) {
          const unmetLabels = unmet.map((d) => `index ${d.dependsOnIndex}`).join(', ');
          results.push({
            index: i,
            label: tx.label,
            success: false,
            error: {
              name: 'DependencyNotMetError',
              message: `Transaction "${tx.label}" has unmet dependencies: ${unmetLabels}`,
            },
            durationMs: 0,
          });
          if (config.stopOnFailure) {
            // Remaining transactions will be skipped on the next iteration
          }
          continue;
        }
      }

      // Execute this transaction
      const txResult = await this.executeTransaction(tx, config, i);
      results.push(txResult);

      if (txResult.success) {
        completedIndices.add(i);
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success && !skippedIndices.includes(r.index)).length;
    const skippedCount = skippedIndices.length;

    return {
      totalCount: transactions.length,
      successCount,
      failureCount,
      skippedCount,
      transactions: results,
      totalDurationMs: Date.now() - batchStart,
      allSucceeded: successCount === transactions.length,
      skippedIndices,
    };
  }

  // ── Private helpers ────────────────────────────────────────────

  private async executeTransaction(
    tx: BatchTransaction,
    config: BatchConfig,
    index: number
  ): Promise<BatchTransactionResult> {
    const txStart = Date.now();

    try {
      const operationCount = tx.operations.length;
      const feePerOp = config.feePerOperation ?? 100_000;
      const totalFee = (feePerOp * operationCount).toString();

      const builder = new TransactionBuilder(config.sourceAccount, {
        fee: totalFee,
        networkPassphrase: config.networkPassphrase,
      });

      for (const op of tx.operations) {
        builder.addOperation(op);
      }

      const stellarTx = builder.setTimeout(config.timeoutInSeconds ?? 60).build();

      // Simulate first
      const simResult = await this.rpcClient.simulateTransaction(stellarTx);

      // TypeScript can't import rpc at the top level without a direct dependency
      // in this module, so we duck-type the simulation error check.
      const simResultAny = simResult as Record<string, unknown>;
      if (simResultAny.error) {
        throw new SimulationFailedError(
          typeof simResultAny.error === 'string'
            ? simResultAny.error
            : 'Simulation returned an error',
          { simulationResult: simResultAny }
        );
      }

      const durationMs = Date.now() - txStart;

      return {
        index,
        label: tx.label,
        success: true,
        result: simResultAny.result ?? simResult,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - txStart;
      return {
        index,
        label: tx.label,
        success: false,
        error: {
          name: error instanceof Error ? error.name : 'Error',
          message: error instanceof Error ? error.message : String(error),
        },
        durationMs,
      };
    }
  }
}
