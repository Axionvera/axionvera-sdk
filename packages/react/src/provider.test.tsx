// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { MockWalletConnector } from '@axionvera/core';
import { AxionveraProvider, useAxionvera } from './provider';

const WALLET_PUBLIC_KEY = 'GABC1234567890';

function ProviderConsumer() {
  const { wallet, connection, isConnected, connect, disconnect } = useAxionvera();

  return (
    <div>
      <span data-testid="wallet">{wallet ? wallet.name : 'none'}</span>
      <span data-testid="connection">{connection ? connection.publicKey : 'none'}</span>
      <span data-testid="connected">{String(isConnected)}</span>
      <button onClick={() => void connect()}>Connect</button>
      <button onClick={() => void disconnect()}>Disconnect</button>
    </div>
  );
}

afterEach(() => {
  cleanup();
});

describe('AxionveraProvider', () => {
  it('exposes wallet, connection, isConnected, connect, and disconnect through context', () => {
    const wallet = new MockWalletConnector(WALLET_PUBLIC_KEY);

    render(
      <AxionveraProvider wallet={wallet}>
        <ProviderConsumer />
      </AxionveraProvider>
    );

    expect(screen.getByTestId('wallet').textContent).toBe('Mock Wallet');
    expect(screen.getByTestId('connection').textContent).toBe('none');
    expect(screen.getByTestId('connected').textContent).toBe('false');
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
  });
});

describe('useAxionvera', () => {
  it('throws a clear error when used outside AxionveraProvider', () => {
    expect(() => renderHook(() => useAxionvera())).toThrow(
      'useAxionvera must be used inside AxionveraProvider'
    );
  });
});
