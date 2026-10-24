# Plane interfaces: installing Allegro Standard's behaviour into Allegretto (B-112)

> Status: **draft**. Rulings 1, 3 and 4 in §8 (rulings) are taken; ruling
> 2 and the chunk sequence in §9 (chunks) await ratification.
> Owner: **B-112** (the four owed plane interfaces).
> Reviewed against `docs/book/units.md` (units in a narrow DAG, D50)
> 2026-10, and rewritten for a reader new to the project 2026-10; §11
> (change record) lists what each pass changed.
> Outcome: the hooks in §6 exist, each is capability-gated, and all share
> one registration form. The `evaluator` unit imports nothing from Allegro
> Standard. The other upward-dependency populations are filed as backlog
> items and not worked here.

## 1. Purpose and reader

This plan defines how the base language, Allegretto, runs behaviour that
belongs to the typed language built on it, Allegro Standard, without
depending on it. The mechanism is a set of **hooks**: named slots the base
declares, which the typed layer fills when it loads.

The reader is assumed to know what a layer, a plane and a unit are.
`docs/book/architecture-vocabulary.md` defines all three in two pages and
should be read first. §2 (terms) below defines only the terms this plan
adds.

## 2. Terms used in this plan

| Term | Meaning here |
|---|---|
| **The base** | Allegretto, layer L0: the value kinds, the evaluator, partial evaluation and the base primitives. Defined in `docs/book/layers.md` §1 (the layer spine). |
| **The layer** | Any layer above L0. In this plan almost always L2, Allegro Standard: the type system, refinements, effects, proofs. |
| **Symbol** | A name or token the base can store, compare and pass along without interpreting. The string `"effects"` is a symbol to the base. |
| **Meaning** | The behaviour or data semantics associated with a symbol. What it means to merge two effect sets, or to check a value against a type, is meaning. |
| **Hook** | A named slot the base declares and calls, whose implementation a layer registers when it loads. The base defines the interface; the layer supplies the implementation. |
| **Install** | A layer registering an implementation into a hook, at module load time. |
| **Handle** | An opaque value the base is handed and passes along unchanged. A type constant is a handle to the base. |
| **Metadata field** | One named slot on a value's metadata plane, with a propagation rule and a writer. [`concepts.md` §19 (metadata field)](../book/allegretto/metadata-and-capability.md#def-metadata-field). |
| **Writer capability** | The authority to set a field, realised as a closure that only the registrant holds. [`concepts.md` §21 (writer capability)](../book/allegretto/metadata-and-capability.md#def-writer-capability); decisions D23 (writes are gated, reads free) and D24 (the capability is a delegable closure). |
| **Plane interface** | The sanctioned route by which code reaches a plane. [`concepts.md` §24 (plane interfaces)](../book/concepts.md#def-plane-interfaces). A hook is the plane interface that crosses a layer boundary. |
| **Unit** | The smallest body of code holding one decision, with its imports as its dependencies. [`docs/book/units.md` §2 (what a unit is)](../book/units.md#def-unit). |

## 3. The problem this plan solves

### 3.1 Two requirements that pull against each other

Requirement **R2** (partial evaluation is the mechanism by which layers
are added, `concepts.md` §1) says that type checking, effect checking and
proof discharge are not separate passes. They happen *by evaluating*: the
evaluator runs the program as far as it can, and a check that cannot
complete becomes a residual value. So the evaluator must perform
type-directed dispatch and argument checking during evaluation.

Requirement **R6** (the base does not know about the layers, `concepts.md`
§1) says no concept of Allegro Standard may appear in Allegretto. The base
may not know what a type is.

Together: the evaluator must run type behaviour it may not know. That is
the architectural challenge.

### 3.2 The design pattern: dependency inversion by registration

The standard answer is dependency inversion. The lower module declares the
interface it needs; the higher module implements it; something wires the
two together at startup. In Allegro the wiring is **registration at load
time**: the base exports a registration function, and the layer calls it
when its module initialises. Control flows upward (the base calls the
layer's code) while the dependency arrow points downward (the layer
imports the base, never the reverse). This is the plugin pattern, and it
is how the base already handles one case today (§4.2).

Two Allegro-specific constraints shape it:

- **The base keeps only symbols.** The base stores the field name and the
  registered implementation. It never inspects what the implementation
  does. This is the same discipline the propagation rules already follow
  (SC-7, propagation is drawn from a fixed inspectable vocabulary,
  `concepts.md` §20): the base applies a rule by name and the layer
  supplies the semantics.
- **Registration is gated.** A registered type-check decides what passes.
  Whoever can register it holds authority, so registration requires the
  same unforgeable token that writing a field requires. Otherwise any
  module could redefine what type checking means, which is the forgery
  the writer capability exists to prevent (R12, metadata origination is
  capability-controlled).

### 3.3 What this plan buys, stated without overstatement

This plan does not get the project's thesis tested sooner. The next
thesis test is rung 3 of the demo ladder (`docs/plans/release-track.md`
§5), which is blocked on other work.

What it buys is the ability to reason about findings, especially
unexpected ones. The evidence is B-121 chunk C2 (metadata on values):
eleven call sites broke on a change that altered no interface, every
failure was silent, and two whole classes of them were invisible to the
survey meant to find them. Rung 3 adds new L0 and L2 surface, so that risk
is live while the pilot is built.

Since D50 (units in a narrow DAG) there is also a target the tooling can
read. `units.md` §6.1 M11 finds that the evaluator holds three activities
that belong to the Type system: checking an argument against a declared
type, dispatching a member access, and inferring types during
precompilation. The hooks in this plan are exactly that boundary. The
plan is done when `src/evaluator.ts` imports nothing from the L2 units
(§4.4).

## 4. Current state, measured

### 4.1 How much of the base's dependency on L2 is deciding, and how much is carrying

The question: of everything the base imports from the typed layer, how
much requires the base to *decide* something (which needs a hook) and how
much only requires it to *carry* a value through (which needs a handle)?

Method: the import clauses of the seven L0 files (`types.ts`,
`structure.ts`, `slots.ts`, `scope.ts`, `evaluator.ts`, `primitives.ts`,
`runtime.ts`) were parsed against the six L2 modules and each imported
symbol classified by what it is.

Result: **131 imported symbols, 98 distinct**. `primitives.ts` alone
takes 54 from `types-std.ts`.

| Class | Distinct | Examples | What it means for the base |
|---|---|---|---|
| Operations | 23 | `unifyTypes`, `impliesDomain`, `propagateSetForPrimitive` | the base calls L2 logic |
| Constructors and transforms | 19 | `withType`, `makeArray`, `normalizeType` | the base builds typed values |
| Type constants | 13 | `IntType`, `BoolType`, `ArrayType` | the base names types |
| Accessors and projections | 13 | `getType`, `domainOf`, `predicatesOf` | the base reads L2 fields through L2 aliases |
| TypeScript types | 10 | `PredicateSet`, `AbstractDomain`, `EffectSet` | the base destructures L2 representations |
| Predicates | 9 | `isGenericType`, `isPrivateDescriptor` | the base branches on L2 shapes |
| **Checkers** | **4** | `checkExhaustiveness`, `checkEffectsDeclarations` | the base runs L2 checks |
| Formatters | 4 | `formatProofFinding`, `describeFailedProof` | the base renders L2 findings |
| Injection points | 3 | `setDivergenceProbe`, `setEffectsInspector` | L2 asks the base for results (§4.3) |

What the table shows: only the four checkers and the dispatch inside the
evaluator are *deciding*. The hooks in §6 address those. The other classes
are carrying, rendering, or shared representation, and each needs a
different answer. §7 (out of scope) files them.

### 4.2 The pattern already exists once, without gating

`installFieldMerge` in `src/slots.ts` is a hook. The base holds a map from
field name to merge function and knows the string `"effects"`.
`src/effects.ts` installs the merge for effect sets when it loads. The
base reads it back by name when the propagation rule `union` applies.
Its own comment gives the reason: the base cannot import the encodings
without a cycle.

This is the form the plan prescribes, working today. It falls short of the
bar in one way: **any module may call it**, so any module may decide what
merging effects means. §3.2's gating constraint is not met.

### 4.3 The reverse direction: the layer asking the base for analysis results

Three symbols looked like further hooks and are not. `setDivergenceProbe`,
`setEffectsInspector` and `setLawInstantiationSuspended` are declared in
`types-std.ts` (L2) and filled from `runtime.ts` and `primitives.ts`. They
run the other way: the typed layer asks for results that only the
evaluator and the pipeline can compute. The third is not a hook at all but
a flag toggled around a critical section. §8.2 (ruling 2) says what to do
with them.

### 4.4 The same state at unit grain

`scripts/analyze/units.json` assigns `src/evaluator.ts` to three units at
once: `evaluator`, `metadata` (the propagation code `viralScan` and
`mergeOverMeta`) and `type-core` (the three Type-system activities). While
a file is mixed, every import edge out of it is *unresolved* in the
`units` report rather than a verdict, so the file's 45 uses of L2 symbols
are invisible as violations. The exit of this plan assigns the file to
`evaluator` alone and moves the propagation code to the `metadata` unit,
after which the report can pass judgement.

## 5. Principles

Six working principles, accepted as provisional (maintainer, 2026-09).
They are not promoted to `layers.md`; §5.1 states what decides their fate.
Each is stated, given its standard name where one exists, and given a
test.

### 5.1 P1: the base stores symbols and never interprets them

*Statement.* The base may hold a field name, a rule name or a registered
implementation. It may not contain code that depends on what those mean.

*Standard name.* Opaque token.

*Test.* Delete the layer. Does the base still compile and run, with the
hook unfilled? If the base needed the meaning, it will not.

*Example.* `slots.ts` holds `"effects"` and a merge function it never
reads into. It does not know an effect set is a set.

### 5.2 P2: the layer installs; the base never imports

*Statement.* Direction is not symmetric. An import makes the base depend
on the layer *existing*. An install makes the layer depend on the base's
*interface*, which is the direction R6 permits.

*Standard name.* Dependency inversion, realised by registration at load
time (the plugin pattern).

*Test.* The unit DAG. `units.md` §5 states this as a graph property: every
L2 unit reaches L0 through the `metadata` and `capability` units and
never through a kind's representation. The `units` report checks it. All
131 imports in §4.1 point the wrong way; `installFieldMerge` is the only
thing pointing the right way.

### 5.3 P3: carrying needs a handle; deciding needs a hook

*Statement.* When the base must pass a layer's value through unchanged, it
needs only an opaque handle it was given at registration. When the base
must choose behaviour based on a layer's value, it needs an installed
implementation.

*Standard name.* Separation of data from behaviour; strategy pattern for
the deciding case.

*Test.* Does the base branch on the value? Stamping *this result is an
Int* does not branch; it stores a handle. Checking *does this argument
satisfy the parameter's type* branches on the answer.

*Why it matters.* This is the line between §6 (hooks) and the type
vocabulary population in §7. Extending the hook mechanism to carrying
would give the base a decision it does not make.

### 5.4 P4: registration is gated by the writer capability

*Statement.* Installing into a hook requires the same unforgeable token
that writing the corresponding field requires. If any module can install
the check hook, any module can decide what type checking means.

*Standard name.* Capability-based security, applied to registration.
Decisions D23 (channel writes are capability-gated, reads free) and D24
(the capability is a first-class delegable closure; attenuation is
wrapping) already apply it to field writes.

*Test.* Attempt the install from a module that does not hold the writer.
It must be refused with an error, not ignored.

### 5.5 P5: define the interface before enforcing it

*Statement.* The sanctioned route lands before any lint forbids the
unsanctioned ones. A lint without the missing interface relocates the
reach rather than removing it.

*Standard name.* Vocabulary before policing.

*Evidence.* B-128 (layer separation is not policed) records the
counterexample: `unifyTypes` reached for storage because the interface
had no word for what it meant. This is why B-128's parts (b) and (c) wait
on this plan and not the reverse.

### 5.6 P6: a shared TypeScript type is a shared representation

*Statement.* Ten of the 98 imported symbols are TypeScript types. They
erase at runtime, so they look free. They let the base destructure the
layer's representation, which is the dependency the planes exist to
prevent.

*Standard name.* Representation leakage through shared types.

*Status.* Accepted with a recorded tension (maintainer, 2026-09). There is
no way around it with TypeScript alone, and it makes the interfaces
porous. The diagnosis is that these are a semantic dependency, concepts
built on simpler concepts, wearing an architectural mask. The fix is a
semantic hierarchy that is also a type hierarchy, some of it written in
Allegro rather than TypeScript. That is bootstrapping-era work (milestone
M9, self-hosted parser and type system) and is not attempted here.

*Under D51 (the `Value` contract).* The L0 half has an answer: the
`value` contract's own types (`ValueBase`, `KindOps`) are the sanctioned
shared types, and what P6 forbids is an L2 representation type crossing
downward. The clearest instance is `scope.ts` importing `PredicateSet`
and `mergePredicateSets` from `refinements.ts` (`units.md` M12), while the
storage under it is already typed `Map<string, unknown>`.

### 5.7 What decides whether the principles held

Re-run the survey from B-121 chunk C2 after this plan lands. If the
answer is a short list rather than a class of things nobody could search
for, the principles held. If not, they were wrong and the survey says
where. A provisional rule with no trigger becomes permanent by default;
this clause prevents that.

## 6. In scope: the hooks

Each hook has the same form: the base declares a slot keyed by field name,
the layer installs under P4's gate, the base calls with opaque values.

| Hook | What the base needs | Who installs | Today |
|---|---|---|---|
| **(a) Dispatch** | type-directed member dispatch during evaluation, without knowing what a type is | `type-core` installs *how to dispatch on my field* | `PRIM_TO_METHOD` and the `typeMethod` family inside `evaluator.ts` |
| **(b) Check** | checking an argument against a declared constraint | each channel installs *how to check a value against my field*, one check per registered field, called with a reader (§8.1) | `checkArgType`, 150 lines in `evaluator.ts` doing three jobs |
| **(c) Projection** | a computed view of a field, such as `shape` over `type` | each channel installs its projections | `typeShape` in `slots.ts` reads refinement-chain fields directly |
| **(d) Channel registration** | one registration that names a channel's fields, rules, semantics and owner | the owning layer | eleven undifferentiated field registrations performed by the base; owned by **B-111** (field versus channel: one registry for two concepts) |
| **(e) Facts merge** | combining fact layers along the scope chain | `refinements` installs the `predicates` merge | `scopeFactsFor` imports `mergePredicateSets`; found by the `units` report (`units.md` M12), added 2026-10 |

Hook (e) should not be a fifth mechanism. It is (d)'s registration read by
a second consumer: a channel registers its merge once, the metadata plane
reads it for the `union` rule, and the facts plane reads it along the
chain. Then the scope holds a symbol and no meaning (P1), `scopeAssume`
takes `Map<string, unknown>` (P6), and the L0 boundary contract's claim
that fact payloads are opaque to base operations becomes true.

### 6.1 The two concrete targets are messier than one hook each

`checkArgType` does three jobs: discharging an effect bound
(`getEffectBound` with `impliesDomain`), checking a refinement
(`getPredicate`, `getRefines`), and structural type checking. So *a
channel installs how to check against my field* is at least three
installs. Ruling 1 (§8) takes the reading that matches P1: one hook,
called once per registered field, using the loop the propagation table
already has.

`typeShape` lives in `slots.ts` and reads the `predicate`, `refines` and
`members` fields directly. That is L0's accessor layer encoding L2's
refinement-chain semantics, and it is the cleanest single test of hook
(c): thirteen lines with one caller shape.

## 7. Out of scope: filed, not worked

Four populations remain after the hooks. Each is a distinct question with
a distinct answer, and none is served by extending the hook mechanism.
They are worked after rung 3, per the sequence ratified 2026-09.

| Population | The question | Size | Why not a hook | Backlog item |
|---|---|---|---|---|
| **Type vocabulary** | How does a base primitive name a type it must not know, when it builds a result? | about 25 symbols, plus three L1 grammar files that build typed arrays, objects and strings (`units.md` M13) | P3: this is carrying. The primitive needs a handle it was given at registration. | **B-145** |
| **Knowledge propagation** | The evaluator performs abstract interpretation over L2 knowledge (domains, predicates) | about 18 | P1: L2 semantics run inside L0's loop, not referenced from it; the answer is an installed interpreter, which is larger than a hook | **B-146** |
| **Diagnostics and reporting** | L0 renders L2 findings as text | about 8 | P1: the finding is a symbol; rendering is a meaning the layer owns | **B-147** |
| **The law-instantiation flag** | A phase-scoped mutable global that switches a gate off | 1 | it is a defect, not a boundary | **B-148** |

Type vocabulary is the one to watch. It touches every primitive. If rung
3's pilot needs new plane crossings, and solution finding over a
constraint substrate plausibly does, it stops being deferrable and
becomes rung 3's blocker. That is the assumption the sequence rests on,
and it should be discovered from the pilot rather than predicted here.

Two populations that were scopes in the first draft are not any more.
Member dispatch is hook (a) (ruling 3). Base-to-layer injection is
ruling 2.

## 8. Rulings

Three were taken 2026-09; one is open.

| # | Question | Ruling |
|---|---|---|
| 1 | Is the check hook one hook or three? | **One hook, called per registered field** (taken). §8.1 records the consequence for its signature. |
| 2 | What happens to the two base-to-layer probes, `setEffectsInspector` and `setDivergenceProbe` (§4.3): are they replaced by a gated install in this plan (chunk C5), left as they are and filed, or something else? | **Open.** §8.2 states the three options and recommends the first. |
| 3 | Does member dispatch fold into hook (a)? | **Yes** (taken). §8.3 records what does not fold in with it. |
| 4 | Are the out-of-scope populations filed now? | **Yes** (taken). §7 and B-145 through B-148. |

### 8.1 Ruling 1: field checks are not independent, so a check takes a reader

The question raised: do any metadata fields depend on other fields? The
measured answer is yes, in both directions that matter.

- A field derives from another. `domainOf(v)` reads the `predicates` field
  first and falls back to `domain` only when there is no predicate set.
  So `domain` is a derived reading of `predicates`, not a peer.
- One field's check reads other fields. `checkArgType`, the check for
  `type`, reads the expected type's effect bound and the argument's
  `effects`, then its refinement predicate and the argument's
  `predicates` or `domain`. Checking `type` consults two other channels.

Consequence for the signature: a check hook takes `(expected, actual,
read)`, where `read` is a total reader over registered fields, the same
surface `metaOf` provides. The base still holds no meaning: it owns the
loop and the reader, and each field's check decides. What the base must
not do is order the loop by a dependency it knows about, because that
would encode which field derives from which. So the reader must be
usable from any check, and no check may depend on running after another.

### 8.2 Ruling 2: what to do with the two probes

**The question.** Two functions in `types-std.ts`, `setEffectsInspector`
and `setDivergenceProbe`, let code above the type system hand it a
callback it later uses to decide whether a function may instantiate an
equality law. They are the opposite direction from the hooks in §6: there
the base declares a slot and a layer fills it; here a layer declares a
slot and the pipeline fills it. The plan must say one of three things
about them:

| Option | What it means | Consequence |
|---|---|---|
| **(a) Replace them with a gated install, in this plan** | The pipeline registers *what this function's effects are* and *whether it may diverge* through the same capability-gated registration form as hook (d); the law gate reads the registered facts as symbols. The two `set*` functions and their nullable module-level state go away. | One more chunk (C5); the plan then describes every crossing of the layer boundary in one form |
| **(b) Leave them as they are and file a backlog item** | The plan covers the base-declares-slot direction only; the reverse direction is named as out of scope. | Smaller plan; two ungated injection points stay, and the plan's claim to describe the boundary is weaker |
| **(c) Replace them with ordinary imports** | The type system imports the effect inference and the divergence analysis directly. | **Not possible**: in the unit DAG the consumer (`equality-laws`, row 26) sits below both producers (`type-primitives`, row 32; `pipeline`, row 33). An import would invert the order |

**Recommendation: (a).** The rest of this section is the evidence.

**What the probes are.** All three injection symbols converge on
`assertPureForEquality` in `types-std.ts`:

- `setEffectsInspector`: the typed layer asks *what effects does this
  function have?*
- `setDivergenceProbe`: it asks *may this function diverge?* (ruling
  CE-R7: an equality or coercion whose termination is undischarged fails
  the purity gate).
- `setLawInstantiationSuspended`: not a hook; a flag that switches the
  gate off for a phase.

The callers are the equality implementations of `define` and
`Refinement`, and `Coercion.declare`. So the whole population serves one
job: deciding whether a function is pure and total enough to instantiate
an equality law (ruling E-R5: an `equals` implementation must infer an
empty effect set; CE-R7 extends that to termination). In actor terms this is
the activity *Register law* needing facts from *Infer effects* and
*Check totality*.

Checked against the unit DAG (2026-10): the consumer is the
`equality-laws` unit (`units.md` row 26). The effects inspector is filled
from `primitives.ts:1894`, the type primitives (row 32), which sit above
it. The divergence probe is filled from `runtime.ts:1213` with the
pipeline's set of diverging functions, the result of an analysis that
runs in the pipeline (row 33), the top of the DAG. A lower unit is asking
a higher one for an analysis result. No import can express that without
inverting the order, so the probes cannot become plain imports.

This is the mirror image of `actors-and-activities.md` §5a.3: there,
analyzers write conclusions onto the subject instead of returning them;
here, a consumer reaches back for a conclusion it cannot compute. Both
are the same missing thing, an analysis result with no interface.

**Why (a) and not (b).** Leaving the probes would let this plan claim to
have described the layer boundary while two crossings in the opposite
direction stay unnamed and ungated: any module can call `setEffectsInspector`
today and thereby decide what counts as pure. Under (a) the two become
one registration in the form the plan already prescribes, so the
boundary has one shape in both directions. The flag
(`setLawInstantiationSuspended`) is not a crossing but a phase-scoped
global, and stays filed as B-148 whichever option is taken.

**What (a) lands, concretely (chunk C5).** A registration `installAnalysis`
(name provisional) taking a capability token, an analysis name (`effects`,
`divergence`) and the function that answers it; the pipeline calls it
once per compilation after the analyses have run; `assertPureForEquality`
reads the two answers through the registry by name and errors if either is
uninstalled. The two `set*` exports and their module-level `let` state are
deleted.

### 8.3 Ruling 3: member dispatch is hook (a), and what does not fold in

The nine symbols that made member dispatch look separable are three
different things:

| Symbols | What it is | Home |
|---|---|---|
| `typeMethod`, `typeMemberDescriptor`, `typePrivilegedCtx` | dispatch proper | hook (a) |
| `assertMemberReachable`, `assertMemberAvailable` | a gate on dispatch | hook (b), because it is a check |
| `isFieldDescriptor`, `isMethodDescriptor`, `isGetterDescriptor`, `isPrivateDescriptor` | L2's descriptor shape, read in `primitives.ts` | neither: P6 |

The last row stays in view. Those four predicates exist because L0
branches on what kind of member descriptor it found, which is L2's
representation crossing the boundary as a shared shape. Hook (a) does not
remove them; P6 does, and P6's answer is M9. Filed inside B-145.

## 9. Chunks (ratified 2026-10-21 with the plan as a whole)

Each chunk lands one hook and moves its callers, plus the unit move the
hook makes natural (`units.md` §7: a move rides the chunk that touches its
file). Order is by what unblocks the most. The `slots.ts` split goes first
because three units and the facts merge all wait on it.

| # | Chunk | Hook | Unit moves (`units.json` edits) | Exit measured by |
|---|---|---|---|---|
| **C1** ✅ **landed 2026-10-21** | Split `slots.ts` three ways (`units.md` M5): structure accessors to `structure` (`src/slot-accessors.ts`); field registry and propagation table to `metadata` (`src/metadata.ts`); writer capabilities and `installFieldMerge` to `capability` (`src/capability.ts`). Gate `installFieldMerge` (P4) while it moves. Register the `predicates` merge from `refinements.ts`; `scopeFactsFor` reads it; `scopeAssume` takes `Map<string, unknown>` | (e) via (d)'s form | `src/slots.ts` leaves the mixed list; the plane lint's accessor layer becomes the `structure` unit's files; the `scope → refinements` violation is gone | `units`: 6 mixed files, 0 violations; plane lint green — **met**; see §9.3 for the two deviations |
| **C2** ✅ **landed 2026-10-22** | Check hook: `checkArgType` becomes a loop over registered fields calling each field's installed check with `(expected, actual, read)`; `type-core`, `refinements` and `effects` install theirs | (b) | `evaluator.ts` loses its `refinements` and `effects` imports | `refs checkArgType` finds no caller outside the installers — **met**; the uninstalled-check error exists and is not suite-exercised; the import-loss condition is **partly** met, see §9.3 |
| **C3** ✅ **landed 2026-10-22** | Dispatch hook: `PRIM_TO_METHOD`, `typeMethod`, `typeMemberDescriptor`, `typePrivilegedCtx` installed by `type-core`; the visibility gate rides (b); **call-site unification rides this install** (maintainer ruling 2026-10-22) | (a) | `evaluator.ts` loses `normalizeType` and the member family — **and its whole `types-std` import** | `refs PRIM_TO_METHOD` finds nothing in the evaluator — **met**; see §9.5 |
| **C4** ✅ **landed 2026-10-22** | Projection hook: the `shape` read leaves the base and is installed by `type-core`; the walk `typeShape` it uses leaves the accessor layer for `refinements` (§9.6, corrected 2026-10-24) | (c) | the `metadata` unit holds no refinement-chain reading — **met**; the base's read path names no field | no L0 file references `typeShape`; `metaReadRaw` has no branch on a field name — **met**. (The row originally said "`refs typeShape` finds the installer only", which measured a helper's callers in the layers rather than the base; §9.6) |
| **C5** ✅ **landed 2026-10-24** | Analysis probes, ruling 2 option (a): `setEffectsInspector` and `setDivergenceProbe` become one gated registration (`installAnalysis`, §8.2) the pipeline fills and the law gate reads by name | §8.2 | none owed | the two `set*` names are gone — **met**; an uninstalled analysis is an error at the gate — **met once a pass has begun**, see §9.7; B-148's flag untouched — **met** |
| **Exit** ✅ **landed 2026-10-24** | `src/evaluator.ts` assigned to `evaluator`; its propagation half (`viralScan`, `mergeOverMeta`) moved to `metadata` in the same commit | | `evaluator.ts` un-mixed — **met** | `units`: the `evaluator` unit has no L2 edge — **not met: two edges remain, now visible as violations and owned by B-146** (§9.8); §5.7's survey re-run — **done**, §9.8; B-128 (b) and (c) unblocked — **yes**, with the two edges as their known baseline |

Hook (d) is B-111 (field versus channel registration), a separate item.
If B-111 lands first, C1's registration uses its channel form; if not, C1
uses the field registry and B-111 lifts it later. Either order works; this
plan does not sequence B-111.

### 9.1 Verification

Per chunk: `scripts/typecheck.sh`; the full sharded suite with the plane
lint; the doc-ref lint; the `units` report with its `units.json` edit in
the same commit. Each hook has a suite entry that removes the install and
asserts the error: an uninstalled hook must fail at the call site, never
pass silently (the lesson of B-121 C2's eleven silent breaks and of
B-128(a)'s probe). C1 also re-runs `scripts/bench-slot-lookup.ts`, since
it moves the accessor layer the slot index sits under. The exit re-runs
the B-121 C2 survey (§5.7).

### 9.2 Documents to update on landing

- `docs/book/units.md` §4 status rows for units 8, 10, 11 and 13, and
  the §8 day-one numbers, corrected in place; M5, M11 and M12 marked
  closed.
- `docs/book/concepts.md` §24 (plane interfaces): the interface table
  rows gain a mechanism; delta 32 closes at C4.
- `docs/book/allegretto/README.md` invariants: *fact payloads opaque to
  base ops* becomes enforced at C1.
- `docs/book/implementation-map.md`: the new files from the C1 split.
- `docs/backlog.md`: B-112 progress; B-128 (b) and (c) unblocked at
  exit; B-111 cross-reference; the baseline of B-149 (the unit DAG joins
  the gate) lowered.
- `docs/CHANGELOG.md` per chunk; this plan's status and its manifest row.

### 9.3 C1 as landed, and its deviations

C1 landed as the row says, with the plane lint's accessor layer set to
`structure.ts`, `slot-accessors.ts` and `metadata.ts` (the metadata unit
holds the free reads over `meta`, so it names the storage too). The
`units` report after it: 162 edges, 51 ok, 0 violations, 111 unresolved,
6 mixed files. Two deviations from the plan's words:

1. **Hook (e)'s payload is a host object, not a Value.** A fact in the
   scope's facts plane is a `PredicateSet`, the host class, not an
   encoded Value as the `effects` field's payload is. So the facts merge
   is a second function installed beside the `predicates` field's merge
   (`installFactsMerge` in `src/scope.ts`, gated on the same writer the
   same way), not the field merge read back through the propagation
   table as "(e) via (d)'s form" implied. The gate is the plan's; the
   table is not shared. B-146 (knowledge propagation) owns the question
   of whether facts become Values, and with it whether the two merges
   become one.
2. **The uninstalled-merge error is not exercised by the suite.** §9.1
   asks each hook for a test that removes the install and asserts the
   error. The facts merge is installed once, at `refinements.ts` module
   init, and a second install is refused by design, so there is no
   runtime moment at which the suite can observe `scopeFactsFor` with two
   layers and no merge. The suite asserts the two refusals instead
   (foreign writer; second install). The error path is three lines and
   reads as stated.

Also found on the way: the committed `src/boundary-baseline.json` named
rules the lint no longer has (`components-direct`); the regeneration
corrected it, and every count fell or held.

### 9.4 C2 as landed, and its deviations

The base holds a check table (`src/metadata.ts`: `FieldCheck`,
`FieldReader`, `CheckSite`, `fieldChecks`) and a gated install
(`src/capability.ts` `installFieldCheck`, P4). The evaluator's
`checkArg` runs every installed check at a typed call site with
`metaReadRaw` as the reader and an evaluator bound to the site's context,
and throws if no check is installed at all. `src/types-std.ts` installs
the `type` check with the `type` writer (structure, generics, futures,
refinement predicates, moved from the evaluator unchanged except that the
predicate is evaluated through the site); `src/effects.ts` installs the
`effects` check with its writer (the effect bound on an effect type, and
the Surface C bound stamped on the Param, which the site hands over as an
opaque handle). Error messages are byte-identical. `units`: 162 edges,
52 ok, 0 violations, 110 unresolved. Deviations and findings:

1. **Two installers, not three.** The plan's row names `refinements` as
   an installer. Reading the code, `checkArgType` never read the
   argument's `predicates` or `domain` fields; it evaluated the expected
   type's refinement predicate, which is a slot of the type Context.
   Refined types are types, so that is the `type` check's job and
   `type-core` installs it. Ruling 1's measured claim about which fields
   the check consults is corrected to: the expected type's effect bound
   and the argument's `effects` (one other channel, not two).
2. **The import-loss condition is partly met.** The evaluator lost
   `impliesDomain`, `EffectsDomain`, `AbstractDomain`, `normalizeType`,
   `typeContextName`, `futureElementType`, `typeNameOnRefinesChain` and
   five accessor imports. It still imports 14 symbols from `types-std`,
   3 from `refinements` and 4 from `effects` (21, from 27). They belong
   to populations this chunk does not own: dispatch (`typeMethod`, C3),
   propagation of effects and predicates on residuals (`withEffects`,
   `withPredicates`, `propagateSetForPrimitive`, the exit and B-146),
   the `type` field read through its L2 alias (`getType`, `withType`,
   B-145), member visibility (`assertMember*`, `typePrivilegedCtx`,
   C3), and **call-site unification** (`unifyTypes`,
   `resolveTypeWithBindings`, `applyBoundaryBound`,
   `getFunctionParamTypes`, `getFunctionReturnType`). The last is a
   deciding activity (type-variable binding at the call) that no row of
   §9 names and no population of §7 files. It needs a ruling: a fourth
   hook, or part of C3's dispatch install, or B-145. Not decided here.
3. **`effects` imports the `structure` unit.** The effects check reads
   the effect bound through `getEffectBound` in `src/slot-accessors.ts`,
   so the `effects` unit gains a `structure` edge (`units.json`). The
   alternative, reaching the host-plane bit directly, is what the
   accessor layer exists to prevent.
4. **The uninstalled-check error is not suite-exercised**, for the same
   reason as C1's facts merge: the installers run at module init and
   cannot be undone in-process. The suite asserts the gate's refusal, the
   two kernel installs, and that a check for a field the base has never
   heard of runs at a typed call site.

### 9.5 C3 as landed, and what remains

The base holds a dispatch table (`src/metadata.ts`: `DispatchInstall` with
two entry points, `CallSite`, `CallBinding`, `dispatchers`) and a gated
install (`src/capability.ts` `installDispatch`, P4). At a primitive
application the evaluator runs the installed dispatchers twice over:
with the residual when an argument is unresolved (the dispatcher may
type it), and with resolved arguments (the dispatcher may answer instead
of the primitive). At a composed call it runs each dispatcher's `call`,
handing over the check loop, and takes back the context, the substituted
arguments and a finisher for the result. With nothing installed every
primitive runs as itself and every call binds nothing, which is
Allegretto's own semantics, so there is no uninstalled error here, by
design. `src/types-std.ts` installs both with the `type` writer: the
`PRIM_TO_METHOD` table, the equality protocol, operator dispatch behind
the availability and reachability gates, user-defined operator members
with the type's privilege; and unification, the per-argument checks, the
boundary bound and the inferred return type. Nothing in the moved code
changed except its home.

Measured: `refs` finds no `PRIM_TO_METHOD`, `typeMethod`, `unifyTypes` or
`protocolEquals` in the evaluator; `src/evaluator.ts` imports nothing
from `types-std.ts`; its L2 imports are 7 (from 21): `withPredicates`,
`propagateSetForPrimitive`, `PredicateSet` from `refinements` and
`effectsOf`, `withEffects`, `unionEffectSets`, `EffectSet` from
`effects`, all propagation on residuals and results — the exit's and
B-146's. `units`: 161 edges, 52 ok, 0 violations, 109 unresolved.

What remains of type-system knowledge inside `evaluator.ts`, and why
the manifest row keeps `type-core` for now: `precompileFunction` builds
each placeholder with the declared `type` and seeds a `domain` field from
the type's abstract domain so that knowledge propagation fires during
precompile, and the post-call path stamps an untyped `Bits` result with
its operand's `type`. Both are carrying by field name (hook (c), B-145,
and the knowledge population, B-146), not dispatch. The exit decides the
row when `viralScan` and `mergeOverMeta` move.

Also found on the way: the plan's C2 row expected the evaluator to keep
`getType` for precompile's inferred return type. It does not: the base
reads the `type` field freely, as `viralScan` already did, and
interprets nothing.

### 9.6 C4 as landed, and one correction to the row

The base holds a projection table (`src/metadata.ts`: `Projection`,
`projection`) and a gated install (`src/capability.ts`
`installProjection`, P4: a projection reads as a field, so installing one
is writing that field's meaning, and the gate is that field's writer).
`metaReadRaw` answers from three sources in order and names none of
them: the value's own `meta`; a registered field whose storage is still a
binding-plane slot, found through its registration's `bindingKey` and
read through a generic accessor (`readBindingSlot`); an installed
projection. The two name-specific branches the chapter recorded (`shape`
computed by calling `typeShape`; `discharged` read by name) are gone, and
so is a dead third one (`type` through `asStructure`, a carrier-era
fallback). `metaFieldList` lists binding-plane fields through the same
registration. `src/types-std.ts` installs the `shape` projection with the
`shape` writer it now holds.

`typeShape` and `equalityShape` moved from `src/slot-accessors.ts` to
`src/refinements.ts`, not to `type-core`: a refinement chain is the
`refinements` unit's structure, `type-core` sits above it in the DAG and
imports the walks, and `knowledgeOf` in the same file was already a
caller. Leaving them in the accessor layer would have kept L2's
refinement-chain semantics in L0's accessor layer, which §6.1 names as
the defect. So the row's exit measure, "`refs typeShape` finds the
installer only", is not met as worded and should not be: the walk has
seven callers in `types-std.ts`, seven in `primitives.ts` and four in
`refinements.ts`, all the type system's and knowledge's own modules, and
none in L0. The measure that holds is the row's second: no L0 unit reads
the refinement chain. `units`: 161 edges, 52 ok, 0 violations, 109
unresolved.

`shape` stays registered as a field (the writer is what gates the
install); whether a projection has a registration of its own is B-111's
question and is not pre-empted here.

**The row's mistake, stated plainly (2026-10-24).** The row conflated
two things: the *projection* `shape`, a field read computed on demand,
which is the hook; and the *walk* `typeShape`, a function from a type
Context to a type Context that decides where knowledge ends and shape
begins, which the projection calls and which eighteen other sites in the
typed layers call on type Contexts directly (operator dispatch, the
equality protocol, `type_dispatch`, `instanceof`, `knowledgeOf`). A
measure counting the walk's callers could never reach one, and it
measured the wrong side: a hook's exit is a property of the base. The
measure now on the row is the one every other row already uses.

**What the old measure would have flagged, and still stands.** Two of
the walk's callers sit in base sections of `src/primitives.ts`: the
context-listing primitive (`CONTEXT` section) and the `when` pattern
matcher (`EVAL_WHEN`), both applying the member-privacy gate of B-097 (visibility)
stage V3 (`getType`, `typeShape`, `scopeHoldsPrivilege`,
`assertMemberReachable`). That is L2 visibility inside L0 primitive
sections, the same shape as the dispatch gates ruling 3 assigned to hook
(b). The `units` report cannot see it because `primitives.ts` is a mixed
file. It belongs to whichever chunk next touches those sections, or to
the `primitives.ts` split (`units.md` M6 (`primitives.ts` is six units)); it is named here so that it is
not lost.

### 9.7 C5 as landed, and its deviations

The base holds an analysis table (`src/metadata.ts`: `Analysis`,
`analysisOf(channel, question)`) and a gated install
(`src/capability.ts` `installAnalysis(writer, question, answer)`, P4: an
analysis is a question about a field, so its gate is that field's
writer, and the key is `channel:question`). Two questions exist, both
about `effects`: `inferred` (installed once at the type primitives'
module init, with the writer acquired the kernel's way) and `diverges`
(installed by the pipeline). The gates in `types-std.ts`
(`assertPureForEquality`, `assertInvariantTotal`, the callee sweep) read
both by name through one helper and error if either is missing. The two
`set*` exports and their nullable module-level state are deleted; `refs`
finds neither. `units`: 162 edges, 52 ok, 0 violations, 110 unresolved.
Deviations and findings:

1. **The gates stand down before any pass.** The ruling says an
   uninstalled analysis is an error at the gate. Run literally, that
   fails at module init: `types-std.ts` builds the kernel's own refined
   types while loading, each through the invariant-totality gate, and no
   producer can have installed anything yet (the type primitives load
   after it, the pipeline later still). Those predicates are host
   primitives, which cannot diverge. So the helper answers "no gate"
   while the metadata epoch is 0 (no `evalSource` pass has begun), which
   is exactly the window the old nullable probes covered by being null,
   and errors from the first pass on.
2. **`diverges` answers null for "not analysed in this pass".** The
   pipeline installs `() => null` at the start of every pass and the real
   identity set after the typed path's divergence analysis. A null skips
   the divergence check only; `inferred` is never null. Before C5 an
   untyped pass left the previous typed pass's closure in place, a stale
   answer that happened to be harmless; now every pass states what it
   knows.
3. **`src/runtime.ts` joins the kernel-writer allow-list.** The
   `kernel-writer-acquisition` lint names the files that may call
   `kernelFieldWriter`; the pipeline needs the `effects` writer to
   install `diverges`, and is kernel code (it already bumps the epoch
   and attaches `source`). Three files now, from two.
4. **Found on the way: a fourth injection point.** `setInlineCutoff` in
   `src/evaluator.ts` is the same pattern ruling 2 named — a nullable
   module-level callback the pipeline fills per typed compilation (the
   T-R6 (the recursion inlining cutoff) recursion-cycle test), ungated, with a comment that cited the
   divergence probe as its model. It runs base-to-pipeline rather than
   layer-to-pipeline, and the ruling did not name it, so it stays. It
   should become an installed analysis in the same form (a question about
   totality, gated on an owner to be named) when the exit or B-148 next
   touches that code. The comment now cites the install.

### 9.8 The exit as landed: what the report now says

`viralScan` and `mergeOverMeta` are `viralOnto` and `mergeOverMeta` in
`src/metadata.ts`: the two rules the base can apply without meaning,
presence and an installed merge, reading the registry and nothing else.
The evaluator's three call sites (primitive application, composed
application, the unresolved-application residual) call them.
`src/evaluator.ts` is assigned to the `evaluator` unit alone in
`units.json`, so the report passes judgement on its edges for the first
time. The `proofs` unit's real edge to `evaluator` (`proven.ts` imports
`evaluate`) is recorded in the manifest, where it was missing.

    import edges between assigned files   162
      ok                                   57
      violation                             2   evaluator → refinements
                                                evaluator → effects
      unresolved                          103
    mixed files (owed splits)               5   types, primitives, runtime,
                                                modules, types-std

**The done-condition is not met, and this is the honest end state of
the plan's scope.** §3.3 says the plan is done when the evaluator
imports nothing from the L2 units. It imports seven symbols from two:
`withPredicates`, `propagateSetForPrimitive`, `PredicateSet`
(refinements) and `effectsOf`, `withEffects`, `unionEffectSets`,
`EffectSet` (effects). Both edges are one population, the one §7 filed
as **knowledge propagation (B-146)** and sequenced after rung 3: the
evaluator performs L2 inference inside its loop. For effects that is
the whole inference path (the primitive's static tags, the Param's
bound and effect variable, the `opaque` label, the precompile stash),
L2 labels the base constructs, not merely a field it carries; the
generic `union` rule cannot replace it because the base cannot encode an
effect set. For knowledge it is the abstract interpretation over domains
at primitive application and the facts read at symbol lookup. The hooks
in §6 were never going to remove these; §7 said so. What changed is
that the report now shows them as the two violations they are, instead
of hiding them inside a mixed file, which is what §4.4 asked for.

**B-146 should take the effects path explicitly.** Its text names
domains and predicates; effect inference is the same class of thing
(an L2 analysis running inside L0's loop whose answer is an installed
interpreter) and is the larger of the two edges. Recorded in the
backlog item.

**The survey (§5.7), re-run.** B-121 C2's survey classified kind tests
standing in for plane questions; B-128 (a) measured 152
`kind === ValueKind.Structure` sites in 2026-09. Today, through
`scripts/analyze/index.ts`:

    kind-tests Structure    166 sites
    kind-tests (all)       1016 sites
    any-props              1101 sites
    props meta               15 sites (all in the accessor layer; the plane lint holds it at 0 outside)

The answer to §5.7's question is mixed. The storage plane is a short
list: `meta` has fifteen accesses, all sanctioned, and the lint keeps it
there. The representation tests are not: 166 kind comparisons against
`Structure` is more than 2026-09's 152, because the chunks since (B-120,
B-121, the hooks) added guards faster than they removed them, and the
discriminator rule's count stands at 437 outside the allowed units. So
the principles held where an interface existed to hold them (the
metadata plane, the installs) and did not where the question still has
no word (B-128 (c): *is this a Structure* standing in for *does this
have bindings*, *is this a type*, *is this a scope*). That is B-128 (b)
and (c)'s work, and it is unblocked: the installs give the
representation somewhere else to be reached from, and the two
violations above are the known baseline the ratchet (B-149) starts
from.

**Not done here, and why.** `precompileFunction` still seeds a `domain`
field from a type's abstract domain and the post-call path still stamps
`type` by name (B-145, B-146); `setInlineCutoff` is still an ungated
injection (§9.7); two base sections of `primitives.ts` still apply the
visibility gate (§9.6). Each is named where its owner will find it.

## 10. Relationship to the unit DAG

`units.md` is the specification of which code may import which. This plan
is one of its moves: the one that takes the evaluator to its unit. The
relationship runs both ways.

- The DAG gives this plan its done-condition (§3.3) and its per-chunk
  verdict (§9).
- This plan gives the DAG two of its first closed misalignments (M5, the
  three-way `slots.ts` split; M11, the Type-system activities in the
  evaluator) and the mechanism for a third (M12, the facts merge).
- Where the two disagreed, the measurement won. The first draft of the
  DAG placed the grammar registry above the tree builder; the `units`
  report showed the builder reads the registry, so the registry sits
  below. That is recorded in `units.md` §4.2.

## 11. Change record

**2026-10-24, exit landed.** The plan's chunks are all landed. §9's
exit row updated; §9.8 added: the two remaining evaluator edges are
violations the report shows and B-146 owns; the §5.7 survey re-run and
answered; B-128 (b) and (c) unblocked.

**2026-10-24, C5 landed.** §9's C5 row updated; §9.7 added, with the
stand-down before the first pass and the fourth injection point found.

**2026-10-24, C4 row corrected.** The row's exit measure replaced by
one on the base; §9.6 states the conflation and names the two base
sections of `primitives.ts` that still apply L2 visibility.

**2026-10-22, C4 landed.** §9's C4 row updated; §9.6 added, with the
correction that the walk belongs to `refinements`, not `type-core`.

**2026-10-22, C3 landed.** Call-site unification ruled onto the dispatch
install; §9's C3 row updated; §9.5 added.

**2026-10-22, C2 landed.** §9's C2 row updated; §9.4 added with four
deviations and findings, one of which (call-site unification) asks for a
ruling.

**2026-10-21, C1 landed.** The plan ratified as a whole, ruling 2 taking
option (a). §9's heading and C1 row updated; §9.3 added with the two
deviations.

**2026-10, rewrite for a new reader.** The maintainer's review found that
the document assumed its reader had followed the conversation that
produced it: section titles written for effect, principles stated as
slogans, identifiers cited without their names, and five architectural
abstractions used without being distinguished. This revision adds §1
(purpose and reader), §2 (terms), §3 (the problem, as requirement,
challenge and pattern), restates each principle with a standard name and
a test, names every cited identifier on first use, and moves the
cross-document definitions to `docs/book/architecture-vocabulary.md`.
No ruling, hook, principle or chunk changed in substance. The companion
proposal for the methodology is `docs/plans/documentation-standards-delta.md`.

**2026-10, review against `units.md`.** Added the done-condition (§3.3),
the measurement at unit grain (§4.4), hook (e) (§6), the DAG check in
ruling 2 (§8.2), M13 (the L1 grammar files that build typed values) in the type-vocabulary population (§7), and the
chunk sequence (§9).

**2026-09, rulings.** Rulings 1, 3 and 4 taken; B-145 through B-148
filed; §8.1 through §8.3 written.

**2026-09, first draft.** Measurement, six principles, four hooks, five
out-of-scope populations.

## 12. What this plan is not

It is not the upward-import fix. It addresses the deciding cases, 4 of 98
distinct symbols plus the dispatch inside the evaluator. The other
populations are §7's, and calling this plan "the layer rework" would
overstate it by an order of magnitude.

It is not a lint. P5 puts the interface first, and B-128 owns the
enforcement.

It is not P6's answer. The semantic hierarchy that would dissolve the
shared-type tension is M9 work, recorded in §5.6 and left there.
