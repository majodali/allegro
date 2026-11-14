# The software system model: a model specification

> **Status: ruled 2026-11-14.** The first draft specified a structural
> model of components, ports and data; this one states the maintainer's
> model from the design session of 2026-11-13 and 2026-11-14, and every
> question it put is ruled (§13). Nothing of the model is built.
>
> **Reader.** The maintainer and the review session. The reader knows the
> ruled decisions of the inventory, Parts I to VI; the program plan
> `docs/plans/rebuild.md`; the term
> [model specification](../../../docs/plans/rebuild-acceptance.md#def-model-specification);
> and the planning specification `next/models/specs/planning.md` with
> its thirteen rulings, which this document builds on and does not
> restate. The earlier partial use of the model is the draft chapter
> `docs/book/actors-and-activities.md`, which says "actor" where this
> model says "participant".
>
> **The source of truth.** The maintainer's description in the design
> session, in two parts: a sketch and clarifications. What it says is
> marked *maintainer* in the tables below. The orchestrating session
> proposed eleven additions in that discussion. The maintainer ruled
> on eight of them on 2026-11-14, in the design session: "I agree with
> the six model additions you proposed. Let's go with the `next/`
> iteration of Allegro as the example. I agree with use of "system
> participant" when we need to distinguish." Those eight are stated
> as settled text and marked *ruled 2026-11-14*. The other three
> proposals, and every choice of this document, were the thirteen
> questions of §13. The maintainer then ruled three of them in words
> and took the recommended option of the rest: "Everything else looks
> good." §13 records each.
>
> **Ruled 2026-11-14.** The term "participant", with "system
> participant" where the vision's sense is near; valid and sound as two
> levels, reachability, concurrent writes and partial guarantees (§6);
> combining quantitative attributes (§5); intermediaries in a
> refinement (§4); the example's scope (§10).
>
> **Terms.** This document defines them, one sentence each.
>
> - **System model**: a value that describes one system by its participants, activities and domain models.
> - **Participant**: an element that takes part in interactions: a user, a system component or an external system; written "system participant" where the vision's sense of the word is near.
> - **User**: a participant that is a person or an agent acting in a role, identified by its **user role**, a name and a description.
> - **System component** (component): a participant that is part of the system; at the top level, a whole application or service reachable by other participants.
> - **External system**: a participant outside the system that the system interacts with.
> - **Interface**: a port of a component, where interactions from outside it connect; distinct from the standard language's interface type.
> - **Endpoint**: a participant at the top level, or an interface or a subcomponent inside a component.
> - **Interaction**: a one-to-one, directed exchange between two endpoints, its **initiator** and its **responder**, at the granularity the modeller chooses.
> - **Content**: what an interaction carries, typed in a domain model's language.
> - **Reference**: content that designates a participant or a component instance, so that its holder can interact with it.
> - **Result**: one of the named ways an interaction can end, normally or with a failure such as a timeout.
> - **Activity**: a set of related interactions toward a goal, with choices and loops.
> - **Dependency**: the order between an activity's steps, derived from shared content, results and **ordering constraints** (pairs the modeller orders); two steps neither of which depends on the other are **concurrent**.
> - **Choice**: a point of an activity where one named participant selects one of several branches.
> - **Loop**: a part of an activity that may be repeated.
> - **Subcomponent** and **internal activity**: a component inside another, and an activity between a component's interfaces and subcomponents.
> - **Parameter mapping**: the function from an interaction's content to an interface's or a call's parameters, which may transform it.
> - **State**: what a stateful component holds across interactions.
> - **Goal**: a predicate over domain facts, with its description, that belongs to an activity's initiating participant.
> - **Guarantee**: the modeller's statement that the system as defined guarantees a goal, fully or in part; the model's library checks it, and where the check fails the goal is flagged.
> - **Validation**: a formal check, partial or full, that an element applies to content or state.
> - **Domain model**: a model of the facts relevant to the problem and solution space; it supplies the language of content and goals.
> - **Attribute**: a fact a domain model attaches to an element, such as a latency or a security level.
> - **Instance annotation**: the mark on an element saying whether it has one instance per system instance, or many.
> - **Refined**, **decomposed**, **determined**: an interaction replaced in detail by an activity (distinct from the standard language's refinement type: this model says "refined into an activity", never "a refinement"); a component given interfaces, subcomponents and internal activities; a detail left open given a value.
> - **Realisation**: what an element is where modelling stops: a description, a formal definition, or code.
> - **Valid**, **sound**, **flagged**: a model that is well-formed; one whose foundational claims all hold; an element or goal a report names, the model still valid.
> - **Foundational claim**: one of the few statements of the model that, when they all hold, indicate it is sound (§6); a statement of the model, checked by its library.
> - **Choreography failure**: a participant that cannot tell which branch of a choice was taken.
>
> **Two senses of one word.** In this document "claim", unqualified,
> has the ruled sense of the platform: an expression someone asserts,
> which the kernel decides, refutes or leaves undecided, and whose
> refutation halts. A goal, a guarantee and a foundational claim are
> statements of the model. The maintainer, 2026-11-14: a guarantee "is
> certainly not a claim in the Allegro sense", and "we're entering a
> modeling world where similar concepts have the same name but are
> formally distinct". §6 says which is which.
>
> **No ruling is open.** Where a section says "question n", §13 gives
> the question and its ruling.

## 1. What the model is for

Five use cases. Every later section names the ones it serves.

| # | Who | What they have | What they want from the platform |
|---|---|---|---|
| 1 | The project describing itself (§10; `scripts/analyze/units.json`, `next/decisions.json`) | A platform with users, a launcher, a kernel, extensions and tools; units of code and decisions assigned to them | The platform's participants and activities as a model value, refined as far as the rebuild has determined them, related to the code and the decisions by declared mappings. The first example |
| 2 | A team describing a service, from broad strokes to detail | User roles, the service, the external systems it uses, and the activities between them, each with a goal | To start at the top level with informal descriptions, decompose and refine where details are known, and leave the rest open. A valid model at every step |
| 3 | A designer asking what a design guarantees | A model with goals and rules, constraints and validations on its elements | Which goals the system as defined guarantees, fully or in part, at what strength; for each goal that falls short, the element that needs a validation; choreography failures named |
| 4 | A system delivered by plans (`docs/plans/rebuild.md` §5; the planning specification's use case 5) | A system model, and plans whose outcomes are elements of it realised | The elements no plan delivers listed as obligations, answered by the planning specification's loop, with a record of who proposed each answer |
| 5 | A maintainer evolving the model (`scripts/analyze/units-baseline.json`) | A model, a new version of it, and a rule the code does not yet meet | The new version related to the old, with claims about what it preserves: goals guaranteed stay guaranteed, known exceptions only shrink |

## 2. The elements

Serves use cases 1 to 5. Under "A model is a value", a system model is
a value built from the system model's meta-model, and ordinary
functions construct, inspect, transform and compare it. A model
value's names are fields of the value, as the planning specification's
question 13 ruled. Constructors are placeholders for the rebuild to
choose. The mark is *maintainer* (the design session); *ruled
2026-11-14* (the maintainer's ruling on the proposals); a ruled
decision of the inventory, named; or a question of §13, each ruled
2026-11-14.

| Element | What it holds | Constructs it | Mark |
|---|---|---|---|
| System model | Its participants, its top-level activities, the domain models it uses, the claims made of it | `system(name, participants, activities, domains)` | *maintainer*; "A model is a value" |
| User | A user role: its name and description; attributes; rules and constraints | `user(role)` | *maintainer*. A type with many instances, "effectively a role or category" |
| System component | Interfaces, subcomponents, internal activities; whether it is stateful, and its state; its realisation | `component(name, interfaces, parts, activities)` | *maintainer*. The form of a change of state, question 3 |
| External system | Its description, attributes, rules and constraints; interfaces where the modeller gives them | `external(name)` | *maintainer* for the kind. Interfaces on an external system are optional, question 3 |
| Interface | Its parameters and what it returns, typed in a domain model; the kinds of interaction it accepts | `port(name, params, returns)` | *maintainer* ("Interfaces or ports") |
| Interaction | Initiator and responder; content; kind, synchrony and locality, each possibly undetermined; constraints on content; its results; a parameter mapping where an endpoint is an interface; a refinement, possibly absent | `interact(from, to, content)` | *maintainer*; directed, *ruled 2026-11-14* (§3) |
| Activity | Its initiating participant, its goal, its interactions, ordering constraints, choices and loops | `activity(name, by, goal, steps)` | *maintainer*. What it is as a value is stated in §3 |
| Ordering constraint | A pair of interactions, the first before the second | `before(i, j)` | *maintainer* ("explicit ordering constraints are necessary") |
| Choice | The participant that makes it; its branches, each a set of steps | `choice(by, branches)` | *maintainer* ("made by a specific participant") |
| Loop | Its body; the participant whose choice repeats or ends it | `loop(by, body)` | *maintainer* for loops; that participant's choice, question 4 |
| Result | Its name; normal or failure | `ends(name)`, `fails(name)` | *maintainer* |
| Reference | A designation of a participant or of a component instance, carried as content | a content field typed by a participant | *maintainer*; "Authority is an unforgeable value" for what holding one means in code |
| Parameter mapping | A function from content to parameters, possibly transforming them | an ordinary function | *maintainer*; "A typed function claims its parameter types on entry and its return type on exit" |
| Goal | Its description; its predicate over domain facts, possibly absent; its owner | `goal(owner, description, holds)` | *maintainer*; a predicate, *ruled 2026-11-14* |
| Guarantee | A goal, and full or the parts stated | `guarantees(goal, parts)` | *maintainer*; "partially" as clauses with their own strengths, and a failed check a flag, both *ruled 2026-11-14* (§6) |
| Validation | A predicate an element applies to content or state | a constraint on the element | *maintainer* |
| Domain model | Types, facts, constraints and attributes | the domain model's own library | *maintainer*; its relation to the system model, question 2 |
| Attribute | A field a domain model adds to elements | the domain model's library | *maintainer*; its combining rule, *ruled 2026-11-14* (§5) |
| Instance annotation | One per system instance, or many | a field of every element | *maintainer* |
| Realisation | A description only; a formal definition; code | §4 | *maintainer*; code through a mapping, §8 |

**Every element has two parts.** An informal description, written by
the modeller and read by people. A formal part: attributes, rules and
constraints, each an expression in a domain model's language. Either
part may be all there is. A check that rests on a description is
reported as assumed (§6, ruled 2026-11-14).

**Every element is a type.** A user is a type with potentially many
instances. A top-level component is likely a singleton in each
instance of the system. The instance annotation records which. This
document reads an instance of an activity or an interaction as one
occurrence of it in a running instance of the system, so the
annotation applies to every element.

## 3. Interactions and activities

Serves use cases 2 and 3.

**Granularity.** An interaction is modelled at the granularity that is
clearest: a one-way transfer, a whole call with its answer, a request
and its response kept apart, a dialogue left whole. Each is one
interaction, and may later be refined into an activity (§4).

**Initiator and responder.** An interaction is one-to-one and always
directed (ruled 2026-11-14): one endpoint initiates, the other
responds. In a whole call the content has two
parts, what the initiator sends and what the responder returns.

**Content and references.** Content is typed in a domain model's
language and carries constraints there. It may include references to
participants: a notification about a customer can lead to a phone call
with that customer. It may include references to components, such as
a stateful entity component the receiver then interacts with.

**Kinds and undetermined details.** An interaction's kind (a user
using a UI, an HTTP request and response, a service call, an event
notification, or a kind a domain model adds), its synchrony and its
locality are three fields. Each may be stated or left undetermined
(§7).

**Results and failures.** An interaction declares its results: its
normal end and the failures it can end with, such as a timeout or a
failed content constraint. A failure can also be communicated by an
interaction, as an error or a validation failure sent as content. A
failure nobody modelled, such as a service outage, is handled by the
element that detects it, which initiates an activity to notify or
remediate (question 6). Broadcast is modelled with a bus component or
similar.

**An activity as a value.** It holds its name and description; its
initiating participant (question 5); its goal (§6); its steps, which
are interactions, choices and loops; its explicit ordering
constraints, pairs of steps; and constraints over its content.

Its **dependency relation** is derived. Step *j* depends directly on
step *i* when one of three holds:

1. *Shared content.* *i* and *j* involve a common participant *p*, and
   content that *p* supplies to *j* is, or is computed from, content
   *p* sent or received in *i*. This is this document's reading of
   "share content with subsequent Interactions involving one of the
   same Participants".
2. *Results.* *j* happens only after *i* ends with a named result, as
   a failure path depends on the timeout that opens it.
3. *Ordering.* (*i*, *j*) is an ordering constraint.

The dependency relation is the transitive closure of these, acyclic
within one pass of a loop. Two steps neither of which depends on the
other are concurrent: they may happen in either order or together.
Shared content may be governed by a data constraint over the content
of both.

**Choices.** A choice is made by one named participant. Its branches
are sets of steps. A step in a branch depends on the choice; a step
after the choice that depends on it depends on whichever branch was
taken. Whether the others are notified is the activity's design; in
most cases the following interactions make the choice clear. A
participant that behaves differently in two branches and cannot tell
which was taken is a choreography failure, which should be checkable
(§6).

**Loops.** A loop's body is a set of steps that may repeat, each pass
depending on the one before. This document models the repeat-or-exit
step as a choice made by a named participant at the end of each pass
(question 4).

## 4. Decomposition and refinement

Serves use cases 1, 2 and 4. An element gains detail in three ways, at
any time; modelling may stop at any level.

| Way | What it adds | What stays the same |
|---|---|---|
| A component decomposed | Interfaces, subcomponents and internal activities | The interactions at the component's boundary |
| An interaction refined into an activity | An activity between the two endpoints, possibly involving subcomponents of either, and an intermediary only if it is declared at the enclosing level (*ruled 2026-11-14*) | The endpoints, content and results, as the activity's boundary |
| An undetermined detail determined | A value for a field left open | Everything else |

**A decomposed component** has interfaces, which external interactions
connect with; subcomponents; and internal activities made of
interactions between interfaces and subcomponents in any pairing,
interface to interface and subcomponent to subcomponent included. A
subcomponent is decomposed further, left at the detail the modeller
chooses, or defined as a single function with a single call interface.

**State, data and repositories.** A component can be stateful, and a
low-level component can be a simple data element or a data
repository. A datum is a stateful component whose interfaces read and
write it. Its state is typed in a domain model, and an invariant over
it is a constraint. The chapter's §3.7 reaches the same place:
"Internal state is modelled as state-carrying actors".

**Interface mappings and transformations.** An interaction that
reaches a component's interface carries a mapping from its content to
the interface's or call's parameters, which may transform it. A
transformation is an ordinary function, so the platform checks it:
its type is a claim, under "A typed function claims its parameter
types on entry and its return type on exit". Under "A transformation
is a model", one written declaratively is inspected like a model.

**Where modelling stops.**

| Realisation | What it is | What a claim over it can reach |
|---|---|---|
| Described | The informal description alone | Nothing formal: a claim that rests on it is assumed |
| Defined formally | Attributes, rules, constraints and validations; for a leaf, a function | Every claim of §6, relative to the system as defined |
| Realised by code | An Allegro function or module, or code in another language through a declared mapping (§8) | The mapping's claims, under "The kernel trusts only what it has evaluated" |

Going all the way to a fully realised set of Allegro components is
possible and not required.

## 5. Domain models

Serves use cases 2 and 3. "Domain model" is an open term in the design
session: a model of any facts relevant to the problem and solution
space.

**The language of content and goals.** A domain model supplies the
types in which content, state and goals are written, and the facts and
constraints over them. Under "A system is described in the language of
its domain, and that language grows with the understanding", it grows
with the modellers' understanding, and each new concept is checked
from then on.

**Attributes on elements.** A domain model can add attributes to the
system model's elements: quality (latency, availability), deployment
(where a component runs), security (a level, a classification).
Ruled 2026-11-14: where an attribute is quantitative, the domain model
gives the rule that combines it along an activity, such as a sum along
a dependency chain or a maximum across concurrent branches. Any other
attribute is a plain annotation. Under "An extension registers its own
fields; the kernel has two", an attribute is a metadata field its
domain model registers.

**Extending and specialising.** A domain model can extend or
specialise the system model: add an interaction kind (an HTTP request
with a method and a path), a kind of component (a queue), a rule over
elements (which components may interact).

**With "Two models relate only through a declared mapping".** A domain
model and a system model are two models. Content typed by a domain
model's types is "one model's values typed by another's", a candidate
mapping kind of the inventory. Specialising the system model's
elements is a second relation: the domain model is a library that
builds on the system model's library (question 2).

## 6. Goals and claims

Serves use cases 3, 4 and 5.

**The goal, as the maintainer states it.** A goal is a predicate over
domain facts. The design session first called it a claim; the
maintainer, ruling question 12: "I said "claim", but perhaps I should
have said "predicate"." A goal is ascribed to an activity as belonging to its
initiating participant: the user's goal, the component's expected
postcondition. The modeller writes it. Nothing requires an element to
validate a goal; an element may include a partial or full validation.
The model can state that the system as defined guarantees a goal,
fully or partially, and that guarantee is checked against all the rules
and constraints of the activity, its interactions and its
participants. Checking it can identify an element that needs a formal
validation. A goal that is not guaranteed is flagged, and the model is
still valid.

**Deciding a guarantee.** The goal's predicate is evaluated over the
domain facts the activity establishes, every value no constraint fixes
left unknown, with the constraints of the activity, its interactions
(content constraints, results, parameter mappings) and its
participants (rules, validations, invariants) as premises. Under "A
claim about every value is decided by evaluating it with the value
unknown", the guarantee holds when the residual is true. Otherwise
each part of the residual mentions content or state no premise
constrains, and the element that supplies it is the one that needs a
validation. A guarantee the check finds false is a flag, with its
counterexample, and the model is still valid (ruled 2026-11-14,
question 12). So is a goal with no guarantee, and each part a partial
guarantee leaves out.

**Which statements are claims in the platform's sense.** One.
Declaring a model value claims that it is well-formed, as
"Constructing a refined value claims its predicate" has it for any
constructed value, and an ill-formed model is refuted. Every other row
below is a statement of the model. The model's library checks it by
ordinary analysis, under "A model's quality is a question for
analysis", and reports the result with its strength; a statement that
fails is flagged, and a foundational one that fails leaves the model
valid and not sound. A modeller who wants a failed check to stop a
build can make a claim over the check's result, under "Nothing is a
claim until someone makes it". Nothing requires it.

**The statements and their checks.** Strengths are the four of "Four
strengths, one vocabulary", used for what a check's result rests on.

| Statement | Who makes it | What checking it takes | Results | Strength | Mark |
|---|---|---|---|---|---|
| Well-formed: every endpoint exists in its scope, every content type resolves in a domain model, every mapping and transformation checks as an ordinary function, the dependency relation is acyclic within a pass | The modeller, by declaring the system model | Evaluating over the model value | True; refuted, naming the element | decided | *ruled 2026-11-14*, the level "valid"; in the list of question 3 |
| A goal is guaranteed, fully or in the parts claimed | The modeller, by a guarantee | Evaluating the goal under the premises, unconstrained values unknown | Guaranteed; not guaranteed, flagged with a counterexample; undecided, naming the elements that need a validation | decided over the formal part; assumed where a premise rests on a description; undecided while a detail it needs is open | *maintainer*; a strength per clause, *ruled 2026-11-14* |
| Agreement: a component's internal activities agree with the external interactions at its interfaces | The modeller of the decomposition | The projection of the internal activities onto the interfaces, against the external interactions (below) | Holds; fails, naming the interaction and the interface | decided | *maintainer* for the claim; its precise form, question 3 |
| Invariants on stateful components hold across every interaction that changes their state | The modeller of the component | The invariant on the new state, with the old state unknown and satisfying it, under "Invariants are refinements" | Holds; fails, with the interaction and a counterexample | decided | *maintainer* for the claim; a change of state, question 3 |
| Reachability: a responder is wired by the decomposition, or is a reference the initiator received as content or holds in state | The modeller | Evaluating over the dependency relation | Holds; fails, naming the interaction | decided | *ruled 2026-11-14* |
| Choice visibility: every participant whose behaviour differs between branches receives something that depends on the choice | The modeller | Evaluating over the branches and the dependency relation | Holds; fails, naming the participant and the choice | decided | *maintainer* that it is checkable; its form, question 3 |
| Concurrent writes: two potentially concurrent interactions that both write one stateful component are ordered or declared safe | Nobody: the check reports it | Evaluating over the dependency relation | None found; each pair flagged, unless an ordering constraint relates it or the component declares it safe | decided | *ruled 2026-11-14* |
| A loop terminates | The modeller, when claimed | A decrease per pass, under "Termination by bounded decrease", or the claim written as assumed | True; assumed; flagged when unclaimed | decided, or assumed | question 4 |
| An element's validation holds of the code realising it | The author of the realisation mapping | Evaluating the code's claims through the mapping (§8) | True; refuted | decided where the code is evaluated | question 10 |

**Valid, sound and flagged** (ruled 2026-11-14). A model is valid
when it is well-formed, and sound when the foundational claims all
hold. Whatever else falls short is flagged: a report, never a
refusal.

**The foundational claims.** Beside the goals guaranteed:
well-formedness, agreement, reachability (ruled 2026-11-14), choice
visibility and invariants on stateful components (the list and the
form of agreement below, ruled 2026-11-14, question 3). The model's
summary is the weakest strength
among its claims, as "A module's summary is the weakest strength among
its claims" has it for a module.

**Agreement, stated** (question 3). For a component *C* and each
external activity *C* takes part in, project *C*'s internal
activities onto its interfaces: keep the interactions with an
interface endpoint and the dependency relation between them. Three
conjuncts:

1. Every external interaction at an interface *f* matches an internal
   interaction at *f*: the same direction; its content, through *f*'s
   parameter mapping, of the type the internal one accepts; every
   result the internal one can end with declared by the external one.
2. Where the projection orders an interaction the outside initiates
   after another at *C*'s interfaces, the external activity orders the
   matching pair the same way: *C* never waits on something the outside
   may send later.
3. Every result of an external interaction that the external activity
   depends on is one the projection can produce.

## 7. Incremental specification, unknowns and proposals

Serves use cases 2, 3 and 4.

**An undetermined detail is an unknown.** A field left open (a kind, a
content type given only by description, a component not decomposed,
an interaction not refined) is a cell, under "A missing value is a
cell that is filled once". A claim that holds whatever the cell holds
is decided with the cell unknown; one that depends on it is undecided
and waits.

**What is listed as open.** Every claim waiting on a cell, under "Open
obligations are listed for any proposer"; every flagged goal and every
claim resting on a description, with its strength, under "Every
result says how strongly it holds".

**What a proposal can be.** Under "A proposer answers with only the
missing value": a determination, a validation for the element a
guarantee check named, a refinement of one interaction, or a
decomposition of one component. Each fills one cell, so the model as
written is unchanged. A change outside a cell is a new version (§8).

**The loop.** The planning specification's §4 serves every unknown
here: the obligation is listed, a proposal is evaluated in trial, a
refusal is the claim's explanation with that candidate, and an
accepted proposal fills its cell once with its proposer recorded,
under "Anyone may propose, and the record shows who". A refinement or
a decomposition brings cells of its own, so its claim may still wait;
it is kept when its own statement holds (question 8).

## 8. Mappings to other models

Serves use cases 1, 4 and 5. Under "Two models relate only through a
declared mapping" and "A mapping between models is itself a checked
value", each relation is a mapping value, declared and checked.

| Mapping | Kind | What it maps | What is claimed | Mark |
|---|---|---|---|---|
| Delivers: plans to a system model | One model's values typed by another's; a claim that spans two models | A plan's outcome to an element realised (a component, an interface, a datum); a scope of elements the plans must deliver | Every element in scope is an outcome of a mapped plan whose claims hold; one no plan delivers is an obligation for the planning loop | The composition point ruled on the second model; the element in place of the first draft's artifact, questions 7 and 8 |
| Realises: a system model to code | One model as a more detailed version of another | Components to units and files (`scripts/analyze/units.json`'s `files`); interactions to imports and calls | Every file has a component; every import between files maps to an interaction the model permits. A rule over which components may interact is a constraint the modeller adds | questions 9 and 10 |
| Holds: decisions to a system model | A claim that spans two models | Each decision to the component that realises it (`next/decisions.json`'s `unit`) | Each decision with a unit has exactly one, under "Each decision lives in one replaceable unit of code" | Reading the map is an effect, question 10 |
| Changes: a model to its next version | "A change to a model is a mapping from the old one" | Each element of the old to its counterpart: a refined interaction to its activity, an open detail to its value | Goals guaranteed stay guaranteed; claims decided stay decided; known exceptions only shrink | the last, question 9 |

**The present code, read as this model.** The first draft's probe
built the 35 units of `scripts/analyze/units.json` and their permitted
dependencies as values. Two findings carry over. A rule is a predicate
over pairs and acyclicity is a claim over actual interactions, and
they differ: with "any" read as every unit the permission relation has
a cycle (`pipeline` may depend on every unit, and `introspect` and
`cli` depend on `pipeline`), while the actual unit-to-unit edges have
none. And the code does not meet its rule:
`npx tsx scripts/analyze/index.ts units` reports two forbidden edges,
`evaluator` to `effects` and to `refinements` (question 9).

**What needs a reader of files.** Which files exist, what each
imports, and the discriminator rule of `docs/book/units.md` §3.2.
Under "The loader reaches files through a capability", reading a file
is an effect; under "An effect is the use of a capability", an
analysis the platform cannot do, such as resolving TypeScript imports,
is a capability a configuration supplies.

## 9. Notation and views

Serves use cases 1 and 2. Library-first, as the planning model was: a
notation comes when a use case reads better with one. Under "Every
notation stands for an expression", each form maps what it matched to
an expression and does nothing else.

| Form | The expression it stands for | Needed by |
|---|---|---|
| `participant NAME: user ROLE` (and `component`, `external`), with `one` or `many` | A binding of `NAME` to the element, with its instance annotation | Use cases 1 and 2 |
| `activity NAME by P:` and a block of `A -> B: content` lines, `before:`, `choice by P:`, `loop by P:`, `goal:` | A binding of `NAME` to the activity | Use cases 2 and 3 |
| `component NAME:` and a block of `port`, `part` and `activity` entries | A binding of `NAME` to the decomposed component | Use cases 1 and 2 |
| One determination, refinement, decomposition or validation | One value for one cell | The loop, as the planning specification's §4 states for catalog entries |

**Views.** An activity diagram, a sequence view or a component diagram
is a view of the value, the candidate mapping kind "a view of part of a
model", showing only what the result holds. The tables of §10 are
sequence views written by hand.

## 10. The first example: Allegro

Serves use case 1. Ruled 2026-11-14: the example models Allegro as
the ruled decisions rebuild it, the `next/` tree, with the chapter
`docs/book/actors-and-activities.md` as evidence, so the example
doubles as the architecture of `next/`. Sources: *ch* (the
chapter), a ruled decision by its title, or *choice* (this document's
modelling).

**Level 1: the participants.** One system instance is one running
invocation of the platform.

| Participant | Kind | Instances | What it is | Source |
|---|---|---|---|---|
| Author | User | many | Writes programs, extensions and models, and runs commands | *ch* (UserCode, a type); Part VI's introduction |
| Proposer | User | many | A person or an agent answering obligations | "Anyone may propose, and the record shows who"; *ch* (ExternalAgent) |
| Launcher | Component | one per system instance | Host code that creates a kernel, gives it its first extensions and capabilities, and starts an evaluation | "The launcher does only what cannot be done in Allegro" |
| Kernel | Component | many: the launcher creates one, an embedding application may create several | Evaluates and records the outcome of claims, acting only on calls of its interface | "The kernel is passive"; "What the kernel's interface offers" |
| Extension | Component | many | Allegro code the kernel evaluates: the parser engine, the module loader, the standard language, a domain language | "Everything above the kernel is an extension, and there is one way to extend" |
| Tool | Component | many | Reads a phase's result and presents it, or places a proposal | "A tool reads a phase's result and adds no analysis of its own" |
| Host platform | External system | one per system instance | Files, the terminal, the clock, the network | *ch* (Environment); "The terminal and the browser ship output, timers and HTTP" |
| Embedding application | External system | many | Creates a kernel and calls its interface | "What the kernel's interface offers", its use case |

The Kernel's interface is the proposed `next/kernel/interface.ts` of
the kernel stream's contracts branch: construct, bind, create scopes,
fill cells, evaluate, settle, read. The example's domain model holds
programs, claims, outcomes, strengths, capabilities and their parts,
cells, obligations, proposals and results, in the ruled decisions'
sense.

**Activity 1: run a saved program that prints through a capability**
(milestone 2). Initiated by the Author. Goal: the terminal shows the
text the program passed to its output capability, once, and the
program held no capability beyond the configuration's ceiling.

| # | From | To | Content | Kind | Depends on | Source |
|---|---|---|---|---|---|---|
| 1 | Author | Launcher | A configuration naming the run phase and a saved program | UI use (a command); synchronous; local | | "Startup, step by step" (1) |
| 2 | Launcher | Kernel | Create a kernel; returned: the kernel | service call; synchronous; local | 1 | "Startup, step by step" (2) |
| 3 | Launcher | Host platform | The saved program's path; returned: its bytes | service call | 1 | *choice* |
| 4 | Launcher | Kernel | The recorded interface calls; returned: the main expression | service call, refined into one interaction per recorded call | 2, 3 | "A saved program is a recorded sequence of interface calls" |
| 5 | Launcher | Kernel | An effectful primitive function of the output capability, bound in the program's scope: a reference to the Launcher's output part | service call | 2 | "Startup, step by step" (4); "A capability is a named set of effectful primitives" |
| 6 | Launcher | Kernel | Evaluate the main expression in that scope | request | 4, 5 | "Startup, step by step" (5) |
| 7 | Kernel | Launcher | The output part called with the text | service call | 5, 6 | "An effect is the use of a capability" |
| 8 | Launcher | Host platform | The text, to the terminal | service call | 7 | *choice* |
| 9 | Kernel | Launcher | The result of 6 | response | 7 | the interface's `evaluate` |
| 10 | Host platform | Author | The text shown | UI use | 8 | *choice* |

Interaction 5 carries a reference to a component as content, and 7 is
reachable because the Kernel received it in 5, as the reachability
claim requires. The
guarantee is partial: it covers the goal's first part, in two
clauses, each with its own strength. The text reaches the Launcher unchanged,
decided, since 7's mapping is the identity; the host writes it,
assumed, since the Host platform is only described. The guarantee's
strength is assumed, and the check names the Host platform's write as
the element that needs a validation. The second part is flagged: no
guarantee is stated of it, and the last list of this section says why.

**Activity 2: decide a claim and report a refutation.** Initiated by
the Author. Goal: every refuted claim of the program appears in the
report with its explanation, and the summary is the weakest strength
among its claims.

| # | From | To | Content | Kind | Depends on | Source |
|---|---|---|---|---|---|---|
| 1 | Author | Launcher | A configuration naming the check phase and the main module | UI use | | "A command is a configuration" |
| 2 | Launcher | Kernel | Create a kernel | service call | 1 | "Startup, step by step" (2) |
| 3 | Launcher | Kernel | The first extensions as saved programs, each once, in dependency order | service call, refined | 2 | "Startup, step by step" (3); "The platform's parser engine ships already built" |
| 4 | Launcher | Kernel | The loading capability, handed to the loader; no other | service call | 3 | "Startup, step by step", its use case "with an empty ceiling at step 4" |
| 5 | Launcher | Kernel | Evaluate the loader's call for the main module | request | 3, 4 | "Startup, step by step" (5) |
| 6 | Kernel | Launcher | Read a file: its path; returned: a cell | service call; asynchronous | 4, 5 | "The loader reaches files through a capability" |
| 7 | Launcher | Host platform | Read the file; returned: its bytes, or a failure | service call | 6 | *choice* |
| 8 | Launcher | Kernel | Fill the cell with the bytes, or with an exception on failure | service call | 7 | "A value that arrives later fills a cell, and a failure fills it with an exception" |
| 9 | Kernel | Launcher | The result: a refutation on the main value, with its explanation | response | 8; a choice by the Kernel among refuted, decided and undecided | "Only the kernel records the outcome of a claim"; "A predicate can explain its refusal" |
| 10 | Launcher | Tool | The result | service call | 9 | "A tool reads a phase's result and adds no analysis of its own" |
| 11 | Tool | Author | The summary word, and the refuted claim with its explanation | UI use | 10 | "A module's summary is the weakest strength among its claims" |

The choice at 9 is the Kernel's. The Author's behaviour differs
between its branches and the Author receives 11, which depends on it,
so choice visibility holds (question 3).

**Activity 3: propose a value for an open obligation.** Initiated by
the Proposer. Goal: the obligation's claim comes out true, the program
as written is unchanged, and the record names the Proposer.

| # | From | To | Content | Kind | Depends on | Source |
|---|---|---|---|---|---|---|
| 1 | Proposer | Tool | Ask for the open obligations of a module | request | | "Open obligations are listed for any proposer" |
| 2 | Tool | Launcher | Check the module; returned: the result | service call, refined into activity 2's interactions 2 to 9 | 1 | *choice* |
| 3 | Tool | Proposer | The obligations, each with its form for people, the last refusal and what is in scope | response | 2 | "Open obligations are listed for any proposer" |
| 4 | Proposer | Tool | One value, and a reference to the obligation it answers | request | 3 | "A proposer answers with only the missing value" |
| 5 | Tool | Kernel | Evaluate the claim with the value in the cell, in trial; returned: the outcome as data | service call | 4 | none yet (§11) |
| 6 | Tool | Kernel | Fill the cell, the Proposer recorded with the filling | service call | 5, on the branch "true" of a choice by the Tool | "Anyone may propose, and the record shows who" |
| 7 | Tool | Proposer | Accepted, with the record; or the refusal with the claim's explanation | response | 5, 6 | "A predicate can explain its refusal" |

A loop holds 4 to 7: after a refusal the Proposer chooses whether to
try again, for at most the Tool's number of attempts, so its
termination is decided by a decrease of the attempts left (question
4). The value proposed holds no capability, the adversarial review's
candidate ruling on accepted proposals.

**One component decomposed: the Launcher.** Its interfaces and
subcomponents are a *choice*; its internal activity follows "Startup,
step by step".

| Interface | Direction | What it carries |
|---|---|---|
| Command | in, from the Author | A configuration and a phase |
| Kernel calls | out, to the Kernel; in, its answers | Calls of the kernel's interface |
| Capability parts | in, from the Kernel | Calls of the effectful primitives the Launcher supplied |
| Host | out, to the Host platform | Reads and writes |
| Result | out, to a Tool | A phase's result |

| Subcomponent | Realisation | Instances |
|---|---|---|
| Configuration reader | A single function: a configuration's sources to a configuration value | one |
| Starter | Stateful: the kernel it created and the scope it built | one |
| Saved-program player | A single function: a recorded call sequence to the kernel calls it makes | one |
| Ceiling | The primitive functions of the capabilities the configuration grants | one per capability |
| Cell deliverer | Stateful: the cells waiting on an answer from the Host platform | one |

The internal activity "Start up and run", projected onto the
interfaces, against activity 1:

| # | Internal interaction | Interface | Activity 1 | Depends on |
|---|---|---|---|---|
| a | Command → Configuration reader: the configuration | Command | 1 | |
| b | Starter → Kernel calls: create a kernel | Kernel calls | 2 | a |
| c | Saved-program player → Host: read the saved program | Host | 3 | a |
| d | Saved-program player → Kernel calls: the recorded calls | Kernel calls | 4 | b, c |
| e | Ceiling → Kernel calls: the output part, bound | Kernel calls | 5 | b |
| f | Starter → Kernel calls: evaluate | Kernel calls | 6 | d, e |
| g | Capability parts → Ceiling: the text | Capability parts | 7 | e |
| h | Ceiling → Host: write the text | Host | 8 | g |
| i | Kernel calls → Starter: the result | Kernel calls | 9 | f |

The agreement claim, by its conjuncts (question 3). Each external
interaction of activity 1 at the Launcher matches one row, with the
same direction and content. The outside initiates a, g and i; the
projection orders g after e and i after f, and activity 1 orders 7
after 5 and 9 after 6. The results activity 1 depends on are normal
ends, which the projection produces. The check finds that agreement
holds, decided over the model.

**What the example could not express.**

- *Determinism.* "The same program and the same information give the
  same result" is a claim over two instances of an activity, and a goal
  belongs to one.
- *The ceiling.* "Only the launcher sets the ceiling" is a claim over
  every program an Author may write. Reachability covers the
  references of the activities modelled.
- *Phases in sequence.* A residual handed from a check phase to a run
  phase elsewhere spans two system instances, and the model relates no
  activities across instances.
- *An interaction inside a whole call.* Interaction 7 of activity 1
  happens while 6 is open. Keeping request and response apart
  expresses it; with 6 as one whole call, 7 has no place.

## 11. What the model needs of the kernel and of the other stream

A need, the decision that owns it, and the open issue of the
adversarial review (`docs/records/book-pass/adversarial-review.md`)
that bears on it. The kernel's designs are not this document's.

| Need | Owning decision | Open in the review |
|---|---|---|
| Evaluating a goal with unconstrained values unknown, under premises from the model's constraints | "A claim about every value is decided by evaluating it with the value unknown"; "What is known about a value travels with the value" | No |
| A trial evaluation whose outcome, a refutation included, is data: the loop judging a proposal, the guarantee check naming an element | none yet (the planning specification's §4) | "A refutation cannot be tested for, and search, proposal loops, parse recovery and budgeted evaluation all must" |
| An undetermined detail as a cell, filled once | "A missing value is a cell that is filled once" | No |
| Walks over a model's graphs decided to terminate by a decrease of the set not yet visited | "Termination by bounded decrease" | "A circular definition is decided"; "The same information never recurs in an ordinary loop" |
| A domain type imported by two modules is one value, so content types compare by identity | "Symbol identity is a fully-qualified name"; "Imported modules are typed objects whose type encapsulates" | "A module is evaluated once, and is a function of the capabilities whoever loads it supplies" |
| Reading code and the decision map through a capability, and the strength of a claim decided with its help | "The loader reaches files through a capability"; "The kernel trusts only what it has evaluated" | "Two rules give one mechanism two strengths" |
| A proposed value holds no capability | the review's candidate ruling | "A proposal that is accepted runs later with the capabilities of the place it filled" |
| Of the kernel stream: the kernel's interface file and the saved-program data form, which the example models as the Kernel's interface and interaction 4 of activity 1 | "What the kernel's interface offers"; "A saved program is a recorded sequence of interface calls" | No |

## 12. Decisions this specification gives cases to

For the acceptance stream. "Cases today" is the first count of
`npx tsx next/tools/corpus.ts --by-decision`, the cases that must
survive.

| Decision | Cases today | What would test it |
|---|---|---|
| "A model is a value" | 33 | Use case 1: the example of §10 built, inspected and compared as a value |
| "Two models relate only through a declared mapping" | 0 | The delivers mapping naming an element no plan delivers; content typed by a type the domain model lacks, refuted |
| "A transformation is a model" | 0 | A parameter mapping written declaratively, inspected like a model |
| "A change to a model is a mapping from the old one" | 2 | A refined interaction in a new version with its goal still guaranteed; a version with a new exception to the rule, refuted |
| "Solving is proposing a value for an unknown, and the kernel checks it" | 32 | A determination for an open detail kept, a second refused with the explanation |
| "A model's quality is a question for analysis" | 0 | The mixed files measured as a property of the realises mapping, reported, never claimed |
| "A mapping between models is itself a checked value" | 0 | The realises mapping refuting an import edge read from code |
| "A paradigm is a library" | 0 | A text that asks for the system model and the planning notation together, read the same in either order |
| "Startup, step by step" | 0 | The agreement claim of §10 on the Launcher; a version that binds the capability after evaluating, found not to agree |
| "The launcher does only what cannot be done in Allegro" | 0 | The Launcher's decomposition: every subcomponent host code, everything else an extension |
| "Open obligations are listed for any proposer" | 57 | A model's open details listed as obligations |
| "A proposer answers with only the missing value" | 32 | Activity 3 of §10, run against a model's cell |

## 13. The questions, as ruled

Ruled 2026-11-14 in the design session. The maintainer ruled questions
7, 12 and 13 in words, given in their rows, and of the rest said:
"Everything else looks good." So the recommended option of every other
question is taken. The options and costs stay as the record of what
was weighed.

| # | Question | What is open | Options | Costs | Recommended |
|---|---|---|---|---|---|
| 1 | **Libraries** | How the model's code is divided | (a) One library for the meta-model; each domain model its own; each mapping to another model its own. (b) One library for the meta-model and its mappings | (a) costs more files and `use` lines; (b) leaves nothing that separates a mapping from a model's code | **(a), under "Each decision lives in one replaceable unit of code"** |
| 2 | **A domain model that extends or specialises the system model** | The design session says it can, not how | (a) A library that builds on the system model's library: its new element kinds conform to the system model's, and its types reach content as one model's values typed by another's. (b) A declared mapping, "one model as a more detailed version of another", for each specialisation | (b) puts a mapping between a model and each of its extensions | **(a); depends on 1** |
| 3 | **The foundational claims as a whole, and the form of agreement** | Reachability is ruled; the design session names goals guaranteed, agreement and invariants, makes choreography checkable, and leaves the scope open | (a) The list of §6: well-formedness, agreement, reachability, choice visibility, invariants on stateful components; agreement in the three-conjunct projection form of §6; a change of state stated as a function of the old state and the content; a participant annotated *many* reached only by reference; interfaces on an external system optional. (b) The list with another form of agreement, such as equality of the projection with the external interactions | (b) refuses a component that orders internally what the outside leaves concurrent | **(a)** |
| 4 | **Loops** | Whether a loop's termination is claimed | (a) Unclaimed and flagged unless the modeller claims it; the repeat-or-exit step is a choice made by a named participant. (b) Every loop claimed to terminate | (b) refutes a service loop that runs for ever by design | **(a)** |
| 5 | **The initiating participant** | The design session gives it the goal and does not say what initiating means | (a) A field of the activity, and every step with no dependency is initiated by it; an activity two participants start independently is two activities. (b) A field only, unchecked | (a) refuses some activities as written; (b) checks nothing | **(a)** |
| 6 | **Unmodelled failures in the model** | The element that detects one initiates an activity to notify or remediate | (a) An element may name one activity it initiates on any failure it detects that no activity it takes part in models. (b) Nothing in the model | (b) leaves the rule with no element to check | **(a)** |
| 7 | **An activity and a plan** | The two models are close at five points: a plan's node and a subcomponent with a single call interface; a plan's derived wiring and interactions ordered by shared content; a catalog and a set of available component types; an open plan and a component with an undetermined subcomponent; a budget over estimates and a quantitative attribute combined along an activity | (a) Two peer models related by declared mappings, "an activity read as a plan" among them. (b) Planning restated as a domain model that specialises the system model. (c) One shared graph library beneath both | (a) needs the mapping kept checked; (b) changes the planning specification and ties planning to this model; (c) adds a third library | **Ruled otherwise: the two stay uncoupled.** The maintainer: "they are really modeled from different perspectives. I'd rather keep them uncoupled. I do think sharing a generic graph utility library would be useful for the similar operations, but it shouldn't imply any identity between the two. I would only create a declared mapping if a case arises where it's needed." So no mapping reads an activity as a plan; a generic graph library may serve both and states no relation between them; the delivers mapping of §8 is the one case that has arisen, ruled earlier for the second model |
| 8 | **An element no plan delivers** | The ruling on the second model types a plan's outcome by a system model's artifact | (a) The artifact is an element realised: a component, an interface or a datum. The delivers mapping ends in a remainder, filled by one mapping entry, kept when its own claim is true even if the mapping's claim then waits on the plan's catalog; the same rule keeps a refinement or decomposition that brings cells of its own. (b) A proposal kept only when the claim comes out true, as the planning specification's §4 has it | (a) costs a second acceptance rule; (b) stops the loop when the answer is itself a step that waits | **(a); depends on 7** |
| 9 | **A rule the code does not yet meet** | Two edges are known forbidden | (a) The rule carries its known exceptions, a weaker rule stated as such, and the changes mapping claims they only shrink. (b) The whole rule claimed and refuted. (c) Not claimed, a report | (b) halts the project's check while an edge is held; (c) loses the claim over every other edge | **(a)** |
| 10 | **How code is read** | Imports and the decision map are outside the model | (a) A capability that reads a file's imports, supplied by the configuration as the TypeScript binder is today; claims over its answer are decided and name it; the decision map is read the same way. (b) A parser for the code's language written in Allegro. (c) A list a host script writes, claims over it assumed | (b) is out of reach for TypeScript; (c) puts an unchecked step before the claim | **(a) for host code, (b) for Allegro code** |
| 11 | **The scope ruled for the second model** | The ruling said "components and data first, UI later"; the design session lists a user interacting with a UI as an interaction kind | (a) A UI interaction is in the model as a kind, and a model of screens stays later. (b) UI interactions later too | (b) leaves users with no interaction kind | **(a)** |

| 12 | **A guarantee the check finds false** | The design session says a goal that is not guaranteed is flagged and the model is still valid; it did not say what happens when a guarantee is stated and the check finds a counterexample | (a) It halts, as a refuted claim of the platform does. (b) It is a flag too, and the model stays valid | (a) treats a statement of the model as a claim of the platform | **Ruled (b).** The maintainer: "It should be a flag. I said "claim", but perhaps I should have said "predicate". It is certainly not a claim in the Allegro sense." §6 states it |
| 13 | **An interaction's direction** | The design session says one-to-one | (a) Directed: an initiator and a responder, and a whole call has a sent part and a returned part. (b) Undirected, with direction a detail that may be undetermined | (b) leaves reachability and choice visibility nothing to follow | **Ruled (a).** The maintainer: "interactions are always directed" |

## 14. Evidence and limits

**Read.** The design session's description and the ruling of 2026-11-14;
`docs/book/actors-and-activities.md` whole;
`docs/book/architecture-vocabulary.md` §2.5 and §3;
`docs/book/units.md` §6; `next/models/specs/planning.md`; the first
draft of this file; the inventory's contents, Part V's ruled decisions
and each decision cited; the adversarial review; `docs/plans/rebuild.md`
§1, §4 and §5; the scenarios' README on the acceptance stream's
scenarios branch; `next/kernel/interface.ts` on the kernel stream's
contracts branch; `docs/plans/planning-loop.md` §6.

**Ran.** `npx tsx scripts/analyze/index.ts units`: two forbidden edges,
five mixed files, 456 kind comparisons outside allowed units.
`npx tsx next/tools/corpus.ts --by-decision` for §12.

**Not checked.** Nothing ran on a rebuilt kernel. No model value was
built: §10 and its agreement claim are worked by hand. The first
draft's probe was not run again; §8 cites it. The kernel's interface
is a branch's proposal, not merged.

**What rests on what.** The elements, granularity, results, the rules
of order, concurrency and choice, decomposition, goals and the three
named foundational claims rest on the design session. Eight additions
and the thirteen questions rest on the maintainer's rulings of
2026-11-14. The formal statements of the checks rest on the ruled
decisions and this document's reading. The example
rests on Parts V and VI of the inventory, and its Launcher
decomposition is this document's choice.
