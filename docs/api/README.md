**Axionvera SDK v0.1.0**

***

# Axionvera SDK

Axionvera SDK is a TypeScript developer toolkit that simplifies interaction with Axionvera smart contracts deployed on the Stellar blockchain using Soroban.

## Features

- Connect to Stellar networks (testnet/mainnet) via Soroban RPC
- Build and simulate Soroban contract call transactions
- Submit transactions and poll for completion
- Vault contract module (deposit, withdraw, get balance, claim rewards)
- Wallet signing integration via a small connector interface

## Installation

```bash
npm i axionvera-sdk
```

## Quick Start

```ts
import { Keypair } from "@stellar/stellar-sdk";
import {
  LocalKeypairWalletConnector,
  StellarClient,
  VaultContract
} from "axionvera-sdk";

const client = new StellarClient({ network: "testnet" });

const wallet = new LocalKeypairWalletConnector(
  Keypair.fromSecret(process.env.STELLAR_SECRET_KEY!)
);

const vault = new VaultContract({
  client,
  contractId: process.env.AXIONVERA_VAULT_CONTRACT_ID!,
  wallet
});

const depositResult = await vault.deposit({ amount: 1000n });
console.log(depositResult);
```

## Examples

- Deposit: [depositExample.ts](_media/depositExample.ts)
- Withdraw: [withdrawExample.ts](_media/withdrawExample.ts)
- Balance: [balanceExample.ts](_media/balanceExample.ts)

## Documentation

- Architecture: [sdk-overview.md](_media/sdk-overview.md)
- Usage guide: [usage-guide.md](_media/usage-guide.md)

## Contributing

See [CONTRIBUTING.md](_media/CONTRIBUTING.md).

## TODO

- Support additional contract modules (staking, governance, etc.)
- Improve wallet integrations (Freighter, WalletConnect-style flows)
- Optimize transaction building and simulation caching
- Add more examples (streaming events, contract data reads, batching)

## License

MIT. See [LICENSE](_media/LICENSE).
