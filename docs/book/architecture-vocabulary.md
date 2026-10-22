# Architecture vocabulary: layers, tracks, planes, channels, actors, units

> Tier 1 design doc. Defines the six architectural abstractions the
> design documents use, says which question each one answers, and states
> how they relate. Each term has one definition site elsewhere; this
> document cites it and does not restate reasoning. Written 2026-10 after
> the review of the plan for B-112 (plane interfaces) found that the
> abstractions were defined in five
> documents and distinguished in none.

## 1. Why six abstractions exist

Each abstraction answers a different question about the system. The
questions are independent, so no single abstraction can replace the
others.

| Question | Abstraction | Defined in |
|---|---|---|
| What may this code depend on? | **Layer** | `layers.md` §1 (the layer spine) |
| What cross-cutting deliverable is this part of? | **Track** | `layers.md` §2 (capability tracks) |
| Where does this piece of information live on a value, and who may write it? | **Plane**, **field**, **channel** | `concepts.md` §18 (plane), §19 (metadata field), §19b (channel) |
| By what route may code reach a plane? | **Plane interface** | `concepts.md` §24 (plane interfaces) |
| Who is responsible for this behaviour, and what do functional tests cover? | **Actor**, **activity** | `actors-and-activities.md` §3 (actors) and §4 (activities) |
| Which code holds this decision, and what may it import? | **Unit** | `units.md` §2 (what a unit is) |

Layers, tracks and units describe **code**. Planes, fields, channels and
plane interfaces describe **values at runtime** and the code that reaches
them. Actors and activities describe **roles and behaviour**, independent
of both.

## 2. Definitions

### 2.1 Layer

A **layer** is a band of the implementation defined by what it may depend
on. There are four: L0 Allegretto (the base language), L1 the extension
substrate (grammar, parsing, module loading), L2 Allegro Standard (types,
effects, proofs and the rest of the typed language), and L3 Vivace (domain
models). A layer may depend only on layers below it.

Source: [`layers.md` §1 (the layer spine)](layers.md#def-layer). Enforced
today by the boundary battery in `src/boundary-tests.ts` and, since
D50 (units in a narrow DAG), by the unit order (§2.6).

### 2.2 Track

A **track** is a cross-cutting deliverable that touches several layers,
such as the build pipeline, tooling, host environments or code
generation. A track consumes the public surface of any layer and is never
a dependency of a layer.

Source: [`layers.md` §2 (capability tracks)](layers.md#def-track). The word
*capability* in "capability track" means a thing the platform can do, not
an authority token (§3).

### 2.3 Plane, field and channel

A **plane** is one of four storage regions a value's information can
occupy, distinguished by who may write it and what evaluation does to it:
data (what the value is), binding (a composite's named parts), metadata
(information about the value), and host (interpreter bookkeeping,
invisible to programs).

A **metadata field** is one named slot of the metadata plane. It carries a
declared propagation rule, which says what operations do with it, and a
writer capability, which is the authority to set it.

A **channel** is everything one language feature needs in order to ride
values through partial evaluation: one or more fields, their propagation
rules, their writer, and the layer-side code that interprets them. Typing
is a channel; effect analysis is a channel. A field is storage; a channel
is a feature built on storage.

Sources: [`concepts.md` §18 (plane)](concepts.md#def-plane); in
`allegretto/metadata-and-capability.md`, [§3 (metadata
field)](allegretto/metadata-and-capability.md#def-metadata-field), [§4
(channel)](allegretto/metadata-and-capability.md#def-channel), [§5
(propagation)](allegretto/metadata-and-capability.md#def-propagation) and
[§6 (writer
capability)](allegretto/metadata-and-capability.md#def-writer-capability).

### 2.4 Plane interface

A **plane interface** is the sanctioned route by which code reaches a
plane, as producer or consumer. Reaching a plane any other way, such as
a direct field read, an import from a higher layer, or a hardcoded field
name, is a plane violation even when it computes the right answer.

The interface table in [`concepts.md` §24 (plane
interfaces)](concepts.md#def-plane-interfaces) lists one row per plane and
consumer. Most rows are ordinary accessors. One row is different: the
route by which a **layer gives the base behaviour the base must not
know**, such as how to check a value against a type. That route is a
**hook**: the base declares a named slot, the layer registers an
implementation when it loads, and the base calls it without importing
the layer. B-112 owes four such hooks and the B-112 plan
(`docs/plans/plane-interfaces.md`) defines them.

In standard terms this is dependency inversion realised by registration:
the lower module owns the interface, the higher module supplies the
implementation at load time, and the dependency arrow points downward
even though control flows upward.

### 2.5 Actor and activity

An **actor** is a role that is separable from its implementation and
whose encapsulation is warranted by one of three things: it initiates
interactions, it holds state across them, or it has algorithmic substance
of its own. Actors are types, usually with one instance, and decompose
two levels deep. The Engine, the Kernel, the Parser and the Type system
are actors.

An **activity** is a set of related interactions between actors that
functional tests would cover as one behaviour. *Dispatch member access*
and *Attach and propagate metadata* are activities.

Source: [`actors-and-activities.md` §3.1 (what counts as an
actor)](actors-and-activities.md#def-actor), §3.7 (actors are types, and
they decompose), [§4 (the activity
inventory)](actors-and-activities.md#def-activity).
That document is a draft exercise; its adoption is an open ruling.

### 2.6 Unit

A **unit** is the smallest body of code that holds one decision, depends
only on named units below it with every dependency an import edge, has one
home on disk, and can be replaced without editing what does not name it.
Units form a narrow directed acyclic graph. `bits`, `scope`, `evaluator`
and `type-core` are units.

Source: [`units.md` §2 (what a unit is)](units.md#def-unit) and §4 (the
DAG). Ratified as D50 (units in a narrow DAG). Measured by
`scripts/analyze/index.ts units`.

## 3. The word "capability" has three senses

The design documents use one word for three things. Readers should check
which is meant; writers should prefer the specific term.

| Sense | Means | Specific term to prefer | Where used |
|---|---|---|---|
| Capability track | a cross-cutting deliverable | **track** | `layers.md` §2 |
| Writer capability | an unforgeable token conferring authority to write a field, realised as a closure; possession is authorisation (capability-based security) | **writer**, or **authority token** | `concepts.md` §21; D23 (writes are capability-gated, reads free), D24 (the capability is a delegable closure; attenuation is wrapping) |
| A channel is a capability | a language feature carried through evaluation | **channel** or **feature** | `concepts.md` §19b; "the provability capability" in `layers.md` §3 |

The B-112 plan's principle P4 (registration is capability-gated) uses the
second sense only.

## 4. How the abstractions relate

- **Layers are bands of units.** The layer rule, dependencies point
  downward, is implied by the unit DAG and is no longer its finest
  statement. `units.md` §4 lists units by layer.
- **Tracks are sets of units above the layers.** The pipeline, the
  introspection tooling and the CLI are units in the track band of
  `units.md` §4.4.
- **An actor is implemented by a set of units.** `units.md` §6 maps each
  actor to its units and records where the two disagree (the thirteen
misalignments of its §6.1). A
  unit may instead implement an activity, as the compile pipeline does.
- **Planes are a property of values, not of code.** Every unit that
  touches a value sees the same four planes. A unit may read a plane only
  through that plane's interface.
- **A channel is implemented across layers.** Its fields and propagation
  rules live in the L0 `metadata` unit; its meaning lives in an L2 unit
  such as `type-core`; the two meet at a plane interface. The L2 unit
  installs into L0 through a hook and never the reverse.
- **A hook is a plane interface that crosses a layer boundary.** It is
  also an import edge in the unit DAG, from the installing unit down to
  the unit that declares the hook. That is how `units.md` §5 can state
  "the evaluator does not depend on `types-std`" as a checkable fact.

## 5. Where to look

| Need | Document |
|---|---|
| The four layers and their contents | `layers.md` §1 |
| A file's layer | `implementation-map.md` |
| A file's unit, and what it may import | `units.md` §4; `scripts/analyze/units.json` |
| Where a kind of information goes on a value | `concepts.md` §18, the placement rule |
| The sanctioned route to a plane | `concepts.md` §24, the interface table |
| The hooks that are owed and how they land | `docs/plans/plane-interfaces.md` |
| Who is responsible for a behaviour | `actors-and-activities.md` §3.8, the hierarchy |
