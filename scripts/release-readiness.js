#!/usr/bin/env node

/**
 * Release Readiness Script for Axionvera SDK
 * 
 * This script verifies that the SDK is ready for release by checking:
 * - Required documentation files
 * - Example files
 * - Schema files
 * - Build outputs
 * - Quality commands (lint, typecheck, build, tests)
 * 
 * Usage: node scripts/release-readiness.js [--dry-run]
 * 
 * Options:
 *   --dry-run: Skip running quality commands, only check file existence
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function colorize(color, text) {
  return `${colors[color]}${text}${colors.reset}`;
}

function logSection(title) {
  console.log(`\n${colorize('cyan', '='.repeat(60))}`);
  console.log(`${colorize('cyan', title)}`);
  console.log(`${colorize('cyan', '='.repeat(60))}`);
}

function logSuccess(message) {
  console.log(`${colorize('green', '✓')} ${message}`);
}

function logError(message) {
  console.log(`${colorize('red', '✗')} ${message}`);
}

function logWarning(message) {
  console.log(`${colorize('yellow', '⚠')} ${message}`);
}

function logInfo(message) {
  console.log(`${colorize('blue', 'ℹ')} ${message}`);
}

// Configuration
const CONFIG = {
  rootDir: path.resolve(__dirname, '..'),
  requiredDocs: [
    'README.md',
    'CONTRIBUTING.md',
    'LICENSE',
    'SECURITY.md',
  ],
  packageReadmes: [
    'packages/core/README.md',
    'packages/react/README.md',
  ],
  requiredExamples: [
    'examples/execution-examples.ts',
    'examples/mock-simulation-example.ts',
    'examples/mock-wallet-signing-pipeline.ts',
    'examples/react-testnet-flow.tsx',
    'examples/react-vault-example.tsx',
    'examples/sdk-network-compatibility-example.ts',
    'examples/testnet-sdk-config.ts',
    'examples/testnet-sdk-config.json',
  ],
  requiredSchemas: [
    'schemas/network-vault-interface.fixture.json',
  ],
  buildOutputs: [
    'packages/core/dist',
    'packages/react/dist',
  ],
  qualityCommands: [
    { name: 'Lint', command: 'npm run lint' },
    { name: 'TypeCheck', command: 'npm run typecheck' },
    { name: 'Build', command: 'npm run build' },
    { name: 'Test', command: 'npx vitest run' },
  ],
};

// Check if a file/directory exists
function exists(filePath) {
  const fullPath = path.join(CONFIG.rootDir, filePath);
  return fs.existsSync(fullPath);
}

// Check if a directory has content
function hasContent(dirPath) {
  const fullPath = path.join(CONFIG.rootDir, dirPath);
  if (!fs.existsSync(fullPath)) return false;
  const files = fs.readdirSync(fullPath);
  return files.length > 0;
}

// Run a command and return success/failure
function runCommand(command) {
  try {
    execSync(command, { 
      cwd: CONFIG.rootDir, 
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    return { success: true, output: '' };
  } catch (error) {
    return { 
      success: false, 
      output: error.stdout || error.stderr || error.message 
    };
  }
}

// Check documentation files
function checkDocumentation() {
  logSection('Documentation Check');
  
  let allPassed = true;
  
  // Root documentation
  logInfo('Checking root documentation files...');
  for (const doc of CONFIG.requiredDocs) {
    if (exists(doc)) {
      logSuccess(doc);
    } else {
      logError(`Missing: ${doc}`);
      allPassed = false;
    }
  }
  
  // Package READMEs
  logInfo('Checking package README files...');
  for (const readme of CONFIG.packageReadmes) {
    if (exists(readme)) {
      logSuccess(readme);
    } else {
      logError(`Missing: ${readme}`);
      allPassed = false;
    }
  }
  
  return allPassed;
}

// Check example files
function checkExamples() {
  logSection('Examples Check');
  
  let allPassed = true;
  
  logInfo('Checking example files...');
  for (const example of CONFIG.requiredExamples) {
    if (exists(example)) {
      logSuccess(example);
    } else {
      logError(`Missing: ${example}`);
      allPassed = false;
    }
  }
  
  return allPassed;
}

// Check schema files
function checkSchemas() {
  logSection('Schemas Check');
  
  let allPassed = true;
  
  logInfo('Checking schema files...');
  for (const schema of CONFIG.requiredSchemas) {
    if (exists(schema)) {
      logSuccess(schema);
    } else {
      logError(`Missing: ${schema}`);
      allPassed = false;
    }
  }
  
  return allPassed;
}

// Check build outputs
function checkBuildOutputs() {
  logSection('Build Outputs Check');
  
  let allPassed = true;
  
  logInfo('Checking build output directories...');
  for (const output of CONFIG.buildOutputs) {
    if (hasContent(output)) {
      logSuccess(`${output} (exists with content)`);
    } else {
      logWarning(`${output} (missing or empty - run 'npm run build' first)`);
      allPassed = false;
    }
  }
  
  return allPassed;
}

// Run quality commands
function runQualityChecks(dryRun = false) {
  logSection('Quality Commands Check');
  
  if (dryRun) {
    logWarning('Dry run mode: skipping quality commands');
    return { allPassed: true, results: [] };
  }
  
  let allPassed = true;
  const results = [];
  
  for (const { name, command } of CONFIG.qualityCommands) {
    logInfo(`Running ${name}...`);
    const result = runCommand(command);
    results.push({ name, command, ...result });
    
    if (result.success) {
      logSuccess(`${name} passed`);
    } else {
      logError(`${name} failed`);
      if (result.output) {
        console.log(colorize('red', result.output.substring(0, 500)));
        if (result.output.length > 500) {
          console.log(colorize('red', '... (output truncated)'));
        }
      }
      allPassed = false;
    }
  }
  
  return { allPassed, results };
}

// Main function
function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  console.log(colorize('cyan', 'Axionvera SDK Release Readiness Check'));
  console.log(colorize('blue', `Mode: ${dryRun ? 'Dry Run' : 'Full Check'}`));
  
  const results = {
    documentation: checkDocumentation(),
    examples: checkExamples(),
    schemas: checkSchemas(),
    buildOutputs: checkBuildOutputs(),
    quality: runQualityChecks(dryRun),
  };
  
  // Summary
  logSection('Summary');
  
  const checks = [
    { name: 'Documentation', passed: results.documentation },
    { name: 'Examples', passed: results.examples },
    { name: 'Schemas', passed: results.schemas },
    { name: 'Build Outputs', passed: results.buildOutputs },
    { name: 'Quality Commands', passed: results.quality.allPassed },
  ];
  
  let allPassed = true;
  for (const check of checks) {
    if (check.passed) {
      logSuccess(`${check.name}: PASSED`);
    } else {
      logError(`${check.name}: FAILED`);
      allPassed = false;
    }
  }
  
  // Final verdict
  logSection('Final Verdict');
  
  if (allPassed) {
    console.log(colorize('green', '✓ All checks passed! SDK is ready for release.'));
    process.exit(0);
  } else {
    console.log(colorize('red', '✗ Some checks failed. Please fix the issues above.'));
    
    // Provide helpful suggestions
    console.log('\n' + colorize('yellow', 'Suggestions:'));
    if (!results.documentation) {
      console.log('  - Ensure all required documentation files exist');
    }
    if (!results.examples) {
      console.log('  - Ensure all example files are present');
    }
    if (!results.schemas) {
      console.log('  - Ensure all schema files are present');
    }
    if (!results.buildOutputs) {
      console.log('  - Run "npm run build" to generate build outputs');
    }
    if (!results.quality.allPassed) {
      console.log('  - Fix linting, type checking, build, or test failures');
      console.log('  - Run individual commands: npm run lint, npm run typecheck, npm run build, npx vitest run');
    }
    
    process.exit(1);
  }
}

// Run the script
main();
