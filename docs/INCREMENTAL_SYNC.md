# Incremental Sync

`IncrementalSyncEngine` gives SDK integrations a reusable way to fetch only
resources that changed after the last checkpoint. It keeps the engine independent
from a specific RPC transport by accepting abstract source, checkpoint-store, and
resource-store adapters.

```ts
import {
  IncrementalSyncEngine,
  InMemoryCheckpointStore,
  InMemoryResourceStore,
} from 'axionvera-sdk';

const engine = new IncrementalSyncEngine({
  key: 'contract-events',
  source: {
    async fetchChanges(checkpoint) {
      return rpcEventSource.fetchSince(checkpoint?.cursor);
    },
  },
  checkpointStore: new InMemoryCheckpointStore(),
  resourceStore: new InMemoryResourceStore(),
  conflictStrategy: 'prefer-remote',
});

const result = await engine.sync();
```

## Checkpoints

Checkpoints store a cursor, high-watermark, and update timestamp. The engine saves
a checkpoint after every processed page, so a later run resumes from the last
known cursor instead of refreshing all data.

## Conflict Resolution

When a remote resource is older than the local copy, the engine records a
conflict and resolves it with one of three strategies:

- `prefer-local`
- `prefer-remote`
- a custom resolver callback

Equal-version resources are skipped. Newer remote resources are applied.

## Pagination Guard

`maxPages` prevents unbounded pagination loops caused by a bad source adapter. It
defaults to 100 pages per sync run.

## Performance Notes

The engine reduces bandwidth and local write churn by loading only resources
returned by `fetchChanges(checkpoint)` and by skipping equal-version resources.
For production benchmarks, compare full-refresh resource counts against
`result.applied.length + result.skipped.length` for the same period.
