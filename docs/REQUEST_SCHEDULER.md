# Request Scheduler

`RequestScheduler` coordinates SDK operations with priority-aware queueing,
concurrency limits, queue timeouts, cancellation, and starvation protection.
It is useful when an app mixes low-priority background reads with high-priority
transaction or account operations.

```ts
import { RequestScheduler, createScheduledClient } from 'axionvera-sdk';

const scheduler = new RequestScheduler({
  maxConcurrentRequests: 4,
  queueTimeout: 30_000,
  defaultPriority: 'normal',
  agingInterval: 5_000,
  agingBoost: 1,
});

const client = createScheduledClient(stellarClient, scheduler, {
  submitTransaction: 'critical',
  getLatestLedger: 'low',
});

const transaction = await client.submitTransaction(tx);
```

## Priority Policy

Priorities can be named (`low`, `normal`, `high`, `critical`) or numeric. Higher
values run first. Requests with the same effective priority keep FIFO ordering.

Queued requests receive an aging boost after each `agingInterval`, preventing
low-priority work from being permanently starved by newer high-priority work.

## Cancellation

Queued work can be cancelled by request id or with an `AbortSignal`:

```ts
const controller = new AbortController();
const request = scheduler.schedule(fetchLedger, {
  id: 'ledger-refresh',
  priority: 'low',
  signal: controller.signal,
});

controller.abort();
await request;
```

Cancellation only rejects work that is still queued. Once an operation starts,
the scheduler lets the operation finish and then admits the next queued request.

## Monitoring

Use `getStats()` for counters and `getQueueSnapshot()` for queued request ids,
priorities, effective priorities, wait times, and metadata.
