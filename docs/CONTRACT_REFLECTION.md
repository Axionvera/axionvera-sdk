# Contract Interface Reflection API

The reflection API inspects a deployed contract's interface and exposes its
**methods** and **events** as plain, serializable metadata. It lets you build
dynamic tooling — explorers, form generators, call routers — without hardcoding
a contract's surface.

Reflection is built on top of the **standard JSON ABI**. Parsing is delegated to
[`ethers.Interface`](https://docs.ethers.org/v6/api/abi/#Interface) — the same
parser the SDK's `Vault` contract already uses — so no bespoke metadata format is
introduced. Anything ethers can parse (an ABI array or a human-readable ABI
string) can be reflected.

## Quick start

```typescript
import { contractReflection, VaultABI } from 'axionvera-sdk';

// Every callable method, with signatures, selectors and I/O types.
const methods = contractReflection.getMethods(VaultABI);
// → [{ name: 'deposit', signature: 'deposit(uint256)', selector: '0xb6b55f25',
//      stateMutability: 'payable', payable: true, constant: false,
//      inputs: [{ name: 'assets', type: 'uint256' }],
//      outputs: [{ name: 'shares', type: 'uint256' }] }, ...]

// Every declared event, with topic hashes and indexed flags.
const events = contractReflection.getEvents(VaultABI);
// → [{ name: 'Deposit', signature: 'Deposit(address,address,uint256,uint256)',
//      topicHash: '0x...', anonymous: false,
//      inputs: [{ name: 'sender', type: 'address', indexed: true }, ...] }, ...]

// Look up a single method or event by name.
const deposit = contractReflection.getMethod(VaultABI, 'deposit');
const depositEvent = contractReflection.getEvent(VaultABI, 'Deposit');

// Full reflection (methods + events) in one call.
const { methods: m, events: e } = contractReflection.reflect(VaultABI);
```

## API

`contractReflection` is a shared `ContractReflectionService` instance. Construct
your own with `new ContractReflectionService()` when you want an isolated cache.

| Method                           | Returns                        | Description                         |
| -------------------------------- | ------------------------------ | ----------------------------------- |
| `reflect(abi, options?)`         | `ContractReflection`           | Methods **and** events for the ABI. |
| `getMethods(abi, options?)`      | `ReflectedMethod[]`            | All callable functions.             |
| `getMethod(abi, name, options?)` | `ReflectedMethod \| undefined` | One function by name.               |
| `getEvents(abi, options?)`       | `ReflectedEvent[]`             | All declared events.                |
| `getEvent(abi, name, options?)`  | `ReflectedEvent \| undefined`  | One event by name.                  |
| `clearCache()`                   | `void`                         | Drops all cached reflections.       |

### `ReflectedMethod`

| Field                | Type                                            | Notes                               |
| -------------------- | ----------------------------------------------- | ----------------------------------- |
| `name`               | `string`                                        | Function name.                      |
| `signature`          | `string`                                        | e.g. `deposit(uint256)`.            |
| `selector`           | `string`                                        | 4-byte selector, e.g. `0xb6b55f25`. |
| `stateMutability`    | `'pure' \| 'view' \| 'nonpayable' \| 'payable'` | As declared in the ABI.             |
| `payable`            | `boolean`                                       | `stateMutability === 'payable'`.    |
| `constant`           | `boolean`                                       | `true` for `view`/`pure`.           |
| `inputs` / `outputs` | `ReflectedParameter[]`                          | Ordered `{ name, type }`.           |

### `ReflectedEvent`

| Field       | Type                   | Notes                                            |
| ----------- | ---------------------- | ------------------------------------------------ |
| `name`      | `string`               | Event name.                                      |
| `signature` | `string`               | e.g. `Deposit(address,address,uint256,uint256)`. |
| `topicHash` | `string`               | keccak-256 `topic0`, used to filter logs.        |
| `anonymous` | `boolean`              | Whether the event is `anonymous`.                |
| `inputs`    | `ReflectedParameter[]` | Each parameter carries an `indexed` flag.        |

## How events are sourced

Events are read from the ABI's standard `type: 'event'` fragments — part of the
JSON ABI specification and parsed natively by `ethers.Interface`. The SDK's
`VaultABI` declares the ERC-4626 `Deposit` and `Withdraw` events, so they are
discoverable out of the box:

```typescript
contractReflection.getEvents(VaultABI).map((e) => e.name);
// → ['Deposit', 'Withdraw']
```

Any ABI you pass is reflected the same way: declare an event as a `type: 'event'`
fragment and it becomes discoverable. Reflection covers the **static interface**
(what a contract _can_ emit). To observe **live** events at runtime, use the
SDK's Soroban event tooling (`ContractEventEmitter`, `parseEvents`).

## Surfacing discovery metadata

The SDK's higher-level `ContractDescriptor` (capabilities, display name,
versions) can be surfaced alongside the reflected interface by passing it via
`options.descriptor`. The descriptor is attached as-is — its shape is never
modified:

```typescript
import { contractReflection, VaultABI, VaultContractDescriptor } from 'axionvera-sdk';

const reflection = contractReflection.reflect(VaultABI, {
  descriptor: VaultContractDescriptor,
});
reflection.descriptor?.capabilities; // ['balance:read', 'assets:deposit', ...]
```

## Caching

Parsed reflections are cached per contract/ABI. By default the cache key is
derived from the ABI itself, so identical ABIs share an entry. Pass an explicit
`cacheKey` (e.g. a contract id or logical name) to scope the cache per deployed
contract:

```typescript
contractReflection.getMethods(abi, { cacheKey: contractId });
```

Reads return a **clone** of the cached value, so mutating a result never
corrupts the cache. Call `clearCache()` to force re-parsing — for example after
an upgrade changes a contract's interface.

## Errors

If an ABI cannot be parsed, reflection throws a `ValidationError`
(`'Unable to reflect contract: the provided ABI could not be parsed'`) with the
underlying parser error attached as `originalError`. An empty ABI (`[]`) is valid
and reflects to no methods and no events.
