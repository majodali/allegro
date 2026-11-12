---
type: stream-plan
status: active
backlog: B-174
lane: R
merge: human-gated
oracle:
  - npm run lint:docs:check
  - npm run lint:ir
  - npx tsx scripts/doc-ref-lint.ts
  - npm run lint:streams
  - npm test
chunks: [P0, P1, P1b, P2, F1, DR1, DR2, DR3, DR4, DR5, DR6, CH0, CH1, CH2, CH3, CH4, CH5, CH6, CH7, CH8, CH9, CH10, CH11, CH12, CH13, CH14, CH15, CH16, CH17, CH18, CH19, CH20, CH21, CH22, CH23, CH24, CH25, CH26, CH27, CH28, CH29, CH30, CH31, CH32, CH33]
reserves: [B-184, B-186]
boundary:
  - docs/book/**
  - docs/reading-order.json
  - docs/documentation-census.md
  - docs/records/book-pass/**
  - docs/plans/book-pass-briefs.md
  - docs/plans/book-pass.md
  - docs/plans/book-pass-inventory.md
  - scripts/doc-lint-baseline.json
---

# Every chapter of the book reviewed and edited IR first — the book pass

> **Status: active** — drafted 2026-11-03 by the orchestrating session
> (§8), at the maintainer's instruction of the same day. Ratified the
> same day by the merge of PR #154, which took every ruling of §6 as
> recommended. Two amendments were ruled after the merge (§6, "Rulings
> taken"). The status line and the header's `status` say the same
> thing.
>
> **Reader**: the review session (§1) that runs this stream, starting
> with no context, and the maintainer ruling on §6. Assumed known: the
> layers (`docs/book/layers.md`), the gate (`docs/book/process.md` §5),
> what a [stream](parallel-streams.md#def-stream) is, and the
> methodology's IR specification at the pinned version (its sections
> "Rendering and review", "Stranger rounds" and "Meta-review"). Not
> assumed: the conversation that produced this plan. §2 and §8 restate
> everything a session needs. Terms are defined in §1.

## 1. Outcome and terms

**Purpose (re-scoped 2026-11-03, by the rulings of §6 on the
re-scope).** The book was written by agents for agents. It works as
technical documentation, not as a book a person would read. The pass
now restructures, reviews and rewrites it, chapter by chapter, under
the organizing principles of §2.6. The aim is one book that a person
finds interesting and accessible, and that an agent finds well
structured and logical for implementation work. Designing Allegro is an
open journey, and the book invites readers along: to follow each
decision, and to try the alternatives in code organized to match.

**Outcome.** B-174 (the book's existing chapters retrofitted to IR), as
this stream widens it, is met when all of these hold:

- Every present chapter of `docs/reading-order.json` (34 of them, §2.2)
  has a merged [chapter review](#def-chapter-review) under
  `docs/records/book-pass/`, with its rulings taken.
- Every present chapter the stream may edit (§4) is edited IR first: its
  `<chapter>.ir.md` exists beside it and passes `npm run lint:ir`, with
  the designation its review took (R3) in the IR's header.
- Every move, rename, split, merge or reorder of a chapter, a section or
  a definition site has a row in `docs/book-changes.md`.
- Every term is defined before its first use in reading order, at one
  definition site with a `def-` anchor. `npm run lint:docs:check`
  reports anchors 0 and order 0, and ids at or below the baseline.
- The book follows the organizing principles of §2.6, as the preface
  states them (chunk P0 (the principles)), in the order the
  [decision inventory](#def-decision-inventory) gives
  (chunk P1 (the decision inventory)).
- Every chapter's [tidy-up](#def-tidy-up) findings are filed as numbered
  lines under B-182 (unit tidy-ups from the book pass), or the review
  states that it found none.

A reader can check the outcome from §7: one closing bullet per chunk,
and the lint lines of the closing entry.

**Terms.** Each is defined here because neither the methodology
vocabulary nor `docs/book/` defines it.

- <a id="def-chapter-review"></a>**Chapter review**: the record written
  before a chapter is edited. It states what the chapter claims against
  the code, what is wrong with its links and terms, and every
  restructuring as a ruling with a recommendation. Its form is part (a)
  of `docs/plans/book-pass-briefs.md`.
- <a id="def-review-session"></a>**Review session**: the Claude Code
  session that runs this stream, in which the maintainer discusses each
  chapter.
- <a id="def-orchestrating-session"></a>**Orchestrating session**: the
  Claude Code session that runs the implementation streams, the leading
  edge of the language toward the next validating demo (stream D (the
  partial-evaluation rules) was the first), and keeps the maintainer's
  status board. Since amendment M3 (§6) it runs no tidy-up stream.
- <a id="def-tidy-up"></a>**Tidy-up**: a change to one unit's files that
  changes no behaviour: a move, a rename, a comment pointer to the
  chapter, or dead code removed. Its oracle is in §2.3.
- <a id="def-hand-off-item"></a>**Hand-off item**: B-182 (unit tidy-ups
  from the book pass), the one backlog item through which a chapter
  review passes tidy-up findings to the tidy-up stream. Since amendment
  M3 (§6) the review session runs both, and the item is the hand-off
  between its chapter chunks and its tidy-up chunks.
- <a id="def-waiting-chunk"></a>**Waiting chunk**: a chunk whose files,
  or part of them, another active stream's boundary holds. It does not
  start, or its edit does not start, until that stream releases them
  (§2.4).
- <a id="def-decision-section"></a>**Decision section**: a section of
  the book that presents one decision, or a few tightly related ones:
  the problem, the forces, the options, the decision and its rationale,
  the consequences, the decision as implemented, and how to explore an
  alternative (§2.6, principle 2).
- <a id="def-decision-inventory"></a>**Decision inventory**: the list of
  every design and implementation decision of the project, each with a
  short name, the decisions it depends on and a significance rank. The
  book's table of contents is derived from it.
- <a id="def-swappable"></a>**Swappable or foundational**: whether
  trying another option for a decision replaces one unit behind its
  interface (swappable), or cascades through the decisions that depend
  on it (foundational).
- <a id="def-curious-programmer"></a>**Curious programmer**: the book's
  human reader. A working programmer, curious about language design,
  who has never seen the repository. The prose is written for this
  reader; the IR is written for agents.

All four were ratified by the maintainer on 2026-11-03.

**Reserved ids.** The header reserves B-183 (first out-of-scope finding
of the book pass) and B-184 (second out-of-scope finding of the book
pass). The plan's PR files both as placeholder entries in
`docs/backlog.md`, so the header resolves under `npm run lint:streams`.
B-185 (third out-of-scope finding of the book pass) and B-186 (fourth
out-of-scope finding of the book pass) were reserved the same way on
2026-11-03, at the review session's request, once chunk F1 had used the
first two. B-182 is filed by the same PR as the hand-off item, at the maintainer's
instruction of 2026-11-03. It is not in this plan's `reserves`: the
tidy-up stream's plan will name it as its `backlog`, and the lane check
(`scripts/analyze/lane-lint.ts`) routes a PR to the plan whose header
claims its title's id. R2 rules who edits it.

## 2. Two streams, two sessions

This section is self-contained. A session that reads only §2 and §8
knows how the work is split and where it must not go.

### 2.1 What the maintainer asked for

The maintainer's words, 2026-11-03: "I'd like to work through the book
one chapter at a time, that work will likely result in some
restructuring. It's unlikely to result in notable functional changes,
but links, references, order may change. The work will be iterative and
thorough. After each chapter is done, we should then complete any tidy
up on affected units." And: "How do we move the per-chapter review to a
different Claude Code session and keep the follow on development
workstream in this session?" The design below answers both. The
maintainer accepted it the same day and asked for this plan.

### 2.2 What the book holds today

Measured on `origin/main` at `58fe38a`, 2026-11-03, read-only.

| Measure | Count |
|---|---|
| Entries of `docs/reading-order.json` with a `doc` key | 45 |
| Of those, appendices (registers and records) | 8 |
| Of those, planned chapters (`doc: null`) | 3: the kinds, scope, futures and the base primitives |
| Present chapters, Parts I to III: the chunks of §5 | 34 (Part I 11, Part II 21, Part III 2) |
| Present chapters with an IR beside them | 5: the evaluator (rendered), and the pipeline, tooling, host and demo-ladder chapters (IR-only) |
| Present chapters without an IR | 29 |
| Of those, Tier 0 (`vision.md`, `process.md`) or outside `docs/book/` (the root `README.md`) | 3 |
| `npm run lint:docs:check` | anchors 0 · order 0 · ids 785 |
| Bare first-use identifiers in the 34 chapters | 146, of which 49 in `allegretto/structures.md` and 30 in `concepts.md` |

### 2.3 The two streams

1. **The book pass** (this plan). Lane R (lane A until 2026-11-07), human-gated. It delivers
   B-174, widened from "every existing chapter gains its IR" to "one
   chapter at a time, in reading order, restructuring allowed, IR
   first". The [review session](#def-review-session) runs it. In its
   chapter chunks it edits documents only, the files of §4, and never
   `src/`.
2. **Unit tidy-ups from the book pass** (the tidy-up stream). The
   review session runs it too, since amendment M3 (§6), under the
   tidy-up stream's own plan, beside the
   [orchestrating session](#def-orchestrating-session)'s implementation
   streams, which hold precedence in the files their boundaries name
   (R1). One chunk per unit, opened by a
   chapter's findings. A chunk's boundary is exactly that unit's files
   in `scripts/analyze/units.json`; a mixed file is touched only in the
   unit's own part. The lane follows the file: lane D or lane K for the
   `src/*.ts` units, lane P for the `src/grammar2/` units, lane C for
   `src/index.ts`, `src/introspect.ts` and `src/pcp.ts`. The strict
   definition of a [tidy-up](#def-tidy-up) holds: no functional change.
   Its oracle is stream P's outputs-identical procedure: every
   `tests/*.alg` and `demos/**/*.alg` run through the CLI with `run` and
   with `inspect`, stdout, stderr and exit code identical before and
   after. Every `// expect:` pin and every totality verdict is
   unchanged, and every ratchet only falls. That stream gets its own
   plan later. This plan names it, reserves the hand-off, and files the
   item it reads from.

### 2.4 The hand-off and the sequencing rules

**The hand-off.** It goes through one backlog item, B-182. Each chapter's
edit PR appends that chapter's tidy-up findings to B-182 as numbered
lines: the unit, the file, what to change, and the chapter review as the
pointer. The review session reads B-182 when a chapter's edit merges
(amendment M3, §6). It opens a tidy-up chunk for the next unit whose
files no active stream of the orchestrating session holds, and checks
the line off when the chunk merges. Under the rule
of B-162 (conflict-free status documents), neither session edits the other's
backlog items, lane row, manifest row or changelog section. B-182 is
the one shared item, under R2.

**Sequencing.** These rules keep the two sessions off each other's
files:

- **U4, the evaluator chapter, waits until stream D closes.** That is
  `docs/book/allegretto/evaluator.md`, its IR and its review record.
  Stream D's chunks C3, C4 and C6 edit the IR under its ruling RR4 (how
  the evaluator chapter is kept true). Its next prose edit runs count 2
  of the stranger rounds, which is already owed. The review waits too,
  because the text under review is still moving.
- **F11, the spine, waits for stream D's C4 to merge before its edit.**
  `docs/book/concepts.md` is in stream D's boundary, and C4 restates PE
  Rule 1 in §25. F11's review may be written before then; its record
  states that §25 is not reviewed until C4 lands.
- **Everything else is free now**: no other active stream's boundary
  holds a file of §4.
- **A waiting chunk is passed over, not blocked on.** The review session
  takes the next chunk in reading order and returns to the
  [waiting chunk](#def-waiting-chunk) when its files are released. A
  term move that involves a waiting chapter waits with it.
- **`docs/book/units.md`.** A tidy-up that moves a unit corrects that
  unit's status cell in `units.md` in the same commit (`units.md` §7).
  The review session does not edit `units.md` while such a PR is open.
- **A chunk in a file a later stream holds waits.** If a stream starts
  in lane C, K or P with a boundary that holds a chapter, that chunk
  waits as U4 does.

### 2.5 The per-chapter shape

One chunk per chapter, in two PRs, both human-gated. The procedure is
stated once above the table in §5.

### 2.6 The organizing principles

Agreed with the maintainer on 2026-11-03 (the re-scope rulings of §6). Chunk P0 writes
them as the book's preface, "How this book is organized"; until it
merges, this list is their text.

1. **Decisions in order.** Every design and implementation decision
   appears with a discussion of its options and rationale. Dependency
   order binds: a decision comes after the decisions it builds on.
   Significance breaks ties: among decisions that do not depend on each
   other, the more significant comes first. Most decisions have their
   own section. Tightly related decisions may share one.
2. **A default section shape.** A
   [decision section](#def-decision-section) has seven blocks: problem,
   forces, options, decision and rationale, consequences, as
   implemented, explore. The shape is a default, not a rule. A decision
   about the language's vision or aesthetics may need fewer blocks.
3. **Failures are rationale, not history.** An option's rationale may
   say how it fails. Evidence is an experiment written for the book and
   included in it. Nothing is drawn from the project's history, and no
   historical content enters the book.
4. **A forward-pointing tour opens the book.** It tells the big bets as
   a story and points to their full treatment. The rest of the book then
   descends in dependency order.
5. **Swappability is marked.** Each decision says whether it is
   [swappable or foundational](#def-swappable), so a reader who branches
   the code knows what an alternative costs.
6. **Open decisions are invitations.** An open decision has a
   consistent form and says how a reader can contribute an alternative.
7. **Two readers, two forms.** The IR serves agents: claims, evidence,
   pointers to the code. The prose serves the
   [curious programmer](#def-curious-programmer). It keeps every IR
   claim.
8. **Engaging, clear, succinct.** Writing the prose from the IR also
   helps break the phrasing patterns agents fall into. Many of those
   patterns reduce clarity. The review checks for them, and the briefs
   carry the list. The list starts with these, and grows as the pass
   meets others:
   - **Uninformative headings.** A document or section heading names
     the section's shape, not its content: "The problem, measured", "The
     design question this plan exists to settle". A heading uses the
     section's own terms and says what the section holds: "Deviations
     from the partial-evaluation rules".
   - **Burying the lede.** Information not presented in order of
     significance. The most significant point comes first, in the
     document, in each section and in each paragraph.
   - **Contrast framing**: "not X, but Y" where a plain statement of Y
     would do.
   - **Groups of three** added for rhythm, not content.
   - **Em-dash chains** joining clauses a reader would judge separately.
   - **Signposting**: "this section explains", "as we will see".
   - **Closing restatements** of what a paragraph or section just said.
   - **Intensifiers**: "key", "crucial", "load-bearing", "critically".
   - **Bold labels** on every line or list item.
   - **Abstract nouns** where a verb would do.
   - **Paired-clause titles**: a title of the form "A, and B" or "A,
     not B". More generally, any form repeated across titles or
     sentences (added 2026-11-11, on DR1). Existing instances among the
     decision titles are corrected in the later style pass, not now.
9. **Process detail moves out.** How the project is worked on (process,
   lanes, measurement, file maps, studies) leaves the book's narrative.
10. **A concept is defined where it is first used or decided.**
11. **No ids in the text.** The prose carries no backlog, decision or
    ruling ids. Decisions and chapters have short, clear names. Ids live
    in the IR and in the registers.
12. **The code matches the book.** A decision lives in one unit where it
    can, so a reader can branch the code and try another design.

### 2.7 The monotonic pass: how a decision is taken

Proposed at the PR of chunk P1b (the decision types), under R28 (the monotonic pass), R29
(capability and implementation decisions) and R30 (who makes a
decision's code changes); accepted by the maintainer on PR #164,
2026-11-06 (R31 in §6). The lane of item 3 is B-186 (a lane for the
monotonic pass), landed 2026-11-07 as lane R; before it landed, §3, §4 and §8 read as written, and a
chapter whose decisions change code waits for it.

1. **One PR per chapter of the inventory's contents, in phase 2 (§2.8,
   ruling R37 (two phases)).** Its decisions, ruled in phase 1, are
   taken in inventory order. The PR opens with the chapter review (the
   decisions as they stand, against the code; the changes proposed, each
   a ruling). The maintainer rules each decision in PR comments. The PR
   then carries, per decision in order: the decision's text in the
   chapter's IR and prose, and its code and test changes. A decision
   whose code change is large gets a PR of its own, in the same order.
   A chapter is approved, and final under R28, when its PR merges.
2. **Code changes are a decision's own.** A change implements the
   decision as ruled and nothing else. A change that a later decision
   needs waits for that decision. A finding about an earlier, approved
   decision is a non-monotonicity: the pass stops, reports it, and goes
   back as R28 says.
3. **The lane.** Lane A holds no code, and the lane check
   (`scripts/analyze/lane-lint.ts`) accepts one lane per PR, narrowed by
   the plan's `boundary`. Options: (a) a new lane for this pass whose
   globs cover the book's files and the code (`src/**`, `lib/**`,
   `tests/**`, `demos/**`), with this plan's `boundary` widened per
   chapter to that chapter's documents and unit files, as B-104 (retire
   the dunder convention) widens its boundary per chunk; (b) lane A's
   globs widened to the code; (c) two PRs per decision, documents in
   lane A and code in the code's lane under a companion plan.
   Recommended: (a). (b) makes lane A overlap every lane; (c) splits a
   decision from its code, which R28 forbids. The lane is a lane-S
   change to `scripts/analyze/lanes.json` and the lane table, made by
   the orchestrating session.
4. **Coordination.** A chapter's PR touches only files no other active
   stream holds (stop condition 5 of §3). A chapter whose files another
   stream holds waits, as a waiting chunk does. The orchestrating
   session's streams in the same files wait for the chapter's PR in
   turn; the lane table states the rule.
5. **The oracle widens** with the code: `bash scripts/typecheck.sh`,
   the full suite (`npm run test:shards`), `npm run lint:planes`,
   `npm run lint:units` and `npm run lint:load`, beside the doc lints.
   Every `// expect:` pin moves only by a decision that changes it,
   named in the PR. Ratchet baselines fall only in their own commit
   (B-164 (ratchet baselines under concurrent merges)).
6. **Tidy-ups.** B-182 (unit tidy-ups from the book pass) stays for
   changes no decision needs; a decision's own code change never goes
   there.

### 2.8 The two phases

Ruled 2026-11-10 (R37 (two phases), §6). The pass runs in two phases so
that every decision is sanity-checked before any chapter content is
written.

1. **Phase 1, the decision review.** Every decision of the inventory, in
   its order, by part: one PR per part of the contents (six PRs, a part
   split across two or three PRs where its review would run past about
   12,000 words). Each review rules every decision of its part under R34
   (recommend the right decision): the decision as stated; its type,
   label and dependencies; whether the code does it, checked against the
   code with a pointer; keep, restate, split, merge, move or remove,
   with options; and the code and test changes the ruling needs, named
   but not made. No IR and no prose. The maintainer rules each decision
   in PR comments; the ruled decision is recorded in
   `docs/plans/book-pass-inventory.md`, which becomes the ruled list.
   The brief is part (e) of `docs/plans/book-pass-briefs.md`.
2. **Phase 2, the content.** Chapter by chapter, in order: the IR, the
   prose, and the code changes the phase-1 rulings named, under §2.7. A
   chapter is final when its PR merges.
3. **What approval means under R28 (the monotonic pass).** A phase-1
   ruling settles a decision; the decision with its code becomes final
   in phase 2. A phase-2 finding that a ruled decision is wrong is the
   non-monotonic failure R28 names: the pass goes back to phase 1 for
   that decision and every decision after it that rests on it. A code
   fix that cannot wait for phase 2 goes to the maintainer as an ask,
   as a held finding does (R36 (held findings)).
4. **The code is checked, not changed, in phase 1.** The pilot's review
   found its two defects by testing the code against each decision.
   Each phase-1 review does the same, so a decision's code is known
   when it is ruled.

The pilot (P2 (the pilot chapter)) stands as a phase-2 dry run of
chapter 7; chapter 7 is reviewed again in phase 1 under R34, in its
part.

## 3. Oracle and stop conditions

**What decides a chunk.** Each command in the header, run on the branch
after it is up to date with `origin/main`:

| Command | Must report |
|---|---|
| `npm run lint:docs:check` | "gate passed": anchors 0; order 0; ids at or below `scripts/doc-lint-baseline.json` (785 at this plan's measurement). The ids check skips `*.ir.md` and `*.review.md` |
| `npm run lint:ir` | "clean" over every `*.ir.md`; the count of unratified terms it prints is recorded in §7 per chunk |
| `npx tsx scripts/doc-ref-lint.ts` | "all markdown doc references resolve" |
| `npm run lint:streams` | every stream plan's header well-formed, this plan's included |
| `npm test` | green: the suite runs the same doc, IR, stream and lane checks, and every pinned demo that a chapter quotes |
| lane check, `PR_TITLE="B-174: <title>" npx tsx scripts/analyze/lane-lint.ts --base origin/main` | lane R, 0 files outside |

**Pins that must not move.** Every `// expect:` line: the stream edits
no demo. The ids baseline may only fall. A fall is recorded in §7 and
the baseline is lowered in its own commit, after the branch is up to
date, under the B-164 (ratchet baselines under concurrent merges) rule.
The baseline file, `scripts/doc-lint-baseline.json`, is in this plan's
boundary for that commit alone (amendment M1 of §6).

**What no tool checks.** That a pinned example is a verbatim excerpt of
its source; that a review's claims about the code are true. The
maintainer reads the chapter and its review together. This is why the
stream is human-gated.

**Stop conditions.** The four of `docs/book/process.md` §3: a failed
check, a scope change, a chunk needing a decision, a chunk whose summary
carries asks. Every chunk stops at its PRs in any case. The stream adds
five:

1. **A chapter that needs a code change stops that change.** The need is
   filed: under B-182 if it is a tidy-up (§1), under B-183 to B-186 if it
   changes behaviour or lies outside every unit. The chapter then says
   what the code does today. A corrected source comment is a tidy-up.
2. **A Tier-0 edit stops.** `docs/book/vision.md` and
   `docs/book/process.md` change only with the maintainer's sign-off, in
   a dedicated PR (`docs/book/process.md` §2). R9 rules what this stream
   does with them.
3. **A term move that would create a forward reference stops** for a
   ruling. That covers a move the order lint cannot see: a definition
   site moved out of a chapter whose earlier chapters link it by a
   pointer.
4. **A chapter move that breaks a reader outside the boundary stops.**
   `pcp/llm-worker.ts` loads `docs/book/proving-in-allegro.md` by path.
   Code comments in `src/` and `scripts/` cite chapters by path. A move
   keeps a stub at the old path, as D52 (the documentation book) moves
   did, and the comment pointers go to B-182. A moved file that code
   reads by path does not move.
5. **Never edit a file inside the other stream's boundary.** This binds
   both sessions. Stream D's boundary is the header of
   `docs/plans/pe-rules.md`; the tidy-up stream's will be its plan's
   header.

## 4. File boundary

**Lane R (the book pass)**, since 2026-11-07 (lane A before), narrowed by the header's `boundary`, which a chapter's PR widens to the files its decisions change (§2.7):

- `docs/book/**`: the chapters, their IRs and their review records.
- `docs/reading-order.json`, `docs/documentation-census.md`.
- `docs/records/book-pass/**`: the chapter reviews.
- `docs/plans/book-pass-briefs.md`: the stream's working briefs.
- `docs/plans/book-pass-inventory.md`: the decision inventory, chunk
  P1 (the decision inventory).
- This plan.
- `scripts/doc-lint-baseline.json`, the ids baseline, in a lowering
  commit only (§3; amendment M1 of §6). Lane R's manifest entry holds
  it; no other file under `scripts/` is in the boundary.
- The status documents under B-162, which every lane edits: this
  stream's section of `docs/CHANGELOG.md`; in `docs/backlog.md` B-174,
  B-183 to B-186, lane R's row, and B-182 as R2 rules; this plan's row of
  `docs/plans/README.md`; rows of `docs/book-changes.md`.

Lane R's globs in `scripts/analyze/lanes.json` hold every file above,
and the code (`src/**`, `lib/**`, `tests/**`, `demos/**`) for a
chapter's decisions under §2.7. Lane A held
`docs/records/book-pass/**` and `docs/plans/book-pass-briefs.md` since
PR #153 (B-163 (the lane manifest and its check)), merged 2026-11-03 as
R8 asked.

**Outside the boundary, on purpose.** A chunk that needs one of these
stops:

- `src/**`, `lib/**`, `tests/**`, `demos/**`, `bench/**`, `scripts/**`
  (except the ids baseline, as above),
  `pcp/**`, `web/**`, `website/**`: code, demos and tools.
- The root `README.md`: no lane A glob holds it (R9).
- The Tier-0 chapters `docs/book/vision.md` and `docs/book/process.md`
  (R9).
- Until stream D closes (`docs/plans/pe-rules.md` reads `status:
  closed`): `docs/book/allegretto/evaluator.md`, `evaluator.ir.md`,
  `evaluator.review.md`, all three under `docs/book/allegretto/`. Until
  stream D's C4 merges: `docs/book/concepts.md`.
- Every other plan, `docs/decisions.md` and `docs/classification.md`,
  except through a ruling the maintainer takes.

## 5. Chunk sequence

**The re-scoped front (the re-scope rulings of §6).** Three chunks come before any
further chapter, each one PR, human-gated:

- **P0 (the principles).** The preface "How this book is organized",
  written IR first from §2.6, the first chapter of the reading order.
- **P1 (the decision inventory).** Every decision of the project, from
  `docs/decisions.md`, the plans' rulings, the spine's entries and the
  chapters, each with a short name, its dependencies, a significance
  rank and its swappability. P1 proposes the book's new table of
  contents from it, chapter names included. It must give any chapter
  the context it needs.
- **P1b (the decision types).** Each inventory entry gains its type,
  capability or implementation (R29), and every dependency is checked
  against the rule that no capability decision depends on an
  implementation decision. Cycles and mutual capability dependencies
  are resolved by restating, as R29 says. The chunk also proposes how
  R28's per-decision code changes are made.
- **P2 (the pilot chapter).** One chapter rewritten to the principles,
  `docs/book/allegretto/metadata-and-capability.md` unless P1's table of
  contents proposes another. The maintainer's reading is its test. The
  briefs of `docs/plans/book-pass-briefs.md` are revised from it: the
  review template gains the inventory's decisions and a phrasing-pattern
  check, and the stranger brief a pattern finding kind. The chunk sequence
  below and the cost per chapter are reset from P2.

F1's review stands: its findings are factual. The tables below list the
present chapters, the work the pass must cover. Their order and their
chunk ids are superseded by P1's table of contents when it merges.

**The two phases (§2.8, R37 (two phases)).** After the front, the chunks
are:

| Chunk | Phase | Covers | Deliverable |
|---|---|---|---|
| DR1 (the decision review, Part I) | 1 | Part I, The bet: chapters 1 to 3 | the part's decisions ruled; the inventory updated |
| DR2 (the decision review, Part II) | 1 | Part II, Allegretto, the kernel: chapters 4 to 12 | as DR1; likely two or three PRs |
| DR3 (the decision review, Part III) | 1 | Part III, Syntax and modules: chapters 13 to 15 | as DR1 |
| DR4 (the decision review, Part IV) | 1 | Part IV, Allegro Standard: chapters 16 to 25 | as DR1; likely two or three PRs |
| DR5 (the decision review, Part V) | 1 | Part V, Domains built on the kernel: chapters 26 to 29 | as DR1 |
| DR6 (the decision review, Part VI) | 1 | Part VI, Building and running programs: chapters 30 to 33 | as DR1 |
| CH0 (the tour) | 2 | Ten choices that define Allegro | the tour, after phase 1, from the ruled decisions and the maintainer's motivations |
| CH1 to CH33 (the chapters) | 2 | each chapter of the contents, in order | IR, prose and code changes under §2.7 |

The oracle of a phase-1 chunk is the doc lints of §3 and the lane
check; a phase-2 chunk adds the code oracle of §2.7 item 5. The
per-chapter procedure below and the F, U and T tables are superseded by
these chunks, and are kept as the record of the pass's first shape.

**The per-chapter procedure.** Each chunk is one chapter, in two PRs,
both human-gated and titled `B-174: …`.

1. **The chapter review, before any edit (PR 1).** A record at
   `docs/records/book-pass/<chapter-slug>.md`, in the template of part
   (a) of `docs/plans/book-pass-briefs.md`: reader RD-2, the four parts
   of W-008 (reports map their deliverables), about 600 to 1,200 words.
   It states what the chapter claims against the code and its unit, with
   pointers; the links and references that are wrong, forward or
   missing; the terms whose definition site should move, under the D52
   rule (a term is defined only from earlier chapters, one definition
   site per term, a `def-` anchor, a `book-changes.md` row for every
   move); the chapter's designation (R3), whether it is rendered (R4)
   and whether a count runs (R5); every restructuring option as a ruling
   with a recommendation, numbered `R-<chunk>-<n>`; and the tidy-ups
   found. The PR's asks are the rulings. The maintainer reads the
   chapter and the review together and rules by number. "Defaults"
   takes every recommendation. One commit before the merge records the
   rulings taken in the record; it is not edited after the merge.
2. **The IR (PR 2).** The reasoning role updates the chapter's IR as
   the rulings say. A chapter with no IR gets one first, written from
   the prose and the code. Claims about the code as implemented carry
   `[proposed: this IR]` with evidence; they are ratified in bulk at the
   PR's merge, and one commit flips them to decided before the merge.
3. **The prose (PR 2).** For a rendered chapter, the reasoning role
   renders or edits the prose from the IR and appends the render map.
   Then a stranger-round count runs if the review decided one (R5),
   recorded in `<chapter>.review.md` beside the chapter, with the
   count-2 briefs of parts (b) and (c) of the briefs file. An IR-only
   chapter is rendered only if the review rules so (R4).
4. **The status documents (PR 2).** `docs/book-changes.md` rows for every
   move, rename or reorder; `docs/reading-order.json` and
   `docs/book/README.md`; the census row; an entry under this stream's
   changelog section; this plan's §7 bullet. The oracle of §3.
5. **The hand-off (PR 2).** The chapter's tidy-up findings, appended as
   numbered lines under B-182. The chunk is done when PR 2 merges.

A chunk whose review finds nothing to restructure and only editorial
fixes (R7) may land steps 1 to 5 in one PR, with its asks still the
review's rulings.

The record's slug is the chunk id in lower case, a hyphen, and the
chapter's path under `docs/book/` with `/` written as `-` and the
`.md` or `.ir.md` dropped; the root `README.md` is `f1-readme`. The
"Unit(s)" column gives the entry's `units` key where it has one; the
review names the units of the others. "Ids" is the bare first-use
identifier count of §2.2.

### Part I: foundations

| Chunk | Order | Chapter | Unit(s) | Record | Deliverable | Oracle |
|---|---|---|---|---|---|---|
| F1 | I.1 | `README.md` (root, *lookahead*) | — | `f1-readme.md` | review only; edits are asks (R9) | §3, PR 1 only |
| F2 | I.2 | `getting-started.md` (*lookahead*) | — | `f2-getting-started.md` | review, then edit | §3 |
| F3 | I.3 | `language-reference.md` (*lookahead*) | — | `f3-language-reference.md` | review, then edit | §3 |
| F4 | I.4 | `vision.md` (Tier 0) | — | `f4-vision.md` | review only; edits and IR are asks (R9) | §3, PR 1 only |
| F5 | I.5 | `process.md` (Tier 0) | — | `f5-process.md` | review only; edits and IR are asks (R9) | §3, PR 1 only |
| F6 | I.6 | `architecture-vocabulary.md` (*lookahead*) | — | `f6-architecture-vocabulary.md` | review, then edit | §3 |
| F7 | I.7 | `layers.md` | — | `f7-layers.md` | review, then edit | §3 |
| F8 | I.8 | `units.md` | — | `f8-units.md` | review, then edit; not while a tidy-up PR edits it (§2.4) | §3 |
| F9 | I.9 | `implementation-map.md` | — | `f9-implementation-map.md` | review, then edit | §3 |
| F10 | I.10 | `actors-and-activities.md` (study) | — | `f10-actors-and-activities.md` | review, then edit | §3 |
| F11 | I.11 | `concepts.md` (the spine) | — | `f11-concepts.md` | review, then edit; **the edit waits for stream D's C4**, §25 reviewed after it (§2.4) | §3 |

### Part II: the units, in dependency order

| Chunk | Order | Chapter | Unit(s) | Record | Deliverable | Oracle |
|---|---|---|---|---|---|---|
| U1 | II.1 | `allegretto/README.md` | — | `u1-allegretto-readme.md` | review, then edit | §3 |
| U2 | II.2 | `allegretto/structures.md` | — | `u2-allegretto-structures.md` | review, then edit (ids 49, the largest count) | §3 |
| U3 | II.4 | `allegretto/metadata-and-capability.md` | metadata, capability | `u3-allegretto-metadata-and-capability.md` | review, then edit | §3 |
| U4 | II.6 | `allegretto/evaluator.md` (has an IR; normative) | evaluator | `u4-allegretto-evaluator.md` | **waits until stream D closes** (§2.4); review, then edit with count 2 | §3; count 2 to a readable verdict or the limit |
| U5 | II.7 | `extension/README.md` | — | `u5-extension-readme.md` | review, then edit | §3 |
| U6 | II.8 | `grammar-formalism.md` | — | `u6-grammar-formalism.md` | review, then edit | §3 |
| U7 | II.9 | `extension/grammar.md` | — | `u7-extension-grammar.md` | review, then edit | §3 |
| U8 | II.10 | `extension/modules.md` | — | `u8-extension-modules.md` | review, then edit | §3 |
| U9 | II.11 | `standard/README.md` | — | `u9-standard-readme.md` | review, then edit | §3 |
| U10 | II.12 | `standard/type-system.md` | — | `u10-standard-type-system.md` | review, then edit | §3 |
| U11 | II.13 | `standard/core-types.md` | — | `u11-standard-core-types.md` | review, then edit | §3 |
| U12 | II.14 | `standard/effects.md` | — | `u12-standard-effects.md` | review, then edit | §3 |
| U13 | II.15 | `standard/pattern-matching.md` | — | `u13-standard-pattern-matching.md` | review, then edit | §3 |
| U14 | II.16 | `standard/totality.md` | — | `u14-standard-totality.md` | review, then edit | §3 |
| U15 | II.17 | `standard/contracts.md` | — | `u15-standard-contracts.md` | review, then edit | §3 |
| U16 | II.18 | `vivace/README.md` | — | `u16-vivace-readme.md` | review, then edit | §3 |
| U17 | II.19 | `vivace/planning-dsl.md` | — | `u17-vivace-planning-dsl.md` | review, then edit | §3 |
| U18 | II.20 | `platform/README.md` | — | `u18-platform-readme.md` | review, then edit | §3 |
| U19 | II.21 | `platform/build-pipeline.ir.md` (IR-only) | pipeline | `u19-platform-build-pipeline.md` | review, then IR edit; rendering per R4 | §3 |
| U20 | II.22 | `platform/tooling.ir.md` (IR-only) | introspect, cli | `u20-platform-tooling.md` | review, then IR edit; rendering per R4 | §3 |
| U21 | II.23 | `platform/host.ir.md` (IR-only) | — | `u21-platform-host.md` | review, then IR edit; rendering per R4 | §3 |

### Part III: the thesis test

| Chunk | Order | Chapter | Unit(s) | Record | Deliverable | Oracle |
|---|---|---|---|---|---|---|
| T1 | III.1 | `proving-in-allegro.md` | — | `t1-proving-in-allegro.md` | review, then edit; the path stays, since `pcp/llm-worker.ts` loads it (§3, stop 4) | §3 |
| T2 | III.2 | `demo-ladder.ir.md` (IR-only) | — | `t2-demo-ladder.md` | review, then IR edit; rendering per R4 | §3; every quoted demo line still in a scene the suite runs |

The three planned entries (the kinds, scope, futures and the base
primitives) are not chunks: their gates have not passed. A planned
entry whose gate passes during the stream is a scope change, put to the
maintainer as an ask.

Reserves: B-183 to B-186, for findings that are not tidy-ups: a
behaviour the chapter states that the code does not have, or a defect in
a file no unit holds.

## 6. Rulings

Each ruling was put to the maintainer at this plan's PR. The merge with
"defaults" takes every recommendation.

**Rulings taken.** The maintainer merged PR #154 on 2026-11-03 with no
ruling comment. The merge took the defaults: R1 to R9 as recommended,
and the six terms of §1 ratified. The maintainer then ruled two
amendments the same day, in the review session, both as recommended:

- **M1 — The ids baseline is in the boundary.** Lane A's manifest entry
  holds `scripts/doc-lint-baseline.json`, and §3 has the stream lower
  it. The header's `boundary` did not list it, so the lane check would
  have refused the lowering commit. The header now lists it, for that
  commit only. The option not taken: the orchestrating session makes
  every lowering.
- **M2 — R8 restated as decided in effect.** PR #153 widened lane A as
  R8's option (a) asked, before the plan merged. What R8 left open is
  how the reviews are listed. Each merged review gets one appendix row
  in `docs/reading-order.json`. One index record, option (c), is the
  fallback if the rows crowd the appendix.
- **M3 — The review session runs the tidy-up stream.** Ruled by the
  maintainer on 2026-11-06, in the orchestrating session: the book pass
  will take a while and leads to no new functionality, so the
  orchestrating session moves the leading edge of the language forward
  toward the next validating demo, and the review session performs the
  tidy-ups on the book and on already implemented code. The tidy-up
  stream keeps its own plan (§2.3), lane by file, with the strict
  definition of a tidy-up and the outputs-identical oracle; the review
  session drafts that plan when B-182 first carries lines, and runs its
  chunks beside its chapter chunks. R1 holds with the roles reversed:
  a tidy-up chunk runs only in files disjoint from every active
  implementation stream's boundary, and the lane check refuses the
  overlap. R2 holds unchanged: a chapter chunk appends B-182 lines and a
  tidy-up chunk checks them off, now in one session. The orchestrating
  session no longer reads B-182 at its check-ins; §8 records the roles.

**R1 — Tidy-ups beside stream D.** Lane D is internally serial (the lane
table in `docs/backlog.md`, "Internally serial, permanently"). The
tidy-up stream would run a chunk in lane D while stream D is active.
Proposed rule: a tidy-up chunk may run concurrently with stream D only
when its files are disjoint from stream D's boundary (the header of
`docs/plans/pe-rules.md`: `src/evaluator.ts`, `src/primitives.ts`,
`src/test/evaluator.ts`, `src/test/index.ts`, `tests/**`,
`docs/book/concepts.md`, the evaluator chapter and its IR, and the plan).
Lane K's streams are ratchet work, and the same rule applies there.
Options:

- (a) A ruling of this plan, carried into the Concurrency cells of lane
  D's and lane K's rows by the tidy-up stream's plan PR. The
  orchestrating session runs both stream D and the tidy-up stream, so
  one session owns lane D's row.
- (b) A deviation in the deviation register of `docs/classification.md`,
  as D-3 (tidy-ups beside an active lane-D stream).

**Recommended: (a).** The register records departures from the pinned
methodology's rules: each entry cites the rule it overrides (D-2
(merge-on-green streams) cites W-006 (the PR waits for owner review)),
as the methodology's precedence rule asks. "Lane D is internally serial"
is the project's own lane rule, not a methodology rule, so a D-3 would
cite nothing. The disjointness condition is the same as condition 3 of
D-2, which already governs concurrent lanes.

**R2 — Who edits B-182.** Under B-162 a stream edits only its own
backlog items. Options:

- (a) B-182 is jointly owned. The book pass appends numbered lines; the
  tidy-up stream checks them off, and rewrites a line only to record its
  outcome. Neither session edits a line the other wrote, except to check
  it off. Both plans state the rule; B-182's entry states it too.
- (b) B-182 belongs to the tidy-up stream. The book pass's appends are
  the one sanctioned exception to "a stream edits only its own items".

**Recommended: (a).** It states the rule as ownership rather than an
exception, so a later session reading B-162 finds no exception to
remember. Appending and checking off touch different lines, so the two
sessions never conflict on the same text.

**R3 — The designation of a chapter that has no IR.** B-174 says the
owner's designation per chapter (normative and rendered, or IR-only) is
"taken in that stream's plan". The methodology's vocabulary says
normative text is never IR-only. The book's chapters are Tier 1
"durable design truth" (`docs/book/process.md` §1), and readers read
their prose today. Options:

- (a) Default normative-and-rendered for every chapter that has prose:
  `Normative: yes`, the reasoning role renders the prose from the IR.
  A review may propose another designation for its chapter as a ruling.
  The four IR-only chapters keep their designation unless R4 renders
  them.
- (b) Default IR-only for the Part II unit chapters, with their prose
  kept as the reading-order `doc` until a later rendering.
- (c) No default: each review proposes the designation.

**Recommended: (a).** IR-only would leave a chapter's prose with no
IR that governs it, or remove the prose readers use. A study
(`actors-and-activities.md`) or an introduction may not bind; its review
may then propose a non-normative IR, which the methodology's paraphraser
renders. B-174's text is amended at ratification to say the plan sets
the default and the review takes the exception.

**R4 — Whether the four IR-only chapters are rendered in this pass.**
The pipeline, tooling, host and demo-ladder chapters were delivered
IR-only, to be rendered "at a later stage". Options:

- (a) Decided per chapter in its review, with a recommendation.
- (b) All four rendered in this pass.
- (c) None rendered; their reviews edit the IR only.

**Recommended: (a).** The cost differs by chapter: each IR is 5,300 to
7,000 words, and a rendered chapter carries a count. The review is
where the cost and the reader's need are both in view.

**R5 — When a stranger-round count runs.** A count is several stranger
rounds per chapter, a fresh stranger instance each (the maintainer's
designation in `docs/classification.md`), plus the maintainer's reading.
Options:

- (a) Decided per chapter in its review, with a recommendation. An edit
  that is editorial only (links, references, anchors, typos, the
  methodology's *editorial change*) skips the count, and the review
  record says so. A chapter whose prose is rendered or rewritten from
  its IR gets a count.
- (b) A count for every rendered chapter.
- (c) No counts in this pass; every count deferred.

**Recommended: (a).** It spends rounds where the words change. U4's
count 2 is owed under stream A's meta-review whatever this ruling says.

**R6 — The order.** Options:

- (a) Reading order, Part I first, a waiting chunk passed over (§2.4).
- (b) Part II's unit chapters first, since the tidy-ups come from them,
  then Part I and Part III.

**Recommended: (a).** A definition-site move is easiest to check when
the chapters before it are already settled. Part I holds the
foundations that later chapters link to. Under (b), a Part I review
could move a term that Part II's edits had just linked.

**R7 — What the review session may do without a ruling.**

- Without a ruling: fix a link, a reference, an anchor or a typo; name a
  bare identifier; add a `book-changes.md` row for an unambiguous move
  the maintainer already ruled. These are listed in the review under
  *What changed*.
- With a ruling: a reorder of chapters or sections; a definition-site
  move; a split or merge of chapters; a new term; any sentence that
  states a rule, a decision or a claim about the code.

Options: (a) as above; (b) every change needs a ruling.
**Recommended: (a).** The first list changes no claim. The second is
where the maintainer's judgment is the oracle.

**R8 — Where the chapter reviews and the briefs live.** The records
convention (`docs/book/process.md` §1) puts records under
`docs/records/`, "written once; never edited after the fact", listed as
appendices in `docs/reading-order.json`. Lane A's globs do not hold
`docs/records/` or `docs/plans/book-pass-briefs.md`, so the lane check
refuses both, this plan's PR included. Options:

- (a) Keep both paths. A one-file lane-S PR widens lane A in
  `scripts/analyze/lanes.json` by `docs/records/book-pass/**` and
  `docs/plans/book-pass-briefs.md`, titled under B-163 (the lane
  manifest and its check), as lane P was widened for the pipeline
  chapter. It merges before this plan's PR. Each review is listed as an
  appendix record of `docs/reading-order.json` at its merge.
- (b) Each review beside its chapter as `<chapter>.book-pass.md` under
  `docs/book/`, inside lane A today; the briefs folded into this plan
  as an appendix.
- (c) As (a), with one index record under `docs/records/book-pass/`
  listed as the appendix instead of each review.

**Recommended: (a).** A review is a record by the convention's own
definition. Keeping reviews apart from the chapters keeps `docs/book/`
to chapters, IRs and their review records. One appendix row per review
follows the convention as written; (c) is the fallback if 34 rows crowd
the appendix.

**R9 — The three chapters this stream may not edit.** The root
`README.md` is outside lane A; `vision.md` and `process.md` are Tier 0.
Options:

- (a) Review only. Their reviews (F1, F4, F5) land as PR 1. Each edit,
  and each IR, is an ask: for the Tier-0 chapters a dedicated PR with
  the maintainer's sign-off; for `README.md` a lane-S or maintainer PR.
- (b) Skip all three.

**Recommended: (a).** Later chapters link to them, and a term moved out
of a Tier-0 chapter needs its review. An IR beside a Tier-0 chapter
would govern Tier-0 text, so it waits for the same sign-off.

**Rulings taken 2026-11-03, the re-scope.** Discussed with the
maintainer in the review session after PR #154's merge.

- **R10 — The book is written for human readers too.** The purpose of
  §1 and the principles of §2.6, agreed as discussed. The section shape
  of principle 2 is adopted as a default, expected to loosen.
- **R11 — Pause and re-scope.** No chapter review after F1 until P0, P1
  and P2 land. Taken.
- **R12 — The principles are the book's preface.** Option not taken:
  a section of this plan only. Taken.
- **R13 — Failures are rationale, not history.** Taken as principle 3.
  No amendment of `docs/book/process.md` is needed: experiments are
  written for the book, and history stays out of it.
- **R14 — The human reader.** The
  [curious programmer](#def-curious-programmer) is the prose's reader.
  The maintainer's reading is the test of human readability; a stranger
  brief in the persona's voice may catch cheaper failures first. Taken.

**Rulings taken 2026-11-03, after PR #156.** The maintainer merged
PR #156 with every recommendation accepted, F1's rulings R-F1-1 to
R-F1-8 included. Two further rulings, the same day:

- **R15 — Where the decision inventory lives.** Options: (a) a working
  file under `docs/plans/`, beside the briefs; (b) an IR in the book,
  `decision-map.ir.md` under `docs/book/`. Taken: (a),
  `docs/plans/book-pass-inventory.md`. Project working material stays
  out of the book.
- **R16 — The phrasing patterns.** The list of principle 8 in §2.6: the
  maintainer's two structural patterns first, uninformative headings and
  burying the lede, then the sentence-level candidates. The list grows
  as the pass meets others.

**Rulings taken 2026-11-03, at the merge of PR #157.** The maintainer
took every recommendation of the preface's PR:

- **R17 — The preface's asks.** The IR's asks A1 to A6 as recommended:
  the proposed claims and the four terms ratified; a chapter rewritten
  to the organization carries `"organized": true` in
  `docs/reading-order.json` and a marker in the table of contents; an
  open decision takes the seven blocks with "the question still open"
  for "decision and rationale"; the preface points to the pilot chapter
  once it exists; the sentence on how the prose is written is cut.
- **R18 — The finding kinds of the human-reader brief.** *Jargon* and
  *lost thread* ratified.
- **R19 — Claims merged for flow.** Where a reader takes two claims as
  one idea, the reasoning role merges them in the IR before rendering.
  A standing rule of part (c) of `docs/plans/book-pass-briefs.md`.
- **R20 — Spare ids.** The maintainer or the orchestrating session picks
  the stream's next two spare backlog ids; the review session does not
  number them. Open until the numbers are given.

**Rulings taken 2026-11-04, after the merge of PR #161.** The
maintainer merged PR #161 and ruled its two open asks by message:

- **R21 — The preface's last two passages.** The tour leaves the preface
  until it is written (the IR's ask A9). The aim sentence reads "The
  prose aims to be clear, brief and engaging." (A8).
- **R22 — Structure and correctness first.** The maintainer's words: "At
  this stage we are making sure the logical structure of the book holds
  and the content is correct - we'll work on making it brief, clear and
  engaging later." Reading of it, put to the maintainer at chunk P1's
  PR: a chapter's review and edit check the order of its decisions, its
  definitions and links, and its claims against the code; the IR is
  still written first. Stranger-round counts for readability, ruling R5
  (when a stranger-round count runs), are deferred to a later pass that
  works on brevity, clarity and tone. The preface's count stays closed.
- **Practice.** Rulings are given in PR comments before a merge, so the
  rulings commit lands in the same PR.

**Rulings taken 2026-11-05, on PR #163.** The maintainer answered the
PR's six asks in a comment, and added two rules:

- **R23 — The contents and the tour.** The proposed contents have the
  right shape and are working placeholders. The tour becomes a
  significant conceptual journey: the shape of Allegro (a minimal
  kernel, extension, the type philosophy, maximal domains, and Allegro
  in use: execution, tooling, pipelines), with reasoning that
  establishes the kernel's requirements and features, prefiguring the
  later chapters. It likely concludes with the ten choices or similar
  ones. "The bet" is a placeholder, incomplete; more detail comes in
  discussion. The maintainer's motivations for Allegro, given in the
  review session the same day, are recorded in
  `docs/plans/book-pass-inventory.md` for the tour.
- **R24 — The pilot.** "Metadata and the capability to write it".
- **R25 — Chapters leaving the book.** As proposed. Units and layers are
  discussed early as architectural principles, in appendices.
- **R26 — R22 (structure and correctness first) read correctly.**
- **R27 — Conflicts between sources** are settled as the pass reaches
  each decision. Two rulings now: the parser algorithm stays swappable,
  except that ordered choice must not be required; and a new decision,
  that every language extension, grammar extensions and definitions
  included, is declarative, so definition order carries no meaning.
  The shipped ordered choice is an expedient, to be replaced by GLL or a
  similar algorithm. `eval_when` and PE Rule 2 need careful review; their
  decisions may change to make them coherent.
- **R28 — The monotonic pass.** Every decision is worked through in
  order and analysed. Any may change, be removed, or gain new
  neighbours, and the resulting code and test changes are made. Once a
  decision is approved and its code changes made, every decision up to
  it, and the code stemming from them, is final and correct. A point of
  non-monotonicity is a process failure: the pass goes back, reorders
  or revises, and repeats until the list is fully ordered and monotonic.
- **R29 — Capability and implementation decisions.** Each decision is
  about language capability or about implementation. No capability
  decision may depend on an implementation decision. Capability
  decisions that necessarily depend on each other are stated as one.

**What R28 changes in this plan.** The unit of work becomes a decision,
taken in inventory order, and a decision's code changes are part of
its approval.

**Ruling taken 2026-11-05, after PR #163's merge.**

- **R30 — Who makes a decision's code changes.** Options: (a) this
  stream, per decision, its boundary widened to the decision's files;
  (b) the orchestrating session, as a chunk through a hand-off item,
  the next decision waiting for its merge; (c) one session runs both.
  Taken: (a). The mechanics are proposed in §2.7 and put to the
  maintainer at chunk P1b's PR.

**Rulings taken 2026-11-06, on PR #164.**

- **R31 — The decision types and how a decision is taken.** The ten hard
  type calls stand as the classifier made them, except three put to
  review: "Scope leaves the value universe" (capability only if read-site
  forgery requires it, else the decision is reversed); "Effects describe
  computations, refinements describe data" (one decision or two; a
  decision or an observation); "One primer for human and machine
  provers" (what the primer is). The incompleteness and future-cell
  decisions merge. §2.7 is accepted.

**Rulings taken 2026-11-07, after PR #165 (amendment M3) merged.**

- **R32 — M3 reconciled with R30 and §2.7.** The maintainer took three
  recommendations and one option of their own:
  1. The review session edits code in a chapter chunk, for its
     decisions' own changes under §2.7 once B-186 lands, and in a
     tidy-up chunk for changes that alter no behaviour. §8 and lane A's
     row say so.
  2. The review session, not the orchestrating session, makes B-186's
     lane change, as a lane-S PR titled under B-163 (the lane manifest
     and its check), as PR #153 was.
  3. When a decision's change touches files an implementation stream of
     the orchestrating session holds, or code that stream's work rests
     on, the maintainer rules case by case (option (c); the options not
     taken: the pass waits; implementation plans name the decisions
     they rely on). The review session puts each such case to the
     maintainer as an ask in the chapter's PR before making the change.
  4. A chapter's tidy-ups ride in its PR, as separate commits each
     passing the outputs-identical oracle, when its decisions touch the
     same unit; otherwise they are tidy-up chunks under B-182.

**Rulings taken 2026-11-07, at and after the merge of PR #164.**

- **R33 — The ten type calls, and PR #166.** The maintainer's merge
  comment on PR #164: "After some clarifications on the previous
  questions, I now agree with all ten decision classifications. ...
  while the classifications are correct, all decisions will be reviewed
  in turn and some may be changed." So the three types put to review
  stand as classified; the review session's findings on them stay in
  the inventory's type check, for their chapters. On PR #166 (rung 3 on
  the site), the maintainer took the three recommendations: the twelve
  claims of `docs/book/platform/host.ir.md` that PR #166 left stale are
  re-stated as current state now, in their own PR; PR #166's code is
  adopted as merged; the web host's own module loader is accepted for
  now and recorded as a finding for the chapter on modules, the
  member-load path checked there.

**Rulings taken 2026-11-07, on PR #174 (the pilot's review).**

- **R34 — Recommend the right decision.** The maintainer took every
  default of the pilot's review, R-P2-1 (b), the dry run, among them,
  and added: "some of these decisions were based on reducing code and
  documentation changes, which works for the pilot, but will not work
  for the full decision reviews going forward." From chapter 1 on, a
  review recommends the option that makes each decision right for the
  language; the size of its code or document change is a stated cost,
  never the reason. Part (a) of `docs/plans/book-pass-briefs.md` states
  the rule. The pilot's rulings stand as taken for the dry run; when
  the pass reaches chapter 7 in order, its decisions are reviewed again
  under R34.

**Rulings taken 2026-11-08, on PR #174 (the pilot's dry run).**

- **R35 — The pilot's dry run, and two standing rules.** Every default:
  the IR's claims and terms ratified; the held section stands until
  chapters 8 and 10 are written; the chapter carries no *organized*
  marker until approved in order; the demo excerpt's elision stands for
  the dry run; the serialisation sentence's removal stands; the
  review's findings are for the maintainer or the orchestrating session
  to file, or for two more spare ids. Two rules follow for the full
  pass: (1) content a review sends to a chapter that does not yet exist
  stays in a held section of the chapter it leaves, with its definition
  sites, until that chapter is written; (2) the *organized* marker means
  approved in order under R28 (the monotonic pass), never merely
  rewritten.

**Rulings taken 2026-11-10, after PR #174's merge.**

- **R36 — Held findings.** A defect a review finds in a decision the
  pass has not reached stays with the pass: it is recorded on the
  decision's inventory entry as a held finding and fixed in the chapter
  PR that takes the decision. A finding that cannot wait goes to the
  maintainer as an ask; the route for it then is a standing hand-off
  item modelled on B-182 (unit tidy-ups from the book pass), opened only
  when a finding needs it. The pilot's four code findings are held; the
  fifth, four stale entries of `docs/decisions.md`, is fixed directly,
  since that register is a shared status document.

**Rulings taken 2026-11-10, in the review session.**

- **R37 — Two phases.** The maintainer's proposal, taken with the review
  session's four recommendations: a decision-review phase over every
  decision by part, then a content phase chapter by chapter (§2.8);
  approval under R28 split as §2.8 item 3 says (option (a); the option
  not taken: phase 1 also makes the code changes); the code checked
  against each decision in phase 1; reviews of about 12,000 words, a
  part split where larger. The chunk sequence of §5 gains DR1 to DR6
  and CH0 to CH33.
- **Ratified 2026-11-10, on PR #183.** The maintainer reviewed the PR and
  ratified every change: the four corrected entries of
  `docs/decisions.md`, R36, R37 and §2.8 as written, part (e) of the
  briefs, and the terms *held finding* and *decision review*.

**Rulings taken 2026-11-11, in the review session, on DR1's method.**

- **R38 — The purpose of the decision review.** The maintainer's
  statement: implementation choices made over time have blurred and
  weakened some of Allegro's initial goals, and the review is there to
  rectify that. A decision is adjusted when it is shown unsound because
  it contradicts a prior decision. Wherever a choice was adopted counter
  to the original goals because no alternative was obvious, the review
  revisits it analytically and corrects it; it does not restate the
  goal to fit the code. Two named cases: "compile time" is not a
  necessary concept for Allegro, since partial evaluation is primary
  and build, validation and execution phases are configuration; and the
  original goals lean to a single extension mechanism for all. The
  wording of each decision is as strong and clear as it can be, and
  makes sense to a reader who does not know the project, the early
  decisions above all.
- **R39 — Partial evaluation is primary, stated consistently.** Taken
  with R38: the three claim rulings of DR1 (a refuted claim halts, a
  pending one does not, no check silently weakened) are one decision,
  partial evaluation applied to claims; and compilation as partial
  evaluation stays in Part I. Every decision that partial evaluation
  applies to (claims, compilation, types, optimisation) is worded to
  show the one approach.
- **R40 — Layers go.** Ruled 2026-11-11 with DR1: "layer" was only ever
  a way of organising code. The standard language is a configuration of
  extensions, not a tier, and the term is to be done away with before
  release. Until then L0 to L3 are vocabulary of the units appendix
  only, and no decision of the book rests on them.
- **R41 — DR1 ruled; the vision chapter.** Every ask of DR1 was ruled
  item by item in the review session on 2026-11-11, with the review
  session's own reading beside the review's; the rulings are in the
  record `docs/records/book-pass/dr1-part-1-the-bet.md` and the ruled
  decisions in the inventory. Part I is a thesis statement and 23
  decisions in two chapters. A Part I decision owns no code: every
  violation is a held finding on the decision that realises it.
  `docs/book/vision.md` (Tier 0) is not patched now; the tour and Part
  I replace it when they are written in phase 2, by a Tier-0 PR with
  the maintainer's sign-off then. The strength vocabulary is four
  words: decided, sampled, assumed, undecided.
- **R42 — DR2 ruled.** Part II was ruled item by item in the review
  session on 2026-11-11: the review session read all 74 entries against
  Part I and brought fifteen conflicts first; no review was delegated.
  The rulings are in `docs/records/book-pass/dr2-part-2-the-kernel.md`.
  The kernel as ruled: values in seven kinds, bits it does not compute
  on, pure primitives, the evaluator, metadata fields with pure bounded
  rules, authority as unforgeable values, and the record of a claim.
  An extension is functions and fields; the evaluator calls into no
  extension except to apply a field's rule. One Part I decision was
  amended with the maintainer's approval, a refinement inside phase 1,
  not a return under R28 (the monotonic pass).

## 7. Record

- **2026-11-03 — plan drafted** by the orchestrating session, for the
  review session to take over. Read on `origin/main` at `58fe38a`; no
  code changed. The plan's PR files B-182 as the hand-off item and B-183
  and B-184 as placeholders, adds `docs/plans/book-pass-briefs.md`,
  creates the changelog section `## Stream A — the book pass`, appends
  the manifest row, names the stream in lane A's row and in B-174's
  entry. Rulings R1 to R9 await the maintainer. On ratification the
  review session records the rulings taken in §6 and flips the header to
  `status: active` in its first chunk's PR, as `docs/plans/pe-rules.md`
  did at PR #148.
- **2026-11-03 — plan ratified; F1 reviewed** (the review session).
  PR #154 merged the same day with no ruling comment, taken as the
  defaults: R1 to R9 as recommended, the six terms of §1 ratified.
  Amendments M1 and M2 ruled the same day (§6). Header `status:
  active`. F1, review only (R9): `docs/records/book-pass/f1-readme.md`,
  20 claims checked (13 hold, 6 wrong, 0 stale, 1 unverifiable), no
  term moved, no tidy-up, one out-of-scope finding for B-183 (a parse
  failure in the README's taste example), rulings R-F1-1 to R-F1-8 and
  one term (*unstreamed PR*) put to the maintainer. Lints:
  `lint:docs:check` anchors 0 · order 0 · ids 784; `lint:ir` 5 files
  clean, unratified terms 0; `doc-ref-lint` all resolve; `lint:streams`
  0 findings. One PR, as §5 allows for a review-only chunk.

- **2026-11-03 — re-scoped** (the review session). The re-scope rulings
  recorded in §6; the purpose in §1, the twelve principles in §2.6, the
  front chunks P0 to P2 in §5. Four terms added to §1 and ratified the
  same day. No chapter edited.
- **2026-11-03 — F1's rulings recorded; P0 opened** (the review
  session). PR #156 merged before its rulings commit, so the rulings
  are recorded in `docs/records/book-pass/f1-readme.md` by this PR, the
  one edit after its merge. B-183 (a trailing comment breaks a contract
  body's parse) and B-184 (the root README's corrections) filed under
  R-F1-5 and R-F1-1. **For the orchestrating session:** B-184 is a
  lane-S PR. It lands README's fixes and widens two globs: lane S by
  `README.md` and `demos/rung1/README.md`, lane A by
  `docs/plans/book-pass-inventory.md`. Chunk P1 waits for that widening.
  R15 and R16 recorded in §6; the pattern list in §2.6.
- **2026-11-03 — P0, the preface, written; count paused** (the review
  session). `docs/book/preface.ir.md` first, then `docs/book/preface.md`
  by the reasoning role: 62 claims, 4 proposed terms, about 940 words, no
  ids in the prose. A new part "Preface" heads `docs/reading-order.json`
  and `docs/book/README.md`, with no renumbering; two `book-changes.md`
  rows (the principles and three definition sites moved from this plan
  to the preface, plus *open decision*). Count 1 under brief (d) of the
  briefs, a fresh stranger instance per round: round 1, 22 findings, not
  readable; round 2, 16 findings, not readable; every fix confirmed but
  one passage held for a ruling (ask A6 of the IR), which counts against
  any round under the override. Paused for the maintainer's rulings on
  the IR's asks A1 to A6. The briefs gain §8 of the review template, the
  *pattern* kind and part (d). Lints: `lint:docs:check` anchors 0 ·
  order 0 · ids 784; `lint:ir` 6 files clean, unratified terms 4;
  `doc-ref-lint` all resolve; `lint:streams` 0 findings.
- **2026-11-03 — PR #157's rulings applied; round 3; paused again**
  (the review session). R17 to R20 recorded in §6, R19 in part (c) of
  the briefs. The preface: the IR's asks A1 to A6 applied, 0 unratified
  terms; round 3, 935 words, 10 findings (10.7 per 1,000 words, from
  23.3 and 17.5), not readable; the fixes confirmed, one passage held as
  the IR's ask A7. Stream D's chunk C4 merged (PR #158), so F11's edit
  of `docs/book/concepts.md` is no longer waiting (§2.4); the order of
  the re-scoped front holds it until P1's table of contents. P1 still
  waits for B-184's lane widening. R20 open: the stream has no spare id.
  Lints: `lint:docs:check` anchors 0 · order 0 · ids 784; `lint:ir` 6
  files clean, unratified terms 0; `doc-ref-lint` all resolve.
- **2026-11-03 — the label ruled; count 1 closed at round 5** (the
  review session). The maintainer ruled the IR's ask A7 on PR #161:
  every decision section carries the label, "aesthetic" names the
  rationale, and the label depends on what rests on the decision.
  Rounds 4 and 5: 6 then 11 findings (6.0, then 10.8 per 1,000 words).
  The count closed at round 5 on its meta-review: the curve rose, the
  tour passage drew findings in five rounds under every structure, and
  strangers contradicted each other. The maintainer's reading is the
  test (R14 (the human reader)). Asks A8 (the aim sentence) and A9 (the
  tour) open. The preface: 66 claims, 976 words. P1's research ran
  beside it: three fragments (97, 95 and 92 entries), being merged in
  the scratchpad until this PR merges.
- **2026-11-04 — P1, the decision inventory; the preface finished**
  (the review session). R21 and R22 recorded in §6. The preface: the
  tour cut, the aim sentence ruled. `docs/plans/book-pass-inventory.md`:
  256 decisions (significance 5: 10, 4: 51, 3: 100, 2: 83, 1: 12;
  foundational 100, swappable 156; settled 177, partly built 42, open
  37), merged from three fragments, ordered by dependency with
  significance breaking ties; a proposed table of contents of six parts
  and thirty-three chapters after the preface and the tour; today's
  chapters mapped; the pilot recommended as planned. B-185 (a sampled
  induction proof reported as discharged) filed. PR #161 merged before
  its last four commits; this PR carries them. Stream D closed
  (PR #162), so the evaluator chapter and the spine's §25 are no longer
  waiting (§2.4). From this PR on, each PR has its own branch, at the
  maintainer's request: the repository deletes a head branch on merge.
- **2026-11-05 — P1's rulings** (the review session). R23 to R29
  recorded in §6, from the maintainer's comment on PR #163. The
  inventory gains its rulings section, the maintainer's motivations
  mapped to the ten choices for the tour, and one decision (language
  extensions are declarative): 257 decisions. Chunk P1b (the decision
  types) added before the pilot.
- **2026-11-05 — P1b, the decision types** (the review session). R30
  recorded in §6; the monotonic pass proposed in §2.7. Every inventory
  entry typed: 256 decisions, 202 capability and 54 implementation. 21
  dependencies of a capability on an implementation decision found in
  20 entries: 19 misread (redirected to the capability they rest on, or
  reversed), 2 resolved by retyping one entry as implementation. Two
  mutually defined capability decisions merged (incompleteness and
  future cells). The three cycles of the merge re-examined. Ten types
  hard to call, put to the maintainer. The type check is recorded in
  the inventory.
- **2026-11-06 — P1b's rulings** (the review session). R31 recorded in
  §6; §2.7 accepted; B-186 (a lane for the monotonic pass) filed for the
  orchestrating session; three types put to review, the review session's
  findings recorded in the inventory's type check.
- **2026-11-07 — M3 reconciled** (the review session). R32 recorded in
  §6; §8 and lane A's row say where the review session edits code; B-186
  moved to the review session. PR #166 (rung 3 on the site) reviewed:
  its fixes leave twelve claims of `docs/book/platform/host.ir.md`
  stale, for the maintainer to rule how they are re-proposed.
- **2026-11-07 — lane R** (the review session). R33 recorded in §6.
  B-186 (a lane for the monotonic pass) landed as a lane-S PR: lane R in
  `scripts/analyze/lanes.json` and the lane table, the plan's header
  moved to it; lane A keeps its other items.
- **2026-11-07 — the host chapter's claims re-stated** (the review
  session), under R33. `docs/book/platform/host.ir.md`: C86, C110, C112
  to C116, C118 and C119 re-stated as current state; C87, C111 and C117
  (history) and relation R3 cut; C81, C83, C101 and C140, also stale
  after the site's redeploy at 52a34d2, re-stated; all proposed under the
  IR's ask A3. Verified: `sync-web-libs --check` passes, the bundle loads
  with no `process` global, the suite's four web tests pass, the live
  bundle carries the guard. Lints: `lint:ir` clean, unratified terms 0;
  `lint:docs:check` ids 784.
- **2026-11-07 — P2 opened: the pilot chapter's review** (the review
  session). `docs/records/book-pass/p2-allegretto-metadata-and-capability.md`:
  the thirteen decisions of chapter 7, one ruling each, R-P2-1 (taking
  chapter 7 before chapters 1 to 6) first. Two code defects confirmed:
  a second viral field erases the first (`viralOnto`,
  `src/metadata.ts:331`), and `channel_register` accepts any rule string.
  B-183 and B-185 left this plan's reserves, which
  `docs/plans/pilot-findings.md` now holds.
- **2026-11-07 — P2's dry run written** (the review session). R34
  recorded in §6, its rule in part (a) of the briefs. The maintainer
  took every default of the review. `docs/book/allegretto/metadata-and-capability.ir.md`
  (224 claims, 65 clusters, 25 terms of which 3 proposed) written first,
  then the chapter rewritten as eleven decision sections, the content
  bound for chapters 8 and 10 held in a final section; no code changed.
  Eight `book-changes.md` rows. Stale section-number citations of the
  chapter fixed in `architecture-vocabulary.md`, `evaluator.ir.md` and
  `build-pipeline.ir.md`. Lints: `lint:ir` 7 files clean, unratified
  terms 3; `lint:docs:check` ids 783 (one below the baseline, not
  lowered here).
- **2026-11-08 — P2's rulings applied** (the review session). R35
  recorded in §6. The IR's 205 proposed elements flipped to decided, 0
  unratified terms; the *organized* marker struck from the chapter. The
  ids baseline lowered to 783 in its own commit. The pilot is done; the
  pass starts at chapter 1 of the inventory's contents under R34
  (recommend the right decision).
- **2026-11-10 — the pilot's findings placed** (the review session). R36
  recorded in §6. The inventory gains "Findings held for their
  decisions" and four held-finding notes; `docs/decisions.md` corrected
  in four entries: three superseded by the carrier's deletion, and the
  composite ruling marked executed.
- **2026-11-10 — two phases** (the review session). R37 recorded in §6;
  §2.8 states the phases; §5 gains the phase chunks; the header's
  `chunks` lists them; part (e) of the briefs is the phase-1 brief.
- **2026-11-10 — DR1 opened: the decision review of Part I** (the review
  session). `docs/records/book-pass/dr1-part-1-the-bet.md`: the 23
  decisions of chapters 1 to 3 ruled, eight new decisions proposed from
  the maintainer's motivations, 13 held findings. Reproduced: `--base`
  loads no extension (`use` is a parse error); a return-type mismatch
  reports after the program has run and exits 0; a failed proof halts
  only after the program has run.
- **2026-11-11 — DR1 ruled** (the review session, now discussing each
  item with the maintainer). R38 to R41 recorded in §6. The inventory's
  Part I rewritten as ruled: the thesis statement "Why a new language,
  now" and 23 decisions in two chapters (10 and 13), chapter 3
  dissolved; 256 decisions in all. About twenty held findings recorded
  on the decisions of Parts II to VI that realise them, the standard
  language as privileged host code the largest. Two proposals deferred
  to their parts. Lints: `lint:docs:check` anchors 0 · order 0 · ids
  783.
- **2026-11-11 — DR2 ruled** (the review session). R42 recorded in §6.
  Part II of the inventory: 74 decisions in nine chapters became 49 in
  seven; 231 decisions in all. Lints: `lint:docs:check` anchors 0 ·
  order 0 · ids 783.

## 8. Sessions

This section is self-contained.

**Two sessions, one repository.** The repository is the only state the
two sessions share. Neither reads the other's conversation.

- **The review session** runs this stream and, since amendment M3 (§6),
  the tidy-up stream under its own plan. The maintainer discusses each
  chapter there. It works in worktrees under `.claude/worktrees/`, one
  single-use branch per PR, and opens each PR for the maintainer. It
  reports through this plan's §7 (one bullet per PR, dated, with counts
  and lint lines), through the tidy-up plan's §7, and through its PRs,
  whose bodies carry W-008's four parts. It reads B-182 when a chapter's
  edit merges and opens tidy-up chunks from it.
- **The orchestrating session** runs the implementation streams, the
  leading edge of the language toward the next validating demo, and
  keeps the maintainer's status board. The board reads this plan's §7
  and the tidy-up plan's §7.

**What each session never does.**

- The review session edits code in two kinds of chunk only (R32, §6).
  In a chapter chunk, once B-186 (a lane for the monotonic pass) lands,
  it makes the chapter's decisions' own code and test changes under
  §2.7, and nothing else; until then a chapter chunk edits no `src/`,
  `lib/`, `tests/`, `demos/`, `bench/` or `scripts/` file, except the
  ids baseline under M1 (§6). In a tidy-up chunk it edits only the
  unit's files that the tidy-up plan's boundary names. A change in a
  file inside an active implementation stream's boundary is ruled by
  the maintainer case by case (R32). It never edits another stream's
  backlog items, lane row, manifest row or changelog section.
- The orchestrating session never edits `docs/book/**`,
  `docs/reading-order.json`, `docs/records/book-pass/**`, this plan or
  the tidy-up plan, except `units.md` status cells under §2.4; never
  appends a line to B-182, checks one off or rewrites one; never edits
  this stream's or the tidy-up stream's backlog items, lane row,
  manifest row or changelog section. Its implementation streams declare
  their boundaries in their plans' headers, which is how a tidy-up chunk
  knows what to wait for.
- Neither session lowers a ratchet baseline outside the B-164 rule, or
  merges a PR: both streams are human-gated.

**Starting.** The review session reads, in order: `CLAUDE.md`; this
plan; `docs/plans/book-pass-briefs.md`; `docs/plans/book-chapters-now.md`
(§3.1 and §6, the precedent); `docs/book/allegretto/evaluator.review.md`
(what a count looks like); `docs/book/README.md` and
`docs/reading-order.json`. It then starts the first chunk in §5 that is
not waiting.
