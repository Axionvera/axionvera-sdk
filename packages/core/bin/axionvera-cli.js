#!/usr/bin/env node
// axionvera-cli — Soroban contract code generator
// Usage: axionvera-cli codegen <contract.wasm> [options]
//
// Options:
//   --out, -o <dir>       Output directory (default: current directory)
//   --name, -n <name>     Class name (default: derived from wasm filename)
//   --import <path>       Import path for @axionvera/core (default: "@axionvera/core")
//   --help, -h            Show this help message

"use strict";

const path = require("path");
const fs = require("fs");

// ─── Argument parsing ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function printHelp() {
  console.log(`
axionvera-cli — Soroban contract TypeScript code generator

Usage:
  axionvera-cli codegen <contract.wasm> [options]

Options:
  --out, -o <dir>     Output directory (default: current directory)
  --name, -n <name>   Class name (default: derived from wasm filename)
  --import <path>     Import path for @axionvera/core (default: "@axionvera/core")
  --help, -h          Show this help message

Example:
  axionvera-cli codegen ./target/wasm32-unknown-unknown/release/my_token.wasm \\
    --out ./src/contracts \\
    --name TokenContract
`);
}

if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  printHelp();
  process.exit(0);
}

const command = args[0];

if (command !== "codegen") {
  console.error(`Unknown command: ${command}. Run with --help for usage.`);
  process.exit(1);
}

// Parse remaining flags
let wasmPath = null;
let outDir = process.cwd();
let className = null;
let coreImport = "@axionvera/core";

for (let i = 1; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--out" || arg === "-o") {
    outDir = args[++i];
  } else if (arg === "--name" || arg === "-n") {
    className = args[++i];
  } else if (arg === "--import") {
    coreImport = args[++i];
  } else if (!arg.startsWith("-")) {
    wasmPath = arg;
  } else {
    console.error(`Unknown option: ${arg}. Run with --help for usage.`);
    process.exit(1);
  }
}

if (!wasmPath) {
  console.error("Error: <contract.wasm> path is required.");
  printHelp();
  process.exit(1);
}

// Resolve paths
const resolvedWasm = path.resolve(process.cwd(), wasmPath);

if (!fs.existsSync(resolvedWasm)) {
  console.error(`Error: WASM file not found: ${resolvedWasm}`);
  process.exit(1);
}

// Derive class name from filename if not provided
if (!className) {
  const base = path.basename(resolvedWasm, ".wasm");
  // snake_case → PascalCase + "Contract" suffix
  className = base
    .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toUpperCase());
  if (!className.toLowerCase().endsWith("contract")) {
    className += "Contract";
  }
}

// ─── Run codegen ──────────────────────────────────────────────────────────────

// We require the compiled dist files. If running from source (ts-node / tests),
// the TypeScript files are loaded directly via ts-node's require hook.
// In production (after `npm run build`), the dist/ CJS files are used.
function requireCodegen() {
  // Try dist first (production)
  const distParser = path.join(__dirname, "../dist/codegen/wasmParser.js");
  const distGenerator = path.join(__dirname, "../dist/codegen/generator.js");
  if (fs.existsSync(distParser) && fs.existsSync(distGenerator)) {
    return {
      parseWasm: require(distParser).parseWasm,
      generateContractClass: require(distGenerator).generateContractClass,
    };
  }
  // Fallback: try src (ts-node environment)
  const srcParser = path.join(__dirname, "../src/codegen/wasmParser.ts");
  if (fs.existsSync(srcParser)) {
    // Register ts-node if available
    try { require("ts-node/register"); } catch (_) {}
    return {
      parseWasm: require(srcParser).parseWasm,
      generateContractClass: require(path.join(__dirname, "../src/codegen/generator.ts")).generateContractClass,
    };
  }
  throw new Error(
    "Could not locate codegen modules. Run `npm run build` in packages/core first."
  );
}

let parseWasm, generateContractClass;
try {
  ({ parseWasm, generateContractClass } = requireCodegen());
} catch (err) {
  console.error(`Error loading codegen modules: ${err.message}`);
  process.exit(1);
}

console.log(`Parsing WASM spec from: ${resolvedWasm}`);

let spec;
try {
  spec = parseWasm(resolvedWasm);
} catch (err) {
  console.error(`Error parsing WASM: ${err.message}`);
  process.exit(1);
}

console.log(
  `Found ${spec.functions.length} function(s), ` +
  `${spec.structs.length} struct(s), ` +
  `${spec.enums.length} enum(s).`
);

const source = generateContractClass(spec, className, coreImport);

// Write output file
const resolvedOut = path.resolve(process.cwd(), outDir);
fs.mkdirSync(resolvedOut, { recursive: true });

const outFile = path.join(resolvedOut, `${className}.ts`);
fs.writeFileSync(outFile, source, "utf8");

console.log(`Generated: ${outFile}`);
