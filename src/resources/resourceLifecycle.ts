export type ResourceLifecycleState =
  'registered' | 'initialized' | 'started' | 'stopped' | 'disposed' | 'failed';

export interface ManagedResource {
  id: string;
  dependencies?: string[];
  initialize?: () => Promise<void> | void;
  start?: () => Promise<void> | void;
  stop?: () => Promise<void> | void;
  dispose?: () => Promise<void> | void;
  healthCheck?: () => Promise<boolean> | boolean;
}

export interface ResourceLifecycleSnapshot {
  id: string;
  state: ResourceLifecycleState;
  dependencies: string[];
  error?: string;
}

interface ResourceEntry {
  resource: ManagedResource;
  state: ResourceLifecycleState;
  error?: string;
}

export class ResourceLifecycleManager {
  private readonly resources = new Map<string, ResourceEntry>();

  register(resource: ManagedResource): this {
    if (this.resources.has(resource.id)) {
      throw new Error(`Resource "${resource.id}" is already registered`);
    }

    this.resources.set(resource.id, {
      resource,
      state: 'registered',
    });

    return this;
  }

  unregister(id: string): boolean {
    const entry = this.resources.get(id);
    if (!entry) {
      return false;
    }

    if (entry.state !== 'disposed' && entry.state !== 'registered') {
      throw new Error(`Resource "${id}" must be disposed before unregistering`);
    }

    return this.resources.delete(id);
  }

  async initializeAll(): Promise<void> {
    for (const entry of this.getDependencyOrderedEntries()) {
      await this.transition(entry, 'initialized', entry.resource.initialize);
    }
  }

  async startAll(): Promise<void> {
    for (const entry of this.getDependencyOrderedEntries()) {
      if (entry.state === 'registered') {
        await this.transition(entry, 'initialized', entry.resource.initialize);
      }

      await this.transition(entry, 'started', entry.resource.start);
    }
  }

  async stopAll(): Promise<void> {
    const entries = this.getDependencyOrderedEntries().reverse();

    for (const entry of entries) {
      if (entry.state === 'started') {
        await this.transition(entry, 'stopped', entry.resource.stop);
      }
    }
  }

  async disposeAll(): Promise<void> {
    const entries = this.getDependencyOrderedEntries().reverse();

    for (const entry of entries) {
      if (entry.state === 'started') {
        await this.transition(entry, 'stopped', entry.resource.stop);
      }

      if (entry.state !== 'disposed') {
        await this.transition(entry, 'disposed', entry.resource.dispose);
      }
    }
  }

  async shutdownGracefully(): Promise<void> {
    await this.stopAll();
    await this.disposeAll();
  }

  async getHealth(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};

    for (const [id, entry] of this.resources) {
      health[id] = entry.resource.healthCheck ? await entry.resource.healthCheck() : true;
    }

    return health;
  }

  getSnapshot(): ResourceLifecycleSnapshot[] {
    return Array.from(this.resources.values()).map((entry) => ({
      id: entry.resource.id,
      state: entry.state,
      dependencies: entry.resource.dependencies ?? [],
      error: entry.error,
    }));
  }

  require(id: string): ManagedResource {
    const entry = this.resources.get(id);
    if (!entry) {
      throw new Error(`Resource "${id}" is not registered`);
    }

    return entry.resource;
  }

  clear(): void {
    this.resources.clear();
  }

  private async transition(
    entry: ResourceEntry,
    nextState: ResourceLifecycleState,
    hook?: () => Promise<void> | void
  ): Promise<void> {
    try {
      await hook?.();
      entry.state = nextState;
      entry.error = undefined;
    } catch (error) {
      entry.state = 'failed';
      entry.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  private getDependencyOrderedEntries(): ResourceEntry[] {
    const ordered: ResourceEntry[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (id: string) => {
      if (visited.has(id)) {
        return;
      }

      if (visiting.has(id)) {
        throw new Error(`Circular resource dependency detected at "${id}"`);
      }

      const entry = this.resources.get(id);
      if (!entry) {
        throw new Error(`Resource "${id}" is not registered`);
      }

      visiting.add(id);
      for (const dependency of entry.resource.dependencies ?? []) {
        visit(dependency);
      }
      visiting.delete(id);
      visited.add(id);
      ordered.push(entry);
    };

    for (const id of this.resources.keys()) {
      visit(id);
    }

    return ordered;
  }
}

export const resourceLifecycleManager = new ResourceLifecycleManager();
