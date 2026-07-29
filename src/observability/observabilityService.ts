import { Logger, CustomLogger } from '../utils';
import { Tracer } from './tracer';
import { DiagnosticsManager } from '../diagnostics';
import { ObservabilityConfig, DEFAULT_OBSERVABILITY_CONFIG, DiagnosticsReport, TraceSpan } from './types';

export class ObservabilityService {
  readonly logger: Logger;
  readonly tracer: Tracer;
  readonly diagnostics: DiagnosticsManager;
  private config: ObservabilityConfig;

  constructor(config?: Partial<ObservabilityConfig>, customLogger?: CustomLogger) {
    this.config = { ...DEFAULT_OBSERVABILITY_CONFIG, ...config };
    this.logger = new Logger(this.config.logLevel, undefined, customLogger);
    this.tracer = new Tracer(this.config.traceLevel, this.config.maxSpans);
    this.diagnostics = new DiagnosticsManager(this.config.diagnosticsEnabled, this.config.maxDiagnosticEvents);
  }

  updateConfig(updates: Partial<ObservabilityConfig>): void {
    this.config = { ...this.config, ...updates };

    if (updates.logLevel !== undefined) {
      this.logger.setLevel(updates.logLevel);
    }
    if (updates.traceLevel !== undefined) {
      this.tracer.setLevel(updates.traceLevel);
    }
    if (updates.diagnosticsEnabled !== undefined) {
      this.diagnostics.setEnabled(updates.diagnosticsEnabled);
    }
  }

  getConfig(): ObservabilityConfig {
    return { ...this.config };
  }

  getDiagnosticsReport(): DiagnosticsReport {
    return this.diagnostics.generateReport();
  }

  getTraces(): TraceSpan[] {
    return this.tracer.getAllSpans();
  }

  getActiveTraces(): TraceSpan[] {
    return this.tracer.getActiveSpans();
  }

  clear(): void {
    this.tracer.clear();
    this.diagnostics.clear();
  }
}

export const observabilityService = new ObservabilityService();
