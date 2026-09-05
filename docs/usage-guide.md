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

## Transaction recovery

For typed recovery fixtures and mocked transaction states, use the [transaction error recovery guide](./transaction-error-recovery.md). It shows how to classify wallet rejection, RPC failure, timeout, failed transaction, and not-found states without making live RPC calls.

## 7) Prepare unsigned XDR and request wallet signing

Use the signing pipeline when transaction construction and wallet signing live
in different layers of your app:

```ts
import { MockWalletConnector, createTransactionSigningPipeline } from "axionvera-sdk";

const wallet = new MockWalletConnector("G...");

const pipeline = createTransactionSigningPipeline({
  wallet,
  async prepareUnsignedTransaction() {
    return {
      unsignedXdr: "AAAAAAAAAA==",
      networkPassphrase: "Test SDF Network ; September 2015"
    };
  }
});

const signed = await pipeline.prepareAndSign(undefined);
console.log(signed.signedXdr);
```

The SDK validates unsigned XDR before calling the wallet and only depends on the
provider-generic `WalletConnector` interface. Tests and examples can use
`MockWalletConnector`; no real wallet extension is required.

## 8) Recover a stuck transaction with a sponsor fee bump

Use `bumpTransactionFee` when the user already signed the original contract transaction, but the transaction is stuck in the mempool and a backend sponsor needs to raise the fee.

```ts
import { Networks } from "@stellar/stellar-sdk";
import { bumpTransactionFee } from "axionvera-sdk";

const feeBumpEnvelopeXdr = bumpTransactionFee(userSignedXdr, 500, {
  feeSource: sponsorPublicKey,
  networkPassphrase: Networks.TESTNET
});

const sponsorSignedXdr = await sponsorWallet.signTransaction(
  feeBumpEnvelopeXdr,
  Networks.TESTNET
);

await client.sendTransaction(sponsorSignedXdr);
```

Workflow:

1. The user signs the original inner transaction once.
2. Your backend wraps that signed XDR with `bumpTransactionFee(...)`.
3. The sponsor wallet signs only the outer fee bump envelope.
4. Submit the sponsor-signed fee bump XDR with `client.sendTransaction(...)`.

This keeps the original contract payload intact while letting enterprise apps react to volatile fee markets.

## 9) Access response metadata for diagnostics

When debugging issues or filing support tickets, you can opt into **response metadata**
that includes request IDs, timing information, and correlation identifiers. This is an
opt-in feature — the default API remains backwards-compatible and returns plain data.

### Per-call opt-in

Pass `includeMeta: true` to any service method:

```ts
import { StellarClient } from "axionvera-sdk";

const client = new StellarClient({ network: "testnet" });

// With metadata
const { data, meta } = await client.getHealth({ includeMeta: true });

console.log("Request ID:",    meta.clientRequestId);
console.log("Server req ID:", meta.requestId);
console.log("Duration:",      meta.durationMs, "ms");
console.log("Status:",        meta.statusCode);
console.log("Timestamp:",     meta.timestamp);
```

### Global default

Set `includeMeta: true` on the client constructor to enable metadata for all calls:

```ts
const client = new StellarClient({
  network: "testnet",
  includeMeta: true,
});

// All calls now return { data, meta }
const { data, meta } = await client.getHealth();
```

Per-call overrides take precedence:

```ts
// Disable metadata for a single call
const health = await client.getHealth({ includeMeta: false });
```

### Metadata shape

| Field | Type | Description |
|-------|------|-------------|
| `clientRequestId` | `string` | Always-present unique ID (e.g. `axv-lzabc-3kf2x`) |
| `requestId` | `string?` | Server-assigned ID from `X-Request-Id` header |
| `correlationId` | `string?` | Correlation ID from `X-Correlation-Id` header |
| `traceId` | `string?` | W3C trace context from `Traceparent` header |
| `durationMs` | `number` | Wall-clock duration of the request |
| `statusCode` | `number` | HTTP status code |
| `timestamp` | `string` | ISO-8601 timestamp of request initiation |
| `operation` | `string` | Logical operation name (e.g. `getHealth`) |
| `network` | `string?` | Stellar network (e.g. `testnet`) |

### Error paths

When `includeMeta: true` is set and a call fails, the `requestId` field on the
thrown `AxionveraError` is populated with the client-generated request ID. Use it
to correlate client-side failures with backend logs and support tickets:

```ts
try {
  await client.sendTransaction(tx, { includeMeta: true });
} catch (error) {
  if (error instanceof AxionveraError) {
    console.error("Request ID for support:", error.requestId);
  }
}
```

### Security

The metadata extractor **never** exposes sensitive headers such as
`Authorization`, `X-Api-Key`, `Cookie`, or `Set-Cookie`. Only safe correlation
and tracing headers are captured.

## 10) Check SDK-to-Network compatibility fixtures

Before wiring live testnet integration, compare the SDK Vault expectations with
the local Network Vault fixture:

```bash
npx vitest run packages/core/src/compatibility.test.ts
```

See `docs/sdk-network-compatibility.md` for the fixture update process.

## TODO

- Add CLI examples that compile to plain JS under `dist/`
- Add higher-level typed bindings generated from contract specs
