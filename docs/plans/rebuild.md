---
type: stream-plan
status: active
backlog: B-195
lane: S
merge: human-gated
oracle:
  - npm run lint:streams
  - npm run lint:docs:check
  - npx tsx scripts/doc-ref-lint.ts
  - npx tsx scripts/analyze/lane-lint.ts --check
  - npm test
chunks: [G1, G2]
reserves: []
---

# A kernel rebuilt beside the present code — the rebuild program

> **Status: active** — written 2026-11-13 by the orchestrating session
> from the maintainer's rulings of that day (§6). Active since the merge
> of PR #197 on 2026-11-13; chunk G2's commit flips the header. The
> status line and the header's `status` say the same thing.
>
> **Reader**: the maintainer, and the two sessions that each run one
> stream of the program. Assumed known: the decision inventory
> `docs/plans/book-pass-inventory.md` as phase 1 of the book pass ruled
> it, and what that phase left (`docs/records/book-pass/phase-1-close.md`).
> §1 defines the terms. §8 is self-contained: a session that reads only
> §4, §5 and §8 knows what it builds, where, and how it meets the other.

## 1. Outcome and terms

**The maintainer's direction (2026-11-13).** "I want both streams to
move as quickly as possible to refactor the entire project. E.g. the
book review stream will not work on chapter text, but might take it's
phase 1 results and work through chapter by chapter on implementation
decisions and refactoring."

**Outcome.** The code realises the ruled decisions of the inventory.
The program is done when milestone 9 of §5 is signed: every case of the
[acceptance corpus](#def-acceptance-corpus) that must survive or changes
by ruling passes on the [new tree](#def-new-tree), the parser engine
written in Allegro has replaced the bootstrap parser, and the
[present tree](#def-present-tree) is deleted.

**Two streams, one program.** This plan is the program: the approach,
the split, the milestones and the rules by which the streams meet. Each
stream runs from its own plan.

- **The kernel stream**: the review session, lane R. It builds the
  kernel, its interface, the pure primitives, and the standard language
  and parser engine as extensions written in Allegro: Parts II, III and
  IV of the inventory and the chapter "The kernel's interface". Its plan
  is `docs/plans/book-pass.md`, which that session revises; this plan
  states what was agreed for it and edits nothing in it.
- **The acceptance stream**: the orchestrating session, lane Q. It
  builds everything that tests the kernel from outside and everything
  that uses it: the acceptance corpus, the bootstrap, the comparison
  harness, the launcher, the capabilities, the phases and the tools
  (the rest of Part VI), and the models (Part V). Its plan is
  `docs/plans/rebuild-acceptance.md`.

**Terms.** Each is defined here because neither the methodology
vocabulary nor `docs/book/` defines it. Each uses only terms defined
before it. All are proposed at this plan's PR and ratified at its merge.

- <a id="def-present-tree"></a>**Present tree**: the implementation as
  it stood on 2026-11-13: `src/`, `lib/`, `tests/`, `demos/`, `pcp/`,
  `bench/`, `web/`, `website/` and `scripts/`.
- <a id="def-new-tree"></a>**New tree**: the directory `next/`, in which
  the rebuilt implementation is written beside the
  [present tree](#def-present-tree).
- <a id="def-acceptance-corpus"></a>**Acceptance corpus**: the present
  tree's pinned outputs and tests, each classed as one that must
  survive, one that changes by a named ruling, or an implementation
  detail, together with the demo scenes restated as scenarios whose
  expected findings do not depend on exact output text.
- <a id="def-decision-map"></a>**Decision map**: the data file
  `next/decisions.json`, one row per ruled decision of the inventory,
  giving its owning stream, its state in the [new tree](#def-new-tree),
  the unit that realises it and the corpus cases that test it.
- <a id="def-first-notation"></a>**First notation**: the small syntax,
  read by the present tree's parser, in which the first extensions are
  written before a parser exists on the new kernel.
- <a id="def-milestone"></a>**Milestone** (of the rebuild): one of the
  nine states of §5, each shown to the maintainer and signed in §7.

## 2. Why the code is rebuilt beside itself, measured

**The distance.** Phase 1 of the book pass ruled every decision as the
goal and checked each against the code, changing none.

| Measure | Count |
|---|---|
| Decisions ruled | 231, in 38 chapters |
| Settled in the code | 93 |
| Partly built | 62 |
| Open | 76 |
| Held findings against the code | 83, in 42 rows at the inventory's top |

The held findings are structural. The standard language's type system
is about 4,900 lines of host code (`src/types-std.ts`), called by the
evaluator at fixed points; the ruling makes it extensions written in
Allegro. The parser engine, the loader and the pipeline's stages are
host code. The kernel's one primitive table holds 178 entries where the
ruling names six kinds of primitive. No kernel interface is stated.

**Why not in place, in book order.** The inventory's order is
dependency order: the kernel's chapters come before the standard
language's. The present standard language rests on the hooks, the
primitives and the pipeline stages that the kernel's chapters remove.
Changed in place in that order, each kernel chapter breaks the suite
until Part IV is rewritten, and the ruling on "Everything above the
kernel is an extension, and there is one way to extend" allows no
interim stage with host code inside extensions. In a new tree the same
order works: nothing above a chapter exists yet.

**What the present tree is for, from now.** Three jobs: it parses the
[first notation](#def-first-notation) for the bootstrap; it is the
oracle the comparison harness runs beside the new kernel; and its
suite, demos and pins are the raw material of the
[acceptance corpus](#def-acceptance-corpus).

**What the pilots stream had built.** Between 2026-11-06 and 2026-11-12
the planning-loop stream added about 2,200 lines of host tooling
(`src/pcp.ts`, `pcp/llm-worker.ts`, `src/index.ts`), 384 lines of
Allegro library and 1,390 lines of tests. The inventory's Part VI rules
that a tool reads a phase's result and adds no analysis of its own, so
the tooling's mechanism is replaced; its concepts were taken up by the
ruled decisions "Open obligations are listed for any proposer" and "A
proposer answers with only the missing value". The stream's scenes and
findings carry over as corpus cases. Hence the pilots are specified
first and rebuilt on the new kernel, not extended on the present one.

**The risk the order answers.** Phase 1 ruled 231 decisions in four
days, in documents. Its closing record lists nine designs still to be
shown workable, among them recursion evaluated once for each state of
knowledge, arguments taken unevaluated, and determinism. Speed on a
kernel whose type system and parser are written in Allegro is unknown.
Milestone 3 measures it, and the designs to prove are the first work of
the kernel's evaluation chapter.

## 3. Oracle, gate and stop conditions

**This plan's own chunks** are documents; the header's commands decide
them.

**The present tree's gate stays green.** `npm run test:shards` remains
in CI unchanged. It is the oracle's health, not a constraint on the new
tree: no case of it binds the new tree except through its class in the
acceptance corpus.

**The gate, as ruled.** A chunk of either stream merges on green under
D-2 (merge-on-green streams) of `docs/classification.md`, where its
stream's plan declares it and D-2's four conditions hold: a mechanical
oracle decides it, no ruling is open in it, its files are disjoint from
every other active lane, and a revert undoes it. The agent running the
stream reads the diff and merges, or marks the PR to merge when green.
Branch protection on `main` requires the CI job `test` and an
up-to-date branch. The maintainer's gate stays on three events:

1. **A change to a contract between the streams**: the kernel's
   interface file, the saved-program data form, or the
   [first notation](#def-first-notation).
2. **Evidence against a ruled decision**, which goes through the
   hand-off of §8.
3. **A milestone.**

A chunk that opens a ruling, introduces a term or changes a plan waits
for the maintainer as D-2 already says.

**Stop conditions.** The four of `docs/book/process.md` §3, and three
of the program's own:

- **A change to the present tree outside the freeze's exception** (§4).
- **A file outside the stream's lane.**
- **A ruled decision contradicted in code without the hand-off.** The
  code follows the ruling, or the stream stops and files the evidence.

## 4. The trees, their lanes and the freeze

**The new tree.** Every path is under `next/`. A decision's part in the
inventory decides its owner; the [decision map](#def-decision-map)
records it row by row.

| Path | Holds | Lane |
|---|---|---|
| `next/kernel/**` | the reference kernel and its interface file | R |
| `next/prims/**` | the pure primitive functions that ship with the platform | R |
| `next/ext/**` | extensions written in Allegro: the standard language, the parser engine, the module loader | R |
| `next/decisions.json` | the decision map; each stream edits only its own rows | R and Q |
| `next/corpus/**` | the acceptance corpus, the scenarios, the comparison harness | Q |
| `next/bootstrap/**` | the first notation and the emitter of saved programs | Q |
| `next/launch/**` | launchers and capabilities | Q |
| `next/tools/**` | phases as configurations, the commands, the tools for proposing, the decision map's check | Q |
| `next/models/**` | the pilots' specifications and their libraries | Q |

Lane R's globs gain the first four rows and lane Q is new, both in
`scripts/analyze/lanes.json` by this plan's PR. Lane Q also holds
`package.json` and `.github/workflows/ci.yml`, for the new tree's
commands and its CI step.

**The freeze, as ruled.** The [present tree](#def-present-tree) changes
only where its three jobs of §2 need it: a fix the bootstrap or the
comparison cannot work without, named as such in its PR and merged by
the maintainer. Work on code due for replacement stops: tidy-ups,
ratchet lowering, reviews of the present evaluator, and fixes of
defects the ruled decisions already remove. Chunk G2 classes every open
backlog item under the freeze. `docs/book/**` stays the review
session's.

## 5. Milestones and chunks

**The milestones.** Both streams aim at the same nine. Each is shown to
the maintainer by a runnable command and signed in §7.

| # | State | Needs |
|---|---|---|
| 1 | The kernel evaluates expressions built through its interface | kernel stream |
| 2 | The launcher runs a saved program that prints through a capability | both |
| 3 | Programs in the first notation run: functions, recursion, claims. One speed test of a typed extension and one of a toy parser engine written in Allegro | both |
| 4 | The typed part of the corpus passes | both |
| 5 | Rung 1 passes: refinements, contracts, proofs, the proposer loop | both |
| 6 | Rung 2 passes: grammar extension and units of measure | both |
| 7 | Rungs 3 and 4 pass: planning and the loop over a plan | both |
| 8 | The parser engine written in Allegro replaces the bootstrap parser | kernel stream |
| 9 | The present tree is deleted | both |

**This plan's chunks.**

| Chunk | Deliverable | Gate |
|---|---|---|
| G1 | This plan, the acceptance stream's plan, the lanes, the backlog items, the planning-loop stream closed | the maintainer |
| G2 | **The backlog under the freeze.** Every open item of `docs/backlog.md` classed as dissolved by a ruled decision (named), kept as a corpus case, or still needed (with the stream that takes it) | the maintainer |

**The kernel stream, as agreed.** Its chunk list is its own plan's. What
the maintainer approved for it on 2026-11-13:

1. It builds in the new tree, chapter by chapter in the inventory's
   order.
2. It takes each decision one of three ways: the unit is carried over
   where the decision is settled, adapted where partly built, written
   where open.
3. Its first chunk is the kernel's interface file and the saved-program
   data form, since both streams build against them.
4. Part II follows, tested by host code calling the interface.
5. The evaluation chapter starts with the designs to prove. The
   recursion findings filed by the planning-loop stream are its cases.
6. Part IV follows as extensions written in the first notation, then
   Part III's parser engine in Allegro.

**The acceptance stream.** The eight chunks of
`docs/plans/rebuild-acceptance.md`.

## 6. Rulings

**Taken 2026-11-13**, by the maintainer to the orchestrating session.

- **The approach.** "I agree with the recommendations." The six: this
  stream writes specifications first; it builds the acceptance corpus;
  new pilot code is library-only probes; the rebuild has its own
  implementation order, in a tree beside the present one; the designs
  to prove are proved before their chapters are final; each merged
  ruling says what it changes for the other stream.
- **The split, the gate and the freeze.** "The split, gate and freeze
  are all approved as recommended." They are §1, §3 and §4.
- **Agents merge.** Asked whether merge on green means the agents merge
  non-gated PRs directly: "I'm comfortable with that." The maintainer
  set the `test` check in `main`'s branch protection and enabled
  auto-merge the same day.
- **The hold on pilots.** The instruction given in the book pass's
  review of Part V "was directed only at the book pass". It does not
  hold this program.

**Taken at this plan's PR.** Each default below was taken at the merge
of PR #197 on 2026-11-13, where the maintainer wrote "All defaults
accepted".

- **P1 — The new tree's root and directory names.** `next/` and the
  names of §4. Default: as written. A rename later is one commit per
  stream.
- **P2 — Lane Q.** A new lane for the acceptance stream, with the globs
  of §4. Default: as written.
- **P3 — The six terms of §1.** Default: ratified.
- **P4 — The planning-loop stream closes.** B-187 (the planning loop,
  the next validating demo) closes with its first part delivered; the
  software system model and the documentation model are carried to the
  acceptance stream's specifications. PR #194 closes unmerged; its
  measurements are kept. Default: as written.
- **P5 — A case's class is reviewed at its milestone.** The corpus's
  classification merges on green behind a check that every case has a
  class and every changed case names a ruled decision; a case with no
  ruling cited is one that must survive. The maintainer reviews the
  classes of a milestone's cases when that milestone is shown. Default:
  as written.

## 7. Record

- **2026-11-13 — planned.** Written on `origin/main` at `e399222`, after
  the orchestrating session's review of both streams and the
  maintainer's rulings of the day (§6). Phase 1 of the book pass had
  closed at PR #195 the same day. No code changed.
- **2026-11-13 — G2 drafted: the backlog classed under the freeze.**
  All 117 open items of `docs/backlog.md` carry a recommended class:
  49 dissolved by a named ruled decision, 6 corpus cases, 18 still
  needed in the kernel stream, 18 still needed in the acceptance
  stream, 6 still needed outside the rebuild, 13 stopped by the freeze,
  and 7 another session's, listed and not classed. No item is marked
  until the maintainer rules. The record is
  `docs/records/rebuild/backlog-under-the-freeze.md`.

## 8. How the two sessions meet

This section is self-contained.

**The repository is the only state the sessions share.** Neither reads
the other's conversation.

1. **Disjoint paths.** Each stream edits only its lane's paths of §4.
   The decision map is the one file both edit, each its own rows.
2. **Contracts change by their own PR.** The kernel's interface file,
   the saved-program data form and the first notation are the three
   contracts. A change to one is a PR of its own, merged by the
   maintainer. Each session merges `origin/main` before its next chunk
   after such a merge.
3. **Every PR body carries a part named "For the other stream".** It
   states what the PR changes for the other session: a contract, a
   decision's state, a corpus case's class, a need. "Nothing" is
   stated, not omitted.
4. **Each session reads the other's merges before starting a chunk**:
   `git log origin/main` since its last chunk, and the "For the other
   stream" part of each merged PR.
5. **Evidence against a ruled decision goes through one backlog item**,
   B-197 (evidence against a ruled decision). The stream that finds it
   appends a numbered line: the decision's title, what was run, what it
   showed. It then stops work that depends on the decision. The review
   session brings each line to the maintainer and records the ruling in
   the inventory. Only the review session checks a line off.
6. **The decision map is the status of the program.** A row's state is
   one of: none, carried, adapted, written, proved. A stream moves its
   own rows in the PR that earns the move. The orchestrating session's
   board reads the map.
7. **Status documents** follow the rule of `docs/backlog.md`,
   §"Status documents under streams": each session edits its own
   backlog items, lane row, manifest row and changelog section.
8. **Neither session edits the present tree** outside the freeze's
   exception of §4.
