"use strict";

// axionvera-cli codegen — generate a TypeScript contract client from a WASM spec.

const path = require("path");
const fs = require("fs");

const PKG_ROOT = path.join(__dirname, "..", "..");

const HELP = `
axionvera-cli codegen — Soroban contract TypeScript code generator

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
`;

function run(argv) {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    console.log(HELP);
    return;
  }

  let wasmPath = null;
  let outDir = process.cwd();
  let className = null;
  let coreImport = "@axionvera/core";

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out" || arg === "-o") {
      outDir = argv[++i];
    } else if (arg === "--name" || arg === "-n") {
      className = argv[++i];
    } else if (arg === "--import") {
      coreImport = argv[++i];
    } else if (!arg.startsWith("-")) {
      wasmPath = arg;
    } else {
      console.error(`Unknown option: ${arg}. Run with --help for usage.`);
      process.exit(1);
    }
  }

  if (!wasmPath) {
    console.error("Error: <contract.wasm> path is required.");
    console.log(HELP);
    process.exit(1);
  }

  const resolvedWasm = path.resolve(process.cwd(), wasmPath);
  if (!fs.existsSync(resolvedWasm)) {
    console.error(`Error: WASM file not found: ${resolvedWasm}`);
    process.exit(1);
  }

  if (!className) {
    const base = path.basename(resolvedWasm, ".wasm");
    className = base
      .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
      .replace(/^(.)/, (_, c) => c.toUpperCase());
    if (!className.toLowerCase().endsWith("contract")) {
      className += "Contract";
    }
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

  const resolvedOut = path.resolve(process.cwd(), outDir);
  fs.mkdirSync(resolvedOut, { recursive: true });

  const outFile = path.join(resolvedOut, `${className}.ts`);
  fs.writeFileSync(outFile, source, "utf8");

  console.log(`Generated: ${outFile}`);
}

// Loads the codegen implementation from @axionvera/codegen package.
function requireCodegen() {
  // Try to require the built @axionvera/codegen package first
  try {
    return require("@axionvera/codegen");
  } catch (err) {
    // If that fails, try to require it from the source (for development)
    const codegenPkgPath = path.join(PKG_ROOT, "..", "codegen");
    const srcIndex = path.join(codegenPkgPath, "src/index.ts");
    if (fs.existsSync(srcIndex)) {
      try {
        require("ts-node/register");
      } catch (_) {}
      return require(srcIndex);
    }
    throw new Error(`Could not load @axionvera/codegen: ${err.message}. Ensure dependencies are installed.`);
  }
}

module.exports = { run, HELP };
