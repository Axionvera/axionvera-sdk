export type { ParsedEvent as ParsedSorobanEvent } from './soroban';
import { scValToNative, rpc } from "@stellar/stellar-sdk";

export type ParsedEvent = {
  type: string;
  data: unknown;
  ledger: number;
  contractId: string;
  /** pagingToken is not available on the parsed EventResponse shape */
  pagingToken?: string;
};

/**
 * Robustly parses Soroban events.
 * Maps raw RPC event responses to a cleaner, typed structure.
 *
 * Note: `rpc.Api.EventResponse.contractId` is typed as `Contract | undefined`.
 * We call `.toString()` on it (which returns the contract address string) and
 * fall back to an empty string when it is absent.
 *
 * `pagingToken` is not present on the decoded `EventResponse` type — it exists
 * only on the raw wire format (`RawEventResponse`). The field is therefore
 * omitted from the returned object so callers must source it from
 * `GetContractEventsResult.pagingToken` instead.
 */
export function parseSorobanEvent(event: rpc.Api.EventResponse): ParsedEvent {
  // 1. Parse the topic (usually the event name)
  const topics = event.topic.map((t) => scValToNative(t));
  const eventName = typeof topics[0] === 'string' ? topics[0] : 'unknown';

  // 2. Safely extract contractId: the SDK types it as Contract | undefined
  const contractId = event.contractId != null ? event.contractId.toString() : '';

  // 3. Return with all necessary metadata for downstream logic.
  //    pagingToken is intentionally omitted — it is not part of EventResponse.
  return {
    type: eventName,
    data: scValToNative(event.value),
    ledger: event.ledger,
    contractId,
  };
}