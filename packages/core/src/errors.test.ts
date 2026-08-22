import { describe, it, expect } from 'vitest';
import {
  AxionveraError,
  ValidationError,
  NetworkError,
  WalletError,
  ContractError,
  TransactionTimeoutError,
} from './errors';

describe('Error Classes', () => {
  it('AxionveraError exposes message, name, code, and optional cause', () => {
    const error = new AxionveraError('Base error message');
    expect(error.message).toBe('Base error message');
    expect(error.name).toBe('AxionveraError');
    expect(error.code).toBe('AXIONVERA_ERROR');
    expect(error.cause).toBeUndefined();

    const cause = new Error('Root cause');
    const errorWithCause = new AxionveraError('Base with cause', 'AXIONVERA_ERROR', cause);
    expect(errorWithCause.cause).toBe(cause);
  });

  it('ValidationError uses VALIDATION_ERROR', () => {
    const error = new ValidationError('Validation failed');
    expect(error.message).toBe('Validation failed');
    expect(error.name).toBe('ValidationError');
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('NetworkError uses NETWORK_ERROR', () => {
    const error = new NetworkError('Network failed');
    expect(error.message).toBe('Network failed');
    expect(error.name).toBe('NetworkError');
    expect(error.code).toBe('NETWORK_ERROR');
  });

  it('WalletError uses WALLET_ERROR', () => {
    const error = new WalletError('Wallet failed');
    expect(error.message).toBe('Wallet failed');
    expect(error.name).toBe('WalletError');
    expect(error.code).toBe('WALLET_ERROR');
  });

  it('ContractError uses CONTRACT_ERROR', () => {
    const error = new ContractError('Contract failed');
    expect(error.message).toBe('Contract failed');
    expect(error.name).toBe('ContractError');
    expect(error.code).toBe('CONTRACT_ERROR');
  });

  it('TransactionTimeoutError uses TRANSACTION_TIMEOUT and includes the transaction hash', () => {
    const error = new TransactionTimeoutError('0x123abc');
    expect(error.message).toBe('Transaction confirmation timed out for 0x123abc');
    expect(error.name).toBe('TransactionTimeoutError');
    expect(error.code).toBe('TRANSACTION_TIMEOUT');
  });
});
