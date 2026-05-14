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

import {
  Value, ValueKind, ComposedFunctionValue, ExpressionValue,
  ContextValue, BitsValue,
  primaryOf, bitsToString,
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

const _WRAPPER_NAMES = new Set([
  "type_check", "partial_attach", "decreases_attach",
  "effects_attach", "param_effects_attach",
]);

function findAttachWrapper(body: Value, wantName: string): ExpressionValue | null {
  let cur = body;
  for (let i = 0; i < 16; i++) {
    if (cur.kind !== ValueKind.Expression) return null;
    const fn = primaryOf((cur as ExpressionValue).fn);
    if (fn.kind !== ValueKind.PrimitiveFunction) return null;
    const name = (fn as any).name as string;
    if (name === wantName) return cur as ExpressionValue;
    if (!_WRAPPER_NAMES.has(name)) return null;
    if ((cur as ExpressionValue).args.length < 1) return null;
    cur = (cur as ExpressionValue).args[0];
  }
  return null;
}

/** Recognise `partial_attach(body)` anywhere in the head wrapper stack.
 *  Returns the inner body when found, null otherwise. */
export function unwrapPartialAttach(body: Value): Value | null {
  const w = findAttachWrapper(body, "partial_attach");
  if (!w) return null;
  return w.args[0];
}

/** Is the function's body wrapped with `partial_attach`? Analyzers consult
 *  this to skip the totality check on opted-out functions. */
export function isFunctionPartial(fn: ComposedFunctionValue): boolean {
  return unwrapPartialAttach(fn.body) !== null;
}

/** Recognise `decreases_attach(body, metric)` in the head wrapper stack.
 *  Returns `{ body, metric }` when found, null otherwise. Stage 3+. */
export function unwrapDecreasesAttach(body: Value): { body: Value; metric: Value } | null {
  const w = findAttachWrapper(body, "decreases_attach");
  if (!w) return null;
  if (w.args.length < 2) return null;
  return { body: w.args[0], metric: w.args[1] };
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
  // Post-evaluation: MultiValue + FunctionType.
  if (v.kind === ValueKind.MultiValue) {
    const mv = v as any;
    const tComp = mv.components.get("type") as Value | undefined;
    const prim = mv.primary;
    if (prim.kind === ValueKind.ComposedFunction) {
      let paramTypeAsts: Value[] = [];
      if (tComp && tComp.kind === ValueKind.Context) {
        const types = getFunctionParamTypes(tComp as ContextValue);
        if (types) paramTypeAsts = types;
      }
      return { cfn: prim as ComposedFunctionValue, paramTypeAsts };
    }
  }
  if (v.kind === ValueKind.ComposedFunction) {
    return { cfn: v as ComposedFunctionValue, paramTypeAsts: [] };
  }
  if (v.kind !== ValueKind.Expression) return null;
  const target = primaryOf((v as ExpressionValue).fn);
  if (target.kind !== ValueKind.PrimitiveFunction) return null;
  if ((target as any).name !== "typed_function") return null;
  const args = (v as ExpressionValue).args;
  if (args.length < 3) return null;
  // args[0] = inner function (maybe nested typed_function), args[1] = paramCount,
  // args[2..2+paramCount-1] = paramTypes, last = returnType.
  const inner = peelFunctionAst(args[0]);
  if (!inner) return null;
  const paramCountP = primaryOf(args[1]);
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
    const fn = primaryOf((v as ExpressionValue).fn);
    if (fn.kind === ValueKind.PrimitiveFunction && (fn as any).name === "eval_when") {
      // Top of a chain. Flatten by walking else-branch thunks.
      const subject = (v as ExpressionValue).args[0];
      const cases: ChainCase[] = [];
      let cur: Value = v;
      while (cur.kind === ValueKind.Expression) {
        const cfn = primaryOf((cur as ExpressionValue).fn);
        if (cfn.kind !== ValueKind.PrimitiveFunction || (cfn as any).name !== "eval_when") break;
        const args = (cur as ExpressionValue).args;
        if (args.length < 5) break;
        cases.push({ pattern: args[1] });
        // elseFn is a zero-arg ComposedFunction whose body is the rest of the chain.
        const elseFn = primaryOf(args[4]);
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
        const cfn = primaryOf((cur as ExpressionValue).fn);
        if (cfn.kind !== ValueKind.PrimitiveFunction || (cfn as any).name !== "eval_when") break;
        const args = (cur as ExpressionValue).args;
        const thenFn = primaryOf(args[3]);
        if (thenFn.kind === ValueKind.ComposedFunction) {
          walkForWhen((thenFn as ComposedFunctionValue).body, visit, visited);
        }
        const elseFn = primaryOf(args[4]);
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
  if (v.kind === ValueKind.MultiValue) {
    walkForWhen((v as any).primary, visit, visited);
    return;
  }
}

function isWhenNoMatch(v: Value): boolean {
  if (v.kind !== ValueKind.Expression) return false;
  const fn = primaryOf((v as ExpressionValue).fn);
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
  // Strip MultiValue wrappers.
  if (subject.kind === ValueKind.MultiValue) {
    const t = (subject as any).components.get("type");
    if (t) return resolveTypeName(t, typeLookup);
    return resolveSubjectTypeName((subject as any).primary, paramTypeAsts, typeLookup);
  }
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
  if (t.kind === ValueKind.Context) return typeContextName(t);
  if (t.kind === ValueKind.MultiValue) return resolveTypeName((t as any).primary, typeLookup);
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
  if (t.kind !== ValueKind.Context) return null;
  const n = (t as ContextValue).bindings.get("__name");
  if (!n || !n.value) return null;
  const p = primaryOf(n.value);
  if (p.kind !== ValueKind.Bits) return null;
  return bitsToString(p as BitsValue);
}

function hasWildcardOrBinding(cases: ChainCase[]): boolean {
  for (const c of cases) {
    const p = primaryOf(c.pattern);
    // Wildcard marker: `when_wildcard()` expression.
    if (p.kind === ValueKind.Expression) {
      const fn = primaryOf((p as ExpressionValue).fn);
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
 *  context, so the returned value carries `__abstractDomain` for refined
 *  types. */
export function checkTermination(
  bindings: Iterable<{ key: string | null; value: Value | undefined }>,
  typeLookup?: TypeLookup,
): TerminationFinding[] {
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
  for (const b of bindingList) {
    const peeled = peeledByName.get(b.key);
    if (!peeled) continue;
    const { cfn } = peeled;
    if (isFunctionPartial(cfn)) continue;

    const scc = sccs.get(b.key) ?? new Set([b.key]);
    // All calls in this function's body that target an SCC member —
    // self-edges (self-recursion) and inter-edges (mutual recursion) alike,
    // plus Stage 5 HOF-mediated edges (callback passed to map/filter/reduce).
    const cycleCalls: CallSite[] = [];
    findCallsToCycle(cfn.body, scc, cycleCalls);
    if (cycleCalls.length === 0) continue; // not part of any recursion cycle

    // Stage 3: user-supplied `decreases` clause. The metric refers to the
    // caller's params; verify each cycle call's caller-side decrease shape
    // against the caller's param-type info. Stage 5 HOF edges are accepted
    // without metric verification (the `decreases` clause is the contract;
    // we trust it).
    const decAttach = unwrapDecreasesAttach(cfn.body);
    if (decAttach) {
      const directCalls = cycleCalls
        .filter((s): s is CallSite & { kind: "direct" } => s.kind === "direct")
        .map(s => s.call);
      const reasons = checkUserMetric(decAttach.metric, directCalls, peeled.paramTypeAsts, typeLookup);
      if (reasons.length > 0) {
        const unique = [...new Set(reasons)];
        findings.push({
          binding: b.key,
          message: `\`decreases\` metric does not provably decrease: ${unique.join("; ")}`,
          counterexample: renderMetricCounterexample(b.key, decAttach.metric, cycleCalls),
        });
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
    }
  }
  return findings;
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
  const recv = primaryOf(first.receiver);
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
  const mp = primaryOf(metric);
  if (mp.kind === ValueKind.Param) {
    metricDesc = (mp as any)._name ?? `param${(mp as any).position}`;
  } else if (mp.kind === ValueKind.Expression) {
    const fn = primaryOf((mp as ExpressionValue).fn);
    if (fn.kind === ValueKind.PrimitiveFunction && (fn as any).name === "typed_array") {
      metricDesc = `[${(mp as ExpressionValue).args
        .map(a => {
          const p = primaryOf(a);
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
  const outerFn = primaryOf(e.fn);
  if (outerFn.kind !== ValueKind.Expression) return null;
  const dispFn = primaryOf((outerFn as ExpressionValue).fn);
  if (dispFn.kind !== ValueKind.PrimitiveFunction) return null;
  if ((dispFn as any).name !== "type_dispatch") return null;
  const dispArgs = (outerFn as ExpressionValue).args;
  if (dispArgs.length !== 2) return null;
  const methodVal = primaryOf(dispArgs[1]);
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
    const fn = primaryOf(e.fn);
    if (fn.kind === ValueKind.Symbol) out.add((fn as any).name);
    // Stage 5: HOF callback positions.
    const hof = matchStdlibHof(e);
    if (hof) {
      for (const a of hof.args) {
        const ap = primaryOf(a);
        if (ap.kind === ValueKind.Symbol) out.add((ap as any).name);
      }
    }
    collectCalleeNames(e.fn, out, seen);
    for (const a of e.args) collectCalleeNames(a, out, seen);
  } else if (v.kind === ValueKind.ComposedFunction) {
    collectCalleeNames((v as ComposedFunctionValue).body, out, seen);
  } else if (v.kind === ValueKind.MultiValue) {
    collectCalleeNames((v as any).primary, out, seen);
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
    const fn = primaryOf(e.fn);
    if (fn.kind === ValueKind.Symbol) {
      const name = (fn as any).name as string;
      if (cycle.has(name)) out.push({ kind: "direct", callee: name, call: e });
    }
    // Stage 5: HOF callback positions.
    const hof = matchStdlibHof(e);
    if (hof) {
      for (const a of hof.args) {
        const ap = primaryOf(a);
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
  } else if (body.kind === ValueKind.MultiValue) {
    findCallsToCycle((body as any).primary, cycle, out, seen);
  }
}

/** Stage 5 termination check for an HOF cycle edge. An HOF call is
 *  well-founded when the receiver is structurally smaller than a caller
 *  parameter — Stage 5 minimum recognises `param.field` access (the field
 *  is a sub-component of the record, so iterating it terminates by
 *  structural induction). Bare-Param receivers (e.g. `arr.map(self)` on
 *  the function's own array param) are NOT decreasing and fire. */
function isHofReceiverStructurallySmaller(receiver: Value): boolean {
  const p = primaryOf(receiver);
  if (p.kind !== ValueKind.Expression) return false;
  const inner = primaryOf((p as ExpressionValue).fn);
  if (inner.kind !== ValueKind.PrimitiveFunction) return false;
  if ((inner as any).name !== "type_dispatch") return false;
  const args = (p as ExpressionValue).args;
  if (args.length !== 2) return false;
  const recvArg = primaryOf(args[0]);
  // `param.field` shape: dispatch's first arg is a bare Param. The field
  // value is a sub-component by record-structural induction.
  return recvArg.kind === ValueKind.Param;
}

/** Explain why an HOF cycle edge doesn't terminate, or null when it does. */
function whyHofCallNotDecreasing(site: CallSite & { kind: "hof" }): string | null {
  if (isHofReceiverStructurallySmaller(site.receiver)) return null;
  const recv = primaryOf(site.receiver);
  const recvDesc = recv.kind === ValueKind.Param
    ? `param \`${(recv as any)._name ?? `param${(recv as any).position}`}\``
    : "the receiver";
  return `HOF-mediated recursive call via \`.${site.method}\`: ${recvDesc} is not structurally smaller than any parameter (consider a \`decreases\` clause or \`partial\`)`;
}

/** Tarjan's strongly-connected-components algorithm. Returns a map from
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
): string[] {
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
    return reasons;
  }

  // Shape 2: typed_array of params → lexicographic.
  if (metric.kind === ValueKind.Expression) {
    const fn = primaryOf((metric as ExpressionValue).fn);
    if (fn.kind === ValueKind.PrimitiveFunction && (fn as any).name === "typed_array") {
      const components = (metric as ExpressionValue).args;
      // For each call, walk through components left-to-right. The metric
      // strictly decreases if SOME component strictly decreases AND ALL
      // earlier components stay equal (i.e. the same param passes through
      // unchanged in those positions).
      for (const call of calls) {
        const decreasedAt = findLexDecreasePosition(components, call);
        if (decreasedAt < 0) {
          reasons.push(`lexicographic metric does not decrease on at least one recursive call`);
        }
      }
      return reasons;
    }
  }

  // Anything else: trust the user. No verification, no notification.
  return reasons;
}

/** Walk lex-tuple components: return the index of the first strictly-
 *  decreasing component where all earlier components are stable (same Param
 *  passes through), or -1 if no such index exists. */
function findLexDecreasePosition(components: Value[], call: ExpressionValue): number {
  for (let i = 0; i < components.length; i++) {
    // All earlier components must stay equal — for Stage 3 minimum we
    // require each earlier component to be a Param at some position p such
    // that call.args[p] is the same Param (no change).
    let earlierStable = true;
    for (let j = 0; j < i; j++) {
      const c = components[j];
      if (c.kind !== ValueKind.Param) { earlierStable = false; break; }
      const pos = (c as any).position as number;
      if (pos >= call.args.length) { earlierStable = false; break; }
      const argP = primaryOf(call.args[pos]);
      if (argP.kind !== ValueKind.Param || (argP as any).position !== pos) {
        earlierStable = false; break;
      }
    }
    if (!earlierStable) continue;

    // Component i should strictly decrease.
    const c = components[i];
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
  const fn = primaryOf((v as ExpressionValue).fn);
  if (fn.kind !== ValueKind.PrimitiveFunction) return null;
  const fnName = (fn as any).name as string;
  if (fnName !== "bits_sub" && fnName !== "typed_sub") return null;
  const args = (v as ExpressionValue).args;
  if (args.length !== 2) return null;
  const left = primaryOf(args[0]);
  if (left.kind !== ValueKind.Param) return null;
  const right = primaryOf(args[1]);
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
  if (cur.kind === ValueKind.MultiValue) cur = (cur as any).primary;
  if (cur.kind === ValueKind.Symbol) {
    const name = (cur as any).name as string;
    const resolved = typeLookup?.(name);
    if (!resolved) return false;
    return typeHasNonNegativeLowerBound(resolved, typeLookup, seen);
  }
  if (cur.kind !== ValueKind.Context) return false;
  const dom = (cur as any).__abstractDomain;
  if (!dom) return false;
  if (dom.kind === "interval") return dom.lo >= 0;
  if (dom.kind === "eq")       return dom.value >= 0;
  return false;
}

function collectBoolLiterals(cases: ChainCase[]): Set<boolean> {
  const out = new Set<boolean>();
  for (const c of cases) {
    const p = primaryOf(c.pattern);
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
    } else if (c.pattern.kind === ValueKind.MultiValue) {
      const pp = primaryOf(c.pattern);
      if (pp.kind === ValueKind.Bits) {
        const b = pp as BitsValue;
        if (b.data === 0n) out.add(false);
        else if (b.data === 1n) out.add(true);
      }
    }
  }
  return out;
}
