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

## 1. What Allegretto is for

> **Level: Requirement.** Proposed 2026-08 from maintainer direction;
> R1–R7 await ratification as a set.

### R1 — Allegretto is the simplest base language that can carry Allegro

Allegretto is not a language anyone is meant to write programs in. Its whole
purpose is to be the substrate Allegro Standard is *built on* — as an
extension stack, not as a privileged layer. Every feature it has must earn
its place by being something Allegro cannot be built without.

*Consequence.* "Would Allegro still work without this?" is a legitimate
challenge to any part of Allegretto, and the answer must be evidence, not
preference.

### R2 — Partial evaluation is the mechanism by which layers are added

Types, effects, proofs, refinements, contracts and error handling are not
built into the base. They are built **on** it, and the tool that makes that
possible is partial evaluation: a program is evaluated as far as its known
inputs allow, and what cannot be resolved becomes a residual that is itself
an ordinary value. Checking is therefore not a separate pass over a separate
IR — it is evaluation that ran far enough to answer, and *discharge* is the
same act as computing.

*Consequence.* Anything Allegro needs to check must be expressible as
something Allegretto can evaluate. This is the requirement that forces R3.

### R3 — Values carry metadata, and each channel is processed orthogonally

A value must be able to carry information *about* itself — its type, what is
known about it, what effects produced it, whether it is in error, what proved
it — alongside the data it *is*. Each such **channel** must be processed
independently of the others: adding a channel must not require changing how
any existing channel propagates, and no operation may need to know the full
channel set.

*Rationale.* Without this, every layer Allegro adds would have to thread its
own information through every operation by hand, and layers would not
compose — the type layer would have to know about the effect layer to avoid
dropping its data. Orthogonality is what allows R2's "build it on top" to
mean *actually* on top.

*Consequence.* The propagation table (T2 §10) is not an implementation
convenience; it is the mechanism that makes this requirement hold, and
hand-rolling per-channel logic anywhere is a direct violation.

### R4 — Evaluation is total over the value space

The evaluator must have a rule for every value it can meet. An unresolved
input produces a **residual**, never a failure to proceed. Failure is a
value (the error channel), not a control-flow escape from evaluation.

*Rationale.* R2 depends on this completely. If evaluation could get stuck,
partial evaluation would be partial in the wrong sense: a program could fail
to compile because it could not be *run*, and the compile/run distinction
Allegro dissolves would come back.

### R5 — Metadata survives evaluation

A channel attached to a value before an operation must be observable after
it, according to that channel's declared propagation rule. A channel that
could be silently dropped by an unrelated operation would make every layer
built on it unsound.

*Consequence.* This is why primitives receive **full** values and read data
through the data-plane accessor. A primitive that unwrapped its arguments
would satisfy its own contract and violate this one invisibly.

### R6 — The base does not know about the layers

No concept belonging to Allegro Standard — type, effect, proof, refinement,
contract — may appear in Allegretto. Dependencies point downward only.

*Rationale.* This is what makes Allegro a *curated extension stack* rather
than a privileged layer, and therefore what makes the platform programmable
by anyone else. A base that knew about types would make "the type system is
an extension" a fiction.

*Note.* R6 is stated about **concepts**, not about mechanism. Allegretto
provides the channel plane; it does not know that one channel is called
`type`. That distinction is load-bearing and is where this requirement is
most easily violated by accident.

### R7 — Allegretto is replaceable

Any implementation satisfying R1–R6 supports Allegro. Allegretto is subject
to change at any time — in host implementation (replatforming, bootstrapping
into itself) or in specification (a different metadata mechanism) — provided
the changes continue to support Allegro's design goals.

*Consequence.* This is not a licence for churn; it is the statement that
**everything below this line is an implementation choice unless it is
traced to R1–R6.** It is the reason the register in §2 exists, and the reason
every entry in T0–T5 carries a level.

## 2. Implementation choice register

> **Level: Implementation.** Each entry records the alternatives that were
> available, the criterion that selected one, and what would justify
> revisiting it. A choice with no recorded alternatives cannot later be
> evaluated — which is precisely how "did that actually simplify things?"
> became unanswerable.

### IC-1 — Bits rather than a set of primitive types

*Realises:* R1, R6.

**Chosen.** One uninterpreted scalar representation: a bit vector with a
known length. `Int`, `Float`, `String` and `Bool` are all Bits with a type
attached at L2.

| Alternative | Why not |
|---|---|
| A fixed set of primitives (int/float/string/bool) | Violates R6 — the base would know a numeric tower it did not need, and Allegro could not redefine it |
| Tagged scalars (value + kind tag) | The tag is a degenerate type channel; R3 already provides one, better |

*Criterion:* minimality under R1, layer-ignorance under R6.
*Revisit if:* a numeric or textual operation cannot be expressed at L2
without the base knowing its semantics.
*Status:* holding. No recorded pressure against it.

### IC-2 — One Structure rather than two (MultiValue + Context)

*Realises:* R3 (metadata attachment), and the composite half of R1.

**Chosen** at D1, completed at D46. Originally two representations: a
*MultiValue* (a primary value plus named components) and a *Context* (named
bindings). These were condensed into one `Structure` whose former MultiValue
role became the **carrier configuration**.

**This choice is under active doubt, and the doubt is well-founded.** The
recorded rationale was never conceptual simplification:

- `structures.md` I1 states the payoff as *"known type ⇒ known shape ⇒ slot
  access compiles to offsets (feeds codegen)"* — a **future codegen**
  argument.
- The class comment states all fields are declared up front *"so every
  structure shares a single hidden class"* — a **present V8** argument.

Neither claims the concept got simpler, and measurement says it did not:

| Measure | Value |
|---|---|
| Declared fields on `Structure` | **11** |
| Role-groups those fields partition into | **4** (carrier, record, dense, scope) + 2 universal |
| Sites that discriminate role by field presence | **146** (`.primary` 67, `.dense` 21, `.components` 20, `isCarrier` 14, `isScope` 13, `isDense` 6, `viewMaterialized` 5) |
| Constructors | 3 (`newMultiValueStructure`, `newContextStructure`, `newDenseStructure`) |

So the count of *representations* went 2 → 1 while the count of
*configurations* went 2 → 4, and the variation moved from an explicit kind
tag to implicit field presence, read at 146 sites. That is a reasonable trade
for a performance goal and a poor one for a comprehension goal — and it was
only ever read as the latter because the levels were not separated. **This
entry is the clearest instance of the confusion Part 0 exists to prevent.**

| Alternative | Trade |
|---|---|
| Two representations (the original) | Explicit about carrier vs record; costs one more kind in the base |
| One representation, explicit role **tag** | Same field surface, but role is stated rather than inferred; removes the 146 presence-checks in favour of one discriminant |
| One representation, genuinely one role (§IC-3 option E) | The only option that actually simplifies; largest change |

*Criterion applied:* host performance + future codegen.
*Criterion NOT applied:* conceptual economy under R1.
*Revisit:* **now** — this is IC-3's question, and B-108 carries it.

### IC-3 — Map-keyed composite rather than sequence-first

*Realises:* the composite half of R1; scope lookup for R2.

**Chosen.** The deepest composite is a string-keyed map (plus an ordered
list view). Arrays are a numeric-keyed special case with a dense array
region. Channels are a second map.

The maintainer's alternative — LISP-style, with an ordered sequence as the
deepest structure and maps built on top — deserves the comparison it never
got:

| | **A · map-first** (current) | **B · sequence-first** | **C · two representations** | **E · one entry-sequence** |
|---|---|---|---|---|
| Deepest composite | string-keyed map | ordered sequence | MultiValue + Context | sequence of `(key?, value)` entries |
| Positional data | special case (dense region) + a materialized legacy view | native | special case | native (entries with no key) |
| Name lookup | O(1) | O(n) or a derived index | O(1) | O(n) raw; O(1) with an index below the spec |
| Channels | second map | sequence of pairs; O(n) per read | native to MultiValue | second entry-sequence |
| Spec/impl distance | wide — spec says one composite, impl has four configurations | narrow | narrow | narrow |
| Cost of the gap | 146 role-presence sites; `__length`; the legacy view | derived-map machinery at L0 | one extra base kind | index is an impl detail, invisible above |

**The argument for B that is usually missed:** O(n) name lookup is only
expensive if lookup happens at *runtime*. Under R2 most scope resolution
happens once, at `resolveSymbols`, not per evaluation — so the asymptotics
that rule out association lists in an interpreter argue much more weakly in a
partial evaluator. This is worth measuring rather than assuming; it is the
kind of claim that has been wrong in both directions in this codebase.

**The argument against B:** channel reads are genuinely hot and genuinely
by-name — `dataOf` and the channel read sit on every operation — so R3+R5
push toward keyed access at the one place B makes it linear.

**Option E is the one nobody proposed.** A single composite that is an
ordered sequence of optionally-keyed entries is *both* a map and a list: a
record is entries with keys, an array is entries without. The dense region
stops being a role and becomes a representation optimisation **below** the
specification, invisible above it — which is what the dense region should
always have been, and would dissolve `__length`, the legacy view, and the W6
invariant along with it.

*Criterion applied:* interpreter-shaped performance intuition.
*Criterion that should apply:* spec/implementation distance under R7 — how
much of the implementation is invisible from the specification.
*Revisit:* **now.** → **B-108.**

### IC-4 — Channels by wrapping rather than on every value

*Realises:* R3.

**Chosen.** A non-composite value carries channels by being wrapped in a
**carrier** — a Structure whose data plane is empty and whose `primary` is
the wrapped value.

| Alternative | Trade |
|---|---|
| Every value has an optional channel map | Deletes the carrier concept entirely: no `primary`, no 67 presence-checks, no W1 non-nesting invariant, no `dataOf` indirection. Costs an optional field on every representation, including Bits — which stops "Bits is just bits" from being literally true |

This one has never been written down as a choice at all, which is why it has
no recorded criterion. It is the largest single source of accidental
complexity in T0 measured by call sites, and it is a genuine trade rather
than an obvious win either way.

*Criterion applied:* unrecorded.
*Revisit:* with IC-3 — the two interact. → **B-108.**

### IC-5 — Symbol identity by interned FQN

*Realises:* R6 (the base provides identity; L2 decides what identity *means*).

**Chosen.** Registered symbols are interned by fully-qualified name, so the
same FQN is the same object; transient parser symbols carry no FQN and
resolve by base name.

| Alternative | Trade |
|---|---|
| Name-string comparison | Two types could not each have a member spelled `size` without conforming; D44 removed exactly this class of false positive |
| Opaque gensym identity | Loses the human-readable projection that printing, error messages and loose matching all rely on |

*Criterion:* conformance must be an identity question, not a spelling one.
*Status:* holding — D44 is the evidence that the alternative was tried and
failed.

### IC-6 — Scopes as a parent chain rather than flattened environments

*Realises:* R2 (call-site specialisation must be cheap).

**Chosen.** O(1) extend, chain-walking lookup.

| Alternative | Trade |
|---|---|
| Flatten-copy on extend | O(n) per call site; this was the prior implementation and the hot path that motivated the change |

*Criterion:* cost of the operation PE performs most.
*Status:* holding.

### IC-7 — Expressions form a memoized DAG rather than a tree

*Realises:* R2, R4.

**Chosen.** An `Expression` carries a memo table, and the same expression
value may be referenced from many places.

| Alternative | Trade |
|---|---|
| Tree, re-evaluated per reference | Exponential re-evaluation under PE, which specialises the same subexpression repeatedly |

*Criterion:* PE cost.
*Status:* holding.

## 3. What this part does not yet contain

Recorded so the absence is visible rather than implied:

- **No requirement covers syntax or the grammar substrate.** L1 exists and is
  unrepresented above; either it derives from R1/R6 or there is a missing
  requirement.
- **No requirement covers the async/completion surface** (future cells,
  forward chaining). D33 settled the design; nothing above says why the base
  must have it.
- **The implementation register covers T0–T1 only.** T2–T5 choices —
  propagation rules, discharge tiers, the knowledge lattice — are not yet
  registered.
- **R1–R7 are proposed, not ratified.** They are the maintainer's three
  stated requirements plus four this exercise surfaced (R4, R5, R6, R7).

---

# T0 · Representation

What a value is, before anything has been said *about* it. This tier is
Allegretto with no type system present at all.

## 1. Value

> **Level: Specification** — satisfies R1, R4.

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

> **Level: Specification** — satisfies R1, R6.

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

> **Level: Specification** — satisfies R1, R6. Choice: **IC-1**.

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

> **Level: Specification** — satisfies R2, R6. Choice: **IC-5**.

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

> **Level: Specification** — satisfies R2, R4. Choice: **IC-7**.

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

> **Level: Specification** — satisfies R2, R5.

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

> **Level: Specification** — satisfies R1, R3. Choices: **IC-2**, **IC-3**.

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

> **Level: IMPLEMENTATION** — choice **IC-4**, realising R3. Not part of the specification: a different metadata mechanism would delete this concept entirely.

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

> **Level: Specification** — satisfies R5.

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

> **Level: IMPLEMENTATION** — choices **IC-2**, **IC-3**. The specification says *one* composite (§9); the roles are how this host realises it.

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

> **Level: Specification** — satisfies R2. (`cell`, `isComplete`, `incompleteDeps` serve the completion surface — see Part 0 §3, which records that no requirement yet covers it.)

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

> **Level: Specification** — satisfies R2. Choice: **IC-6**.

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

> **Level: IMPLEMENTATION** — choice **IC-3**. Invisible from the specification in principle; visible in practice, which is §17's delta.

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

> **Level: IMPLEMENTATION** — choice **IC-3**. Pure compatibility scaffolding; nothing in the specification requires it.

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
performance criterion, read afterwards as part of the design. All four trace
to **IC-2/IC-3/IC-4**, which is why those three are the ones under review at
**B-108**.

The check is now mechanical rather than a matter of judgement: an entry that
cannot name the requirement it traces up to is either misplaced or resting on
a requirement nobody has written down.
