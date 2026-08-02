// Allegretto - Core Types
// Five value kinds + Param placeholder

// C4.1: the unified Structure class behind MultiValue/Context. structure.ts
// imports only TYPES from this module, so there is no runtime cycle.
import { newMultiValueStructure, newContextStructure, newDenseStructure, deriveWithChannels } from "./structure.js";

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
  /**
   * Phase D1: optional set of effect labels this primitive produces. Empty
   * / unset = pure. Labels are extension-provided strings (`io`, `net`,
   * `time`, `build-io`, …); the core defines none beyond the implicit pure.
   * The effect inference walker accumulates labels from primitives a
   * function transitively calls.
   */
  effects?: string[];
}

// --- Param: positional placeholder within function expressions ---

export interface ParamValue {
  kind: ValueKind.Param;
  position: number;
  owner: ComposedFunctionValue | null;
  _name?: string; // debugging hint
  /** Reserved for future refinement-predicate bounds on parameters.
   *  Currently unused at runtime — the F2 migration moved effect bounds to
   *  `effectBound` because effects describe computations and refinements
   *  describe data, with different lattices and lifetimes. The slot stays
   *  reserved so refinement-bound annotations (`x: PositiveInt`) can later
   *  flow through here without another schema change. */
  predicates?: import("./refinements.js").PredicateSet;
  /** Effect bound for function-typed params. Set by `typed_function_impl`
   *  from a param-type annotation's `__effectBound` (Surface A: `f: pure`),
   *  by Stage C2 marker stamping (`__effectvar:NAME` for polymorphic effect
   *  variables), and by the Surface C `param_effects` body-form peel-and-
   *  stamp pass. PE's Param-call branch reads this slot directly to
   *  propagate effects from param body to caller; call-site enforcement
   *  runs `impliesDomain` against it. */
  effectBound?: import("./effects.js").EffectSet;
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
  /** The bound value. `undefined` while the binding is a PENDING FUTURE
   *  CELL (declared-but-unresolved import, async future) — the evaluator
   *  residualises references to it. C2.3b: this is the ONE unresolved
   *  representation; there is no separate reactive-binding record. */
  value: Value | undefined;
  /** C2.3b future-cell state (host-plane, maintained by the reactive
   *  registry): names of incomplete dependencies while this binding's
   *  value is a residual. Absent on untracked bindings. */
  incompleteDeps?: Set<string>;
  /** C2.3b: completion flag. `false` while pending or residual; `true`
   *  once the value is fully resolved. Absent on untracked bindings
   *  (data-plane contexts, compile ctxs) — treat as complete. */
  isComplete?: boolean;
}

export interface ContextValue {
  kind: ValueKind.Context;
  bindings: Map<string, Binding>;
  bindingList: Binding[];
  /** C2.1 scope protocol: parent-chain layer link (evaluation scopes only —
   *  host-plane field, never a value slot). Lookup walks the chain. */
  parent?: ContextValue;
  /** C2.1: marks evaluation scopes vs data Contexts. Set by scopeNew/
   *  scopeExtend and the root eval-context builders. */
  isScope?: boolean;
  /**
   * Phase C scope-local predicate narrowing. When a binding is referenced
   * within a scope that has additional predicates known about it (e.g. from
   * a branch condition or an `assert` statement), the predicates are stored
   * here keyed by binding name. Symbol resolution merges them into the
   * resolved value's predicate set, so downstream references see the
   * narrowed view.
   *
   * The map is opaque to most ContextValue consumers — module loaders, type
   * machinery, etc. ignore it. Only the evaluator's Symbol resolution case
   * and the branch / assert primitives read or write it.
   */
  scopePredicates?: Map<string, unknown>;
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
  effects?: string[],
): PrimitiveFunctionValue {
  return { kind: ValueKind.PrimitiveFunction, name, fn, lazy, effects };
}

export function makeParam(position: number, name?: string): ParamValue {
  // Always declare optional fields so V8/JSC see a stable hidden class shape
  // across all Params, whether or not bounds end up being attached later.
  return { kind: ValueKind.Param, position, owner: null, _name: name,
           predicates: undefined, effectBound: undefined };
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

// C4.1 (structures Phase 4): both factories are now SHIMS over the
// unified Structure class (src/structure.ts) — one host representation,
// one hidden class, constructed only here. The returned objects satisfy
// the legacy interfaces field-for-field; the physical layout migrates
// inside structure.ts from now on.
export function makeContext(): ContextValue {
  return newContextStructure() as unknown as ContextValue;
}

export function makeMultiValue(primary: Value, components?: Map<string, Value>): MultiValueType {
  // C4.3b: MV-over-Context is unconstructible — a Context primary flattens
  // into a copy-on-write derive carrying the channel plane directly (one
  // structure, both planes). Every wrapper site (withType, withEffects,
  // channel writers, mv_set, …) flows through this single chokepoint, so
  // typed records/types answer ValueKind.Context. The returned static type
  // is a lie for that case; call sites read through the slots.ts accessors
  // (dataOf is identity for Contexts), not `.primary`.
  if (primary.kind === ValueKind.Context) {
    return deriveWithChannels(primary as ContextValue, components ?? new Map()) as unknown as MultiValueType;
  }
  return newMultiValueStructure(primary, components ?? new Map()) as unknown as MultiValueType;
}

/** C4.2: construct a dense numeric-keyed structure (array context) — the
 *  element array is adopted. Element reads go through slots.ts `indexGet`;
 *  the legacy bindings view materializes lazily for stragglers. */
export function makeDenseArrayCtx(elements: Value[]): ContextValue {
  return newDenseStructure(elements) as unknown as ContextValue;
}

// --- Utilities ---

/** Data-plane read: identity for everything except a transparent scalar
 *  structure (MultiValue role), whose data lives in `primary`. C4.3c: the
 *  former `primaryOf` name is retired — this IS the accessor (re-exported
 *  through slots.ts; both import paths resolve to this one function). */
export function dataOf(v: Value): Value {
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
   *  the module. When the importing file uses `use NAME`, the module's
   *  fragment (plus any Grammar values in bindings) is merged into the
   *  parser config before parsing. */
  grammarFragment?: GrammarFragment;
}

/** A module's contribution to the grammar. Produced by:
 *   - Phase 1 `register_infix` / `register_prefix` / `register_postfix` /
 *     `register_expr_prefix` — single-operator registrations with numeric bp.
 *   - Phase 6 `grammar { … }` blocks — named precedence, multi-token forms,
 *     user sub-rules, `extends` base.
 *
 *  Consumed by `src/grammar2/fragments.ts` to build extended grammar2 grammars
 *  when files declare `use NAME` (or `use import NAME`).
 *
 *  Phase 6 fields are all optional so Phase 1 fragments continue to work
 *  unchanged. `emptyGrammarFragment()` initialises the Phase 1 arrays only;
 *  Phase 6 fields are populated by their respective primitives when used. */
export interface GrammarFragment {
  // --- Phase 1 (compatible) ---

  /** Identifiers that should tokenize as user keywords (added to reserved set). */
  keywords: string[];
  /** Operator-char sequences (tracked for conflict detection). */
  operators: string[];
  /** Binary operator parselets — fn is a ComposedFunction(left, right) → ast */
  infix:      Array<{
    token: string;
    bp?:   number;                          // Phase 1 numeric BP
    level?: string;                         // Phase 6 named level
    assoc?: "left" | "right" | "none";      // Phase 6 associativity
    fn:    Value;
  }>;
  /** Unary prefix operator parselets — fn is a ComposedFunction(arg) → ast */
  prefixOp:   Array<{
    token: string;
    bp?:   number;
    level?: string;
    fn:    Value;
  }>;
  /** Unary postfix operator parselets — fn is a ComposedFunction(arg) → ast */
  postfixOp:  Array<{
    token: string;
    bp?:   number;
    level?: string;
    fn:    Value;
  }>;
  /** Keyword-led unary prefix parselets — `kw EXPR` → fn(EXPR) */
  exprPrefix: Array<{ keyword: string; fn: Value }>;

  // --- Phase 6 (additive) ---

  /** Name of the grammar this fragment extends. "allegro" | "empty" | <name>.
   *  Phase 1 fragments leave this undefined → treated as "allegro". */
  base?: string;

  /** User-declared precedence levels with constraints. Anonymous levels get
   *  gensym names. Constraints are resolved during fragment merge. */
  precedence?: Array<{
    name: string;
    constraints: Array<
      | { kind: "at";    target: string }
      | { kind: "above"; target: string }
      | { kind: "below"; target: string }
    >;
  }>;

  /** Multi-token expression-level forms: `expr_form "match" s:expr "with" …`.
   *  The stored `rule` is the full EBNF body — typically a seq with some
   *  labeled items. The merger walks it to find labels in order and binds
   *  matched sub-ASTs positionally to the template `fn`. */
  exprForms?: Array<{ rule: GrammarFragmentRule; fn: Value }>;

  /** Multi-token statement-level forms: `stmt_form "for" x:ident … `. */
  stmtForms?: Array<{ rule: GrammarFragmentRule; fn: Value }>;

  /** User-defined sub-rules (local nonterms that forms can reference).
   *  `op` kinds:
   *    - "add":        add a new production, or replace an existing one by name
   *    - "append":     append an alternative to an existing alt-rule production
   *    - "replaceAlt": replace a specific named alternative in the production
   *    - "remove":     remove a specific named alternative
   *  `selector` names the target alt for replaceAlt / remove. */
  rules?: Array<{
    name:      string;
    op:        "add" | "append" | "replaceAlt" | "remove";
    rule:      GrammarFragmentRule;
    builder?:  Value;
    selector?: string;
  }>;
}

/** Structural rule shape used in fragments. Opaque to types.ts — the actual
 *  Rule shape lives in src/grammar2/types.ts. We hold it as unknown here to
 *  keep types.ts free of grammar2 imports (layering). */
export type GrammarFragmentRule = unknown;

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