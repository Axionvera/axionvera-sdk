# Release Readiness Check

The Axionvera SDK includes a release readiness script to verify that the repository is ready for live testnet deployment. This script provides a repeatable check of all required components before connecting to production networks.

## Overview

The release readiness script (`scripts/release-readiness.js`) performs comprehensive checks to ensure:

- All required documentation is present and complete
- Example files are available for users
- Schema files are present for interface compatibility
- Build outputs are generated correctly
- Quality commands (lint, typecheck, build, tests) pass successfully

## Usage

### Full Check

Run the complete readiness check including all quality commands:

```bash
node scripts/release-readiness.js
```

This will:
1. Check file existence for docs, examples, schemas, and build outputs
2. Run `npm run lint`
3. Run `npm run typecheck`
4. Run `npm run build`
5. Run `npx vitest run`

### Dry Run

Run only file existence checks without executing quality commands:

```bash
node scripts/release-readiness.js --dry-run
```

Use this mode for quick verification of file structure without waiting for builds and tests.

## Checks Performed

### Documentation Check

Verifies the presence of required documentation files:

**Root Documentation:**
- `README.md` - Main project documentation
- `CONTRIBUTING.md` - Contribution guidelines
- `LICENSE` - License information
- `SECURITY.md` - Security policy

**Package Documentation:**
- `packages/core/README.md` - Core package documentation
- `packages/react/README.md` - React package documentation

### Examples Check

Verifies that example files are present for users to reference:

- `examples/execution-examples.ts` - Execution workflow examples
- `examples/mock-simulation-example.ts` - Mock simulation examples
- `examples/mock-wallet-signing-pipeline.ts` - Wallet signing pipeline examples
- `examples/react-vault-example.tsx` - React vault integration example
- `examples/sdk-network-compatibility-example.ts` - SDK-to-network compatibility examples

### Schemas Check

Verifies schema files for interface compatibility:

- `schemas/network-vault-interface.fixture.json` - Network vault interface fixture

### Build Outputs Check

Verifies that build outputs are generated:

- `packages/core/dist` - Core package build output
- `packages/react/dist` - React package build output

### Quality Commands Check

Runs all quality assurance commands:

1. **Lint** - `npm run lint` - ESLint code quality checks
2. **TypeCheck** - `npm run typecheck` - TypeScript type checking
3. **Build** - `npm run build` - Package compilation
4. **Test** - `npx vitest run` - Unit and integration tests

## Exit Codes

- `0` - All checks passed, SDK is ready for release
- `1` - One or more checks failed

## Output Format

The script provides color-coded output:

- ✓ Green - Check passed
- ✗ Red - Check failed
- ⚠ Yellow - Warning (e.g., missing build outputs in dry-run mode)
- ℹ Blue - Informational message

### Example Successful Output

```
============================================================
Documentation Check
============================================================
ℹ Checking root documentation files...
✓ README.md
✓ CONTRIBUTING.md
✓ LICENSE
✓ SECURITY.md
ℹ Checking package README files...
✓ packages/core/README.md
✓ packages/react/README.md

============================================================
Examples Check
============================================================
ℹ Checking example files...
✓ examples/execution-examples.ts
✓ examples/mock-simulation-example.ts
✓ examples/mock-wallet-signing-pipeline.ts
✓ examples/react-vault-example.tsx
✓ examples/sdk-network-compatibility-example.ts

============================================================
Schemas Check
============================================================
ℹ Checking schema files...
✓ schemas/network-vault-interface.fixture.json

============================================================
Build Outputs Check
============================================================
ℹ Checking build output directories...
✓ packages/core/dist (exists with content)
✓ packages/react/dist (exists with content)

============================================================
Quality Commands Check
============================================================
ℹ Running Lint...
✓ Lint passed
ℹ Running TypeCheck...
✓ TypeCheck passed
ℹ Running Build...
✓ Build passed
ℹ Running Test...
✓ Test passed

============================================================
Summary
============================================================
✓ Documentation: PASSED
✓ Examples: PASSED
✓ Schemas: PASSED
✓ Build Outputs: PASSED
✓ Quality Commands: PASSED

============================================================
Final Verdict
============================================================
✓ All checks passed! SDK is ready for release.
```

### Example Failed Output

```
============================================================
Build Outputs Check
============================================================
ℹ Checking build output directories...
⚠ packages/core/dist (missing or empty - run 'npm run build' first)
⚠ packages/react/dist (missing or empty - run 'npm run build' first)

============================================================
Quality Commands Check
============================================================
ℹ Running Lint...
✗ Lint failed
/path/to/file.ts:10:5 - Error: Unexpected console statement

============================================================
Summary
============================================================
✓ Documentation: PASSED
✓ Examples: PASSED
✓ Schemas: PASSED
✗ Build Outputs: FAILED
✗ Quality Commands: FAILED

============================================================
Final Verdict
============================================================
✗ Some checks failed. Please fix the issues above.

Suggestions:
  - Run "npm run build" to generate build outputs
  - Fix linting, type checking, build, or test failures
  - Run individual commands: npm run lint, npm run typecheck, npm run build, npx vitest run
```

## Integration with CI/CD

The release readiness script can be integrated into CI/CD pipelines as a gate before deployment:

```yaml
# Example GitHub Actions workflow
- name: Run release readiness check
  run: node scripts/release-readiness.js
```

## Customization

The script configuration can be modified in the `CONFIG` object within `scripts/release-readiness.js` to:

- Add or remove required documentation files
- Add or remove required example files
- Add or remove required schema files
- Modify quality commands
- Adjust build output paths

## Troubleshooting

### Build Outputs Missing

If build outputs are missing, run:
```bash
npm run build
```

### Quality Commands Failing

Run individual commands to identify specific issues:
```bash
npm run lint          # Check for linting issues
npm run typecheck     # Check for type errors
npm run build         # Check for build errors
npx vitest run        # Check for test failures
```

### File Permission Issues

Ensure the script is executable:
```bash
chmod +x scripts/release-readiness.js
```

## Requirements

- Node.js 18+
- npm dependencies installed (`npm ci`)
- No secrets or package publishing tokens required

## Notes

- The script does not publish packages to npm
- The script does not require live network connections
262→- All checks are performed locally
263→- The script is designed to be run before connecting to live testnet deployment
264→
265→## Release Packet Generation
266→
267→For a more formal review process, use the [Release Packet Generator](./release-packet-generator.md) to collect non-secret artifacts into a single reviewable folder.
