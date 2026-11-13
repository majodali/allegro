# Rung 2, scene 3: physics theorems and the laws at their real strength

| Source | Rung | Milestone | Evidence for |
|---|---|---|---|
| `demos/rung2/03-laws.alg`, `demos/rung2/transcripts/03-gate.txt` | 2 | 6 | One substrate, many surfaces; the assumption ledger |

## Who and why

The engineer states physics facts as theorems. They want each decided
by evaluation. They want the units library's own laws shown at the
strength each has earned, including those still undecided.

## Steps

1. **Does.** States `theorem km_scale: 1 km == 1000 m`, `theorem
   min_scale: 90 min == 1.5 h` and `theorem newton_ident: 1 N == 1
   kg·m/s^2`. **Must find.** Each holds, decided by evaluation.
2. **Does.** Writes `verify (9.8 m/s^2).mul(2 s) == 19.6 m/s`. **Must
   find.** An anonymous claim ("A proof term is a proposal"). It holds,
   decided. The result lists it.
3. **Does.** Declares `force_of(mass: Mass, acc: Acceleration): Force`
   and states `theorem f_ma: force_of(2 kg, 9.8 m/s^2) == 19.6 N`.
   **Must find.** The entry and exit claims of `force_of` hold at the
   call. The theorem holds, decided.
4. **Does.** Calls `Law.assume(Quantity, "trans")`. **Must find.**
   Quantity's transitivity law has the strength assumed, on the record
   with the file as its author.
5. **Does.** Binds `q = 5 m`, states `theorem q_chain: q == q by
   proof_trans(proof_refl(q), proof_refl(q))` and binds the term to `p`.
   **Must find.** The transitivity rule accepts the term. The claim holds
   at the strength assumed and names the assumption. The run prints
   assumed.
6. **Does.** Runs `verify`. **Must find.** Quantity's laws at their
   strengths ("Quantity laws at honest tiers"): trans assumed; refl,
   sym, `mul_comm` and `conv_roundtrip` undecided. `q_chain` assumed,
   resting on trans. The theorems of steps 1 to 3 decided. The module's
   summary is undecided.
7. **Does.** Prints `"physics with receipts"`. **Must find.** The run
   prints it.

## Break it

**Does.** Removes `Law.assume`, uncomments `qx = 5 m` and `theorem bad:
qx == qx by proof_trans(proof_refl(qx), proof_refl(qx))`. **Must find.**
The transitivity rule refuses the term: Quantity's transitivity is
neither decided nor assumed. The refusal names `Quantity`, the law trans
and both ways forward, `Law.witness` and `Law.assume`. It is found while
the program is checked, before any effect. Today the program prints a
line and then halts.

## What changes by ruling

- "Four strengths, one vocabulary": pin 32 reads `admitted` and becomes
  assumed. `verify`'s "discharged", "ADMITTED" and "pending", and the
  refusal's "neither proven nor admitted", use the four strengths.
- "Every result says how strongly it holds": `verify` marks `q_chain` and
  `p` discharged with a note. Their strength is assumed. The heading
  reads "verified" while four laws wait.
- "A module's summary is the weakest strength among its claims": the
  summary is undecided.
- "A proof term is a proposal": the anonymous claim of step 2 is missing
  from today's verdict. The result lists it.
- "Anyone may propose, and the record shows who": the verdict credits
  each theorem to `auto-PE`. The result names the file as proposer of
  the `by` term and author of the assumption.
- "An effect consumes only values whose claims are decided": the
  break-it halt follows a printed line. The run prints nothing.

## Open questions

1. Quantity's refl and sym are undecided because a law over a record
   type has no sample construction. Must milestone 6 keep them
   undecided, as the scene shows, or reach sampled?
2. A refused `by` term on a claim that holds by evaluation: refuted or
   undecided? This is rung 1, scene 4, question 1.
3. Is the proof value `p`, bound without `theorem`, a claim? This is
   rung 1, scene 4, question 2.

## Present pins

Two pins. Both are covered.

| Line | Pinned output | Step |
|---|---|---|
| 32 | `admitted` | 5 |
| 39 | `physics with receipts` | 7 |
