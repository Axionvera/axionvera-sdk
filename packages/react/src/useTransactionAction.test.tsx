// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useTransactionAction } from './useTransactionAction';

afterEach(() => {
  cleanup();
});

describe('useTransactionAction', () => {
  it('starts in the idle state', () => {
    const { result } = renderHook(() => useTransactionAction());

    expect(result.current.status).toBe('idle');
    expect(result.current.isIdle).toBe(true);
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.hash).toBeNull();
  });

  it('moves through submitting to success and captures result plus hash', async () => {
    const { result } = renderHook(() =>
      useTransactionAction<{ status: string; hash: string }>()
    );

    let resolveAction!: (value: { status: string; hash: string }) => void;
    const pending = new Promise<{ status: string; hash: string }>((resolve) => {
      resolveAction = resolve;
    });

    let runPromise!: Promise<{ status: string; hash: string }>;
    act(() => {
      runPromise = result.current.run(() => pending);
    });

    expect(result.current.status).toBe('submitting');
    expect(result.current.isSubmitting).toBe(true);
    expect(result.current.error).toBeNull();

    const tx = { status: 'success', hash: 'hash-abc' };
    await act(async () => {
      resolveAction(tx);
      await expect(runPromise).resolves.toBe(tx);
    });

    expect(result.current.status).toBe('success');
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.result).toBe(tx);
    expect(result.current.hash).toBe('hash-abc');
    expect(result.current.error).toBeNull();
  });

  it('leaves hash null when a successful result has no hash', async () => {
    const { result } = renderHook(() => useTransactionAction<{ status: string }>());

    await act(async () => {
      await result.current.run(async () => ({ status: 'pending' }));
    });

    expect(result.current.status).toBe('success');
    expect(result.current.hash).toBeNull();
    expect(result.current.result).toEqual({ status: 'pending' });
  });

  it('captures thrown errors and rethrows them', async () => {
    const { result } = renderHook(() => useTransactionAction());
    const boom = new Error('tx failed');

    await act(async () => {
      await expect(result.current.run(async () => {
        throw boom;
      })).rejects.toBe(boom);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(boom);
    expect(result.current.result).toBeNull();
    expect(result.current.hash).toBeNull();
  });

  it('wraps non-Error failures as Error instances', async () => {
    const { result } = renderHook(() => useTransactionAction());

    await act(async () => {
      await expect(
        result.current.run(async () => {
          throw 'string failure';
        })
      ).rejects.toThrow('string failure');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('string failure');
  });

  it('reset returns state to idle and clears result, hash, and error', async () => {
    const { result } = renderHook(() =>
      useTransactionAction<{ status: string; hash: string }>()
    );

    await act(async () => {
      await result.current.run(async () => ({ status: 'success', hash: 'h1' }));
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

  it('clears a previous error when a new run starts', async () => {
    const { result } = renderHook(() => useTransactionAction<{ ok: boolean }>());

    await act(async () => {
      await expect(
        result.current.run(async () => {
          throw new Error('first');
        })
      ).rejects.toThrow('first');
    });

    expect(result.current.isError).toBe(true);

    let resolveAction!: (value: { ok: boolean }) => void;
    const pending = new Promise<{ ok: boolean }>((resolve) => {
      resolveAction = resolve;
    });

    act(() => {
      void result.current.run(() => pending);
    });

    expect(result.current.status).toBe('submitting');
    expect(result.current.error).toBeNull();

    await act(async () => {
      resolveAction({ ok: true });
    });

    expect(result.current.status).toBe('success');
    expect(result.current.result).toEqual({ ok: true });
  });

  it('ignores blank hash strings on successful results', async () => {
    const { result } = renderHook(() =>
      useTransactionAction<{ hash: string }>()
    );

    await act(async () => {
      await result.current.run(async () => ({ hash: '   ' }));
    });

    expect(result.current.status).toBe('success');
    expect(result.current.hash).toBeNull();
  });
});
