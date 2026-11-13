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
| [rung1-01-discharge.md](rung1-01-discharge.md) | 1 | 5 | 6 | 5 | 2 |
| [rung1-02-counterexamples.md](rung1-02-counterexamples.md) | 1 | 5 | 5 and break it | 5 | 3 |
| [rung1-03-effects.md](rung1-03-effects.md) | 1 | 5 | 5 and break it | 4 | 3 |
| [rung1-04-laws.md](rung1-04-laws.md) | 1 | 5 | 7 and break it | 5 | 4 |
| [rung1-05-prover-loop.md](rung1-05-prover-loop.md) | 1 | 5 | 6 and break it | 3 | 5 |
| [rung2-01-dimensions.md](rung2-01-dimensions.md) | 2 | 6 | 6 and break it | 4 | 2 |
| [rung2-02-literals.md](rung2-02-literals.md) | 2 | 6 | 5 | 3 | 3 |
| [rung2-03-laws.md](rung2-03-laws.md) | 2 | 6 | 7 and break it | 6 | 3 |
| [rung3-01-model.md](rung3-01-model.md) | 3 | 7 | 8 and break it | 5 | 3 |
| [rung3-02-solve.md](rung3-02-solve.md) | 3 | 7 | 8 and break it | 4 | 4 |
| [rung4-01-loop.md](rung4-01-loop.md) | 4 | 7 | 11 and break it | 5 | 5 |

The ten programs hold 65 pinned lines. Every pin is covered by a step.

## Changes that touch several scenes

- **"Four strengths, one vocabulary".** The words discharged, proven,
  verified, admitted, pending, `kernel` and witnessed give way to
  decided, sampled, assumed and undecided. Every scene's `inspect` or
  `verify` output changes. Four pins carry such a word: rung 1, scene 4,
  lines 10 and 40; rung 2, scene 3, line 32; rung 4, scene 1, line 110.
- **"A module's summary is the weakest strength among its claims".** The
  grade `proven-safe` and the heading "Verdict (verified)" become one
  word, the weakest strength. It is decided for rung 1, scenes 1 and 3.
  It is undecided for rung 1, scene 4, and for every program that draws
  the units library, whose five Quantity laws are undecided.
- **"Every result says how strongly it holds".** A result that rests on
  an assumption has the strength assumed. Today it is marked discharged
  with a note: rung 1, scene 4; rung 2, scene 3; rungs 3 and 4, where
  every plan rests on fixtures.
- **"An effect consumes only values whose claims are decided".** A
  refutation is found while the program is checked, before any effect.
  Four break-it cases halt today after printing: rung 1, scene 2 (six
  lines) and scene 4 (two); rung 2, scene 1 (eight) and scene 3 (one).
- **"The standard language's handled failure is an exception".** The
  error value and the `error of` idiom are gone. Ten pins read one: rung
  1, scene 2, lines 9, 10 and 15; rung 2, scene 1, lines 22 and 27; rung
  2, scene 2, line 20; rung 3, scene 1, lines 175 and 179; rung 3, scene
  2, lines 162 and 194. For the refinements of rung 1, scene 2, "Constructing
  a refined value claims its predicate" makes each a refutation. For the
  others, what replaces the error value is an open question of the scene.
- **"A refutation marks everything computed from it".** "proof check
  failed", "effects declaration check failed" and "Type error" become
  one kind of finding: the refutation of a named claim, carrying its
  counterexample or the predicate's explanation.
- **"Anyone may propose, and the record shows who".** The verdict
  credits every theorem to `auto-PE`. The result names the proposer of
  each `by` term and the author of each assumption: rung 1, scenes 1, 4
  and 5; rung 2, scene 3.
- **"Termination is a claim" and "An assumption is always on the
  record".** The planning library's 36 tree walks carry `assume
  terminates`, which today's ledger does not show. Each is on the
  record, and the plan claims of rungs 3 and 4 rest on them.
