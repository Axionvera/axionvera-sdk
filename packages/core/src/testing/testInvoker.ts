import type { ContractInvoker } from '../contracts/vault';
import { ContractError } from '../errors';

export type TestInvokerCallKind = 'read' | 'invoke';

export interface TestInvokerCall {
  kind: TestInvokerCallKind;
  contractId: string;
  method: string;
  args: readonly unknown[];
}

export interface TestContractInvokerOptions {
  /** Fallback when no method-specific read response is configured. */
  defaultReadResponse?: unknown;
  /** Fallback when no method-specific invoke response is configured. */
  defaultInvokeResponse?: unknown;
}

/**
 * In-memory, real-invoker-shaped `ContractInvoker` for unit and readiness tests.
 * It implements the same `read`/`invoke` request boundary used by
 * `SorobanContractInvoker`, records every ordered request, and returns
 * preconfigured responses (or forced errors). It has no RPC or network client.
 */
export class TestContractInvoker implements ContractInvoker {
  readonly calls: TestInvokerCall[] = [];

  private readonly readResponses = new Map<string, unknown>();
  private readonly invokeResponses = new Map<string, unknown>();
  private readError: unknown | undefined;
  private invokeError: unknown | undefined;
  private defaultReadResponse: unknown | undefined;
  private defaultInvokeResponse: unknown | undefined;

  constructor(options: TestContractInvokerOptions = {}) {
    this.defaultReadResponse = options.defaultReadResponse;
    this.defaultInvokeResponse = options.defaultInvokeResponse;
  }

  setReadResponse(method: string, response: unknown): this {
    this.readResponses.set(method, response);
    return this;
  }

  setInvokeResponse(method: string, response: unknown): this {
    this.invokeResponses.set(method, response);
    return this;
  }

  /** Force subsequent `read` calls to reject until cleared. */
  failOnRead(error: unknown = new ContractError('Forced read failure')): this {
    this.readError = error;
    return this;
  }

  /** Force subsequent `invoke` calls to reject until cleared. */
  failOnInvoke(error: unknown = new ContractError('Forced invoke failure')): this {
    this.invokeError = error;
    return this;
  }

  clearForcedErrors(): this {
    this.readError = undefined;
    this.invokeError = undefined;
    return this;
  }

  clearCalls(): void {
    this.calls.length = 0;
  }

  reset(): void {
    this.clearCalls();
    this.readResponses.clear();
    this.invokeResponses.clear();
    this.clearForcedErrors();
    this.defaultReadResponse = undefined;
    this.defaultInvokeResponse = undefined;
  }

  async invoke<TResponse = unknown>(request: {
    contractId: string;
    method: string;
    args: readonly unknown[];
  }): Promise<TResponse> {
    return this.dispatch('invoke', request);
  }

  async read<TResponse = unknown>(request: {
    contractId: string;
    method: string;
    args: readonly unknown[];
  }): Promise<TResponse> {
    return this.dispatch('read', request);
  }

  private async dispatch<TResponse>(
    kind: TestInvokerCallKind,
    request: {
      contractId: string;
      method: string;
      args: readonly unknown[];
    }
  ): Promise<TResponse> {
    this.calls.push({
      kind,
      contractId: request.contractId,
      method: request.method,
      args: request.args
    });

    const forcedError = kind === 'read' ? this.readError : this.invokeError;
    if (forcedError !== undefined) {
      throw forcedError;
    }

    const responses = kind === 'read' ? this.readResponses : this.invokeResponses;
    if (responses.has(request.method)) {
      return responses.get(request.method) as TResponse;
    }

    const fallback = kind === 'read' ? this.defaultReadResponse : this.defaultInvokeResponse;
    if (fallback !== undefined) {
      return fallback as TResponse;
    }

    throw new ContractError(
      `No ${kind} response configured for method "${request.method}"`
    );
  }
}

export function createTestContractInvoker(
  options?: TestContractInvokerOptions
): TestContractInvoker {
  return new TestContractInvoker(options);
}
