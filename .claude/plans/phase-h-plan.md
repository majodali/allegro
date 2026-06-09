# Phase H — Proof Collaboration Protocol (PCP) — Plan

Status: draft for user review. Not yet sliced into commits.

## Thesis

Phase H operationalizes the central bet of the provability arc
(`memory/design_provability_thesis.md`): **[implementation, proof]
pairs as the primary proof strategy, the Allegro compiler as the fast
verification kernel.**

The F-arc shipped the kernel — F7's `proven` clause is the user-visible
contract, F1-F5 the proof constructors, F4's tactics the composition
surface, Phase E the totality machinery. Phase G's pilot showed it
handles real lib code under real load. What's missing is the *loop*:
a protocol by which a **prover** (an LLM, a human, an SMT solver, a
test harness, or some combination) and the compiler iterate to
converge on verified pairs.

**The protocol is participant-neutral.** AI agents are expected to be
the most frequent provers in practice — they have the search-muscle
the thesis bets on — but the protocol doesn't privilege them. A human
typing into a REPL, an LLM running in CI, and a hybrid workflow where
the human writes proof structure and the LLM fills tactics are all
the same protocol with different workers. This is a feature, not just
a fairness gesture: humans need to be able to take over when the AI
gets stuck, and downstream auditors need to be able to retrace any
proof's provenance regardless of who produced it.

What Phase H ships:

1. A **machine-readable obligation format** the compiler emits when it
   has a theorem to prove but no proof (or a counterexample-bearing
   failed attempt).
2. A **structured verification surface** that consumes a candidate
   `.alg` file and returns a stable JSON verdict.
3. An **iteration protocol** carrying enough information between rounds
   for any prover to converge: counterexamples, in-scope lemmas,
   tactics already tried.
4. **Reference workers** that close the loop end-to-end: an LLM-backed
   worker (Claude) and a human-interactive worker (TUI / file-driven).
5. **Authorship metadata** on each discharged theorem so downstream
   auditors see who proved what.
6. (Optionally) a **proof-library catalog** so any prover can cite
   existing lemmas instead of reproving.

Phase H is OPEN-ENDED — once the loop closes, every increment improves
quality, not novelty. The minimum that demonstrates the bet is
**H1 + H2 + H4 (one worker)**.

## Why this matters now

The F-arc verified that proof obligations CAN be discharged at compile
time. Phase G verified the machinery handles real lib code under real
load. What's untested is whether a tight loop between prover and
verifier — for ANY prover, but especially for LLMs since they're the
search-muscle the thesis bets on — actually converges on realistic
obligations inside a reasonable budget. Phase H makes that
hypothesis falsifiable.

## Output format philosophy

**JSON is canonical.** Obligations, verdicts, iteration hints — all
structured. External tools (IDEs, build systems, test harnesses, LLM
agents) consume JSON and render to users as they see fit.

**Plain-text rendering is basic.** A minimal human-readable mode for
direct CLI use. We don't engineer for IDE-quality output; that's the
IDE's job. Same applies to the proof-library catalog (H5) — basic
text export, fancy presentation deferred.

## Proposed chunks (smallest → largest)

### H1 — Obligation + Verdict + Authorship JSON formats

**What.** Three stable on-disk schemas:

- **Obligation** — what the compiler emits when describing a proof
  burden. Function signature, theorem statement (source + AST hash
  for stability), available context (imported libs, in-scope
  theorems), prior attempts (with counterexamples).
- **Verdict** — what `allegro verify` emits after consuming a
  candidate. Pass/fail per theorem, counterexamples (reusing Phase E
  Stage 6 renderer), inferred types, totality findings.
- **Authorship** — provenance on each discharged theorem:
  `{prover, prover_version?, attempts_used, verified_at,
  effort_budget_used}`. Lets downstream auditors retrace WHO proved
  what (LLM, human user, auto-PE, SMT fallback, hybrid).

**Bytes.** ~200 lines: three TypeScript interfaces, JSON
serializers/deserializers, round-trip tests, basic plain-text
renderer.

**Why first.** Stable formats are the contract everything else builds
on. The authorship schema in particular has long-term implications
for the trust chain (`memory/design_proof_exportability.md`) — get
it right early.

### H2 — `allegro verify` and `allegro obligations` CLI

**What.** Two CLI subcommands:

- `allegro verify candidate.alg [--obligation O.json] [--json]` —
  consume a candidate, emit a verdict. The optional obligation
  prevents trivial-pass attacks (worker ships proof of `1==1`
  instead of the actual obligation). Default human-readable; `--json`
  opts in.
- `allegro obligations file.alg [--json]` — emit obligations from a
  file containing `proven` clauses or unproven theorems. Default
  human-readable; `--json` for tool consumption.

**Bytes.** ~150 lines. Verification logic itself already exists in
`checkProofs` / `checkProvenClauses`.

**Why second.** With H1 + H2 done, any external tool — IDE plugin,
LLM agent, human running Claude Code — can already attempt the loop.

### H3 — Iteration hints

**What.** Augment the Verdict with structured fields that help a
prover converge:

- **Sample evolution** — which sample inputs newly failed vs. were
  already-failing across attempts. Progress signal.
- **Strategies tried** — record of prior proof-strategy attempts
  (`proof_by_eval`, `proof_refl`, `prove_for_all_bool`, …) so the
  next round doesn't repeat.
- **Available lemmas** — list of in-scope discharged theorems that
  could feed `proof_trans` / `tactics.chain`.
- **Suggested next strategy** — explicit, compiler-side heuristics
  (e.g. predicate involves a typed Bool param ⇒ suggest
  `prove_for_all_bool`). Limited, transparent; the prover does the
  real search.

**Bytes.** ~200 lines: hint generator, schema additions, tests.

**Why third.** Without H3 the loop has no memory or direction — same
as a unit test. With it, even basic provers can converge faster.

### H4 — Reference workers (LLM + human-interactive)

**What.** Two pluggable worker implementations exercising the same
protocol from H1-H3:

**H4a — LLM worker.** TypeScript driver under `pcp/llm-worker.ts`:
1. Takes a `.alg` file with `proven` clauses or unproven theorems.
2. Calls `allegro obligations` to extract them.
3. Prompts an LLM (Claude via `@anthropic-ai/sdk`) with obligation +
   iteration hints + system primer.
4. Receives the proposed `.alg` snippet, runs `allegro verify`.
5. On failure, packages verdict + updated hints and retries.
6. Caps at N attempts; on success records authorship metadata.

**H4b — Human-interactive worker.** TUI / file-driven driver under
`pcp/human-worker.ts`:
1. Same obligation extraction.
2. Writes obligations to a per-obligation scratch file
   (`obligations/<theorem_name>.todo.alg`) with the obligation
   rendered as a comment and an empty `by ___` slot.
3. User edits the file, runs `allegro verify`.
4. On failure, scratch file is updated with the new verdict
   (counterexample, hints) as comments. User iterates.
5. On success, authorship is recorded as `user:<git config user.email>`.

Both workers consume H1-H3 directly. The LLM worker adds prompt
caching for the system primer. The human worker adds zero
dependencies beyond what's already in the repo.

**Bytes.** ~600 lines combined: H4a ~400 (LLM API integration, prompt
construction, retry orchestration), H4b ~200 (file management, simple
TUI). System primer doc extracted to `docs/proving-in-allegro.md`
(~participant-neutral; consumed by both LLM prompt cache and humans
learning the F-arc surface).

**Why fourth.** Without this, Phase H is a spec on paper. The two
workers together prove the protocol is genuinely neutral — same
contract, two implementations.

### H5 — Proof-library catalog (optional, deferrable) — ✅ SHIPPED

**Status.** Shipped. `allegro catalog <file> [--json] [--output
proofs.json]` emits a `ProofCatalog` of the file's discharged theorems.
Schema + generator (`buildCatalog`) + dependency extractor
(`extractDependencies`) + strategy classifier (`classifyProofStrategy`,
now the canonical one the worker delegates to) + retrieval helper
(`findCitableLemmas`) + renderers live in `src/pcp.ts`. The LLM worker
reads a catalog via `--catalog proofs.json` (`runLlmWorker` opts
`catalogPath` / `catalog`) and merges citable lemma names into each
obligation's prompt. 8 new tests; 986/986 green. Refinement *domain*
rendering (beyond just naming the refined type) and a richer per-project
auto-`proofs.json` lifecycle remain as polish.

**What.** A `proofs.json` per project (and via `allegro catalog
file.alg --json`) cataloging discharged theorems: name, proposition
source, function dependencies, refinement domain, proof strategy,
authorship. The worker in H4 reads it before proposing — citations
instead of reproofs.

**Bytes.** ~150 lines: catalog generator, schema, retrieval helper.
Plain-text export is basic; structured rendering for IDE catalogs is
deferred.

**Why here.** Without H4, no consumer. Once H4 exists and provers are
regularly reproving facts that should be cited, H5 becomes the obvious
optimisation.

### H6 — Multi-strategy parallel orchestration

**What.** Run multiple proof strategies in parallel against the same
obligation. E.g. one strand tries `proof_by_eval`, another tries
`prove_induction`, another searches the catalog. First to verify
wins.

**Bytes.** ~200 lines: parallel orchestration, race semantics.
Generalizes to "let the user try multiple approaches" for human
workers too — multiple scratch files, first verified one wins.

**Why optional.** Engineering improvement after H4 shows that some
obligations are strategy-sensitive.

### H7 — Effort budgets + reproducibility

**What.** Generalize budget controls beyond LLM tokens:

- **Effort budget** — universal cap per obligation. LLM: token count.
  Human: wall-clock + attempt count. Configurable per worker.
- **Escalation policy** — `if LLM fails N attempts within budget,
  surface obligation to human`. Hybrid workflows fall out of this.
- **Reproducibility** — seed control for LLMs (`temperature=0` paths),
  attempt logs in JSON for review, cost reporting.

**Bytes.** ~200 lines.

**Why last.** Required for deployment but the prototype demonstrates
the bet without these. Add when someone actually deploys
Allegro+PCP in a CI pipeline.

### Benchmark suite (paired with H4, not its own chunk)

**What.** A small graded-difficulty corpus measured across multiple
baselines:

- **Auto-PE baseline** — what does the F-arc discharge with no
  prover at all?
- **Human baseline** — time/attempts for a developer with the
  surface primer.
- **LLM baseline** — token cost / attempts to convergence for the
  Claude worker.
- **Hybrid baseline** — human writes proof structure + LLM fills
  tactics.

Lands inside H4 (or as the first H4 follow-on). Without this we
don't *know* the thesis is validated for any prover; with it, we have
falsifiable measurements per category of prover.

**Corpus shape (~10 obligations):**
- 3 refl-trivial (PE folds directly)
- 3 induction-shaped (need `prove_induction` + step)
- 2 transitivity chains (need `tactics.chain` + catalog citations)
- 2 multi-param / type-bound reasoning (Stage 5 hard cases)

## Suggested first chunk

**H1** is the smallest deliverable that lands the substrate. After it
ships, the obligation/verdict/authorship shapes are stable and H2 can
build on top. **H1 + H2** together give any external prover (LLM or
human) a useable verification surface.

The minimum sequence that *demonstrates the bet* is **H1 → H2 → H4
(at least one worker, ideally both)**. H3 makes the loop intelligent;
H5 reduces redundant work; H6/H7 are quality of life.

## Open design questions

1. **Where do workers live?** Inside the Allegro repo (`pcp/`) or
   external? Plan assumes internal — the LLM worker adds
   `@anthropic-ai/sdk`, the human worker adds nothing. Internal keeps
   canonical workers in sync with kernel changes; external is fine if
   we want to keep the Allegro repo language-only later.

2. **PCP-callable from Allegretto?** Eventually `use ai_assist;
   ask_to_prove(theorem_name)` from inside Allegro code. Too far for
   H4 minimum — start external.

3. **Adversarial workers.** A worker could try to exploit a kernel
   bug to fake a proof. PE-as-discharge is sound by construction
   (proof IS evaluation), so the surface is small — but the
   verification kernel must be the SINGLE check point. Workers can
   propose anything; the kernel is the trust boundary.

4. **Multi-prover authorship.** A proof produced by an LLM and
   reviewed by a human carries TWO authorship facts. The schema
   should accommodate `provers: [...]` (ordered list of contributors)
   rather than `prover: ...` (single).

5. **Cache strategy for LLM workers.** The system primer is the same
   on every call; the obligation context changes. Aggressive prompt
   caching of the primer is essential. Build into H4a from day one.

6. **How does a human know "this is hopeless, escalate"?** The
   human-interactive worker should support a `--give-up` action that
   marks the obligation with a `proven-unresolved` notification
   (severity info) for later attention, without halting compilation.
