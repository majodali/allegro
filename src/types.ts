// Allegretto - Core Types
// The seven representation kinds (docs/design/concepts.md §2): Bits,
// Symbol, Param, Expression, ComposedFunction, PrimitiveFunction and
// Structure — the one composite (D1/D46).

// C4.1: the unified Structure class behind MultiValue/Context. structure.ts
// imports only TYPES from this module, so there is no runtime cycle.
import { newCarrierStructure, newRecordStructure, newDenseStructure, deriveWithMeta, isCarrier } from "./structure.js";

export enum ValueKind {
  Bits = "Bits",
  PrimitiveFunction = "PrimitiveFunction",
  ComposedFunction = "ComposedFunction",
  Expression = "Expression",
  // C7.1 (D25 completes): the `Context` kind-name is retired — the one
  // composite representation is Structure. The evaluation-environment
  // role is Scope (host plane, not a kind).
  Structure = "Structure",
  Param = "Param",
  Symbol = "Symbol",
}

// --- The metadata plane (docs/design/concepts.md §18/§19) --------------------

/**
 * The metadata a value carries through partial evaluation, keyed by
 * REGISTERED FIELD NAME (`src/slots.ts`). Each field declares a propagation
 * rule and a writer capability; the propagation table decides what happens
 * to each on every PE hop.
 *
 * Vocabulary (maintainer ruling, 2026-08): the plane is **metadata**, its
 * entries are **metadata fields**, and a **channel** is a higher-level system
 * capability that USES metadata fields. The registry holds only fields today,
 * so nothing here is called a channel; B-111 introduces channel-level
 * registration and takes the word back.
 */
export type Metadata = Map<string, Value>;

/**
 * Every representation kind carries metadata (D48(b), B-121). Optional
 * because the base defines fields only for BASE concepts and never the
 * layers' (R6, R11) — so under `--base` a value carries at most `error` and
 * `source`, and usually nothing. (C1 wrote "Allegretto defines no fields at
 * all"; C3 disproved it by running the code — `make_error` and `source of`
 * both work in base mode, so those two are Allegretto's own.) The two populations without metadata are
 * every value in Allegretto mode and engine intermediates that never become
 * program values; neither is a Standard-mode program value.
 *
 * Optional in the TYPE, always declared on the OBJECT: see `makeParam` on
 * why every factory sets its optional fields explicitly.
 */
export interface MetadataBearing {
  meta?: Metadata;
}

// --- Bits: vector of bits with a known length ---

export interface BitsValue extends MetadataBearing {
  kind: ValueKind.Bits;
  length: number;
  data: bigint;
}

// --- Primitive Function ---

export type EvalFn = (value: Value, ctx: StructureValue) => Value;

export type PrimitiveFnImpl = (
  args: Value[],
  ctx: StructureValue,
  evalFn: EvalFn,
) => Value;

export interface PrimitiveFunctionValue extends MetadataBearing {
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
  /**
   * D47 (B-094): source-aware registration — the data-plane analogue of
   * `lazy`. At call sites of a source-aware primitive the evaluator
   * attaches each argument's ORIGINATING Expression AST to the evaluated
   * argument value on the `source` channel (kernel-originated; `drop`
   * propagation). Lazy is for *not evaluating*; source-aware is for
   * *seeing what was evaluated*. Cost is zero at all other call sites.
   */
  sourceAware?: boolean;
}

// --- Param: positional placeholder within function expressions ---

export interface ParamValue extends MetadataBearing {
  kind: ValueKind.Param;
  position: number;
  /** The function that claimed this param, or `null` while unclaimed.
   *  **Only the null-ness is read** (the parser collects unclaimed params);
   *  the IDENTITY is read nowhere since B-121 — "is this param the applied
   *  function's own?" is `ownsParam`, i.e. membership in `fn.params`. Keeping
   *  the back-pointer accurate across clones is therefore no longer an
   *  obligation, which retires the "don't corrupt the original" hazard that
   *  `modules.ts` and `evaluator.ts` both warn about. */
  owner: ComposedFunctionValue | null;
  _name?: string; // debugging hint
  /** Reserved for future refinement-predicate bounds on parameters.
   *  Currently unused at runtime — the F2 migration moved effect bounds to
   *  `effectBound` because effects describe computations and refinements
   *  describe data, with different lattices and lifetimes. The slot stays
   *  reserved so refinement-bound annotations (`x: PositiveInt`) can later
   *  flow through here without another schema change. */
  predicates?: import("./refinements.js").PredicateSet;
  /** Effect bound for function-typed params — CONCRETE labels only. Set by
   *  `typed_function_impl` from a param-type annotation's `effectBound`
   *  (Surface A: `f: pure`) and by the Surface C `param_effects` body-form
   *  peel-and-stamp pass. PE's Param-call branch reads this slot directly
   *  to propagate effects from param body to caller; call-site enforcement
   *  runs `impliesDomain` against it. */
  effectBound?: import("./effects.js").EffectSet;
  /** C7.2c: DECLARED effect variable — the name of the Effect-kinded entry
   *  in the owner function's `genericParams` this param's effects are
   *  bound to (`apply[e: Effect](g: e, …)` → g.effectVar = "e"). Replaces
   *  the retired `__effectvar:NAME` marker-string labels inside
   *  `effectBound`: the reference is structural, the variable's bare name
   *  rides inferred effect sets, and call sites resolve it by ordinary PE
   *  substitution. Mutually exclusive with `effectBound`. */
  effectVar?: string;
}

// --- Symbol: named reference resolved during compilation ---
// Created by the parser for identifiers. Resolved by resolveSymbols to
// the binding's value or a Param (for function parameters).

export interface SymbolValue extends MetadataBearing {
  kind: ValueKind.Symbol;
  /** Base-name projection — printing, lexical resolution, loose matching. */
  name: string;
  /** C5.1: fully-qualified name for REGISTERED symbols (identity = FQN;
   *  interned in src/symbols.ts — same FQN is the same object). Absent on
   *  transient parser-minted reference symbols, which have no identity
   *  beyond their occurrence and resolve by base name against scope. */
  fqn?: string;
}

// --- Composed Function: expression body with declared params ---

export interface ComposedFunctionValue extends MetadataBearing {
  kind: ValueKind.ComposedFunction;
  params: ParamValue[];
  body: Value;
}

// --- Expression: DAG node ---

export interface ExpressionValue extends MetadataBearing {
  kind: ValueKind.Expression;
  fn: Value;
  args: Value[];
  memo: Map<string, Value>;
}

// --- Structure: the one composite representation (D1/D46) ---

export interface Binding {
  key: string | null;
  /** The bound value. `undefined` while the binding is a PENDING FUTURE
   *  CELL (declared-but-unresolved import, async future) — the evaluator
   *  residualises references to it. C2.3b: this is the ONE unresolved
   *  representation; there is no separate reactive-binding record. */
  value: Value | undefined;
  /** B-097 V1 (D42/V-R4): visibility is a property of the BINDING in its
   *  scope, never of the value — `export x = …` marks the binding;
   *  `y = x` copies the value and NO visibility (the old value-plane
   *  marker's aliasing wart is dead). Absent = default (module-private
   *  once a module declares any export; open-module policy otherwise —
   *  see modules.ts). */
  visibility?: "exported";
  /** C2.3b future-cell state (host-plane, maintained by the reactive
   *  registry): names of incomplete dependencies while this binding's
   *  value is a residual. Absent on untracked bindings. */
  incompleteDeps?: Set<string>;
  /** C2.3b: completion flag. `false` while pending or residual; `true`
   *  once the value is fully resolved. Absent on untracked bindings
   *  (data-plane contexts, compile ctxs) — treat as complete. */
  isComplete?: boolean;
  /** B-028 F4: minted by `makeCell` (future/import cells) and PERMANENT —
   *  still true after resolution. Completion replacement only evaluates
   *  slot values whose symbols reference a marked cell, so quoted-AST
   *  data held in slots is never re-executed by the cascade. */
  cell?: boolean;
}

/**
 * HOST PLANE (docs/design/concepts.md §18) — engine bookkeeping about a
 * structure that is NOT part of the value. Nothing here is a slot, nothing
 * propagates through partial evaluation, and no Allegro program can read it.
 *
 * Declared as its own interface rather than inline on `StructureValue`
 * because the plane distinction used to live only in per-field comments,
 * which the value interface then contradicted by declaring them as its own
 * (concepts.md deltas 15 and 18 → B-107(f)). These three ARE correctly on
 * the host plane; only the declaration was wrong. Host-plane data that
 * belongs on the METADATA plane is a different item — B-118.
 */
export interface StructureHostFields {
  /** C2.1 scope protocol: parent-chain layer link (evaluation scopes only).
   *  Lookup walks the chain. */
  parent?: StructureValue;
  /** C2.1: marks evaluation scopes vs data structures. Set by scopeNew/
   *  scopeExtend and the root eval-scope builders. */
  isScope?: boolean;
  /**
   * Phase C scope-local predicate narrowing. When a binding is referenced
   * within a scope that has additional predicates known about it (e.g. from
   * a branch condition or an `assert` statement), the predicates are stored
   * here keyed by binding name. Symbol resolution merges them into the
   * resolved value's predicate set, so downstream references see the
   * narrowed view.
   *
   * The map is opaque to most StructureValue consumers — module loaders,
   * type machinery, etc. ignore it. Only the evaluator's Symbol resolution
   * case and the branch / assert primitives read or write it.
   */
  scopePredicates?: Map<string, unknown>;
}

export interface StructureValue extends StructureHostFields, MetadataBearing {
  kind: ValueKind.Structure;
  /** Binding plane: what a name resolves to. Also the data plane's storage
   *  for record-role structures — two planes, one map (concepts.md §13). */
  bindings: Map<string, Binding>;
  bindingList: Binding[];
}

// --- The carrier (C7.1, D15/D46; docs/design/concepts.md §10): the
// former MultiValue KIND is now a CONFIGURATION of Structure — a
// transparent structure with an empty data plane whose data rides in
// `primary` and whose metadata rides in `meta`. It answers the same
// kind as every structure; the host-level discriminant is primary
// presence (`isCarrier`). This is the carrier's static shape, for the
// paths that have already established they hold one.

export type CarrierStructure = StructureValue & {
  primary: Value;
  meta: Metadata;
};

// --- Union type ---

export type Value =
  | BitsValue
  | PrimitiveFunctionValue
  | ComposedFunctionValue
  | ExpressionValue
  | StructureValue
  | ParamValue
  | SymbolValue;

// --- Constructors ---

export function makeBits(length: number, data: bigint | number): BitsValue {
  return { kind: ValueKind.Bits, length, data: typeof data === "number" ? BigInt(data) : data, meta: undefined };
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
  sourceAware?: boolean,
): PrimitiveFunctionValue {
  return { kind: ValueKind.PrimitiveFunction, name, fn, lazy, effects, sourceAware, meta: undefined };
}

export function makeParam(position: number, name?: string): ParamValue {
  // Always declare optional fields so V8/JSC see a stable hidden class shape
  // across all Params, whether or not bounds end up being attached later.
  return { kind: ValueKind.Param, position, owner: null, _name: name,
           predicates: undefined, effectBound: undefined, effectVar: undefined,
           meta: undefined };
}

/**
 * Is `param` one of `fn`'s own parameters?
 *
 * Substitution needs to know whether a Param it meets while walking a body
 * belongs to the function being applied or to a nested lambda. That was asked
 * as `param.owner === fn` — a BACK-POINTER comparison — which made
 * `param.owner` an identity that every function-cloning site had to maintain,
 * by either re-pointing shared params (corrupting the original, as
 * `modules.ts` and `evaluator.ts` both warn) or cloning the params and
 * rewriting the body.
 *
 * Membership answers the same question directly and needs neither: a clone
 * that SHARES the params array owns them, and a nested lambda's params are
 * different objects that are simply not in the array. Verified equivalent —
 * the suite is green with the identity test replaced by this one.
 *
 * `param.owner` survives, but only its NULL-NESS is now read (the parser
 * collects not-yet-claimed params with `owner === null`). Its identity is
 * read nowhere.
 */
export function ownsParam(fn: ComposedFunctionValue, param: ParamValue): boolean {
  return fn.params.includes(param);
}

export function makeSymbol(name: string): SymbolValue {
  // Transient reference symbol (no FQN). Declare the optional field for a
  // stable hidden class shared with registered symbols (src/symbols.ts).
  return { kind: ValueKind.Symbol, name, fqn: undefined, meta: undefined };
}

export function makeExpr(fn: Value, args: Value[]): ExpressionValue {
  return { kind: ValueKind.Expression, fn, args, memo: new Map(), meta: undefined };
}

export function makeComposedFn(params: ParamValue[], body: Value): ComposedFunctionValue {
  const fn: ComposedFunctionValue = { kind: ValueKind.ComposedFunction, params, body, meta: undefined };
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
export function makeStructure(): StructureValue {
  return newRecordStructure() as unknown as StructureValue;
}

/**
 * THE metadata-attachment chokepoint (B-121 C2, D48(b)).
 *
 * Attaching metadata yields a NEW value **of the same kind**. Until C2 a
 * non-Structure was wrapped in a CARRIER — an eleven-field `Structure` whose
 * `primary` held the real value — so 74% of every structure allocated was a
 * wrapper existing to hold, in 98.5% of cases, a single field. Now every kind
 * carries `meta` itself: a typed Bits is a Bits.
 *
 * Why a NEW value rather than a mutation: metadata is a property of a value
 * *in a position*, not of the datum. Measured, 33.6% of attachments target an
 * object that has already been given metadata, so stamping in place would
 * overwrite the first stamp everywhere the value is held. (A side table keyed
 * by the object fails identically. D22 is the rule adopted BECAUSE of this.)
 *
 * The clones preserve identity-bearing host state per kind:
 *  - functions SPREAD, so JS expandos ride along automatically — the
 *    `FIELD_WRITER_BRAND` on a writer, `genericParams` and the
 *    `PRESERVED_FN_META_KEYS` family on a ComposedFunction. A spread cannot
 *    forget one the way a hand-written field list can.
 *  - a ComposedFunction clone SHARES its `params`, which is safe because
 *    substitution asks `ownsParam` — membership in `fn.params` — rather than
 *    the `param.owner` back-pointer.
 *  - an Expression clone SHARES its `memo`: same `fn` and `args` mean the same
 *    memo is correct, and re-deriving it would forfeit IC-6.
 */
export function withMetadata(v: Value, meta?: Metadata): Value {
  const m = meta ?? new Map<string, Value>();
  switch (v.kind) {
    case ValueKind.Structure:
      return deriveWithMeta(v as StructureValue, m) as unknown as StructureValue;
    case ValueKind.Bits:
      return { kind: ValueKind.Bits, length: v.length, data: v.data, meta: m };
    case ValueKind.Expression:
      return { kind: ValueKind.Expression, fn: v.fn, args: v.args, memo: v.memo, meta: m };
    case ValueKind.Symbol:
      if (v.fqn !== undefined) warnInternedSymbolMeta();
      return { kind: ValueKind.Symbol, name: v.name, fqn: v.fqn, meta: m };
    default:
      // Param, PrimitiveFunction, ComposedFunction — spread carries expandos.
      return { ...v, meta: m };
  }
}

/**
 * B-121 §6 ruling 2 (maintainer): a WARNING, not an error, and expected to be
 * removable. A registered Symbol's identity IS its FQN — same FQN, same object
 * (SC-4/IC-4) — so cloning one to attach metadata breaks pointer identity.
 * Measured across the corpus, carriers wrapped a Symbol **zero** times, and no
 * use case for user-created Symbols is defined, so what form such metadata
 * should take is not yet clear. Warn rather than refuse, and count it so the
 * suite can see the mechanism fire.
 */
let internedSymbolMetaCount = 0;
function warnInternedSymbolMeta(): void {
  internedSymbolMetaCount++;
  if (internedSymbolMetaCount === 1) {
    console.warn(
      "[allegro] metadata attached to an interned Symbol: its identity is its " +
      "FQN (SC-4/IC-4), and the clone breaks pointer identity. Measured at zero " +
      "occurrences when this warning was added — see B-121 §6 ruling 2.");
  }
}

/** Test hook for the warning above; removed with it. */
export function internedSymbolMetaWarnings(): number { return internedSymbolMetaCount; }

/** C4.2: construct a dense numeric-keyed structure (array context) — the
 *  element array is adopted. Element reads go through slots.ts `indexGet`;
 *  the legacy bindings view materializes lazily for stragglers. */
export function makeDenseArray(elements: Value[]): StructureValue {
  return newDenseStructure(elements) as unknown as StructureValue;
}

// --- Utilities ---

/** Data-plane read: identity for everything except a transparent scalar
 *  structure (MultiValue role), whose data lives in `primary`. C4.3c: the
 *  former `primaryOf` name is retired — this IS the accessor (re-exported
 *  through slots.ts; both import paths resolve to this one function). */
export function dataOf(v: Value): Value {
  // Carrier check by primary presence — one property read; non-Structure
  // values lack the field entirely.
  const p = (v as { primary?: Value }).primary;
  return p !== undefined ? p : v;
}

export function isResolved(v: Value): boolean {
  switch (v.kind) {
    case ValueKind.Bits:
    case ValueKind.PrimitiveFunction:
    case ValueKind.ComposedFunction:
      return true;
    case ValueKind.Structure: {
      // C7.1: a carrier is as resolved as its primary (a residual under
      // channels is still a residual); plain structures self-resolve.
      const p = (v as { primary?: Value }).primary;
      return p === undefined ? true : isResolved(p);
    }
    case ValueKind.Param:
    case ValueKind.Symbol:
      return false;
    case ValueKind.Expression:
      return false;
  }
}

// --- String/Bits conversion (UTF-8) ---

// One encoder/decoder for the process. Both are stateless for our use
// (default UTF-8, no streaming), and these two functions sit on the
// hottest path in the system — every type-name read, every dispatch,
// every string literal. Constructing them per call profiled at ~9% of a
// heavy compile. Browser-compatible either way (never `Buffer`).
const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder();

export function stringToBits(s: string): BitsValue {
  const bytes = UTF8_ENCODER.encode(s);
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
  return UTF8_DECODER.decode(bytes);
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
