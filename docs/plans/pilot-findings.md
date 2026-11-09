---
type: stream-plan
status: closed
backlog: B-185
lane: D
merge: human-gated
oracle:
  - npm test
  - npm run test:shards
  - npm run lint:load
  - npm run lint:units
  - npm run lint:planes
  - npm run lint:streams
  - npm run lint:docs:check
  - npx tsx scripts/doc-ref-lint.ts
  - npx tsx scripts/analyze/lane-lint.ts
chunks: [PF1, PF2, PF3, PF4]
reserves: [B-154, B-156, B-183]
boundary:
  - src/primitives.ts
  - lib/units.alg
  - tests/**
  - src/test/**
  - docs/plans/pilot-findings.md
  - website/index.html
  - website/sandbox.html
  - web/sandbox.html
---

# The planning pilot's correctness findings closed — the pilot-findings stream

> **Status: closed** — drafted 2026-11-06 by the orchestrating session,
> from the reading and probes of §2; active since the merge of PR #168
> on 2026-11-07, which took every recommendation of §6 (R1 (a), R2 (b),
> R3 (a), R4 (a), R5 (b)) and ratified the output changes of §3 and the
> terms of §1. The maintainer wrote "All defaults approved, terms and
> changes ratified." Closed 2026-11-09 at PR #(number), after the last
> chunk, PF4, merged as PR #179: every clause of §1's outcome is met
> (§7, the closing entry); B-190 (name capture) stays open, and the
> carry-overs B-191 (a trailing block comment breaks the dedent), B-192
> (the backing union of an induction and a `by` proof) and B-193 (`by`
> read as a unit inside a proposition) are filed. The status line and
> the header's `status` say the same thing.
>
> **Reader**: the session that runs lane D (L2 semantics), and the
> maintainer ruling on §6. Assumed known: the layers
> (`docs/book/layers.md`), the gate (`docs/book/process.md` §5), what a
> [stream](parallel-streams.md#def-stream) is, and the closed lane D
> stream `docs/plans/pe-rules.md`, whose form this plan follows. Not
> assumed: the code of the four findings. §1 defines the terms and §2
> gives what the code does, each claim with its file and line, measured
> on `origin/main` at `a8e19c8`.

## 1. Outcome and terms

**Why now.** Rung 3 of the demo ladder, B-151 (the planning pilot),
landed in 2026-10 and left correctness findings open. The book pass
filed one more on 2026-11-04. The maintainer ruled on 2026-11-06 that
the next validating demo, an AI iteration loop over the planning model,
is built on rung 3, so these findings are fixed first, as one short
human-gated stream.

**Outcome.** The stream is met when all of these hold:

- **B-185 (a sampled induction proof reported as discharged).** A
  theorem discharged by `prove_induction`, directly, through
  `tactics.by_induction`, or as the term of a `by` clause, reaches the
  verdict as resting on the `sampled` tier and appears in the
  assumption ledger.
- **B-154 (unit-name shadowing).** A quantity literal written with a
  unit the units module ships means that unit, whatever the file binds
  under the same name, and a file can still define its own units (as
  R2 rules).
- **B-156 (short-circuit over an error value).** `&&`, `||` and `!`
  treat an error value as R3 rules: either the error propagates, or the
  boolean reading stands and is documented.
- **B-183 (a trailing comment breaks a contract body's parse).** A
  block body whose last line ends in a `//` comment parses, however
  many spaces precede the comment (as R4 rules, in lane P).
- Every `// expect:` line is unchanged. Every `verify` verdict over
  `tests/*.alg` and `demos/**/*.alg` is unchanged except the lines §3
  ratifies for the two induction theorems of
  `tests/proofs-induction-demo.alg`.

**Terms.** Each is defined here because neither the methodology
vocabulary nor `docs/book/` defines it.

- <a id="def-shipped-unit"></a>**Shipped unit**: a unit that
  `lib/units.alg` binds by name (`m`, `km`, `cm`, `mm`, `s`, `min`,
  `minute`, `minutes`, `h`, `hour`, `hours`, `seconds`, `kg`, `g`, `N`,
  `J`, `W`, `Pa`), as opposed to a unit a file defines itself with
  `Unit(...)`.
- <a id="def-name-capture"></a>**Name capture**: a consumer file's
  top-level binding that changes what a free name inside a function of
  a `use`d library resolves to, because that name is looked up in the
  caller's scope when the function runs (§2.2).

**Reserved ids.** B-185 is the item the stream delivers. The book pass
(`docs/plans/book-pass.md`) reserved it, and B-183 with it, and its §8
says both are worked by the orchestrating session. This plan's
`backlog: B-185` claim outranks the book pass's reserve:
`scripts/analyze/lane-lint.ts` ranks "a `backlog` match" above "a
`reserves` match", so a PR titled with B-185 is checked against lane D
and this boundary. The header reserves B-154, B-156 and B-183. B-156 is
also in the reserves of the closed `docs/plans/fast-library-load.md`;
an open plan outranks a closed one. B-183 is not settled by this
header: the book pass also reserves it, both plans are open, the two
claims tie, and the lane check keeps the first plan it reads in file
order, which is `book-pass.md`. A B-183 PR would be checked against
lane A, whose globs hold no code. R4 resolves it: B-183's chunk runs
under its own one-chunk lane P plan, whose `backlog: B-183` outranks
both reserves.

## 2. The problem, measured

**Question.** For each finding: what does the program do today, where
is the fault, and what does each candidate fix cost in outputs, pins
and gated counts?

**Method.** Read on `origin/main` at `a8e19c8`, 2026-11-06. Probes run
through the CLI (`npx tsx src/index.ts`, with `verify` and `inspect`)
in the scratch folder of the drafting session, never in the
repository. Each candidate fix was applied to a scratch copy of the
tree and measured there, one fix at a time, with the suite, `npm run
lint:load` and the 136 CLI runs (`run` and `inspect` over the 59
programs of `tests/*.alg` and the 9 of `demos/**/*.alg`), and for
B-185 the 68 `verify` runs too. In the scratch copy four suite tests
fail under every setting, unfixed tree included, because the copy is
not a git checkout (the doc-reference, doc, IR and boundary lints).
They are not counted below.

### 2.1 B-185: a sampled induction proof reported as discharged

**Reproduction.** `npx tsx src/index.ts verify
tests/proofs-induction-demo.alg`, exit 0:

```
Verdict (verified): 6/6 discharged
  ✓ bool_refl — by auto-PE
  ✓ bool_refl_t — by auto-PE
  ✓ base — by auto-PE
  ✓ add_zero_right — by auto-PE
  ✓ base2 — by auto-PE
  ✓ add_zero_t — by auto-PE
  laws: 12/12 discharged
  coercions: 2/2 obligations discharged
  assumption ledger: clean — all proofs rest on proven backing; no pending obligations
```

`add_zero_right` and `add_zero_t` rest on four sampled steps, and the
ledger says "all proofs rest on proven backing".

**Where.**

- `prove_induction_impl` (`src/primitives.ts:4330` to `:4378`) checks
  the base case, then calls the step function for n = 0 to 3
  (`_INDUCTION_SAMPLE_K`, `:4302`), and returns `_makeProof` with the
  proposition "forall n: NonNeg, p(n) [verified base + 4 inductive
  steps]" (`:4377`). The tier is in the display text only.
- `makeProof` (`src/types-std.ts:4681` to `:4686`) writes the
  proposition and the discharged channel, nothing else.
- The verdict reads two carriers of discharge strength, both written
  only by the equality combinators. One is the proof's own fields
  under E-R6 (equality proofs record their law backing): `equality`,
  `lawName` and `lawTier`, declared on Proof at `src/types-std.ts:4672`
  to `:4674` and written by `stampLawBacking`
  (`src/slot-accessors.ts:422`). The other is the transitive set
  `lawBackings` of B-091 (the assumption ledger), a host-plane property
  (`backingsOf`, `stampBackings`, `unionBackings`,
  `src/slot-accessors.ts:435` to `:456`), listed among the host-plane
  properties in `docs/book/standard/type-system.md` §4.
  `recordLawBacking` (`src/primitives.ts:4070`) writes both.
- `buildVerdict` (`src/pcp.ts:704`) copies both into the theorem's
  `lawBacking` and `restsOn`; `weakBackingsOf` (`:480`) keeps the
  `admitted` and `sampled` records; `formatVerdict` (`:548`) prints them
  as "[resting on …]" (`:573` to `:575`); `buildAssumptionLedger`
  (`:500`) lists them. The path exists; nothing on it is written for an
  induction.
- A second gap on the same path: `proof_check_impl`, the checker of
  `theorem NAME: P by TERM`, mints a fresh proof for a non-equality
  proposition and drops the term's backing set (`src/primitives.ts:4268`
  to `:4273`). Probe: `theorem ind: prove_induction(…)` then `theorem
  via_by: 2 > 1 by ind`. With the first gap fixed alone, `ind` rests on
  sampled and `via_by` rests on nothing. The same drop already hides an
  admitted equality law behind a `by` over a non-equality proposition.
- The direct form `theorem t: prove_induction(…)` keeps a backing:
  `proof_by_eval_impl` returns a Proof value unchanged
  (`src/primitives.ts:3916` to `:3918`), and so does
  `tactics.by_induction` (`lib/tactics.alg:53`).

**What the decision record says.** D34 (discharging completion effects)
and E-R6 make discharge strength verdict-visible; the primer lists the
tiers (`docs/book/proving-in-allegro.md`, "Laws, discharge tiers, and
the strict gate": "`sampled` — survived bounded sampling; survival, not
proof") and already states that `prove_induction` does "BOUNDED SAMPLE
VERIFICATION (K=4 in the current implementation)" (§4 of that
chapter). The primer's promise is met by the code's checks; only the
verdict is missing it.

**Candidate measured (R1 (a)).** `prove_induction_impl` stamps the
record `{equality: "NonNeg", law: "induction", tier: "sampled"}` with
`stampBackings`, unioned with the base proof's own set, and
`proof_check_impl`'s two non-equality returns carry the term's set.
Results: `verify` over the demo prints `✓ add_zero_right — by auto-PE
[resting on sampled 'induction' of 'NonNeg']`, the same for
`add_zero_t`, and the ledger `assumption ledger: rests on 0 admitted, 1
sampled` with `! sampled 'induction' of 'NonNeg' — backs:
add_zero_right, add_zero_t`. `Verdict (verified)` stays: a sampled
record does not fail a verdict. The `by` probe's `via_by` rests on
sampled too. Over the corpus: 67 of 68 `verify` runs identical, 135 of
136 CLI runs identical, the one difference the `inspect` of the demo,
which gains a line `rests on: sampled 'induction' of 'NonNeg'` under
each of the two theorems. No `// expect:` line moves: the demo pins
`print` lines only. Suite: 1,297 tests, 1,293 passed, the 4
non-checkout failures only; the induction tests of `src/test/proofs.ts`
(`:451` to `:527`) assert discharge only.

### 2.2 B-154: unit-name shadowing

**Reproduction.** A file of four lines, `use units`, `s = 42`,
`d = 30 s`, `print(d)`, exit 1:

```
Error in shadow.alg: type_dispatch: 'dim' not found on Int
```

Without `s = 42` the same file prints the quantity. The pilot's
original case was a cycle: `s = solve(plan)` in a file whose plan holds
`30s backoff`. A smaller cycle, `d = 30 s` and `s = d.mag`, halts with
"Maximum call stack size exceeded", exit 1.

**Where.** `units_grammar` (`lib/units.alg:235` to `:246`) captures a
unit as `u:ident` (`:236`, `:237`), so the literal's unit is a Symbol in
the consumer's file. The comment above it states the rule, U-R2 (literal
syntax scope) of `docs/plans/units-dsl.md` as applied: "The matched unit
idents resolve in the CONSUMER's scope — `use units` provides them; a
local rebinding of a unit name shadows it" (`:233` to `:234`). The
template itself is hygienic: its free names (`qty`) resolve in the
units module (`docs/book/extension/grammar.md` §4, "Template
substitution is hygienic"); probed, a file binding `qty(v, u) => 99`
leaves `30 s` a quantity.

**A wider fault, found while probing.** A fix inside `lib/units.alg`
cannot rely on the library's own names. A helper `shipped_unit(name)`
whose `when` arm returns `s` returned 42 when called from a file that
binds `s = 42`. The same holds outside the units DSL: in a file with
`use units`, a top-level `wrap_name(n) => "HIJACKED"` makes
`m.mul(km.div(s)).toString()` print `m·HIJACKED`, and
`dim_mul(a, b) => 7` makes `m.mul(s).dim` print 7. This is
[name capture](#def-name-capture). The cause: a library's references to
its own bindings stay Symbols ("source-to-source references stay as
Symbols and resolve from the eval context at runtime",
`src/runtime.ts:236` to `:242`), and a Symbol resolves in the scope it
is evaluated in (`scopeLookup(ctx, value.name)`, `src/evaluator.ts:513`),
which for a library function called from a file is the file's scope.
`import` is not affected: a file binding `proof_refl(x) => 99` leaves
`tactics.same(9)` a proof. The pilot fixed one case of this in its
choices chunk (`docs/plans/planning-pilot.md` §8: "a library's `when`
pattern variable captured by the calling file's binding of the same
name", fixed by `markPatternBinders`); free names in a library's
function bodies remain. It is not B-154 and needs its own item; filing
one is outside this plan's reserves, so it is an ask (§6, R2).

**Candidates measured.**

| Option | `s = 42` file | cycle file | `km = 42`, `30 km` | a file-defined `furlong` | gated counts |
|---|---|---|---|---|---|
| none (today) | `'dim' not found on Int`, exit 1 | stack overflow, exit 1 | `'dim' not found on Int` | `603.504 m` | at the baseline |
| (a) a units-vocabulary refusal | halts: "failed refinement predicate for LiteralUnit: the unit of a quantity literal is bound to 42, which is not a Unit: …" | stack overflow, exit 1 | halts the same way | `603.504 m` | 2 above: `lib/units.alg` `matchAttempts` 134,246 to 137,041, `memoWrites` 203,463 to 207,712 |
| (b) shipped units resolved in the module first | `30 s` | `30` | `30 km` | `603.504 m` | 12 above, in 6 sources (below) |

- **(a)** adds `as_unit(u: LiteralUnit): Unit => u` with `LiteralUnit =
  Any & literal_unit_ok(_)`, whose predicate answers `true` for a
  `Unit` and an error value naming the bound value otherwise, and calls
  it from the two `unit_pow` alternatives. The refusal reads in units
  vocabulary and names the value. It cannot name the identifier: the
  grammar hands the action the identifier's value. It does not reach
  the cycle, since the unit's value is evaluated before it is checked,
  and it does not reach a file binding a shipped name to some other
  `Unit`. Two forms failed first: a `Unit & …` refinement checks the
  base type first and reports "expected Unit, got Int"; a parameter
  typed `LiteralUnit` with no return annotation narrows the result, and
  `.dim` then fails on the annotation.
- **(b)** adds a production `unit_atom` before the identifier: one
  alternative per shipped name, each a labelled regex of the name
  followed by no identifier character, whose template is the name
  itself (`x:/s(?![A-Za-z0-9_])/ => x => s`), then `u:ident` as the
  last alternative; the two `unit_pow` alternatives read `unit_atom`.
  Template hygiene makes each template's name the module's unit, and a
  name the module does not ship still resolves in the consumer's scope.
  The [shipped units](#def-shipped-unit) are then listed twice in the
  module, as bindings and as alternatives, so the chunk adds a test that
  holds the two in step. A file can no longer give a shipped name its
  own meaning inside a literal; the comment of `:233` to `:234` changes
  with it. Measured: suite 1,292 of 1,297, the 4 non-checkout failures
  and the load lint; 136 of 136 CLI runs identical. Counts above the
  baseline: `lib/units.alg` `matchAttempts` 143,540 (+6.9%) and
  `memoWrites` 216,866 (+6.6%); `lib/planning.alg` 653,908 and 997,378
  (+0.7%, +0.9%); `tests/planning-solve-demo.alg` 51,379 and 76,738;
  `tests/lib/build_pipeline.alg` 6,150 and 8,897; `demos/rung3/01-model.alg`
  34,103 and 50,127; `demos/rung3/02-solve.alg` 62,175 and 92,892 (each
  under 4%).
  A cheaper variant, one regex alternative over all the names whose
  template reads a module-level table (`shipped_units.filter(p => p[0]
  == x)[0][1]`), raised `lib/planning.alg` less (650,134 and 989,830)
  and `lib/units.alg` more (147,128 and 222,759), and changed one output:
  the `inspect` of `tests/planning-handlers-demo.alg` describes the
  residual body of `deploy_with` as 255 nodes, depth 15, with `bits_eq`
  among its primitives, where today it reads 206 nodes, depth 13. The
  table's lookup stays in a residual where the name alone does not. The
  per-name form is the one recommended.
- **(c)**, not probed: fix name capture itself, so that a `use`d
  library's free names resolve in the library. That is a change to
  `src/runtime.ts` and `src/evaluator.ts`, outside this boundary, and it
  does not fix B-154 alone: the literal's identifier is the consumer's
  by U-R2, so `s = 42` would still reach it.

For (a), a filtered run over the units, planning and rung-demo tests passed
20 of 20.

### 2.3 B-156: short-circuit over an error value

**Reproduction.** In Standard mode, with `e = error "why"`, the CLI
prints, for each expression, its value and `error of` it:

| Expression | Value | `error of` |
|---|---|---|
| `false \|\| e` | `false` | none |
| `true && e` | `false` | none |
| `e \|\| true` | `true` | none |
| `e && false` | `false` | none |
| `!e` | `true` | none |
| `if e then 1 else 2` | the error | `why` |
| `1 + e` | the error | `why` |

The entry names `||` and `&&` on the right. Probing adds the left
operand and `!` (`typed_not`): all five drop the error. `if` and the
eager operators propagate it. A refinement predicate
`pos_ok(x) => x > 0 || error "{x} is not positive"` refuses `f(0 - 1)`
with "failed refinement predicate for Pos" and no reason; written with
`if … else error` it refuses with ": -1 is not positive". That is why
`well_formed` in `lib/planning.alg` uses `if` (its comment at `:734`).

**Where.** `&&`, `||` and `!` are lazy primitives (`typed_and`,
`typed_or`, `typed_not`, registered at `src/primitives.ts:4547` to
`:4550`), so the evaluator's viral check, which runs over an eager
primitive's evaluated arguments (`viralOnto`, `src/evaluator.ts:745`;
`src/metadata.ts:331`), never sees their operands. Each impl reads only
the operand's bits: `typed_and_impl` (`src/primitives.ts:2295` to
`:2332`), `typed_or_impl` (`:2400` to `:2427`), `typed_not_impl`
(`:2429` to `:2439`). `eval_if_impl` checks its condition for an error
by hand (`:575`), which is how `if` propagates.

**Candidate measured (R3 (a)).** Each of the three returns an operand
that carries an error before reading its bits: the left operand first,
then the right one when it is evaluated. Results: all five rows above
yield the error with `error of` reading `why`; the `||` refinement
refuses with ": -1 is not positive". Suite: 1,297, 1,293 passed, the 4
non-checkout failures only. Outputs: 136 of 136 CLI runs identical. No
operand of `&&`, `||` or `!` in `lib/`, `tests/` or `demos/` is an error
value in any run of the corpus. The probe checked the `error` field by
name, as `eval_if_impl` does; the chunk asks the propagation table
instead (`viralOnto`), since `docs/book/process.md` §6 says "the
propagation table alone governs channel behavior — never hand-roll
per-channel logic in an impl". `lib/` has 23 uses of `&&` or `||`,
`tests/` and `demos/` 22; none has an `error` operand written in it.

### 2.4 B-183: a trailing comment breaks a contract body's parse

**Reproduction.** The minimal case of
`docs/records/book-pass/f1-readme.md` §7 (`use contracts`, `f(x: Int):
Int =>`, `requires x > 0`, `x + x   // c`, a blank line, `print(f(2))`),
exit 1:

```
Error in b183.alg: Parse error at position 49: expected ' ', '	', pattern /^(?:\/\/[^\n]*)/, ..., got '
' at position 49
```

**The record's characterisation is incomplete.** It says the body
parses "with no blank line" and "without `requires`". Probed, both
fail: the same file without the blank line fails at 49, and a body
`y = x` then `x + y   // c` fails with no `use contracts` at all. What
decides it is the gap before the comment, measured against the block's
indentation:

| Last line of a block indented 2 | Result |
|---|---|
| `x + y// c`, `x + y // c` | parses |
| `x + y  // c`, `x + y   // c`, two tabs | parse error |
| `x + y   `, no comment | parses |
| `// c` on its own line after the last line, at the block's column | parse error |

In a block indented 4, a gap of 3 parses and a gap of 4 fails. A body
of one line parses with any gap, because it falls back to the inline
body form (`fn_body`, `src/grammar2/base-grammar.ts:451` to `:456`),
which the earlier probes of the record met.

**Where.** `block_expr` (`src/grammar2/base-grammar.ts:441` to `:447`)
is `INDENT`, statements separated by `line_break`, `DEDENT`. After the
last statement the separator fails (its `NEWLINE` lands on a column
other than the block's), so `DEDENT` is tried at the position right
after `x + y`, before the comment. `DEDENT`
(`src/grammar2/engine.ts:794` to `:807`) asks `skipToNextContent`
(`:722` to `:745`) for the next content's column, and that function
assumes it starts at a line start: it counts the gap as leading
indentation (`:729` to `:736`) and stops at `/`, so it answers column 3
for a gap of 3, and `col >= top` refuses the dedent (`:802`). A
comment-only line fails the same way, the comment counting as content.
The fault is in lane P's engine, not in `lib/contracts.alg`.

**Candidate measured.** In `DEDENT` only: before measuring, skip
horizontal whitespace and a `//` comment to the end of the line, and
any following line holding only a comment. Results: every failing
probe above parses and prints its value; suite 1,293 of 1,297, the 4
non-checkout failures only; 136 of 136 CLI runs identical; `npm run
lint:load` at the baseline, every parse count unchanged. Fixing
`skipToNextContent` itself would also change `NEWLINE`, `INDENT` and
`CONT_NL` and was not probed.

## 3. Oracle and stop conditions

Each chunk is decided by these checks:

1. **The suite is green and every pin holds.** `npm test` and `npm run
   test:shards` pass; `bash scripts/typecheck.sh` is clean. No `//
   expect:` line in `tests/*.alg` or `basics.alg` changes. No existing
   assertion in `src/test/` changes.
2. **Outputs identical.** Every `tests/*.alg` and `demos/**/*.alg` run
   through the CLI with `run`, `inspect` and `verify`, before and after
   the chunk: stdout, stderr and exit code. Differences are allowed only
   as the ratified list below names them.
3. **The ratchets hold.** `npm run lint:load`, `npm run lint:units`,
   `npm run lint:planes`, and the boundary battery in the suite. PF4's
   counts are the one expected rise (R2).
4. **The documents hold.** `npm run lint:streams`, `npm run
   lint:docs:check` (ids at or below the committed baseline),
   `npx tsx scripts/doc-ref-lint.ts`.
5. **The lane holds.** `npx tsx scripts/analyze/lane-lint.ts --base
   origin/main` with the chunk's PR title in `PR_TITLE` reports lane D
   and no file outside this boundary; `--check` passes. The header lists
   the script without the variable, since the header's grammar admits
   `npx tsx <file>` and not an environment assignment.

**Ratified by this plan** (the discussion `docs/book/process.md` §6
asks for before an existing output changes), for PF2 only:

- `verify tests/proofs-induction-demo.alg`: the theorem lines of
  `add_zero_right` and `add_zero_t` gain `[resting on sampled
  'induction' of 'NonNeg']`; the ledger line `assumption ledger: clean
  — all proofs rest on proven backing; no pending obligations` becomes
  `assumption ledger: rests on 0 admitted, 1 sampled` followed by `!
  sampled 'induction' of 'NonNeg' — backs: add_zero_right, add_zero_t`.
  The first line, `Verdict (verified): 6/6 discharged`, does not change.
- `inspect tests/proofs-induction-demo.alg`: one line `rests on:
  sampled 'induction' of 'NonNeg'` under each of the two theorems.
- `verify --json` of the same file: the two theorems gain `restsOn`, a
  field pcp/1 already has.

The wording follows R1 as taken; under another option the chunk
re-measures and the PR names the lines it moves.

**Stop conditions.** The four of `docs/book/process.md` §3: a failed
check, a scope change, a chunk needing a decision, a chunk whose
landing summary carries asks. Lane D keeps the per-chunk gate
(`docs/backlog.md` §"Parallel lanes"), so every chunk stops at its PR
in any case. The stream adds five:

- **Any `// expect:` change**, and any output change outside the list
  above.
- **Any verdict change outside the induction theorems**: a `verify`
  line of another theorem, a ledger line of another file, or a
  `Verdict (…)` first line anywhere.
- **Any baselined count rising** other than PF4's, and PF4's above what
  R2's ruling allows. `bench/load-baseline.json` is lane P's; this
  stream cannot move it.
- **A new halt in `lib/`, `tests/` or `demos/`.** PF3 makes errors
  visible that were dropped, and PF4 makes a name module-first. A
  library function or demo that was passing only because of either is
  a finding for a ruling, not a fix the chunk makes.
- **Any file outside the boundary** (§4).

## 4. File boundary

**Lane D (L2 semantics)**, narrowed by the header's `boundary`. Every
glob there is inside lane D's globs in `scripts/analyze/lanes.json`.

**What each file takes.**

- `src/primitives.ts`: `prove_induction_impl` and `proof_check_impl`
  (PF2); `typed_and_impl`, `typed_or_impl` and `typed_not_impl` (PF3).
- `lib/units.alg`: `units_grammar`, its comment, and the table of
  shipped units under R2 (b) (PF4).
- `tests/**`: new demo files only, each registered by one `fileTest`
  line. An existing demo is an oracle and is never edited.
- `src/test/**`: new tests, in the module that already holds the area's
  tests: `src/test/proofs.ts` for PF2 and PF4 (the induction and units
  tests are there), `src/test/types-core.ts` for PF3 (it registers
  `tests/logical.alg`).
- The status documents under B-162 (conflict-free status documents):
  this plan's row in `docs/plans/README.md`, B-185's, B-154's, B-156's
  and B-183's entries and lane D's row in `docs/backlog.md`, and, from
  the activation chunk on, the section `## Stream D — the pilot's
  findings` in `docs/CHANGELOG.md`.

**Outside the boundary, on purpose.** A chunk that needs one of these
stops:

- `src/grammar2/**`: lane P's only. B-183's fix is there (R4).
- `src/pcp.ts`, `src/slot-accessors.ts`, `src/types-std.ts`: R1 (a)
  needs none of them, since the verdict, the ledger and the backing set
  already exist. R1 (c) would need all three, and lane C also holds
  `src/pcp.ts`.
- `src/runtime.ts` and `src/evaluator.ts`: name capture (§2.2) is
  there, and it is not this stream's.
- `bench/**`, `bench/load-baseline.json` included: lane P's files (R2).
- `docs/book/**`: the book pass's §8 says the orchestrating session
  never edits it. Three IR claims go stale by these chunks, and R5
  decides who re-syncs them: PF3 moves the lines that evidence E14 of
  `docs/book/allegretto/evaluator.ir.md` cites (`typed_and_impl` and
  `typed_or_impl`); PF4 changes the size of the grammar block that
  claim C74 of `docs/book/demo-ladder.ir.md` counts ("a twelve-line
  grammar block") and the line count of claim C142 ("`lib/units.alg`
  holds 246 lines"), with their evidence E20. The primer
  (`docs/book/proving-in-allegro.md`) needs no change for PF2: it
  already states the bound and the tier.

**Lanes sharing these files.** Lane D is internally serial: the rest of
lane D's band waits while the stream runs. Lanes K and P take
`src/primitives.ts` only while lane D is not in it. PF1 runs in lane P
under its own plan and can run beside the lane D chunks, whose files it
does not share.

## 5. Chunk sequence

Each chunk is one PR, human-gated. The order is the smallest risk
first: PF1 changes no output and no count; PF2 changes two ratified
verdict lines and nothing else; PF3 changes no output in the corpus but
changes a semantics, and waits for R3; PF4 changes a rule of U-R2 and
raises gated counts, and waits for R2 and a lane P baseline commit.

| Chunk | Backlog | Deliverable | Oracle |
|---|---|---|---|
| PF1 | B-183 | **The dedent after a trailing comment**, in lane P under its own one-chunk plan (R4): `DEDENT` in `src/grammar2/engine.ts` skips the rest of the line's whitespace and comment, and comment-only lines, before it measures the next content's column. Tests in `src/test/grammar2-engine.ts`: each row of §2.4's table, gaps of 1 to 4 in blocks indented 2 and 4, the README's minimal case | the §2.4 probes parse; suite green; 136 outputs identical; `npm run lint:load` at the baseline |
| PF2 | B-185 | **The induction tier in the verdict**, as R1 rules. Under (a): `prove_induction_impl` stamps the `sampled` record of §2.1 on its proof, unioned with the base proof's set; `proof_check_impl` carries the term's set on its two non-equality returns. Tests in `src/test/proofs.ts`: the verdict of a direct, a tactic and a `by` induction theorem rests on `sampled 'induction' of 'NonNeg'`; the ledger names it; a `by` over an admitted equality law keeps its backing; the verdict stays `verified` | the ratified lines of §3 and no other output or verdict change; suite green |
| PF3 | B-156 | **Logical operators over an error value**, as R3 rules. Under (a): `typed_and_impl`, `typed_or_impl` and `typed_not_impl` return an operand carrying a viral channel, asked through the propagation table, left operand first; a new demo pins the five rows of §2.3 and the `\|\|` refinement's reason. Under (b): the boolean reading stated where the error channel is documented, in a chapter the book pass edits (R5), and a demo pinning today's rows | 136 outputs identical; suite green; the new demo's pins |
| PF4 | B-154 | **Shipped units resolve in the module first**, as R2 rules. Under (b): `unit_atom` and the table of shipped units in `units_grammar`, the comment restated; tests: the three probes of §2.2, a file-defined unit, the table in step with the bindings. Before its merge, a one-file lane P PR raises `bench/load-baseline.json` to the counts measured on the chunk's tree (B-164 (ratchet baselines under concurrent merges)) | the §2.2 probes as in row (b); suite green; 136 outputs identical; `npm run lint:load` at the raised baseline |

The activation chunk is the first lane D PR after this plan merges
(PF2's): it creates the changelog section and sets this plan and the
manifest row to active. The stream closes in PF4's PR, or in the last
chunk to land, with the record of §7 against §1's outcome.

## 6. Rulings

Numbered R1 to R5 within this plan. Each is put to the maintainer at
this plan's PR; the merge with no ruling comment takes every
recommendation, except R3, which waits for the discussion the
maintainer asked for.

- **R1 — How the induction tier reaches the verdict.**
  - (a) A backing record on the proof's transitive set: `{equality:
    "NonNeg", law: "induction", tier: "sampled"}` through
    `stampBackings`, and `proof_check_impl` carries the set through
    `by`. No new field and no new slot (D39 (the structure slot
    table)): `lawBackings` is an existing host-plane property, and the
    verdict, the "[resting on …]" rendering and the ledger already read
    it. Cost: the record's `equality` field holds the quantified domain,
    not an equality; the ledger label reads "'induction' of 'NonNeg'";
    `p.lawTier` on an induction proof stays unset, as on any proof that
    is not an equality.
  - (b) As (a), and also the proof's own E-R6 fields, so `p.lawTier`
    reads `sampled`. Cost: `p.equality` would read `NonNeg`, which
    E-R6 defines as the equality the proof chained, on a proof that is
    not an equality.
  - (c) A new Proof field `tier`, for any proof: declared in Proof's
    members (`src/types-std.ts:4662` to `:4675`) as a D39 row, a field
    of the theorem record, rendered and ledgered by `src/pcp.ts`. Cost:
    a third carrier of the same fact beside E-R6's fields and the set;
    every combinator then needs a tier rule; three files outside this
    boundary, one of them lane C's.
  - (d) Read the tier from the proposition text "[verified base + 4
    inductive steps]". **Rejected**: the text is for display; a `by`
    theorem relabels its proof with the user's source
    (`proof_check_impl`), so the marker is gone exactly where (a) needs
    a carrier; and a user's proposition can contain the same characters.
  - **Recommended: (a).** It uses the carrier the ledger was built for,
    in the existing tier vocabulary, and changes one file. If a tier for
    every proof is wanted later, (c) is its own item.
  - **Taken: (a)**, at the merge of PR #168, 2026-11-07.
- **R2 — B-154: which fix, and the wider finding.**
  - (a) A units-vocabulary refusal: a literal whose unit is not a
    `Unit` halts with a message naming the value (§2.2). Leaves the
    cycle as a stack overflow and a shipped name rebound to another
    `Unit` silent. Two parse counts rise, in `lib/units.alg` only.
  - (b) [Shipped units](#def-shipped-unit) resolve in the module first,
    any other unit name in the consumer's scope (§2.2). Closes the
    pilot's case and the cycle; keeps U-R2's "a file can define units";
    reverses "a local rebinding of a unit name shadows it" for the 18
    shipped names. Twelve parse counts rise in six sources: 6.9% in
    `lib/units.alg`, under 4% elsewhere. No output changes.
  - (c) Both: (b), and (a) for the fallback, so a non-shipped name bound
    to a non-`Unit` value halts in units vocabulary. Costs the two of
    them together.
  - **Recommended: (b).** It is the only option that closes the case
    the pilot met, and it keeps file-defined units. The rise needs a
    one-file lane P baseline commit before PF4 merges, as stream D's
    chunk C2 had (`docs/plans/pe-rules.md` §7).
  - **The wider finding**, [name capture](#def-name-capture) (§2.2), is
    an ask: file it as a new backlog item, in lane D or K, with the
    probes of §2.2 as its evidence. This stream does not fix it, and
    filing it needs an id the header does not reserve.
  - **Taken: (b)**, at the merge of PR #168, 2026-11-07. The wider
    finding is filed as B-190 (name capture) in lane D, at the PR of
    the lane D activation chunk (PF2's), not at PF1's: PF1 runs in
    lane P under its own plan.
- **R3 — B-156: the semantics of `&&`, `||` and `!` over an error
  value.** The maintainer asked to discuss this before a semantics is
  chosen (2026-10-27).
  - (a) Propagate: the three operators join the viral rule, as `if`
    and every eager operator already do. `false || error "why"` is the
    error; so are `true && e`, `e || true`, `e && false` and `!e`. What
    changes in `lib/` and `tests/`: nothing measured, since no operand in
    the corpus is an error value. `well_formed` could then be written
    with `||`, which the chunk does not do. A predicate written `ok ||
    error "why"` explains its refusal.
  - (b) Keep the boolean reading and document it: an error value reads
    as false on either side of `&&` and `||`, and `!` turns it into
    true. Nothing in the code changes. The documentation goes in the
    chapter that states the error channel (`docs/book/concepts.md`), a
    book-pass edit (R5), and a demo pins today's rows.
  - (c) Propagate on the right operand only, the entry's question as
    filed, keeping `e || true` true. Splits the rule by operand position,
    which no other operator does.
  - **Recommended: (a).** The error channel is viral everywhere else,
    `if` included (`eval_if_impl` checks its condition, `:575`); the
    three are the only operators that drop it, and they drop it
    silently, which is the failure the viral rule exists to prevent.
    The measured cost is zero outputs. The chunk waits for this ruling.
  - **Taken: (a)**, at the merge of PR #168, 2026-11-07.
- **R4 — B-183: its lane.** The fault is in `src/grammar2/engine.ts`
  (§2.4), a lane P file.
  - (a) A one-chunk lane P plan under `docs/plans/`, named for its
    outcome (proposed: the trailing-comment dedent), with `backlog: B-183` and a
    boundary of `src/grammar2/engine.ts` and `src/test/grammar2-*.ts`.
    Its `backlog` claim outranks both reserves (§1), so PF1's PR passes
    the lane check under its own title. This plan keeps B-183 in its
    reserves as the record that the stream tracks it, and its §7 records
    PF1's merge.
  - (b) PF1 as a chunk of this plan, its PR titled with B-185 and
    widening this plan's boundary by `src/grammar2/engine.ts`. Not
    possible: the boundary narrows lane D, and lane D's globs hold no
    `src/grammar2/` file.
  - (c) Leave B-183 to the book pass. Its boundary holds no code.
  - **Recommended: (a).** It is the route the lane check admits. The
    one-chunk plan is drafted in PF1's own PR, or before it at the
    maintainer's choice.
  - **Taken: (a)**, at the merge of PR #168, 2026-11-07.
- **R5 — Who re-syncs the IR claims these chunks stale.** The claims of
  §4 (E14 of the evaluator chapter's IR; C74, C142 and E20 of the demo
  ladder's IR), and, under R3 (b), the documentation of the boolean
  reading.
  - (a) Each chunk edits them, this plan's boundary widened by the two
    IR files. Needs the book pass's §8 amended, since it says the
    orchestrating session never edits `docs/book/**`.
  - (b) Each chunk's PR body lists the claims it stales, with the new
    lines and counts, for the review session; the book pass re-syncs
    them at its next edit of each chapter, or as a one-commit fix.
  - **Recommended: (b).** It keeps §8 as ratified. None of the stale
    claims is about behaviour these chunks change: E14 and E20 are
    evidence pointers, C74 and C142 are sizes.
  - **Taken: (b)**, at the merge of PR #168, 2026-11-07.

## 7. Record

- **2026-11-06 — plan drafted.** From the reading and probes of §2, on
  `origin/main` at `a8e19c8`; no code changed. The plan names the
  stream in B-185's entry and in lane D's row, notes it in B-154's,
  B-156's and B-183's entries, and appends the manifest row. No
  changelog section until the plan is ratified: as for stream D, the
  activation chunk writes it. Rulings R1 to R5 and one ask (a backlog
  item for name capture, R2) await the maintainer.
- **2026-11-07 — plan ratified; the stream active.** Merged as PR #168.
  The maintainer: "All defaults approved, terms and changes ratified."
  Every recommendation of §6 taken (R1 (a), R2 (b), R3 (a), R4 (a),
  R5 (b)), the output changes of §3 and the terms *shipped unit* and
  *name capture* ratified. The lane D activation chunk (PF2's PR) sets
  this plan and its manifest row to active, opens the changelog section
  `## Stream D — the pilot's findings`, and files the wider finding of
  R2 as B-190 (name capture), since PF1 runs in lane P under its own
  plan.
- **2026-11-07 — PF1 landed**, as PR #172, under the one-chunk lane P
  plan `docs/plans/trailing-comment-dedent.md` (R4 (a)), whose §7 holds
  the record: `DEDENT` in `src/grammar2/engine.ts` calls a new
  `skipTrailingComments` before it measures the next content's column;
  21 tests in `src/test/grammar2-engine.ts`; 204 of 204 CLI runs
  identical and every parse count unchanged. Written here at the
  stream's close: the lane check refused that lane D file in the lane P
  PR, and PF2's and PF3's PRs did not carry the line. Found and left by
  PF1: a trailing `/* … */` block comment after a gap as wide as the
  block's indentation still fails to parse (filed at the close as
  B-191 (a trailing block comment breaks the dedent)).
- **2026-11-07 — PF2 landed.** B-185 (a sampled induction proof
  reported as discharged), R1 (a), on branch
  `majodali/b185-induction-tier` off `origin/main` at `b5eac65`.
  - **The changes**, both in `src/primitives.ts`.
    `prove_induction_impl` (`:4343`) builds its proof (`:4402`) and
    stamps the record `{equality: "NonNeg", law: "induction", tier:
    "sampled"}` through `stampBackings`, unioned (`unionBackings`) with
    the base proof's own set (`:4390` to `:4408`). "NonNeg" is the
    primitive's fixed domain, now the constant `_INDUCTION_DOMAIN`
    (`:4315`), which the proposition text also prints; the comment at
    the stamp site says the record's `equality` field holds a domain
    here, not an equality. The proof's E-R6 fields stay unset.
    `proof_check_impl` (`:4198`) carries the term's transitive set onto
    the proof its two non-equality returns mint (`:4266` to `:4283`,
    `withTermBackings`); the equality path is unchanged. No file outside
    the boundary changed: the verdict (`buildVerdict`), the "[resting on
    …]" rendering (`formatVerdict`), the ledger (`buildAssumptionLedger`)
    and the `inspect` line "rests on:" (`src/introspect.ts:679`) already
    read the set.
  - **Probes**, before and after. `theorem ind: prove_induction(…)` then
    `theorem via_by: 2 > 1 by ind`: before, both rest on nothing and the
    ledger is clean; after, both rest on sampled 'induction' of 'NonNeg'
    and the ledger reads `! sampled 'induction' of 'NonNeg' — backs: ind,
    via_by`. A `by` over an admitted equality law, `theorem via_by: (2 >
    1) by chain` with `chain` resting on admitted 'trans' of 'Quantity':
    before, `via_by` rests on nothing; after, on the admitted law, and
    the ledger names `chain, via_by`. Under `use units` the proposition
    needs its parentheses: `1 by` reads as a quantity literal with the
    unit `by` and the parse fails at `chain`.
  - **Tests**, appended to `src/test/proofs.ts` (`:881` to `:981`): "B-185:
    a direct prove_induction theorem rests on sampled 'induction' of
    'NonNeg'", "B-185: a tactics.by_induction theorem rests on sampled
    'induction' of 'NonNeg'", "B-185: a `by` theorem over an induction
    rests on what its term rests on", "B-185: a `by` over a non-equality
    proposition keeps an admitted equality law's backing", "B-185: an
    induction keeps its base proof's own backing in the union". Each
    asserts the verdict stays `verified` and the ledger names the backs.
    All five fail on the unfixed tree. No existing assertion changed.
  - **The outputs comparison** (§3 check 2): 205 runs, `run`, `inspect`
    and `verify` over the 59 programs of `tests/*.alg` and the 9 of
    `demos/**/*.alg`, and `verify --json` of the demo, stdout, stderr and
    exit code each. 202 identical. The three that differ are the
    ratified lines of §3 on `tests/proofs-induction-demo.alg` and
    nothing else: `verify` (two theorem lines gain `[resting on sampled
    'induction' of 'NonNeg']`, the ledger line becomes `assumption
    ledger: rests on 0 admitted, 1 sampled` and `! sampled 'induction'
    of 'NonNeg' — backs: add_zero_right, add_zero_t`; the first line
    `Verdict (verified): 6/6 discharged` unchanged), `inspect` (one line
    `rests on: sampled 'induction' of 'NonNeg'` under each of the two
    theorems), `verify --json` (the two theorems gain `restsOn`, once
    `verifiedAt` is normalised). The result matches the drafting
    session's measured outputs line for line.
  - **Claims for the book pass** (R5 (b)). PF2 stales none of E14 of
    `docs/book/allegretto/evaluator.ir.md` (`typed_and_impl` and
    `typed_or_impl`, lines PF2 does not move; PF3's) or C74, C142 and
    E20 of `docs/book/demo-ladder.ir.md` (`lib/units.alg`; PF4's). PF2
    moves the registry lines below `:4268` by 30: evidence E2 of
    `docs/book/platform/host.ir.md` ("lines 4405–4408 (`print`) and
    4531–4533 (`delay`, `fetch`)") was already stale on `origin/main`
    (4495 and 4619 to 4620) and now reads 4525 and 4649 to 4650. The
    primer `docs/book/proving-in-allegro.md` is incomplete, not false:
    §4's paragraph on bounded sample verification does not say the
    verdict marks the theorem `[resting on sampled 'induction' of
    'NonNeg']`, and "Laws, discharge tiers, and the strict gate" says
    that equality proofs carry the transitive backing set, where an
    induction proof and a `by` theorem's proof now carry it too. The
    description of the host-plane property `lawBackings`
    (`docs/book/standard/type-system.md` §4) names it only, and the
    record's `equality` field holding a domain is stated at the stamp
    site; the interface `LawBackingRec` in `src/slot-accessors.ts`,
    outside this boundary, could say the same.
  - **Oracles**: in the PR body.
- **2026-11-07 — PF3 landed.** B-156 (short-circuit over an error
  value), R3 (a), on branch `majodali/b156-error-shortcircuit` off
  `origin/main` at `7cd2b72`.
  - **The changes**, all in `src/primitives.ts`. A helper
    `viralOperand(v)` (`:2304` to `:2306`, its comment `:2295` to
    `:2303`) is `viralOnto([v], v)`; the import at `:4` gains
    `viralOnto`. `typed_and_impl` (`:2308` to `:2349`) asks it of the
    left operand (`:2323` to `:2324`) and of the applied right operand
    (`:2342` to `:2343`), `typed_or_impl` (`:2417` to `:2448`) the same
    (`:2424` to `:2425`, `:2441` to `:2442`), `typed_not_impl` (`:2450`
    to `:2462`) of its operand (`:2455` to `:2456`). Each returns the
    table's answer before reading the operand's bits. The speculation
    branches under an unresolved left operand (`:2320`, `:2421`) and the
    residuals under an unresolved operand are unchanged. The registration
    (`:4600` to `:4603`) is unchanged.
  - **The table entry point.** `viralOnto` (`src/metadata.ts:331`), the
    `viral` rule applied, which the evaluator's eager path calls over an
    eager primitive's evaluated arguments (`src/evaluator.ts:745`). It
    walks `viralFields()`, so the `error` field is not named in the
    impls, and a field registered `viral` later gets the same path. It
    gives a propagated result, not the operand: the residual handed to
    it, with the first viral field and the candidate's `type`. With the
    operand as both candidate and residual, the result is the operand
    with its viral field and its `type`, which is what the eager path
    gives its own residual. `eval_if_impl` still reads `error` by name
    (`:575`); this chunk does not touch it.
  - **The demo** `tests/logical-error-demo.alg`, registered by one
    `fileTest` line in `src/test/types-core.ts` beside
    `tests/logical.alg`. It pins `false || e`, `true && e`, `e || true`,
    `e && false` and `!e` as `error(why)` with `error of` reading `why`;
    `if e then 1 else 2` (`error(why)`, `why`) and `error of (1 + e)`
    (`why`) for comparison; the left operand first (`error of (error
    "left" || error "right")` reads `left`, `error of (false || error
    "right")` reads `right`); the predicate `pos_ok(x) => x > 0 || error
    "{x} is not positive"`: `pos_ok(3)` is `true`, `error of pos_ok(0 -
    1)` and `error of Pos(0 - 1)` read `-1 is not positive`, `Pos(3)` is
    `3`; and `true && false`, `false || true`, `!false`. The annotation
    path halts the program, which an `// expect:` line cannot pin, so a
    test appended to `src/test/types-core.ts`, "logical: B-156 a
    refinement predicate written with || halts with its reason", pins the
    halt "failed refinement predicate for Pos: -1 is not positive". The
    demo's rows and the test fail on the unfixed tree; on it the
    guarded construction reads "refinement check failed (got -1)".
    `tests/logical.alg` is unchanged.
  - **The outputs comparison** (§3 check 2): `run`, `inspect` and
    `verify` over the 59 programs of `tests/*.alg` and the 9 of
    `demos/**/*.alg`, stdout, stderr and exit code each, on `7cd2b72`
    and on the chunk's tree: 204 of 204 identical. The new demo's three
    runs exit 0. **The halt check**: `lib/` holds 23 uses of `&&` or `||`
    and 13 of `!`, `tests/` and `demos/` outside the new demo 20 of `&&`
    or `||` and 3 of `!`. A scratch copy of the chunk's tree that writes
    a line to stderr whenever `viralOperand` answers ran the same 207
    runs: no line outside the new demo's runs. No operand of the three
    operators in the corpus carries an error, so no new halt.
    `lib/planning.alg`'s `well_formed` keeps its `if` form.
  - **Claims for the book pass** (R5 (b)). E14 of
    `docs/book/allegretto/evaluator.ir.md`: the ranges become
    `:2308` to `:2349` and `:2417` to `:2448`, the speculation lines
    2320 and 2421; the evidence should add that a resolved operand
    carrying a viral field is returned through `viralOnto` before its
    bits are read. Its claims C89, C179 and C185 stay true. The chapter
    gains a claim: `&&`, `||` and `!` return an operand carrying a viral
    field, the left one first. `docs/book/allegretto/evaluator.md` §3
    says `src/evaluator.ts` leaves PE Rule 2 to each lazy primitive; the
    viral rule is left to them the same way, and `eval_if`, `&&`, `||`
    and `!` apply it. `docs/book/allegretto/metadata-and-capability.md`
    §5 says the evaluator calls `viralOnto` at its three application
    sites; `src/primitives.ts` is now a fourth caller. Its paragraph on
    the field `error` says "an error-carrying `if` condition propagates
    the error rather than taking a branch"; the three operators do the
    same. `docs/book/concepts.md`'s "errors are viral" (SC-8) becomes
    true of the three operators. `docs/book/language-reference.md`,
    "Logical operators (short-circuiting)", could add `false || error
    "why"` reading as the error. No chapter states the boolean reading,
    so no sentence becomes false. Every `src/primitives.ts` pointer past
    `:2294` moves by 13 to 23 lines; E2 of
    `docs/book/platform/host.ir.md` now reads 4548 and 4672 to 4673.
  - **Oracles**: in the PR body.
- **2026-11-07 — PF4 landed.** B-154 (unit-name shadowing), R2 (b), on
  branch `majodali/b154-unit-shadowing` off `origin/main` at `7cd2b72`.
  - **The change**, in `lib/units.alg` (`:242` to `:262`): `unit_atom`,
    one labelled regex alternative per shipped unit name (18: km, cm, mm,
    minutes, minute, min, hours, hour, seconds, kg, Pa, m, s, h, g, N, J,
    W), each followed by no identifier character, with the name itself
    as the template, then `u:ident` last; the two `unit_pow`
    alternatives read `unit_atom`. Template hygiene makes each
    template's name the module's unit. The comment at `:233` to `:240`
    restates the rule: shipped names resolve in the module; any other
    identifier in the consumer's scope, so a file can define units
    (U-R2 kept) and can no longer give a shipped name its own meaning
    inside a literal.
  - **The in-step test**, in `src/test/proofs.ts`: every module binding
    whose type is the module's `Unit` (aliases such as `min = minute`
    included) against every `unit_atom` alternative but the last, with
    the regex name equal to the template name, no duplicates, and the
    last alternative exactly `u:ident`; a scratch run with one
    alternative removed fails it (18 against 17).
  - **The demo** `tests/units-shadowing-demo.alg`, suite-pinned: the
    cycle `d = 30 s`, `s = d.mag` prints `30` and `30 s`; a
    function-local `s = 42` leaves `30 s` a quantity; `km = 42` then
    `30 km` prints `30 km` and converts; a file-defined `furlong`
    still converts (`603.504 m`); `h` rebound to a hand is the hour
    inside a literal and the hand by name outside one.
  - **The outputs comparison** (§3 check 2): 204 of 204 runs identical
    (`run`, `inspect` and `verify` over 68 programs); the `inspect` of
    `tests/planning-handlers-demo.alg` unchanged, which the table
    variant had moved. No new halt.
  - **The counts** (`npm run lint:load`, matchAttempts / memoWrites,
    before and after): `lib/units.alg` 134,246 / 203,463 to 143,630 /
    217,004 (+7.0%, +6.7%; 90 and 138 above the plan's figures, from the
    longer comment); `lib/planning.alg` 649,616 / 988,794 to 653,908 /
    997,378; `tests/planning-solve-demo.alg` 50,788 / 75,588 to 51,379 /
    76,738; `tests/lib/build_pipeline.alg` 6,033 / 8,675 to 6,150 /
    8,897; `demos/rung3/01-model.alg` 33,647 / 49,249 to 34,103 /
    50,127; `demos/rung3/02-solve.alg` 60,692 / 89,980 to 62,175 /
    92,892. The precompile counts are unchanged. The raise is lane P's
    one-file PR, measured on this branch merged with main, which merges
    before this chunk (B-164 (ratchet baselines under concurrent
    merges)).
  - **A stop met and resolved.** The three web pages carry a generated
    copy of `lib/units.alg`, and the gate checks the copy against the
    file since PR #166 (B-176 (the host chapter's findings) item 2), so
    the change turned two suite tests red. The pages were lane C's only.
    Resolved by the orchestrating session: lane D's globs gain the three
    pages in a lane S PR (PR #176), this plan's header boundary names
    them, and `scripts/sync-web-libs.ts` regenerated them in this
    chunk. The plan's §2.2 measurement could not see this, since its
    scratch copy was not a checkout.
  - **Claims to re-propose** (R5 (b)), all in `docs/book/demo-ladder.ir.md`:
    C74 ("a twelve-line grammar block": now 31 lines, `lib/units.alg:241`
    to `:271`), C142 ("246 lines": now 265), E20 (the ranges 235 to 246
    and the two counts). No book or rung 2 material states "a local
    rebinding shadows"; that wording was the library comment's only.
  - **Oracles**: typecheck clean; `npm run lint:units`, `lint:planes`,
    `lint:docs:check` (ids 784), `lint:ir`, `doc-ref-lint`,
    `lint:streams` clean; the lane check lane D, 0 outside; `npm run
    lint:load` 12 counts above the baseline, as expected, until lane P's
    raise; `npm run test:shards` green but for the load lint.
- **2026-11-09 — the stream closes.** PR #179 (PF4) merged on
  2026-11-09 with no comment, after lane S's PR #176 (lane D's globs
  gain the three web pages) and lane P's PR #178 (`bench/load-baseline.json`
  raised to PF4's counts, measured on PF4's branch merged with main,
  B-164 (ratchet baselines under concurrent merges)). The four chunks:
  PF1 as PR #172 (lane P, under `docs/plans/trailing-comment-dedent.md`),
  PF2 as PR #173, PF3 as PR #175, PF4 as PR #179. This entry is docs and
  status documents only: no file under `src/`, `lib/`, `tests/` or
  `demos/` changes in the closing PR, #(number).
  - **The outcome of §1, clause by clause.** Each clause is quoted.
    1. "B-185: a theorem discharged by `prove_induction`, directly,
       through `tactics.by_induction`, or as the term of a `by` clause,
       reaches the verdict as resting on the `sampled` tier and appears
       in the assumption ledger." **Met** (PF2). `prove_induction_impl`
       stamps `{equality: "NonNeg", law: "induction", tier: "sampled"}`
       through `stampBackings`, unioned with the base proof's set
       (`src/primitives.ts`, the PF2 entry's lines); `proof_check_impl`
       carries the term's set onto the proof it mints for a
       non-equality proposition. `verify tests/proofs-induction-demo.alg`
       reads `✓ add_zero_right — by auto-PE [resting on sampled
       'induction' of 'NonNeg']`, the same for `add_zero_t`, and `!
       sampled 'induction' of 'NonNeg' — backs: add_zero_right,
       add_zero_t`. Five tests in `src/test/proofs.ts` pin the three
       forms, the `by` over an admitted law and the union.
    2. "B-154: a quantity literal written with a unit the units module
       ships means that unit, whatever the file binds under the same
       name, and a file can still define its own units (as R2 rules)."
       **Met** (PF4, R2 (b)). `unit_atom` in `lib/units.alg` names the
       18 shipped units, each as a labelled regex whose template is the
       name itself, then `u:ident`. `tests/units-shadowing-demo.alg`
       pins `km = 42` then `30 km` printing `30 km`, `h` rebound to a
       hand being the hour inside a literal and the hand outside one,
       and a file-defined `furlong` converting (`603.504 m`). The
       in-step test in `src/test/proofs.ts` holds the bindings and the
       alternatives to the same set.
    3. "B-156: `&&`, `||` and `!` treat an error value as R3 rules:
       either the error propagates, or the boolean reading stands and is
       documented." **Met** (PF3, R3 (a): the error propagates).
       `viralOperand(v)`, which is `viralOnto([v], v)`, is asked of each
       operand before its bits are read, the left one first
       (`src/primitives.ts`, the PF3 entry's lines).
       `tests/logical-error-demo.alg` pins the five rows of §2.3 as the
       error with its reason and `pos_ok(-1)` refusing with ": -1 is
       not positive". No operand of the three operators in `lib/`,
       `tests/` or `demos/` carries an error, so no new halt.
    4. "B-183: a block body whose last line ends in a `//` comment
       parses, however many spaces precede the comment (as R4 rules, in
       lane P)." **Met** (PF1, R4 (a)). `skipTrailingComments` in
       `src/grammar2/engine.ts`, called by `DEDENT`; 21 tests in
       `src/test/grammar2-engine.ts`, 11 of which fail on the unfixed
       tree in §2.4's pattern; the README's taste example parses as
       printed. The clause says `//`; a `/* … */` block comment in the
       same place still fails and is B-191's.
    5. "Every `// expect:` line is unchanged. Every `verify` verdict
       over `tests/*.alg` and `demos/**/*.alg` is unchanged except the
       lines §3 ratifies for the two induction theorems of
       `tests/proofs-induction-demo.alg`." **Met.** No chunk changed an
       `// expect:` line; the two new demos add theirs. Per chunk, the
       comparison of §3 check 2 read 204 of 204 identical (PF1), 202 of
       205 with the three ratified differences (PF2), 204 of 204 (PF3)
       and 204 of 204 (PF4). Cumulatively, at the close: `run`,
       `inspect` and `verify` over the 68 programs of `tests/*.alg` and
       `demos/**/*.alg` on `a8e19c8` (the base §2 measured) and on
       `origin/main` at `c6e2692` (PR #179's merge): CORPUS_RESULT
  - **Carry-overs filed** in `docs/backlog.md`, each as the chunk's PR
    asked and the merge defaulted: B-191 (a trailing block comment
    breaks the dedent), lane P, from PF1; B-192 (the backing union of
    an induction and a `by` proof), lane D, from PF2 (the union takes
    the base proof's backings only, and a `by` whose proposition itself
    evaluates to a proof carries the term's set only); B-193 (`by` read
    as a unit inside a proposition), lane D, from PF2's side finding
    (under `use units`, `theorem t: 2 > 1 by chain` fails to parse
    because `1 by` reads as a quantity literal). B-190 (name capture)
    stays open for lane D, a plan of its own, after the planning loop.
  - **For the review session** (R5 (b)), the claims and sentences the
    four chunks named, consolidated: `docs/book/grammar-formalism.md`
    §5.1 lines 315 to 316 on `DEDENT` ("at or below", and comments as
    content) (PF1); `docs/book/proving-in-allegro.md` §4 (the verdict's
    `[resting on sampled 'induction' of 'NonNeg']`) and "Laws,
    discharge tiers, and the strict gate" (induction and `by` proofs
    carry the transitive set too), `docs/book/standard/type-system.md`
    §4 (`lawBackings`'s description) (PF2); E14 of
    `docs/book/allegretto/evaluator.ir.md` (ranges and the viral
    evidence), a new chapter claim for the three operators,
    `docs/book/allegretto/evaluator.md` §3, `docs/book/allegretto/metadata-and-capability.md`
    §5 (a fourth `viralOnto` caller; the `error` paragraph),
    `docs/book/concepts.md` SC-8, `docs/book/language-reference.md`
    "Logical operators (short-circuiting)" (PF3); C74, C142 and E20 of
    `docs/book/demo-ladder.ir.md` (PF4); E2 of
    `docs/book/platform/host.ir.md` (line numbers, stale before PF2 and
    moved by PF2 and PF3). No `docs/book/**` file changed in this
    stream.
  - **Status documents.** This header and status line read closed; the
    manifest row in `docs/plans/README.md` closed; lane D's row in
    `docs/backlog.md` closes the stream and names the planning loop as
    the lane's current stream; B-185's entry names the close; the
    changelog section's intro reads closed, with this entry under it.
    `docs/plans/trailing-comment-dedent.md` still reads `status:
    active` though it closed at PR #172's merge: that header is lane
    P's file, so a lane P PR of its own (`B-183: …`) flips it.
  - **Differed from the plan.** §5 says the stream closes in PF4's PR
    or in the last chunk to land; it closes in a PR of its own, since
    PF4's merge waited on the lane P baseline raise and its records were
    written before the cumulative comparison above could be run. The
    reserves B-154, B-156 and B-183 all landed; none closes unused.
  - **Oracles**: in the PR body.
