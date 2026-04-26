/**
 * waitForTransaction() Examples
 * 
 * This example demonstrates using the `waitForTransaction()` method to wait for
 * transaction confirmation with a Promise-based API. This is a convenience wrapper
 * around `pollTransaction()` that provides a simpler interface for the common use
 * case of waiting for a transaction to reach a final state.
 * 
 * Key Features:
 * - Promise-based: Use async/await instead of manual polling
 * - Timeout handling: Automatically rejects if transaction doesn't confirm within timeoutMs
 * - Progress tracking: Optional callback to monitor polling progress
 * - Similar to EVM libraries: Matches viem's waitForTransactionReceipt and Ethers' waitForTransaction
 */

import { StellarClient } from "./src/client/stellarClient";
import { Keypair, TransactionBuilder, Networks } from "@stellar/stellar-sdk";

// Initialize the Stellar client
const client = new StellarClient({
  network: "testnet",
  logger: console
});

/**
 * Example 1: Basic Usage - Simple Wait with Defaults
 * 
 * The most common use case: build, sign, send, wait.
 * - Uses default timeout of 30 seconds
 * - Uses default polling interval of 1 second
 * - Resolves when transaction reaches any final state (SUCCESS or FAILED)
 */
async function example1_basicWait() {
  console.log("\n=== Example 1: Basic Wait with Defaults ===");

  try {
    const sourceKeypair = Keypair.random();
    const account = await client.getAccount(sourceKeypair.publicKey());

    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: Networks.TESTNET_PASSPHRASE
    })
      .addOperation(
        TransactionBuilder.payment({
          destination: Keypair.random().publicKey(),
          asset: TransactionBuilder.native(),
          amount: "10"
        })
      )
      .setTimeout(300)
      .build();

    const signedTx = await client.signWithKeypair(tx, sourceKeypair);
    const sendResult = await client.sendTransaction(signedTx);
    const hash = (sendResult as any).hash;

    // Simple wait - it's that easy!
    const result = await client.waitForTransaction(hash);
    console.log("Transaction confirmed:", result);
  } catch (error) {
    console.error("Error in basic wait:", error);
  }
}

/**
 * Example 2: Custom Timeout
 * 
 * When you need to wait longer than the default 30 seconds.
 * Useful for contracts that take time or during network congestion.
 */
async function example2_customTimeout() {
  console.log("\n=== Example 2: Custom Timeout ===");

  try {
    const sourceKeypair = Keypair.random();
    const account = await client.getAccount(sourceKeypair.publicKey());

    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: Networks.TESTNET_PASSPHRASE
    })
      .addOperation(
        TransactionBuilder.payment({
          destination: Keypair.random().publicKey(),
          asset: TransactionBuilder.native(),
          amount: "10"
        })
      )
      .setTimeout(300)
      .build();

    const signedTx = await client.signWithKeypair(tx, sourceKeypair);
    const sendResult = await client.sendTransaction(signedTx);
    const hash = (sendResult as any).hash;

    // Wait up to 60 seconds instead of default 30
    const result = await client.waitForTransaction(hash, {
      timeoutMs: 60_000  // 60 seconds
    });

    console.log("Transaction confirmed within 60 seconds:", result);
  } catch (error) {
    console.error("Error with custom timeout:", error);
  }
}

/**
 * Example 3: Faster Polling Interval
 * 
 * Poll more frequently for faster confirmation feedback.
 * Trade-off: More RPC requests but faster perceived confirmation.
 */
async function example3_fastPolling() {
  console.log("\n=== Example 3: Fast Polling ===");

  try {
    const sourceKeypair = Keypair.random();
    const account = await client.getAccount(sourceKeypair.publicKey());

    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: Networks.TESTNET_PASSPHRASE
    })
      .addOperation(
        TransactionBuilder.payment({
          destination: Keypair.random().publicKey(),
          asset: TransactionBuilder.native(),
          amount: "10"
        })
      )
      .setTimeout(300)
      .build();

    const signedTx = await client.signWithKeypair(tx, sourceKeypair);
    const sendResult = await client.sendTransaction(signedTx);
    const hash = (sendResult as any).hash;

    // Poll every 500ms instead of default 1 second
    const result = await client.waitForTransaction(hash, {
      intervalMs: 500  // Poll every 500ms
    });

    console.log("Transaction confirmed with fast polling:", result);
  } catch (error) {
    console.error("Error with fast polling:", error);
  }
}

/**
 * Example 4: Progress Tracking
 * 
 * Get real-time feedback on polling progress.
 * Useful for updating UI, logging, or implementing custom timeout logic.
 */
async function example4_progressTracking() {
  console.log("\n=== Example 4: Progress Tracking ===");

  try {
    const sourceKeypair = Keypair.random();
    const account = await client.getAccount(sourceKeypair.publicKey());

    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: Networks.TESTNET_PASSPHRASE
    })
      .addOperation(
        TransactionBuilder.payment({
          destination: Keypair.random().publicKey(),
          asset: TransactionBuilder.native(),
          amount: "10"
        })
      )
      .setTimeout(300)
      .build();

    const signedTx = await client.signWithKeypair(tx, sourceKeypair);
    const sendResult = await client.sendTransaction(signedTx);
    const hash = (sendResult as any).hash;

    const result = await client.waitForTransaction(hash, {
      onProgress: (status, ledger) => {
        console.log(`Poll: Status=${status}, Ledger=${ledger}`);
        // You could:
        // - Update UI with current status
        // - Log progress for debugging
        // - Track metrics
        // - Implement custom timeout logic
      }
    });

    console.log("Transaction confirmed, final result:", result);
  } catch (error) {
    console.error("Error with progress tracking:", error);
  }
}

/**
 * Example 5: Error Handling
 * 
 * Properly handle timeouts and other errors.
 * Different error types need different recovery strategies.
 */
async function example5_errorHandling() {
  console.log("\n=== Example 5: Error Handling ===");

  const sourceKeypair = Keypair.random();

  try {
    const account = await client.getAccount(sourceKeypair.publicKey());

    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: Networks.TESTNET_PASSPHRASE
    })
      .addOperation(
        TransactionBuilder.payment({
          destination: Keypair.random().publicKey(),
          asset: TransactionBuilder.native(),
          amount: "10"
        })
      )
      .setTimeout(300)
      .build();

    const signedTx = await client.signWithKeypair(tx, sourceKeypair);
    const sendResult = await client.sendTransaction(signedTx);
    const hash = (sendResult as any).hash;

    try {
      // Use a very short timeout to demonstrate error handling
      const result = await client.waitForTransaction(hash, {
        timeoutMs: 100  // Very short timeout for demo
      });
      console.log("Transaction confirmed:", result);
    } catch (waitError) {
      // Handle timeout
      if (waitError instanceof Error && waitError.message.includes("Timed out")) {
        console.log("Transaction confirmation timed out. Options:");
        console.log("1. Wait longer with extended timeout");
        console.log("2. Check transaction manually with getTransaction()");
        console.log("3. Assume it will eventually confirm");

        // Option 1: Try again with longer timeout
        console.log("\nRetrying with longer timeout...");
        const result = await client.waitForTransaction(hash, {
          timeoutMs: 60_000
        });
        console.log("Transaction eventually confirmed:", result);
      } else if ((waitError as any).status === "FAILED") {
        // Handle failed transaction
        console.log("Transaction failed:");
        console.log("Error details:", (waitError as any).resultXdr);
      } else {
        throw waitError;
      }
    }
  } catch (error) {
    console.error("Error in error handling example:", error);
  }
}

/**
 * Example 6: Migration from pollTransaction
 * 
 * Shows the difference between pollTransaction and waitForTransaction.
 * waitForTransaction is simpler for the common case.
 */
async function example6_migration() {
  console.log("\n=== Example 6: Migration from pollTransaction ===");

  const sourceKeypair = Keypair.random();

  try {
    const account = await client.getAccount(sourceKeypair.publicKey());

    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: Networks.TESTNET_PASSPHRASE
    })
      .addOperation(
        TransactionBuilder.payment({
          destination: Keypair.random().publicKey(),
          asset: TransactionBuilder.native(),
          amount: "10"
        })
      )
      .setTimeout(300)
      .build();

    const signedTx = await client.signWithKeypair(tx, sourceKeypair);
    const sendResult = await client.sendTransaction(signedTx);
    const hash = (sendResult as any).hash;

    console.log("OLD WAY: Using pollTransaction");
    // Old way: manual approach with pollTransaction
    try {
      const pollResult = await client.pollTransaction(hash, {
        timeoutMs: 30_000
      });
      console.log("Result from pollTransaction:", pollResult);
    } catch (error) {
      console.log("pollTransaction error:", error);
    }

    console.log("\nNEW WAY: Using waitForTransaction");
    // New way: cleaner syntax with waitForTransaction
    try {
      const waitResult = await client.waitForTransaction(hash, {
        timeoutMs: 30_000
      });
      console.log("Result from waitForTransaction:", waitResult);
    } catch (error) {
      console.log("waitForTransaction error:", error);
    }

    console.log("\nBoth methods return the same result!");
    console.log("waitForTransaction is a convenience wrapper around pollTransaction.");
  } catch (error) {
    console.error("Error in migration example:", error);
  }
}

/**
 * Example 7: Complex Scenario - Multi-step Transaction with Monitoring
 * 
 * Real-world scenario: deposit into a vault with progress monitoring.
 * Shows combining multiple features for production use.
 */
async function example7_complexScenario() {
  console.log("\n=== Example 7: Complex Scenario ===");

  try {
    const sourceKeypair = Keypair.random();
    let pollCount = 0;

    console.log(`Submitting complex transaction...`);
    const account = await client.getAccount(sourceKeypair.publicKey());

    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: Networks.TESTNET_PASSPHRASE
    })
      .addOperation(
        TransactionBuilder.payment({
          destination: Keypair.random().publicKey(),
          asset: TransactionBuilder.native(),
          amount: "10"
        })
      )
      .setTimeout(300)
      .build();

    const signedTx = await client.signWithKeypair(tx, sourceKeypair);
    const sendResult = await client.sendTransaction(signedTx);
    const hash = (sendResult as any).hash;

    console.log(`Transaction submitted: ${hash}`);
    console.log(`Waiting for confirmation with progress tracking...`);

    const startTime = Date.now();
    let lastLedger = 0;

    try {
      const result = await client.waitForTransaction(hash, {
        timeoutMs: 120_000,      // 2 minute timeout
        intervalMs: 2_000,       // Poll every 2 seconds
        onProgress: (status, ledger) => {
          pollCount++;
          if (ledger !== lastLedger) {
            console.log(
              `[Poll #${pollCount}] Status: ${status} | Ledger: ${ledger}`
            );
            lastLedger = ledger;
          }
        }
      });

      const elapsed = Date.now() - startTime;
      console.log(`\n✅ Transaction confirmed in ${elapsed}ms`);
      console.log(`Total polls: ${pollCount}`);
      console.log("Final result:", result);
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.log(`\n❌ Timed out after ${elapsed}ms and ${pollCount} polls`);
      throw error;
    }
  } catch (error) {
    console.error("Error in complex scenario:", error);
  }
}

/**
 * Example 8: Timeout Recovery Strategy
 * 
 * When waiting times out before confirmation, this shows how to recover.
 * Useful for critical operations where you need to know the outcome.
 */
async function example8_timeoutRecovery() {
  console.log("\n=== Example 8: Timeout Recovery ===");

  const sourceKeypair = Keypair.random();

  try {
    const account = await client.getAccount(sourceKeypair.publicKey());

    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: Networks.TESTNET_PASSPHRASE
    })
      .addOperation(
        TransactionBuilder.payment({
          destination: Keypair.random().publicKey(),
          asset: TransactionBuilder.native(),
          amount: "10"
        })
      )
      .setTimeout(300)
      .build();

    const signedTx = await client.signWithKeypair(tx, sourceKeypair);
    const sendResult = await client.sendTransaction(signedTx);
    const hash = (sendResult as any).hash;

    // Strategy: Attempt with increasing timeouts
    const timeouts = [10_000, 30_000, 60_000]; // 10s, 30s, 60s

    for (let i = 0; i < timeouts.length; i++) {
      try {
        console.log(
          `Attempt ${i + 1}: Waiting up to ${timeouts[i]}ms...`
        );
        const result = await client.waitForTransaction(hash, {
          timeoutMs: timeouts[i],
          intervalMs: 1_000
        });
        console.log("✅ Transaction confirmed!", result);
        break;
      } catch (error) {
        if (i < timeouts.length - 1) {
          console.log(`Attempt ${i + 1} timed out, retrying...`);
          // Continue to next attempt
        } else {
          console.log("❌ Transaction did not confirm after all attempts");
          // Could check manually or log for investigation
          const manualCheck = await client.getTransaction(hash);
          console.log("Manual check result:", manualCheck);
        }
      }
    }
  } catch (error) {
    console.error("Error in timeout recovery:", error);
  }
}

// Run examples (in practice, you'd call specific examples)
export const waitForTransactionExamples = {
  example1_basicWait,
  example2_customTimeout,
  example3_fastPolling,
  example4_progressTracking,
  example5_errorHandling,
  example6_migration,
  example7_complexScenario,
  example8_timeoutRecovery
};

/**
 * Main entry point - demonstrate basic usage
 */
async function main() {
  console.log("waitForTransaction() Examples");
  console.log("=============================\n");

  console.log("Available examples:");
  console.log("1. example1_basicWait - Simple wait with defaults");
  console.log("2. example2_customTimeout - Wait with custom timeout");
  console.log("3. example3_fastPolling - Fast polling interval");
  console.log("4. example4_progressTracking - Monitor polling progress");
  console.log("5. example5_errorHandling - Handle timeouts and errors");
  console.log("6. example6_migration - Compare with pollTransaction");
  console.log("7. example7_complexScenario - Real-world monitoring");
  console.log("8. example8_timeoutRecovery - Recovery strategies");

  console.log("\nNote: These are example functions. In a real scenario,");
  console.log("you would run them individually based on your needs.");
}

main().catch(console.error);
