import { CloudWatchConfig, LogEntry } from './types';

interface CloudWatchLogsClient {
  createLogGroup(params: any): Promise<any>;
  createLogStream(params: any): Promise<any>;
  putLogEvents(params: any): Promise<any>;
}

export class CloudWatchLogger {
  private client: CloudWatchLogsClient | null = null;
  private logQueue: LogEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private sequenceToken: string | null = null;
  private isInitialized = false;
  private isDestroyed = false;

  private readonly config: Required<CloudWatchConfig>;

  constructor(config: CloudWatchConfig) {
    this.config = {
      logGroupName: config.logGroupName,
      logStreamName: config.logStreamName || `axionvera-sdk-${Date.now()}`,
      region: config.region || 'us-east-1',
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      batchSize: config.batchSize || 100,
      flushIntervalMs: config.flushIntervalMs || 5000,
      maxRetries: config.maxRetries || 3,
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized || this.isDestroyed) return;

    try {
      // Lazy load CloudWatch client
      const { CloudWatchLogsClient } = await import('@aws-sdk/client-cloudwatch-logs');
      
      const clientConfig: any = {
        region: this.config.region,
      };

      if (this.config.accessKeyId && this.config.secretAccessKey) {
        clientConfig.credentials = {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        };
      }

      this.client = new CloudWatchLogsClient(clientConfig);

      // Ensure log group exists
      await this.ensureLogGroup();

      // Ensure log stream exists
      await this.ensureLogStream();

      // Start flush timer
      this.startFlushTimer();

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize CloudWatch logger:', error);
      throw error;
    }
  }

  async log(entry: LogEntry): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.logQueue.push(entry);

    // Flush immediately if queue is full
    if (this.logQueue.length >= this.config.batchSize) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (!this.client || this.logQueue.length === 0) {
      return;
    }

    const batch = this.logQueue.splice(0, this.config.batchSize);
    
    try {
      const logEvents = batch.map(entry => ({
        timestamp: entry.timestamp,
        message: JSON.stringify({
          level: entry.level,
          message: entry.message,
          metadata: entry.metadata,
        }),
      }));

      const params: any = {
        logGroupName: this.config.logGroupName,
        logStreamName: this.config.logStreamName,
        logEvents,
      };

      if (this.sequenceToken) {
        params.sequenceToken = this.sequenceToken;
      }

      const result = await this.putLogEventsWithRetry(params);
      
      if (result.nextSequenceToken) {
        this.sequenceToken = result.nextSequenceToken;
      }

    } catch (error) {
      console.error('Failed to flush logs to CloudWatch:', error);
      // Re-add failed logs to the front of the queue for retry
      this.logQueue.unshift(...batch);
    }
  }

  async destroy(): Promise<void> {
    this.isDestroyed = true;
    
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush remaining logs
    await this.flush();
    
    this.client = null;
  }

  private async ensureLogGroup(): Promise<void> {
    try {
      await this.client!.createLogGroup({
        logGroupName: this.config.logGroupName,
      });
    } catch (error: any) {
      // Log group already exists
      if (error.name !== 'ResourceAlreadyExistsException') {
        throw error;
      }
    }
  }

  private async ensureLogStream(): Promise<void> {
    try {
      await this.client!.createLogStream({
        logGroupName: this.config.logGroupName,
        logStreamName: this.config.logStreamName,
      });
    } catch (error: any) {
      // Log stream already exists
      if (error.name !== 'ResourceAlreadyExistsException') {
        throw error;
      }
    }
  }

  private async putLogEventsWithRetry(params: any, attempt = 1): Promise<any> {
    try {
      return await this.client!.putLogEvents(params);
    } catch (error: any) {
      if (attempt >= this.config.maxRetries) {
        throw error;
      }

      // Handle invalid sequence token by fetching the latest
      if (error.name === 'InvalidSequenceTokenException') {
        const { DescribeLogStreamsCommand } = await import('@aws-sdk/client-cloudwatch-logs');
        const command = new DescribeLogStreamsCommand({
          logGroupName: this.config.logGroupName,
          logStreamNamePrefix: this.config.logStreamName,
        });
        
        const response = await this.client!.send(command);
        const stream = response.logStreams?.find(s => s.logStreamName === this.config.logStreamName);
        
        if (stream?.uploadSequenceToken) {
          params.sequenceToken = stream.uploadSequenceToken;
        }
      }

      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return this.putLogEventsWithRetry(params, attempt + 1);
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush().catch(error => {
        console.error('Error in scheduled flush:', error);
      });
    }, this.config.flushIntervalMs);
  }

  getQueueSize(): number {
    return this.logQueue.length;
  }

  isReady(): boolean {
    return this.isInitialized && !this.isDestroyed;
  }
}
