# Scene 5 — the prover loop: one protocol, any participant

The verification loop is participant-neutral: the kernel emits
**obligations**, any prover — an LLM, a human, a tool — proposes proof
terms, and the kernel returns a **verdict**. Nobody is trusted;
everybody is verified; authorship is recorded.

## The obligation

Take a file whose theorem carries a wrong proof term (the kernel's
soundness gate rejects a term that proves a different fact — proving
*something* is not proving *your* claim):

```allegro
double(x: Int): Int => x + x
theorem double_four: double(2) == 4 by proof_refl(987654321)
```

```
$ allegro obligations pending.alg --pending

Obligation: theorem `double_four`
  proposition: double(2) == 4
  hash:        0728a8d1
  prior attempts: 1
    #1: verified=false
```

The `hash` is the theorem's identity — a candidate proof is checked
against it, so a prover cannot satisfy the obligation by proving `1 ==
1` instead.

## The human worker

`allegro propose` renders pending obligations as a TODO with failure
context and iteration hints. You edit the source, re-run `allegro
verify`, iterate:

```
$ allegro propose pending.alg

## `double_four`

**Proposition:**
    double(2) == 4

**Last failure:**
- reason: proof term establishes a different equality
- counterexample: theorem claims `double(2) == 4` but the proof
  proves `987654321 == 987654321`

**Hints:**
- the `by` proof term establishes a different fact than the theorem
  claims — match the proposition exactly
```

## The LLM worker

`allegro prove` runs the same loop autonomously (requires
`ANTHROPIC_API_KEY`): extract obligations → ask the model for a proof
term → splice it into the source → verify through the kernel → on
failure, iterate with the failure reason, counterexample, and the
strategies already tried (up to `--max-attempts`, default 5). On
success, authorship is recorded on the theorem:

```
$ allegro prove pending.alg --output proved.alg

✓ double_four — by proof_refl(double(2))   [attempts: 1]
  authorship: {prover: <model-id>, attemptsUsed: 1, role: "primary"}
```

The model's proposal has no privileged path — it goes through the same
`proof_check` as a human's edit, and a wrong term gets the same
refusal shown above.

## What the benchmark actually measures (honest framing)

`npm run bench` runs a 10-obligation graded corpus through the same
kernel. Finding worth being upfront about: **partial evaluation alone
discharges all 10 closed propositions** — no prover needed. The
prover's measured work is not "discharge closed props"; it is
supplying `by` terms that satisfy the soundness gate on the 8 gated
obligations — exactly the loop above. See `bench/README.md`.
