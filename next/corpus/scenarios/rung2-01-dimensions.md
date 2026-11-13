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
3. **Does.** Adds `d + qty(150, cm)`. **Must find.** Addition within one
   dimension converts units. The run prints 4.5 m.
4. **Does.** Adds `d + t`. **Must find.** A failure that names both units
   and both dimensions: m and s, length and time. Whether it is a
   refutation or an exception is open (question 1).
5. **Does.** Converts `qty(5, km).to(m)` and `d.to(s)`. **Must find.**
   The first gives 5000 m. The second fails, naming m and s, length and
   time, of the same kind as step 4.
6. **Does.** Declares `speed(a: Acceleration, t: Duration): Velocity =>
   a.mul(t)` and calls it on 9.8 m/s² and 2 s. **Must find.** The
   parameter claims on entry and the return claim on exit hold, decided
   ("A typed function claims its parameter types on entry and its return
   type on exit"). The run prints 19.6 m/s.

## Break it

**Does.** Uncomments `wrong = speed(qty(3, m), qty(2, s))`. **Must
find.** The entry claim that `a` is an Acceleration is refuted. The
refutation names `speed`, the parameter `a` and the type Acceleration.
It is found while the program is checked, before any effect. Today the
program prints eight lines and then halts.

## What changes by ruling

- "The standard language's handled failure is an exception" and
  "Constructing a refined value claims its predicate": pins 22 and 27
  read an error value with `error of`. The error value is gone; what
  replaces it here is question 1.
- "A refutation marks everything computed from it" and "A typed
  function claims its parameter types on entry and its return type on
  exit": "Type error: argument 0 failed refinement predicate for
  Acceleration" becomes the refutation of `speed`'s entry claim. Under
  "Every failure carries a legible counterexample" it names the
  parameter `a`, where today it gives a position.
- "An effect consumes only values whose claims are decided": the
  break-it halt follows eight printed lines. The run prints nothing.
- "A module's summary is the weakest strength among its claims": the
  file draws the units library, whose five Quantity laws are undecided,
  so its summary is undecided.

## Open questions

1. Is adding quantities of different dimensions a wrong program, a
   refutation like `Positive(-1)`? Or is it a handled failure, an
   exception the program may read? The same question holds for `to`
   across dimensions, and for rung 2, scene 2, pin 20.
2. Do the named-dimension predicates explain their refusal ("A predicate
   can explain its refusal"), so that the break-it refutation names the
   value 3 m and its dimension, length, against length over time
   squared?

## Present pins

Eight pins. All are covered.

| Line | Pinned output | Step |
|---|---|---|
| 13 | `1.5 m/s` | 1 |
| 14 | `true` | 2 |
| 15 | `false` | 2 |
| 18 | `4.5 m` | 3 |
| 22 | `cannot add m and s: length vs time` | 4 |
| 25 | `5000 m` | 5 |
| 27 | `cannot convert m to s: length vs time` | 5 |
| 41 | `19.6 m/s` | 6 |
