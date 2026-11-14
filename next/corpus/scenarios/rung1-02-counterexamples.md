# Rung 1, scene 2: a broken claim names its counterexample

| Source | Rung | Milestone | Evidence for |
|---|---|---|---|
| `demos/rung1/02-counterexamples.alg`, `demos/rung1/transcripts/02-broken.txt` | 1 | 5 | Provability, positive and negative; counterexamples in domain vocabulary |

## Who and why

The developer of scene 1 breaks claims on purpose. They want each
failure to name the constraint that failed and the concrete value that
failed it. They want a false theorem to stop the program.

The rulings change this scene's form. Lines 9, 10 and 15 construct
refined values that fail their predicate, and each such construction
now refutes the program. The steps state the finding for each claim.
Open question 1 asks how the scene is rebuilt around them.

## Steps

1. **Does.** Declares `SmallPos = Int & _ > 0 & _ < 100` and constructs
   `SmallPos(50)`. **Must find.** The claim holds, decided. The run
   prints 50.
2. **Does.** Constructs `SmallPos(0 - 5)`. **Must find.** The claim is
   refuted, decided by evaluation. The refutation names the clause that
   failed, `_ > 0` (the bound at least 1), and the value -5.
3. **Does.** Constructs `SmallPos(200)`. **Must find.** The claim is
   refuted. The refutation names the clause `_ < 100` (the bound at most
   99) and the value 200.
4. **Does.** Declares `Range = Type.define({lo: Int, hi: Int}) & _.lo <=
   _.hi`, constructs `Range(1, 100)` and reads `.hi`, then constructs
   `Range(50, 5)`. **Must find.** The first claim holds and the run
   prints 100. The second is refuted. The refutation names the invariant
   `lo <= hi` and the values 50 and 5.
5. **Does.** Prints `"still standing"`. **Must find.** The line is
   printed only when no claim of the program is refuted.

## Break it

**Does.** Uncomments `theorem wrong: 2 + 2 == 5`. **Must find.** The
claim is refuted, decided by evaluation. The counterexample is the
evaluation itself: `2 + 2 == 5` gives false. The refutation is found
while the program is checked, before any effect, so the run prints
nothing.

## What changes by ruling

- "Constructing a refined value claims its predicate": pins 9, 10 and 15
  read an error value from a failed construction. Each failed
  construction is a refutation of the program, and no value is left to
  read.
- "The standard language's handled failure is an exception": the error
  value and its kernel field are gone, and with them the `error of`
  idiom the three pins use.
- "An effect consumes only values whose claims are decided" and "The
  platform ships three phases: check, run and export": with the break-it
  line uncommented the program prints six lines and then halts. The
  refutation is found in the check, and the run prints nothing. The
  transcript already shows no printed line.
- "Every failure carries a legible counterexample": pin 15 renders
  "refinement check failed" with no constraint and no value. The
  refutation names the invariant and the two field values.
- The scene's opening comment, "some failures are values you can
  inspect", no longer holds.

## Open questions

1. How does the scene show the three counterexamples of steps 2 to 4?
   As three break-it cases, each a refutation? Or by calling the
   predicate, which answers its explanation as a value the program
   prints ("A predicate can explain its refusal")? Pins 9, 10 and 15
   follow the answer.
2. The clause `_ > 0` is reported today as "expected ≥ 1". Does the
   refutation render the clause as written, the bound derived from it,
   or both?
3. A check may go on evaluating after a refutation to report every
   refutation ("Claims are evaluated like everything else"). With the
   break-it line and the failing constructions in one file, must
   milestone 5 report all four refutations?

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
