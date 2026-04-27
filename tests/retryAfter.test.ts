import { createHttpClientWithRetry } from '../packages/core/src/utils/httpInterceptor';
import { setupMswTest, overrideHandlers, rest } from '../src/index';

describe('Retry-After Header Handling', () => {
  // Uses the MSW suite to intercept network calls
  setupMswTest();

  const rpcUrl = 'https://soroban-testnet.stellar.org';
  const client = createHttpClientWithRetry({
    baseDelayMs: 100, // Shorten for faster tests
    maxDelayMs: 5000
  });

  it('should respect Retry-After header with delta-seconds', async () => {
    let attempts = 0;
    const retrySeconds = 1;
    
    overrideHandlers(
      rest.get(`${rpcUrl}/health`, (req, res, ctx) => {
        attempts++;
        if (attempts === 1) {
          return res(
            ctx.status(429),
            ctx.set('Retry-After', retrySeconds.toString()),
            ctx.json({ error: 'Too Many Requests' })
          );
        }
        return res(ctx.json({ status: 'healthy' }));
      })
    );

    const start = Date.now();
    await client.get(`${rpcUrl}/health`);
    const duration = Date.now() - start;

    // Should wait at least the duration specified in the header
    expect(duration).toBeGreaterThanOrEqual(retrySeconds * 1000);
    expect(attempts).toBe(2);
  });

  it('should respect Retry-After header with HTTP-date', async () => {
    let attempts = 0;
    const waitMs = 1500;
    const retryDate = new Date(Date.now() + waitMs).toUTCString();
    
    overrideHandlers(
      rest.get(`${rpcUrl}/health`, (req, res, ctx) => {
        attempts++;
        if (attempts === 1) {
          return res(
            ctx.status(429),
            ctx.set('Retry-After', retryDate),
            ctx.json({ error: 'Too Many Requests' })
          );
        }
        return res(ctx.json({ status: 'healthy' }));
      })
    );

    const start = Date.now();
    await client.get(`${rpcUrl}/health`);
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(waitMs);
    expect(attempts).toBe(2);
  });

  it('should fall back to exponential backoff if Retry-After is missing', async () => {
    let attempts = 0;
    overrideHandlers(
      rest.get(`${rpcUrl}/health`, (req, res, ctx) => {
        attempts++;
        if (attempts === 1) {
          return res(ctx.status(429), ctx.json({ error: 'Too Many Requests' }));
        }
        return res(ctx.json({ status: 'healthy' }));
      })
    );

    await client.get(`${rpcUrl}/health`);
    expect(attempts).toBe(2);
  });
});