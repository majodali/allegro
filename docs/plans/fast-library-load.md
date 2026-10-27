# Fast library load — the performance stream

> **Status: draft** (2026-10-27) — awaiting ratification of the chunk
> sequence in §5 and the rulings in §6. On ratification the stream runs
> as a pre-ratified sequence (W-001, `process.md` §3) under the merge
> policy the maintainer sets for autonomous streams.
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
| **P2** | M5: a library loads once per run (B-155 closed) | solve demo under 90 s; counts unchanged; suite green | S–M |
| **P3** | M1: numeric memo keys | counts unchanged, clock falls, suite green | M |
| **P4** | M3: fewer and cheaper entries | memo writes fall or allocation falls; suite green | M |
| **P5** | M2: invalidation by generation; measured by the P1 stats before design | invalidation entries fall; grammar-2 left-recursion battery green | M |
| **P6** | decision point: the §7 numbers against the §2 target; R4 taken (tokenizer or not); M7 taken or not | — (stops for the maintainer) | — |
| **P7** | M6 (B-153) or hand-off to the kernel-semantics stream | demo re-evaluation count falls | M |

The sequence stops on W-001's four conditions and on one more that is
this stream's own: **any changed `// expect:` line stops it**, because
a parser that changes a program's meaning has left the stream's scope.

## 6. Rulings requested

- **R1 — the oracle is counts, not time.** Wall clock is reported in
  the bench and discussed in §7; the gate ratchets deterministic engine
  counts. Recommended as written in §3.
- **R2 — the target.** "Well under a second to parse the planning
  library" is the number the plan aims at; §7 records what each chunk
  reaches, and P6 decides whether M7 is needed. Recommended: accept the
  target as a direction, not a gate.
- **R3 — the stream's merge policy.** This plan is the first autonomous
  stream; the maintainer's choice between merge-on-green and
  batch-reviewed merges applies here first (the backlog's lane table
  carries the choice once made).
- **R4 — the tokenizer question**, only at P6, with the P1 numbers in
  hand: whether B-075's lexical layer is in scope, since it amends the
  scannerless formalism.

## 7. Status log

- 2026-10-27: plan drafted from the measurements in §1 (the planning
  pilot's demos, the CPU profile). The stream is the first of the
  parallel streams the maintainer asked for on 2026-10-27 (the
  backlog's lane table, row P). Nothing landed yet.
