// Client
export { StellarClient } from './client/stellarClient';
export { AxionveraClient } from './client/axionveraClient';
export { FaucetClient } from './client/faucetClient';
export type { StellarClientOptions } from './client/stellarClient';
export type { AxionveraClientConfig } from './client/axionveraClient';

// Contracts
export { VaultContract } from './contracts/VaultContract';
export { ContractEventEmitter } from './contracts/ContractEventEmitter';
export { Vault } from './contracts/Vault';
export { VaultABI } from './contracts/abis/VaultABI';
export type { VaultConfig, DepositParams, WithdrawParams, VaultInfo } from './contracts/Vault';
export type { ContractEvent, EventCallback } from './contracts/ContractEventEmitter';

// Wallet
export { LocalKeypairWalletConnector } from './wallet/localKeypairWalletConnector';
export type { WalletConnector } from './wallet/walletConnector';

// Utils
export { ConcurrencyQueue, createConcurrencyControlledClient } from './utils/concurrencyQueue';
export { retry, createHttpClientWithRetry } from './utils/httpInterceptor';
export { buildContractCallOperation, buildContractCallTransaction, buildContractAuthPayload, toScVal } from './utils/transactionBuilder';
export { getDefaultRpcUrl, getNetworkPassphrase, resolveNetworkConfig } from './utils/networkConfig';
export { generateTransactionURI, generatePayURI } from './utils/sep7';

// Errors
export { 
  AxionveraError, 
  NetworkError, 
  AuthenticationError, 
  RateLimitError, 
  ValidationError,
  StellarRpcNetworkError,
  StellarRpcResponseError,
  StellarRpcTimeoutError,
  FaucetRateLimitError,
  toAxionveraError
} from './errors/axionveraError';

// Transaction Signing
export { TransactionSigner, EnhancedTransactionBuilder, TransactionSimulator } from './transaction';
export type {
  TransactionSignerConfig,
  ContractCallParams,
  TransactionBuildParams,
  TransactionResult,
  SimulationResult,
  FeeBumpParams,
  MultiStepTransactionParams,
  BatchTransactionParams,
  BatchTransactionResult,
  DetailedSimulationResult,
  ResourceOptimizationOptions
} from './transaction';

// Testing & MSW
export * from './test/msw/setup';
export * from './test/msw/handlers';
export { server } from './test/msw/server';
