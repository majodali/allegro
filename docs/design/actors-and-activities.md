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

Marked by evidence, not by plausibility.

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
| **Author** | Supplies the program. VISION's participants collapse here | confirmed (T2(a) at the system boundary, not in-process) |
| **External agent** | Reads system state, and/or submits candidates the kernel checks | confirmed §3.5 |
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
- **`slots.ts`** — fails T1, subtly and importantly. Its role cannot be
  stated without naming the Engine's representation, because its role *is* to
  be the Engine's interface. An interface **on** an actor is not an actor
  behind one. This is the second, independent reason §5.3 is not an activity:
  an Engine reading its own representation has the same actor on both sides
  of the supposed crossing.

**And one admission the loosened T2 makes, which is worth surfacing rather
than hiding.** `SlotView` was excluded in the first draft. Under the revised
tests it qualifies: its role is stated — *a by-name view over the entry
sequence* — its index policy is explicitly *below the specification*
(D48(a)), it holds a cached index across calls (T2(b)), it chooses between a
scan and a map at a measured threshold (T2(c)), and the granularity rule
passes because W7 and the 200-vs-200,000 scaling test are tests of its
contract that are not tests of `Structure`.

That is the loosening working as intended — *an implementation choice that
does not define the role* is exactly what B-120 E2 and E3 measured and pinned.
It is also the model's grain becoming finer, which the maintainer should rule
on: **is a small internal actor like `SlotView` in scope, or does the model
stop at crossings between named subsystems?** The granularity rule admits it;
the exercise's four activities never mention it.

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

## 5. The exercise — four crossings we already understand

Each is written the same way: the actors, the question, the interface as it
exists, the gap, and the functional test that would cover it. Choosing four we
already know the answers to is the point — it tests the model, not the code.

---

### 5.1 Dispatch member access

**Actors**: L2 Standard (initiator) → Kernel (responder), with Author's code
as the subject and the calling scope as evidence.

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

**Actors**: L1 substrate (initiator) → L2 Standard (responder).

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

**Actors**: Engine, L1 and L2 (initiators) → Engine-as-representation-owner
(responder).

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

**Functional test**: no behavioural test can cover this — the activity has no
observable behaviour. Its test is structural: a reintroduced `as any` over a
registered host property fails the boundary lint. By the maintainer's own
criterion (*activities should only define behaviour we would write functional
tests to cover*), **this is not an activity** — it is a representation rule
dressed as one.

§3.6 supplies the second, independent reason, and it is the stronger of the
two: `slots.ts` fails the actor tests. It never initiates and there is nothing
behind it that is not the Engine's own representation, so it is an *interface
on* the Engine rather than an actor behind one — and an Engine reading its own
representation has the same actor on both sides of the supposed crossing.

Both reasons land in the same place, which is why the §5.3 design conclusion
survives its own demotion: the host plane still needs an interface, and that
interface still is not the value. What it does not need is an activity.

---

### 5.4 Attach and propagate metadata

**Actors**: Kernel (writer of minted fields) and L2 (writer of registered
fields) → Engine (propagator).

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
7. **The loosened T2 admits `SlotView`** (§3.6), which the first draft
   excluded. That is the rule working — its index policy is *below the
   specification* by ruling — but it moves the model's grain finer than the
   four activities reach, and needs a ruling.

So: **three of four crossings are real, one is not, and one carries a design
question the model resolves.** The more useful result is 1 and 2 — the model
was asked two questions about its own boundaries and answered both by refusing
something, including something it had itself proposed. That is the evidence
for widening the exercise or dropping it.

## 7. Open questions

1. **Adopt, extend, or drop.** Four activities is a sample, not a proof.
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
5. **How fine the grain goes** (§3.6). The granularity rule admits `SlotView`;
   whether small internal actors are in scope, or the model stops at crossings
   between named subsystems, changes the size of the model by an order of
   magnitude.
