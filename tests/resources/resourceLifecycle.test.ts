import {
  ManagedResource,
  ResourceLifecycleManager,
  resourceLifecycleManager,
} from '../../src/resources';

function createResource(id: string, log: string[], dependencies: string[] = []): ManagedResource {
  return {
    id,
    dependencies,
    initialize: () => {
      log.push(`${id}:initialize`);
    },
    start: () => {
      log.push(`${id}:start`);
    },
    stop: () => {
      log.push(`${id}:stop`);
    },
    dispose: () => {
      log.push(`${id}:dispose`);
    },
    healthCheck: () => true,
  };
}

describe('ResourceLifecycleManager', () => {
  afterEach(() => {
    resourceLifecycleManager.clear();
  });

  it('registers resources and starts them in dependency order', async () => {
    const log: string[] = [];
    const manager = new ResourceLifecycleManager();

    manager
      .register(createResource('cache', log))
      .register(createResource('client', log, ['cache']))
      .register(createResource('subscription', log, ['client']));

    await manager.startAll();

    expect(log).toEqual([
      'cache:initialize',
      'cache:start',
      'client:initialize',
      'client:start',
      'subscription:initialize',
      'subscription:start',
    ]);
    expect(manager.getSnapshot()).toEqual([
      expect.objectContaining({ id: 'cache', state: 'started' }),
      expect.objectContaining({ id: 'client', state: 'started', dependencies: ['cache'] }),
      expect.objectContaining({
        id: 'subscription',
        state: 'started',
        dependencies: ['client'],
      }),
    ]);
  });

  it('stops and disposes resources in reverse dependency order', async () => {
    const log: string[] = [];
    const manager = new ResourceLifecycleManager();

    manager
      .register(createResource('client', log))
      .register(createResource('task', log, ['client']));

    await manager.startAll();
    log.length = 0;
    await manager.shutdownGracefully();

    expect(log).toEqual(['task:stop', 'client:stop', 'task:dispose', 'client:dispose']);
    expect(manager.getSnapshot()).toEqual([
      expect.objectContaining({ id: 'client', state: 'disposed' }),
      expect.objectContaining({ id: 'task', state: 'disposed' }),
    ]);
  });

  it('tracks failures and prevents circular or missing dependencies', async () => {
    const manager = new ResourceLifecycleManager();
    manager.register({
      id: 'broken',
      start: () => {
        throw new Error('start failed');
      },
    });

    await expect(manager.startAll()).rejects.toThrow('start failed');
    expect(manager.getSnapshot()[0]).toMatchObject({
      id: 'broken',
      state: 'failed',
      error: 'start failed',
    });

    const missing = new ResourceLifecycleManager();
    missing.register({ id: 'task', dependencies: ['client'] });
    await expect(missing.startAll()).rejects.toThrow('Resource "client" is not registered');

    const circular = new ResourceLifecycleManager();
    circular.register({ id: 'a', dependencies: ['b'] }).register({ id: 'b', dependencies: ['a'] });
    await expect(circular.startAll()).rejects.toThrow('Circular resource dependency');
  });

  it('reports health and enforces unregister ownership rules', async () => {
    const manager = new ResourceLifecycleManager();
    manager.register({ id: 'healthy', healthCheck: () => true });
    manager.register({ id: 'unhealthy', healthCheck: () => false });

    await expect(manager.getHealth()).resolves.toEqual({
      healthy: true,
      unhealthy: false,
    });

    await manager.startAll();
    expect(() => manager.unregister('healthy')).toThrow('must be disposed');
    await manager.disposeAll();
    expect(manager.unregister('healthy')).toBe(true);
    expect(manager.unregister('healthy')).toBe(false);
  });

  it('exposes a shared lifecycle manager for SDK-level resources', async () => {
    const log: string[] = [];
    resourceLifecycleManager.register(createResource('shared', log));

    await resourceLifecycleManager.startAll();

    expect(resourceLifecycleManager.require('shared').id).toBe('shared');
    expect(log).toEqual(['shared:initialize', 'shared:start']);
  });
});
