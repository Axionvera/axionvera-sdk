import { Address, xdr } from '@stellar/stellar-sdk';

/**
 * The raw XDR Soroban authorization entry type from @stellar/stellar-sdk.
 * Re-exported under a shorter alias so consumers never need to import xdr directly.
 */
export type SorobanAuthEntry = xdr.SorobanAuthorizationEntry;

// ─── Builder params ──────────────────────────────────────────────────────────

/** Parameters for constructing an address-based Soroban auth entry. */
export type BuildAddressAuthEntryParams = {
  /** The contract being authorized. */
  contractId: string;
  /** The Soroban method name to authorize. */
  methodName: string;
  /** Typed ScVal arguments that mirror the actual call arguments. */
  args: xdr.ScVal[];
  /** The Stellar address (G… or C…) of the signer granting authorization. */
  signerAddress: string;
  /**
   * Sequence nonce for replay protection.
   * The network increments this after each authorization; start at 0 for new auth.
   */
  nonce?: number;
  /**
   * Ledger sequence number after which this auth entry expires.
   * 0 means no expiry (valid indefinitely within the transaction).
   */
  signatureExpirationLedger?: number;
};

/** Parameters for constructing a source-account Soroban auth entry. */
export type BuildSourceAuthEntryParams = {
  /** The contract being authorized. */
  contractId: string;
  /** The Soroban method name to authorize. */
  methodName: string;
  /** Typed ScVal arguments that mirror the actual call arguments. */
  args: xdr.ScVal[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Constructs a `SorobanAuthorizationEntry` for a named signer address.
 *
 * Use this when a transaction requires authorization from a party other than
 * the transaction source account — e.g. an admin co-signer or a delegated
 * contract caller in a multisig setup.
 *
 * @example
 * ```ts
 * const adminAuth = buildSorobanAddressAuthEntry({
 *   contractId:  "C...",
 *   methodName:  "set_fee",
 *   args:        [nativeToScVal(50n, { type: "i128" })],
 *   signerAddress: "GADMIN...",
 * });
 * ```
 */
export function buildSorobanAddressAuthEntry(
  params: BuildAddressAuthEntryParams,
): SorobanAuthEntry {
  const {
    contractId,
    methodName,
    args,
    signerAddress,
    nonce = 0,
    signatureExpirationLedger = 0,
  } = params;

  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: Address.fromString(signerAddress).toScAddress(),
        nonce: new xdr.Int64(nonce),
        signatureExpirationLedger,
        signature: xdr.ScVal.scvVoid(),
      }),
    ),
    rootInvocation: buildInvocation(contractId, methodName, args),
  });
}

/**
 * Constructs a `SorobanAuthorizationEntry` that authorizes via the transaction
 * source account — no extra signing key is required.
 *
 * Use this when the source account itself needs to satisfy a `require_auth`
 * footprint in the Soroban contract.
 *
 * @example
 * ```ts
 * const sourceAuth = buildSorobanSourceAccountAuthEntry({
 *   contractId: "C...",
 *   methodName: "claim",
 *   args:       [],
 * });
 * ```
 */
export function buildSorobanSourceAccountAuthEntry(
  params: BuildSourceAuthEntryParams,
): SorobanAuthEntry {
  const { contractId, methodName, args } = params;

  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
    rootInvocation: buildInvocation(contractId, methodName, args),
  });
}

/**
 * Injects a `SorobanAuthorizationEntry` into every `InvokeHostFunction`
 * operation found inside a base64-encoded transaction envelope, and returns
 * the updated envelope as a base64 string.
 *
 * Call this after `rpc.assembleTransaction` (which populates standard auth)
 * but before signing, so custom entries from additional signers are included.
 *
 * Wrapped in a try/catch: if the envelope cannot be parsed the original XDR
 * is returned unchanged so the caller can still proceed or throw explicitly.
 *
 * @param envelopeXdr - Base64-encoded `TransactionEnvelope` XDR.
 * @param authEntry   - The entry to append to each InvokeHostFunction op's auth list.
 * @returns Updated base64 XDR string.
 */
export function addAuthEntry(envelopeXdr: string, authEntry: SorobanAuthEntry): string {
  try {
    const envelope = xdr.TransactionEnvelope.fromXDR(envelopeXdr, 'base64');

    for (const op of envelope.v1().tx().operations()) {
      if (op.body().switch().name === 'invokeHostFunction') {
        const ihf = op.body().invokeHostFunction();
        ihf.auth([...ihf.auth(), authEntry]);
      }
    }

    return envelope.toXDR('base64');
  } catch {
    // Return original so callers can decide whether to throw.
    return envelopeXdr;
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function buildInvocation(
  contractId: string,
  methodName: string,
  args: xdr.ScVal[],
): xdr.SorobanAuthorizedInvocation {
  return new xdr.SorobanAuthorizedInvocation({
    function:
      xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: Address.fromString(contractId).toScAddress(),
          functionName: Buffer.from(methodName),
          args,
        }),
      ),
    subInvocations: [],
  });
}
