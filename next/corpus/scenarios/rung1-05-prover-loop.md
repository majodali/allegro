# Rung 1, scene 5: one loop for every prover

| Source | Rung | Milestone | Evidence for |
|---|---|---|---|
| `demos/rung1/05-prover-loop.md` (a walkthrough; no program of its own) | 1 | 5 | Participant-neutral collaboration: the kernel is the trust boundary |

## Who and why

A prover answers a claim that evaluation cannot decide. The prover may
be a person editing the file, a language model, a script or the
standard deriver. Each gets the same obligation and the same check. The
kernel trusts no prover, and the record keeps who answered.

The example is the scenario's own choice (ruling L of 2026-11-15, round
3): the walkthrough's `double_four` holds by evaluation, so it leaves
nothing to answer (ruling 2). The scenario uses a small claim over
every Int instead.

## Steps

1. **Does.** The author writes `double(x: Int): Int => x + x` and
   `theorem double_times_two: for every x: Int, double(x) == 2 * x`,
   sets the derivation budget to zero, and runs check. **Must find.**
   Evaluation with `x` unknown leaves `x + x == 2 * x` unresolved, so
   the claim is undecided. This is the scenario's choice of claim: one
   that evaluation cannot decide. With the budget at zero the standard
   deriver does not attempt it. Nothing halts.
2. **Does.** Runs `obligations --pending`, the form for programs. **Must
   find.** One open obligation, named by where its claim is made: the
   module and `double_times_two` (ruling H). No hash over the
   proposition's text names it. The listing holds its proposition and
   its prior attempts with their refusals. The standard types' laws and
   the coercion claims are not listed: none waits for a value.
3. **Does.** Runs `propose`, the form for people. **Must find.** The same
   obligation, with what is in scope, such as `double` and its type, and
   the last refusal's explanation. A hint is that explanation, as the
   refusing rule or the deriver gave it; the tool adds none of its own
   (ruling I). Advice written for one kind of proposer is in the primer.
4. **Does.** Runs `prove` with a proposer: a scripted proposer, enough
   for milestone 5 (ruling J), or a language model, whose run is
   recorded once and whose answers a test replays through the kernel.
   **Must find.** The tool sends the proposer the primer and the
   obligation ("One primer for every proposer"). The proposer answers
   with a proof term and nothing else. The tool places the term, has the
   claim evaluated again, and keeps the term only if the claim is
   decided by it. On a refusal it asks again with the explanation, for a
   bounded number of attempts.
5. **Does.** The proposer answers a term the kernel accepts. **Must
   find.** The claim holds. Its strength is that of what the term rests
   on: the term is what establishes it, so a term that uses an assumed
   law of Int reads assumed (ruling N). The result records the
   proposer's name and the attempts it used.
6. **Does.** Runs `verify` on the proved file. **Must find.** The
   verdict lists `double_times_two` with its strength and names its
   proposer.
7. **Does.** Removes the proposed term and turns the deriver on, with a
   budget above zero. **Must find.** The standard deriver answers the
   same obligation within its budget (ruling L). The kernel checks its
   proposal as any other. The result records the deriver as the
   proposer, under its own name.

## Break it

**Does.** The proposer answers `proof_refl(1)`, a term that proves a
true equation other than the claim. **Must find.** The kernel refuses
it: the term does not establish the obligation's proposition. The
refusal does not refute the claim (ruling 2), and the obligation stays
open. The attempt and its refusal, with the rule's explanation, are
recorded.

**Does.** After a term is accepted, the author changes the claim to
`double(x) == 3 * x`. **Must find.** The stored term is checked against
the claim as it now stands and refused, since it no longer fits (ruling
H). The obligation keeps its name, the module and `double_times_two`.

## What changes by ruling

- Ruling 2 of 2026-11-15 and "A proof term is a proposal": today a
  refused term makes `run` halt with exit 1 while `obligations` lists
  the theorem as pending. A refused proposal does not refute its claim,
  and the refusal is on the record. Nothing halts.
- Rulings H and I of 2026-11-15, round 3: today an obligation is
  identified by a hash over its proposition's text, and `propose` and
  `verify` print hints the tool composes, such as "match the
  proposition exactly". The obligation is named by its module and claim
  name, a content hash serving only as the proof store's cache key. A
  hint is the refusing rule's explanation.
- "Anyone may propose, and the record shows who": the verdict credits
  the proved theorem to `auto-PE`, and authorship appears only in
  `prove`'s own output. The result keeps the proposer, and `verify`
  names it, the deriver included.
- "Four strengths, one vocabulary": "verified=false", "Verdict
  (FAILED)", "discharged" and "pending" become the four strengths and
  refuted.
- "Open obligations are listed for any proposer": `obligations` without
  `--pending` lists decided claims as obligations. The form for people
  lacks what is in scope.

## Open questions

Settled, ruled 2026-11-15: question 1 of the draft, whether
`double_four` with a refused term is refuted or undecided (ruling 2:
neither; it is decided by evaluation). In round 3: question 2, how an
obligation is identified (ruling H: by its module and claim name; the
exact form waits on the kernel stream's ruling on identity). Question
3, hints (ruling I). Question 4, a scripted proposer (ruling J).
Question 5, the benchmark (ruling K: a separate corpus case at
milestone 5, not part of this scenario). The question new with ruling
2, which claim the walkthrough uses (ruling L).

1. New with ruling 2: does any tool offer a refused proposal on a
   decided claim for repair, though no obligation is open? Recommended:
   no. The result holds the refusal with its explanation, and a tool
   shows it where it is configured to.

## Present pins

None. The walkthrough is not a program, and no test of the present tree
runs it. Its commands and outputs are covered by steps 1 to 7 and the
break-it steps. The walkthrough's benchmark is a separate corpus case
(ruling K).
