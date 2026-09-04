# The host plane, declared — one registry, generated types, one way in

Owner: **B-135** (what may live on the plane) and **B-137** (the casts that
reach it). Raised by the maintainer at the B-120 E4 gate, 2026-09:
*eliminate ALL weak typing (`as any` etc.) in the L0 host implementation*, and
then, after B-137's mechanical half found the registry already knows most of
these properties: *look at generating the declarations from the registry*.

Status: **draft** — awaiting the ruling in §6.

## 1. Why

B-137's mechanical half removed every weak cast the compiler could verify: 75
of them, because a kind guard was already narrowing the receiver. What is left
is a different thing. Every surviving `as any` property access reaches a
property that `src/types.ts` does not declare, so the cast is not sloppiness —
it is the only way to say what the code means.

The plane is real and it is load-bearing: 170 accesses in the implementation
files. It has no declaration, so it has no check, and B-127 already recorded
the consequence — the boundary lint cannot see a property access through an
`any` cast, which makes every one a hole in the enforcement B-128 owes.

## 2. The census, corrected twice

§5.7 of `entry-sequence-composite.md` reported the first count. Executing
B-137 corrected it once (79 of the "undeclared" reach a REGISTERED property).
Re-running it against the implementation files only — excluding the generated
`parser.ts`, `src/test/` and `src/boundary-tests.ts` — gives the number this
plan works from.

**170 `as any` property accesses, 41 distinct properties**, in three groups:

| Group | Accesses | Distinct | What it means |
|---|---|---|---|
| **Registered** in `SLOT_REGISTRY` | 81 | 18 | The property is known; only its TYPE is missing |
| **Declared** in `types.ts` | 3 | 3 | A cast that outlived its need |
| **Neither** | 89 | 20 | Genuinely undeclared |

The third group is not one population. **30 of its 89 are not L0 values at
all** — `attribute` (28), `add`, `get` belong to `grammar-ext.ts`'s
phrase-builder API — and a further 13 (`text`, `branch`, `tag`, `pattern`) are
grammar2 parse nodes. That leaves **~46 accesses over ~13 properties** that
are genuinely undeclared host state on an L0 value: `localMemberScope` (7),
`_tailPosition` (6), `hasPrivateMembers` (5), `memberNameIndex` (5),
`ownerShape` (5), `predicate` (4), `obligationMismatch` (3),
`memberPrivilege` (2), `total` (2), `assumeTerminates` (2), `extendsChain` (2),
`verified` (1).

**So the plane already has a partial census.** 18 of its ~31 L0 properties are
registered; the registry is not a complete list, but it is most of one. That is
what makes generation worth doing rather than a rewrite.

### 2.1 What the registry has, and the two things it lacks

`SlotRegistration` carries `name`, `storages`, `owner`, `disposition`,
`target`, `prefix?` and `notes?`. 26 entries declare a `js-property` storage;
18 of them are read through `as any` today (the other 8 have no live reader, or
are parser-generated prefix families).

Two fields are missing, and both are needed before anything can be generated:

- **The host type.** `owner` names the *Allegro* concept — `"Type"`,
  `"GenericType"`, `"Refinement"`, `"evaluator"` — not the TypeScript
  interface. `genericParams` has `owner: "GenericType"` and its note says
  *"on ComposedFunction"*: the host type is in prose.
- **The value's type.** Nowhere at all.

### 2.2 Which host type each registered property sits on

Determined by reading every write site. The split is clean, which is the
plan's main encouragement:

**On `ComposedFunctionValue`** — the body-form collapse targets, all written
by `collapseBodyMetadata` (`totality.ts`) and read by the analyzers:
`partial`, `decreasesMetric`, `declaredEffectsAst`, `paramEffectPairs`,
`provenClauses`, `genericParams`, `inferredEffects`.

**On `StructureValue`** — `abstractDomain`, `effectBound`, `effectLabels`,
`effectSet`, `predicateSet` (`decodePredicates` guards the kind first, so this
is Structure, not Value), `grammarValue`, `grammarHandle`, `grammarFragment`.

**On a scope only** — `compileMode`, `futureManager`. Both are read by
chain walks in `scope.ts`, and both acquire a natural home at **B-136**, when
the scope gets its own type. That is a dependency worth stating: two of the
eighteen are better solved by D49 than by this plan.

## 3. The design question this plan exists to settle

Generation is mechanical once the two fields exist. **Where the generated
declarations go is not**, and it is the whole decision.

### Option A — declare on the value interfaces

Emit into `StructureValue` and `ComposedFunctionValue`, the way
`StructureHostFields` already does for `parent` / `isScope` /
`scopePredicates`. Every cast at every call site simply disappears.

The cost is that it does the opposite of what B-135 was raised to do. The
maintainer's original objection was that host properties *compete with type
information when used at L2 and above*. Option A puts `abstractDomain`,
`genericParams`, `grammarHandle` and thirteen more onto the interface every
consumer of a value already holds — making the plane maximally visible and
maximally reachable, from anywhere.

### Option B — declare on a separate host-plane interface, reachable only through the accessor layer

Emit `StructureHostPlane`, `ComposedFunctionHostPlane` as interfaces that are
**not** part of `StructureValue` or `ComposedFunctionValue`, plus one typed
accessor pair per property. The single cast from value to host plane lives in
the generated file. Call sites use accessors and never name the property.

This is the shape `slots.ts` already has — it is the accessor layer, and six
of these properties have accessors there today (`getEffectBound`,
`setEffectBound`, `getEffectLabels`, `setEffectLabels`, …). Their defect is
that they are typed `any` and that seventy-odd other sites bypass them.

Option B is B-128's *(b) make the representation unreachable rather than
discouraged* and its *(c) a plane question must have exactly one spelling*,
delivered for the host plane specifically. It also makes the lint rule
statable: no `as any` property access naming a registered host property,
outside the generated layer. A regex can enforce that today; B-127's binder
analysis would enforce it properly.

**Recommendation: Option B.** Option A is less work and strictly worse on the
axis the maintainer raised. The extra cost of B is one accessor pair per
property, generated rather than written.

### 3.1 Feasibility — probed, not assumed

A hand-written stand-in for the generated file typechecked clean, including
`import type` cycles (`refinements.js` and `effects.js` both import
`types.js`; type-only imports are erased, so the cycle is not a runtime one).
The `v as unknown as StructureHostPlane` bridge compiles and the accessors
type through. Probe written, typechecked, and deleted — no code lands here.

## 4. What generation buys beyond the casts

The casts are the visible prize; these are the durable ones.

- **The registry becomes load-bearing.** Today it is a table maintained by
  discipline, and B-104 has twice found it stale. Once it emits the
  declarations, an entry that is wrong stops compiling.
- **One spelling per property.** The accessor is the only way in, so
  B-121 C2's failure mode — *"does this carry metadata?"* having eight
  spellings — cannot recur for the host plane.
- **The disposition table gets teeth.** Every registration already declares a
  D39 `disposition` and `target`. A generated accessor can carry that in its
  doc comment, so the migration state of each property is visible at the point
  of use rather than in a table nobody reads.

## 5. Risks

**The registry is not complete, and generating from it will make it look
complete.** ~13 L0 properties are unregistered (§2). If generation lands
first, the plane will have a generated, authoritative-looking declaration that
silently omits a third of itself. Registering those 13 must come first — and
that is judgment work, not codegen: it is B-135's actual question, and
`memberPrivilege` and `hasPrivateMembers` in particular are visibility
machinery whose plane placement was never ruled.

**`predicateSet` and `effectSet` look like metadata wearing host storage.**
Both are registered with `disposition: "metadata-field"`, meaning D39 already
ruled they belong on the metadata plane. Generating a host accessor for a
property whose declared destiny is to stop being a host property is at best
temporary and at worst entrenches it. They should be generated with their
disposition visible, or held back.

**Two properties want B-136, not this plan.** `compileMode` and
`futureManager` are scope-only. Declaring them on `StructureValue`-adjacent
interfaces now means moving them again at B-136.

**This is a wide, low-risk edit with no behavioural surface** — which is
exactly the shape that hides a behavioural change. The suite is the oracle; no
chunk here may change an `// expect:` comment.

## 6. Rulings needed before H1

1. **Option A or Option B** (§3). Everything else follows from this.
2. **Whether the ~13 unregistered properties are registered first** (§5), or
   whether generation lands over the 18 and the rest follow. The plan
   recommends first.
3. **What to do with `predicateSet` / `effectSet`**, whose declared
   disposition is `metadata-field` (§5).

## 7. Chunk sequence

Provisional — the maintainer sets the boundaries (W-001).

| Chunk | Delivers | Gate |
|---|---|---|
| **H0** | Register the ~13 unregistered L0 host properties, each with a disposition and target. No code change beyond `slots.ts`. Closes B-135's census half | Suite green; the census reports 0 unregistered L0 host properties |
| **H1** | `SlotRegistration` gains `hostType` and `tsType`; `scripts/generate-host-plane.ts` emits `src/host-plane.generated.ts` (interfaces + accessor pairs); `slots.ts`'s six existing `any`-typed accessors re-implemented on it | Generated file typechecks; regenerating is a no-op on a clean tree |
| **H2** | The 81 call sites move to accessors | Suite green; `as any` count over registered properties reaches 0 |
| **H3** | Boundary lint rule: no `as any` property access naming a registered host property outside the generated layer. Ratchet to zero | Lint fails on a reintroduced cast, verified by reintroducing one |

**Completion test**: the registry is the only place a host property is named,
`as any` over host properties is 0 in the implementation files, and a wrong
registry entry does not compile.

## 8. What this plan is not

It is **not** B-135's rule. Declaring what the plane holds is not the same as
saying what may live there; this plan makes the first possible and leaves the
second open. A generated declaration for a property that should not exist is
still a declaration for a property that should not exist.

It is **not** a scope redesign — `compileMode` and `futureManager` are noted
as B-136's, not taken.

It is **not** about `catch (e: any)` or the 225 bare `: any` annotations.
Those are a separate population with a separate argument, and the first is a
TypeScript requirement rather than weak typing of a value.
