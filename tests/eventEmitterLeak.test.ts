import { ContractEventEmitter } from '../packages/core/src/contracts/ContractEventEmitter';
import { StellarClient } from '../packages/core/src/client/stellarClient';

describe('ContractEventEmitter Memory Leak Testing', () => {
  let client: StellarClient;
  const contractId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB7YI';

  beforeEach(() => {
    client = new StellarClient({ network: 'testnet' });
  });

  /**
   * Test that instantiating and destroying the emitter 10,000 times
   * does not leave orphaned intervals.
   */
  test('should balance setInterval and clearInterval calls over 10,000 iterations', () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    for (let i = 0; i < 10000; i++) {
      const emitter = new ContractEventEmitter(client, contractId);
      emitter.on('topic', () => {});
      emitter.removeAllListeners();
    }

    // Each 'on' call starts a timer, each 'removeAllListeners' should clear it.
    expect(setIntervalSpy).toHaveBeenCalledTimes(10000);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(10000);

    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  /**
   * Test that memory usage remains relatively flat.
   * Note: This is a heuristic test as V8 GC is non-deterministic.
   */
  test('memory usage should remain stable after 10,000 cycles', () => {
    // Warm up
    for (let i = 0; i < 100; i++) {
      const emitter = new ContractEventEmitter(client, contractId);
      emitter.on('topic', () => {});
      emitter.removeAllListeners();
    }

    const initialMemory = process.memoryUsage().heapUsed;
    const ITERATIONS = 10000;

    for (let i = 0; i < ITERATIONS; i++) {
      const emitter = new ContractEventEmitter(client, contractId);
      emitter.on('topic', () => {});
      emitter.removeAllListeners();
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryDiff = finalMemory - initialMemory;

    // We expect memory growth to be minimal (less than 1MB per 10k iterations 
    // is very safe for these small objects, but we'll be generous with 10MB 
    // to avoid flaky tests in different environments).
    const MAX_ALLOWED_DIFF = 10 * 1024 * 1024; // 10 MB
    
    console.log(`Memory used before: ${Math.round(initialMemory / 1024 / 1024)} MB`);
    console.log(`Memory used after: ${Math.round(finalMemory / 1024 / 1024)} MB`);
    console.log(`Memory diff: ${Math.round(memoryDiff / 1024)} KB`);

    expect(memoryDiff).toBeLessThan(MAX_ALLOWED_DIFF);
  });

  test('should clear intervals when the last listener is removed via off()', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const emitter = new ContractEventEmitter(client, contractId);
    
    const cb = () => {};
    emitter.on('topic', cb);
    expect(clearIntervalSpy).not.toHaveBeenCalled();
    
    emitter.off('topic', cb);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    
    clearIntervalSpy.mockRestore();
  });
});
