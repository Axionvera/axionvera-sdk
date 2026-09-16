import { Account, Networks, nativeToScVal } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import { ContractError, NetworkError, ValidationError } from './errors';
import {
  StellarSorobanReader,
  StellarVaultReader,
  sorobanNativeToString,
  toSorobanScVal,
  type StellarSorobanReadServer,
} from './sorobanLiveRead';

const CONTRACT_ID = 'CBJ4WUI3R64OPDQMOJJGNOT6UQY3WFUHZI5P4BS6SCPQ6WGFICIUL6BO';
const PUBLIC_KEY = 'GDGOJ2KHXL3BSWHDFQYIOTCGBYP5SE4NGPUJY7XUVQX75SYKIMPJG7BO';

class FakeReadServer implements StellarSorobanReadServer {
  readonly account = new Account(PUBLIC_KEY, '1');
  readonly calls: unknown[] = [];

  constructor(
    private readonly response: Awaited<ReturnType<StellarSorobanReadServer['simulateTransaction']>>,
  ) {}

  async getAccount(publicKey: string): Promise<Account> {
    this.calls.push({ type: 'getAccount', publicKey });
    return this.account;
  }

  async simulateTransaction(transaction: unknown) {
    this.calls.push({ type: 'simulateTransaction', transaction });
    return this.response;
  }
}

describe('soroban live read helpers', () => {
  it('converts Soroban native values into API-safe strings', () => {
    expect(sorobanNativeToString(100)).toBe('100');
    expect(sorobanNativeToString(100n)).toBe('100');
    expect(sorobanNativeToString('100')).toBe('100');
    expect(sorobanNativeToString(null)).toBe('');
  });

  it('converts Stellar addresses to ScVal values', () => {
    const scVal = toSorobanScVal(PUBLIC_KEY);

    expect(scVal).toBeTruthy();
  });

  it('simulates a read-only contract call and decodes the return value', async () => {
    const server = new FakeReadServer({
      result: {
        retval: nativeToScVal(100),
      },
    });

    const reader = new StellarSorobanReader({
      contractId: CONTRACT_ID,
      sourcePublicKey: PUBLIC_KEY,
      networkPassphrase: Networks.TESTNET,
      server,
    });

    await expect(reader.read({ method: 'total_deposits' })).resolves.toBe(100n);
    expect(server.calls).toHaveLength(2);
  });

  it('reads vault totals through the vault reader helper', async () => {
    const server = new FakeReadServer({
      result: {
        retval: nativeToScVal(100),
      },
    });

    const vault = new StellarVaultReader({
      contractId: CONTRACT_ID,
      sourcePublicKey: PUBLIC_KEY,
      server,
    });

    await expect(vault.totalDeposits()).resolves.toBe('100');
  });

  it('reads user balance through the vault reader helper', async () => {
    const server = new FakeReadServer({
      result: {
        retval: nativeToScVal(100),
      },
    });

    const vault = new StellarVaultReader({
      contractId: CONTRACT_ID,
      sourcePublicKey: PUBLIC_KEY,
      server,
    });

    await expect(vault.userBalance(PUBLIC_KEY)).resolves.toBe('100');
  });

  it('reads pending rewards through the vault reader helper', async () => {
    const server = new FakeReadServer({
      result: {
        retval: nativeToScVal(0),
      },
    });

    const vault = new StellarVaultReader({
      contractId: CONTRACT_ID,
      sourcePublicKey: PUBLIC_KEY,
      server,
    });

    await expect(vault.pendingRewards(PUBLIC_KEY)).resolves.toBe('0');
  });

  it('throws validation errors for missing inputs', () => {
    expect(
      () =>
        new StellarSorobanReader({
          contractId: '',
          sourcePublicKey: PUBLIC_KEY,
        }),
    ).toThrow(ValidationError);

    expect(
      () =>
        new StellarSorobanReader({
          contractId: CONTRACT_ID,
          sourcePublicKey: '',
        }),
    ).toThrow(ValidationError);
  });

  it('throws contract errors when simulation returns an error', async () => {
    const reader = new StellarSorobanReader({
      contractId: CONTRACT_ID,
      sourcePublicKey: PUBLIC_KEY,
      server: new FakeReadServer({
        error: 'host invocation failed',
      }),
    });

    await expect(reader.read({ method: 'total_deposits' })).rejects.toThrow(ContractError);
  });

  it('wraps unexpected server failures as network errors', async () => {
    const server: StellarSorobanReadServer = {
      async getAccount() {
        throw new Error('rpc unavailable');
      },
      async simulateTransaction() {
        return {};
      },
    };

    const reader = new StellarSorobanReader({
      contractId: CONTRACT_ID,
      sourcePublicKey: PUBLIC_KEY,
      server,
    });

    await expect(reader.read({ method: 'total_deposits' })).rejects.toThrow(NetworkError);
  });
});

describe('StellarVaultReader claimableRewards', () => {
  it('reads claimable_rewards for a user', async () => {
    const user = 'GDGOJ2KHXL3BSWHDFQYIOTCGBYP5SE4NGPUJY7XUVQX75SYKIMPJG7BO';

    const calls: string[] = [];

    const reader = new StellarVaultReader({
      contractId: 'CAZGEBQ3MAU7CAUOCKGFUSC2MVLAPOHWJ4V3H4NY2L6RNV3MEHQIIP6J',
      sourcePublicKey: user,
      server: {
        async getAccount(publicKey) {
          return new Account(publicKey, '1');
        },
        async simulateTransaction() {
          calls.push('claimable_rewards');
          return {
            result: {
              retval: nativeToScVal(10n, { type: 'i128' }),
            },
          };
        },
      },
    });

    expect(await reader.claimableRewards(user)).toBe('10');
    expect(calls).toEqual(['claimable_rewards']);
  });
});
