import { rpc, xdr, StrKey } from "@stellar/stellar-sdk";

/**
 * Inspects the `auth` payload from a Soroban simulation response and extracts
 * the public keys of all accounts that must sign the transaction.
 *
 * Handles both the parsed form (`result.auth: xdr.SorobanAuthorizationEntry[]`)
 * and the raw form (`results[].auth: string[]` of base64-encoded XDR) that
 * `@stellar/stellar-sdk` may return depending on whether the simulation
 * response was parsed. Source-account credentials are skipped because the
 * transaction's source account is implicitly authorized. Contract addresses
 * are skipped because they are not signed by an external keypair.
 *
 * @param simulationResult - A successful simulation response from `StellarClient.simulateTransaction`
 * @returns A deduplicated array of Stellar G-addresses required to sign the transaction
 *
 * @example
 * ```typescript
 * const sim = await client.simulateTransaction(tx);
 * if (rpc.Api.isSimulationSuccess(sim)) {
 *   const signers = getRequiredSigners(sim);
 *   // signers: ['GABC...', 'GXYZ...']
 * }
 * ```
 */
export function getRequiredSigners(
  simulationResult: rpc.Api.SimulateTransactionSuccessResponse
): string[] {
  const signers = new Set<string>();
  for (const entry of collectAuthEntries(simulationResult)) {
    const publicKey = extractAccountSigner(entry);
    if (publicKey) {
      signers.add(publicKey);
    }
  }
  return Array.from(signers);
}

function collectAuthEntries(
  simulationResult: rpc.Api.SimulateTransactionSuccessResponse
): xdr.SorobanAuthorizationEntry[] {
  const entries: xdr.SorobanAuthorizationEntry[] = [];

  const parsedAuth = (simulationResult as { result?: { auth?: unknown[] } }).result?.auth;
  if (Array.isArray(parsedAuth)) {
    for (const item of parsedAuth) {
      const decoded = decodeAuthEntry(item);
      if (decoded) {
        entries.push(decoded);
      }
    }
  }

  const rawResults = (simulationResult as { results?: Array<{ auth?: unknown }> }).results;
  if (Array.isArray(rawResults)) {
    for (const result of rawResults) {
      if (Array.isArray(result?.auth)) {
        for (const item of result.auth) {
          const decoded = decodeAuthEntry(item);
          if (decoded) {
            entries.push(decoded);
          }
        }
      }
    }
  }

  return entries;
}

function decodeAuthEntry(item: unknown): xdr.SorobanAuthorizationEntry | null {
  if (item instanceof xdr.SorobanAuthorizationEntry) {
    return item;
  }
  if (typeof item === "string") {
    try {
      return xdr.SorobanAuthorizationEntry.fromXDR(item, "base64");
    } catch {
      return null;
    }
  }
  return null;
}

function extractAccountSigner(entry: xdr.SorobanAuthorizationEntry): string | null {
  try {
    const credentials = entry.credentials();
    if (
      credentials.switch() !== xdr.SorobanCredentialsType.sorobanCredentialsAddress()
    ) {
      return null;
    }
    const scAddress = credentials.address().address();
    if (scAddress.switch() !== xdr.ScAddressType.scAddressTypeAccount()) {
      return null;
    }
    return StrKey.encodeEd25519PublicKey(scAddress.accountId().ed25519());
  } catch {
    return null;
  }
}
