import { EnhancedTransactionBuilder, BatchTransactionResult } from '../src/transaction';
import { StellarClient } from '../src/client/stellarClient';
import { LocalKeypairWalletConnector } from '../src/wallet/localKeypairWalletConnector';
import { Keypair } from '@stellar/stellar-sdk';

// Mock dependencies for testing
jest.mock('../src/client/stellarClient');
jest.mock('../src/wallet/localKeypairWalletConnector');

describe('EnhancedTransactionBuilder', () => {
  let enhancedBuilder: EnhancedTransactionBuilder;
  let mockClient: jest.Mocked<StellarClient>;
  let mockWallet: jest.Mocked<LocalKeypairWalletConnector>;

  beforeEach(() => {
    mockClient = new StellarClient({ network: 'testnet' }) as jest.Mocked<StellarClient>;
    mockWallet = new LocalKeypairWalletConnector(Keypair.random()) as jest.Mocked<LocalKeypairWalletConnector>;

    mockClient.networkPassphrase = 'Test SDF Network ; September 2015';
    mockClient.rpc = {
      getAccount: jest.fn(),
      simulateTransaction: jest.fn(),
      prepareTransaction: jest.fn(),
      sendTransaction: jest.fn(),
      pollTransaction: jest.fn()
    } as any;

    mockClient.simulateTransaction = jest.fn();
    mockClient.prepareTransaction = jest.fn();
    mockClient.sendTransaction = jest.fn();
    mockClient.pollTransaction = jest.fn();

    mockWallet.getPublicKey = jest.fn().mockResolvedValue('GTEST123456789');
    mockWallet.signTransaction = jest.fn().mockResolvedValue('signed-xdr');

    enhancedBuilder = new EnhancedTransactionBuilder({
      client: mockClient,
      wallet: mockWallet
    });
  });

  describe('buildAndSignMultiStepTransaction', () => {
    it('should build a multi-step transaction with multiple operations', async () => {
      const mockAccount = {
        accountId: 'GTEST123456789',
        sequence: '1'
      };
      
      const mockSimulation = {
        results: [
          { cpuInstructions: 50000, memoryBytes: 500 },
          { cpuInstructions: 75000, memoryBytes: 750 }
        ],
        transactionData: { resourceFee: 100000 },
        error: undefined
      };

      const mockTransaction = {
        toXDR: jest.fn().mockReturnValue('test-xdr')
      } as any;

      const mockSendResult = { hash: 'test-hash' };
      const mockFinalResult = { status: 'SUCCESS' };

      mockClient.rpc!.getAccount = jest.fn().mockResolvedValue(mockAccount);
      mockClient.simulateTransaction = jest.fn().mockResolvedValue(mockSimulation);
      mockClient.prepareTransaction = jest.fn().mockResolvedValue(mockTransaction);
      mockClient.sendTransaction = jest.fn().mockResolvedValue(mockSendResult);
      mockClient.pollTransaction = jest.fn().mockResolvedValue(mockFinalResult);

      const result = await enhancedBuilder.buildAndSignMultiStepTransaction({
        sourceAccount: 'GTEST123456789',
        steps: [
          {
            contractId: 'CTEST123456789',
            method: 'deposit',
            args: [1000n]
          },
          {
            contractId: 'CTEST123456789',
            method: 'claim_rewards',
            args: []
          }
        ]
      });

      expect(result.successful).toBe(true);
      expect(mockClient.simulateTransaction).toHaveBeenCalled();
    });

    it('should calculate total fee based on number of operations', async () => {
      const mockAccount = {
        accountId: 'GTEST123456789',
        sequence: '1'
      };
      
      const mockSimulation = {
        results: [],
        transactionData: { resourceFee: 0 },
        error: undefined
      };

      mockClient.rpc!.getAccount = jest.fn().mockResolvedValue(mockAccount);
      mockClient.simulateTransaction = jest.fn().mockResolvedValue(mockSimulation);

      // Spy on the parent buildAndSignTransaction method
      jest.spyOn(EnhancedTransactionBuilder.prototype, 'buildAndSignTransaction');

      await enhancedBuilder.buildAndSignMultiStepTransaction({
        sourceAccount: 'GTEST123456789',
        steps: [
          { contractId: 'CTEST123456789', method: 'method1' },
          { contractId: 'CTEST123456789', method: 'method2' },
          { contractId: 'CTEST123456789', method: 'method3' }
        ],
        feePerOperation: 50000
      });

      // Should be called with total fee = 3 * 50000 = 150000
      expect(EnhancedTransactionBuilder.prototype.buildAndSignTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          fee: 150000
        })
      );
    });
  });

  describe('processBatchTransactions', () => {
    it('should process transactions sequentially', async () => {
      const mockAccount = {
        accountId: 'GTEST123456789',
        sequence: '1'
      };
      
      const mockSimulation = {
        results: [{ cpuInstructions: 50000, memoryBytes: 500 }],
        transactionData: { resourceFee: 50000 },
        error: undefined
      };

      const mockTransaction = {
        toXDR: jest.fn().mockReturnValue('test-xdr')
      } as any;

      const mockSendResult = { hash: 'test-hash' };
      const mockFinalResult = { status: 'SUCCESS' };

      mockClient.rpc!.getAccount = jest.fn().mockResolvedValue(mockAccount);
      mockClient.simulateTransaction = jest.fn().mockResolvedValue(mockSimulation);
      mockClient.prepareTransaction = jest.fn().mockResolvedValue(mockTransaction);
      mockClient.sendTransaction = jest.fn().mockResolvedValue(mockSendResult);
      mockClient.pollTransaction = jest.fn().mockResolvedValue(mockFinalResult);

      const result = await enhancedBuilder.processBatchTransactions({
        transactions: [
          {
            sourceAccount: 'GTEST123456789',
            operations: [{ contractId: 'CTEST123456789', method: 'method1' }]
          },
          {
            sourceAccount: 'GTEST123456789',
            operations: [{ contractId: 'CTEST123456789', method: 'method2' }]
          }
        ],
        parallel: false
      });

      expect(result.results).toHaveLength(2);
      expect(result.summary.total).toBe(2);
      expect(result.summary.successful).toBe(2);
      expect(result.summary.failed).toBe(0);
    });

    it('should handle failures in batch processing', async () => {
      const mockAccount = {
        accountId: 'GTEST123456789',
        sequence: '1'
      };

      mockClient.rpc!.getAccount = jest.fn().mockResolvedValue(mockAccount);
      mockClient.simulateTransaction = jest.fn().mockRejectedValue(new Error('Simulation failed'));

      const result = await enhancedBuilder.processBatchTransactions({
        transactions: [
          {
            sourceAccount: 'GTEST123456789',
            operations: [{ contractId: 'CTEST123456789', method: 'method1' }]
          },
          {
            sourceAccount: 'GTEST123456789',
            operations: [{ contractId: 'CTEST123456789', method: 'method2' }]
          }
        ],
        parallel: false
      });

      expect(result.results).toHaveLength(2);
      expect(result.summary.total).toBe(2);
      expect(result.summary.successful).toBe(0);
      expect(result.summary.failed).toBe(2);
      expect(result.results[0].successful).toBe(false);
      expect(result.results[1].successful).toBe(false);
    });

    it('should process transactions in parallel when specified', async () => {
      const mockAccount = {
        accountId: 'GTEST123456789',
        sequence: '1'
      };
      
      const mockSimulation = {
        results: [{ cpuInstructions: 50000, memoryBytes: 500 }],
        transactionData: { resourceFee: 50000 },
        error: undefined
      };

      const mockTransaction = {
        toXDR: jest.fn().mockReturnValue('test-xdr')
      } as any;

      const mockSendResult = { hash: 'test-hash' };
      const mockFinalResult = { status: 'SUCCESS' };

      mockClient.rpc!.getAccount = jest.fn().mockResolvedValue(mockAccount);
      mockClient.simulateTransaction = jest.fn().mockResolvedValue(mockSimulation);
      mockClient.prepareTransaction = jest.fn().mockResolvedValue(mockTransaction);
      mockClient.sendTransaction = jest.fn().mockResolvedValue(mockSendResult);
      mockClient.pollTransaction = jest.fn().mockResolvedValue(mockFinalResult);

      const result = await enhancedBuilder.processBatchTransactions({
        transactions: [
          {
            sourceAccount: 'GTEST123456789',
            operations: [{ contractId: 'CTEST123456789', method: 'method1' }]
          },
          {
            sourceAccount: 'GTEST123456789',
            operations: [{ contractId: 'CTEST123456789', method: 'method2' }]
          }
        ],
        parallel: true
      });

      expect(result.results).toHaveLength(2);
      expect(result.summary.successful).toBe(2);
    });
  });

  describe('validateTransaction', () => {
    it('should validate a successful transaction', async () => {
      const mockTransaction = {
        fee: '100000',
        operations: [{ type: 'invoke_contract_function' }],
        timeBounds: { maxTime: 300 }
      } as any;

      const mockSimulation = {
        results: [{ cpuInstructions: 50000, memoryBytes: 500 }],
        transactionData: { resourceFee: 50000 },
        error: undefined
      };

      mockClient.simulateTransaction = jest.fn().mockResolvedValue(mockSimulation);

      const result = await enhancedBuilder.validateTransaction(mockTransaction);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect validation errors', async () => {
      const mockTransaction = {
        fee: '50', // Very low fee
        operations: [], // No operations
        timeBounds: { maxTime: 0 } // No timeout
      } as any;

      const mockSimulation = {
        error: 'Transaction validation failed'
      };

      mockClient.simulateTransaction = jest.fn().mockResolvedValue(mockSimulation);

      const result = await enhancedBuilder.validateTransaction(mockTransaction);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('estimateBatchCost', () => {
    it('should estimate costs for multiple transactions', async () => {
      const mockAccount = {
        accountId: 'GTEST123456789',
        sequence: '1'
      };
      
      const mockSimulation = {
        results: [{ cpuInstructions: 50000, memoryBytes: 500 }],
        transactionData: { resourceFee: 50000 },
        error: undefined
      };

      mockClient.rpc!.getAccount = jest.fn().mockResolvedValue(mockAccount);
      mockClient.simulateTransaction = jest.fn().mockResolvedValue(mockSimulation);

      const estimates = await enhancedBuilder.estimateBatchCost([
        {
          sourceAccount: 'GTEST123456789',
          operations: [{ contractId: 'CTEST123456789', method: 'method1' }]
        },
        {
          sourceAccount: 'GTEST123456789',
          operations: [{ contractId: 'CTEST123456789', method: 'method2' }]
        }
      ]);

      expect(estimates).toHaveLength(2);
      expect(estimates[0].estimatedFee).toBe(50000);
      expect(estimates[0].estimatedCpu).toBe(50000);
      expect(estimates[0].estimatedMemory).toBe(500);
    });

    it('should handle simulation errors in cost estimation', async () => {
      const mockAccount = {
        accountId: 'GTEST123456789',
        sequence: '1'
      };

      mockClient.rpc!.getAccount = jest.fn().mockResolvedValue(mockAccount);
      mockClient.simulateTransaction = jest.fn().mockRejectedValue(new Error('Simulation failed'));

      const estimates = await enhancedBuilder.estimateBatchCost([
        {
          sourceAccount: 'GTEST123456789',
          operations: [{ contractId: 'CTEST123456789', method: 'method1' }]
        }
      ]);

      expect(estimates).toHaveLength(1);
      expect(estimates[0].estimatedFee).toBe(100000); // Default fee
      expect(estimates[0].estimatedCpu).toBe(0);
      expect(estimates[0].estimatedMemory).toBe(0);
    });
  });
});
