# The decision inventory: every decision of Allegro, in book order

> Working material of the book pass, chunk P1 ([book-pass.md](book-pass.md) §5, "The re-scoped front"). Built by merging three fragments, written read-only from the repository: the thesis and L0 (97 entries), L1 and L2 (95), and the surface language, Vivace, the tracks and the thesis test (92). Duplicates were merged, guessed dependency names resolved, cycles broken and significance calibrated to one scale; the notes on each merge are a separate working file of the pass. Each entry keeps the fragment's form and adds the chapter it belongs to.
>
> Counts, recounted when phase 1 (the decision review) closed on 2026-11-13: 232 decisions in 6 parts and 38 chapters after the preface and the tour. Part I: 23; Part II: 51; Part III: 23; Part IV: 63; Part V: 27; Part VI: 45. Part I also has a thesis statement and Parts V and VI an introduction, none of them decisions. Of Part V's, 15 are held, not ruled: the planning pilot's. By type: capability 213, implementation 18. By significance: 5: 38, 4: 69, 3: 78, 2: 40, 1: 6. By label: foundational 120, swappable 111. By status against the code: settled 93, partly built 62, open 76. At the merge of the fragments, 2026-11-03, the inventory held 256 decisions in 33 proposed chapters (capability 202, implementation 54; settled 176, partly built 42, open 37): the review ruled more decisions open than the sources recorded, because it states each decision as the goal and holds the difference from the code as a finding.

Ids appear in this file only as data: in the Sources lines, and in the Notes where a fragment cited them. The identifier key at the end names each one.

## The proposed table of contents

The order binds by dependency: every decision comes after the decisions it depends on, and no decision depends on a later chapter. Within a chapter, among decisions with no dependency between them, the more significant comes first. Chapters keep tightly related decisions together, so significance breaks ties inside a chapter and between chapters only where dependency leaves the choice free.

**Front matter**

- **How this book is organized** (the preface, as merged). Holds the organization the book follows; it presents no decision.
- **Ten choices that define Allegro** (the tour). Tells the ten significance-5 decisions as one story, each pointing forward to its chapter: Everything above the kernel is an extension, and there is one way to extend (Keep it simple); One operation: partial evaluation (Keep it simple); Correctness and safety are one kind of claim (Keep it simple); Claims are evaluated like everything else (Keep it simple); The kernel trusts only what it has evaluated (Keep it simple); One value universe (Values); Metadata is a field on every value (Metadata); Evaluation is total over unresolved information (Evaluation); Types are values that constrain values (Types as values); Refinement types (Refinement types). Draws on [README.md](../../README.md) what Allegro is, [vision.md](../book/vision.md) §1, §2.

**Part I: The bet**

Chapters 1 and 2 as ruled in DR1 (2026-11-11), with the titles the maintainer gave on PR #185; all wording is reviewed for style in a later pass. The part opens with the thesis statement "Why a new language, now", which is not a decision. The demo ladder and the three-part positioning are narrative, told in the tour.

1. **Why a new language** (10 decisions). Why Allegro exists, and the platform that follows from it: trust from the kernel, domain languages that grow, one way to extend, a kernel with no language.
   - Decisions: Trust comes from the kernel, not the author; A system is described in the language of its domain, and that language grows with the understanding; Everything above the kernel is an extension, and there is one way to extend; The kernel contains only what no extension could supply; Meaning comes before notation; The kernel holds no language; Order of definition carries no meaning; A language inherits every check of what it is built on; A mapping between models is itself a checked value; A paradigm is a library.
2. **Keep it simple** (13 decisions). Partial evaluation as the one operation; phases, claims, effects and trust stated in its terms; host code and optimization; the code's units.
   - Decisions: One operation: partial evaluation; Phases are configuration; Claims are evaluated like everything else; An effect consumes only values whose claims are decided; Correctness and safety are one kind of claim; The kernel trusts only what it has evaluated; Anyone may propose, and the record shows who; A decided claim can be translated into a proof an outside checker accepts; Host code reaches a program only as primitive functions; No interface limits optimization; Every result says how strongly it holds; From experiment to proof without rewriting; Each decision lives in one replaceable unit of code.
Chapter 3 of the first proposal was dissolved in DR1: its decisions are folded into chapters 1 and 2. Chapters are numbered as phase 1 left them, 2026-11-13.

**Part II: The kernel**

As ruled in DR2 (2026-11-11), with the chapter titles the maintainer confirmed on PR #187. Implementation decisions sit at the end of the chapter whose decisions they realise.

3. **Values** (12 decisions). What exists in the kernel: one universe of values in seven kinds, bits the kernel does not compute on, one composite, names.
   - Decisions: One value universe; Seven representation kinds; The kernel's plain data is a sequence of bits, and it computes nothing on them; One composite kind: Structure; Structures immutable by default; derive, never mutate; Arrays are structures with unkeyed entries; Symbol identity is a fully-qualified name; Value as a contract, seven kind units and an assembly; The composite is one sequence of optionally-keyed entries; Construction only through factories, one host class; Binding state belongs to the binding, not the value; Symbols interned by FQN.
4. **Programs as values** (5 decisions). Expressions and functions are ordinary values, so a program can be built, read and partly evaluated like any other data.
   - Decisions: Expressions are values, forming a DAG; Positional parameters owned by membership; Functions are data: params plus body; Expressions memoize per evaluation context; Transient reference symbols resolved by base name.
5. **Authority** (6 decisions). The right to do what not all code may do is an unforgeable value that reading never yields; capabilities are granted, bounded by claims and supplied per target.
   - Decisions: Authority is an unforgeable value; Reading an expression never yields authority; A capability is granted, never acquired; What code may do is bounded by the capabilities it is given, and that bound is a claim; A capability is supplied per target; Machine arithmetic is a set of pure primitives that ships with the platform.
6. **Metadata** (8 decisions). Every value carries independent fields, each registered by its owner with a pure, bounded rule; every value keeps its origin.
   - Decisions: Metadata fields are independent; Metadata is a field on every value; An extension registers its own fields; the kernel has two; A field's rule is a pure, bounded function; Every value keeps its origin; Trust in a value needs no seal; Metadata supplied at construction, one attachment operation; Metadata slot mixed in from the metadata unit.
7. **Evaluation** (12 decisions). How the one operation proceeds: calls, recursion, branches, missing values, arriving information, determinism, the environment.
   - Decisions: Evaluation is total over unresolved information; The environment is not a value; A function may take an argument unevaluated; A call is evaluated by evaluating the function's body; A recursive call is evaluated once for each state of knowledge; A branch that may not be taken is evaluated without capabilities; A missing value is a cell that is filled once; When information arrives, what waited on it is evaluated again; The same program and the same information give the same result; Scopes layer by parent chain; Substitution of params into bodies; Tail calls by sentinel and loop.
8. **Extensions** (3 decisions). Functions and metadata fields, the few pure primitives beneath them, and what the kernel requires of an extension.
   - Decisions: An extension is made of functions and metadata fields; The kernel's primitives are pure and few; What the kernel requires of an extension.
9. **Correctness** (5 decisions). The kernel's record of a claim, refutation and how it spreads, failing paths, failures a program handles, and the two reasons evaluation stops early.
   - Decisions: Only the kernel records the outcome of a claim; A refutation marks everything computed from it; A refutation on a path that may be taken refutes the program; A failure a program can handle is supplied by an extension; Evaluation stops early for two reasons only.

**Part III: Syntax and modules**

As ruled in DR3 (2026-11-12), with the chapter titles the maintainer confirmed on PR #190.

10. **Parsing** (13 decisions). A parser is a function, a grammar is a value, and a notation stands for an expression; how grammars read characters, layout and precedence, and what ambiguity is.
   - Decisions: Parsing is evaluation; No parser is privileged; Grammars are values; Every notation stands for an expression; The `grammar { … }` block; A parser records where each expression came from in its text; Scannerless parsing; A terminal is a function, so a grammar can define its own; Offside rule through stateful indent terminals; Guards and reserved words separate keywords from identifiers; Named, partially ordered precedence levels; Ambiguity is a claim; Parse failure reporting and recovery.
11. **Changing the grammar** (4 decisions). How a text changes the language it is written in, how changes combine, and how far one reaches.
   - Decisions: A text can change the grammar it is read in; Every production can be extended; Grammars combine without regard to order; A grammar change reaches to the end of its block.
12. **The parser engine** (2 decisions). What any parsing algorithm must do, and how the first engine arrives.
   - Decisions: Any parsing algorithm will do that meets five conditions; The platform's parser engine ships already built.
13. **Modules and programs** (4 decisions). Modules as extensions that arrive as files, running a program, and the one evaluation every program gets.
   - Decisions: A module is an extension that arrives as a file; The loader reaches files through a capability; Running a program is evaluating its main module with a configuration's capabilities; Every program is evaluated the same way, however it arrives.

**Part IV: Allegro Standard**

As ruled in DR4 (2026-11-12), with the chapter titles the maintainer confirmed on PR #191.

14. **Types as values** (14 decisions). Types are ordinary values that constrain values; every value of the language has one; kinds, conformance by member symbol, the core types over bits, exceptions, generics and typed functions.
   - Decisions: Types are values that constrain values; In the standard language every value has a type; Kinds are types, and Type is its own type; Members are keyed by symbol and conformance is membership; One meta-type with an optional name; One construction surface; Loose conformance for data, selected by anonymity; The standard language's handled failure is an exception; The core types are built over bits; Generics are memoized type constructors; Function types with bidirectional call-site unification; A typed function claims its parameter types on entry and its return type on exit; `distinct` mints a fresh-symbol newtype; The user-facing generics surface and parameter kinds.
15. **Refinement types** (7 decisions). A refinement is a type plus a predicate; what the extension can decide without search; shape and knowledge; no declared inheritance; construction as a claim.
   - Decisions: Abstract domains as sound approximations; Refinement types; Shape and knowledge are separate; Declared inheritance dissolves into conformance, refinement and composition; Invariants are refinements; Constructing a refined value claims its predicate; An interface is a type drawn from, not instantiated.
16. **Reaching a member** (4 decisions). A key for secrecy, a claim about origins for discipline, and what a module hands out.
   - Decisions: A private member is one whose key not all code holds; Who may use a member is a claim about where the access was written; Export marks the binding, and a module with no exports is open; Imported modules are typed objects whose type encapsulates.
17. **The surface language** (10 decisions). The spellings a programmer writes: blocks, declarations, conditionals, annotations, pattern matching.
   - Decisions: Indentation blocks, with brace and offside both as the goal; Refinement types written `T & predicate` with `_` as the value; Function declarations with `=>`; Expression-valued `if then else`; The `Y of x` component-access form; Type annotations on parameters and returns; Statement forms that declare a binding; `when / is / then` pattern matching; Combinators before keyword declaration syntax; String interpolation with braces.
18. **Claims and proofs** (7 decisions). Nothing is a claim until someone makes it; claims about every value, proof terms as proposals, deciding without search, sampling, and the four strengths.
   - Decisions: Nothing is a claim until someone makes it; A claim about every value is decided by evaluating it with the value unknown; A proof term is a proposal; Discharge mechanisms without search; Bounded sampling for universal claims; Four strengths, one vocabulary; Tactics as a pure Allegro library.
19. **Equality and laws** (4 decisions). Equality by shape, the default equality, lawful interfaces and the strength of a law.
   - Decisions: Lawful interfaces; Equality dispatches on shape, then coerces, else not-equal; Default equality belongs to the standard extension; Law strengths and the transitivity gate.
20. **Effects** (3 decisions). An effect is the use of a capability; parts and narrowed forms; how a bound is written.
   - Decisions: An effect is the use of a capability; A capability has named parts and narrowed forms; A bound on capabilities is written in an `effects` clause or a type slot.
21. **Contracts** (6 decisions). A contract becomes knowledge that travels with the value; clauses as notation; matches that cannot fall through.
   - Decisions: A contract is a predicate that becomes knowledge, discharged by PE; What is known about a value travels with the value; A match where no arm matches is a refutation; A body clause is a notation; Contract checks sit at function entry and return; Unification in patterns.
22. **Termination and completion** (4 decisions). Termination as a claim, completion as termination plus arrival, and how a decrease is recognised.
   - Decisions: Termination is a claim; Completion is totality and liveness; Termination by bounded decrease; Mutual recursion requires every edge to decrease.
23. **When a check fails** (4 decisions). Purity of equality and invariants, assumptions on the record, counterexamples, and predicates that explain a refusal.
   - Decisions: Equality, coercion and invariant predicates hold no capability and terminate; An assumption is always on the record; Every failure carries a legible counterexample; A predicate can explain its refusal.

**Part V: Vivace**

As ruled in DR5 (2026-11-12), with the chapter titles the maintainer confirmed on PR #193. The part opens with the introduction "What Vivace is for", which is not a list of decisions. The worked languages are evidence; planning's entries are held, not ruled.

24. **Models** (4 decisions). A model is a value; transformations are models; models relate only through declared mappings.
   - Decisions: A model is a value; A transformation is a model; Two models relate only through a declared mapping; A change to a model is a mapping from the old one.
25. **Search and optimization** (3 decisions). Solving as proposing, a solver that sees its problem unevaluated, and the difference between feasible and best.
   - Decisions: Solving is proposing a value for an unknown, and the kernel checks it; A solver sees its problem unevaluated; Feasible is decided; best says how strongly it holds.
26. **Analysing models** (1 decision). Meta-modelling as analysis with tools, and the questions left open.
   - Decisions: A model's quality is a question for analysis.
27. **Units of measure** (4 decisions; a worked language, reworded in DR4).
   - Decisions: Dimensions as data, named dimensions as refinements over one Quantity; Quantity laws at honest tiers; Number-anchored quantity literals; Conversion sugar with `in`.
28. **Plans as outcome graphs** (11 decisions; held, not ruled).
   - Decisions: A plan is an outcome graph with derived wiring; Leaf and composite nodes, with `uses` to borrow a plan; Failure handlers over outcomes; Two enforcement shapes for a well-formed plan; Planning surface conventions; Bracket constraints as refinements, named as predicate fixtures; Planning-local effort and money, durations from the units DSL; Estimates roll up, budgets are proved; Scheduling, resources, performers and latitude; Fan-in through an explicit aggregator node; Explicit `raise` and failure context in handlers.
29. **Finding solutions to a plan** (4 decisions; held, not ruled).
   - Decisions: Choices, templates and solution finding by enumeration; Completion from a catalog; Library search over kernel residuals; Search beyond enumeration.

**Part VI: Building and running programs**

As ruled in DR6 (2026-11-13). The part opens with an introduction, the roles and the ways the platform is used, which is not a list of decisions.

30. **The kernel's interface** (4 decisions). A passive kernel, what its interface offers and never exposes, and limits.
   - Decisions: The kernel is passive; What the kernel's interface offers; No interface call writes a bare claim outcome; Limits are step budgets.
31. **Configuration** (3 decisions). What configuration is, where it is read from, and configuration as a model.
   - Decisions: Configuration is all the information that determines an execution; Configuration sources have a priority, and a result says which supplied each value; A full configuration is a model, evaluated in a first phase.
32. **Launching** (4 decisions). The launcher's criterion, the ceiling, startup step by step, and many invocations.
   - Decisions: The launcher does only what cannot be done in Allegro; Only the launcher sets the ceiling; Startup, step by step; One kernel serves many invocations.
33. **Capabilities and primitive functions** (5 decisions). Capabilities defined once and implemented per target, modules as functions of them, three strengths of loading, reference definitions.
   - Decisions: A capability is a named set of effectful primitives; A module is a function of the capabilities it declares; Only the module being run performs effects when instantiated; Loading is three capabilities of rising strength; Every pure primitive the platform ships has a reference definition.
34. **Phases** (3 decisions). The three shipped phases, residuals handed on, and defining or extending a phase.
   - Decisions: The platform ships three phases: check, run and export; A phase hands its residual to the next; A project defines a phase or extends one.
35. **Saved programs and export** (8 decisions). Saved programs, restoring outcomes, target platforms, when a kernel is needed, rewrites by laws, distribution.
   - Decisions: A saved program is a recorded sequence of interface calls; A saved program names what it needs by content hash; A stored outcome is restored with its builder's name; A target platform is a model, and export is a transformation into it; Saving is export to a target whose model is the kernel's interface; An exported program needs a kernel only if it handles expressions at run time; A law licenses a rewrite, and the rewritten program carries the law's strength; How extensions are distributed.
36. **Trust** (6 decisions). What is trusted, what a result names, policies, builders, the reference kernel, purity.
   - Decisions: Three things are trusted: the kernel, the launcher and primitive functions; A result names everything it rests on; A policy is a claim over what a result rests on; A builder is identified by hash, then manifest, then signature; One reference kernel is the root of trust; A primitive's purity is assumed and named unless something stronger is shown.
37. **Tools** (7 decisions). Tools that read results, commands, summaries, the tools for proposing, tracing.
   - Decisions: A tool reads a phase's result and adds no analysis of its own; A command is a configuration; A module's summary is the weakest strength among its claims; Open obligations are listed for any proposer; One primer for every proposer; A proposer answers with only the missing value; A trace is read from origins.
38. **The launchers we ship** (5 decisions). The default configuration, the shipped capabilities, values that arrive later, the browser.
   - Decisions: The platform's default configuration is the standard language; The terminal and the browser ship output, timers and HTTP; A value that arrives later fills a cell; The browser launcher is one bundle; The core runs in a browser.

## Findings held for their decisions

A **held finding** is a defect a review finds in a decision the pass has not reached in order. It is recorded on the decision's entry below, as a "Held finding" note, and fixed in the chapter PR that takes the decision (`book-pass.md` §2.7), not handed to another stream; ruled 2026-11-10. A finding that cannot wait for its chapter goes to the maintainer as an ask.

| Finding | Decision | Chapter | Source |
|---|---|---|---|
| A second viral field erases the first | Metadata fields are independent | Metadata | the pilot's review, §7 item 1 |
| `channel_register` accepts any rule string | A field's rule is a pure, bounded function | Metadata | the pilot's review, §7 item 2 |
| A user-registered viral field stops computation | A field's rule is a pure, bounded function | Metadata | the pilot's review, §7 item 3 |
| The ownership test never checks owners | An extension registers its own fields; the kernel has two | Metadata | the pilot's review, §7 item 4 |
| Termination and exhaustiveness are privileged host passes | Termination by bounded decrease; A match where no arm matches is a refutation | Termination and completion | DR1, rulings of 2026-11-11 |
| `print` is a base primitive | The kernel's primitives are pure and few; The terminal and the browser ship output, timers and HTTP | Extensions; The launchers we ship | DR1, rulings of 2026-11-11 |
| Phases are hard-coded in the pipeline | The platform ships three phases: check, run and export | Phases | DR1, rulings of 2026-11-11 |
| A failed return type does not halt | Type annotations on parameters and returns | The surface language | DR1, rulings of 2026-11-11 |
| A refuted proof halts only after the program has run | Every program is evaluated the same way, however it arrives | Modules and programs | DR1, rulings of 2026-11-11 |
| Effects are not gated on decided claims | The terminal and the browser ship output, timers and HTTP; A failure a program can handle is supplied by an extension | The launchers we ship; Correctness | DR1, rulings of 2026-11-11 |
| The standard language is host code holding writers; install operations, the `typed` flag, grammar lowering and 54 primitives are privileged | the decisions of Parts II to IV named on "Everything above the kernel is an extension, and there is one way to extend" | several | DR1, rulings of 2026-11-11 |
| The platform with no extension loaded cannot load one | Startup, step by step | Tools | DR1, rulings of 2026-11-11 |
| Installed hooks are opaque to partial evaluation | An extension is made of functions and metadata fields | Extensions | DR1, rulings of 2026-11-11 |
| Housekeeping removed as decisions in DR2, still owed as work: prefixed engine slots, legacy primitives, the host plane's declaration, shared host types that let the kernel see an extension's representation, kind comparisons outside their units | Each decision lives in one replaceable unit of code; An extension is made of functions and metadata fields | Keep it simple; the extension interface | DR2, rulings of 2026-11-11 |
| The separate effects checker | the effects decisions | Effects | DR1, rulings of 2026-11-11 |
| Authorship is not kept in the verdict | Open obligations are listed for any proposer | Tools | DR1, rulings of 2026-11-11 |
| Three strength vocabularies; `proven` names a sampled check and is absent from the verdict; `proven-safe` and "Verdict (verified)" overstate | Bounded sampling for universal claims; A module's summary is the weakest strength among its claims; Every result says how strongly it holds | Claims and proofs; Tools; When a check fails | DR1, rulings of 2026-11-11 |
| The return check reports a conforming refined return as a mismatch | Type annotations on parameters and returns | The surface language | DR1, rulings of 2026-11-11 |
| A name bound twice wins silently; implicit production replacement; ordered choice | the grammar, module and binding decisions | Parts III and IV | DR1, rulings of 2026-11-11 |
| Forbidden imports, mixed files and kind comparisons outside their units | Each decision lives in one replaceable unit of code | Keep it simple | DR1, rulings of 2026-11-11 |
| Parsing is a host stage; the engine, base grammar and tree builder are host code | Parsing is evaluation; Every notation stands for an expression; The platform's parser engine ships already built | Parsing; The parser engine | DR3, rulings of 2026-11-12 |
| The header is scanned ahead of the parse by each caller, and the callers disagree; an inline grammar in a library is rejected | A text can change the grammar it is read in | Changing the grammar | DR3, rulings of 2026-11-12 |
| The engine commits to the first matching alternative, reports one parse and cannot change grammar during a parse; terminals are a closed set | Any parsing algorithm will do that meets five conditions; A terminal is a function, so a grammar can define its own; Ambiguity is a claim | Parsing; The parser engine | DR3, rulings of 2026-11-12 |
| Replacing a base production only warns; appended and front-spliced alternatives take meaning from position | Grammars combine without regard to order; The `grammar { … }` block | Changing the grammar; Parsing | DR3, rulings of 2026-11-12 |
| The loader is host code with a host file-reader option; the browser has its own scanner and loading code; the load-once cache is per process | A module is an extension that arrives as a file; The loader reaches files through a capability; What the kernel requires of an extension | Modules and programs; Extensions | DR3, rulings of 2026-11-12 |
| A grammar change does not reach the prompt | Running a program is evaluating its main module with a configuration's capabilities | Modules and programs | DR3, rulings of 2026-11-12 |
| The pipeline has fixed host stages and writes in place into built values, with a guard for library values | Every program is evaluated the same way, however it arrives | Modules and programs | DR3, rulings of 2026-11-12 |
| Member access is mediated through an installed path with a policy hook; privacy asks what a scope can reach | A private member is one whose key not all code holds | Reaching a member | DR4, rulings of 2026-11-12 |
| Typed calls are checked by the evaluator; body clauses are lowered by host steps | A typed function claims its parameter types on entry and its return type on exit; A body clause is a notation | Types as values; Contracts | DR4, rulings of 2026-11-12 |
| A failed construction yields an error value; `make_error` and the `error` field are in the kernel | Constructing a refined value claims its predicate; The standard language's handled failure is an exception | Refinement types; Types as values | DR4, rulings of 2026-11-12 |
| The proof rules are kernel primitives | A proof term is a proposal | Claims and proofs | DR4, rulings of 2026-11-12 |
| Findings have severities; a match that can fall through is information | Nothing is a claim until someone makes it; A match where no arm matches is a refutation | Claims and proofs; Contracts | DR4, rulings of 2026-11-12 |
| Effects are label strings checked separately; `is_resolved` is a primitive | An effect is the use of a capability | Effects | DR4, rulings of 2026-11-12 |
| Facts are kept on the scope and narrowed in place | What is known about a value travels with the value | Contracts | DR4, rulings of 2026-11-12 |
| The verdict is assembled outside evaluation; undecided contracts do not reach it | Every result says how strongly it holds | Keep it simple | DR4, rulings of 2026-11-12 |
| There is no stated kernel interface; each host calls the evaluator's internals | What the kernel's interface offers | The kernel's interface | DR6, rulings of 2026-11-13 |
| Hosts are swapped by capturing output and substituting extensions; a failed request fills a cell with an error value; a missing runtime throws | The terminal and the browser ship output, timers and HTTP; A value that arrives later fills a cell | The launchers we ship | DR6, rulings of 2026-11-13 |
| The module summary has a vocabulary of its own | A module's summary is the weakest strength among its claims | Tools | DR6, rulings of 2026-11-13 |
| The browser bundle holds no module loader and fails on an unguarded Node global | The browser launcher is one bundle; The core runs in a browser | The launchers we ship | DR6, rulings of 2026-11-13 |

The pilot's review is [p2-allegretto-metadata-and-capability.md](../records/book-pass/p2-allegretto-metadata-and-capability.md).

## Rulings on the inventory, 2026-11-05

The maintainer's comment on PR #163 ruled the proposal. In short, with [book-pass.md](book-pass.md) §6, "Rulings taken 2026-11-05", as the record:

- **The contents have the right shape.** They are working placeholders. The tour becomes a significant conceptual journey: it lays out the shape of Allegro (a minimal kernel, extension, the type philosophy, maximal domains, and Allegro in use: execution, tooling, pipelines), with reasoning that establishes the kernel's requirements and features, prefiguring the later chapters. It will likely conclude with the ten choices listed above, or very similar ones. "The bet" is a placeholder too, and incomplete; more detail comes in later discussion.
- **The pilot** is "Metadata".
- **The chapters leaving the book** leave as proposed. Units and layers are discussed early as architectural principles, in appendices, not chapters.
- **Every decision is worked through in order.** Any decision may change, be removed, or gain new neighbours, and the resulting code and test changes are made. The process is strictly monotonic: once a decision is approved and its code changes made, every decision up to it, and the code stemming from them, is final and correct. A point of non-monotonicity is a process failure: the pass goes back, reorders or revises, and repeats until the list is fully ordered and monotonic.
- **Two types of decision.** Each decision is about language capability or about implementation. No capability decision may depend on an implementation decision. The three cycles the merge broke looked like decisions whose type was unclear. Capability decisions that necessarily depend on each other are stated as one decision.
- **Order of definition carries no meaning.** A new decision, below in "Why a new language". The parser algorithm stays swappable, except that ordered choice must not be required; the shipped ordered choice is an expedient, to be replaced by GLL or a similar algorithm.
- **`eval_when` and PE Rule 2** need careful review and analysis; decisions may change to make them coherent and consistent.

Applied in chunk P1b (2026-11-05): every entry carries its type, 202 capability and 54 implementation decisions of 256. The check found 21 dependencies of a capability decision on an implementation decision, in 20 entries. In 19 the dependency was misread and now points at the capability the entry rests on, or is removed; one entry, "Post-passes registered by layers", is implementation and was retyped (2 edges). No entry was split. Two capability decisions that each state the other became one, "A missing value is a cell that is filled once". Four entries moved within their chapters. The record is "The type check, 2026-11-05", before the open questions.

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

**Note, 2026-11-13.** The "Goes to" lists name the chapters as phase 1 left them. The sentence before each list is the first proposal's and may name a chapter since dissolved; the table is redone when the chapters are written.

| Present chapter | Destination in the proposed contents |
|---|---|
| [preface.md](../book/preface.md) (How this book is organized) | Stays the preface, unchanged. Goes to: the preface. |
| [README.md](../../README.md) (Introduction) | Leaves the book's order: it stays the repository's front page; its account of what Allegro is feeds the tour. Goes to: the tour (what Allegro is). |
| [getting-started.md](../book/getting-started.md) (Getting started) | Leaves the narrative as a guide (appendix); its prover loop and compiler views feed three chapters. Goes to: Keep it simple (See what the compiler knows); Claims and proofs (The prover loop); Tools (subcommands). |
| [language-reference.md](../book/language-reference.md) (Language reference, by example) | Leaves the narrative as a lookup aid (appendix); its spellings are the decisions of the surface-language chapter. Goes to: The surface language; Reaching a member (Private members). |
| [vision.md](../book/vision.md) (Vision and principles) | Redistributed: its bets become the tour and Part I's decisions. Tier 0: moving its text needs the maintainer's sign-off (Open questions). Goes to: the tour (§1, §2); Keep it simple (§1, §1a, §2, §5); Why a new language (§1 Substrate and surfaces, §1a, §5); Keep it simple (§1a move 2, §3, §5 principles 6 to 13); Models (§4); Tools (§3, §6); Saved programs and export (§6). |
| [process.md](../book/process.md) (Process and engineering guide) | Leaves the book: process detail (an appendix outside the order). |
| [architecture-vocabulary.md](../book/architecture-vocabulary.md) (Architecture vocabulary) | Dissolves: each term moves to the chapter that first uses it (layer and track in Part I, plane and plane interface in Part II); actor leaves with the actors study. Goes to: Why a new language (layer, track, unit); Metadata (plane); Extensions (plane interface). |
| [layers.md](../book/layers.md) (Layers, tracks and milestones) | Split: the layer spine and tracks enter Part I and the pipeline chapters; milestones and the backlog's use of them leave the book (status). Goes to: Why a new language (§1); Modules and programs (§2 (build pipeline as a track)); Phases (§2 (precompile)). |
| [units.md](../book/units.md) (Units: the implementation as a narrow DAG) | Split: what a unit is and the DAG enter Part I and the kinds chapter; actors, moves and measurement leave the book (process). Goes to: Why a new language (§1, §2, §4, §5); Values (§3, §3.2); Metadata (§3.1). |
| [implementation-map.md](../book/implementation-map.md) (Implementation map) | Leaves the book: a file map (appendix); each chapter's as-implemented block points to its unit instead. |
| [actors-and-activities.md](../book/actors-and-activities.md) (Actors and activities (study)) | Leaves the book: a study (records). |
| [concepts.md](../book/concepts.md) (Concepts: requirements, specification and implementation choices, and the definitional spine) | Dissolves: Part 0's requirements and choices become decisions in Parts I and II; the spine's entries become concept definitions at their first use. Goes to: Keep it simple (Part 0 R1, R2); Why a new language (Part 0 R6, §23); Values (T0 §1 to §3, §8); Programs as values (T0 §4 to §7); Values (T0 §9, §12 to §14); Metadata (T2 §19, §19b, §21); Metadata (T2 §20); Metadata (T1 §11, §18, §22); Extensions (§23, §24); Evaluation (§15); Evaluation (§25 to §29); Types as values (T3); Refinement types (T4); Effects (T5); Termination and completion (T5). |
| [allegretto/README.md](../book/allegretto/README.md) (L0 Allegretto: boundary contract) | Dissolves into Part II: the boundary's invariants become the base's decisions. Goes to: Why a new language (the boundary); Values (the minimal base); Extensions (the install surface). |
| [allegretto/structures.md](../book/allegretto/structures.md) (Structures, scopes and channels) | Split across Parts II and IV: structure, channels, scope and symbols in Part II; shape and knowledge, equality, conformance and kinds-as-types in Part IV. Goes to: Values (§11, Appendix B); Programs as values (§5); Values (§1, §2); Metadata (§3, Appendix C); Metadata (Appendix A); Evaluation (§4); Evaluation (§10); Types as values (§9); Refinement types (§6); Equality and laws (§7, §8); Termination and completion (§10). |
| Value, the kinds and the assembly (planned) | Becomes the first two kernel chapters. Goes to: Values; Programs as values. |
| [allegretto/metadata-and-capability.md](../book/allegretto/metadata-and-capability.md) (Metadata and capability) | Split: §1 to §4 and §6 become the pilot chapter; §5 and §8 the propagation chapter; §7 the install chapter. Goes to: Metadata (§1 to §4, §6, §9); Metadata (§5, §8); Extensions (§7). |
| Scope (planned) | Becomes the scopes chapter. Goes to: Evaluation. |
| [allegretto/evaluator.md](../book/allegretto/evaluator.md) (The evaluator) | Split: evaluation, the PE rules, substitution and tail calls stay together; the install surface goes to Part II's install chapter; precompile behaviour to the pipeline chapter. Its IR (`evaluator.ir.md`) travels with it. Goes to: Values (§2 (the default arm)); Extensions (§7, §8); Evaluation (§2 to §6); Phases (§3 (effects deferred, the cutoff)). |
| Futures and the base primitives (planned) | Split: futures into the evaluation chapter, the primitives into the kinds chapter, environment capabilities into the host chapter. Goes to: Values; Evaluation; The launchers we ship. |
| [extension/README.md](../book/extension/README.md) (L1 extension substrate: boundary contract) | Dissolves into Part III's opening. Goes to: Why a new language (the L1 boundary); Parsing (the boundary). |
| [grammar-formalism.md](../book/grammar-formalism.md) (The grammar formalism) | Becomes the grammars chapter, its extension sections the next one; worked examples move to an appendix. Goes to: Parsing (§1 to §5, §7, §8); Changing the grammar (§6); The surface language (§5 (layout)). |
| [extension/grammar.md](../book/extension/grammar.md) (Grammar and parser) | Split across Part III and the surface chapter. Goes to: Parsing (§1, §2); Changing the grammar (§4); Modules and programs (§4 (activation)); The surface language (§3). |
| [extension/modules.md](../book/extension/modules.md) (Module loading and module objects) | Split: loading into the modules chapter, typed module objects into the visibility chapter. Goes to: Modules and programs (Loading, Loaded once per process); Reaching a member (module objects). |
| [standard/README.md](../book/standard/README.md) (L2 Allegro Standard: boundary contract) | Dissolves into Part IV's opening. Goes to: Types as values (the boundary). |
| [standard/type-system.md](../book/standard/type-system.md) (The type system) | Split across the types, refinement, visibility and surface chapters. Goes to: Metadata (§4); Types as values (§1, §2, §5, §6); Refinement types (§3 (refines)); Reaching a member (§3, §7); The surface language (§3 (combinators)). |
| [standard/core-types.md](../book/standard/core-types.md) (Core types) | Joins the types chapter. Goes to: Types as values. |
| [standard/effects.md](../book/standard/effects.md) (Effects) | Becomes the effects chapter; environment capabilities go to the host chapter. Goes to: Effects; The launchers we ship (environment capabilities). |
| [standard/pattern-matching.md](../book/standard/pattern-matching.md) (Pattern matching) | Split: the spelling into the surface chapter, branch refinement into the contracts chapter. Goes to: The surface language (§1, §2); Contracts (§3). |
| [standard/totality.md](../book/standard/totality.md) (Totality and termination) | Becomes the termination chapter; the cutoff goes to the pipeline chapter. Goes to: Termination and completion (§1 to §5); When a check fails (§5 (severity)); Phases (§7, §8 (the cutoff)). |
| [standard/contracts.md](../book/standard/contracts.md) (Contracts and invariants) | Split: the predicate model and body forms into the contracts chapter, invariants into the refinement chapter, failure semantics into the failures chapter. Goes to: Refinement types (§5); Contracts (§1 to §4, §6, §8); When a check fails (§7, §10). |
| [vivace/README.md](../book/vivace/README.md) (L3 Vivace: boundary contract) | Becomes the Vivace chapter. Goes to: Models. |
| [vivace/planning-dsl.md](../book/vivace/planning-dsl.md) (The planning DSL: the first Vivace pilot) | Split: the model into the plans chapter, solution finding into the next. Goes to: Plans as outcome graphs (the model, conventions, enforcement); Finding solutions to a plan (choices, catalogs, search). |
| [platform/README.md](../book/platform/README.md) (Capability tracks) | Dissolves into Part VI's opening and Part I's tracks. Goes to: Modules and programs (the build track); Saved programs and export (undelivered tracks). |
| [platform/build-pipeline.ir.md](../book/platform/build-pipeline.ir.md) (The evaluation pipeline) | Split: one pipeline and the `use` pre-scan into the modules chapter, the rest into the pipeline chapter. Goes to: Modules and programs (one pipeline, the `use` pre-scan); Phases (precompile onward). |
| [platform/tooling.ir.md](../book/platform/tooling.ir.md) (Tooling) | Becomes the tools chapter; verification claims go to Part I. Goes to: Keep it simple (C102 to C110); Claims and proofs (C130); Tools. |
| [platform/host.ir.md](../book/platform/host.ir.md) (Host environments) | Becomes the host chapter. Goes to: The launchers we ship. |
| [proving-in-allegro.md](../book/proving-in-allegro.md) (Proving in Allegro) | Its decisions enter the proofs and laws chapters; the primer itself stays a guide (appendix) for provers. Goes to: Keep it simple (When PE-as-discharge isn't enough); Claims and proofs (the proof model, strategies, output contract); Equality and laws (Laws, discharge tiers). |
| [demo-ladder.ir.md](../book/demo-ladder.ir.md) (The demo ladder and the rung-3 pilot) | Split: the ladder as the thesis test into Part I, the rungs into Part V. Goes to: Why a new language (the ladder); Units of measure (rung 2); Finding solutions to a plan (rung 3, the capstone). |
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
- Held finding (2026-11-11, DR1): the `typed` flag of `evalSource` changes literal typing, wraps every primitive and turns on precompile; no extension can ask for these (`src/runtime.ts:150`–`160`, `1167`–`1174`). Held on "Every program is evaluated the same way, however it arrives" and "Precompile before the evaluation loop".
- Held finding (2026-11-11, DR1): the base grammar and tree builder lower annotations and contracts to the standard language's primitives by name (`src/grammar2/base-grammar.ts:748`–`755`, `src/grammar2/tree-builder.ts:1384`–`1396`). Held on the surface-language and proofs decisions.
- Held finding (2026-11-11, DR1): 54 primitives of the standard language are in the kernel's one table (`src/runtime.ts:156`–`160`). Held on "The kernel's primitives are pure and few".
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
- Notes (2026-11-12, DR5): worked out in Part V: "A transformation is a model", "Two models relate only through a declared mapping", "A change to a model is a mapping from the old one".
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
- Held finding (2026-11-11, DR1): `print` is a base primitive and performs output in any evaluation (`docs/book/units.md` row 15 lists it in `base-primitives`). Held on "The kernel's primitives are pure and few" and "Environment capabilities outside the base, effect-labelled".
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
- Held finding (2026-11-11, DR1): a refuted proof halts only after the whole evaluation loop (`src/runtime.ts:1686`–`1703`). Held on "Every program is evaluated the same way, however it arrives".
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
- Decides: a result the kernel did not evaluate itself is never reported as decided. An answer from an outside solver, or a statement a program asks it to accept, is reported as assumed, and everything that rests on it says so. A claim decided with the help of a capability is decided, and names the capability.
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

- Notes (amended 2026-11-11, DR2, with the maintainer's approval): the return of a capability is not a claim, so it is not "assumed"; a claim decided by calling a capability is decided and names it.

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
- Notes (2026-11-12, DR5): an obligation is a claim waiting for a value, and a proposal supplies it. A theorem without a proof and a gap in a model are the same thing: anyone may propose the missing value, and the kernel evaluates the claim again when it arrives.
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

#### Host code reaches a program only as primitive functions
- Decides: code in the host's language cannot be checked by the kernel, so it enters in one form: as a primitive function, a function whose body is host code. A primitive function is effectful or pure. A capability is a named set of effectful ones: an extension may declare it, and a configuration supplies it. A primitive function takes data and returns data. It cannot write metadata, so it cannot forge a type, a proof or the result of any analysis. Its purity is declared and assumed, where a composed function's is decided from what it holds. A claim about what a primitive returns is either checked when the data arrives or reported as assumed.
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
- Notes (2026-11-13, DR6): was "Host code reaches a program only as a capability"; reworded for the four kinds of function the Part VI review settled: a primitive function or a composed function, each effectful or pure. Kept in Part I, where the decisions that depend on it need it.
- Chapter: Keep it simple

#### No interface limits optimization
- Decides: partial evaluation sees through every extension. An expression that crosses from a program into an extension, or from one extension into another, is evaluated as one expression, so the extension interface costs nothing a program can measure. Optimizations that partial evaluation does not find are functions over a program's expression, open to every extension. The one opaque point is the body of a capability.
- Status: open; ruled 2026-11-11 (DR1)
- Type: capability
- Rationale kind: vision
- Depends on: One operation: partial evaluation; Everything above the kernel is an extension, and there is one way to extend; Host code reaches a program only as primitive functions
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
- Depends on: The kernel trusts only what it has evaluated; Host code reaches a program only as primitive functions
- Significance: 5 — no bare checkmark: every result carries its strength and what it rests on
- Label: foundational — the verdict, the ledger, every grade and every keyword naming a check rest on it
- Units: none of its own
- Options recorded: one vocabulary per kind of claim with a published mapping (rejected); the three lists in use today (rejected)
- Sources: docs/book/vision.md §1a, §5 principle 10; the maintainer's rulings of 2026-11-11 (../records/book-pass/dr1-part-1-the-bet.md, Rulings taken)
- Notes: replaces "Every claim states its discharge strength"; absorbs "never silently weakened" from the review's proposal on performance and safety, and the rule that only a field's owner writes it.
- Held finding (2026-11-11, DR1): three tier lists disagree (docs/book/vision.md §1a; `src/pcp.ts:230`–`236`; `src/totality.ts:500`). Held on the proofs, laws and termination decisions of Part IV.
- Held finding (2026-11-11, DR1): the keyword `proven` names a check made on four samples, and a `proven` clause is absent from the verdict, whose ledger then reads "all proofs rest on proven backing" (`lib/proven.alg:4`–`5`, `src/pcp.ts:1021`). Held on "Bounded sampling for universal claims".
- Held finding (2026-11-11, DR1): the safety grade reads `proven-safe` whenever nothing complained (`src/introspect.ts:496`–`504`); a verdict resting on sampled backing is headed "Verdict (verified)" (`src/pcp.ts:646`, `959`). Held on "Safety grade as the default verification surface" and "The verdict as accumulated metadata".
- Held finding (2026-11-12, DR4): the verdict is assembled by a walk of top-level bindings outside evaluation (`buildVerdict`), where the decision makes it the result's own metadata; and contracts that stay undecided reach `inspect` only, not the verdict or the record of assumptions. Formerly the entries "The verdict as accumulated metadata" and "Contracts in the verdict and the ledger".
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

### Values

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
- Chapter: Values

#### Seven representation kinds
- Decides: a value takes exactly one of seven kinds, fixed at construction: Bits, Symbol, Param, Expression, ComposedFunction, PrimitiveFunction, Structure. A kind says how a value is represented; types come from extensions, so a structure in the kernel carries no type.
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
- Notes (2026-11-11, DR2): ruled; each kind passes the kernel's criterion. Absorbs "Kind is a host discriminant, not a type". Carried forward to the open privacy question: a symbol is identified by name, and a name can be guessed.
- Chapter: Values

#### The kernel's plain data is a sequence of bits, and it computes nothing on them
- Decides: the kernel's one kind of plain data is a sequence of bits. The kernel can tell two sequences apart and does nothing else with them. What the bits mean, and every operation on them, comes from extensions and from capabilities.
- Status: partly built (arithmetic and the scalar encodings are kernel primitives today); ruled 2026-11-11 (DR2)
- Type: capability
- Rationale kind: technical
- Depends on: Seven representation kinds
- Significance: 4 — the smallest kernel that still holds data
- Label: foundational — every scalar type and every numeric operation is built above it
- Options recorded: machine arithmetic and comparison as kernel primitives (the review session's first draft; rejected by the maintainer: specific scalar representations and operations could, and some should, belong in extensions, and some operations will always be defined there); an integer, a float and a text encoding fixed in the kernel (what the code does today)
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr2-part-2-the-kernel.md, Rulings taken)
- Notes: replaces "Bits is the only scalar" and "Scalar encodings inside Bits". The 64-bit width, the IEEE float and the UTF-8 text encoding become choices of the standard language and of the arithmetic capability.
- Held finding (2026-11-11, DR2): arithmetic, comparison and the scalar encodings are base primitives (`src/primitives.ts`).
- Chapter: Values

#### One composite kind: Structure
- Decides: the kernel has one composite kind, Structure, the only kind with internal parts, used for records, arrays, types, proofs and module objects.
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
- Chapter: Values

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
- Chapter: Values

#### Arrays are structures with unkeyed entries
- Decides: an array is a Structure whose entries all carry a null key, with no separate vector kind and no references inside Bits. Nothing in the kernel tells an empty array from an empty record; that is a type's question.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: One composite kind: Structure; The kernel's plain data is a sequence of bits, and it computes nothing on them
- Significance: 2 — local to the structure unit
- Label: swappable — collection types choose representations above
- Units: structure
- Options recorded: a vector primitive (rejected); references inside Bits (rejected); a dense region as sole storage plus a lazily materialised legacy view (built, then deleted at B-120 E4)
- Sources: docs/decisions.md D9, D18, D48(a); docs/book/concepts.md §16, §17; docs/book/allegretto/structures.md §2
- Book home (fragments' proposal): allegretto/structures.md
- Notes: the collection half of D9 (encapsulated `Array[T]`, `Map`, `Set`) is open under B-041 and belongs to the L2 fragment.
- Chapter: Values

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
- Chapter: Values

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
- Chapter: Values

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
- Chapter: Values

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
- Chapter: Values

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
- Chapter: Values

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
- Chapter: Values

### Programs as values

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
- Chapter: Programs as values

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
- Chapter: Programs as values

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
- Chapter: Programs as values

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
- Chapter: Programs as values

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
- Chapter: Programs as values

### Authority

#### Authority is an unforgeable value
- Decides: the right to do something that not all code may do is a function value that cannot be forged or guessed: writing a metadata field, reading a private member, performing an effect. Any code that holds the value can use it, pass it on, or wrap it in a narrower one. Nothing is granted by name, or by the identity of whoever asks.
- Status: partly built; ruled 2026-11-11 (DR2)
- Type: capability
- Rationale kind: technical
- Depends on: Host code reaches a program only as primitive functions
- Significance: 5 — one idea for field writers, supplied capabilities and private access
- Label: foundational — proofs, effects, privacy and every field's writer rest on it
- Options recorded: authority by name or by the identity of the requester (rejected); three separate mechanisms for field writers, effects and member privacy (what the inventory listed)
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr2-part-2-the-kernel.md, Rulings taken)
- Notes: replaces "Metadata origination is capability-controlled"; "An extension registers its own fields; the kernel has two", "Authority is an unforgeable value" and, in Part IV, "Evidence is possession" are re-read as its instances. Open under it: privacy by possession of an unforgeable key, the working answer, analysed with "Who can see a member"; its first test is reflection, since every extension can read a value's source expression: what does an expression show of a key to code that does not hold it?
- Notes (2026-11-11, DR2, leftovers): absorbs "Writers are closures: delegable, attenuable, unforgeable". "Symbols serialise by FQN; deserialisation never mints reachability" moves to the privacy decision of Part IV ("Who can see a member"), as the pilot's review ruled: a symbol's wire form is its fully-qualified name, and reading one back never gives access to anything not exported.
- Chapter: Authority

#### Reading an expression never yields authority
- Decides: any code can read an expression's structure. Where the expression holds an unforgeable value, the reader sees which one it is and cannot obtain it. So a function that wraps a capability in a narrower one does not give the wider one away, and a key inside a function's body stays with the function.
- Status: open; ruled 2026-11-12 (DR4)
- Type: capability
- Rationale kind: technical
- Depends on: Authority is an unforgeable value; Expressions are values, forming a DAG; Functions are data: params plus body
- Significance: 5 — without it no capability can be narrowed and no key kept
- Label: foundational — effects, privacy and every field's writer
- Options recorded: a function's body closed to readers, opened by a key from its owner (rejected: analyses in extensions are functions evaluated over a program's expression)
- Sources: the maintainer's rulings of 2026-11-12 (../records/book-pass/dr4-part-4-the-standard-language.md, Rulings taken)
- Notes: new, by ruling, placed in Part II with the maintainer's agreement. It answers the question "Authority is an unforgeable value" left open: what an expression shows of a key to code that does not hold it. The same holds when an expression is reached through a value's origin.
- Chapter: Authority

#### A capability is granted, never acquired
- Decides: host code enters only through the configuration of a phase. An extension receives a capability only when the code using that extension passes it one. An extension cannot bring host code of its own, and cannot obtain a capability it was not handed.
- Status: open; ruled 2026-11-11 (DR2)
- Type: capability
- Rationale kind: technical
- Depends on: Authority is an unforgeable value; Host code reaches a program only as primitive functions
- Significance: 4 — no third-party extension installs anything transitively
- Label: foundational — the trust placed in every extension rests on it
- Options recorded: capabilities available to any code by name (rejected)
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr2-part-2-the-kernel.md, Rulings taken)
- Notes: new, by ruling; the first of the maintainer's two questions on making capability extensions trustworthy.
- Chapter: Authority

#### What code may do is bounded by the capabilities it is given, and that bound is a claim
- Decides: a program, a function or an extension can state which capabilities it uses. The kernel decides that claim like any other.
- Status: open; ruled 2026-11-11 (DR2)
- Type: capability
- Rationale kind: technical
- Depends on: A capability is granted, never acquired; Claims are evaluated like everything else
- Significance: 4 — what an extension is allowed to do is checked, not trusted
- Label: foundational — the effects decisions of Part IV are to be read as its instances
- Options recorded: effect labels as a separate system (to be re-read in Part IV: an effect label is the name of a capability that code can reach)
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr2-part-2-the-kernel.md, Rulings taken)
- Notes: new, by ruling.
- Chapter: Authority

#### A capability is supplied per target
- Decides: for each kind of phase, whoever supplies a capability gives either an implementation to run or code to emit. Exporting a program is a phase in which capabilities are emitted, not performed. The kernel's own primitives are translated in the same way.
- Status: open; ruled 2026-11-11 (DR2)
- Type: capability
- Rationale kind: technical
- Depends on: A capability is granted, never acquired; Phases are configuration
- Significance: 4 — how a program that uses capabilities becomes native code
- Label: foundational — every back end rests on it
- Options recorded: capabilities that exist only in the interpreter (rejected)
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr2-part-2-the-kernel.md, Rulings taken)
- Notes: new, by ruling; the second of the maintainer's two questions. To be placed with Part VI when that part is reviewed.
- Chapter: Authority

#### Machine arithmetic is a set of pure primitives that ships with the platform
- Decides: arithmetic and comparison on machine integers and floating-point numbers are pure primitive functions that ship with the platform and are supplied in every standard configuration, build phases included, so known values still fold. Being pure, they need no grant. A claim decided with their help names them.
- Status: open (to prove); ruled 2026-11-11 (DR2)
- Type: capability
- Rationale kind: technical
- Depends on: A capability is supplied per target; The kernel's plain data is a sequence of bits, and it computes nothing on them
- Significance: 4 — shrinks the kernel to what no capability could supply
- Label: swappable — another arithmetic can be supplied in its place
- Options recorded: machine arithmetic in the kernel (rejected, see the bits decision)
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr2-part-2-the-kernel.md, Rulings taken)
- Notes: new, by ruling. Two costs, stated: determinism rests on the assumption that a capability declared pure is pure; and optimizing arithmetic needs the capability's declared laws, so whether declared laws may license rewrites is no longer a detail of Part VI.
- Notes (2026-11-13, DR6): was "Machine arithmetic is a capability that ships with the platform": it performs no effect, so it is a set of pure primitives.
- Chapter: Authority

### Metadata

#### Metadata fields are independent
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
- Chapter: Metadata

#### Metadata is a field on every value
- Decides: every representation kind carries an optional `meta` map, so a typed `42` is a Bits with a `type` field, and attaching metadata yields a new value of the same kind.
- Status: settled
- Type: capability — metadata rides each occurrence of a value, which a program observes; concepts.md files the representation as implementation and its R3 entry (Metadata fields are independent) calls placement a specification choice
- Rationale kind: technical
- Depends on: Metadata fields are independent; Seven representation kinds
- Significance: 5 — every residual carries propagated fields this way
- Label: foundational — every metadata read and write and PE Rule 1's residual rest on it
- Units: metadata
- Options recorded: a transparent carrier Structure wrapping a non-composite value (D15/D46 option B, ratified then retired by measurement: 74% of structures were carriers, 98.5% with one field); a side table keyed by object (fails: metadata is per position, 33.6% of attachments target an already-annotated object); D46's own case against this option (no allocation saved, machinery smeared across shapes, function-identity hazards) is recorded and was overturned by the measurement
- Sources: docs/book/concepts.md IC-3, §10, §11; docs/decisions.md D10, D15, D17, D46, D48(b); docs/plans/metadata-on-values.md §1, §3; docs/plans/archive/structured-values-unification.md D46
- Book home (fragments' proposal): allegretto/metadata-and-capability.md §2
- Notes: D10, D15 and D17 are still marked "accepted (executed)" in decisions.md although D48(b) retired the carrier they describe; decisions.md records no supersession for them. Told in the tour.
- Chapter: Metadata

#### An extension registers its own fields; the kernel has two
- Decides: a metadata field is registered by the extension whose concept it holds, with the rule for how it travels. Only a field's owner can write it; any code can read it. A field has one owner: a second registration is a conflict. The kernel registers only two: the outcome of a claim, and a value's origin.
- Status: partly built; ruled 2026-11-11 (DR2)
- Type: capability
- Rationale kind: technical
- Depends on: Metadata fields are independent
- Significance: 4 — the kernel names no extension's concept
- Label: foundational — every field rests on it
- Options recorded: a fixed set of fields in the kernel (rejected); one registration for a group of fields, a channel (dropped with the term)
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr2-part-2-the-kernel.md, Rulings taken)
- Notes: replaces "Metadata fields registered with declared propagation rules" and "Each layer registers its own fields"; the open "Field versus channel, and channel registration" is removed, and "channel" is no longer a term: a field is a field.
- Held finding (2026-11-10, from the pilot's review §7 item 4): the ownership test names an owner file per field but only checks that each field is registered (`src/boundary-tests.ts:924`–`936`).
- Held finding (2026-11-11, DR2): the kernel registers `error`, `knowledge`, `warnings` and `exported` (`src/capability.ts:181`–`195`); the registration primitive is named `channel_register`.
- Notes (2026-11-11, DR2, leftovers): absorbs "Writes gated by a capability, reads free" and "One-shot field registration with a pass epoch".
- Held finding (2026-11-11, DR2): a second registration with the same rule in the same evaluation pass returns the held writer, a workaround for re-evaluation in the REPL.
- Chapter: Metadata

#### A field's rule is a pure, bounded function
- Decides: a rule computes a field's value on a result from the field's values on the function applied and on its arguments. It sees nothing else, performs no effect, and always finishes. For now a rule may not recurse, which the kernel can check by itself.
- Status: partly built; ruled 2026-11-11 (DR2)
- Type: capability
- Rationale kind: technical
- Depends on: An extension registers its own fields; the kernel has two; Authority is an unforgeable value
- Significance: 4 — the one place kernel evaluation runs an extension's code
- Label: foundational — every field registration rests on it
- Options recorded: a fixed vocabulary of five rules with owner-installed semantics (what the code does today; it becomes a library of common rules); general callbacks that take part in the evaluator's own work, with state or events (rejected: "a vampire is at the door asking to come in")
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr2-part-2-the-kernel.md, Rulings taken)
- Notes: replaces "Fixed propagation vocabulary". Purity follows from evaluating a rule with no capability supplied, and the kernel refuses a rule that holds one. The no-recursion form is relaxed only when a real rule needs more, with evidence.
- Held finding (2026-11-10, from the pilot's review §7 item 2): `channel_register` accepts any rule string; `channel_register("xq", "nonsense")` returns a writer and the field then behaves as `drop` (`src/capability.ts:56`).
- Notes (2026-11-11, DR2, leftovers): supersedes "How the base applies propagation".
- Held finding (2026-11-10, from the pilot's review §7 item 1): a second viral field erases the first: `viralOnto` returns at the first viral field it finds (`src/metadata.ts:331`–`347`).
- Chapter: Metadata

#### Every value keeps its origin
- Decides: the result of evaluating an expression carries that expression as metadata, and no later evaluation discards it. Each residual keeps a reference to the expression immediately before it, so every step of evaluation can be traced back to what was first written or constructed. What is known about an expression is found by evaluating it: each part of the result carries the fields derived so far, and its own origin.
- Status: partly built (to verify); ruled 2026-11-11 (DR2)
- Type: capability
- Rationale kind: technical
- Depends on: Expressions are values, forming a DAG; An extension registers its own fields; the kernel has two
- Significance: 4 — analyses, diagnostics and proof translation read it
- Label: foundational — every analysis of a program and every report about one rest on it
- Options recorded: attaching the expression on demand, at calls of functions that ask for it, and reading it under an `observe` effect (what the code does today; rejected: attach always and let partial evaluation drop what nothing reads)
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr2-part-2-the-kernel.md, Rulings taken)
- Notes: replaces "The source field: an expression as metadata". Only the kernel writes the record. Assumptions to verify, in the maintainer's words "all assumption": that keeping the origin is cheap apart from memory, that partial evaluation eliminates an origin nothing reads, and that every evaluation step preserves the link. The raw form will not be friendly to use; there is scope for a utility extension for querying and analysing origins.
- Held finding (2026-11-11, DR2): the `source` field is attached on demand and read under `observe` (`src/capability.ts:181`).
- Chapter: Metadata

#### Trust in a value needs no seal
- Decides: a value built by trusted code is trusted for three reasons already in the kernel: only the owner can write the field that marks it, values never change, and the field's rule cannot invent the mark on a new value. No separate sealing operation exists.
- Status: settled; ruled 2026-11-11 (DR2)
- Type: capability
- Rationale kind: technical
- Depends on: Structures immutable by default; derive, never mutate; An extension registers its own fields; the kernel has two; A field's rule is a pure, bounded function
- Significance: 3 — unforgeable proofs without a new mechanism
- Label: foundational — proof unforgeability rests on it
- Options recorded: a kernel operation that seals or brands a value (rejected)
- Sources: docs/decisions.md D21; the maintainer's rulings of 2026-11-11 (../records/book-pass/dr2-part-2-the-kernel.md, Rulings taken)
- Notes: replaces "No seal operation: constructor trust decomposes".
- Chapter: Metadata

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
- Chapter: Metadata

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
- Chapter: Metadata

### Evaluation

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
- Chapter: Evaluation

#### The environment is not a value
- Decides: names are resolved in an environment that the evaluator keeps and no program can hold, inspect or pass on. A program reaches only what it can name.
- Status: partly built (the code still represents a scope as a structure); ruled 2026-11-11 (DR2)
- Type: capability
- Rationale kind: technical
- Depends on: Authority is an unforgeable value; One value universe
- Significance: 4 — an environment holds every capability and key bound in it
- Label: foundational — the evaluator and every lookup rest on it
- Options recorded: the environment as a first-class value a program can hold (rejected for now: it would let a program enumerate and hand on by name everything bound in it)
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr2-part-2-the-kernel.md, Rulings taken); docs/book/concepts.md §15, §28
- Notes: replaces "Scope is the evaluation environment, not data" and "Scope leaves the value universe". Tabled by the maintainer, with no solid use case yet and an unknown effect on unforgeability: introspection of an environment, and a tool that translates one environment into another, without adding or forging capabilities, for a program that requires a specific one.
- Held finding (2026-11-11, DR2): a scope is a `StructureValue` with `isScope` (`src/scope.ts:36`), with five sites that exist to undo its valuehood.
- Chapter: Evaluation

#### A function may take an argument unevaluated
- Decides: a parameter can be declared to receive its argument as written: the expression itself, with nothing evaluated, together with the context it was written in, which the function cannot inspect. The function may read the expression, and may hand it back to the kernel to be evaluated in that context, whole, in part or transformed, with names rebound or capabilities withheld as it chooses. There is one unevaluated form; everything else about the argument is found by evaluating it.
- Status: open (use cases to work through); ruled 2026-11-11 (DR2)
- Type: capability
- Rationale kind: technical
- Depends on: Expressions are values, forming a DAG; The environment is not a value; Authority is an unforgeable value
- Significance: 4 — what lets control forms be built by extensions
- Label: foundational — `if` with branch knowledge, pattern matching and every analysis of an expression rest on it
- Options recorded: laziness as a privilege of kernel primitives (what the code does today); passing a partly evaluated form (not needed: the function asks the kernel to evaluate what it wants evaluated)
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr2-part-2-the-kernel.md, Rulings taken)
- Notes: new, by ruling; it replaces the `lazy` and `sourceAware` declarations of primitives. The declaration is a property of the parameter, since the kernel has no syntax. The maintainer: the function cannot know which other extensions are loaded, so that information is carried in the expression; here each part of an expression holds the function it applies, and the context stays with the expression. Use cases to work through: `if` with branch knowledge (first), pattern matching, `&&` and `||`, reading a function's body for termination, diagnostics that show an expression, rewriting by laws.
- Chapter: Evaluation

#### A call is evaluated by evaluating the function's body
- Decides: applying a function to arguments means evaluating its body with whatever is known about those arguments. The call survives into the residual only where the body cannot be reduced further. This holds across every boundary: a program's own functions, an extension's, another extension's.
- Status: partly built; ruled 2026-11-11 (DR2)
- Type: capability
- Rationale kind: technical
- Depends on: Evaluation is total over unresolved information; Functions are data: params plus body; No interface limits optimization
- Significance: 5 — what lets a check, a proof or an optimization see inside a call
- Label: foundational — every claim decided inside a call rests on it
- Options recorded: leaving a call as a residual behind its signature (rejected: it hides everything inside the callee); the two exceptions of the former rule, a recursion cycle during a typed compilation and a call inside a speculated `when` arm (replaced by the next decision and by sharing)
- Sources: docs/book/concepts.md §25; docs/plans/pe-rules.md §6; the maintainer's rulings of 2026-11-11 (../records/book-pass/dr2-part-2-the-kernel.md, Rulings taken)
- Notes: replaces "PE Rule 1: residualise, but unfold composed calls", without its exceptions.
- Chapter: Evaluation

#### A recursive call is evaluated once for each state of knowledge
- Decides: while evaluating a function's body, the evaluator may meet a call to the same function with the same information known about its arguments. It does not open that call again. The call stays in the residual, as a call to the function being evaluated. Claims stated about the function's result are assumed at that inner call and decided on the body.
- Status: open (a design to prove on real cases); ruled 2026-11-11 (DR2)
- Type: capability
- Rationale kind: technical
- Depends on: A call is evaluated by evaluating the function's body; Claims are evaluated like everything else
- Significance: 5 — where much of Allegro's potential is delivered
- Label: foundational — checking, proof and optimization of every recursive function rest on it
- Options recorded: residualising every call into a recursion cycle during a typed compilation (what the code does today); unfolding to a depth limit
- Sources: docs/book/concepts.md §25; docs/plans/pe-rules.md §6; the maintainer's rulings of 2026-11-11 (../records/book-pass/dr2-part-2-the-kernel.md, Rulings taken)
- Notes: new, by ruling; the principled replacement for both exceptions of the former rule. A state of knowledge at a call is everything the evaluator knows about its arguments, their values and their metadata. A recursive function needs a stated claim, or nothing is known at the inner call. Where the states of knowledge never repeat, evaluation reaches a resource limit and the outcome is undecided. The maintainer: recursion "will be where we deliver a lot of Allegro's potential"; it will likely need a whole section. Read with B-180 (recursion handling under partial evaluation).
- Held finding (2026-11-11, DR2): the recursion cutoff residualises by rule of thumb and names typed compilation (`src/evaluator.ts`, the inline cutoff; docs/book/concepts.md §25).
- Chapter: Evaluation

#### A branch that may not be taken is evaluated without capabilities
- Decides: when a condition cannot be decided, both branches are still evaluated, so that what is true on either path is still discovered. Neither branch is given any capability, so any effect it reaches stays in the residual. The kernel has one conditional; every other branching form is built on it by an extension.
- Status: partly built; ruled 2026-11-11 (DR2)
- Type: capability
- Rationale kind: technical
- Depends on: A call is evaluated by evaluating the function's body; Phases are configuration; Authority is an unforgeable value
- Significance: 4 — an unknown condition hides nothing behind it
- Label: foundational — effect inference and every check through a branch rest on it
- Options recorded: a scope marked as compile mode (what the code does today); several lazy primitives in the kernel, `eval_when`, `&&` and `||` among them (rejected: one conditional, the rest by extension)
- Sources: docs/book/concepts.md §25; docs/plans/pe-rules.md §6; the maintainer's rulings of 2026-11-11 (../records/book-pass/dr2-part-2-the-kernel.md, Rulings taken)
- Notes: replaces "PE Rule 2: speculate every branch, run no effect". Growth under nested conditions is bounded by sharing equal sub-evaluations, since expressions form a shared graph, and by resource limits, not by an exception.
- Held finding (2026-11-11, DR2): `eval_when`, `&&` and `||` are kernel primitives with their own speculation (`src/evaluator.ts`, `src/primitives.ts`), and speculation runs in a scope flagged `compileMode`. Held here and on the pattern-matching decisions of Part IV.
- Chapter: Evaluation

#### A missing value is a cell that is filled once
- Decides: a structure is always complete in shape. What may be missing is a value in one of its places: a cell, filled exactly once and never changed. A capability a phase is not given, and an input not yet supplied, are cells too.
- Status: settled; ruled 2026-11-11 (DR2)
- Type: capability
- Rationale kind: technical
- Depends on: Evaluation is total over unresolved information; Phases are configuration
- Significance: 4 — one representation for everything not yet known
- Label: foundational — completion, later phases and asynchronous results rest on it
- Options recorded: incompleteness as a state of a structure (rejected)
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr2-part-2-the-kernel.md, Rulings taken); docs/book/concepts.md §15, §28
- Notes: replaces "Incompleteness lives in write-once future cells" and absorbs "One residualising resolution semantics for scopes": a declared name with no value yet is such a cell, and a name nothing declares is a refutation. The maintainer doubted that a name without a value arises apart from these cases; it does not, so it is not a decision of its own.
- Chapter: Evaluation

#### When information arrives, what waited on it is evaluated again
- Decides: everything left in the residual because of a missing value is evaluated again when the value arrives, within a phase or in a later one. The step from one phase to the next is the same event.
- Status: settled; ruled 2026-11-11 (DR2)
- Type: capability
- Rationale kind: technical
- Depends on: A missing value is a cell that is filled once
- Significance: 4 — how later information re-enters an evaluation
- Label: foundational — module loading, asynchronous results and phases rest on it
- Options recorded: a single pass, leaving anything unknown permanently residual (rejected)
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr2-part-2-the-kernel.md, Rulings taken); docs/book/concepts.md §15, §28
- Notes: replaces "Evaluation resumes on new information by forward chaining".
- Chapter: Evaluation

#### The same program and the same information give the same result
- Decides: neither the order in which information arrives nor the order in which independent parts are evaluated can change the outcome of an evaluation.
- Status: to prove; ruled 2026-11-11 (DR2)
- Type: capability
- Rationale kind: technical
- Depends on: When information arrives, what waited on it is evaluated again; Order of definition carries no meaning
- Significance: 5 — order-free definitions and replayable evaluation both need it
- Label: foundational — translation of proofs and every re-check rest on it
- Options recorded: leaving it open (rejected: determinism is built in)
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr2-part-2-the-kernel.md, Rulings taken); docs/book/concepts.md §15, §28
- Notes: replaces "Determinism and confluence of evaluation", which was open. It holds only if every cell is filled exactly once.
- Chapter: Evaluation

#### Scopes layer by parent chain
- Decides: extending a scope is O(1) and does not copy; lookup walks the parent chain.
- Status: settled
- Type: implementation — concepts.md files it as an implementation choice
- Rationale kind: technical
- Depends on: The environment is not a value
- Significance: 2 — cost of the operation PE performs most
- Label: swappable — inside the scope unit
- Units: scope
- Options recorded: flatten-copy on extend (the prior implementation)
- Sources: docs/book/concepts.md IC-5; docs/decisions.md D26; docs/plans/archive/structured-values-unification.md B5
- Book home (fragments' proposal): scope chapter (planned)
- Chapter: Evaluation

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
- Chapter: Evaluation

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
- Chapter: Evaluation

### Extensions

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
- Chapter: Extensions

#### The kernel's primitives are pure and few
- Decides: the kernel's primitives cover six things: telling bits apart; building and reading structures and expressions; one conditional; evaluating an expression with names rebound; registering a metadata field; evaluating a claim. None performs an effect. An effect is always a capability.
- Status: partly built; ruled 2026-11-11 (DR2)
- Type: capability
- Rationale kind: technical
- Depends on: The kernel contains only what no extension could supply; Seven representation kinds
- Significance: 4 — the whole of what the kernel computes
- Label: foundational — every extension is built from these
- Options recorded: a target of about forty primitives (dropped: the criterion decides the count); primitives that declare the effects they produce (rejected: every primitive is pure)
- Sources: the maintainer's rulings of 2026-11-11 (../records/book-pass/dr2-part-2-the-kernel.md, Rulings taken)
- Notes: replaces "Minimal base surface of about forty primitives" and "Host functions as values with declared evaluation control"; "Primitives receive full values" is a rule of the kernel's own code under it.
- Held finding (2026-11-11, DR1 and DR2): 178 primitives in one table, 54 of them the standard language's, `print` and other effects among them (`src/primitives.ts:4509` onward).
- Notes (2026-11-11, DR2, leftovers): "Primitives receive full values" is a rule of the kernel's own code: a primitive receives its arguments with their metadata intact.
- Notes (2026-11-12, DR4): truth. The kernel recognises two bit values as true and false; a conditional or a claim on anything else is a refutation. The standard language's Bool is those two values with a type, so the kernel's notion of true depends on no extension.
- Notes (2026-11-13, DR6): terms. A kernel primitive is one of these; a primitive function is any function whose body is host code. The primitive for evaluating an expression with names rebound can supply the complete set of names, so that Allegro code, the module loader first, can evaluate a module in a scope that holds only what it is given.
- Chapter: Extensions

#### What the kernel requires of an extension
- Decides: an extension reaches the kernel as expressions and named values; the kernel reads no text and no files. A configuration names the extensions an evaluation starts with and the capabilities it supplies. At startup the kernel has its primitives and nothing else; it evaluates the configuration's extensions in the order their dependencies require. An extension is evaluated once in a configuration, and everything that names it gets the same values. Parsing, loading and every other service come from those extensions.
- Status: open (the code builds its extensions in host code and caches a loaded library per process); ruled 2026-11-12 (DR3)
- Type: capability
- Rationale kind: technical
- Depends on: An extension is made of functions and metadata fields; The kernel's primitives are pure and few; A capability is granted, never acquired; An extension registers its own fields; the kernel has two; The kernel holds no language
- Significance: 5 — how anything above the kernel comes to exist
- Label: foundational — parsing, modules and every language start from it
- Options recorded: a kernel that reads text or files itself (rejected: the kernel holds no language, and the mechanism is kept as simple as possible so that more sophisticated mechanisms are loaded as extensions); evaluating an extension once for each module that names it (rejected: a field is registered once and unforgeable values are told apart by identity)
- Sources: the maintainer's rulings of 2026-11-12 (../records/book-pass/dr3-part-3-syntax-and-modules.md, Rulings taken); docs/book/extension/modules.md "Loading (L1)", "Loaded once per process"
- Notes: new, by ruling; placed in Part II with the maintainer's approval. These are requirements; the maintainer expects more detail on configuration and the startup process to be needed. Absorbs the load-once clause of "Module resolution, caching and the session's runtime" and the kernel's half of "A module is an extension that arrives as a file" (named values a configuration hands to an evaluation).
- Held finding (2026-11-12, DR3): the load-once cache is keyed by resolved path and content for one process (`src/modules.ts`), a cache where the decision needs an identity for one configuration.
- Notes (2026-11-13, DR6): the kernel is passive (Part VI): the launcher, or Allegro code it starts, orders and evaluates the configuration's extensions through the kernel's interface; the kernel itself knows nothing of configuration. "Once in a configuration" reads as once in a kernel.
- Chapter: Extensions

### Correctness

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
- Chapter: Correctness

#### A refutation marks everything computed from it
- Decides: when a program is wrong, the kernel records a refutation on the value concerned. A program can be wrong through a false claim, a call on something that is not a function, a name that nothing declares, or two definitions that conflict. Every value computed from a refuted value is refuted too. No code can remove the mark, test for it and carry on, or write it itself.
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
- Chapter: Correctness

#### A refutation on a path that may be taken refutes the program
- Decides: if a claim is refuted in a branch whose condition cannot be decided, the program is wrong, unless what is known already rules that branch out. A program that means to handle the bad case uses a handled failure.
- Status: partly built; ruled 2026-11-11 (DR2)
- Type: capability
- Rationale kind: technical
- Depends on: A branch that may not be taken is evaluated without capabilities; A refutation marks everything computed from it
- Significance: 4 — a provably failing path is a mistake, however rarely taken
- Label: foundational — every check of a function with a branch rests on it
- Options recorded: leaving the refutation conditional until the condition is known (rejected: a function with a failing path would pass until run on the bad input)
- Sources: docs/book/concepts.md §25; docs/plans/pe-rules.md §6; the maintainer's rulings of 2026-11-11 (../records/book-pass/dr2-part-2-the-kernel.md, Rulings taken)
- Notes: new, by ruling.
- Chapter: Correctness

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
- Chapter: Correctness

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
- Chapter: Correctness

### Parsing

#### Parsing is evaluation
- Decides: a parser is a function from a grammar and a text to an expression. A text that does not parse is a refutation.
- Status: open (the engine is host code called by a fixed pipeline); ruled 2026-11-12 (DR3)
- Type: capability
- Rationale kind: technical
- Depends on: One operation: partial evaluation; The kernel holds no language; Expressions are values, forming a DAG; A refutation marks everything computed from it
- Significance: 5 — places every notation inside the one operation
- Label: foundational — every decision of Part III
- Options recorded: parsing as a stage before evaluation, outside it (what the code does; rejected: the kernel holds no language and has one operation)
- Sources: the maintainer's rulings of 2026-11-12 (../records/book-pass/dr3-part-3-syntax-and-modules.md, Rulings taken)
- Notes: new, by ruling. When a parser runs follows from the partial-evaluation decisions: a text that is known is parsed, and a text or grammar that is missing leaves a residual.
- Held finding (2026-11-12, DR3): parsing is a host stage: the engine is TypeScript (`src/grammar2/engine.ts`) and no Allegro function parses a program's text.
- Chapter: Parsing

#### No parser is privileged
- Decides: a parser is an ordinary extension. A configuration may hold several and may replace the one the platform ships.
- Status: open; ruled 2026-11-12 (DR3)
- Type: capability
- Rationale kind: technical
- Depends on: Parsing is evaluation; What the kernel requires of an extension; Everything above the kernel is an extension, and there is one way to extend
- Significance: 4 — keeps notation out of the trusted base
- Label: foundational — a language may bring its own parser
- Options recorded: one parser built into the platform (what the code does)
- Sources: the maintainer's rulings of 2026-11-12 (../records/book-pass/dr3-part-3-syntax-and-modules.md, Rulings taken)
- Notes: new, by ruling. The maintainer: "There's nothing privileged about the bootstrap parser we provide."
- Chapter: Parsing

#### Grammars are values
- Decides: a grammar is an ordinary structure: named productions over a small set of rule forms (terminal, reference, sequence, alternatives, repetition, option, guard) and a start symbol. It is built, combined and analysed like any other value, and the kernel knows nothing about it.
- Status: settled; reworded 2026-11-12 (DR3)
- Type: capability
- Rationale kind: technical
- Depends on: One composite kind: Structure; The kernel holds no language; An extension is made of functions and metadata fields
- Significance: 4 — grammar change, combination and analysis all operate on grammar values
- Label: foundational — every decision on changing a grammar
- Units: grammar-formalism
- Options recorded: none recorded (the Pratt and Earley hybrid it replaced is noted as superseded); a grammar as a third kind of extension item beside functions and fields (rejected 2026-11-12: to the kernel a grammar definition is a value)
- Sources: docs/book/grammar-formalism.md §1, §2, §9, §6; docs/book/extension/grammar.md §1; the maintainer's rulings of 2026-11-12 (../records/book-pass/dr3-part-3-syntax-and-modules.md, Rulings taken)
- Notes: was "Grammars are Allegro values", stated as an Object over a `Rule` union: terms of the typed language, which comes later in the order.
- Chapter: Parsing

#### Every notation stands for an expression
- Decides: a grammar form maps what it matched to an expression and does nothing else. Free names in that expression mean what they meant where the form was defined, never what they mean where the form is used.
- Status: partly built (the forms of the `grammar { … }` block do this; the base grammar does not); ruled 2026-11-12 (DR3)
- Type: capability
- Rationale kind: technical
- Depends on: Meaning comes before notation; Grammars are values; Symbol identity is a fully-qualified name
- Significance: 5 — what a notation can and cannot do
- Label: foundational — a notation can change without changing what any program means
- Units: grammar-extension, tree-builder
- Options recorded: builder functions that run arbitrary code during the parse (deferred in the sources); names captured where the form is used (an earlier state, replaced)
- Sources: docs/book/grammar-formalism.md §6.4; docs/book/extension/grammar.md §4; the maintainer's rulings of 2026-11-12 (../records/book-pass/dr3-part-3-syntax-and-modules.md, Rulings taken)
- Notes: new, by ruling: "Meaning comes before notation" made concrete. A form that changes the grammar is no exception: its expression's value is the new grammar ("A text can change the grammar it is read in"). Absorbs the hygiene clause of "The `grammar { … }` block".
- Held finding (2026-11-12, DR3): the base grammar's trees are turned into expressions by host code (`src/grammar2/tree-builder.ts`), which can do what no form's expression can.
- Chapter: Parsing

#### The `grammar { … }` block
- Decides: a grammar is written declaratively: operator clauses (`infix`, `prefix`, `postfix`), rule clauses that define, extend or remove a production, and form clauses whose body names the parts it matches and gives the expression they stand for. Whitespace is allowed between the items of a sequence unless a rule says otherwise, and the text a named part matched is available as a string.
- Status: settled; reworded 2026-11-12 (DR3)
- Type: capability
- Rationale kind: mixed
- Depends on: Every notation stands for an expression; Grammars are values
- Significance: 3 — the notation in which notations are written
- Label: swappable — another notation for grammars could map to the same grammar values
- Units: grammar-extension, tree-builder
- Options recorded: arbitrary builder functions (deferred); an offside form of the block; splicing a new expression form after the identifier fallthrough (rejected: number-led forms were dead code); a named part's match as a length-typed bits value (rejected: an eight-byte match read as an integer)
- Sources: docs/book/grammar-formalism.md §6.4; docs/book/extension/grammar.md §4; archive dappled-cascading-cantor.md "Design summary", "Scope boundaries"; B-092 U2 and B-151 B1 (docs/book/extension/grammar.md §4)
- Notes: absorbs "Rules for user-written EBNF". The maintainer: all extensions are declarative.
- Held finding (2026-11-12, DR3): new expression forms are spliced at the front of the atom production, which works only because the engine tries alternatives in order.
- Chapter: Parsing

#### A parser records where each expression came from in its text
- Decides: the position of an expression in its source text is a metadata field the parser's extension registers and writes. The kernel does not know about it. The parse tree stays internal to the parser.
- Status: open; ruled 2026-11-12 (DR3)
- Type: capability
- Rationale kind: technical
- Depends on: Parsing is evaluation; An extension registers its own fields; the kernel has two; Every value keeps its origin
- Significance: 3 — every diagnostic that points into a text rests on it
- Label: swappable — a parser may record more or less
- Options recorded: the kernel recording source positions in its own origin field (rejected: "Source attachment is not a promise the kernel needs to know about")
- Sources: the maintainer's rulings of 2026-11-12 (../records/book-pass/dr3-part-3-syntax-and-modules.md, Rulings taken)
- Notes: new, by ruling. Two fields: the kernel's origin field holds the expression an expression came from; the parser's field holds a parsed expression's source information. Following the origin chain to its end reaches an expression that carries the parser's field.
- Chapter: Parsing

#### Scannerless parsing
- Decides: a grammar reads characters directly; there is no tokenizer. Whitespace is written in the grammar, and keywords and identifiers share one character space.
- Status: settled
- Type: capability — grammar authors write character-level rules
- Rationale kind: technical
- Depends on: Grammars are values
- Significance: 3 — two languages' tokens cannot clash when there are no tokens
- Label: swappable — a tokenizer could be added beneath grammars that want one
- Units: grammar-formalism
- Options recorded: a tokenizer layer, kept as the known optimization "if larger files demand it" (benchmark first); an external LL(k) and Pratt experiment, deferred
- Sources: docs/book/grammar-formalism.md §1, §4; docs/book/extension/grammar.md §3 "Performance headroom"
- Chapter: Parsing

#### A terminal is a function, so a grammar can define its own
- Decides: a terminal is a function from the parser's position and state to a match or a failure. The terminals the engine's package ships, those for indentation among them, have no special standing.
- Status: open (terminals are cases of the host engine); ruled 2026-11-12 (DR3)
- Type: capability
- Rationale kind: technical
- Depends on: Grammars are values; No parser is privileged; Functions are data: params plus body
- Significance: 3 — what a grammar can recognise is not fixed by the engine
- Label: foundational — layout-sensitive notations and any terminal an extension needs
- Options recorded: terminals built into the engine, with no way for an extension to add one that carries state (what the code does; simpler, and it gives the shipped engine a standing no extension has)
- Sources: the maintainer's rulings of 2026-11-12 (../records/book-pass/dr3-part-3-syntax-and-modules.md, Rulings taken)
- Notes: new, by ruling.
- Held finding (2026-11-12, DR3): the terminals are a closed set implemented in the engine (`src/grammar2/engine.ts`).
- Chapter: Parsing

#### Offside rule through stateful indent terminals
- Decides: indentation is expressed by four terminals, `NEWLINE`, `INDENT`, `DEDENT` and `SAMELINE`, over a parser state of offset and indent stack. `NEWLINE` matches only when the next content is at or below the block's indent, so a continuation line needs no construct of its own.
- Status: partly built
- Type: capability — grammar authors name the indent terminals in their rules
- Rationale kind: technical
- Depends on: A terminal is a function, so a grammar can define its own; Scannerless parsing
- Significance: 3 — offside-rule notations and mixed modes rest on it
- Label: swappable — another set of layout terminals could be defined beside it
- Units: grammar-formalism
- Options recorded: a dedicated continuation construct (rejected); tab handling proposals (tabs forbidden by default, `tab_width` opt-in)
- Sources: docs/book/grammar-formalism.md §5.1–§5.5; docs/book/extension/grammar.md §3
- Notes: `SAMELINE` is not implemented (`src/grammar2/engine.ts:712`); the tab and empty-stack questions of docs/book/grammar-formalism.md §5.4 are "Proposed", not recorded as decided.
- Chapter: Parsing

#### Guards and reserved words separate keywords from identifiers
- Decides: zero-width guards (not followed by, followed by, reserved) and named, cumulative sets of reserved words keep keywords out of identifiers.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Scannerless parsing
- Significance: 2 — every keyword a grammar adds faces the same choice
- Label: swappable — local to how a grammar tells a keyword from a name
- Units: grammar-formalism, base-grammar
- Options recorded: reserving `left`, `right` and `none` only inside a `grammar { … }` block, to revisit if the global reservation breaks user code
- Sources: docs/book/grammar-formalism.md §2.4, §3.3, §4.1, §11 item 3; docs/book/extension/grammar.md §4
- Notes: `left`, `right` and `none` are reserved everywhere "for simplicity": a wart, since three words of the grammar notation are taken from every program.
- Chapter: Parsing

#### Named, partially ordered precedence levels
- Decides: precedence levels are named and related by before and after constraints. A constraint on one side is enough wherever it settles every case that arises, and no numbers appear.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Grammars are values; Order of definition carries no meaning
- Significance: 3 — independent libraries can each add operators
- Label: swappable — the means of stating precedence, not the fact of it
- Units: grammar-formalism, grammar-extension
- Options recorded: integer precedence (rejected); requiring a total order (rejected in favour of "specify what you know")
- Sources: docs/book/grammar-formalism.md §3.1, §7.3, §11 item 4; §6.4; archive dappled-cascading-cantor.md "Inside the block"
- Notes: the error for constraints that leave a case unsettled is specified and not shipped (docs/book/grammar-formalism.md §7.5); only the cycle error ships.
- Chapter: Parsing

#### Ambiguity is a claim
- Decides: "this grammar is unambiguous" is a claim, decided, refuted or left undecided like any other. A text with two parses is a refutation. Precedence levels and longest match are the author's means of removing ambiguity; the order of alternatives is not one. The analyses of a grammar (what can match nothing, what is unreachable, what recurses on the left) are ordinary functions over the grammar value.
- Status: open (the shipped engine resolves ambiguity by the order of alternatives); ruled 2026-11-12 (DR3)
- Type: capability
- Rationale kind: technical
- Depends on: Claims are evaluated like everything else; Grammars are values; Order of definition carries no meaning; Named, partially ordered precedence levels
- Significance: 4 — whether a notation can mean two things silently
- Label: foundational — combining grammars from independent authors
- Units: grammar-formalism, base-grammar
- Options recorded: ordered choice as shipped (the order of alternatives decides); ambiguity as an error of a compile step (the sources' wording; there is no such step, and the general question is undecidable, so a claim with three outcomes is the honest form)
- Sources: docs/book/grammar-formalism.md §1, §3.1, §7.1–§7.5, §11 item 5; docs/book/extension/grammar.md §2 (maintainer ruling 2026-06, "under revision"); the maintainer's rulings of 2026-11-12 (../records/book-pass/dr3-part-3-syntax-and-modules.md, Rulings taken)
- Notes: replaces "Ambiguity is banned and detected, not resolved by alternative order" and absorbs "Static analysis of grammars". FIRST-set completion is an open gap of the analyses.
- Held finding (2026-11-12, DR3): the disjointness check is opt-in because the base grammar relies on the order of its alternatives (`analyzeWithDisjointnessCheck`, `src/grammar2/analyzer.ts`).
- Chapter: Parsing

#### Parse failure reporting and recovery
- Decides: a failed parse reports the farthest point reached, with what was expected and what was found. Error productions and declared recovery points let one parse report several failures.
- Status: partly built
- Type: capability
- Rationale kind: technical
- Depends on: Parsing is evaluation; Claims are evaluated like everything else
- Significance: 2 — what a reader of a failed parse sees
- Label: swappable — reporting can improve without changing any grammar
- Units: grammar-formalism
- Options recorded: recovery as optional (rejected: "core feature, not optional")
- Sources: docs/book/grammar-formalism.md §3.5, §8.2–§8.4, §11 item 6; docs/book/extension/grammar.md §3 (gaps)
- Notes: the farthest-point report ships; error productions and recovery points do not. Reporting several failures from one parse is the parser's case of evaluation continuing on independent expressions after a refutation.
- Chapter: Parsing

### Changing the grammar

#### A text can change the grammar it is read in
- Decides: a form can replace or augment the grammar at the point where it appears, and the text after it is read in the new grammar. The form stands for an expression; the parser evaluates it at once and its value is the new grammar, so parsing and evaluation interleave. Such a form is defined by a grammar like any other, so a language can define its own. No text is scanned ahead of its parse.
- Status: open (the code scans a header ahead of the parse and fixes the grammar for the whole file); ruled 2026-11-12 (DR3)
- Type: capability
- Rationale kind: technical
- Depends on: Parsing is evaluation; Every notation stands for an expression; Grammars are values; A system is described in the language of its domain, and that language grows with the understanding
- Significance: 5 — how a program comes to be written in a language of its own
- Label: foundational — every notation beyond the first
- Units: grammar-extension, module-loading
- Options recorded: scanning the text for declarations before parsing it (what the code does, so that it can use a simple parser; rejected: a declaration may appear part way through, and grammars define their own forms of the kind); a declaration naming a grammar expression from a fixed list of combinators (never shipped)
- Sources: docs/book/grammar-formalism.md §6.2, §6.3; docs/book/extension/grammar.md §4; the maintainer's rulings of 2026-11-12 (../records/book-pass/dr3-part-3-syntax-and-modules.md, Rulings taken)
- Notes: new, by ruling; replaces the header half of "`use` header for language extension, `import` for module values" and "Callers pre-scan and strip the `use` header". The maintainer: "our parser starts with an initial grammar and modifies it (augmenting or replacing) at a specific point in the parse, so all following text is parsed with the modified grammar"; it needs a custom engine, and there is prior art to lean on (Lean 4 and SugarJ read a text one item at a time and let an item extend the grammar). If the grammar is not yet available, the rest of the text stays unparsed, as a residual. A changed grammar is a new value; the grammar it came from is untouched (absorbs "Grammar extension never mutates the base").
- Held finding (2026-11-12, DR3): every caller scans the header itself and strips it before the parse (`src/use-scanner.ts:47`; `src/index.ts:131`, `:385`, `:442`; `web/allegro-web.ts:38`), and the callers disagree: inspect and verify load no module for a member import or an inline grammar, `prove` leaves the header in place and fails, the sandbox has its own scanner.
- Held finding (2026-11-12, DR3): an inline grammar inside a library is rejected.
- Chapter: Changing the grammar

#### Every production can be extended
- Decides: a change to a grammar is a set of operations on named productions: add one, append an alternative, replace, remove, wrap. Every production is open to them; none must be marked extensible.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Grammars are values; A text can change the grammar it is read in
- Significance: 3 — the one mechanism every change of notation is expressed in
- Label: swappable — the set of operations could differ
- Units: grammar-extension
- Options recorded: a gate marking which productions may be extended (rejected); a future opt-out to freeze whitespace and core terminals; selecting an alternative by position (allowed, discouraged)
- Sources: docs/book/grammar-formalism.md §6, §6.1, §11 items 1–2
- Notes: was "Grammar extension as operation deltas, extensible by default".
- Chapter: Changing the grammar

#### Grammars combine without regard to order
- Decides: two changes to a grammar give the same language in either order, or they conflict, and a conflict is a refutation raised before any text is read in the combined grammar. Adding a form is always allowed. Replacing or removing another grammar's form is explicit and names what it replaces.
- Status: partly built (conflicts between operators, keywords and precedence are found before use; a replacement only warns); ruled 2026-11-12 (DR3)
- Type: capability
- Rationale kind: technical
- Depends on: Order of definition carries no meaning; Every production can be extended; Ambiguity is a claim
- Significance: 4 — independent notations can be used together
- Label: foundational — a program written in several languages at once
- Units: grammar-extension
- Options recorded: replacement as an error (rejected in the sources: replacement is a legitimate technique); replacement with a warning (what the code does; rejected under "Order of definition carries no meaning", where replacing is explicit); grammars that combine only when one's chain of bases is a prefix of the other's (what the code requires today)
- Sources: W_PRODUCTION_REPLACED ruling (docs/decisions.md "Standing rulings"); docs/book/extension/grammar.md §4; docs/book/grammar-formalism.md §7.5; docs/book/extension/README.md "Invariants"; the maintainer's rulings of 2026-11-12 (../records/book-pass/dr3-part-3-syntax-and-modules.md, Rulings taken)
- Notes: replaces "Conflicts are validated before activation".
- Held finding (2026-11-12, DR3): replacing a production of the base only warns (`src/grammar2/fragments.ts:154`–`165`).
- Held finding (2026-11-12, DR3): an appended alternative and a form spliced at the front take their meaning from their position among the alternatives.
- Chapter: Changing the grammar

#### A grammar change reaches to the end of its block
- Decides: a change made inside a block ends with the block; a change at the top of a text ends with the text. It never reaches another text: importing a module's bindings does not bring its notation, and a module does not pass a notation on to those that import it.
- Status: partly built (a change holds for one file and is not passed on; a change local to a block is not built); ruled 2026-11-12 (DR3)
- Type: capability
- Rationale kind: technical
- Depends on: A text can change the grammar it is read in
- Significance: 3 — a reader of a text can see which language each part is in
- Label: foundational — notations stay local to the text that asks for them
- Units: grammar-extension, module-loading
- Options recorded: a change reaching always to the end of the text; modules passing a grammar on explicitly
- Sources: docs/book/grammar-formalism.md §6.2, §6.3; docs/book/extension/grammar.md §4; docs/book/extension/modules.md "Known limit"; the maintainer's rulings of 2026-11-12 (../records/book-pass/dr3-part-3-syntax-and-modules.md, Rulings taken)
- Notes: replaces "Activation by a `use` header, per file and not transitive".
- Chapter: Changing the grammar

### The parser engine

#### Any parsing algorithm will do that meets five conditions
- Decides: the algorithm is free. It must accept left recursion; give no meaning to the order of alternatives; report every parse of a text; settle the parse up to each change of grammar; and carry a state through the parse beside the position.
- Status: open (the shipped engine meets the first and the last); ruled 2026-11-12 (DR3)
- Type: capability — the conditions are what a grammar author may rely on
- Rationale kind: technical
- Depends on: Ambiguity is a claim; A text can change the grammar it is read in; A terminal is a function, so a grammar can define its own; Scannerless parsing
- Significance: 3 — which grammars run, and what they may assume
- Label: swappable — the algorithm, within the conditions
- Units: grammar-formalism
- Options recorded: GLL (the specification's stated choice); the shipped engine: recursive descent with memoization, ordered choice and left recursion by growing a seed (Warth, Douglass and Millstein 2008); the retired Pratt and Earley hybrid
- Sources: docs/book/grammar-formalism.md status header, §1 non-goals, §5.1, §7.1; docs/book/extension/grammar.md §1, §3; B-157 P7 and P5 (docs/book/extension/grammar.md §1); the maintainer's rulings of 2026-11-12 (../records/book-pass/dr3-part-3-syntax-and-modules.md, Rulings taken)
- Notes: replaces "Memoized recursive-descent engine with seed-growing left recursion" and "The precedence ladder runs as repetition, and memo invalidation tracks dependencies", which describe the shipped engine and stop being decisions. The sources disagree on the algorithm (docs/book/grammar-formalism.md §1 says GLL is chosen; docs/book/extension/grammar.md §1 and §4 describe ordered choice); the maintainer: the algorithm stays swappable and ordered choice must not be required. The Earley parser (`src/parser.ts`, `src/grammar-ext.ts`) remains only for the standalone combinators.
- Held finding (2026-11-12, DR3): the engine commits to the first alternative that matches (`matchAlt`, `src/grammar2/engine.ts:945`), reports one parse, and cannot change grammar during a parse.
- Chapter: The parser engine

#### The platform's parser engine ships already built
- Decides: the engine the platform ships is written in Allegro and delivered as expressions, with its inbuilt grammar definitions as data, so that nothing has to be parsed before a parser exists. There is no parser generator: a parser for one grammar is the engine partially evaluated over that grammar.
- Status: open (the engine is host code); ruled 2026-11-12 (DR3)
- Type: implementation — how "No parser is privileged" is realised for the first parser
- Rationale kind: technical
- Depends on: No parser is privileged; What the kernel requires of an extension; No interface limits optimization; Any parsing algorithm will do that meets five conditions
- Significance: 3 — how the first notation arrives
- Label: swappable — a platform may start from another engine
- Options recorded: a host-code parser supplied as a capability, used to parse an engine written in Allegro (considered 2026-11-12; set aside for expressions built ahead of time); a separate parser generator (not needed: partial evaluation of the engine over a grammar is one)
- Sources: the maintainer's rulings of 2026-11-12 (../records/book-pass/dr3-part-3-syntax-and-modules.md, Rulings taken)
- Notes: new, by ruling. The maintainer: extensions delivered as built expressions should be allowed, to make bootstrapping efficient.
- Held finding (2026-11-12, DR3): the engine, the base grammar and the tree builder are TypeScript (`src/grammar2/`).
- Notes (2026-11-13, DR6): it ships as a saved program (Part VI).
- Chapter: The parser engine

### Modules and programs

#### A module is an extension that arrives as a file
- Decides: the module loader is itself an extension: it finds a file, has it parsed, evaluates it and yields an extension. A module refers to another module's bindings by naming the module; the values are handed to it, never fetched at the place of use. Importing bindings and changing the grammar a text is read in are two separate things a file can ask for. A program's main file is loaded as a module, by the same loader.
- Status: partly built (modules load from files and bindings are handed in; the loader is host code); ruled 2026-11-12 (DR3)
- Type: capability
- Rationale kind: technical
- Depends on: What the kernel requires of an extension; Parsing is evaluation; A capability is granted, never acquired; A text can change the grammar it is read in
- Significance: 4 — how a program is made of parts
- Label: foundational — libraries, the standard language and every program's main file
- Units: module-loading
- Options recorded: the keywords for the two cases (`use` and `import` today; the choice of keywords is implementation only); loading at the place of use (rejected in the sources)
- Sources: docs/book/extension/modules.md "Loading (L1)", Import syntax; docs/book/extension/README.md "Provides"; docs/book/grammar-formalism.md §6.2; the maintainer's rulings of 2026-11-12 (../records/book-pass/dr3-part-3-syntax-and-modules.md, Rulings taken)
- Notes: replaces "Extensions are the module substrate" and the import half of "`use` header for language extension, `import` for module values". The maintainer: a module is an extension, with the same interface; the kinds of artifact differ because the kernel's mechanism is kept as simple as possible and more sophisticated mechanisms are loaded as extensions. The entry "Module loading and typed module objects are separate layers" is dissolved: layers go, and typed module objects are a decision of the standard language.
- Held finding (2026-11-12, DR3): the loader is host code (`src/modules.ts`), still mixed with the standard language's typed modules (scripts/analyze/units.json).
- Chapter: Modules and programs

#### The loader reaches files through a capability
- Decides: reading a file is an effect. The configuration grants the loader the capability to read; the loader acquires nothing. It looks in the program's own library directory, then the platform's, and a cycle of modules is an error. A browser supplies a different capability to the same loader.
- Status: partly built (the loader takes its file reader as an option; the browser has its own loading code); ruled 2026-11-12 (DR3)
- Type: capability
- Rationale kind: technical
- Depends on: A module is an extension that arrives as a file; A capability is granted, never acquired; A capability is supplied per target; Host code reaches a program only as primitive functions
- Significance: 3 — what a module can cause to be read
- Label: swappable — the search order; the capability itself is fixed by Part II
- Units: module-loading
- Options recorded: one cache per loader (replaced); a missing runtime for asynchronous values treated as an incomplete value (rejected: it is a configuration error)
- Sources: B-157 P2 (docs/book/extension/modules.md "Loaded once per process"); CE-R6 (docs/decisions.md; docs/plans/completion-effects.md §3); the maintainer's rulings of 2026-11-12 (../records/book-pass/dr3-part-3-syntax-and-modules.md, Rulings taken)
- Notes: replaces "Module resolution, caching and the session's runtime"; its load-once clause is now in "What the kernel requires of an extension".
- Held finding (2026-11-12, DR3): the file reader is a host option of the loader (`src/modules.ts:252`), not a capability value, and the browser host scans and loads with code of its own (`web/allegro-web.ts:38`, `:110`–`:125`).
- Chapter: Modules and programs

#### Running a program is evaluating its main module with a configuration's capabilities
- Decides: there is no separate act of running. A session at a prompt is a module whose text arrives one entry at a time: each entry is read in the grammar the earlier entries left and sees the bindings they made. At a prompt a name may be bound again; the new binding holds for the entries that follow, and what earlier entries computed is unchanged.
- Status: partly built; ruled 2026-11-12 (DR3)
- Type: capability
- Rationale kind: technical
- Depends on: A module is an extension that arrives as a file; Phases are configuration; A text can change the grammar it is read in; Order of definition carries no meaning
- Significance: 3 — what it means to run
- Label: foundational — files, scripts and prompts are one case
- Options recorded: a prompt that forbids rebinding, as a file does (rejected 2026-11-12: a prompt needs to allow it)
- Sources: the maintainer's rulings of 2026-11-12 (../records/book-pass/dr3-part-3-syntax-and-modules.md, Rulings taken)
- Notes: new, by ruling. Rebinding, as the maintainer confirmed on PR #190: each entry opens a scope inside the last, so a later binding hides the earlier one and replaces nothing; the rule that a name is bound once in a scope then holds at a prompt as it does in a file.
- Held finding (2026-11-12, DR3): a grammar change does not reach the prompt: the REPL loads no module named by a header (tooling claims C60, C61 of docs/book/platform/tooling.ir.md).
- Chapter: Modules and programs

#### Every program is evaluated the same way, however it arrives
- Decides: a program may arrive as an extension in the configuration, as parsed text, as an imported module, as a script or a prompt entry, or as an expression built by a running program. The same evaluation and the same checks apply to all: a library is checked exactly as the program that uses it, and a program built by a program is checked like any other.
- Status: partly built (one pipeline serves programs and libraries; whether a constructed program skips checks is not confirmed); ruled 2026-11-12 (DR3)
- Type: capability
- Rationale kind: technical
- Depends on: What the kernel requires of an extension; Parsing is evaluation; A module is an extension that arrives as a file; Running a program is evaluating its main module with a configuration's capabilities; Claims are evaluated like everything else; Trust comes from the kernel, not the author
- Significance: 5 — a library's assurance is the same assurance as a program's
- Label: foundational — trust in anything a program is built from
- Units: module-loading, pipeline
- Options recorded: a separate loading path for libraries (the earlier state whose failures motivated the rule)
- Sources: docs/book/extension/README.md "Invariants"; docs/book/extension/modules.md "One pipeline"; docs/book/platform/build-pipeline.ir.md C14, C15, C64, C130; docs/book/vivace/planning-dsl.md §6; the maintainer's rulings of 2026-11-12 (../records/book-pass/dr3-part-3-syntax-and-modules.md, Rulings taken)
- Notes: replaces "One evalSource pipeline for programs and libraries" and takes in the proposal the Part I review deferred ("A program built by a program is checked like any other"; `expr_eval` calls the evaluator directly, `src/primitives.ts:405`–`409`). The entries "A library's values are immutable after load", "Build pipeline as a track, not a layer" and "Execution contexts layer as a scope chain" stop being decisions: the first is ruled by "Structures immutable by default; derive, never mutate", the second names a layer vocabulary that goes, the third is "Scopes layer by parent chain" applied.
- Held finding (2026-11-12, DR3): the pipeline has fixed stages in host code (`src/runtime.ts`, mixed across four units), where the decisions give an extension only functions and fields.
- Held finding (2026-11-12, DR3): the pipeline writes in place into values after they are built (member re-keying, the divergence stamp, the precompile effects write), and a guard keeps the writers off a library's values (`libraryOwnedValues`, `src/runtime.ts:663`); under "Structures immutable by default; derive, never mutate" the writers are the defect.
- Held finding (2026-11-12, DR3): a refuted proof halts only after the program has run (carried over from the Part I review).
- Chapter: Modules and programs

### Types as values

#### Types are values that constrain values
- Decides: a type is an ordinary structure, carried in a value's type field, which the type extension owns. Types are built by ordinary calls. A type is a predicate over values, and a type check is a claim.
- Status: settled; reworded 2026-11-12 (DR4)
- Type: capability
- Rationale kind: vision
- Depends on: One operation: partial evaluation; Metadata is a field on every value; One value universe; An extension registers its own fields; the kernel has two; Claims are evaluated like everything else
- Significance: 5 — the type system is an extension and PE-as-discharge applies to it
- Label: foundational — kinds, refinements, effects as values and every check depend on it
- Units: type-core
- Options recorded: a privileged type layer (rejected by R1/R6)
- Sources: docs/book/concepts.md §30; docs/book/standard/type-system.md §1; D4 (docs/decisions.md)
- Book home (fragments' proposal): standard/type-system (chapter "Types")
- Notes: concepts §30 delta: the closed type-Context namespace is unstated and unenforced (B-107). Told in the tour.
- Chapter: Types as values

#### In the standard language every value has a type
- Decides: the language's notation gives every literal and every constructed value a type. An operator applied to a value with no type is a refutation; nothing falls back to an untyped operation. A function from outside the language enters it wrapped in a type that says so.
- Status: settled; reworded 2026-11-12 (DR4)
- Type: capability
- Rationale kind: technical
- Depends on: Types are values that constrain values; Every notation stands for an expression; A refutation marks everything computed from it
- Significance: 4 — no value escapes the language's checks by having no type
- Label: foundational — every typed operator
- Units: type-core
- Options recorded: a mode of the platform in which values are typed (the sources' wording; rejected: the standard language is a set of extensions, and a type is a field its notation supplies)
- Sources: docs/book/standard/README.md "Invariants"; docs/book/standard/core-types.md; D5 (docs/decisions.md); the maintainer's rulings of 2026-11-12 (../records/book-pass/dr4-part-4-the-standard-language.md, Rulings taken)
- Notes: replaces "Every Standard value has a type, with no implicit fallback". "Standard mode" is not a concept.
- Chapter: Types as values

#### Kinds are types, and Type is its own type
- Decides: a kind is a type whose instances are types (`Type`, `Refinement`, `Interface`, `GenericType`, `Proof`), instance-of is shape-of, members live once on the kind, and `Type : Type` is kept with universe stratification left to the proof-export boundary.
- Status: settled; reworded 2026-11-12 (DR4)
- Type: capability
- Rationale kind: mixed
- Depends on: Types are values that constrain values
- Significance: 4 — Effect and Proof are re-derived through one kind recipe
- Label: foundational — Effect, Proof and Interface kinds
- Units: type-core
- Options recorded: a reified Kind tower (rejected, D7); a privileged root (rejected)
- Sources: D40, D7 (docs/decisions.md; structures.md §9); docs/book/concepts.md §31; docs/book/standard/README.md (kind recipe as exit criterion)
- Book home (fragments' proposal): standard/type-system
- Notes (2026-11-12, DR4): `Type : Type` is safe here because a claim is decided by evaluation, never by a typing judgment; stratification matters only when a decided claim is translated for an outside checker. `Effect` leaves the list of kinds: an effect is the use of a capability.
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

#### The standard language's handled failure is an exception
- Decides: an exception is a value a program raises and handles explicitly. Until it is handled it is carried to every result computed from it, in a field the standard extension owns. It is not a refutation: the program is reporting an outcome.
- Status: partly built (the code has an error value in a kernel field); ruled 2026-11-12 (DR4)
- Type: capability
- Rationale kind: technical
- Depends on: A failure a program can handle is supplied by an extension; Types are values that constrain values; Metadata fields are independent
- Significance: 3 — how a program reports and recovers
- Label: swappable — another language on the kernel may choose otherwise
- Options recorded: an error value in a field of the kernel (what the code does; rejected in the Part II review)
- Sources: the maintainer's rulings of 2026-11-12 (../records/book-pass/dr4-part-4-the-standard-language.md, Rulings taken)
- Notes: new, by ruling: the standard language's choice under Part II's decision. The maintainer preferred "exception" to "error".
- Held finding (2026-11-12, DR4): `make_error` and the `error` field are kernel primitives (`src/primitives.ts:1107`).
- Chapter: Types as values

#### The core types are built over bits
- Decides: the standard language ships Int, Float, String, Bool, Array, Object, Function, None, Any, a type for functions from outside the language, and the exception type. Integers and floats compute through the machine arithmetic capability; a string is bits with a type; Bool is the kernel's two truth values with a type. Array's map, filter and reduce are written in the language, so partial evaluation sees through them. An operator is a method of its operand's type.
- Status: settled; reworded 2026-11-12 (DR4)
- Type: capability
- Rationale kind: technical
- Depends on: In the standard language every value has a type; The kernel's plain data is a sequence of bits, and it computes nothing on them; Machine arithmetic is a set of pure primitives that ships with the platform; The standard language's handled failure is an exception
- Significance: 3 — what every program starts with
- Label: swappable — the roster
- Units: core-types, type-primitives
- Options recorded: host-loop HOFs (rejected: effect and type inference must see through them)
- Sources: docs/book/standard/core-types.md; docs/book/standard/type-system.md §7; D18 (docs/decisions.md); the maintainer's rulings of 2026-11-12 (../records/book-pass/dr4-part-4-the-standard-language.md, Rulings taken)
- Notes: replaces "The core type roster". The source says "ten core types" and lists eleven.
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
- Decides: a typed function carries `Function[ParamTypes, ReturnType]`; type variables bind progressively at a call, with information flowing both ways, and a contradiction is a refutation at that call.
- Status: settled; reworded 2026-11-12 (DR4)
- Type: capability
- Rationale kind: technical
- Depends on: Generics are memoized type constructors
- Significance: 3 — how typed calls are checked
- Label: swappable — type-core checking
- Units: type-core, generics
- Options recorded: `type_check` wrappers inside bodies (rejected)
- Sources: docs/book/standard/type-system.md §6
- Book home (fragments' proposal): standard/type-system
- Notes (2026-11-12, DR4): where the check runs is now "A typed function claims its parameter types on entry and its return type on exit".
- Chapter: Types as values

#### A typed function claims its parameter types on entry and its return type on exit
- Decides: the claims are part of the function's body, so they are evaluated wherever a call is evaluated, with whatever is known there.
- Status: open (the evaluator checks a typed call itself); ruled 2026-11-12 (DR4)
- Type: capability
- Rationale kind: technical
- Depends on: Function types with bidirectional call-site unification; Claims are evaluated like everything else; A call is evaluated by evaluating the function's body; An extension is made of functions and metadata fields
- Significance: 4 — a typed call needs nothing from the kernel but a call and a claim
- Label: foundational — every typed function
- Options recorded: a check made by the evaluator before it substitutes arguments (what the code does; rejected in the Part II review: the evaluator calls into no extension)
- Sources: the maintainer's rulings of 2026-11-12 (../records/book-pass/dr4-part-4-the-standard-language.md, Rulings taken)
- Notes: new, by ruling.
- Held finding (2026-11-12, DR4): the evaluator checks a typed call before substitution (`applyComposed`, `src/evaluator.ts`), through an installed host function.
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
- Decides: the standard extension recognises a predicate as an interval, an equality, an inequality or opaque, and each recognised form answers a question about a value as decided or undecided. An opaque predicate stays a residual claim. No search runs.
- Status: settled; reworded 2026-11-12 (DR4)
- Type: capability — it decides what a compile-time check can prove
- Rationale kind: technical
- Depends on: One operation: partial evaluation; Claims are evaluated like everything else
- Significance: 4 — the cheap form of discharge over residuals
- Label: swappable — a domain set can be extended behind `impliesDomain`
- Units: refinements
- Options recorded: canonical predicate sets with online reasoning (rejected: "carry the facts, let the prover use what it needs")
- Sources: docs/book/concepts.md §34b; docs/book/standard/contracts.md §3
- Book home (fragments' proposal): standard/type-system (proposed "Refinements")
- Notes: the domain rides the host plane while knowledge is a metadata channel (B-111).
- Notes (2026-11-12, DR4): the effects domain goes with the effects lattice.
- Chapter: Refinement types

#### Refinement types
- Decides: a refinement is a type plus a predicate (`Int & _ > 0`) that shares its parent's member set, carries an abstract domain for entailment, and is chained left-associatively one layer per clause; its constructor wraps and checks the parent's.
- Status: settled; reworded 2026-11-12 (DR4)
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

#### Constructing a refined value claims its predicate
- Decides: `Positive(-1)` is a refutation. A program that wants to test a value calls the predicate. Where the argument is not yet known the claim is residual, and so is the construction.
- Status: open (a failed construction yields an error value today); ruled 2026-11-12 (DR4)
- Type: capability
- Rationale kind: technical
- Depends on: Refinement types; Claims are evaluated like everything else; A refutation marks everything computed from it; Invariants are refinements
- Significance: 3 — a refined value is never built wrong
- Label: foundational — every refinement and invariant
- Options recorded: a failed construction as an error value the program may handle (what the code does, by an earlier ruling that reserved the promotion for the maintainer; promoted 2026-11-12)
- Sources: D32, CE-R8 (docs/decisions.md; docs/plans/completion-effects.md §3); docs/book/standard/contracts.md §5; the maintainer's rulings of 2026-11-12 (../records/book-pass/dr4-part-4-the-standard-language.md, Rulings taken)
- Notes: replaces "The triggered construction guard" and the construction half of "Statement contracts halt, construction failure is an error value"; the statement half is Part I's rule that a refuted claim halts.
- Held finding (2026-11-12, DR4): a failed refinement check at construction, and `assert_invariant`, yield an error value (`src/primitives.ts:3228`).
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

### Reaching a member

#### A private member is one whose key not all code holds
- Decides: the key is an unforgeable value made where the type is defined. Code that holds it can reach the member; no other code can, by any name. A key cannot be written out and read back into existence. Printing a value omits what the printer cannot reach, and conformance counts only the members the asking code can reach.
- Status: open (the code mediates each access and asks whether the requesting scope holds a name); ruled 2026-11-12 (DR4)
- Type: capability
- Rationale kind: technical
- Depends on: Authority is an unforgeable value; Reading an expression never yields authority; Members are keyed by symbol and conformance is membership
- Significance: 4 — what a type can keep to itself
- Label: foundational — secrecy, and the base of every access rule
- Units: type-core
- Options recorded: a mediated lookup in four stages with one policy hook for user code, and a kernel-made capsule that answers whether a scope holds a name (what the code does; dissolved: the kernel calls into no extension, and the environment is not a value); a member symbol identified by a name, which can be guessed
- Sources: D41 (docs/decisions.md; structures.md §6, §13); V-R1 (docs/plans/visibility.md §3); D43 (docs/decisions.md); V-R3, V-R5 (docs/plans/visibility.md §3); docs/book/standard/type-system.md §3; D42 (docs/decisions.md; structures.md §13); V-R2 (docs/plans/visibility.md §3); forgery-E criterion (visibility.md §3); V-R6, V-R7, V-R8 (docs/plans/visibility.md §3; docs/decisions.md); the maintainer's rulings of 2026-11-12 (../records/book-pass/dr4-part-4-the-standard-language.md, Rulings taken)
- Notes: replaces "Mediated member access", "Access is what a type's member lookup returns, in two tiers", "Evidence is possession" and "Privacy across readers, reflection and mediation effects", and takes the rule on serialising symbols that the Part II review sent here. Every access pattern is a rule for who is handed the key and in what form: private, the defining module keeps it; shared within a group, the module hands it to the modules it names; read-only, the module hands out a function that reads; protected, the type hands it to any definition that refines or draws from it. Protected is a discipline unless the type also limits who may refine it.
- Held finding (2026-11-12, DR4): member access runs through an installed mediation path with a policy hook (`type_dispatch`, `fallbackMember`), and privacy asks what the requesting scope can reach.
- Chapter: Reaching a member

#### Who may use a member is a claim about where the access was written
- Decides: private, protected, read-only and caller-based rules are claims over the origins of accesses. Only the kernel writes an origin, so it cannot be forged. Such a claim is refuted like any other, before any effect. For strict control the two mechanisms combine: the type's module keeps the key and hands out an accessor whose body makes the claim.
- Status: open, a design to prove; ruled 2026-11-12 (DR4)
- Type: capability
- Rationale kind: technical
- Depends on: A private member is one whose key not all code holds; Every value keeps its origin; Claims are evaluated like everything else; An effect consumes only values whose claims are decided; A function may take an argument unevaluated
- Significance: 3 — interfaces and design discipline, checked
- Label: swappable — the access rules a language offers
- Options recorded: access decided by who is asking at the moment of access (rejected in Part II with authority by identity); a third mechanism for caller-based control (not needed: a key and a claim about origins combine)
- Sources: the maintainer's rulings of 2026-11-12 (../records/book-pass/dr4-part-4-the-standard-language.md, Rulings taken)
- Notes: new, by ruling. The maintainer: these access patterns "are not really privacy concerns", they are "about interface, encapsulation and design discipline". To prove: an accessor reading the origin of its call; the four access patterns restated as claims; the cost of deciding such claims on real programs. A trusted module can still be led to access on another's behalf, which is why the key stays the foundation.
- Chapter: Reaching a member

#### Export marks the binding, and a module with no exports is open
- Decides: `export NAME = …` marks the binding, never the value. A module hands out what it exports, and what it does not hand out cannot be reached. A module that declares no exports hands out everything.
- Status: settled; reworded 2026-11-12 (DR4)
- Type: capability
- Rationale kind: technical
- Depends on: A module is an extension that arrives as a file; A capability is granted, never acquired
- Significance: 2 — closes a leak route and fixes aliasing behaviour
- Label: swappable — typed-modules policy
- Units: typed-modules
- Options recorded: an `exported` value-plane channel (deleted: `y = x` copied export-ness)
- Sources: V-R4 (docs/plans/visibility.md §3; docs/decisions.md); B-097 V1; docs/book/extension/modules.md "Module objects and encapsulation"
- Book home (fragments' proposal): extension/modules (L2 half)
- Chapter: Reaching a member

#### Imported modules are typed objects whose type encapsulates
- Decides: an imported module is a typed object whose members are the module's exports and nothing else.
- Status: settled; reworded 2026-11-12 (DR4)
- Type: capability
- Rationale kind: technical
- Depends on: Export marks the binding, and a module with no exports is open; In the standard language every value has a type
- Significance: 3 — module encapsulation reuses type dispatch instead of a separate mechanism
- Label: swappable — typed-modules
- Units: typed-modules
- Options recorded: none recorded
- Sources: D41–D43 (docs/decisions.md); V-R1, V-R4 (docs/plans/visibility.md §3); docs/book/extension/modules.md; docs/book/standard/type-system.md §3
- Book home (fragments' proposal): extension/modules (L2 half)
- Notes (2026-11-12, DR4): the policy hook that filtered members goes with the mediated lookup.
- Chapter: Reaching a member

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

#### Expression-valued `if then else`
- Decides: `if c then a else b` is an expression built on the kernel's one conditional. A branch that may not be taken is evaluated without capabilities.
- Status: settled; reworded 2026-11-12 (DR4)
- Type: capability
- Rationale kind: mixed
- Depends on: A branch that may not be taken is evaluated without capabilities; Every notation stands for an expression
- Significance: 2 — local to the conditional, but its thunking interacts with tail calls
- Label: swappable — the spelling is base-grammar; the thunking rides the lazy-primitive mechanism
- Units: base-grammar, tree-builder, base-primitives
- Options recorded: none recorded
- Sources: docs/book/language-reference.md (If-then-else); docs/book/vivace/planning-dsl.md §6 (the tail-call sentinel finding through a branch thunk)
- Book home (fragments' proposal): Surface syntax of Allegro Standard (proposed)
- Notes: planning-dsl.md §6 records two evaluator bugs caused by thunked branches in non-tail positions, fixed in `src/evaluator.ts`.
- Notes (2026-11-12, DR4): the parser no longer wraps branches in thunks for a lazy primitive.
- Chapter: The surface language

#### The `Y of x` component-access form
- Decides: a metadata field of a value is read by the expression form `Y of x` (`type of x`, `source of x`). Reading a field is free to any code.
- Status: settled; reworded 2026-11-12 (DR4)
- Type: capability
- Rationale kind: mixed
- Depends on: Metadata is a field on every value; An extension registers its own fields; the kernel has two
- Significance: 2 — the reader's view of the metadata plane at the surface
- Label: swappable — a surface over channel reads
- Units: base-grammar, metadata
- Options recorded: none recorded
- Sources: docs/book/language-reference.md (MultiValue component access); docs/book/standard/pattern-matching.md §2; D47 (source of x surface)
- Book home (fragments' proposal): Surface syntax of Allegro Standard (proposed)
- Notes: the reference still calls it "MultiValue component access"; MultiValue is retired (D46), so the name is stale.
- Chapter: The surface language

#### Type annotations on parameters and returns
- Decides: parameters and returns carry `: Type` annotations, and generics are written `Array[Int]`. Each annotation stands for a claim.
- Status: settled; reworded 2026-11-12 (DR4)
- Type: capability
- Rationale kind: mixed
- Depends on: A typed function claims its parameter types on entry and its return type on exit; Every notation stands for an expression
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
- Depends on: Every production can be extended; Type annotations on parameters and returns
- Significance: 3 — lets a DSL declare names with the kernel's halt semantics; the planning `plan NAME:` form needs it
- Label: swappable — a tree-builder marker; another expansion mechanism could replace it
- Units: tree-builder, grammar-extension
- Options recorded: none recorded
- Sources: docs/book/extension/grammar.md §4 (B-151 B1); docs/book/vivace/planning-dsl.md §6
- Book home (fragments' proposal): Grammar and parser / cited from The planning DSL
- Notes: added at stage B1 as one of three engine gaps closed for the first offside fragment, with layout terminals by name and labels as string literals.
- Chapter: The surface language

#### `when / is / then` pattern matching
- Decides: matching uses `when x is P then e` with nominal, structural and nested destructuring and `and`/`or` guards; a type pattern resolves first (value pattern matches the primary, type pattern matches the input's type, or either for a type input). It is built on the kernel's one conditional.
- Status: settled; reworded 2026-11-12 (DR4)
- Type: capability
- Rationale kind: aesthetic
- Depends on: The `grammar { … }` block; Types are values that constrain values; Expression-valued `if then else`
- Significance: 2 — the match surface
- Label: swappable — a grammar form over `eval_when`
- Units: base-grammar, base-primitives
- Options recorded: ML-style, Rust-style and arrow-style syntax (rejected: `when/is/then` matches `if/then/else`); ML-style, Rust-style, arrow-style matches (rejected: `when/is/then` matches `if/then/else` and reads without verbosity); a `match … with | …` form shipped as an extension demo
- Sources: docs/book/standard/pattern-matching.md §1–§2; docs/book/standard/pattern-matching.md §1 to §3; docs/book/language-reference.md; docs/book/grammar-formalism.md §10.4
- Book home (fragments' proposal): standard/pattern-matching / Pattern matching (`docs/book/standard/pattern-matching.md`)
- Notes: Merged from fragment B ("`when/is/then` pattern matching"), fragment C ("`when / is / then` pattern matching"). C: unification in patterns is deferred (§3).
- Chapter: The surface language

#### Combinators before keyword declaration syntax
- Decides: types, interfaces, refinements and member modifiers are declared through combinator calls (`Type.define`, `Interface.define`, `private(...)`), and keyword declaration syntax waits until the API patterns settle, lowering to the same attributes when it lands.
- Status: open
- Type: capability
- Rationale kind: mixed
- Depends on: One construction surface; A private member is one whose key not all code holds
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

### Claims and proofs

#### Nothing is a claim until someone makes it
- Decides: a type annotation, a refinement, a contract, an assertion, a law, a theorem, a bound on capabilities and a declaration that a function terminates are all claims, and a refuted one halts. A finding about code that claimed nothing is a report. A project may make claims wholesale, such as "every function terminates". It may not soften a refutation.
- Status: partly built; ruled 2026-11-12 (DR4)
- Type: capability
- Rationale kind: technical
- Depends on: Claims are evaluated like everything else; Correctness and safety are one kind of claim
- Significance: 5 — one rule for every check the language has
- Label: foundational — every chapter of this part
- Options recorded: three severities (halt, error value, information) and a per-project configuration that promotes or demotes each finding (what the sources design; rejected: a refuted claim halts and that is not configurable)
- Sources: T-R1, T-R3 (docs/decisions.md; docs/book/standard/totality.md §5, §8); archive phase-e-totality-plan.md "Design questions" 1; T-R2 (docs/decisions.md); CT-R2; docs/book/standard/totality.md §5, §7; B-099; the maintainer's rulings of 2026-11-12 (../records/book-pass/dr4-part-4-the-standard-language.md, Rulings taken)
- Notes: replaces "Strict at the contract, informational for undeclared code" and "Project severity configuration".
- Held finding (2026-11-12, DR4): findings have severities, and a project configuration to move them is designed.
- Chapter: Claims and proofs

#### A claim about every value is decided by evaluating it with the value unknown
- Decides: a proposition is an expression that evaluates to true or false. A claim about every value is decided by evaluating it with the value unknown: if the residual is true, the claim holds for all values. Enumerating a finite type decides it too. Deciding is reduction, never search, and a refuted claim carries its counterexample.
- Status: settled; reworded 2026-11-12 (DR4)
- Type: capability
- Rationale kind: mixed
- Depends on: One operation: partial evaluation; Claims are evaluated like everything else; Only the kernel records the outcome of a claim; Evaluation is total over unresolved information
- Significance: 4 — the provability thesis in the language
- Label: foundational — laws, PCP, `proven`, verdict
- Units: proofs; proofs, evaluator
- Options recorded: an SMT fallback (future, "per the thesis"); SMT, structural type checking, symbolic execution (each the pick of an existing system; evaluation named as the underexplored position)
- Sources: docs/book/proving-in-allegro.md "The proof model", "Stating a theorem"; docs/book/concepts.md §44; docs/book/standard/README.md "Invariants"; docs/book/vision.md §2 (three legs, leg 1), §5 principle 2; docs/book/proving-in-allegro.md (The proof model in one sentence)
- Book home (fragments' proposal): proposed standard/proofs (planned `proofs.md`, revalidation-gated) / the tour / Proving in Allegro
- Notes: Merged from fragment B ("Proofs are values discharged by evaluation"), fragment C ("PE-as-discharge as the primary proof strategy"). B: `discharged` is the last metadata field on the binding plane (B-104). The brief's reading list did not include proof sources; this and the next two entries rest on proving-in-allegro.md. C: likely also in another fragment's scope; listed here from the thesis-test side. Significance calibrated from 5/5.
- Notes (2026-11-12, DR4): was "Proofs are values discharged by evaluation". The mark of a decided claim is the kernel's claim-outcome field.
- Chapter: Claims and proofs

#### A proof term is a proposal
- Decides: a theorem is a named claim, and `verify` makes an anonymous one. `by <term>` offers an expression whose evaluation decides the claim; the kernel checks that it establishes exactly what was stated. Rules such as reflexivity, symmetry, transitivity and congruence are functions of the standard extension, and a result decided with their help names that extension.
- Status: settled; reworded 2026-11-12 (DR4)
- Type: capability
- Rationale kind: mixed
- Depends on: A claim about every value is decided by evaluating it with the value unknown; Anyone may propose, and the record shows who; Every result says how strongly it holds
- Significance: 3 — the proof surface every rung and the prover loop splice into
- Label: swappable — the statements lower to proof primitives
- Units: proofs, tree-builder
- Options recorded: none recorded
- Sources: docs/book/proving-in-allegro.md (Stating a theorem; equational combinators)
- Book home (fragments' proposal): Proving in Allegro
- Notes (2026-11-12, DR4): was "Theorems as statements, proved `by` a term". The alternative weighed 2026-11-12: a kernel primitive that rewrites by a decided equation, which enlarges the kernel. The cost accepted: a result that used transitivity is trusted as far as the standard extension is.
- Held finding (2026-11-12, DR4): the proof rules are kernel primitives (`proof_by_eval`, `proof_refl`, `proof_sym`, `proof_trans`, `proof_cong`, `proof_refines` in `src/primitives.ts`).
- Chapter: Claims and proofs

#### Discharge mechanisms without search
- Decides: the standard extension decides claims without search, in order of preference: evaluation; entailment from a refinement's domain; equational rules through `by`; enumeration of a finite type. Bounded sampling gives the strength sampled, not decided. A library of tactics composes them, and there is no outside solver.
- Status: partly built; reworded 2026-11-12 (DR4)
- Type: capability
- Rationale kind: technical
- Depends on: A claim about every value is decided by evaluating it with the value unknown; A proof term is a proposal; Abstract domains as sound approximations
- Significance: 3 — what can be proved today
- Label: swappable — each strategy is a primitive or library
- Units: proofs; proofs, refinements
- Options recorded: full symbolic induction and symbolic-input `proven` (follow-ons); SMT (future); SMT (deferred to the fallback leg)
- Sources: docs/book/proving-in-allegro.md (four strategies, tactics, proven); docs/book/proving-in-allegro.md (The four discharge strategies)
- Book home (fragments' proposal): proposed standard/proofs / Proving in Allegro
- Notes: Merged from fragment B ("Discharge strategies without search"), fragment C ("Four discharge mechanisms in order of preference"). B: bounded sampling is recorded as survival, not proof, in the law tiers; the `proven` clause's tier visibility in the ledger is not stated in the primer. C: the primer's "four strategies" and the vision's "three legs" are different lists (mechanisms inside leg 1 versus strategy legs); the book should name both distinctly.
- Chapter: Claims and proofs

#### Bounded sampling for universal claims
- Decides: induction is checked at the base and four inductive steps, and a function's `proven` clause at four sampled inputs of its parameter type; a failure halts with the counterexample. The result's strength is sampled. Full symbolic induction is a follow-on.
- Status: partly built; reworded 2026-11-12 (DR4)
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
- Chapter: Claims and proofs

#### Four strengths, one vocabulary
- Decides: every claim of the standard language carries one of the four strengths: decided, sampled, assumed, undecided. How a claim was decided is found in its origin.
- Status: open (the code has three vocabularies); ruled 2026-11-12 (DR4)
- Type: capability
- Rationale kind: technical
- Depends on: Every result says how strongly it holds; Bounded sampling for universal claims; Every value keeps its origin
- Significance: 3 — one answer to how far a result can be trusted
- Label: foundational — laws, termination and the report a tool gives
- Options recorded: six tiers for laws and four for termination (what the code has)
- Sources: D34, CE-R2, CE-R3 (docs/decisions.md); docs/book/standard/totality.md §1–§2; docs/plans/completion-effects.md §3; the maintainer's rulings of 2026-11-12 (../records/book-pass/dr4-part-4-the-standard-language.md, Rulings taken)
- Notes: replaces "Four-tier discharge spectrum". The mapping: kernel, enumerated, auto and witnessed become decided; sampled stays; admitted becomes assumed; pending and undischarged become undecided.
- Held finding (2026-11-12, DR4): three strength vocabularies, and a sampled induction reported as discharged (carried over from the Part I review).
- Chapter: Claims and proofs

#### Tactics as a pure Allegro library
- Decides: reusable proof strategies (`same`, `flip`, `step`, `chain`, `rewrite`) are a library of plain Allegro over the kernel's combinators, adding no primitive.
- Status: settled
- Type: capability — where tactics live is what a prover imports
- Rationale kind: vision
- Depends on: A proof term is a proposal; Everything above the kernel is an extension, and there is one way to extend
- Significance: 2 — shows proof strategy as user-extensible
- Label: swappable — a library
- Units: not yet a unit (`lib/tactics.alg`)
- Options recorded: none recorded
- Sources: docs/book/proving-in-allegro.md (The tactics library)
- Book home (fragments' proposal): Proving in Allegro
- Chapter: Claims and proofs

### Equality and laws

#### Lawful interfaces
- Decides: any member set may carry laws: members whose propositions over all values are schemas at declaration, and become one claim per law when a type draws the set. Until decided, each is undecided. Laws attach to the set because a law may reference several members.
- Status: settled; reworded 2026-11-12 (DR4)
- Type: capability
- Rationale kind: vision
- Depends on: Members are keyed by symbol and conformance is membership; A claim about every value is decided by evaluating it with the value unknown
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

#### Default equality belongs to the standard extension
- Decides: every structure-backed type gets the standard extension's structural equality: same shape, then field by field or element by element. Its laws are decided once for all types. An override carries the three law claims. None and exceptions compare by identity, and Bool is not equal to Int.
- Status: settled; reworded 2026-11-12 (DR4)
- Type: capability
- Rationale kind: technical
- Depends on: Equality dispatches on shape, then coerces, else not-equal
- Significance: 3 — records and arrays compare without user code
- Label: swappable — the default impl behind `equals`
- Units: equality-laws, core-types
- Options recorded: declaring a Bool→Int coercion (recommended against: Bool is not a number)
- Sources: E-R1 (docs/plans/equality-and-laws.md §3, §6 items 1–2, 7–8)
- Book home (fragments' proposal): proposed "Equality and laws"
- Notes (2026-11-12, DR4): was "Kernel structural equality is the default"; the kernel has no part in equality beyond telling bits apart.
- Chapter: Equality and laws

#### Law strengths and the transitivity gate
- Decides: each law claim carries one of the four strengths, and a proof records the equality and the strength it rests on. The transitivity rule refuses a custom equality whose transitivity is neither decided nor assumed.
- Status: settled; reworded 2026-11-12 (DR4)
- Type: capability
- Rationale kind: mixed
- Depends on: Lawful interfaces; Four strengths, one vocabulary; A proof term is a proposal
- Significance: 3 — "no boolean verified anywhere"
- Label: swappable — tier policy and gate list
- Units: equality-laws, proofs
- Options recorded: gating everything at once (rejected: would halt existing programs; strictness ships incrementally)
- Sources: E-R4, E-R6 (docs/plans/equality-and-laws.md §3); docs/book/proving-in-allegro.md "Laws, discharge tiers, and the strict gate"
- Book home (fragments' proposal): proposed "Equality and laws"
- Notes: E-R6 named two fields; three shipped (`lawName` added). Two transitive backing carriers coexist (B-115). Assembly: the dependency on the divergence tiers ("Four-tier discharge spectrum") was replaced by the thesis-level tier vocabulary ("Every result says how strongly it holds"); law tiers share the vocabulary, not the divergence analysis.
- Chapter: Equality and laws

### Effects

#### An effect is the use of a capability
- Decides: what a function may do is read from the capabilities it holds: those it is given and those in its body. A function that holds none is pure. A function that takes a function can do what its own capabilities and its argument's allow. An operation the platform cannot analyse is a capability a configuration supplies.
- Status: open (the code infers sets of effect labels and checks them in a pass of its own); ruled 2026-11-12 (DR4)
- Type: capability
- Rationale kind: technical
- Depends on: A capability is granted, never acquired; What code may do is bounded by the capabilities it is given, and that bound is a claim; Reading an expression never yields authority; Host code reaches a program only as primitive functions
- Significance: 4 — what a piece of code can touch is visible in what it holds
- Label: foundational — safety claims about any program
- Units: effects
- Options recorded: effect labels as values in a lattice, inferred by propagation, with effect variables for polymorphism, `opaque` for the unknown and an `unsafe` hierarchy accepted on the author's word (what the sources design and the code partly builds; dissolved: an effect is a capability call, and capabilities are granted); asking whether a value is resolved yet (`is_resolved`; removed 2026-11-12: no use case, and behaviour that differs by phase can be had by other means)
- Sources: docs/book/standard/effects.md §1–§3; docs/book/concepts.md §40; archive harmonic-grounding-tarski.md "Settled architectural commitments"; CE-R1 (docs/decisions.md); docs/book/standard/effects.md §1 item 3, §2 "Declaration surfaces", §6 (applyComposed hypothesis resolved); docs/book/concepts.md §41; docs/book/standard/effects.md §4–§5; archive harmonic-grounding-tarski.md "The unsafe hierarchy"; the maintainer's rulings of 2026-11-12 (../records/book-pass/dr4-part-4-the-standard-language.md, Rulings taken)
- Notes: replaces "Effects are values in one lattice", "Effect inference is driven by partial evaluation, and a declaration is a contract", "Effects describe computations, refinements describe data", "Labels for observing knowledge and scheduling", "The `unsafe` hierarchy and safe wrappers", "Open effect surfaces" and the effect variables of "Parameter effect bounds and explicit effect variables". A new capability is declared by an extension (Part I). "Redefining primitives and core types is banned" dissolves into Part I's rule that replacing is explicit.
- Held finding (2026-11-12, DR4): effects are sets of label strings merged by union (`src/effects.ts:41`) and checked by a separate checker (carried over from the Part I review).
- Held finding (2026-11-12, DR4): `is_resolved` is a primitive (`src/primitives.ts:4676`).
- Notes (2026-11-13, DR6): the four kinds of function: a primitive function or a composed function, each effectful or pure. A capability is a named set of effectful primitives. A primitive's purity is declared; a composed function's is decided from what it holds.
- Chapter: Effects

#### A capability has named parts and narrowed forms
- Decides: `files.read` is a part of the `files` capability, and reading one path is a narrowed form of `files.read`. Holding a capability means holding its parts; holding a part or a narrowed form gives nothing wider.
- Status: open; ruled 2026-11-12 (DR4)
- Type: capability
- Rationale kind: technical
- Depends on: An effect is the use of a capability; Authority is an unforgeable value
- Significance: 2 — a bound can be as fine as the task
- Label: swappable — how capabilities are divided
- Options recorded: none recorded
- Sources: docs/book/standard/effects.md §2 (Phase D2, [designed]); the maintainer's rulings of 2026-11-12 (../records/book-pass/dr4-part-4-the-standard-language.md, Rulings taken)
- Notes: replaces "Member and parameterized effects".
- Chapter: Effects

#### A bound on capabilities is written in an `effects` clause or a type slot
- Decides: a function states its bound with an `effects` clause; a parameter's bound is written in its type slot (`f: pure`). Each stands for the claim Part II defines. A function-typed parameter with no bound makes no claim.
- Status: settled; reworded 2026-11-12 (DR4)
- Type: capability
- Rationale kind: mixed
- Depends on: An effect is the use of a capability; What code may do is bounded by the capabilities it is given, and that bound is a claim; Every notation stands for an expression
- Significance: 2 — how a bound is written
- Label: swappable — the notation
- Options recorded: auto-promoting each unannotated parameter to a fresh effect variable (the D1 plan; rejected: a bare lowercase name would silently capture a binding)
- Sources: docs/book/standard/effects.md §2 "Declaration surfaces"; archive harmonic-grounding-tarski.md "Effect polymorphism"; the maintainer's rulings of 2026-11-12 (../records/book-pass/dr4-part-4-the-standard-language.md, Rulings taken)
- Notes: replaces the notation half of "Parameter effect bounds and explicit effect variables".
- Chapter: Effects

### Contracts

#### A contract is a predicate that becomes knowledge, discharged by PE
- Decides: `assert`, `requires` and `ensures` are claims, and a claim that holds becomes knowledge of the value, so a later claim of the same property is decided by what is known. There is no separate contract checker.
- Status: settled; reworded 2026-11-12 (DR4)
- Type: capability
- Rationale kind: vision
- Depends on: Shape and knowledge are separate; One operation: partial evaluation; Nothing is a claim until someone makes it
- Significance: 4 — compile-time and runtime checking are one mechanism
- Label: foundational — contract discharge, branch refinement and mechanism choice
- Units: contracts, refinements
- Options recorded: a standalone contract checker (rejected)
- Sources: CT-R5 (docs/decisions.md); docs/book/standard/contracts.md §1 items 1–3, §6; docs/book/concepts.md §46
- Book home (fragments' proposal): standard/contracts
- Notes (2026-11-12, DR4): guidance kept for the chapter, formerly the entry "Choosing among refinement, contract, assert and law": prefer a refinement when the property is intrinsic, a contract when it concerns a function's relation to its callers, `assert` for local knowledge, a theorem or law when the claim is over all inputs.
- Chapter: Contracts

#### What is known about a value travels with the value
- Decides: knowledge is a field of the standard extension. Inside a branch, the names tested are rebound to values that carry the extra fact; after `assert` or `requires`, for the rest of the scope. The arms of a pattern match narrow knowledge as the branches of `if` do.
- Status: partly built (the code keeps a second set of facts on the scope and narrows it in place); ruled 2026-11-12 (DR4)
- Type: capability
- Rationale kind: technical
- Depends on: A contract is a predicate that becomes knowledge, discharged by PE; An extension registers its own fields; the kernel has two; Expression-valued `if then else`; `when / is / then` pattern matching
- Significance: 4 — a check made once is not made again
- Label: foundational — contracts, refinements and matches
- Options recorded: two carriers, the value and a set of facts on the scope (what the code does; dissolved in the Part II review); arms of a pattern match that do not narrow (one source says so, another says they do; ruled 2026-11-12: they narrow)
- Sources: CT-R5, D36 (docs/decisions.md); docs/book/standard/contracts.md §1 items 4–5, §3, §9; docs/book/standard/contracts.md §4; B-057; the maintainer's rulings of 2026-11-12 (../records/book-pass/dr4-part-4-the-standard-language.md, Rulings taken)
- Notes: replaces "Knowledge has intrinsic and occurrence carriers" and "Branch refinement narrows knowledge per region". Branch knowledge is the case Part II named to prove first.
- Held finding (2026-11-12, DR4): occurrence facts live on the scope and narrow in place; the legacy `domain` component is still read.
- Chapter: Contracts

#### A match where no arm matches is a refutation
- Decides: falling through a pattern match is a wrong program, so a match that can fall through refutes the program, and exhaustiveness needs no analysis of its own. An `else`, a wildcard or a pattern that binds anything covers a match. Where the subject's possible values are not known, the claim is undecided.
- Status: open (a match that can fall through is reported as information today); ruled 2026-11-12 (DR4)
- Type: capability
- Rationale kind: technical
- Depends on: `when / is / then` pattern matching; A refutation on a path that may be taken refutes the program; What is known about a value travels with the value
- Significance: 3 — no case is silently missed
- Label: foundational — every match
- Options recorded: a separate analysis reporting at the level of information until a project promotes it (what the code does, by an earlier ruling that reserved the promotion for the maintainer; promoted 2026-11-12)
- Sources: CE-R8, T-R3 (docs/decisions.md); docs/book/standard/totality.md §4; archive phase-e-totality-plan.md question 2; the maintainer's rulings of 2026-11-12 (../records/book-pass/dr4-part-4-the-standard-language.md, Rulings taken)
- Notes: replaces "Exhaustiveness checking at info severity". A finding carries a witness: a value no arm matches. Closed sums, record destructuring and dead cases under refinements are designed, not built.
- Held finding (2026-11-12, DR4): exhaustiveness is a privileged host pass that reports at the level of information (carried over from the Part I review).
- Chapter: Contracts

#### A body clause is a notation
- Decides: `requires`, `ensures`, a bound on capabilities, `decreases` and `total` are leading statements of a function's body, and each stands for a claim placed in the body.
- Status: partly built (the clauses exist; they are lowered by host steps); ruled 2026-11-12 (DR4)
- Type: capability
- Rationale kind: technical
- Depends on: The `grammar { … }` block; Every notation stands for an expression; Claims are evaluated like everything else
- Significance: 3 — every declaration about a function is written the same way
- Label: swappable — the clauses' notation
- Options recorded: `assert`-at-entry plus a let-binding wrapper (v1, reshaped); an eval-time magic `_` (rejected for a parse-time lambda); bespoke peelers per analyser (forbidden); none recorded for the position; a misplaced `ensures` is a no-op, not an error (the `effects_decl_marker` precedent)
- Sources: docs/book/standard/contracts.md §2, §9; CE-R3; docs/plans/completion-effects.md §3; CLAUDE.md "Body wrappers" invariant; docs/book/standard/contracts.md §2; docs/book/language-reference.md (discharge spectrum); docs/book/platform/build-pipeline.ir.md C37, C38, C55, C157; the maintainer's rulings of 2026-11-12 (../records/book-pass/dr4-part-4-the-standard-language.md, Rulings taken)
- Notes: replaces "Body-form clauses at the head of a body, lowered through one chain".
- Held finding (2026-11-12, DR4): a clause is lowered through a marker primitive, an attach step in the host tree builder and `collapseBodyMetadata` into a function property.
- Chapter: Contracts

#### Contract checks sit at function entry and return
- Decides: `requires` is claimed on entry and `ensures` on return. Both are part of the body, so each is evaluated wherever a call is evaluated, with what is known there.
- Status: partly built; reworded 2026-11-12 (DR4)
- Type: capability
- Rationale kind: technical
- Depends on: A contract is a predicate that becomes knowledge, discharged by PE; A body clause is a notation; A call is evaluated by evaluating the function's body
- Significance: 2 — where residual checks are emitted
- Label: swappable — codegen placement
- Units: contracts
- Options recorded: v1's sink-based relocation to each call site (open, B-057)
- Sources: CT-R1 (docs/decisions.md); docs/book/standard/contracts.md §6, §10
- Book home (fragments' proposal): standard/contracts
- Notes (2026-11-12, DR4): the open question of moving a check to the call site dissolves: a call is evaluated by evaluating the body.
- Chapter: Contracts

#### Unification in patterns
- Decides: open — full unification in pattern mode.
- Status: open
- Type: capability
- Rationale kind: technical
- Depends on: `when / is / then` pattern matching
- Significance: 1 — precision of matching
- Label: swappable — pattern evaluation
- Units: base-primitives, refinements
- Options recorded: none recorded
- Sources: docs/book/standard/pattern-matching.md §3
- Book home (fragments' proposal): standard/pattern-matching
- Notes: contradiction — pattern-matching.md §3 says `when` arms do not narrow; contracts.md §4 says `when/is/then` arms lift the matched pattern tagged `match-case`, and contracts.md §9 says chunk 2 shipped "with `when/is/then` arms included". One of the two is stale; code not checked.
- Notes (2026-11-12, DR4): the narrowing half is ruled in "What is known about a value travels with the value".
- Chapter: Contracts

### Termination and completion

#### Termination is a claim
- Decides: that a function terminates is a claim, made by `total` or wholesale by a project. It is decided by a function of the standard extension evaluated over the function's expression. `decreases` offers a measure; `assume terminates` gives the strength assumed; `partial` makes no claim. A function that takes a function terminates if its argument does, and says so.
- Status: open (the code computes divergence as an effect, in a host pass); ruled 2026-11-12 (DR4)
- Type: capability
- Rationale kind: technical
- Depends on: Nothing is a claim until someone makes it; One operation: partial evaluation; A body clause is a notation; Four strengths, one vocabulary
- Significance: 4 — whether a program finishes is checked like everything else
- Label: foundational — purity of equality and invariants, completion
- Options recorded: possible non-termination as an effect, `div`, so that totality reuses the effect calculus (what the code does; rejected: an effect is the use of a capability, and not terminating is not one)
- Sources: D31, CE-R1 (docs/decisions.md); docs/book/standard/totality.md §1 item 1; docs/book/concepts.md §43; T-R5 (docs/decisions.md; docs/book/standard/totality.md §3, §6, §8); archive phase-e-totality-plan.md question 5; the maintainer's rulings of 2026-11-12 (../records/book-pass/dr4-part-4-the-standard-language.md, Rulings taken)
- Notes: replaces "Divergence is a computed effect" and "Totality polymorphism is effect polymorphism", and takes the surface forms of "Four-tier discharge spectrum".
- Held finding (2026-11-12, DR4): termination is a privileged host pass that writes `div` into inferred effect sets (carried over from the Part I review).
- Chapter: Termination and completion

#### Completion is totality and liveness
- Decides: a program completes if it terminates and every value it waits for arrives. A capability's supplier declares whether its values arrive (a delay does; a fetch is assumed to), and that is never inferred.
- Status: settled; reworded 2026-11-12 (DR4)
- Type: capability
- Rationale kind: technical
- Depends on: Termination is a claim; A missing value is a cell that is filled once; Four strengths, one vocabulary
- Significance: 3 — frames what "the program completes" means
- Label: foundational — liveness ledger and `sched`
- Units: totality, futures
- Options recorded: inferring liveness (rejected)
- Sources: D31, CE-R4 (docs/decisions.md); docs/book/standard/totality.md §1 item 7; structures.md §10
- Book home (fragments' proposal): standard/totality
- Chapter: Termination and completion

#### Termination by bounded decrease
- Decides: a recursive call decreases when an argument is `param - K` (literal K > 0) and the callee's parameter type has a non-negative lower bound read from refinement domains; a detected decrease on an untyped parameter stays silent.
- Status: settled
- Type: capability
- Rationale kind: technical
- Depends on: Abstract domains as sound approximations; Termination is a claim
- Significance: 3 — automatic termination proof over refined types
- Label: swappable — analyzer criterion
- Units: totality
- Options recorded: always requiring `decreases`/`partial`; auto-detect structural with everything else `partial`; sized types (rejected for abstract domains)
- Sources: docs/book/standard/totality.md §1 item 5, §3, §6; archive phase-e-totality-plan.md questions 3–4
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

### When a check fails

#### Equality, coercion and invariant predicates hold no capability and terminate
- Decides: the implementation of an equality or a coercion, and an invariant predicate that inspects its value, hold no capability and carry a termination claim. A violation is a refutation that names what was held.
- Status: settled; reworded 2026-11-12 (DR4)
- Type: capability
- Rationale kind: technical
- Depends on: An effect is the use of a capability; Termination is a claim
- Significance: 2 — keeps equality knowledge-independent and guards from hanging
- Label: swappable — a consumer of inferred effects
- Units: equality-laws, contracts
- Options recorded: none recorded
- Sources: E-R5, CE-R7 (docs/decisions.md); docs/book/standard/totality.md §1 item 6; D32
- Book home (fragments' proposal): proposed "Equality and laws"
- Chapter: When a check fails

#### An assumption is always on the record
- Decides: a trust boundary is a recorded assumption, with the strength assumed: `Law.assume`, `assume terminates`. A form that attaches a fact without recording it is retired.
- Status: partly built; reworded 2026-11-12 (DR4)
- Type: capability
- Rationale kind: vision
- Depends on: Four strengths, one vocabulary
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
- Depends on: Abstract domains as sound approximations; Termination by bounded decrease; A refutation marks everything computed from it
- Significance: 2 — diagnostics speak the program's terms
- Label: swappable — rendering
- Units: totality, contracts, refinements
- Options recorded: silently promoting asserts to the interface (rejected: suggestion only)
- Sources: docs/book/standard/totality.md §3; docs/book/standard/contracts.md §6–§7; B-081 slice (planning pilot C1)
- Book home (fragments' proposal): standard/contracts
- Notes: call-site origin and known facts in messages do not ship (B-057); `false || error "…"` does not pass the error value through. Related: "A refinement predicate explains its own refusal" (Plans as outcome graphs) is the kernel channel this entry's predicate-message clause rests on.
- Chapter: When a check fails

#### A predicate can explain its refusal
- Decides: a predicate may answer an explanation in place of false. Anything other than true refutes the claim, and the refutation carries what the predicate answered, so a model's failures are reported in the model's own terms with no registry of renderers.
- Status: partly built
- Type: capability
- Rationale kind: technical
- Depends on: Refinement types; Constructing a refined value claims its predicate; Every failure carries a legible counterexample
- Significance: 3 — counterexample legibility, one of the seven Vivace gaps
- Label: swappable — a predicate convention plus one kernel channel
- Units: refinements, type-primitives
- Options recorded: a renderer hook `T.onFailure` (the v1 sketch, archived); a registered slot or renderer registry (rejected); deferring rendering until the primitive version ran (the 2026-10-25 ruling, lifted at C1)
- Sources: docs/book/vivace/planning-dsl.md §7 (C1); docs/book/standard/contracts.md §7 (cited there); docs/plans/planning-pilot.md §1, stage C1; B-081; docs/book/language-reference.md (a predicate that answers an error value)
- Book home (fragments' proposal): Contracts and invariants, cited from The planning DSL
- Notes: remaining under B-081: the inspect channel, call-site origin, rendering the refused value.
- Notes (2026-11-12, DR5): moved from Part V and renamed from "A refinement predicate explains its own refusal": the decision is general, not about plans. Restated on the Part IV review's rule about truth; the entry had the kernel carry an error value's text.
- Chapter: When a check fails

### Models

**The introduction to Part V, ruled 2026-11-12 (DR5).** Not a list of decisions: definitions, a goal, observations and scope, as the maintainer set them out.

> **What Vivace is for.** A model is a description of a system, written in a language made for its domain and precise enough to be checked. A meta-model is that language: its types, its notation and its claims. Modelling is the practice of building a shared understanding of a system by writing, checking and revising models of it. Allegro is a platform for checked languages. Vivace is narrower: it supplies the meta-models and the tools for constructing models, inspecting them, transforming them, relating them and searching them.
>
> Two things are already decided by earlier parts. A model is checked with the same rigour as any other program. Checking a model and running it are the same evaluation, without and with the capability to act.
>
> The goal: declarations and rules, findings and failures are each written in the language that expresses them most clearly and efficiently. A language is extended so that it corresponds more closely to a model, never because a rule could not otherwise be said.
>
> Two observations. Real problems need several models that interact in subtle ways, which is a central difficulty of model-driven engineering. Many domains need search and optimization, which are hard to state in traditional programming languages.
>
> Beyond modelling, Vivace brings meta-modelling: the discipline and the means of building and evolving models. It supplies tools to analyse a model, logically and empirically; it does not supply the answers.

#### A model is a value
- Decides: a model is a value built from a meta-model: the language it is written in, with its types, notation and claims. Ordinary functions construct it, inspect it, transform it and compare it, and Vivace supplies the meta-models and tools for doing so.
- Status: partly built (plans are values built through a library); ruled 2026-11-12 (DR5)
- Type: capability
- Rationale kind: vision
- Depends on: A system is described in the language of its domain, and that language grows with the understanding; A language inherits every check of what it is built on; One value universe; Types are values that constrain values
- Significance: 5 — everything Vivace does to a model is done to a value
- Label: foundational — search, mappings and analysis all take models as values
- Options recorded: a model that exists only as program text, or only as a set of types (not chosen: neither can be searched, compared or mapped by ordinary functions)
- Sources: the maintainer's rulings of 2026-11-12 (../records/book-pass/dr5-part-5-vivace.md, Rulings taken); docs/book/vision.md §4; docs/book/vivace/README.md
- Notes: new, by ruling; replaces "Vivace adds a discipline, not machinery" and "Vivace hypothesis: models as the review artefacts", whose other statements are decisions of Parts I and IV or are told in the part's introduction. The maintainer: "a model is definitely a value and Vivace provides the tools and meta-model(s) to construct model values (as well as inspect, transform, compare, etc)". Vivace brings mechanisms, all of them extensions; it adds nothing to what must be trusted.
- Chapter: Models

#### A transformation is a model
- Decides: a transformation from one model to another is written declaratively, as a model that defines a function, and is never only an imperative function. It can therefore be inspected, compared and checked like the models it relates.
- Status: open; ruled 2026-11-12 (DR5)
- Type: capability
- Rationale kind: vision
- Depends on: A model is a value; A mapping between models is itself a checked value
- Significance: 4 — what relates models is as open to inspection as the models
- Label: foundational — mappings, evolution and generation
- Options recorded: transformations as imperative functions, opaque to everything but a call
- Sources: the maintainer's rulings of 2026-11-12 (../records/book-pass/dr5-part-5-vivace.md, Rulings taken)
- Notes: new, by ruling. The maintainer: "Transforms are also models - not just imperative functions, declarative models that define functions."
- Chapter: Models

#### Two models relate only through a declared mapping
- Decides: every relation between two models is a mapping that is declared, formally defined and checked. Vivace defines each kind of mapping through which models can relate.
- Status: open; ruled 2026-11-12 (DR5)
- Type: capability
- Rationale kind: vision
- Depends on: A transformation is a model; A mapping between models is itself a checked value
- Significance: 5 — real problems need several models that interact
- Label: foundational — composing models, and solving across them
- Options recorded: models coupled implicitly, through shared names or code that reads both
- Sources: the maintainer's rulings of 2026-11-12 (../records/book-pass/dr5-part-5-vivace.md, Rulings taken); docs/plans/planning-loop.md §6 (the second model's composition point)
- Notes: new, by ruling; the maintainer sees it as critical: "Vivace needs to formally define every mapping through which two models can relate." The kinds are to be worked out; candidates: one model's values typed by another's; a claim that spans two models; a translation with claims about what it preserves; one model as a more detailed version of another; a view of part of a model. Absorbs "Composition of models and the AI loop over a model" and "Mixed-model solution finding as the capstone": several models coupled into one space of solutions is the direction this decision and the decisions on search lead to. The planning-loop stream's first design for a composition point: a plan's outcome typed by a system model's artifact.
- Chapter: Models

#### A change to a model is a mapping from the old one
- Decides: evolving a model uses the mechanism that relates two models: the new version is related to the old by a declared mapping, with claims about what it preserves.
- Status: open; ruled 2026-11-12 (DR5)
- Type: capability
- Rationale kind: vision
- Depends on: Two models relate only through a declared mapping
- Significance: 3 — a model changes as understanding does
- Label: swappable — how versions are related
- Options recorded: none recorded
- Sources: the maintainer's rulings of 2026-11-12 (../records/book-pass/dr5-part-5-vivace.md, Rulings taken)
- Notes: new, by ruling.
- Chapter: Models

### Search and optimization

#### Solving is proposing a value for an unknown, and the kernel checks it
- Decides: a model with parts not yet supplied is a claim waiting for values. A search routine, an outside solver, a person or an AI may supply them. None needs to be trusted, because the candidate is evaluated.
- Status: partly built (plan templates, catalogs and the proposal loop); ruled 2026-11-12 (DR5)
- Type: capability
- Rationale kind: technical
- Depends on: A model is a value; Anyone may propose, and the record shows who; When information arrives, what waited on it is evaluated again; The kernel trusts only what it has evaluated
- Significance: 5 — search needs no trusted solver
- Label: foundational — every solver and every proposer
- Options recorded: a solver whose answer is accepted on its word
- Sources: the maintainer's rulings of 2026-11-12 (../records/book-pass/dr5-part-5-vivace.md, Rulings taken); docs/plans/planning-loop.md §6
- Notes: new, by ruling. The planning-loop stream's rulings are its first instance: a gap in a plan is an obligation, and a proposal is one catalog entry that never edits the author's plan.
- Chapter: Search and optimization

#### A solver sees its problem unevaluated
- Decides: an unknown may be represented by an unbound symbol, and ordinary evaluation of an expression that holds one gives a residual. A solver takes its problem unevaluated, evaluates what it chooses, and reads the result: which parts are resolved and which are not. Vivace supplies functions that return the two.
- Status: open, a design to prove; ruled 2026-11-12 (DR5)
- Type: capability
- Rationale kind: technical
- Depends on: Solving is proposing a value for an unknown, and the kernel checks it; A function may take an argument unevaluated; Evaluation is total over unresolved information; Reading an expression never yields authority
- Significance: 4 — how a search is written as an ordinary function
- Label: foundational — search and optimization written in Allegro, open to partial evaluation
- Options recorded: a primitive that asks of any value whether it is resolved (`is_resolved`, removed in the Part IV review: it makes any function's behaviour depend on the phase; here only a function that declares an unevaluated argument sees a residual, and it sees it by reading an expression)
- Sources: the maintainer's rulings of 2026-11-12 (../records/book-pass/dr5-part-5-vivace.md, Rulings taken)
- Notes: new, by ruling. The maintainer: unknowns may be represented by unbound symbols, and normal evaluation turns those, and hence a solver function, into a residual; solver functions can take unevaluated arguments, "but this may be a use case for something akin to `is_resolved`"; "Vivace should provide functions that parse expressions and return resolved and unresolved parts." The maintainer confirmed on PR #193: reading the residual of an expression the solver evaluated itself is correct, and `is_resolved` is not; different grammars may handle unknowns differently, so an unbound symbol is one representation. A second use case for unevaluated arguments, after `if` with knowledge in its branches. A candidate is tried by evaluating the problem with the unknown's name rebound, a kernel primitive.
- Chapter: Search and optimization

#### Feasible is decided; best says how strongly it holds
- Decides: that a candidate satisfies a model is decided by evaluation. That no better candidate exists is a claim over all candidates: decided only by exhausting them, and otherwise sampled or assumed. Search finds a feasible answer; optimization claims the best.
- Status: partly built (enumeration over plan templates); ruled 2026-11-12 (DR5)
- Type: capability
- Rationale kind: technical
- Depends on: Solving is proposing a value for an unknown, and the kernel checks it; Every result says how strongly it holds; A claim about every value is decided by evaluating it with the value unknown
- Significance: 4 — an optimum never claims more than was shown
- Label: foundational — every optimizer
- Options recorded: one verdict for a solution, with no distinction between satisfying the model and being the best
- Sources: the maintainer's rulings of 2026-11-12 (../records/book-pass/dr5-part-5-vivace.md, Rulings taken)
- Notes: new, by ruling. The maintainer: "Feasible vs best is exactly my understanding of search vs optimization."
- Chapter: Search and optimization

### Analysing models

#### A model's quality is a question for analysis
- Decides: whether a model is effective, efficient or correct, and when it should be split in several, are questions Vivace gives the tools to analyse, logically and empirically. It does not give the answers. A logical finding is a claim about a model or its meta-model; an empirical one is a measurement over the model's uses, and says so in its strength.
- Status: open; ruled 2026-11-12 (DR5)
- Type: capability
- Rationale kind: vision
- Depends on: A model is a value; Every result says how strongly it holds
- Significance: 3 — meta-modelling is a practice with tools, not a set of rules
- Label: swappable — the analyses offered
- Options recorded: rules that pronounce a model good or bad
- Sources: the maintainer's rulings of 2026-11-12 (../records/book-pass/dr5-part-5-vivace.md, Rulings taken)
- Notes: new, by ruling. The maintainer: "what Vivace provides is the tools to analyze models logically and empirically to help answer questions like effectiveness and efficiency." Open questions, listed and not decided: what makes a model effective; when to decompose one; which of these judgments can be stated as claims about a language.
- Chapter: Analysing models

### Units of measure

**A worked language.** Reworded in the Part IV review (DR4); placed in Part V, where worked languages go. Evidence for the decisions of this part, not a set of book decisions in its own right.

#### Dimensions as data, named dimensions as refinements over one Quantity
- Decides: a dimension is structural data (the full seven-vector of SI base dimensions) and each named dimension is a refinement over one `Quantity` record, so dimensional soundness is refinement discharge, with a mechanics-focused shipped unit set.
- Status: settled
- Type: capability
- Rationale kind: mixed
- Depends on: Refinement types; Default equality belongs to the standard extension; A module is an extension that arrives as a file; A language inherits every check of what it is built on; Correctness and safety are one kind of claim
- Significance: 3 — the demonstration that a domain check needs no new machinery
- Label: swappable — a library over the kernel
- Units: not yet a unit
- Options recorded: dynamically minted nominal dimension types (rejected: would push to host code; revisitable at the user-generics surface); a reduced base dimension set (rejected); dynamically minted nominal dimension types (rejected: pushes toward host code and memo identity; a smaller base-dimension set
- Sources: U-R1, U-R5 (docs/decisions.md; docs/plans/units-dsl.md §1–§2, §5); D4; docs/plans/units-dsl.md §5); docs/book/demo-ladder.ir.md C68, C72, C73
- Book home (fragments' proposal): proposed chapter "Units of measure" (L2 domain surface) / Rung 2: the units DSL (proposed)
- Notes: Merged from fragment B ("Dimensions as data, named dimensions as refinements"), fragment C ("Dimensions as data, named dimensions as refinements over one Quantity"). B: accepted cost: `type of q` answers Quantity. C: accepted cost: `type of q` answers Quantity, not Velocity. Significance calibrated from 2/3.
- Chapter: Units of measure

#### Quantity laws at honest tiers
- Decides: the quantity laws are shown at their real strengths (sampled, assumed, undecided), loudly, rather than restricting the demonstration to laws that are decided.
- Status: settled
- Type: capability
- Rationale kind: vision
- Depends on: Law strengths and the transitivity gate; Every result says how strongly it holds; Dimensions as data, named dimensions as refinements over one Quantity
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
- Depends on: Dimensions as data, named dimensions as refinements over one Quantity; The `grammar { … }` block
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

### Plans as outcome graphs

**Held, not ruled (DR5, 2026-11-12).** A worked language is evidence for the decisions of this part, and its internal design is largely arbitrary. The maintainer set the pilots aside until the foundational decisions are clear. These entries keep their first-proposal wording, apart from dependency names. Known conflicts with the ruled parts, for when the pilot is taken up: "Two enforcement shapes for a well-formed plan" has a constructor that yields an error value, where a failed construction is now a refutation and an open plan is one that claims nothing yet.

#### A plan is an outcome graph with derived wiring
- Decides: a plan is a DAG of nodes with typed inputs and outcomes, whose edges are derived from wiring an outcome into every input of the same type in scope, with names assigned only where a match is ambiguous; the performer is metadata, never structure.
- Status: settled
- Type: capability
- Rationale kind: mixed
- Depends on: A model is a value
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
- Depends on: A plan is an outcome graph with derived wiring; A module is an extension that arrives as a file
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

### Finding solutions to a plan

**Held, not ruled (DR5, 2026-11-12).** A worked language is evidence for the decisions of this part, and its internal design is largely arbitrary. The maintainer set the pilots aside until the foundational decisions are clear. These entries keep their first-proposal wording, apart from dependency names. Known conflict: "Library search over kernel residuals" computes a plan's bound in library code, where evaluating the plan with its choices unknown should give it; an expedient, with "A solver sees its problem unevaluated" as the target.

#### Choices, templates and solution finding by enumeration
- Decides: a node with `options:` is a choice, a plan with choices is a template, and `solve` enumerates resolutions, keeps the well-formed ones and answers the best by the bound's effort and then its duration, naming the cheapest failing resolution when none fits.
- Status: settled
- Type: capability
- Rationale kind: mixed
- Depends on: Estimates roll up, budgets are proved; A model is a value
- Significance: 3 — the first solution finding over a model
- Label: swappable — the search is library code
- Units: not yet a unit
- Options recorded: scheduling under a resource limit; completion from a catalog; retry tuning (weighed and deferred at D1); inference rather than choice
- Sources: R3 of docs/plans/planning-pilot.md §3; docs/book/vivace/planning-dsl.md §2.7, convention 13, §7 (D1); docs/book/vision.md §1a ("solution finding is search")
- Book home (fragments' proposal): The planning DSL
- Notes: no choice in a borrowed plan or a recovery; a borrowed plan is solved before borrowing.
- Chapter: Finding solutions to a plan

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
- Chapter: Finding solutions to a plan

#### Library search over kernel residuals
- Decides: the planning search computes its bound directly in the library rather than leaving choices unresolved and reading an interval off the kernel's residual rollup; revisit when a model's constraint is a predicate the kernel already reasons about.
- Status: settled
- Type: implementation — where the bound is computed; the answer is the same
- Rationale kind: technical
- Depends on: Completion from a catalog; A claim about every value is decided by evaluating it with the value unknown
- Significance: 3 — where Vivace search sits relative to the falsifiable constraint
- Label: swappable — the search can move to the kernel later
- Units: not yet a unit
- Options recorded: kernel residuals with interval domains (rejected: needs interval arithmetic over quantities, predicate propagation onto residuals (B-098) and a read-back surface, and yields a bound, not a selection)
- Sources: docs/book/vivace/planning-dsl.md §7 (D2 paragraph), §8
- Book home (fragments' proposal): The planning DSL
- Notes: a library search is not a parallel proof infrastructure, but the book should argue that against the falsifiable constraint explicitly.
- Chapter: Finding solutions to a plan

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
- Chapter: Finding solutions to a plan

### The kernel's interface

**The introduction to Part VI, ruled 2026-11-13 (DR6).** Not a list of decisions: the roles and the ways the platform is used, as the maintainer asked.

> **Who does what.** The kernel evaluates, and records the outcome of claims. A launcher is host code that creates a kernel, gives it its first extensions and capabilities, and starts an evaluation. A primitive function is a function whose body is host code; it is effectful or pure, and a capability is a named set of effectful ones. An extension is Allegro code: the parser engine, the module loader, the standard language, a domain language. A saved program rebuilds a program in a kernel without parsing. A configuration is all the information that determines an execution.
>
> **How the platform is used.** Running a script. Checking a project. A session at a prompt. Building in one place and running in another. Exporting to a target platform. Embedding a kernel in an application. A page in a browser. A tool reading a phase's result. A person or an agent answering obligations.

#### The kernel is passive
- Decides: the kernel acts only on calls of its interface. It starts nothing, reads nothing and knows nothing of configuration or phases.
- Status: open; ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: What the kernel requires of an extension; The kernel's primitives are pure and few
- Significance: 4 — everything outside the kernel is someone else's decision
- Label: foundational — the launcher, configuration and phases
- Options recorded: a kernel that reads its configuration and loads its extensions itself
- Sources: the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: a test harness creates a kernel, makes three calls and discards it; nothing else has happened.
- Notes: new, by ruling.
- Chapter: The kernel's interface

#### What the kernel's interface offers
- Decides: a caller can construct values (bits, symbols, structures, expressions, primitive functions, composed functions); bind a symbol to a value in a scope; create a scope, as a child of another or sharing nothing with any other; evaluate an expression in a scope; fill a cell when a value arrives; read a result with its metadata; obtain a residual; set limits; and receive kernel faults.
- Status: open (the host calls the evaluator's functions directly); ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: The kernel is passive; One value universe; The environment is not a value; A missing value is a cell that is filled once; Evaluation stops early for two reasons only
- Significance: 4 — the one door between host code and the kernel
- Label: foundational — launchers, saved programs and embedding
- Options recorded: no stated interface, each host reaching into the evaluator (what the code does)
- Sources: the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: an application embeds a kernel, binds its own data as values, evaluates a rule and reads back the result and what it rests on.
- Notes: new, by ruling. The maintainer listed constructing, binding, evaluating and creating scopes; the review added cells, results, residuals, limits and faults. A scope that shares nothing with any other is what lets specific code be given specific capabilities. Inside Allegro the environment is still not a value: a scope is a handle of the interface.
- Held finding (2026-11-13, DR6): there is no stated interface: the CLI, the browser bundle and the tests call `evalSource` and the evaluator's internals.
- Chapter: The kernel's interface

#### No interface call writes a bare claim outcome
- Decides: the outcome of a claim enters a kernel in two ways only: the kernel decides it, or it is restored with its builder's name. A field an extension owns is never written through the interface; the extension's constructors are replayed.
- Status: open; ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: What the kernel's interface offers; Only the kernel records the outcome of a claim; An extension registers its own fields; the kernel has two
- Significance: 5 — host code cannot forge a result
- Label: foundational — trust in every result
- Options recorded: an interface call that sets any field of any value
- Sources: the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: a host-code extension tries to hand the kernel a value marked as proven; no call exists that would do it.
- Notes: new, by ruling.
- Chapter: The kernel's interface

#### Limits are step budgets
- Decides: a caller limits an evaluation by a budget of steps, which is deterministic. A limit by the clock belongs to the launcher. An evaluation with a budget is also available to code inside the kernel, for evaluating what it does not trust. A limit leaves claims undecided.
- Status: open (a depth bound exists); ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: What the kernel's interface offers; Evaluation stops early for two reasons only; The same program and the same information give the same result
- Significance: 3 — a runaway evaluation ends the same way every time
- Label: swappable — the unit of the budget
- Options recorded: limits by the clock inside the kernel (rejected: the same program would give different results)
- Sources: the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: a solver gives each candidate ten thousand steps; a candidate that runs out is undecided, and is so on every machine.
- Notes: new, by ruling.
- Chapter: The kernel's interface

### Configuration

#### Configuration is all the information that determines an execution
- Decides: it includes which kernel to use; the definitions of capabilities, phases and pipelines; which implementation each capability maps to; the parser engine and the module loader; information about the environment; and the parameters of the invocation. How much of it the launcher manages and how much Allegro code manages is left open on purpose.
- Status: open; ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: The kernel is passive; Phases are configuration; A capability is supplied per target
- Significance: 4 — one word for everything that makes two runs differ
- Label: foundational — launching, phases and trust
- Options recorded: a fixed split between a launcher's configuration and a program's inputs (the review's first proposal; withdrawn: a launcher may be minimal, and what Allegro code manages is open to partial evaluation and to claims)
- Sources: the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: the same program is checked on a laptop and run on a server; only the configuration differs.
- Notes: new, by ruling. The maintainer's definition: "all information that determines how an Allegro execution is performed".
- Chapter: Configuration

#### Configuration sources have a priority, and a result says which supplied each value
- Decides: configuration is read from sources in a stated order: built into the launcher, the environment, files, the command line. A value missing from one source is taken from the next. The result of an execution records which source supplied each value.
- Status: open; ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: Configuration is all the information that determines an execution; Every result says how strongly it holds
- Significance: 3 — an override is never silent
- Label: swappable — the sources and their order
- Options recorded: silent override by the highest source
- Sources: the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: a flag on the command line replaces a value from the project's file, and the report shows that it did.
- Notes: new, by ruling. An environment variable that redirects a capability to another implementation is a risk the chapter on trust takes up.
- Chapter: Configuration

#### A full configuration is a model, evaluated in a first phase
- Decides: a configuration is written in a language of its own and evaluated like any model, in a phase that runs before the others. Only the minimum needed to start stays in host form.
- Status: open, a design to prove; ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: Configuration is all the information that determines an execution; A model is a value
- Significance: 3 — a configuration gets the checks every model gets
- Label: swappable — the configuration's language
- Options recorded: configuration as files in a host format, read by the launcher only
- Sources: the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: a project's configuration claims that no phase is given network access; the claim is checked before anything runs.
- Notes: new, by ruling; it gives the sources' configuration phase a meaning.
- Chapter: Configuration

### Launching

#### The launcher does only what cannot be done in Allegro
- Decides: a launcher is host code invoked on a system to create a kernel and have it evaluate a program. It must load a kernel, give it the first extensions and capabilities, and start the evaluation. Anything more a launcher does is an earlier phase, run ahead of time and saved, so a minimal launcher and a fully loaded one are the same design at different points.
- Status: open; ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: The kernel is passive; What the kernel's interface offers; The kernel contains only what no extension could supply
- Significance: 4 — the launcher's size is a choice of speed, never of meaning
- Label: foundational — every launcher, shipped or embedded
- Options recorded: a launcher with duties fixed by the platform
- Sources: the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: an exported program's launcher holds every extension it needs already built; a development launcher holds a parser and a loader and finds the rest.
- Notes: new, by ruling. The criterion mirrors the kernel's own. The parser engine and the module loader are the two extensions every launcher provides.
- Chapter: Launching

#### Only the launcher sets the ceiling
- Decides: the capabilities a launcher gives an execution are a ceiling: no code inside can exceed it. Within it, code still has to be handed a capability, by value or by being evaluated in a scope that holds it.
- Status: open; ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: The launcher does only what cannot be done in Allegro; A capability is granted, never acquired; What code may do is bounded by the capabilities it is given, and that bound is a claim
- Significance: 5 — what an execution can do at all is decided outside it
- Label: foundational — every grant inside
- Options recorded: capabilities bound by name where all code can reach them (rejected: nothing is granted by name)
- Sources: the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: a check phase is launched with no capability to act; nothing the program loads can write a file.
- Notes: new, by ruling.
- Chapter: Launching

#### Startup, step by step
- Decides: (1) a launcher is invoked with a configuration and a phase. (2) It creates a kernel, which has its kernel primitives and nothing else. (3) It loads the first extensions, each once and in the order their dependencies require; the first are saved programs, since no text can be read before a parser exists. (4) It creates the capabilities of the ceiling and hands each to the code the configuration names. (5) It builds the main program's expression, usually by asking the loader for the main module, and has the kernel evaluate it. (6) It delivers values that arrive later. (7) When nothing waited for is outstanding it handles the result, or the program has done so through a capability.
- Status: open; ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: The launcher does only what cannot be done in Allegro; Only the launcher sets the ceiling; What the kernel requires of an extension; A module is an extension that arrives as a file; Running a program is evaluating its main module with a configuration's capabilities
- Significance: 4 — how the parts fit together
- Label: swappable — the order within the constraints the steps state
- Options recorded: none recorded
- Sources: the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken); docs/book/platform/tooling.ir.md C34 to C50
- Use case: `allegro check project.alg`: the seven steps, with an empty ceiling at step 4.
- Notes: new, by ruling. Absorbs "File runner as one evaluation with futures drained". The maintainer: the process is defined in detail "so people understand how it all hangs together".
- Held finding (2026-11-13, DR6): a kernel with no extension loaded cannot load one (carried over from the Part I review).
- Held finding (2026-11-13, DR6): the suite runs demos through `evalSource` with extensions it chooses, not through the file runner, so a demo can pass the suite and fail the runner.
- Chapter: Launching

#### One kernel serves many invocations
- Decides: a launcher may have one kernel evaluate a stream of commands, events or requests, each in its own scope with its own capabilities. The stream may equally be handled by Allegro code through a capability.
- Status: partly built (the prompt); ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: What the kernel's interface offers; Only the launcher sets the ceiling; Running a program is evaluating its main module with a configuration's capabilities
- Significance: 3 — servers, prompts and tools that stay running
- Label: swappable — who drives the stream
- Options recorded: a new kernel for every invocation
- Sources: the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: a server answers each request in a fresh scope that holds only that request's capabilities.
- Notes: new, by ruling.
- Chapter: Launching

### Capabilities and primitive functions

#### A capability is a named set of effectful primitives
- Decides: a capability is defined once, in Allegro, by its name and its parts, so that a bound on capabilities can name it. It is implemented per target by primitive functions, and it is what gets granted. A primitive function that performs no effect needs no grant.
- Status: open; ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: Host code reaches a program only as primitive functions; A capability is supplied per target; A capability has named parts and narrowed forms; An effect is the use of a capability
- Significance: 4 — what is granted has a definition a program can read
- Label: foundational — grants, bounds and targets
- Options recorded: capability definitions held in configuration only (not chosen: a program's bounds must be able to name them)
- Sources: the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: `files` is defined once with the parts read and write; the terminal and the browser each implement it.
- Notes: new, by ruling. The maintainer: capabilities "are defined abstractly (e.g. file I/O, network I/O)", mostly independent of platform, and mapped to implementations for a target.
- Chapter: Capabilities and primitive functions

#### A module is a function of the capabilities it declares
- Decides: a module is a function. Its parameters are the capabilities and inputs it declares, and the modules it imports. Its body holds its bindings and its top-level effects, in written order. Loading a module constructs that function and evaluates nothing. Instantiating it is a call, made by whoever loaded it.
- Status: open; ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: A module is an extension that arrives as a file; Only the launcher sets the ceiling; A capability is granted, never acquired; The loader reaches files through a capability
- Significance: 4 — what a module can do is visible where it is loaded
- Label: foundational — confinement of every dependency
- Options recorded: capabilities passed only as arguments to an entry function (a narrower form of the same thing)
- Sources: the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: a logging module declares output; the module that imports it hands over a narrowed form that can only append to one file.
- Notes: new, by ruling. It needs the kernel primitive for evaluating with names rebound to supply the complete set of names (noted on "The kernel's primitives are pure and few").
- Notes (2026-11-13, after the adversarial review): reworded by ruling: the decision is taken literally, for a module loaded from text and for a saved program alike. Whether a module is instantiated once in a kernel or once for each set of capabilities supplied is issue 13 of the adversarial review, still open.
- Chapter: Capabilities and primitive functions

#### Only the module being run performs effects when instantiated
- Decides: instantiating the module a launcher runs performs its top-level effects, in written order. Instantiating any other module performs none: a library holds capabilities inside its functions and uses them when called, and one that must act at startup offers a function for the program to call. A session at a prompt is the module being run.
- Status: open; ruled 2026-11-13
- Type: capability
- Rationale kind: technical
- Depends on: A module is a function of the capabilities it declares; Order of definition carries no meaning; The same program and the same information give the same result
- Significance: 3 — importing a library never does anything
- Label: foundational — the order in which modules are instantiated cannot be observed
- Options recorded: any module may perform top-level effects, in dependency order, with the order among independent modules unspecified (rejected: that order would be observable); a saved program that evaluates at load (rejected: the loader loses control of when effects happen); top-level effects gathered into a function under a reserved name (the maintainer's suggestion; the module as one function is the same idea without the name)
- Sources: the maintainer's rulings of 2026-11-13 (../records/book-pass/adversarial-review.md, Rulings taken)
- Use case: a library's author leaves a `print` at its top level; the check phase refutes it, where another platform would print on every import.
- Notes: new, by ruling. It is checkable as a claim: instantiated with no capabilities, a library's residual has no effect call outside a function body. Registering a metadata field is a kernel primitive, not an effect in this sense.
- Chapter: Capabilities and primitive functions

#### Loading is three capabilities of rising strength
- Decides: loading a module from text, loading a saved program in data form, and loading host code are three capabilities. Text is checked like any program. Data is confined to the kernel's interface. Host code can do anything, so its capability is given only to trusted code and is narrowed to a list of files pinned by content hash. A configuration can claim that no host code is loaded after startup.
- Status: open; ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: A module is a function of the capabilities it declares; The loader reaches files through a capability; A capability has named parts and narrowed forms; Host code reaches a program only as primitive functions
- Significance: 4 — untrusted code has a way in that gives it nothing
- Label: foundational — extensibility at run time, and its control
- Options recorded: host code loaded by the launcher only (safer; it stops a program choosing its drivers); a list of allowed paths (weaker: a file can change between the check and the load)
- Sources: the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: a program that connects to several databases loads only the drivers it needs, from a pinned list.
- Notes: new, by ruling. The maintainer allowed host-code loading from inside the kernel, with these controls, and noted that such features "may be blocked in high-compliance environments".
- Chapter: Capabilities and primitive functions

#### Every pure primitive the platform ships has a reference definition
- Decides: the meaning of a pure primitive is a composed function. The host code is an optimisation claimed equal to it, and anyone can run on the definitions alone, trusting only the kernel.
- Status: open, a goal; ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: Host code reaches a program only as primitive functions; Machine arithmetic is a set of pure primitives that ships with the platform; No interface limits optimization
- Significance: 3 — pure host code stops being a matter of trust
- Label: swappable — which primitives have one
- Options recorded: purity and meaning of a primitive taken on its author's word (the default until a definition exists)
- Sources: the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: integer addition is defined on bits in Allegro; the machine's adder is used, and a doubtful result can be recomputed without it.
- Notes: new, by ruling: the maintainer holds it a worthwhile goal. Takes the item the Part I review deferred, capability bodies written as Allegro expressions.
- Chapter: Capabilities and primitive functions

### Phases

#### The platform ships three phases: check, run and export
- Decides: a phase is one evaluation, defined by the information and the capabilities available to it. Check evaluates a program with no capability to act and reports on every claim. Run supplies capabilities. Export emits code for a target in place of performing capabilities.
- Status: open (the pipeline's stages are fixed in host code); ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: Phases are configuration; Only the launcher sets the ceiling; A capability is supplied per target
- Significance: 4 — what a user does first, named
- Label: swappable — the shipped set
- Units: pipeline, evaluator
- Options recorded: seven phases (invocation, configuration, compile, emit, package, deploy, execute; the sources' list, kept as phases a project may define); a fixed pipeline of stages (what the code does)
- Sources: docs/book/layers.md §2, §3 (M6); docs/book/platform/README.md (T-build fragments); docs/book/platform/build-pipeline.ir.md C122 to C126; docs/plans/release-track.md §3 D5; docs/book/vision.md §1; the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: a commit hook runs check; a deploy script runs export and then, on the target, run.
- Notes: replaces "Multi-phase build as successive partial evaluation" and the build pipeline's entries. What those entries described is ruled elsewhere: precompile by "A claim about every value is decided by evaluating it with the value unknown"; effects deferred by "Phases are configuration"; the cutoff for recursion and the precompile context's entries by "A recursive call is evaluated once for each state of knowledge"; soft failure by Part I's rule that a phase reports every refutation in its result. The diagnostic switches are housekeeping.
- Held finding (2026-11-13, DR6): phases are hard-coded: `evalSource` runs a fixed list of stages, with precompile, the post-passes and soft failure among them (carried over from the Part I review).
- Held finding (2026-11-13, DR6): the soundness review of the cutoff for recursive bindings is pending.
- Chapter: Phases

#### A phase hands its residual to the next
- Decides: the residual of a phase is a program: a value that can be saved, loaded and evaluated further. A sequence of phases is a pipeline. A phase may state what it must leave decided before the next begins.
- Status: open; ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: The platform ships three phases: check, run and export; Evaluation is total over unresolved information; An effect consumes only values whose claims are decided
- Significance: 4 — building is evaluating in steps
- Label: foundational — pipelines, saved programs and export
- Options recorded: phases that each start from source
- Sources: the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: a build phase resolves everything but the request data; the server's run phase starts from that residual.
- Notes: new, by ruling.
- Chapter: Phases

#### A project defines a phase or extends one
- Decides: a phase is defined by naming its extensions, its capabilities, what it must leave decided and what happens to its result. A project extends a shipped phase by adding to any of these.
- Status: open; ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: A phase hands its residual to the next; Nothing is a claim until someone makes it; Configuration is all the information that determines an execution
- Significance: 3 — a project's process is configuration
- Label: swappable — the form of a definition
- Options recorded: a fixed set of phases
- Sources: the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: a project extends check with the claim that every function terminates, and adds a package phase after export.
- Notes: new, by ruling.
- Chapter: Phases

### Saved programs and export

#### A saved program is a recorded sequence of interface calls
- Decides: a saved program rebuilds a program in a kernel without parsing. Its data form is a record that constructs values and can do nothing else: it cannot evaluate, fill a cell, set a limit or reach any scope. What it yields is a module function. It names the pure primitives it needs by content hash and never names a capability; a capability reaches it only as an argument when the module is instantiated. A host-code form is also offered: it can hold primitive functions and even implement a capability, and is loaded as host code is.
- Status: open; ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: What the kernel's interface offers; A phase hands its residual to the next; Loading is three capabilities of rising strength
- Significance: 4 — how the first parser, the standard language and every build arrive
- Label: foundational — startup speed and distribution
- Options recorded: host code only (the maintainer's first definition: efficient, but loading it is running arbitrary code); data only (cannot hold a primitive function)
- Sources: the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: the standard language is built once and saved; every later start replays the record.
- Notes: new, by ruling. "The platform's parser engine ships already built" is its first use.
- Notes (2026-11-13, after the adversarial review): reworded by ruling, answering issue 25 of the adversarial review (a record could contain any interface call). The first version of the data form, `next/kernel/saved-program.ts`, holds no claim outcomes, no keys and no origins, and defines the data form only; those return with the rulings on identity and on strength.
- Chapter: Saved programs and export

#### A saved program names what it needs by content hash
- Decides: a saved program names each primitive function and each extension it depends on by a hash of its content. A mismatch at load is a refutation.
- Status: open; ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: A saved program is a recorded sequence of interface calls; Order of definition carries no meaning
- Significance: 3 — a saved program never runs against something else
- Label: swappable — how a dependency is identified
- Options recorded: trusting that the loading execution has the same versions; version numbers
- Sources: the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: a saved library built against one arithmetic implementation refuses to load beside another.
- Notes: new, by ruling. The maintainer: this "is inviting dependency hell, but every modular programming platform that's successful goes to dependency hell as punishment. I think hash checks will work for now." A checked mapping between two versions of a model might later serve as a compatibility claim; the maintainer is sceptical on grounds of combinatorial complexity.
- Chapter: Saved programs and export

#### A stored outcome is restored with its builder's name
- Decides: because evaluation is deterministic, a stored outcome is what the loading kernel would compute. Restoring one stamps it with the identity of whoever built the saved program, and nothing removes the stamp. The kernel computes the claim's key itself, from the claim and what it rests on, so an outcome cannot be attached to another claim. Restore is a capability narrowed to one builder, and a configuration may withhold it. Deciding again is always available.
- Status: open; ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: No interface call writes a bare claim outcome; A saved program names what it needs by content hash; The same program and the same information give the same result; Every result says how strongly it holds
- Significance: 5 — a build's results can be reused without being taken on faith silently
- Label: foundational — saved programs, builds and distribution
- Options recorded: deciding everything again at every load (nothing trusted, nothing saved; kept as an option); restored outcomes that drop to assumed; restore as a call only a launcher can make (safer, and it stops loaders written in Allegro)
- Sources: the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: a team's build server saves a library with its laws decided; a developer's kernel restores them stamped with the server's name, and an auditor decides them again.
- Notes: new, by ruling. The maintainer: fully rechecking on load "will likely be opt-in"; restore is allowed inside the kernel and is configurable, which "means mostly we need to always analyze for vulnerabilities".
- Chapter: Saved programs and export

#### A target platform is a model, and export is a transformation into it
- Decides: export maps a residual expression to a target's code. The target platform is a model, and the mapping is declared as every transformation is. Export includes the target's own capabilities for the phases that follow there: deploy, load, run, invoke. JavaScript is the first target.
- Status: open; ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: A phase hands its residual to the next; A transformation is a model; Two models relate only through a declared mapping; A capability is supplied per target
- Significance: 4 — a program leaves the platform through a checked mapping
- Label: foundational — every target
- Options recorded: a code generator outside the language (the sources' plan; it named continuations and algebraic effects, which go: an effect is the use of a capability)
- Sources: docs/book/layers.md §2, §3 (M8); docs/book/platform/README.md; B-072; the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: a service is exported to JavaScript with the target's own implementation of HTTP for its run phase.
- Notes: replaces "Code generation from the expression graph, JavaScript first". The maintainer's terms: target, target platform, export target; not backend.
- Chapter: Saved programs and export

#### Saving is export to a target whose model is the kernel's interface
- Decides: a saved program needs no mechanism of its own: it is what export produces when the target is the kernel's interface.
- Status: open; ruled 2026-11-13 (DR6)
- Type: implementation — how saving is realised
- Rationale kind: technical
- Depends on: A saved program is a recorded sequence of interface calls; A target platform is a model, and export is a transformation into it
- Significance: 2 — one mechanism in place of two
- Label: swappable — saving could be built separately
- Options recorded: a serialiser of its own
- Sources: the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: the tool that saves the parser engine is the export phase with one more target.
- Notes: new, by ruling.
- Chapter: Saved programs and export

#### An exported program needs a kernel only if it handles expressions at run time
- Decides: most exported programs are graphs of functions turned into target code and carry no kernel. A claim over an input that arrives at run time becomes an ordinary check. A program that evaluates constructed code, loads modules, changes grammar over text it receives or reads residuals needs a kernel: it carries one, loads one as a library, or carries one specialised to it once the platform hosts itself.
- Status: open; ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: A target platform is a model, and export is a transformation into it; One operation: partial evaluation
- Significance: 3 — what an exported program weighs
- Label: swappable — how a kernel is supplied when one is needed
- Options recorded: a kernel in every exported program
- Sources: the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: a command-line tool exports to a few hundred lines with no kernel; a notebook server exports with one.
- Notes: new, by ruling. "This residual needs no kernel" can be a claim a target requires.
- Chapter: Saved programs and export

#### A law licenses a rewrite, and the rewritten program carries the law's strength
- Decides: an optimiser may rewrite a program by a law. The result is as strong as the law: a rewrite by a decided law changes nothing in what the program rests on; a rewrite by a sampled or assumed law says so. A capability's supplier may declare laws about it; those are assumed.
- Status: open (laws exist; nothing rewrites by them); ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: Lawful interfaces; Four strengths, one vocabulary; No interface limits optimization; A target platform is a model, and export is a transformation into it
- Significance: 3 — an optimiser anyone can extend and nobody has to trust
- Label: swappable — which rewrites are offered
- Options recorded: an optimiser with rules of its own, trusted
- Sources: docs/plans/release-track.md §3 D5; B-063; the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: a library proves that mapping twice equals mapping once with the composed function; the optimiser fuses the two loops.
- Notes: replaces "Laws licence rewrites"; answers the question two earlier reviews sent here, whether a capability's declared laws may license rewrites around its body.
- Chapter: Saved programs and export

#### How extensions are distributed
- Decides: open — as text or as saved programs, with a manifest (the hashes of the program, the kernel, its dependencies and its configuration), a signature, and versions; and how the platform itself is packaged for a browser.
- Status: open
- Type: capability
- Rationale kind: technical
- Depends on: A saved program names what it needs by content hash; A stored outcome is restored with its builder's name
- Significance: 3 — sharing work between projects
- Label: swappable — the registry and its formats
- Options recorded: none recorded
- Sources: docs/book/layers.md §2, §3 (M9, M10); docs/book/vivace/README.md (Provides; maintainer ruling 2026-07); docs/book/platform/host.ir.md C126 to C129; B-070; the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: a team publishes a domain language; another team loads it and sees whose build its results rest on.
- Notes: replaces the package half of "Self-hosting and a package ecosystem" and "Browser runtime packaging". Self-hosting is no longer an aspiration: Parts I and III require it.
- Chapter: Saved programs and export

### Trust

#### Three things are trusted: the kernel, the launcher and primitive functions
- Decides: everything else is checked. Allegro code from any source is evaluated like any program; a proposal is never trusted; a saved program is trusted as far as its builder and can be decided again.
- Status: open; ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: Trust comes from the kernel, not the author; The launcher does only what cannot be done in Allegro; Host code reaches a program only as primitive functions; Every program is evaluated the same way, however it arrives
- Significance: 5 — a user knows what they are relying on
- Label: foundational — every assurance the platform gives
- Options recorded: none recorded
- Sources: the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: an organization reviews one kernel, one launcher and a dozen primitive functions, and nothing of the four hundred libraries it uses.
- Notes: new, by ruling. The chapter opens with what a user would otherwise trust. Against a conventional stack Allegro improves four things: dependencies written in Allegro are checked; a dependency can do only what it is handed; a result names what it rests on; a stored build can be reproduced. It improves nothing for host code, and the kernel is trusted, though small. The maintainer: "A big part of the issue is a user (or organization) determining what level of trust they need, and where Allegro reliably improves on what they would otherwise do." The cases, their risks and the counter to each are chapter material: the kernel; the launcher; a capability's implementation; an extension as text; a saved program (altered, built by another kernel or configuration, out of date, carrying keys); exported code; a proposal; a configuration source.
- Chapter: Trust

#### A result names everything it rests on
- Decides: beside the extensions and capabilities Part I names, a result names the kernel variant, the configuration and its sources, the primitive functions, the builders of saved programs and the target.
- Status: open; ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: Every result says how strongly it holds; Three things are trusted: the kernel, the launcher and primitive functions; A stored outcome is restored with its builder's name; Configuration sources have a priority, and a result says which supplied each value
- Significance: 4 — trust is read, not presumed
- Label: foundational — policies and audits
- Options recorded: none recorded
- Sources: the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: a report says a property is decided, by this kernel, with these two primitives, on outcomes restored from one named builder.
- Notes: new, by ruling.
- Chapter: Trust

#### A policy is a claim over what a result rests on
- Decides: a policy is stated on a phase, as what it must leave decided; on a capability, as a requirement on what its inputs rest on; or as a profile, a named set of such claims that an organization adopts whole. A policy can only add requirements, and policies combine by conjunction: code inside can be stricter than its configuration and never looser.
- Status: open; ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: A result names everything it rests on; Nothing is a claim until someone makes it; Only the launcher sets the ceiling
- Significance: 4 — a level of trust is chosen, and then enforced
- Label: foundational — compliance
- Options recorded: policy as settings of a tool, outside the language
- Sources: the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: a profile lets the deploy capability accept only values that rest on no sampled claim and on builders the organization lists.
- Notes: new, by ruling. A strict profile might also require that no host code is loaded after startup.
- Chapter: Trust

#### A builder is identified by hash, then manifest, then signature
- Decides: in stages: content hashes for every artifact; a manifest for each saved program; a signature on the manifest, verified by a pure primitive, with the accepted keys in the configuration. Because evaluation is deterministic, anyone can rebuild a saved program and compare.
- Status: open; ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: A stored outcome is restored with its builder's name; The same program and the same information give the same result
- Significance: 3 — a builder's name means something
- Label: swappable — the scheme
- Options recorded: none recorded
- Sources: the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: a user who trusts no builder rebuilds a library from its text and finds the same hash.
- Notes: new, by ruling.
- Chapter: Trust

#### One reference kernel is the root of trust
- Decides: a kernel variant is identified by hash. One variant, small and slow, is the reference. Any other is trusted as far as it agrees with the reference, which deciding again can check. A kernel produced by partial evaluation from the reference is trusted as an export mapping is.
- Status: open; ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: Three things are trusted: the kernel, the launcher and primitive functions; A result names everything it rests on
- Significance: 3 — speed does not enlarge what is trusted
- Label: swappable — which variants exist
- Options recorded: every variant trusted alike
- Sources: the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: a fast kernel runs in production; a nightly job decides a sample of its results again on the reference.
- Notes: new, by ruling.
- Chapter: Trust

#### A primitive's purity is assumed and named unless something stronger is shown
- Decides: by default a pure primitive is taken as pure on its declaration, and results name it. Three things are stronger: sampling it; a target that runs it with no access to the outside, which enforces purity; and its reference definition.
- Status: open; ruled 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: Host code reaches a program only as primitive functions; Every pure primitive the platform ships has a reference definition; The same program and the same information give the same result
- Significance: 3 — determinism rests on it
- Label: swappable — which means a target offers
- Options recorded: none recorded
- Sources: the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: a string library ships as a WebAssembly module with no imports; it cannot read the clock.
- Notes: new, by ruling. An effectful primitive cannot be checked this way; it takes data and returns data, and is named.
- Chapter: Trust

### Tools

#### A tool reads a phase's result and adds no analysis of its own
- Decides: everything a tool shows was computed by evaluation and is in the result: types, claims and their strengths, what each rests on.
- Status: settled; reworded 2026-11-13 (DR6)
- Type: capability — a guarantee to the user
- Rationale kind: technical
- Depends on: Phases are configuration; Every result says how strongly it holds
- Significance: 3 — two tools never disagree about a program
- Label: foundational — every tool
- Units: introspect
- Options recorded: none recorded
- Sources: docs/book/platform/tooling.ir.md C11, C66 to C84; docs/book/vision.md §3, §5 principles 2 and 6; the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: an editor plug-in and the command line show the same strength for the same theorem.
- Notes: was "Inspect reports only what the pipeline computed".
- Held finding (2026-11-13, DR6): `inspect` runs without soft failure, so a halting failure never reaches a summary; 19 kind comparisons in `src/introspect.ts` break the discriminator rule.
- Chapter: Tools

#### A command is a configuration
- Decides: each command of the platform names a phase and a way of presenting its result. `allegro` with a file runs it; with no argument it starts a prompt.
- Status: settled; reworded 2026-11-13 (DR6)
- Type: capability — the command-line surface
- Rationale kind: technical
- Depends on: A project defines a phase or extends one; A tool reads a phase's result and adds no analysis of its own
- Significance: 2 — the commands are not special
- Label: swappable — the set of commands
- Units: cli
- Options recorded: none recorded
- Sources: docs/book/platform/tooling.ir.md C17, C23 to C33; docs/book/platform/build-pipeline.ir.md C68, C69; docs/book/platform/tooling.ir.md C72, C100; the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: a project adds its own command by naming a phase and a report.
- Notes: was "One command-line entry with subcommands"; absorbs "Soft-fail evaluation for verdict tools" (a phase reports every refutation in its result).
- Held finding (2026-11-13, DR6): `package.json` declares no `bin` entry; `prove` ignores the choice of configuration.
- Chapter: Tools

#### A module's summary is the weakest strength among its claims
- Decides: the first thing a user sees about a module is one word: refuted, undecided, assumed, sampled or decided. The detail is one step away.
- Status: partly built (a grade with its own vocabulary); reworded 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: A tool reads a phase's result and adds no analysis of its own; Four strengths, one vocabulary; From experiment to proof without rewriting
- Significance: 3 — reviewing a system from the top down
- Label: swappable — the summary's form
- Units: introspect
- Options recorded: a proof transcript as the default surface (rejected by principle 7)
- Sources: docs/book/vision.md §3, §5 principle 7; docs/book/platform/tooling.ir.md C85 to C98 (def-safety-grade); the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: a reviewer scans forty modules, sees three marked sampled, and opens those.
- Notes: was "Safety grade as the default verification surface"; the concrete half of reviewability, which the Part I review sent here.
- Held finding (2026-11-13, DR6): the grade has four words of its own (`proven-safe`, `partial`, `has-warnings`, `has-errors`), counts no undecided sub-expression, and nothing produces `has-warnings`.
- Chapter: Tools

#### Open obligations are listed for any proposer
- Decides: a tool lists every claim that waits for a value: a theorem without a proof, a gap in a model, a law not yet decided. The list has a form for programs and a form for people, with the last failure and what is in scope.
- Status: settled for proofs; reworded 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: Anyone may propose, and the record shows who; Solving is proposing a value for an unknown, and the kernel checks it; A tool reads a phase's result and adds no analysis of its own
- Significance: 3 — work that is waiting can be found
- Label: swappable — the forms
- Units: pcp, cli
- Options recorded: none recorded
- Sources: docs/book/platform/tooling.ir.md C111 to C122, C168; docs/plans/planning-loop.md §6; the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: an agent reads the list, proposes a catalog entry for a plan's gap, and check is run again.
- Notes: was "Obligations and proposals as machine and human views", generalised from proofs as the planning-loop stream generalised its worker.
- Held finding (2026-11-13, DR6): authorship is not kept in the result (carried over from the Part I review).
- Chapter: Tools

#### One primer for every proposer
- Decides: the guide to answering obligations is one document, and it is what a tool sends to a language model.
- Status: settled; reworded 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: Anyone may propose, and the record shows who
- Significance: 2 — people and machines are told the same thing
- Label: swappable — the document
- Units: not yet a unit (`pcp/llm-worker.ts` has no unit)
- Options recorded: none recorded
- Sources: docs/book/proving-in-allegro.md (opening); docs/book/platform/tooling.ir.md C129, C19
- Use case: a new contributor and a model start from the same page.
- Notes: was "One primer for human and machine provers".
- Chapter: Tools

#### A proposer answers with only the missing value
- Decides: a proposal is the value an obligation waits for and nothing else: a proof term, a catalog entry. A tool places it, has the claim evaluated again, and keeps it only if the claim is decided, for a bounded number of attempts.
- Status: settled for proofs; reworded 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: Open obligations are listed for any proposer; One primer for every proposer; A proof term is a proposal
- Significance: 3 — a proposal cannot change what was asked
- Label: foundational — the loop between proposers and the kernel
- Units: pcp
- Options recorded: none recorded
- Sources: docs/book/proving-in-allegro.md "Output contract for an LLM prover"; vision.md §1–§2 (not read here); docs/book/proving-in-allegro.md (Output contract for an LLM prover); docs/book/platform/tooling.ir.md C123 to C136; docs/plans/planning-loop.md §6
- Use case: a model answers a theorem with a term; the tool splices it and the kernel decides.
- Notes: was "One proof-term contract for human and machine provers".
- Chapter: Tools

#### A trace is read from origins
- Decides: open — tracing, inspecting the graph and stepping through an evaluation are to be built on the origin every value keeps, through a utility for querying origins.
- Status: open
- Type: capability
- Rationale kind: technical
- Depends on: Every value keeps its origin; A tool reads a phase's result and adds no analysis of its own
- Significance: 2 — seeing how a result came about
- Label: swappable — the tools
- Options recorded: none recorded
- Sources: docs/book/layers.md §2, §3 (M7); docs/book/platform/README.md; docs/book/platform/tooling.ir.md C155 to C157; B-064; the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: a user asks why a claim is undecided and is shown the unresolved name it waits on.
- Notes: was "Execution tracing and step-through debugging".
- Chapter: Tools

### The launchers we ship

#### The platform's default configuration is the standard language
- Decides: every entry of the platform (file runner, prompt, subcommands, sandbox) starts, unless told otherwise, with the configuration that is the standard language. A configuration with no extension is the bare kernel.
- Status: settled; reworded 2026-11-12 (DR4)
- Type: capability
- Rationale kind: technical
- Depends on: Everything above the kernel is an extension, and there is one way to extend; Configuration is all the information that determines an execution
- Significance: 3 — what a user gets without asking
- Label: swappable — the default
- Units: cli
- Options recorded: none recorded
- Sources: docs/book/platform/tooling.ir.md C29 to C31; docs/book/platform/host.ir.md C69, C72; docs/book/vision.md §1 ("In normal use, 'Allegro' means this tier")
- Use case: `allegro file.alg` runs the file in the standard language.
- Chapter: The launchers we ship

#### The terminal and the browser ship output, timers and HTTP
- Decides: the launchers the platform ships supply capabilities for writing output, waiting and making HTTP requests. Files beyond module loading, processes and sockets are open.
- Status: partly built; reworded 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: A capability is a named set of effectful primitives; Only the launcher sets the ceiling
- Significance: 3 — what a program can do out of the box
- Label: swappable — the roster
- Options recorded: IO as base primitives (rejected in the audit)
- Sources: docs/decisions.md D27; docs/book/allegretto/structures.md §11, Appendix B; docs/book/allegretto/README.md; D27; docs/book/allegretto/structures.md §11 and Appendix B (cited at host C14 to C17); docs/book/platform/host.ir.md C9 to C17, C25; docs/book/layers.md §2; docs/book/platform/host.ir.md C123 to C125; B-071; the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: a script prints a line, waits a second and fetches a page, in a terminal or on a page.
- Notes: was "Environment capabilities outside the base, effect-labelled"; absorbs "Asynchronous I/O capabilities beyond timers and HTTP GET". "A stated host boundary in a host unit" dissolves: the boundary is the kernel's interface and the capabilities of the ceiling.
- Held finding (2026-11-13, DR6): `print` is a base primitive, and effects are not gated on decided claims (carried over from the Part I review).
- Held finding (2026-11-13, DR6): hosts are swapped by capturing output and substituting extensions; `fetch` sends a GET with no body.
- Chapter: The launchers we ship

#### A value that arrives later fills a cell
- Decides: a capability whose answer takes time returns a cell, which the launcher fills when the answer arrives. The launcher fills a cell with plain data: the answer, or a description of the failure, in the form the capability's definition states. The standard language wraps each capability it ships so that a failure becomes an exception; another language may wrap it otherwise. A call on a capability the phase lacks stays residual; it does not fail.
- Status: partly built; reworded 2026-11-13 (DR6)
- Type: capability
- Rationale kind: technical
- Depends on: A missing value is a cell that is filled once; The standard language's handled failure is an exception; What the kernel's interface offers; Completion is totality and liveness
- Significance: 3 — waiting is ordinary
- Label: foundational — every capability that takes time
- Units: futures, base-primitives
- Options recorded: none recorded
- Sources: docs/book/platform/host.ir.md C26 to C41; D33; docs/book/platform/host.ir.md C35, C36; D16, D34; docs/book/platform/tooling.ir.md C103; the maintainer's rulings of 2026-11-12 and 2026-11-13 (../records/book-pass/dr6-part-6-building-and-running.md, Rulings taken)
- Use case: a request times out; the program handles the exception and tries a second address.
- Notes: was "Asynchronous host results arrive as future cells"; "Liveness of host sources declared per source" dissolves into "Completion is totality and liveness".
- Held finding (2026-11-13, DR6): a failed request fills the cell with an error value, and a call without the runtime for asynchronous values throws.
- Notes (2026-11-13, after the adversarial review): was "A value that arrives later fills a cell, and a failure fills it with an exception"; answers issue 29 of the adversarial review: host code cannot write a field the standard language owns.
- Chapter: The launchers we ship

#### The browser launcher is one bundle
- Decides: the browser launcher is a single script that sets one global object with calls to evaluate, reset, format a value, register a library and inspect. It keeps its scope between calls and resolves modules only against libraries the page registered.
- Status: settled; reworded 2026-11-13 (DR6)
- Type: implementation
- Rationale kind: technical
- Depends on: The launcher does only what cannot be done in Allegro; The loader reaches files through a capability
- Significance: 2 — the project's pages
- Label: swappable — the packaging
- Options recorded: none recorded
- Sources: docs/book/platform/host.ir.md C62 to C93; docs/book/process.md §9 (cited at C12, C13); docs/book/platform/host.ir.md C46 to C52
- Use case: the documentation site runs every example on the page.
- Notes: was "Browser sandbox as an IIFE bundle with a library registry"; "Module loader takes its file reader from the host" dissolves into "The loader reaches files through a capability".
- Held finding (2026-11-13, DR6): `import` does nothing in the browser bundle, which holds no module loader; the header scanner is duplicated; the pages' copy of the units library is stale.
- Chapter: The launchers we ship

#### The core runs in a browser
- Decides: the kernel and the extensions use only what both Node and browsers provide, and read Node's globals only behind a test.
- Status: partly built
- Type: implementation — a coding rule
- Rationale kind: technical
- Depends on: The browser launcher is one bundle
- Significance: 2 — one core for every launcher
- Label: swappable — the rule could be met by a build step
- Options recorded: none recorded
- Sources: CLAUDE.md (Conventions & invariants, cited at host C102); docs/book/platform/host.ir.md C102 to C122; B-070 title
- Use case: the same kernel file is loaded by the command line and by a page.
- Notes: was "A browser-compatible core".
- Held finding (2026-11-13, DR6): `src/evaluator.ts:23` reads `process.env` unguarded, so a bundle built from the branch fails in a browser; nothing in CI builds or loads the bundle.
- Chapter: The launchers we ship

## The type check, 2026-11-05

Chunk P1b typed every entry under the ruling that no capability decision depends on an implementation decision. A capability decision decides what the language or platform can express or guarantee to its user; an implementation decision decides how the code realises it, and another implementation could change it without changing any capability. Where an entry holds both, it is typed by what it decides first, and its Type line names the realising part. `docs/book/concepts.md` already files its entries as requirements, specification choices or implementation choices; requirements and specification choices are typed capability and implementation choices implementation, except where noted.

Result: 256 decisions, 202 capability and 54 implementation. The check found 21 dependencies of a capability decision on an implementation decision, in 20 entries. Resolutions: (a) the dependency was misread, 19; (b) the dependent entry is implementation, 2 (one entry); (c) the dependency is capability, 0; (d) a split, 0.

| # | Entry | Depended on | Resolution | Why |
|---|---|---|---|---|
| 1 | Arrays are structures with unkeyed entries | The composite is one sequence of optionally-keyed entries | (a) Now depends on "One composite kind: Structure". The composite's representation now depends on this entry and follows it. | An array is a structure with unkeyed entries however the entries are stored; concepts.md files the sequence and its index as an implementation choice. |
| 2 | Authority is an unforgeable value | Symbols interned by FQN | (a) Now depends on "Symbol identity is a fully-qualified name". | The wire form is the name, interned or not; interning realises identity by name. |
| 3 | A missing value is a cell that is filled once | Scopes layer by parent chain | (a) Now depends on "The environment is not a value". | Resolution rests on the parent-chain protocol that entry states; the constant-time chain is how it is built. |
| 4 | Offside rule through stateful indent terminals | Memoized recursive-descent engine with seed-growing left recursion | (a) Removed. The engine now depends on this entry and follows it. | Grammar authors name the indent terminals; the engine implements them, so the edge pointed the wrong way. |
| 5 | Parse failure reporting and recovery | Memoized recursive-descent engine with seed-growing left recursion | (a) Now depends on "Grammars are Allegro values". The engine now depends on this entry and follows it. | Error productions and sync points are features of a grammar; the engine's farthest-advance report realises them. |
| 6 | Extensions are the module substrate | Scopes layer by parent chain | (a) Now depends on "The environment is not a value". | Extensions layer by the scope's protocol, not by its cost. |
| 7 | Members are keyed by symbol and conformance is membership | Symbols interned by FQN | (a) Now depends on "Symbol identity is a fully-qualified name". | Conformance needs symbol identity; interning is its pointer-compare realisation. |
| 8 | Export marks the binding, and a module with no exports is open | Module loading and typed module objects are separate layers | (a) Now depends on "Extensions are the module substrate". | Export rests on modules existing; which unit loads them is a cut in the code. |
| 9 | Knowledge has intrinsic and occurrence carriers | Scopes layer by parent chain | (a) Now depends on "The environment is not a value". | Occurrence facts live in the scope's facts plane, which that entry states. |
| 10 | Contracts in the verdict and the ledger | The verdict as accumulated metadata | (a) Now depends on "Every result says how strongly it holds". | Contracts must reach the verdict and the ledger however the verdict is computed. |
| 11 | Planning surface conventions | Library before surface | (a) Now depends on "A plan is an outcome graph with derived wiring". | The conventions spell the model; the order in which the library and the grammar were built changes no spelling. |
| 12 | Post-passes registered by layers | The evalSource stage order | (b) Retyped implementation. | It decides where the code registers its post-passes; no program's meaning changes. |
| 13 | Post-passes registered by layers | Each decision lives in one replaceable unit of code | (b) The same retyping. | As above. |
| 14 | Inspect reports only what the pipeline computed | The evalSource stage order | (a) Removed; "Types are values that constrain values" remains. | Inspect promises to add no analysis of its own; which stage computes each fact is the pipeline's arrangement. |
| 15 | One command-line entry with subcommands | One evalSource pipeline for programs and libraries | (a) Removed; the entry now depends on nothing. | The command-line surface holds whatever runs behind it; what every run checks is "Claims are evaluated like everything else". |
| 16 | File runner as one evaluation with futures drained | Callers pre-scan and strip the `use` header | (a) Now depends on "`use` header for language extension, `import` for module values". | The runner honours the header; the pre-scan is how a caller does it. |
| 17 | REPL as successive evaluations over a persistent scope | One evalSource pipeline for programs and libraries | (a) Now depends on "The environment is not a value". | An entry sees the earlier entries by scope layering; the shared pipeline is how it runs. |
| 18 | Execution tracing and step-through debugging | The evalSource stage order | (a) Now depends on "Expressions are values, forming a DAG". | Tracing and graph inspection show evaluation and the expression graph, not the stage list. |
| 19 | A stated host boundary in a host unit | The environment is not a value | (a) Removed. | The edge recorded where the future manager is planted, on the scope's host plane, which is an implementation detail; the boundary rests on the environment capabilities. |
| 20 | Browser sandbox as an IIFE bundle with a library registry | A browser-compatible core | (a) Removed. The core rule now depends on the sandbox and follows it. | The rule exists to keep the sandbox possible (its own significance line), so it realises the sandbox. |
| 21 | Browser runtime packaging | A browser-compatible core | (a) Now depends on "Browser sandbox as an IIFE bundle with a library registry". | Packaging extends the sandbox's one bundle; the API rule is its implementation. |

Three typings go against a source or need the maintainer's eye:

- "Metadata is a field on every value" is typed capability. concepts.md files it as an implementation choice that realises "Metadata fields are independent", while that requirement's own text calls where channels are stored a specification choice. The sources conflict. Typed capability because metadata rides each occurrence of a value, not each datum, and a program observes that. It is a tour decision; if the maintainer rules it implementation, its seven capability dependents rest on "Metadata fields are independent" instead.
- "The environment is not a value" is typed implementation, although it supersedes a specification choice. Its own options line says no scope reaches user code as a value, so leaving `Value` changes the representation only.
- "One operation: partial evaluation" is typed capability. The language exposes it: residuals are values, and every check is an evaluation a user can read.

**Mutual capability dependencies.** One pair was merged:

| Merged entry | From | Why |
|---|---|---|
| A missing value is a cell that is filled once | "Incompleteness is a value in a slot"; "Future cells: write-once, monotonic, flattening" | The first states incompleteness as an unresolved future; the second states the future as the sole locus of incompleteness. Each is stated in the other's terms, so neither holds alone. Sources, options and notes are the union. |

Not merged, because they relate without needing each other: "Mediated member access" and the access tiers and evidence it stages; "`use` header for language extension, `import` for module values" and "Activation by a `use` header, per file and not transitive"; "Metadata fields are independent" and "Metadata is a field on every value".

**The three cycles the merge broke, re-examined.**

1. "`use` header for language extension, `import` for module values" and "Callers pre-scan and strip the `use` header": a capability and its implementation. The pre-scan is implementation and keeps its edge to the header. No capability depends on the pre-scan any more (row 16).
2. "Claims are evaluated like everything else" against "Body-form clauses at the head of a body, lowered through one chain" and "Theorems as statements, proved `by` a term": all three are capability, and they are not mutual. The principle is stated without any particular form; each form is one instance of it. The edges from the instances to the principle stand, and nothing is merged.
3. "Precompile before the evaluation loop" and "The evalSource stage order": both implementation. The stage order places precompile, so it keeps the edge. Precompile realises checking a function's body before it runs; no capability depends on either.

**Moves.** All within a chapter; no decision changed chapter.

- "The composite is one sequence of optionally-keyed entries" moves after "Arrays are structures with unkeyed entries" (Structures).
- "Memoized recursive-descent engine with seed-growing left recursion" and "The precedence ladder runs as repetition, and memo invalidation tracks dependencies" move after "Parse failure reporting and recovery" (Grammars as values).
- "A browser-compatible core" moves after "Browser sandbox as an IIFE bundle with a library registry" (Hosts: the terminal and the browser).

**Contents changed.** "Why a new language" lists "Order of definition carries no meaning", which the rulings added but the list missed (9 decisions). "Evaluation" has 11 decisions after the merge. "Structures", "Grammars as values" and "Hosts: the terminal and the browser" list their decisions in the new order.

### The maintainer's rulings on the type check, 2026-11-06 (PR #164)

The ten hard calls stand, except three put to review; the merge of the incompleteness and future-cell decisions stands. The review session's findings on the three, for the pass to settle when it reaches their chapters:

1. **"The environment is not a value".** The maintainer's test: capability if read-site forgery requires it, else reversed. Finding: forgery does not require it. The protection against read-site forgery is a separate decision already in this inventory, "Evidence is possession": a mediator receives an opaque, kernel-minted evidence capsule that answers only whether a name is held, never the raw scope (decisions.md V-R2 (the mediation context is an opaque evidence capsule), executed). It ships today with scope still a value. The argument behind D49 (scope leaves `Value`) in `docs/plans/entry-sequence-composite.md` §5.6 is representational: five code sites that exist to undo scope's valuehood, metadata meaningless on a value with no position, the one mutable value, scope-only state on every structure, and code generation; it rests on the fact that no scope ever reaches user code as a value. Forgery appears only in closing custom scope kinds. D49 is ruled but not executed (`src/scope.ts:36` still implements scope as a structure). So by the maintainer's test the decision is an implementation decision, and the open question is whether to keep it (its five costs) or reverse it (nothing to undo, since it is unbuilt). Recommendation for the Scopes chapter: keep it as implementation, ruled on its costs, with "Evidence is possession" as the capability it serves.
2. **"Effects describe computations, refinements describe data".** Finding: the entry joins a decision and a storage note. The decision: effect constraints and refinement predicates are separate kinds of claim in separate lattices, an effect bound on a parameter is not a refinement of the parameter's value. It has an alternative (one lattice of facts, effects as predicates over computations), so it is a decision, not an observation, and it is capability. The storage note (effects in their own metadata field; parameter bounds in `Param.effectBound`, moved out of `Param.predicates`) is implementation and belongs under the effects field's own entry. Recommendation for the Effects chapter: restate as the capability "Effects and refinements are separate lattices", and fold the storage into the implementation entry.
3. **"One primer for human and machine provers".** The primer is `docs/book/proving-in-allegro.md`, the proving guide: the language model worker of the prove loop reads that file and sends it to the model as its instructions (`pcp/llm-worker.ts:394`–`403`). The decision is that a human prover and a machine prover are given the same document, which makes the protocol's neutrality literal. Note for R25 (chapters leaving the book): the guide moves to an appendix, but the worker reads it by path, so its path stays or the worker's path changes with it (stop condition 4 of the plan).

## Open questions

### The adversarial review, 2026-11-13

After phase 1 closed, four independent reviewers attacked the ruled decisions for consistency, feasibility and security, and one read them as a newcomer. Their findings reduce to 31 issues, none ruled yet: an expression that can be read and evaluated again against authority held in it; recursion; what a notation may do to a text; the meaning of the strength words; identity across evaluations and saved programs; and others. They are in [adversarial-review.md](../records/book-pass/adversarial-review.md), with what each ruling must choose. The decisions above are unchanged by them.

### Proposals deferred by DR1 to their parts

- **Taken in DR3 (2026-11-12)**, as the last clause of "Every program is evaluated the same way, however it arrives"; first deferred to DR2, with the expressions chapter: "A program built by a program is checked like any other" (reflection checked end to end; the review's R-DR1-32). `expr_eval` calls the evaluator directly (`src/primitives.ts:405`–`409`); whether a constructed program skips checks was not confirmed either way by one probe.
- **Struck in DR5 (2026-11-12)**; the maintainer: a language is extended so that it corresponds more closely to a model and states things clearly and efficiently, rarely if ever because a rule cannot be said. Kept as the goal in Part V's introduction. First deferred to DR5, with Vivace: "Business rules define the domain" (when a rule has no expressible form, extend the language, never contort the rule; docs/book/vision.md §5 principle 4; the review's R-DR1-36).

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
4. **The evaluator chapter's prose against its IR.** `docs/book/allegretto/evaluator.md` §2 says the switch names all seven kinds with no default arm; the IR and the code (`src/evaluator.ts:546`) have a default arm. §3 says `eval_when`, `&&` and `||` do not meet PE Rule 2 and that `eval_when` evaluates no branch; the IR and the code (`speculate` at `src/evaluator.ts:331`, `speculateWhenArms` at `src/primitives.ts:865`) say they do. Entries: "A branch that may not be taken is evaluated without capabilities", "Each decision lives in one replaceable unit of code".
5. **`prove_induction` and the sampled tier: verified.** `prove_induction_impl` (`src/primitives.ts:4330` to `4377`) checks `predicate(0)` and then `_INDUCTION_SAMPLE_K` (4, line 4302) inductive steps, and on success returns `_makeProof(...)` with the proposition text "forall n: NonNeg, p(n) [verified base + 4 inductive steps]". `makeProof` (`src/types-std.ts:4681`) writes `discharged` = 1 and no tier. The verdict's `TheoremResult` (`src/pcp.ts:199` onward) has status `discharged`, `failed` or `skipped` and carries a tier only as `lawBacking` for equality chains; the sampled tier exists only for law obligations (`src/pcp.ts:151` to `157`). So a theorem proved by bounded induction reaches the verdict as discharged with no sampled tier and stays out of the assumption ledger; its weaker strength shows only in the proposition text. This contradicts "Every result says how strongly it holds". Entries: "Bounded sampling for universal claims", "Discharge mechanisms without search". Whether to fix the code or the claim is a decision for the proofs chapter.
6. **The tier vocabulary.** `docs/book/vision.md` §1a names proven, enumerated, sampled, admitted, pending; `docs/book/getting-started.md` adds witnessed; the primer uses kernel, enumerated, witnessed, sampled, admitted, pending (matching `src/pcp.ts:155`); the divergence tiers are auto, witnessed, admitted, undischarged (`src/totality.ts:500`). A verdict counts as verified with pending law obligations. Entry: "Every result says how strongly it holds".
7. **Who runs the `use` pre-scan.** Fragment B's source says libraries and programs share the pre-scan; the pipeline IR says `evalSource` runs none and each caller scans and strips the header. The code agrees with the IR: `evalSource` (`src/runtime.ts:1169`) does not call `scanUses`, which `src/index.ts` and `src/modules.ts` call separately. Both statements hold if "share" means "use the same scanner"; the callers still disagree in behaviour (`inspect`, `verify`, the REPL, `prove` and the sandbox). Entries: "One evalSource pipeline for programs and libraries", "Callers pre-scan and strip the `use` header", "`use` header for language extension, `import` for module values".
8. **Precompile errors that do not halt.** Precompile records `precompile-eval`, `precompile-type-error` and `return-type-mismatch` as errors without halting, so `inspect` can grade `has-errors` without a halt. Entry: "Claims are evaluated like everything else".
9. **Where `print` and `eval_when` live.** `docs/book/units.md` row 15 lists `print` and `eval_when` in `base-primitives`; `docs/book/allegretto/structures.md` Appendix B and the environment-capability decision place `print` outside the base, and whether `eval_when` is base or a pattern-matching library is recorded only as a judgment call. Entries: "Environment capabilities outside the base, effect-labelled", "The kernel's primitives are pure and few".
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
| R3 | concepts.md: Metadata fields are independent (where a Sources line names a plan, the plan's ruling of that number) |
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
| SC-2 | concepts.md: The kernel's plain data is a sequence of bits, and it computes nothing on them |
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
