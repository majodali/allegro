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

// --- Reserved notification kinds (consumed by Stage 1+) ---

/** Missing case in a `when/is/then` over a finite-domain scrutinee. */
export const NOTIF_TOTALITY_EXHAUSTIVENESS = "totality-exhaustiveness";

/** Recursive call that can't be shown to terminate. */
export const NOTIF_TOTALITY_NONTERMINATION = "totality-nontermination";

/** Function calls a partial dependency without itself being marked partial. */
export const NOTIF_TOTALITY_NEEDS_ANNOTATION = "totality-needs-annotation";

// --- partial_attach wrapper helpers ---

/** Recognise `partial_attach(body)` wrapping at the head of a function body
 *  (possibly nested inside a `type_check(body, returnType)` envelope added
 *  by typed-return functions). Returns the inner body when the wrapper is
 *  present, null otherwise. */
export function unwrapPartialAttach(body: Value): Value | null {
  let cur = body;
  // Peel one optional type_check layer (typed functions wrap the return).
  if (cur.kind === ValueKind.Expression) {
    const fn = primaryOf(cur.fn);
    if (fn.kind === ValueKind.PrimitiveFunction
        && (fn as any).name === "type_check"
        && cur.args.length >= 1) {
      cur = cur.args[0];
    }
  }
  if (cur.kind !== ValueKind.Expression) return null;
  const fn = primaryOf(cur.fn);
  if (fn.kind !== ValueKind.PrimitiveFunction) return null;
  if ((fn as any).name !== "partial_attach") return null;
  if (cur.args.length < 1) return null;
  return cur.args[0];
}

/** Is the function's body wrapped with `partial_attach`? Stage 1+ analyzers
 *  consult this to skip the totality check on opted-out functions. */
export function isFunctionPartial(fn: ComposedFunctionValue): boolean {
  return unwrapPartialAttach(fn.body) !== null;
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
}

/** Resolution helpers used to look up named type references (`Bool`, `Int`, …)
 *  in the analyzer's surrounding evaluation context. The analyzer runs over
 *  source ASTs, so type references appear as Symbols and need to be resolved
 *  against the bindings layered into evalCtx. */
export type TypeLookup = (name: string) => Value | undefined;

/** Peel `typed_function(ComposedFunction(…), paramCount, paramType1…paramTypeN,
 *  returnType)` and `partial_attach` wrappers around a binding's raw AST to
 *  reach the underlying ComposedFunction. Returns the inner function plus the
 *  per-position paramType Value (still as AST Symbols / Expressions —
 *  callers resolve via the lookup). */
function peelFunctionAst(v: Value): {
  cfn: ComposedFunctionValue;
  paramTypeAsts: Value[];
} | null {
  const p = primaryOf(v);
  if (p.kind === ValueKind.ComposedFunction) {
    return { cfn: p as ComposedFunctionValue, paramTypeAsts: [] };
  }
  if (p.kind !== ValueKind.Expression) return null;
  const target = primaryOf((p as ExpressionValue).fn);
  if (target.kind !== ValueKind.PrimitiveFunction) return null;
  if ((target as any).name !== "typed_function") return null;
  const args = (p as ExpressionValue).args;
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
      const msg = analyzeChain(subject, cases, hasExplicitElse, cfn, paramTypeAsts, typeLookup);
      if (msg) findings.push({ binding: b.key!, message: msg });
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
 *  enough to skip the notification. Returns a message describing the missing
 *  case(s), or null when no notification should fire. */
function analyzeChain(
  subject: Value,
  cases: ChainCase[],
  hasExplicitElse: boolean,
  _fn: ComposedFunctionValue,
  paramTypeAsts: Value[],
  typeLookup: TypeLookup | undefined,
): string | null {
  if (hasExplicitElse) return null;
  if (hasWildcardOrBinding(cases)) return null;

  const typeName = resolveSubjectTypeName(subject, paramTypeAsts, typeLookup);

  if (typeName === "Bool") {
    const literalValues = collectBoolLiterals(cases);
    if (literalValues.has(true) && literalValues.has(false)) return null;
    if (!literalValues.has(true) && !literalValues.has(false)) {
      return `non-exhaustive \`when\` over Bool: missing both \`true\` and \`false\` cases (and no \`else\` branch)`;
    }
    const missing = literalValues.has(true) ? "false" : "true";
    return `non-exhaustive \`when\` over Bool: missing \`${missing}\` case (and no \`else\` branch)`;
  }

  // Other types: emit a generic note only when we can name the type AND no
  // pattern looks like a finite-domain cover. The unknown-type case stays
  // silent.
  if (typeName) {
    return `non-exhaustive \`when\` over ${typeName}: no \`else\` branch and no wildcard \`is _\` case`;
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
