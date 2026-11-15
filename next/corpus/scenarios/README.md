# The scenarios: the demo scenes as the rebuild must pass them

Each file restates one demo scene of rungs 1 to 4 as a
[scenario](../../../docs/plans/rebuild-acceptance.md#def-scenario): who
acts, what they do, and what the platform must find, in the words of the
ruled decisions and with no dependence on exact output. The milestones
are those of the program plan's §5 (`docs/plans/rebuild.md`). The cases
that realise a scenario are its program's pinned lines, cited by line
number in its last section.

There are eleven scenarios: one for each of the ten programs, and one
for rung 1's prover-loop walkthrough, which has no program. Rung 4's
walkthrough belongs to its scene's scenario. A question shared by
several scenes is asked in the first scene that raises it, and the
others refer to it.

| Scenario | Rung | Milestone | Steps | Changes by ruling | Open questions |
|---|---|---|---|---|---|
| [rung1-01-discharge.md](rung1-01-discharge.md) | 1 | 5 | 6 | 6 | 2 |
| [rung1-02-counterexamples.md](rung1-02-counterexamples.md) | 1 | 5 | 5 and break it | 5 | 0 |
| [rung1-03-effects.md](rung1-03-effects.md) | 1 | 5 | 5 and break it | 4 | 0 |
| [rung1-04-laws.md](rung1-04-laws.md) | 1 | 5 | 7 and break it | 6 | 2 |
| [rung1-05-prover-loop.md](rung1-05-prover-loop.md) | 1 | 5 | 6 and break it | 4 | 6 |
| [rung2-01-dimensions.md](rung2-01-dimensions.md) | 2 | 6 | 7 and break it | 5 | 1 |
| [rung2-02-literals.md](rung2-02-literals.md) | 2 | 6 | 4 and break it | 4 | 3 |
| [rung2-03-laws.md](rung2-03-laws.md) | 2 | 6 | 7 and break it | 7 | 2 |
| [rung3-01-model.md](rung3-01-model.md) | 3 | 7 | 8 and break it | 6 | 2 |
| [rung3-02-solve.md](rung3-02-solve.md) | 3 | 7 | 8 and break it | 6 | 4 |
| [rung4-01-loop.md](rung4-01-loop.md) | 4 | 7 | 11 and break it | 7 | 5 |

The ten programs hold 65 pinned lines. Every pin is covered by a step
or a break-it case.

## Changes that touch several scenes

- **"Four strengths, one vocabulary".** The words discharged, proven,
  verified, admitted, pending, `kernel` and witnessed give way to
  decided, sampled, assumed and undecided. Every scene's `inspect` or
  `verify` output changes. Four pins carry such a word: rung 1, scene 4,
  lines 10 and 40; rung 2, scene 3, line 32; rung 4, scene 1, line 110.
- **"A module's summary is the weakest strength among its claims".** The
  grade `proven-safe` and the heading "Verdict (verified)" become one
  word, the weakest strength. It is decided for rung 1, scene 3. For
  rung 1, scene 1, it is decided or assumed (that scene's question 2).
  This follows from ruling 5: it is assumed for rung 1, scene 4, where
  no law is left undecided. For every program that draws the units
  library it is the weakest strength among the file's claims and the
  five Quantity laws, which the standard deriver attempts; the scenes
  do not predict it.
- **"Every result says how strongly it holds".** A result that rests on
  an assumption has the strength assumed. Today it is marked discharged
  with a note: rung 1, scene 4; rung 2, scene 3; rungs 3 and 4, where
  every plan rests on fixtures. A proof that uses an equality law of
  Int, Float or String rests on an assumption the platform makes
  (ruling 5): rung 1, scenes 1 and 4.
- **"An effect consumes only values whose claims are decided".** A
  refutation is found while the program is checked, before any effect,
  and the run prints nothing. A strength (assumed, sampled, undecided)
  prevents no effect unless a policy or configuration requires it
  (ruling 1). Two break-it cases halt today after printing and will
  print nothing: rung 1, scene 2 (six lines); rung 2, scene 1 (eight).
  Two halt today on a refused `by` term and no longer halt (ruling 2):
  rung 1, scene 4 (two lines), whose break-it becomes a wrong equality
  refuted before any effect; and rung 2, scene 3 (one line), which now
  prints.
- **"The standard language's handled failure is an exception".** The
  error value and the `error of` idiom are gone. Ten pins read one: rung
  1, scene 2, lines 9, 10 and 15; rung 2, scene 1, lines 22 and 27; rung
  2, scene 2, line 20; rung 3, scene 1, lines 175 and 179; rung 3, scene
  2, lines 162 and 194. For the refinements of rung 1, scene 2, "Constructing
  a refined value claims its predicate" would make each a refutation, so
  the program calls the predicate and prints its explanation (ruling B
  of round 2). Ruling 3
  makes the mismatches of rung 2 (lines 22, 27 and 20) refutations
  carrying the same messages, moved to break-it cases. Ruling 4 makes
  `validate` (rung 3, scene 1, lines 175 and 179) answer its explanation
  as a value, with the text unchanged. What replaces the search
  failures of rung 3, scene 2 is that scene's question 1.
- **"A refutation marks everything computed from it".** "proof check
  failed", "effects declaration check failed" and "Type error" become
  one kind of finding: the refutation of a named claim, carrying its
  counterexample or the predicate's explanation.
- **"Anyone may propose, and the record shows who".** The verdict
  credits every theorem to `auto-PE`. The result names the proposer of
  each `by` term and the author of each assumption: rung 1, scenes 1, 4
  and 5; rung 2, scene 3. It names the standard deriver as the proposer
  of each law it decides (ruling 5): rung 1, scene 4; rung 2, scene 3.
- **"Termination is a claim" and "An assumption is always on the
  record".** The planning library's 36 tree walks carry `assume
  terminates`, which today's ledger does not show. Each is on the
  record, and the plan claims of rungs 3 and 4 rest on them.

## Rulings of 2026-11-15

The maintainer ruled five questions the scenes put, in a design
discussion of the acceptance stream's session on 2026-11-15. They are
settled. The rulings reword or extend ruled decisions of the inventory;
B-197 (evidence against a ruled decision) lists each for the review
session to record. A point marked "this follows" in a scene is the
stream's reading of a ruling, not the maintainer's word.

1. **Effects and strength.** A value carries only what was claimed of
   it and what its computation used, not its type's laws wholesale. A
   strength (assumed, sampled, undecided) never prevents an effect
   unless a policy or configuration requires it: "In general the
   decision strength doesn't prevent effects, without some
   policy/configuration to require it." A refuted claim still never
   reaches an effect. The result holds every undecided claim. Whether a
   tool shows them is configuration, "although that policy will be
   common". Changes: rung 2, scenes 1 to 3; rung 3, scenes 1 and 2;
   rung 4, scene 1. Each prints although the units library's laws or
   the plans' fixtures stay short of decided.
2. **A refused proposal.** A refused proposal never refutes its claim.
   The claim's outcome is what evaluation gives: decided if true,
   refuted if false, undecided otherwise. The refusal belongs to the
   proposal and is recorded with the rule's explanation. A policy "no
   proposal in the source is refused" exists, "policy off by default".
   Changes: rung 1, scenes 4 and 5; rung 2, scene 3; rung 4, scene 1,
   where the planning specification already treats a refused catalog
   entry this way.
3. **Parameter checks.** A predicate on a parameter stays a claim, with
   the same meaning at every phase: "one of Allegro's goals is that the
   same type checking happens at compile time as run time". `+` and `to`
   claim compatible dimensions, so `d + t` is refuted when checked,
   carrying "cannot add m and s: length vs time" as the predicate's
   explanation. A program that takes outside values guards them with
   the same predicate, which the library supplies. A failed check is not
   catchable, and predicates raise no exception. The policy "every
   parameter claim is decided before the run begins" is on by default;
   a user may configure it not to apply to a script or similar
   execution. Changes: rung 2, scenes 1 and 2.
4. **`validate` on a plan.** `validate` is the plan's own predicate
   called as an ordinary function, not a second way of enforcing. It
   answers true or its explanation as a value, and the program prints
   the explanation. The pinned lines keep their text, and `error of`
   leaves the source. Changes: rung 3, scenes 1 and 2.
5. **Laws.** Bool's three equality laws are decided by enumeration. The
   nine of Int, Float and String are assumed, named with the platform,
   until proved against the primitives' reference definitions. That is
   the goal for every law of a shipped module, and "`assumed` will do
   for now". `3 == 3` uses the primitive, not the law: only a proof step
   or a rewrite that uses a law rests on it. The standard deriver, the
   shipped proposer the build runs, takes each claim still undecided
   after evaluation: it evaluates with the value unknown, then samples,
   then derives, within budgets counted in steps that the build
   configures ("So it needs a budget, it needs to be configurable.").
   A counterexample refutes; none found leaves the claim sampled; a
   derivation decides it. A derived law carries the strength of what it
   rests on, and when the budget runs out the record says where the
   derivation stopped. The kernel checks every proposal and does no
   search. Found proofs are stored where the configuration says and
   checked again every build, never trusted. Changes: rung 1, scenes 1
   and 4; rung 2, scene 3.

**Per-scene rulings, round 2.** The maintainer then took six
recommendations on the scenes' own questions: "I agree with all six
recommendations, A through F".

- **A.** `requires`, `ensures` and the `effects` clause are part of the
  standard language with no `use`. They stay separate extensions inside
  it, so a configuration can drop one. Rung 1, scenes 1 and 3.
- **B.** Rung 1, scene 2 shows its three counterexamples by calling the
  predicate, which answers its explanation, and printing it. One
  break-it case keeps a real failed construction that halts.
- **C.** A refused clause is rendered as written, with the value: "`_ >
  0` does not hold of -5". No bound is derived. Rung 1, scene 2.
- **D.** A build reports every refutation that does not rest on an
  earlier one, and performs no effect after the first. Rung 1, scene 2.
- **E.** An `effects` clause names capabilities by their own names, so
  `effects output`; `pure` stays the word for holding none. The output
  capability is `output`, its one part `write`. Rung 1, scene 3.
- **F.** The result holds the capabilities every function uses, as a
  reported fact, not a claim; a tool shows it when configured. Rung 1,
  scene 3.

Two needs go to the kernel stream. A guard must treat an explanation as
not true (rulings 3 and 4). The standard deriver is an extension the
build runs; it asks nothing of the kernel beyond the trial evaluation
the kernel already owes.

## The scenes' open questions

The 37 questions of the first draft, by scene and number in that
draft. Nine are settled by the five rulings and seven by the round 2
rulings; 21 stay open, each with the option the stream recommends.
Five questions are new with the rulings and follow the table. A scene's file gives each open question in full under its
current number.

| Scene | Question | Settled or open |
|---|---|---|
| rung1-01, 1 | Strength of the twelve equality laws and two coercion claims | Settled by ruling 5 for the laws. The coercion part stays open as the scene's question 1 |
| rung1-01, 2 | Whether `use contracts` survives as a module | Settled, ruled 2026-11-15, round 2 (A) |
| rung1-02, 1 | How the three counterexamples are shown | Settled, ruled 2026-11-15, round 2 (B) |
| rung1-02, 2 | How the clause `_ > 0` is rendered | Settled, ruled 2026-11-15, round 2 (C) |
| rung1-02, 3 | Whether milestone 5 reports all four refutations of one file | Settled, ruled 2026-11-15, round 2 (D) |
| rung1-03, 1 | The name of the output capability in an `effects` clause | Settled, ruled 2026-11-15, round 2 (E) |
| rung1-03, 2 | Whether the bound needs `use effects` | Settled, ruled 2026-11-15, round 2 (A) |
| rung1-03, 3 | Whether `inspect` shows the capabilities a function holds when it claims nothing | Settled, ruled 2026-11-15, round 2 (F) |
| rung1-04, 1 | A refused `by` term on a claim that holds by evaluation | Settled by ruling 2 |
| rung1-04, 2 | Whether binding a proof value is a claim | Open. Recommended: no; the value carries the record of what it rests on |
| rung1-04, 3 | Whether Cell's refl and sym are decided | Settled by ruling 5: derived, assumed while Int's are |
| rung1-04, 4 | The strength of Int equality's transitivity in pin 10 | Settled by ruling 5: assumed |
| rung1-05, 1 | Whether `double_four` with a refused term is refuted or undecided | Settled by ruling 2: decided by evaluation |
| rung1-05, 2 | How an obligation is identified | Open. Recommended: a content hash of the proposition |
| rung1-05, 3 | Whether hints are part of the result | Open. Recommended: dropped; the refusal's explanation is what the proposer receives |
| rung1-05, 4 | Whether a scripted proposer passes milestone 5 | Open. Recommended: yes |
| rung1-05, 5 | Whether the benchmark belongs to the scenario | Open. Recommended: a separate case |
| rung2-01, 1 | Whether a dimension mismatch is a refutation or a handled failure | Settled by ruling 3 |
| rung2-01, 2 | Whether the named-dimension predicates explain their refusal | Open. Recommended: yes |
| rung2-02, 1 | Whether `use units` is one form or two | Open. Recommended: two forms, with `use` a notation for both |
| rung2-02, 2 | Who claims the combined grammar unambiguous | Open. Recommended: no one wholesale; each text with two parses is refuted |
| rung2-02, 3 | Whether milestone 6 needs a break-it case for the notation | Open. Recommended: yes, a text with two parses |
| rung2-03, 1 | Whether Quantity's refl and sym stay undecided or reach sampled | Settled by ruling 5: attempted by the standard deriver, with the record of where it stopped |
| rung2-03, 2 | A refused `by` term (rung 1, scene 4's question 1) | Settled by ruling 2 |
| rung2-03, 3 | Whether `p` is a claim (rung 1, scene 4's question 2) | Open, as rung1-04, 2 |
| rung3-01, 1 | Whether `validate` answers its explanation or raises an exception | Settled by ruling 4 |
| rung3-01, 2 | Whether the fixtures are assumed promises | Open. Recommended: yes, each on the record |
| rung3-01, 3 | Whether the library's tree walks stay assumed or have their termination decided | Open. Recommended: assumed for milestone 7 |
| rung3-02, 1 | Whether a failed search raises an exception or answers a value | Open. Recommended: an exception carrying the counterexample, as the planning specification's §7 has it |
| rung3-02, 2 | Whether `solve_from`'s best completion is decided or sampled | Open. Recommended: decided where the depth exhausts the catalog, otherwise sampled |
| rung3-02, 3 | Whose order "best" follows | Open. Recommended: the library's default, which a plan may override |
| rung3-02, 4 | Whether `solve` must read a residual over unknowns | Open. Recommended: enumeration is enough for milestone 7 |
| rung4-01, 1 | Whether open, unsolved and solved map onto the strengths | Open. Recommended: planning words beside them |
| rung4-01, 2 | Where a proposal for a library's law is placed | Open. Recommended: in the library's source; the standard deriver attempts the laws in the build |
| rung4-01, 3 | Whether the tools list other obligations after a refutation | Open. Recommended: yes |
| rung4-01, 4 | Whether one recorded language-model run passes milestone 7 | Open. Recommended: yes |
| rung4-01, 5 | Whether milestone 7 needs a second model | Open. Recommended: it passes on this one |

New with the rulings, all open:

| Scene | Question | Recommended |
|---|---|---|
| rung1-01, 1 | Whether the two Int-to-Float coercion claims are assumed or decided | Assumed and named with the platform, as Int's laws |
| rung1-01, 2 | Whether a theorem decided by evaluation, with a term that uses an assumed law, is decided or assumed | Decided, with the proof's record naming the assumed law |
| rung1-04, 2 | Whether the standard deriver attempts a law the file has assumed | No, since an assumed claim is not undecided |
| rung1-05, 5 | Which claim the prover-loop walkthrough uses, now that `double_four` is decided by evaluation | A claim over every value of a type that evaluation leaves undecided |
| rung1-05, 6 | Whether a tool offers a refused proposal on a decided claim for repair | No; the result holds the refusal, and a tool shows it where configured |
