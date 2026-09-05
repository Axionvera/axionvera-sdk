# Release Packet Generator

The Axionvera SDK includes a release packet generator script that collects non-secret SDK readiness artifacts into a single folder for maintainer review before testnet connection.

## Overview

The generator script (`scripts/generate-release-packet.js`) gathers relevant files, excludes secrets, and produces a `manifest.json` describing the packet's contents. This is used by maintainers to verify that all necessary components (docs, examples, schemas, build outputs) are present and correct before proceeding with a release.

## Usage

Run the generator script from the root directory:

```bash
node scripts/generate-release-packet.js
```

This will:
1. Create a `release-packet/` directory in the root.
2. Copy root and package-specific documentation.
3. Copy relevant example files.
4. Copy schema fixtures.
5. Copy build outputs (`dist/` folders).
6. Generate a `manifest.json` containing metadata, artifact list, and readiness summaries.

## Maintainer Review Workflow

Maintainers should follow these steps to review a release packet:

1. **Generate the Packet**: Run `node scripts/generate-release-packet.js`.
2. **Review Manifest**: Open `release-packet/manifest.json` to verify the version, timestamp, and that all expected artifacts are listed with valid checksums.
3. **Inspect Documentation**: Ensure `README.md` and package-specific READMEs are up-to-date and reflect current features.
4. **Verify Examples**: Check that examples (e.g., `examples/react-mvp-demo.tsx`) are runnable and follow best practices.
5. **Check Build Outputs**: Verify that `packages/core/dist` and `packages/react/dist` contain the expected bundle files.
6. **Confirm Quality Summary**: In `manifest.json`, verify that `readinessSummary` fields (`lint`, `typecheck`, `build`) are `true`.
7. **Security Audit**: Ensure no secret files (`.env`, private keys, etc.) have been accidentally included in the `release-packet/` folder.

## Manifest Schema

The `manifest.json` follows the `ReleasePacketManifestSchema` defined in the SDK. It includes:

- `version`: SDK version.
- `timestamp`: Generation time.
- `artifacts`: Array of objects containing `path`, `type`, `description`, and `checksum`.
- `readinessSummary`: Results of lint, typecheck, and build commands.

## Security

The generator script includes a `secretPatterns` exclusion list to prevent sensitive files from being included. It explicitly skips:
- `.env` files
- Files containing "token", "secret", "key", "private", or "mnemonic" in their names.

Maintainers must still perform a final manual check of the `release-packet/` directory before sharing it.
