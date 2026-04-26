import { Keypair, TransactionBuilder, Address, nativeToScVal } from "@stellar/stellar-sdk";
import { StellarClient, buildContractCallOperation } from "../src";

async function main(): Promise<void> {
  const secretKey = process.env.STELLAR_SECRET_KEY;
  if (!secretKey) throw new Error("STELLAR_SECRET_KEY is required");

  const network = (process.env.STELLAR_NETWORK as "testnet" | "mainnet" | undefined) ?? "testnet";
  const rpcUrl = process.env.STELLAR_RPC_URL;

  // Initialize client
  const client = new StellarClient({ network, rpcUrl });
  const keypair = Keypair.fromSecret(secretKey);
  const publicKey = keypair.publicKey();

  // Get the source account for building transactions
  const account = await client.getAccount(publicKey);

  // Example vault contract IDs (replace with real ones)
  const vault1 = process.env.VAULT_1_CONTRACT_ID ?? "CAV1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH";
  const vault2 = process.env.VAULT_2_CONTRACT_ID ?? "CAV2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH";
  const vault3 = process.env.VAULT_3_CONTRACT_ID ?? "CAV3AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH";

  // Deposit amounts
  const amount1 = BigInt(process.env.DEPOSIT_AMOUNT_1 ?? "1000");
  const amount2 = BigInt(process.env.DEPOSIT_AMOUNT_2 ?? "2000");
  const amount3 = BigInt(process.env.DEPOSIT_AMOUNT_3 ?? "1500");

  console.log("📋 Building batch deposit operations...");

  // Build three deposit operations
  const depositOp1 = buildContractCallOperation({
    contractId: vault1,
    method: "deposit",
    args: [
      nativeToScVal(amount1, { type: "i128" }),
      new Address(publicKey).toScVal()
    ]
  });

  const depositOp2 = buildContractCallOperation({
    contractId: vault2,
    method: "deposit",
    args: [
      nativeToScVal(amount2, { type: "i128" }),
      new Address(publicKey).toScVal()
    ]
  });

  const depositOp3 = buildContractCallOperation({
    contractId: vault3,
    method: "deposit",
    args: [
      nativeToScVal(amount3, { type: "i128" }),
      new Address(publicKey).toScVal()
    ]
  });

  console.log("✅ Operations built successfully");
  console.log(`   - Deposit ${amount1} into ${vault1}`);
  console.log(`   - Deposit ${amount2} into ${vault2}`);
  console.log(`   - Deposit ${amount3} into ${vault3}`);

  console.log("\n🔄 Simulating batch transactions...");

  // SINGLE network call to simulate all 3 operations!
  // This is MUCH more efficient than:
  //   await client.simulateTransaction(tx1);
  //   await client.simulateTransaction(tx2);
  //   await client.simulateTransaction(tx3);
  const batchResults = await client.simulateBatch({
    operations: [depositOp1, depositOp2, depositOp3],
    sourceAccount: account,
    fee: 100_000, // Fee per operation (total will be 300,000)
    timeoutInSeconds: 60
  });

  console.log("✅ Batch simulation completed successfully!");
  console.log(`\n📊 Results Summary:`);
  console.log(`   Total operations simulated: ${batchResults.length}`);

  // Process results
  batchResults.forEach((result, index) => {
    const vaultNum = index + 1;
    const amount = [amount1, amount2, amount3][index];
    console.log(`\n   Operation ${index + 1}: Deposit ${amount}`);
    console.log(`      Result XDR: ${result.xdr ? result.xdr.substring(0, 50) + "..." : "N/A"}`);
    console.log(`      Status: ${result.error ? "❌ Error" : "✅ Success"}`);
    if (result.error) {
      console.log(`      Error: ${result.error}`);
    }
  });

  console.log("\n💡 Next Steps:");
  console.log("   1. Display all simulation results to user for confirmation");
  console.log("   2. If all simulations succeeded, prepare the batch transaction");
  console.log("   3. Sign the transaction with the user's wallet");
  console.log("   4. Submit to network with sendTransaction()");
  console.log("   5. Poll for confirmation with pollTransaction()");

  // Example: You could now get the actual transaction and sign it
  console.log("\n📝 Example: Building and signing the actual transaction...");
  const builder = new TransactionBuilder(account, {
    fee: (100_000 * 3).toString(), // Total fee for 3 operations
    networkPassphrase: client.networkPassphrase
  });

  builder
    .addOperation(depositOp1)
    .addOperation(depositOp2)
    .addOperation(depositOp3)
    .setTimeout(60);

  const transaction = builder.build();

  // Sign the transaction
  transaction.sign(keypair);
  console.log("✅ Transaction signed");

  // Send the transaction (commented out to prevent actual submission)
  // const submissionResult = await client.sendTransaction(transaction);
  // console.log("✅ Transaction sent");
  // console.log(`   Hash: ${submissionResult.hash}`);
  // console.log(`   Status: ${submissionResult.status}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
