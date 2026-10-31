# Review record: the evaluator chapter, rendered from its IR

Text reviewed: `docs/book/allegretto/evaluator.md`, normative text
rendered by the reasoning role from `docs/book/allegretto/evaluator.ir.md`
(134 claims in 32 clusters, 30 terms of which 1 proposed, 9 relations,
41 evidence pointers). Reader of the reviewed text: RD-4 (a fresh agent
session). Reviewer: a stranger, a fresh stranger instance (a smaller
model, dispatched per round) with no conversation context, reading only
the prose, the IR and its brief. Rounds until readable, limit ten (the
methodology's IR specification, Stranger rounds; plan
`docs/plans/book-chapters-now.md` §3.1). Every fix is made in the IR
first; the prose is then re-rendered or edited to match, and the render
map updated.

Lint before round 1: `npm run lint:ir` clean (CK-01 to CK-14 and CK-16;
unratified terms 1); round trip 134 of 134 claims in the render map;
`npm run lint:docs:check` gate passed (anchors 0, order 0, ids 791 at or
below the baseline of 796).

The brief, in short: the stranger reads the prose first and writes a
restatement of the chapter's problem, terms and decisions before opening
the IR. It then compares the restatement with the IR and reports each
finding with its kind (restatement mismatch, contradiction, undefined
term, referent, compound sentence, excess words), the fix kind it needs
(cut, rephrase, add) and its locus (prose, IR, both). The verdict is
readable when the restatement has no mismatch with the IR that counts,
and the stranger finds no contradiction and no undefined term.

## Curve

| Round | Prose words | IR claims | Findings | Per 1,000 words | Verdict |
|---|---|---|---|---|---|
| 1 | 2,317 | 134 | 18 | 7.8 | not readable (contradictions 4, undefined terms 3; restatement mismatches 3, all the stranger's own) |
| 2 | 2,437 | 150 | 10 | 4.1 | not readable (contradictions 2, undefined terms 0; restatement mismatch 1, the stranger's own) |

## Round 1, 2026-10-31

Reviewed commit `b5df05d`: 2,317 prose words by the stranger's count
(code blocks, the §9 table and the render map excluded); IR 134 claims;
18 findings; 7.8 per thousand words. The restatement was written from
the prose before the IR was opened. It had three mismatches with the IR,
on C113, C57 and C22. The stranger attributed all three to its own
restatement and quoted the prose sentence carrying each claim, so none
counts. Contradictions 4 (findings 1 to 4); undefined terms 3 (findings
13 to 15). Verdict: not readable for RD-4. By fix kind as the stranger
judged: add 8, rephrase 10, cut 0; by locus: prose 12, IR 2, both 4.

| # | Finding (shortened) | Kind | Decision |
|---|---|---|---|
| 1 | "one default arm" (C22) against "no default arm" (C23), R1 | contradiction | fixed: the code departs from the rule, so C23 now states the departure ("The switch in `evaluate` departs from the discriminator rule by having no default arm."); the arms moved to C135; R1 reworded |
| 2 | "seven symbols from two Allegro Standard files" against the `src/primitives.ts` import (C119, C128) | contradiction | fixed: C119 scoped to the two files `scripts/analyze/units.json` assigns wholly to Allegro Standard units; C128 says `src/primitives.ts` holds units of three layers; C129 says what "mixed" meant; E42 added |
| 3 | E15 "re-evaluating at `depth + 1` each round" against C83 | contradiction | fixed in the IR: checked against `src/evaluator.ts` (`depth` is not reassigned in the loop; line 793 evaluates every round at `depth + 1`); E15 reworded; C83 stands |
| 4 | "lines 59 to 70" against E26 "lines 56–70" | contradiction | fixed in the IR: E26 now reads lines 59–70, the excerpt's extent; lines 56–58 are a comment the excerpt leaves out |
| 5 | "design truth", Tier 1 and the status tags against the IR's `Status: draft` and proposed claims | mismatch | declined: the tier and the tags are properties `docs/book/process.md` §1 and `docs/book/README.md` give every chapter, holding from the merge, which is also the bulk ratification of the proposed claims (plan §3.1); the IR's Status records the review count, a different question. The prose now cites both definitions (finding 14) |
| 6 | C23 joins the kinds, the arms and the missing default arm | compound | fixed: split into C23 and C135 (with finding 1) |
| 7 | C131 lists three rulings in one sentence | compound | fixed: split into C131 (the count), C136, C137, C138 (one ruling each) |
| 8 | C46 "decides ... and installs" | compound | fixed: split into C46 (decides) and C139 (installs) |
| 9 | C48 "evaluates both branches and residualises" | compound | fixed: C48 rephrased, "returns a residual over both of its evaluated branches" |
| 10 | T30's definition, 38 words | compound | fixed: T30 keeps the meaning; how the evaluator runs a tail call is the new claim C140 |
| 11 | C99 "sets ... and restores ..., also on error" | compound | fixed: C99 keeps the restore alone, C98 holds the set |
| 12 | "residualises" | excess | fixed with finding 9 |
| 13 | `TailCall` sentinel used in §2 without a link | undefined term | fixed: the first use links `#def-tail-call` |
| 14 | "Tier 1 authority" neither defined nor cited | undefined term | fixed: C6 cites `docs/book/process.md` §1, linked at "Tier 1"; C150 added for the status tags `docs/book/README.md` defines |
| 15 | "the Part I chapters" neither defined nor cited | undefined term | fixed: linked to Part I of the table of contents, `docs/book/README.md` |
| 16 | "§9.7 (finding 4)": the parenthetical is not a name | identifier | fixed: the pointer is cut from the prose; E41 keeps it |
| 17 | the §9 table has no IR claim behind it | mismatch | fixed: C141 to C149 in cluster G33 render as the table, with E43 and E44; the `src/primitives.ts` row split into three rows, one per pinning test; `ensures_check` left out, no single test pins it |
| 18 | C86 gives no reason; R6 does | mismatch | fixed: C86 carries the reason, "because the binding's `if` or `when` Expression is unmarked"; R6 corrected, since the branch body is marked and the binding's Expression is not |

Fixes after round 1: IR 134 to 150 claims (four splits adding six
claims: C135, C136 to C138, C139, C140; C150 for the status tags; C141
to C149 for the §9 table); clusters 32 to 33; relations 9, R1 and R6
reworded; evidence 41 to 44 (E42 to E44 added, E15 and E26 corrected);
prose 2,317 to 2,402 words (same method: code blocks, the §9 table and
the render map excluded). Lint clean; round trip 150 of 150.

The round 1 stranger instance was lost to a container restart before
confirmation, so no fix of round 1 carries a confirmation mark. Round
2's stranger reviews the fixed text.

## Round 2, 2026-10-31

Reviewed commit `e8bd66e`: 2,437 prose words by the stranger's count
(code blocks, the §9 table and the render map excluded); IR 150 claims;
10 findings; 4.1 per thousand words. The restatement was written from
the prose before the IR was opened. It had one mismatch with the IR, on
C113 and C114. The stranger attributed it to its own restatement and
quoted the §7 sentences carrying both claims, so it does not count.
Contradictions 2 (findings 1 and 2); undefined terms 0. Verdict: not
readable for RD-4. Both contradictions were checked against
`src/evaluator.ts` and `docs/book/units.md` §3.2 before the decision.

| # | Finding (shortened) | Kind | Decision |
|---|---|---|---|
| 1 | PE Rule 1 (C35) against "a composed function applied to an unresolved argument is unfolded" (C44) | contradiction | fixed: new C154, "When `applyComposed` unfolds a composed function, PE Rule 1 applies to the applications inside the body, not to the composed application itself."; R3 now reads C154 refines C35 because C44 |
| 2 | R1: "one default arm" (C22) against "no default arm" (C23): owed, accepted or a defect? | contradiction | fixed: the code departs from a ratified rule; new C151, "Nothing counts the missing default arm of the switch in `evaluate`, because the `units` report's discriminator count skips the `evaluator` unit.", with E45; no document names an owner, so none is stated; R1 now relates C23 to C153 |
| 3 | C22 joins the rule's scope and its default arm | compound | fixed: split into C22 (the scope) and C153 (the default arm) |
| 4 | C29 "applied by `applyComposed`, or returned as a tail call" | compound | fixed: C29 rephrased, "applied by `applyComposed`, except in an Expression that `markTailCalls` marked (§5)"; C79 holds the marked case |
| 5 | C61 "hands back three things: …; …; …" | compound | fixed: C61 rephrased, "A call binding hands back the body's scope, the substituted arguments and a finisher for the body's result." |
| 6 | C68 joins `carryMeta` and `PRESERVED_FN_META_KEYS` | compound | fixed: split into C68 (`carryMeta`) and C156 (`PRESERVED_FN_META_KEYS`) |
| 7 | the reader block's 41-word sentence of ten links | compound | fixed: a shorter sentence, "Earlier chapters define the terms used here without definition, each linked at its first use:", then the ten links as a list |
| 8 | C135 repeats the five kinds of C13 | excess | fixed: C135 cut |
| 9 | C85 "applied at once" | excess | fixed: "applied immediately" in C85, R6 and E5 |
| 10 | C57 is inferred (R2); the prose states it as a plain fact | mismatch | fixed: the prose sentence opens with "So", marking the consequence |

Fixes after round 2: IR 150 to 153 claims (two splits adding C153 and
C156; C151 and C154 added for the two contradictions; C135 cut);
clusters 33; relations 9, R1 and R3 reworded; evidence 44 to 45 (E45
added); prose 2,437 to 2,466 words (same method: the stranger's count
plus the change measured on the diff, +29). Lint clean; round trip 153
of 153.

Confirmation: pending
