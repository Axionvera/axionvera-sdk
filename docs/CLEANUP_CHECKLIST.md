# SDK Cleanup Checklist

This checklist defines the standards every contribution to `axionvera-sdk` must meet before it is considered clean and ready to merge. It exists to prevent the codebase from accumulating structural debt, inconsistent patterns, and duplicated utilities over time.

Work through each section that is relevant to your change before opening a pull request. The [PR template](../.github/PULL_REQUEST_TEMPLATE.md) references this document and includes a condensed version of these checks.

---

## 1. Module Boundaries

A module is any directory under `src/` that groups related functionality. Keep modules focused and independent.

- [ ] Each module has a single, clearly defined responsibility. If a module's purpose is hard to describe in one sentence, consider splitting it.
- [ ] No module imports directly from the internal files of another module. Cross-module dependencies must go through the public `index.ts` barrel of the target module.
  - ✅ `import { Foo } from '../other-module';` (barrel import)
  - ❌ `import { Foo } from '../other-module/fooImpl';` (deep import)
- [ ] Circular dependencies are absent. Run `npm run typecheck` and review the output; also see `tests/architecture/dependencyGraph.test.ts` for automated checks.
- [ ] New directories under `src/` include an `index.ts` barrel that explicitly re-exports only the public API surface.
- [ ] Monorepo packages (`packages/core`, `packages/codegen`, `packages/react`) are not coupled to each other's internals. Inter-package dependencies must be declared in each package's `package.json`.
- [ ] `src/wallet-integration-203/` remains isolated — do not import from it in SDK source.

---

## 2. Naming Conventions

Consistent naming makes the codebase predictable.

### Files and directories
- [ ] Source files use `camelCase` for utilities and helpers (`transactionBuilder.ts`, `httpInterceptor.ts`).
- [ ] Classes and React components use `PascalCase` as both the export name and the filename (`StellarClient.ts`, `VaultContract.ts`).
- [ ] Test files are named `<subject>.test.ts` and live in `tests/` mirroring the `src/` path (e.g., `src/batch/batchExecutor.ts` → `tests/batch/batchExecutor.test.ts`).
- [ ] No numeric suffixes or branch-era identifiers in directory or file names (e.g., avoid `wallet-integration-203/`-style names for new code).

### Symbols
- [ ] Interfaces start with `I` only when there is a concrete implementation class with the same base name; otherwise omit the prefix.
- [ ] Error classes are named `<Condition>Error` and extend `AxionveraError` (see §5).
- [ ] Boolean variables and parameters use `is`, `has`, or `should` prefixes (`isConnected`, `hasWallet`, `shouldRetry`).
- [ ] Constants are `UPPER_SNAKE_CASE` when they are module-level configuration values.

---

## 3. Import and Export Conventions

- [ ] All public exports from a module are declared in its `index.ts` barrel. Nothing outside the module should need to know about the file that defines a symbol.
- [ ] Imports within a module use relative paths. Imports across modules use the barrel path, not a deep path.
- [ ] No wildcard re-exports (`export * from ...`) unless the module is itself a thin aggregation barrel (e.g., the root `src/index.ts`).
- [ ] Side-effect imports (`import './something'`) are absent from library code. They are only acceptable in entry-point scripts or test setup files.
- [ ] The root `src/index.ts` is the sole public API surface of the main `axionvera-sdk` package. New symbols intended for external consumers must be added there explicitly; internal-only symbols must not be.
- [ ] `@stellar/stellar-sdk` is a peer dependency. Do not bundle it — import it normally but ensure `package.json` lists it under `peerDependencies`.

---

## 4. Testing Expectations

- [ ] Every new public function, class, or exported utility has at least one test covering its happy path.
- [ ] Error paths and edge cases (invalid input, network failures, rate limits) are covered by dedicated tests.
- [ ] Tests are placed under `tests/` in a path that mirrors the source file location.
- [ ] Tests use Jest. No other test runners are introduced.
- [ ] Mocks and stubs use the patterns already established in the codebase:
  - `MockRpcServer` / `MockNetwork` / `ScenarioBuilder` from `src/testing/` for RPC-level scenarios.
  - `MockWalletConnector` from `src/wallet/mockWalletConnector.ts` for wallet interactions.
  - MSW handlers in `tests/mocks/` for HTTP-level mocking.
- [ ] New mock utilities are added to `src/testing/` or `tests/mocks/`, not scattered across individual test files.
- [ ] Tests do not import from `dist/` or from other packages' `dist/` directories.
- [ ] All tests pass locally before opening a PR: `npm run test`.
- [ ] No `test.only` or `describe.only` calls left in committed test files.
- [ ] E2E tests that require a live network are placed under `tests/e2e/` and can be skipped in offline CI via the existing setup in `tests/e2e/setup.ts`.

---

## 5. Error and Config Conventions

### Errors
- [ ] All thrown errors are instances of `AxionveraError` or one of its named subclasses defined in `src/errors/axionveraError.ts`.
- [ ] New error conditions get a dedicated named class rather than reusing a generic one with a message string.
  ```ts
  // ✅ Correct
  throw new FaucetRateLimitError('Friendbot returned 429');

  // ❌ Avoid
  throw new AxionveraError('Faucet rate limited');
  ```
- [ ] The new error class is exported from `src/errors/index.ts` and re-exported from the root `src/index.ts`.
- [ ] Error messages are human-readable and include enough context to diagnose the issue without reading source code.
- [ ] `normalizeRpcError`, `normalizeTransactionError`, `normalizeContractError`, and `normalizeSimulationError` helper functions are used to convert raw SDK/network errors into typed `AxionveraError` subclasses at module boundaries, not inline throughout business logic.

### Configuration
- [ ] All environment-specific defaults (RPC URLs, network passphrases, feature flags) live in `src/utils/networkConfig.ts` or the appropriate module's config file. Hardcoded URLs or magic strings are not introduced into business logic.
- [ ] New `StellarClientOptions` fields are optional and have documented defaults so callers do not need to change existing initialization code.
- [ ] Feature flags follow the existing pattern in `src/features/` (typed flag definitions, evaluation through `FeatureFlagManager`, rollout policies in `src/features/policies.ts`).
- [ ] Secrets (private keys, API tokens) are never logged, stored in config objects that get serialised, or included in error messages. The logger in `src/utils/logger.ts` includes automatic redaction — use it.

---

## 6. Documentation Standards

- [ ] Public API additions include TSDoc comments (`/** ... */`) on the exported symbol. Minimum: one sentence describing what it does, `@param` for non-obvious parameters, and `@throws` for documented error conditions.
- [ ] If a new module is added, a brief description is added to the **Module Architecture** section of `README.md`.
- [ ] Breaking changes or new top-level features include or update a doc in `docs/` (e.g., a new feature guide, updated migration notes).
- [ ] The `docs/` directory is for persistent reference material. One-off design notes, ADRs, and PR-specific context belong in PR descriptions or GitHub issues, not committed as new markdown files.
- [ ] Example code in `examples/` compiles (`npm run typecheck`) and reflects current API. If you rename or remove an API, update the affected examples.
- [ ] The root-level `*.md` files (`CONCURRENCY_CONTROL.md`, `RETRY_FEATURE.md`, etc.) are feature-specific reference documents. Update the relevant one if your change touches that feature area.

---

## 7. Code Quality and Style

- [ ] `npm run lint` passes with no new errors or warnings.
- [ ] `npm run typecheck` passes — no `any` types added without a `// eslint-disable` comment explaining why it is unavoidable.
- [ ] `npm run build` succeeds and produces clean output in `dist/`.
- [ ] `npm run size` passes bundle size limits defined in `.size-limit.json`. If your change intentionally grows the bundle, update the limits and document the reason.
- [ ] No `console.log` in library code. Use the `Logger` from `src/utils/logger.ts` so callers can control verbosity.
- [ ] No commented-out code blocks left in committed files.
- [ ] Utility functions that are useful to more than one module are placed in `src/utils/` and exported from `src/utils/index.ts`, not duplicated.

---

## 8. Monorepo Package Hygiene

- [ ] Changes to `packages/core`, `packages/codegen`, or `packages/react` do not accidentally expand the public API surface without a corresponding version bump strategy.
- [ ] Each package's `README.md` is updated if the public API or install instructions change.
- [ ] New packages under `packages/` include their own `tsconfig.json`, `tsup.config.ts`, `package.json`, `LICENSE`, and `README.md`, following the pattern of existing packages.
- [ ] Shim re-exports in `packages/core` are kept in sync with any new symbols extracted to sub-packages, so existing import paths continue to work.

---

## Quick Reference

| Area | Key command |
|---|---|
| Type safety | `npm run typecheck` |
| Linting | `npm run lint` |
| Tests | `npm run test` |
| Build | `npm run build` |
| Bundle size | `npm run size` |
| Pre-PR (all) | `npm run lint && npm run typecheck && npm run test && npm run build && npm run size` |

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full development workflow and branching instructions.
