import { MetricCounter, MetricGauge, MetricHistogram, MetricsSnapshot } from '../telemetry';

export class MetricsCollector {
  private counters: Map<string, MetricCounter> = new Map();
  private gauges: Map<string, MetricGauge> = new Map();
  private histograms: Map<string, MetricHistogram> = new Map();

  increment(name: string, tags: Record<string, string> = {}, value = 1): void {
    const key = this.key(name, tags);
    const existing = this.counters.get(key);
    if (existing) {
      existing.value += value;
    } else {
      this.counters.set(key, { name, value, tags });
    }
  }

  gauge(name: string, value: number, tags: Record<string, string> = {}): void {
    const key = this.key(name, tags);
    this.gauges.set(key, { name, value, tags });
  }

  observe(name: string, value: number, tags: Record<string, string> = {}, buckets: number[] = [1, 5, 10, 50, 100, 500, 1000]): void {
    const key = this.key(name, tags);
    const existing = this.histograms.get(key);
    if (existing) {
      existing.values.push(value);
    } else {
      this.histograms.set(key, { name, values: [value], tags, buckets });
    }
  }

  getCounter(name: string, tags: Record<string, string> = {}): MetricCounter | undefined {
    return this.counters.get(this.key(name, tags));
  }

  getGauge(name: string, tags: Record<string, string> = {}): MetricGauge | undefined {
    return this.gauges.get(this.key(name, tags));
  }

  snapshot(): MetricsSnapshot {
    return {
      timestamp: Date.now(),
      counters: [...this.counters.values()],
      gauges: [...this.gauges.values()],
      histograms: [...this.histograms.values()],
    };
  }

  clear(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  private key(name: string, tags: Record<string, string>): string {
    const tagStr = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => k + '=' + v)
      .join(',');
    return tagStr ? name + '[' + tagStr + ']' : name;
  }
}

export const metricsCollector = new MetricsCollector();

