import {
  TransactionSerializationCache,
  createTransactionEnvelope,
  decodeTransactionEnvelope,
  deserializeTransactionEnvelope,
  serializeTransactionEnvelope,
} from '../../src/serialization';

function createTransaction(xdr = 'AAAA-test-xdr') {
  return {
    source: 'G_SOURCE',
    fee: '100',
    sequence: '123',
    operations: [{ type: 'invoke' }],
    toXDR: jest.fn(() => xdr),
  };
}

describe('transaction serialization utilities', () => {
  it('serializes protocol payloads with optional metadata', () => {
    const transaction = createTransaction();

    const encoded = serializeTransactionEnvelope(transaction, {
      networkPassphrase: 'Test SDF Network ; September 2015',
      includeMetadata: true,
    });
    const decoded = decodeTransactionEnvelope(encoded);

    expect(decoded).toEqual({
      version: 1,
      xdr: 'AAAA-test-xdr',
      networkPassphrase: 'Test SDF Network ; September 2015',
      metadata: {
        source: 'G_SOURCE',
        fee: '100',
        sequence: '123',
        operationCount: 1,
      },
    });
  });

  it('caches repeated serialization for the same transaction and options', () => {
    const transaction = createTransaction();
    const cache = new TransactionSerializationCache();
    const options = {
      networkPassphrase: 'testnet',
      includeMetadata: false,
    };

    const first = createTransactionEnvelope(transaction, options, cache);
    const second = createTransactionEnvelope(transaction, options, cache);

    expect(first).toBe(second);
    expect(transaction.toXDR).toHaveBeenCalledTimes(1);

    createTransactionEnvelope(transaction, { ...options, includeMetadata: true }, cache);
    expect(transaction.toXDR).toHaveBeenCalledTimes(2);

    cache.clear(transaction);
    createTransactionEnvelope(transaction, options, cache);
    expect(transaction.toXDR).toHaveBeenCalledTimes(3);
  });

  it('deserializes through a caller-provided protocol parser', () => {
    const transaction = createTransaction('AAAA-roundtrip');
    const encoded = serializeTransactionEnvelope(transaction, {
      networkPassphrase: 'mainnet',
    });
    const parser = jest.fn((xdr: string, networkPassphrase: string) => ({
      parsedXdr: xdr,
      networkPassphrase,
    }));

    const result = deserializeTransactionEnvelope(encoded, parser);

    expect(parser).toHaveBeenCalledWith('AAAA-roundtrip', 'mainnet');
    expect(result.transaction).toEqual({
      parsedXdr: 'AAAA-roundtrip',
      networkPassphrase: 'mainnet',
    });
    expect(result.envelope.xdr).toBe('AAAA-roundtrip');
  });

  it('rejects malformed or incomplete envelopes', () => {
    expect(() => decodeTransactionEnvelope('not-base64-json')).toThrow(
      'Failed to decode serialized transaction envelope'
    );

    const incomplete = Buffer.from(JSON.stringify({ version: 1, xdr: 'AAAA' })).toString('base64');
    expect(() => decodeTransactionEnvelope(incomplete)).toThrow(
      'missing required transaction envelope fields'
    );
  });
});
