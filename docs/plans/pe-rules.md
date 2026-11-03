---
type: stream-plan
status: closed
backlog: B-172
lane: D
merge: human-gated
oracle:
  - npm test
  - npm run test:shards
  - npm run lint:load
  - npm run lint:units
  - npm run lint:planes
  - npm run lint:docs:check
  - npm run lint:ir
  - npx tsx scripts/doc-ref-lint.ts
chunks: [C1, C5, C2, C3, C4, C6]
reserves: [B-178, B-179]
boundary:
  - src/evaluator.ts
  - src/primitives.ts
  - src/test/evaluator.ts
  - src/test/index.ts
  - tests/**
  - docs/book/concepts.md
  - docs/book/allegretto/evaluator.ir.md
  - docs/book/allegretto/evaluator.md
  - docs/plans/pe-rules.md
  - scripts/analyze/units-baseline.json
---

# The partial-evaluation rules and the evaluator in agreement — the PE-rules stream

> **Status: closed → B-172** (2026-11-03) — the chunk sequence of §5 is
> complete and the §1 outcome is met: both rules of
> `docs/book/concepts.md` §25 are implemented as stated, `eval_when`,
> `&&` and `||` speculate under an unresolved input and no speculation
> runs an effect, no residual holds a `TailCall` sentinel, the switch in
> `evaluate` has its inert default arm, and every `// expect:` line,
> totality verdict and count is unchanged but what RR8 allowed (§7, the
> closing entry). The plan was drafted 2026-11-03 from the evidence in
> §2 and ratified at the merge of PR #147 the same day, RR2 to RR8 as
> recommended; RR1 was taken as (a) at PR #149 on C1's numbers, and RR9
> as option C on PR #155. The stream ran human-gated, one PR per chunk:
> #147 the plan, #148 the activation, #149 C1 with RR1's numbers, #150
> C2 and C5, #155 C3, #158 C4, and C6 the closing PR, with lane P's #151 and #152 raising
> C2's count. It closes with B-172 and the unused reserves B-178 (first
> out-of-scope finding of the PE-rules stream) and B-179 (second
> out-of-scope finding of the PE-rules stream). The evaluator chapter's
> prose and its count 2 go to lane A (RR4 (a)). RR9's revisit stays
> open by ruling. Kept for its §7 record. The status line and the
> header's `status` say the same thing.
>
> **Reader**: the session that runs lane D (L2 semantics), and the
> maintainer ruling on §6. Assumed known: the layers
> (`docs/book/layers.md`), the gate (`docs/book/process.md` §5) and what
> a [stream](parallel-streams.md#def-stream) is. Not assumed: the
> evaluator's code. §1 defines the terms and §2 gives what the code
> does, each claim with its file and line, measured on `origin/main` at
> `0cff2bf`.

## 1. Outcome and terms

**Outcome.** B-172 (the partial-evaluation rules as implemented against
the spine) is met when all of these hold:

- [`docs/book/concepts.md` §25](../book/concepts.md#def-partial-evaluation)
  and the evaluator agree. Each rule is either implemented as stated or
  restated with the implementation's policy and its reason. The delta
  row is empty, or names only what a ruling of §6 leaves open.
- `eval_when`, `&&` and `||` meet PE Rule 2 as ruled (RR2, RR3), and no
  speculative evaluation runs an effect (RR3).
- A call in tail position inside a branch evaluated under an unresolved
  condition is handled as RR7 rules (§2.5, finding 1); under RR7's
  options (a) and (b), no residual holds a `TailCall` sentinel.
- The switch in `evaluate` has the default arm the discriminator rule
  (`docs/book/units.md` §3.2) requires, as RR5 rules.
- The evaluator chapter's IR (`docs/book/allegretto/evaluator.ir.md`)
  describes the result, and its prose and count 2 are handed on as RR4
  rules.
- Every `// expect:` line, every
  [totality verdict](recursive-precompile.md#def-totality-verdict) and
  every count in `bench/load-baseline.json` is unchanged, except what
  RR8 lists as allowed to move.

**Terms.** Each is defined here because neither the methodology
vocabulary nor `docs/book/` defines it. The plan also uses
[*precompile pass*](recursive-precompile.md#def-precompile-pass) and
[*inline cutoff*](recursive-precompile.md#def-inline-cutoff) as stream P
(the recursion cutoff restored) defined them.

- <a id="def-unfold"></a>**Unfold**: what `applyComposed` does with a
  composed function applied to arguments some of which are unresolved.
  It substitutes the evaluated arguments, unresolved ones included, into
  the callee's body and evaluates that body (`src/evaluator.ts:805` to
  `:806`). The result is the partially evaluated body, not the
  application.
- <a id="def-residualise"></a>**Residualise**: return an application as
  a [residual](../book/concepts.md#def-resolved-unresolved-residual)
  Expression over its evaluated function and arguments, instead of
  computing it.
- <a id="def-speculative-evaluation"></a>**Speculative evaluation**:
  evaluating an operand or a branch whose value the program may never
  use, such as both branches of an `if` whose condition is unresolved.
  It is safe only if it runs no effect.
- <a id="def-gap-pin"></a>**Gap pin**: a test that C1 adds to pin
  today's behaviour where it falls short of a rule, marked in its name
  as one that C2, C3 or C4 flips. Flipping it is ratified by this plan,
  which is the discussion `docs/book/process.md` §6 asks for before an
  existing test condition changes.

**Reserved ids.** The header reserves B-178 (first out-of-scope finding
of the PE-rules stream) and B-179 (second out-of-scope finding of the
PE-rules stream). The plan's PR files both as placeholder entries in
`docs/backlog.md`, so the header resolves under `npm run lint:streams`.
B-172 is the item the stream delivers; stream A (the book chapters)
reserved it and its plan is closed, so this plan's `backlog` field is
the lane's claim.

## 2. The problem, measured

**Question.** Where does the evaluator depart from §25's two rules, what
does each departure buy or cost, and which departures should the spine
state as policy rather than the code remove?

**Method.** Read on `origin/main` at `0cff2bf`, 2026-11-03. Probes run
outside the repository through the CLI (`npx tsx src/index.ts`) and
through `evalSource` with the stats sink (`setEvalStatsSink`). No file
in the repository was changed. Each probe below is a candidate test for
C1.

### 2.1 What the rules say

§25 states:

- **PE Rule 1.** "An application with an unresolved argument produces a
  residual — the application itself, as a value — with metadata fields
  propagated onto it per their rules."
- **PE Rule 2.** "A lazy primitive whose control input is unresolved
  evaluates both branches and residualises, so that what is known on
  either path is still discovered."

The vision states the reason both exist (`docs/book/vision.md` §2, the
proof strategy, quoted): "PE-as-discharge (primary). Predicates are
Allegro lambdas; PE reduces them against residuals; a predicate that
reduces to `true` is discharged."

### 2.2 What the code does

| Construct, with an unresolved input | What happens | Where |
|---|---|---|
| eager primitive | residual over the evaluated arguments, typed by the first installed dispatcher that answers | `src/evaluator.ts:628` to `:638` |
| unresolved function position | residual; a Param in function position carries its effect variable, its bound or `opaque` | `src/evaluator.ts:487` to `:537` |
| composed function | [unfolded](#def-unfold); every application inside the body is governed by Rule 1 | `src/evaluator.ts:805` to `:806` |
| composed function on a recursion cycle, typed compilation | residualised by the inline cutoff, carrying the callee's own effects | `src/evaluator.ts:787` to `:796`; installed at `src/runtime.ts:1387` |
| `if` (`eval_if`) | both branches evaluated; residual `eval_if` over them; typed when both branches' type names match | `src/primitives.ts:595` to `:626` |
| `when` (`eval_when`) | residual over the unevaluated arguments; no branch evaluated | `src/primitives.ts:832` to `:834` |
| `&&` (`typed_and`), left operand | residual with the right-operand thunk unevaluated | `src/primitives.ts:2222` to `:2224` |
| `\|\|` (`typed_or`), left operand | the same | `src/primitives.ts:2317` to `:2319` |

`&&` and `||` are the same primitives in both modes: the tree builder
turns them into `typed_and` and `typed_or` with the right operand
wrapped in a zero-parameter thunk (`src/grammar2/tree-builder.ts:136` to
`:137`). A `when` with several arms is a chain of `eval_when`
applications; an arm whose pattern binds names is a composed function
over those names, and the chain ends in `when_no_match(subject)` when no
`else` is written (`src/grammar2/tree-builder.ts:633` to `:645`).
`when_no_match` always throws (`src/primitives.ts:1060` to `:1062`).

The switch in `evaluate` names all seven kinds and has no default arm
(`src/evaluator.ts:388` to `:438`).

During the [precompile pass](recursive-precompile.md#def-precompile-pass),
`precompileFunction` marks the compile scope (`src/evaluator.ts:1066`
to `:1067`), and `applyPrimitive` then defers every effectful primitive
to a residual that carries its effects (`src/evaluator.ts:574` to `:584`
for a lazy one, `:618` to `:620` for an eager one). The pass runs only
for a typed compilation (`src/runtime.ts:689`). The effects declaration
check reads only the effect set the pass stashed on the function
(`src/effects.ts:204` to `:205`).

### 2.3 What unfolding buys, and what it costs

Unfolding is what lets the precompile pass see inside a call. Three
results depend on it:

1. **Effect variables are instantiated at the call site.** "Stage F2:
   polymorphic apply propagates io callback's effects to caller"
   (`src/test/effects.ts:1207` to `:1219`): `caller(x: Int)` calls
   `apply((y: Int): Int => print(y), x)` with `x` unresolved, and the
   caller's set has `io`. The callee's own set is the variable `e`
   (`src/test/effects.ts:1193` to `:1205`). A residualised call carries
   the callee's own set (`src/evaluator.ts:794` to `:795`), so it would
   carry `e`, not `io`.
2. **Effects pass through the Allegro-built library functions.** "Stage
   F3b: declaration check via PE catches mismatch through HOF"
   (`src/test/effects.ts:1430` to `:1443`) halts a `pure` declaration
   because `arr.map` unfolds `mapAllegro` (`src/types-std.ts:3108`,
   `:3142` to `:3146`), whose body calls the callback. `mapAllegro` is
   built in `src/types-std.ts`, not bound in a program, so the precompile
   pass stashes no effect set on it, and a residual of it carries none.
3. **Return types are inferred through untyped helpers.** Probe:
   `inc(x: Int) => x + 1` and `twice(x: Int) => inc(inc(x))`. The report
   infers `twice: Int`, with 2 inline expansions. A residualised call
   carries no `type`: the cutoff's residual skips the dispatcher's
   finisher (`src/evaluator.ts:793` and `:817`;
   `src/types-std.ts:3660` to `:3665`).

PE-as-discharge over concrete arguments does not depend on the policy:
`verify square(6) > 0` (`tests/proofs-demo.alg`) applies `square` to a
resolved argument, which every option runs.

The cost is divergence on unresolved recursion. An unfolded recursive
call never reaches its base case. B-018 (totality design revalidation)
added the inline cutoff for it as T-R6 (the recursion inlining cutoff),
and stream P restored the cutoff for typed functions in 2026-11 after
it had missed them since 2026-08 (`docs/plans/recursive-precompile.md`
§2.5: 87 million `evaluate` calls for a 30-line program).
B-100 (soundness review of the cutoff) owns what remains: recursion the
cutoff does not see can still reach a host stack overflow.

### 2.4 What Rule 2's gap costs

An effect behind `&&`, `||` or `when` with an unresolved input is never
inferred, so an undeclared effect passes the halt rule of CE-R1 (a
declaration is a contract). The same effect behind `if` halts. Each
probe declares `effects pure` with `use effects` and is run through the
CLI:

| Body of `g(b)` | Exit | Output |
|---|---|---|
| `if b then print("x") else 0` | 1 | effects mismatch in `g`: declared `pure`, inferred `io` |
| `h(b)`, with `h(m) => print(m)` | 1 | the same mismatch |
| `b && print("x")` | 0 | compiles |
| `b \|\| print("x")` | 0 | compiles |
| `when b is 1 then print("x") is _ then 0` | 0 | compiles |
| `if b then h(b) else 0` | 0 | compiles (§2.5, finding 1) |

The same with typed parameters and no declaration, through
`evalSource`: the inferred set of `andop(b: Bool): Bool => b &&
print(b)`, of its `||` twin, of `whenop(b: Int): Int => when b is 0 then
print(b) is _ then 0` and of `whenbind(b: Int): Int => when b is n then
print(n) is _ then 0` is empty. That of `primbranch(b: Int): Int => if b
== 0 then print(b) else 0` is `io`.

### 2.5 Two findings the entry does not name

1. **A tail call in a branch hides its callee.** `inbranch(b: Int): Int
   => if b == 0 then h(b) else 0` infers no effect, where `direct(b:
   Int): Int => h(b)` infers `io`. The call `h(b)` sits in tail position
   of the branch, so `evaluateExpr` returns a `TailCall` sentinel
   (`src/evaluator.ts:465` to `:468`). `eval_if` evaluates the branch
   body under the unresolved condition and puts the result in the
   residual (`src/primitives.ts:601` to `:610`). A probe printed the
   residual body as `type_check(eval_if(bits_eq(Param, Bits),
   fn[0]{TailCall(ComposedFunction)}, fn[0]{Bits}), Structure)`. A
   `TailCall` sentinel is a host object, not a value
   (`docs/book/allegretto/evaluator.md` §5), so the residual holds a
   non-value, and the call is neither unfolded nor residualised. A local
   binding of the same `if` loses the effect too. An `eval_when` arm
   would meet the same once it is evaluated (C3).
2. **`eval_if` runs both branches' effects at run time.** `r = if zzz
   then print("then-ran") else print("else-ran")`, with `zzz` bound
   nowhere, prints both lines and exits 0, in Standard mode and with
   `--base`. At run time no compile mode is set, so the speculative
   evaluation of `src/primitives.ts:597` to `:604` runs `print`. The
   same program with `&&`, `||` or `when` prints nothing.

The IR's evidence pointers for the PE claims also predate stream P's
changes to `src/evaluator.ts` and `src/primitives.ts`: E3 gives
`evaluate` as lines 363 to 427 (now 375 to 439), E9 the cutoff as 759 to
783 (now 787 to 796), E14 `typed_and_impl` and `typed_or_impl` as 2190
and 2288 (now 2217 and 2315), and E15 `applyComposed` as 716 to 806 (now
728 to 819). The chunk that next edits those claims re-syncs them (RR4).

## 3. Oracle and stop conditions

Each chunk is decided by these checks:

1. **The suite is green and every pin holds.** `npm test` and
   `npm run test:shards` pass; `bash scripts/typecheck.sh` is clean. No
   `// expect:` line in `tests/*.alg` or `basics.alg` changes. No
   existing assertion in `src/test/` changes, except a
   [gap pin](#def-gap-pin) that the chunk's row in §5 names as one it
   flips.
2. **Every totality verdict is unchanged.** `VERDICT_PIN` in
   `src/test/totality.ts:829` passes untouched.
3. **Outputs identical.** Every `tests/*.alg` and `demos/**/*.alg` run
   through the CLI with `run` and with `inspect`, before and after the
   chunk: stdout, stderr and exit code. Differences are allowed only as
   RR8 lists them.
4. **The ratchets hold.** `npm run lint:load` (the precompile corpus's
   `evaluates`, `inlineExpansions` and `precompiles` must not rise, its
   `cutoffResiduals` must not fall), `npm run lint:units`,
   `npm run lint:planes`, and the boundary battery in the suite.
5. **The documents hold.** `npm run lint:docs:check`,
   `npx tsx scripts/doc-ref-lint.ts` and, for a chunk that edits the IR,
   `npm run lint:ir`.

**Stop conditions.** The four of `docs/book/process.md` §3: a failed
check, a scope change, a chunk needing a decision, a chunk whose landing
summary carries asks. Lane D keeps the per-chunk gate (`docs/backlog.md`
§"Parallel lanes"), so every chunk stops at its PR in any case. The
stream adds four:

- **Any `// expect:` change or totality verdict change.**
- **Any baselined count rising** (or `cutoffResiduals` falling).
  `bench/load-baseline.json` lies in lane P, not lane D, so the stream
  cannot move it; the maintainer decides (RR8).
- **A new halt in `lib/`, `tests/` or `demos/`.** C2 and C3 make
  effects visible that were hidden. A library function or demo whose
  declaration was passing only because of the gap would now halt. That
  is a finding for a ruling, not a fix the chunk makes.
- **Any file outside the boundary** (§4), `src/runtime.ts`,
  `src/types-std.ts` and `src/effects.ts` included.

## 4. File boundary

**Lane D (L2 semantics)**, narrowed by the header's `boundary`. Every
glob there is inside lane D's globs in `scripts/analyze/lanes.json`.

**Why lane D.** The question is semantics: what partial evaluation does
with an unresolved input. Lane K (kernel hygiene) also lists
`src/evaluator.ts` and `src/primitives.ts`, but its streams are ratchet
and audit work, and its globs hold neither `tests/**`, nor
`docs/book/concepts.md`, nor a new test module under `src/test/`. B-172's
entry names lane D for the code question.

**What each file takes.**

- `src/evaluator.ts`: the default arm (C5), the experiment of C1 (behind
  a flag, reverted before the PR), and the sentinel handling of RR7 if
  it lands in the evaluator.
- `src/primitives.ts`: `eval_if_impl`, `eval_when_impl` and its branch
  helpers, `typed_and_impl`, `typed_or_impl` (C2, C3).
- `src/test/evaluator.ts`: a new test module for both rules, registered
  by one import line in `src/test/index.ts`. Today's evaluator tests are
  spread over `src/test/base.ts` and `src/test/effects.ts`, which stay
  untouched.
- `tests/**`: new demo files only. An existing demo is an oracle and is
  never edited.
- `docs/book/concepts.md`: §25 only (C4).
- `docs/book/allegretto/evaluator.ir.md`: the claims of §2 and §3 and
  their evidence (RR4). `docs/book/allegretto/evaluator.md`: only if
  RR4 is taken as option (b) or (c).
- The status documents under B-162 (conflict-free status documents):
  this plan's row in `docs/plans/README.md`, B-172's entry, B-178,
  B-179 and lane D's row in `docs/backlog.md`, and the section `## Stream
  D — the partial-evaluation rules` in `docs/CHANGELOG.md`.

**Outside the boundary, on purpose.** A chunk that needs one of these
stops:

- `src/runtime.ts` (the precompile pass, the cutoff's installation),
  `src/types-std.ts` (the dispatchers, refinement and contract checks)
  and `src/effects.ts` (the declaration check). The stream changes what
  partial evaluation produces, not how its consumers read it.
- `src/scope.ts` (`scopeCompileMode`), `src/types.ts` (`isResolved`):
  lane K's files.
- `bench/**`, `bench/load-baseline.json` included: lane P's files.
- `docs/book/units.md` (the discriminator rule): only RR5's option (b)
  would need it.
- `docs/book/allegretto/evaluator.review.md`: count 2 runs after the
  stream (RR4).

**Lanes sharing these files.** Lane D is internally serial:
B-089 (lawful-interface follow-ons), B-099 (project severity configuration),
B-101 (predicate-carrier residue cleanup) and B-171 (the pipeline
chapter's two findings) wait while the stream runs, and the stream takes
none of them. Lanes K and P take `src/evaluator.ts` and
`src/primitives.ts` only while lane D is not in them.

## 5. Chunk sequence

Each chunk is one PR, human-gated. C5 lands with C1, in the same PR as
its own commit: under RR5's recommendation it changes no behaviour, so
C1's pins are its oracle, and it touches the same IR claims C1 re-syncs.

| Chunk | Backlog | Deliverable | Oracle |
|---|---|---|---|
| C1 | B-172 | **Characterise and pin; measure for RR1.** `src/test/evaluator.ts`, through `evalSource` and the stats sink: Rule 1 on small programs (a composed call with an unresolved argument unfolds, counted by `inlineExpansions`; a call on a recursion cycle residualises, counted by `cutoffResiduals`; an eager primitive and an unresolved function position residualise); Rule 2 for `eval_if`, `eval_when`, `&&` and `\|\|` (which branches are evaluated, which effects reach the residual); the probes of §2.4 and §2.5 as [gap pins](#def-gap-pin). No behaviour change. Then the experiment, behind a flag and reverted before the PR, as stream P's chunk R2 (one object per definition) measured its own: `applyComposed` [residualises](#def-residualise) every composed call with an unresolved argument, as if the inline cutoff answered true for every callee. Recorded in §7: failing tests by name, changed `// expect:` lines, changed `VERDICT_PIN` rows, changed `inspect` outputs over `tests/*.alg` and `demos/**/*.alg`, and the precompile corpus's counts. The IR's PE claims re-synced to today's lines | suite green with the new tests passing on unchanged code; the experiment's numbers in §7; RR1 put to the maintainer at this PR |
| C5 | B-172 | **The default arm**, as RR5 rules. Under (a): the switch in `evaluate` names Symbol, Expression, the two function kinds and Param, and one default arm returns the value for Bits, Structure and any kind added later. The IR's claims C158, C164 and C165 re-proposed, C151 reviewed | no output, verdict or count changes; suite green |
| C2 | B-172 | **Rule 2 for `&&` and `\|\|`; speculation runs no effect.** With the left operand unresolved, the right operand is evaluated speculatively (RR3) by applying its thunk, as today's resolved path does (`src/primitives.ts:2238` to `:2241`), and the residual holds the evaluated operand and its effects. `eval_if` evaluates its branches the same way at run time (RR3). The tail-call sentinel in a branch handled as RR7 rules. Gap pins flipped: the `&&` and `\|\|` rows of §2.4, and finding 1 and finding 2 of §2.5 for `eval_if` | the §2.4 `&&` and `\|\|` probes halt with the mismatch; finding 2's probe prints nothing; outputs and verdicts otherwise as RR8 allows |
| C3 | B-172 | **Rule 2 for `eval_when`**, as RR2 rules. Under (a): with the subject unresolved, each arm's guard and body are evaluated speculatively with the arm's pattern names left as its own unresolved Params; the default `when_no_match` arm is not evaluated; the residual holds the evaluated arms. Gap pins flipped: the `when` rows of §2.4 | the `when` probes halt; outputs and verdicts as RR8 allows |
| C4 | B-172 | **Rule 1 as RR1 rules.** Under (a): §25 restated (the rule, the unfolding policy, the cutoff, the reason) and its delta row cleared of what C2, C3 and C5 closed; the IR's claims C35, C44, C154 and C161 re-proposed against the restated rule. Under (b): the code change of RR1's option (b), which needs `src/runtime.ts` and `src/types-std.ts`, so the stream stops and the chunk is re-planned | under (a): docs only, `npm run lint:docs:check` and `npm run lint:ir` clean, suite green |
| C6 | B-172 | **The stream closes.** §7's closing entry against §1's outcome; B-172 closed; unused reserves closed; lane D's row updated; the IR re-synced; count 2 and the prose handed to lane A as RR4 rules | `npm run lint:streams`, `npm run lint:docs:check`, `npm run lint:ir`; suite green |

Reserves: B-178 and B-179, for findings outside the boundary (a halt in
`lib/` that C2 or C3 uncovers is the likely first).

## 6. Rulings

Numbered RR, because the spine's requirements R2 (partial evaluation is
the mechanism by which layers are added) and R4 (evaluation is total
over unresolved information) are cited in the same text.

- **RR1 — PE Rule 1: restate the spine, or change the code.**
  - (a) Restate §25's Rule 1 so that unfolding a composed function is
    the stated policy, with its cutoff. Proposed wording: "An
    application with an unresolved argument produces a residual, with
    metadata fields propagated onto it per their rules, unless it
    applies a composed function. A composed function is unfolded: its
    body is evaluated with the arguments substituted, and Rule 1
    governs each application inside it. A call into a recursion cycle
    during a typed compilation is residualised instead, carrying the
    callee's effects, because unfolding it cannot converge." The code
    changes are limited to Rule 2 and the default arm.
  - (b) Change the code to the rule as stated: residualise every
    composed call with an unresolved argument, carrying what the
    callee's signature and stash give. This loses the three results of
    §2.3 unless an inlining stage unfolds where discharge needs it,
    which is a second policy to design. It needs `src/runtime.ts` and
    `src/types-std.ts` and overlaps B-100's question of where the cutoff
    belongs. A larger stream, which probably splits.
  - **Recommended: (a), to be confirmed on C1's numbers.** Unfolding is
    what lets PE-as-discharge see inside a call: refinement checks,
    effect inference and theorem discharge run on the unfolded body, so
    residualising every unresolved call would hide everything behind
    the signature. Divergence, its cost, is already handled by the
    inline cutoff. Taken at C1's PR.
  - **Standing: (a) recommended; taken at C1's PR on its numbers.**
  **Taken: (a)**, 2026-11-03, at the merge of PR #149 (chunk C1's numbers).
- **RR2 — What "evaluates both branches" means for `eval_when`.** An
  arm's body cannot be evaluated without its pattern names bound.
  - (a) Evaluate each arm's guard and body with its pattern names as
    fresh unresolved Params (the arm function's own), under RR3's
    speculative evaluation. A binder pattern (`is n`) binds the subject
    itself, which `eval_when` already does on a match
    (`src/primitives.ts:850` to `:857`, `:896` to `:898`). The default
    `when_no_match` arm stays unevaluated, since it always throws. The
    residual holds the evaluated arms, so the effects of every arm reach
    the enclosing function.
  - (b) As (a), but a type pattern (`is Int`, `Point(x, y)`) binds a
    typed placeholder, as `precompileFunction` does for a typed
    parameter (`src/evaluator.ts:1023` to `:1042`). It needs the field
    types of a destructured type, which only `src/types-std.ts` knows:
    outside the boundary.
  - (c) Keep today's residual with the arms unevaluated, and restate
    Rule 2 to exempt a lazy primitive whose branches bind names. The
    effect gap of §2.4 stays, and is filed under B-178.
  - **Recommended: (a).** It closes the effect gap within the
    evaluator's own knowledge; (b) can follow when a stream owns the
    type side.
  **Taken: (a)**, 2026-11-03, at the merge of PR #147.
- **RR3 — Speculative evaluation and effects.** Evaluating the right
  operand of `&&` or `||`, or a branch, can reach an effectful
  primitive. During the precompile pass that is already safe: compile
  mode defers it (`src/evaluator.ts:574`, `:618`). At run time it is
  not: §2.5's finding 2 shows `eval_if` printing both branches.
  - (a) Speculative evaluation always runs in a scope that compile mode
    marks, at run time too, so every effectful primitive defers to a
    residual that carries its effects (`scopeCompileMode` already reads
    the mark through the scope chain, `src/scope.ts:84` to `:91`). It
    applies to `eval_if`, `eval_when`, `&&` and `||` alike, and changes
    `eval_if`'s run-time behaviour under an unresolved condition.
  - (b) Evaluate speculatively only where compile mode is already on
    (the precompile pass); at run time keep the residual with the
    operand or arms unevaluated. `eval_if` unchanged, finding 2 filed
    under B-178.
  - (c) Keep today's behaviour for `&&` and `||` (the right operand
    unevaluated) and restate Rule 2 to exempt short-circuit operators.
  - **Recommended: (a).** It gives every lazy primitive one definition
    of speculation, from a mechanism the evaluator already has, and
    removes an effect that fires on a path the program may not take.
    C1 measures which outputs, if any, depend on today's `eval_if`.
  **Taken: (a)**, 2026-11-03, at the merge of PR #147.
- **RR4 — How the evaluator chapter is kept true.** The chapter's next
  edit runs count 2 of the stranger rounds, with three defects waiting
  in §2 (`docs/book/allegretto/evaluator.review.md`, "After the
  count"): round 7's finding 2, touch-up edit A and the excess in the
  C172 sentence. All three are in the passage C5 rewrites.
  - (a) The IR is edited by the reasoning role in each chunk that
    changes the code, with its evidence re-synced; the prose and
    count 2 run once, as a lane A chunk after C6.
  - (b) The IR and the prose of §2 and §3 change in each chunk's PR;
    count 2 is deferred to after C6.
  - (c) The IR, the prose and count 2 in each chunk.
  - **Recommended: (a).** The IR is normative (its header says
    `Normative: yes`), so changing it with the code meets the deviation
    rule of `docs/book/process.md` §3. Count 2 is several stranger
    rounds and should run once, on the final text, with the three
    waiting defects fixed in the same pass.
  **Taken: (a)**, 2026-11-03, at the merge of PR #147.
- **RR5 — The default arm of `evaluate`.**
  - (a) An inert default, as `docs/book/units.md` §3.2 ratified: the
    switch names the participating kinds, and the default arm returns
    the value for Bits, Structure and any kind a fork adds ("a kind a
    fork adds is inert until its author says otherwise"). No behaviour
    changes. It also meets R4 ("the evaluator has a rule for every value
    it can meet").
  - (b) A failing default: the seven kinds stay named and the default
    arm throws on any other. This contradicts §3.2, which would need
    amending outside the boundary. Either error kind behaves the same
    today: `precompileFunction` turns any throw into a
    `precompile-type-error` notification that does not halt
    (`src/evaluator.ts:1103` to `:1106`), and the file runner halts on
    any throw with exit 1 (`src/index.ts:219` to `:223`); no code tests
    for `AllegroError` by class. A failing default is not a case for
    CE-R8 (the two consciously weaker paths), whose paths are a
    construction-path invariant failure, which yields an error value,
    and a non-exhaustive match over a finite type, which is an info
    notification. An unknown kind is a kernel invariant breach, not a
    defect in the user's program, so an info notification would
    misreport it.
  - **Recommended: (a).** It is the ratified rule; a default that fails
    on an unknown kind would reverse it. If the maintainer prefers (b),
    a kernel fault (a plain `Error`) rather than an `AllegroError`,
    since the fault is the engine's, and the amendment of §3.2 goes to
    lane K first.
  **Taken: (a)**, 2026-11-03, at the merge of PR #147.
- **RR6 — B-171's halt finding.** B-171's second finding is that the
  precompile pass's error-severity notifications do not halt, against
  CE-R1. Options: (a) out of scope; (b) in scope.
  **Recommended: (a), out.** The halt policy is decided in
  `src/runtime.ts`, outside this boundary, and it concerns what a
  notification does, not what partial evaluation produces. It stays
  B-171's, in lane D after this stream.
  **Taken: (a), out**, 2026-11-03, at the merge of PR #147.
- **RR7 — A tail call inside a speculatively evaluated branch** (§2.5,
  finding 1).
  - (a) The branch's `TailCall` sentinel is applied, as `evaluateExpr`
    applies a sentinel from an unmarked Expression
    (`src/evaluator.ts:458` to `:460`). The call is then unfolded under
    RR1's policy, and the inline cutoff stops a recursive one in a typed
    compilation. Where no cutoff is installed (every compilation clears
    it at `src/runtime.ts:1285`, and only a typed one with a recursion
    cycle installs it, at `:1387`), the call is residualised
    as an Expression carrying the callee's effects, as the cutoff does
    (`src/evaluator.ts:793` to `:795`), so an untyped recursive branch
    cannot unfold without bound.
  - (b) Always residualise it as an Expression carrying the callee's
    effects. Simpler, but the callee's effect set exists only once the
    callee has been precompiled, so a forward reference loses it.
  - (c) Out of scope: filed under B-178.
  - **Recommended: (a).** It follows RR1's policy and makes the effects
    of a branch call visible, as for a call outside a branch. In C2,
    with the same applied to `eval_when` arms in C3.
  **Taken: (a)**, 2026-11-03, at the merge of PR #147.
- **RR8 — What may move.** C2 and C3 change what the precompile pass
  infers, so some reports change by design.
  - (a) Allowed: the gap pins each chunk names; new effects in the
    inferred set of a function whose `&&`, `||`, `when` or branch tail
    call hid them, and the `inspect` lines that report those sets. Not
    allowed, each a stop: a changed `// expect:` line, a changed
    verdict, a new halt in `lib/`, `tests/` or `demos/`, and any rise in
    the precompile corpus's gated counts. For a count, the maintainer
    either widens lane D by `bench/load-baseline.json` for one commit
    or hands the baseline commit to lane P (B-164 (ratchet baselines
    under concurrent merges)).
  - (b) Allowed as (a), plus any count rise C1's measurement predicts,
    ratified now.
  - **Recommended: (a).** The corpus's own code has no `&&`, `||` or
    `when` under an unresolved input, so no count is expected to move;
    a rise would be news and deserves a look.
  **Taken: (a)**, 2026-11-03, at the merge of PR #147.
- **RR9 — Unfolding inside a speculated when arm.** C3 as first committed
  unfolded every composed call reached inside a speculated `when` arm
  (RR1 (a)'s policy), and the unfolded callees' own `if`s and `when`s were
  speculated in turn, nesting up to depth 26. Loading `lib/planning.alg`
  rose from 219,433 `evaluate` calls to 63,915,555 (§7, C3). Measured
  behind flags in a scratch copy, each with 136 of 136 outputs identical
  and every C3 pin passing:

  | Option | `evaluate` | `inlineExpansions` | `cutoffResiduals` | Load | `lint:load` |
  |---|---|---|---|---|---|
  | Without `when` speculation | 219,433 | 910 | 936 | 0.9 s | passes |
  | C3 as committed | 63,915,555 | 5,260 | 1,367 | 31.7 s | passes |
  | A: the binder's subject a stand-in Param carrying its metadata | 23,507,422 | 5,260 | 1,367 | 14.7 s | passes |
  | B: no speculation inside a speculation (`when`, `if`, `&&`, `\|\|`) | 27,598 | 511 | 201 | 0.7 s | fails: `cutoffResiduals` below the floor |
  | B2: no `when` speculation inside a speculation | 227,407 | 1,045 | 984 | 1.0 s | passes |
  | C: a composed call inside a speculated `when` arm residualised with the callee's effects | 234,306 | 946 | 936 | 1.0 s | passes |

  What each loses: A, nothing measured, and it removes two thirds of the
  cost only; B, every effect found through nested speculation, and C2's
  nested `if`s; B2 (the nested `when` cap), the effects of a `when` inside an `if` branch or inside
  another arm (probed: both lost); C, effects that only unfolding inside
  an arm would find (a callee with no stashed set yet; an effect variable
  instantiated at the call; a return type through the call), none of
  which a probe showed.
  - **Recommended: C.** It returns the load to the base within 7%, keeps
    every pin, output and gated count, and narrows RR1 (a) inside `when`
    arms only.
  **Taken: C**, 2026-11-03, by the maintainer on PR #155, to be revisited when partial evaluation is pushed for further optimisation or a case needs the full metadata evaluation inside an arm.

## 7. Record

- **2026-11-03 — plan drafted.** From the reading and probes of §2, on
  `origin/main` at `0cff2bf`; no code changed. The plan files B-178 and
  B-179 as placeholders, creates the changelog section `## Stream D —
  the partial-evaluation rules`, appends the manifest row, and names the
  stream in lane D's row and in B-172's entry. Rulings RR1 to RR8
  await the maintainer, RR1 on C1's numbers.
- **2026-11-03 — Ratified** at the merge of PR #147; rulings RR2 to RR8
  taken as recommended; the maintainer filed B-180 (recursion handling
  under partial evaluation) and B-181 (the hard-coded precompile and
  compile-time phases) for later review, outside this stream's scope.
- **2026-11-03 — C1 landed; C5 measured and set aside.** The pins, the
  RR1 experiment and the evidence re-sync, with no behaviour change. C5
  was built and measured, changed one output, and waits for the
  maintainer's choice.
  - **The pins.** `src/test/evaluator.ts`, a new test module registered
    by one import line in `src/test/index.ts`, 20 tests. Each compiles
    a small program written inline through `evalSource` and the stats
    sink (`setEvalStatsSink`). A lazy probe primitive, `c1_probe`,
    records what its argument evaluates to in compile mode, so a test
    can assert the shape of a residual: its kind, its function position
    and its argument count.
    - Rule 1, 8 pins: a composed call with an unresolved argument
      [unfolds](#def-unfold) (2 `inlineExpansions`, 1 per precompile;
      at run time 1 `applyComposed` call and no expansion counted);
      unfolding infers `twice: Int` through an untyped helper; a call
      into a recursion cycle [residualises](#def-residualise) and
      carries the callee's `io` (4 `cutoffResiduals`); a self-recursive
      call residualises with no effect, since the callee's set is not
      yet stashed while it is itself precompiled; an eager primitive
      residualises, typed `Int` by the dispatcher in Standard mode and
      untyped in Allegretto; an unresolved function position
      residualises, the Param carrying its effect variable `e`, `opaque`
      when unannotated, nothing under `f: pure`; a `pure`-declared
      function whose unfolded call hides a `print` halts with the
      mismatch.
    - Rule 2, 2 pins: `eval_if` (`eval_if_impl`) under an unresolved
      condition evaluates both branches and residualises, the deferred
      `print` carrying `io` up; the `pure`-declared `if` row of §2.4
      halts.
    - 9 [gap pins](#def-gap-pin), each named "gap pin (C<n> flips,
      RR<m>)" with a comment. C2 flips seven: `&&` (`typed_and_impl`)
      and `||` (`typed_or_impl`) residualise with the right operand
      unevaluated (RR3); the `pure`-declared `&&` and `||` rows compile
      (RR3); a tail call in a branch under an unresolved condition
      leaves a `TailCall` sentinel in the residual and infers no effect,
      `inbranch` and `local` inferring nothing where `direct` infers
      `io` (RR7); `evaluate` reached with that sentinel falls through
      its switch to `undefined`, which the precompile pass reports for
      `via_if` of `tests/functions.alg` as the `precompile-type-error`
      "Cannot read properties of undefined (reading 'meta')" (RR7);
      `eval_if` at run time prints both branches, in Standard mode and
      in Allegretto (RR3). C3 flips two: `eval_when` (`eval_when_impl`)
      residualises with no arm evaluated, and the `pure`-declared `when`
      row compiles (RR2).
    - 1 plain pin: `&&`, `||` and `when` with an unresolved input print
      nothing at run time, which RR3 (a) keeps.
  - **Determinism.** Every counted test compiles its program three times
    in one process and asserts equal counts. Each test also passes run
    alone, where its program is the first compilation in its process,
    and in the full suite and the sharded gate, where other compilations
    run first.
  - **The RR1 experiment**, behind a flag in a scratch copy of the tree,
    never committed: `applyComposed` residualised every composed call
    with an unresolved argument, as the inline cutoff's branch does,
    carrying the callee's effects. The cutoff's own branch kept its
    counter; the flag's residuals were counted apart.

    | Measure | Flag off | Flag on |
    |---|---|---|
    | CLI runs, `run` and `inspect` over the 68 programs of `tests/*.alg` and `demos/**/*.alg` | 136 identical | 135 identical; `tests/planning-handlers-demo.alg` `inspect` gains `error in build_plan: Cannot read properties of undefined (reading 'length')` (its grade was `has-errors` already) |
    | `run` outputs and `// expect:` lines changed | 0 | 0 |
    | `VERDICT_PIN` (`src/test/totality.ts`) | 13 of 13 pass | 13 of 13 pass |
    | Suite failures caused by the flag | 0 | 7: "Stage F2: polymorphic apply propagates io callback's effects to caller", "Stage C3: multi-variable apply2[e1, e2] propagates each var independently", "Stage C3: explicit [e: Effect] annotation propagates through forwarded params, auto-promotion stays opaque", and four C1 pins (the three Rule 1 unfolding pins and the residual's shape in the RR7 pin) |
    | `ALLEGRO_TEST_FILTER="effects\|refine\|totality\|file: "` | 146 of 146 | 145 of 146 |
    | Precompile corpus, 8 sources, `npm run bench:load` | the baseline's counts | every count identical; the flag residualised no call |
    | `lib/units.alg` | `evaluate` 4,755, `applyComposed` 83, `applyPrimitive` 1,318, `inlineExpansions` 37, `cutoffResiduals` 0 | 3,853, 88, 1,046, 0, 0; 49 calls residualised by the flag |
    | `lib/planning.alg` | 26,035, 746, 5,804, 502, 245 | 13,541, 452, 2,990, 6, 47; 360 by the flag |
    | `tests/planning-solve-demo.alg` | 9,950,954, 565,195, 2,315,455, 502, 245 | 9,938,460, 564,901, 2,312,641, 6, 47 |
    | `demos/rung3/01-model.alg` | 838,144, 48,671, 196,050, 502, 245 | 825,650, 48,377, 193,236, 6, 47 |
    | `demos/rung3/02-solve.alg` | 3,585,707, 200,730, 836,660, 502, 245 | 3,573,213, 200,436, 833,846, 6, 47 |

    `precompiles` did not move anywhere (26 for `lib/units.alg`, 251
    for each run loading `lib/planning.alg`). Four suite failures under
    both settings came from the scratch copy not being a git checkout
    (the doc, IR and boundary lints) and are not counted. The three
    results of §2.3:
    1. Effect variables instantiated at the call site: **confirmed
       lost**. The three effects tests above fail; the residual carries
       the callee's variable `e`, or nothing, instead of `io`.
    2. Effects through `arr.map`'s `mapAllegro`: **not confirmed**.
       "Stage F3b: declaration check via PE catches mismatch through
       HOF" still halts with the flag. Its program makes no
       `applyComposed` call either way: `arr.map` on the unresolved
       `arr` is an unresolved method call, and its residual takes the
       `io` of the callback argument (`src/evaluator.ts` lines 515 to
       523). §2.3 item 2's account of the mechanism is wrong; the
       result does not depend on unfolding.
    3. Return types inferred through untyped helpers: **confirmed
       lost**. `twice` has no inferred return type with the flag.

    RR1 is put to the maintainer on these numbers; the recommendation
    (a) stands.
  - **The evidence re-sync.** Every evidence pointer of
    `docs/book/allegretto/evaluator.ir.md` whose lines moved since the
    IR was written (`bdcc0da`) is re-pointed by a line diff, with no
    claim changed: in `src/evaluator.ts` E3, E4, E5, E6, E8, E9, E10,
    E11, E15 to E21, E29 and E34; in `src/primitives.ts` E14 and E23
    (E12 and E13 were current); in `src/runtime.ts` E22, E30 and E35;
    in the suite E24 and E43.
  - **C5, measured and set aside.** RR5 (a) was built: the switch in
    `evaluate` named `PrimitiveFunction`, `ComposedFunction`, `Param`,
    `Symbol` and `Expression`, and one `default:` arm returned the value
    for Bits, Structure and any later kind; the IR's C158, C164, C165
    and C151 were re-proposed as C173 to C177. The typecheck was clean
    and every gate check passed, but outputs were not identical: 135 of
    136 runs, the `inspect` of `tests/functions.alg` going from
    `has-errors` to `proven-safe` with the `via_if` host-fault warning
    gone. The cause is the sentinel of §2.5 finding 1: `evaluate` is
    handed a `TailCall` sentinel, a host object with no `kind`, in 17
    of the 68 programs, mostly in the loads of `lib/units.alg` and
    `lib/planning.alg`. The old switch fell through to `undefined`; the
    default arm returned the sentinel as if it were a value, so it is
    not inert. Three options: (a) accept the changed `inspect` output;
    (b) defer C5 until C2 lands under RR7 (a), after which no residual
    holds a sentinel; (c) a default arm that keeps the fall-through for
    a non-value. (b) is the default the PR proposes. C5's commit is
    kept on branch `majodali/b172-c5-default-arm` and waits for the
    maintainer's choice; the IR keeps C158, C164, C165 and C151 until
    then.
  - **A further observation.** At run time, `via_if(zzz)` (an
    unresolved argument) throws the same host TypeError out of
    `evalSource`, for the same reason. C2 removes the cause; the pin
    above avoids the call.
  - **Outputs** (§3 check 3), for the committed tree against its parent
    `5cdd4b9`: 136 of 136 runs identical in stdout, stderr (stats lines
    stripped) and exit code; two runs of the parent were identical too.
  - **Oracle**, on the committed tree. The first filter selects this
    module and stream P's tests by chunk: R1 (the measurement lands),
    R2 (one object per definition) and R3 (the second precompile of a
    top-level literal skipped).
    - `bash scripts/typecheck.sh`: typecheck clean (9 TS6059
      rootDir-convention diagnostics ignored).
    - `ALLEGRO_TEST_FILTER="evaluator|R1 verdict pin|R2|R3" npm test`:
      50 total, 50 passed, 0 failed.
    - `ALLEGRO_TEST_FILTER="effects|refine|totality|file: " npm test`:
      146 total, 146 passed, 0 failed.
    - `npm run lint:load`: counts at or below baseline; 7 sources and 8
      precompile sources.
    - `npm run lint:units`: the unit DAG holds at its baseline
      (discriminator 458, baseline 458).
    - `npm run lint:planes`: the storage plane is reached only through
      the accessor layer.
    - `npm run lint:docs:check`: anchors 0, order 0, gate passed.
    - `npm run lint:ir`: 5 files, clean.
    - `npx tsx scripts/doc-ref-lint.ts`: all markdown doc references
      resolve.
    - `npx tsx scripts/analyze/lane-lint.ts --base origin/main`: lane D,
      0 files outside (the activation commit's files listed with this
      chunk's).
    - `npm run test:shards`: 0 failed, gate passed.
- **2026-11-03 — C2 landed; C5 reapplied.** At the merge of PR #149 the
  maintainer took RR1 (a) and deferred C5 until C2 (option (b) of the C1
  record). C2 implements RR3 (a) and RR7 (a) for `eval_if`, `&&` and
  `||`; C5's commit is cherry-picked unchanged. One gated count rose,
  put to the maintainer as a stop (below).
  - **What changed.** `src/evaluator.ts`:
    `evaluateSpeculatively` (line 266), the speculation entry point a lazy
    primitive calls with its evaluation function; the speculative switch
    of `applyPrimitive`'s evaluation function (`SpeculativeEvalFn`, lines
    274 and 632), so the speculation's result reaches the lazy
    primitive's effect tracking as any evaluation does; `speculate`
    (lines 290 to 313), which makes a fresh child scope with `scopeNew`
    and sets the `compileMode` flag on it before it escapes, unwraps a
    thunk, and applies a `TailCall` sentinel: a residual carrying the
    callee's effects when `inlineCutoff` is null (lines 308 to 312),
    `applyComposed` otherwise (line 313). A throw inside a speculation
    propagates, as on the resolved path. `src/scope.ts` is untouched:
    `scopeNew` is its exported constructor. `src/primitives.ts`:
    `eval_if_impl` (`eval_if`) evaluates both branches through
    `evaluateSpeculatively` (lines 603 to 604); `typed_and_impl` (`&&`)
    and `typed_or_impl` (`||`) evaluate the right operand the same way
    under an unresolved left operand and hold it in a thunk in the
    residual (lines 2229 and 2326). The switch of `evaluate` has C5's
    default arm (`src/evaluator.ts` lines 505 to 512).
  - **The term proposed.** *Speculation mark*: the `compileMode` host
    property that `speculate` sets on the fresh child scope it makes for
    one speculative evaluation. Put to the maintainer for ratification.
  - **The pins flipped**, in `src/test/evaluator.ts`, each comment saying
    C2 flipped it and under which ruling: under RR3, the `&&` and `||`
    residual pins (the right operand is the deferred `print`, the
    residual and `andop`, `orop` carry `io`) and the `pure`-declared `&&`
    and `||` rows (now halting with the mismatch); under RR7, the branch
    tail call pin (`inbranch` and `local` infer `io`, the `pure`-declared
    branch call halts, no residual holds a sentinel) and the pin of
    `evaluate` reached with a sentinel (now: `via_if` precompiles with no
    fault, and `via_if(zzz)` and `inbranch(zzz)` leave residuals holding
    no sentinel); under RR3, the run-time `eval_if` pin (nothing printed,
    for an unresolved Symbol condition and for an unresolved Param
    condition, in Standard mode and in Allegretto). One pin added: with
    an inline cutoff installed, a branch call is unfolded and a recursive
    one is cut. The C3 gap pins are unchanged. A probe on `evaluate` over
    the 68 programs of `tests/` and `demos/` found no sentinel handed to
    it, where C1 found one in 17 programs.
  - **Outputs** (§3 check 3), 136 CLI runs each, against `0e6ea93`
    (C1's merge): after the `&&`/`||` commit, 136 identical; after the
    `eval_if` commit, 135 identical; after C5's cherry-pick, 136
    identical to the `eval_if` commit, so C5 itself changes nothing. The
    one difference is `tests/functions.alg` with `inspect`: the safety
    grade goes from `has-errors` to `proven-safe`, and the lines `type
    errors: 1` and `error in via_if: Cannot read properties of undefined
    (reading 'meta')` are gone. The cause is C2: the residual `eval_if`
    bound to `y` in `via_if` holds the residual call of `pick`, not a
    sentinel, so `evaluate` never falls through its switch. No `//
    expect:` line, no inferred effect set and no other `inspect` line
    changed. RR8 (a) names the gap pins and the inferred-effect lines,
    not a grade or a warning line; the change is the `inspect` rendering
    of the notification the flipped `via_if` gap pin asserts, and is put
    to the maintainer under RR8.
  - **Stop: a gated count rose.** `npm run lint:load`:
    `tests/totality-decreases-demo.alg` `evaluates` 31,182 to 31,222
    (+40, above the baseline), `cutoffResiduals` 2 to 10 (a rise, which
    the floor allows); every other count unchanged. The cause: the tail
    calls in the branches of `countdown` (`countdown(n - 1)`, the demo's
    line 23) and `ack_inner` (lines 31 and 32) were sentinels left in the
    residual and never evaluated; now applied, they pass through
    `applyComposed`'s argument evaluation and checks before the inline
    cutoff cuts them. The `&&`/`||` commit alone leaves every count at
    the baseline. Two options, for the maintainer under RR8 (a):
    - (a) Keep `applyComposed`, as RR7 (a) says ("as `evaluateExpr`
      applies a sentinel"), and raise the baseline for this source to
      `evaluates` 31,222 and `cutoffResiduals` 10, in one commit made in
      the B-164 form, by widening lane D by `bench/load-baseline.json`
      or by lane P.
    - (b) In `speculate`, with a cutoff installed, return the cutoff's
      residual directly for a call on a cycle with an unresolved
      argument, without `applyComposed`. Measured in a scratch copy:
      `evaluates` 31,182 and `cutoffResiduals` 8, the same outputs
      (135 of 136, the same difference) and the first oracle filter 51
      of 51. Its cost: a speculative tail call would skip the viral check
      and the argument checks that a call outside a branch goes through.
  - **The IR** (`docs/book/allegretto/evaluator.ir.md`, RR4 (a)): C178
    replaces C52; C179 and C185 replace C56; C181 replaces C57; C184
    replaces C98; C180, C186, C187, C182, C183 and C188 are new; cluster
    G36 replaces G13, G37 replaces G23; relation R2 re-pointed; evidence
    E49 and E50 added and every pointer moved by C2 and C5 re-synced.
    C55 stays, since `eval_when` is C3's. New ask A4. C5's own claims,
    C173 to C177 with cluster G35 and ask A3, come with the cherry-pick.
  - **Oracle**, on the final tree:
    - `bash scripts/typecheck.sh`: typecheck clean (9 TS6059
      rootDir-convention diagnostics ignored).
    - `ALLEGRO_TEST_FILTER="evaluator|R1 verdict pin|R2|R3" npm test`:
      51 total, 51 passed, 0 failed.
    - `ALLEGRO_TEST_FILTER="effects|refine|totality|file: " npm test`:
      146 total, 146 passed, 0 failed.
    - `npm run lint:load`: failed on the one count above, every other
      count at or below the baseline.
    - `npm run lint:units`: the unit DAG holds at its baseline.
    - `npm run lint:planes`: the storage plane is reached only through
      the accessor layer.
    - `npm run lint:docs:check`: anchors 0, order 0, gate passed.
    - `npm run lint:ir`: 5 files, clean, 0 warnings.
    - `npx tsx scripts/doc-ref-lint.ts`: all markdown doc references
      resolve.
    - `npx tsx scripts/analyze/lane-lint.ts --base origin/main`: lane D,
      0 files outside.
    - `npm run test:shards`: 1,291 test runs, 1,291 passed, 0 failed;
      the gate fails on the load lint's one count alone. The count stop was ruled (a) by the maintainer on 2026-11-03: the baseline of `tests/totality-decreases-demo.alg` is raised to 31,222 evaluates and 10 cutoff residuals by a one-file lane P PR handed over under RR8 (a), which merges before this chunk; the cutoff floor follows once the count has risen on main.
- **2026-11-03 — C3 landed.** At the merge of PR #150 the maintainer
  ratified C2's IR claims (ask A4) and the term *speculation mark*. C3
  implements RR2 (a) for `eval_when`. No output, verdict or gated count
  changed; one ungated cost rose sharply and is put to the maintainer
  (below).
  - **The C2 flip.** In `docs/book/allegretto/evaluator.ir.md`, C178 to
    C180 and C182 to C188 and clusters G36 and G37 go from proposed to
    decided (12 statuses); the term, which had no T element, is added as
    T31, decided; A4 resolved. A3 (C5's claims) is not flipped: the merge
    did not name it.
  - **What changed.** `src/primitives.ts`: `speculateWhenArms` (lines 821
    to 879) and its call in `eval_when_impl` (`eval_when`, line 897). With
    the subject unresolved, every arm's guard and body are evaluated
    through `evaluateSpeculatively`. A binder pattern (the `when_bind`
    marker, or a Symbol pattern bound nowhere in scope, line 864) binds
    the evaluated subject: it is substituted for the arm function's one
    Param. A type pattern (`is Int`) or a destructuring pattern (`{x,
    y}`, `Point(x, y)`) leaves each name as the arm function's own Param,
    unbound and untyped: the arm's body is evaluated as written, and a
    Param evaluates to itself. Nothing constructs a Param; the arm
    function's Params are already fresh per arm, since substitution gives
    every copied function fresh Params (`subst`). The guard is speculated
    like the body, and the body whatever the guard gives. The walk follows
    the chain's links over the same subject, evaluating the subject once,
    speculates a written `else`, and never evaluates the default
    `when_no_match`. A throw inside an arm's speculation propagates, as
    C2 decided. `src/evaluator.ts`: `whenArmThunk`, `isUnboundPatternName`
    and `thunkBodyOf` (lines 272 to 298), the walk's three kind questions,
    kept in the evaluator under the discriminator rule
    (`docs/book/units.md` §3.2); the discriminator count is 456, baseline
    458.
  - **The residual's shape.** The residual `eval_when` holds the
    evaluated subject with the pattern, guard, arm and rest of the chain
    as written, and carries the speculated arms' effects through
    `applyPrimitive`'s tracking of the lazy primitive's evaluation
    function; no type. The reason: the residual must still match when its
    subject resolves, and an evaluated arm cannot be matched again (a
    binder arm's body has the subject substituted, the other arms' bodies
    hold their arm function's Params outside that function). RR2 (a)
    says "the residual holds the evaluated arms"; C3 meets its purpose,
    "the effects of every arm reach the enclosing function", and keeps
    the arms as written. Put to the maintainer.
  - **The pins**, in `src/test/evaluator.ts`. Flipped under RR2: the
    `eval_when` residual pin (now: the residual keeps the arms as written
    and carries `io`; `whenop` and `whenbind` infer `io`) and the
    `pure`-declared `when` row (now halting with the mismatch). Added:
    binder, type-pattern, destructuring, structural, `else` and guard
    arms each hiding a `print` infer `io`, the binder's name being the
    typed placeholder and a destructured name an untyped Param; the
    default `when_no_match` is not evaluated; a residual re-evaluated in
    a scope binding its subject runs the matching arm once, in Standard
    mode and in Allegretto. The run-time pin for `&&`, `||` and `when`
    keeps "nothing printed" and adds that `w` carries `io`.
  - **Outputs** (§3 check 3), 136 CLI runs against `b320735` (C2's
    merge): 136 identical after the code commit. No `inspect` line
    changed: no program of `tests/` or `demos/` had an effect hidden
    behind a `when` that reached an `inspect` effect line. No new halt.
  - **Stop: the load of `lib/planning.alg` became about 30 seconds
    slower.** The gated counts did not move (`npm run lint:load` passes;
    the precompile corpus has no `when` under an unresolved subject), but
    every program that loads `lib/planning.alg` pays it. `evaluate`
    calls, base then C3, one CLI run each:

    | Source | Base | C3 | Wall clock |
    |---|---|---|---|
    | `lib/units.alg` | 168,862 | 170,898 | 0.9 s, 0.7 s |
    | `lib/planning.alg` | 219,433 | 63,915,555 | 0.9 s, 31.7 s |
    | `tests/planning-solve-demo.alg` | 10,144,352 | 73,840,474 | 7.7 s, 38.0 s |
    | `demos/rung3/01-model.alg` | 1,031,542 | 64,727,664 | 1.6 s, 31.0 s |
    | `demos/rung3/02-solve.alg` | 3,779,105 | 67,475,227 | 3.2 s, 32.1 s |

    For `lib/planning.alg`, `inlineExpansions` rose from 910 to 5,260,
    `cutoffResiduals` from 936 to 1,367, `precompiles` stayed 251. The
    136 CLI runs took 245 s against 41 s. The sharded suite took 93 s.
    The cause: the precompile pass now unfolds the calls in every arm of
    the untyped library functions' `when`s (`build_plan`, `apply_item`,
    `build_handler`), whose arms reach the `if`s that C2 already
    speculates, and a local binding or a binder's subject that is a
    residual is evaluated again at each use. The three costliest `when`s
    account for 53 million of the 64 million: `first_or(items, "budget",
    none)` in `build_plan`, `i.k` in `apply_item`, and a `when` over a
    `measure_or` result. Leaving a binder's name unbound instead of
    binding the subject measured 23.5 million. Options, for the
    maintainer: (a) accept the cost and hand it to lane P (B-157, the
    performance stream); (b) bound the speculation, for instance by
    residualising a composed call reached inside a `when` arm's
    speculation with the callee's effects (RR7 (b)'s form), which loses
    effects of forward references and effect variables instantiated
    there; (c) leave a binder's name unbound too, which RR2 (a) excludes
    and which removes about two thirds of the cost only.
  - **The IR** (RR4 (a)): C55 and C181 leave the file (C55 also leaves
    A1's lists); C189 to C195 are new and proposed (every arm
    speculated; a binder's name bound to the subject; other names left as
    the arm's own Params; `else` speculated and `when_no_match` not; the
    residual's shape; its effects and no type; re-evaluation runs the
    matching arm); C196 is inferred through R2 (Rule 2 met for effects);
    cluster G38 replaces G36; R2 re-pointed; E51 added; E13, E14, E23,
    E50 and every `src/evaluator.ts` pointer moved by C3 re-synced. New
    ask A5.
  - **Oracle**, on the final tree:
    - `bash scripts/typecheck.sh`: typecheck clean (9 TS6059
      rootDir-convention diagnostics ignored).
    - `ALLEGRO_TEST_FILTER="evaluator|R1 verdict pin|R2|R3" npm test`:
      54 total, 54 passed, 0 failed.
    - `ALLEGRO_TEST_FILTER="effects|refine|totality|file: |when|match"
      npm test`: 253 total, 253 passed, 0 failed.
    - `npm run lint:load`: counts at or below the baseline.
    - `npm run lint:units`: the unit DAG holds at its baseline
      (discriminator 456, baseline 458).
    - `npm run lint:planes`: the storage plane is reached only through
      the accessor layer.
    - `npm run lint:docs:check`: anchors 0, order 0, gate passed.
    - `npm run lint:ir`: 5 files, clean, 0 warnings.
    - `npx tsx scripts/doc-ref-lint.ts`: all markdown doc references
      resolve.
    - `npx tsx scripts/analyze/lane-lint.ts --base origin/main`: lane D,
      0 files outside.
    - `npm run test:shards`: 1,294 test runs, 1,294 passed, 0 failed;
      gate passed, 93 s.
  - **RR9 taken.** The maintainer ruled on PR #155 for option C ("let's
    go forward with option C, but we'll need to revisit when we want to
    push PE for more optimizations, or if we run into cases where we need
    the full metadata evaluation"). `src/evaluator.ts`:
    `evaluateWhenArmSpeculatively` and its counter `whenArmSpeculations`
    (lines 272 to 285); in `applyComposed`, a composed call with an
    unresolved argument made while a `when` arm speculation is open is
    residualised as an Expression carrying the callee's stashed effects
    (lines 906 to 923). `src/primitives.ts`: `speculateWhenArms` speculates
    guards, arms and the rest of the chain through it (lines 871, 872 and
    881). `if`, `&&` and `||` are as C2 left them. Loading
    `lib/planning.alg`, three CLI runs: `evaluate` 234,306 each time
    (base 219,433; C3 as first committed 63,915,555), `inlineExpansions`
    946, `cutoffResiduals` 936, `precompiles` 251, wall clock 1.28 s, 1.17 s and 1.20 s (base 0.9 s, C3 as first
    committed 31.7 s).
    Two pins added: a call inside an arm (`fwd` calling the forward
    reference `later`, `callee_when` calling the untyped `h`) is a residual
    carrying `io` while the same call in an `if` branch still unfolds; an
    eight-level chain of `when`s each calling the next level twice stays at
    or below 2,000 `evaluate` calls (460 through the CLI, 37,716
    unfolded). Outputs: 136 of 136 identical against `origin/main`. The
    IR gains C197, C198 and C200 (proposed, in ask A5) and C199 (decided
    by RR9), cluster G39 and relation R11 (C197 refines C44).
- **2026-11-03 — C4 landed.** At the merge of PR #155 the maintainer
  took every default, which ratifies ask A5 and the residual's shape of
  the C3 record. C4 restates PE Rule 1 in the spine under RR1 (a), as
  amended by RR9. Docs only: no file under `src/`, `tests/`, `bench/` or
  `scripts/` changed.
  - **The C3 flip.** In `docs/book/allegretto/evaluator.ir.md`, C189 to
    C195, C197, C198 and C200 and clusters G38 and G39 go from proposed
    to decided (12 statuses); A5 resolved. No proposed status was left
    before C4's own claims.
  - **The restated rule**, `docs/book/concepts.md` §25 (partial
    evaluation), lines 1568 to 1576: "An application with an unresolved
    argument produces a **residual** — the application itself, as a
    value — with metadata fields propagated onto it per their rules,
    unless it applies a composed function. A composed function is
    **unfolded**: its body is evaluated with the arguments substituted,
    and Rule 1 governs each application inside it. Two calls are
    residualised instead, carrying the callee's effects: a call into a
    recursion cycle during a typed compilation, because unfolding it
    cannot converge; and a call reached inside a `when` arm that Rule 2
    evaluates, because the unfoldings nested there grow without bound."
    Rule 2's wording is unchanged. The Rationale gains the reason for
    unfolding (lines 1583 to 1586): refinement checks, effect inference
    and theorem discharge run on the unfolded body, where a residual
    would hide everything behind the callee's signature. The
    As-implemented paragraph (lines 1590 to 1595) adds that `eval_if`,
    `&&`, `||` and `eval_when` evaluate their branches or arms
    speculatively and that the evaluation runs no effect. The spine
    still defines *residual* in §26; §25 keeps its inline gloss ("the
    application itself, as a value"), as before.
  - **The delta row**, lines 1597 to 1603: "No delta: both rules are
    implemented as stated since chunks C2 to C4 of **B-172** (the
    partial-evaluation rules as implemented against the spine). The
    `when`-arm exception of Rule 1 is to be revisited, in the
    maintainer's words, "when we want to push PE for more
    optimizations, or if we run into cases where we need the full
    metadata evaluation" (`plans/pe-rules.md` §6, ruling RR9 (unfolding
    inside a speculated `when` arm)). **→ B-172**." (The link on
    `plans/pe-rules.md` is elided.) The pointer is to
    RR9 rather than to B-180 (recursion handling under partial
    evaluation), since the `when`-arm exception is not a recursion
    question. C6 removes or rewrites the `→ B-172` pointer when the
    stream closes.
  - **The IR** (RR4 (a)). C35 is replaced by C201 (residual unless a
    composed function); C202 (unfolding) and C203 (the two exceptions)
    are new; the three quote the spine and are decided by it. C161 ("as
    implemented, PE Rule 1 governs an eager primitive application and an
    application whose function position is unresolved") became false
    under the restated rule, which governs a composed call too, and is
    replaced by C204 (those two applications produce a residual, as the
    rule states). C44 (one exception) is replaced by C205
    (`applyComposed` unfolds, except a call into a recursion cycle
    during a typed compilation or one made inside a `when` arm
    speculation). C154 and C168 stay, both still true. Cluster G40
    replaces G9; relations R3, R4 and R11 re-pointed from C35 and C44 to
    C202 and C205; C44 and C161 leave ask A1's lists. New ask A6: C204
    and C205.
  - **Stale in `docs/book/allegretto/evaluator.md` §3**, for lane A's
    count 2 under RR4 (a), the prose being unchanged by this stream:
    lines 127 to 129, "As implemented, PE Rule 1 governs an eager
    primitive application and an application whose function position is
    unresolved" (C161's sentence); lines 129 to 133, "The exception to
    PE Rule 1 is a composed function applied to an unresolved argument,
    which `applyComposed` unfolds into its substituted body unless the
    call enters a recursion cycle during a typed compilation" (C44's
    sentence: unfolding is now the rule, and there are two exceptions);
    lines 173 to 174, "`eval_if` in `src/primitives.ts` evaluates both
    branches when its condition is unresolved" (true, but silent on
    speculation, stale since C2); lines 177 to 180, "`eval_when` returns
    a residual without evaluating any branch when its subject is
    unresolved. `&&` and `||` return a residual without evaluating the
    right operand when the left operand is unresolved. So `eval_when`,
    `&&` and `||` do not meet PE Rule 2" (false since C2 and C3). The
    section's `[partial]` tag is stale with them.
  - **`docs/book-changes.md`**: no row. Its rules log a non-monotonic
    structural change (an identifier renamed, merged, removed,
    renumbered or reclassified; a chapter moved, split or merged; a
    definition site moved). A restated rule is none of these, and the
    file has never logged an IR claim's replacement.
  - **Oracle**, on the final tree:
    - `npm run lint:docs:check`: anchors 0, order 0, ids 784, gate
      passed (main's count, unchanged).
    - `MTOOL_HOME=/home/user/majodali/methodology-tools npm run lint:ir`:
      5 files, clean, 0 violations, 0 warnings, unratified terms 0.
    - `npx tsx scripts/doc-ref-lint.ts`: all markdown doc references
      resolve.
    - `npm run lint:streams`: 6 plans checked, 0 with findings.
    - `PR_TITLE="B-172: Rule 1 restated in the spine, unfolding as the
      policy with its two exceptions (C4)" npx tsx
      scripts/analyze/lane-lint.ts --base origin/main`: lane D, 4 files,
      0 outside.
    - `ALLEGRO_TEST_FILTER="doc-ref|doc lints|IR lint|stream plans|lane
      lint|evaluator" MTOOL_HOME=/home/user/majodali/methodology-tools npm
      test`: 37 total, 37 passed, 0 failed.
- **2026-11-03 — C6 landed; the stream closes.** PR #158 (C4) merged
  with no comment, which ratified ask A6 of the evaluator IR (claims
  C204 and C205, cluster G40), the spine term *unfolded* (set in bold in
  `docs/book/concepts.md` §25 with its inline meaning and no `def-`
  anchor; it means what this plan's ratified term [unfold](#def-unfold)
  means), and the default that the book pass fixes the one-line summary
  of Rule 1 under requirement R2 when it reaches the spine. The merge
  also accepted the widening that the C4 PR's ask announced: the
  header's `boundary` gains `scripts/analyze/units-baseline.json`, since
  C3's lowering commit was set aside because the boundary did not list
  that file. C6 is docs and status documents, plus that one baseline
  commit; no file under `src/`, `tests/`, `bench/` or `lib/` changed.
  - **The A6 flip.** In `docs/book/allegretto/evaluator.ir.md`, C204,
    C205 and G40 go from proposed to decided (3 statuses); A6 resolved.
    No proposed status remains in the file.
  - **The outcome of §1, clause by clause.** Each clause is quoted.
    1. "`docs/book/concepts.md` §25 and the evaluator agree. Each rule
       is either implemented as stated or restated with the
       implementation's policy and its reason. The delta row is empty,
       or names only what a ruling of §6 leaves open." **Met.** Rule 1
       is restated with its policy (`docs/book/concepts.md:1568` to
       `:1576`, C4) and its reason (`:1583` to `:1586`); Rule 2 is
       unchanged (`:1577` to `:1579`) and implemented as stated since
       C2 and C3. The IR quotes the restated rule in C201 to C203 and
       checks the code against it in C204 and C205, all decided. The
       delta row (`:1597` to `:1604`) reads closed and names only the
       revisit that RR9 (unfolding inside a speculated `when` arm)
       leaves open by ruling.
    2. "`eval_when`, `&&` and `||` meet PE Rule 2 as ruled (RR2, RR3),
       and no speculative evaluation runs an effect (RR3)." **Met.**
       `typed_and_impl` and `typed_or_impl` speculate the right operand
       (`src/primitives.ts:2307`, `:2404`, C2); `speculateWhenArms`
       speculates every arm (`src/primitives.ts:865`, C3); `speculate`
       sets the speculation mark on a fresh child scope
       (`src/evaluator.ts:331`), so an effectful primitive defers. Pins
       in `src/test/evaluator.ts`: "Rule 2 — && with an unresolved left
       operand evaluates the right operand speculatively" (line 445),
       its `||` twin (467), the `pure`-declared `&&`, `||` and `when`
       rows (495, 502, 508), "eval_when with an unresolved subject
       evaluates every arm speculatively" (305), "eval_if at run time
       with an unresolved condition runs neither branch's effects"
       (610), and "at run time &&, || and when with an unresolved input
       print nothing" (649).
    3. "A call in tail position inside a branch evaluated under an
       unresolved condition is handled as RR7 rules (§2.5, finding 1);
       under RR7's options (a) and (b), no residual holds a `TailCall`
       sentinel." **Met** under RR7 (a), C2: `speculate` applies the
       sentinel. Pins: "a tail call in a branch under an unresolved
       condition is applied; no residual holds a sentinel" (line 529),
       "a tail call in a branch, with a cutoff installed, is unfolded;
       a recursive one is cut" (568), and "evaluate is no longer reached
       with a TailCall sentinel; via_if precompiles cleanly" (587). IR
       claims C183 and C188, decided.
    4. "The switch in `evaluate` has the default arm the discriminator
       rule (`docs/book/units.md` §3.2) requires, as RR5 rules."
       **Met** under RR5 (a), C5: the switch from `src/evaluator.ts:504`
       names Symbol, Expression, the two function kinds and Param, and
       its default arm (`:546` to `:553`) returns the value. IR claims
       C173 and C177, decided.
    5. "The evaluator chapter's IR
       (`docs/book/allegretto/evaluator.ir.md`) describes the result,
       and its prose and count 2 are handed on as RR4 rules." **Met.**
       Each chunk re-proposed the claims it changed, and every one is
       now decided: C173 to C205, with no proposed status left and
       `npm run lint:ir` clean (oracle below). C6 checked the PE claims
       and their evidence pointers against the code at `d2bf712` and
       found none false. The IR's Status line records the close and the
       hand-off below.
    6. "Every `// expect:` line, every totality verdict and every count
       in `bench/load-baseline.json` is unchanged, except what RR8 lists
       as allowed to move." **Met.** `git diff --stat 0cff2bf origin/main
       -- tests/ basics.alg demos/ lib/` is empty, so no `// expect:`
       line changed. Under `src/test/` the stream added
       `src/test/evaluator.ts` and one import line in
       `src/test/index.ts`; `VERDICT_PIN` in `src/test/totality.ts` is
       untouched. The one count that moved is C2's, for
       `tests/totality-decreases-demo.alg`, by lane P under RR8 (a):
       PR #151 raised `evaluates` from 31,182 to 31,222 and
       `cutoffResiduals` from 2 to 10, and PR #152 raised the cutoff
       floor to 10. What else moved is what RR8 (a) allows: the gap pins
       C2 flipped (seven) and C3 flipped (two), and the inferred-effect
       sets of the functions whose `&&`, `||`, `when` or branch tail
       call hid an effect. The one `inspect` change, `tests/functions.alg`
       going from `has-errors` to `proven-safe`, was put to the
       maintainer under RR8 at PR #150, which merged.
  - **The hand-off to lane A** (RR4 (a)). The book pass
    (`docs/plans/book-pass.md`) takes the evaluator chapter after this
    stream reads `status: closed`. This stream never edited
    `docs/book/allegretto/evaluator.md`; its prose is as stream A left
    it, and the IR is the normative text it must be brought to. What is
    stale, by line on `origin/main` at `d2bf712`, with what each should
    now say:
    - §2, lines 98 to 101: "The switch in `evaluate` names all seven
      kinds, with no default arm. That switch is a defect against the
      discriminator rule. No backlog item owns the defect." Should say:
      the switch names Symbol, Expression, the two function kinds and
      Param, and one default arm returns the value for every other kind
      (C173, C177; the sentence about the `units` report skipping the
      unit, C176, stays true).
    - §3, lines 127 to 129: "As implemented, PE Rule 1 governs an eager
      primitive application and an application whose function position
      is unresolved." Should say: PE Rule 1 governs every application,
      a composed call included (C201, C204).
    - §3, lines 129 to 133: "The exception to PE Rule 1 is a composed
      function applied to an unresolved argument, which `applyComposed`
      unfolds into its substituted body unless the call enters a
      recursion cycle during a typed compilation." Should say: unfolding
      is the rule for a composed call, with two calls residualised
      instead, one into a recursion cycle during a typed compilation and
      one inside a speculated `when` arm (C202, C203, C205).
    - §3, lines 173 to 174: "`eval_if` in `src/primitives.ts` evaluates
      both branches when its condition is unresolved." Should add: it
      evaluates them speculatively, so no effect runs (C178, C186).
    - §3, lines 177 to 180: "`eval_when` returns a residual without
      evaluating any branch when its subject is unresolved. `&&` and
      `||` return a residual without evaluating the right operand when
      the left operand is unresolved. So `eval_when`, `&&` and `||` do
      not meet PE Rule 2." Should say: `eval_when` speculates every arm
      and `&&` and `||` the right operand, so all three meet PE Rule 2
      for effects (C179, C185, C189 to C196).
    - The `[partial]` tag of §3's heading (line 108): stale with them;
      §3 now describes rules implemented as stated.
    - Count 2 of the stranger rounds, which RR4 (a) puts after C6, run
      once on the final text with the three defects that
      `docs/book/allegretto/evaluator.review.md` ("After the count")
      holds: round 7's finding 2, touch-up edit A and the excess in the
      C172 sentence. The orchestrating session holds the count-2
      briefs.
    - Requirement R2's one-line summary of Rule 1 in
      `docs/book/concepts.md` (lines 165 to 167, "PE Rule 1 (unresolved
      argument produces a residual with propagated metadata)"): it
      predates the restated rule, and the book pass fixes it at its
      chunk F11 (the spine), as the merge of PR #158 ruled.
  - **The PRs.** #147 (the plan), #148 (the activation, rulings taken,
    B-180 and B-181 filed), #149 (C1 and RR1's numbers), #150 (C2 and
    C5), #151 and #152 (lane P's baseline raises for C2's count), #155
    (C3, RR9 taken), #158 (C4), and C6's PR, the close.
  - **Closed with the stream**: B-172; the reserves B-178 (first
    out-of-scope finding of the PE-rules stream) and B-179 (second
    out-of-scope finding of the PE-rules stream), unused. Lane D's
    later reviews are B-180 (recursion handling under partial
    evaluation) and B-181 (the hard-coded precompile and compile-time
    phases), filed at PR #148.
  - **The units discriminator baseline** lowers from 458 to 456 in the
    top commit, C3's lowering commit applied unchanged after the branch
    was brought up to date with `origin/main` (B-164 (ratchet baselines
    under concurrent merges)). C3's `speculateWhenArms` walk moved its
    kind questions into the evaluator and the count fell to 456 there.
  - **Oracle**, on the tree before the baseline commit:
    measured on this branch merged with `origin/main` at `564881f` (the
    merge of PR #157, B-174's preface), which moved while C6 was written.
    - `npm run lint:streams`: 6 plans checked, 0 with findings.
    - `npm run lint:docs:check`: anchors 0, order 0, ids 784, gate
      passed (main's count, unchanged).
    - `MTOOL_HOME=/home/user/majodali/methodology-tools npm run lint:ir`:
      6 files, clean, 0 violations, 0 warnings; unratified terms 4, all
      in `docs/book/preface.ir.md` from main, none in the evaluator IR.
    - `npx tsx scripts/doc-ref-lint.ts`: all markdown doc references
      resolve.
    - `npm run lint:units`: the unit DAG holds at its baseline;
      discriminator 456, baseline 458 before the top commit.
    - `PR_TITLE="B-172: the stream closes, both rules implemented as
      stated, the prose and count 2 handed to lane A (C6)" npx tsx
      scripts/analyze/lane-lint.ts --base origin/main`: lane D, 6 files,
      0 outside, before the baseline commit adds the seventh.
    - `ALLEGRO_TEST_FILTER="doc-ref|doc lints|IR lint|stream plans|lane
      lint|units|evaluator" MTOOL_HOME=/home/user/majodali/methodology-tools
      npm test`: 41 total, 41 passed, 0 failed.
