# The book pass: working briefs

> **Working material of the stream**, not a chapter and not a plan.
> Stream plan: `docs/plans/book-pass.md` (B-174 (the book's existing
> chapters retrofitted to IR), lane A). The review session copies these
> three documents into each chunk's brief, filling the placeholders in
> angle brackets or braces. Changed only by the stream's own PRs; the
> doc lints that govern `docs/plans/` govern this file (anchors, ids).
>
> - **(a)** the chapter-review record template, step 1 of the plan's
>   per-chapter procedure (§5);
> - **(b)** the stranger brief, count-2 version, for step 3;
> - **(c)** the reasoning-role brief, count-2 version, for steps 2 to 4;
> - **(d)** the human-reader stranger brief, for prose whose reader is
>   the curious programmer (`docs/plans/book-pass.md` §1, ruling R14 (the
>   human reader)).
>
> The phrasing patterns of the plan's §2.6, principle 8 (ruling R16 (the
> phrasing patterns)), are checked in all four: the review's §8, and the
> finding kind *pattern* in (b) and (d). The list grows as the pass meets
> new patterns; the plan's list is the source.
>
> Parts (b) and (c) are stream A's briefs (`docs/plans/book-chapters-now.md`)
> with the meta-review's recommendations 1, 4, 5, 6, 8 and 9 adopted
> (`docs/records/evaluator-chapter-meta-review.md`, adopted 2026-11-02).
> Session paths became "the chapter's working folder named in the
> chunk's brief"; sentences about the evaluator chapter became sentences
> about "the chapter under review".

## (a) The chapter-review record template

Path: `docs/records/book-pass/<chapter-slug>.md`, the slug as the plan's
§5 defines it. About 600 to 1,200 words. Written before any edit of the
chapter. Written once: the rulings taken are added by one commit before
the review's PR merges, and the record is never edited after.

```markdown
# Chapter review: <chapter title> (<chunk id>)

> **Record.** Reader: RD-2 (the owner returning after a gap). Form:
> W-008 (reports map their deliverables). Subject: chunk <chunk id> of
> `docs/plans/book-pass.md`, the chapter `<chapter path>` (<order>, unit(s)
> <units or "none">), read on `origin/main` at `<commit>`, <date>.
> Author: the review session. The maintainer reads the chapter and this
> review together and rules by number; "defaults" takes every
> recommendation.

## Asks

1. **R-<chunk id>-1 — <the question, one line>.** Options: (a) <...>;
   (b) <...>. Recommended: (<x>), because <one or two sentences>.
   Default: (<x>).
2. <one ruling per restructuring, definition-site move, designation
   choice, rendering choice and count choice; then:>
n. Ratify or strike each term under *Terms introduced*. Default: <...>.

(State "No asks." when there are none.)

**The right decision, not the cheapest change** (ruling R34 (recommend
the right decision) of the plan, 2026-11-07). A recommendation names the
option that makes the decision right for the language, judged on the
decision's own merits and its dependants. The size of the code or
document change it needs is stated as a cost beside each option, and is
never itself the reason for a recommendation. A review that keeps a
decision only because changing it is expensive says so as a finding.

## What is already covered

<The parts of the chapter that encode decisions already settled, each
with its source: a decision id with its name, a ruling, a merged PR.
State "We already covered everything in the document" or name what is
not covered.>

## What changed

### 1. The chapter against the code

| # | The chapter says | The code does | Pointer | Verdict |
|---|---|---|---|---|
| 1 | <quoted or paraphrased claim> | <what the code does> | `<file>:<line>` or a pinned demo | holds / wrong / stale / unverifiable |

### 2. Links and references

<Each link or reference that is wrong (target gone or misnamed), forward
(a `def-` link to a later chapter in reading order, or a term used before
its definition site without a link) or missing (a term's first use in a
section with no link). One line each, with the line number.>

### 3. Terms and definition sites

<Each term whose definition site should move, under the D52 (the
documentation book) rule: a term is defined only from earlier chapters,
one definition site per term, a `def-` anchor at it. For each: from,
to, the chapters that link it, the `docs/book-changes.md` row the edit
adds. A move that would leave an earlier chapter linking forward is a
stop (plan §3, stop 3) and an ask.>

### 4. Designation, rendering and count

<The designation under the plan's R3 (normative-and-rendered by default),
the rendering choice for an IR-only chapter under R4 (whether the four
IR-only chapters are rendered in this pass), and whether a stranger-round
count runs under R5 (when a stranger-round count runs), each with the
recommendation the
asks carry.>

### 5. Restructuring

<Each option the asks put to the maintainer, in one paragraph: what
moves, what it costs, which later chapters it touches.>

### 6. Tidy-ups found

| # | Unit | File | What |
|---|---|---|---|
| 1 | <unit from `scripts/analyze/units.json`> | `<file>` | <a move, a rename, a comment pointer, dead code; no behaviour change> |

<Filed under B-182 (unit tidy-ups from the book pass) by the edit PR.
State "No tidy-ups found." when there are none.>

### 7. Other findings

<A behaviour the chapter states that the code does not have, or a defect
no unit holds: filed under an id the plan's header reserves, rewritten
from its placeholder by the review's rulings commit. State "None." when
there are none.>

### 8. Headings and phrasing

<Each heading that names its section's shape rather than its content,
with a heading that uses the section's terms. Each place where the most
significant point is not first. Each instance of the other patterns of
the plan's §2.6, principle 8, counted by pattern, with two or three
examples quoted.>

## Terms introduced

<Each term this review or the edit will use with a meaning that neither
the methodology vocabulary nor the book defines, one sentence each.
State "No terms introduced." when there are none.>

## Rulings taken

<Added by one commit before the merge: each ruling's number, the option
taken, the date, and the PR.>
```

## (b) The stranger brief, count-2 version

# Stranger brief — round {N} on the chapter under review (count-2 version)

You are a stranger reviewer: a fresh reader with no part in writing the text and no conversation context. You review one book chapter of the Allegro project against the readability test of reader RD-4 of the methodology's reader catalog: "a fresh agent session, including an auditor or reviewer; assumed to know the methodology at the project's pin and what the project's documents state, and nothing recorded nowhere; needs terms defined or cited before use, the problem before the solution, one definition site per term, status that is true. Test: can the session state the document's problem, its terms and its decision, without the conversation?"

Read ONLY these files, in this order, and nothing else in the repository. Both are in the chapter's working folder named in the chunk's brief.

1. The prose: `{PROSE}`
2. Then, and only after step A below is written, the IR: `{IR}`

## Step A — restatement (write it BEFORE opening the IR)

After reading the prose alone, write a restatement of at most 200 words: what problem the chapter answers (what the chapter's subject is and does), the terms it defines, and the decisions or rules it states as governing the code. Write this from the prose only. Do not open the IR until the restatement is written.

**Required elements (meta-review rec. 1, adopted 2026-11-02).** The restatement carries each required element: the text's problem, every term the text defines, and every decision the text states it executes. The 200-word bound does not excuse an element: a required element missing from the restatement is a restatement mismatch. Leaving out any other claim is a compression, not a mismatch.

## Step B — read the IR and compare

The IR is the model the prose was rendered from. Each claim `C<n>` renders as one sentence; each cluster `G<n>` as one paragraph. Compare your restatement with the IR's terms and claims.

Report each **restatement mismatch**: a point where your restatement disagrees with the IR. For each, say whether you attribute it to your own restatement (you compressed or misread) or to the prose (the prose does not carry the claim, or carries it so that a reader misses it). When you attribute a mismatch to your own restatement, quote the prose sentence that carries the IR claim; if you cannot quote one, attribute it to the prose.

## Step C — findings

Then report findings, each as one table row: number; the quoted prose or IR text (short); kind; the fix the finding needs (`cut`, `rephrase` or `add`); locus (`prose`, `IR` or `both`). Kinds:

- **contradiction**: two statements that cannot both hold, in the prose, in the IR, or between them (including a prose sentence that states something no IR claim holds, or an IR claim no prose sentence carries).
- **undefined term**: a project-specific term (a bolded term or a capitalised multi-word phrase that is not a person, product or place) used in a section before the section defines it or links it to a definition site. A term linked to a definition site at its first use in the section counts as defined; you need not follow the link.
- **referent**: a sentence-initial `This`, `That`, `These`, `Those` or `It` with no noun after it; `the other`, `the above`, `the former`, `the latter`, `the same` with no noun after; any pronoun whose antecedent is in a different sentence and is not recoverable.
- **compound**: one sentence that joins two claims a reader could judge separately (`and`, `but`, `so`, a semicolon, an em-dash); a sentence over 35 words.
- **excess**: a repeated statement, a word or clause that adds tone but not content, a plainer phrase available.
- **identifier**: an identifier such as a backlog id, a decision id, a ruling id or a section number whose first use in the chapter is not followed by its name in parentheses or a link.
- **mismatch**: the prose carries something the IR does not, or drops a claim the IR holds.
- **pattern**: a phrasing pattern of `docs/plans/book-pass.md` §2.6, principle 8: a heading that names its section's shape rather than its content; the most significant point not first in its document, section or paragraph; contrast framing, groups of three for rhythm, em-dash chains, signposting, closing restatements, intensifiers, bold labels on list items, an abstract noun where a verb would do.

Do not ask for edge cases to be elaborated, rules to be extended, or definitions the chapter does not need. Do not propose new content. A finding that proposes fewer words is as valid as any other.

## Step D — verdict

State the prose's word count (excluding the final render-map comment). Then the verdict, `readable` or `not readable` for RD-4, by three conditions: (1) your restatement has no mismatch with the IR that you attribute to the prose; (2) you found no contradiction; (3) you found no undefined term. State the counts: restatement mismatches (own / prose), contradictions, undefined terms.

**Mismatches by passage (meta-review rec. 9, adopted 2026-11-02).** Report each restatement mismatch with the passage it falls on (the cluster id `G<n>` where the IR has one, else the claim or term id). Do not apply the override that counts a mismatch on one passage in two rounds; the reasoning role applies it from the review record, not you. Your verdict stays by the three conditions above.

Reply in this order: the restatement, the mismatches, the findings table, the word count and verdict. Nothing else. You will be asked afterwards to confirm whether each fix made to your findings holds; keep your findings numbered.

## (c) The reasoning-role brief, count-2 version

# Chunk {CHUNK} — {CHAPTER}, IR first (reasoning-role brief) — count-2 version

You are the reasoning role for chunk {CHUNK} of the book pass (`docs/plans/book-pass.md`, lane A) of majodali/allegro. You work in the git worktree and on the branch named in the chunk's brief, the chapter's working folder (already created off `origin/main`; `node_modules` is symlinked). Everything you write goes in that worktree. Never touch the main checkout, never push, never open a PR, never run `git rebase`. Commit in the worktree when a coherent state is reached (see Commits).

### Read first, in this order

1. `CLAUDE.md` in the worktree (session bootstrap: commands, invariants, writing rules).
2. `docs/plans/book-pass.md` — the stream plan: §1 (terms), §3 (oracle and stop conditions), §4 (file boundary), §5 (the per-chapter procedure and the chunk's row), §6 (the rulings, as taken).
3. The chapter review of this chunk under `docs/records/book-pass/`, merged, with its *Rulings taken*. The rulings bind you; a change they do not cover is a stop.
4. The methodology's IR specification, read-only, at the path the chunk's brief names, with its worked example IR and the first 120 lines of its review record (header form, element form, provenance, render map, review-record form); the style guide (Readers table, P- checks).
5. The chapter itself, its IR and its review record if they exist; the model chapter `docs/book/allegretto/metadata-and-capability.md` (the shape every chapter follows: reader statement, authority, status tags per section, pinned examples, closing table of sources and tests); `docs/book/README.md` (table of contents, status tags); `docs/reading-order.json`; the unit's rows in `docs/book/units.md`; the spine entries the chapter cites in `docs/book/concepts.md`; `docs/book-changes.md` (row shape); `docs/documentation-census.md` (row shape); this stream's section of `docs/CHANGELOG.md`; the decisions and backlog entries the chapter cites.
6. The code the chapter's claims describe, as the review's §1 points to it, and the pinned demos it quotes (suite-pinned via `// expect:` lines; quote verbatim excerpts only, including their `// expect:` lines).

### What you produce

The chapter's IR, its prose if it is rendered, its review record if a count runs, and the status-file edits of plan §5, all inside the plan's §4 boundary.

#### 1. `<chapter>.ir.md` — written or updated FIRST, before any prose

Header lines exactly in this form (one per line, no table):

```
# IR: <chapter title>

Reader: RD-4
Purpose: document. <one sentence: what the chapter is for>
Status: draft
Source: chunk <chunk id> of docs/plans/book-pass.md (the book pass, B-174); <the code the chapter describes>
Normative: yes
Footprint: <every file the chunk changes, semicolon-separated>
```

`Normative: yes` is the default designation (plan R3); omit the line only when the review took an IR-only or non-normative designation. Then the five sections in order: `## Terms`, `## Claims` (sub-headings allowed, one per chapter section is natural), `## Relations`, `## Evidence`, `## Asks`.

For a chapter with no IR, write the IR from the prose and the code: each sentence of the prose that states a claim becomes a claim, checked against the code; a sentence the code contradicts is a finding for the review's rulings, not a silent fix.

Element rules (the specification's, enforced by `mtool ir check`):

- Every element: `T<n>.`, `C<n>.`, `G<n>.`, `R<n>.`, `E<n>.`, `A<n>.` at line start, identifiers unique, a split claim takes a new number.
- A claim is ONE statement, at most 40 words, no `and`/`but`/`so`/semicolon/em-dash joining two clauses. Names every referent inside itself: no bare `it/this/that/these/those`, no bare `the other/above/former/latter/same`, unless the antecedent is earlier in the same claim. A reference to another claim is a relation, never a pronoun.
- Terms, claims and clusters END with one provenance status: `[decided: owner, <date>]` or `[decided: <source>]` for a claim quoting a ratified decision or ruling (name the decision: `[decided: <decision id>]`, `[decided: <ruling>, <date>]`, `[decided: docs/book/concepts.md §<n>]`); `[proposed: this IR]` for EVERY claim about the code as implemented; `[inferred: R<n>]` only for a claim derived by a relation. Relations and evidence carry no status.
- Every as-implemented claim carries `evidence: E<n>` and E<n> is a file-and-line pointer (`src/<file>.ts:<from>–<to>`) or a pinned demo (`tests/<demo>.alg` lines x–y with the `// expect:` line), with one phrase saying what the pointer shows. Evidence is never free-standing.
- Terms: every project-specific term a claim uses is a `T` element. A term defined elsewhere in the book: `T<n>. <term>. defined-at: <relative link into the book> [decided: ...]`. A term THIS chapter defines: its meaning in one sentence, the chapter's own anchor in the body (`anchor: #def-<slug>`), status `[proposed: this IR]`. The definition site is the chapter's `def-` anchor (custom definition in `docs/classification.md`). Move a definition site only as the review's rulings say. Define as few new terms as possible.
- Clusters: group the claims that render as one paragraph; a claim in at most one cluster; a cluster may open with a topic claim.
- Asks: `A1.` ratify in bulk the proposed as-implemented claims (list every C id); `A2.` ratify or strike each proposed term (list the T ids); each with `Depends:`. Nothing else.

State what is NOT built or not checked honestly. The chapter holds current state, never plans or history.

Run `npm run lint:ir` in the worktree, with `MTOOL_HOME` pointing at the methodology-tools checkout the chunk's brief names, until clean. Record the count of unratified (proposed) terms it prints.

#### 2. `<chapter>.md` — the prose, rendered BY YOU from the IR

Normative text: you render it, as the reasoning role. One claim → one sentence; one cluster → one paragraph in the cluster's order; connective prose allowed only if it asserts nothing new; drop no claim, add no claim. One claim per sentence is not a licence for a run of short declaratives: where a reader takes two claims as one idea, merge them into one claim in the IR first (one statement, at most 40 words), then render the merged claim (ruling R19 (claims merged for flow) of the plan). Relations and evidence are not rendered as sentences (evidence becomes the closing sources-and-tests table and file references inside sentences where natural). An edit the review rules editorial only (plan R7 (what the review session may do without a ruling)) is made in the IR and the prose alike and runs no count.

Shape: the model chapter's. Opening blockquote with **Reader.** (who; terms used without definition here, each linked to its definition site) and **Authority.** (Tier 1; the decisions executed, each named; the examples' files). Numbered sections, each heading carrying the status tag `docs/book/README.md` defines (`[implemented]`, `[partial]`, …). A term the chapter defines is bold at its definition, with `<a id="def-<slug>"></a>`. Pinned examples: verbatim excerpts of suite-pinned demos including their `// expect:` lines, each code block preceded by a sentence naming its source file. A closing table of source files and the tests that pin them. End the file with the render map as one HTML comment line: `<!-- render map: C1→¶1 C2→¶1 … -->` covering EVERY claim.

House style binds (the style guide, and the book's lints): sentences of one idea, ≤25 words target; bold only for field labels and a term at its definition site; every identifier (a backlog id, a decision id, a ruling id, a section number; `PE Rule 1` is fine) carries its name in parentheses at its first use in the chapter, ON THE SAME LINE (the doc-lint counts a wrapped name as bare); links to `def-` anchors must resolve and may point only to chapters EARLIER in `docs/reading-order.json` — a link to a later chapter is a forward reference and fails the gate. Term first use in each section links its definition site; later uses are bare.

#### 3. `<chapter>.review.md` — the review record, opened when a count runs

Header: reviewed text, its reader (RD-4), reviewer (a stranger: a fresh stranger instance per round, reading only the IR, the prose and its brief, prose first and restatement before the IR), rounds until readable with a limit of ten (the methodology's IR specification), lint state before round 1 (`lint:ir` clean; `lint:docs:check`), the brief's content in a short paragraph (restatement first; findings with kind, fix kind and locus; verdict = restatement without a counting mismatch, no contradiction, no undefined term). Then `## Curve` with the table `| Round | Prose words | IR claims | Findings | Per 1,000 words | Verdict |` and no rows yet. A chapter that already has a review record (the evaluator's) appends a new count under it. Rounds are appended later: per round, a paragraph (words, findings, restatement, contradictions, undefined terms, verdict), a table `| # | Finding (shortened) | Kind | Origin | Decision |` where the decision is `fixed: <what>` or `declined: <reason>`, and after confirmation a `Confirmation` note marking each fix confirmed or unfixed. The review session dispatches the strangers and relays findings to you by message; you make every fix in the IR first, then in the prose (re-render or edit to match, and update the render map), then record the round. Fix by rephrasing or cutting before adding; add words only for a missing definition or referent. At the end of the count, check the four meta-review signals and write the `Meta-review:` line.

#### 4. Status-file edits (plan §5, steps 4 and 5; all inside the boundary)

- `docs/reading-order.json` and `docs/book/README.md`: the chapter's entry and row, as the rulings change them (match the existing key order and style; renumber nothing the rulings do not renumber).
- `docs/book-changes.md`: one row per move, rename, split, merge or reorder, in the file's row shape, newest first, the chunk id in the date cell.
- `docs/documentation-census.md`: the chapter's row updated (type, promoted, findings); the IR and review record ride the chapter's row.
- `docs/book/units.md`: only the status cell of the chapter's unit, and not while a tidy-up PR edits the file.
- `docs/CHANGELOG.md`: one entry under `## Stream A — the book pass`, directly below the section's intro paragraph (newest first), naming the files, the moves, the count if one ran, and the ids count. Name every identifier on first use on the same line.
- `docs/plans/book-pass.md` §7: a record bullet for the chunk (date, files, claim and term counts, rounds and verdict if a count ran, ids count, unratified terms, footprint counts).
- `docs/backlog.md`: the chunk's tidy-up lines appended to B-182 (unit tidy-ups from the book pass), numbered, each with the unit, the file, what, and the chapter review as the pointer. Nothing else in the backlog.
- Do NOT edit `docs/book/vision.md`, `docs/book/process.md`, the root `README.md`, any other plan, or anything under `src/`, `tests/`, `demos/`, `lib/`, `bench/` or `scripts/`. If the chapter would need a code or test change, stop and report it (plan §3, stop 1).

### Oracles to run in the worktree before you report

```
npm run lint:ir
npm run lint:docs:check
npx tsx scripts/doc-ref-lint.ts
npm run lint:streams
PR_TITLE="B-174: <the chunk's PR title>" npx tsx scripts/analyze/lane-lint.ts --base origin/main
ALLEGRO_TEST_FILTER=tooling npm test
ALLEGRO_TEST_FILTER="<the pinned demos you quote>" npm test
```

If the ids count fell, do NOT lower `scripts/doc-lint-baseline.json`: that is a separate commit at the end, made by the review session after the branch is up to date with `origin/main` (the B-164 (ratchet baselines under concurrent merges) rule). If a lint fails, fix the cause; never weaken a lint, a baseline or a test.

### Count-2 rules (meta-review recommendations adopted 2026-11-02)

- **Exceptions beside their rule (meta-review rec. 4, adopted 2026-11-02).** State a departure from a decided rule as a claim right after the rule, in the same cluster, named as the exception ("The exception to <rule> is ..."), so the prose renders it beside the rule. A relation does not render.
- **Check a fix against the finding (meta-review rec. 5, adopted 2026-11-02).** Before relaying a fix, check it against the finding's quoted words: the flagged words are gone from the text or answered in it. A fix that keeps the flagged words is not relayed.
- **Rulings go to the owner (meta-review rec. 6, adopted 2026-11-02).** A finding that needs a source's ruling (a decision, a document, a defect's owner outside the chapter) goes to the owner as an ask, and the passage stays as it is until the ruling arrives. It does not go into the text.
- **Mark each finding's origin (meta-review rec. 8, adopted 2026-11-02).** The review record marks each finding's origin: original text, or the fix of round n that wrote it.
- **The override is yours (meta-review rec. 9, counterpart, adopted 2026-11-02).** The reasoning role, not the stranger, applies the override (a restatement mismatch on one passage in any two rounds always counts). Compare passages by passage, with the cluster id as the passage key where the IR has one, else the claim or term id. Record the comparison in the round's paragraph.

### Commits

Commit messages go in a file and are committed with `git commit -F <file>` (backticks in `-m` get shell-expanded). First line `B-174: <chapter>, IR first (<chunk id>)` or similar; body in short sentences; end with the two attribution trailer lines the chunk's brief gives. No model identifier anywhere in a repository file: write "a fresh stranger instance (a smaller model, dispatched per round)". Commit 1: the IR alone (so the history shows IR first). Commit 2: the prose, the review record's header and the status-file edits.

### Report back (to the review session, RD-3 form: status, map, asks)

Status; the map: file paths, IR claim/term/relation/evidence counts, proposed-claim ids, proposed term ids, prose word count (excluding the render map), lint results verbatim (one line each), the ids count; what you could not do and why; any stop condition hit; questions for the maintainer, if any, as asks. Do not paste the chapter.

Then stay available: the review session will send you each stranger round's findings by message. For each round: make the decisions (fixed / declined with reason), fix the IR first, then the prose and render map, re-run `lint:ir` and `lint:docs:check`, append the round to the review record (curve row + table), commit (`B-174: <chapter>, round <n> fixes`), and reply with the list of fixes made (finding number → what changed, quoting the new sentence) so the same stranger can confirm them. After confirmation results arrive, mark each fix confirmed or unfixed in the record and commit.

## (d) The human-reader stranger brief

# Stranger brief — round {N}, read as the curious programmer

You are a stranger reviewer with no part in writing the text and no conversation context. Read as this person: a working programmer, curious about language design, who has never seen the Allegro repository. You know general programming well. You do not know this project's vocabulary, process or history.

Read ONLY the prose `{PROSE}`, then, after step A is written, the IR `{IR}`. Both are in the chapter's working folder named in the chunk's brief. Read nothing else.

## Step A — what you took away (before opening the IR)

In at most 200 words: what the chapter is about, what it decided and why, and the terms it taught you. Then in at most 80 words: where you lost interest or lost the thread, and where you wanted to read on. Be honest: "nowhere" is a valid answer.

## Step B — compare with the IR

As in the count-2 brief (part (b)), step B: report each restatement mismatch, with the passage (cluster id `G<n>` where the IR has one, else the claim or term id), attributed to your restatement or to the prose. Quote the prose sentence when you attribute it to yourself.

## Step C — findings

One table row each: number; the quoted text (short); kind; the fix (`cut`, `rephrase` or `add`); locus (`prose`, `IR` or `both`). Kinds: the kinds of part (b), *pattern* included, plus:

- **jargon**: a word a programmer new to the project would not know, used without a definition or a link at its first use in the section;
- **lost thread**: a point where you could not tell why the text was telling you this, or how it connects to what came before.

Do not ask for content the chapter does not need. A finding that proposes fewer words is as valid as any other.

## Step D — verdict

The prose's word count (excluding the final render-map comment), then the verdict, `readable` or `not readable`, by four conditions: (1) no restatement mismatch you attribute to the prose; (2) no contradiction; (3) no undefined term and no jargon; (4) no lost thread. State the counts by kind.

Reply in this order: step A, the mismatches, the findings table, the word count and verdict. Nothing else. You will be asked afterwards to confirm each fix; keep your findings numbered.
