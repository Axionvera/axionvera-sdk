# Usage Guide

## 1) Install

```bash
npm i axionvera-sdk
```

## 2) Configure environment

Examples use:

- `STELLAR_NETWORK`: `testnet` or `mainnet`
- `STELLAR_RPC_URL`: optional override (defaults exist for testnet/mainnet)
- `AXIONVERA_VAULT_CONTRACT_ID`: vault contract ID (`C...`)
- `STELLAR_SECRET_KEY`: secret key for signing (Node.js example)
- `STELLAR_PUBLIC_KEY`: public key used for read-only calls

## 3) Connect to Soroban RPC

```ts
import { StellarClient } from "axionvera-sdk";

const client = new StellarClient({
  network: "testnet",
  rpcUrl: process.env.STELLAR_RPC_URL
});
```

## 4) Create a wallet connector

For server-side or scripts, use the built-in keypair wallet:

```ts
import { Keypair } from "@stellar/stellar-sdk";
import { LocalKeypairWalletConnector } from "axionvera-sdk";

const wallet = new LocalKeypairWalletConnector(
  Keypair.fromSecret(process.env.STELLAR_SECRET_KEY!)
);
```

For frontend apps, implement the interface:

```ts
import type { WalletConnector } from "axionvera-sdk";

export class MyWallet implements WalletConnector {
  async getPublicKey(): Promise<string> {
    return "G...";
  }

  async signTransaction(xdr: string, networkPassphrase: string): Promise<string> {
    return xdr;
  }
}
```

## 5) Interact with the Vault contract

```ts
import { StellarClient, VaultContract } from "axionvera-sdk";

const client = new StellarClient({ network: "testnet" });
const vault = new VaultContract({
  client,
  contractId: process.env.AXIONVERA_VAULT_CONTRACT_ID!,
  wallet
});

await vault.deposit({ amount: 1000n });
await vault.withdraw({ amount: 500n });
const balance = await vault.getBalance({ account: await wallet.getPublicKey() });
console.log({ balance });
```

## 6) Run examples

Install a TypeScript runner (one-time):

```bash
npm i -D ts-node
```

Deposit:

```bash
STELLAR_NETWORK=testnet \
AXIONVERA_VAULT_CONTRACT_ID=C... \
STELLAR_SECRET_KEY=S... \
AXIONVERA_DEPOSIT_AMOUNT=1000 \
npx ts-node examples/depositExample.ts
```

Withdraw:

```bash
STELLAR_NETWORK=testnet \
AXIONVERA_VAULT_CONTRACT_ID=C... \
STELLAR_SECRET_KEY=S... \
AXIONVERA_WITHDRAW_AMOUNT=500 \
npx ts-node examples/withdrawExample.ts
```

Balance:

```bash
STELLAR_NETWORK=testnet \
AXIONVERA_VAULT_CONTRACT_ID=C... \
STELLAR_PUBLIC_KEY=G... \
npx ts-node examples/balanceExample.ts
```

## TODO

- Add CLI examples that compile to plain JS under `dist/`
- Add higher-level typed bindings generated from contract specs
