# The software system model: a model specification

> **Status: draft, 2026-11-13.** For the maintainer's ruling. Nothing of
> this model is built. Its evidence is the measurements of
> `docs/plans/planning-loop.md` §2b, one library-only probe made for
> this document (§12), the project's own structure, and the ruled
> decisions.
>
> **Reader.** The maintainer and the review session. The reader knows the
> ruled decisions of the inventory, Parts I to VI; the program plan
> `docs/plans/rebuild.md`; the term
> [model specification](../../../docs/plans/rebuild-acceptance.md#def-model-specification);
> and the planning specification `next/models/specs/planning.md` with
> its thirteen rulings, which this document builds on and does not
> restate. Two things are ruled and not reopened here: the scope of the
> ruling on the second model (`docs/plans/planning-loop.md` §6:
> components and data first, UI later, the first composition point a
> plan's outcome typed by a system model's artifact, the artifacts no
> plan produces each an obligation for the same loop), and the planning
> specification's rulings.
>
> **Terms.** Component, port, interface, dependency, entity, field,
> relation and constraint keep their ordinary software meanings, made
> exact by the tables of §3. The planning terms keep the planning
> specification's meanings. Two terms are new. An **artifact** is a type
> value that a system model declares, whose values are things the
> system's parts hand to each other or deliver (§3, question 1). A
> **remainder** is a cell at the end of a list inside a model value,
> filled by one entry and a new remainder; the planning specification's
> catalog remainder is one (§6).
>
> **Rulings** are numbered in §11. Where a section depends on one, it
> says so and continues under the recommended option. §9 lists the open
> issues of the adversarial review (`docs/records/book-pass/adversarial-review.md`)
> that the model rests on.

## 1. What the model is for

Five use cases. Every later section names the ones it serves.

| # | Who | What they have | What they want from the platform |
|---|---|---|---|
| 1 | The project itself: the maintainer and the two sessions of the rebuild | 35 units, each with the units it may depend on, and 34 source files assigned to them, 5 of them mixed (`scripts/analyze/units.json`); 231 decisions, each with a column for the unit that realises it (`next/decisions.json`); two host scripts that check them (`scripts/analyze/index.ts units`, `next/tools/decision-map.ts`) | The units, their permitted dependencies and the decisions each holds stated as model values. The dependency rule decided over the import edges of the code, each forbidden edge named (today: `evaluator` to `effects` and to `refinements`). Each decision with exactly one unit once it has one. The platform does this in place of the host scripts; reading the code is an effect |
| 2 | A team describing a service (`docs/plans/planning-loop.md` §2b.2's probe) | Components with what each provides and requires (`Shop` provides `Order`; `Billing` requires `Order` and provides `Invoice`), and the records those artifacts carry | Every required artifact provided once, a missing provider named ("`Order`, which `Billing` requires, is provided by no component"). Every data type a component uses resolved to an entity of the data model. The data model well-formed. A finding that spans the two models names both |
| 3 | The project delivering its own system (`docs/plans/rebuild.md` §5: milestones whose chunks deliver units under `next/`; the planning specification's use case 5) | A system model as in use case 1, and plans whose outcomes are realised components | The components no plan delivers listed as obligations. Proposals checked as for an open plan, and a record of who proposed each |
| 4 | An operations designer with a business process (§2b.4's probe: the plan `Fulfil` delivering `Invoice` to the system `Shop`) | A plan, and a system that takes artifacts from outside | The artifacts the system takes in that no plan produces listed, and answered by the planning specification's loop |
| 5 | A maintainer evolving the model (`scripts/analyze/units-baseline.json`; the project's rule that a ratchet baseline may only fall) | A rule the code does not yet meet, with its known exceptions, and a new version of the model | The new version related to the old, with the claim that the known exceptions only shrink |

Use cases 3 and 4 differ in what an artifact is; question 1 asks
which the model supports.

## 2. The two languages and why two

Serves use cases 1 to 5.

**The components language** states what parts a system has and how
they may depend on each other. A component provides and requires
artifacts and interfaces through ports. A dependency is an edge from
one component to another. A dependency rule says which edges are
permitted. Use case 1's units are this language alone: units, their
permitted dependencies, and edges read from code.

**The data language** states what information a system holds. An
entity is a record type with named, typed fields. A field typed by
another entity is a relation. A constraint is a predicate over an
entity's values. Use case 2's records are this language.

**Why two models.** Under "A paradigm is a library", each
language is an extension: a meta-model and its library. Under "Two
models relate only through a declared mapping", what relates a
component to an entity (it reads it, owns it, carries it on a port) is
a mapping value, declared and checked, and neither meta-model names
the other. Each is useful alone: use case 1 has no data, and a data
model without components is a schema. §2b.2 of
`docs/plans/planning-loop.md` measured what one shared namespace costs
two libraries: a second library's `Finding` was built by the first
library's check. Question 2 asks whether each language and each
mapping is its own library.

**Left out for now.**

| Left out | What it would state | What would bring it in |
|---|---|---|
| UI | Screens and what each shows of the data | The ruling on the second model defers it. A use case with screens, and a mapping from the UI model to the data model |
| Behaviour | What a component does over time: its operations' effects, protocols, order of calls | Running a model, which the planning specification's question 8 left out for plans; a use case in which a component's behaviour is checked |
| Deployment | Where components run and what each target supplies | "A target platform is a model, and export is a transformation into it": deployment would be a mapping from the components model to a target platform's model, when a use case exports a system |

## 3. The values

Serves use cases 1 to 5. Under "A model is a value", a system model is
a value built from its meta-model, and ordinary functions construct,
inspect, transform and compare it. A model value's names are fields of
the value, as the planning specification's question 13 ruled. The mark
is one of: a ruled decision, named; a section of the planning
specification; *open*, with its question. The constructors' names
are placeholders for the rebuild to choose.

**Components.**

| Value | What it holds | Constructs it | Mark |
|---|---|---|---|
| System | A name, its components, the artifacts it declares, the artifacts it takes from outside (its inputs), and its dependency rule | `system(name, components, rule)` | "A model is a value"; the name a field, planning §11 question 13 |
| Component | A name, its ports, its declared dependencies if any, and its realisation artifact | `component(name, ports)` | "A model is a value". The realisation artifact is *open*, question 1 |
| Port | Provides or requires, and a type value: an artifact or an interface | `provides(T)`, `requires(T)` | Planning §11 question 1: a port's type is a type value, compared by identity, possibly another model's |
| Artifact | A named type value the system declares | `artifact(name)`, or a type of another model through a mapping (§5) | "Types are values that constrain values"; "One meta-type with an optional name". Which artifacts exist is *open*, question 1 |
| Interface | A type that declares member symbols and is never instantiated | the type extension's construction | "An interface is a type drawn from, not instantiated"; satisfied by conformance under "Members are keyed by symbol and conformance is membership" |
| Dependency | An edge from one component to another, and where it came from: derived from a required port and its provider, declared by the author, or read from code through the realisation mapping | derived by the library; `depends(a, b)`; the code reader (§5) | Derived edges follow the planning specification's wiring, §3. Declared edges follow "Each decision lives in one replaceable unit of code" ("a unit depends only on units it names"). Read edges depend on question 7 |
| Dependency rule | A predicate over pairs of components. The shipped form: for each component, the components it may depend on, closed transitively, or every component | `permits(component, [names])`, `permits_any(component)` | "Claims are evaluated like everything else": the rule is an expression. The two forms are those of `scripts/analyze/units.json`. Exceptions are *open*, question 8 |
| Finding | Which claim failed, the values it names, and the predicate's explanation | the checks | Planning §2, the row "Finding": the explanation refers to model values and is rendered by the library that owns each |

A component carries no layer. Under "Each decision lives in one
replaceable unit of code", a layer is to be done away with; a grouping
of components that a reader wants is a view, one of the candidate
mapping kinds.

**What an artifact is.** An artifact is a type value. The system model
declares it, gives it a name, and uses it as a port's type. The plan
mapping types a plan's outcome by it (planning §11 question 1). Two
kinds appear in the use cases. An *interface artifact* is a thing one
component hands another, such as `Order` (use cases 2 and 4). A
*realisation artifact* is a component realised, such as the unit
`symbol` written (use case 3); its values are what the realisation
mapping of §5 points to. Question 1 asks whether the model has one kind
or both; the recommendation is both.

**Data.**

| Value | What it holds | Constructs it | Mark |
|---|---|---|---|
| Data model | A name and its entities | `data_model(name, entities)` | "A model is a value" |
| Entity | A named record type: its fields and its invariant | `entity(name, fields)` | "Types are values that constrain values"; "One meta-type with an optional name" |
| Field | A name and a type value: a core type of the standard language or an entity | `field(name, T)` | Planning §11 question 1, applied to fields |
| Relation | A field whose type is another entity of the model | a field typed by an entity | "Types are values that constrain values". Cardinality is left out: no use case asks for it |
| Constraint | A predicate over an entity's values, its refusal explained in the model's words | `entity_where(name, fields, holds)` | "Invariants are refinements"; "Constructing a refined value claims its predicate"; "A predicate can explain its refusal" |
| Key | The fields that identify a value among a collection of the entity's values | none yet | *Open*, question 9 |

## 4. The claims

Serves use cases 1 to 5. Under "Nothing is a claim until someone makes
it", each row is a claim only when its author makes it. Declaring a
system with a dependency rule claims the rule over its graph; declaring
a mapping claims the mapping's own claims (§5). A model built through
the library and bound with no claim gets a report. Strengths are the
four of "Four strengths, one vocabulary".

| Claim | Who makes it | What deciding it takes | Possible outcomes | Strength |
|---|---|---|---|---|
| Every dependency is permitted by the rule | The system's author | Evaluating the rule over each edge of a finite graph. For edges read from code, the reading is an effect (§5) | True; refuted, naming each forbidden edge. The worked case: 43 unit-to-unit edges of the present tree, 2 refuted, `evaluator` to `effects` and to `refinements` (§12) | Decided over declared and derived edges. Over read edges, decided and naming the capability that read them, under "The kernel trusts only what it has evaluated" |
| The dependencies are acyclic | The system's author | Evaluating over the graph of actual dependencies | True; refuted, naming the components on a cycle | Decided, as above |
| Every required port has exactly one provider in its scope | The system's author | Evaluating the wiring, as the planning specification's §3 does for inputs | True; refuted, naming the port and its component, or the providers of an ambiguous one | Decided |
| A provided type satisfies the interface it is wired to | The system's author | Conformance by member symbols, under "Members are keyed by symbol and conformance is membership" | True; refuted, naming the member symbols missing | Decided |
| The data model is well-formed: field names distinct, every field typed by a type value, every relation naming an entity of the model | The data model's author | Evaluating over the model | True; refuted, naming the field | Decided |
| A value satisfies its entity's constraint | Whoever constructs the value, under "Constructing a refined value claims its predicate" | Evaluating the predicate at construction | True; refuted, with the predicate's explanation | Decided |
| Every use of a data type by a component resolves to an entity of the related data model | The author of the components-to-data mapping | Evaluating each pair of the mapping (§5) | True; refuted, naming the component, the type and both models | Decided |
| Every entity has one owner, and only its owner writes it | The same author, when the author claims it | As above | True; refuted, naming the entity and its writers; a report when unclaimed | Decided when claimed |
| Every decision with a unit has exactly one | The author of the decisions-to-units mapping | Evaluating the mapping. That the unit's path exists is an effect | True; refuted, naming the decision | Decided; the path's existence decided and naming the capability |
| Every file has a component | The author of the realisation mapping | Listing the files: an effect | True; refuted, naming the file | Decided and naming the capability |
| Every artifact in the mapping's scope is produced by a mapped plan | The author of the plan mapping | The plans' claims under the mapping's reading (§5, §6) | True; undecided while a remainder waits | Undecided, then decided |
| The new version's exceptions are among the old version's | The author of a change (use case 5) | Evaluating over the two versions | True; refuted, naming the new exception | Decided |
| The library's walks over a graph terminate | The library's author | A decrease that "Termination by bounded decrease" does not recognise (below) | Assumed and named until recognised | Assumed today |

**Recursion over a graph that may have cycles.** A component graph can
have a cycle; the claim of acyclicity exists because the author may be
wrong. A check that follows edges by plain recursion, "`b` is
permitted from `a` when `a` lists `b` or a unit `a` lists permits
`b`", cannot end on a cyclic rule: it reaches the same pair again.
That version was not run. The probe of §12 ends because
its walk carries the set of components already visited, on the 35
units of `scripts/analyze/units.json` and on a copy with a cycle
added. The walk's measure is the number of components not yet
visited, which falls at every call. "Termination by bounded decrease"
recognises only an argument of the form `param - K` with a
non-negative bound, so the claim that the walk terminates is assumed
and named, as the planning walks' is (planning §3). The adversarial
review's issue 5 says why that matters: under "A recursive call is
evaluated once for each state of knowledge", a claim at a recursive
call is assumed at the inner call and decided on the body, so a
reachability check written without the visited set could record a
cycle's answer as decided. The model therefore needs its walks
decided by a decrease over a finite set (§9). The review's issue 6
applies too: the visited set grows at each call, so no state of
knowledge recurs and only the decrease ends the walk. §2b.3 of
`docs/plans/planning-loop.md` measured the present tree's limits on
such walks (a recursive binding beside a caller of the planning check
stalls the load; a self-applied walk exhausts the host stack at depth
3). They are cases for the rebuilt kernel's recursion design.

**A finding about the worked case.** With `units.json`'s "any" read as
every unit, the permission relation has a cycle: `pipeline` may depend
on every unit, and `introspect` and `cli` depend on `pipeline`. The
host script checks only edges and never the relation (`reachable` in
`scripts/analyze/index.ts`). The 43 actual unit-to-unit edges have no
cycle. The model keeps the two claims apart: the rule is a predicate,
and acyclicity is claimed of actual dependencies.

## 5. The mappings

Serves use cases 1 to 5. Under "Two models relate only through a
declared mapping", "A mapping between models is itself a checked
value" and "A transformation is a model", every relation this model
takes part in is one of the values below. The kinds are the
inventory's candidates: one model's values typed by another's; a claim
that spans two models; a translation with claims about what it
preserves; one model as a more detailed version of another; a view of
part of a model. A mapping's reading, where it has one, is defined by
its library (question 3).

| Mapping | Models | Kind | What it maps | What is claimed, and who checks | Total? |
|---|---|---|---|---|---|
| Carries | Components to data | One model's values typed by another's | Each interface artifact whose values are data, to an entity | The artifact is the components model's; the entity is the data model's; the port's type is the entity's type value by identity. The mapping's author claims it; evaluation decides it | Partial: a realisation artifact or an interface of operations carries no entity |
| Uses | Components to data | A claim that spans two models | Pairs of a component and an entity, each with a mode: owns, reads or writes | Every pair names a component and an entity of the two models; when claimed, one owner per entity and writes by the owner only. Decided by evaluation | Partial on components; total on entities when ownership is claimed |
| Delivers | Plans to a system model | One model's values typed by another's, and a claim that spans two models | Plan outcomes to artifacts; a scope of artifacts the plans must produce. Its reading: each mapped plan as an open plan with its mapped artifacts among its declared outcomes (§2b.4) | Each artifact is the system's; each outcome's type is that artifact by identity; every artifact in scope is produced. The mapping's author claims it; decided, or undecided while a remainder waits (§6) | Partial by design: an artifact in scope that no plan produces is an obligation |
| Realises | System model to code | One model as a more detailed version of another | Components to files, a mixed file to several components (`units.json`'s `files`) | Without reading files: every component named is the model's, every file appears once. With reading, an effect: every file has a component, and every import edge between files, mapped to components, is permitted by the rule. Decided, naming the capability that read the files | Claimed total on files; partial on components (a unit not yet written) |
| Holds | Decisions to a system model | A claim that spans two models | Each decision to the component that realises it (`next/decisions.json`'s `unit`) | Each decision with a unit has exactly one, under "Each decision lives in one replaceable unit of code". Decided; the unit's path existing is an effect. Depends on question 6 | Partial while a decision's state is none, as the decision map's own check allows |
| Changes | A system model to its next version | "A change to a model is a mapping from the old one" | Each component, rule and exception of the old to the new | The exceptions of the new are among the old's (use case 5). Decided | Total |

**What the platform can and cannot check about code without reading
files.** Without reading files it checks the realisation mapping
against the model: the components it names exist, no file is listed
twice, the rule is well-formed. Everything about the code itself needs
a reader with a capability: which files exist, what each imports, and
the unit document's discriminator rule (`docs/book/units.md` §3.2),
which counts comparisons inside the code. Under "The loader reaches
files through a capability" reading a file is an effect, and under "An
effect is the use of a capability" an operation the platform cannot
analyse, such as resolving TypeScript imports, is a capability a
configuration supplies. Question 7 asks how the edges are read. This
model does not state the discriminator rule: it is a claim about what
the code inside a component does.

**Lanes are out of scope.** `scripts/analyze/lanes.json` maps streams
of work to paths. As a model it would compose two mappings above:
plans to components, and components to files. No use case here needs
it.

**The plan mapping, worked.** Three units of `units.json`, use case 3,
under question 1's recommended option.

| Component | May depend on | Realisation artifact |
|---|---|---|
| `value` | nothing | `value` realised |
| `bits` | `value` | `bits` realised |
| `symbol` | `value` | `symbol` realised |

A plan, "Kernel values", has two outcomes: one typed by `value`
realised, one by `bits` realised. Its nodes produce both from its
catalog. A mapping "Kernel delivery" relates the system to the list of
plans [Kernel values], with all three realisation artifacts in scope,
and ends in a remainder (question 4).

1. The mapping's claim is evaluated. `value` realised and `bits`
   realised are outcomes of a mapped plan whose claim is true. `symbol`
   realised is an outcome of no plan.
2. The claim stays undecided. Its explanation, in the mapping's words:
   "`symbol` realised, which Kernel delivery requires, is produced by
   no plan". The obligation is the claim, waiting for the mapping's
   remainder.
3. A proposer answers with one mapping entry: `symbol` realised by
   Kernel values. The trial evaluation reads Kernel values with the new
   outcome: an open plan whose catalog produces nothing typed `symbol`
   realised. The mapping's claim is still undecided, now waiting for
   that plan's catalog remainder, with planning's explanation: "nothing
   in the catalog produces `symbol` realised, which the plan declares".
   The entry is kept, and the next obligation is planning's own kind.
   Planning §4 keeps a candidate only when the claim comes out true;
   a mapping entry kept while the mapping's claim still waits is a
   different rule (depends on question 4).
4. A proposer answers that obligation with one catalog entry, a node
   "Write symbol" with outcome `symbol` realised and input `value`
   realised. The plan's claim comes out true, and so does the
   mapping's: decided.

An entry that names a plan the mapping does not hold, or an artifact
the system does not declare, is refuted on its own claim and fills
nothing. Use case 4 runs the same steps with an interface artifact,
`Invoice`, and the plan `Fulfil`, as §2b.4 did.

## 6. Unknowns, obligations and proposals

Serves use cases 2, 3 and 4. Under "Solving is proposing a value for
an unknown, and the kernel checks it", a model with parts not yet
supplied is a claim waiting for values. The loop of the planning
specification's §4 serves every unknown below: the
obligation is listed under "Open obligations are listed for any
proposer"; a proposal is one entry, under "A proposer answers with
only the missing value"; a trial evaluation judges it; a refusal is
the claim's explanation with that candidate; an accepted entry fills
the cell once, under "A missing value is a cell that is filled once".
The one difference is when a mapping entry is kept (question 4).

| What is left open | Its unknown | The claim waiting | A proposal |
|---|---|---|---|
| A component that a mapped plan should deliver, where the plan cannot | The plan's catalog remainder, under the mapping's reading | The mapped plan's feasibility (planning §11 question 3), and through it the mapping's claim | One catalog entry |
| An artifact in the mapping's scope that no plan is assigned | The mapping's remainder | The mapping's claim that every artifact in scope is produced | One mapping entry: an artifact and a plan the mapping holds. Depends on question 4 |
| A required port with no provider | None under question 5's recommendation: a finding of the wiring claim | The system's wiring claim, refuted | None until a use case asks for one |

**One kind or two.** §2b.4 of `docs/plans/planning-loop.md` measured
the first row: a mapping read as an open plan gave a plan obligation
that the loop answered with no change to its host code. That
obligation is the planning model's catalog remainder under another
reading. The second row is a second kind of unknown, and §2b.4 says
so: "an artifact that no mapping assigns to any plan is not a gap in a
plan, and a catalog entry cannot answer it: the answer is a mapping
entry". Under the recommendation of question 4 it has the catalog
remainder's form, a remainder at the end of the mapping's entries, so
the loop serves it with one more entry form and the acceptance rule
of question 4. The ruling on the second model asks that each artifact no plan
produces be an obligation for the same loop; both rows meet it.

**Declaring an open mapping.** As the planning specification's
question 3 ruled for an open plan, declaring a mapping that ends in a
remainder claims that a complete assignment exists: an entry for every
artifact in scope, each produced by its plan. The claim is undecided
while a remainder is a cell.

**What a proposal must leave unchanged.** The system model, the plans
and the mapping's existing entries. Each proposal fills one cell, so
nothing else can change, as planning §4 states for plans.

## 7. The notation

Serves use cases 1, 2 and 4. Both languages are library-first, as the
ruling on the second model says and as the planning model was: values
are built by the functions of §3, and a notation comes when a use case
reads better with one. The table lists the forms the use cases would
need then; only the last is needed from the start. Under "Every notation stands for an
expression", each form maps what it matched to an expression and does
nothing else; the names the user writes, such as a port's type, are
the user's bindings, and the library's builders are the library's.

| Form | The expression it stands for | Needed by |
|---|---|---|
| `component NAME:` and a block of `provides:`, `requires:` and `depends on:` | A binding of `NAME` to `component(NAME, ports)`, each port's type the user's binding of that name | Use case 2; §2b.2's probe wrote this form |
| `system NAME:` and a block naming its components, inputs and rule | A binding of `NAME` to `system(...)`, with the claims of §4 | Use cases 1 and 2 |
| `entity NAME:` and a block of `field: Type` lines, with an optional `where` predicate | A binding of `NAME` to `entity(...)` or `entity_where(...)` | Use case 2 |
| An entry of a mapping: `ARTIFACT by PLAN` | One mapping entry | The loop: a proposal written as text is read by the entry's form, as planning §4 states for catalog entries, so the mapping's entry needs a form even while mappings are built by functions |

A port's type written in the text is an expression that names a type
value. §2b.1 measured why that matters: a port that held a type's name
as text checked clean when the name was misspelt, and a port that held
the type value halted every rendering. Under this form the misspelt
name is an undeclared name, and the rendering reads the type's name
field (planning §11 question 13).

**A text that holds a plan and a system model.** §2b.2 measured three
collisions when four notations shared one file. Under the ruled
decisions:

- **Rule names in one namespace.** A second library's rule of the same
  name replaced planning's without a word, and a plan parsed in one
  order of the `use` lines and failed in the other. Under "Grammars
  combine without regard to order" that is a conflict refuted before
  any text is read in the combined grammar, and a replacement names
  what it replaces. Under "Grammars are values" and "Symbol identity
  is a fully-qualified name", each library's productions are its own
  grammar value's, so the components grammar has no reason to name a
  planning rule.
- **Top-level names in one scope.** A second library's `Finding` was
  built by planning's check. "Every notation stands for an expression"
  and "Imported modules are typed objects whose type encapsulates"
  remove the mechanism: a library's free names mean what they meant
  where it was written.
- **Keywords.** A binding named `component` beside the `component`
  form ran. Under "A grammar change reaches to the end of its block", a
  text can confine the components notation to one block, and a plan
  block beside it is read in planning's notation.

## 8. The result and the tools

Serves use cases 1 to 5. The planning specification's §9 holds for
each plan. For a composed model, under "A tool reads a phase's result
and adds no analysis of its own" and "A result names everything it
rests on", a phase's result adds:

- each system model, data model and mapping value, with each claim
  made about it and its strength;
- for a refuted claim that spans two models, one explanation that
  refers to values of both: the artifact and the plan, the component
  and the entity, each rendered by the library that owns it;
- for a mapped plan, that its reading rests on the mapping, rendered
  by the mapping's library, beside the plan's promises, rendered by
  planning's (§2b.5: today the ledger names the plan only, and the
  mapping and the system have no record);
- for a mapping's reading of a plan, its own name, a field the
  mapping sets. §2b.5 measured two records that both read "open plan
  Fulfil", the plan and its reading, because the reading kept the
  plan's name;
- the obligations of both kinds of §6, each with its form for
  programs and its form for people, the latter written by the library
  that owns the unknown;
- each entry that filled a remainder, who proposed it and in how many
  attempts, recorded with the filling under "Anyone may propose, and
  the record shows who";
- for a claim over code, the capability that read the files, and the
  files read.

No tool looks a model up by a type's name in the file's scope, as
`src/pcp.ts` does for plans today (planning §9).

## 9. What the model needs of the kernel and of the other stream

A need, the decision that owns it, and the adversarial review's
issues that leave it open. The kernel's designs are not this
document's.

| Need | Owning decision | Open in the review |
|---|---|---|
| A trial evaluation whose outcome, a refutation included, is data to the caller: the loop judging a mapping entry or a catalog entry | none yet (planning §4, "Two open kernel designs") | Issue 14 |
| A remainder: a cell at the end of a list whose shape is otherwise complete | "A missing value is a cell that is filled once" | No |
| A walk over a graph decided to terminate by a decrease of the set not yet visited | "Termination by bounded decrease" | Issues 5 and 6 |
| A type value imported by two modules is one value, so a plan module and a mapping module compare an artifact by identity | "Symbol identity is a fully-qualified name"; "Imported modules are typed objects whose type encapsulates" | Issue 13: a module evaluated once yet a function of the capabilities each loader supplies |
| A type value's name readable for findings | "One meta-type with an optional name" | No |
| Conformance by member symbols for interfaces | "Members are keyed by symbol and conformance is membership" | No |
| Reading files and resolving imports through a capability, and the strength of a claim decided with its help | "The loader reaches files through a capability"; "An effect is the use of a capability"; "The kernel trusts only what it has evaluated" | Issue 8: a capability's answer gives decided, an outside solver's assumed |
| Two notations in one text, refuted on conflict before the text is read | "Grammars combine without regard to order" | Issue 7: a notation can wrap the forms that make a user's claims |
| A proposed entry holds no capability | the review's own candidate ruling | Issue 24, as in planning §13 |

## 10. Decisions this specification gives cases to

For the acceptance stream. `npx tsx next/tools/corpus.ts --by-decision`
lists no case for the decisions marked 0.

| Decision | Cases today | What would test it |
|---|---|---|
| "A model is a value" | 33 | Use case 1: the units manifest built, inspected and compared as a value |
| "A transformation is a model" | 0 | The reading of the plan mapping (§5), inspected and compared like the models it relates (question 3) |
| "Two models relate only through a declared mapping" | 0 | The worked example of §5: one finding names the system and the plan; and use case 2's carries mapping refuting a port typed by an entity the data model lacks |
| "A change to a model is a mapping from the old one" | 2 | Use case 5: a version with a new exception refuted, a version with one fewer decided |
| "Solving is proposing a value for an unknown, and the kernel checks it" | 32 | Steps 3 and 4 of the worked example: a mapping entry, then a catalog entry |
| "A solver sees its problem unevaluated" | 0 | None beyond planning's. The cross-model claim is judged by trial evaluation; no case here reads a residual |
| "Feasible is decided; best says how strongly it holds" | 31 | None new: this model searches for no best |
| "A model's quality is a question for analysis" | 0 | Use case 1: the mixed files measured as a property of the model (a file mapped to several components), reported, never claimed; the granularity rule of `docs/book/units.md` §2 stays a question for analysis |
| "A mapping between models is itself a checked value" | 0 | The realisation mapping refuting an import edge read from code |
| "A paradigm is a library" | 0 | A file that asks for the components, data and planning notations together and is read the same in either order |
| "A target platform is a model, and export is a transformation into it" | 0 | None until deployment comes in (§2) |

The units of measure and the planning chapters are evidence for the
planning model and give this model no case.

## 11. Questions for the maintainer

Ordered so that a question comes after the ones it depends on.

1. **What an artifact is.** (a) Interface artifacts only: things one
   component hands another, as in §2b.2 and §2b.4. The cross-model
   claim covers the system's inputs. Use case 3 is lost. (b)
   Realisation artifacts only: one per component, a component realised.
   The cross-model claim covers every component in scope. Use case 4 is
   lost. (c) Both, as two kinds the model declares; a mapping's scope
   lists the artifacts of either kind that plans must produce. (c)
   costs one field per component and a kind on each artifact.
   **Recommended: (c).** Questions 4 and §5's worked example depend on
   it.
2. **Libraries.** (a) One library per language and one per mapping:
   components, data, the components-to-data mappings, the plan mapping.
   Neither model's library uses the other. (b) One system library
   holding both languages and their mappings, one `use` line. (c) One
   library per language, the mappings inside the components library.
   (b) leaves nothing that separates a mapping from a model's own code.
   (c) has the components library read data values, the coupling "Two
   models relate only through a declared mapping" rejects. (a) costs
   more files and `use` lines. **Recommended: (a)**, under "Each
   decision lives in one replaceable unit of code".
3. **How a mapping's reading is defined before a meta-model of mappings
   exists.** The kinds of mapping are a design to prove (the record of
   phase 1's close). (a) Each mapping kind's reading and claims are
   functions of its library now, named in the result as such, and
   restated as models when the mapping meta-model exists. (b) Build no
   mapping until that meta-model exists. (a) meets "A transformation is
   a model" only in part, as the planning specification's units mapping
   does. (b) leaves use cases 2 to 5 unbuilt. **Recommended: (a).**
4. **An artifact that no plan is assigned.** (a) The mapping ends in a
   remainder, filled by one mapping entry; declaring it claims a
   complete assignment exists. A mapping entry is kept when its own
   claim is true (its artifact is the system's, its plan the
   mapping's), even if the mapping's claim then waits on that plan's
   catalog remainder. (b) As (a), with planning §4's rule: an entry is
   kept only when the mapping's claim comes out true. (c) The reading
   assigns each unassigned artifact to a plan the author names as the
   default, so every obligation is a catalog remainder of one kind.
   (a) costs a second entry form for the loop (§7) and a second
   acceptance rule. (b) refuses every mapping entry whose plan cannot
   yet produce the artifact, and that plan has no obligation until the
   entry is kept, so the loop cannot proceed. (c) keeps one kind, but
   the default plan receives outcomes its author never chose, and the
   proposer cannot say which plan should produce an artifact.
   **Recommended: (a).** Depends on question 1.
5. **An open system.** (a) The system's component list may end in a
   remainder, so a missing provider is an obligation answered by a
   proposed component. (b) A missing provider is a refutation of the
   wiring claim, or a report when unclaimed, and no remainder exists
   until a use case asks for proposals of components. Use case 2's
   source asks for the finding only. **Recommended: (b)**; the form of
   (a) is the remainder's and can be added.
6. **Decisions as a model.** The holds mapping relates decisions to
   units. (a) A minimal decisions model: a decision is a value with its
   title and the decisions it depends on, read from the inventory by a
   reader with a capability. (b) Decisions as names in the mapping:
   the option "models coupled implicitly, through shared names or code
   that reads both", which the decision records as not chosen. (c) Wait
   for the documentation model, which the planning-loop plan asks
   about separately. **Recommended: (a)**, stating nothing a use case
   does not need.
7. **How import edges are read from code.** (a) A capability that
   reads a file's imports, supplied by the configuration as the
   TypeScript binder is today; claims over its answer are decided and
   name it. (b) A parser for the code's language written in Allegro, so
   that only reading the file is an effect. (c) The edges kept as a
   declared list that a host script writes; claims over them are
   assumed. (b) is out of reach for TypeScript and in reach for code
   written in Allegro. (c) puts an unchecked step between the code and
   the claim. **Recommended: (a)** for host code, and (b) where the
   code is Allegro, which the platform already parses.
8. **A rule the code does not yet meet.** The project holds two
   forbidden edges as known, and "Nothing is a claim until someone
   makes it" forbids softening a refutation. (a) The rule carries its
   exceptions: "every edge is permitted except these", a weaker rule
   stated as such, with the change mapping's claim that exceptions only
   shrink. (b) The whole rule is claimed and refuted, which halts. (c)
   The rule is not claimed; its findings are a report, and the ratchet
   is a claim over two reports. (b) stops the project's check while
   any edge is held. (c) loses the claim that every other edge is
   permitted. **Recommended: (a).**
9. **Keys.** (a) Left out until a use case holds a collection of an
   entity's values: a key's uniqueness is a claim over a collection, and
   none of the use cases has one. (b) In now, as a field list on the
   entity, with the uniqueness claim made over any collection the
   program builds. **Recommended: (a).**

## 12. Evidence and limits

**Read.** `docs/plans/rebuild.md` §1 and §2;
`docs/plans/rebuild-acceptance.md` §1, §5 and §7;
`next/models/specs/planning.md` whole; the inventory's contents, all of
Part V from "Models" to the units of measure, and the entries of other
parts named above; `docs/records/book-pass/dr5-part-5-vivace.md`,
`docs/records/book-pass/phase-1-close.md` and
`docs/records/book-pass/adversarial-review.md`;
`docs/plans/planning-loop.md` §2b, the staged row for the second model
in §5, and the ruling on it in §6; the closed amendment that planned
that row, from the repository's history, as evidence only;
`docs/book/vision.md` §4; the modelling languages roster in
`docs/backlog.md`; `docs/book/vivace/planning-dsl.md` §1;
`docs/book/units.md` §1 to §3.2 and §8; `docs/book/architecture-vocabulary.md`
§1 and §2; `scripts/analyze/units.json`, `units-baseline.json`,
`lanes.json` and the `reachable` function of `scripts/analyze/index.ts`;
`next/decisions.json`.

**Ran.** `npx tsx scripts/analyze/index.ts units --json`: 166 import
edges, 60 permitted, 2 forbidden, 104 with a mixed end; 456 kind
comparisons. One library-only probe on the present tree, kept in the
scratchpad: the 35 units and their permitted dependencies as records,
the 43 distinct unit-to-unit edges of the report that have no mixed
end, a reachability walk with a visited set, and a check of every edge.
It printed the 2 forbidden edges the host script reports, in 5.9 s. Its
first version read "any" as a unit name and reported 4 more forbidden
edges from `introspect`, which is how the wildcard's meaning surfaced.
With "any" read as every unit, the walk found `introspect` and `cli`
on a cycle of the permission relation. A copy with a cycle added
through `value` ended in 6.6 s. The walk carries `assume terminates`,
as the planning walks do; it was not run without it.
`npx tsx next/tools/corpus.ts --by-decision` for §10's counts.

**Not checked.** Nothing ran on a rebuilt kernel. No mapping value was
built: §5's worked example is stated from §2b.4's probe and the
planning specification's loop; it was not run. The data language has no
probe. The cost of reading the project's imports through a capability
is not measured. The decisions model of question 6 was not built.

**What rests on what.** Use cases 1 and 5, the dependency rule's two
forms, the finding about the wildcard and the realisation and holds
mappings rest on the project's own structure. Use cases 2 and 4, the
notation's collisions and the first row of §6 rest on §2b's
measurements. The claims' strengths, the second kind of unknown, the
result of §8 and every recommendation rest on the ruled decisions and
the planning specification's rulings alone.
