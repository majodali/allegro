# Concept spine: the analysis record (Part 0, 2026-08)

> **Record.** History kept for its evidence, not current intent. This
> document holds, verbatim, the analysis passes and measured rulings that
> produced Part 0 of `docs/book/concepts.md` (the conceptual model's foundations)
> between S2b and S2d of the concept-spine plan, 2026-08. They were moved
> here on 2026-10-20 so that `docs/book/concepts.md` holds the model and this holds
> how the model was arrived at (`docs/documentation-census.md`, the
> `docs/book/concepts.md` row; `docs/plans/documentation-standards-delta.md` §6.2,
> the record type). Nothing here was rewritten. Section numbers inside the
> moved text refer to Part 0's numbering at the time; the mapping is at the
> head of each section.
>
> What each pass concluded is stated once, in `docs/book/concepts.md` Part 0 §1.0
> (the set at a glance) and in the entries' status lines. Read this
> document when you need the argument, not the outcome.

| Section here | Was | Taken at | What it is |
|---|---|---|---|
| §0 | new 2026-10-21 | — | Retired identifiers: what each was, what replaced it, and when |
| §1 | Part 0 §4 | S2b | Two objections to the requirement set, both resolved as implementation violations (B-109) |
| §2 | Part 0 §6 | S2c | The cohesion pass over R1 to R14: derivability, pairwise conflict, sufficiency |
| §3 | Part 0 §7 | S2d | The abort classification: 117 base throws in six classes |
| §4 | Part 0 §8 | S2d | The metadata merge: R3, R5, R11, R13 into R3′; the fixed vocabulary as SC-7 |
| §5 | inside Part 0 §3 | B-108 | The measured rulings on IC-1, IC-2 and IC-3 (D48) |

---

# 0. Retired identifiers

The book carries only live identifiers (D52: book content depends on no
history that is not in the book). An identifier that was proposed and then
merged, reclassified, withdrawn or renamed is listed here, so an older
citation can be followed. In the verbatim text below, **R3′ is today's
R3**: the merged requirement was named R3′ from the S2d merge until
2026-10-21, when PROCESS §6's naming rule (flat sequence numbering, never
primes) was applied to the book and the merged requirement took the
number of the statement it replaced.

| ID as cited | Was | Became | When | Where |
|---|---|---|---|---|
| R3 (original) | Values carry metadata, and each channel is processed orthogonally | merged into the requirement now numbered R3 (metadata channels are independent) | S2d, 2026-08 | §4.1 |
| R3′ | the merge's working name | renamed R3 | 2026-10-21 | this table |
| R5 | Metadata survives evaluation | merged into R3; its survival clause became non-interference | S2d | §4.1; §2.2 C5 |
| R7 | Allegretto is replaceable | reclassified as the sufficiency claim, not a requirement | S2c | §2.1 F1 |
| R11 | Propagation is declared, not coded | became specification choice SC-7 | S2d | §4.2 |
| R13 | Channels can carry mergeable information | became `union` in SC-7's vocabulary | S2d | §4.2; §2.1 F3 |
| R15 | Program-level aggregation | withdrawn: a program is a value, and channel operations already aggregate | S4b | `docs/book/concepts.md` §45 |
| IC-1 to IC-7 (pre-S2b) | the implementation-choice numbering before S2b | renumbered; the mapping is in `docs/book/concepts.md` Part 0 §3's note | S2b | — |

---

# 1. Known tensions (was Part 0 §4)

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


---

# 2. Cohesion of the requirement set (was Part 0 §6)


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


---

# 3. Abort classification (was Part 0 §7)


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


---

# 4. Metadata requirements, merged (was Part 0 §8)


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

# 5. The B-108 rulings, with their measurements (was inside Part 0 §3)

## 5.1 IC-1: the doubt and its dissolution

The text that stood under the IC-1 entry before B-108 ruled, and the ruling.

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

## 5.2 IC-2: option E, ruled and executed

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
> **Owner: B-120 — EXECUTED 2026-09**, chunks E1–E6, plan
> `docs/plans/entry-sequence-composite.md`.

> ### What landed, and the two places execution corrected the ruling
>
> `entries` is the store and `bindings` is a derived view over it. The dense
> role, the materialized legacy view, `__length`, `isDense`, the **W6**
> invariant and `isMetaSlotKey` are all deleted (§16, §17, §22 retired).
>
> **The index policy is not the one this ruling implied.** IC-2 assumed
> scopes keep an index and data structures do not. E2 measured the crossover
> and E3 measured the implementation: **93.4% of 4.24M lookups are served by
> a scan averaging 3.63 entries**, and only **0.3%** of lookups are on scopes
> at all. So the split is by SIZE, not by role — an index is built lazily on
> first lookup past 8 entries, whatever the structure is. D48(a)'s conclusion
> survives; its stated reason does not.
>
> **An empty array and an empty record are the same entry sequence.** The
> ruling did not anticipate needing to tell them apart. One host-plane bit,
> `Structure.positional`, does — and the maintainer's challenge to it is what
> opened the host-plane audit (**B-133**, **B-135**).


## 5.3 IC-3: metadata as a field on every value, ruled

The ruling text under the IC-3 entry. The construction-lifecycle half (IC-3a) stays in Part 0 because its content is the current specification of `withMeta` and the factories, not a measurement.

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
