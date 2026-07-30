import { sleep } from '../src/utils/sleep';

describe('sleep', () => {
  it('resolves after the specified delay', async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    // Allow generous lower bound to avoid flakiness on slow CI
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });

  it('resolves with undefined', async () => {
    const result = await sleep(1);
    expect(result).toBeUndefined();
  });

  it('resolves immediately for zero delay', async () => {
    const start = Date.now();
    await sleep(0);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it('returns a promise', () => {
    const result = sleep(1);
    expect(result).toBeInstanceOf(Promise);
    return result;
  });
});
