import { DiagnosticEvent, DiagnosticsReport } from '../observability';

export class DiagnosticsManager {
  private events: DiagnosticEvent[] = [];
  private maxEvents: number;
  private enabled: boolean;
  private listeners: Set<(event: DiagnosticEvent) => void> = new Set();
  private eventCounter = 0;

  constructor(enabled = false, maxEvents = 500) {
    this.enabled = enabled;
    this.maxEvents = maxEvents;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  record(type: string, data: Record<string, any> = {}): void {
    if (!this.enabled) return;

    this.eventCounter++;
    const event: DiagnosticEvent = {
      id: `diag_${this.eventCounter}`,
      type,
      timestamp: Date.now(),
      data,
    };

    this.events.push(event);

    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {}
    }
  }

  onDiagnosticEvent(callback: (event: DiagnosticEvent) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  getEvents(filter?: { type?: string; since?: number }): DiagnosticEvent[] {
    let filtered = [...this.events];

    if (filter?.type) {
      filtered = filtered.filter((e) => e.type === filter.type);
    }
    if (filter?.since) {
      filtered = filtered.filter((e) => e.timestamp >= filter.since);
    }

    return filtered;
  }

  generateReport(): DiagnosticsReport {
    const byType: Record<string, number> = {};
    let errors = 0;
    let warnings = 0;

    for (const event of this.events) {
      byType[event.type] = (byType[event.type] ?? 0) + 1;
      if (event.type.startsWith('error')) errors++;
      if (event.type.startsWith('warn')) warnings++;
    }

    return {
      timestamp: Date.now(),
      events: this.events,
      summary: {
        totalEvents: this.events.length,
        byType,
        errors,
        warnings,
      },
    };
  }

  clear(): void {
    this.events = [];
  }

  getEventCount(): number {
    return this.events.length;
  }
}
