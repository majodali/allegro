# Rung 1, scene 2: a broken claim names its counterexample

| Source | Rung | Milestone | Evidence for |
|---|---|---|---|
| `demos/rung1/02-counterexamples.alg`, `demos/rung1/transcripts/02-broken.txt` | 1 | 5 | Provability, positive and negative; counterexamples in domain vocabulary |

## Who and why

The developer of scene 1 breaks claims on purpose. They want each
failure to name the constraint that failed and the concrete value that
failed it. They want a false theorem and a failed construction to stop
the program.

The rulings change this scene's form. Lines 9, 10 and 15 construct
refined values that fail their predicate, and each such construction
would refute the program. The program instead calls each predicate,
which answers its explanation as a value, and prints it (ruling B of
2026-11-15, round 2). A real failed construction moves to the break-it
block.

## Steps

1. **Does.** Declares `SmallPos = Int & _ > 0 & _ < 100` and constructs
   `SmallPos(50)`. **Must find.** The claim holds, decided. The run
   prints 50.
2. **Does.** Calls SmallPos's predicate on -5 and prints the answer.
   **Must find.** No claim is made, so nothing is refuted ("Nothing is a
   claim until someone makes it"). The predicate answers its
   explanation ("A predicate can explain its refusal"). The refused
   clause is rendered as written, with the value, and no derived bound
   (ruling C): "`_ > 0` does not hold of -5". The run prints it.
3. **Does.** Calls the predicate on 200. **Must find.** The explanation
   "`_ < 100` does not hold of 200". The run prints it.
4. **Does.** Declares `Range = Type.define({lo: Int, hi: Int}) & _.lo <=
   _.hi`, constructs `Range(1, 100)` and reads `.hi`, then calls Range's
   predicate on the fields 50 and 5. **Must find.** The construction's
   claim holds and the run prints 100. The predicate answers its
   explanation: the invariant `_.lo <= _.hi` as written, with the values
   50 and 5. The run prints it.
5. **Does.** Prints `"still standing"`. **Must find.** No claim of the
   program is refuted, so the run prints it.

## Break it

**Does.** Uncomments `theorem wrong: 2 + 2 == 5`. **Must find.** The
claim is refuted, decided by evaluation. The counterexample is the
evaluation itself: `2 + 2 == 5` gives false. The refutation is found
while the program is checked, before any effect, so the run prints
nothing.

**Does.** Uncomments a failed construction, `SmallPos(0 - 5)`. **Must
find.** Its claim is refuted ("Constructing a refined value claims its
predicate"). The refutation carries the predicate's explanation, "`_ >
0` does not hold of -5". The program halts before any effect.

**Does.** Uncomments both. **Must find.** The build reports both
refutations, since neither rests on the other, and performs no effect
after the first (ruling D).

## What changes by ruling

- "Constructing a refined value claims its predicate" and ruling B of
  2026-11-15, round 2: pins 9, 10 and 15 read an error value from a
  failed construction. A failed construction would refute the program,
  so the program calls the predicate and prints the explanation it
  answers. One failed construction stays, as a break-it case.
- "The standard language's handled failure is an exception": the error
  value and its kernel field are gone, and with them the `error of`
  idiom the three pins use.
- Ruling C: "expected ≥ 1 (got -5)" becomes the clause as written with
  the value, "`_ > 0` does not hold of -5". No bound is derived.
- "An effect consumes only values whose claims are decided" and "The
  platform ships three phases: check, run and export": with the break-it
  line uncommented the program prints six lines and then halts. The
  refutation is found in the check, and the run prints nothing. The
  transcript already shows no printed line.
- "Every failure carries a legible counterexample": pin 15 renders
  "refinement check failed" with no constraint and no value. The
  explanation names the invariant and the two field values.

## Questions, as settled

Every question this scene raised is settled. Rulings 1 to 5 and the
letters A to X are stated in the index (`README.md`, "Rulings of
2026-11-15").

- How the three counterexamples are shown: ruling B (the program calls
  the predicate and prints its explanation; one break-it keeps a failed
  construction).
- How a refused clause is rendered: ruling C (as written, with the
  value).
- Whether a check reports every refutation: ruling D (every one that
  rests on no earlier one, and no effect after the first).

## Present pins

Six pins. All are covered.

| Line | Pinned output | Step |
|---|---|---|
| 8 | `50` | 1 |
| 9 | `refinement check failed: expected ≥ 1 (got -5)` | 2 |
| 10 | `refinement check failed: expected ≤ 99 (got 200)` | 3 |
| 14 | `100` | 4 |
| 15 | `refinement check failed` | 4 |
| 27 | `still standing` | 5 |
