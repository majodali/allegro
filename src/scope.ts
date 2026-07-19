// =============================================================================
// Scope protocol — structures Phase 2 (C2.1 / B-011)
//
// Scopes are EVALUATION objects; Structures are DATA. The design
// (docs/design/allegretto/structures.md) splits them: scopes get real
// parent-chain layering (O(1) extend, chain-walking lookup) instead of
// flatten-copy, and the two planes reject each other's operations.
//
// C2.1 lands the protocol over the current ContextValue representation:
// `parent`/`isScope` are host-plane fields on ContextValue (not value
// slots — never visible to Allegro code). The hot flatten-copy site
// (call-site type-variable enrichment in applyComposed) migrates here;
// the root evaluation-context layering (buildEvalCtx: primitives →
// extensions → base → source) migrates with C2.3's resolution
// unification, whose consumers (REPL persistence, module extraction,
// forward chaining) all iterate that flat view today — deferral recorded
// in the plan chunk log.
// =============================================================================

import {
  Value,
  ValueKind,
  ContextValue,
  Binding,
  AllegroError,
  makeContext,
} from "./types.js";
import { hasShapeSlot } from "./slots.js";

/** Create a fresh scope, optionally layered over a parent scope. */
export function scopeNew(parent?: ContextValue): ContextValue {
  if (parent) assertExtendable(parent, "scope_new");
  const s = makeContext();
  if (parent) (s as ContextValue & { parent?: ContextValue }).parent = parent;
  s.isScope = true;
  return s;
}

/** Is this Context an evaluation scope (vs a data Context)? */
export function isScopeCtx(c: ContextValue): boolean {
  return c.isScope === true;
}

function assertExtendable(parent: ContextValue, op: string): void {
  // Data structures are not evaluation scopes: a Context carrying a shape
  // slot is a typed data value — layering a scope over it is a plane
  // violation. (Legacy flat evaluation contexts predating the scope mark
  // are extendable — the mark spreads as creation sites migrate.)
  if (hasShapeSlot(parent)) {
    throw new AllegroError(`${op}: cannot extend a data structure as a scope (shape-carrying Context)`);
  }
}

/** Layer a child scope holding ONLY `entries` over `parent` — O(1) in the
 *  parent's size. The child shadows the parent on lookup. */
export function scopeExtend(parent: ContextValue, entries: Iterable<[string, Binding]>): ContextValue {
  const child = scopeNew(parent);
  for (const [k, b] of entries) {
    child.bindings.set(k, b);
    child.bindingList.push(b);
  }
  return child;
}

/** Chain-walking binding lookup: nearest layer wins. Works on legacy flat
 *  contexts too (no parent → single layer). */
export function scopeLookup(scope: ContextValue, name: string): Binding | undefined {
  let cur: ContextValue | undefined = scope;
  while (cur) {
    const b = cur.bindings.get(name);
    if (b !== undefined) return b;
    cur = cur.parent;
  }
  return undefined;
}

/** The scope's OWN layer (not the flattened chain view). */
export function scopeBindings(scope: ContextValue): Map<string, Binding> {
  return scope.bindings;
}

/** Chain-aware compile-mode flag read (F3a deferral): set anywhere up the
 *  chain means compiling. Replaces per-child flag copying. */
export function scopeCompileMode(scope: ContextValue): boolean {
  let cur: ContextValue | undefined = scope;
  while (cur) {
    if ((cur as any).__compileMode) return true;
    cur = cur.parent;
  }
  return false;
}

/** Chain-aware scope-predicate lookup (Phase C narrowing): nearest layer
 *  with a predicate set for `name` wins. C2.2 replaces the storage with
 *  immutable fact layering; this keeps the read chain-correct meanwhile. */
export function scopePredicateFor(scope: ContextValue, name: string): unknown | undefined {
  let cur: ContextValue | undefined = scope;
  while (cur) {
    const sp = cur.scopePredicates?.get(name);
    if (sp !== undefined) return sp;
    cur = cur.parent;
  }
  return undefined;
}

/** Guard for the data plane: struct operations must never run on scopes. */
export function assertNotScope(v: Value, op: string): void {
  if (v.kind === ValueKind.Context && isScopeCtx(v as ContextValue)) {
    throw new AllegroError(`${op}: cannot operate on an evaluation scope as data (scope/structure plane violation)`);
  }
}
