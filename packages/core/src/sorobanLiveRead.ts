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
import {
  normalizeCampaignId,
  type ActivationRule,
  type Campaign,
  type CampaignIdInput,
  type CampaignStatus,
} from './contracts/campaign';
import { normalizeCampaignContractError } from './contracts/campaignErrors';

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

function requireNativeRecord(
  value: unknown,
  context: string,
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContractError(`${context} returned an invalid value`);
  }

  return value as Record<string, unknown>;
}

function nativeBigInt(value: unknown, field: string): bigint {
  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return BigInt(value);
  }

  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    return BigInt(value);
  }

  throw new ContractError(`${field} must be an integer`);
}

function nativeString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new ContractError(`${field} must be a string`);
  }

  return value;
}

function nativeBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new ContractError(`${field} must be a boolean`);
  }

  return value;
}

function nativeCampaignStatus(value: unknown): CampaignStatus {
  if (value === 'Active' || value === 'Paused' || value === 'Closed') {
    return value;
  }

  // Some Soroban enum decoding paths may expose a single-case tuple.
  if (
    Array.isArray(value) &&
    value.length === 1 &&
    (value[0] === 'Active' ||
      value[0] === 'Paused' ||
      value[0] === 'Closed')
  ) {
    return value[0];
  }

  throw new ContractError('campaign.status returned an unsupported value');
}

export function campaignIdToScVal(
  campaignId: CampaignIdInput,
): xdr.ScVal {
  return nativeToScVal(normalizeCampaignId(campaignId), {
    type: 'u64',
  });
}

export function mapCampaign(value: unknown): Campaign {
  const campaign = requireNativeRecord(value, 'get_campaign');

  return {
    id: nativeBigInt(campaign.id, 'campaign.id'),
    admin: nativeString(campaign.admin, 'campaign.admin'),
    rewardToken: nativeString(
      campaign.reward_token,
      'campaign.reward_token',
    ),
    name: nativeString(campaign.name, 'campaign.name'),
    startTime: nativeBigInt(
      campaign.start_time,
      'campaign.start_time',
    ),
    endTime: nativeBigInt(
      campaign.end_time,
      'campaign.end_time',
    ),
    status: nativeCampaignStatus(campaign.status),
    fundedAmount: nativeBigInt(
      campaign.funded_amount,
      'campaign.funded_amount',
    ),
    allocatedAmount: nativeBigInt(
      campaign.allocated_amount,
      'campaign.allocated_amount',
    ),
    claimedAmount: nativeBigInt(
      campaign.claimed_amount,
      'campaign.claimed_amount',
    ),
    withdrawnAmount: nativeBigInt(
      campaign.withdrawn_amount,
      'campaign.withdrawn_amount',
    ),
    perAgentCap: nativeBigInt(
      campaign.per_agent_cap,
      'campaign.per_agent_cap',
    ),
  };
}

export function mapActivationRule(value: unknown): ActivationRule {
  const rule = requireNativeRecord(
    value,
    'get_activation_rule',
  );

  return {
    campaignId: nativeBigInt(
      rule.campaign_id,
      'activationRule.campaign_id',
    ),
    milestone: nativeString(
      rule.milestone,
      'activationRule.milestone',
    ),
    rewardAmount: nativeBigInt(
      rule.reward_amount,
      'activationRule.reward_amount',
    ),
    enabled: nativeBoolean(
      rule.enabled,
      'activationRule.enabled',
    ),
  };
}

export class StellarCampaignReader {
  private readonly reader: StellarSorobanReader;

  constructor(config: StellarSorobanReadConfig) {
    this.reader = new StellarSorobanReader(config);
  }

  private async read<TResponse>(
    request: Parameters<StellarSorobanReader['read']>[0],
  ): Promise<TResponse> {
    try {
      return (await this.reader.read(request)) as TResponse;
    } catch (error) {
      throw normalizeCampaignContractError(error);
    }
  }

  async getCampaign(
    campaignId: CampaignIdInput,
  ): Promise<Campaign> {
    return mapCampaign(
      await this.read({
        method: 'get_campaign',
        args: [campaignIdToScVal(campaignId)],
      }),
    );
  }

  async getActivationRule(
    campaignId: CampaignIdInput,
    milestone: string,
  ): Promise<ActivationRule> {
    return mapActivationRule(
      await this.read({
        method: 'get_activation_rule',
        args: [campaignIdToScVal(campaignId), milestone],
      }),
    );
  }

  async isVerifier(
    campaignId: CampaignIdInput,
    verifier: string,
  ): Promise<boolean> {
    return Boolean(
      await this.read({
        method: 'is_verifier',
        args: [campaignIdToScVal(campaignId), verifier],
      }),
    );
  }

  async claimableReward(
    campaignId: CampaignIdInput,
    agent: string,
  ): Promise<bigint> {
    return nativeBigInt(
      await this.read({
        method: 'claimable_reward',
        args: [campaignIdToScVal(campaignId), agent],
      }),
      'claimable_reward',
    );
  }

  async agentTotalEarned(
    campaignId: CampaignIdInput,
    agent: string,
  ): Promise<bigint> {
    return nativeBigInt(
      await this.read({
        method: 'agent_total_earned',
        args: [campaignIdToScVal(campaignId), agent],
      }),
      'agent_total_earned',
    );
  }

  async availableUnusedFunds(
    campaignId: CampaignIdInput,
  ): Promise<bigint> {
    return nativeBigInt(
      await this.read({
        method: 'available_unused_funds',
        args: [campaignIdToScVal(campaignId)],
      }),
      'available_unused_funds',
    );
  }

  async isInitialized(): Promise<boolean> {
    return Boolean(
      await this.read({
        method: 'is_initialized',
      }),
    );
  }

  async protocolAdmin(): Promise<string> {
    return nativeString(
      await this.read({
        method: 'protocol_admin',
      }),
      'protocol_admin',
    );
  }

  async nextCampaignId(): Promise<bigint> {
    return nativeBigInt(
      await this.read({
        method: 'next_campaign_id',
      }),
      'next_campaign_id',
    );
  }
}
