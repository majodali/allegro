---
type: stream-plan
status: active
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
---

# The partial-evaluation rules and the evaluator in agreement — the PE-rules stream

> **Status: active** — drafted 2026-11-03 from the evidence in §2;
> ratified at the merge of PR #147 on 2026-11-03 with every
> recommendation taken (RR2 to RR8; RR1's recommendation (a) stands, to
> be confirmed on C1's numbers) and the four terms of §1 ratified. The
> status line and the header's `status` say the same thing.
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
