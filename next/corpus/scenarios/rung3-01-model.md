# Rung 3, scene 1: the model is the artifact, and it checks itself

| Source | Rung | Milestone | Evidence for |
|---|---|---|---|
| `demos/rung3/01-model.alg`, `demos/rung3/transcripts/01-halt.txt` | 3 | 7 | Models are first-class, live values |

## Who and why

A release lead writes a project plan as a graph of outcomes, in the
planning library's notation. They want the plan checked like any other
value. They want every refusal in planning words that a stakeholder can
read.

The planning decisions are held, not ruled. A finding that rests on one
names it with "(held)".

## Steps

1. **Does.** Declares six fixtures, each `fixture(name, a => true)`.
   **Must find.** Each is a promise on an outcome or a requirement on an
   input ("Bracket constraints as refinements, named as predicate
   fixtures", held). The result records each as an assumption, with the
   plans that rest on it.
2. **Does.** Declares `plan BuildPipeline:` with three nodes, estimates,
   a declared failure and a handler with a retry. **Must find.** The
   `plan` form binds the name with the claim that it is a
   `WellFormedPlan`. The claim holds. The wiring is derived ("A plan is
   an outcome graph with derived wiring", held). The claim rests on the
   fixtures it uses and on the library's termination assumptions, so
   its strength is at most assumed.
3. **Does.** Declares `plan SoftwareRelease:`, which borrows
   `BuildPipeline` with `uses`, nests composites and sets a budget of
   200 person-hours. **Must find.** The same claim holds, at the same
   strength. `plan_show` prints the plan's surface and counts. The
   predicate call `SoftwareRelease instanceof WellFormedPlan` answers
   true.
4. **Does.** Asks `rollup` and `rollup_bound`. **Must find.** 440 min and
   8.75 person-hours; 1345 min and 24 person-hours. The bound counts
   every recovery at its retry limit ("Estimates roll up, budgets are
   proved", held).
5. **Does.** Asks `escalations`. **Must find.** Each declared failure,
   the node that raises it and the composite whose handler takes it.
6. **Does.** Builds `unwired` with library functions and asks
   `validate`. **Must find.** No claim is made, so nothing is refuted
   ("Nothing is a claim until someone makes it"). The predicate's
   explanation names every finding: input PackagedArtifacts of Sign is
   produced by nothing, and outcome CompiledBinaries of Compile is
   consumed by nothing.
7. **Does.** Lowers the budget to 20 person-hours and asks `validate`.
   **Must find.** The explanation names the budget: the bound's 24
   person-hours exceed 20.
8. **Does.** Adds a handler on DiskFull, which nothing beneath it
   raises, and asks `plan_errors`. **Must find.** The finding names the
   handler and that no node raises DiskFull ("Failure handlers over
   outcomes", held).

## Break it

**Does.** Changes Compile's input to `Missing`. **Must find.** The claim
that `BuildPipeline` is a `WellFormedPlan` is refuted. The refutation
carries what the predicate answered ("A predicate can explain its
refusal"): input Missing of Compile is produced by no node of
BuildPipeline and by none of its inputs. It is found before any effect.
The present tree already halts before output here.

## What changes by ruling

- "The standard language's handled failure is an exception": pins 175
  and 179 read an error value from `validate` with `error of`. The error
  value is gone; what replaces it is question 1.
- "A refutation marks everything computed from it": "Type error:
  refinement predicate failed for WellFormedPlan" becomes the refutation
  of the plan's claim, carrying the predicate's explanation.
- "Termination is a claim" and "An assumption is always on the record":
  the library's tree walks carry `assume terminates`, 36 of them, which
  today's ledger does not show. Each is on the record, and each plan
  claim names those it rests on.
- "Every result says how strongly it holds" and "Four strengths, one
  vocabulary": `verify` reports both plans "well-formed (discharged)"
  while they rest on six admitted promises. Their strength is assumed,
  and "admitted" becomes assumed.
- "A module's summary is the weakest strength among its claims": the
  heading reads "verified" while five Quantity laws wait. The summary
  is undecided.

## Open questions

1. The held "Two enforcement shapes for a well-formed plan" makes the
   library path yield an error value. Under the ruled decisions, is
   `validate` a call of the predicate that answers its explanation as a
   value, or a function that raises an exception? Pins 175 and 179
   follow the answer.
2. Are the fixtures `a => true` assumed promises, as today's ledger has
   them, so that every plan claim is at most assumed? This rests on the
   held "Bracket constraints as refinements, named as predicate
   fixtures".
3. A plan's predicate must terminate ("Equality, coercion and invariant
   predicates hold no capability and terminate"). Must milestone 7 keep
   the library's walks at the strength assumed, as the library has them,
   or decide their termination ("Termination by bounded decrease")?

## Present pins

Eight pins. All are covered. Each pin is a `// expect:` line under the
line it checks.

| Line | Pinned output | Step |
|---|---|---|
| 150 | `plan SoftwareRelease: … 14 nodes, 10 leaves, 1 handlers` | 3 |
| 153 | `true` | 3 |
| 158 | `duration 440 min, effort 8.75 person-hours, money none` | 4 |
| 161 | `duration 1345 min, effort 24 person-hours, money none` | 4 |
| 165 | `[CompilationError raised by Compile is handled in BuildPipeline, HealthCheckFailed …]` | 5 |
| 175 | `Unwired is not well-formed: input PackagedArtifacts of Sign …` | 6 |
| 179 | `SoftwareRelease is not well-formed: budget of SoftwareRelease: effort 24 person-hours exceeds 20 person-hours` | 7 |
| 184 | `handler on DiskFull in Unwired: no node beneath Unwired raises DiskFull` | 8 |
