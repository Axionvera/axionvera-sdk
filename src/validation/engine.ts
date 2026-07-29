import * as v from 'valibot';
import { SchemaValidationError } from '../errors';
import type {
  AnyValidationSchema,
  ContractMethodSchema,
  ValidationIssue,
  ValidationKind,
} from '../types';

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

function summarizeIssues(issues: ValidationIssue[]): string {
  return issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ');
}

/**
 * Runs `schema` against `value` and either returns the parsed output or
 * throws a {@link SchemaValidationError} with one descriptive issue per
 * offending field.
 */
export function validateAgainstSchema<TSchema extends AnyValidationSchema>(
  schema: TSchema,
  value: unknown,
  context: { contractId: string; method: string; kind: ValidationKind }
): v.InferOutput<TSchema> {
  const result = v.safeParse(schema, value);
  if (result.success) {
    return result.output;
  }

  const issues = toValidationIssues(result.issues);
  const { contractId, method, kind } = context;
  const label = kind === 'params' ? 'Input' : 'Output';

  throw new SchemaValidationError(
    `${label} validation failed for "${method}" on contract "${contractId}": ${summarizeIssues(issues)}`,
    { contractId, method, kind, issues, originalError: result.issues }
  );
}

/**
 * A registry of per-contract-method schemas that enforces input validation
 * before execution and (optionally) output validation on the returned
 * result, raising {@link SchemaValidationError} with field-level detail on
 * mismatch.
 *
 * Schemas are keyed by a logical `contractId` (e.g. `"Vault"`) rather than a
 * deployed contract address, since the same contract type is usually
 * instantiated multiple times with the same method shapes.
 */
export class ContractValidationEngine {
  private readonly schemas = new Map<string, ContractMethodSchema>();

  private key(contractId: string, method: string): string {
    return `${contractId}::${method}`;
  }

  /**
   * Registers (or replaces) the params/result schema for one contract
   * method. Calling this again for the same `contractId`/`method` pair
   * overwrites the previous registration, which lets consumers register
   * fully custom schemas for any contract — including ones not shipped
   * with the SDK.
   */
  registerSchema<TParams extends AnyValidationSchema, TResult extends AnyValidationSchema>(
    contractId: string,
    method: string,
    schema: ContractMethodSchema<TParams, TResult>
  ): void {
    this.schemas.set(this.key(contractId, method), schema);
  }

  /** Removes a previously registered schema, if any. */
  unregisterSchema(contractId: string, method: string): void {
    this.schemas.delete(this.key(contractId, method));
  }

  /** Returns `true` when a schema has been registered for this method. */
  hasSchema(contractId: string, method: string): boolean {
    return this.schemas.has(this.key(contractId, method));
  }

  /** Returns the raw registered schema, if any, for inspection/tooling. */
  getSchema(contractId: string, method: string): ContractMethodSchema | undefined {
    return this.schemas.get(this.key(contractId, method));
  }

  /**
   * Validates `params` against the registered params schema for
   * `contractId`/`method`. Returns `params` unchanged (cast to `T`) when no
   * schema, or no params schema, is registered — validation is opt-in per
   * method.
   *
   * @throws {@link SchemaValidationError} when `params` does not match the
   * registered schema.
   */
  // T is a caller-supplied type hint: schemas are stored type-erased in the
  // registry, so it cannot be inferred from a parameter the way other
  // generic helpers in this file are.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  validateParams<T>(contractId: string, method: string, params: unknown): T {
    const schema = this.getSchema(contractId, method);
    if (!schema?.params) {
      return params as T;
    }
    return validateAgainstSchema(schema.params, params, {
      contractId,
      method,
      kind: 'params',
    }) as T;
  }

  /**
   * Validates `result` against the registered result schema for
   * `contractId`/`method`. Returns `result` unchanged (cast to `T`) when no
   * schema, or no result schema, is registered.
   *
   * @throws {@link SchemaValidationError} when `result` does not match the
   * registered schema.
   */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- see validateParams
  validateResult<T>(contractId: string, method: string, result: unknown): T {
    const schema = this.getSchema(contractId, method);
    if (!schema?.result) {
      return result as T;
    }
    return validateAgainstSchema(schema.result, result, {
      contractId,
      method,
      kind: 'result',
    }) as T;
  }
}

/**
 * Shared, SDK-wide validation engine. Built-in contract schemas (see
 * `src/contracts/contractSchemas.ts`) register themselves here; consumers
 * can register their own schemas on this same instance, or create an
 * isolated `new ContractValidationEngine()` for tests.
 */
export const defaultValidationEngine = new ContractValidationEngine();

/**
 * Wraps a contract method implementation so that, on every call, its params
 * are validated before `fn` runs and its resolved result is validated
 * before being returned to the caller — using whatever schema is registered
 * for `contractId`/`method` on `engine`.
 *
 * Methods with no registered schema pass through unmodified, so this can be
 * applied unconditionally without requiring every method to have a schema.
 *
 * @example
 * ```typescript
 * class Vault {
 *   deposit = withSchemaValidation(
 *     defaultValidationEngine,
 *     'Vault',
 *     'deposit',
 *     async (params: DepositParams) => {
 *       // ... actual contract call ...
 *     }
 *   );
 * }
 * ```
 */
export function withSchemaValidation<TParams, TResult>(
  engine: ContractValidationEngine,
  contractId: string,
  method: string,
  fn: (params: TParams) => Promise<TResult>
): (params: TParams) => Promise<TResult> {
  return async (params: TParams): Promise<TResult> => {
    const validatedParams = engine.validateParams<TParams>(contractId, method, params);
    const result = await fn(validatedParams);
    return engine.validateResult<TResult>(contractId, method, result);
  };
}
