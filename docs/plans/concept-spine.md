# Concept spine — define Allegro, then make the code say it

> Status: **active** — ratified 2026-08 (§6 rulings 1–3; ruling 4
> deliberately HELD as a delta for S3). **S1 + S2a + S2b landed**; S2c (cohesion) next.
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

## 5. Chunk sequence (proposed)

Each chunk lands a tier of the spine PLUS the deltas it discovers, filed
but not fixed. Code changes come after, so that the definitions are not
being written to justify a rename already in flight.

| Chunk | Delivers |
|---|---|
| **S1** | ~~Spine skeleton + entry format + T0/T1~~ **DONE 2026-08** — `docs/design/concepts.md`, 17 entries, **9 deltas** raised (→ B-107, and three routed to T2). The format survives its own test: it produced defect reports on the tier we understand best, including one the ordering constraint forced into the open (carrier ↔ data plane are mutually referential in prose; broken by defining the carrier structurally and the data plane as the accessor over it) |
| **S2a** | ~~Part 0 · Foundations~~ **DONE 2026-08** (maintainer direction) — the requirement/specification/implementation stratification + the alternatives test + two-way traceability; requirements **R1–R7** (three from the maintainer, four surfaced here); the **implementation-choice register IC-1…IC-7** with alternatives, criterion and revisit trigger; every T0–T1 entry level-tagged. Finding: **4 of 17 entries were Implementation written as Specification**. Raised **B-108** (composite review) and the methodology proposal `conceptual-model-methodology-delta.md` |
| **S2b** | ~~Level split + requirement completion~~ **DONE 2026-08** — specification choices (SC-1…SC-6) separated from implementation choices (IC-1…IC-6) per maintainer ruling; **R8–R14** added; requirements gained a **subject**, which relocated *discharge* and the *knowledge lattice* to Allegro with weaker base counterparts; both standing objections (propagation vs R6, integrity vs externalisation) answered and found to be **implementation violations** → **B-109**. Cohesion explicitly deferred with a stated method |
| **S2c** | Requirement-set cohesion: derivability, pairwise conflict, and sufficiency. The last is the only falsification of the set as a whole |
| **S2** | T2 planes + T3 evaluation. The planes tier is the highest-value entry in the document |
| **S3** | T4 types. Expect the most deltas here, and the `~Interface` definition |
| **S4** | T5 obligations. Mostly reconciliation — the R-series rulings already carry rationale, so this is largely relocation and delta-hunting |
| **S5** | Delta triage: every delta from S1–S4 becomes a backlog item, ordered. This is the code campaign's plan, produced as evidence rather than guessed |
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
