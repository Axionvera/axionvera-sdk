// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { MockWalletConnector } from '@axionvera/core';
import { AxionveraProvider, useWallet } from './index';

const WALLET_PUBLIC_KEY = 'GABC1234567890';

afterEach(() => {
  cleanup();
});

describe('useWallet', () => {
  it('throws a clear error when used outside AxionveraProvider', () => {
    expect(() => renderHook(() => useWallet())).toThrow(
      'useAxionvera must be used inside AxionveraProvider'
    );
  });

  it('exposes wallet state and actions', () => {
    const wallet = new MockWalletConnector(WALLET_PUBLIC_KEY);

    const { result } = renderHook(() => useWallet(), {
      wrapper: ({ children }: { children: React.ReactNode }) => <AxionveraProvider wallet={wallet}>{children}</AxionveraProvider>
    });

    expect(result.current.wallet).toBe(wallet);
    expect(result.current.connection).toBeNull();
    expect(result.current.publicKey).toBeUndefined();
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isReady).toBe(false);
    expect(result.current.readiness.isReady).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.connect).toBe('function');
    expect(typeof result.current.disconnect).toBe('function');
    expect(typeof result.current.clearError).toBe('function');
  });

  it('exposes publicKey when connected', async () => {
    const wallet = new MockWalletConnector(WALLET_PUBLIC_KEY);

    const { result } = renderHook(() => useWallet(), {
      wrapper: ({ children }: { children: React.ReactNode }) => <AxionveraProvider wallet={wallet}>{children}</AxionveraProvider>
    });

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.publicKey).toBe(WALLET_PUBLIC_KEY);
  });

  it('updates readiness state on connect', async () => {
    const wallet = new MockWalletConnector(WALLET_PUBLIC_KEY);

    const { result } = renderHook(() => useWallet(), {
      wrapper: ({ children }: { children: React.ReactNode }) => <AxionveraProvider wallet={wallet}>{children}</AxionveraProvider>
    });

    expect(result.current.isReady).toBe(false);

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.isReady).toBe(true);
    expect(result.current.readiness.isReady).toBe(true);
  });

  it('updates readiness state on disconnect', async () => {
    const wallet = new MockWalletConnector(WALLET_PUBLIC_KEY);

    const { result } = renderHook(() => useWallet(), {
      wrapper: ({ children }: { children: React.ReactNode }) => <AxionveraProvider wallet={wallet}>{children}</AxionveraProvider>
    });

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.isReady).toBe(true);

    await act(async () => {
      await result.current.disconnect();
    });

    expect(result.current.isReady).toBe(false);
    expect(result.current.readiness.isReady).toBe(false);
  });

  it('clears publicKey on disconnect', async () => {
    const wallet = new MockWalletConnector(WALLET_PUBLIC_KEY);

    const { result } = renderHook(() => useWallet(), {
      wrapper: ({ children }: { children: React.ReactNode }) => <AxionveraProvider wallet={wallet}>{children}</AxionveraProvider>
    });

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.publicKey).toBe(WALLET_PUBLIC_KEY);

    await act(async () => {
      await result.current.disconnect();
    });

    expect(result.current.publicKey).toBeUndefined();
  });

  it('exposes error state on connect failure', async () => {
    class FailingWalletConnector extends MockWalletConnector {
      async connect(): Promise<{ publicKey: string; network?: string }> {
        throw new Error('Connection failed');
      }
    }

    const wallet = new FailingWalletConnector(WALLET_PUBLIC_KEY);
    const { result } = renderHook(() => useWallet(), {
      wrapper: ({ children }: { children: React.ReactNode }) => <AxionveraProvider wallet={wallet}>{children}</AxionveraProvider>
    });

    await act(async () => {
      await expect(result.current.connect()).rejects.toThrow('Connection failed');
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe('Connection failed');
  });

  it('clears error state on successful connect', async () => {
    class FailingThenSuccessWalletConnector extends MockWalletConnector {
      private attempts = 0;
      async connect(): Promise<{ publicKey: string; network?: string }> {
        this.attempts++;
        if (this.attempts === 1) {
          throw new Error('First attempt failed');
        }
        return super.connect();
      }
    }

    const wallet = new FailingThenSuccessWalletConnector(WALLET_PUBLIC_KEY);
    const { result } = renderHook(() => useWallet(), {
      wrapper: ({ children }: { children: React.ReactNode }) => <AxionveraProvider wallet={wallet}>{children}</AxionveraProvider>
    });

    await act(async () => {
      await expect(result.current.connect()).rejects.toThrow('First attempt failed');
    });

    expect(result.current.error).not.toBeNull();

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.error).toBeNull();
  });

  it('clears error when clearError is called', async () => {
    const { result } = renderHook(() => useWallet(), {
      wrapper: ({ children }: { children: React.ReactNode }) => <AxionveraProvider>{children}</AxionveraProvider>
    });

    await act(async () => {
      await expect(result.current.connect()).rejects.toThrow('No wallet connector was provided');
    });

    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });
});
