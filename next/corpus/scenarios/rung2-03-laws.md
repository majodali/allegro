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
   **Must find.** The transitivity rule accepts the term. The claim
   `q == q` is decided, since evaluation decides it (ruling N of
   2026-11-15, round 3). The proof takes the strength of Quantity's
   transitivity law and names the assumption. The deriver does not
   attempt a law the author has assumed (ruling O), so that strength is
   assumed. `p` is no claim (ruling G). The run prints the strength `p`
   records, assumed.
6. **Does.** Runs `verify`. **Must find.** Quantity's five laws, refl,
   sym, trans, `mul_comm` and `conv_roundtrip` ("Quantity laws at honest
   tiers"), each under the standard deriver (ruling 5 of 2026-11-15).
   Each law still undecided after evaluation is attempted within the
   build's budgets, in the order evaluation, sampling, derivation, and
   ends at the strongest strength reached: decided, sampled or
   undecided. Where it ends short of decided, the record says a
   derivation was tried and where it stopped. A law the deriver cannot
   sample within its allowance is recorded as not sampled. The scene
   requires the attempt and the record, not a particular strength.
   `q_chain` and the theorems of steps 1 to 3 decided. `p` is not
   listed. Quantity's transitivity is assumed and not attempted
   (ruling O). The module's summary is the weakest strength among
   its claims.
7. **Does.** Prints `"physics with receipts"`. **Must find.** The run
   prints it. A strength short of decided prevents no effect (ruling 1).

## Break it

**Does.** Removes `Law.assume`, uncomments `qx = 5 m` and `theorem bad:
qx == qx by proof_trans(proof_refl(qx), proof_refl(qx))`. **Must find.**
Where the standard deriver has not decided Quantity's transitivity, the
transitivity rule refuses the term: the law is neither decided nor
assumed. A refused proposal does not refute its claim (ruling 2 of
2026-11-15). The claim's outcome is what evaluation gives: `qx == qx`
is decided by evaluation. The refusal is recorded with the rule's
explanation, which names `Quantity`, the law trans and both ways
forward, `Law.witness` and `Law.assume`. Nothing halts, and the run
prints as in steps 1 to 7. Today the program prints a line and then
halts.

## What changes by ruling

- "Four strengths, one vocabulary": pin 32 reads `admitted` and becomes
  assumed. `verify`'s "discharged", "ADMITTED" and "pending", and the
  refusal's "neither proven nor admitted", use the four strengths.
- Ruling 5 of 2026-11-15: today Quantity's refl, sym, `mul_comm` and
  `conv_roundtrip` are pending because a law over a record type has no
  sample construction. The standard deriver attempts each within its
  budgets and records where it stopped.
- Ruling 2 of 2026-11-15 and "A proof term is a proposal": the break-it
  term is refused and recorded, and nothing halts. The anonymous claim
  of step 2 is missing from today's verdict. The result lists it.
- Ruling 1 of 2026-11-15: the prints proceed whatever strength the laws
  reach.
- "Every result says how strongly it holds": `verify` marks `q_chain` and
  `p` discharged with a note. `q_chain` is decided by evaluation
  (ruling N), its proof recording the assumed law; `p` is not listed
  (ruling G). The heading reads "verified" while four laws wait.
- "A module's summary is the weakest strength among its claims": the
  summary is one word, the weakest strength among the file's claims and
  the laws it draws.
- "Anyone may propose, and the record shows who": the verdict credits
  each theorem to `auto-PE`. The result names the file as proposer of
  the `by` term and author of the assumption, and the deriver as
  proposer of each law it decides.

## Open questions

None. Settled: question 1 of the draft, whether Quantity's refl and sym
stay undecided or reach sampled (ruling 5: each is attempted under the
standard deriver, and the scene requires the attempt and its record).
Question 2, a refused `by` term on a claim that holds by evaluation
(ruling 2). Ruled 2026-11-15, round 3: question 3, whether `p` is a
claim (ruling G: no). Whether the deriver attempts Quantity's assumed
transitivity (ruling O: no, so pin 32 prints assumed).

## Present pins

Two pins. Both are covered.

| Line | Pinned output | Step |
|---|---|---|
| 32 | `admitted` | 5 |
| 39 | `physics with receipts` | 7 |
