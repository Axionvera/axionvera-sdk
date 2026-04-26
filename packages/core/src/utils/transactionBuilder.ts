// Node.js core module imports
// Note: In React Native, these must be polyfilled. See REACT_NATIVE.md for instructions.
let createHash: any;
try {
  // Use dynamic require to prevent instant crash on some bundlers
  // if 'crypto' is not available at load time.
  createHash = require('crypto').createHash;
} catch (e) {
  // Fallback will be handled in the hash() function
}

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
export interface BuildContractCallParams {
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
}

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

  // If it's already an ScVal, return it
  if (arg instanceof xdr.ScVal) {
    return arg;
  }

  // Fallback
  return nativeToScVal(arg);
}

/**
 * Builds a Soroban contract call operation.
 * @param params - The operation parameters
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
 * Builds the exact byte-hash required for Soroban's native contract authorization.
 * 
 * @param networkPassphrase - The network passphrase
 * @param contractId - The contract ID being authorized
 * @param methodName - The method name being called
 * @param args - The arguments for the method
 * @returns The byte-hash (Buffer) that should be signed by the user
 */
export function buildContractAuthPayload(
  networkPassphrase: string,
  contractId: string,
  methodName: string,
  args: ContractCallArg[]
): Buffer {
  const networkId = hash(Buffer.from(networkPassphrase));
  const contractIdBuffer = Address.fromString(contractId).toBuffer();
  const scArgs = (args ?? []).map(toScVal);
  
  const preimage = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({
      networkId,
      contractId: contractIdBuffer,
      functionName: methodName,
      args: new xdr.ScVec(scArgs)
    })
  );

  return hash(preimage.toXDR());
}

/**
 * Helper to hash a buffer using SHA-256.
 * @param data - The data to hash
 * @returns The 32-byte hash buffer
 */
function hash(data: Buffer): Buffer {
  if (typeof createHash === 'function') {
    return createHash('sha256').update(data).digest();
  }
  
  // Fallback for environments where crypto might be global but not requireable
  if (typeof global !== 'undefined' && (global as any).crypto && (global as any).crypto.createHash) {
    return (global as any).crypto.createHash('sha256').update(data).digest();
  }

  throw new Error(
    "Crypto implementation not found. If you are using React Native, " +
    "please follow the polyfill instructions in REACT_NATIVE.md to enable Node.js core modules."
  );
}

