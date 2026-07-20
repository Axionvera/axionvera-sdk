/**
 * RPC Connection Pool
 * Uses the existing ObjectPool with RPC-specific enhancements
 */

import { ObjectPool, ObjectPoolConfig, objectPoolManager } from './objectPool';
import { RpcConnection, DefaultRpcConnection } from './rpcConnection';

/**
 * RPC Connection Factory
 */
export interface RpcConnectionFactory {
  createConnection(): Promise<RpcConnection>;
}

/**
 * Configuration for RPC Connection Pool
 */
export interface RpcPoolConfig {
  /** Name of the pool (for registration) */
  name: string;

  /** Factory function to create RPC connections */
  factory: () => RpcConnection;

  /** Maximum number of connections in the pool */
  maxSize?: number;

  /** Number of connections to pre-create */
  warmSize?: number;

  /** Function to reset a connection before reuse */
  reset?: (connection: RpcConnection) => void;

  /** Function to validate a connection */
  validate?: (connection: RpcConnection) => boolean;

  /** Maximum lifetime of a connection in ms (0 = no limit) */
  maxLifetime?: number;

  /** Maximum idle time in ms (0 = no limit) */
  maxIdleTime?: number;

  /** Callback when connection is created */
  onCreate?: (connection: RpcConnection) => void;

  /** Callback when connection is acquired */
  onAcquire?: (connection: RpcConnection) => void;

  /** Callback when connection is released */
  onRelease?: (connection: RpcConnection) => void;

  /** Callback when connection is destroyed */
  onDestroy?: (connection: RpcConnection) => void;

  /** Enable health checks */
  healthCheck?: boolean;
}

/**
 * RPC Connection Pool Manager
 * Extends ObjectPool with RPC-specific features
 */
export class RpcConnectionPool {
  private pool: ObjectPool<RpcConnection>;
  private config: RpcPoolConfig;
  private healthCheckInterval?: ReturnType<typeof setInterval>;

  constructor(config: RpcPoolConfig) {
    this.config = config;

    // Create the object pool config
    const poolConfig: ObjectPoolConfig<RpcConnection> = {
      name: config.name,
      factory: config.factory,
      maxSize: config.maxSize || 100,
      warmSize: config.warmSize || 0,
      reset: config.reset,
      validate: config.validate,
      onCreate: config.onCreate,
      onAcquire: (connection) => {
        connection.lastUsedAt = Date.now();
        connection.status = 'active';
        config.onAcquire?.(connection);
      },
      onRelease: (connection) => {
        connection.status = 'idle';
        connection.lastUsedAt = Date.now();
        config.onRelease?.(connection);
      },
      onDestroy: (connection) => {
        connection.close();
        config.onDestroy?.(connection);
      },
    };

    // Create the pool
    this.pool = new ObjectPool<RpcConnection>(poolConfig);

    // Register with the manager
    objectPoolManager.register(poolConfig);

    // Start health checks if enabled
    if (config.healthCheck !== false) {
      this.startHealthCheck();
    }
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
   * Execute an operation with automatic connection management
   */
  withBorrowed<R>(fn: (connection: RpcConnection) => R): R {
    return this.pool.withBorrowed(fn);
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
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }

  /**
   * Warm the pool (pre-create connections)
   */
  warm(count: number): void {
    this.pool.warm(count);
  }

  /**
   * Get the underlying ObjectPool
   */
  getPool(): ObjectPool<RpcConnection> {
    return this.pool;
  }

  /**
   * Start health checking
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000);
  }

  /**
   * Perform health check on the pool
   */
  private async performHealthCheck(): Promise<void> {
    const stats = this.pool.getStats();
    const totalConnections = stats.available + stats.borrowed;

    if (totalConnections === 0 && this.config.warmSize && this.config.warmSize > 0) {
      try {
        this.pool.warm(this.config.warmSize);
      } catch (error) {
        console.error(`Health check failed for pool "${this.config.name}":`, error);
      }
    }
  }
}

/**
 * Async RPC Connection Pool
 * Handles async connection creation with pre-warming
 */
export class AsyncRpcConnectionPool {
  public pool: ObjectPool<RpcConnection>; // Made public for access
  private config: RpcPoolConfig & { factory: () => RpcConnection };
  private healthCheckInterval?: ReturnType<typeof setInterval>;

  constructor(config: RpcPoolConfig & { factory: () => RpcConnection }) {
    this.config = config;

    const poolConfig: ObjectPoolConfig<RpcConnection> = {
      name: config.name,
      factory: config.factory,
      maxSize: config.maxSize || 100,
      warmSize: 0, // We'll warm manually
      reset: config.reset,
      validate: config.validate,
      onCreate: config.onCreate,
      onAcquire: (connection) => {
        connection.lastUsedAt = Date.now();
        connection.status = 'active';
        config.onAcquire?.(connection);
      },
      onRelease: (connection) => {
        connection.status = 'idle';
        connection.lastUsedAt = Date.now();
        config.onRelease?.(connection);
      },
      onDestroy: (connection) => {
        connection.close();
        config.onDestroy?.(connection);
      },
    };

    this.pool = new ObjectPool<RpcConnection>(poolConfig);
    objectPoolManager.register(poolConfig);

    // Note: warmAsync needs to be called externally
    // This is handled by the StellarRpcClientPool

    if (config.healthCheck !== false) {
      this.startHealthCheck();
    }
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
   * Execute an operation with automatic connection management
   */
  withBorrowed<R>(fn: (connection: RpcConnection) => R): R {
    return this.pool.withBorrowed(fn);
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
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }

  /**
   * Get the underlying ObjectPool
   */
  getPool(): ObjectPool<RpcConnection> {
    return this.pool;
  }

  /**
   * Start health checking
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000);
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    const stats = this.pool.getStats();
    const totalConnections = stats.available + stats.borrowed;

    if (totalConnections === 0 && this.config.warmSize && this.config.warmSize > 0) {
      console.warn(`Pool "${this.config.name}" is empty. Consider warming it.`);
    }
  }
}