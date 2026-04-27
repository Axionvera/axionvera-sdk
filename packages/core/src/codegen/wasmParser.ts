import { readFileSync } from "fs";
import { xdr } from "@stellar/stellar-sdk";

/**
 * Represents a single function parameter from the contract spec.
 */
export interface SpecParam {
  name: string;
  type: string; // TypeScript type string
  scSpecType: string; // raw ScSpecType name for encoding hints
}

/**
 * Represents a parsed contract function.
 */
export interface SpecFunction {
  name: string;
  doc: string;
  inputs: SpecParam[];
  outputs: SpecParam[];
  /** true = read-only (simulate only), false = mutating (invoke) */
  readonly: boolean;
}

/**
 * Represents a parsed UDT struct field.
 */
export interface SpecStructField {
  name: string;
  type: string;
}

/**
 * Represents a parsed UDT struct.
 */
export interface SpecStruct {
  name: string;
  doc: string;
  fields: SpecStructField[];
}

/**
 * Represents a parsed UDT enum case.
 */
export interface SpecEnumCase {
  name: string;
  value: number;
}

/**
 * Represents a parsed UDT enum.
 */
export interface SpecEnum {
  name: string;
  doc: string;
  cases: SpecEnumCase[];
}

/**
 * The full parsed contract specification.
 */
export interface ContractSpec {
  functions: SpecFunction[];
  structs: SpecStruct[];
  enums: SpecEnum[];
}

// ─── WASM custom section reader ──────────────────────────────────────────────

const SPEC_SECTION_NAME = "contractspecv0";

/**
 * Reads the `contractspecv0` custom section from a compiled Soroban WASM file
 * and returns the raw bytes of each XDR-encoded ScSpecEntry.
 */
function readSpecSection(wasmPath: string): Buffer[] {
  const wasm = readFileSync(wasmPath);
  const entries: Buffer[] = [];

  // WASM binary format: magic (4) + version (4) + sections
  let offset = 8;

  while (offset < wasm.length) {
    const sectionId = wasm[offset++];
    const [sectionSize, sizeLen] = readLEB128(wasm, offset);
    offset += sizeLen;
    const sectionEnd = offset + sectionSize;

    if (sectionId === 0) {
      // Custom section: name length (LEB128) + name bytes + payload
      const [nameLen, nameLenBytes] = readLEB128(wasm, offset);
      const nameStart = offset + nameLenBytes;
      const name = wasm.slice(nameStart, nameStart + nameLen).toString("utf8");
      const payloadStart = nameStart + nameLen;

      if (name === SPEC_SECTION_NAME) {
        // Payload is a sequence of XDR-encoded ScSpecEntry values (each
        // prefixed by a 4-byte big-endian length per the XDR framing).
        let pos = payloadStart;
        while (pos < sectionEnd) {
          const entryLen = wasm.readUInt32BE(pos);
          pos += 4;
          entries.push(wasm.slice(pos, pos + entryLen));
          pos += entryLen;
        }
      }
    }

    offset = sectionEnd;
  }

  return entries;
}

/** Decode an unsigned LEB128 integer; returns [value, bytesConsumed]. */
function readLEB128(buf: Buffer, offset: number): [number, number] {
  let result = 0;
  let shift = 0;
  let bytesRead = 0;
  while (true) {
    const byte = buf[offset + bytesRead++];
    result |= (byte & 0x7f) << shift;
    shift += 7;
    if ((byte & 0x80) === 0) break;
  }
  return [result, bytesRead];
}

// ─── ScSpecType → TypeScript type mapping ────────────────────────────────────

function scSpecTypeToTs(typeDef: xdr.ScSpecTypeDef): { ts: string; spec: string } {
  const t = typeDef.switch();
  const name = t.name;

  switch (name) {
    case "scSpecTypeBool":    return { ts: "boolean", spec: "bool" };
    case "scSpecTypeVoid":    return { ts: "void", spec: "void" };
    case "scSpecTypeError":   return { ts: "number", spec: "error" };
    case "scSpecTypeU32":     return { ts: "number", spec: "u32" };
    case "scSpecTypeI32":     return { ts: "number", spec: "i32" };
    case "scSpecTypeU64":     return { ts: "bigint", spec: "u64" };
    case "scSpecTypeI64":     return { ts: "bigint", spec: "i64" };
    case "scSpecTypeU128":    return { ts: "bigint", spec: "u128" };
    case "scSpecTypeI128":    return { ts: "bigint", spec: "i128" };
    case "scSpecTypeU256":    return { ts: "bigint", spec: "u256" };
    case "scSpecTypeI256":    return { ts: "bigint", spec: "i256" };
    case "scSpecTypeBytes":   return { ts: "Buffer", spec: "bytes" };
    case "scSpecTypeString":  return { ts: "string", spec: "string" };
    case "scSpecTypeSymbol":  return { ts: "string", spec: "symbol" };
    case "scSpecTypeAddress": return { ts: "string", spec: "address" };
    case "scSpecTypeOption": {
      const inner = scSpecTypeToTs((typeDef as any).option().valueType());
      return { ts: `${inner.ts} | undefined`, spec: `option<${inner.spec}>` };
    }
    case "scSpecTypeVec": {
      const inner = scSpecTypeToTs((typeDef as any).vec().elementType());
      return { ts: `${inner.ts}[]`, spec: `vec<${inner.spec}>` };
    }
    case "scSpecTypeMap": {
      const k = scSpecTypeToTs((typeDef as any).map().keyType());
      const v = scSpecTypeToTs((typeDef as any).map().valueType());
      return { ts: `Map<${k.ts}, ${v.ts}>`, spec: `map<${k.spec},${v.spec}>` };
    }
    case "scSpecTypeTuple": {
      const types = (typeDef as any).tuple().valueTypes().map((vt: xdr.ScSpecTypeDef) => scSpecTypeToTs(vt).ts);
      return { ts: `[${types.join(", ")}]`, spec: "tuple" };
    }
    case "scSpecTypeUdt": {
      const udtName = (typeDef as any).udt().name().toString();
      return { ts: udtName, spec: `udt:${udtName}` };
    }
    default:
      return { ts: "xdr.ScVal", spec: "unknown" };
  }
}

// ─── Heuristic: is a function read-only? ─────────────────────────────────────

/**
 * A function is considered read-only if its name starts with common query
 * prefixes OR if it has no inputs that look like mutating args.
 * This is a best-effort heuristic; Soroban spec v0 doesn't encode mutability.
 */
function isReadOnly(name: string): boolean {
  return /^(get|query|view|balance|total|is_|has_|check|fetch|read|list)/.test(name);
}

// ─── Main parser ─────────────────────────────────────────────────────────────

/**
 * Parses a compiled Soroban WASM file and returns a structured ContractSpec.
 *
 * @param wasmPath - Absolute or relative path to the `.wasm` file
 * @returns Parsed contract specification
 */
export function parseWasm(wasmPath: string): ContractSpec {
  const rawEntries = readSpecSection(wasmPath);

  if (rawEntries.length === 0) {
    throw new Error(
      `No '${SPEC_SECTION_NAME}' custom section found in ${wasmPath}. ` +
      `Ensure the contract was compiled with soroban-sdk and the spec feature enabled.`
    );
  }

  const spec: ContractSpec = { functions: [], structs: [], enums: [] };

  for (const raw of rawEntries) {
    const entry = xdr.ScSpecEntry.fromXDR(raw);
    const kind = entry.switch();

    if (kind.value === xdr.ScSpecEntryKind.scSpecEntryFunctionV0().value) {
      const fn = entry.functionV0();
      const name = fn.name().toString();
      const doc = fn.doc().toString();

      const inputs: SpecParam[] = fn.inputs().map((inp: any) => {
        const { ts, spec: specType } = scSpecTypeToTs(inp.type());
        return { name: inp.name().toString(), type: ts, scSpecType: specType };
      });

      const outputs: SpecParam[] = fn.outputs().map((out: any, i: number) => {
        const { ts, spec: specType } = scSpecTypeToTs(out);
        return { name: `result${i}`, type: ts, scSpecType: specType };
      });

      spec.functions.push({ name, doc, inputs, outputs, readonly: isReadOnly(name) });

    } else if (kind.value === xdr.ScSpecEntryKind.scSpecEntryUdtStructV0().value) {
      const s = entry.udtStructV0();
      const fields: SpecStructField[] = s.fields().map((f: any) => ({
        name: f.name().toString(),
        type: scSpecTypeToTs(f.type()).ts,
      }));
      spec.structs.push({ name: s.name().toString(), doc: s.doc().toString(), fields });

    } else if (kind.value === xdr.ScSpecEntryKind.scSpecEntryUdtEnumV0().value) {
      const e = entry.udtEnumV0();
      const cases: SpecEnumCase[] = e.cases().map((c: any) => ({
        name: c.name().toString(),
        value: c.value(),
      }));
      spec.enums.push({ name: e.name().toString(), doc: e.doc().toString(), cases });
    }
    // UDT unions and error enums are intentionally skipped for now
  }

  return spec;
}
