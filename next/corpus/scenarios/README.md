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

| Scenario | Rung | Milestone | Steps | Changes by ruling | Questions settled |
|---|---|---|---|---|---|
| [rung1-01-discharge.md](rung1-01-discharge.md) | 1 | 5 | 6 | 6 | 4 |
| [rung1-02-counterexamples.md](rung1-02-counterexamples.md) | 1 | 5 | 5 and break it | 5 | 3 |
| [rung1-03-effects.md](rung1-03-effects.md) | 1 | 5 | 5 and break it | 4 | 3 |
| [rung1-04-laws.md](rung1-04-laws.md) | 1 | 5 | 7 and break it | 6 | 5 |
| [rung1-05-prover-loop.md](rung1-05-prover-loop.md) | 1 | 5 | 7 and break it | 5 | 7 |
| [rung2-01-dimensions.md](rung2-01-dimensions.md) | 2 | 6 | 7 and break it | 5 | 2 |
| [rung2-02-literals.md](rung2-02-literals.md) | 2 | 6 | 4 and break it | 5 | 3 |
| [rung2-03-laws.md](rung2-03-laws.md) | 2 | 6 | 7 and break it | 7 | 4 |
| [rung3-01-model.md](rung3-01-model.md) | 3 | 7 | 8 and break it | 6 | 3 |
| [rung3-02-solve.md](rung3-02-solve.md) | 3 | 7 | 8 and break it | 7 | 4 |
| [rung4-01-loop.md](rung4-01-loop.md) | 4 | 7 | 11 and break it | 7 | 5 |

No question of the scenes is open.

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
  word, the weakest strength. It is decided for rung 1, scenes 1 and
  3 (ruling N of round 3).
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
  failures of rung 3, scene 2 is an exception carrying the counterexample
  (planning specification §7).
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
   leaves the source. The maintainer: "I agree on Q4." Changes: rung 3,
   scenes 1 and 2.
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

**The scenes' own questions, rounds 2 to 4.** The maintainer took the
stream's recommendations in three rounds: "I agree with all six
recommendations, A through F"; "I agree with all recommendations, G
through O"; "I agree with all recommendations, P through X".

- **A.** `requires`, `ensures` and the `effects` clause are part of the standard language with no `use`, each a separate extension inside it that a configuration can drop.
- **B.** Rung 1, scene 2 calls each predicate and prints the explanation it answers; one break-it keeps a real failed construction.
- **C.** A refused clause is rendered as written, with the value: "`_ > 0` does not hold of -5".
- **D.** A build reports every refutation that does not rest on an earlier one, and performs no effect after the first.
- **E.** An `effects` clause names capabilities by their own names, `effects output`; `pure` holds none; the output capability is `output`, its one part `write`.
- **F.** The result holds the capabilities every function uses, as a reported fact; a tool shows it when configured.
- **G.** Binding a proof value is no claim: a proposal attached to nothing, listed nowhere, checked by nothing.
- **H.** An obligation is named by its module and claim name; the hash over the proposition's text goes; a content hash is only the proof store's cache key.
- **I.** A hint is the explanation the refusing rule or the deriver gave, in the result; a tool adds none of its own.
- **J.** A scripted proposer is enough for milestone 5; a language model's run is recorded once and replayed through the kernel.
- **K.** The benchmark is a separate corpus case at milestone 5.
- **L.** Rung 1, scene 5 answers a claim evaluation cannot decide, with the derivation budget at zero; a last step has the deriver answer it.
- **M.** The coercion claims are as the laws: assumed and named, a proof against the reference definitions the goal.
- **N.** A true claim whose `by` term uses an assumed law is decided when evaluation decides it.
- **O.** The deriver does not attempt a law the author has assumed.
- **P.** The dimension predicates explain their refusal: the value, its dimension and the one expected.
- **Q.** `import units` brings the bindings only; `use units` brings the bindings and the notation, to the end of its block.
- **R.** Nobody has to claim the combined grammar unambiguous; a text with two parses is always refuted; a library may claim it, and the deriver samples the claim.
- **S.** Milestone 6 has a break-it for the notation: a text read two ways, refuted with both readings named.
- **T.** A proposal for a library's law goes into the project's proof store, never the library's source; the default obligation list shows the project's own claims, and the libraries' when asked.
- **U.** After a refutation the tools still list the open obligations that do not rest on the refuted value.
- **V.** One recorded language-model run is enough for milestone 7.
- **W.** Milestone 7 passes on the one-model scene; the two-model scene is a later step of its own.
- **X.** A tool does not offer a refused proposal on an already decided claim for repair.

**The planning scenes.** Seven of their questions are settled by the
planning specification (`next/models/specs/planning.md`, ruled at PR
#202), each by the section the table cites. The maintainer ruled in
words that `solve` must read a residual: milestone 7 requires the
residual design, and the enumeration is not ported. Milestone 7 waits
on the kernel stream for a way to implement general solvers, since that
stream has reversed "A function may take an argument unevaluated".

Two needs go to the kernel stream. A guard must treat an explanation as
not true (rulings 3 and 4). The standard deriver is an extension the
build runs; it asks nothing of the kernel beyond the trial evaluation
the kernel already owes.

## The scenes' questions, as settled

The 37 questions of the first draft, by scene and number in that
draft, and the five raised while the rulings were written. Every one
is settled. Of the draft's 37, nine are settled by the five rulings, 21
by the letters A to X and seven by the planning specification; the
five new ones by the letters L, M, N, O and X. Each scene's file records them under
"Questions, as settled".

| Scene | Question | Settled by |
|---|---|---|
| rung1-01, 1 | Strength of the twelve equality laws and two coercion claims | Ruling 5; ruling M for the coercion claims |
| rung1-01, 2 | Whether `use contracts` survives as a module | Ruling A |
| rung1-02, 1 | How the three counterexamples are shown | Ruling B |
| rung1-02, 2 | How the clause `_ > 0` is rendered | Ruling C |
| rung1-02, 3 | Whether milestone 5 reports all four refutations of one file | Ruling D |
| rung1-03, 1 | The name of the output capability in an `effects` clause | Ruling E |
| rung1-03, 2 | Whether the bound needs `use effects` | Ruling A |
| rung1-03, 3 | Whether `inspect` shows the capabilities of a function that claims nothing | Ruling F |
| rung1-04, 1 | A refused `by` term on a claim that holds by evaluation | Ruling 2 |
| rung1-04, 2 | Whether binding a proof value is a claim | Ruling G |
| rung1-04, 3 | Whether Cell's refl and sym are decided | Ruling 5 |
| rung1-04, 4 | The strength of Int equality's transitivity in pin 10 | Ruling 5 |
| rung1-05, 1 | Whether `double_four` with a refused term is refuted or undecided | Ruling 2 |
| rung1-05, 2 | How an obligation is identified | Ruling H |
| rung1-05, 3 | Whether hints are part of the result | Ruling I |
| rung1-05, 4 | Whether a scripted proposer passes milestone 5 | Ruling J |
| rung1-05, 5 | Whether the benchmark belongs to the scenario | Ruling K |
| rung2-01, 1 | Whether a dimension mismatch is a refutation or a handled failure | Ruling 3 |
| rung2-01, 2 | Whether the named-dimension predicates explain their refusal | Ruling P |
| rung2-02, 1 | Whether `use units` is one form or two | Ruling Q |
| rung2-02, 2 | Who claims the combined grammar unambiguous | Ruling R |
| rung2-02, 3 | Whether milestone 6 needs a break-it case for the notation | Ruling S |
| rung2-03, 1 | Whether Quantity's refl and sym stay undecided or reach sampled | Ruling 5 |
| rung2-03, 2 | A refused `by` term, as rung1-04, 1 | Ruling 2 |
| rung2-03, 3 | Whether `p` is a claim, as rung1-04, 2 | Ruling G |
| rung3-01, 1 | Whether `validate` answers its explanation or raises an exception | Ruling 4 |
| rung3-01, 2 | Whether the fixtures are assumed promises | The planning specification, §11, question 9 |
| rung3-01, 3 | Whether the walks' termination stays assumed | The planning specification, §3 |
| rung3-02, 1 | Whether a failed search raises an exception or answers a value | The planning specification, §7 |
| rung3-02, 2 | Whether `solve_from`'s best is decided or sampled | The planning specification, §5 |
| rung3-02, 3 | Whose order "best" follows | The planning specification, §11, question 7 |
| rung3-02, 4 | Whether `solve` must read a residual over unknowns | The planning specification, as the maintainer ruled in words |
| rung4-01, 1 | Whether open, unsolved and solved map onto the strengths | The planning specification, §7 and §11, question 3 |
| rung4-01, 2 | Where a proposal for a library's law is placed | Ruling T |
| rung4-01, 3 | Whether the tools list other obligations after a refutation | Ruling U |
| rung4-01, 4 | Whether one recorded language-model run passes milestone 7 | Ruling V |
| rung4-01, 5 | Whether milestone 7 needs a second model | Ruling W |
| rung1-01, new | Whether the coercion claims are assumed or decided | Ruling M |
| rung1-01, new | Whether a true claim whose term uses an assumed law is decided | Ruling N |
| rung1-04, new | Whether the deriver attempts a law the author has assumed | Ruling O |
| rung1-05, new | Which claim the prover-loop walkthrough uses | Ruling L |
| rung1-05, new | Whether a tool offers a refused proposal on a decided claim for repair | Ruling X |
