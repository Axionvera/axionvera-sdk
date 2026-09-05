# Contract Migration Support Toolkit

This toolkit helps SDK consumers manage contract state migrations: moving a
contract's recorded state from one logical version to the next, validating
that the state matches the expected shape at each version, and producing a
report of what happened. It is a client-side workflow aid, not an upgrade
mechanism — see [Out of Scope](#out-of-scope) below.

## Migration Architecture

A migration is built from three independent pieces, each usable on its own:

- **`MigrationRegistry`** — a graph of named, version-to-version
  **steps** (`{ id, fromVersion, toVersion, migrate, rollback? }`) registered
  per logical contract id. `resolvePath(contractId, from, to)` runs a
  breadth-first search over registered edges to find the shortest chain of
  steps connecting two versions, even when no single step covers the whole
  jump (e.g. `v1 -> v2 -> v3`). This mirrors the key design of
  `ContractValidationEngine` (see `CONTRACT_VALIDATION.md`): schemas/steps are
  keyed by a logical contract id, not a deployed address, since the same
  contract type is usually instantiated many times with the same shapes.
- **`MigrationStateValidator`** — a registry of valibot schemas keyed by
  `contractId`/version, used to confirm state matches the expected shape
  before and after each step runs. See [Validation Strategy](#validation-strategy).
- **`MigrationRunner`** — executes a resolved chain of steps against an
  in-memory state value, producing a `MigrationReport`. It performs **no
  network I/O** — it is a pure function over the state value it's given, so
  fetching the pre-migration state and persisting the post-migration state
  back to wherever it's stored is left entirely to the caller. This keeps
  "automatically upgrading the on-chain contract" explicitly out of scope
  while still giving consumers a reliable, auditable way to drive a migration
  by hand (or from their own deployment scripts).

Steps are plain data — `{ id, fromVersion, toVersion, migrate, rollback? }` —
so they compose into chains, dry-run safely (nothing to roll back if nothing
ran against the network), and can be tested as pure functions independent of
the runner.

### Components

| File | Purpose |
| --- | --- |
| `src/types/migration.ts` | Shared types: `MigrationStepDefinition`, `MigrationPlan`, `MigrationContext`, `MigrationReport`, `MigrationStepResult`, `RunMigrationOptions`, `MigrationStatus`/`MigrationStepStatus` enums. |
| `src/migrations/migrationRegistry.ts` | `MigrationRegistry` — step registration and multi-hop path resolution (`defaultMigrationRegistry`). |
| `src/migrations/stateValidator.ts` | `MigrationStateValidator` — per-version state schemas (`defaultMigrationStateValidator`). |
| `src/migrations/migrationRunner.ts` | `MigrationRunner` — executes a plan, validates state, supports dry-run and rollback, builds a `MigrationReport` (`defaultMigrationRunner`). |
| `src/migrations/migrationReporter.ts` | `summarizeMigrationReport` (human-readable) and `serializeMigrationReport` (JSON) for a `MigrationReport`. |
| `src/contracts/contractMigrations.ts` | Example registrations: a Vault-style contract's `v1 -> v2 -> v3` state evolution. |
| `src/errors/axionveraError.ts` | `MigrationStateValidationError`, `MigrationPathNotFoundError`. |

## Validation Strategy

State validation reuses the same primitives as the contract schema validation
framework (`valibot`), but is intentionally a separate, smaller component
rather than a feature of `ContractValidationEngine`:

- **Keyed by version, not method.** `ContractValidationEngine` validates a
  method's params/result; `MigrationStateValidator` validates a whole state
  snapshot at a given version. Different axis, so a separate registry avoids
  overloading one engine with two unrelated keying schemes.
- **Opt-in per version.** Calling `validateState` for a `contractId`/version
  with no registered schema returns the state unchanged — consumers can adopt
  validation incrementally, or skip it entirely with `validateState: false`.
- **Validated on both sides of every step.** The runner checks state against
  the `fromVersion` schema *before* calling `migrate`, and against the
  `toVersion` schema *after* — so a step that produces a malformed result
  fails immediately as a `MigrationStateValidationError`, rather than
  silently propagating into the next step.
- **Dry runs still validate for real.** `dryRun: true` threads the simulated
  state through every step (so step N's pre-validation checks step N-1's
  actual output shape) — it only changes what's *returned* to the caller
  (the original, untouched input), not what's checked internally. This is
  what lets a dry run reliably answer "would this migration succeed?"

## Usage Examples

### Defining and registering a migration step

```typescript
import { defaultMigrationRegistry, defaultMigrationStateValidator } from 'axionvera-sdk';
import * as v from 'valibot';

interface VaultStateV1 { totalAssets: bigint; totalSupply: bigint; }
interface VaultStateV2 extends VaultStateV1 { apy: number; }

defaultMigrationStateValidator.registerStateSchema('MyVault', 'v1', v.object({
  totalAssets: v.bigint(),
  totalSupply: v.bigint(),
}));
defaultMigrationStateValidator.registerStateSchema('MyVault', 'v2', v.object({
  totalAssets: v.bigint(),
  totalSupply: v.bigint(),
  apy: v.number(),
}));

defaultMigrationRegistry.register<VaultStateV1, VaultStateV2>('MyVault', {
  id: 'myvault-v1-to-v2',
  fromVersion: 'v1',
  toVersion: 'v2',
  migrate: (state) => ({ ...state, apy: 0 }),
  rollback: (state) => {
    const { apy, ...rest } = state;
    void apy;
    return rest;
  },
});
```

### Running a migration and reading the report

```typescript
import { MigrationRunner, summarizeMigrationReport } from 'axionvera-sdk';

const runner = new MigrationRunner(); // uses the default registry/validator
const currentState = await fetchVaultStateFromWherever(); // caller-owned I/O

const { state, report } = await runner.migrate('MyVault', currentState, 'v1', 'v2');

console.log(summarizeMigrationReport(report));
if (report.status === 'completed') {
  await persistVaultState(state); // caller-owned I/O
}
```

### Dry-running before committing

```typescript
const { state, report } = await runner.migrate('MyVault', currentState, 'v1', 'v3', {
  dryRun: true,
});
// `state` is exactly `currentState` (untouched); `report` reflects whether
// the full v1 -> v2 -> v3 chain would have succeeded.
```

### Recovering from a failed step

```typescript
const { state, report } = await runner.migrate('MyVault', currentState, 'v1', 'v3', {
  rollbackOnFailure: true,
});
// report.status is 'rolled_back' when every completed step's rollback()
// succeeded, or 'failed' if a step had no rollback() or its rollback threw.
// report.rollbackSteps lists each rollback attempt.
```

A full runnable walkthrough (multi-hop migration, dry run, and a rollback
triggered by an intentionally-broken step) lives in
`examples/contractMigrationExample.ts`.

## Error Handling Strategy

Both error types extend `AxionveraError`, consistent with the rest of the
SDK's error hierarchy:

- **`MigrationStateValidationError`** — thrown by `MigrationStateValidator`
  when state doesn't match a registered schema. Carries `contractId`,
  `version`, and structured `issues` (one `{ path, message, received }` entry
  per offending field), the same shape as `SchemaValidationError`.
- **`MigrationPathNotFoundError`** — thrown by `MigrationRegistry.resolvePath`
  (and therefore `MigrationRunner.migrate`) when no chain of registered steps
  connects `fromVersion` to `toVersion`. This is a usage error and is thrown
  synchronously before any step runs — it never appears inside a
  `MigrationReport`.

A failure *during* a step (a thrown error from `migrate`, or a
`MigrationStateValidationError` from pre/post-validation) does **not**
propagate as an exception from `run`/`migrate`. It's captured as a failed
`MigrationStepResult` and the run stops there, so callers always get back a
complete report to inspect rather than having to wrap every call in
try/catch to find out how far a migration got.

## Test Coverage Summary

`tests/migrations/` covers:

- `migrationRegistry.test.ts` — registration (register/unregister/overwrite),
  direct and multi-hop path resolution, shortest-path selection when multiple
  chains exist, `MigrationPathNotFoundError` (including cyclic graphs that
  must not infinite-loop).
- `stateValidator.test.ts` — registration, pass-through when no schema is
  registered, descriptive `MigrationStateValidationError` with correct
  `contractId`/`version`/`issues`.
- `migrationRunner.test.ts` — single- and multi-hop successful runs, the
  zero-step (`fromVersion === toVersion`) case, metadata propagation via
  `MigrationContext`, dry runs (including the multi-hop case that previously
  exposed a state-threading bug — see below), step failures (including
  state-validation failures), `validateState: false`, propagating
  `MigrationPathNotFoundError`, and rollback (full rollback to `rolled_back`,
  staying `failed` when a step lacks `rollback()`, skipping rollback during a
  dry run, and recording a rollback attempt that itself throws).
- `migrationReporter.test.ts` — `summarizeMigrationReport` formatting (status,
  dry-run flag, per-step pass/fail markers, error detail, rollback section)
  and `serializeMigrationReport` round-tripping through JSON.
- `contractMigrations.test.ts` — the example Vault `v1 -> v2 -> v3` steps,
  exercised both directly and end-to-end through the shared
  `defaultMigrationRegistry`/`defaultMigrationStateValidator`.
- `migrationErrors.test.ts` — both error classes (inheritance, `name`,
  properties, message, `originalError`).

All new tests import directly from the relevant `src/` module rather than the
package's `src/index.ts` barrel, and `examples/contractMigrationExample.ts`
was run directly (`ts-node --transpile-only`) as a manual end-to-end check —
this is how the dry-run state-threading bug referenced above was actually
found: unit tests alone didn't exercise a 2+ step dry run, so the fix is
covered by a dedicated regression test in `migrationRunner.test.ts`.

## Out of Scope

Per the parent issue, this toolkit deliberately does **not** include:

- **Automatic contract upgrades.** The runner never calls out to a network,
  signs anything, or submits a transaction — applying a migrated state to a
  live contract is entirely the caller's responsibility.
- **Governance implementation.** No voting, proposal, or approval workflow is
  included; gating *when* a migration is allowed to run is left to the
  consumer.
- **Dashboard migration tools.** No UI is provided. `summarizeMigrationReport`
  produces a plain-text summary suitable for CLI output or PR notes, not a
  rendered dashboard.

## Known Pre-Existing Issue (Not Part of This Change)

As documented in `CONTRACT_VALIDATION.md`, `src/client/stellarClient.ts` and
`src/contracts/vault.ts` already contain unrelated syntax errors from a prior
bad merge, present on this branch before this change, which cause `npm run
typecheck`/`npm run build` and ~41 test suites to fail regardless of this
toolkit. This toolkit was built, typechecked in isolation, and tested without
depending on either file; a repo-wide green build requires a separate fix to
those two files.
