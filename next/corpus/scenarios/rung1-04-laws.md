# Rung 1, scene 4: laws carry their strength

| Source | Rung | Milestone | Evidence for |
|---|---|---|---|
| `demos/rung1/04-laws.alg`, `demos/rung1/transcripts/04-gate.txt` | 1 | 5 | Provability, positive and negative; the assumption ledger |

## Who and why

The developer gives a type its own equality. They want to see the law
claims that creates, how each is decided and at what strength, and an
assumption shown on the record. Nothing may be granted silently. They
also want a wrong equality caught with a counterexample.

## Steps

1. **Does.** States `theorem t_int: 1 == 1 by proof_trans(proof_refl(1),
   proof_refl(1))` and binds the same term to `p`. **Must find.** The
   claim holds, decided by evaluation. The proof records Int equality
   and the strength of its transitivity law: assumed, with the platform
   named as the author of the assumption (ruling 5 of 2026-11-15). The
   run prints that strength, assumed.
2. **Does.** Declares `Cell`, drawing `Equatable` with its own `eq`,
   `self.x == other.x` over an Int field, and `v = Cell(1)`. **Must
   find.** Three law claims for `Cell`: refl, sym and trans ("Lawful
   interfaces"). The standard deriver derives each law still undecided
   after evaluation from Int's equality laws, since the equality is
   field by field (ruling 5). A derived law carries the strength of what
   it rests on, so each is assumed while Int's laws are. The record
   names the deriver as the proposer of each derivation.
3. **Does.** Calls `Law.assume(Cell, "trans")`. **Must find.** Cell's
   transitivity law has the strength assumed, on the record ("An
   assumption is always on the record") with the file as its author.
   Whether the deriver also attempts it is question 2; the strength is
   assumed either way.
4. **Does.** States `theorem t_cell: v == v by
   proof_trans(proof_refl(v), proof_refl(v))` and binds the term to `q`.
   **Must find.** The transitivity rule accepts the term because the law
   is assumed. The proof takes the strength assumed, since a result
   resting on a weaker result takes the weaker strength. It names the
   assumptions it rests on. The run prints assumed.
5. **Does.** Declares `Cell2` over a Bool field and calls
   `Law.witness(Cell2, "refl", prove_for_all_bool(b => b == b))`.
   **Must find.** Cell2's refl law is decided, by enumerating Bool. This
   follows from ruling 5: the standard deriver derives Cell2's sym and
   trans from Bool's equality laws, which are decided by enumeration, so
   they are decided too.
6. **Does.** Runs `verify`. **Must find.** Each law with its strength
   and what it rests on: Cell's three assumed, resting on Int's; Cell2's
   three decided. `t_cell` and `q` assumed, resting on Cell's trans. The
   standard types' laws as in scene 1. This follows: no claim is left
   undecided, so the module's summary, the weakest strength among its
   claims, is assumed.
7. **Does.** Prints `"laws carry their strength"`. **Must find.** The
   run prints it.

## Break it

**Does.** Declares a type whose equality is wrong: `Near`, over an Int
field, equal when the values differ by at most one. **Must find.** The
standard deriver attempts Near's three laws within its budget (ruling
5). It does not decide transitivity. A sample breaks it: three values,
each within one of the next, the first and last two apart (for example
0, 1 and 2). The trans law is refuted with that counterexample. The refutation names `Near`, the law
trans and the three values. It is found while the program is checked,
before any effect, so the run prints nothing.

## What changes by ruling

- "Four strengths, one vocabulary": pin 10 reads `kernel` and pin 40
  reads `admitted`. Both become assumed (pin 10 by ruling 5).
  `verify`'s "discharged", "ADMITTED" and "pending" become decided,
  assumed and undecided. The refusal's "neither proven nor admitted"
  and "no discharged, sampled, or admitted 'trans' law" use the same
  four words.
- Ruling 5 of 2026-11-15: Cell's laws are derived and assumed while
  Int's are, where today they are pending. Cell2's sym and trans are
  derived and decided. Int equality's laws are assumed, with the
  platform named, where today the tier is `kernel`.
- Ruling 2 of 2026-11-15 and "A proof term is a proposal": the present
  break-it, a `by` term the transitivity rule refuses on `v == v`, halts
  the program today. A refused proposal does not refute its claim. The
  claim's outcome is what evaluation gives: `v == v` is decided by
  evaluation. The refusal is recorded with the rule's explanation, and
  nothing halts. With the deriver, Cell's transitivity is assumed, so
  the rule does not refuse that term here. The break-it becomes a wrong
  equality.
- "Every result says how strongly it holds": `verify` marks `t_cell`
  and `q` discharged with a note that they rest on an admitted law.
  Their strength is assumed. The heading reads "verified" while four
  laws wait.
- "A module's summary is the weakest strength among its claims": the
  grade `proven-safe` becomes assumed (this follows, step 6).
- "Anyone may propose, and the record shows who": the verdict credits
  each theorem to `auto-PE`. The result names the file as the proposer
  of each `by` term and the author of the assumption, and the deriver as
  the proposer of each derived law.

## Open questions

Settled: question 1 of the draft, a refused `by` term on a claim that
holds by evaluation (ruling 2). Question 3, whether Cell's refl and
sym are decided (ruling 5: the standard deriver derives them, assumed
while Int's laws are). Question 4, the strength of Int equality's
transitivity in pin 10 (ruling 5: assumed).

1. `p` and `q` are proof values bound without `theorem`. The verdict
   lists them as theorems. Is binding a proof value a claim ("Nothing is
   a claim until someone makes it")? Recommended: no. A proof value is a
   value that carries the record of what it rests on, and the result
   lists it as a value, not as a claim.
2. New with ruling 5: the standard deriver runs for each claim still
   undecided after evaluation. Does it attempt a law the file has
   assumed, such as Cell's transitivity after `Law.assume`? Recommended:
   no, since an assumed claim is not undecided. Here the strength is
   assumed either way. In rung 2, scene 3, pin 32 follows the answer.

## Present pins

Three pins. All are covered.

| Line | Pinned output | Step |
|---|---|---|
| 10 | `kernel` | 1 |
| 40 | `admitted` | 4 |
| 45 | `laws carry their strength` | 7 |
