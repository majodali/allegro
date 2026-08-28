# Allegro — Changelog

> Tier 2. Append an entry per landed chunk (see `docs/PROCESS.md` §5).
> Newest first. Each entry: what landed, key decisions, deviations from
> plan, test count.

## 2026-08 — Concept spine S3b: the interface definition was wrong

Two maintainer questions, and both changed the entry rather than defending it.

**"Is `InterfaceKind` *has no construct*, or *all members signature-only*?"**
Neither, and the alternative fails a one-line test: `Type.define({v: Int})`
has only signature members and a construct, so "all members signature-only"
would make every plain record an interface.

What is actually true is that **two properties are enforced in two different
places, and neither is the definition**: the *predicate* tests no-construct
(checkable from any value); `Interface.define`'s *construction* guarantees
signature-only members (not checkable from the value). The definition is
neither — an interface is a type that exists **to be drawn from rather than
instantiated**.

The deeper point is the maintainer's own. "Has no construct" reads like
**abstractness**, and abstract-vs-interface is a genuine distinction *in a
language with inheritance* — an abstract type has no constructor and some
implementations. **Allegro has no abstract types**, because D44 deleted the
declared is-a edge and abstractness is defined by what you can *extend*. With
nothing to extend, "cannot be instantiated" and "exists to be drawn from"
have no daylight between them, so the predicate happens to select exactly the
interfaces. That is a property of *this* type system, not a general truth,
and it is worth stating precisely because the type system is being rebuilt
around the absence of `extends`.

A second delta falls out: the two guarantees are enforced **independently**
and nothing ties them, and one fails silently —
`Interface.define({greet: self => "hi"})` accepts the lambda, records `greet`
as a **signature**, and **discards the body** with no diagnostic (measured:
the member carries a `fieldType` and no `value`). **→ B-116.**

**"What does *it's also loose* mean?"** A fair question, because the document
used "loose" **six times without defining it**. §33b now does: **declared**
conformance is holding the expected type's member *symbols*, obtained by
drawing them — identity, not spelling; **loose** conformance is having
members with the same *base names* — spelling, not identity, the duck-typing
surface aimed at plain data. **Anonymity is the switch**, which is precisely
what `~T` erases.

So "`~Printable` is an interface **and** also loose" means two independent
facts about one type: it is declaration-only, *and* it matches by base name
rather than by drawn symbols. Unstated, that read as a contradiction.

**The omission is a process failure worth recording.** The spine's own rule
is that every salient concept gets an entry, and the ordering constraint
should have caught a term used before it was defined. It did not, because the
constraint is enforced by reading rather than by anything mechanical — a
finding about the method, and one the eventual Vivace model would catch for
free.

**And a measurement was under-scoped.** S3 reported the `__interface` marker
0-decisive at `shapeAwareSubtypeof`. There are **three** readers, not two.
Re-measured across all of them: 42 interface encounters and **0 decisive at
both** subtypeof sites, 0 hits at the third. The conclusion survives — an
interface always has a name, so the name test beside the marker already
excludes every interface — but the first number covered one site and was
quoted as though it settled the question.

No `src/` changes. Gate: **1197/1197, `GATE: PASSED`**.

## 2026-08 — Concept spine S3: T4 types, and `~Printable` follows from a definition

Ten entries — type, kind and meta-type, shape, member and member symbol,
knowledge, refinement, **interface**, generic, identity, law and coercion —
plus two maintainer corrections.

**§36 resolves B-104(g) by defining "interface" precisely enough that the
question has an answer.** That is what the plan predicted this tier would be
for, and it worked: `InterfaceKind` is literally `Type` refined by the
predicate *"has no `construct`"*, so declaration-only is a **checkable
property of the type**, not a flag someone sets.

From that, the conflict dissolves. The `__interface` marker is doing **two
jobs with one bit**: `applyBoundaryBound` reads it for *is this an
interface?*, `shapeAwareSubtypeof` reads it for *is this in the loose,
base-name world?*, and `structuralWrap` erases the marker **and** the name
together — so one erasure answers both questions. The facts are
**orthogonal**. `~Printable` has no construct (interfaces have none to copy),
so it satisfies `InterfaceKind`'s own predicate: it **is** an interface, and
it is **also** loose.

The maintainer ruled that months ago. What the tier adds is that it is now
**derivable** rather than asserted, and the derivation names exactly what
changes: drop the marker check in `shapeAwareSubtypeof` (measured
**0-decisive** — 42 interface encounters across the suite, none where it
changed the outcome, because the name check beside it already carries the
loose-world meaning); read the meta-type in `applyBoundaryBound` (a behaviour
change, and a **fix** — that path has zero suite coverage, so tests land
first); delete the marker. It also **retracts** the `structuralWrap`
re-stamp I proposed before the definition existed — there is nothing to
re-stamp, since anonymity already carries the loose-world signal.

**Two maintainer corrections, both of which changed entries.**

*`dataOf` is a host function.* §11 had it as "the only sanctioned way to ask
what a value is" for everyone. Wrong: the data plane has **two consumers with
different interfaces**. From inside Allegretto or Allegro a value simply *is*
its data — the carrier is invisible, which is exactly what D46's
*transparent* carrier means, and there is no accessor to call. `dataOf` is
the **host's** interface, for the interpreter reaching into a value it is
implementing. §24's interface table now has two data rows.

*The engine/meta-slot interface row.* Asked whether it disappears once
`__length` goes: **no.** `__length` is the last key the partition test fires
on, so removing it retires `isMetaSlotKey` — but the *interface* is the
accessor layer over engine-owned bindings, which persists while such bindings
exist. It should nonetheless shrink to zero, and D39 already says how: **14**
registered slots are dispositioned as declared members, and the proof fields
are the executed precedent — `proposition`, `lhs`, `rhs` are plain-named,
engine-written and user-visible, which puts them on the *ordinary* binding
interface. As the remaining 14 follow, the row dissolves and "engine meta
slot" stops being a concept.

**Five more deltas**: the type-Context namespace is closed by construction
but nothing states or enforces it (B-107); the `shape` projection is
hardcoded in `channelReadRaw` rather than installed (B-112(c)); `knowledge`
is a registered field nothing ever stores — a channel, not a field (B-111);
`__args`/`__generic` are host-read with no language surface, deferred since
C7.2 and still deferred (B-107); and **law backings ride two carriers** — the
per-proof backing is a data binding while the transitive set the ledger
aggregates is a host-plane property, split by aggregation depth rather than
by meaning, with nothing telling a reader which to use (**B-115**).

**The ordering constraint caught its second real thing.** §32 (shape) and
§34 (knowledge) cannot be defined in terms of each other, and the plan
predicted the ladder would strain around here. It held: shape is *what
dispatches*, knowledge is *what is established about a value*, and both read
the same stored `type` field — two computations over one storage, the same
structure the chunk-3 work found for `shape`/`type`.

No `src/` changes. Gate: **1197/1197, `GATE: PASSED`**.

## 2026-08 — Concept spine S2f: metadata/field/channel, plane interfaces, T3

Three maintainer items and the T3 tier.

**The plane is renamed *metadata*; it holds *fields*; a *channel* is a
capability.** A field is storage; a channel is the whole apparatus by which
one capability rides values through PE — its fields, their rules, their
writer, and the layer-side semantics. Typing is a channel. Effect analysis is
a channel.

**The rename is not cosmetic — the distinction already existed and had no
name.** Eleven things are registered in one registry as if alike. They are
**five different kinds**: seven stored fields; one *projection* (`shape`, no
storage of its own, a computed view of `type`); one **capability with no
field at all** — `knowledge`, where nothing ever stores a `knowledge`
component and its own comment says its storage *is* `predicates`/`domain`
plus the refinement layers; one retired entry (`exported`, moved to
`Binding.visibility` at B-097 V1); one unused (`warnings`). `knowledge` is
the proof: registered exactly like `predicates`, and not the same kind of
thing at all. Nothing could have flagged that while all eleven were called
"channels". **→ B-111.**

**Plane interfaces become a first-class entry (§24).** A plane interface is
the sanctioned route to a plane; reaching one any other way is a plane
violation *whatever it computes correctly*. The entry carries the full
producer/consumer table — and it reframes everything T2 found: **every T2
delta is an instance of an absent interface.**

Four are owed, and they have one shape:

1. a **dispatch hook** — the evaluator needs type-directed dispatch during
   evaluation (R2) and must not know what a type is;
2. a **check hook** — `checkArgType` currently lives in the evaluator;
3. a **projection hook** — `shape` is hardcoded in `channelReadRaw`;
4. **channel registration** (B-111).

All four are *the base holds an inspectable symbol, the layer installs the
meaning* — SC-7's argument generalised from propagation to every plane
boundary. Today two of eight interface rows have a real mechanism, four are
conventions enforced by lint or nothing, and the layer→base row has one
instance and no general form. **→ B-112**, which supersedes the open question
inside B-110 by naming it.

**T3 · Evaluation** — PE Rules 1 and 2, resolved/unresolved/residual, tail
calls, future cells and completion, the `evalSource` pipeline. Its own
finding is **§29: the L2 post-passes are hardcoded into the base's stage
list** (effects, exhaustiveness, termination, proofs). That is §23's
violation in its other form — not an import into the evaluator, but layer
stages baked into the base pipeline. One root, two surfaces; a layer should
*register* a post-pass.

Two smaller T3 deltas: **TailCall forwarding is convention-only** (a body
wrapper that swallows the sentinel is a silent performance cliff, not an
error — **B-113**), and **completion confluence is not guaranteed by
construction** — the B-028 arrival-order bug was *fixed*, not precluded, and
candidate R16 (determinism) still has no specification item and no test that
would catch a recurrence (**B-114**).

**Recorded for the long term**: the maintainer intends this model to become
**formal** — logical statements over requirements, specification,
implementation choices, constraints and test cases, implemented in Vivace,
with coverage, traceability and correctness checks automated. The plan gains
§4a stating what that implies *now*: traceability links as data rather than
prose, stable unique identifiers as join keys, the three orphan checks as the
first automatable rules, and a **"Verified by" row** as a known-missing
column (requirement ↔ test coverage is not yet derivable — recorded rather
than guessed at). Explicitly *not* implied: contorting the prose into
pseudo-formal notation ahead of the tooling.

No `src/` changes. Gate: **1197/1197, `GATE: PASSED`**.

## 2026-08 — Concept spine S2e: T2 planes, absorbing B-110

The planes are written down. Six entries — plane, channel, propagation,
writer capability, meta slot, and **the layer boundary** — and the last one
absorbs B-110 per maintainer ruling.

**§18 supplies the rule nobody could state.** A plane is distinguished by
*who may write it* and *what evaluation does to it*: **data** (what the value
is), **binding** (its named parts), **channel** (information about it,
propagated per its declared rule), **host** (interpreter bookkeeping, not
part of the value and invisible to Allegro). The placement rule is four
questions in order — is it what the value *is*, is it a part a user names, is
it information that must survive operations, or none of those. That question
had no written answer for four years, which is why B-104 happened.

**Absorbing B-110 was the right call, and the reason is sharper than
"related".** §23 draws the contrast: `evaluator.ts` propagates channels
through the plane interface — `viralChannels()`, `channelSpec(k)?.rule ===
"union"`, `channelMerge(k)` — entirely layer-ignorant, exactly as R3′ and
SC-7 intend. **In the same file** it imports 27 L2 symbols and hosts
`checkArgType`, which evaluates refinement predicates and throws
`Type error`. The plane discipline is not missing; one subsystem bypasses it.
B-110 is therefore not a separate arc — it is §18's rule unapplied.

**And the plane framing supplies the decomposition**, found by reading rather
than assumed: **`getType(v)` is literally `channelReadRaw(v, "type")`** plus a
kind check — an L2 alias for an L0 call. So the halves separate cleanly.
*Reading* a type is already layer-ignorant (a channel named `type` is opaque
to the base) and the L2 import is gratuitous. *Interpreting* it —
`typeMethod`'s FQN member lookup, `unifyTypes`, `applyBoundaryBound`,
refinement-predicate evaluation, `assertMemberAvailable` — is genuinely L2
and must be **installed rather than imported**, in the shape
`installChannelMerge` already has. Type-directed dispatch genuinely is needed
during evaluation (R2 — discharge happens *by* evaluating), so the fix was
never "delete the import"; it is that the evaluator needs a dispatch hook the
layer installs.

**Six deltas**, and they resolve the shape S1 could only gesture at. S1 found
three entries that were "the same underlying gap — the planes are real and
undeclared". Writing the planes down turns that into four *named* defects:
the host plane is declared inside the value interface it is said not to be
part of (§18 → B-107(f), which was blocked on this entry existing); the base
registers eleven L2 channels itself (§19 → B-109(a)); integrity is enforced
by a hardcoded name list rather than the registered flag, and the two sources
disagree about `source` (§21 → B-109(b)(c)); and the meta-slot partition
fires on exactly one key in the whole suite (§22 → B-104(b)(f)). Plus §23.

**§20 has an empty delta** — the propagation mechanism is correct as built.
Worth recording, because a document where every entry is a defect report is
not being read carefully either.

No `src/` changes; B-109 and B-110 remain untouched pending design sign-off,
per maintainer direction. Gate: **1197/1197, `GATE: PASSED`**.

## 2026-08 — Concept spine S2d: the base implements the type system

Two maintainer corrections, and the first one overturns S2c's central
conclusion.

**S2c read a requirement off the implementation, and that is backwards.**
Finding 117 throws in the base, it concluded R4 had been over-broad. The
maintainer's correction: *inconsistent behaviour is evidence of
inconsistency, not of an alternative cohesive requirement.* If Allegretto
aborts, that behaviour must be a **specification**, supported by a
requirement — the code does not get a vote on what the requirement is. The
methodological error is kept visible in §6.2 C4 because it is the exact
inverse of the implementation-first rule, which says write down what the code
does *and then compare*, not adopt it.

**So every base abort is now classified** (§7), into six classes: host-
invariant assertion, plane violation, capability denial, resource guard,
type errors thrown by the base, and primitive argument errors. Four become
specifications under requirements that **did not exist** — candidates
**R18** (resource bounds), **R19** (plane separation), **R20** (ill-formed
application). One is already covered by R12, and denial-as-abort is the right
shape there: an error *value* would be forgeable, since the forger chooses
what to do with it.

**R4 was never the problem.** Classes A–D and F are aborts that are not
"getting stuck on unresolved information" — invariant violations, denials,
bounds, ill-formed applications — so none contradicts R4. The gap was that
**no requirement covered aborting at all.**

**And one class is rework, not specification.** `checkArgType` **lives in
`src/evaluator.ts`** — the L0 evaluator — where it calls `getType`, reads
`typeContextName`, evaluates refinement predicates, dispatches through an
`instanceof` binding, and throws `Type error`. Three L0 modules import from
L2: `evaluator.ts` takes **27 symbols** from `types-std`/`refinements`/
`effects`; `scope.ts` takes `PredicateSet`; `futures.ts` takes `withType`,
`ErrorType`, `StringType`.

This violates the project's **own** stated invariant — `CLAUDE.md`:
*"Dependencies point downward only."* It is the largest delta the spine has
produced, and it is a different scale from B-109(a): eleven hardcoded channel
names are a naming leak, this is a whole subsystem one layer too low. **→
B-110**, recorded as an arc rather than a chunk, with the question it must
answer written down rather than pre-empted: type-directed dispatch genuinely
IS needed during evaluation (R2 — discharge happens by evaluating), so the
fix is not "delete the import" but to find the concept-free capability the
evaluator needs, shaped like `installChannelMerge`.

**Also: one exception class for six kinds of failure.** `AllegroError` is the
only error class and nothing in `src/` catches it outside the suite, so a
host-invariant assertion ("has unresolved stub — check resolvePrimitives") is
indistinguishable from a user's argument error. The classification above had
to be done by reading 117 call sites for exactly that reason.

**Second correction: four metadata requirements become one** (§8.1).

> **R3′ — Metadata channels are independent.** A value may carry named
> information about itself. Each channel's handling is independent of every
> other: an operation's treatment of one channel may not depend on which
> others are present, and **no operation may disturb a channel it does not
> know about**. How a channel is handled is determined by that channel's own
> declaration, not by the operation.

R3, R5, R11 and R13 collapse into it, and it says **more** than they did: the
old R5 ("metadata survives per its declared rule") could not forbid a `drop`
channel being dropped by an operation that had never heard of it, because
dropping was its rule. R3′ can, because non-interference is about *which
operation* disturbs a channel rather than whether it survives. That is the
sharpening §6.2 C5 asked for and could not express.

**Is the fixed vocabulary necessary? Yes — and R12 is why** (§8.2). The
vocabulary is specification, as ruled, and the open question was whether
channels could simply register arbitrary propagation functions.
`registerChannel` enforces *"integrity channels may not register fabricating
propagation rules (viral/union)"* — forgery vector C — and that check is
possible **only because rules are inspectable symbols**. Given an arbitrary
closure the base cannot tell a fabricating rule from a non-fabricating one,
and R12 degrades from enforced to hoped-for. Recorded as **SC-7**, whose
criterion is R12 enforceability, revisit-if a layer needs a discipline the
vocabulary cannot express — at which point the answer is to extend the
vocabulary, not to open it to closures. R13 lands here too: "channels can
merge" is not a requirement, it is the argument that `union` must be in the
vocabulary.

`installChannelMerge` already has this shape — the base holds the symbol
`union`, the layer installs the merge function — which is more evidence the
design is right where its wiring is wrong.

Running total: **14 proposed requirements → 6 surviving + 6 candidates.**

No `src/` changes; B-109 and B-110 both untouched pending design sign-off.
Gate: **1197/1197, `GATE: PASSED`**.

## 2026-08 — Concept spine S2c: cohesion, and seven requirements that are not

The requirement set was checked as a **set** rather than item by item. All
three questions found something, and the headline is subtractive: of fourteen
proposed requirements, **seven do not survive as requirements**, **two
conflicts are real**, and **three capabilities Allegro needs are enabled by
nothing**.

**Derivability (§6.1).** A requirement that follows from others is a theorem,
and listing it as an axiom hides how few independent commitments exist.

- **R7 is not a requirement** — "any implementation satisfying the others
  supports Allegro" is the *sufficiency claim*, which is §6.3's question. As a
  requirement it is unfalsifiable; as a claim it is the most falsifiable
  statement in the document.
- **R11 is derived from R3 + R6**, by its own text — it introduced itself as
  "the R6-compatible form of R3".
- **R13** is a specification item on the propagation vocabulary.
- **R3 conflates two levels**: "layer information must be associated with
  values and preserved" is a requirement; "it rides *on* the value" is a
  specification choice with a visible alternative (an occurrence-keyed side
  table). The alternatives test — this document's own — says so.
- **R1 is a purpose plus a criterion**, not a falsifiable requirement.
  Nothing an implementation does could violate it, which is §0's own test.
- **R8's derivation is wrong**: it claims R4, but R4 would apply per-universe
  if there were two. What forces one universe is R1 + R9.
- **R10 is largely derived** from R2 + R14; what it adds beyond them is only
  the external (async) source.

Fourteen → **nine** independent requirements. That is the good outcome:
a smaller independent set is a stronger one, and every item removed was
removed by an argument that also says where it now lives.

**Conflict (§6.2) — and R4 was simply wrong.** The first draft of R4 said
*"Failure is a value, not a control-flow escape."* The base contradicts it
**117 times**: `primitives.ts` 99 throws, `evaluator.ts` 11, `slots.ts` 5,
`scope.ts` 2, against **2** error-value constructions. The sentence is struck
rather than caveated — a requirement the code contradicts 117 times is not a
requirement anyone is holding. The genuine requirement is narrower
(evaluation never gets stuck on *unresolved information*), and what halts
versus what yields an error value is CE-R8's, a **layer** decision.

Also: **R5 is weaker than it reads.** "Survives per its declared rule" is
near-vacuous when `drop` is a declared rule. The requirement worth having is
**non-interference** — no operation may drop a channel it does not know
about, whatever its rule.

**Sufficiency (§6.3) — three gaps.** The only falsification of the set as a
whole, tested by naming Allegro features and asking what enables them.

- **Program-level aggregation is enabled by nothing.** Every requirement is
  per-value or per-evaluation, but `Verdict`, the assumption ledger,
  `CompilationReport` and `Notification` are whole-program artifacts — and
  they are the surface on which "nothing is silently trusted" is actually
  delivered. **Candidate R15.**
- **Determinism is required and unstated.** PE-as-compilation needs same
  source ⇒ same residual, or a build is not reproducible and a discharged
  proof is not re-checkable. R10 actively introduces ordering, and the B-028
  arc was bitten by exactly this as an arrival-order non-confluence bug.
  **Candidate R16.**
- **The host boundary is unstated.** Primitives perform I/O and call the
  host; R9 covers the syntax surface and nothing covers the capability
  surface. SC-1 specifies `PrimitiveFunction` with no requirement above it —
  an orphan by §0's own rule. **Candidate R17.**

**What the pass says about the method (§6.4).** Cohesion found more than the
per-entry Delta check, and a *different kind* of thing: Delta compares a
statement to the code, cohesion compares statements to each other. The R4
error is the case in point — Part 0 was the one part written without an *As
implemented* row, and it is the one part that stated something false. Two
amendments fed back into the methodology proposal: **requirements carry an
As-implemented row like every other entry**, and **cohesion runs as its own
pass**, since none of the seven derivability findings is visible one entry at
a time.

Findings are recorded, not applied: the set is unratified, so §6 proposes and
the maintainer disposes. Challenged requirements are marked ⚠ inline and left
in place. The one exception is R4's false sentence, struck immediately —
leaving a known falsehood in a Tier-1 document is worse than an unratified
correction.

No `src/` changes; B-109 stays untouched pending design sign-off per
maintainer direction. Gate: **1197/1197, `GATE: PASSED`**.

## 2026-08 — Concept spine S2b: the level split, R8–R14, and two live violations

**The register splits in two.** Some of what S2a called implementation
choices were specification choices, and the difference is whether Allegro can
*see* it: a specification choice has alternatives, but changing one changes
what the layers above are written against; an implementation choice is
invisible to every program. Per maintainer ruling — a single value universe
is a **requirement** (it follows from totality); the value kinds are
**specification** (options exist, and L2 dispatches on them); metadata
storage and structure indexing are **implementation**.

So SC-1…SC-6 and IC-1…IC-6 now sit under R1–R14, with the old numbering
mapped in place. The split immediately did work: **the old IC-2 was two
choices wearing one number.** Reducing the composite kind count 2 → 1 is
**SC-5**, a specification win under R1. What it cost — 11 fields, 4 role
configurations, role read by field presence at 146 sites — is **IC-1**, and
entirely at the implementation level. That separation is what makes the
maintainer's original doubt answerable: the specification improved and the
implementation did not, and one number could not say both.

**Seven new requirements**, filling the gaps §3 had recorded: one value
universe (R8, derived from R4); an extensible language surface (R9);
resumable evaluation (R10 — the temporal generalisation of R2, covering
async and module loading); **declared, not coded, propagation** (R11);
capability-controlled metadata origination (R12); mergeable channels (R13);
separately-loadable units with visibility boundaries (R14 — `use`/`import`
is a surface, not the requirement).

**Requirements now carry a subject**, and it earns its place immediately.
Two candidates raised as requirements — *discharge* and the *knowledge
lattice* — are Allegro requirements, not Allegretto ones, and their base
counterparts are strictly weaker: discharge ↦ R2+R4 (evaluate as far as
possible, residual otherwise; the base knows nothing of "obligation"), and
the knowledge lattice ↦ R13 (the base supplies merge, the layer supplies the
lattice). Conflating the two levels is exactly what makes R6 look violated
when it is not.

**Two objections, answered — and both are violations in the code.**

*Does declared propagation contradict R6?* No: **R11** is the resolution. The
base owns a fixed vocabulary — `viral`, `union`, `computed`, `drop`,
`positional` — over an opaque payload, and the layer registers `(name, rule)`
and installs its own semantics. Knowing "some channels are viral" is
layer-ignorant; knowing "the error channel is viral" is not. The correct
pattern **exists and is used exactly once** — `effects.ts` calls
`installChannelMerge("effects", …)`. But `slots.ts` registers **eleven L2
channel names itself** and special-cases `shape`/`type`/`discharged` by name.
The mechanism is layer-ignorant; the wiring is not.

*Does externalising registration break counterfeit protection?* No: **R12** —
authority is the capability, not the name. Registration is one-shot and
returns the writer closure, so the base never needs to enumerate sensitive
channels. But `INTEGRITY_CHANNEL_NAMES = ["discharged", "source"]` is a
hardcoded list, which is protection by name — the one form that cannot
survive externalising. And the two sources of truth **disagree**: `source` is
in that list yet is registered *without* `integrity: true`.

Both → **B-109**, with the small fix for the second (consult
`channelSpec(name)?.integrity`; mark `source` at registration) and the larger
one for the first deferred behind the T2 planes entry.

**Cohesion is explicitly not done.** §5 states the method rather than
claiming the property: is any requirement derivable from the others (R8
already declares itself derived from R4 — is R10 from R2? R11 from R3+R6?);
does any pair conflict under a reachable design; and is the set *sufficient*
— can an Allegretto satisfying all fourteen fail to carry Allegro? The last
is the only falsification of the set as a whole. **→ S2c.**

§5 also records, by the traceability rule's own logic, that **five of the
seven new requirements have no specification item yet** (R9, R10, R12, R13,
R14) — unmet or met implicitly. That is the orphan check working as designed
rather than a gap to hide.

No `src/` changes. Gate: **1197/1197, `GATE: PASSED`**. Typecheck clean,
doc-ref-lint clean.

## 2026-08 — Concept spine S2a: requirement, specification, implementation

The spine gains **Part 0 · Foundations**, at maintainer direction, and it
answers the question the whole campaign turned out to be about: *which of
three kinds of statement am I making?*

**The three levels.** A **requirement** is something that must be true for
Allegro to be buildable — falsified by showing it can be built without it,
and it has **no alternatives**. A **specification** is what Allegretto
commits to in service of a requirement — few alternatives, and visible. An
**implementation** is how this host currently realises the specification —
many alternatives, replaceable silently. The enforcement is one question per
entry, the **alternatives test**: if you can list alternatives to a
"requirement" it is a specification; if you cannot list any for an
"implementation choice" it is probably specification.

**Traceability, both ways.** Every specification item names the requirement
it satisfies; every implementation choice names the specification item it
realises. Orphans are findings — an unjustified spec item, an unconstrained
implementation choice, an unmet requirement. This is the *consistency* check;
the per-entry Delta is the *code-fidelity* check. A model needs both, and the
format previously had only the second.

**Requirements R1–R7.** Three from the maintainer — Allegretto as the
simplest base that can carry Allegro (R1); partial evaluation as the
mechanism by which types, effects, proofs and errors are built on top (R2);
values carrying metadata in orthogonally-processed channels (R3). Four
surfaced by writing them down: evaluation is **total** over the value space
(R4 — residuals, never stuck, which is what R2 depends on); metadata
**survives** evaluation (R5 — why primitives take full values); the base does
**not know** about the layers (R6 — stated about concepts, not mechanism:
Allegretto provides the channel plane and does not know one channel is called
`type`); and Allegretto is **replaceable** (R7 — anything satisfying R1–R6
supports Allegro, which is what makes everything else an implementation
choice unless traced upward).

**The implementation-choice register, IC-1…IC-7.** Each with the alternatives
that were available, the criterion that selected one, and what would justify
revisiting. This is the element that was missing, and its value showed up
immediately as a counter-example.

**IC-2 — the finding.** The maintainer doubted that condensing MultiValue and
Context into one Structure had simplified anything. It had not, and more
usefully: **it was never a simplification decision.** The recorded rationale
is entirely performance — `structures.md` I1 gives the payoff as *"known type
⇒ known shape ⇒ slot access compiles to offsets (feeds codegen)"* (future),
and the class comment gives *"so every structure shares a single hidden
class"* (present, V8). Measurement agrees:

| Measure | Value |
|---|---|
| Declared fields on `Structure` | 11 |
| Role-groups | 4 (carrier, record, dense, scope) + 2 universal |
| Sites discriminating role by field **presence** | **146** |
| Constructors | 3 |

Representations went 2 → 1 while configurations went 2 → 4, and the variation
moved from an explicit kind tag to implicit field presence read at 146 sites.
A reasonable trade for a performance goal; a poor one for a comprehension
goal — and it was read as the latter for years, by its own author, purely
because the levels were not separated.

**IC-3 — the comparison that was never run.** Four options set against each
other: map-first (current), sequence-first (LISP-style, the maintainer's
suggestion), two representations (the original), and **one entry-sequence** —
a single composite of optionally-keyed entries that is both map and list,
which nobody had proposed and under which the dense region becomes a
representation optimisation *below* the specification, dissolving `__length`,
the legacy view and the W6 invariant with it. The argument for sequence-first
that is usually missed is recorded too: O(n) name lookup only costs if lookup
is a runtime operation, and under R2 most scope resolution happens once at
`resolveSymbols` — so interpreter asymptotics argue much more weakly in a
partial evaluator. The counter-pressure is that channel reads *are* hot and
*are* by name.

**IC-4 had no recorded criterion at all** — "channels by wrapping" was never
written down as a choice. Its alternative (an optional channel map on every
value) would delete the carrier concept outright: no `primary`, no 67
presence-checks, no W1 non-nesting invariant, no `dataOf` indirection.

All three go to **B-108** as one review, because they interact.

**What level-tagging revealed.** Tagging the seventeen T0–T1 entries produced
a finding the four-part format had missed on its own: **four of them are
Implementation, not Specification** — the carrier, Structure roles, the dense
region and the legacy view. All four had been written as concepts of the
language; none would exist in a different Allegretto satisfying R1–R6. A
quarter of the tier sitting one level above where it belongs, the same
mistake four times, all tracing to IC-2/3/4.

**Also landed**: `conceptual-model-methodology-delta.md`, proposing the
practice as a methodology amendment — the three levels, the alternatives
test, two-way traceability, implementation-first authorship, and choices
recorded with alternatives + criterion + revisit trigger. §6 states the cost
honestly (the deltas are added work, not removed work; a project that would
rather not see the list should not adopt it) and §8 carries three process
improvements adoptable independently: a decision may not be marked "executed"
on a partial execution; prefer measurement to reasoning on questions about
the running system; a lint that cannot see the artifact being added is a
false negative.

No `src/` changes. Gate: **1197/1197, `GATE: PASSED`**. Typecheck clean,
doc-ref-lint clean.

## 2026-08 — Concept spine S1: T0–T1, and the format survives its own test

`docs/design/concepts.md` exists. It is the document a reader — or an agent —
is meant to read first and completely: every salient Allegro concept in
**dependency order**, four parts each (Definition / Rationale / As
implemented / **Delta**), with the deep treatment left in the area docs.

**S1 was the falsifiable chunk.** The plan committed to it: if the four-part
entry produced no useful deltas on the tier we understand best, the format
was wrong and had to change before being applied 28 times. It produced
**nine deltas across seventeen entries** (T0 representation, T1 structure and
binding), so the format stands and S2 proceeds.

**What the deltas are.** Six are naming or documentation lag; three are one
underlying gap.

- **One concept, three names.** The class is `Structure`, the interface is
  `StructureValue` (**2** occurrences — its own declaration and the alias),
  and the name the codebase actually uses is `ContextValue` (**701**),
  existing only as `export type ContextValue = StructureValue`. The
  constructor is `makeContext` (**101**); `makeStructure` does not exist.
- **`MultiValueType`** (25 uses) names a kind D46 retired, and its own
  comment says it survives "so existing casts keep compiling".
- **Stale headers.** `src/types.ts` opens "Five value kinds + Param
  placeholder" — there are seven and Param is one of them.
  `src/structure.ts` describes two planes; there are four.
- **`ParamValue.predicates`** is declared, documented "reserved", has no
  runtime reader, and a test asserts it stays empty.
- **Four binding write disciplines**, one comment between them, no stated
  rule for choosing.
- **The three that are really one**: ComposedFunction's analysis metadata is
  invisible in its declared shape; `parent`/`isScope`/`scopePredicates` are
  declared on the value interface their own comments say they are not part
  of; and `__length` is the sole remaining job of the partition test. All
  three are *the planes are real and undeclared* — which is what T2 is for,
  and why it is the highest-value tier in the document.

All nine are filed: **B-107** (a–e now, f blocked on T2 §9).

**The ordering constraint earned its place immediately.** "No entry may use a
concept defined later" forced one genuine cycle into the open: *carrier* and
*data plane* are mutually referential in prose — a carrier is a Structure
whose data rides in `primary`, and the data plane is the carrier's primary.
It resolves by defining the carrier **structurally** (a Structure with a
`primary` field) and the data plane as the **accessor** over that shape. That
is recorded in the entry rather than written around, which is the whole point
of the constraint.

**Every number in the document was verified, not remembered.** The counts
were re-run against current `main`; the `__length` finding was re-measured by
re-instrumenting `isMetaSlotKey` over the full suite *after* the union
removal, on the chance that removing `makeUnionType` had changed it. It had
not: still **296 hits, `__length`, nothing else**. The instrumentation was
reverted; the working tree is clean.

No `src/` changes. Gate: **1197/1197, `GATE: PASSED`**. Typecheck clean,
doc-ref-lint clean.

*The v1-era per-phase history formerly embedded in `CLAUDE.md` is
migrated verbatim to the "v1 era" section at the bottom of this file
(2026-08, B-095 chunk 3); new entries are appended at the top.*

## 2026-08 — B-104 chunk 3: shape storage becomes uniform

`__type` is gone from the binding plane. Every value now carries its shape as
the `type` **component**, the same plane every other channel already used —
carriers, flattened records, proofs, arrays and bare type Contexts alike.
`channelReadRaw` loses its three-way special case; `SLOT_KEYS.type` and the
`bindingKey: "__type"` on the shape channel registration go with it.

Before → after, on a type Context:

```
Point  bindings: ["__name","__type","__construct","__getMember","__members"]  components: []
Point  bindings: ["__name","__construct","__getMember","__members"]           components: ["type"]
```

**The condition this was gated on held.** The shape-vs-knowledge split
(C3.1/D36) is a **read-time computation**, not two storages: `typeShape()`
walks `__refines`/`__members`/`__predicate`, all still binding-plane, so
`shape` and `type` continue to answer from one stored value and the move
does not touch the distinction. `channelReadRaw` now reads that one storage
and applies `typeShape` for `shape` only — which is what the split always
meant.

**Identity is why `writeShape` does not use the channel writer.** The
registered writer (`buildWriter`) derives a NEW value via `makeMultiValue`.
Type Contexts are identity-sensitive — memoized generics, law registries, and
the single reference comparison in the system,
`typeShape(stored) === typeShape(expected)` in `applyBoundaryBound`. All 24
`writeShape` call sites mint a fresh Context and stamp it, so the in-place
component write preserves exactly the old binding write's contract. The shape
channel's writer capability is never acquired anywhere, so dropping its
`bindingKey` costs nothing.

**Three clone paths were inheriting the meta-type by accident.**
`structuralWrap`, `preserveOps` and `buildMethodLayer` all build a derived
type by copying the source's bindings — which silently carried `__type` along
because it was a binding. With shape on the component plane those clones
would have come out **untyped**, and nothing in the type signature would have
said so. A `carryShape(from, to)` helper makes the inheritance explicit at
all three. The paths that re-stamp their own shape (`buildRefinedType`,
`buildDistinctType`) correctly need nothing.

This is the failure mode worth recording: moving a slot between planes breaks
every reader that never named it — and a bindings-copy loop is exactly such a
reader.

- `structuralWrap` still does **not** carry `__interface`. That erasure is
  C5.2c and deliberate, and it is why B-104(g) is still open: the wrap keeps
  meta `Interface` while leaving the declared-conformance world, so the
  marker is not redundant with the meta-type.
- One hand-built test fixture stamped a descriptor's shape as a `__type`
  binding; it now calls `writeShape`. No test condition changed.
- `channelList` no longer reports `shape` and `type` differently depending on
  where a value stored it — a bare type Context used to answer `["shape"]`
  while an instance answered `["type"]`. Both now answer `["type"]`.

Gate: **1197/1197, `GATE: PASSED`**, first run. Typecheck clean.

## 2026-08 — B-104 chunk 2: the partition was imaginary; union types retired

**The measurement that changed the plan.** `isMetaSlotKey` — the test the
whole `__*` convention exists to serve — was instrumented to record every key
it returned true for, then run against the full suite. Across **1,197 tests
it fired for exactly one key**: `__length`, 296 times. `__name`,
`__members`, `__type`, `__construct`, `__refines`, `__predicate`,
`__getMember`, `__interface`, `__wraps`, `__union`, `__args`, `__generic`,
`__discharged` — never once.

The reason is structural, not luck. A type Context's namespace is **closed**:
`Type.define({name: String, type: Int, members: Int, length: Int})` routes
every one of those into `__members` under an FQN key
(`<type#<main>::Collide>::name`), never beside `__name`. An instance carries
**no metadata at all** — shape moved to the component plane at C4.3b, so
`p = Point(1,2)` is `bindings: ["x","y"] / components: ["type"]`. And
`__members` is itself FQN-keyed. Two populations that never meet do not need
a partition — so **the `meta`-plane recommendation from the previous entry is
withdrawn**. It would have been a new pile for old debris. These slots become
ordinary bindings on a kernel-only Context.

**Union types are removed** (maintainer ruling: *if not used outside tests,
remove it*). Usage at removal: **four test assertions and nothing else** — no
`lib/`, no `tests/*.alg`, no demo, no bench, no entry in the language
reference or getting-started guide. What went: the `A | B` production in
`grammar2/base-grammar.ts` and its `grammar-ext.ts` Earley twin, the
`type_union` tree-builder case and primitive, and `makeUnionType`.

- **It was the only genuinely mixed Context in the system.** A union type
  Context held `__name`, `__type`, `__length` and `__union` beside plain
  `instanceof` / `subtypeof` bindings beside numeric element keys — engine
  slots and ordinary names in one namespace, which is the collision the
  prefix was invented for and the only place it ever happened.
- **Array-shaped but not dense.** `makeUnionType` stored alternatives via
  `addBinding(union, String(i), …)` — the string-keyed path — so it needed an
  explicit `__length`. It predates the C4.2 dense region and was never
  migrated. That is the maintainer's question at ratification (*"if a union
  type is implemented as an array, why isn't it dense?"*) and it is the first
  thing B-105 has to answer.
- **Its marker held the wrong thing**: `__union` stored `makeInt(1)` while
  D39's registry named `Type.variants` as its target. Deleted with the
  feature, per the `__isGeneric` ruling — the flag IS the kind.
- **C6 had carved it out and never returned**: the structures plan's ruling
  R6 kept `makeUnionType` outside member storage, deferring a re-derivation
  that never happened.
- **The assertions were replaced, not dropped.** A removed feature must not
  degrade into a confusing partial one, so the new tests hold both halves of
  the removal: `A | B` fails as a **parse error** rather than silently
  building a half-formed type, and `type_union` is gone from the primitive
  registry so the surface and the kernel cannot drift apart. The
  suite-count floor caught the net −1 test and **failed the gate** — the
  tripwire working exactly as designed. The floor was not lowered to get
  past it; the missing coverage was written instead.
- **One assumption corrected while writing those tests**: calling
  `type_union(...)` by name does *not* throw. An unresolved symbol
  residualizes (PE Rule 1) — correct base-language behaviour. The condition
  that actually matters is that nothing MINTS a union, so the test asserts
  the call stays an Expression.

**Also deleted**: `__invariantsList`'s accessors — zero readers, zero writers
since C6.1b folded invariants into refinement layers. Dead code for a slot
swept two arcs ago.

**Four registry rows reclassified.** `__el_`, `__start__`, `__error__` and
`__anon_` were registered as `context-binding`. None of them is one, and no
binding by any of those names has ever existed: the first three are local JS
variables and element `.name` properties inside the *generated* Earley parser,
and `__anon_` is a gensym'd grammar precedence-LEVEL name living in a fragment's
level table. Two were PREFIX rows — the same hazard removed for
`__grammar`/`__parse` in chunk 1, where a row matching nothing silently
pre-approves every future key beneath it. Storage corrected; renaming the
generated-parser three waits for the legacy parser's retirement (ruling).

**Two corrections to the audit that produced this chunk.**

- **`__length` is not deletable.** The audit called it debris. Its one
  arbitrary writer is gone with unions, but `materializeView` emits it as part
  of the C4.2 legacy-view compatibility contract — held by the W6
  dense-view-coherence invariant and by boundary tests asserting the view
  carries it and that `bindingList` has 3 elements + `__length`. Deleting it
  would have weakened existing test conditions. It stays, and it is therefore
  the **entire remaining job** of `isMetaSlotKey`: hiding one derived slot
  from field walks.
- **`__interface` is not the same shape as `__union`.** Both were ratified as
  pure presence-markers on the audit's word. On implementation they diverge:
  `__union` was redundant with a kind, but `structuralWrap` deliberately
  **erases** `__interface` while **copying** `__type`, so `~SomeInterface`
  keeps meta `Interface` while leaving declared conformance for the loose
  base-name world (C5.2c, pinned by a boundary test). The marker encodes
  something the meta-type does not. Removing it requires `structuralWrap` to
  re-stamp the wrapper's meta-type — a semantic change to what `~Interface`
  *is*, not a redundancy removal. Held back for its own gate rather than
  folded into a deletion chunk.

**Confirmed for the next chunk** (maintainer's condition on moving `__type` to
the `type` component): the shape-vs-knowledge split is a **read-time**
computation — `typeShape()` walks `__refines`/`__members`/`__predicate`, all
of which stay binding-plane — so it is indifferent to where the raw stored
type lives. The one constraint is identity: all 24 `writeShape` call sites
mutate in place on a freshly-minted Context, and exactly one reference
comparison exists (`typeShape(stored) === typeShape(expected)`). The generic
channel writer derives a NEW value via `makeMultiValue`, so the move must
write `ctx.components` in place rather than route through it.

## 2026-08 — B-104 chunk 1: the host plane loses its dunders

The `__*` prefix was added long ago to keep engine metadata from colliding
with user names. Maintainer directive: retire it everywhere. The survey
found that "everywhere" is two unrelated problems wearing the same prefix,
and this chunk lands the one that is genuinely free.

**What the prefix is actually for.** On the BINDING plane it is
load-bearing: engine slots (`__name`, `__members`, `__type`, …) live in the
same `bindings` map as user fields, and `isMetaSlotKey(key) =
key.startsWith("__")` is the partition test between them — read by
`types-std.ts` (member-dispatch narrowing, spec walks, refinement key
filters), `runtime.ts` (source attachment), `primitives.ts` (pending-future
scan) and the W3 completeness walk. On the HOST plane it is decoration:
`(cfn as any).__partial` is a JS expando on a host object that shares a
namespace with nothing. **27 host-plane names, ~180 sites, renamed; zero
behaviour change**, typecheck clean, **1197/1197**.

*Three test NAMES changed, because they quote the property under test
("…stamps Param.effectBound from `__effectBound`" → "…from `effectBound`").
No test condition was touched. Shard assignment is by test-name hash, so
this moved exactly one test between shards — 407/418/374 became
407/417/375, with the total and the corpus walk unchanged. Recording it
because a shifting per-shard count is otherwise the signature of a lost
test, and that signature should never go unexplained.*

- **`__compileMode` was mis-registered.** `SLOT_REGISTRY` gave it
  `storages: ["context-binding"]`, but every reader and writer is a JS
  expando (`evaluator.ts` precompile flag, `scope.ts` chain probe) — there
  has never been a binding by that name. It renamed with the host plane and
  its storage class was corrected.
- **Two dead PREFIX rows retired.** With `__grammarValue` /
  `__grammarHandle` / `__grammar_fragment` renamed, the `__grammar` and
  `__parse` prefix registrations matched nothing. A prefix row that matches
  nothing is not inert: it pre-approves every future `__grammar*` binding,
  which is exactly what would hide one from the W3 walk. Removed, and the
  walk still passes — confirming nothing was riding them.
  `__inline_grammar` IS a live binding prefix and stays.

**The lint could not see most of what it was ratcheting.** The
`dunder-string-literal` pattern matched quote-delimited literals only, so
three spellings never entered the count — synthesized template keys
(`` `__future_${n}` ``, `` `__anon_${n}` ``, `` `__bare_${n}` ``: five
sites, zero counted), property access, and primitive diagnostic names
(`"record.__construct"`). Each now has a pattern, and `bindings-get-dunder`
covers `.has`/`.set`/`.delete` alongside `.get`.

- **New patterns ratchet rather than hard-fail.** `hardFail: true` treats
  any nonzero count outside `allowedFiles` as a breach, so a pattern that
  counts PRE-EXISTING violations for the first time would fail the suite on
  the very commit that made them visible. `LintPattern.ratchetOnly` marks
  those: they hold at the committed baseline and hard-fail once B-104's
  remaining half drives them to zero. Hard-fail is the end state, the
  ratchet is how a pattern gets there.
- **Property access is matched against literal-blanked source**, so
  `makePrimitive("record.__construct", …)` is counted as a diagnostic name
  rather than miscounted as a host-plane read.
- **Backticks were deliberately NOT folded into the existing hard-fail
  pattern.** In this codebase a backticked `__name` is nearly always a
  markdown code span in a doc comment — prose *about* a slot, not a use of
  one. Folding them in would have added ~30 false positives to a
  hard-failing pattern and taught the next reader to route around it.
- **B-102 closed** in passing: the `src/test.ts` entry in `SCAN_EXCLUDE`
  is gone (the file has not existed since lane B; the suite modules under
  `src/test/` are scanned like production code).

**`src/slots.ts` was invisible to grep.** `unionBackings` built its dedup
key with two literal NUL bytes instead of `\x00` escapes, so git and
ripgrep classified the file as binary. The one file where every slot name
is defined was silently absent from plain-text searches — dunder searches
included, which is part of why the host-plane population went uncounted
for so long. Escaped; the file reads as text.

**What remains (B-104(b))** is the binding-plane partition, and it needs a
ruling rather than a rename: a fourth `meta` plane on `Structure` (the
recommendation — it makes the partition a storage question instead of a
name question, and stays compatible with D39's per-slot dispositions),
registry membership (cheapest, but it makes `name`/`members`/`length`
unusable as ordinary user field names), or interned keys (soundest,
largest). The synthetic binding-name families are a separate sub-problem:
they are real names in the user namespace, so their answer is likely a
`Binding` attribute beside `cell`/`visibility`/`isComplete`.

## 2026-08 — Lane merge tidy-up; the parallel-lane experiment ends

Lanes A and B are merged (PRs #32/#33/#34) and the working model reverts to
**serial** at the maintainer's call — the coordination overhead of watching
three sessions outweighed the throughput. The merged state was verified
before closing the experiment: **1197/1197, `GATE: PASSED`** (114.2s wall,
3 shards), typecheck clean, doc-ref lint clean. Both lanes' work composes;
nothing needed reverting. What the merge left behind:

- **A duplicate backlog id — the collision the lane model was supposed to
  prevent, in the one file both lanes had to touch.** Lane A filed
  **B-101** (predicate-carrier residue cleanup, from CT-R5/CT-R3) and lane
  B independently filed **B-101** (a CI registration-count check). Neither
  session could see the other's uncommitted work, and the merge was clean
  because the two entries landed in different sections of `backlog.md` —
  a textual non-conflict over a semantic one. Lane A keeps the number: it
  is cited by ratified CT-R3/CT-R5 rulings in `docs/decisions.md`, so it
  is the one that cannot move. Lane B's is renumbered **B-103**. The
  general lesson for the proposed methodology amendment: *lane
  disjointness over source files does not extend to shared registers with
  a monotonic id space* — `backlog.md` and `decisions.md` mint ids, and
  two lanes minting concurrently collide silently.
- **Four stale `npx tsx src/test.ts` invocations** outside lane B's file
  set, so it could not fix them: `docs/getting-started.md` (a consumable —
  the command a new reader would run first), `demos/rung1/README.md`,
  `bench/README.md`, and the header comment in `scripts/doc-ref-lint.ts`.
  The getting-started entry now names both `npm test` and
  `npm run test:shards`; the two READMEs point at `src/test/tooling.ts`,
  where those tests actually live. `doc-ref-lint` never caught these:
  it resolves markdown *references*, and these are shell commands in
  fenced blocks.
- **`docs/PROCESS.md` §5 still lists `npx tsx src/test.ts`** in the
  landing checklist. Tier 0 — surfaced, not edited (PROCESS §7).
- **B-104 filed**: retire the `__*` identifier convention (maintainer
  directive). The survey behind it is in the item: the host-plane half is
  a mechanical rename, the binding-plane half is a partition-test
  replacement and needs a ruling, and the lint ratchet cannot presently
  see template literals or property access.

## 2026-08 — The suite splits: `src/test.ts` becomes `src/test/` (lane B)

The file two work streams could not avoid meeting in is gone. `src/test.ts`
was 12,281 lines and appeared in **88% of source commits** (35 of 40) — not
a hot file but a universal one, which is why lane B was a prerequisite
rather than an optimization (CHANGELOG "Parallel lanes"). It is now
`src/test/`: **21 modules behind an index that registers nothing**, largest
1,556 lines. A lane-D session working `effects.ts` and a lane-C session
adding a tooling test no longer touch the same file. **Lane C opens.**

- **The index is an index.** `src/test/index.ts` is 66 lines: the area
  imports in suite order, the async section chain, the summary call. Each
  area registers its own tests when its module is imported. Roster and
  per-module roles: `docs/design/implementation-map.md` §`src/test/`.
- **Everything the sharding model needs stayed single-sourced.** The
  counters, the name-hash shard assignment, the registration count and the
  corpus-walk accumulators live in `harness.ts`/`alg-files.ts`, so N
  modules registering into them is indistinguishable from one file doing
  it. The proof is arithmetic: per-shard counts were **407/418/374 at every
  one of the six commits**, identical to the pre-split suite. Shard
  assignment is by test NAME, so which module a test lives in — and when
  that module loads — cannot move it between shards. That property is what
  made the split tractable, and it is why the split did not disturb it.
- **1197 throughout**, sequential and sharded, with the `everyShard`
  registry-completeness check, the 49-file corpus walk, the `>= 15`
  tripwire on both paths, `ALLEGRO_TEST_FILTER` (async included) and
  `ALLEGRO_TEST_TRACE` verified at each chunk. No test condition was
  weakened; three were changed, each with maintainer sign-off, recorded
  below.

**C0, the prerequisite nobody had noticed.** `src/boundary-tests.ts`
excluded `src/test.ts` from the accessor lint ratchet by exact path, and
**92 violations** had accumulated behind that exemption — 45 `__*` string
literals, 29 `bindings.get("__…")`, 18 direct `.components` reads. Moving
any of them into a new module would have hard-failed the ratchet
(`hardFail: true`, scan glob `src/*.ts` + `src/**/*.ts`). CLAUDE.md already
stated the rule without carve-out, so the exemption was a hole in
enforcement rather than a sanctioned exception, and it was closed at the
source: 89 sites migrated mechanically onto accessors `src/slots.ts`
already exported (`getName`, `getMembers`, `channelReadRaw(x, "type")`,
`componentsView`, `SLOT_KEYS`, …). Three had no accessor and were decided:
the `__isGeneric` retirement guard was dropped (retired slots are retired
as a class now), the `__anon_` prefix match became a check by exclusion,
and one dead `??` fallback arm — probed, never reached — was removed in
favour of a strictly stricter `channelReadRaw`. Zero violations remain, and
the suite modules are ratcheted like production code.

**The near miss, recorded because every gate missed it.** C1's first cut
took everything between the math extension and the module-loader header,
which swallowed nine `extension: *` tests living in that span. Typecheck
was clean, a filtered smoke run was green, and the suite would have
reported **1188/1188 with `GATE: PASSED`** — a uniformly smaller suite is
perfectly self-consistent. What caught it was diffing `registered=` against
the previous commit: 1197 vs 1188. Same cross-check that caught the
original 93-test loss (CHANGELOG "Suite & compile performance"), applied
across time instead of across shards.

Two things followed, both landed as **C1b**:

- **The floor was slack.** `suiteFloor` was 979 against a 1197-test suite —
  a fifth of the suite could vanish before the mass-disablement tripwire
  fired. Now 1197, negative-tested: with nine registrations disabled the
  run reports `suite shrank: 1188 tests < committed floor 1197` and exits
  1, on both the sequential path and the aggregate. The baseline note
  carries the rule that keeps it honest — hold the floor AT the suite size;
  a floor kept comfortably below it is not a tripwire. Follow-on **B-101**:
  make this a CI check rather than a number someone remembers to raise.
- **`npm test` had never run.** `tsx` was undeclared, so the sequential
  entry point documented in CLAUDE.md and PROCESS §5's checklist failed
  from a clean install with `tsx: not found`. CI never noticed: it runs
  `test:shards`, which spawns `npx tsx`. Declared; `npm test` completes.

**Method.** After C1, extraction ran through a tool that MOVES a
marker-delimited range verbatim and refuses to write when the total
registration count changes — a range cannot be deleted while only part of
it is copied. It caught nothing further, which is the point. Its own faults
(hoisting only single-line imports; inserting an import into the middle of
a multi-line one) were found by typecheck and fixed in the tool, with C3
redone from a clean backup rather than patched.

Sequence: C0 accessors · C1 harness + rename · C1b floor/tsx · C2 leaves
(grammar2, PCP, async, tooling) · C3 semantics (refinements, effects,
totality, proofs) · C4 type system · C5 the rest, index rewritten.
Follow-on **B-102**: `SCAN_EXCLUDE` still names the now-deleted
`src/test.ts` — inert, but a stale exemption invites reopening the hole.

## 2026-08 — B-014 close-out: CT-R1–CT-R6 ratified and indexed

The gate decision on the contracts reval. B-014 closes.

- **CT-R1–CT-R6 ratified as recommended** (maintainer). `contracts.md`'s
  header and §10 flip from "proposed, awaiting ratification" to binding
  design truth for the contracts area.
- **Indexed** (`docs/decisions.md`): the **CT-R** family joins the D-,
  E-R, U-R, R-R, V-R, CE-R and T-R sections as one-line rows with status
  and reasoning pointers, per the register's rule that plan- and
  design-scoped ruling families are indexed when their gate passes.
- **Follow-ons routed to real owners** rather than left in the closed
  item's prose: **B-057** — its scope was settled by this item, as its
  own entry always said it would be (relocate the undischarged
  `requires` check to the call site, which also supplies the missing
  counterexample origin; relational predicates; the `assumes`
  trust-boundary form against D34's admitted tier; contracts in the
  verdict / `obligations` / assumption ledger; `ensures` over params).
  **B-101** (new, lane D) — the predicate-carrier residue: the legacy
  `domain` dual-read that v1's own Chunk-1 cleanup task never landed,
  the writerless `type-invariant` predicate source, and the
  `assume_invariant` retirement CT-R3 calls for. **B-099** — carries the
  contract severity knobs alongside the totality ones.

Docs-only. 1197/1197 green

## 2026-08 — B-014: contracts design revalidation (`contracts.md`)

The M4 reval line continues in **lane A**: the v1 Phase-C contract design
(`lucid-discharging-lambek.md` + `crystal-proving-curry.md` §Phase C) is
revalidated against the shipped post-B-028 system and lands as the
durable Tier-1 doc `docs/design/standard/contracts.md`. Docs-only, no
`src/` touched — lane B holds `src/test.ts` concurrently.

- **The model was absorbed, not just shipped**: v1's standalone
  `predicates` component became one arm of the D36 knowledge lattice.
  The doc restates contracts over that lattice — two carriers
  (intrinsic on the value, occurrence in the §4 facts plane) meeting at
  each check — which is why an earlier `assert` and a construction
  certificate discharge a later `requires` through one path.
- **Lowering recorded as it shipped**, not as planned: marker primitives
  consumed by the tree-builder's contract preprocessor (`requires`
  sequenced ahead of the body through `seq`; `ensures` wrapping the
  result via a parse-built one-param lambda over `_`), rather than the
  planned assert-at-entry plus let-binding wrapper. `ensures_check`
  forwards TailCall sentinels, so the post-condition fires against the
  eventual base-case value.
- **Sink-based checking splits in two** (CT-R1). The v1 principle —
  check where the property is demanded — already ships as *discharge*:
  PE evaluates a `requires` with the caller's knowledge, so
  `abs_pos(PositiveInt(7))` emits nothing. What never shipped is
  *relocating the residual* to the call site, which is codegen and
  diagnostics (it is also what would supply the call-site origin missing
  from counterexamples). `--strict` was never built at all.
- **Invariants are refinements** (CT-R4): the `Type.invariant` fluent
  API is deleted (D45/C6.1b), `__invariantsList` is writerless, and
  "inheritance" is refinement layering over the `Type.refines` chain
  after D44 retired the declared is-a edge. The v1 chunk-4 design is
  discarded rather than carried forward; the D32 construction guard
  shipped considerably stronger than the plan asked for.
- **`assume` was never actually rejected** (CT-R3). `Law.assume` (E-R4)
  and `assume terminates` (CE-R3) both ship as ledger-visible admitted
  tiers. The outlier is `assume_invariant`: registered and callable by
  name, but given no grammar sugar and called from nowhere in the tree,
  and it attaches a fact *without recording it* — the one path in the
  system that trusts silently. Recommended for retirement rather than
  surfacing.
- **The gap worth naming** (CT-R6): contracts reach `inspect` and
  nothing else. Theorems, law obligations, coercion obligations, div
  obligations and liveness axioms all reach the verdict and the
  assumption ledger; an undischarged `requires` — a pending obligation
  by D34's own definition — does not. A project can read a clean verdict
  while carrying unproven preconditions.
- **Guidance the sources never wrote down**: when to reach for a
  refinement vs. a contract vs. `assert` vs. `proven`/laws, with the
  preference ordering and its reasoning (§8).
- Follow-ons proposed rather than assumed: **B-057**'s scope settled per
  the item's own "scope decided during B-014" (relocation, relational
  predicates, `assumes`, ledger visibility, `ensures` over params);
  **B-101** filed for the predicate-carrier residue (legacy `domain`
  dual-read — v1's own unlanded cleanup task — plus the writerless
  `type-invariant` source and `assume_invariant`); contract knobs
  ridered onto **B-099**.

**CT-R1–CT-R6 are PROPOSED with recommendations — awaiting maintainer
ratification. B-014 closes on the gate decision**, at which point the
family is indexed in `docs/decisions.md` per that register's gate-pass
rule.

Docs-only. Typecheck clean; 1197/1197 green (sharded gate, 89.3s);
doc-ref lint clean.

## 2026-08 — Parallel lanes: the working model, plus register cleanup

A development-structure review, prompted by the question of what can be
worked concurrently. The grouping is empirical: co-change frequency over
the last 40 `src/`+`lib/` commits, not the layer spine.

- **The lane model** (`docs/backlog.md` §"Parallel lanes",
  maintainer-ratified): items share a lane when they edit the same
  files. **A** reval docs (no `src/` at all) · **B** the suite split ·
  **C** capability tracks · **D** L2 semantics. A and B run now; C opens
  once B lands; **D is internally serial permanently** — B-089, B-100,
  B-099 and the rest of the Standard band converge on `types-std.ts` /
  `primitives.ts` / `evaluator.ts`, which is architectural coupling no
  tooling change removes. Landing B lets C and D run as lanes in
  parallel with *each other*; it does not make D internally parallel.
- **The measurement behind it**: `src/test.ts` is touched by **88% of
  source commits** (35 of 40) at 12,281 lines — not a hot file but a
  universal one, so any two code streams meet there. Second tier:
  `types-std.ts` and `primitives.ts` at 45% each. This is why lane B is
  a prerequisite rather than an optimization.
- **Gate policy per lane** (ratified): A/B/C run pre-ratified chunk
  SEQUENCES — the chunk list is approved once per arc and lands in
  order; D keeps the per-chunk stop-and-summarize gate. This needed two
  Tier-0 PROCESS sentences (§3's per-lane exception to stop-after-every-
  chunk, and §7's lane rule); they were proposed rather than landed, per
  the rule that agents never land Tier-0 changes, then **approved by the
  maintainer in-session and applied**. Record of the proposal:
  `docs/plans/parallel-lanes-process-delta.md` (now closed). The
  maintainer additionally recorded intent to evaluate the lane model as
  a candidate majodali/methodology amendment — this run is its evidence,
  so observations against it should be gathered as the lanes proceed.
- **Register cleanup**: **B-058 superseded by B-099** — the same
  per-project severity surface described twice, B-099 having been minted
  during the B-018 close-out without checking; B-099 keeps the work
  because the ratified design docs point at it. The Tranche C head
  claimed B-027's chunks were "underway" when the arc closed three arcs
  ago. `implementation-map.md` still described a 1149-test suite (1197,
  now with the sharding surface recorded).
- **Withdrawn finding**: the review also reported 13 merged branches left
  undeleted. That was wrong — they are auto-deleted on merge; the local
  remote-tracking refs were simply stale, and `git fetch --prune` shows
  zero. No hygiene issue exists.

Docs-only.

## 2026-08 — Suite & compile performance: T-R6 executed and broadened, sharded gate

The landing gate took ~17 minutes and ran twice per PR. It now takes
~5.5 minutes sequentially, ~3 minutes sharded, once per PR — and the
biggest win is a compile-time fix that helps every user, not just CI.

- **T-R6 executed, then BROADENED (maintainer-ratified).** PE inlines a
  call by substituting arguments into the body and re-evaluating. With
  an unresolved argument a RECURSIVE call cannot converge — the base
  case is undecidable without a concrete argument — so PE unfolded to
  MAX_DEPTH, blew the JS stack, and discarded the result as a
  `precompile-type-error`. As ratified, T-R6 cut only `undischarged`
  bindings, which left the pathology in place for exactly the functions
  that were PROVEN total: `factorial(n: NonNeg)` (tier `auto`) cost
  **71.1s** to compile and emitted a spurious "Maximum call stack size
  exceeded" on correct code, while the same function over bare `Int`
  (undischarged, hence cut) took **0.1s**. Proving termination was
  punished ~700×. Termination discharge was the wrong predicate; the
  cutoff now keys on **cycle membership** (SCCs the analyzer already
  computes). After: **0.2s**, no notification.
- **The cutoff has to precede precompile.** The first implementation
  changed nothing (78.8s → 76.1s) because 124k inline expansions
  completed before the analysis block that computes the tiers was even
  reached. The divergence analysis — pure static AST work that does not
  consume precompile's output — now runs ahead of precompile; the
  STAMPING half stays after it, since it writes into the
  `__inferredEffects` precompile populates.
- **String conversion**: `stringToBits`/`bitsToString` constructed a
  fresh `TextEncoder`/`TextDecoder` per call on the hottest path in the
  system. Hoisted to module singletons (~5.5% on an interleaved A/B of
  the round-trip; browser-compat invariant unchanged).
- **Sharded gate**: `ALLEGRO_TEST_SHARD="i/n"` plus
  `scripts/test-shards.mjs`, which aggregates the shards and applies the
  gate to the total. Assignment is by NAME HASH, not registration index
  — an index scheme desynchronizes the moment one shard registers
  conditionally, and the first version did exactly that, silently losing
  93 tests until the aggregator's registered-count cross-check caught
  it. **Everything distributes, including the `.alg` corpus**: tests
  whose subject is the shard's OWN work (the registry-completeness walk)
  run in every shard over that shard's files, so the union covers what
  the single-process run covers. Two conditions can only be evaluated
  where the total is known, so the aggregator owns them at the SAME
  thresholds — the suite-count floor and the `>= 15` corpus-coverage
  tripwire — and it cross-checks that every shard registered the same
  suite. Nothing was softened per shard.
- **CI**: `push:` and `pull_request:` both fired for same-repo PR
  branches, so every PR ran the full gate TWICE on one commit. push is
  now restricted to main; superseded runs are cancelled (never on main).
- **`asyncTest` honored neither the name filter nor sharding** — a
  "filtered" dev run still paid for the entire async block, which is
  what made short timeouts look like hangs during this work.

Measured end to end: **1015s → 333.7s sequential (3.0×) and 129.5s
sharded (7.8× overall)**; on GitHub's runners the single check went from
~10m54s (twice per PR) to **2m43s** (once). 1197/1197 green throughout;
no test conditions weakened.

Follow-ups registered rather than assumed: **B-100** — a soundness
review of the broadened T-R6, and of the checking algorithm itself,
since PE reaching host stack overflow (surfacing as a
`precompile-type-error` on correct code) is a symptom the cutoff hides
rather than cures.

## 2026-08 — B-018 close-out: T-R1–T-R6 ratified; ruling families indexed

The gate decision on the totality reval, plus the register hygiene it
surfaced. B-018 closes.

- **T-R1–T-R6 ratified as recommended** (maintainer). `totality.md`'s
  header and §8 flip from "awaiting ratification" to binding design
  truth; the D34 register row now points at the severity
  reconciliation instead of forward-referencing B-018.
- **Ruling families indexed** (`docs/decisions.md`): the register's own
  rule — plan-scoped `X-R` families are indexed here when their plan's
  gate passes — had three outstanding debts, all from arcs closed this
  session. **V-R1–V-R8** (S3 visibility, B-097), **CE-R1–CE-R8**
  (completion effects, B-028) and the new **T-R1–T-R6** are now one-line
  rows with status and reasoning pointers, matching the E-R/U-R/R-R
  sections' shape.
- **Follow-ons routed to real owners** rather than left in the closed
  item's prose: **B-099** (new) — project severity configuration, the
  T-R2 surface: per-kind promotion, `total`-by-default, blanket axiom
  patterns, and the two CE-R8 severity knobs, blocked only on Allegro
  having no project-config substrate yet; **B-087** — now carries the
  T-R6 divergence-aware inlining cutoff (`undischarged`/`partial`
  bindings are never PE-inlined) with the measured ~43s/compile
  pathology.

Docs-only. 1197/1197 green.

## 2026-08 — B-018: totality design revalidation (`totality.md`)

The M4 reval line resumes: the v1 Phase-E totality design is
revalidated against the post-B-028 system and lands as the durable
Tier-1 design doc `docs/design/standard/totality.md`.

- **The severity reconciliation** (the item's reason for existing):
  v1's notify-by-default and D34's strict-by-default bind at different
  levels and compose — strictness is unconditional at discharge
  ACCOUNTING (every tier recorded, nothing silent) and at the CONTRACT
  (declarations, `total`, annotations halt since F3); info remains the
  migration-era default for UNDECLARED code; the flip to strict is a
  per-project config decision (designed shape recorded), never a
  global break. Proposed as T-R1–T-R3.
- **Archive disposition** (§6): per-stage map of
  `phase-e-totality-plan.md` — Stages 0/2/3/6 shipped (some
  strengthened: `total` real, unrecognized `decreases` a recorded
  admission), Stage 1 shipped narrower with the closed-sum/record/
  dead-case taxonomy kept [designed], Stage 4 reshaped
  (all-edges-decrease over Tarjan SCCs replaces the common-lex-measure
  requirement — T-R4), Stage 5's `[t: Totality]` marker system
  DISCARDED (totality polymorphism is subsumed by div riding the
  effect calculus — T-R5).
- **Riders recorded**: T-R2 project severity config (owns
  `total`-by-default, per-kind promotion, blanket axioms, the CE-R8
  severity knobs); T-R6 divergence-aware inlining cutoff for the
  measured ~43s precompile pathology (with B-087).
- Hygiene: `lib/totality.alg` header refreshed (comments only — it
  still described `total` as "reserved"); the standard-layer README's
  halt claim corrected per CE-R8 (same correction CLAUDE.md got at
  F4); design indexes updated.

Docs-only (one lib comment block). T-R1–T-R6 proposed —
awaiting maintainer ratification; B-018 closes on the gate decision.
1197/1197 green.

## 2026-08 — B-028 F4: D32 guarded projection + arc release

The completion arc's final chunk: the D32 guard is real end-to-end,
arrival order is confluent, and the arc's decisions are stamped
EXECUTED. B-028 closes.

- **Guarded projection** (D32): the success arm was already emergent
  (projections, touched-field reads, and method calls on a guarded
  construction re-fire through the cascade and resolve — now pinned by
  tests). The FAILURE arm was the new machinery: a failed construction
  completes as an error value, and its dependents' member accesses
  THREW out of the completion cascade (an uncaught throw in the async
  drain — host crash). The dispatch not-found exits now propagate
  viral channels: a projection over a failed guarded construction
  completes as the CONSTRUCTION's error, never a fresh dispatch error
  and never a throw. Error's own members still dispatch normally.
- **Stages-of-arrival confluence** (D33): when the invariant's field
  landed FIRST, construction completed with the untouched slot still a
  pending symbol — the stored instance and `print` output were
  arrival-order dependent. Two coordinated fixes: COMPLETION
  REPLACEMENT (a resolving future substitutes into complete
  dependents' data slots — copy-on-write, monotone, write-once
  untouched; gated to slots referencing marked future/import cells so
  quoted-AST data held in slots is never re-executed by the cascade)
  and `print` DEFERRING past pending slots (io must not observe
  scheduling order without a `sched` label). Folded and both arrival
  orders now agree byte-for-byte — instance and output alike.
- **Invariant-predicate div gate** (D32/CE-R7): a value-inspecting
  invariant predicate must be div-free or the guard could hang.
  Identity probe + callee sweep (analysis stamps for same-compilation
  callees, effect channels for module leaves) — deliberately NOT an
  on-demand predicate precompile, which re-opened the F3
  branch-exploration hazard on a hot path. Recognized scalar domains
  discharge without running the predicate (the shipped opaque-domain
  discriminator); the D34 spectrum lifts the gate (`assume
  terminates` / `decreases`), and the refusal names the diverging
  callee.
- **Docs release**: structures.md §10 stamped EXECUTED (with recorded
  residues); D16/D31–D34 → EXECUTED in the register; effects.md
  roster gains `sched` and `div`; language-reference gains the
  async/completion section; CLAUDE.md's halt invariant corrected to
  shipped reality per CE-R8 (construction-path invariant failure =
  error value; non-exhaustive match = info — promoting either is a
  maintainer decision, deliberately not smuggled). Plan closed;
  backlog B-028 checked with riders routed (B-047, B-048, D35, B-018
  severity + the F4-measured precompile-inlining rider, select/
  cancellation/timers, S5 conformance, nested-slot replacement).
- **Chunk-time finding** (for the rider): the pre-existing precompile
  PE-inlining of divergent non-same-arg recursion (`loop(n + 1)`)
  measured ~43s for a single compile on the session container — first
  hard number behind the divergence-aware inlining cutoff.

4 new tests (guard success arm; failure arm; stages-of-arrival
confluence; invariant div gate + discharge). 1197/1197 green.
B-028 closes — the completion arc is released.

## 2026-08 — B-028 F3: `div` — the flip (D31/D34 live)

The completion arc's policy chunk: divergence is a first-class
computed effect and D34's discharge spectrum is real.

- **`div` rides the effect calculus** (CE-R1): the termination
  analysis runs BEFORE effect-declaration checking and writes `div`
  into each undischarged binding's inferred set — the existing
  inferred-⊆-declared check and its existing halt carry it with no
  new enforcement machinery. `effects pure` on a possibly-diverging
  function HALTS ("undeclared: div"); an undeclared function carries
  `div` visibly without halting. The closure propagates div up the
  call graph (admitted axioms block it; witnessed metrics transmit
  it — they prove only the function's own recursion); cross-module
  leaves answer through their effect sets. The long-reserved
  needs-annotation notification finally fires for inherited div.
- **D34 tiers recorded per binding** (CE-R2): auto (non-recursive, or
  provable recursion) / witnessed (kernel-checked `decreases`) /
  admitted (`assume terminates`, or an unrecognized `decreases` shape
  — the formerly SILENT trust is now a recorded admission) /
  undischarged (`partial`, or unproven recursion). `checkTermination`
  is now a thin wrapper over the unified `analyzeDivergence` — same
  findings, one pass.
- **Surface forms** (CE-R3): `total` (per-function strict opt-in —
  undischarged div on a `total` function is a compile error) and
  `assume terminates` (the admitted liveness axiom) land in
  `lib/totality.alg` through the sanctioned lowering chain.
- **The purity gates see div** (CE-R7): a possibly-diverging `eq` or
  coercion fails the E-R5 gate mechanically.
- **Verdict/CLI wiring** (CE-R2/CE-R4): the verdict gains a
  "completion (div discharge, D34)" block; admitted terminations and
  admitted liveness of USED async sources join the assumption ledger;
  undischarged div counts as a pending obligation and exports through
  `obligations` for PCP workers; inspect's totality filter carries
  the new kinds. All additive — pcp/1 unchanged, clean modules'
  verdicts byte-stable.
- **The corpus sweep (deltas 3–4) found exactly one customer**:
  `lib/units.alg`'s `dim_render_from` — unprovable count-up recursion
  whose inferred div cascaded through `dim_name` into the arithmetic
  surface and tripped the units `eq` on the E-R5 gate. Discharged by
  unrolling over the fixed 7-dimension domain (output byte-identical;
  web lib registry re-synced). Deltas 5–6 landed as pre-declared
  (finding messages unchanged; trusted `decreases` now recorded).

Six new tests: tier assignment, the declared contract halting on own
and inherited div, propagation notices, `total`/`assume terminates`,
the verified/trusted `decreases` split, and the eq gate.

## 2026-08 — B-028 F2: typed futures + detection (D33/D16 complete)

The completion arc's second chunk — futures become honest typed
values and incompleteness detection becomes an effect:

- **`Future[T]` exists** (CE-R5): minted through `buildGenericType`
  (memoized — identity equality free) with D33's flattening
  (`Future[Future[T]]` IS `Future[T]`) in the constructor; bound as
  `Future` in the standard extension. `delay` stamps `Future[Int]`,
  `fetch` stamps `Future[String]`. The annotation vanishes on
  resolution for free — carrier re-evaluation lets the resolved
  value's own type shadow it.
- **The call boundary checks landed knowledge, defers the rest**
  (CE-R5/D11) at BOTH sites: `checkArgType` (call path — a
  `Future[String]` where `Int` is expected is a real type error NOW;
  a matching element type flows into the body as a residual per PE
  Rule 1) and `type_check_impl` (annotation/return path — same
  element check, but deferral is a RESIDUAL that re-fires on
  resolution, so refinement predicates run against the real value:
  `w: NonNeg = delay(5)` completes to a checked 0).
- **`is_resolved` ships** (CE-R4/D33): lazy (an eager registration
  would residualize and never answer false), `sched`-labeled — the
  `certificate_peek`/`observe` precedent: scheduling-dependent
  answers break congruence, so pure code cannot ask. The label rides
  the existing calculus end-to-end: `effects pure` + `is_resolved`
  halts compilation naming `sched`; `effects sched` passes; F3a
  compile-mode deferral comes free (the answer never folds at
  compile time).
- **Modules evaluate with the session's FutureManager** (CE-R6): the
  loader threads it (option → evalSource), the CLI file runner
  creates one manager before module loading, and F1's mint-capture
  makes module-minted futures settle correctly after the manager
  re-points. Top-level async inside a module works and drains with
  the session; absent a manager the explicit host-capability error
  stands (a configuration error, not value incompleteness).
- **Liveness dispositions declared** (CE-R4/D34): `delay` = live by
  construction (a timer fires); `fetch` = admitted, resting on the
  named axiom "the fetched endpoint eventually responds" —
  registered at source-registration time, ledger wiring lands with
  F3's tiers.

Six new async tests. Conscious delta 2 (pending bindings now render
with `Future` typing) surfaced no snapshot changes — no pinned output
contains a pending value.

## 2026-08 — B-028 F1: substrate hardening (completion arc opens; CE-R1–CE-R8 ratified)

The completion-effects arc opened (plan `completion-effects.md`,
CE-R1–CE-R8 ratified as recommended, PR #23) and its first chunk
landed — no policy change; every fix makes shipped design words true:

- **Write-once is an invariant, not a convention** (D33): a second
  phase resolution of a completed cell now throws
  (`applyPhase` — the interface future/import cells actually resolve
  through; `resolveCell` keeps serving legitimate same-pass
  rebinding). Boundary-tested.
- **Cross-pass future resolution fixed** (REPL/web): the resolving
  closure captured the manager's registry/ctx at RESOLUTION time, so
  a future minted in pass N that resolved during pass N+1 applied its
  phase into a registry that never tracked the cell — dependents
  silently never re-evaluated. `createFuture` now captures the
  minting pass's pair and settles there first, then into the current
  pass when re-pointed. Value and rejection share one settle path
  (rejection stays an error VALUE, D11 — now tested).
- **The forward-chaining cascade is iterative**: recursion depth was
  bounded by dependency-chain length (stack risk on long chains);
  the loop preserves semantics exactly — termination is structural.
- **CE-R8 move 1 — the D32 soundness hole closed**: `refined.__construct`
  adopts the tri-state. Constructing through a value-inspecting
  invariant whose predicate reads a still-pending field RESIDUALIZES
  construction (pre-F1 it silently tagged the value as if the
  invariant held); re-fire happens through a check-only residual over
  the BUILT value (re-running the parent constructor would re-mint
  futures per cascade pass), with copy-on-write RESOLVED-SLOT
  SUBSTITUTION so the re-fired predicate — and the finally tagged
  instance — see real values, not stale symbols. A failing invariant
  over a future errors before the value exists; a passing one
  constructs with resolved slots. `collectSymbolRefs` walks data-
  structure bindings (a pending future in a field IS a dependency).
- **B-087 memo landed, suspect refuted**: `exhTypeLookup` is memoized
  (correct, and a div-inference prerequisite) but A/B measures ~2% on
  the 65s demo — the backlog's hotspot hypothesis was wrong; B-087
  stays open with the finding recorded.

Five new async tests (cross-pass, rejection-as-value, write-once,
failing/passing guarded construction).

## 2026-08 — B-097 V4: evidence hardening + forgery E live (S3 arc complete)

The visibility arc's release chunk — verification and record, no new
policy:

- **Forgery E is LIVE — the last skeleton retires; the D21 roster
  (A–F) is fully live.** The battery loads a holder module through the
  production loader (writer capability module-private, only the usage
  surface exported) and proves the ocap discipline is
  language-enforced: the unexported writer is refused through dot
  access (module mediator), flat `use`-injection (export-set filter),
  and the wire (D42 partition — resolves to nothing, mints nothing),
  while the exported surface exercises the capability normally. The
  roster test is STRENGTHENED: no skeletons may remain.
- **Evidence capsule hardening (V-R2)** asserted in the boundary
  battery: D24 capability shape (PrimitiveFunction closure, no data
  plane), print-redacted (`<primitive:evidence>`), answers only
  `holds(name)`; and non-fabrication — user-built look-alike closures
  grant nothing because kernel mediation reads the evaluator-supplied
  context, never a passed capsule.
- **D41 confluence (stages 3–4) gets its harness**: folded (static
  receiver) and late (residual completed at call time) mediation agree
  — on denial (same "private to" refusal) and on access (same value).
- **Docs sync**: structures.md §6/§13 execution stamps + Appendix C
  row E flipped; type-system.md §3 rewritten (the "no private
  keywords" era is over — combinator surface documented); modules.md
  encapsulation half updated; language-reference gains the private
  example; decisions register D41/D42/D43 marked EXECUTED.

`docs/plans/visibility.md` closes: all four chunks landed (V1
substrate, V2 pipeline, V3 flip, V4 hardening). Riders live with their
owners (keyword syntax B-043, readonly semantics B-046, sync/async
B-047, internal/protected reserved per V-R3, downcast refusal on the
C3.2 deferred list). Perf floor untouched (warn-only, no drift).

## 2026-08 — Methodology pin bumped to v1.2.0 (+ register cleanup)

Compliance target migrated 1.1.0 → 1.2.0 (Binding block +
Classification — landed via PR #19's migration pass; both v1.2.0
amendments ship migration-note: none, so the pin bump was the whole
migration). This entry is the follow-up cleanup: the CHANGELOG record
(the v1.1.0 bump's precedent) and the Audit-log backfill — the
post-bump form audit (0 violations / 0 warnings, clearing the
2026-08-21 Article 8 lag warning) was recorded only in the migration
commit's message; `docs/audits.md` now carries its register entry.

## 2026-08 — B-097 V3: private members (the flip)

The S3 arc's policy chunk: D43 declared modifiers exist and the kernel
mediator enforces them. Everything below is inert for types that
declare no private members (one host-flag read on the hot path):

- **`private(...)` combinator** in `Type.define`/`Interface.define`
  specs (V-R5): `{secret: private(Int), helper: private(fn)}` marks
  the declaration; the attribute rides the member DESCRIPTOR (the
  `getter` precedent). `readonly(...)` is registered as RESERVED
  vocabulary — recorded on the descriptor, inert until B-046. Keyword
  syntax stays parked on B-043 and will lower to these attributes.
- **Kernel mediation** (`assertMemberReachable`, D41 stage 3): a
  private member resolves only for contexts holding the type's member
  privilege. Evidence is possession realized on the C2 chain: dispatch
  PLANTS a kernel privilege layer over the call-site scope when it
  evaluates the type's own member bodies (methods, getters, operators,
  the declared `construct`), so the type's own code reaches its
  privates and nothing else does — denial says `'x' is private to 'T'`
  (names-public, per V-R5). Pure; folds at PE time (V-R8). The gate
  covers dot/bracket/interpolation, BOTH operator bridges
  (PRIM_TO_METHOD and `typed_*`), and the meta path.
- **Private symbols are type-local** (V-R3): a `private(...)`
  declaration never draws — it cannot override a drawn member (a
  base-name collision with a drawn member is a define-time error),
  drawing a foreign private is a denial, and bundle privates never
  propagate into drawing types.
- **Bespoke readers close per policy** (V-R6): destructuring a private
  field outside its scope is an ERROR naming privacy (inside a member
  body it works — privilege held); `formatValue` and the auto
  `toString` omit private fields with an honest `…` marker;
  structural/declared conformance counts only externally-reachable
  members (an actual-side private satisfies nothing; an expected-side
  private requires nothing).
- **Reflection per V-R7**: enumeration surfaces and flags stay free
  and caller-independent (`memberDescriptorsOf` counts unchanged;
  descriptor `name`/`private` pairs list for everyone); the ACCESSOR
  is gated — `ctx_bindings` withholds private (name, value) pairs on
  instances and the `value` (implementation) pair on private members'
  descriptors without possession evidence.

Conscious deltas 4–7 landed as pre-declared (all latent — no existing
test or demo used privates; delta 4's module-refusal substring set did
not need extending since module denials are unchanged). Lowering shape
untouched. New tests: field/method/operator denials + internal access,
destructuring error + privileged destructure, printer honesty,
conformance filtering, draw denial, shadow error, reflection gates,
readonly inertness.

## 2026-08 — B-097 V2: pipeline unification (mediation seam in place)

The D41 pipeline's plumbing lands with no policy change — everything
still public; V3 flips the switch:

- **One dispatch ladder** (`dispatchThroughType`): the typed
  descriptor+protocol path and the untyped/meta-type path (previously
  a drifting shadow copy with NO availability gate) now share one
  implementation. Conscious delta 2 (ratified): the meta path gains
  the same C3.2 availability refusals as the typed path.
- **The availability gate is extracted** to `assertMemberAvailable`
  (types-std) and now also guards **operator dispatch** — the formerly
  deferred C3.2 item: `a + b` through PRIM_TO_METHOD checks the
  occurrence bound exactly as `a.add` would (conscious delta 3).
- **`fallbackMember` is 3-ary**: hooks receive the V-R2 EVIDENCE
  CAPSULE — a kernel-minted opaque closure (D24 capability shape,
  print-redacted, non-enumerable) answering only `holds(name)` against
  the access-site scope chain. Kernel hooks ignore it today; V3's
  possession tests consume it.
- **The hook runs through the evaluator** (`applyPrimitive`), so an
  effectful fallbackMember's tags propagate into inference —
  previously silently discarded (called raw with dropped ctx). The
  three `undefined as any` ctx drops (getter call, hook invocation,
  meta getter) are repaired.
- **`typeMethod`'s raw-binding fallthrough is narrowed** to registered
  meta-protocol slots: a stray non-slot binding on a type Context is
  no longer name-reachable through dispatch.

Lowering shape unchanged — totality's HOF matcher and the source
renderer are unaffected by construction. New tests: capsule
possession answers, effect-tag survival, stray-binding refusal.

## 2026-08 — B-097 V1: visibility substrate (S3 arc opens; plan ratified)

The S3 mediated-member arc opened: `docs/plans/visibility.md` ratified
(V-R1–V-R8 + the forgery-E criterion, all as recommended — one kernel
pipeline with `fallbackMember` as the sole user hook, opaque evidence
capsule, private/public tiers, open-module policy, `private(...)`
combinator surface, bespoke-reader closure, names-free/accessors-gated
reflection, per-mediator effect tags). V1 lands the substrate:

- **Export-ness is a Binding property** (V-R4, D42, D39 addendum
  executed): `Binding.visibility` on the scope binding; `export NAME =
  …` / `export NAME(…) => …` mark the binding at build time
  (tree-builder → buildProgram → eval scope). The value-plane
  `exported` component is RETIRED — the `export` primitive is an inert
  passthrough (the `*_attach` defense precedent), nothing in the
  language writes the component, and the `y = x` aliasing wart is dead
  (conscious delta 1, ratified: the component-mechanism test reworked
  to its binding-attribute collapse-equivalent; conditions preserved).
- **Module loader** derives ONE export set from binding visibility;
  the open-module policy is explicit in code: no exports declared =
  open module (all public — the nine no-export libs unchanged), any
  export closes the module. Flat `use`-injection and the D42 wire
  partition already consume that same set.
- Slot registry row updated (D39 addendum executed; channel
  registration retained solely as the boundary battery's writer-idiom
  example). New tests: binding-level marking, alias non-export, typed
  export-fn marking.

## 2026-08 — B-096: deployed-version verification (T-tooling)

`[stage: live]` becomes auditable instead of attested. `deploy.sh` now
stamps `website/version.json` at deploy time (commit / branch /
deployedAt / dirty; gitignored — generated per deploy, uploaded by the
existing S3 sync) and warns on non-main or dirty deploys. New
`npm run check-deployed` (`scripts/check-deployed.ts`, out-of-rootDir)
fetches the stamp from the live site and compares to origin/main:
current / stale-by-N-commits / mismatch (unknown commit, dirty deploy)
/ unverifiable, with matching exit codes (0/1/2). Only a clean 404
reads as "predates the stamp" — proxy 403s and 5xx report as
unverifiable, not unstamped. Pure verdict logic (`assessDeployment`,
`parseStamp`) exported and unit-tested (7 tests, new `check-deployed`
suite section, no network in the suite); the CLI needs egress to the
site, so it runs on the owner's machine. First stamp publishes with
the owner's next deploy. Closes the chunk-1 gate flag; feeds the
Article 11 tooling picture.
## 2026-08 — Methodology pin bumped to v1.1.0

Compliance target migrated 1.0.0 → 1.1.0 (Binding block + Classification).
The release's two amendments (amendment & release process; Audit-log
register) both ship migration-note: none — the delta is
methodology-repo process machinery; no project-facing duty is minted.
Taken up the one optional hook: `docs/audits.md` seeded with the B-095
chunk-4 form-audit entry, making the Article 9 delta-ratio trigger
recordable here.

## 2026-08 — B-095: methodology adoption (majodali/methodology v1.0.0) — arc complete

Allegro is classified and structurally compliant under the pinned
methodology. Four chunks, each owner-gated; chunk 3 ran as five
per-move-reviewed PRs (#6–#10) on W-006 single-use branches.

- **Chunk 1 — Classification + Binding**: `docs/classification.md`
  (C2 / S0 / language-tool-platform / static-site, pinned 1.0.0,
  Workflow `in-dev → merged → live` + stage-reference convention) and
  the CLAUDE.md Binding block. Gate rulings: C2 confirmed; B-091
  `[stage: live]`; the drafted DEV-1 deviation withdrawn — W-006
  adopted in full; B-096 (deployed-version verification) registered.
- **Chunk 2 — Decision register (K-004)**: `docs/decisions.md` indexes
  the corpus (D1–D47, E-R, U-R, R-R, chunk + standing rulings) under
  original IDs; D48+ continues there. Side-finding: two stale
  ruling-status passages refreshed to match their ratification logs.
- **Chunk 3 — Authority relocation (K-001/K-002/K-007)**: plans tree →
  `docs/plans/` with K-007 statuses; memory audited (five inbound
  citations retargeted, 13 dead stubs deleted, A6 banner); every
  bootstrap-only fact promoted (v1-era history → this file; new
  `core-types.md`, `extension/modules.md`, `implementation-map.md`,
  `language-reference.md`; type-system + grammar-formalism sections);
  CLAUDE.md 676 → 135-line pointer bootstrap; Backlog →
  `docs/backlog.md` with root tombstone. All four Article-7 transition
  designations resolved.
- **Chunk 4 — Close-out**: PR template (practice D2) at
  `.github/pull_request_template.md`; transition section emptied;
  form-audit self-check against the rule corpus recorded in the plan;
  coordination drafts (portfolio register row, practices §5 census
  corrections) prepared for the methodology repo; risk register NOT
  seeded (K-005: no register before pressure — proposed, owner's
  call). Plan closed → this entry.

Suite green throughout (1149/1149 at every landing).

## 2026-08 — B-092 U4: rung-2 release packaging (B-092 closes — rung 2 landed)

The seriousness proof ships: demos/rung2 (3 suite-validated scenes
with break-it blocks + captured transcripts — the refinement halt, the
gate refusal, the full domain-vocabulary verify ledger), a landing-page
"A provable DSL — units of measure" section with a live sandbox and
the ledger transcript, and a Walkthrough 5 sandbox preset (both
copies).

Release-infrastructure fix: the web pages resolve `use NAME` through
inline Allegro.registerLibrary sources — index.html carried FIVE
hand-pasted drifting copies and the sandbox pages carried NONE (the
B-091 walkthrough presets using `use contracts`/`use effects` would
have failed on the deployed sandbox). New `scripts/sync-web-libs.ts`
generates the registry region in all three pages from the DISK libs
(pow, match_expr, invariants, contracts, effects, units) at marked
anchors, with byte-identical decode verification and a `--check` mode.
37-example site sweep clean against the same sources the pages now
serve.

Claims re-grade: release-track D4 flagship-DSL row → delivered;
messaging.md gains the units claim with receipts; plans manifest
units-dsl.md → landed. Residue routed: B-081 (refinement-failure
domain detail), B-089 (record-domain law sampling — flips the DSL's
pending laws to sampled with zero DSL changes). 1149/1149 green.

## 2026-08 — B-092 U3: laws + physics theorems in domain terms

Rung-2 chunk U3: Quantity draws Equatable — its refl/sym/trans law
obligations plus two declared algebraic laws (`law_mul_comm`,
`law_conv_roundtrip`) are RECORDED, all at their honest tier: pending
(record-domain quantifiers have no sample construction yet — B-089
residue — and the verdict's `?` rows are the point, per U-R3).

Physics facts discharge at the PE tier in literal syntax:
`theorem km_scale: 1 km == 1000 m`, `theorem newton_ident: 1 N ==
1 kg·m/s^2`, `verify (9.8 m/s^2).mul(2 s) == 19.6 m/s`, and F = ma
end-to-end through the refinement-typed signature. The E4 strict gate
arms over quantities: proof_trans is refused naming 'Quantity' and
both escape hatches; `Law.assume(Quantity, "trans")` opens it and the
verdict renders the weakness note + the assumption-ledger line mapping
the admitted law to the proofs resting on it — the entire ledger in
domain vocabulary.

`min`/`h` unit aliases added — found when the kernel refused
`theorem min_scale: 90 minute == 1.5 h` (unbound `h` → residual → eq
false → "proposition is false"): the build-halting theorem caught a
lib bug during demo authoring, which is the loop working as designed.

tests/units-laws.alg suite-registered + 4 TS tests (obligations
recorded, gate refusal, admitted ledger with backers, PE-tier scale
fact). 1146/1146 green. U4 (rung-2 release packaging) next.

## 2026-08 — B-092 U2: quantity literal grammar + two grammar-kernel refinements

Rung-2 chunk U2: `3 m`, `9.8 m/s^2`, `1.5 km`, `2 kg·m/s^2` parse as
quantity literals via a `grammar { }` block in lib/units.alg —
number-anchored (U-R2: only a numeric literal followed by a same-line
unit expression; computed values use the ordinary algebra), with unit
products (`·`/`*`), one `/`, and integer `^` exponents. Matched unit
idents resolve in the consumer's scope (`use units` provides them).

Two kernel refinements the chunk forced, both general (recorded in
docs/design/extension/grammar.md §4):
- **Explicit-ws override in user EBNF**: auto-interleaved `ws_any`
  matches raw newlines, which would glue `x = 3` onto the next line's
  identifier. An explicit ws production between two items (`hws`/`ws`/
  `ws_req`/`ws_any`) now suppresses the auto-wrap — adjacency-sensitive
  rules get horizontal-only whitespace.
- **expr_form splices at the FRONT of expr_atom**: the engine's alt is
  PEG-committed ordered choice, so number-led forms were dead code at
  the old before-ident splice position (the shorter `number` match
  committed first). Keyword-led forms (match) unaffected.

tests/units-sugar.alg suite-registered: literals, composition with the
algebra/refinements, the marquee domain error in literal syntax, and a
non-interference battery (cross-line non-glue, keywords after numbers,
calls/arrays/parens). 1141/1141 green. U3 (laws + theorems) next.

## 2026-08 — B-092 U1: units DSL core algebra + user-type operator dispatch

Rung-2 chunk U1 (plan `docs/plans/units-dsl.md`, U-R1–U-R5
maintainer-ratified): `lib/units.alg` — pure Allegro, zero host code.
Dimensions are structural 7-vectors (abelian group by exponent
arithmetic, E1 structural equality); one Quantity record; named
dimensions (Length, Velocity, Force, …) are REFINEMENTS over it, so
dimensional soundness is refinement discharge — the same machinery as
PositiveInt. Wrong-dimension arguments HALT at the call site through
checkArgType; same-expression mismatches are domain-vocabulary error
values ("cannot add m and s: length vs time"). Conversions, normalized
comparison, derived units (N/J/W/Pa composed via unit algebra),
mechanics SI set.

Kernel fix surfaced by the chunk: the evaluator's PRIM_TO_METHOD
operator-dispatch path handled only HOST-PRIMITIVE methods, so
user-defined record types' method impls (ComposedFunctions from
Type.define specs) fell through to raw bits ops — `q1 + q2` crashed
with `bits_add: expected Bits`. The path now dispatches
ComposedFunction members too (self-first, full values), giving every
user-defined type operator overloading — a substrate win the rung
exists to force.

tests/units-core.alg (suite-registered, F = m·a end-to-end) + 3 TS
tests (call-site halt, domain-error message, dimension group facts).
1140/1140 green. U2 (literal grammar sugar) next.

## 2026-08 — B-094 chunk 2: migration reality + `explain` (source channel complete)

The planned lazy→eager migration of the proof entry points was
re-scoped on a finding worth the record (structures.md §3.1 amended):
the combinators had ALREADY gone eager at C4.3c, and
`proof_by_eval`/`proof_check` are lazy for a load-bearing property —
they are NON-VALUE INTERPRETERS. A proposition that evaluates to a
residual or error must become a failed proof; the eager path's Rule-1
residual guard and error-virality would intercept before the impl and
silently weaken failure semantics. That is genuine control-flow
laziness, so the lazy-for-AST-access workaround class D47 targets is
empty in the kernel — D47's payoff is prospective, for NEW
meta-functions. A regression test pins the halt-not-residualize
behavior.

The reference consumer lands: **`explain(expr)`** → `"x * 3 = 12"` —
an ordinary eager primitive with `sourceAware` registration (one
line), no grammar production, no laziness, observe-tagged, with
infix-faithful rendering (compound operands parenthesize). This is
the exact pattern the rung-2 DSL uses for errors in domain terms.
3 new tests; 1136/1136 green. B-094 closes; residue (inert quote
carrier for user-level AST values, Structure-binding attachment
identity audit, attachment on completion-replacement) recorded on the
backlog entry and folded into rung-2 planning where the DSL's needs
decide priority.

## 2026-08 — B-094 chunk 1: the source channel — ASTs as channel payload (D47 ratified)

Maintainer-ratified D47 (structures.md §3.1): meta-functions receive an
operand's originating AST through the `source` channel instead of via
dedicated grammar productions or lazy registration.

- **Source-aware registration**: `makePrimitive(..., sourceAware)` —
  the data-plane analogue of `lazy`. At call sites of a source-aware
  primitive the evaluator attaches each argument's unevaluated
  Expression AST to the evaluated value (kernel origination, the only
  attachment authority). Zero cost at every other call site.
- **Binding-level attachment** (the (b) complement): resolved
  top-level bindings whose data is not a Structure carry their RHS
  AST — `x = 2 + 2` answers `source of x` → `"2 + 2"`, with lexical
  fidelity (`z = x + 1` renders `x + 1`). Structures (types, records,
  proofs) deferred pending an identity audit; residuals skipped
  (forward chaining replaces them).
- **Read surface**: `source of x` lowers to `source_get` — eager,
  OBSERVE-tagged (the certificate_peek precedent: source reads
  distinguish extensionally equal values), returning rendered TEXT via
  a new canonical `renderExprSource` (infix-aware). A raw Expression
  as a user value would read as a residual to the completion machinery
  — the inert quote carrier is deferred until user meta-functions
  land. `component_get` answers none for the key (no effect
  laundering); absent channel → none.
- **Integrity**: `source` joins the integrity-channel set — `mv_set`
  origination is refused (forged provenance would let a doctored
  channel display a different claim than the one checked). Registry
  rule flipped from the pre-D47 `positional` sketch to `drop`
  (derived values must not inherit fabricated provenance). Equality
  ignores the channel (E1).

7-test battery (binding render, lexical fidelity, none-on-absent,
drop, source-aware call site, observe inference, forgery refusal +
laundering block). Boundary lint clean (isMetaSlotKey, no new dunder
literals). 1133/1133 green. Chunk 2 (proof primitives migrate
lazy→eager source-aware) next.

## 2026-08 — B-091 slices 1–2: rung-1 release package + D2 assumption-ledger roll-up (Track R)

The first release-track content derivation (plan:
`docs/plans/release-track.md`, B-090 ratified) plus the one
functional item the rung-1 story needed, and a soundness fix it
surfaced.

- **Messaging skeleton** (`docs/messaging.md`): canonical source for
  all public copy — the three moves, the rung-1 story, claims with
  runnable receipts (delivered/demoable only), an explicit
  what-we-do-not-claim section, voice rules.
- **Rung-1 demo package** (`demos/rung1/`): four runnable scenes
  (discharge, counterexamples, effects refusal, laws + admitted tier)
  each with a commented break-it block and captured real transcripts;
  `05-prover-loop.md` walks obligations → propose → prove → verify
  with real CLI output. All four registered in the `fileTest` battery
  so the public demos are suite-validated.
- **Website refresh** (`website/index.html`): hero + three-moves intro
  on the skeleton; new Laws section (live sandbox + verify-ledger
  transcript) and Prover Loop section (real CLI transcripts + honest
  bench framing); refinement examples migrated `&&`→`&`. Sandbox
  walkthrough presets (4) added to `website/sandbox.html` +
  `web/sandbox.html`; every sandbox source verified against the
  interpreter. Deploy remains the maintainer's manual step.
- **D2 assumption-ledger roll-up**: proofs now carry a TRANSITIVE
  law-backing set (`__lawBackings`, js-property host plane — the
  `__effectSet` pattern) unioned through `proof_refl`/`sym`/`trans`/
  `cong` and preserved by `proof_check`'s relabel, so nested chains no
  longer lose inner backings (a `proof_sym(proof_trans(…admitted…))`
  theorem now renders its weakness note). The single E-R6 fields stay
  as the OWN-rule backing (`p.lawTier` dispatch unchanged). Verdict:
  `TheoremResult.restsOn` (additive optional; pcp/1 unchanged),
  multi-entry weakness notes, and a new `assumption ledger` block —
  every admitted/sampled assumption in force mapped to the proofs
  resting on it, pending-obligation count, explicit `clean` line.
  `allegro inspect` renders per-proof `rests on:` lines (weak loud,
  proven quiet).
- **Soundness fix (pre-existing)**: `buildProgram`'s stmt walk did not
  dispatch `theorem_decl`/`verify_stmt` directly; fragment-merged
  grammars (any `use`-header file) surface stmt alternatives without
  the base "stmt" wrapper tag, so the walk recursed past the theorem
  and built its proposition as a bare expression — **a false theorem
  in a `use`-header file was silently dropped instead of halting the
  build**, and `allegro verify` saw 0 theorems in such files. Fixed in
  the dispatch set; 3 regression tests (kept+discharged, false-theorem
  halt, false-verify halt).
- **Public docs**: `docs/getting-started.md` (outsider path: install →
  first verified program → break it → inspect/verify → prover loop →
  honest status). `docs/proving-in-allegro.md` (the PCP LLM worker's
  system primer) gains the missing E3/E4 section — tiers, `Law.witness`
  / `Law.assume`, the strict-gate refusal + failure-mode row — so a
  prover hitting the gate knows both legal outs.

Tests: 1122 → 1125 (5 D2 roll-up + 3 regression, minus prior count
overlap); suite green. Demo transcripts re-captured for the new ledger
block.

## 2026-08 — E4: admitted tier + proof_trans strict gate + proof tier recording (B-027, Tranche C — arc complete)

The final chunk of the equality-and-laws arc: assumption becomes a
first-class, verdict-visible tier, and the first law-dependent context
starts REFUSING unproven laws.

- **Admitted tier (D34)**: `Law.assume(T, "name")` marks a law ASSUMED
  — flips a pending/sampled obligation to status `admitted`, or
  REGISTERS an admitted entry when the type never instantiated the law
  (a custom equality that never drew Equatable can still be admitted
  transitive — exactly what unblocks the gate). Proven beats admitted:
  assuming a discharged obligation is a no-op. `Coercion.assume(From,
  To, obligation)` is the same tier for the §7 edge obligations.
  Admitted entries are excluded from the pendingOnly H2 export
  (resolved for gating) but render loudly in the Verdict
  (`1 ADMITTED (assumed, not proof)` + per-entry `!` lines).
- **The first strict gate (§6 delta 6)**: `proof_trans` now demands
  the chained equality's transitivity be proven, sampled, or admitted.
  Kernel equalities (structural default / built-in scalar eq) are
  auto-proven by the parametric certificate — existing programs stay
  green (pinned). A custom equality with no discharged/sampled/
  admitted `trans` law returns a failed Proof whose counterexample
  names both escape hatches (`Law.witness(...)` / `Law.assume(...)`).
  The gate list is the §6-style pre-approved queue — follow-on gates
  (e.g. `Ordered` totality for sorts) land per-entry, not wholesale.
- **E-R6 proof tier recording**: equality proofs record which equality
  they used and which law tier backed the rule — `equality`,
  `lawName`, `lawTier` as plain instance-data bindings (the C6.3
  pattern; declared as Proof-kind fields so `p.lawTier` dispatches).
  `proof_refl`/`proof_sym` record without gating; `proof_check`'s
  relabel carries the backing through to the theorem binding.
  `TheoremResult` gains `lawBacking`; `formatVerdict` renders a chain
  resting on admitted/sampled backing as verdict-visibly weaker
  (`✓ t — by auto-PE [resting on admitted 'trans' of 'CA']`); proven
  backing (kernel/enumerated/witnessed) renders nothing (extends D8).
- **Ordered → BACKLOG (B-089)**: the plan's condition for sketching
  instance #2 was "IF the mechanism needs a second consumer to
  validate generality" — Equatable + user interface laws + refinement
  laws already exercise the mechanism, so `Ordered`/`Monoid`/
  `Semiring` move to the backlog as consumers, with the rest of the
  arc's registered residue.

Note: sampled-tier `trans` backing is currently unreachable (custom
equalities live on record types, whose domains aren't sampleable yet)
— the code path is kept for when record-instance sampling lands
(B-089). 9 new battery tests. 1113/1113 green. B-027 closes.

## 2026-08 — E3: law members + obligation instantiation + discharge tiers (B-027, Tranche C)

The law mechanism lands (structures.md §8, D38): interfaces and type
specs can carry LAW MEMBERS — named theorem templates quantified over
the implementing type — whose obligations flow through the existing
PCP machinery with D34 discharge tiers. Equality is instance #1:
`Equatable` ships in the standard env with `law_refl`/`law_sym`/
`law_trans` running through the SAME `protocolEqualsBool` chokepoint
`==` uses.

- **Surface (E-R3)**: `law_`-prefixed spec entries with a
  `for_all(...)` proposition — `Interface.define({eq: Function,
  law_refl: for_all(a => a.eq(a))})`. `for_all(fn)` is an eager
  primitive marking the body via a host-side WeakMap (no new `__*`
  slot, no new grammar — it's an ordinary call). Works on
  `Interface.define`, `Type.define` (laws about own members), and
  `Refinement.define` specs. Law descriptors (`LawType`) are ordinary
  members drawn like any other — law inheritance is symbol identity
  for free.
- **Instantiation (draw time)**: an interface DECLARES (schema only,
  nothing runs); a concrete type drawing a law-bearing bundle
  instantiates one obligation per law, quantifier specialized to the
  implementing type. Refinement-spec laws instantiate against the
  refined type WITHOUT minting descriptors — a refinement shares its
  parent's member set by object identity (that sharing IS shape
  transparency, D37), so its laws live at the obligation layer.
- **Discharge tiers (E-R4/D34)**, attempted at instantiation:
  `kernel` — the law carries the parametric certificate
  (`KERNEL_EQUALS_CERTIFICATE`) AND the type's equality resolution is
  kernel-supplied (no custom `eq`, or a built-in scalar eq);
  `enumerated` — finite quantifier domain (Bool) fully enumerated;
  `sampled` — F7-style bounded sampling over Int/interval domains
  SURVIVED (recorded as its own status — survival is not proof); a
  COUNTEREXAMPLE HALTS definition with concrete inputs (`law 'sub'
  fails for 'T': counterexample at (0, 1)`); `witnessed` —
  `Law.witness(T, "name", proof)` attaches a discharged Proof term
  post-hoc (`Coercion.witness(From, To, obligation, proof)` is the
  same path for E2's §7 edges); `pending` — exported through H2.
- **Retroactive kernel conformance**: the built-in scalars draw
  `Equatable` — each scalar's `eq` implementation is multi-bound under
  Equatable's member symbol, so `42 instanceof Equatable` is true and
  refl/sym/trans discharge at tier kernel via the parametric
  certificate (§8 amortization: types with the kernel structural
  default inherit the same certificate free; a custom `eq` bears
  fresh obligations — pending until enumerable/sampled/witnessed).
- **E-R5 purity gate**: `eq` implementations and coercion fns must
  infer an EMPTY effect set — including `observe` (`certificate_peek`
  inside equals is exactly the D37 violation). Mechanical: reads the
  effects component / precompile stash, with an on-demand
  `precompileFunction` fallback injected from primitives.ts (types-std
  can't import the evaluator). Violation = definition-time
  `AllegroError` naming the labels.
- **Verdict + H2 routing**: `Verdict` gains `lawObligations` +
  `coercionObligations` (status + tier); `extractObligations` exports
  pending law/coercion obligations as PCP tasks
  (`E3Ob.law_refl`-style names). Both views are SCOPED to the
  compilation unit — the registries are process-global, so pcp.ts
  filters to types reachable as bound values on the eval scope chain
  (kernel scalars always in view; another module's types never leak
  into a file's Verdict). Pending laws do NOT flip `verified` — E3
  records tiers; E4 turns on the first strict gate.
- **Precompile suspension**: the runtime's precompile pass evaluates
  every binding once to detect function shapes, minting throwaway
  type objects. Law instantiation + the purity gate suspend during
  that pass (`setLawInstantiationSuspended`) so definition-time
  semantics fire exactly once, at the real evaluation.

Deviations recorded in plan §6b: witnessed tier verifies the term IS a
discharged Proof but defers structural proposition-matching for
quantified propositions (E4/H-arc); `distinct` copies law descriptors
under fresh symbols without instantiating obligations (newtype laws
deferred); record-domain quantifiers aren't sampleable yet → pending
(honest — the H2 export owns them). Two invariant re-pins: Int's
member keys now live in Int's OR Equatable's scope; `distinct`'s
same-surface check compares base-name sets (the parent's `eq` is
multi-bound). 19 new battery tests. 1104/1104 green.

## 2026-08 — E2: declared coercions + least common type (B-027, Tranche C)

§7 step 2 lands in the E2 seam: when the two operands' equality shapes
differ, `protocolEqualsBool` now resolves the LEAST COMMON TYPE over a
declared-coercion graph, coerces BOTH operands in, and compares at the
target — symmetric by construction, hence commutative. No common type
→ not-equal (step 3 unchanged); common types with no unique least →
`AllegroError` demanding an explicit declaration (E-R2 ambiguity rule).

- **Registry + resolution** (`src/types-std.ts`): edges keyed by
  equality-shape identity; `coercionReach` BFS computes reachability
  with composed edge paths (first-found shortest path wins —
  deterministic; the coherence obligation is what makes path choice
  semantically irrelevant); the least candidate is the one from which
  every other common candidate is reachable. Transitive composition
  works: with `UserId→Int` declared and the kernel `Int→Float` edge,
  `UserId(42) == 42.0` meets at Float through the composed path.
- **Surface**: `Coercion.declare(From, To, fn)` — E-R2's recommended
  standalone form. `Coercion` is a module-like typed Object bound by
  the standard extension (dot access rides Object's `__getMember`, no
  new dispatch machinery). Rejects vacuous pairs (shared equality
  shape — e.g. a refinement and its base) and non-function third args.
- **Kernel Int→Float edge** ships registered at module init with both
  §7 obligations DISCHARGED at tier `"kernel"`; `1 == 1.0` flips true
  (§6 delta 4, was false via the raw-bits accident). `true == 1`
  stays false — no Bool coercion is declared, per the delta-7
  recommendation.
- **Obligations**: every user declaration instantiates
  equality-preservation + pairwise-coherence records PENDING
  (`coercionObligationRecords()` exposes them for tests and E3's tier
  machinery; PCP routing arrives with E3).
- **Distinct opt-back-in** (§6 delta 3 closure): `UserId(42) == 42`
  is false after E1; declaring `Coercion.declare(UserId, Int, u =>
  Int(u))` makes it true again — the designed two-step.
- **Composition through containers**: kernel structural equals
  recurses through the protocol, so same-shape containers coerce
  their components (`{x: 1} == {x: 1.0}` is true). Differently
  parameterized generic concretes (`Array[Int]` vs `Array[Float]`)
  remain distinct shapes with no edge — false, pinned as the boundary.

8 new battery tests (flip + commutativity, container composition,
generic-shape boundary, distinct opt-back-in both orders, coherence
triangle, ambiguity diamond error, pending/discharged obligation
records, vacuous+malformed declare rejection); E1's cross-shape pin
updated for the flip. 1085/1085 green.

## 2026-08 — E1: kernel structural equals + shape resolution (B-027, Tranche C)

First chunk of the equality-protocol arc (`equality-and-laws.md`,
E-R1–E-R6 maintainer-ratified 2026-08). `==` / `!=` now resolve
through the §7 EQUALITY PROTOCOL whenever both operands are typed —
one chokepoint (`protocolEquals` in `src/types-std.ts`) shared by the
evaluator's `bits_eq`/`bits_neq` dispatch and the `typed_eq`/`typed_neq`
path; it declines (null) for untyped operands so base-mode Allegretto
semantics keep.

- **Equality shape** (`equalityShape`, `src/slots.ts`): walks the FULL
  `__refines` chain to the representation root — past preserve-lifted
  and method-layer refinements too, unlike dispatch's `typeShape`.
  Refinements are knowledge and never separate equal values (D37):
  `PositiveInt(5) == 5` holds even when PositiveInt lifts operators.
  `distinct` types mint no refines edge, so §7 step 3 makes
  `UserId(42) == 42` **false** (was true — the distinct leak, §6
  delta 3).
- **Kernel structural equals**: same shape + no custom `eq` member →
  element-wise (dense region) + field-wise (non-meta bindings)
  recursion through the protocol, so custom `equals` on component
  types compose. `[1,2] == [1,2]` and `{x:1} == {x:1}` were HOST
  CRASHES (the old reference-eq stubs returned untyped ints the
  dispatch fallback mistyped as Array/Object, crashing formatValue) —
  now structural, typed Bool (§6 deltas 1–2). Record instances
  compare structurally; a spec-supplied `eq` method overrides the
  kernel and dispatches (both PrimitiveFunction and ComposedFunction
  descriptors).
- **Type values compare by identity** (types/kinds/interfaces/
  generics — anything holding a member set or construct authority):
  they are minted once/memoized, so identity IS their equality;
  structural comparison over their mostly-meta bindings would
  false-positive `Int == Float`.
- **`!=` is derived** — the negation of protocol equality; the pair
  is coherent by construction. `[1,2] != [1,2]` threw before (no neq
  member → raw `bits_neq` on a Structure).
- **Discovered delta (recorded as plan §6 delta 7)**: `true == 1` was
  `true` via raw-bits comparison; Bool and Int are distinct shapes, so
  it is now **false** — flagged to maintainer at landing.
- **Known limit**: UNTYPED source functions (`f(x) => x` with no
  annotations) carry no type channel, so `f == f` still falls to base
  `bits_eq` and errors (controlled AllegroError, not a crash). Typed
  functions compare by identity. Revisit if E3's Equatable needs it.
- `KERNEL_EQUALS_CERTIFICATE` exported as the E3 discharge-tier anchor
  (the kernel equals is lawful parametrically — refl/sym/trans by
  structural induction given lawful component equalities; pinned
  empirically by a bounded property-check battery).

E2 seam marked in `protocolEqualsBool` (least-common-type coercion
lookup between steps 1 and 3). 18 new battery tests (structural grid,
refinement/preserve peel, distinct non-equality, cross-shape scalars,
error virality, identity tiers, 11×11 no-throw kind-pair sweep,
refl/sym/trans empirical shadow); 1077/1077 green.

## 2026-08 — C7.2: kind-tower residue (Tranche B — D39 checklist to zero)

Closes the last D39 slot-disposition rows. Three sub-parts; three
rulings recorded in the structures plan §4, maintainer-ratified at
landing: R2 symbol-fresh distinct and R3 reserved `construct` spec key
ratified as proposed; R1 AMENDED — GenericType's missing construct
authority is a DEFERRED PUBLIC SURFACE, not integrity-required kernel
privacy (unlike Proof, nothing breaks if users mint generics; exposure
waits on surface design — per-generic gensym'd member scopes + a spec
form — and the refactor is additive). Follow-up polish in the same
tranche: `params` is a typed `Array[String]` instance field
(`Array.params` → `[T]`, `Function.params` → `[ParamTypes,
ReturnType]`) — bootstrap generics upgraded in place once ArrayType
exists.

- **C7.2a — GenericType through the kind recipe.** The GenericType kind
  (Effect pattern): draws Type's kind-member symbols (so `Array
  instanceof Type` holds by conformance and `type of Array` answers
  `GenericType`), declares the `params` instance field (`Array.params`
  dispatches). Generic types stamp shape = GenericType; `isGenericType`
  is a SHAPE check — the `__isGeneric` presence flag is DELETED. The
  applier collapses into the generic's `construct` slot (D45
  one-surface): `__constructor` slot + accessors deleted;
  `getConstruct` drops the alias fallback (call-as-function behavior
  unchanged — it already reached the applier through that fallback).
  `__params` → the plain `params` declared binding. Applied concretes
  stay shape Type; `__args`/`__generic` remain host-read instance data
  (registry rows note the consciously deferred member surface — ruling
  R1 avoids leaking `.args` into every applied-generic value via
  typeMethod's direct-binding fallback).
- **C7.2b — distinct + construct kind specs** (the C6.1b deferral).
  `Base.distinct()` re-derives as a SYMBOL-FRESH mint: parent member
  descriptors re-declared under a gensym'd scope (same impls, new
  symbol identity) — newtype non-conformance now falls out of C5.2
  symbol-identity membership BY CONSTRUCTION; the shared-member-set
  guard in `shapeAwareSubtypeof` no longer carries distinct (it remains
  for `structuralWrap`, which genuinely shares the member object). The
  post-hoc `Type.constructor` meta-method is REMOVED (it mutated a
  built type against D22); construction authority is declared at mint
  time via the reserved `construct` spec key —
  `Type.define({x: Int, construct: (a, b) => …})` (Refinement.define's
  reserved-key precedent). A construct-only spec mints a record type,
  not a bundle.
- **C7.2c — effect vars → declared structure.** The `__effectvar:NAME`
  marker strings inside effect-label sets and the `__effectVarParams`
  side table (which had NO functional reader since the F1-F3 walker
  deletion — only clone-preservation sites) dissolve into
  `Param.effectVar: string` — a structured reference to the
  Effect-kinded `__genericParams` entry by name. PE's Param-call branch
  surfaces the variable's BARE name in inferred sets (an `effects e`
  declaration matches directly; `checkEffectsDeclarations`' marker
  normalisation loop is deleted); concrete call sites resolve by
  ordinary PE substitution as before. Surface C call-site enforcement
  drops its marker-sniffing skip (`effectBound` is now always
  concrete). `EFFECT_VAR_MARKER`/`isEffectVarLabel`/`effectVarLabel`
  deleted from slots.ts; five `__effectVarParams` clone-preservation
  sites removed across evaluator/runtime.

D39 registry: `__isGeneric` row deleted; `__params`, `__constructor`,
`__effectvar:`, `__effectVarParams` rows executed; `__args`/`__generic`
annotated as deferred-surface instance data. New tests: GenericType
shape/conformance, distinct symbol-freshness + bidirectional
non-conformance + dispatch, construct spec key (custom authority,
type tagging, meta-method removal), effectVar declared structure.
1057/1057 green (was 1052 pre-chunk).

## 2026-08 — Tranche A docs closeout (B-002, B-031, B-003, B-004)

Post-M1 documentation debt cleared before chunk C7.2; no code-behavior
changes (one comment updated in `src/slots.ts`).

- **B-002 — decision log archived.** The D39 slot-disposition executed
  state, B8 primitive-audit table, and B10 forgery-scenario log are now
  Appendices A–C of `docs/design/allegretto/structures.md`;
  `structured-values-unification.md` (decision log D1–D46, complete —
  every decision executed or pinned to a named backlog owner) moved to
  `docs/plans/archive/` with a triage-record row. Decision numbers
  remain citable. Path references updated (plans manifest,
  structures-implementation plan, BACKLOG, slots.ts header comment).
  BACKLOG head re-sequenced to the maintainer-ratified tranche plan
  (A: docs closeout; B: C7.2 kind residue; C: B-027 equality-first).
- **B-031 — proving primer verified against the v2 kernel.**
  `docs/proving-in-allegro.md` surface is current (refinements via `&`,
  no fluent API, no MultiValue/NominalType); a smoke file of the
  primer's own examples (F1 PE-discharge, F2 `proof_refines`, F3
  combinators + `by`, F5 `prove_for_all_bool`) discharges end-to-end.
  `bench/` re-baselined: reference/auto-PE/gate baselines healthy.
- **B-003 — grammar-formalism sync.** `docs/grammar-formalism.md` gains
  the shipped Phase 6/7 semantics: §6.2 base-chain compatibility
  (`E_INCOMPATIBLE_GRAMMARS`, prefix rule, no transitive re-export),
  the `use` activation surface (superseding the `use_grammar`
  spelling), and a new §7.5 inventory of shipped diagnostic codes
  (analyzer structural checks + `use`-time cross-fragment validation,
  with the `W_ALT_OVERLAP` opt-in caveat).
- **B-004 — effects nits closed.** Silent-capture rationale for
  explicit `[e: Effect]` recorded in `docs/design/standard/effects.md`
  §2 (bare `f: e` would capture an in-scope binding; shipped
  auto-promotion is deliberately `opaque`, stricter than the plan's
  fresh-variable equivalence). The archived P9 `applyComposed`
  compile-time-tracing hypothesis is filed as resolved — validated by
  construction by PE-driven inference (Slice 2 F1–F3).

## 2026-08 — C7.1: The MultiValue kind retires (D15 executed; D46; B-088) — the original thesis complete

The chunk the whole journey pointed at: MultiValue and Context are
gone as kinds; what remains is Structure + Scope over one substrate.

- **The carrier** (D15): a typed scalar / typed function / residual-
  with-components is a TRANSPARENT STRUCTURE — empty data plane +
  `primary` — answering the one structure kind. Host-side discriminant
  is primary presence (`isCarrier`); `MultiValueType` survives as the
  carrier's static type. `evaluate` re-evaluates carrier primaries
  through the C4.3a merge policies; `isResolved` follows the primary;
  `makeMultiValue` stays the one chokepoint (records derive, carriers
  re-wrap their inner data — W1 —, leaves take the carrier).
- **`ValueKind.MultiValue` deleted**; the compiler-driven audit
  re-routed ~120 sites across 14 files. Two hazard classes the audit
  could NOT see, caught by the suite: four pre-existing duplicate
  `case Context` clauses silently shadowing the new carrier cases (JS
  allows duplicate switch cases), and three stealth STRING-LITERAL
  kind comparisons (`v.kind === "MultiValue"`) in tree-builder's
  isPrimitiveCall, resolvePrimitives, and markTailCallsInValue.
- **`ValueKind.Context` → `ValueKind.Structure`** (D25's name
  retirement completed; 201 sites); `ContextValue` aliases
  `StructureValue` transitionally.
- **`NominalType` retired** (~50 sites → `Type`): after D44 there is
  no nominal checking left for the name to name.
- **W1/W5 restated**: carriers never nest; a carrier's data plane is
  EMPTY. cacheKeyOne keys carriers by their data (the empty-bindings
  collision pinned out). CLAUDE.md's "Seven Value Kinds" reframed as
  representations + computation forms with the D46 definitional
  ladder; `kind` demoted to host discriminant.

basics.alg byte-identical. 1052/1052 green.

## 2026-08 — C6.3: Proof re-derived, kernel-private authority; slot sweep (structures Phase 6, B-026; M1 exit criterion)

Phase 6's validation criterion met: Effect AND Proof rebuilt through
the kind recipe with zero hand-rolled residue in their kind structure.

- **Proof is a kind by construction**: draws Type's kind-member symbols
  (`Proof subtypeof Type` by membership) and declares its instances'
  fields — the D39 Proof table EXECUTED: `proposition` / `reason` /
  `counterexample` / `lhs` / `rhs` are plain instance-data bindings
  (typed Strings where textual) declared as Field members on the kind,
  so `t.proposition` dispatches. The five `__*` proof rows leave the
  registry; the physical renames happened inside the slots accessors
  (consumers untouched).
- **Constructor authority is KERNEL-PRIVATE** (D40 R2 / D45): Proof
  holds NO `construct`. `Proof.define(...)` refuses ("holds no
  constructor authority"); `Proof(...)` residualises inertly (ordinary
  PE — no shape stamp, no discharged channel, `instanceof Proof`
  false); drawing Proof as a bundle mints a non-conforming lookalike
  (kind-API symbols are meta-filtered from draws) whose instances never
  hold the discharged channel. The only mint is `makeProof` holding the
  module-private discharged writer — holding a kind's construct IS
  holding its mint, and not exporting it IS unforgeability: an ordinary
  capability instance, not a special arrangement.
- **Forgery battery re-run**: forge-a-proof attempted through every
  kind surface (define, call-as-function, bundle-draw, object literal)
  — all dead; the C1.4 construction gates stand.
- **Slot sweep** (D39): `__invariantsList` row executed (no writer
  since C6.1b); `__effect_kind` already retired at C6.2; the
  Method/Field descriptor taxonomy's refines edges removed and
  `MemberType` DELETED (the D44 audit's last taxonomy item);
  `SLOT_KEYS` trimmed to match. Registered residue, each pinned to its
  owner's future re-derivation: `__isGeneric` (GenericType),
  `__effectvar:` / `__effectVarParams` (function-type generic-param
  structure).
- Battery additions: Proof-in-the-tower matrix, the four forge surfaces,
  and a sweep test pinning the executed dispositions.

1051/1051 green. Decisions presented to the maintainer at this
landing: MultiValue-kind retirement; NominalType alias disposition.

## 2026-08 — C6.2: Effect re-derived through the kind recipe (structures Phase 6, B-025)

D40 executed: the first external validation of the kind tower — Effect
rebuilt with zero hand-rolled residue in its kind structure.

- **Effect is a KIND by construction**: it draws Type's kind-member
  symbols, so `Effect subtypeof Type` holds by membership and
  `isKind(Effect)` is true with no whitelist — `Effect.define("net")` /
  `Effect("net")` work through the same construct-authority machinery
  as every other kind.
- **An instance IS its label set** (the D39 `__effectBound` note's
  collapse): `pure` = {} (bottom), `Effect("io")` = {io}, `opaque` =
  top. Instances stamp `__type = Effect`, carry `kind`/`labels` as
  declared data fields, and are MEMOIZED by label set — label-set
  identity is physical identity (`Effect("io") === Effect("io")`; both
  operand orders of a conjunction are one Context), so D37 equality
  falls out of identity.
- **Members live once, on the kind** (§6 delta 7): `io.union(time)`
  dispatches through io's shape exactly as `42.toString()` dispatches
  through Int. buildEffect's per-instance member copying is DELETED;
  so is the `__refines = Effect` chain hack (the D44 audit's "three
  effect-lattice sites scheduled to die" are dead).
- **Anonymous conjunctions land** (D40 R3 — the deferred debt closed):
  `io & time` mints an anonymous Effect instance carrying the union
  label set; typed_amp's opaque coercion is gone. Lattice ops are
  label-set ops — subset = inclusion, union/intersect = join/meet with
  pure/opaque as bottom/top.
- **§6 deltas 6 (pre-approved) landed**: `pure subtypeof Effect` →
  FALSE (an instance does not CONFORM to its kind; `pure instanceof
  Effect` is the check). `pure subtypeof opaque` stays false — the
  C6.1a effect-kind guard is re-derived on the principle that instances
  of an order-carrying kind relate by the KIND'S ORDER
  (`subset_of`/`implies`), never by conformance.
- **D39 Effect checklist**: `__effect_kind` slot RETIRED (→ the `kind`
  field declared on Effect); `__effectBound` derived-at-mint from the
  label set; `__effectLabels` registered as the host-side carrier.
  Remaining for C6.3's sweep: `__effectvar:` markers /
  `__effectVarParams`.
- **formatValue**: type values (values whose meta is a kind) render by
  name — `print(io & time)` → "io & time"; kinds declaring instance
  fields no longer push their instances into the record rendering.

Battery: Effect-in-the-tower matrix, conjunction mint + memo identity
both operand orders, order-vs-conformance split, no-copies/no-chain
pins. 1049/1049 green.

## 2026-08 — C6.1b: The kind tower — Refinement, Interface, construct authority, fluent API removed (structures Phase 6, B-024 part 2)

D45's kind tower: kinds are just types, one construction surface at
every meta-level.

- **Refinement** — a SUB-KIND of Type: draws Type's kind-members
  verbatim (conformance by symbol membership) and declares the instance
  data every refined type carries (`refines`, `constraints`). Refined
  types answer `__type = Refinement`; `type of (Int & _ > 0)` IS the
  Refinement kind.
- **Interface** — a REFINEMENT of Type, built through the refinement
  mint itself: member-transparent over Type's kind API, restricted by
  the declaration-only predicate (an instance of Interface holds no
  value-constructor authority). Interfaces answer `__type = Interface`.
- **The half-lotus matrix** (ratified, now a boundary battery):
  `Type : Type` ✓, `Refinement : Type` ✓, `Interface : Refinement :
  Type` ✓, `Refinement : Interface` ✗ — the last cell answers through
  C3.3's predicate re-check seeing Refinement's constructor authority.
- **Constructor authority (D45 R2)**: `construct` is the per-kind
  minting member; call-as-function invokes it at every level —
  `Type({v: Int})` mints a record type, `Refinement(Int, p => p > 0)`
  is the mint `&` sugars, `Interface(spec, ...bundles)` mints
  declarations. `define` is a pure NAMED FACTORY: validates the
  dispatch target is a kind, delegates to its construct.
- **The fluent API is REMOVED** (decisive, no sugar):
  - `where`/`invariant` → the `&` mint. Chained `&` (left-assoc) gives
    per-clause layers with domain-rendered counterexamples
    (`refinement check failed: expected ≥ 1 (got 0)` replaces
    `invariant 1 failed`); record predicates reach fields through `_`
    (`Type.define({lo, hi}) & _.lo <= _.hi`). `buildInvariantedType`
    deleted; `__invariantsList` has no writer (slot swept in C6.3).
  - `interface` → `Interface.define(spec, ...bundles)`;
    `buildInterfaceType` generalized from single parent to drawn
    bundles.
  - `mixin` → method-valued `define` spec entries (`{x: Int, mag:
    (self) => ...}`); function VALUES are methods, function TYPES
    (`toString: Function`) stay fields; a same-name method OVERRIDES
    the drawn member (C5.2b declaration-override supersedes mixin's
    refuse-same-name — flagged for ratification). Reusable mixins are
    BUNDLES: a methods-only spec mints a pure member set (no
    auto-generated construct/toString — which also keeps bundles
    diamond-safe), drawn like any bundle and conferring declared
    conformance. Methods on refined scalars go through the Refinement
    spec's non-reserved entries. `buildMixinType` deleted; its core
    survives as `buildMethodLayer`.
  - `preserveOps` → the Refinement spec's `preserve` option
    (`Refinement.define({refines, where, preserve: ["add"] | "all",
    ...methods})`).
- **Supporting**: `&`'s left-operand gate is kind-conformance
  (`isTypeMeta`) so chained refinements stay types; the C3.3 subtypeof
  guard generalized (ANY predicate-carrying expected demands
  identity/chain — membership cannot discharge a predicate);
  introspection's `__invariantsList` rendering removed; `Refinement` /
  `Interface` bound in the standard extension.
- **Deferred with design sketches**: `distinct` as a Distinct kind
  (shared member set, fresh identity) and `constructor`'s spec —
  recorded in structures.md §9; C6.2's Effect re-derivation may inform
  both.

Follow-up (maintainer rulings, same chunk): (1) override-on-draw
ratified WITH order-insensitivity — bundle order in a define call is
NOT significant: a spec declaration binds ALL keys of a multi-bound
drawn target, and two bundles providing different descriptors for one
symbol error at define time in either order ("bundle order is not
significant; resolve by declaring '<member>' in the spec" — the spec
declaration is the explicit resolution and owns its keys).
(2) Refinement spec shape ratified as-is. (3) Kind-hood: no reified
`Kind` (D7), and no convention either — a kind is exactly a type
holding Type's kind-member symbols, so `K subtypeof Type` is the kind
test from Allegro; `isKind` becomes that conformance predicate
(replacing the whitelist). Battery: order-swap symmetry, both-ways
conflict, spec resolution, kind test.

Landed in two commits (kind tower + construct authority ecc83fa; fluent
removal + migration ca725ea) plus the rulings follow-up. 1048/1048
green (1049 with the order battery).

## 2026-08 — C6.1a: Unified conformance, `__refines`, and `Type.define` (structures Phase 6, B-024 part 1)

The D44/D45 implementation slice: inheritance dissolves; one
construction surface.

- **One conformance check** (`shapeAwareSubtypeof`): identity → loose
  base-name path (anonymous expected) → `__refines` chain → symbol-
  identity membership over `__members`. `nominalSubtypeof` (the name
  walk) is DELETED — there is no declared is-a edge outside refinement.
  Two guards preserve ruled pre-C6.2/C6.3 semantics: effect types stay
  chain-only until Effect is re-derived through the kind recipe, and
  predicate-carrying shapes keep C3.3's construction-through-chain
  `instanceof` (`5 instanceof PI` stays false untagged).
- **Name-stable per-type member scopes**: built-ins declare members in
  their own scopes (`<type#Int>::add`), so near-identical built-ins
  never conform accidentally (`3.14 instanceof Int` → false). Bound
  user types stabilize their construction-time counter scope onto the
  declaration site (`<type#<main>::Point>`) at auto-naming
  (`stabilizeTypeMemberScope`) — fixpoint re-evaluation of a
  declaration converges instead of minting fresh symbols per pass.
- **`__extends` → `__refines`**: the physical edge is the refinement
  relation (D44). Writers narrowed to refinement layers only —
  `buildRecordType` / `buildInterfaceType` mint NO edge (composition
  draws member symbols; conformance is membership, not ancestry).
  Remaining writers: `buildRefinedType` (legitimate), the descriptor
  taxonomy (dies C6.3), `buildEffect` (dies C6.2).
- **`Type.define(spec, ...bundles)` replaces `extend`** (D45,
  decisive — no sugar): self is the KIND, the spec declares fields,
  bundles are drawn member sets. `X.extend(spec)` migrated to
  `Type.define(spec, X)` across ~42 sites (tests/*.alg, lib/math.alg,
  test.ts, boundary-tests, web sandboxes, docs). Non-kind dispatch
  (`Int.define(…)`) errors with the migration form. Multi-bundle
  interface diamonds resolve per-member via draw-from; two concrete
  bundles with distinct same-named symbols (every record's own
  `toString`) error explicitly at define time — D44's no-silent-
  linearization rule, surfaced.
- **Boundary contract asserted**: define's three forms (fresh, drawn,
  interface diamond) + no-refines-edge invariant; non-kind guidance;
  explicit concrete conflict; `extend` gone; per-type scope keys; the
  stabilized-scope declaration-site invariant.

Landed in three commits (unified conformance f8e6af9; rename 9d70ca1;
define + migration). 1048/1048 green.

## 2026-08 — C5.2c: The declared-conformance split (structures Phase 5, B-023 part 3; B-023 complete)

The ratified conscious delta lands (D30; migration pre-approved at the
C5.2 briefing, sequenced flip-last per ruling R3).

- **Interface conformance is DECLARED**: the check is symbol-identity
  membership — every member symbol the interface declares must BE a
  member symbol of the actual type. A type conforms by DRAWING the
  interface's symbols (`Point = HasXY.extend({x, y})` binds them);
  spelling the same member names is no longer enough. `42 instanceof
  Printable` is now false: Int spells a `toString` but never declared
  Printable's symbol.
- **The loose path stays**: `~T` structural wraps and anonymous inline
  types match by base-name projection — the explicit duck-typing
  surface, aimed at data values. `structuralWrap` now erases the
  `__interface` marker along with the name, so `~Printable` projects an
  interface into the loose world (`v: ~Printable` accepts 42).
- **Migration per the pre-approval**: `tests/interfaces.alg` rewritten
  to document the split (accidental → false; declared via
  extend-the-interface; `~T` duck-typing); `tests/typed-types.alg`'s
  accidental assertion flipped with a comment; the two test.ts
  accidental-conformance tests reframed as declared/loose pairs;
  CLAUDE.md's interface + nominal-vs-structural sections and syntax
  examples updated.
- **Boundary contract asserted** (the plan's C5.2 matrix): a same-named
  member from an undeclared context does NOT satisfy an interface
  check; `~T` still matches it; the wrap provably erases the marker.
- **Harness fix surfaced by the flip**: the legacy grammar2 end-to-end
  harness (`evalStandard2` in test.ts) discarded evaluation results, so
  every reference re-ran construction expressions — re-running
  `Type.interface(...)` mints a fresh member scope, making
  symbol-identity conformance spuriously fail against a second
  construction of the "same" interface. It now writes evaluated values
  back through the eval ctx, mirroring evalSource's loop (the real
  pipeline was never affected).
- Residue (recorded per ruling R3): retroactive conformance of built-in
  types to user-defined interfaces needs partial type declarations —
  until that surface exists, `~T` is the duck-typing path for core
  types.

1 new boundary test (the declared-vs-loose matrix); 1046/1046 green;
tsc at the 4-error rootDir baseline. B-023 and the C5.2 chunk are
complete.

## 2026-08 — C5.2b: Draw-from binding (structures Phase 5, B-023 part 2)

D30's draw-from lands: member declarations resolve their SYMBOL at
construction time instead of blindly minting names.

- **`drawMemberKey(drawnContexts, baseName, localScope)`** — the
  resolution: a base name matching exactly one drawn (parent/base)
  member BINDS that symbol, so overrides keep member identity (Dog
  re-declaring Animal's `name` stores under Animal's key; a record's
  `toString` binds the parent's toString symbol; a preserveOps lift
  binds the parent op's symbol — asserted by the battery); zero matches
  mint a TYPE-LOCAL symbol in the type's own member scope; several
  distinct targets error per §5 (a descriptor multi-bound to several
  symbols dedupes to ONE target and stays legal).
- **Per-type member scopes** (`<type:N>`, per-construction counter —
  the user-visible name arrives after construction via auto-naming, so
  scopes cannot key on it; name-stable scopes integrate with module
  FQNs in a later chunk; nothing compares type-local symbols across
  evaluations yet, documented in symbols.ts).
- **Lookup generalizes**: `typeMethod`/`typeMemberDescriptor` do a
  kernel-scope fast path (the hot built-in dispatch case) then a
  base-name projection scan; multiple DISTINCT targets under one base
  name is the §5 ambiguity error at the access surface — the diamond
  machinery is live and tested even though no surface syntax can
  produce a diamond yet.
- **`structuralSubtypeof` compares by explicit base-name projection** —
  behavior-preserving under per-type scopes; this is the marked C5.2c
  flip site (declared conformance moves to symbol identity, leaving
  this function as the loose `~T`/anonymous path).
- Mixin's conflict check is projection-based (multi-bind-aware);
  mixin methods mint type-local symbols (new members by definition).
  preserveOps' unfiltered member copy is fixed — Type's meta-method
  names no longer ride into instance member sets (the latent wart the
  re-keying made visible).

3 new boundary tests (draw/override identity + local-scope
distinctness; preserveOps symbol-drawing + wart fix; multi-bind
one-target resolution + distinct-target ambiguity error); 1044/1044
green; tsc at the 4-error rootDir baseline.

## 2026-08 — C5.2a: Symbol-keyed member storage (structures Phase 5, B-023 part 1)

The C5.2 briefing's rulings R1–R6 were ratified (recorded in the plan §6
and structures.md §5) and the first sub-chunk lands: member sets are
SYMBOL-KEYED, observable-zero by construction.

- **Storage**: member descriptors live under the member symbol's FQN
  string (`<kernel>::add`, …) — interning makes string-key identity
  symbol identity, so the host map stays `Map<string, Binding>`. Every
  member registers in the kernel scope (ruling R5), so each base name
  projects to exactly one symbol and no ambiguity is possible yet;
  C5.2b generalizes to drawn/type-local scopes via `projectBaseName`.
- **One write chokepoint** (`addMember`) covers every origination site
  (record fields, interface declarations, preserveOps lifts, mixin
  methods, Type's ten meta-methods, Effect's lattice methods,
  buildType). Inheritance copy loops carry FQN keys verbatim; the
  name-based logic projects: meta-method exclusion filters and
  formatValue's instance reads via `fqnBaseName`, the mixin conflict
  check and preserveOps' parent-op lookup via `kernelMemberFqn`.
  `typeMethod`/`typeMemberDescriptor` keep their name-based signatures —
  projection happens inside. New `memberDescriptorsOf(type)` gives
  tests/tooling a baseName→descriptor view so nothing reaches through
  raw bindings anymore.
- **Ruling R1 enforced**: typeShape's member-transparency-by-identity is
  untouched — refinement/distinct layers still share the parent's
  member-set object, and the two former IMPLICIT sharers
  (buildInvariantedType, structuralWrap — blanket copy loops) now share
  explicitly via `setMembers(child, parentMembers)`.
- **Pre-fix**: `makeTypedBinOp` now dispatches through
  `typeShape(leftType)`, matching the evaluator's PRIM_TO_METHOD path —
  the two agreed before only via the sharing invariant.
- **Ruling R4 applied**: the symbols.ts ambiguity message no longer
  promises the deferred `x[ns.name]` qualification syntax.
- Unions stay outside member storage (ruling R6, re-derived at C6);
  instance field storage stays string-keyed and pattern matching stays
  on the loose base-name path (ruling R2 non-goals).

2 new boundary tests (FQN-keyed storage + projection roundtrip; sharing
invariant across refined/invariant/wrap layers); 8 test.ts
representation-reaching sites migrated to the projection view
(assertions unchanged); 1041/1041 green; tsc at the 4-error baseline.

## 2026-08 — C5.1: FQN symbols — the identity substrate (structures Phase 5, B-022)

Phase 5 opens with the symbol identity substrate (`src/symbols.ts`),
implementing structures.md §5 with the D42 wire rule designed in from
day one.

- **Identity = FQN, enforced by interning.** `registerScopeSymbol(scope,
  base)` returns THE symbol for `scope::base` — the same object across
  re-evaluation, module reload, and fresh loader instances (the intern
  table outlives them). `SymbolValue` gains an optional `fqn`; the base
  name stays the convenience projection (printing, lexical resolution).
  Parser-minted symbols (`makeSymbol`) remain TRANSIENT references with
  no identity beyond their occurrence — §5 explicitly allows scope
  binding keys to stay strings, so the hot resolution path is untouched.
- **Registration is automatic at the defining scope.** `evalSource`
  gains a `moduleFqn` parameter (default `<main>`) and registers every
  top-level binding name under it; `ModuleLoader` passes the resolved
  module file path (§5's default scope FQN).
- **D42 export partition.** Registration and exporting are separate acts
  on separate maps. `markExported` (called by the module loader for the
  module's public interface) populates the export registry;
  `symbolFromWire(fqn)` answers ONLY from it — a private
  (registered-but-not-exported) or unknown FQN resolves to null, and a
  failed rebind mints nothing (asserted by an intern-count check).
  `symbolToWire` is the FQN; serializing a transient symbol is an error.
- **The §5 governing rule as one resolver.** `projectBaseName(candidates,
  base, qualifier?)` — zero targets → none; one distinct target → match
  (a member multi-bound to several symbols dedupes to ONE target, §8);
  multiple distinct targets → explicit qualification required, else an
  ambiguity error naming every candidate FQN. The battery runs the same
  matrix through three surface framings (import resolution, member
  binding, dot access) and asserts identical outcomes — C5.2 adopts the
  resolver at the latter two surfaces when members become symbol-keyed.

5 new boundary tests + 1 module-loader integration test (registration +
export partition + reload identity end-to-end); 1039/1039 green; tsc at
the 4-error rootDir baseline. Deferred to C5.2: symbol-keyed members,
`x[ns.name]` qualification syntax, draw-from binding.

## 2026-08 — C4.3c: Transparency at the eager boundary — primaryOf retired (structures Phase 4, B-021 part 3; B-021 complete)

The last C4.3 sub-chunk lands scalar transparency (R4) and closes B-021.

- **The eager boundary no longer strips.** `applyPrimitive` passes eager
  impls the FULL values — channels intact; impls read data through the
  accessors (`dataOf`/`asBits`/`asCtx`). The C1.2/C1.3 accessor
  migration made this a zero-change flip: no production impl read args
  raw, so the suite was green on the first run. The propagation table
  alone governs channels (D28).
- **`channelAware` registration mode DELETED** — it is now everyone's
  default. The seven registrations (proof_refl/sym/trans/cong,
  prove_for_all_bool, prove_induction, certificate_peek) became plain
  eager primitives; the `PrimitiveFunctionValue.channelAware` field and
  `makePrimitive`'s fifth parameter are gone. The D3 lazy/eager
  arg-shape asymmetry with it: `lazy` is purely an evaluation-control
  choice (receive arg ASTs + evalFn) — the "register lazy to dodge
  stripping" idiom is dead.
- **`primaryOf` RETIRED as a name.** `dataOf` is the one data-plane
  accessor — defined in types.ts (identity for everything except a
  transparent scalar structure), re-exported through slots.ts. The
  remaining ~380 references (test suite + one import) renamed
  mechanically; no `primaryOf` identifier survives in code.
- Typed scalars keep the `ValueKind.MultiValue` tag per ruling R6 — the
  tag now simply means "transparent scalar structure"; its retirement is
  expected with the C6 kind recipe. The evaluator's MV re-evaluation
  merge stays as the table-driven merge policy (it is the R3 rule, not a
  nesting hack). Physical plane separation inside structure.ts (primary
  as a channel-map entry) remains an internal-layout follow-on.
- **Tier-0 touch-up flagged for maintainer ratification** (not bundled,
  per plan §8): PROCESS.md's evaluator-invariants bullet "Eager
  primitives receive `primaryOf`'d args … must be registered lazy" now
  states a false invariant and needs its propose-and-ratify replacement.

2 new boundary tests (an eager impl observes its args' channel plane;
proof combinators are plain eager and still see Proof channels);
1033/1033 green; tsc at the 4-error rootDir baseline.

## 2026-08 — C4.3b: MV-over-Context flattened — records answer Context (structures Phase 4, B-021 part 2)

The MultiValue-over-Context wrapper is gone: channels attach DIRECTLY to
record/type structures, so a typed object is one structure with both a
slot plane and a channel plane (D15/D17 — the first half of the
transparency cutover; scalars follow at C4.3c).

- **One chokepoint**: `makeMultiValue` with a Context primary flattens
  through the new `structure.ts deriveWithChannels` — a copy-on-write
  derive sharing the source's data planes by reference (immutable, D22)
  with the given channel map attached. The given map is AUTHORITATIVE
  (writers pre-clone via the now-total `cloneComponents`, then
  set/delete — merging in the derive would make channel deletion, e.g.
  `clearOccurrenceBound`, inexpressible). Every wrapper site (withType,
  withEffects, withPredicates, channel writers, mv_set, export) flows
  through it, so MV-over-Context is UNCONSTRUCTIBLE — asserted by the
  extended W1 invariant.
- **Records/arrays/modules/proofs answer `ValueKind.Context`** with
  `dataOf` as identity. The dense region (C4.2) coexists with the
  channel plane on the same structure.
- **Type bindings ARE the internal singletons**: `wrapType` is identity
  — `Int` is IntType itself. A bare type Context already answers its
  meta-type through the `__type` binding-plane fallback, so `type of
  Int`, `Int instanceof Type`, and meta-method dispatch read the same
  storage internal code uses, and identity short-circuits
  (`actualType === expectedType`, member-set sharing, memoization) hold
  by construction.
- **`getType` is total** (reads `channelReadRaw(v, "type")` for any
  value). One consequence: bare Contexts carrying `__type` now route
  through type_dispatch's TYPED path instead of the untyped meta-dispatch
  fallback — the typed path's `typeMethod` fallback learned to self-bind
  ComposedFunction methods so the two paths agree on the returned shape.
  One legacy-exact carve-out: `unifyTypes` keeps its MV-only actual-type
  participation (a bare type Context's meta-type is not what name
  unification compares; the call-site checkArgType does the real check).
- **Channel accessors are universal**: `channelReadRaw`,
  `componentsView`, `cloneComponents`, `channelList` answer any
  Structure (lazy — plain contexts and scopes pay one undefined check).
  ~20 MV kind guards widened across evaluator (dispatch gate, viral
  scans, residual typing), primitives (formatValue, mv_get/mv_set/
  mv_components, `Y of x`, eval_if error guard, type_dispatch viral
  branch, makeTypedBinOp), modules (export detection), totality
  (when-subject type resolution), refinements/effects readers
  (predicatesOf/domainOf/occurrenceBoundOf/effectsOf), and
  `applyBoundaryBound` (the C3.2 availability gate applies to flattened
  records).
- **Hazard A resolved**: the six `__construct` re-tag sites
  (refined/invarianted/distinct/preserveOps/mixin/custom-constructor)
  switched to `withTypeReplacing` — they are construction points
  re-tagging a parent-constructed instance, and `withType`'s
  shape-immutability guard is now LIVE for Contexts (it was dead before
  because a Context input's channels lived on the discarded wrapper).
- **R5 reframe (pre-approved)**: W5 restated — the DATA planes are
  role-exclusive (Context never carries `primary`; MV never carries
  slots), the CHANNEL plane is universal. W1 extended: an MV primary can
  never be a Context. W3 covers Context-role component keys + recurses
  into their values. One internals-shaped test updated (record instance
  kind: MultiValue → Context — the chunk's stated outcome).
- Scope guard: `deriveWithChannels` rejects evaluation scopes (channels
  never attach to scopes — C2.1 plane rejection).

6 new boundary tests (records/arrays answer Context + print correctly;
type-binding identity; `type of` uniformity; unconstructibility + data
plane sharing; channels survive withPredicates); 1031/1031 green; tsc at
the 4-error rootDir baseline.

## 2026-08 — C4.3a: Merge-policy activation — error virality + effects union (structures Phase 4, B-021 part 1)

The first C4.3 sub-chunk activates the principled propagation rules that
C1.5 recorded but deferred (maintainer rulings R1–R3, ratified 2026-08 at
the C4.3 briefing; recorded in the implementation plan §6).

- **R1 — error virality rides every residual hop.** The legacy behavior
  lost the error channel after the first residual hop: `applyPrimitive`'s
  unresolved-args early return ran BEFORE the viral scan, so
  `(error "boom" + 5) * 2` produced a bare residual with the channel
  dropped. The viral scan now runs first. Two further drop sites fixed
  with the same rule: the unresolved-application residual path in
  `evaluateExpr` (an error-carrying callee or argument propagates — this
  is how `r.toString()` on an error-carrying residual now works) and
  `type_dispatch`'s unresolved-object residual (the dispatch residual
  carries the object's viral channels; RESOLVED error values still
  dispatch normally, so Error's own members stay callable).
- **R2 — error-in-if propagates.** `eval_if` checks the evaluated
  condition for an error channel before branching: `if (error "boom")
  then 1 else 2` now propagates the error instead of silently taking the
  else branch on the error value's meaningless primary.
- **R3 — effects union on MultiValue re-evaluation.** The
  flatten-on-re-evaluation path in `evaluate` now merges union-rule
  channels via the registry-installed channel merge (effects observed
  before re-evaluation are facts, not stale guesses); all other channels
  keep inner-shadows-outer (fresh type info replaces stale).
- **Differential fixtures updated** (pre-approved test-condition changes
  per the briefing): `err-viral-chain`, `err-in-if-cond`,
  `err-through-method` now pin the principled `fmt=error(boom) |
  err=boom` behavior. The C1.5 "recorded warts" comments in slots.ts and
  boundary-tests.ts updated to match.
- **Scaling-test robustness fix** (measurement methodology, not a
  behavior condition): the C4.2 O(1) index-access test compared one
  timed round of cache-resident (200-element) vs cache-missing
  (200k-element) access with a 5× threshold — the honest cache-miss
  ratio is 2–8× depending on heap state, so the test straddled its own
  threshold (confirmed by A/B: baseline and patched trees both produce
  ratios across the band in isolation). Now min-of-3 rounds per side
  with a 20× threshold — far above cache noise, far below the ~1000×
  an O(n) scan would show.
- Rulings R4–R6 recorded for the following sub-chunks: strip-semantics
  retirement and the non-nesting reframe land at C4.3c; the
  `ValueKind.MultiValue` host tag stays through C4.3 but is not expected
  to survive beyond C6 (retirement is an expected outcome of the C6
  kind-recipe work — exact chunk decided at the C6.1 briefing).

2 new boundary tests (deep-chain virality; effects-union flatten);
1025/1025 green; tsc at the 4-error rootDir baseline.

## 2026-07 — C4.2: Arrays as numeric structures — the dense region (structures Phase 4, B-020)

D18 lands physically: array contexts store their elements in the
Structure's DENSE REGION — a plain JS array — with no per-element Binding
objects, no decimal string keys, and no `__length` binding. The slot
count IS `dense.length` (cached as Bits on first read).

- **Single chokepoint, sole storage**: recon confirmed every
  numeric-keyed context flows through `makeRawArrayCtx` (user arrays,
  generic params/args, function param-type lists) and that NOTHING
  mutates an array context after construction — so the dense region is
  the only storage, not a mirror. `makeDenseArrayCtx` is the new
  types.ts factory shim.
- **Compatibility by lazy view**: `bindings`/`bindingList` on the
  Structure class are now accessor-backed; a dense structure materializes
  the legacy map/list view (elements under string keys + `__length`) on
  first access and caches it — sound because arrays are immutable (D22).
  Hot paths never touch it: ~10 element-access sites migrated to the new
  slots.ts accessors (`indexGet` / dense-aware `getSlotCount` /
  `elementsOf`), and every slot PROBE (`hasShapeSlot`, `getName`, … — the
  auto-naming pass probes every binding value) answers dense structures
  without materializing, since they can only ever hold numeric keys +
  `__length`. The boundary test asserts a full bracket/length/map/reduce
  pipeline runs with the view still unmaterialized.
- **W6 dense-view-coherence** joins the walker: whenever a view exists it
  must agree with the dense region (the region is authoritative).
- **Boundary tests**: O(1) index access verified by a scaling test (50k
  reads on 200 vs 200,000 elements, length-independent); array/object
  duality (the string-key protocol answers from the materialized view,
  dense stays authoritative after); existing arrays.alg / collections /
  HOF tests as the differential oracle — all pass untouched. A/B
  benchmark: mixed array+recursion workload ~3% faster than pre-C4.2.

1023/1023 green.

## 2026-07 — C4.1: Structure kind — one host representation behind the factories (structures Phase 4, B-019)

The representation swap begins. Every MultiValue and every Context is now
an instance of ONE host class — `Structure` (`src/structure.ts`) — with
`makeMultiValue`/`makeContext` as the promised constructor shims. The
public field surface is unchanged (the 1000-test suite is the oracle);
the object layout is now a single declared hidden class covering both
roles plus the scope fields, which the A/B benchmark shows is ~7% FASTER
than the per-shape object literals it replaced (the I1 hidden-class
motivation, paying out at step one).

- **Role fixed at construction** — `kind` is a plain field; the
  evaluator's hot switch is untouched. Channel plane = `components`
  (MultiValue role), slot plane = `bindings`/`bindingList` (Context
  role); physical separation and the direct shape-ref field land inside
  structure.ts with C4.3/C5 where the interception points exist.
- **Six bypass sites converted** to the factories (encodePredicates /
  encodeDomain / encodeEffects stashes, the evaluator's placeholder
  domain ctx, the channel-writer wrap in slots.ts, proven.ts's
  spread-clone). slots.ts + structure.ts are the two sanctioned
  representation modules in the lint baseline.
- **Invariant battery grows**: W4 structure-kind (every corpus
  MultiValue/Context is a Structure instance — a stray literal anywhere
  fails the walk), W5 role-transparency (D17: MultiValue role carries no
  slot plane, Context role no primary), plus three C4.1 tests — factory
  construction across roles (typed literal, object, refined type, eval
  scope), hostile data keys named after channels living on the slot
  plane without touching the channel plane, and the D22 future-cell
  carve-out (in-place monotonic resolution).
- **Immutable bit (D22)**: declared state — born-immutable default with
  the standing carve-outs (scopes as mutable evaluator state, future
  cells, grandfathered construction-phase population) documented and
  asserted; freeze-enforcement tightens at C4.3.

1020/1020 green; perf floor clean.

## 2026-07 — C3.3: Observation effect — instanceof is a pure re-check; certificate_peek is effectful (structures Phase 3 complete, B-017)

D36's third leg: **re-checking is pure; observation is effectful.**

- **`instanceof` on a member-transparent refinement is now a PURE
  PREDICATE RE-CHECK** from data — recursive base check down the
  refinement chain, then each layer's predicate (the identity/domain fast
  paths are sound over immutable data). This fixes a real congruence
  violation: previously `PositiveInt(5) instanceof PositiveInt` → true
  but `5 instanceof PositiveInt` → false — a certificate peek disguised
  as a type check, letting two shape-and-data-equal values answer
  differently. Now both answer true (and `-3` answers false, by
  re-check). Nested refinements re-check the whole chain
  (`150 instanceof SmallPos` → false). **Shape-minting refined types
  (preserveOps) stay nominal** — instanceof on a SHAPE is a shape
  question, per the C3.1 typeShape boundary (`8 instanceof PI` remains
  false; construction is the way in). No existing test asserted the old
  peek semantics; the flip is the chunk's mandated behavior change.
- **`certificate_peek(v, T)`** — the provenance question ("was v
  CONSTRUCTED as T?") — is a new primitive, eager but channel-aware (the
  certificate rides the value's channels), tagged with the **"observe"**
  effect label. It distinguishes §7-equal values — exactly what a pure
  function must not do — so the effect calculus prices it: a function
  using it infers `observe` and cannot claim `effects pure`; F3a
  compile-time deferral applies automatically. The walk covers refinement
  certificate layers only (shape questions belong to instanceof).
- **Congruence + equality groundwork** (for the D37 equality plan):
  boundary tests assert pure-op interchangeability over §7-equal pairs
  (arithmetic, toString, ==, instanceof) and that equality ignores
  knowledge (`PositiveInt(5) == 5`).

Demo `tests/observation-demo.alg`; 3 new boundary tests; sandbox example
extended. **Phase 3 (shape/knowledge split) is complete over the current
representation** — physical knowledge-channel storage moves at C4.
1017/1017 green.

## 2026-07 — D41–D43: S3 access control settled — mediated member protocol, evidence is possession, extensible modifiers (B-016a session)

The B-016a design session concluded; outcome ratified by the maintainer
and recorded as three decision-log entries + the structures.md §6
pipeline block and §13 rewrite.

- **D41 — mediated member protocol.** Member access is ONE PE act with
  four stages: project (text → symbol, §5 base-name rules — only the
  base resolver does name resolution) → availability (knowledge, D36) →
  mediate (the shape's `getMember(symbol, instance, context)` maps the
  resolved symbol to an accessor per the member's declared modifiers) →
  dispatch (the accessor runs against the shape). PE folds the pipeline
  when inputs are static — compiler-generated call sites specialize to
  the raw accessor. Today's `type_dispatch` descriptor path becomes the
  default mediator (C6); module types' export-enforcing `__getMember` is
  the protocol's existing production instance. The no-implicit-fallback
  refusal and the confluence invariant extend to mediation.
- **D42 — evidence is possession.** No principal-identity lookup: the
  context argument is evaluator-supplied and contexts are reachability
  capsules (you cannot extend a scope you cannot reach). Default
  evidence is symbol reachability (private = the member symbol stays in
  the defining scope); denial is an availability outcome, static when
  scope + knowledge are static. Wire rule: deserialized foreign-FQN
  symbols rebind only against exported registries. D24 capability
  closures stay as the stronger tier for authority-bearing operations.
  Reachability ∧ availability compose by conjunction (holding
  `Dog::tricks` doesn't help on an Animal-bounded occurrence).
- **D43 — modifiers as extensible member attributes.** private /
  protected / readonly / custom modifiers are Standard-layer attributes
  of member declarations, defined per kind (D40 recipe input), never
  redefinable globally. Static-evidence mediation is pure and folds at
  compile time; non-pure mediation (runtime identity, tracing) is
  ALLOWED but fully covered by the effect calculus — the modifier
  declares its label and enclosing functions can't claim `effects pure`.
  Expected distribution: the vast majority of resolvers are pure
  possession checks. Surface defaults (public-by-default, names-public
  in errors) recorded as proposed, decided at the surface-syntax chunk.

Implementation rides C5 (symbols — C5.1 carries the wire-rule note) and
C6 (default mediator + modifier vocabulary). C3.3 is unblocked. Docs
only — no code change.

## 2026-07 — Availability: terminology + PE-sole-resolver semantics ratified (design delta to §6; S3 reframed)

Maintainer discussion sharpened what C3.2's gate IS. Recorded in
structures.md §6 as the **Availability** block:

- **Availability is a resolution outcome, not a property** — `a.m` is a
  base-name projection (§5); which symbol `m` is, or whether it is a
  string data key at all, is decided by the occurrence's effective
  knowledge, never by the text. Four outcomes: member symbol / string key
  under an open structure's own policy / unavailable (closed type, no
  declaration — the C3.2 refusal; multiple matches → §5 qualification
  error) / undetermined → residual (D11).
- **PE is the sole resolver.** No name table, no second checker — the
  determination is what PE does with a member access under current
  knowledge, firing whenever its inputs land (precompile, module load, or
  after a future resolves). **Confluence invariant** (falsifiable): for
  fixed eventual knowledge, early and late resolution agree. Dispatch is
  stage two of the same act (symbol → implementation, by shape).
- **S3 reframed** (structures.md §13 + the decision doc's S3 item):
  access-control enforcement is NOT "dispatch reads slot attributes" — it
  is PE evaluating the access with the call-site context as principal, in
  the same act. Open questions (principal identity, capability-accessors
  vs declared attributes, static vs residualising denial, authorization
  under knowledge, reflection surfaces vs the C3.3 observation effect)
  recorded there; design session filed as B-016a, sequenced before C3.3.
- **Terminology**: "visibility" is reserved for S3; C3.2's concept is
  availability. Error message renamed (`'tricks' is not available through
  annotation 'Animal'`), comments and demo updated. Doc + rename only —
  no semantic change. 1013/1013 green.

## 2026-07 — C3.2: Annotations as knowledge bounds + narrowing (structures Phase 3, B-016)

Type annotations become what D36 says they are: KNOWLEDGE UPPER-BOUNDS —
member-hiding abstraction boundaries. A Dog crossing `a: Animal` keeps
its shape (dispatch, equality, `when` matching all unchanged) but the
occurrence may only touch Animal's members until narrowed. First
user-visible behavior change of the structures arc, mandated by the
ratified design.

- **Boundary crossing**: `applyComposed` (call-site params) and
  `type_check` (return annotations, binding annotations) stamp an
  occurrence `bound` component (drop-propagation — bounds constrain the
  occurrence, never derived results) when the declared type is WIDER than
  the value's shape, and clear any inherited bound on own-shape crossings
  ("the new occurrence's starting knowledge"). Only named nominal
  concrete types participate — Any, function types, Effect annotations,
  interfaces, unions, and generics are pass-throughs.
- **Visibility gate**: `type_dispatch` refuses members absent from the
  bound's declared surface with a teaching error (`'tricks' is not
  visible through annotation 'Animal' — narrow with \`when … is Dog\`»);
  visible members dispatch through the SHAPE as before (Liskov). Open
  types are exempt: the base Object type (dynamic fields by design) and
  fallback-only types with no declared members (module objects — their
  `__getMember` is already the visibility policy).
- **Narrowing**: a matched `when … is T` type pattern (bare or
  destructuring) lifts the bound within the arm, both subject forms:
  Symbol subjects get an O(1) scope shadow layer (C2.1 machinery — arm
  exit is discard, the else arm keeps the outer view); substituted-param
  subjects get a clone-on-write identity replacement of the subject value
  inside the arm (substitution clones former param positions per call, so
  the walk never touches shared ASTs).
- **The meet never widens**: intrinsic knowledge (refinement
  certificates, predicates) survives passage through looser annotations —
  `PositiveInt(5)` through `x: Int` keeps its certificate; `knowledgeOf`
  gains the `occurrenceBound` carrier and `knowledgeDomain` meets all
  three sources.
- **Delta 5 activated, additive-only**: introspection gains a
  `bound: Animal (annotation)` line on bounded values; every existing
  output is byte-identical. Website sandbox gains a "Knowledge Bounds"
  example.
- **Deferred, recorded in §6's status note**: operator-dispatch
  visibility gating, knowledge-gated downcast refusal at call sites
  (runtime-sound today), record undeclared-field openness.

Demo `tests/knowledge-bounds-demo.alg`; 4 new boundary tests (two-sided
visibility/dispatch matrix, both narrowing forms + arm-locality, boundary
reset, intrinsic survival). 1013/1013 green.

## 2026-07 — C3.1: Shape/knowledge split — two channels, dispatch on shape (structures Phase 3, B-015)

The old `type` channel conflated the declared shape with what's known
about a value (D36). C3.1 splits the READ paths over the current storage;
the physical representation moves at C4.

- **The shape boundary, mechanically**: `typeShape(t)` walks `__extends`
  past member-transparent refinement layers. The transparency test is
  object identity — `buildRefinedType` shares the parent's `__members` by
  reference, so a predicate-carrying layer whose member set === its
  parent's is knowledge; a layer that mints its own member set
  (`preserveOps` lifted operators, `mixin`, `extend`) IS a shape and its
  overrides dispatch (Liskov). Walking a transparent layer can never
  change which member runs — the split defines where shape ends and
  knowledge begins without touching behavior.
- **Two channel reads**: `channelReadRaw(v, "shape")` now returns the
  computed dispatch shape (identity for every non-refined type, so the
  existing meta-type readers are unaffected); `type` stays the raw stored
  view (bound included). New `knowledge` channel (computed) registered;
  `knowledgeOf(v)` returns the unified intrinsic carrier — refinement
  bound (the construction certificate) + predicate set — with
  `knowledgeDomain` (meet of bound domain and predicate domain) and
  `meetKnowledge` (one lattice; the occurrence carrier in the scope facts
  plane merges through the same `mergePredicateSets`).
- **Dispatch reads shape**: `type_dispatch_impl` and the evaluator's
  `PRIM_TO_METHOD` operator dispatch resolve members through
  `typeShape(storedType)`. Observable behavior identical (transparent
  layers share the member object; error messages keep the stored type's
  name); the dispatch/knowledge independence is now structural rather
  than incidental.
- **Shape is fixed at construction**: `withType` — the type channel's
  origination chokepoint — refuses re-stamping a value with a
  DIFFERENT-shaped type. Same-shape re-stamps (refinement certificate
  tagging, preserveOps result re-tagging) remain legal. The guard flushed
  out one real construction path: `typeLiterals` provisionally guesses
  every 64-bit literal as Int, and the `typed_*` wrappers correct the
  guess (an 8-character string literal arrives Int-guessed) — those are
  construction points, now explicit via `withTypeReplacing`.
- **Boundary tests** (6 new): stored-vs-shape reads on refined values
  (shape identity with the base Int object), preserveOps-type-is-a-shape
  (+ lifted op still re-tags), writer refusal on cross-shape re-stamp with
  knowledge re-bounds passing, dispatch under attached knowledge
  (narrowing never changes the member; refined values run the shape's
  methods), certificates riding across a typed function boundary, and the
  knowledge-lattice meet ([≥1] ∧ [≤99] = [1,99]).

§6 delta 5 (introspection output format change) was NOT needed and is not
activated — introspection still renders the stored type; the format
question goes to the C3.2 briefing where annotations make knowledge
user-visible. 1008/1008 green.

## 2026-07 — C2.3b: Resolution unification — future cells + root layering (structures Phase 2 complete, B-013 part 2)

An unresolved binding is now a **future cell**, and there is exactly one
of it per name: the `Binding` object itself carries the reactive state
(`value` — undefined while pending, `incompleteDeps`, `isComplete`), and
the `DependencyRegistry` tracks the SAME objects the eval scope's source
layer holds. The former `ReactiveBinding.currentValue` mirror and its
dual-write dance (propagateCompletions updating registry + ctx separately)
are gone; `applyPhase` resolves cells in place, which also fixes a
pre-existing wart where it left stale `value: undefined` binding objects
in `bindingList` while replacing the map entry.

- **Root layering**: `buildEvalCtx` builds a real scope chain — primitives
  ← extensions ← base ← source — and returns the source layer (`scopeNew`/
  O(1) layers from C2.1). The own map of the returned ctx holds exactly
  the source-level bindings, which simplified every "filter out the
  primitives" consumer (module extraction, introspect, PCP verdict walk)
  into correct-by-construction reads. The REPL base is flattened into a
  fresh layer per pass (`scopeAllBindings` + copies) so completions in a
  later pass can never mutate an earlier pass's ctx — byte-compatible with
  the old flat copy, including carrying unresolved REPL bindings forward
  as pending cells.
- **Absent vs unresolved, distinguishable**: a declared-but-unprovided
  `import foo` now installs a pending cell on the source layer (tracked by
  the registry); a never-declared name has no binding on any layer. The
  evaluator's observable behavior is unchanged (both residualise), but the
  reflective `ctx_resolve` now surfaces the distinction per design §4/D11:
  absent → Error-typed value, pending → residual Symbol — the old throw
  path is retired (the §4-mandated delta deferred from C2.3a).
- **Consumer migration**: `resolveSymbols` + `buildEvalCtx` flatten base
  chains; `proven.ts` type lookup and the three `__futureManager` reads
  became chain-aware (`scopeLookup` / `scopeHostRead` + `HOST_KEYS` —
  fixing a latent miss where `print`/`delay`/`fetch` under a
  unification-enriched child ctx couldn't see the manager);
  `markTailCallsInContext` needed no change (it consumes the parser's
  file context, not the eval scope). `Binding.isUse` deleted along with
  all ~60 literal sites (C2.3a's parked cleanup).
- **Boundary tests** (6 new): own-layer/chain-reach split, ctx↔registry
  object identity for named/future/bare bindings, pending-cell vs absent
  (including both `ctx_resolve` outcomes), applyPhase in-place resolution
  + forward-chained dependents, extension-satisfied imports get no cell,
  REPL pass mutation-isolation. Two C1.1/C2.1-era tests adjusted
  internals-shaped only (`bindings.get("Int")` → `scopeLookup`) since Int
  now lives on the extensions layer; one reactive test's hand-built
  registry record reworked to the unified cell shape (assertions kept).

Phase 2 (scope split) is complete. 1002/1002 green.

## 2026-07 — C2.3a: `ctx_use` + `isUse` retirement (structures Phase 2, B-013 part 1)

Recon for C2.3 found the `ctx_use` surface already dead: the primitive
has zero consumers anywhere (src, lib, tests), and the `isUse` flag it
minted was write-only cargo — one passive forward in buildEvalCtx, zero
semantic readers. Deleted the primitive and its registration; the
`Binding.isUse` field is optional with a retirement note (full deletion
with C2.3b's future-cell unification, which cleans the literal sites).
C2.3b working spec (future cells, root layering, flat-view consumer
migration, absent-vs-unresolved tests) recorded in the plan chunk log.

## 2026-07 — C2.2: Facts plane via scopeAssume (structures Phase 2, B-012)

The Phase-C predicate-narrowing machinery moves onto the scope chain as
immutable fact layers.

- **`scopeAssume(parent, facts)`**: pushes a child layer carrying ONLY
  the new facts — no copying of parent facts (the old
  `augmentScopePredicates` copied every inherited entry per branch).
  Branch exit is discarding the child; parents are never mutated.
- **`scopeFactsFor`** merges fact sets across the whole chain, rootmost
  first — reproducing the former copy-parent-then-merge read semantics
  byte-identically (per §6 delta 4: observable behavior unchanged,
  internals-shaped change only). The C2.1 nearest-layer-wins read was
  superseded by this merge — with single-layer storage they were
  equivalent; with real layers, merging is the faithful semantics.
- **`scopeOwnFacts`** is the sanctioned write path for assert/requires
  mid-scope accumulation — the scope's own layer state, never a parent.
- **Chain-aware entailment**: the four static-discharge binding lookups
  in assert/requires previously read the own-layer map only — under
  layering they now chain-walk (without this, static discharge would
  silently degrade to runtime checks inside branches).
- **Opacity lint**: direct `.scopePredicates` access outside `scope.ts`
  fails the suite — fact payloads are opaque to everything but the facts
  API (the plan's "base ops never inspect them" boundary).
- Boundary tests: sibling-branch isolation, parent-untouched-after-
  branch, nested-layer chain merge, own-layer accumulation isolation.

## 2026-07 — C2.1: Scope protocol + parent chain (structures Phase 2, B-011)

Phase 2 opens: scopes (evaluation) and structures (data) become distinct
planes with real layering.

- **`src/scope.ts`**: `scopeNew`/`scopeExtend`/`scopeLookup`/
  `scopeBindings` over the current ContextValue, plus chain-aware reads
  for the compile-mode flag and Phase-C scope predicates. `parent`/
  `isScope` are host-plane fields on ContextValue — never value slots.
- **Chain-walking Symbol lookup** in the evaluator (nearest layer wins;
  degrades to today's flat lookup on legacy contexts — zero behavior
  change, full suite as oracle).
- **The unification flatten-copy is gone**: call-site type-variable
  enrichment (`enrichedCtx`) previously copied every inherited binding —
  hundreds per call — to add a few type variables; it now layers an O(1)
  child scope. Structurally verified by boundary test (10k-binding
  parent → child owns exactly its own entries; 2000-layer chain lookup;
  shadowing semantics).
- **Plane rejection both ways**: `scopeExtend` refuses shape-carrying
  data Contexts; `type_dispatch` refuses evaluation scopes
  (`assertNotScope`) — the "no type-dispatch on scopes" boundary test.
- **Scoping deferral (recorded)**: the root evaluation context
  (buildEvalCtx's primitives → extensions → base → source flattening)
  stays flat until C2.3, whose resolution unification owns exactly the
  consumers that iterate that flat view (REPL persistence, module
  extraction, forward chaining). The root is marked `isScope` now.

## 2026-07 — C1.5b: `*_attach` collapse — body-form metadata off the AST (B-010 part 2; Phase 1 complete)

The five metadata wrappers (`partial_attach`, `decreases_attach`,
`effects_attach`, `param_effects_attach`, `proven_attach`) are now a
parse-time encoding only. A new `collapseBodyMetadata` pass in
`evalSource` — after symbol resolution (so metric/predicate ASTs carry
resolved Params), before tail-call marking (which now sees real bodies) —
peels the wrapper chain off every reachable function body, descending
through `type_check` layers, and stashes the metadata as host-internal
function properties (registered in SLOT_REGISTRY; preserved across
subst/remapParams clones via `PRESERVED_FN_META_KEYS`).

- Analyzers read properties instead of walking AST shapes: totality
  (`isFunctionPartial`, the decreases-metric site), proven, effects
  (`unwrapEffectsAttach` reimplemented over the property, same name),
  introspection, and `typed_function_impl`'s param-effects stamping.
- The peeler family is deleted (`findAttachWrapper`,
  `unwrapPartialAttach`, `unwrapDecreasesAttach`, `unwrapProvenAttach`,
  `_WRAPPER_NAMES`). The wrapper primitives stay registered as inert
  passthroughs — defense for any uncollapsed path.
- Six peeler-shaped unit tests reworked into collapse-equivalents, per
  the §6 item-3 ruling (test-condition changes pre-discussed).
- `type_check` and `requires`/`ensures` untouched (runtime checks, per
  ruling).

With C1.5b, **Phase 1 (accessor layer + channel plane) is complete**:
registry, accessors, hard-fail lint, capability-gated origination,
propagation table, and body-form metadata all live behind the boundary.

## 2026-07 — C1.5a: Propagation table + channel-aware mode (structures Phase 1, B-010 part 1)

First conscious-delta chunk, first half. The three §6 deltas were
discussed and ruled with the maintainer before work started (rulings
recorded in the plan §6): observable-zero at C1.5 with principled-rule
divergences deferred to C4.3; flip the strip-dodging proof primitives to
a new eager-but-channel-aware mode; `*_attach` collapse scoped to the
five metadata wrappers.

- **Differential safety net first**: 11 byte-for-byte fixtures of channel
  propagation recorded BEFORE any evaluator change — including two legacy
  warts preserved deliberately (chained-residual error loss;
  error-in-if-condition silently taking the else branch). Asserted every
  suite run; revisited at C4.3.
- **Propagation table**: generic `viralScan` driven by the channel
  registry replaces both hand-rolled error loops — a newly registered
  viral channel now propagates with zero evaluator changes. Union merges
  are installable per channel (`installChannelMerge`; effects installs
  its own encoding-aware merge). `assertPropagationTableLinkage` fails
  startup if the registry ever drifts from what the evaluator implements
  (shape/knowledge stay bespoke — that is what `computed` means; effects
  grandfathered on its dedicated path until C4.3; discharged is `drop`).
- **Channel-aware registration mode** (third mode on `makePrimitive`):
  eager evaluation, but args arrive as full values with channels intact.
  Six strip-dodging proof primitives flipped
  (refl/sym/trans/cong, prove_for_all_bool, prove_induction). **Briefing
  correction**: `proof_check` stays lazy — it reads the *unevaluated*
  proposition AST (`eqExprSides`), making it genuinely lazy, not a
  strip-dodge (the ruling said 7; the code says 6).
- **Forgery C live** (5 of 6 scenarios now real attack tests): the
  authority channel is excluded from both propagation executors,
  fabricating rules are rejected at registration for integrity channels,
  and combining a real proof with other values through operations never
  yields a discharged result.

C1.5b (the five-wrapper `*_attach` collapse onto function-value channels)
follows as its own landable unit.

## 2026-07 — C1.4: Channel writers — origination capabilities (structures Phase 1, B-009)

The channel plane gets its capability model (D21–D24), and the forgery
suite goes live.

- **Headline finding: forgery scenario A was a real hole.** Before this
  chunk, the Allegro object literal `{__discharged: 1, __proposition:
  "forged"}` produced a Context structurally indistinguishable from a
  discharged proof — `proofCtx`'s structural check accepted it. Closed by
  construction-path gates: object literals and `mv_set` refuse integrity-
  channel keys with a clear D21–D24 error.
- **Channel registry** (`src/slots.ts`): all 9 built-in channels
  registered with their propagation rules (shape computed, error viral,
  effects union, knowledge computed, discharged drop+integrity, …) —
  recorded now, consulted by C1.5's propagation table. Registration is
  one-shot and returns the write capability as a closure (D24);
  integrity channels reject fabricating rules (viral/union) at
  registration (D23).
- **Kernel-private discharged writer**: acquired via
  `kernelChannelWriter("discharged")` at exactly the two origination
  sites — primitives.ts (failed proofs) and types-std.ts (`makeProof`).
  A new lint pattern restricts acquisition to those two modules; the raw
  stampers are no longer exported. The writer is never bound into any
  Allegro extension.
- **Allegro surface**: `channel_register(name, rule) → writer`,
  `channel_read(value, name)` / `channel_list(value)` (authority-free,
  D23), `channel_attenuate(writer, predicate)` (delegable attenuation,
  D24 — brand-checked, so a hand-rolled lambda is refused). Registration
  is epoch-sealed: the evaluator's fixpoint loop re-evaluates top-level
  bindings within a pass, so same-pass identical re-registration returns
  the held writer; a later program's re-registration throws (capability
  held).
- **Forgery suite v1**: A, B, D, F are live attack tests (object-literal
  forge, proposition swap under discharge, free-read/gated-write,
  writer counterfeit + cross-program re-mint). C unlocks at C1.5, E at
  S3. The hard-fail lint proved itself mid-chunk by catching a drive-by
  dunder literal in this chunk's own new code.
- **Scoping decision** (recorded for review): non-integrity channels keep
  their existing single-function origination chokepoints (withType,
  error creation, withEffects, withPredicates); full writer indirection
  for them lands with C1.5's propagation table, where those functions
  collapse into writer + table entries.

## 2026-07 — C1.3: Accessor migration complete + lint hard-fail (structures Phase 1, B-008)

The enforcement moment for the base/extension boundary. All 12 remaining
files migrated (~360 sites: 222 mechanical `primaryOf` → `dataOf` renames
plus ~100 individually-reviewed literal/component sites across
primitives, totality, refinements, introspect, runtime, proofs, effects,
pcp, proven, modules, and the two grammar2 files). Every production file
is now at ZERO forbidden-access occurrences except the sanctioned
`src/slots.ts`, and the baseline's `hardFail` flag is flipped: **direct
slot access outside the accessor layer is a suite failure from this
commit on** (negative-tested — a single injected occurrence trips it).

Accessor layer additions: presence checks (`hasName`, `hasShapeSlot`,
`hasDischarged`); set-only proof stampers (`stampProposition`,
`stampDischarged`, `stampProofReason`, `stampProofCounterexample`,
`stampEqOperands`) that mirror the proof kernel's map-only origination
idiom exactly — these are the chokepoints C1.4 wraps with the
discharged-channel writer capability; `renameInPlace` preserving the
auto-naming pass's deliberate mutate-map-entry-only semantics.

tsc clean under the sanctioned invocation; 986/986 green — zero behavior
change. Phase 1 remaining: C1.4 (channel writers + forgery suite v1),
C1.5 (propagation table — first conscious-delta chunk).

## 2026-07 — Suite-cost pass + CI (B-005, pulled forward)

Response to the maintainer's verification-cost concern. Profile findings
(from the new per-test timing): 542s wall clock — 156s of it the boundary
registry corpus walk *re-evaluating* .alg files the file tests had already
evaluated, and ~200s in the totality-analyzer tests (pre-existing,
tracked separately).

- **Registry walk piggyback**: `runAlgFile` now walks each file's values
  for registry completeness at evaluation time (memory traversal, ~ms);
  the boundary section consumes the collected results instead of
  re-evaluating the corpus. Coverage *improved* — all ~45 file tests are
  walked now, including the `use`/`import` ones the standalone corpus
  skipped. Standalone `runRegistryCompletenessCorpus` retained for
  harness-independent use.
- **Two-tier verification**: `ALLEGRO_TEST_FILTER=<regex>` runs only
  matching tests for dev iteration (measured: 8s vs ~9min). Filtered runs
  print a `DEV RUN` banner and suspend the suite floor — they are
  explicitly not a landing gate. Landings still use the full suite, one
  run per landed group, in the background.
- **Timing in every summary**: wall clock, per-section times, 15 slowest
  tests — suite-cost regressions are now visible on every run.
- **tsc debt paid**: the TS2300 duplicate-import block in test.ts and the
  TS2304 missing `ExpressionValue` import in primitives.ts are fixed. The
  only remaining diagnostics are the 4 sanctioned TS6059s from the
  documented bench/pcp/scripts out-of-rootDir convention.
- **CI (B-005)**: `scripts/typecheck.sh` — the sanctioned invocation —
  fails on any diagnostic except that TS6059 family (negative-tested with
  an injected type error). `.github/workflows/ci.yml` runs typecheck +
  the full suite on every push/PR; `npm run typecheck` added.

Known remaining hotspot, deliberately untouched here (production-code
change → own chunk): the totality-analyzer tests (~200s — an 84s single
.alg file among them) look pathological and deserve investigation.

## 2026-07 — C1.2: Accessor migration, core files (structures Phase 1, B-007)

`evaluator.ts` and `types-std.ts` — the two files that define how state is
accessed — now go entirely through the accessor layer. Zero lint
violations in both; the ratchet drops 738 → 500 total occurrences.

- **Write side added to `slots.ts`**: `setName` … `setSlotCount`,
  `writeShape`/`writeDischarged` channel-plane shims (C1.4 gates
  origination with capabilities on top of these), removal helpers
  (`removeConstruct` collapses the delete + bindingList-splice triple),
  `SLOT_KEYS` constants for residual key-filter idioms (copy loops,
  bindingList lookups), `isMetaSlotKey`, `getInterfaceMarker`,
  `isGenericTypeSlot`, `getGenericConstructor`/`setGenericConstructor`
  (GenericType's `__constructor` is semantically distinct from a concrete
  type's `__construct` — kept as separate accessors).
- **`dataOf`** — the accessor-layer name for today's `primaryOf`. All ~60
  core-file call sites renamed; the C1.5/C4.3 semantics change
  (strip-vs-preserve retirement, then transparency cutover) now happens in
  exactly one place. `cloneComponents`/`componentsView` cover the
  component-carry idioms; effect-var label helpers absorb the
  `"__effectvar:"` marker literals.
- **Migration**: ~250 sites total (92 regular shapes mechanically, the
  rest individually reviewed — binding-object reads, generic-type
  readers, delete triples, error-component peeks, property-style
  `__effectBound`/`__abstractDomain` accesses). `types.ts` was already
  clean. One incidental cleanup: buildGenericType had a duplicate
  bindingList push in its mark-as-generic block; collapsed into the shim.

tsc at the pre-existing baseline; 986/986 green — zero behavior change,
full suite as the oracle.

## 2026-07 — D39 addendum: three slot dispositions ratified (follow-up to C1.1)

Detailed maintainer review of the three slots C1.1 flagged as absent from
D39's table; all three rulings recorded in `structures.md` (D39 addendum)
and `src/slots.ts`:

- **`__effectBound`** → member on the Effect instance for now; dissolves
  into the instance's canonical label-set representation when Effect
  re-derives through the kind recipe (C6.2) — the bound is derivable
  (pure → ∅, named → {name}), so it won't survive as standing storage.
- **`exported`** → scope-binding visibility metadata (S3, base concept of
  the Scope protocol), NOT a value channel: export-ness belongs to the
  binding, and the current value-plane marker has an aliasing wart
  (`y = x` silently exports `y`). Stopgap dissolves at the Phase 2 scope
  split / module rework.
- **`arity`** → deleted. It was write-only — set in
  `wrapAsUntypedFunction`, read nowhere in the repo. The write and the
  unused parameter are removed; registry entry retained as audit record.

986/986 green.

## 2026-07 — C1.1: Slot & channel registry + typed accessors (structures Phase 1, B-006)

New `src/slots.ts` — the D39 disposition table as code, and the seam the
Phase 4 representation swap will happen under.

- **Registry**: 56 registrations covering every `__*` slot and MultiValue
  component in production code (inventoried by grep, cross-checked against
  D39). Each entry: current name, physical storage (context-binding /
  js-property / mv-component / binding-name-prefix / label-marker), owning
  kind, disposition (member / channel / base-concept / host-internal /
  delete), and post-migration target. Exact + prefix matching
  (`__future_`, `__grammar`, `__anon_`, …).
- **Typed accessors** (read side): `getName`, `getMembers`, `getParent`,
  `getConstruct`, `getPredicate`, proof/effect/generic field readers,
  `asContext` (MultiValue peel), and channel-plane reads
  (`channelReadRaw`, `channelList`) that treat `__type`/`__discharged` as
  the shape/discharged channels they will become. No call-site migration
  yet (that's C1.2/C1.3).
- **W3 registry-completeness invariant** in the harness walker: any `__*`
  Context-binding key or MultiValue component key not covered by the
  registry is a violation — the D39 "no new `__*` slot" rule enforced
  mechanically. Negative-tested (forged `__bogusSlot` + bogus component
  both fire). Corpus walk: all 27 self-contained tests/*.alg files
  evaluated and walked — zero unregistered keys on first pass.
- **Lint hardening**: scan now includes untracked files (a new module full
  of violations was previously invisible until committed). `src/slots.ts`
  is the first `allowedFiles` entry — exempt from the ratchet as the
  sanctioned home (its 74 dunder literals + 3 components accesses are
  recorded transparently in the baseline).
- **Three dispositions proposed, not in D39's table** (flagged for
  maintainer review): `__effectBound` → Effect.bound (member, by analogy
  to the refinement predicate/domain pair); `exported` component →
  visibility/exports channel (module system); `arity` component →
  Function member.

986/986 green (2 new tests). Zero production-code behavior change.

## 2026-07 — C0.1: Boundary-test harness + baseline (structures Phase 0, B-001)

First chunk of the structures-unification implementation plan. New
`src/boundary-tests.ts` wired into the suite, four instruments:

- **Boundary lint** — counts forbidden direct-access patterns
  (`.components`, `__*` string literals, `bindings.get("__…")`,
  `primaryOf` outside its definition site) across production sources
  (excludes generated `parser.ts`, `test.ts`, and the harness itself)
  against a committed baseline (`src/boundary-baseline.json`: 14 files,
  661 occurrences). Ratchet semantics: an increase fails the suite
  (negative-tested); a decrease prints a tighten note; regenerate with
  `npx tsx src/boundary-tests.ts --write-baseline`. A `hardFail` flag +
  `allowedFiles` allowlist are in place for C1.3's flip to zero-tolerance.
- **Invariant property checks** — deterministic (mulberry32, fixed seed)
  generator builds 40 small well-typed-by-construction programs, evaluates
  them through the public `evalSource` surface, and walks every result +
  binding asserting W1 (a MultiValue's primary is never a MultiValue) and
  W2 (a resolved `type` component's primary is a Context). Invariant set
  grows per phase (transparency, key-sort partition, immutability).
- **Forgery-suite skeleton** — D21's scenarios A–F as named, visible,
  skipped entries with their blocking mechanism and unlock chunk recorded
  (A/B/D/F → C1.4, C → C1.5, E → S3 enforcement).
- **Baseline snapshot** — basics.alg print-output equivalence under the
  standard type system; a suite-count floor (979, enforced in test.ts's
  summary as a mass-disablement tripwire); a coarse perf floor over three
  fixed workloads (basics, 50k TCO recursion, map/filter/reduce chain),
  **warn-only at 2×** — the hard regression threshold is flagged as a
  pending maintainer decision per plan §5.

Plan status flipped to **active** (maintainer approved Phase 0). No
production-code changes; zero behavior change. 984/984 green (979 + 5
harness tests).

## 2026-07 — Layer model, docs reorg, backlog rebuild

- `docs/design/layers.md`: the architectural spine — L0 Allegretto / L1
  extension substrate / L2 Standard / L3 Vivace with strict one-way
  dependencies; capability tracks (build, tooling, host, backend, perf,
  bootstrap, ecosystem); milestone register M1–M10 with
  validated/aspirational tags. Maintainer rulings: parser is L1 (concrete
  syntax is an extension), module system split (loading L1 / typed objects
  L2), provability is an independent L2 capability, build pipeline is a
  track.
- `docs/design/` reorganized into layer subfolders (allegretto/,
  extension/, standard/, vivace/, platform/), each README a **boundary
  contract**. `grammar-formalism.md` and `proving-in-allegro.md` stay at
  `docs/` (Tier-0 + runtime references). Reference sweep across Tiers 1–3;
  one Tier-0 path touch-up (PROCESS §6 registry pointer) landed as a
  dedicated flagged commit (36197b8) and was maintainer-ratified 2026-07.
- Doc-reference lint (`scripts/doc-ref-lint.ts`) added and wired into the
  test suite — PROCESS §10 debt; caught and fixed 20+ dangling references
  (stale `memory/…` paths, archived-plan paths in CLAUDE.md/bench/primer).
- `docs/backlog.md` rebuilt: single list, stable IDs (B-001…B-086), sequenced
  head mirroring the structures implementation plan with revalidation
  items interleaved, banded tail by layer/track. V1 completed-items ledger
  converted to `V1-INVENTORY.md` (migration matrix: keep / revalidate /
  rework / drop / TBD per feature). Full v1 landing narratives remain in
  git history (pre-rebuild `docs/backlog.md`).
- Earlier in 2026-07 (same arc): v1-era plans archived with triage record
  (`docs/plans/archive/README.md`); revalidation register established
  (now folded into the backlog as `[reval]` items); shipped
  grammar-extension decisions recovered into
  `docs/design/extension/grammar.md` §4; `structures.md` drafted from the
  D1–D40 design log; `structures-implementation.md` plan drafted
  (boundary-test-first).

## 2026-06 — Documentation governance (Tier-0 docs)

- Created `docs/VISION.md` and `docs/PROCESS.md` (Tier 0); `docs/design/`
  (type-system, effects, pattern-matching, grammar) promoted from
  `.claude/memory/` files and plan docs; promoted memory files shrunk to
  pointers; `docs/plans/README.md` manifest added.
- Maintainer rulings recorded: descriptive plan-doc names supersede
  evocative codenames; `__` meta-property prefixes are accreted artifacts
  (redesign pending — `docs/design/standard/type-system.md` §4); parser alt-order
  significance is accreted, not intended (`docs/design/extension/grammar.md` §2);
  [impl, proof] pairs are participant-neutral, not AI-specific
  (`docs/VISION.md` §2).
- Recovered untracked deferred items: when-branch predicate refinement,
  brace/offside dual modes (to be filed in BACKLOG during the refactor).

## v1 era (pre-2026-07) — the per-phase record, migrated from CLAUDE.md

Migrated verbatim 2026-08 (B-095 chunk 3), completing this file's
original stub promise. Ordering as it accreted in CLAUDE.md: a short
oldest-first bullet run, then detailed entries roughly newest-first
(provability arc H → A, effects D1 slices, totality E, contracts C).
The v1 feature-disposition verdicts live in `V1-INVENTORY.md`.

- ✅ Symbol resolution / lexical scoping (compile-time, not runtime)
- ✅ eval_if Rule 2 (partial eval both branches)
- ✅ Tail call optimization (O(1) stack for tail-recursive functions)
- ✅ Parser reimplementation (hybrid Pratt + recursive descent)
- ✅ Keyword support (export, true/false properly disambiguated)
- ✅ Dynamic lexer config (extensions add operators/keywords)
- ✅ Pattern matching (when/is/then with resolve-first semantics, type/structural destructuring)
- ✅ MultiValue component access (Y of x syntax)
- ✅ Error propagation (error values as MultiValue components, automatic propagation)
- ✅ None type (singleton `none` keyword, returned for absent components)
- ✅ `instanceof` and `subtypeof` infix operators
- ✅ Type constructors via `__construct` (Int, Float, String, Bool)
- ✅ Fluent type API: `extend`, `where`, `distinct`, `constructor` methods on Type/NominalType
- ✅ Meta-type dispatch for type-level methods (e.g., `Int.where(...)`)
- ✅ Auto-naming: types bound to symbols get named automatically
- ✅ Guard clauses (`and` keyword in patterns)
- ✅ Nested destructuring (colon introduces sub-pattern, recursive matching)
- ✅ Member descriptors (`__members`): unified Method/Field types, structural checking via member comparison, meta-type methods in `__members`
- ✅ Interfaces: `Interface.define({...})` — structural type matching, no `implements` keyword needed
- ✅ Types as typed values: `Int instanceof NominalType`, `type of Int` → NominalType, all type bindings wrapped as MultiValues
- ✅ Array map/filter/reduce as Allegro ComposedFunctions (recursive AST construction, not imperative TypeScript loops)
- ✅ Refinement types: `Type & _ > 0` syntax, predicate checking at construction/annotation/call sites, `preserveOps` operator lifting for refinement preservation through operators (`&&` was the original operator; migrated to `&` in Slice 2 Stage 0 to free `&&` for purely logical AND)
- ✅ Mixins: `.mixin({method: fn, ...})` adds method implementations to types, ComposedFunction method dispatch with self binding
- ✅ Runtime grammar extension Phase 1: module-scoped `register_infix`/`register_prefix`/`register_postfix`/`register_expr_prefix` primitives; `use_grammar NAME` top-of-file header activated a module's `GrammarFragment` before parsing (superseded by Phase 6)
- ✅ Runtime grammar extension Phase 6: `grammar { infix/prefix/postfix/expr_prefix … }` block syntax with named precedence (`prec(pow)`, `at(X)`, `above(X)`, `below(Y)`, combined forms), operator-symbol lookup (`at("*")`), anonymous levels, and data-driven stratified-stack level insertion. `use X` pre-scanner (replaces `use_grammar`; accepts `use NAME` and `use import NAME`, extensible to full expressions later). Conflict detection: `E_OPERATOR_CONFLICT`, `E_KEYWORD_CONFLICT`, `E_PRECEDENCE_CYCLE` surface at `use` time with aggregated messages.
- ✅ Runtime grammar extension Phase 6b: EBNF mini-grammar for rule bodies (`"lit"`, `/regex/`, ident refs, `s:rule` labels, `a*`/`a+`/`a?` postfix, `a ** sep` sep-rep, `(a | b)` groups). Multi-token `expr_form parts => template` (e.g. `match x with p => e | …`) and `stmt_form parts => template` for statement-level forms. User sub-rules via `rule NAME = body => template` (new production) and `rule NAME += body => template` (append alternative). Template params are positional matching the order of EBNF labels; `substituteParams` injects the matched sub-ASTs at parse time. Demo: `lib/match_expr.alg` implements a `match … with …` expression in 3 lines.
- ✅ Runtime grammar extension Phase 7: `new grammar { … }` for fresh grammars (baseChain=[empty]) and `grammar extends X { … }` for composition; `use grammar { … }` hosting-file literal grammars (no separate module needed); `use NAME.MEMBER` selects one Grammar binding from a multi-grammar module. Analyzer gains `W_PRODUCTION_REPLACED` (silent shadowing of base productions) and `E_INCOMPATIBLE_GRAMMARS` (fragment base-chain mismatches) checks. Hygienic template substitution: free Symbols in grammar templates resolve against the module's evalCtx at definition time, so consumer rebindings can't hijack the extension. Selector-based rule surgery: `rule foo -= alt_name` removes a named alternative, `rule foo[alt_name] = body => template` replaces one. Deferred to Phase 8 (needs parser/evaluator reentry): per-scope activation (`use X in { block }`), single-pass `use X` with arbitrary mid-parse expressions, parse-time builder lambdas.
- ✅ Provability arc — Phase A (introspection surface): `src/introspect.ts` walks an evaluated Value tree and produces a `ValueSummary` (kind, typeName, resolved status, node count, depth, external symbols referenced, primitives called, short description) and a `ModuleSummary` with a `SafetyGrade` classification (`proven-safe` | `partial` | `has-warnings` | `has-errors`). New CLI subcommand `allegro inspect <file>` emits the rendered summary. Web sandbox gets an Inspect button on every demo that shows the same summary with a coloured grade badge. This is Layer 0 of the "code is the wrong reviewable artifact" arc (see `docs/plans/archive/crystal-proving-curry.md`).
- ✅ Provability arc — Phase B (refinements as a proof substrate): `src/refinements.ts` adds an `AbstractDomain` representation (interval, equality, inequality, opaque) alongside the existing runtime predicate. `domainFromPredicate` recognises common shapes (`_ > k`, `_ >= k`, `_ < k`, `_ <= k`, `_ == k`, `_ != k`, conjunctions via `&&`) and lattice operations (`intersectDomains`, `joinDomains`, `impliesDomain`) reason at compile time. `propagateAdd` / `propagateSub` / `propagateMul` derive output domains for arithmetic on refined operands. The evaluator's `applyPrimitive` propagates a domain onto results when at least one operand carries one — pure-literal arithmetic stays uninstrumented so untyped Allegretto and unrefined Standard code see no behaviour change. Subtyping check: `type_check_impl` and `checkRefinementPredicate` now try abstract-domain implication BEFORE the runtime predicate, so a value with domain `≥ 4` passed to a function expecting `_ > 0` discharges the refinement statically. Counterexamples: a failing refinement check now reports both the violated constraint and the actual value (`refinement check failed: expected ≥ 1 (got -5)`). Pilot: `lib/math.alg` adds `PositiveInt`, `NonNeg`, and a `double_pos(x: PositiveInt): PositiveInt` whose return-type check is discharged purely by domain implication. Demos: `tests/refinement-propagation-demo.alg`, `tests/refinement-subtype-demo.alg`, `tests/math-pilot-demo.alg`.
- ✅ Provability arc — Phase C Chunks 1+2 (predicate sets + branch refinement + `assert`): `src/refinements.ts` `PredicateSet` carries a list of `Predicate` (shape + source attribution: `refinement-type` / `type-invariant` / `assert` / `branch-then` / `branch-else` / `match-case` / `requires` / `ensures` / `propagation` / `literal`) on each binding's MultiValue. `applyPrimitive` propagates predicate sets through arithmetic. `eval_if` derives branch predicates via `deriveBranchPredicates` (recognises `x op k` / `k op x` / conjunctions; both `bits_*` and `typed_*` comparison shapes), pushes them onto a scope-local `scopePredicates: Map<string, PredicateSet>` carried on `ContextValue`, and pops on branch exit. `assert P` is a stmt_form (in `lib/invariants.alg`) lowering to `assert_stmt(P)`: tries static discharge from accumulated predicates; on success or runtime-pass updates the scope-local predicates so the rest of the scope inherits the proven facts; on failure throws `AllegroError` with a counterexample message (build safety in — no silent error values). The introspection summary renders single predicates compactly and multi-predicate sets with per-source attribution.
- ✅ Provability arc — Phase C Chunk 4 (`Type.invariant`): `src/types-std.ts` adds `Type.invariant(self => P)` (and `NominalType.invariant`) that returns a new type with `__invariantsList: Value[]` and a wrapped `__construct` checking each invariant on creation. Multi-clause chaining (`Int.invariant(self > 0).invariant(self < 100)`) reports per-clause failures (`invariant 1 failed`, `invariant 2 failed`). Multi-field record invariants reference fields via `self.field` (`Range = Type.define({lo, hi}).invariant(self => self.lo <= self.hi)`). `extend` carries `__invariantsList` forward so derived types inherit. Pilot: `lib/math.alg` `Range`. Introspection: types with invariants render `[N invariants]`; `safetyGradeForSummary` flags Error-typed bindings as `has-errors`. Demos: `tests/invariant-demo.alg`, `tests/predicate-set-demo.alg`.
- ✅ Provability arc — Phase D1 (effect types): function bodies declare the categories of side effects they can produce via an `effects` body-form clause; the analyzer infers the actual set from the primitives transitively called and verifies the declaration is a superset (under-promising halts compilation).
  ```
  use effects
  square(x) =>
    effects pure
    x * x
  greet(name) =>
    effects io
    print("Hello, " + name)
  ```
  Effect labels are EXTENSIBLE, not a fixed enum. `src/types.ts` `PrimitiveFunctionValue` gains an optional `effects: string[]`; `makePrimitive(name, fn, lazy?, effects?)` accepts the labels. Core declares no labels; the standard library tags `print` with `io`, `fetch` with `net`, `delay` with `time`. Domain-specific extensions register their own labels (`build-io`, `funds-mutation`) by attaching them to their primitives. `src/effects.ts` provides `EffectSet` (plain `Set<string>`), set ops (`effectUnion`, `effectSubset`, `effectDifference`), bottom-up inference (`inferFunctionEffects` walks ComposedFunction bodies, recurses into transitively called functions with cycle detection), and the `effects_attach` wrapper unwrap helpers. Surface syntax via `lib/effects.alg` grammar (stmt_form `effects` parsing comma-separated identifiers); the block-expression preprocessor recognises `effects_decl_marker(labels)` markers, extracts them, and wraps the body's result with `effects_attach(result, labels)` (a runtime passthrough that's metadata for the analyzer). `evalSource` runs `checkEffectsDeclarations` after `precompileFunctions`; mismatches throw an `Error` listing every binding's declared/inferred/missing sets. Introspection: `ValueSummary.inferredEffects` and `.declaredEffects` populate for any function value; the renderer surfaces three formats — `effects: pure (inferred)`, `effects: io (declared, verified)`, `effects: io (declared) ⊇ pure (inferred) ✓`. Pilot: `lib/math.alg` adds `effects pure` to `sqrt`, `pow`, `abs`, `double_pos`. Demo: `tests/effects-demo.alg`. Phase D2 will refine flat labels into parametric capabilities (`net[example.com:443]`) and per-module capability budgets — D1 is the substrate.
- ✅ Provability arc — Phase D1 sub-chunk 1.1 (Effect meta-type substrate): `src/types-std.ts` adds the `Effect` meta-type (`__type = Type`, lattice members in `__members`) and the two core absolutes — `pureEffect` (lattice bottom, kind `"pure"`) and `opaqueEffect` (lattice top, kind `"opaque"`) — built via `buildEffect(name, kind?)` which sets `__extends = Effect` and copies the lattice methods into the new type's `__members`. TS lattice helpers `effectSubsetOf`, `effectImplies`, `effectIntersect`, `effectUnion` operate on Context values; subset/implies walk the `__extends` chain by identity; intersect/union return `pureEffect` (no overlap) or `opaqueEffect` (sound over-approximation pending Slice 2's anonymous conjunctions). Standard extension binds `Effect`, `pure`, `opaque` so Allegro source sees them as values. `pure subtypeof Effect` and `opaque subtypeof Effect` discharge through the existing nominal subtype check via `__extends`; sibling subtypes (`pure subtypeof opaque`) correctly return false. Anonymous conjunction creation (`io & time`) and `&` operator surface deferred to Slice 2.
- ✅ Provability arc — Phase D1 sub-chunk 1.2 (effects in PredicateSet): `src/refinements.ts` `AbstractDomain` gains an `EffectsDomain` variant (`{ kind: "effects", labels: Set<string> }`) carrying the chunk-1 flat-label representation. Lattice ops generalised: `intersectDomains` does set intersection on effect-effect, opaque on mixed-kind; `joinDomains` does set union; `impliesDomain` returns `b.labels ⊆ a.labels` (wider implies narrower) for effect-effect, false on mixed-kind. `PredicateSet` gains `effectiveEffects()` (unions all effects-source predicates) alongside the existing `effectiveDomain()` (which now skips effects predicates). `PredicateSource` adds `"effects-declared"` and `"effects-inferred"`. `src/effects.ts` adds `effectPredicatesForFunction(fn): PredicateSet` and `effectPredicatesForValue(v)` — derive a uniform predicate-set view from the chunk-1 storage (`effects_attach` body wrap + `inferFunctionEffects` walker), one predicate per source. Underlying chunk-1 storage unchanged; this layer is on-demand derivation. Storage migration (replacing `effects_attach` with direct predicate attachment on the function MultiValue) deferred to Slice 2 where it interacts with HOF param-effect bounds. All chunk-1 tests pass under their existing API; 13 new tests verify the EffectsDomain machinery and helper extraction.
- ✅ Tail-call forwarding through typed-return wrappers (`type_check` / `ensures_check`): pre-existing latent bug. When a typed function has a tail-position recursive call (e.g. `countdown(n: Int): Int => if n == 0 then 0 else countdown(n - 1)`), the body's shape is `type_check(eval_if(…), Int)`. The inner recursive call is marked `_tailPosition` (markTailCallsInValue eagerly marks every ComposedFunction body's top expression — including eval_if's 0-param thunks). At runtime the TailCall sentinel propagates up through eval_if's return into `type_check_impl`'s `evalFn(args[0])` call, but type_check tried to read `.kind` on the sentinel and produced an unresolved residual instead of looping back to applyComposed's tco_loop. Fix: `isTailCall` is now exported from `src/evaluator.ts`; `type_check_impl` and `ensures_check_impl` detect TailCalls and forward them unchanged. Soundness preserved — the intermediate type / ensures check is skipped on TailCalls but the eventual base-case value still passes through the same wrapper (the return type is fixed; intermediate recursive results are already typed). Performance preserved — TCO works through typed returns, verified with 100k-deep recursion. The transparent passthroughs (`effects_attach` / `partial_attach` / `decreases_attach` / `param_effects_attach` / `seq`) were already correct since they `return evalFn(args[0], ctx)` directly. 2 new regression tests; 828/828 green.
- ✅ Provability arc — Phase H4a (PCP LLM worker — `allegro prove`): closes the central thesis bet end-to-end. **`allegro prove <file> [--max-attempts N] [--model MODEL] [--output FILE.alg] [--json]`** takes an Allegro source file, extracts pending obligations, asks Claude to propose proof terms via `@anthropic-ai/sdk` (now a dependency), splices each into the source's theorem declaration, verifies via the kernel in `softFail` mode, iterates on failure up to `--max-attempts` (default 5). On success, records authorship as `{prover: <model-id>, attemptsUsed: N, role: "primary"}` using H1's Authorship schema. Layered architecture in `pcp/llm-worker.ts`: **pure helpers** (no SDK / no API key — tested in isolation): `extractCodeBlocks` parses ` ```allegro` fenced blocks (with fallback to any fenced); `spliceProof(source, theoremName, term)` regex-based single-line splice that appends `by <term>` to a bare theorem or replaces an existing `by` clause; `buildIterationMessage(...)` constructs the user message including proposition (fenced), lemmas, prior-failure reason + counterexample, hints with suggestedConstruct, strategies-already-tried list; `classifyStrategy(term)` regex-tags the term with which combinators/tactics appear (`proof_trans`, `tactics.chain`, `prove_for_all_bool`, etc.) so the next attempt's strategiesTried is populated. **Anthropic client shim** lazily imports the SDK so tests for pure helpers don't pull it in; missing `ANTHROPIC_API_KEY` reports a clear error pointing at `allegro propose` (the human-interactive worker) as a fallback rather than hanging. **Orchestrator** `runLlmWorker(opts)` ties them together: enumerate pending obligations, per-obligation loop with attempt cap, build message → send → extract block → splice → verify → record. Prompt caching via `cache_control: {type: "ephemeral"}` on the system primer (participant-neutral doc at `docs/proving-in-allegro.md` — same text humans read in the F-arc primer). PriorAttempt records track candidate text + strategiesUsed for H3 hint generation across rounds. Out of scope for H4a-minimum: solving `proven` body-form clauses (need impl changes, not just proof terms), multi-strategy parallel exploration (H6), token budgets (H7). Output: human summary by default (✓/✗ per obligation + final proof terms + attempt counts); `--output FILE.alg` writes the proved source; `--json` emits a machine-readable result. Exit 0 if all discharged, 1 if any pending. 13 new tests cover the pure helpers + 3 mock-client async tests exercising the full orchestrator + 1 CLI smoke (missing-key path); 971/971 green. Plan in `docs/plans/archive/phase-h-plan.md`. H5 (proof catalog), H6 (multi-strategy), H7 (effort budgets + reproducibility) remain.
- ✅ Provability arc — Phase H benchmark suite (`bench/`): the falsifiable validation the phase-H plan pairs with H4 ("without this we don't *know* the thesis is validated"). A 10-obligation graded corpus under `bench/corpus/*.alg` (solved form — each verifies as-is) measured across baselines through the SAME kernel `allegro verify` / `prove` use. Per entry the harness (`bench/harness.ts`, `runBenchmark(opts) → BenchReport`) derives three forms and verifies each in `softFail` mode via `evalSource` + `buildVerdict`: **reference** (file as-is — corpus validity), **auto-PE** (goal's `by` term stripped by `stripProof`, a mirror of `spliceProof` — the kernel's free coverage), **gate** (`by` term replaced by `WRONG_SENTINEL_TERM = proof_refl(987654321)` — `proof_check` must reject a term proving a different fact, turning the goal pending), and optionally **LLM** (the gated/pending form written to a temp file and handed to `runLlmWorker` — convergence + attempts; needs `ANTHROPIC_API_KEY`, degrades gracefully without). Loading uses `createTypeSystem()` only — the corpus relies on standard-env proof primitives (`proof_refl`/`proof_sym`/`proof_trans`/`proof_cong`/`proof_refines`/`prove_for_all_bool`), no `import tactics`, so no module resolver is needed. `bench/manifest.ts` carries per-entry metadata (`id`, `category`, `goalTheorem` = `goal`, `referenceProof` — null for the two auto-PE-only entries). Categories mirror the plan: refl-trivial (t01-03), combinator sym/trans/cong/rewrite (t04-08), type-bound `proof_refines`/`prove_for_all_bool` (t09-10, Proof-valued props with no `by` slot). `bench/run.ts` (`npm run bench`) renders a table or `--json`; flags `--llm` / `--model` / `--max-attempts` / `--only`; exit 0 iff the corpus is healthy (every reference discharges + every gate holds) — LLM convergence never gates exit (a prover failing is a measurement, not a corpus fault). **Headline finding the benchmark surfaces**: PE-as-discharge is total over closed propositions — auto-PE discharges 10/10 with no prover at all; the prover's measurable work is therefore not "discharge the proposition" but "supply a `by` term the soundness gate accepts" (the 8 gated obligations), which is exactly the `allegro prove` loop's surface. `bench/` sits outside `tsconfig`'s `rootDir: ./src` (same convention as `pcp/`) — run via `tsx`, validated by the test suite rather than `tsc`. Deterministic baselines pinned by 4 tests in `src/test.ts` (`runBenchmarkTests`: corpus shape, `stripProof`, all-baselines-pass, a mock-client LLM run converging on t01/t05/t08). `bench/README.md` documents the design + the headline finding. 978/978 green.
- ✅ Lib loader pipeline unification (nested-`use` pre-scan + delegation to `evalSource`): libs and top-level files now go through the SAME entry point. The `use NAME` / `use import NAME` / `use NAME.MEMBER` pre-scan logic was extracted from `src/index.ts` into a shared `src/use-scanner.ts` (`scanUses` + helpers); both the top-level file runner and `ModuleLoader.loadModule` consume it. Inside `loadModule`: after reading a lib's source, scan the header → recursively load each referenced module through `this.loadModule` (so transitive `use` chains resolve through the same path resolver and cache) → strip the header → hand the body to `evalSource` with `typed=true` and the union of std + dep + nested-use extensions. `evalSource` already collects grammar fragments from extension bindings via `asGrammarValue`, so the body parses with the extended grammar; it also already runs `typeLiterals`, `precompileFunctions`, `checkEffectsDeclarations`, `checkExhaustiveness`, `checkTermination`, the proof-finding eval loop, and `checkProvenClauses`. The lib loader removes its own parallel parse + resolve + eval loop entirely (~80 LOC down). Source-binding extraction now reads from `evalCtx.bindings`, filtering out primitives + extension-supplied names + `__bare_*`/`__future_*` markers. Net behaviour: a buggy lib (false `proven` clause, undeclared effect, non-exhaustive `when/is/then` on a finite type) halts compilation with the same diagnostic it would in user code — no silent broken bindings. The `proven`, `assert`, `requires`/`ensures`, `effects`, `decreases`, `partial` body-forms now all work inside lib files. `use grammar { … }` literal blocks inside libs are explicitly rejected with a clear error (deferred — needs a bootstrap `evalSource` recursion, not needed for the planning lib). 3 new module-loader regression tests (resolves through loader, reports failed `proven`, rejects literal `use grammar`); 974/974 green. This unblocks `lib/planning.alg` (and any future body-form-using lib) from being the next chunk.
- ✅ Provability arc — Phase H4b (PCP human-interactive worker — `allegro propose`): the first reference worker exercising the H1+H2+H3 substrate. Pragmatic shape: rather than scratch files in a directory (per the plan), ship a single subcommand that emits a Markdown TODO of pending obligations + hints — the developer reads it, edits the source in their own editor, re-runs `allegro verify` to iterate. **`allegro propose <file> [--output FILE.md] [--all]`** loads the file (`softFail` mode), builds a Verdict (so hints are generated), enumerates obligations, joins them with hints + failure context per theorem, and emits via `formatTodo`. Default scope: pending-only; `--all` includes discharged theorems too. Output: stdout (default) or written to a `.md` file when `--output PATH` supplied. New helper `formatTodo({filename, totalObligations, sections})` in `src/pcp.ts` produces the Markdown: file-level summary ("**2 pending** of 5 obligation(s)"), per-theorem `##` sections with the proposition in a fenced `allegro` code block, `**Function:**`/`**Last failure:**`/`**Hints:**`/`**Lemmas in scope:**` annotations, prior-attempts count, suggested constructs rendered as italic-code asides (`*(try \`proof_trans\`)*`), lemma list truncated at 8 with `+N more`, and a footer reminding to run `allegro verify`. Zero new external dependencies — H4b proves the protocol is genuinely participant-neutral. Authorship recording for user-proved theorems (`verify --author`) deferred to H4b.1 — it touches authorship semantics that overlap with H7's effort budgets, and shipping it together makes a coherent unit. 5 new unit tests + 2 CLI smoke tests via `spawnSync`; 957/957 green. Plan in `docs/plans/archive/phase-h-plan.md`.
- ✅ Provability arc — Phase H3 (PCP iteration hints): gives the verification loop **memory and direction**. `Verdict` gains an `iterationHints` field; `PriorAttempt` gains a `strategiesUsed` round-tripped field. New `generateHints(theorems, report, obligation?)` produces transparent, limited compiler-side suggestions from common failure patterns: PE-residual failure → "try a combinator (refl/sym/trans/cong) or `prove_for_all_bool` for finite-domain quantification" with `suggestedConstruct: "proof_trans"`; `proposition is false` → "revise the theorem or the function"; `proof_trans middle terms differ` → "RHS of p1 must value-match LHS of p2 — consider `tactics.chain`" with `suggestedConstruct: "tactics.chain"`; wrong proof term ("different equality") → "match the propositions exactly"; F7 `proven-failed` with `at <param> = <value>` counterexample → names the violating input concretely; F7 `proven-skipped` shapes (multi-param, no type annotation) → restructure suggestions. **Global lemma reminder** — when an obligation supplies lemmas, one `theoremName: "<global>"` suggestion lists the top 5 with a "consider `proof_trans`/`tactics.chain`" nudge. **strategiesTried** aggregates + dedupes across all `priorAttempts.strategiesUsed`, sorted — workers consult it to skip already-attempted approaches. `buildVerdict` gains an optional `obligation` parameter that threads lemma context + prior attempts into hint generation. The CLI's `allegro verify --obligation O.json` now feeds the obligation through so hints reflect the full prior-attempt history. `formatVerdict` renders a `hints:` block with per-theorem `[name]` lines + a flat `already tried:` summary. Sample evolution (newly-passing vs. still-failing across attempts) deferred to H3.1 — needs parsed counterexample shapes. 9 new unit tests; 952/952 green. Plan in `docs/plans/archive/phase-h-plan.md`.
- ✅ Provability arc — Phase H2 (PCP `verify` / `obligations` CLI): wires the H1 schemas into two new `allegro` subcommands so any external tool (IDE, LLM agent, human-interactive worker) can run the verification loop from the command line. **`allegro verify <file> [--obligation O.json] [--json]`** — loads the file (mirrors `inspect`'s grammar/module pipeline), evaluates with the new `softFail` mode (proof failures push notifications without throwing), builds a Verdict via `buildVerdict`, optionally cross-checks against an obligation file (`checkObligationSatisfied` matches names + propositionHash to prevent trivial-pass attacks where the candidate proves `1==1` instead of the actual obligation), and emits as plain text (default) or JSON. Exit code: 0 if verified, 1 if not. **`allegro obligations <file> [--pending] [--json]`** — emits one Obligation per theorem (or only pending ones with `--pending`). JSON mode produces newline-delimited objects for easy streaming. **`softFail` parameter** added to `evalSource` as a 7th optional arg (default false — kernel halts on failure as before; CLI commands set true to inspect failures structurally). New helpers in `src/pcp.ts`: `buildVerdict(evalCtx, report)` walks bindings for Proof values + pulls totality/effects/proof-failure notifications; `extractObligations(evalCtx, report, opts)` enumerates theorems with lemma-list context (auto-includes other discharged theorems as available citations, self-excluded); `checkObligationSatisfied(obligation, verdict)` performs the hash-match check. Anonymous `verify` failures surface as `<verify>` theorems via the proof-failure notification path (anonymous successes pass silently — consistent with the existing kernel). 11 new unit tests + 2 CLI smoke tests via `spawnSync`; 943/943 green. Plan in `docs/plans/archive/phase-h-plan.md`. H3 (iteration hints) and H4 (LLM + human-interactive workers) build on the verify/obligations surface.
- ✅ Provability arc — Phase H1 (Proof Collaboration Protocol — schemas): the participant-neutral protocol for closing the loop between a PROVER (LLM, human, SMT, hybrid) and the Allegro verification kernel. `src/pcp.ts` defines three canonical JSON schemas at version `"pcp/1"`: **Obligation** (theorem statement + function signature + context + prior attempts), **Verdict** (per-theorem pass/fail with counterexamples + totality findings + effect mismatches), **Authorship** (ordered list of provers — `{prover, proverVersion?, attemptsUsed?, effortBudgetUsed?, role?}` — supports multi-prover proofs like LLM-proposed + human-reviewed from day one). JSON is canonical; `formatObligation`/`formatVerdict`/`formatAuthorship` provide basic plain-text renderers for direct CLI use (IDEs/external tools consume JSON). `hashProposition` (djb2, whitespace-canonicalised) gives stable theorem-identity across attempts. Builders: `makeObligation`, `makeAuthorship`, `AUTO_PE_AUTHORSHIP()` for kernel-discharged proofs. Round-trip stability validated (byte-identical re-serialisation); validators reject wrong version + missing fields + malformed status. 14 new unit tests; 931/931 green; plan in `docs/plans/archive/phase-h-plan.md`. H1 is the substrate; H2 (verify/obligations CLI), H3 (iteration hints), H4 (LLM + human workers), H5 (catalog), H6 (multi-strategy), H7 (effort budgets + reproducibility) build on it.
- ✅ Provability arc — Phase G (provable stdlib pilot): `lib/provable.alg` — the first library that walks the talk of the provability arc. Ships utility functions (`abs`, `sign`, `square`, `min2`, `max2`, `negate`) WITH 23 named theorems about their correctness, all checked at module load time. Discharge strategies mixed by appropriateness: F1 PE-as-discharge for concrete-input facts (`abs(0) == 0`, `square(0 - 4) == 16`); F3 combinators for reflexive equalities (`abs_idem_13`, `square_refl by proof_refl(square(3))`); F5 universal-Bool quantification for the involution law (`prove_for_all_bool(b => negate(negate(b)) == b)`). Structural constraints navigated: the lib loader uses plain `runtimeEval` (no nested `use` pre-scan), so the lib can't use the `proven` body-form clause — but `theorem`/`verify` are base-grammar and proof PRIMITIVES (`proof_refl` / `prove_for_all_bool` / etc.) are in the standard env, no import needed. The lib loads via the modules.alg pattern (`extensionToContext` over its non-prim/non-type bindings, exposed as `import provable`). Downstream consumers can state their own theorems about the lib's functions (`theorem t: provable.abs(0 - 100) == 100`) — they discharge via PE on the imported function values. 5 new unit tests + demo (`tests/provable-demo.alg`); 918/918 green. Phase G demonstrates that the F-arc handles real lib code under real load — no panics, no slowdowns, no soundness compromises. The next pilot would extend `lib/math.alg` itself with theorems once the lib loader gains nested-`use` pre-scanning (~10-line change deferred until needed).
- ✅ Provability arc — Phase F7 (`proven` clause on function declarations — [impl, proof] pair surface): the user-visible contract that AI agents target in Phase H. `proven <prop>` body-form clause attaches a theorem to the function being defined; the compiler verifies it at definition time by BOUNDED SAMPLING (Stage F7 minimum, K=4): invoke the function at sample inputs of the param's type, evaluate the predicate, require all true. Failure halts compilation with a concrete counterexample input ("build safety in"). Surface: `lib/proven.alg` adds a `proven cond:expr` stmt_form lowering to `proven_decl_marker(cond)`; `buildBlockExpr` (`src/grammar2/tree-builder.ts`) extracts the marker (multiple `proven` clauses accumulate as independent theorems) and wraps the body with `proven_attach(body, pred1, …, predN)`. Runtime passthrough; the analyzer (`checkProvenClauses` in `src/proven.ts`) peels it. Sampling: `pickSamples(typeCtx)` reads the param type's `__name` + `__abstractDomain` — `Bool` enumerates `[true, false]`; refined `Int` with interval domain (lo, hi) samples `[lo, lo+1, lo+2, lo+3]` clamped to hi (so `NonNeg` → `[0,1,2,3]`, `PositiveInt` → `[1,2,3,4]`); plain `Int` samples `[0, 1, 5, -3]`. Samples wrapped as typed `MultiValue(Bits, type=Int)` so the function's call-site type_check accepts them. Substitution: `substParams` walks the predicate AST replacing Param values whose owner is the function's cfn with the sample; reuses the standard evaluator on the substituted predicate. **Key infrastructure fix**: `isPrimitiveCall` in tree-builder now peels MultiValue-wrapped fn references (the lib's `proven_decl_marker` resolves to a typed UntypedFunction MultiValue when the grammar template evaluates in a typed env) — without this, none of the body-form markers from lib modules would be extracted. `unwrapProvenAttach` lives in `src/totality.ts` alongside the other body-form peelers (added to `_WRAPPER_NAMES` so all peelers can walk through it). Multi-param or non-sampleable types emit a `proven-skipped` info notification, not an error — degenerate but documented. `proven-failed` notifications halt with the same throw shape as effects-mismatch / proof-failure. 8 new unit tests + demo (`tests/proofs-proven-demo.alg`); 912/912 green. With F7 the F-arc is feature-complete for AI collaboration; F6 (Lean export) remains as the long-term trust-chain piece.
- ✅ Provability arc — Phase F5 (universal quantification + bounded induction): two new proof constructors in `src/primitives.ts`, both lazy + composing with F1-F4. **`prove_for_all_bool(predicate)`** discharges `∀b: Bool, predicate(b)` by enumerating the two-value domain: evaluate `predicate(true)` and `predicate(false)` via `evalFn(makeExpr(pred, [fromBool(true|false)]))`; if both fold to `Bits(1)` return a discharged Proof, else a failed Proof naming the missing case(s). **`prove_induction(predicate, base_proof, step_fn)`** discharges `∀n: NonNeg, predicate(n)` by **bounded sample verification** (Stage F5 minimum, documented as such): verify `base_proof` is discharged + `predicate(0)` folds true; for `n = 0..K-1` (K=4) invoke `step_fn(n, ih)` threading the previous step's result as the induction hypothesis, requiring each return to be a discharged Proof AND `predicate(n+1)` to fold true. Full symbolic induction over an unbounded n is a follow-on (would likely need symbolic-n reasoning beyond PE-as-discharge). The induction-step contract is `(n, ih_proof) => proof_of_P(n+1)`; the user owns step correctness across all n. Counterexamples on failure name the specific n + reason: `predicate(1) does not hold` / `step proof failed at n=2` / `base case is not a discharged proof`. Both primitives registered lazy so Proof arguments (the base_proof; the step_fn's outputs) flow through as full MultiValues, not `primaryOf`'d. `lib/tactics.alg` adds two pure-Allegro re-exports (`by_cases_bool`, `by_induction`) for readability. Composition: `theorem t: prove_for_all_bool(...)` works via the F2 `proof_by_eval` passthrough; `verify prove_induction(...)` likewise. 10 new unit tests + demo (`tests/proofs-induction-demo.alg`); 903/903 green. F6 (Lean export) and F7 (`proven` clause — [impl, proof] surface for Phase H) remain.
- ✅ Provability arc — Phase F4 (tactic library — pure Allegro): `lib/tactics.alg` composes the F1–F3 proof primitives into a small library of reusable proof strategies. No new host primitives — F4 is the demonstration that the combinator core is expressive enough to build reusable proof strategies *in the language itself*. Exports: `same(x)` (refl), `flip(p)` (sym), `under(f, p)` (cong), `step(p1, p2)` (binary trans, readable), `chain(ps)` (fold trans over an Array of equality proofs — `[a==b, b==c, c==d] ⊢ a==d`, implemented as `ps.slice(1, ps.length).reduce((acc, p) => proof_trans(acc, p), ps[0])`), `rewrite(eqAB, f, eqFAC)` (substitute a by b inside f, given f(a)==c ⊢ f(b)==c, implemented as `proof_trans(proof_cong(f, proof_sym(eqAB)), eqFAC)`). Tactics flow Proof values through Allegro Params; combinators were already lazy so the full MultiValue (with `__eq_lhs`/`__eq_rhs` + type) reaches them unchanged. The module is loaded via the modules.alg pattern: read source → `evalSource` → collect bindings → `extensionToContext` → `fileTest([{ name: "tactics", bindings: { tactics: ctx } }])`. Failed tactic outputs (e.g. `tactics.chain([e1, e2])` where e1's RHS ≠ e2's LHS) surface through `checkProofs` with the inner reason propagated through `proof_check`. 7 new unit tests + demo (`tests/proofs-tactics-demo.alg`); 891/891 green. F5 (universal quantification + inductive proofs) next.
- ✅ Provability arc — Phase F3 (proof combinators + `theorem … by <proofterm>`): equality proofs gain structure — a discharged proof of `L == R` now carries `__eq_lhs` / `__eq_rhs` (evaluated operands), stashed by an extended `proof_by_eval` when the proposition is structurally `Expression(bits_eq|typed_eq, [L,R])`. Four combinator primitives in `src/primitives.ts`: `proof_refl(x)` (x == x), `proof_sym(p)` (a==b ⊢ b==a), `proof_trans(p1,p2)` (a==b, b==c ⊢ a==c, requires `proofValEqual(p1.rhs, p2.lhs)`), `proof_cong(f,p)` (a==b ⊢ f(a)==f(b), applies f to both sides via `evalFn(makeExpr(f,[side]))`). The `theorem NAME: P by <proofterm>` grammar slot (base-grammar `theorem_decl` gained `opt(seq([ws_req, lit("by"), ws_req, expr]))` — `by` not `=>` to avoid the `a == (b => term)` lambda ambiguity; `by` non-reserved). `proof_check(propSrc, propExpr, proofExpr)` (lazy) enforces SOUNDNESS: the proof term must establish exactly the stated proposition — for equality props it value-matches the proof's `__eq_lhs/__eq_rhs` against the proposition's evaluated sides (so `theorem bad: 1 == 2 by proof_refl(5)` is rejected: "proof term establishes a different equality"); a failed `by` term propagates its inner reason/counterexample ("`by` proof failed: transitivity middle terms differ"); non-equality props fall back to eval-consistency, also accepting a proposition that itself evaluates to a discharged Proof (F2 composition). **Critical fix**: eager primitives receive `primaryOf`'d args (line 358 of evaluator.ts), which strips a Proof MultiValue's `type` component AND structured operands — so all proof combinators + `proof_check` are registered LAZY (they get full MultiValues via their own `evalFn`). Proof recognition is now structural (`proofCtx(v)` checks for the `__discharged` binding) rather than type-component-based, robust to any residual stripping. `theorem_decl` tree-builder rewritten to key off the `:` / `by` delimiters (the earlier forward-`c.find(EXPRESSION_TAGS)` grabbed the theorem-name `ident` — itself an expression tag — as the "proposition", causing `proof_by_eval(src, Symbol(self))` infinite recursion; F1/F2 masked it with `.reverse()`). Named theorems are ordinary referenceable bindings, so combinators nest (`proof_trans(e1, proof_trans(e2, e3))`) and a bare `bad = proof_trans(proof_refl(1), proof_refl(2))` is still surfaced by `checkProofs`. 11 new unit tests + demo (`tests/proofs-combinators-demo.alg`); 883/883 green. F4 (Allegro-side tactic library) next.
- ✅ Provability arc — Phase F2 (proof by refinement-domain entailment): `proof_refines(value, refinedType)` — the second proof constructor (F1 = `proof_by_eval`). Discharges through the SAME abstract-domain lattice as Phase B/C refinement checks (`impliesDomain`) — no parallel proof infrastructure, satisfying the thesis's falsifiable constraint (`docs/VISION.md` §2). Mechanism (`proof_refines_impl` in `src/primitives.ts`, eager): read the refined type's expected domain (`__abstractDomain` set by `buildRefinedType`, or `domainFromPredicate(__predicate)`); read the value's actual domain via the newly-exported `domainOrFromValue` (predicate set → propagated domain → bare-literal `eq(k)`); `impliesDomain(actual, expected)` → discharged Proof, else failed Proof. Counterexamples reuse Phase B's `counterexampleFor` (e.g. `-3 satisfies the value's domain (== -3) but violates \`PositiveInt\` (≥ 1)`). The refined type's own `__name` is rendered (not its meta-type); negative literals render as signed ints (fixed a `bitsToString`-on-int garble). Composition: `proof_by_eval` now passes Proof values through unchanged (an `_isProof(result)` check before the Bits-fold), so `theorem t: proof_refines(5, PositiveInt)` and `verify proof_refines(…)` work — a discharged inner Proof flows out, a failed one propagates its reason. Predicate-set entailment composes: `x = SmallPos(50)` (domain `[1,99]`) discharges `proof_refines(x, NonNeg)` since `[1,99] ⊆ [0,∞)`. Base types with no refinement domain (`proof_refines(5, Int)`) are rejected with guidance to use `proof_by_eval`. `proof_refines` registered eager (both operands are ordinary values, unlike `proof_by_eval`'s lazy proposition). 8 new unit tests + demo (`tests/proofs-refines-demo.alg`); 872/872 green. F3 (proof combinators refl/sym/trans/cong + `=> proofterm` slot) next.
- ✅ Provability arc — Phase F1 (proof terms as first-class values — substrate): proofs become first-class Values discharged by partial evaluation, per the thesis (`docs/VISION.md` §2: PE-as-discharge primary). New `Proof` meta-type in `src/types-std.ts` (`__type = Type`, mirrors the `Effect` meta-type) bound into the standard extension. `makeProof(propSrc)` builds a discharged witness (Context with `__proposition`, `__discharged = 1`); failed proofs are the same shape with `__discharged = 0` plus `__reason` / `__counterexample`. New lazy primitive `proof_by_eval(propSrc, propExpr)` (in `src/primitives.ts`): evaluates the proposition; folds to `true` → discharged Proof; `false` → failed Proof (counterexample `\`P\` evaluates to false`); unresolved → failed Proof (`could not be discharged by evaluation` — F1's contract is provable-BY-EVALUATION, so a residual is a failure of *this* strategy; F2/F3 add others). Surface syntax is **base-grammar** (not an opt-in lib extension — provability is Allegro's defining feature): two new `stmt` alternatives in `src/grammar2/base-grammar.ts` tried before binding/fn_decl/expr — `theorem NAME: <prop>` (a named, referenceable Proof binding) and `verify <prop>` (anonymous one-shot). Neither is a reserved word; `theorem = 42` / `verify = 7` still parse as ordinary bindings via backtracking (same approach as the `grammar` atom). `src/grammar2/tree-builder.ts buildStmt` handles both tags: the proposition's source text is captured via `textOf` (label only, never re-parsed — used for counterexamples / future Lean export) and passed as `proof_by_eval`'s first arg, the proposition AST as the second (lazy, so `proof_by_eval` controls PE). `src/proofs.ts` adds `checkProofs` / `isFailedProof` / `isDischargedProof` / `describeFailedProof` / `formatProofFinding`; the `evalSource` evaluation loop collects failed proofs (named theorem bindings + anonymous verify bare-exprs both evaluate to a Proof) and, post-loop, pushes `proof-failure` error-severity notifications and throws — a failed proof is unsound by construction, same "build safety in" treatment as a failed effects declaration. PE-as-discharge in action: `verify f(2) == 3` discharges because PE evaluates `f(2)` → 3 → `3 == 3` → true, no runtime check survives. Named theorems are ordinary referenceable bindings (combinators that consume them arrive in F3); F1 doesn't yet support the `=> <proofterm>` slot (deferred to F3 where combinators exist). 12 new unit tests + demo (`tests/proofs-demo.alg`); 863/863 green. F2 (refinement-domain discharge via `impliesDomain`) and F3 (proof combinators refl/sym/trans/cong) build on this substrate.
- ✅ Provability arc — Phase E Stage 6 (counterexample rendering): totality notifications now carry an optional `counterexample` field — a concrete trace or sample input illustrating the failure shape. Storage: `Notification.counterexample?: string` (in `src/runtime.ts`); each kind populates it where it can produce a witness. Shapes per kind: (1) **Exhaustiveness over Bool** — `\`f(false)\` is unmatched` (or `true`); `analyzeChain` returns `{ message, missingLiteral? }` so the emission site can build the witness using the binding's name. (2) **Self-recursion no decrease** — `bad(n) → bad(n) [same input passes back]`. (3) **Mutual recursion** — `a(n) → b(n) → a(n) [cycle, no decrease]`, built from the SCC's outgoing edges (caller + every distinct callee in the cycle). (4) **HOF non-decrease** — `recursive_map(arr) calls arr.map(recursive_map) — receiver is not smaller, recursion loops`, using the receiver param's name. (5) **Failing `decreases` clause** — `\`decreases n\` does not decrease on bad(…) → bad(…) at call site`, with the metric rendered (bare Param → name; `typed_array` → `[a, b]`). Helpers: `renderTerminationCounterexample(bindingName, cycleCalls, cfn, scc)` and `renderMetricCounterexample(bindingName, metric, cycleCalls)`. Propagation: `checkExhaustiveness` / `checkTermination` return `{ counterexample? }` on each finding; `runtime.ts` copies it onto the `Notification`. Rendering: `BindingSummary` gets `totalityNotices?: Notification[]`; `summarizeModule` pre-groups totality notifications by `binding` (a single Map walk over `report.notifications`); `renderModuleSummary` surfaces a `totality:` block per binding with each message and indented `counterexample:` line. The introspection `allegro inspect` CLI and web sandbox Inspect button now show concrete witnesses, not just message text. Programmatic consumers read `note.counterexample` directly. 7 new unit tests covering each shape + rendered-summary visibility; 851/851 green; phase E complete (all six stages 0-6 landed).
- ✅ Provability arc — Phase E Stage 5 (HOF-mediated recursion through stdlib `map`/`filter`/`reduce`): the call-graph + cycle-detection machinery from Stages 2-4 sees only `Expression(Symbol(name), …)` direct calls, so a function passed as a callback (e.g. `arr.map(self)`) was invisible to the analyzer. Stage 5 adds a second edge kind: when the body contains `Expression(Expression(type_dispatch, [receiver, Bits("map"|"filter"|"reduce")]), [cb, …])` and any callback is a `Symbol(name)` where `name ∈ cycle`, that's an HOF cycle edge. New `CallSite` discriminated union (`{kind: "direct", …} | {kind: "hof", method, receiver, …}`) flows through `findCallsToCycle` and the verification loop. Verification differs by edge kind: direct calls run `whyNotDecreasing` against the callee's param types (Stages 2-4 path); HOF edges run `whyHofCallNotDecreasing` which checks that the receiver is structurally smaller than a caller parameter. Stage 5 minimum recognises one structural-decrease shape: `param.field` access (i.e. `Expression(type_dispatch, [Param(p), Bits(field)])`) — the field value is a sub-component of the record, so iterating it terminates by structural induction. Bare-Param receivers (`arr.map(self)` on the function's own array param) fail the check and fire. `decreases` clauses skip the HOF check (the metric is the user's contract; we still verify direct calls' positional decrease against the metric, ignoring HOF edges). `partial` opt-out skips everything. New helpers: `matchStdlibHof(e)` recognises the dispatch wrapper; `isHofReceiverStructurallySmaller(recv)` is the param.field test; `whyHofCallNotDecreasing(site)` produces the explanatory message. `collectCalleeNames` was updated in parallel so HOF callbacks contribute to the call graph (otherwise the SCC computation wouldn't see the indirect edge). Composes with Stages 2-4: mutual recursion through HOFs (`a→b via map, b→a via map`) is detected as a size-2 SCC with both edges being HOF kinds; the per-binding message includes the mutual-cycle suffix. Stage 5 minimum doesn't yet verify the field's static type is an Array (the structural-induction argument requires it; non-array fields might violate finiteness in pathological cases). Also doesn't handle `arr.slice(…).map(self)` (receiver is a computed sub-array, not a direct field access) — those fall through to the not-structurally-smaller path. 8 new unit tests + demo (`tests/totality-hof-demo.alg`); 844/844 green. Stage 6 (counterexample rendering) pending.
- ✅ Provability arc — Phase E Stage 4 (mutual recursion via SCC): `checkTermination` in `src/totality.ts` now groups bindings into strongly-connected components of the call graph (Tarjan's algorithm) and treats every cycle uniformly. Self-recursion (SCC size 1 with self-edge) keeps Stage 2's wording; mutual recursion (SCC size ≥ 2) adds a `(mutual recursion cycle: a ↔ b)` suffix and prefixes each cycle-edge reason with `call to \`callee\`:`. Each cycle call is verified against the CALLEE's `paramTypeAsts` — so `a(n: NonNeg): Int => if n == 0 then 0 else b(n - 1)` proves termination through `b`'s NonNeg bound, not `a`'s. Edges to non-cycle members are ignored (the helper `id` alongside an `a↔b` cycle stays silent). New helpers: `collectCalleeNames` walks an Expression DAG collecting Symbol-referenced callee names; `findCallsToCycle` collects every `Expression(Symbol(name), …)` where `name ∈ cycle` in one pass (replaces the self-only `findRecursiveCalls`); `tarjanSCCs` computes the SCC map, skipping graph entries that aren't bindings (top-level value references that happen to share a name with no function). `partial` opt-out is checked per-binding inside the cycle — a partial member of an SCC doesn't auto-discharge the whole cycle; mutual partners still need to prove their own decrease (or be marked partial themselves). The `decreases` clause path uses the caller's own paramTypeAsts (same as Stage 3) since the metric is user-attested. Bindings are materialised once up-front (`bindingList`) because the SCC build needs the full set before the per-binding analysis loop. 6 new unit tests + demo (`tests/totality-mutual-demo.alg`); 834/834 green. Stages 5-6 pending: higher-order propagation through stdlib HOFs, counterexample rendering.
- ✅ Provability arc — Phase E Stage 3 (`decreases <metric>` body-form): new `stmt_form` in `lib/totality.alg` lowers `decreases <expr>` to `decreases_decl_marker(expr)`; the block preprocessor extracts the marker and wraps the function body with `decreases_attach(body, metric)`. `unwrapDecreasesAttach` peels via a shared `findAttachWrapper` helper that handles any combination of `type_check` / `partial_attach` / `decreases_attach` / `effects_attach` / `param_effects_attach` decorators on the head — `unwrapPartialAttach` now uses the same helper so `partial` + `decreases` (or any combination) coexist without order dependence. Analyzer semantics: `decreases` is a user commitment. Stage 3 verifies recognised shapes — (1) bare `Param`: positional decrease via `recognizeParamMinusK`, NO type-bound check (the explicit clause IS the commitment, looser than Stage 2's policy which requires `: NonNeg`); (2) `typed_array(p1, p2, …)` (i.e. array-literal `decreases [a, b]`): lexicographic decrease via `findLexDecreasePosition` — earlier components must pass through unchanged, then some component strictly decreases. Anything else: silent (trust the user). When `decreases` is present, Stage 2's auto-detection is skipped entirely. `partial` opt-out overrides everything. Stage 3 minimum doesn't yet handle `arr.length`, `expr.field`, or general expression metrics — those are recognised as unverified user commitments. 9 new unit tests + demo (`tests/totality-decreases-demo.alg`); 826/826 green.
- ✅ Provability arc — Phase E Stage 2 (structural termination check): `checkTermination` in `src/totality.ts` walks every function binding's body, collects `Expression(Symbol(fnName), …)` recursive calls, and tries to find a position `i` whose arg is `bits_sub(Param(pos=i), Bits k)` with `k > 0` where the param's type's `__abstractDomain` has `lo >= 0` (interval) or `value >= 0` (equal). When found, the call is provably decreasing on a well-founded order. Confidence policy: emit `totality-nontermination` (severity `info` default) only when (a) recursion exists AND no parameter decreases, OR (b) decrease detected but the param's static type is unbounded below — message names the param and suggests `NonNeg` / similar. Silent on non-recursive functions and on untyped recursion (existing Allegro code stays clean). Symbol-typed annotations (`n: NonNeg` where `NonNeg = Int & _ >= 0` is a top-level binding) resolve via a `totalityCompileCtx` mirroring `precompileFunctions`' setup (primitives + extensions + source bindings), so user-defined refinement types evaluate on demand and yield Contexts carrying `__abstractDomain`. `lib/totality.alg`'s `partial` opt-out skips the termination check too. Stage 2 minimum recognises the `param - K` arithmetic pattern only; Stage 3 adds user-supplied `decreases` metrics for non-structural recursion, Stage 4 handles mutual recursion via call-graph analysis with lexicographic measures, Stage 5 propagates totality through stdlib HOFs. 7 new unit tests + demo (`tests/totality-termination-demo.alg`); 817/817 green.
- ✅ Provability arc — Phase E Stage 0+1 (totality substrate + exhaustiveness for `when/is/then`): `partial` body-form (via `lib/totality.alg`) opts a function out of the totality analyzer; lowers to a `partial_attach(body)` wrapper that `isFunctionPartial` / `unwrapPartialAttach` in `src/totality.ts` peel. Three notification kinds reserved (`totality-exhaustiveness`, `totality-nontermination`, `totality-needs-annotation`), all default to `info` so adoption is non-breaking. Stage 1: `checkExhaustiveness` walks every function binding's `eval_when` chains; for each chain without an explicit `else` or wildcard / bind-to-name catch-all, resolves the subject's static type (Param via the typed_function signature's paramType ASTs + Symbol lookup against extensions) and emits a notification when the type is finite-domain Bool with missing literals (e.g. `is true` without `is false`), or uncountable (Int/Float/String) with no fallback. Confidence policy: stay silent when the subject type can't be determined — false positives erode trust. Prerequisite fix: `eval_when` now returns a residual when its subject is unresolved (Rule 2 analogue) — previously fell through to `when_no_match` which threw, producing spurious precompile errors that masked the totality issue. 9 new unit tests + 2 demos (`tests/totality-partial-demo.alg`, `tests/totality-exhaustiveness-demo.alg`); 809/809 green. Stages 2-6 pending: structural termination, `decreases` body-form, mutual recursion, higher-order propagation, counterexample rendering.
- ✅ Provability arc — Phase D1 Slice 2 F1-F3 cleanup (walker removal + notification migration + universalize precompile): the walker is now deleted — `inferFunctionEffects`, `walkValueEffects`, `effectsOfFunctionArg`, `effectsOfWithFallback`, `effectPredicatesForFunction`, `effectPredicatesForValue` (~290 LOC) all removed from `src/effects.ts`. Effects flow purely through PE: `applyPrimitive` propagation (F1), Param-call residual effects reading `Param.effectBound` (F2), and compile-time deferral of effectful primitives (F3a) cover every shape the walker handled. To get there cleanly: (1) `precompileFunctions` driver now precompiles untyped top-level functions and bare ComposedFunction bindings too (passes empty paramTypes → bare-Param placeholders; effect inference works, return-type inference is weaker without typed args); (2) `effectsOf` reads `__inferredEffects` from ComposedFunction primaries as a fallback to the MultiValue component, so bare ComposedFunctions surface their stashed effects through the same canonical accessor; (3) `precompileFunction` consumes TailCalls in its own loop — untyped tail-recursive bodies like `forwarder(g, y) => apply(g, y)` previously returned an unconsumed TailCall sentinel and dropped the inferred effects. `CompilationReport` migration: `errors[]` collapsed into `notifications[]` where each entry carries a stable `kind` tag and `severity: "error" | "warning" | "info"`; helpers `notificationsBySeverity` / `reportErrors` / `reportHasErrors` filter by tier. Push sites tag with `effects-mismatch` / `return-type-mismatch` / `precompile-eval` / `precompile-type-error` (error) and `effects-opaque-from-stdlib-hof` (info). Per-project severity remap by `kind` is the next step; substrate is ready. `Param.predicates` slot stays reserved for future refinement bounds (F2 moved effect bounds to `Param.effectBound`). Stage C3's auto-promotion test reframed: PE now resolves inline lambdas precisely on BOTH annotated and auto-promoted sides — the explicit `[e: Effect]` declaration still matters when the cb is a forwarded param (the case PE alone can't resolve). 9 files touched, 254 added / 420 removed; 793/793 green; demos pass.
- ✅ Provability arc — Phase D1 Slice 2 Stage F3b (stdlib HOF migration): with F1 PE-driven effects + F2 polymorphic Param-call propagation + F3a compile-time deferral all in place, the Slice-1.3 `opaque` placeholders on Array.map/filter/reduce + the walker's `type_dispatch(obj, "map" | "filter" | "reduce")` heuristic become unnecessary. Both removed. `arr.map(io_cb)` now propagates the cb's io effect to the caller's inferred set instead of conservatively marking opaque. Mechanism: `arr.map(cb)` evaluates the bound primitive (no effects tag now), which delegates to the Allegro-built `mapAllegro` whose body's `fn(arr[i])` is a Param-call. PE's F2c Param-call branch reads `Param.effectBound` (or, for unannotated Params, defaults to opaque) — but mapAllegro's `fn` Param has no annotation, so it'd be opaque without one more piece. The new piece (F3b): `typed_function_impl` precompiles inline typed lambdas on first evaluation via a precompile-on-evaluate hook, so the cb's body PE'd effects component populates and the `applyPrimitive` arg-effects loop sees `{io}`. A `_precompileInProgress` WeakSet guards against infinite recursion on self-referential bodies (`factorial(n) => factorial(n-1)`). Pre-existing tests that explicitly verified the opaque-tag behavior (`Phase D1.3: function calling Array.map gets opaque in inferred set`, `Phase D1.3: opaque-from-stdlib-hof emits a notification`) updated to verify the new precise propagation. 6 new tests + end-to-end demo (`tests/hof-effect-propagation-demo.alg`); 793/793 green; basics.alg unchanged.
- ✅ Provability arc — Phase D1 Slice 2 Stage F3a (compile-time deferral of effectful primitives): when PE evaluates a primitive's args inside a function body being precompiled (`ctx.__compileMode = true`) and the primitive carries a non-empty `.effects` tag, `applyPrimitive` returns a residual `makeExpr(fn, evalArgs)` instead of executing the impl. The residual still carries the effects component so the inferred set surfaces upward via PE; the side effect fires when the function is invoked at runtime where ctx isn't compile-mode. Fixes a long-standing latent issue where `print("trace")` inside a function body fired during precompile (precompile evaluates the body for type/effect inference; lazy primitives like print bypassed any deferral check). `precompileFunction` sets/restores `__compileMode` on its ctx around the body evaluation; `applyComposed`'s `enrichedCtx` and `augmentScopePredicates` propagate the flag through ctx-creation points so deferral applies in transitively-called function bodies and inside if-branches during precompile. Both eager and lazy primitive paths in `applyPrimitive` honor the flag — the lazy path was the actual culprit since print/fetch/delay are all lazy. Pure primitives still fold eagerly (deferral keys off `.effects` length); only effectful ones defer. Top-level bare expressions execute as before (they're not under precompile, so no flag is set). Declaration check still works because effects propagate through the residual via the effects component. 6 new tests covering capture-stdout verification of compile-time non-firing, runtime fire-on-call, top-level immediate fire, pure-primitive folding, deferred-residual effects component, and declaration-check still firing under deferral.
- ✅ Provability arc — Phase D1 Slice 2 Stage F2 (consumer migration to effects component + Param.effectBound + PE polymorphic propagation): Param storage migrates from `predicates: PredicateSet` (carrying effect bounds as effects-bound predicates) to a dedicated `effectBound: EffectSet` slot — refinement bounds stay reserved on `predicates` for future use, effects describe computations and live separately. `typed_function_impl` now writes effect bounds (Stage A `f: pure`, Stage C2 `__effectvar:NAME` markers, Stage D `param_effects` peel-and-stamp) directly to `Param.effectBound`. The walker (`walkValueEffects`) and PE Param-call handling read from `effectBound` directly. `subst`/`remapParams` clones preserve `effectBound` across substitution. PE Param-call propagation: when `evaluateExpr` reaches a residual `Expression(fn=unresolvedParam, args)` (typical inside polymorphic function bodies after precompile placeholder substitution), the residual carries the param's `effectBound` labels via the effects component — without this, polymorphic forwarders like `apply[e](g: e, x): Int => g(x)` would lose their effect-variable markers and `caller(x): Int => apply(printer, x)` would not infer io. Unannotated function-typed Params default to `opaque` in this path, matching the walker's conservative semantics. `precompileFunction` now copies `effectBound` onto the placeholder Params it creates so the substituted body reads the right metadata. Consumer migration: `checkEffectsDeclarations` reads `cFn.__inferredEffects` (PE-stashed) before falling back to the walker; introspection (`summarizeValue`) does the same. `checkArgType` (Stage A bound) and `type_check_impl` read effects via `effectsOfWithFallback(arg)` — direct component first, walker fallback for legacy untyped functions. The Stage D Surface C call-site enforcement skips Stage C2 marker bounds (labels starting with `__effectvar:`) since those are placeholders the walker resolves at call sites, not concrete bounds. Walker stays alive as the legacy fallback path; F3 will add compile-time deferral and remove the parallel infrastructure.
- ✅ Provability arc — Phase D1 Slice 2 Stage F1 (effects-as-component substrate, PE-driven): effects move from a parallel walker pass into a first-class MultiValue component named `"effects"`, alongside `type` and `error`. `src/effects.ts` adds `EFFECTS_COMPONENT_KEY`, `withEffects(v, eff)`, `effectsOf(v): EffectSet | null`, and `unionEffectSets(...)`; storage mirrors `withPredicates` (Context with JS-side `__effectSet`). `applyPrimitive` in `src/evaluator.ts` propagates effects via PE: eager primitives union the primitive's static `.effects` tags + each evaluated arg's `effects` component + the result's own component (set when method dispatch attaches it directly); lazy primitives accumulate via a tracking `evalFn` wrapper so `seq`, `eval_if` (Rule 2 unions both branches naturally), `effects_attach`, `type_check` all flow without per-primitive bookkeeping. Function values get their inferred effect set stamped at precompile time: `precompileFunction` now returns `inferredEffects: EffectSet | null` and stashes the body-result's effects on `cFn.__inferredEffects`; `typed_function_impl` reads the stash and attaches the `effects` component to the returned MultiValue, so `effectsOf(fn)` returns the PE-derived set directly. The existing predicate-set / walker machinery stays alive in parallel during the F1→F2 migration; consumers (`checkEffectsDeclarations`, introspection) still use the walker today and migrate in the next slice. Pure-literal arithmetic stays uninstrumented (no effects component appears unless something fires). Architectural payoff: effects describe COMPUTATIONS (function values, deferred residuals) — refinements describe DATA — the component split makes the distinction structural, prevents the lattice cross-contamination from earlier inversions (1.2 / Stage A), and sets up compile-time deferral as a one-component-lookup decision in F3. Two design memos to consult before F2: (1) the orthogonality argument — types and effects share infrastructure today but have no productive reasoning interplay; (2) effects naturally live on function values, not on data values.
- ✅ Provability arc — Phase D1 Slice 2 Stage E (function-type-expression syntax): `(A) => B` is now parseable in any type-expression position. Lowers to `type_function(paramType1, …, paramTypeN, returnType)`, which evaluates to a concrete `Function[ParamTypes, ReturnType]` identical to what `makeFunctionType` produces in TypeScript. Multi-param `(A, B) => C`, zero-param `() => A`, and curried `(A) => (B) => C` (right-recursive on return type) all work. Composes with generics: `Array[(Int) => Int]` is an array of `Int → Int` functions. Grammar lives in `type_expr_atom` (tried before `type_generic` so the `(` opener is unambiguous); lambda parsing only fires in expression position so there's no clash. Tree-builder finds nested `type_function` branches via the existing `findTypeExpr` helper (extended to recognise the new tag) and lowers them via `buildTypeExpr`. New `type_function` primitive evaluates each arg, takes the last as the return type, and builds the FunctionType. Type compatibility falls out of the existing FunctionType machinery — type_check, unification, and call-site enforcement work unchanged. Limit: `instanceof (Int) => Int` doesn't work since `instanceof`'s right side parses as an expression, where `(Int) => Int` is read as a lambda; use `instanceof Function[…]` for that case once generic args resolve cleanly. Stage E does NOT yet improve Array.map/filter/reduce effect propagation (still tagged `opaque` per Slice 1.3); that's the follow-on slice that uses this syntax to express polymorphic stdlib HOF types.
- ✅ Provability arc — Phase D1 Slice 2 Stage D (Surface C `param_effects` body-form): the effect-bound declaration alternative to Surface A's param-type slot. Useful when the param has a non-trivial type and you don't want to fold the effect into the type expression. `lib/effects.alg` adds a stmt_form `param_effects n:ident ":" e:ident` (paired with the existing `effects` clause; multi-param via repeated declarations). Block-expr preprocessor (`src/grammar2/tree-builder.ts buildBlockExpr`) extracts `param_effects_decl_marker(paramRef, effSym)` calls and wraps the body's result with `param_effects_attach(body, paramRef1, effSym1, …)` (lazy passthrough at runtime, metadata for the analyzer). `typed_function_impl` peels one `type_check` layer (matching `unwrapEffectsAttach`'s peel from C3) then peels `param_effects_attach`, evaluates each effect Symbol against the call ctx so `pure`/`io`/etc. resolve via extensions, and stamps the matching Param's predicates from the Effect type's `__effectBound` — by-name match against `cFn.params[i]._name` survives `remapParams` clones since names are preserved. Call-site enforcement: `evaluator.applyComposed` checks Param.predicates as a fallback when the param-type slot lacks `__effectBound`, running the same `impliesDomain` discharge with attribution `(from param_effects)` in error messages so users can tell which surface produced the bound. Walker propagation works automatically — the existing Stage B `Expression(Param(p), …)` branch reads `p.predicates.effectiveEffects()` regardless of which surface stamped it. Surface A and C can coexist on the same param (both stamp; C runs last so it wins on identical declarations; conflict detection is future polish). Demo: `tests/effects-surface-c-demo.alg`.
- ✅ Provability arc — Phase D1 Slice 2 Stage C3 (multi-variable polymorphism + effect-conjunction at value level + declaration-check repair): multi-variable cases (`apply2[e1: Effect, e2: Effect](g1: e1, g2: e2, …)`) and idempotence (`twice[e: Effect](f: e, x): f(f(x))`) fall out of Stage C2's walker for free — per-marker positional resolution and Set-based dedup handle them without new code. Effect-conjunction at the value level: `typed_amp_impl` detects Effect-extending operands (via `__extends` chain identity check `isEffectExtending`), evaluates the right-side thunk, and dispatches to `effectUnion` (lattice join: `pure & pure = pure`, `io & opaque = opaque`, anonymous compounds coerce to `opaque` until anonymous-conjunction representation lands). Two declaration-check repairs surfaced while validating: (1) `asFunction` in `src/effects.ts` peels unevaluated `typed_function(ComposedFunction(…), …)` Expressions so `checkEffectsDeclarations` reaches typed function bodies pre-evaluation — previously the check silently skipped any function with a return-type annotation; (2) `unwrapEffectsAttach` peels one layer of `type_check(…, returnType)` (the wrapper `maybeTyped` adds for typed-return functions). `__effectvar:NAME` markers in the inferred set are normalised to bare names against the declared set so polymorphic `effects e` declarations verify at definition time without false-positive mismatch. Auto-promotion: an unannotated function-typed param produces `opaque` honestly (no silent zero) — the explicit `[e: Effect]` declaration is what enables precise propagation, validating the falsifiable hypothesis that explicit declaration is the contract surface, not the auto-promoted form.
- ✅ Provability arc — Phase D1 Slice 2 Stage C2 (effect-variable unification at call sites): when a paramType is a Symbol matching an Effect-kinded entry in the function's `__genericParams`, `typed_function_impl` stamps the Param's predicates with a variable marker (`{labels: ["__effectvar:NAME"]}`) and records `__effectVarParams: Map<string, number[]>` on the ComposedFunction. The walker (`walkValueEffects`) detects ComposedFunction calls whose callee carries `__effectVarParams`, and at each call site replaces variable-marker labels in the recursed inferred set with the actual effects of the corresponding arg via `effectsOfFunctionArg`. Cross-binding Symbol references (e.g. `forwarder` calling `apply`) resolve through an optional `EffectsLookup` callback (`(name) => evalCtx.bindings.get(name)?.value`) threaded through `inferFunctionEffects` / `walkValueEffects` / `effectsOfFunctionArg`. `effectsOfFunctionArg` also peers into `typed_function(fn, …)` call expressions so inline annotated lambdas (`(y: Int): Int => y * 2`) resolve precisely. Critical correctness fix: `typeLiterals`, `resolveSymbols`, `subst`, and `remapParams` now preserve `__genericParams` and `__effectVarParams` across ComposedFunction clones — without this, the metadata was being stripped during pre-evaluation passes and polymorphic resolution silently fell back to opaque. Result: `apply((y) => y * 2, 7)` infers pure; `apply((y) => print(y), 7)` infers `io`; forwarding an unbounded param infers opaque (conservative); forwarding a `f: pure` param infers pure precisely.
- ✅ Provability arc — Phase D1 Slice 2 Stage C1 (generic param list grammar): function declarations now accept an optional `[generic_decl]` between the function name and the parameter parens — `id[T](x: T): T => x`, `apply[e: Effect](g: e, x: Int): Int => g(x)`, `pair[T, U](x: T, y: U): T => x`. Each generic param is `id` (kind defaults to `Type`) or `id : type_expr` (explicit kind). Grammar (`base-grammar.ts`) adds `generic_param`, `generic_param_list`, `generic_decl` productions and threads `opt(generic_decl)` into `fn_decl` and `export_fn_decl`. Tree-builder (`tree-builder.ts`) collects the params via `collectGenericParams` and stamps the underlying `ComposedFunction` with a `__genericParams: { name, kind? }[]` array — survives `typed_function` envelope wrapping since the ComposedFunction identity persists. Behaviour change is minimal: existing auto-promotion (unannotated identifiers in type positions = type variables) continues to work as before; the explicit declaration is documentation today and the substrate Stage C2 consumes for effect-variable unification dispatch. The `f[T]` parsing ambiguity at expression position is moot — declaration position has the unambiguous `name [generic_decl] (` shape.
- ✅ Provability arc — Phase D1 Slice 2 Stage B (HOF inference walker): when the static walker encounters `Expression(Param(p), …)` (a function-typed parameter being called), it pulls `p.predicates.effectiveEffects()` and adds those labels to the inferred set. With no bound declared, the param is treated as `opaque` — honest about the unknown rather than silently zero-effect. `typed_function_impl` stamps `Param.predicates` from each paramType's `__effectBound` at definition time, so `f: pure` flows from annotation through to walker visibility. New `PredicateSource` value `"effects-bound"` distinguishes param annotations from `"effects-declared"` (function-body clause) and `"effects-inferred"` (computed). The 1.3 `type_dispatch(obj, "map" | …)` heuristic stays — it handles a different case (stdlib HOFs called on dynamic receivers) and gets cleaner only when stdlib HOFs land in `lib/collections.alg` with full polymorphic types (Stage E). Alias tracking (`g = f; arr.map(g)`) falls out of normal predicate propagation — no new code. Functions with `effects pure` declarations on unbounded param calls emit the existing `effects-opaque-from-stdlib-hof` notification; with `f: pure` bounds the inferred set is precise and no notification fires.
- ✅ Provability arc — Phase D1 Slice 2 Stage A (effect bounds via `type_check`): `f: pure` and binding annotations `x: pure = …` now discharge through the same `type_check_impl` / `checkArgType` path numeric refinements use — no parallel infrastructure. `buildEffect` attaches an `__effectBound: EffectsDomain` to each Effect-extending type at construction (`pure` → `{labels: ∅}`; `opaque` → no bound, universal pass; named effects → `{labels: {name}}`). The discharge pulls the arg's effect predicate set via `effectPredicatesForFunction` (the on-demand derivation from D1.2), takes its `effectiveEffects()`, and runs `impliesDomain(actual, bound)` — predicate-implication semantics: actual ⊆ bound. The 1.2 inversion in `impliesDomain` for effects (which had used capability semantics, opposite of numerics) is fixed; the user-facing `effectImplies` in `types-std.ts` keeps capability semantics as the value-side `Effect.implies` operator. `ParamValue` gains an optional `predicates: PredicateSet` field — initialised to undefined at `makeParam`, carried through `subst()`'s `remapParams` clone — so the HOF walker (Stage B) can read param-level effect bounds directly without a side-table on `ComposedFunctionValue`.
- ✅ Provability arc — Phase D1 Slice 2 Stage 0 (`&` for type/effect conjunction): added `&` as a distinct infix operator at a new precedence level (`amp`, between `or` and `and`) so refinements and effect conjunctions read on a separate axis from logical AND. `typed_amp_impl` handles the type-side cases (refinement creation now; type intersection and effect conjunction in later stages). `typed_and_impl` simplified to purely logical AND. All existing refinement uses (`Int && _ > 0`) migrated to `&` (`Int & _ > 0`) across `lib/math.alg`, `lib/contracts.alg` (comment), and the `tests/refinements.alg` / `tests/contracts-demo.alg` / `tests/refinement-propagation-demo.alg` / `tests/refinement-subtype-demo.alg` / `tests/predicate-set-demo.alg` / `tests/math-pilot-demo.alg` / `tests/invariant-demo.alg` files plus inline test-suite assertions. Compound predicates (`Int & _ > 0 && _ < 100`) now build a *single* refinement with a compound predicate body — `domainFromPredicate` recognises the conjunction as one interval `[1, 99]`, more precise than the previous chained-refinement form's per-clause domain.
- ✅ Provability arc — Phase D1 sub-chunk 1.3 (Notification category + opaque marking on stdlib HOFs): `CompilationReport` gains a `notifications: Notification[]` collection (`Notification = { kind, message, binding? }`) for informational diagnostics that don't halt compilation. `buildType` / `buildGenericType` accept `methodEffects: Record<string, string[]>`; `Array.map` / `Array.filter` / `Array.reduce` are tagged `effects: ["opaque"]` so callers' inferred sets reflect the soundness limit until Slice 2's effect polymorphism resolves precisely. Bound primitives produced by `type_dispatch` propagate the underlying primitive's effects (previously stripped). Static walker in `src/effects.ts` recognises `type_dispatch(obj, "map" | "filter" | "reduce")` patterns and adds `opaque` (necessary because the static walk can't follow runtime dot-dispatch through `type_dispatch`). `checkEffectsDeclarations` filters `opaque` out of mismatch computation so `effects pure` functions calling stdlib HOFs don't halt; `opaqueEffectNotices` emits a separate `effects-opaque-from-stdlib-hof` notification for visibility. Per-project notification severity (notification → error/warning/ignore) tracked separately on the backlog.
- ✅ Provability arc — Phase C Chunk 3 (`requires` / `ensures` body-form contracts): function bodies can declare contracts at the head:
  ```
  divide(a, b) =>
    requires b != 0
    ensures _ != 0 || a == 0
    a / b
  ```
  Surface syntax via `use contracts` activates `lib/contracts.alg` grammar (stmt_forms `requires`, `ensures` lowering to `requires_stmt(P)` / `ensures_decl(P)` markers). The block-expression tree-builder (`src/grammar2/tree-builder.ts buildBlockExpr`) preprocesses contract markers at parse time: `requires_stmt(P)` calls are hoisted to the front of the body so preconditions check before any body statement runs; `ensures_decl(P)` calls are extracted, their predicate is compiled via `buildFn(["_"], P)` into a one-param lambda, and the body's result expression is wrapped with `ensures_check(result, lambda)`. `seq` primitive sequences the requires checks, body statements, and ensures-wrapped result so side effects fire in source order. `requires_stmt` mirrors `assert_stmt` but tags discharged predicates with `source: "requires"` and reports failures as "precondition failed". `ensures_check` runs the lambda against the result; on success attaches the predicate domain to the result's set with `source: "ensures"` so callers see the post-condition; on failure throws `AllegroError("postcondition failed")`. Static discharge via predicate-set entailment short-circuits both runtime checks. Introspection: `ValueSummary` gains `requires` / `ensures` / `promotionSuggestions` arrays; the rendered summary lists each contract; in-body asserts that reference only function parameters get flagged as candidates for promotion to `requires`. Pilot: `lib/math.alg` adds `divide`. Demo: `tests/contracts-demo.alg`. Phases D–J build on this: effect types, totality, proofs, provable stdlib, AI collaboration protocol, codegen, review UX.
