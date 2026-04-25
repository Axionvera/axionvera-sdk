[**Axionvera SDK v1.0.0**](../README.md)

***

[Axionvera SDK](../globals.md) / generatePayURI

# Function: generatePayURI()

> **generatePayURI**(`destination`, `amount`, `assetCode?`, `assetIssuer?`): `string`

Defined in: [src/utils/sep7.ts:34](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/utils/sep7.ts#L34)

Generates a SEP-0007 compliant URI for a simple payment.

## Parameters

### destination

`string`

The destination public key or federated address.

### amount

`string`

The amount to pay as a string (e.g., "100.5").

### assetCode?

`string`

Optional asset code (defaults to native XLM if omitted).

### assetIssuer?

`string`

Optional asset issuer (required if assetCode is not XLM).

## Returns

`string`

The SEP-0007 payment URI (web+stellar:pay?destination=...).
