import {
  IncrementalSyncEngine,
  InMemoryCheckpointStore,
  InMemoryResourceStore,
  SyncPage,
  SyncResource,
} from '../../src/sync';

interface TestResource extends SyncResource {
  value: string;
}

function createSource(pages: SyncPage<TestResource>[]) {
  const calls: Array<string | undefined> = [];

  return {
    calls,
    source: {
      async fetchChanges(checkpoint?: { cursor?: string }) {
        calls.push(checkpoint?.cursor);
        return pages.shift() ?? { resources: [] };
      },
    },
  };
}

describe('IncrementalSyncEngine', () => {
  it('applies only changed resources and persists checkpoints', async () => {
    const checkpointStore = new InMemoryCheckpointStore();
    const resourceStore = new InMemoryResourceStore<TestResource>([
      { id: 'same', version: 1, updatedAt: 100, value: 'local' },
    ]);
    const { source, calls } = createSource([
      {
        resources: [
          { id: 'same', version: 1, updatedAt: 100, value: 'same' },
          { id: 'new', version: 1, updatedAt: 110, value: 'new' },
          { id: 'updated', version: 2, updatedAt: 120, value: 'updated' },
        ],
        highWatermark: 120,
      },
    ]);

    const engine = new IncrementalSyncEngine({
      key: 'accounts',
      source,
      checkpointStore,
      resourceStore,
      now: () => 1000,
    });

    const result = await engine.sync();

    expect(calls).toEqual([undefined]);
    expect(result.applied.map((resource) => resource.id)).toEqual(['new', 'updated']);
    expect(result.skipped.map((resource) => resource.id)).toEqual(['same']);
    expect(await checkpointStore.load('accounts')).toEqual({
      cursor: undefined,
      highWatermark: 120,
      updatedAt: 1000,
    });
    await expect(resourceStore.get('new')).resolves.toMatchObject({ value: 'new' });
  });

  it('continues from the saved cursor and processes multiple pages', async () => {
    const checkpointStore = new InMemoryCheckpointStore();
    await checkpointStore.save('events', {
      cursor: 'page-1',
      highWatermark: 10,
      updatedAt: 900,
    });
    const resourceStore = new InMemoryResourceStore<TestResource>();
    const { source, calls } = createSource([
      {
        resources: [{ id: 'a', version: 1, updatedAt: 20, value: 'a' }],
        nextCursor: 'page-2',
        highWatermark: 20,
      },
      {
        resources: [{ id: 'b', version: 1, updatedAt: 30, value: 'b' }],
        highWatermark: 30,
      },
    ]);

    const engine = new IncrementalSyncEngine({
      key: 'events',
      source,
      checkpointStore,
      resourceStore,
      now: () => 1000,
    });

    const result = await engine.sync();

    expect(calls).toEqual(['page-1', 'page-2']);
    expect(result.applied.map((resource) => resource.id)).toEqual(['a', 'b']);
    await expect(checkpointStore.load('events')).resolves.toEqual({
      cursor: undefined,
      highWatermark: 30,
      updatedAt: 1000,
    });
  });

  it('supports prefer-local, prefer-remote, and custom conflict resolution', async () => {
    const local: TestResource = { id: 'r1', version: 5, updatedAt: 50, value: 'local' };
    const remote: TestResource = { id: 'r1', version: 4, updatedAt: 60, value: 'remote' };

    const localStore = new InMemoryResourceStore<TestResource>([local]);
    const localEngine = new IncrementalSyncEngine({
      key: 'prefer-local',
      source: createSource([{ resources: [remote] }]).source,
      checkpointStore: new InMemoryCheckpointStore(),
      resourceStore: localStore,
      conflictStrategy: 'prefer-local',
    });

    const localResult = await localEngine.sync();
    expect(localResult.conflicts).toHaveLength(1);
    expect(localResult.skipped).toEqual([remote]);
    await expect(localStore.get('r1')).resolves.toEqual(local);

    const remoteStore = new InMemoryResourceStore<TestResource>([local]);
    const remoteEngine = new IncrementalSyncEngine({
      key: 'prefer-remote',
      source: createSource([{ resources: [remote] }]).source,
      checkpointStore: new InMemoryCheckpointStore(),
      resourceStore: remoteStore,
      conflictStrategy: 'prefer-remote',
    });

    await remoteEngine.sync();
    await expect(remoteStore.get('r1')).resolves.toEqual(remote);

    const customStore = new InMemoryResourceStore<TestResource>([local]);
    const customEngine = new IncrementalSyncEngine({
      key: 'custom',
      source: createSource([{ resources: [remote] }]).source,
      checkpointStore: new InMemoryCheckpointStore(),
      resourceStore: customStore,
      conflictStrategy: (conflict) => ({
        ...conflict.local,
        value: `${conflict.local.value}+${conflict.remote.value}`,
      }),
    });

    await customEngine.sync();
    await expect(customStore.get('r1')).resolves.toMatchObject({
      version: 5,
      value: 'local+remote',
    });
  });

  it('stops runaway pagination at maxPages', async () => {
    const engine = new IncrementalSyncEngine<TestResource>({
      key: 'runaway',
      source: {
        async fetchChanges() {
          return { resources: [], nextCursor: 'again' };
        },
      },
      checkpointStore: new InMemoryCheckpointStore(),
      resourceStore: new InMemoryResourceStore<TestResource>(),
      maxPages: 2,
    });

    await expect(engine.sync()).rejects.toThrow('maxPages=2');
  });
});
