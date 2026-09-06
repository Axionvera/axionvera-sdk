import {
  WalletRejectedTransactionError,
  TimeoutError,
  TransactionFailedError,
  TransactionNotFoundError,
  RpcError
} from "../packages/core/src/errors";
import {
  classifyTransactionRecoveryInput,
  normalizeTransactionRecoveryInput,
  transactionErrorRecoveryFixtures
} from "../packages/core/src/fixtures/transactionErrorRecovery";

describe("transaction error recovery fixtures", () => {
  it("exposes the expected recovery scenarios", () => {
    expect(transactionErrorRecoveryFixtures).toHaveLength(5);
  });

  it("classifies wallet rejection, rpc failure, timeout, failed transaction, and not found states", () => {
    for (const fixture of transactionErrorRecoveryFixtures) {
      const normalized = normalizeTransactionRecoveryInput(fixture.input);
      const scenario = classifyTransactionRecoveryInput(fixture.input);

      expect(scenario).toBe(fixture.expectedScenario);
      expect(normalized.name).toBe(fixture.expectedErrorName);
      expect(fixture.recoveryHint.length).toBeGreaterThan(0);

      switch (fixture.expectedScenario) {
        case "wallet-rejection":
          expect(normalized).toBeInstanceOf(WalletRejectedTransactionError);
          break;
        case "rpc-failure":
          expect(normalized).toBeInstanceOf(RpcError);
          break;
        case "timeout":
          expect(normalized).toBeInstanceOf(TimeoutError);
          break;
        case "failed-transaction":
          expect(normalized).toBeInstanceOf(TransactionFailedError);
          break;
        case "not-found-transaction":
          expect(normalized).toBeInstanceOf(TransactionNotFoundError);
          break;
      }
    }
  });
});
