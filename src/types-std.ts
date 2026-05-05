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
  primaryOf, stringToBits, bitsToString, AllegroError,
  Extension,
} from "./types.js";
import { domainFromPredicate, PredicateSet, withPredicates as rfWithPredicates, Predicate } from "./refinements.js";

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
    const t = v.components.get("type");
    if (t && t.kind === ValueKind.Context) return t;
  }
  return null;
}

/** Get the type name from a value's type component */
export function getTypeName(v: Value): string | null {
  const t = getType(v);
  if (!t) return null;
  const nameBinding = t.bindings.get("__name");
  if (!nameBinding?.value || nameBinding.value.kind !== ValueKind.Bits) return null;
  return bitsToString(nameBinding.value);
}

/** Wrap a raw value with a type component */
export function withType(v: Value, type: ContextValue): Value {
  const primary = primaryOf(v);
  const components = v.kind === ValueKind.MultiValue
    ? new Map(v.components)
    : new Map<string, Value>();
  components.set("type", type);
  return makeMultiValue(primary, components);
}

/** Get the __name from a type Context directly (not from a typed value) */
export function typeContextName(v: Value): string | null {
  const ctx = v.kind === ValueKind.Context ? v : (v.kind === ValueKind.MultiValue ? primaryOf(v) : null);
  if (!ctx || ctx.kind !== ValueKind.Context) return null;
  const nb = (ctx as ContextValue).bindings.get("__name");
  if (nb?.value?.kind === ValueKind.Bits) return bitsToString(nb.value);
  return null;
}

/** Look up a method implementation on a type Context via __members.
 *  Returns the PrimitiveFunctionValue (or other callable) for Method descriptors,
 *  or the raw value for direct bindings (backward compat during transition). */
export function typeMethod(type: ContextValue, name: string): Value | null {
  // First: check __members for a Method descriptor
  const membersBinding = type.bindings.get("__members");
  if (membersBinding?.value?.kind === ValueKind.Context) {
    const members = membersBinding.value as ContextValue;
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
function addBinding(ctx: ContextValue, key: string, value: Value): void {
  ctx.bindings.set(key, { key, value, isUse: false });
  ctx.bindingList.push({ key, value, isUse: false });
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
  const m = t.bindings.get("__interface");
  return m?.value?.kind === ValueKind.Bits && (m.value as BitsValue).data !== 0n;
}

/**
 * Structural subtypeof: typeA has every member typeB declares.
 * Compares __members collections by name.
 */
function structuralSubtypeof(typeA: ContextValue, typeB: ContextValue): boolean {
  const aMembersVal = typeA.bindings.get("__members")?.value;
  const bMembersVal = typeB.bindings.get("__members")?.value;

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
    const extendsBinding = current.bindings.get("__extends");
    if (extendsBinding?.value?.kind === ValueKind.Context) {
      current = extendsBinding.value as ContextValue;
    } else {
      current = null;
    }
  }
  return false;
}

/** Check that type arguments match (if the expected type has them) */
function typeArgsMatch(actual: ContextValue, expected: ContextValue): boolean {
  const expectedArgsB = expected.bindings.get("__args");
  if (!expectedArgsB?.value || expectedArgsB.value.kind !== ValueKind.Context) return true; // no args to check
  const actualArgsB = actual.bindings.get("__args");
  if (!actualArgsB?.value || actualArgsB.value.kind !== ValueKind.Context) return true; // actual has no args — accept (bare generic)

  const expectedArgsCtx = expectedArgsB.value as ContextValue;
  const actualArgsCtx = actualArgsB.value as ContextValue;
  const expElems = arrayElements(expectedArgsCtx);
  const actElems = arrayElements(actualArgsCtx);

  if (expElems.length !== actElems.length) return false;

  for (let i = 0; i < expElems.length; i++) {
    const expArg = primaryOf(expElems[i]);
    const actArg = primaryOf(actElems[i]);
    if (expArg.kind !== ValueKind.Context || actArg.kind !== ValueKind.Context) continue;
    const expName = getTypeNameFromCtx(expArg as ContextValue);
    const actName = getTypeNameFromCtx(actArg as ContextValue);
    if (expName && actName && expName !== "Any" && expName !== actName) return false;
  }
  return true;
}

/** Get __name from a type Context */
function getTypeNameFromCtx(type: ContextValue): string | null {
  const nb = type.bindings.get("__name");
  if (nb?.value?.kind === ValueKind.Bits) return bitsToString(nb.value);
  return null;
}

// --- Build Type (the single meta-type) ---

export const Type: ContextValue = makeContext();
addBinding(Type, "__name", stringToBits("Type"));
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
    if (key === "__name") continue; // erase name → anonymous → structural
    wrapper.bindings.set(key, { ...binding });
    wrapper.bindingList.push({ ...binding });
  }
  addBinding(wrapper, "__wraps", type);
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
  addBinding(union, "__name", stringToBits(
    alternatives.map(a => {
      const n = a.bindings.get("__name")?.value;
      return n && n.kind === ValueKind.Bits ? bitsToString(n) : "?";
    }).join(" | ")
  ));
  // Store alternatives as an array-like Context
  for (let i = 0; i < alternatives.length; i++) {
    addBinding(union, String(i), alternatives[i]);
  }
  addBinding(union, "__length", makeInt(alternatives.length));
  addBinding(union, "__union", makeInt(1)); // marker

  // instanceof: value matches if it matches ANY alternative
  addBinding(union, "instanceof", makePrimitive("UnionType.instanceof", (args) => {
    const value = args[0];
    const valueType = getType(value);
    if (!valueType) return makeInt(0);
    const valueName = getTypeName(value);
    for (let i = 0; i < alternatives.length; i++) {
      const alt = alternatives[i];
      const altName = alt.bindings.get("__name")?.value;
      const altNameStr = altName && altName.kind === ValueKind.Bits ? bitsToString(altName) : null;
      if (altNameStr && altNameStr === valueName) return makeInt(1);
      // Also check via the alternative's meta-type instanceof
      const altMetaType = alt.bindings.get("__type")?.value as ContextValue | undefined;
      if (altMetaType) {
        const altInstanceof = typeMethod(altMetaType, "instanceof");
        if (altInstanceof?.kind === ValueKind.PrimitiveFunction) {
          const result = altInstanceof.fn([alt, value], undefined as any, undefined as any);
          const rp = primaryOf(result);
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
      const altMetaType = alt.bindings.get("__type")?.value as ContextValue | undefined;
      if (!altMetaType) return makeInt(0);
      const altSubtype = typeMethod(altMetaType, "subtypeof");
      if (!altSubtype || altSubtype.kind !== ValueKind.PrimitiveFunction) return makeInt(0);
      const result = altSubtype.fn([alt, target], undefined as any, undefined as any);
      const rp = primaryOf(result);
      if (rp.kind === ValueKind.Bits && (rp as BitsValue).data === 0n) return makeInt(0);
    }
    return makeInt(1);
  }));

  // Set __type to Type (unions are structural)
  addBinding(union, "__type", Type);

  return union;
}

// Bootstrap: Type self-types
addBinding(Type, "__type", Type);

// =============================================================================
// Member Descriptor Types (bootstrap)
// Member/Method/Field are named types created before buildType is available.
// =============================================================================

/** Abstract base type for member descriptors */
export const MemberType: ContextValue = makeContext();
addBinding(MemberType, "__name", stringToBits("Member"));
addBinding(MemberType, "__type", Type);

/** Method descriptor — a member with an implementation function */
export const MethodType: ContextValue = makeContext();
addBinding(MethodType, "__name", stringToBits("Method"));
addBinding(MethodType, "__type", Type);
addBinding(MethodType, "__extends", MemberType);

/** Field descriptor — a member representing instance data */
export const FieldType: ContextValue = makeContext();
addBinding(FieldType, "__name", stringToBits("Field"));
addBinding(FieldType, "__type", Type);
addBinding(FieldType, "__extends", MemberType);

/** Create a Method descriptor */
export function makeMethodDescriptor(
  name: string,
  impl: PrimitiveFunctionValue,
  isGetter: boolean = false,
): ContextValue {
  const desc = makeContext();
  addBinding(desc, "__type", MethodType);
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
  addBinding(desc, "__type", FieldType);
  addBinding(desc, "name", stringToBits(name));
  addBinding(desc, "fieldType", fieldType);
  return desc;
}

/** Check if a descriptor is a Method */
export function isMethodDescriptor(desc: ContextValue): boolean {
  return desc.bindings.get("__type")?.value === MethodType;
}

/** Check if a descriptor is a Field */
export function isFieldDescriptor(desc: ContextValue): boolean {
  return desc.bindings.get("__type")?.value === FieldType;
}

/** Check if a Method descriptor is a getter (auto-call with self) */
export function isGetterDescriptor(desc: ContextValue): boolean {
  const g = desc.bindings.get("getter")?.value;
  return g !== undefined && g.kind === ValueKind.Bits && (g as BitsValue).data !== 0n;
}

/** Look up the full member descriptor from a type's __members */
export function typeMemberDescriptor(type: ContextValue, name: string): ContextValue | null {
  const membersBinding = type.bindings.get("__members");
  if (!membersBinding?.value || membersBinding.value.kind !== ValueKind.Context) return null;
  const members = membersBinding.value as ContextValue;
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
  const fieldCtx = primaryOf(fieldSpecObj);
  if (fieldCtx.kind !== ValueKind.Context) {
    throw new AllegroError("extend: argument must be an object literal {field: Type, ...}");
  }
  const fields: { name: string; type: Value }[] = [];
  for (const [key, binding] of (fieldCtx as ContextValue).bindings) {
    if (key.startsWith("__")) continue;
    if (binding.value) {
      fields.push({ name: key, type: binding.value });
    }
  }

  // Build the new type Context
  const newType = makeContext();
  addBinding(newType, "__name", stringToBits("<anonymous>"));
  addBinding(newType, "__type", metaType);
  addBinding(newType, "__extends", parentType);

  // Build __members: Field descriptors for declared fields + Method descriptors for methods
  const members = makeContext();

  // Add Field descriptors for each declared field
  for (const f of fields) {
    addBinding(members, f.name, makeFieldDescriptor(f.name, f.type));
  }

  // Copy non-meta Method descriptors from parent's __members
  const metaMethodNames = META_METHOD_NAMES;
  const parentMembers = parentType.bindings.get("__members")?.value;
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
  addBinding(newType, "__construct", makePrimitive("record.__construct", constructImpl, true));

  // Auto-generate __getMember: field access on instances
  addBinding(newType, "__getMember", makePrimitive("record.__getMember", (args) => {
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
            const str = (tsMethod as PrimitiveFunctionValue).fn([primaryOf(val)], undefined as any, undefined as any);
            const sp = primaryOf(str);
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

  addBinding(newType, "__members", members);

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
  const specCtx = primaryOf(memberSpecObj);
  if (specCtx.kind !== ValueKind.Context) {
    throw new AllegroError("interface: argument must be an object literal {member: Type, ...}");
  }

  // Extract declared members from the spec
  const declaredMembers: { name: string; type: Value }[] = [];
  for (const [key, binding] of (specCtx as ContextValue).bindings) {
    if (key.startsWith("__")) continue;
    if (binding.value) {
      declaredMembers.push({ name: key, type: binding.value });
    }
  }

  // Build the interface type Context
  const ifaceType = makeContext();
  addBinding(ifaceType, "__name", stringToBits("<anonymous>"));
  addBinding(ifaceType, "__type", Type); // structural — no ~ needed
  addBinding(ifaceType, "__extends", parentType);
  addBinding(ifaceType, "__interface", makeInt(1)); // marker

  // Build __members: declared members as Field descriptors
  const members = makeContext();

  // Copy non-meta Method descriptors from parent's __members
  const metaMethodNames = META_METHOD_NAMES;
  const parentMembers = parentType.bindings.get("__members")?.value;
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

  addBinding(ifaceType, "__members", members);

  return ifaceType;
}

/**
 * Build a refined type: inherits parent, wraps constructor with predicate check.
 */
export function buildRefinedType(parentType: ContextValue, predicate: Value): ContextValue {
  const refinedType = makeContext();
  // Copy all bindings from parent (except __members, handled separately)
  for (const [key, binding] of parentType.bindings) {
    if (key === "__members") continue;
    if (binding.value) {
      addBinding(refinedType, key, binding.value);
    }
  }
  // Copy __members from parent (shared reference is fine — same descriptors)
  const parentMembers = parentType.bindings.get("__members")?.value;
  if (parentMembers?.kind === ValueKind.Context) {
    addBinding(refinedType, "__members", parentMembers);
  }
  // Override __name
  refinedType.bindings.delete("__name");
  addBinding(refinedType, "__name", stringToBits("<refined>"));
  // Set __extends to parent
  refinedType.bindings.delete("__extends");
  addBinding(refinedType, "__extends", parentType);
  // Store predicate
  addBinding(refinedType, "__predicate", predicate);
  // Phase B: recognise the predicate's algebraic shape (if any) and stash
  // an abstract domain. The domain lets downstream arithmetic propagate
  // refinement facts without re-evaluating the predicate. Opaque
  // predicates just get an opaque-tagged domain; runtime checks still
  // fire via __construct / type_check.
  (refinedType as any).__abstractDomain = domainFromPredicate(predicate);

  // Wrap __construct with predicate check
  const parentConstruct = parentType.bindings.get("__construct")?.value;
  if (parentConstruct?.kind === ValueKind.PrimitiveFunction) {
    refinedType.bindings.delete("__construct");
    const idx = refinedType.bindingList.findIndex(b => b.key === "__construct");
    if (idx >= 0) refinedType.bindingList.splice(idx, 1);

    addBinding(refinedType, "__construct", makePrimitive("refined.__construct", (args, ctx, evalFn) => {
      // Call parent constructor
      const value = (parentConstruct as PrimitiveFunctionValue).fn(args, ctx, evalFn);

      // Error propagation: if parent constructor produced an error (e.g., its
      // own refinement check failed further up the chain), propagate it
      // without re-tagging or running this predicate. Without this, a deeper
      // refinement's error would get silently retagged with the outer type.
      if (value.kind === ValueKind.MultiValue) {
        const comps = (value as MultiValueType).components;
        if (comps.has("error")) return value;
      }

      // Apply predicate
      const checkResult = evalFn!(makeExpr(predicate, [value]), ctx!);
      const checkP = primaryOf(checkResult);
      if (checkP.kind === ValueKind.Bits && (checkP as BitsValue).data === 0n) {
        // Predicate failed — return a targeted error. If the refined type has
        // a recognised abstract domain, render it in the message so the user
        // sees what constraint the value violated.
        const dom = (refinedType as any).__abstractDomain;
        const primary = primaryOf(value);
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
      const typed = withType(primaryOf(value), refinedType);
      const dom = (refinedType as any).__abstractDomain;
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
    if (key === "__construct") continue;
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
  const parentConstruct = parentType.bindings.get("__construct")?.value;
  if (parentConstruct?.kind === ValueKind.PrimitiveFunction) {
    addBinding(newType, "__construct", makePrimitive("invariant.__construct", (args, ctx, evalFn) => {
      // Call parent constructor first.
      const value = (parentConstruct as PrimitiveFunctionValue).fn(args, ctx, evalFn);

      // Error propagation: parent's own invariant / refinement check might
      // have failed already; pass the error through unchanged rather than
      // re-tagging with this layer.
      if (value.kind === ValueKind.MultiValue) {
        const comps = (value as MultiValueType).components;
        if (comps.has("error")) return value;
      }

      // Apply each invariant in declaration order. First failure → error.
      for (let i = 0; i < newInvariants.length; i++) {
        const inv = newInvariants[i];
        const checkResult = evalFn!(makeExpr(inv, [value]), ctx!);
        const checkP = primaryOf(checkResult);
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
      const typed = withType(primaryOf(value), newType);
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
    if (key === "__extends") continue;
    if (key === "__members") continue;
    if (binding.value) {
      addBinding(distinctType, key, binding.value);
    }
  }
  // Copy __members from parent (shared reference — same descriptors)
  const parentMembers = parentType.bindings.get("__members")?.value;
  if (parentMembers?.kind === ValueKind.Context) {
    addBinding(distinctType, "__members", parentMembers);
  }
  // Override __name and __type
  distinctType.bindings.delete("__name");
  addBinding(distinctType, "__name", stringToBits("<distinct>"));
  distinctType.bindings.delete("__type");
  addBinding(distinctType, "__type", Type); // named → nominal comparison via shape dispatch

  // Wrap __construct to re-tag with distinct type
  const parentConstruct = parentType.bindings.get("__construct")?.value;
  if (parentConstruct?.kind === ValueKind.PrimitiveFunction) {
    distinctType.bindings.delete("__construct");
    const idx = distinctType.bindingList.findIndex(b => b.key === "__construct");
    if (idx >= 0) distinctType.bindingList.splice(idx, 1);

    addBinding(distinctType, "__construct", makePrimitive("distinct.__construct", (args, ctx, evalFn) => {
      const value = (parentConstruct as PrimitiveFunctionValue).fn(args, ctx, evalFn);
      return withType(primaryOf(value), distinctType);
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

  const predicate = refinedType.bindings.get("__predicate")?.value;
  const parentType = refinedType.bindings.get("__extends")?.value as ContextValue;
  if (!predicate || !parentType || parentType.kind !== ValueKind.Context) {
    return refinedType; // not a refined type — nothing to do
  }
  const parentConstruct = parentType.bindings.get("__construct")?.value;

  // Build new type (clone bindings except __members and __construct)
  const newType = makeContext();
  for (const [key, binding] of refinedType.bindings) {
    if (key === "__members" || key === "__construct") continue;
    if (binding.value) addBinding(newType, key, binding.value);
  }

  // Rebuild __construct so it tags results with the NEW type
  if (parentConstruct?.kind === ValueKind.PrimitiveFunction) {
    addBinding(newType, "__construct", makePrimitive("refined.__construct", (args, ctx, evalFn) => {
      const value = (parentConstruct as PrimitiveFunctionValue).fn(args, ctx, evalFn);
      const checkResult = evalFn!(makeExpr(predicate, [value]), ctx!);
      const checkP = primaryOf(checkResult);
      if (checkP.kind === ValueKind.Bits && (checkP as BitsValue).data === 0n) {
        // Same constraint-rendering logic as buildRefinedType's __construct.
        const dom = (refinedType as any).__abstractDomain;
        const primary = primaryOf(value);
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
      return withType(primaryOf(value), newType);
    }, true));
  }

  // Clone __members and add lifted operator descriptors
  const parentMembers = refinedType.bindings.get("__members")?.value;
  const newMembers = makeContext();
  if (parentMembers?.kind === ValueKind.Context) {
    for (const [key, binding] of (parentMembers as ContextValue).bindings) {
      if (binding.value) addBinding(newMembers, key, binding.value);
    }
  }

  const newConstruct = newType.bindings.get("__construct")?.value as PrimitiveFunctionValue | undefined;

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
      const wrapped = makeExpr(identityPrim, [primaryOf(parentResult)]);
      return newConstruct.fn([wrapped], ctx as any, evalFn as any);
    }) as PrimitiveFnImpl);

    addBinding(newMembers, opName, makeMethodDescriptor(opName, liftedOp));
  }

  addBinding(newType, "__members", newMembers);
  return newType;
}

/**
 * Add mixin methods to a type. Takes a method spec object (key → function)
 * and returns a new type with the methods added to __members as Method descriptors.
 * Errors on name conflict (method already exists in __members).
 */
function buildMixinType(baseType: ContextValue, specObj: Value): ContextValue {
  const specCtx = primaryOf(specObj);
  if (specCtx.kind !== ValueKind.Context) {
    throw new AllegroError("mixin: argument must be an object literal {method: fn, ...}");
  }

  // Extract method specs
  const methods: { name: string; impl: Value }[] = [];
  for (const [key, binding] of (specCtx as ContextValue).bindings) {
    if (key.startsWith("__")) continue;
    if (binding.value) {
      methods.push({ name: key, impl: binding.value });
    }
  }

  // Build new type (clone baseType except __members and __construct)
  const newType = makeContext();
  for (const [key, binding] of baseType.bindings) {
    if (key === "__members" || key === "__construct") continue;
    if (binding.value) addBinding(newType, key, binding.value);
  }

  // Clone __members and add mixin methods
  const parentMembers = baseType.bindings.get("__members")?.value;
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
    const impl = primaryOf(m.impl);
    if (impl.kind === ValueKind.PrimitiveFunction) {
      addBinding(newMembers, m.name, makeMethodDescriptor(m.name, impl as PrimitiveFunctionValue));
    } else if (impl.kind === ValueKind.ComposedFunction) {
      // Store the ComposedFunction directly — type_dispatch handles it
      const desc = makeContext();
      addBinding(desc, "__type", MethodType);
      addBinding(desc, "name", stringToBits(m.name));
      addBinding(desc, "value", impl);
      addBinding(newMembers, m.name, desc);
    } else {
      throw new AllegroError(`mixin: '${m.name}' must be a function`);
    }
  }

  addBinding(newType, "__members", newMembers);

  // Rebuild __construct: delegate to parentConstruct (which already chains all
  // predicate checks through nested refinements), then retag with newType. This
  // handles arbitrary refinement depth naturally — a previous implementation
  // tried to skip one level and re-apply the immediate predicate, which was
  // correct for a single level but fragile if the shape ever changed. If the
  // parent's construct produces an error MultiValue (refinement failure), we
  // propagate it without retagging.
  const parentConstruct = baseType.bindings.get("__construct")?.value;
  if (parentConstruct?.kind === ValueKind.PrimitiveFunction) {
    addBinding(newType, "__construct", makePrimitive("mixin.__construct", (args, ctx, evalFn) => {
      const value = (parentConstruct as PrimitiveFunctionValue).fn(args, ctx, evalFn);
      if (value.kind === ValueKind.MultiValue) {
        const components = (value as MultiValueType).components;
        if (components.has("error")) return value;
      }
      return withType(primaryOf(value), newType);
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
    type.bindings.delete("__construct");
    const idx = type.bindingList.findIndex(b => b.key === "__construct");
    if (idx >= 0) type.bindingList.splice(idx, 1);
    addBinding(type, "__construct", makePrimitive("custom.__construct", (ctorArgs, ctorCtx, ctorEvalFn) => {
      const result = ctorEvalFn!(makeExpr(fn, ctorArgs), ctorCtx!);
      return withType(primaryOf(result), type);
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
      const p = primaryOf(args[i]);
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
addBinding(Type, "__members", typeMembers);

// --- Type builder helper ---

/** Names of properties that should be treated as getters (auto-called with self) */
const getterNames = new Set(["length"]);

/**
 * Build a named type. The type's __name carries its identity, so shape-aware
 * comparison treats it nominally when paired against another named type.
 *
 * @param name     Type name (e.g., "Int", "String")
 * @param methods  Instance methods (dispatched via type_dispatch on values of this type)
 * @param options  Optional: extends (parent type)
 */
function buildType(
  name: string,
  methods: Record<string, PrimitiveFnImpl>,
  options?: { extends?: ContextValue },
): ContextValue {
  const ctx = makeContext();
  addBinding(ctx, "__name", stringToBits(name));
  addBinding(ctx, "__type", Type);
  if (options?.extends) {
    addBinding(ctx, "__extends", options.extends);
  }
  // Build __members with Method descriptors
  const members = makeContext();
  for (const [key, fn] of Object.entries(methods)) {
    const prim = makePrimitive(`${name}.${key}`, fn);
    const isGetter = getterNames.has(key);
    addBinding(members, key, makeMethodDescriptor(key, prim, isGetter));
  }
  addBinding(ctx, "__members", members);
  return ctx;
}

// --- Bits helpers (duplicated from primitives to avoid circular dep) ---

function toSigned(b: BitsValue): bigint {
  if (b.length === 64 && b.data >= 2n ** 63n) return b.data - 2n ** 64n;
  return b.data;
}

function asBitsTyped(v: Value, ctx: string): BitsValue {
  const p = primaryOf(v);
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
// Arrays are Contexts with numeric string keys ("0", "1", ...) and "__length".
// =============================================================================

/** Build a raw array Context (without type wrapping). Used internally. */
function makeRawArrayCtx(elements: Value[]): ContextValue {
  const ctx = makeContext();
  for (let i = 0; i < elements.length; i++) {
    const key = String(i);
    ctx.bindings.set(key, { key, value: elements[i], isUse: false });
    ctx.bindingList.push({ key, value: elements[i], isUse: false });
  }
  const lenKey = "__length";
  const lenVal = makeInt(elements.length);
  ctx.bindings.set(lenKey, { key: lenKey, value: lenVal, isUse: false });
  ctx.bindingList.push({ key: lenKey, value: lenVal, isUse: false });
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
  const lenBinding = ctx.bindings.get("__length");
  if (!lenBinding?.value) return [];
  const len = Number((lenBinding.value as BitsValue).data);
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
  const ctx = primaryOf(args[0]) as ContextValue;
  return withType(ctx.bindings.get("__length")?.value ?? makeInt(0), IntType);
});
const arrGetPrim = makePrimitive("arr_get", (args) => {
  const ctx = primaryOf(args[0]) as ContextValue;
  const idx = Number(toSigned(asBitsTyped(primaryOf(args[1]), "arr_get")));
  const b = ctx.bindings.get(String(idx));
  if (!b?.value) throw new AllegroError(`Array index ${idx} out of bounds`);
  return b.value;
});
const intGtePrim = makePrimitive("int_gte", (args) => {
  return withType(
    makeInt(toSigned(asBitsTyped(primaryOf(args[0]), "int_gte")) >= toSigned(asBitsTyped(primaryOf(args[1]), "int_gte")) ? 1 : 0),
    BoolType,
  );
});
const intAddPrim = makePrimitive("int_add", (args) => {
  const a = toSigned(asBitsTyped(primaryOf(args[0]), "int_add"));
  const b = toSigned(asBitsTyped(primaryOf(args[1]), "int_add"));
  return withType(makeInt(Number(a + b)), IntType);
});
const evalIfPrim = makePrimitive("eval_if", (args, ctx, evalFn) => {
  const cond = evalFn!(args[0], ctx!);
  const condP = primaryOf(cond);
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
  const aCtx = primaryOf(a) as ContextValue;
  const bCtx = primaryOf(b) as ContextValue;
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
    const lenBinding = ctx.bindings.get("__length");
    return lenBinding?.value ?? makeInt(0);
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
    const bCtx = primaryOf(args[1]) as ContextValue;
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
    ctx.bindings.set(key, { key, value, isUse: false });
    ctx.bindingList.push({ key, value, isUse: false });
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
addBinding(ObjectType, "__getMember", objectGetMember);
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
addBinding(IntType, "__construct", makePrimitive("Int.__construct", (args, ctx, evalFn) => {
  const v = evalFn!(args[0], ctx!);
  return withType(primaryOf(v), IntType);
}, true));

// Float(x) — wrap a value with Float type
addBinding(FloatType, "__construct", makePrimitive("Float.__construct", (args, ctx, evalFn) => {
  const v = evalFn!(args[0], ctx!);
  return withType(primaryOf(v), FloatType);
}, true));

// String(x) — wrap a value with String type
addBinding(StringType, "__construct", makePrimitive("String.__construct", (args, ctx, evalFn) => {
  const v = evalFn!(args[0], ctx!);
  return withType(primaryOf(v), StringType);
}, true));

// Bool(x) — wrap a value with Bool type
addBinding(BoolType, "__construct", makePrimitive("Bool.__construct", (args, ctx, evalFn) => {
  const v = evalFn!(args[0], ctx!);
  return withType(primaryOf(v), BoolType);
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
      const nb = ctx.bindings.get("__name");
      if (nb?.value?.kind === ValueKind.Bits) {
        const typeName = bitsToString(nb.value);
        // Check for type args (concrete generic like Array[Int])
        const argsB = ctx.bindings.get("__args");
        if (argsB?.value?.kind === ValueKind.Context) {
          const argsCtx = argsB.value as ContextValue;
          const argElems = arrayElements(argsCtx);
          return `${typeName}[${argElems.map((e, i) => cacheKeyOne(e, i)).join(";")}]`;
        }
        return typeName;
      }
      // Array-like Context (used as param types list)
      const lenB = ctx.bindings.get("__length");
      if (lenB?.value?.kind === ValueKind.Bits) {
        const len = Number((lenB.value as BitsValue).data);
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
      const p = primaryOf(a);
      if (p.kind === ValueKind.Bits) return `v:${(p as BitsValue).data}`;
      return cacheKeyOne(p, idx);
    }
    // Params and Symbols (type variables) — unique per name
    if (a.kind === ValueKind.Param) return `param:${(a as any)._name ?? idx}`;
    if (a.kind === ValueKind.Symbol) return `sym:${(a as any).name}`;
    return `unk:${idx}`;
  }

  // Build the base type with methods + generic metadata
  const ctx = buildType(name, methods);

  // Add __params (use raw array to avoid circular dep with ArrayType)
  const paramsKey = "__params";
  const paramsVal = makeRawArrayCtx(paramNames.map(n => stringToBits(n)));
  ctx.bindings.set(paramsKey, { key: paramsKey, value: paramsVal, isUse: false });
  ctx.bindingList.push({ key: paramsKey, value: paramsVal, isUse: false });

  // Add __constructor
  const constructorFn = makePrimitive(`${name}.__constructor`, (args: Value[]) => {
    const key = cacheKey(args);
    const cached = cache.get(key);
    if (cached) return cached;

    let concrete: ContextValue;
    if (makeConcreteType) {
      concrete = makeConcreteType(ctx, args);
    } else {
      concrete = defaultConcreteType(ctx, name, args, methods);
    }
    cache.set(key, concrete);
    return concrete;
  });
  const ctorKey = "__constructor";
  ctx.bindings.set(ctorKey, { key: ctorKey, value: constructorFn, isUse: false });
  ctx.bindingList.push({ key: ctorKey, value: constructorFn, isUse: false });

  // Mark as generic
  const genericKey = "__isGeneric";
  const genericVal = makeInt(1);
  ctx.bindings.set(genericKey, { key: genericKey, value: genericVal, isUse: false });
  ctx.bindingList.push({ key: genericKey, value: genericVal, isUse: false });

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
): ContextValue {
  const concrete = buildType(name, methods);

  // __generic: reference to the generic type
  const genKey = "__generic";
  concrete.bindings.set(genKey, { key: genKey, value: generic, isUse: false });
  concrete.bindingList.push({ key: genKey, value: generic, isUse: false });

  // __args: the applied type arguments (raw array to avoid circular deps)
  const argsKey = "__args";
  const argsVal = makeRawArrayCtx(args);
  concrete.bindings.set(argsKey, { key: argsKey, value: argsVal, isUse: false });
  concrete.bindingList.push({ key: argsKey, value: argsVal, isUse: false });

  return concrete;
}

/**
 * Check if a type is a generic type (has __isGeneric).
 */
export function isGenericType(type: ContextValue): boolean {
  const b = type.bindings.get("__isGeneric");
  return b?.value !== undefined;
}

/**
 * Get the type arguments from a concrete parameterized type.
 * Returns null if the type has no __args.
 */
export function getTypeArgs(type: ContextValue): Value[] | null {
  const b = type.bindings.get("__args");
  if (!b?.value) return null;
  const ctx = primaryOf(b.value);
  if (ctx.kind !== ValueKind.Context) return null;
  return arrayElements(ctx as ContextValue);
}

/**
 * Get the generic type from a concrete parameterized type.
 */
export function getGenericType(type: ContextValue): ContextValue | null {
  const b = type.bindings.get("__generic");
  if (!b?.value || b.value.kind !== ValueKind.Context) return null;
  return b.value;
}

/**
 * Get the number of type parameters on a generic type.
 */
function getGenericParamCount(generic: ContextValue): number {
  const paramsBinding = generic.bindings.get("__params");
  if (!paramsBinding?.value) return 0;
  const paramsCtx = primaryOf(paramsBinding.value);
  if (paramsCtx.kind !== ValueKind.Context) return 0;
  const lenBinding = (paramsCtx as ContextValue).bindings.get("__length");
  return lenBinding?.value ? Number((lenBinding.value as BitsValue).data) : 0;
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
  const ctor = generic.bindings.get("__constructor");
  if (!ctor?.value || ctor.value.kind !== ValueKind.PrimitiveFunction) {
    throw new AllegroError(`Not a generic type: ${bitsToString(generic.bindings.get("__name")?.value as BitsValue ?? stringToBits("unknown"))}`);
  }
  return ctor.value.fn(args, undefined as any, undefined as any) as ContextValue;
}

// =============================================================================
// Array as GenericType
// =============================================================================

export const ArrayType: ContextValue = buildGenericType("Array", ["T"], arrayMethods);

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
  const paramTypesCtx = primaryOf(args[0]);
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
      ((expectedType as ContextValue).bindings.get("__name")?.value as BitsValue) ?? stringToBits(""),
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
      (expectedCtx.bindings.get("__name")?.value as BitsValue) ?? stringToBits(""),
    );
    const actualName = bitsToString(
      (actualCtx.bindings.get("__name")?.value as BitsValue) ?? stringToBits(""),
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
    const argsBinding = ctx.bindings.get("__args");
    if (argsBinding?.value) {
      const argsCtx = primaryOf(argsBinding.value);
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
// Type System Extension
// =============================================================================

/**
 * Wrap a function value (PrimitiveFunction or ComposedFunction) as UntypedFunction.
 * Attaches arity as a component when known.
 */
export function wrapAsUntypedFunction(fn: Value, arity?: number): Value {
  const primary = primaryOf(fn);
  const components = fn.kind === ValueKind.MultiValue
    ? new Map(fn.components)
    : new Map<string, Value>();
  components.set("type", UntypedFunctionType);
  if (arity !== undefined) {
    components.set("arity", makeInt(arity));
  }
  return makeMultiValue(primary, components);
}

/**
 * Check if a value is a function (PrimitiveFunction or ComposedFunction).
 */
/** Wrap a type Context as a typed MultiValue using its __type as meta-type */
export function wrapType(type: ContextValue): Value {
  const metaType = type.bindings.get("__type")?.value as ContextValue | undefined;
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
      // Literal bindings (parsed as identifiers, resolved here)
      true: withType(makeInt(1), BoolType) as any,
      false: withType(makeInt(0), BoolType) as any,
      none: noneSingleton as any,
    },
  };
}
