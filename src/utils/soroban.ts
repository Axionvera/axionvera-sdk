import { xdr } from "@stellar/stellar-sdk";
import { decodeXdrBase64 } from "./xdrCache";

/**
 * Decodes a Soroban Symbol ScVal into a JavaScript UTF-8 string.
 * Soroban Symbols are used for function names, event topics, and short strings.
 * They are limited to 32 characters and a specific charset [a-zA-Z0-9_].
 * 
 * @param scVal - The ScVal to decode, should be of type scvSymbol
 * @returns The decoded string
 */
export function decodeSorobanSymbol(scVal: xdr.ScVal): string {
  const s = scVal as any;
  const arm = s.arm();
  
  if (arm === 'sym' || arm === 'str') {
    const value = s.value();
    return value ? value.toString() : "";
  }

  return "";
}

/**
 * Generic utility to parse Soroban events from RPC responses.
 * Converts XDR-encoded topics and values into more accessible formats where possible.
 * 
 * @param events - Raw events from Soroban RPC (GetEventsResponse)
 * @returns Parsed events with decoded symbols
 */
export function parseEvents(events: any[]): any[] {
  return events.map(event => {
    const parsedEvent = { ...event };

    // Decode topics if they are base64 XDR strings
    if (Array.isArray(event.topic)) {
      parsedEvent.topicNames = event.topic.map((t: string) => {
        try {
          const scVal = decodeXdrBase64(t);
          const s = scVal as any;
          if (s.arm() === 'sym') {
            return decodeSorobanSymbol(scVal);
          }
          return t; // Keep as is if not a symbol
        } catch {
          return t;
        }
      });
    }

    // Add a convenience property for the primary topic (event name)
    if (parsedEvent.topicNames && parsedEvent.topicNames.length > 0) {
      parsedEvent.eventName = parsedEvent.topicNames[0];
    }

    return parsedEvent;
  });
}
