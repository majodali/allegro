// =============================================================================
// Allegro — Refinements as a proof substrate (Phase B of the provability arc)
//
// The existing refinement-type machinery (src/types-std.ts `buildRefinedType`)
// treats predicates as opaque Allegro expressions — runtime-evaluated at
// construction to accept or reject a value. That works but gives the compiler
// no visibility: it can't tell `(x: Int && _ > 0) + 1` carries `> 1`.
//
// Phase B adds an *abstract domain* alongside the predicate. Common predicate
// shapes (`_ > k`, `_ <= k`, `_ in [a, b]`, `_ != k`) get recognised at
// type-construction time and summarised into a compact algebraic form the
// compiler can propagate through arithmetic, comparisons, and other
// primitives. Opaque predicates (e.g. `_ is_prime`) retain the runtime check
// but their abstract domain is `Unknown` — honest about what can't be proved.
//
// When an operation happens and its inputs have abstract domains, the output
// value receives a propagated domain as a `"domain"` component on its
// MultiValue. The introspection surface (Phase A) reads this directly.
//
// See .claude/plans/crystal-proving-curry.md for the broader plan.
// =============================================================================

import { dataOf, cloneComponents, componentsView, channelReadRaw, typeShape, getAbstractDomain } from "./slots.js";
import {
  Value, ValueKind, BitsValue, ContextValue,
  makeMultiValue, makeContext, makeInt, isResolved,
} from "./types.js";

// =============================================================================
// Abstract-domain representation
// =============================================================================

/**
 * Integer interval domain. Unbounded ends use ±Infinity. Closed endpoints
 * only for now — open intervals degrade to closed on the tighter side
 * (`_ > 5` for integers becomes `[6, +Inf]`). Float intervals will come in
 * a later pass; for Phase B focus on the integer case since that's where
 * most user refinements land.
 */
export interface IntervalDomain {
  kind: "interval";
  /** Inclusive lower bound. `-Infinity` = unbounded below. */
  lo:   number;
  /** Inclusive upper bound. `+Infinity` = unbounded above. */
  hi:   number;
}

/** Exclusion of a single value — `_ != k`. */
export interface NotEqualDomain {
  kind:  "ne";
  value: number;
}

/** Exact single value — `_ == k`. */
export interface EqualDomain {
  kind:  "eq";
  value: number;
}

/**
 * Everything else. The compiler will fall back to the runtime predicate check
 * but won't make claims based on shape. Still carries a pointer to the raw
 * predicate for downstream tools that want to display it.
 */
export interface OpaqueDomain {
  kind:      "opaque";
  predicate: Value;
}

/**
 * Phase D1 sub-chunk 1.2: an effect-set domain. Carries a flat label set —
 * the same `Set<string>` representation chunk-1 used in `src/effects.ts`,
 * lifted into the predicate-set machinery so that effect facts compose with
 * numeric refinements through the same lattice operations.
 *
 * `pure` is the empty set; `opaque` (Slice 2's universal effect) is currently
 * encoded by callers outside this domain — we'll formalise it when anonymous
 * conjunctions land. The labels are concrete strings tagged with
 * `source: "effects-inferred"` (from PE-driven inference in
 * `precompileFunction`) or `source: "effects-declared"` (from an `effects`
 * body-form clause).
 */
export interface EffectsDomain {
  kind:   "effects";
  labels: Set<string>;
}

export type AbstractDomain =
  | IntervalDomain
  | NotEqualDomain
  | EqualDomain
  | OpaqueDomain
  | EffectsDomain;

/** Convenience constructor — labels Set defaulting to empty (= `pure`). */
export function effectsDomain(labels: Iterable<string> = []): EffectsDomain {
  return { kind: "effects", labels: new Set(labels) };
}

/** Short human-readable rendering of a domain (used by introspect output). */
export function formatDomain(d: AbstractDomain): string {
  switch (d.kind) {
    case "interval": {
      const lo = d.lo === -Infinity ? "-∞" : String(d.lo);
      const hi = d.hi === +Infinity ? "+∞" : String(d.hi);
      if (d.lo === d.hi) return `== ${d.lo}`;
      if (d.lo === -Infinity && d.hi === +Infinity) return "any Int";
      if (d.lo === -Infinity) return `≤ ${d.hi}`;
      if (d.hi === +Infinity) return `≥ ${d.lo}`;
      return `∈ [${lo}, ${hi}]`;
    }
    case "ne":   return `≠ ${d.value}`;
    case "eq":   return `== ${d.value}`;
    case "opaque": return "<predicate>";
    case "effects":
      return d.labels.size === 0 ? "pure" : [...d.labels].sort().join(", ");
  }
}

// =============================================================================
// Pattern recognition — predicate Value → AbstractDomain
// =============================================================================

/**
 * Try to recognise a refinement predicate and return its abstract domain.
 * Accepts the predicate as stored in `__predicate` on a refined type: a
 * ComposedFunction whose body is an Expression involving the sole Param
 * (the value being checked — conventionally named `_`).
 *
 * Recognised shapes (`p` = the Param value):
 *   p >  k,   p >= k,   p <  k,   p <= k   (k a resolved Int)
 *   p == k,   p != k
 *   p > a && p < b   (conjunction compact to interval)
 *
 * Returns `Opaque` for anything else, preserving the predicate for runtime
 * use.
 */
export function domainFromPredicate(predicate: Value): AbstractDomain {
  const p = dataOf(predicate);
  if (p.kind !== ValueKind.ComposedFunction) {
    return { kind: "opaque", predicate };
  }
  const paramId = p.params[0];
  if (!paramId) return { kind: "opaque", predicate };

  const dom = interpretPredicateExpr(p.body, paramId);
  return dom ?? { kind: "opaque", predicate };
}

/** Recursively walk an Allegro expression tree and try to produce an
 *  abstract domain. Returns null if the shape isn't recognised. */
function interpretPredicateExpr(expr: Value, paramId: unknown): AbstractDomain | null {
  // Strip MultiValue wrapping (typed_and etc. may wrap results).
  const e = dataOf(expr);
  if (e.kind !== ValueKind.Expression) return null;
  const fn = dataOf(e.fn);
  if (fn.kind !== ValueKind.PrimitiveFunction) return null;

  // Conjunction — combine the two sides.
  //
  // Allegro's `&&` compiles to `typed_and(left, thunk(right))`. Thunk is a
  // zero-param ComposedFunction; its body is the actual right expression.
  if (fn.name === "typed_and") {
    if (e.args.length !== 2) return null;
    const leftDom  = interpretPredicateExpr(e.args[0], paramId);
    const rightArg = dataOf(e.args[1]);
    let rightDom: AbstractDomain | null = null;
    if (rightArg.kind === ValueKind.ComposedFunction && rightArg.params.length === 0) {
      rightDom = interpretPredicateExpr(rightArg.body, paramId);
    } else {
      rightDom = interpretPredicateExpr(e.args[1], paramId);
    }
    if (!leftDom || !rightDom) return null;
    return intersectDomains(leftDom, rightDom);
  }

  // Comparison: one arg is the param, the other is a literal Int.
  const cmp = recogniseComparison(fn.name, e.args, paramId);
  if (cmp) return cmp;

  return null;
}

/** Extract a comparison `param OP literal` (or reversed) if applicable. */
function recogniseComparison(
  primName: string,
  args: Value[],
  paramId: unknown,
): AbstractDomain | null {
  if (args.length !== 2) return null;

  // Determine which arg is the param and which is the literal.
  const leftIsParam  = isParam(args[0], paramId);
  const rightIsParam = isParam(args[1], paramId);
  if (leftIsParam === rightIsParam) return null;   // both or neither — can't tell

  const paramArg   = leftIsParam ? args[0] : args[1];
  const literalArg = leftIsParam ? args[1] : args[0];
  const k = asIntLiteral(literalArg);
  if (k === null) return null;

  // Normalise operator to the "param OP k" form.
  let op = primName;
  if (rightIsParam) {
    // Swap: `k OP param` == `param (swapped) k`.
    op = swapComparison(op);
  }
  void paramArg;

  switch (op) {
    case "bits_eq":   case "typed_eq":  return { kind: "eq", value: k };
    case "bits_neq":  case "typed_neq": return { kind: "ne", value: k };
    case "bits_gt":   case "typed_gt":  return { kind: "interval", lo: k + 1,     hi: +Infinity };
    case "bits_gte":  case "typed_gte": return { kind: "interval", lo: k,         hi: +Infinity };
    case "bits_lt":   case "typed_lt":  return { kind: "interval", lo: -Infinity, hi: k - 1     };
    case "bits_lte":  case "typed_lte": return { kind: "interval", lo: -Infinity, hi: k         };
  }
  return null;
}

function isParam(v: Value, paramId: unknown): boolean {
  const p = dataOf(v);
  return p.kind === ValueKind.Param && (p as any) === paramId;
}

function asIntLiteral(v: Value): number | null {
  const p = dataOf(v);
  if (p.kind !== ValueKind.Bits) return null;
  const b = p as BitsValue;
  if (b.length !== 64) return null;
  const data = b.data;
  if (typeof data === "bigint") {
    // Int represented as 64-bit bigint, but we also need to handle signed
    // two's-complement conversion.
    const asSigned = data >= 0x8000000000000000n ? data - 0x10000000000000000n : data;
    const n = Number(asSigned);
    if (!Number.isSafeInteger(n)) return null;
    return n;
  }
  if (typeof data === "number" && Number.isSafeInteger(data)) return data;
  return null;
}

function swapComparison(op: string): string {
  switch (op) {
    case "bits_gt":   return "bits_lt";
    case "bits_gte":  return "bits_lte";
    case "bits_lt":   return "bits_gt";
    case "bits_lte":  return "bits_gte";
    case "typed_gt":  return "typed_lt";
    case "typed_gte": return "typed_lte";
    case "typed_lt":  return "typed_gt";
    case "typed_lte": return "typed_gte";
    default:          return op;
  }
}

// =============================================================================
// Lattice operations
// =============================================================================

/** Tightest domain implied by both inputs (conjunction). */
export function intersectDomains(a: AbstractDomain, b: AbstractDomain): AbstractDomain {
  // Effects: intersection of label sets. Mixed-kind operands fall through
  // to opaque — there's no useful intersection between a numeric refinement
  // and an effect bound; they describe orthogonal concerns and should never
  // be combined into a single domain.
  if (a.kind === "effects" && b.kind === "effects") {
    const labels = new Set<string>();
    for (const l of a.labels) if (b.labels.has(l)) labels.add(l);
    return { kind: "effects", labels };
  }
  if (a.kind === "effects" || b.kind === "effects") {
    return { kind: "opaque", predicate: makeInt(0) };
  }
  const ai = toInterval(a);
  const bi = toInterval(b);
  if (ai && bi) {
    return canonical({ kind: "interval", lo: Math.max(ai.lo, bi.lo), hi: Math.min(ai.hi, bi.hi) });
  }
  // Fall back to opaque conjunction — propagation loses algebraic detail.
  return { kind: "opaque", predicate: (a as any).predicate ?? (b as any).predicate ?? makeInt(0) };
}

/** Loosest domain containing both inputs (disjunction / least upper bound).
 *  Used when a value could come from either of two paths. */
export function joinDomains(a: AbstractDomain, b: AbstractDomain): AbstractDomain {
  if (a.kind === "effects" && b.kind === "effects") {
    const labels = new Set<string>(a.labels);
    for (const l of b.labels) labels.add(l);
    return { kind: "effects", labels };
  }
  if (a.kind === "effects" || b.kind === "effects") {
    return { kind: "opaque", predicate: makeInt(0) };
  }
  const ai = toInterval(a);
  const bi = toInterval(b);
  if (ai && bi) {
    return canonical({ kind: "interval", lo: Math.min(ai.lo, bi.lo), hi: Math.max(ai.hi, bi.hi) });
  }
  return { kind: "opaque", predicate: (a as any).predicate ?? (b as any).predicate ?? makeInt(0) };
}

/** Render a domain into interval form when possible. `eq k` → `[k, k]`; `ne k`
 *  cannot be rendered as an interval (needs a union of two). */
function toInterval(d: AbstractDomain): IntervalDomain | null {
  if (d.kind === "interval") return d;
  if (d.kind === "eq")       return { kind: "interval", lo: d.value, hi: d.value };
  return null;
}

function canonical(d: IntervalDomain): AbstractDomain {
  if (d.lo > d.hi) {
    // Empty interval — no integer satisfies. Encode as a degenerate eq on a
    // value chosen so downstream comparison fails clearly.
    return { kind: "opaque", predicate: makeInt(0) };
  }
  if (d.lo === d.hi) return { kind: "eq", value: d.lo };
  return d;
}

// =============================================================================
// Propagation rules
// =============================================================================

/** Domain of `a + b` from domains of `a` and `b`. */
export function propagateAdd(a: AbstractDomain, b: AbstractDomain): AbstractDomain {
  const ai = toInterval(a); const bi = toInterval(b);
  if (!ai || !bi) return { kind: "opaque", predicate: makeInt(0) };
  return canonical({ kind: "interval", lo: ai.lo + bi.lo, hi: ai.hi + bi.hi });
}

/** Domain of `a - b`. */
export function propagateSub(a: AbstractDomain, b: AbstractDomain): AbstractDomain {
  const ai = toInterval(a); const bi = toInterval(b);
  if (!ai || !bi) return { kind: "opaque", predicate: makeInt(0) };
  return canonical({ kind: "interval", lo: ai.lo - bi.hi, hi: ai.hi - bi.lo });
}

/** Domain of `a * b`. For intervals [a,b] * [c,d], the extremes are at the
 *  four products ac, ad, bc, bd; result is [min, max] of those. Handles
 *  sign-dependent behaviour naturally via the min/max. */
export function propagateMul(a: AbstractDomain, b: AbstractDomain): AbstractDomain {
  const ai = toInterval(a); const bi = toInterval(b);
  if (!ai || !bi) return { kind: "opaque", predicate: makeInt(0) };
  const products = [ai.lo * bi.lo, ai.lo * bi.hi, ai.hi * bi.lo, ai.hi * bi.hi]
    .filter(v => !Number.isNaN(v));
  return canonical({ kind: "interval", lo: Math.min(...products), hi: Math.max(...products) });
}

/** Negation. */
export function propagateNeg(a: AbstractDomain): AbstractDomain {
  const ai = toInterval(a);
  if (!ai) return { kind: "opaque", predicate: makeInt(0) };
  return canonical({ kind: "interval", lo: -ai.hi, hi: -ai.lo });
}

/** Does domain `a` imply domain `b`? (i.e., every value satisfying `a` also
 *  satisfies `b`.) Used for subtyping on refinements. */
export function impliesDomain(a: AbstractDomain, b: AbstractDomain): boolean {
  if (b.kind === "opaque") return false;    // can't verify an opaque predicate
  // Effects: a implies b iff a.labels ⊆ b.labels — same predicate-implication
  // semantics as numerics ("every value satisfying a also satisfies b"). For
  // effects-as-bounds: an actual effect set fits inside a wider allowed bound.
  // The user-facing capability operator (`effectImplies` in types-std.ts) has
  // the opposite orientation — that's a deliberately different helper for the
  // value-side `Effect.implies` method.
  if (a.kind === "effects" && b.kind === "effects") {
    for (const l of a.labels) if (!b.labels.has(l)) return false;
    return true;
  }
  if (a.kind === "effects" || b.kind === "effects") return false;
  const ai = toInterval(a);
  const bi = toInterval(b);
  if (ai && bi) {
    return ai.lo >= bi.lo && ai.hi <= bi.hi;
  }
  if (a.kind === "eq" && b.kind === "ne")  return a.value !== b.value;
  if (a.kind === "ne" && b.kind === "ne")  return a.value === b.value;
  return false;
}

// =============================================================================
// Counterexample generation
// =============================================================================

/** Try to produce a concrete value (as a plain number) that satisfies `actual`
 *  but violates `expected`. Used when a type-check or call-site refinement
 *  can't be discharged and we want to show the user a concrete break. */
export function counterexampleFor(
  actual:   AbstractDomain,
  expected: AbstractDomain,
): number | null {
  const ai = toInterval(actual);
  const bi = toInterval(expected);
  if (!ai || !bi) return null;
  // Try boundary values of `actual` that fall outside `expected`.
  const candidates = [ai.lo, ai.hi, 0, 1, -1];
  for (const v of candidates) {
    if (v < ai.lo || v > ai.hi) continue;          // outside actual
    if (v < bi.lo || v > bi.hi) return v;          // outside expected → CEX
  }
  return null;
}

// =============================================================================
// Predicate sets (Phase C)
// =============================================================================
//
// A `Predicate` is one fact about a value. Phase B attached at most one
// AbstractDomain per value; Phase C attaches a *set* — every fact accumulated
// from refinement types, asserts, branch conditions, contract clauses, and
// arithmetic propagation. The set is the substrate the AI prover (Phase H)
// will reason over.
//
// Each Predicate carries:
//   - `shape`:        the recognised algebraic form (interval / eq / ne /
//                     opaque). Same union as AbstractDomain.
//   - `source`:       a tag describing where this predicate originated, used
//                     for introspection rendering and debugging.
//   - `originalExpr`: the raw predicate Value, retained for runtime check
//                     when shape is opaque.
//
// PredicateSets stay small in practice (typical: 1–3 predicates per binding,
// growing slightly through branches and asserts). Lookup is linear; the
// wrapper type lets us swap the backing implementation without touching
// callers.

export type PredicateSource =
  | "refinement-type"   // from a refined type's constructor
  | "type-invariant"    // reserved — invariants folded into refinements (C6.1b); no current producer
  | "assert"            // from an `assert P` statement — Chunk 2
  | "branch-then"       // from entering an if-then branch — Chunk 2
  | "branch-else"       // from entering an if-else branch — Chunk 2
  | "match-case"        // from matching a when/is/then case — Chunk 2
  | "requires"          // from a function's requires clause — Chunk 3
  | "ensures"           // from a function's ensures clause — Chunk 3
  | "propagation"       // derived by arithmetic propagation
  | "literal"           // from a literal value's known constant
  | "effects-declared"  // from an `effects` body-form clause — D1 sub-chunk 1.2
  | "effects-inferred"  // from bottom-up effect inference — D1 sub-chunk 1.2
  | "effects-bound"     // bound declared on a parameter (`f: pure`) — Slice 2 Stage A/B
  ;

export interface Predicate {
  shape:         AbstractDomain;
  source?:       PredicateSource;
  /** Retained for opaque shapes so runtime checks still have the predicate
   *  function available. Most callers should use `shape` for reasoning. */
  originalExpr?: Value;
}

/** A set of predicates about a single value. Order is insertion order. */
export class PredicateSet {
  readonly preds: Predicate[];

  constructor(preds: Predicate[] = []) {
    this.preds = preds;
  }

  get size(): number { return this.preds.length; }
  get isEmpty(): boolean { return this.preds.length === 0; }

  /** Iterator support so callers can `for (const p of set)`. */
  [Symbol.iterator](): Iterator<Predicate> { return this.preds[Symbol.iterator](); }

  /** Effective single domain: intersect all non-opaque numeric predicates so
   *  callers that need a single domain (legacy `domainOf` callers) get the
   *  tightest algebraic fact available. Effects predicates are excluded —
   *  they describe an orthogonal axis and have their own accessor below.
   *  Returns the first non-numeric predicate's domain if no algebraic facts
   *  exist. */
  effectiveDomain(): AbstractDomain | null {
    if (this.preds.length === 0) return null;
    let result: AbstractDomain | null = null;
    for (const p of this.preds) {
      if (p.shape.kind === "opaque" || p.shape.kind === "effects") continue;
      if (result === null) result = p.shape;
      else result = intersectDomains(result, p.shape);
    }
    if (result) return result;
    // Fall back to first non-effects predicate's shape, then to anything.
    for (const p of this.preds) if (p.shape.kind !== "effects") return p.shape;
    return this.preds[0].shape;
  }

  /** Effective effects domain: union of all effects-source predicates. The
   *  declared bound is propagated as-is (it's a constraint), the inferred
   *  set is propagated as-is. Callers asking "what effects does this binding
   *  report" get one combined view. Returns null when no effects predicates
   *  are present. */
  effectiveEffects(): EffectsDomain | null {
    let result: EffectsDomain | null = null;
    for (const p of this.preds) {
      if (p.shape.kind !== "effects") continue;
      if (result === null) result = { kind: "effects", labels: new Set(p.shape.labels) };
      else for (const l of p.shape.labels) result.labels.add(l);
    }
    return result;
  }
}

/** Construct a Predicate from a domain + optional source. */
export function makePredicate(shape: AbstractDomain, source?: PredicateSource, originalExpr?: Value): Predicate {
  return { shape, source, originalExpr };
}

/** Add a predicate to a set, with structural-equality dedup. Returns a new
 *  set; never mutates the input. */
export function addPredicate(set: PredicateSet, p: Predicate): PredicateSet {
  for (const existing of set.preds) {
    if (predicatesEqual(existing, p)) return set;
  }
  return new PredicateSet([...set.preds, p]);
}

/** Merge two predicate sets via set union with dedup. Used at branch
 *  rejoins; in Phase C we use simple concat-and-dedup, with a smarter
 *  intersection-style merge as a later optimisation. */
export function mergePredicateSets(a: PredicateSet, b: PredicateSet): PredicateSet {
  let result = a;
  for (const p of b.preds) result = addPredicate(result, p);
  return result;
}

/** Trivial Horn-clause-like simplification: fold redundant facts implied by
 *  tighter ones; combine `_ > k1` and `_ < k2` into a single interval. No
 *  deeper reasoning — the AI prover handles harder cases at proof-search
 *  time, not online during evaluation. */
export function simplifyPredicateSet(set: PredicateSet): PredicateSet {
  if (set.size <= 1) return set;
  // Phase C MVP: combine any non-opaque predicates into a single tightest
  // interval (when all involved domains are intervals or eq); leave opaque
  // ones as-is. Future: smarter Horn-clause merging.
  const opaques: Predicate[] = [];
  let combined: AbstractDomain | null = null;
  for (const p of set.preds) {
    if (p.shape.kind === "opaque") {
      opaques.push(p);
    } else if (combined === null) {
      combined = p.shape;
    } else {
      combined = intersectDomains(combined, p.shape);
    }
  }
  const out: Predicate[] = [];
  if (combined !== null) {
    out.push({ shape: combined, source: "propagation" });
  }
  out.push(...opaques);
  return new PredicateSet(out);
}

/** Does the set entail the target predicate? Linear scan against each
 *  predicate's shape; opaque predicates can never entail a non-opaque
 *  target. Used for compile-time discharge of asserts / requires / type
 *  checks. */
export function entailsPredicate(set: PredicateSet, target: AbstractDomain): boolean {
  if (target.kind === "opaque") return false;
  // Effective tightest domain may entail more than any single predicate.
  const eff = set.effectiveDomain();
  if (eff && eff.kind !== "opaque" && impliesDomain(eff, target)) return true;
  // Fallback: scan individual predicates.
  for (const p of set.preds) {
    if (p.shape.kind !== "opaque" && impliesDomain(p.shape, target)) return true;
  }
  return false;
}

/** Structural equality on predicates (for dedup). Equal shape + equal source
 *  + reference equality on originalExpr (since we don't deep-compare Values). */
function predicatesEqual(a: Predicate, b: Predicate): boolean {
  if (!domainsStructurallyEqual(a.shape, b.shape)) return false;
  if (a.source !== b.source) return false;
  if (a.originalExpr !== b.originalExpr) return false;
  return true;
}

function domainsStructurallyEqual(a: AbstractDomain, b: AbstractDomain): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "interval": return a.lo === (b as IntervalDomain).lo && a.hi === (b as IntervalDomain).hi;
    case "eq":       return a.value === (b as EqualDomain).value;
    case "ne":       return a.value === (b as NotEqualDomain).value;
    case "opaque":   return a.predicate === (b as OpaqueDomain).predicate;
    case "effects": {
      const bl = (b as EffectsDomain).labels;
      if (a.labels.size !== bl.size) return false;
      for (const l of a.labels) if (!bl.has(l)) return false;
      return true;
    }
  }
}

// =============================================================================
// Value-level helpers — attach / read the "domain" component on a MultiValue
// =============================================================================

const DOMAIN_COMPONENT_KEY = "domain";
const PREDICATES_COMPONENT_KEY = "predicates";

/** Attach an abstract domain as a MultiValue component. Wraps if needed. */
export function withDomain(v: Value, domain: AbstractDomain): Value {
  const comps = cloneComponents(v);
  comps.set(DOMAIN_COMPONENT_KEY, encodeDomain(domain));
  return makeMultiValue(dataOf(v), comps);
}

/** Read an abstract domain off a value, if one is present. With Phase C's
 *  predicate sets active, this returns the set's effective tightest domain
 *  for backward compatibility — preferring the new `predicates` component
 *  over the legacy single-domain one. */
export function domainOf(v: Value): AbstractDomain | null {
  // C4.3b: componentsView is total — flattened Contexts answer directly.
  // Phase C: prefer the predicate set if present.
  const setComp = componentsView(v).get(PREDICATES_COMPONENT_KEY);
  if (setComp) {
    const set = decodePredicates(setComp);
    if (set) {
      const eff = set.effectiveDomain();
      if (eff) return eff;
    }
  }
  const c = componentsView(v).get(DOMAIN_COMPONENT_KEY);
  if (!c) return null;
  return decodeDomain(c);
}

/** Attach a predicate set as a MultiValue component. Always merges with any
 *  existing set; never overwrites silently. */
export function withPredicates(v: Value, set: PredicateSet): Value {
  const comps = cloneComponents(v);
  // Merge with any existing predicate set.
  const prior = predicatesOf(v);
  const merged = prior ? mergePredicateSets(prior, set) : set;
  comps.set(PREDICATES_COMPONENT_KEY, encodePredicates(merged));
  return makeMultiValue(dataOf(v), comps);
}

/** Read a value's predicate set, if any. Returns a fresh PredicateSet —
 *  callers can mutate the returned object freely (it's not shared with the
 *  value's stored encoding). */
export function predicatesOf(v: Value): PredicateSet | null {
  // C4.3b: componentsView is total — flattened Contexts answer directly.
  const setComp = componentsView(v).get(PREDICATES_COMPONENT_KEY);
  if (setComp) {
    const set = decodePredicates(setComp);
    if (set) return set;
  }
  // Legacy fallback: lift a single-domain `domain` component into a
  // singleton set so old code paths continue to work during the migration.
  const dc = componentsView(v).get(DOMAIN_COMPONENT_KEY);
  if (dc) {
    const dom = decodeDomain(dc);
    if (dom) return new PredicateSet([{ shape: dom, source: "refinement-type" }]);
  }
  return null;
}

function encodePredicates(set: PredicateSet): Value {
  const ctx: ContextValue = makeContext();
  (ctx as any).__predicateSet = set;
  return ctx;
}

function decodePredicates(v: Value): PredicateSet | null {
  if (v.kind !== ValueKind.Context) return null;
  return (v as any).__predicateSet ?? null;
}

// =============================================================================
// Knowledge carrier (C3.1, D36)
//
// KNOWLEDGE is everything established ABOUT a value — the imputed
// refinement bound, abstract domains, and predicates — unified into one
// monotonic lattice, excluded from value identity and dispatch. This is
// the INTRINSIC carrier (certified at construction, rides the value across
// scope boundaries); the OCCURRENCE carrier is the scope facts plane
// (C2.2 `scopeAssume`/`scopeFactsFor`). C3.2 combines the two by meet.
//
// Computed view over the current storage: the refinement layers of the
// stored `type` component (walked off by `typeShape`) + the on-value
// `predicates`/`domain` components. The physical storage moves under the
// `knowledge` channel at the C4 representation swap.
// =============================================================================

export interface Knowledge {
  /** The imputed refinement bound — the stored type when it carries
   *  member-transparent refinement layers (the construction certificate:
   *  `PositiveInt` on a `PositiveInt(5)`). Null when the stored type IS
   *  the dispatch shape. */
  bound: ContextValue | null;
  /** The on-value predicate set (Phase C), if any. */
  predicates: PredicateSet | null;
  /** C3.2: the occurrence bound set by crossing an annotation boundary
   *  (`x: Animal` receiving a Dog). An UPPER bound on what this occurrence
   *  may assume — member AVAILABILITY follows it; dispatch does not. Null
   *  when no annotation boundary constrained this occurrence. */
  occurrenceBound: ContextValue | null;
}

// C3.2: the occurrence-bound component. Set when a value crosses an
// annotation boundary whose declared type is WIDER than the value's shape;
// cleared when a boundary of the value's own shape is crossed (the new
// occurrence starts with full knowledge) or when a `when … is T` type
// pattern narrows. Propagation rule is `drop` — a bound constrains the
// occurrence it was stamped on, never derived results.
const BOUND_COMPONENT_KEY = "bound";

/** Read the occurrence bound riding a value, if any. */
export function occurrenceBoundOf(v: Value): ContextValue | null {
  // C4.3b: componentsView is total — flattened Contexts answer directly.
  const b = componentsView(v).get(BOUND_COMPONENT_KEY);
  return b?.kind === ValueKind.Context ? (b as ContextValue) : null;
}

/** Stamp an occurrence bound (annotation-boundary crossing). */
export function withOccurrenceBound(v: Value, bound: ContextValue): Value {
  const comps = cloneComponents(v);
  comps.set(BOUND_COMPONENT_KEY, bound);
  return makeMultiValue(dataOf(v), comps);
}

/** Remove the occurrence bound (narrowing / same-shape boundary reset). */
export function clearOccurrenceBound(v: Value): Value {
  if (occurrenceBoundOf(v) === null) return v;
  const comps = cloneComponents(v);
  comps.delete(BOUND_COMPONENT_KEY);
  return makeMultiValue(dataOf(v), comps);
}

/** The intrinsic knowledge riding a value, or null when it carries none. */
export function knowledgeOf(v: Value): Knowledge | null {
  const stored = channelReadRaw(v, "type");
  let bound: ContextValue | null = null;
  if (stored?.kind === ValueKind.Context) {
    const shape = typeShape(stored as ContextValue);
    if (shape !== stored) bound = stored as ContextValue;
  }
  const predicates = predicatesOf(v);
  const occurrenceBound = occurrenceBoundOf(v);
  if (!bound && !predicates && !occurrenceBound) return null;
  return { bound, predicates, occurrenceBound };
}

/** The tightest single abstract domain the knowledge implies — the meet
 *  of the intrinsic bound's domain, the occurrence bound's domain, and
 *  the predicate set's effective domain. */
export function knowledgeDomain(k: Knowledge): AbstractDomain | null {
  const parts: AbstractDomain[] = [];
  const boundDom = (k.bound ? getAbstractDomain(k.bound) : null) as AbstractDomain | null;
  if (boundDom) parts.push(boundDom);
  const occDom = (k.occurrenceBound ? getAbstractDomain(k.occurrenceBound) : null) as AbstractDomain | null;
  if (occDom) parts.push(occDom);
  const predDom = k.predicates?.effectiveDomain() ?? null;
  if (predDom) parts.push(predDom);
  if (parts.length === 0) return null;
  return parts.reduce((acc, d) => intersectDomains(acc, d));
}

/** Meet on the knowledge lattice — facts accumulate, never widen. Both
 *  carriers share this op (intrinsic here; occurrence facts merge through
 *  the same `mergePredicateSets` in `scopeFactsFor`). Intrinsic facts
 *  survive a looser occurrence bound: the meet keeps certificates and
 *  predicates regardless of how wide the annotation is. */
export function meetKnowledge(a: Knowledge, b: Knowledge): Knowledge {
  const predicates = a.predicates && b.predicates
    ? mergePredicateSets(a.predicates, b.predicates)
    : (a.predicates ?? b.predicates);
  // Bound meet: when both carry a domain, keep the tighter bound; the
  // domain-level meet is always available via knowledgeDomain.
  let bound = a.bound ?? b.bound;
  if (a.bound && b.bound) {
    const da = getAbstractDomain(a.bound) as AbstractDomain | undefined;
    const db = getAbstractDomain(b.bound) as AbstractDomain | undefined;
    if (da && db && impliesDomain(db, da)) bound = b.bound;
  }
  const occurrenceBound = a.occurrenceBound ?? b.occurrenceBound;
  return { bound, predicates, occurrenceBound };
}

/** Encode a domain into a Value so it can live as a component. We stash it
 *  on a Context with a hidden `__abstractDomain` field — cheap, opaque to the
 *  evaluator, decoded by the refinement helpers. */
function encodeDomain(d: AbstractDomain): Value {
  const ctx: ContextValue = makeContext();
  (ctx as any).__abstractDomain = d;
  return ctx;
}

function decodeDomain(v: Value): AbstractDomain | null {
  if (v.kind !== ValueKind.Context) return null;
  return (v as any).__abstractDomain ?? null;
}

// =============================================================================
// Primitive → propagation mapping
// =============================================================================

/** Given a primitive name and its argument values, compute the output domain
 *  if the arguments carry compatible domains. Returns null if no propagation
 *  applies.
 *
 *  Propagation fires only when at least one argument carries an explicit
 *  abstract domain (i.e. came through a refined type). Pure-literal
 *  arithmetic (`1 + 2`) doesn't trigger domain attachment, so untyped
 *  Allegretto programs and unrefined Standard code see no change in
 *  result shape — avoids wrapping raw Bits in MultiValues where callers
 *  don't expect it. */
export function propagateForPrimitive(
  primName: string,
  args: Value[],
): AbstractDomain | null {
  if (args.length === 2 && args.every(isResolved)) {
    const ea = domainOf(args[0]);
    const eb = domainOf(args[1]);
    if (!ea && !eb) return null;    // no refinement involved
    const da = ea ?? domainOrFromValue(args[0]);
    const db = eb ?? domainOrFromValue(args[1]);
    if (!da || !db) return null;
    switch (primName) {
      case "bits_add": return propagateAdd(da, db);
      case "bits_sub": return propagateSub(da, db);
      case "bits_mul": return propagateMul(da, db);
    }
  }
  return null;
}

/** Read a domain from a value OR derive it from a concrete literal.
 *  Exported for Phase F2 (`proof_refines`) — the proof constructor needs a
 *  value's effective domain whether it came from a refinement, a predicate
 *  set, arithmetic propagation, or is just a bare integer literal. */
export function domainOrFromValue(v: Value): AbstractDomain | null {
  const dom = domainOf(v);
  if (dom) return dom;
  const lit = asIntLiteral(v);
  if (lit !== null) return { kind: "eq", value: lit };
  return null;
}

/**
 * Phase C: predicate-set-aware propagation. Computes the result's predicate
 * set from the operands' sets. Returns a singleton set with one propagated
 * predicate when applicable; null when no propagation rule matches or
 * neither operand carries refinement information.
 *
 * The returned set carries a `propagation`-sourced predicate so introspection
 * can distinguish derived facts from explicit ones.
 */
export function propagateSetForPrimitive(
  primName: string,
  args: Value[],
): PredicateSet | null {
  const dom = propagateForPrimitive(primName, args);
  if (!dom) return null;
  return new PredicateSet([{ shape: dom, source: "propagation" }]);
}

// =============================================================================
// Branch-condition narrowing (Phase C Chunk 2)
// =============================================================================

/**
 * Given a condition expression and a polarity (true: condition was true;
 * false: condition was false), derive a per-name map of predicates implied
 * about each binding referenced in the expression.
 *
 * Recognises:
 *   x op k       — x's domain narrows by op (negated under polarity=false)
 *   k op x       — same with reversed op
 *   left && rt   — splits, recurses on each side, unions the results
 *
 * Anything else: empty map. Conservative — we never claim a fact we can't
 * pattern-match. The condition still runs at runtime as before; we only add
 * predicates we can prove from its structure.
 */
export function deriveBranchPredicates(
  condExpr: Value,
  polarity: boolean,
  source: PredicateSource,
): Map<string, PredicateSet> {
  const out = new Map<string, PredicateSet>();
  collectNarrowing(condExpr, polarity, source, out);
  return out;
}

function collectNarrowing(
  expr: Value,
  polarity: boolean,
  source: PredicateSource,
  out: Map<string, PredicateSet>,
): void {
  const e = dataOf(expr);
  if (e.kind !== ValueKind.Expression) return;
  const fn = dataOf(e.fn);
  if (fn.kind !== ValueKind.PrimitiveFunction) return;

  // Conjunction — `cond1 && cond2`.
  // Allegro `&&` compiles to `typed_and(left, thunk(right))`. The right side
  // is a zero-arg ComposedFunction; its body is the actual right expression.
  if (fn.name === "typed_and" && polarity === true) {
    if (e.args.length !== 2) return;
    collectNarrowing(e.args[0], true, source, out);
    const rightArg = dataOf(e.args[1]);
    if (rightArg.kind === ValueKind.ComposedFunction && rightArg.params.length === 0) {
      collectNarrowing(rightArg.body, true, source, out);
    } else {
      collectNarrowing(e.args[1], true, source, out);
    }
    return;
  }

  // Comparison — find which side is a Symbol and which is a literal.
  if (e.args.length !== 2) return;
  const left = dataOf(e.args[0]);
  const right = dataOf(e.args[1]);
  let symbolArg: Value | null = null;
  let literalArg: Value | null = null;
  let opOrder: "sym-lit" | "lit-sym" | null = null;
  if (left.kind === ValueKind.Symbol) {
    symbolArg = e.args[0];
    literalArg = e.args[1];
    opOrder = "sym-lit";
  } else if (right.kind === ValueKind.Symbol) {
    symbolArg = e.args[1];
    literalArg = e.args[0];
    opOrder = "lit-sym";
  }
  if (!symbolArg || !literalArg || !opOrder) return;
  const k = asIntLiteral(literalArg);
  if (k === null) return;

  // Normalise to "symbol OP k" form, swapping op if literal was on the left.
  let op = fn.name;
  if (opOrder === "lit-sym") op = swapComparison(op);
  // Negate under polarity=false.
  if (!polarity) op = negateComparison(op);

  let dom: AbstractDomain | null = null;
  switch (op) {
    case "bits_gt":   case "typed_gt":  dom = { kind: "interval", lo: k + 1,     hi: +Infinity }; break;
    case "bits_gte":  case "typed_gte": dom = { kind: "interval", lo: k,         hi: +Infinity }; break;
    case "bits_lt":   case "typed_lt":  dom = { kind: "interval", lo: -Infinity, hi: k - 1     }; break;
    case "bits_lte":  case "typed_lte": dom = { kind: "interval", lo: -Infinity, hi: k         }; break;
    case "bits_eq":   case "typed_eq":  dom = { kind: "eq", value: k }; break;
    case "bits_neq":  case "typed_neq": dom = { kind: "ne", value: k }; break;
  }
  if (!dom) return;

  const symPrim = dataOf(symbolArg);
  if (symPrim.kind !== ValueKind.Symbol) return;
  const name = symPrim.name;

  const existing = out.get(name);
  const fresh = new PredicateSet([{ shape: dom, source }]);
  out.set(name, existing ? mergePredicateSets(existing, fresh) : fresh);
}

function negateComparison(op: string): string {
  switch (op) {
    case "bits_gt":   return "bits_lte";
    case "bits_gte":  return "bits_lt";
    case "bits_lt":   return "bits_gte";
    case "bits_lte":  return "bits_gt";
    case "bits_eq":   return "bits_neq";
    case "bits_neq":  return "bits_eq";
    case "typed_gt":  return "typed_lte";
    case "typed_gte": return "typed_lt";
    case "typed_lt":  return "typed_gte";
    case "typed_lte": return "typed_gt";
    case "typed_eq":  return "typed_neq";
    case "typed_neq": return "typed_eq";
    default: return op;
  }
}
