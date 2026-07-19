# Resource Lifecycle Management

`ResourceLifecycleManager` centralizes setup and cleanup for SDK resources such
as RPC clients, subscriptions, caches, and background tasks. It keeps ownership
clear and makes graceful shutdown deterministic.

```ts
import { ResourceLifecycleManager } from 'axionvera-sdk';

const lifecycle = new ResourceLifecycleManager();

lifecycle.register({
  id: 'rpc-client',
  initialize: () => rpcClient.connect(),
  stop: () => rpcClient.close(),
  healthCheck: () => rpcClient.isHealthy(),
});

lifecycle.register({
  id: 'event-subscription',
  dependencies: ['rpc-client'],
  start: () => subscription.start(),
  stop: () => subscription.stop(),
  dispose: () => subscription.dispose(),
});

await lifecycle.startAll();
await lifecycle.shutdownGracefully();
```

## Ownership Model

- Register each resource once with a stable `id`.
- Dependencies are listed by resource id.
- Startup runs in dependency order.
- Stop and dispose run in reverse dependency order so dependent work shuts down
  before the resource it uses.

## Lifecycle States

Resources move through:

`registered -> initialized -> started -> stopped -> disposed`

If a hook throws, the resource is marked `failed` and the error message is
available in `getSnapshot()`.

## Cleanup Strategy

Use `shutdownGracefully()` for normal application shutdown. It stops started
resources first, then disposes every registered resource. `getHealth()` collects
optional health checks for diagnostics and monitoring.
