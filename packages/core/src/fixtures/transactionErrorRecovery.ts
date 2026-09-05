import {
  AxionveraError,
  NetworkError,
  RpcError,
  TimeoutError,
  TransactionError,
  TransactionFailedError,
  TransactionNotFoundError,
  WalletRejectedTransactionError,
  normalizeRpcError,
  normalizeTransactionError
} from "../errors/axionveraError";

export type TransactionRecoveryScenario =
  | "wallet-rejection"
  | "rpc-failure"
  | "timeout"
  | "failed-transaction"
  | "not-found-transaction";

export type TransactionErrorRecoveryInput =
  | {
      readonly kind: "error";
      readonly source: "rpc" | "transaction";
      readonly error: unknown;
      readonly txHash?: string;
    }
  | {
      readonly kind: "status";
      readonly status: "FAILED" | "NOT_FOUND";
      readonly txHash: string;
      readonly ledger?: number;
    };

export type TransactionRecoveryFixture = {
  readonly name: string;
  readonly description: string;
  readonly input: TransactionErrorRecoveryInput;
  readonly expectedScenario: TransactionRecoveryScenario;
  readonly expectedErrorName: string;
  readonly recoveryHint: string;
};

export const transactionErrorRecoveryFixtures = [
  {
    name: "wallet-rejection",
    description: "Wallet signing was rejected before the transaction was submitted.",
    input: {
      kind: "error",
      source: "transaction",
      error: {
        code: 4001,
        message: "User rejected the transaction"
      }
    },
    expectedScenario: "wallet-rejection",
    expectedErrorName: "WalletRejectedTransactionError",
    recoveryHint: "Prompt the user to retry signing or choose a different wallet."
  },
  {
    name: "rpc-failure",
    description: "The RPC endpoint returned a hard failure while sending or polling a transaction.",
    input: {
      kind: "error",
      source: "rpc",
      error: {
        message: "RPC request failed",
        response: {
          status: 500,
          data: {
            error: "Internal server error"
          }
        }
      }
    },
    expectedScenario: "rpc-failure",
    expectedErrorName: "RpcError",
    recoveryHint: "Retry through your transport layer or switch to a healthier RPC endpoint."
  },
  {
    name: "timeout",
    description: "The RPC call or transaction poll timed out before a final state was reached.",
    input: {
      kind: "error",
      source: "transaction",
      error: {
        code: "ETIMEDOUT",
        message: "Request timed out"
      },
      txHash: "abcd1234"
    },
    expectedScenario: "timeout",
    expectedErrorName: "TimeoutError",
    recoveryHint: "Retry with a longer timeout or inspect network congestion before resubmitting."
  },
  {
    name: "failed-transaction",
    description: "The network returned a FAILED final transaction status.",
    input: {
      kind: "status",
      status: "FAILED",
      txHash: "tx-failed-123",
      ledger: 123456
    },
    expectedScenario: "failed-transaction",
    expectedErrorName: "TransactionFailedError",
    recoveryHint: "Inspect the contract or balance error, then rebuild the transaction before retrying."
  },
  {
    name: "not-found-transaction",
    description: "The transaction is not yet visible in RPC poll responses.",
    input: {
      kind: "status",
      status: "NOT_FOUND",
      txHash: "tx-missing-123",
      ledger: 123456
    },
    expectedScenario: "not-found-transaction",
    expectedErrorName: "TransactionNotFoundError",
    recoveryHint: "Keep polling briefly, then fall back to a timeout-aware retry path."
  }
] as const satisfies readonly TransactionRecoveryFixture[];

export function normalizeTransactionRecoveryInput(
  input: TransactionErrorRecoveryInput
): AxionveraError {
  if (input.kind === "status") {
    if (input.status === "FAILED") {
      return new TransactionFailedError(`Transaction failed (${input.txHash})`, {
        originalError: input
      });
    }

    return new TransactionNotFoundError(`Transaction not found (${input.txHash})`, {
      originalError: input
    });
  }

  if (input.source === "rpc") {
    return normalizeRpcError(input.error, "transaction RPC recovery");
  }

  return normalizeTransactionError(input.error, input.txHash);
}

export function classifyTransactionRecoveryInput(
  input: TransactionErrorRecoveryInput
): TransactionRecoveryScenario {
  const normalized = normalizeTransactionRecoveryInput(input);

  if (normalized instanceof WalletRejectedTransactionError) {
    return "wallet-rejection";
  }

  if (normalized instanceof TransactionFailedError) {
    return "failed-transaction";
  }

  if (normalized instanceof TransactionNotFoundError) {
    return "not-found-transaction";
  }

  if (normalized instanceof TimeoutError) {
    return "timeout";
  }

  if (normalized instanceof RpcError || normalized instanceof NetworkError) {
    return "rpc-failure";
  }

  if (normalized instanceof TransactionError) {
    return "failed-transaction";
  }

  return "rpc-failure";
}

