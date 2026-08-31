// =============================================================================
// Totality analysis (Phase E)
// =============================================================================
//
// Phase E proves — at compile time — that every function call terminates and
// produces a defined output for every input. Stage 0 (this file) is the
// substrate: helpers for the `partial` opt-out annotation. Stages 1-6 will
// add the actual exhaustiveness / termination / counterexample logic.
//
// Notification kinds reserved here are emitted from later stages; all default
// to `info` severity so adoption is non-breaking. Per-project config promotes
// them to `error` once a project's source is clean.

import { dataOf, metaReadRaw, getName } from "./slots.js";
import {
  Value, ValueKind, ComposedFunctionValue, ExpressionValue,
  StructureValue, BitsValue,
  bitsToString,
} from "./types.js";
import { getFunctionParamTypes } from "./types-std.js";

// --- Reserved notification kinds (consumed by Stage 1+) ---

/** Missing case in a `when/is/then` over a finite-domain scrutinee. */
export const NOTIF_TOTALITY_EXHAUSTIVENESS = "totality-exhaustiveness";

/** Recursive call that can't be shown to terminate. */
export const NOTIF_TOTALITY_NONTERMINATION = "totality-nontermination";

/** Function calls a partial dependency without itself being marked partial. */
export const NOTIF_TOTALITY_NEEDS_ANNOTATION = "totality-needs-annotation";

// --- Body-wrapper peelers ---
//
// Function bodies get layered with various passthrough wrappers at parse
// time: `type_check(…, returnType)` for typed-return functions, plus
// `partial_attach`, `decreases_attach`, `effects_attach`, etc. Each
// analyzer needs to find its specific wrapper, ignoring the others. The
// generic `findAttachWrapper` walks the head expression peeling unrelated
// decorators until it finds the named target.

// --- C1.5b: body-form metadata collapse -------------------------------------
//
// The five metadata wrappers (partial/decreases/effects/param_effects/
// proven `*_attach`) are a PARSE-TIME encoding only. `collapseBodyMetadata`
// runs once per evalSource pass (after symbol resolution, before tail-call
// marking): it peels the wrapper chain off every ComposedFunction body —
// descending through `type_check` layers — and stashes the metadata as
// host-internal properties on the function (registered in SLOT_REGISTRY):
//   partial, decreasesMetric, declaredEffectsAst,
//   paramEffectPairs, provenClauses
// Analyzers read the properties; the wrapper primitives remain registered
// as inert passthroughs for any uncollapsed path (defense in depth).
// `subst`/`remapParams` preserve the properties across clones.

const ATTACH_NAMES = new Set([
  "partial_attach", "decreases_attach", "effects_attach",
  "param_effects_attach", "proven_attach",
  // B-028 F3 (CE-R3): the completion-discharge clauses.
  "total_attach", "assume_terminates_attach",
]);

function collapseOneFunction(cfn: ComposedFunctionValue): void {
  let getCur: () => Value = () => cfn.body;
  let setCur: (v: Value) => void = (v) => { (cfn as any).body = v; };
  for (let guard = 0; guard < 24; guard++) {
    const cur = getCur();
    if (cur.kind !== ValueKind.Expression) return;
    const e = cur as ExpressionValue;
    const fn = dataOf(e.fn);
    if (fn.kind !== ValueKind.PrimitiveFunction) return;
    const name = (fn as any).name as string;
    if (name === "type_check") {
      if (e.args.length < 1 || e.args[0].kind !== ValueKind.Expression) return;
      getCur = () => e.args[0];
      setCur = (v) => { e.args[0] = v; };
      continue;
    }
    if (!ATTACH_NAMES.has(name)) return;
    switch (name) {
      case "partial_attach":       (cfn as any).partial = true; break;
      case "decreases_attach":     (cfn as any).decreasesMetric = e.args[1]; break;
      case "effects_attach":       (cfn as any).declaredEffectsAst = e.args[1]; break;
      case "param_effects_attach": (cfn as any).paramEffectPairs = e.args.slice(1); break;
      case "proven_attach":        (cfn as any).provenClauses = e.args.slice(1); break;
      // B-028 F3 (CE-R3): `total` = per-function strict opt-in (an
      // undischarged div on this function is an ERROR); `assume
      // terminates` = the D34 admitted tier (a declared liveness axiom
      // for the whole function — lifts div, verdict-visible).
      case "total_attach":             (cfn as any).total = true; break;
      case "assume_terminates_attach": (cfn as any).assumeTerminates = true; break;
    }
    setCur(e.args[0]);
  }
}

/** Recursively collapse body-form metadata on every ComposedFunction
 *  reachable from a binding value (top-level functions, typed_function
 *  envelopes, nested lambdas). Idempotent. */
export function collapseBodyMetadata(v: Value | undefined, seen: Set<Value> = new Set()): void {
  if (!v || typeof v !== "object" || seen.has(v)) return;
  seen.add(v);
  if (v.kind === ValueKind.ComposedFunction) {
    collapseOneFunction(v as ComposedFunctionValue);
    collapseBodyMetadata((v as ComposedFunctionValue).body, seen);
    return;
  }
  if (v.kind === ValueKind.Expression) {
    const e = v as ExpressionValue;
    collapseBodyMetadata(e.fn, seen);
    for (const a of e.args) collapseBodyMetadata(a, seen);
    return;
  }
}

export function isFunctionPartial(fn: ComposedFunctionValue): boolean {
  return (fn as any).partial === true;
}


// =============================================================================
// Stage 1 — Exhaustiveness check for `when/is/then`
// =============================================================================
//
// `when/is/then` desugars to nested `eval_when(subject, pattern, guard, thenFn,
// elseFn)` expressions; the final case's elseFn is a thunk wrapping the user's
// `else` expression OR a `when_no_match(subject)` sentinel when the source
// didn't supply one. Stage 1 walks every binding's body looking for these
// nested chains and reports cases where the case list plus the (possibly
// absent) else can't be shown to cover the scrutinee's static type.
//
// Confidence policy: emit a notification ONLY when we can prove the chain is
// non-exhaustive. When the subject's type is unknown or the patterns are
// opaque, stay silent (false-positives erode trust). Bool is the highest-
// signal case and is handled precisely; everything else relies on `is _` /
// `else` to discharge.
//
// Functions marked `partial` (via `lib/totality.alg`) are skipped entirely.

export interface ExhaustivenessFinding {
  binding: string;
  /** Source-readable description of what's missing. */
  message: string;
  /** Stage 6: concrete witness — a sample input that falls through, e.g.
   *  `\`f(false)\` is unmatched` for a missing Bool case. */
  counterexample?: string;
}

/** Resolution helpers used to look up named type references (`Bool`, `Int`, …)
 *  in the analyzer's surrounding evaluation context. The analyzer runs over
 *  source ASTs, so type references appear as Symbols and need to be resolved
 *  against the bindings layered into evalCtx. */
export type TypeLookup = (name: string) => Value | undefined;

/** Peel a binding's value to reach the underlying ComposedFunction plus its
 *  per-position parameter types. Handles three shapes:
 *    - Raw `ComposedFunction` (untyped function).
 *    - `typed_function(ComposedFunction(…), paramCount, paramType1…, returnType)`
 *      Expression (pre-evaluation AST).
 *    - `MultiValue(ComposedFunction, {type: FunctionType})` (post-evaluation,
 *      which is the common case once the binding has been touched).
 *  paramType values come back as the most precise form available — type
 *  Context for post-eval, Symbol/Expression for pre-eval (callers resolve via
 *  `TypeLookup`). */
function peelFunctionAst(v: Value): {
  cfn: ComposedFunctionValue;
  paramTypeAsts: Value[];
} | null {
  // Post-evaluation: a function value carrying a type.
  //
  // B-121 C2: this detected a CARRIER by reading `(v as any).primary` — a
  // direct data-plane access hidden behind an `any` cast, which is why the
  // boundary lint never saw it (recorded against B-104's ratchet). The
  // question is "a function value that carries a type", which `dataOf` and
  // `metaReadRaw` answer for any kind.
  {
    const tComp = metaReadRaw(v, "type") as Value | undefined;
    const prim = dataOf(v);
    if (prim.kind === ValueKind.ComposedFunction) {
      let paramTypeAsts: Value[] = [];
      if (tComp && tComp.kind === ValueKind.Structure) {
        const types = getFunctionParamTypes(tComp as StructureValue);
        if (types) paramTypeAsts = types;
      }
      return { cfn: prim as ComposedFunctionValue, paramTypeAsts };
    }
  }
  if (v.kind === ValueKind.ComposedFunction) {
    return { cfn: v as ComposedFunctionValue, paramTypeAsts: [] };
  }
  if (v.kind !== ValueKind.Expression) return null;
  const target = dataOf((v as ExpressionValue).fn);
  if (target.kind !== ValueKind.PrimitiveFunction) return null;
  if ((target as any).name !== "typed_function") return null;
  const args = (v as ExpressionValue).args;
  if (args.length < 3) return null;
  // args[0] = inner function (maybe nested typed_function), args[1] = paramCount,
  // args[2..2+paramCount-1] = paramTypes, last = returnType.
  const inner = peelFunctionAst(args[0]);
  if (!inner) return null;
  const paramCountP = dataOf(args[1]);
  let paramCount = 0;
  if (paramCountP.kind === ValueKind.Bits) {
    paramCount = Number((paramCountP as BitsValue).data);
  }
  const paramTypeAsts: Value[] = [];
  for (let i = 0; i < paramCount && (2 + i) < args.length - 1; i++) {
    paramTypeAsts.push(args[2 + i]);
  }
  return { cfn: inner.cfn, paramTypeAsts };
}


/** Walk every binding's function body and emit one finding per non-exhaustive
 *  `when/is/then` chain. `typeLookup` is consulted when a subject's static
 *  type is a Symbol reference like `Bool` — resolves to the corresponding
 *  type Context from the standard extension. */
export function checkExhaustiveness(
  bindings: Iterable<{ key: string | null; value: Value | undefined }>,
  typeLookup?: TypeLookup,
): ExhaustivenessFinding[] {
  const findings: ExhaustivenessFinding[] = [];

  for (const b of bindings) {
    if (!b.key || !b.value) continue;
    const peeled = peelFunctionAst(b.value);
    if (!peeled) continue;
    const { cfn, paramTypeAsts } = peeled;

    // Skip explicitly-partial functions.
    if (isFunctionPartial(cfn)) continue;

    walkForWhen(cfn.body, (subject, cases, hasExplicitElse) => {
      const r = analyzeChain(subject, cases, hasExplicitElse, cfn, paramTypeAsts, typeLookup);
      if (r) {
        const counterexample = r.missingLiteral !== undefined
          ? `\`${b.key}(${r.missingLiteral})\` is unmatched`
          : undefined;
        findings.push({ binding: b.key!, message: r.message, counterexample });
      }
    });
  }

  return findings;
}

/** A single case in a flattened `when` chain. */
interface ChainCase {
  pattern: Value;
}

/** Walk a value tree looking for top-level `eval_when` chains. For each one
 *  found, flatten the chain (recursing through the else-branch thunks) and
 *  invoke the visitor with the subject + case list + whether an explicit
 *  `else` (not `when_no_match`) caps the chain. */
function walkForWhen(
  v: Value,
  visit: (subject: Value, cases: ChainCase[], hasExplicitElse: boolean) => void,
  visited: Set<Value> = new Set(),
): void {
  if (!v || typeof v !== "object") return;
  if (visited.has(v)) return;
  visited.add(v);

  if (v.kind === ValueKind.Expression) {
    const fn = dataOf((v as ExpressionValue).fn);
    if (fn.kind === ValueKind.PrimitiveFunction && (fn as any).name === "eval_when") {
      // Top of a chain. Flatten by walking else-branch thunks.
      const subject = (v as ExpressionValue).args[0];
      const cases: ChainCase[] = [];
      let cur: Value = v;
      while (cur.kind === ValueKind.Expression) {
        const cfn = dataOf((cur as ExpressionValue).fn);
        if (cfn.kind !== ValueKind.PrimitiveFunction || (cfn as any).name !== "eval_when") break;
        const args = (cur as ExpressionValue).args;
        if (args.length < 5) break;
        cases.push({ pattern: args[1] });
        // elseFn is a zero-arg ComposedFunction whose body is the rest of the chain.
        const elseFn = dataOf(args[4]);
        if (elseFn.kind === ValueKind.ComposedFunction) {
          cur = (elseFn as ComposedFunctionValue).body;
        } else {
          break;
        }
      }
      // After unwinding, `cur` is either an Expression for `when_no_match(subj)`
      // or any other Expression (the user's `else` branch).
      const explicitElse = !isWhenNoMatch(cur);
      visit(subject, cases, explicitElse);
      // Continue walking the else branch and the then branches for nested
      // when chains. The then branches live inside arg 3 (thenFn body).
      cur = v;
      while (cur.kind === ValueKind.Expression) {
        const cfn = dataOf((cur as ExpressionValue).fn);
        if (cfn.kind !== ValueKind.PrimitiveFunction || (cfn as any).name !== "eval_when") break;
        const args = (cur as ExpressionValue).args;
        const thenFn = dataOf(args[3]);
        if (thenFn.kind === ValueKind.ComposedFunction) {
          walkForWhen((thenFn as ComposedFunctionValue).body, visit, visited);
        }
        const elseFn = dataOf(args[4]);
        if (elseFn.kind === ValueKind.ComposedFunction) {
          cur = (elseFn as ComposedFunctionValue).body;
        } else break;
      }
      return;
    }
    // Not a when at this node — descend into all subexpressions.
    walkForWhen((v as ExpressionValue).fn, visit, visited);
    for (const a of (v as ExpressionValue).args) walkForWhen(a, visit, visited);
    return;
  }
  if (v.kind === ValueKind.ComposedFunction) {
    walkForWhen((v as ComposedFunctionValue).body, visit, visited);
    return;
  }
}

function isWhenNoMatch(v: Value): boolean {
  if (v.kind !== ValueKind.Expression) return false;
  const fn = dataOf((v as ExpressionValue).fn);
  return fn.kind === ValueKind.PrimitiveFunction && (fn as any).name === "when_no_match";
}

/** Resolve a subject expression to its static type name, when known.
 *  Handles direct Param references against the function's signature and
 *  direct Symbol references against the type-lookup callback. */
function resolveSubjectTypeName(
  subject: Value,
  paramTypeAsts: Value[],
  typeLookup: TypeLookup | undefined,
): string | null {
  // B-121 C2: the kind guard here was doing TWO jobs — gating a metadata read
  // AND selecting a code path, because its branch ended in `return null` and
  // the Param branch below it was the alternative. Dropping it wholesale made
  // every Param subject return null and silently disabled exhaustiveness
  // checking (five totality tests). So the metadata question is asked for any
  // kind, and the branch now FALLS THROUGH instead of returning.
  const t = metaReadRaw(subject as Value, "type");
  if (t) return resolveTypeName(t, typeLookup);
  if (subject.kind === ValueKind.Param) {
    const pos = (subject as any).position as number;
    const pt = paramTypeAsts[pos];
    if (!pt) return null;
    return resolveTypeName(pt, typeLookup);
  }
  // Stage 1 minimum: only resolve via Param. Symbol-typed locals require
  // a cross-binding type map (deferred until needed).
  return null;
}

/** Resolve a type AST node to a concrete type name (e.g. "Bool", "Int"). */
function resolveTypeName(t: Value, typeLookup: TypeLookup | undefined): string | null {
  // Direct Context type values carry __name.
  if (t.kind === ValueKind.Structure) return typeContextName(t);
  // Symbol — look up against extensions (`Bool` etc.).
  if (t.kind === ValueKind.Symbol) {
    if (!typeLookup) return null;
    const resolved = typeLookup((t as any).name as string);
    if (!resolved) return null;
    return resolveTypeName(resolved, typeLookup);
  }
  return null;
}

/** Given a subject and its case-list, decide whether the chain is exhaustive
 *  enough to skip the notification. Returns a structured result describing
 *  the missing case(s) plus, when known, the specific literal value (for
 *  Stage 6 counterexample rendering). Returns null when no notification
 *  should fire. */
function analyzeChain(
  subject: Value,
  cases: ChainCase[],
  hasExplicitElse: boolean,
  _fn: ComposedFunctionValue,
  paramTypeAsts: Value[],
  typeLookup: TypeLookup | undefined,
): { message: string; missingLiteral?: string } | null {
  if (hasExplicitElse) return null;
  if (hasWildcardOrBinding(cases)) return null;

  const typeName = resolveSubjectTypeName(subject, paramTypeAsts, typeLookup);

  if (typeName === "Bool") {
    const literalValues = collectBoolLiterals(cases);
    if (literalValues.has(true) && literalValues.has(false)) return null;
    if (!literalValues.has(true) && !literalValues.has(false)) {
      return {
        message: `non-exhaustive \`when\` over Bool: missing both \`true\` and \`false\` cases (and no \`else\` branch)`,
        missingLiteral: "false", // either witnesses the gap; pick one
      };
    }
    const missing = literalValues.has(true) ? "false" : "true";
    return {
      message: `non-exhaustive \`when\` over Bool: missing \`${missing}\` case (and no \`else\` branch)`,
      missingLiteral: missing,
    };
  }

  // Other types: emit a generic note only when we can name the type AND no
  // pattern looks like a finite-domain cover. The unknown-type case stays
  // silent.
  if (typeName) {
    return {
      message: `non-exhaustive \`when\` over ${typeName}: no \`else\` branch and no wildcard \`is _\` case`,
    };
  }
  return null;
}

function typeContextName(t: Value): string | null {
  if (t.kind !== ValueKind.Structure) return null;
  const n = getName(t as StructureValue);
  if (!n) return null;
  const p = dataOf(n);
  if (p.kind !== ValueKind.Bits) return null;
  return bitsToString(p as BitsValue);
}

function hasWildcardOrBinding(cases: ChainCase[]): boolean {
  for (const c of cases) {
    const p = dataOf(c.pattern);
    // Wildcard marker: `when_wildcard()` expression.
    if (p.kind === ValueKind.Expression) {
      const fn = dataOf((p as ExpressionValue).fn);
      if (fn.kind === ValueKind.PrimitiveFunction && (fn as any).name === "when_wildcard") return true;
    }
    // Bind-to-name: pattern is a bare Symbol like `is n`. Matches anything.
    if (p.kind === ValueKind.Symbol) return true;
  }
  return false;
}

// =============================================================================
// Stage 2 — Structural termination check
// =============================================================================
//
// For each recursive function, look for evidence that the recursion strictly
// decreases on a well-founded order. The Stage 2 minimum recognises the
// common arithmetic pattern: a parameter `n` whose recursive-call argument is
// `n - K` for some literal K > 0, AND `n` has a refined type with a non-
// negative lower bound (so the strictly-decreasing chain is bounded below).
//
// Mutual recursion (call graph cycles through other bindings) is deferred to
// Stage 4. Higher-order recursion (via stdlib HOFs like map/reduce) is
// deferred to Stage 5. `decreases <expr>` body-form (user-supplied metrics)
// is Stage 3.
//
// Confidence policy: emit `totality-nontermination` only when the function
// has at least one recursive call we can detect AND we can't prove ANY of
// its call sites are decreasing. Functions whose recursive call we can't
// match as `param - K` still get notified — totality isn't proven.

export interface TerminationFinding {
  binding: string;
  message: string;
  /** Stage 6: concrete witness — a recursion trace illustrating the
   *  non-terminating shape, e.g. `factorial(n=any) → factorial(n) [same input]`
   *  for self-recursion with no decrease, or `a(x) → b(x) → a(x) [cycle]`
   *  for mutual recursion. */
  counterexample?: string;
}

/** Walk every function binding and emit one finding per recursive function
 *  whose termination can't be shown. `typeLookup` resolves Symbol-typed
 *  param annotations (`n: NonNeg`) to their concrete type Context — the
 *  runtime's lookup evaluates user-defined type bindings via a compile-mode
 *  context, so the returned value carries `abstractDomain` for refined
 *  types. */
export function checkTermination(
  bindings: Iterable<{ key: string | null; value: Value | undefined }>,
  typeLookup?: TypeLookup,
): TerminationFinding[] {
  return analyzeDivergence(bindings, typeLookup).findings;
}

// =============================================================================
// B-028 F3 — divergence analysis: `div` as a computed effect (CE-R1/CE-R2)
// =============================================================================
//
// D31/D34 executed: the termination analysis IS the `div` inference. Each
// function binding gets a DISCHARGE TIER (the D34 spectrum), and `div`
// enters a binding's inferred effect set when its own discharge is
// `undischarged` — or transitively, when it calls a div-carrying function
// (PE gives `io` this propagation for free during evaluation; `div` is
// computed post-hoc, so the closure walks the call graph the analysis
// already builds). An `admitted` discharge (`assume terminates`, or an
// unverified-but-declared `decreases`) is an axiom about the WHOLE
// function and therefore blocks inherited div too; `witnessed` proves
// only the function's own recursion, so callee div still propagates
// through it.

export type DivTier = "auto" | "witnessed" | "admitted" | "undischarged";

export interface DivObligation {
  binding: string;
  tier: DivTier;
  /** What discharged (or failed to discharge) this binding. */
  detail?: string;
  counterexample?: string;
}

export interface DivergenceResult {
  /** The Stage-2 findings, exactly as `checkTermination` always
   *  reported them (message-compatible; `partial` bindings suppressed). */
  findings: TerminationFinding[];
  /** One entry per analyzed function binding, tier per D34. */
  obligations: DivObligation[];
  /** binding → why `div` is in its inferred set (own vs inherited). */
  divBindings: Map<string, { own: boolean; via?: string }>;
  /** binding → the collapsed function object carrying the metadata
   *  (the stamp target for `inferredEffects`). */
  stampTargets: Map<string, ComposedFunctionValue>;
  /** Info notices for bindings that INHERIT div through calls (the
   *  long-reserved needs-annotation kind finally earns its keep). */
  propagationNotices: { binding: string; message: string }[];
  /** B-018 T-R6 (broadened): bindings that participate in a recursion
   *  cycle — self-recursive or in a mutual SCC — REGARDLESS of discharge
   *  tier. Consumers use this for the PE inlining cutoff: a recursive
   *  call with unresolved arguments cannot converge (the base case is
   *  undecidable without a concrete argument), so unfolding it
   *  speculatively is pure waste however well its termination is
   *  proven. Separate from `divBindings`, which is about termination. */
  recursiveBindings: Set<string>;
}

export function analyzeDivergence(
  bindings: Iterable<{ key: string | null; value: Value | undefined }>,
  typeLookup?: TypeLookup,
  /** Answers whether a callee OUTSIDE this binding list (a module import,
   *  an extension binding) carries `div` — the cross-module seam. */
  resolveLeafDiv?: (name: string) => boolean,
): DivergenceResult {
  // Materialise bindings once — needed twice (call-graph build + per-binding
  // analysis) and the input may be a one-shot iterator.
  const bindingList: Array<{ key: string; value: Value }> = [];
  for (const b of bindings) {
    if (b.key && b.value) bindingList.push({ key: b.key, value: b.value });
  }

  // Build the call graph + peel each binding's function shape ahead of time
  // so the analysis loop can look up any callee's paramTypeAsts.
  const peeledByName = new Map<string, { cfn: ComposedFunctionValue; paramTypeAsts: Value[] }>();
  const callGraph = new Map<string, Set<string>>();
  for (const b of bindingList) {
    const peeled = peelFunctionAst(b.value);
    if (!peeled) continue;
    peeledByName.set(b.key, peeled);
    const callees = new Set<string>();
    collectCalleeNames(peeled.cfn.body, callees);
    callGraph.set(b.key, callees);
  }
  // Compute SCCs: each function name maps to its SCC's member set. Mutual
  // recursion = SCC size > 1; pure self-recursion = SCC size 1 with self
  // edge; non-recursive = SCC size 1 without self edge.
  const sccs = tarjanSCCs(callGraph);

  const findings: TerminationFinding[] = [];
  const obligations: DivObligation[] = [];
  const recursiveBindings = new Set<string>();
  const stampTargets = new Map<string, ComposedFunctionValue>();
  const ownDiv = new Map<string, string>();   // binding → undischarged detail
  const admitted = new Set<string>();         // axiom lifts inherited div too
  for (const b of bindingList) {
    const peeled = peeledByName.get(b.key);
    if (!peeled) continue;
    const { cfn } = peeled;
    stampTargets.set(b.key, cfn);
    // Cycle membership is a structural fact, independent of how (or
    // whether) termination is discharged — compute it before the
    // tier-specific early exits so every recursive binding is recorded.
    const sccEarly = sccs.get(b.key) ?? new Set([b.key]);
    const cycleCallsEarly: CallSite[] = [];
    findCallsToCycle(cfn.body, sccEarly, cycleCallsEarly);
    if (cycleCallsEarly.length > 0) recursiveBindings.add(b.key);
    if ((cfn as any).assumeTerminates === true) {
      obligations.push({ binding: b.key, tier: "admitted",
        detail: "assume terminates — declared liveness axiom" });
      admitted.add(b.key);
      continue;
    }
    if (isFunctionPartial(cfn)) {
      // No Stage-2 finding (the declared opt-out, unchanged) — but the
      // tier is honest: `partial` always means undischarged (D34), and
      // `div` enters the inferred set.
      obligations.push({ binding: b.key, tier: "undischarged",
        detail: "declared `partial` — div undischarged by declaration" });
      ownDiv.set(b.key, "declared `partial`");
      continue;
    }

    // Self-edges (self-recursion) and inter-edges (mutual recursion)
    // alike, plus Stage 5 HOF-mediated edges (callback passed to
    // map/filter/reduce) — computed above, reused here.
    const scc = sccEarly;
    const cycleCalls = cycleCallsEarly;
    if (cycleCalls.length === 0) {
      // Not part of any recursion cycle: total by construction, callees
      // permitting (the closure below handles callees).
      obligations.push({ binding: b.key, tier: "auto",
        detail: "non-recursive — total by construction" });
      continue;
    }

    // Stage 3: user-supplied `decreases` clause. The metric refers to the
    // caller's params; verify each cycle call's caller-side decrease shape
    // against the caller's param-type info. Stage 5 HOF edges are accepted
    // without metric verification (the `decreases` clause is the contract;
    // we trust it).
    const decMetric = (cfn as any).decreasesMetric as Value | undefined;
    if (decMetric) {
      const directCalls = cycleCalls
        .filter((s): s is CallSite & { kind: "direct" } => s.kind === "direct")
        .map(s => s.call);
      const { reasons, recognized } = checkUserMetric(decMetric, directCalls, peeled.paramTypeAsts, typeLookup);
      if (reasons.length > 0) {
        const unique = [...new Set(reasons)];
        const cex = renderMetricCounterexample(b.key, decMetric, cycleCalls);
        findings.push({
          binding: b.key,
          message: `\`decreases\` metric does not provably decrease: ${unique.join("; ")}`,
          counterexample: cex,
        });
        obligations.push({ binding: b.key, tier: "undischarged",
          detail: `\`decreases\` metric does not provably decrease: ${unique.join("; ")}`,
          counterexample: cex });
        ownDiv.set(b.key, "failed `decreases` metric");
      } else if (recognized) {
        obligations.push({ binding: b.key, tier: "witnessed",
          detail: "`decreases` metric verified (kernel-checked decrease on every recursive call)" });
      } else {
        // CE-R2: the formerly SILENT trust of an unrecognised metric
        // shape becomes a RECORDED admission — verdict-visible, no div.
        obligations.push({ binding: b.key, tier: "admitted",
          detail: "unverified `decreases` metric — admitted as declared (shape not kernel-checkable)" });
        admitted.add(b.key);
      }
      continue;
    }

    // Auto-detection.
    //   - Direct calls: verify `param - K` shape against the CALLEE's param
    //     type. Self-recursion uses the caller's own types (callee == caller);
    //     mutual recursion uses the called function's types.
    //   - HOF calls (Stage 5): verify the receiver is structurally smaller
    //     than a caller parameter via `param.field` access.
    const nonDecreasing: string[] = [];
    for (const site of cycleCalls) {
      let reason: string | null;
      if (site.kind === "direct") {
        const calleePeeled = peeledByName.get(site.callee);
        const calleeTypes = calleePeeled?.paramTypeAsts ?? [];
        reason = whyNotDecreasing(site.call, calleeTypes, typeLookup);
      } else {
        reason = whyHofCallNotDecreasing(site);
      }
      if (reason) {
        const prefix = site.callee === b.key ? "" : `call to \`${site.callee}\`: `;
        nonDecreasing.push(prefix + reason);
      }
    }
    if (nonDecreasing.length > 0) {
      const reasons = [...new Set(nonDecreasing)];
      const cycleNote = scc.size > 1
        ? ` (mutual recursion cycle: ${[...scc].join(" ↔ ")})`
        : "";
      const msg = reasons.length === 1
        ? `recursive call may not terminate${cycleNote}: ${reasons[0]}`
        : `recursive calls may not terminate${cycleNote}: ${reasons.join("; ")}`;
      const counterexample = renderTerminationCounterexample(b.key, cycleCalls, peeled.cfn, scc);
      findings.push({ binding: b.key, message: msg, counterexample });
      obligations.push({ binding: b.key, tier: "undischarged", detail: msg, counterexample });
      ownDiv.set(b.key, "unproven recursion");
    } else {
      obligations.push({ binding: b.key, tier: "auto",
        detail: "recursion provably decreases (auto-detected)" });
    }
  }

  // --- The div closure (CE-R1): propagate up the call graph ------------------
  // A caller inherits div from any div-carrying callee (in-list, or a leaf
  // the resolver identifies — the cross-module seam), unless the caller's
  // own discharge is an ADMITTED axiom about the whole function.
  const divBindings = new Map<string, { own: boolean; via?: string }>();
  for (const k of ownDiv.keys()) divBindings.set(k, { own: true });
  const leafDiv = new Set<string>();
  if (resolveLeafDiv) {
    for (const callees of callGraph.values()) {
      for (const c of callees) {
        if (!peeledByName.has(c) && !leafDiv.has(c) && resolveLeafDiv(c)) leafDiv.add(c);
      }
    }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const [caller, callees] of callGraph) {
      if (divBindings.has(caller) || admitted.has(caller)) continue;
      for (const c of callees) {
        if ((c !== caller && divBindings.has(c)) || leafDiv.has(c)) {
          divBindings.set(caller, { own: false, via: c });
          changed = true;
          break;
        }
      }
    }
  }
  const propagationNotices: { binding: string; message: string }[] = [];
  for (const [k, w] of divBindings) {
    if (w.own) continue;
    propagationNotices.push({
      binding: k,
      message: `\`${k}\` calls \`${w.via}\`, which may not terminate — ` +
        `\`${k}\`'s inferred effects include \`div\` ` +
        `(discharge the callee, or declare \`assume terminates\` / \`partial\` here)`,
    });
  }

  return { findings, obligations, divBindings, stampTargets, propagationNotices, recursiveBindings };
}

/** Stage 6: render a concrete trace illustrating the non-terminating cycle.
 *  The shape varies by edge kind and cycle size; the goal is a one-line
 *  witness a user can mentally execute. */
function renderTerminationCounterexample(
  bindingName: string,
  cycleCalls: CallSite[],
  cfn: ComposedFunctionValue,
  scc: Set<string>,
): string | undefined {
  // Collect param names from the caller for naming.
  const paramNames = cfn.params.map(p => (p as any)._name as string | undefined ?? "_");
  const sampleArgs = paramNames.join(", ");

  if (scc.size > 1) {
    // Mutual recursion: build a path through the cycle.
    const path = [bindingName];
    const cyclesOut = new Set<string>();
    for (const s of cycleCalls) {
      if (s.callee !== bindingName) cyclesOut.add(s.callee);
    }
    for (const c of cyclesOut) path.push(c);
    path.push(bindingName); // close the loop visually
    return `${path.map(n => `${n}(${sampleArgs})`).join(" → ")} [cycle, no decrease]`;
  }

  // Self-recursion: pick the first cycle call to render.
  const first = cycleCalls[0];
  if (first.kind === "direct") {
    return `${bindingName}(${sampleArgs}) → ${bindingName}(${sampleArgs}) [same input passes back]`;
  }
  // HOF edge.
  const recv = dataOf(first.receiver);
  const recvDesc = recv.kind === ValueKind.Param
    ? ((recv as any)._name ?? "arr")
    : "<receiver>";
  return `${bindingName}(${sampleArgs}) calls ${recvDesc}.${first.method}(${bindingName}) — receiver is not smaller, recursion loops`;
}

/** Stage 6: render a counterexample for a failing `decreases` metric. The
 *  user attested a metric; we point at the first cycle call where it doesn't
 *  decrease. */
function renderMetricCounterexample(
  bindingName: string,
  metric: Value,
  cycleCalls: CallSite[],
): string | undefined {
  const first = cycleCalls.find((s): s is CallSite & { kind: "direct" } => s.kind === "direct");
  if (!first) return undefined;
  let metricDesc = "<metric>";
  const mp = dataOf(metric);
  if (mp.kind === ValueKind.Param) {
    metricDesc = (mp as any)._name ?? `param${(mp as any).position}`;
  } else if (mp.kind === ValueKind.Expression) {
    const fn = dataOf((mp as ExpressionValue).fn);
    if (fn.kind === ValueKind.PrimitiveFunction && (fn as any).name === "typed_array") {
      metricDesc = `[${(mp as ExpressionValue).args
        .map(a => {
          const p = dataOf(a);
          if (p.kind === ValueKind.Param) return (p as any)._name ?? `param${(p as any).position}`;
          return "_";
        })
        .join(", ")}]`;
    }
  }
  return `\`decreases ${metricDesc}\` does not decrease on ${bindingName}(…) → ${bindingName}(…) at call site`;
}

/** Stage 5: a call site is either a direct call `Expression(Symbol(name), …)`
 *  or an indirect call where the function value flows into a stdlib HOF
 *  callback slot (`arr.map(self)` / `arr.filter(self)` / `arr.reduce(self, init)`).
 *  Each variant carries enough information for termination verification. */
type CallSite =
  | { kind: "direct"; callee: string; call: ExpressionValue }
  | { kind: "hof"; callee: string; method: "map" | "filter" | "reduce"; receiver: Value };

const _HOF_METHODS = new Set(["map", "filter", "reduce"]);

/** Recognise `Expression(Expression(type_dispatch, [receiver, Bits("map"|...)]), [cb, ...])`.
 *  Returns the HOF method name + receiver + ordered args, or null if the
 *  expression isn't a stdlib HOF dispatch. */
function matchStdlibHof(
  e: ExpressionValue,
): { method: "map" | "filter" | "reduce"; receiver: Value; args: Value[] } | null {
  const outerFn = dataOf(e.fn);
  if (outerFn.kind !== ValueKind.Expression) return null;
  const dispFn = dataOf((outerFn as ExpressionValue).fn);
  if (dispFn.kind !== ValueKind.PrimitiveFunction) return null;
  if ((dispFn as any).name !== "type_dispatch") return null;
  const dispArgs = (outerFn as ExpressionValue).args;
  if (dispArgs.length !== 2) return null;
  const methodVal = dataOf(dispArgs[1]);
  if (methodVal.kind !== ValueKind.Bits) return null;
  const method = bitsToString(methodVal as BitsValue);
  if (!_HOF_METHODS.has(method)) return null;
  return {
    method: method as "map" | "filter" | "reduce",
    receiver: dispArgs[0],
    args: e.args,
  };
}

/** Walk a function body collecting names of any function called via a
 *  Symbol reference. Used to build the call graph for SCC computation.
 *  Stage 5: also picks up callbacks passed to stdlib HOFs — `arr.map(f)`
 *  contributes `f` as a callee. */
function collectCalleeNames(v: Value, out: Set<string>, seen?: Set<Value>): void {
  if (!v || typeof v !== "object") return;
  if (!seen) seen = new Set();
  if (seen.has(v)) return;
  seen.add(v);
  if (v.kind === ValueKind.Expression) {
    const e = v as ExpressionValue;
    const fn = dataOf(e.fn);
    if (fn.kind === ValueKind.Symbol) out.add((fn as any).name);
    // Stage 5: HOF callback positions.
    const hof = matchStdlibHof(e);
    if (hof) {
      for (const a of hof.args) {
        const ap = dataOf(a);
        if (ap.kind === ValueKind.Symbol) out.add((ap as any).name);
      }
    }
    collectCalleeNames(e.fn, out, seen);
    for (const a of e.args) collectCalleeNames(a, out, seen);
  } else if (v.kind === ValueKind.ComposedFunction) {
    collectCalleeNames((v as ComposedFunctionValue).body, out, seen);
  }
}

/** Collect every cycle call in `body` — direct (`Expression(Symbol(name), …)`)
 *  and HOF-mediated (Symbol callback inside a stdlib map/filter/reduce). */
function findCallsToCycle(
  body: Value,
  cycle: Set<string>,
  out: CallSite[],
  seen: Set<Value> = new Set(),
): void {
  if (!body || typeof body !== "object" || seen.has(body)) return;
  seen.add(body);
  if (body.kind === ValueKind.Expression) {
    const e = body as ExpressionValue;
    const fn = dataOf(e.fn);
    if (fn.kind === ValueKind.Symbol) {
      const name = (fn as any).name as string;
      if (cycle.has(name)) out.push({ kind: "direct", callee: name, call: e });
    }
    // Stage 5: HOF callback positions.
    const hof = matchStdlibHof(e);
    if (hof) {
      for (const a of hof.args) {
        const ap = dataOf(a);
        if (ap.kind === ValueKind.Symbol) {
          const name = (ap as any).name as string;
          if (cycle.has(name)) {
            out.push({ kind: "hof", callee: name, method: hof.method, receiver: hof.receiver });
          }
        }
      }
    }
    findCallsToCycle(e.fn, cycle, out, seen);
    for (const a of e.args) findCallsToCycle(a, cycle, out, seen);
  } else if (body.kind === ValueKind.ComposedFunction) {
    findCallsToCycle((body as ComposedFunctionValue).body, cycle, out, seen);
  }
}

/** Stage 5 termination check for an HOF cycle edge. An HOF call is
 *  well-founded when the receiver is structurally smaller than a caller
 *  parameter — Stage 5 minimum recognises `param.field` access (the field
 *  is a sub-component of the record, so iterating it terminates by
 *  structural induction). Bare-Param receivers (e.g. `arr.map(self)` on
 *  the function's own array param) are NOT decreasing and fire. */
function isHofReceiverStructurallySmaller(receiver: Value): boolean {
  const p = dataOf(receiver);
  if (p.kind !== ValueKind.Expression) return false;
  const inner = dataOf((p as ExpressionValue).fn);
  if (inner.kind !== ValueKind.PrimitiveFunction) return false;
  if ((inner as any).name !== "type_dispatch") return false;
  const args = (p as ExpressionValue).args;
  if (args.length !== 2) return false;
  const recvArg = dataOf(args[0]);
  // `param.field` shape: dispatch's first arg is a bare Param. The field
  // value is a sub-component by record-structural induction.
  return recvArg.kind === ValueKind.Param;
}

/** Explain why an HOF cycle edge doesn't terminate, or null when it does. */
function whyHofCallNotDecreasing(site: CallSite & { kind: "hof" }): string | null {
  if (isHofReceiverStructurallySmaller(site.receiver)) return null;
  const recv = dataOf(site.receiver);
  const recvDesc = recv.kind === ValueKind.Param
    ? `param \`${(recv as any)._name ?? `param${(recv as any).position}`}\``
    : "the receiver";
  return `HOF-mediated recursive call via \`.${site.method}\`: ${recvDesc} is not structurally smaller than any parameter (consider a \`decreases\` clause or \`partial\`)`;
}

/** Tarjan's strongly-connected-meta algorithm. Returns a map from
 *  each node to its SCC's member set. Non-function callees in the graph
 *  (e.g. references to top-level value bindings that happen to share a
 *  name with no function) are skipped via the `graph.has` check. */
function tarjanSCCs(graph: Map<string, Set<string>>): Map<string, Set<string>> {
  const index = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccsList: Set<string>[] = [];
  let counter = 0;

  function strongconnect(v: string): void {
    index.set(v, counter);
    lowlink.set(v, counter);
    counter++;
    stack.push(v);
    onStack.add(v);

    const successors = graph.get(v) ?? new Set<string>();
    for (const w of successors) {
      if (!graph.has(w)) continue; // skip names that aren't functions
      if (!index.has(w)) {
        strongconnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!));
      }
    }

    if (lowlink.get(v) === index.get(v)) {
      const scc = new Set<string>();
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.add(w);
      } while (w !== v);
      sccsList.push(scc);
    }
  }

  for (const v of graph.keys()) {
    if (!index.has(v)) strongconnect(v);
  }
  const result = new Map<string, Set<string>>();
  for (const scc of sccsList) {
    for (const name of scc) result.set(name, scc);
  }
  return result;
}

/** Verify a user-supplied `decreases <metric>` clause. Returns one reason per
 *  failed call when the metric is a recognised pattern but the verification
 *  fails; returns empty when:
 *    - the metric verifies (all calls show decrease)
 *    - the metric is unrecognised (trust the user — Stage 3 minimum)
 *
 *  Recognised metric shapes:
 *    1. Bare Param  — same semantics as Stage 2's auto-detect.
 *    2. `typed_array(p1, p2, …)` — lexicographic over the listed positions.
 */
function checkUserMetric(
  metric: Value,
  calls: ExpressionValue[],
  paramTypeAsts: Value[],
  typeLookup?: TypeLookup,
): { reasons: string[]; recognized: boolean } {
  const reasons: string[] = [];

  // Shape 1: bare Param.
  if (metric.kind === ValueKind.Param) {
    const pos = (metric as any).position as number;
    const name = (metric as any)._name ?? `param${pos}`;
    for (const call of calls) {
      if (pos >= call.args.length) continue;
      const decrease = recognizeParamMinusK(call.args[pos]);
      if (!decrease || decrease.pos !== pos) {
        reasons.push(`metric \`${name}\` does not decrease on at least one recursive call`);
        continue;
      }
      // The decrease is established positionally; for `decreases` clauses
      // we trust the user about the bound (the explicit clause is the
      // commitment). Skip the type-domain check that Stage 2 enforces.
    }
    return { reasons, recognized: true };
  }

  // Shape 2: typed_array of params → lexicographic.
  if (metric.kind === ValueKind.Expression) {
    const fn = dataOf((metric as ExpressionValue).fn);
    if (fn.kind === ValueKind.PrimitiveFunction && (fn as any).name === "typed_array") {
      const meta = (metric as ExpressionValue).args;
      // For each call, walk through meta left-to-right. The metric
      // strictly decreases if SOME component strictly decreases AND ALL
      // earlier meta stay equal (i.e. the same param passes through
      // unchanged in those positions).
      for (const call of calls) {
        const decreasedAt = findLexDecreasePosition(meta, call);
        if (decreasedAt < 0) {
          reasons.push(`lexicographic metric does not decrease on at least one recursive call`);
        }
      }
      return { reasons, recognized: true };
    }
  }

  // Anything else: trust the user — B-028 F3 (CE-R2): the trust is no
  // longer silent; the caller records it as an ADMITTED discharge.
  return { reasons, recognized: false };
}

/** Walk lex-tuple meta: return the index of the first strictly-
 *  decreasing component where all earlier meta are stable (same Param
 *  passes through), or -1 if no such index exists. */
function findLexDecreasePosition(meta: Value[], call: ExpressionValue): number {
  for (let i = 0; i < meta.length; i++) {
    // All earlier meta must stay equal — for Stage 3 minimum we
    // require each earlier component to be a Param at some position p such
    // that call.args[p] is the same Param (no change).
    let earlierStable = true;
    for (let j = 0; j < i; j++) {
      const c = meta[j];
      if (c.kind !== ValueKind.Param) { earlierStable = false; break; }
      const pos = (c as any).position as number;
      if (pos >= call.args.length) { earlierStable = false; break; }
      const argP = dataOf(call.args[pos]);
      if (argP.kind !== ValueKind.Param || (argP as any).position !== pos) {
        earlierStable = false; break;
      }
    }
    if (!earlierStable) continue;

    // Component i should strictly decrease.
    const c = meta[i];
    if (c.kind !== ValueKind.Param) continue;
    const pos = (c as any).position as number;
    if (pos >= call.args.length) continue;
    const decrease = recognizeParamMinusK(call.args[pos]);
    if (decrease && decrease.pos === pos) return i;
  }
  return -1;
}

/** Return a string explaining why the call isn't provably decreasing, or null
 *  when at least one decreasing-on-bounded-param position is found. */
function whyNotDecreasing(
  call: ExpressionValue,
  paramTypeAsts: Value[],
  typeLookup?: TypeLookup,
): string | null {
  // Find any "param - K > 0" decrease patterns first, regardless of type.
  const decreases: { pos: number; name: string }[] = [];
  for (let i = 0; i < call.args.length; i++) {
    const decrease = recognizeParamMinusK(call.args[i]);
    if (decrease && decrease.pos === i) decreases.push(decrease);
  }

  // Provably decreasing if any decrease position has a non-negative lower
  // bound. We need to see the param's static type to verify the bound, so
  // skip positions without type info entirely (stays silent on untyped
  // params).
  for (const d of decreases) {
    const pt = paramTypeAsts[d.pos];
    if (pt && typeHasNonNegativeLowerBound(pt, typeLookup)) {
      return null;
    }
  }

  // Decrease found AND we have typed positions — none with non-negative
  // bound. Flag as "decreases but unbounded" so the user knows what to add.
  for (const d of decreases) {
    if (paramTypeAsts[d.pos]) {
      return `param \`${d.name}\` decreases but has no non-negative lower bound (consider \`${d.name}: NonNeg\` or similar)`;
    }
  }

  // Decrease found but no type info at all — stay silent. Can't prove
  // either way; existing untyped Allegro code shouldn't get noise from the
  // analyzer.
  if (decreases.length > 0) return null;

  // No decrease pattern anywhere — clear non-termination signal, fire
  // regardless of typing.
  return `no parameter strictly decreases on the recursive call (consider a \`decreases\` clause or \`partial\`)`;
}

/** Recognise `Param(pos) - K` where K is a positive literal. Returns the
 *  param's position and source name, or null. Handles MultiValue-wrapped
 *  literals. */
function recognizeParamMinusK(v: Value): { pos: number; name: string } | null {
  if (v.kind !== ValueKind.Expression) return null;
  const fn = dataOf((v as ExpressionValue).fn);
  if (fn.kind !== ValueKind.PrimitiveFunction) return null;
  const fnName = (fn as any).name as string;
  if (fnName !== "bits_sub" && fnName !== "typed_sub") return null;
  const args = (v as ExpressionValue).args;
  if (args.length !== 2) return null;
  const left = dataOf(args[0]);
  if (left.kind !== ValueKind.Param) return null;
  const right = dataOf(args[1]);
  if (right.kind !== ValueKind.Bits) return null;
  const k = (right as BitsValue).data;
  if (k <= 0n) return null;
  return {
    pos:  (left as any).position,
    name: (left as any)._name ?? `param${(left as any).position}`,
  };
}

/** Does this type Context (or Symbol resolvable to one) carry an abstract
 *  domain whose lower bound is non-negative? Recognised forms: interval with
 *  `lo >= 0`, exact equal with `value >= 0`. Symbols are resolved via the
 *  caller-supplied typeLookup, which evaluates the binding to its concrete
 *  form when needed. */
function typeHasNonNegativeLowerBound(
  t: Value,
  typeLookup?: TypeLookup,
  seen: Set<Value> = new Set(),
): boolean {
  if (seen.has(t)) return false;
  seen.add(t);
  let cur = t;
  cur = dataOf(cur);
  if (cur.kind === ValueKind.Symbol) {
    const name = (cur as any).name as string;
    const resolved = typeLookup?.(name);
    if (!resolved) return false;
    return typeHasNonNegativeLowerBound(resolved, typeLookup, seen);
  }
  if (cur.kind !== ValueKind.Structure) return false;
  const dom = (cur as any).abstractDomain;
  if (!dom) return false;
  if (dom.kind === "interval") return dom.lo >= 0;
  if (dom.kind === "eq")       return dom.value >= 0;
  return false;
}

function collectBoolLiterals(cases: ChainCase[]): Set<boolean> {
  const out = new Set<boolean>();
  for (const c of cases) {
    const p = dataOf(c.pattern);
    // Bool literals come through typed_function calls / `true`/`false` resolve
    // to MultiValue(Int, {type: Bool}); after PE the raw form is Bits(1)/Bits(0)
    // possibly wrapped in MultiValue with Bool type.
    if (p.kind === ValueKind.Bits) {
      const b = p as BitsValue;
      if (b.length === 1) {
        out.add(b.data === 1n);
      } else if (b.length === 64) {
        if (b.data === 0n) out.add(false);
        else if (b.data === 1n) out.add(true);
      }
    }
  }
  return out;
}
