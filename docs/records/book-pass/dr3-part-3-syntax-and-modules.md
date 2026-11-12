# Decision review: Part III, syntax and modules (DR3)

> **Record.** Reader: RD-2 (the owner returning after a gap). Form:
> W-008 (reports map their deliverables). Subject: chunk DR3 of
> `docs/plans/book-pass.md`, phase 1 (the decision review), the 25
> decisions of Part III in `docs/plans/book-pass-inventory.md`, read on
> `origin/main` at `d3be406`, 2026-11-12, against the 72 decisions of
> Parts I and II as ruled in DR1 and DR2. Author: the review session,
> which read every entry itself and brings the conflicts to the
> maintainer before any decision is reworded. Method: R38 (the purpose
> of the decision review) of the plan. Rulings are recorded here as
> they are taken.

## Asks

The first reading found fourteen points where Part III, as the
inventory states it, conflicts with Parts I and II or is left open by
them. They are put to the maintainer in the review session, structural
ones first.

1. **What the parser is.** The kernel holds no language and its
   primitives do not include parsing. The parsing engine is host code
   today. Under Part I it is either a function written in Allegro or a
   capability that ships with the platform, as machine arithmetic does.
   Either way parsing is evaluation: a function from a grammar and a
   text to an expression, run in whichever phase has the text.
2. **How the first grammar arrives.** With no language in the kernel,
   the first grammar cannot be written in a notation. Proposed: it is a
   value the configuration supplies, and every later grammar is written
   in a language an earlier one defines.
3. **What an extension is, concretely.** Part III uses "extension" for
   a set of named bindings an execution context injects, and "module"
   for an extension built from a file. Parts I and II use "extension"
   for the one unit of extending: functions, metadata fields, declared
   capabilities. Proposed: one concept. A module is an extension, and a
   notation is one more thing it may carry.
4. **`use` and `import`.** Two keywords, four `use` forms. Under
   "Meaning comes before notation" the real distinction is between the
   notation a text is read in and the names a program refers to.
   Whether the two keywords draw that line, and where field
   registration and capability declarations fall, is not stated.
5. **Every notation stands for an expression.** The `grammar { … }`
   block maps each form to a template. That is "Meaning comes before
   notation" made concrete, but no decision says a notation can do
   nothing else. The base grammar's tree builder is host code and can.
6. **Combining grammars must not depend on order.** Deltas include
   `Replace`, `Remove` and `Wrap`; `Append` and the front splice of
   `expr_form` depend on ordered choice; replacing a base production
   only warns. "Order of definition carries no meaning" requires that
   two `use` lines give the same language in either order, or a
   conflict.
7. **Ambiguity as a claim.** "Ambiguity is a compile-time error" names
   a concept Part I removed, and ambiguity of a grammar is undecidable
   in general. Proposed: "this grammar is unambiguous" is a claim, with
   the three outcomes of any claim; a text with two parses is a
   refutation; conflicts between extensions are refutations too.
8. **The algorithm.** The inventory records the shipped engine
   (ordered choice, seed-growing left recursion) and a specification
   that says GLL. The maintainer has said ordered choice must not be
   required and the algorithm stays swappable. To rule: what the
   decision requires of any algorithm, and whether the two
   engine-specific entries stay as decisions.
9. **Indentation.** The offside rule is built from stateful terminals
   the engine implements. An extension cannot define another stateful
   terminal, and a parser state beyond the offset constrains the choice
   of algorithm.
10. **Modules reach files through a capability.** Resolving and reading
    a module is an effect. Under "A capability is granted, never
    acquired" the loader's file access is a capability the
    configuration supplies. The web host's second loader would then be
    a second supply of one capability, with one loader function.
11. **Loaded once.** Caching looks like an optimisation, but identity
    depends on it: a field is registered once, and unforgeable values
    are told apart by identity. Proposed as a capability decision: an
    extension is evaluated once in a configuration.
12. **The pipeline.** "One `evalSource` pipeline" guarantees that a
    library is checked as a program is. Its fixed stages conflict with
    "An extension is made of functions and metadata fields" and
    "Phases are configuration". Proposed: keep the guarantee as the
    decision; the stages, the header pre-scan by each caller and the
    in-place writers behind "A library's values are immutable after
    load" become held findings.
13. **Wording that names layers, tracks, base mode or compile time**,
    and a grammar defined as an Object over a union type, which are
    Part IV's terms. Mechanical, after the above.
14. **The proposal DR1 deferred**: "A program built by a program is
    checked like any other". DR2 did not take it up. If parsing is
    evaluation and yields an expression, it belongs here.

## What is already covered

Parts I and II as ruled (DR1 and DR2, 2026-11-11 and 2026-11-12). The
maintainer's earlier statements on the parser: the algorithm stays
swappable, ordered choice must not be required, extensions are
declarative. The held findings already recorded on Part III's entries.

## What changed

Part III of `docs/plans/book-pass-inventory.md`, from 25 decisions in
three chapters to 23 in four: Parsing; Changing the grammar; The parser
engine; Modules and programs. One decision is added to Part II's
"Extensions" chapter ("What the kernel requires of an extension"). New
held findings are on the entries that name them and in the table at
the inventory's top. Every dependency of Parts I to III points to an
earlier decision, and no capability decision depends on an
implementation decision.

## Terms introduced

No terms introduced.

## Rulings taken

**Asks 1 to 4, ruled 2026-11-12.**

- Ask 1: "Parsing is evaluation" is correct. The platform ships a
  bootstrap parser as a capability. It also ships a parser generator
  and a parser engine written as Allegro functions, so that partial
  evaluation can work on them. The maintainer: "There's nothing
  privileged about the bootstrap parser we provide"; a platform may
  load more than one parser module, or use another bootstrap parser.
- Ask 2: the first grammar arrives in a built package: a parser
  generator, its engine, and a set of grammars as input data. The
  maintainer: extensions that build Allegro expressions directly were
  not discussed before and should be allowed, to make bootstrapping
  efficient.
- Where a parsed expression came from in its text is recorded outside
  the kernel. The maintainer: "Source attachment is not a promise the
  kernel needs to know about." The parser module provides the parser
  function and the registered writer of its own field; the parse tree
  stays internal to the parser.
- Ask 3: a module is an extension, with the same interface. The kinds
  of artifact differ for the bootstrapping reason: the kernel's
  mechanism is as simple as possible and more sophisticated mechanisms
  are loaded as extensions. A grammar definition is a value to the
  kernel, not a third kind of extension item. The module loader is an
  extension, and it handles grammar definitions and the `use`
  declaration.
- Ask 4: two cases are foundational: importing value bindings, and
  importing a grammar for immediate use in parsing the current text.
  The choice of keywords is implementation only.

**On the first drafts, ruled 2026-11-12.**

- "Parsing is evaluation" drops its sentence on phases: when a parser
  runs follows from the partial-evaluation decisions already given.
- "No parser is privileged" and "A parser records where each
  expression came from in its text" are confirmed. The kernel's origin
  field and the parser's source field are two fields: the kernel sets
  the expression an expression came from; a parser annotates a parsed
  expression with its source information.
- The draft "The kernel takes expressions, never text" is replaced.
  The maintainer: set out the extension mechanism's requirements,
  likely with requirements for configuration and the startup process;
  requirements, not implementation decisions. The extension mechanism,
  parsing, module import and script execution each get a foundational
  decision, and one statement says that programs entering by any of
  these channels are evaluated by the same mechanism. The proposal DR1
  deferred (a program built by a program is checked like any other)
  folds into that statement.
- The platform ships no parser as such and no parser generator as a
  concept. It ships a parser engine built ahead of time, which takes a
  grammar and a text and returns an expression, and inbuilt grammar
  definitions.
- A grammar may change part way through a text. The maintainer: "our
  parser starts with an initial grammar and modifies it (augmenting or
  replacing) at a specific point in the parse, so all following text
  is parsed with the modified grammar." Scanning a text ahead of the
  parse is rejected: the declaration may appear part way through, and
  grammars may define their own features of the kind. The shipped
  implementation scans so that it can use a simple parser; the
  inventory states the original goal, which needs a custom engine.
- The draft on modules splits in two: one decision on modules, one on
  grammar extension. A program's main file is loaded by the module
  loader as well.

**Five redrafts agreed, 2026-11-12.**

1. "What the kernel requires of an extension": requirements for the
   mechanism, the configuration and startup. It goes to Part II's
   "Extensions" chapter, with the maintainer's approval.
2. "The platform's parser engine ships already built"
   (implementation).
3. "A module is an extension that arrives as a file." The loader is an
   extension; a program's main file is loaded as a module.
4. "A text can change the grammar it is read in."
5. "Every program is evaluated the same way, however it arrives."

Also agreed:

- Running a program is evaluating its main module with the
  capabilities a configuration supplies. The maintainer: the case of
  text entered at a prompt bears considering too.
- A form that changes the grammar stands for an expression; the engine
  evaluates it at once and its value is the new grammar. Parsing and
  evaluation interleave.
- A grammar change reaches to the end of the enclosing block, and
  never past the end of its text. Importing a module's bindings never
  brings its notation.
- The parse must be settled up to the point of a grammar change: a
  condition on any parsing algorithm.

**Asks 5 to 12 and the leftovers, ruled 2026-11-12.** The maintainer
agreed with the recommendation on each.

- Ask 5: "Every notation stands for an expression."
- Ask 6: "Grammars combine without regard to order." Adding a form is
  always allowed; replacing or removing another grammar's form is
  explicit.
- Ask 7: "Ambiguity is a claim."
- Ask 8: "Any parsing algorithm will do that meets five conditions":
  left recursion; no meaning in the order of alternatives; every parse
  reported; the parse settled up to each change of grammar; a state
  carried beside the position. The two entries describing the shipped
  engine stop being decisions.
- Ask 9: "A terminal is a function, so a grammar can define its own."
  The indentation terminals have no special standing.
- Ask 10: "The loader reaches files through a capability."
- Ask 11: an extension is evaluated once in a configuration, written
  into "What the kernel requires of an extension".
- Ask 12: the pipeline's fixed stages, the header scan by each caller
  and the in-place writers are held findings. "A library's values are
  immutable after load", the layer split of module loading, the
  build-pipeline track entry and the scope-chain entry stop being
  decisions; "Rules for user-written EBNF" folds into the entry on the
  `grammar { … }` block.
- Ask 13 is done with the rewrite. Ask 14 is taken in "Every program
  is evaluated the same way, however it arrives".
- The prompt: "Running a program is evaluating its main module with a
  configuration's capabilities." The maintainer: a prompt needs to
  allow rebinding. The entry reads this as each entry opening a scope
  inside the last, so a later binding hides the earlier one.

**On PR #190, 2026-11-12.** The maintainer reviewed Part III: it looks
good. Confirmed: the reading of rebinding at a prompt, the wording of
"What the kernel requires of an extension", and the four chapter
titles.

Every ask is ruled.
