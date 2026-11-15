# Rung 2, scene 1: dimensional soundness is refinement checking

| Source | Rung | Milestone | Evidence for |
|---|---|---|---|
| `demos/rung2/01-dimensions.alg`, `demos/rung2/transcripts/01-halt.txt` | 2 | 6 | One substrate, many surfaces, and every surface is serious |

## Who and why

An engineer computes with physical quantities through the units
library, which is written in Allegro. They want a dimension error found
by the same machinery that checks `PositiveInt`. They want it reported
in units and dimensions.

## Steps

1. **Does.** Builds `d = qty(3, m)`, `t = qty(2, s)` and `v = d.div(t)`,
   and prints `v`. **Must find.** `v` is 1.5 m/s, with the dimension
   length over time.
2. **Does.** Asks `v instanceof Velocity` and `v instanceof Force`.
   **Must find.** Each named dimension is a refinement over one
   `Quantity` ("Dimensions as data, named dimensions as refinements over
   one Quantity"). Its predicate, evaluated over `v`'s dimension vector,
   answers true for Velocity and false for Force.
3. **Does.** Adds `d + qty(150, cm)`. **Must find.** `+` claims that its
   operands have compatible dimensions (ruling 3 of 2026-11-15). The
   claim holds, decided. Addition within one dimension converts units.
   The run prints 4.5 m.
4. **Does.** Converts `qty(5, km).to(m)`. **Must find.** `to` makes the
   same claim, and it holds. The run prints 5000 m.
5. **Does.** Declares `speed(a: Acceleration, t: Duration): Velocity =>
   a.mul(t)` and calls it on 9.8 m/s² and 2 s. **Must find.** The
   parameter claims on entry and the return claim on exit hold, decided
   ("A typed function claims its parameter types on entry and its return
   type on exit"). The run prints 19.6 m/s.
6. **Does.** Reads a quantity `x` from the program's input, guards it
   with the units library's test that `x` has the dimension of `d`, and
   adds `d + x` only where the test answers true. **Must find.** The
   guard calls the same predicate that `+` claims (ruling 3). Where it
   answers true, the claim of `+` is decided from that knowledge before
   the run begins. Where it answers its explanation, the program prints
   that explanation as a value. This follows from rulings 3 and 4: a
   guard treats an explanation as not true. No exception is raised, and
   no check is caught.
7. **Does.** Removes the guard of step 6. **Must find.** The claim of
   `+` on `d + x` cannot be decided before `x` arrives. The policy
   "every parameter claim is decided before the run begins" is on by
   default, so the run does not begin, and the result names the
   undecided claim. A user may configure the policy not to apply to a
   script or similar execution. Then the claim is evaluated when `x`
   arrives, with the same meaning, and a failure is a refutation.

## Break it

**Does.** Writes `d + t`. **Must find.** The claim of `+` that its
operands have compatible dimensions is refuted when the program is
checked (ruling 3). The refutation carries the predicate's explanation:
cannot add m and s, length vs time. It is found before any effect, so
the run prints nothing.

**Does.** Writes `d.to(s)`. **Must find.** The claim of `to` is refuted
in the same way, carrying: cannot convert m to s, length vs time.

**Does.** Uncomments `wrong = speed(qty(3, m), qty(2, s))`. **Must
find.** The entry claim that `a` is an Acceleration is refuted. The
refutation names `speed`, the parameter `a` and the type Acceleration.
The predicate's explanation names the value, 3 m, its dimension,
length, and the one expected, length over time squared (ruling P of
2026-11-15, round 4). It is found while the program is checked, before any effect. Today the
program prints eight lines and then halts.

## What changes by ruling

- Ruling 3 of 2026-11-15, "A typed function claims its parameter types
  on entry and its return type on exit" and "The standard language's
  handled failure is an exception": pins 22 and 27 read an error value
  with `error of`. A predicate on a parameter stays a claim, with the
  same meaning at every phase. `d + t` and `d.to(s)` are refuted when
  the program is checked, each carrying the message of today's error
  value as the predicate's explanation. The two lines move to the
  break-it block. The error value and `error of` leave the source.
- "A refutation marks everything computed from it" and "A typed
  function claims its parameter types on entry and its return type on
  exit": "Type error: argument 0 failed refinement predicate for
  Acceleration" becomes the refutation of `speed`'s entry claim. Under
  "Every failure carries a legible counterexample" it names the
  parameter `a`, where today it gives a position.
- "An effect consumes only values whose claims are decided": the
  break-it halt follows eight printed lines. A refutation is found
  before any effect, and the run prints nothing.
- Ruling 1 of 2026-11-15: the run prints although the units library's
  five Quantity laws may stay short of decided. A strength prevents no
  effect unless a policy or configuration requires it.
- "A module's summary is the weakest strength among its claims": the
  file draws the units library, whose five Quantity laws the standard
  deriver attempts (rung 2, scene 3). The summary is the weakest
  strength among them and the file's claims.

## Questions, as settled

Every question this scene raised is settled. Rulings 1 to 5 and the
letters A to X are stated in the index (`README.md`, "Rulings of
2026-11-15").

- Whether a dimension mismatch is a refutation or a handled failure:
  ruling 3 (a refutation, the message as the predicate's explanation).
- Whether the named-dimension predicates explain their refusal: ruling P
  (yes: the value, its dimension and the one expected).

## Present pins

Eight pins. All are covered.

| Line | Pinned output | Step |
|---|---|---|
| 13 | `1.5 m/s` | 1 |
| 14 | `true` | 2 |
| 15 | `false` | 2 |
| 18 | `4.5 m` | 3 |
| 22 | `cannot add m and s: length vs time` | Break it |
| 25 | `5000 m` | 4 |
| 27 | `cannot convert m to s: length vs time` | Break it |
| 41 | `19.6 m/s` | 5 |
