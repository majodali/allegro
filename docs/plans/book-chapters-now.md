---
type: stream-plan
status: active
backlog: B-170
lane: A
merge: human-gated
oracle:
  - npm run lint:docs:check
  - npm run lint:ir
  - npx tsx scripts/doc-ref-lint.ts
  - npm test
chunks: [A1, A2, A3, A4, A5]
reserves: [B-170, B-171, B-172]
boundary:
  - docs/book/**
  - docs/reading-order.json
  - docs/documentation-census.md
  - docs/plans/book-chapters-now.md
---

# The book's chapters that are writable now — the book-chapters stream

> **Status: active** (2026-10-30). Rulings R1 to R7 taken as
> recommended and R8 decided by the maintainer on 2026-10-30: the five
> chapters are written IR first under the methodology's W-009 (the
> methodology corpus writes its deliverables IR first), adopted for them
> in `docs/classification.md` §Rules adopted by declaration (§3.1 here).
> The plan PR files this plan at `docs/plans/book-chapters-now.md`,
> appends its row to `docs/plans/README.md`, creates `## Stream A — the
> book chapters` in `docs/CHANGELOG.md` directly above `## Unstreamed`,
> files the three backlog entries of §1, and names the stream in lane
> A's row of the lane table (B-162 (conflict-free status documents)).
>
> **Reader**: a session that will write the chapters, and the maintainer
> gating them. Assumed known: the four layers and the capability tracks
> (`docs/book/layers.md`), the gate (`docs/book/process.md` §5), and what
> a [stream](parallel-streams.md#def-stream) is. Not assumed: the book
> plan. Its essentials are restated here. Terms defined in §1.

## 1. Outcome and terms

**Outcome.** Every planned chapter of the book whose gate has passed
exists, in reading order, written IR first (§3.1): its intermediate
representation `<chapter>.ir.md` beside it passes `npm run lint:ir`,
and the chapter is either prose rendered from that IR and reviewed in
stranger rounds (the evaluator) or the IR itself, delivered IR-only
(the other four). That is five chapters (§2.2). For each one: the
chapter file exists; its `docs/reading-order.json` entry reads
`present` with a `doc` path; its row in `docs/book/README.md` names it;
the spine entries it absorbs are pointers in `docs/book/concepts.md`;
and `npm run lint:docs:check` reports zero anchor findings and zero
forward references. A reader can check this by opening the reading
order: no `planned` entry is left whose gate has passed.

**The book, in one paragraph.** D52 (the documentation book) orders the
project's design documents as a book in dependency order:
`docs/reading-order.json` is the order and `docs/book/README.md` is the
table of contents. A chapter may define a term only from terms defined
in earlier chapters. Each term has one definition site, marked by a
`def-` anchor. The book holds current state, never plans or history.
Phase 2 of the book plan (`docs/plans/documentation-book.md` §4) writes
Part II one chapter per [unit](../book/units.md#def-unit) band, each
when its code moves. The first such chapter,
`docs/book/allegretto/metadata-and-capability.md`, landed 2026-10-21.
It is the model chapter. Its shape: a reader statement; the terms it
uses, linked to their definition sites; the terms it defines, each with
a `def-` anchor; a status tag per section; definitions taken from the
spine (`docs/book/concepts.md`); reasoning taken from the area design
note; examples taken from suite-pinned `.alg` demos; a closing table of
source files and the tests that pin them.

**Terms.**

- <a id="def-chapter-gate"></a>**Chapter gate**: the event after which
  a planned chapter may be written. For a unit band it is the move that
  gives the band its own files (`docs/book/units.md` §7). For a track or
  Part III chapter it is delivered state: the thing the chapter
  describes exists and is tested. A chapter with no gate in the book
  plan is gated on delivered state.
- <a id="def-writable-chapter"></a>**Writable chapter**: a planned
  chapter whose gate has passed, and whose text needs no change outside
  this stream's boundary (§4).
- <a id="def-absorbed-entry"></a>**Absorbed entry**: a spine entry whose
  definition site moves into a chapter. The spine keeps its numbered
  heading as a one-line pointer, and `docs/book-changes.md` logs the
  move. This is what the model chapter did with the spine's §19 to §21.
- <a id="def-pinned-example"></a>**Pinned example**: a code block in a
  chapter that is a verbatim excerpt of a `.alg` file the suite already
  runs, including that file's `// expect:` lines. The suite pins the
  file, so the example cannot rot silently.

**Backlog entries the plan PR files.** No open item owns Phase 2 of the
book. The backlog was searched for "D52", "book", "Phase 2" and
"chapter". B-150 (the document lints join the gate) owns the lints, not
the chapters. B-079 (the planning DSL revalidation) and B-151 (the
planning pilot) wrote or fed one chapter each and are closed or
separate. The proposed text:

> - [ ] **B-170** (the book, Part II and III chapters writable now) ·
>   T-docs · **The planned chapters whose gate has passed.** Plan
>   `docs/plans/book-chapters-now.md` (stream A). Five chapters, one
>   per chunk, in reading order: the evaluator (unit 13), the
>   evaluation pipeline (unit 33), tooling (units 34 and 35), host
>   environments, and the demo ladder with the rung-3 pilot (Part III).
>   Each chunk updates the reading order, the table of contents, the
>   unit status row and the spine entries it absorbs. Waits, by gate:
>   the kinds (the `Value` split), scope (B-136 (scope leaves
>   `Value`)), futures and the base primitives (their moves), codegen
>   (B-072 (code generation)), proofs (B-052 (Lean export)).
>   **Pointer**: D52 (the documentation book);
>   `docs/plans/documentation-book.md` §4, Phase 2.
> - [ ] **B-171** (book-chapters stream, spare id 1) · T-docs · Reserved
>   by stream A for a finding outside its boundary. Placeholder until
>   used; the stream rewrites this entry when it files the finding.
> - [ ] **B-172** (book-chapters stream, spare id 2) · T-docs · As
>   B-171 (book-chapters stream, spare id 1).

B-171 and B-172 are the stream's two spare ids. A finding outside the
stream's files is filed under one of them instead of minting an id, so
two streams never mint the same number. Two candidates are already
known (§2.4).

## 2. The problem, measured

**Requirement.** The book plan's Phase 2 says each unit band's chapter
is written when its code moves. Some moves have happened and the
chapters have not been written. The spine still carries those bands'
definitions, so the book has gaps a reader can see in its table of
contents.

**Challenge.** The planned chapters have different gates, and several
gates have not passed. Writing a chapter before its gate would describe
a target as if it were the code, which the book forbids. Some chapters
also need files outside lane A: a new demo needs `tests/` and
`src/test/`, which lane A may not touch.

**Measurement.** Question: which planned chapters are writable now, and
how much spine text and how many bare identifiers do they carry? If
four or more are writable, a stream is worth running; if fewer, the
chapters ride their owners' chunks instead. Method: read the planned
entries in `docs/reading-order.json` and the planned files named in
`docs/book/README.md` and `docs/book/platform/README.md`; read each
gate from `docs/book/units.md` §4 and §7 and from `docs/CHANGELOG.md`;
count spine entries from the `def-` anchors in `docs/book/concepts.md`;
count bare identifiers with `npx tsx scripts/doc-lint.ts all --json`.
Taken 2026-10-30 at commit `d95f034`, read-only.

### 2.1 What exists today

| Measure | Count |
|---|---|
| `planned` entries in `docs/reading-order.json` | 4 (the kinds; scope and the evaluator, one entry; futures and the base primitives; Part III's demo ladder) |
| Planned files named only in prose | 6 (`standard/proofs.md`, `standard/pcp.md`; `platform/build-pipeline.md`, `tooling.md`, `host.md`, `codegen.md`) |
| Planned chapters in all, with the shared entry split | 11 |
| Live spine entries in tiers 0 to 5 (anchors, retired ones excluded) | 42 |
| Of those, in a band with no chapter at all | 16 (tier 0: 10, the kinds; §15, scope; tier 3: 5, evaluation) |
| `npm run lint:docs` today | anchors 0 · order 0 · ids 796 |

### 2.2 Writable now, or waiting

| Chapter | Units or track | Gate | Verdict |
|---|---|---|---|
| The evaluator | 13 | B-112 (plane interfaces) exit, landed 2026-10-24: `src/evaluator.ts` is assigned to the unit alone | **Writable** |
| The evaluation pipeline (`platform/build-pipeline.md`) | 33, T-build | The unit is in place as a file (`src/runtime.ts`); the multi-phase build surface is undesigned | **Writable for the delivered part**; ruling R3 |
| Tooling (`platform/tooling.md`) | 34, 35, T-tooling | Both units in place; `inspect`, `verify`, `obligations`, `propose`, `prove` and the diagnostic variables ship | **Writable**; ruling R3 |
| Host environments (`platform/host.md`) | T-host | The Node CLI and the browser sandbox are live | **Writable**; ruling R3 |
| The demo ladder and the rung-3 pilot (Part III) | — | Rungs 1 to 3 delivered; rung 3 packaged 2026-10 (B-151 (the planning pilot) stage E1) | **Writable**; ruling R2 |
| The kinds and the assembly | 1 to 9 | The `Value` split; not begun | Waits: the units are owed |
| Scope | 12 | B-136 (scope leaves `Value`); open | Waits |
| Futures and the base primitives | 14, 15 | Their moves; `units.md` §7 schedules none (the primitives move per section when touched) | Waits: both units are owed |
| `standard/proofs.md` | 29 | B-052 (Lean export) and the unit's split; neither landed | Waits |
| `standard/pcp.md` | 30 | The unit is in place; the chapter is B-029 (PCP protocol design revalidation), an open item of its own | Writable in principle; ruling R6 |
| `platform/codegen.md` | T-backend | B-072 (code generation); nothing built | Waits |

Five chapters are writable: enough for a stream. The pipeline chapter is
writable only for what is delivered, and the PCP chapter belongs to
another item.

### 2.3 Spine text and bare identifiers per area

| Area | Spine entries it would absorb | Bare identifiers in its sources today |
|---|---|---|
| The evaluator | §27 tail calls; §25 partial evaluation's as-implemented row (R4 below) | 2 in spine tier 3 (lines 1627 and 1651) |
| The evaluation pipeline | §29, the evalSource pipeline | 0 in §29; 0 in `implementation-map.md` |
| Tooling | none | 0 in `platform/README.md`, 0 in `getting-started.md` |
| Host environments | none | 49 in `allegretto/structures.md` (whole file; §11 is the source) |
| The demo ladder | none | 8 in `release-track.md`, 3 in `planning-pilot.md`, 1 in `vivace/planning-dsl.md`, 0 in the three `demos/rung*/README.md` |
| The whole governed set | — | 796 |

New chapters carry no bare identifiers. The count falls only where a
chunk turns spine text into a pointer, so the expected fall is small.

### 2.4 Two findings the measurement made

1. **The evaluator chapter cannot simply absorb tier 3.** The model
   chapter (II.4) links to the definition sites of *partial evaluation*
   (§25) and *residual* (§26). The evaluator chapter comes after II.4.
   Moving either anchor into it would make II.4's links forward
   references, and the order check would fail. `isResolved` also sits
   in the `kinds` unit, not the evaluator, so §26 belongs to the kinds
   chapter. Ruling R4 decides.
2. **Two status documents are outside the boundary.**
   `docs/plans/release-track.md` still names B-093 (rung-3 packaging)
   as next in its status line, while its own status log says rung 3
   landed. The book
   plan's Phase 2 row needs a progress line as chapters land. Neither
   file is in lane A. Both are candidates for B-171 (book-chapters
   stream, spare id 1); ruling R7 decides who edits the book plan.

## 3. Oracle and stop conditions

**What decides a chunk.** Each command in the header, run on the branch
after it is up to date with `origin/main`:

| Command | Must report |
|---|---|
| `npm run lint:docs:check` | "gate passed": anchors 0; order 0; ids at or below `scripts/doc-lint-baseline.json` (796 at B-150 (the document lints join the gate), landed 2026-10-30). The ids check skips `*.ir.md` and `*.review.md` |
| `npm run lint:ir` | "clean": every `*.ir.md` passes the methodology's IR checks CK-01 to CK-14 and CK-16 under `mtool ir check` (B-173 (the book writes IR first)); the count of unratified terms it prints is recorded in §7 per chunk |
| `npx tsx scripts/doc-ref-lint.ts` | "all markdown doc references resolve" |
| `npm test` | green. The suite runs the same doc-lint and IR gates in every shard, the doc-ref lint, the stream-plan and lane-manifest checks, and every pinned demo; the pinned demos are what the chapter's examples quote |

### 3.1 The chapters are written IR first (R8)

The maintainer adopted W-009 for these five chapters on 2026-10-30
(`docs/classification.md` §Rules adopted by declaration). What each
chunk therefore produces, under the methodology's specification
`intermediate-representation.md` of the methodology repository at the pinned version:

- **The IR first.** `<chapter>.ir.md` beside the chapter, header
  `Reader: RD-4`, `Purpose: document`, `Source:` naming this plan's
  chunk and the code it describes, `Footprint:` naming the chunk's
  files; five sections in order (Terms, Claims, Relations, Evidence,
  Asks). Every claim about the code as implemented carries an
  `evidence:` pointer (file and line, or a pinned demo) and the status
  `[proposed: this IR]`; a claim quoting a ratified decision or ruling
  carries `[decided: <source>]`. A term the chapter defines carries its
  `def-` anchor in the term element's body, since the chapter anchor is
  this project's definition site (the custom definition in
  `docs/classification.md`); a term defined elsewhere carries
  `defined-at:` with a link into the book.
- **The evaluator chapter (A1) is normative text.** The reasoning role
  renders the prose from the IR and runs stranger rounds until the
  verdict is readable or the limit of ten: a fresh Haiku instance per
  round, reading only the IR, the prose and its brief; findings,
  decisions and verdicts in `evaluator.review.md` beside the chapter;
  the render map at the end of the prose. The chapter's prose is the
  reading-order `doc`.
- **The other four chapters (A2 to A5) are IR-only for now.** No prose
  is rendered and no rounds run; the IR's Status reads `delivered
  IR-only`; the reading-order `doc` and the README row point at the
  `.ir.md` file. Rendering and review come at a later stage the
  maintainer will schedule.
- **Ratification in bulk.** The chunk's PR lists, in its Asks part, the
  proposed claims and any proposed term. The maintainer's "ratified"
  on the PR is the decision; the chunk then pushes one commit flipping
  those statuses to `[decided: owner, <date>]` before the merge, so a
  merged chapter's IR carries no `proposed` status it has not earned.
- **The stranger and the paraphraser are never this session.** Each
  round's stranger is dispatched fresh, with no conversation context;
  the IR is written by the chunk's reasoning role (an Opus subagent)
  and the normative chapter rendered by that same role, as the
  specification requires for normative text.

**Pins that must not move.** Every `// expect:` line in `tests/` and
`demos/`: the stream edits neither. The ids baseline may only fall. If
a chunk lowers the count, the fall is recorded in §7 and the baseline
file, which is inside lane A, is lowered with `npx tsx
scripts/doc-lint.ts --update-baseline` in its own commit after the
branch is up to date (B-164 (ratchet baselines under concurrent
merges)).

**What no tool checks.** That each example is a verbatim excerpt of a
pinned file. The reviewer diffs each code block against its named
source. This is one reason the stream is human-gated: prose and
excerpts both need the maintainer's judgment. Deviation
D-2 (merge-on-green streams) requires a mechanical oracle for every
condition.

**Stop conditions.** The four of `docs/book/process.md` §3: a failed
check, a scope change, a chunk needing a maintainer decision, a chunk
whose summary carries asks. This stream adds four:

1. **A chapter that would need a code change stops.** That includes a
   new demo under `tests/` or `demos/`, a registration in `src/test/`,
   and a corrected source comment. The model chapter added
   `tests/metadata-channels-demo.alg`; this stream cannot. The need is
   filed under a spare id and the chapter uses existing pinned demos or
   none.
2. **A chapter whose gate has not passed stops.** If the code the
   chapter describes is still mixed, owed or unbuilt, the chunk does not
   begin.
3. **A chunk that would create a forward reference stops.** If moving a
   definition site would leave an earlier chapter linking forward, the
   session stops for a ruling (R4 is the known case).
4. **A chunk whose files an active stream holds waits.** Lane A's
   `docs/book/**` overlaps lane C (`docs/book/platform/**`), lane K
   (`docs/book/allegretto/**`, `docs/book/units.md`,
   `docs/book/implementation-map.md`), lane P (`docs/book/extension/**`,
   `docs/book/implementation-map.md`) and lane D (`docs/book/**`). A1
   waits while a lane-K stream is in the Allegretto chapters; A2 to A4
   wait while a lane-C stream is in `docs/book/platform/`.

## 4. File boundary

Lane A (reval docs), narrowed by the header's `boundary` to
`docs/book/**`, `docs/reading-order.json`,
`docs/documentation-census.md` and this plan. All four are inside lane
A's globs in `scripts/analyze/lanes.json`; this plan's own file is
always allowed. The shared status documents (`docs/CHANGELOG.md`,
`docs/backlog.md`, `docs/plans/README.md`, `docs/book-changes.md`) are
edited under the B-162 rule: this stream's changelog section, its own
backlog items and lane row, and its own plans row.

Inside the boundary, a chunk may not touch:

- `docs/book/vision.md` and `docs/book/process.md`. They are Tier 0;
  any change needs the maintainer's sign-off.
- A finished chapter's prose, beyond replacing a link or a planned row.
  II.4 changes only under R4 option (b).
- `docs/book/units.md`, beyond the status cell of the row the chunk's
  chapter covers. Lane K also lists this file.
- `docs/book/implementation-map.md`, beyond one pointer line in A2.
  Lanes C, K and P also list it.
- `docs/book/concepts.md`, beyond turning an absorbed entry into a
  pointer.

Outside the boundary and read only: `src/`, `lib/`, `tests/`, `demos/`,
`scripts/`, and every other plan, including
`docs/plans/documentation-book.md` and `docs/plans/release-track.md`.

## 5. Chunk sequence

In reading order. Every chunk also adds the chapter's census row (type
"Area design note (book chapter)", promoted yes) and its entry under
this stream's changelog section. Where a definition site moves, the
chunk adds a `move` row to `docs/book-changes.md`.

| Chunk | Backlog | Deliverable | Oracle |
|---|---|---|---|
| A1 | B-170 | **The evaluator**, `allegretto/evaluator.md` under `docs/book/` (unit 13), IR first: `allegretto/evaluator.ir.md`, the prose rendered from it by the reasoning role, stranger rounds to a readable verdict or the limit with `allegretto/evaluator.review.md` (§3.1). Content: evaluation and its two partial-evaluation rules as implemented, application and substitution, tail calls, the derive-never-mutate rule's carve-out for scope, the install surface as the evaluator sees it, and the two edges B-146 (knowledge propagation) owns. Examples from `tests/functions.alg` and `tests/logical.alg`. The reading-order entry "Scope and the evaluator" splits in two: scope stays `planned`, the evaluator is `present` (a `split` row in `docs/book-changes.md`). README row II.5–6 becomes II.5 scope (*planned*) and II.6 the evaluator. Unit 13's status cell names the chapter. Absorbs [§27](../book/concepts.md#def-tail-calls); §25's as-implemented row becomes a pointer under R4 | anchors 0, order 0; ids at or below baseline, expected to fall by 1 (§27's bare citation); `lint:ir` clean; the review record's last round readable, or the limit reached and the maintainer's decision recorded; doc-ref clean; suite green |
| A2 | B-170 | **The evaluation pipeline**, IR-only (§3.1): `platform/build-pipeline.ir.md` under `docs/book/` is the chapter (unit 33). Content: the stage order of `evalSource`, what each stage may assume, the post-passes that halt, precompile, and the three things the unit still owes. The multi-phase build surface is tagged as undesigned. No examples. New reading-order entry after `platform/README.md`, `present`. README row appended after II.20. Unit 33's status cell names the chapter. Absorbs [§29](../book/concepts.md#def-the-evalsource-pipeline). `implementation-map.md`'s pipeline section becomes a pointer line. `platform/README.md` links the chapter | anchors 0, order 0; ids at or below baseline; `lint:ir` clean with the IR's Status `delivered IR-only`; doc-ref clean; suite green |
| A3 | B-170 | **Tooling**, IR-only (§3.1): `platform/tooling.ir.md` under `docs/book/` is the chapter (units 34 and 35). Content: the file runner and REPL, the subcommands `inspect`, `verify`, `obligations`, `propose`, `prove`, the safety grades, and the diagnostic variables (`ALLEGRO_STACK`, `ALLEGRO_TRACE_DEPTH`, `ALLEGRO_PARSE_STATS`, `ALLEGRO_EVAL_STATS`). Tracing and the IDE are tagged as not built. Examples, if any, from pinned demos only. Reading-order entry and README row after A2's. Units 34 and 35's status cells name the chapter. `platform/README.md` links the chapter | as A2 |
| A4 | B-170 | **Host environments**, IR-only (§3.1): `platform/host.ir.md` under `docs/book/` is the chapter. Content: the Node CLI and the browser sandbox, the browser-compatible core (`TextEncoder`, never `Buffer`), and the environment-capability contract of `allegretto/structures.md` §11, cited there. Asynchronous I/O capabilities and browser packaging are tagged as not built. Reading-order entry and README row after A3's. No unit row; the host plane is not a unit. `platform/README.md` links the chapter | as A2 |
| A5 | B-170 | **The demo ladder and the rung-3 pilot**, IR-only (§3.1): `demo-ladder.ir.md` under `docs/book/` is the chapter (Part III, after `proving-in-allegro.md`). Content: the three delivered rungs as the thesis test, each with what it shows, what it inherits and what it does not show, from `demos/rung1/` to `demos/rung3/` and the planning chapter (II.19). Examples from the pinned rung demos. Scope per R2. The Part III entry becomes `present`; its note is removed. README row III.2 names the chapter | as A2; every quoted demo line present in a file `src/test/proofs.ts` or `src/test/language.ts` runs |

## 6. Rulings

R1 to R7 were taken as recommended by the maintainer on 2026-10-30,
and R8 decided the same day. Each is kept with its options.

**R1 — The chapter order.** Options: (a) reading order, A1 to A5 as in
§5; (b) Part III first (A5), because it has the most outside readers,
then the rest in reading order. Recommendation: (a). The order check is
easiest to hold when chapters land in the order they are read, and A5
cites the evaluator's and the pipeline's chapters if they exist.

**R2 — What the demo-ladder chapter (A5) covers.** Options: (a)
delivered state only: rungs 1 to 3 as they ship, with rung 4 named in
one line as direction, not a claim; (b) the release-track plan's
intent: the full ladder, rung 4's story, the claims register.
Recommendation: (a). VISION principle 17 (claims are private until
delivered) says public copy draws only on the claims register's
delivered and demoable tiers, and the book's Phase 3 renders it on the
website. D52's settled decision 4 also keeps plans out of the book.

**R3 — Whether the platform chapters are written now.** Options: (a)
write the pipeline, tooling and host chapters now from delivered state,
with each undelivered part tagged, and leave codegen waiting; (b) all
four wait for their tracks' streams in lane C. Recommendation: (a).
Units 33 to 35 are in place, so the chapters describe code, not
intent. The undesigned multi-phase build surface is stated as such and
not designed here: designing it is lane C's work. A lane-C stream that
starts later edits these chapters as their owner.

**R4 — The definition sites of partial evaluation and residual.**
Options: (a) both stay in the spine. The evaluator chapter absorbs
[tail calls](../book/concepts.md#def-tail-calls) and becomes the
as-implemented home of
[partial evaluation](../book/concepts.md#def-partial-evaluation);
[residual](../book/concepts.md#def-resolved-unresolved-residual) moves
later to the kinds chapter, whose unit holds `isResolved`. (b) Move
partial evaluation into the evaluator chapter and reword II.4 to cite
[R2 (partial evaluation is the mechanism)](../book/concepts.md#def-r2)
instead. Recommendation: (a). II.4 depends on partial evaluation as a
specified concept, not on the evaluator's code, and option (b) edits a
finished chapter to suit a later one.

**R5 — The manifest's shape.** Options: (a) split the shared entry
"Scope and the evaluator" in two, and append the three platform
chapters after `platform/README.md` so no existing number moves; (b)
keep one entry per unit band and write the evaluator chapter as the
first half of a two-unit chapter that scope completes. Recommendation:
(a). A unit band of one unit is still a band, and (b) makes the
evaluator chapter wait in part on B-136 (scope leaves `Value`).

**R6 — The PCP chapter.** Options: (a) leave `standard/pcp.md` to
B-029 (PCP protocol design revalidation), which is lane A's next item
and runs after this stream closes; (b) add B-029 to this plan's
`reserves` and insert a chunk between A1 and A2. Recommendation: (a).
B-029 revalidates an archived design and carries rulings of its own.
One lane runs one stream at a time, so (a) delays it by this stream's
length.

**R7 — The book plan's progress line.** `docs/plans/documentation-book.md`
records Phase 2 progress, and it is outside lane A. Options: (a) this
plan's §7 is the record, and lane S adds one pointer line to the book
plan when this stream closes; (b) the maintainer edits it per chunk.
Recommendation: (a).

**R8 — The chapters are written IR first.** Decided by the maintainer
on 2026-10-30, after the orchestrating session's assessment of the
methodology's IR specification: (1) the five new chapters only, the
existing chapters retrofitted by a later stream, B-174 (the book's
existing chapters retrofitted to IR); (2) the evaluator chapter is
normative and is rendered and reviewed, the other four are IR-only for
now and are rendered and reviewed at a later stage; (3) as-implemented
claims are proposed with evidence and ratified in bulk at the chapter
PR; (4) the definition site is the chapter's `def-` anchor, so
`defined-at:` links point into the book; (5) a fresh Haiku instance per
round is the stranger. The prerequisite lane-S chunk B-173 (the book
writes IR first) landed the declaration, `npm run lint:ir` and the
doc-lint exemption. §3.1 states what each chunk produces.

## 7. Record

- **2026-10-30 — rulings taken, R8 decided.** R1 to R7 as recommended;
  R8 as above. A1 starts after the plan PR merges and B-173 is on main.
- **2026-10-31 — A1 written and reviewed.** Files:
  `docs/book/allegretto/evaluator.ir.md` (134 claims at round 1, 150
  after its fixes, 155 after round 2's and its touch-up, 157 after round 3's, 159 after round 4's, 165 after round 5's, 166 after round 7's, 167 at delivery; 30 terms), `evaluator.md` (rendered by the reasoning
  role), `evaluator.review.md`. Stranger rounds: seven rounds to a
  readable verdict; the review record's meta-review line reads pending.
  Unratified terms 1 (*tail call*); ids 791 (from 795). Found: `eval_when`, `&&` and `||`
  do not meet PE Rule 2, and the spine's §25 (partial evaluation) delta
  still says both rules are implemented as specified; filed as
  B-172 (the partial-evaluation rules as implemented against the spine).
- **2026-11-01 — A2 written, IR-only.** File:
  `docs/book/platform/build-pipeline.ir.md`, Status `delivered IR-only`
  (159 claims, of which 127 proposed, 31 decided and 1 inferred; 36
  terms, of which 2 proposed; 28 clusters). No prose and no rounds
  (§3.1). Unratified terms 2 (*the evalSource pipeline*; *tail call*,
  A1's, still proposed). Footprint: declared 10, changed 10, surprises 0,
  misses 0. Ids 791 (unchanged). Absorbed §29 (the evalSource pipeline).
  Found: the three moves the `pipeline` unit owes have no owner item, and
  precompile's error-severity notifications do not halt; both filed as
  B-171 (the pipeline chapter's two findings). Two more points for the
  PR: absorbing §29 leaves the evaluator chapter's term *precompile*
  (its IR's T20) linked to a definition site that is now a pointer to a
  later chapter, which is stop condition 3 (a forward reference the order
  lint cannot see, since the anchor stays in `concepts.md`), so the PR
  asks for ruling R9; and `docs/book/implementation-map.md` is also in
  lane P's boundary, whose chunk R2 will change the precompile context
  the chapter's claims C84 to C87 and C99 to C103 describe, so the PR
  asks who re-syncs the chapter after R2.
