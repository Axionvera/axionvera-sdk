import { ContractError } from '../errors';

export const CAMPAIGN_CONTRACT_ERRORS = {
  1: 'AlreadyInitialized',
  2: 'NotInitialized',
  3: 'InvalidTimeRange',
  4: 'InvalidCap',
  5: 'CampaignNotFound',
  6: 'CampaignIdOverflow',
  7: 'InvalidAmount',
  8: 'CampaignNotActive',
  9: 'ArithmeticOverflow',
  10: 'InvalidRewardAmount',
  11: 'RuleAlreadyExists',
  12: 'RuleNotFound',
  13: 'VerifierAlreadyExists',
  14: 'VerifierNotFound',
  15: 'UnauthorizedVerifier',
  16: 'RuleDisabled',
  17: 'DuplicateActivation',
  18: 'InsufficientCampaignFunds',
  19: 'AgentCapExceeded',
  20: 'NothingToClaim',
  21: 'InvalidAccountingState',
  22: 'CampaignNotPaused',
  23: 'CampaignAlreadyClosed',
  24: 'CampaignNotClosed',
  25: 'InsufficientUnusedFunds',
  26: 'CampaignNotStarted',
  27: 'CampaignEnded',
} as const;

export type CampaignContractErrorCode =
  keyof typeof CAMPAIGN_CONTRACT_ERRORS;

export type CampaignContractErrorName =
  (typeof CAMPAIGN_CONTRACT_ERRORS)[CampaignContractErrorCode];

export class CampaignContractError extends ContractError {
  readonly contractCode: CampaignContractErrorCode;
  readonly contractErrorName: CampaignContractErrorName;

  constructor(
    contractCode: CampaignContractErrorCode,
    cause?: unknown,
  ) {
    const contractErrorName =
      CAMPAIGN_CONTRACT_ERRORS[contractCode];

    super(
      `Campaign contract error ${contractCode}: ${contractErrorName}`,
      cause,
    );

    this.name = 'CampaignContractError';
    this.contractCode = contractCode;
    this.contractErrorName = contractErrorName;
  }
}

function errorMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return undefined;
}

function isCampaignContractErrorCode(
  value: number,
): value is CampaignContractErrorCode {
  return Object.prototype.hasOwnProperty.call(
    CAMPAIGN_CONTRACT_ERRORS,
    value,
  );
}

export function extractCampaignContractErrorCode(
  error: unknown,
): CampaignContractErrorCode | undefined {
  const message = errorMessage(error);

  if (!message) {
    return undefined;
  }

  const match = message.match(
    /Error\s*\(\s*Contract\s*,\s*#(\d+)\s*\)/i,
  );

  if (!match?.[1]) {
    return undefined;
  }

  const code = Number(match[1]);

  if (
    !Number.isInteger(code) ||
    !isCampaignContractErrorCode(code)
  ) {
    return undefined;
  }

  return code;
}

export function normalizeCampaignContractError(
  error: unknown,
): ContractError {
  if (error instanceof CampaignContractError) {
    return error;
  }

  const contractCode =
    extractCampaignContractErrorCode(error);

  if (contractCode !== undefined) {
    return new CampaignContractError(
      contractCode,
      error,
    );
  }

  if (error instanceof ContractError) {
    return error;
  }

  return new ContractError(
    errorMessage(error) ?? 'Campaign contract operation failed',
    error,
  );
}
