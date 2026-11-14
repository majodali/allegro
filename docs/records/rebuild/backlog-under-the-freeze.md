# The backlog classed under the freeze

> **Record.** Reader: the maintainer returning after a gap. Form:
> W-008 (reports map their deliverables). Subject: chunk G2 of the
> rebuild program, `docs/plans/rebuild.md` §5, drafted 2026-11-13 on
> `origin/main` at the merge of PR #197. Author: the orchestrating
> session. Every open item of `docs/backlog.md` gets a recommended class
> under the freeze. No item is marked here. Marking them follows the
> maintainer's ruling.

## Asks

1. **Take every recommendation.** This is the default. Each item's class
   below becomes its disposition, and a follow-up chunk marks the
   backlog: a dissolved item closes with a pointer to its decision, a
   stopped item closes as not done with the freeze as the reason, and
   every other item stays open with its class and chapter.
2. **Ratify or strike the seven class names** of "Terms introduced".
   Default: ratified.
3. **Rule each class boundary I was unsure of.** Each line names the
   class recommended first and the class weighed against it. Default:
   the recommendation.
   - B-029 (the prover protocol revalidated): dissolved by "A proposer
     answers with only the missing value", or still needed in the
     acceptance stream's chapter "Tools" for the catalog and budgets.
   - B-030 (the sweep of the v1 inventory's open dispositions): stopped
     by the freeze, or still needed outside the rebuild after it.
   - B-037 (embeddable grammars): still needed in the kernel stream's
     chapter "Changing the grammar", or dissolved by "No parser is
     privileged".
   - B-047 (sync and async modifiers): still needed in the kernel
     stream's chapter "Evaluation", or dissolved by "A missing value is
     a cell that is filled once".
   - B-074 (opt-in memoization): stopped by the freeze, or still needed
     in the kernel stream's chapter "Evaluation".
   - B-083 (the AI iteration loop): still needed in the acceptance
     stream's chapter "Tools", or dissolved by "Open obligations are
     listed for any proposer".
   - B-098 (predicate propagation onto residuals): dissolved by "A
     field's rule is a pure, bounded function", or still needed in the
     kernel stream's chapter "Refinement types".
   - B-104 (retire the dunder convention): stopped by the freeze, or
     dissolved by "Each decision lives in one replaceable unit of code",
     which holds the prefixed engine slots as a finding.
   - B-116 (an interface's two guarantees): still needed in the kernel
     stream's chapter "Refinement types", or a corpus case.
   - B-124 (the guard-coverage audit): dissolved by "Authority is an
     unforgeable value", or stopped by the freeze.
   - B-128 (layer separation policed): dissolved by "Each decision lives
     in one replaceable unit of code", or stopped by the freeze.
   - B-130 (the design corpus's editorial pass): still needed outside
     the rebuild, waiting for it, or stopped by the freeze.
   - B-135 (a rule for the host plane): stopped by the freeze, or still
     needed in the kernel stream's chapter "Values".
   - B-161 (CLI startup): stopped by the freeze, or still needed in the
     acceptance stream's chapter "Launching".
   - B-177 (the demo ladder chapter's findings): a corpus case, or still
     needed in the acceptance stream.
   - B-190 (name capture): a corpus case, or dissolved by "Symbol
     identity is a fully-qualified name".

## What is already covered

**The freeze, as ruled** on 2026-11-13 (`docs/plans/rebuild.md` §4).
The present tree changes only where the bootstrap or the comparison
needs it, by a PR the maintainer merges. Work on code due for
replacement stops: tidy-ups, ratchet lowering, reviews of the present
evaluator, and fixes of defects the ruled decisions already remove. The
classes below apply that ruling item by item.

**The streams, as ruled** (`docs/plans/rebuild.md` §1). The kernel
stream takes Parts II to IV of the inventory and the chapter "The
kernel's interface". The acceptance stream takes Part V and the rest of
Part VI. The two "still needed" classes follow that split.

**Items of another session, listed and not classed.** The review
session's: B-174 (the book's existing chapters retrofitted to IR) and
B-182 (unit tidy-ups from the book pass). Its plan,
`docs/plans/book-pass.md`, reserves B-184 (the root README's
corrections) and B-186 (a lane for the monotonic pass), both closed. The
rebuild's own: B-195 (the rebuild program), B-196 (the rebuild's
acceptance side), B-197 (evidence against a ruled decision),
B-198 (first out-of-scope finding of the acceptance stream) and
B-199 (second out-of-scope finding of the acceptance stream).

## What changed

**The table.** One row per open item, in the backlog's order. A
decision is named by its title in `docs/plans/book-pass-inventory.md`,
in double quotes. A milestone is one of the nine of
`docs/plans/rebuild.md` §5.

| Item | Asks for | Class | Reason |
|---|---|---|---|
| B-089 (lawful-interface follow-ons) | `Ordered`, `Monoid` and `Semiring` as lawful interfaces, law sugar, sampled record quantifiers | Still needed, kernel stream: "Equality and laws" | "Lawful interfaces" rules the mechanism; these instances and their surface are library work on it |
| B-029 (the prover protocol revalidated) | a design document for the prover protocol, from the archived v1 plan | Dissolved | "A proposer answers with only the missing value", with "Open obligations are listed for any proposer", replace the protocol; the catalog and budgets stay with B-054 (a proof catalog) and B-056 (prover budgets and escalation) |
| B-030 (the sweep of the v1 inventory's open dispositions) | every open disposition of `V1-INVENTORY.md` settled, the canaries re-verified | Stopped by the freeze | the sweep is against a milestone of the present tree; the canaries become corpus cases in the acceptance stream's corpus chunk |
| B-032 (grammar extension phase 8) | `use X in { block }`, a `use` read mid-parse, builder lambdas, combining operations | Dissolved | "A text can change the grammar it is read in", with "A grammar change reaches to the end of its block" and "Grammars combine without regard to order"; the restricted-`use` whitelist has no ruling and no use case |
| B-033 (grammar engine phase 7 onward) | indent-engine extensions, full left recursion, a precedence analyzer | Dissolved | "Any parsing algorithm will do that meets five conditions"; the present engine is replaced |
| B-034 (alternative order without meaning) | alternatives whose order means nothing, a label-directed tree builder | Dissolved | "Any parsing algorithm will do that meets five conditions"; the tree builder goes with "Every notation stands for an expression" |
| B-035 (the Earley parser retired) | the generated Earley parser removed | Stopped by the freeze | a removal in code due for replacement; it goes with the present tree at milestone 9 |
| B-036 (parse error recovery) | error productions and synchronisation points | Dissolved | "Parse failure reporting and recovery" |
| B-037 (embeddable grammars) | a different parser mid-file or per module | Still needed, kernel stream: "Changing the grammar" | "No parser is privileged" allows several parsers per configuration; unsure whether a form may switch the engine mid-text, not only the grammar |
| B-038 (the module loading contract) | the loading contract and a policy for circular dependencies | Dissolved | "The loader reaches files through a capability", which makes a cycle an error, with "A module is an extension that arrives as a file" |
| B-039 (grammar switching mid-statement) | a grammar change inside a statement | Dissolved | "A text can change the grammar it is read in": a form changes the grammar where it appears |
| B-040 (qualified import and re-exports) | `import math.round` and re-exports | Still needed, kernel stream: "Reaching a member" | "Export marks the binding, and a module with no exports is open" rules what a module hands out; the import and re-export surface is unruled |
| B-041 (typed collections) | `Map` and `Set` as typed generics, persistent representations | Still needed, kernel stream: "Types as values" | the inventory holds the collection half as open, on "Arrays are structures with unkeyed entries" |
| B-042 (a scalar type builder) | `Scalar(bitLength)` and packed Bits structures | Still needed, kernel stream: "Types as values" | "The core types are built over bits" names the core types only; a builder for more is unruled |
| B-043 (keyword type declarations) | keyword syntax for type declarations | Still needed, kernel stream: "The surface language" | "Combinators before keyword declaration syntax" defers it until the combinator patterns settle |
| B-044 (an error handling surface) | `try`/`catch` or an equivalent | Still needed, kernel stream: "The surface language" | "The standard language's handled failure is an exception" rules the concept; the raise-and-handle surface is unruled |
| B-045 (regular expressions) | a regular-expression library and literal | Still needed, kernel stream: "The surface language" | no decision names it; a library and a literal form after milestone 4 |
| B-046 (configurable mutability) | linear types, transient mutation, finalisation | Still needed, kernel stream: "Values" | "Structures immutable by default; derive, never mutate" leaves finalisation to the mutability track |
| B-047 (sync and async modifiers) | async by default with a `sync` hint | Still needed, kernel stream: "Evaluation" | unsure whether "A missing value is a cell that is filled once" leaves any need for the modifiers |
| B-048 (algebraic effects) | `perform`, `handle`, `resume` | Still needed, kernel stream: "Effects" | "An effect is the use of a capability" may give handlers by passing capabilities; resumption is unruled |
| B-049 (patterns with unification) | patterns as boolean expressions with unification | Still needed, kernel stream: "Contracts" | "Unification in patterns" is ruled as open |
| B-050 (variance and type constraints) | variance and `where T: Comparable` | Still needed, kernel stream: "Types as values" | "The user-facing generics surface and parameter kinds" is ruled as open |
| B-051 (the roadmap remainder revalidated) | capability types, information flow, behavioural budgets, declared intent | Still needed, kernel stream: "Effects" | split: capability types are dissolved by "A capability has named parts and narrowed forms" and declared intent by "Trust comes from the kernel, not the author"; information flow and budgets are unruled |
| B-052 (Lean export) | proof terms and refinements exported to Lean | Dissolved | "A decided claim can be translated into a proof an outside checker accepts" |
| B-053 (a provable standard library) | sort, search and theorems on `map`, `filter`, `reduce` | Still needed, kernel stream: "Claims and proofs" | library work over the proof decisions, after milestone 5 |
| B-054 (a proof catalog) | a catalog of proofs per project | Still needed, acceptance stream: "Tools" | no decision names a catalog; "A stored outcome is restored with its builder's name" may cover part |
| B-055 (parallel prover orchestration) | several proving strategies run in parallel | Still needed, acceptance stream: "Tools" | no decision names it; the tools for proposing are rebuilt after milestone 3 |
| B-056 (prover budgets and escalation) | effort budgets, escalation, reproducibility | Still needed, acceptance stream: "Tools" | "A proposer answers with only the missing value" bounds the attempts; escalation is unruled |
| B-057 (contracts polish) | `requires` at the call site, relational predicates, `assumes`, contracts in the verdict, `ensures` over parameters | Still needed, kernel stream: "Contracts" | split: "Contract checks sit at function entry and return", "An assumption is always on the record" and "Every result says how strongly it holds" dissolve three parts; relational predicates and `ensures` over parameters are unruled |
| B-101 (predicate-carrier residue) | the legacy domain component, the `type-invariant` source and `assume_invariant` retired | Dissolved | "An assumption is always on the record" retires `assume_invariant`; the rest is a tidy-up stopped by the freeze |
| B-059 (a project root file) | a file stating a project's structure, phases and dependencies | Still needed, acceptance stream: "Configuration" | "A full configuration is a model, evaluated in a first phase" is a design to prove; the file's form is its language |
| B-060 (build and test commands) | `allegro build` and `allegro test` | Dissolved | "A command is a configuration" |
| B-061 (a multi-phase build pipeline) | a configurable pipeline with phase gates | Dissolved | "A phase hands its residual to the next", with "Phases are configuration" |
| B-062 (typed phase-resource declarations) | code declaring the resources a phase gives it | Dissolved | "A module is a function of the capabilities it declares" |
| B-063 (tree shaking) | dead code removed by partial evaluation | Still needed, acceptance stream: "Saved programs and export" | no decision names it; it is a candidate part of "A target platform is a model, and export is a transformation into it" |
| B-064 (tracing and stepping) | execution tracing and step-through debugging | Still needed, acceptance stream: "Tools" | "A trace is read from origins" is ruled as open |
| B-065 (REPL improvements) | continuation, error display, completion at the prompt | Still needed, acceptance stream: "Tools" | the prompt's meaning is dissolved by "Running a program is evaluating its main module with a configuration's capabilities"; display and completion are unruled |
| B-066 (expression-graph processing) | querying, transforming and rewriting expression graphs | Still needed, acceptance stream: "Tools" | "A trace is read from origins" names a utility for querying origins and is open; rewriting rests on "A transformation is a model" |
| B-067 (editor integration) | a language server | Still needed, acceptance stream: "Tools" | "A tool reads a phase's result and adds no analysis of its own" bounds it; nothing builds it |
| B-068 (review by semantic summary) | a semantic summary as the reviewable artifact | Still needed, acceptance stream: "Tools" | "A module's summary is the weakest strength among its claims" gives the first word; the drill-down is unruled |
| B-070 (browser runtime packaging) | the browser runtime packaged | Still needed, acceptance stream: "The launchers we ship" | "The browser launcher is one bundle" is ruled; packaging for a browser is open in "How extensions are distributed" |
| B-071 (input and output capabilities) | files, network, processes, sockets and timers | Still needed, acceptance stream: "The launchers we ship" | split: "The terminal and the browser ship output, timers and HTTP" covers timers and HTTP; files, processes and sockets are open there |
| B-072 (code generation) | expression graphs emitted as JavaScript | Dissolved | "A target platform is a model, and export is a transformation into it", which names JavaScript first |
| B-073 (continuation-based tail calls) | tail calls by continuations | Dissolved | "Tail calls by sentinel and loop" rules the sentinel |
| B-074 (opt-in memoization) | memoization as an opt-in standard feature | Stopped by the freeze | it waits on representation data of the present tree; milestone 3's speed tests are the data for the new one |
| B-075 (a tokenizer layer) | a tokenizer under the parser | Dissolved | "Scannerless parsing" rules that there is no tokenizer |
| B-076 (a self-hosted parser) | the standard parser through a parser generator | Dissolved | "The platform's parser engine ships already built", with no parser generator; milestone 8 |
| B-077 (a self-hosted type and module system) | the type system and the module system written in Allegro | Dissolved | "Everything above the kernel is an extension, and there is one way to extend" |
| B-078 (module versions and a registry) | versions, compatibility, dependency resolution, a registry | Still needed, acceptance stream: "Saved programs and export" | "How extensions are distributed" is ruled as open |
| B-174 (the book's existing chapters retrofitted to IR) | every chapter of the book with its IR | Another session's | the review session's item |
| B-151 (the planning pilot) | the planning language's remaining stages | Still needed, acceptance stream: "Plans as outcome graphs" | the chapter's decisions are held; the model specification chunk specifies it and milestone 7 ports it |
| B-160 (Bits decoded per member lookup) | decoded text interned to save lookups | Stopped by the freeze | a performance fix in code due for replacement |
| B-161 (CLI startup) | the CLI's module-loading cost cut | Stopped by the freeze | a cost of the present CLI; the new launcher may meet it again and would file it then |
| B-080 (Vivace language candidates) | the roster of domain languages after the pilot | Still needed, acceptance stream: "Models" | no decision chooses the roster; after milestone 7 |
| B-081 (counterexample legibility) | the refused value rendered, its call-site origin, the `inspect` channel | Dissolved | "Every failure carries a legible counterexample", with "A predicate can explain its refusal" and "Every value keeps its origin" |
| B-082 (model composition patterns) | cross-domain predicates and arbitration between models | Still needed, acceptance stream: "Models" | "Two models relate only through a declared mapping" is a design to prove; the software system model tests it |
| B-083 (the AI iteration loop) | failure modes an agent can use: residuals, surfacing, time boxes | Still needed, acceptance stream: "Tools" | the mechanism is ruled in the chapter; whether the failures are usable is evidence owed at milestone 7 |
| B-084 (constraint-set completeness) | research with organisations on their processes | Still needed, outside the rebuild | research; it can proceed |
| B-085 (bootstrap economics) | the value of Vivace against a model's maturity | Still needed, outside the rebuild | a roadmap question; it can proceed |
| B-086 (escape-hatch awareness) | a tool that notices a proposer cycling on one rule | Still needed, acceptance stream: "Tools" | no decision names it; it reads the loop's results |
| B-098 (predicate propagation onto residuals) | a residual's predicates computed from its operands | Dissolved | "A field's rule is a pure, bounded function" computes every field on every result, a residual included |
| B-100 (soundness review of the cutoff) | the cutoff's soundness and an honest limit for the checker | Dissolved | "A recursive call is evaluated once for each state of knowledge" replaces the cutoff; the limit is "Evaluation stops early for two reasons only" |
| B-099 (project severity configuration) | per-project severities and `total` by default | Dissolved | "Nothing is a claim until someone makes it": severities are removed and a project may make claims wholesale |
| B-103 (the suite's registration count) | CI failing when the suite's size changes | Stopped by the freeze | a check on the present suite; the corpus check gives every test exactly one case |
| B-102 (a stale scan exclusion) | a dead entry removed from the boundary scan | Stopped by the freeze | a tidy-up |
| B-104 (retire the dunder convention) | the binding-plane slots renamed without the `__` prefix | Stopped by the freeze | a rename in code due for replacement; the new tree has no prefixed slot |
| B-105 (union types) | union types redesigned or left retired | Still needed, kernel stream: "Types as values" | no decision of Part IV names unions; whether they return is unruled |
| B-110 (the evaluator implements the type system) | the type system out of the evaluator | Dissolved | "Everything above the kernel is an extension, and there is one way to extend"; one class for every failure goes with "Evaluation stops early for two reasons only" |
| B-111 (field versus channel) | one registration for a field, another for a capability | Dissolved | "An extension registers its own fields; the kernel has two" |
| B-112 (the four plane interfaces) | the evaluator's four hooks into the type layer | Dissolved | "An extension is made of functions and metadata fields" removes the installed hooks; what remains was B-146 (knowledge propagation) |
| B-113 (tail-call forwarding by convention) | a check that wrappers forward the tail-call sentinel | Dissolved | "Tail calls by sentinel and loop", with "A body clause is a notation", which removes the wrappers |
| B-114 (completion confluence) | arrival order shown not to matter | Dissolved | "The same program and the same information give the same result", a design to prove |
| B-115 (law backings on two carriers) | one carrier for what a proof rests on | Dissolved | "Law strengths and the transitivity gate", with "Every result says how strongly it holds" |
| B-116 (an interface's two guarantees) | a method body on an interface refused or stated | Still needed, kernel stream: "Refinement types" | "An interface is a type drawn from, not instantiated" holds the silent discard as a note and does not rule it |
| B-117 (the verdict assembled out of band) | the verdict read from accumulated metadata | Dissolved | "Every result says how strongly it holds"; an undefined function is a refutation by "A refutation marks everything computed from it" |
| B-118 (four carriers on the host plane) | inferred effects, domains, function analyses and backings as metadata fields | Dissolved | "An extension registers its own fields; the kernel has two" |
| B-119 (`Context` names three things) | the remaining `Context` names renamed | Stopped by the freeze | a rename in code due for replacement |
| B-123 (the metadata base surface) | an unguarded reader and five legacy primitives removed | Dissolved | "The kernel's primitives are pure and few"; the reader's guard goes with "The `Y of x` component-access form", where reading is free |
| B-124 (the guard-coverage audit) | every path to a guarded operation tested for its guard | Dissolved | "Authority is an unforgeable value": holding the value is the authority, so no path has a separate guard |
| B-126 (`param.owner` as a flag) | the owner pointer replaced by what it means | Dissolved | "Positional parameters owned by membership" |
| B-128 (layer separation policed) | the representation unreachable, one spelling per plane question | Dissolved | "Each decision lives in one replaceable unit of code", which holds the forbidden imports as a finding |
| B-129 (registers brought to uniform rows) | the backlog, decisions and changelog rewritten to row shape | Still needed, outside the rebuild | editorial; it can proceed once the follow-up of this chunk has closed the items it closes |
| B-130 (the design corpus's editorial pass) | the prose rules applied to the design documents | Still needed, outside the rebuild | the documents describe the present tree and `docs/book/**` is the review session's; it waits for the rebuild |
| B-171 (the pipeline chapter's two findings) | three unit moves owned; a failed return type halting | Dissolved | "Type annotations on parameters and returns" holds the halt; the unit moves are tidy-ups stopped by the freeze |
| B-175 (the tooling chapter's findings) | eleven defects in the CLI and its documents | Dissolved | "A command is a configuration", with "Every program is evaluated the same way, however it arrives", "Open obligations are listed for any proposer" and "A module's summary is the weakest strength among its claims"; item 8 is B-065 (REPL improvements), the rest tidy-ups |
| B-176 (the host chapter's findings) | five defects in the bundle, the sandbox and the host rules | Dissolved | "The browser launcher is one bundle", with "The core runs in a browser" and "A value that arrives later fills a cell, and a failure fills it with an exception"; items 1 and 2 landed |
| B-177 (the demo ladder chapter's findings) | eight defects in the demos, their pins and documents | Corpus case, milestones 5 and 6 | the scenes become scenarios with stated findings; the drift in the present files stops with the freeze; item 7 goes to the model specifications |
| B-180 (recursion handling under partial evaluation) | a review of how a recursive call is evaluated | Dissolved | "A recursive call is evaluated once for each state of knowledge", a design to prove first in the kernel's evaluation chapter |
| B-181 (the hard-coded precompile and compile-time phases) | the two fixed phases reviewed | Dissolved | "Phases are configuration", with "The platform ships three phases: check, run and export" |
| B-182 (unit tidy-ups from the book pass) | the hand-off for tidy-ups | Another session's | the review session's item |
| B-188 (a recursive binding or a library-named list stalls the precompile or the load) | two programs that should load in under a second | Corpus case, milestone 3 | the plan names the recursion findings as cases of the evaluation chapter; the planning library's half again at milestone 7 |
| B-189 (a self-applied function exhausts the JS stack) | a self-applied walk that overflows three levels down | Corpus case, milestone 3 | a recursion finding of the evaluation chapter |
| B-190 (name capture) | a library's free names resolved where it was defined | Corpus case, milestone 6 | no decision says where a library function's free names resolve; "Symbol identity is a fully-qualified name" is the nearest; the probe needs the units library |
| B-191 (a trailing block comment breaks the dedent) | a block comment after a block's last line parsed | Corpus case, milestone 8 | a defect of the present engine that the parser engine written in Allegro must not have |
| B-192 (the backing union of an induction and a `by` proof) | an induction and a `by` proof carrying all they rest on | Dissolved | "Every result says how strongly it holds": a result resting on a weaker one is reported at the weaker strength |
| B-193 (`by` read as a unit inside a proposition) | `2 > 1 by chain` parsed under the units notation | Corpus case, milestone 6 | "Guards and reserved words separate keywords from identifiers" and "Ambiguity is a claim" bear on it; neither says the case parses |
| B-194 (one vocabulary of four strengths in the planning loop) | the planning loop written in the four strengths | Dissolved | "Four strengths, one vocabulary"; the loop's stream closed, and the model specifications write in the four words |
| B-195 (the rebuild program) | the rebuild | Another session's | the rebuild's own item |
| B-196 (the rebuild's acceptance side) | the acceptance stream | Another session's | the rebuild's own item |
| B-197 (evidence against a ruled decision) | the hand-off to the review session | Another session's | the rebuild's own item |
| B-198 (first out-of-scope finding of the acceptance stream) | a placeholder | Another session's | the rebuild's own item |
| B-199 (second out-of-scope finding of the acceptance stream) | a placeholder | Another session's | the rebuild's own item |
| B-143 (immutability enforced) | a finished structure refusing an in-place write | Dissolved | "Structures immutable by default; derive, never mutate" |
| B-144 (a check on what is ready) | blockers as data, and a list of ready items | Still needed, outside the rebuild | process tooling for the backlog; it can proceed |
| B-145 (type vocabulary) | base primitives that name no type | Dissolved | "Everything above the kernel is an extension, and there is one way to extend", which holds the privileged primitives as a finding |
| B-146 (knowledge propagation) | the evaluator no longer running the type layer's propagation | Dissolved | "A field's rule is a pure, bounded function"; effect inference goes with "An effect is the use of a capability" |
| B-147 (diagnostics) | findings emitted as data and rendered above the kernel | Dissolved | "Everything above the kernel is an extension, and there is one way to extend" |
| B-148 (a phase-scoped mutable global) | a module-level flag toggled around law instantiation removed | Stopped by the freeze | a defect in code due for replacement that no decision names |
| B-142 (seven form-audit violations) | two dangling links and two plan status lines fixed | Still needed, outside the rebuild | documents; it can proceed |
| B-132 (parse-time contexts as literals) | parse-time contexts built through the factories | Stopped by the freeze | a tidy-up in code due for replacement |
| B-135 (a rule for the host plane) | a rule for what a host property may answer, and an audit | Stopped by the freeze | an audit of the present types; the kernel's interface file states the new types |
| B-136 (scope leaves `Value`) | the environment given its own representation | Dissolved | "The environment is not a value" |
| B-137 (weak typing in the host) | every `any` removed from the host implementation | Stopped by the freeze | a tidy-up in code due for replacement |
| B-138 (the module boundary's interface) | the typed module object out of the loading file | Dissolved | "A module is an extension that arrives as a file", with "Imported modules are typed objects whose type encapsulates" |
| B-139 (construction's two outcomes) | a construction surface that states its outcome | Dissolved | "Constructing a refined value claims its predicate": a failed construction is a refutation |
| B-140 (one surface for declared constraints) | the four constraint checks behind one surface | Dissolved | "Correctness and safety are one kind of claim": no kind of claim has a checker of its own |
| B-141 (an environment interface) | hosts swapped through a stated interface | Dissolved | "The terminal and the browser ship output, timers and HTTP", which holds the interception as a finding |

**The counts.** 117 open items.

| Class | Items |
|---|---|
| Dissolved | 49 |
| Corpus case | 6 |
| Still needed, kernel stream | 18 |
| Still needed, acceptance stream | 18 |
| Still needed, outside the rebuild | 6 |
| Stopped by the freeze | 13 |
| Another session's | 7 |

**The kernel stream's share**, by chapter of the inventory:

- "Values": B-046 (configurable mutability).
- "Evaluation": B-047 (sync and async modifiers).
- "Changing the grammar": B-037 (embeddable grammars).
- "Types as values": B-041 (typed collections), B-042 (a scalar type
  builder), B-050 (variance and type constraints), B-105 (union types).
- "Refinement types": B-116 (an interface's two guarantees).
- "Reaching a member": B-040 (qualified import and re-exports).
- "The surface language": B-043 (keyword type declarations), B-044 (an
  error handling surface), B-045 (regular expressions).
- "Claims and proofs": B-053 (a provable standard library).
- "Equality and laws": B-089 (lawful-interface follow-ons).
- "Effects": B-048 (algebraic effects), B-051 (the roadmap remainder
  revalidated).
- "Contracts": B-049 (patterns with unification), B-057 (contracts
  polish).

**The acceptance stream's share**, by chapter of the inventory:

- "Models": B-080 (Vivace language candidates), B-082 (model
  composition patterns).
- "Plans as outcome graphs": B-151 (the planning pilot).
- "Configuration": B-059 (a project root file).
- "Saved programs and export": B-063 (tree shaking), B-078 (module
  versions and a registry).
- "Tools": B-054 (a proof catalog), B-055 (parallel prover
  orchestration), B-056 (prover budgets and escalation), B-064 (tracing
  and stepping), B-065 (REPL improvements), B-066 (expression-graph
  processing), B-067 (editor integration), B-068 (review by semantic
  summary), B-083 (the AI iteration loop), B-086 (escape-hatch
  awareness).
- "The launchers we ship": B-070 (browser runtime packaging),
  B-071 (input and output capabilities).

**The corpus cases**, by milestone: milestone 3, B-188 (a recursive
binding or a library-named list stalls the precompile or the load) and
B-189 (a self-applied function exhausts the JS stack); milestones 5 and
6, B-177 (the demo ladder chapter's findings); milestone 6, B-190 (name
capture) and B-193 (`by` read as a unit inside a proposition); milestone
8, B-191 (a trailing block comment breaks the dedent).

## Terms introduced

Each names a class of this record. The asks request their ratification
or striking.

- **Dissolved**: a ruled decision covers the item's need or removes
  what it is about; the item closes with a pointer to that decision,
  and the decision map tracks the work.
- **Corpus case**: the item reports a behaviour of the present tree that
  the new kernel must get right and no single decision settles; it stays
  open as a case of the acceptance corpus.
- **Still needed, kernel stream**: work the rebuild needs that falls in
  Parts II to IV or the kernel's interface.
- **Still needed, acceptance stream**: work that falls in Part V or the
  rest of Part VI.
- **Still needed, outside the rebuild**: process, documentation, release
  or research work that the rebuild neither covers nor blocks.
- **Stopped by the freeze**: work on code due for replacement that no
  ruled decision names and the new tree does not need; the item closes
  as not done.
- **Another session's**: an item of the review session or of the
  rebuild itself, listed and not classed.
