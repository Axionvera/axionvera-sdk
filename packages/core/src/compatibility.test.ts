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
import { VaultContract, type ContractInvoker } from './contracts/vault';

const NETWORK_FIXTURE_PATH = new URL(
  '../../../schemas/network-vault-interface.fixture.json',
  import.meta.url
);

function loadNetworkFixture(): NetworkVaultInterfaceFixture {
  return JSON.parse(readFileSync(NETWORK_FIXTURE_PATH, 'utf8')) as NetworkVaultInterfaceFixture;
}

async function collectVaultContractCalls() {
  const calls: { method: string; args: readonly unknown[]; kind: 'read' | 'write' }[] = [];
  const invoker: ContractInvoker = {
    invoke: async (request) => {
      calls.push({ method: request.method, args: request.args, kind: 'write' });
      return { status: 'success' };
    },
    read: async (request) => {
      calls.push({ method: request.method, args: request.args, kind: 'read' });
      return {};
    },
  };
  const vault = new VaultContract({ contractId: 'CVaultCompatibilityFixture', invoker });

  await vault.getInfo();
  await vault.getBalance('GUSER');
  await vault.getPendingRewards('GUSER');
  await vault.deposit('GUSER', 100n);
  await vault.withdraw('GUSER', 50n);
  await vault.claimRewards('GUSER');

  return calls;
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

  it('matches actual VaultContract method names to SDK fixture expectations', async () => {
    const calls = await collectVaultContractCalls();

    expect(calls.map((call) => call.method)).toEqual(
      SDK_VAULT_INTERFACE_FIXTURE.methods.map((method) => method.networkName)
    );
  });

  it('matches actual VaultContract argument order to SDK fixture expectations', async () => {
    const calls = await collectVaultContractCalls();

    expect(calls.map((call) => call.args)).toEqual([
      [],
      ['GUSER'],
      ['GUSER'],
      ['GUSER', '100'],
      ['GUSER', '50'],
      ['GUSER'],
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

  it('detects missing Network methods', () => {
    const networkFixture = loadNetworkFixture();
    const missingDeposit: NetworkVaultInterfaceFixture = {
      ...networkFixture,
      methods: networkFixture.methods.filter((method) => method.name !== 'deposit'),
    };

    const result = compareVaultInterfaceMethods(SDK_VAULT_INTERFACE_FIXTURE, missingDeposit);

    expect(result.find((method) => method.networkName === 'deposit')?.methodExists).toBe(false);
  });

  it('detects argument order mismatches', () => {
    const networkFixture = loadNetworkFixture();
    const reorderedDeposit: NetworkVaultInterfaceFixture = {
      ...networkFixture,
      methods: networkFixture.methods.map((method) =>
        method.name === 'deposit'
          ? {
              ...method,
              arguments: [
                { name: 'amount', type: 'i128' },
                { name: 'from', type: 'Address' },
              ],
            }
          : method
      ),
    };

    const result = compareVaultInterfaceMethods(SDK_VAULT_INTERFACE_FIXTURE, reorderedDeposit);

    expect(result.find((method) => method.networkName === 'deposit')?.argumentOrderMatches).toBe(false);
  });

  it('detects event topic mismatches', () => {
    const networkFixture = loadNetworkFixture();
    const renamedWithdrawTopic: NetworkVaultInterfaceFixture = {
      ...networkFixture,
      events: networkFixture.events.map((event) =>
        event.name === 'withdraw'
          ? {
              ...event,
              topics: ['withdraw', 'address'],
            }
          : event
      ),
    };

    const result = compareVaultInterfaceEvents(SDK_VAULT_INTERFACE_FIXTURE, renamedWithdrawTopic);

    expect(result.find((event) => event.name === 'withdraw')?.topicsMatch).toBe(false);
  });

  it('detects event data shape mismatches', () => {
    const networkFixture = loadNetworkFixture();
    const wrongDepositData: NetworkVaultInterfaceFixture = {
      ...networkFixture,
      events: networkFixture.events.map((event) =>
        event.name === 'deposit'
          ? {
              ...event,
              data: { value: 'i128' },
            }
          : event
      ),
    };

    const result = compareVaultInterfaceEvents(SDK_VAULT_INTERFACE_FIXTURE, wrongDepositData);

    expect(result.find((event) => event.name === 'deposit')?.dataShapeMatches).toBe(false);
  });
});
