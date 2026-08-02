// =============================================================================
// Slot & channel registry + typed accessors — structures Phase 1 (C1.1 / B-006)
//
// The D39 disposition table as code (design: docs/design/allegretto/
// structures.md §"Slot disposition"; decision log D39 in
// .claude/plans/structured-values-unification.md). Every `__*` slot and
// MultiValue component in the codebase is registered here with its owner,
// disposition, and post-migration target. The boundary harness walks test-
// corpus values and fails on any unregistered `__*` key — the "no new `__*`
// slot" rule (D39) enforced mechanically from this chunk on.
//
// The typed accessors read the CURRENT representation (Context bindings,
// MultiValue components, JS expando properties). Call sites migrate to them
// in C1.2/C1.3; the representation itself swaps under them in Phase 4 —
// this module is the seam that makes that swap possible.
// =============================================================================

import {
  Value,
  ValueKind,
  ContextValue,
  MultiValueType,
  AllegroError,
  makeMultiValue,
} from "./types.js";
import { denseIndexGet, denseSlotCount, denseElements } from "./structure.js";

// --- Registry ------------------------------------------------------------------

/** Where the slot physically lives in the current representation. */
export type SlotStorage =
  | "context-binding"      // key in a ContextValue's bindings map
  | "js-property"          // JS expando property on a Value object
  | "mv-component"         // named MultiValue component
  | "binding-name-prefix"  // synthetic evaluation-context binding-name family
  | "label-marker";        // magic substring inside an effect label

/** D39 disposition: what the slot becomes after the migration. */
export type SlotDisposition =
  | "member"        // symbol-keyed member declared on the owning kind
  | "channel"       // registered channel (D23/D24) on the channel plane
  | "base-concept"  // absorbed into a base-language concept (D18/D33)
  | "host-internal" // never a value slot; stays host-side, renamed freely
  | "delete";       // redundant once shape IS the kind — removed outright

export interface SlotRegistration {
  /** Current name (or prefix, for prefix-family storages). */
  name: string;
  storages: SlotStorage[];
  /** Owning kind or subsystem. */
  owner: string;
  disposition: SlotDisposition;
  /** Post-migration home, per D39 (or "n/a" for host internals). */
  target: string;
  /** Match by prefix rather than exact name. */
  prefix?: boolean;
  notes?: string;
}

/** The D39 disposition table. Order mirrors the decision text. */
export const SLOT_REGISTRY: SlotRegistration[] = [
  // --- Type fields → declared members on Type -------------------------------
  { name: "__name", storages: ["context-binding"], owner: "Type", disposition: "member", target: "Type.name" },
  { name: "__members", storages: ["context-binding"], owner: "Type", disposition: "member", target: "Type.members" },
  { name: "__extends", storages: ["context-binding"], owner: "Type", disposition: "member", target: "Type.parent" },
  { name: "__construct", storages: ["context-binding", "js-property"], owner: "Type", disposition: "member", target: "Type.construct", notes: "per-kind minting authority (D40 R2)" },
  { name: "__constructor", storages: ["context-binding", "js-property"], owner: "Type", disposition: "member", target: "Type.construct", notes: "alias of __construct; collapses into one member" },
  { name: "__getMember", storages: ["context-binding", "js-property"], owner: "Type", disposition: "member", target: "Type.fallbackMember" },
  { name: "__interface", storages: ["context-binding"], owner: "Type", disposition: "member", target: "Type.structural" },
  { name: "__invariantsList", storages: ["context-binding", "js-property"], owner: "Type", disposition: "member", target: "Type.invariants" },
  { name: "__wraps", storages: ["context-binding"], owner: "Type", disposition: "member", target: "Type.wraps" },
  { name: "__union", storages: ["context-binding"], owner: "Type", disposition: "member", target: "Type.variants" },

  // --- Refinement-type fields (on the type instance) -------------------------
  { name: "__predicate", storages: ["context-binding"], owner: "Refinement", disposition: "member", target: "predicate" },
  { name: "__abstractDomain", storages: ["js-property"], owner: "Refinement", disposition: "member", target: "domain" },

  // --- GenericType fields -----------------------------------------------------
  { name: "__genericParams", storages: ["js-property"], owner: "GenericType", disposition: "member", target: "params", notes: "on ComposedFunction; survives clones via subst/remapParams" },
  { name: "__params", storages: ["context-binding"], owner: "GenericType", disposition: "member", target: "params" },
  { name: "__args", storages: ["context-binding"], owner: "GenericType", disposition: "member", target: "args" },
  { name: "__generic", storages: ["context-binding"], owner: "GenericType", disposition: "member", target: "generic (constructor back-link)" },
  { name: "__isGeneric", storages: ["context-binding"], owner: "GenericType", disposition: "delete", target: "n/a — the flag IS the kind (shape = GenericType)" },

  // --- Proof fields ------------------------------------------------------------
  { name: "__proposition", storages: ["context-binding"], owner: "Proof", disposition: "member", target: "proposition" },
  { name: "__reason", storages: ["context-binding"], owner: "Proof", disposition: "member", target: "reason" },
  { name: "__counterexample", storages: ["context-binding"], owner: "Proof", disposition: "member", target: "counterexample" },
  { name: "__eq_lhs", storages: ["context-binding"], owner: "Proof", disposition: "member", target: "lhs" },
  { name: "__eq_rhs", storages: ["context-binding"], owner: "Proof", disposition: "member", target: "rhs" },

  // --- Effect fields -------------------------------------------------------------
  { name: "__effect_kind", storages: ["context-binding"], owner: "Effect", disposition: "member", target: "Effect.kind" },
  { name: "__effectBound", storages: ["js-property"], owner: "Effect", disposition: "member", target: "Effect instance label-set representation (dissolves at C6.2; the annotation-bound reading becomes derived)", notes: "D39 addendum, maintainer-ratified 2026-07: member for now; when Effect re-derives through the kind recipe an instance IS its label set, so the stored bound collapses into it" },
  { name: "__effectvar:", storages: ["label-marker"], owner: "Effect", disposition: "member", target: "declared generic-param structure on function types", prefix: true },
  { name: "__effectVarParams", storages: ["js-property"], owner: "Effect", disposition: "member", target: "declared generic-param structure on function types" },

  // --- Channels (D36 / D21–D24): value-plane metadata, not fields ---------------
  { name: "__type", storages: ["context-binding"], owner: "shape channel", disposition: "channel", target: "shape (D36)" },
  { name: "__discharged", storages: ["context-binding"], owner: "discharged channel", disposition: "channel", target: "discharged integrity channel (D21–D24; kernel-private writer)" },
  { name: "__effectSet", storages: ["js-property"], owner: "effects channel", disposition: "channel", target: "effects (F1 component made canonical)" },
  { name: "__inferredEffects", storages: ["js-property"], owner: "effects channel", disposition: "channel", target: "effects" },
  { name: "__predicateSet", storages: ["js-property"], owner: "knowledge channel", disposition: "channel", target: "knowledge (D36)" },

  // --- MultiValue components (current channel plane) ------------------------------
  { name: "type", storages: ["mv-component"], owner: "shape channel", disposition: "channel", target: "shape (D36)" },
  { name: "error", storages: ["mv-component"], owner: "error channel", disposition: "channel", target: "error (viral propagation)" },
  { name: "effects", storages: ["mv-component"], owner: "effects channel", disposition: "channel", target: "effects" },
  { name: "predicates", storages: ["mv-component"], owner: "knowledge channel", disposition: "channel", target: "knowledge (D36)" },
  { name: "domain", storages: ["mv-component"], owner: "knowledge channel", disposition: "channel", target: "knowledge (D36)" },
  { name: "bound", storages: ["mv-component"], owner: "knowledge channel", disposition: "channel", target: "knowledge (D36) — occurrence bound (C3.2 annotation boundary)" },
  { name: "exported", storages: ["mv-component"], owner: "module system", disposition: "base-concept", target: "scope-binding visibility metadata (S3; migrates at the Phase 2 scope split / module rework)", notes: "D39 addendum, maintainer-ratified 2026-07: export-ness is a property of a binding in the module Scope, not of the value — the value-plane marker is a stopgap with a known aliasing wart (`y = x` silently exports y) and dissolves once C2.1 gives bindings a visibility attribute" },
  { name: "arity", storages: ["mv-component"], owner: "Function", disposition: "delete", target: "n/a — was write-only dead metadata; the write in wrapAsUntypedFunction was removed 2026-07", notes: "D39 addendum, maintainer-ratified 2026-07: never read anywhere in the repo; arity is derivable from Function[ParamTypes, ReturnType] where needed. Entry retained as the audit record" },
  { name: "warnings", storages: ["mv-component"], owner: "warnings channel", disposition: "channel", target: "warnings", notes: "documented in CLAUDE.md; currently unused in code" },
  { name: "source", storages: ["mv-component"], owner: "source channel", disposition: "channel", target: "source", notes: "documented in CLAUDE.md; currently unused in code" },

  // --- Base concepts, not slots -----------------------------------------------------
  { name: "__length", storages: ["context-binding"], owner: "Array", disposition: "base-concept", target: "numeric-structure slot count (D18)" },
  { name: "__future_", storages: ["binding-name-prefix"], owner: "futures", disposition: "base-concept", target: "future cells (D33)", prefix: true },
  { name: "__bare_", storages: ["binding-name-prefix"], owner: "futures", disposition: "base-concept", target: "future cells (D33)", prefix: true },

  // --- Host-engine internals (never value slots) --------------------------------------
  { name: "__channelWriterFor", storages: ["js-property"], owner: "channel plane", disposition: "host-internal", target: "n/a — brand on writer PrimitiveFunctions (C1.4); attenuation checks it" },
  { name: "__partial", storages: ["js-property"], owner: "totality", disposition: "host-internal", target: "n/a — body-form metadata (C1.5b collapse); becomes a function-value channel entry at C4.x" },
  { name: "__decreasesMetric", storages: ["js-property"], owner: "totality", disposition: "host-internal", target: "n/a — body-form metadata (C1.5b collapse)" },
  { name: "__declaredEffectsAst", storages: ["js-property"], owner: "effects channel", disposition: "host-internal", target: "n/a — body-form metadata (C1.5b collapse)" },
  { name: "__paramEffectPairs", storages: ["js-property"], owner: "Effect", disposition: "host-internal", target: "n/a — body-form metadata (C1.5b collapse)" },
  { name: "__provenClauses", storages: ["js-property"], owner: "Proof", disposition: "host-internal", target: "n/a — body-form metadata (C1.5b collapse)" },
  { name: "__compileMode", storages: ["context-binding"], owner: "evaluator", disposition: "host-internal", target: "n/a" },
  { name: "__futureManager", storages: ["js-property"], owner: "futures", disposition: "host-internal", target: "n/a" },
  { name: "__tailCall", storages: ["js-property"], owner: "evaluator", disposition: "host-internal", target: "n/a" },
  { name: "__grammarValue", storages: ["js-property"], owner: "grammar2", disposition: "host-internal", target: "n/a" },
  { name: "__grammarHandle", storages: ["js-property"], owner: "grammar2", disposition: "host-internal", target: "n/a" },
  { name: "__grammar_fragment", storages: ["js-property"], owner: "grammar2", disposition: "host-internal", target: "n/a" },
  { name: "__grammar", storages: ["context-binding", "js-property"], owner: "grammar2", disposition: "host-internal", target: "n/a", prefix: true },
  { name: "__parse", storages: ["js-property"], owner: "grammar2", disposition: "host-internal", target: "n/a", prefix: true },
  { name: "__inline_grammar", storages: ["context-binding"], owner: "grammar2", disposition: "host-internal", target: "n/a", prefix: true },
  { name: "__el_", storages: ["context-binding"], owner: "Earley", disposition: "host-internal", target: "n/a", prefix: true },
  { name: "__start__", storages: ["context-binding"], owner: "Earley", disposition: "host-internal", target: "n/a" },
  { name: "__error__", storages: ["context-binding"], owner: "Earley", disposition: "host-internal", target: "n/a" },
  { name: "__anon_", storages: ["context-binding"], owner: "grammar2 gensym", disposition: "host-internal", target: "n/a", prefix: true },
];

const EXACT = new Map<string, SlotRegistration>();
const PREFIXES: SlotRegistration[] = [];
for (const r of SLOT_REGISTRY) {
  if (r.prefix) PREFIXES.push(r);
  else EXACT.set(r.name, r);
}

/** Is this `__*` key (a Context binding key) covered by the registry? */
export function isRegisteredSlotKey(key: string): boolean {
  if (EXACT.has(key)) return true;
  return PREFIXES.some((r) => key.startsWith(r.name));
}

/** Is this MultiValue component key a registered channel/member? */
export function isRegisteredComponentKey(key: string): boolean {
  const r = EXACT.get(key);
  return !!r && r.storages.includes("mv-component");
}

export function slotRegistration(key: string): SlotRegistration | undefined {
  return EXACT.get(key) ?? PREFIXES.find((r) => key.startsWith(r.name));
}

// --- Typed accessors (over the current representation) ---------------------------
//
// Read side landed with C1.1; write-side shims added in C1.2 for the
// call-site migration (C1.4 turns the origination sites into capability-
// gated writers on top of these). Accessors return the raw stored value —
// including MultiValue-wrapped types (types are typed) — plus `asContext`
// to peel to the primary Context where the caller needs the shape itself.

// C4.2: dense structures (array contexts) only ever hold numeric element
// keys plus `__length` — every slot probe can answer WITHOUT materializing
// the legacy bindings view. Keeps type-slot probes on arbitrary values
// (auto-naming's hasShapeSlot, getName, …) off the materialization path.
function isDense(ctx: ContextValue): boolean {
  return (ctx as unknown as { dense?: unknown }).dense !== undefined;
}

function slotRead(ctx: ContextValue, name: string): Value | undefined {
  if (isDense(ctx)) return name === "__length" ? denseSlotCount(ctx) : undefined;
  return ctx.bindings.get(name)?.value as Value | undefined;
}

/** Mirrors types-std's addBinding exactly (map + bindingList, duplicates
 *  preserved on overwrite) — zero behavior change is the C1.2 oracle. */
function slotWrite(ctx: ContextValue, key: string, value: Value): void {
  ctx.bindings.set(key, { key, value });
  ctx.bindingList.push({ key, value });
}

/** Peel a MultiValue wrapper down to its Context primary, if that's what it is. */
export function asContext(v: Value | null | undefined): ContextValue | null {
  if (!v) return null;
  const p = v.kind === ValueKind.MultiValue ? ((v as MultiValueType).primary as Value) : v;
  return p && p.kind === ValueKind.Context ? (p as ContextValue) : null;
}

// Type fields
// (named getName, not getTypeName — types-std.ts already exports a
// getTypeName with different semantics: value → type-name string)
export function getName(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__name"); }
export function getMembers(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__members"); }
export function getParent(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__extends"); }
export function getConstruct(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__construct") ?? slotRead(ctx, "__constructor"); }
export function getFallbackMember(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__getMember"); }
export function isInterfaceType(ctx: ContextValue): boolean { return !isDense(ctx) && ctx.bindings.has("__interface"); }
export function getInterfaceMarker(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__interface"); }
export function getInvariants(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__invariantsList"); }
export function getWraps(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__wraps"); }
export function getVariants(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__union"); }

// Refinement fields
export function getPredicate(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__predicate"); }
export function getAbstractDomain(ctx: ContextValue): any { return (ctx as any).__abstractDomain; }

// GenericType fields
export function getGenericArgs(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__args"); }
export function getGenericBackLink(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__generic"); }
export function isGenericType(ctx: ContextValue): boolean { return ctx.bindings.has("__isGeneric"); }
export function isGenericTypeSlot(ctx: ContextValue): boolean { return slotRead(ctx, "__isGeneric") !== undefined; }

// Proof fields
export function getProposition(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__proposition"); }
export function getProofReason(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__reason"); }
export function getProofCounterexample(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__counterexample"); }
export function getEqLhs(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__eq_lhs"); }
export function getEqRhs(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__eq_rhs"); }

// Effect fields
export function getEffectKind(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__effect_kind"); }
export function getEffectBound(ctx: ContextValue): any { return (ctx as any).__effectBound; }

// Base concepts
// C4.2: slot count and element reads are dense-aware — the dense region
// is authoritative when present; the `__length` slot / string-keyed map
// remain the fallback for non-dense numeric contexts.
export function getSlotCount(ctx: ContextValue): Value | undefined { return denseSlotCount(ctx); }
/** O(1) numeric element read (D18: arrays are numeric-keyed structures). */
export function indexGet(ctx: ContextValue, i: number): Value | undefined { return denseIndexGet(ctx, i); }
/** All elements of a numeric-keyed structure (dense fast path). */
export function elementsOf(ctx: ContextValue): Value[] { return denseElements(ctx); }
export function isFutureBindingName(name: string): boolean { return name.startsWith("__future_"); }
export function isBareBindingName(name: string): boolean { return name.startsWith("__bare_"); }

// --- Shape/knowledge split (C3.1, D36) ---------------------------------------------
//
// The old `type` channel conflated the DECLARED SHAPE (layout, member set,
// nominal identity — the dispatch source, fixed at construction) with
// KNOWLEDGE (imputed refinement bound + domains + predicates). C3.1 splits
// the read paths over the current storage:
//   - `type`  channel → the raw stored type (legacy view, knowledge-bearing
//     refinement bound included) — unchanged for existing readers.
//   - `shape` channel → the COMPUTED dispatch shape: the stored type with
//     member-transparent refinement layers walked off.
//
// A refinement layer is member-transparent iff it carries a predicate AND
// its `__members` is the SAME OBJECT as its parent's (`buildRefinedType`
// shares the parent's member set by reference). Types that mint their own
// member set — `preserveOps` (lifted operators), `mixin`, `extend` — ARE
// shapes: their overrides must dispatch (Liskov). Walking past a
// transparent layer never changes dispatch results (same member object,
// copied direct bindings); it defines where shape ends and knowledge
// begins.

/** The dispatch shape of a type Context: walk `__extends` past
 *  member-transparent refinement layers. Identity on non-refined types. */
export function typeShape(t: ContextValue): ContextValue {
  let cur = t;
  for (let guard = 0; guard < 64; guard++) {
    if (slotRead(cur, "__predicate") === undefined) return cur;
    const parent = asContext(slotRead(cur, "__extends"));
    if (!parent) return cur;
    const ownMembers = slotRead(cur, "__members");
    const parentMembers = slotRead(parent, "__members");
    if (ownMembers !== undefined && ownMembers !== parentMembers) return cur;
    cur = parent;
  }
  return cur;
}

// --- Channel plane (read side) ------------------------------------------------------

/** Raw channel read on a value: MultiValue component lookup, plus the two
 *  Context-binding channels (`__type`, `__discharged`) that predate the
 *  component plane. Free of any authority, per D23 (reads are free).
 *
 *  C3.1: `shape` reads the computed dispatch shape (refinement layers
 *  walked off — identity for every non-refined type, including the
 *  meta-type reads on type values); `type` stays the raw stored view. */
export function channelReadRaw(v: Value, channel: string): Value | undefined {
  // C4.3b: the channel plane is universal — a flattened Context (typed
  // record/array) carries `components` directly, so the generic lookup
  // covers both roles. Contexts without channels have `components`
  // undefined (lazy — plain contexts and scopes pay nothing).
  const comps = (v as MultiValueType).components as Map<string, Value> | undefined;
  if (comps !== undefined) {
    const comp = comps.get(channel);
    if (comp !== undefined) return comp as Value;
  }
  if (channel === "shape" || channel === "type") {
    let raw: Value | undefined;
    if (v.kind === ValueKind.MultiValue) {
      raw = comps?.get("type") as Value | undefined;
    } else if (v.kind === ValueKind.Context) {
      raw = slotRead(v as ContextValue, "__type");
    } else {
      const ctx = asContext(v);
      raw = ctx ? slotRead(ctx, "__type") : undefined;
    }
    if (channel === "shape" && raw?.kind === ValueKind.Context) {
      return typeShape(raw as ContextValue);
    }
    return raw;
  }
  if (channel === "discharged") {
    const c = asContext(v);
    if (c) return slotRead(c, "__discharged");
  }
  return undefined;
}

// --- Write-side shims (C1.2) --------------------------------------------------------

// Type fields
export function setName(ctx: ContextValue, v: Value): void { slotWrite(ctx, "__name", v); }
export function setMembers(ctx: ContextValue, v: Value): void { slotWrite(ctx, "__members", v); }
export function setParent(ctx: ContextValue, v: Value): void { slotWrite(ctx, "__extends", v); }
export function setConstruct(ctx: ContextValue, v: Value): void { slotWrite(ctx, "__construct", v); }
export function setFallbackMember(ctx: ContextValue, v: Value): void { slotWrite(ctx, "__getMember", v); }
export function markInterface(ctx: ContextValue, v: Value): void { slotWrite(ctx, "__interface", v); }
export function setInvariants(ctx: ContextValue, v: Value): void { slotWrite(ctx, "__invariantsList", v); }
export function setWraps(ctx: ContextValue, v: Value): void { slotWrite(ctx, "__wraps", v); }
export function setVariants(ctx: ContextValue, v: Value): void { slotWrite(ctx, "__union", v); }
export function removeName(ctx: ContextValue): void { ctx.bindings.delete("__name"); }
/** In-place rename used by the auto-naming pass. Mutates the bindings-map
 *  entry ONLY — bindingList entries are separate objects and are
 *  deliberately left untouched, mirroring the pre-accessor behavior. */
export function renameInPlace(ctx: ContextValue, name: Value): void {
  const b = ctx.bindings.get("__name");
  if (b) b.value = name;
}

// Refinement fields
export function setPredicate(ctx: ContextValue, v: Value): void { slotWrite(ctx, "__predicate", v); }
export function setAbstractDomain(ctx: ContextValue, d: unknown): void { (ctx as any).__abstractDomain = d; }

// GenericType fields
export function setGenericParams(ctx: ContextValue, v: Value): void { slotWrite(ctx, "__params", v); }
export function setGenericArgs(ctx: ContextValue, v: Value): void { slotWrite(ctx, "__args", v); }
export function setGenericBackLink(ctx: ContextValue, v: Value): void { slotWrite(ctx, "__generic", v); }
export function markGeneric(ctx: ContextValue, v: Value): void { slotWrite(ctx, "__isGeneric", v); }
export function getGenericParamsSlot(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__params"); }

// Proof fields
export function setProposition(ctx: ContextValue, v: Value): void { slotWrite(ctx, "__proposition", v); }
export function setProofReason(ctx: ContextValue, v: Value): void { slotWrite(ctx, "__reason", v); }
export function setProofCounterexample(ctx: ContextValue, v: Value): void { slotWrite(ctx, "__counterexample", v); }
export function setEqLhs(ctx: ContextValue, v: Value): void { slotWrite(ctx, "__eq_lhs", v); }
export function setEqRhs(ctx: ContextValue, v: Value): void { slotWrite(ctx, "__eq_rhs", v); }

// Effect fields
export function setEffectKind(ctx: ContextValue, v: Value): void { slotWrite(ctx, "__effect_kind", v); }
export function setEffectBound(ctx: ContextValue, d: unknown): void { (ctx as any).__effectBound = d; }

// Base concepts
export function setSlotCount(ctx: ContextValue, v: Value): void { slotWrite(ctx, "__length", v); }

// Channel-plane writes. `writeShape` remains a plain shim (shape-dispatch
// integrity is C3.1's concern); the discharged channel is capability-gated
// below (C1.4) — its raw writers are module-private.
export function writeShape(ctx: ContextValue, v: Value): void { slotWrite(ctx, "__type", v); }
function writeDischarged(ctx: ContextValue, v: Value): void { slotWrite(ctx, "__discharged", v); }

// Presence checks
export function hasName(ctx: ContextValue): boolean { return !isDense(ctx) && ctx.bindings.has("__name"); }
export function hasShapeSlot(ctx: ContextValue): boolean { return !isDense(ctx) && ctx.bindings.has("__type"); }
export function hasDischarged(ctx: ContextValue): boolean { return !isDense(ctx) && ctx.bindings.has("__discharged"); }

// Set-only writes (bindings map, NO bindingList entry) — mirror the proof
// kernel's origination idiom in primitives.ts exactly. These are the
// chokepoints the C1.4 discharged-channel writer capability wraps.
function slotSet(ctx: ContextValue, key: string, value: Value): void {
  ctx.bindings.set(key, { key, value });
}
export function stampProposition(ctx: ContextValue, v: Value): void { slotSet(ctx, "__proposition", v); }
function stampDischarged(ctx: ContextValue, v: Value): void { slotSet(ctx, "__discharged", v); }
export function stampProofReason(ctx: ContextValue, v: Value): void { slotSet(ctx, "__reason", v); }
export function stampProofCounterexample(ctx: ContextValue, v: Value): void { slotSet(ctx, "__counterexample", v); }
export function stampEqOperands(ctx: ContextValue, lhs: Value, rhs: Value): void {
  slotSet(ctx, "__eq_lhs", lhs);
  slotSet(ctx, "__eq_rhs", rhs);
}

// Slot-key constants — for the residual idioms (key filters in copy loops,
// bindingList lookups) that need the literal itself. Call sites use these
// instead of raw strings so the lint sees zero literals outside this module.
export const SLOT_KEYS = {
  name: "__name",
  members: "__members",
  extends: "__extends",
  construct: "__construct",
  constructor: "__constructor",
  getMember: "__getMember",
  interface: "__interface",
  invariantsList: "__invariantsList",
  wraps: "__wraps",
  union: "__union",
  predicate: "__predicate",
  params: "__params",
  args: "__args",
  generic: "__generic",
  isGeneric: "__isGeneric",
  type: "__type",
  discharged: "__discharged",
  effectKind: "__effect_kind",
  length: "__length",
  proposition: "__proposition",
  reason: "__reason",
  counterexample: "__counterexample",
  eqLhs: "__eq_lhs",
  eqRhs: "__eq_rhs",
} as const;

/** Host-plane (js-property) keys — registered as host-internal in the
 *  SLOT_REGISTRY. Call sites read them via scope.ts's chain-aware
 *  `scopeHostRead` using these constants, never raw literals. */
export const HOST_KEYS = {
  futureManager: "__futureManager",
} as const;

/** The "skip meta slots when copying user-visible bindings" test. */
export function isMetaSlotKey(key: string): boolean {
  return key.startsWith("__");
}

// Removal helpers (map + bindingList, mirroring the existing idiom exactly)
export function removeParent(ctx: ContextValue): void { ctx.bindings.delete("__extends"); }
export function removeShapeSlot(ctx: ContextValue): void { ctx.bindings.delete("__type"); }
export function removeConstruct(ctx: ContextValue): void {
  ctx.bindings.delete("__construct");
  const idx = ctx.bindingList.findIndex((b) => b.key === "__construct");
  if (idx >= 0) ctx.bindingList.splice(idx, 1);
}

// GenericType's own constructor slot ("__constructor" — the type-constructor
// function, semantically distinct from a concrete type's "__construct")
export function getGenericConstructor(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__constructor"); }
export function setGenericConstructor(ctx: ContextValue, v: Value): void { slotWrite(ctx, "__constructor", v); }

// --- Data plane -----------------------------------------------------------------------

/** Data-plane read (C4.3c: `primaryOf` retired — this is THE accessor).
 *  Identity for flattened Contexts and every non-scalar; unwraps the
 *  `primary` of a transparent scalar structure. */
export { dataOf } from "./types.js";

// --- Component plane (MultiValue) -------------------------------------------------------

/** Read-only view over a value's components. C4.3b: the channel plane is
 *  universal — flattened Contexts (typed records/arrays) carry components
 *  directly; values without a channel plane view as empty. */
export function componentsView(v: Value): ReadonlyMap<string, Value> {
  const comps = (v as MultiValueType).components as Map<string, Value> | undefined;
  return comps !== undefined ? comps : EMPTY_COMPONENTS;
}
const EMPTY_COMPONENTS: ReadonlyMap<string, Value> = new Map();

/** Mutable copy of a value's components — the standard "carry components
 *  forward onto a derived value" idiom. Empty map for channel-less values. */
export function cloneComponents(v: Value): Map<string, Value> {
  const comps = (v as MultiValueType).components as Map<string, Value> | undefined;
  return comps !== undefined ? new Map(comps) : new Map();
}

// --- Label markers -------------------------------------------------------------------------

/** Effect-variable marker prefix inside effect labels (Stage C2 machinery;
 *  dissolves into declared generic-param structure per D39). */
export const EFFECT_VAR_MARKER = "__effectvar:";
export function isEffectVarLabel(label: string): boolean { return label.startsWith(EFFECT_VAR_MARKER); }
export function effectVarLabel(name: string): string { return EFFECT_VAR_MARKER + name; }

// --- Channel registry + writer capabilities (C1.4, per D21–D24) -----------------------
//
// Registration is one-shot per channel name and returns the channel's write
// operation as a closure (D24: the capability IS the closure — delegable,
// attenuable, unconstructible from Allegretto). Reads are free (D23).
// Integrity channels may only register non-fabricating propagation rules
// (`drop` / `computed`) — `viral`/`union` on an authority channel is
// forgery vector C (D23). Propagation rules are RECORDED here and consulted
// by the C1.5 propagation table.

export type PropagationRule = "viral" | "union" | "computed" | "positional" | "drop";

export interface ChannelSpec {
  name: string;
  rule: PropagationRule;
  /** Origination requires the writer capability. */
  integrity?: boolean;
  /** S3 policy attribute — recorded, not yet enforced (default public). */
  readVisibility?: "public";
  /** Binding-plane storage key, for channels predating the component plane. */
  bindingKey?: string;
}

/** A held write capability for one channel. For binding-plane channels the
 *  write mutates the target Context (origination on a fresh kernel value);
 *  for component-plane channels it returns a new MultiValue. */
export interface ChannelWriter {
  channel: string;
  write(target: Value, channelValue: Value): Value;
}

interface ChannelEntry {
  spec: ChannelSpec;
  writer: ChannelWriter;
  /** evalSource pass in which an Allegro-minted channel was registered.
   *  The evaluation loop legitimately re-evaluates top-level bindings
   *  within one pass (fixpoint), so re-registration with an identical spec
   *  in the SAME epoch returns the held writer; any later pass throws —
   *  the capability belongs to whoever registered first. Kernel channels
   *  use epoch -1: they never re-issue. */
  epoch: number;
  minted: boolean;
}

const CHANNEL_TABLE = new Map<string, ChannelEntry>();
let channelEpoch = 0;

/** Called at the start of each evalSource pass (see runtime.ts). */
export function bumpChannelEpoch(): void { channelEpoch++; }

function buildWriter(spec: ChannelSpec): ChannelWriter {
  return {
    channel: spec.name,
    write(target: Value, channelValue: Value): Value {
      if (spec.bindingKey) {
        if (target.kind !== ValueKind.Context) {
          throw new AllegroError(`channel '${spec.name}': binding-plane write target must be a Context`);
        }
        if (spec.name === "discharged") stampDischarged(target as ContextValue, channelValue);
        else slotSet(target as ContextValue, spec.bindingKey, channelValue);
        return target;
      }
      const comps = cloneComponents(target);
      comps.set(spec.name, channelValue);
      return makeMultiValue(target.kind === ValueKind.MultiValue ? (target as MultiValueType).primary : target, comps) as Value;
    },
  };
}

let _viralCache: string[] | null = null;
/** Component-plane channels with viral propagation (first occurrence wins,
 *  carried onto the result residual). Cached; registration invalidates. */
export function viralChannels(): string[] {
  if (!_viralCache) {
    _viralCache = [...CHANNEL_TABLE.values()]
      .filter((e) => e.spec.rule === "viral" && !e.spec.bindingKey)
      .map((e) => e.spec.name);
  }
  return _viralCache;
}

let _unionCache: string[] | null = null;
/** Component-plane channels with union propagation (arg channels merged
 *  onto the result via the installed merge). */
export function unionChannels(): string[] {
  if (!_unionCache) {
    _unionCache = [...CHANNEL_TABLE.values()]
      .filter((e) => e.spec.rule === "union" && !e.spec.bindingKey)
      .map((e) => e.spec.name);
  }
  return _unionCache;
}

function invalidatePropagationCaches(): void {
  _viralCache = null;
  _unionCache = null;
}

/** One-shot channel registration → writer capability. Throws on duplicate
 *  names (re-registration is forgery vector F) and on fabricating rules for
 *  integrity channels (forgery vector C). */
export function registerChannel(spec: ChannelSpec, minted = false): ChannelWriter {
  const existing = CHANNEL_TABLE.get(spec.name);
  if (existing) {
    // Same-pass re-evaluation of the SAME Allegro registration site: hand
    // back the held writer. Anything else is forgery vector F.
    if (existing.minted && minted && existing.epoch === channelEpoch && existing.spec.rule === spec.rule) {
      return existing.writer;
    }
    throw new AllegroError(`channel '${spec.name}' is already registered — the writer capability is held by its owner`);
  }
  if (spec.integrity && (spec.rule === "viral" || spec.rule === "union")) {
    throw new AllegroError(`channel '${spec.name}': integrity channels may not register fabricating propagation rules (viral/union) — D23`);
  }
  const writer = buildWriter(spec);
  CHANNEL_TABLE.set(spec.name, { spec, writer, epoch: minted ? channelEpoch : -1, minted });
  invalidatePropagationCaches();
  return writer;
}

export function channelSpec(name: string): ChannelSpec | undefined {
  return CHANNEL_TABLE.get(name)?.spec;
}

/** TS-kernel writer acquisition. Discipline is the boundary lint: call sites
 *  outside the kernel modules (types-std.ts, primitives.ts) fail the suite.
 *  The writer is never exposed to Allegro — extension bindings do not
 *  include it, and Allegretto cannot construct a host closure (D24). */
export function kernelChannelWriter(name: string): ChannelWriter {
  const e = CHANNEL_TABLE.get(name);
  if (!e) throw new AllegroError(`no such channel: '${name}'`);
  return e.writer;
}

// Built-in channels, registered at module init. Rules per D36/D21–D24;
// consulted by the C1.5 propagation table.
registerChannel({ name: "shape", rule: "computed", bindingKey: "__type" });
registerChannel({ name: "error", rule: "viral" });
registerChannel({ name: "effects", rule: "union" });
registerChannel({ name: "predicates", rule: "computed" });
registerChannel({ name: "domain", rule: "computed" });
// C3.1 (D36): the canonical knowledge channel — one lattice over the
// imputed refinement bound + abstract domains + predicate set. Computed
// view for now: `predicates`/`domain` components + the refinement layers
// of the stored type are its physical storage until the C4 representation
// swap. Read via refinements.ts `knowledgeOf`.
registerChannel({ name: "knowledge", rule: "computed" });
// C3.2 (D36): the occurrence bound — set by annotation-boundary crossing,
// consumed by the member-AVAILABILITY gate (epistemic; "visibility" is
// reserved for S3 access control). `drop`: a bound constrains the
// occurrence it was stamped on, never results derived from it.
registerChannel({ name: "bound", rule: "drop" });
registerChannel({ name: "discharged", rule: "drop", integrity: true, bindingKey: "__discharged" });
registerChannel({ name: "warnings", rule: "union" });
registerChannel({ name: "source", rule: "positional" });
registerChannel({ name: "exported", rule: "drop" });

/** Binding keys that only a channel writer may originate. User-reachable
 *  construction paths (object literals, mv_set) consult this. */
const INTEGRITY_BINDING_KEYS = new Set<string>(["__discharged"]);
const INTEGRITY_CHANNEL_NAMES = new Set<string>(["discharged"]);

/** Gate for user-reachable construction paths: throws if the key would
 *  originate an integrity channel without holding its writer. */
export function assertNotIntegrityKey(key: string, site: string): void {
  if (INTEGRITY_BINDING_KEYS.has(key) || INTEGRITY_CHANNEL_NAMES.has(key)) {
    throw new AllegroError(
      `${site}: cannot originate integrity channel 'discharged' — origination requires the channel writer (D21–D24)`
    );
  }
}

/** Host-internal function-metadata properties preserved across
 *  ComposedFunction clones (subst/remapParams) — the C1.5b collapsed
 *  body-form metadata plus the PE effects stash. */
export const PRESERVED_FN_META_KEYS = [
  "__partial", "__decreasesMetric", "__declaredEffectsAst",
  "__paramEffectPairs", "__provenClauses", "__inferredEffects",
] as const;

/** Brand for Allegro-level channel-writer PrimitiveFunctions (host-internal
 *  js-property; registered in SLOT_REGISTRY). Attenuation checks it. */
export const CHANNEL_WRITER_BRAND = "__channelWriterFor";

// --- Propagation table (C1.5) ---------------------------------------------------
//
// The evaluator consults these instead of hand-rolling per-channel code.
// `viral` and `union` are fully generic; `computed` channels keep bespoke
// domain logic at the annotated evaluator sites (that is what "computed"
// means); `drop` channels never propagate — verified by forgery test C.
//
// MAINTAINER RULING (2026-08, C4.3a — activating the divergences deferred
// at C1.5): the principled rules are now live —
//  - effects on MultiValue re-evaluation merge by UNION via the installed
//    channel merge (was inner-shadows-outer).
//  - error virality rides EVERY hop of a residual chain, including the
//    unresolved-application and type_dispatch residual paths (was dropped
//    after the first hop — see differential fixtures `err-viral-chain`,
//    `err-through-method`).
//  - an error-carrying `if` condition propagates the error
//    (`err-in-if-cond`; was silently taking the else branch).

/** Union-merge behavior per channel, installed at module init by the
 *  channel's owner (e.g. effects.ts) — slots.ts cannot import the encodings
 *  without a cycle. */
const CHANNEL_MERGES = new Map<string, (a: Value, b: Value) => Value>();
export function installChannelMerge(name: string, merge: (a: Value, b: Value) => Value): void {
  CHANNEL_MERGES.set(name, merge);
}
export function channelMerge(name: string): ((a: Value, b: Value) => Value) | undefined {
  return CHANNEL_MERGES.get(name);
}



/** List the channels present on a value (component keys + binding-plane channels).
 *  C4.3b: the channel plane is universal — flattened Contexts report their
 *  component keys alongside the legacy binding-plane channels. */
export function channelList(v: Value): string[] {
  const out: string[] = [];
  const comps = (v as MultiValueType).components as Map<string, Value> | undefined;
  if (comps !== undefined) {
    out.push(...comps.keys());
  }
  if (v.kind === ValueKind.Context) {
    const ctx = v as ContextValue;
    if (!isDense(ctx)) {
      if (ctx.bindings.has("__type") && !out.includes("shape")) out.push("shape");
      if (ctx.bindings.has("__discharged") && !out.includes("discharged")) out.push("discharged");
    }
  }
  return out;
}
