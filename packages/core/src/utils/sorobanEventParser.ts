export type { ParsedEvent as ParsedSorobanEvent } from './soroban';
import { scValToNative, rpc } from "@stellar/stellar-sdk";

export type ParsedEvent = {
type: string;
data: unknown;
ledger: number;
contractId: string;
pagingToken: string;
};

/**
* Robustly parses Soroban events.
* Maps raw RPC event responses to a cleaner, typed structure.
*/
export function parseSorobanEvent(event: rpc.Api.EventResponse): ParsedEvent {
  // 1. Parse the topic (usually the event name)
  const topics = event.topic.map((t) => scValToNative(t));
  const eventName = typeof topics[0] === 'string' ? topics[0] : 'unknown';

  // 2. Return with all necessary metadata for downstream logic
  return {
    type: eventName,
    data: scValToNative(event.value),
    ledger: event.ledger,
    contractId: event.contractId,
    pagingToken: event.pagingToken,
  };
}