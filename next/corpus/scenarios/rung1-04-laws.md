# Rung 1, scene 4: laws carry their strength

| Source | Rung | Milestone | Evidence for |
|---|---|---|---|
| `demos/rung1/04-laws.alg`, `demos/rung1/transcripts/04-gate.txt` | 1 | 5 | Provability, positive and negative; the assumption ledger |

## Who and why

The developer gives a type its own equality. They want to see the law
claims that creates, the transitivity rule refusing a chain it cannot
trust, and an assumption that unlocks it shown on the record. Nothing
may be granted silently.

## Steps

1. **Does.** States `theorem t_int: 1 == 1 by proof_trans(proof_refl(1),
   proof_refl(1))` and binds the same term to `p`. **Must find.** The
   claim holds, decided. The proof records Int equality and the
   strength of its transitivity law. The run prints that strength.
2. **Does.** Declares `Cell`, drawing `Equatable` with its own `eq`, and
   `v = Cell(1)`. **Must find.** Three law claims for `Cell`: refl, sym
   and trans, each undecided ("Lawful interfaces").
3. **Does.** Calls `Law.assume(Cell, "trans")`. **Must find.** Cell's
   transitivity law has the strength assumed. The assumption is on the
   record ("An assumption is always on the record"), with the file as
   its author.
4. **Does.** States `theorem t_cell: v == v by
   proof_trans(proof_refl(v), proof_refl(v))` and binds the term to `q`.
   **Must find.** The transitivity rule accepts the term because the law
   is assumed. The claim holds at the strength assumed, since a result
   resting on a weaker result takes the weaker strength. It names the
   assumption it rests on. The run prints assumed.
5. **Does.** Declares `Cell2` over a Bool field and calls
   `Law.witness(Cell2, "refl", prove_for_all_bool(b => b == b))`.
   **Must find.** Cell2's refl law is decided, by enumerating Bool.
   Cell2's sym and trans laws are undecided.
6. **Does.** Runs `verify`. **Must find.** Each law with its strength:
   Cell's trans assumed; Cell's refl and sym, Cell2's sym and trans
   undecided; Cell2's refl decided. `t_cell` assumed, resting on Cell's
   trans. The module's summary is undecided, the weakest strength among
   its claims.
7. **Does.** Prints `"laws carry their strength"`. **Must find.** The
   run prints it.

## Break it

**Does.** Removes `Law.assume` and uncomments `theorem t_bad: v == v by
proof_trans(proof_refl(v), proof_refl(v))`. **Must find.** The
transitivity rule refuses the term: Cell's transitivity is neither
decided nor assumed. The refusal names `Cell`, the law trans and both
ways forward: decide the law with a proof (`Law.witness`) or assume it
(`Law.assume`). It is found while the program is checked, before any
effect. Today the program prints two lines and then halts.

## What changes by ruling

- "Four strengths, one vocabulary": pin 10 reads `kernel` and pin 40
  reads `admitted`. They become decided and assumed. `verify`'s
  "discharged", "ADMITTED" and "pending" become decided, assumed and
  undecided. The refusal's "neither proven nor admitted" and "no
  discharged, sampled, or admitted 'trans' law" use the same four words.
- "Every result says how strongly it holds": `verify` marks `t_cell`
  and `q` discharged with a note that they rest on an admitted law.
  Their strength is assumed. The heading reads "verified" while four
  laws wait.
- "A module's summary is the weakest strength among its claims": the
  grade `proven-safe` becomes undecided.
- "Anyone may propose, and the record shows who": the verdict credits
  each theorem to `auto-PE`. The result names the file as the proposer
  of each `by` term and the author of the assumption.
- "An effect consumes only values whose claims are decided": the
  break-it halt follows two printed lines. The run prints nothing.

## Open questions

1. A `by` term that the transitivity rule refuses sits on a claim,
   `v == v`, that holds by evaluation. Is the theorem refuted, which
   halts the program as today? Or is it undecided, with the refused
   proposal on the record? The same question stands in scene 5 and in
   rung 2, scene 3.
2. `p` and `q` are proof values bound without `theorem`. The verdict
   lists them as theorems. Is binding a proof value a claim ("Nothing is
   a claim until someone makes it")?
3. Cell's `eq` is `self.x == other.x` over Int. Could the standard
   extension decide Cell's refl and sym by evaluating them with the
   value unknown? Must milestone 5 do so, or keep them undecided as the
   scene shows?
4. Pin 10 depends on question 1 of scene 1: is Int equality's
   transitivity decided by evaluation, or assumed as a declared law?

## Present pins

Three pins. All are covered.

| Line | Pinned output | Step |
|---|---|---|
| 10 | `kernel` | 1 |
| 40 | `admitted` | 4 |
| 45 | `laws carry their strength` | 7 |
