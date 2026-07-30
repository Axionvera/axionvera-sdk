import { describe, it, expect } from '@jest/globals';
import { makeAccount, makeTransaction, FIXTURE_ADDRESS } from './fixtures';

describe('regression harness', () => {
  it('fixtures are deterministic — same input yields same output', () => {
    const a1 = makeAccount();
    const a2 = makeAccount();
    expect(a1).toEqual(a2);
  });

  it('account fixture has expected fields', () => {
    const account = makeAccount();
    expect(account).toHaveProperty('id', FIXTURE_ADDRESS);
    expect(account).toHaveProperty('balance');
    expect(account).toHaveProperty('sequence');
  });

  it('transaction fixture has expected fields', () => {
    const tx = makeTransaction();
    expect(tx).toHaveProperty('id', 'tx-fixture-001');
    expect(tx).toHaveProperty('source', FIXTURE_ADDRESS);
    expect(tx).toHaveProperty('fee');
    expect(tx).toHaveProperty('operations');
  });

  it('fixtures do not mutate across calls', () => {
    const a1 = makeAccount();
    const a2 = makeAccount();
    a1.balance = '999999';
    expect(a2.balance).toBe('1000000');
  });
});
