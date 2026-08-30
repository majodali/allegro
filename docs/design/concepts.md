# Concepts — the definitional spine

> Tier 1. The document a reader (or an agent) reads **first and completely**.
> Every salient Allegro concept, defined in dependency order. The area docs
> (`allegretto/structures.md`, `standard/type-system.md`, …) are where the
> deep treatment lives; this is what makes them legible.
>
> Plan: `docs/plans/concept-spine.md`. Status: **T0–T1 written (S1)**;
> T2–T5 pending. Status tags per `README.md`.

## How to read this

Each entry has four parts, and the last one is the point:

| Part | What it holds |
|---|---|
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

# T0 · Representation

What a value is, before anything has been said *about* it. This tier is
Allegretto with no type system present at all.

## 1. Value

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
