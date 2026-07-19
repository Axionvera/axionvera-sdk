# SDK Dependency Graph Analyzer

Use the dependency graph analyzer to inspect internal SDK module imports, find circular dependencies, and spot modules with high fan-in or fan-out before refactors land.

## Command

```bash
npm run analyze:deps
```

The default command scans `src/` and prints a Markdown report. For machine-readable output, run:

```bash
node scripts/analyze-dependencies.js --root src --format json
```

To fail CI or a local check when a cycle appears:

```bash
node scripts/analyze-dependencies.js --root src --fail-on-cycles
```

## Report Fields

- `nodes`: analyzed source files, relative to the selected root.
- `edges`: internal imports resolved from one source file to another.
- `cycles`: circular dependency paths, normalized so duplicate rotations collapse into one result.
- `coupling`: fan-in, fan-out, and total coupling counts per module.
- `externalImports`: external package or Node builtin imports grouped by source file.

## What It Detects

The analyzer reads TypeScript and JavaScript files, resolves relative imports to files or `index` modules, and supports:

- `import ... from "./module"`
- `export ... from "./module"`
- side-effect imports such as `import "./polyfill"`
- dynamic imports such as `import("./lazy")`
- CommonJS `require("./legacy")`

External imports are reported but are not treated as internal graph edges.

## Contributor Workflow

Run the analyzer before reorganizing SDK modules. A clean report should have no cycles and should keep coupling hotspots intentional. If a module has both high fan-in and high fan-out, document why it is a stable coordination point or split responsibilities before adding more imports.
