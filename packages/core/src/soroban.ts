import {
  AxionveraError,
  ContractError,
  NetworkError,
  ValidationError
} from './errors';
import { AxionveraClient, type RpcTransport } from './client';
import type { NetworkConfig } from './network';
import type { ContractInvoker } from './contracts/vault';

/**
 * Request shape accepted by {@link ContractInvoker} methods. Mirrors the
 * object produced by `createContractCallRequest` so the invoker can be wired
 * directly into {@link VaultContract}.
 */
export interface SorobanInvokerRequest {
  contractId: string;
  method: string;
  args: readonly unknown[];
}

export interface SorobanContractInvokerConfig {
  /** Reuse an existing client's transport and network config. */
  client?: AxionveraClient;
  /** Provide a transport directly (e.g. a mock in tests or a custom impl). */
  transport?: RpcTransport;
  /** Network configuration; inferred from `client` when omitted. */
  networkConfig?: NetworkConfig;
}

/**
 * Minimal adapter that routes {@link ContractInvoker} calls onto the SDK's
 * Soroban RPC transport.
 *
 * This is intentionally a skeleton: `read` is mapped onto the `simulateTransaction`
 * RPC method and `invoke` onto `sendTransaction`. Full Stellar transaction
 * building/signing (XDR assembly, fee/sequence handling, submission lifecycle)
 * is expected in a later batch; for now the invoker preserves the
 * `contractId`, `method`, and `args` of every request and surfaces transport
 * failures and contract-level failures through the SDK error hierarchy.
 */
export class SorobanContractInvoker implements ContractInvoker {
  private readonly transport: RpcTransport;
  readonly networkConfig: NetworkConfig | undefined;

  constructor(config: SorobanContractInvokerConfig) {
    if (config.client) {
      this.transport = config.client.transport;
      this.networkConfig = config.networkConfig ?? config.client.networkConfig;
    } else if (config.transport) {
      this.transport = config.transport;
      this.networkConfig = config.networkConfig;
    } else {
      throw new ValidationError(
        'SorobanContractInvoker requires either a client or a transport'
      );
    }
  }

  getNetworkConfig(): NetworkConfig | undefined {
    return this.networkConfig;
  }

  async invoke<TResponse = unknown>(
    request: SorobanInvokerRequest
  ): Promise<TResponse> {
    this.assertRequest(request, 'invoke');
    return this.route<TResponse>('sendTransaction', 'invoke', request);
  }

  async read<TResponse = unknown>(
    request: SorobanInvokerRequest
  ): Promise<TResponse> {
    this.assertRequest(request, 'read');
    return this.route<TResponse>('simulateTransaction', 'read', request);
  }

  private assertRequest(
    request: unknown,
    op: 'read' | 'invoke'
  ): asserts request is SorobanInvokerRequest {
    if (!request || typeof request !== 'object') {
      throw new ValidationError(`${op} requires a request object`);
    }

    const { contractId, method, args } = request as Record<string, unknown>;

    if (typeof contractId !== 'string' || !contractId.trim()) {
      throw new ValidationError(`${op} requires a non-empty contractId`);
    }

    if (typeof method !== 'string' || !method.trim()) {
      throw new ValidationError(`${op} requires a non-empty method`);
    }

    if (!Array.isArray(args)) {
      throw new ValidationError(`${op} requires args to be an array`);
    }
  }

  private async route<TResponse>(
    rpcMethod: string,
    op: 'read' | 'invoke',
    request: SorobanInvokerRequest
  ): Promise<TResponse> {
    try {
      return await this.transport.call<TResponse>(rpcMethod, request);
    } catch (err) {
      throw this.toInvokerError(err, op);
    }
  }

  private toInvokerError(err: unknown, op: 'read' | 'invoke'): AxionveraError {
    if (err instanceof AxionveraError) {
      return err;
    }

    const message = err instanceof Error ? err.message : String(err);

    // Heuristically separate contract-level failures (e.g. host/WASM
    // traps, invocation errors) from lower-level transport failures.
    if (/contract|invocation|wasm|host|soroban/i.test(message)) {
      return new ContractError(`${op} failed: ${message}`, err);
    }

    return new NetworkError(`${op} failed: ${message}`, err);
  }
}
