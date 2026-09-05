[**Axionvera SDK v1.0.0**](../README.md)

***

[Axionvera SDK](../globals.md) / generatePayURI

# Function: generatePayURI()

> **generatePayURI**(`destination`, `amount`, `assetCode?`, `assetIssuer?`): `string`

Defined in: [src/utils/sep7.ts:34](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/utils/sep7.ts#L34)

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
