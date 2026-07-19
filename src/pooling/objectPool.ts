export interface ObjectPoolHooks<T> {
  onCreate?: (item: T) => void;
  onAcquire?: (item: T) => void;
  onRelease?: (item: T) => void;
  onDestroy?: (item: T) => void;
}

export interface ObjectPoolConfig<T> extends ObjectPoolHooks<T> {
  name: string;
  factory: () => T;
  reset?: (item: T) => void;
  validate?: (item: T) => boolean;
  maxSize?: number;
  warmSize?: number;
}

export interface ObjectPoolStats {
  name: string;
  available: number;
  borrowed: number;
  created: number;
  reused: number;
  released: number;
  destroyed: number;
  discarded: number;
  maxSize: number;
}

export class ObjectPool<T extends object> {
  private readonly available: T[] = [];
  private readonly borrowed = new Set<T>();
  private readonly config: Required<Pick<ObjectPoolConfig<T>, 'maxSize' | 'warmSize'>> &
    ObjectPoolConfig<T>;
  private created = 0;
  private reused = 0;
  private released = 0;
  private destroyed = 0;
  private discarded = 0;

  constructor(config: ObjectPoolConfig<T>) {
    if (config.maxSize !== undefined && config.maxSize < 1) {
      throw new Error('ObjectPool maxSize must be at least 1');
    }

    if (config.warmSize !== undefined && config.warmSize < 0) {
      throw new Error('ObjectPool warmSize cannot be negative');
    }

    this.config = {
      maxSize: config.maxSize ?? 100,
      warmSize: config.warmSize ?? 0,
      ...config,
    };

    if (this.config.warmSize > this.config.maxSize) {
      throw new Error('ObjectPool warmSize cannot exceed maxSize');
    }

    this.warm(this.config.warmSize);
  }

  acquire(): T {
    const item = this.available.pop() ?? this.createItem();

    if (this.borrowed.has(item)) {
      throw new Error(`ObjectPool "${this.config.name}" attempted to borrow the same item twice`);
    }

    this.borrowed.add(item);
    this.reused++;
    this.config.onAcquire?.(item);
    return item;
  }

  release(item: T): void {
    if (!this.borrowed.delete(item)) {
      throw new Error(`ObjectPool "${this.config.name}" cannot release an item it did not borrow`);
    }

    this.released++;
    this.config.onRelease?.(item);
    this.config.reset?.(item);

    if (this.config.validate && !this.config.validate(item)) {
      this.discard(item);
      return;
    }

    if (this.available.length >= this.config.maxSize) {
      this.discard(item);
      return;
    }

    this.available.push(item);
  }

  withBorrowed<R>(fn: (item: T) => R): R {
    const item = this.acquire();

    try {
      return fn(item);
    } finally {
      this.release(item);
    }
  }

  warm(count: number): void {
    if (count < 0) {
      throw new Error('ObjectPool warm count cannot be negative');
    }

    while (this.available.length < Math.min(count, this.config.maxSize)) {
      this.available.push(this.createItem());
    }
  }

  drain(): void {
    const items = [...this.available, ...this.borrowed];
    this.available.length = 0;
    this.borrowed.clear();
    items.forEach((item) => {
      this.discard(item);
    });
  }

  getStats(): ObjectPoolStats {
    return {
      name: this.config.name,
      available: this.available.length,
      borrowed: this.borrowed.size,
      created: this.created,
      reused: this.reused,
      released: this.released,
      destroyed: this.destroyed,
      discarded: this.discarded,
      maxSize: this.config.maxSize,
    };
  }

  private createItem(): T {
    const item = this.config.factory();
    this.created++;
    this.config.onCreate?.(item);
    return item;
  }

  private discard(item: T): void {
    this.discarded++;
    this.destroyed++;
    this.config.onDestroy?.(item);
  }
}

export class ObjectPoolManager {
  private readonly pools = new Map<string, ObjectPool<object>>();

  register<T extends object>(config: ObjectPoolConfig<T>): ObjectPool<T> {
    if (this.pools.has(config.name)) {
      throw new Error(`ObjectPool "${config.name}" is already registered`);
    }

    const pool = new ObjectPool<T>(config);
    this.pools.set(config.name, pool as unknown as ObjectPool<object>);
    return pool;
  }

  get<T extends object>(name: string): ObjectPool<T> | undefined {
    return this.pools.get(name) as ObjectPool<T> | undefined;
  }

  require<T extends object>(name: string): ObjectPool<T> {
    const pool = this.get<T>(name);
    if (!pool) {
      throw new Error(`ObjectPool "${name}" is not registered`);
    }

    return pool;
  }

  unregister(name: string): boolean {
    const pool = this.pools.get(name);
    if (!pool) {
      return false;
    }

    pool.drain();
    return this.pools.delete(name);
  }

  getStats(): ObjectPoolStats[] {
    return Array.from(this.pools.values()).map((pool) => pool.getStats());
  }

  drainAll(): void {
    this.pools.forEach((pool) => {
      pool.drain();
    });
  }

  clear(): void {
    this.drainAll();
    this.pools.clear();
  }
}

export const objectPoolManager = new ObjectPoolManager();

export const DEFAULT_OBJECT_POOL_MAX_SIZE = 100;
