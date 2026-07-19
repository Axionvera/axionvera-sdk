import {
  RequestCancelledError,
  RequestScheduler,
  createScheduledClient,
} from '../../src/scheduler';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('RequestScheduler', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs higher-priority requests before lower-priority queued work', async () => {
    const scheduler = new RequestScheduler({ maxConcurrentRequests: 1 });
    const executionOrder: string[] = [];

    const first = scheduler.schedule(async () => {
      executionOrder.push('first');
      await delay(25);
      return 'first';
    });
    const low = scheduler.schedule(
      async () => {
        executionOrder.push('low');
        return 'low';
      },
      { priority: 'low' }
    );
    const critical = scheduler.schedule(
      async () => {
        executionOrder.push('critical');
        return 'critical';
      },
      { priority: 'critical' }
    );

    await expect(Promise.all([first, low, critical])).resolves.toEqual([
      'first',
      'low',
      'critical',
    ]);
    expect(executionOrder).toEqual(['first', 'critical', 'low']);
  });

  it('preserves FIFO order within the same effective priority', async () => {
    const scheduler = new RequestScheduler({ maxConcurrentRequests: 1 });
    const executionOrder: number[] = [];

    const first = scheduler.schedule(async () => {
      executionOrder.push(1);
      await delay(20);
      return 1;
    });
    const second = scheduler.schedule(async () => {
      executionOrder.push(2);
      return 2;
    });
    const third = scheduler.schedule(async () => {
      executionOrder.push(3);
      return 3;
    });

    await expect(Promise.all([first, second, third])).resolves.toEqual([1, 2, 3]);
    expect(executionOrder).toEqual([1, 2, 3]);
  });

  it('boosts old queued requests to prevent starvation', async () => {
    jest.useFakeTimers();
    const scheduler = new RequestScheduler({
      maxConcurrentRequests: 1,
      agingInterval: 100,
      agingBoost: 40,
    });
    const executionOrder: string[] = [];

    const first = scheduler.schedule(async () => {
      executionOrder.push('first');
      await delay(200);
      return 'first';
    });
    const oldLow = scheduler.schedule(
      async () => {
        executionOrder.push('old-low');
        return 'old-low';
      },
      { priority: 'low' }
    );

    await jest.advanceTimersByTimeAsync(150);

    const freshCritical = scheduler.schedule(
      async () => {
        executionOrder.push('fresh-critical');
        return 'fresh-critical';
      },
      { priority: 'critical' }
    );

    await jest.advanceTimersByTimeAsync(100);
    await expect(Promise.all([first, oldLow, freshCritical])).resolves.toEqual([
      'first',
      'old-low',
      'fresh-critical',
    ]);
    expect(executionOrder).toEqual(['first', 'old-low', 'fresh-critical']);
  });

  it('supports queue timeout, cancellation, and abort signals', async () => {
    const scheduler = new RequestScheduler({ maxConcurrentRequests: 1, queueTimeout: 20 });

    const first = scheduler.schedule(async () => {
      await delay(50);
      return 'first';
    });
    const timedOut = scheduler.schedule(async () => 'timed-out');
    await expect(timedOut).rejects.toThrow('Scheduled request timed out in queue');

    const cancelScheduler = new RequestScheduler({ maxConcurrentRequests: 1 });
    const blocker = cancelScheduler.schedule(async () => {
      await delay(25);
      return 'blocker';
    });
    const cancellable = cancelScheduler.schedule(async () => 'cancelled', { id: 'cancel-me' });
    expect(cancelScheduler.cancel('cancel-me')).toBe(true);
    await expect(cancellable).rejects.toBeInstanceOf(RequestCancelledError);

    const controller = new AbortController();
    const abortScheduler = new RequestScheduler({ maxConcurrentRequests: 1 });
    const abortBlocker = abortScheduler.schedule(async () => {
      await delay(25);
      return 'abort-blocker';
    });
    const aborted = abortScheduler.schedule(async () => 'aborted', {
      id: 'abort-me',
      signal: controller.signal,
    });
    controller.abort();
    await expect(aborted).rejects.toBeInstanceOf(RequestCancelledError);

    await expect(first).resolves.toBe('first');
    await expect(blocker).resolves.toBe('blocker');
    await expect(abortBlocker).resolves.toBe('abort-blocker');
  });

  it('exposes queue statistics and snapshots', async () => {
    const scheduler = new RequestScheduler({ maxConcurrentRequests: 1 });

    const active = scheduler.schedule(async () => {
      await delay(25);
      return 'active';
    });
    const queued = scheduler.schedule(async () => 'queued', {
      id: 'queued',
      priority: 'high',
      metadata: { operation: 'getLedger' },
    });

    await delay(1);
    expect(scheduler.getStats()).toMatchObject({
      activeRequests: 1,
      queuedRequests: 1,
      maxConcurrentRequests: 1,
    });
    expect(scheduler.getQueueSnapshot()).toEqual([
      expect.objectContaining({
        id: 'queued',
        priority: 20,
        metadata: { operation: 'getLedger' },
      }),
    ]);

    await expect(Promise.all([active, queued])).resolves.toEqual(['active', 'queued']);
  });
});

describe('createScheduledClient', () => {
  it('wraps client methods and applies per-method priorities', async () => {
    const scheduler = new RequestScheduler({ maxConcurrentRequests: 1 });
    const executionOrder: string[] = [];
    const client = {
      getHealth: jest.fn(async () => {
        executionOrder.push('health');
        await delay(20);
        return 'health';
      }),
      submitTransaction: jest.fn(async () => {
        executionOrder.push('submit');
        return 'submit';
      }),
      network: 'testnet',
    };

    const scheduledClient = createScheduledClient(client, scheduler, {
      submitTransaction: 'critical',
      getHealth: 'low',
    });

    const health = scheduledClient.getHealth();
    const submit = scheduledClient.submitTransaction();

    await expect(Promise.all([health, submit])).resolves.toEqual(['health', 'submit']);
    expect(scheduledClient.network).toBe('testnet');
    expect(executionOrder).toEqual(['health', 'submit']);
    expect(client.getHealth).toHaveBeenCalledTimes(1);
    expect(client.submitTransaction).toHaveBeenCalledTimes(1);
  });
});
