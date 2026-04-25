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

import {
  Value, ValueKind, primaryOf, BitsValue, ContextValue,
  makeMultiValue, makeInt, isResolved,
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

export type AbstractDomain = IntervalDomain | NotEqualDomain | EqualDomain | OpaqueDomain;

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
  const p = primaryOf(predicate);
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
  const e = primaryOf(expr);
  if (e.kind !== ValueKind.Expression) return null;
  const fn = primaryOf(e.fn);
  if (fn.kind !== ValueKind.PrimitiveFunction) return null;

  // Conjunction — combine the two sides.
  //
  // Allegro's `&&` compiles to `typed_and(left, thunk(right))`. Thunk is a
  // zero-param ComposedFunction; its body is the actual right expression.
  if (fn.name === "typed_and") {
    if (e.args.length !== 2) return null;
    const leftDom  = interpretPredicateExpr(e.args[0], paramId);
    const rightArg = primaryOf(e.args[1]);
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
    case "bits_eq":  return { kind: "eq", value: k };
    case "bits_neq": return { kind: "ne", value: k };
    case "bits_gt":  return { kind: "interval", lo: k + 1,     hi: +Infinity };
    case "bits_gte": return { kind: "interval", lo: k,         hi: +Infinity };
    case "bits_lt":  return { kind: "interval", lo: -Infinity, hi: k - 1     };
    case "bits_lte": return { kind: "interval", lo: -Infinity, hi: k         };
  }
  return null;
}

function isParam(v: Value, paramId: unknown): boolean {
  const p = primaryOf(v);
  return p.kind === ValueKind.Param && (p as any) === paramId;
}

function asIntLiteral(v: Value): number | null {
  const p = primaryOf(v);
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
    case "bits_gt":  return "bits_lt";
    case "bits_gte": return "bits_lte";
    case "bits_lt":  return "bits_gt";
    case "bits_lte": return "bits_gte";
    default:         return op;
  }
}

// =============================================================================
// Lattice operations
// =============================================================================

/** Tightest domain implied by both inputs (conjunction). */
export function intersectDomains(a: AbstractDomain, b: AbstractDomain): AbstractDomain {
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
// Value-level helpers — attach / read the "domain" component on a MultiValue
// =============================================================================

const DOMAIN_COMPONENT_KEY = "domain";

/** Attach an abstract domain as a MultiValue component. Wraps if needed. */
export function withDomain(v: Value, domain: AbstractDomain): Value {
  const existing = v.kind === ValueKind.MultiValue ? v.components : new Map<string, Value>();
  const comps = new Map(existing);
  comps.set(DOMAIN_COMPONENT_KEY, encodeDomain(domain));
  return makeMultiValue(primaryOf(v), comps);
}

/** Read an abstract domain off a value, if one is present. */
export function domainOf(v: Value): AbstractDomain | null {
  if (v.kind !== ValueKind.MultiValue) return null;
  const c = v.components.get(DOMAIN_COMPONENT_KEY);
  if (!c) return null;
  return decodeDomain(c);
}

/** Encode a domain into a Value so it can live as a component. We stash it
 *  on a Context with a hidden `__abstractDomain` field — cheap, opaque to the
 *  evaluator, decoded by the refinement helpers. */
function encodeDomain(d: AbstractDomain): Value {
  const ctx: ContextValue = {
    kind: ValueKind.Context,
    bindings: new Map(),
    bindingList: [],
  };
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

/** Read a domain from a value OR derive it from a concrete literal. */
function domainOrFromValue(v: Value): AbstractDomain | null {
  const dom = domainOf(v);
  if (dom) return dom;
  const lit = asIntLiteral(v);
  if (lit !== null) return { kind: "eq", value: lit };
  return null;
}
