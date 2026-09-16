import {
  Address,
  BASE_FEE,
  Contract,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import type { Account } from '@stellar/stellar-sdk';
import { ContractError, NetworkError, ValidationError } from './errors';

export type SorobanReadArg = string | number | boolean | xdr.ScVal;

export interface StellarSorobanReadServer {
  getAccount(publicKey: string): Promise<Account>;
  simulateTransaction(transaction: unknown): Promise<{
    error?: string;
    result?: {
      retval?: xdr.ScVal;
    };
  }>;
}

export interface StellarSorobanReadConfig {
  contractId: string;
  rpcUrl?: string;
  sourcePublicKey: string;
  networkPassphrase?: string;
  server?: StellarSorobanReadServer;
  timeoutSeconds?: number;
}

export interface SorobanReadRequest {
  method: string;
  args?: readonly SorobanReadArg[];
}

function requireNonEmptyString(value: string | undefined, name: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${name} must be a non-empty string`);
  }

  return value.trim();
}

export function toSorobanScVal(value: SorobanReadArg): xdr.ScVal {
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

  return nativeToScVal(value);
}

export function sorobanNativeToString(value: unknown): string {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return '';

  return JSON.stringify(value);
}

export class StellarSorobanReader {
  private readonly contractId: string;
  private readonly sourcePublicKey: string;
  private readonly networkPassphrase: string;
  private readonly timeoutSeconds: number;
  private readonly server: StellarSorobanReadServer;

  constructor(config: StellarSorobanReadConfig) {
    this.contractId = requireNonEmptyString(config.contractId, 'contractId');
    this.sourcePublicKey = requireNonEmptyString(config.sourcePublicKey, 'sourcePublicKey');
    this.networkPassphrase = config.networkPassphrase ?? Networks.TESTNET;
    this.timeoutSeconds = config.timeoutSeconds ?? 30;

    const rpcUrl = config.rpcUrl ?? 'https://soroban-testnet.stellar.org';
    this.server = config.server ?? new rpc.Server(rpcUrl);
  }

  async read(request: SorobanReadRequest): Promise<unknown> {
    const method = requireNonEmptyString(request.method, 'method');
    const args = request.args ?? [];

    try {
      const sourceAccount = await this.server.getAccount(this.sourcePublicKey);
      const contract = new Contract(this.contractId);
      const scArgs = args.map(toSorobanScVal);

      const transaction = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(contract.call(method, ...scArgs))
        .setTimeout(this.timeoutSeconds)
        .build();

      const simulation = await this.server.simulateTransaction(transaction);

      if (simulation.error) {
        throw new ContractError(`Soroban read failed: ${simulation.error}`);
      }

      const retval = simulation.result?.retval;

      if (!retval) {
        return null;
      }

      return scValToNative(retval);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ContractError) {
        throw error;
      }

      throw new NetworkError(
        error instanceof Error ? error.message : 'Soroban read failed',
        error,
      );
    }
  }
}

export class StellarVaultReader {
  private readonly reader: StellarSorobanReader;

  constructor(config: StellarSorobanReadConfig) {
    this.reader = new StellarSorobanReader(config);
  }

  async totalDeposits(): Promise<string> {
    return sorobanNativeToString(
      await this.reader.read({
        method: 'total_deposits',
      }),
    );
  }

  async userBalance(user: string): Promise<string> {
    return sorobanNativeToString(
      await this.reader.read({
        method: 'user_balance',
        args: [user],
      }),
    );
  }

  async pendingRewards(user: string): Promise<string> {
    return sorobanNativeToString(
      await this.reader.read({
        method: 'pending_rewards',
        args: [user],
      }),
    );
  }

  async claimableRewards(user: string): Promise<string> {
    return sorobanNativeToString(
      await this.reader.read({
        method: 'claimable_rewards',
        args: [user],
      }),
    );
  }
}
