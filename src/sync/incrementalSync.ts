export type SyncConflictStrategy<TResource extends SyncResource> =
  'prefer-local' | 'prefer-remote' | ((conflict: SyncConflict<TResource>) => TResource);

export interface SyncCheckpoint {
  cursor?: string;
  highWatermark?: number;
  updatedAt: number;
}

export interface SyncResource {
  id: string;
  version: number;
  updatedAt: number;
}

export interface SyncPage<TResource extends SyncResource> {
  resources: TResource[];
  nextCursor?: string;
  highWatermark?: number;
}

export interface SyncSource<TResource extends SyncResource> {
  fetchChanges(checkpoint?: SyncCheckpoint): Promise<SyncPage<TResource>>;
}

export interface CheckpointStore {
  load(key: string): Promise<SyncCheckpoint | undefined>;
  save(key: string, checkpoint: SyncCheckpoint): Promise<void>;
}

export interface ResourceStore<TResource extends SyncResource> {
  get(id: string): Promise<TResource | undefined>;
  upsert(resource: TResource): Promise<void>;
}

export interface SyncConflict<TResource extends SyncResource> {
  id: string;
  local: TResource;
  remote: TResource;
}

export interface SyncResult<TResource extends SyncResource> {
  applied: TResource[];
  conflicts: SyncConflict<TResource>[];
  skipped: TResource[];
  checkpoint: SyncCheckpoint;
}

export interface IncrementalSyncEngineConfig<TResource extends SyncResource> {
  key: string;
  source: SyncSource<TResource>;
  checkpointStore: CheckpointStore;
  resourceStore: ResourceStore<TResource>;
  conflictStrategy?: SyncConflictStrategy<TResource>;
  maxPages?: number;
  now?: () => number;
}

export class InMemoryCheckpointStore implements CheckpointStore {
  private readonly checkpoints = new Map<string, SyncCheckpoint>();

  load(key: string): Promise<SyncCheckpoint | undefined> {
    const checkpoint = this.checkpoints.get(key);
    return Promise.resolve(checkpoint ? { ...checkpoint } : undefined);
  }

  save(key: string, checkpoint: SyncCheckpoint): Promise<void> {
    this.checkpoints.set(key, { ...checkpoint });
    return Promise.resolve();
  }

  clear(): void {
    this.checkpoints.clear();
  }
}

export class InMemoryResourceStore<
  TResource extends SyncResource,
> implements ResourceStore<TResource> {
  private readonly resources = new Map<string, TResource>();

  constructor(initial: TResource[] = []) {
    initial.forEach((resource) => {
      this.resources.set(resource.id, resource);
    });
  }

  get(id: string): Promise<TResource | undefined> {
    return Promise.resolve(this.resources.get(id));
  }

  upsert(resource: TResource): Promise<void> {
    this.resources.set(resource.id, resource);
    return Promise.resolve();
  }

  list(): TResource[] {
    return Array.from(this.resources.values());
  }
}

export class IncrementalSyncEngine<TResource extends SyncResource> {
  private readonly conflictStrategy: SyncConflictStrategy<TResource>;
  private readonly maxPages: number;
  private readonly now: () => number;

  constructor(private readonly config: IncrementalSyncEngineConfig<TResource>) {
    if (config.maxPages !== undefined && config.maxPages < 1) {
      throw new Error('IncrementalSyncEngine maxPages must be at least 1');
    }

    this.conflictStrategy = config.conflictStrategy ?? 'prefer-remote';
    this.maxPages = config.maxPages ?? 100;
    this.now = config.now ?? Date.now;
  }

  async sync(): Promise<SyncResult<TResource>> {
    let checkpoint = await this.config.checkpointStore.load(this.config.key);
    let pages = 0;
    const applied: TResource[] = [];
    const conflicts: SyncConflict<TResource>[] = [];
    const skipped: TResource[] = [];

    while (pages < this.maxPages) {
      const page = await this.config.source.fetchChanges(checkpoint);
      pages++;

      for (const remote of page.resources) {
        const local = await this.config.resourceStore.get(remote.id);

        if (!local) {
          await this.applyResource(remote, applied);
          continue;
        }

        if (remote.version > local.version) {
          await this.applyResource(remote, applied);
          continue;
        }

        if (remote.version === local.version) {
          skipped.push(remote);
          continue;
        }

        const conflict = { id: remote.id, local, remote };
        conflicts.push(conflict);
        const resolved = this.resolveConflict(conflict);

        if (resolved !== local) {
          await this.applyResource(resolved, applied);
        } else {
          skipped.push(remote);
        }
      }

      checkpoint = this.buildCheckpoint(page, checkpoint);
      await this.config.checkpointStore.save(this.config.key, checkpoint);

      if (!page.nextCursor) {
        break;
      }
    }

    if (pages >= this.maxPages) {
      throw new Error(`IncrementalSyncEngine stopped after maxPages=${String(this.maxPages)}`);
    }

    return {
      applied,
      conflicts,
      skipped,
      checkpoint:
        checkpoint ??
        ({
          updatedAt: this.now(),
        } satisfies SyncCheckpoint),
    };
  }

  private async applyResource(resource: TResource, applied: TResource[]): Promise<void> {
    await this.config.resourceStore.upsert(resource);
    applied.push(resource);
  }

  private resolveConflict(conflict: SyncConflict<TResource>): TResource {
    if (typeof this.conflictStrategy === 'function') {
      return this.conflictStrategy(conflict);
    }

    return this.conflictStrategy === 'prefer-local' ? conflict.local : conflict.remote;
  }

  private buildCheckpoint(page: SyncPage<TResource>, previous?: SyncCheckpoint): SyncCheckpoint {
    const latestResourceWatermark = page.resources.reduce(
      (latest, resource) => Math.max(latest, resource.updatedAt),
      previous?.highWatermark ?? 0
    );

    return {
      cursor: page.nextCursor,
      highWatermark: page.highWatermark ?? latestResourceWatermark,
      updatedAt: this.now(),
    };
  }
}
