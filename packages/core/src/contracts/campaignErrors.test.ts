import { describe, expect, it } from 'vitest';

import { ContractError } from '../errors';
import {
  CAMPAIGN_CONTRACT_ERRORS,
  CampaignContractError,
  extractCampaignContractErrorCode,
  normalizeCampaignContractError,
} from './campaignErrors';

describe('Campaign contract errors', () => {
  it('maps all 27 deployed Campaign error codes', () => {
    expect(CAMPAIGN_CONTRACT_ERRORS).toEqual({
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
    });
  });

  it('extracts a Soroban contract error code from canonical host errors', () => {
    expect(
      extractCampaignContractErrorCode(
        new Error(
          'HostError: Error(Contract, #17)',
        ),
      ),
    ).toBe(17);

    expect(
      extractCampaignContractErrorCode(
        new Error(
          'simulation failed: Error(Contract, #20)',
        ),
      ),
    ).toBe(20);
  });

  it('does not accept unknown Campaign error codes', () => {
    expect(
      extractCampaignContractErrorCode(
        new Error('Error(Contract, #28)'),
      ),
    ).toBeUndefined();

    expect(
      extractCampaignContractErrorCode(
        new Error('socket hang up'),
      ),
    ).toBeUndefined();
  });

  it('normalizes a known Campaign failure to CampaignContractError', () => {
    const cause = new Error(
      'HostError: Error(Contract, #15)',
    );

    const error = normalizeCampaignContractError(cause);

    expect(error).toBeInstanceOf(CampaignContractError);
    expect(error).toBeInstanceOf(ContractError);
    expect(error.code).toBe('CONTRACT_ERROR');
    expect(error.contractCode).toBe(15);
    expect(error.contractErrorName).toBe(
      'UnauthorizedVerifier',
    );
    expect(error.message).toBe(
      'Campaign contract error 15: UnauthorizedVerifier',
    );
    expect(error.cause).toBe(cause);
  });

  it('preserves an existing CampaignContractError', () => {
    const original = new CampaignContractError(20);

    expect(
      normalizeCampaignContractError(original),
    ).toBe(original);
  });

  it('preserves an existing generic ContractError when no Campaign code is present', () => {
    const original = new ContractError(
      'contract invocation failed',
    );

    expect(
      normalizeCampaignContractError(original),
    ).toBe(original);
  });

  it('wraps an unrecognized ordinary error as ContractError', () => {
    const cause = new Error('contract invocation trapped');
    const error = normalizeCampaignContractError(cause);

    expect(error).toBeInstanceOf(ContractError);
    expect(error).not.toBeInstanceOf(
      CampaignContractError,
    );
    expect(error.cause).toBe(cause);
  });
});

describe('Campaign error upgrade from generic ContractError', () => {
  it('upgrades a generic ContractError containing a known Campaign code', () => {
    const original = new ContractError(
      'invoke failed: HostError: Error(Contract, #17)',
    );

    const error = normalizeCampaignContractError(original);

    expect(error).toBeInstanceOf(CampaignContractError);
    expect(error.contractCode).toBe(17);
    expect(error.contractErrorName).toBe(
      'DuplicateActivation',
    );
    expect(error.cause).toBe(original);
  });
});
