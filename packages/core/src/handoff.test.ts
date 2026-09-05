import { describe, expect, it } from 'vitest';
import { loadContractIdFromHandoff } from './handoff';
import { ValidationError } from './errors';
import * as fs from 'fs';
import * as path from 'path';

const FIXTURES_DIR = path.join(__dirname, 'testing/fixtures/handoff');

function readFixture(name: string) {
  const filePath = path.join(FIXTURES_DIR, `${name}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

describe('Contract Handoff Loader', () => {
  it('successfully loads a valid contract ID from a valid artifact', () => {
    const artifact = readFixture('valid');
    const contractId = loadContractIdFromHandoff(artifact, {
      contractName: 'vault',
      network: 'testnet'
    });
    expect(contractId).toBe('CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  });

  it('rejects when the contract is missing from the artifact', () => {
    const artifact = readFixture('valid');
    expect(() => {
      loadContractIdFromHandoff(artifact, {
        contractName: 'missing-contract',
        network: 'testnet'
      });
    }).toThrow(ValidationError);
    expect(() => {
      loadContractIdFromHandoff(artifact, {
        contractName: 'missing-contract',
        network: 'testnet'
      });
    }).toThrow('Contract "missing-contract" not found in handoff artifact');
  });

  it('rejects when the artifact structure is malformed', () => {
    const artifact = { invalid: 'structure' };
    expect(() => {
      loadContractIdFromHandoff(artifact, {
        contractName: 'vault',
        network: 'testnet'
      });
    }).toThrow(ValidationError);
    expect(() => {
      loadContractIdFromHandoff(artifact, {
        contractName: 'vault',
        network: 'testnet'
      });
    }).toThrow('Malformed handoff artifact');
  });

  it('rejects when the contract ID is malformed', () => {
    const artifact = readFixture('malformed');
    expect(() => {
      loadContractIdFromHandoff(artifact, {
        contractName: 'vault',
        network: 'testnet'
      });
    }).toThrow(ValidationError);
    expect(() => {
      loadContractIdFromHandoff(artifact, {
        contractName: 'vault',
        network: 'testnet'
      });
    }).toThrow('Invalid Soroban contract ID format or placeholder');
  });

  it('rejects when the network does not match', () => {
    const artifact = readFixture('wrong-network');
    expect(() => {
      loadContractIdFromHandoff(artifact, {
        contractName: 'vault',
        network: 'testnet'
      });
    }).toThrow(ValidationError);
    expect(() => {
      loadContractIdFromHandoff(artifact, {
        contractName: 'vault',
        network: 'testnet'
      });
    }).toThrow('Contract "vault" is deployed on mainnet, but expected testnet');
  });

  it('rejects placeholder contract IDs by default', () => {
    const artifact = readFixture('placeholder');
    expect(() => {
      loadContractIdFromHandoff(artifact, {
        contractName: 'vault',
        network: 'testnet'
      });
    }).toThrow(ValidationError);
    expect(() => {
      loadContractIdFromHandoff(artifact, {
        contractName: 'vault',
        network: 'testnet'
      });
    }).toThrow('Contract "vault" has a placeholder ID and placeholders are not allowed');
  });

  it('allows placeholder contract IDs when explicitly enabled', () => {
    const artifact = readFixture('placeholder');
    const contractId = loadContractIdFromHandoff(artifact, {
      contractName: 'vault',
      network: 'testnet',
      allowPlaceholders: true
    });
    expect(contractId).toBe('PLACEHOLDER_VAULT_ID');
  });
});
