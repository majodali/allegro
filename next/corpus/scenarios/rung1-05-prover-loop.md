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
   refusal belongs to the proposal and is recorded with the rule's
   explanation: the claim, `double(2) == 4`, and what the term proves. A
   refused proposal does not refute its claim (ruling 2 of 2026-11-15).
   The claim's outcome is what evaluation gives: `double(2) == 4` is
   decided by evaluation. Nothing halts. The policy "no proposal in the
   source is refused" exists and is off by default.
2. **Does.** Runs `obligations --pending`, the form for programs. **Must
   find.** The open obligations: the claims that wait for a value. This
   follows from ruling 2: `double_four` is decided, so it is not among
   them, and its refused proposal is on the record. The walkthrough's
   loop needs a claim that evaluation leaves undecided (open question
   5). Each obligation listed has its proposition, an identity that a
   proposal is checked against, and its prior attempts with their
   refusals. The standard types' laws and the coercion claims are not
   listed: none waits for a value.
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
5. **Does.** The proposer answers a term the kernel accepts. **Must
   find.** The claim holds, decided. The result records the proposer's
   name and the attempts it used.
6. **Does.** Runs `verify` on the proved file. **Must find.** The
   verdict lists the claim as decided and names its proposer.

## Break it

**Does.** The proposer answers `proof_refl(1)`, a term that proves a
true equation other than the claim. **Must find.** The kernel refuses
it: the term does not establish the obligation's proposition. The
refusal does not refute the claim (ruling 2), and the obligation stays
open. The attempt and its refusal are recorded.

## What changes by ruling

- Ruling 2 of 2026-11-15 and "A proof term is a proposal": today a
  refused term makes `run` halt with exit 1 while `obligations` lists
  the theorem as pending. A refused proposal does not refute its claim;
  `double_four` is decided by evaluation, and the refusal is on the
  record. Nothing halts.
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

Settled: question 1 of the draft, whether `double_four` with a refused
term is refuted or undecided (ruling 2: neither; it is decided by
evaluation, and the refusal is recorded).

1. An obligation is identified today by a hash over its proposition. No
   ruled decision names how an obligation is identified. Is the hash
   kept? Recommended: yes, as a content hash of the proposition, in the
   manner of "A saved program names what it needs by content hash".
2. The walkthrough's `propose` and `verify` print hints such as "match
   the proposition exactly". Under "A tool reads a phase's result and
   adds no analysis of its own", are hints part of the result, or
   dropped? Recommended: dropped from the result; the refusal's
   explanation is what the proposer receives.
3. Is a scripted proposer enough to pass milestone 5, with a language
   model's run recorded once as rung 4 does? Recommended: yes.
4. The walkthrough's last section reports a benchmark: partial
   evaluation alone decides its ten closed propositions. Is the
   benchmark part of this scenario, or a separate case? Recommended: a
   separate case.
5. New with ruling 2: `double_four` is decided by evaluation, so the
   walkthrough's loop has no obligation to close. Which claim does the
   walkthrough use? Recommended: a claim over every value of a type that
   evaluation with the value unknown leaves undecided, and that the
   standard deriver does not decide within its default budget.
6. New with ruling 2: does any tool offer a refused proposal on a
   decided claim for repair, though no obligation is open? Recommended:
   no. The result holds the refusal with its explanation, and a tool
   shows it where it is configured to.

## Present pins

None. The walkthrough is not a program, and no test of the present tree
runs it. Its commands and outputs are covered by steps 1 to 6 and the
break-it step.
