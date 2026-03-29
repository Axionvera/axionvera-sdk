export interface ConcurrencyConfig {
  maxConcurrentRequests: number;
  queueTimeout?: number; // Maximum time a request can wait in queue (ms)
  enableThrottling?: boolean; // Enable request throttling
  throttleRate?: number; // Requests per second when throttling is enabled
  throttleInterval?: number; // Interval in ms for throttling (default: 1000)
}

export interface QueuedRequest<T> {
  id: string;
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: any) => void;
  timestamp: number;
  timeoutId?: ReturnType<typeof setTimeout>;
}

export class ConcurrencyQueue {
  private activeRequests = 0;
  private queue: QueuedRequest<any>[] = [];
  private config: ConcurrencyConfig;
  private throttleTimer: ReturnType<typeof setTimeout> | null = null;
  private requestsInCurrentInterval = 0;
  private lastThrottleReset = Date.now();

  constructor(config: ConcurrencyConfig) {
    this.config = {
      queueTimeout: 30000, // 30 seconds default timeout
      enableThrottling: false,
      throttleRate: 10, // 10 requests per second
      throttleInterval: 1000, // 1 second interval
      ...config
    };
  }

  /**
   * Execute a request with concurrency control
   */
  async execute<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const requestId = this.generateRequestId();
      const queuedRequest: QueuedRequest<T> = {
        id: requestId,
        execute: requestFn,
        resolve,
        reject,
        timestamp: Date.now()
      };

      // Set up queue timeout if specified
      if (this.config.queueTimeout) {
        queuedRequest.timeoutId = setTimeout(() => {
          this.removeFromQueue(requestId);
          reject(new Error(`Request timed out in queue after ${this.config.queueTimeout}ms`));
        }, this.config.queueTimeout);
      }

      this.queue.push(queuedRequest);
      this.processQueue();
    });
  }

  /**
   * Process the queue and execute requests up to the concurrency limit
   */
  private async processQueue(): Promise<void> {
    // Check if throttling is enabled and we've exceeded the rate limit
    if (this.config.enableThrottling && this.isThrottled()) {
      this.scheduleNextProcess();
      return;
    }

    while (this.activeRequests < this.config.maxConcurrentRequests && this.queue.length > 0) {
      const queuedRequest = this.queue.shift();
      if (!queuedRequest) break;

      // Clear the timeout since the request is now being processed
      if (queuedRequest.timeoutId) {
        clearTimeout(queuedRequest.timeoutId);
      }

      this.activeRequests++;
      this.requestsInCurrentInterval++;

      // Execute the request asynchronously
      this.executeRequest(queuedRequest);
    }
  }

  /**
   * Check if throttling limit has been reached
   */
  private isThrottled(): boolean {
    const now = Date.now();
    
    // Reset counter if interval has passed
    if (now - this.lastThrottleReset >= this.config.throttleInterval!) {
      this.requestsInCurrentInterval = 0;
      this.lastThrottleReset = now;
      return false;
    }

    return this.requestsInCurrentInterval >= this.config.throttleRate!;
  }

  /**
   * Schedule next queue processing when throttling allows
   */
  private scheduleNextProcess(): void {
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
    }

    const timeUntilNextInterval = this.config.throttleInterval! - (Date.now() - this.lastThrottleReset);
    
    this.throttleTimer = setTimeout(() => {
      this.throttleTimer = null;
      this.processQueue();
    }, Math.max(0, timeUntilNextInterval));
  }

  /**
   * Execute a single request
   */
  private async executeRequest<T>(queuedRequest: QueuedRequest<T>): Promise<void> {
    try {
      const result = await queuedRequest.execute();
      queuedRequest.resolve(result);
    } catch (error) {
      queuedRequest.reject(error);
    } finally {
      this.activeRequests--;
      // Process next requests in queue
      this.processQueue();
    }
  }

  /**
   * Remove a request from the queue by ID
   */
  private removeFromQueue(requestId: string): void {
    const index = this.queue.findIndex(req => req.id === requestId);
    if (index !== -1) {
      const [removed] = this.queue.splice(index, 1);
      if (removed.timeoutId) {
        clearTimeout(removed.timeoutId);
      }
    }
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current queue statistics
   */
  getStats() {
    return {
      activeRequests: this.activeRequests,
      queuedRequests: this.queue.length,
      maxConcurrentRequests: this.config.maxConcurrentRequests,
      queueTimeout: this.config.queueTimeout,
      throttleEnabled: this.config.enableThrottling,
      throttleRate: this.config.throttleRate,
      throttleInterval: this.config.throttleInterval,
      requestsInCurrentInterval: this.requestsInCurrentInterval,
      timeUntilNextThrottleReset: Math.max(0, this.config.throttleInterval! - (Date.now() - this.lastThrottleReset)),
      queueTimestamps: this.queue.map(req => req.timestamp)
    };
  }

  /**
   * Get queue status for monitoring
   */
  getQueueStatus() {
    const stats = this.getStats();
    const oldestRequest = this.queue.length > 0 ? Date.now() - Math.min(...this.queue.map(req => req.timestamp)) : 0;
    
    return {
      ...stats,
      oldestRequestWaitTime: oldestRequest,
      averageWaitTime: this.queue.length > 0 ? this.queue.reduce((sum, req) => sum + (Date.now() - req.timestamp), 0) / this.queue.length : 0,
      isThrottled: this.config.enableThrottling ? this.isThrottled() : false,
      utilizationRate: (stats.activeRequests / stats.maxConcurrentRequests) * 100
    };
  }

  /**
   * Clear all queued requests (useful for cleanup)
   */
  clearQueue(): void {
    // Clear throttle timer
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }

    this.queue.forEach(request => {
      if (request.timeoutId) {
        clearTimeout(request.timeoutId);
      }
      request.reject(new Error('Request cancelled due to queue clearance'));
    });
    this.queue = [];
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ConcurrencyConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Destroy the queue and cleanup resources
   */
  destroy(): void {
    this.clearQueue();
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }
  }
}

/**
 * Create a wrapped HTTP client with concurrency control
 */
export function createConcurrencyControlledClient<T extends object>(
  baseClient: T,
  config: ConcurrencyConfig
): T {
  const queue = new ConcurrencyQueue(config);

  // Create a proxy that intercepts method calls
  return new Proxy(baseClient, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      // If it's a function, wrap it with concurrency control
      if (typeof value === 'function') {
        return function (...args: any[]) {
          return queue.execute(() => value.apply(target, args));
        };
      }

      return value;
    }
  });
}

/**
 * Default concurrency configuration
 */
export const DEFAULT_CONCURRENCY_CONFIG: ConcurrencyConfig = {
  maxConcurrentRequests: 5,
  queueTimeout: 30000
};
