# Rung 1 — verified code at AI velocity

The first demo ladder rung (see `docs/messaging.md` for the story
these scenes tell). Five scenes, each runnable as-is:

```bash
npx tsx src/index.ts demos/rung1/01-discharge.alg
npx tsx src/index.ts demos/rung1/02-counterexamples.alg
npx tsx src/index.ts demos/rung1/03-effects.alg
npx tsx src/index.ts demos/rung1/04-laws.alg
```

| Scene | Shows |
|---|---|
| `01-discharge.alg` | State facts (refinement, contract, theorem); partial evaluation discharges them; discharged checks cost nothing at runtime |
| `02-counterexamples.alg` | Break a claim: failures name concrete inputs; a false theorem halts the build |
| `03-effects.alg` | Negative claims: declared vs. inferred effect sets; under-promising is refused |
| `04-laws.alg` | Laws carry discharge tiers; the `proof_trans` strict gate; `Law.assume` is legal and loud |
| `05-prover-loop.md` | The participant-neutral loop: obligations → proposal → verdict → authorship, for humans and LLMs alike |

Each scene contains a commented **break it** block; uncommenting it
halts the build with the exact output captured in `transcripts/`.
Deeper inspection at any point:

```bash
npx tsx src/index.ts inspect demos/rung1/01-discharge.alg   # module summary + safety grade
npx tsx src/index.ts verify demos/rung1/04-laws.alg         # verdict with law obligations + tiers
```

These files are validated by the test suite (`npm test`)
via their `// expect:` comments — the demos cannot silently rot.
