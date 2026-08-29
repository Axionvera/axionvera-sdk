import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  SDK_VAULT_INTERFACE_FIXTURE,
  compareVaultInterfaceCompatibility,
  compareVaultInterfaceEvents,
  compareVaultInterfaceMethods,
  formatVaultCompatibilityReport,
  type NetworkVaultInterfaceFixture,
} from './compatibility';

const NETWORK_FIXTURE_PATH = new URL(
  '../../../schemas/network-vault-interface.fixture.json',
  import.meta.url
);

function loadNetworkFixture(): NetworkVaultInterfaceFixture {
  return JSON.parse(readFileSync(NETWORK_FIXTURE_PATH, 'utf8')) as NetworkVaultInterfaceFixture;
}

describe('SDK-to-Network vault compatibility fixtures', () => {
  it('uses a local static Network fixture', () => {
    const fixture = loadNetworkFixture();

    expect(fixture.source).toBe('local-static-fixture');
    expect(fixture.contract).toBe('Vault');
  });

  it('matches SDK method name expectations against Network schema methods', () => {
    const result = compareVaultInterfaceMethods(SDK_VAULT_INTERFACE_FIXTURE, loadNetworkFixture());

    expect(result.map((method) => [method.sdkName, method.networkName, method.methodExists])).toEqual([
      ['getInfo', 'get_info', true],
      ['getBalance', 'get_balance', true],
      ['getPendingRewards', 'get_pending_rewards', true],
      ['deposit', 'deposit', true],
      ['withdraw', 'withdraw', true],
      ['claimRewards', 'claim_rewards', true],
    ]);
  });

  it('matches SDK read and write method kind expectations', () => {
    const result = compareVaultInterfaceMethods(SDK_VAULT_INTERFACE_FIXTURE, loadNetworkFixture());

    expect(result.every((method) => method.methodKindMatches)).toBe(true);
  });

  it('matches SDK argument order expectations against Network schema arguments', () => {
    const result = compareVaultInterfaceMethods(SDK_VAULT_INTERFACE_FIXTURE, loadNetworkFixture());

    expect(result.every((method) => method.argumentOrderMatches)).toBe(true);
    expect(result.find((method) => method.networkName === 'deposit')?.actualArguments).toEqual([
      { name: 'from', type: 'Address' },
      { name: 'amount', type: 'i128' },
    ]);
    expect(result.find((method) => method.networkName === 'withdraw')?.actualArguments).toEqual([
      { name: 'to', type: 'Address' },
      { name: 'amount', type: 'i128' },
    ]);
  });

  it('includes event expectation examples compatible with the Network fixture', () => {
    const result = compareVaultInterfaceEvents(SDK_VAULT_INTERFACE_FIXTURE, loadNetworkFixture());

    expect(result.map((event) => event.name)).toEqual([
      'deposit',
      'withdraw',
      'claim_rewards',
      'initialized',
    ]);
    expect(result.every((event) => event.eventExists)).toBe(true);
    expect(result.every((event) => event.topicsMatch)).toBe(true);
    expect(result.every((event) => event.dataShapeMatches)).toBe(true);
  });

  it('reports the full fixture set as compatible', () => {
    const result = compareVaultInterfaceCompatibility(
      SDK_VAULT_INTERFACE_FIXTURE,
      loadNetworkFixture()
    );

    expect(result.compatible).toBe(true);
  });

  it('formats example compatibility output', () => {
    const result = compareVaultInterfaceCompatibility(
      SDK_VAULT_INTERFACE_FIXTURE,
      loadNetworkFixture()
    );

    expect(formatVaultCompatibilityReport(result)).toContain('Vault compatibility: compatible');
    expect(formatVaultCompatibilityReport(result)).toContain('- deposit -> deposit: ok');
    expect(formatVaultCompatibilityReport(result)).toContain('- claim_rewards: ok');
  });
});
