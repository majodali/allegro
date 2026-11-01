# PCP Benchmark Suite

A small graded-difficulty corpus of proof obligations that measures the
provability arc (`docs/VISION.md` §2) across baselines.
It pairs with Phase H (the Proof Collaboration Protocol — see
`docs/plans/archive/phase-h-plan.md`): *"Without this we don't know the thesis
is validated for any prover."*

## Running

```bash
npm run bench                       # deterministic baselines (no API key)
npx tsx bench/run.ts --llm          # also run the Claude worker baseline
npx tsx bench/run.ts --llm --model claude-opus-4-8
npx tsx bench/run.ts --json         # machine-readable report
npx tsx bench/run.ts --only t05,t08 # a subset of obligations
```

Exit code is `0` when the corpus is healthy (every reference proof
discharges and every soundness gate holds) and `1` otherwise. The LLM
baseline never affects the exit code — a prover failing to converge is a
measurement, not a corpus fault.

## What it measures

Each corpus file under `bench/corpus/` is a self-contained `.alg` program
in *solved* form — it verifies as-is. The harness derives three
measurement forms from each and runs them through the **same kernel** the
`allegro verify` / `allegro prove` commands use:

| Baseline   | Form                                   | Measures |
|------------|----------------------------------------|----------|
| `ref`      | solved file as-is                      | corpus validity — the curated proof must discharge |
| `autoPE`   | goal with its `by` term **stripped**   | the kernel's *free coverage* — what partial evaluation discharges with no prover |
| `gate`     | goal's `by` term replaced by a wrong sentinel | the soundness gate — `proof_check` must **reject** a term that proves a different fact |
| `llm`      | the gated (pending) form, handed to the Claude worker | prover convergence — does the worker find a discharging term, in how many attempts |

## The headline finding

Allegro's partial evaluator is **total over closed propositions**: it folds
every corpus proposition to `true` and discharges it with *no prover at
all* (auto-PE = 10/10). The prover's measurable work is therefore not
"discharge the proposition" but "supply a proof term the soundness gate
accepts" — exactly the obligation surface the `allegro prove` loop
targets. The `gate` and `llm` columns measure that loop; the eight gated
obligations are graded by the proof skill required (reflexivity →
symmetry/transitivity → congruence/rewrite).

## Corpus shape

10 obligations across three categories:

- **refl-trivial (t01–t03)** — the only proof is reflexivity.
- **combinator (t04–t08)** — symmetry, transitivity (incl. a 3-link
  chain), congruence, and a cong+sym+trans rewrite.
- **type-bound (t09–t10)** — refinement-domain entailment
  (`proof_refines`) and finite-domain quantification
  (`prove_for_all_bool`). These are Proof-valued propositions with no
  `by` slot, so auto-PE discharges them directly and there is no gate.

The corpus uses only proof primitives in the standard environment (no
`import tactics`), so the harness loads each file with just the type
system — no module resolver.

## Files

- `manifest.ts` — corpus metadata (id, category, goal theorem, reference
  proof term) and the wrong sentinel used to build gated forms.
- `harness.ts` — `runBenchmark(opts)` — derives the forms, verifies each,
  and (optionally) drives the LLM worker. Returns a structured
  `BenchReport`.
- `run.ts` — CLI runner: renders the table or emits JSON.
- `corpus/*.alg` — the obligations, in solved form.

The deterministic baselines are pinned by tests in `src/test/tooling.ts`
(`runBenchmarkTests`), so a regression in the proof kernel surfaces in the
normal `npm test` run.

## The load corpus (`load.ts`)

A second, separate bench: how long a library takes to load, from
B-157 (the performance stream), chunk P1 (instrumentation and the
corpus); plan `docs/plans/fast-library-load.md`. The corpus is
`lib/units.alg`, `lib/planning.alg`, `tests/planning-solve-demo.alg` and
the two `demos/rung3/` scenes.

```bash
npm run bench:load                       # full runs: wall clock + parse counts (minutes)
npm run lint:load                        # parse-only ratchet against load-baseline.json
npx tsx bench/load.ts --check --update-baseline   # rewrite the baseline (to lower it)
```

- `npm run bench:load` runs each entry as the CLI does
  (`node --import tsx src/index.ts FILE`) with `ALLEGRO_PARSE_STATS=1`,
  and sums the engine's per-parse stats lines from stderr. It reports;
  it gates nothing.
- `npm run lint:load` parses only, in one process: each program's body
  and every library it `use`s or `import`s, each library source once
  across the corpus. A library is evaluated after its parse, because its
  `grammar { }` values extend the grammar of the files that use it. The
  counts gated are match attempts, memo writes, invalidation entries,
  left-recursion iterations and the final memo size; any count above
  `load-baseline.json` fails. Wall clock is printed and never gated. It
  runs once per gate run (`scripts/test-shards.mjs`, and
  `src/test/tooling.ts` `runLoadLintTests` when unsharded).

### The precompile corpus

A second group of entries in `load.ts`'s corpus, from B-159 (precompile
of recursive definitions), chunk R1 (the measurement lands) of
`docs/plans/recursive-precompile.md`. It holds the six Phase E sources
of the plan's §2.2, one file each under `corpus/precompile/`, and
`tests/totality-termination-demo.alg` and
`tests/totality-decreases-demo.alg`. `npm run bench:load` runs and
prints it after the load corpus, with the evaluation counts
`cutoffResiduals` and `precompiles`. `npm run lint:load` skips it, so
it is in no baseline: its counts end at a host stack overflow today and
are not deterministic. They enter the ratchet with their own baseline
at R2 (ruling RR3 (whether and how the counts are gated)). The
verdict pin in `src/test/totality.ts` reads the same files.
