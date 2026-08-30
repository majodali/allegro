// =============================================================================
// Slot & channel registry + typed accessors — structures Phase 1 (C1.1 / B-006)
//
// The D39 disposition table as code (design: docs/design/allegretto/
// structures.md §"Slot disposition" + Appendix A; decision log D39 archived
// at docs/plans/archive/structured-values-unification.md). Every `__*` slot and
// MultiValue component in the codebase is registered here with its owner,
// disposition, and post-migration target. The boundary harness walks test-
// corpus values and fails on any unregistered `__*` key — the "no new `__*`
// slot" rule (D39) enforced mechanically from this chunk on.
//
// The typed accessors read the CURRENT representation (Context bindings,
// MultiValue meta, JS expando properties). Call sites migrate to them
// in C1.2/C1.3; the representation itself swaps under them in Phase 4 —
// this module is the seam that makes that swap possible.
// =============================================================================

import {
  Value,
  ValueKind,
  StructureValue,
  CarrierStructure,
  AllegroError,
  withMetadata,
} from "./types.js";
import { denseIndexGet, denseSlotCount, denseElements } from "./structure.js";

// --- Registry ------------------------------------------------------------------

/** Where the slot physically lives in the current representation. */
export type SlotStorage =
  | "context-binding"      // key in a StructureValue's bindings map
  | "js-property"          // JS expando property on a Value object
  | "metadata-field"         // named MultiValue component
  | "binding-name-prefix"  // synthetic evaluation-context binding-name family
  | "label-marker";        // magic substring inside an effect label

/** D39 disposition: what the slot becomes after the migration. */
export type SlotDisposition =
  | "member"        // symbol-keyed member declared on the owning kind
  | "metadata-field" // a registered field of the metadata plane (D23/D24)
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
  { name: "__refines", storages: ["context-binding"], owner: "Type", disposition: "member", target: "Type.refines" },
  { name: "__construct", storages: ["context-binding", "js-property"], owner: "Type", disposition: "member", target: "Type.construct", notes: "per-kind minting authority (D40 R2). C7.2a: the __constructor alias is EXECUTED — collapsed into this slot (generic types hold their applier here; one construction surface, D45)" },
  { name: "__getMember", storages: ["context-binding", "js-property"], owner: "Type", disposition: "member", target: "Type.fallbackMember" },
  { name: "__interface", storages: ["context-binding"], owner: "Type", disposition: "member", target: "Type.structural" },
  // __invariantsList — SWEPT at C6.3: no writer since C6.1b folded
  // invariants into refinement layers (`&` chains).
  { name: "__wraps", storages: ["context-binding"], owner: "Type", disposition: "member", target: "Type.wraps" },
  // __union — DELETED at B-104 chunk 2 with the union type itself. It never
  // held variants (it stored the integer 1 as an is-a-union marker), which is
  // the `__isGeneric` shape D39 already ruled: the flag IS the kind. Redesign
  // is B-105.

  // --- Refinement-type fields (on the type instance) -------------------------
  { name: "__predicate", storages: ["context-binding"], owner: "Refinement", disposition: "member", target: "predicate" },
  { name: "abstractDomain", storages: ["js-property"], owner: "Refinement", disposition: "member", target: "domain" },

  // --- GenericType fields — C7.2a EXECUTED (D39 checklist) ---------------------
  // __params → the `params` declared instance binding on generic types (the
  // GenericType kind holds the field descriptor); __isGeneric → DELETED (the
  // flag IS the kind: shape = GenericType); __constructor → collapsed into
  // the generic's `construct` slot (D45 one-surface). __args/__generic stay
  // as host-read instance data on applied concretes (member surface for
  // applied types consciously deferred — C7.2 ruling R1).
  { name: "genericParams", storages: ["js-property"], owner: "GenericType", disposition: "member", target: "params", notes: "on ComposedFunction; survives clones via subst/remapParams" },
  { name: "__args", storages: ["context-binding"], owner: "GenericType", disposition: "member", target: "args", notes: "C7.2a: host-read instance data on applied concretes; language surface deferred" },
  { name: "__generic", storages: ["context-binding"], owner: "GenericType", disposition: "member", target: "generic (constructor back-link)", notes: "C7.2a: host-read instance data on applied concretes; language surface deferred" },

  // --- Proof fields — EXECUTED at C6.3 (D39 checklist): the five proof
  // fields are plain instance-data bindings (proposition / reason /
  // counterexample / lhs / rhs) declared as Field members on the Proof
  // kind — no longer __-slots, so no registry rows. The discharged flag
  // stays a CHANNEL (kernel-private writer), never a field.

  // --- Effect fields -------------------------------------------------------------
  { name: "effectLabels", storages: ["js-property"], owner: "Effect", disposition: "member", target: "Effect.labels", notes: "C6.2 (D40): the instance IS its label set — Set<string>, empty for pure, null for opaque (top); the `kind`/`labels` data bindings are the declared-member view. Replaces the retired __effect_kind slot (D39: -> Effect.kind, checked off)" },
  { name: "effectBound", storages: ["js-property"], owner: "Effect", disposition: "member", target: "Effect instance label-set representation (dissolves at C6.2; the annotation-bound reading becomes derived)", notes: "D39 addendum, maintainer-ratified 2026-07: member for now; when Effect re-derives through the kind recipe an instance IS its label set, so the stored bound collapses into it" },
  // __effectvar: label markers + __effectVarParams side table — C7.2c
  // EXECUTED (D39): dissolved into the declared structure — `Param.effectVar`
  // references the Effect-kinded `genericParams` entry by name; the
  // variable's bare name rides inferred effect sets; concrete call sites
  // resolve by ordinary PE substitution. (The side table had no functional
  // reader since the F1-F3 walker deletion.)

  // --- Channels (D36 / D21–D24): value-plane metadata, not fields ---------------
  // __type — MOVED to the component plane at B-104 chunk 3. Shape storage
  // is now uniform: every value carries it as the `type` component (row
  // below), so there is one storage and no binding-plane special case. The
  // shape-vs-knowledge split (C3.1/D36) was always a READ-time computation
  // — `typeShape` walks `__refines`/`__members`/`__predicate`, all still
  // binding-plane — and is untouched by the move.
  { name: "__discharged", storages: ["context-binding"], owner: "discharged channel", disposition: "metadata-field", target: "discharged integrity channel (D21–D24; kernel-private writer)" },
  { name: "effectSet", storages: ["js-property"], owner: "effects channel", disposition: "metadata-field", target: "effects (F1 component made canonical)" },
  { name: "inferredEffects", storages: ["js-property"], owner: "effects channel", disposition: "metadata-field", target: "effects" },
  { name: "predicateSet", storages: ["js-property"], owner: "knowledge channel", disposition: "metadata-field", target: "knowledge (D36)" },
  { name: "lawBackings", storages: ["js-property"], owner: "proof kernel", disposition: "metadata-field", target: "knowledge (D2 roll-up: transitive law-backing set on proofs, B-091)" },

  // --- MultiValue meta (current channel plane) ------------------------------
  { name: "type", storages: ["metadata-field"], owner: "shape channel", disposition: "metadata-field", target: "shape (D36)" },
  { name: "error", storages: ["metadata-field"], owner: "error channel", disposition: "metadata-field", target: "error (viral propagation)" },
  { name: "effects", storages: ["metadata-field"], owner: "effects channel", disposition: "metadata-field", target: "effects" },
  { name: "predicates", storages: ["metadata-field"], owner: "knowledge channel", disposition: "metadata-field", target: "knowledge (D36)" },
  { name: "source", storages: ["metadata-field"], owner: "source channel", disposition: "metadata-field", target: "source (D47: originating AST; kernel-originated, drop, observe-tagged reads)" },
  { name: "domain", storages: ["metadata-field"], owner: "knowledge channel", disposition: "metadata-field", target: "knowledge (D36)" },
  { name: "bound", storages: ["metadata-field"], owner: "knowledge channel", disposition: "metadata-field", target: "knowledge (D36) — occurrence bound (C3.2 annotation boundary)" },
  { name: "exported", storages: ["metadata-field"], owner: "module system", disposition: "base-concept", target: "Binding.visibility (scope-binding attribute — EXECUTED at B-097 V1)", notes: "D39 addendum EXECUTED at B-097 V1 (2026-08): export-ness moved to Binding.visibility; the value-plane marker (and its `y = x` aliasing wart) is retired — nothing in the language writes this component any more. Channel registration retained solely as the writer-idiom example in the boundary battery." },
  { name: "arity", storages: ["metadata-field"], owner: "Function", disposition: "delete", target: "n/a — was write-only dead metadata; the write in wrapAsUntypedFunction was removed 2026-07", notes: "D39 addendum, maintainer-ratified 2026-07: never read anywhere in the repo; arity is derivable from Function[ParamTypes, ReturnType] where needed. Entry retained as the audit record" },
  { name: "warnings", storages: ["metadata-field"], owner: "warnings channel", disposition: "metadata-field", target: "warnings", notes: "documented in CLAUDE.md; currently unused in code" },
  { name: "source", storages: ["metadata-field"], owner: "source channel", disposition: "metadata-field", target: "source", notes: "documented in CLAUDE.md; currently unused in code" },

  // --- Base concepts, not slots -----------------------------------------------------
  { name: "__length", storages: ["context-binding"], owner: "Array", disposition: "base-concept", target: "numeric-structure slot count (D18)", notes: "B-104 chunk 2 audit — RETAINED, correcting the audit's own recommendation. Its one arbitrary writer (makeUnionType) is gone with unions, but the slot is NOT debris: `materializeView` emits it as part of the C4.2 legacy-view compatibility contract, pinned by the W6 dense-view-coherence invariant and by boundary tests asserting the view carries it. `denseSlotCount` is authoritative for dense structures and falls back to this binding for non-dense numeric ones. It is also the ONLY key isMetaSlotKey ever returns true for (1197 tests, 296 hits, nothing else) — so the partition test's entire remaining job is hiding this one derived slot from field walks" },
  { name: "__future_", storages: ["binding-name-prefix"], owner: "futures", disposition: "base-concept", target: "future cells (D33)", prefix: true },
  { name: "__bare_", storages: ["binding-name-prefix"], owner: "futures", disposition: "base-concept", target: "future cells (D33)", prefix: true },

  // --- Host-engine internals (never value slots) --------------------------------------
  { name: "channelWriterFor", storages: ["js-property"], owner: "channel plane", disposition: "host-internal", target: "n/a — brand on writer PrimitiveFunctions (C1.4); attenuation checks it" },
  { name: "partial", storages: ["js-property"], owner: "totality", disposition: "host-internal", target: "n/a — body-form metadata (C1.5b collapse); becomes a function-value channel entry at C4.x" },
  { name: "decreasesMetric", storages: ["js-property"], owner: "totality", disposition: "host-internal", target: "n/a — body-form metadata (C1.5b collapse)" },
  { name: "declaredEffectsAst", storages: ["js-property"], owner: "effects channel", disposition: "host-internal", target: "n/a — body-form metadata (C1.5b collapse)" },
  { name: "paramEffectPairs", storages: ["js-property"], owner: "Effect", disposition: "host-internal", target: "n/a — body-form metadata (C1.5b collapse)" },
  { name: "provenClauses", storages: ["js-property"], owner: "Proof", disposition: "host-internal", target: "n/a — body-form metadata (C1.5b collapse)" },
  { name: "compileMode", storages: ["js-property"], owner: "evaluator", disposition: "host-internal", target: "n/a", notes: "B-104 chunk 1: was registered as context-binding, but every reader and writer is a JS expando on the ctx object (`evaluator.ts` precompile flag, `scope.ts` chain probe) — there has never been a binding by this name. Storage corrected with the rename" },
  { name: "futureManager", storages: ["js-property"], owner: "futures", disposition: "host-internal", target: "n/a" },
  { name: "tailCall", storages: ["js-property"], owner: "evaluator", disposition: "host-internal", target: "n/a" },
  { name: "grammarValue", storages: ["js-property"], owner: "grammar2", disposition: "host-internal", target: "n/a" },
  { name: "grammarHandle", storages: ["js-property"], owner: "grammar2", disposition: "host-internal", target: "n/a" },
  { name: "grammarFragment", storages: ["js-property"], owner: "grammar2", disposition: "host-internal", target: "n/a" },
  // B-104 chunk 1: the `__grammar` / `__parse` PREFIX rows are retired. They
  // were registered when grammar metadata rode dunder-prefixed keys; the
  // three js-property members (grammarValue, grammarHandle, grammarFragment)
  // are registered by exact name above, and no binding by either prefix has
  // existed since. A prefix row that matches nothing is not inert — it
  // pre-approves every future `__grammar*` binding, hiding it from the W3
  // completeness walk. `__inline_grammar` (below) IS still a live binding
  // prefix and stays.
  { name: "__inline_grammar", storages: ["context-binding"], owner: "grammar2", disposition: "host-internal", target: "n/a", prefix: true },
  // B-104 chunk 2 — RECLASSIFIED. These four were registered as
  // `context-binding`; none of them is one, and no binding by any of these
  // names has ever existed. `__el_*` are local JS variables in the generated
  // Earley parser; `__start__`/`__error__` are `.name` properties on Earley
  // grammar-element objects there; `__anon_*` is a gensym'd precedence-LEVEL
  // name living in a grammar fragment's level table. Storage corrected to
  // `js-property`, which keeps the audit record while taking them out of the
  // W3 binding walk's pre-approved set — the `__el_`/`__anon_` PREFIX rows
  // were the same hazard removed for `__grammar`/`__parse` in chunk 1.
  // Renaming the first three means regenerating src/parser.ts; deferred with
  // the legacy Earley parser's retirement (maintainer ruling, B-104 Q3).
  { name: "__el_", storages: ["js-property"], owner: "Earley (generated parser)", disposition: "host-internal", target: "n/a — local variables in src/parser.ts", prefix: true },
  { name: "__start__", storages: ["js-property"], owner: "Earley (generated parser)", disposition: "host-internal", target: "n/a — element .name in src/parser.ts" },
  { name: "__error__", storages: ["js-property"], owner: "Earley (generated parser)", disposition: "host-internal", target: "n/a — element .name in src/parser.ts" },
  { name: "__anon_", storages: ["js-property"], owner: "grammar2 gensym", disposition: "host-internal", target: "n/a — precedence-level name in a grammar fragment", prefix: true },
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
export function isRegisteredFieldName(key: string): boolean {
  const r = EXACT.get(key);
  return !!r && r.storages.includes("metadata-field");
}

export function slotRegistration(key: string): SlotRegistration | undefined {
  return EXACT.get(key) ?? PREFIXES.find((r) => key.startsWith(r.name));
}

// --- Typed accessors (over the current representation) ---------------------------
//
// Read side landed with C1.1; write-side shims added in C1.2 for the
// call-site migration (C1.4 turns the origination sites into capability-
// gated writers on top of these). Accessors return the raw stored value —
// including MultiValue-wrapped types (types are typed) — plus `asStructure`
// to peel to the primary Context where the caller needs the shape itself.

// C4.2: dense structures (array contexts) only ever hold numeric element
// keys plus `__length` — every slot probe can answer WITHOUT materializing
// the legacy bindings view. Keeps type-slot probes on arbitrary values
// (auto-naming's hasShapeSlot, getName, …) off the materialization path.
function isDense(ctx: StructureValue): boolean {
  return (ctx as unknown as { dense?: unknown }).dense !== undefined;
}

function slotRead(ctx: StructureValue, name: string): Value | undefined {
  if (isDense(ctx)) return name === "__length" ? denseSlotCount(ctx) : undefined;
  return ctx.bindings.get(name)?.value as Value | undefined;
}

/* ---------------------------------------------------------------------------
 * THE BINDING WRITE DISCIPLINE (B-107(e); concepts.md §13)
 *
 * A structure holds its bindings twice, and the two copies are NOT aliases:
 * `slotWrite` and types-std's `addBinding` each construct TWO separate
 * `Binding` objects for one key — one in `bindings` (the lookup index) and
 * one in `bindingList` (the ordered enumeration view). Every write
 * discipline in the codebase follows from that single fact:
 *
 *   1. A WRITE goes to BOTH, or the two views disagree. This is the default
 *      and it is what `slotWrite` / `addBinding` do.
 *   2. An IN-PLACE MUTATION of a binding's `value` reaches only the view
 *      whose object it mutated. `renameInPlace` deliberately mutates the
 *      map's copy alone; the list's copy goes stale.
 *   3. A DELETE must mirror the write that created the entry, or a stale
 *      list entry survives the removal. `removeConstruct` mirrors;
 *      `removeName` and `removeRefines` do not, by design.
 *
 * (2) and (3) are safe TODAY for a reason that is not local to them: every
 * key they touch is a `__*` slot on a TYPE structure, and nothing walks a
 * type structure's `bindingList` as fields — measured, and the same finding
 * that showed `isMetaSlotKey` fires on exactly one key across the suite
 * (`__length`, B-104(f)). The exemption is circumstantial, not structural:
 * anything that starts enumerating type structures, or any of these keys
 * migrating to a user-visible name under B-104, removes it. Do not add a
 * fourth discipline — use (1) unless one of the two recorded reasons
 * applies, and say which.
 * ------------------------------------------------------------------------- */
function slotWrite(ctx: StructureValue, key: string, value: Value): void {
  ctx.bindings.set(key, { key, value });
  ctx.bindingList.push({ key, value });
}

/** Peel a carrier down to its Context primary, if that's what it is. */
export function asStructure(v: Value | null | undefined): StructureValue | null {
  if (!v) return null;
  const p = (v as { primary?: Value }).primary ?? v;
  return p && p.kind === ValueKind.Structure ? (p as StructureValue) : null;
}

// Type fields
// (named getName, not getTypeName — types-std.ts already exports a
// getTypeName with different semantics: value → type-name string)
export function getName(ctx: StructureValue): Value | undefined { return slotRead(ctx, "__name"); }
export function getMembers(ctx: StructureValue): Value | undefined { return slotRead(ctx, "__members"); }
export function getRefines(ctx: StructureValue): Value | undefined { return slotRead(ctx, "__refines"); }
export function getConstruct(ctx: StructureValue): Value | undefined { return slotRead(ctx, "__construct"); }
export function getFallbackMember(ctx: StructureValue): Value | undefined { return slotRead(ctx, "__getMember"); }
export function isInterfaceType(ctx: StructureValue): boolean { return !isDense(ctx) && ctx.bindings.has("__interface"); }
export function getInterfaceMarker(ctx: StructureValue): Value | undefined { return slotRead(ctx, "__interface"); }
export function getWraps(ctx: StructureValue): Value | undefined { return slotRead(ctx, "__wraps"); }

// Refinement fields
export function getPredicate(ctx: StructureValue): Value | undefined { return slotRead(ctx, "__predicate"); }
export function getAbstractDomain(ctx: StructureValue): any { return (ctx as any).abstractDomain; }

// GenericType fields
export function getGenericArgs(ctx: StructureValue): Value | undefined { return slotRead(ctx, "__args"); }
export function getGenericBackLink(ctx: StructureValue): Value | undefined { return slotRead(ctx, "__generic"); }

// Proof fields
export function getProposition(ctx: StructureValue): Value | undefined { return slotRead(ctx, "proposition"); }
export function getProofReason(ctx: StructureValue): Value | undefined { return slotRead(ctx, "reason"); }
export function getProofCounterexample(ctx: StructureValue): Value | undefined { return slotRead(ctx, "counterexample"); }
export function getEqLhs(ctx: StructureValue): Value | undefined { return slotRead(ctx, "lhs"); }
export function getEqRhs(ctx: StructureValue): Value | undefined { return slotRead(ctx, "rhs"); }

// Effect fields
export function getEffectLabels(ctx: StructureValue): Set<string> | null | undefined { return (ctx as any).effectLabels; }
export function getEffectBound(ctx: StructureValue): any { return (ctx as any).effectBound; }

// Base concepts
// C4.2: slot count and element reads are dense-aware — the dense region
// is authoritative when present; the `__length` slot / string-keyed map
// remain the fallback for non-dense numeric contexts.
export function getSlotCount(ctx: StructureValue): Value | undefined { return denseSlotCount(ctx); }
/** O(1) numeric element read (D18: arrays are numeric-keyed structures). */
export function indexGet(ctx: StructureValue, i: number): Value | undefined { return denseIndexGet(ctx, i); }
/** All elements of a numeric-keyed structure (dense fast path). */
export function elementsOf(ctx: StructureValue): Value[] { return denseElements(ctx); }
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

/** The dispatch shape of a type Context: walk `__refines` past
 *  member-transparent refinement layers. Identity on non-refined types. */
export function typeShape(t: StructureValue): StructureValue {
  let cur = t;
  for (let guard = 0; guard < 64; guard++) {
    if (slotRead(cur, "__predicate") === undefined) return cur;
    const parent = asStructure(slotRead(cur, "__refines"));
    if (!parent) return cur;
    const ownMembers = slotRead(cur, "__members");
    const parentMembers = slotRead(parent, "__members");
    if (ownMembers !== undefined && ownMembers !== parentMembers) return cur;
    cur = parent;
  }
  return cur;
}

/** E1 (B-027, §7/D37): the EQUALITY shape — walk the FULL `__refines`
 *  chain to the representation root, past preserve-lifted and method-layer
 *  refinements too (unlike `typeShape`, which stops at layers that mint
 *  their own member sets, because their overrides must run for dispatch).
 *  Refinements are knowledge and never separate equal values —
 *  `PositiveInt(5) == 5` even when PositiveInt lifts operators. `distinct`
 *  types mint NO refines edge (buildDistinctType skips the slot), so they
 *  stay their own equality shape: unequal to the parent until a coercion
 *  is declared (E2). */
export function equalityShape(t: StructureValue): StructureValue {
  let cur = typeShape(t);
  for (let guard = 0; guard < 64; guard++) {
    const parent = asStructure(slotRead(cur, "__refines"));
    if (!parent) return cur;
    cur = typeShape(parent);
  }
  return cur;
}

// --- Channel plane (read side) ------------------------------------------------------

/** Raw channel read on a value: MultiValue component lookup, plus the
 *  `discharged` Context-binding channel that still predates the component
 *  plane. Free of any authority, per D23 (reads are free).
 *
 *  C3.1: `shape` reads the computed dispatch shape (refinement layers
 *  walked off — identity for every non-refined type, including the
 *  meta-type reads on type values); `type` stays the raw stored view.
 *  Both answer from ONE stored value; the split is this computation, not
 *  two storages (B-104 chunk 3). */
export function metaReadRaw(v: Value, channel: string): Value | undefined {
  // C4.3b + B-104 chunk 3: the channel plane is universal, and `type` is
  // now on it for EVERY value — carriers, flattened records and bare type
  // Contexts alike. Contexts without channels have `meta` undefined
  // (lazy — plain contexts and scopes pay nothing).
  const comps = (v as CarrierStructure).meta as Map<string, Value> | undefined;
  if (comps !== undefined) {
    const comp = comps.get(channel);
    if (comp !== undefined) return comp as Value;
  }
  if (channel === "shape") {
    // One storage, two reads: `shape` is `type` with member-transparent
    // refinement layers walked off. A non-Structure raw (or none) answers
    // as itself — typeShape only applies to type Contexts.
    let raw = comps?.get("type") as Value | undefined;
    if (raw === undefined) {
      const ctx = asStructure(v);
      raw = ctx ? (ctx as unknown as CarrierStructure).meta?.get("type") as Value | undefined : undefined;
    }
    if (raw?.kind === ValueKind.Structure) return typeShape(raw as StructureValue);
    return raw;
  }
  if (channel === "type") {
    // A transparent scalar carrier answers through its primary's plane.
    const ctx = asStructure(v);
    return ctx ? (ctx as unknown as CarrierStructure).meta?.get("type") as Value | undefined : undefined;
  }
  if (channel === "discharged") {
    const c = asStructure(v);
    if (c) return slotRead(c, "__discharged");
  }
  return undefined;
}

// --- Write-side shims (C1.2) --------------------------------------------------------

// Type fields
export function setName(ctx: StructureValue, v: Value): void { slotWrite(ctx, "__name", v); }
export function setMembers(ctx: StructureValue, v: Value): void { slotWrite(ctx, "__members", v); }
export function setRefines(ctx: StructureValue, v: Value): void { slotWrite(ctx, "__refines", v); }
export function setConstruct(ctx: StructureValue, v: Value): void { slotWrite(ctx, "__construct", v); }
export function setFallbackMember(ctx: StructureValue, v: Value): void { slotWrite(ctx, "__getMember", v); }
export function markInterface(ctx: StructureValue, v: Value): void { slotWrite(ctx, "__interface", v); }
export function setWraps(ctx: StructureValue, v: Value): void { slotWrite(ctx, "__wraps", v); }
export function removeName(ctx: StructureValue): void { ctx.bindings.delete("__name"); }
/** In-place rename used by the auto-naming pass. Mutates the bindings-map
 *  entry ONLY — bindingList entries are separate objects and are
 *  deliberately left untouched, mirroring the pre-accessor behavior. */
export function renameInPlace(ctx: StructureValue, name: Value): void {
  const b = ctx.bindings.get("__name");
  if (b) b.value = name;
}

// Refinement fields
export function setPredicate(ctx: StructureValue, v: Value): void { slotWrite(ctx, "__predicate", v); }
export function setAbstractDomain(ctx: StructureValue, d: unknown): void { (ctx as any).abstractDomain = d; }

// GenericType fields (C7.2a: applied-concrete instance data, host-read)
export function setGenericArgs(ctx: StructureValue, v: Value): void { slotWrite(ctx, "__args", v); }
export function setGenericBackLink(ctx: StructureValue, v: Value): void { slotWrite(ctx, "__generic", v); }

// Proof fields
export function setProposition(ctx: StructureValue, v: Value): void { slotWrite(ctx, "proposition", v); }
export function setProofReason(ctx: StructureValue, v: Value): void { slotWrite(ctx, "reason", v); }
export function setProofCounterexample(ctx: StructureValue, v: Value): void { slotWrite(ctx, "counterexample", v); }
export function setEqLhs(ctx: StructureValue, v: Value): void { slotWrite(ctx, "lhs", v); }
export function setEqRhs(ctx: StructureValue, v: Value): void { slotWrite(ctx, "rhs", v); }

// Effect fields
export function setEffectLabels(ctx: StructureValue, labels: Set<string> | null): void { (ctx as any).effectLabels = labels; }
export function setEffectBound(ctx: StructureValue, d: unknown): void { (ctx as any).effectBound = d; }

// Base concepts

// Channel-plane writes. `writeShape` remains a plain shim (shape-dispatch
// integrity is C3.1's concern); the discharged channel is capability-gated
// below (C1.4) — its raw writers are module-private.
//
// B-104 chunk 3: shape is stored on the component plane, written IN PLACE.
// It cannot route through the registered channel writer: `buildWriter`
// derives a NEW value via `withMetadata`, and type Contexts are
// identity-sensitive (memoized generics, law registries, and the
// `typeShape(stored) === typeShape(expected)` reference test in
// types-std). All 24 call sites mint a fresh Context and stamp it, so an
// in-place component write is exactly the old binding write's contract.
export function writeShape(ctx: StructureValue, v: Value): void {
  const s = ctx as unknown as CarrierStructure;
  if (s.meta === undefined) s.meta = new Map<string, Value>();
  (s.meta as Map<string, Value>).set("type", v);
}
function writeDischarged(ctx: StructureValue, v: Value): void { slotWrite(ctx, "__discharged", v); }

// Presence checks
export function hasName(ctx: StructureValue): boolean { return !isDense(ctx) && ctx.bindings.has("__name"); }
export function hasShapeSlot(ctx: StructureValue): boolean { return (ctx as unknown as CarrierStructure).meta?.has("type") === true; }
export function hasDischarged(ctx: StructureValue): boolean { return !isDense(ctx) && ctx.bindings.has("__discharged"); }

// Set-only writes (bindings map, NO bindingList entry) — mirror the proof
// kernel's origination idiom in primitives.ts exactly. These are the
// chokepoints the C1.4 discharged-channel writer capability wraps.
function slotSet(ctx: StructureValue, key: string, value: Value): void {
  ctx.bindings.set(key, { key, value });
}
export function stampProposition(ctx: StructureValue, v: Value): void { slotSet(ctx, "proposition", v); }
function stampDischarged(ctx: StructureValue, v: Value): void { slotSet(ctx, "__discharged", v); }
export function stampProofReason(ctx: StructureValue, v: Value): void { slotSet(ctx, "reason", v); }
export function stampProofCounterexample(ctx: StructureValue, v: Value): void { slotSet(ctx, "counterexample", v); }
export function stampEqOperands(ctx: StructureValue, lhs: Value, rhs: Value): void {
  slotSet(ctx, "lhs", lhs);
  slotSet(ctx, "rhs", rhs);
}
/** E4 (E-R6): equality proofs record which equality they chained and
 *  which law tier backed it — plain instance-data bindings (the C6.3
 *  pattern), no new `__*` slots. */
export function stampLawBacking(ctx: StructureValue, equality: Value, lawName: Value, lawTier: Value): void {
  slotSet(ctx, "equality", equality);
  slotSet(ctx, "lawName", lawName);
  slotSet(ctx, "lawTier", lawTier);
}

/** D2 roll-up (B-091): the TRANSITIVE backing set a proof rests on —
 *  its own rule application's backing plus every input proof's set,
 *  unioned. Host-plane (js-property) storage, the `effectSet` /
 *  `predicateSet` pattern. The single E-R6 fields above remain the
 *  proof's OWN rule backing (they are dispatched instance fields —
 *  `p.lawTier`); this set is what the Verdict's assumption ledger
 *  aggregates, so a nested chain does not lose inner backings. */
export interface LawBackingRec { equality: string; law: string; tier: string }

export function backingsOf(ctx: StructureValue): LawBackingRec[] {
  return ((ctx as unknown as { lawBackings?: LawBackingRec[] }).lawBackings) ?? [];
}
export function stampBackings(ctx: StructureValue, recs: LawBackingRec[]): void {
  if (recs.length > 0) {
    (ctx as unknown as { lawBackings?: LawBackingRec[] }).lawBackings = recs;
  }
}
export function unionBackings(...sets: LawBackingRec[][]): LawBackingRec[] {
  const seen = new Set<string>();
  const out: LawBackingRec[] = [];
  for (const set of sets) {
    for (const r of set) {
      const k = `${r.equality}\x00${r.law}\x00${r.tier}`;
      if (!seen.has(k)) { seen.add(k); out.push(r); }
    }
  }
  return out;
}

// Slot-key constants — for the residual idioms (key filters in copy loops,
// bindingList lookups) that need the literal itself. Call sites use these
// instead of raw strings so the lint sees zero literals outside this module.
export const SLOT_KEYS = {
  name: "__name",
  members: "__members",
  refines: "__refines",
  construct: "__construct",
  getMember: "__getMember",
  interface: "__interface",
  wraps: "__wraps",
  predicate: "__predicate",
  args: "__args",
  generic: "__generic",
  discharged: "__discharged",
  proposition: "proposition",
  reason: "reason",
  counterexample: "counterexample",
  eqLhs: "lhs",
  eqRhs: "rhs",
} as const;

/** Host-plane (js-property) keys — registered as host-internal in the
 *  SLOT_REGISTRY. Call sites read them via scope.ts's chain-aware
 *  `scopeHostRead` using these constants, never raw literals. */
export const HOST_KEYS = {
  futureManager: "futureManager",
} as const;

/**
 * The "skip meta slots when copying user-visible bindings" test.
 *
 * THE PROPERTY THIS TEST RESTS ON (concepts.md §30, delta 30 — stated here
 * at C9; still unenforced): **the type-structure namespace is closed.** A
 * type structure's own bindings map holds engine slots only — a user field
 * named `name` is routed into `__members` under an FQN key and never lands
 * beside `__name`. That is why the `__*` partition was never load-bearing,
 * and why instrumenting this predicate across the whole suite returned true
 * for exactly one key (`__length`, 296 times; B-104(f)). It is currently an
 * accident of how members are written rather than an invariant anything
 * checks — the enforcement half belongs with B-104's retirement of the
 * partition, since a replacement that does not preserve this property would
 * be unsound and nothing would say so.
 */
export function isMetaSlotKey(key: string): boolean {
  return key.startsWith("__");
}

// Removal helpers (map + bindingList, mirroring the existing idiom exactly)
export function removeRefines(ctx: StructureValue): void { ctx.bindings.delete("__refines"); }
export function removeShapeSlot(ctx: StructureValue): void { (ctx as unknown as CarrierStructure).meta?.delete("type"); }
export function removeConstruct(ctx: StructureValue): void {
  ctx.bindings.delete("__construct");
  const idx = ctx.bindingList.findIndex((b) => b.key === "__construct");
  if (idx >= 0) ctx.bindingList.splice(idx, 1);
}

// --- Data plane -----------------------------------------------------------------------

/** Data-plane read (C4.3c: `primaryOf` retired — this is THE accessor).
 *  Identity for flattened Contexts and every non-scalar; unwraps the
 *  `primary` of a transparent scalar structure. */
import { dataOf } from "./types.js";
export { dataOf };

// --- Component plane (MultiValue) -------------------------------------------------------

/** Read-only view over a value's meta. C4.3b: the channel plane is
 *  universal — flattened Contexts (typed records/arrays) carry meta
 *  directly; values without a channel plane view as empty. */
export function metaOf(v: Value): ReadonlyMap<string, Value> {
  const comps = (v as CarrierStructure).meta as Map<string, Value> | undefined;
  return comps !== undefined ? comps : EMPTY_META;
}
const EMPTY_META: ReadonlyMap<string, Value> = new Map();

/** Mutable copy of a value's meta — the standard "carry meta
 *  forward onto a derived value" idiom. Empty map for channel-less values. */
export function cloneMeta(v: Value): Map<string, Value> {
  const comps = (v as CarrierStructure).meta as Map<string, Value> | undefined;
  return comps !== undefined ? new Map(comps) : new Map();
}

/**
 * Carry `from`'s metadata onto a value derived from it, and return the
 * derived value.
 *
 * This is the "map" case (B-121 plan §3.2): a NEW datum that must keep the OLD
 * metadata. It was not an obligation before B-121, because metadata lived on
 * the carrier WRAPPING a function rather than on the function itself — so a
 * hand-written function clone never had to think about it. Once metadata is on
 * the value, all seven such clones drop it silently, and the suite reports
 * that as `type_check: value has no type` from somewhere else entirely.
 *
 * Use this rather than writing `meta: x.meta` by hand: the failure mode of
 * forgetting is silence, the same shape as the TailCall sentinel (B-113) and
 * the ComposedFunction clone helper. It lives here, in the accessor layer,
 * because reading `.meta` directly is exactly what the boundary lint forbids
 * everywhere else.
 */
export function carryMeta<T extends Value>(from: Value, to: T): T {
  const m = (from as { meta?: Map<string, Value> }).meta;
  if (m !== undefined) (to as { meta?: Map<string, Value> }).meta = m;
  return to;
}

/** B-104 chunk 3: carry the shape from one type Context to a derived one.
 *
 *  Three type-cloning paths (`structuralWrap`, `preserveOps`,
 *  `buildMethodLayer`) used to inherit the meta-type for free, because the
 *  shape was a BINDING and they copy bindings. With shape on the component
 *  plane that inheritance is silent no longer — those clones would come out
 *  untyped. This is the explicit replacement; paths that re-stamp their own
 *  shape (`buildRefinedType`, `buildDistinctType`) do not need it. */
export function carryShape(from: StructureValue, to: StructureValue): void {
  const raw = (from as unknown as CarrierStructure).meta?.get("type") as Value | undefined;
  if (raw !== undefined) writeShape(to, raw);
}

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

export interface MetaFieldSpec {
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
export interface MetaFieldWriter {
  channel: string;
  write(target: Value, fieldValue: Value): Value;
}

interface MetaFieldEntry {
  spec: MetaFieldSpec;
  writer: MetaFieldWriter;
  /** evalSource pass in which an Allegro-minted channel was registered.
   *  The evaluation loop legitimately re-evaluates top-level bindings
   *  within one pass (fixpoint), so re-registration with an identical spec
   *  in the SAME epoch returns the held writer; any later pass throws —
   *  the capability belongs to whoever registered first. Kernel channels
   *  use epoch -1: they never re-issue. */
  epoch: number;
  minted: boolean;
}

const META_FIELD_TABLE = new Map<string, MetaFieldEntry>();
let metaEpoch = 0;

/** Called at the start of each evalSource pass (see runtime.ts). */
export function bumpMetaEpoch(): void { metaEpoch++; }

function buildWriter(spec: MetaFieldSpec): MetaFieldWriter {
  return {
    channel: spec.name,
    write(target: Value, fieldValue: Value): Value {
      if (spec.bindingKey) {
        if (target.kind !== ValueKind.Structure) {
          throw new AllegroError(`channel '${spec.name}': binding-plane write target must be a Context`);
        }
        if (spec.name === "discharged") stampDischarged(target as StructureValue, fieldValue);
        else slotSet(target as StructureValue, spec.bindingKey, fieldValue);
        return target;
      }
      const comps = cloneMeta(target);
      comps.set(spec.name, fieldValue);
      // withMetadata handles all three shapes: carrier primaries
      // re-wrap (W1), record primaries derive, leaves take the carrier.
      return withMetadata(dataOf(target), comps) as Value;
    },
  };
}

let _viralCache: string[] | null = null;
/** Component-plane channels with viral propagation (first occurrence wins,
 *  carried onto the result residual). Cached; registration invalidates. */
export function viralFields(): string[] {
  if (!_viralCache) {
    _viralCache = [...META_FIELD_TABLE.values()]
      .filter((e) => e.spec.rule === "viral" && !e.spec.bindingKey)
      .map((e) => e.spec.name);
  }
  return _viralCache;
}

let _unionCache: string[] | null = null;
/** Component-plane channels with union propagation (arg channels merged
 *  onto the result via the installed merge). */
export function unionFields(): string[] {
  if (!_unionCache) {
    _unionCache = [...META_FIELD_TABLE.values()]
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
export function registerMetaField(spec: MetaFieldSpec, minted = false): MetaFieldWriter {
  const existing = META_FIELD_TABLE.get(spec.name);
  if (existing) {
    // Same-pass re-evaluation of the SAME Allegro registration site: hand
    // back the held writer. Anything else is forgery vector F.
    if (existing.minted && minted && existing.epoch === metaEpoch && existing.spec.rule === spec.rule) {
      return existing.writer;
    }
    throw new AllegroError(`channel '${spec.name}' is already registered — the writer capability is held by its owner`);
  }
  if (spec.integrity && (spec.rule === "viral" || spec.rule === "union")) {
    throw new AllegroError(`channel '${spec.name}': integrity channels may not register fabricating propagation rules (viral/union) — D23`);
  }
  const writer = buildWriter(spec);
  META_FIELD_TABLE.set(spec.name, { spec, writer, epoch: minted ? metaEpoch : -1, minted });
  invalidatePropagationCaches();
  return writer;
}

export function metaFieldSpec(name: string): MetaFieldSpec | undefined {
  return META_FIELD_TABLE.get(name)?.spec;
}

/** TS-kernel writer acquisition. Discipline is the boundary lint: call sites
 *  outside the kernel modules (types-std.ts, primitives.ts) fail the suite.
 *  The writer is never exposed to Allegro — extension bindings do not
 *  include it, and Allegretto cannot construct a host closure (D24). */
export function kernelFieldWriter(name: string): MetaFieldWriter {
  const e = META_FIELD_TABLE.get(name);
  if (!e) throw new AllegroError(`no such channel: '${name}'`);
  return e.writer;
}

// --- Field registration: what the BASE owns ------------------------------------
//
// B-109(a) / concept-campaign C3 (2026-08). The base used to register eleven
// fields at module init, including the layers' own. R6/R11 say the base owns
// the MECHANISM and each layer owns ITS fields — so a field survives here only
// if the base concept it serves survives in Allegretto.
//
// That test was run rather than argued: `make_error("boom")` and `source of x`
// both work under `--base`, so `error` and `source` are Allegretto's own and
// stay. The six L2 fields moved to their owners:
//
//   shape, type   → src/types-std.ts    (the type system)
//   effects       → src/effects.ts      (the effects extension)
//   predicates,
//   domain, bound → src/refinements.ts  (refinement knowledge)
//   discharged    → src/proofs.ts       (the proof kernel)
//
// Three have NO owner to move to, and each is a B-111 finding rather than a
// relocation: `knowledge` is a capability whose storage is other fields and
// which nothing ever writes; `warnings` is registered `union` and unused
// (B-117 intends to reach for it when the verdict accumulates); `exported`
// was retired at B-097 V1 when visibility became a property of the Binding.
// They stay registered here, wrongly, until B-111 says what they are.

// D47 (B-094): drop — a derived value was not produced by the recorded
// expression, so propagating source would fabricate provenance. Kernel-
// originated (evaluator attachment only); reads via `source of` are
// observe-tagged (§3.1). Integrity added at B-109(c) — it had been in the old
// hardcoded name list while registered WITHOUT the flag, two sources of truth
// disagreeing about one field.
registerMetaField({ name: "source", rule: "drop", integrity: true });
registerMetaField({ name: "error", rule: "viral" });

// --- Fields with no owner yet (B-111) ------------------------------------------
// C3.1 (D36): `knowledge` is the canonical knowledge lattice — but nothing
// ever stores a `knowledge` value. Its physical storage IS `predicates` /
// `domain` plus the refinement layers of the stored type, and it is read
// through refinements.ts `knowledgeOf`. A capability, not a field.
registerMetaField({ name: "knowledge", rule: "computed" });
// Registered `union` — precisely the accumulating discipline the verdict
// needs — and never written. B-117.
registerMetaField({ name: "warnings", rule: "union" });
// Retired at B-097 V1 (D42/V-R4): visibility became a property of the BINDING,
// never of the value. The registration outlived the concept.
registerMetaField({ name: "exported", rule: "drop" });

/** Binding keys that only a channel writer may originate. User-reachable
 *  construction paths (object literals, mv_set) consult this. `source` is
 *  D47(d): forged provenance would let a doctored source channel display a
 *  different claim than the one checked — kernel-originated only. */
/**
 * Gate for user-reachable construction paths: throws if the key would
 * originate an integrity field without holding its writer.
 *
 * B-109(b)(c) (2026-08): authority is now read from the REGISTRY rather than
 * from a hardcoded name list. The old list was a second source of truth and
 * the two disagreed — `source` was in the list but registered WITHOUT
 * `integrity: true`.
 *
 * It also checked BARE FIELD NAMES, which conflated two planes. An object
 * literal writes the BINDING plane; it cannot originate a metadata field at
 * all — `{type: "widget"}` gives the record a `type` slot while `type of` it
 * still answers `Object`. So the bare-name check defended nothing and cost
 * users the field names `discharged` and `source`. What it must still refuse
 * is a binding-plane key that a field uses as its STORAGE (`__discharged`),
 * which is a real origination path, and those come from the registry too.
 */
function integrityBindingKeys(): Set<string> {
  const keys = new Set<string>();
  for (const entry of META_FIELD_TABLE.values()) {
    if (entry.spec.integrity && entry.spec.bindingKey) keys.add(entry.spec.bindingKey);
  }
  return keys;
}

export function assertNotIntegrityKey(key: string, site: string): void {
  if (integrityBindingKeys().has(key)) {
    throw new AllegroError(
      `${site}: cannot originate integrity channel '${key.replace(/^__/, "")}' — origination requires the channel writer (D21–D24)`
    );
  }
}

// --- Source channel (D47, B-094 chunk 1) --------------------------------------
//
// The `source` component carries the ORIGINATING Expression AST of a value —
// attached by the evaluator only (kernel-originated, D47(d)): at call sites
// of source-aware primitives, and on resolved top-level bindings whose data
// is not a Structure (Structure bindings — types, records, proofs — carry
// channels directly and are identity-sensitive; their attachment is the
// chunk-2+ audit). Rule `drop` (D47(c)); reads go through `source of`
// (`source_get`, observe-tagged, D47(e)) and render TEXT — the raw AST as a
// first-class user value needs an inert quote carrier, deferred until user
// meta-functions land.

export const SOURCE_FIELD = "source";

/** Kernel-internal: attach the originating AST to a value. Not exposed as a
 *  primitive — origination authority stays with the evaluator. */
export function withSource(v: Value, ast: Value): Value {
  const comps = cloneMeta(v);
  comps.set(SOURCE_FIELD, ast);
  return withMetadata(dataOf(v), comps) as Value;
}

/** Kernel-internal read of the source channel (free for kernel use; the
 *  LANGUAGE-level read is `source_get`, which carries the observe tag). */
export function sourceOf(v: Value): Value | undefined {
  return metaOf(v).get(SOURCE_FIELD);
}

/** Host-internal function-metadata properties preserved across
 *  ComposedFunction clones (subst/remapParams) — the C1.5b collapsed
 *  body-form metadata plus the PE effects stash. */
export const PRESERVED_FN_META_KEYS = [
  "partial", "decreasesMetric", "declaredEffectsAst",
  "paramEffectPairs", "provenClauses", "inferredEffects",
  // B-028 F3: the completion-discharge clauses (CE-R3).
  "total", "assumeTerminates",
] as const;

/** Brand for Allegro-level channel-writer PrimitiveFunctions (host-internal
 *  js-property; registered in SLOT_REGISTRY). Attenuation checks it. */
export const FIELD_WRITER_BRAND = "channelWriterFor";

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
const FIELD_MERGES = new Map<string, (a: Value, b: Value) => Value>();
export function installFieldMerge(name: string, merge: (a: Value, b: Value) => Value): void {
  FIELD_MERGES.set(name, merge);
}
export function fieldMerge(name: string): ((a: Value, b: Value) => Value) | undefined {
  return FIELD_MERGES.get(name);
}



/** List the channels present on a value (component keys + binding-plane channels).
 *  C4.3b: the channel plane is universal — flattened Contexts report their
 *  component keys alongside the legacy binding-plane channels. */
export function metaFieldList(v: Value): string[] {
  const out: string[] = [];
  const comps = (v as CarrierStructure).meta as Map<string, Value> | undefined;
  if (comps !== undefined) {
    out.push(...comps.keys());
  }
  if (v.kind === ValueKind.Structure) {
    const ctx = v as StructureValue;
    if (!isDense(ctx)) {
      if (ctx.bindings.has("__discharged") && !out.includes("discharged")) out.push("discharged");
    }
  }
  return out;
}
