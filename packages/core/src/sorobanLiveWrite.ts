import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  xdr,
} from '@stellar/stellar-sdk';
import { ContractError, NetworkError, ValidationError } from './errors';
import {
  normalizeAmount,
  transactionFailed,
  transactionPending,
  transactionSuccess,
  transactionTimeout,
} from './transactions';
import type { AmountInput, TransactionActionResult } from './types';

export type SorobanWriteArg = string | number | boolean | bigint | xdr.ScVal;

export interface StellarPreparedWriteTransaction {
  unsignedXdr: string;
  networkPassphrase: string;
  accountToSign: string;
  signerPublicKey: string;
  contractId: string;
  method: string;
  args: readonly SorobanWriteArg[];
}

export interface StellarSorobanWriteServer {
  getAccount(publicKey: string): Promise<Account>;
  prepareTransaction(transaction: unknown): Promise<{ toXDR(): string }>;
  sendTransaction(transaction: unknown): Promise<unknown>;
  getTransaction(hash: string): Promise<unknown>;
}

export interface StellarSorobanWriteConfig {
  contractId: string;
  rpcUrl?: string;
  sourcePublicKey: string;
  networkPassphrase?: string;
  server?: StellarSorobanWriteServer;
  timeoutSeconds?: number;
}

export interface PrepareWriteRequest {
  method: string;
  args?: readonly SorobanWriteArg[];
}

export interface SubmitSignedTransactionOptions {
  poll?: boolean;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
}

function requireNonEmptyString(value: string | undefined, name: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${name} must be a non-empty string`);
  }

  return value.trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function toSorobanWriteScVal(value: SorobanWriteArg): xdr.ScVal {
  if (value instanceof xdr.ScVal) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      return Address.fromString(value).toScVal();
    } catch {
      return nativeToScVal(value);
    }
  }

  if (typeof value === 'bigint') {
    return nativeToScVal(value, { type: 'i128' });
  }

  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      throw new ValidationError('number arguments must be integers');
    }

    return nativeToScVal(BigInt(value), { type: 'i128' });
  }

  return nativeToScVal(value);
}

function requireRecordResponse(response: unknown, context: string): Record<string, unknown> {
  if (!response || typeof response !== 'object') {
    throw new ContractError(`${context} did not return an object`);
  }

  return response as Record<string, unknown>;
}

function extractHash(response: Record<string, unknown>): string {
  const hash = response.hash;

  if (typeof hash !== 'string' || !hash.trim()) {
    throw new ContractError('Soroban transaction submission did not return a transaction hash');
  }

  return hash.trim();
}

function extractStatus(response: Record<string, unknown>): string {
  return typeof response.status === 'string' ? response.status.toUpperCase() : '';
}

function extractError(response: Record<string, unknown>): string | undefined {
  const error = response.error ?? response.errorResult ?? response.diagnosticEvents;

  if (error === undefined) {
    return undefined;
  }

  if (typeof error === 'string') {
    return error;
  }

  return JSON.stringify(error);
}

export class StellarSorobanWriter {
  private readonly contractId: string;
  private readonly sourcePublicKey: string;
  private readonly networkPassphrase: string;
  private readonly timeoutSeconds: number;
  private readonly server: StellarSorobanWriteServer;

  constructor(config: StellarSorobanWriteConfig) {
    this.contractId = requireNonEmptyString(config.contractId, 'contractId');
    this.sourcePublicKey = requireNonEmptyString(config.sourcePublicKey, 'sourcePublicKey');
    this.networkPassphrase = config.networkPassphrase ?? Networks.TESTNET;
    this.timeoutSeconds = config.timeoutSeconds ?? 30;

    const rpcUrl = config.rpcUrl ?? 'https://soroban-testnet.stellar.org';
    this.server = config.server ?? new rpc.Server(rpcUrl);
  }

  async prepareWrite(request: PrepareWriteRequest): Promise<StellarPreparedWriteTransaction> {
    const method = requireNonEmptyString(request.method, 'method');
    const args = request.args ?? [];

    try {
      const sourceAccount = await this.server.getAccount(this.sourcePublicKey);
      const contract = new Contract(this.contractId);
      const scArgs = args.map(toSorobanWriteScVal);

      const transaction = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(contract.call(method, ...scArgs))
        .setTimeout(this.timeoutSeconds)
        .build();

      const prepared = await this.server.prepareTransaction(transaction);
      const unsignedXdr = prepared.toXDR();

      return {
        unsignedXdr,
        networkPassphrase: this.networkPassphrase,
        accountToSign: this.sourcePublicKey,
        signerPublicKey: this.sourcePublicKey,
        contractId: this.contractId,
        method,
        args,
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ContractError) {
        throw error;
      }

      throw new NetworkError(
        error instanceof Error ? error.message : 'Soroban write preparation failed',
        error,
      );
    }
  }

  async submitSignedTransaction(
    signedXdr: string,
    options: SubmitSignedTransactionOptions = {},
  ): Promise<TransactionActionResult> {
    const trimmedSignedXdr = requireNonEmptyString(signedXdr, 'signedXdr');
    const poll = options.poll ?? true;
    const pollIntervalMs = options.pollIntervalMs ?? 1_000;
    const maxPollAttempts = options.maxPollAttempts ?? 30;

    try {
      const signedTransaction = TransactionBuilder.fromXDR(
        trimmedSignedXdr,
        this.networkPassphrase,
      );

      const submitted = requireRecordResponse(
        await this.server.sendTransaction(signedTransaction),
        'Soroban transaction submission',
      );
      const status = extractStatus(submitted);
      const hash = extractHash(submitted);

      if (status === 'ERROR') {
        return transactionFailed(hash, extractError(submitted), submitted);
      }

      if (!poll) {
        return transactionPending(hash, submitted);
      }

      return await this.waitForTransaction(hash, pollIntervalMs, maxPollAttempts);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ContractError) {
        throw error;
      }

      throw new NetworkError(
        error instanceof Error ? error.message : 'Soroban transaction submission failed',
        error,
      );
    }
  }

  private async waitForTransaction(
    hash: string,
    pollIntervalMs: number,
    maxPollAttempts: number,
  ): Promise<TransactionActionResult> {
    for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
      const tx = requireRecordResponse(
        await this.server.getTransaction(hash),
        'Soroban transaction lookup',
      );
      const status = extractStatus(tx);

      if (status === 'SUCCESS') {
        const ledger = typeof tx.ledger === 'number' ? tx.ledger : undefined;
        return transactionSuccess(hash, ledger, tx);
      }

      if (status === 'FAILED') {
        return transactionFailed(hash, extractError(tx), tx);
      }

      await sleep(pollIntervalMs);
    }

    return transactionTimeout(hash);
  }
}

export class StellarVaultWriter {
  private readonly writer: StellarSorobanWriter;

  constructor(config: StellarSorobanWriteConfig) {
    this.writer = new StellarSorobanWriter(config);
  }

  async prepareDeposit(input: {
    from: string;
    amount: AmountInput;
  }): Promise<StellarPreparedWriteTransaction> {
    return this.writer.prepareWrite({
      method: 'deposit',
      args: [input.from, normalizeAmount(input.amount)],
    });
  }

  async prepareWithdraw(input: {
    to: string;
    amount: AmountInput;
  }): Promise<StellarPreparedWriteTransaction> {
    return this.writer.prepareWrite({
      method: 'withdraw',
      args: [input.to, normalizeAmount(input.amount)],
    });
  }

  async prepareClaimRewards(input: {
    address: string;
  }): Promise<StellarPreparedWriteTransaction> {
    return this.writer.prepareWrite({
      method: 'claim_rewards',
      args: [input.address],
    });
  }

  async submitSignedTransaction(
    signedXdr: string,
    options?: SubmitSignedTransactionOptions,
  ): Promise<TransactionActionResult> {
    return this.writer.submitSignedTransaction(signedXdr, options);
  }
}
