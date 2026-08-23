import { describe, expect, it } from 'vitest';

import { TransactionTimeoutError, ValidationError } from './errors';
import {
  createContractCallRequest,
  normalizeAmount,
  normalizeTransactionResult,
  waitForTransaction,
} from './transactions';
import type { TransactionResult } from './types';

const CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const METHOD = 'transfer';

describe('createContractCallRequest', () => {
  describe('valid requests', () => {
    it('returns a request that preserves contractId, method, and args', () => {
      const args: readonly unknown[] = [
        'GBXGQJWVLWOYHFLVTKWV5FGHA3LNYY2JQDB6X5AQMP6GHY2XPWUQ6W2Z',
        5000000n,
      ];

      const request = createContractCallRequest(CONTRACT_ID, METHOD, args);

      expect(request).toEqual({ contractId: CONTRACT_ID, method: METHOD, args });
      expect(request.contractId).toBe(CONTRACT_ID);
      expect(request.method).toBe(METHOD);
      expect(request.args).toBe(args);
    });

    it('preserves representative argument values without changing, reordering, or dropping them', () => {
      const args: readonly unknown[] = [
        'GA7QNFARK7QGV5ZWX7DKW2Q3XWXJ5Y3K5H2W3JXQ6Y3X2Z6M3G5KJQ2V6T',
        42,
        true,
        null,
        { nested: { value: 'x' } },
        [1, 2, 3],
        100n,
      ];

      const request = createContractCallRequest(CONTRACT_ID, 'execute', args);

      expect(request.args).toBe(args);
      expect(request.args).toStrictEqual(args);
    });
  });

  describe('validation', () => {
    it.each([
      {
        description: 'rejects an empty contractId',
        contractId: '',
        method: METHOD,
        message: 'contractId is required',
      },
      {
        description: 'rejects a whitespace-only contractId',
        contractId: '   ',
        method: METHOD,
        message: 'contractId is required',
      },
      {
        description: 'rejects an empty method',
        contractId: CONTRACT_ID,
        method: '',
        message: 'method is required',
      },
      {
        description: 'rejects a whitespace-only method',
        contractId: CONTRACT_ID,
        method: '   ',
        message: 'method is required',
      },
    ])('$description', ({ contractId, method, message }) => {
      const call = () => createContractCallRequest(contractId, method);

      expect(call).toThrow(ValidationError);
      expect(call).toThrow(new RegExp(`^${message}$`));
    });
  });
});

describe('normalizeAmount', () => {
  it('normalizes valid positive bigint inputs to bigint', () => {
    expect(normalizeAmount(100n)).toBe(100n);
  });

  it('normalizes valid positive number inputs to bigint', () => {
    expect(normalizeAmount(100)).toBe(100n);
  });

  it('normalizes valid positive string inputs to bigint', () => {
    expect(normalizeAmount('100')).toBe(100n);
  });

  it('throws ValidationError for zero values', () => {
    expect(() => normalizeAmount(0n)).toThrow(ValidationError);
    expect(() => normalizeAmount(0)).toThrow(ValidationError);
    expect(() => normalizeAmount('0')).toThrow(ValidationError);
  });

  it('throws ValidationError for negative values', () => {
    expect(() => normalizeAmount(-5n)).toThrow(ValidationError);
    expect(() => normalizeAmount(-5)).toThrow(ValidationError);
    expect(() => normalizeAmount('-5')).toThrow(ValidationError);
  });

  it('throws an error for invalid amount strings', () => {
    expect(() => normalizeAmount('invalid')).toThrow();
  });
});

describe('normalizeTransactionResult', () => {
  it('normalizes a successful transaction', () => {
    const raw = { hash: 'hash123', status: 'SUCCESS', ledger: 100 };
    expect(normalizeTransactionResult(raw)).toEqual({
      hash: 'hash123',
      status: 'success',
      ledger: 100,
    });
  });

  it('normalizes a failed transaction with an error message', () => {
    const raw = { hash: 'hash456', status: 'FAILED', error: 'insufficient balance' };
    expect(normalizeTransactionResult(raw)).toEqual({
      hash: 'hash456',
      status: 'failed',
      error: 'insufficient balance',
    });
  });

  it('normalizes a pending transaction', () => {
    const raw = { hash: 'hash789', status: 'PENDING' };
    expect(normalizeTransactionResult(raw)).toEqual({
      hash: 'hash789',
      status: 'pending',
    });
  });

  it('normalizes a not_found transaction', () => {
    const raw = { hash: 'hash000', status: 'NOT_FOUND' };
    expect(normalizeTransactionResult(raw)).toEqual({
      hash: 'hash000',
      status: 'not_found',
    });
  });

  it('throws a ValidationError for invalid inputs', () => {
    expect(() => normalizeTransactionResult(null)).toThrow(ValidationError);
    expect(() => normalizeTransactionResult(undefined)).toThrow(ValidationError);
    expect(() => normalizeTransactionResult('string')).toThrow(ValidationError);
    expect(() => normalizeTransactionResult({})).toThrow(ValidationError);
    expect(() => normalizeTransactionResult({ hash: '' })).toThrow(ValidationError);
    expect(() => normalizeTransactionResult({ hash: 'hash', status: 'UNKNOWN' })).toThrow(ValidationError);
    expect(() => normalizeTransactionResult({ hash: 'hash', status: 123 })).toThrow(ValidationError);
  });
});

describe('waitForTransaction', () => {
  const HASH = 'tx_hash_123';
  const noopDelay = async () => {};

  it('returns immediately when the status is success', async () => {
    const lookup = async () => ({ hash: HASH, status: 'success' }) as TransactionResult;
    const result = await waitForTransaction({ lookup, hash: HASH, delay: noopDelay });
    expect(result).toEqual({ hash: HASH, status: 'success' });
  });

  it('returns the result when the status is failed (terminal)', async () => {
    const lookup = async () =>
      ({ hash: HASH, status: 'failed', error: 'insufficient balance' }) as TransactionResult;
    const result = await waitForTransaction({ lookup, hash: HASH, delay: noopDelay });
    expect(result).toEqual({ hash: HASH, status: 'failed', error: 'insufficient balance' });
  });

  it('continues polling while pending and resolves once success is observed', async () => {
    let calls = 0;
    const lookup = async () => {
      calls += 1;
      return (calls < 3 ? { hash: HASH, status: 'pending' } : { hash: HASH, status: 'success' }) as TransactionResult;
    };
    const result = await waitForTransaction({ lookup, hash: HASH, maxAttempts: 5, delay: noopDelay });
    expect(result.status).toBe('success');
    expect(calls).toBe(3);
  });

  it('treats not_found as non-terminal and keeps polling', async () => {
    let calls = 0;
    const lookup = async () => {
      calls += 1;
      return (calls < 2 ? { hash: HASH, status: 'not_found' } : { hash: HASH, status: 'success' }) as TransactionResult;
    };
    const result = await waitForTransaction({ lookup, hash: HASH, maxAttempts: 5, delay: noopDelay });
    expect(result.status).toBe('success');
    expect(calls).toBe(2);
  });

  it('throws TransactionTimeoutError after maxAttempts of non-terminal statuses', async () => {
    let calls = 0;
    const lookup = async () => {
      calls += 1;
      return { hash: HASH, status: 'pending' } as TransactionResult;
    };
    await expect(
      waitForTransaction({ lookup, hash: HASH, maxAttempts: 3, delay: noopDelay }),
    ).rejects.toThrow(TransactionTimeoutError);
    expect(calls).toBe(3);
  });

  it('throws TransactionTimeoutError when only not_found is ever observed', async () => {
    let calls = 0;
    const lookup = async () => {
      calls += 1;
      return { hash: HASH, status: 'not_found' } as TransactionResult;
    };
    await expect(
      waitForTransaction({ lookup, hash: HASH, maxAttempts: 2, delay: noopDelay }),
    ).rejects.toThrow(TransactionTimeoutError);
    expect(calls).toBe(2);
  });

  it('uses the injected delay between polls', async () => {
    const delays: number[] = [];
    const delay = async (ms: number) => {
      delays.push(ms);
    };
    let calls = 0;
    const lookup = async () => {
      calls += 1;
      return (calls < 2 ? { hash: HASH, status: 'pending' } : { hash: HASH, status: 'success' }) as TransactionResult;
    };
    await waitForTransaction({ lookup, hash: HASH, interval: 250, maxAttempts: 5, delay });
    expect(delays).toEqual([250]);
  });

  it('rejects when lookup is missing or not a function', async () => {
    await expect(
      waitForTransaction({ lookup: undefined as never, hash: HASH, delay: noopDelay }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects when hash is empty or whitespace', async () => {
    const lookup = async () => ({ hash: HASH, status: 'success' }) as TransactionResult;
    await expect(
      waitForTransaction({ lookup, hash: '', delay: noopDelay }),
    ).rejects.toThrow(ValidationError);
    await expect(
      waitForTransaction({ lookup, hash: '   ', delay: noopDelay }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects invalid interval and maxAttempts values', async () => {
    const lookup = async () => ({ hash: HASH, status: 'success' }) as TransactionResult;
    await expect(
      waitForTransaction({ lookup, hash: HASH, interval: -1, delay: noopDelay }),
    ).rejects.toThrow(ValidationError);
    await expect(
      waitForTransaction({ lookup, hash: HASH, maxAttempts: 0, delay: noopDelay }),
    ).rejects.toThrow(ValidationError);
  });

  it('passes the trimmed hash to the lookup function', async () => {
    let received = '';
    const lookup = async (h: string) => {
      received = h;
      return { hash: HASH, status: 'success' } as TransactionResult;
    };
    await waitForTransaction({ lookup, hash: `  ${HASH}  `, delay: noopDelay });
    expect(received).toBe(HASH);
  });
});
