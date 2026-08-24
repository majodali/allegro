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
import { PredicateSet, mergePredicateSets } from "./refinements.js";

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

// --- Facts plane (C2.2) --------------------------------------------------------
//
// Facts (Phase-C predicate narrowing from branches, asserts, requires) live
// as per-layer maps. `scopeAssume` pushes an IMMUTABLE child layer carrying
// only the new facts — parent layers are never copied or mutated, and
// branch exit is simply discarding the child (no pop). Reads merge across
// the whole chain, rootmost first, so a child's facts refine (never
// replace) what outer layers established — byte-identical to the former
// copy-parent-then-merge behavior. Same-layer accumulation (an `assert`
// adding facts for the REST of its own scope) writes to the scope's own
// map — that is the layer's own state, not a parent mutation.

/** Push an immutable fact layer over `parent`. O(1) in parent size. */
export function scopeAssume(parent: ContextValue, facts: Map<string, PredicateSet>): ContextValue {
  const child = scopeNew(parent);
  child.scopePredicates = facts as Map<string, unknown>;
  return child;
}

/** Merged fact set for `name` across all layers (rootmost first; nearer
 *  layers refine). Undefined when no layer carries facts for the name. */
export function scopeFactsFor(scope: ContextValue, name: string): PredicateSet | undefined {
  let leafToRoot: PredicateSet[] | null = null;
  let cur: ContextValue | undefined = scope;
  while (cur) {
    const sp = cur.scopePredicates?.get(name) as PredicateSet | undefined;
    if (sp !== undefined) (leafToRoot ??= []).push(sp);
    cur = cur.parent;
  }
  if (!leafToRoot) return undefined;
  let acc = leafToRoot[leafToRoot.length - 1];
  for (let i = leafToRoot.length - 2; i >= 0; i--) {
    acc = mergePredicateSets(acc, leafToRoot[i]);
  }
  return acc;
}

/** Record facts on the scope's OWN layer (assert/requires mid-scope
 *  accumulation). Never touches parent layers. */
export function scopeOwnFacts(scope: ContextValue): Map<string, unknown> {
  if (!scope.scopePredicates) scope.scopePredicates = new Map();
  return scope.scopePredicates;
}

// --- Member privilege (B-097 V3, D42) ------------------------------------------
//
// A type's private members are reachable only from evaluation contexts
// extended from the type's own member scope. Bodies are evaluated in the
// CALL-SITE chain (substitution model), so the kernel mediator PLANTS a
// privilege layer over the call ctx when it dispatches a member of a
// type that declares private members; the privacy check then walks the
// chain for that exact layer. This realizes "context = reachability
// capsule": the layer is kernel-minted (user code cannot fabricate it),
// and calling a function hands it your context — possession is lent
// down the dynamic extent, exactly as the C2 chain lends every other
// capability the context holds.

/** Plant a member-privilege layer for `owner` (a type shape) over the
 *  call-site scope. Kernel-only mint — never exposed as a primitive. */
export function scopePrivilegeExtend(parent: ContextValue, owner: ContextValue): ContextValue {
  const s = scopeNew(parent);
  (s as any).__memberPrivilege = owner;
  return s;
}

/** Does this chain hold `owner`'s member privilege? (The D42 possession
 *  test for type-private members.) */
export function scopeHoldsPrivilege(scope: ContextValue | undefined, owner: ContextValue): boolean {
  let cur: ContextValue | undefined = scope;
  while (cur) {
    if ((cur as any).__memberPrivilege === owner) return true;
    cur = cur.parent;
  }
  return false;
}

/** Guard for the data plane: struct operations must never run on scopes. */
export function assertNotScope(v: Value, op: string): void {
  if (v.kind === ValueKind.Structure && isScopeCtx(v as ContextValue)) {
    throw new AllegroError(`${op}: cannot operate on an evaluation scope as data (scope/structure plane violation)`);
  }
}

// --- Resolution unification (C2.3b) -------------------------------------------
//
// An UNRESOLVED binding is a slot holding a pending future cell — one
// representation for REPL declarations awaiting a later phase, module
// imports, forward-chaining residuals, and async futures alike (design
// §4/§10, D33). The cell IS the Binding object: `value: undefined` means
// pending, `incompleteDeps`/`isComplete` carry the reactive bookkeeping.
// The DependencyRegistry holds the SAME objects as the owning scope's
// layer — resolving a cell is one in-place write, never a dual update.
//
// Absent vs unresolved: a name with NO binding anywhere on the chain is
// ABSENT (a lexical matter — the reflective op returns an error value); a
// binding present with `value: undefined` is UNRESOLVED (residualises,
// never throws — D11).

/** Create a pending future-cell binding. */
export function makeCell(key: string): Binding {
  return { key, value: undefined, incompleteDeps: new Set(), isComplete: false };
}

/** Is this binding a pending (unresolved) future cell? */
export function isPendingCell(b: Binding | undefined): boolean {
  return b !== undefined && b.value === undefined;
}

/** Resolve a cell in place — the single write that completes a binding.
 *  Also used to refine a residual toward completion (monotonic). */
export function resolveCell(b: Binding, value: Value, complete: boolean, deps?: Set<string>): void {
  b.value = value;
  b.isComplete = complete;
  b.incompleteDeps = complete ? undefined : (deps ?? b.incompleteDeps);
}

/** Chain-flatten: one merged map over every layer, rootmost first so
 *  nearer layers shadow. For flat-view consumers (REPL persistence,
 *  module extraction) — NOT for lookup (use scopeLookup). */
export function scopeAllBindings(scope: ContextValue): Map<string, Binding> {
  const layers: ContextValue[] = [];
  let cur: ContextValue | undefined = scope;
  while (cur) {
    layers.push(cur);
    cur = cur.parent;
  }
  const out = new Map<string, Binding>();
  for (let i = layers.length - 1; i >= 0; i--) {
    for (const [k, b] of layers[i].bindings) out.set(k, b);
  }
  return out;
}

/** Chain-walking read of a host-plane field (e.g. `__futureManager`) —
 *  set on the root evaluation scope, readable from any child layer. */
export function scopeHostRead(scope: ContextValue, key: string): unknown {
  let cur: ContextValue | undefined = scope;
  while (cur) {
    const v = (cur as unknown as Record<string, unknown>)[key];
    if (v !== undefined) return v;
    cur = cur.parent;
  }
  return undefined;
}
