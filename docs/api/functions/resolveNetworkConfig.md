[**Axionvera SDK v0.1.0**](../README.md)

***

[Axionvera SDK](../globals.md) / resolveNetworkConfig

# Function: resolveNetworkConfig()

> **resolveNetworkConfig**(`input?`): [`NetworkConfig`](../type-aliases/NetworkConfig.md)

Defined in: [utils/networkConfig.ts:54](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/utils/networkConfig.ts#L54)

Resolves network configuration from input options.
Fills in defaults for any missing values.

## Parameters

### input?

Optional network configuration overrides

#### network?

[`AxionveraNetwork`](../type-aliases/AxionveraNetwork.md)

#### networkPassphrase?

`string`

#### rpcUrl?

`string`

## Returns

[`NetworkConfig`](../type-aliases/NetworkConfig.md)

The resolved network configuration
