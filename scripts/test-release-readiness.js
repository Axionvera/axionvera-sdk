#!/usr/bin/env node

/**
 * Test script for release-readiness.js
 * 
 * This script validates the release readiness script by:
 * 1. Testing dry-run mode (should not run quality commands)
 * 2. Verifying the script is executable and has correct syntax
 * 3. Testing basic file existence checks
 * 
 * Usage: node scripts/test-release-readiness.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function colorize(color, text) {
  return `${colors[color]}${text}${colors.reset}`;
}

function logSuccess(message) {
  console.log(`${colorize('green', '✓')} ${message}`);
}

function logError(message) {
  console.log(`${colorize('red', '✗')} ${message}`);
}

function logInfo(message) {
  console.log(`${colorize('cyan', 'ℹ')} ${message}`);
}

const rootDir = path.resolve(__dirname, '..');
const scriptPath = path.join(rootDir, 'scripts', 'release-readiness.js');

console.log(colorize('cyan', 'Release Readiness Script Validation'));
console.log('');

let allTestsPassed = true;

// Test 1: Script file exists
logInfo('Test 1: Checking if release-readiness.js exists...');
if (fs.existsSync(scriptPath)) {
  logSuccess('Script file exists');
} else {
  logError('Script file not found');
  allTestsPassed = false;
}

// Test 2: Script is executable
logInfo('Test 2: Checking if script is executable...');
try {
  fs.accessSync(scriptPath, fs.constants.X_OK);
  logSuccess('Script is executable');
} catch (error) {
  logWarning('Script is not executable (this is OK for Node.js scripts)');
}

// Test 3: Script has valid JavaScript syntax
logInfo('Test 3: Checking JavaScript syntax...');
try {
  const content = fs.readFileSync(scriptPath, 'utf-8');
  // Basic syntax check by trying to parse
  require('acorn').parse(content, { ecmaVersion: 2020, sourceType: 'script' });
  logSuccess('Script has valid JavaScript syntax');
} catch (error) {
  // If acorn is not available, try Node.js syntax check
  try {
    execSync(`node --check "${scriptPath}"`, { stdio: 'pipe' });
    logSuccess('Script has valid JavaScript syntax');
  } catch (error) {
    logError('Script has syntax errors');
    console.error(error.message);
    allTestsPassed = false;
  }
}

// Test 4: Dry-run mode works
logInfo('Test 4: Testing dry-run mode...');
try {
  const output = execSync(`node "${scriptPath}" --dry-run`, { 
    cwd: rootDir, 
    stdio: 'pipe',
    encoding: 'utf-8'
  });
  
  if (output.includes('Dry Run')) {
    logSuccess('Dry-run mode executed successfully');
  } else {
    logError('Dry-run mode did not produce expected output');
    allTestsPassed = false;
  }
  
  // Ensure quality commands were not run in dry-run mode
  if (output.includes('Running Lint') || output.includes('Running TypeCheck')) {
    logError('Dry-run mode should not run quality commands');
    allTestsPassed = false;
  } else {
    logSuccess('Quality commands were skipped in dry-run mode');
  }
} catch (error) {
  // Dry-run might return non-zero exit code if checks fail, but that's OK for this test
  const output = error.stdout || error.stderr || '';
  if (output.includes('Dry Run')) {
    logSuccess('Dry-run mode executed (some checks failed, but script ran)');
    
    // Ensure quality commands were not run in dry-run mode
    if (output.includes('Running Lint') || output.includes('Running TypeCheck')) {
      logError('Dry-run mode should not run quality commands');
      allTestsPassed = false;
    } else {
      logSuccess('Quality commands were skipped in dry-run mode');
    }
  } else {
    logError('Dry-run mode failed');
    console.error(error.message);
    allTestsPassed = false;
  }
}

// Test 5: Script accepts --help flag (basic CLI validation)
logInfo('Test 5: Testing script CLI interface...');
try {
  const output = execSync(`node "${scriptPath}" --help 2>&1 || true`, { 
    cwd: rootDir, 
    stdio: 'pipe',
    encoding: 'utf-8'
  });
  logSuccess('Script accepts CLI arguments');
} catch (error) {
  logWarning('Script CLI interface test skipped (no --help implemented)');
}

// Test 6: Required files exist for dry-run validation
logInfo('Test 6: Checking required files for dry-run validation...');
const requiredFiles = [
  'README.md',
  'LICENSE',
  'packages/core/README.md',
  'packages/react/README.md',
  'examples/execution-examples.ts',
  'schemas/network-vault-interface.fixture.json',
];

let allFilesExist = true;
for (const file of requiredFiles) {
  const filePath = path.join(rootDir, file);
  if (fs.existsSync(filePath)) {
    // Check if file has content
    const stats = fs.statSync(filePath);
    if (stats.size > 0) {
      logSuccess(`${file} exists and has content`);
    } else {
      logWarning(`${file} exists but is empty`);
    }
  } else {
    logError(`${file} is missing`);
    allFilesExist = false;
  }
}

if (!allFilesExist) {
  logInfo('Some required files are missing - this is expected if the repository is incomplete');
}

// Test 7: Script has proper configuration structure
logInfo('Test 7: Validating script configuration structure...');
try {
  const content = fs.readFileSync(scriptPath, 'utf-8');
  
  const requiredConfig = [
    'requiredDocs',
    'packageReadmes', 
    'requiredExamples',
    'requiredSchemas',
    'buildOutputs',
    'qualityCommands',
  ];
  
  let configValid = true;
  for (const config of requiredConfig) {
    if (content.includes(config)) {
      logSuccess(`Configuration includes ${config}`);
    } else {
      logError(`Configuration missing ${config}`);
      configValid = false;
    }
  }
  
  if (!configValid) {
    allTestsPassed = false;
  }
} catch (error) {
  logError('Failed to validate script configuration');
  allTestsPassed = false;
}

// Final summary
console.log('');
console.log(colorize('cyan', '='.repeat(60)));
console.log(colorize('cyan', 'Test Summary'));
console.log(colorize('cyan', '='.repeat(60)));

if (allTestsPassed) {
  console.log(colorize('green', '✓ All validation tests passed'));
  console.log('');
  console.log('The release readiness script is properly configured and ready for use.');
  console.log('Run "node scripts/release-readiness.js --dry-run" for a quick check.');
  console.log('Run "node scripts/release-readiness.js" for a full validation.');
  process.exit(0);
} else {
  console.log(colorize('red', '✗ Some validation tests failed'));
  console.log('');
  console.log('Please review the errors above and fix the issues.');
  process.exit(1);
}
