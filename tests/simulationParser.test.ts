import { Address, xdr } from '@stellar/stellar-sdk';
import { SimulationParser, decodeScVal } from '../packages/core/src/utils/simulationParser';
import { ContractRevertError } from '../packages/core/src/errors/axionveraError';

// Helper to build a minimal success simulation response
function makeSuccess(scval: xdr.ScVal) {
  return {
    result: { retval: scval, auth: [] },
    transactionData: '',
    minResourceFee: '100',
    cost: { cpuInsns: '0', memBytes: '0' },
    latestLedger: 1,
  } as any;
}

// Helper to build a minimal error simulation response
function makeError(error: string) {
  return { error, latestLedger: 1 } as any;
}

describe('decodeScVal', () => {
  test('scvVoid → undefined', () => {
    expect(decodeScVal(xdr.ScVal.scvVoid())).toBeUndefined();
  });

  test('scvBool → boolean', () => {
    expect(decodeScVal(xdr.ScVal.scvBool(true))).toBe(true);
    expect(decodeScVal(xdr.ScVal.scvBool(false))).toBe(false);
  });

  test('scvU32 → number', () => {
    expect(decodeScVal(xdr.ScVal.scvU32(42))).toBe(42);
  });

  test('scvI32 → number', () => {
    expect(decodeScVal(xdr.ScVal.scvI32(-7))).toBe(-7);
  });

  test('scvU64 → BigInt', () => {
    const val = xdr.ScVal.scvU64(xdr.Uint64.fromString('9007199254740993')); // > Number.MAX_SAFE_INTEGER
    expect(decodeScVal(val)).toBe(9007199254740993n);
  });

  test('scvI64 → BigInt', () => {
    const val = xdr.ScVal.scvI64(xdr.Int64.fromString('-1'));
    expect(decodeScVal(val)).toBe(-1n);
  });

  test('scvU128 → BigInt (preserves precision)', () => {
    // 2^64 + 1
    const hi = xdr.Uint64.fromString('1');
    const lo = xdr.Uint64.fromString('1');
    const val = xdr.ScVal.scvU128(new xdr.UInt128Parts({ hi, lo }));
    expect(decodeScVal(val)).toBe((1n << 64n) + 1n);
  });

  test('scvI128 → BigInt (positive)', () => {
    const hi = xdr.Int64.fromString('0');
    const lo = xdr.Uint64.fromString('1000');
    const val = xdr.ScVal.scvI128(new xdr.Int128Parts({ hi, lo }));
    expect(decodeScVal(val)).toBe(1000n);
  });

  test('scvI128 → BigInt (negative)', () => {
    // -1 in two's complement 128-bit: hi = 0xFFFFFFFFFFFFFFFF, lo = 0xFFFFFFFFFFFFFFFF
    const MAX_U64 = '18446744073709551615';
    const hi = xdr.Int64.fromString('-1');
    const lo = xdr.Uint64.fromString(MAX_U64);
    const val = xdr.ScVal.scvI128(new xdr.Int128Parts({ hi, lo }));
    expect(decodeScVal(val)).toBe(-1n);
  });

  test('scvSymbol → string', () => {
    expect(decodeScVal(xdr.ScVal.scvSymbol('transfer'))).toBe('transfer');
  });

  test('scvString → string', () => {
    expect(decodeScVal(xdr.ScVal.scvString('hello'))).toBe('hello');
  });

  test('scvBytes → Buffer', () => {
    const buf = Buffer.from([1, 2, 3]);
    const result = decodeScVal(xdr.ScVal.scvBytes(buf));
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result).toEqual(buf);
  });

  test('scvAddress → strkey string', () => {
    const contractAddr = Address.contract(Buffer.alloc(32, 1));
    const scval = contractAddr.toScVal();
    expect(decodeScVal(scval)).toBe(contractAddr.toString());
  });

  test('scvVec → array', () => {
    const vec = xdr.ScVal.scvVec([xdr.ScVal.scvU32(1), xdr.ScVal.scvU32(2)]);
    expect(decodeScVal(vec)).toEqual([1, 2]);
  });

  test('scvMap → object', () => {
    const map = xdr.ScVal.scvMap([
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('a'), val: xdr.ScVal.scvU32(1) }),
    ]);
    expect(decodeScVal(map)).toEqual({ a: 1 });
  });
});

describe('SimulationParser.parseContractReturnValue', () => {
  test('decodes a successful simulation result', () => {
    const hi = xdr.Int64.fromString('0');
    const lo = xdr.Uint64.fromString('5000');
    const scval = xdr.ScVal.scvI128(new xdr.Int128Parts({ hi, lo }));
    const result = SimulationParser.parseContractReturnValue(makeSuccess(scval));
    expect(result).toBe(5000n);
  });

  test('returns undefined for scvVoid result', () => {
    const result = SimulationParser.parseContractReturnValue(makeSuccess(xdr.ScVal.scvVoid()));
    expect(result).toBeUndefined();
  });

  test('returns undefined when result is absent', () => {
    const sim = { transactionData: '', minResourceFee: '0', cost: {}, latestLedger: 1 } as any;
    expect(SimulationParser.parseContractReturnValue(sim)).toBeUndefined();
  });

  test('throws ContractRevertError on simulation error', () => {
    const sim = makeError('HostError: Error(Contract, #3)');
    expect(() => SimulationParser.parseContractReturnValue(sim)).toThrow(ContractRevertError);
  });

  test('ContractRevertError includes parsed trap code', () => {
    const sim = makeError('HostError: Error(Contract, #7)');
    try {
      SimulationParser.parseContractReturnValue(sim);
    } catch (e) {
      expect(e).toBeInstanceOf(ContractRevertError);
      expect((e as ContractRevertError).trapCode).toBe('7');
    }
  });

  test('ContractRevertError with no trap code sets trapCode to undefined', () => {
    const sim = makeError('HostError: some generic failure');
    try {
      SimulationParser.parseContractReturnValue(sim);
    } catch (e) {
      expect(e).toBeInstanceOf(ContractRevertError);
      expect((e as ContractRevertError).trapCode).toBeUndefined();
    }
  });
});
