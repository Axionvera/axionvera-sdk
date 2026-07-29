import { MigrationStepStatus } from '../types';
import type { MigrationReport, MigrationStepResult } from '../types';

function formatStep(step: MigrationStepResult): string {
  const marker = step.status === MigrationStepStatus.SUCCEEDED ? 'OK' : 'FAIL';
  const detail = step.error ? ` — ${step.error.name}: ${step.error.message}` : '';
  return `  [${marker}] ${step.fromVersion} -> ${step.toVersion} (${step.stepId}, ${String(step.durationMs)}ms)${detail}`;
}

/**
 * Renders a {@link MigrationReport} as a human-readable, multi-line summary
 * suitable for CLI output or PR notes.
 *
 * @example
 * ```typescript
 * const { report } = await runner.migrate('Vault', state, 'v1', 'v2');
 * console.log(summarizeMigrationReport(report));
 * ```
 */
export function summarizeMigrationReport(report: MigrationReport): string {
  const lines: string[] = [
    `Migration report for "${report.contractId}" (${report.fromVersion} -> ${report.toVersion})`,
    `Status: ${report.status.toUpperCase()}${report.dryRun ? ' (dry run)' : ''}`,
    `Steps: ${String(report.succeededSteps)}/${String(report.totalSteps)} succeeded`,
    ...report.steps.map(formatStep),
  ];

  if (report.rollbackSteps && report.rollbackSteps.length > 0) {
    lines.push('Rollback:');
    lines.push(...report.rollbackSteps.map(formatStep));
  }

  lines.push(
    `Started: ${new Date(report.startedAt).toISOString()}, ` +
      `Finished: ${new Date(report.finishedAt).toISOString()}, ` +
      `Duration: ${String(report.durationMs)}ms`
  );

  return lines.join('\n');
}

/** Serializes a {@link MigrationReport} to a pretty-printed JSON string. */
export function serializeMigrationReport(report: MigrationReport): string {
  return JSON.stringify(report, null, 2);
}
