# Object Pooling

`ObjectPool` provides a small reusable-object lifecycle for high-frequency SDK
paths that allocate scratch buffers, temporary records, parser state, or other
short-lived objects. Reusing those objects reduces allocation churn and gives
callers observable pool statistics.

```ts
import { ObjectPool } from 'axionvera-sdk';

const scratchPool = new ObjectPool({
  name: 'scratch-buffers',
  warmSize: 8,
  maxSize: 64,
  factory: () => ({ bytes: new Uint8Array(1024), used: 0 }),
  reset: (item) => {
    item.bytes.fill(0);
    item.used = 0;
  },
});

const result = scratchPool.withBorrowed((scratch) => {
  scratch.bytes[0] = 1;
  scratch.used = 1;
  return scratch.used;
});
```

## Lifecycle

- `factory` creates new objects when the pool is empty.
- `reset` returns released objects to a clean state.
- `validate` can reject objects that should not be reused.
- `onCreate`, `onAcquire`, `onRelease`, and `onDestroy` expose lifecycle hooks.

`withBorrowed` automatically returns the object to the pool, even if the callback
throws. Direct `acquire`/`release` is available when a longer-lived borrow is
needed.

## Statistics

Each pool exposes:

- available and borrowed counts
- created, reused, released, destroyed, and discarded counters
- configured max size

`ObjectPoolManager` registers named pools and can report all pool statistics for
SDK diagnostics or benchmarks.

## Benchmark Notes

Use pooling for hot paths where allocations are measurable, such as repeated
buffer creation or parser scratch objects. Avoid pooling objects that hold
security-sensitive data unless their `reset` function fully clears that state.
