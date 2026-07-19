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
  TransactionTimeoutError,
  InsufficientFundsError,
  InvalidSignatureError,
  InvalidXDRError,
  SimulationError,
  WalletNotInstalledError,
  FaucetRateLimitError,
  InsecureNetworkError,
  NetworkMismatchError,
  AxionveraRPCError,
  SimulationFailedError,
  SlippageToleranceExceededError,
  WalletConnectionError,
  BatchError,
  BatchValidationError,
  BatchExecutionError,
  toAxionveraError,
  normalizeRpcError,
  normalizeTransactionError,
  normalizeContractError,
  normalizeSimulationError,
} from './errors/axionveraError';

// Metrics, Telemetry & Observability
export { MetricsCollector, metricsCollector } from './metrics';
export { TelemetryService, telemetryService, TelemetryFlushHandler } from './telemetry';
export { ObservabilityService, observabilityService } from './observability';
export {
  ProfilingService,
  profilingService,
  ProfileOptions,
  ProfiledCallMetric,
  ProfilingConfig,
  ProfilingLevel,
  ProfilingReport,
} from './profiling';
export {
  TelemetryConfig,
  DEFAULT_TELEMETRY_CONFIG,
  TelemetryEvent,
  MetricCounter,
  MetricGauge,
  MetricHistogram,
  MetricsSnapshot,
} from './telemetry/types';
export {
  ObservabilityConfig,
  DEFAULT_OBSERVABILITY_CONFIG,
  DiagnosticsReport,
  TraceSpan,
} from './observability/types';
export { DiagnosticsManager } from './diagnostics';

// Retry engine (transport-agnostic, pluggable policies + backoff + classification)
export * from './retry';

// Plugin System
export {
  PluginManager,
  getPluginManager,
  setPluginManager,
  PluginRegistry,
  InvalidPluginTransitionError,
  transitionState,
  isValidTransition,
  validatePlugin,
  validateDependencies,
  detectCircularDependencies,
  topologicalSort,
  parseSemVer,
  compareSemVer,
  satisfiesMinVersion,
  PluginLifecycleState,
} from './plugin';
export type {
  SemVer,
  PluginCompatibility,
  PluginDependency,
  PluginValidationResult,
  PluginManifest,
  PluginConfig,
  PluginInstance,
  PluginManagerConfig,
  PluginRegistryEntry,
  PluginFactory,
  PluginHooks,
} from './plugin';

// Feature Flags
export { FeatureFlagsService, BUILT_IN_FEATURE_FLAGS } from './features';
export {
  evaluateFeature,
  createEvaluationContext,
  isProductionSafe,
  getStabilityLabel,
  getDeprecationWarning,
  filterByStability,
} from './features';
export {
  PRODUCTION_POLICY,
  STAGING_POLICY,
  DEVELOPMENT_POLICY,
  PERMISSIVE_POLICY,
  resolvePolicyFromEnvironment,
  mergePolicies,
} from './features';
export { FeatureStability } from './features';
export type {
  FeatureFlagDefinition,
  FeatureFlagState,
  FeaturePolicy,
  FeatureFlagsConfig,
  FeatureEvaluationContext,
  FeatureFlagsSummary,
} from './features';
export {
  DEFAULT_FEATURE_POLICY,
  PERMISSIVE_FEATURE_POLICY,
  DEFAULT_FEATURE_FLAGS_CONFIG,
} from './features';

// Dependency Injection
export {
  ServiceContainer,
  createServiceContainer,
  defaultRpcClientFactory,
  defaultHttpClientFactory,
  defaultLoggerFactory,
  defaultWebSocketManagerFactory,
} from './core/serviceContainer';
export type {
  CoreServices,
  ServiceOverrides,
  RpcClientFactory,
  HttpClientFactory,
  LoggerFactory,
  WebSocketManagerFactory,
  RpcClientFactoryOptions,
  HttpClientFactoryOptions,
  WebSocketManagerFactoryOptions,
  RpcServer,
  HttpClient,
  LoggerService,
  WebSocketManagerService,
} from './core/serviceInterfaces';

// Client
export { StellarClient, HYDRATION_STATE_VERSION } from './client/stellarClient';
export { FaucetClient } from './client/faucetClient';
export type {
  StellarClientOptions,
  GetContractEventsOptions,
  GetContractEventsResult,
  ContractEventResult,
} from './client/stellarClient';
export type { StellarClientOptions } from './client/stellarClient';
export type { LogLevel, CustomLogger } from './utils/logger';
export { MiddlewarePipeline } from './middleware';
export type {
  Middleware,
  MiddlewareContext,
  MiddlewareRegistration,
  MiddlewareWorkflow,
  MiddlewareStage,
  MiddlewarePipelineOptions,
} from './middleware';
export type {
  StellarClientOptions,
  PendingTransaction,
  TrackedTransaction,
  SerializedPendingTransaction,
  ExportedState,
  TrackTransactionOptions,
  SimulationContext,
  SerializableValue,
} from './client/stellarClient';

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
// export { VaultContract } from './contracts/VaultContract';
export { Vault } from './contracts/vault';
export { VaultABI } from './contracts/abis/VaultABI';
export type { VaultConfig, DepositParams, WithdrawParams, VaultInfo } from './contracts/vault';

// Discovery
export {
  DefaultContractDiscoveryService,
  contractDiscovery,
  DefaultContractDescriptors,
  VaultContractDescriptor,
} from './discovery';
export { CapabilityRegistry } from './registry';
export type {
  ContractCapability,
  ContractDescriptor,
  ContractDiscoveryService,
  ContractMethodDescriptor,
  DiscoveryValidationResult,
} from './discovery';

// Reflection
export { ContractReflectionService, contractReflection } from './reflection';
export type {
  ContractReflection,
  ReflectedEvent,
  ReflectedMethod,
  ReflectedParameter,
  ReflectedStateMutability,
  ReflectOptions,
} from './reflection';

// Capability detection
export { CapabilityDetector, capabilityDetector } from './capabilities';
export type { CapabilityDetectionResult, DetectedMethod, DetectOptions } from './capabilities';

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
export { LocalKeypairWalletConnector } from './wallet/walletConnector';
export { LocalKeypairWalletConnector, MockWalletConnector } from './wallet/walletConnector';
export { BrowserWalletConnector } from './wallet/browserWalletConnector';
export { MockWalletConnector } from './wallet/mockWalletConnector';
export type { WalletConnector } from './wallet/walletConnector';

// Utils
export { ConcurrencyQueue, createConcurrencyControlledClient } from './utils/concurrencyQueue';
export { retry, createHttpClientWithRetry } from './utils/httpInterceptor';
export {
  buildContractCallOperation,
  buildContractCallTransaction,
  buildBaseTransaction,
  toScVal,
  ContractCallBuilder,
} from './utils/transactionBuilder';
export type {
  BuildBaseTransactionParams,
  BuildContractCallParams,
  ContractCallArg,
} from './utils/transactionBuilder';
export {
  buildContractCallOperation,
  buildContractCallTransaction,
  buildBaseTransaction,
  bumpTransactionFee,
  toScVal,
} from './utils/transactionBuilder';
export type {
  BuildBaseTransactionParams,
  BumpTransactionFeeOptions,
} from './utils/transactionBuilder';
export {
  getDefaultRpcUrl,
  getNetworkPassphrase,
  resolveNetworkConfig,
  LOCAL_NETWORK_PASSPHRASE,
} from './utils/networkConfig';
export type { AxionveraNetwork, NetworkConfig } from './utils/networkConfig';

// Network
export { ReconnectionManager } from './network/reconnectionManager';
export { RpcEndpointManager } from './network/rpcEndpointManager';
export { EnvironmentManager } from './network/environmentManager';
export {
  ENVIRONMENT_PRESETS,
  buildEnvironmentConfig,
  getPresetEnvironments,
  getPresetEnvironment,
} from './network/environmentPresets';
export type {
  LoadBalancingPolicy,
  EndpointEntry,
  RpcEndpointManagerConfig,
} from './network/rpcEndpointManager';

// Environment types
export type {
  EnvironmentId,
  EnvironmentTier,
  EnvironmentConfig,
  EnvironmentOptions,
  EnvironmentSwitchResult,
  EnvironmentChangeListener,
  EnvironmentValidationResult,
  EnvironmentValidationIssue,
} from './types/environment';
export { generateTransactionURI, generatePayURI } from './utils/sep7';
export { getRequiredSigners } from './utils/getRequiredSigners';
export { verifyWebhookSignature } from './utils/webhooks';
export { parseEvents, decodeSorobanSymbol } from './utils/soroban';
export type { ParsedEvent, ParseEventsOptions, DecodedTopic } from './utils/soroban';
export { isValidXDR, assertValidXDR, MAX_XDR_STRING_LENGTH } from './utils/xdrValidator';

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

// Profiling
export { ProfilingService, profilingService } from './profiling';
export type {
  ProfileOptions,
  ProfiledCallMetric,
  ProfilingConfig,
  ProfilingLevel,
  ProfilingReport,
} from './profiling';

// Testing & MSW
// export * from './test/msw/setup';
// export * from './test/msw/handlers';
// export { server } from './test/msw/server';
export * from './test/msw/setup';
export * from './test/msw/handlers';
export { server } from './test/msw/server';

// Replay Framework
export { InteractionRecorder, ReplayEngine, ReplayValidator } from './replay';
export type {
  ContractHandlers,
  RecordedInteraction,
  RecordingMetadata,
  ReplaySession,
  ReplayResult,
  ValidationResult,
  ReplayValidationReport,
  ReplayOptions,
} from './replay';

// Transaction Lifecycle Tracking
export { TransactionLifecycleState, LifecycleStateMachine } from './lifecycle';
export type { LifecycleTransitionRecord } from './lifecycle';
export { InvalidLifecycleTransitionError, TransactionNotTrackedError } from './lifecycle';
export { LifecycleEventEmitter } from './events';
export type {
  LifecycleEvent,
  LifecycleEventType,
  LifecycleEventListener,
  LifecycleEventFilter,
} from './events';
export { TransactionLifecycleManager } from './transactions';
export type {
  TransactionLifecycleRecord,
  CreateTransactionOptions,
  TransactionStatusQuery,
} from './transactions';

// Offline Transaction Creation Workflow
export { OfflineTransactionBuilder, MAX_OPERATIONS_PER_TRANSACTION } from './transactions';
export { OFFLINE_TRANSACTION_PACKAGE_VERSION } from './transactions';
export type {
  OfflineSourceAccount,
  OfflineTransactionBuilderOptions,
  OfflineTransactionValidationResult,
  OfflineTransactionPackage,
} from './transactions';

// Response Metadata (opt-in diagnostic feature)
export type {
  ResponseMetadata,
  WithMetadata,
  ServiceMethodOptions,
} from './types/common';
export {
  generateRequestId,
  buildResponseMetadata,
  buildErrorMetadata,
  wrapWithMetadata,
  maybeWrap,
} from './http/responseMetadata';

// Contract Schema Validation Framework
export { SchemaValidationError } from './errors/axionveraError';
export type { SchemaValidationErrorOptions } from './errors/axionveraError';

// Batch Transaction System
export {
  BatchError,
  BatchValidationError,
  BatchExecutionError,
} from './errors/axionveraError';
export { BatchBuilder, BatchValidator, batchValidator, BatchExecutor } from './batch';
export type { BatchRpcClient } from './batch';
export type {
  BatchConfig,
  BatchDependency,
  BatchResult,
  BatchTransaction,
  BatchTransactionResult,
  BatchValidationIssue,
  BatchValidationResult,
} from './batch';
export {
  ContractValidationEngine,
  defaultValidationEngine,
  validateAgainstSchema,
  withSchemaValidation,
  customRule,
  positiveBigIntSchema,
  nonNegativeBigIntSchema,
  nonEmptyStringSchema,
  stellarAccountIdSchema,
  stellarContractIdSchema,
  numberInRangeSchema,
} from './validation';
export type {
  AnyValidationSchema,
  ContractMethodSchema,
  ValidationIssue,
  ValidationKind,
} from './types/validation';
export {
  VAULT_CONTRACT_ID,
  VaultDepositParamsSchema,
  VaultWithdrawParamsSchema,
  VaultInfoResultSchema,
  VaultBalanceResultSchema,
} from './contracts/contractSchemas';

// Contract Migration Support Toolkit
export { MigrationStateValidationError, MigrationPathNotFoundError } from './errors/axionveraError';
export type { MigrationStateValidationErrorOptions } from './errors/axionveraError';
export {
  MigrationRegistry,
  defaultMigrationRegistry,
  MigrationStateValidator,
  defaultMigrationStateValidator,
  MigrationRunner,
  defaultMigrationRunner,
  summarizeMigrationReport,
  serializeMigrationReport,
  MigrationStatus,
  MigrationStepStatus,
} from './migrations';
export type {
  AnyMigrationStep,
  MigrationContext,
  MigrationPlan,
  MigrationReport,
  MigrationStepDefinition,
  MigrationStepResult,
  RunMigrationOptions,
  RunMigrationResult,
} from './migrations';
export {
  VAULT_MIGRATION_CONTRACT_ID,
  VaultStateV1Schema,
  VaultStateV2Schema,
  VaultStateV3Schema,
  vaultV1ToV2Migration,
  vaultV2ToV3Migration,
} from './contracts/contractMigrations';
export type { VaultStateV1, VaultStateV2, VaultStateV3 } from './contracts/contractMigrations';

// ABI Version Compatibility Framework
export {
  UnsupportedAbiVersionError,
  AbiVersionDetectionError,
  UnsupportedContractMethodError,
} from './errors/axionveraError';
export { AbiVersionRegistry, defaultAbiVersionRegistry } from './registry/abiVersionRegistry';
export type {
  AbiVersion,
  AbiMethodAdapter,
  AbiVersionDescriptor,
  AbiDetectionConfidence,
  AbiVersionDetectionResult,
  AbiVersionProbe,
} from './types/abi';
export { AbiCompatAdapter } from './adapters/abiCompatAdapter';
export type { RawContractCaller, AbiCompatAdapterOptions } from './adapters/abiCompatAdapter';
export { VAULT_ABI_CONTRACT_ID } from './contracts/vaultAbiVersions';
// Imported for its registration side effects: registers Vault's v1/v2/v3
// ABI descriptors against `defaultAbiVersionRegistry`.
import './contracts/vaultAbiVersions';
