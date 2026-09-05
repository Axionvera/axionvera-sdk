# Advanced Event Parsing Guide

## Overview

The `parseEvents()` utility provides a powerful, generic way to parse raw XDR events from Soroban contracts without writing custom base64 decoders. This guide is essential for developers building custom contracts using `BaseContract` or any Soroban contract implementation.

## Quick Start

```typescript
import { StellarClient, parseEvents } from "axionvera-sdk";

const client = new StellarClient({ network: "testnet" });

// Fetch events from the network
const eventResponse = await client.rpc.getEvents({
  startLedger: 1000,
  limit: 100
});

// Parse events with diagnostic filtering
const parsedEvents = parseEvents(eventResponse.results, { 
  filterDiagnostic: true 
});

// Access structured event data
parsedEvents.forEach(event => {
  console.log(`Event: ${event.eventName}`);
  console.log(`Topics: ${JSON.stringify(event.topics)}`);
  console.log(`Data: ${JSON.stringify(event.data)}`);
});
```

## Understanding Event Structure

### Raw RPC Response

When you fetch events from Soroban RPC, you get XDR-encoded data that looks like this:

```json
{
  "type": "contract",
  "topic": [
    "AAAADgAAABRUcmFuc2Zlck9wZXJhdGlvbg==",
    "AAAAEwAAABRGcm9tQWNjb3VudA=="
  ],
  "data": "AAAADgAAABRBbW91bnQ=",
  "ledger": 5000000,
  "contractId": "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB"
}
```

This is not human-readable. The `parseEvents()` utility decodes this into:

```typescript
{
  topics: ["TransferOperation", "FromAccount"],
  data: "Amount",
  eventName: "TransferOperation",
  isDiagnostic: false
}
```

### Parsed Event Structure

```typescript
type ParsedEvent = {
  // Array of decoded topics (first is typically event name)
  topics: DecodedTopic[];
  
  // Decoded event data payload
  data?: DecodedTopic;
  
  // Convenience property: first topic if it's a string
  eventName?: string;
  
  // Whether this is a diagnostic event (internal Soroban event)
  isDiagnostic?: boolean;
  
  // Raw RPC event (included if includeRaw: true option is set)
  raw?: any;
};

type DecodedTopic = string | number | bigint | boolean | null;
```

## Advanced Usage Patterns

### 1. Parsing Contract Events

For a custom contract that emits events, you can now easily parse them:

```typescript
import { parseEvents } from "axionvera-sdk";

// Custom contract event structure
interface MyContractEvent {
  eventName: string;
  topics: any[];
  data: any;
}

const events = await client.rpc.getEvents({
  startLedger: 1000
});

const parsed = parseEvents(events.results);

// Filter by event name
const transferEvents = parsed.filter(e => e.eventName === "transfer");
const approveEvents = parsed.filter(e => e.eventName === "approve");

// Process events
transferEvents.forEach(event => {
  console.log(`Transfer: ${event.data} units`);
  console.log(`Topics: from, to, amount = ${event.topics.join(", ")}`);
});
```

### 2. Filtering Diagnostic Events

Diagnostic events are internal Soroban events that may clutter your output. Filter them out:

```typescript
// Without filtering - includes diagnostic events
const allEvents = parseEvents(events.results);

// With filtering - only contract events
const contractEvents = parseEvents(events.results, { 
  filterDiagnostic: true 
});

console.log(`Total events: ${allEvents.length}`);
console.log(`Contract events: ${contractEvents.length}`);
```

### 3. Comparing Diagnostic vs Contract Events

```typescript
const parsed = parseEvents(events.results, { filterDiagnostic: false });

// Separate diagnostic and contract events
const diagnosticEvents = parsed.filter(e => e.isDiagnostic);
const contractEvents = parsed.filter(e => !e.isDiagnostic);

console.log(`Contract events: ${contractEvents.length}`);
console.log(`Diagnostic events: ${diagnosticEvents.length}`);

// Diagnostic events are useful for debugging contract execution
diagnosticEvents.forEach(event => {
  console.log("Diagnostic:", event.eventName, event.data);
});
```

### 4. Including Raw RPC Data

For debugging or when you need the original RPC response:

```typescript
const parsed = parseEvents(events.results, { 
  includeRaw: true,
  filterDiagnostic: true 
});

parsed.forEach(event => {
  console.log("Parsed data:", event.eventName, event.data);
  console.log("Raw RPC data:", event.raw);
  console.log("Contract ID:", event.raw.contractId);
  console.log("Ledger:", event.raw.ledger);
});
```

### 5. Building an Event Logger

```typescript
function createEventLogger() {
  return async (contractId: string, startLedger: number) => {
    const events = await client.rpc.getEvents({
      filters: [{ contractIds: [contractId] }],
      startLedger,
      limit: 100
    });

    const parsed = parseEvents(events.results, { 
      filterDiagnostic: true 
    });

    return {
      total: parsed.length,
      byType: parsed.reduce((acc, event) => {
        acc[event.eventName || 'unknown'] = 
          (acc[event.eventName || 'unknown'] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      events: parsed
    };
  };
}

const logger = createEventLogger();
const log = await logger(contractId, 1000);

console.log(`Total events: ${log.total}`);
console.log(`Event breakdown:`, log.byType);
```

### 6. Processing Event Chains

Parse multiple event batches and process them sequentially:

```typescript
async function processEventBatches(contractId: string) {
  let currentLedger = 1000;
  const batchSize = 100;
  const allEvents: any[] = [];

  while (currentLedger < 5000000) {
    const events = await client.rpc.getEvents({
      filters: [{ contractIds: [contractId] }],
      startLedger: currentLedger,
      limit: batchSize
    });

    if (!events.results || events.results.length === 0) {
      break;
    }

    const parsed = parseEvents(events.results, { 
      filterDiagnostic: true 
    });
    
    allEvents.push(...parsed);
    currentLedger += batchSize;
  }

  return allEvents;
}
```

### 7. Real-Time Event Monitoring

```typescript
import { StellarClient, parseEvents } from "axionvera-sdk";

async function monitorContractEvents(
  contractId: string, 
  callback: (event: any) => void
) {
  let lastLedger = await client.getLatestLedger() as any;
  
  const interval = setInterval(async () => {
    try {
      const events = await client.rpc.getEvents({
        filters: [{ contractIds: [contractId] }],
        startLedger: lastLedger + 1,
        limit: 50
      });

      if (events.results && events.results.length > 0) {
        const parsed = parseEvents(events.results, { 
          filterDiagnostic: true 
        });

        parsed.forEach(callback);
        
        // Update lastLedger from the last event
        if (events.results.length > 0) {
          lastLedger = events.results[events.results.length - 1].ledger;
        }
      }
    } catch (error) {
      console.error("Error monitoring events:", error);
    }
  }, 12000); // Poll every 12 seconds (Soroban block time)

  return () => clearInterval(interval);
}

// Usage
const unsubscribe = await monitorContractEvents(
  myContractId,
  (event) => {
    console.log(`New event: ${event.eventName}`, event.data);
  }
);

// Later, stop monitoring
unsubscribe();
```

### 8. Type-Safe Event Handling

```typescript
import { parseEvents, ParsedEvent } from "axionvera-sdk";

interface TransferEvent extends ParsedEvent {
  eventName: "transfer";
  topics: [string, string, string]; // from, to
  data: number | bigint; // amount
}

interface ApproveEvent extends ParsedEvent {
  eventName: "approve";
  topics: [string, string]; // owner, spender
  data: number | bigint; // amount
}

type TokenEvent = TransferEvent | ApproveEvent;

function isTransferEvent(event: ParsedEvent): event is TransferEvent {
  return event.eventName === "transfer" && event.topics.length === 3;
}

function isApproveEvent(event: ParsedEvent): event is ApproveEvent {
  return event.eventName === "approve" && event.topics.length === 2;
}

const events = parseEvents(eventResults, { filterDiagnostic: true });

events.forEach(event => {
  if (isTransferEvent(event)) {
    console.log(`Transfer from ${event.topics[0]} to ${event.topics[1]}: ${event.data}`);
  } else if (isApproveEvent(event)) {
    console.log(`Approve ${event.topics[1]} for ${event.data}`);
  }
});
```

## Decoding Different Data Types

The `parseEvents()` utility automatically handles various Soroban data types:

```typescript
import { parseEvents } from "axionvera-sdk";

const parsed = parseEvents(events.results, { filterDiagnostic: true });

parsed.forEach(event => {
  // Strings and symbols are automatically decoded
  if (typeof event.eventName === "string") {
    console.log(`Event name: ${event.eventName}`);
  }

  // Numbers and BigInt are decoded from i128/u128
  if (typeof event.data === "number") {
    console.log(`Numeric data: ${event.data}`);
  }

  if (typeof event.data === "bigint") {
    console.log(`Large integer: ${event.data.toString()}`);
  }

  // Booleans are supported
  if (typeof event.data === "boolean") {
    console.log(`Boolean data: ${event.data}`);
  }

  // Null represents void
  if (event.data === null) {
    console.log(`Event has no data`);
  }
});
```

## Error Handling

The `parseEvents()` utility is robust and handles errors gracefully:

```typescript
import { parseEvents } from "axionvera-sdk";

// Invalid input types return empty array
parseEvents(null); // []
parseEvents(undefined); // []
parseEvents("not an array"); // []

// Events with invalid XDR are skipped
const mixed = [
  { type: "contract", topic: ["valid_base64"], ledger: 1000 },
  { type: "contract", topic: ["!!!invalid"], ledger: 1001 }
];

const result = parseEvents(mixed);
// Will include both events, invalid ones will have raw data in topics array
```

## Performance Considerations

For processing large event batches:

```typescript
// Efficient batch processing
const allEvents: any[] = [];

const batches = await Promise.all([
  client.rpc.getEvents({ startLedger: 1000, limit: 100 }),
  client.rpc.getEvents({ startLedger: 1100, limit: 100 }),
  client.rpc.getEvents({ startLedger: 1200, limit: 100 })
]);

// Parse all batches
batches.forEach(batch => {
  if (batch.results) {
    const parsed = parseEvents(batch.results, { filterDiagnostic: true });
    allEvents.push(...parsed);
  }
});

console.log(`Total parsed events: ${allEvents.length}`);
```

## Troubleshooting

### Issue: No events are being parsed

```typescript
// Check if events array is returned from RPC
const eventResponse = await client.rpc.getEvents({ startLedger: 1000 });
console.log("Event response:", eventResponse);
console.log("Results:", eventResponse.results);

// The results array is what you pass to parseEvents
const parsed = parseEvents(eventResponse.results);
```

### Issue: Event name is undefined

```typescript
const parsed = parseEvents(events.results, { filterDiagnostic: true });

parsed.forEach(event => {
  // Event name is only set if the first topic is a string
  if (!event.eventName) {
    console.log("First topic type:", typeof event.topics[0]);
    console.log("First topic value:", event.topics[0]);
  }
});
```

### Issue: Data is not being decoded

```typescript
// Use includeRaw to see what the raw XDR data is
const parsed = parseEvents(events.results, { includeRaw: true });

parsed.forEach(event => {
  console.log("Raw data:", event.raw.data);
  console.log("Parsed data:", event.data);
  
  // If they're the same, the data couldn't be decoded
  if (event.raw.data === event.data) {
    console.warn("Data couldn't be decoded");
  }
});
```

## API Reference

### parseEvents(events, options?)

Parses Soroban RPC events into structured JSON.

**Parameters:**
- `events` (Array): Raw events array from Soroban RPC
- `options` (Object, optional):
  - `filterDiagnostic` (boolean): Filter out diagnostic events (default: false)
  - `includeRaw` (boolean): Include raw RPC event in results (default: false)

**Returns:**
- Array of `ParsedEvent` objects

**Example:**
```typescript
const parsed = parseEvents(eventResponse.results, {
  filterDiagnostic: true,
  includeRaw: false
});
```

### decodeSorobanSymbol(scVal)

Decodes a single ScVal symbol to a string.

**Parameters:**
- `scVal` (xdr.ScVal): The XDR ScVal object

**Returns:**
- String representation of the symbol

**Example:**
```typescript
import { decodeSorobanSymbol } from "axionvera-sdk";
import { decodeXdrBase64 } from "axionvera-sdk";

const scVal = decodeXdrBase64("AAAADQAAAA50ZXN0X3N5bWJvbA==");
const symbol = decodeSorobanSymbol(scVal);
console.log(symbol); // "test_symbol"
```

## Related Documentation

- [Soroban Event Streaming](https://soroban.stellar.org/docs/learn/events)
- [BaseContract Guide](./basecontract.md)
- [Custom Contract Integration](./custom-contracts.md)
