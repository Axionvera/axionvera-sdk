import { Transaction, rpc } from '@stellar/stellar-sdk';
import { StellarClient } from '../client';

/**
 * Helper to simulate a transaction and extract the required Soroban resources.
 */
export async function getSimulationResult(
  client: StellarClient,
  tx: Transaction
): Promise<rpc.Api.SimulateTransactionResponse> {
  const simulation = await client.simulateTransaction(tx);
  return simulation;
}
