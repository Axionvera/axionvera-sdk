import { Address, rpc, xdr } from '@stellar/stellar-sdk';
import { ContractRevertError } from '../errors/axionveraError';
import { decodeXdrBase64 } from './xdrCache';

/**
 * Native JavaScript types that Soroban scVal values are decoded into.
 * BigInt is used for all 64-bit and wider integer types to preserve precision.
 */
export type NativeScVal =
  | void
  | boolean
  | number
  | bigint
  | string
  | Buffer
  | NativeScVal[]
  | { [key: string]: NativeScVal };

/**
 * Extracts a trap/error code from a simulation error string.
 * Soroban errors typically look like: "HostError: Error(Contract, #N)"
 */
function extractTrapCode(error: string): string | undefined {
  const match = error.match(/Error\([^,]+,\s*#?(\w+)\)/);
  return match?.[1];
}

/**
 * Decodes a raw xdr.ScVal into a native JavaScript value.
 * - scvI128 / scvU128 / scvI256 / scvU256 / scvI64 / scvU64 → BigInt
 * - scvSymbol / scvString → string
 * - scvBool → boolean
 * - scvU32 / scvI32 → number
 * - scvVoid → undefined
 * - scvBytes → Buffer
 * - scvVec → NativeScVal[]
 * - scvMap → { [key: string]: NativeScVal }
 * - scvAddress → string (strkey)
 */
export function decodeScVal(scval: xdr.ScVal): NativeScVal {
  const t = xdr.ScValType;

  switch (scval.switch()) {
    case t.scvVoid():
      return undefined;

    case t.scvBool():
      return scval.b();

    case t.scvU32():
      return scval.u32();

    case t.scvI32():
      return scval.i32();

    case t.scvU64():
      return BigInt(scval.u64().toString());

    case t.scvI64():
      return BigInt(scval.i64().toString());

    case t.scvU128(): {
      const parts = scval.u128();
      return (BigInt(parts.hi().toString()) << 64n) | BigInt(parts.lo().toString());
    }

    case t.scvI128(): {
      const parts = scval.i128();
      const hi = BigInt(parts.hi().toString());
      const lo = BigInt(parts.lo().toString());
      const raw = (hi << 64n) | lo;
      const MAX_I128 = (1n << 127n) - 1n;
      return raw > MAX_I128 ? raw - (1n << 128n) : raw;
    }

    case t.scvU256(): {
      const parts = scval.u256();
      return (
        (BigInt(parts.hiHi().toString()) << 192n) |
        (BigInt(parts.hiLo().toString()) << 128n) |
        (BigInt(parts.loHi().toString()) << 64n) |
        BigInt(parts.loLo().toString())
      );
    }

    case t.scvI256(): {
      const parts = scval.i256();
      const raw =
        (BigInt(parts.hiHi().toString()) << 192n) |
        (BigInt(parts.hiLo().toString()) << 128n) |
        (BigInt(parts.loHi().toString()) << 64n) |
        BigInt(parts.loLo().toString());
      const MAX_I256 = (1n << 255n) - 1n;
      return raw > MAX_I256 ? raw - (1n << 256n) : raw;
    }

    case t.scvSymbol():
      return scval.sym().toString();

    case t.scvString():
      return scval.str().toString();

    case t.scvBytes():
      return scval.bytes();

    case t.scvAddress():
      return Address.fromScAddress(scval.address()).toString();

    case t.scvVec():
      return scval.vec()!.map(decodeScVal);

    case t.scvMap(): {
      const result: { [key: string]: NativeScVal } = {};
      for (const entry of scval.map()!) {
        const key = decodeScVal(entry.key());
        result[String(key)] = decodeScVal(entry.val());
      }
      return result;
    }

    default:
      throw new Error(`Unsupported scVal type: ${scval.switch().name}`);
  }
}

/**
 * Parses the return value from a Soroban simulation result.
 *
 * @throws {ContractRevertError} if the simulation indicates a contract failure.
 * @returns The decoded native JavaScript value from results[0].xdr.
 *
 * @example
 * ```typescript
 * const sim = await client.simulateTransaction(tx);
 * const balance = SimulationParser.parseContractReturnValue(sim); // → BigInt
 * ```
 */
export class SimulationParser {
  static parseContractReturnValue(
    simulationResult: rpc.Api.SimulateTransactionResponse
  ): NativeScVal {
    if (rpc.Api.isSimulationError(simulationResult)) {
      const trapCode = extractTrapCode(simulationResult.error);
      throw new ContractRevertError(
        `Contract simulation reverted: ${simulationResult.error}`,
        trapCode
      );
    }

    const result = (simulationResult as rpc.Api.SimulateTransactionSuccessResponse).result;

    if (!result) {
      return undefined;
    }

    const scval = decodeXdrBase64(result.retval.toXDR('base64'));
    return decodeScVal(scval);
  }
}
