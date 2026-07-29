import type { AxiosInstance } from 'axios';
import type { rpc } from '@stellar/stellar-sdk';
import type { RetryConfig } from '../utils';
import type { ConcurrencyConfig } from '../utils';
import type { Logger } from '../utils';
import type { WebSocketConfig } from '../client';
import type { WebSocketManager } from '../client';

export type RpcServer = rpc.Server;
export type HttpClient = AxiosInstance;
export type LoggerService = Logger;
export type WebSocketManagerService = WebSocketManager;

export interface RpcClientFactoryOptions {
  rpcUrl: string;
  allowHttp: boolean;
  concurrencyEnabled: boolean;
  concurrencyConfig: ConcurrencyConfig;
}

export interface HttpClientFactoryOptions {
  retryConfig?: Partial<RetryConfig>;
}

export interface WebSocketManagerFactoryOptions {
  rpcUrl: string;
  config: WebSocketConfig;
  logger: LoggerService;
}

export type RpcClientFactory = (options: RpcClientFactoryOptions) => RpcServer;
export type HttpClientFactory = (options: HttpClientFactoryOptions) => HttpClient;
export type LoggerFactory = () => LoggerService;
export type WebSocketManagerFactory = (
  options: WebSocketManagerFactoryOptions
) => WebSocketManagerService;

export interface CoreServices {
  rpcClient?: RpcServer;
  rpcClientFactory: RpcClientFactory;
  httpClient?: HttpClient;
  httpClientFactory: HttpClientFactory;
  logger?: LoggerService;
  loggerFactory: LoggerFactory;
  webSocketManager?: WebSocketManagerService;
  webSocketManagerFactory: WebSocketManagerFactory;
}

export type ServiceOverrides = Partial<CoreServices>;
