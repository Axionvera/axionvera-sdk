export type RequestPriority = 'low' | 'normal' | 'high' | 'critical' | number;

export interface RequestSchedulerConfig {
  maxConcurrentRequests: number;
  queueTimeout?: number;
  defaultPriority?: RequestPriority;
  agingInterval?: number;
  agingBoost?: number;
}

export interface ScheduledRequestOptions {
  id?: string;
  priority?: RequestPriority;
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
}

export interface ScheduledRequestSnapshot {
  id: string;
  priority: number;
  effectivePriority: number;
  enqueuedAt: number;
  waitTime: number;
  metadata?: Record<string, unknown>;
}

export interface RequestSchedulerStats {
  activeRequests: number;
  queuedRequests: number;
  maxConcurrentRequests: number;
  queueTimeout?: number;
  defaultPriority: number;
  agingInterval: number;
  agingBoost: number;
}

interface ScheduledRequest {
  id: string;
  execute: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  priority: number;
  enqueuedAt: number;
  sequence: number;
  timeoutId?: ReturnType<typeof setTimeout>;
  signal?: AbortSignal;
  abortListener?: () => void;
  metadata?: Record<string, unknown>;
}

const PRIORITY_VALUES: Record<Exclude<RequestPriority, number>, number> = {
  low: 0,
  normal: 10,
  high: 20,
  critical: 30,
};

export class RequestCancelledError extends Error {
  constructor(message = 'Scheduled request was cancelled') {
    super(message);
    this.name = 'RequestCancelledError';
  }
}

export class RequestScheduler {
  private activeRequests = 0;
  private queue: ScheduledRequest[] = [];
  private readonly config: Required<Omit<RequestSchedulerConfig, 'queueTimeout'>> &
    Pick<RequestSchedulerConfig, 'queueTimeout'>;
  private sequence = 0;
  private destroyed = false;

  constructor(config: RequestSchedulerConfig) {
    if (config.maxConcurrentRequests < 1) {
      throw new Error('maxConcurrentRequests must be at least 1');
    }

    if (config.agingInterval !== undefined && config.agingInterval < 1) {
      throw new Error('agingInterval must be at least 1');
    }

    this.config = {
      queueTimeout: config.queueTimeout,
      defaultPriority: config.defaultPriority ?? 'normal',
      agingInterval: config.agingInterval ?? 5000,
      agingBoost: config.agingBoost ?? 1,
      maxConcurrentRequests: config.maxConcurrentRequests,
    };
  }

  schedule<T>(operation: () => Promise<T>, options: ScheduledRequestOptions = {}): Promise<T> {
    if (this.destroyed) {
      return Promise.reject(new RequestCancelledError('RequestScheduler has been destroyed'));
    }

    if (options.signal?.aborted) {
      return Promise.reject(
        new RequestCancelledError('Scheduled request was aborted before enqueue')
      );
    }

    return new Promise<T>((resolve, reject) => {
      const request: ScheduledRequest = {
        id: options.id ?? this.generateRequestId(),
        execute: operation,
        resolve: resolve as (value: unknown) => void,
        reject,
        priority: this.normalizePriority(options.priority ?? this.config.defaultPriority),
        enqueuedAt: Date.now(),
        sequence: this.sequence++,
        signal: options.signal,
        metadata: options.metadata,
      };

      const queueTimeout = this.config.queueTimeout;
      if (queueTimeout) {
        request.timeoutId = setTimeout(() => {
          this.removeQueuedRequest(
            request.id,
            new Error(`Scheduled request timed out in queue after ${String(queueTimeout)}ms`)
          );
        }, queueTimeout);
      }

      if (request.signal) {
        request.abortListener = () => {
          this.removeQueuedRequest(
            request.id,
            new RequestCancelledError('Scheduled request was aborted')
          );
        };
        request.signal.addEventListener('abort', request.abortListener, { once: true });
      }

      this.queue.push(request);
      this.processQueue();
    });
  }

  cancel(requestId: string, reason = 'Scheduled request was cancelled'): boolean {
    return this.removeQueuedRequest(requestId, new RequestCancelledError(reason));
  }

  clearQueue(reason = 'Scheduled request cancelled due to scheduler queue clearance'): void {
    const queued = [...this.queue];
    this.queue = [];

    queued.forEach((request) => {
      this.rejectQueuedRequest(request, new RequestCancelledError(reason));
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.clearQueue('RequestScheduler has been destroyed');
  }

  getStats(): RequestSchedulerStats {
    return {
      activeRequests: this.activeRequests,
      queuedRequests: this.queue.length,
      maxConcurrentRequests: this.config.maxConcurrentRequests,
      queueTimeout: this.config.queueTimeout,
      defaultPriority: this.normalizePriority(this.config.defaultPriority),
      agingInterval: this.config.agingInterval,
      agingBoost: this.config.agingBoost,
    };
  }

  getQueueSnapshot(): ScheduledRequestSnapshot[] {
    const now = Date.now();

    return this.queue
      .map((request) => ({
        id: request.id,
        priority: request.priority,
        effectivePriority: this.getEffectivePriority(request, now),
        enqueuedAt: request.enqueuedAt,
        waitTime: now - request.enqueuedAt,
        metadata: request.metadata,
      }))
      .sort((a, b) => b.effectivePriority - a.effectivePriority || a.enqueuedAt - b.enqueuedAt);
  }

  private processQueue(): void {
    while (this.activeRequests < this.config.maxConcurrentRequests && this.queue.length > 0) {
      const next = this.dequeueNextRequest();
      if (!next) {
        return;
      }

      this.startRequest(next);
    }
  }

  private dequeueNextRequest(): ScheduledRequest | undefined {
    const now = Date.now();
    let bestIndex = 0;
    let bestRequest = this.queue[0];

    for (let index = 1; index < this.queue.length; index++) {
      const candidate = this.queue[index];
      if (this.compareRequests(candidate, bestRequest, now) < 0) {
        bestIndex = index;
        bestRequest = candidate;
      }
    }

    const [request] = this.queue.splice(bestIndex, 1);
    this.cleanupQueuedRequest(request);
    return request;
  }

  private startRequest(request: ScheduledRequest): void {
    this.activeRequests++;

    Promise.resolve()
      .then(() => request.execute())
      .then(request.resolve, request.reject)
      .finally(() => {
        this.activeRequests--;
        this.processQueue();
      });
  }

  private compareRequests(left: ScheduledRequest, right: ScheduledRequest, now: number): number {
    const priorityDiff =
      this.getEffectivePriority(right, now) - this.getEffectivePriority(left, now);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return left.sequence - right.sequence;
  }

  private getEffectivePriority(request: ScheduledRequest, now = Date.now()): number {
    const agingSteps = Math.floor((now - request.enqueuedAt) / this.config.agingInterval);
    return request.priority + agingSteps * this.config.agingBoost;
  }

  private removeQueuedRequest(requestId: string, reason: unknown): boolean {
    const index = this.queue.findIndex((request) => request.id === requestId);
    if (index === -1) {
      return false;
    }

    const [request] = this.queue.splice(index, 1);
    this.rejectQueuedRequest(request, reason);
    return true;
  }

  private rejectQueuedRequest(request: ScheduledRequest, reason: unknown): void {
    this.cleanupQueuedRequest(request);
    request.reject(reason);
  }

  private cleanupQueuedRequest(request: ScheduledRequest): void {
    if (request.timeoutId) {
      clearTimeout(request.timeoutId);
    }

    if (request.signal && request.abortListener) {
      request.signal.removeEventListener('abort', request.abortListener);
    }
  }

  private normalizePriority(priority: RequestPriority): number {
    if (typeof priority === 'number') {
      return priority;
    }

    return PRIORITY_VALUES[priority];
  }

  private generateRequestId(): string {
    return `sched_${String(Date.now())}_${Math.random().toString(36).slice(2, 11)}`;
  }
}

export function createScheduledClient<T extends object>(
  baseClient: T,
  scheduler: RequestScheduler,
  priorities: Partial<Record<keyof T & string, RequestPriority>> = {}
): T {
  const methodPriorities = priorities as Record<string, RequestPriority | undefined>;

  return new Proxy(baseClient, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver) as unknown;

      if (typeof value !== 'function' || typeof prop !== 'string') {
        return value;
      }

      const method = value as (...args: unknown[]) => unknown;

      return (...args: unknown[]) =>
        scheduler.schedule(() => Promise.resolve(method.apply(target, args)), {
          priority: methodPriorities[prop],
          metadata: { method: prop },
        });
    },
  });
}

export const DEFAULT_REQUEST_SCHEDULER_CONFIG: RequestSchedulerConfig = {
  maxConcurrentRequests: 5,
  queueTimeout: 30000,
  defaultPriority: 'normal',
  agingInterval: 5000,
  agingBoost: 1,
};
