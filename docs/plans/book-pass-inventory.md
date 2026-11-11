# The decision inventory: every decision of Allegro, in book order

> Working material of the book pass, chunk P1 ([book-pass.md](book-pass.md) §5, "The re-scoped front"). Built by merging three fragments, written read-only from the repository: the thesis and L0 (97 entries), L1 and L2 (95), and the surface language, Vivace, the tracks and the thesis test (92). Duplicates were merged, guessed dependency names resolved, cycles broken and significance calibrated to one scale; the notes on each merge are a separate working file of the pass. Each entry keeps the fragment's form and adds the chapter it belongs to.
>
> Counts: 256 decisions after DR1's rulings of 2026-11-11 (Part I: 23, with a thesis statement; the breakdowns below are those of the merge and are recounted when phase 1 ends). Counts at the merge: 256 decisions; 257 after the maintainer's rulings of 2026-11-05 added one (see "Rulings on the inventory"); 256 after chunk P1b (the decision types) merged two into one (see "The type check, 2026-11-05"). By type: capability 202, implementation 54. By significance: 5: 10, 4: 52, 3: 99, 2: 83, 1: 12. By label: foundational 100, swappable 156. By status: settled 176, partly built 42, open 37, and one settled in principle and partly built ("Order of definition carries no meaning"). Proposed contents: 6 parts, 33 chapters after the preface and the tour. Date: 2026-11-03; types added 2026-11-05.

Ids appear in this file only as data: in the Sources lines, and in the Notes where a fragment cited them. The identifier key at the end names each one.

## The proposed table of contents

The order binds by dependency: every decision comes after the decisions it depends on, and no decision depends on a later chapter. Within a chapter, among decisions with no dependency between them, the more significant comes first. Chapters keep tightly related decisions together, so significance breaks ties inside a chapter and between chapters only where dependency leaves the choice free.

**Front matter**

- **How this book is organized** (the preface, as merged). Holds the organization the book follows; it presents no decision.
- **Ten choices that define Allegro** (the tour). Tells the ten significance-5 decisions as one story, each pointing forward to its chapter: Everything above the kernel is an extension, and there is one way to extend (Keep it simple); One operation: partial evaluation (Keep it simple); Correctness and safety are one kind of claim (Keep it simple); Claims are evaluated like everything else (Keep it simple); The kernel trusts only what it has evaluated (Keep it simple); One value universe (Values and their seven kinds); Metadata is a field on every value (Metadata and the capability to write it); Evaluation is total over unresolved information (Evaluation over unresolved information); Types are values that constrain values (Types as values); Refinement types (Refinement types). Draws on [README.md](../../README.md) what Allegro is, [vision.md](../book/vision.md) §1, §2.

**Part I: The bet**

Chapters 1 and 2 as ruled in DR1 (2026-11-11), with the titles the maintainer gave on PR #185; all wording is reviewed for style in a later pass. The part opens with the thesis statement "Why a new language, now", which is not a decision. The demo ladder and the three-part positioning are narrative, told in the tour.

1. **Why a new language** (10 decisions). Why Allegro exists, and the platform that follows from it: trust from the kernel, domain languages that grow, one way to extend, a kernel with no language.
   - Decisions: Trust comes from the kernel, not the author; A system is described in the language of its domain, and that language grows with the understanding; Everything above the kernel is an extension, and there is one way to extend; The kernel contains only what no extension could supply; Meaning comes before notation; The kernel holds no language; Order of definition carries no meaning; A language inherits every check of what it is built on; A mapping between models is itself a checked value; A paradigm is a library.
2. **Keep it simple** (13 decisions). Partial evaluation as the one operation; phases, claims, effects and trust stated in its terms; host code and optimization; the code's units.
   - Decisions: One operation: partial evaluation; Phases are configuration; Claims are evaluated like everything else; An effect consumes only values whose claims are decided; Correctness and safety are one kind of claim; The kernel trusts only what it has evaluated; Anyone may propose, and the record shows who; A decided claim can be translated into a proof an outside checker accepts; Host code reaches a program only as a capability; No interface limits optimization; Every result says how strongly it holds; From experiment to proof without rewriting; Each decision lives in one replaceable unit of code.
Chapter 3 of the first proposal is dissolved: its decisions are folded into chapters 1 and 2 (DR1). The chapter numbers of Parts II to VI below are those of the first proposal and are renumbered when phase 1 ends.

**Part II: Allegretto, the kernel**

4. **Values and their seven kinds** (8 decisions). Everything is a value of one of seven fixed kinds, and the base offers a small set of primitives over them.
   - Decisions: One value universe; Seven representation kinds; Kind is a host discriminant, not a type; Value as a contract, seven kind units and an assembly; Bits is the only scalar; Minimal base surface of about forty primitives; The discriminator rule for kind comparisons; Scalar encodings inside Bits.
   - Draws on: [units.md](../book/units.md) §3, §3.2, [concepts.md](../book/concepts.md) T0 §1 to §3, §8, [allegretto/README.md](../book/allegretto/README.md) the minimal base, [allegretto/structures.md](../book/allegretto/structures.md) §11, Appendix B, Value, the kinds and the assembly (planned), [allegretto/evaluator.md](../book/allegretto/evaluator.md) §2 (the default arm), Futures and the base primitives (planned).
5. **Expressions, functions and symbols** (8 decisions). Unevaluated applications are values forming a DAG; functions are data; symbols are identified by fully-qualified name.
   - Decisions: Expressions are values, forming a DAG; Symbol identity is a fully-qualified name; Host functions as values with declared evaluation control; Expressions memoize per evaluation context; Positional parameters owned by membership; Functions are data: params plus body; Transient reference symbols resolved by base name; Symbols interned by FQN.
   - Draws on: [concepts.md](../book/concepts.md) T0 §4 to §7, [allegretto/structures.md](../book/allegretto/structures.md) §5, Value, the kinds and the assembly (planned).
6. **Structures** (8 decisions). The one composite kind, how its entries are laid out, how it is constructed, and why it is immutable.
   - Decisions: One composite kind: Structure; Structures immutable by default; derive, never mutate; Arrays are structures with unkeyed entries; The composite is one sequence of optionally-keyed entries; Untyped structures allowed in Allegretto; Construction only through factories, one host class; Binding state belongs to the binding, not the value; Empty array and empty record are not told apart at L0.
   - Draws on: [concepts.md](../book/concepts.md) T0 §9, §12 to §14, [allegretto/structures.md](../book/allegretto/structures.md) §1, §2.
7. **Metadata and the capability to write it** *(recommended pilot)* (13 decisions). Every value carries independent metadata fields, and only the holder of a field's writer may originate it.
   - Decisions: Metadata channels are independent; Metadata is a field on every value; Metadata fields registered with declared propagation rules; Authority is an unforgeable value; A field's rule is a pure, bounded function; Writes gated by a capability, reads free; Writers are closures: delegable, attenuable, unforgeable; No seal operation: constructor trust decomposes; Metadata supplied at construction, one attachment operation; Metadata slot mixed in from the metadata unit; Symbols serialise by FQN; deserialisation never mints reachability; One-shot field registration with a pass epoch; Evaluation stops early for two reasons only.
   - Draws on: [units.md](../book/units.md) §3.1, [concepts.md](../book/concepts.md) T2 §19, §19b, §21, [allegretto/structures.md](../book/allegretto/structures.md) §3, Appendix C, [allegretto/metadata-and-capability.md](../book/allegretto/metadata-and-capability.md) §1 to §4, §6, §9.
8. **How metadata propagates** (7 decisions). The fixed vocabulary by which fields travel through evaluation, errors as a viral field, the source field, and which layer registers what.
   - Decisions: Primitives receive full values; How the base applies propagation; A failure a program can handle is supplied by an extension; The source field: an expression as metadata; Each layer registers its own fields; Field versus channel, and channel registration; Subsumption of legacy primitives into channel operations.
   - Draws on: [concepts.md](../book/concepts.md) T2 §20, [allegretto/metadata-and-capability.md](../book/allegretto/metadata-and-capability.md) §5, §8.
9. **Four planes** (5 decisions). Where each kind of information about a value lives, and the sanctioned interfaces that reach each plane.
   - Decisions: Four planes and the placement rule; Plane interfaces are sanctioned and policed; Engine meta slots retired into registered members; The data plane has no accessor; Where the host plane is declared.
   - Draws on: [architecture-vocabulary.md](../book/architecture-vocabulary.md) plane, [concepts.md](../book/concepts.md) T1 §11, §18, §22, [allegretto/structures.md](../book/allegretto/structures.md) Appendix A, [standard/type-system.md](../book/standard/type-system.md) §4.
10. **Installing a layer into the base** (10 decisions). How a layer gives the base meaning through gated installs and hooks without the base importing it, and the crossings still open.
   - Decisions: An extension is made of functions and metadata fields; An extension is made of functions and metadata fields; An extension is made of functions and metadata fields; An extension is made of functions and metadata fields; An extension is made of functions and metadata fields; An extension is made of functions and metadata fields; Layers reach the base only through metadata and capability; An extension is made of functions and metadata fields; An extension is made of functions and metadata fields; Shared TypeScript types as representation leakage.
   - Draws on: [architecture-vocabulary.md](../book/architecture-vocabulary.md) plane interface, [concepts.md](../book/concepts.md) §23, §24, [allegretto/README.md](../book/allegretto/README.md) the install surface, [allegretto/metadata-and-capability.md](../book/allegretto/metadata-and-capability.md) §7, [allegretto/evaluator.md](../book/allegretto/evaluator.md) §7, §8.
11. **Scopes** (4 decisions). The evaluation environment, kept outside the value universe and layered by parent chain, with its facts plane.
   - Decisions: Scope is the evaluation environment, not data; Scope leaves the value universe; Scopes layer by parent chain; An extension is made of functions and metadata fields.
   - Draws on: [concepts.md](../book/concepts.md) §15, [allegretto/structures.md](../book/allegretto/structures.md) §4, Scope (planned).
12. **Evaluation over unresolved information** (11 decisions). Evaluation never stops on missing information: residuals, future cells, forward chaining, and the two partial-evaluation rules.
   - Decisions: Evaluation is total over unresolved information; PE Rule 1: residualise, but unfold composed calls; PE Rule 2: speculate every branch, run no effect; Incompleteness lives in write-once future cells; Evaluation resumes on new information by forward chaining; Determinism and confluence of evaluation; Substitution of params into bodies; Tail calls by sentinel and loop; One residualising resolution semantics for scopes; Evaluation stops early for two reasons only; Evaluation stops early for two reasons only.
   - Draws on: [concepts.md](../book/concepts.md) §25 to §29, [allegretto/structures.md](../book/allegretto/structures.md) §10, [allegretto/evaluator.md](../book/allegretto/evaluator.md) §2 to §6, Futures and the base primitives (planned).

**Part III: Syntax and modules**

13. **Grammars as values** (10 decisions). The grammar formalism: grammars as Allegro values, scannerless parsing, the memoized engine, precedence, layout and ambiguity.
   - Decisions: Grammars are Allegro values; Scannerless parsing; Ambiguity is banned and detected, not resolved by alternative order; Named, partially ordered precedence levels; Offside rule through stateful indent terminals; Guards and reservation sets separate keywords from identifiers; Parse failure reporting and recovery; Memoized recursive-descent engine with seed-growing left recursion; The precedence ladder runs as repetition, and memo invalidation tracks dependencies; Static analysis of grammars.
   - Draws on: [extension/README.md](../book/extension/README.md) the boundary, [grammar-formalism.md](../book/grammar-formalism.md) §1 to §5, §7, §8, [extension/grammar.md](../book/extension/grammar.md) §1, §2.
14. **Extending the grammar** (4 decisions). Grammar extension as operation deltas that never mutate the base, and the declarative grammar block.
   - Decisions: Grammar extension as operation deltas, extensible by default; Grammar extension never mutates the base; The declarative `grammar { … }` block with hygienic templates; Rules for user-written EBNF.
   - Draws on: [grammar-formalism.md](../book/grammar-formalism.md) §6, [extension/grammar.md](../book/extension/grammar.md) §4.
15. **Modules, the use header and one pipeline** (11 decisions). Extensions as the module substrate, one pipeline for libraries and programs, immutable library values, and how a file activates syntax.
   - Decisions: Extensions are the module substrate; Module loading and typed module objects are separate layers; Build pipeline as a track, not a layer; One evalSource pipeline for programs and libraries; `use` header for language extension, `import` for module values; Activation by a `use` header, per file and not transitive; Module resolution, caching and the session's runtime; A library's values are immutable after load; Execution contexts layer as a scope chain; Callers pre-scan and strip the `use` header; Conflicts are validated before activation.
   - Draws on: [layers.md](../book/layers.md) §2 (build pipeline as a track), [extension/grammar.md](../book/extension/grammar.md) §4 (activation), [extension/modules.md](../book/extension/modules.md) Loading, Loaded once per process, [platform/README.md](../book/platform/README.md) the build track, [platform/build-pipeline.ir.md](../book/platform/build-pipeline.ir.md) one pipeline, the `use` pre-scan.

**Part IV: Allegro Standard**

16. **Types as values** (12 decisions). Types are ordinary values that constrain values: the meta-type, kinds as types, conformance by member symbol, the core types and generics.
   - Decisions: Types are values that constrain values; Kinds are types, and Type is its own type; Members are keyed by symbol and conformance is membership; Every Standard value has a type, with no implicit fallback; One meta-type with an optional name; One construction surface; Loose conformance for data, selected by anonymity; The core type roster; Generics are memoized type constructors; Function types with bidirectional call-site unification; `distinct` mints a fresh-symbol newtype; The user-facing generics surface and parameter kinds.
   - Draws on: [concepts.md](../book/concepts.md) T3, [allegretto/structures.md](../book/allegretto/structures.md) §9, [standard/README.md](../book/standard/README.md) the boundary, [standard/type-system.md](../book/standard/type-system.md) §1, §2, §5, §6, [standard/core-types.md](../book/standard/core-types.md).
17. **Refinement types** (6 decisions). A refinement is a type plus a predicate; shape and knowledge are separate; inheritance dissolves into conformance, refinement and composition.
   - Decisions: Abstract domains as sound approximations; Refinement types; Shape and knowledge are separate; Declared inheritance dissolves into conformance, refinement and composition; Invariants are refinements; An interface is a type drawn from, not instantiated.
   - Draws on: [concepts.md](../book/concepts.md) T4, [allegretto/structures.md](../book/allegretto/structures.md) §6, [standard/type-system.md](../book/standard/type-system.md) §3 (refines), [standard/contracts.md](../book/standard/contracts.md) §5.
18. **Who can see a member** (6 decisions). Member access mediated by the type, privacy in two tiers, evidence as possession, and module objects whose type encapsulates.
   - Decisions: Mediated member access; Access is what a type's member lookup returns, in two tiers; Evidence is possession; Privacy across readers, reflection and mediation effects; Export marks the binding, and a module with no exports is open; Imported modules are typed objects whose type encapsulates.
   - Draws on: [language-reference.md](../book/language-reference.md) Private members, [extension/modules.md](../book/extension/modules.md) module objects, [standard/type-system.md](../book/standard/type-system.md) §3, §7.
19. **The surface language** (11 decisions). The spellings a programmer writes: declarations, conditionals, blocks, annotations, refinements, pattern matching, and the default language.
   - Decisions: Indentation blocks, with brace and offside both as the goal; Refinement types written `T & predicate` with `_` as the value; Function declarations with `=>`; Expression-valued `if then else` with thunked branches; The `Y of x` component-access form; Type annotations on parameters and returns; Statement forms that declare a binding; `when / is / then` pattern matching; Allegro Standard by default, Allegretto by flag; Combinators before keyword declaration syntax; String interpolation with braces.
   - Draws on: [language-reference.md](../book/language-reference.md), [grammar-formalism.md](../book/grammar-formalism.md) §5 (layout), [extension/grammar.md](../book/extension/grammar.md) §3, [standard/type-system.md](../book/standard/type-system.md) §3 (combinators), [standard/pattern-matching.md](../book/standard/pattern-matching.md) §1, §2.
20. **Proofs as values** (7 decisions). Propositions are expressions, proofs are values the kernel checks by evaluation, and the repertoire, primer and term contract provers use.
   - Decisions: Proofs are values discharged by evaluation; Theorems as statements, proved `by` a term; Discharge mechanisms without search; Bounded sampling for universal claims; Tactics as a pure Allegro library; One primer for human and machine provers; One proof-term contract for human and machine provers.
   - Draws on: [getting-started.md](../book/getting-started.md) The prover loop, [platform/tooling.ir.md](../book/platform/tooling.ir.md) C130, [proving-in-allegro.md](../book/proving-in-allegro.md) the proof model, strategies, output contract.
21. **Equality and laws** (4 decisions). Equality by shape, structural equality as the default, lawful interfaces and the tiers at which laws are discharged.
   - Decisions: Lawful interfaces; Equality dispatches on shape, then coerces, else not-equal; Kernel structural equality is the default; Law discharge tiers and the first strict gate.
   - Draws on: [allegretto/structures.md](../book/allegretto/structures.md) §7, §8, [proving-in-allegro.md](../book/proving-in-allegro.md) Laws, discharge tiers.
22. **Effects** (9 decisions). Effects as values in one lattice, inferred by partial evaluation, with declarations as contracts, and the effect surfaces still open.
   - Decisions: Effects are values in one lattice; Effect inference is driven by partial evaluation, and a declaration is a contract; Parameter effect bounds and explicit effect variables; Effects describe computations, refinements describe data; Labels for observing knowledge and scheduling; Redefining primitives and core types is banned; The `unsafe` hierarchy and safe wrappers; Member and parameterized effects; Open effect surfaces.
   - Draws on: [concepts.md](../book/concepts.md) T5, [standard/effects.md](../book/standard/effects.md).
23. **Contracts and the knowledge they give** (7 decisions). A contract is a predicate that becomes knowledge, carried on the value or in the scope, written as body-form clauses.
   - Decisions: A contract is a predicate that becomes knowledge, discharged by PE; Knowledge has intrinsic and occurrence carriers; Body-form clauses at the head of a body, lowered through one chain; Branch refinement narrows knowledge per region; Contract checks sit at function entry and return; Choosing among refinement, contract, assert and law; Unification and branch refinement in patterns.
   - Draws on: [standard/pattern-matching.md](../book/standard/pattern-matching.md) §3, [standard/contracts.md](../book/standard/contracts.md) §1 to §4, §6, §8.
24. **Termination and completion** (9 decisions). Divergence as a computed effect, completion as totality and liveness, the discharge spectrum and termination by bounded decrease.
   - Decisions: Divergence is a computed effect; Four-tier discharge spectrum; Completion is totality and liveness; Strict at the contract, informational for undeclared code; Termination by bounded decrease; Project severity configuration; Mutual recursion requires every edge to decrease; Totality polymorphism is effect polymorphism; Exhaustiveness checking at info severity.
   - Draws on: [concepts.md](../book/concepts.md) T5, [allegretto/structures.md](../book/allegretto/structures.md) §10, [standard/totality.md](../book/standard/totality.md) §1 to §5.
25. **When a check fails** (7 decisions). Which failures halt and which yield error values, purity gates, the construction guard, admitted assumptions, counterexamples and the verdict.
   - Decisions: Statement contracts halt, construction failure is an error value; Mechanical purity gates; The triggered construction guard; `assume` is the admitted tier, and the silent assume is retired; Every failure carries a legible counterexample; The verdict as accumulated metadata; Contracts in the verdict and the ledger.
   - Draws on: [standard/totality.md](../book/standard/totality.md) §5 (severity), [standard/contracts.md](../book/standard/contracts.md) §7, §10.

**Part V: Domains built on the kernel**

26. **Units of measure** (5 decisions). The second rung of the thesis test: dimensional analysis as a library of refinements, with literals and laws at honest tiers.
   - Decisions: Rung 2 domain: units of measure over state machines; Dimensions as data, named dimensions as refinements over one Quantity; Quantity laws at honest tiers; Number-anchored quantity literals; Conversion sugar with `in`.
   - Draws on: [demo-ladder.ir.md](../book/demo-ladder.ir.md) rung 2.
27. **Vivace: models as the program** (5 decisions). The application tier as a discipline over the kernel and a hypothesis tested by pilots.
   - Decisions: Vivace adds a discipline, not machinery; Vivace hypothesis: models as the review artefacts; Three different pilots, planning first; Shape 1 before Shape 2; Library before surface.
   - Draws on: [vision.md](../book/vision.md) §4, [vivace/README.md](../book/vivace/README.md).
28. **Plans as outcome graphs** (12 decisions). The planning pilot: outcome graphs, nodes, constraints, estimates and budgets, failure handling and enforcement.
   - Decisions: A plan is an outcome graph with derived wiring; Leaf and composite nodes, with `uses` to borrow a plan; Failure handlers over outcomes; Two enforcement shapes for a well-formed plan; A refinement predicate explains its own refusal; Planning surface conventions; Bracket constraints as refinements, named as predicate fixtures; Planning-local effort and money, durations from the units DSL; Estimates roll up, budgets are proved; Scheduling, resources, performers and latitude; Fan-in through an explicit aggregator node; Explicit `raise` and failure context in handlers.
   - Draws on: [vivace/planning-dsl.md](../book/vivace/planning-dsl.md) the model, conventions, enforcement.
29. **Finding solutions to a model** (6 decisions). Choices, templates, catalogs and search over a model, and composing models with an AI loop.
   - Decisions: Choices, templates and solution finding by enumeration; Completion from a catalog; Library search over kernel residuals; Composition of models and the AI loop over a model; Mixed-model solution finding as the capstone; Search beyond enumeration.
   - Draws on: [vivace/planning-dsl.md](../book/vivace/planning-dsl.md) choices, catalogs, search, [demo-ladder.ir.md](../book/demo-ladder.ir.md) rung 3, the capstone.

**Part VI: Building and running programs**

30. **The build pipeline** (8 decisions). Precompile, the inline cutoff, the stage order of evalSource, registered post-passes and soft failure for verdict tools.
   - Decisions: Precompile before the evaluation loop; The evalSource stage order; Post-passes registered by layers; Definition and memo entries in the precompile context; Inline cutoff for recursive bindings; Effects deferred during precompile; Soft-fail evaluation for verdict tools; Evaluation and parse statistics as diagnostics.
   - Draws on: [layers.md](../book/layers.md) §2 (precompile), [allegretto/evaluator.md](../book/allegretto/evaluator.md) §3 (effects deferred, the cutoff), [standard/totality.md](../book/standard/totality.md) §7, §8 (the cutoff), [platform/build-pipeline.ir.md](../book/platform/build-pipeline.ir.md) precompile onward.
31. **Tools over the pipeline** (7 decisions). The command line, file runner, REPL, inspect, the safety grade, obligations and proposals, and debugging.
   - Decisions: Inspect reports only what the pipeline computed; Safety grade as the default verification surface; One command-line entry with subcommands; File runner as one evaluation with futures drained; REPL as successive evaluations over a persistent scope; Obligations and proposals as machine and human views; Execution tracing and step-through debugging.
   - Draws on: [getting-started.md](../book/getting-started.md) subcommands, [vision.md](../book/vision.md) §3, §6, [platform/tooling.ir.md](../book/platform/tooling.ir.md).
32. **Hosts: the terminal and the browser** (9 decisions). Environment capabilities, the host boundary, asynchronous host results, the browser-compatible core and the sandbox.
   - Decisions: Environment capabilities outside the base, effect-labelled; A stated host boundary in a host unit; Asynchronous host results arrive as future cells; Browser sandbox as an IIFE bundle with a library registry; A browser-compatible core; Liveness of host sources declared per source; Module loader takes its file reader from the host; Asynchronous I/O capabilities beyond timers and HTTP GET; Browser runtime packaging.
   - Draws on: Futures and the base primitives (planned), [standard/effects.md](../book/standard/effects.md) environment capabilities, [platform/host.ir.md](../book/platform/host.ir.md).
33. **Compiling beyond the interpreter** (4 decisions). Multi-phase builds, code generation from the expression graph, rewrites licensed by laws, and self-hosting.
   - Decisions: Multi-phase build as successive partial evaluation; Code generation from the expression graph, JavaScript first; Laws licence rewrites; Self-hosting and a package ecosystem.
   - Draws on: [vision.md](../book/vision.md) §6, [platform/README.md](../book/platform/README.md) undelivered tracks.

**The recommended pilot.** The plan names `metadata-and-capability.md` as the pilot. That chapter becomes chapter 7 of these contents, "Metadata and the capability to write it", with its propagation sections moving to chapter 8 and its install section to chapter 10. Chapter 7 is the recommended pilot. Of its thirteen decisions, eleven are settled and two partly built (the metadata slot as a mixin, and the fixed propagation vocabulary, whose `positional` rule has no path); none is open, so the review rules on presentation rather than on open design. It sits early, after only the thesis and three short kernel chapters, so the concepts it needs (value, kind, structure, immutability) come from chapters the pilot's author can point to without rewriting them. It holds both labels (foundational channels and origination; swappable registration and denial details), so the swappable and foundational marks get tested. Its present text is one chapter already organized by unit, which keeps the rewrite to one source file.

## Findings held for their decisions

A **held finding** is a defect a review finds in a decision the pass has not reached in order. It is recorded on the decision's entry below, as a "Held finding" note, and fixed in the chapter PR that takes the decision (`book-pass.md` §2.7), not handed to another stream; ruled 2026-11-10. A finding that cannot wait for its chapter goes to the maintainer as an ask.

| Finding | Decision | Chapter | Source |
|---|---|---|---|
| A second viral field erases the first | Metadata channels are independent | Metadata and the capability to write it | the pilot's review, §7 item 1 |
| `channel_register` accepts any rule string | A field's rule is a pure, bounded function | Metadata and the capability to write it | the pilot's review, §7 item 2 |
| A user-registered viral field stops computation | How the base applies propagation | How metadata propagates | the pilot's review, §7 item 3 |
| The ownership test never checks owners | Each layer registers its own fields | How metadata propagates | the pilot's review, §7 item 4 |
| Termination and exhaustiveness are privileged host passes | Termination by bounded decrease; Exhaustiveness checking at info severity | Termination and completion | DR1, rulings of 2026-11-11 |
| `print` is a base primitive | Minimal base surface of about forty primitives; Environment capabilities outside the base, effect-labelled | Values and their seven kinds; Hosts | DR1, rulings of 2026-11-11 |
| Phases are hard-coded in the pipeline | Multi-phase build as successive partial evaluation; Precompile before the evaluation loop | The build pipeline; Compiling beyond the interpreter | DR1, rulings of 2026-11-11 |
| A failed return type does not halt | Type annotations on parameters and returns | The surface language | DR1, rulings of 2026-11-11 |
| A refuted proof halts only after the program has run | One evalSource pipeline for programs and libraries | Modules, the use header and one pipeline | DR1, rulings of 2026-11-11 |
| Effects are not gated on decided claims | Environment capabilities outside the base, effect-labelled; A failure a program can handle is supplied by an extension | Hosts; How metadata propagates | DR1, rulings of 2026-11-11 |
| The standard language is host code holding writers; install operations, the `typed` flag, grammar lowering and 54 primitives are privileged | the decisions of Parts II to IV named on "Everything above the kernel is an extension, and there is one way to extend" | several | DR1, rulings of 2026-11-11 |
| The platform with no extension loaded cannot load one | the CLI's decisions | Tools over the pipeline | DR1, rulings of 2026-11-11 |
| Installed hooks are opaque to partial evaluation | An extension is made of functions and metadata fields | Installing a layer into the base | DR1, rulings of 2026-11-11 |
| The separate effects checker | the effects decisions | Effects | DR1, rulings of 2026-11-11 |
| Authorship is not kept in the verdict | Obligations and proposals as machine and human views | Tools over the pipeline | DR1, rulings of 2026-11-11 |
| Three strength vocabularies; `proven` names a sampled check and is absent from the verdict; `proven-safe` and "Verdict (verified)" overstate | Bounded sampling for universal claims; Safety grade as the default verification surface; The verdict as accumulated metadata | Proofs as values; Tools over the pipeline; When a check fails | DR1, rulings of 2026-11-11 |
| The return check reports a conforming refined return as a mismatch | Type annotations on parameters and returns | The surface language | DR1, rulings of 2026-11-11 |
| A name bound twice wins silently; implicit production replacement; ordered choice | the grammar, module and binding decisions | Parts III and IV | DR1, rulings of 2026-11-11 |
| Forbidden imports, mixed files and kind comparisons outside their units | Each decision lives in one replaceable unit of code | Keep it simple | DR1, rulings of 2026-11-11 |

The pilot's review is [p2-allegretto-metadata-and-capability.md](../records/book-pass/p2-allegretto-metadata-and-capability.md).

## Rulings on the inventory, 2026-11-05

The maintainer's comment on PR #163 ruled the proposal. In short, with [book-pass.md](book-pass.md) §6, "Rulings taken 2026-11-05", as the record:

- **The contents have the right shape.** They are working placeholders. The tour becomes a significant conceptual journey: it lays out the shape of Allegro (a minimal kernel, extension, the type philosophy, maximal domains, and Allegro in use: execution, tooling, pipelines), with reasoning that establishes the kernel's requirements and features, prefiguring the later chapters. It will likely conclude with the ten choices listed above, or very similar ones. "The bet" is a placeholder too, and incomplete; more detail comes in later discussion.
- **The pilot** is "Metadata and the capability to write it".
- **The chapters leaving the book** leave as proposed. Units and layers are discussed early as architectural principles, in appendices, not chapters.
- **Every decision is worked through in order.** Any decision may change, be removed, or gain new neighbours, and the resulting code and test changes are made. The process is strictly monotonic: once a decision is approved and its code changes made, every decision up to it, and the code stemming from them, is final and correct. A point of non-monotonicity is a process failure: the pass goes back, reorders or revises, and repeats until the list is fully ordered and monotonic.
- **Two types of decision.** Each decision is about language capability or about implementation. No capability decision may depend on an implementation decision. The three cycles the merge broke looked like decisions whose type was unclear. Capability decisions that necessarily depend on each other are stated as one decision.
- **Order of definition carries no meaning.** A new decision, below in "Why a new language". The parser algorithm stays swappable, except that ordered choice must not be required; the shipped ordered choice is an expedient, to be replaced by GLL or a similar algorithm.
- **`eval_when` and PE Rule 2** need careful review and analysis; decisions may change to make them coherent and consistent.

Applied in chunk P1b (2026-11-05): every entry carries its type, 202 capability and 54 implementation decisions of 256. The check found 21 dependencies of a capability decision on an implementation decision, in 20 entries. In 19 the dependency was misread and now points at the capability the entry rests on, or is removed; one entry, "Post-passes registered by layers", is implementation and was retyped (2 edges). No entry was split. Two capability decisions that each state the other became one, "Incompleteness lives in write-once future cells". Four entries moved within their chapters. The record is "The type check, 2026-11-05", before the open questions.

## The author's motivations, for the tour

The maintainer's account of why Allegro exists, given on 2026-11-05 in the review session, recorded here for the tour to open from. It is not book text yet. The question the book poses and answers first: why a new programming language right when programming is becoming obsolete?

The motivations, in the maintainer's words, lightly condensed:

1. **Power from a small kernel.** A programming language's power is related to both the small size of its basic language and how much functionality can be delivered through extensions: a minimal kernel with maximal extensibility.
2. **Semantic model precedes syntax.** Language discussion focuses on syntax, and innovation is usually aesthetic evolution of syntax with tiny incremental changes in semantics. Decoupling semantics from syntax enables greater semantic exploration: form follows function, like a user interface.
3. **Model-driven engineering.** Many problem spaces simplify with declarative formal models and declarative mappings between them for specific functions: data models to user interfaces, phrase-structure grammars to semantic models, data transformations for analysis or business processes. Domain-specific languages were a key enabler, but development stalled when they remained informal and far poorer cousins of first-class languages.
4. **Declarative paradigms, for anyone.** Declarative paradigms are rarely adopted: each applies well to a narrow set of problems (data definition and retrieval, logic, constraints) and is hard to extend to broader real-world projects. Multi-language, multi-paradigm systems suffer inconsistent tooling and integration at compile time and run time. Earlier answers (object-relational mappers, several languages on one runtime) needed heavy investment from language and tool builders. The aim: give that capability to anyone.
5. **Reflection without the fire.** Code reflection, code transformation and access to a language's internal models connected all of these, and let tool builders and customisers work, but without consistent end-to-end type checking and validation.
6. **Formal and agile, in one practice.** A mathematician's fondness for formal proof, against an engineering leader's agile practice: the two in extreme tension, never close in practice. The aim: a synthesis, formal and experimental, scientific and practical.

They came together over years of exploration into most of what Allegro is today. Then the AI revolution promised, or threatened, to change everything.

**How they lead to the ten choices** (the review session's mapping, a proposal for the tour to test):

| Motivation | The choices it leads to |
|---|---|
| 1. Power from a small kernel | Programmable language platform; One value universe; Metadata on every value |
| 2. Semantic model precedes syntax | Programmable language platform (the parser above a syntax-free base); Types are values |
| 3. Model-driven engineering | Programmable language platform (a DSL inherits the whole kernel); Types are values; Refinement types |
| 4. Declarative paradigms, for anyone | Programmable language platform; One operation: partial evaluation (extensions cost nothing at run time); the new decision that extensions are declarative |
| 5. Reflection without the fire | One value universe (code is data); Metadata on every value; One predicate machinery for correctness and safety |
| 6. Formal and agile | Evaluation total over unresolved information; Refinement types; Claims are evaluated like everything else; the three-leg proof strategy |
| The AI revolution | Participant-neutral proving with recorded authorship; Every result says how strongly it holds; One predicate machinery: code written by anyone, checked the same way |

## Today's chapters, mapped

| Present chapter | Destination in the proposed contents |
|---|---|
| [preface.md](../book/preface.md) (How this book is organized) | Stays the preface, unchanged. Goes to: the preface. |
| [README.md](../../README.md) (Introduction) | Leaves the book's order: it stays the repository's front page; its account of what Allegro is feeds the tour. Goes to: the tour (what Allegro is). |
| [getting-started.md](../book/getting-started.md) (Getting started) | Leaves the narrative as a guide (appendix); its prover loop and compiler views feed three chapters. Goes to: Keep it simple (See what the compiler knows); Proofs as values (The prover loop); Tools over the pipeline (subcommands). |
| [language-reference.md](../book/language-reference.md) (Language reference, by example) | Leaves the narrative as a lookup aid (appendix); its spellings are the decisions of the surface-language chapter. Goes to: The surface language; Who can see a member (Private members). |
| [vision.md](../book/vision.md) (Vision and principles) | Redistributed: its bets become the tour and Part I's decisions. Tier 0: moving its text needs the maintainer's sign-off (Open questions). Goes to: the tour (§1, §2); Keep it simple (§1, §1a, §2, §5); Why a new language (§1 Substrate and surfaces, §1a, §5); Keep it simple (§1a move 2, §3, §5 principles 6 to 13); Vivace: models as the program (§4); Tools over the pipeline (§3, §6); Compiling beyond the interpreter (§6). |
| [process.md](../book/process.md) (Process and engineering guide) | Leaves the book: process detail (an appendix outside the order). |
| [architecture-vocabulary.md](../book/architecture-vocabulary.md) (Architecture vocabulary) | Dissolves: each term moves to the chapter that first uses it (layer and track in Part I, plane and plane interface in Part II); actor leaves with the actors study. Goes to: Why a new language (layer, track, unit); Four planes (plane); Installing a layer into the base (plane interface). |
| [layers.md](../book/layers.md) (Layers, tracks and milestones) | Split: the layer spine and tracks enter Part I and the pipeline chapters; milestones and the backlog's use of them leave the book (status). Goes to: Why a new language (§1); Modules, the use header and one pipeline (§2 (build pipeline as a track)); The build pipeline (§2 (precompile)). |
| [units.md](../book/units.md) (Units: the implementation as a narrow DAG) | Split: what a unit is and the DAG enter Part I and the kinds chapter; actors, moves and measurement leave the book (process). Goes to: Why a new language (§1, §2, §4, §5); Values and their seven kinds (§3, §3.2); Metadata and the capability to write it (§3.1). |
| [implementation-map.md](../book/implementation-map.md) (Implementation map) | Leaves the book: a file map (appendix); each chapter's as-implemented block points to its unit instead. |
| [actors-and-activities.md](../book/actors-and-activities.md) (Actors and activities (study)) | Leaves the book: a study (records). |
| [concepts.md](../book/concepts.md) (Concepts: requirements, specification and implementation choices, and the definitional spine) | Dissolves: Part 0's requirements and choices become decisions in Parts I and II; the spine's entries become concept definitions at their first use. Goes to: Keep it simple (Part 0 R1, R2); Why a new language (Part 0 R6, §23); Values and their seven kinds (T0 §1 to §3, §8); Expressions, functions and symbols (T0 §4 to §7); Structures (T0 §9, §12 to §14); Metadata and the capability to write it (T2 §19, §19b, §21); How metadata propagates (T2 §20); Four planes (T1 §11, §18, §22); Installing a layer into the base (§23, §24); Scopes (§15); Evaluation over unresolved information (§25 to §29); Types as values (T3); Refinement types (T4); Effects (T5); Termination and completion (T5). |
| [allegretto/README.md](../book/allegretto/README.md) (L0 Allegretto: boundary contract) | Dissolves into Part II: the boundary's invariants become the base's decisions. Goes to: Why a new language (the boundary); Values and their seven kinds (the minimal base); Installing a layer into the base (the install surface). |
| [allegretto/structures.md](../book/allegretto/structures.md) (Structures, scopes and channels) | Split across Parts II and IV: structure, channels, scope and symbols in Part II; shape and knowledge, equality, conformance and kinds-as-types in Part IV. Goes to: Values and their seven kinds (§11, Appendix B); Expressions, functions and symbols (§5); Structures (§1, §2); Metadata and the capability to write it (§3, Appendix C); Four planes (Appendix A); Scopes (§4); Evaluation over unresolved information (§10); Types as values (§9); Refinement types (§6); Equality and laws (§7, §8); Termination and completion (§10). |
| Value, the kinds and the assembly (planned) | Becomes the first two kernel chapters. Goes to: Values and their seven kinds; Expressions, functions and symbols. |
| [allegretto/metadata-and-capability.md](../book/allegretto/metadata-and-capability.md) (Metadata and capability) | Split: §1 to §4 and §6 become the pilot chapter; §5 and §8 the propagation chapter; §7 the install chapter. Goes to: Metadata and the capability to write it (§1 to §4, §6, §9); How metadata propagates (§5, §8); Installing a layer into the base (§7). |
| Scope (planned) | Becomes the scopes chapter. Goes to: Scopes. |
| [allegretto/evaluator.md](../book/allegretto/evaluator.md) (The evaluator) | Split: evaluation, the PE rules, substitution and tail calls stay together; the install surface goes to Part II's install chapter; precompile behaviour to the pipeline chapter. Its IR (`evaluator.ir.md`) travels with it. Goes to: Values and their seven kinds (§2 (the default arm)); Installing a layer into the base (§7, §8); Evaluation over unresolved information (§2 to §6); The build pipeline (§3 (effects deferred, the cutoff)). |
| Futures and the base primitives (planned) | Split: futures into the evaluation chapter, the primitives into the kinds chapter, environment capabilities into the host chapter. Goes to: Values and their seven kinds; Evaluation over unresolved information; Hosts: the terminal and the browser. |
| [extension/README.md](../book/extension/README.md) (L1 extension substrate: boundary contract) | Dissolves into Part III's opening. Goes to: Why a new language (the L1 boundary); Grammars as values (the boundary). |
| [grammar-formalism.md](../book/grammar-formalism.md) (The grammar formalism) | Becomes the grammars chapter, its extension sections the next one; worked examples move to an appendix. Goes to: Grammars as values (§1 to §5, §7, §8); Extending the grammar (§6); The surface language (§5 (layout)). |
| [extension/grammar.md](../book/extension/grammar.md) (Grammar and parser) | Split across Part III and the surface chapter. Goes to: Grammars as values (§1, §2); Extending the grammar (§4); Modules, the use header and one pipeline (§4 (activation)); The surface language (§3). |
| [extension/modules.md](../book/extension/modules.md) (Module loading and module objects) | Split: loading into the modules chapter, typed module objects into the visibility chapter. Goes to: Modules, the use header and one pipeline (Loading, Loaded once per process); Who can see a member (module objects). |
| [standard/README.md](../book/standard/README.md) (L2 Allegro Standard: boundary contract) | Dissolves into Part IV's opening. Goes to: Types as values (the boundary). |
| [standard/type-system.md](../book/standard/type-system.md) (The type system) | Split across the types, refinement, visibility and surface chapters. Goes to: Four planes (§4); Types as values (§1, §2, §5, §6); Refinement types (§3 (refines)); Who can see a member (§3, §7); The surface language (§3 (combinators)). |
| [standard/core-types.md](../book/standard/core-types.md) (Core types) | Joins the types chapter. Goes to: Types as values. |
| [standard/effects.md](../book/standard/effects.md) (Effects) | Becomes the effects chapter; environment capabilities go to the host chapter. Goes to: Effects; Hosts: the terminal and the browser (environment capabilities). |
| [standard/pattern-matching.md](../book/standard/pattern-matching.md) (Pattern matching) | Split: the spelling into the surface chapter, branch refinement into the contracts chapter. Goes to: The surface language (§1, §2); Contracts and the knowledge they give (§3). |
| [standard/totality.md](../book/standard/totality.md) (Totality and termination) | Becomes the termination chapter; the cutoff goes to the pipeline chapter. Goes to: Termination and completion (§1 to §5); When a check fails (§5 (severity)); The build pipeline (§7, §8 (the cutoff)). |
| [standard/contracts.md](../book/standard/contracts.md) (Contracts and invariants) | Split: the predicate model and body forms into the contracts chapter, invariants into the refinement chapter, failure semantics into the failures chapter. Goes to: Refinement types (§5); Contracts and the knowledge they give (§1 to §4, §6, §8); When a check fails (§7, §10). |
| [vivace/README.md](../book/vivace/README.md) (L3 Vivace: boundary contract) | Becomes the Vivace chapter. Goes to: Vivace: models as the program. |
| [vivace/planning-dsl.md](../book/vivace/planning-dsl.md) (The planning DSL: the first Vivace pilot) | Split: the model into the plans chapter, solution finding into the next. Goes to: Plans as outcome graphs (the model, conventions, enforcement); Finding solutions to a model (choices, catalogs, search). |
| [platform/README.md](../book/platform/README.md) (Capability tracks) | Dissolves into Part VI's opening and Part I's tracks. Goes to: Modules, the use header and one pipeline (the build track); Compiling beyond the interpreter (undelivered tracks). |
| [platform/build-pipeline.ir.md](../book/platform/build-pipeline.ir.md) (The evaluation pipeline) | Split: one pipeline and the `use` pre-scan into the modules chapter, the rest into the pipeline chapter. Goes to: Modules, the use header and one pipeline (one pipeline, the `use` pre-scan); The build pipeline (precompile onward). |
| [platform/tooling.ir.md](../book/platform/tooling.ir.md) (Tooling) | Becomes the tools chapter; verification claims go to Part I. Goes to: Keep it simple (C102 to C110); Proofs as values (C130); Tools over the pipeline. |
| [platform/host.ir.md](../book/platform/host.ir.md) (Host environments) | Becomes the host chapter. Goes to: Hosts: the terminal and the browser. |
| [proving-in-allegro.md](../book/proving-in-allegro.md) (Proving in Allegro) | Its decisions enter the proofs and laws chapters; the primer itself stays a guide (appendix) for provers. Goes to: Keep it simple (When PE-as-discharge isn't enough); Proofs as values (the proof model, strategies, output contract); Equality and laws (Laws, discharge tiers). |
| [demo-ladder.ir.md](../book/demo-ladder.ir.md) (The demo ladder and the rung-3 pilot) | Split: the ladder as the thesis test into Part I, the rungs into Part V. Goes to: Why a new language (the ladder); Units of measure (rung 2); Finding solutions to a model (rung 3, the capstone). |
| Appendices (registers and records) | Stay appendices, outside the order. |

## The decisions, in book order

### Why a new language

**The thesis of Part I, ruled 2026-11-11 (DR1).** Not a decision: the framing statement that opens the part, and what the tour argues at length.

> **Why a new language, now.** Writing code was never the hard part of building a system. The hard part is building a shared understanding of what the system is and should do, and keeping that understanding true as it changes. That is a theory, worked out in discourse among people, and now between people and machines. When machines write the code, the theory is what remains. A programming language is where a theory is written down precisely enough to be checked. Allegro is built for that job.

#### Trust comes from the kernel, not the author
- Decides: a program states its intent as claims. The kernel decides those claims by evaluation, whoever or whatever wrote the code. A reviewer reads what was claimed and what was decided, not every line.
- Status: partly built; ruled 2026-11-11 (DR1)
- Type: capability
- Rationale kind: vision
- Depends on: none
- Significance: 5 — the first answer to why a new language now
- Label: foundational — the claim, prover and review decisions rest on it
- Units: none of its own
- Options recorded: trust placed in the author, or in tests the author chose (the industry's default)
- Sources: docs/book/vision.md §1, §2 "Why both, why now"; the maintainer's motivations (above) and rulings of 2026-11-11 (../records/book-pass/dr1-part-1-the-bet.md, Rulings taken)
- Notes: new, by ruling; replaces the review's proposal "Built for code that machines write and a kernel checks", whose clause trading authoring ergonomics for checkability is dropped. Supports "A language inherits every check of what it is built on" and the two proposals still to rule (models and mappings as checked values; declarative paradigms as libraries).
- Chapter: Why a new language

- Notes (2026-11-11, chapter 3 folded in): absorbs the principle of "Reviewability through a top-down semantic view"; its concrete half (the safety grade, drill-down, semantic diffs) is read with "Safety grade as the default verification surface" in Part VI.
#### A system is described in the language of its domain, and that language grows with the understanding
- Decides: code and claims are written in the terms of a domain model, which people and agents can read far more easily than general-purpose code. Nothing is lost by this: a statement in a domain language is checked exactly as strictly as any other. No prewritten domain language is enough. As the people and agents building a system understand it better, they extend its language, and each new concept becomes vocabulary that the kernel checks from then on.
- Status: partly built; ruled 2026-11-11 (DR1)
- Type: capability
- Rationale kind: vision
- Depends on: Trust comes from the kernel, not the author
- Significance: 5 — the second answer: understanding, through domain languages built during the work
- Label: foundational — extension, surfaces, domain models and Vivace rest on it
- Units: none of its own
- Options recorded: fixed, prewritten domain languages (rejected: system development is theory building and discourse building, among people as much as between people and agents); general-purpose code with claims beside it
- Sources: the maintainer's motivations 2 to 4 (above) and rulings of 2026-11-11 (../records/book-pass/dr1-part-1-the-bet.md, Rulings taken); docs/book/vision.md §4
- Notes: new, by ruling. Supports "A language inherits every check of what it is built on" and the two proposals still to rule, as the first decision does.
- Chapter: Why a new language

#### Everything above the kernel is an extension, and there is one way to extend
- Decides: an extension adds values, functions, syntax, metadata fields and the rules that govern them through one interface. That interface is the same for the standard language and for a library a user writes. An extension is written in Allegro and checked like any other program. The standard language is a set of extensions selected by configuration. Nothing in the kernel names it.
- Status: partly built; ruled 2026-11-11 (DR1); to be fully built before release
- Type: capability
- Rationale kind: vision
- Depends on: none
- Significance: 5 — the platform bet: a small kernel whose power is what extensions can add
- Label: foundational — every surface, the standard language and every user library rest on it
- Units: none of its own
- Options recorded: two tiers, privileged host layers for the standard language and Allegro modules for users (what the code does today, adopted for want of an alternative; rejected, R38 (the purpose of the decision review) of book-pass.md); extensions containing host-language code behind an admitted tier (rejected: host code in the process can forge any analysis, so the label cannot be enforced)
- Sources: docs/book/vision.md §1, §5; docs/book/concepts.md R1, R9; the maintainer's rulings of 2026-11-11 (../records/book-pass/dr1-part-1-the-bet.md, Rulings taken)
- Notes: replaces "Programmable language platform: minimal core, extensions are the language". "Allegretto" is the platform with no extension loaded; "Allegro Standard" is a named configuration; `--base` and the `typed` flag are not concepts of the language. One interface is about the interface, not the implementation language; with host code excluded from extensions (next decision but two), the two coincide. "Self-hosting and a package ecosystem" is re-read against this in its part.
- Held finding (2026-11-11, DR1): the standard language's type system is host code holding writers, a trusted base larger than the kernel (`createTypeSystem`, `src/types-std.ts:4894`). Held on the decisions of Part IV that it realises.
- Held finding (2026-11-11, DR1): the install operations (merge, check, dispatch, projection, analysis) are host functions; Allegro has only `channel_register` (`src/capability.ts:96`–`144`). Held on "An extension is made of functions and metadata fields" and its neighbours.
- Held finding (2026-11-11, DR1): the `typed` flag of `evalSource` changes literal typing, wraps every primitive and turns on precompile; no extension can ask for these (`src/runtime.ts:150`–`160`, `1167`–`1174`). Held on "One evalSource pipeline for programs and libraries" and "Precompile before the evaluation loop".
- Held finding (2026-11-11, DR1): the base grammar and tree builder lower annotations and contracts to the standard language's primitives by name (`src/grammar2/base-grammar.ts:748`–`755`, `src/grammar2/tree-builder.ts:1384`–`1396`). Held on the surface-language and proofs decisions.
- Held finding (2026-11-11, DR1): 54 primitives of the standard language are in the kernel's one table (`src/runtime.ts:156`–`160`). Held on "Minimal base surface of about forty primitives".
- Held finding (2026-11-11, DR1): the platform with no extension loaded cannot load one: `use` is a parse error under `--base` (`src/index.ts:115`–`119`, `252`–`253`). Held on the CLI's decisions.
- Chapter: Why a new language

#### The kernel contains only what no extension could supply
- Decides: something belongs in the kernel only if the platform could not exist without it and no extension could provide it. Everything else is an extension.
- Status: settled; ruled 2026-11-11 (DR1)
- Type: capability
- Rationale kind: vision
- Depends on: Everything above the kernel is an extension, and there is one way to extend
- Significance: 4 — every kernel trade is judged by it
- Label: foundational — the kernel's contents rest on it
- Options recorded: a richer kernel for convenience (rejected)
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr1-part-1-the-bet.md, Rulings taken); docs/book/vision.md §1, §5
- Notes: replaces "Simplicity criterion for the base".
- Chapter: Why a new language

#### Meaning comes before notation
- Decides: a program's meaning is the structure of values and expressions it denotes. A syntax is a mapping onto that structure, and two notations that map to the same structure are the same program. Semantics are designed and decided without reference to any notation. A notation can therefore change without changing what any program means.
- Status: settled; ruled 2026-11-11 (DR1)
- Type: capability
- Rationale kind: vision
- Depends on: Everything above the kernel is an extension, and there is one way to extend
- Significance: 5 — frees semantic exploration from syntax
- Label: foundational — the kernel with no language, grammars as values and every surface rest on it
- Options recorded: a language defined by its syntax, semantics following (the common practice)
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr1-part-1-the-bet.md, Rulings taken); docs/book/vision.md §1, §5
- Notes: new, by ruling; from the maintainer's motivation 2.
- Chapter: Why a new language

- Notes (2026-11-11, chapter 3 folded in): absorbs "Surface syntax is provisional, reviewed against a corpus"; deprecation paths are a policy question for the surface chapter of Part IV.
#### The kernel holds no language
- Decides: the kernel is values, pure primitives, the evaluator, metadata with its capabilities, and the extension interface. It has no syntax. Every concrete syntax, the first grammar included, is an extension.
- Status: settled; ruled 2026-11-11 (DR1)
- Type: capability
- Rationale kind: vision
- Depends on: Everything above the kernel is an extension, and there is one way to extend; The kernel contains only what no extension could supply; Meaning comes before notation
- Significance: 4 — every surface form, the standard language's own syntax included, is an extension
- Label: foundational — grammar extension, module loading and every surface form rest on it
- Units: none (the boundary between the kernel and the first extension)
- Options recorded: some syntax as part of the bootstrap (rejected: no language in the kernel)
- Sources: docs/decisions.md "Standing rulings" (layer rulings 1 to 4); docs/book/allegretto/README.md; the maintainer's rulings of 2026-11-11 (../records/book-pass/dr1-part-1-the-bet.md, Rulings taken)
- Notes: replaces "Allegretto is syntax-free; the parser lives above the base"; the clause on re-hosting the parser on Vivace's generator is dropped, since it names no decision.
- Chapter: Why a new language

#### Order of definition carries no meaning
- Decides: the order in which definitions and extensions are written or loaded changes nothing. Two definitions that conflict are an error, reported before either is used. Replacing a definition is an explicit operation. Only effects have an order: plain effects are not declarations, and happen in the order the program writes them.
- Status: partly built; ruled 2026-11-11 (DR1)
- Type: capability
- Rationale kind: mixed
- Depends on: Everything above the kernel is an extension, and there is one way to extend
- Significance: 4 — every extension and every author of one depends on it
- Label: foundational — the parser algorithm, ambiguity detection and module loading rest on it
- Options recorded: ordered choice in the parser (shipped as an expedient, to be removed); a silent later-wins rule for a name bound twice (rejected: binding a name twice in one scope is an error, in function bodies as at the top level); an explicit ordering construct for top-level effects (rejected by the maintainer: any other mechanism for ordering effects would itself be a declaration)
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr1-part-1-the-bet.md, Rulings taken); docs/book/vision.md §1, §5
- Notes: replaces "Language extensions are declarative". Supersedes the standing ruling that an `add` over an existing production only warns.
- Held finding (2026-11-11, DR1): a name bound twice takes the later value silently; a fragment's `add` over an existing production replaces it with a warning (`src/grammar2/fragments.ts:154`–`168`); alternation is ordered choice (`src/grammar2/engine.ts:945`). Held on the grammar, module and binding decisions of Parts III and IV.
- Chapter: Why a new language

#### A language inherits every check of what it is built on
- Decides: every language on the platform is a set of extensions, the standard language included. A small domain language is therefore checked as strictly as the language it was built from. General-purpose and domain-specific languages differ only in breadth.
- Status: partly built; ruled 2026-11-11 (DR1)
- Type: capability
- Rationale kind: vision
- Depends on: Everything above the kernel is an extension, and there is one way to extend; Trust comes from the kernel, not the author; A system is described in the language of its domain, and that language grows with the understanding
- Significance: 5 — why a domain language loses nothing
- Label: foundational — every domain language and Vivace rest on it
- Options recorded: domain languages as separate tools with their own, weaker checks (rejected)
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr1-part-1-the-bet.md, Rulings taken); docs/book/vision.md §1, §5
- Notes: replaces "Substrate and surfaces: a DSL inherits the whole kernel".
- Chapter: Why a new language

#### A mapping between models is itself a checked value
- Decides: a domain model is a language. A mapping from one model to another is written declaratively and is itself a value, so the kernel checks what a mapping produces as it checks anything else. Examples: from a grammar to the values it denotes, from a data model to an interface, from data to an analysis.
- Status: open (only the grammar mapping exists); ruled 2026-11-11 (DR1)
- Type: capability
- Rationale kind: vision
- Depends on: A language inherits every check of what it is built on; Meaning comes before notation
- Significance: 4 — model-driven engineering with checked mappings
- Label: foundational — Vivace and model composition rest on it
- Options recorded: mappings as generators outside the language, unchecked (the practice that stalled)
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr1-part-1-the-bet.md, Rulings taken); docs/book/vision.md §1, §5
- Notes: new, by ruling; from the maintainer's motivation 3.
- Chapter: Why a new language

#### A paradigm is a library
- Decides: a declarative style of programming, such as queries, logic or constraints, is supplied by an extension, not by another language or runtime. Every paradigm shares the one kernel, its checks and its tools, and paradigms can be mixed in one program.
- Status: open; ruled 2026-11-11 (DR1)
- Type: capability
- Rationale kind: vision
- Depends on: A language inherits every check of what it is built on; Order of definition carries no meaning
- Significance: 4 — multi-paradigm systems without multiple languages
- Label: foundational — solution finding and search rest on it
- Options recorded: several languages on one runtime; mapping libraries between languages (both need a language builder's investment)
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr1-part-1-the-bet.md, Rulings taken); docs/book/vision.md §1, §5
- Notes: new, by ruling; from the maintainer's motivation 4.
- Chapter: Why a new language

### Keep it simple

#### One operation: partial evaluation
- Decides: Allegro does one thing with a program: it evaluates whatever the available information determines and leaves the rest as a smaller program, the residual. Checking a type, proving a claim, compiling, optimizing and running are all this one operation, given more or less information. An analysis of a program is itself a function, evaluated over the program's expression, which every value carries as metadata.
- Status: settled; ruled 2026-11-11 (DR1)
- Type: capability
- Rationale kind: mixed
- Depends on: Everything above the kernel is an extension, and there is one way to extend
- Significance: 5 — the defining technical bet; every check, compilation and optimisation is this operation
- Label: foundational — residuals as values, the PE rules, discharge and every analysis rest on it
- Units: evaluator
- Options recorded: separate checking passes over a separate IR (rejected); analyses as privileged host passes (what the code does today for termination and exhaustiveness, held below)
- Sources: docs/book/vision.md §1, §1a move 1, §5 principle 2; docs/book/concepts.md R2, §25; docs/book/units.md §4.1 row 13; the maintainer's rulings of 2026-11-11 in the review session (../records/book-pass/dr1-part-1-the-bet.md, Rulings taken)
- Notes: replaces "Partial evaluation as the compilation model". The maintainer, 2026-11-11: an analysis over the source expression carried as metadata "doesn't feel like cheating when we give it to everyone to use"; optimisation, expression transformation and source-aware functions use the same expression model.
- Held finding (2026-11-11, DR1): termination and exhaustiveness are privileged host passes wired into the pipeline (`src/totality.ts:219`–`257`, `477`–`1140`), not ordinary functions over the expression that any extension could write. Held on "Termination by bounded decrease" and "Exhaustiveness checking at info severity".
- Chapter: Keep it simple

#### Phases are configuration
- Decides: Allegro has no fixed compile time or run time. A phase is one evaluation, defined by the information and the capabilities available to it. An effect is a call on a capability, such as writing output. Where the capability is absent, the call cannot be evaluated and stays in the residual. Building, validating and executing a program are phases a project configures. A configuration may state what a phase must leave decided.
- Status: partly built; ruled 2026-11-11 (DR1)
- Type: capability
- Rationale kind: mixed
- Depends on: One operation: partial evaluation
- Significance: 5 — removes compile time and run time as concepts of the language
- Label: foundational — every effect, every host and the build pipeline rest on it
- Units: pipeline, base-primitives (to be checked in their parts)
- Options recorded: fixed compile-time and run-time phases built into the language (what the code does today, adopted for want of an alternative; rejected, R38 (the purpose of the decision review) of book-pass.md); `print` and other effects as base primitives (rejected: every primitive is pure)
- Sources: the maintainer's rulings of 2026-11-11 (R38 and R39 (partial evaluation is primary) of book-pass.md; ../records/book-pass/dr1-part-1-the-bet.md, Rulings taken); docs/book/concepts.md §25 to §29; docs/book/platform/host.ir.md (environment capabilities)
- Notes: new, by ruling. A phase's diagnostics (refutations, verdicts, warnings) are its result, metadata rendered by the tool that ran the phase, and are never program output; program output is an effect through a capability, so the two are different streams even where a console shows both. "Capability" is kept for this sense; how it relates to the capability to write a metadata field is explored in Part II. Absorbs "Multi-phase build as successive partial evaluation" and "Project severity configuration" as its realisations; both to be re-read in their parts.
- Held finding (2026-11-11, DR1): `print` is a base primitive and performs output in any evaluation (`docs/book/units.md` row 15 lists it in `base-primitives`). Held on "Minimal base surface of about forty primitives" and "Environment capabilities outside the base, effect-labelled".
- Held finding (2026-11-11, DR1): the precompile and compile-time phases are hard-coded in the pipeline. Held on "Multi-phase build as successive partial evaluation" and "Precompile before the evaluation loop".
- Chapter: Keep it simple

#### Claims are evaluated like everything else
- Decides: a claim about a program (a type, a contract, a theorem) is an expression, and a phase evaluates it. If it comes out true, the claim is discharged and disappears from the residual. If it comes out false, the phase halts. If the phase's information cannot decide it, the claim stays in the residual, visibly undecided, for a later phase. A claim is never reported as refuted because it could not be decided. A claim is written in whichever language on the platform suits it best: the language of the program it is about, or another, such as one with logical quantifiers that the program's own language lacks; it needs no separate specification system.
- Status: partly built; ruled 2026-11-11 (DR1)
- Type: capability
- Rationale kind: mixed
- Depends on: One operation: partial evaluation; Phases are configuration
- Significance: 5 — partial evaluation applied to claims: discharged, refuted or residual
- Label: foundational — every check, the verdict and every halt rest on it
- Units: pipeline, totality, effects, proofs (to be checked in their parts)
- Options recorded: halting as configuration (rejected: a refuted claim always halts its phase; what a configuration chooses is how much may stay undecided); halting at the first refutation only (rejected: a halted phase may go on evaluating independent expressions, without effects, to report every refutation); warnings as claims (no: warnings are informational metadata)
- Sources: docs/book/vision.md §2 "Build, don't derive", §5 principle 10; docs/decisions.md CE-R1, CE-R8; the maintainer's rulings of 2026-11-11 (../records/book-pass/dr1-part-1-the-bet.md, Rulings taken)
- Notes: replaces "Compile-time first: failures halt the build" and merges the review's proposals "A pending claim never halts; a refuted one does" and, in part, "Performance is never traded for safety" (its remainder, never silently weakened, goes to "Every result says how strongly it holds"). The two weaker paths of CE-R8 (construction-path invariant failure, non-exhaustive match) are re-read against this decision in their parts.
- Held finding (2026-11-11, DR1): a declared return type that fails does not halt: `f(x: Int): Bool => x + 1` runs and exits 0 (`src/runtime.ts:864`–`877`). Held on "Type annotations on parameters and returns".
- Held finding (2026-11-11, DR1): a refuted proof halts only after the whole evaluation loop (`src/runtime.ts:1686`–`1703`). Held on "One evalSource pipeline for programs and libraries".
- Chapter: Keep it simple

- Notes (2026-11-11, chapter 3 folded in): absorbs "Formal claims written in the program's own syntax" (the maintainer: writing a claim in its target's language is an important feature, not a requirement; a claim uses the model and language that best suit it) and "Analyzer silence over guessing".
- Held finding (2026-11-11, DR1): the return check compares type names and reports a refined return that conforms to its declared base type as a mismatch (`src/runtime.ts:870`, `tests/refinements.alg:20`). Held on "Type annotations on parameters and returns".
#### An effect consumes only values whose claims are decided
- Decides: an effect is performed only on values that have passed every claim made about them. A value carrying a refuted claim never reaches an effect. A value carrying an undecided claim has that claim evaluated first. After a phase has refuted a claim, it performs no further effect, though it may go on evaluating to report every refutation.
- Status: partly built; ruled 2026-11-11 (DR1)
- Type: capability
- Rationale kind: technical
- Depends on: Claims are evaluated like everything else; Phases are configuration
- Significance: 4 — the one rule joining claims and effects; it replaces any ordering of checks before effects
- Label: foundational — every capability call rests on it
- Units: evaluator, base-primitives (to be checked in their parts)
- Options recorded: a rule that a phase decides every decidable claim before any effect (rejected: the dependency rule and the default configuration, validating in a phase with no output capability before executing, do the work); gating `print` alone (rejected: the rule holds for every effect)
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr1-part-1-the-bet.md, Rulings taken)
- Notes: new, by ruling. The maintainer: a failed claim might not apply to an effect, though no example is known; the rule stands until a valid counter-example is found. A single phase with both the information and an output capability (a script run, the REPL) may perform an effect before it reaches a later false claim.
- Held finding (2026-11-11, DR1): effects are not gated on the claims of the values they consume. Held on "Environment capabilities outside the base, effect-labelled" and "Errors as a viral metadata field".
- Chapter: Keep it simple

#### Correctness and safety are one kind of claim
- Decides: what a program computes and what it is allowed to do are both stated as claims and decided by the same evaluation. No kind of claim has a checker of its own: not a type, an effect, a permission or a termination measure. A feature that could only be checked by separate machinery is evidence against the design, and is raised as such, not built.
- Status: partly built; ruled 2026-11-11 (DR1)
- Type: capability
- Rationale kind: vision
- Depends on: Claims are evaluated like everything else
- Significance: 5 — safety is not a second system; the design states what would falsify it
- Label: foundational — effects, permissions, termination and every later kind of claim rest on it
- Units: none of its own
- Options recorded: a lattice and a checker per kind of claim (rejected); wording that lets a kind of claim keep its own entailment procedure (rejected: it would excuse the separate effects checker)
- Sources: docs/book/vision.md §2, §5; the maintainer's rulings of 2026-11-11 (../records/book-pass/dr1-part-1-the-bet.md, Rulings taken)
- Notes: replaces "Provable correctness and safety as one predicate machinery". Read strictly.
- Held finding (2026-11-11, DR1): effects are label sets merged by union and checked by inclusion in code of their own (`EffectSet = Set<string>`, `src/effects.ts:41`). Held on the effects decisions of Part IV.
- Chapter: Keep it simple

#### The kernel trusts only what it has evaluated
- Decides: a result the kernel did not evaluate itself is never reported as decided. An answer from an outside solver, the return of a capability, a statement a program asks it to accept: each is reported as assumed, and everything that rests on it says so.
- Status: partly built; ruled 2026-11-11 (DR1)
- Type: capability
- Rationale kind: technical
- Depends on: Claims are evaluated like everything else; Trust comes from the kernel, not the author
- Significance: 5 — one trust mechanism; everything else is a proposer
- Label: foundational — the tiers, the verdict and every outside tool rest on it
- Units: none of its own
- Options recorded: three legs with an SMT solver as a trusted fallback (rejected: a solver is one more proposer, checked or assumed)
- Sources: docs/book/vision.md §2; the maintainer's rulings of 2026-11-11 (../records/book-pass/dr1-part-1-the-bet.md, Rulings taken)
- Notes: replaces "Three-leg proof strategy: PE-as-discharge, proof pairs, selective SMT" and merges "SMT as a selective fallback", which is no longer a decision.
- Chapter: Keep it simple

#### Anyone may propose, and the record shows who
- Decides: people, agents and tools propose code and proofs in the same way. The kernel checks every proposal identically. Who proposed what is kept with the result.
- Status: partly built; ruled 2026-11-11 (DR1)
- Type: capability
- Rationale kind: vision
- Depends on: The kernel trusts only what it has evaluated
- Significance: 4 — one protocol for every participant
- Label: foundational — the prover loop, obligations and proposals rest on it
- Units: none of its own
- Options recorded: separate paths for human and machine provers (rejected)
- Sources: docs/book/vision.md §1, §2; docs/book/proving-in-allegro.md; the maintainer's rulings of 2026-11-11 (../records/book-pass/dr1-part-1-the-bet.md, Rulings taken)
- Notes: replaces "Participant-neutral prover protocol with the kernel as trust boundary"; its trust half is now "Trust comes from the kernel, not the author".
- Held finding (2026-11-11, DR1): authorship is not kept: the verdict credits every discharged theorem to `auto-PE` (`src/pcp.ts:831`). Held on "Obligations and proposals as machine and human views".
- Chapter: Keep it simple

#### A decided claim can be translated into a proof an outside checker accepts
- Decides: Allegro does not keep proofs in another system's format. It can replay the evaluation that decided a claim as a sequence of named steps, and a translator turns those steps into a proof for an independent checker. Trusting Allegro's kernel is then a choice, not a requirement.
- Status: open; ruled 2026-11-11 (DR1), wording to confirm
- Type: capability
- Rationale kind: vision
- Depends on: The kernel trusts only what it has evaluated
- Significance: 3 — an independent check of the kernel itself
- Label: foundational — it requires that evaluation be replayable and that each step be an instance of a stated rule
- Units: none (not built)
- Options recorded: proofs stored in a directly exportable form (rejected by the maintainer: translation, not direct export)
- Sources: docs/book/vision.md §2; docs/decisions.md D7; the maintainer's ruling of 2026-11-11 (../records/book-pass/dr1-part-1-the-bet.md, Rulings taken)
- Notes: replaces "Proofs exportable to external checkers". The constraint that remains on representation is light: the kernel's rules must be stated, and an evaluation replayable step by step. Assumed and sampled results translate as assumptions.
- Chapter: Keep it simple

#### Host code reaches a program only as a capability
- Decides: code in the host's language cannot be checked by the kernel, so it enters in one place: as a capability that the environment supplies to a phase. An extension may declare a capability; a configuration supplies it. A capability takes data and returns data. It cannot write metadata, so it cannot forge a type, a proof or the result of any analysis. A claim about what a capability returns is either checked when the data arrives or reported as assumed.
- Status: partly built; ruled 2026-11-11 (DR1)
- Type: capability
- Rationale kind: technical
- Depends on: Everything above the kernel is an extension, and there is one way to extend; Phases are configuration; Claims are evaluated like everything else
- Significance: 4 — fixes the trusted base: the kernel and the capabilities a configuration supplies, nothing else
- Label: foundational — every host, every I/O surface and every foreign routine rest on it
- Units: to be placed in Part VI (hosts)
- Options recorded: a foreign-function interface inside extensions (rejected with the admitted-tier option above); the maintainer's note: this is a second mechanism beside extensions, with a cleaner distinction than before, and no alternative is seen
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr1-part-1-the-bet.md, Rulings taken); docs/book/platform/host.ir.md (environment capabilities)
- Notes: new, by ruling. A database driver, a file system and a fast numeric routine are one construct; the last is a capability with no effect. Data from outside arrives with no claims and earns them by being checked.
- Chapter: Keep it simple

#### No interface limits optimization
- Decides: partial evaluation sees through every extension. An expression that crosses from a program into an extension, or from one extension into another, is evaluated as one expression, so the extension interface costs nothing a program can measure. Optimizations that partial evaluation does not find are functions over a program's expression, open to every extension. The one opaque point is the body of a capability.
- Status: open; ruled 2026-11-11 (DR1)
- Type: capability
- Rationale kind: vision
- Depends on: One operation: partial evaluation; Everything above the kernel is an extension, and there is one way to extend; Host code reaches a program only as a capability
- Significance: 5 — performance is how the partial-evaluation approach is demonstrated
- Label: foundational — the form of every install, hook and module boundary rests on it
- Units: evaluator, modules (to be checked in their parts)
- Options recorded: an extension interface of opaque calls (rejected: it would bound optimization and likely give unacceptable performance)
- Sources: the maintainer's ruling of 2026-11-11 (../records/book-pass/dr1-part-1-the-bet.md, Rulings taken): "PE must operate effectively on expressions that cross the extension interface … My goal for Allegro is to have no limits on optimization, although that might not come 100% from PE"
- Notes: new, by ruling. Whether a capability's declared laws may license rewrites around its opaque body is read with "Laws licence rewrites" in Part VI. Also for Part VI, when it becomes an issue: making capability bodies optimizable by writing them in Allegretto or Allegro expressions.
- Held finding (2026-11-11, DR1): the installed hooks are host closures the evaluator calls, opaque to partial evaluation. Held with the install-operations finding above.
- Chapter: Keep it simple

#### Every result says how strongly it holds
- Decides: a claim's result is reported in one vocabulary, used everywhere: decided (the kernel evaluated it in full, which includes checking every case of a finite set), sampled (evaluated on some cases), assumed (accepted without evaluation) or undecided (still in the residual). A result that rests on a weaker result is itself reported at the weaker strength. No keyword, grade or report uses a stronger word than the result earned. A cheaper check is allowed only under its own name, never silently. A result also names the extensions and capabilities it rests on.
- Status: partly built; ruled 2026-11-11 (DR1)
- Type: capability
- Rationale kind: vision
- Depends on: The kernel trusts only what it has evaluated; Host code reaches a program only as a capability
- Significance: 5 — no bare checkmark: every result carries its strength and what it rests on
- Label: foundational — the verdict, the ledger, every grade and every keyword naming a check rest on it
- Units: none of its own
- Options recorded: one vocabulary per kind of claim with a published mapping (rejected); the three lists in use today (rejected)
- Sources: docs/book/vision.md §1a, §5 principle 10; the maintainer's rulings of 2026-11-11 (../records/book-pass/dr1-part-1-the-bet.md, Rulings taken)
- Notes: replaces "Every claim states its discharge strength"; absorbs "never silently weakened" from the review's proposal on performance and safety, and the rule that only a field's owner writes it.
- Held finding (2026-11-11, DR1): three tier lists disagree (docs/book/vision.md §1a; `src/pcp.ts:230`–`236`; `src/totality.ts:500`). Held on the proofs, laws and termination decisions of Part IV.
- Held finding (2026-11-11, DR1): the keyword `proven` names a check made on four samples, and a `proven` clause is absent from the verdict, whose ledger then reads "all proofs rest on proven backing" (`lib/proven.alg:4`–`5`, `src/pcp.ts:1021`). Held on "Bounded sampling for universal claims".
- Held finding (2026-11-11, DR1): the safety grade reads `proven-safe` whenever nothing complained (`src/introspect.ts:496`–`504`); a verdict resting on sampled backing is headed "Verdict (verified)" (`src/pcp.ts:646`, `959`). Held on "Safety grade as the default verification surface" and "The verdict as accumulated metadata".
- Chapter: Keep it simple

#### From experiment to proof without rewriting
- Decides: a program need state no claims. What can be inferred is inferred, and shown. Its authors add claims as their understanding grows, and the same program moves from a quick experiment to a fully decided system without being rewritten.
- Status: settled; ruled 2026-11-11 (DR1)
- Type: capability
- Rationale kind: vision
- Depends on: Claims are evaluated like everything else; Every result says how strongly it holds
- Significance: 4 — formal and experimental practice in one language
- Label: foundational — inference, optional annotations and the undecided strength rest on it
- Units: none of its own
- Options recorded: every claim decided before a program may run (the formal-methods default); no claims at all (the scripting default)
- Sources: docs/book/vision.md §5; the maintainer's motivation 6 and rulings of 2026-11-11 (../records/book-pass/dr1-part-1-the-bet.md, Rulings taken)
- Notes: replaces "Progressive disclosure of formality".
- Chapter: Keep it simple

#### Each decision lives in one replaceable unit of code
- Decides: the code is divided into the smallest units that each hold one decision. A unit depends only on units it names, and can be replaced without editing the others. A unit is split when its parts could be revised independently, never for size alone.
- Status: partly built; ruled 2026-11-11 (DR1)
- Type: implementation
- Rationale kind: technical
- Depends on: Everything above the kernel is an extension, and there is one way to extend
- Significance: 3 — what lets a reader branch the code and try another decision
- Label: foundational — every implementation decision's home rests on it
- Options recorded: division by layer (rejected: a layer is too coarse to hold one decision)
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr1-part-1-the-bet.md, Rulings taken); docs/book/vision.md §1, §5
- Notes: replaces "Units in a narrow DAG" and merges "Unit granularity rule". "Layer" was only ever a way of organising code and is to be done away with before release (the maintainer, 2026-11-11); until then L0 to L3 are vocabulary of the units appendix only.
- Held finding (2026-11-11, DR1): 2 forbidden imports, 5 mixed files and 456 kind comparisons outside their units (`npm run lint:units`). Held here; the evaluator's imports of the standard language's units are also the extension decision's findings.
- Chapter: Keep it simple

### Values and their seven kinds

#### One value universe
- Decides: everything the evaluator can meet is a value; there are no statements, declarations or types that are not values.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: The kernel contains only what no extension could supply; Everything above the kernel is an extension, and there is one way to extend
- Significance: 5 — lets extensions build and return any part of the language
- Label: foundational — every kind, residual and type-as-value rests on it
- Units: value
- Options recorded: none (requirement); derivation corrected from R4 to R1 + R9
- Sources: docs/book/concepts.md R8, T0 §1; docs/book/units.md §4.1 row 1
- Book home (fragments' proposal): concepts.md Part 0 (R8) and T0 §1 / kinds chapter (planned II.3)
- Notes: Told in the tour.
- Chapter: Values and their seven kinds

#### Seven representation kinds
- Decides: a value takes exactly one of seven kinds, fixed at construction: Bits, Symbol, Param, Expression, ComposedFunction, PrimitiveFunction, Structure.
- Status: settled
- Type: capability — concepts.md files it as a specification choice, visible to the layers above
- Rationale kind: technical
- Depends on: One value universe; The kernel contains only what no extension could supply
- Significance: 4 — the representation every unit above works over
- Label: foundational — the evaluator switch and every L2 dispatch depend on the set
- Units: kinds (and the seven kind units)
- Options recorded: fold Param into Symbol; no separate PrimitiveFunction; a distinct sequence kind beside Structure; MultiValue and Context as separate kinds (the original)
- Sources: docs/book/concepts.md SC-1, T0 §2; docs/decisions.md D1, D46, D51
- Book home (fragments' proposal): concepts.md Part 0 (SC-1) / kinds chapter (planned II.3)
- Notes: Significance calibrated from 5.
- Chapter: Values and their seven kinds

#### Kind is a host discriminant, not a type
- Decides: `v.kind` is an interpreter tag invisible at the language level, separate from types; the definitional ladder runs representations → values → types → kinds, and the language taxonomy is data versus computation forms.
- Status: settled
- Type: capability — it decides what the language does not expose
- Rationale kind: technical
- Depends on: Seven representation kinds
- Significance: 4 — keeps the type system an extension
- Label: foundational — Allegro Standard's type system as an extension rests on it
- Units: kinds, value
- Options recorded: kind as a type (rejected: the type system would be fixed at seven)
- Sources: docs/decisions.md D46; docs/book/concepts.md T0 §2; docs/book/allegretto/structures.md §2 (D46 block)
- Book home (fragments' proposal): kinds chapter (planned II.3)
- Chapter: Values and their seven kinds

#### Value as a contract, seven kind units and an assembly
- Decides: `Value` is an open registry contract naming no kind; each kind registers itself by declaration merging with its tag, interface, factories, guard and ops; one assembly closes the set per build, holds the ops table and the walkers, and is the fork point.
- Status: partly built
- Type: implementation
- Rationale kind: technical
- Depends on: Seven representation kinds; Each decision lives in one replaceable unit of code
- Significance: 4 — makes each kind replaceable and dependencies on a kind visible
- Label: foundational — every guard import and walker depends on the split
- Units: value, bits, symbol, param, primitive-function, expression, composed-function, structure, kinds
- Options recorded: an open extension point for kinds (rejected: R9 and R14 are the language's extension points); container kinds generic over the value type with the union tied in the assembly (rejected: guards would live in the assembly and hide the edge)
- Sources: docs/decisions.md D51; docs/book/units.md §3
- Book home (fragments' proposal): kinds chapter (planned II.3) / units.md §3
- Notes: specified and probed on TypeScript 7.0.2; the move rides the first chunk that edits the `Value` union. Today all of it is in `src/types.ts`.
- Chapter: Values and their seven kinds

#### Bits is the only scalar
- Decides: Allegretto has one uninterpreted scalar, a bit vector of known length, and `Int`, `Float`, `String` and `Bool` are Bits with a type attached at L2.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Seven representation kinds; Everything above the kernel is an extension, and there is one way to extend
- Significance: 4 — puts numeric and textual semantics in extensions
- Label: foundational — core types and typed literals build on it
- Units: bits
- Options recorded: a fixed set of primitive scalars (violates R6); tagged scalars (the tag is a degenerate type channel)
- Sources: docs/book/concepts.md SC-2, T0 §3; docs/decisions.md D9 (no references inside Bits)
- Book home (fragments' proposal): concepts.md Part 0 (SC-2) / kinds chapter (planned)
- Notes: revisit trigger recorded: a numeric or textual operation that cannot be expressed at L2 without the base knowing its semantics.
- Chapter: Values and their seven kinds

#### Minimal base surface of about forty primitives
- Decides: Allegretto's irreducible base is about forty primitives in five groups (Bits, Expression, Structure, channels, Scope) plus core control (`eval_if`, `seq`, `id`); types, proofs, effects, contracts, totality, pattern matching, grammar tooling and IO are not base.
- Status: partly built
- Type: capability
- Rationale kind: technical
- Depends on: The kernel contains only what no extension could supply; Everything above the kernel is an extension, and there is one way to extend
- Significance: 4 — the layering proof
- Label: foundational — every primitive's layer placement follows
- Units: base-primitives
- Options recorded: the per-primitive audit (keep, refactor, subsume, extension, env, delete); `eval_when` as base control versus a pattern-matching library is marked a judgment call
- Sources: docs/decisions.md D27, D28; docs/book/allegretto/structures.md §11, Appendix B; docs/plans/archive/structured-values-unification.md B8
- Book home (fragments' proposal): allegretto base-primitives chapter (planned, II.5)
- Notes: physical relocation out of `src/primitives.ts` rides M2/M3. units.md row 15 lists `eval_when`, `print` and `make_error` as base-primitives, while Appendix B marks `eval_when` EXTENSION and `print` ENV: the sources disagree on placement.
- Chapter: Values and their seven kinds

#### The discriminator rule for kind comparisons
- Decides: a guard imports its kind instead of comparing tags, a walker uses the assembly's traversal protocol, and only the evaluator switches on kind for behaviour, naming only the participating kinds with an inert default arm.
- Status: partly built
- Type: implementation
- Rationale kind: technical
- Depends on: Value as a contract, seven kind units and an assembly
- Significance: 3 — makes a fork's new kind inert until its author says otherwise
- Label: swappable — a rule over the kinds unit
- Units: kinds, evaluator
- Options recorded: every kind has an arm (the compiler's default check, replaced); a failing default arm (RR5 option b, rejected)
- Sources: docs/book/units.md §3.2; docs/plans/pe-rules.md §6 RR5; docs/decisions.md D51
- Book home (fragments' proposal): kinds chapter (planned II.3) / allegretto/evaluator.md §2
- Notes: the evaluator's default arm landed at B-172 C5 (`src/evaluator.ts:546`); `allegretto/evaluator.md` §2 still says the switch names all seven kinds with no default arm, which the IR (claims C173 to C177) corrects. Ten walker switches remain; the traversal protocol is owed. The `units` report skips the evaluator in its count.
- Chapter: Values and their seven kinds

#### Scalar encodings inside Bits
- Decides: an integer is 64-bit, a float is IEEE-754 packed into the same 64 bits, and a string is UTF-8 bytes.
- Status: settled
- Type: capability — the number semantics a program sees
- Rationale kind: technical
- Depends on: Bits is the only scalar
- Significance: 1 — local encoding
- Label: swappable — behind the `bits` unit's factories
- Units: bits
- Options recorded: none recorded
- Sources: docs/book/concepts.md T0 §3; docs/book/units.md §4.1 row 2; src/types.ts:276-484 (makeInt, makeFloat, stringToBits)
- Book home (fragments' proposal): kinds chapter (planned)
- Notes: the sources record no rationale for these encodings.
- Chapter: Values and their seven kinds

### Expressions, functions and symbols

#### Expressions are values, forming a DAG
- Decides: an unevaluated application (a function value plus arguments) is an ordinary value, so a partially evaluated program is also a value, and expressions form a shared DAG rather than a tree.
- Status: settled
- Type: capability — a partially evaluated program is a value a user can hold
- Rationale kind: technical
- Depends on: One value universe; One operation: partial evaluation
- Significance: 4 — residuals flow through the same machinery as results
- Label: foundational — residuals, source metadata and PE rules rest on it
- Units: expression
- Options recorded: a separate IR for unevaluated code (rejected: violates R8, and residuals could not share machinery)
- Sources: docs/book/concepts.md SC-3, T0 §6
- Book home (fragments' proposal): concepts.md Part 0 (SC-3) / kinds chapter (planned)
- Notes: Significance calibrated from 5.
- Chapter: Expressions, functions and symbols

#### Symbol identity is a fully-qualified name
- Decides: a registered symbol's identity is its defining scope's FQN plus base name (default FQN is the module path), the base name is only a projection for printing, serialisation and loose matching, and an ambiguous base name requires explicit qualification or is an error.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Seven representation kinds
- Significance: 4 — conformance becomes an identity question
- Label: foundational — member conformance, export partition and visibility rest on it
- Units: symbol
- Options recorded: name-string comparison (rejected; D44 removed exactly that false-positive class); opaque gensym identity (loses the readable projection)
- Sources: docs/book/concepts.md SC-4, T0 §4; docs/decisions.md D20, D29, C5.2-R4, C5.2-R5; docs/book/allegretto/structures.md §5
- Book home (fragments' proposal): symbols chapter (proposed, within the kinds chapter)
- Notes: the qualification syntax `x[ns.name]` is deferred (C5.2-R4); ambiguity is a detected error.
- Chapter: Expressions, functions and symbols

#### Host functions as values with declared evaluation control
- Decides: a primitive function is host-implemented and carries declarations the evaluator acts on (`lazy`: do not evaluate my arguments; `effects`: labels I produce; `sourceAware`: attach each argument's originating expression), so primitives never reach into the evaluator.
- Status: settled
- Type: capability — evaluation control and effect labels are semantics a program observes
- Rationale kind: technical
- Depends on: Seven representation kinds
- Significance: 3 — keeps the propagation table authoritative
- Label: swappable — the declaration set can grow behind the unit
- Units: primitive-function
- Options recorded: lazy registration as a way to see ASTs (replaced by `sourceAware`); lazy registration to dodge argument stripping (deleted with D3)
- Sources: docs/book/concepts.md T0 §8; docs/decisions.md D3, D47; docs/book/allegretto/structures.md §3.1 "What migrates"; docs/plans/structures-implementation.md §6 item 2
- Book home (fragments' proposal): kinds chapter (planned)
- Notes: two proof primitives stay lazy for a different reason: as non-value interpreters a residual or error proposition must become a failed proof, and lazy registration is the only way to opt out of the Rule 1 residual guard (structures.md §3.1).
- Chapter: Expressions, functions and symbols

#### Expressions memoize per evaluation context
- Decides: an Expression carries a memo table keyed by evaluation context, and a clone shares it.
- Status: settled
- Type: implementation — concepts.md files it as an implementation choice
- Rationale kind: technical
- Depends on: Expressions are values, forming a DAG
- Significance: 2 — PE cost
- Label: swappable — invisible above the expression unit
- Units: expression
- Options recorded: no memo, re-evaluate per reference (exponential under PE)
- Sources: docs/book/concepts.md IC-6, T0 §6; docs/plans/metadata-on-values.md §3.3 (the clone shares the memo)
- Book home (fragments' proposal): kinds chapter (planned)
- Chapter: Expressions, functions and symbols

#### Positional parameters owned by membership
- Decides: a Param is a positional placeholder, and a function owns a Param by its membership in the function's parameter list rather than through a back-pointer's identity.
- Status: settled
- Type: capability — parameters are positional for every program, and ownership decides what substitution replaces
- Rationale kind: technical
- Depends on: Seven representation kinds
- Significance: 2 — makes substitution positional and clone-safe
- Label: swappable — behind the `param` unit
- Units: param
- Options recorded: named parameters (would need a name environment for substitution); ownership by back-pointer identity (dissolved 2026-08)
- Sources: docs/book/concepts.md SC-1 row 1, T0 §5; docs/plans/metadata-on-values.md §3.3; docs/book/units.md §4.1 row 4 (M7)
- Book home (fragments' proposal): kinds chapter (planned)
- Notes: concepts.md T0 §5 still describes a back-reference `owner` as the mechanism; metadata-on-values §3.3 says substitution asks `ownsParam` and nothing reads the back-pointer's identity. `ParamValue.predicates` is a reserved field with no reader (B-107).
- Chapter: Expressions, functions and symbols

#### Functions are data: params plus body
- Decides: a composed function is a list of declared Params and a body value, so building, inspecting and specialising functions needs no reflection API, and every clone goes through shared helpers that preserve its properties.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Expressions are values, forming a DAG; Positional parameters owned by membership
- Significance: 4 — specialising a function is substituting into a value
- Label: foundational — precompile, unfolding and analyser properties rest on it
- Units: composed-function
- Options recorded: none recorded
- Sources: docs/book/concepts.md T0 §7; docs/book/units.md §4.1 row 7; docs/book/process.md §6 (not read; cited by CLAUDE.md)
- Book home (fragments' proposal): kinds chapter (planned)
- Notes: analysis properties (`partial`, `inferredEffects`, …) ride as JS expandos listed in `PRESERVED_FN_META_KEYS`, invisible in the interface; the host-plane declaration entry owns that.
- Chapter: Expressions, functions and symbols

#### Transient reference symbols resolved by base name
- Decides: the parser mints a transient Symbol per identifier occurrence, with no identity beyond it, resolved by base name against the enclosing scope, so resolution is not folded into parsing; scope binding keys may stay strings.
- Status: settled
- Type: implementation — how the parser hands names to resolution; the scoping is unchanged
- Rationale kind: technical
- Depends on: Symbol identity is a fully-qualified name
- Significance: 2 — local to symbol resolution
- Label: swappable — resolution policy inside the symbol and scope units
- Units: symbol, scope
- Options recorded: the parser decides what an identifier refers to (rejected)
- Sources: docs/book/concepts.md T0 §4; docs/decisions.md D14, D29
- Book home (fragments' proposal): symbols chapter (proposed)
- Chapter: Expressions, functions and symbols

#### Symbols interned by FQN
- Decides: the same FQN is the same object, across re-evaluation, module reload and loader instances, so identity comparison is a pointer compare; metadata on an interned symbol warns rather than errors.
- Status: settled
- Type: implementation — concepts.md files it as an implementation choice; it realises symbol identity by name
- Rationale kind: technical
- Depends on: Symbol identity is a fully-qualified name
- Significance: 2 — hot-path comparison cost
- Label: swappable — invisible above the symbol unit
- Units: symbol
- Options recorded: compare FQN strings at each site; for metadata on a Symbol, error versus warn (warn ruled, removable later)
- Sources: docs/book/concepts.md IC-4; docs/plans/metadata-on-values.md §6 ruling 2
- Book home (fragments' proposal): symbols chapter (proposed)
- Chapter: Expressions, functions and symbols

### Structures

#### One composite kind: Structure
- Decides: MultiValue and Context are condensed into one composite kind, Structure, the only kind with internal parts, used for records, arrays, types, proofs and module objects.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: The kernel contains only what no extension could supply; Seven representation kinds
- Significance: 4 — the one composite every L2 construct is built from
- Label: foundational — types, proofs and module objects are Structures
- Units: structure
- Options recorded: two kinds (the original, explicit about carrier versus record); three kinds (add a sequence kind)
- Sources: docs/book/concepts.md SC-5, T0 §9; docs/decisions.md D1, D19, D48 ("SC-5 upheld"); docs/book/allegretto/structures.md §1
- Book home (fragments' proposal): allegretto/structures.md
- Notes: Significance calibrated from 5.
- Chapter: Structures

#### Structures immutable by default; derive, never mutate
- Decides: data structures are born immutable with deep immutability, a value is written in place only while provably unshared during construction, an unresolved future cell counts as immutable, and transient-to-immutable finalisation waits for the mutability track.
- Status: partly built
- Type: capability — immutability is what a program relies on; its in-place licence while unshared is the implementation's part
- Rationale kind: technical
- Depends on: One composite kind: Structure
- Significance: 4 — the second leg of the integrity model and of PE soundness
- Label: foundational — forgery scenario B and every in-place writer rest on it
- Units: value (the `clone` obligation), structure
- Options recorded: a stored O(1) immutable bit (landed as declared state, never read, deleted at B-134); a `seal` operation (retired, see next entry)
- Sources: docs/decisions.md D22, D13; docs/book/concepts.md IC-3a; docs/book/allegretto/structures.md §2 "Immutability", "There is no immutable bit"; docs/plans/metadata-on-values.md §3.4
- Book home (fragments' proposal): allegretto/structures.md
- Notes: the in-place rule is stated, not enforced (B-143). The cross-module form, the owner-module invariant of B-158 (a library's values are immutable after load), belongs to the modules fragment. D22's own text still names the bit.
- Chapter: Structures

#### Arrays are structures with unkeyed entries
- Decides: an array is a Structure whose entries all carry a null key, with no separate vector kind and no references inside Bits.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: One composite kind: Structure; Bits is the only scalar
- Significance: 2 — local to the structure unit
- Label: swappable — collection types choose representations above
- Units: structure
- Options recorded: a vector primitive (rejected); references inside Bits (rejected); a dense region as sole storage plus a lazily materialised legacy view (built, then deleted at B-120 E4)
- Sources: docs/decisions.md D9, D18, D48(a); docs/book/concepts.md §16, §17; docs/book/allegretto/structures.md §2
- Book home (fragments' proposal): allegretto/structures.md
- Notes: the collection half of D9 (encapsulated `Array[T]`, `Map`, `Set`) is open under B-041 and belongs to the L2 fragment.
- Chapter: Structures

#### The composite is one sequence of optionally-keyed entries
- Decides: a Structure stores an ordered sequence of optionally-keyed entries, with the by-name map a derived view and a lazy index built on first lookup past eight entries, whatever the structure's role.
- Status: settled
- Type: implementation — concepts.md files it as an implementation choice: the index and the sequence are invisible above the specification
- Rationale kind: technical
- Depends on: One composite kind: Structure; Arrays are structures with unkeyed entries
- Significance: 3 — one representation for maps and lists
- Label: swappable — the index is invisible above the specification
- Units: structure
- Options recorded: A map-first (the prior implementation); B sequence-first with no index; C two representations; E one entry sequence (taken)
- Sources: docs/book/concepts.md IC-2, §12, §16, §17; docs/decisions.md D48(a), D48(d); docs/records/concepts-analyses.md §5.2 (not read)
- Book home (fragments' proposal): allegretto/structures.md
- Notes: concepts.md §13 still describes bindings as a stored map and a list maintained at each write site; since B-120 E3 `entries` is the store and `bindings` the derived view (`src/structure.ts:107-157`). The header comment of `src/structure.ts` (lines 17 and 31) still names `dense`. Role tag `isScope` is the last role field.
- Chapter: Structures

#### Untyped structures allowed in Allegretto
- Decides: Allegretto structures may be untyped, duck-typed over defined slot keys, and strict typing of every structure is a guarantee of Allegro Standard.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Everything above the kernel is an extension, and there is one way to extend; One composite kind: Structure
- Significance: 2 — states what the base promises about structure typing
- Label: swappable — Standard's guarantee sits above
- Units: structure
- Options recorded: none recorded
- Sources: docs/decisions.md D5; docs/plans/archive/structured-values-unification.md decision table (sole definition site)
- Book home (fragments' proposal): allegretto/structures.md
- Notes: decisions.md says D5 has no design-doc restatement yet.
- Chapter: Structures

#### Construction only through factories, one host class
- Decides: every Structure is an instance of one host class with one declared hidden class, constructed only through the factory functions, so a stray object literal fails the boundary invariant.
- Status: settled
- Type: implementation
- Rationale kind: technical
- Depends on: One composite kind: Structure
- Significance: 2 — enforceability and hidden-class stability
- Label: swappable — inside the structure unit
- Units: structure
- Options recorded: per-shape object literals (replaced; measured slower)
- Sources: docs/book/allegretto/structures.md §2 (C4.1 status); docs/book/concepts.md T0 §9
- Book home (fragments' proposal): allegretto/structures.md
- Chapter: Structures

#### Binding state belongs to the binding, not the value
- Decides: export-ness, cell origin, completion state and pending dependencies are attributes of a binding in its scope, so copying a value never copies them.
- Status: settled
- Type: implementation — where binding attributes are stored; the export semantics are decided with the export form
- Rationale kind: technical
- Depends on: The composite is one sequence of optionally-keyed entries
- Significance: 2 — fixes the `y = x` export-copy wart
- Label: swappable — local to the binding representation
- Units: structure, scope
- Options recorded: export-ness on the value plane (the `exported` field, deleted at V-R4); state encoded in synthetic binding names (`__future_N`, to be replaced, B-104(b))
- Sources: docs/book/concepts.md T1 §14; docs/decisions.md V-R4
- Book home (fragments' proposal): allegretto/structures.md or scope chapter (planned)
- Chapter: Structures

#### Empty array and empty record are not told apart at L0
- Decides: whether a structure's entries are wholly unkeyed is a private derived cache, and nothing at L0 distinguishes an empty array from an empty record, because that is the type's question.
- Status: settled
- Type: capability — it decides what L0 can tell apart
- Rationale kind: technical
- Depends on: Arrays are structures with unkeyed entries
- Significance: 1 — local host bit
- Label: swappable — inside the structure unit
- Units: structure
- Options recorded: a stored `positional` host bit (demoted at B-133)
- Sources: docs/book/concepts.md §16; docs/plans/entry-sequence-composite.md §5.5 (not read)
- Book home (fragments' proposal): allegretto/structures.md
- Chapter: Structures

### Metadata and the capability to write it

#### Metadata channels are independent
- Decides: each piece of named information about a value is handled by its own declaration, independently of every other, and no operation may disturb a field it does not know about.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: One operation: partial evaluation; Everything above the kernel is an extension, and there is one way to extend
- Significance: 4 — without it every layer threads its information by hand
- Label: foundational — every L2 channel rides on it
- Units: metadata
- Options recorded: survival-only statements (merged into this one at S2d); where channels are stored is left to specification
- Sources: docs/book/concepts.md R3; docs/records/concepts-analyses.md §4.1 (not read)
- Book home (fragments' proposal): concepts.md Part 0 (R3) / allegretto/metadata-and-capability.md §1
- Notes: Significance calibrated from 5.
- Held finding (2026-11-10, from the pilot's review, ../records/book-pass/p2-allegretto-metadata-and-capability.md §7 item 1): a second viral field erases the first: `viralOnto` returns at the first viral field it finds (`src/metadata.ts:331`–`347`), so `t + e` loses `e`'s `error` field. Fixed when the pass takes this decision in order.
- Chapter: Metadata and the capability to write it

#### Metadata is a field on every value
- Decides: every representation kind carries an optional `meta` map, so a typed `42` is a Bits with a `type` field, and attaching metadata yields a new value of the same kind.
- Status: settled
- Type: capability — metadata rides each occurrence of a value, which a program observes; concepts.md files the representation as implementation and its R3 entry (Metadata channels are independent) calls placement a specification choice
- Rationale kind: technical
- Depends on: Metadata channels are independent; Seven representation kinds
- Significance: 5 — every residual carries propagated fields this way
- Label: foundational — every metadata read and write and PE Rule 1's residual rest on it
- Units: metadata
- Options recorded: a transparent carrier Structure wrapping a non-composite value (D15/D46 option B, ratified then retired by measurement: 74% of structures were carriers, 98.5% with one field); a side table keyed by object (fails: metadata is per position, 33.6% of attachments target an already-annotated object); D46's own case against this option (no allocation saved, machinery smeared across shapes, function-identity hazards) is recorded and was overturned by the measurement
- Sources: docs/book/concepts.md IC-3, §10, §11; docs/decisions.md D10, D15, D17, D46, D48(b); docs/plans/metadata-on-values.md §1, §3; docs/plans/archive/structured-values-unification.md D46
- Book home (fragments' proposal): allegretto/metadata-and-capability.md §2
- Notes: D10, D15 and D17 are still marked "accepted (executed)" in decisions.md although D48(b) retired the carrier they describe; decisions.md records no supersession for them. Told in the tour.
- Chapter: Metadata and the capability to write it

#### Metadata fields registered with declared propagation rules
- Decides: extensions register their own metadata fields, each with a declared propagation rule, rather than the base fixing a set of annotation channels.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Metadata channels are independent
- Significance: 4 — the extension mechanism for value information
- Label: foundational — every channel registers this way
- Units: metadata, capability
- Options recorded: a fixed set of annotation channels (implied alternative); `__*` meta-bindings (replaced)
- Sources: docs/decisions.md D2; docs/book/allegretto/structures.md §3; docs/book/allegretto/metadata-and-capability.md §3
- Book home (fragments' proposal): allegretto/metadata-and-capability.md §3
- Chapter: Metadata and the capability to write it

#### Authority is an unforgeable value
- Decides: the right to do something that not all code may do is a function value that cannot be forged or guessed: writing a metadata field, reading a private member, performing an effect. Any code that holds the value can use it, pass it on, or wrap it in a narrower one. Nothing is granted by name, or by the identity of whoever asks.
- Status: partly built; ruled 2026-11-11 (DR2)
- Type: capability
- Rationale kind: technical
- Depends on: Metadata channels are independent; Host code reaches a program only as a capability
- Significance: 5 — one idea for field writers, supplied capabilities and private access
- Label: foundational — proofs, effects, privacy and every field's writer rest on it
- Options recorded: authority by name or by the identity of the requester (rejected); three separate mechanisms for field writers, effects and member privacy (what the inventory listed)
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr2-part-2-the-kernel.md, Rulings taken)
- Notes: replaces "Metadata origination is capability-controlled"; "Writes gated by a capability, reads free", "Writers are closures: delegable, attenuable, unforgeable" and, in Part IV, "Evidence is possession" are re-read as its instances. Open under it: privacy by possession of an unforgeable key, the working answer, analysed with "Who can see a member"; its first test is reflection, since every extension can read a value's source expression: what does an expression show of a key to code that does not hold it?
- Chapter: Metadata and the capability to write it
#### A field's rule is a pure, bounded function
- Decides: a rule computes a field's value on a result from the field's values on the function applied and on its arguments. It sees nothing else, performs no effect, and always finishes. For now a rule may not recurse, which the kernel can check by itself.
- Status: partly built; ruled 2026-11-11 (DR2)
- Type: capability
- Rationale kind: technical
- Depends on: Metadata fields registered with declared propagation rules; Authority is an unforgeable value
- Significance: 4 — the one place kernel evaluation runs an extension's code
- Label: foundational — every field registration rests on it
- Options recorded: a fixed vocabulary of five rules with owner-installed semantics (what the code does today; it becomes a library of common rules); general callbacks that take part in the evaluator's own work, with state or events (rejected: "a vampire is at the door asking to come in")
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr2-part-2-the-kernel.md, Rulings taken)
- Notes: replaces "Fixed propagation vocabulary". Purity follows from evaluating a rule with no capability supplied, and the kernel refuses a rule that holds one. The no-recursion form is relaxed only when a real rule needs more, with evidence.
- Held finding (2026-11-10, from the pilot's review §7 item 2): `channel_register` accepts any rule string; `channel_register("xq", "nonsense")` returns a writer and the field then behaves as `drop` (`src/capability.ts:56`).
- Chapter: Metadata and the capability to write it
#### Writes gated by a capability, reads free
- Decides: originating a field value requires its writer, propagation is evaluator-performed and authority-free, reads are free, and integrity fields may register only non-fabricating rules.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Authority is an unforgeable value; A field's rule is a pure, bounded function
- Significance: 4 — the read/write asymmetry introspection and PCP need
- Label: foundational — every writer and forgery scenario D rest on it
- Units: capability, metadata
- Options recorded: read-gated fields (left to policy; `readVisibility` recorded)
- Sources: docs/decisions.md D23; docs/book/allegretto/structures.md §3; docs/book/allegretto/metadata-and-capability.md §6, Appendix C scenarios C, D
- Book home (fragments' proposal): allegretto/metadata-and-capability.md §6
- Notes: `readVisibility` is recorded and enforced nowhere; whether a field may restrict reads is owned by no item (an open sub-decision). V-R7 settles the parallel question for reflection.
- Chapter: Metadata and the capability to write it

#### Writers are closures: delegable, attenuable, unforgeable
- Decides: the capability is a PrimitiveFunction closure returned by registration; delegation is passing it, attenuation is wrapping it in a re-checking closure, and writers are non-serialisable, print redacted and identity-equal only.
- Status: settled
- Type: capability — delegation and attenuation are what a writer's holder can do
- Rationale kind: technical
- Depends on: Writes gated by a capability, reads free; Host functions as values with declared evaluation control
- Significance: 4 — authority as a value, trackable in the PE dataflow
- Label: foundational — every gated install checks writer identity
- Units: capability, primitive-function
- Options recorded: scope-ambient authority (rejected; recoverable as a usage pattern, while ambient-to-token would be a breaking change); a separate `channel_write` primitive (rejected: the writer is the operation)
- Sources: docs/decisions.md D24; docs/plans/archive/structured-values-unification.md D24; docs/book/allegretto/metadata-and-capability.md §6
- Book home (fragments' proposal): allegretto/metadata-and-capability.md §6
- Chapter: Metadata and the capability to write it

#### No seal operation: constructor trust decomposes
- Decides: there is no seal primitive or per-value brand bit; trust in a constructed value decomposes into write authority over its integrity field, data immutability and a non-fabricating propagation rule, and it is global and structural.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Structures immutable by default; derive, never mutate; Writes gated by a capability, reads free
- Significance: 4 — the integrity model proofs depend on
- Label: foundational — proof unforgeability and the forgery battery rest on it
- Units: capability
- Options recorded: a `seal` op (D13, superseded because it was only ever conceptual); a provenance tag per value (rejected)
- Sources: docs/decisions.md D13, D21; docs/book/allegretto/structures.md §3 "Integrity model", Appendix C; docs/book/allegretto/metadata-and-capability.md §6
- Book home (fragments' proposal): allegretto/metadata-and-capability.md
- Chapter: Metadata and the capability to write it

#### Metadata supplied at construction, one attachment operation
- Decides: factories take an optional metadata argument so a value never exists without what it must carry, `withMeta` is the one attachment operation, and `carryMeta` moves metadata onto a derived value.
- Status: settled
- Type: implementation — concepts.md files it as an implementation choice: the host API for attaching metadata
- Rationale kind: mixed
- Depends on: Metadata is a field on every value; Structures immutable by default; derive, never mutate
- Significance: 3 — lifecycle honesty and one fewer allocation on Rule 1's path
- Label: swappable — the construction surface of the metadata unit
- Units: metadata
- Options recorded: construct then attach (the prior shape); four named operations create, derive, map, stamp (D48(c)'s wording; corrected to one operation plus two conveniences)
- Sources: docs/book/concepts.md IC-3a; docs/decisions.md D48(c); docs/plans/metadata-on-values.md §3.2
- Book home (fragments' proposal): allegretto/metadata-and-capability.md §2
- Notes: decisions.md D48(c) still says the four operations "get four names"; metadata-on-values §3.2 records the correction to one.
- Chapter: Metadata and the capability to write it

#### Metadata slot mixed in from the metadata unit
- Decides: the `meta` slot is not part of the `Value` contract; the `metadata` unit adds it by augmenting the base interface and stamps it in place while the value is unshared, so no kind unit reads it.
- Status: partly built
- Type: implementation
- Rationale kind: technical
- Depends on: Value as a contract, seven kind units and an assembly; Metadata is a field on every value
- Significance: 3 — keeps kinds independent of metadata
- Label: swappable — a placement inside the L0 DAG
- Units: metadata, value
- Options recorded: none beyond the two storage alternatives above
- Sources: docs/decisions.md D51; docs/book/units.md §3.1
- Book home (fragments' proposal): units.md §3.1 or kinds chapter (planned)
- Notes: today `MetadataBearing` and `withMeta` are still in `src/types.ts`. The order is enforced by the analyser, not the compiler, because augmentation is program-global.
- Chapter: Metadata and the capability to write it

#### Symbols serialise by FQN; deserialisation never mints reachability
- Decides: a symbol's wire form is its FQN, registration and exporting are separate maps, and deserialisation answers only from the exported registry, so a private or unknown FQN resolves to nothing.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Symbol identity is a fully-qualified name; Writers are closures: delegable, attenuable, unforgeable
- Significance: 3 — cross-process trust bottoms out in re-verification
- Label: swappable — the wire format is local to the symbol unit
- Units: symbol
- Options recorded: none recorded
- Sources: docs/decisions.md D42 (wire rule); docs/book/allegretto/structures.md §5 (C5.1 status), Appendix C scenario E
- Book home (fragments' proposal): symbols chapter (proposed)
- Chapter: Metadata and the capability to write it

#### One-shot field registration with a pass epoch
- Decides: the first registrant of a field receives its writer and no one else can obtain it, except that Allegro re-registration with the same rule in the same evaluation pass returns the held writer; kernel registrations never re-issue.
- Status: settled
- Type: capability — it decides who can obtain a writer
- Rationale kind: technical
- Depends on: Writers are closures: delegable, attenuable, unforgeable
- Significance: 2 — makes R12 hold without a list of important fields
- Label: swappable — inside the capability unit
- Units: capability
- Options recorded: none recorded
- Sources: docs/book/allegretto/metadata-and-capability.md §3
- Book home (fragments' proposal): allegretto/metadata-and-capability.md §3
- Chapter: Metadata and the capability to write it

#### Only the kernel records the outcome of a claim
- Decides: evaluating an expression as a claim, and recording on the value whether it was decided, refuted or left undecided, is an operation of the kernel. No extension can write that record.
- Status: partly built; ruled 2026-11-11 (DR2)
- Type: capability
- Rationale kind: technical
- Depends on: Claims are evaluated like everything else; The kernel trusts only what it has evaluated; Authority is an unforgeable value
- Significance: 5 — the anchor of the trusted base
- Label: foundational — every result's strength rests on it
- Options recorded: a claim as an ordinary function of some extension, writing the outcome into its own field (rejected: it does not remove the trusted operation, it moves it into that extension)
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr2-part-2-the-kernel.md, Rulings taken)
- Notes: new, by ruling. The kernel's contents are then values, pure primitives, the evaluator, metadata with its fields and rules, authority, and this operation.
- Chapter: Metadata and the capability to write it

#### A refutation marks everything computed from it
- Decides: when a program is wrong, the kernel records a refutation on the value concerned. A program can be wrong through a false claim, a call on something that is not a function, or two definitions that conflict. Every value computed from a refuted value is refuted too. No code can remove the mark, test for it and carry on, or write it itself.
- Status: partly built; ruled 2026-11-11 (DR2)
- Type: capability
- Rationale kind: technical
- Depends on: Only the kernel records the outcome of a claim; A field's rule is a pure, bounded function; An effect consumes only values whose claims are decided
- Significance: 5 — the one mechanism behind halting, effect gating and reporting every failure
- Label: foundational — every phase's result and every effect rest on it
- Options recorded: an abort at the first failure (rejected: a phase reports every refutation); a program-visible error value for a program's own mistakes (rejected: it could be forged, tested and laundered)
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr2-part-2-the-kernel.md, Rulings taken)
- Notes: new, by ruling. With it an effect never consumes a refuted value, and a phase goes on evaluating what does not depend on one, then ends refuted. A test for the mark is itself computed from the refuted value, so it is refuted too.
- Held finding (2026-11-11, DR2): the kernel throws on an ill-formed application and on some type errors instead of recording a refutation (the five abort classes of the former "Specified aborts").
- Chapter: Metadata and the capability to write it
### How metadata propagates

#### Primitives receive full values
- Decides: eager primitives receive their arguments with metadata intact, `lazy` is evaluation control only, and the propagation table alone governs metadata.
- Status: settled
- Type: implementation — a rule for host primitive code, realising that channels are independent
- Rationale kind: technical
- Depends on: Host functions as values with declared evaluation control; A field's rule is a pure, bounded function
- Significance: 4 — removes the lazy/eager stripping asymmetry
- Label: foundational — every primitive implementation relies on it
- Units: evaluator, base-primitives
- Options recorded: strip arguments to their data for eager primitives (the prior `primaryOf` asymmetry, replaced); a `channelAware` registration mode (deleted at C4.3c, now everyone's default)
- Sources: docs/decisions.md D3, D28; docs/book/allegretto/structures.md §2 (C4.3c status); docs/book/concepts.md T0 §11; docs/plans/structures-implementation.md §6 rulings R4
- Book home (fragments' proposal): allegretto/metadata-and-capability.md (propagation) or evaluator.md §3
- Chapter: How metadata propagates

#### How the base applies propagation
- Decides: on a residual the first viral field found on the callee or an argument is carried (first occurrence wins); on re-evaluation the outer value's fields are laid under the inner value's, merged where the rule is `union` and inner-wins otherwise; `drop` needs no code.
- Status: partly built
- Type: capability — which field value survives a residual is observable
- Rationale kind: technical
- Depends on: A field's rule is a pure, bounded function
- Significance: 3 — the generic half of propagation
- Label: swappable — inside the metadata unit
- Units: metadata, evaluator
- Options recorded: inner-shadows-outer for every field, including `effects` (legacy, replaced at C4.3a for union fields)
- Sources: docs/book/allegretto/metadata-and-capability.md §5; docs/decisions.md C4.3-R3; docs/plans/structures-implementation.md §6 (C4.3 rulings R3)
- Book home (fragments' proposal): allegretto/metadata-and-capability.md §5
- Notes: `viralOnto` also carries that candidate's `type` by name (B-145). units.md row 10 names `viralScan` and `mergeOverMeta` as still in `evaluator.ts`; metadata-and-capability.md §5 and §9 place both in `src/metadata.ts`.
- Held finding (2026-11-10, from the pilot's review §7 item 3): a user-registered `viral` field stops computation: `print(t + 1)` prints nothing when `t` carries one (`src/evaluator.ts:745`–`746`). Fixed when the pass takes this decision in order.
- Chapter: How metadata propagates

#### A failure a program can handle is supplied by an extension
- Decides: a failure that a program raises, inspects and recovers from is not a refutation: the program is not wrong, it is reporting an outcome. An extension supplies it, as a field carried to every result with a writer anyone may use. Whether it is called an error or an exception, and how it is handled, is each extension's choice.
- Status: partly built; ruled 2026-11-11 (DR2)
- Type: capability
- Rationale kind: technical
- Depends on: An extension is made of functions and metadata fields; A refutation marks everything computed from it
- Significance: 3 — keeps recoverable failure out of the kernel
- Label: swappable — one extension's field and functions
- Options recorded: an `error` field and `make_error` in the kernel (what the code does today; rejected by the kernel's own criterion: an extension can supply it)
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr2-part-2-the-kernel.md, Rulings taken)
- Notes: replaces "Errors as a viral metadata field". The maintainer: "exception" probably fits better than "error", and the choice is left to each extension. To be placed with the standard language in Part IV when that part is reviewed.
- Held finding (2026-11-11, DR2): `error` is registered by the kernel and `make_error` is a base primitive (`src/capability.ts:182`).
- Held finding (2026-11-10, from the pilot's review §7 item 3): a user-registered `viral` field stops computation (`src/evaluator.ts:745`–`746`).
- Chapter: How metadata propagates
#### The source field: an expression as metadata
- Decides: a value can carry the Expression it evaluated from (plus span) as a `drop` field with a kernel-private writer, attached on demand at calls of source-aware functions and on resolved top-level bindings, read through `source of x` under the `observe` effect.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: A field's rule is a pure, bounded function; Writes gated by a capability, reads free; Expressions are values, forming a DAG
- Significance: 3 — gives meta-functions AST access without grammar productions
- Label: swappable — one field registration and an evaluator attachment point
- Units: metadata, capability, evaluator
- Options recorded: universal attachment (rejected: cost on every hot path); a public writer (superseded: a doctored source could make a verdict display a different proposition); source text as a second payload (rejected); a first-class inert AST value (needs a quote carrier, deferred); lazy attachment at statement level (rejected tentatively); binding-level attachment on Structures (deferred to an identity audit)
- Sources: docs/decisions.md D47, B-094-1/2/3; docs/book/allegretto/structures.md §3.1; docs/book/allegretto/metadata-and-capability.md §8
- Book home (fragments' proposal): allegretto/metadata-and-capability.md §8 (design in structures.md §3.1)
- Notes: the effect label `observe` belongs to the effects fragment.
- Chapter: How metadata propagates

#### Each layer registers its own fields
- Decides: a field is registered where its concept lives; the base registers only `error` and `source`, the fields whose concepts survive under `--base`, and a battery pins the ownership table.
- Status: partly built
- Type: capability — it decides which fields the base language has
- Rationale kind: technical
- Depends on: Everything above the kernel is an extension, and there is one way to extend; Metadata fields registered with declared propagation rules
- Significance: 3 — R6 for fields
- Label: swappable — registrations move between units
- Units: capability, metadata
- Options recorded: the base registering every field at module init (prior state, moved at B-109)
- Sources: docs/book/allegretto/metadata-and-capability.md §3, §8; docs/book/concepts.md R6 delta
- Book home (fragments' proposal): allegretto/metadata-and-capability.md §8
- Notes: `knowledge`, `warnings` and `exported` are still registered by the base with no owner (B-111).
- Held finding (2026-11-10, from the pilot's review §7 item 4): the ownership test names an owner file per field but only checks that each field is registered, never which file registered it (`src/boundary-tests.ts:924`–`936`). The fix is a test change in `src/boundary-tests.ts`; ruled case by case under R32 (M3 reconciled with the monotonic pass) if an implementation stream then holds the file.
- Chapter: How metadata propagates

#### Field versus channel, and channel registration
- Decides: open — a metadata field is storage and a channel is the capability built on one or more fields, their rules, writer and interpreting code; whether one channel-level registration ("these fields, these rules, this semantics, this owner") replaces field-by-field registration, and what the three ownerless fields are.
- Status: open
- Type: capability — the registration surface an extension author uses
- Rationale kind: technical
- Depends on: Each layer registers its own fields
- Significance: 3 — closes the fourth owed plane interface
- Label: swappable — a registration surface in the capability unit
- Units: capability, metadata
- Options recorded: none recorded beyond the hook (d) sketch; hook (e), the facts merge, is proposed to be (d)'s registration read by a second consumer
- Sources: docs/book/allegretto/metadata-and-capability.md §4; docs/plans/metadata-on-values.md §6 ruling 1 (vocabulary); docs/plans/plane-interfaces.md §6 hook (d), (e); docs/book/concepts.md §24 item 4; B-111
- Book home (fragments' proposal): allegretto/metadata-and-capability.md §4
- Chapter: How metadata propagates

#### Subsumption of legacy primitives into channel operations
- Decides: `mv_*` and `component_get` become channel reads and writers, `make_error` becomes the public writer of the viral `error` field, and the `*_attach` family collapses into writer invocations or function properties.
- Status: partly built
- Type: capability — it changes the base's primitive surface
- Rationale kind: technical
- Depends on: Minimal base surface of about forty primitives; Metadata fields registered with declared propagation rules
- Significance: 2 — local cleanups that follow from channels
- Label: swappable — each subsumption is local
- Units: base-primitives, capability
- Options recorded: none recorded
- Sources: docs/decisions.md D28; docs/plans/structures-implementation.md §6 item 3; docs/book/allegretto/structures.md Appendix B
- Book home (fragments' proposal): allegretto base-primitives chapter (planned)
- Notes: `mv_set` was deleted at B-125 (metadata-and-capability.md §6, scenario G).
- Chapter: How metadata propagates

### Four planes

#### Four planes and the placement rule
- Decides: a value's information lives on one of four planes, data (the value itself), binding (named parts), metadata (registered fields) and host (interpreter bookkeeping invisible to Allegro), and new information is placed by asking those questions in that order.
- Status: settled
- Type: capability — it decides where a value's information is visible; the host plane's invisibility is a guarantee
- Rationale kind: technical
- Depends on: Metadata is a field on every value; One composite kind: Structure
- Significance: 4 — answers "where does this go?" for every new thing
- Label: foundational — the plane lint and every plane interface rest on it
- Units: structure, metadata
- Options recorded: none recorded
- Sources: docs/book/concepts.md T2 §18
- Book home (fragments' proposal): concepts.md T2 §18 (or a planes chapter)
- Chapter: Four planes

#### Plane interfaces are sanctioned and policed
- Decides: each plane is reached only through its sanctioned interface (accessors for engine slots, `metaReadRaw` and the propagation table for metadata, install for layer meaning), and reaching it any other way is a violation, enforced by `lint:planes` on the storage plane.
- Status: partly built
- Type: implementation
- Rationale kind: technical
- Depends on: Four planes and the placement rule
- Significance: 4 — the planes become a discipline instead of a taxonomy
- Label: foundational — B-128's lints and the install hooks enforce it
- Units: structure, metadata, capability
- Options recorded: lint before interface (rejected by P5: the interface lands first)
- Sources: docs/book/concepts.md T2 §24; docs/plans/plane-interfaces.md §5.5 (P5); B-128
- Book home (fragments' proposal): concepts.md T2 §24
- Chapter: Four planes

#### Engine meta slots retired into registered members
- Decides: no new `__*` slot is ever introduced; every engine-owned binding gets a declared home (a member, a metadata field, a base concept or the host side), the partition between engine slots and user fields is the registered set, not the prefix, and the remaining prefixed names are renamed.
- Status: partly built
- Type: implementation — it renames engine slots; no program's meaning changes
- Rationale kind: technical
- Depends on: Four planes and the placement rule; Symbol identity is a fully-qualified name
- Significance: 3 — removes a duck-typing hazard and a privileged binding interface
- Label: swappable — slot by slot
- Units: structure; type-core, structure
- Options recorded: the `__` prefix as the partition (deleted as predicate at B-120 E5); slot keys partitioned by key sort (D14, mechanism of the original design); a dedicated `meta` plane for type slots (withdrawn on measurement); the `__` prefix (retired as artifact)
- Sources: docs/decisions.md D6, D14, D39; docs/book/concepts.md T2 §22, §24 disposition note; docs/book/allegretto/structures.md Appendix A; docs/book/standard/type-system.md §4; D6, D39 (docs/decisions.md); B-104, B-120 E5
- Book home (fragments' proposal): allegretto/structures.md / standard/type-system
- Notes: Merged from fragment A ("Engine meta slots retired into declared members"), fragment B ("Type metadata in registered slots, not a prefix convention"). A: decisions.md D6 names the registry `src/slots.ts`; the file is now `src/slot-accessors.ts` (units.json). 14 slots remain to become members (B-104); the boundary-lint ratchet tracks dunder literals. B: type-system.md §4 says both "retirement is not yet implemented — shipping code still uses `__*` throughout" and that host-plane names were renamed in 2026-08; the section is internally out of date. Significance calibrated from 3/2.
- Chapter: Four planes

#### The data plane has no accessor
- Decides: a value is its data, so there is no data-plane accessor; data access is well defined because above L0 values are created or modified only through defined Allegretto functions.
- Status: settled
- Type: implementation — a statement about the accessor layer
- Rationale kind: technical
- Depends on: Metadata is a field on every value
- Significance: 2 — closes a question the carrier left
- Label: swappable — a policy statement
- Units: none
- Options recorded: `dataOf`/`primaryOf` peel (deleted with 849 call sites, forbidden by lint)
- Sources: docs/book/concepts.md T0 §11 (maintainer ruling, 2026-08)
- Book home (fragments' proposal): concepts.md T0 §11
- Chapter: Four planes

#### Where the host plane is declared
- Decides: open — whether interpreter-only properties are declared on the value interfaces or on a separate host-plane interface reachable only through generated accessors, whether the unregistered properties are registered first, and what happens to the two registered as destined for the metadata plane.
- Status: open
- Type: implementation
- Rationale kind: technical
- Depends on: Four planes and the placement rule
- Significance: 2 — removes the `as any` casts that hide host access from the lints
- Label: swappable — per-unit declarations
- Units: structure, expression, composed-function, scope
- Options recorded: A declare on the value interfaces; B a separate host-plane interface behind generated accessors (recommended)
- Sources: docs/plans/host-plane-declaration.md §3, §5, §6; docs/book/units.md §4.1 "Not a unit: the host plane"; B-135, B-137
- Book home (fragments' proposal): allegretto/structures.md or kinds chapter (planned)
- Notes: units.md §4.1 says that under the unit DAG "the first reading is the natural one" (declare per unit), which leans toward option A against the plan's recommendation of B. `predicateSet` and `effectSet` are host properties with a metadata-field disposition (B-118).
- Chapter: Four planes

### Installing a layer into the base

#### An extension is made of functions and metadata fields
- Decides: the kernel gives an extension two things to build with: ordinary functions, and metadata fields, each with a rule the extension supplies for how the field travels through evaluation. Every feature above the kernel is built from these: a typed call, an operator on typed values, a check on a member.
- Status: open (the code installs host functions at fixed points of the evaluator); ruled 2026-11-11 (DR2)
- Type: capability
- Rationale kind: technical
- Depends on: Everything above the kernel is an extension, and there is one way to extend; No interface limits optimization; A field's rule is a pure, bounded function
- Significance: 5 — the whole of the extension interface
- Label: foundational — every extension, the standard language included, is built on it
- Options recorded: a kernel with a purpose-built extension point for each feature, checks, dispatch, projections and analyses installed at fixed points of the evaluator (what the code does today; rejected: the maintainer always had concerns about how such points would be handled by partial evaluation)
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr2-part-2-the-kernel.md, Rulings taken)
- Notes: replaces "The layer installs; the base never imports" and dissolves the entries on gated installs, the check hook, the dispatch hook, handles, knowledge propagation inside the evaluator, installed projections, analysis results crossing upward, and the facts plane. How today's uses fare: a typed literal is a value the extension's syntax maps to; an operator is the extension's own function; a check at a call is a claim at the top of the function's body; a computed field is an ordinary function; knowledge inside a branch is the extension's own `if` evaluating each branch with names rebound to values carrying the extra fact, using the kernel's ordinary operation of evaluating an expression with names rebound. Branch knowledge is the case to prove first.
- Held finding (2026-11-11, DR2): the evaluator calls installed host functions for merge, check, dispatch, projection, analysis and facts merge (`src/capability.ts:96`–`144`), and imports the standard language's units (`src/evaluator.ts:9`–`10`). Held here; the largest change Part II names.
- Chapter: Installing a layer into the base
#### Layers reach the base only through metadata and capability
- Decides: every L2 unit reaches L0 through the `metadata` and `capability` units, never through a kind's representation, so `refinements` and `effects` sit below `type-core` and the grammar engine depends on nothing of Allegretto.
- Status: partly built
- Type: implementation
- Rationale kind: technical
- Depends on: Each decision lives in one replaceable unit of code; An extension is made of functions and metadata fields
- Significance: 3 — P2 as a graph property
- Label: foundational — the L2 unit order rests on it
- Units: metadata, capability, refinements?, effects?
- Options recorded: none recorded
- Sources: docs/book/units.md §5; docs/plans/plane-interfaces.md §5.2
- Book home (fragments' proposal): units.md §5
- Chapter: Installing a layer into the base

#### Shared TypeScript types as representation leakage
- Decides: open — L2 representation types crossing into L0 erase at runtime but let the base destructure the layer's representation; the tension is accepted for now, with the `value` contract's own types as the sanctioned shared types, and its resolution deferred to a self-hosted semantic hierarchy.
- Status: open
- Type: implementation
- Rationale kind: technical
- Depends on: An extension is made of functions and metadata fields; Value as a contract, seven kind units and an assembly
- Significance: 2 — porous interfaces, bounded
- Label: foundational — the fix is bootstrapping-era work across layers
- Units: all L0 units
- Options recorded: none achievable with TypeScript alone
- Sources: docs/plans/plane-interfaces.md §5.6 (P6), §8.3
- Book home (fragments' proposal): units.md or allegretto/metadata-and-capability.md §7
- Chapter: Installing a layer into the base

### Scopes

#### Scope is the evaluation environment, not data
- Decides: the evaluation environment has its own protocol (parent-chain resolution, forward chaining, a facts plane), is barred from type dispatch and typing, and is mutable evaluator state where data is not.
- Status: settled
- Type: capability — it decides how a name resolves and that the environment is not user data
- Rationale kind: technical
- Depends on: One composite kind: Structure
- Significance: 4 — separates the environment from user data
- Label: foundational — the evaluator and every lookup thread a scope
- Units: scope
- Options recorded: Context with both roles (the original); Scope as a role of Structure on a shared substrate (D25's clause, superseded by D49)
- Sources: docs/decisions.md D1, D25; docs/book/concepts.md T1 §15; docs/book/allegretto/structures.md §4
- Book home (fragments' proposal): scope chapter (planned II.5)
- Chapter: Scopes

#### Scope leaves the value universe
- Decides: the evaluation environment becomes a non-value host construct with its own representation, so plane-violation checks become unrepresentable; custom scope kinds stay closed.
- Status: settled
- Type: implementation — no scope reaches user code as a value (its own options), so leaving `Value` changes the representation only
- Rationale kind: technical
- Depends on: Scope is the evaluation environment, not data; One value universe
- Significance: 3 — removes five sites that exist only to undo the sharing
- Label: foundational — primitive and evaluator signatures type their context on it
- Units: scope
- Options recorded: scopes as first-class values introspectable like any other (SC-6, superseded: no scope ever reaches user code as a value, a scope has no position for metadata, and it is mutable); custom scope kinds (rejected: no use case, forgery-prone)
- Sources: docs/decisions.md D49, D1 (superseded clause), D25 (superseded clause); docs/book/concepts.md SC-6, candidate R19; docs/plans/entry-sequence-composite.md §5.6 (not read); B-136
- Book home (fragments' proposal): scope chapter (planned II.5)
- Notes: ruled, not executed; the code still implements the superseded SC-6 (a `StructureValue` with `isScope`, `src/scope.ts:36`). Status "settled" here means ruled; nothing is built.
- Chapter: Scopes

#### Scopes layer by parent chain
- Decides: extending a scope is O(1) and does not copy; lookup walks the parent chain.
- Status: settled
- Type: implementation — concepts.md files it as an implementation choice
- Rationale kind: technical
- Depends on: Scope is the evaluation environment, not data
- Significance: 2 — cost of the operation PE performs most
- Label: swappable — inside the scope unit
- Units: scope
- Options recorded: flatten-copy on extend (the prior implementation)
- Sources: docs/book/concepts.md IC-5; docs/decisions.md D26; docs/plans/archive/structured-values-unification.md B5
- Book home (fragments' proposal): scope chapter (planned)
- Chapter: Scopes

### Evaluation over unresolved information

#### Evaluation is total over unresolved information
- Decides: the evaluator has a rule for every value it can meet, and an unresolved input produces a residual, never a failure to proceed; no operation errors on an incomplete value.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: One operation: partial evaluation; Expressions are values, forming a DAG
- Significance: 5 — without it compile and run would separate again
- Label: foundational — residuals, futures and staged discharge rest on it
- Units: evaluator
- Options recorded: none (requirement); the reading of 117 throws as evidence that R4 was over-broad was overturned
- Sources: docs/book/concepts.md R4, §26; docs/decisions.md D11; docs/book/allegretto/README.md invariants
- Book home (fragments' proposal): concepts.md Part 0 (R4)
- Notes: concepts.md §26 says `isResolved` is "walked structurally" and that an unresolved value "transitively contains" a symbol or pending cell; `src/types.ts:455-470` answers true for any Structure whatever its slots hold, as evaluator.md §3 says. §26 is wrong about the code. Told in the tour.
- Chapter: Evaluation over unresolved information

#### PE Rule 1: residualise, but unfold composed calls
- Decides: an application with an unresolved argument residualises with fields propagated, unless it applies a composed function, which is unfolded into its substituted body, except a call into a recursion cycle during a typed compilation and a call inside a speculated `when` arm, which residualise carrying the callee's effects.
- Status: settled
- Type: capability — it decides what a residual is, which every check reads
- Rationale kind: technical
- Depends on: Evaluation is total over unresolved information; Functions are data: params plus body; How the base applies propagation
- Significance: 4 — unfolding is what lets discharge see inside a call
- Label: foundational — refinement checks, effect inference and theorem discharge rely on unfolding
- Units: evaluator
- Options recorded: (a) restate the rule with unfolding as policy (taken); (b) residualise every composed call with an unresolved argument plus a separate inlining stage (rejected: loses discharge inside calls)
- Sources: docs/book/concepts.md §25; docs/plans/pe-rules.md §6 RR1, RR9; docs/book/allegretto/evaluator.ir.md C201 to C205
- Book home (fragments' proposal): concepts.md T3 §25 / allegretto/evaluator.md §3
- Notes: Significance calibrated from 5.
- Chapter: Evaluation over unresolved information

#### PE Rule 2: speculate every branch, run no effect
- Decides: a lazy primitive with an unresolved control input evaluates every branch speculatively (`eval_if` both branches, `eval_when` every arm's guard and body with pattern names as fresh Params, the right operand of `&&` and `||`) in a fresh child scope marked as compile mode, so an effect reached there becomes a residual carrying its effects.
- Status: settled
- Type: capability — it decides what a residual is, which every check reads
- Rationale kind: technical
- Depends on: PE Rule 1: residualise, but unfold composed calls; Host functions as values with declared evaluation control
- Significance: 4 — an unknown condition no longer hides everything behind it
- Label: foundational — effect inference through branches rests on it
- Units: evaluator, base-primitives
- Options recorded: RR2 (b) type patterns bind typed placeholders (deferred, needs the type side); RR2 (c) exempt binding primitives; RR3 (b) speculate only in precompile; RR3 (c) exempt short-circuit operators; RR7 (b) always residualise a branch tail call; RR9 options A, B, B2 for nested speculation cost (C taken)
- Sources: docs/book/concepts.md §25; docs/plans/pe-rules.md §6 RR2, RR3, RR7, RR9; docs/book/allegretto/evaluator.ir.md C178 to C200
- Book home (fragments' proposal): concepts.md T3 §25 / allegretto/evaluator.md §3
- Notes: `allegretto/evaluator.md` §3 prose still says `eval_when`, `&&` and `||` do not meet Rule 2 and that `eval_when` evaluates no branch; the IR (C179, C189 to C196) and the code (`speculate` at `src/evaluator.ts:331`, `speculateWhenArms` at `src/primitives.ts:865`) say they do. The residual `eval_when` holds arms as written, not evaluated (C196). Rule 2 is left to each lazy primitive's implementation (C50). RR9's narrowing is to be revisited "when we want to push PE for more optimizations".
- Chapter: Evaluation over unresolved information

#### Incompleteness lives in write-once future cells
- Decides: structures are always structurally complete; incompleteness is an unresolved future occupying a slot, never a structure state, and the future is its sole external locus: a write-once monotonic cell filled once, with `Future[Future[T]]` flattening and equality on an unresolved future residualising, write-once enforced at the phase interface; one representation serves REPL declarations, forward chaining and async futures.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Evaluation is total over unresolved information
- Significance: 3 — one representation for every kind of pending; monotonicity keeps forward chaining sound
- Label: foundational — completion, forward chaining and async rest on it
- Units: scope, futures
- Options recorded: `ctx_use` and `Binding.isUse` as a separate declared-without-value state (retired); none recorded beyond the Oz/IVar precedent
- Sources: docs/decisions.md D12, D26, D33, CE-R5, CE-R6; docs/book/allegretto/structures.md §4, §10; docs/book/concepts.md §28
- Book home (fragments' proposal): futures chapter (planned)
- Notes: Merged in chunk P1b from "Incompleteness is a value in a slot" and "Future cells: write-once, monotonic, flattening": the first states incompleteness as a future, the second states the future as the locus of incompleteness, so neither holds without the other (see "The type check, 2026-11-05"). From the second: incompleteness detection as an effect and `Future[T]` as a type belong to the L2 fragment; CE-R6 (no future manager in base mode is a configuration error, not incompleteness) is L0.
- Chapter: Evaluation over unresolved information

#### Evaluation resumes on new information by forward chaining
- Decides: when a cell is filled, everything that residualised on it re-evaluates, and this completion cascade is base evaluator machinery, not a primitive.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Incompleteness lives in write-once future cells
- Significance: 4 — loading and async re-enter an evaluation that already ran
- Label: foundational — module loading and async results depend on it
- Units: futures
- Options recorded: single-pass PE (rejected: anything unknown at that instant stays residual)
- Sources: docs/book/concepts.md R10, §28; docs/decisions.md D27, D33; docs/book/allegretto/structures.md §10 (B-028 status)
- Book home (fragments' proposal): futures chapter (planned)
- Notes: slot substitution is per binding and shallow; a pending slot in a structure never registered as a dependent stays symbolic until read (structures.md §10 residue).
- Chapter: Evaluation over unresolved information

#### Determinism and confluence of evaluation
- Decides: open — whether the same source and inputs must give the same residual, and whether arrival order of completions provably cannot matter.
- Status: open
- Type: capability
- Rationale kind: technical
- Depends on: Evaluation resumes on new information by forward chaining
- Significance: 3 — reproducible builds and re-checkable proofs need it
- Label: foundational — proof re-checking would rest on it
- Units: futures
- Options recorded: none recorded; an arrival-order bug was fixed by completion replacement, not by construction
- Sources: docs/book/concepts.md candidate R16, §28 delta; B-114; docs/book/allegretto/structures.md §6 "Confluence invariant"
- Book home (fragments' proposal): futures chapter (planned)
- Chapter: Evaluation over unresolved information

#### Substitution of params into bodies
- Decides: applying a composed function substitutes each owned Param by position, leaves Symbols to resolve by name through the scope, shares unchanged subtrees, and copies an inner function whose body changed with fresh Params and its metadata carried.
- Status: settled
- Type: implementation — how application is computed; name resolution is the scope's
- Rationale kind: technical
- Depends on: Positional parameters owned by membership; Functions are data: params plus body
- Significance: 3 — the core of application
- Label: swappable — inside the evaluator
- Units: evaluator
- Options recorded: none recorded
- Sources: docs/book/allegretto/evaluator.md §4
- Book home (fragments' proposal): allegretto/evaluator.md §4
- Chapter: Evaluation over unresolved information

#### Tail calls by sentinel and loop
- Decides: a call in tail position of a function body, marked before precompile, returns a host sentinel that the enclosing application loops on at the first round's depth, so recursion depth is not bounded by the host stack; body wrappers forward the sentinel.
- Status: partly built
- Type: implementation — the mechanism; a tail call that does not grow the depth is its effect
- Rationale kind: technical
- Depends on: Substitution of params into bodies
- Significance: 3 — unbounded recursion through typed functions
- Label: swappable — inside the evaluator
- Units: evaluator
- Options recorded: none recorded
- Sources: docs/book/allegretto/evaluator.md §5; docs/book/concepts.md §27; docs/plans/pe-rules.md §6 RR7
- Book home (fragments' proposal): allegretto/evaluator.md §5
- Notes: nothing checks that a wrapper forwards the sentinel (B-113).
- Chapter: Evaluation over unresolved information

#### One residualising resolution semantics for scopes
- Decides: resolving a name is one path: bound gives the value with merged facts, unresolved gives a residual and never a throw; a genuinely absent source-level name is a compile-time error, and the reflective lookup returns an error value.
- Status: partly built
- Type: capability
- Rationale kind: technical
- Depends on: Scope is the evaluation environment, not data; Evaluation is total over unresolved information
- Significance: 2 — unifies two divergent paths
- Label: swappable — inside the scope unit
- Units: scope
- Options recorded: the evaluator residualising while `ctx_resolve` throws (the prior split)
- Sources: docs/decisions.md D26, D11; docs/book/allegretto/structures.md §4
- Book home (fragments' proposal): scope chapter (planned)
- Notes: structures.md §4 marks the Allegro-surface `scope_*` primitives as still pending.
- Chapter: Evaluation over unresolved information

#### Evaluation stops early for two reasons only
- Decides: the kernel halts an evaluation midway when one of its own invariants is broken, which is a fault in the kernel, or when a resource limit is reached. Nothing a program does makes the kernel stop midway. A claim whose evaluation hits a limit is left undecided, not refuted. An evaluation that hits a limit elsewhere ends with the limit named and everything unfinished reported as undecided.
- Status: partly built; ruled 2026-11-11 (DR2)
- Type: capability
- Rationale kind: technical
- Depends on: A refutation marks everything computed from it; Evaluation is total over unresolved information
- Significance: 3 — separates the kernel's own faults and limits from a program's mistakes
- Label: swappable — the limits and how they are reported
- Options recorded: five classes of abort, capability denial and ill-formed application among them (what the inventory listed; three of the five are refutations or cannot arise)
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr2-part-2-the-kernel.md, Rulings taken)
- Notes: replaces "Specified aborts" and absorbs "Capability denial is an abort, not an error value" (with authority a held value there is nothing to deny at run time) and "Evaluation depth bound" (one resource limit, 10,000 levels today).
- Chapter: Evaluation over unresolved information
### Grammars as values

#### Grammars are Allegro values
- Decides: a grammar is an ordinary Allegro Object of named productions over a `Rule` union (Terminal, NonTerm, Seq, Alt, Rep, Opt, Guarded) with a start symbol, so grammars are built, composed and analysed like any other value.
- Status: settled
- Type: capability
- Rationale kind: vision
- Depends on: The kernel holds no language; One value universe
- Significance: 4 — runtime grammar extension, `use` activation and the analyzer all operate on grammar values
- Label: foundational — fragment merging, base chains and `grammar2_*` primitives assume it
- Units: grammar-formalism
- Options recorded: none recorded (the Pratt + Earley hybrid it replaced is noted as superseded)
- Sources: docs/book/grammar-formalism.md §1, §2, §9, §6; docs/book/extension/grammar.md §1
- Book home (fragments' proposal): grammar-formalism (chapter "The grammar formalism")
- Chapter: Grammars as values

#### Scannerless parsing
- Decides: grammars consume characters directly with no tokenizer; whitespace is explicit in the formalism, and keywords and identifiers share character space.
- Status: settled
- Type: capability — grammar authors write character-level rules
- Rationale kind: technical
- Depends on: Grammars are Allegro values
- Significance: 3 — extensions can add tokens (`**`, `3 m`) without a lexer change
- Label: foundational — the whitespace interleave, guards and reservation sets exist because of it
- Units: grammar-formalism
- Options recorded: a tokenizer layer, kept as the known optimization "if larger files demand it" (benchmark first); an external LL(k)+Pratt experiment, deferred
- Sources: docs/book/grammar-formalism.md §1, §4; docs/book/extension/grammar.md §3 "Performance headroom"
- Book home (fragments' proposal): grammar-formalism
- Chapter: Grammars as values

#### Ambiguity is banned and detected, not resolved by alternative order
- Decides: the intended design is that precedence, associativity and longest-match metadata drive disambiguation, ambiguity is a compile-time error, and alternative order carries no meaning.
- Status: open
- Type: capability
- Rationale kind: mixed
- Depends on: Grammars are Allegro values; Order of definition carries no meaning
- Significance: 3 — decides whether user extensions inherit silent ordering hazards
- Label: foundational — the analyzer's disjointness check, `@prec`/`@assoc` semantics and every base production that relies on order
- Units: grammar-formalism, base-grammar
- Options recorded: ordered choice as shipped (alt order significant); full disjointness enforcement with explicit opt-outs
- Sources: docs/book/grammar-formalism.md §1, §3.1, §7.1, §7.5 (W_ALT_OVERLAP opt-in); docs/book/extension/grammar.md §2 (maintainer ruling 2026-06, "under revision")
- Book home (fragments' proposal): extension/grammar
- Notes: shipped behaviour contradicts the formalism: `analyzeWithDisjointnessCheck` is opt-in because the base grammar relies on ordering, and the `expr_form` front-splice rule depends on ordered choice. The redesign is "design-discussion scope". Also under revision: tree-builder child access should be label-directed, not positional (grammar.md §2).
- Chapter: Grammars as values

#### Named, partially ordered precedence levels
- Decides: precedence levels are named and related by before/after constraints that the analyzer topologically sorts; one-sided constraints are accepted whenever they resolve every actual ambiguity, and no integers appear in the user-visible spec.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Grammars are Allegro values
- Significance: 3 — makes operator extension composable between independent libraries
- Label: swappable — confined to precedence analysis and level insertion
- Units: grammar-formalism, grammar-extension
- Options recorded: integer precedence (rejected); requiring a total order (rejected in favour of "specify what you know")
- Sources: docs/book/grammar-formalism.md §3.1, §7.3, §11 item 4; §6.4 (prec(X), above/below, at("*")); archive dappled-cascading-cantor.md "Inside the block"
- Book home (fragments' proposal): grammar-formalism
- Notes: `E_PREC_UNDERCONSTRAINED` is specified but is not in the shipped code list (§7.5); only `E_PRECEDENCE_CYCLE` ships.
- Chapter: Grammars as values

#### Offside rule through stateful indent terminals
- Decides: indentation is expressed by stateful terminals `NEWLINE`, `INDENT`, `DEDENT`, `SAMELINE` with parser position `(offset, indent stack)`; `NEWLINE` fires only when the next content is at or below the block's indent, so continuation lines need no special construct.
- Status: partly built
- Type: capability — grammar authors name the indent terminals in their rules
- Rationale kind: technical
- Depends on: Scannerless parsing
- Significance: 3 — offside-rule grammars (the planning DSL) and mixed modes rest on it
- Label: swappable — engine terminal handling
- Units: grammar-formalism
- Options recorded: a dedicated continuation construct (rejected); tab handling proposals (tabs forbidden by default, `tab_width` opt-in)
- Sources: docs/book/grammar-formalism.md §5.1–§5.5; docs/book/extension/grammar.md §3
- Book home (fragments' proposal): grammar-formalism
- Notes: `SAMELINE` is not implemented (`src/grammar2/engine.ts:712`); §5.4's tab and empty-stack questions are "Proposed", not recorded as decided.
- Chapter: Grammars as values

#### Guards and reservation sets separate keywords from identifiers
- Decides: zero-width guards (`NotFollowedBy`, `FollowedBy`, `Reserved(set)`) and named, cumulative reserved sets keep keywords out of identifiers; `left`/`right`/`none` are reserved globally for simplicity.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Scannerless parsing
- Significance: 2 — every keyword an extension adds faces the same choice
- Label: swappable — base-grammar and analyzer
- Units: grammar-formalism, base-grammar
- Options recorded: context-sensitive reservation of `left`/`right`/`none` (only inside `grammar { … }`), to revisit if it breaks user code
- Sources: docs/book/grammar-formalism.md §2.4, §3.3, §4.1, §11 item 3; docs/book/extension/grammar.md §4
- Book home (fragments' proposal): grammar-formalism
- Chapter: Grammars as values

#### Parse failure reporting and recovery
- Decides: failure reports the farthest advance with expected-versus-got; error productions (`@error`) and `@sync` panic recovery are core features, with sync points declared at natural boundaries in the base grammar.
- Status: partly built
- Type: capability
- Rationale kind: technical
- Depends on: Grammars are Allegro values
- Significance: 2 — user-facing parse diagnostics
- Label: swappable — engine
- Units: grammar-formalism
- Options recorded: `@sync` optional (rejected: "core feature, not optional")
- Sources: docs/book/grammar-formalism.md §3.5, §8.2–§8.4, §11 item 6; docs/book/extension/grammar.md §3 (gaps)
- Book home (fragments' proposal): grammar-formalism
- Notes: farthest-advance ships; `@error` and `@sync` do not.
- Chapter: Grammars as values

#### Memoized recursive-descent engine with seed-growing left recursion
- Decides: the engine is a scannerless recursive parser with memoization, ordered choice, Warth-style seed-growing left recursion and stateful indent terminals, with farthest-advance error reporting.
- Status: partly built
- Type: implementation — the parsing algorithm, which the rulings keep swappable
- Rationale kind: technical
- Depends on: Scannerless parsing; Grammars are Allegro values; Offside rule through stateful indent terminals; Parse failure reporting and recovery
- Significance: 3 — fixes parse cost and which grammars run
- Label: swappable — behind the grammar-formalism unit's parse interface; by the maintainer's ruling of 2026-11-05, any algorithm may replace it except one that requires ordered choice, and the shipped ordered choice is to be replaced by GLL or a similar algorithm
- Units: grammar-formalism
- Options recorded: GLL (the formalism's stated choice); full GLL "where Warth iteration falls short" (open gap); the retired Pratt + Earley hybrid
- Sources: docs/book/grammar-formalism.md status header, §1 non-goals, §5.1, §7.1; docs/book/extension/grammar.md §1, §3
- Book home (fragments' proposal): extension/grammar (chapter "The parser engine")
- Notes: contradiction — grammar-formalism.md §1 says "GLL is chosen" and §5.1 speaks of "GLL memoization", while grammar.md §1/§4 describe a memoized parser with "PEG-committed ordered choice". The Earley parser (`src/parser.ts`, `src/grammar-ext.ts`) remains only for the standalone `grammar_*` combinators; its retirement in favour of `grammar2_*` is a backlog item.
- Chapter: Grammars as values

#### The precedence ladder runs as repetition, and memo invalidation tracks dependencies
- Decides: the base grammar's levels are specified left-recursively but rewritten to `tighter (OP tighter)*` and folded back into left-nested nodes by the tree builder; left-recursion growth invalidates only memo entries that read a seed at the same position.
- Status: settled
- Type: implementation
- Rationale kind: technical
- Depends on: Memoized recursive-descent engine with seed-growing left recursion; Named, partially ordered precedence levels
- Significance: 2 — parse performance with an unchanged built program
- Label: swappable — engine and tree-builder internals
- Units: grammar-formalism, base-grammar, tree-builder
- Options recorded: running the left-recursive specification directly; clearing every memo entry at the position (the earlier conservative rule)
- Sources: B-157 P7 and P5 (docs/book/extension/grammar.md §1); grammar-formalism.md §6.4; Warth, Douglass and Millstein 2008
- Book home (fragments' proposal): extension/grammar
- Chapter: Grammars as values

#### Static analysis of grammars
- Decides: `analyze(grammar)` is a pure function computing nullability, FIRST/FOLLOW and reporting undefined names, infinite repetition, unreachable productions (warning) and left-recursion classification, cached per grammar identity.
- Status: partly built
- Type: capability — a function grammar authors call
- Rationale kind: technical
- Depends on: Grammars are Allegro values; Ambiguity is banned and detected, not resolved by alternative order
- Significance: 2 — the check that lets extensions fail early
- Label: swappable — analyzer
- Units: grammar-formalism
- Options recorded: unreachable as error (rejected: may be an intentional extension hook); `Opt`+`@prec` overlap as analyzer error (resolved, §11 item 5)
- Sources: docs/book/grammar-formalism.md §7.1–§7.5, §11 item 5
- Book home (fragments' proposal): grammar-formalism
- Notes: FIRST-set completion is an open gap (grammar.md §3).
- Chapter: Grammars as values

### Extending the grammar

#### Grammar extension as operation deltas, extensible by default
- Decides: extension is `extend(base, delta)` where a delta maps productions to `Add`, `Append`, `Replace`, `ReplaceAlt`, `Remove` or `Wrap`; `Append` auto-wraps a non-Alt production, and every rule is extensible with no `@extensible` gate.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Grammars are Allegro values
- Significance: 3 — the one mechanism every syntax extension lowers to
- Label: foundational — fragment merging and the `grammar { … }` surface lower to these operations
- Units: grammar-extension
- Options recorded: an opt-in `@extensible` gate (rejected); a future opt-out `@frozen`/`@sealed` for whitespace and core terminals; positional `ByIndex` selectors (allowed, discouraged)
- Sources: docs/book/grammar-formalism.md §6, §6.1, §11 items 1–2
- Book home (fragments' proposal): grammar-formalism
- Chapter: Extending the grammar

#### Grammar extension never mutates the base
- Decides: extension is immutable layering with structural sharing; base grammars are never mutated.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Grammar extension as operation deltas, extensible by default; Structures immutable by default; derive, never mutate
- Significance: 3 — makes per-file extension scope and shared libraries safe
- Label: foundational — per-file activation and the shared module cache assume it
- Units: grammar-extension
- Options recorded: none recorded
- Sources: docs/book/extension/README.md "Invariants"
- Book home (fragments' proposal): extension/grammar
- Chapter: Extending the grammar

#### The declarative `grammar { … }` block with hygienic templates
- Decides: modules declare syntax with `infix`/`prefix`/`postfix`/`expr_prefix`, `rule NAME =`/`+=`/`-=`/`[alt] =`, `expr_form` and `stmt_form` clauses whose EBNF bodies bind labels positionally to a template, substituted at parse time; free symbols in templates resolve in the defining module's context at definition time.
- Status: settled
- Type: capability
- Rationale kind: mixed
- Depends on: Grammar extension as operation deltas, extensible by default; Named, partially ordered precedence levels
- Significance: 3 — the user-facing extension surface that `lib/` forms (contracts, totality, units, match) use
- Label: swappable — it lowers to operation deltas
- Units: grammar-extension, tree-builder
- Options recorded: arbitrary parse-time builder lambdas (deferred); non-hygienic capture of parse-site names (the Phase 6 state, replaced in Phase 7); offside `grammar:` block form
- Sources: docs/book/grammar-formalism.md §6.4; docs/book/extension/grammar.md §4; archive dappled-cascading-cantor.md "Design summary", "Scope boundaries"
- Book home (fragments' proposal): extension/grammar
- Chapter: Extending the grammar

#### Rules for user-written EBNF
- Decides: `ws_any` is interleaved between sequence items unless an explicit whitespace production is written; `expr_form` alternatives splice at the front of `expr_atom`; `INDENT`/`NEWLINE`/`DEDENT` are reachable by name; a `stmt_form` expanding to `binding_decl(...)` declares a binding; a label's matched text builds as a string literal.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: The declarative `grammar { … }` block with hygienic templates; Offside rule through stateful indent terminals
- Significance: 1 — local rules for extension authors
- Label: swappable — tree-builder and fragment merging
- Units: grammar-extension, tree-builder
- Options recorded: splicing `expr_form` before the `ident` fallthrough (rejected: number-led forms were dead code); a label match as a length-typed Bits (rejected: an eight-byte match read as an Int)
- Sources: B-092 U2 and B-151 B1 (docs/book/extension/grammar.md §4)
- Book home (fragments' proposal): extension/grammar
- Notes: the front-splice rule depends on ordered choice, which "Ambiguity is banned and detected" calls an artifact.
- Chapter: Extending the grammar

### Modules, the use header and one pipeline

#### Extensions are the module substrate
- Decides: anonymous extensions (named bindings injected by the execution context, layered between primitives and source) are the substrate, and a module is an extension built from an `.alg` file; `import name` is declarative, with module values provided through extensions rather than loaded at the import site.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: The kernel holds no language; Scope is the evaluation environment, not data
- Significance: 4 — the standard library, grammars and the type system all arrive as extensions
- Label: foundational — loading, typed module objects and grammar harvesting
- Units: module-loading
- Options recorded: none recorded
- Sources: docs/book/extension/modules.md "Loading (L1)"; docs/book/extension/README.md "Provides"
- Book home (fragments' proposal): extension/modules
- Chapter: Modules, the use header and one pipeline

#### Module loading and typed module objects are separate layers
- Decides: loading (paths, dependency resolution, caching, cycle detection) is L1 and knows nothing of types; typed module objects, export surfaces and encapsulation are L2.
- Status: settled
- Type: implementation — a cut between units
- Rationale kind: technical
- Depends on: Extensions are the module substrate
- Significance: 3 — fixes the L1/L2 boundary for modules
- Label: foundational — typed-modules depends on module-loading
- Units: module-loading, typed-modules
- Options recorded: the v1 implicit split (made the contract)
- Sources: Layer ruling 2 (docs/decisions.md "Standing rulings"); docs/book/layers.md §1; docs/book/extension/README.md "Explicitly NOT in this layer"; docs/book/extension/modules.md header
- Book home (fragments' proposal): extension/modules
- Notes: `src/modules.ts` is still mixed (module-loading + typed-modules per scripts/analyze/units.json).
- Chapter: Modules, the use header and one pipeline

#### Build pipeline as a track, not a layer
- Decides: the build pipeline is a capability track that may consume any layer's surface and is never a dependency of a layer, and its delivered part, the `pipeline` unit, sits at the top of the unit DAG, the one unit allowed to import any other.
- Status: settled
- Type: implementation
- Rationale kind: technical
- Depends on: Everything above the kernel is an extension, and there is one way to extend; Each decision lives in one replaceable unit of code
- Significance: 3 — places assembly above everything
- Label: foundational — introspect and cli depend on the pipeline; every decision found inside the pipeline must belong to another unit
- Units: pipeline
- Options recorded: build pipeline as a layer (the old milestone list)
- Sources: Standing rulings, layer ruling 4 (docs/decisions.md); docs/book/layers.md §2, §3; docs/book/platform/build-pipeline.ir.md C9 to C11
- Book home (fragments' proposal): Layers, tracks and milestones / The evaluation pipeline
- Notes: `src/runtime.ts` is still mixed across four units; three moves are owed and unscheduled (C136, C143). Significance calibrated from 4.
- Chapter: Modules, the use header and one pipeline

#### One evalSource pipeline for programs and libraries
- Decides: every program, REPL entry, subcommand and library load passes through the same `evalSource` pipeline, so every compile-time check fires inside libraries exactly as in user code.
- Status: settled
- Type: implementation — it realises the clause of "Claims are evaluated like everything else" that libraries are checked as user code
- Rationale kind: mixed
- Depends on: Extensions are the module substrate; Build pipeline as a track, not a layer
- Significance: 4 — makes library assurance the same assurance as user code
- Label: foundational — every halt rule and the owner-module invariant assume it
- Units: module-loading, pipeline; pipeline, module-loading
- Options recorded: a separate library loader path (the v1 lesson that motivated the invariant)
- Sources: docs/book/extension/README.md "Invariants"; docs/book/extension/modules.md "One pipeline"; CLAUDE.md halt invariant; docs/book/extension/modules.md (One pipeline); docs/book/platform/build-pipeline.ir.md C14, C15, C64, C130; docs/book/vivace/planning-dsl.md §6 (compile-time checks inside libraries)
- Book home (fragments' proposal): extension/modules / The evaluation pipeline
- Notes: Merged from fragment B ("One pipeline for libraries and programs"), fragment C ("One evalSource pipeline for programs and libraries"). Significance calibrated from 4/5.
- Chapter: Modules, the use header and one pipeline

#### `use` header for language extension, `import` for module values
- Decides: a file's top-of-file header activates extensions with `use NAME`, `use import NAME`, `use NAME.MEMBER` and `use grammar { … }`, while `import name` in the body declares a module value supplied as an extension, not loaded imperatively at the site.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Everything above the kernel is an extension, and there is one way to extend; Extensions are the module substrate
- Significance: 3 — the gate between a file and every DSL it speaks
- Label: foundational — the CLI, the module loader, the sandbox, the pipeline's input contract and every library DSL depend on the split
- Units: module-loading, cli, grammar-extension
- Options recorded: `use_grammar` (the Phase 1 spelling, superseded)
- Sources: docs/book/grammar-formalism.md §6.2; docs/book/extension/modules.md (Loading: Import syntax, One pipeline); docs/book/platform/tooling.ir.md C37 to C44; docs/book/platform/build-pipeline.ir.md C29, C156
- Book home (fragments' proposal): Module loading and module objects / Surface syntax of Allegro Standard (proposed)
- Notes: the header is handled by each caller, and the callers disagree: inspect and verify load no module for `use NAME.MEMBER` or inline grammar (tooling C67, C69), the REPL loads none (C60, C61), `prove` leaves the header unstripped and fails (C133 to C135), the sandbox has its own `scanUses` (host C79). `use grammar { … }` inside libraries is rejected (modules.md, Known limit). Assembly: the dependency on "Callers pre-scan and strip the `use` header" was dropped to break a two-entry cycle; the pre-scan implements the header, so the pre-scan depends on the header. Significance calibrated from 4.
- Chapter: Modules, the use header and one pipeline

#### Activation by a `use` header, per file and not transitive
- Decides: a top-of-file `use NAME` / `use import NAME` / `use NAME.MEMBER` / `use grammar { … }` header extends the active grammar before the rest of the file parses; the extension holds for that file only, never leaking into the modules it imports, the files that import it or the REPL, and is not re-exported; grammars merge only when one base chain (`allegro`, `empty`, or `extends X`) is a prefix of the other.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Grammar extension never mutates the base; Extensions are the module substrate; `use` header for language extension, `import` for module values
- Significance: 3 — defines how syntax reaches a program
- Label: foundational — the use-scanner, module loading of grammars and per-file isolation
- Units: grammar-extension, module-loading
- Options recorded: `use <expr>` with a combinator whitelist (`combine`/`override`/`without`, `E_USE_EXPR_TOO_COMPLEX`; never shipped); per-block or per-production activation (deferred); single-pass `use` (deferred, pre-scan stays two-pass); modules re-exporting grammars explicitly
- Sources: docs/book/grammar-formalism.md §6.2 (both), §6.3; docs/book/extension/grammar.md §4; docs/book/extension/modules.md "Known limit"; archive dappled-cascading-cantor.md "use X", "Scope boundaries"; docs/book/grammar-formalism.md §6.3; docs/book/extension/grammar.md §4 (no transitive re-export)
- Book home (fragments' proposal): extension/grammar / Grammar and parser
- Notes: Merged from fragment B ("Activation by a `use` header, scoped to one file, compatible by base chain"), fragment C ("Grammar activation is per file and not transitive"). B: `use grammar { … }` inside a lib is rejected (needs a bootstrap `evalSource` recursion).
- Chapter: Modules, the use header and one pipeline

#### Module resolution, caching and the session's runtime
- Decides: the loader resolves local `lib/` first then the system `lib/`, detects circular dependencies, loads each file once per process (cache keyed by resolved path and content) and threads the session's FutureManager into module evaluation; base mode without a manager keeps an explicit configuration error.
- Status: settled
- Type: capability — the search order, cycle detection and load-once are what a program sees; threading the future manager is the realising part
- Rationale kind: technical
- Depends on: Extensions are the module substrate; Incompleteness lives in write-once future cells
- Significance: 2 — load cost and module identity
- Label: swappable — module-loading internals
- Units: module-loading
- Options recorded: per-loader caches (replaced by one per-process cache); treating a missing async runtime as value incompleteness (rejected, CE-R6: it is a configuration error)
- Sources: B-157 P2 (docs/book/extension/modules.md "Loaded once per process"); CE-R6 (docs/decisions.md; docs/plans/completion-effects.md §3)
- Book home (fragments' proposal): extension/modules
- Chapter: Modules, the use header and one pipeline

#### A library's values are immutable after load
- Decides: a module writes only into values it constructed (the owner module); in-place pipeline writers (member re-keying, the divergence stamp, the precompile effect write) skip library-owned values, and member re-keying is write-once.
- Status: settled
- Type: implementation — the owner-module rule for in-place writers
- Rationale kind: technical
- Depends on: Module resolution, caching and the session's runtime; One evalSource pipeline for programs and libraries
- Significance: 3 — makes sharing one loaded library across programs sound
- Label: foundational — every future in-place writer must consult the library-owned set
- Units: module-loading, pipeline, type-core
- Options recorded: none recorded
- Sources: B-158 (docs/book/extension/modules.md "Owner module", ruled 2026-10-29); CLAUDE.md invariant; test module: B-158 in src/test/modules.ts
- Book home (fragments' proposal): extension/modules
- Chapter: Modules, the use header and one pipeline

#### Execution contexts layer as a scope chain
- Decides: primitives ← extensions ← base (REPL persistence) ← source are real scope-chain layers linked by parent pointers (O(1) extend), not a flat copy; the returned evaluation context is the source layer.
- Status: settled
- Type: implementation
- Rationale kind: technical
- Depends on: Scopes layer by parent chain; Extensions are the module substrate
- Significance: 2 — how extensions become visible to source
- Label: swappable — behind scope lookup
- Units: module-loading, scope
- Options recorded: flat copy of bindings (replaced)
- Sources: C2.3b (docs/book/extension/modules.md "Context layering"); structures.md §4
- Book home (fragments' proposal): extension/modules
- Chapter: Modules, the use header and one pipeline

#### Callers pre-scan and strip the `use` header
- Decides: `evalSource` runs no `use` pre-scan; each caller scans the header, loads the named modules as extensions, and strips the header before the call.
- Status: settled
- Type: implementation
- Rationale kind: technical
- Depends on: `use` header for language extension, `import` for module values
- Significance: 2 — fixes the pipeline's input contract
- Label: swappable — moving the scan into the pipeline would change one stage
- Units: pipeline, module-loading, cli
- Options recorded: none recorded
- Sources: docs/book/platform/build-pipeline.ir.md C29, C156, R5; src/use-scanner.ts (shared scanner)
- Book home (fragments' proposal): The evaluation pipeline
- Notes: the duplication across callers is the source of the inconsistent `use` handling listed under the `use` entry.
- Chapter: Modules, the use header and one pipeline

#### Conflicts are validated before activation
- Decides: a cross-fragment validator runs before merging and aborts the `use` with aggregated `E_OPERATOR_CONFLICT`, `E_KEYWORD_CONFLICT`, `E_PRECEDENCE_CYCLE` or `E_INCOMPATIBLE_GRAMMARS`; replacing a base production with `rule NAME =` warns (`W_PRODUCTION_REPLACED`) rather than errors.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Activation by a `use` header, per file and not transitive
- Significance: 2 — independent extensions fail loudly when they clash
- Label: swappable — validator
- Units: grammar-extension
- Options recorded: replacement as an error (rejected: replacement is a legitimate technique; silent shadowing "has bitten before", so it warns)
- Sources: W_PRODUCTION_REPLACED ruling (docs/decisions.md "Standing rulings"); docs/book/extension/grammar.md §4; docs/book/grammar-formalism.md §7.5; docs/book/extension/README.md "Invariants"
- Book home (fragments' proposal): extension/grammar
- Chapter: Modules, the use header and one pipeline

### Types as values

#### Types are values that constrain values
- Decides: a type is an ordinary Structure carried in a value's `type` metadata field, built by ordinary calls (`Type.define`), and a type is a predicate over values; a type check is an evaluation.
- Status: settled
- Type: capability
- Rationale kind: vision
- Depends on: One operation: partial evaluation; Metadata is a field on every value; One value universe
- Significance: 5 — the type system is an extension and PE-as-discharge applies to it
- Label: foundational — kinds, refinements, effects as values and every check depend on it
- Units: type-core
- Options recorded: a privileged type layer (rejected by R1/R6)
- Sources: docs/book/concepts.md §30; docs/book/standard/type-system.md §1; D4 (docs/decisions.md)
- Book home (fragments' proposal): standard/type-system (chapter "Types")
- Notes: concepts §30 delta: the closed type-Context namespace is unstated and unenforced (B-107). Told in the tour.
- Chapter: Types as values

#### Kinds are types, and Type is its own type
- Decides: a kind is a type whose instances are types (`Type`, `Refinement`, `Interface`, `GenericType`, `Effect`, `Proof`), instance-of is shape-of, members live once on the kind, and `Type : Type` is kept with universe stratification left to the proof-export boundary.
- Status: settled
- Type: capability
- Rationale kind: mixed
- Depends on: Types are values that constrain values
- Significance: 4 — Effect and Proof are re-derived through one kind recipe
- Label: foundational — Effect, Proof and Interface kinds
- Units: type-core
- Options recorded: a reified Kind tower (rejected, D7); a privileged root (rejected)
- Sources: D40, D7 (docs/decisions.md; structures.md §9); docs/book/concepts.md §31; docs/book/standard/README.md (kind recipe as exit criterion)
- Book home (fragments' proposal): standard/type-system
- Chapter: Types as values

#### Members are keyed by symbol and conformance is membership
- Decides: type members are interned fully-qualified member symbols; a type conforms by drawing another type's member symbols, so two types that each spell `size` do not conform by accident.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Symbol identity is a fully-qualified name; Types are values that constrain values
- Significance: 4 — conformance, laws and privacy all key on member symbols
- Label: foundational — lawful interfaces, private members and `distinct`
- Units: type-core
- Options recorded: spelling-based nominal chain-walk (replaced); diamonds dedupe by symbol identity or error
- Sources: D30 (docs/decisions.md; structures.md §5, §8); docs/book/concepts.md §33; C5.2-R1–R6
- Book home (fragments' proposal): standard/type-system
- Chapter: Types as values

#### Every Standard value has a type, with no implicit fallback
- Decides: in Standard mode every value is typed (base primitives entering the context are wrapped as `UntypedFunction`), and a typed operator with a missing type method is an error.
- Status: settled
- Type: capability
- Rationale kind: mixed
- Depends on: Types are values that constrain values
- Significance: 4 — the Standard-layer typing guarantee
- Label: foundational — operator dispatch and the core roster
- Units: core-types, type-primitives
- Options recorded: untyped Allegretto structures (kept for the base, D5)
- Sources: docs/book/standard/README.md "Invariants"; docs/book/standard/core-types.md; D5 (docs/decisions.md)
- Book home (fragments' proposal): standard/core-types
- Chapter: Types as values

#### One meta-type with an optional name
- Decides: `NominalType` collapsed into `Type` with an optional name; named versus anonymous is a value-shape distinction, not a type-of-types distinction.
- Status: settled
- Type: capability — named versus anonymous is a value-shape distinction a program sees
- Rationale kind: technical
- Depends on: Types are values that constrain values
- Significance: 3 — anonymity becomes the loose/declared switch
- Label: foundational — conformance paths and `~T` read the name
- Units: type-core
- Options recorded: separate nominal and structural meta-types (retired, C7.1); nominal-vs-structural as a mixin (parked)
- Sources: docs/book/standard/type-system.md §2; docs/book/concepts.md §33b
- Book home (fragments' proposal): standard/type-system
- Chapter: Types as values

#### One construction surface
- Decides: `define` is uniform at every meta-level, Interface is a refinement of Type and Refinement a sub-kind of Type, and the reserved `construct` define-spec key is the per-kind minting authority (bottoming out in `struct_new`).
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Kinds are types, and Type is its own type
- Significance: 3 — one way to mint at every level
- Label: foundational — distinct, refinement mint and interfaces build through it
- Units: type-core
- Options recorded: post-hoc `.constructor()` (replaced, C7.2-R3); the `Type.invariant` fluent API (deleted)
- Sources: D45 (docs/decisions.md; structures.md §9); C7.2-R3, C6.1-P1 (docs/decisions.md chunk rulings)
- Book home (fragments' proposal): standard/type-system
- Chapter: Types as values

#### Loose conformance for data, selected by anonymity
- Decides: an anonymous expected type (`~T`, inline `{…}`) matches by base name (duck typing for data at boundaries, patterns and the marked escape hatch); a named expected type takes the declared path; anonymity alone is the switch.
- Status: partly built
- Type: capability
- Rationale kind: mixed
- Depends on: Members are keyed by symbol and conformance is membership; One meta-type with an optional name
- Significance: 3 — keeps declared conformance strict and still liveable
- Label: swappable — confined to the conformance branch
- Units: type-core
- Options recorded: a separate marker for the loose world (rejected); replacing the `__interface` test with a meta-type test (rejected: it would send `~Printable` down the declared path)
- Sources: D30 (structures.md §8 charter); docs/book/concepts.md §33b, §36; docs/book/standard/type-system.md §4 (__interface)
- Book home (fragments' proposal): standard/type-system
- Notes: the code still tests the `__interface` marker as well as anonymity (`src/slot-accessors.ts:263`); its removal is B-104(g).
- Chapter: Types as values

#### The core type roster
- Decides: Standard ships Int (64-bit signed), Float (IEEE double), String (UTF-8 Bits), Bool (Int 0/1 with Bool type), Array (numeric-keyed structure, generic), Object, Function, UntypedFunction, None, Error and Any; Array's map/filter/reduce are Allegro functions so PE sees through them, and operators dispatch through `PRIM_TO_METHOD` on the operand's shape.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Every Standard value has a type, with no implicit fallback; Bits is the only scalar
- Significance: 3 — the types every program uses
- Label: swappable — each type behind its member set
- Units: core-types, type-primitives
- Options recorded: host-loop HOFs (rejected: effect and type inference must see through them)
- Sources: docs/book/standard/core-types.md; docs/book/standard/type-system.md §7; D18 (docs/decisions.md)
- Book home (fragments' proposal): standard/core-types
- Notes: core-types.md says "ten core types" and lists eleven.
- Chapter: Types as values

#### Generics are memoized type constructors
- Decides: a generic is a function from parameters to concrete types; applied concretes are memoized (identity is physical), parameters may be values (`Vector[3]`), and a bare generic in annotation position applies `Any`.
- Status: settled
- Type: capability — type identity follows from the memo
- Rationale kind: technical
- Depends on: Kinds are types, and Type is its own type
- Significance: 3 — `Array[T]`, `Future[T]`, `Function[...]` and effect parameters ride it
- Label: swappable — generics unit
- Units: generics
- Options recorded: none recorded
- Sources: docs/book/standard/type-system.md §5; docs/book/concepts.md §37; CE-R5
- Book home (fragments' proposal): standard/type-system (proposed "Generics")
- Chapter: Types as values

#### Function types with bidirectional call-site unification
- Decides: typed functions carry `Function[ParamTypes, ReturnType]`; type variables bind progressively at call sites with bidirectional flow, contradictions are call-site type errors, and checks run in `applyComposed` before substitution rather than as wrappers in bodies.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Generics are memoized type constructors
- Significance: 3 — how typed calls are checked
- Label: swappable — type-core checking
- Units: type-core, generics
- Options recorded: `type_check` wrappers inside bodies (rejected)
- Sources: docs/book/standard/type-system.md §6
- Book home (fragments' proposal): standard/type-system
- Chapter: Types as values

#### `distinct` mints a fresh-symbol newtype
- Decides: `distinct` re-declares members under a fresh scope, so a newtype does not conform to or equal its parent unless a coercion is declared.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Members are keyed by symbol and conformance is membership
- Significance: 2 — newtypes without an is-a edge
- Label: swappable — one mint operation
- Units: type-core
- Options recorded: a `distinct` that shares the parent's eq impl (the pre-E1 state; `UserId(42) == 42` was true)
- Sources: C7.2-R2 (docs/decisions.md); docs/book/concepts.md §38; docs/book/standard/type-system.md §3; docs/plans/equality-and-laws.md §2, §6
- Book home (fragments' proposal): standard/type-system
- Chapter: Types as values

#### The user-facing generics surface and parameter kinds
- Decides: open — which kinds of parameter the language offers and how users define generics; GenericType's missing construct authority is a deferred public surface, not kernel privacy.
- Status: open
- Type: capability
- Rationale kind: technical
- Depends on: Generics are memoized type constructors
- Significance: 2 — nominal dimension types and value-parameterized types wait on it
- Label: swappable — surface over the generics unit
- Units: generics
- Options recorded: kernel-private construct authority (rejected as amended, C7.2-R1)
- Sources: C7.2-R1 (docs/decisions.md); docs/book/concepts.md §37; U-R1
- Book home (fragments' proposal): standard/type-system
- Notes: `__args`/`__generic` have no language surface (B-107).
- Chapter: Types as values

### Refinement types

#### Abstract domains as sound approximations
- Decides: predicates are recognised as interval, equality, not-equal, effects or opaque domains that answer "definitely yes" or "cannot tell"; anything unrecognised is opaque and keeps the predicate for a runtime check, and no deeper reasoning runs online.
- Status: settled
- Type: capability — it decides what a compile-time check can prove
- Rationale kind: technical
- Depends on: One operation: partial evaluation
- Significance: 4 — the cheap form of discharge over residuals
- Label: swappable — a domain set can be extended behind `impliesDomain`
- Units: refinements
- Options recorded: canonical predicate sets with online reasoning (rejected: "carry the facts, let the prover use what it needs")
- Sources: docs/book/concepts.md §34b; docs/book/standard/contracts.md §3
- Book home (fragments' proposal): standard/type-system (proposed "Refinements")
- Notes: the domain rides the host plane while knowledge is a metadata channel (B-111).
- Chapter: Refinement types

#### Refinement types
- Decides: a refinement is a type plus a predicate (`Int & _ > 0`) that shares its parent's member set, carries an abstract domain for compile-time entailment, and is chained left-associatively one layer per clause; its constructor wraps and checks the parent's.
- Status: settled
- Type: capability
- Rationale kind: vision
- Depends on: Types are values that constrain values; Abstract domains as sound approximations
- Significance: 5 — "types are predicates" made literal; units, invariants and termination bounds use it
- Label: foundational — invariants, the construction guard, dimensional analysis and termination
- Units: refinements, type-core
- Options recorded: sized types (rejected in favour of abstract domains, totality.md §6)
- Sources: docs/book/concepts.md §35; docs/book/standard/type-system.md §1, §3; D45; docs/book/standard/contracts.md §5
- Book home (fragments' proposal): standard/type-system (proposed chapter "Refinements")
- Notes: Told in the tour.
- Chapter: Refinement types

#### Shape and knowledge are separate
- Decides: a value's shape (its type with member-transparent refinement layers walked off) drives dispatch, while knowledge (refinement bounds, domains, predicate sets) is a monotonic lattice excluded from identity, equality and dispatch; a refinement that mints its own members is a shape.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Refinement types
- Significance: 4 — annotations narrow without coercing; equality and dispatch ignore knowledge
- Label: foundational — equality, contracts-as-knowledge and dispatch
- Units: refinements, type-core
- Options recorded: fusing type and knowledge (rejected: every annotation would be a coercion); "refinements never add behaviour" (corrected at S4b)
- Sources: D36 (docs/decisions.md; structures.md §6); docs/book/concepts.md §32, §34
- Book home (fragments' proposal): standard/type-system
- Notes: deltas — the shape projection is hardcoded in `metaReadRaw` (B-112(c)); `knowledge` is registered but never stored (B-111). Significance calibrated from 5.
- Chapter: Refinement types

#### Declared inheritance dissolves into conformance, refinement and composition
- Decides: there is no declared is-a edge between concrete types; the relations are member-symbol conformance, refinement (`Type.refines`) and composition (member bundles), with no `extend` sugar.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Members are keyed by symbol and conformance is membership; Refinement types
- Significance: 4 — reshapes subtyping, invariants, exhaustiveness and multiple inheritance
- Label: foundational — conformance, invariants-as-refinements and "no abstract types" rest on it
- Units: type-core
- Options recorded: `__extends` chain with explicit-error-on-conflict multiple inheritance (dissolved); `extend` sugar (rejected: migration decisive)
- Sources: D44 (docs/decisions.md; structures.md §8; archive structured-values-unification.md D44); docs/book/standard/type-system.md §2 "Multiple inheritance"
- Book home (fragments' proposal): standard/type-system
- Notes: type-system.md §3 still lists `extends` as one of three definition mechanisms; that list predates D44. Significance calibrated from 5.
- Chapter: Refinement types

#### Invariants are refinements
- Decides: a lifecycle invariant is a refinement layer (`T & pred`, records reaching fields through `_`), and it persists down a chain because the layer is structurally present, not because of an inheritance policy.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Refinement types; Declared inheritance dissolves into conformance, refinement and composition
- Significance: 3 — one mechanism for scalars and records
- Label: foundational — the construction guard and units dimensions
- Units: refinements, type-core
- Options recorded: a fluent `Type.invariant` with an `__invariantsList` and inheritance through `extend` (deleted)
- Sources: CT-R4, D45 (docs/decisions.md); docs/book/standard/contracts.md §5, §9
- Book home (fragments' proposal): standard/contracts
- Chapter: Refinement types

#### An interface is a type drawn from, not instantiated
- Decides: an interface is a declaration-only type, recognised by `InterfaceKind`'s predicate (no construct); conformance to it is symbol membership, and Allegro has no abstract types.
- Status: partly built
- Type: capability
- Rationale kind: technical
- Depends on: Declared inheritance dissolves into conformance, refinement and composition; One construction surface
- Significance: 2 — defines what an interface is now inheritance is gone
- Label: swappable — kind predicate
- Units: type-core
- Options recorded: "all members are signature-only" as the definition (rejected: every plain record would qualify)
- Sources: docs/book/concepts.md §36; D45; B-104(g), B-116
- Book home (fragments' proposal): standard/type-system
- Notes: `Interface.define` silently discards a method body (B-116); the `__interface` marker and its deletion are open.
- Chapter: Refinement types

### Who can see a member

#### Mediated member access
- Decides: member access is one partial-evaluation act in four stages (project, availability, mediate, dispatch) inside `type_dispatch`; `fallbackMember` (3-ary) stays the only user policy hook, and operator and untyped meta-dispatch share the same gated path.
- Status: settled
- Type: capability — the user policy hook and one gated path are the surface; the four stages are its form
- Rationale kind: technical
- Depends on: Members are keyed by symbol and conformance is membership
- Significance: 3 — every member read goes through it
- Label: foundational — privacy, module encapsulation and dispatch
- Units: type-core
- Options recorded: a new user-facing mediator slot (rejected); a separate untyped dispatch ladder (unified)
- Sources: D41 (docs/decisions.md; structures.md §6, §13); V-R1 (docs/plans/visibility.md §3)
- Book home (fragments' proposal): standard/type-system (proposed "Visibility")
- Chapter: Who can see a member

#### Access is what a type's member lookup returns, in two tiers
- Decides: a type exposes exactly what its member-access protocol returns; members may be marked `private(...)` through descriptor combinators (`readonly(...)` reserved), giving two tiers (private, public), with public and names-public as defaults.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Members are keyed by symbol and conformance is membership; Mediated member access
- Significance: 3 — encapsulation for types and modules alike
- Label: swappable — per-kind attribute vocabulary
- Units: type-core
- Options recorded: `internal` and `protected` (reserved, deferred until a consumer exists); keyword syntax (B-043); name secrecy (later opt-in)
- Sources: D43 (docs/decisions.md); V-R3, V-R5 (docs/plans/visibility.md §3); docs/book/standard/type-system.md §3
- Book home (fragments' proposal): standard/type-system (proposed chapter "Visibility")
- Chapter: Who can see a member

#### Evidence is possession
- Decides: authorization is what the requesting context holds (symbol reachability), never principal identity; mediators receive an opaque kernel-minted capsule answering only `holds(name)`, never the raw scope.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Mediated member access; Writes gated by a capability, reads free
- Significance: 3 — the ocap basis of privacy and the forgery-E guarantee
- Label: foundational — private members, export filtering and the wire rule
- Units: type-core, typed-modules
- Options recorded: handing mediators the raw scope (rejected, V-R2)
- Sources: D42 (docs/decisions.md; structures.md §13); V-R2 (docs/plans/visibility.md §3); forgery-E criterion (visibility.md §3)
- Book home (fragments' proposal): standard/type-system (proposed "Visibility")
- Chapter: Who can see a member

#### Privacy across readers, reflection and mediation effects
- Decides: destructuring a private field outside its scope is an error naming privacy, printing omits privates with `…`, conformance counts only reachable members; enumeration and visibility flags stay free while value-bearing reflection needs possession; kernel mediation is pure and folds, and an impure user mediator declares its own effect label.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Access is what a type's member lookup returns, in two tiers; Evidence is possession
- Significance: 2 — closes the bespoke readers by policy
- Label: swappable — reader policies
- Units: type-core
- Options recorded: silent no-match on private destructuring (rejected); blanket-tagging `type_dispatch` with an effect (rejected); borrowing `observe` for mediation (rejected)
- Sources: V-R6, V-R7, V-R8 (docs/plans/visibility.md §3; docs/decisions.md)
- Book home (fragments' proposal): standard/type-system (proposed "Visibility")
- Chapter: Who can see a member

#### Export marks the binding, and a module with no exports is open
- Decides: `export NAME = …` sets a visibility attribute on the scope binding (never the value); a module declaring no exports is fully open, any `export` closes it, and flat `use`-injection is filtered to the same export set.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Extensions are the module substrate; Evidence is possession
- Significance: 2 — closes a leak route and fixes aliasing behaviour
- Label: swappable — typed-modules policy
- Units: typed-modules
- Options recorded: an `exported` value-plane channel (deleted: `y = x` copied export-ness)
- Sources: V-R4 (docs/plans/visibility.md §3; docs/decisions.md); B-097 V1; docs/book/extension/modules.md "Module objects and encapsulation"
- Book home (fragments' proposal): extension/modules (L2 half)
- Chapter: Who can see a member

#### Imported modules are typed objects whose type encapsulates
- Decides: an imported module is a typed Object; dot access dispatches through the module's type, whose `fallbackMember` hook exposes only exported fields, and the wire resolves foreign names against the exported registry only.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Export marks the binding, and a module with no exports is open; Mediated member access
- Significance: 3 — module encapsulation reuses type dispatch instead of a separate mechanism
- Label: swappable — typed-modules
- Units: typed-modules
- Options recorded: none recorded
- Sources: D41–D43 (docs/decisions.md); V-R1, V-R4 (docs/plans/visibility.md §3); docs/book/extension/modules.md; docs/book/standard/type-system.md §3
- Book home (fragments' proposal): extension/modules (L2 half)
- Chapter: Who can see a member

### The surface language

#### Indentation blocks, with brace and offside both as the goal
- Decides: the base surface opens blocks by indentation (offside rule) and an expression continues across lines when the next line is indented deeper; Allegro should support both brace-delimited and indentation syntax, and until then every new construct must work in both modes.
- Status: partly built
- Type: capability
- Rationale kind: aesthetic
- Depends on: Offside rule through stateful indent terminals
- Significance: 3 — every multi-line program and the planning surface use it
- Label: swappable — the preface's own example of a swappable aesthetic decision
- Units: base-grammar; base-grammar, grammar-formalism
- Options recorded: Scala 3 / F# dual-mode precedent; block idiom as `@longest` Alt of braced and offside forms; brace-delimited blocks; both modes in one grammar (`@longest` over braced and offside alternatives)
- Sources: docs/book/extension/grammar.md §3; docs/book/grammar-formalism.md §1, §5.2–§5.3; docs/book/preface.md "Swappable and foundational decisions"; docs/book/language-reference.md (Indentation blocks); docs/book/extension/grammar.md §3 (Dual brace and offside-rule modes); docs/book/grammar-formalism.md §5.2 to §5.5; docs/book/preface.md (Swappable and foundational decisions)
- Book home (fragments' proposal): extension/grammar / Surface syntax of Allegro Standard (proposed) / the formalism half in The grammar formalism
- Notes: Merged from fragment B ("Both brace and offside block syntax"), fragment C ("Indentation blocks in the base surface, with dual brace and offside as the goal"). C: brace mode is a goal, not shipped. `SAMELINE` is unimplemented (planning-dsl.md §6). The REPL's continuation rule is a separate heuristic (see the REPL entry). Significance calibrated from 2/3.
- Chapter: The surface language

#### Refinement types written `T & predicate` with `_` as the value
- Decides: a refinement is written `Base & predicate` where `_` names the value, and `ensures` uses the same `_` for the return value.
- Status: settled
- Type: capability
- Rationale kind: aesthetic
- Depends on: Refinement types
- Significance: 3 — the most visible claim syntax; used by units and planning
- Label: swappable — the spelling lowers to the refinement mint
- Units: refinements, type-core, tree-builder
- Options recorded: `Refinement.define({refines, where, preserve})` as the combinator form beside the operator
- Sources: docs/book/getting-started.md; docs/book/language-reference.md (Refinement types, preserveOps); docs/book/standard/contracts.md §2
- Book home (fragments' proposal): Surface syntax of Allegro Standard (proposed) / semantics in Contracts and invariants
- Chapter: The surface language

#### Function declarations with `=>`
- Decides: a function is declared `name(params) => body`, a lambda is `x => body` or `(x, y) => body`, and closures are ordinary nested lambdas.
- Status: settled
- Type: capability
- Rationale kind: aesthetic
- Depends on: Meaning comes before notation
- Significance: 2 — the most common declaration form, but a spelling
- Label: swappable — replaced inside the base grammar only
- Units: base-grammar, tree-builder
- Options recorded: none recorded
- Sources: docs/book/language-reference.md (Base Parser Syntax); docs/book/getting-started.md
- Book home (fragments' proposal): Surface syntax of Allegro Standard (proposed)
- Notes: no source records the alternatives weighed.
- Chapter: The surface language

#### Expression-valued `if then else` with thunked branches
- Decides: `if c then a else b` is an expression whose branches the parser wraps in thunks, so a lazy primitive evaluates only the chosen branch.
- Status: settled
- Type: capability
- Rationale kind: mixed
- Depends on: Host functions as values with declared evaluation control
- Significance: 2 — local to the conditional, but its thunking interacts with tail calls
- Label: swappable — the spelling is base-grammar; the thunking rides the lazy-primitive mechanism
- Units: base-grammar, tree-builder, base-primitives
- Options recorded: none recorded
- Sources: docs/book/language-reference.md (If-then-else); docs/book/vivace/planning-dsl.md §6 (the tail-call sentinel finding through a branch thunk)
- Book home (fragments' proposal): Surface syntax of Allegro Standard (proposed)
- Notes: planning-dsl.md §6 records two evaluator bugs caused by thunked branches in non-tail positions, fixed in `src/evaluator.ts`.
- Chapter: The surface language

#### The `Y of x` component-access form
- Decides: a metadata component of a value is read by the expression form `Y of x` (`type of x`, `error of x`, `source of x`), a general expression feature rather than a pattern feature.
- Status: settled
- Type: capability
- Rationale kind: mixed
- Depends on: Metadata is a field on every value; A failure a program can handle is supplied by an extension
- Significance: 2 — the reader's view of the metadata plane at the surface
- Label: swappable — a surface over channel reads
- Units: base-grammar, metadata
- Options recorded: none recorded
- Sources: docs/book/language-reference.md (MultiValue component access); docs/book/standard/pattern-matching.md §2; D47 (source of x surface)
- Book home (fragments' proposal): Surface syntax of Allegro Standard (proposed)
- Notes: the reference still calls it "MultiValue component access"; MultiValue is retired (D46), so the name is stale.
- Chapter: The surface language

#### Type annotations on parameters and returns
- Decides: parameters and returns carry `: Type` annotations, generics are written `Array[Int]`, and a failed annotation check halts compilation.
- Status: settled
- Type: capability
- Rationale kind: mixed
- Depends on: Claims are evaluated like everything else
- Significance: 2 — spelling of the typing surface
- Label: swappable — spelling over `typed_function` and `type_check`
- Units: tree-builder, type-core, type-primitives
- Options recorded: none recorded
- Sources: docs/book/language-reference.md (Type annotations, Generic type annotations); docs/book/platform/build-pipeline.ir.md C75, C77, C80
- Book home (fragments' proposal): Surface syntax of Allegro Standard (proposed)
- Notes: build-pipeline.ir.md C80 and E39: a declared return type that differs from the inferred one halts only when the function is applied; a program that never calls it runs. CLAUDE.md's invariant ("a failed type ANNOTATION check HALTS compilation") reads as stronger than the code.
- Chapter: The surface language

#### Statement forms that declare a binding
- Decides: a library's `stmt_form` may expand to `binding_decl(name, value[, type])`, which becomes a binding checked like `name: type = value`, so a declaration statement halts when its check fails.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Grammar extension as operation deltas, extensible by default; Type annotations on parameters and returns
- Significance: 3 — lets a DSL declare names with the kernel's halt semantics; the planning `plan NAME:` form needs it
- Label: swappable — a tree-builder marker; another expansion mechanism could replace it
- Units: tree-builder, grammar-extension
- Options recorded: none recorded
- Sources: docs/book/extension/grammar.md §4 (B-151 B1); docs/book/vivace/planning-dsl.md §6
- Book home (fragments' proposal): Grammar and parser / cited from The planning DSL
- Notes: added at stage B1 as one of three engine gaps closed for the first offside fragment, with layout terminals by name and labels as string literals.
- Chapter: The surface language

#### `when / is / then` pattern matching
- Decides: matching uses `when x is P then e` with nominal, structural and nested destructuring and `and`/`or` guards; a type pattern resolves first (value pattern matches the primary, type pattern matches the input's type, or either for a type input).
- Status: settled
- Type: capability
- Rationale kind: aesthetic
- Depends on: The declarative `grammar { … }` block with hygienic templates; Types are values that constrain values; Expression-valued `if then else` with thunked branches
- Significance: 2 — the match surface
- Label: swappable — a grammar form over `eval_when`
- Units: base-grammar, base-primitives
- Options recorded: ML-style, Rust-style and arrow-style syntax (rejected: `when/is/then` matches `if/then/else`); ML-style, Rust-style, arrow-style matches (rejected: `when/is/then` matches `if/then/else` and reads without verbosity); a `match … with | …` form shipped as an extension demo
- Sources: docs/book/standard/pattern-matching.md §1–§2; docs/book/standard/pattern-matching.md §1 to §3; docs/book/language-reference.md; docs/book/grammar-formalism.md §10.4
- Book home (fragments' proposal): standard/pattern-matching / Pattern matching (`docs/book/standard/pattern-matching.md`)
- Notes: Merged from fragment B ("`when/is/then` pattern matching"), fragment C ("`when / is / then` pattern matching"). C: unification in patterns is deferred (§3).
- Chapter: The surface language

#### Allegro Standard by default, Allegretto by flag
- Decides: every host entry (file runner, REPL, subcommands, sandbox) runs Allegro Standard with the type system as its one base extension, and `--base` selects bare Allegretto.
- Status: settled
- Type: capability
- Rationale kind: mixed
- Depends on: Everything above the kernel is an extension, and there is one way to extend
- Significance: 2 — which language a user meets
- Label: swappable — a host default
- Units: cli
- Options recorded: none recorded
- Sources: docs/book/platform/tooling.ir.md C29 to C31; docs/book/platform/host.ir.md C69, C72; docs/book/vision.md §1 ("In normal use, 'Allegro' means this tier")
- Book home (fragments' proposal): Tooling
- Notes: `prove` ignores `--base` (tooling C31); the sandbox creates a future manager under Allegretto while the CLI does not (host C58, C72).
- Chapter: The surface language

#### Combinators before keyword declaration syntax
- Decides: types, interfaces, refinements and member modifiers are declared through combinator calls (`Type.define`, `Interface.define`, `private(...)`), and keyword declaration syntax waits until the API patterns settle, lowering to the same attributes when it lands.
- Status: open
- Type: capability
- Rationale kind: mixed
- Depends on: One construction surface; Access is what a type's member lookup returns, in two tiers
- Significance: 2 — every surface keyword (private, effect declarations) waits on it
- Label: swappable — keyword sugar lowers to the same declaration attributes
- Units: type-core; type-core, tree-builder
- Options recorded: keyword type-declaration syntax now (deferred, B-043); keyword syntax (`private x: Int`); `readonly(...)` reserved and inert
- Sources: docs/book/standard/type-system.md §3; V-R5; docs/book/standard/effects.md §6; docs/book/language-reference.md (Private members); D43; B-043 (docs/backlog.md)
- Book home (fragments' proposal): standard/type-system / Surface syntax of Allegro Standard (proposed)
- Notes: Merged from fragment B ("Type declarations through a fluent API before syntax"), fragment C ("Combinators before keyword declaration syntax"). Significance calibrated from 2/3.
- Chapter: The surface language

#### String interpolation with braces
- Decides: a string literal interpolates `{expr}`, with `\{` and `\}` as escapes.
- Status: settled
- Type: capability
- Rationale kind: aesthetic
- Depends on: Meaning comes before notation
- Significance: 1 — local spelling
- Label: swappable — base-grammar only
- Units: base-grammar, tree-builder
- Options recorded: none recorded
- Sources: docs/book/language-reference.md (String interpolation)
- Book home (fragments' proposal): Surface syntax of Allegro Standard (proposed)
- Chapter: The surface language

### Proofs as values

#### Proofs are values discharged by evaluation
- Decides: a proposition is an expression reducing to Bool; `theorem` and `verify` lower to `proof_by_eval`, the kernel verifies a proof by partial evaluation (reduction, not search), a failed proof halts with its counterexample, and only the kernel writes the `discharged` mark.
- Status: settled
- Type: capability
- Rationale kind: mixed
- Depends on: One operation: partial evaluation; Writes gated by a capability, reads free; Kinds are types, and Type is its own type
- Significance: 4 — the provability thesis in the language
- Label: foundational — laws, PCP, `proven`, verdict
- Units: proofs; proofs, evaluator
- Options recorded: an SMT fallback (future, "per the thesis"); SMT, structural type checking, symbolic execution (each the pick of an existing system; evaluation named as the underexplored position)
- Sources: docs/book/proving-in-allegro.md "The proof model", "Stating a theorem"; docs/book/concepts.md §44; docs/book/standard/README.md "Invariants"; docs/book/vision.md §2 (three legs, leg 1), §5 principle 2; docs/book/proving-in-allegro.md (The proof model in one sentence)
- Book home (fragments' proposal): proposed standard/proofs (planned `proofs.md`, revalidation-gated) / the tour / Proving in Allegro
- Notes: Merged from fragment B ("Proofs are values discharged by evaluation"), fragment C ("PE-as-discharge as the primary proof strategy"). B: `discharged` is the last metadata field on the binding plane (B-104). The brief's reading list did not include proof sources; this and the next two entries rest on proving-in-allegro.md. C: likely also in another fragment's scope; listed here from the thesis-test side. Significance calibrated from 5/5.
- Chapter: Proofs as values

#### Theorems as statements, proved `by` a term
- Decides: `theorem NAME: proposition` names a referenceable proof and `verify proposition` is an anonymous one-shot, both lowering to `proof_by_eval`, and `by <term>` supplies a proof term that the kernel checks establishes exactly the stated proposition.
- Status: settled
- Type: capability
- Rationale kind: mixed
- Depends on: Proofs are values discharged by evaluation; Claims are evaluated like everything else
- Significance: 3 — the proof surface every rung and the prover loop splice into
- Label: swappable — the statements lower to proof primitives
- Units: proofs, tree-builder
- Options recorded: none recorded
- Sources: docs/book/proving-in-allegro.md (Stating a theorem; equational combinators)
- Book home (fragments' proposal): Proving in Allegro
- Chapter: Proofs as values

#### Discharge mechanisms without search
- Decides: the kernel discharges without search, in order of preference: evaluation (`proof_by_eval`), refinement-domain entailment (`proof_refines`), equational combinators (`proof_refl`/`sym`/`trans`/`cong` via `by`), then quantification (finite enumeration by `prove_for_all_bool`, bounded-sample `prove_induction` and `proven` clauses at K=4), with a tactics library composing them and no SMT.
- Status: partly built
- Type: capability
- Rationale kind: technical
- Depends on: Proofs are values discharged by evaluation; Abstract domains as sound approximations
- Significance: 3 — what can be proved today
- Label: swappable — each strategy is a primitive or library
- Units: proofs; proofs, refinements
- Options recorded: full symbolic induction and symbolic-input `proven` (follow-ons); SMT (future); SMT (deferred to the fallback leg)
- Sources: docs/book/proving-in-allegro.md (four strategies, tactics, proven); docs/book/proving-in-allegro.md (The four discharge strategies)
- Book home (fragments' proposal): proposed standard/proofs / Proving in Allegro
- Notes: Merged from fragment B ("Discharge strategies without search"), fragment C ("Four discharge mechanisms in order of preference"). B: bounded sampling is recorded as survival, not proof, in the law tiers; the `proven` clause's tier visibility in the ledger is not stated in the primer. C: the primer's "four strategies" and the vision's "three legs" are different lists (mechanisms inside leg 1 versus strategy legs); the book should name both distinctly.
- Chapter: Proofs as values

#### Bounded sampling for universal claims
- Decides: `prove_induction` verifies the base and K=4 inductive steps, and a function's `proven` clause is checked at K=4 sampled inputs of its parameter type, halting with the counterexample; full symbolic induction and symbolic-input verification are follow-ons.
- Status: partly built
- Type: capability
- Rationale kind: technical
- Depends on: Discharge mechanisms without search; Every result says how strongly it holds
- Significance: 3 — the only universal-claim path beyond finite enumeration
- Label: swappable — a symbolic engine could replace the sampler behind the same primitives
- Units: proofs
- Options recorded: full symbolic induction; symbolic-input verification (both deferred)
- Sources: docs/book/proving-in-allegro.md (F5, F7); docs/book/platform/build-pipeline.ir.md C74
- Book home (fragments' proposal): Proving in Allegro
- Notes: `prove_induction` returns an ordinary discharged Proof (`src/primitives.ts:4377`, `makeProof` in `src/types-std.ts:4681` writes `discharged` 1 and no tier); the sampled strength appears only in the proposition text "[verified base + 4 inductive steps]". That seems to fall short of principle 9 (a sampled check must not borrow a stronger vocabulary). `proven` is limited to one Int, NonNeg, PositiveInt or Bool parameter.
- Chapter: Proofs as values

#### Tactics as a pure Allegro library
- Decides: reusable proof strategies (`same`, `flip`, `step`, `chain`, `rewrite`) are a library of plain Allegro over the kernel's combinators, adding no primitive.
- Status: settled
- Type: capability — where tactics live is what a prover imports
- Rationale kind: vision
- Depends on: Theorems as statements, proved `by` a term; Everything above the kernel is an extension, and there is one way to extend
- Significance: 2 — shows proof strategy as user-extensible
- Label: swappable — a library
- Units: not yet a unit (`lib/tactics.alg`)
- Options recorded: none recorded
- Sources: docs/book/proving-in-allegro.md (The tactics library)
- Book home (fragments' proposal): Proving in Allegro
- Chapter: Proofs as values

#### One primer for human and machine provers
- Decides: the proving guide is one participant-neutral document, and the `prove` loop sends that same file to the language model as its primer.
- Status: settled
- Type: capability — it decides what a machine prover is told
- Rationale kind: vision
- Depends on: Anyone may propose, and the record shows who
- Significance: 2 — makes the protocol's neutrality literal
- Label: swappable — the primer is data to the worker
- Units: not yet a unit (`pcp/llm-worker.ts` has no unit)
- Options recorded: none recorded
- Sources: docs/book/proving-in-allegro.md (opening); docs/book/platform/tooling.ir.md C129, C19
- Book home (fragments' proposal): Proving in Allegro
- Notes: the worker reads the primer relative to the current working directory (tooling C129).
- Chapter: Proofs as values

#### One proof-term contract for human and machine provers
- Decides: humans and LLM provers supply the same proof terms: an LLM prover answers with a fenced `allegro` block holding only the term, which the worker splices into the theorem's `by` slot and re-verifies through `evalSource`, keeping it only when the theorem discharges, for at most `--max-attempts` attempts (five by default); the kernel accepts or rejects every term alike.
- Status: settled
- Type: capability
- Rationale kind: mixed
- Depends on: Proofs are values discharged by evaluation; One primer for human and machine provers; Theorems as statements, proved `by` a term
- Significance: 2 — the machine interface of the loop
- Label: swappable — the worker is replaceable behind the obligation and verdict schemas
- Units: pcp; not yet a unit (`pcp/llm-worker.ts`)
- Options recorded: none recorded
- Sources: docs/book/proving-in-allegro.md "Output contract for an LLM prover"; vision.md §1–§2 (not read here); docs/book/proving-in-allegro.md (Output contract for an LLM prover); docs/book/platform/tooling.ir.md C123 to C136
- Book home (fragments' proposal): proposed standard/pcp (planned `pcp.md`) / Proving in Allegro / Tooling
- Notes: Merged from fragment B ("Participant-neutral proof terms"), fragment C ("Proof-term output contract for an LLM prover"). C: with an API key set, `prove` fails on any file with a `use` header (tooling C133 to C135, R4). Significance calibrated from 3/2.
- Chapter: Proofs as values

### Equality and laws

#### Lawful interfaces
- Decides: any member set may carry `law_`-prefixed members whose `for_all` propositions are schemas at declaration and become one pending Obligation per law when a type draws the set; laws attach to scopes because a law may reference several members.
- Status: settled
- Type: capability
- Rationale kind: vision
- Depends on: Members are keyed by symbol and conformance is membership; Proofs are values discharged by evaluation
- Significance: 4 — the mechanism that makes "lawful" checkable
- Label: foundational — equality, units laws and the strict gate
- Units: equality-laws, proofs
- Options recorded: `law refl:` statement sugar (later, B-089); laws only on interfaces (rejected: member-set-general)
- Sources: D38 (docs/decisions.md; structures.md §8); E-R3 (docs/plans/equality-and-laws.md §3 and its two addenda); docs/book/concepts.md §39
- Book home (fragments' proposal): proposed "Equality and laws"
- Chapter: Equality and laws

#### Equality dispatches on shape, then coerces, else not-equal
- Decides: `==` compares same-shape values with the shape's `equals`; for different shapes it coerces both operands to a least common type over declared coercions (`Coercion.declare(A, B, fn)` on the pair, with preservation and coherence obligations); with no path the answer is false, never an error.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Shape and knowledge are separate; Lawful interfaces
- Significance: 4 — a lawful, globally stable equivalence
- Label: foundational — proofs' equality matching, units, distinct newtypes
- Units: equality-laws
- Options recorded: a reserved `coerce` key on the target type (rejected for the standalone pair form); erroring on unrelated shapes (rejected)
- Sources: D37, D8 (docs/decisions.md; structures.md §7); E-R2 (docs/plans/equality-and-laws.md §3); conscious deltas §6
- Book home (fragments' proposal): proposed standard chapter "Equality and laws"
- Notes: confirmed `Coercion.declare` in `src/types-std.ts:1981`.
- Chapter: Equality and laws

#### Kernel structural equality is the default
- Decides: every structure-backed type gets a kernel `equals` (same shape, then field-wise or element-wise protocol equality), proven lawful once parametrically; a user override bears the three law obligations; None and Error keep identity semantics, and Bool is not equal to Int.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Equality dispatches on shape, then coerces, else not-equal
- Significance: 3 — records and arrays compare without user code
- Label: swappable — the default impl behind `equals`
- Units: equality-laws, core-types
- Options recorded: declaring a Bool→Int coercion (recommended against: Bool is not a number)
- Sources: E-R1 (docs/plans/equality-and-laws.md §3, §6 items 1–2, 7–8)
- Book home (fragments' proposal): proposed "Equality and laws"
- Chapter: Equality and laws

#### Law discharge tiers and the first strict gate
- Decides: law obligations discharge at a recorded tier (kernel, enumerated, witnessed, sampled, admitted via `Law.assume`, pending), proofs record the equality and tier they rest on, and `proof_trans` refuses a custom equality whose transitivity is neither proven nor admitted.
- Status: settled
- Type: capability
- Rationale kind: mixed
- Depends on: Lawful interfaces; Every result says how strongly it holds
- Significance: 3 — "no boolean verified anywhere"
- Label: swappable — tier policy and gate list
- Units: equality-laws, proofs
- Options recorded: gating everything at once (rejected: would halt existing programs; strictness ships incrementally)
- Sources: E-R4, E-R6 (docs/plans/equality-and-laws.md §3); docs/book/proving-in-allegro.md "Laws, discharge tiers, and the strict gate"
- Book home (fragments' proposal): proposed "Equality and laws"
- Notes: E-R6 named two fields; three shipped (`lawName` added). Two transitive backing carriers coexist (B-115). Assembly: the dependency on the divergence tiers ("Four-tier discharge spectrum") was replaced by the thesis-level tier vocabulary ("Every result says how strongly it holds"); law tiers share the vocabulary, not the divergence analysis.
- Chapter: Equality and laws

### Effects

#### Effects are values in one lattice
- Decides: effects are values of kind `Effect`, composed by conjunction with the dedicated `&` operator, with `pure` (bottom) and `opaque` (top) fixed in the core and all other labels defined by libraries; lattice operations are typed methods.
- Status: partly built
- Type: capability
- Rationale kind: mixed
- Depends on: Kinds are types, and Type is its own type; Metadata is a field on every value
- Significance: 4 — effect tracking reuses value, type and member machinery
- Label: foundational — effect polymorphism, `div`, `sched`, `unsafe`
- Units: effects, type-core
- Options recorded: a parallel effect namespace or flat string labels (the degenerate case); `&&` for conjunction (superseded by `&`); a separate effect-set data type (rejected)
- Sources: docs/book/standard/effects.md §1–§3; docs/book/concepts.md §40; archive harmonic-grounding-tarski.md "Settled architectural commitments"
- Book home (fragments' proposal): standard/effects
- Notes: the code represents an effect set as `Set<string>` (`src/effects.ts:41`) merged by union, while effects.md says "there is no separate effect-set data type". Anonymous conjunctions are not built; non-trivial unions coerce to `opaque` (interim).
- Chapter: Effects

#### Effect inference is driven by partial evaluation, and a declaration is a contract
- Decides: effects are inferred automatically through PE propagation (no separate walker); an `effects` declaration is optional and verified, never trusted, and an inferred effect the declaration does not admit halts compilation.
- Status: settled
- Type: capability
- Rationale kind: vision
- Depends on: Effects are values in one lattice; One operation: partial evaluation
- Significance: 4 — the falsifiable "one engine" claim applied to effects
- Label: foundational — totality, purity gates and the halt rule
- Units: effects, pipeline
- Options recorded: a standalone effect walker (deleted); declarations as hints (rejected)
- Sources: CE-R1 (docs/decisions.md); docs/book/standard/effects.md §1 item 3, §2 "Declaration surfaces", §6 (applyComposed hypothesis resolved); docs/book/concepts.md §41
- Book home (fragments' proposal): standard/effects
- Notes: the inferred set rides the host plane (B-107).
- Chapter: Effects

#### Parameter effect bounds and explicit effect variables
- Decides: a parameter's effect bound is written in the type slot (`f: pure`) or a `param_effects` body form and discharged at call sites; effect polymorphism needs an explicit `[e: Effect]`, and an unannotated function-typed parameter is `opaque`.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Effect inference is driven by partial evaluation, and a declaration is a contract; Generics are memoized type constructors
- Significance: 3 — precise effects through higher-order code
- Label: swappable — surface and binding rules
- Units: effects, generics
- Options recorded: auto-promoting each unannotated parameter to a fresh effect variable (the D1 plan; rejected: a bare lowercase name would silently capture a binding)
- Sources: docs/book/standard/effects.md §2 "Declaration surfaces"; archive harmonic-grounding-tarski.md "Effect polymorphism"
- Book home (fragments' proposal): standard/effects
- Chapter: Effects

#### Effects describe computations, refinements describe data
- Decides: effects ride their own metadata field and parameter effect bounds use `Param.effectBound`; refinement predicate sets stay a separate lattice.
- Status: settled
- Type: implementation — where effect and knowledge information is stored
- Rationale kind: technical
- Depends on: Effects are values in one lattice; Refinement types
- Significance: 2 — keeps the two lattices from mixing
- Label: swappable — storage placement
- Units: effects, refinements
- Options recorded: effect bounds in `Param.predicates` (moved out)
- Sources: docs/book/standard/effects.md §1 item 4; docs/book/standard/type-system.md §8
- Book home (fragments' proposal): standard/effects
- Chapter: Effects

#### Labels for observing knowledge and scheduling
- Decides: observing knowledge or source (`certificate_peek`, `observe`) carries `observe`, and asking whether a value is resolved (`is_resolved`) carries `sched`; blocking reads need no label under PE because reads residualize.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Effects are values in one lattice; Incompleteness lives in write-once future cells
- Significance: 2 — quarantines nondeterminism and knowledge-dependence from pure code
- Label: swappable — label roster
- Units: effects
- Options recorded: a blocking-read label (rejected)
- Sources: CE-R4 (docs/decisions.md; docs/plans/completion-effects.md §3); docs/book/standard/effects.md §2–§3; E-R5; D47
- Book home (fragments' proposal): standard/effects
- Chapter: Effects

#### Redefining primitives and core types is banned
- Decides: extensions cannot replace primitives or core types, so no "replaces primitive" effect is needed.
- Status: open
- Type: capability
- Rationale kind: technical
- Depends on: Effects are values in one lattice
- Significance: 2 — closes one subversion vector by construction
- Label: swappable — a loader/extension rule
- Units: not yet a unit
- Options recorded: an effect tracking replacement (rejected: the operation does not exist)
- Sources: docs/book/standard/effects.md §1 item 5, §4
- Book home (fragments' proposal): standard/effects
- Notes: tagged [designed]; I found no record of enforcement. Status "open" means designed but unbuilt.
- Chapter: Effects

#### The `unsafe` hierarchy and safe wrappers
- Decides: unanalyzable operations sit under `unsafe.*` (memory, executable, codegen, ffi) between specific labels and `opaque`, accepted on author authority; a wrapper may claim a tighter effect, so callers do not inherit `unsafe`.
- Status: open
- Type: capability
- Rationale kind: technical
- Depends on: Effects are values in one lattice
- Significance: 2 — the honest boundary for FFI and codegen
- Label: swappable — library labels plus a wrap mechanism
- Units: effects
- Options recorded: wrap mechanics as an `effect_claim` body form, a re-tagging primitive, or a PE-discharged predicate claim (open)
- Sources: docs/book/standard/effects.md §4–§5; archive harmonic-grounding-tarski.md "The unsafe hierarchy"
- Book home (fragments' proposal): standard/effects
- Chapter: Effects

#### Member and parameterized effects
- Decides: `files.read` is property access on an Effect whose members are Effects, and `files.read_from "X"` is memoized generic application specialized by ordinary PE; prefix paths imply their parents.
- Status: open
- Type: capability
- Rationale kind: technical
- Depends on: Effects are values in one lattice; Generics are memoized type constructors
- Significance: 2 — parametric capabilities
- Label: swappable — effect schema
- Units: effects
- Options recorded: none recorded
- Sources: docs/book/standard/effects.md §2 (Phase D2, [designed])
- Book home (fragments' proposal): standard/effects
- Chapter: Effects

#### Open effect surfaces
- Decides: open — how new effects are declared (value bindings or an `effect files { … }` form), the module-init effect surface, and a runtime effect-check fallback (`allow | warn | error`).
- Status: open
- Type: capability
- Rationale kind: mixed
- Depends on: Effects are values in one lattice; Combinators before keyword declaration syntax
- Significance: 1 — surface choices
- Label: swappable — surfaces
- Units: effects, typed-modules
- Options recorded: value bindings versus keyword form; per-binding notification suppression (project config only)
- Sources: docs/book/standard/effects.md §6
- Book home (fragments' proposal): standard/effects
- Chapter: Effects

### Contracts and the knowledge they give

#### A contract is a predicate that becomes knowledge, discharged by PE
- Decides: `assert`, `requires` and `ensures` attach their predicate to the knowledge set on success, so later checks of the same property are free; there is no separate contract checker, and entailment against available knowledge removes the runtime check.
- Status: settled
- Type: capability
- Rationale kind: vision
- Depends on: Shape and knowledge are separate; One operation: partial evaluation
- Significance: 4 — compile-time and runtime checking are one mechanism
- Label: foundational — contract discharge, branch refinement and mechanism choice
- Units: contracts, refinements
- Options recorded: a standalone contract checker (rejected)
- Sources: CT-R5 (docs/decisions.md); docs/book/standard/contracts.md §1 items 1–3, §6; docs/book/concepts.md §46
- Book home (fragments' proposal): standard/contracts
- Chapter: Contracts and the knowledge they give

#### Knowledge has intrinsic and occurrence carriers
- Decides: intrinsic facts ride the value (refinement certificates, passing checks), occurrence facts live in the scope facts plane, and a check consults their meet; predicate sets are small ordered lists with dedup, opaque to user code.
- Status: partly built
- Type: capability — the two carriers decide where knowledge holds; the list form is a realising detail
- Rationale kind: technical
- Depends on: A contract is a predicate that becomes knowledge, discharged by PE; Scope is the evaluation environment, not data
- Significance: 3 — how facts reach a check
- Label: swappable — carrier representation
- Units: refinements, contracts
- Options recorded: v1's standalone `predicates` component (superseded); user-visible predicate-set values (rejected, resolved opaque)
- Sources: CT-R5, D36 (docs/decisions.md); docs/book/standard/contracts.md §1 items 4–5, §3, §9
- Book home (fragments' proposal): standard/contracts
- Notes: the legacy `domain` component is still read (B-101); the facts plane narrows in place rather than through the designed `scope_assume` layering.
- Chapter: Contracts and the knowledge they give

#### Body-form clauses at the head of a body, lowered through one chain
- Decides: contracts and analysis declarations (`requires`, `ensures`, `effects`, `decreases`, `total`, `partial`, `assume terminates`, `proven`) are leading statements of a function body, recognised at parse time and lowered as marker primitive, then tree-builder attach, then `collapseBodyMetadata`, then function property; `requires` is hoisted ahead of the body and `ensures` wraps the result as `ensures_check(result, λ_)`, forwarding tail calls.
- Status: settled
- Type: capability — the clauses and what they lower to are the surface; the chain's stage names are its form
- Rationale kind: mixed
- Depends on: The declarative `grammar { … }` block with hygienic templates; Claims are evaluated like everything else; Grammar extension as operation deltas, extensible by default
- Significance: 3 — every L2 annotation reaches analysers the same way
- Label: foundational — totality, effects and contracts analysers read properties
- Units: tree-builder, contracts; tree-builder, grammar-extension, totality
- Options recorded: `assert`-at-entry plus a let-binding wrapper (v1, reshaped); an eval-time magic `_` (rejected for a parse-time lambda); bespoke peelers per analyser (forbidden); none recorded for the position; a misplaced `ensures` is a no-op, not an error (the `effects_decl_marker` precedent)
- Sources: docs/book/standard/contracts.md §2, §9; CE-R3; docs/plans/completion-effects.md §3; CLAUDE.md "Body wrappers" invariant; docs/book/standard/contracts.md §2; docs/book/language-reference.md (discharge spectrum); docs/book/platform/build-pipeline.ir.md C37, C38, C55, C157
- Book home (fragments' proposal): standard/contracts (or extension/grammar) / Contracts and invariants / Surface syntax of Allegro Standard (proposed)
- Notes: Merged from fragment B ("Body-form clauses lower through one chain"), fragment C ("Body-form clauses at the head of a function body"). B: `ensures_decl` outside a function body is a deliberate no-op. C: the clauses come from libraries (`use contracts`, `use totality`, `use proven`), so the surface is extension-supplied, not base.
- Chapter: Contracts and the knowledge they give

#### Branch refinement narrows knowledge per region
- Decides: an `if` arm narrows knowledge for that arm only from literal comparisons and conjunctions, layered on scope and discarded on exit; `assert` and `requires` narrow the rest of the enclosing scope.
- Status: partly built
- Type: capability
- Rationale kind: technical
- Depends on: Knowledge has intrinsic and occurrence carriers
- Significance: 2 — flow-sensitive knowledge
- Label: swappable — recogniser
- Units: refinements, contracts
- Options recorded: relational conditions (`a < b`) narrowing both bindings (designed, B-057)
- Sources: docs/book/standard/contracts.md §4; B-057
- Book home (fragments' proposal): standard/contracts
- Chapter: Contracts and the knowledge they give

#### Contract checks sit at function entry and return
- Decides: `requires` checks at function entry and `ensures` at return; per-call-site discharge already happens through PE, and relocating an undischarged check to the call site remains open.
- Status: partly built
- Type: capability
- Rationale kind: technical
- Depends on: A contract is a predicate that becomes knowledge, discharged by PE
- Significance: 2 — where residual checks are emitted
- Label: swappable — codegen placement
- Units: contracts
- Options recorded: v1's sink-based relocation to each call site (open, B-057)
- Sources: CT-R1 (docs/decisions.md); docs/book/standard/contracts.md §6, §10
- Book home (fragments' proposal): standard/contracts
- Chapter: Contracts and the knowledge they give

#### Choosing among refinement, contract, assert and law
- Decides: prefer a refinement when the property is intrinsic, a contract when it concerns a function's relation to callers, `assert` for local knowledge, and a theorem or law when the claim is quantified over inputs; formal work concentrates in libraries.
- Status: settled
- Type: capability
- Rationale kind: mixed
- Depends on: Refinement types; A contract is a predicate that becomes knowledge, discharged by PE; Lawful interfaces
- Significance: 2 — guidance that ties the mechanisms together
- Label: swappable — guidance only
- Units: none
- Options recorded: none recorded
- Sources: docs/book/standard/contracts.md §8
- Book home (fragments' proposal): standard/contracts
- Chapter: Contracts and the knowledge they give

#### Unification and branch refinement in patterns
- Decides: open — full unification in pattern mode, and narrowing predicate sets in `when` arms as `if` branches do.
- Status: open
- Type: capability
- Rationale kind: technical
- Depends on: `when / is / then` pattern matching; Branch refinement narrows knowledge per region
- Significance: 1 — precision of matching
- Label: swappable — pattern evaluation
- Units: base-primitives, refinements
- Options recorded: none recorded
- Sources: docs/book/standard/pattern-matching.md §3
- Book home (fragments' proposal): standard/pattern-matching
- Notes: contradiction — pattern-matching.md §3 says `when` arms do not narrow; contracts.md §4 says `when/is/then` arms lift the matched pattern tagged `match-case`, and contracts.md §9 says chunk 2 shipped "with `when/is/then` arms included". One of the two is stale; code not checked.
- Chapter: Contracts and the knowledge they give

### Termination and completion

#### Divergence is a computed effect
- Decides: possible non-termination is the effect `div`, written into inferred sets by the termination analysis before the declaration check, so totality uses the effect calculus with no parallel machinery; no primitive carries it and no handler exists; kernel primitives are axiomatically total.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Effect inference is driven by partial evaluation, and a declaration is a contract
- Significance: 4 — totality becomes one more effect
- Label: foundational — totality polymorphism, purity gates, `total`
- Units: totality, effects
- Options recorded: separate totality machinery (rejected)
- Sources: D31, CE-R1 (docs/decisions.md); docs/book/standard/totality.md §1 item 1; docs/book/concepts.md §43
- Book home (fragments' proposal): standard/totality
- Chapter: Termination and completion

#### Four-tier discharge spectrum
- Decides: every obligation is recorded per binding at one of auto, witnessed (kernel-checked `decreases`), admitted (`assume terminates` or an unverifiable metric) or undischarged (`partial`), verdict-visible and exported; surface forms `decreases`, `assume terminates`, `partial` and `total` are body forms in `lib/totality.alg`.
- Status: settled
- Type: capability
- Rationale kind: vision
- Depends on: Divergence is a computed effect; Body-form clauses at the head of a body, lowered through one chain
- Significance: 4 — "nothing is silently trusted" made operational
- Label: foundational — laws, verdict, ledger
- Units: totality, pcp
- Options recorded: silently trusting unrecognized metrics (the pre-F3 state, rejected)
- Sources: D34, CE-R2, CE-R3 (docs/decisions.md); docs/book/standard/totality.md §1–§2; docs/plans/completion-effects.md §3
- Book home (fragments' proposal): standard/totality
- Notes: `admitted` blocks inherited `div`; `witnessed` transmits it.
- Chapter: Termination and completion

#### Completion is totality and liveness
- Decides: incompleteness has two sources, divergence and blocking external reads; external sources discharge liveness by declared axiom (delay: live; fetch: admitted, ledger-visible), never by inference.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Divergence is a computed effect; Incompleteness lives in write-once future cells
- Significance: 3 — frames what "the program completes" means
- Label: foundational — liveness ledger and `sched`
- Units: totality, futures
- Options recorded: inferring liveness (rejected)
- Sources: D31, CE-R4 (docs/decisions.md); docs/book/standard/totality.md §1 item 7; structures.md §10
- Book home (fragments' proposal): standard/totality
- Chapter: Termination and completion

#### Strict at the contract, informational for undeclared code
- Decides: discharge accounting is always strict and a declaration (effect set, `total`, an annotation) is strict when it exists, while undeclared code gets info-tier findings; making undeclared code strict is per-project configuration, never a global change.
- Status: settled
- Type: capability
- Rationale kind: mixed
- Depends on: Four-tier discharge spectrum
- Significance: 3 — the severity policy for every analysis
- Label: foundational — contracts' failure semantics and exhaustiveness severity
- Units: totality, pipeline
- Options recorded: (a) strict by default, (b) opt-in `total`, (c) notify by default — v1 chose (c), D34 said strict; T-R1 composes them
- Sources: T-R1, T-R3 (docs/decisions.md; docs/book/standard/totality.md §5, §8); archive phase-e-totality-plan.md "Design questions" 1
- Book home (fragments' proposal): standard/totality
- Chapter: Termination and completion

#### Termination by bounded decrease
- Decides: a recursive call decreases when an argument is `param - K` (literal K > 0) and the callee's parameter type has a non-negative lower bound read from refinement domains; a detected decrease on an untyped parameter stays silent.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Abstract domains as sound approximations; Divergence is a computed effect
- Significance: 3 — automatic termination proof over refined types
- Label: swappable — analyzer criterion
- Units: totality
- Options recorded: always requiring `decreases`/`partial`; auto-detect structural with everything else `partial`; sized types (rejected for abstract domains)
- Sources: docs/book/standard/totality.md §1 item 5, §3, §6; archive phase-e-totality-plan.md questions 3–4
- Book home (fragments' proposal): standard/totality
- Chapter: Termination and completion

#### Project severity configuration
- Decides: open in shape — one per-project surface for `total`-by-default, per-notification promotion, blanket axiom patterns, and the construction-failure and exhaustiveness severity knobs (absorbing v1's `--strict`).
- Status: open
- Type: capability
- Rationale kind: technical
- Depends on: Strict at the contract, informational for undeclared code
- Significance: 2 — the relief valve for strictness
- Label: swappable — configuration surface
- Units: not yet a unit
- Options recorded: a manifest read at session start versus a body form; a global `--strict` flag (discarded)
- Sources: T-R2 (docs/decisions.md); CT-R2; docs/book/standard/totality.md §5, §7; B-099
- Book home (fragments' proposal): standard/totality
- Chapter: Termination and completion

#### Mutual recursion requires every edge to decrease
- Decides: over Tarjan SCCs, every in-cycle call must decrease individually; per-function `decreases` covers what the structural test cannot.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Termination by bounded decrease
- Significance: 2 — mutual recursion criterion
- Label: swappable — analyzer criterion
- Units: totality
- Options recorded: a common lexicographic measure per cycle (replaced; kept as the fallback)
- Sources: T-R4 (docs/decisions.md; docs/book/standard/totality.md §3, §8)
- Book home (fragments' proposal): standard/totality
- Chapter: Termination and completion

#### Totality polymorphism is effect polymorphism
- Decides: callback divergence propagates through effect propagation and effect variables; no `[t: Totality]` marker system exists, and a narrow stdlib-HOF structural check remains as a precision aid.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Divergence is a computed effect; Parameter effect bounds and explicit effect variables
- Significance: 2 — avoids a parallel polymorphism
- Label: swappable — analyzer precision aid
- Units: totality
- Options recorded: `[t: Totality]` markers (discarded)
- Sources: T-R5 (docs/decisions.md; docs/book/standard/totality.md §3, §6, §8); archive phase-e-totality-plan.md question 5
- Book home (fragments' proposal): standard/totality
- Chapter: Termination and completion

#### Exhaustiveness checking at info severity
- Decides: each `when` chain is analysed; `else`, wildcard or a bind-anything pattern covers it, Bool coverage is checked with a witness, unknown subject types stay silent, and findings are info until project configuration promotes them.
- Status: partly built
- Type: capability
- Rationale kind: technical
- Depends on: `when / is / then` pattern matching; Strict at the contract, informational for undeclared code
- Significance: 2 — coverage of matches
- Label: swappable — analyzer
- Units: totality
- Options recorded: always demanding `else` (rejected: statically covered finite domains need neither); halting on non-exhaustive finite matches (a maintainer decision, not taken)
- Sources: CE-R8, T-R3 (docs/decisions.md); docs/book/standard/totality.md §4; archive phase-e-totality-plan.md question 2
- Book home (fragments' proposal): standard/totality
- Notes: closed sums, record destructuring and refinement-aware dead cases are designed, not built.
- Chapter: Termination and completion

### When a check fails

#### Statement contracts halt, construction failure is an error value
- Decides: a false `assert`, `requires` or `ensures` halts compilation, while a failed refinement check at construction or `assert_invariant` yields an error value in the error channel; promoting either path is a maintainer decision through project configuration.
- Status: settled
- Type: capability
- Rationale kind: mixed
- Depends on: A failure a program can handle is supplied by an extension; Strict at the contract, informational for undeclared code
- Significance: 3 — failure semantics of all contract forms
- Label: foundational — the halt invariant cited across the project
- Units: contracts
- Options recorded: a warning tier for `assert` (v1, rejected); a global `--strict` flag (discarded)
- Sources: CT-R2, CE-R8 (docs/decisions.md); docs/book/standard/contracts.md §6–§7
- Book home (fragments' proposal): standard/contracts
- Chapter: When a check fails

#### Mechanical purity gates
- Decides: an `equals` or coercion implementation, and a value-inspecting invariant predicate, must infer an empty effect set, including `observe` and `div`; a violation is a compile error naming the label.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Effect inference is driven by partial evaluation, and a declaration is a contract; Divergence is a computed effect
- Significance: 2 — keeps equality knowledge-independent and guards from hanging
- Label: swappable — a consumer of inferred effects
- Units: equality-laws, contracts
- Options recorded: none recorded
- Sources: E-R5, CE-R7 (docs/decisions.md); docs/book/standard/totality.md §1 item 6; D32
- Book home (fragments' proposal): proposed "Equality and laws"
- Chapter: When a check fails

#### The triggered construction guard
- Decides: a refinement constructor checks its predicate on the built value; an unresolved check residualizes construction itself, a prior error propagates untouched, and only opaque (value-inspecting) predicates pay the div-freedom gate.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Invariants are refinements; A failure a program can handle is supplied by an extension; Mechanical purity gates
- Significance: 3 — an instance never exists tagged valid before its invariant holds
- Label: swappable — the mint's guard
- Units: refinements, type-core
- Options recorded: tagging construction valid under an unresolved predicate (the pre-CE-R8 bug)
- Sources: D32, CE-R8 (docs/decisions.md; docs/plans/completion-effects.md §3); docs/book/standard/contracts.md §5
- Book home (fragments' proposal): standard/contracts
- Chapter: When a check fails

#### `assume` is the admitted tier, and the silent assume is retired
- Decides: trust boundaries are recorded, ledger-visible admissions (`Law.assume`, `assume terminates`, a future `assumes` form); `assume_invariant`, which attaches a fact without recording it, is retired.
- Status: partly built
- Type: capability
- Rationale kind: vision
- Depends on: Four-tier discharge spectrum
- Significance: 2 — removes the one silent trust path
- Label: swappable — one primitive and one surface form
- Units: contracts
- Options recorded: rejecting `assume` (v1, superseded); surfacing `assume_invariant` as-is (rejected)
- Sources: CT-R3 (docs/decisions.md; docs/book/standard/contracts.md §2, §10); B-057, B-101
- Book home (fragments' proposal): standard/contracts
- Notes: `assume_invariant` is still registered (`src/primitives.ts:4566`).
- Chapter: When a check fails

#### Every failure carries a legible counterexample
- Decides: termination and exhaustiveness findings carry one-line executable witnesses, contract and refinement failures render the violated constraint and the actual Int value, a refinement predicate may return an error value whose text becomes the message, and an in-body `assert` over parameters is suggested as a `requires`.
- Status: partly built
- Type: capability
- Rationale kind: mixed
- Depends on: Abstract domains as sound approximations; Termination by bounded decrease
- Significance: 2 — diagnostics speak the program's terms
- Label: swappable — rendering
- Units: totality, contracts, refinements
- Options recorded: silently promoting asserts to the interface (rejected: suggestion only)
- Sources: docs/book/standard/totality.md §3; docs/book/standard/contracts.md §6–§7; B-081 slice (planning pilot C1)
- Book home (fragments' proposal): standard/contracts
- Notes: call-site origin and known facts in messages do not ship (B-057); `false || error "…"` does not pass the error value through. Related: "A refinement predicate explains its own refusal" (Plans as outcome graphs) is the kernel channel this entry's predicate-message clause rests on.
- Chapter: When a check fails

#### The verdict as accumulated metadata
- Decides: open — the verdict should be the top-level value's accumulated metadata (each channel defining its accumulation), replacing `buildVerdict`'s out-of-band walk of top-level bindings.
- Status: open
- Type: implementation — how the verdict is computed; what it reports is "Every result says how strongly it holds"
- Rationale kind: technical
- Depends on: Four-tier discharge spectrum; Metadata fields registered with declared propagation rules
- Significance: 2 — how obligations reach the verdict
- Label: swappable — verdict assembly
- Units: pcp
- Options recorded: a requirement-level gap (candidate R15, withdrawn)
- Sources: docs/book/concepts.md §45; B-117
- Book home (fragments' proposal): proposed standard/pcp
- Chapter: When a check fails

#### Contracts in the verdict and the ledger
- Decides: open — undischarged contracts should reach the verdict and assumption ledger; contracts reach only `inspect` today.
- Status: open
- Type: capability
- Rationale kind: vision
- Depends on: A contract is a predicate that becomes knowledge, discharged by PE; Every result says how strongly it holds
- Significance: 2 — closes a "silently trusted" gap
- Label: swappable — verdict assembly
- Units: contracts, pcp
- Options recorded: a new case in `buildVerdict` versus a contracts field with `union` propagation (concepts §45)
- Sources: CT-R6 (docs/decisions.md); docs/book/standard/contracts.md §7; docs/book/concepts.md §45–§46; B-057, B-117
- Book home (fragments' proposal): standard/contracts
- Chapter: When a check fails

### Units of measure

#### Rung 2 domain: units of measure over state machines
- Decides: rung 2's provable DSL is units-of-measure physics, chosen over state machines for the bridge to rung 3 and the mixed-model trajectory, built as a library with zero host code.
- Status: settled
- Type: capability — it decides which domain the thesis is shown in
- Rationale kind: mixed
- Depends on: A language inherits every check of what it is built on
- Significance: 3 — fixes the seriousness proof and the rung-3 measures
- Label: swappable — another domain would replace one library
- Units: not yet a unit (`lib/units.alg`)
- Options recorded: state machines (reachability and deadlock obligations; event-driven preview)
- Sources: R-R4; docs/plans/release-track.md §5, §7; docs/book/demo-ladder.ir.md C26, C28, C65 to C67
- Book home (fragments' proposal): The demo ladder and the rung-3 pilot / Rung 2: the units DSL (proposed chapter)
- Chapter: Units of measure

#### Dimensions as data, named dimensions as refinements over one Quantity
- Decides: a dimension is structural data (the full seven-vector of SI base dimensions) and each named dimension is a refinement over one `Quantity` record, so dimensional soundness is refinement discharge, with a mechanics-focused shipped unit set.
- Status: settled
- Type: capability
- Rationale kind: mixed
- Depends on: Refinement types; Kernel structural equality is the default; Extensions are the module substrate; Rung 2 domain: units of measure over state machines; Correctness and safety are one kind of claim
- Significance: 3 — the demonstration that a domain check needs no new machinery
- Label: swappable — a library over the kernel
- Units: not yet a unit
- Options recorded: dynamically minted nominal dimension types (rejected: would push to host code; revisitable at the user-generics surface); a reduced base dimension set (rejected); dynamically minted nominal dimension types (rejected: pushes toward host code and memo identity; a smaller base-dimension set
- Sources: U-R1, U-R5 (docs/decisions.md; docs/plans/units-dsl.md §1–§2, §5); D4; docs/plans/units-dsl.md §5); docs/book/demo-ladder.ir.md C68, C72, C73
- Book home (fragments' proposal): proposed chapter "Units of measure" (L2 domain surface) / Rung 2: the units DSL (proposed)
- Notes: Merged from fragment B ("Dimensions as data, named dimensions as refinements"), fragment C ("Dimensions as data, named dimensions as refinements over one Quantity"). B: accepted cost: `type of q` answers Quantity. C: accepted cost: `type of q` answers Quantity, not Velocity. Significance calibrated from 2/3.
- Chapter: Units of measure

#### Quantity laws at honest tiers
- Decides: the quantity laws are shown at their real tiers (sampled, admitted, pending), loudly, rather than restricting the demo to laws the kernel discharges.
- Status: settled
- Type: capability
- Rationale kind: vision
- Depends on: Law discharge tiers and the first strict gate; Every result says how strongly it holds; Dimensions as data, named dimensions as refinements over one Quantity
- Significance: 2 — principle 9 applied to a demo
- Label: swappable — library policy
- Units: not yet a unit
- Options recorded: kernel-dischargeable laws only (rejected)
- Sources: U-R3 (docs/decisions.md; docs/plans/units-dsl.md §4–§5); U-R3; docs/plans/units-dsl.md §5; docs/book/demo-ladder.ir.md C80, C81, C127, C128
- Book home (fragments' proposal): proposed "Units of measure" / Rung 2: the units DSL (proposed)
- Notes: Merged from fragment B ("Quantity laws at honest tiers"), fragment C ("Law honesty in a DSL"). C: the algebraic laws stay pending because record-domain quantifiers have no sample construction (B-089). Significance calibrated from 1/2.
- Chapter: Units of measure

#### Number-anchored quantity literals
- Decides: the units DSL works with zero grammar through typed operators; `use units` adds only number-anchored literals (`3 m/s^2`, `^` inside unit expressions only, horizontal whitespace between number and unit), and every computed value goes through the ordinary operator algebra.
- Status: settled
- Type: capability
- Rationale kind: mixed
- Depends on: Dimensions as data, named dimensions as refinements over one Quantity; The declarative `grammar { … }` block with hygienic templates; Rules for user-written EBNF
- Significance: 1 — DSL syntax scope
- Label: swappable — grammar sugar
- Units: not yet a unit
- Options recorded: bare-identifier juxtaposition (rejected: ambiguity); a global `^` operator (rejected); `in` conversion keyword (deferred: it interacts with the syntax track)
- Sources: U-R2 (docs/decisions.md; docs/plans/units-dsl.md §3); U-R2, U-R4; docs/plans/units-dsl.md §5; docs/book/extension/grammar.md §4 (explicit-ws override); docs/book/demo-ladder.ir.md C74 to C76
- Book home (fragments' proposal): proposed "Units of measure" / Rung 2: the units DSL (proposed)
- Notes: Merged from fragment B ("Number-anchored quantity literals over a grammar-free algebra"), fragment C ("Number-anchored unit literals").
- Chapter: Units of measure

#### Conversion sugar with `in`
- Decides: open — `5 km in m` sugar is deferred; `.to(m)` is the surface.
- Status: open
- Type: capability
- Rationale kind: aesthetic
- Depends on: Number-anchored quantity literals
- Significance: 1 — local sugar
- Label: swappable — grammar sugar
- Units: not yet a unit
- Options recorded: including `in` in U2 (rejected for now: collides with a future `use X in {…}`)
- Sources: U-R4 (docs/decisions.md; docs/plans/units-dsl.md §3, §5)
- Book home (fragments' proposal): proposed "Units of measure" ---
- Chapter: Units of measure

### Vivace: models as the program

#### Vivace adds a discipline, not machinery
- Decides: a Vivace domain is an L1 grammar extension plus L2 types and contracts, introducing no new trust roots, its guarantees reducing to L2 provability; the layer exists for the model-first methodology.
- Status: settled
- Type: capability — it decides what the Vivace tier is made of
- Rationale kind: vision
- Depends on: A language inherits every check of what it is built on; Correctness and safety are one kind of claim
- Significance: 3 — sets what a domain model may and may not add
- Label: foundational — every pilot is held to it; a pilot that cannot express its domain is a finding against the lower layers
- Units: not yet a unit
- Options recorded: new layer machinery (rejected in the boundary contract)
- Sources: docs/book/vivace/README.md (May depend on; Invariants); docs/book/vision.md §4 (transitive assurance)
- Book home (fragments' proposal): L3 Vivace: boundary contract
- Notes: Significance calibrated from 4.
- Chapter: Vivace: models as the program

#### Vivace hypothesis: models as the review artefacts
- Decides: application developers are to work in the highest-abstraction model that expresses the problem, with predicates and proofs opt-in, models and their constraints as the review artefacts, failures as build errors with counterexamples every stakeholder can read, and specialist-authored models giving transitive assurance; the tier is a hypothesis tested by three domain pilots (planning workflow, software system model, physics simulation), specification and verification first with execution external.
- Status: open
- Type: capability
- Rationale kind: vision
- Depends on: A language inherits every check of what it is built on; Vivace adds a discipline, not machinery; Claims are evaluated like everything else
- Significance: 3 — the hypothesis rung 3 tests
- Label: foundational — the pilots and B-080's roster are its tests
- Units: not yet a unit
- Options recorded: Shape 1 (specify, execute externally) versus Shape 2 (Allegro runs the model); none recorded ("don't over-design ahead of evidence")
- Sources: docs/book/vision.md §4; docs/plans/release-track.md §3 D6
- Book home (fragments' proposal): the tour (proposed) / vivace/README.md / L3 Vivace: boundary contract / Vision and principles
- Notes: Merged from fragment A ("Vivace as a model-driven hypothesis tier"), fragment C ("Vivace hypothesis: models as the review artefacts"). A: seven known gaps are named as open work there; detail belongs to the Vivace fragment. C: vision §4 calls it "work-in-progress, not settled"; seven gaps are open (B-081 to B-087 range). Assembly: placed in Part V; its dependencies are thesis-level, so it could open the book's L3 discussion as early as Part I if the maintainer prefers. Significance calibrated from 2/4.
- Chapter: Vivace: models as the program

#### Three different pilots, planning first
- Decides: three deliberately different pilots test the hypothesis (project planning, a software system model, physics simulations), and the planning workflow goes first as a self-contained DSL with rich structural constraints.
- Status: settled
- Type: capability — it decides which domains the tier must express
- Rationale kind: mixed
- Depends on: Vivace hypothesis: models as the review artefacts
- Significance: 3 — fixes rung 3's domain
- Label: swappable — another first pilot replaces one library
- Units: not yet a unit
- Options recorded: software system model (tests composition); physics simulations (float refinements over units)
- Sources: docs/book/vivace/planning-dsl.md §1; docs/book/vision.md §4 (The pilots); docs/plans/planning-pilot.md §1, R4; docs/plans/archive/project-1-planning-dsl-design.md
- Book home (fragments' proposal): The planning DSL
- Notes: confirmed by the maintainer 2026-10-25.
- Chapter: Vivace: models as the program

#### Shape 1 before Shape 2
- Decides: every pilot starts as Shape 1, specified and verified in Allegro with execution external, and Shape 2, in which Allegro runs the model, is a later, separable concern.
- Status: settled
- Type: capability — it decides that a Vivace model is verified, not run, for now
- Rationale kind: mixed
- Depends on: Vivace hypothesis: models as the review artefacts
- Significance: 3 — keeps the pilot to specification and checking
- Label: swappable — Shape 2 adds to, not changes, Shape 1
- Units: not yet a unit
- Options recorded: execution from the start (Shape 2 first)
- Sources: docs/book/vision.md §4; docs/book/vivace/planning-dsl.md §1; docs/plans/planning-pilot.md §2 item 1, R4, §7; docs/book/demo-ladder.ir.md C88, C129
- Book home (fragments' proposal): L3 Vivace: boundary contract / The planning DSL
- Notes: no backlog item names Shape 2 (demo-ladder C133).
- Chapter: Vivace: models as the program

#### Library before surface
- Decides: the planning model is built and tested as a plain Allegro library through its API before the `plan NAME:` grammar, because the surface may surface engine work and the model is what rung 3 tests.
- Status: settled
- Type: implementation — a build order; another order changes no capability
- Rationale kind: technical
- Depends on: Three different pilots, planning first
- Significance: 2 — sequencing that makes the API the model's truth
- Label: swappable — the surface expands to the API's values
- Units: not yet a unit (`lib/planning.alg`)
- Options recorded: surface first
- Sources: docs/plans/planning-pilot.md §2 item 3; docs/book/language-reference.md (Domain surfaces: "the library builds the same values the API builds")
- Book home (fragments' proposal): The planning DSL
- Notes: the same rule holds the catalog surface back (convention 14).
- Chapter: Vivace: models as the program

### Plans as outcome graphs

#### A plan is an outcome graph with derived wiring
- Decides: a plan is a DAG of nodes with typed inputs and outcomes, whose edges are derived from wiring an outcome into every input of the same type in scope, with names assigned only where a match is ambiguous; the performer is metadata, never structure.
- Status: settled
- Type: capability
- Rationale kind: mixed
- Depends on: Three different pilots, planning first
- Significance: 3 — every check, budget and search reads the graph
- Label: foundational — acyclicity, completeness, budgets, handlers, choices and completion all derive from it
- Units: not yet a unit (`lib/planning.alg`)
- Options recorded: a task-focused model (rejected); explicit dependency edges (rejected: they duplicate the types and drift)
- Sources: docs/book/vivace/planning-dsl.md §2.1, §2.3, §3 conventions 5, §4
- Book home (fragments' proposal): The planning DSL
- Notes: Significance calibrated from 4.
- Chapter: Plans as outcome graphs

#### Leaf and composite nodes, with `uses` to borrow a plan
- Decides: a node is a leaf (estimate, instructions) or a composite with its own internal graph whose declared outcomes must be what that graph produces, and `Name: uses Other` makes a separately declared plan a node's graph, across files through `import`.
- Status: settled
- Type: capability
- Rationale kind: mixed
- Depends on: A plan is an outcome graph with derived wiring; `use` header for language extension, `import` for module values
- Significance: 3 — hierarchy without a sub-plan notion
- Label: swappable — within the planning library
- Units: not yet a unit
- Options recorded: a separate sub-plan notion (avoided)
- Sources: docs/book/vivace/planning-dsl.md §2.2, conventions 6 and 10, §8 (closed at B2)
- Book home (fragments' proposal): The planning DSL
- Chapter: Plans as outcome graphs

#### Failure handlers over outcomes
- Decides: a node declares the failure types it can raise (`fails:`); `on F:` inside a composite is an alternate graph that must produce the composite's outcomes from the scope's inputs and the outcomes upstream of every raiser; a failure propagates to the nearest matching handler, an unhandled one escalates to the plan's caller without a finding, and a handler for an undeclared failure is refused.
- Status: settled
- Type: capability
- Rationale kind: mixed
- Depends on: Leaf and composite nodes, with `uses` to borrow a plan
- Significance: 3 — the model's error semantics
- Label: swappable — handler checks in the library
- Units: not yet a unit
- Options recorded: re-escalation on an unreachable outcome as an accepted shape (the archived default, replaced by refusal at A4)
- Sources: docs/book/vivace/planning-dsl.md §2.5, conventions 4 and 9, §7 (A4 readings)
- Book home (fragments' proposal): The planning DSL
- Notes: convention 9 still says "re-escalation on an unreachable outcome is the default" while §7 says a handler that cannot produce the outcomes is refused at check time; the two describe run time and check time but read as conflicting.
- Chapter: Plans as outcome graphs

#### Two enforcement shapes for a well-formed plan
- Decides: the plan constructor yields an error value in domain terms when a check fails (guarded construction, weaker than a halt), while a binding annotated `WellFormedPlan`, which the `plan` statement expands to, halts compilation.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Claims are evaluated like everything else; Statement forms that declare a binding
- Significance: 3 — makes "a plan that does not check does not build" literal
- Label: swappable — the library picks which path a site uses
- Units: not yet a unit
- Options recorded: none recorded
- Sources: docs/book/vivace/planning-dsl.md §7 (Two enforcement shapes); docs/plans/planning-pilot.md §2 item 4; CE-R8; D32
- Book home (fragments' proposal): The planning DSL
- Notes: every node-tree walk inside the predicate is `assume terminates`, since no verified `decreases` metric fits a walk into a child list (§6 table).
- Chapter: Plans as outcome graphs

#### A refinement predicate explains its own refusal
- Decides: a refinement predicate that answers an error value explains the refusal, and the kernel carries that text into the halt or error value at every refusal site, with no registered slot and no renderer registry, so a model's legibility travels with its type.
- Status: partly built
- Type: capability
- Rationale kind: technical
- Depends on: Two enforcement shapes for a well-formed plan; Refinement types
- Significance: 3 — counterexample legibility, one of the seven Vivace gaps
- Label: swappable — a predicate convention plus one kernel channel
- Units: refinements, type-primitives
- Options recorded: a renderer hook `T.onFailure` (the v1 sketch, archived); a registered slot or renderer registry (rejected); deferring rendering until the primitive version ran (the 2026-10-25 ruling, lifted at C1)
- Sources: docs/book/vivace/planning-dsl.md §7 (C1); docs/book/standard/contracts.md §7 (cited there); docs/plans/planning-pilot.md §1, stage C1; B-081; docs/book/language-reference.md (a predicate that answers an error value)
- Book home (fragments' proposal): Contracts and invariants, cited from The planning DSL
- Notes: remaining under B-081: the inspect channel, call-site origin, rendering the refused value.
- Chapter: Plans as outcome graphs

#### Planning surface conventions
- Decides: one declaration keyword `plan`; no keyword for sub-units, a capitalised name with `:` and an indented block being a node; reserved lowercase configuration keys (`inputs`, `outcomes`, `estimate`, `instructions`, `budget`, `on`, `retry`, `uses`, `fails`, `options`).
- Status: settled
- Type: capability
- Rationale kind: aesthetic
- Depends on: Indentation blocks, with brace and offside both as the goal; A plan is an outcome graph with derived wiring
- Significance: 2 — the planning DSL's look
- Label: swappable — `planning_grammar` only
- Units: not yet a unit
- Options recorded: `process`, `procedure`, `project` as declaration keywords (rejected until a distinction earns one); `node`, `step`, `action`, `sub-plan` for sub-units (rejected: each implied a performer or a granularity)
- Sources: docs/book/vivace/planning-dsl.md §3 conventions 1, 2, 4, 13; §4; docs/book/language-reference.md (Domain surfaces)
- Book home (fragments' proposal): The planning DSL
- Notes: the first offside-rule fragment in `lib/`.
- Chapter: Plans as outcome graphs

#### Bracket constraints as refinements, named as predicate fixtures
- Decides: `[predicate]` after an input or outcome is a refinement over the port's type, the predicate a snake_case fixture in the manner of behaviour-driven tests; a fixture on an outcome is a promise, on an input a requirement its producer must carry, and every node outcome must be consumed or declared.
- Status: settled
- Type: capability
- Rationale kind: mixed
- Depends on: Refinement types written `T & predicate` with `_` as the value; A plan is an outcome graph with derived wiring
- Significance: 2 — how domain constraints are written
- Label: swappable — planning library and grammar
- Units: not yet a unit
- Options recorded: none recorded
- Sources: docs/book/vivace/planning-dsl.md §3 conventions 3, 11; §7 (two readings)
- Book home (fragments' proposal): The planning DSL
- Chapter: Plans as outcome graphs

#### Planning-local effort and money, durations from the units DSL
- Decides: effort and money are planning-local record types with their own arithmetic, so a mismatch is an error in planning vocabulary, while durations reuse the units DSL's time dimension.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Dimensions as data, named dimensions as refinements over one Quantity
- Significance: 2 — the rung-2 to rung-3 bridge
- Label: swappable — measure types inside the library
- Units: not yet a unit
- Options recorded: generalise `lib/units.alg` to named non-SI base dimensions (left to the units design); plain numbers (rejected: loses the dimensional error); planning-local `Duration` (rejected for durations)
- Sources: R1 and R2 of docs/plans/planning-pilot.md §3; docs/book/vivace/planning-dsl.md §6 (first finding)
- Book home (fragments' proposal): The planning DSL
- Chapter: Plans as outcome graphs

#### Estimates roll up, budgets are proved
- Decides: estimates are leaf costs in measures (duration, effort, money) that roll up as an upper bound (serial durations, a missing measure contributing nothing, a retry multiplying by its maximum attempts, handlers included in `rollup_bound`), and a budget is a constraint the rollup must not exceed, checked dimensionally.
- Status: settled
- Type: capability
- Rationale kind: mixed
- Depends on: A plan is an outcome graph with derived wiring; Planning-local effort and money, durations from the units DSL
- Significance: 3 — the plan's quantitative claim
- Label: swappable — rollup and budget functions in the library
- Units: not yet a unit
- Options recorded: budgets reported rather than proved (rejected); handlers outside the bound (the A3 reading, replaced at A4)
- Sources: docs/book/vivace/planning-dsl.md §2.4, conventions 8 and 12, §7 (A3 and A4 readings)
- Book home (fragments' proposal): The planning DSL
- Notes: retry also has a richer `iterate: until … ; max N; backoff Xs` form in convention 12 that no source shows as built.
- Chapter: Plans as outcome graphs

#### Scheduling, resources, performers and latitude
- Decides: whether and how plans carry scheduling, resource management, performer assignment and latitude grading; all are absent from a valid plan today, performer probably metadata.
- Status: open
- Type: capability
- Rationale kind: mixed
- Depends on: A plan is an outcome graph with derived wiring
- Significance: 2 — the model's next dimensions
- Label: swappable — optional metadata
- Units: not yet a unit
- Options recorded: none recorded
- Sources: docs/book/vivace/planning-dsl.md §2.6, §8
- Book home (fragments' proposal): The planning DSL
- Chapter: Plans as outcome graphs

#### Fan-in through an explicit aggregator node
- Decides: several outcomes join only through an explicit aggregator node (or a branch or a handler), and a universal fan-in shorthand is deferred.
- Status: open
- Type: capability
- Rationale kind: aesthetic
- Depends on: A plan is an outcome graph with derived wiring
- Significance: 1 — a known wart in the surface
- Label: swappable — surface sugar
- Units: not yet a unit
- Options recorded: universal fan-in shorthand (deferred)
- Sources: docs/book/vivace/planning-dsl.md convention 7, §4, §8
- Book home (fragments' proposal): The planning DSL
- Chapter: Plans as outcome graphs

#### Explicit `raise` and failure context in handlers
- Decides: whether a handler gets an explicit "cannot recover, propagate" directive and whether its graph may read what failed.
- Status: open
- Type: capability
- Rationale kind: mixed
- Depends on: Failure handlers over outcomes
- Significance: 1 — handler surface
- Label: swappable — library and grammar
- Units: not yet a unit
- Options recorded: auto-escalation (today)
- Sources: docs/book/vivace/planning-dsl.md convention 9, §8
- Book home (fragments' proposal): The planning DSL
- Chapter: Plans as outcome graphs

### Finding solutions to a model

#### Choices, templates and solution finding by enumeration
- Decides: a node with `options:` is a choice, a plan with choices is a template, and `solve` enumerates resolutions, keeps the well-formed ones and answers the best by the bound's effort and then its duration, naming the cheapest failing resolution when none fits.
- Status: settled
- Type: capability
- Rationale kind: mixed
- Depends on: Estimates roll up, budgets are proved; Vivace hypothesis: models as the review artefacts
- Significance: 3 — the first solution finding over a model
- Label: swappable — the search is library code
- Units: not yet a unit
- Options recorded: scheduling under a resource limit; completion from a catalog; retry tuning (weighed and deferred at D1); inference rather than choice
- Sources: R3 of docs/plans/planning-pilot.md §3; docs/book/vivace/planning-dsl.md §2.7, convention 13, §7 (D1); docs/book/vision.md §1a ("solution finding is search")
- Book home (fragments' proposal): The planning DSL
- Notes: no choice in a borrowed plan or a recovery; a borrowed plan is solved before borrowing.
- Chapter: Finding solutions to a model

#### Completion from a catalog
- Decides: a gap is what the wiring and outcome checks already report, a catalog is a list of nodes and plans, and `solve_from` fills the plan's own scope's gaps by chaining catalog nodes backward to a depth, then resolves, with no syntax marking a gap.
- Status: settled
- Type: capability
- Rationale kind: mixed
- Depends on: Choices, templates and solution finding by enumeration
- Significance: 3 — the shape of the AI iteration loop over a model
- Label: swappable — library search
- Units: not yet a unit
- Options recorded: completion inside composites (kept a finding); a surface form for catalogs (waits)
- Sources: docs/book/vivace/planning-dsl.md §2.8, convention 14, §7 (D2); docs/plans/planning-pilot.md stage D2
- Book home (fragments' proposal): The planning DSL
- Notes: D2 also made enumeration check the template once and only budgets and handlers per resolution.
- Chapter: Finding solutions to a model

#### Library search over kernel residuals
- Decides: the planning search computes its bound directly in the library rather than leaving choices unresolved and reading an interval off the kernel's residual rollup; revisit when a model's constraint is a predicate the kernel already reasons about.
- Status: settled
- Type: implementation — where the bound is computed; the answer is the same
- Rationale kind: technical
- Depends on: Completion from a catalog; Proofs are values discharged by evaluation
- Significance: 3 — where Vivace search sits relative to the falsifiable constraint
- Label: swappable — the search can move to the kernel later
- Units: not yet a unit
- Options recorded: kernel residuals with interval domains (rejected: needs interval arithmetic over quantities, predicate propagation onto residuals (B-098) and a read-back surface, and yields a bound, not a selection)
- Sources: docs/book/vivace/planning-dsl.md §7 (D2 paragraph), §8
- Book home (fragments' proposal): The planning DSL
- Notes: a library search is not a parallel proof infrastructure, but the book should argue that against the falsifiable constraint explicitly.
- Chapter: Finding solutions to a model

#### Composition of models and the AI loop over a model
- Decides: how two domain models compose (cross-domain predicates, arbitration) and how an AI agent iterates over a model with usable failure modes; both are Vivace gaps without a design.
- Status: open
- Type: capability
- Rationale kind: vision
- Depends on: Vivace hypothesis: models as the review artefacts; Completion from a catalog
- Significance: 3 — the capstone's prerequisites
- Label: foundational — the mixed-model capstone rests on both
- Units: not yet a unit
- Options recorded: none recorded
- Sources: docs/book/vision.md §4 (seven gaps); B-082, B-083; docs/book/demo-ladder.ir.md C130 to C132; docs/plans/release-track.md §3 D6, D7
- Book home (fragments' proposal): L3 Vivace: boundary contract
- Chapter: Finding solutions to a model

#### Mixed-model solution finding as the capstone
- Decides: heterogeneous models coupled into one solution space, AI agents proposing, the kernel scoring and every candidate carrying its assumption ledger, is the summit the ladder climbs toward, kept as labelled direction.
- Status: open
- Type: capability
- Rationale kind: vision
- Depends on: Composition of models and the AI loop over a model
- Significance: 3 — the private motivation for sequencing
- Label: foundational — would rest on every rung
- Units: not yet a unit
- Options recorded: none recorded
- Sources: docs/plans/release-track.md §3 D7, §5 rung 4; docs/book/demo-ladder.ir.md C115
- Book home (fragments' proposal): The demo ladder and the rung-3 pilot
- Chapter: Finding solutions to a model

#### Search beyond enumeration
- Decides: whether to add branch-and-bound over partial resolutions when a template outgrows enumeration.
- Status: open
- Type: capability
- Rationale kind: technical
- Depends on: Choices, templates and solution finding by enumeration
- Significance: 2 — scale of the search
- Label: swappable — library
- Units: not yet a unit
- Options recorded: branch-and-bound (named as the next step)
- Sources: docs/book/vivace/planning-dsl.md §7, §8; docs/plans/planning-pilot.md stage D3
- Book home (fragments' proposal): The planning DSL
- Chapter: Finding solutions to a model

### The build pipeline

#### Precompile before the evaluation loop
- Decides: under Allegro Standard only, precompile partially evaluates each function definition's body over typed placeholders before the evaluation loop, inferring return types and effects, skipping library-owned functions and recording mismatches as notifications.
- Status: settled
- Type: implementation — the mechanism by which a function's body is checked before it runs
- Rationale kind: technical
- Depends on: One operation: partial evaluation; Types are values that constrain values
- Significance: 4 — where type and effect inference happen
- Label: foundational — the divergence stamp, the effects declaration check and the inferred list depend on its output
- Units: pipeline, evaluator
- Options recorded: none recorded
- Sources: docs/book/layers.md §2 (def-precompile); docs/book/platform/build-pipeline.ir.md C81 to C97, C166 to C169
- Book home (fragments' proposal): The evaluation pipeline
- Notes: Assembly: the dependency on the stage order was dropped to break a cycle (the stage order places precompile, so it depends on precompile); a dependency on "Types are values that constrain values" was added, since precompile runs over typed placeholders.
- Chapter: The build pipeline

#### The evalSource stage order
- Decides: `evalSource` runs, in order, channel sealing, the divergence-analysis placeholder, library-owned collection, grammar merge and parse, `buildProgram`, literal typing, symbol resolution, body-metadata collapse and tail marking, the divergence analysis, precompile, the post-precompile checks, the evaluation scope, the evaluation loop in source order, forward chaining, the proof and `proven` checks, and symbol registration.
- Status: settled
- Type: implementation
- Rationale kind: technical
- Depends on: One evalSource pipeline for programs and libraries; Precompile before the evaluation loop
- Significance: 3 — each stage's assumptions are the next stage's guarantees
- Label: foundational — the ordering constraints (resolve before tail marking, collapse before precompile, stamp before the effects check) are load-bearing
- Units: pipeline
- Options recorded: none recorded
- Sources: docs/book/platform/build-pipeline.ir.md C17 to C63; docs/book/concepts.md §29 (cited there)
- Book home (fragments' proposal): The evaluation pipeline
- Notes: Significance calibrated from 4.
- Chapter: The build pipeline

#### Post-passes registered by layers
- Decides: the post-passes, Allegro Standard concepts hardcoded into the base's stage list today, should be registered by the layer that owns them, through the plane-interface fix shape.
- Status: open
- Type: implementation — where the post-passes are registered in the code
- Rationale kind: technical
- Depends on: The evalSource stage order; Plane interfaces are sanctioned and policed
- Significance: 3 — would make the pipeline layer-neutral
- Label: foundational — moving the passes changes what L0 knows of L2
- Units: pipeline
- Options recorded: hardcoded stage list (today)
- Sources: docs/book/platform/build-pipeline.ir.md C144 to C146; docs/book/concepts.md §29 (cited there); B-110
- Book home (fragments' proposal): The evaluation pipeline
- Chapter: The build pipeline

#### Definition and memo entries in the precompile context
- Decides: in the precompile context a function definition becomes a definition entry, evaluated once at first lookup and binding the first object built for every later lookup, and any other unresolved binding a memo entry evaluated once at first lookup.
- Status: settled
- Type: implementation
- Rationale kind: technical
- Depends on: Precompile before the evaluation loop
- Significance: 2 — gives one object per definition, which the cutoff needs
- Label: swappable — internal to the pipeline unit
- Units: pipeline
- Options recorded: none recorded
- Sources: docs/book/platform/build-pipeline.ir.md C84 to C87, C160 to C166 (T37); docs/plans/recursive-precompile.md §7 (cited at C175)
- Book home (fragments' proposal): The evaluation pipeline
- Chapter: The build pipeline

#### Inline cutoff for recursive bindings
- Decides: during a typed compilation, a speculative call with an unresolved argument into a recursion cycle (found by the divergence analysis, and recognised by the object its definition is bound to in the precompile context or a copy sharing its body) is residualised rather than unfolded, whatever its discharge tier; a fully applied call still executes.
- Status: partly built
- Type: implementation — a cutoff for a precompile performance pathology
- Rationale kind: technical
- Depends on: PE Rule 1: residualise, but unfold composed calls; Definition and memo entries in the precompile context; Divergence is a computed effect; Mutual recursion requires every edge to decrease
- Significance: 3 — without it precompile unfolds recursion until the stack overflows
- Label: swappable — one injected predicate
- Units: evaluator, pipeline; pipeline, evaluator; totality, pipeline
- Options recorded: key on discharge tier (rejected: penalised proven-total functions about 700×); (a) match by the definition's body; (b) the bound definition object (taken); (c) a registered property naming the source definition (out of scope); none recorded in this source (the recursive-precompile plan holds the chunk record); cutting only `undischarged`/`partial` bindings (rejected on measurement: ~700× penalty for proven-total functions)
- Sources: docs/decisions.md T-R6; docs/plans/recursive-precompile.md §1 terms, §6 RR1; docs/book/allegretto/evaluator.md §3; docs/book/platform/build-pipeline.ir.md C98, C100, C102, C170 to C175; docs/plans/recursive-precompile.md §7; T-R6 (docs/decisions.md; docs/book/standard/totality.md §7–§8); B-159 R2/R3; B-100, B-180
- Book home (fragments' proposal): allegretto/evaluator.md §3 / The evaluation pipeline / standard/totality
- Notes: Merged from fragment A ("Recursion inline cutoff keyed on the bound definition"), fragment C ("Inline cutoff for recursive bindings"), fragment B ("Recursion inlining cutoff on cycle membership"). A: soundness review pending (B-100). `setInlineCutoff` takes no writer capability (evaluator.md §7). The cutoff's identity test silently missed every typed function from B-121 C2 until B-159: an instance of identity-sensitive objects meeting copy-on-attach. C: the cutoff was inert for typed functions after B-121 C2 until B-159 R2 restored it (C175). B: soundness review pending (B-100); the analysis can still reach a host stack overflow through recursion the cutoff does not see. Assembly: three entries merged (fragment A's evaluator view, fragment B's totality view, fragment C's pipeline view). Significance calibrated from 3/3/2.
- Chapter: The build pipeline

#### Effects deferred during precompile
- Decides: during precompile, an effectful primitive returns a residual even over resolved arguments, deferring its side effect to the run.
- Status: settled
- Type: implementation — a rule of the precompile mechanism
- Rationale kind: technical
- Depends on: One operation: partial evaluation; Precompile before the evaluation loop
- Significance: 2 — compile time runs no effect
- Label: swappable — inside the evaluator
- Units: evaluator
- Options recorded: none recorded
- Sources: docs/book/allegretto/evaluator.md §3; docs/plans/pe-rules.md §6 RR3
- Book home (fragments' proposal): allegretto/evaluator.md §3
- Notes: Assembly: moved from the evaluator to the pipeline chapter and given a dependency on "Precompile before the evaluation loop", whose concept it uses.
- Chapter: The build pipeline

#### Soft-fail evaluation for verdict tools
- Decides: with `softFail` set, the halting post-passes record their error notifications without throwing, and `verify`, `obligations` and `propose` run that way so the verdict can describe the failures.
- Status: settled
- Type: capability — it decides what the verdict tools can report
- Rationale kind: technical
- Depends on: Claims are evaluated like everything else
- Significance: 2 — lets tooling report instead of stopping
- Label: swappable — a flag on one stage
- Units: pipeline, cli
- Options recorded: none recorded
- Sources: docs/book/platform/build-pipeline.ir.md C68, C69; docs/book/platform/tooling.ir.md C72, C100
- Book home (fragments' proposal): The evaluation pipeline
- Notes: `inspect` runs without soft-fail, so a halting failure never reaches a safety grade (tooling C95).
- Chapter: The build pipeline

#### Evaluation and parse statistics as diagnostics
- Decides: four environment variables switch on diagnostics (`ALLEGRO_STACK`, `ALLEGRO_TRACE_DEPTH`, `ALLEGRO_PARSE_STATS`, `ALLEGRO_EVAL_STATS`), the two stats variables read inside the pipeline so they reach every caller, with stats sinks for tests and gates.
- Status: settled
- Type: implementation — diagnostics of this implementation
- Rationale kind: technical
- Depends on: The evalSource stage order
- Significance: 1 — diagnostics
- Label: swappable — local switches
- Units: pipeline, evaluator, grammar-formalism, cli
- Options recorded: none recorded
- Sources: docs/book/platform/tooling.ir.md C137 to C154; docs/book/platform/build-pipeline.ir.md C40, C41, C104, C105
- Book home (fragments' proposal): Tooling
- Notes: `ALLEGRO_TRACE_DEPTH` treats its value as the step, so the comment's "1 prints every 500 levels" is wrong (tooling R5); the unguarded `process.env` read at `src/evaluator.ts:23` breaks the browser bundle (host C110 to C114).
- Chapter: The build pipeline

### Tools over the pipeline

#### Inspect reports only what the pipeline computed
- Decides: `inspect` adds no analysis of its own: each binding summary (type, refinements, contract, declared and inferred effects, totality notices, proof backings, promotion hints) is read from what parsing, resolution, precompile and evaluation already computed.
- Status: settled
- Type: capability — a guarantee to the tool's user
- Rationale kind: vision
- Depends on: Types are values that constrain values
- Significance: 3 — keeps review on the one engine
- Label: swappable — the `introspect` unit, depending on the pipeline alone
- Units: introspect
- Options recorded: none recorded
- Sources: docs/book/platform/tooling.ir.md C11, C66 to C84; docs/book/vision.md §3, §5 principles 2 and 6
- Book home (fragments' proposal): Tooling
- Notes: `docs/book/implementation-map.md` puts `src/introspect.ts` in L2 while `units.json` puts it on the track layer (tooling R7). 19 kind comparisons in `src/introspect.ts` break the discriminator rule (C15).
- Chapter: Tools over the pipeline

#### Safety grade as the default verification surface
- Decides: the default surface of verification is a coarse safety grade per module (`proven-safe`, `partial`, `has-warnings`, `has-errors`), with theorem-level detail as opt-in drill-down.
- Status: partly built
- Type: capability
- Rationale kind: vision
- Depends on: Inspect reports only what the pipeline computed; Every result says how strongly it holds; From experiment to proof without rewriting
- Significance: 3 — the reviewability claim's face
- Label: swappable — `safetyGradeFor` behind the summary
- Units: introspect
- Options recorded: a proof transcript as the default surface (rejected by principle 7)
- Sources: docs/book/vision.md §3, §5 principle 7; docs/book/platform/tooling.ir.md C85 to C98 (def-safety-grade)
- Book home (fragments' proposal): Tooling
- Notes: the implemented grade counts no unproven sub-expression, unlike principle 7's "N warnings about M unproven sub-expressions" (R6); nothing produces `has-warnings` (C92); the code calls the grade a coarse placeholder (C94). Assembly: gained a dependency on "From experiment to proof without rewriting" (inverted from that entry).
- Chapter: Tools over the pipeline

#### One command-line entry with subcommands
- Decides: `src/index.ts` is the single command-line entry named `allegro`, where a first argument naming one of five subcommands selects it, any other first argument is a file to run, and no argument starts the REPL, each subcommand's module imported dynamically.
- Status: settled
- Type: capability — the command-line surface
- Rationale kind: technical
- Depends on: none
- Significance: 2 — the user's door
- Label: swappable — the `cli` unit
- Units: cli
- Options recorded: none recorded
- Sources: docs/book/platform/tooling.ir.md C17, C23 to C33
- Book home (fragments' proposal): Tooling
- Notes: `package.json` declares no `bin` entry (C24); the CLI's startup cost is open as B-161.
- Chapter: Tools over the pipeline

#### File runner as one evaluation with futures drained
- Decides: the file runner creates one future manager per run, loads `use` modules and then the body's `import` modules (local `lib/` first, then the system `lib/`), evaluates the stripped body once, waits for every pending future, and turns any error into exit code 1.
- Status: settled
- Type: capability — what running a file guarantees: futures drained, an error as exit code 1
- Rationale kind: technical
- Depends on: `use` header for language extension, `import` for module values; Incompleteness lives in write-once future cells
- Significance: 2 — the reference way a program runs
- Label: swappable — `runFile` in the `cli` unit
- Units: cli, module-loading
- Options recorded: none recorded
- Sources: docs/book/platform/tooling.ir.md C34 to C50; docs/book/platform/host.ir.md C57 to C61
- Book home (fragments' proposal): Tooling
- Notes: the suite runs demos through `evalSource` with extensions it chooses, not through the file runner, so a demo can pass the suite and fail the runner (C49, C50).
- Chapter: Tools over the pipeline

#### REPL as successive evaluations over a persistent scope
- Decides: the REPL evaluates each buffered entry through `evalSource` with the previous entry's scope as the base scope and one future manager for the session, continuing an entry when the line ends in an operator, comma or open bracket.
- Status: partly built
- Type: capability — the REPL's behaviour for its user
- Rationale kind: technical
- Depends on: Scope is the evaluation environment, not data
- Significance: 2 — interactive use
- Label: swappable — `repl` in the `cli` unit
- Units: cli
- Options recorded: none recorded
- Sources: docs/book/platform/tooling.ir.md C51 to C65; B-065
- Book home (fragments' proposal): Tooling
- Notes: the continuation rule exists in code but every continued entry fails to parse (C62); the REPL loads no `use` or `import` module (C60, C61). No test drives the REPL (C64).
- Chapter: Tools over the pipeline

#### Obligations and proposals as machine and human views
- Decides: `obligations` emits one obligation per proof binding, undischarged `div` entry and law or coercion obligation, as JSON lines or text, and `propose` renders the pending ones as a Markdown TODO with the last failure, hints, lemmas in scope and prior attempts.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Anyone may propose, and the record shows who; Soft-fail evaluation for verdict tools
- Significance: 2 — the protocol's request side
- Label: swappable — renderings over the `pcp` schemas
- Units: pcp, cli
- Options recorded: none recorded
- Sources: docs/book/platform/tooling.ir.md C111 to C122, C168
- Book home (fragments' proposal): Tooling
- Notes: `--pending` lists failed `proven` clauses while the full listing lists none, against a comment claiming they are covered (R9).
- Chapter: Tools over the pipeline

#### Execution tracing and step-through debugging
- Decides: the T-tooling track is to provide execution tracing, graph inspection and step-through debugging (milestone M7); the shape is undesigned.
- Status: open
- Type: capability
- Rationale kind: technical
- Depends on: Expressions are values, forming a DAG
- Significance: 2 — tooling milestone
- Label: swappable — a new tooling unit
- Units: not yet a unit
- Options recorded: none recorded
- Sources: docs/book/layers.md §2, §3 (M7); docs/book/platform/README.md; docs/book/platform/tooling.ir.md C155 to C157; B-064
- Book home (fragments' proposal): Tooling
- Notes: the only depth diagnostic prints waterlines, not a trace (C145).
- Chapter: Tools over the pipeline

### Hosts: the terminal and the browser

#### Environment capabilities outside the base, effect-labelled
- Decides: `print`, `fetch` and `delay` are environment-provided capabilities, not base primitives, each carrying an effect label (`io`, `net`, `time`), with the relocation of every non-base primitive out of the base registry as future work.
- Status: partly built
- Type: capability
- Rationale kind: technical
- Depends on: Minimal base surface of about forty primitives; Effect inference is driven by partial evaluation, and a declaration is a contract
- Significance: 3 — makes I/O visible to the effect system
- Label: swappable — the host can offer a different set
- Units: not yet a unit (T-host track); base-primitives, futures (today; a `host` unit is proposed)
- Options recorded: IO as base primitives (rejected in the audit)
- Sources: docs/decisions.md D27; docs/book/allegretto/structures.md §11, Appendix B; docs/book/allegretto/README.md; D27; docs/book/allegretto/structures.md §11 and Appendix B (cited at host C14 to C17); docs/book/platform/host.ir.md C9 to C17, C25
- Book home (fragments' proposal): platform/host (II.23) or allegretto base-primitives chapter / Host environments
- Notes: Merged from fragment A ("Environment capabilities are host-provided and effect-labelled"), fragment C ("Environment capabilities outside the base, effect-labelled"). A: units.md row 15 lists `print` in `base-primitives`, contradicting this. C: the capabilities still live in `src/primitives.ts` (C135).
- Chapter: Hosts: the terminal and the browser

#### A stated host boundary in a host unit
- Decides: open: whether Allegretto states which primitives reach the host and with what effect labels, as an Environment interface in a `host` unit between `futures` and `base-primitives` that the CLI and the web bundle supply, in place of today's swapping by output capture and extension substitution.
- Status: open
- Type: capability — the stated boundary is the capability; the unit is its placement
- Rationale kind: technical
- Depends on: Environment capabilities outside the base, effect-labelled
- Significance: 3 — "env-provided capabilities" is a heading until this exists
- Label: foundational — the primitives would import it and every host would supply it
- Units: not yet a unit
- Options recorded: interception (today); an interface with a unit (M10)
- Sources: docs/book/concepts.md §1 candidate R17; B-141 (the Environment interface); docs/book/platform/host.ir.md C18 to C24, R9, R11, R12; docs/book/units.md §6.1 M10, §4.1 (cited there); B-141
- Book home (fragments' proposal): concepts.md Part 0 candidates / platform/host / Host environments
- Notes: Merged from fragment A ("The host boundary as a stated surface"), fragment C ("A host-environment interface and unit"). C: B-141 waits for B-136. The future manager is planted on the scope's host plane and found by a parent-chain walk (C26, C27).
- Chapter: Hosts: the terminal and the browser

#### Asynchronous host results arrive as future cells
- Decides: `delay` and `fetch` return future cells filled when their JavaScript Promise settles, through `applyPhase`; a rejection or a non-2xx response fills the cell with an error value, never a throw, and both throw "requires async runtime" without a future manager.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Incompleteness lives in write-once future cells; A failure a program can handle is supplied by an extension
- Significance: 3 — the I/O edge of the futures model
- Label: swappable — the capability implementations
- Units: futures, base-primitives
- Options recorded: none recorded
- Sources: docs/book/platform/host.ir.md C26 to C41; D33
- Book home (fragments' proposal): Host environments
- Notes: `fetch` sends a bodiless GET only (C34).
- Chapter: Hosts: the terminal and the browser

#### Browser sandbox as an IIFE bundle with a library registry
- Decides: the browser host is one esbuild IIFE bundle setting `window.Allegro` (`eval`, `evalAsync`, `reset`, `formatValue`, `registerLibrary`, `inspect`), keeping the scope between calls, streaming `print` through the future manager's output callback, and resolving `use NAME` only against libraries the page registered.
- Status: settled
- Type: capability — the page-facing API and the library registry; the bundle format is its form
- Rationale kind: technical
- Depends on: Allegro Standard by default, Allegretto by flag
- Significance: 3 — the public sandbox and the maintainer's primary sandbox
- Label: swappable — `web/allegro-web.ts`, outside the unit DAG
- Units: none (no file of `web/` is mapped)
- Options recorded: none recorded
- Sources: docs/book/platform/host.ir.md C62 to C93; docs/book/process.md §9 (cited at C12, C13)
- Book home (fragments' proposal): Host environments
- Notes: `import` silently does nothing in the sandbox (`import math` returns `<symbol:math>`, C80, C81); `scanUses` is duplicated (C79); the pages' copy of `lib/units.alg` is stale (C86); the live site is 372 commits behind (C101).
- Chapter: Hosts: the terminal and the browser

#### A browser-compatible core
- Decides: the core uses only APIs available in both Node and browsers (`TextEncoder`/`TextDecoder`, never `Buffer`), and Node globals are read only behind a `typeof process` test.
- Status: partly built
- Type: implementation — a coding rule that keeps the browser sandbox possible
- Rationale kind: technical
- Depends on: Browser sandbox as an IIFE bundle with a library registry
- Significance: 3 — keeps the sandbox possible
- Label: foundational — the web bundle depends on every core file obeying it
- Units: none (a rule across L0 to L2 files)
- Options recorded: none recorded
- Sources: CLAUDE.md (Conventions & invariants, cited at host C102); docs/book/platform/host.ir.md C102 to C122; B-070 title
- Book home (fragments' proposal): Host environments
- Notes: no book chapter states the rule (C104); `src/evaluator.ts:23` reads `process.env` unguarded, so a bundle built from the branch fails in a browser (C110 to C117); nothing in CI builds or loads the bundle, and the typecheck uses Node types with no DOM library (C118 to C122).
- Chapter: Hosts: the terminal and the browser

#### Liveness of host sources declared per source
- Decides: each asynchronous source declares its liveness: `delay` is live because a timer always fires, and `fetch` is admitted under the assumption that the endpoint eventually responds, visible in the verdict.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Asynchronous host results arrive as future cells; Four-tier discharge spectrum; Completion is totality and liveness
- Significance: 2 — how the ledger records I/O assumptions
- Label: swappable — per-capability declarations
- Units: base-primitives, pcp
- Options recorded: none recorded
- Sources: docs/book/platform/host.ir.md C35, C36; D16, D34; docs/book/platform/tooling.ir.md C103
- Book home (fragments' proposal): Host environments
- Notes: Assembly: gained a dependency on "Completion is totality and liveness", which states the same liveness axioms in general.
- Chapter: Hosts: the terminal and the browser

#### Module loader takes its file reader from the host
- Decides: `ModuleLoader` reads no file itself; its caller supplies `readFile`, so the Node CLI passes `fs.readFileSync` and resolves `lib/` from `import.meta.url`.
- Status: settled
- Type: implementation
- Rationale kind: technical
- Depends on: A browser-compatible core
- Significance: 2 — keeps module loading host-neutral
- Label: swappable — an injected function
- Units: module-loading, cli
- Options recorded: none recorded
- Sources: docs/book/platform/host.ir.md C46 to C52
- Book home (fragments' proposal): Host environments
- Notes: the web bundle still holds no module loader (C80).
- Chapter: Hosts: the terminal and the browser

#### Asynchronous I/O capabilities beyond timers and HTTP GET
- Decides: files, processes, sockets and further timers are to be environment-provided, effect-labelled capabilities; none is built.
- Status: open
- Type: capability
- Rationale kind: technical
- Depends on: Environment capabilities outside the base, effect-labelled; A stated host boundary in a host unit
- Significance: 2 — breadth of the host
- Label: swappable — new capabilities behind labels
- Units: not yet a unit
- Options recorded: none recorded
- Sources: docs/book/layers.md §2; docs/book/platform/host.ir.md C123 to C125; B-071
- Book home (fragments' proposal): Host environments
- Chapter: Hosts: the terminal and the browser

#### Browser runtime packaging
- Decides: whether and how the runtime ships as a browser package (ES module build, npm package, versioned release) beyond the one IIFE bundle for the project's pages.
- Status: open
- Type: capability — it decides what a tool builder can install
- Rationale kind: technical
- Depends on: Browser sandbox as an IIFE bundle with a library registry
- Significance: 2 — distribution
- Label: swappable — a build output
- Units: not yet a unit
- Options recorded: none recorded
- Sources: docs/book/platform/host.ir.md C126 to C129; B-070
- Book home (fragments' proposal): Host environments
- Chapter: Hosts: the terminal and the browser

### Compiling beyond the interpreter

#### Multi-phase build as successive partial evaluation
- Decides: the build is to be a chain of phases (invocation, config, compile, emit, package, deploy, execute), each a partial-evaluation step binding more resources, with phase gates that scan the expression graph for unresolved elements before a phase may close.
- Status: open
- Type: capability
- Rationale kind: vision
- Depends on: One operation: partial evaluation; Incompleteness lives in write-once future cells
- Significance: 3 — the T-build milestone M6 and the "config is a compile-time theorem" claim
- Label: foundational — would define how every later binding stage is reached
- Units: not yet a unit (only `applyPhase` exists, driven by futures alone)
- Options recorded: none recorded
- Sources: docs/book/layers.md §2, §3 (M6); docs/book/platform/README.md (T-build fragments); docs/book/platform/build-pipeline.ir.md C122 to C126; docs/plans/release-track.md §3 D5; docs/book/vision.md §1
- Book home (fragments' proposal): Capability tracks (`docs/book/platform/README.md`), later its own chapter
- Notes: the README's track table still lists `build-pipeline.md` as planned while the IR chapter exists for the delivered part. Significance calibrated from 4.
- Chapter: Compiling beyond the interpreter

#### Code generation from the expression graph, JavaScript first
- Decides: target code generation is to compile the L0 expression graph, JavaScript first, then WASM or native, with provability-informed optimisation; the continuations decision it requires feeds algebraic effects.
- Status: open
- Type: capability — it decides what a program compiles to
- Rationale kind: technical
- Depends on: One operation: partial evaluation; Multi-phase build as successive partial evaluation
- Significance: 3 — milestone M8; a prerequisite of self-hosting
- Label: foundational — T-bootstrap depends on it
- Units: not yet a unit
- Options recorded: the v1 Phase I outline (revalidation-gated)
- Sources: docs/book/layers.md §2, §3 (M8); docs/book/platform/README.md; B-072
- Book home (fragments' proposal): Capability tracks (`docs/book/platform/README.md`), later a codegen chapter
- Chapter: Compiling beyond the interpreter

#### Laws licence rewrites
- Decides: discharged laws are to license optimiser rewrites, making the optimiser user-extensible and unable to be wrong, with tree shaking by partial evaluation.
- Status: open
- Type: capability
- Rationale kind: vision
- Depends on: Lawful interfaces; Code generation from the expression graph, JavaScript first
- Significance: 2 — a payoff of laws
- Label: swappable — a consumer of laws
- Units: not yet a unit
- Options recorded: none recorded
- Sources: docs/plans/release-track.md §3 D5; B-063
- Book home (fragments' proposal): Capability tracks
- Notes: laws exist; no rewrite consumer (D5 table).
- Chapter: Compiling beyond the interpreter

#### Self-hosting and a package ecosystem
- Decides: L1 and L2 machinery are to be re-expressed in Allegro (milestone M9, with a Vivace parser generator able to re-host the L1 parser) and a package ecosystem with versioning and a registry built (M10); both are aspirational.
- Status: open
- Type: capability — the package ecosystem is user-facing; self-hosting is its implementation half
- Rationale kind: vision
- Depends on: Code generation from the expression graph, JavaScript first; Everything above the kernel is an extension, and there is one way to extend
- Significance: 2 — long-range direction
- Label: foundational — re-hosting the parser would cascade through L1
- Units: not yet a unit
- Options recorded: none recorded
- Sources: docs/book/layers.md §2, §3 (M9, M10); docs/book/vivace/README.md (Provides; maintainer ruling 2026-07)
- Book home (fragments' proposal): Capability tracks
- Chapter: Compiling beyond the interpreter

## The type check, 2026-11-05

Chunk P1b typed every entry under the ruling that no capability decision depends on an implementation decision. A capability decision decides what the language or platform can express or guarantee to its user; an implementation decision decides how the code realises it, and another implementation could change it without changing any capability. Where an entry holds both, it is typed by what it decides first, and its Type line names the realising part. `docs/book/concepts.md` already files its entries as requirements, specification choices or implementation choices; requirements and specification choices are typed capability and implementation choices implementation, except where noted.

Result: 256 decisions, 202 capability and 54 implementation. The check found 21 dependencies of a capability decision on an implementation decision, in 20 entries. Resolutions: (a) the dependency was misread, 19; (b) the dependent entry is implementation, 2 (one entry); (c) the dependency is capability, 0; (d) a split, 0.

| # | Entry | Depended on | Resolution | Why |
|---|---|---|---|---|
| 1 | Arrays are structures with unkeyed entries | The composite is one sequence of optionally-keyed entries | (a) Now depends on "One composite kind: Structure". The composite's representation now depends on this entry and follows it. | An array is a structure with unkeyed entries however the entries are stored; concepts.md files the sequence and its index as an implementation choice. |
| 2 | Symbols serialise by FQN; deserialisation never mints reachability | Symbols interned by FQN | (a) Now depends on "Symbol identity is a fully-qualified name". | The wire form is the name, interned or not; interning realises identity by name. |
| 3 | One residualising resolution semantics for scopes | Scopes layer by parent chain | (a) Now depends on "Scope is the evaluation environment, not data". | Resolution rests on the parent-chain protocol that entry states; the constant-time chain is how it is built. |
| 4 | Offside rule through stateful indent terminals | Memoized recursive-descent engine with seed-growing left recursion | (a) Removed. The engine now depends on this entry and follows it. | Grammar authors name the indent terminals; the engine implements them, so the edge pointed the wrong way. |
| 5 | Parse failure reporting and recovery | Memoized recursive-descent engine with seed-growing left recursion | (a) Now depends on "Grammars are Allegro values". The engine now depends on this entry and follows it. | Error productions and sync points are features of a grammar; the engine's farthest-advance report realises them. |
| 6 | Extensions are the module substrate | Scopes layer by parent chain | (a) Now depends on "Scope is the evaluation environment, not data". | Extensions layer by the scope's protocol, not by its cost. |
| 7 | Members are keyed by symbol and conformance is membership | Symbols interned by FQN | (a) Now depends on "Symbol identity is a fully-qualified name". | Conformance needs symbol identity; interning is its pointer-compare realisation. |
| 8 | Export marks the binding, and a module with no exports is open | Module loading and typed module objects are separate layers | (a) Now depends on "Extensions are the module substrate". | Export rests on modules existing; which unit loads them is a cut in the code. |
| 9 | Knowledge has intrinsic and occurrence carriers | Scopes layer by parent chain | (a) Now depends on "Scope is the evaluation environment, not data". | Occurrence facts live in the scope's facts plane, which that entry states. |
| 10 | Contracts in the verdict and the ledger | The verdict as accumulated metadata | (a) Now depends on "Every result says how strongly it holds". | Contracts must reach the verdict and the ledger however the verdict is computed. |
| 11 | Planning surface conventions | Library before surface | (a) Now depends on "A plan is an outcome graph with derived wiring". | The conventions spell the model; the order in which the library and the grammar were built changes no spelling. |
| 12 | Post-passes registered by layers | The evalSource stage order | (b) Retyped implementation. | It decides where the code registers its post-passes; no program's meaning changes. |
| 13 | Post-passes registered by layers | Plane interfaces are sanctioned and policed | (b) The same retyping. | As above. |
| 14 | Inspect reports only what the pipeline computed | The evalSource stage order | (a) Removed; "Types are values that constrain values" remains. | Inspect promises to add no analysis of its own; which stage computes each fact is the pipeline's arrangement. |
| 15 | One command-line entry with subcommands | One evalSource pipeline for programs and libraries | (a) Removed; the entry now depends on nothing. | The command-line surface holds whatever runs behind it; what every run checks is "Claims are evaluated like everything else". |
| 16 | File runner as one evaluation with futures drained | Callers pre-scan and strip the `use` header | (a) Now depends on "`use` header for language extension, `import` for module values". | The runner honours the header; the pre-scan is how a caller does it. |
| 17 | REPL as successive evaluations over a persistent scope | One evalSource pipeline for programs and libraries | (a) Now depends on "Scope is the evaluation environment, not data". | An entry sees the earlier entries by scope layering; the shared pipeline is how it runs. |
| 18 | Execution tracing and step-through debugging | The evalSource stage order | (a) Now depends on "Expressions are values, forming a DAG". | Tracing and graph inspection show evaluation and the expression graph, not the stage list. |
| 19 | A stated host boundary in a host unit | Scope leaves the value universe | (a) Removed. | The edge recorded where the future manager is planted, on the scope's host plane, which is an implementation detail; the boundary rests on the environment capabilities. |
| 20 | Browser sandbox as an IIFE bundle with a library registry | A browser-compatible core | (a) Removed. The core rule now depends on the sandbox and follows it. | The rule exists to keep the sandbox possible (its own significance line), so it realises the sandbox. |
| 21 | Browser runtime packaging | A browser-compatible core | (a) Now depends on "Browser sandbox as an IIFE bundle with a library registry". | Packaging extends the sandbox's one bundle; the API rule is its implementation. |

Three typings go against a source or need the maintainer's eye:

- "Metadata is a field on every value" is typed capability. concepts.md files it as an implementation choice that realises "Metadata channels are independent", while that requirement's own text calls where channels are stored a specification choice. The sources conflict. Typed capability because metadata rides each occurrence of a value, not each datum, and a program observes that. It is a tour decision; if the maintainer rules it implementation, its seven capability dependents rest on "Metadata channels are independent" instead.
- "Scope leaves the value universe" is typed implementation, although it supersedes a specification choice. Its own options line says no scope reaches user code as a value, so leaving `Value` changes the representation only.
- "One operation: partial evaluation" is typed capability. The language exposes it: residuals are values, and every check is an evaluation a user can read.

**Mutual capability dependencies.** One pair was merged:

| Merged entry | From | Why |
|---|---|---|
| Incompleteness lives in write-once future cells | "Incompleteness is a value in a slot"; "Future cells: write-once, monotonic, flattening" | The first states incompleteness as an unresolved future; the second states the future as the sole locus of incompleteness. Each is stated in the other's terms, so neither holds alone. Sources, options and notes are the union. |

Not merged, because they relate without needing each other: "Mediated member access" and the access tiers and evidence it stages; "`use` header for language extension, `import` for module values" and "Activation by a `use` header, per file and not transitive"; "Metadata channels are independent" and "Metadata is a field on every value".

**The three cycles the merge broke, re-examined.**

1. "`use` header for language extension, `import` for module values" and "Callers pre-scan and strip the `use` header": a capability and its implementation. The pre-scan is implementation and keeps its edge to the header. No capability depends on the pre-scan any more (row 16).
2. "Claims are evaluated like everything else" against "Body-form clauses at the head of a body, lowered through one chain" and "Theorems as statements, proved `by` a term": all three are capability, and they are not mutual. The principle is stated without any particular form; each form is one instance of it. The edges from the instances to the principle stand, and nothing is merged.
3. "Precompile before the evaluation loop" and "The evalSource stage order": both implementation. The stage order places precompile, so it keeps the edge. Precompile realises checking a function's body before it runs; no capability depends on either.

**Moves.** All within a chapter; no decision changed chapter.

- "The composite is one sequence of optionally-keyed entries" moves after "Arrays are structures with unkeyed entries" (Structures).
- "Memoized recursive-descent engine with seed-growing left recursion" and "The precedence ladder runs as repetition, and memo invalidation tracks dependencies" move after "Parse failure reporting and recovery" (Grammars as values).
- "A browser-compatible core" moves after "Browser sandbox as an IIFE bundle with a library registry" (Hosts: the terminal and the browser).

**Contents changed.** "Why a new language" lists "Order of definition carries no meaning", which the rulings added but the list missed (9 decisions). "Evaluation over unresolved information" has 11 decisions after the merge. "Structures", "Grammars as values" and "Hosts: the terminal and the browser" list their decisions in the new order.

### The maintainer's rulings on the type check, 2026-11-06 (PR #164)

The ten hard calls stand, except three put to review; the merge of the incompleteness and future-cell decisions stands. The review session's findings on the three, for the pass to settle when it reaches their chapters:

1. **"Scope leaves the value universe".** The maintainer's test: capability if read-site forgery requires it, else reversed. Finding: forgery does not require it. The protection against read-site forgery is a separate decision already in this inventory, "Evidence is possession": a mediator receives an opaque, kernel-minted evidence capsule that answers only whether a name is held, never the raw scope (decisions.md V-R2 (the mediation context is an opaque evidence capsule), executed). It ships today with scope still a value. The argument behind D49 (scope leaves `Value`) in `docs/plans/entry-sequence-composite.md` §5.6 is representational: five code sites that exist to undo scope's valuehood, metadata meaningless on a value with no position, the one mutable value, scope-only state on every structure, and code generation; it rests on the fact that no scope ever reaches user code as a value. Forgery appears only in closing custom scope kinds. D49 is ruled but not executed (`src/scope.ts:36` still implements scope as a structure). So by the maintainer's test the decision is an implementation decision, and the open question is whether to keep it (its five costs) or reverse it (nothing to undo, since it is unbuilt). Recommendation for the Scopes chapter: keep it as implementation, ruled on its costs, with "Evidence is possession" as the capability it serves.
2. **"Effects describe computations, refinements describe data".** Finding: the entry joins a decision and a storage note. The decision: effect constraints and refinement predicates are separate kinds of claim in separate lattices, an effect bound on a parameter is not a refinement of the parameter's value. It has an alternative (one lattice of facts, effects as predicates over computations), so it is a decision, not an observation, and it is capability. The storage note (effects in their own metadata field; parameter bounds in `Param.effectBound`, moved out of `Param.predicates`) is implementation and belongs under the effects field's own entry. Recommendation for the Effects chapter: restate as the capability "Effects and refinements are separate lattices", and fold the storage into the implementation entry.
3. **"One primer for human and machine provers".** The primer is `docs/book/proving-in-allegro.md`, the proving guide: the language model worker of the prove loop reads that file and sends it to the model as its instructions (`pcp/llm-worker.ts:394`–`403`). The decision is that a human prover and a machine prover are given the same document, which makes the protocol's neutrality literal. Note for R25 (chapters leaving the book): the guide moves to an appendix, but the worker reads it by path, so its path stays or the worker's path changes with it (stop condition 4 of the plan).

## Open questions

### Proposals deferred by DR1 to their parts

- **For DR2, with the expressions chapter**: "A program built by a program is checked like any other" (reflection checked end to end; the review's R-DR1-32). `expr_eval` calls the evaluator directly (`src/primitives.ts:405`–`409`); whether a constructed program skips checks was not confirmed either way by one probe.
- **For DR5, with Vivace**: "Business rules define the domain" (when a rule has no expressible form, extend the language, never contort the rule; docs/book/vision.md §5 principle 4; the review's R-DR1-36).

### Unresolved dependencies

None remain. The fragments marked or misnamed 43 dependency references (25 distinct names); each resolved to an entry of the merged inventory (the working merge notes list every resolution). One guessed name has no entry of its own: "Layers L0 to L3 with dependencies pointing down" resolves to "Everything above the kernel is an extension, and there is one way to extend", which states the downward rule. If the layer spine deserves its own decision section, it would be a new entry in "Why a new language".

### Cycles found and how they were broken

Three cycles appeared in the merged graph. Each was a misread direction, not two decisions in one:

1. "`use` header for language extension, `import` for module values" and "Callers pre-scan and strip the `use` header" depended on each other. The pre-scan implements the header, so only the pre-scan keeps the edge.
2. "Claims are evaluated like everything else" depended on the body-form clauses and on theorems as statements, both of which depend on it. The principle keeps no edge to its implementations.
3. "Precompile before the evaluation loop" and "The evalSource stage order" depended on each other. The stage order places precompile, so only the stage order keeps the edge.

Other edges were changed without a cycle forcing it, so that the order reads right. Thesis-level decisions dropped their edges to their own implementations: the discharge-strength claim, the prover protocol, the halt policy and proof export. "From experiment to proof without rewriting" no longer depends on the safety grade; the edge was inverted. Law discharge tiers rest on the shared tier vocabulary, not on the divergence spectrum. "Effects deferred during precompile" gained an edge to precompile. Each entry's Notes say which. Chunk P1b re-examined the three cycles by decision type: see "The type check, 2026-11-05".

### Conflicting sources the fragments recorded

1. **GLL or ordered choice.** `docs/book/grammar-formalism.md` §1 says GLL is chosen and §5.1 speaks of GLL memoization; `docs/book/extension/grammar.md` §1 and §4 describe a memoized parser with PEG-committed ordered choice. The shipped base grammar relies on alternative order, and ambiguity detection is opt-in for that reason. Entries: "Memoized recursive-descent engine with seed-growing left recursion", "Ambiguity is banned and detected, not resolved by alternative order", "Rules for user-written EBNF". The grammars chapter cannot be written until one source is ruled stale.
2. **Whether `when` arms narrow knowledge.** `docs/book/standard/pattern-matching.md` §3 says they do not; `docs/book/standard/contracts.md` §4 says the arms lift the matched pattern tagged `match-case`, and §9 says that shipped. A spot check finds the `match-case` provenance tag declared in `src/refinements.ts:457` and no other occurrence of the string in `src/` (a text search, not a binder-aware survey), which suggests the tag has no producer and pattern-matching.md is the current one. Entries: "Unification and branch refinement in patterns", "Branch refinement narrows knowledge per region".
3. **Effects as values or a set of strings.** `docs/book/standard/effects.md` says an effect is a value of kind `Effect` composed by conjunction, with no separate effect-set type; the code holds an effect set as `Set<string>` merged by union (`src/effects.ts:41`), and non-trivial unions coerce to `opaque`. Entry: "Effects are values in one lattice" (status partly built).
4. **The evaluator chapter's prose against its IR.** `docs/book/allegretto/evaluator.md` §2 says the switch names all seven kinds with no default arm; the IR and the code (`src/evaluator.ts:546`) have a default arm. §3 says `eval_when`, `&&` and `||` do not meet PE Rule 2 and that `eval_when` evaluates no branch; the IR and the code (`speculate` at `src/evaluator.ts:331`, `speculateWhenArms` at `src/primitives.ts:865`) say they do. Entries: "PE Rule 2: speculate every branch, run no effect", "The discriminator rule for kind comparisons".
5. **`prove_induction` and the sampled tier: verified.** `prove_induction_impl` (`src/primitives.ts:4330` to `4377`) checks `predicate(0)` and then `_INDUCTION_SAMPLE_K` (4, line 4302) inductive steps, and on success returns `_makeProof(...)` with the proposition text "forall n: NonNeg, p(n) [verified base + 4 inductive steps]". `makeProof` (`src/types-std.ts:4681`) writes `discharged` = 1 and no tier. The verdict's `TheoremResult` (`src/pcp.ts:199` onward) has status `discharged`, `failed` or `skipped` and carries a tier only as `lawBacking` for equality chains; the sampled tier exists only for law obligations (`src/pcp.ts:151` to `157`). So a theorem proved by bounded induction reaches the verdict as discharged with no sampled tier and stays out of the assumption ledger; its weaker strength shows only in the proposition text. This contradicts "Every result says how strongly it holds". Entries: "Bounded sampling for universal claims", "Discharge mechanisms without search". Whether to fix the code or the claim is a decision for the proofs chapter.
6. **The tier vocabulary.** `docs/book/vision.md` §1a names proven, enumerated, sampled, admitted, pending; `docs/book/getting-started.md` adds witnessed; the primer uses kernel, enumerated, witnessed, sampled, admitted, pending (matching `src/pcp.ts:155`); the divergence tiers are auto, witnessed, admitted, undischarged (`src/totality.ts:500`). A verdict counts as verified with pending law obligations. Entry: "Every result says how strongly it holds".
7. **Who runs the `use` pre-scan.** Fragment B's source says libraries and programs share the pre-scan; the pipeline IR says `evalSource` runs none and each caller scans and strips the header. The code agrees with the IR: `evalSource` (`src/runtime.ts:1169`) does not call `scanUses`, which `src/index.ts` and `src/modules.ts` call separately. Both statements hold if "share" means "use the same scanner"; the callers still disagree in behaviour (`inspect`, `verify`, the REPL, `prove` and the sandbox). Entries: "One evalSource pipeline for programs and libraries", "Callers pre-scan and strip the `use` header", "`use` header for language extension, `import` for module values".
8. **Precompile errors that do not halt.** Precompile records `precompile-eval`, `precompile-type-error` and `return-type-mismatch` as errors without halting, so `inspect` can grade `has-errors` without a halt. Entry: "Claims are evaluated like everything else".
9. **Where `print` and `eval_when` live.** `docs/book/units.md` row 15 lists `print` and `eval_when` in `base-primitives`; `docs/book/allegretto/structures.md` Appendix B and the environment-capability decision place `print` outside the base, and whether `eval_when` is base or a pattern-matching library is recorded only as a judgment call. Entries: "Environment capabilities outside the base, effect-labelled", "Minimal base surface of about forty primitives".
10. **Stale statements inside one chapter.** `docs/book/standard/type-system.md` §3 still lists `extends` after inheritance was dissolved, and §4 calls the retirement of prefixed slots unimplemented while recording completed chunks; `docs/book/standard/core-types.md` says ten core types and lists eleven; `docs/book/implementation-map.md` puts `src/introspect.ts` in L2 while `scripts/analyze/units.json` puts it on the track layer; `docs/book/concepts.md` R6's delta (27 imports) disagrees with its §23 (7 imports); several register entries name retired files or the retired carrier (detail in the Notes of the entries concerned).

### Placement questions this proposal raises

1. **The vision chapter is Tier 0.** The proposal redistributes `docs/book/vision.md` into the tour and Part I. Moving or splitting a Tier-0 document needs the maintainer's sign-off; the alternative keeps vision.md whole as Part I and writes the decision sections as pointers into it.
2. **Guides outside the narrative.** Getting started, the language reference and the proving primer hold decisions but are written as guides. The proposal moves their decisions into chapters and keeps the guides as appendices.
3. **Vivace's sequencing entries.** "Three different pilots, planning first", "Shape 1 before Shape 2" and "Library before surface" are decisions about how the hypothesis is tested; they were kept, but they sit near the process line.
4. **One entry dropped as process.** "A scene counts only when the suite runs it" (fragment C) is a test convention, the same family as the claims discipline already excluded.

### Gaps, merged from the fragments

**Decisions with no recorded rationale.**
- The 64-bit integer width, IEEE float packing and UTF-8 strings inside Bits (only `src/types.ts`, the units table and `docs/book/standard/core-types.md` state them); Bool as a typed Int 0/1.
- The index threshold of eight entries in structures, beyond a measurement in `docs/records/concepts-analyses.md` §5.2.
- The evaluation depth constant (10,000) and the precompile sentinel bound (10,000 rounds).
- The K=4 sample count for `proven` and `prove_induction`.
- Module resolution order (local `lib/` before the system `lib/`); the alternatives to the `left`/`right`/`none` reservation; tab handling in indentation (only proposed in `docs/book/grammar-formalism.md` §5.4).
- Expression memo keying by evaluation context: how the key is formed and when entries are invalidated.
- The surface spellings: the `=>` declaration form, `if then else`, `{expr}` interpolation, the `X of x` form, `: Type` annotations, the `_` placeholder and the `theorem`/`verify` spellings. Only `when/is/then` and the dual brace and offside goal record options; the surface chapter must state the rest as aesthetic choices.
- Operator precedence and associativity of the base surface ("standard precedence, left-associative"), while alternative order is still semantically significant.
- The REPL's continuation heuristic (recorded only as code behaviour).

**Decisions without an owner or an enforcement.**
- Whether `eval_when` and the `when_*` primitives are base or a pattern-matching library.
- Whether a field may restrict its reads (`readVisibility`).
- Removing `positional` from the propagation vocabulary.
- The `kinds` traversal protocol (`children`/`rebuild`) has no decision record beyond the unit-split decision.
- "Redefining primitives or core types is banned" is designed; no source says where it is enforced.
- The error surface (try/catch or a channel-consuming equivalent), sync and async modifiers, and algebraic effects are held only as backlog titles.
- Planning convention 12's richer `iterate:` retry form: no source says built or dropped. Shape 2 (executing a model) has no backlog item.

**Sources not read, or read only through a summary.**
- `docs/records/concepts-analyses.md`; `docs/plans/entry-sequence-composite.md` §5.5, §5.6 and beyond §6a; `docs/book/process.md` §6; `docs/plans/completion-effects.md` §3 detail; `docs/plans/pe-rules.md` (fragment B); `docs/plans/recursive-precompile.md` §7 and `docs/book/concepts.md` §29 (read through the pipeline IR); `docs/messaging.md`.
- `docs/book/grammar-formalism.md` §9 and §10 (skimmed); `docs/book/allegretto/structures.md` §6, §7, §9 and §13 (cited from the register).
- The archived plans behind proofs and the prover protocol (`phase-h-plan.md`, the Lean export of `phase-f-plan.md`, `Type : Type` stratification), and those behind effects and contracts (`harmonic-grounding-tarski.md`, `polyphonic-tracing-plotkin.md`, `lucid-discharging-lambek.md`, `crystal-proving-curry.md`); `docs/plans/archive/project-1-planning-dsl-design.md`. The planned `proofs.md` under `docs/book/standard/` and `pcp.md` do not exist, so the proof entries rest on the primer and their options are thin.
- The proofs and pcp units have no chapter in today's reading order; the proposed "Proofs as values" chapter is the first.

**Brief mismatches.** The fragment briefs named "§6 rulings" for several plans whose rulings sit elsewhere (§3 of equality-and-laws, completion-effects and visibility; §5 of units-dsl; §7 of release-track; §2 and §3 of planning-pilot). The fragments read the ruling sections.

## Identifier key

Each identifier this file cites, with its name. Registers: [decisions.md](../decisions.md), [backlog.md](../backlog.md), [concepts.md](../book/concepts.md), [layers.md](../book/layers.md).

| Id | Name |
|---|---|
| B1 | open question B1 of docs/plans/archive/structured-values-unification.md (in the grammar notes, an engine gap of extension/grammar.md) |
| B2 | open question B2 of docs/plans/archive/structured-values-unification.md (in the grammar notes, an engine gap of extension/grammar.md) |
| B5 | open question B5 of docs/plans/archive/structured-values-unification.md (in the grammar notes, an engine gap of extension/grammar.md) |
| B8 | open question B8 of docs/plans/archive/structured-values-unification.md (in the grammar notes, an engine gap of extension/grammar.md) |
| B-028 | backlog: Completion effects & futures |
| B-041 | backlog: Collections: Map/Set as typed generic structures |
| B-043 | backlog: User-defined type declaration syntax |
| B-057 | backlog: Phase C polish. Scope SETTLED at B-014 |
| B-063 | backlog: Tree shaking via partial evaluation |
| B-064 | backlog: Execution tracing + step-through debugging |
| B-065 | backlog: REPL improvements |
| B-067 | backlog: LSP / IDE integration |
| B-068 | backlog: Review UX |
| B-070 | backlog: Browser runtime packaging |
| B-071 | backlog: Async I/O capabilities: filesystem, networking, process |
| B-072 | backlog: Code generation: expression graph → JS first |
| B-080 | backlog: Vivace DSL candidates |
| B-081 | backlog: Counterexample legibility |
| B-082 | backlog: Model composition patterns |
| B-083 | backlog: AI iteration loop |
| B-087 | backlog: Totality-analyzer performance: the Stage 2/3 termination |
| B-089 | backlog: Lawful-interface follow-ons |
| B-092 | backlog: [stage: merged] Rung 2 flagship provable DSL |
| B-094 | backlog: Source channel |
| B-097 | backlog: S3 visibility arc |
| B-098 | backlog: Predicate/domain propagation onto residuals — |
| B-099 | backlog: Project severity configuration |
| B-100 | backlog: [reval] T-R6 soundness review + the checking |
| B-101 | backlog: Predicate-carrier residue cleanup |
| B-104 | backlog: Retire the __* |
| B-107 | backlog: Naming and declaration debt found by the concept |
| B-109 | backlog: R6 and R12 are violated in the channel substrate |
| B-110 | backlog: The L0 evaluator implements the L2 type system |
| B-111 | backlog: Field vs channel |
| B-112 | backlog: The four owed plane interfaces. Raised by the |
| B-113 | backlog: TailCall forwarding is convention-only |
| B-114 | backlog: Completion confluence is not guaranteed by |
| B-115 | backlog: Law backings ride two carriers. Raised by the |
| B-116 | backlog: Interface's two guarantees are enforced |
| B-117 | backlog: The verdict is assembled out-of-band rather than |
| B-118 | backlog: Four carriers ride the host plane that belong on the |
| B-120 | backlog: LANDED 2026-09 |
| B-121 | backlog: LANDED 2026-08 |
| B-125 | backlog: LANDED 2026-08. Delete mv_set, and rebuild the |
| B-128 | backlog: Layer separation is stated but not |
| B-133 | backlog: `positional` is a derived cache (landed 2026-09) |
| B-134 | backlog: the immutable bit is deleted (landed 2026-09) |
| B-135 | backlog: Nothing says what may live on an L0 type's host |
| B-136 | backlog: Scope leaves Value |
| B-137 | backlog: Eliminate weak typing in the L0 host |
| B-141 | backlog: There is no Environment interface; host swapping |
| B-143 | backlog: D22 is declared, not enforced |
| B-145 | backlog: L2 · Type vocabulary: a base primitive names a type |
| B-146 | backlog: L2 · Knowledge propagation: the evaluator does |
| B-151 | backlog: The planning pilot |
| B-157 | backlog: the performance stream (library load) |
| B-158 | backlog: (in-place write through a library alias) · L0 · A |
| B-159 | backlog: (precompile of recursive definitions) · T-perf · L2 · |
| B-161 | backlog: (CLI startup) · T-tooling · The CLI's TypeScript module |
| B-172 | backlog: the partial-evaluation rules as implemented |
| B-180 | backlog: (recursion handling under partial evaluation) · L0 · |
| CE-R1 | register: div rides the effect calculus verbatim: the termination analysis writes it into inferred … |
| CE-R2 | register: Discharge tiers recorded PER BINDING and ledger-visible (D34's four): auto / witnessed … |
| CE-R3 | register: Surface forms assume terminates (admitted axiom) and total (per-function strict opt-in) … |
| CE-R4 | register: Incompleteness detection gets ONE new label, sched (lazy is_resolved, the observe … |
| CE-R5 | register: Future[T] is minted through buildGenericType (memoized, flattening); async primitives … |
| CE-R6 | register: Modules evaluate with the session's FutureManager; base mode without one keeps the … |
| CE-R7 | register: The mechanical purity gates see div (conscious delta): an eq/coercion — and, per D32, a … |
| CE-R8 | register: D32 lands in two moves: the construction tri-state soundness fix first (an unresolved … |
| CT-R1 | register: "Sink-based checking" splits in two, and only relocation remains open: … |
| CT-R2 | register: Contract failure HALTS while construction failure yields an error VALUE, and the split is … |
| CT-R3 | register: assume was never actually rejected; it is D34's ADMITTED tier: Law.assume (E-R4) and … |
| CT-R4 | register: Invariant inheritance is REFINEMENT LAYERING: the Type.invariant fluent API is deleted … |
| CT-R5 | register: Contracts are KNOWLEDGE: one D36 lattice, two carriers (intrinsic on the value, … |
| CT-R6 | register: Contracts' absence from the verdict and the assumption ledger is a GAP, not a design … |
| D1 | register: Unify MultiValue + the record role of Context into one primitive (Structure); split the … |
| D2 | register: Annotation channels are extensible: extensions register channels with declared … |
| D3 | register: The lazy/eager primaryOf stripping asymmetry is replaced by per-channel propagation … |
| D4 | register: The type system (typing, visibility, variance, equality policy) stays outside Allegretto: … |
| D5 | register: Strict typing of all structures is a Standard-layer guarantee; Allegretto structures may … |
| D6 | register: __* prefixes are retired; meta-slots become declared slots with visibility/access … |
| D7 | register: Internal Type : Type self-reference is kept; universe stratification is handled by … |
| D8 | register: Equality is type-customizable with declared laws; proofs record which equality they … |
| D9 | register: Arrays: no refs-inside-Bits; base numeric-keyed structures + Standard encapsulated … |
| D10 | register: Functions keep returning annotated values: the return is a structure whose channels … |
| D11 | register: No operation errors on an incomplete value: operations on unresolved values produce … |
| D12 | register: Structures are always structurally complete: incompleteness is a value (an unresolved … |
| D13 | register: A seal op for structures — superseded by D21 + D22, because the op was only ever … |
| D14 | register: Slot keys are symbol / string / number; channel keys are always namespaced symbols: one … |
| D15 | register: The MultiValue wrapper is flattened for structures; scalar primaries ride a transparent … |
| D16 | register: Reading a potentially-unresolvable value is an effect, dischargeable by a … |
| D17 | register: A structure cannot have both data slots and a primary channel; transparent values have an … |
| D18 | register: Arrays are numeric-keyed structures, no separate vector primitive (ratifies D9's array … |
| D19 | register: The unified construct is named Structure |
| D20 | register: Symbols are unique values tied to their registering Scope (the scope IS the namespace); … |
| D21 | register: No separate seal primitive: the constructor brand decomposes into channel-write authority … |
| D22 | register: Structures are immutable by default: born-immutable, deep immutability via an O(1) … |
| D23 | register: Channel writes are capability-gated, reads free by default; origination needs the writer, … |
| D24 | register: Capability shape: a first-class delegable token realized as a PrimitiveFunction closure; … |
| D25 | register: Scope is the evaluation-environment ROLE of the shared substrate: same slot+channel … |
| D26 | register: Scope op surface: scope_new/extend/lookup/bindings/assume; retire ctx_use + … |
| D27 | register: Minimal base surface: Allegretto's irreducible base is ~40 primitives in five groups; … |
| D28 | register: Subsumption mechanics for the base audit: mv_*/component_get → channel ops, make_error → … |
| D29 | register: Symbol redefinition: defining-Scope identity → FQN, same FQN = same symbol (interned), … |
| D30 | register: Member-symbol conformance: types DRAW member symbols from declared contexts; conformance … |
| D31 | register: Completion = totality ∧ liveness: incompleteness has exactly two sources, each a … |
| D32 | register: Triggered construction guard: fires only when a structure carries a value-inspecting … |
| D33 | register: Futures model: a future is a write-once monotonic cell at the I/O edge, Future[Future[T]] … |
| D34 | register: Discharging completion effects: strict by default with a four-tier spectrum (auto-proven … |
| D35 | register: Resource complexity is not a core effect: static asymptotic bounds are a deferred … |
| D36 | register: Shape/knowledge split: the type channel splits into shape (identity, dispatch) and … |
| D37 | register: Equality framework: dispatches on shape, never knowledge; different shapes coerce both … |
| D38 | register: Lawful interfaces: interfaces may carry law members; drawing instantiates each law as a … |
| D39 | register: __* slot disposition (completes D6): every __* slot gets a declared home — members, … |
| D40 | register: Kinds are just Types: a kind is a type whose instances are type-values; instance-of = … |
| D41 | register: Mediated member protocol: member access is a four-stage pipeline as ONE … |
| D42 | register: Evidence is possession: authorization is what the requesting context HOLDS, never … |
| D43 | register: Modifiers are declared member attributes, extensible per kind: private/readonly/etc. are … |
| D44 | register: Declared inheritance dissolves into conformance + refinement + composition: the subtype … |
| D45 | register: One construction surface: define uniform at every meta-level; Interface = refinement of … |
| D46 | register: MultiValue retirement = D15 execution: option B ratified (transparent Structure as scalar … |
| D47 | register: The source channel, ASTs as channel payload: six sub-decisions — Expression+span payload, … |
| D48 | register: The Allegretto composite, ruled as one question (B-108): (a) IC-2 → option E — the … |
| D49 | register: Scope leaves Value: the evaluation environment becomes a non-value L0 host construct with … |
| D50 | register: The implementation is organized as units in a narrow DAG: each unit holds one decision … |
| D51 | register: Value is a contract, seven kind units, and one assembly: the contract declares the open … |
| E-R1 | register: Kernel structural equals is the default for every structure-backed type: same shape … |
| E-R2 | register: Coercion declarations are type-level members with obligations, registered on the PAIR; == … |
| E-R3 | register: law members ride the existing spec surface (law_ prefix in define/Interface specs); … |
| E-R4 | register: Law discharge maps onto D34's spectrum with existing machinery; assume is new and … |
| E-R5 | register: The purity/knowledge-independence gate is mechanical: an equals implementation (and any … |
| E-R6 | register: Proofs record equality identity + tier as plain instance-data bindings on the Proof … |
| IC-2 | concepts.md: The composite is one entry sequence, with an index below the specification |
| IC-3 | concepts.md: Metadata is a field on every value |
| IC-3a | concepts.md: Metadata is supplied at construction, not attached afterwards |
| IC-4 | concepts.md: Symbols are interned by FQN |
| IC-5 | concepts.md: Scopes layer by parent chain |
| IC-6 | concepts.md: Expressions memoize |
| M2 | milestone (layers.md §3): Extension substrate formalized |
| M3 | milestone (layers.md §3): Standard revalidated on v2 |
| M6 | milestone (layers.md §3): Build pipeline end-to-end |
| M7 | milestone (layers.md §3): Tracing & debugging usable |
| M8 | milestone (layers.md §3): Target code generation |
| M9 | milestone (layers.md §3): Self-hosted parser + type system |
| M10 | milestone (layers.md §3): Package ecosystem |
| M12 | item of that number in the document cited beside it (a closed interface item of docs/book/units.md §6.1) |
| P1 | chunk or principle P1 of the plan or chapter cited beside it (for example a chunk of B-157 or of this book pass) |
| P2 | chunk or principle P2 of the plan or chapter cited beside it (for example a chunk of B-157 or of this book pass) |
| P3 | chunk or principle P3 of the plan or chapter cited beside it (for example a chunk of B-157 or of this book pass) |
| P4 | chunk or principle P4 of the plan or chapter cited beside it (for example a chunk of B-157 or of this book pass) |
| P5 | chunk or principle P5 of the plan or chapter cited beside it (for example a chunk of B-157 or of this book pass) |
| P6 | chunk or principle P6 of the plan or chapter cited beside it (for example a chunk of B-157 or of this book pass) |
| P7 | chunk or principle P7 of the plan or chapter cited beside it (for example a chunk of B-157 or of this book pass) |
| R1 | concepts.md: Allegretto is the simplest base that can carry Allegro (where a Sources line names a plan, the plan's ruling of that number) |
| R2 | concepts.md: Partial evaluation is the mechanism by which layers are added (where a Sources line names a plan, the plan's ruling of that number) |
| R3 | concepts.md: Metadata channels are independent (where a Sources line names a plan, the plan's ruling of that number) |
| R4 | concepts.md: Evaluation is total over unresolved information (where a Sources line names a plan, the plan's ruling of that number) |
| R5 | ruling of that number in the document cited beside it (chunk rulings of decisions.md, a plan's §6, or a chapter IR) |
| R6 | concepts.md: Everything above the kernel is an extension, and there is one way to extend (where a Sources line names a plan, the plan's ruling of that number) |
| R7 | ruling of that number in the document cited beside it (chunk rulings of decisions.md, a plan's §6, or a chapter IR) |
| R8 | concepts.md: There is one value universe (where a Sources line names a plan, the plan's ruling of that number) |
| R9 | concepts.md: The language surface is extensible (where a Sources line names a plan, the plan's ruling of that number) |
| R10 | concepts.md: Evaluation is resumable on new information (where a Sources line names a plan, the plan's ruling of that number) |
| R11 | ruling of that number in the document cited beside it (chunk rulings of decisions.md, a plan's §6, or a chapter IR) |
| R12 | concepts.md: Authority is an unforgeable value (where a Sources line names a plan, the plan's ruling of that number) |
| R14 | concepts.md: Code is organised into separately-loadable units (where a Sources line names a plan, the plan's ruling of that number) |
| R15 | ruling of that number in the document cited beside it (chunk rulings of decisions.md, a plan's §6, or a chapter IR) |
| R16 | concepts.md: Same source and same inputs give the same residual (where a Sources line names a plan, the plan's ruling of that number) |
| R17 | concepts.md: The host boundary is a stated surface: which primitives reach the host, with what effect … (where a Sources line names a plan, the plan's ruling of that number) |
| R18 | concepts.md: The host may impose resource bounds, and a bound hit is distinguishable from unresolved … (where a Sources line names a plan, the plan's ruling of that number) |
| R19 | concepts.md: A scope is not data and data is not a scope (where a Sources line names a plan, the plan's ruling of that number) |
| R20 | concepts.md: The base may reject an ill-formed application (where a Sources line names a plan, the plan's ruling of that number) |
| R-R1 | register: Terminology: "substrate / surfaces", with general-purpose vs. domain as breadth (VISION … |
| R-R3 | register: Differentiator map: the six + capstone, as merged |
| R-R4 | register: Ladder order and the rung-2 domain choice: units-physics over state machines, for the … |
| S2d | a chunk of the concept-spine plan (docs/plans/concept-spine.md), cited by concepts.md |
| S4b | a chunk of the concept-spine plan (docs/plans/concept-spine.md), cited by concepts.md |
| SC-1 | concepts.md: Seven representation kinds |
| SC-2 | concepts.md: Bits is the only scalar |
| SC-3 | concepts.md: Expressions are values |
| SC-4 | concepts.md: Symbol identity is fully-qualified, not spelling |
| SC-5 | concepts.md: One composite kind rather than two |
| SC-6 | concepts.md: Scopes are values |
| SC-7 | concepts.md: Propagation is drawn from a fixed, inspectable vocabulary |
| SC-8 | concepts.md: Evaluation stops early for two reasons only |
| T-R1 | register: Severity reconciliation: D34's strict-by-default binds at discharge ACCOUNTING (always … |
| T-R2 | register: The flip is PER-PROJECT CONFIG, deferred: total-by-default, per-kind severity promotion, … |
| T-R3 | register: Exhaustiveness stays info until T-R2 lands; promoting non-exhaustive-over-finite-type (or … |
| T-R4 | register: All-edges-decrease is the ratified mutual-recursion criterion (every in-cycle call … |
| T-R5 | register: Totality polymorphism is SUBSUMED by the effect calculus: the planned [t: Totality] … |
| T-R6 | register: Inlining cutoff for the measured precompile pathology |
| U-R1 | register: Dimensions are structural DATA + named dimensions are REFINEMENTS over one Quantity … |
| U-R2 | register: Literal syntax scope: number-anchored 3 m/s^2 only; all computed values go through the … |
| U-R3 | register: Law honesty: accept sampled/admitted tiers for the quantity laws, displayed loudly in the … |
| U-R4 | register: in conversion sugar is deferred to a later slice (.to(m) reads fine; in interacts with … |
| U-R5 | register: Full 7-vector base dimension set from day one, with the shipped unit set … |
| V-R1 | register: One pipeline, kernel-internal mediation: type_dispatch's descriptor path IS the D41 … |
| V-R2 | register: The mediation context is an opaque, kernel-minted evidence CAPSULE answering only … |
| V-R3 | register: Two tiers this arc, private and public; internal and protected are RESERVED vocabulary … |
| V-R4 | register: Export-ness is a SCOPE-BINDING attribute (the exported value-plane channel and its y = x … |
| V-R5 | register: D43 attributes ride DESCRIPTORS via wrapper combinators (private(...), reserved … |
| V-R6 | register: Bespoke readers close per policy: destructuring a private field outside its scope is an … |
| V-R7 | register: Reflection resolves the D23/D42 tension: enumeration and visibility FLAGS stay free and … |
| V-R8 | register: Mediation effects are per-mediator: kernel default mediation is pure and PE-folds; an … |
