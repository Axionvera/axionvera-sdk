// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTransactionStatus } from './useTransactionStatus';
import type { TransactionResult } from '@axionvera/core';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useTransactionStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('starts in idle state', () => {
    const { result } = renderHook(() => useTransactionStatus());

    expect(result.current.status).toBe('idle');
    expect(result.current.isIdle).toBe(true);
    expect(result.current.isPolling).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isFailed).toBe(false);
    expect(result.current.isTimeout).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.hash).toBeNull();
  });

  it('enters polling state when given a transaction hash', () => {
    const { result } = renderHook(() => useTransactionStatus());
    const lookup = vi.fn().mockResolvedValue({ hash: 'abc', status: 'pending' });

    act(() => {
      result.current.poll('abc', lookup);
    });

    expect(result.current.status).toBe('polling');
    expect(result.current.isPolling).toBe(true);
    expect(result.current.hash).toBe('abc');
  });

  it('handles success status', async () => {
    const { result } = renderHook(() => useTransactionStatus());
    const successResult: TransactionResult = { hash: 'abc', status: 'success', ledger: 100 };
    const lookup = vi.fn().mockResolvedValue(successResult);

    act(() => {
      result.current.poll('abc', lookup);
    });

    expect(result.current.status).toBe('polling');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.status).toBe('success');
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.result).toEqual(successResult);
    expect(result.current.error).toBeNull();
  });

  it('handles failed status', async () => {
    const { result } = renderHook(() => useTransactionStatus());
    const failedResult: TransactionResult = { hash: 'abc', status: 'failed', error: 'insufficient balance' };
    const lookup = vi.fn().mockResolvedValue(failedResult);

    act(() => {
      result.current.poll('abc', lookup);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.status).toBe('failed');
    expect(result.current.isFailed).toBe(true);
    expect(result.current.result).toEqual(failedResult);
    expect(result.current.error).toBeNull();
  });

  it('handles timeout status after max attempts', async () => {
    const { result } = renderHook(() => useTransactionStatus());
    const pendingResult: TransactionResult = { hash: 'abc', status: 'pending' };
    const lookup = vi.fn().mockResolvedValue(pendingResult);

    act(() => {
      result.current.poll('abc', lookup);
    });

    // Advance through all 30 polling attempts (1000ms interval each)
    for (let i = 0; i < 30; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }

    expect(result.current.status).toBe('timeout');
    expect(result.current.isTimeout).toBe(true);
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toContain('timed out');
  });

  it('handles lookup errors', async () => {
    const { result } = renderHook(() => useTransactionStatus());
    const lookup = vi.fn().mockRejectedValue(new Error('Network error'));

    act(() => {
      result.current.poll('abc', lookup);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.isError).toBe(true);
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe('Network error');
  });

  it('validates transaction hash is required', () => {
    const { result } = renderHook(() => useTransactionStatus());
    const lookup = vi.fn();

    act(() => {
      result.current.poll('', lookup);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toBe('Transaction hash is required');
  });

  it('validates transaction hash is not whitespace', () => {
    const { result } = renderHook(() => useTransactionStatus());
    const lookup = vi.fn();

    act(() => {
      result.current.poll('   ', lookup);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toBe('Transaction hash is required');
  });

  it('validates lookup function is required', () => {
    const { result } = renderHook(() => useTransactionStatus());

    act(() => {
      result.current.poll('abc', null as any);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toBe('Lookup function is required');
  });

  it('trims whitespace from transaction hash', async () => {
    const { result } = renderHook(() => useTransactionStatus());
    const successResult: TransactionResult = { hash: 'abc', status: 'success' };
    const lookup = vi.fn().mockResolvedValue(successResult);

    act(() => {
      result.current.poll('  abc  ', lookup);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.hash).toBe('abc');
    expect(lookup).toHaveBeenCalledWith('abc');
  });

  it('resets to idle state', async () => {
    const { result } = renderHook(() => useTransactionStatus());
    const successResult: TransactionResult = { hash: 'abc', status: 'success' };
    const lookup = vi.fn().mockResolvedValue(successResult);

    act(() => {
      result.current.poll('abc', lookup);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.status).toBe('success');

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.isIdle).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.hash).toBeNull();
  });

  it('aborts ongoing polling when reset is called', async () => {
    const { result } = renderHook(() => useTransactionStatus());
    const pendingResult: TransactionResult = { hash: 'abc', status: 'pending' };
    const lookup = vi.fn().mockResolvedValue(pendingResult);

    act(() => {
      result.current.poll('abc', lookup);
    });

    expect(result.current.status).toBe('polling');

    act(() => {
      result.current.reset();
    });

    // Advance timers - should not trigger any more lookups
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(result.current.status).toBe('idle');
    // Should only have been called once before reset
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it('aborts ongoing polling when new poll is started', async () => {
    const { result } = renderHook(() => useTransactionStatus());
    const pendingResult: TransactionResult = { hash: 'abc', status: 'pending' };
    const lookup1 = vi.fn().mockResolvedValue(pendingResult);
    const successResult: TransactionResult = { hash: 'def', status: 'success' };
    const lookup2 = vi.fn().mockResolvedValue(successResult);

    act(() => {
      result.current.poll('abc', lookup1);
    });

    expect(result.current.status).toBe('polling');

    act(() => {
      result.current.poll('def', lookup2);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.status).toBe('success');
    expect(result.current.hash).toBe('def');
    expect(lookup1).toHaveBeenCalledTimes(1);
    expect(lookup2).toHaveBeenCalledTimes(1);
  });

  it('polls with pending status until success', async () => {
    const { result } = renderHook(() => useTransactionStatus());
    let callCount = 0;
    const lookup = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        return Promise.resolve({ hash: 'abc', status: 'pending' });
      }
      return Promise.resolve({ hash: 'abc', status: 'success' });
    });

    act(() => {
      result.current.poll('abc', lookup);
    });

    // First poll
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.status).toBe('polling');
    expect(lookup).toHaveBeenCalledTimes(1);

    // Second poll
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.status).toBe('polling');
    expect(lookup).toHaveBeenCalledTimes(2);

    // Third poll - success
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.status).toBe('success');
    expect(lookup).toHaveBeenCalledTimes(3);
  });

  it('handles not_found status as non-terminal and continues polling', async () => {
    const { result } = renderHook(() => useTransactionStatus());
    let callCount = 0;
    const lookup = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 2) {
        return Promise.resolve({ hash: 'abc', status: 'not_found' });
      }
      return Promise.resolve({ hash: 'abc', status: 'success' });
    });

    act(() => {
      result.current.poll('abc', lookup);
    });

    // First poll - not_found
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.status).toBe('polling');

    // Second poll - success
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.status).toBe('success');
  });

  it('wraps non-Error rejections as Error instances', async () => {
    const { result } = renderHook(() => useTransactionStatus());
    const lookup = vi.fn().mockRejectedValue('string failure');

    act(() => {
      result.current.poll('abc', lookup);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('string failure');
  });

  it('cleans up polling on unmount', async () => {
    const { result, unmount } = renderHook(() => useTransactionStatus());
    const pendingResult: TransactionResult = { hash: 'abc', status: 'pending' };
    const lookup = vi.fn().mockResolvedValue(pendingResult);

    act(() => {
      result.current.poll('abc', lookup);
    });

    expect(result.current.status).toBe('polling');

    unmount();

    // Advance timers - should not trigger any errors
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    // Should have been called once before unmount
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it('clears previous error when new poll starts', async () => {
    const { result } = renderHook(() => useTransactionStatus());
    const lookup1 = vi.fn().mockRejectedValue(new Error('first error'));
    const successResult: TransactionResult = { hash: 'abc', status: 'success' };
    const lookup2 = vi.fn().mockResolvedValue(successResult);

    act(() => {
      result.current.poll('abc', lookup1);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toBe('first error');

    act(() => {
      result.current.poll('abc', lookup2);
    });

    expect(result.current.status).toBe('polling');
    expect(result.current.error).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.status).toBe('success');
  });
});
