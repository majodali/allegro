# Rung 2, scene 2: the domain's own notation, from a library

| Source | Rung | Milestone | Evidence for |
|---|---|---|---|
| `demos/rung2/02-literals.alg` | 2 | 6 | One substrate, many surfaces, and every surface is serious |

## Who and why

The engineer of scene 1 writes quantities in the notation of physics:
`3 m`, `9.8 m/s^2`. They want that notation to come from the units
library. They want ordinary code in the same file to read as before.

## Steps

1. **Does.** Writes `use units`. **Must find.** The text after it is read
   in a grammar that adds number-anchored quantity literals ("A text can
   change the grammar it is read in"; "Number-anchored quantity
   literals"). The change reaches to the end of the text and to no other
   text ("A grammar change reaches to the end of its block").
2. **Does.** Writes the literals `3 m`, `9.8 m/s^2`, `1.5 km` converted
   to m, and `2 kg·m/s^2` converted to N. **Must find.** Each literal
   stands for an expression of the units library's ordinary operators
   ("Every notation stands for an expression"). The run prints 3 m,
   9.8 m/s^2, 1500 m and 2 N.
3. **Does.** Writes `3 m + 400 cm` and `(5 J) instanceof Energy`. **Must
   find.** The literals compose with the operators and the refinements.
   The run prints 7 m and true.
4. **Does.** Writes ordinary code: `a = 3`, `zz = 5`, `a + zz`, and
   `when a is 3 then "three" else "other"`. **Must find.** A name or a
   number with no unit after it on the same line reads as before. Each
   text has one parse. The match has an `else`, so no arm can be missed
   ("A match where no arm matches is a refutation"). The run prints 8
   and three.

## Break it

**Does.** Writes `mismatch = 3 m + 4 s`. **Must find.** The refutation
of rung 2, scene 1's break-it (ruling 3 of 2026-11-15): the claim of `+`
that its operands have compatible dimensions is refuted when the
program is checked, carrying the predicate's explanation: cannot add m
and s, length vs time. It is found before any effect, so the run prints
nothing. Today the line is step 4 of the program and prints the error
value. Open question 3 asks whether milestone 6 needs a second break-it
case for the notation.

## What changes by ruling

- Ruling 3 of 2026-11-15 and "The standard language's handled failure
  is an exception": pin 20 reads an error value with `error of`. The
  mismatch is a refutation, found when the program is checked and
  carrying the same message as the predicate's explanation. The line
  moves to the break-it block, and `error of` leaves the source.
- Ruling 1 of 2026-11-15: the run prints although the units library's
  laws may stay short of decided.
- "Grammars combine without regard to order" and "Ambiguity is a
  claim": the library's rules are merged today with a conflict check at
  `use`. Combining grammars does not depend on their order, and a text
  with two parses is a refutation. No pinned line changes.
- "A module's summary is the weakest strength among its claims": the
  file draws the units library, whose five Quantity laws the standard
  deriver attempts (rung 2, scene 3). The summary is the weakest
  strength among them and the file's claims.

## Open questions

No question of this scene is settled by the rulings of 2026-11-15.
Pin 20 followed rung 2, scene 1's question 1, which ruling 3 settles.

1. "A grammar change reaches to the end of its block" says that
   importing a module's bindings does not bring its notation. `use
   units` does both today. Is it one form that imports the bindings and
   changes the grammar, or are these two forms? Recommended: two forms,
   with `use units` a notation that stands for both ("Every notation
   stands for an expression").
2. Who claims that the combined grammar is unambiguous: the units
   library, the standard language for every grammar, or no one, with
   each text that has two parses refuted? Recommended: no one claims it
   wholesale; each text with two parses is refuted ("Ambiguity is a
   claim").
3. Does milestone 6 need a break-it case for the notation, for example a
   text the combined grammar reads two ways? Recommended: yes, a text
   with two parses, refuted under "Ambiguity is a claim".

## Present pins

Nine pins. All are covered.

| Line | Pinned output | Step |
|---|---|---|
| 11 | `3 m` | 2 |
| 12 | `9.8 m/s^2` | 2 |
| 13 | `1500 m` | 2 |
| 14 | `2 N` | 2 |
| 17 | `7 m` | 3 |
| 18 | `true` | 3 |
| 20 | `cannot add m and s: length vs time` | Break it |
| 25 | `8` | 4 |
| 26 | `three` | 4 |
