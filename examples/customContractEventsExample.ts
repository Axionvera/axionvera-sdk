/**
 * Example: Parsing Custom Contract Events
 *
 * This example demonstrates how to use the parseEvents() utility to parse
 * raw XDR events from custom Soroban contracts without writing custom base64 decoders.
 *
 * Perfect for developers building custom contracts using BaseContract.
 */

import { StellarClient, parseEvents } from "../src";

async function main(): Promise<void> {
  const network = (process.env.STELLAR_NETWORK as "testnet" | "mainnet" | undefined) ?? "testnet";
  const rpcUrl = process.env.STELLAR_RPC_URL;
  const contractId = process.env.CUSTOM_CONTRACT_ID;

  if (!contractId) {
    throw new Error("CUSTOM_CONTRACT_ID is required");
  }

  const client = new StellarClient({ network, rpcUrl });

  console.log("📋 Fetching custom contract events...");

  // Fetch events from the custom contract
  const eventResponse = await client.rpc.getEvents({
    filters: [{ contractIds: [contractId] }],
    startLedger: parseInt(process.env.START_LEDGER ?? "1000"),
    limit: parseInt(process.env.EVENT_LIMIT ?? "50")
  });

  if (!eventResponse.results || eventResponse.results.length === 0) {
    console.log("❌ No events found for this contract");
    return;
  }

  console.log(`✅ Found ${eventResponse.results.length} raw events`);

  // EXAMPLE 1: Parse events with diagnostic filtering
  console.log("\n=== Example 1: Basic Event Parsing ===");
  const contractEvents = parseEvents(eventResponse.results, {
    filterDiagnostic: true
  });

  console.log(`📊 Contract events: ${contractEvents.length}`);
  console.log(`\nFirst few events:`);

  contractEvents.slice(0, 3).forEach((event, index) => {
    console.log(`\n  Event ${index + 1}:`);
    console.log(`    Event Name: ${event.eventName || "unknown"}`);
    console.log(`    Topics: ${event.topics.map(t => String(t)).join(" | ")}`);
    console.log(`    Data: ${JSON.stringify(event.data)}`);
    console.log(`    Diagnostic: ${event.isDiagnostic}`);
  });

  // EXAMPLE 2: Filter events by name
  console.log("\n=== Example 2: Filtering Events by Name ===");
  const uniqueEventNames = [...new Set(contractEvents.map(e => e.eventName || "unknown"))];
  console.log(`Unique event names: ${uniqueEventNames.join(", ")}`);

  uniqueEventNames.forEach(eventName => {
    const count = contractEvents.filter(e => e.eventName === eventName).length;
    console.log(`  - ${eventName}: ${count} occurrence(s)`);
  });

  // EXAMPLE 3: Including raw data for debugging
  console.log("\n=== Example 3: Raw Data for Debugging ===");
  const eventsWithRaw = parseEvents(eventResponse.results, {
    filterDiagnostic: true,
    includeRaw: true
  });

  const firstEvent = eventsWithRaw[0];
  if (firstEvent && firstEvent.raw) {
    console.log("Raw event structure:");
    console.log(JSON.stringify(
      {
        type: firstEvent.raw.type,
        ledger: firstEvent.raw.ledger,
        contractId: firstEvent.raw.contractId,
        topicCount: firstEvent.raw.topic?.length
      },
      null,
      2
    ));
  }

  // EXAMPLE 4: Detecting diagnostic events
  console.log("\n=== Example 4: Diagnostic Event Detection ===");
  const allEvents = parseEvents(eventResponse.results, {
    filterDiagnostic: false
  });

  const diagnostic = allEvents.filter(e => e.isDiagnostic).length;
  const contract = allEvents.filter(e => !e.isDiagnostic).length;

  console.log(`Total events: ${allEvents.length}`);
  console.log(`  - Contract events: ${contract}`);
  console.log(`  - Diagnostic events: ${diagnostic}`);

  // EXAMPLE 5: Data type analysis
  console.log("\n=== Example 5: Data Type Analysis ===");
  const typeCount: Record<string, number> = {};

  contractEvents.forEach(event => {
    const dataType = event.data === null ? "null" : typeof event.data;
    typeCount[dataType] = (typeCount[dataType] || 0) + 1;
  });

  console.log("Event data types found:");
  Object.entries(typeCount).forEach(([type, count]) => {
    console.log(`  - ${type}: ${count}`);
  });

  // EXAMPLE 6: Building event statistics
  console.log("\n=== Example 6: Event Statistics ===");
  const stats = {
    total: contractEvents.length,
    byName: {} as Record<string, number>,
    topicCounts: {} as Record<number, number>,
    hasData: 0,
    noData: 0
  };

  contractEvents.forEach(event => {
    // Count by event name
    const name = event.eventName || "unknown";
    stats.byName[name] = (stats.byName[name] || 0) + 1;

    // Count topic frequencies
    const topicCount = event.topics.length;
    stats.topicCounts[topicCount] = (stats.topicCounts[topicCount] || 0) + 1;

    // Count events with/without data
    if (event.data === undefined || event.data === null) {
      stats.noData++;
    } else {
      stats.hasData++;
    }
  });

  console.log(JSON.stringify(stats, null, 2));

  // EXAMPLE 7: Error handling and edge cases
  console.log("\n=== Example 7: Error Handling ===");

  // Handle different input types gracefully
  const emptyResult = parseEvents([], { filterDiagnostic: true });
  console.log(`✅ Empty array handled: ${emptyResult.length} events`);

  const undefinedResult = parseEvents(undefined, { filterDiagnostic: true });
  console.log(`✅ Undefined input handled: ${undefinedResult.length} events`);

  // EXAMPLE 8: Event processing pipeline
  console.log("\n=== Example 8: Event Processing Pipeline ===");

  interface ProcessedEvent {
    name: string;
    ledger: number;
    topics: string[];
    parsedData: any;
  }

  const pipeline = (events: typeof contractEvents): ProcessedEvent[] => {
    return events
      .filter(e => typeof e.eventName === "string") // Filter valid event names
      .map(e => ({
        name: e.eventName!,
        ledger: e.raw?.ledger || 0,
        topics: e.topics.map(t => String(t)),
        parsedData: e.data
      }))
      .slice(0, 5) // Limit to 5 for display
  };

  const processed = pipeline(contractEvents);
  console.log(`Processed ${processed.length} events through pipeline:`);
  processed.forEach((event, i) => {
    console.log(`  ${i + 1}. ${event.name} (Ledger ${event.ledger})`);
  });

  // EXAMPLE 9: Real-world use case - Transaction tracking
  console.log("\n=== Example 9: Transaction Tracking Pattern ===");

  // Group events by some transaction identifier (e.g., first topic)
  const eventGroups = new Map<string, typeof contractEvents>();

  contractEvents.forEach(event => {
    const key = event.topics[0] ? String(event.topics[0]) : "unknown";
    if (!eventGroups.has(key)) {
      eventGroups.set(key, []);
    }
    eventGroups.get(key)!.push(event);
  });

  console.log(`Events grouped by transaction ID:`);
  let groupCount = 0;
  eventGroups.forEach((events, key) => {
    if (groupCount < 3) {
      console.log(`  Transaction ${key}: ${events.length} event(s)`);
      groupCount++;
    }
  });
  console.log(`  ... and ${eventGroups.size - groupCount} more transaction groups`);

  console.log("\n✅ Event parsing demonstration complete!");
  console.log("\nKey takeaways:");
  console.log("  1. Use parseEvents() to decode raw XDR events");
  console.log("  2. Set filterDiagnostic: true to focus on contract events");
  console.log("  3. Use includeRaw: true for debugging");
  console.log("  4. Fields like eventName, topics, and data are now readable");
  console.log("  5. Handle null/undefined gracefully with type guarding");
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
