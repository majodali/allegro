# Units: the implementation as a narrow DAG

> Tier 1 design doc. The organizing principle for the implementation:
> the code is divided into the smallest independent **units**, each
> holding the decisions that are its own, ordered in a narrow directed
> acyclic graph (a DAG). It sits below the layer spine
> ([`layers.md`](layers.md#def-layer)) and above the file map
> (`implementation-map.md`). Ratified 2026-10 as D50 (units in a narrow
> DAG); the `Value` definition it rests on is D51 (`Value` as a contract,
> seven kinds and an assembly). Specification first: the physical moves
> happen when a unit is next touched (§7). Measured by
> `npx tsx scripts/analyze/index.ts units` against the manifest in
> `scripts/analyze/units.json`.
>
> **Reader.** Someone deciding where code belongs, or what a piece of
> code may depend on. Assumes the six architectural abstractions in
> `architecture-vocabulary.md` and the four layers in `layers.md`. Terms
> defined here: *unit* (§2), *contract*, *kind unit*, *assembly* (§3),
> *mixed file* and *move* (§4, §7), *misalignment* (§6).

## 1. The problem: decisions have no single home

**Requirement.** Allegro is meant to be forkable and didactic (VISION §1,
the programmable-platform bet): a reader should be able to learn the
evaluator without reading `Bits`, and replace `Bits` without touching the
evaluator. Every design decision should therefore have one place in the
code where it lives, and every dependency between decisions should be
visible.

**Challenge.** The layer spine says *dependencies point downward only*
across four layers. A layer is too coarse to hold one decision:
`primitives.ts` is 4,464 lines across three layers, `types-std.ts` is
4,617 lines holding at least six separable decisions, and `runtime.ts`
imports eighteen project modules. Three questions have no answer at that
grain:

- **Where does this decision live?** The concept spine (`concepts.md`)
  traces each choice to a requirement, but a reader still cannot find the
  code that *is* the choice, because the choice is spread across files
  that also hold other choices.
- **What does X depend on?** "Does partial evaluation depend on
  `Structure`? Does metadata depend on `Bits`?" are answerable only by
  reading. The import graph at file grain says `evaluator` imports
  `types`, which is every kind at once.
- **Can someone fork this?** Today both halves of the requirement above
  need an edit to a hub file.

The cost of leaving this unanswered was measured once. B-121 (metadata on
values), at its chunk C2, broke eleven call sites with a change that altered no
interface, every failure silent, because code had reached past an
interface at a representation detail that no map named.

**Approach.** A **unit** (§2) answers all three questions by
construction: it holds one decision or one inseparable group, it depends
only on units below it, and each dependency is an import edge the
TypeScript binder can see. B-127 (the binder-aware analyzer) and B-128(a)
(the plane lint) are what make the order checkable rather than
aspirational.

**Why a DAG and not a list.** A total order would force arbitrary choices
(`bits` before `symbol`?) that encode no decision. The DAG is *narrow*:
each unit names the few units it needs, and unrelated units are
incomparable. That is the form in which "the evaluator does not depend on
`Bits`" is a fact rather than an accident of ordering.

**Why now.** B-112 (the four owed plane interfaces) is about to move the
type system's activities out of the evaluator behind hooks. Without a
stated target, B-112 moves code from one mixed file to another. With one,
B-112 is the chunk that takes `evaluator.ts` to its unit (§6, misalignment
M11), and its done-condition is measurable: the `evaluator` unit imports
nothing above L0.

**Cost.** Specification first is cheap: this document, a manifest, and a
report. The physical moves are not cheap, and they are *not* scheduled as
a campaign. Each happens when its unit is next touched for another reason
(§7), and the report shows the residue shrinking. That is the maintainer's
ruling: better to get the code organized while it is still small than to
test the thesis against a hub.

<a id="def-unit"></a>
## 2. What a unit is

A **unit** is the smallest body of code that:

1. **holds one decision**, or one cohesive group of decisions that could
   not be taken separately — cited by ID from `concepts.md` (R/SC/IC) or
   `decisions.md` (D);
2. **depends only on named units below it**, every dependency an import
   edge, no cycles;
3. **has one home** — a file, or a directory when it is large — so that
   "where is decision X?" has a path for an answer;
4. **can be replaced** by another unit with the same interface without
   editing anything below it, and without editing anything above it that
   does not name it.

Two things a unit is *not*:

- **Not a layer.** Layers are bands of units. The layer rule (downward
  only) is implied by the unit DAG and is no longer the finest statement
  of it.
- **Not an actor.** Actors (`actors-and-activities.md`) are roles with
  interfaces. A unit is code. §6 relates them: an actor is implemented by
  a set of units, and a unit may implement an activity rather than an
  actor at all.

**The granularity rule.** Split when the two halves have different
dependency sets or hold decisions that could be revised independently.
Do not split for size alone. `core-types` holds ten types in one unit
because they share one dependency set and one decision (D-series
core-type rulings); `bits` and `structure` are separate because
SC-2 (Bits is the only scalar) and SC-5 (one composite kind) are
independent choices with different dependents.

## 3. `Value` — contract, kinds, assembly (D51)

`Value` is foundational and abstract at once, and the two halves it holds
today sit in one file. The split is:

| Unit | Holds | Knows about |
|---|---|---|
| **`value`** (contract) | the open registry interface `Kinds`; `type Value = Kinds[keyof Kinds]`; `ValueBase<K>` with the literal `kind` tag; `KindOps<V>` naming what every kind supplies — `clone` (D22: derive, never mutate), `children`/`rebuild` (traversal), `isResolved`, a print form | nothing. Names no kind, no metadata |
| seven **kind units** | the tag as a string-literal constant, the interface, the factories, the type guard, the `KindOps` implementation; registration into `Kinds` by declaration merging | `value` only (plus a kind's own host state) |
| **`kinds`** (assembly) | the seven imports; `ValueKind` as a `const` object re-exporting the tags; the `KIND_OPS` table; the generic walkers built on `children`/`rebuild` | every kind. **This is the fork point** |

**Why an assembly rather than an open extension point.** `Value` is not
an extension mechanism of the *language* — R9 (the language surface is
extensible) and R14 (code is organised into separately-loadable units)
are the language's extension points. It is a way to structure foundational definitions so
that each is independent. So the set of kinds is closed per build, the
compiler checks exhaustiveness against it, and a fork edits one file.
Probed on TypeScript 7.0.2 (2026-10): deleting a kind unit and every
mention of it leaves the build green; a stale `case` for a deleted kind
fails with a named error; an exhaustive `switch` over the merged union
still reaches `never`; a duplicate tag is caught where any switch narrows
on it, and the analyzer checks it directly.

**Why declaration merging and not a generic union.** The alternative —
container kinds generic over the value type, the union tied in the
assembly — makes the knot visible but forces the closed names and the type
guards to live in the assembly. A consumer would then import `isBits`
from the assembly, and the import graph would say "depends on the
assembly" rather than "depends on `bits`". The dependency this document
exists to make visible would disappear again. With merging, `isBits`,
`BitsValue` and the tag all live in `bits.ts`, and the edge is honest.

**The cost, stated.** The meaning of `Value` is the sum of its
dependents, which is an upward dependency the import graph does not show.
It is bounded three ways: the contract imports nothing; the assembly names
the set explicitly; and once the split lands, the `units` command checks
that the merged registry equals the set the assembly names and that no two
kinds share a tag (B-149).

### 3.1 Metadata is a mixin from a later unit

The `meta` slot is required by **D48(b)** (metadata rides every kind),
executed at B-121, which exists because of PE Rule 1: a residual carries
propagated channels, and that is the thesis. It is an L0 decision — under
`--base` a value still carries `error` and `source` (B-109) — but it is
*not* a decision of any kind unit. A kind never reads the slot's
contents; `withMeta`'s arms copy it opaquely.

So the contract declares **no** `meta`. The `metadata` unit adds it by
augmenting `ValueBase` — the same mechanism the registry uses — and owns
`Metadata`, the field registry, the propagation table, `withMeta`,
`metaOf`, and the factories that build a value with its metadata
(D48(c)). Probed 2026-10: the kind units and assembly compile with no
`meta` in the program; a kind unit that reads `v.meta` fails to compile
when the metadata unit is absent; above the metadata unit, recursive
positions (`expr.args[0].meta`) see the slot.

Two consequences the move must honour:

- **D48(c) stays.** The metadata unit's factories call the kind factory
  and stamp the slot *in place while provably unshared* — the rule
  `structure.ts` already states. One allocation, no observable window.
  Benchmark on the move: the object gains a field after construction,
  which is a hidden-class transition every typed value takes identically.
- **Augmentation is program-global.** In the real build every unit is in
  one program, so a kind unit *could* name `meta` and compile. The order
  is therefore enforced by the analyzer, not the compiler, for this one
  edge — the same enforcement the rest of the DAG relies on.

Two alternatives were measured and rejected before (the `withMeta` header
in `types.ts` records both): a side table keyed by object fails because
metadata is per *position* and a third of attachments target an object
already carrying some; a wrapper carrier made three quarters of allocated
structures wrappers for one field.

### 3.2 The discriminator rule

`v.kind` stays. What changes is who may branch on it at runtime:

1. **A guard imports the kind.** Code asking "is this a Bits?" to read a
   Bits field calls `isBits` from `bits`. It never writes the comparison.
   The import is the dependency. About 400 of the 493 `ValueKind`
   comparisons outside tests are this.
2. **A walker uses the traversal protocol.** Code visiting every node
   (`subst`, `remapParams`, `replaceValueIdentity`, `typeLiterals`,
   `collectUnownedParams`, `resolveFreeSymbols`, `substParams`,
   introspection's walk) calls `children`/`rebuild` from `kinds` and
   enumerates nothing. Ten switches today, each a place a fork must edit.
3. **Only the evaluator switches on kind for behaviour**, and it names only
   the kinds that participate — Symbol resolves, Expression applies, the
   function kinds and Param take part in application — with a default arm
   for the inert rest. A kind a fork adds is inert until its author says
   otherwise. This moves the compiler's check from "every kind has an arm"
   to "every participating kind has an arm"; ratified 2026-10.

Printing a tag in a diagnostic is not dispatch. The grammar2 node kinds
and the type-descriptor kinds (363 further comparisons) are separate
discriminated unions, untouched.

The analyzer ratchets direct `v.kind ===` comparisons outside the kind
units, the assembly and the evaluator; the count may only fall.

## 4. The DAG

Units in dependency order, banded by layer. **Depends on** lists direct
dependencies only; everything is transitively above `value`. **Decisions**
cites what the unit holds. **Today** is the current home, and the status
column is §7's ledger, corrected in place as moves land (K-010).

### 4.1 L0 — Allegretto

| # | Unit | Decisions it holds | Depends on | Today | Status |
|---|---|---|---|---|---|
| 1 | **`value`** | R8 one value universe; D22 (derive, never mutate) as the `clone` obligation; the kind-tag protocol (D51) | — | `types.ts` (part) | owed |
| 2 | **`bits`** | SC-2 one uninterpreted scalar; UTF-8 and float encodings | `value` | `types.ts` (part) | owed |
| 3 | **`symbol`** | SC-4 FQN identity; IC-4 interning; the kernel scope's name table | `value` | `types.ts` (part), `symbols.ts` | owed (split) |
| 4 | **`param`** | positional parameters (SC-1 row 1); ownership by membership, not back-pointer | `value` | `types.ts` (part) | owed; see M7 |
| 5 | **`primitive-function`** | host functions as values (SC-1 row 2); `lazy`/`sourceAware` declarations; D24 closures as unforgeable references | `value` | `types.ts` (part) | owed |
| 6 | **`expression`** | SC-3 expressions are values; IC-6 memo | `value` | `types.ts` (part) | owed |
| 7 | **`composed-function`** | params + body; the clone helpers every path must use (PROCESS §6) | `value`, `param` | `types.ts` (part), `runtime.ts` (clone helpers) | owed |
| 8 | **`structure`** | SC-5 one composite; D46; IC-1 roles by field presence; IC-2/D48(a) entry sequence with `SlotView` below the spec; B-133/B-134 host bits | `value` | `structure.ts`, `slot-accessors.ts` (the D39 slot registry and typed accessors; no L2 semantics since B-112 C4 moved the refinement-chain walks out), `types.ts` (`StructureValue`) | partial — the representation and its accessor surface are in place; `StructureValue` still sits in `types.ts` |
| 9 | **`kinds`** | the closed set per build (SC-1); the walkers | 2–8 | `types.ts` (`Value`, `withMeta` arms, `isResolved`), the ten walker switches (§3.2) | owed |
| 10 | **`metadata`** | D48(b)(c) slot and construction; R3 non-interference; SC-7 propagation vocabulary; D39 field registry as code; the propagation table | `kinds` | `metadata.ts` (field registry, propagation vocabulary, free reads, carry idioms, merge table), `types.ts` (`withMeta`, `Metadata`), `evaluator.ts` (`viralScan`, `mergeOverMeta`) | partial — `metadata.ts` is the unit; `withMeta` and the two evaluator helpers are still elsewhere. Chapter: `allegretto/metadata-and-capability.md` |
| 11 | **`capability`** | R12 authority is a capability; D21 constructor brand; D23 free reads; D24 attenuation by wrapping; `installFieldMerge` (the one layer→base instance) | `metadata`, `primitive-function` | `capability.ts` (writers, registration, the gated `installFieldMerge`, the base's own fields), `primitives.ts` "Channel plane" 495–563 | partial — `capability.ts` is the unit; the Allegro-facing channel primitives are still in `primitives.ts`. Chapter: `allegretto/metadata-and-capability.md` |
| 12 | **`scope`** | D49 scope is not a value; IC-5 parent chain; the facts plane as opaque payload; future cells as bindings (D33) | `structure`, `symbol`, `metadata` | `scope.ts` (+ shares `Structure`) | owed → **B-136** executes it |
| 13 | **`evaluator`** | R2 PE as the mechanism; R4 totality; PE Rule 1 and Rule 2; application and substitution; TCO; the D22 carve-out for scope; **the four B-112 hooks as its install surface** | `scope`, `expression`, `composed-function`, `primitive-function`, `param`, `symbol`, `metadata`, `capability` | `evaluator.ts` (assigned to this unit alone since B-112's exit) | in place, with two edges the DAG does not permit, to `refinements` and `effects`: the effect and knowledge inference the evaluator still performs inside its loop, owned by **B-146** (knowledge propagation). Precompile's placeholder seeding and the post-call `type` stamp are carrying by field name (B-145) |
| 14 | **`futures`** | R10 resumable evaluation; D33 future cells; the completion cascade; B-114's confluence question | `evaluator`, `scope` | `futures.ts`, `runtime.ts` (`DependencyRegistry`, `applyPhase`), `primitives.ts` async 1116–1197 | owed |
| 15 | **`base-primitives`** | the ~40 Allegretto primitives (structures.md §11): bits, expression, structure ops, `eval_if`/`eval_when`, `make_error`, `print`, identity, source read (D47) | `kinds`, `evaluator`, `futures` | `primitives.ts` 23–1197 | owed |

Not a unit: **the host plane.** Host state is declared on the unit that
owns it (`expression` owns `memo`, `structure` owns its two bits, `scope`
owns its chain). The registry that would generate the declarations
(`host-plane-declaration.md`; B-135 (what may live on the host plane) and
B-137 (the casts that reach it)) is then per-unit data, and that
plan's §6 ruling — declare on the value interface or on a separate
host-plane interface — is taken per unit. Under this document the first
reading is the natural one.

### 4.2 L1 — extension substrate

| # | Unit | Decisions it holds | Depends on | Today | Status |
|---|---|---|---|---|---|
| 16 | **`grammar-formalism`** | R9 grammars are values; the scannerless engine; static analysis | — (the engine is L0-free) | `grammar2/types.ts`, `engine.ts`, `analyzer.ts` | **in place** |
| 17 | **`base-grammar`** | the Allegro grammar as a value; stratified precedence levels | `grammar-formalism` | `grammar2/base-grammar.ts` | in place |
| 18 | **`grammar-extension`** | runtime fragment merging; the user-op registry; the `grammar2_*` and legacy combinator primitives | `base-grammar`, `grammar-formalism`, `kinds`, `metadata` (and today `core-types` — M13) | `grammar2/fragments.ts`, `builder.ts`, `to-allegro.ts`, `grammar-ext.ts`, `parser.ts`, `primitives.ts` 1198–1850 | owed (split) |
| 19 | **`tree-builder`** | ParseTree → value trees; body-form markers; reads the user-op registry | `kinds`, `grammar-formalism`, `grammar-extension`, `evaluator` (one import, `substituteParams` — M4) | `grammar2/tree-builder.ts`, `parser-helpers.ts` | partial; B-132's parse-time contexts |
| 20 | **`module-loading`** | R14 separately-loadable units; resolution, caching, cycles; `use` pre-scan | `evaluator`, `futures`, `tree-builder` | `modules.ts` (loader half), `use-scanner.ts` | owed → **B-138** |

The first draft had 18 and 19 the other way round. The report corrected
it: `tree-builder` reads the user-op registry (`getUserOp`), so the
registry's unit sits below the builder, not above. Recorded because it is
the first time the measurement overruled the specification, which is the
relationship the two are meant to have.

### 4.3 L2 — Allegro Standard

The grain here is a first cut by dependency set. Refine when touched.

| # | Unit | Decisions it holds | Depends on | Today | Status |
|---|---|---|---|---|---|
| 21 | **`refinements`** | abstract domains, predicate sets, `knowledgeOf`; the knowledge lattice; the refinement-chain walks `typeShape` and `equalityShape` (where knowledge ends and shape begins, C3.1/D36) | `metadata`, `kinds`, `capability`, `scope` | `refinements.ts` | in place — imports only L0 |
| 22 | **`effects`** | EffectSet ops; effects as a field; CE-R series | `metadata`, `kinds` | `effects.ts` | in place — imports only L0 |
| 23 | **`type-core`** | Type as a value; the kind tower; member sets and dispatch (D41–D43 visibility, V-R); construct; the `type` field (B-109) | `capability`, `scope`, `refinements`, `effects` | `types-std.ts` 1–1908, 3217–3560 | owed (split) |
| 24 | **`core-types`** | Int, String, Float, Bool, Array, Object, Any, UntypedFunction; the raw-literal typing rule | `type-core` | `types-std.ts` 2596–3217, `runtime.ts` (`typeLiterals` — M3) | owed |
| 25 | **`generics`** | generic types; unification | `type-core`, `core-types` | `types-std.ts` 3795–4130 | owed |
| 26 | **`equality-laws`** | E-R1–E-R6; structural equality; declared coercions; law members and tiers | `core-types` | `types-std.ts` 3918–3984, 2492–2596 | owed |
| 27 | **`contracts`** | CT-R series; invariants, `requires`/`ensures`; CE-R8's two outcomes | `type-core`, `refinements` | `primitives.ts` 3044–3480 | owed |
| 28 | **`totality`** | T-R series; termination, `decreases`, exhaustiveness | `type-core` | `totality.ts` | in place |
| 29 | **`proofs`** | proof terms, combinators, induction (F1–F5); `proven`; the proof kernel's field | `equality-laws`, `refinements` | `proofs.ts`, `proven.ts`, `primitives.ts` 3631–4223, `types-std.ts` 423 (M2) | owed (split) |
| 30 | **`pcp`** | the Proof Collaboration Protocol, `pcp/1` | `proofs` | `pcp.ts` | in place |
| 31 | **`typed-modules`** | module objects, export surfaces, encapsulation | `type-core`, `module-loading` | `modules.ts` (object half) | owed → B-138 |
| 32 | **`type-primitives`** | the L2 primitive registrations (`type_dispatch`, `type_check`, `typed_*`, logical ops) | `type-core`, `core-types`, `base-primitives` | `primitives.ts` 1850–3044 | owed |

### 4.4 Tracks

| # | Unit | Decisions it holds | Depends on | Today | Status |
|---|---|---|---|---|---|
| 33 | **`pipeline`** | the `evalSource` stage order; `CompilationReport`; the post-passes that halt (CE-R1); precompile | everything it assembles | `runtime.ts` | in place as a file; owes `typeLiterals` (M3), `DependencyRegistry` (14), clone helpers (7) |
| 34 | **`introspect`** | summaries and safety grades for `inspect` | `pipeline` | `introspect.ts` | in place |
| 35 | **`cli`** | file runner, REPL, subcommands | `pipeline`, `introspect`, `module-loading` | `index.ts` | in place |

The pipeline is the top of the DAG. It is the one unit allowed to import
anything, because its job is assembly; a decision found inside it belongs
elsewhere (three are listed).

## 5. What the order makes true

Facts that are consequences of §4, each checkable by the report once the
moves land:

- **The evaluator does not depend on `bits` or `structure`.** Evaluation
  distinguishes Symbol, Expression and application; the rest is inert.
  `structure` leaves its dependency set when D49 (Scope leaves `Value`)
lands through B-136 (its owner), because
  the environment the evaluator threads is a `scope`.
- **Metadata does not depend on any kind.** It depends on `kinds` — the
  assembly — for the ops table, and on nothing in particular.
- **`refinements` and `effects` are L0-clean today.** Both import only
  `metadata`, `capability` and `types.ts`; `refinements` also imports
  `scope`, to install the facts merge. They sit *below* `type-core`,
  which uses them. That reverses the intuition that the type system is
  the root of L2.
- **The grammar engine depends on nothing of Allegretto.** It is a value
  parser; what makes it L1 is `tree-builder`.
- **Every L2 unit reaches L0 through `metadata` and `capability`**, never
  through a kind's representation. That is P2 (layers install, base never
  imports) stated as a graph property.
- **B-112's done-condition**: the `evaluator` unit has no import from
  §4.3. After B-112's exit it has two (`refinements`, `effects`), both
  the inference population B-146 owns, and the report shows them as
  violations rather than hiding them in a mixed file.

## 6. Actors and units

The actor model (`actors-and-activities.md`, draft) says what the system's
roles are; this document says what the code's parts are. The relation the
maintainer proposed and this exercise tested: **each actor is implemented
by a set of units; a unit may instead implement an activity.**

| Actor (level 1) | Units | Note |
|---|---|---|
| **Engine** | 1–10, 12–15 | the seven kinds, metadata, scope, evaluator, futures, base primitives |
| **Kernel** | 11, plus the capsule and privilege layers inside 23 | **M1** |
| **Parser** | 16, 17, 19 | |
| **Grammar registry** | 18 | |
| **Module loader** | 20, 31 | split across layers by ruling — B-138 |
| **Type system** | 21–27, 32 | refinement checker = 21 |
| **Effect system** | 22 | |
| **Totality analyzer** | 28 | |
| **Proof kernel** | 29, 30 | |
| **Environment** | no unit | **M10** |
| *(activity, not actor)* | 33 | the compile pipeline orchestrates actors |
| *(track)* | 34, 35 | |

### 6.1 Misalignments found

Each is a place where the actor model and the unit DAG disagree, with the
reading this document takes. None is settled here; each is either a
backlog owner's or a ruling's.

- **M1 — Kernel is not contiguous.** Capability minting is L0 (11); the
  evidence capsule and privilege layers (V-R2 (the mediation context is a
  minted capsule) and D42 (evidence is possession)) are L2, inside
  `type-core`. Either the Kernel decomposes per layer — a level-2 *Kernel
  (L0)* and *Kernel (L2)* — or the capsule is the Type system's and only
  minting is the Kernel's. The second reading matches the actor model's
  own test (authority nobody else can hold): the capsule is an
  *attenuated* capability, the wrapping of D24 (the capability is a
  delegable closure), and attenuation is a
  Type-system activity over a Kernel-minted reference. Reading taken:
  Kernel = unit 11.
- **M2 — The proof kernel's field is registered in the type system's
  file.** `types-std.ts:423` (B-109(a)). Moves to `proofs` with its unit.
- **M3 — `typeLiterals` is in the pipeline.** Raw Bits → Int/String is the
  Type system's rule (core-types), executed as a pipeline stage. The
  stage stays; the rule moves to unit 24 and the pipeline calls it.
- **M4 — `tree-builder` imports the evaluator** for `substituteParams`.
  A parser needing substitution is a smell: either the builder is doing
  an evaluation step, or substitution belongs in `composed-function`
  (where `subst` is a per-kind operation). Investigate on the move;
  likely the second.
- **M5 — `slots.ts` was three units.** Closed by B-112 chunk C1. The
  actor model named it a pure interface actor of the Engine; it was three
  interfaces, now three files: `slot-accessors.ts` (8, the structure
  accessors), `metadata.ts` (10, the field registry and propagation
  table) and `capability.ts` (11, the capability mechanism). The storage
  lint's accessor layer is `structure.ts`, `slot-accessors.ts` and
  `metadata.ts`.
- **M6 — `primitives.ts` is six units.** 15, part of 19, 27, 29, 32, and
  the async part of 14. Split per section; the section comments already
  mark the boundaries.
- **M7 — `param` ↔ `composed-function` cycle.** `Param.owner` points at
  its ComposedFunction; `ComposedFunction.params` holds its Params.
  Substitution already asks membership (`ownsParam`) rather than the
  back-pointer. 25 reads of `.owner` outside tests. Resolve by typing
  `owner` as the contract's `Value` (opaque above `param`) or deleting
  it; measure which on the move.
- **M8 — `types.ts` ↔ `structure.ts` cycle.** `types.ts` imports the
  structure factories; `structure.ts` imports the types. Dissolves when
  `structure` owns its own factory and `kinds` assembles.
- **M9 — Module loader spans L1/L2.** Already ruled (`layers.md`) and
  already owned (B-138). Units 20 and 31 make the ruling a graph edge.
- **M10 — Environment has no unit.** `print`, `fetch`, `delay` sit in
  `base-primitives` and `futures`; there is no interface to swap a host
  (B-141). The unit DAG says where it would go: a `host` unit between
  `futures` and `base-primitives`, which the primitives import and the
  CLI and web bundle each supply.
- **M11 — The evaluator held Type-system activities.** Closed by B-112:
  *Check declared constraint* left it at chunk C2 and *Dispatch member
  access*, with call-site unification, at chunk C3; the evaluator runs
  installed checks and dispatchers, decides nothing, and imports nothing
  from `types-std.ts`. What remains in the file is not a Type-system
  activity but inference the Effects and Knowledge activities perform
  inside the Engine's loop (the two edges §4 row 13 names; B-146), plus
  carrying by field name (B-145). B-112's hooks were exactly this
  boundary. This is the strongest alignment the two models produce, and
  the reason this document precedes B-112 chunk 1.
- **M12 — `scope` imported `refinements`.** Closed by B-112 chunk C1.
  Found by the report, not by reading: `scopeFactsFor` merged predicate
  sets along the chain with `mergePredicateSets`, so L0's scope knew how
  to combine L2 knowledge, while the L0 README says fact payloads are
  opaque to base ops. It was the facts-plane instance of P3 (decide →
  hook, carry → handle), and that is how it closed: `scope.ts` exposes
  `installFactsMerge`, gated on the `predicates` writer exactly as
  `installFieldMerge` is gated (P4); `refinements.ts` installs
  `mergePredicateSets` through it; `scopeFactsFor` returns an opaque
  fact and applies the installed merge. The edge now runs the permitted
  way, `refinements` → `scope`. One deviation stands: a fact is a host
  `PredicateSet`, not an encoded Value, so the facts merge is a second
  function beside the `predicates` field's Value-merge. B-146 (knowledge
  propagation) decides whether the two become one.
- **M13 — L1 grammar units build typed values.** `builder.ts`,
  `to-allegro.ts` and `grammar-ext.ts` import `makeArray`, `makeObject`,
  `withType`, `StringType`, `IntType`, `ErrorType` and `noneSingleton`
  from the type system — an L1→L2 edge `layers.md` forbids, invisible
  today because `types-std.ts` is mixed, and visible as a violation the
  moment `core-types` splits out. It is the type-vocabulary population
  (B-145, P3): a base primitive naming a type it must not know. No fix
  here; the DAG names the edge so B-145 can count it.

## 7. Moves — opportunistic, measured

No campaign. A unit's physical move happens when the unit is next touched
for other reasons, as part of that chunk, with the §4 status column
corrected in the same commit (K-010 converse). The report shows what
remains.

**Scheduled by their owners, in the order the backlog already sequences:**

| Move | Carried by | Produces |
|---|---|---|
| `slots.ts` → 8 / 10 / 11 (M5) | **done** — B-112 chunk C1 | `slot-accessors.ts`, `metadata.ts`, `capability.ts`; `plane-lint`'s accessor layer names the first two |
| `evaluator.ts` → 13 (M11) | **B-112** | the done-condition in §5 |
| `scope.ts` → 12 | **B-136** | D49 executed |
| `types.ts` → 1–9 (§3) | the first chunk that edits the `Value` union, or B-136 if it comes first | the contract, seven kinds, the assembly, metadata's mixin |
| `modules.ts` → 20 / 31 | **B-138** | |
| `primitives.ts` → six units (M6) | per section, when that section is touched | |
| `types-std.ts` → 23–26 | per band, when touched; B-145 (type vocabulary) is the likely first | |

**Enforcement** is a ratchet in `scripts/analyze/` (the `units` command,
§8): edges that violate §4's order are held at a committed baseline
(`scripts/analyze/units-baseline.json`) and may only fall; so are the
mixed files and the discriminator rule's count (§3.2), and a file with
no unit is refused outright. `npm run lint:units` runs it once per gate
(B-149).

**What a move must not do:** weaken a test (PROCESS §6), change a public
surface, or reorder a decision. A move is a rename and a cut along a
boundary this document already drew. A move that finds the boundary is in
the wrong place corrects §4 in the same commit and says why.

## 8. Measuring it

```
npx tsx scripts/analyze/index.ts units            # report
npx tsx scripts/analyze/index.ts units --json
```

The manifest `scripts/analyze/units.json` maps each source file to a unit
(or to `mixed` with the units it holds, per §4's *Today* column) and lists
each unit's permitted dependencies. The report says, per import edge
between two assigned files, whether the DAG permits it; lists the mixed
files as the owed splits; and counts direct `.kind ===` comparisons
outside the units the discriminator rule allows. `units --check` holds
all of that at `scripts/analyze/units-baseline.json` and fails the gate on
a new forbidden edge, a new mixed file, a rise in the discriminator count
or a file without a unit; `units --update-baseline` lowers the baseline
after a split lands.

At 2026-10-24 (after B-112's exit; `evaluator.ts` assigned to one unit):

    import edges between assigned files   162
      ok                                   57
      violation                             2   evaluator → refinements,
                                                evaluator → effects (B-146)
      unresolved                          103   one end is a mixed file
    mixed files (owed splits)               5   types, primitives, runtime,
                                                modules, types-std
    discriminator rule                    458   outside allowed units;
                                                166 types-std, 155 primitives,
                                                64 totality, 19 introspect, …

The 103 unresolved edges are the real measure of the work owed: each
becomes a verdict when its mixed end splits. The two violations are
verdicts the evaluator's split made visible: the effect and knowledge
inference it performs inside its loop, which the hooks were never meant
to remove (plan §7) and B-146 owns. The discriminator count rose from
437 at B-112 C1 to 458 for the same reason: the checks and dispatch that
moved out of the evaluator (an allowed unit) into `types-std.ts` carried
twenty-one kind comparisons with them, which the rule now counts. They
were never permitted by §3.2; they were hidden. The ratchet starts here.

## 9. What this document is not

It is not a plan: nothing here is chunked, and no move is scheduled on
its own. It is not a layer contract: the layer READMEs still say what each
layer provides and forbids. It is not the actor model, which it cites and
tests against. It is the map the other three can be checked against, and
the first one that the binder can read.
