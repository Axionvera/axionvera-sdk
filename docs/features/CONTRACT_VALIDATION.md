# Contract Schema Validation Framework

This feature adds a schema validation framework that verifies contract method
inputs and outputs before they reach the network, so invalid calls fail fast
with a descriptive error instead of as an opaque on-chain revert.

## Schema Design Rationale

- **valibot, not a bespoke parser.** `valibot` is already a dependency
  (`src/utils/rpcSchemas.ts` uses it to validate RPC responses), so the
  framework builds on the same primitives instead of introducing a second
  validation library. Any valibot schema can be registered as-is.
- **Schemas are keyed by a logical contract id, not an address.** A contract
  type (e.g. `"Vault"`) is usually instantiated multiple times with the same
  method shapes, so `ContractValidationEngine` keys schemas by
  `${contractId}::${method}` rather than by deployed address.
- **Validation is opt-in per method.** Calling `validateParams`/`validateResult`
  for a method with no registered schema returns the value unchanged. This
  lets a contract module adopt validation incrementally.
- **Params and result schemas are independent.** A method can validate just
  its inputs, just its outputs, or both — matching methods that only read or
  only write.

## Components

| File | Purpose |
| --- | --- |
| `src/types/validation.ts` | Shared types: `ValidationIssue`, `ContractMethodSchema`, `AnyValidationSchema`. |
| `src/validation/engine.ts` | `ContractValidationEngine` (the registry), `validateAgainstSchema`, `withSchemaValidation`. |
| `src/validation/rules.ts` | Reusable schema primitives (`positiveBigIntSchema`, `stellarAccountIdSchema`, ...) and `customRule()`. |
| `src/contracts/contractSchemas.ts` | Example registrations for a Vault-style contract's `deposit`/`withdraw`/`getVaultInfo`/`getBalance`. |
| `src/errors/axionveraError.ts` | `SchemaValidationError`, carrying `contractId`, `method`, `kind`, and structured `issues`. |

## Usage Examples

### Registering a schema

```typescript
import * as v from 'valibot';
import { defaultValidationEngine, positiveBigIntSchema } from 'axionvera-sdk';

defaultValidationEngine.registerSchema('MyContract', 'transfer', {
  params: v.object({
    amount: positiveBigIntSchema(),
    to: v.string(),
  }),
  result: v.object({ txHash: v.string() }),
});
```

### Validating params and a result directly

```typescript
import { defaultValidationEngine, SchemaValidationError } from 'axionvera-sdk';

try {
  const params = defaultValidationEngine.validateParams('MyContract', 'transfer', {
    amount: -5n,
    to: 'GABC...',
  });
} catch (err) {
  if (err instanceof SchemaValidationError) {
    console.error(err.issues); // [{ path: 'amount', message: '...', received: -5n }]
  }
}
```

### Wrapping a method for automatic enforcement

```typescript
import { defaultValidationEngine, withSchemaValidation } from 'axionvera-sdk';

class MyContract {
  transfer = withSchemaValidation(
    defaultValidationEngine,
    'MyContract',
    'transfer',
    async (params: { amount: bigint; to: string }) => {
      // ... actual contract call ...
      return { txHash: '...' };
    }
  );
}
```

### Custom validation rules

```typescript
import * as v from 'valibot';
import { customRule } from 'axionvera-sdk';

// Any predicate can become a rule, not just the built-in ones
const lotSizedAmount = v.pipe(
  v.bigint(),
  customRule((value: bigint) => value > 0n, 'amount must be positive'),
  customRule((value: bigint) => value % 100n === 0n, 'amount must be a multiple of 100')
);
```

## Error Handling Strategy

Every validation failure throws `SchemaValidationError` (extends
`AxionveraError`, consistent with the rest of the SDK's error hierarchy). It
carries:

- `contractId` / `method` — which schema failed
- `kind` — `'params'` or `'result'`, so callers know which side of the call failed
- `issues` — one `{ path, message, received }` entry per offending field,
  rather than a single opaque message

The top-level error message is a human-readable summary (e.g. `Input
validation failed for "deposit" on contract "Vault": amount: Deposit amount
must be a positive bigint`), so logging just `err.message` is still useful
without inspecting `issues`.

## Testing Details

`tests/validation/` covers:

- `engine.test.ts` — registration (register/unregister/overwrite/custom
  contracts), pass-through when no schema is registered, descriptive errors
  with correct `contractId`/`method`/`kind`/`issues`, and `withSchemaValidation`.
- `rules.test.ts` — every built-in rule plus composing `customRule()` into a
  novel domain-specific rule.
- `contractSchemas.test.ts` — the example Vault schemas, exercised through
  the shared `defaultValidationEngine`.
- `schemaValidationError.test.ts` — the error class itself (inheritance,
  properties, message, `originalError`).

All new tests import directly from the relevant `src/` module rather than the
package's `src/index.ts` barrel.

## Known Pre-Existing Issue (Not Part of This Change)

`src/client/stellarClient.ts` and `src/contracts/vault.ts` already contain
unrelated syntax errors from a prior bad merge (duplicated/dangling code
blocks), which were present on this branch before this change and cause
`npm run typecheck` / `npm run build` and ~41 test suites to fail regardless
of this feature. This framework was built and tested without depending on
either file, but a repo-wide green build will require a separate fix to those
two files.
