import { Address, Keypair, StrKey, xdr, rpc } from '@stellar/stellar-sdk';

import { getRequiredSigners } from '../../packages/core/src/utils/getRequiredSigners';

function makeAddressAuthEntry(publicKey: string): xdr.SorobanAuthorizationEntry {
  const credentials = xdr.SorobanCredentials.sorobanCredentialsAddress(
    new xdr.SorobanAddressCredentials({
      address: new Address(publicKey).toScAddress(),
      nonce: xdr.Int64.fromString('0'),
      signatureExpirationLedger: 0,
      signature: xdr.ScVal.scvVoid(),
    })
  );

  const rootInvocation = new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
      new xdr.InvokeContractArgs({
        contractAddress: new Address(StrKey.encodeContract(Buffer.alloc(32))).toScAddress(),
        functionName: 'noop',
        args: [],
      })
    ),
    subInvocations: [],
  });

  return new xdr.SorobanAuthorizationEntry({ credentials, rootInvocation });
}

function makeSourceAccountAuthEntry(): xdr.SorobanAuthorizationEntry {
  const rootInvocation = new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
      new xdr.InvokeContractArgs({
        contractAddress: new Address(StrKey.encodeContract(Buffer.alloc(32))).toScAddress(),
        functionName: 'noop',
        args: [],
      })
    ),
    subInvocations: [],
  });

  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
    rootInvocation,
  });
}

function buildSuccessResponse(
  parsedAuth?: xdr.SorobanAuthorizationEntry[],
  rawAuth?: string[]
): rpc.Api.SimulateTransactionSuccessResponse {
  return {
    result: parsedAuth ? { auth: parsedAuth, retval: xdr.ScVal.scvVoid() } : undefined,
    results: rawAuth ? [{ auth: rawAuth, xdr: '' }] : undefined,
  } as unknown as rpc.Api.SimulateTransactionSuccessResponse;
}

describe('getRequiredSigners', () => {
  test('returns [] for an empty auth payload', () => {
    const sim = buildSuccessResponse([]);
    expect(getRequiredSigners(sim)).toEqual([]);
  });

  test('returns [] when there is no auth field at all', () => {
    const sim = {} as rpc.Api.SimulateTransactionSuccessResponse;
    expect(getRequiredSigners(sim)).toEqual([]);
  });

  test('extracts a single G-address from a sorobanCredentialsAddress entry', () => {
    const publicKey = Keypair.random().publicKey();
    const entry = makeAddressAuthEntry(publicKey);

    expect(getRequiredSigners(buildSuccessResponse([entry]))).toEqual([publicKey]);
  });

  test('deduplicates repeated signers across multiple entries', () => {
    const sharedKey = Keypair.random().publicKey();
    const otherKey = Keypair.random().publicKey();

    const entries = [
      makeAddressAuthEntry(sharedKey),
      makeAddressAuthEntry(otherKey),
      makeAddressAuthEntry(sharedKey),
    ];

    const result = getRequiredSigners(buildSuccessResponse(entries));
    expect(result).toHaveLength(2);
    expect(new Set(result)).toEqual(new Set([sharedKey, otherKey]));
  });

  test('skips sorobanCredentialsSourceAccount entries', () => {
    const publicKey = Keypair.random().publicKey();
    const entries = [makeSourceAccountAuthEntry(), makeAddressAuthEntry(publicKey)];

    expect(getRequiredSigners(buildSuccessResponse(entries))).toEqual([publicKey]);
  });

  test('decodes raw base64-encoded auth entries from the results[] form', () => {
    const publicKey = Keypair.random().publicKey();
    const xdrBase64 = makeAddressAuthEntry(publicKey).toXDR('base64');

    const sim = buildSuccessResponse(undefined, [xdrBase64]);
    expect(getRequiredSigners(sim)).toEqual([publicKey]);
  });

  test('returns [] (does not throw) for malformed base64 entries', () => {
    const sim = buildSuccessResponse(undefined, ['this-is-not-valid-base64-xdr!!']);
    expect(getRequiredSigners(sim)).toEqual([]);
  });
});
