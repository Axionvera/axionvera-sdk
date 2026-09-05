# Protocol Capability Detection

The capability detection layer answers a single question for a connected
contract: **which of the capabilities a contract _declares_ are actually backed
by the methods its ABI _exposes_?** It lets the SDK adapt to a deployment
instead of assuming every declared feature is present.

> **Detection, not negotiation.** This layer is purely **ABI-derived**. It does
> **not** query a live deployment and does **not** rely on an ERC-165-style
> `supportsInterface` or any on-chain wire feature-advertisement protocol —
> the SDK exposes no such mechanism, so none is implied. The SDK does not
> negotiate capabilities with a running contract; it reconciles a declared
> descriptor against a real ABI.

## How it works

Detection reuses the SDK's existing pieces — it introduces **no new capability
concept**:

- The capability taxonomy and the method→capability map come from the discovery
  [`ContractDescriptor`](../src/discovery/types.ts) (`ContractCapability`,
  `ContractMethodDescriptor`).
- The list of methods a contract actually exposes comes from the
  [Contract Reflection API](./CONTRACT_REFLECTION.md) (`contractReflection`),
  which parses a standard JSON ABI via `ethers.Interface`.
- Descriptor validation reuses
  [`CapabilityRegistry.validate`](../src/registry/capabilityRegistry.ts).

The detector matches each declared `ContractMethodDescriptor.name` against the
reflected ABI method names, then computes:

| Field               | Meaning                                                            |
| ------------------- | ------------------------------------------------------------------ |
| `supported`         | Capabilities whose **every** defining method is present in the ABI |
| `missing`           | Declared capabilities missing **at least one** defining method     |
| `methods`           | Per-declared-method presence detail (the compatibility matrix)     |
| `undeclaredMethods` | ABI method names with **no** descriptor capability mapping         |
| `complete`          | `true` when `missing` is empty                                     |

A capability is supported **only when all of its defining methods are present**.
The reconciliation is **bidirectional**: `missing` reports declared-but-absent
capabilities, `undeclaredMethods` reports ABI methods the descriptor never
mapped.

## Quick start

```typescript
import { capabilityDetector, VaultContractDescriptor, VaultABI } from 'axionvera-sdk';

const result = capabilityDetector.detect(VaultContractDescriptor, VaultABI);

// Adapt behaviour to what the contract actually supports.
if (result.supported.includes('assets:deposit')) {
  // safe to call deposit
}

// Or use the convenience gate.
if (capabilityDetector.supports(VaultContractDescriptor, VaultABI, 'rewards:claim')) {
  // safe to call claimRewards
}
```

## Compatibility matrix example

The shipped `VaultContractDescriptor` declares `getBalance` / `getAssetsBalance`,
but `VaultABI` exposes `balanceOf` (and several methods the descriptor never
maps). Detection reports this genuine mismatch rather than hiding it:

```typescript
const result = capabilityDetector.detect(VaultContractDescriptor, VaultABI);

result.supported;
// → ['shares:convert', 'assets:deposit', 'assets:withdraw', 'rewards:read', 'rewards:claim']

result.missing;
// → ['balance:read', 'assets:read']   (descriptor's getBalance/getAssetsBalance are not in the ABI)

result.undeclaredMethods;
// → ['totalAssets', 'totalSupply', 'balanceOf', 'apy', 'lockPeriod']

result.complete;
// → false
```

This surfaces real deployment drift between the declared descriptor and the
actual ABI — it is **not** an error in the detector, and the descriptor/ABI are
intentionally left as-is.

## API

### `capabilityDetector` / `new CapabilityDetector(reflection?, registry?)`

A shared `CapabilityDetector` singleton is exported for typical use. The class
accepts an optional `ContractReflectionService` and `CapabilityRegistry` for
testing or custom wiring.

#### `detect(descriptor, abi, options?) → CapabilityDetectionResult`

Reconciles `descriptor` against `abi` and returns the detection result.

- `abi` — a standard JSON ABI (array or ethers-compatible string).
- `options.cacheKey` — explicit cache key; defaults to a stable key derived from
  the descriptor's `contractId` (or `type`) and the ABI.
- `options.validate` — defaults to `true`. When `true`, an invalid descriptor
  throws a `ValidationError`. An unparseable ABI always throws a `ValidationError`.

#### `supports(descriptor, abi, capability, options?) → boolean`

Convenience gate: returns whether `capability` is in the detected `supported`
set.

#### `clearCache() → void`

Clears all cached detection results.

## Caching

Detection results are cached per contract/ABI and returned as **deep clones**,
so callers can freely mutate a result without corrupting the cache — mirroring
the clone-on-read behaviour of the reflection API and the SDK's registries. Use
`clearCache()` to force re-detection (for example after an ABI changes under a
reused `cacheKey`).
