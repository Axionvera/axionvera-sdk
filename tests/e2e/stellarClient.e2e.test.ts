
import { StellarClient } from '../../src/client/stellarClient';

describe('StellarClient E2E', () => {
  let client: StellarClient;

  beforeAll(() => {
    // This assumes that a local Stellar Quickstart container is running
    // and that the RPC endpoint is available at http://localhost:8000
    client = new StellarClient({ rpcUrl: 'http://localhost:8000' });
  });

  it('should get the latest ledger from a local Stellar Quickstart container', async () => {
    const ledger = await client.getLatestLedger();
    expect(ledger).toBeDefined();
    expect(typeof ledger).toBe('object');
    // @ts-ignore
    expect(ledger.sequence).toBeGreaterThan(0);
  }, 2000);
});
