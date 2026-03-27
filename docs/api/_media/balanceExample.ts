import { StellarClient, VaultContract } from "../src";

async function main(): Promise<void> {
  const contractId = process.env.AXIONVERA_VAULT_CONTRACT_ID;
  const account = process.env.STELLAR_PUBLIC_KEY;

  if (!contractId) throw new Error("AXIONVERA_VAULT_CONTRACT_ID is required");
  if (!account) throw new Error("STELLAR_PUBLIC_KEY is required");

  const network = (process.env.STELLAR_NETWORK as "testnet" | "mainnet" | undefined) ?? "testnet";
  const rpcUrl = process.env.STELLAR_RPC_URL;

  const client = new StellarClient({ network, rpcUrl });
  const vault = new VaultContract({ client, contractId });

  const balance = await vault.getBalance({ account });
  console.log({ balance });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
