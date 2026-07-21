export { parseWasm } from './wasmParser';
export { generateContractClass } from './generator';
export type {
  ContractSpec,
  SpecFunction,
  SpecParam,
  SpecStruct,
  SpecEnum,
  SpecEnumCase,
  SpecStructField,
} from './wasmParser';
export type { TemplateContext, TemplateFunction } from './generator';
export {
  toPascalCase,
  toCamelCase,
  encodeExpr,
  decodeExpr,
  generateArgsInterface,
  generateStructInterface,
  generateEnumType,
  generateMethod,
} from './generator';
