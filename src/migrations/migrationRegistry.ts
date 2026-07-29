import { MigrationPathNotFoundError } from '../errors';
import type { AnyMigrationStep, MigrationPlan, MigrationStepDefinition } from '../types';

/**
 * Registry of migration steps for one or more contracts, keyed by contract
 * id. Steps are registered as version-to-version edges; {@link resolvePath}
 * finds an ordered chain of steps connecting `fromVersion` to `toVersion`,
 * even when no single step covers the whole jump (e.g. `v1 -> v2 -> v3`).
 *
 * @example
 * ```typescript
 * const registry = new MigrationRegistry();
 * registry.register('Vault', {
 *   id: 'vault-v1-to-v2',
 *   fromVersion: 'v1',
 *   toVersion: 'v2',
 *   migrate: (state: VaultStateV1) => ({ ...state, apy: 0 }),
 * });
 * const plan = registry.resolvePath('Vault', 'v1', 'v2');
 * ```
 */
export class MigrationRegistry {
  private readonly stepsByContract = new Map<string, AnyMigrationStep[]>();

  /** Registers a migration step for `contractId`. Replaces any existing step with the same id. */
  register<TFrom, TTo>(contractId: string, step: MigrationStepDefinition<TFrom, TTo>): void {
    const steps = this.stepsByContract.get(contractId) ?? [];
    const next = steps.filter((existing) => existing.id !== step.id);
    next.push(step as unknown as AnyMigrationStep);
    this.stepsByContract.set(contractId, next);
  }

  /** Removes a previously registered step by id. Returns `false` if it wasn't registered. */
  unregister(contractId: string, stepId: string): boolean {
    const steps = this.stepsByContract.get(contractId);
    if (!steps) return false;

    const next = steps.filter((existing) => existing.id !== stepId);
    const removed = next.length !== steps.length;
    this.stepsByContract.set(contractId, next);
    return removed;
  }

  /** Returns every step registered for `contractId`, in registration order. */
  listSteps(contractId: string): AnyMigrationStep[] {
    return [...(this.stepsByContract.get(contractId) ?? [])];
  }

  /**
   * Resolves an ordered chain of steps that take `contractId`'s state from
   * `fromVersion` to `toVersion`, traversing multi-hop chains via
   * breadth-first search over registered version edges. Returns an empty
   * plan when `fromVersion === toVersion`.
   *
   * @throws {@link MigrationPathNotFoundError} when no such chain exists.
   */
  resolvePath(contractId: string, fromVersion: string, toVersion: string): MigrationPlan {
    if (fromVersion === toVersion) {
      return { contractId, fromVersion, toVersion, steps: [] };
    }

    const edgesByFrom = new Map<string, AnyMigrationStep[]>();
    for (const step of this.listSteps(contractId)) {
      const bucket = edgesByFrom.get(step.fromVersion) ?? [];
      bucket.push(step);
      edgesByFrom.set(step.fromVersion, bucket);
    }

    const visited = new Set<string>([fromVersion]);
    const queue: { version: string; path: AnyMigrationStep[] }[] = [
      { version: fromVersion, path: [] },
    ];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;

      for (const edge of edgesByFrom.get(current.version) ?? []) {
        if (edge.toVersion === toVersion) {
          return { contractId, fromVersion, toVersion, steps: [...current.path, edge] };
        }
        if (!visited.has(edge.toVersion)) {
          visited.add(edge.toVersion);
          queue.push({ version: edge.toVersion, path: [...current.path, edge] });
        }
      }
    }

    throw new MigrationPathNotFoundError(contractId, fromVersion, toVersion);
  }
}

/**
 * Shared, SDK-wide migration registry. Built-in contract migrations (see
 * `src/contracts/contractMigrations.ts`) register themselves here; consumers
 * can register their own steps on this same instance, or create an isolated
 * `new MigrationRegistry()` for tests.
 */
export const defaultMigrationRegistry = new MigrationRegistry();
