import { Account } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import { ContractError, ValidationError } from './errors';
import {
  StellarSorobanWriter,
  StellarVaultWriter,
  toSorobanWriteScVal,
  type StellarSorobanWriteServer,
} from './sorobanLiveWrite';

const CONTRACT_ID = 'CD34FXP4BOSZ64DKFMGTFNPANEKN7XWB5SMGVYEPH7VPTB3HSZD5HGFL';
const PUBLIC_KEY = 'GDGOJ2KHXL3BSWHDFQYIOTCGBYP5SE4NGPUJY7XUVQX75SYKIMPJG7BO';

class FakeWriteServer implements StellarSorobanWriteServer {
  readonly calls: Array<{ type: string; value?: unknown }> = [];

  constructor(
    private readonly sendResponse: Record<string, unknown> = {
      status: 'PENDING',
      hash: 'abc123',
    },
    private readonly txResponse: Record<string, unknown> = {
      status: 'SUCCESS',
      ledger: 123,
    },
  ) {}

  async getAccount(publicKey: string): Promise<Account> {
    this.calls.push({ type: 'getAccount', value: publicKey });
    return new Account(publicKey, '1');
  }

  async prepareTransaction(transaction: unknown): Promise<{ toXDR(): string }> {
    this.calls.push({ type: 'prepareTransaction', value: transaction });
    return transaction as { toXDR(): string };
  }

  async sendTransaction(transaction: unknown): Promise<Record<string, unknown>> {
    this.calls.push({ type: 'sendTransaction', value: transaction });
    return this.sendResponse;
  }

  async getTransaction(hash: string): Promise<Record<string, unknown>> {
    this.calls.push({ type: 'getTransaction', value: hash });
    return this.txResponse;
  }
}

describe('soroban live write helpers', () => {
  it('converts Stellar addresses and integer amounts to ScVal values', () => {
    expect(toSorobanWriteScVal(PUBLIC_KEY)).toBeTruthy();
    expect(toSorobanWriteScVal(100n)).toBeTruthy();
    expect(toSorobanWriteScVal(100)).toBeTruthy();
  });

  it('rejects non-integer number arguments', () => {
    expect(() => toSorobanWriteScVal(1.5)).toThrow(ValidationError);
  });

  it('prepares a deposit transaction for wallet signing', async () => {
    const server = new FakeWriteServer();
    const writer = new StellarVaultWriter({
      contractId: CONTRACT_ID,
      sourcePublicKey: PUBLIC_KEY,
      server,
    });

    const prepared = await writer.prepareDeposit({
      from: PUBLIC_KEY,
      amount: 100,
    });

    expect(prepared.method).toBe('deposit');
    expect(prepared.contractId).toBe(CONTRACT_ID);
    expect(prepared.accountToSign).toBe(PUBLIC_KEY);
    expect(prepared.signerPublicKey).toBe(PUBLIC_KEY);
    expect(prepared.networkPassphrase).toBe('Test SDF Network ; September 2015');
    expect(prepared.unsignedXdr).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(server.calls.map((call) => call.type)).toEqual([
      'getAccount',
      'prepareTransaction',
    ]);
  });

  it('prepares a withdraw transaction for wallet signing', async () => {
    const writer = new StellarVaultWriter({
      contractId: CONTRACT_ID,
      sourcePublicKey: PUBLIC_KEY,
      server: new FakeWriteServer(),
    });

    const prepared = await writer.prepareWithdraw({
      to: PUBLIC_KEY,
      amount: 50n,
    });

    expect(prepared.method).toBe('withdraw');
    expect(prepared.args[0]).toBe(PUBLIC_KEY);
    expect(prepared.args[1]).toBe(50n);
  });

  it('prepares a claim rewards transaction for wallet signing', async () => {
    const writer = new StellarVaultWriter({
      contractId: CONTRACT_ID,
      sourcePublicKey: PUBLIC_KEY,
      server: new FakeWriteServer(),
    });

    const prepared = await writer.prepareClaimRewards({
      address: PUBLIC_KEY,
    });

    expect(prepared.method).toBe('claim_rewards');
    expect(prepared.args).toEqual([PUBLIC_KEY]);
  });

  it('submits a signed transaction and polls until success', async () => {
    const server = new FakeWriteServer();
    const writer = new StellarVaultWriter({
      contractId: CONTRACT_ID,
      sourcePublicKey: PUBLIC_KEY,
      server,
    });

    const prepared = await writer.prepareDeposit({
      from: PUBLIC_KEY,
      amount: 100,
    });

    const result = await writer.submitSignedTransaction(prepared.unsignedXdr, {
      pollIntervalMs: 0,
      maxPollAttempts: 1,
    });

    expect(result.status).toBe('success');
    expect(result.hash).toBe('abc123');
    expect(result.ledger).toBe(123);
    expect(server.calls.map((call) => call.type)).toContain('sendTransaction');
    expect(server.calls.map((call) => call.type)).toContain('getTransaction');
  });

  it('can return pending immediately when polling is disabled', async () => {
    const server = new FakeWriteServer();
    const writer = new StellarVaultWriter({
      contractId: CONTRACT_ID,
      sourcePublicKey: PUBLIC_KEY,
      server,
    });

    const prepared = await writer.prepareDeposit({
      from: PUBLIC_KEY,
      amount: 100,
    });

    const result = await writer.submitSignedTransaction(prepared.unsignedXdr, {
      poll: false,
    });

    expect(result.status).toBe('pending');
    expect(result.hash).toBe('abc123');
  });

  it('returns failed when the submitted transaction fails', async () => {
    const server = new FakeWriteServer(
      { status: 'PENDING', hash: 'abc123' },
      { status: 'FAILED', error: 'host invocation failed' },
    );

    const writer = new StellarVaultWriter({
      contractId: CONTRACT_ID,
      sourcePublicKey: PUBLIC_KEY,
      server,
    });

    const prepared = await writer.prepareDeposit({
      from: PUBLIC_KEY,
      amount: 100,
    });

    const result = await writer.submitSignedTransaction(prepared.unsignedXdr, {
      pollIntervalMs: 0,
      maxPollAttempts: 1,
    });

    expect(result.status).toBe('failed');
    expect(result.error).toBe('host invocation failed');
  });

  it('returns timeout when polling does not reach a terminal state', async () => {
    const server = new FakeWriteServer(
      { status: 'PENDING', hash: 'abc123' },
      { status: 'NOT_FOUND' },
    );

    const writer = new StellarVaultWriter({
      contractId: CONTRACT_ID,
      sourcePublicKey: PUBLIC_KEY,
      server,
    });

    const prepared = await writer.prepareDeposit({
      from: PUBLIC_KEY,
      amount: 100,
    });

    const result = await writer.submitSignedTransaction(prepared.unsignedXdr, {
      pollIntervalMs: 0,
      maxPollAttempts: 1,
    });

    expect(result.status).toBe('timeout');
    expect(result.hash).toBe('abc123');
  });

  it('rejects missing config and missing signed XDR', async () => {
    expect(
      () =>
        new StellarSorobanWriter({
          contractId: '',
          sourcePublicKey: PUBLIC_KEY,
        }),
    ).toThrow(ValidationError);

    const writer = new StellarVaultWriter({
      contractId: CONTRACT_ID,
      sourcePublicKey: PUBLIC_KEY,
      server: new FakeWriteServer(),
    });

    await expect(writer.submitSignedTransaction('')).rejects.toThrow(ValidationError);
  });

  it('throws when submission does not return a hash', async () => {
    const server = new FakeWriteServer({ status: 'ERROR', error: 'bad tx' });
    const writer = new StellarVaultWriter({
      contractId: CONTRACT_ID,
      sourcePublicKey: PUBLIC_KEY,
      server,
    });

    const prepared = await writer.prepareDeposit({
      from: PUBLIC_KEY,
      amount: 100,
    });

    await expect(writer.submitSignedTransaction(prepared.unsignedXdr)).rejects.toThrow(ContractError);
  });
});
