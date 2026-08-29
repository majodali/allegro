# Concept spine — define Allegro, then make the code say it

> Status: **active** — ratified 2026-08 (§6 rulings 1–3; ruling 4
> deliberately HELD as a delta for S3). **S1 + S2a–S2f + S3 + S3b + S4 + S4b + S5 landed** — the spine's tiers are complete and §9 carries the
> ordered code campaign (C1…C13). **No code moves until §9.5's rulings are
> taken** (maintainer direction: nothing is modified until the design and
> plan are committed).
> Owner: B-106 (to be minted on ratification)
> Outcome (K-007): every salient concept in Allegro has a definition, a
> rationale, and a recorded delta against the code — and the code is then
> brought to the definition.

## 1. Why — the evidence

The tests pass, so the system is not lost. But the code communicates its
concepts badly, and the gap is measurable rather than a matter of taste.

- **`Context` vs `Structure`.** D1 and D46 are both recorded **executed**.
  The *runtime* unification was: one `Structure` class, `MultiValue` kind
  retired. The *naming* never happened at all — it was done by aliasing:
  ```ts
  export type ContextValue = StructureValue;   // src/types.ts:496
  ```
  `ContextValue` has **701** occurrences in `src/`. `StructureValue` has
  **2** — its own declaration and that alias. The constructor is
  `makeContext` (**101** uses); `makeStructure` does not exist. A reader
  who believes the decision log will not find the decision in the code.
- **`MultiValue`, likewise.** D46 retired it as a kind. `MultiValueType`
  survives as a live type name with 25 uses, and `makeMultiValue` is the
  sanctioned constructor named in CLAUDE.md's invariant list.
- **Concept coverage.** `src/` exports **136** named types, interfaces,
  classes and enums. **43** are named anywhere under `docs/design/` — even
  counting bare forms (`Bits` for `BitsValue`). **93 are not defined
  anywhere.** Among them: `ExpressionValue`, `ComposedFunctionValue`,
  `ParamValue`, `PrimitiveFunctionValue` — four of the seven representation
  kinds the architecture summary is built on.
- **Doc mass is concentrated, not distributed.** 3,306 lines across
  `docs/design/`, of which `allegretto/structures.md` is 1,330 (40%).
  `core-types.md` is 37 lines; `pattern-matching.md` is 56;
  `platform/README.md` is 23. There is no evaluator doc, no partial-
  evaluation doc, and `allegretto/architecture.md` is referenced by
  `implementation-map.md` as "planned".
- **There is no glossary.** Nowhere does a reader learn what a *plane* is,
  or that there are four of them, or which one a given slot lives on. That
  absence is the direct cause of the B-104 dunder situation: a naming
  convention was carrying a partition nobody had written down, so nobody
  could see that the partition had stopped being real.
- **`~Printable`.** Two carriers encode "is this an interface" — the
  meta-type and the `__interface` marker — and they **disagree** about
  `~Printable`. Neither the code nor any doc says which is authoritative,
  because "interface" was never defined precisely enough for the question
  to have an answer.

One more, found while landing this plan: **`doc-ref-lint` scanned tracked
files only.** A brand-new markdown file was invisible to it until its first
commit, so a local run passed and CI failed — for a dangling reference the
lint exists to catch. `src/boundary-tests.ts` had already faced the identical
question and answered it correctly (`--others --exclude-standard`, with a
comment explaining exactly why). The same idea, implemented twice, one of
them wrong: which is the shape of debt this campaign is for.

The pattern in every one of these: **a decision was taken, partially
executed, and recorded as done.** The residue is invisible because nothing
states the intended end-state in a form the code can be checked against.

## 2. The deliverable — a definitional spine

*(Written `design/concepts.md` rather than root-anchored throughout: the
doc-reference lint requires a root-anchored `docs/…md` path to RESOLVE, and
this one is the thing being proposed. Same convention `implementation-map.md`
uses for the planned `allegretto/architecture.md`. It becomes a normal
root-anchored reference once S1 creates it.)*

A new Tier-1 document, `design/concepts.md` under `docs/`, that defines
every salient concept **in dependency order**, each entry in four parts:

| Part | What it holds |
|---|---|
| **Definition** | What the concept *is*, in one or two sentences, using only concepts defined ABOVE it |
| **Rationale** | Why it is this way; what it deliberately excludes; which decision (D-number / ruling) settled it |
| **As implemented** | Where it lives in `src/`, under what name(s), in what representation |
| **Delta** | The gap between the definition and the implementation — empty, or a named backlog item |

The **Delta** row is what makes this different from documentation we have
already. A spine entry with a non-empty delta is a defect report, and the
set of deltas IS the code campaign's work-list. It is also what keeps the
document honest: an entry is not finished when it reads well, it is
finished when its delta is either empty or owned.

### The ordering constraint is the quality filter

"Incremental definitions" is a real constraint, not a presentation
preference: **no entry may use a concept defined later.** If a concept
cannot be defined without forward reference, that is a finding about the
design, recorded as such — not a licence to write the entry anyway. Expect
this to fail somewhere around shape/knowledge/type, and expect that
failure to be informative.

### Where rationale lives

The spine holds the *definition* and the *short* rationale. The deep
treatment stays in the area docs (`structures.md`, `type-system.md`,
`effects.md`, …), which the spine links to. The spine is the thing a
reader — or an agent — reads first and completely; the area docs are
where they go next. Nothing is duplicated: if an area doc and the spine
disagree, that is a delta.

## 3. Method — derive from the code, then reconcile

The failure mode to avoid is writing the definitions we *believe* and
producing a second artifact that drifts from the code, which is exactly
the situation being corrected. So each entry is written in this order:

1. **Read the implementation first.** What does the code actually do?
2. **Write "As implemented"** from that reading, with file references.
3. **Then write Definition + Rationale** — what it *should* mean.
4. **Diff them.** Anything that does not match is a Delta, with evidence.

Where the reading is ambiguous, **measure** rather than assume. The B-104
audit established the technique and it should be standard here:
instrumenting `isMetaSlotKey` over the suite settled in one run a design
question that two rounds of reasoning had got wrong in both directions.

## 4. Scope — the concept inventory

Six tiers, ~28 clusters. Ordering is the dependency ladder; each tier may
use only what precedes it.

**T0 · Representation** — what a value is before anything is said about it
1. The representation kinds: Bits, Expression, Symbol, Param,
   ComposedFunction, PrimitiveFunction, Structure
2. `Value`; `ValueKind` as a **host discriminant**, not a type (D46)
3. The data plane; `dataOf`; what "the data of a value" means
4. Carrier / transparent structure (D46 option B)

**T1 · Structure and binding**
5. Structure — one kind, role fixed at construction
6. Binding — key, value, and its attributes (`visibility`, `cell`,
   `isComplete`, `incompleteDeps`)
7. Scope — chain layering, the facts plane, why scopes are values
8. The dense region — numeric-keyed structures, and the legacy map view

**T2 · Planes** *(the tier whose absence caused B-104)*
9. The four planes: data, binding, channel, host — what distinguishes
   them, and the rule for deciding which one a new thing belongs on
10. Channel — registration, propagation rule, writer capability (D21–D24)
11. Meta slot — what it is, why the prefix existed, and what replaces it

**T3 · Evaluation**
12. Partial evaluation as the compilation model; PE Rule 1 and Rule 2
13. Resolved / unresolved / residual
14. Tail calls and the TailCall sentinel
15. Future cells, completion, forward chaining (D33)
16. The `evalSource` pipeline — stage order and what each stage may assume

**T4 · Types**
17. Type; shape; meta-type; kind — and the difference between them
18. Member; member symbol; FQN identity (D20/D29)
19. **Shape vs knowledge** (D36) — the split, and why it is a read-time
    computation over one storage
20. Refinement; predicate; abstract domain
21. **Interface** — declaration-only, conformance by symbol membership,
    and *what `~Interface` is* ← the open `__interface` question lands here
22. Generic; applied concrete
23. `distinct`; structural wrap; the loose (base-name) world vs the
    declared world
24. Equality shape; coercion; law (E-R series)

**T5 · Obligations**
25. Effect; effect set; effect variable; the effects channel
26. Totality; divergence; `div` tiers; liveness (T-R series)
27. Proof; discharge; discharge tier (D34); obligation; verdict
28. Contract — `requires`/`ensures`; invariants as refinement layers
    (CT-R series)

Deliberately **out of scope**: grammar-2 internals (covered by
`grammar-formalism.md` and `extension/grammar.md`), PCP, the CLI, and the
website. Their concepts get spine entries only where a lower tier depends
on them.

## 4a. The long-term target — a formal model in Vivace

> Maintainer intent, recorded 2026-08 so the exercise builds toward it rather
> than needing rework.

The end state is a **formal software specification model**: logical
statements covering requirements, specification, implementation choices,
constraints and test cases, implemented in **Vivace**, with coverage,
traceability and correctness checks **automated**. That capability does not
exist yet, so the spine is prose for now — but prose written to become
machine-readable.

**What that implies for how entries are written, starting now:**

- **Traceability links must be data, not prose.** "Satisfies R3′, R12" in a
  fixed position is extractable; "this follows from what we said about
  metadata" is not. Every entry already carries an explicit Level line naming
  what it traces to — that is the seed of the relation the model will check.
- **Identifiers must be stable and unique.** R-numbers, SC-numbers,
  IC-numbers, entry numbers and B-numbers are the join keys. Renumbering is
  expensive later; S2b's SC/IC renumbering is recorded in place for exactly
  this reason.
- **The three orphan checks are the first automatable rule** (Part 0 §0):
  spec-without-requirement, implementation-without-spec,
  requirement-without-spec. All three are graph queries over the links above.
- **Test cases are a missing column.** The model wants requirement ↔ test
  traceability, and the spine currently records *code* fidelity (the Delta
  row) but not *test* coverage. A future entry format likely gains a
  **Verified by** row naming the tests that hold the entry. Not added yet —
  it would be guesswork before the tier is written — but the gap is recorded
  so it is not discovered late.
- **Cohesion findings are propositions.** §6's derivability results ("R11
  follows from R3 + R6") are exactly the logical statements the model is
  meant to hold. They are written as prose arguments now; they are the same
  content.

**What it does not imply.** The spine should not be contorted into pseudo-
formal notation ahead of the tooling. Regular structure and stable
identifiers are enough to make the later translation mechanical; premature
formalism would make it less readable now for no gain.

## 5. Chunk sequence (proposed)

Each chunk lands a tier of the spine PLUS the deltas it discovers, filed
but not fixed. Code changes come after, so that the definitions are not
being written to justify a rename already in flight.

| Chunk | Delivers |
|---|---|
| **S1** | ~~Spine skeleton + entry format + T0/T1~~ **DONE 2026-08** — `docs/design/concepts.md`, 17 entries, **9 deltas** raised (→ B-107, and three routed to T2). The format survives its own test: it produced defect reports on the tier we understand best, including one the ordering constraint forced into the open (carrier ↔ data plane are mutually referential in prose; broken by defining the carrier structurally and the data plane as the accessor over it) |
| **S2a** | ~~Part 0 · Foundations~~ **DONE 2026-08** (maintainer direction) — the requirement/specification/implementation stratification + the alternatives test + two-way traceability; requirements **R1–R7** (three from the maintainer, four surfaced here); the **implementation-choice register IC-1…IC-7** with alternatives, criterion and revisit trigger; every T0–T1 entry level-tagged. Finding: **4 of 17 entries were Implementation written as Specification**. Raised **B-108** (composite review) and the methodology proposal `conceptual-model-methodology-delta.md` |
| **S2b** | ~~Level split + requirement completion~~ **DONE 2026-08** — specification choices (SC-1…SC-6) separated from implementation choices (IC-1…IC-6) per maintainer ruling; **R8–R14** added; requirements gained a **subject**, which relocated *discharge* and the *knowledge lattice* to Allegro with weaker base counterparts; both standing objections (propagation vs R6, integrity vs externalisation) answered and found to be **implementation violations** → **B-109**. Cohesion explicitly deferred with a stated method |
| **S2c** | ~~Requirement-set cohesion~~ **DONE 2026-08** — all three checks found something. **7 of 14** requirements do not survive as requirements (derived, conflated, or not requirements at all); **2** real conflicts, including R4 stating something the base contradicts 117 times; **3** capabilities Allegro needs that nothing enables (candidates R15–R17: program-level aggregation, determinism, the host boundary). Two method amendments fed back into the methodology proposal |
| **S2d** | ~~Abort classification + metadata merge~~ **DONE 2026-08** (maintainer corrections) — S2c's "R4 was over-broad" **overturned**: inconsistency is not evidence of a different requirement. Every base abort classified into six classes → candidates **R18/R19/R20**; one class is **rework**, not specification — the L0 evaluator implements L2 type checking (27 upward imports; `checkArgType` in `evaluator.ts`) → **B-110**. R3/R5/R11/R13 merged into **R3′** (non-interference); the fixed propagation vocabulary kept as **SC-7** because R12 is enforceable only over inspectable rules |
| **S2e** | ~~T2 planes~~ **DONE 2026-08**, absorbing **B-110** per maintainer ruling — the four planes and the placement rule, channel, propagation (SC-7), writer capability, meta slot, and **§23 the layer boundary**. Six deltas. S1's "three entries are the same undeclared-plane gap" becomes four named defects plus the L0→L2 dependency, which is not a new problem but §18's rule unapplied to one subsystem |
| **S2f** | ~~T3 evaluation~~ **DONE 2026-08** — PE Rules 1/2, resolved/residual, tail calls, future cells and completion, the `evalSource` pipeline. Plus two maintainer items: the **metadata / field / channel** terminology (§19/§19b — which immediately exposed that the registry holds five different kinds of thing under one word, → B-111) and **plane interfaces elevated to a first-class entry** (§24 — four hooks owed, → B-112). T3's own finding: §29, the L2 post-passes are hardcoded into the base pipeline — §23's violation in its other form |
| **S3** | ~~T4 types~~ **DONE 2026-08** — type, kind/meta-type, shape, member+symbol, knowledge, refinement, **interface**, generic, identity (distinct / structural wrap / equality shape), law+coercion. Six deltas, one of them a **resolution**: §36 defines "interface" precisely enough that `~Printable` follows from the definition rather than being ruled, and the derivation names exactly what changes → **B-104(g) specified**. Also caught the two maintainer corrections: `dataOf` is a HOST interface (Allegro code has none — a value *is* its data), and the engine/meta-slot interface row does not vanish with `__length` but should shrink to zero as D39's 14 member-dispositioned slots land |
| **S3b** | ~~T4 corrections~~ **DONE 2026-08** (maintainer questions) — the **interface definition** rewritten (neither "has no construct" nor "all members signature-only"; two properties enforced in two places, neither being the concept — and Allegro has **no abstract types** because D44 removed what abstractness is defined against) → **B-116**; **§33b declared vs loose conformance** added, a term the document had used six times undefined; the marker measurement re-run across all **three** readers rather than one |
| **S4** | ~~T5 obligations~~ **DONE 2026-08** — effect, declared/inferred effects, totality, divergence + D34 tiers, proof and discharge, **obligation/verdict/ledger**, contract. Six deltas. Two are the same defects T2/T3 already found, reached from a different direction; two are new and load-bearing: **§45** gives sufficiency gap S1 a named consumer (the verdict is program-level and no requirement enables it → **R15**), and **§46** makes CT-R6 measurable — `pcp.ts` has **zero** occurrences of contract/requires/ensures, so a clean verdict can coexist with unproven preconditions. Three maintainer questions parked as Allegro design questions that do not change Allegretto's requirements |
| **S4b** | ~~S4 review corrections~~ **DONE 2026-08** (maintainer) — **R15 withdrawn** (the verdict should be accumulated metadata, not a new requirement → **B-117**); §36's nameless-interface assumption shown to be unenforced *and falsified by the proposed change itself*; §32 corrected (refinements MAY add behaviour — `NonEmptyList.head`); §37 widened to value-parameterised generics; **§34b abstract domain** added, the second undefined term in two rounds |
| **S5** | ~~Delta triage~~ **DONE 2026-08** — §9. All **34** deltas owned, clustered by *fix* rather than by symptom, and ordered into **C1…C13** with interfaces first per maintainer ratification. Auditing the table found five things a transcription would not have: one **orphan** (delta 7 owned by a spine section), one **stale** row (candidate R15, withdrawn at S4b), four deltas under three owners that are **one fix** (→ **B-118**: host-plane data that should be metadata fields), **B-108's "blocks nothing" is false** (it gates the last dunder), and **§6 ruling 3's pulled-forward naming chunk never ran** — recorded rather than re-planned, since a decision partially executed and recorded done is the campaign's own subject matter |
| **C1…Cn** | The code campaign itself, one chunk per delta cluster, gated normally |

**S1 is the falsifiable one.** If the four-part entry format does not
produce useful deltas on the tier we understand best, the format is wrong
and should change before it is applied 28 times.

## 6. Rulings needed before S1

1. **Location and shape.** One `design/concepts.md` (recommended —
   the ordering constraint only bites if the entries are in one sequence),
   or per-layer concept sections under the existing tree?
2. **Does the spine outrank the area docs** when they disagree, or is a
   disagreement always a delta to be resolved rather than a precedence
   question? (Recommend: always a delta; no precedence rule, because a
   precedence rule lets one of them stay wrong.)
3. **Naming campaign scope.** RULED (maintainer, 2026-08): **pulled
   forward** as its own chunk, ahead of the S5 triage — it is independent
   of every definition and makes reading the code during S2–S4 easier — and
   **extended to the other clear cases**, not just the type name. In scope:
   `ContextValue` → `StructureValue` (~701 sites), `makeContext` →
   `makeStructure` (~101), and the `MultiValue*` residue D46 retired
   (`MultiValueType`, `makeMultiValue`, ~25+). "Clear" means: the decision
   is already ratified and executed in the runtime, and only the surface
   name lags. Anything where the right name is still an open question waits
   for its spine entry.
4. **`~Printable`** — HELD (maintainer, 2026-08). Not ruled here. It is a
   **delta in the ruling-2 sense**: `applyBoundaryBound` and
   `shapeAwareSubtypeof` disagree about whether a wrapped interface is an
   interface, and the disagreement is to be resolved *by* the T4 §21
   definition, not ahead of it. B-104(g) therefore stays open through S3,
   and the deliberate consequence is that no code changes on this question
   until the definition exists to justify the change. The zero suite
   coverage on that path (§7) is recorded as its own delta and can be
   closed independently — a test pinning today's behaviour is not a ruling
   on tomorrow's.

## 7. Deltas already in hand

Recorded now so S5 does not have to rediscover them.

| Delta | Evidence |
|---|---|
| `ContextValue` (701) vs `StructureValue` (2); `makeContext`, no `makeStructure` | D1/D46 recorded executed; naming done by alias only |
| `MultiValueType` (25 uses) survives D46's retirement of the MultiValue kind | `src/types.ts:190` |
| `__*` prefix carried a partition that had ceased to exist | B-104; instrumented — 1 key of 21 across 1197 tests |
| `__interface` and the meta-type disagree about `~Printable` | B-104(g); probed directly |
| `applyBoundaryBound`'s interface guard has **zero** suite coverage | Instrumented: 0 hits in 1197 tests; fires immediately on a written case |
| The `shapeAwareSubtypeof` interface check is redundant with its name check | Instrumented: 42 interface encounters, 0 decisive |
| 93 of 136 exported concepts undefined in `docs/design/` | Measured, bare forms allowed |
| No evaluator or partial-evaluation design doc exists | `implementation-map.md` calls `allegretto/architecture.md` "planned" |
| `doc-ref-lint` scanned TRACKED files only, so a new doc's references were invisible until after commit | Found by this plan's own CI failure — a local run passed, CI did not. Fixed here; the boundary lint had already made the opposite (correct) call for `src/` |

## 8. What this plan is not

It is not a rewrite. The conceptual design is sound — the tests are the
evidence for that, and no delta above is a claim that Allegro is wrong.
Every one is a claim that Allegro is **undocumented or misnamed**, which
is a different and much cheaper problem. The campaign's success condition
is that a reader can predict the code from the spine, and find the spine
from the code.

## 9. The delta triage (S5)

The code campaign's plan, produced from the deltas rather than guessed.
Input: the **34** distinct deltas recorded across 49 spine entries (16 are
clean). Output: every delta owned by a work item, every item placed in a
chunk, every chunk with a stated dependency and a falsifiable completion
test.

### 9.1 What auditing the delta table found

Five things — which is why triage is a chunk and not a transcription.

1. **One orphan.** Delta 7 was owned by "T2 §9" — a spine section, not a
   work item, recorded when T2 did not exist yet. T2 has since landed, §18
   declares the host plane, and the delta is still open with nobody holding
   it.
2. **Four deltas, three owners, one fix.** Deltas 7, 34b, 39 and 41 all say
   the same sentence about different subjects: *X rides the host plane, and
   §18's placement rule says it belongs on the metadata plane* — the
   inferred effect set, the abstract domain, ComposedFunction's analysis
   expandos, the transitive law backings. They were filed against B-107
   (naming debt), B-111 (registry split) and B-115 (two carriers), and none
   of those three is the fix. Minted as **B-118**. The distinction that
   makes it a cluster rather than a coincidence: deltas 15 and 18 are
   host-plane data *correctly placed and wrongly declared*; these four are
   *wrongly placed*. With the planes undeclared the two were indistinguishable.
3. **One stale row.** Delta 45 appeared twice — once owned by "candidate
   R15", once by B-117. R15 was withdrawn at S4b; the row is deleted.
4. **B-108 does not "block nothing".** Its own text says it does. But
   B-104(f) is `__length` and the legacy view, and B-108's option E dissolves
   both — so whether B-104(f) means *re-key `__length`* or *delete
   `__length`* is decided by B-108's ruling. **B-108 gates the retirement of
   the last dunder**, which makes it the highest-leverage unruled question
   in the set.
5. **A ratified chunk that never ran.** §6 ruling 3 pulled the naming
   campaign forward "as its own chunk, ahead of the S5 triage". S2a–S4b ran
   instead; it did not. Its stated justification — easier reading of the code
   *during* S2–S4 — has expired, so its placement takes a fresh ruling
   (§9.5) rather than inheriting the old one. Recorded rather than quietly
   re-planned: *a decision taken, partially executed, and recorded as done*
   is the exact defect this campaign exists to remove, and the campaign is
   not exempt from it.

### 9.2 The clusters

Every delta, once, in the group its **fix** belongs to — not the group its
symptom appeared in.

| Cluster | Deltas | Items |
|---|---|---|
| **I · The plane interfaces** | 19, 19b, 21, 24, 32, 34 | B-111, B-112, B-109 |
| **II · The layer boundary** | 23, 29, 42 | B-110 |
| **III · Plane placement** | 7, 34b, 39, 41 | **B-118** (new), B-115 |
| **IV · The Interface type** | 33b, 36(a), 36(b) | B-104(g), B-116 |
| **V · Naming and declaration** | 2, 5, 9, 10, 12, 13, 15, 18, 30, 37 | B-107 |
| **VI · The composite** | 17, 22 | B-108 → B-104(b)(f) |
| **VII · Accumulation** | 44, 45, 46 | B-117, B-057 |
| **VIII · Unheld guarantees** | 27, 28, 43 | B-113, B-114, B-100 |

Ten of thirty-four are naming and declaration; the other twenty-four are
structural, and **thirteen of those are one root** — the plane boundary has
no interfaces, so everything that needed to cross it went around (I, II, III).

### 9.3 The order

Interfaces first, ratified by the maintainer (2026-08): *"they're the best
way for my inner-architect to sense if the system is moving in the right
direction."*

| Chunk | Closes | Needs | Why here |
|---|---|---|---|
| **C1** | B-111 | — | **Field vs channel.** Structure and nomenclature only, no behaviour: the registry stops calling five kinds of thing by one word. Everything after it registers *something*, so it goes first. It also does the reclassifying the later chunks consume — `shape` → a projection (C4), `knowledge` → a capability with no field, `exported` → deletable (retired at B-097), `warnings` → the field C10 reaches for |
| **C2** | B-112(d), B-109(b)(c) | C1 | **Registration as an interface**, and integrity read from the registered flag instead of `INTEGRITY_CHANNEL_NAMES`. The integrity half is small and belongs here rather than later: protection-by-name is precisely the form that cannot survive C3 |
| **C3** | B-109(a) | C2 | **Registration moves to the owning layers** — eleven registrations out of `slots.ts`, following the `installChannelMerge` template that already works once. R6's fix, and the first chunk where the layering is *visible*: the base stops naming L2 concepts |
| **C4** | B-112(c) | C1 | **The projection hook** — `shape` installed rather than hardcoded in `channelReadRaw`. Independent of C2/C3; sequenced after C1 only because C1 is what says `shape` is a projection and not a field |
| **C5** | B-112(a)(b) | C3 | **Dispatch and check hooks.** The two large ones, and the point at which the base can dispatch on a type without knowing what a type is |
| **C6** | B-110(a)(b)(c), deltas 29/42 | C5 | **The layer boundary.** `checkArgType` and the 27 upward imports move; the L2 post-passes stop being hardcoded into the base pipeline. The campaign's largest chunk, and last of the interface run because it is the *consumer* of all four hooks |
| **C6b** | B-110(d) | — | **One exception class for six abort classes.** Specification-level and separable; runs any time after `concepts.md` §7's vocabulary is ratified |
| **C7** | B-118, B-115 | C3 | **Plane placement.** The four wrongly-placed carriers become metadata fields. Needs C3, because "a layer registers its own channel" is what gives them a field to move to — and unifying law backings onto one carrier is B-115's answer rather than a separate one |
| **C8** | B-104(g), B-116 | — | **The Interface type.** Independent of C1–C7 and fully specified by §36: write the missing test for `applyBoundaryBound`'s zero-covered guard *first*, then drop the marker check in `shapeAwareSubtypeof` **and do not replace it**, read the meta-type in `applyBoundaryBound`, delete `__interface` (10 sites) |
| **C9** | B-107 | ruling §9.5(2) | **Naming and declaration debt.** ~830 mechanical sites plus five declaration fixes |
| **C10** | B-117, then B-057 | C5 | **Accumulation.** `buildVerdict` reads accumulated metadata instead of walking `evalCtx.bindings`; contracts get a `union` field and reach the verdict for free rather than by a new case |
| **C11** | B-113, B-114 | — | **Guarantees held by convention become held by construction or by a test** — TailCall forwarding, completion confluence. Independent |
| **C12** | B-104(b)(f), B-105 | B-108 ruled | **The composite**: the last dunder, and union types. Blocked on a ruling, not on code |
| **C13** | B-100, B-102, B-103 | — | Residue: the T-R6 soundness review and two tooling items |

**Serial by necessity, not by preference.** C1–C7 all converge on
`src/slots.ts`, `src/evaluator.ts` and `src/types-std.ts` — the same
convergence that made the backlog's band D *"internally serial,
permanently"*. C6b, C8, C11 and C13 touch none of those and can run in any
lane. C9 touches every file the campaign touches, which is why its placement
is a ruling and not a preference.

**Nothing here is a redesign.** Every chunk moves a mechanism that already
works to the side of a boundary that already exists. The one chunk that
changes a language-visible answer is C8, and it changes it to the answer the
maintainer already ruled — the difference being that it is now derivable
from §36 rather than asserted.

### 9.4 The completion test

The methodology proposal's §8 says a decision may not be marked executed on a
partial execution, and that a rename carries a count. Applied to this
campaign:

- **A chunk is done when the spine delta rows it claims read `—`.** Not when
  the code lands: when the document that motivated it no longer records a
  gap. One table, mechanically checkable, and it is the reason the delta
  rows were written as defect reports rather than caveats.
- **A chunk that closes a delta by editing the definition rather than the
  code must say so and re-derive the entry.** That is a legitimate outcome —
  §36 was one — but it is never the default and must never be silent.
- **C9 carries counts as its completion test**, per §8: `ContextValue`
  701 → 0, `makeContext` 104 → 0, `MultiValueType` 25 → 0. This is the
  falsifiable form D1 and D46 lacked, which is how they came to be recorded
  executed while unexecuted.

### 9.5 Rulings needed before C1

1. **Which interfaces?** Read as the **plane** interfaces (B-112) — C1–C6.
   The other reading, the **Interface type** (C8), is a real cluster, is
   fully specified, and is independent of everything else; if that is what
   was meant, C8 moves to the front at no cost to any other chunk. Recorded
   rather than assumed, because the two readings do not conflict.
2. **Where does C9 go?** Recommendation: **first, ahead of C1**, as a single
   mechanical commit with counts as its test. Against: it is not a design
   chunk, and it delays the first architectural signal by one review. For,
   and this is the deciding argument: the campaign's success condition is
   that the code says what the spine says, so authoring C1–C8 in a
   vocabulary the spine calls wrong is *deliberately created* debt that every
   later chunk then pays for. The alternative is last, never in the middle.
3. **B-108, the composite.** It is a ruling, not code, it can be taken at any
   time, and it gates C12 — including the retirement of the last dunder. Its
   "blocks nothing" line is now wrong and is corrected in the backlog.
4. **Is "accumulate toward the verdict" a fifth plane interface?** Raised by
   B-117 and undisputed at S4b. Recommendation: decide at **C5's gate**, when
   the hook shape is concrete rather than sketched — if the answer is yes it
   belongs in C5, and C10 becomes its first consumer.
