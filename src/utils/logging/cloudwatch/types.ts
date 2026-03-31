export interface CloudWatchConfig {
  logGroupName: string;
  logStreamName?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  batchSize?: number;
  flushIntervalMs?: number;
  maxRetries?: number;
}

export interface LogEntry {
  timestamp: number;
  message: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  metadata?: Record<string, any>;
}
