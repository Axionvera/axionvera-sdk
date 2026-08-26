// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { MockWalletConnector } from '@axionvera/core';
import { AxionveraProvider, useAxionvera } from './provider';

const WALLET_PUBLIC_KEY = 'GABC1234567890';

function ProviderConsumer() {
  const { wallet, connection, isConnected, isReady, readiness, error, connect, disconnect, clearError } = useAxionvera();

  return (
    <div>
      <span data-testid="wallet">{wallet ? wallet.name : 'none'}</span>
      <span data-testid="connection">{connection ? connection.publicKey : 'none'}</span>
      <span data-testid="connected">{String(isConnected)}</span>
      <span data-testid="ready">{String(isReady)}</span>
      <span data-testid="readiness-reason">{readiness.reason || 'ready'}</span>
      <span data-testid="error">{error ? error.message : 'none'}</span>
      <button onClick={() => void connect()}>Connect</button>
      <button onClick={() => void disconnect()}>Disconnect</button>
      <button onClick={() => clearError()}>Clear Error</button>
    </div>
  );
}

afterEach(() => {
  cleanup();
});

describe('AxionveraProvider', () => {
  it('exposes wallet, connection, isConnected, isReady, readiness, error, connect, disconnect, and clearError through context', () => {
    const wallet = new MockWalletConnector(WALLET_PUBLIC_KEY);

    render(
      <AxionveraProvider wallet={wallet}>
        <ProviderConsumer />
      </AxionveraProvider>
    );

    expect(screen.getByTestId('wallet').textContent).toBe('Mock Wallet');
    expect(screen.getByTestId('connection').textContent).toBe('none');
    expect(screen.getByTestId('connected').textContent).toBe('false');
    expect(screen.getByTestId('ready').textContent).toBe('false');
    expect(screen.getByTestId('readiness-reason').textContent).toBe('Wallet is not connected');
    expect(screen.getByTestId('error').textContent).toBe('none');
  });

  it('updates context connection state on connect', async () => {
    const wallet = new MockWalletConnector(WALLET_PUBLIC_KEY);

    render(
      <AxionveraProvider wallet={wallet}>
        <ProviderConsumer />
      </AxionveraProvider>
    );

    fireEvent.click(screen.getByText('Connect'));

    await waitFor(() => expect(screen.getByTestId('connected').textContent).toBe('true'));
    expect(screen.getByTestId('connection').textContent).toBe(WALLET_PUBLIC_KEY);
    expect(screen.getByTestId('ready').textContent).toBe('true');
    expect(screen.getByTestId('readiness-reason').textContent).toBe('ready');
    expect(screen.getByTestId('error').textContent).toBe('none');
  });

  it('clears context connection state on disconnect', async () => {
    const wallet = new MockWalletConnector(WALLET_PUBLIC_KEY);

    render(
      <AxionveraProvider wallet={wallet}>
        <ProviderConsumer />
      </AxionveraProvider>
    );

    fireEvent.click(screen.getByText('Connect'));
    await waitFor(() => expect(screen.getByTestId('connected').textContent).toBe('true'));

    fireEvent.click(screen.getByText('Disconnect'));

    await waitFor(() => expect(screen.getByTestId('connected').textContent).toBe('false'));
    expect(screen.getByTestId('connection').textContent).toBe('none');
    expect(screen.getByTestId('ready').textContent).toBe('false');
    expect(screen.getByTestId('readiness-reason').textContent).toBe('Wallet is not connected');
    expect(screen.getByTestId('error').textContent).toBe('none');
  });

  it('stores the wallet connection returned by connect', async () => {
    const wallet = new MockWalletConnector(WALLET_PUBLIC_KEY);

    const { result } = renderHook(() => useAxionvera(), {
      wrapper: ({ children }) => <AxionveraProvider wallet={wallet}>{children}</AxionveraProvider>
    });

    expect(result.current.wallet).toBe(wallet);
    expect(result.current.connection).toBeNull();
    expect(result.current.isConnected).toBe(false);

    await act(async () => {
      await expect(result.current.connect()).resolves.toEqual({
        publicKey: WALLET_PUBLIC_KEY,
        network: 'testnet'
      });
    });

    expect(result.current.connection).toEqual({
      publicKey: WALLET_PUBLIC_KEY,
      network: 'testnet'
    });
    expect(result.current.isConnected).toBe(true);
    expect(result.current.isReady).toBe(true);
    expect(result.current.readiness.isReady).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('clears the connection state on disconnect', async () => {
    const wallet = new MockWalletConnector(WALLET_PUBLIC_KEY);

    const { result } = renderHook(() => useAxionvera(), {
      wrapper: ({ children }) => <AxionveraProvider wallet={wallet}>{children}</AxionveraProvider>
    });

    await act(async () => {
      await result.current.connect();
    });
    expect(result.current.isConnected).toBe(true);

    await act(async () => {
      await result.current.disconnect();
    });

    expect(result.current.connection).toBeNull();
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isReady).toBe(false);
    expect(result.current.readiness.isReady).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('throws a clear error when connect is called without a wallet connector', async () => {
    const { result } = renderHook(() => useAxionvera(), {
      wrapper: ({ children }) => <AxionveraProvider>{children}</AxionveraProvider>
    });

    await act(async () => {
      await expect(result.current.connect()).rejects.toThrow('No wallet connector was provided');
    });

    expect(result.current.connection).toBeNull();
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isReady).toBe(false);
    expect(result.current.readiness.reason).toBe('Wallet connector is not available');
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe('No wallet connector was provided');
  });

  it('clears error when clearError is called', async () => {
    const { result } = renderHook(() => useAxionvera(), {
      wrapper: ({ children }) => <AxionveraProvider>{children}</AxionveraProvider>
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

  it('sets error on connect failure', async () => {
    class FailingWalletConnector extends MockWalletConnector {
      async connect(): Promise<{ publicKey: string; network?: string }> {
        throw new Error('Connection failed');
      }
    }

    const wallet = new FailingWalletConnector(WALLET_PUBLIC_KEY);
    const { result } = renderHook(() => useAxionvera(), {
      wrapper: ({ children }) => <AxionveraProvider wallet={wallet}>{children}</AxionveraProvider>
    });

    await act(async () => {
      await expect(result.current.connect()).rejects.toThrow('Connection failed');
    });

    expect(result.current.connection).toBeNull();
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe('Connection failed');
  });

  it('sets error on disconnect failure', async () => {
    class FailingDisconnectWalletConnector extends MockWalletConnector {
      async disconnect() {
        throw new Error('Disconnect failed');
      }
    }

    const wallet = new FailingDisconnectWalletConnector(WALLET_PUBLIC_KEY);
    const { result } = renderHook(() => useAxionvera(), {
      wrapper: ({ children }) => <AxionveraProvider wallet={wallet}>{children}</AxionveraProvider>
    });

    await act(async () => {
      await result.current.connect();
    });

    await act(async () => {
      await expect(result.current.disconnect()).rejects.toThrow('Disconnect failed');
    });

    expect(result.current.connection).toBeNull();
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe('Disconnect failed');
  });

  it('shows not ready when wallet connector is not available', () => {
    const { result } = renderHook(() => useAxionvera(), {
      wrapper: ({ children }) => <AxionveraProvider>{children}</AxionveraProvider>
    });

    expect(result.current.isReady).toBe(false);
    expect(result.current.readiness.isReady).toBe(false);
    expect(result.current.readiness.reason).toBe('Wallet connector is not available');
  });

  it('shows not ready when wallet is disconnected', () => {
    const wallet = new MockWalletConnector(WALLET_PUBLIC_KEY);
    const { result } = renderHook(() => useAxionvera(), {
      wrapper: ({ children }) => <AxionveraProvider wallet={wallet}>{children}</AxionveraProvider>
    });

    expect(result.current.isReady).toBe(false);
    expect(result.current.readiness.isReady).toBe(false);
    expect(result.current.readiness.reason).toBe('Wallet is not connected');
  });

  it('shows ready when wallet is connected with public key', async () => {
    const wallet = new MockWalletConnector(WALLET_PUBLIC_KEY);
    const { result } = renderHook(() => useAxionvera(), {
      wrapper: ({ children }) => <AxionveraProvider wallet={wallet}>{children}</AxionveraProvider>
    });

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.isReady).toBe(true);
    expect(result.current.readiness.isReady).toBe(true);
    expect(result.current.readiness.reason).toBeUndefined();
  });
});

describe('useAxionvera', () => {
  it('throws a clear error when used outside AxionveraProvider', () => {
    expect(() => renderHook(() => useAxionvera())).toThrow(
      'useAxionvera must be used inside AxionveraProvider'
    );
  });
});
