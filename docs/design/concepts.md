# Concepts — the definitional spine

> Tier 1. The document a reader (or an agent) reads **first and completely**.
> Every salient Allegro concept, defined in dependency order. The area docs
> (`allegretto/structures.md`, `standard/type-system.md`, …) are where the
> deep treatment lives; this is what makes them legible.
>
> Plan: `docs/plans/concept-spine.md`. Status: **Part 0 + T0–T1 written**
> (S1, S2a); T2–T5 pending. Status tags per `README.md`.
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
*Revisit:* with IC-1/IC-2 → **B-108**.

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
used, and nothing recorded which. **→ B-108.**

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
**→ B-108.**

### IC-3 — Metadata storage: channels by wrapping
*Realises R3.*

A non-composite value carries channels by being wrapped in a **carrier** — a
Structure with an empty data plane whose `primary` is the wrapped value.

| Alternative | Trade |
|---|---|
| An optional channel map on every value | Deletes the carrier concept: no `primary`, no 67 presence-checks, no W1 non-nesting invariant, no `dataOf` indirection. Costs an optional field on every representation, including Bits — so "Bits is just bits" stops being literally true |

**Never written down as a choice at all**, hence no recorded criterion. It is
the largest single source of accidental complexity in T0 by call-site count,
and a genuine trade rather than an obvious win. **→ B-108.**

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

**Delta.** `src/types.ts` opens with `// Five value kinds + Param placeholder`.
There are seven, and `Param` is one of them rather than an aside. The header
predates both `Symbol` and the `Context`→`Structure` renaming. **→ B-107.**

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
through the `src/types.ts` factories (`makeContext`, `makeMultiValue`,
`makeDenseArrayCtx`).

**Delta.** **Three names for one concept.** The class is `Structure`, the
interface is `StructureValue` (**2** occurrences — its own declaration and
the alias), and the name actually used throughout the codebase is
`ContextValue` (**701** occurrences), which exists solely as
`export type ContextValue = StructureValue`. The constructor is
`makeContext`; `makeStructure` does not exist. D1 and D46 are recorded
**executed** — the runtime unification was; the renaming was done by alias.
**→ B-107** (ratified, pulled forward).

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
`MultiValueType` in `src/types.ts`.

**Delta.** `MultiValueType` (**25** uses) names a kind D46 retired, and its
own comment says it survives "so existing casts keep compiling". A type name
that documents its own obsolescence is a rename that stopped halfway.
**→ B-107** (ratified, in scope).

## 11. Data plane

> **Level: Specification** — satisfies R3, R5.

**Definition.** The *data plane* of a value is the value it ultimately
denotes, ignoring anything carried alongside. For every value except a
carrier that is the value itself; for a carrier it is the primary. Reading it
is `dataOf`, and it is the **only** sanctioned way to ask what a value *is*.

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
re-exported from `src/slots.ts` as the accessor call sites use.

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

**Delta.** The header comment in `src/structure.ts` describes **two** planes
("channel plane → components, slot/data plane → bindings"). There are four
(T2 §9). It also says `__*` meta-slots "remain here until C5 re-keys them" —
C5 did not; B-104 is doing it now, two milestones later. **→ B-107.**

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

**Delta.** The map and the list are maintained by convention at each write
site, not by a single mutator, so they can diverge. `slotWrite` writes both;
`slotSet` writes the map **only** — deliberately, to mirror the proof
kernel's origination idiom; `removeName` deletes from the map and leaves the
list entry standing; `removeConstruct` deletes from both. The
leave-the-list-entry behaviour is documented on `renameInPlace` ("bindingList
entries are separate objects and are deliberately left untouched") but not on
the removers that share it. Four write disciplines, one comment between them,
and no stated rule for choosing. **→ B-107.**

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

**Delta.** `parent`, `isScope` and `scopePredicates` are declared as fields
on `StructureValue` and documented in comments as "host-plane fields, never
value slots". The plane distinction is thus asserted in prose and contradicted
by the declaration — the host plane is physically inside the value interface.
**→ B-107**, and the reason T2 §9 has to exist.

## 16. Dense region

> **Level: IMPLEMENTATION** — choice **IC-2**. Invisible from the specification in principle; visible in practice, which is §17's delta.

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

> **Level: IMPLEMENTATION** — choice **IC-2**. Pure compatibility scaffolding; nothing in the specification requires it.

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

## Deltas raised in T0–T1

| # | Delta | Owner |
|---|---|---|
| 2 | `types.ts` header says "Five value kinds"; there are seven | B-107 |
| 5 | `ParamValue.predicates` — reserved, no reader, asserted empty | B-107 |
| 7 | ComposedFunction's host-plane metadata is invisible in its declared shape | T2 §9 |
| 9 | Three names for one concept: `Structure` / `StructureValue` (2) / `ContextValue` (701) | B-107 |
| 10 | `MultiValueType` names a kind D46 retired | B-107 |
| 12 | `structure.ts` documents two planes; there are four | B-107 |
| 13 | Three binding write disciplines, no stated rule for choosing | B-107 |
| 15 | Host-plane fields declared on the value interface they are said not to be part of | B-107 |
| 17 | `__length` is the sole remaining job of the partition test | B-104(f) |

Nine deltas across seventeen entries, on the tier we understand best. Six of
the nine are naming or documentation lag; three (7, 15, 17) are the same
underlying gap — **the planes are real and undeclared** — which is what T2
exists to fix and why it is the highest-value tier in this document.

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
