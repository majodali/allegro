// =============================================================================
// Slot registry + typed accessors over the binding plane — the `structure`
// unit's accessor surface (docs/book/units.md §4.1 row 8; split out of
// slots.ts at B-112 C1, 2026-10).
//
// The D39 disposition table as code (design: docs/book/allegretto/
// structures.md §"Slot disposition" + Appendix A; decision log D39 archived
// at docs/plans/archive/structured-values-unification.md). Every `__*` slot and
// host-plane property in the codebase is registered here with its owner,
// disposition, and post-migration target. The boundary harness walks test-
// corpus values and fails on any unregistered `__*` key — the "no new `__*`
// slot" rule (D39) enforced mechanically.
//
// The typed accessors read and write engine-owned BINDING-plane slots on
// type, proof and effect structures. They know nothing of the metadata
// plane: `src/metadata.ts` owns that, and `src/capability.ts` owns the
// authority to write it. This module imports only the representation.
// =============================================================================

import {
  Value,
  ValueKind,
  StructureValue,
  makeInt,
} from "./types.js";
import { denseIndexGet, positionalCount, denseElements, setEntry, removeEntry } from "./structure.js";

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
  { name: "__length", storages: ["context-binding"], owner: "Array", disposition: "base-concept", target: "numeric-structure slot count (D18)", notes: "B-104 chunk 2 audit — RETAINED, correcting the audit's own recommendation. Its one arbitrary writer (makeUnionType) is gone with unions, but the slot is NOT debris: `materializeView` emits it as part of the C4.2 legacy-view compatibility contract, pinned by the W6 dense-view-coherence invariant and by boundary tests asserting the view carries it. `denseSlotCount` is authoritative for dense structures and falls back to this binding for non-dense numeric ones. It was also the ONLY key isMetaSlotKey ever returned true for (1197 tests, 296 hits, nothing else), so deleting it left the partition test with no job — B-104(b), taken at B-120 E5. DELETED at B-120 E4 with the dense region; this row is the audit record" },
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

// B-120 E4: `isDense` is deleted with the dense region. It guarded slot probes
// against materializing an array's legacy view — a view that no longer exists,
// for a region that is now the entry sequence itself. A probe on an array
// finds nothing because every entry is unkeyed, which is the same answer the
// guard used to short-circuit to.
//
// `__length` goes with it: an array's length is its entry count, read through
// `getSlotCount`, not a derived binding the view had to emit. That closes
// **B-104(f)**, and left `isMetaSlotKey` with no key it fires on — **B-104(b)**,
// taken at E5, which replaced it with `isMetaProtocolSlot`.

function slotRead(ctx: StructureValue, name: string): Value | undefined {
  return ctx.bindings.get(name)?.value as Value | undefined;
}

/* ---------------------------------------------------------------------------
 * THE BINDING WRITE DISCIPLINE (B-107(e); concepts.md §13)
 *
 * SUPERSEDED BY B-120 E1/E3, and rewritten here rather than marked. This
 * block described a structure holding its bindings TWICE — `slotWrite` and
 * types-std's `addBinding` each constructing two separate `Binding` objects
 * for one key — and the three disciplines that kept the copies in step.
 *
 * There is one store. `entries` is authoritative and `bindings` is a derived
 * view over it, so a write reaches both by construction and a removal cannot
 * leave a stale entry behind. The three disciplines are retired with their
 * subject: (1) is now unconditional, and (2) and (3) described hazards that
 * required a second copy to exist.
 *
 * What the old (2)/(3) exemption rested on is worth keeping, because it is
 * still only circumstantial: nothing walks a type structure's entries as
 * FIELDS. B-120 E5 re-measured it after `__length` was deleted — across 1202
 * tests the field-walk sites saw **748 distinct binding keys and not one
 * `__`-prefixed key**. That is a property of how members are written, not an
 * invariant anything checks, and **B-104** owns the enforcement half.
 * ------------------------------------------------------------------------- */
function slotWrite(ctx: StructureValue, key: string, value: Value): void {
  setEntry(ctx, key, value);
}

/** Narrow a value to a Context, or null if it is not one. */
export function asStructure(v: Value | null | undefined): StructureValue | null {
  if (!v) return null;
  return v.kind === ValueKind.Structure ? (v as StructureValue) : null;
}

// Type fields
// (named getName, not getTypeName — types-std.ts already exports a
// getTypeName with different semantics: value → type-name string)
export function getName(ctx: StructureValue): Value | undefined { return slotRead(ctx, "__name"); }
export function getMembers(ctx: StructureValue): Value | undefined { return slotRead(ctx, "__members"); }
export function getRefines(ctx: StructureValue): Value | undefined { return slotRead(ctx, "__refines"); }
export function getConstruct(ctx: StructureValue): Value | undefined { return slotRead(ctx, "__construct"); }
export function getFallbackMember(ctx: StructureValue): Value | undefined { return slotRead(ctx, "__getMember"); }
export function isInterfaceType(ctx: StructureValue): boolean { return ctx.bindings.has("__interface"); }
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
/** B-133: the positional-entry count, ALWAYS answered. Was
 *  `Value | undefined`, where `undefined` meant "not wholly positional" and
 *  two callers read it as "not an Array". */
export function getSlotCount(ctx: StructureValue): Value { return makeInt(positionalCount(ctx)); }

/** The same count as a plain number, for host-side callers that do arithmetic
 *  on it rather than handing it back to Allegro. */
export function slotCount(ctx: StructureValue): number { return positionalCount(ctx); }
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

// `typeShape` and `equalityShape`, the two walks over the refinement chain
// that the comment above describes, live in `src/refinements.ts` since
// B-112 C4: a refinement chain is that unit's structure, and the accessor
// layer encodes no L2 semantics. The `shape` read is an installed
// projection (`src/metadata.ts`, `installProjection`).

/** Read a registered binding-plane slot by its key — the storage of a
 *  metadata field that still lives on the binding plane (`bindingKey`
 *  in its registration). Generic on purpose: the metadata unit reads
 *  such a field through this without naming it (B-112 C4). */
export function readBindingSlot(ctx: StructureValue, key: string): Value | undefined {
  if (!isRegisteredSlotKey(key)) throw new Error(`readBindingSlot: '${key}' is not a registered slot`);
  return slotRead(ctx, key);
}
export function hasBindingSlot(ctx: StructureValue, key: string): boolean {
  return ctx.bindings.has(key);
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
export function removeName(ctx: StructureValue): void { removeEntry(ctx, "__name"); }
/** In-place rename used by the auto-naming pass.
 *
 *  B-120 E1: this used to mutate the map's `Binding` and leave the list's
 *  copy stale, which discipline (2) recorded and called circumstantially
 *  safe. One store means one object, so the mutation now reaches every
 *  reader. The write is in place because the auto-naming pass runs during
 *  construction, before the type Context escapes — the in-place rule
 *  (`src/structure.ts`), not an exception to it. */
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


// Presence checks
export function hasName(ctx: StructureValue): boolean { return ctx.bindings.has("__name"); }
export function hasDischarged(ctx: StructureValue): boolean { return ctx.bindings.has("__discharged"); }
/** The `discharged` field's binding-plane storage, read for the metadata
 *  plane's benefit (`metaReadRaw`); the write is the capability's. */
export function readDischargedSlot(ctx: StructureValue): Value | undefined { return slotRead(ctx, "__discharged"); }

// B-120 E1: these were SET-ONLY writes — the map, deliberately not the list —
// which is where the measured "map holds entries the list lacks" class came
// from (15 structures, all proof contexts: `proposition`, `__discharged`,
// `lhs`, `rhs`). With one store the distinction cannot be expressed, and it
// was never wanted for its own sake: it existed because writing both stores
// by hand was the thing callers kept getting wrong. They remain the
// chokepoints the C1.4 discharged-field writer capability wraps.
function slotSet(ctx: StructureValue, key: string, value: Value): void {
  setEntry(ctx, key, value);
}
/** A binding-plane field's STORAGE write — the chokepoint the capability
 *  layer's writer closures call for fields that predate the metadata plane
 *  (`discharged`). Not a user surface: origination authority is checked by
 *  the caller, which holds the writer. */
export function stampBindingSlot(ctx: StructureValue, key: string, value: Value): void { slotSet(ctx, key, value); }
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
 * The meta-protocol slots a type Context may expose BY NAME through member
 * dispatch (B-097 V-R1's narrowing: members come from `__members`, policy
 * hooks from registered slots, and a raw non-slot binding is not
 * name-reachable).
 *
 * B-120 E5 replaces `isMetaSlotKey` — `key.startsWith("__")` — with declared
 * membership. The prefix test was a partition over arbitrary user keys; this
 * is a closed set, so retiring the `__` convention (B-104) no longer has to
 * wait on it. Membership is listed rather than filtered on the prefix, which
 * is the point: the set is a declaration, not a naming convention.
 *
 * Narrower than the predicate it replaces, deliberately: the future-cell
 * binding-name prefixes (`__future_`, `__bare_`) are scope bookkeeping, never
 * meta-protocol slots, and were never dispatchable.
 */
const META_PROTOCOL_SLOTS: ReadonlySet<string> = new Set<string>([
  SLOT_KEYS.name, SLOT_KEYS.members, SLOT_KEYS.refines, SLOT_KEYS.construct,
  SLOT_KEYS.getMember, SLOT_KEYS.interface, SLOT_KEYS.wraps,
  SLOT_KEYS.predicate, SLOT_KEYS.args, SLOT_KEYS.generic, SLOT_KEYS.discharged,
]);

export function isMetaProtocolSlot(name: string): boolean {
  return META_PROTOCOL_SLOTS.has(name);
}

// Removal helpers — one store, so a removal cannot leave a stale entry
// behind. Discipline (3) is retired: there is no second view to mirror.
export function removeRefines(ctx: StructureValue): void { removeEntry(ctx, "__refines"); }
export function removeConstruct(ctx: StructureValue): void {
  removeEntry(ctx, "__construct");
}
