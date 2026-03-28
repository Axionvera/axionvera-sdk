# Axionvera SDK

[![npm version](https://img.shields.io/npm/v/axionvera-sdk.svg)](https://www.npmjs.com/package/axionvera-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](https://www.typescriptlang.org/)
[![Build Status](https://github.com/axionvera/axionvera-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/axionvera/axionvera-sdk/actions)

**Axionvera SDK** is a powerful, robust TypeScript developer toolkit designed to simplify interactions with Axionvera smart contracts deployed on the Stellar blockchain using Soroban. It provides a clean, strongly typed interface for dApp developers to connect, build, simulate, and submit transactions with ease.

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Usage Examples](#-usage-examples)
- [API Reference](#-api-reference)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)
- [Contact](#-contact)

---

## 🌟 Overview

Building on Stellar's Soroban smart contract platform requires managing RPC connections, building XDR transactions, simulating contract calls for resource limits, and handling cryptographic signatures. The Axionvera SDK abstracts these complexities away. Whether you're building a frontend dApp or a backend service, the SDK provides the tools you need to interact with the Axionvera ecosystem safely and efficiently.

## ✨ Features

- **Network Management**: Seamlessly connect to Stellar networks (Testnet/Mainnet) via Soroban RPC.
- **Transaction Lifecycle**: Build, simulate, prepare, and submit Soroban contract call transactions in a few lines of code.
- **Resilience**: Built-in HTTP interceptors with exponential backoff for robust RPC interactions, handling rate limits automatically.
- **Vault Contract Module**: Out-of-the-box support for the Axionvera Vault contract (`deposit`, `withdraw`, `balance`, `claimRewards`).
- **Wallet Integration**: Flexible `WalletConnector` interface, including a built-in `LocalKeypairWalletConnector` for server-side or automated signing.

---

## 📋 Prerequisites

Before using the Axionvera SDK, ensure you have the following installed:

- **Node.js**: v18.0.0 or higher is recommended.
- **Package Manager**: npm, yarn, or pnpm.
- **Stellar Account**: A funded Stellar account on your target network (Testnet or Mainnet) to pay for transaction fees.

---

## 📦 Installation

Install the package using your preferred package manager:

**Using npm:**
```bash
npm install axionvera-sdk
```

**Using yarn:**
```bash
yarn add axionvera-sdk
```

**Using pnpm:**
```bash
pnpm add axionvera-sdk
```

---

## 🚀 Quick Start

Here is a step-by-step guide to initializing the SDK, connecting a local wallet, and executing a transaction on the Vault contract.

```typescript
import { Keypair } from "@stellar/stellar-sdk";
import {
  LocalKeypairWalletConnector,
  StellarClient,
  VaultContract
} from "axionvera-sdk";

// 1. Initialize the Stellar Client for the Testnet
const client = new StellarClient({ network: "testnet" });

// 2. Set up the Wallet Connector with your secret key
const keypair = Keypair.fromSecret(process.env.STELLAR_SECRET_KEY!);
const wallet = new LocalKeypairWalletConnector(keypair);

// 3. Initialize the Vault Contract wrapper
const vault = new VaultContract({
  client,
  contractId: process.env.AXIONVERA_VAULT_CONTRACT_ID!,
  wallet
});

// 4. Execute a transaction
async function run() {
  try {
    console.log("Depositing 1000 units into the vault...");
    
    // The SDK automatically handles building, simulating, signing, and submitting the transaction
    const depositResult = await vault.deposit({ amount: 1000n });
    
    console.log("Transaction successful!");
    console.log("Result:", depositResult);
  } catch (error) {
    console.error("Transaction failed:", error);
  }
}

run();
```

---

## 💻 Usage Examples

We provide detailed, runnable examples in the [`examples/`](./examples/) directory to help you understand specific workflows:

- 💰 **Deposit**: [depositExample.ts](./examples/depositExample.ts)
- 🏦 **Withdraw**: [withdrawExample.ts](./examples/withdrawExample.ts)
- ⚖️ **Check Balance**: [balanceExample.ts](./examples/balanceExample.ts)
- 🔄 **HTTP Retry Logic**: [retryExample.ts](./examples/retryExample.ts)

---

## 📚 API Reference

For deep architectural details, see the [SDK Overview](./docs/sdk-overview.md) and [Usage Guide](./docs/usage-guide.md). Below is a summary of the core API classes:

### `StellarClient`
The core client wrapping the Soroban RPC connection.
- `getHealth()`: Check the health of the RPC node.
- `simulateTransaction(tx)`: Simulates a transaction to calculate fees and resource footprints.
- `prepareTransaction(tx)`: Attaches the simulation footprints and minimum fees to the transaction.
- `sendTransaction(tx)`: Submits a signed transaction to the network.
- `pollTransaction(hash, params)`: Polls the network until a transaction reaches a final state (`SUCCESS` or `FAILED`).

### `VaultContract`
A high-level abstraction for the Axionvera Vault smart contract.
- `deposit({ amount, from })`: Deposits tokens into the vault.
- `withdraw({ amount, from })`: Withdraws tokens from the vault.
- `getBalance({ account })`: Retrieves the vault balance for a specific account.
- `claimRewards({ from })`: Claims pending rewards for the caller.

### `WalletConnector` (Interface)
Implement this interface to integrate browser extension wallets (like Freighter) or use the provided `LocalKeypairWalletConnector` for backend/scripting services.
- `getPublicKey()`: Returns the public key of the connected wallet.
- `signTransaction(xdr, passphrase)`: Signs a prepared transaction XDR string and returns the signed XDR.

---

## 🛠 Troubleshooting

If you encounter issues while using the SDK, check the following common problems:

- **Error: `Simulation failed`**
  This usually means the contract call reverted during simulation. Ensure your account has sufficient XLM for fees, the contract ID is correct, you are passing the correct arguments, and the contract logic allows the operation.
- **Error: `Timed out waiting for transaction`**
  The transaction was submitted but not confirmed within the polling window. You may need to increase the `timeoutMs` parameter in `pollTransaction` or check if the network is heavily congested.
- **Rate Limiting (HTTP 429)**
  The SDK automatically retries on `429 Too Many Requests` using exponential backoff. If you consistently hit rate limits, consider configuring a private RPC provider URL instead of using the default public endpoints during `StellarClient` initialization.

---

## 🤝 Contributing

We welcome and appreciate contributions from the community! Whether it's reporting a bug, suggesting a feature, or submitting a pull request, your input helps make this project better.

Please read our [Contributing Guidelines](./CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

### Development Setup
To set up the project locally for development:
```bash
git clone https://github.com/axionvera/axionvera-sdk.git
cd axionvera-sdk
npm install
npm run build
npm test
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

## 📞 Contact

If you have any questions, feedback, or need support, feel free to reach out:

- **GitHub Issues**: For bug reports and feature requests, please use the [Issue Tracker](https://github.com/axionvera/axionvera-sdk/issues).
- **Website**: [https://axionvera.com](https://axionvera.com)
- **Twitter**: [@Axionvera](https://twitter.com/axionvera)

---
*Built with ❤️ by the Axionvera Team.*
