import { rpc } from '@stellar/stellar-sdk';

import { createConcurrencyControlledClient } from '../utils';
import { createHttpClientWithRetry } from '../utils';
import { Logger } from '../utils';
import { WebSocketManager } from '../client';
import type {
  CoreServices,
  HttpClient,
  HttpClientFactoryOptions,
  LoggerService,
  RpcClientFactoryOptions,
  RpcServer,
  ServiceOverrides,
  WebSocketManagerFactoryOptions,
  WebSocketManagerService,
} from './serviceInterfaces';

export const defaultRpcClientFactory = (options: RpcClientFactoryOptions): RpcServer => {
  const baseRpc = new rpc.Server(options.rpcUrl, { allowHttp: options.allowHttp });

  if (!options.concurrencyEnabled) {
    return baseRpc;
  }

  return createConcurrencyControlledClient(baseRpc, options.concurrencyConfig);
};

export const defaultHttpClientFactory = (options: HttpClientFactoryOptions): HttpClient => {
  return createHttpClientWithRetry(options.retryConfig);
};

export const defaultLoggerFactory = (): LoggerService => new Logger();

export const defaultWebSocketManagerFactory = (
  options: WebSocketManagerFactoryOptions
): WebSocketManagerService => {
  return new WebSocketManager(options.rpcUrl, options.config, {
    onEvent: (event) => options.logger.debug('WebSocket event received:', event),
    onConnectionChange: (connected) =>
      options.logger.debug(`WebSocket connection changed: ${connected}`),
    logger: options.logger,
  });
};

export class ServiceContainer {
  private readonly services: CoreServices;

  constructor(overrides: ServiceOverrides = {}) {
    this.services = {
      rpcClientFactory: defaultRpcClientFactory,
      httpClientFactory: defaultHttpClientFactory,
      loggerFactory: defaultLoggerFactory,
      webSocketManagerFactory: defaultWebSocketManagerFactory,
      ...overrides,
    };
  }

  getLogger(): LoggerService {
    return this.services.logger ?? this.services.loggerFactory();
  }

  getHttpClient(options: HttpClientFactoryOptions): HttpClient {
    return this.services.httpClient ?? this.services.httpClientFactory(options);
  }

  getRpcClient(options: RpcClientFactoryOptions): RpcServer {
    return this.services.rpcClient ?? this.services.rpcClientFactory(options);
  }

  getWebSocketManager(options: WebSocketManagerFactoryOptions): WebSocketManagerService {
    return this.services.webSocketManager ?? this.services.webSocketManagerFactory(options);
  }

  extend(overrides: ServiceOverrides): ServiceContainer {
    return new ServiceContainer({ ...this.services, ...overrides });
  }
}

export function createServiceContainer(overrides: ServiceOverrides = {}): ServiceContainer {
  return new ServiceContainer(overrides);
}
