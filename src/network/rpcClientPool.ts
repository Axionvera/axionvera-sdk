/**
 * RPC Client Pool - Integration with Stellar RPC Client
 * This creates a connection pool specifically for Stellar RPC clients
 */

import { AsyncRpcConnectionPool, RpcConnection, DefaultRpcConnection } from '../pooling';

/**
 * Stellar RPC Client Factory
 */
export interface StellarRpcClientFactory {
  createClient(): Promise<any>;
}

/**
 * Options for Stellar RPC Client Pool
 */
export interface StellarRpcPoolOptions {
  /** Pool name */
  name?: string;

  /** Maximum number of clients in the pool */
  maxSize?: number;

  /** Number of clients to pre-create */
  warmSize?: number;

  /** Maximum lifetime of a client in ms */
  maxLifetime?: number;

  /** Maximum idle time in ms */
  maxIdleTime?: number;

  /** Enable health checks */
  healthCheck?: boolean;

  /** Stellar network configuration */
  networkConfig?: {
    rpcUrl: string;
    horizonUrl?: string;
    passphrase?: string;
    [key: string]: any;
  };
}

/**
 * Stellar RPC Client Pool
 */
export class StellarRpcClientPool {
  private pool: AsyncRpcConnectionPool;
  private options: StellarRpcPoolOptions;
  private clientFactory: () => Promise<any>;

  constructor(
    clientFactory: () => Promise<any>,
    options: StellarRpcPoolOptions = {}
  ) {
    this.options = options;
    this.clientFactory = clientFactory;

    // Create a sync factory that the ObjectPool expects
    const syncFactory = (): RpcConnection => {
      // This throws because we pre-create connections
      // The warmPool method handles actual creation
      throw new Error('Use pre-warmed connections');
    };

    // Create the pool
    this.pool = new AsyncRpcConnectionPool({
      name: options.name || 'stellar-rpc-pool',
      factory: syncFactory,
      maxSize: options.maxSize || 20,
      warmSize: 0, // We'll warm manually
      maxLifetime: options.maxLifetime || 3600000,
      maxIdleTime: options.maxIdleTime || 60000,
      healthCheck: options.healthCheck !== false,
      onCreate: (connection) => {
        console.log(`RPC client created: ${connection.id}`);
      },
      onAcquire: (connection) => {
        console.log(`RPC client acquired: ${connection.id}`);
      },
      onRelease: (connection) => {
        console.log(`RPC client released: ${connection.id}`);
      },
      onDestroy: (connection) => {
        console.log(`RPC client destroyed: ${connection.id}`);
      },
    });

    // Pre-warm the pool
    this.warmPool(options.warmSize || 2);
  }

  /**
   * Warm the pool asynchronously
   */
  private async warmPool(count: number): Promise<void> {
    const poolObj = this.pool.getPool();
    const pool = poolObj as any;

    for (let i = 0; i < count; i++) {
      try {
        const client = await this.clientFactory();
        const conn = new DefaultRpcConnection(client);
        pool.available.push(conn);
        pool.created++;
        pool.config.onCreate?.(conn);
      } catch (error) {
        console.error('Failed to create connection during warmup:', error);
      }
    }
  }

  /**
   * Execute an RPC operation with automatic connection management
   */
  async execute<T>(operation: (client: any) => Promise<T>): Promise<T> {
    return this.pool.withBorrowed(async (connection) => {
      return await operation(connection.client);
    });
  }

  /**
   * Acquire a connection from the pool
   */
  acquire(): RpcConnection {
    return this.pool.acquire();
  }

  /**
   * Release a connection back to the pool
   */
  release(connection: RpcConnection): void {
    this.pool.release(connection);
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return this.pool.getStats();
  }

  /**
   * Drain the pool
   */
  drain(): void {
    this.pool.drain();
  }

  /**
   * Check if pool is healthy
   */
  isHealthy(): boolean {
    const stats = this.pool.getStats();
    return stats.available + stats.borrowed > 0;
  }

  /**
   * Get pool information
   */
  getInfo() {
    return {
      options: this.options,
      stats: this.getStats(),
    };
  }
}

/**
 * Create a Stellar RPC client pool from configuration
 */
export function createStellarRpcPool(config: {
  rpcUrl: string;
  horizonUrl?: string;
  passphrase?: string;
  maxSize?: number;
  warmSize?: number;
}): StellarRpcClientPool {
  const clientFactory = async () => {
    // This is where you'd create your actual Stellar RPC client
    // Placeholder - replace with actual implementation
    return {
      rpcUrl: config.rpcUrl,
      horizonUrl: config.horizonUrl,
      passphrase: config.passphrase,
      healthCheck: async () => true,
      close: async () => {},
      reset: async () => {},
    };
  };

  return new StellarRpcClientPool(clientFactory, {
    name: 'stellar-rpc-pool',
    maxSize: config.maxSize || 20,
    warmSize: config.warmSize || 2,
    networkConfig: config,
  });
}