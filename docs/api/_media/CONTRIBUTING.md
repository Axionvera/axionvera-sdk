# Contributing to Axionvera SDK

## Development Setup

```bash
npm i
npm test
npm run typecheck
npm run build
```

## Project Structure

- `src/client`: RPC connectivity and network helpers
- `src/contracts`: contract-specific modules (Vault, future modules)
- `src/wallet`: wallet connector interface and implementations
- `src/utils`: shared utilities (network config, transaction builder)
- `tests`: Jest tests (mocked/simulated interactions)
- `examples`: runnable example scripts
- `docs`: additional architecture and usage documentation

## Pull Requests

- Keep changes focused and small when possible
- Add/adjust tests for any behavior change
- Prefer existing patterns and naming conventions
- Avoid breaking public APIs unless necessary; if breaking, document migration

## Reporting Issues

Use the GitHub issue templates:

- Bug reports: `.github/ISSUE_TEMPLATE/bug_report.md`
- Feature requests: `.github/ISSUE_TEMPLATE/feature_request.md`

## Code of Conduct

Be respectful and constructive. This project follows the standard open-source expectation of professional, inclusive collaboration.
