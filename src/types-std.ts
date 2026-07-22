// =============================================================================
// Allegro Standard — Core Type Definitions
// Defines Int and String types as Context values with method bindings.
// Types are attached to values as MultiValue "type" components.
// =============================================================================

import {
  Value, ValueKind, BitsValue, ContextValue, MultiValueType, PrimitiveFnImpl, PrimitiveFunctionValue,
  ComposedFunctionValue,
  makeInt, makeFloat, bitsToFloat, makeBits, makePrimitive, makeExpr, makeContext, makeMultiValue,
  makeComposedFn, makeParam,
  stringToBits, bitsToString, AllegroError,
  Extension,
} from "./types.js";
import { domainFromPredicate, PredicateSet, withPredicates as rfWithPredicates, Predicate, occurrenceBoundOf, withOccurrenceBound, clearOccurrenceBound } from "./refinements.js";
import {
  getName, getMembers, getParent, getConstruct, getInterfaceMarker, getPredicate,
  getGenericArgs, getGenericParamsSlot, getGenericBackLink, getGenericConstructor,
  getSlotCount, getAbstractDomain, getEffectKind, getEffectBound, getVariants, isGenericTypeSlot,
  setName, setMembers, setParent, setConstruct, setFallbackMember, markInterface,
  setWraps, setVariants, setPredicate, setGenericParams, setGenericArgs,
  setGenericBackLink, markGeneric, setGenericConstructor, setProposition,
  setEffectKind, setEffectBound, setSlotCount, setAbstractDomain,
  writeShape, removeName, removeParent, removeShapeSlot, kernelChannelWriter, assertNotIntegrityKey,
  removeConstruct, channelReadRaw, cloneComponents, SLOT_KEYS, isMetaSlotKey, dataOf, typeShape,
} from "./slots.js";


// --- Constants ---

/** Meta-method names that should NOT be inherited by child types during extend/interface */
const META_METHOD_NAMES = new Set([
  "instanceof", "subtypeof", "extend", "where", "distinct",
  "constructor", "interface", "preserveOps", "mixin", "invariant",
]);

// --- Helpers ---

/** Get the type component from a value (if it's a MultiValue with "type") */
export function getType(v: Value): ContextValue | null {
  if (v.kind === ValueKind.MultiValue) {
    const t = channelReadRaw(v, "type");
    if (t && t.kind === ValueKind.Context) return t;
  }
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
  const components = v.kind === ValueKind.MultiValue
    ? cloneComponents(v)
    : new Map<string, Value>();
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
  if (v.kind !== ValueKind.MultiValue) return v;
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
  const components = v.kind === ValueKind.MultiValue
    ? cloneComponents(v)
    : new Map<string, Value>();
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
  // First: check __members for a Method descriptor
  const membersV = getMembers(type);
  if (membersV?.kind === ValueKind.Context) {
    const members = membersV as ContextValue;
    const memberBinding = members.bindings.get(name);
    if (memberBinding?.value?.kind === ValueKind.Context) {
      const desc = memberBinding.value as ContextValue;
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

// =============================================================================
// Meta-type: Type
//
// All type values have __type = Type. Comparison methods (instanceof / subtypeof)
// are SHAPE-AWARE: when both operands have a __name, the comparison is nominal
// (by name + __extends chain); when either operand has no __name, it's structural
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
 *   - Both operand types named → nominal (by name + __extends chain)
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
  if (isInterfaceType(typeB)) {
    return structuralSubtypeof(typeA, typeB);
  }
  const nameB = getTypeNameFromCtx(typeB);
  if (nameB === null) {
    return structuralSubtypeof(typeA, typeB);
  }
  const nameA = getTypeNameFromCtx(typeA);
  if (nameA === null) {
    return structuralSubtypeof(typeA, typeB);
  }
  return nominalSubtypeof(typeA, typeB, nameB);
}

function isInterfaceType(t: ContextValue): boolean {
  const m = getInterfaceMarker(t);
  return m?.kind === ValueKind.Bits && (m as BitsValue).data !== 0n;
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
    for (const [key] of bMembers.bindings) {
      if (!aMembers || !aMembers.bindings.has(key)) return false;
    }
    return true;
  }

  // No __members on expected type — trivially satisfied
  return true;
}

/**
 * Nominal subtypeof: typeA is the same as typeB by name (and type args), or
 * typeA's __extends chain reaches a type with that name. Caller has already
 * confirmed both types carry a __name.
 */
function nominalSubtypeof(typeA: ContextValue, typeB: ContextValue, nameB: string): boolean {
  let current: ContextValue | null = typeA;
  while (current) {
    const nameA = getTypeNameFromCtx(current);
    if (nameA === nameB) {
      return typeArgsMatch(current, typeB);
    }
    const parentV = getParent(current);
    if (parentV?.kind === ValueKind.Context) {
      current = parentV as ContextValue;
    } else {
      current = null;
    }
  }
  return false;
}

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
 * the name is exactly the `~T` semantics. All other bindings (__extends,
 * __members, __construct, __predicate, __invariantsList, ...) are preserved,
 * so `~Int` still constructs Int values, has Int's methods, etc.; only its
 * type comparisons go structural.
 */
export function structuralWrap(type: ContextValue): ContextValue {
  const wrapper = makeContext();
  for (const [key, binding] of type.bindings) {
    if (key === SLOT_KEYS.name) continue; // erase name → anonymous → structural
    wrapper.bindings.set(key, { ...binding });
    wrapper.bindingList.push({ ...binding });
  }
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
setParent(MethodType, MemberType);

/** Field descriptor — a member representing instance data */
export const FieldType: ContextValue = makeContext();
setName(FieldType, stringToBits("Field"));
writeShape(FieldType, Type);
setParent(FieldType, MemberType);

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

/** Look up the full member descriptor from a type's __members */
export function typeMemberDescriptor(type: ContextValue, name: string): ContextValue | null {
  const membersV = getMembers(type);
  if (!membersV || membersV.kind !== ValueKind.Context) return null;
  const members = membersV as ContextValue;
  const memberBinding = members.bindings.get(name);
  if (!memberBinding?.value || memberBinding.value.kind !== ValueKind.Context) return null;
  return memberBinding.value as ContextValue;
}

// =============================================================================
// Fluent Type API: extend, where, distinct, constructor
// =============================================================================

/**
 * Build a record type from a parent type and field specification.
 * Auto-generates __construct (positional args), __getMember (field access), toString.
 */
function buildRecordType(
  parentType: ContextValue,
  fieldSpecObj: Value,
  metaType: ContextValue,
): ContextValue {
  // Extract field specs from the Object's Context
  const fieldCtx = dataOf(fieldSpecObj);
  if (fieldCtx.kind !== ValueKind.Context) {
    throw new AllegroError("extend: argument must be an object literal {field: Type, ...}");
  }
  const fields: { name: string; type: Value }[] = [];
  for (const [key, binding] of (fieldCtx as ContextValue).bindings) {
    if (isMetaSlotKey(key)) continue;
    if (binding.value) {
      fields.push({ name: key, type: binding.value });
    }
  }

  // Build the new type Context
  const newType = makeContext();
  setName(newType, stringToBits("<anonymous>"));
  writeShape(newType, metaType);
  setParent(newType, parentType);

  // Build __members: Field descriptors for declared fields + Method descriptors for methods
  const members = makeContext();

  // Add Field descriptors for each declared field
  for (const f of fields) {
    addBinding(members, f.name, makeFieldDescriptor(f.name, f.type));
  }

  // Copy non-meta Method descriptors from parent's __members
  const metaMethodNames = META_METHOD_NAMES;
  const parentMembers = getMembers(parentType);
  if (parentMembers?.kind === ValueKind.Context) {
    for (const [key, binding] of (parentMembers as ContextValue).bindings) {
      if (metaMethodNames.has(key)) continue;
      if (!members.bindings.has(key) && binding.value) {
        addBinding(members, key, binding.value);
      }
    }
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
  addBinding(members, "toString", makeMethodDescriptor("toString", toStringImpl));

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
  parentType: ContextValue,
  memberSpecObj: Value,
): ContextValue {
  const specCtx = dataOf(memberSpecObj);
  if (specCtx.kind !== ValueKind.Context) {
    throw new AllegroError("interface: argument must be an object literal {member: Type, ...}");
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
  writeShape(ifaceType, Type); // structural — no ~ needed
  setParent(ifaceType, parentType);
  markInterface(ifaceType, makeInt(1)); // marker

  // Build __members: declared members as Field descriptors
  const members = makeContext();

  // Copy non-meta Method descriptors from parent's __members
  const metaMethodNames = META_METHOD_NAMES;
  const parentMembers = getMembers(parentType);
  if (parentMembers?.kind === ValueKind.Context) {
    for (const [key, binding] of (parentMembers as ContextValue).bindings) {
      if (metaMethodNames.has(key)) continue;
      if (binding.value) {
        addBinding(members, key, binding.value);
      }
    }
  }

  // Add Field descriptors for each declared member
  for (const m of declaredMembers) {
    addBinding(members, m.name, makeFieldDescriptor(m.name, m.type));
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
  // Set __extends to parent
  removeParent(refinedType);
  setParent(refinedType, parentType);
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
      if (value.kind === ValueKind.MultiValue) {
        if (channelReadRaw(value, "error") !== undefined) return value;
      }

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
      const typed = withType(dataOf(value), refinedType);
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

/**
 * Build an invarianted type (Phase C Chunk 4): a type that carries one or
 * more lifecycle invariants — predicates that must hold for every instance
 * throughout its lifetime. Multiple invariants chain via repeated
 * `.invariant()` calls; each is stored separately so introspection and
 * proof-search can address them by source.
 *
 * `invariant` is the multi-predicate, multi-field counterpart to `where`:
 *   - `where` is for value-level refinement on a primitive type
 *     (`Int && _ > 0`).
 *   - `invariant` is for record/struct types where the predicate references
 *     fields (`self.balance >= 0`) and where readability benefits from
 *     each rule being a separate clause.
 *
 * Mechanically the runtime story is the same as a refinement: the
 * constructor runs the predicate; failure produces a counterexample-bearing
 * error; success re-tags the value with the invarianted type and attaches
 * the predicate's recognised abstract domain to the value's predicate set.
 *
 * Inheritance: a derived type via `.extend` automatically inherits the
 * parent's invariants because the hidden `__invariantsList` field is
 * carried forward in the standard binding-copy loop. (Parent's invariants
 * stay separate from the child's via list concatenation.)
 */
export function buildInvariantedType(parentType: ContextValue, predicate: Value): ContextValue {
  const newType = makeContext();

  // Copy parent's bindings (everything except __construct, which we wrap
  // below; everything else inherited).
  for (const [key, binding] of parentType.bindings) {
    if (key === SLOT_KEYS.construct) continue;
    if (binding.value) addBinding(newType, key, binding.value);
  }

  // Inherit any existing invariants list from the parent and append the new
  // predicate. Stored as a hidden JS array so the constructor wrapper can
  // iterate without going through the bindings table.
  const parentInvariants = (parentType as any).__invariantsList ?? [];
  const newInvariants: Value[] = [...parentInvariants, predicate];
  (newType as any).__invariantsList = newInvariants;

  // Wrap parent's constructor so each invariant is checked after parent
  // construction.
  const parentConstruct = getConstruct(parentType);
  if (parentConstruct?.kind === ValueKind.PrimitiveFunction) {
    setConstruct(newType, makePrimitive("invariant.__construct", (args, ctx, evalFn) => {
      // Call parent constructor first.
      const value = (parentConstruct as PrimitiveFunctionValue).fn(args, ctx, evalFn);

      // Error propagation: parent's own invariant / refinement check might
      // have failed already; pass the error through unchanged rather than
      // re-tagging with this layer.
      if (value.kind === ValueKind.MultiValue) {
        if (channelReadRaw(value, "error") !== undefined) return value;
      }

      // Apply each invariant in declaration order. First failure → error.
      for (let i = 0; i < newInvariants.length; i++) {
        const inv = newInvariants[i];
        const checkResult = evalFn!(makeExpr(inv, [value]), ctx!);
        const checkP = dataOf(checkResult);
        if (checkP.kind === ValueKind.Bits && (checkP as BitsValue).data === 0n) {
          // Build a counterexample-style error message. For invariants on
          // record types, render the field name(s) the predicate touched if
          // we can recognise them; otherwise just say "invariant N failed."
          const idx = i;
          const msg = `invariant ${idx + 1} failed`;
          const components = new Map<string, Value>();
          components.set("error", withType(stringToBits(msg), StringType));
          components.set("type", ErrorType);
          return makeMultiValue(makeInt(0), components);
        }
      }

      // Re-tag with the invarianted type. Also attach the recognised
      // abstract domain (if any) of each invariant to the value's
      // predicate set — same machinery as buildRefinedType so consumers
      // see the inferred refinement on the result.
      const typed = withType(dataOf(value), newType);
      try {
        const preds: Predicate[] = [];
        for (const inv of newInvariants) {
          const dom = domainFromPredicate(inv);
          if (dom.kind !== "opaque") {
            preds.push({ shape: dom, source: "type-invariant" });
          }
        }
        if (preds.length > 0) {
          return rfWithPredicates(typed, new PredicateSet(preds));
        }
      } catch {
        /* fall through if the helper isn't available */
      }
      return typed;
    }, true));
  }

  return newType;
}

/**
 * Build a distinct type: copies parent, breaks subtypeof chain.
 */
function buildDistinctType(parentType: ContextValue): ContextValue {
  const distinctType = makeContext();
  // Copy all bindings except __extends and __members (handled separately)
  for (const [key, binding] of parentType.bindings) {
    if (key === SLOT_KEYS.extends) continue;
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
      return withType(dataOf(value), distinctType);
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
  const parentType = getParent(refinedType) as ContextValue;
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
      return withType(dataOf(value), newType);
    }, true));
  }

  // Clone __members and add lifted operator descriptors
  const parentMembers = getMembers(refinedType);
  const newMembers = makeContext();
  if (parentMembers?.kind === ValueKind.Context) {
    for (const [key, binding] of (parentMembers as ContextValue).bindings) {
      if (binding.value) addBinding(newMembers, key, binding.value);
    }
  }

  const newConstruct = getConstruct(newType) as PrimitiveFunctionValue | undefined;

  for (const opName of ops) {
    const parentDesc = parentMembers?.kind === ValueKind.Context
      ? (parentMembers as ContextValue).bindings.get(opName)?.value
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

    addBinding(newMembers, opName, makeMethodDescriptor(opName, liftedOp));
  }

  setMembers(newType, newMembers);
  return newType;
}

/**
 * Add mixin methods to a type. Takes a method spec object (key → function)
 * and returns a new type with the methods added to __members as Method descriptors.
 * Errors on name conflict (method already exists in __members).
 */
function buildMixinType(baseType: ContextValue, specObj: Value): ContextValue {
  const specCtx = dataOf(specObj);
  if (specCtx.kind !== ValueKind.Context) {
    throw new AllegroError("mixin: argument must be an object literal {method: fn, ...}");
  }

  // Extract method specs
  const methods: { name: string; impl: Value }[] = [];
  for (const [key, binding] of (specCtx as ContextValue).bindings) {
    if (isMetaSlotKey(key)) continue;
    if (binding.value) {
      methods.push({ name: key, impl: binding.value });
    }
  }

  // Build new type (clone baseType except __members and __construct)
  const newType = makeContext();
  for (const [key, binding] of baseType.bindings) {
    if (key === SLOT_KEYS.members || key === SLOT_KEYS.construct) continue;
    if (binding.value) addBinding(newType, key, binding.value);
  }

  // Clone __members and add mixin methods
  const parentMembers = getMembers(baseType);
  const newMembers = makeContext();
  if (parentMembers?.kind === ValueKind.Context) {
    for (const [key, binding] of (parentMembers as ContextValue).bindings) {
      if (binding.value) addBinding(newMembers, key, binding.value);
    }
  }

  for (const m of methods) {
    // Check for conflict
    if (newMembers.bindings.has(m.name)) {
      throw new AllegroError(`mixin: method '${m.name}' conflicts with existing member`);
    }
    // Wrap ComposedFunctions in a PrimitiveFn that the descriptor expects,
    // or use PrimitiveFunctions directly
    const impl = dataOf(m.impl);
    if (impl.kind === ValueKind.PrimitiveFunction) {
      addBinding(newMembers, m.name, makeMethodDescriptor(m.name, impl as PrimitiveFunctionValue));
    } else if (impl.kind === ValueKind.ComposedFunction) {
      // Store the ComposedFunction directly — type_dispatch handles it
      const desc = makeContext();
      writeShape(desc, MethodType);
      addBinding(desc, "name", stringToBits(m.name));
      addBinding(desc, "value", impl);
      addBinding(newMembers, m.name, desc);
    } else {
      throw new AllegroError(`mixin: '${m.name}' must be a function`);
    }
  }

  setMembers(newType, newMembers);

  // Rebuild __construct: delegate to parentConstruct (which already chains all
  // predicate checks through nested refinements), then retag with newType. This
  // handles arbitrary refinement depth naturally — a previous implementation
  // tried to skip one level and re-apply the immediate predicate, which was
  // correct for a single level but fragile if the shape ever changed. If the
  // parent's construct produces an error MultiValue (refinement failure), we
  // propagate it without retagging.
  const parentConstruct = getConstruct(baseType);
  if (parentConstruct?.kind === ValueKind.PrimitiveFunction) {
    setConstruct(newType, makePrimitive("mixin.__construct", (args, ctx, evalFn) => {
      const value = (parentConstruct as PrimitiveFunctionValue).fn(args, ctx, evalFn);
      if (value.kind === ValueKind.MultiValue) {
        if (channelReadRaw(value, "error") !== undefined) return value;
      }
      return withType(dataOf(value), newType);
    }, true));
  }

  return newType;
}

// --- Build __members for Type ---
// Single block — instanceof/subtypeof are shape-aware (nominal when both
// operands are named, structural otherwise).

const typeMembers = makeContext();
addBinding(typeMembers, "instanceof", makeMethodDescriptor("instanceof",
  makePrimitive("Type.instanceof", (args) => {
    const type = args[0] as ContextValue;
    const value = args[1];
    return withType(makeInt(shapeAwareInstanceof(value, type) ? 1 : 0), BoolType);
  })
));
addBinding(typeMembers, "subtypeof", makeMethodDescriptor("subtypeof",
  makePrimitive("Type.subtypeof", (args) => {
    const typeA = args[0] as ContextValue;
    const typeB = args[1] as ContextValue;
    return withType(makeInt(shapeAwareSubtypeof(typeA, typeB) ? 1 : 0), BoolType);
  })
));
addBinding(typeMembers, "extend", makeMethodDescriptor("extend",
  makePrimitive("Type.extend", (args, _ctx, _evalFn) => {
    return wrapType(buildRecordType(args[0] as ContextValue, args[1], Type));
  })
));
addBinding(typeMembers, "where", makeMethodDescriptor("where",
  makePrimitive("Type.where", (args) => {
    return wrapType(buildRefinedType(args[0] as ContextValue, args[1]));
  })
));
addBinding(typeMembers, "invariant", makeMethodDescriptor("invariant",
  makePrimitive("Type.invariant", (args) => {
    return wrapType(buildInvariantedType(args[0] as ContextValue, args[1]));
  })
));
addBinding(typeMembers, "distinct", makeMethodDescriptor("distinct",
  makePrimitive("Type.distinct", (args) => {
    return wrapType(buildDistinctType(args[0] as ContextValue));
  })
));
addBinding(typeMembers, "constructor", makeMethodDescriptor("constructor",
  makePrimitive("Type.constructor", (args) => {
    const type = args[0] as ContextValue;
    const fn = args[1];
    removeConstruct(type);
    setConstruct(type, makePrimitive("custom.__construct", (ctorArgs, ctorCtx, ctorEvalFn) => {
      const result = ctorEvalFn!(makeExpr(fn, ctorArgs), ctorCtx!);
      return withType(dataOf(result), type);
    }, true));
    return wrapType(type);
  })
));
addBinding(typeMembers, "interface", makeMethodDescriptor("interface",
  makePrimitive("Type.interface", (args) => {
    return wrapType(buildInterfaceType(args[0] as ContextValue, args[1]));
  })
));
addBinding(typeMembers, "preserveOps", makeMethodDescriptor("preserveOps",
  makePrimitive("Type.preserveOps", (args) => {
    const type = args[0] as ContextValue;
    const opNames: string[] = [];
    for (let i = 1; i < args.length; i++) {
      const p = dataOf(args[i]);
      if (p.kind === ValueKind.Bits) {
        opNames.push(bitsToString(p as BitsValue));
      }
    }
    return wrapType(buildPreserveOps(type, opNames));
  })
));
addBinding(typeMembers, "mixin", makeMethodDescriptor("mixin",
  makePrimitive("Type.mixin", (args) => {
    return wrapType(buildMixinType(args[0] as ContextValue, args[1]));
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
 *   - extends: parent type
 *   - methodEffects: per-method effect label list. Used to tag stdlib HOFs
 *     (`Array.map`, etc.) as `opaque` so callers' inferred effect sets reflect
 *     "may do anything the callback does" until Slice 2's effect polymorphism
 *     gives them precise types.
 */
function buildType(
  name: string,
  methods: Record<string, PrimitiveFnImpl>,
  options?: { extends?: ContextValue; methodEffects?: Record<string, string[]> },
): ContextValue {
  const ctx = makeContext();
  setName(ctx, stringToBits(name));
  writeShape(ctx, Type);
  if (options?.extends) {
    setParent(ctx, options.extends);
  }
  // Build __members with Method descriptors
  const members = makeContext();
  for (const [key, fn] of Object.entries(methods)) {
    const fxLabels = options?.methodEffects?.[key];
    const prim = makePrimitive(`${name}.${key}`, fn, false, fxLabels);
    const isGetter = getterNames.has(key);
    addBinding(members, key, makeMethodDescriptor(key, prim, isGetter));
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
function makeRawArrayCtx(elements: Value[]): ContextValue {
  const ctx = makeContext();
  for (let i = 0; i < elements.length; i++) {
    const key = String(i);
    ctx.bindings.set(key, { key, value: elements[i] });
    ctx.bindingList.push({ key, value: elements[i] });
  }
  setSlotCount(ctx, makeInt(elements.length));
  return ctx;
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
  const lenV = getSlotCount(ctx);
  if (!lenV) return [];
  const len = Number((lenV as BitsValue).data);
  const result: Value[] = [];
  for (let i = 0; i < len; i++) {
    const b = ctx.bindings.get(String(i));
    if (b?.value) result.push(b.value);
  }
  return result;
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
  const b = ctx.bindings.get(String(idx));
  if (!b?.value) throw new AllegroError(`Array index ${idx} out of bounds`);
  return b.value;
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
    const b = ctx.bindings.get(String(idx));
    if (!b?.value) throw new AllegroError(`Array.get: index ${idx} out of bounds`);
    return b.value;
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
          const eb = ctx.bindings.get(String(i));
          if (eb?.value) elems.push(cacheKeyOne(eb.value, i));
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
    const actualCtx = getType(actualType);
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
// fall out of the standard `__extends` machinery — Effect is a regular named
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
  // Walk e1's __extends chain looking for e2 by identity.
  let current: ContextValue | null = e1;
  while (current) {
    const ext = getParent(current);
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

const effectMembers = makeContext();
addBinding(effectMembers, "subset_of", makeMethodDescriptor("subset_of",
  makePrimitive("Effect.subset_of", (args) => {
    const e1 = dataOf(args[0]) as ContextValue;
    const e2 = dataOf(args[1]) as ContextValue;
    return withType(makeInt(effectSubsetOf(e1, e2) ? 1 : 0), BoolType);
  })
));
addBinding(effectMembers, "implies", makeMethodDescriptor("implies",
  makePrimitive("Effect.implies", (args) => {
    const e1 = dataOf(args[0]) as ContextValue;
    const e2 = dataOf(args[1]) as ContextValue;
    return withType(makeInt(effectImplies(e1, e2) ? 1 : 0), BoolType);
  })
));
addBinding(effectMembers, "intersect", makeMethodDescriptor("intersect",
  makePrimitive("Effect.intersect", (args) => {
    const e1 = dataOf(args[0]) as ContextValue;
    const e2 = dataOf(args[1]) as ContextValue;
    return wrapType(effectIntersect(e1, e2));
  })
));
addBinding(effectMembers, "union", makeMethodDescriptor("union",
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
 * `__extends` for member lookup or formalises Effect-as-meta-type.
 */
export function buildEffect(name: string, kind?: "pure" | "opaque"): ContextValue {
  const eff = makeContext();
  setName(eff, stringToBits(name));
  writeShape(eff, Type);
  setParent(eff, Effect);
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
/** Wrap a type Context as a typed MultiValue using its __type as meta-type */
export function wrapType(type: ContextValue): Value {
  const metaType = channelReadRaw(type, "shape") as ContextValue | undefined;
  if (metaType) return withType(type, metaType);
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
      // Meta-types
      Type: wrapType(Type) as any,
      NominalType: wrapType(NominalType) as any,
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
