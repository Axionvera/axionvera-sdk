# Contributing to Axionvera SDK

Thanks for contributing to `axionvera-sdk`. This guide explains how to set up the project locally, run the development workflow, validate your changes, and open a pull request that is ready for review.

## Local Environment Setup

### Prerequisites

- Git
- Node.js 20.x
- npm

Node.js 20 is the recommended contributor runtime because the repository's CI and publish workflows run on Node 20. The current toolchain also includes packages that require Node 20 or newer, so using Node 20 LTS locally is the safest way to match automation.

You can verify your environment with:

```bash
node -v
npm -v
```

### Clone and install

```bash
git clone https://github.com/axionvera/axionvera-sdk.git
cd axionvera-sdk
npm ci
```

Use `npm ci` instead of `npm install` for contributor setup because it installs exactly what is locked in `package-lock.json`, which keeps local results closer to CI.

## Repository Layout

- `src/client`: Stellar RPC connectivity and client behavior
- `src/contracts`: contract-specific modules such as the vault integration
- `src/wallet`: wallet connector interfaces and implementations
- `src/utils`: shared helpers such as network config and transaction building
- `tests`: unit and end-to-end Jest coverage
- `examples`: example scripts showing SDK usage
- `docs`: additional SDK documentation
- `dist`: compiled output generated during builds

## Development Workflow

Most contributions follow this lifecycle:

1. Create a branch from `main`.
2. Install dependencies with `npm ci`.
3. Make your code or documentation changes.
4. Run the relevant validation scripts locally.
5. Commit using Conventional Commits.
6. Open a pull request with a clear description of the change.

## Script Lifecycle

The main project scripts are defined in `package.json` and are the same commands used by CI.

### `npm run clean`

Removes the generated `dist` directory.

```bash
npm run clean
```

Run this if you want to clear compiled artifacts before rebuilding.

### `npm run build`

Builds the SDK into `dist/` using the TypeScript compiler.

```bash
npm run build
```

This command runs `clean` first and then compiles the source using `tsconfig.json`.

### `npm run typecheck`

Checks TypeScript types without emitting build output.

```bash
npm run typecheck
```

Run this while developing if you want a fast signal on type safety before a full build.

### `npm run lint`

Runs ESLint against the TypeScript source files.

```bash
npm run lint
```

Use this before opening a pull request to catch style and static-analysis issues.

### `npm run test`

Runs the Jest test suite.

```bash
npm run test
```

The repository includes both unit tests and end-to-end style tests under `tests/`.

### `npm run size`

Checks the production bundle size against the limits defined in `.size-limit.json`.

```bash
npm run size
```

### Dry-run Release Preview

You can preview the next version number and the generated changelog without actually performing a release by running the dry-run command. This is recommended to verify that your commit messages follow the convention correctly:

```bash
npm run release:dry-run
```

### Recommended pre-PR validation

Before submitting a pull request, run:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run size
```

These are the same validation areas enforced in GitHub Actions.

## Branching and Pull Requests

When opening a pull request:

- Keep the scope focused on one issue or change set.
- Add or update tests when behavior changes.
- Update docs or examples if the public API or developer workflow changes.
- Mention any breaking changes clearly in the PR description.
- Link the relevant GitHub issue when applicable.

Small, reviewable pull requests are much easier to merge quickly.

## Commit Message Convention

This repository uses Conventional Commits. Commit messages should follow this format:

```text
<type>(optional-scope): <short summary>
```

Examples:

```text
feat(vault): add reward claim helper
fix(client): handle missing rpc health response
docs(contributing): expand local development guide
test(retry): cover backoff edge cases
chore(ci): tighten publish validation
```

Common commit types:

- `feat`: a new feature
- `fix`: a bug fix
- `docs`: documentation-only changes
- `test`: test additions or updates
- `refactor`: internal code changes without a feature or bug fix
- `chore`: maintenance work such as tooling or CI updates

Use the imperative mood and keep the summary concise.

Conventional Commits matter here because release automation is configured with `semantic-release`, which uses commit history to determine version bumps and release notes.

## Testing the SDK Locally with `npm link`

If you need to test changes in a separate application before publishing a package, you can link the SDK into another local project.

### Step 1: Build the SDK

From this repository:

```bash
npm ci
npm run build
```

### Step 2: Create the global link

Still inside this repository:

```bash
npm link
```

This registers your local `axionvera-sdk` package globally on your machine.

### Step 3: Link it into a consumer project

In the other local project where you want to test the SDK:

```bash
npm link axionvera-sdk
```

That project will now resolve `axionvera-sdk` to your local checkout instead of the published package.

### Step 4: Rebuild after changes

If you edit SDK source files, rebuild the package so the consumer app sees updated output:

```bash
npm run build
```

If the consumer project is running a dev server or test watcher, restart it if needed after rebuilding.

### Step 5: Remove the link when finished

In the consumer project:

```bash
npm unlink axionvera-sdk
```

In this SDK repository, if you also want to remove the global registration:

```bash
npm unlink
```

## Reporting Issues

Use the GitHub issue templates when possible:

- Bug reports: `.github/ISSUE_TEMPLATE/bug_report.md`
- Feature requests: `.github/ISSUE_TEMPLATE/feature_request.md`

Include reproduction steps, expected behavior, and actual behavior whenever you can.

## Code of Conduct

Please be respectful, constructive, and professional in all project interactions. Clear, kind collaboration helps everyone move faster.
