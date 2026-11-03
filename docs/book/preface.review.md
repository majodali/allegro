# Review record: the preface, rendered from its IR

Text reviewed: `docs/book/preface.md`, normative text rendered by the
reasoning role from `docs/book/preface.ir.md` (67 claims in 19
clusters at round 1, 6 terms of which 4 proposed, 8 relations, 8
evidence pointers). Reader of the reviewed text: RD-4 (a fresh agent
session), with the book's human reader as the persona of the round's
brief. Reviewer: a stranger, a fresh stranger instance (a smaller
model, dispatched per round) with no conversation context, reading only
the prose, the IR and its brief, prose first and restatement before the
IR. Rounds until readable, limit ten (the methodology's IR
specification, Stranger rounds). Every fix is made in the IR first; the
prose is then re-rendered or edited to match, and the render map
updated.

Lint before round 1: `npm run lint:ir` clean (unratified terms 4);
round trip 67 of 67 claims in the render map; `npm run lint:docs:check`
gate passed (anchors 0, order 0, ids 784, at the baseline).

The brief, in short: part (d) of `docs/plans/book-pass-briefs.md`, the
stranger brief read as the book's human reader. The stranger reads the
prose first and writes a restatement (step A), marking where it lost the
thread and where it wanted to read on, before opening the IR. It then
compares the restatement with the IR and reports each finding with its
kind (restatement mismatch, contradiction, undefined term, jargon, lost
thread, referent, compound, excess, identifier, mismatch, pattern), the
fix kind it needs (cut, rephrase, add) and its locus (prose, IR, both).
The verdict is readable when four conditions hold: no restatement
mismatch attributed to the prose; no contradiction; no undefined term
and no jargon; no lost thread.

## Curve

| Round | Prose words | IR claims | Findings | Per 1,000 words | Verdict |
|---|---|---|---|---|---|
| 1 | 944 | 67 | 22 | 23.3 | not readable (restatement mismatches 3: 1 own, 2 prose; contradictions 0; undefined terms 1; jargon 3; lost thread 3) |

## Round 1

Words 944, claims 67, findings 22: twenty from the stranger and two
(21 and 22) from the review session. The restatement carried the
book's shape: dependency order, significance breaking ties, the tour,
concepts defined at first use, the seven default blocks, swappable and
foundational decisions, open decisions as invitations, the code partly
organized to match, no tracking numbers. Mismatches: M1 own (G7, C21
and C29: "seven fixed blocks"); M2 prose (G14, C45: "below it" could
mean the replacement); M3 prose (the heading tag "[partial]", which no
claim carries). Contradictions 0. Undefined terms 1. Jargon 3. Lost
thread 3: whether the rules apply now; the tour named before it is
explained, then stated as present fact; the move from the agent form to
the prose's aims. Verdict: not readable.

The stranger wanted to read on at a worked example of one decision
section and at the form of an open decision. Neither is added in the
fix pass. The open decision's form is ask A4 of the IR. A worked example
is the new ask A5 (whether the preface shows or points to one once the
pilot chapter exists).

| # | Finding (shortened) | Kind | Origin | Decision |
|---|---|---|---|---|
| M1 | "seven fixed blocks" against C21 and C29 | restatement mismatch (own) | stranger | fixed: C29 cut into C21 (finding 15); "By default" kept |
| M2 | "below it" in C45's sentence | restatement mismatch (prose) | stranger | fixed: C45 split, C69 names the replaced unit (findings 9, 10) |
| M3 | heading tag "[partial]" carried by no claim | restatement mismatch (prose) | stranger | fixed: tag cut (finding 11) |
| 1 | "The tour that is to open the book is not yet written." | undefined term | stranger | fixed: C9 moved after C13 and reworded |
| 2 | "A tour opens the book" reads as present fact | lost thread | stranger | fixed: C13 reworded in the future tense |
| 3 | "Allegro's big bets" | jargon | stranger | fixed: "main design wagers" (C13, C14) |
| 4 | "the project's test gate" | jargon | stranger | fixed: "test suite" (C47) |
| 5 | "the project's registers" | jargon | stranger | fixed: "records, such as its decision register", linked (C61) |
| 6 | "an open journey that the book invites you to join" | pattern | stranger | fixed: C5 reworded |
| 7 | "where the descent is going before it begins" | pattern (closing restatement) | stranger | fixed: C63 cut |
| 8 | three "You meet" / "You therefore meet" frames | pattern | stranger | fixed: C11, C62 and C64 reworded |
| 9 | the replacement sentence joins two claims | compound | stranger | fixed: C45 split into C45 and C69 |
| 10 | "the units below it" against C45 | mismatch | stranger | fixed: C69 says "below the replaced unit" |
| 11 | heading tag "[partial]" | mismatch | stranger | fixed: tag cut; C48 states the partial state |
| 12 | "engaging, clear and succinct" | pattern (group of three) | stranger | fixed: C55 reworded |
| 13 | why the reader should care about rendering from claims | lost thread | stranger | fixed: C56 reworded to name the effect on the reader; C56 now opens its paragraph |
| 14 | "Many of those habits make text less clear." | excess | stranger | fixed: C57 folded into C56 |
| 15 | the default stated twice (C21, C29) | excess | stranger | fixed: C29 cut |
| 16 | "written for the book and included in it" | compound | stranger | fixed: C32 split into C32 and C68 |
| 17 | "no tracking numbers" third in its section | pattern (lede buried) | stranger | fixed: G19 now opens the section; heading reordered |
| 18 | "An option's rationale may show how the option fails." | lost thread | stranger | fixed: C31 names the decision and rationale block |
| 19 | "the most of Allegro" | excess | stranger | fixed: "most of Allegro" (C62) |
| 20 | "or where the book decides it" | excess | stranger | fixed: "where the book settles its meaning" (C16) |
| 21 | the opening blockquote's bold Reader and Authority labels | pattern | review session (original text) | fixed: blockquote cut; C1 joins the opening paragraph, C2 the status paragraph |
| 22 | a run of short declaratives, "therefore" four times | pattern | review session (original text) | fixed: connective prose added that asserts nothing new ("The first rule is dependency order", "As a result", "Concepts follow a similar rule", "however", "also"); "therefore" twice |

Claims check after the fix pass, against round 1's prose: every claim of
the fixed IR is carried by the fixed prose (66 of 66 in the render map).
C29, C57 and C63 are removed; C68 and C69 are new splits. No claim
reported missing or stale.

Confirmation: the round's stranger instance confirmed the fixes of
findings 1 to 21 and of M1, M2 and M3. Finding 22 is unfixed in part:
"therefore" fell to two, but runs of short declaratives remained in the
tour paragraph and the paragraph on failures. The stranger named three
new defects the fixes introduced (23 to 25) and the remainder of 22 as
finding 26. All four count toward round 1's fix set, not a new round.

### Confirmation and carry-over

| # | Finding (shortened) | Kind | Origin | Decision |
|---|---|---|---|---|
| 22 | run of short declaratives remains (tour paragraph; failures paragraph) | pattern | stranger, at confirmation | fixed: C14 merged into C13; C65 and C68 merged into C32 (findings 26 and below) |
| 23 | "one checked claim": "checked" undefined | jargon | round 1 fixes | fixed: C56 reads "from one claim of the intermediate representation" |
| 24 | "As a result," does not follow from the sentence before | lost thread | round 1 fixes | fixed: "As a result," cut from C62's sentence |
| 25 | "also lives outside the book's narrative" | excess | round 1 fixes | fixed: "also" cut |
| 26 | the run "The evidence… The book includes… You can run…" | pattern | round 1 fixes | fixed: C32, C68 and C65 merged into one claim, C32, now proposed; the tour paragraph reordered with C13 and C14 merged |

Claims check after the carry-over fixes, against the confirmed prose:
every claim of the fixed IR is carried (63 of 63 in the render map).
C14, C65 and C68 are merged into C13 and C32. No claim reported missing
or stale. Prose words 930.

Confirmation of the carry-over fixes: pending.
