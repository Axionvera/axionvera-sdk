#!/usr/bin/env node

/**
 * Dry-run validation for Release Packet Generator
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const outputDir = path.resolve(rootDir, 'release-packet');

console.log('Running Release Packet Generator (Dry Run)...');

try {
  // Run with skip-checks to save time during testing
  execSync('node scripts/generate-release-packet.js --skip-checks', { cwd: rootDir, stdio: 'inherit' });

  // Verify manifest exists
  const manifestPath = path.join(outputDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Manifest not generated!');
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  console.log(`Manifest verified. Version: ${manifest.version}, Artifacts: ${manifest.artifacts.length}`);

  // Verify some key artifacts
  const requiredPaths = [
    'README.md',
    'docs/sdk-overview.md',
    'packages/core/dist',
    'packages/react/dist'
  ];

  for (const p of requiredPaths) {
    if (!fs.existsSync(path.join(outputDir, p))) {
      throw new Error(`Missing required artifact in packet: ${p}`);
    }
  }

  console.log('✓ Release packet structure verified successfully.');
  process.exit(0);
} catch (error) {
  console.error('✗ Validation failed:', error.message);
  process.exit(1);
}
