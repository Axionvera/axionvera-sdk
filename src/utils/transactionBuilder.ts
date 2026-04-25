import {
  Account,
  Address,
  Contract,
  Transaction,
  TransactionBuilder,
  nativeToScVal,
  xdr
} from "@stellar/stellar-sdk";

/**
 * Supported argument types for contract calls.
 */
export type ContractCallArg = xdr.ScVal | Address | string | number | bigint | boolean | null;

/**
 * Parameters for building a contract call transaction.
 */
export type BuildContractCallParams = {
  /** The source account for the transaction */
  sourceAccount: Account;
  /** The network passphrase */
  networkPassphrase: string;
  /** The contract ID to call */
  contractId: string;
  /** The method name to call */
  method: string;
  /** The arguments to pass to the method */
  args?: ContractCallArg[];
  /** The fee for the transaction (default: 100_000) */
  fee?: number;
  /** Transaction timeout in seconds (default: 60) */
  timeoutInSeconds?: number;
};

/**
 * Converts a value to an ScVal for contract interactions.
 * @param arg - The value to convert
 * @returns The converted ScVal
 */
export function toScVal(arg: ContractCallArg): xdr.ScVal {
  if (arg === null) {
    return xdr.ScVal.scvVoid();
  }

  if (arg instanceof Address) {
    return arg.toScVal();
  }

  if (typeof arg === "string") {
    try {
      return Address.fromString(arg).toScVal();
    } catch {
      return nativeToScVal(arg);
    }
  }

  if (typeof arg === "number") {
    return nativeToScVal(arg);
  }

  if (typeof arg === "bigint") {
    return nativeToScVal(arg, { type: "i128" });
  }

  if (typeof arg === "boolean") {
    return nativeToScVal(arg);
  }

  return arg;
}

/**
 * Builds a Soroban contract call operation.
 * @param params - The operation parameters
 * @param params.contractId - The contract ID to call
 * @param params.method - The method name to call
 * @param params.args - The arguments to pass
 * @returns The constructed operation
 */
export function buildContractCallOperation(params: {
  contractId: string;
  method: string;
  args?: ContractCallArg[];
}): xdr.Operation {
  const contract = new Contract(params.contractId);
  const scVals = (params.args ?? []).map(toScVal);
  return contract.call(params.method, ...scVals);
}

/**
 * Builds a complete contract call transaction.
 * @param params - The transaction parameters
 * @returns The constructed transaction
 */
export function buildContractCallTransaction(
  params: BuildContractCallParams
): Transaction {
  const operation = buildContractCallOperation({
    contractId: params.contractId,
    method: params.method,
    args: params.args
  });

  const fee = (params.fee ?? 100_000).toString();
  const timeoutInSeconds = params.timeoutInSeconds ?? 60;

  return new TransactionBuilder(params.sourceAccount, {
    fee,
    networkPassphrase: params.networkPassphrase
  })
    .addOperation(operation)
    .setTimeout(timeoutInSeconds)
    .build();
}

/**
 * Parameters for building a base transaction.
 */
export type BuildBaseTransactionParams = {
  /** The source account for the transaction */
  sourceAccount: Account;
  /** The network passphrase */
  networkPassphrase: string;
  /** The fee for the transaction (default: 100_000) */
  fee?: number;
  /** Transaction timeout in seconds (default: 60) */
  timeoutInSeconds?: number;
};

/**
 * Builds a base transaction that can be extended with additional operations.
 * This is useful for composing multiple contract calls into a single transaction.
 * 
 * @param params - The transaction parameters
 * @returns A TransactionBuilder instance ready for adding operations
 * 
 * @example
 * ```typescript
 * const builder = buildBaseTransaction({
 *   sourceAccount,
 *   networkPassphrase: "Test SDF Network ; September 2015"
 * });
 * 
 * // Add multiple operations
 * builder.addOperation(depositOperation);
 * builder.addOperation(stakingOperation);
 * 
 * const transaction = builder.setTimeout(60).build();
 * ```
 */
export function buildBaseTransaction(
  params: BuildBaseTransactionParams
): TransactionBuilder {
  const fee = (params.fee ?? 100_000).toString();
  const timeoutInSeconds = params.timeoutInSeconds ?? 60;

  const builder = new TransactionBuilder(params.sourceAccount, {
    fee,
    networkPassphrase: params.networkPassphrase
  });

  // Set timeout immediately so it's available for the builder
  builder.setTimeout(timeoutInSeconds);

  return builder;
}
