import { ContractSpec, SpecFunction, SpecStruct, SpecEnum } from './wasmParser';

/**
 * Converts a snake_case or kebab-case identifier to PascalCase.
 */
export function toPascalCase(s: string): string {
  return s
    .replace(/[-_](.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (_, c: string) => c.toUpperCase());
}

/**
 * Converts a snake_case identifier to camelCase.
 */
export function toCamelCase(s: string): string {
  const pascal = toPascalCase(s);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

// ─── Encoder helpers ─────────────────────────────────────────────────────────

/**
 * Returns the expression that encodes a TypeScript value `varName` of the
 * given scSpecType into an `xdr.ScVal` using BaseContract helpers.
 */
export function encodeExpr(varName: string, scSpecType: string): string {
  if (scSpecType === 'address') return `this.encodeAddress(${varName})`;
  if (scSpecType === 'i128') return `this.encodeI128(${varName})`;
  if (scSpecType === 'u128') return `this.encodeU128(${varName})`;
  if (scSpecType.startsWith('udt:')) return `this.encodeUdt(${varName})`;
  // For all other primitives, fall back to nativeToScVal
  return `nativeToScVal(${varName})`;
}

/**
 * Returns the expression that decodes an `xdr.ScVal` result into the
 * TypeScript type described by scSpecType.
 */
export function decodeExpr(resultExpr: string, scSpecType: string): string {
  if (scSpecType === 'bool') return `this.decodeBool(${resultExpr})`;
  if (scSpecType === 'string' || scSpecType === 'symbol') return `this.decodeString(${resultExpr})`;
  if (scSpecType === 'i128') return `this.decodeI128(${resultExpr})`;
  if (scSpecType === 'u128') return `this.decodeU128(${resultExpr})`;
  if (scSpecType === 'u64') return `this.decodeU64(${resultExpr})`;
  if (scSpecType === 'void') return 'undefined';
  // For UDTs and unknowns, return the raw ScVal
  return resultExpr;
}

// ─── Interface generation ────────────────────────────────────────────────────

export function generateArgsInterface(fn: SpecFunction): string {
  if (fn.inputs.length === 0) return '';
  const ifaceName = `${toPascalCase(fn.name)}Args`;
  const fields = fn.inputs.map((p) => `  ${p.name}: ${p.type};`).join('\n');
  return `export interface ${ifaceName} {\n${fields}\n}\n`;
}

export function generateStructInterface(s: SpecStruct): string {
  const fields = s.fields.map((f) => `  ${f.name}: ${f.type};`).join('\n');
  const doc = s.doc ? `/** ${s.doc} */\n` : '';
  return `${doc}export interface ${s.name} {\n${fields}\n}\n`;
}

export function generateEnumType(e: SpecEnum): string {
  const cases = e.cases.map((c) => `  ${c.name} = ${String(c.value)},`).join('\n');
  const doc = e.doc ? `/** ${e.doc} */\n` : '';
  return `${doc}export enum ${e.name} {\n${cases}\n}\n`;
}

// ─── Method generation ───────────────────────────────────────────────────────

export function generateMethod(fn: SpecFunction): string {
  const methodName = toCamelCase(fn.name);
  const hasArgs = fn.inputs.length > 0;
  const argsIfaceName = `${toPascalCase(fn.name)}Args`;

  // Return type
  const output = fn.outputs[0];
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const returnTs = output ? output.type : 'void';
  const promiseReturn = fn.readonly ? `Promise<${returnTs}>` : `Promise<any>`;

  // Parameter signature
  const paramSig = hasArgs ? `args: ${argsIfaceName}` : '';

  // Build args array for invoke/query
  const argsArray =
    fn.inputs.length > 0
      ? `[\n      ${fn.inputs.map((p) => encodeExpr(`args.${p.name}`, p.scSpecType)).join(',\n      ')}\n    ]`
      : '[]';

  // Doc comment
  const doc = fn.doc ? `  /**\n   * ${fn.doc.replace(/\n/g, '\n   * ')}\n   */\n` : '';

  if (fn.readonly) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const decode = output ? decodeExpr('_result', output.scSpecType) : 'undefined';
    return (
      `${doc}  async ${methodName}(${paramSig}): ${promiseReturn} {\n` +
      `    const _result = await this.query("${fn.name}", ${argsArray});\n` +
      `    return ${decode};\n` +
      `  }\n`
    );
  } else {
    return (
      `${doc}  async ${methodName}(${paramSig}): ${promiseReturn} {\n` +
      `    return this.invoke("${fn.name}", ${argsArray});\n` +
      `  }\n`
    );
  }
}

/**
 * Template context passed to custom template functions.
 */
export interface TemplateContext {
  spec: ContractSpec;
  className: string;
  coreImport: string;
  helpers: {
    toPascalCase: typeof toPascalCase;
    toCamelCase: typeof toCamelCase;
    encodeExpr: typeof encodeExpr;
    decodeExpr: typeof decodeExpr;
    generateArgsInterface: typeof generateArgsInterface;
    generateStructInterface: typeof generateStructInterface;
    generateEnumType: typeof generateEnumType;
    generateMethod: typeof generateMethod;
  };
}

/**
 * Custom template function type.
 */
export type TemplateFunction = (context: TemplateContext) => string;

// ─── Default template ─────────────────────────────────────────────────────────

const defaultTemplate: TemplateFunction = (context) => {
  const { spec, className, coreImport, helpers } = context;
  const lines: string[] = [];

  // ─── Header ─────────────────────────────────────────────────────────────────
  lines.push(`// Auto-generated by axionvera-cli codegen. DO NOT EDIT.`);
  lines.push(`// Re-run \`axionvera-cli codegen <contract.wasm>\` to regenerate.\n`);

  lines.push(`import { nativeToScVal } from "@stellar/stellar-sdk";`);
  lines.push(
    `import { BaseContract, BaseContractConfig } from "${coreImport}/contracts/BaseContract";\n`
  );

  // ─── UDT interfaces / enums ─────────────────────────────────────────────────
  for (const s of spec.structs) {
    lines.push(helpers.generateStructInterface(s));
  }
  for (const e of spec.enums) {
    lines.push(helpers.generateEnumType(e));
  }

  // ─── Args interfaces ────────────────────────────────────────────────────────
  for (const fn of spec.functions) {
    const iface = helpers.generateArgsInterface(fn);
    if (iface) lines.push(iface);
  }

  // ─── Class ──────────────────────────────────────────────────────────────────
  lines.push(`export class ${className} extends BaseContract {`);
  lines.push(`  constructor(config: BaseContractConfig) {`);
  lines.push(`    super(config);`);
  lines.push(`  }\n`);

  for (const fn of spec.functions) {
    lines.push(helpers.generateMethod(fn));
  }

  lines.push(`}`);
  lines.push(``);

  return lines.join('\n');
};

// ─── Main generator ──────────────────────────────────────────────────────────

/**
 * Generates a complete TypeScript source file for a contract class that
 * extends BaseContract, based on the parsed ContractSpec.
 *
 * @param spec       - Parsed contract specification from wasmParser
 * @param className  - Name for the generated class (e.g. "TokenContract")
 * @param coreImportOrTemplate - Import path for @axionvera/core (default: "@axionvera/core") or custom template function
 * @param template   - Custom template function (optional, if third param is coreImport)
 * @returns          - TypeScript source code as a string
 */
export function generateContractClass(
  spec: ContractSpec,
  className: string,
  coreImportOrTemplate: string | TemplateFunction = '@axionvera/core',
  template?: TemplateFunction
): string {
  let coreImport: string;
  let finalTemplate: TemplateFunction;

  if (typeof coreImportOrTemplate === 'function') {
    coreImport = '@axionvera/core';
    finalTemplate = coreImportOrTemplate;
  } else {
    coreImport = coreImportOrTemplate;
    finalTemplate = template ?? defaultTemplate;
  }

  const context: TemplateContext = {
    spec,
    className,
    coreImport,
    helpers: {
      toPascalCase,
      toCamelCase,
      encodeExpr,
      decodeExpr,
      generateArgsInterface,
      generateStructInterface,
      generateEnumType,
      generateMethod,
    },
  };

  return finalTemplate(context);
}
