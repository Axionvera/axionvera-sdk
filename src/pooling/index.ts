export {
  DEFAULT_OBJECT_POOL_MAX_SIZE,
  ObjectPool,
  ObjectPoolManager,
  objectPoolManager,
} from './objectPool';
export type { ObjectPoolConfig, ObjectPoolHooks, ObjectPoolStats } from './objectPool';

// New RPC Connection Pool exports
export { DefaultRpcConnection } from './rpcConnection';
export type { RpcConnection } from './rpcConnection';

export {
  RpcConnectionPool,
  AsyncRpcConnectionPool,
} from './rpcConnectionPool';
export type {
  RpcPoolConfig,
  RpcConnectionFactory,
} from './rpcConnectionPool';