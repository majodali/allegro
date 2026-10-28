# Fast library load — the performance stream

> **Status: active** (2026-10-28) — the maintainer ratified the chunk
> sequence in §5 and the rulings in §6 on 2026-10-28. The stream runs
> as a pre-ratified sequence (W-001, `process.md` §3) under the merge
> policy of R3: merge-on-green.
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
   test already shows. Wall clock is reported, not gated.
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

**M2 — invalidation that does not clear.** `clearPos` and
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

**M7 — cached parse artifacts.** If M1 to M4 leave the planning parse
above a few seconds, cache the parsed program per library by content
hash (on disk for the CLI and the suite; pre-built into the web bundle
by `scripts/sync-web-libs.ts`). This guarantees the outcome for
repeated runs whatever the engine costs; it does not help the first
parse or user files.

## 5. Chunk sequence (to pre-ratify)

| Chunk | What lands | Oracle | Size |
|---|---|---|---|
| **P1** | `ALLEGRO_PARSE_STATS=1` prints the engine stats for a run; `npm run bench:load` with the corpus of §3 and `bench/load-baseline.json`; `npm run lint:load` ratchets the counts; the profile of §1 recorded in the plan's §7 with the stats numbers | the new lint runs and passes at its own baseline | S |
| **P2** | M5: a library loads once per run (B-155 closed). **Landed 2026-10-28** (§7) | solve demo under 90 s; counts unchanged; suite green | S–M |
| **P3** | M1: numeric memo keys | counts unchanged, clock falls, suite green | M |
| **P4** | M3: fewer and cheaper entries | memo writes fall or allocation falls; suite green | M |
| **P5** | M2: invalidation by generation; measured by the P1 stats before design | invalidation entries fall; grammar-2 left-recursion battery green | M |
| **P6** | decision point: the §7 numbers against the §2 target; R4 taken (tokenizer or not); M7 taken or not | — (stops for the maintainer) | — |
| **P7** | M6 (B-153) or hand-off to the kernel-semantics stream | demo re-evaluation count falls | M |

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
  is kernel work, outside this stream's files.
