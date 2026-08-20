# Rung 2 — a provable DSL: units of measure

The seriousness proof (see `docs/messaging.md` and
`docs/plans/units-dsl.md`): a domain language built entirely as an
Allegro library — `lib/units.alg`, ~200 lines, **zero host code** —
that inherits the whole kernel. Dimensional soundness is refinement
discharge (the same machinery as `PositiveInt`), failures speak
physics, and the proof surface — theorems, the strict gate, discharge
tiers, the assumption ledger — arrived by drawing one bundle.

```bash
npx tsx src/index.ts demos/rung2/01-dimensions.alg
npx tsx src/index.ts demos/rung2/02-literals.alg
npx tsx src/index.ts demos/rung2/03-laws.alg
npx tsx src/index.ts verify demos/rung2/03-laws.alg   # the ledger, in domain terms
```

| Scene | Shows |
|---|---|
| `01-dimensions.alg` | Dimensional soundness as refinement discharge: `Velocity`/`Force` are refinements; mismatches error in domain vocabulary; a wrong-dimension argument halts the build |
| `02-literals.alg` | The domain's own syntax as a library: `3 m`, `9.8 m/s^2`, `2 kg·m/s^2` from a ~10-line grammar block, number-anchored and non-invasive |
| `03-laws.alg` | Physics theorems PE-discharged (`1 km == 1000 m`, F = ma); the proof_trans gate over quantities; the admitted-law ledger; algebraic laws honestly pending |

Each scene has a commented **break it** block with the captured output
in `transcripts/`. All three files are validated by the test suite via
their `// expect:` comments — the demos cannot silently rot.

What was built for physics specifically: the dimension vectors, the
unit table, and the error messages. What was inherited free: the type
checker, the refinement discharge, the theorem machinery, the strict
gate, the tier system, the assumption ledger, the effects calculus,
and the prover loop.
