# Concepts — the definitional spine

> Tier 1. The document a reader (or an agent) reads **first and completely**.
> Every salient Allegro concept, defined in dependency order. The area docs
> (`allegretto/structures.md`, `standard/type-system.md`, …) are where the
> deep treatment lives; this is what makes them legible.
>
> Plan: `docs/plans/concept-spine.md`. Status: **Part 0 + T0–T5 written**
> (the concept-spine plan's chunks, all landed); Part 0 revised 2026-10-20 to the entry
> shape, its analysis passes moved to `docs/records/concepts-analyses.md` (the record).
> Status tags per `README.md`.
>
> **Start at Part 0.** It separates *requirement* from *specification* from
> *implementation*, which is the distinction whose absence caused most of the
> deltas this document records.

## How to read this

Each entry has four parts, and the last one is the point:

| Part | What it holds |
|---|---|
| **Level** | Requirement, Specification, or Implementation (Part 0 §0) — and what it traces up to |
| **Definition** | What the concept *is* — using only concepts defined **above** it |
| **Rationale** | Why it is this way; what it excludes; which decision settled it |
| **As implemented** | Where it lives in `src/`, under what name, in what form |
| **Delta** | The gap between the two. `—` means none. Anything else is a defect |

A **Delta** is a defect report, not a caveat. An entry is finished when its
delta is empty or owned by a backlog item — never merely because it reads
well. This is the property that keeps the document from drifting into what
we wish were true, which is the failure it exists to correct.

### The ordering constraint

**No entry may use a concept defined later.** This is a design check, not a
presentation preference: a concept that cannot be defined without a forward
reference is telling you something about the design, and that is recorded
where it happens rather than written around.

### Reading the entries against the code

Entries are written **implementation-first**: the code was read, *As
implemented* written from that reading, and only then the definition. Where
the reading was ambiguous it was **measured** — instrumenting the running
suite — rather than inferred. Numbers in this document come from such runs.

---

# Part 0 · Foundations

Everything below T0 rests on this part. It separates three kinds of
statement (§0), then holds the model's foundations in three registers:
requirements (§1), specification choices (§2) and implementation choices
(§3). §4 states what the set's status is and what it does not yet cover.

Every entry here follows the four-part shape the header promises (Level,
Definition, Rationale, As implemented, Delta). The analysis passes that
produced the current set, and the rulings that measured the implementation
choices, are history: they live verbatim in `docs/records/concepts-analyses.md` (the
record) and are cited from here, never restated.

*Revised 2026-10-20* (`docs/documentation-census.md`): Part 0 previously
mixed the model with its own analyses, its foundations lacked the entry
shape, and a reader could not tell which requirements were live.

## 0. The three levels

Every statement in this document is exactly one of:

| Level | What it is | How it is falsified | How many alternatives |
|---|---|---|---|
| **Requirement** | Something that must be true for Allegro to be buildable at all | Show Allegro can be built without it, or cannot be built with it | **None.** A requirement with alternatives is a specification |
| **Specification** | The contract Allegretto commits to, satisfying some requirement | Show it fails to satisfy the requirement it claims | **Few**, and they are visible |
| **Implementation** | How the host currently realises the specification | Show it violates the specification, or is dominated on the criterion that selected it | **Many.** Replaceable without telling anyone |

**The alternatives test.** If you can list plausible alternatives to
something you called a requirement, it is not a requirement. If you cannot
list any alternative to something you called an implementation choice, it is
probably specification. Applying this test is cheap and it catches the error
this part exists to prevent.

**Traceability, both directions.** Every specification item names the
requirement it satisfies; every implementation choice names the specification
item it realises. An orphan in either direction is a finding:

- A specification item satisfying no requirement is **unjustified**.
- An implementation choice realising no specification item is
  **unconstrained**: nothing would tell you if it changed.
- A requirement with no specification item is **unmet**, or met implicitly,
  which is worse.

This is the consistency check (a); the per-entry **Delta** is the
code-fidelity check (b). A model needs both, and they fail differently: the
cohesion pass (record §2) found things the Delta check could not, because it
compares statements to each other rather than to the code.

## 1. Requirements

> **Level: Requirement.** *Subject: Allegretto* unless stated. **Status of
> the set: proposed, in use, not ratified.** Fourteen were proposed in
> 2026-08; the cohesion pass (record §2) and the merge taken at plan chunk
> S2d (record §4)
> reduced them to the eight live requirements below plus one criterion, one
> derived statement and five candidates. Every entry in T0 to T5 cites this
> set. Ratification as a set is a maintainer ruling that has not been taken;
> until it is, each entry's status column is the truth.

### 1.0 The set at a glance

| ID | Statement | Status | Decided where |
|---|---|---|---|
| **R1** | Allegretto is the simplest base that can carry Allegro | **criterion**, not a requirement | record §2.1 F5 |
| **R2** | Partial evaluation is the mechanism by which layers are added | **live** | — |
| **R3** | Metadata channels are independent | **live** (proposed at the S2d merge) | record §4.1 |
| **R4** | Evaluation is total over unresolved information | **live**; aborts specified separately (SC-8) | record §3.3 |
| **R6** | The base does not know about the layers | **live** | — |
| R7 | Allegretto is replaceable | the **sufficiency claim**, not a requirement | record §2.1 F1 |
| **R8** | There is one value universe | **live**; derives from R1 + R9, not R4 | record §2.1 F6 |
| **R9** | The language surface is extensible | **live** | — |
| R10 | Evaluation is resumable on new information | **derived** from R2 + R14; kept as a named consequence | record §2.1 F7 |
| **R12** | Metadata origination is capability-controlled | **live** | — |
| **R14** | Code is organised into separately-loadable units | **live** | — |
| R16 | Evaluation is deterministic | **candidate** | record §2.3 S2; §28; B-114 |
| R17 | The host boundary is a stated surface | **candidate** | record §2.3 S3; B-141 |
| R18 | Resource bounds are specified | **candidate** | record §3, abort class D |
| R19 | Planes are separated | **candidate** | record §3, abort class B |
| R20 | An ill-formed application is rejected | **candidate** | record §3, abort class F |

<a id="def-r1"></a>
### R1 — Allegretto is the simplest base language that can carry Allegro

**Level.** Criterion (relabelled from requirement at the cohesion pass,
record §2.1 F5: a purpose plus a criterion cannot be violated by an
implementation, so it fails §0's test).

**Definition.** Allegretto exists to be the substrate Allegro Standard is
built on, as an extension stack rather than a privileged layer. Every feature
must earn its place by being something Allegro cannot be built without.

**Rationale.** This is the criterion that adjudicates every trade in §2 and
§3: "would Allegro still work without this?" is a legitimate challenge to any
part of Allegretto, answerable with evidence. It is the most useful sentence
in the document and the least like a requirement.

**As implemented.** The base primitive surface is about forty primitives
(`allegretto/structures.md` §11); the kind set is seven (SC-1).

**Delta.** —

<a id="def-r2"></a>
### R2 — Partial evaluation is the mechanism by which layers are added

**Level.** Requirement.

**Definition.** Types, effects, proofs, refinements, contracts and error
handling are built on the base, and the tool that makes that possible is
partial evaluation: a program is evaluated as far as its known inputs allow,
and what cannot be resolved becomes a residual that is itself an ordinary
value. Checking is not a separate pass over a separate IR; it is evaluation
that ran far enough to answer, and discharge is the same act as computing.

**Rationale.** VISION §1 and §2: provability as PE-as-discharge.

**As implemented.** `src/evaluator.ts`, PE Rule 1 (unresolved argument
produces a residual with propagated metadata) and Rule 2 (lazy primitives
with unresolved control evaluate both branches); `precompileFunction` runs
the same evaluator at compile time. §25 (partial evaluation).

**Delta.** The evaluator also performs type checking the layer should
install (R6's delta); that is R6's finding, not R2's.

<a id="def-r3"></a>
### R3 — Metadata channels are independent

**Level.** Requirement, proposed at plan chunk S2d (record §4.1), where
four earlier statements about metadata were merged into this one. In use
by every T2 to T5 entry. The identifiers that merge removed are logged in
`docs/book-changes.md`.

**Definition.** A value may carry named information about itself. Each
channel's handling is independent of every other: an operation's treatment
of one channel may not depend on which other channels are present, and no
operation may disturb a channel it does not know about. How a channel is
handled is determined by that channel's own declaration, not by the
operation.

**Rationale.** Without this, every layer would thread its own information
through every operation by hand, and layers would not compose. The
non-interference clause is what a survival-only statement could not say: under a `drop`
rule nothing survives by design, and what matters is that no operation
drops a channel it has never heard of. Where channels are stored (on the
value or in a side table) is a specification choice, not part of the
requirement (record §2.1 F4).

**As implemented.** The metadata plane (§18), fields with declared rules
(§19, §20), the propagation table in `src/metadata.ts` applied by the evaluator
without reading field meaning.

**Delta.** Three registrations have no owner (`knowledge`, `warnings`,
`exported`; `allegretto/metadata-and-capability.md` §3; **B-111**, field
versus channel registration), and the propagation table is applied by two
evaluator paths that are not yet one mechanism (its §5; **B-112**, the
four owed plane interfaces).

<a id="def-r4"></a>
### R4 — Evaluation is total over unresolved information

**Level.** Requirement.

**Definition.** The evaluator has a rule for every value it can meet. An
unresolved input produces a residual, never a failure to proceed.

**Rationale.** R2 depends on this completely. If evaluation could get stuck,
a program could fail to compile because it could not be run, and the
compile/run distinction Allegro dissolves would come back.

**Scope.** This requirement is about unresolved information only. Aborts
(an interpreter assertion, a capability denial, a depth bound, an ill-formed
application) are not "getting stuck"; they are specified separately (SC-8)
under their own candidate requirements. A first draft of the cohesion pass read the
base's 117 throws as evidence that R4 was over-broad; the maintainer
corrected that at S2d: inconsistent behaviour is evidence of inconsistency,
not of a different requirement (record §2.2 C4, §3.3).

**As implemented.** `evaluate` in `src/evaluator.ts` returns a residual for
an unresolved Symbol, Param or Expression; the forward-chaining loop
re-evaluates on completion (§28).

**Delta.** Class E of the abort classification (type errors thrown by the
base) is not a violation of this requirement but of R6 (the base does not
know about the layers; record §3.1); it is the subject of B-112 (the four
owed plane interfaces).

<a id="def-r6"></a>
### R6 — The base does not know about the layers

**Level.** Requirement.

**Definition.** No concept belonging to Allegro Standard (type, effect,
proof, refinement, contract) may appear in Allegretto. Dependencies point
downward only.

**Rationale.** This is what makes Allegro a curated extension stack rather
than a privileged layer, and therefore what makes the platform programmable
by anyone else. Stated about concepts, not mechanism: Allegretto provides
the metadata plane; it must not know that one field is called `type`.

**As implemented.** `docs/book/layers.md` §1 states the rule;
`docs/book/units.md` §4 states it at unit grain and
`scripts/analyze/index.ts units` measures it.

**Delta.** Violated today in three places, each owned: the evaluator
imports 27 symbols from L2 and implements type checking (record §3.1;
**B-112**, with `units.md` misalignment M11 (the evaluator holds Type-system activities)); the base registered eleven L2 field names
at module init and special-cases three by name (record §1.1; **B-109**, the registrations moved to their owners; `src/capability.ts` holds the base's own).
The third, `scope.ts` importing the predicate-set merge (`units.md` misalignment M12 (the scope imports `refinements`)), closed at B-112 chunk C1: the scope applies an installed facts merge (hook (e)).

<a id="def-r8"></a>
### R8 — There is one value universe

**Level.** Requirement. Derivation corrected at the cohesion pass (record
§2.1, finding F6): it follows from R1 (the simplicity criterion) and
R9 (the language surface is extensible), not from R4 (evaluation is total).

**Definition.** Everything the evaluator can meet is a Value. There is no
second category: no statement, declaration, or type that is not itself a
value.

**Rationale.** Allegro is built as an extension stack, and an extension
cannot produce a language construct that is not a value. R4's totality is
then meaningful over one space. What the value kinds are is a separate,
weaker question (SC-1).

**As implemented.** `type Value` in `src/types.ts` (the closed union;
D51 (`Value` as a contract, seven kinds and an assembly) splits it so).

**Delta.** The evaluation environment was a Value by SC-6 (scopes are
values) and is ruled out
of the universe by D49 (SC-6's delta). R8 is unaffected: a scope was never
something the evaluator *meets* as an input.

<a id="def-r9"></a>
### R9 — The language surface is extensible

**Level.** Requirement.

**Definition.** Syntax is not fixed in the base. A grammar is a value, and
extensions contribute to it, so Allegro's surface is built rather than
privileged.

**Rationale.** R1 says Allegro is built on Allegretto; without R9 that would
be true of semantics and false of syntax, and Allegro's notation would be a
kernel feature no other stack could have.

**As implemented.** `docs/book/grammar-formalism.md`; `src/grammar2/`
(`fragments.ts` merges `grammar { … }` blocks at `use` time).

**Delta.** —

<a id="def-r10"></a>
### R10 — Evaluation is resumable on new information

**Level.** Derived (record §2.1 F7): loading is late arrival (R14) and R2
already says evaluation proceeds as far as inputs allow. Kept as a named
consequence because the async case is the one the code was bitten by.

**Definition.** Information may arrive after evaluation has begun: a module
load, an async result. When it does, whatever depended on it re-evaluates. A
value may be pending, and pending is not failure.

**Rationale.** Without it, PE would be a single pass and anything not known
at that instant would be permanently residual.

**As implemented.** Future cells and the completion cascade (§28;
`src/futures.ts`, `applyPhase` in `src/runtime.ts`).

**Delta.** Arrival order is not guaranteed not to matter: candidate
R16 (determinism) and **B-114** (completion confluence is not guaranteed
by construction).

<a id="def-r12"></a>
### R12 — Metadata origination is capability-controlled

**Level.** Requirement. *Subject: Allegretto for the mechanism; Allegro for
the policy.*

**Definition.** A channel carrying authority (that a proof discharged, that
a value came from a recorded source) must be unforgeable by code that does
not hold its writer. Authority is a capability, not a name.

**Rationale.** Metadata that anything can write cannot be evidence. This is
also what makes declared propagation safe: externalising registration would
be a counterfeit vector if trust were carried by naming a channel, and is
not if trust is carried by holding the closure that writes it. Which
channels need protection is a layer decision, so the base must not enumerate
them.

**As implemented.** Writer capabilities (§21; D23 (writes are gated and
reads free) and D24 (the capability is a delegable closure)); one-shot
registration; the fixed propagation vocabulary (SC-7) exists so that
fabricating rules on integrity fields are a decidable subset (record §4.2).

**Delta.** —

<a id="def-r14"></a>
### R14 — Code is organised into separately-loadable units

**Level.** Requirement.

**Definition.** A program may be assembled from units loaded independently,
with control over what each unit exposes. `use` and `import` are a surface
for this; the requirement is the unit and its visibility boundary, not the
keyword.

**Rationale.** R10's "information arrives later" has loading as its
principal case, and the visibility boundary is what makes a unit's internals
refactorable.

**As implemented.** `src/modules.ts` (loader), `src/use-scanner.ts`; export
partition and visibility at B-097 (the mediated-member arc: D41 (the
member protocol), D42 (evidence is possession), D43 (modifiers are
declared attributes)).

**Delta.** The L1 loading half and the L2 module-object half share one file
and no ruling enforces the split: **B-138** (the unenforced L1/L2 module
ruling).

### Candidates R16 to R20

Each is a requirement the set needs and does not state. None is ratified;
each has an owner or a specification waiting on it.

| ID | Statement | Why it is needed | Owner |
|---|---|---|---|
| **R16** | Same source and same inputs give the same residual | PE-as-compilation needs reproducible builds and re-checkable proofs; the B-028 arc hit an arrival-order non-confluence bug | §28; **B-114** |
| **R17** | The host boundary is a stated surface: which primitives reach the host, with what effect labels | Primitives perform I/O and call the host; SC-1's PrimitiveFunction kind has no requirement above it | **B-141** (the Environment interface) |
| **R18** | The host may impose resource bounds, and a bound hit is distinguishable from unresolved information | The evaluation-depth guard exists and has no requirement; it must be stated together with R4 | SC-8 class D |
| **R19** | A scope is not data and data is not a scope | The plane separation is asserted in prose and enforced by throw | SC-8 class B; executed by D49 / **B-136** |
| **R20** | The base may reject an ill-formed application | The bulk of the base's 99 primitive argument errors | SC-8 class F |

### Layer requirements that are not base requirements

Two items raised as candidate requirements belong to Allegro, and their base
counterparts are strictly weaker. Conflating them is what produces apparent
R6 violations.

| Allegro requirement | Its Allegretto counterpart |
|---|---|
| **Discharge**: an obligation is discharged by evaluating it, and what did not discharge remains visible as a stated obligation | **R2 + R4**: evaluation runs as far as it can and yields a residual otherwise. The base knows nothing of "obligation" |
| **Knowledge lattice**: one monotonic lattice over imputed bound, domains and predicates, meeting at each use | **R3 + SC-7's `union`**: channels can carry mergeable information. The base supplies merge; the lattice is the layer's |

## 2. Specification choices

> **Level: Specification.** These have alternatives, but the alternatives
> are visible to Allegro: changing one changes what the layers above are
> written against. That is what separates them from §3. Each entry records
> the alternatives, the criterion that selected one, what the code does,
> and the delta.

### SC-1 — Seven representation kinds

**Level.** Specification; satisfies R8, R1.

**Definition.** Bits, Symbol, Param, Expression, ComposedFunction,
PrimitiveFunction, Structure.

| Alternative | Trade |
|---|---|
| Fewer: fold Param into Symbol | Params are positional and Symbols are named; merging them would make substitution need a name environment (see SC-3) |
| Fewer: no separate PrimitiveFunction | Host functions would need an Allegretto encoding; the `lazy`/`sourceAware` declarations have nowhere to live |
| More: a distinct sequence kind alongside Structure | A Structure role rather than a kind (IC-2) |

**Rationale.** Minimality under R1, subject to R8 leaving nothing outside.
Visible to Allegro: yes, L2 dispatches on these.

**As implemented.** `ValueKind` and the seven interfaces in `src/types.ts`
(T0 §2 to §9). D51 splits them into a contract, seven kind units and an
assembly; the set stays seven.

**Delta.** —

### SC-2 — Bits is the only scalar

**Level.** Specification; satisfies R1, R6.

**Definition.** One uninterpreted scalar: a bit vector of known length.
`Int`, `Float`, `String`, `Bool` are Bits with a type attached at L2.

| Alternative | Why not |
|---|---|
| A fixed set of primitives | Violates R6: the base would know a numeric tower, and Allegro could not redefine it |
| Tagged scalars (value plus kind tag) | The tag is a degenerate type channel; R3 already provides one |

**Rationale.** Minimality under R1, layer-ignorance under R6. Revisit if a
numeric or textual operation cannot be expressed at L2 without the base
knowing its semantics.

**As implemented.** `BitsValue` (T0 §3); `makeInt`, `makeFloat`,
`stringToBits` in `src/types.ts`; typed literals stamped by `typeLiterals`
in the pipeline.

**Delta.** `typeLiterals` (raw Bits to Int or String) is the type system's
rule executed inside the pipeline (`units.md` misalignment M3 (`typeLiterals` is in the pipeline)). Not a violation of this entry;
a placement finding.

### SC-3 — Expressions are values

**Level.** Specification; satisfies R2, R4, R8.

**Definition.** An unevaluated application is an ordinary value, so a
partially-evaluated program is also an ordinary value.

| Alternative | Trade |
|---|---|
| A separate IR for unevaluated code | Violates R8, and residuals could not flow through the same machinery as results, which is the whole of R2 |

**Rationale.** R2 is not achievable otherwise. Borderline requirement; kept
as specification because "the DAG is a representation of pending
computation" admits alternatives even if "pending computation is a value"
does not.

**As implemented.** `ExpressionValue` (T0 §6); residuals are Expressions
carrying their own metadata since B-121 (metadata on values).

**Delta.** —

### SC-4 — Symbol identity is fully-qualified, not spelling

**Level.** Specification; satisfies R6, R14.

**Definition.** Two members spelled `size` in different types are different
symbols.

| Alternative | Trade |
|---|---|
| Name-string comparison | Conformance becomes a spelling question; D44 removed exactly this class of false positive |
| Opaque gensym identity | Loses the human-readable projection printing, errors and loose matching rely on |

**Rationale.** Conformance must be an identity question. D44 (declared
inheritance dissolves into conformance) is evidence the
alternative was tried and failed.

**As implemented.** `SymbolValue.fqn`; interning in `src/symbols.ts`
(IC-4).

**Delta.** —

### SC-5 — One composite kind rather than two

**Level.** Specification; satisfies R1, R3. D1 (unify MultiValue and
Context into Structure), completed by D46 (MultiValue retirement); upheld
at B-108 (D48, the composite ruled as one question).

**Definition.** MultiValue and Context were condensed into one Structure.

| Alternative | Trade |
|---|---|
| Two kinds (the original) | Explicit about carrier versus record; costs one kind under R1 |
| Three (add a sequence kind) | IC-2 option E makes a sequence the composite's own shape instead |

**Rationale.** Kind-count minimality under R1. This is the specification
half of a choice whose implementation half was IC-1 (roles read from field
presence), and separating them is
what made the maintainer's doubt answerable: reducing the kind count was a
specification win, and what it cost was at the implementation level, where
four configurations replaced two kinds. B-108 upheld SC-5 and ruled the
cost away: IC-1 dissolved, IC-2 (the composite's storage) took option E,
IC-3 (metadata storage) took the alternative. The
measurements are in the record §5.

**As implemented.** `StructureValue` (T0 §9); one role left, record (§12).

**Delta.** —

### SC-6 — Scopes are values

**Level.** Specification; satisfied R8, R2. **Superseded by D49** (2026-09):
the evaluation environment leaves `Value` and becomes a non-value host
construct. Owner **B-136** (Scope leaves `Value`); not executed.

**Definition (as it stood).** An evaluation environment is an ordinary
Structure, introspectable like any other, distinguished by role rather than
by kind.

| Alternative | Trade (as recorded) | What D49 found |
|---|---|---|
| Environments outside the value universe | "Violates R8; reflection over scope becomes a special API" | No scope ever reaches user code as a value, so R8 is not engaged; introspection is a property of scopes you hold (V-R2), not of scope valuehood |

**Rationale for the supersession.** A scope has no position, so metadata is
meaningless on it; it is mutable where values are not (the carve-out from
D22 (immutability by derivation)
this entry used to record); and the substrate sharing made five sites exist
only to undo it. Decided in `docs/plans/entry-sequence-composite.md` §5.6.

**As implemented.** Still a `StructureValue` with `isScope` set; `src/scope.ts`.

**Delta.** The code implements the superseded entry. **B-136** executes D49.
Candidate R19 (planes are separated) is what the supersession satisfies.

### SC-7 — Propagation is drawn from a fixed, inspectable vocabulary

**Level.** Specification; satisfies R3; criterion R12 enforceability.
Proposed at S2d (record §4.2); in use by §20 (propagation).

**Definition.** A field's propagation rule is one of `viral`, `union`,
`computed`, `positional`, `drop`. The base applies the rule without knowing
what the field means; the semantics a rule needs (a merge for `union`) are
installed by the field's owner.

| Alternative | Trade |
|---|---|
| Arbitrary propagation closures registered per field | Satisfies R3 and R6 equally, but R12 becomes unenforceable: a closure is not inspectable, so the base cannot refuse a fabricating rule on an integrity field |

**Rationale.** The integrity check (`registerMetaField` refuses `viral` or
`union` on an integrity field) is decidable only over symbols. Revisit if a
layer needs a discipline the vocabulary cannot express; extend the
vocabulary rather than open it to closures. `union` is in the vocabulary
because effect sets union and knowledge meets.

**As implemented.** `PropagationRule` in `src/metadata.ts`;
`installFieldMerge` (`src/capability.ts`, gated on the field's writer) is how a field supplies `union` semantics; one caller
(`src/effects.ts`).

**Delta.** `positional` is vocabulary without a path
(`allegretto/metadata-and-capability.md` §5).

### SC-8 — Specified aborts

**Level.** Specification, proposed at S2d (record §3); satisfies R12 and
candidates R18 (resource bounds), R19 (planes are separated) and R20 (an
ill-formed application is rejected). **Not ratified**; stated here because the
maintainer ruled that if Allegretto aborts, that behaviour is a
specification supported by a requirement, and the classification exists.

**Definition.** The base aborts in exactly these cases, each a hard stop,
each distinguishable from the others:

| Class | What it is | Requirement above it |
|---|---|---|
| A · Host-invariant assertion | an interpreter bug surfaced; not language behaviour | none needed; must be a distinct mechanism |
| B · Plane violation | a scope used as data or data extended as a scope | R19 |
| C · Capability denial | re-registering a field; a fabricating rule on an integrity field; originating an integrity key without the writer | R12 |
| D · Resource guard | the evaluation-depth bound | R18 |
| F · Ill-formed application | a primitive given the wrong arity or an unusable argument | R20 |

Class E, type errors thrown by the base, is not in the specification: it is
R6 violated and is rework (**B-112**).

**Rationale.** Denial as an abort rather than an error value is the right
shape for class C: an error value would be forgeable, since the forger
chooses what to do with it. Class B becomes unrepresentable, not checked,
when D49 lands.

**As implemented.** 117 throws in L0 and L1, all one class `AllegroError`,
nothing in `src/` catching it. The classes above were established by reading
every site (record §3).

**Delta.** One exception class carries no discriminator, so a tool cannot
tell an interpreter bug from a user error: **B-110(d)**.

## 3. Implementation choices

> **Level: Implementation.** Alternatives here are invisible to Allegro: a
> different choice changes no program's meaning. Each records the
> alternatives, the criterion that selected one, what the code does, and
> the delta. A choice with no recorded alternatives cannot later be
> evaluated.
>
> *Renumbered at S2b (a concept-spine plan chunk).* The IDs before that
> chunk map to the current ones as follows (for readers of the older
> records):
>
> | Former | Now |
> |---|---|
> | IC-1 (Bits) | SC-2 |
> | IC-2 | SC-5 (kind count) and IC-1 (role configuration) |
> | IC-3 | IC-2 |
> | IC-4 | IC-3 |
> | IC-5 | SC-4 and IC-4 |
> | IC-6 | IC-5 |
> | IC-7 | SC-3 and IC-6 |

### IC-1 — Structure's roles are read from field presence

**Level.** Implementation; realised SC-5. **Dissolved at B-108 (D48(d))**:
with the dense role a representation below the specification (IC-2) and the
carrier role deleted (IC-3), one role survives and there is nothing to
discriminate.

**Definition (as it stood).** One class carrying every role's fields, with
role inferred from which are populated: 11 declared fields, four role
groups, 146 sites discriminating by field presence.

| Alternative | Trade |
|---|---|
| Explicit role tag | Replaces 146 presence-checks with one discriminant |
| Genuinely one role (IC-2 option E) | The only option that removes the configurations rather than renaming them |

**Rationale for the dissolution.** B-108 judged IC-1, IC-2 and IC-3
together; ruling IC-1 first would have built a tag for configurations that
were about to be deleted. The measurement is in the record §5.1.

**As implemented.** `src/structure.ts`: `isScope` is the only role tag
left; `dense` and `primary` are deleted (B-120, B-121).

**Delta.** `isScope` goes with D49 (B-136).

### IC-2 — The composite is one entry sequence, with an index below the specification

**Level.** Implementation; realises SC-5. **Ruled option E at B-108
(D48(a)); executed at B-120 (2026-09).**

**Definition.** A Structure is an ordered sequence of optionally-keyed
entries. A by-name index is built lazily on first lookup past eight entries,
whatever the structure's role.

| Alternative | Trade |
|---|---|
| A · map-first (the prior implementation) | O(1) name lookup; four configurations, `__length`, a materialised legacy view, 146 presence sites |
| B · sequence-first, no index | Linear name lookup where field reads are hot |
| C · two representations | One extra kind |
| **E · one entry sequence** | Both map and list; the index is invisible above the specification |

**Rationale.** Spec-to-implementation distance under R7 (Allegretto is
replaceable), the criterion IC-2
had recorded as the one that should apply. The deciding measurement (data
structures average 4.6 slots; name lookup is rare next to the carrier
indirection it was optimising) is in the record §5.2.

**As implemented.** `entries` is the store and `bindings` the derived view
(§13); `SlotView` is the index (§15 and B-120 E2). Two places execution
corrected the ruling: the index splits by size, not by role (93.4% of 4.24M
lookups are served by a scan averaging 3.63 entries), and an empty array
needed one host-plane bit the ruling did not anticipate, which opened the
host-plane audit (B-133 (the positional bit) and B-135 (what may live on
the host plane)).

**Delta.** —

### IC-3 — Metadata is a field on every value

**Level.** Implementation; realises R3. **Ruled at B-108 (D48(b));
executed at B-121 (2026-08).** The prior choice, channels by wrapping in a
carrier Structure, is retired (§10).

**Definition.** Every representation kind carries an optional `meta` field
(`Map<string, Value>`). Attaching metadata yields a new value of the same
kind.

| Alternative | Trade |
|---|---|
| A carrier wrapping a non-composite value (the prior implementation) | No field on Bits; costs an eleven-field Structure per attachment, `primary`, `dataOf`, 67 presence checks and the W1 invariant |
| A side table keyed by object | Fails because metadata is per position, not per datum: a third of attachments target an object already carrying some |

**Rationale.** Allocation cost and spec-to-implementation distance. The
measurement (74% of allocated Structures were carriers holding one field)
is in the record §5.3.

**As implemented.** `MetadataBearing` on all seven interfaces; `withMeta` in
`src/types.ts`; `meta` optional in the type, always declared on the object.
D51 moves the field out of the kind units into the `metadata` unit by
augmentation; the representation is unchanged.

**Delta.** —

### IC-3a — Metadata is supplied at construction, not attached afterwards

**Level.** Implementation; ruled with IC-3 (D48(c)); executed at B-121 C6.

**Definition.** A value that will carry metadata is built with it: the
factories take an optional metadata argument; `withMeta` is the one
attachment operation; `carryMeta` moves metadata across a new datum. Writing
in place is permitted only while a value is provably unshared, during
construction, before it escapes.

| Alternative | Trade |
|---|---|
| Construct, then attach (the prior shape) | A window in which the value exists without what it must carry; one extra allocation on PE Rule 1's path |

**Rationale.** Lifecycle honesty: a value should not exist in a state the
specification says is impossible. The four call-site patterns that looked
like four operations were one (record §5.3).

**As implemented.** `makeInt(v, meta?)`, `makeExpr(fn, args, meta?)`,
`withMeta`, `carryMeta`; the in-place rule stated in `src/structure.ts`.

**Delta.** The in-place rule is stated, not enforced: **B-143** (D22
enforcement).

### IC-4 — Symbols are interned by FQN

**Level.** Implementation; realises SC-4.

**Definition.** Same FQN, same object, so identity comparison is a pointer
compare.

| Alternative | Trade |
|---|---|
| Compare FQN strings at each site | Same semantics, more allocation and slower comparison |

**Rationale.** Comparison cost on a hot path.

**As implemented.** `src/symbols.ts`.

**Delta.** Attaching metadata to an interned Symbol clones it and breaks
pointer identity; measured at zero occurrences and left as a warning
(B-121 §6 ruling 2).

### IC-5 — Scopes layer by parent chain

**Level.** Implementation; realises SC-6 (superseded by D49, which keeps
the chain) and R2.

**Definition.** O(1) extend, chain-walking lookup.

| Alternative | Trade |
|---|---|
| Flatten-copy on extend | O(n) per call site; the prior implementation and the hot path that motivated the change |

**Rationale.** Cost of the operation PE performs most.

**As implemented.** `scopeExtend`, `scopeLookup` in `src/scope.ts`; the
facts plane layers the same way.

**Delta.** —

### IC-6 — Expressions memoize

**Level.** Implementation; realises SC-3, R2.

**Definition.** An Expression carries a memo table keyed by evaluation
context.

| Alternative | Trade |
|---|---|
| No memo, re-evaluate per reference | Exponential re-evaluation under PE, which specialises the same subexpression repeatedly |

**Rationale.** PE cost.

**As implemented.** `ExpressionValue.memo`; a clone shares it (same `fn`
and `args` mean the same memo is correct).

**Delta.** —

## 4. Status of the set, and what this part does not contain

- **Ratification.** R1 to R20 are proposed, not ratified as a set. The
  cohesion pass found what it found (record §2); the maintainer's S2d
  rulings merged four metadata statements into R3 and SC-7 (record §4);
  the identifiers that were removed are logged in `docs/book-changes.md`
  and are free for reuse. Every entry
  below cites the set as it stands in §1.0. The ask stands: ratify the set,
  or amend it, so the status column can say *ratified*.
- **Candidates have no entries.** R16 to R20 are stated in one table with
  owners. SC-8 is the specification that would satisfy three of them, and
  it is likewise proposed.
- **The registers cover T0 and T1.** T2 to T5 choices (discharge tiers, the
  knowledge lattice, the module surface) are not registered as SC or IC.
  Some live requirements have no specification item at all yet, which by
  §0's own rule makes them unmet or met implicitly: R9 (grammar), R10
  (resumability), R14 (modules). That is expected at this stage and is the
  orphan the traceability check is meant to surface.
- **The two "known tensions"** raised against R6 and R12 (record §1) are
  both implementation violations rather than design contradictions, and
  both are owned (B-109). They appear here only as the delta rows of R6 and
  R12.
---

# T0 · Representation

What a value is, before anything has been said *about* it. This tier is
Allegretto with no type system present at all.

<a id="def-value"></a>
## 1. Value

> **Level: Specification** — satisfies R1, R4, R8.

**Definition.** A *value* is anything Allegretto can compute with. There is
no other category: there are no statements, no declarations, and no types
that are not themselves values. Every value takes exactly one of the seven
**representation kinds** below, fixed when it is made and never changed.

**Rationale.** One universe is what makes the platform programmable — an
extension can receive, build and return any part of the language because
every part is a value. It is also what makes partial evaluation total: the
evaluator never meets something it has no rule for.

**As implemented.** `Value` in `src/types.ts` — a discriminated union of the
seven kind interfaces.

**Delta.** —

<a id="def-representation-kind"></a>
## 2. Representation kind

> **Level: Specification** — satisfies R1, R6, R8. Choice: **SC-1**.

**Definition.** A *representation kind* is the physical form a value takes.
There are exactly seven: **Bits**, **Symbol**, **Param**, **Expression**,
**ComposedFunction**, **PrimitiveFunction**, **Structure**. The kind is a
**host discriminant** — a tag the interpreter switches on — and deliberately
*not* a type. Types are a separate, later idea (T4) built on top of values,
and a value's kind tells you nothing about its type.

**Rationale.** D46 demoted `kind` to a host discriminant precisely so the two
could not be confused. If kind were a type, the type system would be fixed at
seven and could not be an extension; keeping it a discriminant is what lets
Allegro Standard be a *curated extension stack* rather than a privileged
layer.

**As implemented.** `ValueKind` in `src/types.ts` — a string enum, read as a
plain field so the evaluator's hot switch stays monomorphic.

**Delta.** — *(closed at C9. The header read "Five value kinds + Param
placeholder" — there are seven, and Param is one of them; it predated both
`Symbol` and the Context→Structure renaming.)*

<a id="def-bits"></a>
## 3. Bits

> **Level: Specification** — satisfies R1, R6. Choice: **SC-2**.

**Definition.** A *Bits* value is a vector of bits of a known length. It is
the only representation that carries no reference to another value — the
bottom of the ladder.

**Rationale.** Allegretto's scalar layer is deliberately untyped and
uninterpreted: `Int`, `Float`, `String` and `Bool` are all Bits with a type
attached at T4. The base language commits to a width and a bit pattern and
nothing else, so numeric and textual semantics are extension decisions
rather than kernel ones.

**As implemented.** `BitsValue { length: number; data: bigint }` in
`src/types.ts`; constructors `makeBits`, `makeInt` (64-bit), `makeFloat`
(IEEE-754 packed into the same 64 bits).

**Delta.** —

<a id="def-symbol"></a>
## 4. Symbol

> **Level: Specification** — satisfies R2, R6, R14. Choices: **SC-4** (identity), **IC-4** (interning).

**Definition.** A *Symbol* is a named reference to something not yet
resolved. Symbols come in two populations: **registered** symbols, whose
identity is a fully-qualified name and which are interned so that the same
FQN is the same object; and **transient** reference symbols minted by the
parser for each identifier occurrence, which have no identity beyond that
occurrence and resolve by base name against the enclosing scope.

**Rationale.** Identity-by-FQN (D20/D29) is what makes member conformance a
symbol-identity question rather than a name-matching one — two types can each
have a member spelled `size` without conforming to one another. The transient
population exists because the parser cannot know what an identifier refers to
yet, and forcing it to decide would fold resolution into parsing.

**As implemented.** `SymbolValue { name: string; fqn?: string }` in
`src/types.ts`; interning and FQN construction in `src/symbols.ts`;
resolution in `resolveSymbols` (`src/runtime.ts`). The presence or absence of
`fqn` is the discriminant between the two populations.

**Delta.** —

<a id="def-param"></a>
## 5. Param

> **Level: Specification** — satisfies R2.

**Definition.** A *Param* is a positional placeholder standing for an
argument inside a function body, carrying its position and a back-reference
to the function that declares it.

**Rationale.** Parameters are positional rather than named at the
representation level so that substitution during partial evaluation is a
positional operation and does not need a name environment. The back-reference
is what lets a body distinguish *its own* parameters from an enclosing
function's during nested substitution.

**As implemented.** `ParamValue { position; owner; _name? }` in
`src/types.ts`, plus two bound-carrying fields — `effectBound` (T5) and
`effectVar` (T4/T5).

**Delta.** `ParamValue.predicates` is declared, documented as "reserved", and
has **no runtime reader** — a test asserts it stays empty. A reserved field
that nothing writes and nothing reads is indistinguishable from a dead one;
the reservation belongs in prose. **→ B-107.**

<a id="def-expression"></a>
## 6. Expression

> **Level: Specification** — satisfies R2, R4, R8. Choices: **SC-3** (expressions are values), **IC-6** (memoization).

**Definition.** An *Expression* is an application node: a function value
plus an argument list, with a memo table. Expressions form a **DAG**, not a
tree — the same expression value may be referenced from many places, and is
evaluated once per distinct context.

**Rationale.** The DAG is the compilation artifact. Because an unevaluated
application is an ordinary value, a partially-evaluated program is *also* an
ordinary value, which is what lets residuals flow through the same machinery
as results instead of needing a separate IR.

**As implemented.** `ExpressionValue { fn; args; memo }` in `src/types.ts`;
`makeExpr`. Evaluation in `evaluateExpr` (`src/evaluator.ts`).

**Delta.** —

<a id="def-composedfunction"></a>
## 7. ComposedFunction

> **Level: Specification** — satisfies R2.

**Definition.** A *ComposedFunction* is a function defined inside Allegretto:
a list of declared Params and a body value.

**Rationale.** A function is data — params plus body, both values — so
building, inspecting and rewriting functions needs no reflection API. This is
the representational basis for partial evaluation: specializing a function is
substituting into a value.

**As implemented.** `ComposedFunctionValue { params; body }` in
`src/types.ts`; `makeComposedFn`, which also back-links each param's `owner`.

**Delta.** Host-plane analysis metadata (`partial`, `decreasesMetric`,
`inferredEffects`, `genericParams`, …) is attached to ComposedFunction
objects as JS expandos, listed in `PRESERVED_FN_META_KEYS` so clones carry
it. It is invisible in the interface above, so the declared shape of a
function value understates what a function value holds. Defining the **host
plane** (T2 §9) is the fix; recording it here so the T2 entry has a caller.

<a id="def-primitivefunction"></a>
## 8. PrimitiveFunction

> **Level: Specification** — satisfies R2, R3.

**Definition.** A *PrimitiveFunction* is a function implemented by the host
rather than in Allegretto. Beyond its implementation it carries three
declarations that the evaluator acts on: `lazy` (do not evaluate my
arguments), `effects` (labels I produce), and `sourceAware` (attach each
argument's originating expression to the evaluated argument).

**Rationale.** These three are *evaluation-control* declarations, and keeping
them declarative rather than letting primitives reach into the evaluator is
what keeps the propagation table (T2 §10) authoritative. Note the deliberate
split between `lazy` and `sourceAware`: lazy is for **not evaluating**,
source-aware is for **seeing what was evaluated** (D47).

**As implemented.** `PrimitiveFunctionValue` in `src/types.ts`; the registry
is `primitives` in `src/primitives.ts`.

**Delta.** —

<a id="def-structure"></a>
## 9. Structure

> **Level: Specification** — satisfies R1, R3, R8. Choice: **SC-5** (one composite kind). Implementation: **IC-1**, **IC-2**.

**Definition.** A *Structure* is the one composite representation: a value
built from other values. It is the only kind with internal parts, and every
composite thing in the language — records, arrays, types, proofs, scopes,
module objects — is one. Its **role** is fixed at construction and never
changes. T1 defines the roles.

**Rationale.** D1 unified what were three separate kinds (MultiValue,
Context, and the record role) into one, and D46 finished the job by making
the last survivor a *configuration* rather than a kind. One host class means
one hidden class and one set of invariants to enforce, and it removes the
question "which composite is this?" from every call site.

**As implemented.** The class is `Structure` in `src/structure.ts`; the
value-interface is `StructureValue` in `src/types.ts`; it is constructed only
through the `src/types.ts` factories (`makeStructure`, `withMetadata`,
`makeDenseArray`).

**Delta.** — *(closed at C9. The three names were `Structure` (the class),
`StructureValue` (2 occurrences — its declaration and the alias) and
`ContextValue` (701), the last existing solely as
`export type ContextValue = StructureValue`. D1 and D46 were recorded
**executed** when only the runtime unification was; the renaming had been
done by alias. The alias is deleted and the interface is `StructureValue`
at all 703 sites; `makeContext` → `makeStructure` at 101.)*

<a id="def-carrier"></a>
## 10. Carrier — RETIRED (B-121, 2026-08)

> **The concept no longer exists.** Retired rather than renumbered: the
> section numbers here are stable identifiers, the way §19b and §33b are, and
> other entries cite them. This marker is what §10 means now.

A *carrier* was a Structure that stood in for another value — empty data
plane, the value it stood for in `primary`, its metadata alongside. It was how
a non-composite value came to carry metadata without changing kind, and it was
D46's option B.

**Why it is gone.** IC-3 was re-ruled at **D48(b)** on measurement: of 240,820
value allocations, **56,123 were carriers** — 74% of all structures, more than
there are Bits values — and **98.5% held exactly one field**. The most common
act in the system was allocating an eleven-field `Structure` so that a `Map`
could hold one entry. Metadata is now a field on every representation kind
(§19), so a non-composite value never becomes something else in order to carry
one. A typed `42` is a `Bits`.

**What went with it.** `primary`, `isCarrier`, `newCarrierStructure`, the
`CarrierStructure` type, the **W1** non-nesting invariant and the **W5**
role-transparency invariant — both of which existed only to keep two roles
sharing one class from contaminating each other — and `dataOf`, the data-plane
peel, which became the identity function and was deleted with its 849 call
sites. The current story is §11 (data plane) and §19 (metadata field).

**What the deletion taught, since it is not visible in the result.** Removing
a representation broke **eleven sites that no author knew depended on it** —
`isCarrier`, `.primary`, and `kind === Structure` standing in for *"does this
carry metadata?"*, a question that turned out to have eight spellings. Every
failure was **silent**: a check stopped firing rather than throwing, so type
annotations stopped rejecting, a failing `proven` clause downgraded to a skip,
and `effects` stopped unioning. That is the evidence behind **B-128** — layer
separation stated but not policed — and behind **B-127**, since two whole
classes were invisible to a regex over source text. Full record:
`docs/plans/metadata-on-values.md` §5.1a–§5.1g.

<a id="def-data-plane"></a>
## 11. Data plane

> **Level: Specification** — satisfies R3. D48(b) did not change this entry; it made the entry *literal*.

**Definition.** The *data plane* of a value is the value it ultimately
denotes, ignoring anything carried alongside. **It is the value.** A
composite's data is its slots; a scalar's data is its bits; and neither is
reached by projecting past a wrapper, because there is no wrapper.

**Rationale.** This entry used to describe **two consumers with different
interfaces**, and that split was the carrier's shadow rather than a property
of the plane. From inside the language a value simply *was* its data — the
carrier being invisible is what D46's *transparent* carrier meant — while the
host, implementing the value, could see the wrapper and needed `dataOf` to
see past it. B-121 deleted the wrapper, so the host's view and the language's
view are now the same view, and the accessor with them (§10).

The rule that survives, and it is the one that matters: **primitives receive
FULL values.** An impl that stripped its arguments down to their data would
silently drop every metadata field they carry (R4/C4.3c). Before B-121 that
rule needed a peel to be usable at all; now it needs nothing, which is the
sense in which the implementation caught up with the specification.

Ordering note, kept because it records a real check: this entry and §10 were
mutually referential in prose — a carrier was defined by having a data plane,
the data plane by the carrier's primary. The cycle was broken by defining the
carrier *structurally* and the data plane as the accessor over that shape.
With §10 retired the cycle is gone rather than broken.

**As implemented.** Nothing. There is no data-plane accessor, and the absence
is the implementation. `dataOf` was deleted at B-121 C5 with 849 call sites,
and the boundary lint forbids the identifier along with its earlier spelling
`primaryOf`.

**Delta.** — *(Opened at C7 against B-128 — a plane with no reader looked like
a plane not policed — and **closed by maintainer ruling, 2026-08**: it is not
an inconsistency. The purpose of governing access by interfaces is that access
be **well defined**, not that every plane carry an accessor. For the data plane
the governing constraint is a different one: above L0, values may be created or
modified **only through defined Allegretto functions**. That is what makes data
access well defined here, and it is unaffected by there being nothing to
project. B-128's scope is unchanged; this entry is simply not one of its
cases.)*

---

# T1 · Structure and binding

What a Structure is made of, and the three roles it plays.

<a id="def-structure-roles"></a>
## 12. Structure roles

> **Level: IMPLEMENTATION** — choice **IC-2**. SC-5 says *one composite kind*; the roles are how this host realises it. **B-120 E4 deleted the dense role and IC-1 dissolved with it** (D48(d)), so the gap IC-1 recorded is closed: role is no longer read from field presence.

**Definition.** A Structure plays one of two roles, chosen at construction:

| Role | What it is | Storage |
|---|---|---|
| **Record** | A data value with named parts — records, arrays, types, proofs, module objects | the entry sequence (§13) |
| **Scope** | Evaluation environment, not data (§15) | the entry sequence + parent link |

Two roles have been removed, and neither left a replacement concept behind.
B-121 removed the **carrier** — a record-role Structure with an empty data
plane standing in for a non-composite value (§10, retired). B-120 E4 removed
the **dense** role: an array is a record whose entries all carry a null key,
so the role became a representation and then stopped being one (§16, retired).

**Rationale.** Role is fixed at construction so that no value changes what it
is under you, and so the host keeps one hidden class across both. The
record/scope split is a **plane split**: scopes are evaluator state and
mutable; data structures are born immutable (D22). Each rejects the other's
operations.

**As implemented.** `src/structure.ts` — `newRecordStructure`,
`newDenseStructure` (which now builds a record whose entries are unkeyed).
The only role tag left is `isScope`; `dense` and `primary` are both deleted.

**Forward.** **D49** rules that a scope leaves `Value` entirely and becomes a
non-value host construct, which would leave this entry with one role and no
table. Ruled, not executed — owner **B-136**.

**Delta.** — *(closed at C9. The header described **two** planes where there
are four, and said `__*` meta-slots "remain here until C5 re-keys them" — C5
did not. Now names all four and points the host-plane row at
`StructureHostFields`.)*

<a id="def-binding"></a>
## 13. Binding

> **Level: Specification** — satisfies R1.

**Definition.** A *binding* is one named part of a Structure: a key and a
value. Bindings live in two places at once — a **map** for lookup by key and
a **list** for order — and a binding may be **positional**, with a null key,
present in the list only.

**Rationale.** Both views are needed and neither derives from the other:
lookup is by name, but construction, printing and destructuring are by
position. The positional case exists because some literals bind by position
alone.

**As implemented.** `Binding` in `src/types.ts`; `bindings: Map` and
`bindingList: Binding[]` on `StructureValue`. Null keys are minted by the
tree-builder and `parser-helpers.ts`.

**Delta.** — *(closed at C9, and writing the rule found its cause.* The map
and the list are maintained by convention at each write site, not by a single
mutator, so they can diverge — `slotWrite` writes both, `renameInPlace`
mutates the map's entry only, `removeName` and `removeRefines` delete from
the map and leave the list entry standing, `removeConstruct` deletes from
both. Four disciplines, one comment between them. **The reason is that the
map and the list are not aliases**: `slotWrite` and `addBinding` each
construct **two separate `Binding` objects** for one key, so an in-place
mutation reaches exactly one view. Every discipline follows from that, and it
was documented nowhere. The rule now sits above `slotWrite`, including *why*
the map-only paths are safe today — nothing enumerates a type structure's
`bindingList` as fields — and that the exemption is circumstantial rather
than structural.*)*

<a id="def-binding-attributes"></a>
## 14. Binding attributes

> **Level: Specification** — satisfies R2, **R10**. (`cell`, `isComplete`, `incompleteDeps` are the binding-level form of R10: information arriving later, tracked where it is waited on.)

**Definition.** Beyond key and value, a binding carries four optional
attributes, all of them properties of *the binding in its scope* rather than
of the value:

| Attribute | Meaning |
|---|---|
| `visibility` | `"exported"` marks a binding as visible outside its module |
| `cell` | This binding was minted as a future or import **cell** (T3) — permanent, still true after resolution |
| `isComplete` | `false` while pending or residual; absent means untracked, treat as complete |
| `incompleteDeps` | Names this binding is still waiting on |

**Rationale.** V-R4 moved export-ness here from the value plane precisely
because it is not a property of the value: `y = x` copies the value and must
*not* copy the export. The same argument holds for the other three — a value
is not pending, a *binding* is. This is the pattern the synthetic
binding-name families should follow rather than encoding state in a name
(B-104(b)).

**As implemented.** The four optional fields on `Binding` in `src/types.ts`.

**Delta.** —

<a id="def-scope"></a>
## 15. Scope

> **Level: Specification** — satisfies R2, R8. Choices: **SC-6** (scopes are values), **IC-5** (chain layering).

**Definition.** A *scope* is a Structure in the evaluation role: a binding
map plus a link to a parent scope. Lookup walks the chain; extending is O(1)
and does not copy. Scopes are values — introspectable like any other — but
they are **evaluator state**, so they are mutable where data structures are
not, and structure operations refuse to run on them.

**Rationale.** Layering rather than flatten-copy is what makes call-site
enrichment cheap. Keeping scopes first-class keeps the reflective surface
uniform; keeping them *plane-separated* is what stops that uniformity from
leaking mutability into data.

**As implemented.** `src/scope.ts` — `scopeNew`, `scopeExtend`, chain-walking
lookup, plus the **facts plane** (`scopePredicates`) used for scope-local
predicate narrowing. `isScope` marks them; `assertExtendable` rejects
layering a scope over a typed data value.

**Delta.** — *(closed at C9: `parent`, `isScope` and `scopePredicates` move
to a declared `StructureHostFields` interface that `StructureValue` extends,
so the plane is legible in the type instead of only in per-field comments
that the declaration contradicted. They are **correctly placed** — only the
declaration was wrong; host-plane data that belongs on the metadata plane is
B-118.)*

<a id="def-dense-region"></a>
## 16. Dense region — RETIRED (B-120 E4, 2026-09)

> **The concept no longer exists.** Retired rather than renumbered: the
> section numbers here are stable identifiers, the way §10, §19b and §33b are.
> This marker is what §16 means now.

A *dense region* was a second storage shape for the one case the entry
sequence already described. A Structure in the dense role stored its elements
in a plain `Value[]` rather than as per-element bindings, and its slot count
was the array length.

**Why it is gone.** D48(a) ruled that the composite is a sequence of
optionally-keyed entries, and an array is exactly that sequence with every key
null. The level tag on this entry always said the dense region was *below the
specification*; option E made the specification able to express it, so the
separate representation had nothing left to buy.

**What went with it.** `dense`, `materializeView`, `viewMaterialized`,
`slotCountBits`, the `__length` slot, `isDense`, the **W6** dense-view
coherence invariant, and the string-key read protocol by which an array's
elements were reachable as `bindings.get("0")`. The current story is §9
(Structure) and §13 (Binding).

**A host-plane bit survived E4 and was demoted at B-133.** `positional`
recorded whether the entries were wholly unkeyed, so an empty array and an
empty record could be told apart. The maintainer's challenge to it at the E4
gate opened the host-plane audit, and B-133 settled it: the field is now a
`private` derived cache — `entries.every(e => e.key === null)`, computed and
remembered, with the same status as the `_view` index — and the count that
reads it always answers. **Nothing at L0 distinguishes an empty array from an
empty record any more, because nothing at L0 should**: that is the type's
question. Analysis: `docs/plans/entry-sequence-composite.md` §5.5.

<a id="def-the-legacy-view"></a>
## 17. The legacy view — RETIRED (B-120 E4, 2026-09)

> **The concept no longer exists.** Retired rather than renumbered, per §10.
> This marker is what §17 means now.

The *legacy view* was compatibility scaffolding: a dense Structure could still
be read through the binding map and list, materialized lazily on first such
access and then cached, holding one binding per element under its decimal key
plus a `__length` binding for the count. The W6 invariant asserted that the
view and the dense region agreed.

**Why it is gone.** It had no users. B-120 E2 measured the corpus: **0 of 166**
dense structures ever materialized a view, so W6 was vacuous and the
scaffolding was maintaining a compatibility contract nobody exercised. It went
with the dense region at E4.

**What E3 got wrong about it, since the correction is the useful part.** E3
concluded the string-key protocol had no consumer, citing that 0-of-166 figure
and the absence of any `.alg` source indexing an array by string. Both facts
were true and the conclusion was wrong: the corpus walk covered `tests/*.alg`
and not the TypeScript harness, which read analyzer output positionally in
three places. Nine tests failed at E4. **A measurement's scope is part of its
claim.**

**Delta.** — *(closed at B-120 E5. This entry recorded that `__length` was the
sole remaining job of the engine/user partition test. `__length` went at E4,
and E5 deleted the predicate after re-measuring: across 1202 tests the
field-walk sites saw **748 distinct binding keys and not one `__`-prefixed**.
See §22.)*

---

---

# T2 · Planes

The tier whose absence caused B-104. A **plane** is where a piece of
information about a value lives, and the four are not interchangeable: which
plane a thing belongs on determines who may write it, what happens to it
under evaluation, and whether Allegro can see it at all.

<a id="def-plane"></a>
## 18. Plane

> **Level: Specification** — satisfies R3, R8, R12.

**Definition.** A *plane* is one of four storage regions a value's
information can occupy, distinguished by **who may write it** and **what
evaluation does to it**:

| Plane | Holds | Written by | Under evaluation | Visible to Allegro |
|---|---|---|---|---|
| **Data** | What the value *is* — the value itself, with no accessor (§11) | construction | replaced by the result | yes — it is the value |
| **Binding** | A composite's named parts | construction; kernel for engine slots | copied by the operations that copy structures | yes — user fields |
| **Metadata** | Information *about* the value, in named **fields** | the field's registered writer | per the field's declared rule (SC-7) | yes, through field reads |
| **Host** | Interpreter bookkeeping | the host, freely | nothing — it is not part of the value | **no** |

**Rationale.** The planes are what make R3 possible: an operation can carry
a metadata field it has never heard of precisely because the metadata plane is
separate from the data it is operating on. They are also the answer to "where
should this new thing go?", which is the question nobody could answer for
four years because the planes were never written down.

**The rule for placing something new.** Ask in order: *Is it what the value
is?* → data. *Is it a part a user names?* → binding. *Is it information about
the value that must survive operations?* → metadata, and it needs a registered
rule and a writer. *Is it none of those?* → host, and it must not be
observable from Allegro.

**As implemented.** Data → the value itself; B-121 deleted `primary` and the
`dataOf` accessor, so this plane has no reader (§11).
Binding → `bindings` + `bindingList` (+ `dense`). Metadata → `meta`.
Host → JS expandos and declared-but-non-value fields on `Structure`.

**Delta.** — *(closed at C9. The host plane was **declared inside the value
interface** — `parent`, `isScope` and `scopePredicates` on `StructureValue`
while their own comments said "host-plane fields, never value slots". A plane
documented in comments and contradicted by the type is not a plane but a
convention. `StructureHostFields` now declares it. Note the scope: this fixes
the DECLARATION. Host-plane residents that belong on another plane are
B-118, and that item exists because this entry made the two separable.)*

## 19. Metadata field

**Defined in** [`allegretto/metadata-and-capability.md` §3](allegretto/metadata-and-capability.md), the chapter for the
`metadata` and `capability` units, which is the definition site.

## 19b. Channel

**Defined in** [`allegretto/metadata-and-capability.md` §4](allegretto/metadata-and-capability.md), the chapter for the
`metadata` and `capability` units, which is the definition site.

## 20. Propagation

**Defined in** [`allegretto/metadata-and-capability.md` §5](allegretto/metadata-and-capability.md), the chapter for the
`metadata` and `capability` units, which is the definition site.

## 21. Writer capability

**Defined in** [`allegretto/metadata-and-capability.md` §6](allegretto/metadata-and-capability.md), the chapter for the
`metadata` and `capability` units, which is the definition site.

<a id="def-meta-slot"></a>
## 22. Meta slot

> **Level: IMPLEMENTATION** — realises the binding plane. **The partition is gone (B-120 E5); the names remain.**

**Definition.** A *meta slot* is a binding the engine owns rather than the
user, historically marked by a `__` name prefix. (Distinct from a metadata
field: a meta slot lives on the BINDING plane, §18.)

**Rationale (historical).** The prefix partitioned one shared bindings map
between engine metadata and user fields. That partition was real when type
Contexts and instances shared a namespace; it stopped being real once members
moved to FQN keys inside `__members`, and B-120 E5 deleted the predicate that
expressed it.

**As implemented.** `SLOT_KEYS` and `SLOT_REGISTRY` in `src/slot-accessors.ts` — the
slots themselves, still `__`-prefixed. The predicate
`isMetaSlotKey(key) = key.startsWith("__")` is **deleted**. Its one live
consumer, B-097 V-R1's member-dispatch narrowing, now reads
`isMetaProtocolSlot` — declared membership in a closed set rather than a
prefix over arbitrary keys — and `runtime.ts`'s source attachment names the
two cell families directly (`isFutureBindingName`, `isBareBindingName`).

**Delta.** — *(closed at B-120 E5. The entry recorded that the predicate fired
on exactly one key, `__length`. E4 deleted that key and E5 re-measured before
deleting the predicate: **748 distinct binding keys reached it across 1202
tests and none began with `__`**, so all ten skip-guards were no-ops. What
remains is renaming the slots themselves, which never depended on this
concept — **B-104**.)*

**Still unenforced.** The guards could go because nothing walks a type
structure's entries as fields. That is a property of how members are written,
not an invariant anything checks — delta 30, below, and **B-104** owns it.

<a id="def-the-layer-boundary"></a>
## 23. The layer boundary

> **Level: Specification** — satisfies R6. **This entry absorbs B-110.**

**Definition.** L0 may not depend on L2. A layer supplies its meaning to the
base by **installing** it against a plane interface; the base never imports
the layer.

**Rationale.** R6, and it is the same discipline as §20's
`installFieldMerge`: the base holds an inspectable symbol, the layer
installs what it means. That is what makes Allegro an extension stack rather
than a privileged layer (R1).

**As implemented — and this is the largest delta in the document.** The
evaluator does this **correctly for channels and incorrectly for types, in
the same file.**

- *Correct:* `evaluator.ts` propagates channels through the plane interface —
  `viralFields()`, `metaFieldSpec(k)?.rule === "union"`, `fieldMerge(k)`.
  Layer-ignorant, exactly as R3/SC-7 intend.
- *Incorrect:* it also imports **7 symbols** from two L2 modules
  (`refinements`, `effects`): effect and predicate propagation on
  residuals and results. Argument checking left it at B-112 C2 and
  type-directed dispatch with call-site unification at C3: the evaluator
  runs installed checks and dispatchers, decides nothing, and imports
  nothing from `types-std`. `futures.ts` imports `withType`, `ErrorType`,
  `StringType`.

This violates the project's own stated invariant (`CLAUDE.md`:
*"Dependencies point downward only"*).

**The decomposition that makes it tractable**, found by reading rather than
assumed: `getType(v)` is **literally `metaReadRaw(v, "type")`** plus a kind
check — an L2 alias for an L0 call. So the two halves separate cleanly:

| Half | Nature | Disposition |
|---|---|---|
| **Reading** the type off a value | Already layer-ignorant — a channel named `type` is opaque to the base | Use the plane interface directly; the L2 import is gratuitous |
| **Interpreting** it — `typeMethod` (FQN member lookup), `unifyTypes`, `applyBoundaryBound`, refinement-predicate evaluation, `assertMemberAvailable` | Genuinely L2 semantics | **Installed, not imported** — the `installFieldMerge` shape |

Type-directed dispatch *is* genuinely needed during evaluation — that is R2,
since discharge happens by evaluating — so the fix was never "delete the
import". It is that the evaluator needs a **dispatch hook the layer
installs**, and reads the type through the plane it already uses for every
other channel.

**Delta. → B-110**, now scoped by this entry rather than left open-ended.

<a id="def-plane-interfaces"></a>
## 24. Plane interfaces

> **Level: Specification** — satisfies R3, R6, R12. *Elevated to a
> first-class concern at S2f (maintainer): the interfaces between planes and
> their producers and consumers are a central design feature, not an
> implementation detail of §18.*

**Definition.** A *plane interface* is the sanctioned way a producer or
consumer reaches a plane. Reaching a plane by any other route — a direct
field read, an upward import, a hardcoded name — is a **plane violation**,
whatever it happens to compute correctly.

**Rationale.** §18 says what the planes are; without stated interfaces that
is a taxonomy rather than a discipline. Every delta T2 records is a plane
reached the wrong way, and each was invisible because the right way was never
written down.

**The interface table.** Rows are the sanctioned routes. An entry marked ⚠ is
one the code currently bypasses.

| Plane | Consumer | Interface | Producer | Interface |
|---|---|---|---|---|
| **Data** | Allegretto / Allegro code | **none** — a value *is* its data | construction | the representation constructors |
| **Data** | the host | **none since B-121** — the host's view and the language's are the same view now that no wrapper stands between them. Whether a plane with no reader is a plane properly policed is held open at §11's delta | the host | the representation constructors |
| **Binding** | user code | member dispatch | construction | `makeStructure` + the binding writers |
| **Binding** | engine (meta slots) | `src/slot-accessors.ts` accessors | kernel | the same accessors ⚠ *four write disciplines, §13; and see the disposition note below* |
| **Metadata** | anyone | `metaReadRaw(v, field)` — free (D23) | field owner | the writer closure from registration |
| **Metadata** | the evaluator | the propagation table: `metaFieldSpec(f)?.rule`, `viralFields()`, `fieldMerge(f)` | — | — |
| **Metadata** | user-reachable construction | refused unless the writer is held (`assertNotIntegrityKey`, reading the registry) | — | — |
| **Host** | the host only | direct field access | the host | direct field access ⚠ *declared on the value interface, §18* |
| **Layer → base** | the base, for semantics it must not know | **install**, never import | the layer | `installFieldMerge` and hooks like it ⚠ *27 upward imports, §23* |

**Disposition of the engine/meta-slot row.** It did **not** disappear when
`__length` did. `__length` was the last key the partition test fired on, so
deleting it retired `isMetaSlotKey` (B-120 E4/E5, §22) — but the *interface*
is the accessor layer over engine-owned bindings, and that persists as long as
such bindings exist.

It should nonetheless **shrink to zero**, and D39 already says how:
**14** registered slots are dispositioned as declared **members**. The proof
fields are the precedent and are already executed — `proposition`, `lhs`,
`rhs`, `reason`, `counterexample` are plain-named, engine-written and
user-visible, which puts them on the *ordinary* binding interface rather than
a privileged one. As the remaining 14 follow, this row dissolves into the row
above it and the concept "engine meta slot" stops existing. That is the end
state; the ⚠ is a defect in the interface meanwhile, independent of it.

**The last row is the one that matters.** It is the only interface in the
table that is not yet a mechanism — `installFieldMerge` is one instance of
a pattern that has no general form. The interfaces the specification still
owes:

1. **A dispatch hook — landed (B-112 C3).** The evaluator needs
   type-directed dispatch during evaluation (R2 — discharge happens *by*
   evaluating) and must not know what a type is. The type channel installs
   *how to dispatch on my field* through the gated `installDispatch`, at
   primitive applications and at composed calls (where call-site
   unification rides the same install), and the evaluator runs it with
   opaque values (`allegretto/metadata-and-capability.md` §7).
2. **A check hook — landed (B-112 C2).** A channel installs *how to check
   a value against my field* through the gated `installFieldCheck`, and
   the evaluator runs every installed check with a free reader without
   knowing the answer is a "type" (`allegretto/metadata-and-capability.md`
   §7).
3. **A projection hook.** `shape` is a computed projection of the `type`
   field (§19b), and the projection is hardcoded in `metaReadRaw`. A
   channel should install its own projections.
4. **A field-registration interface for channels** (§19b) — one registration
   that says *these fields, these rules, this semantics, this owner*, rather
   than eleven undifferentiated field registrations performed by the base.

**Rationale for the shape.** All four have the same form, which is why they
belong in one entry: **the base holds an inspectable symbol; the layer
installs the meaning.** That is exactly SC-7's argument (§20) — inspectable
symbols are what keep R12 enforceable — generalised from propagation to every
plane interface. A hook that handed the base an opaque closure *and* let it
be the authority would lose the same property, so the hooks must be
capability-gated the way writers are.

**As implemented.** One of the eight rows has a real mechanism
(`metaReadRaw` + the propagation table); the two Data rows now need none.
Four rows are conventions enforced by lint or by nothing. The layer→base row
has one instance and no general form.

**Delta.** The interfaces are the specification's biggest gap: four hooks are
owed, and every T2 delta is an instance of one of them being absent. **→
B-112**, which supersedes the "what capability does the evaluator need"
question in B-110 by naming it.

---

# T3 · Evaluation

How a program becomes a result, or a residual. This tier is R2 and R4 made
concrete.

<a id="def-partial-evaluation"></a>
## 25. Partial evaluation

> **Level: Specification** — satisfies R2, R4.

**Definition.** *Evaluation* reduces a value as far as its known inputs
allow. Two rules govern what happens when they do not allow much:

- **PE Rule 1.** An application with an unresolved argument produces a
  **residual** — the application itself, as a value — with metadata fields
  propagated onto it per their rules.
- **PE Rule 2.** A lazy primitive whose control input is unresolved evaluates
  **both** branches and residualises, so that what is known on either path is
  still discovered.

**Rationale.** Rule 1 is what makes compilation and execution the same act:
a partially-evaluated program is an ordinary value (SC-3), so there is no
separate IR and no separate checking pass. Rule 2 is what stops an unknown
condition from hiding everything behind it — without it, a single unresolved
`if` would end analysis for the whole branch.

**As implemented.** `evaluate` / `evaluateExpr` in `src/evaluator.ts`;
`isResolved` is the test; `makeExpr` builds the residual. Field propagation
onto residuals runs through the propagation table (§20).

**Delta.** — *(Rule 1 and Rule 2 are implemented as specified; the evaluator's
delta is §23, which is about what it imports, not what it computes.)*

<a id="def-resolved-unresolved-residual"></a>
## 26. Resolved, unresolved, residual

> **Level: Specification** — satisfies R4.

**Definition.** A value is **resolved** when it contains no unresolved part.
It is **unresolved** when it is, or transitively contains, a symbol with no
binding or a pending cell (§28). A **residual** is the value produced when an
operation cannot complete: an Expression standing for the work not yet done,
carrying the metadata the operation could determine.

**Rationale.** R4 requires that "cannot complete" is a *value*, not a stuck
state — that is the whole difference between partial evaluation and an
interpreter that fails.

**As implemented.** `isResolved(v)` in `src/types.ts`, walked structurally.

**Delta.** — 

<a id="def-tail-calls"></a>
## 27. Tail calls

> **Level: IMPLEMENTATION** — realises R4 under a host constraint.

**Definition.** A self-call in tail position is executed as a loop rather
than a nested evaluation, via a sentinel the applying frame recognises.

**Rationale.** Not a language concept — a host stack is finite, and without
this, recursion depth would bound program size. It is in the spine because
the sentinel is visible to anything wrapping a function body: body wrappers
must **forward** it or tail calls silently become ordinary calls.

**As implemented.** The `TailCall` sentinel in `src/evaluator.ts`
(`isTailCall`, `makeTailCall`); `markTailCalls` in the pipeline;
`type_check` and the `*_attach` wrappers forward it.

**Delta.** The forwarding obligation is enforced by convention and a
recurring-lesson note in `PROCESS.md` §6 — nothing checks it. A wrapper that
forgets is a silent performance cliff, not an error. Candidate for a boundary
invariant. **→ B-113.**

<a id="def-future-cell-and-completion"></a>
## 28. Future cell and completion

> **Level: Specification** — satisfies R10.

**Definition.** A **cell** is a binding whose value is not yet available.
References to it residualise. When the value arrives the cell is filled —
once, monotonically — and everything that residualised on it is re-evaluated.
This is **forward chaining**, and it is how information arriving later
(a module load, an async result) re-enters an evaluation that already ran.

**Rationale.** R10. Without it, PE would be a single pass and anything
unknown at that instant would be permanently residual. Monotonicity is what
keeps it sound: a cell that could change would invalidate results already
derived from it.

**As implemented.** `Binding.value === undefined` is the pending state, with
`cell`, `isComplete` and `incompleteDeps` on the binding (§14);
`FutureManager` in `src/futures.ts`; `applyPhase` drives the cascade;
`propagateCompletions` in `src/runtime.ts` substitutes into complete
dependents.

**Delta.** Confluence is not guaranteed by construction. The B-028 arc found
an **arrival-order** bug — an instance kept a stale symbol when one field
resolved before another — fixed by completion replacement, but nothing
*establishes* that arrival order cannot matter. This is candidate **R16**
(determinism) with no specification item and no test that would catch a
recurrence. **→ B-114.**

<a id="def-the-evalsource-pipeline"></a>
## 29. The evalSource pipeline

> **Level: IMPLEMENTATION** — realises R2, R9, R14.

**Definition.** The fixed stage order that turns source into a result:
parse (grammar2, with `use` pre-scan and fragment merge) → `typeLiterals` →
`resolveSymbols` → `markTailCalls` → `collapseBodyMetadata` +
`precompileFunctions` → `buildEvalCtx` → the evaluation loop with forward
chaining. Then post-passes: effects declarations, exhaustiveness,
termination, the proof-finding loop, proven clauses.

**Rationale.** The order is what each stage may assume. `resolveSymbols`
before `markTailCalls` because a tail call is recognised by its callee;
`collapseBodyMetadata` before `precompileFunctions` because analysers read
properties rather than peeling wrappers.

**As implemented.** `evalSource` in `src/runtime.ts`.

**Delta.** The **post-passes are L2 concepts running in the L0/L1 pipeline** —
effects, exhaustiveness, termination, proofs. This is §23's violation in its
other form: not an import into the evaluator, but layer stages hardcoded into
the base's stage list. A layer should *register* a post-pass. Same root, same
fix shape (§24). **→ B-110** (scope note).

---

# T4 · Types

Where Allegro Standard begins. Everything here is built **on** T0–T3 and
none of it is known to the base — or should not be (§23).

<a id="def-type"></a>
## 30. Type

> **Level: Specification** — satisfies R2, R3. *L2 concept; the base knows
> only the metadata field it rides on.*

**Definition.** A *type* is a value that constrains other values. It is an
ordinary Structure (§9) whose bindings are engine-owned slots — a name, a
member set, optionally a constructor, a refinement parent, a predicate. A
value carries its type in the `type` **field** of the metadata plane, which
is why a type can be attached to anything without changing its kind.

**Rationale.** Types being values is what makes the type system an extension
rather than a privileged layer (R1, R6): `Type.define` is an ordinary call
returning an ordinary value. It is also what makes PE-as-discharge possible
(R2) — a type check is an evaluation, not a separate pass.

**As implemented.** `src/types-std.ts`; type Contexts built by `makeStructure`
plus the `src/capability.ts` writers; `getType(v)` is `metaReadRaw(v, "type")`
with a kind check.

**Delta.** The **type Context namespace is closed** — a user field named
`name` is routed into `__members` under an FQN key and never lands beside
`__name` — but nothing states or enforces that. It is the property S1
measured and the reason the dunder partition was unnecessary; it deserves to
be an invariant rather than an accident. **→ B-107.**

<a id="def-kind-and-meta-type"></a>
## 31. Kind and meta-type

> **Level: Specification** — satisfies R2.

**Definition.** A type is itself a value, so it too carries a `type` field.
That field's value is its **meta-type**, and a meta-type that other types are
instances *of* is a **kind**: `Type`, `Refinement`, `Interface`,
`GenericType`, `Effect`, `Proof`. `Type` is its own meta-type — the tower
bottoms out by self-reference rather than by a special case.

**Rationale.** Uniformity: "what is this?" is one question with one mechanism
at every level, which is what lets `instanceof` work on a type as readily as
on a number. Self-typing avoids a privileged root that would need its own
rules.

**As implemented.** `writeShape(Type, Type)` at module init in
`src/types-std.ts`; `isTypeMeta` recognises a kind in the Type tower.

**Delta.** — 

<a id="def-shape"></a>
## 32. Shape

> **Level: Specification** — satisfies R2. **Distinct from §34.**

**Definition.** The *shape* of a value is what runtime dispatch uses: its
type with **member-transparent refinement layers walked off**. A refinement
layer is member-transparent when it carries a predicate and shares its
parent's member set by reference; layers that mint their own members
(`preserveOps`, `mixin`, `extend`) are shapes in their own right, because
their overrides must run.

**Rationale.** Dispatch is virtual on the actual shape so overrides run
(Liskov). A refinement that adds *no* members adds no behaviour —
`PositiveInt(5)` dispatches exactly as `5` does — so walking those layers off
keeps knowledge from changing which code executes.

*Corrected at S4b (maintainer).* An earlier draft said "refinements are
knowledge, **not** different behaviour", full stop. That over-claimed and
would make refinements second-class. **A refinement may add behaviour**, and
when it does it stops being member-transparent and becomes a shape in its own
right — which is exactly what the walk already tests. `NonEmptyList` is the
motivating case rather than a contrived one: its `head` is **total**
(`T`, not `Option[T]`), and the refinement is precisely what makes that
signature sound. `SortedList.binarySearch` and `Utf8Bytes.chars` are the same
shape of argument.

So the accurate statement is a **split**, not a prohibition:

| Refinement | Member set | Dispatch |
|---|---|---|
| adds no members | shared with parent by reference | transparent — walks off |
| **mints its own members** | fresh | **is a shape** — its members dispatch |

The mechanism already supports the second case (`preserveOps`, `mixin`,
`extend` are named in `typeShape`'s own comment as minting their own member
sets and therefore being shapes). The document, not the code, was the thing
that made refinements sound second-class.

**As implemented.** `typeShape(t)` in `src/slot-accessors.ts`, walking `__refines`
while `__members` is the same object. `shape` is registered as a metadata
field but stores nothing — it is a **projection** of `type` (§19b).

**Delta.** The projection is hardcoded in `metaReadRaw` rather than
installed by the typing channel. **→ B-112(c).**

<a id="def-member-and-member-symbol"></a>
## 33. Member and member symbol

> **Level: Specification** — satisfies R6, R14. Choice: **SC-4**.

**Definition.** A *member* is a named capability a type provides — a field, a
method, or a law. Members are keyed not by their spelling but by an interned
**member symbol** with a fully-qualified name, so two types may each declare
`size` without either conforming to the other. **Conformance is symbol
membership**: a type conforms to another when it holds that type's member
symbols, which it obtains by *drawing* them.

**Rationale.** D44 dissolved declared inheritance into conformance (drawing
symbols) + refinement + composition. Making conformance an identity question
rather than a spelling one is what removes the name-collision false positive
the nominal chain-walk used to produce.

**As implemented.** `__members` is a Context keyed by member FQN;
`memberBindingByName` projects a base name through the kernel scope;
`typeMethod` resolves.

**Delta.** — 

<a id="def-declared-and-loose-conformance"></a>
## 33b. Declared and loose conformance

> **Level: Specification** — satisfies R6, R14. *Added at S3b (maintainer):
> the document used the word "loose" six times without defining it.*

**Definition.** Two ways a value's type can satisfy an expected type:

- **Declared conformance** — the actual type holds the expected type's
  **member symbols**, obtained by *drawing* them (§33). Identity, not
  spelling. Two types that each spell `size` do not conform.
- **Loose conformance** — the actual type has members with the same **base
  names**. Spelling, not identity. This is duck typing, and it is the surface
  aimed at plain data.

Which applies is a property of the **expected** type: an expected type that is
**anonymous** takes the loose path; a named one takes the declared path.

**Rationale.** Declared conformance is what makes conformance intentional —
D44 dissolved inheritance into *drawing symbols*, so conforming is an act
rather than a coincidence. But that is too strict for data arriving from
outside a program's own declarations, so `~T` (§38) and anonymous inline
types provide the loose surface deliberately. **Anonymity is the switch**: it
is exactly what `~T` erases, and it is why the loose path needs no separate
marker.

**As implemented.** `structuralSubtypeof` in `src/types-std.ts`; the branch
is `isInterfaceType(typeB) || getTypeNameFromCtx(typeB) !== null` → declared,
else loose. The code's own comment states it: *"the LOOSE path (~T structural
wraps, anonymous inline types) matches by base-name projection — the
duck-typing surface, aimed at data values."*

**Delta.** The branch tests the `__interface` marker **as well as** anonymity.
Today that is redundant and the marker measures 0-decisive at both subtypeof
sites (§36) — but *not* because "an interface always has a name", which an
earlier draft asserted and which is **an unenforced assumption that is
already false**. `Interface.define` sets `"<anonymous>"`, so interfaces built
that way are named; `structuralWrap` **erases the name**, so `~SomeInterface`
is a nameless interface. It does not show up in the measurement only because
the wrap erases the marker too.

The assumption therefore holds by *coincidence of two erasures*, not by
construction, and §36 records that replacing the marker with a meta-type test
here would break exactly this case. Anonymity is the correct switch; nothing
else should be consulted. **→ B-104(g).**
**→ B-104(g).**

*Note on §36.* "`~Printable` **is** an interface and it is **also** loose"
means exactly: it is declaration-only (drawn from, not instantiated), **and**
it matches by base name rather than by drawn symbols. Two independent facts
about the same type. Saying it without §33b defined was the reason it read as
a contradiction.

<a id="def-knowledge"></a>
## 34. Knowledge

> **Level: Specification** — satisfies R2, R3. **Distinct from §32.**

**Definition.** *Knowledge* is everything established **about** a value that
does not change what it is: an imputed refinement bound, abstract domains,
predicate sets. One monotonic lattice, with two carriers — **intrinsic**
(certified at construction, rides the value) and **occurrence** (flow-derived,
in the scope facts plane) — meeting at each use. Knowledge is the **static
gate** that lets PE resolve a call at compile time; shape is what dispatches
at run time.

**Rationale.** The split (D36) is why an annotation can *narrow* without
changing behaviour: `x: Animal` over a Dog hides Dog's members from that
occurrence while the Dog's own methods still run. Fusing the two would make
every annotation a coercion.

**As implemented.** `knowledgeOf(v)` in `src/refinements.ts` — reads the
stored `type` field, derives the bound by comparing it to `typeShape`, adds
`predicatesOf(v)` and the occurrence bound.

**Delta.** `knowledge` is registered as a metadata field but **nothing ever
stores one** — it is a channel (capability) whose storage is three other
fields plus the refinement layers (§19b). The registry cannot express that.
**→ B-111.**

<a id="def-abstract-domain"></a>
## 34b. Abstract domain

> **Level: Specification** — satisfies R2. *Added at S4b (maintainer): the
> document used "domain" in four entries without defining it.*

**Definition.** An *abstract domain* is a **compile-time summary of a set of
values** — an interval, an equality, a known-not-equal, an effect set, or
opaque (nothing known). It is what a predicate is recognised *as*, so that
reasoning can proceed without re-running the predicate: given `x: Int & _ > 0`
and `y: Int & _ > 0`, the domains say `x + y > 0` without evaluating anything.

**Rationale.** R2 again, in its cheap form. PE could always discharge a
refinement by *evaluating* the predicate, but that requires a concrete value.
A domain lets the same reasoning run over a *residual* — which is the whole
point of partial evaluation, and the difference between "checked when it runs"
and "discharged at compile time".

Domains are **approximations**: they answer "definitely yes" or "cannot tell",
never "definitely no" by omission. That soundness direction is what lets them
be consulted freely — a domain that cannot tell falls back to evaluation.

**As implemented.** `AbstractDomain` in `src/refinements.ts` with
`IntervalDomain`, `EqualDomain`, `NotEqualDomain`, `EffectsDomain`,
`OpaqueDomain`; `domainFromPredicate` recognises the algebraic shape of a
predicate; `impliesDomain` is the entailment test; the domain rides the host
plane as `abstractDomain`.

**Delta.** The domain rides the **host plane** on a type (a JS property),
while the knowledge it belongs to (§34) is a metadata channel. §18's placement
rule was never applied: it is derived-and-cached, which argues host plane, but
nothing states that and it makes `knowledge` a capability whose fields span
two planes. **→ B-111.**

<a id="def-refinement"></a>
## 35. Refinement

> **Level: Specification** — satisfies R2.

**Definition.** A *refinement* is a type plus a predicate: `Int & _ > 0`. It
shares its parent's member set (making it member-transparent, §32), carries
the predicate, and optionally an **abstract domain** — a compile-time
summary the evaluator can reason with instead of re-running the predicate.

**Rationale.** This is where "types are predicates" stops being a slogan: a
refinement literally *is* the parent's constraint conjoined with one more,
and PE discharges it by evaluating the predicate against what it knows.

**As implemented.** `buildRefinedType` in `src/types-std.ts`;
`domainFromPredicate` recognises algebraic shapes;
`RefinementKind = buildRefinedType(Type, declarationOnlyPredicate)`.

**Delta.** — 

<a id="def-interface"></a>
## 36. Interface

> **Level: Specification** — satisfies R6, R14. **Resolves B-104(g).**

**Definition.** An *interface* is a type that exists **to be drawn from
rather than instantiated**. Conformance to it is ordinary symbol membership
(§33); there is no declared is-a edge.

*Corrected at S3b (maintainer).* An earlier draft said the definition **is**
`InterfaceKind`'s predicate — *"has no `construct`"*. That is what the
predicate tests, but it is not the concept, and the alternative offered —
*"all members are signature-only"* — does not survive either:
`Type.define({v: Int})` has only signature members (a field) **and** a
construct, so that reading would make every plain record an interface.

The accurate statement is that **two different properties are enforced in two
different places**, and neither is the definition:

| Property | Enforced by | Checkable from the value? |
|---|---|---|
| No construct | `InterfaceKind`'s predicate — `getConstruct(t) === undefined` | **yes** |
| All members signature-only | `Interface.define`'s *construction* — it accepts a method body and stores it as a **signature**, discarding the implementation (measured) | **no** |

*Why they collapse here and would not elsewhere.* "Has no construct" reads
like **abstractness**, and in a language with inheritance an abstract type
(no constructor, some implementations) is a different thing from an
interface (no implementations, drawn from). **Allegro has no abstract
types** — D44 deleted the declared is-a edge, and abstractness is defined by
what you can *extend*. With nothing to extend, "cannot be instantiated" and
"exists to be drawn from" have no daylight between them, so the predicate
happens to select exactly the interfaces. That is a property of this type
system, not a general truth, and it is worth writing down precisely because
the type system is being rebuilt around the absence of `extends`.

**Rationale.** Declaration-only is a *property of the type*, checkable, not a
flag someone sets. Making the kind's predicate the definition means
"is this an interface?" has one answer with one mechanism.

**As implemented.** `InterfaceKind = buildRefinedType(Type,
declarationOnlyPredicate)` where the predicate is `getConstruct(t) ===
undefined`; `Interface.define` builds the type, stamps meta `InterfaceKind`,
**and additionally sets a `__interface` marker binding**.

**Delta — and the definition settles it.** The marker is doing **two jobs
with one bit**, which is why its two readers disagree:

| Reader | What it wants from the bit | Correct source |
|---|---|---|
| `applyBoundaryBound` | *is this an interface?* | the meta-type — `InterfaceKind` |
| `shapeAwareSubtypeof` | *is this in the LOOSE, base-name world?* | **anonymity** — no name |

`structuralWrap` erases the marker **and** the name together, so `~Printable`
reads as "not an interface" to the first and "loose" to the second, from one
erasure. But those are **orthogonal facts**. `~Printable` has no construct —
interfaces have none to copy — so it *satisfies `InterfaceKind`'s own
predicate*. It **is** an interface, and it is *also* in the loose world.
(Maintainer ruling, 2026-08, now derivable from the definition rather than
asserted.)

So the resolution is to stop conflating them:

- **`shapeAwareSubtypeof` and `structuralSubtypeof`** — drop the marker check
  from both, **and do not replace it with a meta-type test.** (There are
  **three** readers, not two: a first pass counted only two.) The condition
  becomes anonymity alone. The marker measures **0-decisive at both** today:
  42 interface encounters each, none where it changed the outcome.

  ⚠ **The measurement does not license replacing it, and the maintainer
  caught why.** "0-decisive" means *marker-true AND nameless never co-occur*
  — which holds **because `structuralWrap` erases the marker**. Swap in a
  meta-type test and the case is *created*: `~Printable` keeps meta
  `InterfaceKind` (measured) and has **no name** (measured), so it becomes
  interface-true and nameless — the very combination the measurement said
  did not occur — and it would take the *declared* path instead of the loose
  one. That is a regression, and it is a regression my own proposed change
  would have introduced. The measurement described the code as it stands, not
  as it would stand after the change; **a delta measured before a change does
  not survive the change**, and that is worth stating as a method rule.

  So: at these two sites the question is *loose or declared*, whose answer is
  **anonymity** and nothing else. At `applyBoundaryBound` the question is *is
  this an interface*, whose answer is the meta-type. The two sites diverge,
  and that divergence is the whole point of §36.
- **`applyBoundaryBound`** — read the meta-type. `~Printable` becomes an
  interface here, which is the behaviour change, and per the definition it is
  a **fix**. That path has **zero suite coverage** (0 hits in 1197 tests;
  fires immediately on a written case), so coverage lands first.
- **`structuralWrap`** — nothing to erase; it already erases the name, which
  is the loose-world signal, and it should *not* re-stamp the meta-type.
  (This retracts the re-stamp I proposed before the definition existed.)
- **`__interface` is deleted.**

**A second delta, from the correction above.** The two properties are
enforced independently and **nothing ties them**: the predicate is checkable
from any value, the signature-only guarantee holds only for types built by
`Interface.define`, and a type could satisfy the kind's predicate without
having been built that way. `Interface.define` also **silently discards** a
method body handed to it — `Interface.define({greet: self => "hi"})` records
`greet` as a signature and drops the lambda, with no diagnostic. Either
reject the body or state that it is a declaration. **→ B-116.**

**→ B-104(g)**, now specified rather than open.

<a id="def-generic"></a>
## 37. Generic

> **Level: Specification** — satisfies R2.

**Definition.** A *generic* is a type constructor: a type **parameterised**,
applied to yield a concrete type.

*Corrected at S4b (maintainer).* An earlier draft said "parameterised over
other **types**". Too narrow: Allegro needs types parameterised over **values
of any type** — `Vector[3]`, `Matrix[3, 4]`, a units quantity over its
dimension exponents. The parameter's *kind* is what varies, and the machinery
already admits non-Type kinds (`apply[e: Effect](…)` binds an Effect-kinded
parameter, C7.2c). Which kinds of parameter the language will actually offer
is **open** — recorded as a design question, not settled here. `GenericType` is the kind of
such constructors — the flag *is* the kind (D39), there is no `__isGeneric`.
An applied concrete records its arguments and a back-link to its generic.

**Rationale.** Application is ordinary evaluation (R2), so a generic is a
function over types and instantiation is a call — no separate mechanism.

**As implemented.** `applyGenericType`, `isGenericType`; `genericParams` on
the underlying ComposedFunction; `__args`/`__generic` on applied concretes.

**Delta.** `__args` and `__generic` are host-read instance data with **no
language surface** — deferred consciously at C7.2 ruling R1, still deferred.
Recorded so the deferral stays visible. **→ B-107.**

<a id="def-identity"></a>
## 38. Identity: distinct, structural wrap, equality shape

> **Level: Specification** — satisfies R2. Choice: **SC-4**.

**Definition.** Three operations on identity rather than on structure:

- **`distinct`** mints *fresh member symbols*, so a newtype does not conform
  to its parent — non-conformance falls out of membership, with no is-a edge
  to break.
- **structural wrap (`~T`)** erases the name, projecting the type into the
  **loose** world where matching is by base name rather than declared symbol
  identity. Orthogonal to what kind the type is (§36).
- **equality shape** walks the *full* refinement chain to the representation
  root — further than dispatch shape (§32) — because refinements are
  knowledge and never separate equal values: `PositiveInt(5) == 5`.
  `distinct` mints no refines edge, so it stays its own equality shape.

**Rationale.** Each is a different question about sameness — conformance,
matching, equality — and each gets its own walk. Collapsing them is what
produced the `~Printable` confusion (§36).

**As implemented.** `buildDistinctType`, `structuralWrap`, `equalityShape` in
`src/slot-accessors.ts`.

**Delta.** — 

<a id="def-law-and-coercion"></a>
## 39. Law and coercion

> **Level: Specification** — satisfies R2; Allegro-side of R12.

**Definition.** A *law* is a proposition declared as a member, discharged at a
recorded **tier** (proved / sampled / admitted). A *coercion* is a declared
conversion between equality shapes; without one, values of different
equality shapes are simply unequal rather than convertible.

**Rationale.** Both are the "nothing is silently trusted" surface: a law that
cannot be proved is admitted *visibly*, with its tier in the ledger, rather
than assumed.

**As implemented.** `law_`-prefixed spec entries become Law descriptors;
`stampLawBacking` and `backingsOf` carry the transitive backing set;
E-R1–E-R6 in `equality-and-laws.md`.

**Delta.** The transitive backing set rides a **host-plane property**
(`lawBackings`) while the per-proof backing is a data binding — two carriers
for one concept, split by aggregation depth rather than by meaning. Nothing
says which a reader should use. **→ B-115.**

---

# T5 · Obligations

What Allegro claims, and how those claims are discharged. Everything here
rests on R2: an obligation is discharged by **evaluating** it, not by a
separate proof engine.

<a id="def-effect"></a>
## 40. Effect

> **Level: Specification** — satisfies R2, R3.

**Definition.** An *effect* is a label naming something a computation does
beyond producing a value — `io`, `time`, `net`, `div`. A value carries the
**set** of effects that produced it, in the `effects` field of the metadata
plane, propagated by `union` (§20). The base defines no labels: they are
extension vocabulary.

**Rationale.** Union propagation is why effect tracking needs no separate
pass — a result's effects are its arguments' effects merged, computed by the
same machinery that carries every other field. That the base defines no
labels is R6: Allegretto knows *that* effects union, never *what* `io` means.

**As implemented.** `EffectSet` in `src/effects.ts`; `withEffects`/`effectsOf`;
`installFieldMerge("effects", …)` supplies the union — the one instance of
declared propagation (SC-7) working (§20).

**Delta.** — 

<a id="def-declared-and-inferred-effects"></a>
## 41. Declared and inferred effects

> **Level: Specification** — satisfies R2; CE-R1.

**Definition.** A function's effects may be **inferred** (accumulated from
what it transitively calls) or **declared**. A declaration is not a hint: it
is a **contract**, and an inferred effect the declaration does not admit
**halts compilation**.

**Rationale.** CE-R1. A declaration that could be silently exceeded would
make effect annotations decorative, and Allegro's claim is that nothing is
silently trusted — so the asymmetry is deliberate: declaring *more* than you
use is allowed, declaring *less* is an error.

**As implemented.** `inferredEffects` (host plane) on the function;
`checkEffectsDeclarations` in the post-pass list; `declaredEffectsAst` from
the body-form collapse.

**Delta.** The inferred set rides the **host plane**, so it is invisible to
the metadata plane's rules and to anything reflecting on a function. That is
probably right — it is derived, not carried — but nothing says so, and §18's
placement rule was never applied to it. **→ B-107.**

<a id="def-totality"></a>
## 42. Totality

> **Level: Specification** — satisfies R2; T-R series.

**Definition.** *Totality* is two separate claims: **exhaustiveness** (a
match over a finite type covers it) and **termination** (a recursive
function's recursion is well-founded, witnessed by a `decreases` metric or by
structural descent). Neither is assumed; both are analysed.

**Rationale.** They are separated because they fail differently and are
believed at different strengths — a non-exhaustive match is an *information*
notification (CE-R8), a failed termination claim is an error. Fusing them
would force one severity on both.

**As implemented.** `src/totality.ts` — SCC/Tarjan over the call graph,
`decreases` metric readers, HOF edges; `checkExhaustiveness` and
`checkTermination` in the post-passes.

**Delta.** Both are **post-passes hardcoded into the base pipeline** (§29) —
L2 analyses in the L0/L1 stage list. **→ B-110.**

<a id="def-divergence-and-discharge-tiers"></a>
## 43. Divergence and discharge tiers

> **Level: Specification** — satisfies R2; D31/D34.

**Definition.** *Divergence* — possible non-termination — is a **computed
effect**, `div`, not a separate analysis result: it rides the effects field
like any other label. Its obligation is discharged at one of four recorded
**tiers**: **auto** (the analysis proved it), **witnessed** (a supplied
metric), **admitted** (a declared axiom — `assume terminates`), or
**undischarged**.

**Rationale.** Making `div` an effect (D31) is what lets termination
participate in the machinery that already exists rather than needing its own
propagation. The tiers (D34) are the "nothing is silently trusted" surface:
an admitted claim is *visible* in the ledger rather than assumed, so the cost
of admitting is disclosure rather than dishonesty.

**As implemented.** `DivTier = "auto" | "witnessed" | "admitted" |
"undischarged"` in `src/totality.ts`; `div` is a real effect label
(`eff.has("div")` in `src/runtime.ts`); `divObligations` reaches the Verdict.

**Delta.** The T-R6 inlining cutoff (which stops PE speculatively unfolding
recursive calls) was **broadened on measurement without a soundness review**
— it now keys on SCC cycle membership. Recorded at the time as pending.
**→ B-100.**

<a id="def-proof-and-discharge"></a>
## 44. Proof and discharge

> **Level: Specification** — satisfies R2, R12.

**Definition.** A *proof* is a value carrying a proposition and, when it has
been checked, a **discharged** mark. Discharge is not a separate act: PE
evaluates the proposition, and a proposition that evaluates to true *is*
discharged. The mark is written only by the kernel, through the writer
capability (§21) — it is the canonical integrity field.

**Rationale.** R2, exactly: "discharge is the same act as computing" is
literal here. R12 is why the mark cannot be a plain field — a forgeable
discharge mark would make every proof worthless.

**As implemented.** `proof_check` and the proof constructors in
`src/primitives.ts`; `checkProofs` in `src/proofs.ts`; the proof's data
fields (`proposition`, `lhs`, `rhs`, `reason`, `counterexample`) are plain
bindings, and `discharged` is the integrity field.

**Delta.** `discharged` is the **last metadata field still on the binding
plane** — it registers with `bindingKey: "__discharged"` while every other
field lives in `meta` (`allegretto/metadata-and-capability.md` §2). **→
B-104** (retiring the `__*` slot names).

<a id="def-obligation-verdict-and-the-assumption-ledger"></a>
## 45. Obligation, verdict, and the assumption ledger

> **Level: Specification** — satisfies R2, R12. **Where sufficiency gap S1
> lands (`docs/records/concepts-analyses.md` §2.3).**

**Definition.** An *obligation* is a claim a compilation must settle. A
**verdict** is the whole-program record of how every obligation was settled —
theorems, totality findings, div obligations, liveness dispositions — and the
**assumption ledger** is the part of it listing what was *admitted* rather
than proved. The verdict is the artifact on which "nothing is silently
trusted" is actually delivered: a claim is either discharged or visible.

**Rationale.** Per-value metadata cannot express this. A verdict is an
aggregate over a *compilation*, not a property of any value, which makes it
structurally different from everything in T2.

**As implemented.** `Verdict` in `src/pcp.ts` — `theorems`,
`totalityFindings`, `divObligations`, `liveness`; `CompilationReport` and
`Notification` in `src/runtime.ts`.

**Delta — restated at S4b; the first version was wrong.**

S4 claimed this as a **requirement gap** (candidate R15, since withdrawn;
`docs/book-changes.md` logs it): the requirement set
is per-value, the verdict is program-level, therefore nothing enables it. The
maintainer's counter is correct and better: **a program is a value**, and
accumulating metadata across an expression *is what channel operations
already do*. Effects union upward; errors are viral; `div` is an effect and
so unions too. On that model the verdict simply **is** the top-level value's
accumulated metadata, and it is each channel's job to define an accumulation
that reaches it. No new requirement is needed — R3 plus SC-7's `union`
already say it.

So the gap is not in the requirements. It is that **the implementation does
not work that way**, and the evidence is direct:

- `buildVerdict` **walks `evalCtx.bindings` out-of-band**, iterating top-level
  bindings looking for discharged proofs, rather than reading accumulated
  metadata off a value.
- The `warnings` field is registered with rule **`union`** — precisely the
  accumulating discipline — and is **unused**. The mechanism for exactly this
  exists and nothing reaches for it.

**And this explains §46.** Contracts are missing from the verdict *because
contracts have no accumulating field*. Under out-of-band assembly, adding
them means adding a case to `buildVerdict`; under accumulation it means
giving contracts a field with `union` propagation, and they arrive for free.
A channel that does not accumulate is simply absent from the verdict — which
is a much better account of §46 than "somebody forgot".

**Candidate R15 is withdrawn.** The finding is an implementation delta and a
significant one. **→ B-117.**

<a id="def-contract"></a>
## 46. Contract

> **Level: Specification** — satisfies R2; CT-R series.

**Definition.** A *contract* is a claim about a function's use: a
**precondition** (`requires`) the caller must satisfy, a **postcondition**
(`ensures`) the function guarantees. An **invariant** is not a third thing —
it is a refinement layer on a type (§35), which is why it persists down a
chain without an inheritance policy carrying it.

**Rationale.** CT-R4: invariants *are* refinements, so "does this invariant
still hold on a subtype?" is answered structurally rather than by a rule
about inheritance — which matters here because D44 removed inheritance.
CT-R1: a `requires` discharges at one call site and residualises at another,
because PE evaluates it against the knowledge the actual arguments carry.

**As implemented.** `requires` derives branch predicates tagged with a
`"requires"` source and narrows the scope facts plane; invariants are `&`
refinement chains; failure **halts** (CT-R2) while a construction-path
invariant failure yields an error *value* (CE-R8).

**Delta.** **Contracts never reach the verdict.** `src/pcp.ts` contains
**zero** occurrences of "contract", "requires" or "ensures". So an
undischarged precondition is a pending obligation in D34's sense that reaches
`inspect` only — a project can read a clean verdict while carrying unproven
preconditions, which contradicts §45's whole purpose. Recorded as CT-R6 and
still open. **→ B-057.**

## Deltas raised in T0–T5

| # | Delta | Owner |
|---|---|---|
| 2 | ~~`types.ts` header says "Five value kinds"; there are seven~~ **CLOSED C9** | B-107(c) |
| 5 | `ParamValue.predicates` — reserved, no reader, asserted empty | B-107 |
| 7 | ComposedFunction's analysis metadata rides the host plane, invisible in its declared shape | B-118 |
| 9 | ~~Three names for one concept: `Structure` / `StructureValue` (2) / `ContextValue` (701)~~ **CLOSED C9** | B-107(a) |
| 10 | ~~`MultiValueType` names a kind D46 retired~~ **CLOSED C9** | B-107(b) |
| 12 | ~~`structure.ts` documents two planes; there are four~~ **CLOSED C9** | B-107(c) |
| 13 | ~~Three binding write disciplines, no stated rule~~ **CLOSED C9** — the rule is stated, and the reason there are four is that the map and the list are **not aliases** | B-107(e) |
| 15 | ~~Host-plane fields declared on the value interface they are said not to be part of~~ **CLOSED C9** | B-107(f) |
| 17 | ~~`__length` is the sole remaining job of the partition test~~ **CLOSED B-120 E4/E5** — `__length` went with the dense region, and the partition test went after it | B-120; B-104(f) closed |
| 18 | ~~The host plane is declared inside the value interface — a plane contradicted by its own type~~ **CLOSED C9** (`StructureHostFields`) | B-107(f) |
| 19 | ~~The base registers eleven L2 fields itself~~ **CLOSED 2026-08 (C3)**: five remain, of which two (`error`, `source`) are Allegretto's own — verified under `--base` — and three await B-111. The by-name special-cases in `metaReadRaw`/`buildWriter` remain | B-109(a) done; special-cases → B-112(c) |
| 21 | ~~Integrity enforced by hardcoded name list, not the registered flag; the two disagree about `source`~~ **CLOSED 2026-08** — the guard reads the registry, `source` carries the flag, and the bare-name check that conflated the binding and metadata planes is gone | B-109(b)(c) |
| 22 | ~~The meta-slot partition fires on one key in the whole suite~~ **CLOSED B-120 E5** — re-measured after `__length`'s deletion (748 distinct keys, zero `__`-prefixed) and the predicate deleted; the slot RENAME is what remains | B-120; rename → B-104 |
| 23 | **L0 imports 27 symbols from L2**; `checkArgType` lives in the evaluator | B-110 |
| 19b | One word and one registry for two concepts — fields, a projection, a capability, a dead entry and an unused one, undifferentiated | B-111 |
| 24 | **Four plane interfaces are owed**: dispatch hook, check hook, projection hook, channel registration. Every other T2 delta is an instance of one being absent | B-112 |
| 27 | The TailCall forwarding obligation is convention-enforced; a wrapper that forgets is a silent cliff | B-113 |
| 28 | Completion confluence is not guaranteed by construction — the B-028 arrival-order bug was fixed, not precluded | B-114 |
| 29 | L2 post-passes are hardcoded into the base pipeline — §23's violation in its other form | B-110 |
| 30 | The type-Context namespace is closed by construction but nothing **enforces** it — *stated* at C9, **re-measured at B-120 E5** (748 distinct binding keys reached the field walks, none `__`-prefixed), enforcement still outstanding and now the only thing standing between the deleted partition and a future writer | B-104 |
| 32 | The `shape` projection is hardcoded in `metaReadRaw` rather than installed | B-112(c) |
| 34 | `knowledge` is a registered field that nothing ever stores — a channel, not a field | B-111 |
| 33b | The `structuralSubtypeof` branch tests the marker *and* anonymity; anonymity always carried the distinction | B-104(g) |
| 36 | **`__interface` does two jobs with one bit**; its **three** readers want different facts | B-104(g) — now specified |
| 36 | Interface's two guarantees are enforced independently; `Interface.define` **silently discards** a method body | B-116 |
| 37 | `__args` / `__generic` are host-read with no language surface, deferred since C7.2 | B-107 |
| 39 | Law backings ride two carriers split by aggregation depth, not by meaning — one of them host-plane | B-115, B-118 |
| 41 | Inferred effects ride the host plane; §18's placement rule was never applied | B-118 |
| 42 | Exhaustiveness and termination are L2 post-passes in the base pipeline | B-110 |
| 43 | The T-R6 cutoff was broadened on measurement without a soundness review | B-100 |
| 44 | `discharged` is the **last** metadata field still on the binding plane | B-104, B-109 |
| 46 | **Contracts never reach the verdict** — zero occurrences in `pcp.ts` | B-057 (CT-R6) |
| 34b | The abstract domain rides the host plane while the knowledge it belongs to is a metadata channel | B-118 |
| 45 | **The verdict is assembled out-of-band** rather than accumulated through the metadata plane; the `union` field for it exists and is unused | B-117 |

### What B-108 settled (D48)

The composite review, run after C9 and ruled by the maintainer. Its premise —
*these three choices cannot be judged separately* — held: **IC-1 could not be
decided at all, it dissolved**, and it would have been decided wrongly if
taken first.

**The doubt was aimed one level too high, and that is the finding.** "Did
unifying the composites actually simplify things?" was carried for years as a
question about D1. D1 is **SC-5**, it is specification, and it is *upheld* —
one composite kind is a win under R1. What the review found is that the cost
was pushed downward: kinds went 2 → 1 while configurations went 2 → 4, and
74% of every structure allocated became the configuration that exists only to
hold **one** metadata field. The question could not be answered while the
levels were fused, which is precisely what Part 0 exists to prevent.

**Three measurements did the deciding, and two overturned the reasoning.**

- Data structures average **4.6 slots** (97% ≤ 8) while every large by-name
  lookup lives in a **scope**, of which there are **227**. The O(n) objection
  that had ruled out a sequence-first composite for years was about an
  operation that happens 10,309 times, against an indirection that happens
  453,199 times. → **E**.
- **56,123 carriers**, more than there are Bits values, **98.5% holding
  exactly one field**. → the carrier goes; metadata becomes a field on every
  value.
- **33.6% of attachments target an already-attached object.** This one did
  not overturn anything — it *defended* copy-on-attach, and it rules out
  both no-allocation designs at once, including the side table nobody had
  listed.

**And the maintainer's question changed the answer's shape.** The review had
framed IC-3 as "make attachment cheaper". Asked why values are cloned to
receive metadata at all, the honest answer is that most of them should never
have existed without it: 12 call sites literally read
`withMetadata(makeInt(0), m)`, one of them being PE Rule 1. So D48(c) rules
the *lifecycle*, not just the representation — construction takes metadata,
and the four operations currently sharing the name `withMetadata` get four
names. That is a better outcome than the one the analysis proposed, and it
came from a question about lifecycle rather than from more measurement.

*(Amended 2026-08 at B-121 C6: the second half of that sentence was wrong.
Asked what distinguishes the operations in their **logic** rather than their
purpose, the answer was nothing — one operation, `(datum, metadata) → value`,
whose patterns differ only in argument provenance. The lifecycle half stands
and is implemented; the decomposition half was withdrawn.)*

### Raised by C9 (the naming pass)

| # | Delta | Owner |
|---|---|---|
| 47 | **`Context` still names three different things in ~300 local identifiers.** C9 renamed every DECLARED name in which "Context" or "Ctx" denoted the retired composite kind. What remains is role-qualified and could not be renamed mechanically, because the roles are not all settled: `evalCtx` (**603**, and a public field of `evalSource`'s result) is a **scope** and §15 settles it; `typeCtx` / `typeContextName` / `typePrivilegedCtx` denote a **type Context**, a term *this document still uses*; and `src/parser.ts` has its own unrelated `makeContext` (a **parse** context), exported as `parserMakeContext`. Three meanings, one word | B-119 |
| 48 | **`withMetadata` declared a carrier return for a non-carrier path.** One of its three paths returns a copy-on-write derive, not a carrier, and the declared type said otherwise. Corrected at C9; **exactly one site** depended on the fiction — a test cast — which is the evidence it was never load-bearing | — *(closed at C9)* |
| 56 | ~~**`type` — the most-used metadata field — has no registration, no owner and no integrity flag**~~ **CLOSED 2026-08**: registered by `types-std.ts` with integrity | B-109(a) |
| 54 | **`mv_set` forges the `type` field from user code** — no capability required, and annotation checking accepts the result | **B-123(a)** |
| 55 | **`channel_read` bypasses the D47(e) observe guard** that `component_get` enforces for `source` | **B-123(b)** |
| 53 | ~~**A constant is rebuilt in a loop**: `wrapAsUntypedFunction` is deterministic per primitive, and both Layer-1 builders call it for every primitive on every scope build~~ **CLOSED** — carriers 56,123 → 38,954, exactly the predicted 17,169 | B-122 |
| 50 | ~~**The carrier is 74% of all structures and 98.5% hold one field**; `dataOf` really unwraps 182,311 times~~ **CLOSED 2026-08 (B-121 C2–C5)** — the carrier is deleted and so is `dataOf`. §10 is a retirement marker | **D48(b)** → B-121 |
| 51 | ~~**`withMetadata` is four operations under one name**, and one of them (`withMetadata(newP, cloneComponents(v))`) is spelled as two calls where omitting the second silently drops metadata~~ **CLOSED 2026-08 (B-121 C6)** — with a correction: it was **one** operation, not four. The four patterns differ only in where their arguments come from, and deleting the peel turned the ten `derive` sites into `stamp` by deleting a word. The two-call hazard was real and is now `carryMeta` | **D48(c)** → B-121 |
| 52 | **The O(1) name-lookup requirement comes from scopes, not from data** — 227 scope objects vs 19,245 data structures averaging 4.6 slots | **D48(a)** → B-120 |
| 49 | **A structure's bindings map and binding list are not aliases.** `slotWrite` and `addBinding` each build **two** `Binding` objects for one key, so an in-place mutation reaches one view only. This is the root of all four write disciplines and was documented nowhere | — *(stated at C9; §13)* |

**34 distinct deltas across 49 entries**; 16 entries are clean. Their
triage — ownership, clustering, and the order the code campaign works
them — is `docs/plans/concept-spine.md` §9 (S5). Two rows above changed
there: delta 7 was owned by a spine section rather than a work item, and
delta 45 carried a second row owned by candidate **R15**, withdrawn at S4b.

### What T5 added (S4)

Six deltas, and the tier did what the plan predicted — *"mostly
reconciliation"* — with one exception that matters more than the rest.

**§45 is where sufficiency gap S1 stops being abstract.** Every requirement
in Part 0 is per-value or per-evaluation. The **verdict** is not: it
aggregates over a whole compilation, and it is the artifact on which "nothing
is silently trusted" is actually delivered. An Allegretto satisfying every
stated requirement could carry per-value metadata perfectly and give Allegro
nowhere to accumulate a verdict. **Candidate R15** now has a named consumer
instead of an argument.

**§46 makes CT-R6 measurable.** `src/pcp.ts` contains **zero** occurrences of
"contract", "requires" or "ensures" — so an undischarged precondition is a
pending obligation that reaches `inspect` and never the verdict. A project
can read a clean verdict while carrying unproven preconditions, which
contradicts §45's entire purpose. The ruling recorded this as a gap in 2026;
the count is what makes it checkable.

**Two deltas are the same one already found.** §42 (exhaustiveness and
termination are post-passes in the base pipeline) is §29, and §44's
`discharged` being the **last** binding-plane metadata field is B-104's
residue. That repetition is a good sign rather than a bad one: the tiers are
finding the same defects from independent directions, which is what a
dependency-ordered model should do.

### Corrections from the S4 review (S4b)

Five, and two of them overturn findings rather than refining them.

**§45's R15 claim was wrong, and the correct account is better.** The verdict
is program-level, so I claimed the per-value requirement set could not enable
it. But **a program is a value**, and accumulation across an expression is
already what channel operations do. The verdict *should* be the top-level
value's accumulated metadata, with each channel defining an accumulation that
reaches it — R3 and SC-7's `union` already say so. **R15 withdrawn.** The
real finding is an implementation delta with direct evidence: `buildVerdict`
walks bindings out-of-band, and the `warnings` field — registered `union`,
exactly the accumulating discipline — is **unused**. And it *explains* §46:
contracts are absent from the verdict because contracts have no accumulating
field, not because anyone forgot.

**§36's "an interface always has a name" was an unenforced assumption that my
own proposed change would falsify.** The 0-decisive measurement means
marker-true and nameless never co-occur — which holds *because
`structuralWrap` erases the marker*. Replace the marker with a meta-type test
and the case is **created**: `~Printable` keeps meta `InterfaceKind` and has
no name, so it would take the declared path instead of the loose one. The fix
is to drop the marker check and **not replace it**; anonymity alone is the
loose/declared switch. Method rule worth keeping: **a delta measured before a
change does not survive the change.**

**§32 made refinements second-class and the code does not.** "Refinements are
knowledge, not different behaviour" over-claimed. A refinement *may* add
behaviour, and when it does it stops being member-transparent and becomes a
shape — which is what the walk already tests, and what `preserveOps` /
`mixin` / `extend` already do. `NonEmptyList.head` returning `T` rather than
`Option[T]` is the motivating case, not a contrived one: the refinement is
precisely what makes the total signature sound.

**§37 was too narrow** — generics must parameterise over *values of any
type*, not only over types (`Vector[3]`, `Matrix[3,4]`). The machinery
already admits non-Type parameter kinds; which kinds the language offers is
open.

**"Domain" was used in four entries and never defined** — the same failure as
"loose" (§33b), one round later. §34b now defines it, including the property
that makes it usable: domains approximate in one direction only, answering
"definitely yes" or "cannot tell", never "definitely no" by omission.

Two undefined terms in two consecutive rounds is a pattern, not bad luck. The
ordering constraint is supposed to catch exactly this and is enforced by
reading; both were caught by the maintainer instead.

### Open questions parked at S4 (maintainer)

Design questions for **Allegro**, which do not change what Allegro requires
of **Allegretto** — so they are recorded rather than settled, and the
distinction is exactly Part 0 §1's subject line doing its job:

1. **Is "Interface" the right name for an abstract inheritable type?** §36
   found that the concept here is *drawn from rather than instantiated*, and
   that Allegro has no abstract types because D44 removed what abstractness
   is defined against. Whether the surviving concept should keep the name
   "Interface" is open.
2. **What is the difference between `Interface` and `InterfaceKind`?** Both
   exist in `types-std.ts`; the spine defines the kind (§31, §36) and does
   not distinguish them. That is a gap in this document, not only in the code.
3. **Is structural comparison useful on *types*, or only on data?** §33b
   defines loose conformance as the duck-typing surface "aimed at data
   values", and `~T` applies it to types. Whether that is valuable or merely
   permitted — and whether it should be restricted — is open.

### Two corrections to T4 (S3b)

Both from maintainer questions, and both changed the entry rather than
defending it.

**The interface definition was wrong, and so was the alternative.** S3 said
the definition *is* `InterfaceKind`'s predicate ("has no `construct`"). That
is what the predicate tests, not what the concept is. The offered
alternative — "all members are signature-only" — fails too:
`Type.define({v: Int})` has only signature members and a construct, so it
would make every plain record an interface. The truth is that **two
properties are enforced in two different places** (the predicate; and
`Interface.define`'s construction) and **neither is the definition** — which
is *drawn from rather than instantiated*.

The deeper point is the maintainer's own: "has no construct" reads like
**abstractness**, and abstract-vs-interface is a real distinction *in a
language with inheritance*. **Allegro has no abstract types**, because D44
deleted the declared is-a edge and abstractness is defined by what you can
extend. With nothing to extend the two collapse — a property of this type
system, not a general truth, and exactly the kind of thing that lands
differently when the type system is rebuilt without `extends`.

**"Loose" was used six times and never defined.** §33b now defines it, and
the omission is a **process failure**: the spine's own rule is that every
salient concept gets an entry, and the ordering constraint should have caught
a term used before it was defined. It did not, because the constraint is
currently enforced by reading rather than by anything mechanical — which is a
finding about the method, and one the Vivace model would catch for free.

Defining it also resolves what "`~Printable` is an interface **and** also
loose" meant: two independent facts — declaration-only, *and* matching by
base name rather than by drawn symbols. Unstated, it read as a contradiction.

**And a measurement was under-scoped.** S3 reported the marker 0-decisive at
`shapeAwareSubtypeof`. There are **three** readers, not two; re-measuring
across all of them gives 42 encounters and **0 decisive at both** subtypeof
sites, plus 0 hits at the third. The conclusion survives, but the first
number covered one site and was quoted as though it covered the question.

### What T4 added (S3)

Six deltas, and one of them is a *resolution* rather than a finding — which
is what the tier was for.

**§36 settles `~Printable` by defining "interface" precisely enough for the
question to have an answer**, which is exactly what the plan predicted would
be needed. `InterfaceKind` is literally `Type` refined by *"has no
`construct`"*, so declaration-only is a checkable property of the type rather
than a flag. From that definition the conflict dissolves: the `__interface`
marker is doing **two jobs with one bit** — `applyBoundaryBound` reads it for
*is this an interface?* and `shapeAwareSubtypeof` reads it for *is this in
the loose, base-name world?* — and `structuralWrap` erases the marker and the
name together, so one erasure answers both. The facts are orthogonal.
`~Printable` has no construct (interfaces have none to copy), so it satisfies
`InterfaceKind`'s own predicate: it **is** an interface, *and* it is loose.

The maintainer ruled this months of reasoning ago; the value of the tier is
that it is now **derivable from the definition** instead of asserted, and the
derivation says exactly what changes — drop the marker check in
`shapeAwareSubtypeof` (measured 0-decisive: 42 encounters, none decisive),
read the meta-type in `applyBoundaryBound`, and delete the marker. It also
**retracts** the `structuralWrap` re-stamp proposed before the definition
existed: there is nothing to re-stamp, since anonymity already carries the
loose-world signal.

**§32 vs §34 is the ordering constraint's second real catch.** Shape and
knowledge cannot be defined in terms of each other, and the plan predicted
the dependency ladder would strain here. It held: shape is *what dispatches*,
knowledge is *what is established about a value*, and both read the same
stored `type` field — the split is two computations over one storage, exactly
as the chunk-3 work found for `shape`/`type`.

### What T3 and the interfaces added (S2f)

Five more, and the shape has changed. T0–T1 found naming lag; T2 found
undeclared planes; **T3 finds the same violation in a second form** — §29:
the L2 post-passes (effects, exhaustiveness, termination, proofs) are
hardcoded into the base's stage list, which is §23's problem without the
imports. One root, two surfaces.

The terminology change earns its place immediately. Splitting **field** from
**channel** (§19/§19b) makes a defect visible that had no vocabulary before:
the registry holds eleven entries that are *five different kinds of thing* —
seven stored fields, one projection (`shape`), one capability with no storage
at all (`knowledge`, whose own comment admits its storage is three other
fields), one retired entry (`exported`) and one unused (`warnings`). Nothing
could have flagged that while all eleven were called "channels".

And §24 reframes the rest: **every T2 delta is an instance of a plane
interface being absent.** Four are owed — dispatch, check, projection, and
channel registration — all of the same shape, *the base holds an inspectable
symbol and the layer installs the meaning*, which is SC-7's argument
generalised from propagation to every plane boundary.

### What T2 added (S2e)

Six more deltas, and they resolve the shape S1 could only gesture at. S1
found three entries (§7, §15, §17) that were "the same underlying gap — the
planes are real and undeclared". Writing the planes down turns that gap into
four *named* defects (§18, §19, §21, §22) plus one that is larger than any of
them: **§23, the L0→L2 dependency**.

The useful part is the contrast §23 draws. `evaluator.ts` propagates channels
through the plane interface — `viralFields()`, `metaFieldSpec(k)?.rule`,
`fieldMerge(k)`, entirely layer-ignorant — **and in the same file** imports
27 L2 symbols and hosts `checkArgType`. The discipline is not missing; the
type system simply bypasses it. That is why B-110 belongs here rather than as
a separate arc: it is not a new problem, it is §18's plane rule not being
applied to one subsystem.

And the decomposition falls out of the plane framing: `getType(v)` is
`metaReadRaw(v, "type")` with a kind check, so *reading* a type is already
an L0 operation and only *interpreting* it is L2. The fix is a dispatch hook
the layer installs — the shape `installFieldMerge` already has.

### What the level tags revealed (S2a)

Tagging the seventeen entries with their level (Part 0 §0) produced a finding
the four-part format alone had missed: **four of them are Implementation, not
Specification** — the carrier (§10), Structure roles (§12), the dense region
(§16) and the legacy view (§17). All four had been written as though they
were concepts of the language. They are not: they are how *this host* realises
§9, and a different Allegretto satisfying R1–R6 would have none of them.
*(B-121 then proved the point on the first of them: the carrier was deleted
outright and no requirement moved. §10 is a retirement marker.)*

That is a quarter of T0–T1 sitting a level above where it belongs, and it is
the same mistake in four places: an implementation choice, made for a
performance criterion, read afterwards as part of the design. All four trace to **IC-1/IC-2/IC-3**, which is why those three are the ones
under review at **B-108**.

The check is now mechanical rather than a matter of judgement: an entry that
cannot name the requirement it traces up to is either misplaced or resting on
a requirement nobody has written down.

### What T0–T1 found (S1)

Nine deltas across seventeen entries, on the tier we understand best. Six of
the nine are naming or documentation lag; three (7, 15, 17) are the same
underlying gap — **the planes are real and undeclared** — which is what T2
exists to fix and why it is the highest-value tier in this document.

S5 sharpened the third group. Deltas 15 and 18 are host-plane data that is
correctly *placed* and wrongly *declared*; delta 7 is host-plane data that is
wrongly placed. Undeclared planes hid the difference, and it is the split
between B-107(f) and B-118.
