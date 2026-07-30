/**
 * Deterministic fixtures for regression tests.
 *
 * Every fixture returns the same value on every call so that
 * regression suites are reproducible across runs.
 */

export const FIXTURE_ADDRESS = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

export const FIXTURE_SECRET = 'SBZ5ZCZ5ZCZ5ZCZ5ZCZ5ZCZ5ZCZ5ZCZ5ZCZ5ZCZ5ZCZ5ZCZ5ZCZ5ZC';

export const FIXTURE_CONTRACT_ID = 'CA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

export function makeAccount(id = FIXTURE_ADDRESS) {
  return { id, balance: '1000000', sequence: '1' };
}

export function makeTransaction(id = 'tx-fixture-001') {
  return { id, source: FIXTURE_ADDRESS, fee: '100', operations: [] };
}
