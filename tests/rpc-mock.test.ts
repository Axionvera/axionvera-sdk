import { StellarClient } from '../src/client/stellarClient';
import { Account, TransactionBuilder, Networks, Keypair } from '@stellar/stellar-sdk';
import { server } from './mocks/setup'; // importing server to allow test-specific overrides if needed

describe('JSON-RPC Mock Integration', () => {
  let client: StellarClient;
  let dummyTx: any;

  beforeEach(() => {
    client = new StellarClient({
      network: 'testnet',
      retryConfig: { maxRetries: 0 } // disable retries to fail fast in testing
    });
    const sourceAccount = new Account(Keypair.random().publicKey(), "1");
    dummyTx = new TransactionBuilder(sourceAccount, {
      fee: "100",
      networkPassphrase: Networks.TESTNET
    }).setTimeout(30).build();
  });

  it('should mock getHealth RPC call correctly', async () => {
    const health = await client.getHealth();
    expect(health).toBeDefined();
    expect(health.status).toBe('healthy');
    // Check fields returned by our mock
    expect((health as any).latestLedger).toBe(12345);
  });

  it('should mock simulateTransaction RPC call correctly', async () => {
    // In simulateTransaction, the SDK uses Stellar SDK's Transaction Builder
    // However, our mocked RPC will just return the simulated data based on our handler
    // We override to bypass any complex XDR parsing since this is just testing the mock layer
    const result = await client.simulateTransaction(dummyTx);
    expect(result).toBeDefined();
    expect((result as any).latestLedger).toBe(12345);
    expect((result as any).minResourceFee).toBe('100');
  });

  it('should mock sendTransaction RPC call correctly', async () => {
    const result = await client.sendTransaction(dummyTx);
    expect(result).toBeDefined();
    expect(result.hash).toBe('mock-transaction-hash-12345');
    expect(result.status).toBe('PENDING');
  });
});
