// =============================================================================
// Allegro Standard — Core Type Definitions
// Defines Int and String types as Context values with method bindings.
// Types are attached to values as MultiValue "type" components.
// =============================================================================

import {
  Value, ValueKind, BitsValue, ContextValue, MultiValueType, PrimitiveFnImpl, PrimitiveFunctionValue,
  ComposedFunctionValue,
  makeInt, makeFloat, bitsToFloat, makeBits, makePrimitive, makeExpr, makeContext, makeMultiValue, makeDenseArrayCtx,
  makeComposedFn, makeParam,
  stringToBits, bitsToString, AllegroError,
  Extension,
} from "./types.js";
import { domainFromPredicate, PredicateSet, withPredicates as rfWithPredicates, Predicate, occurrenceBoundOf, withOccurrenceBound, clearOccurrenceBound } from "./refinements.js";
import { kernelMemberFqn, fqnBaseName, memberFqnIn, newTypeMemberScope, typeMemberScopeFqn, FQN_SEP } from "./symbols.js";
import {
  getName, getMembers, getRefines, getConstruct, getInterfaceMarker, getPredicate,
  getGenericArgs, getGenericParamsSlot, getGenericBackLink, getGenericConstructor,
  getSlotCount, getAbstractDomain, getEffectKind, getEffectBound, getVariants, isGenericTypeSlot, indexGet, elementsOf,
  setName, setMembers, setRefines, setConstruct, setFallbackMember, markInterface,
  setWraps, setVariants, setPredicate, setGenericParams, setGenericArgs,
  setGenericBackLink, markGeneric, setGenericConstructor, setProposition,
  setEffectKind, setEffectBound, setSlotCount, setAbstractDomain,
  writeShape, removeName, removeRefines, removeShapeSlot, kernelChannelWriter, assertNotIntegrityKey,
  removeConstruct, channelReadRaw, cloneComponents, SLOT_KEYS, isMetaSlotKey, dataOf, typeShape,
} from "./slots.js";


// --- Constants ---

/** Meta-method names that should NOT be copied into new types during define/interface.
 *  C6.1b: the fluent names (where/interface/preserveOps/mixin/invariant)
 *  left with the fluent API; the surviving kind API is small. */
const META_METHOD_NAMES = new Set([
  "instanceof", "subtypeof", "define", "distinct", "constructor",
]);

// --- Helpers ---

/** Get the type channel from a value. C4.3b: total — flattened Contexts
 *  (typed records/arrays) answer through their component plane, and bare
 *  type Contexts answer their meta-type through the `__type` binding-plane
 *  fallback (so `getType(IntType)` is `Type`, where it was null before the
 *  flatten — type values and typed values read uniformly). */
export function getType(v: Value): ContextValue | null {
  const t = channelReadRaw(v, "type");
  if (t && t.kind === ValueKind.Context) return t;
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
      && prior.kind === ValueKind.Context && type?.kind === ValueKind.Context) {
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
  if (v.kind !== ValueKind.MultiValue && v.kind !== ValueKind.Context) return v;
  const name = typeContextName(expected);
  if (!name || name === "Any" || name === "Function" || name === "UntypedFunction") return v;
  if (getEffectBound(expected) !== undefined) return v;
  if (getEffectKind(expected) !== undefined) return v;
  if (getInterfaceMarker(expected) !== undefined) return v;
  if (getVariants(expected) !== undefined) return v;
  if (isGenericTypeSlot(expected) || getGenericArgs(expected) !== undefined) return v;
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
  const ctx = v.kind === ValueKind.Context ? v : (v.kind === ValueKind.MultiValue ? dataOf(v) : null);
  if (!ctx || ctx.kind !== ValueKind.Context) return null;
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
  if (membersV?.kind === ValueKind.Context) {
    const descV = memberBindingByName(membersV as ContextValue, name);
    if (descV?.kind === ValueKind.Context) {
      const desc = descV as ContextValue;
      // For Method descriptors, return the implementation
      const valueBinding = desc.bindings.get("value");
      if (valueBinding?.value) return valueBinding.value;
      // For Field descriptors, return null (fields are not methods)
      return null;
    }
  }
  // Fallback: direct binding lookup (for __getMember and other special bindings)
  const binding = type.bindings.get(name);
  if (!binding || binding.value === undefined) return null;
  return binding.value;
}

/** C6.1a: the member-set write chokepoint — stores the descriptor under
 *  the member symbol's FQN key in the DECLARING TYPE's OWN scope (per-type
 *  name-stable scopes; the shared kernel scope made cross-built-in
 *  conformance accidental under symbol membership). `addBinding` remains
 *  for descriptor internals and non-member contexts. */
function addMember(members: ContextValue, scopeFqn: string, baseName: string, desc: Value): void {
  addBinding(members, memberFqnIn(scopeFqn, baseName), desc);
  (members as any).__memberNameIndex = undefined;
}

/** Lazy base-name index on a member set (JS-side cache field, like
 *  `__predicateSet`'s precedent). Sound because member sets are
 *  populated fully during construction before the first lookup and are
 *  never mutated after (derived types clone into fresh sets). */
function memberNameIndex(members: ContextValue): Map<string, Value[]> {
  const cached = (members as any).__memberNameIndex as Map<string, Value[]> | undefined | null;
  if (cached) return cached;
  const idx = new Map<string, Value[]>();
  for (const [key, b] of members.bindings) {
    if (b.value === undefined) continue;
    const base = fqnBaseName(key);
    const arr = idx.get(base);
    if (arr) arr.push(b.value);
    else idx.set(base, [b.value]);
  }
  (members as any).__memberNameIndex = idx;
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
 *  Returns the storage key (the bound symbol's FQN). */
function drawMemberKey(drawnContexts: ContextValue[], baseName: string, localScope: string): string {
  const matches = new Map<string, Value | undefined>(); // key → descriptor (target)
  for (const drawn of drawnContexts) {
    const membersV = getMembers(drawn);
    if (membersV?.kind !== ValueKind.Context) continue;
    for (const [key, b] of (membersV as ContextValue).bindings) {
      if (fqnBaseName(key) === baseName) matches.set(key, b.value);
    }
  }
  if (matches.size === 0) return memberFqnIn(localScope, baseName);
  if (matches.size === 1) return [...matches.keys()][0];
  // Distinct KEYS may still be one TARGET (multi-bound descriptor).
  const targets = new Set(matches.values());
  if (targets.size === 1) return [...matches.keys()][0];
  throw new AllegroError(
    `member '${baseName}' matches multiple distinct drawn members (${[...matches.keys()].join(", ")}) — explicit resolution required`,
  );
}

/** C5.2b: store a descriptor under an explicit (draw-resolved) key.
 *  Invalidates the lazy name index — construction-time lookups (mixin's
 *  conflict check) may have built it on a partial set. */
function addMemberAt(members: ContextValue, key: string, desc: Value): void {
  addBinding(members, key, desc);
  (members as any).__memberNameIndex = undefined;
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
  const local = (typeCtx as any).__localMemberScope as string | undefined;
  if (!local || local === stableScope) return;
  const membersV = getMembers(typeCtx);
  if (membersV?.kind !== ValueKind.Context) return;
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
  (members as any).__memberNameIndex = undefined;
  (typeCtx as any).__localMemberScope = stableScope;
}

/** Read-side projection view for consumers that iterate members by base
 *  name (tests, tooling): baseName → descriptor. */
export function memberDescriptorsOf(type: ContextValue): Map<string, ContextValue> {
  const out = new Map<string, ContextValue>();
  const membersV = getMembers(type);
  if (membersV?.kind === ValueKind.Context) {
    for (const [key, b] of (membersV as ContextValue).bindings) {
      if (b.value?.kind === ValueKind.Context) out.set(fqnBaseName(key), b.value as ContextValue);
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
// (by __members compatibility). This collapses the older Type / NominalType split
// into a single meta-type — the named-vs-anonymous distinction is now a property
// of the type value, not of its meta-type.
//
// `~T` (structural wrap) erases __name to project a named type into anonymous form.
//
// `NominalType` is retained as a back-compat alias (= Type) so existing user code
// reading `Int instanceof NominalType` continues to work. Multiple inheritance and
// NominalType-as-mixin are deferred — see memory/design_type_system_meta_types.md.
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
  //     refines path is knowledge-layer plumbing (`distinct`), NOT a
  //     declaration: distinct types conform to nothing but themselves;
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
    if (parentV?.kind !== ValueKind.Context) break;
    cur = parentV as ContextValue;
    if (cur === typeB) return typeArgsMatch(typeA, typeB);
  }
  // Effect instances keep chain/identity semantics until C6.2 re-derives
  // the lattice (buildEffect's member copies share key sets, which would
  // make pure/opaque mutually conformant under membership).
  if (getEffectKind(typeB) !== undefined) return false;
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

  if (bMembersVal?.kind === ValueKind.Context) {
    const bMembers = bMembersVal as ContextValue;
    const aMembers = aMembersVal?.kind === ValueKind.Context ? aMembersVal as ContextValue : null;
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
    if (isInterfaceType(typeB) || getTypeNameFromCtx(typeB) !== null) {
      for (const key of bMembers.bindings.keys()) {
        if (!aMembers.bindings.has(key)) return false;
      }
      return true;
    }
    const aNames = new Set<string>();
    for (const key of aMembers.bindings.keys()) aNames.add(fqnBaseName(key));
    for (const key of bMembers.bindings.keys()) {
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
  if (!expectedArgsV || expectedArgsV.kind !== ValueKind.Context) return true; // no args to check
  const actualArgsV = getGenericArgs(actual);
  if (!actualArgsV || actualArgsV.kind !== ValueKind.Context) return true; // actual has no args — accept (bare generic)

  const expectedArgsCtx = expectedArgsV as ContextValue;
  const actualArgsCtx = actualArgsV as ContextValue;
  const expElems = arrayElements(expectedArgsCtx);
  const actElems = arrayElements(actualArgsCtx);

  if (expElems.length !== actElems.length) return false;

  for (let i = 0; i < expElems.length; i++) {
    const expArg = dataOf(expElems[i]);
    const actArg = dataOf(actElems[i]);
    if (expArg.kind !== ValueKind.Context || actArg.kind !== ValueKind.Context) continue;
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

/**
 * Back-compat alias. NominalType used to be a distinct meta-type; its semantics
 * (nominal comparison) now live inside Type's shape-aware methods, dispatching
 * on __name presence. Keeping the export means existing user code (and tests)
 * referring to `NominalType` continue to work.
 */
export const NominalType: ContextValue = Type;

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

// --- Union Type ---

/**
 * Create a union type from alternatives: `A | B | C`
 * A union type's instanceof checks if the value satisfies ANY alternative.
 * A union type's subtypeof checks if ALL alternatives are subtypes of the target.
 */
export function makeUnionType(alternatives: ContextValue[]): ContextValue {
  const union = makeContext();
  setName(union, stringToBits(
    alternatives.map(a => {
      const n = getName(a);
      return n && n.kind === ValueKind.Bits ? bitsToString(n) : "?";
    }).join(" | ")
  ));
  // Store alternatives as an array-like Context
  for (let i = 0; i < alternatives.length; i++) {
    addBinding(union, String(i), alternatives[i]);
  }
  setSlotCount(union, makeInt(alternatives.length));
  setVariants(union, makeInt(1)); // marker

  // instanceof: value matches if it matches ANY alternative
  addBinding(union, "instanceof", makePrimitive("UnionType.instanceof", (args) => {
    const value = args[0];
    const valueType = getType(value);
    if (!valueType) return makeInt(0);
    const valueName = getTypeName(value);
    for (let i = 0; i < alternatives.length; i++) {
      const alt = alternatives[i];
      const altName = getName(alt);
      const altNameStr = altName && altName.kind === ValueKind.Bits ? bitsToString(altName) : null;
      if (altNameStr && altNameStr === valueName) return makeInt(1);
      // Also check via the alternative's meta-type instanceof
      const altMetaType = channelReadRaw(alt, "shape") as ContextValue | undefined;
      if (altMetaType) {
        const altInstanceof = typeMethod(altMetaType, "instanceof");
        if (altInstanceof?.kind === ValueKind.PrimitiveFunction) {
          const result = altInstanceof.fn([alt, value], undefined as any, undefined as any);
          const rp = dataOf(result);
          if (rp.kind === ValueKind.Bits && (rp as BitsValue).data !== 0n) return makeInt(1);
        }
      }
    }
    return makeInt(0);
  }));

  // subtypeof: this union is a subtype of target if ALL alternatives are subtypes
  addBinding(union, "subtypeof", makePrimitive("UnionType.subtypeof", (args) => {
    const target = args[0] as ContextValue;
    for (const alt of alternatives) {
      const altMetaType = channelReadRaw(alt, "shape") as ContextValue | undefined;
      if (!altMetaType) return makeInt(0);
      const altSubtype = typeMethod(altMetaType, "subtypeof");
      if (!altSubtype || altSubtype.kind !== ValueKind.PrimitiveFunction) return makeInt(0);
      const result = altSubtype.fn([alt, target], undefined as any, undefined as any);
      const rp = dataOf(result);
      if (rp.kind === ValueKind.Bits && (rp as BitsValue).data === 0n) return makeInt(0);
    }
    return makeInt(1);
  }));

  // Set __type to Type (unions are structural)
  writeShape(union, Type);

  return union;
}

// Bootstrap: Type self-types
writeShape(Type, Type);

// =============================================================================
// Member Descriptor Types (bootstrap)
// Member/Method/Field are named types created before buildType is available.
// =============================================================================

/** Abstract base type for member descriptors */
export const MemberType: ContextValue = makeContext();
setName(MemberType, stringToBits("Member"));
writeShape(MemberType, Type);

/** Method descriptor — a member with an implementation function */
export const MethodType: ContextValue = makeContext();
setName(MethodType, stringToBits("Method"));
writeShape(MethodType, Type);
setRefines(MethodType, MemberType);

/** Field descriptor — a member representing instance data */
export const FieldType: ContextValue = makeContext();
setName(FieldType, stringToBits("Field"));
writeShape(FieldType, Type);
setRefines(FieldType, MemberType);

/** Create a Method descriptor */
export function makeMethodDescriptor(
  name: string,
  impl: PrimitiveFunctionValue,
  isGetter: boolean = false,
): ContextValue {
  const desc = makeContext();
  writeShape(desc, MethodType);
  addBinding(desc, "name", stringToBits(name));
  addBinding(desc, "value", impl);
  if (isGetter) addBinding(desc, "getter", makeInt(1));
  return desc;
}

/** Create a Field descriptor */
export function makeFieldDescriptor(
  name: string,
  fieldType: Value,
): ContextValue {
  const desc = makeContext();
  writeShape(desc, FieldType);
  addBinding(desc, "name", stringToBits(name));
  addBinding(desc, "fieldType", fieldType);
  return desc;
}

/** Check if a descriptor is a Method */
export function isMethodDescriptor(desc: ContextValue): boolean {
  return channelReadRaw(desc, "shape") === MethodType;
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
  if (!membersV || membersV.kind !== ValueKind.Context) return null;
  const descV = memberBindingByName(membersV as ContextValue, name);
  if (!descV || descV.kind !== ValueKind.Context) return null;
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
): ContextValue {
  // Extract field specs from the Object's Context
  const fieldCtx = dataOf(fieldSpecObj);
  if (fieldCtx.kind !== ValueKind.Context) {
    throw new AllegroError("define: argument must be an object literal {field: Type, ...}");
  }
  // C6.1b (D45): the spec unifies fields and methods — an entry whose
  // value is a FUNCTION VALUE (ComposedFunction / PrimitiveFunction) is a
  // method implementation (the old `.mixin()` surface); anything else —
  // including function TYPES like `toString: Function` — declares a typed
  // field. Methods do not participate in the positional constructor.
  const fields: { name: string; type: Value }[] = [];
  const methods: { name: string; impl: Value }[] = [];
  for (const [key, binding] of (fieldCtx as ContextValue).bindings) {
    if (isMetaSlotKey(key)) continue;
    if (binding.value) {
      const entry = dataOf(binding.value);
      if (entry.kind === ValueKind.ComposedFunction || entry.kind === ValueKind.PrimitiveFunction) {
        methods.push({ name: key, impl: entry });
      } else {
        fields.push({ name: key, type: binding.value });
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
  (newType as any).__localMemberScope = recordScope;
  for (const f of fields) {
    addMemberAt(members, drawMemberKey(drawn, f.name, recordScope),
      makeFieldDescriptor(f.name, f.type));
  }

  // Method entries (the unified mixin surface). A method whose base name
  // matches a drawn member DRAWS that symbol — an override that keeps
  // member identity (C5.2b); new names get type-local symbols. Methods
  // receive `self` (the typed instance) as their first argument;
  // type_dispatch handles both PrimitiveFunction and ComposedFunction
  // descriptors with self-binding.
  for (const m of methods) {
    const key = drawMemberKey(drawn, m.name, recordScope);
    if (m.impl.kind === ValueKind.PrimitiveFunction) {
      addMemberAt(members, key, makeMethodDescriptor(m.name, m.impl as PrimitiveFunctionValue));
    } else {
      const desc = makeContext();
      writeShape(desc, MethodType);
      addBinding(desc, "name", stringToBits(m.name));
      addBinding(desc, "value", m.impl);
      addMemberAt(members, key, desc);
    }
  }

  // Copy non-meta Method descriptors from each drawn bundle's __members.
  // C5.2a: keys are member-symbol FQNs — copied verbatim (same symbol,
  // same key); the meta filter compares the base-name projection.
  const metaMethodNames = META_METHOD_NAMES;
  for (const bundle of drawn) {
    const bundleMembers = getMembers(bundle);
    if (bundleMembers?.kind !== ValueKind.Context) continue;
    for (const [key, binding] of (bundleMembers as ContextValue).bindings) {
      if (metaMethodNames.has(fqnBaseName(key))) continue;
      if (!members.bindings.has(key) && binding.value) {
        addBinding(members, key, binding.value);
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
  const isBundle = fields.length === 0 && methods.length > 0;
  if (isBundle) {
    setMembers(newType, members);
    return newType;
  }

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
    for (const f of fields) {
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
    return withType(stringToBits(`${typeName}(${parts.join(", ")})`), StringType);
  }) as PrimitiveFnImpl);
  // toString draws a bundle's symbol if one exists (an override, same
  // member identity); otherwise it gets a type-local symbol. A toString
  // METHOD supplied in the spec wins over the auto-generated one.
  if (!methods.some((m) => m.name === "toString")) {
    addMemberAt(members, drawMemberKey(drawn, "toString", recordScope),
      makeMethodDescriptor("toString", toStringImpl));
  }

  setMembers(newType, members);

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
  if (specCtx.kind !== ValueKind.Context) {
    throw new AllegroError("Interface.define: argument must be an object literal {member: Type, ...}");
  }

  // Extract declared members from the spec
  const declaredMembers: { name: string; type: Value }[] = [];
  for (const [key, binding] of (specCtx as ContextValue).bindings) {
    if (isMetaSlotKey(key)) continue;
    if (binding.value) {
      declaredMembers.push({ name: key, type: binding.value });
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
  (ifaceType as any).__localMemberScope = ifaceScope;
  for (const m of declaredMembers) {
    addMemberAt(members, drawMemberKey(drawn, m.name, ifaceScope),
      makeFieldDescriptor(m.name, m.type));
  }

  // Copy non-meta members from each drawn bundle (C5.2a: FQN keys copied
  // verbatim; meta filter on the base-name projection) — the old
  // parent-inheritance form `Int.interface(spec)` is now
  // `Interface.define(spec, Int)`.
  const metaMethodNames = META_METHOD_NAMES;
  for (const bundle of drawn) {
    const bundleMembers = getMembers(bundle);
    if (bundleMembers?.kind !== ValueKind.Context) continue;
    for (const [key, binding] of (bundleMembers as ContextValue).bindings) {
      if (metaMethodNames.has(fqnBaseName(key))) continue;
      if (!members.bindings.has(key) && binding.value) {
        addBinding(members, key, binding.value);
      }
    }
  }

  setMembers(ifaceType, members);

  return ifaceType;
}

/**
 * Build a refined type: inherits parent, wraps constructor with predicate check.
 */
export function buildRefinedType(parentType: ContextValue, predicate: Value): ContextValue {
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
  if (parentMembers?.kind === ValueKind.Context) {
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
  setAbstractDomain(refinedType, domainFromPredicate(predicate));

  // Wrap __construct with predicate check
  const parentConstruct = getConstruct(parentType);
  if (parentConstruct?.kind === ValueKind.PrimitiveFunction) {
    removeConstruct(refinedType);

    setConstruct(refinedType, makePrimitive("refined.__construct", (args, ctx, evalFn) => {
      // Call parent constructor
      const value = (parentConstruct as PrimitiveFunctionValue).fn(args, ctx, evalFn);

      // Error propagation: if parent constructor produced an error (e.g., its
      // own refinement check failed further up the chain), propagate it
      // without re-tagging or running this predicate. Without this, a deeper
      // refinement's error would get silently retagged with the outer type.
      if (channelReadRaw(value, "error") !== undefined) return value;

      // Apply predicate
      const checkResult = evalFn!(makeExpr(predicate, [value]), ctx!);
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
    }, true));
  }

  return refinedType;
}

// C6.1b (D45): buildInvariantedType is DELETED — lifecycle invariants are
// ordinary refinements now (`T & pred`, chained per clause). The
// `__invariantsList` slot has no remaining writer; its registry entry is
// swept in C6.3's slot-disposition pass.

/**
 * Build a distinct type: copies parent, breaks subtypeof chain.
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
  // Copy __members from parent (shared reference — same descriptors)
  const parentMembers = getMembers(parentType);
  if (parentMembers?.kind === ValueKind.Context) {
    setMembers(distinctType, parentMembers);
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
  if (!predicate || !parentType || parentType.kind !== ValueKind.Context) {
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
    setConstruct(newType, makePrimitive("refined.__construct", (args, ctx, evalFn) => {
      const value = (parentConstruct as PrimitiveFunctionValue).fn(args, ctx, evalFn);
      const checkResult = evalFn!(makeExpr(predicate, [value]), ctx!);
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
    }, true));
  }

  // Clone __members and add lifted operator descriptors. C5.2b: the
  // long-latent unfiltered copy is fixed — meta-method names no longer
  // ride into instance member sets (the wart the symbol re-keying made
  // visible; recon 2026-08).
  const parentMembers = getMembers(refinedType);
  const newMembers = makeContext();
  if (parentMembers?.kind === ValueKind.Context) {
    for (const [key, binding] of (parentMembers as ContextValue).bindings) {
      if (META_METHOD_NAMES.has(fqnBaseName(key))) continue;
      if (binding.value) addBinding(newMembers, key, binding.value);
    }
  }

  const newConstruct = getConstruct(newType) as PrimitiveFunctionValue | undefined;
  const liftScope = newTypeMemberScope();
  (newType as any).__localMemberScope = liftScope;

  for (const opName of ops) {
    const parentDesc = parentMembers?.kind === ValueKind.Context
      ? memberBindingByName(parentMembers as ContextValue, opName)
      : null;
    if (!parentDesc || parentDesc.kind !== ValueKind.Context) continue;
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
    addMemberAt(newMembers, drawMemberKey([refinedType], opName, liftScope),
      makeMethodDescriptor(opName, liftedOp));
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
  if (baseMembers?.kind === ValueKind.Context) {
    for (const [key, binding] of (baseMembers as ContextValue).bindings) {
      if (META_METHOD_NAMES.has(fqnBaseName(key))) continue;
      if (binding.value) addBinding(newMembers, key, binding.value);
    }
  }
  const layerScope = newTypeMemberScope();
  (newType as any).__localMemberScope = layerScope;
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
    if (kind.kind !== ValueKind.Context || !isKind(kind as ContextValue)) {
      const name = kind.kind === ValueKind.Context
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
// `preserveOps` is the Refinement spec's `preserve` option. `distinct`
// and `constructor` remain pending their own kind-spec designs.
addMember(typeMembers, TYPE_MEMBER_SCOPE, "distinct", makeMethodDescriptor("distinct",
  makePrimitive("Type.distinct", (args) => {
    return wrapType(buildDistinctType(args[0] as ContextValue));
  })
));
addMember(typeMembers, TYPE_MEMBER_SCOPE, "constructor", makeMethodDescriptor("constructor",
  makePrimitive("Type.constructor", (args) => {
    const type = args[0] as ContextValue;
    const fn = args[1];
    removeConstruct(type);
    setConstruct(type, makePrimitive("custom.__construct", (ctorArgs, ctorCtx, ctorEvalFn) => {
      const result = ctorEvalFn!(makeExpr(fn, ctorArgs), ctorCtx!);
      return withTypeReplacing(dataOf(result), type);
    }, true));
    return wrapType(type);
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
  eq: (args) => {
    // Reference equality for now (arrays are Contexts)
    return makeInt(args[0] === args[1] ? 1 : 0);
  },
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
  eq: (args) => makeInt(args[0] === args[1] ? 1 : 0),
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
  if (first.kind !== ValueKind.Context) {
    throw new AllegroError("Refinement: base must be a type");
  }
  const specRefines = args.length === 1
    ? (first as ContextValue).bindings.get("refines")?.value : undefined;
  if (specRefines !== undefined) {
    const base = dataOf(specRefines);
    if (base.kind !== ValueKind.Context) {
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
    for (const [k, b] of (first as ContextValue).bindings) {
      if (isMetaSlotKey(k) || RESERVED_REFINEMENT_KEYS.has(k)) continue;
      if (!b.value) continue;
      const entry = dataOf(b.value);
      if (entry.kind !== ValueKind.ComposedFunction && entry.kind !== ValueKind.PrimitiveFunction) {
        throw new AllegroError(
          `Refinement: spec entry '${k}' must be a method (function value) — fields live on record kinds`);
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
      } else if (p.kind === ValueKind.Context) {
        for (const el of arrayElements(p as ContextValue)) {
          const e = dataOf(el);
          if (e.kind === ValueKind.Bits) opNames.push(bitsToString(e as BitsValue));
        }
      } else {
        throw new AllegroError("Refinement: preserve must be \"all\" or a list of operator names");
      }
      refined = buildPreserveOps(refined, opNames);
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
    if (b.kind !== ValueKind.Context) {
      throw new AllegroError("Type: drawn bundles must be types");
    }
    drawn.push(b as ContextValue);
  }
  return wrapType(buildRecordType(spec, drawn, Type));
}, true));

// Interface = the refinement mint applied to Type with the declaration-only
// predicate. Its own construct is REPLACED (the wrapped Type-construct a
// refinement would inherit mints records — an Interface instance is a
// declaration, so the kind's authority is the interface mint instead).
const declarationOnlyPredicate = makePrimitive("Interface.__declarationOnly", (args) => {
  const t = dataOf(args[0]);
  return makeInt(
    t.kind === ValueKind.Context && getConstruct(t as ContextValue) === undefined ? 1 : 0);
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
    if (b.kind !== ValueKind.Context) {
      throw new AllegroError("Interface: drawn bundles must be types");
    }
    drawn.push(b as ContextValue);
  }
  return wrapType(buildInterfaceType(spec, drawn));
}, true));

/** C6.1b: the kinds whose `define`/call-as-function mint type-values.
 *  Effect and Proof join the tower when they are re-derived through the
 *  recipe (C6.2 / C6.3). */
function isKind(t: ContextValue): boolean {
  return t === Type || t === RefinementKind || t === InterfaceKind;
}

export const IntType: ContextValue = buildType("Int", intMethods);
export const FloatType: ContextValue = buildType("Float", floatMethods);
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
// Generic Type Infrastructure
// =============================================================================

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
    if (a.kind === ValueKind.Context) {
      const ctx = a as ContextValue;
      // Named type (Int, String, Array, etc.)
      const nv = getName(ctx);
      if (nv?.kind === ValueKind.Bits) {
        const typeName = bitsToString(nv);
        // Check for type args (concrete generic like Array[Int])
        const argsV = getGenericArgs(ctx);
        if (argsV?.kind === ValueKind.Context) {
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
    if (a.kind === ValueKind.MultiValue) {
      const p = dataOf(a);
      if (p.kind === ValueKind.Bits) return `v:${(p as BitsValue).data}`;
      return cacheKeyOne(p, idx);
    }
    // Params and Symbols (type variables) — unique per name
    if (a.kind === ValueKind.Param) return `param:${(a as any)._name ?? idx}`;
    if (a.kind === ValueKind.Symbol) return `sym:${(a as any).name}`;
    return `unk:${idx}`;
  }

  // Build the base type with methods + generic metadata
  const ctx = buildType(name, methods, { methodEffects: options?.methodEffects });

  // Add __params (use raw array to avoid circular dep with ArrayType)
  setGenericParams(ctx, makeRawArrayCtx(paramNames.map(n => stringToBits(n))));

  // Add __constructor
  const constructorFn = makePrimitive(`${name}.__constructor`, (args: Value[]) => {
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
  setGenericConstructor(ctx, constructorFn);

  // Mark as generic
  markGeneric(ctx, makeInt(1));

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
 * Check if a type is a generic type (has __isGeneric).
 */
export function isGenericType(type: ContextValue): boolean {
  return isGenericTypeSlot(type);
}

/**
 * Get the type arguments from a concrete parameterized type.
 * Returns null if the type has no __args.
 */
export function getTypeArgs(type: ContextValue): Value[] | null {
  const argsV = getGenericArgs(type);
  if (!argsV) return null;
  const ctx = dataOf(argsV);
  if (ctx.kind !== ValueKind.Context) return null;
  return arrayElements(ctx as ContextValue);
}

/**
 * Get the generic type from a concrete parameterized type.
 */
export function getGenericType(type: ContextValue): ContextValue | null {
  const g = getGenericBackLink(type);
  if (!g || g.kind !== ValueKind.Context) return null;
  return g;
}

/**
 * Get the number of type parameters on a generic type.
 */
function getGenericParamCount(generic: ContextValue): number {
  const paramsV = getGenericParamsSlot(generic);
  if (!paramsV) return 0;
  const paramsCtx = dataOf(paramsV);
  if (paramsCtx.kind !== ValueKind.Context) return 0;
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
  const ctorV = getGenericConstructor(generic);
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
  if (paramTypesCtx.kind !== ValueKind.Context) return null;
  return arrayElements(paramTypesCtx as ContextValue);
}

/** Extract return type from a concrete FunctionType. Returns null if not a FunctionType. */
export function getFunctionReturnType(fnType: ContextValue): Value | null {
  const args = getTypeArgs(fnType);
  if (!args || args.length < 2) return null;
  return args[1];
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
  if (expectedType.kind === ValueKind.Context) {
    const expectedName = bitsToString(
      (getName(expectedType as ContextValue) as BitsValue) ?? stringToBits(""),
    );
    if (expectedName === "Any") return bindings;
  }

  // If expected is a concrete type
  if (expectedType.kind === ValueKind.Context && actualType) {
    const expectedCtx = expectedType as ContextValue;
    // Legacy-exact (C4.3b): only an MV-wrapped actual participates in name
    // unification here — a bare type Context skips (getType on it would now
    // report its META-type, which is not what this comparison wants; the
    // call-site checkArgType does the real concrete-type check).
    const actualCtx = actualType.kind === ValueKind.MultiValue ? getType(actualType) : null;
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

  if (typeExpr.kind === ValueKind.Context) {
    const ctx = typeExpr as ContextValue;
    const argsV2 = getGenericArgs(ctx);
    if (argsV2) {
      const argsCtx = dataOf(argsV2);
      if (argsCtx.kind === ValueKind.Context) {
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
// Effect meta-type (Phase D1 sub-chunk 1.1 substrate)
//
// Effect is a type whose subtypes represent categories of side effects. Specific
// effects (`pure`, `opaque`, `io`, `time`, ...) are types that extend Effect and
// participate in the lattice via the `subset_of` / `implies` / `intersect` /
// `union` operations. Subtype relationships (`pure subtypeof Effect == true`)
// fall out of the standard `__refines` machinery — Effect is a regular named
// type for the purposes of nominal subtype checks.
//
// Lattice:
//   `pure` (bottom)  ⊆  any specific effect  ⊆  `opaque` (top)
//
// Anonymous conjunction creation (`io & time`) is deferred to Slice 2; for now,
// `union` of two non-equal non-trivial effects falls back to `opaque` as a
// sound over-approximation. `intersect` similarly returns `pure` when there's
// no detectable overlap.
//
// Marker bindings:
//   `__effect_kind` — "pure" or "opaque" on the two core absolutes; absent on
//                     ordinary named effects. Used for fast-path dispatch in
//                     the lattice ops without depending on identity comparison
//                     to module-local Contexts.
// =============================================================================

function isPureEffect(e: ContextValue): boolean {
  const m = getEffectKind(e);
  return m?.kind === ValueKind.Bits && bitsToString(m as BitsValue) === "pure";
}

function isOpaqueEffect(e: ContextValue): boolean {
  const m = getEffectKind(e);
  return m?.kind === ValueKind.Bits && bitsToString(m as BitsValue) === "opaque";
}

/** e1 ⊆ e2 in the effect lattice. */
export function effectSubsetOf(e1: ContextValue, e2: ContextValue): boolean {
  if (isOpaqueEffect(e2)) return true;       // anything ⊆ top
  if (isPureEffect(e1)) return true;         // bottom ⊆ anything
  if (isOpaqueEffect(e1)) return false;
  if (isPureEffect(e2)) return false;
  if (e1 === e2) return true;
  // Walk e1's __refines chain looking for e2 by identity.
  let current: ContextValue | null = e1;
  while (current) {
    const ext = getRefines(current);
    if (ext?.kind === ValueKind.Context) {
      if (ext === e2) return true;
      current = ext as ContextValue;
    } else {
      current = null;
    }
  }
  return false;
}

/** e1 implies e2: knowing e1's effects discharges a check for e2. Equivalent
 *  to `e2 ⊆ e1` — having the wider bound implies you have the narrower. */
export function effectImplies(e1: ContextValue, e2: ContextValue): boolean {
  return effectSubsetOf(e2, e1);
}

/** Lattice meet (greatest lower bound). */
export function effectIntersect(e1: ContextValue, e2: ContextValue): ContextValue {
  if (isPureEffect(e1) || isPureEffect(e2)) return pureEffect;
  if (isOpaqueEffect(e1)) return e2;
  if (isOpaqueEffect(e2)) return e1;
  if (e1 === e2) return e1;
  // Conservative: no statically detectable overlap → bottom. Slice 2 will
  // handle conjunctions and refined overlap detection.
  return pureEffect;
}

/** Lattice join (least upper bound). */
export function effectUnion(e1: ContextValue, e2: ContextValue): ContextValue {
  if (isOpaqueEffect(e1) || isOpaqueEffect(e2)) return opaqueEffect;
  if (isPureEffect(e1)) return e2;
  if (isPureEffect(e2)) return e1;
  if (e1 === e2) return e1;
  // Sound over-approximation pending Slice 2's anonymous conjunctions.
  return opaqueEffect;
}

// --- Effect meta-type Context ---

export const Effect: ContextValue = makeContext();
setName(Effect, stringToBits("Effect"));
writeShape(Effect, Type);

const EFFECT_MEMBER_SCOPE = typeMemberScopeFqn("Effect");
const effectMembers = makeContext();
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

/**
 * Build an effect type that extends Effect. Used for `pure` and `opaque` here;
 * extension libraries will use the same builder for their own effects (`io`,
 * `time`, ...) once the public surface lands in Slice 2.
 *
 * The lattice methods are copied into the new type's `__members` so that
 * eventual dot-dispatch (`pure.subset_of(opaque)`) can find them on the value
 * side. Today's dispatch flow finds them via `__type` (Type), which doesn't
 * carry effect methods — so the copy is the bridge until Slice 2 either walks
 * `__refines` for member lookup or formalises Effect-as-meta-type.
 */
export function buildEffect(name: string, kind?: "pure" | "opaque"): ContextValue {
  const eff = makeContext();
  setName(eff, stringToBits(name));
  writeShape(eff, Type);
  setRefines(eff, Effect);
  if (kind) setEffectKind(eff, stringToBits(kind));
  const members = makeContext();
  for (const [key, binding] of effectMembers.bindings) {
    if (binding.value) addBinding(members, key, binding.value);
  }
  setMembers(eff, members);
  // Attach an effect bound — the value-side check this type imposes when it
  // appears as a parameter annotation (`f: pure`). The bound is the set of
  // effect labels callers may legally produce; the discharge runs through
  // `impliesDomain` on the predicate-set machinery, identical path to numeric
  // refinements. `opaque` carries no bound — universal, anything passes.
  if (kind === "pure") {
    setEffectBound(eff, { kind: "effects", labels: new Set<string>() });
  } else if (kind === "opaque") {
    // No bound — universal. type_check skips the effect discharge entirely.
  } else {
    // Named effects (io, time, …): bound is the singleton {name}. Extension
    // libraries will pass `kind` undefined when they call `buildEffect("io")`.
    setEffectBound(eff, { kind: "effects", labels: new Set<string>([name]) });
  }
  return eff;
}

export const pureEffect: ContextValue = buildEffect("pure", "pure");
export const opaqueEffect: ContextValue = buildEffect("opaque", "opaque");

// =============================================================================
// Proof meta-type (Phase F1 substrate)
// =============================================================================
//
// A Proof is a Value that witnesses a proposition. Phase F1's only proof
// constructor is `proof_by_eval` (discharge by partial evaluation): if the
// proposition folds to `true`, the witness is valid. Later chunks add
// refinement-domain proofs (F2) and proof combinators (F3).
//
// Internally a proof is a Context with `__type = Proof`, a `__proposition`
// binding holding a source-rendered string of what was proved, and a
// `__discharged` flag. Failed proofs are Error-typed values carrying the
// counterexample (reusing Phase E Stage 6 machinery) — `checkProofs` in
// `src/proofs.ts` surfaces them as error-severity notifications.

export const Proof: ContextValue = makeContext();
setName(Proof, stringToBits("Proof"));
writeShape(Proof, Type);
setMembers(Proof, makeContext());

/** Construct a discharged proof witness for a proposition. `proposition`
 *  is the source-rendered text of what was proved (for display / export). */
export function makeProof(proposition: string): Value {
  const p = makeContext();
  setProposition(p, stringToBits(proposition));
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
  const components = fn.kind === ValueKind.MultiValue
    ? cloneComponents(fn)
    : new Map<string, Value>();
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
      Object: wrapType(ObjectType) as any,
      Function: wrapType(FunctionType) as any,
      UntypedFunction: wrapType(UntypedFunctionType) as any,
      // Meta-types — the kind tower (C6.1b, D45)
      Type: wrapType(Type) as any,
      NominalType: wrapType(NominalType) as any,
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
      // Literal bindings (parsed as identifiers, resolved here)
      true: withType(makeInt(1), BoolType) as any,
      false: withType(makeInt(0), BoolType) as any,
      none: noneSingleton as any,
    },
  };
}
