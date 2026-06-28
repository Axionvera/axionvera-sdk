import type { ContractDescriptor } from '../discovery/types';

/**
 * A single input or output parameter of a reflected method or event.
 *
 * `type` is the canonical Solidity ABI type (e.g. `'uint256'`, `'address'`),
 * exactly as produced by ethers' fragment parsing. `indexed` is only present
 * for event parameters and indicates whether the parameter is stored as an
 * indexed topic rather than in the event data payload.
 */
export interface ReflectedParameter {
  /** Parameter name, or an empty string when the ABI leaves it unnamed. */
  name: string;
  /** Canonical Solidity ABI type, e.g. `'uint256'` or `'address'`. */
  type: string;
  /** Event parameters only: whether this parameter is an indexed topic. */
  indexed?: boolean;
}

/** State mutability of a reflected contract method, as declared in the ABI. */
export type ReflectedStateMutability = 'pure' | 'view' | 'nonpayable' | 'payable';

/** A callable contract function discovered by reflecting a contract ABI. */
export interface ReflectedMethod {
  /** Function name, e.g. `'deposit'`. */
  name: string;
  /** Human-readable signature, e.g. `'deposit(uint256)'`. */
  signature: string;
  /** 4-byte function selector, e.g. `'0xb6b55f25'`. */
  selector: string;
  /** Declared state mutability. */
  stateMutability: ReflectedStateMutability;
  /** Whether the function can receive value (`stateMutability === 'payable'`). */
  payable: boolean;
  /** Whether the function only reads state (`'view'` or `'pure'`). */
  constant: boolean;
  /** Ordered input parameters. */
  inputs: ReflectedParameter[];
  /** Ordered output parameters. */
  outputs: ReflectedParameter[];
}

/** A contract event discovered by reflecting a contract ABI. */
export interface ReflectedEvent {
  /** Event name, e.g. `'Deposit'`. */
  name: string;
  /** Human-readable signature, e.g. `'Deposit(address,address,uint256,uint256)'`. */
  signature: string;
  /** keccak-256 topic hash (`topic0`) used to filter logs for this event. */
  topicHash: string;
  /** Whether the event is declared `anonymous`. */
  anonymous: boolean;
  /** Ordered event parameters, each carrying its `indexed` flag. */
  inputs: ReflectedParameter[];
}

/**
 * The full reflected view of a contract interface: every callable method and
 * every declared event, plus the SDK's higher-level {@link ContractDescriptor}
 * when the caller supplies one.
 */
export interface ContractReflection {
  /** All callable functions declared by the ABI. */
  methods: ReflectedMethod[];
  /** All events declared by the ABI. */
  events: ReflectedEvent[];
  /**
   * The SDK's discovery descriptor for this contract, surfaced verbatim when
   * the caller passes it through {@link ReflectOptions.descriptor}. The
   * descriptor shape is never modified by reflection.
   */
  descriptor?: ContractDescriptor;
}

/** Options accepted by every {@link ContractReflectionService} method. */
export interface ReflectOptions {
  /**
   * Explicit cache key for this contract/ABI. When omitted, a stable key is
   * derived from the ABI itself, so identical ABIs share a cache entry. Pass a
   * contract id or logical name to scope the cache per deployed contract.
   */
  cacheKey?: string;
  /**
   * The SDK's discovery descriptor to surface alongside the reflected
   * methods/events. Attached to {@link ContractReflection.descriptor} as-is.
   */
  descriptor?: ContractDescriptor;
}
