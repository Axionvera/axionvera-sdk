[**Axionvera SDK v1.0.0**](../README.md)

***

[Axionvera SDK](../globals.md) / generateTransactionURI

# Function: generateTransactionURI()

> **generateTransactionURI**(`signedXdr`, `callbackUrl?`): `string`

Defined in: [src/utils/sep7.ts:16](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/utils/sep7.ts#L16)

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
