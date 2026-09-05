# SDK Smoke Test — Maintainer Guide

Contributor-safe, repeatable smoke-test command template for Axionvera SDK
testnet/mainnet validation.

## TL;DR

```bash
# Contributors — safe by default: no real RPC, no secrets, no writes
npm run smoke-test

# Same, with a named input and explicit plan-only dry-run:
npm run smoke-test -- --config examples/smoke-test-input.json --mode dry-run

# After a successful contributor run, verify the report example:
cat examples/smoke-test-output.json
```

---

## Maintainer-Only Live Mode

**WARNING**: Live mode submits real Soroban transactions with real fees. This is
only for maintainers who have:

1. Deployed the network and populated real contract IDs
2. Set up a testnet/mainnet Stellar keypair with enough XLM for fees
3. Set the env vars only in their local shell (never committed)

### Step 1 — Prepare your local config

Copy the contributor example to a local, git-ignored path:

```bash
cp examples/smoke-test-input.json config/axionvera/smoke-test-testnet.json
# Then edit and replace PLACEHOLDER_* with your real 56-char contract IDs
```

Use a path like `config/axionvera/*.json` or any private location not tracked
by git (add it to `.gitignore` if in doubt).

### Step 2 — Export maintainer env (local shell ONLY)

```bash
export AXIONVERA_MAINTAINER=1
export NODE_ENV=maintenance

# Optional, only required if you want real signatures from a Stellar keypair:
export AXIONVERA_TEST_SECRET="S..................................................."
#                                 ^^^^ your secret seed, never commit this ^^^^
```

### Step 3 — First, dry-run the live plan

```bash
node scripts/smoke-test-sdk.js \
  --config config/axionvera/smoke-test-testnet.json \
  --mode live --dry-run
```

This validates config, contract ID format, and prints the exact plan — **it
does not submit anything**.  Review the plan carefully.

### Step 4 — Only then, remove --dry-run to actually execute

```bash
node scripts/smoke-test-sdk.js \
  --config config/axionvera/smoke-test-testnet.json \
  --mode live --no-dry-run
```

---

## Configuration Schema

The full schema is published at [schemas/smoke-test-config.schema.json](file:///c:/Users/Muhammad/.trae/Grantfox/axionvera-sdk/schemas/smoke-test-config.schema.json).

| Field | Required | Default | Contributor-safe? |
|-------|:--------:|---------|:-----------------:|
| `network` | ✅ | — | Yes (`testnet`, `mainnet`, `futurenet`, `mock`) |
| `rpcUrl` | ❌ | — | Yes; inferred from network preset when omitted |
| `mode` | ❌ | `mocked` | Yes if `mocked`/`dry-run`; **maintainer-only if `live`** |
| `contracts` | ✅ | — | Yes, allows `PLACEHOLDER_*` in mocked/dry-run |
| `contracts.<name>.contractId` | ✅ | — | Yes, accepts `PLACEHOLDER_*` in non-live modes |
| `contracts.<name>.requiredMethods` | ✅ | — | Yes |
| `contracts.<name>.writeDisabled` | ❌ | `true` | Yes; keep `true` for contributor runs |
| `wallet.useMock` | ❌ | `true` | Yes; keep `true` unless signing with a real wallet |
| `options.dryRun` | ❌ | `true` | Yes; contributor default is `true` (always safe) |
| `options.outputFile` | ❌ | — | Yes; secret-sounding paths are **refused** |

## Secret / Safety Guards

`scripts/smoke-test-sdk.js` enforces these at runtime:

| Guard | When triggered |
|-------|---------------|
| Placeholder contract IDs rejected | `mode=live` (maintainer must use real IDs) |
| `live` requires both `--mode live` AND `--no-dry-run` | Single flags are rejected; both must be explicit |
| `AXIONVERA_MAINTAINER=1` AND `NODE_ENV=maintenance` | Live-mode gating |
| Secret-pattern output path refused | If `options.outputFile` matches `*.env`, `*secret*`, `*key*`, Stellar seed `S[A-Z2-7]{55}`, etc. |
| Default `writeDisabled=true` on every contract spec | Write methods are simulated unless both `writeDisabled=false` AND `--no-dry-run` |
| Dry-run report includes exact `liveRpcCalls` and `writeSubmissions` counts | Fail the build if either is non-zero in a contributor PR |

## Dry-Run Validation Harness

A self-contained Node test exercises all safe execution paths:

```bash
node scripts/test-smoke-test.js
```

This test runs the real smoke test script 8 times:

1. **Default mocked run** — PASS, exit 0, liveRpcCalls=0
2. **Explicit `--mode dry-run`** — plan only, exit 0
3. **`--mode live` without `--no-dry-run`** — fails the live-mode guard
4. **`--mode live --no-dry-run` without env guard** — fails maintainer-only guard
5. **Invalid config path** — fails-fast with clear message
6. **Invalid network name** — schema lite validation fails
7. **Empty requiredMethods** — schema lite validation fails
8. **Writes report to `options.outputFile`** — verifies JSON contents show 0 live calls, 0 write submissions, 0 failures

This test is **100% offline-safe** and runs in <5 seconds.

## CLI Reference

```
node scripts/smoke-test-sdk.js [options]

Options:
  --config <path>   Path to JSON config (default: examples/smoke-test-input.json)
  --mode <m>        One of: mocked, dry-run, live  (default: mocked)
  --dry-run         Only print a plan; override config's options.dryRun=true
  --no-dry-run      Execute for real; only valid with --mode live
  -v, --verbose     Verbose output
  -h, --help        Show this guide
```

## Integration with Release Readiness

The contributor-safe smoke test is integrated into the maintainer release
packet pipeline.  See:

- [scripts/release-readiness.js](file:///c:/Users/Muhammad/.trae/Grantfox/axionvera-sdk/scripts/release-readiness.js) — calls `smoke-test` as a
  `preflight` step (safe mocked run) and fails the release if it returns
  non-zero.
- [docs/release-packet-generator.md](file:///c:/Users/Muhammad/.trae/Grantfox/axionvera-sdk/docs/release-packet-generator.md)
- [scripts/generate-release-packet.js](file:///c:/Users/Muhammad/.trae/Grantfox/axionvera-sdk/scripts/generate-release-packet.js)
