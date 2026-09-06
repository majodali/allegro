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

**An actor is a party to a crossing whose role is stated independently of its
implementation.** Three tests, all required:

- **T1 — Role/implementation separability.** What it must do is statable
  without saying how, and its implementation could be replaced wholesale
  without changing what any other actor must do.
- **T2 — It initiates.** It appears as the *initiator* of at least one
  activity. Something only ever called is a component of the caller's
  activity, not a party to a crossing.
- **T3 — Encapsulation is wanted.** Something behind its interface is state
  or strategy other actors should not reach. Otherwise the interface is
  documentation, not a boundary.

Three things are explicitly **not** tests:

- **Statefulness.** A pure function can be an actor. Encapsulating one behind
  an interface is a design choice about who may see the strategy, not about
  whether it holds state.
- **Externality.** Kernel and Engine are both in-process.
- **Size.** A narrow role is still a role.

**Promotion rule**: an actor is named only with evidence in the code for all
three tests. Conceptual plausibility is how a taxonomy grows past usefulness.

### 3.2 The parser is an actor

It passes all three, and the evidence is not close:

- **T1**: `layers.md` already anticipates the replacement — the standard
  parser is L1 today and *"may eventually be re-defined at L3 using Vivace's
  parser generator"*. A role whose replacement is already a planned milestone
  is a role separable from its implementation by construction.
- **T2**: mid-parse it calls `makeExpr` **85** times, `makeSymbol` 17,
  `makeComposedFn` 17, `makeStructure` 5. It initiates into the Engine and
  Kernel while running, which is precisely a crossing rather than a step
  inside one.
- **T3**: its grammar tables, its error recovery and its intermediate tree
  are all things no other actor should reach — and B-132 is what happens
  without the boundary, `parser-helpers.ts` minting its own contexts outside
  the representation.

### 3.3 The correction this forces: layers are not actors

Applying the tests to the first draft's own table finds the real defect.
**"L1 substrate" and "L2 Standard" are layers wearing actor names.** A layer is
a dependency band; it does not initiate anything, because it is not a thing.
Promoting the parser without decomposing them would have been inconsistent.

The tests decompose both. Strongest candidates, each still owing the same
evidence the parser just supplied:

- from L1 — **Parser** (confirmed above), **Module loader** (the loading
  mechanism is L1 by ruling while typed module objects are L2, so the role is
  already stated separately from its collaborator), **Grammar registry**
- from L2 — **Type system** (T2 confirmed: it initiates into the evaluator at
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
| **Type system** | Declares types, checks annotations and refinements, dispatches members | T2 confirmed |
| **Module loader** | Extension loading, dependency resolution, caching | candidate |
| **Grammar registry** | Runtime grammar extension and fragment merging | candidate |
| **Effect system** | Infers and checks effect declarations | candidate |
| **Totality analyzer** | Termination, decrease metrics, exhaustiveness | candidate |
| **Proof kernel** | Emits obligations, checks candidates, records authorship | candidate |
| **Author** | Supplies the program. VISION's participants collapse here | confirmed (T2 at the system boundary, not in-process) |
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

### 3.6 What the tests exclude

The definition is only worth having if it refuses things. It refuses:

- **`putEntry`, `SlotView`, `collapseBodyMetadata`** — fail T1. Their role is
  not separable from the representation; they *are* the how.
- **The propagation table** — fails T2. It is data the Engine consults, never
  a party.
- **`slots.ts`** — fails T2 and T3. It is an *interface on* the Engine, not an
  actor behind one. This matters: it is a second, independent reason §5.3 is
  not an activity, since an Engine reading its own representation has the same
  actor on both sides of the supposed crossing.

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
   parser. Three tests now: role/implementation separability, initiation, and
   wanted encapsulation. Statefulness, externality and size are explicitly
   not tests.
2. **The definition immediately refused the draft's own table.** *L1
   substrate* and *L2 Standard* are layers wearing actor names (§3.3). Layers
   do not initiate, so they cannot be actors — and applying the tests replaces
   two placeholders with the actors they were standing in for.
3. **Tool and External prover are one actor in two activities** (§3.5) — the
   taxonomy collapsing rather than growing.
4. **§5.2 is a genuine missing interface**, and the model distinguishes two
   fixes that look like one: removing the cast, and removing the need.
5. **§5.3 is not an activity**, now for two independent reasons: it fails the
   functional-test criterion, and `slots.ts` fails the actor tests (§3.6), so
   an Engine reading its own representation has the same actor on both sides
   of the supposed crossing.
6. **§5.4 needs nothing**, which makes it the calibration point.

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
3. **Whether this is an Allegro practice or a methodology one.** The
   maintainer reports using the model on most complex projects; if it works
   here it is an amendment candidate, not just a design doc.
4. **Where the interfaces would live** if adopted — per-actor modules, or
   declarations checked by the boundary battery the way the plane invariants
   are.
