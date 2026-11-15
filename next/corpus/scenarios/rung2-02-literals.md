# Rung 2, scene 2: the domain's own notation, from a library

| Source | Rung | Milestone | Evidence for |
|---|---|---|---|
| `demos/rung2/02-literals.alg` | 2 | 6 | One substrate, many surfaces, and every surface is serious |

## Who and why

The engineer of scene 1 writes quantities in the notation of physics:
`3 m`, `9.8 m/s^2`. They want that notation to come from the units
library. They want ordinary code in the same file to read as before.

## Steps

1. **Does.** Writes `use units`. **Must find.** Two acts have two words
   (ruling Q of 2026-11-15, round 4): `import units` brings the
   library's bindings only, and `use units` brings the bindings and the
   notation. The text itself asks for the notation. The text after `use`
   is read in a grammar that adds number-anchored quantity literals ("A
   text can change the grammar it is read in"; "Number-anchored
   quantity literals"). The change reaches to the end of the block it is
   written in and to no other text ("A grammar change reaches to the end
   of its block").
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
   text has one parse. Nobody has to claim that the combined grammar is
   unambiguous: a text with two parses is always refuted (ruling R). A
   library may claim its notation unambiguous beside the standard one;
   the deriver then samples the claim, and a counterexample is a text
   with two parses. The match has an `else`, so no arm can be missed
   ("A match where no arm matches is a refutation"). The run prints 8
   and three.

## Break it

**Does.** Writes `mismatch = 3 m + 4 s`. **Must find.** The refutation
of rung 2, scene 1's break-it (ruling 3 of 2026-11-15): the claim of `+`
that its operands have compatible dimensions is refuted when the
program is checked, carrying the predicate's explanation: cannot add m
and s, length vs time. It is found before any effect, so the run prints
nothing. Today the line is step 4 of the program and prints the error
value.

**Does.** Writes a text that the combined grammar reads two ways.
**Must find.** The text is refuted ("Ambiguity is a claim"), and the
refutation names both readings (ruling S). It is found before any
effect. The case's text is chosen when the grammar is built: today's
engine resolves such a text by the order of its alternatives, which
the ruled decision removes.

## What changes by ruling

- Ruling 3 of 2026-11-15 and "The standard language's handled failure
  is an exception": pin 20 reads an error value with `error of`. The
  mismatch is a refutation, found when the program is checked and
  carrying the same message as the predicate's explanation. The line
  moves to the break-it block, and `error of` leaves the source.
- Ruling 1 of 2026-11-15: the run prints although the units library's
  laws may stay short of decided.
- Ruling Q of 2026-11-15, round 4: `use units` today both imports and
  changes the grammar. `import units` brings the bindings only, and the
  programs that write `use` keep working.
- "Grammars combine without regard to order" and "Ambiguity is a
  claim": the library's rules are merged today with a conflict check at
  `use`. Combining grammars does not depend on their order, and a text
  with two parses is a refutation. No pinned line changes.
- "A module's summary is the weakest strength among its claims": the
  file draws the units library, whose five Quantity laws the standard
  deriver attempts (rung 2, scene 3). The summary is the weakest
  strength among them and the file's claims.

## Questions, as settled

Every question this scene raised is settled. Rulings 1 to 5 and the
letters A to X are stated in the index (`README.md`, "Rulings of
2026-11-15").

- Whether `use units` is one form or two: ruling Q (`import` brings the
  bindings; `use` brings the bindings and the notation).
- Who claims the combined grammar unambiguous: ruling R (nobody has to;
  a library may).
- Whether milestone 6 needs a notation break-it case: ruling S (yes).

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
