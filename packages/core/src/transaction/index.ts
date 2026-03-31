/**
 * Transaction signing module index.
 * 
 * Exports all transaction signing utilities and related types.
 */

// Core transaction signer
export { TransactionSigner } from './transactionSigner';
export type {
  TransactionSignerConfig,
  ContractCallParams,
  TransactionBuildParams,
  TransactionResult,
  SimulationResult,
  FeeBumpParams
} from './transactionSigner';

// Enhanced transaction builder
export { EnhancedTransactionBuilder } from './enhancedTransactionBuilder';
export type {
  MultiStepTransactionParams,
  BatchTransactionParams,
  BatchTransactionResult
} from './enhancedTransactionBuilder';

// Transaction simulator
export { TransactionSimulator } from './transactionSimulator';
export type {
  DetailedSimulationResult,
  ResourceOptimizationOptions
} from './transactionSimulator';
