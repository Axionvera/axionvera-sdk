#!/usr/bin/env node
/**
 * Dry-run validation test for scripts/smoke-test-sdk.js
 *
 * Runs the smoke test script in:
 *   1. mocked default mode (SAFE, no real calls)
 *   2. explicit --mode dry-run plan mode
 *   3. --mode live WITHOUT --no-dry-run (should fail: live-mode guard)
 *   4. Invalid config path (should fail fast)
 *
 * Runs as Node CJS — no framework required. CI can run via:
 *   node scripts/test-smoke-test.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.resolve(ROOT, 'scripts', 'smoke-test-sdk.js');
const NODE = process.execPath;

let failedCount = 0;
let passedCount = 0;

function writeTempFile(name, contents) {
  const tmp = path.join(os.tmpdir(), `axionvera-smoke-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(tmp, { recursive: true });
  const filePath = path.join(tmp, name);
  fs.writeFileSync(filePath, JSON.stringify(contents, null, 2), 'utf8');
  return { tmp, filePath };
}

function assertExit(description, result, expectedExit, expectedContains, expectNoRpc = true) {
  const actualExit = result.status ?? (result.error ? 1 : 0);
  const stdout = (result.stdout || '').toString('utf8');
  const stderr = (result.stderr || '').toString('utf8');
  const combined = stdout + '\n' + stderr;

  const okExit = actualExit === expectedExit;
  const okContains = !expectedContains || expectedContains.some((needle) => combined.includes(needle));
  const okNoRpc = !expectNoRpc || !combined.includes('Live RPC: ') || /Live RPC:\s*0/.test(combined);

  const pass = okExit && okContains && okNoRpc;

  if (pass) {
    passedCount++;
    console.log(`  ✓ ${description}`);
  } else {
    failedCount++;
    console.log(`  ✗ ${description}`);
    if (!okExit) console.log(`    expected exit ${expectedExit}, got ${actualExit}`);
    if (!okContains) console.log(`    stdout/stderr missing expected token: ${expectedContains?.join(', ')}`);
    if (!okNoRpc) console.log('    unexpectedly made live RPC calls (Live RPC count ≠ 0)');
    console.log('    --- stdout+stderr ---');
    console.log(combined);
    console.log('    --------------------');
  }
}

function runSmoke(args, env = process.env) {
  return spawnSync(NODE, [SCRIPT, ...args], {
    cwd: ROOT,
    env: { ...env, AXIONVERA_MAINTAINER: undefined, NODE_ENV: 'test' },
    encoding: 'utf8',
    timeout: 30000,
  });
}

console.log('test-smoke-test: dry-run validation of scripts/smoke-test-sdk.js\n');

console.log('(1) Default run — mocked mode + dry-run defaults');
{
  const result = runSmoke([]);
  assertExit(
    'exits 0 with PASS banner and Live RPC=0',
    result,
    0,
    ['PASS', 'Safe mode active', 'smoke-run-'],
    true
  );
}

console.log('\n(2) Explicit --mode dry-run with example input');
{
  const result = runSmoke(['--config', 'examples/smoke-test-input.json', '--mode', 'dry-run']);
  assertExit(
    'exits 0 and shows dry-run plan',
    result,
    0,
    ['PASS', 'Mode        : dry-run', 'Total:'],
    true
  );
}

console.log('\n(3) --mode live WITHOUT --no-dry-run should fail (live-mode guard)');
{
  const result = runSmoke(['--config', 'examples/smoke-test-input.json', '--mode', 'live']);
  assertExit(
    'exits 1 and reports live-mode guard triggered',
    result,
    1,
    ['live mode guard', 'FAIL']
  );
}

console.log('\n(4) --mode live WITH --no-dry-run but missing env guard');
{
  const result = runSmoke([
    '--config', 'examples/smoke-test-input.json',
    '--mode', 'live',
    '--no-dry-run',
  ], { ...process.env, AXIONVERA_MAINTAINER: undefined, NODE_ENV: 'test' });
  assertExit(
    'exits 1 with maintainer-only guard (placeholder contractId still fails anyway)',
    result,
    1,
    ['FAIL', 'maintainer-only']
  );
}

console.log('\n(5) Invalid config path');
{
  const result = runSmoke(['--config', 'definitely/does/not/exist.json']);
  assertExit(
    'exits 1 with "Missing smoke-test config"',
    result,
    1,
    ['Missing smoke-test config']
  );
}

console.log('\n(6) Config with invalid network name');
{
  const { filePath } = writeTempFile('bad-network.json', {
    network: 'ropsten',
    mode: 'mocked',
    contracts: {
      vault: {
        contractId: 'PLACEHOLDER_X',
        requiredMethods: ['getInfo'],
        writeDisabled: true,
      },
    },
  });
  try {
    const result = runSmoke(['--config', filePath]);
    assertExit(
      'exits 1 and reports invalid network',
      result,
      1,
      ['network must be one of', 'FAIL']
    );
  } finally {
    fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
  }
}

console.log('\n(7) Config with empty requiredMethods');
{
  const { filePath } = writeTempFile('empty-methods.json', {
    network: 'testnet',
    mode: 'mocked',
    contracts: {
      vault: {
        contractId: 'PLACEHOLDER_X',
        requiredMethods: [],
        writeDisabled: true,
      },
    },
  });
  try {
    const result = runSmoke(['--config', filePath]);
    assertExit(
      'exits 1 with requiredMethods empty',
      result,
      1,
      ['requiredMethods', 'FAIL']
    );
  } finally {
    fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
  }
}

console.log('\n(8) Config with options.outputFile writes a report');
{
  const tmp = path.join(
    os.tmpdir(),
    `axionvera-smoke-out-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  fs.mkdirSync(tmp, { recursive: true });
  const outFile = path.join(tmp, 'report.json');
  const outRel = path.relative(ROOT, outFile);

  const { filePath } = writeTempFile('with-output.json', {
    network: 'testnet',
    mode: 'mocked',
    contracts: {
      vault: {
        contractId: 'PLACEHOLDER_Y',
        requiredMethods: ['getInfo', 'deposit'],
        writeDisabled: true,
      },
    },
    options: { outputFile: outRel, dryRun: true, verbose: false },
  });
  try {
    const result = runSmoke(['--config', filePath]);
    assertExit(
      'exits 0, writes report, and report contains Live RPC: 0 + success summary',
      result,
      0,
      ['Report written to:', 'PASS'],
      true
    );
    if (fs.existsSync(outFile)) {
      const report = JSON.parse(fs.readFileSync(outFile, 'utf8'));
      const good =
        report.summary &&
        report.summary.liveRpcCalls === 0 &&
        report.summary.writeSubmissions === 0 &&
        report.summary.failed === 0;
      if (good) {
        passedCount++;
        console.log('  ✓ Report JSON contains liveRpcCalls=0, writeSubmissions=0, failed=0');
      } else {
        failedCount++;
        console.log('  ✗ Report JSON missing expected summary fields');
        console.log('    summary:', JSON.stringify(report.summary));
      }
    }
  } finally {
    fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

console.log('');
console.log(`Results: ${passedCount} passed, ${failedCount} failed`);
if (failedCount > 0) {
  console.error('test-smoke-test: FAIL');
  process.exitCode = 1;
} else {
  console.log('test-smoke-test: PASS');
  process.exitCode = 0;
}
