---
type: stream-plan
status: active
backlog: B-159
lane: P
merge: merge-on-green
oracle:
  - npm test
  - npm run lint:load
chunks: [R1, R2, R3, R4]
reserves: [B-159, B-168, B-169]
boundary:
  - src/evaluator.ts
  - src/runtime.ts
  - src/totality.ts
  - src/primitives.ts
  - src/test/totality.ts
  - src/test/tooling.ts
  - bench/**
  - docs/book/implementation-map.md
  - docs/book/standard/totality.md
  - docs/book/platform/build-pipeline.ir.md
  - docs/plans/recursive-precompile.md
---

# The recursion cutoff restored — the recursive-precompile stream

> **Status: active** — drafted 2026-10-30 from the measurements in §2;
> the rulings of §6 taken and the chunk sequence of §5 ratified by the
> maintainer the same day (RR1 as option (b), the rest as recommended).
> The status line and the header's `status` say the same thing.
>
> **Reader**: someone who knows the project's layers, the gate
> (`docs/book/process.md` §5) and the stream model
> (`docs/plans/parallel-streams.md` §1), and has not read the
> evaluator or the totality analyzer. The precompile pass and the
> inline cutoff are explained in §1; nothing else here needs the code.

## 1. Outcome and terms

**Outcome.** The totality battery stops being the gate's floor.
B-159 (precompile of recursive definitions) is met when all of these
hold:

- `tests/totality-termination-demo.alg` and the four Phase E tests on
  recursive functions make no speculative inline expansion of a
  recursive definition, which `ALLEGRO_EVAL_STATS=1` shows as
  `inlineExpansions=0` for each of them;
- every program's stdout and exit code are identical, every `// expect:`
  line is unchanged, and every totality verdict in the suite (each
  `totality-*` notification, its binding and its tier) is unchanged;
- the shard that holds the totality battery falls in wall clock, which
  is reported, not gated. The experiment of §2 suggests the whole gate
  falls with it, by about 95% of its work.

**What the measurement found** (§2): the cost is not the termination
analysis and not a missing memo. It is the inline cutoff of
T-R6 (the recursion inlining cutoff, `docs/book/standard/totality.md` §8),
which no longer fires for a typed function. Since B-121 (metadata on
every kind) chunk C2 made a typed function a derived copy of its
definition, the cutoff's identity test misses it, and the precompile
pass unfolds every typed recursive definition until the JavaScript
stack overflows. The stream restores the cutoff, guards it, and then
measures what is left.

**Reserved ids.** The header reserves B-159 (the item this stream
delivers) and two spare ids, B-168 (first out-of-scope finding of the
recursive-precompile stream) and B-169 (second out-of-scope finding of
the recursive-precompile stream), for findings outside the stream's
scope. Neither has a backlog entry yet. The plan's PR files both as
placeholder entries in `docs/backlog.md`, so the header's reserves
resolve under `npm run lint:streams`. A spare id that is never used
stays a placeholder and is closed with the stream.

**Terms.** Each is defined here because neither the methodology
vocabulary nor `docs/book/` defines it.

- <a id="def-precompile-pass"></a>**Precompile pass**: the step of
  `evalSource` in `src/runtime.ts` (`precompileFunctions`) that runs
  before a typed program's evaluation loop. For each function
  definition it substitutes a typed placeholder for every parameter and
  partially evaluates the body (`precompileFunction` in
  `src/evaluator.ts`), to infer the return type and the effect set.
- <a id="def-speculative-inlining"></a>**Speculative inlining**: during
  the [precompile pass](#def-precompile-pass), a call to a composed
  function whose arguments are not all resolved is still expanded:
  `applyComposed` substitutes the placeholders into the callee's body
  and evaluates it. Each expansion counts as one `inlineExpansions` in
  `ALLEGRO_EVAL_STATS=1`. A recursive call expanded this way never
  reaches its base case, because the placeholder never becomes a value.
- <a id="def-inline-cutoff"></a>**Inline cutoff**: the hook that stops
  [speculative inlining](#def-speculative-inlining) of a recursive
  function (`setInlineCutoff` in `src/evaluator.ts`, installed per
  compilation in `src/runtime.ts`). It holds the set of function
  objects that sit on a recursion cycle (`recursiveBindings` from
  `analyzeDivergence` in `src/totality.ts`). When `applyComposed` meets
  a call whose arguments are not all resolved and whose callee is in
  the set, it returns the call as a residual instead of expanding it.
  T-R6 ratified it in 2026-08.
- <a id="def-cutoff-miss"></a>**Cutoff miss**: a speculative call to a
  function on a recursion cycle that the
  [inline cutoff](#def-inline-cutoff) does not recognise, so it is
  expanded. The cutoff tests object identity; a typed function reaches
  `applyComposed` as a fresh copy made by `withType`, so every typed
  recursive call is a miss.
- <a id="def-totality-verdict"></a>**Totality verdict**: what the
  compilation report says about one binding's totality: its
  `totality-nontermination`, `totality-exhaustiveness` and
  `totality-needs-annotation` notifications, and its discharge tier.
  The suite's totality tests assert these.

## 2. The problem, measured

**Question.** Where do the 68 s of `tests/totality-termination-demo.alg`
and the 15 to 34 s of each slow Phase E test go: the termination
analysis, the precompile pass's speculative inlining, or the evaluation
of what it inlines?

**Method.** Measured 2026-10-30 on `origin/main` at `2e8ef51`, in the
agent's sandbox (4 CPUs; it runs about 1.5 times slower than the gate's
machine, so the demo takes 72 s here against 68 s there and the longest
shard 362 s against 236 s). Four instruments:

1. `ALLEGRO_EVAL_STATS=1 npx tsx src/index.ts tests/totality-termination-demo.alg`,
   timed;
2. a CPU profile of the same run (`node --cpu-prof --import tsx`), self
   time aggregated by function;
3. a probe script outside the repository that runs each Phase E source
   through `evalSource` with the stats sink (`setEvalStatsSink`) and
   prints the counts and the compilation report's notifications;
4. `ALLEGRO_TEST_FILTER='Phase E|totality|decreases|C1.5b'
   ALLEGRO_TEST_TRACE=1 npm test` for the per-test times, and
   `npm run test:shards` for the shards.

Then one experiment, reverted afterwards: the cutoff's predicate in
`src/runtime.ts` also matched a function whose `body` is the body of a
function in the cutoff set (a derived copy shares its body). Every
number marked "experiment" below is from that patch.

### 2.1 The demo

| Count (`ALLEGRO_EVAL_STATS=1`) | Before | Experiment |
|---|---|---|
| Wall clock | 71.6 s | 0.93 s |
| `evaluate` calls | 87,042,127 | 760 |
| `applyPrimitive` calls | 28,755,454 | 166 |
| `applyComposed` calls | 96,819 | 43 |
| Inline expansions | 96,140 | 0 |
| Binding evaluations (of 4 watched) | 96,793, 96,323 of them in precompile | 17, 10 in precompile |
| Most evaluations of one binding | 48,791 | 6 |
| stdout | `120`, `55`, `49` | `120`, `55`, `49` |

A 30-line program with two recursive functions makes 87 million
`evaluate` calls. Each inline expansion re-evaluates the definition
`factorial` or `sum_to` names (the precompile context holds the
definition's expression, so the recursive call's symbol evaluates the
`typed_function` application again), which is why one binding is
evaluated 48,791 times.

### 2.2 The Phase E sources, one at a time

The probe's counts. Each time is one run with other measurements
sharing the machine, so it is indicative only. The last two columns
list the compilation report's notifications.

| Source (as in `src/test/totality.ts`) | Time before | after (experiment) | `evaluate` before | after | Inline expansions before | after | Report before | after |
|---|---|---|---|---|---|---|---|---|
| `factorial(n: NonNeg)` | 29.9 s | 0.06 s | 41,540,288 | 135 | 46,788 | 0 | `precompile-type-error` | clean |
| `factorial(n: Int)` | 33.7 s | 0.01 s | 43,939,837 | 93 | 48,514 | 0 | `precompile-type-error`, `totality-nontermination` | `totality-nontermination` |
| `f(n: Int)` with `decreases n` | 34.0 s | < 0.01 s | 32,958,810 | 120 | 39,803 | 0 | `precompile-type-error` | clean |
| `k(a, b)` with `decreases [a, b]` | 23.4 s | < 0.01 s | 23,419,363 | 130 | 40,700 | 0 | `precompile-type-error` | clean |
| `sum_to(n: NonNeg)` | 44.0 s | 0.01 s | 55,342,916 | 174 | 79,579 | 2 | `precompile-type-error` | clean |
| `bad(n: Int): Int => bad(n)` | 2.3 to 2.7 s | < 0.01 s | 1,871,088 to 2,264,463 | 48 | 169,818 to 205,504 | 0 | `precompile-type-error`, `totality-nontermination` | `totality-nontermination` |
| `factorial(n)`, untyped | < 0.01 s | same | 21 | 21 | 0 | 0 | clean | clean |
| `loop_n(static, n: NonNeg)`, tail call | 0.01 s | same | 133 | 133 | 0 | 0 | clean | clean |
| `square(n: Int)`, not recursive | < 0.01 s | same | 33 | 33 | 0 | 0 | clean | clean |

The `precompile-type-error` message is `Maximum call stack size
exceeded`. Every typed recursive definition that is not a tail call
pays the unfolding; the untyped one does not, and neither does the tail
call, which the tail-call loop handles without expanding.

### 2.3 The suite

The filtered run (57 tests, 273 s, with the probe and the profiler
sharing the machine, so every time is inflated):

| Test | Time |
|---|---|
| `file: totality-termination-demo.alg` | 85.5 s |
| Phase E Stage 2: factorial with bounded NonNeg | 43.0 s |
| `file: totality-decreases-demo.alg` | 42.9 s |
| Phase E Stage 2: factorial with unbounded Int | 42.3 s |
| Phase E Stage 3: `decreases n` trusts unbounded Int | 25.5 s |
| Phase E Stage 3: lex-tuple metric | 17.2 s |
| every other totality test | 2.4 s or less |

`tests/totality-decreases-demo.alg` (`countdown`, `ack_inner`) is a
sixth slow item that B-159's entry did not name; it has the same shape.

The gate, `npm run test:shards`, 3 shards:

| Run | Shard 0 | Shard 1 | Shard 2 | Wall clock | Work |
|---|---|---|---|---|---|
| Before | 301.7 s | 361.6 s | 74.5 s | 361.6 s | 737.8 s |
| Experiment | 15.5 s | 11.4 s | 8.9 s | 15.5 s | 35.9 s |

Both runs passed all 1,243 test runs (1,241 distinct tests) and every
lint, so no assertion in the suite depends on the cutoff miss. The
whole gate falls, not only the totality shard: shard 0 (301.7 s) also
held typed recursive definitions. The cutoff miss is the floor of the
gate as a whole, about 95% of its work on this machine. One run each;
the experiment is not the fix, and R2's own measurement replaces it.

### 2.4 The profile

The CPU profile of the demo sampled 91.0 s. Self time:

| Function | Share | Seconds |
|---|---|---|
| garbage collector | 33.0% | 30.0 |
| `__name` (tsx's keep-names helper, per closure created) | 15.5% | 14.1 |
| `TextDecoder` (Bits decoded to strings; B-160 (Bits decoded per member lookup)) | 14.3% | 13.0 |
| `applyPrimitive` | 10.3% | 9.4 |
| `evaluate` | 7.4% | 6.8 |
| `primitive` (`src/types-std.ts`) | 3.6% | 3.2 |
| `evaluateExpr` | 3.0% | 2.7 |
| anonymous closures in `src/evaluator.ts` | 2.6% | 2.3 |
| `metaReadRaw` | 1.9% | 1.7 |
| `makeExpr` | 1.6% | 1.5 |
| `unionEffectSets` | 1.1% | 1.0 |
| `effectsOf` | 1.0% | 1.0 |
| `mergeOverMeta` | 0.5% | 0.5 |
| `bitsToString` | 0.4% | 0.4 |
| `subst` | 0.2% | 0.2 |

`analyzeDivergence` and `checkExhaustiveness`, the termination and
exhaustiveness analyses, have no sample at all: under one millisecond.
The profiler truncates the deep stacks of the unfolding, so inclusive
time for `precompileFunction` is not recoverable from it; the counts of
§2.1 stand in for it.

### 2.5 What each outcome meant, and what the numbers say

| Hypothesis | If true, we would see | We see |
|---|---|---|
| The Stage 2/3 termination analysis is the cost (the reading of B-087 (totality-analyzer performance)) | samples in `analyzeDivergence`, `checkUserMetric`, `whyNotDecreasing` | none: the analysis is static, runs once per compilation and costs under 1 ms |
| The analysis runs repeatedly per definition (no memo) | the cost growing with call sites | it runs once per `evalSource` (`src/runtime.ts`, before `precompileFunctions`) |
| Speculative inlining of recursive definitions is the cost | inline expansions in the tens of thousands | 39,803 to 205,504 per definition, and 87 M `evaluate` calls for the demo |
| The inlined bodies' evaluation is the cost, not the decision to inline | GC, closures and decoding dominating the profile | yes: GC 33%, `__name` 15.5%, `TextDecoder` 14.3%. They are the price of each expansion, not a separate cause |

**The mechanism**, in the order the code runs:

1. `analyzeDivergence` (`src/totality.ts:534`) finds the recursive
   bindings and returns, for each, the function literal it peeled from
   the definition (`stampTargets`). `evalSource` (`src/runtime.ts:1254`
   to `:1261`) puts those objects in `cutoffCfns` and installs
   `setInlineCutoff(fnValue => cutoffCfns.has(fnValue))`.
2. The precompile pass evaluates the definition
   `typed_function(<literal>, …)`. `typed_function_impl`
   (`src/primitives.ts:2043`) returns `withType(fn, fnType)`
   (`src/primitives.ts:2175`), and `withType` derives through `withMeta`
   (`src/types.ts:419`), which for a composed function returns
   `{ ...v, meta }`, a new object that shares the literal's `body` and
   `params`.
3. In the body, the recursive call's symbol resolves in the precompile
   context to the definition's expression (`src/runtime.ts:658`: a
   function definition is not memoised there), so each call evaluates
   `typed_function(…)` again and gets another new copy.
4. `applyComposed` (`src/evaluator.ts:775` to `:783`) asks the cutoff
   about that copy. The identity test misses, so the call is expanded
   (`src/evaluator.ts:791` to `:793`), and the next level repeats from
   step 3 until the JavaScript stack overflows. The exception is caught
   twice: once silently in `typed_function_impl`'s own precompile of the
   literal (the F3b inline-lambda precompile, `src/primitives.ts:2160`
   to `:2173`), and once in `precompileFunction`, which turns it into
   the `precompile-type-error` notification.

**When it broke.** The predicate was `cutoffCfns.has(dataOf(fnValue))`
when T-R6 shipped: a typed function was then a carrier whose `primary`
was the literal. B-121 C2 (metadata rides every kind,
`b1afc60`, 2026-08-31) stopped creating the carrier, and B-121 C5
(`dataOf` deleted, `ca4871b`, the same day) dropped the peel from the
predicate. From then on the cutoff fired only for untyped recursive
functions. No test asserted that the cutoff fires for a typed function,
or that a correct recursive definition produces no
`precompile-type-error`, so the regression passed the gate. T-R6's own
record (`docs/book/standard/totality.md` §8) describes exactly these
symptoms: `factorial(n: NonNeg)` at 71.1 s and a spurious
`precompile-type-error` on correct code.

**Two consequences beyond time.**

- **Spurious errors in the compilation report.** Every typed recursive
  definition outside a tail call carries a `precompile-type-error`
  (severity `error`, not halting). `allegro inspect` and `allegro
  verify` show it.
- **Non-deterministic counts.** The unfolding ends at a host stack
  overflow, whose depth depends on the engine's frame sizes. Two runs
  of `bad` made 169,818 and 205,504 expansions. The current counts can
  therefore not be a baseline; after the fix they are small and exact.

**What is left after the experiment** (to be confirmed by R3): the
precompile context still re-evaluates a function definition at each
reference (the demo's most-evaluated binding falls from 48,791 to 6, not
to 1), and `typed_function_impl` precompiles each top-level literal once
before `precompileFunctions` precompiles it again. Both are small at
these sizes; R3 measures them before anything is done about them.

## 3. Oracle and stop conditions

Wall clock is reported, not gated: this is the performance stream's
settled rule, R1 (the oracle is counts, not time) of
`docs/plans/fast-library-load.md` §6. Each chunk is decided by these
mechanical checks:

1. **The suite is green and every pin holds.** `npm test` (or
   `npm run test:shards`, which CI runs) passes; no `// expect:` line in
   `tests/*.alg` or `basics.alg` changes; no existing assertion in
   `src/test/totality.ts` is removed or weakened.
2. **Every totality verdict is unchanged.** The `totality-*`
   notifications and the discharge tiers the suite asserts are the
   suite's own oracle. R1 adds a corpus check over every
   `tests/totality-*.alg` and every Phase E source: the set of
   `totality-*` notifications (kind and binding) and the tiers, recorded
   before the fix and compared after.
3. **Outputs identical.** Every `tests/*.alg` and `demos/**/*.alg`
   through the CLI before and after a chunk: stdout, stderr and exit code
   identical, as at P10 (the precompile pass evaluates definitions only)
   of B-157 (the performance stream). The compilation report may differ
   only as ruling RR2 (§6) allows.
4. **Deterministic counts.** `ALLEGRO_EVAL_STATS=1` counts for a
   precompile corpus (§5, R2): inline expansions, cutoff residuals and
   `evaluate` calls, ratcheted by `npm run lint:load` against a committed
   baseline once they are deterministic, under ruling RR3. The baseline
   follows B-164 (ratchet baselines under concurrent merges): it lowers
   only in its own commit at the top of an up-to-date branch.
5. **The existing ratchets hold**: `lint:planes`, `lint:units`,
   `lint:load`, the boundary baseline.

**Stop conditions.** The four of `docs/book/process.md` §3: a failed
check, a scope change, a chunk needing a decision, a chunk whose landing
summary carries asks. Two more are this stream's own:

- **A changed totality verdict stops the stream**, even if every test
  passes. A cutoff that changes what the analyzer reports has left the
  stream's scope.
- **A new or changed effect inference stops the stream.** Restoring the
  cutoff lets precompile finish where it used to crash, so an inferred
  effect set (and with it a declaration check that halts compilation)
  can appear where none was inferred before. Any report difference
  beyond the removed `precompile-type-error` notifications and the added
  `inferred` return-type entries is a stop for a ruling.

## 4. File boundary

Lane P (performance stream), narrowed by the header's `boundary`. Every
glob there is inside lane P's globs in `scripts/analyze/lanes.json`.
`src/runtime.ts` installs the cutoff and holds the precompile context
that R2 makes bind each definition once; `src/evaluator.ts` applies the
cutoff; `src/totality.ts` computes the recursive bindings;
`src/primitives.ts` holds `typed_function_impl` (touched only if R3
takes its candidate);
`src/test/totality.ts` takes the regression tests; `src/test/tooling.ts`
only if the counts are gated in the suite rather than in `lint:load`;
`bench/**` takes the precompile corpus and its baseline;
`docs/book/standard/totality.md` takes the T-R6 record (RR5).

**Outside the boundary, on purpose:**

- `tests/**` (lane D (L2 semantics)): the demos and their `// expect:`
  pins are the oracle and are never edited.
- `src/types.ts` and `src/types-std.ts` (`withMeta`, `withType`): the
  fix must not change how metadata derives a value. It is in lane P's
  globs but not in this boundary.
`docs/book/standard/totality.md` is inside the boundary since ruling
RR5 (§6): its §7 and §8 record T-R6 and must say that the cutoff was
inert for typed functions from B-121 C2 until R2, in the same PR as
the fix.

Lane P shares `src/runtime.ts`, `src/evaluator.ts`, `src/totality.ts`
and `src/primitives.ts` with lane D and lane K (kernel hygiene). The
lane table's rule applies: the stream takes them only while neither
lane is in them, and a coordinating service refuses the overlap at
dispatch.

## 5. Chunk sequence

Ratified as one sequence 2026-10-30.

| Chunk | Backlog | Deliverable | Oracle |
|---|---|---|---|
| R1 | B-159 | **The measurement lands.** `ALLEGRO_EVAL_STATS=1` gains two counters: `cutoffResiduals` (speculative calls the inline cutoff returned as residuals) and `precompiles` (calls to `precompileFunction`, nested ones included). `bench/load.ts` gains a precompile corpus (the six Phase E sources of §2.2 as files under `bench/`, `tests/totality-termination-demo.alg`, `tests/totality-decreases-demo.alg`) that `npm run bench:load` reports, not gated. A verdict pin: a test in `src/test/totality.ts` that records, for every `tests/totality-*.alg` and the Phase E sources, the `totality-*` notifications and tiers, pinned to today's values. §2's numbers re-measured and recorded in §7 | suite green; the new verdict test passes on unchanged code; counts printed for the corpus |
| R2 | B-159 | **One object per definition; the cutoff recognises it.** The precompile context binds each function definition once (`src/runtime.ts`, as P10 (a binding evaluated once) did for value bindings), so every reference sees the one typed function object, and the cutoff set holds those objects (RR1, option (b)). A guard test pins that a recursive call site in the precompile context resolves to the bound object, so a future clone path fails the suite instead of reopening the miss. Regression tests in `src/test/totality.ts`: through the stats sink, every Phase E source and both totality demos make zero inline expansions of a recursive definition and at least one cutoff residual; none carries a `precompile-type-error`. The corpus counts enter `npm run lint:load` with a new baseline, created at the fixed values (RR3). `docs/book/standard/totality.md` §7 and §8 record the inert period (RR5); `docs/book/implementation-map.md` updated | verdict test unchanged; the corpus's inline expansions 0; outputs identical over `tests/*.alg` and `demos/**/*.alg`; report differences only those RR2 allows; any changed effect inference is a stop (§3) |
| R3 | B-159 | **Measure again; take what is left only if it shows.** One candidate, taken only if the R1 counters show it above noise in the totality shard: `typed_function_impl` skips its own precompile of a top-level literal that `precompileFunctions` will precompile anyway. It may become "measured, not taken" | counts fall or hold; outputs identical; verdicts unchanged |
| R4 | B-159 | **The stream closes.** §7 closing entry against §1's outcome; B-159 closed in `docs/backlog.md`; B-087 re-scoped or closed (RR4); the totality chapter's T-R6 record amended (RR5); unused reserves B-168, B-169 closed; the lane table's row P updated | `npm run lint:streams` and `npm run lint:docs` clean; suite green |

The sequence expects R2 to carry the outcome. Under the experiment of
§2, on this sandbox, the demo went from 71.6 s to 0.93 s, the four
Phase E tests from 23 to 34 s each to under 0.1 s, and the gate from
361.6 s to 15.5 s of wall clock (737.8 s to 35.9 s of work).

## 6. Rulings

Decisions the maintainer took on 2026-10-30, each with its options, the
plan's recommendation and the ruling taken.

- **RR1 — How the cutoff recognises a function.** The fix restores
  T-R6's ratified behaviour; the question is the mechanism.
  - (a) Match by the definition's body: the cutoff set holds each
    recursive literal's `body`, and a derived copy shares it. The
    experiment of §2 used this. Smallest change, one line in
    `src/runtime.ts`. Weakness: it relies on `withMeta` sharing the body,
    an implementation fact rather than a stated invariant.
  - (b) The precompile context binds each function definition once
    (M1 of R3, moved into R2), and the cutoff set holds that object. The
    identity test then sees one object per definition. Larger change;
    also removes the re-evaluation per reference.
  - (c) A registered function property naming the definition a derived
    copy came from, carried by `withMeta`. Touches the meta-protocol
    registry (`docs/book/standard/type-system.md` §4) and lane K's
    files; out of this stream's scope.
  - **Recommended: (a) in R2, with a test that pins the shared body, so
    a change to `withMeta` that breaks it fails the suite; (b) stays a
    candidate for R3.** On semantics: no change is proposed beyond
    restoring T-R6. Memoising the termination analysis per definition
    is unnecessary, since it runs once per compilation and costs under
    1 ms. A cutoff for recursive definitions is what T-R6 already
    ratified; nothing lowers it further.
  - **Taken: (b), in R2**, as the more formally correct mechanism: the
    cutoff asks about the object the definition is bound to, not about
    a structural coincidence. Its downsides, stated so R2 watches for
    them: (1) a definition's typed function is now built once in the
    precompile context, so a forward or mutual reference sees the
    object as it was when first built — the precompile writes it
    gains later (effects, return type) land on that one object, which
    is the intent, but any difference in inferred effects against today
    is a stop (§3); (2) option (b) protects only the bound object, so a
    path that clones a function between binding and call (a body
    wrapper, a contract attachment, a partial application) would miss
    the cutoff again — the regression tests of R2 (zero expansions over
    the corpus) catch that, and (a)'s body match can be added as a
    second predicate if one appears; (3) the change sits in the
    precompile context that P10 just reshaped, so R2 runs the full
    corpus oracle, not only the totality tests. Option (a)'s pinning
    test is dropped; the guard test of R2 pins the binding instead.
- **RR2 — What "outputs identical" means.** Options: (a) stdout, stderr
  and exit code of every corpus program, and every totality verdict;
  (b) the same plus the whole compilation report. Under (b) R2 cannot
  land: removing the spurious `precompile-type-error` notifications is
  its purpose, and a function that precompiles to the end gains an
  `inferred` return-type entry. **Recommended: (a), plus a stated
  allowance**: the report may lose `precompile-type-error`
  notifications whose message is a stack or depth overflow, and gain
  `inferred` entries; any other report difference (an effect set, a
  `return-type-mismatch`, an effects-declaration error) stops the stream.
  **Taken as recommended.**
- **RR3 — Whether and how the counts are gated.** Options: (a) not
  gated, reported by `npm run bench:load` only; (b) ratcheted in
  `npm run lint:load` through `bench/load-baseline.json`, created at R2
  with the fixed counts; (c) exact counts asserted by tests in the
  suite. The current counts cannot be a baseline: they end at a stack
  overflow and differ between runs (§2.5). A ratchet created before R2
  would also add about 70 s of the demo to every gate. **Recommended:
  (b)**, created in R2 at the fixed values (creating a baseline is not
  lowering one, so B-164's separate-commit rule applies only to later
  lowerings), together with (c) for the one fact that matters most:
  zero inline expansions of a recursive definition in the Phase E
  sources. **Taken as recommended.**
- **RR4 — B-087 (totality-analyzer performance): its fate.** It already records that its premise was
  spent in 2026-08. The new evidence: the termination analysis costs
  under 1 ms; its "remaining cost" was the cutoff miss.
  **Recommended: close B-087 at R4 as superseded by B-159**, pointing
  at §2.5. **Taken as recommended.**
- **RR5 — The totality chapter.** `docs/book/standard/totality.md` §7
  and §8 must record that T-R6's cutoff was inert for typed functions
  from B-121 C2 to R2, since the chapter states the cutoff as executed.
  The file is outside lane P. Options: (a) the plan's PR widens lane P
  in `scripts/analyze/lanes.json` by that one file (a maintainer
  decision, as the manifest's preamble says) and the header's
  `boundary` gains it; (b) R4 files the chapter edit as B-168 for lane
  A. **Recommended: (a)**, since the chapter is the design truth the fix
  restores and should change in the same PR as the fix (the deviation
  rule of `docs/book/process.md` §3). **Taken as recommended**: lane P
  gained the file in `scripts/analyze/lanes.json` (PR #125) and the
  header's `boundary` names it.
- **RR6 — The merge policy.** The header says merge-on-green, as for
  B-157. R2 fits deviation D-2 (merge-on-green streams) of
  `docs/classification.md`: a mechanical oracle, no ruling open inside
  the chunk once RR1 to RR3 are taken, reversible by revert. **Recommended:
  merge-on-green, with R2 waiting for the maintainer if its report
  differences exceed RR2's allowance.** **Taken as recommended.**
- **RR7 — A follow-on outside the stream.** The checking algorithm can
  still reach a host stack overflow through any recursion the cutoff
  does not see (B-100 (soundness review of the cutoff) names this). The
  regression of §2.5 is an instance. **Recommended: record it in §7 and
  in B-100's entry; no chunk here.** **Taken as recommended.**

## 7. Record

- **2026-10-30 — rulings taken, sequence ratified.** RR1 as option
  (b); RR2 to RR7 as recommended. R2 now carries the once-bound
  definition that was R3's M1. RR7's follow-on: the checking algorithm
  reaches a host stack overflow through any recursion the cutoff does
  not see; the regression of §2.5 is an instance (for B-100 (soundness
  review of the cutoff)'s entry at R4).
- **2026-11-01 — R1 landed.** The measurement, with no behaviour
  change. Two counters join `ALLEGRO_EVAL_STATS=1` and the stats sink:
  - `cutoffResiduals` counts the speculative calls that `applyComposed`
    returned as residuals because the installed
    [inline cutoff](#def-inline-cutoff) answered true for the callee, in
    and out of the [precompile pass](#def-precompile-pass).
  - `precompiles` counts the entries to `precompileFunction`, nested
    ones included.

  The precompile corpus is a second group in `bench/load.ts`: the six
  Phase E sources of §2.2 under `bench/corpus/precompile/` and the two
  totality demos (`sum_to.alg` is the termination demo's `sum_to` with
  its `NonNeg` line, since `src/test/totality.ts` holds no such test;
  §2.2 named it among the sources). `npm run bench:load` reports it; `npm run lint:load`
  skips it, and `bench/load-baseline.json` is unchanged (RR3). The
  verdict pin is in `src/test/totality.ts`: 12 rows, one test each (the
  six `tests/totality-*.alg` demos and the six sources), plus one test
  that the table covers every demo and source. Each row holds the
  report's `totality-*` notifications (kind, binding) and its
  discharge tiers (`divObligations`, binding and tier). It passes on
  unchanged code.

  Re-measured on this tree, in the same sandbox as §2, so the times are
  indicative. `tests/totality-termination-demo.alg` alone, timed:
  62.7 s; `evaluate` 84,065,836; `applyPrimitive` 27,769,524;
  `applyComposed` 94,511; `inlineExpansions` 93,832;
  `cutoffResiduals` 0; `precompiles` 584. The corpus through
  `npm run bench:load` (one run, with other measurements sharing the
  machine):

  | Source | Wall clock | `evaluate` | `inlineExpansions` | `cutoffResiduals` | `precompiles` | `totality-*` notifications |
  |---|---|---|---|---|---|---|
  | `factorial-nonneg.alg` | 31.0 s | 40,376,884 | 45,979 | 0 | 289 | none |
  | `factorial-int.alg` | 31.0 s | 40,070,999 | 45,955 | 0 | 288 | `totality-nontermination factorial` |
  | `f-decreases.alg` | 37.1 s | 42,594,747 | 47,643 | 0 | 294 | none |
  | `k-lex.alg` | 24.4 s | 27,437,036 | 45,974 | 0 | 289 | none |
  | `sum_to.alg` | 34.0 s | 40,368,652 | 45,973 | 0 | 289 | none |
  | `bad.alg` | 2.5 s | 2,281,653 | 207,234 | 0 | 662 | `totality-nontermination bad` |
  | `tests/totality-termination-demo.alg` | 65.2 s | 81,841,720 | 92,403 | 0 | 581 | none |
  | `tests/totality-decreases-demo.alg` | 41.7 s | 56,458,121 | 78,861 | 0 | 661 | none |

  Every row has `cutoffResiduals` 0: the cutoff never fires for a typed
  recursive definition, which is the [cutoff miss](#def-cutoff-miss) of
  §2.5. It does fire elsewhere: each run that loads `lib/planning.alg`
  makes 245 cutoff residuals. The counts still differ between runs (the
  demo made 93,078 calls to `applyComposed` under `bench:load` and
  94,511 alone), as §2.5 predicts, so none of them can be a baseline
  before R2. Every source carries a `precompile-type-error` today for
  each typed recursive definition outside a tail call (the decreases
  demo's `countdown` is a tail call and carries none). The verdict pin
  does not record that notification, since RR2 lets R2 remove it.
- **2026-11-01 — R2 landed.** One object per definition; the
  [inline cutoff](#def-inline-cutoff) recognises it again. RR1 is taken as
  option (b), with option (a)'s body match added as the second predicate
  that RR1's downside 2 provides for.
  - **The mechanism, as built** (`src/runtime.ts`):
    - `precompileDefinitionEntry` is the precompile context's entry for a
      function definition. It evaluates the definition on its first
      lookup and keeps the object, so every later reference in the
      [precompile pass](#def-precompile-pass) resolves to it. A lookup
      made while that first evaluation runs comes from the definition's
      own construction: `typed_function_impl`'s F3b inline precompile
      reaches the recursive call. It evaluates the definition
      re-entrantly and binds that first-built object. The outer result is
      dropped.
    - `precompileFunctionsInner` puts each definition into the context
      through that entry. Its loop reads the entry instead of calling
      `evaluate`, so the function it precompiles is the bound one.
    - `evalSource` installs the cutoff as two identity tests: the callee
      is a bound object, or its `body` is a bound object's body. The
      context fills both sets as it binds the recursive bindings
      (`addCutoffBound`). The set no longer holds the literals that
      `analyzeDivergence` peels (`stampTargets`).
  - **Why the second predicate.** With (b) alone, `inlineExpansions`
    was 0 for every corpus source, but `evaluate` varied between runs
    (`factorial-nonneg.alg`: 138,999 and 137,422). The cause is outside
    the precompile context. In the evaluation loop, `typed_function_impl`
    runs its F3b precompile once more for every pure top-level literal,
    since such a literal's `inferredEffects` stays undefined. There the
    recursive name resolves to a fresh `withType` copy of the
    definition. The copy missed the identity test and unfolded to a
    stack overflow, which was caught silently. `inlineExpansions` counts
    only inside the precompile pass, so it never showed this. The body
    test recognises the copy, since it shares its literal's body.
  - **For R3: the candidate now shows.** The evaluation-time F3b
    precompile of a pure top-level literal is a third precompile of the
    same body. In an experiment, reverted, `typed_function_impl` skipped
    it for a literal the precompile pass had already precompiled (with
    (b) and without the body test). `evaluate` per source fell to
    `bad.alg` 32, `f-decreases.alg` 62, `factorial-int.alg` 62,
    `factorial-nonneg.alg` 74, `k-lex.alg` 67, `sum_to.alg` 74,
    `tests/totality-termination-demo.alg` 631 and
    `tests/totality-decreases-demo.alg` 31,182. `precompiles` fell by
    one per pure top-level definition (the termination demo from 9 to 6). The counts were deterministic over
    three CLI runs, and the output diff was the same as R2's. R3 decides
    it on measurement.
  - **RR1's three downsides.** (1) No inferred effect changed: every
    `effects:` line of `inspect` over `tests/*.alg` and `demos/**/*.alg`
    is identical. (2) One path copies a function between binding and
    call: the evaluation-time F3b precompile above. The body test covers
    it. The guard test pins the binding in the precompile context.
    (3) The full output oracle ran over the corpus (below).
  - **Tests** (`src/test/totality.ts`). The guard, "B-159 R2 guard: a
    recursive call site in the precompile context resolves to the bound
    object", wraps the recursive call in a lazy probe primitive. The
    probe compares the callee with the object the name is bound to. It
    failed on the parent commit and passes here. One regression test per
    corpus source, through the stats sink, asserts `cutoffResiduals` ≥ 1
    and no `precompile-type-error`. It bounds `inlineExpansions` by the
    one other expansion the pass makes: the `NonNeg` refinement predicate
    (`_ >= 0`), at most once per `NonNeg` definition. The bound is 1 for
    `factorial-nonneg.alg` and `sum_to.alg`, 2 for the termination demo
    and 0 elsewhere. A compilation expands that predicate only when it
    is not the first in its process, so the bound holds in the suite. It
    is 0 through the CLI. R1's `VERDICT_PIN` passes untouched.
  - **Outputs** (RR2). 68 programs, each run through the CLI with `run`
    and with `inspect`. Every stdout, stderr and exit code of `run` is
    identical. Three `inspect` outputs differ:
    `tests/totality-termination-demo.alg`,
    `tests/totality-decreases-demo.alg` and `tests/type-annotations.alg`.
    Four `precompile-type-error: Maximum call stack size exceeded`
    notifications disappear (`factorial`, `sum_to`, `ack_inner`,
    `factorial`). One `inferred` entry appears (`factorial: Int` in
    `tests/type-annotations.alg`). With the errors gone, each of the
    three summaries reads `safety grade: proven-safe`, not `has-errors`.
    That is the same difference as the removed notifications, rendered
    as a summary; the maintainer confirms the reading at this PR. Nothing
    else differs.
  - **Re-measured**, in the same sandbox as §2.
    `tests/totality-termination-demo.alg` alone takes 0.3 s: `evaluate`
    694, `applyComposed` 41, `applyPrimitive` 152, `inlineExpansions` 0,
    `cutoffResiduals` 6, `precompiles` 9 (R1: 62.7 s and 84,065,836). The
    corpus through `npm run bench:load`:

    | Source | Wall clock | `evaluate` | `inlineExpansions` | `cutoffResiduals` | `precompiles` |
    |---|---|---|---|---|---|
    | `factorial-nonneg.alg` | 0.4 s | 102 | 0 | 3 | 3 |
    | `factorial-int.alg` | 0.3 s | 62 | 0 | 2 | 2 |
    | `f-decreases.alg` | 0.3 s | 89 | 0 | 3 | 3 |
    | `k-lex.alg` | 0.3 s | 96 | 0 | 3 | 3 |
    | `sum_to.alg` | 0.3 s | 102 | 0 | 3 | 3 |
    | `bad.alg` | 0.3 s | 32 | 0 | 2 | 2 |
    | `tests/totality-termination-demo.alg` | 0.3 s | 694 | 0 | 6 | 9 |
    | `tests/totality-decreases-demo.alg` | 0.4 s | 31,270 | 0 | 3 | 6 |

    The load corpus's counts are unchanged (`lib/planning.alg` still
    makes 245 cutoff residuals). The gate, `npm run test:shards`: shards
    of 14.1 s, 11.3 s and 8.7 s, 14.1 s of wall clock and 34.2 s of work
    (§2.3 before: 301.7 s, 361.6 s and 74.5 s, 361.6 s and 737.8 s).
  - **The baseline** (RR3). All four counts were identical over three
    CLI runs per source, so all four are gated. `npm run lint:load` runs
    each source through the CLI, one fresh process each, and compares
    with the `precompile` section of `bench/load-baseline.json`.
    `evaluates`, `inlineExpansions` and `precompiles` fail when they
    rise; `cutoffResiduals` fails when it falls. The baseline values are
    the table's four count columns. The section was created in its own
    last commit, on a branch up to date with `origin/main`. The load
    section is unchanged.
