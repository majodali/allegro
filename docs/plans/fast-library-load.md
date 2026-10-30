---
type: stream-plan
status: closed
backlog: B-157
lane: P
merge: merge-on-green
oracle:
  - npm run lint:load
  - npm test
chunks: [P1, P2, P3, P4, P5, P6, P7, P8, P9, P10]
reserves: [B-155, B-156, B-158, B-159, B-160, B-161]
boundary:
  - src/grammar2/**
  - bench/**
  - src/modules.ts
  - src/use-scanner.ts
  - src/runtime.ts
---

# Fast library load — the performance stream

> **Status: closed → B-157** (2026-10-29) — the chunk sequence of §5 is
> complete and the §2 outcome is met: the planning library parses in
> 0.2 s and loads in 0.6 s on the gate's machine, from 68 s when the
> stream began (§7, the closing entry). The maintainer ratified the
> sequence and the rulings of §6 on 2026-10-28 and 2026-10-29, and
> closed the stream on 2026-10-29 with its follow-ons filed as backlog
> items: B-159 (precompile of recursive definitions), B-160 (Bits
> decoded per member lookup), B-161 (CLI startup). The stream ran as a
> pre-ratified
> sequence (W-001, `process.md` §3) under the merge policy of R3,
> merge-on-green, with implementation delegated per chunk and every
> diff read before its merge. Kept for its §7 record.
>
> **Reader**: someone who knows the project's layers and the gate but
> has not read the parser engine. Terms: a *library* is a `lib/*.alg`
> file a program draws in with `use NAME`; *loading* it is parsing its
> source and evaluating its bindings; the *engine* is the scannerless
> packrat parser in `src/grammar2/engine.ts`; a *ratchet* is a committed
> count that may only fall.

## 1. The problem, measured

The planning pilot (B-151, the planning pilot) made the platform's cost
floor visible. Measured 2026-10-27 on `origin/main` at `3675a3e`, one
run each, `node --import tsx src/index.ts`:

| Program | Wall clock | What it is |
|---|---|---|
| `print(1)` | 4 s | startup: TypeScript loading and the standard grammar |
| `use units` then `print(1)` | 13 s (18 s under the profiler) | one 246-line library, 9,992 characters |
| `use units`, `use planning`, `print(1)` | 68 s (110 s under the profiler) | the planning library, 1,233 lines, 53,768 characters |
| `tests/planning-release-demo.alg` | 64 s | the worked example, checked once |
| `tests/planning-solve-demo.alg` | 151 s | the above plus `import build_pipeline`, which loads the planning library a second time (B-155 (library load per module)) |

The CPU profile of the planning load (93 s sampled) puts **87% of the
time in the engine** and under one second in everything after the
parse (evaluation 0.8 s; totality, type checking and the planning
checks below the profiler's noise). Self time by function:

| Function (`src/grammar2/engine.ts`) | Share | What it does |
|---|---|---|
| `ruleKey` | 16.6% | builds the memo key string `nt:NAME:indentStack` for every lookup |
| `memoGet` | 14.4% | the nested `Map` lookup by position then key |
| `clearPos` | 13.7% | drops a position's memo bucket during left-recursion growth |
| garbage collector | 11.5% | the entries and key strings above |
| `memoSet` | 11.4% | writes an entry (or a `null` for a failed attempt) |
| `matchRule` | 11.0% | the match itself |
| `matchSeq`, `matchAlt`, `matchNonTerm`, `invalidateAtPos`, `matchTerminal` | 18.1% | the rest of the match |

So the memo table — keying, lookup, writing, clearing and collecting its
garbage — is about 68% of the parse, and the grammar's own matching
about 30%. The cost is linear in the source: 1.3 ms per character for
`units`, 1.1 ms for `planning`. Two runtime costs compound it: a
library is evaluated once per module that uses it (B-155), and a
top-level binding is re-evaluated at every reference (B-153
(re-evaluation per reference)), so a demo that binds a plan and prints
it ten times builds it ten times.

What this costs the project: every planning demo takes one to three
minutes, the gate's wall clock grew by about 70 s per demo added, the
website cannot carry a live planning example (the maintainer's ruling
2026-10-27 skipped it), and the rung-4 suite of libraries (the
software engineering models) would be unusable at this constant.

## 2. The outcome

A library loads in well under a second, so that a demo runs in seconds
and a suite of libraries is usable from the sandbox. Numerically, for
the planning library on the same machine: parse under 1 s (from about
60), evaluation unchanged, and no library evaluated twice in a run.

Two kinds of move reach it, and the plan takes both in order of
certainty:

- **Make the engine cheaper per character**, which is the lasting fix
  and keeps `grammar { }` extension exactly as it is.
- **Parse less often**: load a library's module object once per run
  (B-155), and, if the engine work falls short, cache a library's
  parsed program by content hash so repeated runs and the browser bundle
  skip the parse altogether.

## 3. The oracle (what stands in for the maintainer's eye)

The stream is a candidate for autonomous delivery, so its gate is
mechanical:

1. **The suite stays green with every `// expect:` pin unchanged.** A
   parse optimisation that changes any program's output is a semantics
   change and stops the stream (stop condition: a failed check). The
   demos and `tests/*.alg` are the parser's behavioural oracle; the
   grammar-2 battery (`src/test/grammar2*.ts`) is its unit oracle.
2. **A load corpus with deterministic counts.** The engine already
   collects stats behind an option (`ParseStats`: calls per
   non-terminal, left-recursion iterations, invalidation rounds and
   entries, final memo size). Chunk P1 adds `npm run bench:load`: for
   `lib/units.alg`, `lib/planning.alg`, `tests/planning-solve-demo.alg`
   and the two `demos/rung3/` scenes it reports wall clock and the
   counts, and commits the counts to `bench/load-baseline.json`.
   **The ratchet is on the counts, not the clock**: match attempts,
   memo writes and invalidation entries may only fall, which is
   deterministic and immune to the CPU-contention flake the index
   test already shows. Left-recursion iterations are gated too, as an
   identity check on the growth loop. The final memo size is recorded
   and reported, not gated (since P5): it is a footprint, not work, and
   a chunk that stops redoing work keeps more entries. Wall clock is
   reported, not gated.
3. **The existing ratchets** (`lint:planes`, `lint:units`, the boundary
   baseline) hold as they do for every chunk.

## 4. Where the time goes, and the candidate moves

In order of expected payoff per unit of risk. Each is measured by P1
before it is taken; the plan commits to the measurement, not to the
guess.

**M1 — memo keys without strings.** `ruleKey` interpolates a string per
lookup; the `Map` then hashes it. A numeric key (the rule's id combined
with an interned id for the indent stack, which is "typically 1–5 small
integers") makes the key free and the lookup an integer hash. Expected:
the 16.6% of `ruleKey` and part of `memoGet`/`memoSet`'s cost. Risk:
low; the key's identity semantics are unchanged.

**M2 — invalidation that does not clear.** **Taken at P5** (§7), as
the second candidate: a round removes only the entries that read a
growing seed. `clearPos` and
`invalidateAtPos` serve left-recursion growth (Warth-style seed
growing): each growth iteration drops the position's bucket except the
in-progress entries, and every rule at that position re-matches. The
stats will say how many rounds and entries that is. Candidates: tag
entries with the growth generation so stale ones are skipped rather
than deleted; or clear only entries that read the growing rule. Expected:
`clearPos` 13.7% plus the re-matching it forces, which the profile
cannot separate. Risk: medium; this is the part of the engine with the
subtlest correctness argument, and the grammar-2 left-recursion tests
are the guard.

**M3 — fewer entries.** Every failed attempt writes a `null` entry;
every attempt allocates. Packrat needs failures memoised, but the
allocation can shrink (a shared sentinel; entries as parallel typed
arrays per position). Expected: part of GC's 11.5% and `memoSet`'s
11.4%. Risk: low.

**M4 — the whitespace interleave.** The standard grammar interleaves
`ws_any` between sequence elements, so every sequence position tries a
whitespace match; B1 (the offside fragment) added explicit layout
terminals that suppress it in planning's rules. The stats' calls per
non-terminal will show how much of the match budget is whitespace. If
it dominates, the structural fix is B-075 (parser constants / tokenizer
layer)'s tokenizer layer: a lexical pass that makes whitespace a
property of tokens. That changes the formalism (`grammar-formalism.md`
§2 is scannerless by design) and is a ruling, not a chunk (§6 R4).

**M5 — load a library once per run (B-155).** `libExtensions` and the
file runner evaluate a library afresh for each importing module. A
per-run cache of the loaded module object by name removes the second
70 s of the solve demo outright. Risk: low if module objects are
immutable after load, which the open-module policy (`modules.md`)
should confirm.

**M6 — a binding evaluated once (B-153).** Symbol resolution
substitutes a definition's expression rather than its value, and the
reactive registry does not hand back a resolved cell. This is runtime
work on the symbol-resolution path, in the kernel-semantics stream's
files; it is sequenced last here and may move to that stream.
**Taken at P10** (§7). The measurement placed the re-evaluation
elsewhere: symbol resolution and the evaluation loop's cells already
hand back a binding's value; the precompile pass evaluated every
binding in a context that holds expressions.

**M7 — cached parse artifacts.** If M1 to M4 leave the planning parse
above a few seconds, cache the parsed program per library by content
hash (on disk for the CLI and the suite; pre-built into the web bundle
by `scripts/sync-web-libs.ts`). This guarantees the outcome for
repeated runs whatever the engine costs; it does not help the first
parse or user files. **Not taken** (P9, §7): after P7 the planning library parses in
0.2 s, so a cache has no parse left to skip; the web bundle's load is
the website's question.

**M8 — the expression ladder without left recursion** (added at P6,
2026-10-29, from the per-rule counts). **Taken at P7** (§7). The base grammar encodes
precedence as nine stratified productions, each left-recursive
(`src/grammar2/base-grammar.ts`: "binary operators use LEFT RECURSION,
handled by the engine's Warth iteration"). Every expression start
position walks the ladder and grows a seed at each level that has an
operator: after P5, all 1.67 M growth iterations on the planning parse
are the ladder's (`expr_post` 1.01 M, `expr_mul` 0.33 M, `expr_add`
0.16 M, …), about 1,350 per source line, and the ladder's named rules
are 31% of all match attempts before their anonymous children are
counted. The same language parses without left recursion as
`level = tighter (ws op ws tighter)*`, folded left-associatively by
the tree builder, which removes every growth iteration and every
invalidation round. It changes the parse tree's SHAPE, not the built
program, so its oracle is the built programs and outputs (the suite's
pins and the user-operator fragments), not P5's raw-tree comparison.
Risk: medium, in the tree builder's node shapes and the level-splicing
mechanism `expr_form` extensions use.

## 5. Chunk sequence (to pre-ratify)

| Chunk | What lands | Oracle | Size |
|---|---|---|---|
| **P1** | `ALLEGRO_PARSE_STATS=1` prints the engine stats for a run; `npm run bench:load` with the corpus of §3 and `bench/load-baseline.json`; `npm run lint:load` ratchets the counts; the profile of §1 recorded in the plan's §7 with the stats numbers | the new lint runs and passes at its own baseline | S |
| **P2** | M5: a library loads once per run (B-155 closed). **Landed 2026-10-28** (§7) | solve demo under 90 s; counts unchanged; suite green | S–M |
| **P3** | M1: numeric memo keys. **Landed 2026-10-28** (§7) | counts unchanged, clock falls, suite green | M |
| **P4** | M3: fewer and cheaper entries. **Landed 2026-10-28** (§7) | memo writes fall or allocation falls; suite green | M |
| **P5** | M2: invalidation by generation; measured by the P1 stats before design. **Landed 2026-10-29** (§7) as dependency-tracked invalidation | invalidation entries fall; grammar-2 left-recursion battery green | M |
| **P6** | decision point: the §7 numbers against the §2 target; R4 taken (tokenizer or not); M7 taken or not. **Decided 2026-10-29** (§6 R5): P7–P10 below, in that order | — (stops for the maintainer) | — |
| **P7** | M8 (§4): the expression precedence ladder without left recursion — each level `tighter (op tighter)*`, folded left by the tree builder; removes every growth iteration. **Landed 2026-10-29** (§7) | built programs and outputs identical (the suite's pins), the grammar-2 battery, the user-operator fragments (`lib/pow.alg`, `lib/match_expr.alg`, the units literals); parse-tree shape may change, so the raw-tree comparison of P5 is not this chunk's oracle | M–L |
| **P8** | measure again; R4 applied: the scanner layer if the whitespace and lexical share still warrants it. **Measured, not taken** 2026-10-29 (§7, §6 R4) | counts fall; outputs identical; `grammar-formalism.md` §2 amended | L |
| **P9** | M7: cached parse artifacts by content hash (CLI and suite on disk; the web bundle pre-built). **Not taken, unnecessary** 2026-10-29 (§7) | repeated runs skip the parse; outputs identical | M |
| **P10** | M6 (B-153) or hand-off to the kernel-semantics stream. **Landed 2026-10-29** (§7): `ALLEGRO_EVAL_STATS=1`; the precompile pass evaluates function definitions only, and each value binding at most once | demo re-evaluation count falls | M |

The sequence stops on W-001's four conditions and on one more that is
this stream's own: **any changed `// expect:` line stops it**, because
a parser that changes a program's meaning has left the stream's scope.

## 6. Rulings (taken 2026-10-28)

- **R1 — the oracle is counts, not time.** Wall clock is reported in
  the bench and discussed in §7; the gate ratchets deterministic engine
  counts. Recommended as written in §3. **Taken** as recommended.
- **R2 — the target.** "Well under a second to parse the planning
  library" is the number the plan aims at; §7 records what each chunk
  reaches, and P6 decides whether M7 is needed. Recommended: accept the
  target as a direction, not a gate. **Taken** as recommended.
- **R3 — the stream's merge policy.** This plan is the first autonomous
  stream; the maintainer's choice between merge-on-green and
  batch-reviewed merges applies here first (the backlog's lane table
  carries the choice once made). **Taken: merge-on-green.** The
  orchestrating agent merges the stream's PRs once the gate is green
  and it has read the diff.
- **R4 — the tokenizer question**, only at P6, with the P1 numbers in
  hand: whether B-075's lexical layer is in scope, since it amends the
  scannerless formalism. **Taken**: a scanner/tokenizer layer is in
  scope; whether to build it is decided at P6 with P1's numbers.
  **Outcome (P8, 2026-10-29)**: not built now. After P7 whitespace is
  11% of a 0.2 s parse and the engine about 15% of the planning load,
  so the layer would save hundredths of a second. It stays in scope as
  a recorded option. Decided by the orchestrating agent on this plan's
  text and this ruling.
- **R5 — P7–P10 ratified and the built-program oracle confirmed,
  2026-10-29.** The maintainer ratified the chunks P7 to P10 of §5 in
  the order recommended at P6, and the oracle for P7: built programs and
  outputs identical, not the raw parse tree.

## 7. Status log

- 2026-10-27: plan drafted from the measurements in §1 (the planning
  pilot's demos, the CPU profile). The stream is the first of the
  parallel streams the maintainer asked for on 2026-10-27 (the
  backlog's lane table, row P). Nothing landed yet.
- 2026-10-28: ratified (§5 sequence; §6 rulings taken). **P1 landed.**
  `ALLEGRO_PARSE_STATS=1` prints one stderr line per program or library
  parse (`parseSource` in `src/grammar2/engine.ts`, which also gains a
  `memoWrites` count and a `finalMemoSize` that counts entries, not
  position buckets); `npm run bench:load` and `npm run lint:load`
  (`bench/load.ts`); the ratchet runs once per gate. Numbers below are
  from the agent's sandbox, which runs about 1.4 times slower than the
  machine of §1 (planning parses in 80 s there against about 60).

  The baseline (`bench/load-baseline.json`), parse only, each source
  once; counts are identical across runs:

  | Source | Chars | Match attempts | Memo writes | Inv. entries | LR iterations | Final memo | Parse s |
  |---|---|---|---|---|---|---|---|
  | `lib/totality.alg` | 2,467 | 399,154 | 510,900 | 281,878 | 6,134 | 3,458 | 0.2 |
  | `lib/units.alg` | 9,960 | 20,810,680 | 28,539,694 | 15,568,878 | 328,068 | 91,262 | 12.5 |
  | `lib/planning.alg` | 52,260 | 118,920,325 | 165,600,140 | 89,346,505 | 1,665,399 | 448,002 | 79.6 |
  | `tests/lib/build_pipeline.alg` | 1,078 | 441,837 | 553,041 | 315,638 | 7,666 | 4,831 | 0.3 |
  | `tests/planning-solve-demo.alg` | 7,317 | 8,250,119 | 11,365,469 | 6,178,458 | 121,234 | 35,489 | 5.3 |
  | `demos/rung3/01-model.alg` | 6,902 | 4,387,360 | 5,943,027 | 3,258,684 | 65,725 | 24,696 | 2.7 |
  | `demos/rung3/02-solve.alg` | 7,999 | 9,578,533 | 13,110,220 | 7,164,634 | 141,380 | 42,504 | 5.8 |

  The check takes 107 to 116 s in the sandbox, against the 90 s aimed
  at; it should be near 80 s on the machine of §1.

  `npm run bench:load`, full runs as the CLI does them:

  | Entry | Wall clock | Parses | Parse time | Match attempts |
  |---|---|---|---|---|
  | `lib/units.alg` | 30.0 s | 2 | 29.3 s | 41,621,360 |
  | `lib/planning.alg` | 190.7 s | 4 | 189.9 s | 259,050,484 |
  | `tests/planning-solve-demo.alg` | 226.2 s | 9 | 210.8 s | 299,522,410 |
  | `demos/rung3/01-model.alg` | 103.4 s | 5 | 101.1 s | 148,904,879 |
  | `demos/rung3/02-solve.alg` | 111.1 s | 5 | 103.2 s | 159,287,225 |

  What the numbers say:
  - **Parsing is the whole cost.** Parse time is 93% to over 99% of
    each run's wall clock.
  - **About half of all memo writes are cleared again.** For planning,
    165.6 M writes, 89.3 M entries cleared by invalidation, 1.39 writes
    per match attempt, and 448 k entries left at the end. The clearing
    is M2's target; M1 and M3 act on every write.
  - **The file runner parses its own file twice.** `src/index.ts`
    parses the program to find its `import`s, then `evalSource` parses
    it again. A library run as a program pays its parse twice (planning
    88 s, then 87 s). This is a cost the plan did not name; it is the
    same kind of move as M5 (parse each source once per run).
  - **B-155 (library load per module) measured.** The solve demo
    parses `units`, `totality` and `planning` twice; the second load
    happens under the grammar the first load extended, so its counts
    differ (`units` 23,078,106 attempts against 20,810,680).
- 2026-10-28: **P2 landed** (M5: a library loads once per run; B-155
  (library load per module) closed). Two changes, no parse semantics
  change and no `// expect:` line changed:
  - **One library cache per process** in `src/modules.ts`, keyed by the
    resolved path plus a hash of the file's text (a hit also compares
    the text). Every `ModuleLoader` instance reads and writes it. The
    loading procedure is one synchronous core, `loadModuleSync`; the
    async `loadModule` reads the load's sources first and then calls it.
    The test harness (`libLoader`/`libExtensions` in
    `src/test/alg-files.ts`) now loads through that loader instead of
    its own copy, so the suite and the CLI build a library the same way
    and share its extension.
  - **The file runner parses its program once.** `scanImports` in
    `src/use-scanner.ts` finds the top-level `import NAME` lines (column
    0, outside strings and comments), so `runFile`, `runInspect` and
    `pcpLoadAndEval` no longer parse the body to find them. The body's
    one parse stays in `evalSource`, under the grammar it had before.

  `npm run bench:load`, before (`origin/main` at `23abd88`) and after,
  same sandbox, one run each:

  | Entry | Wall clock before | after | Parses before | after |
  |---|---|---|---|---|
  | `lib/units.alg` | 22.2 s | 11.0 s | 2 | 1 |
  | `lib/planning.alg` | 142.1 s | 80.4 s | 4 | 3 |
  | `tests/planning-solve-demo.alg` | 180.5 s | 95.6 s | 9 | 5 |
  | `demos/rung3/01-model.alg` | 87.3 s | 91.0 s | 5 | 4 |
  | `demos/rung3/02-solve.alg` | 95.7 s | 97.0 s | 5 | 4 |

  Each source is now parsed once per run. Each removed parse was either
  the import scan or the solve demo's second `units`, `totality` and
  `planning` loads. The rung-3 scenes save only their own import scan
  (2.5 to 5 s), which is within run-to-run noise: the planning parse
  alone varied from 66 to 74 s across these runs. The solve demo
  misses the 90 s the §5 row aims at by about 6 s in this sandbox. The
  sandbox is slower than the machine of §1, and what is left is one
  parse of each source.

  `npm run lint:load` reports every count at its baseline; no baseline
  changed. The check already parsed each source once through one loader,
  so the second load under an extended grammar was never in the
  baseline.

  The gate (`npm run test:shards`, 3 shards): 1,056 s wall clock
  (2,742 s of work across the shards) before, 917 s (1,815 s of work)
  after. The longest shard now holds the one planning load and most of
  the planning demos. The before run was taken in an exported copy of
  `origin/main`, outside a repository, where the boundary lint and the
  doc-ref lint (both list tracked files) cannot run; every other test
  passed.

  **The sharing assumption.** A cached extension is handed to every
  later evaluation in the process. Before P2 that already happened
  within one run: `units` served both the `planning` load and the
  program. P2 widens it to every program in the process, which matters
  for the suite and for any long-lived host, not for a CLI run. The
  in-place writes that can reach a loaded module's values from a
  consumer are these:
  - `markTailCalls` (`_tailPosition`) and `collapseBodyMetadata` reach
    a module's functions through resolved references. Both are
    idempotent: re-marking a tree sets the same marks, and a collapsed
    body has no wrapper left to collapse.
  - `precompileFunction` (`inferredEffects`) and the divergence stamp in
    `evalSource` write onto the function a top-level program binding
    holds. When that binding is an alias of a module's function
    (`f = lib_f`), the write lands on the shared value and is not
    idempotent: precompile overwrites.
  - `stabilizeTypeMemberScope` re-keys the members of a type a top-level
    program binding holds. On an alias of a module's type it re-keys
    the shared type. `renameInPlace` fires only on an anonymous type,
    which a module's named type is not.

  No program in the corpus binds such an alias (checked over every
  file with a `use` header). The full suite with every pin unchanged
  is the oracle that the corpus does not reach them. This is recorded,
  not fixed: deriving instead of writing in place on those two paths
  is kernel work, outside this stream's files. Filed as B-158 (in-place
  write through a library alias), for a ruling on the fix.
- 2026-10-28: **P3 landed** (M1: memo keys without strings). No parse
  semantics change, no `// expect:` line changed, and every count in
  `bench/load-baseline.json` is identical: none rose and none fell, so
  the same attempts are made in the same order. The micro-run over
  `lib/units.alg` also matched the counts the baseline does not gate
  (memo hits and misses, seed returns, peak memo size). Three changes,
  all in `ParseState` in `src/grammar2/engine.ts`:
  - **The rule part of the key is a number.** `memoKey` replaces
    `ruleKey`. A non-terminal's id is interned by name, so every
    `NonTerm` object naming one production shares it, as the `nt:NAME`
    string did; any other rule's id is per object, as `rN` was. One
    counter serves both, so the two never collide. The ids live in a
    per-parse `Map`; a `WeakMap` measured no faster.
  - **The indent stack is interned in a trie.** The stack is now an
    `IndentStack` node (its top, its parent and an id) instead of an
    array. INDENT steps to the child for the new column and DEDENT to
    the parent, so equal stacks are the same node and the id is fixed
    when the node is made. Nothing joins a stack: the id is in step at
    every assignment of `state.indentStack` by construction, since the
    id is part of the value assigned. This differs from the plan's
    sketch (a `Map` keyed on the joined stack, updated at push, pop and
    restore) and was chosen because no assignment site can forget it.
    One identity changes: a match that pushes and pops back now ends on
    the node it started on, so `runDoMatch` no longer records an equal
    but distinct array as a stack change. Every reader of a stack reads
    its contents (top, depth, key), so nothing a parse decides changes.
  - **The key is one small integer**: `ruleId * 1024 + stackId`. A parse
    with more than 1,024 distinct stacks (none in the corpus: a source
    opens at most 8, `lib/planning.alg` 2) gets negative keys of a disjoint form, so
    keys stay unique; a new grammar-2 test parses 1,191 stacks to cover
    that path. `clearPos` and `invalidateAtPos` compare numbers where
    they compared strings, and keep the LR entries they kept. Keying
    the outer table by an array instead of a `Map` was measured and not
    taken: no gain.

  `npm run bench:load`, before (`origin/main` at `4ae1ba0`) and after,
  same sandbox, one run each:

  | Entry | Wall clock before | after | Planning parse before | after |
  |---|---|---|---|---|
  | `lib/units.alg` | 14.2 s | 6.4 s | — | — |
  | `lib/planning.alg` | 85.0 s | 38.5 s | 71.4 s | 32.6 s |
  | `tests/planning-solve-demo.alg` | 100.2 s | 49.7 s | 70.0 s | 30.4 s |
  | `demos/rung3/01-model.alg` | 79.2 s | 38.7 s | 64.1 s | 30.7 s |
  | `demos/rung3/02-solve.alg` | 89.3 s | 46.4 s | 66.8 s | 31.0 s |

  The planning parse falls from 64 to 71 s to 30 to 33 s, about 2.2
  times faster; `units` parses in 6.0 s against 13.2 s. The load
  ratchet's check (`npm run lint:load`) takes 48 s against 93 s.
  The gate (`npm run test:shards`, 3 shards): 902.7 s wall clock
  (1,796.9 s of work) before, 737.6 s (1,425.4 s of work) after. The
  suite gains less than the parse because the planning load is one
  part of its longest shard.

  The CPU profile of the planning load (`use units`, `use planning`,
  `print(1)`): 77.5 s sampled before, 35.9 s after. Self time after:

  | Function (`src/grammar2/engine.ts`) | Share after | Seconds before | after |
  |---|---|---|---|
  | `clearPos` | 23.7% | 10.3 | 8.5 |
  | `matchRule` (with `memoGet` inlined into it) | 22.5% | 19.9 | 8.1 |
  | garbage collector | 14.6% | 9.2 | 5.2 |
  | `memoSet` | 10.4% | 8.1 | 3.8 |
  | `memoKey` (was `ruleKey`) | 6.0% | 13.3 | 2.2 |
  | `runDoMatch` | 5.1% | 0.4 | 1.8 |
  | `matchNonTerm`, `matchAlt`, `invalidateAtPos`, `matchSeq`, `matchTerminal` | 13.7% | 14.0 | 4.9 |

  Where the time now goes: `clearPos` is the largest single cost, and
  it is P5's target (M2, invalidation by generation); with `memoSet`
  and the collector, the memo table's writes and clearing are about
  half of the parse. Before, `memoGet` was its own 11.3 s; after, V8
  inlines it into `matchRule`, so the `matchRule` row before is the
  two summed. The profiler attributes inlined callees to their callers,
  so the smaller rows move between functions from run to run.
- 2026-10-28: **P4 landed** (M3: fewer and cheaper entries). No parse
  semantics change, no `// expect:` line changed, and every count in
  `bench/load-baseline.json` is identical, memo writes included: the
  writes are the packrat contract, so no candidate skips one. The
  micro-run over `lib/units.alg` and `lib/planning.alg` also matched the
  counts the baseline does not gate (memo hits and misses, seed returns,
  peak memo size). About 84% of the attempts that miss the memo fail
  (planning: 89.8 M misses, 75.8 M of them written back as a failure's
  `null`), so the chunk worked on the failure path. Three changes, all in
  `src/grammar2/engine.ts`, were taken:
  - **One hash operation per memo write.** `matchRule` looks up the
    position's bucket once (`ParseState.bucketAt`) and holds it for the
    attempt's lookup and both writes. `memoSet` takes the bucket and an
    `added` flag, so it no longer calls `has` to keep the entry count.
    The flag is known at each write: the first write follows a lookup
    that missed, so its key is new; a failure's `null` overwrites that
    key, which is still held because `clearPos` keeps the in-progress
    entry. A miss and a failure did eight hash operations before (three
    outer `get`s, one `get`, two `has`, two `set`) and four now. A
    variant that asserted both facts ran clean over both libraries, and
    the gated `finalMemoSize` is the standing check.
  - **No array per failed attempt.** `advance` takes the failed rule
    instead of a one-element array, which was 75.8 M arrays for planning.
  - **No allocation before a match is known.** `matchTerminal` builds its
    zero-width range only in the two cases that use it (`eof`, `empty`),
    and `matchSeq` makes its children array once the first item has
    matched.

  What was measured and left (micro-benchmark, scratch, not committed):
  `units` parsed in one process, 5 interleaved rounds, median; planning
  one parse per fresh process, 3 rounds, median.

  | Candidate | `units` median | planning median | Taken |
  |---|---|---|---|
  | none (`origin/main`) | 5.31 s | 28.7 s | — |
  | `memoSet` without `has`, by the size difference | 4.99 s | — | no: the bucket-held form below subsumes it |
  | bucket held for the attempt, `added` flag | 4.57 s | — | yes |
  | `advance` without the array | 4.64 s | — | yes |
  | both of the above | — | 26.0 s | yes |
  | `advance` with a `Set` for the farthest rules | 5.01 s | — | no: no gain over the plain form |
  | failed entries recycled through a free list | 5.24 s | — | no: no gain |
  | no allocation before a terminal or sequence matches | 4.96 s | 24.7 s (with the two above) | yes |
  | every `MatchResult` built with `newIndentStack` (one hidden class) | 5.00 s | 25.2 s (with the three above) | no: no gain over 24.7 s |

  Two candidates of the brief were not built. A **flat `Map` keyed by
  position and key together** cannot serve `clearPos`, which deletes one
  position's entries and would need a per-position index of keys, which
  is the bucket again. The flat keys would also leave V8's small-integer
  range: planning creates 428 rule ids and 2 stacks, so a fixed-width
  combined key reaches about 2.7e10 and every key would be boxed. Changing
  `clearPos` is P5's. **`memoKey`** was left as it is: its remaining cost
  is one `Map` lookup by rule object, and the only alternative, an id
  stored on the grammar's shared rule objects, mutates values shared
  across parses.

  `npm run bench:load`, before (`origin/main` at `7cbd765`) and after,
  same sandbox, one run each:

  | Entry | Wall clock before | after | Planning parse before | after |
  |---|---|---|---|---|
  | `lib/units.alg` | 6.4 s | 5.0 s | — | — |
  | `lib/planning.alg` | 40.0 s | 37.4 s | 33.4 s | 31.3 s |
  | `tests/planning-solve-demo.alg` | 50.6 s | 47.0 s | 31.0 s | 27.4 s |
  | `demos/rung3/01-model.alg` | 39.3 s | 35.3 s | 31.2 s | 27.9 s |
  | `demos/rung3/02-solve.alg` | 46.3 s | 42.1 s | 31.5 s | 27.0 s |

  The planning parse falls from 31 to 33 s to 27 to 31 s, about 12%;
  `units` parses in 4.6 s against 5.9 s. The gate (`npm run
  test:shards`, 3 shards): 774.6 s wall clock (1,446.7 s of work)
  before, 789.2 s (1,498.6 s of work) after. The gate did not get
  faster: the difference is within run-to-run noise, and the longest
  shard spends most of its time outside the parse. The load ratchet's
  check, inside the gate, parsed in 42.6 s before and 39.4 s after.

  The CPU profile of the planning load (`use units`, `use planning`,
  `print(1)`): 37.0 s sampled before, 30.4 s after. Self time:

  | Function (`src/grammar2/engine.ts`) | Share after | Seconds before | after |
  |---|---|---|---|
  | `clearPos` | 26.4% | 9.0 | 8.0 |
  | `matchRule` (with the bucket lookup inlined) | 19.1% | 8.3 | 5.8 |
  | garbage collector | 15.1% | 5.3 | 4.6 |
  | `memoSet` | 14.0% | 4.3 | 4.2 |
  | `memoKey` | 5.3% | 1.8 | 1.6 |
  | `matchNonTerm`, `invalidateAtPos`, `matchSeq`, `matchAlt`, `matchTerminal` | 15.3% | 5.0 | 4.6 |
  | `runDoMatch` | 0.3% | 2.0 | 0.1 |

  Where the time now goes: `memoSet` is one `Map.set` now and still
  costs 4.2 s. What is left is the map write itself, the buckets growing
  and rehashing. `clearPos` deletes most of a bucket at each growth round
  and the next round fills it again, so the churn is invalidation's, and
  P5 (M2, invalidation by generation) acts on it together with
  `clearPos`. `runDoMatch` is now inlined into `matchRule`, which is why
  its row falls and `matchRule`'s holds part of it.
- 2026-10-29: **P5 landed** (M2: invalidation that does not clear, taken
  as dependency-tracked invalidation). No parse semantics change, no
  `// expect:` line changed, and the growth loop is unchanged:
  `lrIterations` is identical for every source. The change is in
  `src/grammar2/engine.ts`:
  - **Dependence is observed.** `MemoBucket` is now a small class: the
    entries by key (`byKey`), a per-position count of seed reads
    (`seedReads`) and a list of dependent keys (`dependents`).
    `matchRule` adds one to the count when it returns an in-progress
    entry's seed, or hits a completed entry marked `dependent`. A new
    entry is marked `dependent` when the count moved during its own
    evaluation, and its key is appended to the list.
  - **Failures carry the mark.** A failed attempt was a `null`; it is now
    one of two shared frozen entries, `FAILED` or `FAILED_DEPENDENT`. Each
    attempt makes the same writes as before.
  - **A round removes only dependents.** `invalidateAtPos` calls
    `clearDependents`, which replaces `clearPos`: it deletes the listed
    keys and empties the list, and never removes an in-progress entry. A
    scratch run with assertions confirmed that every listed key named a
    completed dependent entry, without duplicates.

  **Why it is sound** (the comment above `invalidateAtPos` states it in
  full). An entry's value is a function of the input, its key and the
  memo values its evaluation read. Matching only moves forward, so an
  attempt at P reads seeds only at P: a head at a later position started
  inside the attempt and settles before it returns, and an earlier
  position is never looked up. So a growth step at P can change an entry
  at P only if that entry read a seed at P, or hit an entry at P that did,
  and those are the two events the count records. An inner attempt's
  reads fall inside the outer one's, so the mark is transitive. The mark
  over-approximates: a settled inner head at P and its readers are still
  removed, which is why the growth iterations are the same.

  **Two count decisions** (taken by the orchestrating agent on this
  plan's text). Memo writes fall rather than hold: a kept entry is a
  cache hit, so its write and its sub-attempts' writes are skipped. The
  final memo size rises 4 to 10%, because an independent entry built in
  one growth round and not reached in the next is now kept. It is
  therefore reported, not gated (§3): `bench/load.ts --check` records and
  prints it, and gates match attempts, memo writes, invalidation entries
  and left-recursion iterations.

  The load ratchet (`npm run lint:load`), before (baseline) and after:

  | Source | Match attempts | Memo writes | Inv. entries | LR iterations | Final memo |
  |---|---|---|---|---|---|
  | `lib/totality.alg` | 399,154 → 147,509 (−63%) | 510,900 → 94,511 (−82%) | 281,878 → 57,948 (−79%) | 6,134 (same) | 3,458 → 3,607 (+4.3%) |
  | `lib/units.alg` | 20,810,680 → 7,650,981 (−63%) | 28,539,694 → 4,805,094 (−83%) | 15,568,878 → 3,027,529 (−81%) | 328,068 (same) | 91,262 → 100,489 (+10.1%) |
  | `lib/planning.alg` | 118,920,325 → 38,205,561 (−68%) | 165,600,140 → 23,874,878 (−86%) | 89,346,505 → 15,088,187 (−83%) | 1,665,399 (same) | 448,002 → 492,172 (+9.9%) |
  | `tests/lib/build_pipeline.alg` | 441,837 → 197,609 (−55%) | 553,041 → 130,049 (−76%) | 315,638 → 79,284 (−75%) | 7,666 (same) | 4,831 → 5,159 (+6.8%) |
  | `tests/planning-solve-demo.alg` | 8,250,119 → 2,806,009 (−66%) | 11,365,469 → 1,757,945 (−85%) | 6,178,458 → 1,111,264 (−82%) | 121,234 (same) | 35,489 → 38,555 (+8.6%) |
  | `demos/rung3/01-model.alg` | 4,387,360 → 1,578,540 (−64%) | 5,943,027 → 1,005,547 (−83%) | 3,258,684 → 629,004 (−81%) | 65,725 (same) | 24,696 → 26,647 (+7.9%) |
  | `demos/rung3/02-solve.alg` | 9,578,533 → 3,344,653 (−65%) | 13,110,220 → 2,114,078 (−84%) | 7,164,634 → 1,333,810 (−81%) | 141,380 (same) | 42,504 → 46,044 (+8.3%) |

  **Trees identical.** Every `tests/*.alg` and `demos/**/*.alg` (68
  files) ran through the file runner with both engines, `origin/main` at
  `a412de2` and this change, each parse's tree serialised and hashed
  (scratch, not committed): 129 parses of 85 distinct sources, every tree
  identical, and every program's output and exit code identical. The one
  parse that fails in that run fails in both with the same farthest-advance
  error.

  What was measured and left: the failure entries frozen or not, no
  difference (load check parse 4.7 to 4.8 s both ways), so frozen. A
  per-position `Map` for the count was not built: a field on the bucket
  costs no lookup. Lazy invalidation by generation was not built:
  invalidation is now about 7% of the profile (`invalidateAtPos` with
  `clearDependents`), so stamping instead of deleting has little left to
  save.

  The numbers below are from a faster sandbox than the earlier entries
  (the planning parse took 14.5 to 14.9 s there before this change,
  against 27 to 31 s at P4). `npm run bench:load`, before (`origin/main`
  at `a412de2`) and after, one run each:

  | Entry | Wall clock before | after | Planning parse before | after |
  |---|---|---|---|---|
  | `lib/units.alg` | 3.0 s | 1.1 s | — | — |
  | `lib/planning.alg` | 17.8 s | 4.4 s | 14.7 s | 3.3 s |
  | `tests/planning-solve-demo.alg` | 24.4 s | 10.6 s | 14.5 s | 3.4 s |
  | `demos/rung3/01-model.alg` | 18.9 s | 5.0 s | 14.7 s | 3.2 s |
  | `demos/rung3/02-solve.alg` | 21.9 s | 8.4 s | 14.9 s | 3.5 s |

  The planning parse is about 4.4 times faster; `units` parses in 0.7 s
  against 2.6 s. The load ratchet's check parses in 4.6 to 5.0 s against
  20.1 s. The gate (`npm run test:shards`, 3 shards): 343.7 s wall clock
  (655.3 s of work) before, 309.4 s (544.0 s of work) after; the longest
  shard spends most of its time outside the parse.

  The CPU profile of the planning load (`use units`, `use planning`,
  `print(1)`): 17.1 s sampled before, 3.9 s after. Self time:

  | Function (`src/grammar2/engine.ts`) | Share after | Seconds before | after |
  |---|---|---|---|
  | `matchRule` | 37.5% | 3.42 | 1.47 |
  | `memoSet` | 12.7% | 2.38 | 0.50 |
  | garbage collector | 7.1% | 2.45 | 0.28 |
  | `memoKey` | 6.6% | 1.06 | 0.26 |
  | `runDoMatch` | 5.5% | 0.04 | 0.21 |
  | `matchNonTerm` | 5.3% | 0.80 | 0.21 |
  | `invalidateAtPos` and `clearDependents` (was `clearPos`) | 7.2% | 4.89 | 0.28 |
  | `matchSeq`, `matchAlt`, `matchTerminal` | 5.8% | 1.20 | 0.23 |

  Where the time now goes: the match itself (`matchRule` and the
  combinators) is over half of the parse, and the memo table's writes
  and clearing are about a fifth. The parse is now about 0.06 ms per
  character for planning against the target of §2 (under 1 s for the
  library); P6 weighs that against the tokenizer (R4) and cached parse
  artifacts (M7).
- 2026-10-29: **P6, the decision point — decision requested.** Measured
  on the gate's own machine, the planning library parsed through the
  production loader with stats: **3.84 s** for 52,260 characters
  (0.073 ms per character), from 68 s on the same machine at §1, about
  18×. Counts after P5: 38.2 M attempts (730 per character), 22.6 M
  hits, 15.6 M misses, 23.9 M writes, 1.67 M growth iterations, 15.1 M
  invalidated entries. Against the §2 target (under 1 s) a factor of
  about four remains here.

  Where the attempts go. 17.6 M are named non-terminals and 20.6 M the
  anonymous sequence, alternative, repetition and terminal rules those
  names expand to. Of the named: the expression precedence ladder
  (`expr_post` 5.08 M, `expr_mul` 2.28 M, `expr_atom` 1.29 M, `expr_cmp`
  1.07 M, `expr_add` 0.82 M, `expr_of` 0.65 M, `expr_unary` 0.64 M,
  `expr_eq` 0.20 M, `expr_and` 0.10 M, `expr_amp`, `expr_or`,
  `expr_pipe`) is 11.9 M, 31% of all attempts; whitespace (`ws` 4.47 M,
  `ws_any` 0.35 M, `ws_req` 0.19 M) is 5.0 M, 13%; everything else
  named (`ident`, `args`, `number`, `string`, the statement forms) is
  under 2%. Every growth iteration belongs to the ladder (M8 in §4).

  The options, with that evidence: **(A) M8**, the ladder without left
  recursion, removes every growth iteration and the invalidation rounds
  with them, and most of the ladder's attempts; expected to be the
  largest remaining win, roughly 2 to 3×, which puts the parse near but
  probably not under 1 s on this machine. **(B) the scanner (R4)**
  removes the 13% whitespace attempts and most of the anonymous
  terminal matching; it amends the scannerless formalism and touches
  every fragment that interleaves `ws` by hand (the offside fragment's
  `hws`; user grammars); better measured after (A), which removes most
  of the positions at which whitespace is tried. **(C) M7**, cached
  parse artifacts, guarantees the outcome for repeated runs and the web
  bundle whatever the engine costs. **(D) M6 (B-153)** is runtime work
  and unchanged in priority.

  Recommended order, for the maintainer's ruling: first (A) with the
  built-program oracle (the proposed chunk P7 (the ladder)); then a
  second measurement and the scanner ruling R4 (the tokenizer question)
  applied if the whitespace and lexical share still warrants it (P8
  (measure and the scanner)); then (C) as a small chunk at any point,
  since the web bundle needs it regardless (P9 (cached parse
  artifacts)); then (D) (P10 (B-153)). The §5 table carries these as
  proposed rows.
- 2026-10-29: P7–P10 ratified in that order and the built-program
  oracle confirmed (§6 R5).
- 2026-10-29: **P7 landed** (M8: the expression ladder without left
  recursion). No parse semantics change, no `// expect:` line changed,
  and the language accepted is the same. Three changes:
  - **The levels are specified as before and run as ladders.** `LEVELS`
    in `src/grammar2/base-grammar.ts` still writes each level
    left-recursively; that specification is the form fragment merging
    edits (level insertion, operator splicing, rule surgery by
    alternative name). `ladderLevels` then rewrites every left-recursive
    `expr_*` level: an alternative that starts with the level itself is a
    *tail* (its items after that reference), any other a *first*, and the
    level becomes the ordered choice over its firsts of `first (tails
    before it)*`. For every base level the only first is the fallthrough,
    so `expr_add` runs as `expr_mul (ws "+" ws expr_mul | ws "-" ws
    expr_mul)*` and `expr_post` as `expr_atom (call | dot | bracket)*`.
    The comment above `ladderLevels` argues why this parses as Warth
    iteration does. The rewrite leaves a level as specified when a first
    can reach the level without consuming input (left recursion through
    another production, such as a user `expr_form` that starts with
    `expr`), or when a tail is untagged.
  - **User operators take the same shape through the same rewrite.**
    `buildExtendedGrammar` in `src/grammar2/fragments.ts` starts from the
    specification (`buildLeftRecursiveBaseGrammar`), applies every
    fragment edit as before, and calls `ladderLevels` last. A left
    associative user operator (`p6Infix` with `assoc` left, and the
    Phase 1 `register_infix` levels) becomes a tail; a right or
    non-associative one is a first of its level. `getGrammarWithFragments`
    takes `{ ladder: false }` so the battery can compare the two forms.
  - **The tree builder folds the ladder back.** `foldLadders` in
    `src/grammar2/tree-builder.ts` runs once over the whole tree at the
    start of `buildProgram`. A ladder node holds the first operand and
    the repetition of tails; the fold rebuilds the left-nested nodes the
    specification gives (`add` with `[left, ws, "+", ws, right]`, `call`
    with `[callee, ws, "(", ws_any, args, ws_any, ")"]`), each range from
    the left operand's start to the tail's end. A ladder with no tails is
    its first operand's tree. Every per-tag builder and every walk that
    scans children for an expression tag sees the old shape, so none of
    them changed.

  **The oracle.** (1) The full gate green with every pin unchanged. (2)
  Every `tests/*.alg` and `demos/**/*.alg` (68 files) through the file
  runner on both engines, `origin/main` at `b174d14` and this change:
  every stdout and exit code identical. Beyond the brief, each runtime
  parse's tree was serialised and hashed, raw on the old engine and after
  `foldLadders` on the new: 128 parses of 84 distinct sources, every tree
  identical, so the fold restores the old tree exactly. The one file that
  exits 1 (`tests/proofs-proven-demo.alg`) does so in both, before any
  parse, with the same output. (3) `npx tsx src/index.ts inspect` output
  identical for `tests/planning-release-demo.alg`,
  `tests/units-sugar.alg`, `tests/grammar-runtime.alg` (`use pow`),
  `tests/match-demo.alg` (`match_expr`) and `tests/logical.alg`. (4) The
  grammar-2 battery green with no assertion changed; five new tests
  compare the ladder with the specification on 19 base inputs and on user
  operators that are left, right and non-associative at base levels, and
  check that a user form starting with `expr` keeps the levels as
  specified. Nine malformed sources give the same parse error on both
  engines.

  The analyzer (`analyze` in `src/grammar2/analyzer.ts`) classified nine
  base levels as left-recursive before (`expr_pipe`, `expr_or`,
  `expr_amp`, `expr_and`, `expr_eq`, `expr_cmp`, `expr_add`, `expr_mul`,
  `expr_post`) and none after, for the base grammar and for every library
  combination the corpus uses (`pow`, `multi_grammar`, `match_expr`,
  `units`, `totality`, `contracts`, `effects`, `units` with `totality`
  and `planning`); each is clean under `assertGrammarClean` before and
  after. The opt-in disjointness check (`analyzeWithDisjointnessCheck`,
  not in the gate) reports seven more `W_ALT_OVERLAP` findings, 29
  against 22 on the base grammar: each ladder's alternative of tails
  starts with `ws`, and a level with left recursion was exempt from the
  check.

  The load ratchet (`npm run lint:load`), before (baseline) and after;
  the baseline is lowered:

  | Source | Match attempts | Memo writes | Inv. entries | LR iterations | Final memo |
  |---|---|---|---|---|---|
  | `lib/totality.alg` | 147,509 → 4,015 (−97.3%) | 94,511 → 6,191 (−93.4%) | 57,948 → 0 (−100%) | 6,134 → 0 (−100%) | 3,607 → 3,729 (+3.4%) |
  | `lib/units.alg` | 7,650,981 → 134,246 (−98.2%) | 4,805,094 → 203,463 (−95.8%) | 3,027,529 → 0 (−100%) | 328,068 → 0 (−100%) | 100,489 → 119,518 (+18.9%) |
  | `lib/planning.alg` | 38,205,561 → 649,616 (−98.3%) | 23,874,878 → 988,794 (−95.9%) | 15,088,187 → 0 (−100%) | 1,665,399 → 0 (−100%) | 492,172 → 576,677 (+17.2%) |
  | `tests/lib/build_pipeline.alg` | 197,609 → 6,033 (−96.9%) | 130,049 → 8,675 (−93.3%) | 79,284 → 0 (−100%) | 7,666 → 0 (−100%) | 5,159 → 5,555 (+7.7%) |
  | `tests/planning-solve-demo.alg` | 2,806,009 → 50,788 (−98.2%) | 1,757,945 → 75,588 (−95.7%) | 1,111,264 → 0 (−100%) | 121,234 → 0 (−100%) | 38,555 → 45,230 (+17.3%) |
  | `demos/rung3/01-model.alg` | 1,578,540 → 33,647 (−97.9%) | 1,005,547 → 49,249 (−95.1%) | 629,004 → 0 (−100%) | 65,725 → 0 (−100%) | 26,647 → 30,342 (+13.9%) |
  | `demos/rung3/02-solve.alg` | 3,344,653 → 60,692 (−98.2%) | 2,114,078 → 89,980 (−95.7%) | 1,333,810 → 0 (−100%) | 141,380 → 0 (−100%) | 46,044 → 54,048 (+17.4%) |

  No left-recursive user rule is in the corpus, so the growth loop no
  longer runs at all. The attempts fall far more than the 2 to 3 times
  P6 expected: each growth round re-ran every rule its invalidation
  round removed, and the levels nest, so one expression start paid for
  the rounds of every level above it. With no rounds, about 89% of the
  remaining attempts miss the memo. The final memo size rises 3 to 19%
  (reported, not gated): the ladder's sequence, repetition and tail
  rules are memoised at each position, and nothing removes them.

  The clock, same sandbox as P6's entry. The planning parse through the
  production loader, three runs each: 3.51 to 3.57 s before, 0.125 to
  0.134 s after, about 27 times faster and under the §2 target of 1 s.
  `npm run bench:load`, before and after, one run each:

  | Entry | Wall clock before | after | Planning parse before | after |
  |---|---|---|---|---|
  | `lib/units.alg` | 1.4 s | 0.4 s | — | — |
  | `lib/planning.alg` | 4.5 s | 0.6 s | 3.4 s | 0.1 s |
  | `tests/planning-solve-demo.alg` | 10.9 s | 6.5 s | 3.4 s | 0.1 s |
  | `demos/rung3/01-model.alg` | 5.3 s | 1.2 s | 3.4 s | 0.1 s |
  | `demos/rung3/02-solve.alg` | 8.0 s | 3.8 s | 3.3 s | 0.1 s |

  The gate (`npm run test:shards`, 3 shards): 322.8 s wall clock (556.1 s
  of work) before, 313.2 s (535.3 s of work) after. The gate gains about
  20 s of work: its parses were already a few seconds after P5, and its
  longest shard spends its time evaluating, not parsing.

  The CPU profile of the planning load (`use units`, `use planning`,
  `print(1)`): 0.7 s sampled after, against 3.9 s after P5. The whole run
  takes 0.76 s. Self time after:

  | Function | Share | Seconds |
  |---|---|---|
  | garbage collector | 15.7% | 0.10 |
  | module loading (`waitForWorker`, `makeSyncRequest`, `compileSourceTextModule`) | 21.4% | 0.15 |
  | `matchRule` | 6.3% | 0.04 |
  | `memoSet` | 3.5% | 0.02 |
  | `matchTerminal`, `matchSeq`, `matchNonTerm` | 5.5% | 0.04 |
  | `subst` (`src/evaluator.ts`) | 1.8% | 0.01 |
  | `foldLadders` | 1.3% | 0.01 |

  Where the time now goes: the parse is no longer the run's cost. The
  engine's functions are about 15% of a 0.7 s run, below the TypeScript
  module loading of the CLI's startup. What P8 (measure and the scanner)
  measures is therefore a small remainder: whitespace is now 11% of the
  planning parse's attempts (`ws` 55,702, `ws_req` 12,106, `ws_any`
  3,890 of 649,616).
- 2026-10-29: **P8 measured, not taken; P9 not taken.** Decided by the
  orchestrating agent on this plan's own text and R4 (the tokenizer
  question). P8's measurement, after P7: whitespace is 11% of the
  planning parse's match attempts (`ws` 55,702, `ws_req` 12,106,
  `ws_any` 3,890 of 649,616), and the parse takes 0.2 s; the engine is
  about 15% of the planning load's 0.7 s, below the CLI's TypeScript
  module loading. R4 applied: the scanner layer is not built now. It is
  in scope by the maintainer's ruling, but the parse is no longer the
  cost; it stays a recorded option. P9 (M7, cached parse artifacts) is
  not taken: a 0.2 s parse needs no cache, and the web bundle's load is
  the website's question, not this stream's. What remains is
  evaluation. `npm run bench:load` after P7: the solve demo
  (`tests/planning-solve-demo.alg`) 6.2 s with 0.2 s of parse,
  `demos/rung3/02-solve.alg` 4.0 s. The CPU profile of the solve demo
  (7.4 s sampled): decoding Bits to strings (`TextDecoder`,
  `bitsToString`, `decodeUTF8`) about 16%, `subst` 10.2%, the `__name`
  helper 10.4% (closures created per evaluation under tsx's
  keep-names), the garbage collector 9.8%, `applyPrimitive` 6.6%,
  `evaluateExpr` 4.5%.
- 2026-10-29: **P10 landed** (M6: a binding evaluated once; B-153
  (re-evaluation per reference) closed). No `// expect:` line changed,
  and every corpus program prints what it printed. Measured first, then
  fixed.

  **The instrument.** `ALLEGRO_EVAL_STATS=1` prints one stderr line per
  run, at process exit: `evaluate`, `applyComposed` and `applyPrimitive`
  calls, the precompile pass's inline expansions (composed-function
  bodies expanded while precompile runs), and, for every top-level
  binding whose expression computes, how many times that expression was
  evaluated (the total, the share made in precompile, the maximum, and
  how many bindings were evaluated more than once). A sink
  (`setEvalStatsSink` in `src/evaluator.ts`) receives one report per
  `evalSource` call. Off, with no sink, each counting site is one null
  test. `npm run bench:load` prints the counts for each full run;
  `lint:load` and its baseline are unchanged.

  **The mechanism: the precompile pass, not symbol resolution.** The
  evaluation loop already evaluates each binding once and stores the
  value on its cell, and a later reference reads the cell. But
  `precompileFunctions` in `src/runtime.ts` ran first, and it evaluated
  every named binding, function or not, to find the functions to
  precompile. Its context (`compileCtx`) holds the source bindings'
  expressions, never their values, so every reference inside such an
  evaluation evaluated the referenced binding's expression again,
  transitively. The values were thrown away. The evidence:
  - The five-binding chain with a print in the first binding (`d =
    print(…)`, `c = [d, d]`, `b = [c, 1]`, …) printed ten times in
    Allegro Standard and once under `--base` (Allegretto, which has no
    precompile pass). The counts: 24 evaluations of 5 bindings, 19 of
    them in precompile, 10 of `d`. A single `x = print("hi")` printed
    twice.
  - The solve demo: 455 evaluations of 73 watched bindings, 381 in
    precompile, every binding evaluated more than once, `Unit` 65 times.
    The program's precompile pass took 1.7 s against 4.6 s for its
    evaluation loop, and made 3.65 M of the run's 13.58 M `evaluate`
    calls, because it ran `best = solve(SoftwareRelease)` and rebuilt
    the plan for each binding that names it. In the evaluation loop one
    binding (`Quantity` in `lib/units.alg`) is evaluated twice: its law
    instantiation reads `Quantity` while its own definition runs. That
    is definition-time semantics and stays.
  - Which bindings precompile needs: in the solve demo, 250 function
    bindings are literals and none of the 73 value bindings evaluates
    to a function. Over the 68 corpus files and the whole suite, the
    bindings that evaluate to a function are literals, `typed_function`
    applications, and seven computed ones (`add5 = make_adder(5)`,
    `double_then_inc = compose(…)`, three `functional.compose`,
    `pipe` and `twice` results in `tests/stdlib.alg`, an annotated
    lambda binding, an alias of a function).

  **The fix**, in `precompileFunctionsInner`, two parts:
  - **Precompile evaluates function definitions only**: a function
    literal or a `typed_function` application over one, the shapes the
    effects declaration check reads before the evaluation loop
    (`isFunctionDefinition`, over `asFunction` in `src/effects.ts`).
    Every other binding is evaluated by the evaluation loop only. The
    seven computed function bindings above lose their top-level
    precompile. Nothing read it before the evaluation loop: the
    declaration check and the totality analysis see the same two
    shapes. What it produced was an entry in the report's inferred list
    and a stash on a throwaway closure.
  - **A value binding is evaluated at most once in the pass**: its
    `compileCtx` entry evaluates the expression on the first lookup and
    keeps the result (`precompileMemoEntry`), as the evaluation loop's
    cell does. A lookup made during that evaluation reads the
    expression, as before. This serves the types that definitions name
    in their signatures and bodies.

  What remains above one evaluation is by design: a type a definition
  names is evaluated once speculatively in precompile (with law
  instantiation suspended, so its value cannot be reused) and once for
  real. The visible change is the bug's: a named binding's effect
  (`x = print("hi")`) now runs once, as under `--base`. No corpus
  program has such a binding.

  The evaluation counts, `npm run bench:load` (before: `origin/main` at
  `2da84a7` with only the instrument added; one run each, same
  sandbox):

  | Entry | `evaluate` before | after | inline expansions before | after | binding evaluations before | after | max before | after | re-evaluated before | after |
  |---|---|---|---|---|---|---|---|---|---|---|
  | `lib/units.alg` | 11,365 | 4,780 | 81 | 37 | 252 of 39 | 42 of 39 | 65 | 3 | 39 | 2 |
  | `lib/planning.alg` | 36,183 | 26,285 | 546 | 502 | 394 of 58 | 76 of 58 | 65 | 3 | 58 | 17 |
  | `tests/planning-solve-demo.alg` | 13,582,040 | 9,951,204 | 219,519 | 502 | 455 of 73 | 91 of 73 | 65 | 3 | 73 | 17 |
  | `demos/rung3/01-model.alg` | 1,186,791 | 838,394 | 21,103 | 502 | 426 of 68 | 86 of 68 | 65 | 3 | 68 | 17 |
  | `demos/rung3/02-solve.alg` | 7,205,933 | 3,585,957 | 217,092 | 502 | 461 of 75 | 93 of 75 | 65 | 3 | 75 | 17 |

  `applyComposed` calls fall by the same proportion (the solve demo
  769,442 to 565,195, `02-solve` 402,725 to 200,730), and
  `applyPrimitive` calls likewise (3,164,858 to 2,315,455; 1,683,810 to
  836,660). Every program binding of the solve demo is now evaluated
  once; the 17 bindings above one are the library types the
  definitions name.

  | Entry | Wall clock before | after |
  |---|---|---|
  | `lib/units.alg` | 0.4 s | 0.3 s |
  | `lib/planning.alg` | 0.5 s | 0.6 s |
  | `tests/planning-solve-demo.alg` | 6.4 s | 5.2 s |
  | `demos/rung3/01-model.alg` | 1.2 s | 1.0 s |
  | `demos/rung3/02-solve.alg` | 4.0 s | 2.3 s |

  The solve demo's remaining 4.4 s is its evaluation loop doing what
  the program asks: it calls `solve` six times on three plans.

  **The oracle.** Every `tests/*.alg` and `demos/**/*.alg` (68 files)
  through the CLI on `origin/main` at `2da84a7` and on this change:
  stdout, stderr and exit code identical for all 68. The full gate
  green with every pin unchanged (1,235 distinct tests).

  The gate (`npm run test:shards`, 3 shards): 235.5 s wall clock
  (409.1 s of work) before, 236.2 s (409.9 s of work) after. The gate
  did not fall, against this chunk's expectation. Its longest shard
  (236 s) is the totality battery, not the planning demos:
  `tests/totality-termination-demo.alg` 68 s and four Phase E tests on
  recursive functions (`factorial` over `NonNeg` and `Int`, a
  lexicographic metric) 15 to 34 s each. Their cost is the precompile
  and termination analysis of function definitions, which this chunk
  leaves as it was; the planning demos in that shard take 0.4 to 1.7 s
  each. The before run had the instrument in place and the fix absent. New tests in
  `src/test/language.ts` pin, through the sink, that the five-binding
  chain evaluates each binding once in both modes, that the release
  demo's two plan bindings (and every other binding of it) are
  evaluated once, that a type named in three signatures is evaluated at
  most twice, that a named binding's print runs once, and that forward
  references and mutual recursion still resolve.
- 2026-10-29: **the stream closed** (the maintainer's ruling: P10's
  semantics change ratified — an effect in a named binding runs once,
  as it already did under `--base`; computed function bindings lose
  their top-level precompile; the three P10 terms ratified; B-157
  closed with its follow-ons as backlog items). The outcome against
  §2, on the gate's machine: the planning library's parse 68 s → 0.2 s
  (the load 0.6 s with evaluation), about 300×; `lib/units.alg` 13 s →
  0.3 s; `tests/planning-solve-demo.alg` 151 s → 5.2 s; the rung-3
  scenes 1.0 s and 2.3 s. The CI gate job 11 min at P1 → 7.6 min at
  P10 on the same runner class. No parse or program semantics changed
  at any step except the one ratified above; every `// expect:` line
  is as it was. What each chunk removed: P2 the second load of a
  library per module and the second parse of a program; P3 the memo's
  key strings; P4 allocation on the failure path; P5 the re-matching
  of every entry at a position on each left-recursion growth round
  (only the entries that read the seed go); P7 the left recursion of
  the base precedence levels (every growth iteration, and with it the
  invalidation); P10 the precompile pass's evaluation of every binding
  and of every binding a binding referenced. Filed as follow-ons, not
  chunks: B-159 (the precompile and termination analysis of recursive
  function definitions, now the gate's floor: the totality battery's
  shard at 236 s against the planning demos' seconds), B-160 (Bits
  decoded to strings on every member lookup, about 16% of the solve
  demo's evaluation), B-161 (the CLI's TypeScript module loading, about
  0.15 s of a 0.76 s run). Not taken and recorded: the scanner layer
  (R4; P8), cached parse artifacts (M7; P9). Open from the stream's
  findings: B-158 (in-place write through a library alias).
