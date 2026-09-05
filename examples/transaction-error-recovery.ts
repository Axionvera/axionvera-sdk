import {
  WalletRejectedTransactionError,
  TimeoutError,
  TransactionFailedError,
  TransactionNotFoundError,
  RpcError
} from "../src/errors/axionveraError";
import {
  classifyTransactionRecoveryInput,
  normalizeTransactionRecoveryInput,
  transactionErrorRecoveryFixtures
} from "../src/fixtures/transactionErrorRecovery";

async function main() {
  for (const fixture of transactionErrorRecoveryFixtures) {
    const normalized = normalizeTransactionRecoveryInput(fixture.input);
    const scenario = classifyTransactionRecoveryInput(fixture.input);

    console.log(`[${fixture.name}] ${scenario}`);
    console.log(`  expected: ${fixture.expectedErrorName}`);
    console.log(`  actual: ${normalized.name}`);
    console.log(`  recovery: ${fixture.recoveryHint}`);

    if (normalized instanceof WalletRejectedTransactionError) {
      console.log("  action: ask the user to re-sign or switch wallets");
    } else if (normalized instanceof TimeoutError) {
      console.log("  action: retry with a longer timeout");
    } else if (normalized instanceof TransactionFailedError) {
      console.log("  action: inspect the transaction and rebuild it");
    } else if (normalized instanceof TransactionNotFoundError) {
      console.log("  action: keep polling briefly before surfacing a timeout");
    } else if (normalized instanceof RpcError) {
      console.log("  action: retry against a healthy RPC endpoint");
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Recovery example failed: ${message}`);
  process.exitCode = 1;
});
