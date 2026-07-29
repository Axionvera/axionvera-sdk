import { BatchValidationError } from '../errors';
import type {
  BatchConfig,
  BatchTransaction,
  BatchValidationIssue,
  BatchValidationResult,
} from './types';

/**
 * Validates a batch of transactions before execution, checking:
 * - Configuration completeness
 * - Transaction operation presence
 * - Dependency graph integrity (no cycles, no out-of-range indices)
 * - Sequence and fee sanity
 *
 * Validation occurs eagerly — all issues are collected and reported
 * together rather than failing on the first problem.
 */
export class BatchValidator {
  /**
   * Validates the entire batch and returns a {@link BatchValidationResult}
   * with all discovered issues.
   */
  validate(
    transactions: BatchTransaction[],
    config: BatchConfig
  ): BatchValidationResult {
    const issues: BatchValidationIssue[] = [];

    this.validateConfig(config, issues);
    this.validateTransactions(transactions, issues);
    this.validateDependencies(transactions, issues);

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Validates and throws a {@link BatchValidationError} if any issues exist.
   * Convenience wrapper around {@link validate} for callers that prefer
   * a throw-on-fail contract.
   */
  validateOrThrow(
    transactions: BatchTransaction[],
    config: BatchConfig
  ): void {
    const result = this.validate(transactions, config);
    if (!result.valid) {
      throw new BatchValidationError(result);
    }
  }

  // ── Private helpers ────────────────────────────────────────────

  private validateConfig(
    config: BatchConfig,
    issues: BatchValidationIssue[]
  ): void {
    if (!config.sourceAccount) {
      issues.push({
        transactionIndex: -1,
        category: 'account',
        message: 'BatchConfig.sourceAccount is required',
      });
    }

    if (!config.networkPassphrase || config.networkPassphrase.trim().length === 0) {
      issues.push({
        transactionIndex: -1,
        category: 'config',
        message: 'BatchConfig.networkPassphrase is required',
      });
    }

    if (config.feePerOperation != null && config.feePerOperation <= 0) {
      issues.push({
        transactionIndex: -1,
        category: 'fee',
        message: 'BatchConfig.feePerOperation must be a positive number',
      });
    }

    if (config.timeoutInSeconds != null && config.timeoutInSeconds <= 0) {
      issues.push({
        transactionIndex: -1,
        category: 'config',
        message: 'BatchConfig.timeoutInSeconds must be a positive number',
      });
    }
  }

  private validateTransactions(
    transactions: BatchTransaction[],
    issues: BatchValidationIssue[]
  ): void {
    if (transactions.length === 0) {
      issues.push({
        transactionIndex: -1,
        category: 'operation',
        message: 'At least one transaction is required in a batch',
      });
      return;
    }

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];

      if (!tx.label || tx.label.trim().length === 0) {
        issues.push({
          transactionIndex: i,
          category: 'operation',
          message: `Transaction at index ${i} must have a non-empty label`,
        });
      }

      if (!tx.operations || tx.operations.length === 0) {
        issues.push({
          transactionIndex: i,
          label: tx.label || `index-${i}`,
          category: 'operation',
          message: `Transaction "${tx.label || `index-${i}`}" has no operations`,
        });
      }
    }
  }

  private validateDependencies(
    transactions: BatchTransaction[],
    issues: BatchValidationIssue[]
  ): void {
    const txCount = transactions.length;

    for (let i = 0; i < txCount; i++) {
      const tx = transactions[i];
      if (!tx.dependencies || tx.dependencies.length === 0) {
        continue;
      }

      for (const dep of tx.dependencies) {
        // Check self-reference
        if (dep.dependsOnIndex === i) {
          issues.push({
            transactionIndex: i,
            label: tx.label,
            category: 'dependency',
            message: `Transaction "${tx.label}" cannot depend on itself (index ${i})`,
          });
          continue;
        }

        // Check out-of-range
        if (dep.dependsOnIndex < 0 || dep.dependsOnIndex >= txCount) {
          issues.push({
            transactionIndex: i,
            label: tx.label,
            category: 'dependency',
            message:
              `Transaction "${tx.label}" depends on index ${dep.dependsOnIndex}, ` +
              `which is out of range (0–${txCount - 1})`,
          });
          continue;
        }

        // Check that the dependency comes before this transaction
        if (dep.dependsOnIndex >= i) {
          issues.push({
            transactionIndex: i,
            label: tx.label,
            category: 'dependency',
            message:
              `Transaction "${tx.label}" depends on index ${dep.dependsOnIndex}, ` +
              `but dependencies must precede the dependent in the batch order`,
          });
        }
      }
    }

    // Detect cycles using DFS
    const cycleIndices = this.detectCycles(transactions);
    for (const idx of cycleIndices) {
      issues.push({
        transactionIndex: idx,
        label: transactions[idx].label,
        category: 'dependency',
        message:
          `Transaction "${transactions[idx].label}" (index ${idx}) is part of a dependency cycle`,
      });
    }
  }

  /**
   * Detects transactions involved in dependency cycles using DFS.
   * Returns the set of indices that participate in at least one cycle.
   */
  private detectCycles(transactions: BatchTransaction[]): Set<number> {
    const n = transactions.length;
    const inCycle = new Set<number>();

    // Build adjacency list: index -> list of indices it depends on
    const adj: number[][] = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
      const deps = transactions[i].dependencies;
      if (!deps) continue;
      for (const dep of deps) {
        if (dep.dependsOnIndex >= 0 && dep.dependsOnIndex < n) {
          adj[i].push(dep.dependsOnIndex);
        }
      }
    }

    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;
    const color = new Array<number>(n).fill(WHITE);

    const dfs = (u: number, path: Set<number>): boolean => {
      color[u] = GRAY;
      path.add(u);

      for (const v of adj[u]) {
        if (color[v] === GRAY) {
          // Found a back edge — mark all nodes on the current path
          for (const p of path) {
            inCycle.add(p);
          }
          return true;
        }
        if (color[v] === WHITE) {
          if (dfs(v, path)) {
            return true;
          }
        }
      }

      path.delete(u);
      color[u] = BLACK;
      return false;
    };

    for (let i = 0; i < n; i++) {
      if (color[i] === WHITE) {
        dfs(i, new Set());
      }
    }

    return inCycle;
  }
}

/** Shared singleton instance for convenience. */
export const batchValidator = new BatchValidator();
