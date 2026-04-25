import { xdr } from "@stellar/stellar-sdk";

/**
 * TypeScript interfaces for Soroban XDR structures.
 * These provide clean, readable TypeScript types for SCVal structures
 * without requiring developers to write them from scratch.
 */

// Base SCVal types
export interface ScValVoid {
  type: "void";
}

export interface ScValBool {
  type: "bool";
  value: boolean;
}

export interface ScValU32 {
  type: "u32";
  value: number;
}

export interface ScValI32 {
  type: "i32";
  value: number;
}

export interface ScValU64 {
  type: "u64";
  value: string | bigint;
}

export interface ScValI64 {
  type: "i64";
  value: string | bigint;
}

export interface ScValU128 {
  type: "u128";
  value: string | bigint;
}

export interface ScValI128 {
  type: "i128";
  value: string | bigint;
}

export interface ScValU256 {
  type: "u256";
  value: string | bigint;
}

export interface ScValI256 {
  type: "i256";
  value: string | bigint;
}

export interface ScValStatic {
  type: "static";
  value: Buffer;
}

export interface ScValString {
  type: "string";
  value: string;
}

export interface ScValBytes {
  type: "bytes";
  value: Buffer;
}

export interface ScValAddress {
  type: "address";
  value: {
    type: "publicKey" | "contract";
    value: string;
  };
}

export interface ScValSymbol {
  type: "symbol";
  value: string;
}

export interface ScValMapEntry {
  key: ScVal;
  val: ScVal;
}

export interface ScValMap {
  type: "map";
  value: ScValMapEntry[];
}

export interface ScValVec {
  type: "vec";
  value: ScVal[];
}

export interface ScValContractInstance {
  type: "instance";
  value: {
    executable?: {
      type: "wasm" | "stellarAsset";
      value: Buffer;
    };
    storage?: ScValMapEntry[];
  };
}

export interface ScValLedgerKeyContractData {
  type: "ledgerKeyContractData";
  value: {
    contract: ScValAddress;
    key: ScVal;
    durability: "persistent" | "temporary";
  };
}

export interface ScValLedgerKeyContractCode {
  type: "ledgerKeyContractCode";
  value: {
    hash: Buffer;
  };
}

export interface ScValLedgerKeyNonce {
  type: "ledgerKeyNonce";
  value: {
    nonce: ScValU64;
  };
}

export interface ScValLedgerKey {
  type: "ledgerKey";
  value: ScValLedgerKeyContractData | ScValLedgerKeyContractCode | ScValLedgerKeyNonce;
}

// Union type for all SCVal variants
export type ScVal = 
  | ScValVoid
  | ScValBool
  | ScValU32
  | ScValI32
  | ScValU64
  | ScValI64
  | ScValU128
  | ScValI128
  | ScValU256
  | ScValI256
  | ScValStatic
  | ScValString
  | ScValBytes
  | ScValAddress
  | ScValSymbol
  | ScValMap
  | ScValVec
  | ScValContractInstance
  | ScValLedgerKey;

// Helper functions to convert between XDR and TypeScript types
export function scValToType(scval: xdr.ScVal): ScVal {
  switch (scval.switch()) {
    case xdr.ScValType.scvVoid():
      return { type: "void" };
    case xdr.ScValType.scvBool():
      return { type: "bool", value: scval.bool() };
    case xdr.ScValType.scvU32():
      return { type: "u32", value: scval.u32() };
    case xdr.ScValType.scvI32():
      return { type: "i32", value: scval.i32() };
    case xdr.ScValType.scvU64():
      return { type: "u64", value: scval.u64().toString() };
    case xdr.ScValType.scvI64():
      return { type: "i64", value: scval.i64().toString() };
    case xdr.ScValType.scvU128():
      return { type: "u128", value: scval.u128().toString() };
    case xdr.ScValType.scvI128():
      return { type: "i128", value: scval.i128().toString() };
    case xdr.ScValType.scvU256():
      return { type: "u256", value: scval.u256().toString() };
    case xdr.ScValType.scvI256():
      return { type: "i256", value: scval.i256().toString() };
    case xdr.ScValType.scvStatic():
      return { type: "static", value: scval.static() };
    case xdr.ScValType.scvString():
      return { type: "string", value: scval.str().toString() };
    case xdr.ScValType.scvBytes():
      return { type: "bytes", value: scval.bytes() };
    case xdr.ScValType.scvAddress():
      const address = scval.address();
      if (address.switch() === xdr.ScAddressType.SCPUBLIC_KEY()) {
        return {
          type: "address",
          value: {
            type: "publicKey",
            value: address.publicKey().toString()
          }
        };
      } else {
        return {
          type: "address",
          value: {
            type: "contract",
            value: address.contractId().toString("hex")
          }
        };
      }
    case xdr.ScValType.scvSymbol():
      return { type: "symbol", value: scval.sym().toString() };
    case xdr.ScValType.scvMap():
      const map = scval.map();
      return {
        type: "map",
        value: map.map(entry => ({
          key: scValToType(entry.key()),
          val: scValToType(entry.val())
        }))
      };
    case xdr.ScValType.scvVec():
      const vec = scval.vec();
      return {
        type: "vec",
        value: vec.map(item => scValToType(item))
      };
    case xdr.ScValType.scvInstance():
      const instance = scval.instance();
      const executable = instance.executable();
      const storage = instance.storage();
      
      const result: ScValContractInstance = {
        type: "instance",
        value: {}
      };
      
      if (executable) {
        if (executable.switch() === xdr.ContractExecutableType.WASM()) {
          result.value.executable = {
            type: "wasm",
            value: executable.wasm()
          };
        } else {
          result.value.executable = {
            type: "stellarAsset",
            value: executable.stellarAsset()
          };
        }
      }
      
      if (storage) {
        result.value.storage = storage.map(entry => ({
          key: scValToType(entry.key()),
          val: scValToType(entry.val())
        }));
      }
      
      return result;
    default:
      throw new Error(`Unknown SCVal type: ${scval.switch()}`);
  }
}

// Additional commonly used Soroban types
export interface SorobanAuthorizedInvocation {
  contractAddress: ScValAddress;
  functionName: string;
  args: ScVal[];
}

export interface SorobanAuthorizationEntry {
  credentials: {
    type: "sourceAccount" | "address";
    value: ScValAddress;
  };
  rootInvocation: SorobanAuthorizedInvocation;
}

export interface SorobanTransactionData {
  resources: {
    footprint: {
      readOnly: ScValLedgerKey[];
      readWrite: ScValLedgerKey[];
    };
    instructions?: any[];
  };
  ext: any;
}

// Type guards for checking SCVal types
export function isScValVoid(scval: ScVal): scval is ScValVoid {
  return scval.type === "void";
}

export function isScValBool(scval: ScVal): scval is ScValBool {
  return scval.type === "bool";
}

export function isScValNumber(scval: ScVal): scval is ScValU32 | ScValI32 | ScValU64 | ScValI64 | ScValU128 | ScValI128 | ScValU256 | ScValI256 {
  return ["u32", "i32", "u64", "i64", "u128", "i128", "u256", "i256"].includes(scval.type);
}

export function isScValString(scval: ScVal): scval is ScValString {
  return scval.type === "string";
}

export function isScValAddress(scval: ScVal): scval is ScValAddress {
  return scval.type === "address";
}

export function isScValMap(scval: ScVal): scval is ScValMap {
  return scval.type === "map";
}

export function isScValVec(scval: ScVal): scval is ScValVec {
  return scval.type === "vec";
}

export function isScValContractInstance(scval: ScVal): scval is ScValContractInstance {
  return scval.type === "instance";
}
