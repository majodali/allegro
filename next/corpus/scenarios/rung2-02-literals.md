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
4. **Does.** Writes `mismatch = 3 m + 4 s`. **Must find.** The failure of
   rung 2, scene 1, step 4, naming m and s, length and time.
5. **Does.** Writes ordinary code: `a = 3`, `zz = 5`, `a + zz`, and
   `when a is 3 then "three" else "other"`. **Must find.** A name or a
   number with no unit after it on the same line reads as before. Each
   text has one parse. The match has an `else`, so no arm can be missed
   ("A match where no arm matches is a refutation"). The run prints 8
   and three.

## Break it

The scene has no break-it block, though the rung's README says each
scene has one. Its failure case is step 4. Open question 3 asks whether
milestone 6 needs one for the notation.

## What changes by ruling

- "The standard language's handled failure is an exception": pin 20
  reads an error value with `error of`. What replaces it is rung 2,
  scene 1, question 1.
- "Grammars combine without regard to order" and "Ambiguity is a
  claim": the library's rules are merged today with a conflict check at
  `use`. Combining grammars does not depend on their order, and a text
  with two parses is a refutation. No pinned line changes.
- "A module's summary is the weakest strength among its claims": the
  file draws the units library, whose five Quantity laws are undecided,
  so its summary is undecided.

## Open questions

1. "A grammar change reaches to the end of its block" says that
   importing a module's bindings does not bring its notation. `use
   units` does both today. Is it one form that imports the bindings and
   changes the grammar, or are these two forms?
2. Who claims that the combined grammar is unambiguous: the units
   library, the standard language for every grammar, or no one, with
   each text that has two parses refuted?
3. Does milestone 6 need a break-it case for the notation, for example a
   text the combined grammar reads two ways?

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
| 20 | `cannot add m and s: length vs time` | 4 |
| 25 | `8` | 5 |
| 26 | `three` | 5 |
