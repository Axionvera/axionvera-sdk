# Utility Ownership & Placement Rules

> **Last updated:** 2026-07-29

This document defines where shared utility logic lives in the Axionvera SDK and
how to avoid re-introducing duplicate helpers.

## Placement Rules

1. **Cross-cutting primitives** (used by 2+ unrelated modules) live in `src/utils/`.
   Examples: `sleep`, `logger`, `xdrValidator`.
2. **Module-specific helpers** stay inside their module directory
   (e.g. a helper used only by `src/network/` stays in `src/network/`).
3. **A helper used by two or more modules must be promoted to `src/utils/`** and
   re-exported from `src/utils/index.ts`. Do not copy-paste it into each module.

## Deduplication Guidance

Before adding a helper, search for an existing one:

```bash
grep -rn "function <name>" src/ --include="*.ts"
```

Common primitives that already exist in `src/utils/`:

| Helper | File | Purpose |
|--------|------|---------|
| `sleep(ms)` | `src/utils/sleep.ts` | Promise-based delay for backoff/waits |
| `logger` | `src/utils/logger.ts` | Structured logging |
| `isValidXDR` | `src/utils/xdrValidator.ts` | XDR string validation |

## Recently Centralized

- **`sleep`** — previously duplicated as a local `delay()` in
  `src/utils/httpInterceptor.ts` and a local `sleep()` in
  `src/network/rpcEndpointManager.ts`. Both were identical
  (`new Promise(resolve => setTimeout(resolve, ms))`). They now import the
  single `sleep` from `src/utils/sleep.ts`.
