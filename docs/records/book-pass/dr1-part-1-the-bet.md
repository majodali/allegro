# Decision review: Part I, The bet (DR1)

> **Record.** Reader: RD-2 (the owner returning after a gap). Form:
> W-008 (reports map their deliverables). Subject: chunk DR1 of
> `docs/plans/book-pass.md`, phase 1 (the decision review), the decisions
> of Part I: chapters 1 to 3 (One engine for compiling and proving; A
> small base and the surfaces above it; Claims a reader can trust), read
> on `origin/main` at `1a1a744`, 2026-11-10. Author: the review session.
> Every decision is ruled under R34 (recommend the right decision): the
> size of a change is its cost, never its reason. Code was checked, not
> changed, as §2.8 item 4 says; scratch programs ran under the session's
> scratchpad. The maintainer rules by number; "defaults" takes every
> recommendation.

## Asks

Part I's decisions are mostly right as bets, and the code breaks five of
them. Allegretto, run by `--base`, cannot load any extension, so no
surface is built on the minimal core. A failed type annotation on a
function's return does not halt the build. A failed proof halts only
after the whole program has run. Allegretto exposes 54 Allegro Standard
primitives and parses Standard's proof statements. A `proven` clause,
checked on four samples, is missing from the verdict, whose ledger then
reports every proof as resting on proven backing. Part I also lacks the
decisions that the author's motivations imply: eight are proposed below,
marked as proposals.

1. **R-DR1-1 — Where a fix goes when a later decision's code breaks a
   Part I decision.** Most Part I decisions are
   [principle decisions](#terms-introduced): they state a rule that later
   decisions realise, and own little code. R28 (the monotonic pass) makes
   a decision final with "the code stemming from" it. Options: (a) a
   violation is fixed with the earliest decision whose own unit holds the
   wrong code; a violation inside a later decision's unit is a held
   finding on that decision, under R36 (held findings); the Part I
   decision is approved with those held findings listed; (b) every
   violation of a Part I decision is fixed in that decision's chapter PR,
   whatever unit it touches; (c) a Part I decision waits for approval
   until every decision realising it is approved. Recommended: (a). It
   keeps each change with the decision whose code it is, as §2.7 item 2
   asks, and it lets Part I be approved first. (b) puts code of Parts II
   to VI into Part I's PRs before their decisions are reviewed; (c)
   leaves the foundations open to the end, the reverse of R28. Default:
   (a). The asks below apply it.

### One engine for compiling and proving

2. **R-DR1-2 — New, a proposal from the motivations: "Built for code
   that machines write and a kernel checks".** Recommended: accept, as
   the first decision of chapter 1. Decides: Allegro is designed for a
   world where most code is proposed by machines; the language's job is
   to make any proposed code checkable by a kernel and its claims
   readable by a reviewer, so authoring ergonomics give way to
   checkability where the two conflict. Type: capability. Label:
   foundational. Depends on: none. Significance: 5, the question the
   book poses first ("why a new programming language right when
   programming is becoming obsolete?", the inventory's motivations
   section). What rests on it: "Participant-neutral prover protocol with
   the kernel as trust boundary", "Every claim states its discharge
   strength", "Reviewability through a top-down semantic view" and
   "Provable correctness and safety as one predicate machinery". The
   sources embody it: `docs/book/vision.md` §1 (human and AI
   collaboration as a core goal, the compiler as the trust boundary) and
   §2 "Why both, why now". No code owns it. Options: (a) accept as a
   decision; (b) leave it to the tour as narrative; (c) strike.
   Recommended: (a), because "authoring ergonomics give way to
   checkability" has an alternative a reader can weigh (a language
   optimised for human authors), and later decisions lean on it.
   Default: (a). Its text in the book needs the Tier-0 amendment of
   R-DR1-37.

3. **R-DR1-3 — Programmable language platform: minimal core, extensions
   are the language.** Recommended: restate, and fix the base's
   extension path as this decision's change. Inventory: Allegro is a
   minimal formal core under a curated stack of extensions, and
   everything beyond the value kinds and their primitives, syntax and
   the type system included, is an importable extension built with the
   mechanisms user extensions use; capability; foundational; depends on
   none. Code: user extensions are `.alg` modules activated by `use`
   (`lib/units.alg`, `lib/proven.alg`), merged as grammar fragments and
   bindings. Allegro Standard's type system is a host object,
   `createTypeSystem` (`src/types-std.ts:4894`), switched on by the
   `typed` flag of `evalSource` (`src/runtime.ts:1169`–`1174`,
   `1250`–`1257`), which also changes literal typing, primitive wrapping
   and precompile. No user extension can set that flag. The `--base`
   runner calls `evalSource(source)` with no `use` scan, no module loader
   and no extensions (`src/index.ts:115`–`119`): `use effects` is a parse
   error under `--base` (a scratch run), and so is the rung-2 scene
   `demos/rung2/01-dimensions.alg`. Verdict: partly. The minimal core
   cannot be extended; only Standard can. New Decides: "Allegro is a
   minimal formal core under a stack of extensions; every construct
   beyond the value kinds and their primitives is an extension, and the
   standard library's extensions reach the core through the same
   mechanisms a user's do; the core can be extended directly". Options:
   (a) restate and make `--base` load extensions: the runner and the REPL
   scan `use` and load modules without the type system, so a surface can
   be built on Allegretto; (b) restate to what is built: "extensions are
   built on Allegro Standard", and the core is a specification only;
   (c) keep the Decides and record the gap as open. Recommended: (a),
   because a platform whose core cannot be extended makes Standard the
   real base, and "Substrate and surfaces" (R-DR1-12) then has no
   substrate. The type system as a host object behind a flag stays for
   now: replacing it with an `.alg` stack is "Self-hosting and a package
   ecosystem" (chapter 33), and its rationale belongs there. Changes:
   `src/index.ts` (the `--base` branches of `runFile`, the REPL), and a
   test of a `use` under `--base` in `src/test/language.ts`; both files
   are in the boundary of the planning-loop stream (`docs/plans/planning-loop.md`,
   active), so the maintainer rules the case under R32 (M3 reconciled
   with the monotonic pass). The type, label and dependency are right.
   Default: (a).

4. **R-DR1-4 — Partial evaluation as the compilation model.**
   Recommended: restate, and move the phase chain to chapter 33.
   Inventory: each build phase is a partial-evaluation step binding more
   symbols, and type checking, effect inference, totality and proof
   discharge are all evaluation on one engine, never a parallel analyser;
   capability; foundational; depends on R-DR1-3. Code: type checking is
   evaluation of the body over typed placeholders
   (`precompileFunction`, `src/evaluator.ts:1150`–`1245`); effect
   inference rides evaluation (`src/evaluator.ts:724`–`729`); proofs are
   discharged by evaluating the proposition (`src/runtime.ts:1567`–`1588`).
   Termination is not: `checkTermination` and `analyzeDivergence` walk the
   expression graph, build a call graph, take its strongly connected
   components and recognise `param - k` shapes (`src/totality.ts:477`,
   `534`, `929`, `1115`); only the result rides the effect calculus.
   Exhaustiveness walks `when` chains the same way (`src/totality.ts:219`,
   `257`). There is one build phase today; "each build phase" describes
   the open decision "Multi-phase build as successive partial evaluation"
   (chapter 33). Verdict: partly. New Decides: "every check the language
   performs is evaluation over a partially resolved program on the one
   evaluator; a check's result is metadata on the value it judges".
   Options for termination: (a) keep the Decides and hold the structural
   analysis as a finding on "Termination by bounded decrease" (chapter 24),
   to be brought into evaluation there or surfaced as a thesis-level
   concern, as the falsifiable constraint asks; (b) restate the decision
   to allow structural analyses whose results ride metadata. Recommended:
   (a), because (b) quietly weakens the thesis, which the falsifiable
   constraint forbids. Type, label and dependency are right. Changes:
   none for this decision; two held findings (§2, items 3 and 4).
   Default: (a).

5. **R-DR1-5 — Provable correctness and safety as one predicate
   machinery.** Recommended: restate, to reconcile it with the effects
   chapter. Inventory: correctness and safety are predicates discharged
   by one machinery (predicate sets, abstract domains, entailment, PE
   reduction), and a feature needing parallel infrastructure is a
   thesis-level concern; capability; foundational; depends on R-DR1-4.
   Code: refinements and contracts use predicate sets and entailment
   (`entailsPredicate`, `src/primitives.ts:3241`, `3345`); effects are
   label sets merged by union and checked by inclusion
   (`EffectSet = Set<string>`, `src/effects.ts:41`); capabilities as
   reachability are a separate mechanism (D42 (evidence is possession));
   information flow and behavioural budgets are not built (no occurrence
   in `src/`). Verdict: partly. The type check's finding for chapter 22
   recommends "Effects and refinements are separate lattices" (the
   inventory's rulings on the type check, item 2), which reads against
   "the same machinery". New Decides: "every correctness and safety claim
   is a predicate discharged by partial evaluation and entailment over an
   abstract domain; a kind of claim may have its own lattice, never its
   own discharger; a feature that needs a discharger of its own is a
   thesis-level concern, surfaced, not built". Options: (a) that
   restatement, which makes chapter 22's restatement consistent; (b) keep
   "predicate sets" literally, and chapter 22 then makes effects
   predicate sets; (c) keep both texts and leave the conflict to
   chapter 22. Recommended: (a), because the thesis is one discharge
   path, and a label lattice checked by inclusion is entailment over its
   own domain. Changes: none. Vision §2's sentence ("All are discharged
   by the SAME machinery: predicate sets + …") then needs the amendment of
   R-DR1-37. Default: (a).

6. **R-DR1-6 — Compile-time first: failures halt the build.**
   Recommended: split, restate, and fix two halts as this decision's
   change. Inventory: specifications are discharged during partial
   evaluation and the executable carries only residuals; a failed proof,
   an undeclared effect or a failed refinement or type annotation halts
   compilation, in libraries as in user code; construction-path invariant
   failure and non-exhaustive matching stay weaker (CE-R8 (the
   construction and exhaustiveness paths)); capability; foundational;
   depends on R-DR1-4. Code, by scratch runs: an undeclared effect halts
   before the program runs (`src/runtime.ts:1511`); a failed refinement
   annotation on a binding halts at that line, after earlier lines ran;
   a failed proof halts after the whole evaluation loop, so every
   top-level `print` after the failing `verify` or `theorem` has run
   (`src/runtime.ts:1686`–`1703`); a declared return type that does not
   match does not halt at all: `f(x: Int): String => x + 1` runs with
   exit 0, while `inspect` grades the file `has-errors`. Precompile
   records `return-type-mismatch` and `precompile-type-error` as
   error-severity notifications and never throws
   (`src/runtime.ts:846`, `864`–`877`). Verdict: wrong for type
   annotations, partly for proofs. "The executable carries only
   residuals" describes code generation, which is open (chapter 33). New
   Decides: "a failed check halts the build before the program's effects
   run: a refuted proof, an effect the declaration does not admit, a
   failed refinement or type annotation, in libraries as in user code".
   The two weaker paths leave this decision: they are already the
   decisions "Statement contracts halt, construction failure is an error
   value" and "Exhaustiveness checking at info severity" (chapters 25 and
   24). Options for the fix: (a) halt on every error-severity precompile
   notification, and check proofs whose propositions are closed before
   the evaluation loop, so no effect of a failing program runs; (b) halt
   on the notifications only, proofs staying after the loop; (c) restate
   to what is built. Recommended: (a), because a failed proof that prints
   output first is a running program, which "Build safety in" rules out.
   Cost: the return check compares type names (`src/runtime.ts:870`) and
   reports `<refined>` against `Int` as a mismatch, so halting first needs
   a conformance check, or the pinned `tests/refinements.alg:20`
   (`double(y: PositiveInt): Int`) stops running; that check is the held
   finding of R-DR1-30. A proof whose proposition depends on a runtime
   future cannot move before the loop; it stays where it is and is named
   in the section. Changes: `src/runtime.ts` (pipeline), tests in
   `src/test/proofs.ts`; no active stream holds them. Dependency: add
   "Provable correctness and safety as one predicate machinery", since
   the decision says what a failed predicate does. Default: (a).

7. **R-DR1-7 — New, found missing: "Performance is never traded for
   safety".** Recommended: accept, after R-DR1-6. Decides: a check is
   never dropped, sampled or weakened to save time; an expensive check is
   answered by a better proof or a better algorithm. Type: capability.
   Label: foundational. Depends on: R-DR1-6. Source:
   `docs/book/vision.md` §5 principle 10; no inventory entry carries it.
   What rests on it: "Inline cutoff for recursive bindings" (chapter 30),
   which residualises a recursive call during precompile to avoid a stack
   overflow, with its soundness review pending (B-100 (the cutoff's
   soundness review)); and the K=4 sample count. Code: no flag disables a
   check (a text search for one found none). Options: (a) accept; (b)
   fold it into R-DR1-6 as a clause; (c) strike. Recommended: (a),
   because it is a separate trade a reader can weigh, and the cutoff's
   chapter must answer to it. Default: (a).

8. **R-DR1-8 — Participant-neutral prover protocol with the kernel as
   trust boundary.** Recommended: keep, with a held finding. Inventory:
   humans, agents, hybrids and tools propose [implementation, proof]
   pairs through one protocol, the kernel verifies each independently,
   and authorship is recorded per discharged theorem; capability;
   foundational; depends on R-DR1-5. Code: `allegro obligations`,
   `propose` (for a human) and `prove` (for a language model) share one
   check: each candidate is re-run through `evalSource` and judged by the
   verdict (`pcp/llm-worker.ts:340`–`354`). Authorship is recorded only in
   the `prove` loop's output (`src/index.ts:645`); the verdict credits
   every discharged theorem to `auto-PE` (`src/pcp.ts:831`), so a
   theorem a model proved reads "by auto-PE" when the file is verified
   again. Verdict: partly. Authorship belongs to "Obligations and
   proposals as machine and human views" (chapter 31) and the verdict
   (chapter 25), so it is a held finding there under R-DR1-1 (a).
   Dependency: add R-DR1-2. Changes: none here; the fix would touch
   `src/pcp.ts` and `pcp/**`, both in the planning-loop stream's boundary,
   which records a proposal's authorship in its own loop (R32 applies when
   chapter 31 is taken). Default: keep.

9. **R-DR1-9 — Three-leg proof strategy: PE-as-discharge, proof pairs,
   selective SMT.** Recommended: restate as the discharge policy, and
   merge "SMT as a selective fallback" into it. Inventory: predicates are
   lambdas discharged by evaluating to `true` (primary), provers supply
   implementation and proof together (primary), SMT is a fallback;
   capability; foundational; depends on R-DR1-4 and R-DR1-8. Code: legs 1
   and 2 hold (R-DR1-4, R-DR1-8); leg 3 has no code (no SMT occurrence in
   `src/`). Leg 2 is R-DR1-8 and leg 1's language form is "Proofs are
   values discharged by evaluation" (chapter 20), so the entry restates
   two decisions and adds one. What it adds is the trust question: the
   vision's own example ("a proof skeleton that delegates a Presburger
   obligation to SMT") makes an SMT answer part of a proof, which the
   kernel cannot check by evaluation. New Decides: "the kernel trusts one
   discharge mechanism, evaluation; provers and other procedures,
   SMT among them, supply candidates the kernel checks; a result the
   kernel cannot check enters the verdict at the admitted tier". Options:
   (a) that restatement, with the SMT entry merged in as an open
   sub-decision (whether to check SMT certificates); (b) keep three legs
   and the separate SMT entry; (c) remove the entry, leaving its parts to
   R-DR1-8, chapter 20 and the SMT entry. Recommended: (a), because the
   kernel as the single trust boundary (R-DR1-8) requires it, and
   "Proofs exportable to external checkers" (R-DR1-11) needs every
   trusted step checkable. Status: partly built (leg 3 open). Changes:
   none. Vision §2 leg 3 changes under R-DR1-37. Default: (a).

10. **R-DR1-10 — SMT as a selective fallback.** Recommended: merge into
    R-DR1-9 as its open sub-decision. Inventory: SMT is explored only
    where PE is not strong enough or proofs are uneconomical, never as
    the foundation; capability; swappable; open; depends on R-DR1-9.
    Code: not built. Verdict: not built. As a separate entry it repeats
    leg 3 of R-DR1-9 and states no question of its own. Options: (a)
    merge; (b) keep as its own open decision, restated as "how an SMT
    answer is trusted". Recommended: (a), because the trust question is
    the decision and R-DR1-9 (a) owns it. Changes: none. Default: (a).

11. **R-DR1-11 — Proofs exportable to external checkers.** Recommended:
    keep as an open decision. Inventory: proofs should be exportable to
    external checkers with transitive assurance, and representation
    choices prefer forms that translate to proof-assistant primitives;
    capability; foundational; open; depends on R-DR1-9. Code: no export
    exists (no occurrence of Lean or Coq in `src/`). Transitive assurance
    inside Allegro holds in part: a library passes through the same
    `evalSource` as a program, so its proofs are checked when it loads.
    D7 (`Type : Type` kept, stratified at export) is the one
    representation choice ruled against it. Verdict: not built. Label:
    foundational is right only as a constraint on representations; the
    section says so. Changes: none. Default: keep.

### A small base and the surfaces above it

12. **R-DR1-12 — Substrate and surfaces: a DSL inherits the whole
    kernel.** Recommended: restate. Inventory: Allegretto is the substrate
    and every language built on it, Standard included, is a surface that
    inherits the whole kernel (types, proofs, effects, laws, prover
    protocol), so general-purpose versus domain-specific is a breadth
    axis; capability; foundational; depends on R-DR1-3. Code: the units
    DSL is an Allegro library with no host code, built over Standard
    (`lib/units.alg`, its grammar at line 241); the planning DSL loads
    `units` and `totality` (`lib/planning.alg:24`–`25`). Both inherit
    Standard's checks. Under `--base` neither loads (R-DR1-3). The
    inherited kernel the Decides lists (types, proofs, effects, laws) is
    Standard, not Allegretto. Verdict: holds for surfaces over Standard;
    wrong as stated for Allegretto. New Decides: "every language built on
    the platform, Standard included, is a surface; a surface inherits
    every check of the extensions it is built on, so a narrow surface
    over Standard is as checked as Standard itself; general-purpose and
    domain-specific differ in breadth only". Options: (a) that
    restatement; (b) keep the text and treat Standard as part of the
    kernel; (c) keep the text and wait for R-DR1-3 (a). Recommended: (a),
    because what a surface inherits depends on what it is built on, under
    either fix of R-DR1-3; (b) blurs "kernel", which Part II's title
    gives to Allegretto. Changes: none. Default: (a).

13. **R-DR1-13 — Simplicity criterion for the base.** Recommended: keep,
    with a held finding. Inventory: every Allegretto feature must earn its
    place by being something Allegro cannot be built without; capability;
    foundational; depends on R-DR1-3. Code: one primitive table of 178
    entries serves every program (`src/primitives.ts:4509` onward), and
    every program, `--base` included, resolves all of it
    (`resolveSymbols`, `src/runtime.ts:156`–`160`). 54 of the 178 are
    Allegro Standard concepts by name (types, proofs, contracts, effects;
    a scratch listing), against D27 (minimal base surface)'s target of
    about forty. Verdict: partly. The application of the criterion is
    "Minimal base surface of about forty primitives" (chapter 4), which
    holds the finding (§2, item 5). Options: (a) keep; (b) merge into
    R-DR1-3, whose "minimal" it defines. Recommended: (a), because the
    criterion is cited by every base trade in Part II, and a section of
    its own gives those citations one target. Changes: none. Default: (a).

14. **R-DR1-14 — The base does not know about the layers.** Recommended:
    split, keeping this half as "Allegretto holds no Standard concept".
    Inventory: no Allegro Standard concept (type, effect, proof,
    refinement, contract) may appear in Allegretto, and dependencies point
    downward only; the base supplies mechanism, extensions policy;
    capability; foundational; partly built; depends on R-DR1-3. Code: the
    evaluator imports `refinements` and `effects` (the two violations of
    `scripts/analyze/index.ts units`; `src/evaluator.ts:9`–`10`) and names
    the `type`, `effects`, `predicates` and `domain` fields
    (`src/evaluator.ts:801`–`804`, `834`–`835`, `1164`); `src/futures.ts:11`
    imports `withType`, `ErrorType` and `StringType` from the type system.
    At the user surface, `--base` resolves the 54 Standard primitives
    (R-DR1-13): `proof_by_eval("1 == 1", 1 == 1)` builds a `Proof`, and
    `verify 2 + 2 == 5` halts the program, both in Allegretto (scratch
    runs). Verdict: partly. The evaluator's edges are owned by B-145 (type
    vocabulary) and B-146 (knowledge propagation), and the decisions
    "Knowledge propagation inside the evaluator" (chapter 10) and
    "Minimal base surface" (chapter 4) take them; §2, items 5 and 6.
    The downward rule between L1 and L2 is a different decision:
    R-DR1-15. Options: (a) split; (b) keep both halves in one decision.
    Recommended: (a), because the L1 grammar's knowledge of L2 (R-DR1-15)
    violates the downward rule without putting a Standard concept in
    Allegretto, and one decision cannot be checked against two rules.
    Changes: none here. Default: (a).

15. **R-DR1-15 — New, the split of R-DR1-14: "Layers depend downward
    only".** Recommended: accept, after R-DR1-14. Decides: Allegretto,
    the extension substrate, Allegro Standard and Vivace are layers, each
    using only the layers below it, and capability tracks (build,
    tooling, host, backend) may use any layer and are used by none.
    Type: capability, because it fixes what each language tier may
    contain. Label: foundational. Depends on: R-DR1-14. The inventory's
    Open questions name it as "Layers L0 to L3 with dependencies pointing
    down", resolved into R-DR1-14 for want of an entry. Code: the L1 base
    grammar holds Standard's `theorem` and `verify` statements
    (`src/grammar2/base-grammar.ts:748`–`755`), and the L1 tree builder
    lowers annotations and contracts to L2 primitives by name
    (`typed_function`, `type_check`, `requires_stmt`;
    `src/grammar2/tree-builder.ts:813`, `1384`–`1396`), while other claim
    syntax arrives by `use` (`lib/proven.alg`, `lib/effects.alg`).
    Verdict: partly. What rests on it: "Build pipeline as a track, not a
    layer", "Layers reach the base only through metadata and capability",
    "Module loading and typed module objects are separate layers". The
    layer-to-unit mapping stays in the units appendix (R25 (chapters
    leaving the book)). Options: (a) accept; (b) leave the rule inside
    R-DR1-14. Recommended: (a). The fix of the grammar edges belongs to
    "Statement forms that declare a binding" and "Theorems as statements,
    proved `by` a term" (chapters 19 and 20); §2, item 7. Default: (a).

16. **R-DR1-16 — Language extensions are declarative.** Recommended:
    restate, and add three dependants. Inventory: every language
    extension, grammar extensions and definitions included, is
    declarative, so the order of definitions carries no meaning;
    capability; foundational; settled in principle, partly built; depends
    on R-DR1-3. Code: the parser's alternation is ordered choice
    (`matchAlt`, `src/grammar2/engine.ts:945`); a fragment rule with
    `add` over an existing base production replaces it with a warning
    only (`W_PRODUCTION_REPLACED`, `src/grammar2/fragments.ts:154`–`168`);
    a top-level name bound twice takes the later value silently:
    `x = 1`, `x = 2`, `print(x)` prints 2, in both modes (a scratch run).
    Forward references between definitions work (`print(f(2))` before
    `f` and `g`, a scratch run). Verdict: partly. New Decides: "the meaning
    of a set of definitions and language extensions does not depend on
    the order they are written or activated; two that conflict are an
    error reported before either is used, and replacing a production is
    an explicit operation, never a side effect of order". The REPL is not
    an exception: each entry is a new evaluation over the scope of the
    earlier ones, so a later entry's name shadows by scope, not by order
    within one unit; the section says so. The standing ruling
    W_PRODUCTION_REPLACED (2026-06: silent replacement warns, does not
    error) conflicts with the restatement; R-DR1-16 (a) supersedes it for
    an `add` over an existing name, while explicit `replace` stays legal.
    Dependants to add: "Conflicts are validated before activation" and
    "Grammar extension as operation deltas, extensible by default"
    (chapters 15 and 14), and "Statement forms that declare a binding"
    (chapter 19), which gains the duplicate-binding finding (§2, item 8).
    Options: (a) restate, with the standing ruling superseded; (b) keep
    the text, and leave duplicate bindings and implicit replacement to
    their chapters. Recommended: (a), because "definitions included" makes
    duplicate bindings this decision's case. Changes: none here; the
    ordered choice is "Ambiguity is banned and detected" (chapter 13)'s, as
    R27 (conflicts between sources) rules. Default: (a).

17. **R-DR1-17 — New, a proposal from the motivations: "The semantic
    model comes before any syntax".** Recommended: accept, before
    R-DR1-18. Decides: a program's meaning is its value graph; every
    syntax is a mapping onto that graph, so two spellings that produce the
    same graph are the same program, and the semantic model is explored
    and decided without reference to any notation. Type: capability.
    Label: foundational. Depends on: R-DR1-3. Motivation 2 ("Semantic
    model precedes syntax"). What rests on it: "Allegretto is syntax-free;
    the parser lives above the base", "Grammars are Allegro values",
    "Surface syntax is provisional, reviewed against a corpus", and the
    whole of Part II, which decides the kernel with no syntax. The sources
    embody it: concepts R9 (the language surface is extensible), the
    syntax-free definition of Allegretto, and the book's order, Part II
    before Part III. The code embodies it: the tree builder lowers every
    form to expression values, and the units and planning DSLs produce
    the same kinds of value as Standard's own syntax. Options: (a) accept;
    (b) fold it into R-DR1-18 as that decision's rationale; (c) strike.
    Recommended: (a), because R-DR1-18 is about where the parser lives,
    and this decision is why that matters. Default: (a).

18. **R-DR1-18 — Allegretto is syntax-free; the parser lives above the
    base.** Recommended: restate, dropping the speculative clause.
    Inventory: Allegretto is a specification with no concrete syntax; the
    standard parser and all concrete syntax belong to L1 and may later be
    re-hosted on Vivace's parser generator; capability; foundational;
    depends on R-DR1-3, R-DR1-13, R-DR1-14. Code: no L0 unit holds a
    parser (`scripts/analyze/units.json`: every grammar file is L1). The
    `--base` runner uses the L1 base grammar, Standard's statements
    included (R-DR1-15). Verdict: holds for L0. "May later be re-hosted
    on Vivace's parser generator" names no decision and nothing in the
    sources builds it. New Decides: "Allegretto is a specification with no
    concrete syntax; every concrete syntax, the base grammar included, is
    an L1 extension over it". Dependency: add R-DR1-17. Changes: none.
    Default: restate.

19. **R-DR1-19 — New, a proposal from the motivations: "Models and the
    mappings between them are values the kernel checks".** Recommended:
    accept as an open decision, after R-DR1-18. Decides: a domain model
    is a first-class language, and a declarative mapping between models
    (phrase structure to semantic model, data model to interface, data to
    analysis) is itself a value, so the kernel checks a mapping's output
    as it checks the model. Type: capability. Label: foundational. Status:
    partly built. Depends on: R-DR1-12, R-DR1-17. Motivation 3
    ("Model-driven engineering"): DSLs stalled "when they remained
    informal and far poorer cousins of first-class languages". The code
    embodies one mapping: a grammar maps phrase structure to values, and
    grammars are values (`grammar { … }` in `lib/units.alg:241`,
    `lib/planning.alg:1191`). Mappings between two models, and from a
    model to an interface, are not built. What rests on it: "Vivace adds a
    discipline, not machinery", "Composition of models and the AI loop
    over a model". Options: (a) accept as open; (b) fold the
    first-class-language half into R-DR1-12 and leave mappings to
    Vivace's chapters; (c) strike. Recommended: (a), because a mapping as
    a checked value is a bet the later parts test, and no decision states
    it. Default: (a).

20. **R-DR1-20 — New, a proposal from the motivations: "Declarative
    paradigms are libraries over one kernel".** Recommended: accept as an
    open decision, after R-DR1-19. Decides: a declarative paradigm (data
    definition and query, logic, constraints) is a library and a surface
    over the one kernel, sharing its checks and tools; using one needs no
    second runtime and no language builder's investment. Type:
    capability. Label: foundational. Status: partly built. Depends on:
    R-DR1-3, R-DR1-4, R-DR1-12, R-DR1-16. Motivation 4 ("Declarative
    paradigms, for anyone"). The code embodies constraints: refinements
    are constraints over values, and the planning DSL finds solutions by
    enumeration over a constrained model (chapter 29). Logic programming
    and query are not built. What rests on it: "Choices, templates and
    solution finding by enumeration", "Search beyond enumeration". It
    differs from R-DR1-16: that decision makes extensions order-free; this
    one makes paradigms extensions. Options: (a) accept; (b) fold into
    R-DR1-12 as a clause; (c) strike. Recommended: (a). Default: (a).

21. **R-DR1-21 — Units in a narrow DAG.** Recommended: keep, sharing a
    section with R-DR1-22. Inventory: the code is divided into the
    smallest units, each holding one decision, depending only on named
    units below it, replaceable without editing what does not name it;
    implementation; foundational; partly built; depends on R-DR1-3.
    Code: `scripts/analyze/units.json` names 35 units; `npm run
    lint:units` holds the baseline. A run of `scripts/analyze/index.ts
    units` finds 166 import edges: 60 ok, 2 violations (R-DR1-14), 104
    unresolved through 5 mixed files, and 456 kind comparisons outside
    the allowed units. Verdict: partly, as D50 (units in a narrow DAG)
    declares ("moves owed per unit"). Its dependency on R-DR1-3 is right,
    and no capability decision depends on it. Changes: none. Default:
    keep.

22. **R-DR1-22 — Unit granularity rule.** Recommended: merge into
    R-DR1-21. Inventory: split a unit when its halves have different
    dependency sets or hold decisions that could be revised
    independently, never for size alone; implementation; swappable;
    depends on R-DR1-21. Code: a rule for authors, checked by no tool.
    Verdict: holds as a rule. It defines "smallest" in R-DR1-21, and
    neither reads alone. Options: (a) merge; (b) keep as its own decision
    in one section. Recommended: (a). Changes: none. Default: (a).

23. **R-DR1-23 — The three moves as the test of a new capability.**
    Recommended: remove as a decision; the tour tells it. Inventory:
    every capability must present as a composition of three moves (one
    value universe under one engine; every claim a predicate with a
    visible strength; every participant through one kernel), and a
    fourth move is a thesis-level concern; capability; foundational;
    depends on R-DR1-12 and R-DR1-5. The three moves are R-DR1-4,
    "Every claim states its discharge strength" (R-DR1-25, chapter 3) and
    R-DR1-8; the test clause is the falsifiable constraint of R-DR1-5
    applied to positioning. Its real dependency on R-DR1-25 points
    forward to chapter 3 (§4, item 1). Code: none; a framing for
    `docs/plans/release-track.md`'s differentiator map. Options: (a)
    remove, the moves told in the tour and the test folded into R-DR1-5;
    (b) keep, moved after R-DR1-25 with its dependencies corrected.
    Recommended: (a), because it decides nothing the three decisions and
    the falsifiable constraint do not. Default: (a).

24. **R-DR1-24 — The demo ladder as the thesis test.** Recommended: keep,
    restated, and moved (R-DR1-33). Inventory: the thesis is tested by a
    ladder of rungs, each composing the three moves and resting on the
    rungs below: verified code at AI velocity, a provable DSL, a Vivace
    domain model, and mixed-model optimisation as direction only;
    capability; foundational; depends on R-DR1-23 and R-DR1-5. Code:
    `demos/rung1/` to `demos/rung3/` exist, suite-pinned. Rung 4 is being
    built: the planning-loop stream's scene is `demos/rung4/01-loop.alg`,
    a loop over one model, toward release-track's rung-4 story (two or
    more coupled models, AI-proposed candidates, kernel-scored), ruled at
    that plan's R6 (the demo's home). Verdict: holds for rungs 1 to 3;
    stale for rung 4. New Decides: "the thesis is tested by a ladder of
    runnable rungs, each resting on the ones below: verified code
    proposed by any participant, a provable DSL, a checked domain model,
    and coupled models solved by proposal and kernel check". Dependency:
    with R-DR1-23 removed, it depends on R-DR1-5, R-DR1-8 and R-DR1-12.
    Changes: none; `demos/rung4/**` and `docs/plans/release-track.md` are
    in the planning-loop stream's boundary. Default: as recommended.

### Claims a reader can trust

25. **R-DR1-25 — Every claim states its discharge strength.**
    Recommended: restate around one tier vocabulary, with four held
    findings. Inventory: no verification answer is a bare checkmark; each
    claim reports its tier transitively; the verdict lists theorems and
    obligations with tiers, the ledger lists admitted and sampled
    backings, and a weaker check never borrows a stronger one's
    vocabulary; capability; foundational; depends on R-DR1-5. Code: the
    ledger carries a sampled induction backing to the theorems resting on
    it (`allegro verify tests/proofs-induction-demo.alg`: "resting on
    sampled 'induction' of 'NonNeg'"). Four breaks, by scratch runs: a
    `proven` clause, checked on K=4 samples (`lib/proven.alg:4`–`5`), is
    missing from the verdict, whose ledger reads "clean — all proofs rest
    on proven backing"; the word `proven` names a sampled check; the
    safety grade reads `proven-safe` whenever the compiler did not
    complain (`src/introspect.ts:496`–`504`); a verdict whose theorems
    rest on sampled backing is headed "Verdict (verified)" with each
    marked "✓ … by auto-PE". Three tier lists disagree: vision §1a
    (proven, enumerated, sampled, admitted, pending), the law tiers
    (kernel, enumerated, sampled, witnessed, admitted;
    `src/pcp.ts:230`–`236`) and the divergence tiers (auto, witnessed,
    admitted, undischarged; `src/totality.ts:500`). Verdict: partly. New
    Decides: "every claim reports one tier from one vocabulary, the same
    for theorems, laws, contracts, divergence and sampled clauses, carried
    transitively through what rests on it; no surface, keyword or grade
    names a tier stronger than its claim's". Options for the vocabulary:
    (a) one list, chosen in this decision, which chapters 20, 21 and 24
    then use; (b) one list per kind of claim with a published mapping;
    (c) as today. Recommended: (a), because a reader cannot compare
    strengths across three lists. Which words make the list is the
    maintainer's choice; the review proposes the code's law list with
    `pending`, since it is the richest one in use. The breaks are each in
    a later decision's unit, held there (§2, items 9 to 12). Units: none,
    not `pcp, introspect, cli`. Vision §1a's list changes under R-DR1-37.
    Default: (a).

26. **R-DR1-26 — New, a proposal from the motivations: "A pending claim
    never halts; a refuted one does".** Recommended: accept, after
    R-DR1-25. Decides: a program runs while some of its claims are
    pending, unknown or sampled, each shown with its tier; only a refuted
    claim or a false declaration halts, so a program can move from
    experiment to proof without being rewritten. Type: capability. Label:
    foundational. Depends on: R-DR1-6, R-DR1-25. Motivation 6 ("Formal and
    agile, in one practice": a synthesis, "formal and experimental,
    scientific and practical"). The code and sources embody it: undeclared
    code carries `div` visibly without halting (CE-R1 (`div` rides the
    effect calculus)); a pending law obligation does not clear `verified`
    (`src/pcp.ts:946`–`959`); an analysis that cannot decide stays silent
    (R-DR1-30). What rests on it: "Strict at the contract, informational
    for undeclared code", "Project severity configuration" (chapter 24).
    It separates two things R-DR1-6 joins: the halting rule, and what does
    not halt. Options: (a) accept; (b) fold into R-DR1-6 as its second
    clause; (c) strike. Recommended: (a), because the motivation names it
    as a bet of its own and its alternative (every claim must be
    discharged before a program runs) is a real one. Default: (a).

27. **R-DR1-27 — Formal claims written in the program's own syntax.**
    Recommended: keep, with one dependency added. Inventory: refinements,
    contracts, effects, termination metrics and theorems are written in
    the program's own syntax, not a separate specification language;
    capability; foundational; depends on R-DR1-12. Code: `Int & _ > 0`
    (`tests/refinements.alg:4`), `effects pure` (`tests/effects-demo.alg:28`),
    `proven` (`lib/proven.alg`), `decreases`
    (`tests/totality-decreases-demo.alg`), `theorem` and `verify`
    (`tests/proofs-demo.alg:10`–`20`). Verdict: holds. Some claim syntax
    sits in the base grammar and some arrives by `use` (R-DR1-15); the
    section states the rule, not the split. Dependency: add R-DR1-5,
    since a claim written in the program's syntax is a predicate as
    R-DR1-5 defines it. Changes: none. Default: keep.

28. **R-DR1-28 — Reviewability through a top-down semantic view.**
    Recommended: restate, moving status out of the Decides. Inventory:
    review works through a layered view of inferred types, effects,
    discharged invariants and semantic diffs, surfaced as a safety grade
    with drill-down; the safety grade and `inspect` exist, semantic diffs
    and editor integration do not; capability; swappable; partly built;
    depends on R-DR1-25. Code: `allegro inspect` prints the grade, each
    binding's type, effects and errors (`src/introspect.ts`); no semantic
    diff or language server exists (no occurrence in `src/`). Verdict:
    partly. New Decides: "review reads a top-down view of what the
    compiler inferred and discharged (types, effects, claims and their
    tiers, and semantic diffs between versions), entered through a safety
    grade; line-by-line reading is not the review method". Dependency:
    add R-DR1-2. Changes: none. Default: restate.

29. **R-DR1-29 — Progressive disclosure of formality.** Recommended:
    keep. Inventory: beginners write ordinary code with everything
    inferred, intermediates add invariants, experts write tactics; formal
    work concentrates in libraries and DSLs; inferences are displayable
    and annotations optional; capability; foundational; depends on
    R-DR1-27. Code: effects are inferred without a declaration
    (`tests/effects-demo.alg:21`–`24`); tactics are an Allegro library
    (`lib/tactics.alg`); `inspect` displays the inferences. Verdict:
    holds. Changes: none. Default: keep.

30. **R-DR1-30 — Analyzer silence over guessing.** Recommended: keep,
    with a held finding. Inventory: when an analysis cannot determine the
    facts it stays silent, because false positives erode trust;
    capability; swappable; depends on R-DR1-25. Code: the termination
    analysis is silent on untyped code (`docs/book/standard/totality.md`,
    the reconciliation table); the return check is silent when the
    inferred type is unknown (`src/runtime.ts:870`). The same check
    guesses otherwise: it compares type names, so a refined return
    conforming to its declared base type is reported as an error,
    "declared Int, inferred <refined>", in the pinned
    `tests/refinements.alg:20` (`allegro inspect`). Verdict: partly. The
    check is "Type annotations on parameters and returns" (chapter 19)'s;
    §2, item 13, and R-DR1-6 depends on its fix. Label: swappable "per
    analysis" is wrong: every analysis follows the policy, and a change
    would change what every verdict means; foundational. Changes: none
    here. Default: keep, label foundational.

31. **R-DR1-31 — Surface syntax is provisional, reviewed against a
    corpus.** Recommended: restate, and move to the surface chapter
    (R-DR1-34). Inventory: every feature and syntax element is reviewed
    and possibly redefined once a corpus of real use exists, so surface
    syntax is provisional and redos get deprecation paths; capability;
    swappable; depends on none. Code: no deprecation mechanism exists (no
    occurrence of "deprecat" in `src/` or `lib/`); the `.where()` surface
    was replaced by `&` with no path left (`tests/refinements.alg:38`).
    Verdict: partly. New Decides: "every surface form is provisional
    until reviewed against a corpus of real use, and a form that changes
    is retired through a deprecation path that keeps dependents running".
    Dependency: add R-DR1-17. Options: (a) restate with the deprecation
    path as an open sub-decision; (b) drop the deprecation clause.
    Recommended: (a), because the clause is what makes "provisional" safe
    for a user. Changes: none. Default: (a).

### Beyond Part I's order

32. **R-DR1-32 — New, a proposal from the motivations: "Reflection is
    checked end to end".** Recommended: accept, placed in chapter 5,
    "Expressions, functions and symbols", after "Expressions are values,
    forming a DAG". Decides: a program can read and transform code,
    types, grammars and models as values, and a transformed program
    passes every check a written one passes before it runs. Type:
    capability. Label: foundational. Status: partly built. Depends on:
    R-DR1-6, "One value universe" and "Expressions are values, forming a
    DAG" (chapters 4 and 5). Motivation 5 ("Reflection without the
    fire": reflection connected everything "but without consistent
    end-to-end type checking and validation"). Code: reflection exists
    (`expr_apply`, `expr_fn`, `expr_args`, `expr_eval`, `source_get`;
    grammars as values). `expr_eval` calls the evaluator directly
    (`src/primitives.ts:405`–`409`), so a constructed program skips the
    pipeline's checks (precompile, effect declarations, proof findings);
    typed functions inside it still check their arguments at the call.
    The prove loop is the end-to-end case: it splices source and re-runs
    `evalSource`. What rests on it: "Tactics as a pure Allegro library",
    "Code generation from the expression graph", "Laws licence rewrites".
    Options: (a) accept in chapter 5; (b) move "One value universe" and
    "Expressions are values" into Part I and place it there; (c) strike.
    Recommended: (a), because its dependencies are Part II decisions and
    (b) would pull the kernel into the bet. Default: (a).

### Placement

33. **R-DR1-33 — A closing chapter of Part I for the thesis test.**
    Options: (a) a short fourth chapter, "How the bet is tested", holding
    the demo ladder (R-DR1-24), after chapter 3; (b) the ladder at the end
    of chapter 3; (c) the ladder at the opening of Part V, "Domains built
    on the kernel", where rungs 2 and 3 are told; (d) as placed, in
    chapter 2. Recommended: (a). The ladder tests decisions of all three
    chapters, rung 1 included, whose tiers are chapter 3's; chapter 2,
    "A small base and the surfaces above it", is about the base. (c)
    leaves rung 1 outside the part that tells it. Cost: one more chapter,
    and the contents renumber. Default: (a).

34. **R-DR1-34 — "Surface syntax is provisional" moves to the surface
    chapter.** Options: (a) to the opening of chapter 19, "The surface
    language"; (b) stays in chapter 3. Recommended: (a). Both its
    dependants ("Function declarations with `=>`", "String interpolation
    with braces") are in chapter 19, and it says nothing about claims.
    The move is earlier-to-later and creates no forward reference.
    Default: (a).

35. **R-DR1-35 — The units decisions and the units appendix.** R25 sends
    units and layers to appendices as architectural principles. Options:
    (a) R-DR1-21 stays a decision section in chapter 2, and the appendix
    holds the measured DAG, the band table and the owed moves; (b) both
    move to the appendix and chapter 2 points to it. Recommended: (a).
    Four implementation decisions of Parts II and VI depend on R-DR1-21
    ("Value as a contract, seven kind units and an assembly", "Layers
    reach the base only through metadata and capability", "Analysis
    results cross upward through a gated install", "Build pipeline as a
    track, not a layer"), and an appendix sits outside the reading order
    they link into. Default: (a).

36. **R-DR1-36 — "Business rules define the domain" has no entry.**
    `docs/book/vision.md` §5 principle 4 (when a rule has no expressible
    form, extend the language, never contort the rule) is in no entry.
    Options: (a) a new decision in chapter 27, "Vivace: models as the
    program", before "Vivace hypothesis"; (b) a clause of R-DR1-19;
    (c) leave it in the vision chapter only. Recommended: (a), because it
    governs how a domain model is extended, which is Vivace's question.
    Escape hatches (principle 8) are already held by "The `unsafe`
    hierarchy and safe wrappers" and "`assume` is the admitted tier".
    Default: (a).

37. **R-DR1-37 — One Tier-0 amendment for Part I.** The rulings above
    change what `docs/book/vision.md` states: §1a's tier list (R-DR1-25),
    §2's "the SAME machinery" sentence (R-DR1-5), §2 leg 3 (R-DR1-9), "the
    executable carries only residuals" (R-DR1-6), §1's three tiers as an
    extensible core (R-DR1-3), and the motivations' decisions, which the
    vision does not carry (R-DR1-2, R-DR1-17, R-DR1-19, R-DR1-20,
    R-DR1-26, R-DR1-32). Options: (a) one dedicated Tier-0 PR with the
    maintainer's sign-off, made when chapter 1's content is written in
    phase 2, carrying every Part I change; (b) one Tier-0 PR per ruling;
    (c) no amendment: the book's Part I supersedes the vision where they
    differ. Recommended: (a). (c) leaves two texts that disagree, one of
    them the constitution. Default: (a).

38. **R-DR1-38 — Ratify or strike each term under *Terms introduced*.**
    Default: ratify both.

## What is already covered

These rulings already settle parts of Part I: D4 (the type system stays
outside Allegretto) and D27 (minimal base surface) for R-DR1-13 and
R-DR1-14; D50 (units in a narrow DAG) for R-DR1-21 and R-DR1-22; D7
(`Type : Type`, stratified at export) for R-DR1-11; CE-R1 and CE-R8 for
R-DR1-6's weaker paths; R-R1 (substrate and surfaces) for R-DR1-12;
R-R3 (the differentiator map) and R-R4 (the ladder order) for R-DR1-23 and
R-DR1-24; the layer rulings 1 to 4 (2026-07; parser is L1) for R-DR1-18
and R-DR1-15; R27 for R-DR1-16 (ordered choice is an expedient); R23 (the
contents and the tour) for the motivation proposals; R29 (capability and
implementation decisions) and R33 (the ten type calls) for every type
this review keeps. The tour tells the significance-5 decisions; this
review only rules them. Not covered: every restatement, split, merge,
removal and new decision above, and the code changes of R-DR1-3 and
R-DR1-6.

## What changed

### 1. The decisions against the code

| Decision | What the code does | Pointer | Verdict |
|---|---|---|---|
| Programmable language platform | Standard is a host object behind the `typed` flag; `--base` loads no extension | `src/index.ts:115`–`119`, `src/runtime.ts:1169`–`1174`, `src/types-std.ts:4894` | partly |
| Partial evaluation as the compilation model | types, effects and proofs by evaluation; termination and exhaustiveness by graph walks | `src/evaluator.ts:1150`, `src/totality.ts:219`, `477`, `929` | partly |
| One predicate machinery | predicate sets for refinements; label sets for effects; no information flow | `src/effects.ts:41`, `src/primitives.ts:3241` | partly |
| Compile-time first | effect mismatch halts before running; proofs halt after the run; return-type mismatch never halts | `src/runtime.ts:870`, `1511`, `1686`–`1703` | wrong |
| Participant-neutral protocol | one kernel check for every prover; the verdict credits every theorem to `auto-PE` | `src/pcp.ts:831`, `pcp/llm-worker.ts:340`–`354` | partly |
| Three-leg proof strategy | legs 1 and 2 built; no SMT | none in `src/` | partly |
| SMT as a selective fallback | nothing | none | not built |
| Proofs exportable | no export; library proofs re-checked at load | none | not built |
| Substrate and surfaces | DSLs over Standard inherit its checks; none loads under `--base` | `lib/units.alg:241`, `lib/planning.alg:24` | partly |
| Simplicity criterion | 178 primitives, 54 Standard ones, all resolved in Allegretto | `src/runtime.ts:156`–`160` | partly |
| The base does not know the layers | evaluator imports L2; futures imports the type system; Allegretto builds a `Proof` | `src/evaluator.ts:9`–`10`, `src/futures.ts:11` | partly |
| Language extensions are declarative | ordered choice; implicit production replacement; later duplicate binding wins | `src/grammar2/engine.ts:945`, `src/grammar2/fragments.ts:154` | partly |
| Allegretto is syntax-free | no L0 parser | `scripts/analyze/units.json` | holds |
| Units in a narrow DAG | 2 violations, 5 mixed files, 456 kind comparisons | `npm run lint:units` | partly |
| Unit granularity rule | a rule, checked by no tool | `docs/book/units.md` §2 | holds |
| The three moves | a framing; no code | none | n/a |
| The demo ladder | rungs 1 to 3 pinned; rung 4 under construction | `demos/rung1/` to `demos/rung3/` | partly |
| Every claim states its strength | `proven` absent from the verdict; `proven-safe` and "verified" over sampled backing; three tier lists | `src/introspect.ts:496`–`504`, `src/pcp.ts:230`, `src/totality.ts:500` | partly |
| Formal claims in the program's syntax | every claim kind has a spelling | `tests/proofs-demo.alg:10` | holds |
| Reviewability | `inspect` and the grade; no semantic diff | `src/introspect.ts` | partly |
| Progressive disclosure | inference, tactics library, `inspect` | `lib/tactics.alg` | holds |
| Analyzer silence | silent on unknown; a name compare reports a false error | `src/runtime.ts:870` | partly |
| Surface syntax is provisional | no deprecation mechanism | none | partly |

### 2. New held findings

Each is recorded on its decision's inventory entry when the maintainer
rules, and fixed in the chapter PR that takes it (R36).

| # | Finding | Decision | Chapter | Pointer |
|---|---|---|---|---|
| 1 | A failed proof halts only after every top-level effect has run | Compile-time first (R-DR1-6) | One engine for compiling and proving | `src/runtime.ts:1686`–`1703` |
| 2 | A declared return type that fails does not halt | Compile-time first (R-DR1-6) | One engine for compiling and proving | `src/runtime.ts:864`–`877` |
| 3 | Termination is found by a structural walk, not evaluation | Termination by bounded decrease | Termination and completion | `src/totality.ts:477`–`1140` |
| 4 | Exhaustiveness is found by a structural walk | Exhaustiveness checking at info severity | Termination and completion | `src/totality.ts:219`–`257` |
| 5 | Allegretto resolves 54 Standard primitives | Minimal base surface of about forty primitives | Values and their seven kinds | `src/runtime.ts:156`–`160` |
| 6 | The evaluator names `type`, `effects`, `predicates`, `domain`; futures imports the type system | Knowledge propagation inside the evaluator | Installing a layer into the base | `src/evaluator.ts:801`, `834`; `src/futures.ts:11` |
| 7 | The L1 base grammar and tree builder hold Standard's statements and primitives | Theorems as statements, proved `by` a term | Proofs as values | `src/grammar2/base-grammar.ts:748`, `src/grammar2/tree-builder.ts:1384` |
| 8 | A name bound twice takes the later value silently | Statement forms that declare a binding | The surface language | a scratch run |
| 9 | A sampled `proven` clause is absent from the verdict and the ledger | Bounded sampling for universal claims | Proofs as values | `src/pcp.ts:1021`, `lib/proven.alg:4` |
| 10 | `proven-safe` means only "no complaint" | Safety grade as the default verification surface | Tools over the pipeline | `src/introspect.ts:500`–`503` |
| 11 | "Verdict (verified)" and "✓" over sampled backing | The verdict as accumulated metadata | When a check fails | `src/pcp.ts:646`, `959` |
| 12 | Authorship is not kept: the verdict credits `auto-PE` | Obligations and proposals as machine and human views | Tools over the pipeline | `src/pcp.ts:831` |
| 13 | The return check compares names and reports a refined return as a mismatch | Type annotations on parameters and returns | The surface language | `src/runtime.ts:870`, `tests/refinements.alg:20` |

Findings 1 and 2 are R-DR1-6's own change under R-DR1-1 (a); the rest
wait for their chapters. Findings 9 and 11 to 12 touch `src/pcp.ts`, in
the planning-loop stream's boundary.

### 3. Other findings

1. **Open question 5 of the inventory is stale.** It says a bounded
   induction reaches the verdict with no sampled tier. Today the ledger
   carries it: `allegro verify tests/proofs-induction-demo.alg` prints
   "assumption ledger: rests on 0 admitted, 1 sampled". For the
   inventory's Open questions.
2. **`docs/book/standard/totality.md` says a failed type annotation
   halts** ("Failed refinement/type ANNOTATION check | **halt**"), and
   the CLAUDE.md invariant says the same; a return annotation does not
   (§2, item 2). For the maintainer: either text is wrong until R-DR1-6
   is taken.
3. **The inventory's chapter 2 says 9 decisions and lists 10.** The type
   check records the list's fix, not the count's.
4. **The `--base` REPL loads no extension either**
   (`src/index.ts:252`–`253`), the same gap as R-DR1-3.

### 4. Order and dependency findings

1. **"The three moves" depends forward.** Its second move is
   "Every claim states its discharge strength" (chapter 3), placed after
   it in chapter 2. R-DR1-23 (a) removes the entry; (b) moves it.
2. **"The demo ladder" tests chapter 3's decisions from chapter 2**
   (R-DR1-33).
3. **"Language extensions are declarative" lacks three dependants**
   (R-DR1-16).
4. **Missing edges**: "Compile-time first" on R-DR1-5 (R-DR1-6);
   "Participant-neutral" on R-DR1-2 (R-DR1-8); "Allegretto is
   syntax-free" on R-DR1-17 (R-DR1-18); "Formal claims" on R-DR1-5
   (R-DR1-27); "Reviewability" on R-DR1-2 (R-DR1-28); "Surface syntax"
   on R-DR1-17 (R-DR1-31).
5. **No capability decision of Part I depends on an implementation
   decision.** R-DR1-21 and R-DR1-22 are the only implementation
   decisions; their dependants are implementation too.
6. **No cycle.** The proposals add edges only from earlier to later.

## Terms introduced

- **Principle decision**: a decision that
  states a rule other decisions realise and holds little or no code of its
  own; a violation of it is fixed in the decision whose unit holds the
  wrong code.
- **Proposal from the motivations**: a new decision this review derives
  from the author's motivations, for the maintainer to accept, restate or
  strike; it has no source in the repository beyond the inventory's
  motivations section.

## Rulings taken

(Placeholder: the maintainer's rulings on R-DR1-1 to R-DR1-38.)
