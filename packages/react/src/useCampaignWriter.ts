import {
  useCallback,
  useMemo,
} from 'react';
import {
  requestWalletSignature,
  StellarCampaignWriter,
  type CampaignIdInput,
  type CreateCampaignInput,
  type StellarPreparedWriteTransaction,
  type StellarSorobanWriteConfig,
  type SubmitSignedTransactionOptions,
  type TransactionActionResult,
} from '@axionvera/core';

import { useAxionvera } from './provider';
import { useTransactionAction } from './useTransactionAction';

export interface UseCampaignWriterOptions {
  contractId: string;
  rpcUrl?: string;
  networkPassphrase?: string;
  server?: StellarSorobanWriteConfig['server'];
  timeoutSeconds?: number;
  submitOptions?: SubmitSignedTransactionOptions;
}

export interface FundCampaignInput {
  campaignId: CampaignIdInput;
  amount: CampaignIdInput;
}

export interface AddCampaignActivationRuleInput {
  campaignId: CampaignIdInput;
  milestone: string;
  rewardAmount: CampaignIdInput;
}

export interface CampaignVerifierInput {
  campaignId: CampaignIdInput;
  verifier: string;
}

export interface CampaignIdWriteInput {
  campaignId: CampaignIdInput;
}

export interface WithdrawUnusedFundsInput {
  campaignId: CampaignIdInput;
  amount: CampaignIdInput;
}

export interface VerifyAndAllocateCampaignRewardInput {
  campaignId: CampaignIdInput;
  verifier: string;
  agent: string;
  merchantRef: string;
  milestone: string;
}

export interface ClaimCampaignRewardInput {
  campaignId: CampaignIdInput;
  agent: string;
}

export interface InitializeCampaignInput {
  protocolAdmin: string;
}

export interface UseCampaignWriterResult {
  writer: StellarCampaignWriter | null;
  isSubmitting: boolean;
  error: Error | null;
  result: TransactionActionResult | null;

  initialize(
    input: InitializeCampaignInput,
  ): Promise<TransactionActionResult>;

  createCampaign(
    input: CreateCampaignInput,
  ): Promise<TransactionActionResult>;

  fundCampaign(
    input: FundCampaignInput,
  ): Promise<TransactionActionResult>;

  addActivationRule(
    input: AddCampaignActivationRuleInput,
  ): Promise<TransactionActionResult>;

  addVerifier(
    input: CampaignVerifierInput,
  ): Promise<TransactionActionResult>;

  removeVerifier(
    input: CampaignVerifierInput,
  ): Promise<TransactionActionResult>;

  pauseCampaign(
    input: CampaignIdWriteInput,
  ): Promise<TransactionActionResult>;

  resumeCampaign(
    input: CampaignIdWriteInput,
  ): Promise<TransactionActionResult>;

  closeCampaign(
    input: CampaignIdWriteInput,
  ): Promise<TransactionActionResult>;

  withdrawUnusedFunds(
    input: WithdrawUnusedFundsInput,
  ): Promise<TransactionActionResult>;

  verifyAndAllocateReward(
    input: VerifyAndAllocateCampaignRewardInput,
  ): Promise<TransactionActionResult>;

  claimReward(
    input: ClaimCampaignRewardInput,
  ): Promise<TransactionActionResult>;

  resetError(): void;
}

export function useCampaignWriter(
  options: UseCampaignWriterOptions,
): UseCampaignWriterResult {
  const context = useAxionvera();

  const {
    isSubmitting,
    error,
    result,
    run,
    reset,
  } = useTransactionAction<TransactionActionResult>();

  const writer = useMemo(() => {
    const sourcePublicKey =
      context.connection?.publicKey;

    if (!sourcePublicKey) {
      return null;
    }

    const config: StellarSorobanWriteConfig = {
      contractId: options.contractId,
      sourcePublicKey,
    };

    if (options.rpcUrl !== undefined) {
      config.rpcUrl = options.rpcUrl;
    }

    if (
      options.networkPassphrase !== undefined
    ) {
      config.networkPassphrase =
        options.networkPassphrase;
    }

    if (options.server !== undefined) {
      config.server = options.server;
    }

    if (options.timeoutSeconds !== undefined) {
      config.timeoutSeconds =
        options.timeoutSeconds;
    }

    return new StellarCampaignWriter(config);
  }, [
    context.connection?.publicKey,
    options.contractId,
    options.rpcUrl,
    options.networkPassphrase,
    options.server,
    options.timeoutSeconds,
  ]);

  const execute = useCallback(
    async (
      prepare: (
        campaignWriter: StellarCampaignWriter,
      ) => Promise<StellarPreparedWriteTransaction>,
    ): Promise<TransactionActionResult> =>
      run(async () => {
        if (
          !context.wallet ||
          !context.connection?.publicKey ||
          !writer
        ) {
          throw new Error(
            'Connect a wallet before using Campaign write actions',
          );
        }

        const prepared = await prepare(writer);

        const signed =
          await requestWalletSignature({
            wallet: context.wallet,
            request: prepared,
          });

        return writer.submitSignedTransaction(
          signed.signedXdr,
          options.submitOptions,
        );
      }),
    [
      context.wallet,
      context.connection?.publicKey,
      writer,
      options.submitOptions,
      run,
    ],
  );

  const initialize = useCallback(
    (input: InitializeCampaignInput) =>
      execute((campaignWriter) =>
        campaignWriter.prepareInitialize(input),
      ),
    [execute],
  );

  const createCampaign = useCallback(
    (input: CreateCampaignInput) =>
      execute((campaignWriter) =>
        campaignWriter.prepareCreateCampaign(
          input,
        ),
      ),
    [execute],
  );

  const fundCampaign = useCallback(
    (input: FundCampaignInput) =>
      execute((campaignWriter) =>
        campaignWriter.prepareFundCampaign(input),
      ),
    [execute],
  );

  const addActivationRule = useCallback(
    (input: AddCampaignActivationRuleInput) =>
      execute((campaignWriter) =>
        campaignWriter.prepareAddActivationRule(
          input,
        ),
      ),
    [execute],
  );

  const addVerifier = useCallback(
    (input: CampaignVerifierInput) =>
      execute((campaignWriter) =>
        campaignWriter.prepareAddVerifier(input),
      ),
    [execute],
  );

  const removeVerifier = useCallback(
    (input: CampaignVerifierInput) =>
      execute((campaignWriter) =>
        campaignWriter.prepareRemoveVerifier(
          input,
        ),
      ),
    [execute],
  );

  const pauseCampaign = useCallback(
    (input: CampaignIdWriteInput) =>
      execute((campaignWriter) =>
        campaignWriter.preparePauseCampaign(
          input,
        ),
      ),
    [execute],
  );

  const resumeCampaign = useCallback(
    (input: CampaignIdWriteInput) =>
      execute((campaignWriter) =>
        campaignWriter.prepareResumeCampaign(
          input,
        ),
      ),
    [execute],
  );

  const closeCampaign = useCallback(
    (input: CampaignIdWriteInput) =>
      execute((campaignWriter) =>
        campaignWriter.prepareCloseCampaign(
          input,
        ),
      ),
    [execute],
  );

  const withdrawUnusedFunds = useCallback(
    (input: WithdrawUnusedFundsInput) =>
      execute((campaignWriter) =>
        campaignWriter.prepareWithdrawUnusedFunds(
          input,
        ),
      ),
    [execute],
  );

  const verifyAndAllocateReward = useCallback(
    (
      input:
        VerifyAndAllocateCampaignRewardInput,
    ) =>
      execute((campaignWriter) =>
        campaignWriter
          .prepareVerifyAndAllocateReward(
            input,
          ),
      ),
    [execute],
  );

  const claimReward = useCallback(
    (input: ClaimCampaignRewardInput) =>
      execute((campaignWriter) =>
        campaignWriter.prepareClaimReward(input),
      ),
    [execute],
  );

  const resetError = useCallback(() => {
    reset();
  }, [reset]);

  return {
    writer,
    isSubmitting,
    error,
    result,
    initialize,
    createCampaign,
    fundCampaign,
    addActivationRule,
    addVerifier,
    removeVerifier,
    pauseCampaign,
    resumeCampaign,
    closeCampaign,
    withdrawUnusedFunds,
    verifyAndAllocateReward,
    claimReward,
    resetError,
  };
}
