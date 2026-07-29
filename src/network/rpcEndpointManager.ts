import { RpcHealthMonitor, RpcHealthCheckClient } from '../monitoring';

export type LoadBalancingPolicy = 'round-robin' | 'weighted' | 'least-latency' | 'primary-fallback';

export interface EndpointEntry {
  id: string;
  url: string;
  weight: number;
  priority: number;
  enabled: boolean;
}

export interface RpcEndpointManagerConfig {
  endpoints: {
    id?: string;
    url: string;
    weight?: number;
    priority?: number;
    rpcClient?: RpcHealthCheckClient;
  }[];
  policy?: LoadBalancingPolicy;
  healthCheck?: boolean;
  healthCheckIntervalMs?: number;
  unhealthyAfterFailures?: number;
  degradedLatencyMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RpcEndpointManager {
  private readonly entries: EndpointEntry[];
  private policy: LoadBalancingPolicy;
  private readonly monitor: RpcHealthMonitor | null;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private rrIndex = 0;

  constructor(config: RpcEndpointManagerConfig) {
    this.policy = config.policy ?? 'round-robin';
    this.maxRetries = config.maxRetries ?? 2;
    this.retryDelayMs = config.retryDelayMs ?? 100;

    this.entries = config.endpoints.map((ep, i) => ({
      id: ep.id ?? ep.url,
      url: ep.url,
      weight: ep.weight ?? 1,
      priority: ep.priority ?? i,
      enabled: true,
    }));

    if (config.healthCheck !== false) {
      this.monitor = new RpcHealthMonitor({
        endpoints: config.endpoints.map((ep) => ({
          id: ep.id ?? ep.url,
          url: ep.url,
          rpcClient: ep.rpcClient,
        })),
        intervalMs: config.healthCheckIntervalMs ?? 30_000,
        unhealthyAfterFailures: config.unhealthyAfterFailures ?? 2,
        degradedLatencyMs: config.degradedLatencyMs ?? 1_500,
      });
    } else {
      this.monitor = null;
    }
  }

  start(): void {
    this.monitor?.start();
  }

  stop(): void {
    this.monitor?.stop();
  }

  private healthState(id: string): string {
    return this.monitor?.getEndpointStatus(id)?.state ?? 'unknown';
  }

  private candidates(skipped = new Set<string>()): EndpointEntry[] {
    const enabled = this.entries.filter((e) => e.enabled && !skipped.has(e.id));
    const nonUnhealthy = enabled.filter((e) => this.healthState(e.id) !== 'unhealthy');
    return nonUnhealthy.length > 0 ? nonUnhealthy : [];
  }

  private pick(pool: EndpointEntry[]): EndpointEntry {
    switch (this.policy) {
      case 'round-robin': {
        const entry = pool[this.rrIndex % pool.length];
        this.rrIndex++;
        return entry;
      }
      case 'weighted': {
        const total = pool.reduce((s, e) => s + e.weight, 0);
        let rand = Math.random() * total;
        for (let i = 0; i < pool.length - 1; i++) {
          rand -= pool[i].weight;
          if (rand <= 0) return pool[i];
        }
        return pool[pool.length - 1];
      }
      case 'least-latency': {
        const withData = pool.filter(
          (e) => this.monitor?.getEndpointStatus(e.id)?.metrics.averageLatencyMs !== undefined
        );
        if (withData.length === 0) return pool[0];
        return withData.reduce((best, curr) => {
          const bMs =
            this.monitor?.getEndpointStatus(best.id)?.metrics.averageLatencyMs ?? Infinity;
          const cMs =
            this.monitor?.getEndpointStatus(curr.id)?.metrics.averageLatencyMs ?? Infinity;
          return cMs < bMs ? curr : best;
        });
      }
      case 'primary-fallback': {
        return [...pool].sort((a, b) => a.priority - b.priority)[0];
      }
    }
  }

  getActiveEndpoint(): EndpointEntry | null {
    const pool = this.candidates();
    return pool.length === 0 ? null : this.pick(pool);
  }

  async execute<T>(fn: (url: string) => Promise<T>): Promise<T> {
    const skipped = new Set<string>();
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const pool = this.candidates(skipped);
      if (pool.length === 0) break;

      const endpoint = this.pick(pool);
      try {
        return await fn(endpoint.url);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        skipped.add(endpoint.id);
        if (attempt < this.maxRetries) {
          await sleep(this.retryDelayMs);
        }
      }
    }

    throw lastError ?? new Error('No available endpoints');
  }

  getStatus(): {
    policy: LoadBalancingPolicy;
    endpoints: (EndpointEntry & { healthState: string; available: boolean })[];
  } {
    return {
      policy: this.policy,
      endpoints: this.entries.map((entry) => {
        const hs = this.monitor?.getEndpointStatus(entry.id);
        return {
          ...entry,
          healthState: hs?.state ?? 'unknown',
          available: hs?.available ?? true,
        };
      }),
    };
  }

  setPolicy(policy: LoadBalancingPolicy): void {
    this.policy = policy;
    this.rrIndex = 0;
  }

  enableEndpoint(id: string): void {
    const entry = this.entries.find((e) => e.id === id);
    if (entry) entry.enabled = true;
  }

  disableEndpoint(id: string): void {
    const entry = this.entries.find((e) => e.id === id);
    if (entry) entry.enabled = false;
  }
}
