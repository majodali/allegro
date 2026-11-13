# The planning model and the loop over it — a model specification

> **Status: draft**, written 2026-11-13 for the maintainer's ruling and
> for the review session, which rules the 15 held planning decisions of
> `docs/plans/book-pass-inventory.md` from it.
>
> **Reader.** The maintainer and the review session. The reader knows the
> ruled decisions of the inventory, Parts I to VI; the program plan
> `docs/plans/rebuild.md`; the term
> [model specification](../../../docs/plans/rebuild-acceptance.md#def-model-specification).
> The pilot as built is `lib/planning.alg`, `lib/planning_loop.alg` and
> the chapter `docs/book/vivace/planning-dsl.md`. They are read here as
> evidence of use. Nothing below keeps a design because the pilot has it.
>
> **Terms.** Plan, node, port, fixture, estimate, budget, handler,
> choice, template, resolution, gap, catalog, completion, open plan,
> plan obligation and promise keep the meanings the chapter and
> `docs/plans/planning-loop.md` §1 give them, restated in §2 where a
> ruled decision changes them. One term is new. A **catalog
> remainder** is the cell at the end of an open plan's catalog, which
> a proposal fills with one entry and a new remainder (§4, question 2).
>
> **Rulings needed** are numbered in §11. Where a section depends on
> one, it says so and continues under the recommended option.

## 1. What the model is for

Five use cases. Every later section names the ones it serves.

| # | Who | What they have | What they want from the platform |
|---|---|---|---|
| 1 | A release manager (rung 3 scene 1, `demos/rung3/01-model.alg`; the chapter's worked example) | A release process as outcomes: a borrowed build pipeline, nested steps, estimates, a budget, failures that steps can raise and recovery paths for them | To learn that the plan is well-formed before anyone acts on it: every input produced, every recovery able to produce what it rescues, the worst case within budget. A refusal in planning words, naming every fault |
| 2 | A planner choosing between ways of working (rung 3 scene 2, `demos/rung3/02-solve.alg`) | A plan with two or more steps that can each be done several ways, and a budget or deadline | A resolution that fits, the best one by a stated objective, and how strongly "best" holds. When none fits, the cheapest candidate and the measure it misses |
| 3 | An operations lead with a hole in a plan (rung 4 scene 1, `demos/rung4/01-loop.alg`; completion in rung 3 scene 2) | A plan that does not yet produce its outcome, and a catalog of steps it may draw on | The hole named in planning words. Proposals from a person, a script or a language model, each checked; the plan as written never changed; a record of which entry closed the hole and who proposed it |
| 4 | A team that shares a sub-plan (the worked example's `Build: uses BuildPipeline`; `tests/planning-split-demo.alg`) | A plan kept in its own module, borrowed by plans in other files | The borrowed plan arrives checked, with its handlers and estimates, and its claims count in the borrowing plan's result |
| 5 | The project itself (the maintainer's direction of 2026-11-06, `docs/plans/planning-loop.md` §1, "The horizon") | Backlog items and stream chunks, with oracles that say when each is done | The project's own plan as a model value, its open steps listed as obligations, proposals checked as for use case 3. Reading the project's files into model values is an effect, through a capability |

Use case 5 is the stated horizon. The specification serves it only by
keeping the model's values free of anything a reader of files could not
construct.

## 2. The values

Serves use cases 1 to 5. Under "A model is a value", a plan is a value
built from the planning meta-model, and ordinary functions construct,
inspect, transform and compare it. Every row below is a kind of value.
"Constructs it" names the notation of §6 and the library function the
pilot uses. The mark is one of: *pilot* (taken from the pilot as
built); *changed* (by the ruled decision named); *open* (depends on a
question of §11).

| Value | What it holds | Constructs it | Mark |
|---|---|---|---|
| Plan | A name, declared inputs and outcomes (ports), nodes, an optional budget, handlers | `plan NAME:`; `plan(name, inputs, outcomes, nodes)` | *pilot* for its fields. The name comes from the binding's origin under "Every value keeps its origin"; the pilot stores it as a string |
| Node: leaf | A name, ports, an estimate, instructions, an optional retry, declared failures | a node block with no nested node; `leaf` | *pilot* |
| Node: composite | As a leaf, plus inner nodes, handlers and an optional budget; its declared outcomes are what its inner graph produces | a node block holding node blocks; `composite` | *pilot* |
| Node: borrowed plan | A name and a plan value whose ports become the node's | `Name: uses Target`; `uses` | *pilot*. Across files the target is an imported binding, under "Imported modules are typed objects whose type encapsulates" |
| Port (input or outcome) | A type, and optionally a fixture | the entries of `inputs:` and `outcomes:`; `port`, `port_where` | *open*, question 1. The pilot holds the type as a `String`; a type value is recommended under "Types are values that constrain values" |
| Fixture | A predicate over the port's value. On an outcome it is a promise; on an input, a requirement | `[ name ]` after a port; `fixture(name, holds)` | *changed*. The pilot stores the name beside the predicate; the predicate value suffices, its name read from its origin under "Every value keeps its origin" |
| Estimate | Up to three measures: duration, effort, money; each may be absent | `estimate:`; `est(d, e, m)` | *changed* by "Constructing a refined value claims its predicate": each field is typed, and a wrong measure is a refutation. The pilot types the fields `Any` and guards them with error values |
| Budget | The same three measures, each an optional limit | `budget:`; `budget(d, e, m)` | *changed*, as the estimate |
| Measures | A duration is the units language's `Duration`; effort (person-hours) and money (an amount and a currency) are the planning model's own records with their own arithmetic | quantity literals (§6); `person_hours(n)`, `money(n, currency)` | *pilot* for effort and money (question 12). Duration *changed*: it crosses a mapping, §8, question 10 |
| Retry | A maximum number of attempts and an optional backoff | `retry: max N attempts[, X backoff]`; `retry`, `retry_backoff` | *pilot*. The backoff enters no claim; the chapter's richer `iterate:` form was never built |
| Failure type | The name of a failure a node can raise | `fails: Name, …` | *open*, question 1: a name today; a type value under the same reasoning as a port |
| Handler | A failure type, an optional retry, and an alternate graph that must produce its scope's declared outcomes | `on F:` inside a composite or a plan; `handler`, `handler_retry` | *pilot* |
| Choice | A node whose options are nodes with the choice's ports; a plan holding one is a template | `options:` inside a node block; `choice` | *changed* by "A solver sees its problem unevaluated": a choice is an unknown, one of a stated set of options (§5, question 6). The pilot stores the first option's ports on the choice |
| Resolution | One option picked at every choice | the solver; `resolve(p, decisions)` | *pilot* |
| Objective | The order in which candidates are compared | built in: the bound's effort, then its duration (`better`) | *open*, question 7 |
| Catalog and catalog entry | A list of nodes and plans a plan may draw on; an entry is a node, a plan in it is borrowed | `catalog NAME:`; a list expression | *pilot* for the list. Open at its end: question 2 |
| Open plan | A plan, its catalog, and the plan's claim waiting for the catalog's remainder | `plan NAME from CATALOG:`; `open_plan` | *changed* by "Solving is proposing a value for an unknown, and the kernel checks it". The pilot stores the obligations, a rendered surface, a state and an answer as strings computed at construction; under "A tool reads a phase's result and adds no analysis of its own" these belong to the result (§9) |
| Completion | The plan with catalog entries added, the steps that added them, or the gap where the search stopped | the completion search; `completions` | *pilot* as a search value; §4 says what of it is a workaround |
| Solution | A resolved, completed plan, its decisions, the entries added, its bound | the solver; `solve`, `solve_from` | *changed* by "Feasible is decided; best says how strongly it holds": it carries the strength of "feasible" and of "best" |
| Finding | Which check failed, where, and why | the checks; `Finding(check, scope, node, message)` | *changed*. The pilot's fields are strings. Under "A predicate can explain its refusal" the explanation is what the predicate answers; it refers to the plan's values and is rendered separately (§8, §2b.1 of `docs/plans/planning-loop.md`) |
| Plan obligation | A claim of the plan waiting for a value | the open plan; `PlanObligation` | *changed* by "Anyone may propose, and the record shows who" (its note of 2026-11-12) and question 3. The pilot's record is ten strings |
| Plan ledger record | What a plan value rests on, rendered | `plan_ledger` | *changed*: removed as a model value. Its content is the phase's result (§9) |

A node today is one record of twelve fields for all four node kinds,
told apart by which fields are empty (`is_leaf` is "not composite, not
borrowed, not a choice"). That is a representation choice of the
pilot. The specification fixes the kinds and what each holds, and
leaves the representation to the rebuild.

## 3. The claims

Serves use cases 1, 2, 3 and 4. Under "Nothing is a claim until
someone makes it", a planning check is a claim only when someone makes
it. The author of `plan NAME:` claims the plan well-formed. The author
of `plan NAME from CATALOG:` claims that the plan has a feasible
completion from its catalog (depends on question 3). A plan built
through the library and bound with no annotation claims nothing, and
its findings are a report. Strengths are the four of "Four strengths,
one vocabulary".

| Claim | Who makes it | What deciding it takes | Possible outcomes | Strength |
|---|---|---|---|---|
| Wiring: every input has exactly one producer in its scope (an outcome of a sibling, or a scope input) | The author claiming well-formedness | Evaluating the wiring over the plan value: a finite graph | True; refuted, naming the input and its consumer, or the producers of an ambiguous one | decided |
| Acyclicity of the derived edges | As above | As above | True; refuted, naming the nodes on the cycle | decided |
| Outcomes: each declared outcome produced once; each node outcome consumed or declared | As above | As above | True; refuted, naming the outcome | decided |
| Composite resolution and borrowing: a composite's inner graph produces its declared outcomes; a borrowed plan's inputs are available at the site | As above, and the borrowed plan's own author for its claims (use case 4) | As above; a borrowed plan's own claims are read from its result | True; refuted | decided, or the borrowed plan's strength if weaker, under "Every result says how strongly it holds" |
| Requirement on an input: the producer's promise implies the consumer's requirement | The consumer's author | Evaluating the implication with the value unknown, under "A claim about every value is decided by evaluating it with the value unknown". The pilot compares the fixtures' names | True; refuted with the two predicates; undecided when the residual is not `true` | decided or undecided |
| Choices: every option carries its choice's ports; no choice in a handler or a borrowed plan | The author claiming well-formedness | Evaluating over the plan value | True; refuted, naming the option | decided |
| Budget: the bound under each budget does not exceed it | As above | Evaluating the bound (§5) and comparing it measure by measure, dimensionally | True; refuted with the measure and both quantities; undecided while an estimate or a choice under the budget is unknown | decided, or undecided |
| Handlers: each handler's failure is raised beneath its scope; its graph, wired from what the scope had when the failure occurred, produces the scope's declared outcomes | As above | Evaluating over the plan value | True; refuted, naming the handler | decided |
| Escalation: a failure no scope handles leaves the plan | Nobody, unless an author claims "this plan handles every failure it raises" | Evaluating the escalation over the plan value | A report when unclaimed; when claimed, true or refuted with the failure and its raiser | decided when claimed |
| Template feasibility: some resolution passes every check | The author of `plan NAME:` on a template | Evaluating the checks for each resolution (§5) | True; refuted with the cheapest resolution and what it misses | decided over a finite set of options |
| Open plan feasibility: a completion from the catalog passes every check | The author of `plan NAME from CATALOG:` (question 3) | The catalog's remainder (question 2) | Undecided while the remainder is a cell; true when a proposal closes it | undecided, then decided |
| Promise: a fixture on an outcome holds of the value produced | The author who writes the fixture | The produced value, which a check phase does not have | Decided where the predicate's residual with the value unknown is `true` (the trivial `v => true`); otherwise undecided in the residual, for a phase that has the value | A fixture nothing checks is assumed, and the result says so. Question 9 asks when "nothing checks" holds |
| Record fields: a port's type is a type, a measure is of its dimension, effort is added only to effort, money only in one currency | Each constructor, under "Constructing a refined value claims its predicate" | Evaluating the field's predicate at construction | True; refuted with the predicate's explanation ("a duration is a time quantity such as 30 min, not a length quantity (3 m)") | decided |
| The library's walks over the node tree terminate | The library's author, under "Nothing is a claim until someone makes it" | Under "Termination by bounded decrease", a decrease of the tree's depth at each call | Today assumed, `assume terminates` on every walk; decided once a decrease over a child list is recognised | assumed today |
| A solution is feasible | Whoever proposes it: the solver, a person, a script, a model | Evaluating every check of the solved plan | True; refuted | decided |
| A solution is best by the objective | The solver | Exhausting the candidate space, or less (§5) | Decided when the space is exhausted; otherwise sampled or assumed, named | decided, sampled or assumed |
| A catalog entry is a node whose name the plan and the catalog do not hold | The proposer | Evaluating the entry and the names | True; refuted, naming the clash | decided |

**What "well-formed" is.** The author makes one claim: this plan is
well-formed. Its predicate is the conjunction of the rows above that
name that author. The pilot reports every failing conjunct in one
sentence, and that should stay: a refutation names every conjunct it
refutes. The recommendation is that the result records each conjunct
as its own claim, under the one the author made, so that a plan whose
structure is decided and whose budget waits on an unknown estimate
reads "structure decided, budget undecided" and the summary takes the
weaker. Depends on question 4.

## 4. Unknowns, obligations and proposals

Serves use cases 3 and 5. Under "Solving is proposing a value for an
unknown, and the kernel checks it", an open plan is a model with parts
not yet supplied.

**The unknown.** The pilot's unknown is a producer for an outcome,
supplied as a catalog entry: the search chains entries backward from
the plan's gap, and where no entry produces a port, the dead end is the
plan obligation ("`Shipped`, which `Depot` needs"). The catalog entry
is one representation of the unknown. The producer itself is a
subgraph whose outcomes include the port and whose inputs the scope can
supply. The recommendation (question 2) takes the catalog as the
representation. The open plan's catalog ends in a cell, the catalog
remainder. A proposal fills it with one entry and a new remainder, so
the cell is filled once and the catalog can still grow. The dead end
is the explanation the open plan's claim gives while it waits. It
tells a proposer where the search stopped; it is not the unknown.

**The obligation.** In the ruled vocabulary, an obligation is a claim
waiting for a value. For an open plan, the claim is its feasibility
(question 3) and the value is the catalog remainder. The obligation
appears in the result under "Open obligations are listed for any
proposer": the claim, its explanation in planning words, the last
refusal and the catalog in scope.

**A proposal.** Under "A proposer answers with only the missing
value", a proposal is one catalog entry and nothing else: a leaf, a
composite, a choice or a borrowed plan, as §2.9 of the chapter allows.
A proposal written as text is read by the planning notation's node
form (§6). A text the form cannot read is a parse failure of the
proposal, refuted before any claim is evaluated.

**A refusal.** The tool evaluates the open plan's claim with the
candidate in the remainder and keeps the candidate only if the claim
comes out true. Otherwise the claim stays undecided and the refusal is
the claim's explanation with that candidate, under "A predicate can
explain its refusal": the next dead end ("nothing in the catalog
produces `Labelled`, which `Courier` needs"); the cheapest completion
and the measure it misses; or the first failing check of the cheapest
completion. A candidate the catalog cannot hold (a reused name) is
refuted on its own claim. A check that does not finish within its step
budget is undecided, under "Limits are step budgets". The pilot uses a
wall-clock time box.

**What a proposal must leave unchanged.** The plan as written: every
field of the plan value, its nodes included. Under "A missing value is
a cell that is filled once" and "Structures immutable by default;
derive, never mutate", a value placed in the remainder cannot change
anything else, so the plan's identity holds by construction. A saved
record that must name the plan names its content hash, under "A saved
program names what it needs by content hash".

**What the pilot's mechanisms work around.** Three of them answer to
limits of the present implementation.

| Mechanism | What it works around | What the ruled decisions offer |
|---|---|---|
| Dead-end records built for the protocol (`Completion`, `Gap`, `PlanObligation` with ten string fields), computed when the open plan is built | The error value's payload is text, and host code reads the obligation by type name from the file's scope (`src/pcp.ts`, the lookups of `"OpenPlan"`) | The obligation is a claim in the phase's result, with the explanation its predicate answered, under "A predicate can explain its refusal" and "A tool reads a phase's result and adds no analysis of its own" |
| A hash over rendered text (`plan_surface`: the name, declared inputs, outcomes and budget, then the gap) to refuse a proposal that edits the plan | A proposal arrives as text spliced into the source, so the protocol must detect an edit after the fact. The hash leaves the nodes out: a probe with the open plan's one node changed gives the same surface and the same hash | A proposal fills a cell and can change nothing else. Identity, where a record needs one, is the content hash of the value |
| A splice into source text: the reply's lines appended under `catalog NAME:` by `splicePlanProposal`, the file re-read, the catalog's binding name recovered by the protocol because a grammar label hands a form the value or the matched text, never both | The kernel has no interface by which a value reaches a waiting cell | The proposal is supplied to the cell, and what waited on it is evaluated again, under "When information arrives, what waited on it is evaluated again". The catalog's name is in its expression's origin, under "Every value keeps its origin" |

The stored state and answer strings, and authorship kept in a
transcript outside the result, are the same kind of workaround; §9
treats them.

**Two open kernel designs.** The model needs two things of the kernel
and designs neither.

- "A solver sees its problem unevaluated". The completion search takes
  the open plan's claim unevaluated, evaluates it with the remainder
  unknown, and reads which parts are resolved. A gap is a part left
  unresolved: an input whose producer depends on the remainder. The
  model needs the functions that return the resolved and unresolved
  parts of a residual, which that decision says Vivace supplies, and a
  way to evaluate the claim with a candidate in place of the unknown
  without filling the cell, which its note names a kernel primitive.
- "A missing value is a cell that is filled once". The remainder is
  such a cell. A refused candidate never fills it. An accepted one
  fills it once, with the entry and a new remainder. The model needs a
  cell inside a list value whose shape is otherwise complete; that
  decision says a structure is always complete in shape and a value in
  one of its places may be missing, so the need is within it.

## 5. Search

Serves use cases 2 and 3. Under "Feasible is decided; best says how
strongly it holds", two searches find candidates, and each candidate is
a plan the claims of §3 judge.

**Feasible.** A candidate is feasible when its every check passes: the
choices resolved, the gaps filled, the budgets met by the bound. That
is decided by evaluating the candidate. A proposer's candidate is
judged the same way as the solver's.

**The bound.** The bound is an ordinary function of a plan: a leaf's
estimate; a composite's inner graph; a borrowed plan's graph; each
times its retry's maximum attempts; every handler's graph at its own
retry, at every scope. Durations add serially, and a measure an
estimate leaves out contributes nothing. These readings define the
bound. The budget claim is that this bound fits. Whether the work
itself fits is not claimed. For the worked example the main graph is
440 min and 8.75 person-hours, and the bound 1345 min and 24
person-hours.

**Best.** "No better candidate exists" is a claim over every candidate.
The pilot's search enumerates every resolution of every completion. A
completion adds an entry the plan does not hold at each step, with the
depth set to the catalog's size, so it reaches every completion that
uses each entry at most once in the plan's own scope. Choices have
finite options. Over that space the enumeration exhausts the
candidates, and "best by the objective" is decided. Anything less is
not decided: a search that stops at a depth below the catalog's size,
prunes with a heuristic bound, or samples candidates gives "best" as
sampled or assumed, and says so. Branch and bound with a bound that is
sound for every pruned candidate still exhausts the space in effect,
and stays decided. Today the solution carries no strength. The
objective is the bound's effort, then its duration; question 7 asks
whether the caller supplies it.

**The known conflict.** The held entry "Library search over kernel
residuals" decides that the planning search computes its bound in the
library, where evaluating the plan with its choices unknown would give
it. Two designs, for question 6:

| | A: the search in the library | B: the residual of the plan with its choices unknown |
|---|---|---|
| What it is | The pilot's. Enumerate resolutions as concrete plans, compute each bound by walking the plan, compare. Structural checks are run once over the template and per candidate only where a pick can change them, coded by hand (`template_findings`, `check_resolved`, `option_table`) | Each choice is an unknown, one of its options. The bound and the budget claim are evaluated with the choices unknown, and the residual is a smaller expression over them. The solver reads it, rebinds each unknown to an option, and evaluates again; equal sub-evaluations are shared |
| What it costs | About 350 lines of search code specific to plans, which duplicate what partial evaluation would give; a second search for a second model; the thesis is not shown on the model it was built to test | Depends on designs not yet shown: a residual's size grows with the choices unless sharing holds; reading a residual back needs the functions Vivace supplies; a bound refutes a template without enumerating only with a sound domain over quantities |
| What it needs from the kernel | Nothing beyond evaluation | "A solver sees its problem unevaluated" (residual reading, rebinding a name); "A function may take an argument unevaluated"; "Expressions memoize per evaluation context" in place of the hand-coded once-per-template checks; for refuting a template without enumeration, "Abstract domains as sound approximations" over quantities |
| What it gives | A selection, with the decisions | A selection by rebinding, the same decisions; a bound over every resolution from one evaluation; the same mechanism for any model |

The pilot recorded at its stage that the residual design yields a
bound, not a selection. That holds for reading an interval off a
residual. Rebinding the unknown, which "A solver sees its problem
unevaluated" provides, gives the selection.

**Evidence that would decide.** Both designs on the rebuilt kernel,
over the worked example's template and the fulfilment catalog: the same
solutions and the same strengths; the cost per candidate with sharing
and without it; the lines of plan-specific search code; and whether an
infeasible template is refuted with fewer evaluations than its
resolutions. Recommended: B, with A built on the new kernel only if
the kernel's milestone for "A solver sees its problem unevaluated"
fails, and then named as the weaker design.

## 6. The notation

Serves use cases 1 to 4. Under "Every notation stands for an
expression", each form maps what it matched to an expression and does
nothing else. Free names in that expression mean what they meant where
the form was defined: the library's builders, never a binding of the
user's file. Names the user writes in the text (a fixture, a `uses`
target, a catalog) are the user's.

| Form | The expression it stands for | Notes |
|---|---|---|
| `plan NAME:` and a block of items | A binding of `NAME` to the plan built from the items, with the claim that it is well-formed | The pilot expands to `binding_decl(NAME, build_plan(NAME, items), WellFormedPlan)` |
| `plan NAME from CATALOG:` and a block | A binding of `NAME` to the open plan built from the plan and the catalog's value, with the feasibility claim (question 3) | The pilot expands to `binding_decl` with no type, and `open_plan` |
| `catalog NAME:` and a block of node blocks | A binding of `NAME` to the list of nodes, ending in a remainder when an open plan draws on it (question 2) | Only node blocks parse inside it |
| `Name:` and a block | A node built from its items: a leaf, a composite when it holds node blocks, a choice when it holds `options:` | `build_node` |
| `Name: uses Target` | A node borrowing the plan `Target` | `uses(Name, Target)` |
| `inputs:` and `outcomes:`, inline or one per line | A list of ports | `port(T)`, or `port_where(T, F)` for `T [ F ]` |
| `estimate:` and `budget:` with measures | An estimate or a budget from the measures given | `est`, `budget`; each measure is a quantity literal or an effort literal |
| `retry: max N attempts[, X backoff]` | A retry | `retry`, `retry_backoff` |
| `fails: F, …` | The node's declared failures | `with_failure` per name |
| `instructions:` and indented lines | The text, lines joined | `with_instructions` |
| `options:` and node blocks | The choice's options; an option without ports takes the choice's | `with_options` |
| `on F:` and a block | A handler for `F`, with an optional `retry:` | `build_handler` |
| `30 min`, `2 h`, `30s` | A duration, from the units language's literal form | The units language's notation, not planning's |
| `1 person-hour`, `0.5 person-hours` | An effort | Planning's own literal form, `person_hours(n)` |

**What the grammar rulings change for a planning text.**

- **"A grammar change reaches to the end of its block."** The planning
  notation holds from where a text asks for it to the end of that
  block, or of the text. A file of plans can confine it to one block. A
  module that declares plans uses the notation for itself, and a file
  that imports the module gets its bindings and not its notation:
  `tests/planning-split-demo.alg` asks for the notation itself, as it
  should.
- **"Importing a module's bindings never brings its notation."** That
  is the same decision's second sentence. It bears on the units
  literals. The `estimate:` clause reads a duration with the reading
  grammar's expression rule, and `30 min` parses there only because the
  text also asks for the units notation. Planning's notation therefore
  depends on the units notation without saying so. The recommendation
  (question 11) is that the planning grammar value is the combination
  of the units literal forms with its own, so that a text asks for
  planning alone.
- **"Grammars combine without regard to order."** §2b.2 of
  `docs/plans/planning-loop.md` measured two collisions. Rule names are
  one namespace: a second library's `rule pname` replaces planning's
  without a word, and a plan fails to parse in one order of the `use`
  lines and parses in the other. Top-level names are one scope: a
  second library's `Finding` is built by planning's `check_plan`.
  Under the ruling, the first is a conflict refuted before any text is
  read in the combined grammar, and a replacement names what it
  replaces. The loop's grammar today reuses planning's `pname` and
  `node_items` through the shared namespace. Under "Grammars are
  values" and "Symbol identity is a fully-qualified name" it refers to
  them as productions of the planning grammar value. The second
  collision is a free name resolved where the function runs; "Every
  notation stands for an expression" and "Imported modules are typed
  objects whose type encapsulates" remove it.

## 7. Failure

Serves use cases 1, 2 and 3. Every place the pilot yields an error
value, halts or reports, and what the ruled decisions make it. A
refutation is the kernel's, under "A refutation marks everything
computed from it". An exception is the standard language's handled
failure, under "The standard language's handled failure is an
exception". A report is a finding about code that claimed nothing.

| Place | Today | Under the ruled decisions | Decision |
|---|---|---|---|
| A wrong measure in an estimate or a budget (`as_duration`, `as_effort`, `as_money`) | An error value with planning words | A refutation, with the predicate's explanation | "Constructing a refined value claims its predicate"; "A predicate can explain its refusal" |
| Effort added to or compared with something else; money of two currencies; scaling by a non-number | An error value | A refutation of the operator's parameter claim, with the explanation | "A typed function claims its parameter types on entry and its return type on exit" |
| Something other than an estimate or a budget passed to `with_estimate` or `with_budget` | An error value | A refutation, as above | As above |
| A port whose type is not a type (`Port(42, none)` builds) | Nothing | A refutation at construction | "Constructing a refined value claims its predicate" |
| The rollup of a plan with an open choice | An error value, "has open options; solve the plan first" | A residual over the unknown choice | "Evaluation is total over unresolved information" |
| `plan NAME:` on a plan that does not check | A halt, with every finding as the predicate's error value | A refutation of the author's claim, carrying what the predicate answered | "Nothing is a claim until someone makes it"; "A predicate can explain its refusal" |
| A parameter annotated `WellFormedPlan` given a plan that does not check | A halt | A refutation of the parameter claim | "A typed function claims its parameter types on entry and its return type on exit" |
| `validate(p)` on a plan that does not check | An error value with the findings | The predicate's answer as data: `true`, or the explanation. A program that wants to test a value calls the predicate | "Constructing a refined value claims its predicate" |
| A plan bound through the library, with findings, no annotation | "Not claimed well-formed" in the ledger | A report | "Nothing is a claim until someone makes it" |
| `solve` or `solve_from` called by a program, with no feasible candidate | An error value with the counterexample | An exception the caller may handle, carrying the counterexample | "A failure a program can handle is supplied by an extension"; "The standard language's handled failure is an exception" |
| `solve` on a template that is not sound | An error value with the first finding | An exception as above when the program asked; a refutation where an author claimed the template well-formed | As above; "Nothing is a claim until someone makes it" |
| A template claimed well-formed with no feasible resolution | A halt, with the cheapest resolution | A refutation | "Feasible is decided; best says how strongly it holds" |
| An open plan with a gap | No halt; state "open" stored as a string | The feasibility claim undecided, with its explanation; an obligation (question 3) | "Solving is proposing a value for an unknown, and the kernel checks it" |
| An open plan whose gaps close but which no completion solves | State "unsolved" stored as a string | The feasibility claim undecided, with the cheapest completion as explanation | As above |
| A failure no scope handles | Escalates to the caller; not a finding | A report; a refutation only where an author claims every failure handled | "Nothing is a claim until someone makes it" |
| A handler for a failure nothing beneath it raises | A finding in the well-formed predicate | A refuted conjunct of the claim; a report when unclaimed | As above |
| A proposal that is not one node block, reuses a name, or does not parse | A refusal kind of the protocol | A refutation of the proposal's own claim; the plan's claim unchanged | "A proposer answers with only the missing value" |
| A proposal that edits the plan | Refused when the surface hash moves | Cannot arise: a proposal fills a cell | "A missing value is a cell that is filled once" |
| A proposal whose check outlasts the time box | The refusal `timeout` | Undecided at the step budget | "Limits are step budgets" |
| A fixture on an outcome | Listed as an "admitted" promise | Assumed, and named; or undecided for a later phase (question 9) | "Every result says how strongly it holds" |
| A plan nested deeper than the ledger's 32 walk levels | A note in the record | Gone: the walk is an ordinary recursion | "A recursive call is evaluated once for each state of knowledge" |

A plan's own `fails:` types are values of the model: failures of the
work the plan describes. They are not failures of the program, and
none of the rows above applies to them.

**The known conflict: "Two enforcement shapes for a well-formed
plan".** The held entry has the constructor yield an error value when a
check fails and the annotated binding halt. Two of its premises are
ruled away. "Constructing a refined value claims its predicate" makes
a failed construction a refutation, so the error-value path is gone.
"Nothing is a claim until someone makes it" gives the two cases
directly: a plan claimed well-formed, which halts on a refutation, and
a plan that claims nothing, whose findings are a report. The open plan
is the second case with a claim of its own (question 3). A program
that wants to know whether a value would pass calls the predicate. The
recommendation (question 5) is to remove the entry as a workaround of
the present implementation; its content is the two ruled decisions.

## 8. Mappings

Serves use cases 1, 4 and 5. Under "Two models relate only through a
declared mapping", every relation between the planning model and
another is a mapping, declared, defined and checked.

**Durations, from the units language.** An estimate's duration and a
budget's duration are values of the units language's `Duration`, a
named dimension refined over its `Quantity`; the budget check compares
them with the units language's operators, so a budget of 2 h checks a
rollup in minutes. Among the candidate kinds the inventory lists, this
is one model's values typed by another's. Today it is implicit. The
planning library asks for the units notation, tests `instanceof
Duration` in `as_duration`, and types the field `Any`. No mapping value
exists, and nothing a tool can read says that planning rests on units.
That is the option "models coupled implicitly, through shared names or
code that reads both", which the decision records as not chosen. The
recommendation (question 10) is a declared mapping value: the planning
model's duration fields are typed by the units model's `Duration`, the
comparison is the units model's, and the mapping's own claims (the
units preserved by every rollup) are stated and checked. Its kind is
worked out with the mapping kinds, a design to prove that phase 1 left
open.

**A plan's outcome typed by a software system model's artifact.** This
is the planned mapping, ruled as the first composition point on the
review of the planning loop's PR of 2026-11-12. A port of a plan holds
an artifact of a system model, and a claim spanning the two models
says every artifact the system requires is produced by some plan. An
artifact no plan produces is then a finding of that claim, and a
mapped plan with that artifact among its outcomes is an open plan whose
obligation the same loop answers (§2b.4 of
`docs/plans/planning-loop.md` measured this with a probe). Its
specification is a separate document.

**What the planning model must expose to any mapping.** Its values as
values. §2b.1 of `docs/plans/planning-loop.md` is the evidence: a port
holds its type as a `String`, so a port named `Durashun` checks clean
beside one named `Duration`, and nothing relates either to a type. A
type value can sit in the field and wiring by identity works, but
every rendering the model builds from a port halts on it: each
finding's message, the obligation, the surface and so its hash, and
the ledger's lines. So the model must expose:

- ports typed by type values, compared by identity (question 1);
- nodes, failures and fixtures as values with origins, so that a
  mapping refers to them and a rendering reads their names from the
  origin;
- findings and explanations that refer to these values, rendered by the
  library that owns each value;
- the plan value itself as what a mapping relates, with no rendered
  surface standing for it.

## 9. The result and the tools

Serves use cases 1 to 5. Under "A tool reads a phase's result and adds
no analysis of its own" and "A result names everything it rests on", a
phase's result for a file of plans holds, for each plan value:

- each claim made about it (§3), with its strength in the four words,
  and each conjunct of the well-formed claim with its own;
- for a refuted claim, the predicate's explanation;
- for an undecided one, what it waits on: an unknown estimate, an
  unknown choice, the catalog remainder;
- the promises, each a claim with its strength and the plan values
  that rest on it;
- for a solution, its bound, its decisions and the strengths of
  "feasible" and "best", with the space the search exhausted;
- the proposals taken: each catalog entry that filled a remainder, who
  proposed it and in how many attempts, under "Anyone may propose, and
  the record shows who";
- what the plan rests on: the planning extension, the units extension
  through the mapping of §8, a borrowed plan's result, and the
  assumptions on the record (the walks' termination while it is
  assumed), under "An assumption is always on the record";
- the obligations waiting, under "Open obligations are listed for any
  proposer", each with its form for programs and its form for people,
  the latter written by the planning model.

**The pilot's ledger, set against this.** The plan ledger is assembled
by host code. `src/pcp.ts` finds the plan values by looking up the type
names `"Plan"`, `"Solution"` and `"OpenPlan"` in the file's scope,
writes a binding that calls `plan_ledger` on each, evaluates it, and
reads the `PlanLedger` record back by its type name. Authorship comes
from the loop's transcript, matched to entries by node name, which is
ambiguous when two entries share a name. The open plan's state and
answer are strings computed when it is built. The record's strengths
use "discharged" and "admitted". The walk over a plan's ports is a
fold over 32 levels because three plainer forms did not load. Under
the ruled decisions each of these is the result's content, written by
evaluation: no tool looks a model up by name, the proposer is in the
filled cell's origin, and the strength words are the four.

## 10. The fifteen held decisions

For the review session. Each recommendation is one of: *keep* as a
decision of the planning chapters; *restate* (the restatement given);
*fold* into a named decision of Part V or another part; *remove* as a
plan's choice or a workaround.

| Entry | What it decides | Recommendation | Reason |
|---|---|---|---|
| "A plan is an outcome graph with derived wiring" | A plan is a graph of nodes with typed ports, edges derived by type, performer as metadata | *Restate*: "a plan is a value: a graph of nodes whose ports are typed by type values; an outcome wires to every input of the same type in its scope, a name assigned only where that is ambiguous; the performer is metadata" | Ports typed by values are what every mapping needs (§8, question 1) |
| "Leaf and composite nodes, with `uses` to borrow a plan" | Leaves, composites whose outcomes are their inner graph's, and borrowing a plan, across files by import | *Keep* | It decides the model's hierarchy and holds under the ruled decisions on modules |
| "Failure handlers over outcomes" | Declared failures, handlers as alternate graphs, propagation to the nearest handler, escalation | *Restate*: "a node declares the failures it can raise; a handler inside a scope is an alternate graph that must produce the scope's declared outcomes from what the scope had when the failure occurred; handler validity is a conjunct of the well-formed claim; a failure no scope handles leaves the plan, a report unless claimed" | Removes the entry's own conflict between a run-time and a check-time reading |
| "Two enforcement shapes for a well-formed plan" | An error value on construction, a halt on annotation | *Remove* as a workaround | Its content is "Nothing is a claim until someone makes it" and "Constructing a refined value claims its predicate" (§7, question 5) |
| "Planning surface conventions" | One keyword `plan`, no keyword for a node, reserved lowercase keys | *Keep*, as the notation's decision under "Every notation stands for an expression" | It settles how plans read; the keys are local to the planning notation's block |
| "Bracket constraints as refinements, named as predicate fixtures" | `[predicate]` on a port: on an outcome a promise, on an input a requirement; every outcome consumed or declared | *Restate*: "a fixture is a predicate on a port's value; on an outcome it is a promise, a claim about the value produced; on an input it is a requirement, met when the producer's promise implies it; every node outcome is consumed or declared" | The implication is decided by evaluation where the pilot compares names |
| "Planning-local effort and money, durations from the units DSL" | Effort and money as planning's own records; durations from the units language | *Restate*: "effort and money are the planning model's own measures; durations are the units model's, through a declared mapping" | The units coupling is implicit today (§8, questions 10 and 12) |
| "Estimates roll up, budgets are proved" | The bound's readings and the budget as a check of the bound | *Restate*: "the bound is an ordinary function of the plan, defined by its readings (serial durations, a missing measure contributing nothing, retries at their maximum, handlers included); a budget is a claim that the bound fits, decided when every estimate under it is known and undecided otherwise" | "Proved" is not one of the four strengths |
| "Scheduling, resources, performers and latitude" | Whether plans carry these, none present | *Remove* as a plan's choice; keep it as an open question of the chapter | It decides nothing; the performer as metadata is in the first entry |
| "Fan-in through an explicit aggregator node" | Outcomes join only through an explicit node | *Keep* | It fixes a semantic of wiring: no implicit join |
| "Explicit `raise` and failure context in handlers" | Whether a handler may propagate explicitly and read what failed | *Fold* into "Failure handlers over outcomes", as its open part | It is that entry's unresolved surface |
| "Choices, templates and solution finding by enumeration" | Choices, templates, `solve` by enumeration and a fixed objective | *Restate*: "a node with options is a choice; a plan holding one is a template whose choices are unknowns; a resolution is proposed for them and judged by the plan's claims; the objective is a value the caller supplies". The strategy and its strength *fold* into "Feasible is decided; best says how strongly it holds" | Enumeration is one strategy, and the decision of Part V governs what any strategy may claim (questions 6, 7) |
| "Completion from a catalog" | A gap is what the checks report, a catalog a list of nodes, completion fills gaps backward to a depth | *Restate*: "an open plan is a plan with a catalog whose remainder is unknown; its feasibility claim waits for the remainder; a proposal is one entry; completion is the search that places entries" | Its loop half is the first instance of "Solving is proposing a value for an unknown, and the kernel checks it" (questions 2, 3) |
| "Library search over kernel residuals" | The bound is computed by library search, not read from a residual | *Remove* as a workaround | The entry calls itself an expedient; its target is "A solver sees its problem unevaluated" (§5, question 6) |
| "Search beyond enumeration" | Whether to add branch and bound | *Fold* into "Feasible is decided; best says how strongly it holds" | A strategy is a library's choice; what it may claim is the ruled decision's |

## 11. Questions for the maintainer

Ordered so that a question comes after the ones it depends on.

1. **What a port's type is.** (a) A type value, compared by identity,
   possibly another model's. (b) A name, with a declared mapping from
   names to types. (a) costs a rendering path that reads a value's name
   from its origin, and findings that hold values (§8). (b) keeps names
   in the model and puts every relation to a type in a mapping that
   must itself be checked against the names; a typo checks clean until
   the mapping is. **Recommended: (a).** Questions 2, 10 and §8 depend
   on it.
2. **What the unknown of an open plan is.** (a) The catalog remainder,
   a cell filled by one entry and a new remainder. (b) One cell per gap,
   a producer for a port in a scope. (c) The whole completion as one
   unknown. (a) leaves placing the entry to the completion search and matches "A proposer
   answers with only the missing value", which names a catalog entry;
   it needs a cell at the end of a list. (b) gives the solver a direct
   unbound name per gap, but the gaps depend on the search, and a
   second gap appears only after the first is filled. (c) asks the
   proposer for more than the missing value. **Recommended: (a).**
3. **What declaring an open plan claims.** (a) Nothing; its gaps are a
   report, and a claim is made only when a proposal closes them. (b)
   That the plan has a feasible completion from its catalog, a claim
   undecided while the remainder is a cell. Under (a) there is no claim
   waiting, so no obligation in the ruled sense. Under (b) the
   obligation is that claim, and the open plan "claims nothing yet"
   about its well-formedness, as the inventory's note on the held
   chapter says. **Recommended: (b).** Depends on question 2.
4. **Well-formed as one claim or several.** (a) One claim, its
   predicate the conjunction, with each conjunct recorded as its own
   claim in the result. (b) One claim, recorded once. (c) Several claims
   the author makes separately. (a) lets a result say "structure
   decided, budget undecided"; it costs a result entry per conjunct.
   (b) reports the weakest conjunct's strength for the whole. (c) asks
   the author to write what the `plan` form claims today in one word.
   **Recommended: (a).**
5. **"Two enforcement shapes for a well-formed plan".** (a) Remove it:
   a plan is claimed well-formed or claims nothing, and a program tests
   with the predicate. (b) Keep a construction path that raises an
   exception the program handles. (b) adds a third shape the ruled
   decisions do not need. **Recommended: (a).** Depends on questions 3
   and 4.
6. **Where the search's bound comes from.** (a) The library's
   enumeration, as built. (b) The residual of the plan with its choices
   unknown, read and rebound by the solver. Costs and needs are in §5.
   **Recommended: (b)**, with (a) built on the new kernel only if the
   kernel's milestone for "A solver sees its problem unevaluated"
   fails, and then named as the weaker design. Depends on question 2.
7. **The objective.** (a) Fixed in the model: the bound's effort, then
   its duration. (b) A value the caller supplies, an ordering over
   bounds, with that as the default. (b) costs one parameter and makes
   "best" mean what the caller asked. **Recommended: (b).**
8. **Whether running a plan is in this specification.** (a) No: this
   specification covers checking and solving; running a plan, which
   under "Phases are configuration" is the same evaluation with
   capabilities to act, is a later amendment. (b) Yes, now. (b) needs
   capabilities for performers and a phase that receives produced
   values, none of which the use cases of §1 require yet.
   **Recommended: (a).** Question 9 depends on it.
9. **A promise's strength in a check phase.** (a) Assumed, and named,
   whenever the configuration gives no phase the produced value. (b)
   Undecided, in the residual, whenever a later phase may receive it,
   and assumed only where a configuration says none will. (a) matches
   the pilot's report. (b) follows "Claims are evaluated like everything
   else" and lets a run phase decide a promise. **Recommended: (b).**
   Until running a plan is specified (question 8), no configuration
   gives a phase the produced value, so every promise of a checked plan
   is assumed and named, as the pilot reports, except a trivial one,
   which is decided.
10. **Declaring the units mapping.** (a) A declared mapping value now:
    planning's durations typed by the units model's `Duration`. (b)
    Implicit until the mapping kinds are worked out. (b) leaves the
    rejected option of "Two models relate only through a declared
    mapping" in the first ported model. **Recommended: (a).** Depends on
    question 1.
11. **Planning's notation and the units literals.** (a) The planning
    grammar value combines the units literal forms with its own, so a
    text asks for planning alone. (b) A text asks for both. Under "A
    grammar change reaches to the end of its block", (b) leaves a hidden
    dependency of one notation on another. **Recommended: (a).**
12. **Effort and money.** (a) The planning model's own measures, as
    built. (b) The units language generalised to named dimensions beyond
    the seven of SI. (b) is a units design question and changes a ruled
    worked language. **Recommended: (a)**, with a mapping to a
    generalised units model left open.

## 12. Evidence and limits

**Read.** `docs/plans/rebuild.md` §1 and §2;
`docs/plans/rebuild-acceptance.md` §1, §2 and §5; the inventory's
contents, all of Part V from "Models" to the end of "Finding solutions
to a plan", and the entries of other parts the brief named;
`docs/records/book-pass/dr5-part-5-vivace.md` and
`docs/records/book-pass/phase-1-close.md`; `docs/book/vivace/planning-dsl.md`;
`lib/planning.alg` and `lib/planning_loop.alg`; the three scenes, their
READMEs and `demos/rung4/01-loop.md`; the headers of the ten
`tests/planning-*.alg`; `docs/plans/planning-loop.md` §1, §2.2, §2b.1,
§2b.2, §2b.4, §2b.5 and the two record entries on the ledger and the
demo; the identity and splice code of `src/pcp.ts`.

**Ran**, on this branch's tree, through `npx tsx src/index.ts`: the
three scenes (their pinned lines as expected, 2.7 s to 4.1 s each);
`verify` and `obligations` on `demos/rung4/01-loop.alg`; `inspect` on
`demos/rung3/01-model.alg`; the ten `tests/planning-*.alg`, each with
as many output lines as `// expect:` lines and exit 0. One
library-only probe, kept outside the repository: an open plan whose
one node was replaced through the library gives the same `surface`, so
the identity hash does not cover the nodes; and two fixtures, `v =>
true` and `v => v > 0`, are unequal values that the pilot reports
alike.

**Not checked.** Nothing here ran on a rebuilt kernel; none exists.
Every statement about the residual design of §5, cells in a list, the
rebinding primitive and step budgets rests on the ruled decisions
alone. The loop with a language model was not run; its transcript was
read. The size of the residual for the worked example's template is
not measured. The software system model's mapping is stated from
§2b.4's probe and the ruling of 2026-11-12, not designed.

**What rests on what.** The use cases, the values marked *pilot*, the
notation table, the bound's readings and figures, the failure table's
"Today" column, and the measurements of §4 and §8 rest on the pilot as
built. The claims' strengths, the unknown and the obligation, the
refusal under step budgets, the "Under the ruled decisions" column,
the result of §9 and the recommendations rest on the ruled decisions
alone.
