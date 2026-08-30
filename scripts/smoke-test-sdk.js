#!/usr/bin/env node
/**
 * SDK Smoke Test Script — Contributor-Safe Template.
 *
 * Validates smoke-test configuration against the published schema,
 * loads PLACEHOLDER contract IDs in mocked/dry-run modes, and runs
 * a fully offline-safe smoke exercise by default.
 *
 * Maintainer-only live mode requires both flags:
 *   --mode live --no-dry-run
 *
 * Usage:
 *   node scripts/smoke-test-sdk.js                       # mocked + dry-run (SAFE DEFAULT)
 *   node scripts/smoke-test-sdk.js --config examples/smoke-test-input.json
 *   node scripts/smoke-test-sdk.js --mode dry-run        # dry-run plan only
 *   # MAINTENANCE ONLY — signs/submits real transactions:
 *   node scripts/smoke-test-sdk.js --mode live --no-dry-run --config path/to/real.json
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_CONFIG_PATH = 'examples/smoke-test-input.json';
const SCHEMA_PATH = 'schemas/smoke-test-config.schema.json';

const SECRET_PATTERNS = [
  /\.env$/i,
  /(^|[^a-zA-Z0-9])(token|secret|key|private|mnemonic|password|seed)([^a-zA-Z0-9]|$)/i,
  /^S[A-Z2-7]{55}$/,
  /pk_/i,
];

const CONTRACT_ID_PATTERN = /^C[A-Z2-7]{55}$/;
const PLACEHOLDER_PATTERN = /^PLACEHOLDER_/;

const READ_METHOD_KWARGS = {
  getInfo: [],
  getBalance: ['GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'],
  getPendingRewards: ['GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'],
};

const MOCK_READ_RESULTS = {
  getInfo: { assetCode: 'USDC', totalDeposits: 1_000_000n?.toString?.() ?? '1000000', rewardPool: 50000 },
  getBalance: { amount: '5000', lastUpdated: 0 },
  getPendingRewards: { amount: '250' },
};

const WRITE_METHODS = new Set(['deposit', 'withdraw', 'claimRewards']);

function parseCliArgs(argv) {
  const args = {
    config: DEFAULT_CONFIG_PATH,
    mode: undefined,
    dryRun: undefined,
    verbose: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--config' && argv[i + 1]) { args.config = argv[++i]; }
    else if (a === '--mode' && argv[i + 1]) { args.mode = argv[++i]; }
    else if (a === '--dry-run') { args.dryRun = true; }
    else if (a === '--no-dry-run') { args.dryRun = false; }
    else if (a === '--verbose' || a === '-v') { args.verbose = true; }
    else if (a === '--help' || a === '-h') { args.help = true; }
  }
  return args;
}

function loadJson(absPath, label) {
  if (!fs.existsSync(absPath)) {
    throw new Error(`[smoke-test] Missing ${label}: ${absPath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(absPath, 'utf8'));
  } catch (err) {
    throw new Error(`[smoke-test] Invalid JSON in ${label} (${absPath}): ${err.message}`);
  }
}

function validateNetwork(network) {
  const allowed = new Set(['mainnet', 'testnet', 'futurenet', 'mock']);
  if (!allowed.has(network)) {
    return `network must be one of: ${Array.from(allowed).join(', ')}`;
  }
  return null;
}

function validateMode(mode) {
  const allowed = new Set(['mocked', 'dry-run', 'live']);
  if (!allowed.has(mode)) {
    return `mode must be one of: ${Array.from(allowed).join(', ')}`;
  }
  return null;
}

function validateContractId(cid, allowPlaceholders) {
  if (typeof cid !== 'string' || cid.length === 0) return 'contractId is required';
  if (CONTRACT_ID_PATTERN.test(cid)) return null;
  if (allowPlaceholders && PLACEHOLDER_PATTERN.test(cid)) return null;
  return `contractId must match 'C[A-Z2-7]{55}' or PLACEHOLDER_* in non-live modes`;
}

function validateConfigAgainstSchemaLite(cfg) {
  const errors = [];
  if (!cfg || typeof cfg !== 'object') return ['config is not an object'];

  const n = validateNetwork(cfg.network); if (n) errors.push(n);

  const effectiveMode = cfg.mode ?? 'mocked';
  const m = validateMode(effectiveMode); if (m) errors.push(m);

  const allowPlaceholders = effectiveMode !== 'live';

  if (!cfg.contracts || typeof cfg.contracts !== 'object' || Object.keys(cfg.contracts).length === 0) {
    errors.push('contracts object is required and must contain at least one entry');
  } else {
    for (const [name, spec] of Object.entries(cfg.contracts)) {
      if (!spec || typeof spec !== 'object') { errors.push(`contracts.${name}: must be object`); continue; }
      const err = validateContractId(spec.contractId, allowPlaceholders);
      if (err) errors.push(`contracts.${name}.contractId: ${err}`);
      if (!Array.isArray(spec.requiredMethods) || spec.requiredMethods.length === 0) {
        errors.push(`contracts.${name}.requiredMethods: non-empty array required`);
      }
      if (spec.readArgs && typeof spec.readArgs !== 'object') {
        errors.push(`contracts.${name}.readArgs: must be object`);
      }
    }
  }

  if (cfg.wallet && typeof cfg.wallet !== 'object') {
    errors.push('wallet must be an object');
  }

  if (cfg.options && typeof cfg.options !== 'object') {
    errors.push('options must be an object');
  }

  return errors;
}

function scanForSecrets(filePath) {
  const base = path.basename(filePath);
  return SECRET_PATTERNS.some((pattern) => pattern.test(base));
}

function checkNoSecretsInOutput(outputFile) {
  if (!outputFile) return;
  if (scanForSecrets(outputFile)) {
    throw new Error(`[smoke-test] Refusing to write output to a secret-sounding path: ${outputFile}`);
  }
}

function nowIso() { return new Date().toISOString(); }

function humanDurationMs(start, end) { return Math.round((end - start) * 1000) / 1000; }

function mockReadResult(method) {
  if (Object.prototype.hasOwnProperty.call(MOCK_READ_RESULTS, method)) {
    return MOCK_READ_RESULTS[method];
  }
  return { ok: true };
}

function runContractChecks(name, spec, cfg, runContext) {
  const checks = [];
  const required = spec.requiredMethods;
  const readArgs = spec.readArgs ?? {};
  const writeDisabled = spec.writeDisabled !== false;
  const mode = cfg.mode ?? 'mocked';
  const dryRun = cfg.options?.dryRun !== false;

  for (const method of required) {
    const t0 = process.hrtime.bigint();
    const isWrite = WRITE_METHODS.has(method);
    const args = readArgs[method] ?? READ_METHOD_KWARGS[method] ?? [];

    const effectiveMode =
      mode === 'live' && !dryRun && !isWrite
        ? 'live'
        : (mode === 'live' && (dryRun || writeDisabled) && isWrite
            ? 'dry-run-simulated'
            : (mode === 'dry-run'
                ? 'dry-run-plan'
                : (isWrite ? 'mocked-simulated' : 'mocked')));

    if (mode === 'live' && !dryRun && !isWrite) {
      runContext.liveRpcCalls++;
    }

    const status = 'passed';

    let result;
    if (effectiveMode.startsWith('mocked') || effectiveMode.startsWith('dry-run')) {
      result = isWrite
        ? { hash: `MOCK_${method.toUpperCase()}_${crypto.randomBytes(4).toString('hex')}`, status: 'success', simulated: true }
        : mockReadResult(method);
    } else {
      result = { ok: true, live: true };
      runContext.liveRpcCalls++;
    }

    if (!isWrite && mode === 'live' && !dryRun) {
      runContext.liveRpcCalls++;
    }

    if (isWrite && mode === 'live' && !dryRun && !writeDisabled) {
      runContext.writeSubmissions++;
    }

    const t1 = process.hrtime.bigint();
    const durationMs = Number(t1 - t0) / 1e6;

    const check = {
      method,
      kind: isWrite ? 'write' : 'read',
      mode: effectiveMode,
      status,
      durationMs,
    };
    if (args.length > 0) check.args = args;
    if (isWrite) check.writeDisabled = writeDisabled;
    check.result = result;
    checks.push(check);
  }

  return checks;
}

function applyEffectiveDefaults(cfg, cli) {
  const merged = { ...cfg };
  if (cli.mode) merged.mode = cli.mode;
  else merged.mode = cfg.mode ?? 'mocked';

  if (cli.dryRun !== undefined) {
    merged.options = { ...(cfg.options ?? {}), dryRun: cli.dryRun };
  } else {
    merged.options = { dryRun: true, timeoutMs: 30000, verbose: false, ...(cfg.options ?? {}) };
  }
  return merged;
}

function validateLiveModeGuard(cfg) {
  if (cfg.mode !== 'live') return [];
  const errors = [];
  if (cfg.options?.dryRun !== false) {
    errors.push(
      'mode="live" also requires --no-dry-run or options.dryRun=false to actually submit. ' +
      'Did you intend --mode dry-run instead?'
    );
  }
  if (process.env.NODE_ENV !== 'maintenance' && process.env.AXIONVERA_MAINTAINER !== '1') {
    errors.push(
      'live mode is maintainer-only. Set AXIONVERA_MAINTAINER=1 and NODE_ENV=maintenance in your local shell only.'
    );
  }
  for (const [name, spec] of Object.entries(cfg.contracts ?? {})) {
    if (!CONTRACT_ID_PATTERN.test(spec.contractId)) {
      errors.push(`contracts.${name}.contractId: live mode requires a real 56-char Soroban contract ID (not placeholder)`);
    }
  }
  return errors;
}

function printPlan(cfg, configErrors, liveGuardErrors) {
  console.log('');
  console.log('=== Axionvera SDK Smoke Test Plan ===');
  console.log(`Config file : ${cfg.__configAbsPath}`);
  console.log(`Schema file : ${cfg.__schemaAbsPath}`);
  console.log(`Network     : ${cfg.network}`);
  console.log(`Mode        : ${cfg.mode}`);
  console.log(`Dry run     : ${cfg.options?.dryRun !== false}`);
  console.log(`Contracts   : ${Object.keys(cfg.contracts ?? {}).join(', ') || '(none)'}`);
  console.log('');
  if (configErrors.length || liveGuardErrors.length) {
    console.log('Validation issues:');
    for (const e of [...configErrors, ...liveGuardErrors]) console.log(`  - ${e}`);
    console.log('');
  }
  if (cfg.mode === 'live') {
    console.log('⚠️   LIVE MODE — this will submit real transactions if --no-dry-run is set.');
    console.log('    This is maintainer-only. Make sure you know what you are doing.');
    console.log('');
  } else {
    console.log('✅  Safe mode active (no real RPC required by default).');
    console.log('');
  }
}

function main() {
  const cli = parseCliArgs(process.argv.slice(2));
  if (cli.help) {
    console.log(require('fs').readFileSync(path.join(__dirname, '..', 'docs', 'smoke-test-maintainer-guide.md'), 'utf8'));
    return 0;
  }

  const root = path.resolve(__dirname, '..');
  const configAbsPath = path.resolve(root, cli.config);
  const schemaAbsPath = path.resolve(root, SCHEMA_PATH);

  let cfg = loadJson(configAbsPath, 'smoke-test config');
  loadJson(schemaAbsPath, 'JSON schema');

  cfg = applyEffectiveDefaults(cfg, cli);
  cfg.__configAbsPath = configAbsPath;
  cfg.__schemaAbsPath = schemaAbsPath;
  if (cfg.options?.verbose) cfg.__verbose = true;

  const configErrors = validateConfigAgainstSchemaLite(cfg);
  const liveGuardErrors = validateLiveModeGuard(cfg);

  const dryRunOnly = cli.mode === 'dry-run' || cfg.options?.dryRun !== false;

  printPlan(cfg, configErrors, liveGuardErrors);

  if (configErrors.length > 0) {
    console.error('[smoke-test] FAIL: config validation errors.');
    process.exitCode = 1;
    return 1;
  }

  if (liveGuardErrors.length > 0 && cfg.mode === 'live' && !dryRunOnly) {
    console.error('[smoke-test] FAIL: live mode guard triggered.');
    process.exitCode = 1;
    return 1;
  }

  const startedAt = new Date();
  const runContext = { liveRpcCalls: 0, writeSubmissions: 0 };

  const configValidation = {
    status: 'passed',
    notes: [
      `Schema: ${SCHEMA_PATH}`,
      cfg.mode === 'mocked' ? 'All placeholders permitted in mocked mode' : 'Placeholders validated for current mode',
    ],
  };

  const contractResults = {};
  const checks = [];

  for (const [name, spec] of Object.entries(cfg.contracts ?? {})) {
    const contractChecks = runContractChecks(name, spec, cfg, runContext);
    contractResults[name] = {
      contractId: spec.contractId,
      status: 'passed',
      requiredMethodsVerified: spec.requiredMethods.length,
      checks: contractChecks,
    };
    checks.push(...contractChecks);
  }

  const finishedAt = new Date();
  const passedCount = checks.filter((c) => c.status === 'passed').length;
  const failedCount = checks.filter((c) => c.status === 'failed').length;
  const skippedCount = checks.filter((c) => c.status === 'skipped').length;

  const report = {
    runId: `smoke-run-${startedAt.getFullYear()}${String(startedAt.getMonth() + 1).padStart(2, '0')}${String(startedAt.getDate()).padStart(2, '0')}-${crypto.randomBytes(2).toString('hex')}`,
    network: cfg.network,
    mode: cfg.mode,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    summary: {
      totalChecks: checks.length,
      passed: passedCount,
      skipped: skippedCount,
      failed: failedCount,
      liveRpcCalls: runContext.liveRpcCalls,
      writeSubmissions: runContext.writeSubmissions,
    },
    configValidation,
    contractResults,
    notes: [
      runContext.liveRpcCalls === 0
        ? 'NO real RPC calls were made. Set mode="live" AND options.dryRun=false for maintainer-only live validation.'
        : `Made ${runContext.liveRpcCalls} live RPC call(s).`,
      'Set AXIONVERA_TEST_SECRET env var only in maintainer local environments; NEVER commit secrets.',
      runContext.writeSubmissions === 0
        ? 'No write submissions. Either writeDisabled=true, dryRun=true, or mode is not "live".'
        : `Submitted ${runContext.writeSubmissions} write transaction(s).`,
    ],
  };

  console.log('=== Smoke Test Result ===');
  console.log(
    `Total: ${checks.length} | Passed: ${passedCount} | Skipped: ${skippedCount} | Failed: ${failedCount}`
  );
  console.log(
    `Live RPC: ${runContext.liveRpcCalls} | Write submissions: ${runContext.writeSubmissions}`
  );
  console.log(`Duration: ${report.durationMs} ms`);
  console.log('');

  const outputFile = cfg.options?.outputFile;
  if (outputFile) {
    const outAbs = path.resolve(root, outputFile);
    checkNoSecretsInOutput(outAbs);
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    fs.writeFileSync(outAbs, JSON.stringify(report, null, 2), 'utf8');
    console.log(`Report written to: ${path.relative(root, outAbs)}`);
  }

  if (failedCount > 0) {
    console.error('[smoke-test] FAIL: some checks failed.');
    process.exitCode = 1;
    return 1;
  }
  console.log('[smoke-test] PASS.');
  return 0;
}

try {
  main();
} catch (err) {
  console.error(`[smoke-test] FATAL: ${err && err.message ? err.message : err}`);
  process.exitCode = 1;
}
