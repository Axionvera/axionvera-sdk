declare module '@stellar/freighter-api' {
  export function getPublicKey(): Promise<string>;
  export function signTransaction(
    transactionXdr: string,
    networkPassphrase: string
  ): Promise<string | { signedTransaction: string }>;
}
