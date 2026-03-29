import { TransactionSigner, SimulationResult, TransactionResult } from '../src/transaction';
import { StellarClient } from '../src/client/stellarClient';
import { LocalKeypairWalletConnector } from '../src/wallet/localKeypairWalletConnector';
import { Keypair } from '@stellar/stellar-sdk';

// Mock dependencies for testing
jest.mock('../src/client/stellarClient');
jest.mock('../src/wallet/localKeypairWalletConnector');

describe('TransactionSigner', () => {
  let transactionSigner: TransactionSigner;
  let mockClient: jest.Mocked<StellarClient>;
  let mockWallet: jest.Mocked<LocalKeypairWalletConnector>;
  let mockKeypair: jest.Mocked<Keypair>;

  beforeEach(() => {
    // Create mock instances
    mockClient = new StellarClient({ network: 'testnet' }) as jest.Mocked<StellarClient>;
    mockWallet = new LocalKeypairWalletConnector(Keypair.random()) as jest.Mocked<LocalKeypairWalletConnector>;
    mockKeypair = Keypair.random() as jest.Mocked<Keypair>;

    // Setup default mock behavior
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

    transactionSigner = new TransactionSigner({
      client: mockClient,
      wallet: mockWallet,
      defaultFee: 100000,
      defaultTimeout: 60,
      autoSimulate: true
    });
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      const signer = new TransactionSigner({
        client: mockClient,
        wallet: mockWallet
      });

      expect(signer).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const signer = new TransactionSigner({
        client: mockClient,
        wallet: mockWallet,
        defaultFee: 200000,
        defaultTimeout: 120,
        autoSimulate: false
      });

      expect(signer).toBeDefined();
    });
  });

  describe('buildAndSignTransaction', () => {
    it('should build, simulate, sign, and submit a transaction', async () => {
      // Setup mocks
      const mockAccount = {
        accountId: 'GTEST123456789',
        sequence: '1'
      };
      
      const mockSimulation = {
        results: [{ cpuInstructions: 100000, memoryBytes: 1000 }],
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

      const result = await transactionSigner.buildAndSignTransaction({
        sourceAccount: 'GTEST123456789',
        operations: [{
          contractId: 'CTEST123456789',
          method: 'test_method',
          args: [1000n]
        }]
      });

      expect(result.successful).toBe(true);
      expect(result.hash).toBe('test-hash');
      expect(result.status).toBe('SUCCESS');
      expect(mockClient.simulateTransaction).toHaveBeenCalled();
      expect(mockClient.prepareTransaction).toHaveBeenCalled();
      expect(mockWallet.signTransaction).toHaveBeenCalled();
    });

    it('should handle simulation failures', async () => {
      const mockAccount = {
        accountId: 'GTEST123456789',
        sequence: '1'
      };
      
      const mockSimulation = {
        error: 'Simulation failed'
      };

      mockClient.rpc!.getAccount = jest.fn().mockResolvedValue(mockAccount);
      mockClient.simulateTransaction = jest.fn().mockResolvedValue(mockSimulation);

      await expect(transactionSigner.buildAndSignTransaction({
        sourceAccount: 'GTEST123456789',
        operations: [{
          contractId: 'CTEST123456789',
          method: 'test_method'
        }]
      })).rejects.toThrow('Transaction simulation failed: Simulation failed');
    });
  });

  describe('simulateTransaction', () => {
    it('should simulate a transaction and return resource estimates', async () => {
      const mockAccount = {
        accountId: 'GTEST123456789',
        sequence: '1'
      };
      
      const mockSimulation = {
        results: [{ cpuInstructions: 100000, memoryBytes: 1000 }],
        transactionData: { resourceFee: 50000 },
        error: undefined
      };

      mockClient.rpc!.getAccount = jest.fn().mockResolvedValue(mockAccount);
      mockClient.simulateTransaction = jest.fn().mockResolvedValue(mockSimulation);

      const result = await transactionSigner.simulateTransaction({
        sourceAccount: 'GTEST123456789',
        operations: [{
          contractId: 'CTEST123456789',
          method: 'test_method'
        }]
      });

      expect(result.success).toBe(true);
      expect(result.cpuInstructions).toBe(100000);
      expect(result.memoryBytes).toBe(1000);
      expect(result.recommendedFee).toBe(50000);
    });

    it('should handle simulation errors', async () => {
      const mockAccount = {
        accountId: 'GTEST123456789',
        sequence: '1'
      };
      
      const mockSimulation = {
        error: 'Contract execution failed'
      };

      mockClient.rpc!.getAccount = jest.fn().mockResolvedValue(mockAccount);
      mockClient.simulateTransaction = jest.fn().mockResolvedValue(mockSimulation);

      const result = await transactionSigner.simulateTransaction({
        sourceAccount: 'GTEST123456789',
        operations: [{
          contractId: 'CTEST123456789',
          method: 'test_method'
        }]
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Contract execution failed');
    });
  });

  describe('createFeeBumpTransaction', () => {
    it('should create and sign a fee bump transaction', async () => {
      const mockFeeSourceAccount = {
        accountId: 'GFEE123456789',
        sequence: '1'
      };

      mockClient.rpc!.getAccount = jest.fn().mockResolvedValue(mockFeeSourceAccount);

      const result = await transactionSigner.createFeeBumpTransaction({
        innerTransaction: 'inner-xdr',
        feeSource: 'GFEE123456789',
        baseFee: 100
      });

      expect(result).toBeDefined();
      expect(mockWallet.signTransaction).toHaveBeenCalled();
    });
  });

  describe('estimateOptimalFee', () => {
    it('should estimate optimal fee based on simulation', async () => {
      const mockAccount = {
        accountId: 'GTEST123456789',
        sequence: '1'
      };
      
      const mockSimulation = {
        results: [{ cpuInstructions: 100000, memoryBytes: 1000 }],
        transactionData: { resourceFee: 75000 },
        error: undefined
      };

      mockClient.rpc!.getAccount = jest.fn().mockResolvedValue(mockAccount);
      mockClient.simulateTransaction = jest.fn().mockResolvedValue(mockSimulation);

      const fee = await transactionSigner.estimateOptimalFee({
        sourceAccount: 'GTEST123456789',
        operations: [{
          contractId: 'CTEST123456789',
          method: 'test_method'
        }]
      });

      expect(fee).toBe(75000);
    });

    it('should throw error when simulation fails', async () => {
      const mockAccount = {
        accountId: 'GTEST123456789',
        sequence: '1'
      };
      
      const mockSimulation = {
        error: 'Simulation failed'
      };

      mockClient.rpc!.getAccount = jest.fn().mockResolvedValue(mockAccount);
      mockClient.simulateTransaction = jest.fn().mockResolvedValue(mockSimulation);

      await expect(transactionSigner.estimateOptimalFee({
        sourceAccount: 'GTEST123456789',
        operations: [{
          contractId: 'CTEST123456789',
          method: 'test_method'
        }]
      })).rejects.toThrow('Fee estimation failed: Simulation failed');
    });
  });

  describe('getPublicKey', () => {
    it('should return the public key from wallet', async () => {
      const publicKey = await transactionSigner.getPublicKey();
      expect(publicKey).toBe('GTEST123456789');
      expect(mockWallet.getPublicKey).toHaveBeenCalled();
    });
  });
});
