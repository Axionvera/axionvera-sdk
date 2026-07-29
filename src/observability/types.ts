import type { LogLevel } from '../utils';

export type TraceLevel = 'off' | 'error' | 'warn' | 'info' | 'debug';

export interface TraceSpan {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, string>;
  parentId?: string;
}

export interface DiagnosticEvent {
  id: string;
  type: string;
  timestamp: number;
  data: Record<string, any>;
}

export interface ObservabilityConfig {
  logLevel: LogLevel;
  traceLevel: TraceLevel;
  diagnosticsEnabled: boolean;
  traceEnabled: boolean;
  /** Max number of spans to keep in memory */
  maxSpans: number;
  /** Max number of diagnostic events to keep */
  maxDiagnosticEvents: number;
}

export const DEFAULT_OBSERVABILITY_CONFIG: ObservabilityConfig = {
  logLevel: 'none',
  traceLevel: 'off',
  diagnosticsEnabled: false,
  traceEnabled: false,
  maxSpans: 100,
  maxDiagnosticEvents: 500,
};

export interface DiagnosticsReport {
  timestamp: number;
  events: DiagnosticEvent[];
  summary: {
    totalEvents: number;
    byType: Record<string, number>;
    errors: number;
    warnings: number;
  };
}
