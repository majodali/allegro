# Decision review: Part V, Vivace (DR5)

> **Record.** Reader: RD-2 (the owner returning after a gap). Form:
> W-008 (reports map their deliverables). Subject: chunk DR5 of
> `docs/plans/book-pass.md`, phase 1 (the decision review), the 23
> decisions of Part V in `docs/plans/book-pass-inventory.md`, read on
> `origin/main` at `7453dba`, 2026-11-12, against the 163 decisions of
> Parts I to IV as ruled, and against the rulings of the planning-loop
> stream (`docs/plans/planning-loop.md` §6) taken since the inventory
> was built. Author: the review session, which read every entry itself
> and brings the conflicts to the maintainer before any decision is
> reworded. Method: R38 (the purpose of the decision review) of the
> plan. Rulings are recorded here as they are taken.

## Asks

The first reading found ten points where Part V, as the inventory
states it, conflicts with Parts I to IV or is left open by them.

1. **What Part V decides that Part I does not.** Part I now states
   Vivace's hypothesis as decisions: a system is described in the
   language of its domain, and a language inherits every check of what
   it is built on. "Vivace adds a discipline, not machinery" and the
   hypothesis entry repeat them in the vocabulary of layers. Proposed:
   Vivace is the practice and the worked languages that test Part I's
   decisions; the part's opening says what is tested and how far the
   evidence goes.
2. **Plan choices recorded as decisions.** "Three different pilots,
   planning first" and "Library before surface" are choices of what to
   build and in what order, like the choice of units of measure that
   the Part IV review removed. "Shape 1 before Shape 2" hides a
   design decision: under "Phases are configuration", checking a model
   and running it are one evaluation with different capabilities.
3. **The proposal the Part I review deferred**: "Business rules define
   the domain".
4. **The inventory is behind the planning-loop stream.** Since it was
   built, that stream ruled what a plan obligation is (a gap the
   catalog cannot fill), what a proposal may be (one catalog entry;
   the author's plan never changes), how an open plan is declared, and
   how a solved plan's promises are recorded. The entry "Composition
   of models and the AI loop over a model" still says the loop has no
   design. In Part I's terms the stream's rulings generalise: an
   obligation is a claim waiting for a value, and a proposal supplies
   it.
5. **A well-formed plan.** "Two enforcement shapes" has the plan
   constructor yield an error value and an annotated binding halt.
   The Part IV review made a failed construction a refutation, and
   "Nothing is a claim until someone makes it" gives the two cases
   directly: a plan claimed well-formed, and an open plan that claims
   nothing yet.
6. **A predicate that explains its refusal.** The entry is general,
   not about plans, and has the kernel carry an error value's text.
   The kernel now treats anything other than true as a refutation, so
   an explanation can be what the predicate answers.
7. **Search in the library.** "Library search over kernel residuals"
   computes a plan's bound in library code where partial evaluation
   with the choices unknown would give it. The entry itself says the
   book must argue this against the thesis.
8. **Composition of models** is open here and open in Part I ("A
   mapping between models is itself a checked value"): one question
   recorded twice.
9. **Units of measure** is a worked domain language and sits in
   Part IV. Part V is where worked languages go, and planning depends
   on it.
10. **Wording**: layers, tiers, rungs, pilots, shapes, compilation,
    and the planning-loop stream's use of "admitted" and "discharged"
    where the Part IV review ruled one vocabulary of four strengths.

## What is already covered

Parts I to IV as ruled. The planning-loop stream's rulings taken by
the maintainer on 2026-11-07: what a plan obligation is, what a
proposal may be, one worker for every kind of obligation, how a
solved plan's assumptions are recorded, and how an open plan is
declared.

## What changed

Part V of `docs/plans/book-pass-inventory.md`. It opens with an
introduction, "What Vivace is for", that is not a list of decisions.
Eight decisions follow in three chapters: Models; Search and
optimization; Analysing models. The worked languages come after: Units
of measure (moved from Part IV, as reworded there) and the two planning
chapters, whose 15 entries are held, not ruled. Seven entries stop
being decisions. One moves to Part IV's "When a check fails" as "A
predicate can explain its refusal". Notes are added to two Part I
decisions. The inventory holds 218 decisions.

## Terms introduced

- **Model**: a description of a system, written in a language made for
  its domain and precise enough to be checked.
- **Meta-model**: the language a model is written in: its types, its
  notation and its claims.

Both are defined in the introduction to Part V; the maintainer used
them in the rulings below.

## Rulings taken

**The first drafts, 2026-11-12.** The maintainer asked what the
opening decision decided that was not already decided, and what the
two entries it replaced had decided. The review's answer: nothing
still open. "Vivace adds a discipline, not machinery" is Part I's "A
language inherits every check of what it is built on"; each statement
of the hypothesis entry is a decision of Part I or Part IV, or a
plan's choice. The draft is withdrawn.

- Ask 3, the proposal the Part I review deferred, is struck. The
  maintainer: "Extending a language is about having it correspond
  more closely to a given model and clearly and efficiently expressing
  statements in and about that model. It's rarely, if ever, about 'A
  rule that cannot be said'", since a rule in an extended language can
  probably be stated in a base language, far less efficiently.
- The pilots are set aside: "let's hold off on pilots in general and
  the planning pilot in particular. We need to clarify the
  foundational decisions first, and much of the work in those areas is
  very arbitrary."
- The maintainer proposed an introduction that defines the practice
  of modelling and states Vivace's purpose more narrowly than
  Allegro's, with five points that are definitions and rationale more
  than decisions: models are checked with the same rigour as any
  program (decided earlier); inputs and outputs are written in the
  language that expresses them most clearly and efficiently (a goal);
  real problems need several models that interact in subtle ways (an
  observation); many domains need search and optimization that are
  hard to define in traditional languages (an observation); beyond
  modelling, Vivace brings meta-modelling.

**The structure and five foundations, ruled 2026-11-12.** The
maintainer agreed with the structure (an introduction; foundations;
meta-modelling as an open section; worked languages held) and with
the five foundation decisions:

1. "A model is a value." The maintainer: "a model is definitely a
   value and Vivace provides the tools and meta-model(s) to construct
   model values (as well as inspect, transform, compare, etc)".
2. "Solving is proposing a value for an unknown, and the kernel checks
   it."
3. "Feasible is decided; best says how strongly it holds." The
   maintainer: "exactly my understanding of search vs optimization".
4. "Two models relate only through a declared mapping." The
   maintainer sees it as critical: "Vivace needs to formally define
   every mapping through which two models can relate."
5. "A change to a model is a mapping from the old one" (open).

Added from the maintainer's notes on them:

- "A transformation is a model": "Transforms are also models - not
  just imperative functions, declarative models that define
  functions."
- "A solver sees its problem unevaluated" (open). The maintainer:
  unknowns may be unbound symbols, which ordinary evaluation turns
  into a residual, and a solver function with them; solver functions
  can take unevaluated arguments, "but this may be a use case for
  something akin to `is_resolved`"; "Vivace should provide functions
  that parse expressions and return resolved and unresolved parts."
  The review's reading, to confirm: a solver that evaluates its own
  unevaluated argument reads the residual it gets back, which gives
  what `is_resolved` would without restoring it for every function.
- "A model's quality is a question for analysis" (open). The
  maintainer: "what Vivace provides is the tools to analyze models
  logically and empirically to help answer questions like
  effectiveness and efficiency."
- "Discipline, not machinery" is no longer said: Vivace brings
  mechanisms, all of them extensions, and adds nothing to what must
  be trusted.
- Two placements agreed: "a model is checked and run by the same
  evaluation" is a consequence of "Phases are configuration" and is
  stated in the introduction; "an obligation is a claim waiting for a
  value" is a note on Part I's "Anyone may propose, and the record
  shows who".

**Carried by the review, for the maintainer to confirm on the PR.**
"A refinement predicate explains its own refusal" is general, not
about plans; it moves to Part IV as "A predicate can explain its
refusal". "Composition of models and the AI loop over a model" and
"Mixed-model solution finding as the capstone" are absorbed by "Two
models relate only through a declared mapping". Units of measure
moves to Part V with the worked languages. Asks 5 and 7 concern the
planning pilot and are recorded as known conflicts on the held
chapters.
