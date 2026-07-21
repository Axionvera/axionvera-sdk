/**
 * Tests for RPC Connection Pool
 */

import {
  RpcConnectionPool,
  AsyncRpcConnectionPool,
  DefaultRpcConnection,
  objectPoolManager
} from '../../src/pooling';

// Mock connection factory that returns sync connections
const createMockConnection = (): DefaultRpcConnection => {
  const client = {
    id: 'test-client',
    healthCheck: async () => true,
    close: async () => {},
    reset: async () => {},
  };
  return new DefaultRpcConnection(client);
};

// Mock async connection factory - returns sync connection but wrapped
const createMockAsyncConnection = (): DefaultRpcConnection => {
  const client = {
    id: 'test-client',
    healthCheck: async () => true,
    close: async () => {},
    reset: async () => {},
  };
  return new DefaultRpcConnection(client);
};

describe('RpcConnectionPool', () => {
  let pool: RpcConnectionPool;
  let asyncPool: AsyncRpcConnectionPool;

  beforeEach(() => {
    // Create a sync pool
    pool = new RpcConnectionPool({
      name: 'test-sync-pool',
      factory: createMockConnection,
      maxSize: 5,
      warmSize: 2,
    });

    // Create an async pool - uses sync factory (connections are pre-created)
    asyncPool = new AsyncRpcConnectionPool({
      name: 'test-async-pool',
      factory: createMockAsyncConnection,
      maxSize: 5,
      warmSize: 0, // We'll manually warm
    });
  });

  afterEach(() => {
    pool.drain();
    asyncPool.drain();
    objectPoolManager.clear();
  });

  test('should create pool with warm connections', () => {
    const stats = pool.getStats();
    expect(stats.available).toBe(2);
    expect(stats.borrowed).toBe(0);
    expect(stats.maxSize).toBe(5);
  });

  test('should acquire and release connections', () => {
    const conn = pool.acquire();
    expect(conn).toBeDefined();
    expect(conn.status).toBe('active');

    let stats = pool.getStats();
    expect(stats.borrowed).toBe(1);
    expect(stats.available).toBe(1);

    pool.release(conn);
    stats = pool.getStats();
    expect(stats.borrowed).toBe(0);
    expect(stats.available).toBe(2);
  });

  test('should execute operations with withBorrowed', () => {
    const result = pool.withBorrowed((conn) => {
      expect(conn.status).toBe('active');
      return 'success';
    });

    expect(result).toBe('success');

    const stats = pool.getStats();
    expect(stats.borrowed).toBe(0);
  });

  test('should execute operations in async pool', () => {
    const result = asyncPool.withBorrowed((conn) => {
      expect(conn.status).toBe('active');
      return 'success';
    });

    expect(result).toBe('success');
  });

  test('should acquire from async pool', () => {
    const conn = asyncPool.acquire();
    expect(conn).toBeDefined();
    expect(conn.status).toBe('active');

    asyncPool.release(conn);
    expect(conn.status).toBe('idle');
  });

  test('should handle pool exhaustion', () => {
    const connections = [];
    for (let i = 0; i < 5; i++) {
      connections.push(pool.acquire());
    }

    const stats = pool.getStats();
    expect(stats.borrowed).toBe(5);
    expect(stats.available).toBe(0);

    for (const conn of connections) {
      pool.release(conn);
    }

    const finalStats = pool.getStats();
    expect(finalStats.borrowed).toBe(0);
    expect(finalStats.available).toBe(5);
  });

  test('should register with ObjectPoolManager', () => {
    const registered = objectPoolManager.get('test-sync-pool');
    expect(registered).toBeDefined();
  });

  test('should drain pool', () => {
    const conn = pool.acquire();
    pool.drain();

    const stats = pool.getStats();
    expect(stats.available).toBe(0);
    expect(stats.borrowed).toBe(0);
  });

  test('should handle connection validation', () => {
    const validatePool = new RpcConnectionPool({
      name: 'test-validation-pool',
      factory: createMockConnection,
      maxSize: 5,
      warmSize: 0,
      validate: (conn) => {
        return conn.status !== 'error';
      },
    });

    const conn = validatePool.acquire();
    expect(conn).toBeDefined();

    validatePool.release(conn);
    const stats = validatePool.getPool().getStats();
    expect(stats.available).toBe(1);

    validatePool.drain();
  });
});