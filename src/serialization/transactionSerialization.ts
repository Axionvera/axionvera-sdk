export interface SerializableTransactionLike {
  toXDR(): string;
  source?: string;
  fee?: string | number;
  sequence?: string;
  operations?: readonly unknown[];
}

export interface TransactionSerializationOptions {
  networkPassphrase: string;
  includeMetadata?: boolean;
}

export interface SerializedTransactionEnvelope {
  version: 1;
  xdr: string;
  networkPassphrase: string;
  metadata?: {
    source?: string;
    fee?: string | number;
    sequence?: string;
    operationCount?: number;
  };
}

export interface DeserializedTransactionEnvelope<TTransaction> {
  envelope: SerializedTransactionEnvelope;
  transaction: TTransaction;
}

export type TransactionParser<TTransaction> = (
  xdr: string,
  networkPassphrase: string
) => TTransaction;

export class TransactionSerializationCache {
  private readonly cache = new WeakMap<
    SerializableTransactionLike,
    Map<string, SerializedTransactionEnvelope>
  >();

  get(
    transaction: SerializableTransactionLike,
    options: TransactionSerializationOptions
  ): SerializedTransactionEnvelope | undefined {
    return this.cache.get(transaction)?.get(this.getCacheKey(options));
  }

  set(
    transaction: SerializableTransactionLike,
    options: TransactionSerializationOptions,
    envelope: SerializedTransactionEnvelope
  ): void {
    let transactionCache = this.cache.get(transaction);

    if (!transactionCache) {
      transactionCache = new Map<string, SerializedTransactionEnvelope>();
      this.cache.set(transaction, transactionCache);
    }

    transactionCache.set(this.getCacheKey(options), envelope);
  }

  clear(transaction: SerializableTransactionLike): void {
    this.cache.delete(transaction);
  }

  private getCacheKey(options: TransactionSerializationOptions): string {
    return `${options.networkPassphrase}:${String(options.includeMetadata ?? false)}`;
  }
}

export const transactionSerializationCache = new TransactionSerializationCache();

export function createTransactionEnvelope(
  transaction: SerializableTransactionLike,
  options: TransactionSerializationOptions,
  cache = transactionSerializationCache
): SerializedTransactionEnvelope {
  const cached = cache.get(transaction, options);
  if (cached) {
    return cached;
  }

  const envelope: SerializedTransactionEnvelope = {
    version: 1,
    xdr: transaction.toXDR(),
    networkPassphrase: options.networkPassphrase,
  };

  if (options.includeMetadata) {
    envelope.metadata = {
      source: transaction.source,
      fee: transaction.fee,
      sequence: transaction.sequence,
      operationCount: transaction.operations?.length,
    };
  }

  cache.set(transaction, options, envelope);
  return envelope;
}

export function serializeTransactionEnvelope(
  transaction: SerializableTransactionLike,
  options: TransactionSerializationOptions,
  cache = transactionSerializationCache
): string {
  return encodeTransactionEnvelope(createTransactionEnvelope(transaction, options, cache));
}

export function deserializeTransactionEnvelope<TTransaction>(
  encodedEnvelope: string,
  parser: TransactionParser<TTransaction>
): DeserializedTransactionEnvelope<TTransaction> {
  const envelope = decodeTransactionEnvelope(encodedEnvelope);

  return {
    envelope,
    transaction: parser(envelope.xdr, envelope.networkPassphrase),
  };
}

export function encodeTransactionEnvelope(envelope: SerializedTransactionEnvelope): string {
  return Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64');
}

export function decodeTransactionEnvelope(encodedEnvelope: string): SerializedTransactionEnvelope {
  try {
    const decoded = Buffer.from(encodedEnvelope, 'base64').toString('utf8');
    const envelope = JSON.parse(decoded) as Partial<SerializedTransactionEnvelope>;

    if (envelope.version !== 1 || !envelope.xdr || !envelope.networkPassphrase) {
      throw new Error('missing required transaction envelope fields');
    }

    return {
      version: 1,
      xdr: envelope.xdr,
      networkPassphrase: envelope.networkPassphrase,
      metadata: envelope.metadata,
    };
  } catch (error) {
    throw new Error(
      `Failed to decode serialized transaction envelope: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
