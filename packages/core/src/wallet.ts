import type { AxionveraNetwork } from './types';

export interface WalletConnection {
  publicKey: string;
  network?: AxionveraNetwork;
}

export interface SignTransactionOptions {
  networkPassphrase: string;
  accountToSign?: string;
}

export interface WalletConnector {
  id: string;
  name: string;
  connect(): Promise<WalletConnection>;
  disconnect?(): Promise<void>;
  isConnected?(): Promise<boolean>;
  signTransaction(transactionXdr: string, options: SignTransactionOptions): Promise<string>;
}

export class MockWalletConnector implements WalletConnector {
  readonly id = 'mock';
  readonly name = 'Mock Wallet';

  constructor(
    private readonly publicKey: string = 'GAXIONVERAMOCKPUBLICKEY',
    private readonly signedPrefix: string = 'signed:'
  ) {}

  async connect(): Promise<WalletConnection> {
    return {
      publicKey: this.publicKey,
      network: 'testnet'
    };
  }

  async isConnected(): Promise<boolean> {
    return true;
  }

  async signTransaction(transactionXdr: string): Promise<string> {
    return `${this.signedPrefix}${transactionXdr}`;
  }
}
