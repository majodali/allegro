# Classification

The binding declaration for `majodali/allegro` under
[majodali/methodology](https://github.com/majodali/methodology) —
field definitions and omission defaults per the methodology
[vocabulary](https://github.com/majodali/methodology/blob/main/docs/vocabulary.md).

- **C-tier**: C2 — serious project, pre-users
- **Pinned methodology version**: 1.6.0 (compliance target; migrated
  from 1.5.0 on 2026-10-28 — v1.6.0 carries one migration note, the
  amended W-008 bootstrap block, which this repo's `CLAUDE.md` now
  carries verbatim)
- **S-level**: S0 — public code only
- **Type**: `language/tool platform`
- **Target**: `static site` (allegrolang.org — landing page, sandbox,
  and the web-bundled interpreter, deployed via `deploy.sh`)
- **Workflow**:

  `stages: in-dev → merged → live; live = live; backlog default: checked ⇒ merged, unchecked ⇒ in-dev`

  The live stage is published at allegrolang.org; deploys are
  owner-run, never agent-run. A Backlog entry departing from the
  default carries an explicit `stage:` marker — `[stage: live]` for an
  entry whose public surface is deployed, `[stage: in-dev]` for one
  under active work. Reworded to the canonical form at the v1.4.0
  migration (methodology vocabulary, *Workflow*); the three parts were
  already present in substance.

## Repository settings (owner-run)

- **Branch protection on `main`** (a ruleset; set by the owner
  2026-10-30 at the gate of B-164 (ratchet baselines under concurrent
  merges)): status checks must pass, with the CI job `test` required,
  and a branch must be up to date with `main` before it merges. The
  second makes the stale-base case of B-164 impossible rather than
  forbidden: a merge can no longer pair one branch's lowered ratchet
  baseline with another's new count, because the merging branch always
  carries the other's merge. The baseline rule in `CLAUDE.md` still
  says where the lowering commit goes.

## Deviation register

**D-2 — merge-on-green streams** (W-006, the PR waits for owner review;
recorded 2026-10-30, owner B-165 (merge-on-green recorded as a
deviation)). A stream whose stream plan declares merge-on-green, and
that the maintainer has so ratified, merges its own PRs: the agent
running the stream merges a PR once the gate is green and it has read
the diff. The policy holds only while the stream meets four conditions:

1. a mechanical oracle decides each chunk (deterministic counts, pinned
   outputs, a lint), not a judgment;
2. no ruling is open inside the chunk — a chunk needing a decision stops
   as `docs/book/process.md` §3 says;
3. the chunk's files are disjoint from every other active lane;
4. the chunk is reversible by a revert of its merge.

A chunk that fails any one condition waits for the maintainer like any
other PR. The four stop conditions of the pre-ratified sequence are
unchanged. First instance: the performance stream, B-157 (the
performance stream), ruling R3 (the stream's merge policy) of
`docs/plans/fast-library-load.md`,
taken 2026-10-28, ten PRs merged on green. The maintainer ratified the
policy for qualifying streams on 2026-10-30. `docs/book/process.md` §3
("a merged PR is the maintainer's approval; nothing else is") is Tier 0
and contradicted this practice until the maintainer signed off the
amendment of `docs/plans/parallel-streams.md` §5 as the dedicated
PR #117, merged 2026-10-30; §3 now carries the paragraph
"Merge-on-green streams". **Retires**
when the pinned methodology version carries merge-on-green as a
standard, which the maintainer says an upcoming version will.

**D-1** (W-001, the per-chunk gate) was recorded
2026-09-01 and **retired 2026-09-05**: methodology v1.5.0 released the
pre-ratified sequence mode with allegro as its evidencing instance, and
`docs/book/process.md` §3 now states all four of the released rule's stop
conditions — the two it already carried, plus a failed check and a chunk
whose landing summary carries asks. The practice and the rule agree, so
there is nothing left to deviate from. Owner: B-131, closed.

*(W-006 is adopted in full — owner ruling at the chunk-1 gate, 2026-08:
agent work uses single-use, outcome-named branches, deleted after merge.
Extended 2026-09-01: a merged PR is the approval signal, open questions
update the same branch and its PR, and a new branch waits for the merge.)*

## Rules adopted by declaration

- **W-009 (the methodology corpus writes its deliverables IR first)**,
  adopted 2026-10-30 for the book's new chapters: the five chapters of
  stream A (B-170 (the book, Part II and III chapters writable now),
  `book-chapters-now.md` under `docs/plans/`) are written first as an
  [intermediate representation](https://github.com/majodali/methodology/blob/main/docs/intermediate-representation.md)
  beside the chapter, under the specification at the pinned version.
  The owner's designations under that specification: the evaluator
  chapter is normative text, rendered by the reasoning role and
  reviewed in stranger rounds; the evaluation pipeline, tooling, host
  environments and demo-ladder chapters are IR-only documents for now,
  to be rendered and reviewed at a later stage; the stranger is a fresh
  Haiku instance per round; a chapter's claims about the code as
  implemented carry `[proposed: this IR]` with evidence pointers and are
  ratified in bulk at the chapter PR's merge, listed in its Asks. The
  existing chapters are not retrofitted under this adoption; the
  retrofit is a separate stream, B-174 (the book's existing chapters
  retrofitted to IR). The gate runs the specification's mechanical
  checks over every IR (`npm run lint:ir`, B-173 (the book writes IR
  first)).

## Custom definitions

- **Definition site** (owner, 2026-10-30, for W-009 as adopted above):
  in this project the definition site of a term is the `def-` anchor in
  the book chapter that defines it (`docs/book/`, D52 (the
  documentation book)), not a row of a project vocabulary, which this
  project does not keep. An IR's `defined-at:` links point into the
  book.

(Candidate for a future entry: the `// expect:` literate-demo
convention in `tests/` and `demos/`, if audits want it named; deferred
until needed per Article 6.)

## Adoption transition (Article 7 sandbox designations)

No active designations. The four designations opened at adoption
(CLAUDE.md, plans home, memory, Backlog location) were all resolved
2026-08 by the authority-relocation arc; the resolution record lives
in [docs/plans/methodology-adoption.md](plans/methodology-adoption.md)
and `docs/CHANGELOG.md` (B-095).
