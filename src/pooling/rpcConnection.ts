/**
 * RPC Connection interface and implementation
 */

export interface RpcConnection {
  /** Unique connection ID */
  id: string;

  /** The actual RPC client instance */
  client: any;

  /** Timestamp when connection was created */
  createdAt: number;

  /** Timestamp of last use */
  lastUsedAt: number;

  /** Connection status */
  status: 'idle' | 'active' | 'stale' | 'error' | 'closed';

  /** Check if connection is healthy */
  isHealthy(): Promise<boolean>;

  /** Perform a health check */
  healthCheck(): Promise<boolean>;

  /** Close the connection */
  close(): Promise<void>;

  /** Reset the connection if needed */
  reset(): Promise<void>;

  /** Get connection info for debugging */
  getInfo(): Record<string, any>;
}

/**
 * Default RPC Connection implementation
 */
export class DefaultRpcConnection implements RpcConnection {
  public readonly id: string;
  public readonly client: any;
  public readonly createdAt: number;
  public lastUsedAt: number;
  public status: 'idle' | 'active' | 'stale' | 'error' | 'closed' = 'idle';

  constructor(client: any, options?: { id?: string }) {
    this.id = options?.id || `rpc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.client = client;
    this.createdAt = Date.now();
    this.lastUsedAt = Date.now();
  }

  async isHealthy(): Promise<boolean> {
    try {
      return await this.healthCheck();
    } catch {
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // If the client has a health check method, use it
      if (this.client && typeof this.client.healthCheck === 'function') {
        return await this.client.healthCheck();
      }

      // For Stellar RPC, we could check if it can make a simple request
      // For now, assume healthy if client exists and status is not error
      return this.status !== 'error' && this.status !== 'closed' && !!this.client;
    } catch (error) {
      this.status = 'error';
      return false;
    }
  }

  async close(): Promise<void> {
    try {
      if (this.client && typeof this.client.close === 'function') {
        await this.client.close();
      }
    } catch (error) {
      console.error(`Error closing RPC connection ${this.id}:`, error);
    } finally {
      this.status = 'closed';
    }
  }

  async reset(): Promise<void> {
    try {
      if (this.client && typeof this.client.reset === 'function') {
        await this.client.reset();
      }
      this.status = 'idle';
      this.lastUsedAt = Date.now();
    } catch (error) {
      this.status = 'error';
      throw error;
    }
  }

  getInfo(): Record<string, any> {
    return {
      id: this.id,
      createdAt: this.createdAt,
      lastUsedAt: this.lastUsedAt,
      status: this.status,
      age: Date.now() - this.createdAt,
      idleTime: Date.now() - this.lastUsedAt,
    };
  }
}