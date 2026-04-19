// Allegretto - Core Types
// Five value kinds + Param placeholder

export enum ValueKind {
  Bits = "Bits",
  PrimitiveFunction = "PrimitiveFunction",
  ComposedFunction = "ComposedFunction",
  Expression = "Expression",
  Context = "Context",
  MultiValue = "MultiValue",
  Param = "Param",
  Symbol = "Symbol",
}

// --- Bits: vector of bits with a known length ---

export interface BitsValue {
  kind: ValueKind.Bits;
  length: number;
  data: bigint;
}

// --- Primitive Function ---

export type EvalFn = (value: Value, ctx: ContextValue) => Value;

export type PrimitiveFnImpl = (
  args: Value[],
  ctx: ContextValue,
  evalFn: EvalFn,
) => Value;

export interface PrimitiveFunctionValue {
  kind: ValueKind.PrimitiveFunction;
  name: string;
  fn: PrimitiveFnImpl;
  lazy?: boolean;
}

// --- Param: positional placeholder within function expressions ---

export interface ParamValue {
  kind: ValueKind.Param;
  position: number;
  owner: ComposedFunctionValue | null;
  _name?: string; // debugging hint
}

// --- Symbol: named reference resolved during compilation ---
// Created by the parser for identifiers. Resolved by resolveSymbols to
// the binding's value or a Param (for function parameters).

export interface SymbolValue {
  kind: ValueKind.Symbol;
  name: string;
}

// --- Composed Function: expression body with declared params ---

export interface ComposedFunctionValue {
  kind: ValueKind.ComposedFunction;
  params: ParamValue[];
  body: Value;
}

// --- Expression: DAG node ---

export interface ExpressionValue {
  kind: ValueKind.Expression;
  fn: Value;
  args: Value[];
  memo: Map<string, Value>;
}

// --- Context: evaluation context with bindings ---

export interface Binding {
  key: string | null;
  value: Value | undefined;
  isUse: boolean;
}

export interface ContextValue {
  kind: ValueKind.Context;
  bindings: Map<string, Binding>;
  bindingList: Binding[];
}

// --- Multi-Value: primary + named components ---

export interface MultiValueType {
  kind: ValueKind.MultiValue;
  primary: Value;
  components: Map<string, Value>;
}

// --- Union type ---

export type Value =
  | BitsValue
  | PrimitiveFunctionValue
  | ComposedFunctionValue
  | ExpressionValue
  | ContextValue
  | MultiValueType
  | ParamValue
  | SymbolValue;

// --- Constructors ---

export function makeBits(length: number, data: bigint | number): BitsValue {
  return { kind: ValueKind.Bits, length, data: typeof data === "number" ? BigInt(data) : data };
}

export function makeInt(value: number): BitsValue {
  return makeBits(64, BigInt(value));
}

export function makeFloat(value: number): BitsValue {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setFloat64(0, value, true); // little-endian
  const lo = BigInt(new Uint32Array(buf)[0]);
  const hi = BigInt(new Uint32Array(buf)[1]);
  return makeBits(64, (hi << 32n) | lo);
}

export function bitsToFloat(v: BitsValue): number {
  const buf = new ArrayBuffer(8);
  new Uint32Array(buf)[0] = Number(v.data & 0xFFFFFFFFn);
  new Uint32Array(buf)[1] = Number((v.data >> 32n) & 0xFFFFFFFFn);
  return new DataView(buf).getFloat64(0, true);
}

export function makePrimitive(
  name: string,
  fn: PrimitiveFnImpl,
  lazy?: boolean,
): PrimitiveFunctionValue {
  return { kind: ValueKind.PrimitiveFunction, name, fn, lazy };
}

export function makeParam(position: number, name?: string): ParamValue {
  return { kind: ValueKind.Param, position, owner: null, _name: name };
}

export function makeSymbol(name: string): SymbolValue {
  return { kind: ValueKind.Symbol, name };
}

export function makeExpr(fn: Value, args: Value[]): ExpressionValue {
  return { kind: ValueKind.Expression, fn, args, memo: new Map() };
}

export function makeComposedFn(params: ParamValue[], body: Value): ComposedFunctionValue {
  const fn: ComposedFunctionValue = { kind: ValueKind.ComposedFunction, params, body };
  for (const p of params) {
    p.owner = fn;
  }
  return fn;
}

export function makeContext(): ContextValue {
  return { kind: ValueKind.Context, bindings: new Map(), bindingList: [] };
}

export function makeMultiValue(primary: Value, components?: Map<string, Value>): MultiValueType {
  return { kind: ValueKind.MultiValue, primary, components: components ?? new Map() };
}

// --- Utilities ---

export function primaryOf(v: Value): Value {
  return v.kind === ValueKind.MultiValue ? v.primary : v;
}

export function isResolved(v: Value): boolean {
  switch (v.kind) {
    case ValueKind.Bits:
    case ValueKind.PrimitiveFunction:
    case ValueKind.ComposedFunction:
    case ValueKind.Context:
      return true;
    case ValueKind.Param:
    case ValueKind.Symbol:
      return false;
    case ValueKind.MultiValue:
      return isResolved(v.primary);
    case ValueKind.Expression:
      return false;
  }
}

// --- String/Bits conversion (UTF-8) ---

export function stringToBits(s: string): BitsValue {
  const bytes = new TextEncoder().encode(s);
  let data = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) {
    data = (data << 8n) | BigInt(bytes[i]);
  }
  return makeBits(bytes.length * 8, data);
}

export function bitsToString(b: BitsValue): string {
  const byteLen = Math.ceil(b.length / 8);
  const bytes = new Uint8Array(byteLen);
  let data = b.data;
  for (let i = 0; i < byteLen; i++) {
    bytes[i] = Number(data & 0xFFn);
    data >>= 8n;
  }
  return new TextDecoder().decode(bytes);
}

// --- Extension interface (here to avoid circular deps) ---

export interface Extension {
  name: string;
  bindings: Record<string, Value>;
  /** Typed module object for use with import + dot access. */
  moduleObject?: Value;
  /** Grammar-extension fragment populated by register_* primitives inside
   *  the module. When the importing file uses `use_grammar NAME`, the module's
   *  fragment is merged into the parser config before parsing. */
  grammarFragment?: GrammarFragment;
}

/** A module's contribution to the hybrid-parser grammar. */
export interface GrammarFragment {
  /** Identifiers that should tokenize as UserKeyword instead of Ident */
  keywords: string[];
  /** Operator-char sequences that should tokenize as UserOp */
  operators: string[];
  /** Binary operator parselets — fn is a ComposedFunction(left, right) → ast */
  infix: Array<{ token: string; bp: number; fn: Value }>;
  /** Unary prefix operator parselets — fn is a ComposedFunction(arg) → ast */
  prefixOp: Array<{ token: string; bp: number; fn: Value }>;
  /** Unary postfix operator parselets — fn is a ComposedFunction(arg) → ast */
  postfixOp: Array<{ token: string; bp: number; fn: Value }>;
  /** Keyword-led unary prefix parselets — `kw EXPR` → fn(EXPR) */
  exprPrefix: Array<{ keyword: string; fn: Value }>;
}

export function emptyGrammarFragment(): GrammarFragment {
  return {
    keywords: [],
    operators: [],
    infix: [],
    prefixOp: [],
    postfixOp: [],
    exprPrefix: [],
  };
}

// --- Dependency tracking for forward-chaining partial evaluation ---

/** Accumulates names of bindings accessed during evaluation that are incomplete. */
export interface DepCollector {
  incompleteRefs: Set<string>;
}

// --- Error class ---

export class AllegroError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AllegroError";
  }
}