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
| 2 | 913 | 63 | 16 | 17.5 | not readable (restatement mismatches 4: 2 own, 2 prose; contradictions 1; undefined terms 2; jargon 2; lost thread 2, one of them counting under the override) |
| 3 | 935 | 63 | 10 | 10.7 | not readable (restatement mismatches 2: 1 own, 1 prose; contradictions 1, held for ask A7; undefined terms 1; jargon 0; lost thread 3) |

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

Confirmation of the carry-over fixes: the round's stranger instance
confirmed 22, 23, 24, 25 and 26, and the reordered tour paragraph. It
named two new defects of the carry-over fixes, 27 and 28.

| # | Finding (shortened) | Kind | Origin | Decision |
|---|---|---|---|---|
| 27 | C56, how the prose is rendered, against C58, process detail stays out of the narrative | contradiction | carry-over fixes | declined in text: a ruling for the maintainer, ask A6 of the IR; the passage stays unchanged until the ruling (count-2 rule: a finding that needs a ruling goes to the owner) |
| 28 | C32 "an experiment written into the book, one you can run again yourself" | compound | carry-over fixes | declined: the clause is an appositive of one claim; splitting it restores the run of short declaratives that finding 22 removed |

## Round 2

Words 913, claims 63, findings 16, from a fresh stranger instance. The
restatement was correct overall. Mismatches: two own (G2, C3; G19, C67)
and two attributed to the prose (G2, C6: "for any decision" widened
"a decision" and sat oddly with C48 and C49; G2, C4: every decision
"appears here" as present fact, against C7). Contradictions 1 (finding
2). Undefined terms 2 (findings 4 and 5, both headings). Jargon 2
(findings 3 and 13). Lost thread 2 (findings 14 and 15). Verdict: not
readable.

Override comparison by passage. Round 1's mismatches fell on G7 (C21,
C29), G14 (C45) and a heading tag that no claim carried. Round 2's fell
on G2 (C3, C4, C6) and G19 (C67). No mismatch recurs on one passage.
Finding 14 falls on C56 (G17), the passage of carry-over finding 27: one
passage flagged in two rounds. Under the override it counts against
round 2's verdict. It is not edited: the passage waits for the
maintainer's ruling under ask A6.

The stranger wanted to read on at the tour and at a real decision
section showing a rejected option failing. Neither is added: the tour
is stated as not yet written (C9), and a worked decision section is ask
A5.

| # | Finding (shortened) | Kind | Origin | Decision |
|---|---|---|---|---|
| M1 | G2, C3 | restatement mismatch (own) | stranger | no fix needed: the stranger's own compression |
| M2 | G19, C67 | restatement mismatch (own) | stranger | no fix needed: the stranger's own compression |
| M3 | G2, C6 "for any decision" | restatement mismatch (prose) | stranger | fixed: finding 1 |
| M4 | G2, C4 "appears here" as present fact | restatement mismatch (prose) | stranger | fixed: finding 2 |
| 1 | "try another option for any decision" | mismatch | stranger | fixed: "for a decision", as C6 holds |
| 2 | C4 as present fact against C7 | contradiction | stranger | fixed: C4 reworded as the book's aim |
| 3 | "main design wagers" | jargon | stranger | fixed: C13 names "the few large choices that define Allegro" |
| 4 | heading "The seven blocks of a decision section" before the definition | undefined term | stranger | declined: a heading may name the term its section defines; the section's first sentence defines it |
| 5 | heading "Swappable and foundational decisions" | undefined term | stranger | declined: as for 4; the section's first two sentences define both terms |
| 6 | C16, two sites in one sentence | compound | stranger | declined: one rule with two definition sites, one statement |
| 7 | C13 joins the story and the forward pointers | compound | stranger | fixed: split into C13 and C70 |
| 8 | "clear and brief enough to hold your interest" | excess | stranger | declined: holding the reader's interest is the aim the principle states, not tone |
| 9 | "The code is organized to match the book." | excess | stranger | fixed: C42 cut; the heading carries it, and C43 states the rule |
| 10 | C66, a closing restatement | pattern | stranger | fixed: C66 cut as a sentence, its reason merged into C58 |
| 11 | heading "Two forms of each chapter" | pattern | stranger | fixed: heading "Prose for people, an intermediate representation for agents" |
| 12 | "the design and the reasons for it" | referent | stranger | fixed: "the reasons for the design" (C58) |
| 13 | "claims" in C51 | jargon | stranger | fixed: C51 glosses a claim as a single statement |
| 14 | C56, the phrasing-habits sentence | lost thread | stranger | declined in text: the passage of finding 27, counted under the override and held for the maintainer's ruling under A6 |
| 15 | C58, why process detail lives outside | lost thread | stranger | fixed: C58 gives the reason, merged from C66 |
| 16 | "Some source files, however, still hold" | pattern | stranger | fixed: "however" cut |

Claims check after the fix pass, against round 2's prose: every claim of
the fixed IR is carried (62 of 62 in the render map). C42 and C66 are
removed (C66 merged into C58); C70 is a new split of C13. No claim
reported missing or stale. Prose words after the fixes 940 (by `wc`).

Confirmation: the round's stranger instance confirmed the fixes of 1, 2,
3, 7, 9, 10, 11, 12, 13, 15 and 16, and accepted the declines of 4, 5, 6
and 8. It disputed 14: the held sentence still gives no reason why a
reader needs it, so the thread stays lost whatever the ruling on keeping
it. Finding 14 stays held under A6, whose text now carries the dispute:
keep C56 and give the reader's gain, or cut C56. The stranger named two
new defects of the round 2 fixes.

| # | Finding (shortened) | Kind | Origin | Decision |
|---|---|---|---|---|
| 14 | the held C56 sentence gives no reader's gain | lost thread (disputed at confirmation) | stranger | unfixed: held for the maintainer under A6, the dispute added to A6 |
| 17 | C58 "…which keeps the narrative on the design and the reasons for the design" | compound | round 2 fixes | declined: the clause is the reason finding 15 asked for; splitting it detaches the reason |
| 18 | three consecutive sentences in ¶1 open "The book …" | excess | round 2 fixes | fixed: C5 reads "You are invited into the design of Allegro, which is still under way." |

Claims check after the confirmation fixes: 62 of 62 claims carried in
the render map; no claim missing or stale. Prose words 940 (by `wc`).

## The count paused

The count pauses after round 2 for the maintainer's rulings on asks A3
to A6 of the IR. Round 3 runs after the rulings. Under the override, the
passage C56 (G17) counts against the verdict of any round until A6 is
ruled.

Meta-review: not indicated at the pause (signals checked: first, second
and fourth; the count has not ended).

## Rulings taken, 2026-11-03, at the merge of PR #157

The maintainer took the default on every ask of the IR and merged PR
#157 on 2026-11-03.

- A1: the listed proposed claims are ratified; they carry
  `[decided: owner, 2026-11-03]`, and so do the clusters.
- A2: the terms decision section, swappable decision, foundational
  decision and open decision are ratified; unratified terms 0.
- A3: a chapter rewritten to the organization carries `"organized":
  true` on its entry in `docs/reading-order.json`, and its row in
  `docs/book/README.md` carries the marker *organized*, explained in one
  sentence under the README's status convention. Applied to the preface
  itself. New claim C71: "The table of contents marks each chapter
  rewritten to this organization."
- A4: new claim C72: "The section of an open decision takes the seven
  blocks of a decision section, with the question still open in place
  of the decision and rationale." C41 reworded: "The explore block of an
  open decision says how and where to contribute one."
- A5: the preface will point to the pilot chapter once that chapter
  exists. No text change now.
- A6, option (a): C56 is cut from the IR and the prose. C55, the
  prose's aim, is kept. Finding 14 of round 2 and finding 27 of round
  1's carry-over are resolved by the cut.

After the rulings: 63 claims, 953 words (by `wc`), the render map
covering all 63. The count stays paused after round 2. Round 3 owes a
fresh stranger instance reading the prose and the IR as they now stand.
Status of the IR: draft, count 1 owing round 3.

## Round 3

Words about 935, claims 63, findings 10, from a fresh stranger instance
reading the prose and the IR as the rulings of PR #157 left them. The
restatement was correct overall. Mismatches: one own (the restatement
overstated the reasons; no fix) and one attributed to the prose: the
connective "Concepts follow a similar rule." carries no IR claim and
names no rule (G6). Contradictions 1, possible (finding 4). Undefined
terms 1 (finding 8, a heading). Lost thread 3 (findings 2, 3 and 5).
Verdict: not readable.

Override comparison by passage. Round 1's mismatches fell on G7, G14
and a heading tag; round 2's on G2 and G19; round 3's prose mismatch on
G6. No mismatch recurs on one passage. Finding 4 falls on C36 (G11)
against C30 (G9): no earlier round raised a mismatch or a contradiction
on either. Round 1's finding 15 touched G9 through C29, an excess since
cut, not the same claim. The held finding 4 counts against round 3's
verdict and, under the rule for a finding that needs a ruling, against
later rounds until ask A7 is ruled.

The stranger wanted to read on at an explore block and at a worked
rejected option. Neither is added: a worked decision section is the
ruled ask A5, pointed to once the pilot chapter exists.

| # | Finding (shortened) | Kind | Origin | Decision |
|---|---|---|---|---|
| M1 | the reasons overstated | restatement mismatch (own) | stranger | no fix needed: the stranger's own reading |
| M2 | "Concepts follow a similar rule." carries no claim | restatement mismatch (prose) | stranger | fixed: finding 1 |
| 1 | "Concepts follow a similar rule." | mismatch | stranger | fixed: the connective cut; ¶5 opens with C16 |
| 2 | "The tour itself is not yet written." | lost thread | stranger | fixed: C9 merged into C13, "A tour, not yet written, will open the book by telling the story of the few large choices that define Allegro." |
| 3 | C30 not linked to the block list | lost thread | stranger | fixed: C30 reads "Not every decision needs all seven blocks: a decision about the language's vision or aesthetics may need fewer." It leaves the label of ask A7 open |
| 4 | C36 against C30, C34 and C35 | contradiction (possible) | stranger | declined in text: a ruling for the maintainer, ask A7 (recommended (b)); the passage stays until the ruling |
| 5 | "Nothing in the book is drawn from the project's history." | lost thread | stranger | fixed: C33 reads "Nothing in the book, evidence included, is drawn from the project's history." |
| 6 | the consequences block joins two claims | compound | stranger | declined: one idea, what a decision opens and closes |
| 7 | C58 repeats "the design" | compound, excess | stranger | fixed: the repeat removed, the reason clause kept (round 2's finding 17): "…which keeps the narrative on the design and its reasons." |
| 8 | heading names "intermediate representation" before its link | undefined term | stranger | fixed: heading "Prose for people, a structured form for agents" |
| 9 | "this organization" three times in the status paragraph | excess | stranger | fixed: C8 reads "The chapters are being rewritten one at a time." and C71 "The table of contents marks each rewritten chapter." |
| 10 | "clear and brief enough to hold your interest" | excess | stranger | declined: holding the reader's interest is the stated aim, as at round 2's finding 8 |

Claims check after the fix pass, against round 3's prose: every claim of
the fixed IR is carried (62 of 62 in the render map). C9 is merged into
C13, and relation R1, which related the two, is removed. No claim
reported missing or stale. Prose words after the fixes 943 (by `wc`).

Confirmation: pending.
