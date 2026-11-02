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
| 2 | 2,437 | 150 | 10 | 4.1 | not readable (contradictions 2, undefined terms 0; restatement mismatch on C113 counts under the override) |
| 3 | 2,444 | 155 | 9 | 3.7 | not readable (contradictions 2, undefined terms 0; restatement mismatches 2, both the stranger's own) |
| 4 | 2,490 | 157 | 8 | 3.2 | not readable (contradictions 2, undefined terms 0; restatement mismatch on C154 counts under the override) |
| 5 | 2,544 | 159 | 7 | 2.8 | not readable (contradictions 1, undefined terms 0; restatement mismatch 1, the stranger's own, on T30: the same passage as round 4's M1, so it counts under the override) |
| 6 | 2,550 | 165 | 10 | 3.9 | not readable (contradictions 1, undefined terms 0; restatement mismatches 6, all the stranger's own; the one on C44 counts under the override) |
| 7 | 2,561 | 165 | 8 | 3.1 | readable (contradictions 0, undefined terms 0; restatement mismatches 5, the stranger's own: one disagreement on C95 on no earlier passage, four omissions) |

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

Claims check before round 2: round trip 150 of 150 claims, 0 missing, 0
stale (the render map and the re-read of changed passages, run after the
fixes).

The round 1 stranger instance was lost to a container restart before
confirmation, so no fix of round 1 carries a confirmation mark. Round
2's stranger reviews the fixed text.

## Round 2, 2026-10-31

Reviewed commit `e8bd66e`: 2,437 prose words by the stranger's count
(code blocks, the §9 table and the render map excluded); IR 150 claims;
10 findings; 4.1 per thousand words. The restatement was written from
the prose before the IR was opened. It had one mismatch with the IR, on
C113 and C114. The stranger attributed it to its own restatement and
quoted the §7 sentences carrying both claims. The mismatch falls on the
passage of round 1's mismatch on C113, so the specification's override
counts it whatever its attribution. Before a correction made after
round 4, this record said the mismatch did not count. Contradictions 2
(findings 1 and 2); undefined terms 0. Verdict: not readable for RD-4.
Both contradictions were checked against `src/evaluator.ts` and
`docs/book/units.md` §3.2 before the decision.

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

Confirmation, by the round's stranger on commit `8a7dcf2`: findings 1
and 4 to 10 confirmed. Finding 2 unfixed: R1 still read "C23
contradicts C153", C151 only explains why the gap goes uncounted, and
the prose never says whether the departure is owed, accepted or a
defect. Finding 3 unfixed: C153 still joined the naming claim and the
default-arm claim. New defects in the changed passages, three:

- the C61 sentence, "the body's scope", is less precise than "the
  scope the body evaluates in", and reads as a scope the body owns
  (referent);
- the C68 and C156 sentences repeat the subject "A copied composed
  function keeps" (excess);
- R3, "C154 refines C35 because C44", gives no reason (mismatch).

Touch-up after confirmation, five edits, IR first, then prose and
render map:

1. Finding 2: new C158, inferred from R1, "The missing default arm in
   `evaluate` is a defect against the discriminator rule, which no
   backlog item owns." R1 now derives it: "C158 depends-on C23 because
   C23 departs from the ratified C157, and no backlog item names the
   missing default arm." C151 stays as the reason nothing counts it.
   Checked against the switch in `evaluate` (`src/evaluator.ts` lines
   376–426, seven arms, no default) and `docs/book/units.md` §3.2
   rule 3; `docs/backlog.md` names no item for it.
2. Finding 3: C153 split. C153, "Under the discriminator rule, the
   evaluator's switch must name only the participating kinds."; new
   C157, "The inert rest of the kinds must fall to one default arm of
   the evaluator's switch."
3. C61: "A call binding hands back the scope the body evaluates in,
   the substituted arguments and a finisher for the body's result."
4. C156: "`PRESERVED_FN_META_KEYS` names the function properties that
   a copied composed function keeps."
5. R3: "C154 refines C35 because `applyComposed` unfolds the composed
   application (C44), so the applications PE Rule 1 governs are the
   ones inside the body."

Counts after the touch-up: IR 153 to 155 claims (C157, C158); clusters
33 (G7 gains both); relations 9 (R1 and R3 reworded); evidence 45;
prose 2,466 to 2,496 words (the stranger's method, +30 measured on the
diff). Lint clean; round trip 155 of 155.

Claims check before round 3: round trip 155 of 155 claims, 0 missing, 0
stale (the render map and the re-read of changed passages, run after the
fixes).

## Round 3, 2026-10-31

Reviewed commit `ec8fec9`: 2,444 prose words by the stranger's count
(code blocks, the §9 table, link targets and the render map excluded);
IR 155 claims; 9 findings; 3.7 per thousand words. The restatement was
written from the prose before the IR was opened. It had two mismatches
with the IR, on C154 and C158. The stranger attributed both to its own
restatement and quoted the prose sentence carrying each claim, so
neither counts. Contradictions 2 (findings 1 and 2); undefined terms 0.
Verdict: not readable for RD-4. Finding 2 was checked against
`src/primitives.ts`, `scripts/analyze/units.json`, `docs/book/units.md`
§4.1 and the `units` report before the decision.

| # | Finding (shortened) | Kind | Decision |
|---|---|---|---|
| 1 | "Earlier chapters define the terms used here without definition" | contradiction | fixed: C132 rephrased, "Earlier chapters define every term this chapter uses except tail call, each term linked at its first use." |
| 2 | the edges to `src/primitives.ts` "unjudged" (C129) against `base-primitives` "above the `evaluator` unit" (C130) | contradiction | fixed: C129 now says the report counts the edges as unresolved, not as violations; new C159, inferred from the new R10, "The import of `renderExprSource` is an edge the unit DAG forbids, uncounted by the `units` report until `src/primitives.ts` is split."; E46 added (`renderExprSource` at `src/primitives.ts` line 42, inside the lines 23–1197 that `base-primitives` holds, a unit that depends on `evaluator`) |
| 3 | C8 joins the excerpt claim and the suite-run claim | compound | fixed: split into C8 (the excerpts, evidence E25, E26, E37) and C160, "The suite runs both example files, `tests/functions.alg` and `tests/logical.alg`, against their `// expect:` lines." |
| 4 | T30 is proposed; the prose defines *tail call* with no marker | mismatch | declined: a chapter's prose carries no provenance markers, which live in the IR, and the term is ratified at the chapter PR's merge with A2 and the IR's proposed claims (plan §3.1) |
| 5 | "tail call (§5)" in the reader block | identifier | fixed: "(§5)" cut; the link names the target |
| 6 | "Tier 1 authority, the authority `process.md` §1" | excess | fixed: C6 rephrased, "This chapter carries the Tier 1 authority that `docs/book/process.md` §1 gives every chapter of the book." |
| 7 | C122's scope facts repeat C16 of §2 | excess | fixed: C122 now ends "plus the scope facts of §2." |
| 8 | "owns the channel-registration hook" repeats the noun | excess | fixed in the prose: "owns that hook"; C114 keeps the full noun, since each claim names its referents |
| 9 | "B-112 ruling" three times | excess | fixed in the prose: the second and third sentences read "A second ruling" and "A third ruling"; C137 and C138 keep the name, since each claim names its referents |

Fixes after round 3: IR 155 to 157 claims (C8 split adding C160; C159
added for the contradiction; C6, C122, C129 and C132 rephrased);
clusters 33 (G2 gains C160, G32 gains C159); relations 9 to 10 (R10
added); evidence 45 to 46 (E46 added); prose 2,444 to 2,467 words (same
method: the stranger's count plus the change measured on the diff,
+23). Lint clean; round trip 157 of 157.

Confirmation, by the round's stranger on commit `4b4ae38`: findings 1
to 3 and 6 to 9 confirmed. Finding 4 withdrawn by the stranger on the
reason given: the definition ships only with the merged chapter, after
A2 ratifies it, so it no longer counts. The stranger quoted the prose:
"A **tail call** is an application of a composed function whose result
is the result of the function body that contains the application."
Finding 5 unfixed: cutting "(§5)" from the reader block moved the first
use of §5 to the §2 sentence of C20, "`TailCall` sentinel (§5)", still
with no name after it. New defects in the changed passages, one:

- C129 and its §8 sentence say the `units` report counts the edges to
  `src/primitives.ts` as unresolved, while C159 and its sentence call
  the `renderExprSource` edge to the same file "uncounted by the
  `units` report" (contradiction).

Touch-up after confirmation, two edits, IR first, then prose and render
map:

1. Finding 5: C20 and its sentence give §5 its name on the same line,
   "except when the result is a `TailCall` sentinel (§5 (tail call))."
   No later first use of a section number is bare: the second "(§5)",
   in the C29 sentence, follows the named first use, and §8 names §2 as
   "§2 (evaluation)".
2. The new defect: C159 takes C129's vocabulary, "The import of
   `renderExprSource` is an edge the unit DAG forbids, not counted as a
   violation by the `units` report until `src/primitives.ts` is split."
   R10 now ends "C129 says why the report does not count the edge as a
   violation."

Counts after the touch-up: IR 157 claims; clusters 33; relations 10
(R10 reworded); evidence 46; prose 2,467 to 2,473 words (the stranger's
method, +6 measured on the diff). Lint clean; round trip 157 of 157.

Claims check before round 4: round trip 157 of 157 claims, 0 missing, 0
stale (the render map and the re-read of changed passages, run after the
fixes).

## Round 4, 2026-10-31

Reviewed commit `9fa137c`: 2,490 prose words by the stranger's count
(`wc -w` with link targets counted; code blocks, the §9 table and the
render map excluded); IR 157 claims; 8 findings; 3.2 per thousand words.
The restatement was written from the prose before the IR was opened. It
had two mismatches with the IR, on T30 and on C154 with C44. The
stranger attributed both to its own restatement and quoted the prose
sentence carrying each claim. The mismatch on C154 falls on the passage
of round 3's mismatch on C154, so the specification's override counts it
whatever its attribution. That recurrence is the second meta-review
signal of the specification's Meta-review section. The first signal has
also fired: a fix was not held at confirmation in rounds 2 and 3. The
`Meta-review:` line is written at the end of the count. Contradictions 2
(findings 1 and 2); undefined terms 0. Verdict: not readable for RD-4.
Finding 1 repeats round 2's finding 1 on the same passage: the
PE Rule 1 sentence read against the unfolding sentence, with round 2's fix, C154, two sentences after the
rule. Findings 1 and 2 were checked against `applyPrimitive`,
`applyComposed` and the inline cutoff in `src/evaluator.ts` before the
decision.

| # | Finding (shortened) | Kind | Decision |
|---|---|---|---|
| 1 | PE Rule 1 "an application with an unresolved argument produces a residual" against "a composed function applied to an unresolved argument is unfolded" | contradiction | fixed: new C161 directly after the rule, "The evaluator applies PE Rule 1 at an eager primitive application and at an unresolved function position."; C44 and C154 moved into the rule's cluster G9; C154 rephrased, "In an unfolded body, PE Rule 1 applies to each application the body contains.", its "not to the composed application itself" cut, since the cutoff residual of C45 is one |
| 2 | "is unfolded" against "a call into a recursion cycle … is not unfolded" | contradiction | fixed: the condition is in C44, "A composed function applied to an unresolved argument is unfolded into its substituted body, unless the call enters a recursion cycle during a typed compilation."; C45 rephrased, "For a call into a recursion cycle with an unresolved argument during a typed compilation, `applyComposed` returns a residual carrying the callee's effects." |
| 3 | "an edge the unit DAG forbids": the prose never puts `renderExprSource` in `base-primitives` | mismatch | fixed: new C162, "`renderExprSource` lies inside the lines of `src/primitives.ts` that the `base-primitives` unit holds.", evidence E46; R10 now derives C159 from C162 and C130 |
| 4 | the six decisions of §1 in one sentence | compound | fixed in the prose: the six decisions are a list ending §1's paragraph, G3 reordered to C10, C11, C9; C9 is already a list after a colon |
| 5 | the aborts sentence joins a count and a cause | compound | fixed: split into new C163, "No abort that `src/evaluator.ts` raises is caused by an unresolved input.", and C34, "`src/evaluator.ts` raises three aborts during evaluation:", the three as a list |
| 6 | C159 joins the DAG rule and the report | compound | fixed by a cut: C159 reads "The unit DAG forbids the `evaluator` unit's import of `renderExprSource`."; C129 already states the report half and now follows C159 in G32 |
| 7 | "departs from the discriminator rule by having no default arm" before "a defect against the discriminator rule" | excess | fixed: C23 cut; C158 carries its fact, "The switch in `evaluate` has no default arm, a defect against the discriminator rule that no backlog item owns.", evidence E3; R1 now reads C158 depends-on C157 |
| 8 | "whose result is the result of the function body that contains the application" | excess | fixed: T30 and its sentence, "A **tail call** is an application of a composed function whose result is the enclosing function body's result."; "its enclosing body" not taken, since "its" can be read as the called function |

Fixes after round 4: IR 157 to 159 claims (C161, C162 and C163 added;
C23 cut; C34, C44, C45, C154, C158 and C159 rephrased; clusters 33 to
34, the eager-primitive claims moving from G9 to G34; relations 10, R1
and R10 reworded; evidence 46); prose 2,490 to 2,485 words (same method,
list markers excluded). Lint clean; round trip 159 of 159.

Confirmation, by the round's stranger on commit `74b0daf`: findings 1
to 8 confirmed. New defects in the changed passages, two:

- the C129 sentence no longer says whether the `units` report counts the
  forbidden `renderExprSource` import, so it reads as a tension with the
  C159 sentence, "The unit DAG forbids", before it (mismatch);
- the C158 sentence's "has no default arm" and the C151 sentence's
  "missing default arm" repeat one point within two sentences (excess).

Touch-up after confirmation, two edits, IR first, then prose; the render
map is unchanged, since no claim moved:

1. C129 links the report to the forbidden edge: "Until
   `src/primitives.ts` is split, the `units` report counts the
   `renderExprSource` edge, like every edge to `src/primitives.ts` or
   `src/types.ts`, as unresolved rather than as a violation, because
   `scripts/analyze/units.json` maps each of the two files to several
   units." (36 words.)
2. C151 no longer restates the missing default arm. The IR reads
   "Nothing counts the defect of the switch in `evaluate` against the
   discriminator rule, because the `units` report's discriminator count
   skips the `evaluator` unit."; the prose, after the C158 sentence,
   reads "Nothing counts that defect, because the `units` report's
   discriminator count skips the `evaluator` unit."

Counts after the touch-up: IR 159 claims; clusters 34; relations 10;
evidence 46; prose 2,485 to 2,488 words (the stranger's method, +3
measured on the diff). Lint clean; round trip 159 of 159.

Claims check before round 5: round trip 159 of 159 claims, 0 missing, 0
stale (the render map and the re-read of changed passages, run after the
fixes).

## Round 5, 2026-10-31

Reviewed commit `a3f5d75`: 2,544 prose words by the stranger's count
(`wc` with markup tokens such as `>` and list dashes counted; code
blocks, the §9 table and the render map excluded); IR 159 claims; 7
findings; 2.8 per thousand words. The restatement was written from the
prose before the IR was opened. It had one mismatch with the IR, on T30:
the restatement dropped "of a composed function" from the definition of
*tail call*. The stranger attributed it to its own restatement and
quoted the prose sentence carrying T30. The mismatch falls on the
passage of round 4's mismatch on T30, so the specification's override
counts it whatever its attribution. That recurrence on one passage in
two rounds is again the second meta-review signal of the specification's
Meta-review section; the `Meta-review:` line is written at the end of
the count. Contradictions 1 (finding 1); undefined terms 0. Verdict: not
readable for RD-4. Finding 1 was checked against `evaluate`,
`evaluateExpr` and `applyComposed` in `src/evaluator.ts` before the
decision: `evaluate` is declared to return `Value`, its Expression arm
passes the sentinel `evaluateExpr` makes for a marked Expression through
with a cast, and `applyComposed` catches it.

| # | Finding (shortened) | Kind | Decision |
|---|---|---|---|
| 1 | "`evaluate` … returns a value" (C12) against "A `TailCall` sentinel is a host object, not a value" (C80) | contradiction | fixed: C12 split; C12 keeps the inputs, "`evaluate` in `src/evaluator.ts` takes a value, a scope, a depth and an optional dependency collector."; new C169, "`evaluate` returns a value, or a `TailCall` sentinel for an Expression that `markTailCalls` marked (§5 (tail call))."; C20 drops its "(§5 (tail call))", now named at C169; C80 unchanged |
| 2 | C158 joins the missing default arm, the defect and the ownership | compound | fixed: split into C158, "The switch in `evaluate` has no default arm.", proposed with E3; new C164, "The missing default arm of the switch in `evaluate` is a defect against the discriminator rule.", inferred from R1; new C165, "No backlog item owns the defect of the switch in `evaluate` against the discriminator rule.", with the new E48; R1 now derives C164 |
| 3 | C129's sentence, 36 words, joins the reporting rule to its cause | compound | fixed: split into new C166, "The `units` report counts an edge as unresolved when `scripts/analyze/units.json` maps the file at either end to several units.", with the new E47, and C129, "Until `src/primitives.ts` is split, the `units` report counts the `renderExprSource` edge as unresolved, not as a violation."; R9 reworded |
| 4 | the §9 table's first "Pinned by" cell joins two claims with a semicolon | compound | fixed: C141 split; C141 keeps the whole suite; new C167, "`tests/functions.alg` and `tests/logical.alg`, run through `src/test/types-core.ts` and `src/test/grammar2-language.ts`, pin the application and tail-call paths of `src/evaluator.ts` that §4 (application and substitution) and §5 quote.", a row of its own |
| 5 | PE Rule 1's sentence joins residual production and propagation | compound | fixed: split into C35, "PE Rule 1 says that an application with an unresolved argument produces a residual.", and new C168, "Under PE Rule 1, metadata fields propagate onto the residual per their rules.", both decided from `docs/book/concepts.md` §25; the spine's sentence cuts cleanly before "with metadata fields" |
| 6 | the C45 sentence repeats the recursion-cycle condition of the C44 sentence | excess | fixed: G11 reordered to C46, C139, C45; C45 rephrased, "For a call that the inline cutoff stops, `applyComposed` returns a residual carrying the callee's effects."; R4 now names the calls the cutoff stops |
| 7 | "The B-112 rulings executed are three." then "One", "A second", "A third" | excess | fixed: C131 rephrased, "This chapter executes three B-112 rulings."; the prose reads "The chapter executes three B-112 rulings. The first ruling …", "The second ruling …", "The third ruling, of 2026-10-22, …" |

Fixes after round 5: IR 159 to 165 claims (five splits adding six
claims: C164 and C165 from C158, C166 from C129, C167 from C141, C168
from C35, C169 from C12; C45 and C131 rephrased); clusters 34, G11
reordered; relations 10, R1, R4 and R9 reworded; evidence 46 to 48
(E47 and E48 added); prose 2,544 to 2,555 words (same method: the
stranger's count plus the change measured on the diff, +11). Lint clean;
round trip 165 of 165.

Claims check before round 6: round trip 165 of 165 claims, 0 missing, 0
stale (the render map and the re-read of changed passages, run after the
fixes).

The round 5 stranger instance was lost to a container restart before
confirmation, so no fix of round 5 carries a confirmation mark. Round
6's stranger reviews the fixed text.

## Round 6, 2026-10-31

Reviewed commit `be688c4`: 2,550 prose words by the stranger's count
(whitespace tokens; code blocks, the §9 table and the render map
excluded); IR 165 claims; 10 findings; 3.9 per thousand words. The
restatement was written from the prose before the IR was opened. It had
six mismatches with the IR, all attributed by the stranger to its own
restatement, each with the prose sentence carrying the claim quoted: M1
on C44 (the restatement had PE Rule 1 cover the unfolded applications),
and five omissions, on C22 with C153, C157 and C164, on C151, on C9, on
C57 and on C127. M1 falls on the passage of round 4's mismatch on C154
with C44, so the specification's override counts it whatever its
attribution. Contradictions 1 (finding 1); undefined terms 0. Verdict:
not readable for RD-4. Finding 1 is the third stranger's contradiction
on the PE Rule 1 passage (rounds 2, 4 and 6). The two earlier fixes
added qualifying sentences after the rule (C154 in round 2, C161 in
round 4), so this round's fix is structural: the rule's scope as
implemented and its exception follow the rule directly, and the word
"exception" is stated. Finding 1 was checked against `applyComposed` in
`src/evaluator.ts` before the decision: the loop evaluates the
arguments, then substitutes and evaluates the body whatever their
resolution, except for a viral argument or a call the inline cutoff
stops. Finding 9 was checked against the prose before the decision.

| # | Finding (shortened) | Kind | Decision |
|---|---|---|---|
| 1 | PE Rule 1 "produces a residual" (C35) against "is unfolded into its substituted body" (C44) | contradiction | fixed: G9 reordered to C35, C161, C44, C154, C168; C161 rephrased, "As implemented, PE Rule 1 governs an eager primitive application and an application whose function position is unresolved."; C44 rephrased, "The exception to PE Rule 1 is a composed function applied to an unresolved argument, which `applyComposed` unfolds into its substituted body unless the call enters a recursion cycle during a typed compilation."; C154 "applies to" becomes "governs"; "instead of residualising" not taken; R3 kept as the refinement |
| 2 | C81 "catches a sentinel … and loops" | compound | fixed: C81 rephrased as one conditional, "When the body that `applyComposed` evaluates returns a `TailCall` sentinel, `applyComposed` loops with the sentinel's function and arguments." |
| 3 | C79 "is not applied: `evaluateExpr` evaluates … and returns" | compound | fixed by a cut: C29 already says a marked Expression is the exception to `applyComposed`; C79 reads "In a marked Expression, `evaluateExpr` returns a `TailCall` sentinel holding the composed function in function position and the evaluated arguments." |
| 4 | C102 "write in place …, called by `src/runtime.ts` before …" | compound | fixed: C102 rephrased, "`markTailCalls` and `markPatternBinders` write in place into a file's own values before `src/runtime.ts` evaluates the file." |
| 5 | C7 lists four decisions in one sentence | compound | fixed in the prose: C7 is a list after a colon, "This chapter executes the following decisions:", one decision per item, each identifier's name on its line |
| 6 | C126 "…, plus the post-call `type` stamp" | compound | fixed in the prose: C126 is a list after "Two paths carry a field by name:", one path per item; the IR's "plus" becomes the list's semicolon |
| 7 | C51 "…, with the primitive's own effect tags" | compound | fixed: C51 rephrased on C40's form, "A lazy primitive's result carries the union of the primitive's own effect tags and the effects of every evaluation made through the primitive's evaluation function." |
| 8 | C66 "an unchanged subtree itself" | excess | fixed: "itself" cut, "Substitution returns an unchanged subtree, not a copy." |
| 9 | "representation kind" in the reader list, unused | excess | declined: the body uses the term in its short form, linked from the reader list, for instance the §2 heading "Evaluation, one switch over the kinds", "`isResolved` answers true for every other kind" and "A function position that evaluates to no applicable kind" |
| 10 | C162 "lies inside the lines of `src/primitives.ts` that the `base-primitives` unit holds" | excess | fixed: C162 reads "`renderExprSource` belongs to the `base-primitives` unit."; E46 keeps the lines |

Fixes after round 6: IR 165 to 165 claims (C7, C44, C51, C66, C79, C81,
C102, C126, C154, C161 and C162 rephrased; no claim added or cut;
clusters 34, G9 reordered; relations 10; evidence 48); prose 2,550 to
2,554 words (same method: the stranger's count plus the change measured
on the diff, +4, list markers counted). Lint clean; round trip 165 of
165.

Confirmation, by the round's stranger on commit `458aa50`: findings 1
to 8 and 10 confirmed; finding 9 withdrawn by the instance on the reason
given, quoting the body's uses of the short form "kind", so it no
longer counts. New defects in the changed passages: none. No touch-up;
round 7 reviews this text.

Claims check before round 7: round trip 165 of 165 claims, 0 missing, 0
stale (the render map and the re-read of changed passages, run after the
fixes).

## Round 7, 2026-10-31

Reviewed commit `f233a10`: 2,561 prose words by the stranger's count
(`awk` and `wc -w`; code blocks, the §9 table and the render map
excluded); IR 165 claims; 8 findings; 3.1 per thousand words. The
restatement was written from the prose before the IR was opened. The
stranger reported five restatement mismatches, all attributed to its own
restatement, each with the prose sentence carrying the claim quoted: M1
on C95 (the restatement narrowed the in-place rule of C94 to scopes),
and four omissions, on C153 with C157, C158, C164 and C165 (M2), on C7,
C131 and C136 to C138 (M3), on a grouped set of detail claims including
C44 and C161 (M4), and on the meaning of *tail call*, T30 with C2 (M5).
Contradictions 0; undefined terms 0. Verdict: readable for RD-4.

The ruling on the override, by the orchestrating session. The
specification defines a restatement mismatch as a disagreement between
the restatement and the IR. M1 is a disagreement; M2 to M5 are
omissions from a restatement bounded at 200 words for a chapter of
2,561, which the stranger labels as its own. An omission is not a
disagreement, so M2 to M5 are not mismatches under the definition, and
the override (a restatement mismatch on one passage in any two rounds
always counts) does not reach them, even though M2 falls on the
discriminator-rule passage of rounds 1 and 6, M4 on the PE Rule 1
passage of rounds 3, 4 and 6, and M5 on the tail-call definition of
rounds 4 and 5. M1 is own, quotes the prose sentence carrying C95, and
falls on no earlier round's passage, so it does not count. The verdict
readable stands. The alternative reading is stated for the meta-review
to judge: if an omission is a mismatch, the override counts M2, M4 and
M5, and the verdict is not readable. The record's earlier rounds treated
round 6's five omissions the same way: reported, not counted.

| # | Finding (shortened) | Kind | Decision |
|---|---|---|---|
| 1 | "keep their definition sites in the spine, `concepts.md` §25" | excess | fixed: C3 cut; C132 already says earlier chapters define every term but *tail call*, and the links name the definition sites; the prose links partial evaluation in C4's sentence, "This chapter describes partial evaluation as implemented.", and residual joins the reader list |
| 2 | "The inert rest of the kinds must fall to one default arm" | excess | fixed: C157 rephrased, "One default arm of the evaluator's switch must take the inert rest of the kinds."; the prose reads "One default arm must take the inert rest of the kinds." |
| 3 | "The switch in `evaluate` has no default arm." against E3 (a switch over the seven kinds) and C153 (only the participating kinds) | mismatch | fixed: C153 names the participating kinds, "Under the discriminator rule, the evaluator's switch must name only the participating kinds: Symbol, Expression, the two function kinds and Param."; C158, "The switch in `evaluate` names all seven kinds, with no default arm."; C164, "The switch in `evaluate` is a defect against the discriminator rule."; R1, E3 and E48 reworded |
| 4 | "where the value's fields win except a `union` field, which merges" | compound | fixed: C15 split; C15, "A resolved Symbol's own metadata fields are laid under the fields of its value by `mergeOverMeta`."; new C170, "In `mergeOverMeta`, a `union` field merges rather than giving way to the value's field.", with E33 |
| 5 | "Nothing counts the defect, because the `units` report's discriminator count skips the `evaluator` unit." | compound | fixed: C151 rephrased as one statement, "The `units` report's discriminator count skips the `evaluator` unit, the switch in `evaluate` included." |
| 6 | "holds the call's value, because the binding's `if` or `when` Expression is unmarked" | compound | fixed: C86 split; new C171, "The `if` or `when` Expression of a local binding is unmarked.", with E21 and E22; C86, "A local binding of an `if` or a `when` whose chosen branch is a call holds the call's value."; R6 now derives C86 from C171, with C85 named; the reason round 1's finding 18 asked for stays a sentence of its own |
| 7 | "The generic `union` rule cannot replace the effect path, because the base cannot encode an effect set." | compound | declined: the sentence is one claim with its reason, quoting the ruling of `docs/plans/plane-interfaces.md` §9.8 in 18 words; the specification's compound check (CK-03) names `and`, `but`, `so`, a semicolon and an em-dash, not a reason clause, and the reason is not a claim the chapter states apart from the ruling |
| 8 | "`markTailCalls` marks the outermost Expression of a function body as one whose result is the function's result" | excess | fixed: C74 shortened, "`markTailCalls` marks the outermost Expression of a function body."; the cut words repeat the definition of *tail call* (T30) in the sentence before; the claim stays because no other claim says what `markTailCalls` marks |

Fixes after round 7: IR 165 to 166 claims (C3 cut; C170 split from
C15, C171 split from C86; C74, C151, C153, C157, C158 and C164
rephrased); clusters 34, G1, G5 and G19 changed; relations 10, R1 and R6
reworded; evidence 48, E3 and E48 reworded; prose 2,561 to 2,548 words
(same method: the stranger's count plus the change measured on the diff,
−13, list markers counted). Lint clean; round trip 166 of 166.

Confirmation, by the round's stranger instance on commit `8bf227e`:
findings 1, 3, 4, 5, 6 and 8 confirmed. Finding 7 withdrawn by the
instance on the reason given: C124 renders the whole sentence as one
decided claim with its reason clause inside it, and "because" is not in
the compound list. Finding 2 unfixed: "One default arm must take the
inert rest of the kinds." still uses the phrase "the inert rest of the
kinds", which the finding asked to replace with a plainer one. Under the
specification, the unconfirmed fix's words stay in the delivered prose,
and the reasoning role fixes finding 2 at the next edit of the chapter.
That sentence is not changed now. New defects in the changed passages,
four:

- A. The §2 sentence of C153 lists primitive function, composed function
  and Param as participating, which C13 says `evaluate` returns
  unchanged, as it does Bits and Structure; no sentence says why the
  first three participate and the last two do not (mismatch).
- B. The C151 sentence, "the switch in `evaluate` included", no longer
  states that nothing counts the defect, which C151 held before round 7
  (mismatch).
- C. The C158 and C164 sentences both open with "The switch in
  `evaluate`" (excess).
- D. The link from the unmarked Expression (C171) to "holds the call's
  value" (C86) is adjacency only, though R6 makes C86 depend on C171
  (minor).

Touch-up after confirmation, four edits, IR first, then prose and render
map:

1. A: new C172, after C153 in G7, decided from `docs/book/units.md`
   §3.2, which names the participating kinds by their part in
   evaluation (Symbol resolves, Expression applies, the function kinds
   and Param take part in application): "Under the discriminator rule,
   the two function kinds and Param participate because each takes part
   in application." The prose reads "The two function kinds and Param
   participate because each takes part in application." Checked against
   `evaluateExpr` (a function kind in function position is applied; an
   unresolved Param in function position yields a residual carrying the
   Param's effects) and `subst` (a Param is replaced by its argument) in
   `src/evaluator.ts`.
2. B: C151 restores the conclusion with a colon, not "because": "Nothing
   counts the defect of the switch in `evaluate` against the
   discriminator rule: the `units` report's discriminator count skips
   the `evaluator` unit." The prose reads "Nothing counts the defect: the
   `units` report's discriminator count skips the `evaluator` unit."
3. C: the C164 sentence opens with a determiner and noun, "That switch
   is a defect against the discriminator rule."; C164 in the IR keeps
   the full name.
4. D: the C86 sentence opens with the connective "So", carrying R6's
   dependency: "So a local binding of an `if` or a `when` whose chosen
   branch is a call holds the call's value." C86 keeps its provenance,
   proposed with evidence E5 and E25.

Counts after the touch-up: IR 166 to 167 claims (C172 added; C151
rephrased); clusters 34 (G7 gains C172); relations 10; evidence 48;
prose 2,548 to 2,559 words (the stranger's method, +11 measured on the
diff). Lint clean; round trip 167 of 167.

Claims check before delivery: round trip 167 of 167 claims, 0 missing,
0 stale (the render map and the re-read of changed passages, run after
the touch-up).

Confirmation of the touch-up, by the round's stranger instance on
commit `59eaae6`: B, C and D confirmed; A unfixed. The instance's
reason for A: "The two function kinds and Param participate because
each takes part in application" does not separate the sets, because §2
says a Structure in function position with a constructor slot applies
its constructor, so a Structure also takes part in application yet the
rule lists it as inert. The reasoning role accepts the point: it is a
gap between the discriminator rule's wording in `docs/book/units.md`
§3.2 (Structure inert) and `evaluateExpr`, which applies a Structure's
constructor; the chapter states both facts and the wording of C172
follows the rule's. The unconfirmed words stay in the delivered prose,
as the specification says, and the next edit of the chapter fixes A,
round 7's finding 2 ("the inert rest of the kinds") and the one new
defect the instance noted in the touched passage: the C172 sentence
repeats "the two function kinds and Param" right after the list that
names them (excess).

## Verdict and meta-review

Readable for RD-4 at round 7 of a count of seven. The count ends at the
readable verdict. Findings per thousand words by round: 7.8, 4.1, 3.7,
3.2, 2.8, 3.9, 3.1. Prose 2,317 words at round 1 and 2,559 at delivery;
IR 134 claims at round 1, 166 after round 7's fixes and 167 at delivery,
the growth from splits. Two stranger instances were lost to container
restarts before confirmation, in rounds 1 and 5.

Footprint before delivery, by `git diff --name-only origin/main...HEAD`
with the IR and the review record excluded: declared 9, changed 10,
surprises 1, misses 0. The surprise is `docs/backlog.md`, where this
count's close files B-172 (the partial-evaluation rules as implemented
against the spine) in the stream's spare id. IR Status set to `reviewed
(count 1, round 7 readable 2026-10-31; unratified terms 1; footprint:
declared 9, changed 10, surprises 1, misses 0)`.

The four meta-review signals, checked against this record:

1. Fired. A fix was not held at confirmation in rounds 2 and 3 (findings
   2 and 3 of round 2, finding 5 of round 3) and in round 7 (finding 2,
   and touch-up edit A).
2. Fired. A restatement mismatch recurred on one passage: C113 in rounds
   1 and 2; C154 with C44, the PE Rule 1 passage, in rounds 3, 4 and 6;
   T30 in rounds 4 and 5.
3. Not fired. Words per IR claim were 17.3 at round 1 (2,317 / 134) and
   15.3 at round 7 (2,548 / 166; the text round 7 reviewed, 2,561 / 165,
   gives 15.5). The last does not exceed the first by more than one
   tenth: it fell.
4. Fired. Round 3's finding 2 fell on C129, which round 1's fixes added;
   round 4's finding 1 fell on C154, which round 2's fixes added; round
   6's finding 1 fell on the same PE Rule 1 passage.

The point for the meta-review: round 7's verdict rests on the
orchestrating session's reading that an omission in a restatement
bounded at 200 words is not a disagreement, so the override does not
reach M2 to M5. Under the other reading, the override counts M2, M4 and
M5, and round 7 is not readable.

Meta-review: delivered (docs/records/evaluator-chapter-meta-review.md, 2026-11-01; signals checked: 1 fired, 2 fired, 3 not fired, 4 fired)

## After the count, 2026-11-01

The owner merged PR #129 on 2026-11-01 (00:40 UTC) with no comment.
Under `docs/book/process.md` §3 the merge is the approval.
The merge ratified ask A1 (161 claims) and ask A2 (the term tail call).
This follow-up flips their statuses to decided and the IR's Status to delivered.
The plan's flip before the merge was overtaken by the merge.
Three defects stay for the next edit: round 7's finding 2, touch-up edit A and the excess in the C172 sentence.
This follow-up leaves them untouched.
Asks 3 and 4 of the PR remain open with the maintainer.
Ask 3 is the lane of B-172 (the partial-evaluation rules as implemented against the spine) and the owner of the missing default arm.
Ask 4 is the dispatch of the meta-review.
`Meta-review:` stays `pending`.
Meta-review delivered 2026-11-01 by a fresh session with no part in the rounds; its asks are open with the maintainer.
