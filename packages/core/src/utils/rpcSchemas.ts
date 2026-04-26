import * as v from 'valibot';
import { RPCValidationMismatchError } from '../errors/axionveraError';

export const GetHealthResponseSchema = v.looseObject({
  status: v.string(),
});

export type ValidatedGetHealthResponse = v.InferOutput<typeof GetHealthResponseSchema>;

export const SimulateTransactionResponseSchema = v.union([
  v.looseObject({
    latestLedger: v.number(),
    error: v.string(),
  }),
  v.looseObject({
    latestLedger: v.number(),
    results: v.optional(
      v.array(
        v.looseObject({
          xdr: v.string(),
          auth: v.optional(v.array(v.string())),
        })
      )
    ),
    transactionData: v.optional(v.string()),
    events: v.optional(v.array(v.string())),
    minResourceFee: v.optional(v.string()),
  }),
]);

export const GetTransactionResponseSchema = v.looseObject({
  status: v.picklist(['SUCCESS', 'FAILED', 'NOT_FOUND']),
  latestLedger: v.number(),
  latestLedgerCloseTime: v.optional(v.number()),
  oldestLedger: v.optional(v.number()),
  oldestLedgerCloseTime: v.optional(v.number()),
  ledger: v.optional(v.number()),
  createdAt: v.optional(v.number()),
  envelopeXdr: v.optional(v.string()),
  resultXdr: v.optional(v.string()),
  resultMetaXdr: v.optional(v.string()),
  applicationOrder: v.optional(v.number()),
});

export type ValidatedGetTransactionResponse = v.InferOutput<typeof GetTransactionResponseSchema>;

export function validateRpcResponse<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  schema: TSchema,
  response: unknown,
  rpcMethod: string
): v.InferOutput<TSchema> {
  const result = v.safeParse(schema, response);
  if (!result.success) {
    const flat = v.flatten(result.issues);
    const summary = flat.root?.join(', ') ?? 'validation failed';
    throw new RPCValidationMismatchError(
      `RPC response for "${rpcMethod}" did not match expected shape: ${summary}`,
      { rpcMethod, receivedShape: response, originalError: result.issues }
    );
  }
  return result.output;
}
