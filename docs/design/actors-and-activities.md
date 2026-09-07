# Actors and activities — an exercise over four known crossings

**[under revision]** — this is a DRAFT EXERCISE, not settled design. It exists
to test whether an actor/activity model earns its keep on Allegro before any
of it is adopted. Nothing here supersedes `layers.md`; nothing here is
enforced. Raised by the maintainer, 2026-09.

## 1. What this adds to the layer spine

`layers.md` answers *what may depend on what*. It does not answer *who does
what to whom, and through which interface*, and that second question is where
this session's defects have lived:

- `dataOf` peeled a carrier **and** stripped metadata. Five sites depended on
  the second behaviour; nothing in the signature said it existed (B-121 C2).
- Eleven sites reached past an interface at representation — `.primary`,
  `isCarrier`, `kind === ValueKind.Structure` — none intending to, every
  failure silent (B-128).
- `getSlotCount` returns `undefined` for a non-positional structure, and two
  callers use that as *is this an Array?* (B-133).
- 81 property accesses reach registered host state through `as any`, because
  there is no interface to reach it through (B-137).

`grammar2/builder.ts` is the clearest case, and it is not a layering
violation: L1 may depend on L0. It needs to validate a user-supplied
argument's shape, there is no actor to ask, so it reads an L0 storage
bit and interprets it as a type test. **A missing activity interface is
invisible to a dependency spine.**

## 2. Vocabulary

VISION uses **participant** for humans, AI agents and tools *authoring code*
— "participant-neutral" is Tier-0 vocabulary and is not touched here. This
document says **actor** for the system-architecture sense.

The two reconcile rather than collide: every VISION participant collapses into
a single actor (whoever authored the code under evaluation), which is exactly
what participant-neutrality asserts.

## 3. Actors

### 3.1 What counts as an actor

The first draft had no definition, and the parser is what exposed it: it was
excluded on the grounds that the **Admit** activity also accepts a
directly-constructed DAG with no parse step. That is an argument about the
activity having two realizations. It says nothing about the parser.

**An actor is something whose role is stated independently of its
implementation, and behind whose interface there is something worth hiding.**
Two necessary tests:

- **T1 — Role/implementation separability.** What it must do is statable
  without saying how, and its implementation could be replaced wholesale
  without changing what any other actor must do.
- **T2 — Encapsulation is warranted.** Something behind the interface is
  substance callers should not depend on. Any ONE of these establishes it:
  - **(a) it initiates** an activity — it is a party to a crossing;
  - **(b) it holds state** across calls;
  - **(c) it embodies a non-trivial strategy** — a loop, recursion, a choice
    of algorithm. Complexity is substance whether or not it is stateful.

**Initiation is sufficient, not necessary.** Something that initiates is
certainly an actor; a pure function that never initiates but carries real
complexity is still better encapsulated, and hiding it is a decision about who
may depend on the strategy — not about whether it holds state.

Three things are explicitly **not** tests:

- **Statefulness.** T2(b) is one of three grounds, not the ground.
- **Externality.** Kernel and Engine are both in-process.
- **Size.** A narrow role is still a role.

**Granularity rule.** Loosening T2 admits smaller actors, so the model needs
the economy the activity inventory has (§4.1). The parallel test is the same
one: **an actor earns its own name only if some other actor's correctness
depends on its contract rather than on its code** — in the maintainer's idiom,
if we would write a test against its interface that we would not write against
its caller. Anything finer is a component of the caller.

**Promotion rule**: an actor is named only with evidence in the code for both
tests. Conceptual plausibility is how a taxonomy grows past usefulness.

### 3.2 The parser is an actor

It passes both, and on every ground T2 offers:

- **T1**: `layers.md` already anticipates the replacement — the standard
  parser is L1 today and *"may eventually be re-defined at L3 using Vivace's
  parser generator"*. A role whose replacement is already a planned milestone
  is a role separable from its implementation by construction.
- **T2(a)**: mid-parse it calls `makeExpr` **85** times, `makeSymbol` 17,
  `makeComposedFn` 17, `makeStructure` 5. It initiates into the Engine and
  Kernel while running, which is precisely a crossing rather than a step
  inside one.
- **T2(b) and (c) as well**, which is why it is not a marginal case: it holds
  grammar tables and an intermediate tree across calls, and its error recovery
  and precedence resolution are strategy no caller should depend on. B-132 is
  what the missing boundary already costs — `parser-helpers.ts` minting its
  own contexts outside the representation.

### 3.3 The correction this forces: layers are not actors

Applying the tests to the first draft's own table finds the real defect.
**"L1 substrate" and "L2 Standard" are layers wearing actor names.** They fail
T1, and in the way that matters: a layer is a dependency band containing
several roles, so there is no single role to state — "what L2 Standard must
do" has no answer that is not a list. Promoting the parser without decomposing
them would have been inconsistent.

The tests decompose both. Strongest candidates, each still owing the same
evidence the parser just supplied:

- from L1 — **Parser** (confirmed above), **Module loader** (the loading
  mechanism is L1 by ruling while typed module objects are L2, so the role is
  already stated separately from its collaborator), **Grammar registry**
- from L2 — **Type system** (T2(a) confirmed: it initiates into the evaluator at
  `types-std.ts:1122`, `1469`, `1636`), **Effect system**, **Totality
  analyzer**, **Proof kernel** (`pcp.ts` already names it *the Allegro
  verification kernel*, distinct from the authority Kernel)

That takes the list from seven names to roughly a dozen — for the right
reason. It is not the taxonomy growing; it is two placeholders being replaced
by the actors they were standing in for.

### 3.4 The actor list

Marked by evidence, not by plausibility. §3.8 supersedes this table for
*kind* (singleton vs type) and for level-2 decomposition; this one records
what the evidence supports.

| Actor | What distinguishes it | Status |
|---|---|---|
| **Kernel** | Holds authority nobody else can — constructor brand, channel writers, evidence capsule, privilege layers (D21, D42, V-R2) | confirmed |
| **Engine** | Applies rules, grants nothing. Evaluator, PE, representation | confirmed |
| **Parser** | Source text → expression DAG; replaceable per `layers.md` | confirmed §3.2 |
| **Type system** | Declares types, checks annotations and refinements, dispatches members | T2(a) confirmed |
| **Module loader** | Extension loading, dependency resolution, caching | candidate |
| **Grammar registry** | Runtime grammar extension and fragment merging | candidate |
| **Effect system** | Infers and checks effect declarations | candidate |
| **Totality analyzer** | Termination, decrease metrics, exhaustiveness | candidate |
| **Proof kernel** | Emits obligations, checks candidates, records authorship | candidate |
| **UserCode** | Supplies the program. VISION's participants collapse here. A **type**, not a singleton — the first draft's *Author* was a singleton standing in for one (§3.7) | confirmed (T2(a) at the system boundary, not in-process) |
| **ExternalAgent** | Reads system state, and/or submits candidates the kernel checks. Also a **type** | confirmed §3.5 |
| **Environment** | Supplies effects and initiates completions; swappable | confirmed |

### 3.5 Why Tool and External prover are one actor

They differ by **relationship, not identity**, so the distinction belongs on
the activity axis and not this one. The same program does both: an LLM worker
reads obligations and then submits a candidate. `pcp.ts`'s own header already
blurs it — *"External tools (IDEs, build systems, LLM agents,
human-interactive workers) consume the JSON"*.

The formal difference is **whether the actor's output can change a verdict the
kernel records**:

- In **Introspect** and **Report**, the kernel's state is unaffected by what
  the actor does with the output. Reading is total and consequence-free.
- In **Discharge**, the actor submits a *candidate*. The kernel checks it —
  never trusts it — and on pass records a discharge and an authorship entry.

So the actor is untrusted in both, and consequential in only one. That is a
per-activity property, which is the model working as intended on its first
question: one actor, two activities, two interfaces.

### 3.6 What the tests exclude, and one thing they now admit

The definition is only worth having if it refuses things. It refuses:

- **`putEntry`** — fails T1. Its role is not separable from the
  representation; it *is* the how. It also fails the granularity rule: any
  test of it is a test of `Structure`.
- **The propagation table** — fails T1 and T2. It is data the Engine
  consults, with no role of its own.
- **`collapseBodyMetadata`** — passes T2(c) on complexity but fails the
  granularity rule. Nothing depends on its contract separately from the
  compile pipeline's, so it is a component of that pipeline.
- **`slots.ts`** — **superseded by §3.7.1.** This entry said it fails T1
  because its role cannot be stated without naming the Engine's
  representation. That description is right and the conclusion was wrong: it
  is a *pure interface actor* of the Engine, a category the flat model did not
  have.

**And one admission the loosened T2 makes.** `SlotView` was excluded in the
first draft. Under the revised tests it qualifies: its role is stated — *a
by-name view over the entry sequence* — its index policy is explicitly *below
the specification* (D48(a)), it holds a cached index across calls (T2(b)), it
chooses between a scan and a map at a measured threshold (T2(c)), and the
granularity rule passes because W7 and the 200-vs-200,000 scaling test are
tests of its contract that are not tests of `Structure`.

That raised a grain question, **now answered in §3.7**: the grain is
unlimited in principle and bounded at two levels in practice, and `SlotView`
is an internal actor of the Engine rather than a system-level one.

### 3.7 Actors are types, and they decompose

Two properties settle §3.6's open grain question and change the model's shape.

**Actors are types; most are singletons.** Kernel, Engine and Parser happen to
have one instance each, which is why the first draft could get away with
treating actors as things rather than kinds. Others are plainly not singletons
— **UserCode** and **UserModule** are types with many instances, and so is
**ExternalAgent**. The first draft's *Author* was a singleton standing in for a
type, which is the same error as *L1 substrate* standing in for a layer.

Allegro makes this unusually literal. A **Type** in Allegro is a value that
receives member-dispatch messages and encapsulates its member set — so
`Type` is an actor type with many instances, and each declared type is one
of them.

**Actors decompose, and the decomposition is private.** An actor contains
internal actors and internal activities; everything but its interfaces is
implementation detail of the outer actor. Two kinds of thing sit at the
boundary:

- **encapsulated internal actors** — they have substance of their own;
- **pure interface actors** — they hold nothing and pass messages to and from
  internal activities.

**Internal state is modelled as state-carrying actors**, which may be as
simple as a persistent value. There is no separate "state" category: a value
is the degenerate state-carrying actor.

In principle this recurses until every function and type is specified. In
practice the maintainer decomposes **two levels** — enough to map the major
components and their functional behaviour — and this exercise does the same.

#### 3.7.1 What this does to `SlotView` and `slots.ts`

Both are now placed, and one of them reverses a call in §3.6.

**`SlotView` is an internal actor of the Engine**, encapsulated: it carries
the cached index (state), it chooses scan-versus-map at a measured threshold
(strategy), and its policy is *below the specification* by ruling (D48(a)).
Included in the hierarchy per the maintainer's direction, at level 2.

**`slots.ts` is a pure interface actor of the Engine** — not, as §3.6 said, a
failure of T1. It holds nothing and passes messages to internal activities,
which is exactly the second kind of boundary thing. The earlier reasoning
("its role cannot be stated without naming the Engine's representation")
described a pure interface actor correctly and then concluded it was not an
actor at all, because the flat model had no category for one.

#### 3.7.2 Two convergences worth recording

**Scope.** D49 rules that a scope leaves `Value` and becomes a non-value host
construct. In this model a scope is *internal state-carrying actor*, the
category the maintainer describes — arrived at from a different direction and
agreeing. That D49's argument and the actor model's category independently
place a scope outside the value tower is the strongest evidence either has.

**Vivace.** A model that specifies a system down to its functions and types,
expressed as a DSL or a data representation and possibly rendered
graphically, is a domain model — and L3 Vivace is *the domain-model layer*.
So the actor/activity model is a candidate Vivace domain, and the maintainer's
"fulfilling the role of UserCode" is precisely what an L3 DSL does: it emits
the program. Recorded as a **direction, not a claim** — Vivace is at
hypothesis stage and this is internal (release-track principle 17).

### 3.8 The hierarchy, two levels

Level 1 is the system's actors. Level 2 decomposes the two carrying this
exercise's evidence; the rest are named without decomposition and owe theirs.

| Level 1 actor | Kind | Level 2 |
|---|---|---|
| **Kernel** | singleton | Capability minter · Evidence capsule (type) · Privilege layer (type) |
| **Engine** | singleton | **Structure** (type) · **Scope** (type, state-carrying) · **SlotView** (type, internal to Structure) · **Expression DAG** (type) · PE rule set · Metadata plane · Propagation table · `slots.ts` (pure interface) |
| **Parser** | singleton | Lexer · Grammar table · Tree builder · Fragment merger |
| **Type system** | singleton | **Type** (type) · Member set (type) · Refinement checker · Member dispatcher |
| **Module loader** | singleton | **UserModule** (type) · Dependency resolver · Cache |
| **Grammar registry** | singleton | **Grammar fragment** (type) · Merger |
| **Effect system** | singleton | **EffectSet** (type) · Inference walker · Declaration checker |
| **Totality analyzer** | singleton | Decrease-metric checker · Exhaustiveness checker |
| **Proof kernel** | singleton | **Obligation** (type) · **Verdict** (type) · Candidate checker · Authorship ledger |
| **UserCode** | **type** | — |
| **UserModule** | **type** | (owned by Module loader above) |
| **ExternalAgent** | **type** | — |
| **Environment** | singleton per host | Capability table · Completion source |

Level 2 entries are candidates except `SlotView`, `Structure`, `Scope` and
`slots.ts`, which this document's evidence already places.

## 4. The activity inventory — names only

A first cut for scope, deliberately unrefined. Several of these will collapse
under parameterization (§4.1); the point here is the order of magnitude, which
is **tens, not hundreds**.

**Admission** — Parse source · Admit expression DAG · Load module · Resolve
import · Register grammar extension · Register body form

**Evaluation** — Evaluate expression · Resolve symbol · Extend scope · Apply
function · Dispatch member access · Construct value · Attach metadata ·
Propagate metadata · Read host state · Resolve future · Emit residual

**Policy (L2)** — Declare type · Check annotation · Check refinement · Check
contract · Infer effects · Check effect declaration · Check totality · Check
exhaustiveness · Register law · Validate argument shape

**Authority** — Mint capability · Attenuate capability · Grant privilege ·
Check reachability

**Proof** — Emit obligations · Submit candidate · Check candidate · Record
authorship · Render verdict

**Environment** — Perform effect · Acquire host capability

**Introspection** — Inspect value · Report compilation

**Build** — Configure build · Run build phase · Generate target code · Package

That is **38** names. Not a target; a measurement of scope.

### 4.1 Two economies, both required

**Interfaces combine per actor.** One interface per activity per actor pair
would multiply past usefulness. The middle ground is that related activities
on the same actor share an interface — *Check annotation*, *Check refinement*
and *Check contract* are one **declared-constraint** surface on L2, not three.

**Activities parameterize.** The four Check activities above are plausibly one
activity parameterized by constraint kind. The test for whether to split is
not conceptual tidiness: **an activity earns its own name only if we would
write a functional test for it that we would not write for its sibling.**
Anything finer is a component of an activity, not an activity.

### 4.2 Interactions, and actor references as payload

An activity is a set of related **interactions**, and each interaction passes
information from one actor to another. The pattern is not fixed: an
interaction may be an event, a request/response pair, or anything else the
system needs.

**The payload may itself be an actor reference** — a reference to an instance
of an actor type. Actors may be created, retrieved or acquired within an
activity; a reference can be used to invoke the actor it names; and a
reference may be stored inside another actor.

That clause is often decorative in a system model. In Allegro it is the
authority design, stated in the model's own vocabulary.

#### 4.2.1 D42 and D24 are actor references, exactly

- **D42 — evidence is possession.** *Authorization is what the requesting
  context HOLDS, never principal identity.* An actor reference held by an
  actor is the authorization. Nothing else is consulted.
- **V-R2 — the mediation context is a minted capsule, never the raw scope.**
  The capsule is a reference to an actor whose whole interface is
  `holds(name)`. Handing over an attenuated reference instead of the real one
  is the model's standard move.
- **D24 — a capability is a first-class delegable token realized as a
  PrimitiveFunction closure; attenuation is wrapping.** Wrapping a reference
  in an actor that forwards a narrowed interface *is* attenuation. And its
  three declared properties — non-serializable, print-redacted, identity-equal
  only — are precisely the constraints that keep an actor reference
  unforgeable and un-fabricable.
- **`typePrivilegedCtx`** creates an actor (a privilege layer) inside an
  activity and returns a reference to it, which is then stored in the scope
  chain — creation, reference-passing and reference-storage in one call.

So **Allegro's mechanism for storing an actor reference inside a value is the
PrimitiveFunction closure**, branded `channelWriterFor` and checked by
`channel_attenuate`. The forgery battery is the test suite for reference
integrity.

#### 4.2.2 Why this sharpens D49 rather than complicating it

A Scope is an actor reference passed implicitly in every evaluation
interaction. V-R2 already forbids handing the raw one to UserCode. If scopes
were values, an actor reference would be storable in user data and passable to
any actor — which is the forgery concern, now stated in one line: **an actor
reference must never enter the payload of an interaction with an untrusted
actor except in attenuated form.** D49 keeps scopes out of `Value` for exactly
that reason, arrived at independently.

#### 4.2.3 The distinction that explains the metadata plane

Metadata is **information**, so it propagates by a declared table — viral,
union, computed, positional, drop. A channel writer is an **actor reference**,
so it does none of those things: it is non-serializable, print-redacted and
identity-equal only.

The two travel through the same substrate and behave nothing alike, and the
model says why in one word. That is a good sign for it, because the difference
was previously carried by convention and a brand check.

#### 4.2.4 Not every interaction here is request/response

Allegro has genuinely event-shaped interactions, and a model that assumed
call/return would misdescribe them:

- **Completion cascade** — a future resolving is Environment → Engine as an
  event. `resolveCell` writes a binding in place and the dependency registry
  wakes the dependents; nobody called anything.
- **Forward chaining** — a residual becomes evaluable when a symbol it
  references resolves.
- **Compilation notifications** — a non-exhaustive match over a finite type is
  an info notification (CE-R8), not a return value.

Support for arbitrary interaction patterns is therefore load-bearing rather
than a generality the model happens to allow.

## 5. The exercise — four crossings we already understand

Each is written the same way: the actors, the question, the interface as it
exists, the gap, and the functional test that would cover it. Choosing four we
already know the answers to is the point — it tests the model, not the code.

---

### 5.1 Dispatch member access

**Actors**: Type system (initiator) → Kernel (responder), with UserCode as
the subject and the calling Scope as evidence.

**Question**: given a member key, an owning type, and the calling scope, does
this access resolve — and to what?

**Interface today**, and it is nearly right:

```
assertMemberReachable(type, fieldName, ctx, desc?) : void | throws
typePrivilegedCtx(type, ctx)                       : StructureValue
typeMemberDescriptor(type, name)                   : StructureValue | null
getFallbackMember(ctx)                             : Value | undefined
```

This is the maintainer's original design intent — *`get_member` called with
the member key, the owner and the calling scope* — already built. The scope
travels implicitly down the evaluation chain rather than as an argument, which
V-R2 requires: the mediation context is a minted capsule, never the raw scope.

In §4.2's terms the activity does all three reference operations at once:
`typePrivilegedCtx` **creates** a privilege-layer actor, **returns a
reference** to it, and the evaluation **stores** that reference in the scope
chain, where `scopeHoldsPrivilege` later walks for it. The evidence tested is
possession of a reference, which is D42 restated.

**Gap**: the interface is four functions with no name for the activity, so its
supporting state leaked. `hasPrivateMembers`, `ownerShape`, `memberNameIndex`
and `localMemberScope` are all host properties read through `as any` — 22
accesses that exist because the activity has no surface to hold them. Naming
the activity gives them one home instead of four expandos.

**Functional test**: a private member resolves inside the declaring type's own
member body and denies outside it, with denial static under PE when scope and
knowledge are static. Already covered by forgery battery E — which is the
evidence that this activity is real.

---

### 5.2 Validate argument shape

**Actors**: Parser and Grammar registry (initiators) → Type system
(responder).

**Question**: is this user-supplied value the shape I require?

**Interface today**: none. `grammar2/builder.ts` asks L0:

```
const lengthV = getSlotCount(ctx);
if (!lengthV) throw `${primName}: value is not an Array (no length slot)`;
```

**Gap**: this is the model's clearest finding. L1 sits *below* the type
system, so it cannot ask "is this an Array" of the only actor that knows —
and it reaches into L0 storage instead, turning `positional` into a type
indicator (B-133). The dependency spine permits this. Only an activity model
names it as wrong.

Two resolutions, and the choice is real:

- **L2 responds.** The activity is a call *upward*, which the layer spine
  forbids — so it must be an interface L2 *registers* with L1 (a validator
  passed in), not a call L1 makes.
- **L0 responds, honestly.** L0 answers a strictly structural question
  (*how many positional entries?*, always answering) and L1 stops asking a
  type question. That is B-133 as already filed, and it is the cheaper half.

The model's contribution is showing these are different: the second removes
the cast, the first removes the *need*. B-133 does the second; the first stays
open.

**Functional test**: passing a record where an Array is required is refused
with a message naming the expected type — and refused at the same point
whether the value arrives from `.alg` source or a constructed DAG.

---

### 5.3 Read host state

**Actors**: Type system, Parser, Effect system, Totality analyzer
(initiators) → Engine (responder), via its `slots.ts` interface actor. Plus
the Engine reading its own representation, which §3.7 places one level down.

**Question**: what does the engine privately know about this value?

**Interface today**: `src/slots.ts` is the accessor layer and holds the
registry, but only six of the ~31 host properties have accessors, all typed
`any`, and 81 accesses bypass them entirely.

**Gap**: the activity exists, has a home, and is not used. That is the most
useful shape a finding can take, because it means the fix is population rather
than design. The host-plane declaration plan (drafted 2026-09, not yet on
main) is this activity's interface being generated from its registry — and
that plan's own open question
(declare on the value interfaces, or on a separate host-plane interface
reachable only through the accessor layer) **is exactly the actor-model
question**: is host state part of the value's public surface, or is it a
crossing that must go through a named interface?

The model answers it. If reading host state is an activity between actors, it
has an interface, and the interface is not the value. That is Option B, and
the model is why.

**Functional test — and the hierarchy splits this activity in two.** The
earlier verdict was a flat "not an activity", on two grounds that §3.7 now
revises.

- **Engine reading its own representation** is an *internal* activity. No
  functional test can cover it, it has no observable behaviour of its own, and
  both parties are the Engine. It stays inside the Engine's decomposition,
  where `slots.ts` is the pure interface actor and `SlotView` an encapsulated
  one.
- **Type system, Parser, Effect system and Totality analyzer reading Engine
  state is a genuine crossing** at the Engine's boundary. Most of the 81
  accesses are these — `types-std.ts`, `totality.ts`, `effects.ts`,
  `grammar2/` — and their behaviour *is* observable through the caller: a
  refinement checked against the wrong abstract domain fails a refinement
  test.

So the flat model was forcing one name onto two things at different levels,
and answering for the internal one. **The crossing is an activity; the
internal read is not.** That is the hierarchy earning its keep on its first
application, and it is a better result than the demotion it replaces.

The design conclusion is unchanged and now better founded: the host plane
needs an interface at the Engine's boundary, and that interface is not the
value. Option B.

### 5.4 Attach and propagate metadata

**Actors**: Kernel (writer of minted fields) and Type system / Effect system
(writers of registered fields) → Engine (propagator).

**Question**: what does this value carry, and what happens to it at each PE
hop?

**Interface today**, and it is the best of the four:

```
withMeta(v, meta?)         : Value          -- THE attachment operation
carryMeta(from, to)        : T              -- move across a new datum
metaOf(v)                  : ReadonlyMap
metaReadRaw(v, channel)    : Value | undefined
registerMetaField(spec)    : MetaFieldWriter -- capability-gated (D23)
```

with propagation declared per field — `viral | union | computed | positional |
drop` — and applied by a table rather than per-field logic.

**Gap**: none in the interface. This activity was *repaired* into this shape by
B-121, and the repair is what the model would have predicted: before it, the
question *does this value carry metadata?* had eight spellings and the
attachment operation had four meanings under one name.

Its value here is as the **control**. It shows what a well-formed activity
looks like — one named operation per verb, a declared propagation rule per
field, a capability gate on origination, and a registry the engine consults
rather than a table each caller re-implements. The other three should be
measured against it.

**Functional test**: a registered viral field survives a PE hop through an
unresolved argument; a `drop` field does not; an unregistered field cannot be
originated without the writer capability. All three exist in the boundary
battery.

## 5a. The rest of the inventory

### 5a.1 Consolidation first

§4's 38 names were a scope measurement, deliberately unrefined. Applying
§4.1's two rules before working them gives **31 activities**. The collapse is
smaller than expected, because most names were already at the right grain —
one redundancy accounts for most of it.

| Collapsed | Into | Why |
|---|---|---|
| Parse source · Admit expression DAG | **Admit program** (by source form) | Same test: the same program admitted either way must evaluate the same |
| Resolve import | Load module | An interaction inside it; no test of one that is not a test of the other |
| Register grammar extension · Register body form | **Register extension** (by kind) | One registration surface, two payloads |
| Apply function · Emit residual | Evaluate expression | PE Rules 1 and 2 *are* evaluation's behaviour |
| Attach metadata · Propagate metadata | **Metadata plane** (§5.4) | One activity, two verbs |
| Check annotation · refinement · contract · effect declaration | **Check declared constraint** (by constraint kind) | §4.1 predicted this; it is the single largest redundancy |
| Grant privilege · Check reachability | Dispatch member access (§5.1) | Its two interactions |
| Submit candidate | Check candidate | Its initiating interaction |
| Render verdict | Report compilation | Presentation, not a distinct behaviour |

Two names were deliberately **not** collapsed. *Check totality* and *Check
exhaustiveness* look like one parameterized activity and are not: CE-R8 gives
them different severities — a failed termination check halts, a non-exhaustive
match over a finite type is an info notification — so each has a functional
test the other does not. *Mint capability* and *Attenuate capability* likewise
differ: attenuation has a test (an attenuated writer refuses an out-of-scope
field) that minting does not.

### 5a.2 The remaining 27, with verdicts

Vocabulary: **sound** (interface exists and is named) · **implicit**
(behaviour right, interface unnamed) · **gap** (interface missing or wrong) ·
**not built**.

**Admission**

- **Admit program** — UserCode → Parser → Engine. `evalSource` is the one
  entry point. **Implicit**: the text path and the DAG path are not stated as
  one activity with two source forms, and B-132 is the symptom — the parser
  mints a *third* context representation that is neither `Structure` nor
  Scope.
- **Load module** — UserCode → Module loader → Type system. `ModuleConfig`,
  `ModuleLoaderOptions`, `buildModuleObject`. **Gap, and a specific one**:
  `layers.md` *rules* that the loading mechanism is L1 while typed module
  objects and encapsulation are L2 — and `buildModuleObject` sits in
  `src/modules.ts`, the L1 file, doing the L2 half. A ruled boundary with no
  interface is a ruling that only review enforces.
- **Register extension** — UserModule → Grammar registry. The `register_*`
  primitives. **Sound**: the primitive set is the interface, and each has a
  functional test.

**Evaluation**

- **Evaluate expression** — Engine, self-initiated and from Parser and Type
  system. `EvalFn = (value, ctx) => Value`. **Sound in shape**, and its one
  defect is already owned: `ctx` is typed `StructureValue`, which D49/B-136
  corrects.
- **Resolve symbol** — Engine → Scope. `scopeLookup`. **Sound.**
- **Extend scope** — Engine, Type system → Scope. `scopeExtend`,
  `scopeAssume`, `scopePrivilegeExtend`. **Sound**: three creation verbs,
  each with its own test, each returning a reference to a new Scope actor
  (§4.2).
- **Construct value** — Type system → Kernel. The `__construct` slot,
  `resolveDataSlots`, the invariant check. **Gap**: CE-R8 rules that a
  construction-path invariant failure yields an error *value* while a contract
  failure *halts*, and the split is deliberate — but the interface does not
  express it. One path throws and one returns, through a surface whose
  signature says neither.
- **Resolve future** — Environment → Engine, as an event. `FutureManager`,
  `resolveCell`, the dependency registry. **Sound**, and the system's clearest
  non-request/response interaction (§4.2.4).

**Policy**

- **Declare type** — UserCode → Type system → Kernel. The kind recipe and the
  meta-protocol registry. **Implicit**: the registry is the nearest thing to
  an interface, and B-135 is what its absence costs.
- **Check declared constraint** — Type system → UserCode's value. Four code
  paths sharing a severity model (a failed check halts, CE-R1) and no surface.
  **Gap**: the parameterization §4.1 predicted is not expressed anywhere.
- **Infer effects** — Effect system → Engine. **Gap**, and see below.
- **Check totality** — Totality analyzer → Engine. **Gap**, and see below.
- **Check exhaustiveness** — Totality analyzer → Engine. **Implicit**, and
  notable for its interaction pattern: CE-R8 makes the outcome an info
  *notification*, so this activity's result is an event rather than a return.
- **Register law** — Type system → Law registry. `lawObligationRecords()`.
  **Sound**, with one property worth naming: the registry is process-global
  and scoped per compilation by `boundTypeFilter`. In §4.2's terms a global
  actor is handed a filter rather than being asked a scoped question.

**Authority**

- **Mint capability** — Kernel. `registerMetaField(spec, minted)` returns a
  writer. **Sound**, and among the best-formed surfaces in the system; the
  forgery battery is its test suite.
- **Attenuate capability** — holder → Kernel. `channel_attenuate`,
  brand-checked against `channelWriterFor`. **Sound** (D24).

**Proof**

- **Emit obligations** — Proof kernel → ExternalAgent. `extractObligations`,
  `makeObligation`, `serializeObligation`. **Sound.**
- **Check candidate** — ExternalAgent → Proof kernel. `parseVerdict`,
  `buildVerdict`. **Sound.**
- **Record authorship** — Proof kernel → ledger. `makeAuthorship`. **Sound.**

All three share the property that makes them the exercise's **second
calibration point**: PCP is the only interface in the system that is
*serialized and versioned* (`pcp/1`, with a stated forward-compatibility
rule). An interface that must survive a process boundary cannot be implicit,
which is why these three are the best-specified activities Allegro has — and
an argument that the model's value rises with the cost of getting the
interface wrong.

**Environment**

- **Perform effect** — Engine → Environment. The effect-labelled primitives
  (`print`, `delay`, `fetch`) plus the declared label set. **Implicit**: the
  label names the capability, but there is no Environment interface object.
  Swapping Node for the browser sandbox substitutes primitives rather than
  supplying a different implementation of a stated interface — T1 holds in
  spirit and nothing states it.
- **Acquire host capability** — **Gap**: the current mechanism is
  `futureManager` planted as a host expando on the root scope and read by a
  chain walk, which is §5.3's crossing wearing a different hat.

**Introspection**

- **Inspect value** — ExternalAgent → Engine. `summarizeValue`,
  `summarizeModule`, `renderModuleSummary`. **Implicit**, and it reads
  `grammarValue` and `abstractDomain` through `as any` — §5.3's crossing
  again.
- **Report compilation** — Engine → ExternalAgent. `CompilationReport`,
  `Notification`, `safetyGradeFor`. **Sound.**

**Build** — Configure build · Run build phase · Generate target code ·
Package. **All four not built.** There is no codegen, emit or package source
in `src/`; T-build and T-backend are tracks with design and no
implementation. The model can name the actors and has nothing to check.

### 5a.3 The pattern the pass found

Four entries came back marked separately — three **gap**, one **implicit** —
for what looks like four reasons and is one. *Infer effects*, *Check
totality*, *Acquire host capability* and *Inspect value* all store or read
their result as **host state on the analysed value** instead of returning it
across an interface: `inferredEffects` (9 accesses), `partial` and
`decreasesMetric`, `futureManager`, `abstractDomain` (14).

That is §5.3's crossing, so with it the cause covers **five of the
thirty-one**. **An analyzer that writes its conclusion onto its subject has no
interface, because there is no message.** The host-plane plan's Option B is
the fix for all five at once, which is a stronger argument for it than §5.3
alone made.

The complementary observation is where the well-formed activities cluster.
The metadata plane (§5.4), capability minting and attenuation, and all three
proof activities are **sound** — and every one of them either crosses a trust
boundary or crosses a process boundary. **Allegro's interfaces are well
specified exactly where getting them wrong would be visibly unsafe, and
implicit everywhere else.** That is not a criticism of the code; it is a
statement of where the model has something to add.

## 6. What the exercise found

1. **The model needed a definition of *actor* before it could be trusted**
   (§3.1), and the first draft did not have one — which is why the parser was
   wrongly excluded on an argument about the *activity* rather than about the
   parser. Two necessary tests now: role/implementation separability, and
   warranted encapsulation established by initiation, held state, or
   algorithmic substance. **Initiation is sufficient, not necessary** — a pure
   function with real complexity is still better encapsulated. Statefulness,
   externality and size are explicitly not tests, and a granularity rule
   parallel to the activity one keeps the loosening from growing the taxonomy.
2. **The definition immediately refused the draft's own table.** *L1
   substrate* and *L2 Standard* are layers wearing actor names (§3.3). Layers
   do not initiate, so they cannot be actors — and applying the tests replaces
   two placeholders with the actors they were standing in for.
3. **Tool and External prover are one actor in two activities** (§3.5) — the
   taxonomy collapsing rather than growing.
4. **§5.2 is a genuine missing interface**, and the model distinguishes two
   fixes that look like one: removing the cast, and removing the need.
5. **§5.3 is not an activity**, now for two independent reasons: it fails the
   functional-test criterion, and `slots.ts` fails T1 (§3.6) — its role cannot
   be stated without naming the Engine's representation, so an Engine reading
   its own representation has the same actor on both sides of the supposed
   crossing.
6. **§5.4 needs nothing**, which makes it the calibration point.
7. **The model is hierarchical and its actors are types** (§3.7, maintainer,
   2026-09). Actors decompose into internal actors and internal activities;
   the decomposition is private but for the interfaces; internal state is a
   state-carrying actor, possibly just a persistent value; and an actor's
   boundary holds both encapsulated internal actors and pure interface actors.
   Practice stops at two levels.
8. **That reversed one call and improved another.** `slots.ts` is a *pure
   interface actor* of the Engine, not — as §3.6 concluded — a failure of T1;
   the flat model simply had no category for it. And §5.3 was one name over
   two things at different levels: the crossing at the Engine's boundary is an
   activity, the Engine reading its own representation is not.
9. **Two convergences** (§3.7.2). A Scope is exactly *internal state-carrying
   actor*, which is D49's conclusion reached independently. And a model that
   specifies a system down to its functions and types, expressed as a DSL and
   emitting the program, is what L3 Vivace is for — recorded as a direction,
   not a claim.
10. **Actor references as interaction payload land on the authority design**
   (§4.2). The clause is decorative in most system models; here D42 *is*
   possession of an actor reference, V-R2's capsule *is* an attenuated one,
   D24's *attenuation = wrapping* is the standard move, and the
   PrimitiveFunction closure is how Allegro stores a reference inside a value.
   D24's three properties — non-serializable, print-redacted, identity-equal
   only — are precisely the constraints that keep a reference unforgeable.
11. **It separates the metadata plane from the capability plane in one word**
   (§4.2.3): metadata is *information* and propagates by table; a channel
   writer is a *reference* and does none of it. That difference was previously
   carried by convention and a brand check.
12. **Arbitrary interaction patterns are load-bearing, not generality**
   (§4.2.4). The completion cascade, forward chaining and compilation
   notifications are events; a call/return-only model would misdescribe all
   three.

13. **The full pass consolidates 38 names to 31** (§5a.1) — a smaller
   collapse than expected, because most names were already at the right grain.
   The four Check activities were the single largest redundancy, as §4.1
   predicted; two apparent redundancies were deliberately *not* collapsed
   because CE-R8 gives them different severities.
14. **Four separately-marked entries turn out to have one cause** (§5a.3).
   *Infer effects*, *Check totality*, *Acquire host capability* and *Inspect
   value* all write or read their result as host state on the analysed value
   rather than returning it across an interface. **An analyzer that writes its
   conclusion onto its subject has no interface, because there is no
   message.** With §5.3 that is five of the thirty-one, and Option B fixes
   them together.
15. **The well-formed activities cluster where they must.** The metadata
   plane, capability minting and attenuation, and all three proof activities
   are sound — and every one crosses either a trust boundary or a process
   boundary. PCP is the only *serialized and versioned* interface in the
   system (`pcp/1`), and it is the best-specified. **Allegro's interfaces are
   well specified exactly where getting them wrong would be visibly unsafe,
   and implicit everywhere else** — which is where the model has something to
   add.

Tally over all 31 activities: **13 sound, 6 implicit, 8 gap, 4 not built**
(the build track). `Read host state` counts as a gap at the Engine's boundary
per §5.3's split; the four worked crossings contribute one sound (§5.4), one
implicit (§5.1) and two gaps (§5.2, §5.3).

So: **three of the four worked crossings are real, one is not, and one carries
a design question the model resolves.** The more useful results are 1, 2 and
14 — the model was asked three questions about its own boundaries and answered
each by refusing or merging something, including things it had itself
proposed. That is the evidence for adopting it.

## 7. Open questions

1. **Adopt, extend, or drop.** No longer a sample: all 31 activities are
   worked (§5, §5a). The evidence is a tally, one structural finding that
   explains a third of the register (§5a.3), and three self-corrections.
2. **Relationship to `concept-spine.md`.** That plan is active and defines
   concepts in dependency order. Actors and activities are structure rather
   than definitions, so this document cites the spine rather than duplicating
   it — but the boundary needs a ruling before either grows.
3. ~~Whether this is an Allegro practice or a methodology one.~~ **SETTLED
   2026-09**: the maintainer will formalize the model and propose it as a
   methodology amendment once the exercise is done. This document is therefore
   the evidence base for that proposal as well as Allegro's own record, which
   raises the bar on §3.1 — the definition has to hold outside this project.
4. **Where the interfaces would live** if adopted — per-actor modules, or
   declarations checked by the boundary battery the way the plane invariants
   are.
5. ~~How fine the grain goes.~~ **SETTLED 2026-09** (§3.7): unlimited in
   principle, two levels in practice. `SlotView` and its like are in, as
   internal actors.
6. **Which level-2 entries survive their evidence.** §3.8 names them from
   the code's shape; only four are placed by this document's evidence, and
   the rest owe the same check the parser got.
7. **Whether the eight gaps become backlog items now**, or wait for the
   model's adoption ruling. Four already have owners — §5a.3's cluster is
   B-135/B-137, and *Validate argument shape* is B-133. The other four are
   unfiled: *Load module*'s unenforced L1/L2 ruling, *Construct value*'s two
   outcomes under one signature, *Check declared constraint*'s missing
   surface, and the absent Environment interface.
