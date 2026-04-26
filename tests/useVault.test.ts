/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { useVault } from '../packages/react/src/useVault';
import { TransactionTimeoutError } from '../packages/core/src/errors/axionveraError';

jest.useFakeTimers();

function makeClient(statuses: string[]) {
  let call = 0;
  return {
    getTransaction: jest.fn().mockImplementation(async () => ({
      status: statuses[Math.min(call++, statuses.length - 1)],
    })),
  } as any;
}

function makeVault(result: any = { hash: 'abc123' }) {
  return {
    deposit: jest.fn().mockResolvedValue(result),
    withdraw: jest.fn().mockResolvedValue(result),
  } as any;
}

describe('useVault', () => {
  afterEach(() => jest.clearAllTimers());

  test('initial state is idle', () => {
    const { result } = renderHook(() =>
      useVault({ client: makeClient([]), vault: makeVault() })
    );
    expect(result.current.step).toBe('idle');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('deposit progresses through signed → submitted → confirmed', async () => {
    const client = makeClient(['NOT_FOUND', 'SUCCESS']);
    const vault = makeVault({ hash: 'tx1' });
    const { result } = renderHook(() => useVault({ client, vault }));

    let depositPromise: Promise<void>;
    act(() => {
      depositPromise = result.current.deposit(500n);
    });

    // After vault.deposit resolves: signed then submitted
    await act(async () => {
      await Promise.resolve(); // flush microtasks
    });
    expect(result.current.step).toBe('submitted');
    expect(result.current.txHash).toBe('tx1');

    // Advance past first poll interval → NOT_FOUND, then second → SUCCESS
    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    await act(async () => { await depositPromise!; });
    expect(result.current.step).toBe('confirmed');
    expect(result.current.isLoading).toBe(false);
  });

  test('throws TransactionTimeoutError after 60s and resets to idle', async () => {
    const client = makeClient(['NOT_FOUND']); // always NOT_FOUND
    const vault = makeVault({ hash: 'txTimeout' });
    const { result } = renderHook(() => useVault({ client, vault }));

    let depositPromise: Promise<void>;
    act(() => {
      depositPromise = result.current.deposit(100n);
    });

    await act(async () => { await Promise.resolve(); });

    // Advance past 60s timeout
    await act(async () => {
      jest.advanceTimersByTime(61_000);
      await Promise.resolve();
    });

    await act(async () => { await depositPromise!; });

    expect(result.current.step).toBe('idle');
    expect(result.current.error).toBeInstanceOf(TransactionTimeoutError);
    expect((result.current.error as TransactionTimeoutError).hash).toBe('txTimeout');
  });

  test('sets error and resets to idle on vault failure', async () => {
    const client = makeClient([]);
    const vault = { deposit: jest.fn().mockRejectedValue(new Error('wallet rejected')) } as any;
    const { result } = renderHook(() => useVault({ client, vault }));

    await act(async () => { await result.current.deposit(100n); });

    expect(result.current.step).toBe('idle');
    expect(result.current.error?.message).toBe('wallet rejected');
  });

  test('calls onSuccess with hash when confirmed', async () => {
    const onSuccess = jest.fn();
    const client = makeClient(['SUCCESS']);
    const vault = makeVault({ hash: 'txOk' });
    const { result } = renderHook(() => useVault({ client, vault, onSuccess }));

    await act(async () => {
      const p = result.current.deposit(200n);
      jest.advanceTimersByTime(2000);
      await p;
    });

    expect(onSuccess).toHaveBeenCalledWith('txOk');
  });

  test('reset clears all state', async () => {
    const client = makeClient(['SUCCESS']);
    const vault = makeVault({ hash: 'txReset' });
    const { result } = renderHook(() => useVault({ client, vault }));

    await act(async () => {
      const p = result.current.deposit(100n);
      jest.advanceTimersByTime(2000);
      await p;
    });

    act(() => result.current.reset());
    expect(result.current.step).toBe('idle');
    expect(result.current.txHash).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
