// =============================================================================
// The metadata plane — the `metadata` unit (docs/book/units.md §4.1 row 10;
// split out of slots.ts at B-112 C1, 2026-10).
//
// What a value carries ABOUT itself: the field registry (name, propagation
// rule, integrity), the propagation vocabulary SC-7 (viral / union / computed
// / positional / drop), the free reads (D23), the carry/clone idioms, the
// shape read, the base's own `source` field, and the installed-merge table
// the evaluator consults. This unit holds symbols and never meanings: it
// knows a field is `union` and asks the installed merge; it does not know
// what an effect set is.
//
// It does NOT mint authority. Registering a field returns a writer
// capability, and that is `src/capability.ts`'s job (D21–D24); this module
// exposes `defineMetaField` for it and nothing else creates entries.
// =============================================================================

import {
  Value,
  ValueKind,
  StructureValue,
  PrimitiveFunctionValue,
  ComposedFunctionValue,
  EvalFn,
  withMeta,
} from "./types.js";
import { asStructure, readBindingSlot, hasBindingSlot } from "./slot-accessors.js";

// --- Field registry (the table; minting is capability.ts) -----------------------

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

/** A held write capability for one field. For binding-plane fields the
 *  write mutates the target Context (origination on a fresh kernel value);
 *  for metadata-plane fields it returns a new value. Minted by
 *  `src/capability.ts`; the TYPE lives here because the table stores it
 *  and the gated installs below check it by identity. */
export interface MetaFieldWriter {
  channel: string;
  write(target: Value, fieldValue: Value): Value;
}

export interface MetaFieldEntry {
  spec: MetaFieldSpec;
  writer: MetaFieldWriter;
  /** evalSource pass in which an Allegro-minted field was registered.
   *  The evaluation loop legitimately re-evaluates top-level bindings
   *  within one pass (fixpoint), so re-registration with an identical spec
   *  in the SAME epoch returns the held writer; any later pass throws —
   *  the capability belongs to whoever registered first. Kernel fields
   *  use epoch -1: they never re-issue. */
  epoch: number;
  minted: boolean;
}

const META_FIELD_TABLE = new Map<string, MetaFieldEntry>();
let metaEpoch = 0;

/** Called at the start of each evalSource pass (see runtime.ts). */
export function bumpMetaEpoch(): void { metaEpoch++; }
export function currentMetaEpoch(): number { return metaEpoch; }

/** Insert a registration. Only `src/capability.ts` calls this: it is the
 *  one place a writer is minted, and the table never creates one itself. */
export function defineMetaField(entry: MetaFieldEntry): void {
  META_FIELD_TABLE.set(entry.spec.name, entry);
  invalidatePropagationCaches();
}
export function metaFieldEntry(name: string): MetaFieldEntry | undefined {
  return META_FIELD_TABLE.get(name);
}
export function metaFieldEntries(): IterableIterator<MetaFieldEntry> {
  return META_FIELD_TABLE.values();
}

export function metaFieldSpec(name: string): MetaFieldSpec | undefined {
  return META_FIELD_TABLE.get(name)?.spec;
}

let _viralCache: string[] | null = null;
/** Metadata-plane fields with viral propagation (first occurrence wins,
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
/** Metadata-plane fields with union propagation (arg fields merged
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

// --- Free reads (D23) ------------------------------------------------------------

// --- Channel plane (read side) ------------------------------------------------------

// --- Projection hook (B-112 C4, hook (c)) ---------------------------------------
//
// A projection is a field read that is COMPUTED from other fields rather
// than stored: `shape` is `type` with member-transparent refinement layers
// walked off. What a projection means is its channel's, so it is installed
// (gated on the projected field's writer, P4) and the base reads it by name
// without knowing how it is computed.

export type Projection = (v: Value, read: (v: Value, field: string) => Value | undefined) => Value | undefined;
const PROJECTIONS = new Map<string, Projection>();
/** Only `src/capability.ts` calls this, through the gated `installProjection`. */
export function defineProjection(name: string, project: Projection): void {
  PROJECTIONS.set(name, project);
}
export function projection(name: string): Projection | undefined {
  return PROJECTIONS.get(name);
}

/** Raw field read on a value. Free of any authority, per D23 (reads are
 *  free). Three sources, in order: the value's own `meta`; a registered
 *  field whose storage is still a binding-plane slot (`bindingKey`), read
 *  through the accessor layer; an installed projection. The base names no
 *  field here (B-112 C4): `shape` is the type system's projection over
 *  `type`, and the one binding-plane field is found through its
 *  registration. */
export function metaReadRaw(v: Value, channel: string): Value | undefined {
  // C4.3b + B-104 chunk 3: the channel plane is universal — every kind
  // carries `meta`; values carrying nothing have it undefined (lazy — plain
  // contexts and scopes pay nothing).
  const comps = v.meta as Map<string, Value> | undefined;
  if (comps !== undefined) {
    const comp = comps.get(channel);
    if (comp !== undefined) return comp as Value;
  }
  const bindingKey = META_FIELD_TABLE.get(channel)?.spec.bindingKey;
  if (bindingKey !== undefined) {
    const c = asStructure(v);
    if (c) return readBindingSlot(c, bindingKey);
    return undefined;
  }
  const project = PROJECTIONS.get(channel);
  if (project !== undefined) return project(v, metaReadRaw);
  return undefined;
}

/** Read-only view over a value's meta. C4.3b: the channel plane is
 *  universal — flattened Contexts (typed records/arrays) carry meta
 *  directly; values without a channel plane view as empty. */
export function metaOf(v: Value): ReadonlyMap<string, Value> {
  const comps = v.meta as Map<string, Value> | undefined;
  return comps !== undefined ? comps : EMPTY_META;
}
const EMPTY_META: ReadonlyMap<string, Value> = new Map();

/** Mutable copy of a value's meta — the standard "carry meta
 *  forward onto a derived value" idiom. Empty map for channel-less values. */
export function cloneMeta(v: Value): Map<string, Value> {
  const comps = v.meta as Map<string, Value> | undefined;
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

// --- Shape on the metadata plane (B-104 chunk 3) ----------------------------------

// Channel-plane writes. `writeShape` remains a plain shim (shape-dispatch
// integrity is C3.1's concern); the discharged channel is capability-gated
// below (C1.4) — its raw writers are module-private.
//
// B-104 chunk 3: shape is stored on the metadata plane, written IN PLACE.
// It cannot route through the registered field writer: `buildWriter` derives
// a NEW value via `withMeta`, and type Contexts are identity-sensitive
// (memoized generics, law registries, and the `typeShape(stored) ===
// typeShape(expected)` reference test in types-std).
//
// B-121 C7: this is the sanctioned case of THE IN-PLACE RULE, which
// `structure.ts` states in full — *write in place only while the value is
// provably unshared; after it escapes, derive*. The licence here is the
// second clause of that rule rather than an exception to it: all 24 call
// sites mint a fresh Context and stamp it before it escapes, so no other
// position can be holding the value when this runs.
export function writeShape(ctx: StructureValue, v: Value): void {
  if (ctx.meta === undefined) ctx.meta = new Map<string, Value>();
  (ctx.meta as Map<string, Value>).set("type", v);
}
export function hasShapeSlot(ctx: StructureValue): boolean { return ctx.meta?.has("type") === true; }
export function removeShapeSlot(ctx: StructureValue): void { ctx.meta?.delete("type"); }

/** B-104 chunk 3: carry the shape from one type Context to a derived one.
 *
 *  Three type-cloning paths (`structuralWrap`, `preserveOps`,
 *  `buildMethodLayer`) used to inherit the meta-type for free, because the
 *  shape was a BINDING and they copy bindings. With shape on the component
 *  plane that inheritance is silent no longer — those clones would come out
 *  untyped. This is the explicit replacement; paths that re-stamp their own
 *  shape (`buildRefinedType`, `buildDistinctType`) do not need it. */
export function carryShape(from: StructureValue, to: StructureValue): void {
  const raw = from.meta?.get("type") as Value | undefined;
  if (raw !== undefined) writeShape(to, raw);
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
  return withMeta(v, comps) as Value;
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

// --- Propagation table (C1.5) ---------------------------------------------------
//
// The evaluator consults these instead of hand-rolling per-field code.
// `viral` and `union` are fully generic; `computed` fields keep bespoke
// domain logic at the annotated evaluator sites (that is what "computed"
// means); `drop` fields never propagate — verified by forgery test C.
//
// MAINTAINER RULING (2026-08, C4.3a — activating the divergences deferred
// at C1.5): the principled rules are now live —
//  - effects on MultiValue re-evaluation merge by UNION via the installed
//    field merge (was inner-shadows-outer).
//  - error virality rides EVERY hop of a residual chain, including the
//    unresolved-application and type_dispatch residual paths (was dropped
//    after the first hop — see differential fixtures `err-viral-chain`,
//    `err-through-method`).
//  - an error-carrying `if` condition propagates the error
//    (`err-in-if-cond`; was silently taking the else branch).

/** Union-merge behavior per field, installed by the field's owner through
 *  the gated `installFieldMerge` in `src/capability.ts` (P4: an install is
 *  authority, so it needs the writer). This module holds the SYMBOL — the
 *  table — and the evaluator reads it by name; the meaning is the owner's. */
const FIELD_MERGES = new Map<string, (a: Value, b: Value) => Value>();
export function defineFieldMerge(name: string, merge: (a: Value, b: Value) => Value): void {
  FIELD_MERGES.set(name, merge);
}
export function fieldMerge(name: string): ((a: Value, b: Value) => Value) | undefined {
  return FIELD_MERGES.get(name);
}

// --- Check hook (B-112 C2, hook (b)) ------------------------------------------
//
// Checking an argument against a declared constraint is a DECISION the base
// must not make (P3): it holds the loop and the reader, each field's owner
// installs the check. Ruling 1 (plan §8.1): checks are not independent, so a
// check takes a total reader over fields and may consult any of them; the
// base never orders the loop by a dependency it knows about, so no check may
// rely on running after another.

/** What the base knows about the site: the argument's position, the
 *  parameter it binds (an opaque handle — a check may read host-plane
 *  bits the layer stamped on it), and an evaluator bound to the site's
 *  context when one exists (a check that must evaluate — a refinement
 *  predicate — uses it; without it the check is best-effort). */
export interface CheckSite {
  argIndex: number;
  param?: Value;
  evaluate?: (expr: Value) => Value;
}
export type FieldReader = (v: Value, field: string) => Value | undefined;
/** A field's installed check. Throws to reject; returns to accept. */
export type FieldCheck = (expected: StructureValue, actual: Value, read: FieldReader, site: CheckSite) => void;

const FIELD_CHECKS = new Map<string, FieldCheck>();
/** Only `src/capability.ts` calls this, through the gated `installFieldCheck`. */
export function defineFieldCheck(name: string, check: FieldCheck): void {
  FIELD_CHECKS.set(name, check);
}
export function fieldCheck(name: string): FieldCheck | undefined {
  return FIELD_CHECKS.get(name);
}
/** The installed checks, in registration order. The evaluator runs every
 *  one at a typed call site; the base does not know which field matters. */
export function fieldChecks(): IterableIterator<[string, FieldCheck]> {
  return FIELD_CHECKS.entries();
}

// --- Dispatch hook (B-112 C3, hook (a)) -----------------------------------------
//
// Type-directed dispatch during evaluation is a DECISION the base must not
// make (R2 says it must happen BY evaluating; R6 says the base must not know
// what a type is). A channel installs how to dispatch on its field, gated
// by the field's writer (P4). Ruling (maintainer, 2026-10-22): call-site
// unification rides the same install, because binding a callee's declared
// constraints to its arguments is the same activity seen from the call.

/** What the base gives a call binding: the check loop, so the installer
 *  can run every installed field check against the constraint it resolved
 *  for each argument without owning the loop. */
export interface CallSite {
  check(arg: Value, expected: StructureValue, argIndex: number, param: Value | undefined, ctx: StructureValue): void;
}
/** What a call binding gives back: the context the body evaluates in, the
 *  arguments as substituted, and a finisher applied to the body's result. */
export interface CallBinding {
  ctx: StructureValue;
  args: Value[];
  result(r: Value): Value;
}
export interface DispatchInstall {
  /** A primitive application. `residual` is non-null when some argument is
   *  unresolved and the base is about to return that residual: the
   *  dispatcher may type it. Otherwise the arguments are resolved and the
   *  dispatcher may answer instead of the primitive. Return null to decline;
   *  the base then proceeds as if nothing were installed. */
  primitive(fn: PrimitiveFunctionValue, args: Value[], ctx: StructureValue, evalFn: EvalFn, residual: Value | null): Value | null;
  /** A composed-function call. Return null when the callee declares no
   *  constraint this dispatcher knows. */
  call(fn: ComposedFunctionValue, fnRaw: Value, args: Value[], ctx: StructureValue, site: CallSite): CallBinding | null;
}

const DISPATCHERS = new Map<string, DispatchInstall>();
/** Only `src/capability.ts` calls this, through the gated `installDispatch`. */
export function defineDispatch(name: string, d: DispatchInstall): void {
  DISPATCHERS.set(name, d);
}
export function dispatchFor(name: string): DispatchInstall | undefined {
  return DISPATCHERS.get(name);
}
/** The installed dispatchers, in registration order. With none installed
 *  (Allegretto alone) every primitive runs as itself: declining is the
 *  base's own behaviour, not an error. */
export function dispatchers(): IterableIterator<[string, DispatchInstall]> {
  return DISPATCHERS.entries();
}

// --- Analysis hook (B-112 C5, ruling 2 option (a)) ------------------------------
//
// The reverse crossing: a unit low in the DAG (the equality-law gate in
// type-core) needs the RESULT of an analysis that only a higher unit can
// compute (effect inference in the type primitives; divergence in the
// pipeline). No import can express that without inverting the order, so
// the producer INSTALLS the answer under a question about a field, gated
// on that field's writer (P4), and the consumer reads it by name. Two
// questions exist today, both about `effects`: `inferred` (what effects
// does this function have?) and `diverges` (may it diverge?).

export type Analysis = (fn: Value, ctx?: StructureValue) => unknown;
const ANALYSES = new Map<string, Analysis>();
/** Only `src/capability.ts` calls this, through the gated `installAnalysis`. */
export function defineAnalysis(channel: string, question: string, answer: Analysis): void {
  ANALYSES.set(`${channel}:${question}`, answer);
}
/** The installed answer to `question` about `channel`'s field, or
 *  undefined when no producer has installed one. A consumer that needs
 *  the answer errors on undefined rather than guessing. */
export function analysisOf(channel: string, question: string): Analysis | undefined {
  return ANALYSES.get(`${channel}:${question}`);
}

/** List the fields present on a value (metadata keys + binding-plane fields).
 *  C4.3b: the metadata plane is universal — flattened Contexts report their
 *  keys alongside the legacy binding-plane fields. */
export function metaFieldList(v: Value): string[] {
  const out: string[] = [];
  const comps = v.meta as Map<string, Value> | undefined;
  if (comps !== undefined) {
    out.push(...comps.keys());
  }
  if (v.kind === ValueKind.Structure) {
    const ctx = v as StructureValue;
    for (const entry of META_FIELD_TABLE.values()) {
      const key = entry.spec.bindingKey;
      if (key !== undefined && hasBindingSlot(ctx, key) && !out.includes(entry.spec.name)) out.push(entry.spec.name);
    }
  }
  return out;
}
