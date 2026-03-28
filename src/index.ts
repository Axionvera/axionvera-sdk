export { StellarClient } from "./client/stellarClient";

export { VaultContract } from "./contracts/vault";

export type { WalletConnector } from "./wallet/walletConnector";
export { LocalKeypairWalletConnector } from "./wallet/walletConnector";

export type { AxionveraNetwork, NetworkConfig } from "./utils/networkConfig";
export { getDefaultRpcUrl, getNetworkPassphrase, resolveNetworkConfig } from "./utils/networkConfig";

export type { BuildContractCallParams, ContractCallArg } from "./utils/transactionBuilder";
export { buildContractCallOperation, buildContractCallTransaction, toScVal } from "./utils/transactionBuilder";

export type { RetryConfig } from "./utils/httpInterceptor";
export { createHttpClientWithRetry, retry } from "./utils/httpInterceptor";

export type { ConcurrencyConfig } from "./utils/concurrencyQueue";
export { ConcurrencyQueue, createConcurrencyControlledClient, DEFAULT_CONCURRENCY_CONFIG } from "./utils/concurrencyQueue";

export {
	AxionveraError,
	AuthenticationError,
	NetworkError,
	RateLimitError,
	ValidationError,
	toAxionveraError
} from "./errors/axionveraError";
