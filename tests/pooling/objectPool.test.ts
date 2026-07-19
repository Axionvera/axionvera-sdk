import { ObjectPool, ObjectPoolManager, objectPoolManager } from '../../src/pooling';

interface BufferHolder {
  bytes: Uint8Array;
  used: number;
}

describe('ObjectPool', () => {
  it('warms, reuses, resets, and reports object-pool statistics', () => {
    let created = 0;
    const pool = new ObjectPool<BufferHolder>({
      name: 'buffers',
      warmSize: 2,
      maxSize: 4,
      factory: () => {
        created++;
        return { bytes: new Uint8Array(8), used: 0 };
      },
      reset: (item) => {
        item.bytes.fill(0);
        item.used = 0;
      },
    });

    expect(pool.getStats()).toMatchObject({ available: 2, created: 2, borrowed: 0 });

    const first = pool.acquire();
    first.bytes[0] = 255;
    first.used = 1;
    pool.release(first);

    const second = pool.acquire();
    expect(second).toBe(first);
    expect(second.bytes[0]).toBe(0);
    expect(second.used).toBe(0);
    pool.release(second);

    expect(created).toBe(2);
    expect(pool.getStats()).toMatchObject({
      available: 2,
      borrowed: 0,
      created: 2,
      reused: 2,
      released: 2,
    });
  });

  it('rejects double release and foreign objects to preserve pool integrity', () => {
    const pool = new ObjectPool<{ value: number }>({
      name: 'records',
      factory: () => ({ value: 0 }),
    });

    const item = pool.acquire();
    pool.release(item);

    expect(() => pool.release(item)).toThrow('cannot release an item it did not borrow');
    expect(() => pool.release({ value: 1 })).toThrow('cannot release an item it did not borrow');
  });

  it('discards invalid or overflowing objects and calls lifecycle hooks', () => {
    const hooks: string[] = [];
    const pool = new ObjectPool<{ valid: boolean }>({
      name: 'validated',
      maxSize: 1,
      factory: () => ({ valid: true }),
      validate: (item) => item.valid,
      onCreate: () => hooks.push('create'),
      onAcquire: () => hooks.push('acquire'),
      onRelease: () => hooks.push('release'),
      onDestroy: () => hooks.push('destroy'),
    });

    const valid = pool.acquire();
    pool.release(valid);

    const invalid = pool.acquire();
    invalid.valid = false;
    pool.release(invalid);

    expect(pool.getStats()).toMatchObject({
      available: 0,
      discarded: 1,
      destroyed: 1,
    });
    expect(hooks).toEqual(['create', 'acquire', 'release', 'acquire', 'release', 'destroy']);
  });

  it('returns borrowed items from withBorrowed even when the callback throws', () => {
    const pool = new ObjectPool<{ value: number }>({
      name: 'guarded',
      factory: () => ({ value: 0 }),
      reset: (item) => {
        item.value = 0;
      },
    });

    expect(() =>
      pool.withBorrowed((item) => {
        item.value = 42;
        throw new Error('boom');
      })
    ).toThrow('boom');

    expect(pool.getStats()).toMatchObject({ available: 1, borrowed: 0, released: 1 });
    expect(pool.acquire().value).toBe(0);
  });
});

describe('ObjectPoolManager', () => {
  afterEach(() => {
    objectPoolManager.clear();
  });

  it('registers, retrieves, reports, unregisters, and clears pools', () => {
    const manager = new ObjectPoolManager();
    const pool = manager.register({
      name: 'scratch',
      factory: () => ({ values: [] as number[] }),
      warmSize: 1,
    });

    expect(manager.get('scratch')).toBe(pool);
    expect(manager.require('scratch')).toBe(pool);
    expect(manager.getStats()).toEqual([
      expect.objectContaining({ name: 'scratch', available: 1, created: 1 }),
    ]);
    expect(() =>
      manager.register({
        name: 'scratch',
        factory: () => ({}),
      })
    ).toThrow('already registered');
    expect(manager.unregister('scratch')).toBe(true);
    expect(manager.unregister('scratch')).toBe(false);
  });

  it('exposes a shared manager for SDK-level reusable pools', () => {
    const pool = objectPoolManager.register({
      name: 'sdk-scratch',
      factory: () => ({ scratch: new Map<string, string>() }),
      warmSize: 1,
    });

    expect(objectPoolManager.require('sdk-scratch')).toBe(pool);
    expect(objectPoolManager.getStats()[0]).toMatchObject({
      name: 'sdk-scratch',
      created: 1,
      available: 1,
    });
  });
});
