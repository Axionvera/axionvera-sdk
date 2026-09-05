# Axionvera SDK CLI

`axionvera-cli` is a command-line utility for interacting with Axionvera
contracts and Stellar/Soroban networks. It can query balances, execute contract
methods (read-only simulations or signed submissions), inspect network
configuration, and generate TypeScript contract clients from WASM.

The CLI talks to the network directly through `@stellar/stellar-sdk`, so it works
as a standalone tool without any additional setup beyond installing the package.

## Installation

The CLI ships with `@axionvera/core` and is exposed as the `axionvera-cli` binary.

```bash
# Global install
npm install -g @axionvera/core
axionvera-cli --help

# Or run on demand without installing
npx --package @axionvera/core axionvera-cli --help
```

When working inside this repository you can run it directly:

```bash
node packages/core/bin/axionvera-cli.js --help
```

## Network configuration

Every network-aware command (`network`, `balance`, `invoke`) resolves its target
the same way, with the following precedence:

1. Command-line flag
2. Environment variable
3. Built-in default (`testnet`)

| Setting    | Flag          | Environment variable           |
| ---------- | ------------- | ------------------------------ |
| Network    | `--network`   | `AXIONVERA_NETWORK`            |
| RPC URL    | `--rpc`       | `AXIONVERA_RPC_URL`            |
| Horizon    | `--horizon`   | `AXIONVERA_HORIZON_URL`        |
| Passphrase | `--passphrase`| `AXIONVERA_NETWORK_PASSPHRASE` |

Supported networks: `testnet` (default), `futurenet`, `mainnet`.

```bash
# Inspect the resolved configuration and check RPC health
axionvera-cli network
axionvera-cli network --network mainnet --no-ping
axionvera-cli network --json
```

## `balance` — query balances

Without `--contract`, the command loads an account's classic balances (native
XLM and trustlines) from Horizon. With `--contract`, it queries a Soroban token
contract's `balance` method for the account via a read-only simulation.

```bash
# Classic (XLM + trustline) balances
axionvera-cli balance GD5J...KUZ2V
axionvera-cli balance GD5J...KUZ2V --network mainnet --json

# Soroban token balance
axionvera-cli balance GD5J...KUZ2V --contract CBIE...TOKEN
```

| Option            | Description                                            |
| ----------------- | ------------------------------------------------------ |
| `<account>`       | Stellar account public key (`G...`), required          |
| `--contract <id>` | Query a Soroban token contract (`C...`) balance        |
| `--network, -n`   | `testnet` \| `futurenet` \| `mainnet`                  |
| `--rpc` / `--horizon` | Endpoint overrides                                 |
| `--json`          | Print machine-readable JSON                            |

## `invoke` — execute a contract method

Builds a contract call, simulates it, and either prints the decoded return value
(read-only) or — when `--source` is supplied — assembles, signs, submits, and
polls the transaction to completion.

```bash
# Read-only call (no key required)
axionvera-cli invoke CBIE...TOKEN balance --arg address:GD5J...KUZ2V

# Signed write
axionvera-cli invoke CBIE...TOKEN transfer \
  --arg address:GFROM... \
  --arg address:GTO... \
  --arg i128:1000 \
  --source SB... --network testnet
```

| Option            | Description                                                       |
| ----------------- | ----------------------------------------------------------------- |
| `<contractId>`    | Soroban contract id (`C...`), required                            |
| `<method>`        | Contract method name, required                                    |
| `--arg <value>`   | Method argument; repeatable, order preserved                      |
| `--source <secret>` | Sign and submit with this secret key (`S...`)                   |
| `--as <publicKey>`| Simulate as this account (read-only); defaults to a throwaway one |
| `--fee <stroops>` | Base fee in stroops (default: 100)                                |
| `--network, -n`   | `testnet` \| `futurenet` \| `mainnet`                             |
| `--rpc`           | RPC endpoint override                                             |
| `--yes, -y`       | Skip the mainnet write confirmation                               |
| `--json`          | Print machine-readable JSON                                       |

### Argument types

Arguments may carry an explicit `type:value` prefix, or let the CLI infer the
type. Inference rules: a valid Stellar address becomes an `Address`, a plain
integer becomes `i128`, `true`/`false` becomes `bool`, and anything else becomes
a `string`. Use an explicit prefix when the inference is wrong (for example a
`symbol`, a `u32`, or a numeric string that should be a `string`).

Supported prefixes:

```
address | account | contract   # G... or C... -> Address
bool                            # true / false
u32 | i32                       # 32-bit integers
u64 | i64 | u128 | i128 | u256 | i256   # big integers
symbol                          # Soroban symbol
string                          # UTF-8 string
bytes                           # hex-encoded byte string
```

Examples:

```bash
--arg i128:1000
--arg address:GD5J...KUZ2V
--arg symbol:transfer
--arg bool:true
--arg u32:7
--arg string:42        # the literal string "42", not a number
```

### Read vs. write

- **Read-only** (no `--source`): the call is simulated and the decoded return
  value is printed. No account funds or signing are required.
- **Write** (`--source <secret>`): the simulated transaction is assembled with
  the correct resource fees, signed, submitted, and polled. On `mainnet` the CLI
  refuses to submit unless `--yes` is also passed.

> Security note: passing a secret key on the command line can leak it into your
> shell history and process list. Prefer short-lived keys for testing, and never
> use a mainnet secret on an untrusted machine.

## `codegen` — generate a TypeScript contract client

Generates a typed client class from a compiled Soroban contract WASM.

```bash
axionvera-cli codegen ./target/wasm32-unknown-unknown/release/my_token.wasm \
  --out ./src/contracts \
  --name TokenContract
```

| Option            | Description                                          |
| ----------------- | ---------------------------------------------------- |
| `<contract.wasm>` | Path to the compiled contract WASM, required         |
| `--out, -o <dir>` | Output directory (default: current directory)        |
| `--name, -n <name>` | Class name (default: derived from the filename)    |
| `--import <path>` | Import path for `@axionvera/core`                    |

## Exit codes

- `0` — success
- `1` — usage error, validation failure, or a failed network/contract operation

## Examples cheat sheet

```bash
axionvera-cli network --network testnet
axionvera-cli balance GD5J...KUZ2V
axionvera-cli balance GD5J...KUZ2V --contract CBIE...TOKEN
axionvera-cli invoke CBIE...TOKEN balance --arg address:GD5J...KUZ2V
axionvera-cli invoke CBIE...TOKEN transfer --arg address:GA... --arg address:GB... --arg i128:1000 --source SB...
axionvera-cli codegen ./my_token.wasm --name TokenContract
```
