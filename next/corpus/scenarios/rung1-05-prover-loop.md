# Rung 1, scene 5: one loop for every prover

| Source | Rung | Milestone | Evidence for |
|---|---|---|---|
| `demos/rung1/05-prover-loop.md` (a walkthrough; no program of its own) | 1 | 5 | Participant-neutral collaboration: the kernel is the trust boundary |

## Who and why

A prover answers a theorem whose proof term is wrong. The prover may be
a person editing the file, a language model or a tool. Each gets the
same obligation and the same check. The kernel trusts no prover, and
the record keeps who answered.

## Steps

1. **Does.** The author writes `double(x: Int): Int => x + x` and
   `theorem double_four: double(2) == 4 by proof_refl(987654321)`, and
   runs check. **Must find.** The proposed term establishes `987654321
   == 987654321`, a different equation. The kernel refuses the term. The
   refusal names the claim, `double(2) == 4`, and what the term proves.
2. **Does.** Runs `obligations --pending`, the form for programs. **Must
   find.** One open obligation, `double_four`: its proposition, an
   identity that a proposal is checked against, and the prior attempt
   with its refusal. The standard types' laws and the coercion claims
   are not listed, since they are decided.
3. **Does.** Runs `propose`, the form for people. **Must find.** The same
   obligation, with its last failure (the reason and the counterexample)
   and what is in scope, such as `double` and its type.
4. **Does.** Runs `prove` with a proposer: a language model or a script.
   **Must find.** The tool sends the proposer the primer and the
   obligation ("One primer for every proposer"). The proposer answers
   with a proof term and nothing else. The tool places the term, has the
   claim evaluated again, and keeps the term only if the claim is
   decided. On a refusal it asks again with the reason, for a bounded
   number of attempts.
5. **Does.** The proposer answers `proof_refl(double(2))`. **Must find.**
   The claim holds, decided. The result records the proposer's name and
   the attempts it used.
6. **Does.** Runs `verify` on the proved file. **Must find.** The
   verdict lists `double_four` as decided and names its proposer.

## Break it

**Does.** The proposer answers `proof_refl(1)`, a term that proves a
true equation other than the claim. **Must find.** The kernel refuses
it: the term does not establish the obligation's proposition. The
obligation stays open. The attempt and its refusal are recorded.

## What changes by ruling

- "Anyone may propose, and the record shows who": the verdict credits
  the proved theorem to `auto-PE`, and authorship appears only in
  `prove`'s own output. The result keeps the proposer, and `verify`
  names it.
- "Four strengths, one vocabulary": "verified=false", "Verdict
  (FAILED)", "discharged" and "pending" become the four strengths and
  refuted.
- "Open obligations are listed for any proposer": `obligations` without
  `--pending` lists decided claims as obligations. The form for people
  lacks what is in scope.

## Open questions

1. With a refused term, is `double_four` refuted or undecided? Today
   both hold at once: `run` halts with exit 1 and `obligations` lists the
   theorem as pending. This is question 1 of scene 4.
2. An obligation is identified today by a hash over its proposition. No
   ruled decision names how an obligation is identified. Is the hash
   kept?
3. The walkthrough's `propose` and `verify` print hints such as "match
   the proposition exactly". Under "A tool reads a phase's result and
   adds no analysis of its own", are hints part of the result, or
   dropped?
4. Is a scripted proposer enough to pass milestone 5, with a language
   model's run recorded once as rung 4 does?
5. The walkthrough's last section reports a benchmark: partial
   evaluation alone decides its ten closed propositions. Is the
   benchmark part of this scenario, or a separate case?

## Present pins

None. The walkthrough is not a program, and no test of the present tree
runs it. Its commands and outputs are covered by steps 1 to 6 and the
break-it step.
