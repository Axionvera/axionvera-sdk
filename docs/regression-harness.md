# Regression Test Harness

> **Last updated:** 2026-07-29

This harness provides deterministic fixtures and regression suites to protect
SDK refactors from accidentally changing public behaviour.

## Structure

| File | Purpose |
|------|---------|
| `tests/regression/fixtures.ts` | Shared deterministic fixture data |
| `tests/regression/harness.test.ts` | Verifies fixture determinism |
| `tests/regression/public-api.test.ts` | Smoke tests for public API surface |
| `tests/regression/error-paths.test.ts` | Covers error responses and invalid inputs |

## Running

```bash
npm run test:regression
```

This uses Jest and runs only the `tests/regression/` directory.

## Adding New Regression Tests

1. Create a new `tests/regression/<name>.test.ts`
2. Import fixtures from `./fixtures`
3. Use `describe` / `it` / `expect` (Jest API)
4. Run `npm run test:regression` to verify

## Determinism Rule

Every fixture function must return the **same value** on every call for the
same default arguments. This ensures regression suites produce reproducible
results across runs and environments.
