# PCP Benchmark Suite

A small graded-difficulty corpus of proof obligations that measures the
provability arc (`.claude/memory/design_provability_thesis.md`) across baselines.
It pairs with Phase H (the Proof Collaboration Protocol — see
`.claude/plans/archive/phase-h-plan.md`): *"Without this we don't know the thesis
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

The deterministic baselines are pinned by tests in `src/test.ts`
(`runBenchmarkTests`), so a regression in the proof kernel surfaces in the
normal `npm test` run.
