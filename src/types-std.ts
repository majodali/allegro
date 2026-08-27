// =============================================================================
// Allegro Standard — Core Type Definitions
// Defines Int and String types as Context values with method bindings.
// Types are attached to values as MultiValue "type" components.
// =============================================================================

import { isCarrier } from "./structure.js";
import {
  Value, ValueKind, BitsValue, ContextValue, MultiValueType, PrimitiveFnImpl, PrimitiveFunctionValue,
  ComposedFunctionValue, EvalFn,
  makeInt, makeFloat, bitsToFloat, makeBits, makePrimitive, makeExpr, makeContext, makeMultiValue, makeDenseArrayCtx,
  makeComposedFn, makeParam,
  stringToBits, bitsToString, AllegroError, isResolved,
  Extension,
} from "./types.js";
import { domainFromPredicate, PredicateSet, withPredicates as rfWithPredicates, Predicate, occurrenceBoundOf, withOccurrenceBound, clearOccurrenceBound } from "./refinements.js";
import { kernelMemberFqn, fqnBaseName, memberFqnIn, newTypeMemberScope, typeMemberScopeFqn, FQN_SEP } from "./symbols.js";
import { scopePrivilegeExtend, scopeHoldsPrivilege, scopeLookup } from "./scope.js";
import { effectsOf as fnEffectsOf } from "./effects.js";
import {
  getName, getMembers, getRefines, getConstruct, getInterfaceMarker, getPredicate,
  getGenericArgs, getGenericBackLink,
  getSlotCount, getAbstractDomain, getEffectLabels, setEffectLabels, getEffectBound, indexGet, elementsOf,
  setName, setMembers, setRefines, setConstruct, setFallbackMember, markInterface,
  setWraps, setPredicate, setGenericArgs,
  setGenericBackLink, setProposition,
  setEffectBound, setAbstractDomain,
  writeShape, removeName, removeRefines, removeShapeSlot, kernelChannelWriter, assertNotIntegrityKey,
  removeConstruct, channelReadRaw, cloneComponents, SLOT_KEYS, isMetaSlotKey, dataOf, typeShape, getFallbackMember,
  equalityShape, asContext,
} from "./slots.js";


// --- Constants ---

/** Meta-method names that should NOT be copied into new types during define/interface.
 *  C6.1b: the fluent names (where/interface/preserveOps/mixin/invariant)
 *  left with the fluent API; the surviving kind API is small. */
const META_METHOD_NAMES = new Set([
  "instanceof", "subtypeof", "define", "distinct",
]);

// --- Helpers ---

/** Get the type channel from a value. C4.3b: total — flattened Contexts
 *  (typed records/arrays) answer through their component plane, and bare
 *  type Contexts answer their meta-type through the `__type` binding-plane
 *  fallback (so `getType(IntType)` is `Type`, where it was null before the
 *  flatten — type values and typed values read uniformly). */
export function getType(v: Value): ContextValue | null {
  const t = channelReadRaw(v, "type");
  if (t && t.kind === ValueKind.Structure) return t;
  return null;
}

/** Get the type name from a value's type component */
export function getTypeName(v: Value): string | null {
  const t = getType(v);
  if (!t) return null;
  const nameV = getName(t);
  if (!nameV || nameV.kind !== ValueKind.Bits) return null;
  return bitsToString(nameV);
}

/** Wrap a raw value with a type component.
 *
 *  C3.1 (D36): SHAPE IS FIXED AT CONSTRUCTION — this writer (the type
 *  channel's origination chokepoint, per the C1.4 scoping note) refuses to
 *  re-stamp a value with a type of a DIFFERENT shape. Same-shape re-stamps
 *  are knowledge re-bounds (refinement certificate tagging at
 *  construction, preserveOps result re-tagging) and remain legal. */
export function withType(v: Value, type: ContextValue): Value {
  const primary = dataOf(v);
  // C4.3b: cloneComponents is total — a flattened Context's channels carry
  // forward (and its prior type makes the shape guard live for Contexts;
  // construction-point re-tags use withTypeReplacing).
  const components = cloneComponents(v);
  const prior = components.get("type");
  if (prior !== undefined && prior !== (type as Value)
      && prior.kind === ValueKind.Structure && type?.kind === ValueKind.Structure) {
    const priorShape = typeShape(prior as ContextValue);
    const newShape = typeShape(type);
    if (priorShape !== newShape) {
      throw new AllegroError(
        `withType: shape is fixed at construction — cannot re-stamp a value of shape ` +
        `'${typeContextName(priorShape) ?? "<anonymous>"}' with '${typeContextName(newShape) ?? "<anonymous>"}'`,
      );
    }
  }
  components.set("type", type);
  return makeMultiValue(primary, components);
}

/** C3.2 (D36): annotation-boundary crossing. Called AFTER the type check
 *  passes, with the declared (annotation) type. Sets the new occurrence's
 *  starting knowledge:
 *   - declared type WIDER than the value's shape (a Dog crossing
 *     `x: Animal`) → stamp the occurrence bound; member AVAILABILITY
 *     follows it until narrowed, dispatch stays on the shape.
 *   - declared type of the value's OWN shape → reset (clear any inherited
 *     bound; the new occurrence has full knowledge of the declared type).
 *  Bounds are member-availability constructs, so only named nominal
 *  concrete types participate: Any, function types, Effect annotations,
 *  interfaces (structural), unions, and generics are pass-throughs.
 *  Intrinsic knowledge (certificates, predicates) is never touched —
 *  effective knowledge is the meet, so a looser annotation cannot erase
 *  what construction certified. */
export function applyBoundaryBound(v: Value, expected: ContextValue): Value {
  // C4.3b: flattened records answer Context — the C3.2 availability gate
  // applies to them too (they're exactly the values annotation bounds
  // matter most for). Other kinds (Bits, functions, residuals) pass their
  // typed MultiValue form through as before.
  if (v.kind !== ValueKind.Structure) return v;
  const name = typeContextName(expected);
  if (!name || name === "Any" || name === "Function" || name === "UntypedFunction") return v;
  if (getEffectBound(expected) !== undefined) return v;
  if (getEffectLabels(expected) !== undefined) return v;
  if (getInterfaceMarker(expected) !== undefined) return v;
  if (isGenericType(expected) || getGenericArgs(expected) !== undefined) return v;
  const stored = getType(v);
  if (!stored) return v;
  if (typeShape(stored) === typeShape(expected)) {
    return occurrenceBoundOf(v) ? clearOccurrenceBound(v) : v;
  }
  return withOccurrenceBound(v, expected);
}

/** Construction-time type replacement — the literal-typing / coercion
 *  path. `typeLiterals` provisionally guesses every 64-bit literal as Int;
 *  the `typed_*` wrappers are the literal's REAL construction point and
 *  replace the guess outright (e.g. an 8-character string literal arrives
 *  Int-guessed and leaves String). Non-type components (error, effects,
 *  predicates) are preserved. Post-construction code uses `withType`,
 *  which refuses cross-shape re-stamps (C3.1, D36). */
export function withTypeReplacing(v: Value, type: ContextValue): Value {
  const primary = dataOf(v);
  const components = cloneComponents(v);
  components.set("type", type);
  return makeMultiValue(primary, components);
}

/** Get the __name from a type Context directly (not from a typed value) */
export function typeContextName(v: Value): string | null {
  // dataOf peels a carrier (whose primary is never a Context — W1) and is
  // identity for the bare type Contexts this reads.
  const ctx = dataOf(v);
  if (ctx.kind !== ValueKind.Structure) return null;
  const nv = getName(ctx as ContextValue);
  if (nv?.kind === ValueKind.Bits) return bitsToString(nv);
  return null;
}

/** Look up a method implementation on a type Context via __members.
 *  Returns the PrimitiveFunctionValue (or other callable) for Method descriptors,
 *  or the raw value for direct bindings (backward compat during transition). */
export function typeMethod(type: ContextValue, name: string): Value | null {
  // First: check __members for a Method descriptor. C5.2a: member sets are
  // SYMBOL-KEYED (stored under the member symbol's FQN string; interning
  // makes string-key identity symbol identity). The base name projects
  // through the kernel scope — every member registers there during C5.2a,
  // so the projection is deterministic (ruling R5); C5.2b generalizes to
  // drawn/type-local scopes via projectBaseName.
  const membersV = getMembers(type);
  if (membersV?.kind === ValueKind.Structure) {
    const descV = memberBindingByName(membersV as ContextValue, name);
    if (descV?.kind === ValueKind.Structure) {
      const desc = descV as ContextValue;
      // For Method descriptors, return the implementation
      const valueBinding = desc.bindings.get("value");
      if (valueBinding?.value) return valueBinding.value;
      // For Field descriptors, return null (fields are not methods)
      return null;
    }
  }
  // Fallback: direct binding lookup — B-097 V2 (V-R1): NARROWED to
  // registered meta-protocol slots (__getMember and friends). A raw
  // non-slot binding on a type Context is no longer name-reachable
  // through dispatch; members come from __members, policy hooks from
  // registered slots. (Pre-V2 any stray binding leaked through.)
  if (!isMetaSlotKey(name)) return null;
  const binding = type.bindings.get(name);
  if (!binding || binding.value === undefined) return null;
  return binding.value;
}

/** B-097 V2 (D36/C3.2, extracted for V-R1): the availability gate —
 *  an occurrence bound (annotation knowledge) determines which members
 *  this occurrence may refer to; a member that resolves still
 *  dispatches through the SHAPE (Liskov). Shared by type_dispatch
 *  (dot/bracket/interpolation), the meta-type dispatch path, and
 *  operator dispatch (the formerly deferred C3.2 item). Open types are
 *  exempt: base Object, and fallback-only types whose hook IS their
 *  policy (module objects). Throws on an unavailable member. */
export function assertMemberAvailable(
  obj: Value,
  fieldName: string,
  storedType: ContextValue | null,
): void {
  const bound = occurrenceBoundOf(obj);
  if (!bound || bound === storedType) return;
  if (bound === (dataOf(ObjectType as unknown as Value) as ContextValue)) return;
  const boundMembers = getMembers(bound);
  const membersEmpty = !boundMembers ||
    (boundMembers.kind === ValueKind.Structure && (boundMembers as ContextValue).bindings.size === 0);
  const openType = membersEmpty && getFallbackMember(bound) !== undefined;
  if (openType) return;
  const visible = typeMemberDescriptor(bound, fieldName) !== null
    || typeMethod(bound, fieldName) !== null;
  if (!visible) {
    const boundName = typeContextName(bound) ?? "<anonymous>";
    const shapeName = getTypeName(obj) ?? "<unknown>";
    throw new AllegroError(
      `type_dispatch: '${fieldName}' is not available through annotation '${boundName}' ` +
      `(the value's type is '${shapeName}') — narrow with \`when … is ${shapeName}\``,
    );
  }
}

/** B-097 V3 (D41 stage 3, D42/D43): the KERNEL MEDIATION check — a
 *  member declared `private` resolves only for contexts holding the
 *  declaring type's member privilege (planted by dispatch when it
 *  evaluates the type's own member bodies — the D42 possession test:
 *  the member symbol stays in the type-local member scope, so only
 *  evaluation extended from that scope reaches it). Pure, folds at PE
 *  time — denial is static when scope + knowledge are static (V-R8).
 *  Shared by dot/bracket/interpolation dispatch, operator dispatch, and
 *  destructuring. No-op for types without private members (hot path:
 *  one property read). */
export function assertMemberReachable(
  type: ContextValue,
  fieldName: string,
  ctx: ContextValue | undefined,
  desc?: ContextValue | null,
): void {
  if (!(type as any).hasPrivateMembers) return;
  const d = desc !== undefined ? desc : typeMemberDescriptor(type, fieldName);
  if (!d || !isPrivateDescriptor(d)) return;
  if (ctx && scopeHoldsPrivilege(ctx, type)) return;
  const typeName = getTypeNameFromCtx(type) ?? "<anonymous>";
  throw new AllegroError(`'${fieldName}' is private to '${typeName}'`);
}

/** B-097 V3: the evaluation context a type's OWN member bodies run in —
 *  the call-site chain plus the type's privilege layer, minted only for
 *  types that declare private members (everyone else: the ctx as-is,
 *  zero allocation). */
export function typePrivilegedCtx(type: ContextValue, ctx: ContextValue): ContextValue {
  if (!(type as any).hasPrivateMembers) return ctx;
  return scopePrivilegeExtend(ctx, type);
}

/** C6.1a: the member-set write chokepoint — stores the descriptor under
 *  the member symbol's FQN key in the DECLARING TYPE's OWN scope (per-type
 *  name-stable scopes; the shared kernel scope made cross-built-in
 *  conformance accidental under symbol membership). `addBinding` remains
 *  for descriptor internals and non-member contexts. */
function addMember(members: ContextValue, scopeFqn: string, baseName: string, desc: Value): void {
  addBinding(members, memberFqnIn(scopeFqn, baseName), desc);
  (members as any).memberNameIndex = undefined;
}

/** Lazy base-name index on a member set (JS-side cache field, like
 *  `predicateSet`'s precedent). Sound because member sets are
 *  populated fully during construction before the first lookup and are
 *  never mutated after (derived types clone into fresh sets). */
function memberNameIndex(members: ContextValue): Map<string, Value[]> {
  const cached = (members as any).memberNameIndex as Map<string, Value[]> | undefined | null;
  if (cached) return cached;
  const idx = new Map<string, Value[]>();
  for (const [key, b] of members.bindings) {
    if (b.value === undefined) continue;
    const base = fqnBaseName(key);
    const arr = idx.get(base);
    if (arr) arr.push(b.value);
    else idx.set(base, [b.value]);
  }
  (members as any).memberNameIndex = idx;
  return idx;
}

/** C5.2b (D30): DRAW-FROM resolution at member declaration time. A member
 *  declared on a type under construction binds its symbol by projecting
 *  the base name against the DRAWN contexts (parent type / base / drawn
 *  interfaces):
 *    - exactly one distinct target  → bind THAT symbol (override /
 *      implement keeps the drawn member's identity);
 *    - zero targets                 → a TYPE-LOCAL symbol in the type's
 *      own member scope;
 *    - several distinct targets     → error (the §5 rule: explicit
 *      resolution required; a member multi-bound to one descriptor
 *      dedupes to one target and stays legal).
 *  Returns the storage KEYS (bound symbols' FQNs). C6.1b order ruling:
 *  bundle order in a define call is NOT significant — when one target is
 *  multi-bound under several drawn symbols, the declaration binds ALL of
 *  them (instead of an order-dependent pick); distinct targets error. */
function drawMemberKeys(drawnContexts: ContextValue[], baseName: string, localScope: string): string[] {
  const matches = new Map<string, Value | undefined>(); // key → descriptor (target)
  // B-097 V3 (V-R6): a foreign PRIVATE member is not drawable — its
  // symbol stays with the defining type. A base-name match on one is an
  // explicit denial (names are public; a silent fresh-symbol mint would
  // read as an override and be a semantic trap).
  let privateOwner: string | null = null;
  for (const drawn of drawnContexts) {
    const membersV = getMembers(drawn);
    if (membersV?.kind !== ValueKind.Structure) continue;
    for (const [key, b] of (membersV as ContextValue).bindings) {
      if (fqnBaseName(key) !== baseName) continue;
      if (b.value?.kind === ValueKind.Structure && isPrivateDescriptor(b.value as ContextValue)) {
        privateOwner = getTypeNameFromCtx(drawn) ?? "<anonymous>";
        continue;
      }
      matches.set(key, b.value);
    }
  }
  if (matches.size === 0 && privateOwner !== null) {
    throw new AllegroError(
      `member '${baseName}' is private to '${privateOwner}' — a foreign type cannot draw it`,
    );
  }
  if (matches.size === 0) return [memberFqnIn(localScope, baseName)];
  if (matches.size === 1) return [...matches.keys()];
  // Distinct KEYS may still be one TARGET (multi-bound descriptor).
  const targets = new Set(matches.values());
  if (targets.size === 1) return [...matches.keys()];
  throw new AllegroError(
    `member '${baseName}' matches multiple distinct drawn members (${[...matches.keys()].join(", ")}) — explicit resolution required`,
  );
}

/** C5.2b: store a descriptor under an explicit (draw-resolved) key.
 *  Invalidates the lazy name index — construction-time lookups (mixin's
 *  conflict check) may have built it on a partial set. */
function addMemberAt(members: ContextValue, key: string, desc: Value): void {
  addBinding(members, key, desc);
  (members as any).memberNameIndex = undefined;
}

/** C5.2b: base-name member lookup over a member set — kernel fast path
 *  (built-in members, the hot dispatch case), then a projection scan for
 *  drawn/type-local symbols. Multi-bound keys dedupe by descriptor
 *  identity; several DISTINCT targets under one base name is the §5
 *  ambiguity error at the access surface. */
function memberBindingByName(members: ContextValue, name: string): Value | undefined {
  // C6.1a: the kernel fast path retired with the shared kernel scope; the
  // lazy name index keeps dispatch O(1) per lookup.
  const hits = memberNameIndex(members).get(name);
  if (!hits || hits.length === 0) return undefined;
  if (hits.length === 1) return hits[0];
  let found: Value | undefined;
  for (const v of hits) {
    if (found === undefined) found = v;
    else if (found !== v) {
      throw new AllegroError(
        `member '${name}' is ambiguous — multiple distinct targets; explicit qualification required`,
      );
    }
  }
  return found;
}

/** C6.1a: re-key a type's TYPE-LOCAL member symbols onto a name-stable
 *  scope at auto-naming time. Counter scopes give per-construction
 *  identity, but evalSource's fixpoint may re-evaluate a type
 *  declaration — the same declaration must yield the SAME member symbols
 *  or conformance between captures of different passes fails (the old
 *  name-string walk masked this; symbol identity exposes it). Runs at
 *  the binding step, before anything external draws the keys; drawn
 *  (non-local) keys are untouched. */
export function stabilizeTypeMemberScope(typeCtx: ContextValue, stableScope: string): void {
  const local = (typeCtx as any).localMemberScope as string | undefined;
  if (!local || local === stableScope) return;
  const membersV = getMembers(typeCtx);
  if (membersV?.kind !== ValueKind.Structure) return;
  const members = membersV as ContextValue;
  const renames: [string, string][] = [];
  for (const key of members.bindings.keys()) {
    if (key.startsWith(local + FQN_SEP)) {
      renames.push([key, memberFqnIn(stableScope, fqnBaseName(key))]);
    }
  }
  for (const [oldK, newK] of renames) {
    const bnd = members.bindings.get(oldK)!;
    members.bindings.delete(oldK);
    members.bindings.set(newK, { key: newK, value: bnd.value });
    for (const e of members.bindingList) {
      if (e.key === oldK) (e as { key: string }).key = newK;
    }
  }
  (members as any).memberNameIndex = undefined;
  (typeCtx as any).localMemberScope = stableScope;
}

/** Read-side projection view for consumers that iterate members by base
 *  name (tests, tooling): baseName → descriptor. */
export function memberDescriptorsOf(type: ContextValue): Map<string, ContextValue> {
  const out = new Map<string, ContextValue>();
  const membersV = getMembers(type);
  if (membersV?.kind === ValueKind.Structure) {
    for (const [key, b] of (membersV as ContextValue).bindings) {
      if (b.value?.kind === ValueKind.Structure) out.set(fqnBaseName(key), b.value as ContextValue);
    }
  }
  return out;
}

// =============================================================================
// Meta-type: Type
//
// All type values have __type = Type. Comparison methods (instanceof / subtypeof)
// are SHAPE-AWARE: when both operands have a __name, the comparison is nominal
// (by name + __refines chain); when either operand has no __name, it's structural
// (by __members compatibility) — one meta-type; the named-vs-anonymous
// distinction is a property of the type value, not of its meta-type.
//
// `~T` (structural wrap) erases __name to project a named type into anonymous form.
//
//
// ConcreteType — interface (not a position in hierarchy). Concrete types have __construct.
//
// Bootstrap: Type is created as a raw Context, then retroactively given itself as
// its __type component.
// =============================================================================

/** Helper to add a binding to a Context */
// Held write capability for the discharged integrity channel (C1.4, D21-D24).
// Module-scope, never exported — makeProof is this module's only
// origination site.
const dischargedWriterStd = kernelChannelWriter("discharged");

function addBinding(ctx: ContextValue, key: string, value: Value): void {
  ctx.bindings.set(key, { key, value });
  ctx.bindingList.push({ key, value });
}

/**
 * Shape-aware instanceof: dispatch based on __name presence.
 *   - Both operand types named → nominal (by name + __refines chain)
 *   - Either operand anonymous (no __name) → structural (by __members compat)
 */
function shapeAwareInstanceof(value: Value, expectedType: ContextValue): boolean {
  const actualType = getType(value);
  if (!actualType) return false;
  return shapeAwareSubtypeof(actualType, expectedType);
}

/**
 * Shape-aware subtypeof: dispatch based on the expected type's nature.
 *   - If typeB is an interface (`__interface` marker), comparison is structural
 *     even when both sides have names. Interfaces declare a shape contract.
 *   - If typeB has no `__name` (anonymous: `~T`, inline `{x: Int}`), structural.
 *   - Otherwise (typeB is a named concrete type), nominal — but we still need
 *     typeA to be named, since an anonymous typeA can't match a name.
 */
function shapeAwareSubtypeof(typeA: ContextValue, typeB: ContextValue): boolean {
  // C6.1a (D44/D45): ONE declared check — the nominal name-string chain
  // walk is gone (its name-collision false positive with it). Order:
  //  1. identity;
  //  2. loose path — an UNNAMED, non-interface expected type (~T wraps,
  //     anonymous inline types) matches by base-name projection;
  //  3. refinement satisfaction — A's `refines` chain reaching B (a
  //     knowledge layer over B's shape; identity walk);
  //  4. shared-member-set guard — the same member-set OBJECT without a
  //     refines path is projection plumbing (`structuralWrap` shares the
  //     member object), NOT a declaration. (C7.2b: `distinct` no longer
  //     rides this guard — it mints FRESH member symbols, so newtype
  //     non-conformance falls out of membership by construction.);
  //  5. generic-args guard — Array[Int] vs Array[String] share member
  //     symbols (one declaring generic), so args must match;
  //  6. symbol-identity MEMBERSHIP — the D44 conformance relation, the
  //     same check for interfaces and named concrete types alike.
  if (typeA === typeB) return true;
  if (!isInterfaceType(typeB) && getTypeNameFromCtx(typeB) === null) {
    return structuralSubtypeof(typeA, typeB);
  }
  let cur: ContextValue | null = typeA;
  for (let guard = 0; guard < 64 && cur; guard++) {
    const parentV = getRefines(cur);
    if (parentV?.kind !== ValueKind.Structure) break;
    cur = parentV as ContextValue;
    if (cur === typeB) return typeArgsMatch(typeA, typeB);
  }
  // C6.2 (D40): the expected type is an EFFECT INSTANCE — instances of an
  // order-carrying kind relate by the KIND'S ORDER (label-set inclusion,
  // surfaced as `implies`/`subset_of`), not by conformance. Identity was
  // checked above; membership over memberless instances would be vacuous.
  if (getEffectLabels(typeB) !== undefined) return false;
  // C3.3 preserved, generalized in C6.1b: a predicate-carrying expected
  // type — transparent refinement, preserveOps shape, or the Interface
  // kind — demands construction through its chain. Membership cannot
  // discharge a predicate (its member symbols were drawn from the base,
  // so membership cannot distinguish base values from certified ones);
  // value-level discharge (domain implication, predicate re-check) lives
  // in type_check / instanceof, not in the type-to-type relation.
  // Chain/identity (checked above) is the only declared route.
  if (getPredicate(typeB) !== undefined) return false;
  const aMembers = getMembers(typeA);
  const bMembers = getMembers(typeB);
  if (aMembers !== undefined && aMembers === bMembers) return false;
  if (!typeArgsMatch(typeA, typeB)) return false;
  return structuralSubtypeof(typeA, typeB);
}

function isInterfaceType(t: ContextValue): boolean {
  const m = getInterfaceMarker(t);
  return m?.kind === ValueKind.Bits && (m as BitsValue).data !== 0n;
}

/** C6.1b (D45): is this meta Context a kind in the Type tower — Type
 *  itself or a meta CONFORMING to it (Refinement, Interface)? Surfaces
 *  that used to identity-check `=== Type` (e.g. `&`'s left-operand gate)
 *  use this so refined types (meta Refinement) keep their type-hood. */
export function isTypeMeta(meta: ContextValue): boolean {
  return meta === Type || shapeAwareSubtypeof(meta, Type);
}

/**
 * Structural subtypeof: typeA has every member typeB declares.
 * Compares __members collections by name.
 */
function structuralSubtypeof(typeA: ContextValue, typeB: ContextValue): boolean {
  const aMembersVal = getMembers(typeA);
  const bMembersVal = getMembers(typeB);

  if (bMembersVal?.kind === ValueKind.Structure) {
    const bMembers = bMembersVal as ContextValue;
    const aMembers = aMembersVal?.kind === ValueKind.Structure ? aMembersVal as ContextValue : null;
    if (!aMembers) return bMembers.bindings.size === 0;
    // C5.2c/C6.1a (D30/D44): the conformance split.
    //  - A DECLARED check (expected is an interface OR a named type — one
    //    mechanism since D44 dissolved the nominal chain) is
    //    SYMBOL-IDENTITY membership: every member symbol the expected
    //    type declares must BE a member symbol of the actual type (same
    //    FQN key; interning makes key identity symbol identity).
    //    Conformance is declared, never accidental — a type conforms by
    //    DRAWING the expected type's symbols, not by spelling the same
    //    names.
    //  - The LOOSE path (~T structural wraps, anonymous inline types —
    //    expected is UNNAMED and unmarked) matches by base-name
    //    projection — the duck-typing surface, aimed at data values.
    // B-097 V3 (V-R6): conformance counts only EXTERNALLY-REACHABLE
    // members. The expected side's private members impose no requirement
    // (their symbols are type-local — nothing else can hold them), and
    // the actual side's private members satisfy nothing (they are not
    // reachable through the conforming surface).
    if (isInterfaceType(typeB) || getTypeNameFromCtx(typeB) !== null) {
      for (const [key, bBinding] of bMembers.bindings) {
        if (bBinding.value?.kind === ValueKind.Structure && isPrivateDescriptor(bBinding.value as ContextValue)) continue;
        if (!aMembers.bindings.has(key)) return false;
      }
      return true;
    }
    const aNames = new Set<string>();
    for (const [key, aBinding] of aMembers.bindings) {
      if (aBinding.value?.kind === ValueKind.Structure && isPrivateDescriptor(aBinding.value as ContextValue)) continue;
      aNames.add(fqnBaseName(key));
    }
    for (const [key, bBinding] of bMembers.bindings) {
      if (bBinding.value?.kind === ValueKind.Structure && isPrivateDescriptor(bBinding.value as ContextValue)) continue;
      if (!aNames.has(fqnBaseName(key))) return false;
    }
    return true;
  }

  // No __members on expected type — trivially satisfied
  return true;
}

/**
 * Nominal subtypeof: typeA is the same as typeB by name (and type args), or
 * typeA's __refines chain reaches a type with that name. Caller has already
 * confirmed both types carry a __name.
 */
// C6.1a (D44): `nominalSubtypeof` — the name-string chain walk — is
// DELETED. The declared relation is symbol-identity conformance
// (shapeAwareSubtypeof); refinement satisfaction walks the `refines`
// chain by object identity, never by name.

/** Check that type arguments match (if the expected type has them) */
function typeArgsMatch(actual: ContextValue, expected: ContextValue): boolean {
  const expectedArgsV = getGenericArgs(expected);
  if (!expectedArgsV || expectedArgsV.kind !== ValueKind.Structure) return true; // no args to check
  const actualArgsV = getGenericArgs(actual);
  if (!actualArgsV || actualArgsV.kind !== ValueKind.Structure) return true; // actual has no args — accept (bare generic)

  const expectedArgsCtx = expectedArgsV as ContextValue;
  const actualArgsCtx = actualArgsV as ContextValue;
  const expElems = arrayElements(expectedArgsCtx);
  const actElems = arrayElements(actualArgsCtx);

  if (expElems.length !== actElems.length) return false;

  for (let i = 0; i < expElems.length; i++) {
    const expArg = dataOf(expElems[i]);
    const actArg = dataOf(actElems[i]);
    if (expArg.kind !== ValueKind.Structure || actArg.kind !== ValueKind.Structure) continue;
    const expName = getTypeNameFromCtx(expArg as ContextValue);
    const actName = getTypeNameFromCtx(actArg as ContextValue);
    if (expName && actName && expName !== "Any" && expName !== actName) return false;
  }
  return true;
}

/** Get __name from a type Context */
function getTypeNameFromCtx(type: ContextValue): string | null {
  const nv = getName(type);
  if (nv?.kind === ValueKind.Bits) return bitsToString(nv);
  return null;
}

// --- Build Type (the single meta-type) ---

export const Type: ContextValue = makeContext();
setName(Type, stringToBits("Type"));
// __members added after all meta-types are bootstrapped (see below)

// C7.1: the `NominalType` alias is RETIRED — after D44 there is no
// nominal checking left for the name to name. `Type` is the one root kind.

// --- Structural wrap (~): erase __name to make the type compare structurally ---

/**
 * Create an anonymous projection of a named type. With shape-aware dispatch,
 * absence of __name flips comparisons from nominal to structural — so erasing
 * the name is exactly the `~T` semantics. All other bindings (__refines,
 * __members, __construct, __predicate, __invariantsList, ...) are preserved,
 * so `~Int` still constructs Int values, has Int's methods, etc.; only its
 * type comparisons go structural.
 */
export function structuralWrap(type: ContextValue): ContextValue {
  const wrapper = makeContext();
  for (const [key, binding] of type.bindings) {
    if (key === SLOT_KEYS.name) continue; // erase name → anonymous → structural
    if (key === SLOT_KEYS.members) continue; // shared explicitly below
    // C5.2c: erase the interface marker too — `~T` projects the type into
    // the LOOSE (base-name) world; a wrapped interface duck-types by name
    // instead of demanding declared symbol identity.
    if (key === SLOT_KEYS.interface) continue;
    wrapper.bindings.set(key, { ...binding });
    wrapper.bindingList.push({ ...binding });
  }
  // C5.2a (ruling R1): member-set sharing is EXPLICIT — the wrap is
  // member-transparent (same member-set object as the wrapped type), which
  // is what keeps typeShape's identity test sound across the re-keying.
  const wrappedMembers = getMembers(type);
  if (wrappedMembers) setMembers(wrapper, wrappedMembers);
  setWraps(wrapper, type);
  return wrapper;
}

// --- Union Type: REMOVED at B-104 chunk 2 -----------------------------------
//
// `makeUnionType` built a type Context that was also an array: alternatives
// under numeric string keys, an explicit `__length`, two method bindings
// (`instanceof`/`subtypeof`) and a `__union` marker slot that stored the
// integer 1 — never the variants the D39 registry named as its target. It
// was the only Context in the system that genuinely mixed engine slots with
// plain names, and the sole reason `__length` survived outside dense
// structures. C6's member-storage rework carved it out explicitly (structures
// plan, ruling R6) and it was never re-derived.
//
// Nothing outside four test assertions used it. Removed rather than migrated;
// the redesign — including whether the alternatives should live in the dense
// region and whether a UnionType KIND replaces the marker — is B-105.

// Bootstrap: Type self-types
writeShape(Type, Type);

// =============================================================================
// Member Descriptor Types (bootstrap)
// Member/Method/Field are named types created before buildType is available.
// =============================================================================

// C6.3 (D44 audit): the descriptor taxonomy's refines edges are gone —
// MemberType (the abstract base) is deleted; Method and Field are the
// two descriptor shapes, recognised by shape identity, related by
// nothing (no chain, no shared members).

/** Method descriptor — a member with an implementation function */
export const MethodType: ContextValue = makeContext();
setName(MethodType, stringToBits("Method"));
writeShape(MethodType, Type);

/** Field descriptor — a member representing instance data */
export const FieldType: ContextValue = makeContext();
setName(FieldType, stringToBits("Field"));
writeShape(FieldType, Type);

/** B-097 V3 (D43): declared member attributes — optional bindings on the
 *  descriptor, following the shipped `getter` precedent. `private` is
 *  live (kernel mediation consults it); `readonly` is RESERVED vocabulary
 *  recorded on the descriptor but inert until B-046 gives it write
 *  semantics. */
export interface MemberAttrs {
  private?: boolean;
  readonly?: boolean;
}

function addAttrBindings(desc: ContextValue, attrs?: MemberAttrs): void {
  if (attrs?.private) addBinding(desc, "private", makeInt(1));
  if (attrs?.readonly) addBinding(desc, "readonly", makeInt(1));
}

/** Create a Method descriptor */
export function makeMethodDescriptor(
  name: string,
  impl: PrimitiveFunctionValue,
  isGetter: boolean = false,
  attrs?: MemberAttrs,
): ContextValue {
  const desc = makeContext();
  writeShape(desc, MethodType);
  addBinding(desc, "name", stringToBits(name));
  addBinding(desc, "value", impl);
  if (isGetter) addBinding(desc, "getter", makeInt(1));
  addAttrBindings(desc, attrs);
  return desc;
}

/** Create a Field descriptor */
export function makeFieldDescriptor(
  name: string,
  fieldType: Value,
  attrs?: MemberAttrs,
): ContextValue {
  const desc = makeContext();
  writeShape(desc, FieldType);
  addBinding(desc, "name", stringToBits(name));
  addBinding(desc, "fieldType", fieldType);
  addAttrBindings(desc, attrs);
  return desc;
}

/** Law descriptor — a named theorem template quantified over the
 *  implementing type (E3 — B-027 §8, D38). An ordinary member descriptor:
 *  laws live in member SETS and are drawn like any member, so law
 *  inheritance is symbol identity for free. */
export const LawType: ContextValue = makeContext();
setName(LawType, stringToBits("Law"));
writeShape(LawType, Type);

/** Create a Law descriptor. `proposition` is the quantified BODY — a
 *  function value of `arity` params, each ranging over the implementing
 *  type; the law holds iff the body is true on every tuple. A
 *  `kernelCertificate` marks a law proven ONCE, parametrically, for
 *  KERNEL-SUPPLIED implementations of the member it references
 *  (Equatable's refl/sym/trans over the kernel structural equals) — types
 *  whose implementation is kernel-supplied inherit the certificate free
 *  (§8 amortization); custom implementations bear fresh obligations. */
export function makeLawDescriptor(
  name: string,
  proposition: Value,
  arity: number,
  kernelCertificate?: string,
): ContextValue {
  const desc = makeContext();
  writeShape(desc, LawType);
  addBinding(desc, "name", stringToBits(name));
  addBinding(desc, "value", proposition);
  addBinding(desc, "arity", makeInt(arity));
  if (kernelCertificate) addBinding(desc, "kernelCertificate", stringToBits(kernelCertificate));
  return desc;
}

/** Check if a descriptor is a Law */
export function isLawDescriptor(desc: ContextValue): boolean {
  return channelReadRaw(desc, "shape") === LawType;
}

function lawDescriptorParts(desc: ContextValue): {
  name: string; proposition: Value; arity: number; kernelCertificate: string | null;
} {
  const nameV = desc.bindings.get("name")?.value;
  const propV = desc.bindings.get("value")?.value;
  const arityV = desc.bindings.get("arity")?.value;
  const certV = desc.bindings.get("kernelCertificate")?.value;
  return {
    name: nameV?.kind === ValueKind.Bits ? bitsToString(nameV as BitsValue) : "<law>",
    proposition: propV ?? makeInt(0),
    arity: arityV?.kind === ValueKind.Bits ? Number((arityV as BitsValue).data) : 1,
    kernelCertificate: certV?.kind === ValueKind.Bits ? bitsToString(certV as BitsValue) : null,
  };
}

// --- `for_all` proposition form (E-R3) ---------------------------------------
// `for_all(fn)` marks a function value as a quantified proposition schema.
// The marker is a host-side registry (no new `__*` slot): the returned
// Context is empty on the data plane; spec processing recognises it via
// `forAllBody`. All params of the body quantify over the implementing type.

const forAllRegistry = new WeakMap<Value, Value>();

/** Wrap a proposition body as a for_all marker value. */
export function makeForAllProp(body: Value): ContextValue {
  const marker = makeContext();
  forAllRegistry.set(marker, body);
  return marker;
}

/** The quantified body of a for_all marker, or undefined when `v` is not
 *  one. */
export function forAllBody(v: Value): Value | undefined {
  return forAllRegistry.get(dataOf(v));
}

/** Check if a descriptor is a Method */
export function isMethodDescriptor(desc: ContextValue): boolean {
  return channelReadRaw(desc, "shape") === MethodType;
}

/** B-097 V3 (D43): is this member declared `private`? */
export function isPrivateDescriptor(desc: ContextValue): boolean {
  const p = desc.bindings.get("private")?.value;
  return p !== undefined && p.kind === ValueKind.Bits && (p as BitsValue).data !== 0n;
}

// --- Modifier combinators (V-R5) ---------------------------------------------
// With keyword syntax parked on B-043, the define-spec surface is wrapper
// combinators: `Type.define({secret: private(Int), helper: private(fn)})`.
// The marker is a host-side registry (the `for_all` precedent — no new
// `__*` slot): the returned Context is empty on the data plane; spec
// processing unwraps it via `specModifiers`.

const modifierRegistry = new WeakMap<Value, { inner: Value; attrs: MemberAttrs }>();

function makeModifiedSpec(inner: Value, attr: keyof MemberAttrs): ContextValue {
  const marker = makeContext();
  const existing = modifierRegistry.get(dataOf(inner));
  if (existing) {
    // Compose wrappers: readonly(private(T)) accumulates both attrs.
    modifierRegistry.set(marker, { inner: existing.inner, attrs: { ...existing.attrs, [attr]: true } });
  } else {
    modifierRegistry.set(marker, { inner, attrs: { [attr]: true } });
  }
  return marker;
}

/** The wrapped declaration + attrs of a modifier marker, or undefined
 *  when `v` is not one. */
export function specModifiers(v: Value): { inner: Value; attrs: MemberAttrs } | undefined {
  return modifierRegistry.get(dataOf(v));
}

/** Check if a descriptor is a Field */
export function isFieldDescriptor(desc: ContextValue): boolean {
  return channelReadRaw(desc, "shape") === FieldType;
}

/** Check if a Method descriptor is a getter (auto-call with self) */
export function isGetterDescriptor(desc: ContextValue): boolean {
  const g = desc.bindings.get("getter")?.value;
  return g !== undefined && g.kind === ValueKind.Bits && (g as BitsValue).data !== 0n;
}

/** Look up the full member descriptor from a type's __members.
 *  C5.2b: base name resolves via the projection scan (kernel fast path;
 *  drawn/type-local symbols by base-name projection; distinct-target
 *  ambiguity errors per §5). */
export function typeMemberDescriptor(type: ContextValue, name: string): ContextValue | null {
  const membersV = getMembers(type);
  if (!membersV || membersV.kind !== ValueKind.Structure) return null;
  const descV = memberBindingByName(membersV as ContextValue, name);
  if (!descV || descV.kind !== ValueKind.Structure) return null;
  return descV as ContextValue;
}

// =============================================================================
// Type construction API: define, where, distinct, constructor
// =============================================================================

/**
 * Build a record type from a field specification plus zero or more drawn
 * member bundles (D45: `Type.define(spec, ...bundles)`). A field whose base
 * name matches a drawn bundle's member binds THAT symbol (declared
 * conformance); bundle methods not overridden are copied verbatim (same
 * symbol, same key). No is-a edge is minted (D44).
 * Auto-generates __construct (positional args), __getMember (field access), toString.
 */
function buildRecordType(
  fieldSpecObj: Value,
  drawn: ContextValue[],
  metaType: ContextValue,
  ctx?: ContextValue,
  evalFn?: EvalFn,
): ContextValue {
  // Extract field specs from the Object's Context
  const fieldCtx = dataOf(fieldSpecObj);
  if (fieldCtx.kind !== ValueKind.Structure) {
    throw new AllegroError("define: argument must be an object literal {field: Type, ...}");
  }
  // C6.1b (D45): the spec unifies fields and methods — an entry whose
  // value is a FUNCTION VALUE (ComposedFunction / PrimitiveFunction) is a
  // method implementation (the old `.mixin()` surface); anything else —
  // including function TYPES like `toString: Function` — declares a typed
  // field. Methods do not participate in the positional constructor.
  const fields: { name: string; type: Value; attrs?: MemberAttrs }[] = [];
  const methods: { name: string; impl: Value; attrs?: MemberAttrs }[] = [];
  // C7.2b (ruling R3): `construct` is a RESERVED spec key — the declared
  // construction authority (Refinement.define's reserved-key precedent:
  // refines/where/preserve). Declared at mint time, replacing the post-hoc
  // `.constructor()` meta-method (which MUTATED a built type against D22).
  let customConstruct: Value | null = null;
  // E3 (E-R3): `law_`-prefixed spec entries are LAW declarations — the
  // value must be a `for_all(...)` proposition; they become Law
  // descriptors, never fields or methods.
  const laws: { name: string; body: Value }[] = [];
  for (const [key, binding] of (fieldCtx as ContextValue).bindings) {
    if (isMetaSlotKey(key)) continue;
    if (binding.value) {
      // B-097 V3 (D43/V-R5): unwrap modifier combinators — the attrs
      // ride the declaration into the descriptor.
      const mods = specModifiers(binding.value);
      const declValue = mods ? mods.inner : binding.value;
      if (key.startsWith("law_")) {
        if (mods) {
          throw new AllegroError(`define: modifiers do not apply to law declarations ('${key}')`);
        }
        const body = forAllBody(declValue);
        if (body === undefined) {
          throw new AllegroError(
            `define: '${key}' must be a for_all(...) proposition (laws quantify over the implementing type)`);
        }
        laws.push({ name: key.slice(4), body });
        continue;
      }
      const entry = dataOf(declValue);
      if (key === "construct") {
        if (mods) {
          throw new AllegroError("define: modifiers do not apply to the reserved key 'construct'");
        }
        if (entry.kind !== ValueKind.ComposedFunction && entry.kind !== ValueKind.PrimitiveFunction) {
          throw new AllegroError("define: reserved key 'construct' must be a function value");
        }
        customConstruct = entry;
        continue;
      }
      if (entry.kind === ValueKind.ComposedFunction || entry.kind === ValueKind.PrimitiveFunction) {
        // E-R5: an `eq` implementation is this type's equality — it must
        // be pure and knowledge-independent, checked mechanically here.
        if (key === "eq") {
          assertPureForEquality(declValue, `define: 'eq' implementation`, ctx);
        }
        methods.push({ name: key, impl: entry, attrs: mods?.attrs });
      } else {
        fields.push({ name: key, type: declValue, attrs: mods?.attrs });
      }
    }
  }

  // Build the new type Context
  const newType = makeContext();
  setName(newType, stringToBits("<anonymous>"));
  writeShape(newType, metaType);
  // C6.1a (D44): composition mints NO is-a edge — Dog relates to Animal
  // by holding its drawn member symbols (conformance), not by a chain
  // link. `refines` is written only by refinement layers now.

  // Build __members: Field descriptors for declared fields + Method descriptors for methods
  const members = makeContext();

  // Add Field descriptors for each declared field. C5.2b (D30 draw-from):
  // a field whose base name matches a drawn bundle's member binds THAT
  // symbol (override/implement keeps identity); otherwise it gets a
  // type-local symbol in this type's member scope. Multi-bundle diamonds
  // resolve inside drawMemberKey (shared symbol → one key; distinct
  // same-named symbols → explicit ambiguity error).
  const recordScope = newTypeMemberScope();
  (newType as any).localMemberScope = recordScope;
  // B-097 V3 (V-R3/V-R5): a `private(...)` declaration NEVER draws — its
  // symbol is minted type-local (the member stays in the defining scope,
  // D42), so it can neither override a drawn member nor satisfy foreign
  // conformance. A base-name collision with a drawn member is an explicit
  // error (the local private would shadow the drawn symbol at the access
  // surface — the §5 ambiguity — so refuse at declaration).
  const privateKeyFor = (name: string): string => {
    for (const bundle of drawn) {
      const bm = getMembers(bundle);
      if (bm?.kind !== ValueKind.Structure) continue;
      for (const key of (bm as ContextValue).bindings.keys()) {
        if (fqnBaseName(key) === name) {
          throw new AllegroError(
            `define: cannot declare '${name}' private — it would shadow a drawn member of '${getTypeNameFromCtx(bundle) ?? "<anonymous>"}'`);
        }
      }
    }
    return memberFqnIn(recordScope, name);
  };
  let hasPrivateMembers = false;
  for (const f of fields) {
    if (f.attrs?.private) {
      hasPrivateMembers = true;
      const desc = makeFieldDescriptor(f.name, f.type, f.attrs);
      (desc as any).ownerShape = newType;
      addMemberAt(members, privateKeyFor(f.name), desc);
      continue;
    }
    for (const key of drawMemberKeys(drawn, f.name, recordScope)) {
      addMemberAt(members, key, makeFieldDescriptor(f.name, f.type, f.attrs));
    }
  }

  // Method entries (the unified mixin surface). A method whose base name
  // matches a drawn member DRAWS that symbol — an override that keeps
  // member identity (C5.2b); new names get type-local symbols. Methods
  // receive `self` (the typed instance) as their first argument;
  // type_dispatch handles both PrimitiveFunction and ComposedFunction
  // descriptors with self-binding.
  for (const m of methods) {
    let desc: Value;
    if (m.impl.kind === ValueKind.PrimitiveFunction) {
      desc = makeMethodDescriptor(m.name, m.impl as PrimitiveFunctionValue, false, m.attrs);
    } else {
      const d = makeContext();
      writeShape(d, MethodType);
      addBinding(d, "name", stringToBits(m.name));
      addBinding(d, "value", m.impl);
      addAttrBindings(d, m.attrs);
      desc = d;
    }
    if (m.attrs?.private) {
      hasPrivateMembers = true;
      (desc as any).ownerShape = newType;
      addMemberAt(members, privateKeyFor(m.name), desc);
      continue;
    }
    for (const key of drawMemberKeys(drawn, m.name, recordScope)) {
      addMemberAt(members, key, desc);
    }
  }

  // Law entries (E3): Law descriptors drawn like any member — a law whose
  // name matches a drawn law OVERRIDES it (binds the drawn symbol).
  for (const l of laws) {
    const desc = makeLawDescriptor(
      l.name, l.body,
      dataOf(l.body).kind === ValueKind.ComposedFunction
        ? (dataOf(l.body) as ComposedFunctionValue).params.length : 1);
    for (const key of drawMemberKeys(drawn, l.name, recordScope)) {
      addMemberAt(members, key, desc);
    }
  }

  // Copy non-meta Method descriptors from each drawn bundle's __members.
  // C5.2a: keys are member-symbol FQNs — copied verbatim (same symbol,
  // same key); the meta filter compares the base-name projection.
  // C6.1b order ruling: bundle order is NOT significant. A spec
  // declaration owns its keys (the explicit resolution); two bundles
  // providing DIFFERENT descriptors for the same symbol is an explicit-
  // conflict error, never a first-bundle-wins.
  const metaMethodNames = META_METHOD_NAMES;
  const specKeys = new Set(members.bindings.keys());
  for (const bundle of drawn) {
    const bundleMembers = getMembers(bundle);
    if (bundleMembers?.kind !== ValueKind.Structure) continue;
    for (const [key, binding] of (bundleMembers as ContextValue).bindings) {
      if (metaMethodNames.has(fqnBaseName(key))) continue;
      if (!binding.value) continue;
      // B-097 V3 (V-R6): a bundle's private members stay with the bundle —
      // they are never copied into drawing types.
      if (binding.value.kind === ValueKind.Structure && isPrivateDescriptor(binding.value as ContextValue)) continue;
      if (specKeys.has(key)) continue;
      const existing = members.bindings.get(key)?.value;
      if (existing === undefined) {
        addBinding(members, key, binding.value);
      } else if (existing !== binding.value) {
        throw new AllegroError(
          `member '${fqnBaseName(key)}' is provided differently by two drawn bundles — ` +
          `bundle order is not significant; resolve by declaring '${fqnBaseName(key)}' in the spec`);
      }
    }
  }

  // A METHODS-ONLY spec mints a BUNDLE — a pure member set meant to be
  // drawn into other types (`Type.define(spec, ..., MagMixin)`), not
  // instantiated. Bundles get no auto-generated construct / getMember /
  // toString: the generated infrastructure would clash symbol-wise with
  // every other concrete bundle at draw time (two auto-toStrings under
  // one base name is the D44 explicit-conflict error). An empty spec
  // (`Type.define({})`) still mints a full record type.
  // B-097 V3: host-plane flag — the kernel mediation check and privilege
  // planting are gated on it, so types without private members pay
  // nothing on the dispatch hot path.
  if (hasPrivateMembers) (newType as any).hasPrivateMembers = true;

  const isBundle = fields.length === 0 && methods.length > 0 && customConstruct === null;
  if (isBundle) {
    setMembers(newType, members);
    return newType;
  }

  if (customConstruct !== null) {
    // C7.2b (ruling R3): declared construction authority — the spec's
    // `construct` function runs with the call's args; its result is
    // tagged with this type (same wrap the retired `.constructor()`
    // meta-method applied, now declared at mint time).
    const declaredCtor = customConstruct;
    setConstruct(newType, makePrimitive("record.__construct", (ctorArgs, ctorCtx, ctorEvalFn) => {
      // B-097 V3: the declared constructor is the type's own code — its
      // body runs with the type's member privilege (it may read private
      // members of instances it works with).
      const result = ctorEvalFn!(makeExpr(declaredCtor, ctorArgs), typePrivilegedCtx(newType, ctorCtx!));
      return withTypeReplacing(dataOf(result), newType);
    }, true));
  } else {
    // Auto-generate __construct: positional args in field order
    const constructImpl: PrimitiveFnImpl = (args, ctx, evalFn) => {
      const evalArgs = args.map(a => evalFn!(a, ctx!));
      if (evalArgs.length !== fields.length) {
        throw new AllegroError(`Constructor expects ${fields.length} args, got ${evalArgs.length}`);
      }
      const instance = makeContext();
      for (let i = 0; i < fields.length; i++) {
        addBinding(instance, fields[i].name, evalArgs[i]);
      }
      return withType(instance, newType);
    };
    setConstruct(newType, makePrimitive("record.__construct", constructImpl, true));
  }

  // Auto-generate __getMember: field access on instances
  setFallbackMember(newType, makePrimitive("record.__getMember", (args) => {
    const instanceCtx = args[0] as ContextValue;
    const fieldName = bitsToString(args[1] as BitsValue);
    const b = instanceCtx.bindings.get(fieldName);
    if (!b?.value) throw new AllegroError(`Field '${fieldName}' not found`);
    return b.value;
  }));

  // Auto-generate toString as Method descriptor in __members
  const toStringImpl = makePrimitive("record.toString", ((args: Value[]) => {
    const instanceCtx = args[0] as ContextValue;
    const typeName = getTypeNameFromCtx(newType) ?? "<anonymous>";
    const parts: string[] = [];
    // B-097 V3 (V-R6): private fields are OMITTED from the rendered
    // record; a trailing `…` marks the omission so output stays honest.
    let omittedPrivate = false;
    for (const f of fields) {
      if (f.attrs?.private) { omittedPrivate = true; continue; }
      const val = instanceCtx.bindings.get(f.name)?.value;
      if (val) {
        // Try to get a string representation via type's toString
        const valType = getType(val);
        if (valType) {
          const tsMethod = typeMethod(valType, "toString");
          if (tsMethod?.kind === ValueKind.PrimitiveFunction) {
            const str = (tsMethod as PrimitiveFunctionValue).fn([dataOf(val)], undefined as any, undefined as any);
            const sp = dataOf(str);
            if (sp.kind === ValueKind.Bits) {
              parts.push(`${f.name}: ${bitsToString(sp as BitsValue)}`);
              continue;
            }
          }
        }
        parts.push(`${f.name}: ...`);
      }
    }
    if (omittedPrivate) parts.push("…");
    return withType(stringToBits(`${typeName}(${parts.join(", ")})`), StringType);
  }) as PrimitiveFnImpl);
  // toString draws a bundle's symbol if one exists (an override, same
  // member identity); otherwise it gets a type-local symbol. A toString
  // METHOD supplied in the spec wins over the auto-generated one.
  if (!methods.some((m) => m.name === "toString")) {
    const tsDesc = makeMethodDescriptor("toString", toStringImpl);
    for (const key of drawMemberKeys(drawn, "toString", recordScope)) {
      addMemberAt(members, key, tsDesc);
    }
  }

  setMembers(newType, members);

  // E3: a CONCRETE type is an implementing type — every Law descriptor in
  // its member set (own spec + drawn bundles) instantiates an obligation,
  // quantifier specialized to this type, discharge attempted down the
  // tier ladder. (Bundles returned above declare, they don't implement.)
  instantiateLawsFromMembers(newType, members, ctx, evalFn);

  return newType;
}

/**
 * Build an interface type: declares required members without providing implementations.
 * Interfaces are structural types (__type = Type) — any value whose type has all
 * declared members satisfies the interface via structural instanceof.
 *
 * No __construct, __getMember, or auto-generated methods.
 */
function buildInterfaceType(
  memberSpecObj: Value,
  drawn: ContextValue[],
): ContextValue {
  const specCtx = dataOf(memberSpecObj);
  if (specCtx.kind !== ValueKind.Structure) {
    throw new AllegroError("Interface.define: argument must be an object literal {member: Type, ...}");
  }

  // Extract declared members from the spec. E3: `law_`-prefixed entries
  // are LAW declarations — proposition SCHEMAS at declaration time
  // (nothing runs, nothing discharges); they become concrete obligations
  // at DRAW time when an implementing type binds the interface's symbols.
  const declaredMembers: { name: string; type: Value; attrs?: MemberAttrs }[] = [];
  const declaredLaws: { name: string; body: Value }[] = [];
  for (const [key, binding] of (specCtx as ContextValue).bindings) {
    if (isMetaSlotKey(key)) continue;
    if (binding.value) {
      const mods = specModifiers(binding.value);
      const declValue = mods ? mods.inner : binding.value;
      if (key.startsWith("law_")) {
        if (mods) {
          throw new AllegroError(`Interface.define: modifiers do not apply to law declarations ('${key}')`);
        }
        const body = forAllBody(declValue);
        if (body === undefined) {
          throw new AllegroError(
            `Interface.define: '${key}' must be a for_all(...) proposition`);
        }
        declaredLaws.push({ name: key.slice(4), body });
        continue;
      }
      declaredMembers.push({ name: key, type: declValue, attrs: mods?.attrs });
    }
  }

  // Build the interface type Context
  const ifaceType = makeContext();
  setName(ifaceType, stringToBits("<anonymous>"));
  // C6.1b (D45): an interface is an INSTANCE OF the Interface kind
  // (declaration-only types). Interface conforms to Type through its
  // refines edge, so `Printable instanceof Type` stays true.
  writeShape(ifaceType, InterfaceKind);
  // C6.1a (D44): no edge — interface conformance is symbol membership
  // over the copied member set.
  markInterface(ifaceType, makeInt(1)); // marker

  // Build __members: declared members as Field descriptors
  const members = makeContext();

  // Add Field descriptors for each declared member first. C5.2b:
  // declarations draw from the bundles (a matching base name binds the
  // drawn member symbol); new names get interface-local symbols.
  const ifaceScope = newTypeMemberScope();
  (ifaceType as any).localMemberScope = ifaceScope;
  for (const m of declaredMembers) {
    const desc = makeFieldDescriptor(m.name, m.type, m.attrs);
    // B-097 V3: a private interface declaration stays interface-local —
    // it is never drawn and imposes no conformance requirement (V-R6).
    if (m.attrs?.private) {
      (desc as any).ownerShape = ifaceType;
      (ifaceType as any).hasPrivateMembers = true;
      addMemberAt(members, memberFqnIn(ifaceScope, m.name), desc);
      continue;
    }
    for (const key of drawMemberKeys(drawn, m.name, ifaceScope)) {
      addMemberAt(members, key, desc);
    }
  }

  // Law descriptors (E3) — drawn like any member; no instantiation here
  // (an interface declares, it never implements).
  for (const l of declaredLaws) {
    const desc = makeLawDescriptor(
      l.name, l.body,
      dataOf(l.body).kind === ValueKind.ComposedFunction
        ? (dataOf(l.body) as ComposedFunctionValue).params.length : 1);
    for (const key of drawMemberKeys(drawn, l.name, ifaceScope)) {
      addMemberAt(members, key, desc);
    }
  }

  // Copy non-meta members from each drawn bundle (C5.2a: FQN keys copied
  // verbatim; meta filter on the base-name projection) — the old
  // parent-inheritance form `Int.interface(spec)` is now
  // `Interface.define(spec, Int)`. C6.1b order ruling: bundle order is
  // NOT significant — spec declarations own their keys; conflicting
  // bundle-provided descriptors for one symbol error explicitly.
  const metaMethodNames = META_METHOD_NAMES;
  const specKeys = new Set(members.bindings.keys());
  for (const bundle of drawn) {
    const bundleMembers = getMembers(bundle);
    if (bundleMembers?.kind !== ValueKind.Structure) continue;
    for (const [key, binding] of (bundleMembers as ContextValue).bindings) {
      if (metaMethodNames.has(fqnBaseName(key))) continue;
      if (!binding.value) continue;
      // B-097 V3 (V-R6): a bundle's private members stay with the bundle —
      // they are never copied into drawing types.
      if (binding.value.kind === ValueKind.Structure && isPrivateDescriptor(binding.value as ContextValue)) continue;
      if (specKeys.has(key)) continue;
      const existing = members.bindings.get(key)?.value;
      if (existing === undefined) {
        addBinding(members, key, binding.value);
      } else if (existing !== binding.value) {
        throw new AllegroError(
          `member '${fqnBaseName(key)}' is provided differently by two drawn bundles — ` +
          `bundle order is not significant; resolve by declaring '${fqnBaseName(key)}' in the spec`);
      }
    }
  }

  setMembers(ifaceType, members);

  return ifaceType;
}

/** B-028 F1 (D12/D33): substitute a data structure's RESOLVED future
 *  slots. A pending future occupies a slot as a Symbol; once its cell
 *  completes, only AST-node symbols re-resolve through evaluation — a
 *  symbol sitting in a data binding is read back verbatim forever. This
 *  helper produces a copy-on-write instance with each now-resolvable
 *  Symbol slot replaced by its value (never mutating the original —
 *  D22); still-pending slots are left in place (incompleteness stays a
 *  value in a slot). Shallow by design: it serves the construction-time
 *  invariant check, whose predicate reads this instance's own fields;
 *  nested-structure substitution is F2's completion-replacement item. */
export function resolveDataSlots(
  v: Value,
  ctx: ContextValue | undefined,
  evalFn: EvalFn | undefined,
  cellRefsOnly = false,
): Value {
  if (!ctx || !evalFn) return v;
  const inst = dataOf(v);
  if (inst.kind !== ValueKind.Structure) return v;
  const instCtx = inst as ContextValue;
  if (instCtx.isScope) return v;
  let updates: Map<string, Value> | null = null;
  for (const [key, b] of instCtx.bindings) {
    if (b.value === undefined || isResolved(b.value)) continue;
    if (isMetaSlotKey(key)) continue;
    // B-028 F4 (`cellRefsOnly`, set by the completion cascade and io):
    // outside the construction path, only slots that actually reference
    // a future/import CELL are evaluated — quoted-AST data (a grammar
    // rule's expression, a stored symbol) also reads as "unresolved"
    // and must never be re-executed by a background substitution pass.
    if (cellRefsOnly && !referencesCell(b.value, ctx)) continue;
    // The slot may hold the bare Symbol, or a channel CARRIER over it
    // (an effectful source like `delay` wraps its future with the
    // effects channel) — `evaluate` handles both: carriers re-evaluate
    // their primary, symbols resolve against the scope chain.
    const rv = evalFn(b.value, ctx);
    if (rv !== b.value && isResolved(rv)) {
      (updates ??= new Map()).set(key, rv);
    }
  }
  if (!updates) return v;
  const fresh = makeContext();
  for (const [key, b] of instCtx.bindings) {
    if (b.value === undefined) continue;
    const nv = updates.get(key) ?? b.value;
    fresh.bindings.set(key, { key, value: nv });
    fresh.bindingList.push({ key, value: nv });
  }
  const storedType = getType(v);
  return storedType ? withTypeReplacing(fresh, storedType) : fresh;
}

/** Does this slot value's symbol graph reference a future/import CELL
 *  (a binding minted by `makeCell` — the marker is permanent, so a
 *  resolved future still answers)? Guards background substitution. */
function referencesCell(v: Value, ctx: ContextValue, depth = 0): boolean {
  if (depth > 32) return false;
  const d = dataOf(v);
  if (d.kind === ValueKind.Symbol) {
    const b = scopeLookup(ctx, d.name);
    return b !== undefined && b.cell === true;
  }
  if (d.kind === ValueKind.Expression) {
    if (referencesCell(d.fn, ctx, depth + 1)) return true;
    for (const a of d.args) {
      if (referencesCell(a, ctx, depth + 1)) return true;
    }
  }
  return false;
}

/**
 * Build a refined type: inherits parent, wraps constructor with predicate check.
 */
export function buildRefinedType(parentType: ContextValue, predicate: Value, ctx?: ContextValue): ContextValue {
  const refinedType = makeContext();
  // Copy all bindings from parent (except __members, handled separately)
  for (const [key, binding] of parentType.bindings) {
    if (key === SLOT_KEYS.members) continue;
    if (binding.value) {
      addBinding(refinedType, key, binding.value);
    }
  }
  // Copy __members from parent (shared reference is fine — same descriptors)
  const parentMembers = getMembers(parentType);
  if (parentMembers?.kind === ValueKind.Structure) {
    setMembers(refinedType, parentMembers);
  }
  // Override __name
  removeName(refinedType);
  setName(refinedType, stringToBits("<refined>"));
  // Set __refines to parent
  removeRefines(refinedType);
  setRefines(refinedType, parentType);
  // C6.1b (D45): a refined type is an INSTANCE OF the Refinement kind —
  // its meta answers Refinement (which conforms to Type by drawn
  // membership, so `P instanceof Type` stays true through conformance).
  removeShapeSlot(refinedType);
  writeShape(refinedType, RefinementKind);
  // Store predicate
  setPredicate(refinedType, predicate);
  // Phase B: recognise the predicate's algebraic shape (if any) and stash
  // an abstract domain. The domain lets downstream arithmetic propagate
  // refinement facts without re-evaluating the predicate. Opaque
  // predicates just get an opaque-tagged domain; runtime checks still
  // fire via __construct / type_check.
  const predDomain = domainFromPredicate(predicate);
  setAbstractDomain(refinedType, predDomain);
  // B-028 F4 (D32/CE-R7): a VALUE-INSPECTING invariant predicate must be
  // div-free — construction over pending fields is held until the
  // predicate answers, so an undischarged-divergent predicate could hang
  // the guard. Recognised scalar domains are discharged without running
  // the predicate (the shipped opaque-domain test IS the discriminator),
  // so only opaque predicates pay the gate.
  if (predDomain.kind === "opaque") assertInvariantTotal(predicate, ctx);

  // Wrap __construct with predicate check
  const parentConstruct = getConstruct(parentType);
  if (parentConstruct?.kind === ValueKind.PrimitiveFunction) {
    removeConstruct(refinedType);

    // B-028 F1 (CE-R8 move 1, D32): the predicate-check half, shared by
    // first construction and residual re-fire. It takes the BUILT value —
    // a re-fire must never re-run the parent constructor (a lazy
    // argument like `delay(...)` would mint a fresh future on every
    // cascade pass and the program would never drain).
    const refinedCheckImpl: PrimitiveFnImpl = (cargs, cctx, cevalFn) => {
      let value = cevalFn!(cargs[0], cctx!);
      // Substitute future slots that have since resolved (copy-on-write —
      // D22): a pending future in a DATA slot is a Symbol the evaluator
      // never re-visits (only AST-node symbols re-resolve), so without
      // this the re-fired predicate reads the stale symbol forever — and
      // a passing invariant would tag an instance still carrying it.
      // Slots that remain pending stay as they are: the predicate runs,
      // and only if it actually READS one does the check residualize
      // (D32: projections untouched by the invariant stay admissible).
      value = resolveDataSlots(value, cctx, cevalFn);

      // Error propagation: if construction produced an error (e.g., a
      // deeper refinement check failed further up the chain), propagate
      // it without re-tagging or running this predicate. Without this, a
      // deeper refinement's error would get silently retagged.
      if (channelReadRaw(value, "error") !== undefined) return value;

      // Apply predicate
      const checkResult = cevalFn!(makeExpr(predicate, [value]), cctx!);
      // An UNRESOLVED check — the invariant read a field whose value is
      // still a pending future — residualizes CONSTRUCTION: the value
      // must not exist as a tagged instance (pre-F1 it was silently
      // mis-tagged as if the invariant held) until the invariant has
      // actually been checked. The residual re-fires when the inspected
      // fields resolve — the D32 guard, emergent from D11 + PE Rule 1
      // exactly as structures.md §10 predicted.
      if (!isResolved(checkResult)) {
        return makeExpr(makePrimitive("refined.__check", refinedCheckImpl, true), [value]);
      }
      const checkP = dataOf(checkResult);
      if (checkP.kind === ValueKind.Bits && (checkP as BitsValue).data === 0n) {
        // Predicate failed — return a targeted error. If the refined type has
        // a recognised abstract domain, render it in the message so the user
        // sees what constraint the value violated.
        const dom = getAbstractDomain(refinedType);
        const primary = dataOf(value);
        let cexDesc = "";
        if (primary.kind === ValueKind.Bits && (primary as BitsValue).length === 64) {
          const signed = (primary as BitsValue).data >= 0x8000000000000000n
            ? (primary as BitsValue).data - 0x10000000000000000n
            : (primary as BitsValue).data;
          cexDesc = ` (got ${signed})`;
        }
        let constraintDesc = "";
        if (dom && dom.kind !== "opaque") {
          // Lazy-import formatDomain to avoid a static circular dep with refinements.ts
          // (types-std already imports refinements, but this keeps the failure path
          // decoupled from that module's shape evolving.)
          const formatDomain = (d: any): string => {
            if (d.kind === "interval") {
              if (d.lo === d.hi) return `== ${d.lo}`;
              if (d.lo === -Infinity) return `≤ ${d.hi}`;
              if (d.hi === +Infinity) return `≥ ${d.lo}`;
              return `∈ [${d.lo}, ${d.hi}]`;
            }
            if (d.kind === "ne") return `≠ ${d.value}`;
            if (d.kind === "eq") return `== ${d.value}`;
            return "<predicate>";
          };
          constraintDesc = `: expected ${formatDomain(dom)}`;
        }
        const msg = `refinement check failed${constraintDesc}${cexDesc}`;
        const components = new Map<string, Value>();
        components.set("error", withType(stringToBits(msg), StringType));
        components.set("type", ErrorType);
        return makeMultiValue(makeInt(0), components);
      }

      // Re-tag with refined type, and attach the abstract domain so downstream
      // arithmetic can propagate the refinement without re-parsing the
      // predicate.
      const typed = withTypeReplacing(dataOf(value), refinedType);
      const dom = getAbstractDomain(refinedType);
      if (dom) {
        // Phase C: attach a single-predicate set rather than a single
        // domain. The set is the canonical predicate-storage form;
        // downstream propagation and proof-search consume it.
        const set = new PredicateSet([{ shape: dom, source: "refinement-type" }]);
        return rfWithPredicates(typed, set);
      }
      return typed;
    };
    setConstruct(refinedType, makePrimitive("refined.__construct", (args, ctx, evalFn) => {
      // Call parent constructor, then delegate to the shared check half.
      const value = (parentConstruct as PrimitiveFunctionValue).fn(args, ctx, evalFn);
      return refinedCheckImpl([value], ctx, evalFn);
    }, true));
  }

  return refinedType;
}

// C6.1b (D45): buildInvariantedType is DELETED — lifecycle invariants are
// ordinary refinements now (`T & pred`, chained per clause). The
// `__invariantsList` slot has no remaining writer; its registry entry is
// swept in C6.3's slot-disposition pass.

/**
 * Build a distinct type — the NEWTYPE mint (C7.2b, ruling R2).
 *
 * A distinct type is a SYMBOL-FRESH re-declaration: the parent's member
 * descriptors are re-declared under the distinct type's own gensym'd
 * scope — same implementations, NEW symbol identity. Non-conformance
 * (`UserId subtypeof Int` false, and vice versa) then falls out of C5.2
 * symbol-identity membership BY CONSTRUCTION: no member symbol is shared,
 * so the membership check fails naturally. (The shared-member-set guard
 * in shapeAwareSubtypeof no longer carries distinct — it remains for
 * structuralWrap, which genuinely shares the member object.)
 */
function buildDistinctType(parentType: ContextValue): ContextValue {
  const distinctType = makeContext();
  // Copy all bindings except __refines and __members (handled separately)
  for (const [key, binding] of parentType.bindings) {
    if (key === SLOT_KEYS.refines) continue;
    if (key === SLOT_KEYS.members) continue;
    if (binding.value) {
      addBinding(distinctType, key, binding.value);
    }
  }
  // Re-declare the parent's members under a fresh scope (fresh symbols).
  const parentMembers = getMembers(parentType);
  if (parentMembers?.kind === ValueKind.Structure) {
    const freshScope = newTypeMemberScope("<distinct>");
    const freshMembers = makeContext();
    for (const [key, b] of (parentMembers as ContextValue).bindings) {
      if (!b.value) continue;
      addMember(freshMembers, freshScope, fqnBaseName(key), b.value);
    }
    setMembers(distinctType, freshMembers);
  }
  // Override __name and __type
  removeName(distinctType);
  setName(distinctType, stringToBits("<distinct>"));
  removeShapeSlot(distinctType);
  writeShape(distinctType, Type); // named → nominal comparison via shape dispatch

  // Wrap __construct to re-tag with distinct type
  const parentConstruct = getConstruct(parentType);
  if (parentConstruct?.kind === ValueKind.PrimitiveFunction) {
    removeConstruct(distinctType);

    setConstruct(distinctType, makePrimitive("distinct.__construct", (args, ctx, evalFn) => {
      const value = (parentConstruct as PrimitiveFunctionValue).fn(args, ctx, evalFn);
      return withTypeReplacing(dataOf(value), distinctType);
    }, true));
  }

  return distinctType;
}

/**
 * Lift operators on a refined type so they preserve the refinement.
 * Creates a new refined type where the named operators are wrapped to
 * re-run the predicate check after the parent operator, producing a value
 * tagged with the refined type (or an error if the predicate fails).
 *
 * Default lifted ops when no names given: add, sub, mul, div, mod, neg.
 */
function buildPreserveOps(refinedType: ContextValue, opNames: string[]): ContextValue {
  const defaultOps = ["add", "sub", "mul", "div", "mod", "neg"];
  const ops = opNames.length > 0 ? opNames : defaultOps;

  const predicate = getPredicate(refinedType);
  const parentType = getRefines(refinedType) as ContextValue;
  if (!predicate || !parentType || parentType.kind !== ValueKind.Structure) {
    return refinedType; // not a refined type — nothing to do
  }
  const parentConstruct = getConstruct(parentType);

  // Build new type (clone bindings except __members and __construct)
  const newType = makeContext();
  for (const [key, binding] of refinedType.bindings) {
    if (key === SLOT_KEYS.members || key === SLOT_KEYS.construct) continue;
    if (binding.value) addBinding(newType, key, binding.value);
  }

  // Rebuild __construct so it tags results with the NEW type
  if (parentConstruct?.kind === ValueKind.PrimitiveFunction) {
    // B-028 F1 (CE-R8 move 1, D32): check half over the BUILT value —
    // same tri-state and re-fire discipline as buildRefinedType's.
    const preserveCheckImpl: PrimitiveFnImpl = (cargs, cctx, cevalFn) => {
      let value = cevalFn!(cargs[0], cctx!);
      value = resolveDataSlots(value, cctx, cevalFn);
      if (channelReadRaw(value, "error") !== undefined) return value;
      const checkResult = cevalFn!(makeExpr(predicate, [value]), cctx!);
      if (!isResolved(checkResult)) {
        return makeExpr(makePrimitive("refined.__check", preserveCheckImpl, true), [value]);
      }
      const checkP = dataOf(checkResult);
      if (checkP.kind === ValueKind.Bits && (checkP as BitsValue).data === 0n) {
        // Same constraint-rendering logic as buildRefinedType's __construct.
        const dom = getAbstractDomain(refinedType);
        const primary = dataOf(value);
        let cexDesc = "";
        if (primary.kind === ValueKind.Bits && (primary as BitsValue).length === 64) {
          const signed = (primary as BitsValue).data >= 0x8000000000000000n
            ? (primary as BitsValue).data - 0x10000000000000000n
            : (primary as BitsValue).data;
          cexDesc = ` (got ${signed})`;
        }
        let constraintDesc = "";
        if (dom && dom.kind !== "opaque") {
          const fmt = (d: any): string => {
            if (d.kind === "interval") {
              if (d.lo === d.hi) return `== ${d.lo}`;
              if (d.lo === -Infinity) return `≤ ${d.hi}`;
              if (d.hi === +Infinity) return `≥ ${d.lo}`;
              return `∈ [${d.lo}, ${d.hi}]`;
            }
            if (d.kind === "ne") return `≠ ${d.value}`;
            if (d.kind === "eq") return `== ${d.value}`;
            return "<predicate>";
          };
          constraintDesc = `: expected ${fmt(dom)}`;
        }
        const components = new Map<string, Value>();
        components.set("error", withType(stringToBits(`refinement check failed${constraintDesc}${cexDesc}`), StringType));
        components.set("type", ErrorType);
        return makeMultiValue(makeInt(0), components);
      }
      return withTypeReplacing(dataOf(value), newType);
    };
    setConstruct(newType, makePrimitive("refined.__construct", (args, ctx, evalFn) => {
      const value = (parentConstruct as PrimitiveFunctionValue).fn(args, ctx, evalFn);
      return preserveCheckImpl([value], ctx, evalFn);
    }, true));
  }

  // Clone __members and add lifted operator descriptors. C5.2b: the
  // long-latent unfiltered copy is fixed — meta-method names no longer
  // ride into instance member sets (the wart the symbol re-keying made
  // visible; recon 2026-08).
  const parentMembers = getMembers(refinedType);
  const newMembers = makeContext();
  if (parentMembers?.kind === ValueKind.Structure) {
    for (const [key, binding] of (parentMembers as ContextValue).bindings) {
      if (META_METHOD_NAMES.has(fqnBaseName(key))) continue;
      if (binding.value) addBinding(newMembers, key, binding.value);
    }
  }

  const newConstruct = getConstruct(newType) as PrimitiveFunctionValue | undefined;
  const liftScope = newTypeMemberScope();
  (newType as any).localMemberScope = liftScope;

  for (const opName of ops) {
    const parentDesc = parentMembers?.kind === ValueKind.Structure
      ? memberBindingByName(parentMembers as ContextValue, opName)
      : null;
    if (!parentDesc || parentDesc.kind !== ValueKind.Structure) continue;
    const parentOp = (parentDesc as ContextValue).bindings.get("value")?.value;
    if (!parentOp || parentOp.kind !== ValueKind.PrimitiveFunction) continue;
    if (!newConstruct) continue;

    // Lifted op: call parent op, then re-construct through new type's __construct
    const liftedOp = makePrimitive(`${opName}_lifted`, ((args, ctx, evalFn) => {
      const parentResult = (parentOp as PrimitiveFunctionValue).fn(args, ctx as any, evalFn as any);
      // __construct is lazy — wrap the result in an identity expression so it evaluates to itself
      const identityPrim = makePrimitive("identity", (a) => a[0]);
      const wrapped = makeExpr(identityPrim, [dataOf(parentResult)]);
      return newConstruct.fn([wrapped], ctx as any, evalFn as any);
    }) as PrimitiveFnImpl);

    // The lift is an OVERRIDE — it draws (binds) the parent op's symbol.
    const liftDesc = makeMethodDescriptor(opName, liftedOp);
    for (const key of drawMemberKeys([refinedType], opName, liftScope)) {
      addMemberAt(newMembers, key, liftDesc);
    }
  }

  setMembers(newType, newMembers);
  return newType;
}

// C6.1b (D45): buildMixinType is DELETED — method implementations are
// method-valued entries in `define` specs (drawing resolves overrides),
// and reusable mixins are ordinary bundle types drawn via
// `Type.define(spec, ..., MixinBundle)`. What remains of its machinery
// is buildMethodLayer below, reached through kind specs.

/** Mint a member layer over a base type carrying additional method
 *  implementations — the surviving core of the mixin machinery, reached
 *  through kind specs (`Refinement.define({refines, where, double: self
 *  => …})`). Clones the base's bindings, mints an OWN member set (a
 *  shape layer — overrides run, C3.1), adds the methods as type-local
 *  symbols, and retags construction through the base's construct chain.
 *  Same-name additions are refused (no drawn bundles here, so a match
 *  is a genuine clash with the base, not an override declaration). */
function buildMethodLayer(baseType: ContextValue, methods: { name: string; impl: Value }[]): ContextValue {
  const newType = makeContext();
  for (const [key, binding] of baseType.bindings) {
    if (key === SLOT_KEYS.members || key === SLOT_KEYS.construct) continue;
    if (binding.value) addBinding(newType, key, binding.value);
  }
  // The abstract domain rides as a JS-side property (not a binding) —
  // carry it so downstream layers (preserve) keep constraint rendering.
  const dom = getAbstractDomain(baseType);
  if (dom !== undefined) setAbstractDomain(newType, dom);
  const newMembers = makeContext();
  const baseMembers = getMembers(baseType);
  if (baseMembers?.kind === ValueKind.Structure) {
    for (const [key, binding] of (baseMembers as ContextValue).bindings) {
      if (META_METHOD_NAMES.has(fqnBaseName(key))) continue;
      if (binding.value) addBinding(newMembers, key, binding.value);
    }
  }
  const layerScope = newTypeMemberScope();
  (newType as any).localMemberScope = layerScope;
  for (const m of methods) {
    if (memberBindingByName(newMembers, m.name) !== undefined) {
      throw new AllegroError(`method '${m.name}' conflicts with an existing member`);
    }
    const key = memberFqnIn(layerScope, m.name);
    const impl = dataOf(m.impl);
    if (impl.kind === ValueKind.PrimitiveFunction) {
      addMemberAt(newMembers, key, makeMethodDescriptor(m.name, impl as PrimitiveFunctionValue));
    } else if (impl.kind === ValueKind.ComposedFunction) {
      const desc = makeContext();
      writeShape(desc, MethodType);
      addBinding(desc, "name", stringToBits(m.name));
      addBinding(desc, "value", impl);
      addMemberAt(newMembers, key, desc);
    } else {
      throw new AllegroError(`'${m.name}' must be a function`);
    }
  }
  setMembers(newType, newMembers);
  const parentConstruct = getConstruct(baseType);
  if (parentConstruct?.kind === ValueKind.PrimitiveFunction) {
    setConstruct(newType, makePrimitive("methods.__construct", (args, ctx, evalFn) => {
      const value = (parentConstruct as PrimitiveFunctionValue).fn(args, ctx, evalFn);
      if (channelReadRaw(value, "error") !== undefined) return value;
      return withTypeReplacing(dataOf(value), newType);
    }, true));
  }
  return newType;
}

// --- Build __members for Type ---
// Single block — instanceof/subtypeof are shape-aware (nominal when both
// operands are named, structural otherwise).

const TYPE_MEMBER_SCOPE = typeMemberScopeFqn("Type");
const typeMembers = makeContext();
addMember(typeMembers, TYPE_MEMBER_SCOPE, "instanceof", makeMethodDescriptor("instanceof",
  makePrimitive("Type.instanceof", (args) => {
    const type = args[0] as ContextValue;
    const value = args[1];
    return withType(makeInt(shapeAwareInstanceof(value, type) ? 1 : 0), BoolType);
  })
));
addMember(typeMembers, TYPE_MEMBER_SCOPE, "subtypeof", makeMethodDescriptor("subtypeof",
  makePrimitive("Type.subtypeof", (args) => {
    const typeA = args[0] as ContextValue;
    const typeB = args[1] as ContextValue;
    return withType(makeInt(shapeAwareSubtypeof(typeA, typeB) ? 1 : 0), BoolType);
  })
));
addMember(typeMembers, TYPE_MEMBER_SCOPE, "define", makeMethodDescriptor("define",
  makePrimitive("Type.define", (args, ctx, evalFn) => {
    // D45: `define` is THE construction surface, dispatched on a KIND —
    // self is the kind whose instance is being minted; the remaining args
    // are the kind-specific spec. `define` is a NAMED FACTORY with no
    // independent minting power: it validates the dispatch target is a
    // kind, then delegates to the kind's `construct` authority (C6.1b
    // kinds: Type — (spec, ...bundles) record mint; Refinement —
    // (base, predicate) refinement mint; Interface — (spec) declaration
    // mint).
    const kind = dataOf(args[0]);
    if (kind.kind !== ValueKind.Structure || !isKind(kind as ContextValue)) {
      const name = kind.kind === ValueKind.Structure
        ? (getTypeNameFromCtx(kind as ContextValue) ?? "<anonymous>") : "<value>";
      throw new AllegroError(
        `define must be dispatched on a kind — '${name}' is a type, not a kind. ` +
        `To draw ${name}'s members into a new type, pass it as a bundle: Type.define(spec, ${name})`);
    }
    const construct = getConstruct(kind as ContextValue);
    if (construct?.kind !== ValueKind.PrimitiveFunction) {
      throw new AllegroError(
        `define: kind '${getTypeNameFromCtx(kind as ContextValue)}' holds no constructor authority`);
    }
    return (construct as PrimitiveFunctionValue).fn(args.slice(1), ctx, evalFn);
  })
));
// C6.1b (D45): the fluent API is REMOVED decisively — `where` and
// `invariant` are the refinement mint (`T & pred`, chained for multiple
// clauses); `interface` is `Interface.define(spec, ...bundles)`; `mixin`
// is method-valued entries in `define` specs (or drawing a bundle);
// `preserveOps` is the Refinement spec's `preserve` option.
// C7.2b: `distinct` keeps its kind-member (the newtype mint, now
// symbol-fresh); `constructor` is REMOVED — it mutated a built type
// (against D22); construction authority is declared at mint time via
// the reserved `construct` spec key (ruling R3).
addMember(typeMembers, TYPE_MEMBER_SCOPE, "distinct", makeMethodDescriptor("distinct",
  makePrimitive("Type.distinct", (args) => {
    return wrapType(buildDistinctType(args[0] as ContextValue));
  })
));
setMembers(Type, typeMembers);

// --- Type builder helper ---

/** Names of properties that should be treated as getters (auto-called with self) */
const getterNames = new Set(["length"]);

/**
 * Build a named type. The type's __name carries its identity, so shape-aware
 * comparison treats it nominally when paired against another named type.
 *
 * @param name     Type name (e.g., "Int", "String")
 * @param methods  Instance methods (dispatched via type_dispatch on values of this type)
 * @param options  Optional:
 *   - methodEffects: per-method effect label list. Used to tag stdlib HOFs
 *     (`Array.map`, etc.) as `opaque` so callers' inferred effect sets reflect
 *     "may do anything the callback does" until Slice 2's effect polymorphism
 *     gives them precise types.
 */
function buildType(
  name: string,
  methods: Record<string, PrimitiveFnImpl>,
  options?: { methodEffects?: Record<string, string[]> },
): ContextValue {
  const ctx = makeContext();
  setName(ctx, stringToBits(name));
  writeShape(ctx, Type);
  // Build __members with Method descriptors. C6.1a: each named type
  // declares its members in its OWN name-stable scope — Int.add and
  // Float.add are DISTINCT symbols (neither drew from the other), so
  // symbol-membership conformance between built-ins is declared, never
  // accidental.
  const typeScope = typeMemberScopeFqn(name);
  const members = makeContext();
  for (const [key, fn] of Object.entries(methods)) {
    const fxLabels = options?.methodEffects?.[key];
    const prim = makePrimitive(`${name}.${key}`, fn, false, fxLabels);
    const isGetter = getterNames.has(key);
    // E3: built-in `eq` implementations are kernel-supplied — the
    // parametric equality certificate covers them (equalsIsKernel).
    if (key === "eq") kernelEqImpls.add(prim);
    addMember(members, typeScope, key, makeMethodDescriptor(key, prim, isGetter));
  }
  setMembers(ctx, members);
  return ctx;
}

// --- Bits helpers (duplicated from primitives to avoid circular dep) ---

function toSigned(b: BitsValue): bigint {
  if (b.length === 64 && b.data >= 2n ** 63n) return b.data - 2n ** 64n;
  return b.data;
}

function asBitsTyped(v: Value, ctx: string): BitsValue {
  const p = dataOf(v);
  if (p.kind !== ValueKind.Bits) throw new AllegroError(`${ctx}: expected Bits, got ${p.kind}`);
  return p;
}

// =============================================================================
// Equality protocol (E1 — B-027, structures.md §7, E-R1/D37)
//
// `==` resolves through THREE steps (the §7 resolution):
//   1. Same equality shape → that shape's `equals` (a custom `eq` member
//      dispatches; its absence means the KERNEL STRUCTURAL EQUALS applies —
//      the kernel default is supplied at this chokepoint, not per-type).
//   2. Different shapes → declared coercion to the least common type
//      (E2 — not yet; the seam is marked below).
//   3. No common type → NOT EQUAL (typed Bool false, never a host error).
//
// The equality shape walks the FULL `__refines` chain (slots.equalityShape):
// refinements — member-transparent AND preserve-lifted — are knowledge and
// never separate equal values (D37). `distinct` types mint no refines edge,
// so step 3 makes them unequal to their parent until a coercion is declared.
//
// The kernel structural equals recurses element-wise (dense region) and
// field-wise (named bindings) through THIS protocol, so custom `equals` on
// component types compose. Its lawfulness certificate is parametric —
// refl/sym/trans hold by structural induction given lawful component
// equalities (KERNEL_EQUALS_CERTIFICATE is the E3 tier anchor).
// =============================================================================

/** E3 reads this marker as the discharge tier for the kernel-supplied
 *  equals: proven once, parametrically, by structural induction. */
export const KERNEL_EQUALS_CERTIFICATE = "kernel-structural-parametric";

// -----------------------------------------------------------------------------
// Declared coercions + least common type (E2 — §7 step 2, E-R2)
//
// A declared coercion is an edge (from-shape → to-shape, fn) in a global
// registry keyed by equality-shape identity. `==` across different shapes
// finds the LEAST COMMON TYPE over the graph — the unique candidate both
// operands reach from which every other common candidate is reachable —
// coerces BOTH operands in (symmetric by construction, hence commutative),
// and compares at the target. No common type → not equal (§7 step 3);
// no unique least → error demanding an explicit declaration.
//
// Each declaration carries the two §7 obligations — equality preservation
// (x ==_A y ⟹ coerce(x) ==_B coerce(y)) and pairwise coherence
// (composition triangles commute). E2 instantiates them PENDING; the E3
// machinery routes them through PCP discharge. The kernel Int→Float edge
// ships with both discharged (tier "kernel": the embedding is exact —
// every 64-bit signed Int is representable in an IEEE double's 53-bit
// mantissa only up to 2^53, but equality preservation needs injectivity
// on equals-related pairs, which bit-identical Int equality gives).
// -----------------------------------------------------------------------------

type ObligationStatus = { status: "pending" | "discharged" | "admitted"; tier?: string };

interface CoercionEdge {
  from: ContextValue;
  to: ContextValue;
  fn: Value; // (value at `from` shape) => value at `to` shape
  preservation: ObligationStatus;
  coherence: ObligationStatus;
}

const coercionRegistry = new Map<ContextValue, Map<ContextValue, CoercionEdge>>();

/** Register a coercion edge. Host-side entry point — the `Coercion.declare`
 *  surface and the kernel Int→Float edge both land here. Re-declaring a
 *  pair replaces the edge (last declaration wins; obligations reset). */
export function declareCoercion(
  from: ContextValue, to: ContextValue, fn: Value,
  discharged?: { tier: string },
): void {
  const fromShape = equalityShape(from), toShape = equalityShape(to);
  if (fromShape === toShape) {
    throw new AllegroError(
      `Coercion.declare: '${typeCtxName(from)}' and '${typeCtxName(to)}' share an equality shape — a coercion between them is vacuous`);
  }
  const ob = (): ObligationStatus =>
    discharged ? { status: "discharged", tier: discharged.tier } : { status: "pending" };
  let edges = coercionRegistry.get(fromShape);
  if (!edges) { edges = new Map(); coercionRegistry.set(fromShape, edges); }
  edges.set(toShape, { from: fromShape, to: toShape, fn, preservation: ob(), coherence: ob() });
}

/** The §7 obligations carried by every declared edge, for tests and the
 *  E3 tier machinery. Registry is process-global; `filter` (over the
 *  edge's from/to shapes) scopes the view to one compilation unit. */
export function coercionObligationRecords(
  filter?: (from: ContextValue, to: ContextValue) => boolean,
): {
  from: string; to: string; obligation: "equality-preservation" | "coherence";
  status: "pending" | "discharged" | "admitted"; tier?: string;
}[] {
  const out: ReturnType<typeof coercionObligationRecords> = [];
  for (const edges of coercionRegistry.values()) {
    for (const e of edges.values()) {
      if (filter && !filter(e.from, e.to)) continue;
      out.push({ from: typeCtxName(e.from), to: typeCtxName(e.to), obligation: "equality-preservation", ...e.preservation });
      out.push({ from: typeCtxName(e.from), to: typeCtxName(e.to), obligation: "coherence", ...e.coherence });
    }
  }
  return out;
}

function typeCtxName(t: ContextValue): string {
  const nameV = getName(t);
  return nameV && nameV.kind === ValueKind.Bits ? bitsToString(nameV) : "<anonymous>";
}

/** Every shape reachable from `start` over declared edges (including
 *  `start` itself), with the composed edge path to each. First-found
 *  (BFS-shortest) path wins — deterministic; the coherence obligation is
 *  what makes path choice semantically irrelevant. */
function coercionReach(start: ContextValue): Map<ContextValue, CoercionEdge[]> {
  const reach = new Map<ContextValue, CoercionEdge[]>();
  reach.set(start, []);
  const queue: ContextValue[] = [start];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const edges = coercionRegistry.get(cur);
    if (!edges) continue;
    for (const [to, edge] of edges) {
      if (reach.has(to)) continue;
      reach.set(to, [...reach.get(cur)!, edge]);
      queue.push(to);
    }
  }
  return reach;
}

/** Resolve the least common type of two distinct shapes over the declared
 *  coercion graph. Returns the coercion paths for each operand, or null
 *  when the shapes share no common type (§7 step 3: not equal). Throws
 *  when common types exist but none is least (E-R2: ambiguity demands an
 *  explicit declaration). */
function leastCommonCoercion(
  sa: ContextValue, sb: ContextValue,
): { pathA: CoercionEdge[]; pathB: CoercionEdge[] } | null {
  const ra = coercionReach(sa), rb = coercionReach(sb);
  const common = [...ra.keys()].filter(t => rb.has(t));
  if (common.length === 0) return null;
  // Least = the candidate from which every other candidate is reachable.
  const least = common.filter(t => {
    const rt = coercionReach(t);
    return common.every(o => rt.has(o));
  });
  if (least.length !== 1) {
    throw new AllegroError(
      `equality is ambiguous between '${typeCtxName(sa)}' and '${typeCtxName(sb)}': ` +
      `no unique least common type among {${common.map(typeCtxName).join(", ")}} — declare an explicit coercion`);
  }
  return { pathA: ra.get(least[0])!, pathB: rb.get(least[0])! };
}

/** Apply a coercion path to a value. Identity on the empty path. */
function applyCoercionPath(
  v: Value, path: CoercionEdge[],
  ctx?: ContextValue, evalFn?: EvalFn,
): Value | null {
  let cur = v;
  for (const edge of path) {
    const fn = dataOf(edge.fn);
    if (fn.kind === ValueKind.PrimitiveFunction) {
      cur = (fn as PrimitiveFunctionValue).fn([cur], ctx as any, evalFn as any);
    } else if (fn.kind === ValueKind.ComposedFunction && evalFn && ctx) {
      cur = evalFn(makeExpr(fn, [cur]), ctx);
    } else {
      return null; // no way to run the fn here — decline, not-equal
    }
  }
  return cur;
}

/** Protocol equality as a host boolean. Total: any resolved value pair
 *  answers true/false, never throws. */
export function protocolEqualsBool(
  a: Value, b: Value,
  ctx?: ContextValue, evalFn?: EvalFn,
): boolean {
  if (a === b) return true;
  const ta = getType(a), tb = getType(b);
  if (ta && tb) {
    const sa = equalityShape(ta), sb = equalityShape(tb);
    if (sa !== sb) {
      // §7 step 2 (E2): coerce both operands to the least common type
      // over the declared coercion graph and compare there. Symmetric by
      // construction — both orders resolve the same target.
      const lct = leastCommonCoercion(sa, sb);
      if (lct === null) return false;                // §7 step 3
      const ca = applyCoercionPath(a, lct.pathA, ctx, evalFn);
      const cb = applyCoercionPath(b, lct.pathB, ctx, evalFn);
      if (ca === null || cb === null) return false;
      return protocolEqualsBool(ca, cb, ctx, evalFn);
    }
    const m = typeMethod(sa, "eq");                  // §7 step 1: custom equals
    if (m) {
      if (m.kind === ValueKind.PrimitiveFunction) {
        const r = (m as PrimitiveFunctionValue).fn([dataOf(a), dataOf(b)], ctx as any, evalFn as any);
        const rd = dataOf(r);
        return rd.kind === ValueKind.Bits && (rd as BitsValue).data !== 0n;
      }
      if (m.kind === ValueKind.ComposedFunction && evalFn && ctx) {
        // Spec-supplied `eq` method: (self, other) — full values flow in.
        const r = evalFn(makeExpr(m, [a, b]), ctx);
        const rd = dataOf(r);
        return rd.kind === ValueKind.Bits && (rd as BitsValue).data !== 0n;
      }
    }
  }
  return kernelStructuralEquals(dataOf(a), dataOf(b), ctx, evalFn);
}

/** The kernel structural equals over data-plane representations. Bits
 *  compare by length+payload; Structures compare dense elements and
 *  non-meta named bindings, recursing through the protocol; everything
 *  else (functions, params, symbols, expressions) is identity-only. */
function kernelStructuralEquals(
  da: Value, db: Value,
  ctx?: ContextValue, evalFn?: EvalFn,
): boolean {
  if (da === db) return true;
  if (da.kind !== db.kind) return false;
  if (da.kind === ValueKind.Bits) {
    const ba = da as BitsValue, bb = db as BitsValue;
    return ba.length === bb.length && ba.data === bb.data;
  }
  if (da.kind === ValueKind.Structure) {
    const ca = da as ContextValue, cb = db as ContextValue;
    // TYPE VALUES (anything holding a member set or construct authority —
    // types, kinds, interfaces, generics) are IDENTITY-only: they are
    // minted once / memoized, so identity IS their equality. Structural
    // comparison over their (mostly meta) bindings would false-positive
    // distinct types as equal.
    if (getMembers(ca) !== undefined || getConstruct(ca) !== undefined ||
        getMembers(cb) !== undefined || getConstruct(cb) !== undefined) {
      return false; // da === db already answered the equal case
    }
    const ea = elementsOf(ca), eb = elementsOf(cb);
    if (ea.length !== eb.length) return false;
    for (let i = 0; i < ea.length; i++) {
      if (!protocolEqualsBool(ea[i], eb[i], ctx, evalFn)) return false;
    }
    const fa = namedFieldsOf(ca), fb = namedFieldsOf(cb);
    if (fa.size !== fb.size) return false;
    for (const [k, va] of fa) {
      const vb = fb.get(k);
      if (vb === undefined) return false;
      if (!protocolEqualsBool(va, vb, ctx, evalFn)) return false;
    }
    return true;
  }
  return false;
}

/** Named user-visible fields of a Structure: skip meta slots (`__*`) and
 *  the dense region's lazily-materialized numeric-key view (elements are
 *  compared through `elementsOf`, not twice). */
function namedFieldsOf(c: ContextValue): Map<string, Value> {
  const out = new Map<string, Value>();
  for (const [k, bnd] of c.bindings) {
    if (bnd.value === undefined) continue;
    if (isMetaSlotKey(k)) continue;
    if (/^\d+$/.test(k)) continue;
    out.set(k, bnd.value);
  }
  return out;
}

/** The `==` / `!=` chokepoint for the evaluator's dispatch and the
 *  `typed_eq`/`typed_neq` path. Returns a typed Bool, or null to DECLINE
 *  (unresolved or untyped operand → caller falls through to the legacy
 *  raw-bits path, preserving base-mode Allegretto semantics). `!=` is
 *  DERIVED — the negation of protocol equality, so the pair stays
 *  coherent by construction. */
export function protocolEquals(
  left: Value, right: Value, negate: boolean,
  ctx?: ContextValue, evalFn?: EvalFn,
): Value | null {
  if (!isResolved(left) || !isResolved(right)) return null;
  const ta = getType(left), tb = getType(right);
  if (!ta || !tb) return null;
  const eq = protocolEqualsBool(left, right, ctx, evalFn);
  return withType(makeInt((negate ? !eq : eq) ? 1 : 0), BoolType);
}

// =============================================================================
// Law obligations + discharge tiers (E3 — B-027 §8, E-R3/E-R4/E-R5, D34/D38)
//
// Drawing a law-bearing member set instantiates one PCP obligation per law,
// quantifier specialized to the implementing type. Discharge walks the D34
// spectrum at instantiation time:
//   kernel     — the law carries a kernel certificate AND the referenced
//                implementation is kernel-supplied (parametric proof, free);
//   enumerated — the quantifier domain is finite (Bool) and full
//                enumeration holds (PE-as-discharge over the whole domain);
//   sampled    — F7-style bounded sampling SURVIVED (not proof — recorded
//                as its own status); a COUNTEREXAMPLE HALTS with concrete
//                inputs (build safety in);
//   witnessed  — a discharged Proof term attached post-hoc via
//                `Law.witness` (the `by` path);
//   pending    — none of the above; exported through the H2 obligations
//                surface for PCP workers.
// E4 adds the `assume law` admitted tier + the first strict gate.
// =============================================================================

/** Kernel-supplied equality implementations (built-in scalar `eq` methods).
 *  The parametric kernel certificate covers exactly these plus the kernel
 *  structural default (= no `eq` member at all). */
const kernelEqImpls = new WeakSet<object>();

interface LawObligationEntry {
  type: ContextValue;
  law: string;
  status: "discharged" | "sampled" | "pending" | "admitted";
  tier?: string; // "kernel" | "enumerated" | "sampled" | "witnessed" | "admitted"
  counterexample?: string;
}

const lawObligationsReg: LawObligationEntry[] = [];

// The precompile pass (runtime.ts precompileFunctions) evaluates every
// binding once to detect function shapes — a `Type.define`/`Refinement.
// define` there mints a THROWAWAY type object before the real evaluation
// mints the bound one. Obligations attach to DEFINITIONS, not exploratory
// evaluations, so the pass suspends instantiation (and the E-R5 gate —
// the real evaluation re-runs both).
let lawInstantiationSuspended = false;

/** Suspend/resume law-obligation instantiation + the E-R5 purity gate
 *  (used by the runtime's precompile pass around its exploratory
 *  binding evaluations). */
export function setLawInstantiationSuspended(b: boolean): void {
  lawInstantiationSuspended = b;
}

/** The law obligations instantiated so far, names resolved at read time
 *  (types are auto-named after definition). The E3 read surface for
 *  tests, the Verdict, and the H2 obligations export. The registry is
 *  process-global; pass `filter` to scope the view to one compilation
 *  unit's types (pcp.ts filters by the eval scope's bound values so a
 *  file's Verdict never lists another module's obligations). */
export function lawObligationRecords(filter?: (type: ContextValue) => boolean): {
  type: string; law: string; status: "discharged" | "sampled" | "pending" | "admitted";
  tier?: string; counterexample?: string;
}[] {
  return lawObligationsReg
    .filter(e => !filter || filter(e.type))
    .map(e => ({
      type: typeCtxName(e.type),
      law: e.law,
      status: e.status,
      ...(e.tier !== undefined ? { tier: e.tier } : {}),
      ...(e.counterexample !== undefined ? { counterexample: e.counterexample } : {}),
    }));
}

/** Is this type's equality resolution kernel-supplied? True when the
 *  equality shape has no custom `eq` member (kernel structural equals
 *  applies at the protocol chokepoint) or its `eq` is a kernel scalar
 *  implementation. */
function equalsIsKernel(t: ContextValue): boolean {
  const impl = typeMethod(equalityShape(t), "eq");
  return impl === null || kernelEqImpls.has(dataOf(impl));
}

/** Quantifier samples for a law over `t`. `exhaustive` marks FULL domain
 *  enumeration (Bool) — survival there is proof (tier "enumerated"), not
 *  sampling. Int-backed domains sample (refinement interval lo..lo+3, or
 *  the F7 default mix). Returns null when the domain isn't sampleable
 *  (records, strings, …) — the obligation stays pending. */
function lawSamples(t: ContextValue): { samples: Value[]; exhaustive: boolean } | null {
  // Walk the refines chain to the base shape (a Bool/Int refinement
  // quantifies over the refined subdomain but dispatches at the base).
  let base: ContextValue = t;
  for (let guard = 0; guard < 64; guard++) {
    const p = getRefines(base);
    if (p?.kind !== ValueKind.Structure) break;
    base = p as ContextValue;
  }
  const baseName = getTypeNameFromCtx(base);
  if (baseName === "Bool") {
    return {
      samples: [withType(makeInt(1), BoolType), withType(makeInt(0), BoolType)],
      exhaustive: true,
    };
  }
  const dom = getAbstractDomain(t) ?? (t as any).abstractDomain;
  if (dom && dom.kind === "interval") {
    const lo = Number.isFinite(dom.lo) ? dom.lo : 0;
    const hi = Number.isFinite(dom.hi) ? dom.hi : Infinity;
    const out: Value[] = [];
    for (let i = 0; i < 4; i++) {
      if (lo + i <= hi) out.push(withType(makeInt(lo + i), IntType));
    }
    if (out.length > 0) return { samples: out, exhaustive: false };
  }
  if (baseName === "Int") {
    return { samples: [0, 1, 5, -3].map(n => withType(makeInt(n), IntType)), exhaustive: false };
  }
  return null;
}

/** Render a sample tuple for counterexample messages. */
function renderLawArgs(args: Value[]): string {
  return args.map(a => {
    const d = dataOf(a);
    if (d.kind !== ValueKind.Bits) return "?";
    const b = d as BitsValue;
    if (b.length !== 64) return "?";
    const signed = b.data >= 2n ** 63n ? b.data - 2n ** 64n : b.data;
    if (getTypeName(a) === "Bool") return signed === 0n ? "false" : "true";
    return String(signed);
  }).join(", ");
}

/** Evaluate a law proposition body on one argument tuple. Returns true /
 *  false when the body folds to a Bits truth value, null when it can't be
 *  evaluated here (missing evalFn, residual result). */
function runLawProp(body: Value, args: Value[], ctx?: ContextValue, evalFn?: EvalFn): boolean | null {
  const d = dataOf(body);
  try {
    let result: Value;
    if (d.kind === ValueKind.PrimitiveFunction) {
      result = (d as PrimitiveFunctionValue).fn(args, ctx as any, evalFn as any);
    } else if (d.kind === ValueKind.ComposedFunction && evalFn && ctx) {
      result = evalFn(makeExpr(d, args), ctx);
    } else {
      return null;
    }
    const rd = dataOf(result);
    if (rd.kind !== ValueKind.Bits) return null;
    return (rd as BitsValue).data !== 0n;
  } catch {
    return null;
  }
}

/** Instantiate one law obligation for an implementing type and attempt
 *  discharge down the tier ladder. A concrete counterexample HALTS
 *  definition (AllegroError) — a false law is unsound by construction. */
function instantiateLaw(
  implType: ContextValue,
  desc: ContextValue,
  ctx?: ContextValue,
  evalFn?: EvalFn,
): void {
  if (lawInstantiationSuspended) return;
  const { name, proposition, arity, kernelCertificate } = lawDescriptorParts(desc);

  // Tier 1: parametric kernel certificate — free for kernel-supplied
  // implementations (§8 amortization).
  if (kernelCertificate !== null && equalsIsKernel(implType)) {
    lawObligationsReg.push({ type: implType, law: name, status: "discharged", tier: "kernel" });
    return;
  }

  // Tiers 2-3: enumeration / sampling over the quantifier domain.
  const domain = lawSamples(implType);
  if (domain !== null && arity >= 1 && arity <= 3) {
    // Cartesian product of samples^arity (≤ 4^3 = 64 tuples).
    const tuples: Value[][] = [[]];
    for (let i = 0; i < arity; i++) {
      const next: Value[][] = [];
      for (const t of tuples) for (const s of domain.samples) next.push([...t, s]);
      tuples.length = 0; tuples.push(...next);
    }
    let undecided = false;
    for (const tuple of tuples) {
      const r = runLawProp(proposition, tuple, ctx, evalFn);
      if (r === false) {
        throw new AllegroError(
          `law '${name}' fails for '${typeCtxName(implType)}': counterexample at (${renderLawArgs(tuple)})`);
      }
      if (r === null) { undecided = true; break; }
    }
    if (!undecided) {
      if (domain.exhaustive) {
        lawObligationsReg.push({ type: implType, law: name, status: "discharged", tier: "enumerated" });
      } else {
        // Survival, not proof (D34): recorded as its own status.
        lawObligationsReg.push({ type: implType, law: name, status: "sampled", tier: "sampled" });
      }
      return;
    }
  }

  // Tier 5: pending — exported via the H2 obligations surface.
  lawObligationsReg.push({ type: implType, law: name, status: "pending" });
}

/** Instantiate obligations for every Law descriptor in a member set
 *  (called once per CONCRETE type at definition; bundles and interfaces
 *  declare schemas, they don't implement). Multi-bound keys dedupe by
 *  descriptor identity. */
function instantiateLawsFromMembers(
  implType: ContextValue,
  members: ContextValue,
  ctx?: ContextValue,
  evalFn?: EvalFn,
): void {
  const seen = new Set<Value>();
  for (const [, b] of members.bindings) {
    const desc = b.value;
    if (!desc || desc.kind !== ValueKind.Structure) continue;
    if (!isLawDescriptor(desc as ContextValue)) continue;
    if (seen.has(desc)) continue;
    seen.add(desc);
    instantiateLaw(implType, desc as ContextValue, ctx, evalFn);
  }
}

/** Structural discharged-Proof check (local: proofs.ts imports this
 *  module, so the canonical `isDischargedProof` can't be imported here). */
function isDischargedProofValue(v: Value): boolean {
  const p = dataOf(v);
  if (p.kind !== ValueKind.Structure) return false;
  const d = channelReadRaw(p, "discharged");
  if (!d) return false;
  const dp = dataOf(d);
  return dp.kind === ValueKind.Bits && (dp as BitsValue).data === 1n;
}

/** The witnessed tier (`by` path): attach a discharged Proof term to a
 *  pending/sampled law obligation. E3 minimum verifies the term IS a
 *  discharged Proof; structural proposition-matching for quantified
 *  propositions arrives with the E4/H-arc machinery. */
function witnessLawObligation(implType: ContextValue, lawName: string, proof: Value): void {
  if (!isDischargedProofValue(proof)) {
    throw new AllegroError(
      `Law.witness: the proof term for '${lawName}' is not a discharged Proof`);
  }
  const shape = equalityShape(implType);
  for (let i = lawObligationsReg.length - 1; i >= 0; i--) {
    const e = lawObligationsReg[i];
    if (e.law !== lawName) continue;
    if (e.type !== implType && equalityShape(e.type) !== shape) continue;
    if (e.status === "discharged") return; // already proven — idempotent
    e.status = "discharged";
    e.tier = "witnessed";
    delete e.counterexample;
    return;
  }
  throw new AllegroError(
    `Law.witness: no law obligation '${lawName}' is registered for '${typeCtxName(implType)}'`);
}

/** The admitted tier (E4 — `assume law`, D34): mark a law as ASSUMED for
 *  an implementing type — verdict-visible, same standing as F-arc
 *  admitted facts. Flips a pending/sampled obligation, or REGISTERS an
 *  admitted one when the type never instantiated the law (a custom
 *  equality that never drew Equatable can still be admitted transitive —
 *  that is exactly what unblocks the E4 `proof_trans` gate). A
 *  discharged obligation is left alone (already stronger). */
function admitLawObligation(implType: ContextValue, lawName: string): void {
  const shape = equalityShape(implType);
  for (let i = lawObligationsReg.length - 1; i >= 0; i--) {
    const e = lawObligationsReg[i];
    if (e.law !== lawName) continue;
    if (e.type !== implType && equalityShape(e.type) !== shape) continue;
    if (e.status === "discharged") return; // proven beats admitted — no-op
    e.status = "admitted";
    e.tier = "admitted";
    delete e.counterexample;
    return;
  }
  lawObligationsReg.push({ type: implType, law: lawName, status: "admitted", tier: "admitted" });
}

/** E4: the law backing for `lawName` over the equality of type `t` — the
 *  strict-gate lookup. Kernel-supplied equality resolution (no custom
 *  `eq`, or a built-in scalar eq) is auto-proven by the parametric
 *  certificate; a custom equality answers with its registered
 *  obligation's tier; absent or pending → refused. */
export function equalityLawBacking(t: ContextValue, lawName: string):
  { equality: string; tier: string } | { equality: string; refused: true } {
  const shape = equalityShape(t);
  const name = typeCtxName(shape);
  if (equalsIsKernel(t)) return { equality: name, tier: "kernel" };
  for (let i = lawObligationsReg.length - 1; i >= 0; i--) {
    const e = lawObligationsReg[i];
    if (e.law !== lawName) continue;
    if (e.type !== t && equalityShape(e.type) !== shape) continue;
    if (e.status === "discharged") return { equality: name, tier: e.tier ?? "witnessed" };
    if (e.status === "sampled") return { equality: name, tier: "sampled" };
    if (e.status === "admitted") return { equality: name, tier: "admitted" };
    return { equality: name, refused: true }; // pending
  }
  return { equality: name, refused: true };
}

// --- E-R5: the purity / knowledge-independence gate --------------------------
// `equals` implementations and coercion fns must infer an EMPTY effect set
// — including the `observe` label (`certificate_peek` inside equals is
// exactly the D37 violation: equality must not see knowledge). The
// inspector is injected from primitives.ts (it needs the evaluator's
// precompile, which this module can't import).

let effectsInspector: ((fn: Value, ctx?: ContextValue) => Set<string> | null) | null = null;

/** Register the effect-inference hook (called once from primitives.ts). */
export function setEffectsInspector(f: (fn: Value, ctx?: ContextValue) => Set<string> | null): void {
  effectsInspector = f;
}

// B-028 F3 (CE-R7): the divergence probe — injected per compilation from
// runtime.ts once div analysis has run; answers by function identity
// whether an implementation's inferred set includes `div`.
let divergenceProbe: ((fn: Value) => boolean) | null = null;

/** Register the divergence hook (called per typed compilation). */
export function setDivergenceProbe(f: (fn: Value) => boolean): void {
  divergenceProbe = f;
}

function assertPureForEquality(fnValue: Value, what: string, ctx?: ContextValue): void {
  if (lawInstantiationSuspended) return;
  if (!effectsInspector) return;
  const eff = effectsInspector(fnValue, ctx);
  if (eff && eff.size > 0) {
    throw new AllegroError(
      `${what} must be pure and knowledge-independent (E-R5) — inferred effects: ` +
      `{${[...eff].sort().join(", ")}}`);
  }
  // B-028 F3 (CE-R7): the purity gates see div — an implementation whose
  // termination is undischarged cannot serve as an equality or coercion
  // (mechanical, the same E-R5 pattern; D34's spectrum discharges it).
  if (divergenceProbe && divergenceProbe(fnValue)) {
    throw new AllegroError(
      `${what} must be total (E-R5/CE-R7) — the implementation may diverge; ` +
      `discharge with \`decreases\` or \`assume terminates\``);
  }
}

// B-028 F4 (D32/CE-R7): the invariant-predicate totality gate. Unlike the
// eq/coercion gate above, only DIV matters here — other effects on an
// invariant are covered by the ordinary effect calculus; divergence alone
// can hang the construction guard. Two probes: predicate identity against
// the analyzed corpus, then a callee sweep — an inline predicate lambda
// is never a top-level binding the div analysis walked (and, anonymous,
// cannot recurse on its own), so divergence only enters through named
// callees, which answer through THEIR stamps (the analysis closure made
// those transitive) and, for module imports, their effect channels (the
// F3 leaf seam). Deliberately NO on-demand precompile here: refinement
// creation is a hot path and predicate precompile re-opened the F3
// branch-exploration hazard — the sweep covers the same ground.
function assertInvariantTotal(predicate: Value, ctx?: ContextValue): void {
  if (lawInstantiationSuspended) return;
  const refuse = (via?: string): never => {
    throw new AllegroError(
      `invariant predicate must be total (D32/CE-R7) — ` +
      (via ? `it calls \`${via}\`, which may diverge` : `the predicate may diverge`) +
      `, so the construction guard could hang; discharge with ` +
      `\`decreases\` or \`assume terminates\``);
  };
  if (divergenceProbe && divergenceProbe(predicate)) refuse();
  const via = divCarrierCalledBy(predicate, ctx);
  if (via !== null) refuse(via);
}

/** Callee sweep for the gate above: collect the free symbol names in the
 *  predicate's body, resolve each in scope, and answer with the first
 *  whose function value carries div (identity probe, effect channel, or
 *  inferred-set stash). Null = no diverging callee found. */
function divCarrierCalledBy(predicate: Value, ctx?: ContextValue): string | null {
  if (!ctx) return null;
  const p = dataOf(predicate);
  if (p.kind !== ValueKind.ComposedFunction) return null;
  const names = new Set<string>();
  const seen = new Set<Value>();
  const walk = (v: Value): void => {
    if (!v || typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    if (v.kind === ValueKind.Symbol) { names.add(v.name); return; }
    if (v.kind === ValueKind.Expression) {
      walk(v.fn);
      for (const a of v.args) walk(a);
      return;
    }
    if (v.kind === ValueKind.ComposedFunction) walk((v as ComposedFunctionValue).body);
  };
  walk((p as ComposedFunctionValue).body);
  for (const name of names) {
    const b = scopeLookup(ctx, name);
    const v = b?.value;
    if (!v) continue;
    const d = dataOf(v);
    if (d.kind !== ValueKind.ComposedFunction && d.kind !== ValueKind.PrimitiveFunction) continue;
    if (divergenceProbe && divergenceProbe(v)) return name;
    const eff = fnEffectsOf(v);
    if (eff?.has("div")) return name;
  }
  return null;
}

// =============================================================================
// Int Type
// =============================================================================

const intMethods: Record<string, PrimitiveFnImpl> = {
  // Arithmetic — self is first arg, other is second
  // All return typed values (IntType referenced via closure, initialized before any call)
  add: (args) => {
    const a = toSigned(asBitsTyped(args[0], "Int.add"));
    const b = toSigned(asBitsTyped(args[1], "Int.add"));
    return withType(makeInt(Number(a + b)), IntType);
  },
  sub: (args) => {
    const a = toSigned(asBitsTyped(args[0], "Int.sub"));
    const b = toSigned(asBitsTyped(args[1], "Int.sub"));
    return withType(makeInt(Number(a - b)), IntType);
  },
  mul: (args) => {
    const a = toSigned(asBitsTyped(args[0], "Int.mul"));
    const b = toSigned(asBitsTyped(args[1], "Int.mul"));
    return withType(makeInt(Number(a * b)), IntType);
  },
  div: (args) => {
    const a = toSigned(asBitsTyped(args[0], "Int.div"));
    const b = toSigned(asBitsTyped(args[1], "Int.div"));
    if (b === 0n) throw new AllegroError("Int.div: division by zero");
    return withType(makeInt(Number(a / b)), IntType);
  },
  mod: (args) => {
    const a = toSigned(asBitsTyped(args[0], "Int.mod"));
    const b = toSigned(asBitsTyped(args[1], "Int.mod"));
    if (b === 0n) throw new AllegroError("Int.mod: division by zero");
    return withType(makeInt(Number(a % b)), IntType);
  },

  // Comparison — return typed Bool
  eq: (args) => {
    const a = asBitsTyped(args[0], "Int.eq");
    const b = asBitsTyped(args[1], "Int.eq");
    return withType(makeInt(a.data === b.data ? 1 : 0), BoolType);
  },
  neq: (args) => {
    const a = asBitsTyped(args[0], "Int.neq");
    const b = asBitsTyped(args[1], "Int.neq");
    return withType(makeInt(a.data !== b.data ? 1 : 0), BoolType);
  },
  lt: (args) => {
    const a = toSigned(asBitsTyped(args[0], "Int.lt"));
    const b = toSigned(asBitsTyped(args[1], "Int.lt"));
    return withType(makeInt(a < b ? 1 : 0), BoolType);
  },
  gt: (args) => {
    const a = toSigned(asBitsTyped(args[0], "Int.gt"));
    const b = toSigned(asBitsTyped(args[1], "Int.gt"));
    return withType(makeInt(a > b ? 1 : 0), BoolType);
  },
  lte: (args) => {
    const a = toSigned(asBitsTyped(args[0], "Int.lte"));
    const b = toSigned(asBitsTyped(args[1], "Int.lte"));
    return withType(makeInt(a <= b ? 1 : 0), BoolType);
  },
  gte: (args) => {
    const a = toSigned(asBitsTyped(args[0], "Int.gte"));
    const b = toSigned(asBitsTyped(args[1], "Int.gte"));
    return withType(makeInt(a >= b ? 1 : 0), BoolType);
  },

  // Conversion
  toString: ((args: Value[]) => {
    const a = toSigned(asBitsTyped(args[0], "Int.toString"));
    return withType(stringToBits(String(a)), StringType);
  }) as PrimitiveFnImpl,
  // Math
  abs: (args) => {
    const a = toSigned(asBitsTyped(args[0], "Int.abs"));
    return withType(makeInt(Number(a < 0n ? -a : a)), IntType);
  },
  toFloat: (args) => {
    const a = toSigned(asBitsTyped(args[0], "Int.toFloat"));
    return withType(makeFloat(Number(a)), FloatType);
  },
};

// =============================================================================
// String Type
// =============================================================================

const stringMethods: Record<string, PrimitiveFnImpl> = {
  // String + String concatenation
  add: (args) => {
    const a = bitsToString(asBitsTyped(args[0], "String.add"));
    const b = bitsToString(asBitsTyped(args[1], "String.add"));
    return withType(stringToBits(a + b), StringType);
  },

  // Comparison — return typed Bool
  eq: (args) => {
    const a = bitsToString(asBitsTyped(args[0], "String.eq"));
    const b = bitsToString(asBitsTyped(args[1], "String.eq"));
    return withType(makeInt(a === b ? 1 : 0), BoolType);
  },
  neq: (args) => {
    const a = bitsToString(asBitsTyped(args[0], "String.neq"));
    const b = bitsToString(asBitsTyped(args[1], "String.neq"));
    return withType(makeInt(a !== b ? 1 : 0), BoolType);
  },

  // Properties / methods
  length: (args) => {
    const s = bitsToString(asBitsTyped(args[0], "String.length"));
    return withType(makeInt(s.length), IntType);
  },
  slice: (args) => {
    const s = bitsToString(asBitsTyped(args[0], "String.slice"));
    const start = Number(toSigned(asBitsTyped(args[1], "String.slice")));
    const end = args.length > 2
      ? Number(toSigned(asBitsTyped(args[2], "String.slice")))
      : s.length;
    return withType(stringToBits(s.slice(start, end)), StringType);
  },
  indexOf: (args) => {
    const s = bitsToString(asBitsTyped(args[0], "String.indexOf"));
    const search = bitsToString(asBitsTyped(args[1], "String.indexOf"));
    return withType(makeInt(s.indexOf(search)), IntType);
  },
  trim: (args) => {
    const s = bitsToString(asBitsTyped(args[0], "String.trim"));
    return withType(stringToBits(s.trim()), StringType);
  },
  startsWith: (args) => {
    const s = bitsToString(asBitsTyped(args[0], "String.startsWith"));
    const prefix = bitsToString(asBitsTyped(args[1], "String.startsWith"));
    return withType(makeInt(s.startsWith(prefix) ? 1 : 0), BoolType);
  },
  endsWith: (args) => {
    const s = bitsToString(asBitsTyped(args[0], "String.endsWith"));
    const suffix = bitsToString(asBitsTyped(args[1], "String.endsWith"));
    return withType(makeInt(s.endsWith(suffix) ? 1 : 0), BoolType);
  },
  includes: (args) => {
    const s = bitsToString(asBitsTyped(args[0], "String.includes"));
    const search = bitsToString(asBitsTyped(args[1], "String.includes"));
    return withType(makeInt(s.includes(search) ? 1 : 0), BoolType);
  },
  split: (args) => {
    const s = bitsToString(asBitsTyped(args[0], "String.split"));
    const delimiter = bitsToString(asBitsTyped(args[1], "String.split"));
    const parts = s.split(delimiter);
    return makeArray(parts.map(p => withType(stringToBits(p), StringType)));
  },
  replace: (args) => {
    const s = bitsToString(asBitsTyped(args[0], "String.replace"));
    const search = bitsToString(asBitsTyped(args[1], "String.replace"));
    const replacement = bitsToString(asBitsTyped(args[2], "String.replace"));
    // Optional count parameter: default replaces all occurrences
    const count = args.length > 3
      ? Number(toSigned(asBitsTyped(args[3], "String.replace")))
      : -1; // -1 = replace all
    let result = s;
    if (count === -1) {
      result = result.split(search).join(replacement);
    } else {
      for (let i = 0; i < count; i++) {
        const idx = result.indexOf(search);
        if (idx === -1) break;
        result = result.slice(0, idx) + replacement + result.slice(idx + search.length);
      }
    }
    return withType(stringToBits(result), StringType);
  },
  toUpperCase: (args) => {
    const s = bitsToString(asBitsTyped(args[0], "String.toUpperCase"));
    return withType(stringToBits(s.toUpperCase()), StringType);
  },
  toLowerCase: (args) => {
    const s = bitsToString(asBitsTyped(args[0], "String.toLowerCase"));
    return withType(stringToBits(s.toLowerCase()), StringType);
  },
  charAt: (args) => {
    const s = bitsToString(asBitsTyped(args[0], "String.charAt"));
    const idx = Number(toSigned(asBitsTyped(args[1], "String.charAt")));
    if (idx < 0 || idx >= s.length) return withType(stringToBits(""), StringType);
    return withType(stringToBits(s.charAt(idx)), StringType);
  },
  repeat: (args) => {
    const s = bitsToString(asBitsTyped(args[0], "String.repeat"));
    const count = Number(toSigned(asBitsTyped(args[1], "String.repeat")));
    if (count < 0) throw new AllegroError("String.repeat: count must be non-negative");
    return withType(stringToBits(s.repeat(count)), StringType);
  },
  toCharCodes: (args) => {
    const s = bitsToString(asBitsTyped(args[0], "String.toCharCodes"));
    const codes: Value[] = [];
    for (let i = 0; i < s.length; i++) {
      codes.push(withType(makeInt(s.charCodeAt(i)), IntType));
    }
    return makeArray(codes);
  },
  toString: ((args: Value[]) => {
    return args[0]; // strings are already strings
  }) as PrimitiveFnImpl,
};

// =============================================================================
// Float Type
// =============================================================================

const floatMethods: Record<string, PrimitiveFnImpl> = {
  add: (args) => withType(makeFloat(bitsToFloat(asBitsTyped(args[0], "Float.add")) + bitsToFloat(asBitsTyped(args[1], "Float.add"))), FloatType),
  sub: (args) => withType(makeFloat(bitsToFloat(asBitsTyped(args[0], "Float.sub")) - bitsToFloat(asBitsTyped(args[1], "Float.sub"))), FloatType),
  mul: (args) => withType(makeFloat(bitsToFloat(asBitsTyped(args[0], "Float.mul")) * bitsToFloat(asBitsTyped(args[1], "Float.mul"))), FloatType),
  div: (args) => {
    const b = bitsToFloat(asBitsTyped(args[1], "Float.div"));
    if (b === 0) throw new AllegroError("Float.div: division by zero");
    return withType(makeFloat(bitsToFloat(asBitsTyped(args[0], "Float.div")) / b), FloatType);
  },
  mod: (args) => {
    const b = bitsToFloat(asBitsTyped(args[1], "Float.mod"));
    if (b === 0) throw new AllegroError("Float.mod: division by zero");
    return withType(makeFloat(bitsToFloat(asBitsTyped(args[0], "Float.mod")) % b), FloatType);
  },
  eq: (args) => withType(makeInt(bitsToFloat(asBitsTyped(args[0], "Float.eq")) === bitsToFloat(asBitsTyped(args[1], "Float.eq")) ? 1 : 0), BoolType),
  neq: (args) => withType(makeInt(bitsToFloat(asBitsTyped(args[0], "Float.neq")) !== bitsToFloat(asBitsTyped(args[1], "Float.neq")) ? 1 : 0), BoolType),
  lt: (args) => withType(makeInt(bitsToFloat(asBitsTyped(args[0], "Float.lt")) < bitsToFloat(asBitsTyped(args[1], "Float.lt")) ? 1 : 0), BoolType),
  gt: (args) => withType(makeInt(bitsToFloat(asBitsTyped(args[0], "Float.gt")) > bitsToFloat(asBitsTyped(args[1], "Float.gt")) ? 1 : 0), BoolType),
  lte: (args) => withType(makeInt(bitsToFloat(asBitsTyped(args[0], "Float.lte")) <= bitsToFloat(asBitsTyped(args[1], "Float.lte")) ? 1 : 0), BoolType),
  gte: (args) => withType(makeInt(bitsToFloat(asBitsTyped(args[0], "Float.gte")) >= bitsToFloat(asBitsTyped(args[1], "Float.gte")) ? 1 : 0), BoolType),
  toString: ((args: Value[]) => withType(stringToBits(String(bitsToFloat(asBitsTyped(args[0], "Float.toString")))), StringType)) as PrimitiveFnImpl,
  // Math methods
  sqrt: (args) => withType(makeFloat(Math.sqrt(bitsToFloat(asBitsTyped(args[0], "Float.sqrt")))), FloatType),
  pow: (args) => withType(makeFloat(Math.pow(bitsToFloat(asBitsTyped(args[0], "Float.pow")), bitsToFloat(asBitsTyped(args[1], "Float.pow")))), FloatType),
  abs: (args) => withType(makeFloat(Math.abs(bitsToFloat(asBitsTyped(args[0], "Float.abs")))), FloatType),
  floor: (args) => withType(makeInt(Math.floor(bitsToFloat(asBitsTyped(args[0], "Float.floor")))), IntType),
  ceil: (args) => withType(makeInt(Math.ceil(bitsToFloat(asBitsTyped(args[0], "Float.ceil")))), IntType),
  round: (args) => withType(makeInt(Math.round(bitsToFloat(asBitsTyped(args[0], "Float.round")))), IntType),
  sin: (args) => withType(makeFloat(Math.sin(bitsToFloat(asBitsTyped(args[0], "Float.sin")))), FloatType),
  cos: (args) => withType(makeFloat(Math.cos(bitsToFloat(asBitsTyped(args[0], "Float.cos")))), FloatType),
  tan: (args) => withType(makeFloat(Math.tan(bitsToFloat(asBitsTyped(args[0], "Float.tan")))), FloatType),
  log: (args) => withType(makeFloat(Math.log(bitsToFloat(asBitsTyped(args[0], "Float.log")))), FloatType),
  log2: (args) => withType(makeFloat(Math.log2(bitsToFloat(asBitsTyped(args[0], "Float.log2")))), FloatType),
  log10: (args) => withType(makeFloat(Math.log10(bitsToFloat(asBitsTyped(args[0], "Float.log10")))), FloatType),
  exp: (args) => withType(makeFloat(Math.exp(bitsToFloat(asBitsTyped(args[0], "Float.exp")))), FloatType),
};

// =============================================================================
// Bool Type
// =============================================================================

const boolMethods: Record<string, PrimitiveFnImpl> = {
  and: (args) => {
    const a = asBitsTyped(args[0], "Bool.and").data !== 0n;
    const b = asBitsTyped(args[1], "Bool.and").data !== 0n;
    return withType(makeInt(a && b ? 1 : 0), BoolType);
  },
  or: (args) => {
    const a = asBitsTyped(args[0], "Bool.or").data !== 0n;
    const b = asBitsTyped(args[1], "Bool.or").data !== 0n;
    return withType(makeInt(a || b ? 1 : 0), BoolType);
  },
  not: (args) => {
    const a = asBitsTyped(args[0], "Bool.not").data !== 0n;
    return withType(makeInt(a ? 0 : 1), BoolType);
  },
  eq: (args) => withType(makeInt(asBitsTyped(args[0], "Bool.eq").data === asBitsTyped(args[1], "Bool.eq").data ? 1 : 0), BoolType),
  neq: (args) => withType(makeInt(asBitsTyped(args[0], "Bool.neq").data !== asBitsTyped(args[1], "Bool.neq").data ? 1 : 0), BoolType),
  toString: ((args: Value[]) => {
    const a = asBitsTyped(args[0], "Bool.toString").data !== 0n;
    return withType(stringToBits(a ? "true" : "false"), StringType);
  }) as PrimitiveFnImpl,
};

// =============================================================================
// Array Type
// Arrays are Contexts with numeric string keys ("0", "1", ...) plus the length slot.
// =============================================================================

/** Build a raw array Context (without type wrapping). Used internally. */
// C4.2: numeric-keyed structures store elements in the dense region —
// no per-element Binding objects, no string keys, no __length binding.
// The legacy bindings view materializes lazily for stragglers.
function makeRawArrayCtx(elements: Value[]): ContextValue {
  return makeDenseArrayCtx(elements);
}

/** Create a typed Array value from a list of Allegro values.
 *  Infers element type: if all elements have the same type, uses Array[T].
 *  Otherwise uses bare Array (unparameterized). */
export function makeArray(elements: Value[]): Value {
  const ctx = makeRawArrayCtx(elements);

  // Infer element type from elements
  // Note: ArrayType may not be initialized during module loading (circular),
  // so we check before using it for parameterized types.
  let arrayType: ContextValue = ArrayType;
  if (elements.length > 0 && isGenericType(ArrayType)) {
    const firstType = getType(elements[0]);
    if (firstType && elements.every(e => {
      const t = getType(e);
      return t !== null && getTypeName(e) === getTypeName(elements[0]);
    })) {
      arrayType = applyGenericType(ArrayType, [firstType]);
    }
  }

  return withType(ctx, arrayType);
}

function arrayElements(ctx: ContextValue): Value[] {
  return elementsOf(ctx);
}

// =============================================================================
// Allegro ComposedFunctions for map/filter/reduce
// These are proper Allegro functions built via AST construction.
// Foundation primitives (length, get, concat, etc.) remain as TypeScript.
// =============================================================================

// Inline primitives for use inside ComposedFunctions (no circular import)
const arrLengthPrim = makePrimitive("arr_length", (args) => {
  const ctx = dataOf(args[0]) as ContextValue;
  return withType(getSlotCount(ctx) ?? makeInt(0), IntType);
});
const arrGetPrim = makePrimitive("arr_get", (args) => {
  const ctx = dataOf(args[0]) as ContextValue;
  const idx = Number(toSigned(asBitsTyped(dataOf(args[1]), "arr_get")));
  const v = indexGet(ctx, idx);
  if (v === undefined) throw new AllegroError(`Array index ${idx} out of bounds`);
  return v;
});
const intGtePrim = makePrimitive("int_gte", (args) => {
  return withType(
    makeInt(toSigned(asBitsTyped(dataOf(args[0]), "int_gte")) >= toSigned(asBitsTyped(dataOf(args[1]), "int_gte")) ? 1 : 0),
    BoolType,
  );
});
const intAddPrim = makePrimitive("int_add", (args) => {
  const a = toSigned(asBitsTyped(dataOf(args[0]), "int_add"));
  const b = toSigned(asBitsTyped(dataOf(args[1]), "int_add"));
  return withType(makeInt(Number(a + b)), IntType);
});
const evalIfPrim = makePrimitive("eval_if", (args, ctx, evalFn) => {
  const cond = evalFn!(args[0], ctx!);
  const condP = dataOf(cond);
  if (condP.kind === ValueKind.Bits) {
    const branch = (condP as BitsValue).data !== 0n ? args[1] : args[2];
    const evalBranch = evalFn!(branch, ctx!);
    if (evalBranch.kind === ValueKind.ComposedFunction && evalBranch.params.length === 0) {
      return evalFn!(evalBranch.body, ctx!);
    }
    return evalBranch;
  }
  return makeExpr(evalIfPrim, [cond, args[1], args[2]]);
}, true);
const makeArrayPrim = makePrimitive("make_array", (args, ctx, evalFn) => {
  const elems = args.map(a => evalFn!(a, ctx!));
  return makeArray(elems);
}, true);
const arrConcatPrim = makePrimitive("arr_concat", (args, ctx, evalFn) => {
  const a = evalFn!(args[0], ctx!);
  const b = evalFn!(args[1], ctx!);
  const aCtx = dataOf(a) as ContextValue;
  const bCtx = dataOf(b) as ContextValue;
  return makeArray([...arrayElements(aCtx), ...arrayElements(bCtx)]);
}, true);

/** Helper: wrap body in a zero-param thunk for eval_if branches */
function thunk(body: Value): ComposedFunctionValue {
  return makeComposedFn([], body);
}

/**
 * Build Allegro ComposedFunction for Array.map:
 *   map_impl(arr, fn, i) =>
 *     if i >= arr.length then []
 *     else [fn(arr[i])].concat(map_impl(arr, fn, i + 1))
 */
function buildMapFn(): ComposedFunctionValue {
  const pArr = makeParam(0, "arr");
  const pFn = makeParam(1, "fn");
  const pI = makeParam(2, "i");

  // arr.length
  const len = makeExpr(arrLengthPrim, [pArr]);
  // i >= arr.length
  const cond = makeExpr(intGtePrim, [pI, len]);
  // Base case: empty array
  const baseCase = makeExpr(makeArrayPrim, []);
  // arr[i]
  const elem = makeExpr(arrGetPrim, [pArr, pI]);
  // fn(arr[i])
  const mapped = makeExpr(pFn, [elem]);
  // [fn(arr[i])]
  const single = makeExpr(makeArrayPrim, [mapped]);
  // i + 1
  const nextI = makeExpr(intAddPrim, [pI, makeInt(1)]);

  // Recursive reference — will be set after fn is created
  const mapFnRef: { fn: ComposedFunctionValue | null } = { fn: null };
  const recurse = makePrimitive("map_recurse", (args, ctx, evalFn) => {
    return evalFn!(makeExpr(mapFnRef.fn!, args), ctx!);
  }, true);

  // map_impl(arr, fn, i + 1)
  const rest = makeExpr(recurse, [pArr, pFn, nextI]);
  // [fn(arr[i])].concat(map_impl(arr, fn, i + 1))
  const concatResult = makeExpr(arrConcatPrim, [single, rest]);

  const body = makeExpr(evalIfPrim, [cond, thunk(baseCase), thunk(concatResult)]);
  const fn = makeComposedFn([pArr, pFn, pI], body);
  mapFnRef.fn = fn;
  return fn;
}

/**
 * Build Allegro ComposedFunction for Array.filter:
 *   filter_impl(arr, fn, i) =>
 *     if i >= arr.length then []
 *     else if fn(arr[i]) then [arr[i]].concat(filter_impl(arr, fn, i + 1))
 *          else filter_impl(arr, fn, i + 1)
 */
function buildFilterFn(): ComposedFunctionValue {
  const pArr = makeParam(0, "arr");
  const pFn = makeParam(1, "fn");
  const pI = makeParam(2, "i");

  const len = makeExpr(arrLengthPrim, [pArr]);
  const cond = makeExpr(intGtePrim, [pI, len]);
  const baseCase = makeExpr(makeArrayPrim, []);
  const elem = makeExpr(arrGetPrim, [pArr, pI]);
  const testResult = makeExpr(pFn, [elem]);
  const single = makeExpr(makeArrayPrim, [elem]);
  const nextI = makeExpr(intAddPrim, [pI, makeInt(1)]);

  const filterFnRef: { fn: ComposedFunctionValue | null } = { fn: null };
  const recurse = makePrimitive("filter_recurse", (args, ctx, evalFn) => {
    return evalFn!(makeExpr(filterFnRef.fn!, args), ctx!);
  }, true);

  const rest = makeExpr(recurse, [pArr, pFn, nextI]);
  const concatResult = makeExpr(arrConcatPrim, [single, rest]);

  // Inner if: if fn(arr[i]) then [arr[i]].concat(...) else recurse
  const innerIf = makeExpr(evalIfPrim, [testResult, thunk(concatResult), thunk(rest)]);

  // Outer if: if i >= len then [] else innerIf
  const body = makeExpr(evalIfPrim, [cond, thunk(baseCase), thunk(innerIf)]);
  const fn = makeComposedFn([pArr, pFn, pI], body);
  filterFnRef.fn = fn;
  return fn;
}

/**
 * Build Allegro ComposedFunction for Array.reduce:
 *   reduce_impl(arr, fn, acc, i) =>
 *     if i >= arr.length then acc
 *     else reduce_impl(arr, fn, fn(acc, arr[i]), i + 1)
 */
function buildReduceFn(): ComposedFunctionValue {
  const pArr = makeParam(0, "arr");
  const pFn = makeParam(1, "fn");
  const pAcc = makeParam(2, "acc");
  const pI = makeParam(3, "i");

  const len = makeExpr(arrLengthPrim, [pArr]);
  const cond = makeExpr(intGtePrim, [pI, len]);
  const elem = makeExpr(arrGetPrim, [pArr, pI]);
  const newAcc = makeExpr(pFn, [pAcc, elem]);
  const nextI = makeExpr(intAddPrim, [pI, makeInt(1)]);

  const reduceFnRef: { fn: ComposedFunctionValue | null } = { fn: null };
  const recurse = makePrimitive("reduce_recurse", (args, ctx, evalFn) => {
    return evalFn!(makeExpr(reduceFnRef.fn!, args), ctx!);
  }, true);

  const rest = makeExpr(recurse, [pArr, pFn, newAcc, nextI]);

  const body = makeExpr(evalIfPrim, [cond, thunk(pAcc), thunk(rest)]);
  const fn = makeComposedFn([pArr, pFn, pAcc, pI], body);
  reduceFnRef.fn = fn;
  return fn;
}

// Build the Allegro ComposedFunctions once at module load
const mapAllegro = buildMapFn();
const filterAllegro = buildFilterFn();
const reduceAllegro = buildReduceFn();

const arrayMethods: Record<string, PrimitiveFnImpl> = {
  length: (args) => {
    const ctx = args[0] as ContextValue;
    return getSlotCount(ctx) ?? makeInt(0);
  },
  get: (args) => {
    const ctx = args[0] as ContextValue;
    const idx = Number(toSigned(asBitsTyped(args[1], "Array.get")));
    const v = indexGet(ctx, idx);
    if (v === undefined) throw new AllegroError(`Array.get: index ${idx} out of bounds`);
    return v;
  },
  concat: (args) => {
    const aCtx = args[0] as ContextValue;
    const bCtx = dataOf(args[1]) as ContextValue;
    return makeArray([...arrayElements(aCtx), ...arrayElements(bCtx)]);
  },
  slice: (args) => {
    const ctx = args[0] as ContextValue;
    const elems = arrayElements(ctx);
    const start = Number(toSigned(asBitsTyped(args[1], "Array.slice")));
    const end = args.length > 2
      ? Number(toSigned(asBitsTyped(args[2], "Array.slice")))
      : elems.length;
    return makeArray(elems.slice(start, end));
  },
  // map, filter, reduce delegate to Allegro ComposedFunctions
  map: (args, ctx, evalFn) => {
    const arr = args[0]; // self (primary Context)
    const fn = args[1];  // callback
    return evalFn!(makeExpr(mapAllegro, [arr, fn, makeInt(0)]), ctx!);
  },
  filter: (args, ctx, evalFn) => {
    const arr = args[0];
    const fn = args[1];
    return evalFn!(makeExpr(filterAllegro, [arr, fn, makeInt(0)]), ctx!);
  },
  reduce: (args, ctx, evalFn) => {
    const arr = args[0];
    const fn = args[1];
    const initial = args[2];
    return evalFn!(makeExpr(reduceAllegro, [arr, fn, initial, makeInt(0)]), ctx!);
  },
  // E1 (B-027): no `eq` member — the kernel structural equals applies at
  // the protocol chokepoint (protocolEquals). The old reference-equality
  // stub returned an UNTYPED int the dispatch fallback then mistyped as
  // Array, crashing print/formatValue downstream.
  toString: ((args: Value[]) => {
    const ctx = args[0] as ContextValue;
    const elems = arrayElements(ctx);
    return stringToBits(`[Array(${elems.length})]`);
  }) as PrimitiveFnImpl,
};

// =============================================================================
// Object Type
// Objects are typed Contexts. Fields are accessed via dot notation.
// =============================================================================

/** Create a typed Object value from key-value pairs */
export function makeObject(entries: [string, Value][]): Value {
  const ctx = makeContext();
  for (const [key, value] of entries) {
    assertNotIntegrityKey(key, "object literal");
    ctx.bindings.set(key, { key, value });
    ctx.bindingList.push({ key, value });
  }
  return withType(ctx, ObjectType);
}

const objectMethods: Record<string, PrimitiveFnImpl> = {
  keys: (args) => {
    const ctx = args[0] as ContextValue;
    const keys = [...ctx.bindings.keys()];
    return makeArray(keys.map(k => stringToBits(k)));
  },
  values: (args) => {
    const ctx = args[0] as ContextValue;
    const vals = [...ctx.bindings.values()].filter(b => b.value !== undefined).map(b => b.value!);
    return makeArray(vals);
  },
  get: (args) => {
    const ctx = args[0] as ContextValue;
    const key = bitsToString(asBitsTyped(args[1], "Object.get"));
    const b = ctx.bindings.get(key);
    if (!b?.value) throw new AllegroError(`Object.get: '${key}' not found`);
    return b.value;
  },
  has: (args) => {
    const ctx = args[0] as ContextValue;
    const key = bitsToString(asBitsTyped(args[1], "Object.has"));
    const b = ctx.bindings.get(key);
    return withType(makeInt(b?.value !== undefined ? 1 : 0), BoolType);
  },
  tryGet: (args) => {
    // Like .get but returns none if the key is absent, instead of throwing.
    const ctx = args[0] as ContextValue;
    const key = bitsToString(asBitsTyped(args[1], "Object.tryGet"));
    const b = ctx.bindings.get(key);
    if (!b?.value) return noneSingleton;
    return b.value;
  },
  // E1 (B-027): no `eq` member — kernel structural equals applies at the
  // protocol chokepoint (see arrayMethods note).
  toString: ((args: Value[]) => {
    const ctx = args[0] as ContextValue;
    return stringToBits(`{Object(${ctx.bindings.size})}`);
  }) as PrimitiveFnImpl,
};

// =============================================================================
// UntypedFunction Type
// Wraps base language / extension primitives that enter Standard mode.
// These are callable but have no type information about params or return.
// The arity is tracked when known.
// =============================================================================

const untypedFnMethods: Record<string, PrimitiveFnImpl> = {
  toString: ((args: Value[]) => {
    return withType(stringToBits("<untyped function>"), StringType);
  }) as PrimitiveFnImpl,
};

// =============================================================================
// Any Type
// Matches any value. Used for unparameterized generics (Array = Array[Any])
// and explicit opt-out of type checking.
// =============================================================================

const anyMethods: Record<string, PrimitiveFnImpl> = {
  toString: ((args: Value[]) => {
    return withType(stringToBits("<any>"), StringType);
  }) as PrimitiveFnImpl,
};

// =============================================================================
// Build Type Contexts
// =============================================================================

export const AnyType: ContextValue = buildType("Any", anyMethods);

// =============================================================================
// The kind tower (C6.1b, D45): Refinement and Interface
//
// A KIND is a type whose instances are type-values. C6.1b mints the two
// kinds D45 derives from D44's own relations:
//
//   Refinement — a SUB-KIND of Type: built by DRAWING Type's kind-members
//   (composition; conformance by symbol membership) plus its own instance-
//   data declarations (`refines`, `constraints`). Its instances are refined
//   types: buildRefinedType stamps `__type = Refinement`. Holds constructor
//   authority: `Refinement(base, predicate)` is the mint `&` sugars.
//
//   Interface — a REFINEMENT of Type: member-transparent over Type's kind
//   API (shared member-set object, `__refines = Type`), restricted by the
//   declaration-only predicate — an instance of Interface is a type that
//   holds NO value-constructor authority. Its instances are interfaces:
//   buildInterfaceType stamps `__type = Interface`.
//
// The ratified half-lotus matrix falls out of the existing machinery:
//   Type : Type            ✓ (fixed point, D7)
//   Refinement : Type      ✓ (meta Type; identity)
//   Interface : Refinement ✓ (built BY the refinement mint; meta Refinement)
//   Interface : Type       ✓ (Refinement conforms to Type by membership)
//   Refinement : Interface ✗ (predicate re-check: Refinement holds
//                             constructor authority — C3.3's instanceof
//                             branch evaluates the declaration-only
//                             predicate and rejects)
// =============================================================================

export const RefinementKind: ContextValue = makeContext();
setName(RefinementKind, stringToBits("Refinement"));
writeShape(RefinementKind, Type);
{
  const REFINEMENT_SCOPE = typeMemberScopeFqn("Refinement");
  const refMembers = makeContext();
  // Draw Type's kind API verbatim — same keys, same member symbols; the
  // D44 conformance relation (`Refinement subtypeof Type`) holds by
  // membership, and meta-dispatch on refined types finds the same
  // implementations Type's instances use.
  for (const [key, b] of typeMembers.bindings) {
    if (b.value) addBinding(refMembers, key, b.value);
  }
  // Instance-data declarations: every refined type carries a base and its
  // constraints. (AnyType is deliberately loose for `constraints` — the
  // exact constraint-list type sharpens with `distinct`'s spec, C6.1b+.)
  addMember(refMembers, REFINEMENT_SCOPE, "refines", makeFieldDescriptor("refines", Type));
  addMember(refMembers, REFINEMENT_SCOPE, "constraints", makeFieldDescriptor("constraints", AnyType));
  setMembers(RefinementKind, refMembers);
}
// Constructor authority (D45 R2): `Refinement(base, predicate)` IS the
// refinement mint — the `&` operator (`Int & _ > 0`) is its operator form.
// The kind-specific SPEC form (the surface `define` exposes) is
//   Refinement.define({refines: T, where: pred, preserve: [ops] | "all"})
// — `preserve` lifts the named operators (or the default numeric set) so
// results re-check the predicate and keep the refined tag (the old
// `.preserveOps()` fluent surface, folded into the spec per D45).
setConstruct(RefinementKind, makePrimitive("Refinement.__construct", (args, ctx, evalFn) => {
  const first = dataOf(evalFn!(args[0], ctx!));
  if (first.kind !== ValueKind.Structure) {
    throw new AllegroError("Refinement: base must be a type");
  }
  const specRefines = args.length === 1
    ? (first as ContextValue).bindings.get("refines")?.value : undefined;
  if (specRefines !== undefined) {
    const base = dataOf(specRefines);
    if (base.kind !== ValueKind.Structure) {
      throw new AllegroError("Refinement: `refines` must be a type");
    }
    const wherePred = (first as ContextValue).bindings.get("where")?.value;
    if (wherePred === undefined) {
      throw new AllegroError("Refinement: spec requires a `where` predicate");
    }
    let refined = buildRefinedType(base as ContextValue, dataOf(wherePred));
    // Non-reserved spec entries are METHOD implementations layered onto
    // the refined type (the old `.mixin()` on refinements): every entry
    // beyond refines/where/preserve must be a function value. The method
    // layer goes on BEFORE preserve — the preserve layer clones its
    // input's member set (methods survive) and its lifted ops retag
    // results with the OUTERMOST type, so `x + 3 instanceof PI` holds.
    const RESERVED_REFINEMENT_KEYS = new Set(["refines", "where", "preserve"]);
    const extraMethods: { name: string; impl: Value }[] = [];
    // E3: `law_` entries on a refinement spec. A refinement SHARES its
    // parent's member set by object identity (that sharing IS shape
    // transparency, D37) — so refinement laws instantiate obligations
    // directly, without minting descriptors into the shared set. The
    // quantifier is the REFINED type (its abstract domain drives the
    // sampled tier).
    const refinementLaws: { name: string; body: Value }[] = [];
    for (const [k, b] of (first as ContextValue).bindings) {
      if (isMetaSlotKey(k) || RESERVED_REFINEMENT_KEYS.has(k)) continue;
      if (!b.value) continue;
      if (k.startsWith("law_")) {
        const body = forAllBody(b.value);
        if (body === undefined) {
          throw new AllegroError(`Refinement: '${k}' must be a for_all(...) proposition`);
        }
        refinementLaws.push({ name: k.slice(4), body });
        continue;
      }
      const entry = dataOf(b.value);
      if (entry.kind !== ValueKind.ComposedFunction && entry.kind !== ValueKind.PrimitiveFunction) {
        throw new AllegroError(
          `Refinement: spec entry '${k}' must be a method (function value) — fields live on record kinds`);
      }
      if (k === "eq") {
        assertPureForEquality(b.value, `Refinement: 'eq' implementation`, ctx);
      }
      extraMethods.push({ name: k, impl: entry });
    }
    if (extraMethods.length > 0) {
      refined = buildMethodLayer(refined, extraMethods);
    }
    const preserve = (first as ContextValue).bindings.get("preserve")?.value;
    if (preserve !== undefined) {
      const p = dataOf(preserve);
      const opNames: string[] = [];
      if (p.kind === ValueKind.Bits) {
        const s = bitsToString(p as BitsValue);
        if (s !== "all") throw new AllegroError(`Refinement: preserve must be "all" or a list of operator names (got "${s}")`);
      } else if (p.kind === ValueKind.Structure) {
        for (const el of arrayElements(p as ContextValue)) {
          const e = dataOf(el);
          if (e.kind === ValueKind.Bits) opNames.push(bitsToString(e as BitsValue));
        }
      } else {
        throw new AllegroError("Refinement: preserve must be \"all\" or a list of operator names");
      }
      refined = buildPreserveOps(refined, opNames);
    }
    // E3: instantiate the spec's law obligations against the finished
    // refined type. Sampling reads the refinement's abstract domain; a
    // concrete counterexample halts the definition.
    for (const l of refinementLaws) {
      const arity = dataOf(l.body).kind === ValueKind.ComposedFunction
        ? (dataOf(l.body) as ComposedFunctionValue).params.length : 1;
      instantiateLaw(refined, makeLawDescriptor(l.name, l.body, arity), ctx, evalFn);
    }
    return wrapType(refined);
  }
  const predicate = evalFn!(args[1], ctx!);
  return wrapType(buildRefinedType(first as ContextValue, predicate));
}, true));

// Type's own constructor authority: `Type(spec, ...bundles)` mints a
// record type — `Type.define` is the canonical named factory delegating
// here. (Every construct bottoms out in the structure factories plus the
// gated shape stamp — makeContext + writeShape inside buildRecordType.)
setConstruct(Type, makePrimitive("Type.__construct", (args, ctx, evalFn) => {
  const spec = evalFn!(args[0], ctx!);
  const drawn: ContextValue[] = [];
  for (let i = 1; i < args.length; i++) {
    const b = dataOf(evalFn!(args[i], ctx!));
    if (b.kind !== ValueKind.Structure) {
      throw new AllegroError("Type: drawn bundles must be types");
    }
    drawn.push(b as ContextValue);
  }
  return wrapType(buildRecordType(spec, drawn, Type, ctx, evalFn));
}, true));

// Interface = the refinement mint applied to Type with the declaration-only
// predicate. Its own construct is REPLACED (the wrapped Type-construct a
// refinement would inherit mints records — an Interface instance is a
// declaration, so the kind's authority is the interface mint instead).
const declarationOnlyPredicate = makePrimitive("Interface.__declarationOnly", (args) => {
  const t = dataOf(args[0]);
  return makeInt(
    t.kind === ValueKind.Structure && getConstruct(t as ContextValue) === undefined ? 1 : 0);
});
export const InterfaceKind: ContextValue = buildRefinedType(Type, declarationOnlyPredicate);
removeName(InterfaceKind);
setName(InterfaceKind, stringToBits("Interface"));
removeConstruct(InterfaceKind);
setConstruct(InterfaceKind, makePrimitive("Interface.__construct", (args, ctx, evalFn) => {
  const spec = evalFn!(args[0], ctx!);
  const drawn: ContextValue[] = [];
  for (let i = 1; i < args.length; i++) {
    const b = dataOf(evalFn!(args[i], ctx!));
    if (b.kind !== ValueKind.Structure) {
      throw new AllegroError("Interface: drawn bundles must be types");
    }
    drawn.push(b as ContextValue);
  }
  return wrapType(buildInterfaceType(spec, drawn));
}, true));

/** C6.1b (maintainer ruling): there is no reified `Kind` — D7 forbids a
 *  universe above Type. Kind-hood is a CHECKABLE PROPERTY, not a
 *  convention: a kind is exactly a type that holds Type's kind-member
 *  symbols — Type itself (identity), Refinement (drawn), Interface
 *  (transparent). Ordinary types can never acquire them accidentally:
 *  the meta filter excludes the kind API from every draw, so kind-hood
 *  requires a deliberate kind derivation. From Allegro, `K subtypeof
 *  Type` IS the kind test. Effect and Proof join the tower when they
 *  are re-derived through the recipe (C6.2 / C6.3). */
function isKind(t: ContextValue): boolean {
  return isTypeMeta(t);
}

export const IntType: ContextValue = buildType("Int", intMethods);
export const FloatType: ContextValue = buildType("Float", floatMethods);

// E2: the kernel Int→Float coercion — the numeric tower's first declared
// edge (§7 step 2). Ships with both §7 obligations discharged at tier
// "kernel": the embedding preserves bit-identical Int equality by
// construction, and with a single kernel edge every composition triangle
// commutes trivially. Makes `1 == 1.0` true via least-common-type Float.
declareCoercion(IntType, FloatType, makePrimitive("Int->Float", (args) => {
  const a = toSigned(asBitsTyped(args[0], "Int->Float coercion"));
  return withType(makeFloat(Number(a)), FloatType);
}), { tier: "kernel" });
export const StringType: ContextValue = buildType("String", stringMethods);
export const BoolType: ContextValue = buildType("Bool", boolMethods);
export const ObjectType: ContextValue = buildType("Object", objectMethods);
// Object __getMember: allows access to any field on the underlying Context.
// Called by type_dispatch when the field isn't a type method.
const objectGetMember = makePrimitive("Object.__getMember", (args) => {
  const ctx = args[0] as ContextValue;
  const fieldName = bitsToString(args[1] as BitsValue);
  const b = ctx.bindings.get(fieldName);
  if (!b?.value) throw new AllegroError(`Object: field '${fieldName}' not found`);
  return b.value;
});
setFallbackMember(ObjectType, objectGetMember);
export const UntypedFunctionType: ContextValue = buildType("UntypedFunction", untypedFnMethods);

// None type — represents the absence of a value
const noneMethods: Record<string, PrimitiveFnImpl> = {
  toString: () => withType(stringToBits("none"), StringType),
  eq: (args) => withType(makeInt(args[0] === args[1] ? 1 : 0), BoolType),
  neq: (args) => withType(makeInt(args[0] !== args[1] ? 1 : 0), BoolType),
};
export const NoneType: ContextValue = buildType("None", noneMethods);
export const noneSingleton: Value = withType(makeInt(0), NoneType);

// Error type — represents a value that failed to compute
const errorMethods: Record<string, PrimitiveFnImpl> = {
  toString: ((_args: Value[]) => {
    return withType(stringToBits("error"), StringType);
  }) as PrimitiveFnImpl,
  eq: ((args: Value[]) => withType(makeInt(args[0] === args[1] ? 1 : 0), BoolType)) as PrimitiveFnImpl,
  neq: ((args: Value[]) => withType(makeInt(args[0] !== args[1] ? 1 : 0), BoolType)) as PrimitiveFnImpl,
};
export const ErrorType: ContextValue = buildType("Error", errorMethods);

// =============================================================================
// Built-in Type Constructors (__construct)
// =============================================================================

// Int(x) — wrap a value with Int type
setConstruct(IntType, makePrimitive("Int.__construct", (args, ctx, evalFn) => {
  const v = evalFn!(args[0], ctx!);
  return withType(dataOf(v), IntType);
}, true));

// Float(x) — wrap a value with Float type
setConstruct(FloatType, makePrimitive("Float.__construct", (args, ctx, evalFn) => {
  const v = evalFn!(args[0], ctx!);
  return withType(dataOf(v), FloatType);
}, true));

// String(x) — wrap a value with String type
setConstruct(StringType, makePrimitive("String.__construct", (args, ctx, evalFn) => {
  const v = evalFn!(args[0], ctx!);
  return withType(dataOf(v), StringType);
}, true));

// Bool(x) — wrap a value with Bool type
setConstruct(BoolType, makePrimitive("Bool.__construct", (args, ctx, evalFn) => {
  const v = evalFn!(args[0], ctx!);
  return withType(dataOf(v), BoolType);
}, true));

// =============================================================================
// GenericType — the kind of generic types (C7.2a)
//
// A GENERIC TYPE (Array, Function, user generics) is a TYPE CONSTRUCTOR: its
// construct authority takes type arguments and mints concrete types
// (`Array[Int]`), memoized so equal parameterizations are the same Context.
// C7.2a re-derives it through the kind recipe (the Effect/Proof pattern):
// GenericType draws Type's kind-member symbols (kind-hood is conformance to
// Type) and declares its instances' `params` field; generic types stamp
// shape = GenericType, so `isGenericType` is a SHAPE CHECK — the __isGeneric
// presence flag is deleted (D39: the flag IS the kind).
//
// The applier lives in the generic's own `construct` slot (D45: ONE
// construction surface — the separate `__constructor` alias is collapsed;
// call-as-function and `type_apply` both invoke it). Applied concretes stay
// shape Type — they are ordinary types; their `__args`/`__generic` back-links
// remain host-read instance data (a language-level member surface for them
// is consciously deferred — see the C7.2 rulings in the plan).
//
// The mint (buildGenericType) is KERNEL-PRIVATE, like Proof's makeProof:
// GenericType exposes no construct authority to Allegro — user-defined
// generic types are a future surface with their own design.
// =============================================================================

export const GenericType: ContextValue = makeContext();
setName(GenericType, stringToBits("GenericType"));
writeShape(GenericType, Type);

const GENERIC_MEMBER_SCOPE = typeMemberScopeFqn("GenericType");
const genericTypeMembers = makeContext();
// Draw Type's kind API verbatim — same member symbols, so `GenericType
// subtypeof Type` holds by membership and generic types keep the kind API
// (`Array instanceof Type` stays true through conformance).
for (const [key, b] of typeMembers.bindings) {
  if (b.value) addBinding(genericTypeMembers, key, b.value);
}
setMembers(GenericType, genericTypeMembers);
// `get` — bracket application in EXPRESSION position (`Array[Int]` as an
// expression lowers to type_dispatch(Array, "get")(Int), the same shape
// as array indexing). Routes to the generic's construct authority, so
// expression-position application and annotation-position `type_apply`
// mint the identical memoized concrete (B-091 sweep finding — without
// this member, `print(x instanceof Array[Int])` died with
// "'get' not found on GenericType").
addMemberAt(genericTypeMembers, "get",
  makeMethodDescriptor("get", makePrimitive("GenericType.get", (args, ctx, evalFn) => {
    const self = args[0];
    const typeArgs = args.slice(1).map(a => evalFn ? evalFn(a, ctx!) : a);
    return applyGenericType(dataOf(self) as ContextValue, typeArgs);
  })));
// The `params` field descriptor is declared after ArrayType exists
// (bootstrap order — ArrayType is itself minted through buildGenericType).

// Bootstrap staging for typed `params` values: generics minted before
// ArrayType/StringType exist store a raw array and are upgraded in place
// once the flag flips (right after FunctionType's mint).
let _genericParamsTypedReady = false;
const _pendingGenericParamsUpgrades: { ctx: ContextValue; names: string[] }[] = [];
function typedGenericParams(names: string[]): Value {
  return makeArray(names.map(n => withType(stringToBits(n), StringType)));
}

/**
 * Build a GenericType: a type constructor that takes type parameters and
 * produces concrete types. Each unique parameterization is memoized.
 *
 * @param name       Base name (e.g., "Array")
 * @param paramNames Parameter names (e.g., ["T"])
 * @param methods    Method implementations (shared by all concrete types)
 * @param makeConcreteType  Function that builds a concrete type given args
 */
export function buildGenericType(
  name: string,
  paramNames: string[],
  methods: Record<string, PrimitiveFnImpl>,
  makeConcreteType?: (generic: ContextValue, args: Value[]) => ContextValue,
  options?: { methodEffects?: Record<string, string[]> },
): ContextValue {
  // Memoization cache: keyed by arg identity (reference equality)
  const cache = new Map<string, ContextValue>();

  function cacheKey(args: Value[]): string {
    return args.map((a, idx) => cacheKeyOne(a, idx)).join(",");
  }

  function cacheKeyOne(a: Value, idx: number): string {
    // C7.1: carriers key by their DATA (a typed 3 and a typed 5 must not
    // collide on the empty-bindings context key) — peel before the
    // structure branch.
    if (a.kind === ValueKind.Structure && (a as { primary?: Value }).primary !== undefined) {
      const p = dataOf(a);
      if (p.kind === ValueKind.Bits) return `v:${(p as BitsValue).data}`;
      return cacheKeyOne(p, idx);
    }
    if (a.kind === ValueKind.Structure) {
      const ctx = a as ContextValue;
      // Named type (Int, String, Array, etc.)
      const nv = getName(ctx);
      if (nv?.kind === ValueKind.Bits) {
        const typeName = bitsToString(nv);
        // Check for type args (concrete generic like Array[Int])
        const argsV = getGenericArgs(ctx);
        if (argsV?.kind === ValueKind.Structure) {
          const argsCtx = argsV as ContextValue;
          const argElems = arrayElements(argsCtx);
          return `${typeName}[${argElems.map((e, i) => cacheKeyOne(e, i)).join(";")}]`;
        }
        return typeName;
      }
      // Array-like Context (used as param types list)
      const lenV = getSlotCount(ctx);
      if (lenV?.kind === ValueKind.Bits) {
        const len = Number((lenV as BitsValue).data);
        const elems: string[] = [];
        for (let i = 0; i < len; i++) {
          const ev = indexGet(ctx, i);
          if (ev !== undefined) elems.push(cacheKeyOne(ev, i));
        }
        return `arr(${elems.join(";")})`;
      }
      // Generic Context — use binding count as rough key
      return `ctx:${ctx.bindings.size}:${idx}`;
    }
    if (a.kind === ValueKind.Bits) return `v:${(a as BitsValue).data}`;
    // Params and Symbols (type variables) — unique per name
    if (a.kind === ValueKind.Param) return `param:${(a as any)._name ?? idx}`;
    if (a.kind === ValueKind.Symbol) return `sym:${(a as any).name}`;
    return `unk:${idx}`;
  }

  // Build the base type with methods, then re-stamp its shape: a generic
  // type is an INSTANCE of the GenericType kind (C7.2a).
  const ctx = buildType(name, methods, { methodEffects: options?.methodEffects });
  removeShapeSlot(ctx);
  writeShape(ctx, GenericType);

  // `params` — declared instance data (the GenericType kind holds the field
  // descriptor; storage is a plain binding, like Effect's kind/labels): a
  // typed Array[String] of the param names, so `Array.params` reads like
  // any other array value. The two bootstrap generics (Array, Function)
  // are minted BEFORE ArrayType/StringType exist — they store a raw array
  // and are upgraded in place right after FunctionType's mint.
  if (_genericParamsTypedReady) {
    addBinding(ctx, "params", typedGenericParams(paramNames));
  } else {
    addBinding(ctx, "params", makeRawArrayCtx(paramNames.map(n => stringToBits(n))));
    _pendingGenericParamsUpgrades.push({ ctx, names: paramNames });
  }

  // The applier IS the generic's construct authority (D45 collapse — the
  // separate __constructor slot is retired): type args in, concrete type out.
  const constructorFn = makePrimitive(`${name}.__construct`, (args: Value[]) => {
    const key = cacheKey(args);
    const cached = cache.get(key);
    if (cached) return cached;

    let concrete: ContextValue;
    if (makeConcreteType) {
      concrete = makeConcreteType(ctx, args);
    } else {
      concrete = defaultConcreteType(ctx, name, args, methods, options?.methodEffects);
    }
    cache.set(key, concrete);
    return concrete;
  });
  setConstruct(ctx, constructorFn);

  return ctx;
}

/**
 * Default concrete type builder: creates a type Context that inherits
 * methods from the generic and records the applied type arguments.
 */
function defaultConcreteType(
  generic: ContextValue,
  name: string,
  args: Value[],
  methods: Record<string, PrimitiveFnImpl>,
  methodEffects?: Record<string, string[]>,
): ContextValue {
  const concrete = buildType(name, methods, { methodEffects });

  // __generic: reference to the generic type
  setGenericBackLink(concrete, generic);

  // __args: the applied type arguments (raw array to avoid circular deps)
  setGenericArgs(concrete, makeRawArrayCtx(args));

  return concrete;
}

/**
 * Check if a type is a generic type — a SHAPE check (C7.2a): generic types
 * are the instances of the GenericType kind. The __isGeneric flag is gone.
 */
export function isGenericType(type: ContextValue): boolean {
  return channelReadRaw(type, "type") === GenericType;
}

/**
 * Get the type arguments from a concrete parameterized type.
 * Returns null if the type has no __args.
 */
export function getTypeArgs(type: ContextValue): Value[] | null {
  const argsV = getGenericArgs(type);
  if (!argsV) return null;
  const ctx = dataOf(argsV);
  if (ctx.kind !== ValueKind.Structure) return null;
  return arrayElements(ctx as ContextValue);
}

/**
 * Get the generic type from a concrete parameterized type.
 */
export function getGenericType(type: ContextValue): ContextValue | null {
  const g = getGenericBackLink(type);
  if (!g || g.kind !== ValueKind.Structure) return null;
  return g;
}

/**
 * Get the number of type parameters on a generic type.
 */
function getGenericParamCount(generic: ContextValue): number {
  const paramsV = generic.bindings.get("params")?.value;
  if (!paramsV) return 0;
  const paramsCtx = dataOf(paramsV);
  if (paramsCtx.kind !== ValueKind.Structure) return 0;
  const lenV = getSlotCount(paramsCtx as ContextValue);
  return lenV ? Number((lenV as BitsValue).data) : 0;
}

/**
 * Normalize a type for use in type checking. If the type is a bare generic
 * (e.g., Array without type arguments), resolve it to Generic[Any, ...] by
 * applying AnyType for each parameter.
 */
export function normalizeType(type: ContextValue): ContextValue {
  if (!isGenericType(type)) return type;
  const paramCount = getGenericParamCount(type);
  if (paramCount === 0) return type;
  const anyArgs = Array.from({ length: paramCount }, () => AnyType as Value);
  return applyGenericType(type, anyArgs);
}

/**
 * Apply type arguments to a generic type, returning the concrete type.
 */
export function applyGenericType(generic: ContextValue, args: Value[]): ContextValue {
  // C7.2a: the applier IS the generic's construct authority (D45 — one
  // construction surface; call-as-function reaches the same slot).
  const ctorV = getConstruct(generic);
  if (!ctorV || ctorV.kind !== ValueKind.PrimitiveFunction) {
    throw new AllegroError(`Not a generic type: ${bitsToString(getName(generic) as BitsValue ?? stringToBits("unknown"))}`);
  }
  return ctorV.fn(args, undefined as any, undefined as any) as ContextValue;
}

// =============================================================================
// Array as GenericType
// =============================================================================

export const ArrayType: ContextValue = buildGenericType(
  "Array",
  ["T"],
  arrayMethods,
  undefined,
  // F3b: opaque tags removed. With PE-driven effect propagation (F1) +
  // polymorphic Param-call handling (F2c) + compile-time deferral (F3a),
  // `arr.map(cb)` correctly propagates `cb`'s effects through the Allegro-
  // built `mapAllegro` body's `fn(arr[i])` Param-call. Callers see the
  // precise effect set instead of the conservative `opaque` placeholder.
);

// =============================================================================
// Function Type (Generic)
// Function[ParamTypes, ReturnType] where ParamTypes is an Array of types.
// e.g., Function[[Int, String], Bool] for (Int, String) -> Bool
// =============================================================================

const functionTypeMethods: Record<string, PrimitiveFnImpl> = {
  toString: ((args: Value[]) => {
    return withType(stringToBits("<function type>"), StringType);
  }) as PrimitiveFnImpl,
};

export const FunctionType: ContextValue = buildGenericType("Function", ["ParamTypes", "ReturnType"], functionTypeMethods);

// GenericType's declared instance field (C7.2a) — added here because
// Array[String] (the descriptor's fieldType) needs ArrayType, itself
// minted through buildGenericType above. `Array.params` dispatches
// through the kind's shape to this descriptor, reading the instance's
// `params` binding.
addMember(genericTypeMembers, GENERIC_MEMBER_SCOPE, "params",
  makeFieldDescriptor("params", applyGenericType(ArrayType, [StringType])));
// Upgrade the bootstrap generics' raw params storage to typed
// Array[String] values, then mint typed directly from here on.
_genericParamsTypedReady = true;
for (const { ctx, names } of _pendingGenericParamsUpgrades.splice(0)) {
  const b = ctx.bindings.get("params");
  if (b) b.value = typedGenericParams(names);
}

// =============================================================================
// Future as GenericType (B-028 F2 — D33/CE-R5)
//
// `Future[T]` is the TYPE of a pending async result: the value itself
// stays the pending Symbol/residual under the type channel, and the
// evaluator's carrier re-evaluation makes the Future annotation vanish
// on resolution (the fresh value's own type shadows it). Memoization by
// arg identity gives type equality for free; the constructor callback
// implements D33's flattening.
// =============================================================================

export const FutureType: ContextValue = buildGenericType(
  "Future",
  ["T"],
  {},
  (generic, args) => {
    // D33: Future[Future[T]] IS Future[T] — a future of a future flattens.
    const el = args[0] !== undefined ? dataOf(args[0]) : undefined;
    if (el?.kind === ValueKind.Structure && getGenericType(el as ContextValue) === FutureType) {
      return el as ContextValue;
    }
    return defaultConcreteType(generic, "Future", args, {});
  },
);

/** Apply Future to an element type: `futureOf(Int)` = `Future[Int]`. */
export function futureOf(elementType: ContextValue): ContextValue {
  return applyGenericType(FutureType, [elementType]);
}

/** The element type T of a `Future[T]` type Context; `Any` for the bare
 *  generic; null when the type is not a Future at all. */
export function futureElementType(type: ContextValue): ContextValue | null {
  if (type === FutureType) return AnyType;
  if (getGenericType(type) !== FutureType) return null;
  const args = getTypeArgs(type);
  const el = args && args[0] !== undefined ? dataOf(args[0]) : undefined;
  return el?.kind === ValueKind.Structure ? (el as ContextValue) : AnyType;
}

/** B-028 F2: does `name` appear on `t`'s refines chain (t itself
 *  included)? The shape-level test the call-boundary check uses for
 *  future-typed args — Future[Int] passes a NonNeg param's shape (Int
 *  is on NonNeg's chain... inverted: NonNeg refines Int, so the check
 *  walks the EXPECTED type's chain down to the element's name); the
 *  predicate half defers with the value. */
export function typeNameOnRefinesChain(t: ContextValue, name: string): boolean {
  let cur: ContextValue | null = t;
  for (let guard = 0; guard < 64 && cur; guard++) {
    if (typeContextName(cur) === name) return true;
    const parentV = getRefines(cur);
    cur = parentV?.kind === ValueKind.Structure ? (parentV as ContextValue) : null;
  }
  return false;
}

/** Create a concrete FunctionType from param types and return type. */
export function makeFunctionType(paramTypes: Value[], returnType: Value): ContextValue {
  const paramTypesArr = makeRawArrayCtx(paramTypes);
  return applyGenericType(FunctionType, [paramTypesArr, returnType]);
}

/** Extract param types from a concrete FunctionType. Returns null if not a FunctionType. */
export function getFunctionParamTypes(fnType: ContextValue): Value[] | null {
  const args = getTypeArgs(fnType);
  if (!args || args.length < 2) return null;
  const paramTypesCtx = dataOf(args[0]);
  if (paramTypesCtx.kind !== ValueKind.Structure) return null;
  return arrayElements(paramTypesCtx as ContextValue);
}

/** Extract return type from a concrete FunctionType. Returns null if not a FunctionType. */
export function getFunctionReturnType(fnType: ContextValue): Value | null {
  const args = getTypeArgs(fnType);
  if (!args || args.length < 2) return null;
  return args[1];
}

// =============================================================================
// Equatable — lawful-interface instance #1 (E3 — B-027 §8, D38)
//
// The interface declares the equality member plus the three equivalence
// laws as Law descriptors. The law propositions run through the SAME
// protocol chokepoint `==` uses (protocolEqualsBool) — there is no
// parallel equality to keep in sync. Each law carries the parametric
// kernel certificate: a type whose equality resolution is kernel-supplied
// (the structural default, or a built-in scalar eq) discharges
// refl/sym/trans at tier "kernel" for free (§8 amortization); a custom
// `eq` bears fresh obligations.
// =============================================================================

export const EquatableType: ContextValue = makeContext();
setName(EquatableType, stringToBits("Equatable"));
writeShape(EquatableType, InterfaceKind);
markInterface(EquatableType, makeInt(1));
{
  const EQUATABLE_SCOPE = typeMemberScopeFqn("Equatable");
  (EquatableType as any).localMemberScope = EQUATABLE_SCOPE;
  const members = makeContext();
  addMember(members, EQUATABLE_SCOPE, "eq", makeFieldDescriptor("eq", FunctionType));
  const reflProp = makePrimitive("Equatable.law.refl", (args, ctx, evalFn) =>
    makeInt(protocolEqualsBool(args[0], args[0], ctx, evalFn) ? 1 : 0));
  const symProp = makePrimitive("Equatable.law.sym", (args, ctx, evalFn) =>
    makeInt(protocolEqualsBool(args[0], args[1], ctx, evalFn) ===
            protocolEqualsBool(args[1], args[0], ctx, evalFn) ? 1 : 0));
  const transProp = makePrimitive("Equatable.law.trans", (args, ctx, evalFn) => {
    const ab = protocolEqualsBool(args[0], args[1], ctx, evalFn);
    const bc = protocolEqualsBool(args[1], args[2], ctx, evalFn);
    const ac = protocolEqualsBool(args[0], args[2], ctx, evalFn);
    return makeInt(!(ab && bc) || ac ? 1 : 0);
  });
  addMember(members, EQUATABLE_SCOPE, "refl",
    makeLawDescriptor("refl", reflProp, 1, KERNEL_EQUALS_CERTIFICATE));
  addMember(members, EQUATABLE_SCOPE, "sym",
    makeLawDescriptor("sym", symProp, 2, KERNEL_EQUALS_CERTIFICATE));
  addMember(members, EQUATABLE_SCOPE, "trans",
    makeLawDescriptor("trans", transProp, 3, KERNEL_EQUALS_CERTIFICATE));
  setMembers(EquatableType, members);
}

// Retroactive conformance for the kernel scalars (§8: "retroactive
// conformance is via mixins / partial type declarations" — this is the
// kernel's own partial declaration): each built-in eq implementation is
// MULTI-BOUND under Equatable's member symbol (same descriptor object, so
// base-name dispatch dedupes by identity), the law descriptors are drawn
// verbatim, and the refl/sym/trans obligations discharge at tier "kernel"
// via the parametric certificate. `42 instanceof Equatable` is true.
{
  const eqMembers = getMembers(EquatableType) as ContextValue;
  for (const t of [IntType, FloatType, StringType, BoolType]) {
    const tMembers = getMembers(t) as ContextValue;
    for (const [key, b] of eqMembers.bindings) {
      if (!b.value) continue;
      if (fqnBaseName(key) === "eq") {
        const ownEq = typeMemberDescriptor(t, "eq");
        if (ownEq) addMemberAt(tMembers, key, ownEq);
      } else {
        addMemberAt(tMembers, key, b.value);
      }
    }
    instantiateLawsFromMembers(t, tMembers);
  }
}

// =============================================================================
// Unification
// Type variable bindings accumulate in a Map<string, Value> (varName → type).
// =============================================================================

export type TypeBindings = Map<string, Value>;

/**
 * Unify an actual type against an expected type expression.
 * Type variables (Params) in expectedType get bound in the bindings map.
 * Returns updated bindings. Throws on contradiction.
 */
export function unifyTypes(
  actualType: Value | null,
  expectedType: Value,
  bindings: TypeBindings,
): TypeBindings {
  // If expected is a type variable (Symbol or unresolved Param)
  if (expectedType.kind === ValueKind.Symbol) {
    const varName = (expectedType as any).name;
    if (!varName) return bindings;
    const existing = bindings.get(varName);
    if (existing) {
      const existingName = typeContextName(existing);
      const actualName = actualType ? typeContextName(actualType) : null;
      if (existingName && actualName && existingName !== actualName) {
        throw new AllegroError(`Type variable ${varName}: conflicting bindings ${existingName} vs ${actualName}`);
      }
      return bindings;
    }
    if (actualType) {
      bindings.set(varName, actualType);
    }
    return bindings;
  }
  // Legacy: Param as type variable
  if (expectedType.kind === ValueKind.Param) {
    const varName = (expectedType as any)._name;
    if (!varName) return bindings; // positional param, can't unify
    const existing = bindings.get(varName);
    if (existing) {
      // Check consistency — both existing and actual are type Contexts
      const existingName = typeContextName(existing);
      const actualName = actualType ? typeContextName(actualType) : null;
      if (existingName && actualName && existingName !== actualName) {
        throw new AllegroError(`Type variable ${varName}: conflicting bindings ${existingName} vs ${actualName}`);
      }
      return bindings;
    }
    if (actualType) {
      bindings.set(varName, actualType);
    }
    return bindings;
  }

  // If expected is Any, always matches
  if (expectedType.kind === ValueKind.Structure) {
    const expectedName = bitsToString(
      (getName(expectedType as ContextValue) as BitsValue) ?? stringToBits(""),
    );
    if (expectedName === "Any") return bindings;
  }

  // If expected is a concrete type
  if (expectedType.kind === ValueKind.Structure && actualType) {
    const expectedCtx = expectedType as ContextValue;
    // Legacy-exact (C4.3b): only an MV-wrapped actual participates in name
    // unification here — a bare type Context skips (getType on it would now
    // report its META-type, which is not what this comparison wants; the
    // call-site checkArgType does the real concrete-type check).
    const actualCtx = isCarrier(actualType) ? getType(actualType) : null;
    if (!actualCtx) return bindings; // no type on actual, can't unify

    // Check base name
    const expectedName = bitsToString(
      (getName(expectedCtx) as BitsValue) ?? stringToBits(""),
    );
    const actualName = bitsToString(
      (getName(actualCtx) as BitsValue) ?? stringToBits(""),
    );
    if (expectedName !== actualName) {
      throw new AllegroError(`Type mismatch: expected ${expectedName}, got ${actualName}`);
    }

    // Recursively unify type arguments
    const expectedArgs = getTypeArgs(expectedCtx);
    const actualArgs = getTypeArgs(actualCtx);
    if (expectedArgs && actualArgs) {
      const len = Math.min(expectedArgs.length, actualArgs.length);
      for (let i = 0; i < len; i++) {
        unifyTypes(actualArgs[i], expectedArgs[i], bindings);
      }
    }
  }

  return bindings;
}

/**
 * Resolve a type expression by substituting bound type variables.
 * Returns the resolved type value, or the original if no variables to substitute.
 */
export function resolveTypeWithBindings(typeExpr: Value, bindings: TypeBindings): Value {
  if (typeExpr.kind === ValueKind.Symbol) {
    const varName = (typeExpr as any).name;
    if (varName && bindings.has(varName)) return bindings.get(varName)!;
    return typeExpr;
  }
  if (typeExpr.kind === ValueKind.Param) {
    const varName = (typeExpr as any)._name;
    if (varName && bindings.has(varName)) {
      return bindings.get(varName)!;
    }
    return typeExpr;
  }

  if (typeExpr.kind === ValueKind.Structure) {
    const ctx = typeExpr as ContextValue;
    const argsV2 = getGenericArgs(ctx);
    if (argsV2) {
      const argsCtx = dataOf(argsV2);
      if (argsCtx.kind === ValueKind.Structure) {
        const args = arrayElements(argsCtx as ContextValue);
        const resolvedArgs = args.map(a => resolveTypeWithBindings(a, bindings));
        if (resolvedArgs.some((a, i) => a !== args[i])) {
          // Need to reconstruct the concrete type with resolved args
          const generic = getGenericType(ctx);
          if (generic) {
            return applyGenericType(generic, resolvedArgs);
          }
        }
      }
    }
  }

  return typeExpr;
}

// =============================================================================
// Effect — the kind of effects (C6.2, D40)
//
// Effect is a KIND: it draws Type's kind-member symbols (so `Effect
// subtypeof Type` holds — kind-hood is conformance to Type — and
// define / call-as-function work uniformly) and declares its instances'
// members: the `kind` / `labels` fields plus the lattice ops. D40 R1 —
// Effect's declared instance ORDER is label-set inclusion, with join
// (`union`) / meet (`intersect`) and `pure` / `opaque` as bottom / top.
//
// Members live ONCE, on the kind (D40; §6 delta 7): `io.union(time)`
// dispatches through io's shape (Effect) exactly as `42.toString()`
// dispatches through Int — buildEffect's per-instance member copying is
// deleted, and so is the `__refines = Effect` chain hack (D44: effects
// stop using the link; `pure instanceof Effect` is the check now, and
// `pure subtypeof Effect` is FALSE — §6 delta 6).
//
// An instance IS its label set (D39 effectBound note): `pure` = {},
// a named effect = {name}, an operator-minted conjunction (`io & time`,
// D40 R3) = the union set, `opaque` = top (null — unbounded). Instances
// are MEMOIZED by label set, so equal-set conjunctions are the SAME
// Context and D37 equality falls out of identity.
// =============================================================================

export const Effect: ContextValue = makeContext();
setName(Effect, stringToBits("Effect"));
writeShape(Effect, Type);

const EFFECT_MEMBER_SCOPE = typeMemberScopeFqn("Effect");
const effectMembers = makeContext();
// Draw Type's kind API verbatim — same member symbols, so `Effect
// subtypeof Type` holds by membership and isKind(Effect) is true.
for (const [key, b] of typeMembers.bindings) {
  if (b.value) addBinding(effectMembers, key, b.value);
}
// Instance-data declarations (D39 checklist: __effect_kind → Effect.kind;
// the label set is the Effect.labels declared view).
addMember(effectMembers, EFFECT_MEMBER_SCOPE, "kind", makeFieldDescriptor("kind", StringType));
addMember(effectMembers, EFFECT_MEMBER_SCOPE, "labels", makeFieldDescriptor("labels", ArrayType));

/** The label set an effect instance carries: Set (empty for pure),
 *  null for opaque (top), undefined for non-instances. */
function labelsOf(e: ContextValue): Set<string> | null | undefined {
  return getEffectLabels(e);
}

/** C6.2: is this Context an Effect INSTANCE (pure, opaque, a named
 *  effect, or an operator-minted conjunction)? */
export function isEffectInstance(t: ContextValue): boolean {
  return getEffectLabels(t) !== undefined;
}

/** e1 ⊆ e2 in the effect lattice — label-set inclusion (D40 R1: the
 *  kind's declared instance order). Top absorbs; the kind itself (no
 *  label set) is treated as top on the right, identity-only on the left. */
export function effectSubsetOf(e1: ContextValue, e2: ContextValue): boolean {
  const l1 = labelsOf(e1);
  const l2 = labelsOf(e2);
  if (l2 === null || l2 === undefined) return true;  // top (or the kind) absorbs
  if (l1 === null) return false;                      // top ⊄ anything bounded
  if (l1 === undefined) return e1 === e2;
  for (const l of l1) if (!l2.has(l)) return false;
  return true;
}

/** e1 implies e2: knowing e1's effects discharges a check for e2. Equivalent
 *  to `e2 ⊆ e1` — having the wider bound implies you have the narrower. */
export function effectImplies(e1: ContextValue, e2: ContextValue): boolean {
  return effectSubsetOf(e2, e1);
}

// --- The mint (D40 R2/R3) ----------------------------------------------------
// One writer; memoized by label set so label-set identity IS physical
// identity (`Effect("io") === Effect("io")`; two `io & time` mints are
// the same Context).

const effectInstanceCache = new Map<string, ContextValue>();

function mintEffect(labels: Set<string> | null, displayName?: string): ContextValue {
  const key = labels === null ? "\u22a4" : [...labels].sort().join("\u0000");
  const hit = effectInstanceCache.get(key);
  if (hit) return hit;
  const name = displayName ?? (labels === null ? "opaque"
    : labels.size === 0 ? "pure"
    : [...labels].sort().join(" & "));
  const eff = makeContext();
  setName(eff, stringToBits(name));
  writeShape(eff, Effect); // instance-of the kind (D40)
  setEffectLabels(eff, labels === null ? null : new Set(labels));
  // Declared instance fields as ordinary data bindings (D39: members on
  // the kind; storage is instance data, like record fields).
  addBinding(eff, "kind", withType(stringToBits(
    labels === null ? "opaque" : labels.size === 0 ? "pure" : "labeled"), StringType));
  if (labels !== null) {
    addBinding(eff, "labels",
      makeArray([...labels].sort().map((l) => withType(stringToBits(l), StringType))));
  }
  // The annotation bound is DERIVED from the label set at mint (the D39
  // addendum's collapse): callers through `f: <effect>` may produce at
  // most these labels. `opaque` carries no bound — universal pass.
  if (labels !== null) {
    setEffectBound(eff, { kind: "effects", labels: new Set(labels) });
  }
  effectInstanceCache.set(key, eff);
  return eff;
}

/** Lattice meet (greatest lower bound) — label-set intersection. */
export function effectIntersect(e1: ContextValue, e2: ContextValue): ContextValue {
  const l1 = labelsOf(e1);
  const l2 = labelsOf(e2);
  if (l1 === null) return e2;
  if (l2 === null) return e1;
  if (l1 === undefined || l2 === undefined) return pureEffect;
  return mintEffect(new Set([...l1].filter((x) => l2.has(x))));
}

/** Lattice join (least upper bound) — label-set union. Anonymous
 *  conjunctions (`io & time`) mint here (D40 R3 — the deferred debt
 *  closed): the result carries the union set, memoized. */
export function effectUnion(e1: ContextValue, e2: ContextValue): ContextValue {
  const l1 = labelsOf(e1);
  const l2 = labelsOf(e2);
  if (l1 === null || l2 === null) return opaqueEffect;
  if (l1 === undefined || l2 === undefined) return opaqueEffect;
  return mintEffect(new Set([...l1, ...l2]));
}

// The order ops are members ON THE KIND — instances dispatch through
// their shape (io.union(time) finds Effect's member with self = io).
addMember(effectMembers, EFFECT_MEMBER_SCOPE, "subset_of", makeMethodDescriptor("subset_of",
  makePrimitive("Effect.subset_of", (args) => {
    const e1 = dataOf(args[0]) as ContextValue;
    const e2 = dataOf(args[1]) as ContextValue;
    return withType(makeInt(effectSubsetOf(e1, e2) ? 1 : 0), BoolType);
  })
));
addMember(effectMembers, EFFECT_MEMBER_SCOPE, "implies", makeMethodDescriptor("implies",
  makePrimitive("Effect.implies", (args) => {
    const e1 = dataOf(args[0]) as ContextValue;
    const e2 = dataOf(args[1]) as ContextValue;
    return withType(makeInt(effectImplies(e1, e2) ? 1 : 0), BoolType);
  })
));
addMember(effectMembers, EFFECT_MEMBER_SCOPE, "intersect", makeMethodDescriptor("intersect",
  makePrimitive("Effect.intersect", (args) => {
    const e1 = dataOf(args[0]) as ContextValue;
    const e2 = dataOf(args[1]) as ContextValue;
    return wrapType(effectIntersect(e1, e2));
  })
));
addMember(effectMembers, EFFECT_MEMBER_SCOPE, "union", makeMethodDescriptor("union",
  makePrimitive("Effect.union", (args) => {
    const e1 = dataOf(args[0]) as ContextValue;
    const e2 = dataOf(args[1]) as ContextValue;
    return wrapType(effectUnion(e1, e2));
  })
));
setMembers(Effect, effectMembers);

// Constructor authority (D40 R2 / D45): `Effect("net")` mints a named
// effect; `Effect.define("net")` is the named-factory route.
setConstruct(Effect, makePrimitive("Effect.__construct", (args, ctx, evalFn) => {
  const nameV = dataOf(evalFn!(args[0], ctx!));
  if (nameV.kind !== ValueKind.Bits) {
    throw new AllegroError("Effect: the label must be a string");
  }
  return wrapType(buildEffect(bitsToString(nameV as BitsValue)));
}, true));

/** Mint an effect instance. `kind` selects the two absolutes; named
 *  effects carry the singleton label set. Memoized — same labels, same
 *  Context. */
export function buildEffect(name: string, kind?: "pure" | "opaque"): ContextValue {
  if (kind === "pure") return mintEffect(new Set(), "pure");
  if (kind === "opaque") return mintEffect(null, "opaque");
  return mintEffect(new Set([name]), name);
}

export const pureEffect: ContextValue = buildEffect("pure", "pure");
export const opaqueEffect: ContextValue = buildEffect("opaque", "opaque");

// =============================================================================
// Proof — the kind of proofs (C6.3, D40/D45; Phase F1 substrate)
// =============================================================================
//
// A Proof is a Value that witnesses a proposition. Proof is a KIND: it
// draws Type's kind-member symbols and declares its instances' fields
// (proposition / reason / counterexample / lhs / rhs — the D39 table,
// executed). Instances are Contexts stamped `__type = Proof` carrying
// those fields as plain data bindings plus the `__discharged` INTEGRITY
// CHANNEL.
//
// Constructor authority is KERNEL-PRIVATE (D40 R2 / D45): Proof holds
// NO `construct` — `Proof(...)` and `Proof.define(...)` fail, and the
// only mint is `makeProof`, which holds the module-private discharged
// channel writer (the attenuated-capability pattern). Holding a kind's
// construct IS holding its mint; not exporting it IS unforgeability —
// an ordinary capability instance, not a special arrangement.
//
// Failed proofs are the same shape with `__discharged = 0` plus
// reason/counterexample; `checkProofs` in `src/proofs.ts` surfaces them
// as error-severity notifications.

export const Proof: ContextValue = makeContext();
setName(Proof, stringToBits("Proof"));
writeShape(Proof, Type);
{
  const PROOF_MEMBER_SCOPE = typeMemberScopeFqn("Proof");
  const proofMembers = makeContext();
  // Draw Type's kind API — Proof joins the tower by construction.
  for (const [key, b] of typeMembers.bindings) {
    if (b.value) addBinding(proofMembers, key, b.value);
  }
  // Instance-data declarations (D39 Proof rows, executed at C6.3).
  addMember(proofMembers, PROOF_MEMBER_SCOPE, "proposition", makeFieldDescriptor("proposition", StringType));
  addMember(proofMembers, PROOF_MEMBER_SCOPE, "reason", makeFieldDescriptor("reason", StringType));
  addMember(proofMembers, PROOF_MEMBER_SCOPE, "counterexample", makeFieldDescriptor("counterexample", StringType));
  addMember(proofMembers, PROOF_MEMBER_SCOPE, "lhs", makeFieldDescriptor("lhs", AnyType));
  addMember(proofMembers, PROOF_MEMBER_SCOPE, "rhs", makeFieldDescriptor("rhs", AnyType));
  // E4 (E-R6): equality proofs record which equality they chained and
  // which law tier backed it (kernel / enumerated / witnessed / sampled
  // / admitted) — a `proof_trans` resting on admitted transitivity is
  // verdict-visibly weaker than one resting on a proven one.
  addMember(proofMembers, PROOF_MEMBER_SCOPE, "equality", makeFieldDescriptor("equality", StringType));
  addMember(proofMembers, PROOF_MEMBER_SCOPE, "lawName", makeFieldDescriptor("lawName", StringType));
  addMember(proofMembers, PROOF_MEMBER_SCOPE, "lawTier", makeFieldDescriptor("lawTier", StringType));
  setMembers(Proof, proofMembers);
}
// NO setConstruct(Proof, ...) — deliberately. See the header comment.

/** Construct a discharged proof witness for a proposition. `proposition`
 *  is the source-rendered text of what was proved (for display / export). */
export function makeProof(proposition: string): Value {
  const p = makeContext();
  setProposition(p, withType(stringToBits(proposition), StringType));
  dischargedWriterStd.write(p, makeInt(1));
  return withType(p, Proof);
}

/** Is this value a discharged Proof? */
export function isProof(v: Value): boolean {
  const t = getType(v);
  return t === Proof || getTypeName(v) === "Proof";
}

// =============================================================================
// Type System Extension
// =============================================================================

/**
 * Wrap a function value (PrimitiveFunction or ComposedFunction) as UntypedFunction.
 * (An `arity` component was formerly attached here when known; it was
 * write-only — never read anywhere — and was removed per the D39-addendum
 * slot review, 2026-07. Arity is derivable from Function[ParamTypes, R]
 * wherever it's actually needed.)
 */
export function wrapAsUntypedFunction(fn: Value): Value {
  const primary = dataOf(fn);
  const components = cloneComponents(fn);
  components.set("type", UntypedFunctionType);
  return makeMultiValue(primary, components);
}

/**
 * Check if a value is a function (PrimitiveFunction or ComposedFunction).
 */
/** C4.3b: user-visible type bindings ARE the type Context — the former
 *  MultiValue wrap is gone. A bare type Context already answers its
 *  meta-type through `channelReadRaw(t, "type"/"shape")` (the `__type`
 *  binding-plane fallback), and `getType` is total, so `type of Int`,
 *  `Int instanceof Type`, and meta-method dispatch all read the same
 *  storage the internal singletons use. Identity is the point: annotation
 *  symbols and internal construction sites resolve to the SAME object, so
 *  `actualType === expectedType` short-circuits keep working. */
export function wrapType(type: ContextValue): Value {
  return type;
}

// E2: the `Coercion.declare(From, To, fn)` surface (E-R2's standalone
// form — pairs stay first-class, define specs stay closed). A module-like
// typed Object: dot access rides Object's `__getMember`, no new dispatch
// machinery. Declarations instantiate their §7 obligations PENDING (E3
// routes them through PCP discharge).
const coercionDeclarePrim = makePrimitive("Coercion.declare", (args, ctx) => {
  const from = asContext(dataOf(args[0]));
  const to = asContext(dataOf(args[1]));
  if (!from || !to) {
    throw new AllegroError("Coercion.declare: expected (FromType, ToType, fn)");
  }
  const fn = args[2];
  const fd = dataOf(fn);
  if (fd.kind !== ValueKind.PrimitiveFunction && fd.kind !== ValueKind.ComposedFunction) {
    throw new AllegroError("Coercion.declare: third argument must be a function");
  }
  // E-R5: coercion fns feed the equality protocol — same purity gate as
  // `eq` implementations.
  assertPureForEquality(fn, "Coercion.declare: coercion fn", ctx);
  declareCoercion(from, to, fn);
  return noneSingleton;
});

// E3: the witnessed tier for the §7 coercion obligations — attach a
// discharged Proof term to a declared edge's preservation/coherence slot.
const coercionWitnessPrim = makePrimitive("Coercion.witness", (args) => {
  const from = asContext(dataOf(args[0]));
  const to = asContext(dataOf(args[1]));
  if (!from || !to) {
    throw new AllegroError("Coercion.witness: expected (FromType, ToType, obligation, proof)");
  }
  const obD = dataOf(args[2]);
  const which = obD.kind === ValueKind.Bits ? bitsToString(obD as BitsValue) : "";
  if (which !== "equality-preservation" && which !== "coherence") {
    throw new AllegroError(
      `Coercion.witness: obligation must be "equality-preservation" or "coherence"`);
  }
  if (!isDischargedProofValue(args[3])) {
    throw new AllegroError("Coercion.witness: the proof term is not a discharged Proof");
  }
  const edge = coercionRegistry.get(equalityShape(from))?.get(equalityShape(to));
  if (!edge) {
    throw new AllegroError(
      `Coercion.witness: no declared coercion from '${typeCtxName(from)}' to '${typeCtxName(to)}'`);
  }
  const slot = which === "coherence" ? edge.coherence : edge.preservation;
  slot.status = "discharged";
  slot.tier = "witnessed";
  return noneSingleton;
});
// E4: the admitted tier for coercion obligations — mark a declared
// edge's obligation ASSUMED (verdict-visible; no-op when discharged).
const coercionAssumePrim = makePrimitive("Coercion.assume", (args) => {
  const from = asContext(dataOf(args[0]));
  const to = asContext(dataOf(args[1]));
  if (!from || !to) {
    throw new AllegroError("Coercion.assume: expected (FromType, ToType, obligation)");
  }
  const obD = dataOf(args[2]);
  const which = obD.kind === ValueKind.Bits ? bitsToString(obD as BitsValue) : "";
  if (which !== "equality-preservation" && which !== "coherence") {
    throw new AllegroError(
      `Coercion.assume: obligation must be "equality-preservation" or "coherence"`);
  }
  const edge = coercionRegistry.get(equalityShape(from))?.get(equalityShape(to));
  if (!edge) {
    throw new AllegroError(
      `Coercion.assume: no declared coercion from '${typeCtxName(from)}' to '${typeCtxName(to)}'`);
  }
  const slot = which === "coherence" ? edge.coherence : edge.preservation;
  if (slot.status === "discharged") return noneSingleton; // proven beats admitted
  slot.status = "admitted";
  slot.tier = "admitted";
  return noneSingleton;
});
const coercionSurface: Value = makeObject([
  ["declare", coercionDeclarePrim],
  ["witness", coercionWitnessPrim],
  ["assume", coercionAssumePrim],
]);

// E3: the `Law.witness(Type, "name", proof)` surface — the `by` path for
// law obligations.
const lawWitnessPrim = makePrimitive("Law.witness", (args) => {
  const t = asContext(dataOf(args[0]));
  if (!t) throw new AllegroError("Law.witness: expected (Type, lawName, proof)");
  const nameD = dataOf(args[1]);
  if (nameD.kind !== ValueKind.Bits) {
    throw new AllegroError("Law.witness: law name must be a String");
  }
  witnessLawObligation(t, bitsToString(nameD as BitsValue), args[2]);
  return noneSingleton;
});
// E4: `Law.assume(Type, "name")` — the admitted tier (`assume law`).
const lawAssumePrim = makePrimitive("Law.assume", (args) => {
  const t = asContext(dataOf(args[0]));
  if (!t) throw new AllegroError("Law.assume: expected (Type, lawName)");
  const nameD = dataOf(args[1]);
  if (nameD.kind !== ValueKind.Bits) {
    throw new AllegroError("Law.assume: law name must be a String");
  }
  admitLawObligation(t, bitsToString(nameD as BitsValue));
  return noneSingleton;
});
const lawSurface: Value = makeObject([
  ["witness", lawWitnessPrim],
  ["assume", lawAssumePrim],
]);

// E3: `for_all(fn)` — the quantified-proposition constructor (E-R3). All
// params of the body range over the implementing type.
const forAllPrim = makePrimitive("for_all", (args) => {
  const d = dataOf(args[0]);
  if (d.kind !== ValueKind.ComposedFunction && d.kind !== ValueKind.PrimitiveFunction) {
    throw new AllegroError("for_all: argument must be a function (the quantified proposition body)");
  }
  return makeForAllProp(args[0]);
});

// B-097 V3 (D43/V-R5): the modifier combinator surface. `private(decl)`
// marks a define/Interface spec entry as a private member (kernel
// mediation enforces it); `readonly(decl)` records the RESERVED
// attribute — inert until B-046 lands write semantics. Keyword syntax
// (`private x: Int`) is B-043 and lowers to these same attributes.
const privatePrim = makePrimitive("private", (args) => makeModifiedSpec(args[0], "private"));
const readonlyPrim = makePrimitive("readonly", (args) => makeModifiedSpec(args[0], "readonly"));

export function createTypeSystem(): Extension {
  return {
    name: "types",
    bindings: {
      Any: wrapType(AnyType) as any,
      Int: wrapType(IntType) as any,
      Float: wrapType(FloatType) as any,
      String: wrapType(StringType) as any,
      Bool: wrapType(BoolType) as any,
      Array: wrapType(ArrayType) as any,
      Future: wrapType(FutureType) as any,
      Object: wrapType(ObjectType) as any,
      Function: wrapType(FunctionType) as any,
      UntypedFunction: wrapType(UntypedFunctionType) as any,
      // Meta-types — the kind tower (C6.1b, D45)
      Type: wrapType(Type) as any,
      Refinement: wrapType(RefinementKind) as any,
      Interface: wrapType(InterfaceKind) as any,
      None: wrapType(NoneType) as any,
      Error: wrapType(ErrorType) as any,
      // Effect meta-type + core absolutes
      Effect: wrapType(Effect) as any,
      pure: wrapType(pureEffect) as any,
      opaque: wrapType(opaqueEffect) as any,
      // Proof meta-type (Phase F1)
      Proof: wrapType(Proof) as any,
      // Coercion declaration surface (E2 — B-027 §7 step 2)
      Coercion: coercionSurface as any,
      // Lawful interfaces (E3 — B-027 §8, D38)
      Equatable: wrapType(EquatableType) as any,
      Law: lawSurface as any,
      for_all: forAllPrim as any,
      // Modifier combinators (B-097 V3, D43)
      private: privatePrim as any,
      readonly: readonlyPrim as any,
      // Literal bindings (parsed as identifiers, resolved here)
      true: withType(makeInt(1), BoolType) as any,
      false: withType(makeInt(0), BoolType) as any,
      none: noneSingleton as any,
    },
  };
}
