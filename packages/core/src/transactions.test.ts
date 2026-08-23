import { describe, expect, it } from 'vitest';

import { ValidationError } from './errors';
import { createContractCallRequest, normalizeAmount } from './transactions';

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
