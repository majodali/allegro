# Meta-review: the evaluator chapter's count 1

> **Record.** Reader: RD-2 (the owner returning after a gap). Form: W-008 (reports map their deliverables).
> Subject: count 1 of the evaluator chapter under B-170 (the book, Part II and III chapters writable now), in
> `docs/book/allegretto/evaluator.review.md`. Author: a fresh session
> with no part in the rounds (PR #129, ask 4).

## Asks

1. Rule on round 7's verdict. This review finds it not readable: M5 (the omitted meaning of *tail call*)
   counts under the override, so the count should have continued to
   round 8. Default: the record marks round 7 not readable, the merged
   chapter stays, and its next edit, which three unfixed defects already
   require, runs count 2 with the briefs of ask 2.
2. Approve recommendations 1, 4, 5, 6, 8 and 9 for this project's briefs
   and record form. Default: approved, from count 2 on.
3. Approve filing recommendations 2, 3 and 7 as proposals in the
   methodology repository. Default: approved, one proposal each.
4. Ratify or strike the two terms under *Terms introduced*. Default:
   struck after count 2.

## What is already covered

- The record's signal check holds: 1, 2 and 4 fired; 3 did not (15.3
  words per claim against 17.3).
- The record states both readings of round 7 and their consequences.
- The record names the two lost instances and the three defects left.

## What changed

### 1. The three fired signals

**Signal 1.** Five fixes were not held: round 2 findings 2 and 3, round 3
finding 5, round 7 finding 2 and touch-up edit A. Four sit in cluster
G7, the discriminator-rule passage. Three were mechanical: the fixed text
kept the joined clauses, a bare section number or the quoted phrase. A
re-read of the finding's quoted words would have caught them. Round 2
finding 2 and edit A needed rulings outside the chapter: the defect's
owner, and `docs/book/units.md` §3.2, which calls a Structure inert while
`evaluateExpr` applies its constructor.

**Signal 2.** Recurrence fell on C113, T30 and the PE Rule 1 passage,
which also drew contradictions in rounds 2, 4 and 6. The cause is IR
structure: at round 1 the rule, C35, and its exception, C44, sat in
different clusters. R3 (C154 refines C35) carried the link, and relations do not render.
Rounds 2 and 4 added qualifying claims, C154 and C161, without naming the
exception. Round 6 named it, "The exception to PE Rule 1 is …", and round
7 found no contradiction.

One recurrence went unrecorded: round 3's mismatch on C158 fell in G7,
beside round 1's on C22. Round 3 was not readable anyway.

**Signal 4.** Fix-written text is the claims and sentences an earlier
round's fix wrote or rewrote. Of the 52 findings of rounds 2 to 7, by
this review's reading, 25 fell on fix-written text (per round 2, 6, 5, 5,
3, 4) and 27 on original text. Five of the eight contradictions fell
there, as did all eleven defects noted at confirmation. Fix-written text is only 66 of
the 167 delivered claims (35 added, 31 rephrased), fewer earlier.

### 2. The reading at round 7

The reading is right in general and wrong for M5. The specification's
first condition concerns "the restatement of the problem, terms and
decisions". A required element is the text's problem, a term it defines,
or a decision it states it executes. Omitting any other claim is a
compression the 200-word bound forces. If that counted, no text of 165
claims could pass the override. Omitting a required element is a
disagreement about what the text defines or decides. M5 omits the meaning
of T30, the chapter's only defined term. T30's passage carried mismatches
in rounds 4 and 5, so the override counts M5. M2 (the omitted discriminator-rule defect) and M4 (the omitted PE Rule 1 detail)
are compressions. Round 7 is therefore not readable.

Proposed wording: "An omission is a restatement mismatch when the
restatement leaves out the text's problem, a term the text defines, or a
decision the text states it executes; leaving out any other claim is not
a mismatch."

### 3. The curve

Contradictions fell 4, 2, 2, 2, 1, 1, 0: the verdict's conditions
converged. Findings per thousand words held between 2.8 and 3.9 after
round 2. Fix-written text yielded three to six a round from round 3;
original text yielded 8, 3, 3, 2, 7, 4. Words per claim fell from 17.3 to
15.3, as splits outran the prose's growth. The rounds removed the
original text's contradictions; much of the rest moved into the fixes'
own words.

### 4. The lost instances

Rounds 1 and 5 lost the confirmation of 18 and 7 fixes. A fresh stranger
catches a defect a fix wrote, not a fix that missed its finding. Round 1
finding 1's fix missed: the contradiction returned as round 2 finding 2. Round 7 finding 3 fell on round 5's split of C158,
which round 5's instance could have checked. Signal 1 cannot fire on a
lost round. The next rounds caught written defects a round late, and
missed fixes not at all.

### 5. Recommendations

1. Stranger brief, step A: require the restatement to carry each required
   element. Reason: it removes round 7's ambiguity.
2. Specification, "The verdict" (a proposal): add the wording proposed in
   part 2. Reason: "a disagreement" alone leaves omission to each
   orchestrator.
3. Specification (a proposal): compare passages for the override by
   cluster id. Reason: the record compared claims in round 3 and clusters
   in round 7.
4. Reasoning-role brief: state a departure from a decided rule as a claim
   right after the rule, in its cluster, named as the exception. Reason: a
   relation does not render, and the PE Rule 1 passage held only once
   round 6 did this.
5. Reasoning-role brief: before relaying a fix, check that the finding's
   quoted words are gone or answered. Reason: three of the five fixes not
   held left the flagged words in the text.
6. This project's adoption of W-009 (the methodology corpus writes its deliverables IR first), plan §3.1: send a finding that needs
   a source's ruling to the owner as an ask, and leave the passage until
   then. Reason: round 2 finding 2 and edit A could not hold without one.
7. Specification (a proposal): when a round's instance is lost, a fresh
   instance given the round's findings, the fix diff and the prose
   confirms each fix. Reason: round 1's missed fix surfaced a round
   late.
8. This project's review record: mark each finding's origin, original text
   or the fix of round n. Reason: signal 4's count had to be rebuilt by
   hand.
9. Stranger brief, step D: have the reasoning role, not the stranger,
   apply the override from the record. Reason: the brief's condition 1
   omits the override, and the record miscounted round 2.

## Terms introduced

- **Fix-written text**: IR claims and prose sentences that an earlier
  round's fix wrote or rewrote.
- **Required element**: the text's problem, a term the text defines, or a
  decision the text states it executes, as a restatement must carry them.
