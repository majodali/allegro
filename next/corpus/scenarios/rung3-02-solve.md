# Rung 3, scene 2: finding a solution to the model

| Source | Rung | Milestone | Evidence for |
|---|---|---|---|
| `demos/rung3/02-solve.alg`, `demos/rung3/transcripts/02-halt.txt` | 3 | 7 | Models are first-class, live values: solution finding |

## Who and why

The release lead of scene 1 leaves two choices open: how to test and
how to deploy. They want the platform to find the resolution that
passes every check and costs least. They also want a gap in a second
plan filled from a catalog of nodes.

The planning decisions are held, not ruled. A finding that rests on one
names it with "(held)".

## Steps

1. **Does.** Declares `BuildPipeline` as in scene 1, and
   `SoftwareRelease` with two choices: Test (Thorough or Quick) and
   Deploy (BlueGreen or Direct). **Must find.** A plan with choices is a
   template ("Choices, templates and solution finding by enumeration",
   held). Its `WellFormedPlan` claim holds because some resolution fits
   its budget. `choices` names Test and Deploy; `resolutions` counts 4.
2. **Does.** Calls `solve(SoftwareRelease)`. **Must find.** Each
   resolution is a proposal the kernel checks ("Solving is proposing a
   value for an unknown, and the kernel checks it"). That a resolution
   is feasible is decided. The best by the bound's effort, then its
   duration, is Quick and Direct: 20.75 person-hours, 1460 min. That it
   is best is decided, since all four resolutions were evaluated
   ("Feasible is decided; best says how strongly it holds"). The
   solution's plan is a `WellFormedPlan`.
3. **Does.** Sets a deadline of 23 h. **Must find.** The answer moves to
   Quick and BlueGreen: 22.5 person-hours, 1205 min. The chosen option
   brings its own handler: `escalations` names HealthCheckFailed, taken
   in Production.
4. **Does.** Sets a deadline of 20 h. **Must find.** No resolution fits.
   The failure names the cheapest resolution, Quick and Direct, and the
   measure it misses: 1460 min against 20 h. Its kind is question 1.
5. **Does.** Builds `fulfil`, whose declared outcome Delivered nothing
   produces, and asks `gaps_show`. **Must find.** The gap is the finding
   the checks already make: Delivered, which the plan declares
   ("Completion from a catalog", held).
6. **Does.** Calls `solve_from(fulfil, parts)`. **Must find.** The
   catalog fills the gap by chaining backward: Delivered from LastMile,
   Shipped from Ship, Labelled from Label, Label via PrintLabel; 1.75
   person-hours, 235 min. The strength of "best" here is question 2.
7. **Does.** Sets a deadline of 220 min. **Must find.** The answer moves
   to Courier: 2 person-hours, 200 min.
8. **Does.** Calls `solve_from` with a catalog that cannot ship.
   **Must find.** A failure that names where the search stopped: nothing
   produces Shipped, which LastMile needs. Its kind is question 1.

## Break it

**Does.** Gives the release the budget `20 h, 200 person-hours`. **Must
find.** The claim that `SoftwareRelease` is a `WellFormedPlan` is
refuted. The refutation carries the predicate's explanation: no choice
of Test and Deploy fits; the cheapest, Quick and Direct, takes 1460 min
against 20 h. It is found before any effect. The present tree already
halts before output here.

## What changes by ruling

- "The standard language's handled failure is an exception": pins 162
  and 194 read an error value with `error of`. The error value is gone;
  what replaces it is question 1.
- "Feasible is decided; best says how strongly it holds": today a
  solution carries no strength for being best. The solution states that
  it is feasible, decided, and how strongly it is best.
- "A refutation marks everything computed from it": the break-it's
  "Type error: refinement predicate failed for WellFormedPlan" becomes
  the refutation of the template's claim.
- "Termination is a claim", "An assumption is always on the record" and
  "Every result says how strongly it holds": as in scene 1, the plan
  claims rest on fixtures and on the library's termination assumptions,
  and take the strength assumed.

## Open questions

1. When no resolution or completion fits (pins 162 and 194), does the
   search raise an exception, or answer a value that names the failure?
2. `solve_from` chains catalog nodes backward to a fixed depth. Is its
   best completion decided, because the depth exhausts the catalog, or
   sampled?
3. "Best" is ordered by effort, then duration. Is that order the
   library's, or must a plan state what it optimises?
4. "A solver sees its problem unevaluated" is a design to prove. Must
   milestone 7's `solve` read a residual over unknowns, or may it keep
   enumerating a template value as today?

## Present pins

Eleven pins. All are covered. Each pin is a `// expect:` line under the
line it checks.

| Line | Pinned output | Step |
|---|---|---|
| 134 | `[Test, Deploy]` | 1 |
| 137 | `4` | 1 |
| 143 | `Test via Quick, Deploy via Direct; bound effort 20.75 person-hours, duration 1460 min` | 2 |
| 147 | `true` | 2 |
| 154 | `Test via Quick, Deploy via BlueGreen; bound effort 22.5 person-hours, duration 1205 min` | 3 |
| 157 | `[CompilationError raised by Compile is handled in BuildPipeline, HealthCheckFailed …]` | 3 |
| 162 | `no choice of Test and Deploy fits the budget of SoftwareRelease; the cheapest, …` | 4 |
| 173 | `[Delivered, which the plan declares]` | 5 |
| 186 | `Delivered from LastMile, Shipped from Ship, Labelled from Label; Label via PrintLabel; …` | 6 |
| 191 | `Delivered from Courier; bound effort 2 person-hours, duration 200 min` | 7 |
| 194 | `no completion of Fulfil from the catalog: nothing produces Shipped, which LastMile needs` | 8 |
