import { useState, useCallback } from 'react';
import { TransactionTimeoutError } from '../../core/src/errors/axionveraError';

/** The four steps of a Soroban transaction lifecycle. */
export type TxStep = 'idle' | 'signed' | 'submitted' | 'confirmed';

export type UseVaultState = {
  step: TxStep;
  isLoading: boolean;
  error: Error | null;
  txHash: string | null;
};

export type UseVaultActions = {
  deposit: (amount: bigint) => Promise<void>;
  withdraw: (amount: bigint) => Promise<void>;
  reset: () => void;
};

/** Minimal interface required from StellarClient */
interface PollingClient {
  getTransaction(hash: string): Promise<unknown>;
}

/** Minimal interface required from VaultContract */
interface VaultContractLike {
  deposit(params: { amount: bigint }): Promise<unknown>;
  withdraw(params: { amount: bigint }): Promise<unknown>;
}

const POLL_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 2_000;

async function pollUntilConfirmed(
  client: PollingClient,
  hash: string,
  onStep: (step: TxStep) => void
): Promise<void> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const res = await client.getTransaction(hash) as any;
    const status: string = res?.status ?? 'NOT_FOUND';

    if (status === 'SUCCESS') {
      onStep('confirmed');
      return;
    }

    if (status === 'FAILED') {
      throw new Error(`Transaction ${hash} failed on-chain.`);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new TransactionTimeoutError(hash);
}

/**
 * Hook for interacting with the Axionvera Vault contract with full
 * transaction lifecycle tracking (signed → submitted → confirmed).
 *
 * @example
 * ```tsx
 * const { step, isLoading, error, deposit } = useVault({ client, vault });
 * await deposit(1000n);
 * ```
 */
export function useVault(deps: {
  client: PollingClient;
  vault: VaultContractLike;
  onSuccess?: (hash: string) => void;
}): UseVaultState & UseVaultActions {
  const { client, vault, onSuccess } = deps;

  const [step, setStep] = useState<TxStep>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const execute = useCallback(
    async (action: () => Promise<unknown>) => {
      setIsLoading(true);
      setError(null);
      setStep('idle');
      setTxHash(null);

      try {
        // Step 1: build + sign
        const result = await action() as any;
        setStep('signed');

        // Step 2: submit — extract hash from result
        const hash: string = result?.hash ?? result?.id ?? String(result);
        setTxHash(hash);
        setStep('submitted');

        // Step 3: poll until confirmed
        await pollUntilConfirmed(client, hash, setStep);

        onSuccess?.(hash);
      } catch (err) {
        setError(err as Error);
        setStep('idle');
      } finally {
        setIsLoading(false);
      }
    },
    [client, onSuccess]
  );

  const deposit = useCallback(
    (amount: bigint) => execute(() => vault.deposit({ amount })),
    [execute, vault]
  );

  const withdraw = useCallback(
    (amount: bigint) => execute(() => vault.withdraw({ amount })),
    [execute, vault]
  );

  const reset = useCallback(() => {
    setStep('idle');
    setIsLoading(false);
    setError(null);
    setTxHash(null);
  }, []);

  return { step, isLoading, error, txHash, deposit, withdraw, reset };
}
