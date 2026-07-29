import { AxionveraError, NetworkError } from '../errors';
import { VaultDepositParamsSchema, vaultV1ToV2Migration } from '../contracts';
import { CapabilityRegistry } from '../registry';
import { Logger } from '../utils';

const sameErrors = AxionveraError === (await import('./errors/axionveraError')).AxionveraError;
const sameContracts = VaultDepositParamsSchema === (await import('./contracts/contractSchemas')).VaultDepositParamsSchema;

if (!sameErrors) throw new Error('errors barrel mismatch');
if (!sameContracts) throw new Error('contracts barrel mismatch');

test('errors barrel exposes same symbols as direct file', () => {
  expect(typeof AxionveraError).toBe('function');
  expect(typeof NetworkError).toBe('function');
});

test('contracts barrel exposes schema + migration symbols', () => {
  expect(VaultDepositParamsSchema).toBeDefined();
  expect(vaultV1ToV2Migration).toBeDefined();
});

test('registry barrel exposes CapabilityRegistry', () => {
  expect(CapabilityRegistry).toBeDefined();
});

test('utils barrel exposes Logger', () => {
  expect(Logger).toBeDefined();
});
