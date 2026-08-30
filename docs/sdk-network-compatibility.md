# SDK-to-Network Compatibility Fixtures

The SDK ships static compatibility fixtures for the Vault interface so changes
can be checked before live testnet integration is available.

These checks do not fetch GitHub, call Soroban RPC, or require a local Network
repository. They compare SDK expectations against
`schemas/network-vault-interface.fixture.json`.

## What Is Covered

- Vault method names expected by the SDK.
- Read/write method kind.
- Argument names, types, and order.
- Event names, topics, and data shape examples.

The SDK fixture is exported as `SDK_VAULT_INTERFACE_FIXTURE`. The Network
fixture mirrors the expected Network contract interface in a local JSON file.

## Updating Fixtures

When the Network Vault interface changes:

1. Update `schemas/network-vault-interface.fixture.json` with the new method or
   event shape.
2. Update `SDK_VAULT_INTERFACE_FIXTURE` in `packages/core/src/compatibility.ts`
   only when the SDK should expect and support that change.
3. Run the compatibility tests:

   ```bash
   npx vitest run packages/core/src/compatibility.test.ts
   ```

4. If the Network fixture changes method names or argument order, update
   `VaultContract` or the SDK fixture intentionally. Do not silence the failing
   compatibility assertion without deciding which side should change.
5. Refresh `examples/sdk-network-compatibility-output.json` when the expected
   report changes.

## Example Report

```text
Vault compatibility: compatible
Methods:
- getInfo -> get_info: ok
- getBalance -> get_balance: ok
- getPendingRewards -> get_pending_rewards: ok
- deposit -> deposit: ok
- withdraw -> withdraw: ok
- claimRewards -> claim_rewards: ok
Events:
- deposit: ok
- withdraw: ok
- claim_rewards: ok
- initialized: ok
```

The JSON example output lives in
`examples/sdk-network-compatibility-output.json`.
