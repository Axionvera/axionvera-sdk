#!/usr/bin/env node

/**
 * Release Packet Generator for Axionvera SDK
 * 
 * Collects non-secret SDK readiness artifacts into a release packet folder
 * for maintainer review before testnet connection.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

// Configuration
const CONFIG = {
  rootDir: path.resolve(__dirname, '..'),
  outputDir: path.resolve(__dirname, '../release-packet'),
  artifacts: [
    { path: 'README.md', type: 'doc', description: 'Root README' },
    { path: 'docs/sdk-overview.md', type: 'doc', description: 'SDK Overview' },
    { path: 'docs/usage-guide.md', type: 'doc', description: 'Usage Guide' },
    { path: 'docs/maintainer-handoff.md', type: 'doc', description: 'Maintainer Handoff Guide' },
    { path: 'examples/react-mvp-demo.tsx', type: 'example', description: 'React MVP Demo' },
    { path: 'examples/testnet-sdk-config.json', type: 'example', description: 'Testnet Config Example' },
    { path: 'schemas/network-vault-interface.fixture.json', type: 'schema', description: 'Network Vault Interface' },
    { path: 'packages/core/dist', type: 'dist', description: 'Core Package Build' },
    { path: 'packages/react/dist', type: 'dist', description: 'React Package Build' },
    { path: 'packages/core/src/testing/fixtures/handoff/valid.json', type: 'fixture', description: 'Valid Handoff Fixture' }
  ],
  secretPatterns: [
    '.env',
    'token',
    'secret',
    'key',
    'private',
    'mnemonic'
  ]
};

function log(message) {
  console.log(`[Release Packet] ${message}`);
}

function calculateChecksum(filePath) {
  if (fs.lstatSync(filePath).isDirectory()) return undefined;
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

function copyRecursive(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      // Basic secret exclusion check
      if (CONFIG.secretPatterns.some(p => childItemName.toLowerCase().includes(p))) {
        return;
      }
      copyRecursive(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    // Basic secret exclusion check for files
    if (CONFIG.secretPatterns.some(p => path.basename(src).toLowerCase().includes(p))) {
      return;
    }
    fs.copyFileSync(src, dest);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const skipChecks = args.includes('--skip-checks');
  log('Starting generation...');

  // 1. Prepare output directory
  if (fs.existsSync(CONFIG.outputDir)) {
    fs.rmSync(CONFIG.outputDir, { recursive: true, force: true });
  }
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });

  const manifest = {
    version: require('../package.json').version,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    artifacts: [],
    readinessSummary: {
      lint: false,
      typecheck: false,
      build: false,
      test: false
    }
  };

  // 2. Collect artifacts
  for (const artifact of CONFIG.artifacts) {
    const srcPath = path.join(CONFIG.rootDir, artifact.path);
    const destPath = path.join(CONFIG.outputDir, artifact.path);
    
    if (fs.existsSync(srcPath)) {
      log(`Collecting ${artifact.path}...`);
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      
      copyRecursive(srcPath, destPath);
      
      manifest.artifacts.push({
        ...artifact,
        checksum: fs.lstatSync(srcPath).isFile() ? calculateChecksum(srcPath) : undefined
      });
    } else {
      log(`Warning: Artifact not found at ${artifact.path}`);
    }
  }

  // 3. Run dry-run quality checks (optional/best effort)
  if (!skipChecks) {
    log('Running readiness checks (lint)...');
    try {
      execSync('npm run lint', { stdio: 'ignore' });
      manifest.readinessSummary.lint = true;
      log('Lint passed.');
    } catch (e) {
      log('Lint failed (skipped).');
    }

    log('Running readiness checks (typecheck)...');
    try {
      execSync('npm run typecheck', { stdio: 'ignore' });
      manifest.readinessSummary.typecheck = true;
      log('Typecheck passed.');
    } catch (e) {
      log('Typecheck failed (skipped).');
    }

    log('Running readiness checks (build)...');
    try {
      execSync('npm run build', { stdio: 'ignore' });
      manifest.readinessSummary.build = true;
      log('Build passed.');
    } catch (e) {
      log('Build failed (skipped).');
    }
  } else {
    log('Skipping readiness checks as requested.');
  }

  // 4. Save manifest
  fs.writeFileSync(
    path.join(CONFIG.outputDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  log(`Release packet generated at ${CONFIG.outputDir}`);
  log(`Manifest contains ${manifest.artifacts.length} artifacts.`);
}

main().catch(err => {
  console.error('Generation failed:', err);
  process.exit(1);
});
