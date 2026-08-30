import { NetworkError } from './errors';
import { resolveNetworkConfig, type NetworkConfig, type ResolveNetworkConfigInput } from './network';
import type { TransactionResult } from './types';

export interface JsonRpcResponse<T> {
  jsonrpc: '2.0';
  id: string | number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface RpcTransport {
  call<TResponse = unknown, TParams = unknown>(method: string, params?: TParams): Promise<TResponse>;
}

export interface AxionveraClientConfig extends ResolveNetworkConfigInput {
  transport?: RpcTransport;
}

type FetchLike = typeof fetch;

export class FetchRpcTransport implements RpcTransport {
  private requestId = 0;

  constructor(
    private readonly rpcUrl: string,
    private readonly fetchFn: FetchLike = fetch
  ) {}

  async call<TResponse = unknown, TParams = unknown>(
    method: string,
    params?: TParams
  ): Promise<TResponse> {
    this.requestId += 1;

    const response = await this.fetchFn(this.rpcUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: this.requestId,
        method,
        params
      })
    });

    if (!response.ok) {
      throw new NetworkError(`RPC request failed with HTTP ${response.status}`);
    }

    const payload = (await response.json()) as JsonRpcResponse<TResponse>;

    if (payload.error) {
      throw new NetworkError(payload.error.message, payload.error);
    }

    if (!('result' in payload)) {
      throw new NetworkError(`RPC response for ${method} did not include a result`);
    }

    return payload.result as TResponse;
  }
}

export class AxionveraClient {
  readonly networkConfig: NetworkConfig;
  readonly transport: RpcTransport;

  constructor(config: AxionveraClientConfig = {}) {
    this.networkConfig = resolveNetworkConfig(config);
    this.transport = config.transport ?? new FetchRpcTransport(this.networkConfig.rpcUrl);
  }

  getNetworkConfig(): NetworkConfig {
    return this.networkConfig;
  }

  async getHealth(): Promise<unknown> {
    return this.transport.call('getHealth');
  }

  async getTransaction(hash: string): Promise<TransactionResult> {
    return this.transport.call<TransactionResult, { hash: string }>('getTransaction', { hash });
  }

  /**
   * Submits a signed transaction XDR to the network.
   * 
   * @param transactionXdr - The base64-encoded signed transaction envelope XDR
   * @returns The raw RPC response result
   */
  async sendTransaction(transactionXdr: string): Promise<unknown> {
    return this.transport.call('sendTransaction', { transaction: transactionXdr });
  }

  /**
   * Simulates a transaction XDR to estimate resources and preview results.
   * 
   * @param transactionXdr - The base64-encoded transaction envelope XDR
   * @returns The raw RPC response result
   */
  async simulateTransaction(transactionXdr: string): Promise<unknown> {
    return this.transport.call('simulateTransaction', { transaction: transactionXdr });
  }
}
