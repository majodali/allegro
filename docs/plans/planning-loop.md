---
type: stream-plan
status: active
backlog: B-187
lane: D
merge: human-gated
oracle:
  - npm test
  - npm run test:shards
  - npm run lint:load
  - npm run lint:units
  - npm run lint:planes
  - npm run lint:docs:check
  - npm run lint:streams
  - npm run bench
  - npx tsx scripts/doc-ref-lint.ts
  - npx tsx scripts/analyze/lane-lint.ts --check
chunks: [L1, L2, L3, L4, L5, L6, L7]
reserves: [B-188, B-189]
boundary:
  - docs/plans/planning-loop.md
  - lib/planning.alg
  - lib/planning_loop.alg
  - tests/planning-loop-*.alg
  - src/pcp.ts
  - src/index.ts
  - src/test/pcp.ts
  - src/test/language.ts
  - pcp/**
  - demos/rung4/**
  - docs/book/vivace/**
  - docs/book/proving-in-allegro.md
  - docs/book/getting-started.md
  - docs/book/platform/tooling.ir.md
  - docs/plans/release-track.md
---

# The planning loop, the next validating demo — the planning-loop stream

> **Status: active** (K-007 (the plan lifecycle)) — drafted 2026-11-06
> from the maintainer's direction of that day, on `origin/main` at
> `a8e19c8`; active since the merge of PR #167 on 2026-11-07, with
> every recommendation taken (§6). The status line and the header's
> `status` say the same thing.
>
> **Reader**: the maintainer, who ruled on §6 at PR #167; the session that runs the
> [stream](parallel-streams.md#def-stream). Assumed known: the planning
> model as built (`docs/book/vivace/planning-dsl.md`, in particular
> [plan](../book/vivace/planning-dsl.md#def-plan),
> [choice](../book/vivace/planning-dsl.md#def-choice) and
> [catalog and completion](../book/vivace/planning-dsl.md#def-catalog)),
> the prover protocol as built (`src/pcp.ts`, `pcp/llm-worker.ts`,
> `demos/rung1/05-prover-loop.md`), and the
> [obligation, verdict and assumption ledger](../book/concepts.md#def-obligation-verdict-and-the-assumption-ledger).
> Not assumed: how the two meet, which is what §2 measures. §1 defines
> the terms.

## 1. Outcome and terms

**The maintainer's direction (2026-11-06).** "Next validating demo:
let's start with the planning loop (extending the last demo), and
iterate then to include the software system model, and then to include
a documentation/comprehension model, so it's a comprehensive test of
multi-model operation. Once that's demoed, we should apply it to
Allegro development (less a demo and more an enabler/accelerator)."

The stream delivers in that order: (1) the planning loop, fully chunked
here; (2) the software system model and (3) a documentation or
comprehension model, each staged in §5 with the ruling that admits it
once (1) has run. Vision §4 directs "don't over-design ahead of
evidence"; (1) is the evidence (2) and (3) wait for.

**The demo, as a stakeholder sees it.** An operations lead has a plan
with a hole in it: an order is packed, and nothing in the plan gets it
delivered. The kernel names the hole in planning words: "`Shipped`,
which `Depot` needs". A proposer reads that and offers a step: a
person editing a file, a script, or a language model. The kernel
checks the plan with that step added, by the same checks and the same
search that rung 3 shows. If the step does not close the hole, or it
breaks the budget, the kernel refuses it and says why in the same
words, and the proposer tries again. When the plan closes, the
solution names each step, who proposed it and in how many attempts,
and what it still rests on: the promises its fixtures make, which
nothing in Shape 1 checks. The proposer is never trusted. The kernel is the only
thing that says yes.

**Done-condition for (1).** All of these hold:

- A runnable scene, `demos/rung4/01-loop.alg` as R6 recommends,
  suite-pinned by its `// expect:` lines, with a walkthrough
  `demos/rung4/01-loop.md` and its transcripts, and the transcripts
  themselves reproduced by a test (for this rung, what B-177 (the demo
  ladder chapter's findings) item 5 asks for every rung).
- An LLM-free path through the same loop: the obligations listed by
  `allegro obligations`, rendered by `allegro propose`, answered by a
  scripted proposer and verified by the kernel, so that the suite and
  the demo run without a key and without the network, as rung 1 scene
  5 does with `propose`.
- The same loop with the language-model worker, run once with a key
  and its transcript captured.
- The claims register of `docs/plans/release-track.md` re-graded only
  for what is delivered (R6).

**The horizon: Allegro's own development.** Once (1) to (3) have run,
the loop is meant to work on Allegro itself: its plan (the backlog's
items and the stream plans' chunks as plan nodes, the oracles as
fixtures), its system model (`scripts/analyze/units.json` and the unit
DAG, which `npm run lint:units` already checks), and its book
(`docs/reading-order.json`, the `def-` anchors, `scripts/doc-lint.ts`).
That would take three things this stream does not plan: readers that
turn those files into model values (a file read is an effect, so the
readers sit in a host-side adapter or in a Shape 2 step); a proposer
that edits the repository through the loop's protocol and nothing else;
and a coordinating service that runs the loop per stream and hands the
maintainer the model diff, not the file diff. It is the stream's stated
horizon, not a chunk.

**Terms.** Each is defined here because neither the methodology
vocabulary nor `docs/book/` defines it. Each uses only terms defined
before it.

- <a id="def-plan-obligation"></a>**Plan obligation**: an
  [obligation](../book/concepts.md#def-obligation-verdict-and-the-assumption-ledger)
  that a planning check states about a plan: the finding names the
  plan, the port, and the node or declaration that needs it. R1 rules
  which findings are plan obligations. Recommended for the first demo:
  a gap that completion from the plan's catalog cannot fill.
- <a id="def-proposer"></a>**Proposer**: whoever answers an obligation:
  a human editing a file, a script reading prepared answers, or a
  language model. The protocol does not tell them apart; it records who
  answered.
- <a id="def-proposal"></a>**Proposal**: what a
  [proposer](#def-proposer) answers to a
  [plan obligation](#def-plan-obligation). R2 rules what it may be.
  Recommended: one catalog entry, written as a node block, which the
  worker adds to the plan's catalog and never to the plan itself.
- <a id="def-the-loop"></a>**The loop**: obligations listed, a
  [proposal](#def-proposal) asked for, spliced, the plan re-checked and
  re-solved by the kernel, and on a refusal the next attempt asked for
  with the refusal's text, up to an attempt limit; on success the
  proposal's authorship recorded. It is the prover loop of rung 1 scene
  5 with the plan obligation in place of the theorem.
- <a id="def-open-plan"></a>**Open plan**: a plan declared with `plan
  NAME from CATALOG:`, bound with its catalog and its
  [plan obligations](#def-plan-obligation) and without the
  `WellFormedPlan` annotation, so its gaps are obligations rather than
  halts. Ratified at the merge of PR #177, 2026-11-09.
- <a id="def-plan-state"></a>**Plan state** ("open", "unsolved",
  "solved"): the kernel's answer stored in an
  [open plan](#def-open-plan): open means an obligation remains,
  unsolved means every gap closes but no completion solves, solved
  means one does. Ratified at PR #182's comment, 2026-11-10.
- <a id="def-plan-surface"></a>**Plan surface**: the plan's name,
  declared inputs, outcomes and budget as `plan_surface` renders them,
  the part of the identity hash a [proposal](#def-proposal) must leave
  unchanged. Ratified at PR #182's comment, 2026-11-10.
- <a id="def-refusal-kinds"></a>**Refusal kinds** (`not-a-node-block`,
  `name-reused`, `no-catalog`, `halt`, `plan-missing`, `plan-edited`,
  `open`, `unsolved`, and the loop's `timeout`): the names the protocol
  gives each reason a [proposal](#def-proposal) is refused. Ratified at
  PR #182's comment, 2026-11-10; `timeout`, a turn whose time box ran
  out, added by L4 (`LoopRefusal` in `pcp/llm-worker.ts`), ratified
  at the merge of PR #186, 2026-11-12.
- <a id="def-kind-registry"></a>**Kind registry** (`OBLIGATION_KINDS`
  in `pcp/llm-worker.ts`): the per-obligation-kind table of request,
  splice, success test and primer that [the loop](#def-the-loop) reads,
  one entry per kind of obligation. Ratified at PR #184's comment,
  2026-11-11.
- <a id="def-proposals-file"></a>**Proposals file**: the markdown file
  of prepared answers, one section per obligation and one fenced block
  per attempt, that the scripted [proposer](#def-proposer) reads.
  Ratified at PR #184's comment, 2026-11-11.
- <a id="def-kernel-time-box"></a>**Kernel time box**: the per-turn
  limit on the kernel's check of the spliced source (`--turn-timeout`);
  a check that outlasts it ends the turn with the refusal `timeout`.
  Ratified at the merge of PR #186, 2026-11-12.
- <a id="def-reply-time-box"></a>**Reply time box**: the per-turn limit
  on the client's reply (`--reply-timeout`); a reply that outlasts it
  ends the turn with the refusal `timeout`. Ratified at the merge of PR
  #186, 2026-11-12.
- <a id="def-transcript-twin"></a>**Transcript twin**: the JSON file
  beside a markdown transcript of [the loop](#def-the-loop), holding the
  same record as data, for L7's reproducing test. Ratified at the merge
  of PR #186, 2026-11-12.
- <a id="def-claude-code-client"></a>**Claude Code client**: the second
  language-model client, `createClaudeCodeClient` in
  `pcp/llm-worker.ts`, which answers each request with one `claude -p`
  run on the logged-in subscription. Ratified at the merge of PR #186,
  2026-11-12.
- <a id="def-plan-ledger"></a>**Plan ledger**: the verdict's
  `planLedger` field and its `plan ledger:` block: one record per plan
  value bound at the top level. Ratified at PR #188's ruling,
  2026-11-12.
- <a id="def-promise"></a>**Promise** (of a plan value): a fixture on
  any port of a plan value, listed in the assumption ledger at the
  admitted tier and never discharged. Ratified at PR #188's ruling,
  2026-11-12.
- <a id="def-not-claimed"></a>**Not claimed** (well-formed;
  "unclaimed"): the well-formedness status of a plan bound without the
  `plan NAME:` form's annotation that has findings. Ratified at PR
  #188's ruling, 2026-11-12.
- <a id="def-walk-levels"></a>**Walk levels** (`walk_levels`): the
  32-level bound the caller passes to `plan_ledger` for the fold over a
  plan's ports. Ratified at PR #188's ruling, 2026-11-12.
- <a id="def-model-composition"></a>**Model composition**: two models
  in one program, where a check of one reads a value of the other, so
  that a finding of the composed program can name both. This plan uses
  it for (2) and (3) only. B-082 (model composition) holds the general
  question.

**Reserved ids.** The header reserves B-188 (first out-of-scope finding
of the planning-loop stream) and B-189 (second out-of-scope finding of
the planning-loop stream). The plan's PR files both as placeholders in
`docs/backlog.md`, so the header resolves under `npm run lint:streams`.
B-187 (the planning loop, the next validating demo) is the stream's
item. B-083 (the AI iteration loop) and B-082 stay open; this stream
works their first slices.

## 2. The problem, measured

**Question.** What does the prover protocol see of a plan today, what
does the planning library say about a plan it cannot complete, and what
does one turn of a loop cost?

**Method.** Read and run on `origin/main` at `a8e19c8`, 2026-11-06,
through the CLI (`npx tsx src/index.ts`). Scratch files lived outside
the repository; their text is given below. No file in the repository
was changed.

### 2.1 What the protocol sees of a solved plan: nothing

`demos/rung3/02-solve.alg` runs to exit 0 with its eleven pinned lines.
The PCP commands on it:

```
$ allegro verify demos/rung3/02-solve.alg
Verdict (verified): 0/0 discharged
  laws: 12/17 discharged, 5 pending
    ? Quantity.mul_comm
    ? Quantity.conv_roundtrip
    ? Quantity.refl
    ? Quantity.sym
    ? Quantity.trans
  coercions: 2/2 obligations discharged
  assumption ledger: rests on 0 admitted, 0 sampled; 5 obligation(s) pending

$ allegro obligations demos/rung3/02-solve.alg --pending
Obligation: theorem `Quantity.law_mul_comm`
  proposition: for_all over Quantity: law 'mul_comm' holds
  hash:        5514d15e
...                                  (five, all the units library's laws)

$ allegro propose demos/rung3/02-solve.alg
# Proof TODO — `demos/rung3/02-solve.alg`
**5 pending** of 19 obligation(s).
## `Quantity.law_mul_comm`         (and the other four laws)
```

`allegro inspect` lists 17 bindings, grade `proven-safe`, and renders
each plan as `SoftwareRelease : Plan` / `Plan object`. Four findings:

1. **The verdict does not mention the plan.** Every pending obligation
   is a law of `Quantity`, which `use units` brings in. Both `plan`
   statements were checked by the `WellFormedPlan` refinement (they
   expand to an annotated binding, `lib/planning.alg:1232`), and the
   check leaves no record in the verdict or in `inspect`, which reports
   the type as `Plan`, not `WellFormedPlan`.
2. **The ledger rests on nothing it can see.** The six fixtures are
   `fixture("valid_semver", v => true)` and its siblings: promises the
   plan makes and nothing checks (chapter §7: "a fixture on a declared
   outcome is a promise", established at execution, Shape 2). The
   ledger says "rests on 0 admitted". A solved plan rests on six
   admitted promises, and the verdict cannot say so.
3. **The obligations surface has no plan obligations.** It lists
   theorems and law obligations only: `extractObligations`
   (`src/pcp.ts:968`) walks the top-level bindings for Proof values.
4. **A plan with a gap cannot reach the protocol at all.** A scratch
   file declaring `plan Fulfil:` with `Ship` needing a `Labelled`
   nothing produces halts every command, the PCP ones included, with
   exit 1 and the same text:

   ```
   Type error: refinement predicate failed for WellFormedPlan: Fulfil is not
   well-formed: input Labelled of Ship is not produced by any node of Fulfil
   or by its inputs
   ```

   `verify`, `obligations`, `propose` and `inspect` all evaluate with
   `softFail` set (`src/index.ts:468`), which keeps a failed proof from
   throwing; a failed refinement annotation still halts, as CE-R1 (a
   declaration is a contract) requires. So the only plan with a gap
   the protocol could ever read is one built through the library's API
   without the annotation, as `fulfil` is in `02-solve.alg`. How an open
   plan is declared is ruling R9.

### 2.2 What completion says when the catalog cannot fill a gap

Scratch file, through the library's API:

```allegro
use units
use planning
pack   = with_estimate(leaf("Pack", [port("Order")], [port("Packed")]), est(20 min, person_hours(0.5), none))
fulfil = plan("Fulfil", [port("Order")], [port("Delivered")], [pack])
depot  = with_estimate(leaf("Depot", [port("Shipped")], [port("Sorted")]), est(30 min, person_hours(0.25), none))
van    = with_estimate(leaf("Van", [port("Sorted")], [port("Delivered")]), est(60 min, person_hours(0.5), none))
cat    = [depot, van]
```

| Expression | Output |
|---|---|
| `gaps_show(fulfil)` | `[Delivered, which the plan declares]` |
| `gaps(fulfil)` | `[Gap(port: Port(type: Delivered, fixture: none), by: )]` |
| `solve_from(fulfil, cat) instanceof Error` | `true` |
| `error of solve_from(fulfil, cat)` | `no completion of Fulfil from the catalog within 2 steps: nothing produces Shipped, which Depot needs` |
| `completions(fulfil, cat).map(c => gap_show(c.gap))` | `[Shipped, which Depot needs]` |
| `completions(fulfil, cat).map(c => c.steps…)` | `[[Delivered from Van, Sorted from Depot]]` |
| `check_plan(fulfil)` | two findings: `outcomes` (Delivered declared, not produced) and `outcomes` (Packed neither consumed nor declared) |

What this says about the loop:

- **The error value is text; the structure is one call away.**
  `solve_from` answers an error value whose payload is a sentence
  (`lib/planning.alg:1066` to `:1069`). The same facts are data in
  `completions`: each `Completion` record (`:1038`) carries the plan as
  far as it got, the steps taken, the `Gap` where it stopped (port,
  fixture, consumer) and whether the depth ran out. A plan obligation
  can be built from those records with no new search (R1).
- **The dead end is the obligation, not the first gap.** The plan's own
  gap is `Delivered`; the catalog fills it and opens `Sorted`, fills
  that and opens `Shipped`, which nothing fills. What a proposer can
  usefully answer is `Shipped, which Depot needs`.
- **A finding in the wording.** The message says "within 2 steps" when
  the catalog holds no node producing `Shipped` at all: the depth
  defaults to the catalog's size (`:1082`), both entries were used, and
  the search records the stop as `exhausted`. A proposer reading it
  would think a deeper search could help. The obligation must say which
  of the two it is; L1 fixes the wording.
- **Not every finding is a gap.** `check_plan` also reports `Packed`
  dangling. Completion consumes it as a side effect. A loop that took
  every finding as an obligation would ask a proposer to answer a
  finding that the answer to another finding removes. That is why R1
  recommends gaps first.

### 2.3 The worker and its contract

`pcp/llm-worker.ts`, read whole, and its pure helpers probed:

- **The request.** `buildIterationMessage` (`:89`) sends the theorem's
  name, its proposition in a fenced block, the lemmas in scope, the
  last failure's reason and counterexample, the hints, the strategies
  already tried, and the contract: "Reply with ONE fenced ```allegro
  code block containing only the proof term (no `theorem` declaration,
  no `by` keyword). The kernel will splice it into the source." The
  system prompt is the primer, `docs/book/proving-in-allegro.md`, its
  "Output contract for an LLM prover" section.
- **The response.** `extractCodeBlocks` (`:42`) takes the ```allegro
  blocks in order, or any fenced block when none is tagged; the worker
  uses the first.
- **Theorem-specific parts, four.** `spliceProof` (`:63`) finds a
  `theorem NAME:` line by regular expression and rewrites its `by`
  slot; success is `verdict.theorems` listing the name as discharged
  (`:342` to `:345`); `classifyStrategy` (`:139`) tags proof-term
  constructors; the primer is about proofs. Everything else is
  generic: the client shim (`:182`), the attempt loop, the failure
  feedback, the authorship record (`:349`, `makeAuthorship`).
- **The worker cannot open a planning file today.** With a mock client,
  `runLlmWorker` on `demos/rung3/02-solve.alg` throws before the first
  request: "Parse error at position 546: expected ' ', …, got 'u'",
  position 546 being `use units`. This is B-175 (the tooling chapter's
  findings) item 5: the worker evaluates the file with its `use` header
  in place and no module loaded (`:270` to `:271`), where the CLI's
  `pcpLoadAndEval` (`src/index.ts:442`) loads them. Any loop over a
  model needs it fixed.
- **Identity.** A theorem obligation carries `propositionHash`
  (`src/pcp.ts:64` to `:73`), so a candidate cannot satisfy it by
  proving something else. A plan obligation needs the same: a hash over
  the plan's declared inputs, outcomes and budget and the gap, so a
  proposal that edits the plan instead of answering it is refused (R2).

So a plan obligation and a catalog-entry proposal ride the same
protocol if the obligation gains a kind (an additive field, as `pcp/1`
has gained fields before: `src/pcp.ts:125` to `:131`), and each kind
brings four things: its request text, its splice site, its success test
and its primer section. R3 rules whether that is one worker or two.

### 2.4 What one turn costs today

`ALLEGRO_EVAL_STATS=1`, wall clock by `date` around the CLI, two runs
each, identical counts:

| Program | `evaluates` | `applyComposed` | Wall clock |
|---|---|---|---|
| `print(1)` | 3 | 0 | 0.47 to 0.52 s |
| `use units` and `use planning`, then `print(1)` | 234,309 | 2,145 | 0.88 to 0.91 s |
| §2.2's scratch file, every line above | 270,231 | 4,167 | 0.94 to 1.01 s |
| `demos/rung3/02-solve.alg` | 3,793,978 | 202,129 | 2.69 to 3.17 s |

The precompile counts are the library's and identical in all three
planning runs (`inlineExpansions=946`, `cutoffResiduals=936`,
`precompiles=251`). `ALLEGRO_PARSE_STATS=1` on `02-solve.alg`: the
planning library parses in 167 ms (52,260 characters, 649,616 match
attempts), the program in 16 ms.

So a turn of the loop over a pilot-sized plan costs about 36,000
evaluations, well under a tenth of a second, once the library is loaded
in the process (B-155 (library load per module) landed: one load per
process). A loop that starts the CLI per turn pays about 0.9 s of fixed
cost per turn: 0.5 s of startup, which is B-161 (CLI startup), and 0.4
s of library load. A language model's answer takes seconds, so neither
is the loop's bottleneck at pilot size; the loop runs in process
anyway (L3), and B-160 (Bits decoded per member lookup) and B-161 stay
lane P's and lane C's. What the loop must respect is the gated load
count: `lib/planning.alg` is in the load corpus (`bench/load.ts:69`),
and `npm run lint:load` fails if its parse counts rise. Growing the
library is ruling R10.

### 2.5 The correctness findings a sibling plan takes first

The pilot-findings plan (`pilot-findings.md` under `docs/plans/`,
drafted in parallel, not on main) takes four findings. Against this
stream:

| Finding | Relation | Reason |
|---|---|---|
| B-154 (unit-name shadowing) | prerequisite for L4 | A proposal that binds a helper named like a unit (`s`, `m`, `h`) in a file with `use units` rebinds the file's quantity literals, and the failure is an unbounded recursion, not a refusal. A scripted proposer avoids it; a language model will find it. A kernel that hangs gives no verdict to iterate on |
| B-185 (a sampled induction proof reported as discharged) | independent | The plan loop proves no induction. It matters to L5 by analogy: the ledger must not report a weaker tier as discharged, which is the rule L5 applies to fixtures |
| B-156 (short-circuit over an error value) | independent | The planning library explains its refusals with `if`, not `\|\|`. The primer section L2 writes says so, for a proposer that writes a fixture |
| B-183 (a trailing comment breaks a contract body's parse) | independent | A proposal is a node block, not a contract body. If one hits it, the parse error is a refusal the loop reports like any other |

## 3. Oracle and stop conditions

Each chunk is decided by these checks:

1. **The suite is green and every pin holds.** `npm test` and
   `npm run test:shards` pass; `bash scripts/typecheck.sh` is clean. No
   `// expect:` line in `tests/*.alg`, `basics.alg` or `demos/**` changes
   outside the new scene. No existing assertion in `src/test/` changes,
   except the refactor of L3 where R3 is taken as (a): there the
   existing worker tests in `src/test/pcp.ts` are the oracle and pass
   unchanged.
2. **Outputs identical.** Every `tests/*.alg` and `demos/**/*.alg` run
   through the CLI, and through `verify` and `inspect`, before and after
   the chunk: stdout, stderr and exit code. Allowed to move, L5 only:
   the new ledger and plan lines of `verify` and `inspect` on a file
   holding a plan, each listed in the chunk's PR.
3. **The ratchets hold.** `npm run lint:load`, `npm run lint:units`,
   `npm run lint:planes`, the boundary battery in the suite. The
   evaluation counts of `demos/rung3/02-solve.alg` (§2.4) do not rise.
   `npm run bench` reports the corpus healthy and the gate holding.
4. **No network in the suite.** No test reaches a language model; the
   LLM path is exercised through a client the test supplies.
5. **The documents hold.** `npm run lint:docs:check` at or below the
   baseline, `npx tsx scripts/doc-ref-lint.ts`, `npm run lint:streams`,
   and `npx tsx scripts/analyze/lane-lint.ts --check`.

**Stop conditions.** The four of `docs/book/process.md` §3: a failed
check, a scope change, a chunk needing a decision, a chunk whose
landing summary carries asks. Lane D keeps the per-chunk gate, so
every chunk stops at its PR in any case. The stream adds four:

- **Any `// expect:` change outside the new scene, or any verdict
  change on an existing file beyond what check 2 allows.**
- **Any gated count rising.** `bench/load-baseline.json` is lane P's;
  R10 decides how the library grows.
- **A claim beyond delivered material in public copy.** The scene's
  README, the messaging document and the website say only what the
  scene shows; one that says more is a stop, whatever the chunk.
- **Any file outside the boundary** (§4), and any edit to the
  software system model or the documentation model before R7 or R8
  admits it.

## 4. File boundary

**Lane D (L2 semantics)**, narrowed by the header's `boundary`.

**Why lane D.** The loop's model side is `lib/planning.alg` and its
tests, lane D's (`lib/**`, `tests/**`), and lane D's `src/*.ts` and
`src/test/**` already hold `src/pcp.ts`, `src/index.ts` and
`src/test/pcp.ts`. Three globs of the boundary are in no lane D glob
today: `pcp/**` (lane C's), `demos/rung4/**` (no lane's: `demos/**`
appears in no lane of `scripts/analyze/lanes.json`) and
`docs/plans/release-track.md` (lane S's `docs/**`). A plan's boundary
never admits a file its lane does not, so until the manifest gains
them, `npm run lint:lanes` refuses any chunk that touches them. R5
recommends widening lane D's globs by exactly those three, in a lane-S
PR before L3, as PR #160 widened lane S by the two READMEs. Two lanes
may list the same file (the manifest's note), so lane C keeps `pcp/**`.

**What each file takes.**

- `lib/planning.alg`: the dead-end wording of §2.2 (deferred at L1 to
  L2 or the stream's close, §7), and whatever R10 lets it gain.
- `lib/planning_loop.alg`: new under R10's recommendation; the plan
  obligation records, the open-plan form of R9, and the catalog's
  surface form of R2. The name takes an underscore, not the hyphen R10
  was ruled with, because the `use` scanner (`src/use-scanner.ts`)
  accepts identifier names only, so a hyphen cannot be a module name
  (a default taken at L1; the maintainer rules on it at L1's PR).
- `tests/planning-loop-*.alg`: new demo files only. An existing demo is
  an oracle and is never edited.
- `src/pcp.ts`: the obligation kind and the plan obligation's
  extraction (L1), its verification (L2), its ledger entries (L5).
- `src/index.ts`: `obligations`, `propose`, `prove` and `verify` for the
  new kind; the scripted proposer's option (L3).
- `pcp/**`: the worker, generalised or joined by a second (R3).
- `src/test/pcp.ts`, `src/test/language.ts`: the loop's tests and the
  rung 4 scene's registration.
- `demos/rung4/**`: the scene, its walkthrough, its transcripts.
- `docs/book/vivace/**`: the chapter's §2.8, §7 and §9, and the primer
  section for plan obligations if R3 puts it there.
- `docs/book/proving-in-allegro.md`: the output contract, if R3 puts
  the plan section in the shared primer.
- `docs/book/getting-started.md`: the rung 4 tour entry (L7).
- `docs/book/platform/tooling.ir.md`: the claims about the CLI and the
  worker that the chunks change (C123 to C136 of that IR), edited by its
  reasoning role.
- `docs/plans/release-track.md`: the claims register (L7).
- The status documents under B-162 (conflict-free status documents):
  this plan's row in `docs/plans/README.md`; B-187, B-188, B-189 and
  lane D's row in `docs/backlog.md`; the section `## Stream D — the
  planning loop` in `docs/CHANGELOG.md`, created at ratification.

**Outside the boundary, on purpose.** A chunk that needs one of these
stops:

- `src/runtime.ts`, `src/types-std.ts`, `src/primitives.ts`,
  `src/evaluator.ts`: the loop changes what a model reports and what
  the protocol reads, not how the kernel checks. R1's recommended
  option needs none of them; option (c) would.
- `bench/**`, `bench/load-baseline.json` included: lane P's (R10).
- `lib/units.alg`: B-154 (unit-name shadowing) is the pilot-findings
  plan's.
- `README.md` and `docs/messaging.md`: lane S. A rung 4 entry in either
  goes as a lane-S PR after L7, if R6 allows public copy at all.
- Any library or document of the software system model or the
  documentation model, until R7 or R8 admits it.

**Lanes sharing these files.** Lane D is internally serial. If the
pilot-findings plan runs in lane D, it runs first and this stream
waits. Lane C's B-175 items 5 and 6 are in `pcp/llm-worker.ts`; L3 and
L4 close them and say so in B-175's entry when they land. Lane C takes
`pcp/**`, `src/index.ts` and `src/pcp.ts` only while this stream is not
in them.

## 5. Chunk sequence

Each chunk is one PR, human-gated.

| Chunk | Backlog | Deliverable | Oracle |
|---|---|---|---|
| L1 | B-187 | **The obligation surface.** Plan obligations as R1 rules them, built from `completions` (§2.2), each a record naming the plan, the port and its fixture, the consumer or the declaration, and whether the catalog or the depth stopped the search; the open plan declared as R9 rules. `src/pcp.ts`: `Obligation` gains an optional `kind` (`theorem` when absent, so `pcp/1` is unchanged) and a plan obligation's identity hash (§2.3); `extractObligations` also collects the plan obligations of the file's open plans. `obligations` and `obligations --json` list them. The dead-end wording of §2.2 fixed. | `obligations --pending` on a new `tests/planning-loop-obligations.alg` lists `Shipped, which Depot needs` with its hash, in text and JSON; every theorem and law obligation of every existing file listed as before |
| L2 | B-187 | **The proposal protocol.** What a proposer may answer (R2): one catalog entry as a node block, spliced into the open plan's catalog; refused, with the reason, when it edits the plan (hash mismatch), reuses a node name, fails to parse, or leaves the obligation open. The kernel's answer per proposal: the obligation closed and the plan solved, or the refusal in planning words (the next dead end, the budget missed, the finding the completed plan fails). `propose` renders plan obligations as a TODO; `verify` judges an edited file. The primer section for plan obligations (R3) | a pure splice helper pinned in `src/test/pcp.ts` on a closing proposal, a non-closing one, an over-budget one and a plan edit; the human path end to end on the L1 file: `propose`, edit, `verify` |
| L3 | B-187 | **The LLM-free worker and the suite pins.** The loop of §1 in process, one `evalSource` per turn with the library loaded once, under R3's shape; B-175 item 5 fixed (the worker loads the `use` header as `pcpLoadAndEval` does); a scripted proposer (a client that answers from a file of prepared proposals) behind a CLI option, so the loop runs without a key. Authorship per accepted proposal, with the attempts | the scripted loop on the L1 file converges in two attempts (one refused with its reason, one accepted), pinned with a test client; the existing worker tests pass unchanged; no network |
| L4 | B-187 | **The LLM worker.** The same loop with the language-model client; a time box per turn as well as the attempt limit (B-083's "time-boxing"), so a proposal that makes the kernel diverge ends the turn with a refusal; B-175 item 6 (the phantom `--api-key`) fixed. Waits for B-154 (§2.5) | one run with a key, owner-run if the session has none, its transcript in `demos/rung4/transcripts/`; the suite still makes no network call |
| L5 | B-187 | **The ledger** (R4). The verdict records a plan binding's well-formedness as discharged, the fixtures it relies on as admitted promises, and each catalog entry the solution uses with its authorship. `inspect` renders a plan's bound and decisions. On `02-solve.alg`: "rests on 6 admitted" where it says 0 today | the new lines listed in the PR as check 2 allows; no other output moves; the ledger never reports a promise as discharged |
| L6 | B-187 | **Legibility, if the loop needs it.** The rest of B-081 (counterexample legibility) as its C2 row of `planning-pilot.md` holds it: the call-site origin (B-057 (call-site origin)) if the splice needs a source location, rendering the refused value if a proposer cannot converge from the text alone. Decided on L3's and L4's evidence; dropped if neither shows the need | as the chunk's PR states it; no output moves outside it |
| L7 | B-187 | **The demo and packaging.** `demos/rung4/01-loop.alg` (suite-pinned), `01-loop.md` (obligations, propose, the scripted loop, the LLM loop), `README.md` saying what the rung does not yet show (one model; no composition); the transcripts reproduced by a test; the claims register re-graded (R6); the chapter's §2.8 and §9; getting-started's tour entry | the scene green in the suite; the register's changes listed against the scene's lines; no public claim beyond them |

### Staged: the second and third models

Staged as `planning-pilot.md` staged two of its rows: its C2 row, the
rest of B-081 (counterexample legibility), and its row D3 (branch-and-bound,
a surface form for catalogs): not before a demo needs one, and not before (1) has run. Neither row is in the
header's `chunks` until its ruling admits it; the stream's plan is
amended at that PR.

| Row | Outcome | Engine and library questions it opens | Admitted by |
|---|---|---|---|
| SY1 | **The software system model, composed with the planning model.** The second pilot of Vision §4, "a software system model (several interconnected DSLs)", in Shape 1: a system described in two or more small DSLs, checked, and composed with a plan so that one finding names both, and the loop of (1) answers the composed model's obligations | Which DSLs: the chapter's table names data, components and UI (`docs/book/vivace/planning-dsl.md` §1), and B-080 (the Vivace DSL roster) lists software-systems, data and UI modelling separately. A port's type is a `String` today (`Port`, `lib/planning.alg:46`), so a plan cannot name another model's type: cross-library types in a model's records. Two grammars active in one file, each `use`d (conflict detection at `use` time). One verdict and one ledger across two models (D2 (the assumption ledger)'s row "cross-model ledger", hypothesis). Whether a cross-model check lives in either library or in a third that imports both | R7, after L7 has merged: the DSL list and the first composition point, chosen on (1)'s evidence |
| DC1 | **A documentation or comprehension model, composed with the two.** The third model, which makes the test multi-model in the maintainer's sense | What it is for, which is R8's question. Whatever it is, how its values are read from files (an effect; §1's horizon), and how it composes with the other two (a plan node that produces a chapter; a component a chapter documents) | R8, after SY1 has run |

**The third model's raw material.** No record designs it. The nearest
existing material is D52 (the documentation as a book): the reading
order as data (`docs/reading-order.json`), one definition site per term
with a `def-` anchor, the rule that a chapter defines a term using only
terms defined earlier, and the checks in `scripts/doc-lint.ts`; and the
methodology's IR form (`*.ir.md` claims with evidence, relations and
asks, checked by `scripts/ir-lint.ts`). These are the raw material a
documentation model would be built from, as the units DSL was built
from the dimension vectors. One observation, not a design: D52's rule
reads as the planning model's wiring check, with chapters as nodes and
terms as ports.

## 6. Rulings

Each with its options, costs and a recommendation; "Taken:" is the
maintainer's. Suggested order of taking: R5 and R10 first (they decide
whether the chunks can land at all), then R1 with R9, R2, R3, R4, R6;
R7 and R8 at their rows' time.

- **R1** — **What a plan obligation is, and which the first demo
  takes.** Candidates: (i) a gap that completion from the plan's
  catalog cannot fill, at the dead end (§2.2); (ii) any refusal of
  `check_plan`: incompatible fixture, cycle, dangling outcome, handler;
  (iii) a budget miss, with the cheapest candidate named; (iv) a choice
  left unresolved.
  - (a) (i) only. A gap has a structured record today (`Gap`,
    `Completion`), a natural answer (a node that produces the port), and
    a success test (the gap closes and the plan solves). It is the shape
    the chapter names for the loop (§2.8).
  - (b) (i) and (iii). A budget miss is answerable (a cheaper option or
    entry), but its record is a sentence today, and what closes it is a
    search outcome, not one entry.
  - (c) (i) to (iii), read from the halt's text under `softFail`. Every
    refusal, generically, with no structure; needs the refusal to become
    a notification, which is `src/runtime.ts` and against CE-R1 unless
    restricted to the PCP commands.
  - (iv) is not an obligation: the solver resolves choices, and a
    template with no feasible resolution is (iii).
  - **Recommended: (a).** The first demo needs one obligation kind that
    a proposer can answer by construction. (ii) and (iii) follow on L3's
    evidence. Where they are read from: the library builds the records
    (no host code per model, the rung 3 promise), and `src/pcp.ts`
    collects them from the top-level bindings as it collects Proof
    values, so the second and third models reuse the channel.
  - **Taken:** (a), at the merge of PR #167, 2026-11-07.
- **R2** — **What a proposal may be, and where it is spliced.**
  - (a) One catalog entry: a node block (leaf, composite, choice, or a
    borrowed plan by name), added to the open plan's catalog. The plan
    the author wrote never changes; the search decides whether the entry
    is used, and the kernel checks the result. Needs a surface form for
    a catalog (`catalog NAME:` holding node blocks), the second half of
    the pilot's D3 row ("a surface form for catalogs"), which a demo now
    needs.
  - (b) Any node block, inserted into the plan's body at the gap. The
    proposer fills the gap directly and the search does nothing; the
    plan changes under the author.
  - (c) A plan edit of any kind. Unbounded: a proposer could delete the
    outcome or raise the budget. Trivial-pass prevention would have to
    forbid most edits.
  - **Recommended: (a)**, spliced as one more entry of the named
    catalog, with the plan obligation's hash (§2.3) refusing a file
    whose plan changed. If the catalog's surface costs more than a
    chunk, the fallback is the library form (`leaf(…)` expressions in
    the catalog list), which is less readable to a stakeholder.
  - **Taken:** (a), at the merge of PR #167, 2026-11-07.
- **R3** — **One worker generalised, or a second worker.**
  - (a) Generalise `runLlmWorker` by obligation kind: each kind brings
    its request text, splice, success test and primer section (§2.3);
    theorems become the first kind by a refactor that the existing
    tests in `src/test/pcp.ts` pin. One loop, one client shim, one
    authorship path: the "one protocol, any participant" claim holds in
    code.
  - (b) A second worker, `pcp/plan-worker.ts`, sharing the pure helpers
    and the client shim. No refactor risk to the theorem path; two
    loops to keep in step, and the B-175 item 5 fix made twice or moved
    to a shared loader anyway.
  - **Recommended: (a).** The refactor is small (four kind-specific
    parts) and pinned. The primer section for plans goes in the
    planning chapter, and the worker sends the section of the
    obligation's kind.
  - **Taken:** (a), at the merge of PR #167, 2026-11-07.
- **R4** — **How a solved plan's assumptions reach the ledger.** The
  fixtures are `v => true` promises (§2.1, finding 2).
  - (a) Each fixture a solved plan relies on is an admitted entry
    ("rests on 6 admitted: valid_semver, …"), the plan's well-formedness
    a discharged obligation, each catalog entry the solution uses an
    entry with its authorship. Built from the same records as R1.
  - (b) As (a), but a fixture whose predicate is not `v => true` is
    reported as unchecked rather than admitted. Honest about Shape 1:
    no value exists to check it against.
  - (c) The ledger stays silent and the README says so.
  - **Recommended: (a)**, with (b)'s distinction as the wording when a
    fixture carries a real predicate: in Shape 1 every fixture is a
    promise, so "admitted" is the tier, and the ledger must never call
    one discharged.
  - **Taken:** (a), at the merge of PR #167, 2026-11-07.
- **R5** — **The lane, and what the manifest gains.**
  - (a) Lane D, with lane D's globs in `scripts/analyze/lanes.json`
    widened by `pcp/**`, `demos/rung4/**` and
    `docs/plans/release-track.md`, in a lane-S PR before L3 (as PR #160
    did). Lane D is internally serial, so the stream waits for any lane D
    stream ahead of it and holds lane D's band (B-089 (lawful-interface
    follow-ons) and the rest) while it runs.
  - (b) A new lane for the Vivace models (the loop, then the second and
    third models): its own row in the lane table and its own globs
    (`lib/planning*.alg`, the later models' libraries, their tests,
    `pcp/**`, `demos/rung4/**`, the chapters under `docs/book/vivace/`).
    Runs alongside lane D's band; costs a lane-S PR and a lane table
    row, and overlaps lane D in `src/pcp.ts`, `src/index.ts` and the
    test modules.
  - (c) Lane C for the protocol chunks and lane D for the library
    chunks. Two plans or a lane change mid-stream; the chunks cross
    both every time.
  - **Recommended: (a)** for (1). Revisit (b) at R7: three models'
    worth of libraries is when a lane of their own earns its cost.
  - **Taken:** (a), at the merge of PR #167, 2026-11-07.
- **R6** — **The demo's home, and what the claims register may say.**
  - (a) `demos/rung4/`, scene 1 the loop; scenes for (2) and (3)
    follow in the same rung. The ladder's rung 4 story is "two+ coupled
    domain models, AI-proposed candidate solutions, kernel-scored,
    ledger-carried" (`release-track.md` §5), which is the stream's end
    state. Rung 4 is "public only as labeled direction", so its README
    says scene 1 shows one model and no composition.
  - (b) A third scene of `demos/rung3/`. Rung 3's story already names
    the AI iteration loop among what it tests, so the loop fits; but (2)
    and (3) would then open rung 4 with no loop in it.
  - **Recommended: (a).** Register changes at L7, only for what scene 1
    shows: under D3 (participant-neutral collaboration), a new row "the
    prover loop over a domain model's obligations" at demoable; under
    D2 (the assumption ledger),
    "result-level roll-up" gains the plan's admitted promises (already
    delivered as a row; the scene is its receipt); D6 (models as live
    values)'s "to advance" line loses "the AI loop over a model (B-083)";
    the "cross-model ledger" row and D7 (the capstone) stay hypothesis.
  - **Taken:** (a), at the merge of PR #167, 2026-11-07.
- **R7** — **The software system model: the second pilot as written,
  and its first chunk.** Vision §4 names it "a software system model
  (several interconnected DSLs)"; the chapter's table says "data,
  components, UI; tests composition".
  - (a) As written, with its first chunk settling, before any design:
    the DSL list (recommended: components and data first, UI later, all
    three from the roster of B-080 (the Vivace DSL roster)), the one composition point with the
    planning model (recommended: a plan's outcome typed by a system
    model's artifact, and a cross-model check listing the artifacts no
    plan produces, which become plan obligations for the same loop),
    and whether its first DSL is library-first as the planning model
    was.
  - (b) A narrower second model (data modelling alone), with
    composition as the test and the "several interconnected DSLs"
    deferred. Cheaper; tests composition across two models but not
    within one.
  - **Recommended: (a)**, at L7's merge, on (1)'s evidence.
  - **Taken:** at L7's merge.
- **R8** — **What the documentation or comprehension model is for.** A
  question for the maintainer; no design is offered. Readings the raw
  material of §5 supports:
  - (a) Checking the book: chapters, terms and anchors as the model,
    D52's rules as its checks, a forward reference as an obligation the
    loop answers with a definition or a reordering.
  - (b) A reader model: what a reader must know before a chapter, and
    what a chapter leaves them knowing; comprehension as a plan over
    terms.
  - (c) The methodology's IR: claims, evidence and asks as the model,
    `scripts/ir-lint.ts`'s checks as its checks, a claim without
    evidence as an obligation.
  - (a) and (c) have mechanical checks today. Each composes with the
    other two models differently.
  - **Taken:** open, at DC1.
- **R9** — **How an open plan is declared** (§2.1, finding 4). The
  `plan` statement halts on a gap, so a plan with a gap exists today
  only through the library's API.
  - (a) A statement form for a plan to be completed, naming its
    catalog, that binds a plan and its catalog without the
    `WellFormedPlan` annotation, and whose solved plan is checked by
    the annotation once the loop closes it. The surface stays the
    author's; nothing halts on an obligation the file declares open.
  - (b) The library's API only (`plan(…)` with `solve_from`), as
    `02-solve.alg` does. No surface work; the demo's plan reads as code
    rather than as the plan form.
  - (c) The PCP commands treat the `WellFormedPlan` halt as a
    notification. `src/runtime.ts`, and the plan form's halt then means
    different things in `run` and in `verify`.
  - **Recommended: (a)**, taken with R1.
  - **Taken:** (a), at the merge of PR #167, 2026-11-07.
- **R10** — **How the planning library grows under the load ratchet.**
  `lib/planning.alg` is in the load corpus, and its parse counts are
  gated (§2.4).
  - (a) The loop's code in a new library, `lib/planning_loop.alg`, that
    uses `planning`; `lib/planning.alg` takes only L1's wording fix.
    Lane P adds the new library to the load corpus in its own commit
    after L1, so its cost is gated from then on.
  - (b) Grow `lib/planning.alg`, and lane P raises its baseline in a
    separate commit per chunk under B-164 (ratchet baselines under
    concurrent merges), as lane P's PR #151 and PR #152 did for stream
    D's C2.
  - **Recommended: (a).** It keeps the rung 3 library's cost where
    lane P left it, keeps the gate's meaning, and separates what rung 3
    delivered from what the loop adds. If the wording fix itself raises
    the counts, that one commit takes (b).
  - **Taken:** (a), at the merge of PR #167, 2026-11-07.

## 7. Record

- **2026-11-06 — plan drafted.** From the reading and probes of §2, on
  `origin/main` at `a8e19c8`; no code changed. The plan files B-187 and
  the placeholders B-188 and B-189, points B-082 and B-083 at this plan,
  names the stream as next in lane D's row, and appends the manifest
  row. Rulings R1 to R10 await the maintainer. The changelog section
  waits for ratification.
- **2026-11-07 — plan ratified.** PR #167 merged with every
  recommendation taken: R1 to R6, R9 and R10 as (a); R7 waits for L7's
  merge and R8 for DC1. The five terms of §1 are ratified. Lane D's
  globs already hold `pcp/**`, `demos/rung4/**` and
  `docs/plans/release-track.md` (PR #171, R5). The changelog section
  `## Stream D — the planning loop` opens; the manifest row and B-187
  say active.
- **2026-11-07 — L1 landed.** The obligation surface, on
  `origin/main` at `7cd2b72`. Four defaults were taken by the
  orchestrating session when the chunk stopped. The maintainer rules on
  each at L1's PR:
  - **The library's name** is `lib/planning_loop.alg`, not R10's
    `lib/planning-loop.alg`. The `use` scanner (`src/use-scanner.ts`)
    accepts identifier names only, so `use planning-loop` is a parse
    error ("Parse error at position 4"). The header's `boundary`, §4 and
    R10's text now name the underscore.
  - **`lib/planning.alg` is not edited.** The one-line classification
    fix in `completions_from` (`lib/planning.alg:1049`) changes no
    `// expect:` line, but it fails two gates. `npm run lint:load` puts
    `lib/planning.alg` above its baseline (matchAttempts 650,711 against
    649,616; memoWrites 990,471 against 988,794). The suite's web-bundle
    test fails, because `website/index.html`, `website/sandbox.html` and
    `web/sandbox.html` carry the library as it is on disk. The fix: at
    depth 0 the dead end is `exhausted` only when a catalog node the
    plan does not hold produces the port. It is a follow-up for L2 or
    the stream's close, taken with lane P's baseline raise and the
    pages' regeneration (R10 (b)). The new library derives the stop
    itself instead (`stop_of`, `lib/planning_loop.alg:59`).
  - **The catalog's name** is recovered by the protocol, not held by
    the record. A grammar label hands a statement form either an
    expression (`cn:ident`, the catalog's value) or the matched text (a
    regex part), never both from one match. The engine offers no
    lookahead, and no primitive names a symbol, so a rule that yields
    both needs a `src/grammar2/` change outside the boundary.
    `extractPlanObligations` names the catalog by the top-level binding
    whose value is the open plan's catalog list, the same value by
    reference (`src/pcp.ts:1172`). L2 reads `plan.catalog` from the
    obligation.
  - **The pilot-findings stream runs beside this one in lane D**, in
    files this boundary excludes (`src/primitives.ts`, `lib/units.alg`).
    The lane rule goes to the maintainer.

  What landed:
  - **The open-plan form** (R9 (a)) is `plan NAME from CATALOG:`
    (`lib/planning_loop.alg:147` to `:150`). It takes the `plan` form's
    body items (`node_items` of `planning_grammar`), with `CATALOG` a
    binding that holds a list of nodes. It expands to
    `binding_decl(pn, open_plan(build_plan(pn, pitems), cn))`, the
    two-argument form, so no `WellFormedPlan` check halts on the gap.
    The bound value is an `OpenPlan` record (`:124`) holding the plan,
    the catalog list and the obligations. The library's queries are
    `open_obligations`, `open_findings` (`check_plan`'s findings),
    `with_entry` and `solve_open`. L2 reads the open plan back through
    the same type: the plan, the catalog (by the binding's name in the
    obligation) and the obligations.
  - **The plan obligation** (R1 (a)) is the record `PlanObligation`
    (`:44`), with the fields `plan`, `port`, `fixture`, `by`, `stop`,
    `depth`, `steps`, `identity`, `gap` and `message`.
    `plan_obligations` (`:93`) builds one per distinct gap across the
    dead ends of `completions`, with the first dead end's steps as the
    witness, and none when a completion closes. One per distinct gap:
    two dead ends at the same port for the same consumer ask the same
    question, and one catalog entry answers both. `stop` is "catalog"
    when no catalog entry the plan lacks produces the port and "depth"
    otherwise. At the default depth it is always "catalog";
    `plan_obligations_within` bounds the depth. The renderings are
    `obligation_gap_show` ("Shipped, which Depot needs") and
    `obligation_show` ("nothing in the catalog produces Shipped, which
    Depot needs" or "no completion within 1 step: the search stopped at
    Sorted, which Van needs"). Each is stored in the record, so the
    protocol reads it as data.
  - **The identity hash** is `hashProposition` over the text
    `plan_identity` builds (`:64`): the plan's name, its declared
    inputs, outcomes and budget, and the gap's port (with its fixture)
    and consumer. On the demo the text is "plan Fulfil; inputs Order;
    outcomes Delivered; no budget; gap Shipped by Depot", hash
    `421ea754`. An unrelated catalog entry leaves it; a changed declared
    outcome moves it (`src/test/pcp.ts:451`).
  - **The protocol** (`src/pcp.ts`). `Obligation` gains the optional
    `kind` (`:61`, absent means a theorem) and `plan`
    (`PlanObligationContent`, `:80`): `binding`, `plan`, `catalog`,
    `port`, `fixture`, `consumer`, `stop`, `depth`, `steps`, `gap`,
    `message`, `identity` and `hash`. The theorem slot carries the
    identity as its proposition, so `propositionHash` equals `hash`.
    `extractPlanObligations` (`:1172`) finds the open plans by the
    registered `type` field against the library's `OpenPlan`; no new
    slot was added. `extractObligations` appends them, last, only with
    `plans: true`. `allegro obligations` asks for them
    (`src/index.ts:523` to `:530`); `formatPlanObligation` (`:528`)
    renders them.
  - **`propose` and `verify` on a file with an open plan** run and exit
    0. They do not list the plan obligation: on the demo, `propose`
    prints "**5 pending** of 19 obligation(s)" (the units library's
    laws), and `verify` prints "Verdict (verified): 0/0 discharged" with
    the same five laws pending. The LLM worker is untouched.
  - **The demo and the tests.** `tests/planning-loop-obligations.alg`
    has 17 pinned lines, registered at `src/test/language.ts:689`. It
    pins the open plan, its findings, the obligation and its renderings,
    the depth stop, the plan closed by a hand-written entry and checked
    as a `WellFormedPlan`, and a `plan NAME:` beside the open form.
    `src/test/pcp.ts:394` to `:503` holds four tests: the extraction and
    JSON round trip; the hash; theorem and law obligations unchanged;
    and the CLI's `obligations --pending` in text and JSON, with
    `propose` and `verify` on the demo.
  - **The outputs comparison.** Every `tests/*.alg` and `demos/**/*.alg`
    on `origin/main` (68 files) was run through the CLI as `run`,
    `inspect`, `verify` and `obligations`, and compared on stdout,
    stderr (stats lines stripped) and exit code. All 272 runs are
    identical; the new demo is the only new file.
  - **The counts.** `npm run lint:load` is at or below the baseline.
    `demos/rung3/02-solve.alg` has 3,793,978 evaluates and 202,129
    applyComposed, unchanged from before. The demo has 457,193
    evaluates.
  - **The records.** `docs/book/platform/tooling.ir.md`: C111 becomes
    C171 and C172 (proposed, ask A3, cluster G27). The chapter's §2.8
    and §9 are updated; the chapter has no IR of its own. The oracle
    lines are in L1's PR.
- **2026-11-09 — L1's defaults, C171, C172 and *open plan* ratified at
  PR #177's merge; the lane D rule recorded.** The maintainer wrote on
  PR #177: "All decisions, claims and terms ratified." The four defaults
  above stand. Claims C171 and C172 and cluster G27 of
  `docs/book/platform/tooling.ir.md` are decided, ask A3 resolved. Plan
  obligations stay opt-in in `extractObligations` (its `plans` option);
  L2 makes `propose` and `verify` ask for them. The term
  [open plan](#def-open-plan) joins §1. Lane D's row in
  `docs/backlog.md` gains the rule: concurrent streams in lane D need
  disjoint boundaries, as R1 (tidy-ups beside stream D) of
  `docs/plans/book-pass.md` has it.
- **2026-11-09 — L2 landed, stopped at deliverable 4.** The proposal
  protocol, on `origin/main` at `57c534c` (the merge of PR #177). One
  stop: `propose` and `verify` are not yet changed to ask for plan
  obligations, because doing so moves a pin. L1's CLI test asserts that
  `propose` on `tests/planning-loop-obligations.alg` does not mention
  `Shipped` (`src/test/pcp.ts:503`, "propose does not render the plan
  obligation yet"), and that file holds an open plan, so its `verify`
  output would gain the plan line in the outputs comparison. Everything
  the two commands need is built and pinned beside the CLI; the
  maintainer rules whether L2's PR may replace that assertion and move
  that file's `verify` output (the ask of L2's PR).

  What landed:
  - **The catalog's surface form** (R2 (a), the pilot's D3 row) is
    `catalog NAME:` (`lib/planning_loop.alg:211`), a statement form in
    the register of `plan`. Its block holds node blocks only, parsed by
    `cat_node` (`:206` to `:207`), the two node alternatives of
    `planning_grammar`'s `node_item` (`Name:` with its items, and
    `Name: uses target`), so a choice and a composite parse as in a
    plan's body and an `inputs:` line directly under `catalog` is a
    parse error. `NAME` is bound to the list of nodes, the value
    `plan NAME from CATALOG:` expects; a list expression is a catalog
    still (L1's demo is unchanged). No grammar engine change. Example:

    ```allegro
    catalog yard:
      Depot:
        inputs: Shipped
        outcomes: Sorted
        estimate: 30 min, 0.25 person-hours
      Van:
        inputs: Sorted
        outcomes: Delivered
        estimate: 60 min, 0.5 person-hours
    ```
  - **The kernel's answer in the library.** `OpenPlan` (`:143`) gains
    `surface` (`plan_surface`, `:69`: the identity's declared part, which
    `plan_identity` at `:72` now reads; its text is unchanged), `state`
    and `answer`, computed when the open plan is built (`open_plan`,
    `:145` to `:167`): "open" with the first obligation's message (the
    next dead end); "unsolved" with `solve_from`'s counterexample (the
    budget missed, or the finding the completed plan fails) or, if the
    solution fails `plan_errors` (the `WellFormedPlan` predicate), that
    text; "solved" with `solution_show`. `open_state` and `open_answer`
    (`:183` to `:184`) read them.
  - **The splice** is `splicePlanProposal(source, PlanObligationContent,
    proposal)` (`src/pcp.ts:1371`): the node block, dedented, appended as
    the last entry of the `catalog NAME:` block the obligation's
    `catalog` names, at that block's indentation; the plan's block is
    never touched. Its refusals: `not-a-node-block` (a first line that
    is not `Name:` or `Name: uses target`, a line at the margin after
    it, a `catalog` or `plan` keyword, an empty reply), `name-reused`
    (the entry's name is a node of the plan's or the catalog's block),
    `no-catalog` (no catalog binding; a catalog written as a list
    expression, as L1's demo writes it; or no such block). The splice
    checks layout only: whether the items parse is the kernel's, and
    `answerPlanProposal` (`:1529`) reports a throw from the caller's
    evaluation as refusal `halt` with the parse error's text.
  - **The kernel's answers** are `judgePlanObligation(evalCtx, content)`
    (`:1471`), pure over an evaluated file: `refused` when the open plan
    is gone or the identity hash moved (the file's `surface` with the
    obligation's gap, hashed as `plan_identity` is), else `discharged`
    when the state is "solved" and `pending` with the library's answer.
    `answerPlanProposal` maps them to `open`, `unsolved`, `plan-edited`
    and `plan-missing`. On `tests/planning-loop-proposals.alg`'s plan,
    through `formatPlanProposalAnswer` (`:1558`):

    ```
    refused (open): nothing in the catalog produces Labelled, which Courier needs
    refused (unsolved): no completion of Fulfil from the catalog fits the budget of Fulfil; the cheapest, Delivered from Van, Sorted from Depot, Shipped from Freight, is duration 200 min against 160 min
    accepted: the gap is closed and the plan solved: Delivered from Van, Sorted from Depot, Shipped from Ship; bound effort 1.5 person-hours, duration 155 min
    refused (name-reused): the proposal's node `Van` reuses a name the plan or the catalog `yard` already has: name the new entry differently
    ```

    A plan edit beside the entry: "the plan was edited: the obligation's
    hash is 421ea754, the file's is 93279451; a proposal adds a catalog
    entry and leaves the plan as written" (L1's plan with its outcome
    changed to `Sorted`).
  - **The verdict.** `Verdict` gains the optional `planObligations`
    (`PlanObligationRecord`, `:197` to `:223`; pcp/1 unchanged).
    `buildVerdict` takes a `plans` option (every open plan's record) and
    judges a supplied obligation of kind "plan" (`:943` to `:954`); a
    pending one leaves the verdict verified, as a pending law does.
    `formatVerdict` prints, after the coercions and before the ledger
    (`:729` to `:743`), `  plans: 0/1 discharged, 1 pending` and one
    line per record. The count line `Verdict (...): N/M discharged`
    still counts theorems only; the ledger is untouched (L5's).
    `checkObligationSatisfied` (`:1567`) judges a plan obligation by its
    record. So `allegro verify FILE --obligation O.json`, with O the plan
    line of `obligations --json`, judges the edited file (`src/index.ts`
    is unchanged in behaviour; its comment at `:493`). On L1's open plan
    (the demo's first 23 lines), before and after the edit that adds
    L1's hand-written `ship` to `yard`:

    ```
    Verdict (FAILED): 0/0 discharged
      ...
      plans: 0/1 discharged, 1 pending
        ? Fulfil: Shipped, which Depot needs — nothing in the catalog produces Shipped, which Depot needs
      ...
      obligation mismatch: plan obligation `Fulfil` (Shipped, which Depot needs) is pending: nothing in the catalog produces Shipped, which Depot needs

    Verdict (verified): 0/0 discharged
      ...
      plans: 1/1 discharged
        ✓ Fulfil: Shipped, which Depot needs — Delivered from Van, Sorted from Depot, Shipped from Ship; bound effort 1.5 person-hours, duration 155 min
    ```
  - **The TODO.** `formatTodo` renders a plan obligation's section
    (`formatPlanTodo`, `:1719`); `propose` does not reach it yet (the
    stop). On the new demo's plan:

    ```
    ## `Fulfil: Shipped, which Depot needs`

    **Gap:** nothing in the catalog produces Shipped, which Depot needs

    **Search so far:** Delivered from Van, Sorted from Depot

    **Catalog to extend:** `yard`: add one node block that produces `Shipped`; leave the plan `Fulfil` as written.

    **Hash:** `5444505e` (over: plan Fulfil; inputs Order; outcomes Delivered; budget duration 160 min, effort none, money none; gap Shipped by Depot)
    ```
  - **The primer section** for plan obligations is
    `docs/book/vivace/planning-dsl.md` §2.9, "Output contract for a plan
    proposer": what the obligation says, the reply (ONE fenced
    ```allegro block holding one node block, no `catalog` or `plan`
    keyword), and the six refusals. L3's worker sends it for the plan
    kind.
  - **The demo and the tests.** `tests/planning-loop-proposals.alg` has
    15 pinned lines, registered at `src/test/language.ts:694`: the
    catalog form, the answer stored in the open plan, and three
    proposals through `with_entry` (the next dead end, the budget
    missed, the plan solved and checked as a `WellFormedPlan`).
    `src/test/pcp.ts:508` to `:727` holds seven tests: the splice; the
    answers on a closing, a non-closing and an over-budget proposal; the
    plan edit refused by the hash and a second statement by the splice;
    the other refusals; the verdict field opt-in (a verdict without it is
    unchanged); the TODO section; the human path on L1's open plan
    through the CLI (`obligations --json`, the edit, `verify
    --obligation`, and the plan edited).
  - **The outputs comparison.** Every `tests/*.alg` and `demos/**/*.alg`
    on `origin/main` (71 files) was run through the CLI as `run`,
    `inspect`, `verify` and `obligations`, before and after, and compared
    on stdout, stderr (stats lines stripped) and exit code. All 284 runs
    are identical; the new demo's four runs exit 0.
  - **The counts.** `npm run lint:load` is at or below the baseline
    (`lib/planning_loop.alg` is not in the load corpus).
    `demos/rung3/02-solve.alg` has 3,794,320 evaluates and 202,129
    applyComposed before and after. L1's demo rises from 457,535 to
    1,033,607 evaluates, because `closed` is now solved when it is
    built; the new demo has 1,491,712. Neither is gated.
  - **`completions_from`'s fix was not needed**: the obligation's
    `stop` and `message` come from `lib/planning_loop.alg`, and the
    budget answer from `solve_from`'s budget branch, which the fix does
    not touch. It stays deferred.
  - **The records.** `docs/book/platform/tooling.ir.md`: C109 becomes
    C173 (an obligation without a kind) and C174 (a plan obligation),
    proposed, ask A4, cluster G28 in place of G17; evidence E39 added,
    E11, E12, E30 and E38 re-synced. The chapter's §2.8, §2.9 and §9 are
    updated. The oracle lines are in L2's PR.
- **2026-11-10 — ask 1 of L2's PR taken as recommended, A4 ratified,
  the three terms ratified, at PR #182's comment; `propose` and `verify`
  list plan obligations by default, the L1 pin replaced.**
- **2026-11-10 — L3 landed, stopped at deliverable 4.** The LLM-free
  worker and the scripted proposer, on `origin/main` at `9e018ad` (the
  merge of PR #182). One stop: the scripted loop cannot run on L1's demo,
  `tests/planning-loop-obligations.alg`, as the file stands. Its catalog
  is a list expression (`yard  = [depot, van]`), and L2's splice refuses
  a list catalog by design, pinned at `src/test/pcp.ts:664` ("a node
  block is spliced into the block form only"). Through `prove --proposals`
  the loop on that file ends after one attempt, refused as `no-catalog`,
  exit 1. Making it converge needs one of three things, each a stop of
  §3: edit the demo (an oracle, never edited), change L2's pinned splice
  to accept a list catalog, or add a new `tests/planning-loop-*.alg`
  file. The default taken: the convergence is pinned on L1's open plan
  with its catalog written as a `catalog yard:` block, in the test's temp
  directory. It is the same plan, the same obligation and the same hash
  (`421ea754`), because the identity hash does not cover the catalog's
  form. The CLI path is pinned on L2's demo,
  `tests/planning-loop-proposals.alg`, whose catalog is a block. The
  maintainer rules at L3's PR whether that stands.

  What landed:
  - **The kind registry** (R3 (a)) is `OBLIGATION_KINDS`
    (`pcp/llm-worker.ts:566`), a `Record<ObligationKind,
    ObligationKindSpec>` with two entries, `theorem` and `plan`. An
    `ObligationKindSpec` (`:462`) has four parts: `request(ob,
    attemptNumber, attemptsSoFar)` answers the request text;
    `splice(source, ob, candidate)` answers the spliced source, or a
    reason and whether a later attempt can splice at all; `judge(…)` is
    the success test, over one `evaluate` of the spliced source; and
    `primer(repoRoot?)` answers the system prompt. `theoremKind` (`:475`)
    holds the H4a parts unchanged: `buildIterationMessage`, `spliceProof`,
    the verdict listing the theorem as discharged, and `loadPrimer` (the
    whole primer, as before). `planKind` (`:543`) holds
    `buildPlanIterationMessage` (`:517`: the TODO section's words from
    `formatPlanTodo`, now exported at `src/pcp.ts:1721`, then the last
    refusal, the attempts so far and the contract), `splicePlanProposal`
    (a `no-catalog` refusal is final), the success test, and
    `loadPlanPrimer` (`:713`: §2.9 of the planning chapter, from its
    heading to the next heading of its level). The success test is
    `answerPlanProposal` accepted, because it is the kernel's own answer
    to a proposal: it maps the evaluation's throw to `halt` and the
    judgement to `open`, `unsolved`, `plan-edited` and `plan-missing`,
    which `judgePlanObligation` alone does not. `runLlmWorker` (`:578`) is
    the one loop: one client shim, one authorship path, the primer of
    each kind loaded once per run. The theorem path keeps its behaviour:
    the three H4a loop tests and every other assertion of
    `src/test/pcp.ts` pass unchanged.
  - **B-175 item 5 closed.** `loadForLoop` (`:404`) loads the file as
    `pcpLoadAndEval` does: the `use` header's modules, the header
    stripped, the body's `import`ed modules, prints silenced, `softFail`
    set. The modules load once per run, through the loader's process
    cache, and each turn is one `evalSource` over the spliced body. The
    CLI cannot lend its own loader (`src/index.ts` runs its command line
    on import), so the steps are mirrored. The worker lists plan
    obligations (`plans: true`) after the rest, as `obligations` does.
  - **The client shim.** `LlmClient.send` (`:179`) also receives the
    obligation's name; the optional `LlmClient.answers` lets a client
    decline an obligation, which the loop skips (`WorkerResult.skipped`,
    and the summary's `skipped` count, zero until now). An accepted
    attempt carries the kernel's answer when the kind gives one
    (`AttemptRecord.answer`, a plan obligation's solution).
  - **The scripted proposer.** `createScriptedClient` (`:281`) answers
    each request with the next prepared proposal for the obligation it
    names, as one fenced block; `parseProposals` (`:249`) and
    `loadProposalsFile` (`:272`) read the file. The format is Markdown
    in the shape of `propose`'s TODO: a section per obligation, headed
    "## `NAME`" with the obligation's name as the TODO heads it, and
    under it one fenced ```allegro (or untagged) block per attempt, in
    the order the loop asks. Prose between the blocks is ignored, and
    blocks before the first section answer any obligation without one.
    An obligation without answers is declined, so the units library's
    laws are skipped rather than attempted. `prove FILE --proposals
    FILE.md` (`src/index.ts:362` to `:366`, `runPcpProve` at `:626`) uses
    it: no key is read, no network is reached. Its JSON gains each
    obligation's `kind` (plan obligations only), its `history` and the
    `skipped` names; the text form prints a plan obligation's turns.
  - **Authorship.** The authorship of an accepted proposal comes from
    `makeAuthorship` with its fields as for a theorem: `prover` is the
    client's `modelId()`, "scripted" for a test's client and
    "scripted:FILE" (the proposals file's base name) from the CLI;
    `attemptsUsed` and `effortBudgetUsed.attempts` are the attempt that
    was accepted; `role` is "primary". No field was added.
  - **The transcript.** The scripted loop on L1's open plan, the catalog
    as a block (`src/test/pcp.ts:1192` pins it with a test client and the
    answers in the test; the run below read them from a file named
    `proposals.md`). The units library's pending laws were skipped (five in a fresh process). The two
    requests, the replies and the kernel's answers, verbatim:

    ````
    --- request ---
    Attempt 1 for plan obligation `Fulfil: Shipped, which Depot needs`.

    **Gap:** nothing in the catalog produces Shipped, which Depot needs

    **Search so far:** Delivered from Van, Sorted from Depot

    **Catalog to extend:** `yard`: add one node block that produces `Shipped`; leave the plan `Fulfil` as written.

    **Hash:** `421ea754` (over: plan Fulfil; inputs Order; outcomes Delivered; no budget; gap Shipped by Depot)

    Reply with ONE fenced ```allegro code block holding ONE node block that produces `Shipped`, as it would appear in a plan's body, with no `catalog` and no `plan` keyword. The kernel will add it to the catalog `yard` and check the plan again.
    --- reply ---
    ```allegro
    Courier:
      inputs: Labelled
      outcomes: Shipped
      estimate: 40 min, 0.25 person-hours
    ```
    --- request ---
    Attempt 2 for plan obligation `Fulfil: Shipped, which Depot needs`.

    **Gap:** nothing in the catalog produces Shipped, which Depot needs

    **Search so far:** Delivered from Van, Sorted from Depot

    **Catalog to extend:** `yard`: add one node block that produces `Shipped`; leave the plan `Fulfil` as written.

    **Hash:** `421ea754` (over: plan Fulfil; inputs Order; outcomes Delivered; no budget; gap Shipped by Depot)

    Last attempt's refusal:
    - refused (open): nothing in the catalog produces Labelled, which Courier needs

    Attempts so far: 1
    - 1: `Courier`, refused (open): nothing in the catalog produces Labelled, which Courier needs

    Reply with ONE fenced ```allegro code block holding ONE node block that produces `Shipped`, as it would appear in a plan's body, with no `catalog` and no `plan` keyword. The kernel will add it to the catalog `yard` and check the plan again.
    --- reply ---
    ```allegro
    Ship:
      inputs: Packed
      outcomes: Shipped
      estimate: 45 min, 0.25 person-hours
    ```
    --- kernel, attempt 1 ---
    refused (open): nothing in the catalog produces Labelled, which Courier needs
    --- kernel, attempt 2 ---
    accepted: the gap is closed and the plan solved: Delivered from Van, Sorted from Depot, Shipped from Ship; bound effort 1.5 person-hours, duration 155 min
    --- authorship ---
    {"provers":[{"prover":"scripted:proposals.md","attemptsUsed":2,"effortBudgetUsed":{"attempts":2},"role":"primary"}],"verifiedAt":"2026-11-10T19:26:14.029Z"}
    ````

    The system prompt of both requests is §2.9 of
    `docs/book/vivace/planning-dsl.md`. Through the CLI, `prove
    tests/planning-loop-proposals.alg --proposals P.md --json`, with P.md
    holding `Freight` and `Ship`, exits 0: attempt 1 "refused (unsolved):
    no completion of Fulfil from the catalog fits the budget of Fulfil;
    the cheapest, Delivered from Van, Sorted from Depot, Shipped from
    Freight, is duration 200 min against 160 min", attempt 2 accepted,
    authored by "scripted:P.md" in 2 attempts; six obligations skipped,
    the five laws and the demo's second open plan `courier`
    (`src/test/pcp.ts:1333`).
  - **The tests**, appended to `src/test/pcp.ts`: at `:1169` to `:1291`,
    inside `runH4aAsyncTests`, the scripted loop on L1's open plan (the
    authorship, both request texts, the system prompt and the verdict on
    the source the loop left); a theorem through the same loop, a
    prepared proof term accepted at the second attempt; and the worker on
    `demos/rung3/02-solve.alg`, which threw at position 546 before; at
    `:1307` to `:1377`, the proposals file's format and `prove --proposals`
    in JSON and text. The in-process tests pin the skipped laws by kind,
    not by number: under `npm run test:shards`, shard 1 of 3 saw four
    pending laws of `Quantity` where a fresh process sees five
    (`Quantity.law_trans` was already discharged by an earlier test of
    that shard), so law state is shared across the tests of one process.
  - **No network in the suite.** No test constructs
    `createAnthropicClient`. `src/test/` names `ANTHROPIC_API_KEY` only
    to set it empty for a CLI run (`src/test/pcp.ts:1298`, `:1346`,
    `:1365`); without `--proposals` the CLI fails on the empty key
    before the SDK is imported, and with it no client of the SDK is made.
  - **The outputs comparison.** Every `tests/*.alg` and `demos/**/*.alg`
    on `origin/main` (72 files) was run through the CLI as `run`,
    `inspect`, `verify`, `obligations` and `propose`, before and after,
    and compared on stdout, stderr (stats lines stripped) and exit code.
    All 360 runs are identical; the chunk adds no file under `tests/` or
    `demos/`.
  - **The counts.** `npm run lint:load` is at or below the baseline.
    `demos/rung3/02-solve.alg` has 3,794,320 evaluates and 202,129
    applyComposed before and after. One turn of the loop on L1's open
    plan, measured through `setEvalStatsSink` in process: the four
    libraries load once (`lib/units.alg` 171,152 evaluates,
    `lib/totality.alg` 74, `lib/planning.alg` 63,422,
    `lib/planning_loop.alg` 115,966); the first evaluation of the file
    costs 87,139, the refused turn 150,573 and the accepted turn 447,758;
    the whole loop took 1.7 s of wall clock. A turn costs four to twelve
    times §2.4's figure of about 36,000 evaluations, because since L2 the
    open plan computes its answer when it is built: the search, and on
    the accepted turn the solve. Neither count is gated.
  - **The records.** `docs/book/platform/tooling.ir.md`: C123 becomes
    C175 and C176 (the client without and with `--proposals`); C127 to
    C130 become C177, C184, C178, C179 and C180 (the request, the
    splice, the success test, the primer section, the authorship); C132
    becomes C181 and C185 (the exit code, and a declined obligation
    skipped); C133 becomes C182 (the file loaded as the CLI loads it);
    the inferred C135 and its relation R4 become C183 (a run with a `use`
    header); clusters G29 and G30 in place of G20 and G21, all proposed,
    ask A5; evidence E40 added; E3, E16, E17, E18, E30 and E39
    re-synced. C124 (the phantom `--api-key`, B-175 item 6) is L4's and
    stays. The chapter's §9 is updated. B-175 item 5 says L3 closed it.
    The oracle lines are in L3's PR.
- **2026-11-11 — L3's default, A5 and the two terms ratified at PR
  #184's comment ('All asks ratified as they are').**
- **2026-11-11 — L4 landed.** The LLM worker with a time box, on
  `origin/main` at `116db0c` (the merge of PR #184). No stop. B-154
  (unit-name shadowing), §2.5's prerequisite, landed at PR #179. The run
  with a key is owed by the maintainer (below).

  What landed:
  - **The time box** (B-083's "time-boxing"). `runLlmWorker`
    (`pcp/llm-worker.ts:884`) takes two optional budgets, both in
    milliseconds: `turnTimeoutMs`, the kernel's check of a turn (the
    evaluation of the spliced source and the kind's success test), and
    `replyTimeoutMs`, the client's reply (`RunWorkerOptions`, `:478`).
    Two budgets rather than one, because the two waits differ by an
    order of magnitude and fail differently: a model is slow, a proposal
    can diverge. `prove` sets them with `--turn-timeout MS` and
    `--reply-timeout MS`, 0 for none; the defaults are
    `DEFAULT_TURN_TIMEOUT_MS`, 30 s, and `DEFAULT_REPLY_TIMEOUT_MS`, 120 s
    (`:509` to `:510`). 30 s is fifteen times L3's slowest measured turn
    (448,000 evaluates, under 2 s) and no longer than a model's reply;
    120 s covers a reply of `max_tokens` 2048. Without either budget,
    as every test before L4 runs it, the loop is L3's.
  - **How a diverging turn is ended.** The evaluator has no wall-clock
    or step budget: `MAX_DEPTH` (`src/evaluator.ts:15`) stops a deep
    recursion; the totality checks judge declared functions, and the
    recursion cutoff (`inlineCutoff`) residualises speculative calls
    only, so neither stops a real application. A call in tail position runs in
    the TCO loop without growing the depth, so it never stops: through
    `prove --proposals` on `origin/main`, a node block whose estimate is
    `(f => f(f))(f => f(f))` gave no answer in 40 s. `evalSource` is
    synchronous, so the turn's check runs in a worker thread instead
    (`node:worker_threads`): `KernelBox` (`:789`) starts
    `pcp/turn-worker.ts`, whose `serveTurns` (`:764`) loads the file's
    modules once through `loadForLoop` and judges one turn per message;
    when the judgement does not return within the budget the loop
    terminates the thread (`:836` to `:841`), which ends the
    evaluation, and the next turn starts a fresh thread. The thread is
    started while the client is asked (`warm`), so its load overlaps the
    reply and is not counted against the budget. The thread registers
    `tsx` itself, because it does not inherit the parent's hooks. No
    kernel file changed. The reply's box races the client against a
    timer and aborts the request's signal (`sendWithin`, `:857`;
    `LlmClient.send` gains `signal`, which `createAnthropicClient` passes
    to the SDK).
  - **The refusal kind `timeout`** (`LoopRefusal`, `:422`), added to
    the term [refusal kinds](#def-refusal-kinds) of §1, for ratification
    at L4's PR. The attempt counts, the history entry carries
    `refusal: "timeout"` beside the reason, and the next request gives
    the reason as "Last attempt's refusal". The texts (`:518` to `:525`):

    ```
    refused (timeout): the kernel did not finish within 30 s: the proposal may make the plan's search or a proof diverge
    refused (timeout): the proposer did not reply within 120 s
    ```
  - **B-175 item 6 closed.** `prove --api-key KEY` is parsed and passed
    to `createAnthropicClient`, which reads `ANTHROPIC_API_KEY` only
    when no key is passed; the missing-key message, which offered the
    flag, is unchanged. Parsing it was taken over dropping it from the
    message, because the message promised it and a key on the command
    line is the owner's choice. The flags are read by `parseProveArgs`
    (`:1181`), which `runPcpProve` (`src/index.ts:620`) calls; a flag
    without its value, or a box that is not a whole number, ends `prove`
    with exit 1 before any client is made.
  - **The transcript.** Each turn is recorded (`TurnRecord`, `:427`):
    the request, the primer section by name, the reply and its code
    block, the kernel's answer verbatim, and the time of the reply and
    of the kernel's check. `WorkerResult.transcript` (`Transcript`,
    `:1084`) adds the file, the prover (`modelId()`: the model's name, or
    `scripted:FILE`), the date, the limits and the skipped obligations.
    `prove --transcript FILE.md` writes `formatTranscript` (`:1111`), a
    Markdown page for a stakeholder, and its JSON twin `FILE.json`
    (`transcript/1`), the same record as data. The twin is for L7's
    reproducing test, which can replay each reply through the kernel and
    compare the answers without parsing Markdown or depending on the
    times. `demos/rung4/transcripts/` opens with `README.md`,
    `proposals.md` (Freight, then Ship) and the scripted loop on L2's
    demo, `scripted-planning-loop-proposals.md` and `.json`, written by
    `npx tsx src/index.ts prove tests/planning-loop-proposals.alg
    --proposals demos/rung4/transcripts/proposals.md --transcript
    demos/rung4/transcripts/scripted-planning-loop-proposals.md`: two
    attempts, refused as `unsolved` then accepted, the kernel's checks
    2,258 ms and 2,573 ms in the worker thread.
  - **The Claude Code client** (ruled at the PR, below).
    `createClaudeCodeClient({ model, binary })` (`pcp/llm-worker.ts:279`)
    answers each request by one run of Claude Code's scripted mode,
    which uses the logged-in Claude subscription. The run's command line
    (`claudeCodeArgs`, `:266`), with the request on stdin:

    ```
    claude -p --output-format json --system-prompt <primer section> --tools "" --max-turns 1 --no-session-persistence [--model <model>]
    ```

    It runs in a fresh empty temporary directory, so no `CLAUDE.md`,
    hook or MCP server of the caller's directory loads, and with
    `ANTHROPIC_API_KEY` removed from its environment (`:288`), so it
    cannot fall back to API billing; `--bare` is not passed, because bare
    mode reads no subscription login. The reply is the JSON output's
    `result`. A non-zero exit, output that is not JSON, a missing
    `result` or `is_error` set throws with the run's stdout and stderr,
    which the loop records as a failed attempt ("API error: claude-code
    exited with code N: …"), as for the SDK client. The reply's box kills
    the run (`:295`). The prover is `claude-code:MODEL`, or
    `claude-code:default` without `--model`, in the authorship and the
    transcript's `**Prover:**` line. `prove --proposer claude-code`
    selects it (`--proposer anthropic`, the SDK client, is the default;
    `--proposals FILE` still selects the scripted proposer); `--model`
    passes through. The SDK path's missing-key message gains: "To use a
    Claude subscription instead of API billing, pass --proposer
    claude-code (Claude Code's scripted mode)."
  - **The keyed run, owed by the maintainer**, on the maintainer's
    machine, where Claude Code is logged in with the subscription, from
    the repository's root:

    ```
    npx tsx src/index.ts prove tests/planning-loop-proposals.alg --proposer claude-code --transcript demos/rung4/transcripts/llm-planning-loop-proposals.md --json
    ```

    It writes `demos/rung4/transcripts/llm-planning-loop-proposals.md`
    and `llm-planning-loop-proposals.json`, with Claude Code's default
    model; `--model opus` or `--model sonnet` names one. With API
    billing instead, the same run through the SDK client, with the model
    default `createAnthropicClient` already has, is `ANTHROPIC_API_KEY=…
    npx tsx src/index.ts prove tests/planning-loop-proposals.alg
    --transcript demos/rung4/transcripts/llm-planning-loop-proposals.md
    --json`. Neither language-model client declines an obligation, so
    the loop also asks about the units library's five pending laws, each
    refused at its first splice (the theorem is in `lib/units.alg`, not
    in the file), and about the demo's second open plan `courier`: up to
    five requests for each plan obligation and one for each law.
  - **The tests**, appended to `src/test/pcp.ts`: inside
    `runH4aAsyncTests` (`:1297` to `:1400`), a client that never replies
    ended by a 200 ms reply box, its signal aborted, the attempt counted
    and the next accepted; two diverging entries on L1's open plan (the
    catalog as a block, as L3 has it) ended by a 2 s kernel box, a fresh
    thread for the second, the loop ended at its limit of two, with the
    refusal's text in the history and in the second request; L2's demo
    converging in two attempts with the CLI's default boxes; at `:1569`
    to `:1657`, `parseProveArgs` (`--api-key` among the flags, the
    defaults, the errors), the CLI's refusal of a malformed box and its
    missing-key message, and `prove --proposals --transcript` writing
    both files with their sections. The L3 CLI test of `prove
    --proposals` now runs with the default boxes on and passes
    unchanged. No test constructs `createAnthropicClient` or reaches the
    network.
    For the Claude Code client, appended after them (`:1402` to
    `:1481` and `:1659` to `:1763`), each over a fake `claude` the test
    writes into a temp directory, which refuses a command line without
    `-p`, `--output-format json`, `--tools ""` and `--max-turns 1` and
    records its arguments, stdin, working directory and key: the loop on
    L2's demo closing the gap in one attempt through it, the prover
    `claude-code:sonnet`; a run exiting with code 3 as a failed attempt
    with its stdout and stderr in the history; the reply's 0.5 s box
    killing a run that sleeps; `--proposer` parsed; and `prove --proposer
    claude-code` through the CLI with the fake first on `PATH`, beside
    the missing-key message naming the route. No test runs the real
    binary.
  - **The outputs comparison.** Every `tests/*.alg` and `demos/**/*.alg`
    on `origin/main` (72 files) was run through the CLI as `run`,
    `inspect`, `verify`, `obligations` and `propose`, before and after,
    and compared on stdout, stderr (stats lines stripped) and exit code.
    All 360 runs are identical; the chunk adds no `.alg` file. Run again after the Claude Code client: all 360 identical.
  - **The counts.** `npm run lint:load` is at or below the baseline.
    `demos/rung3/02-solve.alg` has 3,794,320 evaluates and 202,129
    applyComposed before and after.
  - **The records.** `docs/book/platform/tooling.ir.md`: C124 becomes
    C186 (`--api-key` parsed), C175 becomes C188 (no key from either
    source), C182 becomes C187 (the modules loaded again in each worker
    thread); C189 to C191 (the kernel's and the reply's boxes, the
    refusal `timeout`), C192 (`--transcript`), C193 (a malformed flag)
    and C194 (the run that ended a diverging turn) are new; all
    proposed, clusters G29 and G30 re-proposed, ask A6; evidence E41 to
    E43 added; E3, E6, E10, E11, E14 to E18, E30, E38, E39 and E40
    re-synced. For the Claude Code client, under the same ask A6: C180
    becomes C195 (the prover `claude-code:MODEL` among the three), C196
    (the `claude -p` run) and C197 (a failed run) are new, C188 and C193
    are restated (the SDK client only without `--proposer claude-code`;
    an unknown `--proposer`), evidence E44 added. The chapter's §2.9 names the `timeout` refusal and its §9
    the chunk. `docs/book/proving-in-allegro.md` states no `prove`
    option and is unchanged. B-175 item 6 says L4 closed it.
  - **The oracle lines**, on this branch with the Claude Code client:

    ```
    bash scripts/typecheck.sh                       typecheck clean (9 TS6059 rootDir-convention diagnostics ignored)
    ALLEGRO_TEST_FILTER="pcp|planning|obligation|propos|worker|H4a|timeout|transcript|language" npm test
                                                    Tests: 80 total, 80 passed, 0 failed
    npm run lint:load                               load lint: counts at or below baseline
    npm run lint:units                              units-lint: the unit DAG holds at its baseline
    npm run lint:planes                             plane-lint: the storage plane is reached only through the accessor layer
    npm run lint:docs:check                         doc-lint: anchors 0 · order 0 · ids 783 — gate passed
    MTOOL_HOME=… npm run lint:ir                    ir-lint: 7 file(s): clean (2 warnings, CK-03, C171 and C189)
    npx tsx scripts/doc-ref-lint.ts                 doc-ref-lint: all markdown doc references resolve
    npm run lint:streams                            stream-plan: 9 plan(s) checked, 0 with findings
    npx tsx scripts/analyze/lane-lint.ts --base origin/main
                                                    lane D (B-187 via docs/plans/planning-loop.md): 0 outside
    MTOOL_HOME=… npm run test:shards                1360 test runs, 1360 passed, 0 failed
    ```
- **2026-11-11 — ruled at the PR: the keyed run drives the maintainer's
  Claude subscription through Claude Code's scripted mode (`--proposer
  claude-code`), personal use; the SDK client stays for API billing;
  public demos that need Claude API calls are deferred (the website's
  loop demo is out of L7's scope until a route exists).**
- **2026-11-12 — L4's A6, the refusal kind `timeout`, the four terms and
  the obligation filter's default (none in this stream) ratified at PR
  #186's merge.**
- **2026-11-12 — L5 landed.** The ledger (R4 (a)), on `origin/main` at
  `8a06b0a` (the merge of PR #186). No stop of the brief's list; one
  finding of the engine's, below, which the library works around inside
  the boundary and which goes to the maintainer as an ask.

  What landed:
  - **The records** (`lib/planning_loop.alg:190` to `:352`). The query
    `plan_ledger(name, x, authors, levels)` answers a `PlanLedger` record
    (`:222`) for a `Plan`, a `Solution` or an `OpenPlan` whose state is
    "solved", and `none` otherwise. Its fields: `binding`, `kind`
    ("plan", "solution" or "open plan"), `plan` (the plan's name),
    `well_formed` ("discharged" when `plan_errors`, the
    `WellFormedPlan` predicate's findings, has none; "unclaimed" for a
    plan built without the `plan NAME:` form's annotation that has one,
    since an annotated one has halted), `well_formed_message`,
    `promises` (the fixtures' names), `bound`, `decisions`, `entries`
    (a list of `PlanEntryUse` records, `:220`: `node`, `port`,
    `author`, `message`), and the renderings `line` (the verdict's) and
    `lines` (`inspect`'s). A solution's entries are the distinct nodes of
    its `added` steps, each by "the file" unless `authors` (a list of
    `{binding, node, author}` records the caller passes) names the open
    plan and the entry. Every fixture on any port at any depth
    (declared inputs and outcomes, nodes, options, handlers' nodes, a
    borrowed plan's ports and nodes) is a promise. Whether a predicate is
    the trivial `v => true` cannot be told without reading its code,
    which the language does not offer, so every fixture is reported as a
    promise, admitted, as R4 (a) allows; a real predicate is worded the
    same and never discharged.
  - **The engine finding.** The walk over a plan's ports is a fold over
    `walk_levels` (32 levels, `:268`), passed by the caller, because
    three plainer forms do not load. A recursive binding in
    `lib/planning_loop.alg` beside the functions that call `check_plan`
    keeps the precompile from finishing: a program holding only `use
    units`, `use planning`, `f(p) => check_plan(p)` and `cnt(n) => if
    n == 0 then 0 else cnt(n - 1)` does not finish in 60 s, where either
    line alone runs in under a second. A function handed to itself and
    called from a lambda in its body exhausts the host's stack three
    levels down (`w(self, t) => t.kids.reduce((acc, m) => acc + self(self,
    m), 1)` over a tree of depth 3). And the fold over a list the library
    names itself keeps the library's load from finishing in 60 s, where
    the same fold over a list passed in loads in under a second. The
    files that own these are `src/runtime.ts` and `src/evaluator.ts`,
    outside the boundary. A plan nested deeper than 32 levels says so in
    its record ("…, and the nodes below level 32 not walked").
  - **The verdict** (`src/pcp.ts`). `Verdict` gains the optional
    `planLedger` (`:206`), a list of `PlanLedgerRecord` (`:212`):
    `binding`, `kind`, `plan`, `wellFormed` (`status` "discharged" or
    "unclaimed", `message`), `promises`, and for a solution `bound`,
    `decisions` and `entries` (`node`, `port`, `author`), then
    `message` and `inspect`, the library's renderings; `pcp/1` is
    unchanged, and the field is absent unless `buildVerdict`'s
    `planLedger` option supplies records. `buildAssumptionLedger` adds
    each promise as an admitted entry `promise 'NAME'`, backed by the plan
    values that carry it (`:680` to `:685`): one entry per fixture, so
    rung 3's solving demo rests on 6 and not on one per plan.
    `formatVerdict` prints `plan ledger:` and one line per record after
    the assumption ledger (`:829` to `:846`), so every existing line,
    and L2's pinned block from the coercions to the ledger, reads as
    before. `planLedgerBindings`, `planLedgerSource`, `readPlanLedger`,
    `collectPlanLedger` and `entryAuthorsFrom` (`:1594` to `:1712`)
    find the plan values by the registered `type` field, write the one
    binding `plan_ledger_found = [plan_ledger("B", B, AUTHORS,
    walk_levels), …]`, read the records back as data, and turn the loop's
    accepted proposals into authors.
  - **The CLI** (`src/index.ts`). `pcpPlanLedger` (`:479`) does
    nothing without a plan value; otherwise it loads
    `lib/planning_loop.alg` when the scope lacks `plan_ledger` and
    evaluates the binding over the file's scope, prints silenced and
    `softFail` set. `verify` passes the records to `buildVerdict`
    (`:560` to `:561`); `inspect` prints each record's `lines` at the
    end of its binding's block through `withPlanLines` (`:441`), over
    `renderModuleSummary`'s text, so `src/introspect.ts` is untouched
    (deliverable 3 needed no stop). A run of a file never reaches it.
  - **The tests**, appended to `src/test/pcp.ts`, eight: inside
    `runH4aAsyncTests` (`:1486` to `:1512`), the scripted loop on L2's
    demo, after which the solved open plan `Fulfil` lists `Ship for
    Shipped, by scripted` and the file's own `ship` keeps `by the file`;
    at `:1863` to `:2001`, `verify` on `demos/rung3/02-solve.alg`
    (rests on 6 admitted with the six names, every promise admitted, both
    plans well-formed, the theorem count line and the laws as before),
    `verify --json`'s `planLedger`, `inspect`'s lines, L2's demo's
    entries by the file, a fixture `v => v > 0` admitted and never
    discharged, the ledger's source and its literals, and a file without
    a plan value (no evaluation asked, the verdict identical, `verify` on
    `demos/rung1/04-laws.alg` without a plan line). No existing assertion
    changed; no demo added, so `src/test/language.ts` is unchanged.
  - **The outputs comparison.** Every `tests/*.alg` and `demos/**/*.alg`
    on `origin/main` (72 files) through the CLI as `run`, `inspect`,
    `verify`, `obligations` and `propose`, before and after, on stdout,
    stderr (stats lines stripped) and exit code: 336 runs identical, 24
    different, all of them `verify` and `inspect` on the twelve files
    holding a plan value; every `run`, `obligations` and `propose`
    identical; exit codes and stderr identical everywhere. Every
    difference adds lines, except the assumption ledger's summary line,
    which changes on the nine files with a fixture (eight from "rests on 0
    admitted", one from "clean"). The lines, verbatim ("was:" the line
    replaced; for `inspect`, the binding they print under):

    ```
    demos/rung3/01-model.alg, inspect:
      under BuildPipeline : Plan:
            well-formed: discharged (no findings)
            rests on: 2 admitted promises: signed_and_version_stamped, tagged_with_version
      under SoftwareRelease : Plan:
            well-formed: discharged (no findings)
            rests on: 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
      under unwired : Plan:
            well-formed: not claimed well-formed (bound without the `plan` form's check): input PackagedArtifacts of Sign is not produced by any node of Unwired or by its inputs
            rests on: no promises
      under idle : Plan:
            well-formed: not claimed well-formed (bound without the `plan` form's check): input PackagedArtifacts of Sign is not produced by any node of Unwired or by its inputs
            rests on: no promises

    demos/rung3/01-model.alg, verify:
      was:   assumption ledger: rests on 0 admitted, 0 sampled; 5 obligation(s) pending
        assumption ledger: rests on 6 admitted, 0 sampled; 5 obligation(s) pending
          ! admitted promise 'all_tests_pass' — backs: SoftwareRelease
          ! admitted promise 'signed_and_version_stamped' — backs: BuildPipeline, SoftwareRelease
          ! admitted promise 'tagged_with_version' — backs: BuildPipeline, SoftwareRelease
          ! admitted promise 'traffic_handling_capable' — backs: SoftwareRelease
          ! admitted promise 'valid_semver' — backs: SoftwareRelease
          ! admitted promise 'version_matches_release_version' — backs: SoftwareRelease
        plan ledger: 2/4 well-formed (discharged), 2 not claimed; 6 promise(s) admitted
          ✓ BuildPipeline: plan BuildPipeline, well-formed; rests on 2 admitted promises: signed_and_version_stamped, tagged_with_version
          ✓ SoftwareRelease: plan SoftwareRelease, well-formed; rests on 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
          - unwired: plan Unwired, not claimed well-formed (bound without the `plan` form's check): input PackagedArtifacts of Sign is not produced by any node of Unwired or by its inputs; rests on no promises
          - idle: plan Unwired, not claimed well-formed (bound without the `plan` form's check): input PackagedArtifacts of Sign is not produced by any node of Unwired or by its inputs; rests on no promises

    demos/rung3/02-solve.alg, inspect:
      under BuildPipeline : Plan:
            well-formed: discharged (no findings)
            rests on: 2 admitted promises: signed_and_version_stamped, tagged_with_version
      under SoftwareRelease : Plan:
            well-formed: discharged (no findings)
            rests on: 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
      under best : Solution:
            well-formed: discharged (no findings)
            bound: effort 20.75 person-hours, duration 1460 min, money none
            decisions: Test via Quick, Deploy via Direct
            catalog entries: none
            rests on: 4 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version
      under on_time : Solution:
            well-formed: discharged (no findings)
            bound: effort 22.5 person-hours, duration 1205 min, money none
            decisions: Test via Quick, Deploy via BlueGreen
            catalog entries: none
            rests on: 5 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, traffic_handling_capable
      under fulfil : Plan:
            well-formed: not claimed well-formed (bound without the `plan` form's check): outcome Delivered of Fulfil is declared but no node produces it
            rests on: no promises
      under last_mile : Plan:
            well-formed: discharged (no findings)
            rests on: no promises

    demos/rung3/02-solve.alg, verify:
      was:   assumption ledger: rests on 0 admitted, 0 sampled; 5 obligation(s) pending
        assumption ledger: rests on 6 admitted, 0 sampled; 5 obligation(s) pending
          ! admitted promise 'all_tests_pass' — backs: SoftwareRelease
          ! admitted promise 'signed_and_version_stamped' — backs: BuildPipeline, SoftwareRelease, best, on_time
          ! admitted promise 'tagged_with_version' — backs: BuildPipeline, SoftwareRelease, best, on_time
          ! admitted promise 'traffic_handling_capable' — backs: SoftwareRelease, on_time
          ! admitted promise 'valid_semver' — backs: SoftwareRelease, best, on_time
          ! admitted promise 'version_matches_release_version' — backs: SoftwareRelease, best, on_time
        plan ledger: 5/6 well-formed (discharged), 1 not claimed; 6 promise(s) admitted
          ✓ BuildPipeline: plan BuildPipeline, well-formed; rests on 2 admitted promises: signed_and_version_stamped, tagged_with_version
          ✓ SoftwareRelease: plan SoftwareRelease, well-formed; rests on 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
          ✓ best: solution of SoftwareRelease, well-formed; bound effort 20.75 person-hours, duration 1460 min, money none; decisions Test via Quick, Deploy via Direct; catalog entries none; rests on 4 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version
          ✓ on_time: solution of SoftwareRelease, well-formed; bound effort 22.5 person-hours, duration 1205 min, money none; decisions Test via Quick, Deploy via BlueGreen; catalog entries none; rests on 5 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, traffic_handling_capable
          - fulfil: plan Fulfil, not claimed well-formed (bound without the `plan` form's check): outcome Delivered of Fulfil is declared but no node produces it; rests on no promises
          ✓ last_mile: plan LastMile, well-formed; rests on no promises

    tests/planning-budget-demo.alg, inspect:
      under build_pipeline : Plan:
            well-formed: discharged (no findings)
            rests on: 2 admitted promises: signed_and_version_stamped, tagged_with_version
      under release : Plan:
            well-formed: discharged (no findings)
            rests on: 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
      under ok : Plan:
            well-formed: discharged (no findings)
            rests on: 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
      under tight : Plan:
            well-formed: not claimed well-formed (bound without the `plan` form's check): budget of SoftwareRelease: effort 24 person-hours exceeds 8 person-hours
            rests on: 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
      under rushed : Plan:
            well-formed: not claimed well-formed (bound without the `plan` form's check): budget of Deploy: duration 165 min exceeds 2 h
            rests on: 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
      under hire : Plan:
            well-formed: not claimed well-formed (bound without the `plan` form's check): budget of Hire: money 1400 USD exceeds 1000 USD
            rests on: no promises

    tests/planning-budget-demo.alg, verify:
      was:   assumption ledger: rests on 0 admitted, 0 sampled; 5 obligation(s) pending
        assumption ledger: rests on 6 admitted, 0 sampled; 5 obligation(s) pending
          ! admitted promise 'all_tests_pass' — backs: release, ok, tight, rushed
          ! admitted promise 'signed_and_version_stamped' — backs: build_pipeline, release, ok, tight, rushed
          ! admitted promise 'tagged_with_version' — backs: build_pipeline, release, ok, tight, rushed
          ! admitted promise 'traffic_handling_capable' — backs: release, ok, tight, rushed
          ! admitted promise 'valid_semver' — backs: release, ok, tight, rushed
          ! admitted promise 'version_matches_release_version' — backs: release, ok, tight, rushed
        plan ledger: 3/6 well-formed (discharged), 3 not claimed; 6 promise(s) admitted
          ✓ build_pipeline: plan BuildPipeline, well-formed; rests on 2 admitted promises: signed_and_version_stamped, tagged_with_version
          ✓ release: plan SoftwareRelease, well-formed; rests on 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
          ✓ ok: plan SoftwareRelease, well-formed; rests on 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
          - tight: plan SoftwareRelease, not claimed well-formed (bound without the `plan` form's check): budget of SoftwareRelease: effort 24 person-hours exceeds 8 person-hours; rests on 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
          - rushed: plan SoftwareRelease, not claimed well-formed (bound without the `plan` form's check): budget of Deploy: duration 165 min exceeds 2 h; rests on 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
          - hire: plan Hire, not claimed well-formed (bound without the `plan` form's check): budget of Hire: money 1400 USD exceeds 1000 USD; rests on no promises

    tests/planning-checks-demo.alg, inspect:
      under build_pipeline : Plan:
            well-formed: discharged (no findings)
            rests on: 2 admitted promises: signed_and_version_stamped, tagged_with_version
      under release : Plan:
            well-formed: discharged (no findings)
            rests on: 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
      under ok : Plan:
            well-formed: discharged (no findings)
            rests on: 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
      under unwired : Plan:
            well-formed: not claimed well-formed (bound without the `plan` form's check): input PackagedArtifacts of Sign is not produced by any node of Unwired or by its inputs
            rests on: no promises
      under cyclic : Plan:
            well-formed: not claimed well-formed (bound without the `plan` form's check): cycle through A, B in Cyclic
            rests on: no promises
      under ambiguous : Plan:
            well-formed: not claimed well-formed (bound without the `plan` form's check): input Out of C3 is ambiguous: produced by C1 and C2
            rests on: no promises
      under unpromised : Plan:
            well-formed: not claimed well-formed (bound without the `plan` form's check): input PackagedArtifacts [tagged_with_version] of Sign requires tagged_with_version, but Package provides PackagedArtifacts unconstrained
            rests on: 1 admitted promise: tagged_with_version
      under nested : Plan:
            well-formed: not claimed well-formed (bound without the `plan` form's check): outcome ValidatedBuild of Test is declared but no node produces it
            rests on: no promises

    tests/planning-checks-demo.alg, verify:
      was:   assumption ledger: clean — all proofs rest on proven backing; no pending obligations
        assumption ledger: rests on 6 admitted, 0 sampled
          ! admitted promise 'all_tests_pass' — backs: release, ok
          ! admitted promise 'signed_and_version_stamped' — backs: build_pipeline, release, ok
          ! admitted promise 'tagged_with_version' — backs: build_pipeline, release, ok, unpromised
          ! admitted promise 'traffic_handling_capable' — backs: release, ok
          ! admitted promise 'valid_semver' — backs: release, ok
          ! admitted promise 'version_matches_release_version' — backs: release, ok
        plan ledger: 3/8 well-formed (discharged), 5 not claimed; 6 promise(s) admitted
          ✓ build_pipeline: plan BuildPipeline, well-formed; rests on 2 admitted promises: signed_and_version_stamped, tagged_with_version
          ✓ release: plan SoftwareRelease, well-formed; rests on 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
          ✓ ok: plan SoftwareRelease, well-formed; rests on 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
          - unwired: plan Unwired, not claimed well-formed (bound without the `plan` form's check): input PackagedArtifacts of Sign is not produced by any node of Unwired or by its inputs; rests on no promises
          - cyclic: plan Cyclic, not claimed well-formed (bound without the `plan` form's check): cycle through A, B in Cyclic; rests on no promises
          - ambiguous: plan Ambiguous, not claimed well-formed (bound without the `plan` form's check): input Out of C3 is ambiguous: produced by C1 and C2; rests on no promises
          - unpromised: plan Unpromised, not claimed well-formed (bound without the `plan` form's check): input PackagedArtifacts [tagged_with_version] of Sign requires tagged_with_version, but Package provides PackagedArtifacts unconstrained; rests on 1 admitted promise: tagged_with_version
          - nested: plan Nested, not claimed well-formed (bound without the `plan` form's check): outcome ValidatedBuild of Test is declared but no node produces it; rests on no promises

    tests/planning-complete-demo.alg, inspect:
      under fulfil : Plan:
            well-formed: not claimed well-formed (bound without the `plan` form's check): outcome Delivered of Fulfil is declared but no node produces it
            rests on: no promises
      under last_mile : Plan:
            well-formed: discharged (no findings)
            rests on: no promises
      under best : Solution:
            well-formed: discharged (no findings)
            bound: effort 1.75 person-hours, duration 235 min, money none
            decisions: Label via PrintLabel
            catalog entries: LastMile for Delivered, by the file; Ship for Shipped, by the file; Label for Labelled, by the file
            rests on: no promises
      under shipping : Plan:
            well-formed: not claimed well-formed (bound without the `plan` form's check): input Packed of Ship is not produced by any node of Shipping or by its inputs
            rests on: no promises

    tests/planning-complete-demo.alg, verify:
        plan ledger: 2/4 well-formed (discharged), 2 not claimed; 0 promise(s) admitted
          - fulfil: plan Fulfil, not claimed well-formed (bound without the `plan` form's check): outcome Delivered of Fulfil is declared but no node produces it; rests on no promises
          ✓ last_mile: plan LastMile, well-formed; rests on no promises
          ✓ best: solution of Fulfil, well-formed; bound effort 1.75 person-hours, duration 235 min, money none; decisions Label via PrintLabel; catalog entries LastMile for Delivered, by the file; Ship for Shipped, by the file; Label for Labelled, by the file; rests on no promises
          - shipping: plan Shipping, not claimed well-formed (bound without the `plan` form's check): input Packed of Ship is not produced by any node of Shipping or by its inputs; rests on no promises

    tests/planning-core-demo.alg, inspect:
      under build_pipeline : Plan:
            well-formed: not claimed well-formed (bound without the `plan` form's check): handler on CompilationError in BuildPipeline: no node beneath BuildPipeline raises CompilationError
            rests on: 2 admitted promises: signed_and_version_stamped, tagged_with_version
      under release : Plan:
            well-formed: not claimed well-formed (bound without the `plan` form's check): outcome DeployedRelease of SoftwareRelease is declared but no node produces it
            rests on: 2 admitted promises: signed_and_version_stamped, tagged_with_version
      under again : Plan:
            well-formed: not claimed well-formed (bound without the `plan` form's check): outcome DeployedRelease of SoftwareRelease is declared but no node produces it
            rests on: 2 admitted promises: signed_and_version_stamped, tagged_with_version

    tests/planning-core-demo.alg, verify:
      was:   assumption ledger: rests on 0 admitted, 0 sampled; 5 obligation(s) pending
        assumption ledger: rests on 2 admitted, 0 sampled; 5 obligation(s) pending
          ! admitted promise 'signed_and_version_stamped' — backs: build_pipeline, release, again
          ! admitted promise 'tagged_with_version' — backs: build_pipeline, release, again
        plan ledger: 0/3 well-formed (discharged), 3 not claimed; 2 promise(s) admitted
          - build_pipeline: plan BuildPipeline, not claimed well-formed (bound without the `plan` form's check): handler on CompilationError in BuildPipeline: no node beneath BuildPipeline raises CompilationError; rests on 2 admitted promises: signed_and_version_stamped, tagged_with_version
          - release: plan SoftwareRelease, not claimed well-formed (bound without the `plan` form's check): outcome DeployedRelease of SoftwareRelease is declared but no node produces it; rests on 2 admitted promises: signed_and_version_stamped, tagged_with_version
          - again: plan SoftwareRelease, not claimed well-formed (bound without the `plan` form's check): outcome DeployedRelease of SoftwareRelease is declared but no node produces it; rests on 2 admitted promises: signed_and_version_stamped, tagged_with_version

    tests/planning-handlers-demo.alg, inspect:
      under build_pipeline : Plan:
            well-formed: discharged (no findings)
            rests on: 2 admitted promises: signed_and_version_stamped, tagged_with_version
      under release : Plan:
            well-formed: discharged (no findings)
            rests on: 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
      under ok : Plan:
            well-formed: discharged (no findings)
            rests on: 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
      under reviewed : Plan:
            well-formed: discharged (no findings)
            rests on: 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
      under fragile_build : Plan:
            well-formed: discharged (no findings)
            rests on: 2 admitted promises: signed_and_version_stamped, tagged_with_version
      under caught_above : Plan:
            well-formed: discharged (no findings)
            rests on: 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
      under small : Plan:
            well-formed: not claimed well-formed (bound without the `plan` form's check): handler on Nope in Small: no node beneath Small raises Nope
            rests on: no promises

    tests/planning-handlers-demo.alg, verify:
      was:   assumption ledger: rests on 0 admitted, 0 sampled; 5 obligation(s) pending
        assumption ledger: rests on 6 admitted, 0 sampled; 5 obligation(s) pending
          ! admitted promise 'all_tests_pass' — backs: release, ok, reviewed, caught_above
          ! admitted promise 'signed_and_version_stamped' — backs: build_pipeline, release, ok, reviewed, fragile_build, caught_above
          ! admitted promise 'tagged_with_version' — backs: build_pipeline, release, ok, reviewed, fragile_build, caught_above
          ! admitted promise 'traffic_handling_capable' — backs: release, ok, reviewed, caught_above
          ! admitted promise 'valid_semver' — backs: release, ok, reviewed, caught_above
          ! admitted promise 'version_matches_release_version' — backs: release, ok, reviewed, caught_above
        plan ledger: 6/7 well-formed (discharged), 1 not claimed; 6 promise(s) admitted
          ✓ build_pipeline: plan BuildPipeline, well-formed; rests on 2 admitted promises: signed_and_version_stamped, tagged_with_version
          ✓ release: plan SoftwareRelease, well-formed; rests on 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
          ✓ ok: plan SoftwareRelease, well-formed; rests on 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
          ✓ reviewed: plan SoftwareRelease, well-formed; rests on 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
          ✓ fragile_build: plan BuildPipeline, well-formed; rests on 2 admitted promises: signed_and_version_stamped, tagged_with_version
          ✓ caught_above: plan SoftwareRelease, well-formed; rests on 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
          - small: plan Small, not claimed well-formed (bound without the `plan` form's check): handler on Nope in Small: no node beneath Small raises Nope; rests on no promises

    tests/planning-loop-obligations.alg, inspect:
      under closed : OpenPlan:
            well-formed: discharged (no findings)
            bound: effort 1.5 person-hours, duration 155 min, money none
            decisions: no choices
            catalog entries: Van for Delivered, by the file; Depot for Sorted, by the file; Ship for Shipped, by the file
            rests on: no promises
      under solved : Plan:
            well-formed: discharged (no findings)
            rests on: no promises
      under Courier : Plan:
            well-formed: discharged (no findings)
            rests on: no promises

    tests/planning-loop-obligations.alg, verify:
        plan ledger: 3/3 well-formed (discharged); 0 promise(s) admitted
          ✓ closed: open plan Fulfil, solved, well-formed; bound effort 1.5 person-hours, duration 155 min, money none; decisions no choices; catalog entries Van for Delivered, by the file; Depot for Sorted, by the file; Ship for Shipped, by the file; rests on no promises
          ✓ solved: plan Fulfil, well-formed; rests on no promises
          ✓ Courier: plan Courier, well-formed; rests on no promises

    tests/planning-loop-proposals.alg, inspect:
      under ship : OpenPlan:
            well-formed: discharged (no findings)
            bound: effort 1.5 person-hours, duration 155 min, money none
            decisions: no choices
            catalog entries: Van for Delivered, by the file; Depot for Sorted, by the file; Ship for Shipped, by the file
            rests on: no promises
      under solved : Plan:
            well-formed: discharged (no findings)
            rests on: no promises

    tests/planning-loop-proposals.alg, verify:
        plan ledger: 2/2 well-formed (discharged); 0 promise(s) admitted
          ✓ ship: open plan Fulfil, solved, well-formed; bound effort 1.5 person-hours, duration 155 min, money none; decisions no choices; catalog entries Van for Delivered, by the file; Depot for Sorted, by the file; Ship for Shipped, by the file; rests on no promises
          ✓ solved: plan Fulfil, well-formed; rests on no promises

    tests/planning-release-demo.alg, inspect:
      under BuildPipeline : Plan:
            well-formed: discharged (no findings)
            rests on: 2 admitted promises: signed_and_version_stamped, tagged_with_version
      under SoftwareRelease : Plan:
            well-formed: discharged (no findings)
            rests on: 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable

    tests/planning-release-demo.alg, verify:
      was:   assumption ledger: rests on 0 admitted, 0 sampled; 5 obligation(s) pending
        assumption ledger: rests on 6 admitted, 0 sampled; 5 obligation(s) pending
          ! admitted promise 'all_tests_pass' — backs: SoftwareRelease
          ! admitted promise 'signed_and_version_stamped' — backs: BuildPipeline, SoftwareRelease
          ! admitted promise 'tagged_with_version' — backs: BuildPipeline, SoftwareRelease
          ! admitted promise 'traffic_handling_capable' — backs: SoftwareRelease
          ! admitted promise 'valid_semver' — backs: SoftwareRelease
          ! admitted promise 'version_matches_release_version' — backs: SoftwareRelease
        plan ledger: 2/2 well-formed (discharged); 6 promise(s) admitted
          ✓ BuildPipeline: plan BuildPipeline, well-formed; rests on 2 admitted promises: signed_and_version_stamped, tagged_with_version
          ✓ SoftwareRelease: plan SoftwareRelease, well-formed; rests on 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable

    tests/planning-solve-demo.alg, inspect:
      under SoftwareRelease : Plan:
            well-formed: discharged (no findings)
            rests on: 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
      under best : Solution:
            well-formed: discharged (no findings)
            bound: effort 20.75 person-hours, duration 1460 min, money none
            decisions: Test via Quick, Deploy via Direct
            catalog entries: none
            rests on: 4 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version
      under on_time : Plan:
            well-formed: discharged (no findings)
            rests on: 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
      under rushed : Plan:
            well-formed: not claimed well-formed (bound without the `plan` form's check): no choice of Test and Deploy fits the budget of SoftwareRelease; the cheapest, Test via Quick, Deploy via Direct, is duration 1460 min against 21 h
            rests on: 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
      under guarded : Plan:
            well-formed: not claimed well-formed (bound without the `plan` form's check): handler on PackingError in Fulfil has open options; a recovery is not a choice
            rests on: no promises

    tests/planning-solve-demo.alg, verify:
      was:   assumption ledger: rests on 0 admitted, 0 sampled; 5 obligation(s) pending
        assumption ledger: rests on 6 admitted, 0 sampled; 5 obligation(s) pending
          ! admitted promise 'all_tests_pass' — backs: SoftwareRelease, on_time, rushed
          ! admitted promise 'signed_and_version_stamped' — backs: SoftwareRelease, best, on_time, rushed
          ! admitted promise 'tagged_with_version' — backs: SoftwareRelease, best, on_time, rushed
          ! admitted promise 'traffic_handling_capable' — backs: SoftwareRelease, on_time, rushed
          ! admitted promise 'valid_semver' — backs: SoftwareRelease, best, on_time, rushed
          ! admitted promise 'version_matches_release_version' — backs: SoftwareRelease, best, on_time, rushed
        plan ledger: 3/5 well-formed (discharged), 2 not claimed; 6 promise(s) admitted
          ✓ SoftwareRelease: plan SoftwareRelease, well-formed; rests on 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
          ✓ best: solution of SoftwareRelease, well-formed; bound effort 20.75 person-hours, duration 1460 min, money none; decisions Test via Quick, Deploy via Direct; catalog entries none; rests on 4 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version
          ✓ on_time: plan SoftwareRelease, well-formed; rests on 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
          - rushed: plan SoftwareRelease, not claimed well-formed (bound without the `plan` form's check): no choice of Test and Deploy fits the budget of SoftwareRelease; the cheapest, Test via Quick, Deploy via Direct, is duration 1460 min against 21 h; rests on 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
          - guarded: plan Fulfil, not claimed well-formed (bound without the `plan` form's check): handler on PackingError in Fulfil has open options; a recovery is not a choice; rests on no promises

    tests/planning-split-demo.alg, inspect:
      under SoftwareRelease : Plan:
            well-formed: discharged (no findings)
            rests on: 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable

    tests/planning-split-demo.alg, verify:
      was:   assumption ledger: rests on 0 admitted, 0 sampled; 5 obligation(s) pending
        assumption ledger: rests on 6 admitted, 0 sampled; 5 obligation(s) pending
          ! admitted promise 'all_tests_pass' — backs: SoftwareRelease
          ! admitted promise 'signed_and_version_stamped' — backs: SoftwareRelease
          ! admitted promise 'tagged_with_version' — backs: SoftwareRelease
          ! admitted promise 'traffic_handling_capable' — backs: SoftwareRelease
          ! admitted promise 'valid_semver' — backs: SoftwareRelease
          ! admitted promise 'version_matches_release_version' — backs: SoftwareRelease
        plan ledger: 1/1 well-formed (discharged); 6 promise(s) admitted
          ✓ SoftwareRelease: plan SoftwareRelease, well-formed; rests on 6 admitted promises: valid_semver, version_matches_release_version, signed_and_version_stamped, tagged_with_version, all_tests_pass, traffic_handling_capable
    ```
  - **The counts.** `npm run lint:load` is at or below the baseline
    (`lib/planning_loop.alg` is not in the load corpus).
    `demos/rung3/02-solve.alg` has 3,794,320 evaluates and 202,129
    applyComposed before and after: the query runs only when `verify` or
    `inspect` asks, and `run` never does. The two files that `use
    planning_loop` load the larger library: L1's demo rises from
    1,033,607 to 1,047,609 evaluates and L2's from 1,491,712 to
    1,505,714; neither is gated. `verify` on `02-solve.alg` took 4.3 s
    and 4.4 s of wall clock, against 3.1 s and 2.8 s before: the
    library's load and the query.
  - **The records.** `docs/book/platform/tooling.ir.md`: C72 becomes
    C200 (`inspect`'s second evaluation, with `softFail` set); C198 (a
    fixture an admitted promise in the assumption ledger, never
    discharged), C199, C201 and C204 (the `planLedger` field and its
    records), C202 (the library loaded only for a file with a plan value)
    and C203 (`inspect`'s lines) are new; all proposed, clusters G13 and
    G28 re-proposed, ask A7; relation R2 restated on C200; evidence E45
    added; E3, E6, E10 to E16, E30, E32, E38 to E42 and E44 re-synced.
    C107 stays: it is still true. The chapter's §7 says the ledger names
    a fixture's promise, and its §9 the chunk;
    `docs/book/proving-in-allegro.md` gains one sentence beside the
    ledger's admitted laws.
  - **The oracle lines**, on this branch:

    ```
    bash scripts/typecheck.sh                       typecheck clean (9 TS6059 rootDir-convention diagnostics ignored)
    ALLEGRO_TEST_FILTER="pcp|planning|obligation|propos|ledger|verdict|inspect|language" npm test
                                                    Tests: 84 total, 84 passed, 0 failed
    npm run lint:load                               load lint: counts at or below baseline; 7 sources and 8 precompile sources, parse 0.3 s, check 3.3 s (clock not gated)
    npm run lint:units                              units-lint: the unit DAG holds at its baseline (docs/book/units.md §8)
    npm run lint:planes                             plane-lint: the storage plane is reached only through the accessor layer
    npm run lint:docs:check                         doc-lint: anchors 0 · order 0 · ids 783 — gate passed
    MTOOL_HOME=… npm run lint:ir                    ir-lint: 7 file(s) via …/methodology-tools: clean (0 violations, 4 warnings, CK-03: C198, C201, C171, C189)
    npx tsx scripts/doc-ref-lint.ts                 doc-ref-lint: all markdown doc references resolve
    npm run lint:streams                            stream-plan: 9 plan(s) checked, 0 with findings
    PR_TITLE="B-187: a solved plan's promises reach the ledger (L5)" npx tsx scripts/analyze/lane-lint.ts --base origin/main
                                                    lane-lint: lane D (B-187 via docs/plans/planning-loop.md): 11 file(s), 0 outside
    MTOOL_HOME=… npm run test:shards                Aggregate: 1368 test runs, 1368 passed, 0 failed; GATE: PASSED
    ```
- **2026-11-12 — ruled at PR #188: the three engine findings filed as
  B-188 (a recursive binding or a library-named list stalls the
  precompile or the load) and B-189 (a self-applied function exhausts
  the JS stack); the 32-level walk bound stands until they are
  addressed; A7 ratified; whether `verify` carries the loop's authors
  waits for L7; the four terms ratified; the not-claimed wording and the
  `verify` time accepted for this pilot.**
- **2026-11-12 — L6 dropped: L3's scripted loop and L4's keyed run each
  converged in two attempts from the refusal text alone, so the loop
  needed neither the call-site origin nor a rendered refused value;
  B-081's residue stays where `docs/plans/planning-pilot.md` holds it.**
