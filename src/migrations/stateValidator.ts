import * as v from 'valibot';
import { MigrationStateValidationError } from '../errors';
import type { AnyValidationSchema, ValidationIssue } from '../types';

function issuePath(issue: v.BaseIssue<unknown>): string {
  if (!issue.path || issue.path.length === 0) {
    return '(root)';
  }
  return issue.path.map((item) => String(item.key)).join('.');
}

function toValidationIssues(issues: readonly v.BaseIssue<unknown>[]): ValidationIssue[] {
  return issues.map((issue) => ({
    path: issuePath(issue),
    message: issue.message,
    received: issue.input,
  }));
}

/**
 * Registry of per-contract-version state schemas, used to confirm a
 * contract's state matches the shape expected at a given migration version
 * before/after a migration step runs.
 *
 * Mirrors the design of `ContractValidationEngine` (see
 * `src/validation/engine.ts`): schemas are keyed by a logical contract id
 * rather than a deployed address, and validation is opt-in — calling
 * {@link validateState} for a version with no registered schema returns the
 * state unchanged.
 *
 * @example
 * ```typescript
 * const validator = new MigrationStateValidator();
 * validator.registerStateSchema('Vault', 'v1', v.object({ totalAssets: v.bigint() }));
 * validator.validateState('Vault', 'v1', { totalAssets: 100n }); // ok
 * validator.validateState('Vault', 'v1', { totalAssets: 'oops' }); // throws
 * ```
 */
export class MigrationStateValidator {
  private readonly schemas = new Map<string, AnyValidationSchema>();

  private key(contractId: string, version: string): string {
    return `${contractId}::${version}`;
  }

  /** Registers (or replaces) the state schema for one contract version. */
  registerStateSchema(contractId: string, version: string, schema: AnyValidationSchema): void {
    this.schemas.set(this.key(contractId, version), schema);
  }

  /** Removes a previously registered state schema, if any. */
  unregisterStateSchema(contractId: string, version: string): void {
    this.schemas.delete(this.key(contractId, version));
  }

  /** Returns `true` when a schema has been registered for this contract/version. */
  hasStateSchema(contractId: string, version: string): boolean {
    return this.schemas.has(this.key(contractId, version));
  }

  /**
   * Validates `state` against the schema registered for `contractId`/`version`.
   * Returns `state` unchanged (cast to `T`) when no schema is registered.
   *
   * @throws {@link MigrationStateValidationError} when `state` does not match
   * the registered schema.
   */
  // T is a caller-supplied type hint: schemas are stored type-erased in the
  // registry, so it cannot be inferred from a parameter.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  validateState<T>(contractId: string, version: string, state: unknown): T {
    const schema = this.schemas.get(this.key(contractId, version));
    if (!schema) {
      return state as T;
    }

    const result = v.safeParse(schema, state);
    if (result.success) {
      return result.output as T;
    }

    const issues = toValidationIssues(result.issues);
    const summary = issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ');

    throw new MigrationStateValidationError(
      `State validation failed for contract "${contractId}" at version "${version}": ${summary}`,
      { contractId, version, issues, originalError: result.issues }
    );
  }
}

/**
 * Shared, SDK-wide migration state validator. Built-in contract migrations
 * (see `src/contracts/contractMigrations.ts`) register their version schemas
 * here; consumers can register schemas for their own contracts on this same
 * instance, or create an isolated `new MigrationStateValidator()` for tests.
 */
export const defaultMigrationStateValidator = new MigrationStateValidator();
