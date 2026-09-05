/**
 * Example: SDK-to-Network Vault compatibility report.
 *
 * This uses a local static fixture only. It does not fetch GitHub, call RPC, or
 * require a Network checkout.
 */

import { readFileSync } from 'node:fs';

import {
  SDK_VAULT_INTERFACE_FIXTURE,
  compareVaultInterfaceCompatibility,
  formatVaultCompatibilityReport,
  type NetworkVaultInterfaceFixture,
} from '../packages/core/src';

const networkFixture = JSON.parse(
  readFileSync(new URL('../schemas/network-vault-interface.fixture.json', import.meta.url), 'utf8')
) as NetworkVaultInterfaceFixture;

const result = compareVaultInterfaceCompatibility(
  SDK_VAULT_INTERFACE_FIXTURE,
  networkFixture
);

console.log(formatVaultCompatibilityReport(result));
