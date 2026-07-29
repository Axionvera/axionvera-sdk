# Axionvera SDK Architecture

## Barrel-Export Convention

Every submodule folder under `src/` **MUST** have an `index.ts` that serves as the single public surface for that module. This barrel file is the only import target for code outside the module's own folder.

### Rules

1. **Every folder under `src/` must have an `index.ts` barrel.**

   The barrel re-exports all public symbols from the files within that folder. Private/internal symbols (not exported from the barrel) remain inaccessible to other modules.

2. **Cross-module imports must go through barrel `index.ts` files.**

   When importing from another module, always import from the barrel path (e.g. `'../observability'`), never from a sibling file within that module (e.g. `'../observability/types'`).

3. **Same-folder imports may use direct file paths.**

   Inside a single module folder, sibling files may import from each other directly (e.g. `'./types'`) without going through the barrel. The barrel is the boundary — everything inside the folder is an implementation detail.

4. **The top-level `src/index.ts` is the SDK's public API.**

   All consumer-facing exports flow through `src/index.ts`. Internal modules re-export up through `src/index.ts` using barrel paths only (e.g. `'./errors'` instead of `'./errors/axionveraError'`).

5. **Barrel files should use explicit named exports where practical.**

   Prefer `export { Foo } from './foo'` over `export * from './foo'`. Wildcard re-exports are acceptable when a module has many symbols and the author wants to re-export everything, but explicit exports are clearer and easier to audit.

### Example

```
src/
  errors/
    axionveraError.ts   ← defines AxionveraError, NetworkError, etc.
    index.ts            ← re-exports everything from axionveraError.ts
  batch/
    batchExecutor.ts    ← imports from '../errors' (barrel), NOT '../errors/axionveraError'
    index.ts            ← re-exports BatchExecutor, etc.
```

### Rationale

- **Single point of truth**: The barrel is the one place to understand what a module exposes.
- **Refactoring safety**: Internal file renames/restructuring don't break external consumers.
- **Import brevity**: `'../errors'` is shorter and clearer than `'../errors/axionveraError'`.
- **Dependency clarity**: Dependencies between modules are explicit at the barrel level.
