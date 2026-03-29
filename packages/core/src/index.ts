// Client
export { StellarClient } from './client/stellarClient';
export type { StellarClientOptions } from './client/stellarClient';

// Contracts
export { VaultContract } from './contracts/VaultContract';
export { Vault } from './contracts/Vault';
export { VaultABI } from './contracts/abis/VaultABI';
export type { VaultConfig, DepositParams, WithdrawParams, VaultInfo } from './contracts/Vault';

// Wallet
export { LocalKeypairWalletConnector } from './wallet/localKeypairWalletConnector';
export type { WalletConnector } from './wallet/walletConnector';

// Utils
export { ConcurrencyQueue, createConcurrencyControlledClient } from './utils/concurrencyQueue';
export { retry, createHttpClientWithRetry } from './utils/httpInterceptor';
export { buildContractCallOperation, buildContractCallTransaction, toScVal } from './utils/transactionBuilder';
export { getDefaultRpcUrl, getNetworkPassphrase, resolveNetworkConfig } from './utils/networkConfig';

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