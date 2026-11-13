# The book pass: phase 1 closed

> **Record.** Reader: RD-2 (the owner returning after a gap). Form:
> W-008 (reports map their deliverables). Subject: the close of phase 1
> (the decision review) of `docs/plans/book-pass.md`, 2026-11-13.
> Author: the review session. It states what phase 1 leaves, for the
> maintainer and for whoever revises the plan.

## Asks

1. **Decide how the pass proceeds.** The maintainer has said the plan
   will change after the pilot stream's review of where it stands and
   of this stream's findings. Phase 2 is not started and nothing here
   presumes its shape.
2. Five things phase 1 leaves owed, for that decision:
   - the 15 held entries of the planning pilot, unruled;
   - the style pass on the decisions' titles and wording;
   - the replacement of `docs/book/vision.md` by the tour and Part I,
     which needs a Tier-0 pull request and the maintainer's sign-off;
   - every code change: phase 1 changed no code, and each difference
     between a ruled decision and the code is a held finding;
   - a use case on every decision of Parts I to V; Part VI's entries
     have one.

## What is already covered

The six parts, each ruled in the review session and merged by the
maintainer: Part I (PR #185), Part II (PR #187), Part III (PR #190),
Part IV (PR #191), Part V (PR #193), Part VI (PR #195). Each has a
record beside this one, holding the conflicts brought, the rulings
and the maintainer's words.

## What changed

At the close, in `docs/plans/book-pass-inventory.md`: the contents are
regenerated from the entries, with final chapter numbers and decision
lists; the header's counts are recounted; the table of today's
chapters names current chapters in its "Goes to" lists.

## What phase 1 leaves

**The inventory.** 231 decisions in 6 parts and 38 chapters, each
checked against the parts before it: every dependency names an earlier
decision, and no capability decision depends on an implementation
decision. At the merge of the fragments it held 256 in 33 chapters.

| Part | Chapters | Decisions |
|---|---|---|
| I, the bet | 2 | 23, and a thesis statement |
| II, the kernel | 7 | 51 |
| III, syntax and modules | 4 | 23 |
| IV, the standard language | 10 | 63 |
| V, Vivace | 6 | 27, of which 15 held; and an introduction |
| VI, building and running programs | 9 | 44, and an introduction |

By status against the code: 93 settled, 62 partly built, 76 open. The
review states each decision as the goal, so more are open than the
sources recorded.

**What the review changed most.** One operation, partial evaluation,
with phases as configuration and no compile time. One kind of claim,
which nothing softens. An extension made of functions and metadata
fields, with no fixed points where the evaluator calls into it.
Authority as an unforgeable value that reading never yields; effects
as the use of capabilities. Parsing as evaluation, with a grammar that
changes as a text is read. A passive kernel behind a stated interface,
a launcher that does only what cannot be done in Allegro, and a
stated trusted base.

**Designs to prove.** Decisions ruled as the goal whose design is
still to be shown workable:

- "A recursive call is evaluated once for each state of knowledge".
  The maintainer expects much of Allegro's potential here.
- "A function may take an argument unevaluated", with two use cases:
  knowledge inside a branch, and "A solver sees its problem
  unevaluated".
- "Every value keeps its origin": the cost assumptions.
- "The same program and the same information give the same result".
- "Machine arithmetic is a set of pure primitives that ships with the
  platform", and "Every pure primitive the platform ships has a
  reference definition".
- "Who may use a member is a claim about where the access was
  written".
- "A text can change the grammar it is read in", which needs a parser
  engine written for it.
- "A full configuration is a model, evaluated in a first phase".
- "Two models relate only through a declared mapping": the kinds of
  mapping.

**Held findings.** 83 on their decisions, summarised in 42 rows at the
inventory's top. The largest: the standard language is host code that
the evaluator calls at fixed points; the pipeline's stages and phases
are fixed; parsing is a host stage that scans a header ahead of the
parse and relies on the order of alternatives; effects are label
strings checked separately; there is no stated kernel interface.

**Two earlier rulings promoted.** A match that can fall through, and
a failed construction of a refined value, are refutations.

**Removed from the language.** `is_resolved`; `observe`; the facts
kept on a scope; severities and their configuration.

**Filed for other sessions.** B-194 (one vocabulary of four strengths
in the planning loop), open, for the planning-loop stream. B-182 (unit
tidy-ups from the book pass) carries no lines. Earlier items the pass
filed have landed.

**Not started.** Phase 2: the tour, each chapter's IR and prose, and
the code changes. The preface is written; the pilot chapter on
metadata was a dry run made before the review and is to be redone.

## Terms introduced

No terms introduced. The terms the reviews introduced are ratified in
their own records.
