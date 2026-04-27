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

/**
 * Fluent builder for constructing Soroban contract call transactions.
 *
 * @example
 * ```typescript
 * const tx = new ContractCallBuilder()
 *   .setContract("C...")
 *   .setMethod("deposit")
 *   .setArgs([1000n, recipientAddress])
 *   .setFee(200_000)
 *   .setTimeout(30)
 *   .build(sourceAccount, networkPassphrase);
 * ```
 */
export class ContractCallBuilder {
  private _contractId?: string;
  private _method?: string;
  private _args: ContractCallArg[] = [];
  private _fee?: number;
  private _timeoutInSeconds?: number;

  /** Sets the contract ID to call. */
  setContract(contractId: string): this {
    this._contractId = contractId;
    return this;
  }

  /** Sets the contract method name. */
  setMethod(method: string): this {
    this._method = method;
    return this;
  }

  /** Sets the arguments for the contract call. */
  setArgs(args: ContractCallArg[]): this {
    this._args = args;
    return this;
  }

  /** Sets the transaction fee in stroops (default: 100_000). */
  setFee(fee: number): this {
    this._fee = fee;
    return this;
  }

  /** Sets the transaction timeout in seconds (default: 60). */
  setTimeout(timeoutInSeconds: number): this {
    this._timeoutInSeconds = timeoutInSeconds;
    return this;
  }

  /**
   * Builds the transaction.
   * @param sourceAccount - The source account for the transaction
   * @param networkPassphrase - The network passphrase
   * @returns The constructed Transaction
   * @throws {Error} If contractId or method have not been set
   */
  build(sourceAccount: Account, networkPassphrase: string): Transaction {
    if (!this._contractId) throw new Error("ContractCallBuilder: contractId is required");
    if (!this._method) throw new Error("ContractCallBuilder: method is required");

    return buildContractCallTransaction({
      sourceAccount,
      networkPassphrase,
      contractId: this._contractId,
      method: this._method,
      args: this._args,
      fee: this._fee,
      timeoutInSeconds: this._timeoutInSeconds
    });
  }

  /**
   * Builds only the contract call operation (without wrapping in a transaction).
   * Useful for composing multiple operations into a single transaction.
   * @throws {Error} If contractId or method have not been set
   */
  buildOperation(): xdr.Operation {
    if (!this._contractId) throw new Error("ContractCallBuilder: contractId is required");
    if (!this._method) throw new Error("ContractCallBuilder: method is required");

    return buildContractCallOperation({
      contractId: this._contractId,
      method: this._method,
      args: this._args
    });
  }
}
