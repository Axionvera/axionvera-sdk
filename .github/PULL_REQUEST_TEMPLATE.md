## Summary

<!-- What does this PR do? Why is the change needed? Link the relevant issue if applicable. -->

Closes #

---

## Type of change

<!-- Check all that apply -->

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / internal improvement
- [ ] Documentation only
- [ ] Chore (CI, tooling, dependencies)
- [ ] Breaking change

---

## Testing

<!-- Describe what you tested and how. -->

- [ ] New or updated unit tests added under `tests/`
- [ ] All tests pass locally: `npm run test`
- [ ] E2E / integration tests updated where applicable

---

## Cleanup checklist

Before requesting review, confirm your PR meets the standards in [docs/CLEANUP_CHECKLIST.md](../docs/CLEANUP_CHECKLIST.md).

**Module boundaries**
- [ ] Cross-module imports go through each module's `index.ts` barrel — no deep imports
- [ ] New `src/` directories include an `index.ts` barrel
- [ ] No circular dependencies introduced

**Naming**
- [ ] Files, classes, and symbols follow the project naming conventions (see §2 of the checklist)

**Imports and exports**
- [ ] New public symbols are added to the relevant barrel and, where appropriate, to the root `src/index.ts`
- [ ] No new wildcard re-exports from non-aggregation files

**Tests**
- [ ] Every new public export has at least one test covering its happy path and error paths
- [ ] No `test.only` or `describe.only` left in committed files
- [ ] Mocks use the established helpers (`MockRpcServer`, `MockWalletConnector`, MSW handlers)

**Errors**
- [ ] New error conditions use a dedicated class that extends `AxionveraError`
- [ ] New error classes are exported from `src/errors/index.ts` and `src/index.ts`
- [ ] No secrets or sensitive values appear in error messages

**Config**
- [ ] Environment defaults are in `src/utils/networkConfig.ts` or the module config — no hardcoded URLs or magic strings in business logic
- [ ] New `StellarClientOptions` fields are optional with documented defaults

**Docs**
- [ ] TSDoc comments added for all new public exports
- [ ] `README.md` Module Architecture section updated if a new module was added
- [ ] Relevant `docs/` reference file updated for significant feature changes

**Code quality**
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npm run size` passes (or limits updated with justification)
- [ ] No `console.log` in library code — logger used instead
- [ ] No commented-out code blocks

---

## Breaking changes

<!-- If this PR contains breaking changes, describe them here and update MIGRATION_GUIDE.md if needed. -->

None / <!-- description -->

---

## Additional notes

<!-- Anything else reviewers should know? Screenshots, performance data, rollout considerations? -->
