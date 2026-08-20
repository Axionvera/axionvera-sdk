import { rpc } from "@stellar/stellar-sdk";

import { AxionveraNetwork } from "../utils/networkConfig";

export type EndpointHealthState = "unknown" | "healthy" | "degraded" | "unhealthy";

export type RpcHealthResponse = {
  status?: string;
  version?: string;
};

export type RpcHealthCheckClient = {
  getHealth: () => Promise<RpcHealthResponse>;
};

export type RpcEndpointConfig = {
  /** Stable endpoint identifier used in reports. Defaults to the URL. */
  id?: string | undefined;
  /** RPC endpoint URL. */
  url: string;
  /** Optional network label for reporting. */
  network?: AxionveraNetwork | undefined;
  /** Optional prebuilt RPC client, useful for tests or shared SDK clients. */
  rpcClient?: RpcHealthCheckClient | undefined;
  /** Allows http:// endpoints when creating a monitor-owned RPC client. */
  allowHttp?: boolean | undefined;
};

export type RpcHealthMonitorConfig = {
  /** Endpoints to monitor. */
  endpoints: RpcEndpointConfig[];
  /** Time between automatic checks. Defaults to 30 seconds. */
  intervalMs?: number | undefined;
  /** Per-endpoint health check timeout. Defaults to 5 seconds. */
  timeoutMs?: number | undefined;
  /** Latency above this threshold marks a successful endpoint as degraded. */
  degradedLatencyMs?: number | undefined;
  /** Failed checks required before an endpoint becomes unhealthy. */
  unhealthyAfterFailures?: number | undefined;
  /** Start the interval immediately after construction. Defaults to false. */
  autoStart?: boolean | undefined;
};

export type RpcEndpointMetrics = {
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  consecutiveFailures: number;
  lastLatencyMs?: number | undefined;
  averageLatencyMs?: number | undefined;
  minLatencyMs?: number | undefined;
  maxLatencyMs?: number | undefined;
  availabilityPercentage: number;
};

export type RpcEndpointStatus = {
  id: string;
  url: string;
  network?: AxionveraNetwork | undefined;
  state: EndpointHealthState;
  available: boolean;
  checkedAt?: Date | undefined;
  error?: string | undefined;
  response?: RpcHealthResponse | undefined;
  metrics: RpcEndpointMetrics;
};

export type RpcHealthStatusReport = {
  generatedAt: Date;
  running: boolean;
  intervalMs: number;
  timeoutMs: number;
  endpoints: RpcEndpointStatus[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    unknown: number;
    available: number;
  };
};

type InternalEndpoint = Required<Pick<RpcEndpointConfig, "id" | "url">> &
  Omit<RpcEndpointConfig, "id" | "url"> & {
    client: RpcHealthCheckClient;
    status: RpcEndpointStatus;
    latencySamples: number[];
  };

const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_DEGRADED_LATENCY_MS = 1_500;
const DEFAULT_UNHEALTHY_AFTER_FAILURES = 2;

function createDefaultMetrics(): RpcEndpointMetrics {
  return {
    totalChecks: 0,
    successfulChecks: 0,
    failedChecks: 0,
    consecutiveFailures: 0,
    availabilityPercentage: 0
  };
}

function cloneStatus(status: RpcEndpointStatus): RpcEndpointStatus {
  return {
    ...status,
    checkedAt: status.checkedAt ? new Date(status.checkedAt) : undefined,
    metrics: { ...status.metrics },
    response: status.response ? { ...status.response } : undefined
  };
}

function createRpcClient(endpoint: RpcEndpointConfig): RpcHealthCheckClient {
  if (endpoint.rpcClient) {
    return endpoint.rpcClient;
  }

  const allowHttp = endpoint.allowHttp ?? endpoint.url.startsWith("http://");
  return new rpc.Server(endpoint.url, { allowHttp });
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`RPC health check timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

/**
 * Continuously evaluates RPC endpoint health, availability, and latency.
 */
export class RpcHealthMonitor {
  readonly intervalMs: number;
  readonly timeoutMs: number;
  readonly degradedLatencyMs: number;
  readonly unhealthyAfterFailures: number;

  private readonly endpoints: InternalEndpoint[];
  private intervalHandle: ReturnType<typeof setInterval> | undefined;
  private checkInProgress = false;

  constructor(config: RpcHealthMonitorConfig) {
    if (config.endpoints.length === 0) {
      throw new Error("RpcHealthMonitor requires at least one endpoint");
    }

    this.intervalMs = config.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.degradedLatencyMs = config.degradedLatencyMs ?? DEFAULT_DEGRADED_LATENCY_MS;
    this.unhealthyAfterFailures =
      config.unhealthyAfterFailures ?? DEFAULT_UNHEALTHY_AFTER_FAILURES;

    this.endpoints = config.endpoints.map((endpoint) => {
      const id = endpoint.id ?? endpoint.url;
      const metrics = createDefaultMetrics();

      return {
        ...endpoint,
        id,
        client: createRpcClient(endpoint),
        latencySamples: [],
        status: {
          id,
          url: endpoint.url,
          network: endpoint.network,
          state: "unknown",
          available: false,
          metrics
        }
      };
    });

    if (config.autoStart) {
      this.start();
    }
  }

  get running(): boolean {
    return this.intervalHandle !== undefined;
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.intervalHandle = setInterval(() => {
      void this.runHealthChecks();
    }, this.intervalMs);

    void this.runHealthChecks();
  }

  stop(): void {
    if (!this.intervalHandle) {
      return;
    }

    clearInterval(this.intervalHandle);
    this.intervalHandle = undefined;
  }

  async runHealthChecks(): Promise<RpcEndpointStatus[]> {
    if (this.checkInProgress) {
      return this.getEndpointStatuses();
    }

    this.checkInProgress = true;

    try {
      const statuses = await Promise.all(
        this.endpoints.map((endpoint) => this.checkEndpoint(endpoint))
      );
      return statuses.map(cloneStatus);
    } finally {
      this.checkInProgress = false;
    }
  }

  getEndpointStatus(endpointIdOrUrl: string): RpcEndpointStatus | undefined {
    const endpoint = this.endpoints.find(
      (candidate) => candidate.id === endpointIdOrUrl || candidate.url === endpointIdOrUrl
    );

    return endpoint ? cloneStatus(endpoint.status) : undefined;
  }

  getEndpointStatuses(): RpcEndpointStatus[] {
    return this.endpoints.map((endpoint) => cloneStatus(endpoint.status));
  }

  getHealthReport(): RpcHealthStatusReport {
    const endpoints = this.getEndpointStatuses();
    const summary = endpoints.reduce(
      (accumulator, endpoint) => {
        accumulator.total += 1;
        accumulator[endpoint.state] += 1;
        if (endpoint.available) {
          accumulator.available += 1;
        }
        return accumulator;
      },
      {
        total: 0,
        healthy: 0,
        degraded: 0,
        unhealthy: 0,
        unknown: 0,
        available: 0
      }
    );

    return {
      generatedAt: new Date(),
      running: this.running,
      intervalMs: this.intervalMs,
      timeoutMs: this.timeoutMs,
      endpoints,
      summary
    };
  }

  private async checkEndpoint(endpoint: InternalEndpoint): Promise<RpcEndpointStatus> {
    const startedAt = Date.now();

    try {
      const response = await withTimeout(endpoint.client.getHealth(), this.timeoutMs);
      const latencyMs = Date.now() - startedAt;
      const responseStatus = response.status?.toLowerCase();
      const healthyResponse = responseStatus === undefined || responseStatus === "healthy";
      const state: EndpointHealthState = healthyResponse
        ? latencyMs > this.degradedLatencyMs
          ? "degraded"
          : "healthy"
        : "unhealthy";

      this.recordSuccess(endpoint, latencyMs, state, response);
    } catch (error) {
      this.recordFailure(
        endpoint,
        error instanceof Error ? error.message : "RPC health check failed"
      );
    }

    return cloneStatus(endpoint.status);
  }

  private recordSuccess(
    endpoint: InternalEndpoint,
    latencyMs: number,
    state: EndpointHealthState,
    response: RpcHealthResponse
  ): void {
    endpoint.latencySamples.push(latencyMs);

    const metrics = endpoint.status.metrics;
    metrics.totalChecks += 1;
    metrics.successfulChecks += 1;
    metrics.consecutiveFailures = 0;
    metrics.lastLatencyMs = latencyMs;
    metrics.minLatencyMs =
      metrics.minLatencyMs === undefined ? latencyMs : Math.min(metrics.minLatencyMs, latencyMs);
    metrics.maxLatencyMs =
      metrics.maxLatencyMs === undefined ? latencyMs : Math.max(metrics.maxLatencyMs, latencyMs);
    metrics.averageLatencyMs =
      endpoint.latencySamples.reduce((sum, sample) => sum + sample, 0) /
      endpoint.latencySamples.length;
    metrics.availabilityPercentage = (metrics.successfulChecks / metrics.totalChecks) * 100;

    endpoint.status = {
      ...endpoint.status,
      state,
      available: state !== "unhealthy",
      checkedAt: new Date(),
      error: undefined,
      response,
      metrics
    };
  }

  private recordFailure(endpoint: InternalEndpoint, error: string): void {
    const metrics = endpoint.status.metrics;
    metrics.totalChecks += 1;
    metrics.failedChecks += 1;
    metrics.consecutiveFailures += 1;
    metrics.availabilityPercentage = (metrics.successfulChecks / metrics.totalChecks) * 100;

    endpoint.status = {
      ...endpoint.status,
      state:
        metrics.consecutiveFailures >= this.unhealthyAfterFailures ? "unhealthy" : "degraded",
      available: false,
      checkedAt: new Date(),
      error,
      response: undefined,
      metrics
    };
  }
}
