import { MigrationRegistry, defaultMigrationRegistry } from './migrationRegistry';
import { MigrationStateValidator, defaultMigrationStateValidator } from './stateValidator';
import { MigrationStatus, MigrationStepStatus } from '../types';
import type {
  AnyMigrationStep,
  MigrationContext,
  MigrationPlan,
  MigrationReport,
  MigrationStepResult,
  RunMigrationOptions,
  RunMigrationResult,
} from '../types';

function toErrorInfo(error: unknown): { name: string; message: string } {
  return {
    name: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message : String(error),
  };
}

interface RollbackOutcome<TState> {
  state: TState;
  results: MigrationStepResult[];
  allRolledBack: boolean;
}

/**
 * Executes a resolved chain of migration steps against an in-memory contract
 * state snapshot, validating state shape before/after each step (when
 * schemas are registered) and producing a {@link MigrationReport}.
 *
 * This runner never performs network I/O or signs/submits transactions — it
 * operates purely on the state value handed to it, so fetching the
 * pre-migration state and persisting the post-migration state is left to the
 * caller. This keeps automatic on-chain contract upgrades out of scope while
 * still giving consumers a reliable way to drive and audit a migration.
 *
 * @example
 * ```typescript
 * const runner = new MigrationRunner();
 * const { state, report } = await runner.migrate('Vault', initialState, 'v1', 'v2');
 * console.log(report.status); // MigrationStatus.COMPLETED
 * ```
 */
export class MigrationRunner {
  private readonly registry: MigrationRegistry;
  private readonly stateValidator: MigrationStateValidator;

  constructor(
    registry: MigrationRegistry = defaultMigrationRegistry,
    stateValidator: MigrationStateValidator = defaultMigrationStateValidator
  ) {
    this.registry = registry;
    this.stateValidator = stateValidator;
  }

  /** Resolves a step chain via the registry, then runs it. See {@link run}. */
  async migrate<TState>(
    contractId: string,
    initialState: TState,
    fromVersion: string,
    toVersion: string,
    options: RunMigrationOptions = {}
  ): Promise<RunMigrationResult<TState>> {
    const plan = this.registry.resolvePath(contractId, fromVersion, toVersion);
    return this.run(plan, initialState, options);
  }

  /** Runs an already-resolved {@link MigrationPlan} against `initialState`. */
  async run<TState>(
    plan: MigrationPlan,
    initialState: TState,
    options: RunMigrationOptions = {}
  ): Promise<RunMigrationResult<TState>> {
    const dryRun = options.dryRun ?? false;
    const shouldValidateState = options.validateState ?? true;
    const context: MigrationContext = {
      contractId: plan.contractId,
      dryRun,
      metadata: options.metadata,
    };

    const startedAt = Date.now();
    const stepResults: MigrationStepResult[] = [];
    const completedSteps: AnyMigrationStep[] = [];

    // Always threads the simulated state forward between steps — even in a
    // dry run — so step N's pre-validation checks step N-1's actual output
    // shape rather than the unmodified initial state. Only the value
    // returned to the caller is held back when `dryRun` is set.
    let state = initialState;
    let failure: unknown;

    for (const step of plan.steps) {
      const stepStartedAt = Date.now();
      try {
        if (shouldValidateState) {
          this.stateValidator.validateState(plan.contractId, step.fromVersion, state);
        }

        const nextState = (await step.migrate(state, context)) as TState;

        if (shouldValidateState) {
          this.stateValidator.validateState(plan.contractId, step.toVersion, nextState);
        }

        state = nextState;
        completedSteps.push(step);
        stepResults.push({
          stepId: step.id,
          fromVersion: step.fromVersion,
          toVersion: step.toVersion,
          status: MigrationStepStatus.SUCCEEDED,
          startedAt: stepStartedAt,
          finishedAt: Date.now(),
          durationMs: Date.now() - stepStartedAt,
        });
      } catch (error) {
        stepResults.push({
          stepId: step.id,
          fromVersion: step.fromVersion,
          toVersion: step.toVersion,
          status: MigrationStepStatus.FAILED,
          startedAt: stepStartedAt,
          finishedAt: Date.now(),
          durationMs: Date.now() - stepStartedAt,
          error: toErrorInfo(error),
        });
        failure = error;
        break;
      }
    }

    let status = failure ? MigrationStatus.FAILED : MigrationStatus.COMPLETED;
    let rollbackSteps: MigrationStepResult[] | undefined;

    if (failure && options.rollbackOnFailure && !dryRun) {
      const outcome = await this.rollback(completedSteps, state, context);
      state = outcome.state;
      rollbackSteps = outcome.results;
      if (outcome.allRolledBack) {
        status = MigrationStatus.ROLLED_BACK;
      }
    }

    const finishedAt = Date.now();
    const report: MigrationReport = {
      contractId: plan.contractId,
      fromVersion: plan.fromVersion,
      toVersion: plan.toVersion,
      status,
      dryRun,
      startedAt,
      finishedAt,
      durationMs: finishedAt - startedAt,
      totalSteps: plan.steps.length,
      succeededSteps: stepResults.filter((r) => r.status === MigrationStepStatus.SUCCEEDED).length,
      failedSteps: stepResults.filter((r) => r.status === MigrationStepStatus.FAILED).length,
      steps: stepResults,
      ...(rollbackSteps ? { rollbackSteps } : {}),
    };

    // The runner never persists state anywhere itself; "dry run" means the
    // caller gets back what they put in, even though every step's transform
    // and validation logic ran for real to produce the report above.
    const returnedState = dryRun ? initialState : state;
    return { state: returnedState, report };
  }

  private async rollback<TState>(
    completedSteps: AnyMigrationStep[],
    state: TState,
    context: MigrationContext
  ): Promise<RollbackOutcome<TState>> {
    const results: MigrationStepResult[] = [];
    let current = state;
    let allRolledBack = completedSteps.length > 0;

    for (const step of [...completedSteps].reverse()) {
      if (!step.rollback) {
        allRolledBack = false;
        continue;
      }

      const startedAt = Date.now();
      try {
        current = (await step.rollback(current, context)) as TState;
        results.push({
          stepId: step.id,
          fromVersion: step.toVersion,
          toVersion: step.fromVersion,
          status: MigrationStepStatus.SUCCEEDED,
          startedAt,
          finishedAt: Date.now(),
          durationMs: Date.now() - startedAt,
        });
      } catch (error) {
        allRolledBack = false;
        results.push({
          stepId: step.id,
          fromVersion: step.toVersion,
          toVersion: step.fromVersion,
          status: MigrationStepStatus.FAILED,
          startedAt,
          finishedAt: Date.now(),
          durationMs: Date.now() - startedAt,
          error: toErrorInfo(error),
        });
      }
    }

    return { state: current, results, allRolledBack };
  }
}

/** Shared, SDK-wide migration runner, using the default registry and state validator. */
export const defaultMigrationRunner = new MigrationRunner();
