import { ValidationError, WalletError } from './errors';
import {
  prepareUnsignedTransactionSigningRequest,
  type UnsignedTransactionSigningRequestInput,
} from './transactions';
import type { AxionveraNetwork } from './types';
import type { SignedTransactionResult, UnsignedTransactionSigningRequest } from './types';

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

export interface SignWithWalletParams {
  wallet: WalletConnector;
  transactionXdr: string;
  networkPassphrase: string;
  accountToSign?: string;
}

export interface RequestWalletSignatureParams {
  wallet: WalletConnector;
  request: UnsignedTransactionSigningRequest | UnsignedTransactionSigningRequestInput;
}

export interface TransactionSigningPipelineParams<TInput> {
  wallet: WalletConnector;
  prepareUnsignedTransaction(
    input: TInput
  ): UnsignedTransactionSigningRequestInput | UnsignedTransactionSigningRequest | Promise<UnsignedTransactionSigningRequestInput | UnsignedTransactionSigningRequest>;
}

export interface TransactionSigningPipeline<TInput> {
  prepare(input: TInput): Promise<UnsignedTransactionSigningRequest>;
  sign(request: UnsignedTransactionSigningRequest | UnsignedTransactionSigningRequestInput): Promise<SignedTransactionResult>;
  prepareAndSign(input: TInput): Promise<SignedTransactionResult>;
}

/**
 * Result of checking wallet readiness.
 */
export interface WalletReadiness {
  /** Whether the wallet is ready for use */
  isReady: boolean;
  /** Human-readable reason if not ready */
  reason?: string;
}

/**
 * Parameters for checking wallet readiness.
 */
export interface WalletReadinessParams {
  /** The wallet connector to check */
  connector?: WalletConnector | null;
  /** The current wallet connection state */
  connection?: WalletConnection | null;
}

/**
 * Checks whether a wallet connector is available and ready for use.
 *
 * This helper validates connector presence, connected state, and public key availability
 * to provide a predictable way to detect wallet readiness before SDK actions.
 *
 * @param params - The wallet readiness parameters to check
 * @returns A WalletReadiness object indicating readiness status and reason if not ready
 */
export function checkWalletReadiness(params: WalletReadinessParams): WalletReadiness {
  const { connector, connection } = params;

  // Check if connector is present
  if (!connector) {
    return { isReady: false, reason: 'Wallet connector is not available' };
  }

  // Check if connection is present
  if (!connection) {
    return { isReady: false, reason: 'Wallet is not connected' };
  }

  // Check if public key is present and valid
  if (!connection.publicKey || typeof connection.publicKey !== 'string' || !connection.publicKey.trim()) {
    return { isReady: false, reason: 'Wallet public key is not available' };
  }

  return { isReady: true };
}

/**
 * Signs a transaction XDR through a {@link WalletConnector}.
 * Validates required inputs and surfaces wallet failures as {@link WalletError}.
 */
export async function signWithWallet(params: SignWithWalletParams): Promise<string> {
  const { wallet, transactionXdr, networkPassphrase, accountToSign } = params;

  if (!wallet || typeof wallet.signTransaction !== 'function') {
    throw new ValidationError('wallet is required');
  }

  if (typeof transactionXdr !== 'string' || !transactionXdr.trim()) {
    throw new ValidationError('transaction XDR is required');
  }

  if (typeof networkPassphrase !== 'string' || !networkPassphrase.trim()) {
    throw new ValidationError('networkPassphrase is required');
  }

  const trimmedXdr = transactionXdr.trim();
  const options: SignTransactionOptions = {
    networkPassphrase: networkPassphrase.trim()
  };

  if (accountToSign !== undefined) {
    if (typeof accountToSign !== 'string' || !accountToSign.trim()) {
      throw new ValidationError('accountToSign must be a non-empty string when provided');
    }

    options.accountToSign = accountToSign.trim();
  }

  try {
    return await wallet.signTransaction(trimmedXdr, options);
  } catch (caught) {
    if (caught instanceof ValidationError || caught instanceof WalletError) {
      throw caught;
    }

    if (caught instanceof Error) {
      throw new WalletError(caught.message, caught);
    }

    throw new WalletError('Wallet signing failed', caught);
  }
}

/**
 * Requests a signature for a prepared unsigned transaction from any wallet connector.
 * Wallet-provider details stay behind the WalletConnector interface.
 */
export async function requestWalletSignature(
  params: RequestWalletSignatureParams
): Promise<SignedTransactionResult> {
  const { wallet, request } = params;
  const prepared = prepareUnsignedTransactionSigningRequest(request);

  const signedXdr = await signWithWallet({
    wallet,
    transactionXdr: prepared.unsignedXdr,
    networkPassphrase: prepared.networkPassphrase,
    accountToSign: prepared.accountToSign,
  });

  return {
    ...prepared,
    signedXdr,
    walletId: wallet.id,
    walletName: wallet.name,
  };
}

/**
 * Creates a provider-generic prepare -> wallet-sign pipeline.
 */
export function createTransactionSigningPipeline<TInput>(
  params: TransactionSigningPipelineParams<TInput>
): TransactionSigningPipeline<TInput> {
  const { wallet, prepareUnsignedTransaction } = params;

  if (!wallet || typeof wallet.signTransaction !== 'function') {
    throw new ValidationError('wallet is required');
  }

  if (typeof prepareUnsignedTransaction !== 'function') {
    throw new ValidationError('prepareUnsignedTransaction must be a function');
  }

  const prepare = async (input: TInput): Promise<UnsignedTransactionSigningRequest> => {
    const request = await prepareUnsignedTransaction(input);
    return prepareUnsignedTransactionSigningRequest(request);
  };

  const sign = async (
    request: UnsignedTransactionSigningRequest | UnsignedTransactionSigningRequestInput
  ): Promise<SignedTransactionResult> => requestWalletSignature({ wallet, request });

  return {
    prepare,
    sign,
    prepareAndSign: async (input: TInput): Promise<SignedTransactionResult> => {
      const request = await prepare(input);
      return sign(request);
    },
  };
}

export class MockWalletConnector implements WalletConnector {
  readonly id = 'mock';
  readonly name = 'Mock Wallet';

  private connected = false;

  constructor(
    private readonly publicKey: string = 'GAXIONVERAMOCKPUBLICKEY',
    private readonly signedPrefix: string = 'signed:'
  ) {}

  async connect(): Promise<WalletConnection> {
    this.connected = true;
    return {
      publicKey: this.publicKey,
      network: 'testnet'
    };
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async isConnected(): Promise<boolean> {
    return this.connected;
  }

  async signTransaction(transactionXdr: string, _options: SignTransactionOptions): Promise<string> {
    return `${this.signedPrefix}${transactionXdr}`;
  }
}
