# Contract ABI Version Compatibility Framework

## Summary

Adds a version-compatibility layer so the SDK can talk to multiple deployed
ABI versions of the same logical contract (across environments, or mid
rollout) while every caller keeps using one stable, canonical method
interface.

## Files

**New**
- `src/types/abi.ts` — core types: `AbiVersion`, `AbiMethodAdapter`,
  `AbiVersionDescriptor`, `AbiVersionProbe`, detection result types.
- `src/registry/abiVersionRegistry.ts` — `AbiVersionRegistry`: register/get/
  require/list ABI versions per contract, plus `detectVersion()`.
- `src/adapters/abiCompatAdapter.ts` — `AbiCompatAdapter`, a `ContractAdapter`
  implementation that detects (and caches) a deployed contract's ABI version
  and translates canonical `read`/`write` calls through it.
- `src/contracts/vaultAbiVersions.ts` — registers Vault's real v1/v2/v3 ABI
  descriptors against the shared registry.
- `tests/registry/abiVersionRegistry.test.ts`,
  `tests/adapters/abiCompatAdapter.test.ts`,
  `tests/contracts/vaultAbiVersions.test.ts` — see Test coverage below.

**Modified**
- `src/errors/axionveraError.ts` — adds `UnsupportedAbiVersionError`,
  `AbiVersionDetectionError`, `UnsupportedContractMethodError`.
- `src/adapters/index.ts`, `src/registry/index.ts`, `src/index.ts` — export
  the new pieces.
- `README.md` — new "🔄 ABI Version Compatibility" section.

## Compatibility architecture overview

Three pieces work together:

1. **`AbiVersionRegistry`** registers an `AbiVersionDescriptor` per
   contract/version and resolves which version a *deployed* contract
   instance is running via `detectVersion()`:
   - **Explicit** — if the caller supplies `probe.readExplicitVersion()`
     (e.g. an on-chain `version()` call) and it returns a registered
     version, that wins outright.
   - **Inferred** — otherwise every registered version is tried
     newest-first; the first whose `fingerprintMethods` are ALL present on
     the deployed contract is used.
   - **Unknown** — if neither resolves, detection reports
     `confidence: 'unknown'` and the caller falls back to a configured
     default version or surfaces an error.
2. **`AbiCompatAdapter`** is a `ContractAdapter` (matches the interface
   already used by `AdapterRegistry`/`VaultAdapter`) that caches the
   detected version per deployed address, then routes every canonical
   `read`/`write` call through that version's method mapping — serializing
   args down to the raw on-chain call, dispatching via a
   `RawContractCaller`, then deserializing the raw result back up to the
   canonical shape.
3. **Version-specific serializers/deserializers** live on each
   `AbiMethodAdapter` (`serializeArgs` / `deserializeResult`). This is
   deliberately a different concern from `src/migrations` (which
   transforms *persisted* state offline, once) — this layer governs *live
   RPC calls* for whichever ABI version is deployed right now. The two
   compose: Vault's `v1`/`v2` `getVaultInfo` deserializer reuses the
   already-registered `defaultMigrationRegistry` steps
   (`vaultV1ToV2Migration`, `vaultV2ToV3Migration`) to upgrade a raw result
   to the canonical `v3` shape, instead of a second hand-written upgrade
   path.

## Supported ABI versions (Vault)

| Version | Adds | `getVaultInfo` raw method |
| --- | --- | --- |
| `v1` | Base vault: deposit, withdraw, balance | `get_vault_info` (no `apy`/`lockPeriod`/`feeBps`) |
| `v2` | Rewards program: `claimRewards`, `getPendingRewards`, `apy`, `lockPeriod` | `get_vault_info` |
| `v3` (latest) | Protocol fee: `feeBps` on `getVaultInfo`, plus dedicated `getFeeBps` | `get_vault_info` |

## Test coverage summary

- `tests/registry/abiVersionRegistry.test.ts` (16 tests) — registration,
  ordering, `require()` error path, and all detection outcomes (explicit,
  inferred-newest, inferred-oldest, explicit-tag-not-registered fallback,
  unknown/no-match, unknown contract).
- `tests/adapters/abiCompatAdapter.test.ts` (8 tests) — version caching
  across repeated calls, argument serialization, result deserialization,
  `UnsupportedContractMethodError`, `fallbackVersion` behavior,
  `AbiVersionDetectionError` when detection fails with no fallback,
  `invalidate()`, `supports()`.
- `tests/contracts/vaultAbiVersions.test.ts` (6 tests) — integration
  coverage against the real Vault registrations: registration order,
  fingerprint detection for all three versions, migration-registry replay
  upgrading a `v1` raw result to canonical `v3` shape, write-arg
  serialization, rejecting a v3-only method at v1, and v3 passthrough.

All 30 new tests pass. Ran alongside the existing `tests/adapters`,
`tests/registry`, and `tests/migrations` suites (105 tests total) with no
regressions. `npx eslint` and `npx tsc --noEmit` report zero issues in any
new or modified file (the pre-existing repo has unrelated lint/type errors
in other files and one pre-existing failing test file,
`tests/contracts/VaultContract.test.ts`, unrelated to this change).

## Upgrade considerations

- Register ABI versions in ascending (oldest-first) order —
  `getLatestVersion()` and the newest-first search in `detectVersion()`
  both rely on registration order.
- A canonical method absent from an older version's descriptor throws
  `UnsupportedContractMethodError` rather than silently no-op'ing; treat
  this as a feature-detection gate.
- `AbiCompatAdapter` caches the detected version per deployed contract
  address — call `invalidate()` after a contract upgrade so the next call
  re-detects instead of reusing a stale version.
- If a contract exposes an explicit on-chain version tag, wire it through
  `probe.readExplicitVersion()` — it's checked before fingerprinting and
  avoids relying on method-presence heuristics entirely.

## Out of scope (per issue)

No changes to contract migrations, smart contracts, or dashboard
integration.
