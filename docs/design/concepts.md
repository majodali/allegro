# Concepts — the definitional spine

> Tier 1. The document a reader (or an agent) reads **first and completely**.
> Every salient Allegro concept, defined in dependency order. The area docs
> (`allegretto/structures.md`, `standard/type-system.md`, …) are where the
> deep treatment lives; this is what makes them legible.
>
> Plan: `docs/plans/concept-spine.md`. Status: **Part 0 + T0–T5 written**
> (S1, S2a–S2f, S3, S3b, S4). Next: **S5**, delta triage. Status tags per `README.md`.
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

Everything below T0 rests on this part. It exists because the single most
expensive confusion in this codebase has not been any particular design
error — it has been **not knowing which of three kinds of statement one was
making.**

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

- A specification item satisfying no requirement is **unjustified** — it may
  be right, but nothing says why it must be so.
- An implementation choice realising no specification item is **unconstrained**
  — nothing would tell you if it changed.
- A requirement with no specification item is **unmet**, or met implicitly,
  which is worse.

This is the consistency check (a); the per-entry **Delta** is the code-fidelity
check (b). The two are different and a model needs both.

## 1. Requirements

> **Level: Requirement.** R1–R14, proposed 2026-08; awaiting ratification as
> a **set** — individually plausible is not the bar, cohesion is.
>
> **The cohesion pass has now run (§6), and seven of the fourteen do not
> survive as requirements.** Items it challenges are marked ⚠ inline. They are
> left in place rather than rewritten: the set is unratified, §6 proposes, the
> maintainer disposes. Three capabilities Allegro needs are enabled by nothing
> here (§6.3) — candidates R15–R17.
>
> **S2d then merged four into one and classified every abort.** R3, R5, R11
> and R13 become the single **R3′** (§8.1); the propagation vocabulary becomes
> **SC-7**, kept because R12 is enforceable only over inspectable rules
> (§8.2). Classifying the 117 base aborts (§7) showed the gap was never in
> R4 — it was that **no requirement covered aborting at all**: candidates
> **R18** (resource bounds), **R19** (plane separation), **R20** (ill-formed
> application). Running total: **14 proposed → 6 surviving + 6 candidates.**
>
> Each requirement carries a **subject**. This matters more than it looks:
> R6 forbids Allegretto from knowing about the layers, so a requirement whose
> subject is *Allegro* cannot be discharged by anything in the base. Where
> Allegro needs a capability, the base requirement is the weaker, concept-free
> enabler. Getting this wrong is how "the base must not know about types" and
> "the base must propagate the type channel" come to look contradictory.

### R1 — Allegretto is the simplest base language that can carry Allegro
*Subject: Allegretto.* ⚠ **§6.1 F5** — purpose + criterion; not falsifiable as stated.

Allegretto is not a language anyone is meant to write programs in. Its
purpose is to be the substrate Allegro Standard is *built on*, as an
extension stack rather than a privileged layer. Every feature must earn its
place by being something Allegro cannot be built without.

*Consequence.* "Would Allegro still work without this?" is a legitimate
challenge to any part of Allegretto, answerable with evidence.

### R2 — Partial evaluation is the mechanism by which layers are added
*Subject: Allegretto.*

Types, effects, proofs, refinements, contracts and error handling are built
**on** the base, and the tool that makes that possible is partial evaluation:
a program is evaluated as far as its known inputs allow, and what cannot be
resolved becomes a residual that is itself an ordinary value. Checking is not
a separate pass over a separate IR — it is evaluation that ran far enough to
answer, and *discharge* is the same act as computing.

### R3 — Values carry metadata, and each channel is processed orthogonally
*Subject: Allegretto.* ⚠ **§6.1 F4** + **§8.1** — superseded by the merged **R3′**.

A value must be able to carry information *about* itself alongside the data
it *is*. Each **channel** must be processed independently: adding one must
not change how any existing channel propagates, and no operation may need to
know the full channel set.

*Rationale.* Without this, every layer would thread its own information
through every operation by hand, and layers would not compose — the type
layer would have to know about the effect layer to avoid dropping its data.

### R4 — Evaluation is total over the value space
*Subject: Allegretto.*

The evaluator has a rule for every value it can meet. An unresolved input
produces a **residual**, never a failure to proceed.

*Rationale.* R2 depends on this completely. If evaluation could get stuck, a
program could fail to compile because it could not be *run*, and the
compile/run distinction Allegro dissolves would come back.

*Scope.* This requirement is about **unresolved information**. A first draft
added "Failure is a value, not a control-flow escape", which the base
contradicts 117 times; that sentence is struck.

*Correction to the correction (S2d, maintainer).* S2c then concluded the
requirement had been over-broad. **That was the wrong inference.** 117
inconsistent throws are evidence of *inconsistency*, not evidence of a
different cohesive requirement — the code does not get a vote on what the
requirement is. If Allegretto aborts, that behaviour must be a
**specification**, supported by a requirement. §7 classifies every base throw
and says, per class, whether it needs a specification or needs rework.

### R5 — Metadata survives evaluation
*Subject: Allegretto.* ⚠ **§8.1** — merged into **R3′**, which states non-interference instead (the C5 sharpening).

A channel attached before an operation is observable after it, per that
channel's declared propagation rule. A channel that could be silently dropped
would make every layer built on it unsound.

*Consequence.* Why primitives receive **full** values and read data through
the data-plane accessor: a primitive that unwrapped its arguments would
satisfy its own contract and violate this one invisibly.

### R6 — The base does not know about the layers
*Subject: Allegretto.*

No **concept** belonging to Allegro Standard — type, effect, proof,
refinement, contract — may appear in Allegretto. Dependencies point downward
only.

*Rationale.* This is what makes Allegro a curated extension stack rather than
a privileged layer, and therefore what makes the platform programmable by
anyone else.

*Stated about concepts, not mechanism.* Allegretto provides the channel
plane; it must not know that one channel is called `type`. That distinction
is load-bearing, and §4.1 records that the code violates it today.

### R7 — Allegretto is replaceable
*Subject: Allegretto (meta).* ⚠ **§6.1 F1** — not a requirement; this is the sufficiency claim.

Any implementation satisfying R1–R6 and R8–R14 supports Allegro. Allegretto
may change at any time — host implementation (replatforming, bootstrapping
into itself) or specification (a different metadata mechanism) — provided the
changes continue to support Allegro's design goals.

*Consequence.* **Everything is an implementation choice unless it is traced
to a requirement.** This is why §3 exists.

### R8 — There is one value universe
*Subject: Allegretto.* ⚠ **§6.1 F6** — the claimed derivation from R4 does not hold; R1+R9 does.

Everything the evaluator can meet is a Value. There is no second category —
no statement, declaration, or type that is not itself a value.

*Rationale.* R4's totality is only meaningful over a single space: "the
evaluator has a rule for every value" says nothing if some inputs are not
values. It is also what lets an extension build language constructs, since
every part of the language is something it can receive and return.

*Note on level.* This is a **requirement**, not a specification choice —
there is no alternative that preserves R4. What the value kinds *are* is a
separate, weaker question (SC-1).

### R9 — The language surface is extensible
*Subject: Allegretto.*

Syntax is not fixed in the base. A grammar is a value, and extensions
contribute to it, so Allegro's surface is built rather than privileged.

*Rationale.* R1 says Allegro is built on Allegretto; without R9 that would be
true of semantics and false of syntax, and Allegro's notation would be a
kernel feature no other stack could have.

### R10 — Evaluation is resumable on new information
*Subject: Allegretto.* ⚠ **§6.1 F7** — largely derived from R2 + R14.

Information may arrive after evaluation has begun — a module load, an async
result. When it does, whatever depended on it re-evaluates. A value may be
**pending**, and pending is not failure.

*Rationale.* R2 says "evaluate as far as known inputs allow"; R10 is what
happens when the set of known inputs *grows*. Without it, PE would be a
single pass and anything not known at that instant would be permanently
residual.

### R11 — Propagation is declared, not coded
*Subject: Allegretto.* ⚠ **§8.1** — merged into **R3′**; the fixed vocabulary it implied becomes **SC-7** (§8.2).

Each channel declares its propagation discipline from a **fixed vocabulary**
the base defines. The base applies the declaration without knowing what the
channel means; the channel's owner supplies any semantics the discipline
needs.

*Rationale.* This is the resolution of the apparent conflict between R3 and
R6. The base knowing *"some channels are viral"* is layer-ignorant; the base
knowing *"the error channel is viral"* is not. Only the second violates R6,
and it is avoidable: the vocabulary is generic, the registration is the
layer's.

### R12 — Metadata origination is capability-controlled
*Subject: Allegretto for the mechanism; Allegro for the policy.*

A channel carrying authority — that a proof discharged, that a value came
from a recorded source — must be unforgeable by code that does not hold its
writer. **Authority is a capability, not a name.**

*Rationale.* Metadata that anything can write cannot be evidence. This is
also what makes R11 safe: externalising registration would be a counterfeit
vector if trust were carried by naming a channel, and is not if trust is
carried by holding the closure that writes it.

*Consequence.* Which channels need protection is a **layer** decision, so
the base must not enumerate them. §4.2 records that it does today.

### R13 — Channels can carry mergeable information
*Subject: Allegretto.* ⚠ **§8.2** — not a requirement; it is the argument that `union` must be in **SC-7**'s vocabulary.

A channel's propagation may **combine** two values rather than replace one
with the other, with the combination supplied by the channel's owner.

*Rationale.* Effect sets union; knowledge meets. Without a merge in the
vocabulary, a layer needing one would have to intercept every operation, and
R11's declared propagation would collapse back into hand-coded propagation —
which is the R3 violation R11 exists to prevent.

### R14 — Code is organised into separately-loadable units
*Subject: Allegretto.*

A program may be assembled from units loaded independently, with control over
what each unit exposes. `use` / `import` is *a surface* for this; the
requirement is the unit and its visibility boundary, not the keyword.

*Rationale.* R10's "information arrives later" has loading as its principal
case, and the visibility boundary is what makes a unit's internals
refactorable — without it, every binding is public and nothing composes at
scale.

### Layer requirements that are NOT base requirements

Two items raised as candidate requirements belong to Allegro, and their base
counterparts are strictly weaker. Recording the distinction, because
conflating them is what produces apparent R6 violations:

| Allegro requirement | Its Allegretto counterpart |
|---|---|
| **Discharge** — an obligation is discharged by evaluating it, and what did not discharge remains visible as a stated obligation | **R2 + R4**: evaluation runs as far as it can and yields a residual otherwise. The base knows nothing of "obligation" |
| **Knowledge lattice** — one monotonic lattice over imputed bound, domains and predicates, meeting at each use | **R13**: channels can carry mergeable information. The base supplies merge; the lattice is the layer's |

## 2. Specification choices

> **Level: Specification.** These have alternatives — but the alternatives
> are **visible to Allegro**: changing one changes what the layers above are
> written against. That is what separates them from §3.

### SC-1 — Seven representation kinds
*Satisfies R8, R1.*

Bits, Symbol, Param, Expression, ComposedFunction, PrimitiveFunction,
Structure.

| Alternative | Trade |
|---|---|
| Fewer — fold Param into Symbol | Params are positional and Symbols are named; merging them would make substitution need a name environment (see SC-3) |
| Fewer — no separate PrimitiveFunction | Host functions would need an Allegretto encoding; the `lazy`/`sourceAware` declarations have nowhere to live |
| More — a distinct sequence kind alongside Structure | See IC-2: currently a Structure *role* rather than a kind |

*Criterion:* minimality under R1, subject to R8 leaving nothing outside.
*Visible to Allegro:* yes — L2 dispatches on these.

### SC-2 — Bits is the only scalar
*Satisfies R1, R6.*

One uninterpreted scalar: a bit vector of known length. `Int`, `Float`,
`String`, `Bool` are Bits with a type attached at L2.

| Alternative | Why not |
|---|---|
| A fixed set of primitives | Violates R6 — the base would know a numeric tower, and Allegro could not redefine it |
| Tagged scalars (value + kind tag) | The tag is a degenerate type channel; R3 already provides one, better |

*Criterion:* minimality under R1, layer-ignorance under R6.
*Revisit if:* a numeric or textual operation cannot be expressed at L2
without the base knowing its semantics. *Status:* holding.

### SC-3 — Expressions are values
*Satisfies R2, R4, R8.*

An unevaluated application is an ordinary value, so a partially-evaluated
program is also an ordinary value.

| Alternative | Trade |
|---|---|
| A separate IR for unevaluated code | Violates R8, and residuals could not flow through the same machinery as results — which is the whole of R2 |

*Criterion:* R2 is not achievable otherwise. Borderline requirement; kept as
specification because "the DAG is *a* representation of pending computation"
admits alternatives even if "pending computation is a value" does not.

### SC-4 — Symbol identity is fully-qualified, not spelling
*Satisfies R6, R14.*

Two members spelled `size` in different types are different symbols.

| Alternative | Trade |
|---|---|
| Name-string comparison | Conformance becomes a spelling question; D44 removed exactly this class of false positive |
| Opaque gensym identity | Loses the human-readable projection printing, errors and loose matching rely on |

*Criterion:* conformance must be an identity question. *Status:* holding —
D44 is evidence the alternative was tried and failed.

### SC-5 — One composite kind rather than two
*Satisfies R1, R3. D1, completed D46.*

MultiValue (primary + components) and Context (bindings) were condensed into
one Structure whose former MultiValue role became the carrier configuration.

| Alternative | Trade |
|---|---|
| Two kinds (the original) | Explicit about carrier vs record; costs one kind under R1 |
| Three (add a sequence kind) | See IC-2 option E |

**This is the specification half of a choice whose implementation half is
IC-1, and separating them is what makes the maintainer's doubt answerable.**
Reducing the *kind count* is a specification win under R1. What it cost is
entirely at the implementation level, and is measured in IC-1.

*Criterion applied:* kind-count minimality under R1.
*Revisit:* ~~with IC-1/IC-2 → B-108~~ — **UPHELD at B-108 (D48, 2026-08).**
The doubt was never here. One composite kind is a specification win under R1
and the review did not disturb it; what the review found is that the *cost*
was pushed down into IC-1/IC-2/IC-3, where four configurations replaced two
kinds. Recording this explicitly because "was D1 right?" was answered **yes,
and the question you were actually asking is one level down** — which is the
whole reason Part 0 separates the levels.

### SC-6 — Scopes are values
*Satisfies R8, R2.*

An evaluation environment is an ordinary Structure, introspectable like any
other, distinguished by role rather than by kind.

| Alternative | Trade |
|---|---|
| Environments outside the value universe | Violates R8; reflection over scope becomes a special API |

*Criterion:* R8. *Note:* scopes are the one place data-plane immutability
(D22) does not hold — they are evaluator state. That carve-out is
specification, not an implementation detail.

## 3. Implementation choices

> **Level: Implementation.** Alternatives here are **invisible to Allegro** —
> a different choice changes no program's meaning. Each records the
> alternatives, the criterion that selected one, and a revisit trigger. A
> choice with no recorded alternatives cannot later be evaluated, which is
> exactly how "did that actually simplify things?" became unanswerable.
>
> *Renumbered at S2b.* The former IC-1 (Bits) is now **SC-2**; the former
> IC-2 split into **SC-5** (kind count) + **IC-1** (role configuration);
> former IC-3 → **IC-2**, IC-4 → **IC-3**, IC-5 → **SC-4** + **IC-4**,
> IC-6 → **IC-5**, IC-7 → **SC-3** + **IC-6**.

### IC-1 — Structure's roles are read from field presence
*Realises SC-5.*

One class carrying every role's fields, with role inferred from which are
populated.

**Under active doubt, and the doubt is well-founded.** The recorded rationale
was never conceptual simplification: `structures.md` I1 gives the payoff as
*"known type ⇒ known shape ⇒ slot access compiles to offsets (feeds
codegen)"* (future), and the class comment gives *"so every structure shares
a single hidden class"* (present, V8).

| Measure | Value |
|---|---|
| Declared fields on `Structure` | **11** |
| Role-groups | **4** (carrier, record, dense, scope) + 2 universal |
| Sites discriminating role by field **presence** | **146** |
| Constructors | 3 |

So the *kind* count went 2 → 1 (the SC-5 win) while the *configuration*
count went 2 → 4, and the variation moved from an explicit tag to implicit
field presence read at 146 sites.

| Alternative | Trade |
|---|---|
| Explicit role **tag** | Same fields, role stated rather than inferred; replaces 146 presence-checks with one discriminant |
| Genuinely one role (IC-2 option E) | The only option that removes the configurations rather than renaming them |

*Criterion applied:* host performance + future codegen.
*Criterion NOT applied:* comprehension. Both are legitimate; only one was
used, and nothing recorded which.

> **RULED at B-108 (D48, 2026-08): this choice DISSOLVES rather than being
> decided.** Under IC-2 option E the dense role becomes a representation
> below the specification, and under IC-3's ruling the carrier role ceases to
> exist; scope is host-plane. **One role — record — survives**, so there is
> nothing left to discriminate and the explicit-tag alternative would be a
> discriminant built for configurations that are being deleted. This is why
> B-108 insisted the three be judged together: ruling IC-1 first would have
> built the tag.
>
> *Until those two land the 146 presence-checks stand*, and this entry stays
> as the record of what they cost. **Owner: B-120, B-121.**

### IC-2 — Structure indexing: map-first
*Realises SC-5, SC-6.*

The composite is a string-keyed map plus an ordered list view; arrays are a
numeric-keyed special case with a dense region; channels are a second map.

| | **A · map-first** (current) | **B · sequence-first** | **C · two representations** | **E · one entry-sequence** |
|---|---|---|---|---|
| Deepest composite | string-keyed map | ordered sequence | MultiValue + Context | sequence of `(key?, value)` |
| Positional data | special case + materialized legacy view | native | special case | native (entries with no key) |
| Name lookup | O(1) | O(n) or derived index | O(1) | O(n) raw; O(1) with an index *below* the spec |
| Channels | second map | sequence of pairs, O(n) per read | native to MultiValue | second entry-sequence |
| Spec/impl distance | **wide** — spec says one composite, impl has four configurations | narrow | narrow | narrow |
| Cost of the gap | 146 presence sites; `__length`; the legacy view | derived-map machinery at L0 | one extra kind | index invisible above the spec |

**The argument for B usually missed:** O(n) name lookup only costs if lookup
is a *runtime* operation. Under R2 most scope resolution happens once, at
`resolveSymbols` — so the asymptotics that rule out association lists in an
interpreter argue far more weakly in a partial evaluator. Worth measuring,
not assuming.

**Against B:** channel reads *are* hot and *are* by name (R3+R5), which is
precisely where B goes linear.

**Option E was never on the table.** A single composite of optionally-keyed
entries is both map and list. The dense region stops being a role and becomes
a representation optimisation **below** the specification — which is what it
should always have been — dissolving `__length`, the legacy view and the W6
invariant with it.

*Criterion applied:* interpreter-shaped performance intuition.
*Criterion that should apply:* spec/implementation distance under R7.

> ### RULED at B-108: **option E** (maintainer, 2026-08 — **D48(a)**)
>
> **The measurement that decided it** (50-file corpus, real CLI, instrumented):
>
> | | |
> |---|---|
> | Slots per DATA structure | mean **4.6**; **97% ≤ 8**; modal size **2** |
> | Bindings per SCOPE | mean 70, max 177 (the prelude) |
> | Scope objects, ever | **227** |
> | `scopeLookup` calls | **10,309** |
> | `dataOf` calls | **453,199** |
>
> Two things follow, and neither was visible from reasoning.
>
> **The O(n) objection was about the wrong operation.** Name lookup happens
> 10,309 times; the carrier indirection happens 453,199 times. A Map was put
> on every composite to make the rare operation fast, and the common one was
> paid for with an extra object per value.
>
> **The O(1) requirement belongs to ONE role.** Data structures average 4.6
> slots — a Map is overhead at that size — while every large by-name lookup
> is in a scope, and there are 227 scopes in the entire corpus. Scopes are
> host-plane machinery, not data. So the indexing requirement that shaped the
> whole composite comes from the one role that is not a value.
>
> E is the shape that fits: **a sequence of optionally-keyed entries** is the
> composite; a scope keeps an index, and that index is *below* the
> specification because a scope is not data. `__length`, the materialized
> legacy view and the W6 coherence invariant all dissolve with the dense
> role, and delta 17 — the sole remaining job of `isMetaSlotKey` — goes with
> them.
>
> *Criterion applied:* **spec/implementation distance under R7**, the one
> IC-2 records as the criterion that should have applied.
> *Revisit if:* a measured workload puts large by-name lookup on the DATA
> path rather than the scope path — which is the assumption E rests on.
> **Owner: B-120.** Not yet designed in detail; the arc gets its own plan.

### IC-3 — Metadata storage: channels by wrapping
*Realises R3.*

A non-composite value carries channels by being wrapped in a **carrier** — a
Structure with an empty data plane whose `primary` is the wrapped value.

| Alternative | Trade |
|---|---|
| An optional channel map on every value | Deletes the carrier concept: no `primary`, no 67 presence-checks, no W1 non-nesting invariant, no `dataOf` indirection. Costs an optional field on every representation, including Bits — so "Bits is just bits" stops being literally true |

**Never written down as a choice at all**, hence no recorded criterion. It is
the largest single source of accidental complexity in T0 by call-site count,
and a genuine trade rather than an obvious win.

> ### RULED at B-108: **the alternative** — metadata is a field on every
> value (maintainer, 2026-08 — **D48(b)**, with the construction lifecycle
> **D48(c)**)
>
> **The measurement.** Of 240,820 value allocations in the corpus, **75,595
> are Structures and 56,123 of those — 74% — are carriers**; carriers are
> created *more often than Bits values exist at all* (35,060). **98.5% of
> them hold exactly one field** (mean 1.0, max 4), and 99.4% of that is
> `type`. `dataOf` is called 453,199 times and really unwraps 182,311 (40%).
> So the most common act in the system is: allocate an eleven-field
> `Structure` wrapping a value, so that a `Map` can hold **one** entry.
>
> **What carriers wrap** — which is what makes the change safe rather than
> speculative:
>
> | wrapped kind | share | clone concern | pattern that already solves it |
> |---|---|---|---|
> | Bits | 50.5% | none | — |
> | PrimitiveFunction | 46.0% | host expandos (`CHANNEL_WRITER_BRAND`) | `primitives.ts` already clones a primitive and re-stamps the brand |
> | ComposedFunction | 1.3% | `param.owner` back-link, `PRESERVED_FN_META_KEYS` | the shared clone helper CLAUDE.md already mandates |
> | Expression | 1.3% | `memo` — a clone must SHARE it (same fn+args ⇒ same memo; preserves IC-6) | needs stating; one line |
> | Param | 0.8% | `owner` back-link | as ComposedFunction |
> | **Symbol** | **0.0%** | interning (SC-4: identity = FQN ⇒ same object) would break under cloning | **does not arise** — measured zero |
>
> **This is not a new mechanism.** Structures ALREADY work this way:
> `withMetadata` with a Structure primary takes `deriveWithChannels` and the
> metadata rides in `components` — no carrier. The carrier exists only
> because the other six kinds have nowhere to put that field. The ruling is
> to give them it. The read surface needs **no change at all**:
> `channelReadRaw`, `componentsView` and `cloneComponents` each take a
> `Value`, cast, and read `.components` — they work the moment the field
> exists everywhere.
>
> **Host shape.** A `MetadataBearing` interface (`meta?: Metadata`, where
> `Metadata = Map<string, Value>`) extended by all seven value interfaces;
> `Structure.components` renamed `meta` — `components` always read like
> *parts of a composite*, which is the data plane, i.e. exactly what it is
> not.
>
> **Why `meta` is optional, and it is not laziness.** **Allegretto defines no
> fields** (R6, R11: the base owns the mechanism, layers own the fields), so
> under `--base` every value legitimately carries nothing. Values without
> metadata are exactly two populations: every value in Allegretto mode, and
> engine intermediates that never become a program value. Neither is a
> Standard-mode program value, and "every Standard-mode value has a type"
> stays an L2 invariant. It **cannot** become a required argument of
> `makeInt`: that would make L0 depend on a concept it does not have, which
> is B-110's violation in the construction path. Optional in the type,
> **always declared on the object** — `types.ts` already states that
> convention on `makeParam` ("declare optional fields so V8/JSC see a stable
> hidden class"), and the present lazily-absent `components` conflates the
> principled reason with a performance one.
>
> *Criterion applied:* allocation cost + spec/implementation distance (R7).
> *Revisit if:* a kind acquires identity semantics that copy-on-attach would
> break — Symbol is the live example, at zero today.
> **Owner: B-121.**

### IC-3a — Metadata is supplied at CONSTRUCTION, not attached afterwards
*Ruled with IC-3 — **D48(c)**.*

The ruling above makes attachment cheaper. This one changes when it happens:
**a value that will carry metadata should be built with it.** Classifying all
45 non-test call sites of `withMetadata` showed it is **four operations
wearing one name**:

| pattern | sites | what it is |
|---|---|---|
| `withMetadata(makeInt(0), m)` | **12** | **create with metadata** — the value never exists without it; the two-step is only the factory not taking a parameter |
| `withMetadata(dataOf(v), m)` | **10** | **derive** — same datum, new position, different metadata |
| `withMetadata(newP, cloneComponents(v))` | **9** | **map** — new datum, old metadata carried across |
| `withMetadata(result, {type: t})` | ~14 | **stamp** — computed value, computed metadata |

`evaluator.ts:511` is in the first group and it is **PE Rule 1 itself** —
`withMetadata(makeExpr(residualFn, evalArgs), components)`, on the path that
allocates 101,611 Expressions. A residual is *born* with propagated metadata
by definition; it should be one construction.

The factories already exist and are already an enforced chokepoint (the W4
boundary invariant; `makeBits`/`makeInt`/`makeFloat`/`makePrimitive`/
`makeParam`/`makeSymbol`/`makeExpr`/`makeComposedFn`/`makeStructure`/
`makeDenseArray`). They simply do not take metadata.

**The shape:**

```
makeInt(42, meta?)          // create with metadata
makeExpr(fn, args, meta?)   // PE Rule 1, one construction
deriveMeta(v, meta)         // same datum, new metadata
mapDatum(v, newDatum)       // new datum, metadata carried — impossible to forget
stampMeta(v, meta)          // the general case that survives
```

**Why the third one matters most.** `withMetadata(newP, cloneComponents(v))`
is spelled as **two** calls for **one** operation, and omitting the second
silently drops metadata with no error — the same failure shape as the
TailCall sentinel (B-113) and the ComposedFunction clone helper: an
obligation held by convention. Naming it removes the way to get it wrong.

**And the aliasing that rules out the no-allocation designs.** Measured:
59,027 attachments, of which **19,817 (33.6%) target an object that has
already been given metadata**. Metadata is a property of a value *in a
position*, not of the datum, so both no-allocation designs fail on the same
number — mutating in place lets the second stamp overwrite the first at every
position holding it, and a side table (`WeakMap<Value, Metadata>`, the
obvious candidate nobody had listed) fails identically because its key is the
object. Immutability (D22) is the rule adopted *because* of this; it is not
the reason itself.

**The legitimate in-place case, which should become a rule.** While a value
is provably unshared — during construction, before it escapes. That carve-out
already exists twice (`structure.ts`'s grandfathered builder idiom;
`writeShape` mutating `ctx.components` for identity-sensitive type Contexts,
ruled in at B-104 chunk 3) and is an idiom rather than a stated rule: *stamp
in place only before the value escapes; after that, derive.*

*Criterion applied:* lifecycle honesty — a value should not exist in a state
the specification says is impossible.
*Revisit if:* a construction site is found where the metadata genuinely
cannot be known until after the value exists and the value is not derived
from another.
**Owner: B-121.**

### IC-4 — Symbols are interned by FQN
*Realises SC-4.*

Same FQN ⇒ same object, so identity comparison is a pointer compare.

| Alternative | Trade |
|---|---|
| Compare FQN strings at each site | Same semantics (SC-4 is unaffected), more allocation and slower comparison |

*Criterion:* comparison cost on a hot path. *Status:* holding.

### IC-5 — Scopes layer by parent chain
*Realises SC-6, R2.*

O(1) extend, chain-walking lookup.

| Alternative | Trade |
|---|---|
| Flatten-copy on extend | O(n) per call site; the prior implementation, and the hot path that motivated the change |

*Criterion:* cost of the operation PE performs most. *Status:* holding.

### IC-6 — Expressions memoize
*Realises SC-3, R2.*

An Expression carries a memo table keyed by evaluation context.

| Alternative | Trade |
|---|---|
| No memo, re-evaluate per reference | Exponential re-evaluation under PE, which specialises the same subexpression repeatedly |

*Criterion:* PE cost. *Status:* holding.

## 4. Known tensions

Recorded because they were raised as objections to the requirement set and
deserve answers rather than silence. Both turn out to be **implemented**
violations rather than design contradictions — which is the useful outcome,
since a contradiction would need a redesign and a violation needs a fix.

### 4.1 Does declared propagation contradict R6?

**Objection.** The channel plane must apply per-channel propagation rules;
channels are layer concepts; therefore the base knows about the layers.

**Resolution: R11.** The base owns a *fixed vocabulary* of disciplines —
`viral`, `union`, `computed`, `drop`, `positional` — over an opaque payload.
The layer registers `(name, rule)` and installs whatever semantics the
discipline needs. The base knowing "some channels are viral" is
layer-ignorant. The base knowing "the error channel is viral" is not.

**The correct pattern exists and is used once**: `src/effects.ts` calls
`installChannelMerge("effects", …)` — the layer supplying its own merge to a
base that cannot import the encoding without a cycle. That is R11 working.

**And the base violates R6 today.** `src/slots.ts` registers **eleven L2
channel names itself** at module init — `shape`, `error`, `effects`,
`predicates`, `domain`, `knowledge`, `bound`, `discharged`, `warnings`,
`source`, `exported` — and special-cases `shape` / `type` / `discharged` by
name in `channelReadRaw` and `buildWriter`. The mechanism is layer-ignorant;
the wiring is not. **→ B-109.**

### 4.2 Does externalising registration break counterfeit protection?

**Objection.** If any layer may register a channel, what stops one registering
a forged `discharged`?

**Resolution: R12 — authority is the capability, not the name.**
Registration is one-shot and *returns* the writer as a closure, so whoever
registers first holds it and no one else can obtain it; integrity channels
may not take fabricating rules (`viral`/`union`), which is forgery vector C.
Under that principle the base never needs to know *which* channels are
sensitive — only that registration is one-shot and that the `integrity` flag
constrains the rule.

**And the base does not follow its own principle.**
`INTEGRITY_CHANNEL_NAMES = ["discharged", "source"]` is a hardcoded list in
`slots.ts`, consulted by `assertNotIntegrityKey` — protection by *name*,
which is exactly the thing that cannot externalise. Worse, the two sources of
truth disagree: `source` is in that list but is registered as
`{ name: "source", rule: "drop" }` **without `integrity: true`**. The guard
and the registry hold different beliefs about the same channel.

The fix direction is small and removes both problems: consult
`channelSpec(name)?.integrity` instead of the hardcoded set, and mark `source`
integrity at registration. **→ B-109.**

## 5. What this part does not yet contain

Recorded so the absence is visible rather than implied.

- ~~Cohesion has not been checked.~~ **Done at S2c — see §6.** All three
  questions were answered and all three found something: seven requirements
  do not survive as requirements (§6.1), two conflicts are real (§6.2), and
  three needed capabilities are enabled by nothing (§6.3). The set now
  awaiting ratification is **nine** requirements plus **three** candidates.
- **The registers cover T0–T1 only.** T2–T5 choices — propagation rules,
  discharge tiers, the knowledge lattice, the module surface — are not yet
  registered as SC or IC. Some of the R8–R14 requirements added here have no
  specification item at all yet, which by §0's own rule makes them *unmet or
  met implicitly*: R9 (grammar/extension), R10 (resumability), R12
  (integrity), R13 (merge), R14 (modules). That is expected at this stage
  and is exactly the orphan the traceability check is meant to surface.
- **R1–R14 are proposed, not ratified**, and §4's two findings are recorded
  as violations on the assumption that R6 and R12 survive ratification in
  their current form. If either is amended, both findings must be re-read.

## 6. Cohesion of the requirement set

> Run at S2c, per the method §5 stated. The bar for ratification is not that
> each requirement is plausible — it is that they hold together as a **set**.
> Fourteen were proposed; **seven** do not survive as requirements, **two**
> conflicts are real, and **three** capabilities Allegro needs are enabled by
> nothing above. Findings, not amendments: the set is unratified, so this
> section proposes and the maintainer disposes.

### 6.1 Derivability — is anything here not a requirement?

A requirement that follows from other requirements is a **theorem**, and
listing it as an axiom hides how few independent commitments there really
are.

| # | Finding |
|---|---|
| **F1** | **R7 is not a requirement.** "Any implementation satisfying the others supports Allegro" is not a constraint on Allegretto — it is the claim that the set is **sufficient**, which is §6.3's question. As a requirement it is unfalsifiable (nothing could violate it); as a sufficiency claim it is the most falsifiable statement in the document. **Move to §6.3.** |
| **F2** | **R11 is derived from R3 + R6**, by its own text — it introduces itself as "the R6-compatible form of R3". Given that metadata must propagate orthogonally (R3) and the base may not know the layers (R6), a declared vocabulary applied to opaque payloads is the *only* construction that satisfies both. That makes it a **specification** item, not an axiom. |
| **F3** | **R13 is a specification item on the propagation vocabulary.** "Channels can merge" is a statement about how rich the vocabulary must be, justified by concrete layer needs (effects union, knowledge meet) — a *sufficiency* argument for the vocabulary, not an independent commitment. |
| **F4** | **R3 conflates two levels.** "Layer information must be associated with values and preserved through evaluation" is a requirement. "It rides **on** the value" is a specification choice, and there is a visible alternative: an occurrence-keyed side table. The alternatives test — the one this document is built on — says a statement with alternatives is not a requirement. R3 should split. |
| **F5** | **R1 is a purpose plus a criterion, not a falsifiable requirement.** "Allegretto exists to carry Allegro" is the purpose; "as simple as possible" is a design criterion used to adjudicate trade-offs. Neither can be violated by an implementation, which is §0's own test for requirement-hood. It should be relabelled — it is the most useful sentence in the document and the least like a requirement. |
| **F6** | **R8's claimed derivation does not hold.** It says it derives from R4, but R4 would apply perfectly well *per universe* if there were two. What actually forces one universe is R1 + R9: Allegro is built as an extension stack, and an extension cannot produce a language construct that is not a value. Either R8 is independent or it derives from elsewhere; as written it is derived from the wrong thing. |
| **F7** | **R10 is largely derived.** "Information arrives later" is forced by R14 (separately-loadable units) — loading *is* late arrival — and R2 already says evaluation proceeds as far as inputs allow. What R10 adds beyond `R2 + R14` is only the *external* source (async I/O), which is a much narrower claim than the one stated. |

**Net.** Fourteen proposed → **nine** survive as requirements (R2, R4, R5,
R6, R9, R12, R14, plus the requirement halves of R1 and R3); four become
specification items (R11, R13, and the spec halves of R3 and R10); one
becomes the sufficiency claim (R7); one needs its derivation corrected (R8).

That is a good outcome, not a bad one: **a smaller independent set is a
stronger one**, and every item removed was removed by an argument that also
tells you where it now lives.

### 6.2 Pairwise conflict — does any pair fail together?

| # | Pair | Verdict |
|---|---|---|
| **C1** | R1 vs R3 / R9 / R13 / R14 | **Tension by design, not conflict.** Every capability requirement pushes against minimality; R1 is the criterion that adjudicates. But a statement that can only ever be *traded against*, never violated, is not a requirement — which independently reaches F5. |
| **C2** | R6 vs R11 | **Resolved** (§4.1). Layer-ignorant mechanism, layer-aware wiring. Implementation violation → B-109. |
| **C3** | R6 vs R12 | **Resolved** (§4.2). Authority is the capability, not the name. Implementation violation → B-109. |
| **C4** | R4 vs the implementation | **REAL — 117 throws in L0/L1.** `primitives.ts` 99, `evaluator.ts` 11, `slots.ts` 5, `scope.ts` 2, against **2** error-value constructions. *S2c concluded from this that R4 was over-broad; the maintainer corrected that at S2d and the correction is the important one:* inconsistent behaviour is evidence of **inconsistency**, not of an alternative requirement. Every abort must be a specification with a requirement above it, or it is rework. **§7 does that classification.** The methodological error is worth keeping visible: reading a requirement off the implementation is the exact inverse of the implementation-first rule, which says write down what the code does *and then compare* — not adopt it. |
| **C5** | R5 vs `drop` channels | **R5 is weaker than it reads.** "Survives per its declared rule" is nearly vacuous, since `drop` is a declared rule under which nothing survives. The requirement worth having is about **non-interference**: no operation may drop a channel it does not know about, whatever that channel's rule. Sharpen. |

### 6.3 Sufficiency — can something satisfy all of these and still fail?

The only falsification of the set as a whole, tested by naming Allegro
features and asking what enables them. **Three gaps.**

| # | Gap | Evidence |
|---|---|---|
| **S1** | **Program-level aggregation is enabled by nothing.** Every requirement above is per-value or per-evaluation. But `Verdict`, the assumption ledger, `CompilationReport` and `Notification` are **whole-program** artifacts: they aggregate across a compilation and are the surface on which "nothing is silently trusted" is actually delivered. An Allegretto satisfying R1–R14 could carry per-value metadata perfectly and give Allegro nowhere to accumulate a verdict. **Candidate R15.** |
| **S2** | **Determinism is required and unstated.** PE-as-compilation needs same source ⇒ same residual; without it, a build is not reproducible and a discharged proof is not re-checkable. Nothing above says evaluation must be deterministic, and R10 (resumability) actively introduces ordering — the B-028 arc hit precisely this as an *arrival-order non-confluence* bug. **Candidate R16.** |
| **S3** | **The host boundary is unstated.** Primitives perform I/O and call the host; that is what `PrimitiveFunction` is for and where every effect label originates. R9 covers the *syntax* surface; nothing covers the *capability* surface. SC-1 specifies the kind without a requirement above it — an orphan by §0's own rule. **Candidate R17.** |

S1 and S2 are the load-bearing ones. S2 in particular is the requirement the
codebase has *already been bitten by* and never wrote down.

### 6.4 What this pass says about the method

The cohesion check found more than the per-entry Delta check did, and found a
different *kind* of thing: the Delta check compares a statement to the code,
while cohesion compares statements to each other. **A model needs both, and
they fail differently.** C4 is the case in point — it was found by comparing
R4 to the code (a Delta-shaped check) only because the cohesion pass thought
to look, since Part 0 has no *As implemented* row.

**Proposed method amendment**, for the methodology delta: requirements carry
an *As implemented* row like every other entry. A requirement nothing in the
code answers to is either aspirational or wrong, and there is no way to tell
which without looking.

## 7. Abort classification (S2d)

> Maintainer ruling: *"If Allegretto is going to throw exceptions in some
> cases, that behavior needs to be a specification and needs to be supported
> by a requirement."* So every abort is classified — **new specification**, or
> **rework**. Nothing is left as "the code does this".

**199 throws repo-wide; 117 in L0/L1.** There is exactly **one** exception
class, `AllegroError`, and **nothing in `src/` catches it** outside the test
suite. Every abort is therefore a hard stop, and every abort looks identical
to every other from the outside.

| Class | Where | What it is | Disposition |
|---|---|---|---|
| **A · Host-invariant assertion** | `evaluator.ts:463` ("has unresolved stub… Check resolvePrimitives"), `slots.ts:632`, `slots.ts:708` | An interpreter bug. Not reachable by any well-formed program | **Specification** — the host may abort on its own invariant violation, and this is *not language behaviour*. But it must be a **distinct mechanism**: see D1 |
| **B · Plane violation** | `scope.ts:51`, `scope.ts:173` | A scope used as data, or data extended as a scope | **Specification**, under a requirement that does not yet exist — the plane separation is asserted in prose and enforced by throw. Candidate **R19** |
| **C · Capability denial** | `slots.ts:687`, `:690`, `:754`; 2 in `primitives.ts` | Re-registering a channel; an integrity channel taking a fabricating rule; originating an integrity key without the writer | **Specification** under **R12**. Denial-is-an-abort is the right shape — an error *value* would be forgeable, since the forger chooses what to do with it |
| **D · Resource guard** | `evaluator.ts:114` ("Maximum evaluation depth exceeded") | A bound the host imposes so non-termination surfaces | **Specification**, under a requirement that does not exist. Candidate **R18** — and it interacts with R4: a depth bound is exactly "evaluation got stuck", so the two must be stated together |
| **E · Type errors thrown by the base** | `evaluator.ts` ×6, `primitives.ts` ×6 | `Type error: argument N expected X, got Y` | **REWORK.** This is R6 violated, not a specification to be written. See below |
| **F · Primitive argument errors** | the bulk of `primitives.ts`'s 99 | A primitive given the wrong arity or an argument it cannot use | **Specification** — the base may reject an ill-formed application. Needs a requirement: candidate **R20**. Also needs D1, because today these are indistinguishable from class A |

### 7.1 Class E is the finding

`checkArgType` **lives in `src/evaluator.ts`** — the L0 evaluator — and it
calls `getType`, reads `typeContextName`, evaluates refinement predicates,
dispatches through an `instanceof` binding, and throws `Type error`. The
evaluator does not merely *name* a layer concept; it **implements type
checking**.

The import list makes the scale plain. Three L0 modules import from L2:

| L0 module | Imports from | Symbols |
|---|---|---|
| `evaluator.ts` | `types-std.js` (×2), `refinements.js`, `effects.js` | **27** — `getType`, `withType`, `typeMethod`, `applyBoundaryBound`, `unifyTypes`, `assertMemberAvailable`, `typePrivilegedCtx`, `PredicateSet`, `AbstractDomain`, `impliesDomain`, `effectsOf`, `unionEffectSets`, … |
| `scope.ts` | `refinements.js` | `PredicateSet`, `mergePredicateSets` |
| `futures.ts` | `types-std.js` | `withType`, `ErrorType`, `StringType` |

This is a violation of **the project's own stated invariant**, not only of
proposed R6: `CLAUDE.md` says *"Dependencies point downward only."* They do
not. It is also the most consequential delta the spine has found — larger by
far than the eleven hardcoded channel names (B-109(a)), which are a naming
leak where this is a whole subsystem living one layer too low.

**Disposition: rework, and it is an arc, not a chunk.** Recording the
question it has to answer rather than pre-empting it: type-directed dispatch
is genuinely needed *during* evaluation (that is R2 — discharge happens by
evaluating), so the fix is not "delete the import". It is to determine what
concept-free capability the evaluator actually needs — a dispatch hook the
layer installs, in the shape of `installChannelMerge` — such that L2 supplies
the meaning. **→ B-110.**

### 7.2 D1 — one exception class for six classes of failure

A host-invariant assertion (A) and a user's argument error (F) are the same
JavaScript class, carry no discriminator, and nothing catches either. So:

- A tool cannot report "this is an interpreter bug, please file it" separately
  from "your program is wrong", because it cannot tell.
- The R4 measurement that started this section had to be done by **reading
  117 call sites**, since counting `AllegroError` alone cannot distinguish an
  abort that is specified from one that is a bug.

**Disposition: specification.** The abort classes above are the vocabulary;
the mechanism needs to carry which one. **→ B-110.**

### 7.3 What this changes about R4

R4 stays as written — *evaluation never gets stuck on unresolved information*
— and it is now **traceable**: classes A–D and F are aborts that are not "getting
stuck on unresolved information" (they are invariant violations, denials,
bounds, and ill-formed applications), so none of them contradicts it. Class E
does not contradict R4 either; it violates R6. The 117 throws were never
evidence against R4. They were evidence that **no requirement covered
aborting at all** — which is the real gap, and which candidates R18, R19 and
R20 fill.

## 8. Metadata requirements, merged (S2d)

> Maintainer ruling: *"R5, R11 and R13 could be reframed into a single
> requirement about metadata field processing and independence — but the fixed
> vocabulary is clearly specification. We also need to ask if the fixed
> vocabulary is necessary or if it could be handled entirely by registered
> rules."*

### 8.1 The merge

R3 (orthogonality), R5 (survival), R11 (declared propagation) and R13
(mergeability) are four statements about one thing. Proposed replacement:

> **R3′ — Metadata channels are independent.**
> *Subject: Allegretto.*
> A value may carry named information about itself. Each channel's handling
> is **independent of every other**: an operation's treatment of one channel
> may not depend on which other channels are present, and **no operation may
> disturb a channel it does not know about**. How a given channel is handled
> is determined by that channel's own declaration, not by the operation.

That single sentence subsumes:

| Was | Now |
|---|---|
| R3 orthogonality | "independent of every other" |
| R5 survival | "no operation may disturb a channel it does not know about" — and this is the **non-interference** sharpening §6.2 C5 asked for, which the old R5 could not express because "survives per its rule" is vacuous under `drop` |
| R11 declared-not-coded | "determined by that channel's own declaration, not by the operation" |
| R13 mergeability | *dropped from the requirement* — see §8.2 |

Four requirements → **one**, and it says more than the four did: the old R5
could not forbid a `drop` channel being dropped by an operation that had
never heard of it, because dropping was its rule. R3′ can, because
non-interference is about **which operation** disturbs a channel, not about
whether the channel survives.

R3′ also absorbs §6.1 F4 correctly: it states the *requirement* (channels are
independent) without the *specification choice* (where they are stored). On-
value versus side-table is now purely SC territory.

### 8.2 Is the fixed vocabulary necessary?

The vocabulary — `viral`, `union`, `computed`, `positional`, `drop` — is
**specification**, as ruled. The open question was whether it is *needed*, or
whether a channel could simply register an arbitrary propagation function.

**It is needed, and the reason is R12.**

`registerChannel` performs this check:

```
if (spec.integrity && (spec.rule === "viral" || spec.rule === "union"))
    throw …  // forgery vector C
```

An integrity channel may not take a **fabricating** rule — one that puts a
value on a result that no holder of the writer put there. That check is
possible only because rules are **inspectable symbols**. Hand the base an
arbitrary closure and it cannot tell a fabricating rule from a
non-fabricating one; the check becomes unwritable, and R12's guarantee — that
metadata carrying authority is unforgeable — degrades from *enforced* to
*hoped for*.

So the two halves of the objection resolve against each other, which is the
useful result:

| | Arbitrary closures | Fixed vocabulary |
|---|---|---|
| R3′ independence | satisfied | satisfied |
| R6 layer-ignorance | satisfied (base sees an opaque function) | satisfied (base sees an opaque symbol) |
| **R12 integrity** | **not enforceable** — a closure is not inspectable | **enforceable** — fabricating rules are a decidable subset |
| Cost | none | the vocabulary must be *sufficient*; a layer needing an unlisted discipline is blocked |

**Proposed SC-7 — propagation is drawn from a fixed, inspectable
vocabulary.** *Satisfies R3′; its criterion is R12 enforceability.* Revisit
if a layer needs a discipline the vocabulary cannot express — at which point
the choice is to extend the vocabulary (cheap, keeps R12) rather than to
open it to closures (loses R12).

This is also where R13 goes: "channels can merge" is not a requirement, it is
the observation that **`union` must be in the vocabulary** — a sufficiency
argument about SC-7's contents, recorded there.

*Note.* `installChannelMerge` already fits this: the base holds the *symbol*
`union` and the layer installs the *merge function* for its own channel. The
discipline is inspectable, the semantics are the layer's. That is the pattern
generalising, and it is further evidence the current design is right where
its wiring is wrong.

---

# T0 · Representation

What a value is, before anything has been said *about* it. This tier is
Allegretto with no type system present at all.

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

## 8. PrimitiveFunction

> **Level: Specification** — satisfies R2, R5, R11.

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

## 10. Carrier

> **Level: IMPLEMENTATION** — choice **IC-3**, realising R3. Not part of the specification: a different metadata mechanism (a channel map on every value) would delete this concept entirely.

**Definition.** A *carrier* is a Structure that stands in for another value:
its data plane is empty, the value it stands for sits in `primary`, and its
channels (T2) ride alongside. A carrier is how a non-composite value — a
Bits, a function, a residual — comes to carry metadata without changing kind.

**Rationale.** This is D46's option B, and it is why "attach a type to a
number" does not require a MultiValue *kind*. Carriers never nest (the W1
invariant): wrapping a carrier re-wraps its inner data rather than layering,
so `dataOf` is one hop and not a loop.

**As implemented.** No separate type — the host-level test is *primary
presence*, `isCarrier(v)` in `src/structure.ts`. The static shape is
`CarrierStructure` in `src/types.ts`.

**Status (D48(b), 2026-08): this concept is scheduled for DELETION.** IC-3
was ruled the other way — metadata becomes a field on every value — so a
non-composite value no longer needs to become something else in order to
carry a field. When B-121 lands, §10 leaves the spine, `primary` (194
occurrences) and `isCarrier` go with it, W1 (carriers never nest) has nothing
to constrain, and `dataOf` (902 occurrences) becomes the identity function.
The entry stays until then, because the code still works this way.

**Delta.** — *(closed at C9. It was `MultiValueType`, 25 uses, naming a kind
D46 retired, with a comment saying it survived "so existing casts keep
compiling" — a type name documenting its own obsolescence. Renaming it also
exposed that `withMetadata` (was `makeMultiValue`) DECLARED a carrier return
while one of its three paths returns a non-carrier derive; the honest return
type is `StructureValue` and only one site — a test cast — depended on the
fiction.)*

## 11. Data plane

> **Level: Specification** — satisfies R3, R5. **D48(b) simplifies the implementation of this entry, not the entry**: once metadata is a field on every value, "the data of a value" is the value, and `dataOf` becomes the identity function the Allegro side already assumes it is.

**Definition.** The *data plane* of a value is the value it ultimately
denotes, ignoring anything carried alongside. For every value except a
carrier that is the value itself; for a carrier it is the primary.

It has **two consumers with different interfaces**, and conflating them is a
mistake worth naming. From **inside the language** — Allegretto or Allegro
code — a value simply *is* its data: the carrier is invisible, which is
exactly what D46's *transparent* carrier means, and there is no accessor to
call. From **the host** — the interpreter reaching into a value it is
implementing — the carrier is visible, and `dataOf` is the only sanctioned
way to see past it.

**Rationale.** Ordering note — this entry and §10 are mutually referential in
prose (a carrier is defined by having a data plane; the data plane is defined
by the carrier's primary). The cycle is broken by defining the carrier
*structurally* (a Structure with a `primary` field) and the data plane as the
*accessor* over that shape. Recorded rather than written around, per the
ordering constraint.

The rule that primitives receive FULL values and read data through `dataOf`
is what keeps channels intact across a call: a primitive that unwrapped its
arguments would silently drop every channel they carry.

**As implemented.** `dataOf(v)` in `src/types.ts` — one property read,
re-exported from `src/slots.ts`. It is a **host function**; nothing in
Allegretto or Allegro calls it, and nothing should.

**Delta.** —

---

# T1 · Structure and binding

What a Structure is made of, and the three roles it plays.

## 12. Structure roles

> **Level: IMPLEMENTATION** — choices **IC-1**, **IC-2**. SC-5 says *one composite kind*; the four roles are how this host realises it, and the gap between those two sentences is IC-1's whole finding.

**Definition.** A Structure plays exactly one of three roles, chosen at
construction:

| Role | What it is | Storage |
|---|---|---|
| **Record** | A data value with named parts — records, types, proofs, module objects | binding map + list |
| **Dense** | A numeric-keyed data value — arrays | a plain element array (§16) |
| **Scope** | Evaluation environment, not data (§15) | binding map + parent link |

Plus the carrier *configuration* (§10), which is orthogonal: a carrier is a
record-role Structure with an empty data plane.

**Rationale.** Role is fixed at construction so that no value changes what it
is under you, and so the host can keep one hidden class across all of them.
The record/scope split is a **plane split**: scopes are evaluator state and
mutable; data structures are born immutable (D22). Each rejects the other's
operations.

**As implemented.** `src/structure.ts` — `newContextStructure`,
`newDenseStructure`, `newMultiValueStructure`. Role is read from field
presence (`dense`, `isScope`, `primary`) rather than stored as a tag.

**Delta.** — *(closed at C9. The header described **two** planes ("channel
plane → components, slot/data plane → bindings") where there are four, and
said `__*` meta-slots "remain here until C5 re-keys them" — C5 did not, and
B-104 is doing it two milestones later. Now names all four and points the
host-plane row at `StructureHostFields`.)*

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

## 16. Dense region

> **Level: IMPLEMENTATION** — choice **IC-2**. Invisible from the specification in principle; visible in practice, which is §17's delta. **D48(a): under option E the dense region stops being a ROLE and becomes a representation below the specification — which is what this level tag always said it was. Owner B-120.**

**Definition.** A Structure in the *dense* role stores its elements in a
plain array rather than as per-element bindings. Its slot count is the array
length. This is the representation of arrays (D18: an array is a
numeric-keyed structure).

**Rationale.** Numeric keys through a string-keyed map cost a Binding object
and a decimal string per element. The dense region removes both while keeping
arrays the *same kind* as every other composite — the saving is
representational, not conceptual.

**As implemented.** `dense?: Value[]` on `Structure`; `denseIndexGet`,
`denseSlotCount`, `denseElements` in `src/structure.ts`; accessors
`indexGet` / `getSlotCount` / `elementsOf` in `src/slots.ts`, which never
materialize the legacy view.

**Delta.** —

## 17. The legacy view

> **Level: IMPLEMENTATION** — choice **IC-2**. Pure compatibility scaffolding; nothing in the specification requires it. **D48(a) DELETES it**: with no dense role there is no view to materialize, and `__length` and the W6 coherence invariant go with it. Owner B-120, which therefore closes B-104(f) — the last dunder.

**Definition.** A dense Structure can still be read through the binding map
and list. That view is **materialized lazily** on first such access, then
cached, and contains one binding per element under its decimal key plus a
`__length` binding holding the count.

**Rationale.** Compatibility: reflection, destructuring and generic walkers
predate the dense region and address elements by string key. Materializing on
demand keeps them working without slowing the paths that use the accessors.
The W6 invariant asserts view/dense coherence wherever a view exists.

**As implemented.** `materializeView` in `src/structure.ts`; `viewMaterialized`
reports whether it has happened; boundary tests pin both the `__length` entry
and the list length.

**Delta.** `__length` is the **only** key `isMetaSlotKey` ever returns true
for — measured across the full suite: 296 hits, and no other key once. So the
entire remaining job of the engine/user-field partition test is hiding this
one derived slot from field walks. That is a strong hint the right fix is to
make the walks dense-aware rather than to keep a name-prefix predicate, but
it is T2's call, not this entry's. Tracked at **B-104(f)**.

---

---

# T2 · Planes

The tier whose absence caused B-104. A **plane** is where a piece of
information about a value lives, and the four are not interchangeable: which
plane a thing belongs on determines who may write it, what happens to it
under evaluation, and whether Allegro can see it at all.

## 18. Plane

> **Level: Specification** — satisfies R3′, R8, R12.

**Definition.** A *plane* is one of four storage regions a value's
information can occupy, distinguished by **who may write it** and **what
evaluation does to it**:

| Plane | Holds | Written by | Under evaluation | Visible to Allegro |
|---|---|---|---|---|
| **Data** | What the value *is* | construction | replaced by the result | yes — it is the value |
| **Binding** | A composite's named parts | construction; kernel for engine slots | copied by the operations that copy structures | yes — user fields |
| **Metadata** | Information *about* the value, in named **fields** | the field's registered writer | per the field's declared rule (SC-7) | yes, through field reads |
| **Host** | Interpreter bookkeeping | the host, freely | nothing — it is not part of the value | **no** |

**Rationale.** The planes are what make R3′ possible: an operation can carry
a metadata field it has never heard of precisely because the metadata plane is
separate from the data it is operating on. They are also the answer to "where
should this new thing go?", which is the question nobody could answer for
four years because the planes were never written down.

**The rule for placing something new.** Ask in order: *Is it what the value
is?* → data. *Is it a part a user names?* → binding. *Is it information about
the value that must survive operations?* → metadata, and it needs a registered
rule and a writer. *Is it none of those?* → host, and it must not be
observable from Allegro.

**As implemented.** Data → `primary` / the value itself, read via `dataOf`.
Binding → `bindings` + `bindingList` (+ `dense`). Metadata → `components`.
Host → JS expandos and declared-but-non-value fields on `Structure`.

**Delta.** — *(closed at C9. The host plane was **declared inside the value
interface** — `parent`, `isScope` and `scopePredicates` on `StructureValue`
while their own comments said "host-plane fields, never value slots". A plane
documented in comments and contradicted by the type is not a plane but a
convention. `StructureHostFields` now declares it. Note the scope: this fixes
the DECLARATION. Host-plane residents that belong on another plane are
B-118, and that item exists because this entry made the two separable.)*

## 19. Metadata field

> **Level: Specification** — satisfies R3′, R12. *Renamed at S2f from
> "channel", which was two concepts sharing a word — see §19b.*

**Definition.** A *field* is one named slot of the metadata plane, with a
**declared propagation rule** and a **writer capability**. Registration is
one-shot: the first registrant receives the writer as a closure and no one
else can obtain it. Reads are free.

**Rationale.** One-shot registration is what makes R12 work without the base
knowing which fields matter: authority is *the closure*, not the name, so
"who may write `discharged`" is answered by possession rather than by a list
the base would have to maintain — and would have to be told to maintain,
violating R6.

**As implemented.** `registerChannel(spec)` in `src/slots.ts` returns a
`ChannelWriter`; `channelReadRaw(v, name)` reads; `channelSpec(name)` returns
the registration; storage is the `components` map. `kernelChannelWriter` is
the kernel's acquisition path, lint-restricted to two modules.

**Delta.** The base **registers eleven fields itself** at module init and
special-cases three by name. R6 says the owning layer should register its
own. **→ B-109(a).** Naming: the implementation calls fields "channels"
throughout — see §19b's delta.

## 19b. Channel

> **Level: Specification** — satisfies R2, R3′. *New at S2f (maintainer).*

**Definition.** A *channel* is the whole apparatus by which one capability
rides values through partial evaluation: **one or more metadata fields**,
their propagation rules, their writer, and the layer-side semantics that
interpret them. Typing is a channel. Effect analysis is a channel. Proof
discharge is a channel. A field is storage; a channel is a capability.

**Rationale.** R2 says layers are added by partial evaluation, and R3′ says
their information rides on values independently. A *channel* is what one such
layer's participation actually consists of — which is more than a slot, and
is why the two need different words. The distinction is not cosmetic: a
capability may need several fields (knowledge needs three), and a field may
be read through more than one projection (`shape` is a projection of `type`).

**As implemented — the distinction already exists and has no name.** Eleven
things are registered in one registry as though they were the same kind of
thing. They are not:

| Registered | Actually is | Channel |
|---|---|---|
| `type` | a stored field | typing |
| `shape` | a **projection** of the `type` field (refinement layers walked off) — no storage of its own | typing |
| `predicates` | a stored field | knowledge |
| `domain` | a stored field | knowledge |
| `bound` | a stored field | knowledge |
| `knowledge` | a **capability with no field at all** — nothing ever stores a `knowledge` component; its own comment says its storage *is* `predicates`/`domain` plus the refinement layers | knowledge |
| `effects` | a stored field | effect analysis |
| `error` | a stored field | error propagation |
| `discharged` | a stored field (binding-plane) | proof |
| `source` | a stored field | provenance |
| `warnings` | a field, currently unused | diagnostics |
| `exported` | a **retired** field — B-097 V1 moved export-ness to `Binding.visibility` | — |

So the registry holds **fields, one projection, one capability, one dead
entry and one unused entry**, undifferentiated. `knowledge` is the proof: it
is registered exactly like `predicates` and is not the same kind of thing at
all.

**Delta.** The code has one word and one registry for two concepts. Renaming
`registerChannel` → field registration and introducing a channel-level
registration (which fields, which semantics, which layer owns it) is the
change; **B-109(a)** — moving registration to the layers — is the natural
moment to do it, since a layer registering its own capability is exactly a
channel registration. **→ B-111.**

## 20. Propagation

> **Level: Specification** — **SC-7**, satisfies R3′; criterion R12.

**Definition.** A field's *propagation rule* says what an operation does
with that field, drawn from a **fixed, inspectable vocabulary**: `viral`
(present on any argument ⇒ present on the result), `union` (arguments'
values combined by the channel's installed merge), `computed` (the channel's
owner derives it), `positional`, `drop` (never carried forward). The base
applies the rule without knowing what the channel means; the *semantics* a
rule needs are installed by the channel's owner.

**Rationale.** The vocabulary is fixed rather than open — a channel cannot
register an arbitrary propagation closure — and the reason is R12, not
convenience. `registerChannel` refuses a `viral` or `union` rule on an
integrity field, because those **fabricate**: they place a value on a
result that no holder of the writer put there. That check is decidable only
over an inspectable symbol; over a closure it is unwritable, and R12 degrades
from enforced to hoped-for. See Part 0 §8.2.

**As implemented.** `PropagationRule` in `src/slots.ts`; `viralChannels()`
and `unionChannels()` are cached filters over the registry;
`installChannelMerge(name, fn)` is how a channel supplies `union` semantics —
`src/effects.ts` is the one caller, and the pattern to generalise.

**Delta.** — *(the mechanism is correct; its wiring is §19's delta)*

## 21. Writer capability

> **Level: Specification** — satisfies R12.

**Definition.** The authority to *originate* a field value is a closure
handed to whoever registered the field. Reads require nothing (D23).
Origination on a user-reachable construction path is refused unless the
writer is held.

**Rationale.** Metadata that anything can write cannot be evidence. Denial is
an **abort, not an error value** (Part 0 §7 class C) — an error value would
be forgeable, since the forger chooses what to do with it.

**As implemented.** `ChannelWriter` closures; `assertNotIntegrityKey` guards
object literals and `mv_set`; forgery scenarios A–F in the boundary battery.

**Delta.** Integrity is enforced by a **hardcoded name list**
(`INTEGRITY_CHANNEL_NAMES = ["discharged", "source"]`) rather than by the
registered `integrity` flag — protection by name, which is the one form that
cannot survive the layer registering its own channels. The two sources
disagree: `source` is in the list but is registered **without**
`integrity: true`. **→ B-109(b)/(c).**

## 22. Meta slot

> **Level: IMPLEMENTATION** — realises the binding plane. Dissolving.

**Definition.** A *meta slot* is a binding the engine owns rather than the
user, historically marked by a `__` name prefix. (Distinct from a metadata
field: a meta slot lives on the BINDING plane, §18.)

**Rationale (historical).** The prefix partitioned one shared bindings map
between engine metadata and user fields. That partition was real when type
Contexts and instances shared a namespace; it is not now.

**As implemented.** `isMetaSlotKey(key) = key.startsWith("__")`, five guard
sites, and `SLOT_REGISTRY` in `src/slots.ts`.

**Delta.** Measured across the full suite, the predicate returns true for
**exactly one key** — `__length`, 296 times, nothing else. Type Contexts hold
only meta, instances hold only user fields, `__members` is FQN-keyed: the two
populations never meet. The concept is a compatibility artifact of the dense
legacy view (§17), not a plane distinction. **→ B-104(b)/(f).**

## 23. The layer boundary

> **Level: Specification** — satisfies R6. **This entry absorbs B-110.**

**Definition.** L0 may not depend on L2. A layer supplies its meaning to the
base by **installing** it against a plane interface; the base never imports
the layer.

**Rationale.** R6, and it is the same discipline as §20's
`installChannelMerge`: the base holds an inspectable symbol, the layer
installs what it means. That is what makes Allegro an extension stack rather
than a privileged layer (R1).

**As implemented — and this is the largest delta in the document.** The
evaluator does this **correctly for channels and incorrectly for types, in
the same file.**

- *Correct:* `evaluator.ts` propagates channels through the plane interface —
  `viralChannels()`, `channelSpec(k)?.rule === "union"`, `channelMerge(k)`.
  Layer-ignorant, exactly as R3′/SC-7 intend.
- *Incorrect:* it also imports **27 symbols** from three L2 modules
  (`types-std`, `refinements`, `effects`), and `checkArgType` — which calls
  `getType`, reads `typeContextName`, **evaluates refinement predicates**,
  dispatches through an `instanceof` binding and throws `Type error` — lives
  in `evaluator.ts` itself. `scope.ts` imports `PredicateSet`;
  `futures.ts` imports `withType`, `ErrorType`, `StringType`.

This violates the project's own stated invariant (`CLAUDE.md`:
*"Dependencies point downward only"*).

**The decomposition that makes it tractable**, found by reading rather than
assumed: `getType(v)` is **literally `channelReadRaw(v, "type")`** plus a kind
check — an L2 alias for an L0 call. So the two halves separate cleanly:

| Half | Nature | Disposition |
|---|---|---|
| **Reading** the type off a value | Already layer-ignorant — a channel named `type` is opaque to the base | Use the plane interface directly; the L2 import is gratuitous |
| **Interpreting** it — `typeMethod` (FQN member lookup), `unifyTypes`, `applyBoundaryBound`, refinement-predicate evaluation, `assertMemberAvailable` | Genuinely L2 semantics | **Installed, not imported** — the `installChannelMerge` shape |

Type-directed dispatch *is* genuinely needed during evaluation — that is R2,
since discharge happens by evaluating — so the fix was never "delete the
import". It is that the evaluator needs a **dispatch hook the layer
installs**, and reads the type through the plane it already uses for every
other channel.

**Delta. → B-110**, now scoped by this entry rather than left open-ended.

## 24. Plane interfaces

> **Level: Specification** — satisfies R3′, R6, R12. *Elevated to a
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
| **Data** | Allegretto / Allegro code | **none** — a value *is* its data; the carrier is transparent (D46) | construction | the representation constructors |
| **Data** | the host | `dataOf(v)` — the only sanctioned way to see past a carrier | the host | the representation constructors |
| **Binding** | user code | member dispatch | construction | `makeStructure` + the binding writers |
| **Binding** | engine (meta slots) | `src/slots.ts` accessors | kernel | the same accessors ⚠ *four write disciplines, §13; and see the disposition note below* |
| **Metadata** | anyone | `channelReadRaw(v, field)` — free (D23) | field owner | the writer closure from registration |
| **Metadata** | the evaluator | the propagation table: `channelSpec(f)?.rule`, `viralChannels()`, `channelMerge(f)` | — | — |
| **Metadata** | user-reachable construction | refused unless the writer is held (`assertNotIntegrityKey`) | — | — ⚠ *enforced by name list, §21* |
| **Host** | the host only | direct field access | the host | direct field access ⚠ *declared on the value interface, §18* |
| **Layer → base** | the base, for semantics it must not know | **install**, never import | the layer | `installChannelMerge` and hooks like it ⚠ *27 upward imports, §23* |

**Disposition of the engine/meta-slot row.** It does **not** disappear when
`__length` does. `__length` is the last key the *partition test* fires on
(§22), so removing it retires `isMetaSlotKey` — but the *interface* is the
accessor layer over engine-owned bindings, and that persists as long as such
bindings exist.

It should nonetheless **shrink to zero**, and D39 already says how:
**14** registered slots are dispositioned as declared **members**. The proof
fields are the precedent and are already executed — `proposition`, `lhs`,
`rhs`, `reason`, `counterexample` are plain-named, engine-written and
user-visible, which puts them on the *ordinary* binding interface rather than
a privileged one. As the remaining 14 follow, this row dissolves into the row
above it and the concept "engine meta slot" stops existing. That is the end
state; the ⚠ is a defect in the interface meanwhile, independent of it.

**The last row is the one that matters.** It is the only interface in the
table that is not yet a mechanism — `installChannelMerge` is one instance of
a pattern that has no general form. The interfaces the specification still
owes:

1. **A dispatch hook.** The evaluator needs type-directed dispatch during
   evaluation (R2 — discharge happens *by* evaluating) and must not know what
   a type is. So a channel installs *how to dispatch on my field*, and the
   evaluator calls it with an opaque field value. This is §23's decomposition
   made concrete, and it is the interface B-110 is really about.
2. **A check hook.** `checkArgType` currently lives in the evaluator. Under
   the same shape, a channel installs *how to check a value against my
   field*, and the evaluator calls it without knowing the answer is a "type".
3. **A projection hook.** `shape` is a computed projection of the `type`
   field (§19b), and the projection is hardcoded in `channelReadRaw`. A
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

**As implemented.** Two of the eight rows have a real mechanism
(`dataOf`, `channelReadRaw` + the propagation table). Four are conventions
enforced by lint or by nothing. The layer→base row has one instance and no
general form.

**Delta.** The interfaces are the specification's biggest gap: four hooks are
owed, and every T2 delta is an instance of one of them being absent. **→
B-112**, which supersedes the "what capability does the evaluator need"
question in B-110 by naming it.

---

# T3 · Evaluation

How a program becomes a result, or a residual. This tier is R2 and R4 made
concrete.

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

## 30. Type

> **Level: Specification** — satisfies R2, R3′. *L2 concept; the base knows
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
plus the `src/slots.ts` writers; `getType(v)` is `channelReadRaw(v, "type")`
with a kind check.

**Delta.** The **type Context namespace is closed** — a user field named
`name` is routed into `__members` under an FQN key and never lands beside
`__name` — but nothing states or enforces that. It is the property S1
measured and the reason the dunder partition was unnecessary; it deserves to
be an invariant rather than an accident. **→ B-107.**

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

**As implemented.** `typeShape(t)` in `src/slots.ts`, walking `__refines`
while `__members` is the same object. `shape` is registered as a metadata
field but stores nothing — it is a **projection** of `type` (§19b).

**Delta.** The projection is hardcoded in `channelReadRaw` rather than
installed by the typing channel. **→ B-112(c).**

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

## 34. Knowledge

> **Level: Specification** — satisfies R2, R3′. **Distinct from §32.**

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
`src/slots.ts`.

**Delta.** — 

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

## 40. Effect

> **Level: Specification** — satisfies R2, R3′.

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
`installChannelMerge("effects", …)` supplies the union — the one instance of
the R11 pattern working (§20).

**Delta.** — 

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
field moved to `components` at B-104 chunk 3. It is also the one whose
integrity flag and guard list disagree (§21). **→ B-104, B-109.**

## 45. Obligation, verdict, and the assumption ledger

> **Level: Specification** — satisfies R2, R12. **Where sufficiency gap S1
> lands (Part 0 §6.3).**

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

S4 claimed this as a **requirement gap** (candidate R15): the requirement set
is per-value, the verdict is program-level, therefore nothing enables it. The
maintainer's counter is correct and better: **a program is a value**, and
accumulating metadata across an expression *is what channel operations
already do*. Effects union upward; errors are viral; `div` is an effect and
so unions too. On that model the verdict simply **is** the top-level value's
accumulated metadata, and it is each channel's job to define an accumulation
that reaches it. No new requirement is needed — R3′ plus SC-7's `union`
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
| 17 | `__length` is the sole remaining job of the partition test — **now owned and decided: D48(a) deletes it with the dense role** | B-120 → B-104(f) |
| 18 | ~~The host plane is declared inside the value interface — a plane contradicted by its own type~~ **CLOSED C9** (`StructureHostFields`) | B-107(f) |
| 19 | The base registers eleven L2 channels itself and special-cases three by name | B-109(a) |
| 21 | Integrity enforced by hardcoded name list, not the registered flag; the two disagree about `source` | B-109(b)(c) |
| 22 | The meta-slot partition fires on one key in the whole suite — **that key is `__length`, which D48(a) removes** | B-120 → B-104(b)(f) |
| 23 | **L0 imports 27 symbols from L2**; `checkArgType` lives in the evaluator | B-110 |
| 19b | One word and one registry for two concepts — fields, a projection, a capability, a dead entry and an unused one, undifferentiated | B-111 |
| 24 | **Four plane interfaces are owed**: dispatch hook, check hook, projection hook, channel registration. Every other T2 delta is an instance of one being absent | B-112 |
| 27 | The TailCall forwarding obligation is convention-enforced; a wrapper that forgets is a silent cliff | B-113 |
| 28 | Completion confluence is not guaranteed by construction — the B-028 arrival-order bug was fixed, not precluded | B-114 |
| 29 | L2 post-passes are hardcoded into the base pipeline — §23's violation in its other form | B-110 |
| 30 | The type-Context namespace is closed by construction but nothing **enforces** it — *stated* at C9, enforcement outstanding | B-104(f) |
| 32 | The `shape` projection is hardcoded in `channelReadRaw` rather than installed | B-112(c) |
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

### Raised by C9 (the naming pass)

| # | Delta | Owner |
|---|---|---|
| 47 | **`Context` still names three different things in ~300 local identifiers.** C9 renamed every DECLARED name in which "Context" or "Ctx" denoted the retired composite kind. What remains is role-qualified and could not be renamed mechanically, because the roles are not all settled: `evalCtx` (**603**, and a public field of `evalSource`'s result) is a **scope** and §15 settles it; `typeCtx` / `typeContextName` / `typePrivilegedCtx` denote a **type Context**, a term *this document still uses*; and `src/parser.ts` has its own unrelated `makeContext` (a **parse** context), exported as `parserMakeContext`. Three meanings, one word | B-119 |
| 48 | **`withMetadata` declared a carrier return for a non-carrier path.** One of its three paths returns a copy-on-write derive, not a carrier, and the declared type said otherwise. Corrected at C9; **exactly one site** depended on the fiction — a test cast — which is the evidence it was never load-bearing | — *(closed at C9)* |
| 50 | **The carrier is 74% of all structures and 98.5% hold one field**; `dataOf` really unwraps 182,311 times | **D48(b)** → B-121 |
| 51 | **`withMetadata` is four operations under one name**, and one of them (`withMetadata(newP, cloneComponents(v))`) is spelled as two calls where omitting the second silently drops metadata | **D48(c)** → B-121 |
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
reaches it — R3′ and SC-7's `union` already say so. **R15 withdrawn.** The
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
through the plane interface — `viralChannels()`, `channelSpec(k)?.rule`,
`channelMerge(k)`, entirely layer-ignorant — **and in the same file** imports
27 L2 symbols and hosts `checkArgType`. The discipline is not missing; the
type system simply bypasses it. That is why B-110 belongs here rather than as
a separate arc: it is not a new problem, it is §18's plane rule not being
applied to one subsystem.

And the decomposition falls out of the plane framing: `getType(v)` is
`channelReadRaw(v, "type")` with a kind check, so *reading* a type is already
an L0 operation and only *interpreting* it is L2. The fix is a dispatch hook
the layer installs — the shape `installChannelMerge` already has.

### What the level tags revealed (S2a)

Tagging the seventeen entries with their level (Part 0 §0) produced a finding
the four-part format alone had missed: **four of them are Implementation, not
Specification** — the carrier (§10), Structure roles (§12), the dense region
(§16) and the legacy view (§17). All four had been written as though they
were concepts of the language. They are not: they are how *this host* realises
§9, and a different Allegretto satisfying R1–R6 would have none of them.

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
