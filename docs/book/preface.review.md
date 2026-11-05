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
| 4 | 1,000 | 65 | 6 | 6.0 | not readable (restatement mismatches 4: 3 own, 1 prose; contradictions 0; undefined terms 0; jargon 0; lost thread 1) |
| 5 | 1,020 | 65 | 11 | 10.8 | not readable (restatement mismatches 1, own; contradictions 1, held for ask A9; undefined terms 0; jargon 1, held for A9; lost thread 3); count closed for the meta-review |

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

Confirmation: the round's stranger instance confirmed the fixes of 1,
2, 3, 5, 8 and 9, and accepted the declines of 6 and 10 and the hold of
4 under ask A7. Finding 7 is unfixed: the reason clause of C58 is still
a compound the reader judges separately. The stranger named two new
defects of the round 3 fixes.

| # | Finding (shortened) | Kind | Origin | Decision |
|---|---|---|---|---|
| 7 | "which keeps the narrative on the design and its reasons" | compound (unfixed at confirmation) | stranger | fixed: C58 split into C58 and C73, "That separation keeps the narrative on the design and its reasons." |
| 11 | heading "Prose for people, a structured form for agents" differs from the paragraph's term | pattern | round 3 fixes | fixed: heading "Prose for people, an intermediate representation for agents"; the term stays linked at its first use in the paragraph |
| 12 | "The chapters are being rewritten one at a time." | lost thread | round 3 fixes | fixed: C8 reads "The chapters are being rewritten to this organization one at a time." |

Claims check after the confirmation fixes: 63 of 63 claims carried in
the render map; C73 is a new split of C58; no claim missing or stale.

## The count paused for ask A7

The count pauses after round 3 for the maintainer's ruling on ask A7.
Round 4 runs after the ruling, with a fresh stranger instance.

Meta-review: not indicated at the pause (signals checked: first, second
and fourth; the count has not ended).

## Ruling taken, 2026-11-03, on PR #161

- A7, option (a) with a correction. The maintainer: aesthetics describes
  the rationale for a decision, not its outcome; whether the decision is
  swappable or foundational depends on what other decisions may depend
  on it. Applied IR first: C36 stands, decided at the ruling. C30 reads
  "Not every decision needs all seven blocks: a decision taken for
  reasons of vision or aesthetics may need fewer." New C74: "The label
  depends only on what other decisions rest on the decision, whatever
  its rationale." New C75, the maintainer's examples, both stated as
  hypothetical choices: "Choosing an offside-rule grammar, where
  indentation marks block ends, for aesthetic reasons would likely be a
  swappable decision, whereas choosing purely functional semantics for
  aesthetic reasons would be a foundational one." Finding 4 of round 3
  is resolved by the ruling.

After the ruling: 65 claims, the render map covering all 65. Round 4
is owed, with a fresh stranger instance.

## Round 4

Words about 1,000, claims 65, findings 6, from a fresh stranger
instance reading ff08496 merged with `origin/main` (b5a59fb). The
restatement was correct. Mismatches: three own (C16's second site
dropped; C4's "aims to" dropped; C43's hedge dropped; no fix) and one
attributed to the prose (G4: "The first rule is dependency order"
implies further rules that no claim gives). Contradictions 0. Undefined
terms 0. Jargon 0. Lost thread 1 (finding 2). Verdict: not readable.

Override comparison by passage. The tour passage, C13 (G5 until this
round's fix, which moved C13 into G3), drew a finding in rounds 1
(findings 1 and 2), 3 (finding 2) and 4 (finding 2). A lost thread is
not covered by the override; the recurrence is recorded so the
maintainer sees it, and this round's fix treats it as a placement
problem rather than wording. The prose mismatch on G4 is the first
mismatch on that passage. The aim sentence C55 (G17) is flagged as
excess for the third round running (round 2's finding 8, round 3's
finding 10, round 4's finding 3), each time declined: a recurring
finding for the maintainer. The separation sentence C73 (G18) was split
at round 3's confirmation on that stranger's finding 7, and round 4's
stranger flags the split (finding 4): the two strangers disagree.

The stranger lost interest at the mixed-files paragraph (G15, read as
process) and asked how the experiments sentence relates to the block
list. No finding was filed on either. The experiments paragraph already
opens "The decision and rationale block may show how a rejected option
fails.", which ties it to block 4; it is left as it stands. The
stranger wanted to read on at the offside-rule example and at the
code-organized claim.

| # | Finding (shortened) | Kind | Origin | Decision |
|---|---|---|---|---|
| M1 | C16's second site | restatement mismatch (own) | stranger | no fix needed |
| M2 | C4's "aims to" | restatement mismatch (own) | stranger | no fix needed |
| M3 | C43's hedge | restatement mismatch (own) | stranger | no fix needed |
| M4 | "The first rule is dependency order" implies a series | restatement mismatch (prose) | stranger | fixed: finding 1 |
| 1 | "The first rule is dependency order" | mismatch | stranger | fixed: C10 reads "Decisions come in dependency order: a decision comes after the decisions it builds on." |
| 2 | the tour paragraph, a promise with no content | lost thread (recurring: rounds 1, 3, 4) | stranger | fixed by placement: C13, C70 merged into C13 and moved into the status paragraph, "A tour of the few large choices that define Allegro, each pointing forward to its full treatment, will open the book once the tour is written."; C15 cut, its dependency order already stated by C10 |
| 3 | "The prose aims to be clear and brief enough to hold your interest." | excess (recurring: rounds 2, 3, 4) | stranger | declined: holding the reader's interest is the stated aim; recorded as recurring for the maintainer |
| 4 | "That separation keeps the narrative on the design and its reasons." | pattern | stranger | declined: round 3's stranger asked for this split (its finding 7); the strangers disagree, recorded for the maintainer |
| 5 | C75 joins the two example choices | compound | stranger | fixed: C75 split into C75 and C76, "Choosing an offside-rule grammar, where indentation marks block ends, for aesthetic reasons would likely be a swappable decision. Choosing purely functional semantics for aesthetic reasons would be a foundational one." |
| 6 | "The explore block of an open decision says…" repeats the referent | excess | stranger | fixed: the prose reads "The explore block says how and where to contribute one."; the IR claim C41 keeps its named referent |

Claims check after the fix pass, against round 4's prose: every claim of
the fixed IR is carried (64 of 64 in the render map, re-numbered for 17
paragraphs). C70 merged into C13; C15 cut; C76 a new split of C75. No
claim reported missing or stale. Prose words after the fixes 965 (by
`wc`).

Confirmation: the round's stranger instance confirmed the fixes of 1, 5
and 6, and accepted the decline of 4. It disputed the decline of 3:
"clear and brief" keeps the aim, and "enough to hold your interest"
adds tone without content. The decline stands, and the finding goes to
the maintainer as ask A8 of the IR. Finding 2 is unfixed: in the status
paragraph, the tour sentence connected to nothing.

| # | Finding (shortened) | Kind | Origin | Decision |
|---|---|---|---|---|
| 3 | "enough to hold your interest" adds tone (disputed at confirmation) | excess | stranger | declined, the dispute recorded: ask A8 (keep the phrase, or cut it to "The prose aims to be clear and brief.") |
| 2 | the tour sentence in the status paragraph connects to nothing (unfixed at confirmation) | lost thread | stranger | fixed by restructuring, not rewording: the tour is described as part of the book's structure in the dependency-order section, C13 "The book opens with a tour of the few large choices that define Allegro, each pointing forward to its full treatment." and C77 "After the tour, the book descends through the decisions in dependency order." (C15's content reinstated under a new number); the status is stated once, folded into C7, "The tour that opens the book is not yet written, and most chapters do not yet follow the organization this preface describes." |

The tour has drawn findings in rounds 1, 3 and 4 and at round 4's
confirmation. The restructuring leaves no sentence that promises: the
structure is described in the present tense of the book's design, and
the status sits once with the other status.

Claims check after the confirmation fixes: 65 of 65 claims carried in
the render map, re-numbered for 18 paragraphs; C77 new; C13 moved; C7
reworded. No claim missing or stale. Prose words 983 (by `wc`).

## Round 5

Words about 1,020, claims 65, findings 11, from a fresh stranger
instance reading fcaf9f1. The restatement was correct, with one own
mismatch and none attributed to the prose. Contradictions 1 (finding 1,
the tour). Undefined terms 0. Jargon 1 (finding 4, the tour). Lost
thread 3 (findings 5 and 6, and the paragraph opening "You are invited
into the design of Allegro", which moves to branching code with no
link; finding 5 covers it). Verdict: not readable. The stranger wanted
to read on at the seven blocks and at the swappable-or-foundational
distinction.

Override comparison by passage. The tour passage drew findings in every
round:

| Round | Cluster | Claims | Findings |
|---|---|---|---|
| 1 | G3, G5 | C9, C13 | 1 (undefined term), 2 (lost thread), 3 (jargon) |
| 3 | G5 | C9, C13 | 2 (lost thread) |
| 4 | G5 | C13, C70 | 2 (lost thread) |
| 4, confirmation | G3 | C13 | 2 unfixed (lost thread) |
| 5 | G3, G5 | C7, C13, C77 | 1 (contradiction), 4 (jargon), 10 (pattern), 11 (excess) |

The structures tried were: a status sentence in the opening (round 1),
a sentence after the tour's description (rounds 1 to 3), a merged
sentence in the dependency-order section (round 3), the tour moved into
the status paragraph (round 4), and the tour described as structure
with its status folded into the status paragraph (round 4's
confirmation). None held. A lost thread, a contradiction and a jargon
finding are outside the override, which counts restatement mismatches;
the recurrence is recorded for the maintainer as ask A9. No restatement
mismatch recurs on one passage across the five rounds.

| # | Finding (shortened) | Kind | Origin | Decision |
|---|---|---|---|---|
| M1 | (the stranger's own) | restatement mismatch (own) | stranger | no fix needed |
| 1 | C13 "The book opens with a tour" against C7 "not yet written" | contradiction | stranger | held: ask A9; the passage stays as it stands |
| 2 | C7 joins the tour's status and the chapters' status | compound | stranger | fixed: split into C7 "The tour that opens the book is not yet written." and C78 "Most chapters do not yet follow the organization this preface describes." |
| 3 | C55 "enough to hold your interest" | excess (recurring: rounds 2 to 5) | stranger | held: ask A8 |
| 4 | "the tour" used in the status paragraph before its description | jargon | stranger | held: ask A9 |
| 5 | C6, branching the code with no link to the explore block | lost thread | stranger | fixed: C6 reads "The code is organized so that you can branch it to try another option for a decision, as the explore block of each decision section shows." (the term linked to its definition) |
| 6 | C49 "Such a file is split when its code is next changed…" | lost thread | stranger | fixed: C49 cut, a maintenance rule and process detail by the principle that process stays outside the book; C48 stands without it; evidence E7 removed with it |
| 7 | heading "Open decisions as invitations" | pattern | stranger | fixed: heading "Open decisions" |
| 8 | C73 "That separation keeps…" | pattern | stranger | declined: round 3's stranger asked for this split and round 4's accepted it; the strangers disagree |
| 9 | C51 joins the definition and the gloss of a claim | compound | stranger | fixed: split into C51 "The form for agents is an intermediate representation, a numbered list of claims." and C79 "Each claim is a single statement with its evidence and pointers into the code." |
| 10 | C77 "After the tour, the book descends…" | pattern (signposting) | stranger | held: ask A9 |
| 11 | C77 repeats "dependency order" | excess | stranger | held: ask A9 |

Claims check after the fix pass, against round 5's prose: 66 of 66
claims carried in the render map; C49 cut; C78 and C79 new splits. No
claim missing or stale. Prose words after the fixes 976 (by `wc`).

The count stops after round 5 at the review session's decision, for the
meta-review below. No confirmation round is run on round 5's fixes; the
next count's round 1 reviews them.

## Meta-review

Written by the reasoning role at the review session's instruction,
2026-11-03, from this record. The methodology's specification places
the meta-review in a session the owner starts; this one is the
reasoning role's analysis for the maintainer, who may dispatch a
meta-review session as well.

**The curve.** Findings per 1,000 words fell from 23.3 (round 1) to
17.5, 10.7 and 6.0 (round 4), then rose to 10.8 at round 5. The fall
was sentence-level: compounds, referents, jargon and patterns fixed and
held. The rise came from passages already fixed in earlier rounds.

**The signals.**

- First signal (a fix not held at confirmation, or a claim reported
  missing or stale, in two or more rounds): fires. Fixes were unfixed
  or disputed at confirmation in round 1 (finding 22), round 2 (finding
  14), round 3 (finding 7) and round 4 (findings 2 and 3).
- Second signal (a declined finding raised again; or a restatement
  mismatch recurring on one passage): fires on its first clause. The
  aim sentence C55 was declined in rounds 2, 3 and 4 and raised again
  in round 5. The separation sentence was declined as a compound in
  round 2 (finding 17), split at round 3's confirmation, then flagged
  in rounds 4 and 5 for the split. No restatement mismatch recurred on
  one passage.
- Third signal: struck by the specification.
- Fourth signal (in round 3 or later, a contradiction in a passage an
  earlier fix touched): fires. Round 3's finding 4 fell on C36 against
  C30, whose cluster round 1's fix touched. Round 5's finding 1 fell on
  C13 and C7, both touched by round 4's fixes.

**Diagnosis.** Three causes remain after the sentence-level findings
converged. First, the tour passage describes a part of the book that
does not exist: every structure either promises content or states a
status that contradicts the structure, so no wording holds (ask A9).
Second, strangers of one brief disagree on tone and on splitting: the
aim sentence and the separation sentence were asked for by one round
and flagged by the next. Third, a reader persona of the human reader,
played by a smaller model, judges engagement inconsistently. The
specification's rounds measure whether a stranger can restate the
text; restatement was correct in every round from 2 on.

**Recommendations.** Rule asks A8 and A9. Take the maintainer's reading
as the test of human readability, as ruling R14 (the human reader) of
the plan provides. For the briefs: a finding declined twice goes to the
owner as an ask at its second raise rather than recurring; a chapter
does not describe a part of the book that is not yet written.

Meta-review: delivered (in this record, written by the reasoning role
at the review session's instruction, 2026-11-03; signals checked: first,
second and fourth, all three firing).

Count 1 closed at round 5 without a readable verdict. The maintainer's
reading is the test of human readability (ruling R14 (the human reader)
of `docs/plans/book-pass.md`). Asks A8 and A9 are open.

## Rulings taken, 2026-11-04, after the merge of PR #161

- A9, option (a). The maintainer: "leave the tour out of the preface
  until it's written." Applied IR first: C7 (the tour's status), C13
  (the tour as the book's opening) and C77 (the descent after the tour)
  cut, with cluster G5 and evidence E2. C78 keeps the chapters' status:
  "Most chapters do not yet follow the organization this preface
  describes." Relation R2 re-pointed to C78. The tour findings of
  rounds 1, 3, 4 and 5 are resolved by the cut.
- A8. C55 reads "The prose aims to be clear, brief and engaging."
  (decided: owner, 2026-11-04). Finding 3 of round 5 and its recurrences
  are resolved by the ruling.

The maintainer's direction, in the same message, verbatim: "The preface
will do for now. At this stage we are making sure the logical structure
of the book holds and the content is correct - we'll work on making it
brief, clear and engaging later."

The count stays closed; no further rounds run now. Every ask of the IR
is ruled. After the rulings: 63 claims, the render map covering all 63,
unratified terms 0.
