import { Keypair } from "@stellar/stellar-sdk";

import { LocalKeypairWalletConnector, StellarClient, VaultContract } from "../src";

async function main(): Promise<void> {
  const contractId = process.env.AXIONVERA_VAULT_CONTRACT_ID;
  const secretKey = process.env.STELLAR_SECRET_KEY;

  if (!contractId) throw new Error("AXIONVERA_VAULT_CONTRACT_ID is required");
  if (!secretKey) throw new Error("STELLAR_SECRET_KEY is required");

  const network = (process.env.STELLAR_NETWORK as "testnet" | "mainnet" | undefined) ?? "testnet";
  const rpcUrl = process.env.STELLAR_RPC_URL;

  const client = new StellarClient({ network, rpcUrl });
  const wallet = new LocalKeypairWalletConnector(Keypair.fromSecret(secretKey));
  const vault = new VaultContract({ client, contractId, wallet });

  const amount = BigInt(process.env.AXIONVERA_DEPOSIT_AMOUNT ?? "1000");
  const res = await vault.deposit({ amount });

  console.log(res);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
