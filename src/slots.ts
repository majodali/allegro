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
} from "./types.js";

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
  { name: "__effectBound", storages: ["js-property"], owner: "Effect", disposition: "member", target: "Effect.bound", notes: "not named in D39's table; assigned by analogy to the refinement predicate/domain pair (Stage A bound on effect types) — flagged in C1.1 landing summary" },
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
  { name: "exported", storages: ["mv-component"], owner: "module system", disposition: "channel", target: "visibility/exports metadata", notes: "not named in D39's table; module-system marker — flagged in C1.1 landing summary" },
  { name: "arity", storages: ["mv-component"], owner: "Function", disposition: "member", target: "Function arity member", notes: "not named in D39's table; set on UntypedFunction wrappers — flagged in C1.1 landing summary" },
  { name: "warnings", storages: ["mv-component"], owner: "warnings channel", disposition: "channel", target: "warnings", notes: "documented in CLAUDE.md; currently unused in code" },
  { name: "source", storages: ["mv-component"], owner: "source channel", disposition: "channel", target: "source", notes: "documented in CLAUDE.md; currently unused in code" },

  // --- Base concepts, not slots -----------------------------------------------------
  { name: "__length", storages: ["context-binding"], owner: "Array", disposition: "base-concept", target: "numeric-structure slot count (D18)" },
  { name: "__future_", storages: ["binding-name-prefix"], owner: "futures", disposition: "base-concept", target: "future cells (D33)", prefix: true },
  { name: "__bare_", storages: ["binding-name-prefix"], owner: "futures", disposition: "base-concept", target: "future cells (D33)", prefix: true },

  // --- Host-engine internals (never value slots) --------------------------------------
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
// Read-side first (C1.1); write-side shims land with the channel writers
// (C1.4). Accessors return the raw stored value — including MultiValue-
// wrapped types (types are typed) — plus `asContext` to peel to the
// primary Context where the caller needs the shape itself.

function slotRead(ctx: ContextValue, name: string): Value | undefined {
  return ctx.bindings.get(name)?.value as Value | undefined;
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
export function isInterfaceType(ctx: ContextValue): boolean { return ctx.bindings.has("__interface"); }
export function getInvariants(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__invariantsList"); }
export function getWraps(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__wraps"); }
export function getVariants(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__union"); }

// Refinement fields
export function getPredicate(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__predicate"); }
export function getAbstractDomain(ctx: ContextValue): unknown { return (ctx as any).__abstractDomain; }

// GenericType fields
export function getGenericArgs(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__args"); }
export function getGenericBackLink(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__generic"); }
export function isGenericType(ctx: ContextValue): boolean { return ctx.bindings.has("__isGeneric"); }

// Proof fields
export function getProposition(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__proposition"); }
export function getProofReason(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__reason"); }
export function getProofCounterexample(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__counterexample"); }
export function getEqLhs(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__eq_lhs"); }
export function getEqRhs(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__eq_rhs"); }

// Effect fields
export function getEffectKind(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__effect_kind"); }
export function getEffectBound(ctx: ContextValue): unknown { return (ctx as any).__effectBound; }

// Base concepts
export function getSlotCount(ctx: ContextValue): Value | undefined { return slotRead(ctx, "__length"); }
export function isFutureBindingName(name: string): boolean { return name.startsWith("__future_"); }
export function isBareBindingName(name: string): boolean { return name.startsWith("__bare_"); }

// --- Channel plane (read side) ------------------------------------------------------

/** Raw channel read on a value: MultiValue component lookup, plus the two
 *  Context-binding channels (`__type`, `__discharged`) that predate the
 *  component plane. Free of any authority, per D23 (reads are free). */
export function channelReadRaw(v: Value, channel: string): Value | undefined {
  if (v.kind === ValueKind.MultiValue) {
    const comp = (v as MultiValueType).components.get(channel);
    if (comp !== undefined) return comp as Value;
  }
  if (channel === "shape" || channel === "type") {
    if (v.kind === ValueKind.MultiValue) return (v as MultiValueType).components.get("type") as Value | undefined;
    if (v.kind === ValueKind.Context) return slotRead(v as ContextValue, "__type");
  }
  if (channel === "discharged" && v.kind === ValueKind.Context) {
    return slotRead(v as ContextValue, "__discharged");
  }
  const ctx = asContext(v);
  if (ctx && (channel === "shape" || channel === "type")) return slotRead(ctx, "__type");
  return undefined;
}

/** List the channels present on a value (component keys + binding-plane channels). */
export function channelList(v: Value): string[] {
  const out: string[] = [];
  if (v.kind === ValueKind.MultiValue) {
    out.push(...(v as MultiValueType).components.keys());
  }
  if (v.kind === ValueKind.Context) {
    const ctx = v as ContextValue;
    if (ctx.bindings.has("__type")) out.push("shape");
    if (ctx.bindings.has("__discharged")) out.push("discharged");
  }
  return out;
}
