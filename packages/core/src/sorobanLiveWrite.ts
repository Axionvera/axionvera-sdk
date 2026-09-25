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
import {
  normalizeCampaignId,
  type CampaignIdInput,
  type CreateCampaignInput,
} from './contracts/campaign';
import { normalizeCampaignContractError } from './contracts/campaignErrors';

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

const MAX_I128 = (1n << 127n) - 1n;

function normalizeCampaignI128(
  value: CampaignIdInput,
  name: string,
): bigint {
  let normalized: bigint;

  if (typeof value === 'bigint') {
    normalized = value;
  } else if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new ValidationError(
        `${name} number must be a safe integer; use bigint or string for larger values`,
      );
    }

    normalized = BigInt(value);
  } else {
    const trimmed = value.trim();

    if (!/^\d+$/.test(trimmed)) {
      throw new ValidationError(`${name} must be a positive integer`);
    }

    normalized = BigInt(trimmed);
  }

  if (normalized <= 0n) {
    throw new ValidationError(`${name} must be greater than zero`);
  }

  if (normalized > MAX_I128) {
    throw new ValidationError(`${name} exceeds the Soroban i128 range`);
  }

  return normalized;
}

function normalizeCampaignU64(
  value: CampaignIdInput,
  name: string,
): bigint {
  let normalized: bigint;

  if (typeof value === 'bigint') {
    normalized = value;
  } else if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new ValidationError(
        `${name} number must be a safe integer; use bigint or string for larger values`,
      );
    }

    normalized = BigInt(value);
  } else {
    const trimmed = value.trim();

    if (!/^\d+$/.test(trimmed)) {
      throw new ValidationError(`${name} must be a positive integer`);
    }

    normalized = BigInt(trimmed);
  }

  if (normalized <= 0n) {
    throw new ValidationError(`${name} must be greater than zero`);
  }

  const maxU64 = 18_446_744_073_709_551_615n;

  if (normalized > maxU64) {
    throw new ValidationError(`${name} exceeds the Soroban u64 range`);
  }

  return normalized;
}

export function campaignU64ToScVal(
  value: CampaignIdInput,
  name = 'value',
): xdr.ScVal {
  return nativeToScVal(
    normalizeCampaignU64(value, name),
    { type: 'u64' },
  );
}

export function campaignI128ToScVal(
  value: CampaignIdInput,
  name: string,
): xdr.ScVal {
  return nativeToScVal(
    normalizeCampaignI128(value, name),
    { type: 'i128' },
  );
}

export class StellarCampaignWriter {
  private readonly writer: StellarSorobanWriter;

  constructor(config: StellarSorobanWriteConfig) {
    this.writer = new StellarSorobanWriter(config);
  }

  private async prepareWrite(
    request: Parameters<StellarSorobanWriter['prepareWrite']>[0],
  ): Promise<StellarPreparedWriteTransaction> {
    try {
      return await this.writer.prepareWrite(request);
    } catch (error) {
      throw normalizeCampaignContractError(error);
    }
  }

  async prepareCreateCampaign(
    input: CreateCampaignInput,
  ): Promise<StellarPreparedWriteTransaction> {
    const startTime = normalizeCampaignU64(
      input.startTime,
      'startTime',
    );
    const endTime = normalizeCampaignU64(
      input.endTime,
      'endTime',
    );

    if (endTime <= startTime) {
      throw new ValidationError(
        'endTime must be greater than startTime',
      );
    }

    return this.prepareWrite({
      method: 'create_campaign',
      args: [
        toSorobanWriteScVal(input.admin),
        toSorobanWriteScVal(input.rewardToken),
        toSorobanWriteScVal(input.name),
        nativeToScVal(startTime, { type: 'u64' }),
        nativeToScVal(endTime, { type: 'u64' }),
        campaignI128ToScVal(
          input.perAgentCap,
          'perAgentCap',
        ),
      ],
    });
  }

  async prepareFundCampaign(input: {
    campaignId: CampaignIdInput;
    amount: CampaignIdInput;
  }): Promise<StellarPreparedWriteTransaction> {
    return this.prepareWrite({
      method: 'fund_campaign',
      args: [
        campaignU64ToScVal(
          normalizeCampaignId(input.campaignId),
          'campaignId',
        ),
        campaignI128ToScVal(
          input.amount,
          'amount',
        ),
      ],
    });
  }

  async prepareAddActivationRule(input: {
    campaignId: CampaignIdInput;
    milestone: string;
    rewardAmount: CampaignIdInput;
  }): Promise<StellarPreparedWriteTransaction> {
    if (input.milestone.trim().length === 0) {
      throw new ValidationError(
        'milestone must not be empty',
      );
    }

    return this.prepareWrite({
      method: 'add_activation_rule',
      args: [
        campaignU64ToScVal(
          normalizeCampaignId(input.campaignId),
          'campaignId',
        ),
        toSorobanWriteScVal(input.milestone),
        campaignI128ToScVal(
          input.rewardAmount,
          'rewardAmount',
        ),
      ],
    });
  }

  async prepareAddVerifier(input: {
    campaignId: CampaignIdInput;
    verifier: string;
  }): Promise<StellarPreparedWriteTransaction> {
    if (input.verifier.trim().length === 0) {
      throw new ValidationError(
        'verifier must not be empty',
      );
    }

    return this.prepareWrite({
      method: 'add_verifier',
      args: [
        campaignU64ToScVal(
          normalizeCampaignId(input.campaignId),
          'campaignId',
        ),
        toSorobanWriteScVal(input.verifier),
      ],
    });
  }

  async prepareRemoveVerifier(input: {
    campaignId: CampaignIdInput;
    verifier: string;
  }): Promise<StellarPreparedWriteTransaction> {
    if (input.verifier.trim().length === 0) {
      throw new ValidationError(
        'verifier must not be empty',
      );
    }

    return this.prepareWrite({
      method: 'remove_verifier',
      args: [
        campaignU64ToScVal(
          normalizeCampaignId(input.campaignId),
          'campaignId',
        ),
        toSorobanWriteScVal(input.verifier),
      ],
    });
  }

  async preparePauseCampaign(input: {
    campaignId: CampaignIdInput;
  }): Promise<StellarPreparedWriteTransaction> {
    return this.prepareWrite({
      method: 'pause_campaign',
      args: [
        campaignU64ToScVal(
          normalizeCampaignId(input.campaignId),
          'campaignId',
        ),
      ],
    });
  }

  async prepareResumeCampaign(input: {
    campaignId: CampaignIdInput;
  }): Promise<StellarPreparedWriteTransaction> {
    return this.prepareWrite({
      method: 'resume_campaign',
      args: [
        campaignU64ToScVal(
          normalizeCampaignId(input.campaignId),
          'campaignId',
        ),
      ],
    });
  }

  async prepareCloseCampaign(input: {
    campaignId: CampaignIdInput;
  }): Promise<StellarPreparedWriteTransaction> {
    return this.prepareWrite({
      method: 'close_campaign',
      args: [
        campaignU64ToScVal(
          normalizeCampaignId(input.campaignId),
          'campaignId',
        ),
      ],
    });
  }

  async prepareWithdrawUnusedFunds(input: {
    campaignId: CampaignIdInput;
    amount: CampaignIdInput;
  }): Promise<StellarPreparedWriteTransaction> {
    return this.prepareWrite({
      method: 'withdraw_unused_funds',
      args: [
        campaignU64ToScVal(
          normalizeCampaignId(input.campaignId),
          'campaignId',
        ),
        campaignI128ToScVal(
          input.amount,
          'amount',
        ),
      ],
    });
  }

  async prepareVerifyAndAllocateReward(input: {
    campaignId: CampaignIdInput;
    verifier: string;
    agent: string;
    merchantRef: string;
    milestone: string;
  }): Promise<StellarPreparedWriteTransaction> {
    if (input.verifier.trim().length === 0) {
      throw new ValidationError(
        'verifier must not be empty',
      );
    }

    if (input.agent.trim().length === 0) {
      throw new ValidationError(
        'agent must not be empty',
      );
    }

    if (input.merchantRef.trim().length === 0) {
      throw new ValidationError(
        'merchantRef must not be empty',
      );
    }

    if (input.milestone.trim().length === 0) {
      throw new ValidationError(
        'milestone must not be empty',
      );
    }

    return this.prepareWrite({
      method: 'verify_and_allocate_reward',
      args: [
        campaignU64ToScVal(
          normalizeCampaignId(input.campaignId),
          'campaignId',
        ),
        toSorobanWriteScVal(input.verifier),
        toSorobanWriteScVal(input.agent),
        toSorobanWriteScVal(input.merchantRef),
        toSorobanWriteScVal(input.milestone),
      ],
    });
  }

  async prepareClaimReward(input: {
    campaignId: CampaignIdInput;
    agent: string;
  }): Promise<StellarPreparedWriteTransaction> {
    if (input.agent.trim().length === 0) {
      throw new ValidationError(
        'agent must not be empty',
      );
    }

    return this.prepareWrite({
      method: 'claim_reward',
      args: [
        campaignU64ToScVal(
          normalizeCampaignId(input.campaignId),
          'campaignId',
        ),
        toSorobanWriteScVal(input.agent),
      ],
    });
  }

  async prepareInitialize(input: {
    protocolAdmin: string;
  }): Promise<StellarPreparedWriteTransaction> {
    if (input.protocolAdmin.trim().length === 0) {
      throw new ValidationError(
        'protocolAdmin must not be empty',
      );
    }

    return this.prepareWrite({
      method: 'initialize',
      args: [
        toSorobanWriteScVal(input.protocolAdmin),
      ],
    });
  }

  async submitSignedTransaction(
    signedXdr: string,
    options?: SubmitSignedTransactionOptions,
  ): Promise<TransactionActionResult> {
    return this.writer.submitSignedTransaction(
      signedXdr,
      options,
    );
  }
}
