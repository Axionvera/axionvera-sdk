import { ethers } from 'ethers';
import { ValidationError } from '../errors/axionveraError';
import type {
  ContractReflection,
  ReflectedEvent,
  ReflectedMethod,
  ReflectedParameter,
  ReflectOptions,
} from './types';

/**
 * Inspects a contract's ABI and exposes its methods and events as plain,
 * serializable metadata. Parsing is delegated to {@link ethers.Interface} —
 * the same parser the SDK's {@link Vault} contract already uses — so the
 * standard JSON ABI (including `type: 'event'` fragments) is the source of
 * truth and no bespoke metadata format is introduced.
 *
 * Reflection results are cached per contract/ABI. Reads return a deep clone of
 * the cached value so callers can freely mutate the result without corrupting
 * the cache, mirroring the clone-on-read behaviour of the SDK's registries.
 *
 * @example
 * ```typescript
 * import { contractReflection, VaultABI } from 'axionvera-sdk';
 *
 * const methods = contractReflection.getMethods(VaultABI);
 * const events = contractReflection.getEvents(VaultABI);
 * ```
 */
export class ContractReflectionService {
  private readonly cache = new Map<string, ContractReflection>();

  /**
   * Reflects a contract ABI into its full set of methods and events.
   *
   * @param abi - A standard JSON ABI (array or ethers-compatible string).
   * @param options - Optional cache key and discovery descriptor to surface.
   * @returns The reflected contract interface.
   * @throws {@link ValidationError} if the ABI cannot be parsed.
   */
  reflect(abi: ethers.InterfaceAbi, options: ReflectOptions = {}): ContractReflection {
    const key = options.cacheKey ?? this.cacheKeyFor(abi);

    let reflection = this.cache.get(key);
    if (!reflection) {
      reflection = this.buildReflection(abi);
      this.cache.set(key, reflection);
    }

    const cloned = this.cloneReflection(reflection);
    if (options.descriptor) {
      cloned.descriptor = options.descriptor;
    }
    return cloned;
  }

  /** Returns every callable method declared by the ABI. */
  getMethods(abi: ethers.InterfaceAbi, options: ReflectOptions = {}): ReflectedMethod[] {
    return this.reflect(abi, options).methods;
  }

  /** Returns a single method by name, or `undefined` when it is not declared. */
  getMethod(
    abi: ethers.InterfaceAbi,
    name: string,
    options: ReflectOptions = {}
  ): ReflectedMethod | undefined {
    return this.getMethods(abi, options).find((method) => method.name === name);
  }

  /** Returns every event declared by the ABI. */
  getEvents(abi: ethers.InterfaceAbi, options: ReflectOptions = {}): ReflectedEvent[] {
    return this.reflect(abi, options).events;
  }

  /** Returns a single event by name, or `undefined` when it is not declared. */
  getEvent(
    abi: ethers.InterfaceAbi,
    name: string,
    options: ReflectOptions = {}
  ): ReflectedEvent | undefined {
    return this.getEvents(abi, options).find((event) => event.name === name);
  }

  /** Clears all cached reflection results. */
  clearCache(): void {
    this.cache.clear();
  }

  private buildReflection(abi: ethers.InterfaceAbi): ContractReflection {
    const iface = this.parseAbi(abi);

    const methods: ReflectedMethod[] = [];
    iface.forEachFunction((fragment) => {
      methods.push(this.toMethod(fragment));
    });

    const events: ReflectedEvent[] = [];
    iface.forEachEvent((fragment) => {
      events.push(this.toEvent(fragment));
    });

    return { methods, events };
  }

  private parseAbi(abi: ethers.InterfaceAbi): ethers.Interface {
    try {
      return new ethers.Interface(abi);
    } catch (error) {
      throw new ValidationError(
        'Unable to reflect contract: the provided ABI could not be parsed',
        {
          originalError: error,
        }
      );
    }
  }

  private toMethod(fragment: ethers.FunctionFragment): ReflectedMethod {
    return {
      name: fragment.name,
      signature: fragment.format('sighash'),
      selector: fragment.selector,
      stateMutability: fragment.stateMutability,
      payable: fragment.payable,
      constant: fragment.constant,
      inputs: fragment.inputs.map((input) => this.toParameter(input, false)),
      outputs: fragment.outputs.map((output) => this.toParameter(output, false)),
    };
  }

  private toEvent(fragment: ethers.EventFragment): ReflectedEvent {
    return {
      name: fragment.name,
      signature: fragment.format('sighash'),
      topicHash: fragment.topicHash,
      anonymous: fragment.anonymous,
      inputs: fragment.inputs.map((input) => this.toParameter(input, true)),
    };
  }

  private toParameter(param: ethers.ParamType, includeIndexed: boolean): ReflectedParameter {
    const reflected: ReflectedParameter = {
      name: param.name,
      type: param.type,
    };
    if (includeIndexed) {
      reflected.indexed = Boolean(param.indexed);
    }
    return reflected;
  }

  private cacheKeyFor(abi: ethers.InterfaceAbi): string {
    return typeof abi === 'string' ? abi : JSON.stringify(abi);
  }

  private cloneReflection(reflection: ContractReflection): ContractReflection {
    return {
      methods: reflection.methods.map((method) => ({
        ...method,
        inputs: method.inputs.map((input) => ({ ...input })),
        outputs: method.outputs.map((output) => ({ ...output })),
      })),
      events: reflection.events.map((event) => ({
        ...event,
        inputs: event.inputs.map((input) => ({ ...input })),
      })),
    };
  }
}

/** Shared {@link ContractReflectionService} instance for typical usage. */
export const contractReflection = new ContractReflectionService();
