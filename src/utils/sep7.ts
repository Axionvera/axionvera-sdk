/**
 * Utility functions for generating Stellar SEP-0007 compliant URIs.
 * SEP-0007 defines a standard way to trigger Stellar wallets (especially mobile ones)
 * via deep-linking.
 * 
 * @see {@link https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0007.md}
 */

/**
 * Generates a SEP-0007 compliant URI for signing and submitting a transaction.
 * 
 * @param signedXdr - The base64-encoded transaction XDR (can be signed or unsigned).
 * @param callbackUrl - Optional URL where the wallet should POST the signed transaction.
 * @returns The SEP-0007 transaction URI (web+stellar:tx?xdr=...).
 */
export function generateTransactionURI(signedXdr: string, callbackUrl?: string): string {
  const params = new URLSearchParams();
  params.append("xdr", signedXdr);
  if (callbackUrl) {
    params.append("callback", `url:${callbackUrl}`);
  }
  return `web+stellar:tx?${params.toString()}`;
}

/**
 * Generates a SEP-0007 compliant URI for a simple payment.
 * 
 * @param destination - The destination public key or federated address.
 * @param amount - The amount to pay as a string (e.g., "100.5").
 * @param assetCode - Optional asset code (defaults to native XLM if omitted).
 * @param assetIssuer - Optional asset issuer (required if assetCode is not XLM).
 * @returns The SEP-0007 payment URI (web+stellar:pay?destination=...).
 */
export function generatePayURI(
  destination: string,
  amount: string,
  assetCode?: string,
  assetIssuer?: string
): string {
  const params = new URLSearchParams();
  params.append("destination", destination);
  params.append("amount", amount);
  
  if (assetCode && assetCode.toUpperCase() !== "XLM") {
    params.append("asset_code", assetCode);
    if (assetIssuer) {
      params.append("asset_issuer", assetIssuer);
    }
  }
  
  return `web+stellar:pay?${params.toString()}`;
}
