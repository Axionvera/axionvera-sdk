[**Axionvera SDK v1.0.0**](../README.md)

***

[Axionvera SDK](../globals.md) / generateTransactionURI

# Function: generateTransactionURI()

> **generateTransactionURI**(`signedXdr`, `callbackUrl?`): `string`

Defined in: [src/utils/sep7.ts:16](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/utils/sep7.ts#L16)

Generates a SEP-0007 compliant URI for signing and submitting a transaction.

## Parameters

### signedXdr

`string`

The base64-encoded transaction XDR (can be signed or unsigned).

### callbackUrl?

`string`

Optional URL where the wallet should POST the signed transaction.

## Returns

`string`

The SEP-0007 transaction URI (web+stellar:tx?xdr=...).
