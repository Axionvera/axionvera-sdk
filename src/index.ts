// Errors
export {
    AxionveraError,
    NetworkError,
    AuthenticationError,
    RateLimitError,
    ValidationError,
    TransactionError,
    RpcError,
    ContractError,
    TimeoutError,
    InsufficientFundsError,
    InvalidSignatureError,
    SimulationError,
    WalletNotInstalledError,
    FaucetRateLimitError,
    InsecureNetworkError,
    NetworkMismatchError,
    AxionveraRPCError,
    SimulationFailedError,
    WalletConnectionError,
    toAxionveraError,
    normalizeRpcError,
    normalizeTransactionError,
    normalizeContractError,
    normalizeSimulationError
} from './errors/axionveraError';

// Client
export { StellarClient } from './client/stellarClient';
export { FaucetClient } from './client/faucetClient';
export type { StellarClientOptions } from './client/stellarClient';

// Contracts
export { VaultContract } from './contracts/VaultContract';
export { Vault } from './contracts/Vault';
export { VaultABI } from './contracts/abis/VaultABI';
export type { VaultConfig, DepositParams, WithdrawParams, VaultInfo } from './contracts/Vault';

// Wallet
export { LocalKeypairWalletConnector } from './wallet/localKeypairWalletConnector';
export { BrowserWalletConnector } from './wallet/browserWalletConnector';
export type { WalletConnector } from './wallet/walletConnector';

// Utils
export { ConcurrencyQueue, createConcurrencyControlledClient } from './utils/concurrencyQueue';
export { retry, createHttpClientWithRetry } from './utils/httpInterceptor';
export { buildContractCallOperation, buildContractCallTransaction, buildBaseTransaction, toScVal } from './utils/transactionBuilder';
export type { BuildBaseTransactionParams } from './utils/transactionBuilder';
export { getDefaultRpcUrl, getNetworkPassphrase, resolveNetworkConfig } from './utils/networkConfig';
export { generateTransactionURI, generatePayURI } from './utils/sep7';

// Testing & MSW
export * from './test/msw/setup';
export * from './test/msw/handlers';
export { server } from './test/msw/server';