// Client
export { StellarClient, HYDRATION_STATE_VERSION } from './client/stellarClient';
export { AxionveraClient } from './client/axionveraClient';
export { FaucetClient } from './client/faucetClient';

export type {
  StellarClientOptions,
  GetContractEventsOptions,
  GetContractEventsResult,
  PendingTransaction,
  TrackedTransaction,
  SerializedPendingTransaction,
  ExportedState,
  TrackTransactionOptions,
  SimulationContext,
  SerializableValue,
} from './client/stellarClient';

export type { AxionveraClientConfig } from './client/axionveraClient';

// Logging
export { Logger } from './utils/logger';
export type { LogLevel, CustomLogger } from './utils/logger';

// Registry
export { ContractMetadataRegistry, contractMetadataRegistry } from './registry';

export type {
  ContractCapability,
  ContractDeploymentMetadata,
  ContractEnvironment,
  ContractFeature,
  ContractLookupOptions,
  ContractMetadata,
  ContractValidationResult,
} from './registry';

// Contracts
export { BaseContract } from './contracts/BaseContract';
export { VaultContract } from './contracts/VaultContract';
export { ContractEventEmitter } from './contracts/ContractEventEmitter';
export { VaultABI } from './contracts/abis/VaultABI';

export type {
  BaseContractConfig,
  ContractConfig,
  InvokeMethodOptions,
} from './contracts/BaseContract';

export type {
  DepositArgs,
  WithdrawArgs,
  ClaimArgs,
  ClaimRewardsParams,
  VaultConfig,
  VaultInfo,
  DepositParams,
  WithdrawParams,
} from './contracts/VaultContract';


export type { ContractEvent } from './contracts/ContractEventEmitter';

// Session
export { ContractSession } from './session/contractSession';
export { SessionManager } from './session/sessionManager';

export type {
  SessionStatus,
  ContractContext,
  RegisterContractParams,
  SessionConfig,
  SessionSnapshot,
  SessionManagerConfig,
} from './session/types';

// Wallet
export { LocalKeypairWalletConnector } from './wallet/localKeypairWalletConnector';
export { BrowserWalletConnector } from './wallet/browserWalletConnector';
export { LedgerWalletConnector } from './wallet/ledgerWalletConnector';
export { MockWalletConnector } from './wallet/mockWalletConnector';

export type { WalletConnector } from './wallet/walletConnector';

// Utils
export {
  ConcurrencyQueue,
  createConcurrencyControlledClient,
} from './utils/concurrencyQueue';

export { retry, createHttpClientWithRetry } from './utils/httpInterceptor';

export {
  buildContractCallOperation,
  buildContractCallTransaction,
  buildContractAuthPayload,
  bumpTransactionFee,
  toScVal,
} from './utils/transactionBuilder';

export type {
  BumpTransactionFeeOptions,
} from './utils/transactionBuilder';

export {
  getDefaultRpcUrl,
  getNetworkPassphrase,
  resolveNetworkConfig,
} from './utils/networkConfig';

export type {
  AxionveraNetwork,
  NetworkConfig,
} from './utils/networkConfig';

export { generateTransactionURI, generatePayURI } from './utils/sep7';

export {
  decodeXdrBase64,
  clearXdrCache,
  getXdrCacheSize,
} from './utils/xdrCache';

export { getRequiredSigners } from './utils/getRequiredSigners';

export {
  parseEvents,
  decodeSorobanSymbol,
} from './utils/soroban';

export type {
  ParsedEvent,
  ParseEventsOptions,
  DecodedTopic,
} from './utils/soroban';

export {
  addAuthEntry,
  buildSorobanAddressAuthEntry,
  buildSorobanSourceAccountAuthEntry,
} from './utils/sorobanAuth';

export type {
  SorobanAuthEntry,
  BuildAddressAuthEntryParams,
  BuildSourceAuthEntryParams,
} from './utils/sorobanAuth';

// Monitoring
export { RpcHealthMonitor } from './monitoring';

export type {
  EndpointHealthState,
  RpcEndpointConfig,
  RpcEndpointMetrics,
  RpcEndpointStatus,
  RpcHealthCheckClient,
  RpcHealthMonitorConfig,
  RpcHealthResponse,
  RpcHealthStatusReport,
} from './monitoring';

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
  InsecureNetworkError,
  TransactionTimeoutError,
  WalletNotInstalledError,
  FaucetRateLimitError,
  InvalidSignatureError,
  RPCValidationMismatchError,
  DeviceLockedError,
  UserRejectedError,
  ContractRevertError,
  toAxionveraError,
} from './errors/axionveraError';

export type { RPCValidationMismatchErrorOptions } from './errors/axionveraError';

export { ErrorCodes } from './errors/errorCodes';

export {
  classifyError,
  isRetryable,
  shouldRetry,
} from './errors/errorClassifier';

// Error Middleware
export { createErrorMiddleware } from './middleware/errorMiddleware';

// RPC schema types
export type {
  ValidatedGetHealthResponse,
  ValidatedGetTransactionResponse,
} from './utils/rpcSchemas';

// Transaction Signing
export {
  TransactionSigner,
  EnhancedTransactionBuilder,
  TransactionSimulator,
} from './transaction';

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
  ResourceOptimizationOptions,
} from './transaction';

// Testing & MSW
export * from './test/msw/setup';
export * from './test/msw/handlers';
export { server } from './test/msw/server';

// Codegen utilities
export { parseWasm } from './codegen/wasmParser';
export { generateContractClass } from './codegen/generator';

export type {
  ContractSpec,
  SpecFunction,
  SpecParam,
  SpecStruct,
  SpecEnum,
} from './codegen/wasmParser';