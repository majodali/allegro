# Allegro — session bootstrap

## Methodology — binding

This project follows majodali/methodology v1.5.0 as declared in
`docs/classification.md`. That file strictly defines this project's
document lifecycles and workflows. Read it before any work; nothing
in this file or under `.claude/` overrides it.

Classification: C2 / S0 / language-tool-platform / static-site
Deviations: none

Everything authoritative lives under `docs/` (K-001). This file only
bootstraps a session: commands, invariants, pointers. A reader who
ignores it entirely misses nothing authoritative.

## Reporting and writing — cached from W-008; do not edit here

Reports to the human owner carry four parts, in this order:

1. **Asks** — the decisions and actions requested of the reader.
2. **What is already covered** — the parts of the deliverable that
   encode decisions the conversation already settled.
3. **What changed** — the parts that are new, each with a named
   pointer into the deliverable and what to review there.
4. **Terms introduced** — each term the report or its deliverable
   uses with a meaning that neither the methodology vocabulary nor
   the project's vocabulary defines, with one sentence giving its
   meaning. The asks request its ratification or striking.

State an empty part; never drop it. In the parts' order: "No asks",
"We already covered everything in the document", "The content is all
new", "No terms introduced".

Lead with the outcome or the decision needed, never with the process
that produced it. Write short, direct sentences, one idea each. Cut
clauses that add tone but not content: dramatic accumulation,
aphorism, suspense. Name every identifier you cite.

Authority: majodali/methodology W-008 (reports map their
deliverables), the P- rules, and its style guide. This block is a
cache — amend it upstream, never here.

## Documentation map (read first)

- **Vision, thesis, design principles:** `docs/book/vision.md` (Tier 0 — never edit without maintainer sign-off)
- **Process, lifecycle, quality guidelines, agent rules:** `docs/book/process.md` (Tier 0)
- **Classification & binding:** `docs/classification.md` · **Decisions:** `docs/decisions.md` (D1–D51, E-R, U-R, R-R, chunk rulings)
- **Reading order (D52, the book):** `docs/reading-order.json` is the order; `docs/book/README.md` is the table of contents. A document may define a term using only terms defined earlier; a term's definition site carries a `def-` anchor and every other first use links to it
- **Architecture vocabulary:** `docs/book/architecture-vocabulary.md` — layer, track, plane, plane interface, actor, unit: what each answers and how they relate. Read before a doc that uses more than one
- **Architecture spine:** `docs/book/layers.md` (L0–L3 + tracks + milestones) · layer index `docs/book/README.md`
- **Unit DAG (D50/D51):** `docs/book/units.md` — which unit holds which decision, what it may import, which files are still mixed; manifest `scripts/analyze/units.json`. Read the unit's row before moving code in or out of a file
- **File-level map + evalSource pipeline:** `docs/book/implementation-map.md`
- **Durable design truth per area:** `docs/book/` (structures, type system, core types, effects, pattern matching, grammar, modules)
- **Plans:** `docs/plans/` — read `README.md` (manifest) first
- **What's next:** `docs/backlog.md` · **What landed:** `docs/CHANGELOG.md` (incl. the migrated v1-era record) · **v1 dispositions:** `V1-INVENTORY.md`
- **Consumables:** `docs/book/getting-started.md`, `docs/book/language-reference.md` (syntax by example), `docs/book/grammar-formalism.md`, `docs/book/proving-in-allegro.md`

## Build, run, test

```bash
npm test                            # full suite, sequential (src/test/; 1197 at 2026-08, ~5.5min)
npm run test:shards                 # same gate, sharded across processes (~2min) — CI uses this
ALLEGRO_TEST_FILTER=pat npm test    # dev tier — targeted runs (now filters async tests too)
ALLEGRO_TEST_TRACE=1 npm test       # per-test progress to stderr (hang/slowness triage)
ALLEGRO_STACK=1 npx tsx src/index.ts f.alg  # file runner prints the JS stack of a kernel fault
ALLEGRO_TRACE_DEPTH=500 npx tsx src/index.ts f.alg  # names the Allegro function applied each time the
                                    #   evaluation depth passes another 500 levels (runaway recursion)
bash scripts/typecheck.sh           # sanctioned typecheck (TS6059 rootDir convention ignored)
npx tsx src/index.ts                # REPL (Allegro Standard — default)
npx tsx src/index.ts file.alg       # run a file  (--base for Allegretto)
npx tsx src/index.ts inspect|verify|obligations|propose|prove <file>  # → docs/book/getting-started.md
npm run bench                       # H-arc benchmark corpus
npm run bench:load                  # B-157 (the performance stream): load corpus,
                                    #   full runs, wall clock + parse counts (minutes)
ALLEGRO_PARSE_STATS=1 npx tsx src/index.ts f.alg  # one stderr line of engine
                                    #   stats per program or library parse
ALLEGRO_EVAL_STATS=1 npx tsx src/index.ts f.alg   # one stderr line of evaluator
                                    #   counts per run (B-157 P10 (the evaluation stats))
npx tsx scripts/bench-slot-lookup.ts  # B-120: slot scan vs index crossover
npx tsx scripts/analyze/index.ts <cmd> # B-127: binder-aware survey (props |
                                    #   any-props | kind-tests | refs |
                                    #   units — the D50 unit DAG measured)
npm run lint:planes                 # B-128(a): storage plane reached only
                                    #   through the accessor layer — IN THE
                                    #   GATE (once per run, not per shard)
npm run lint:units                  # B-149: the unit DAG holds at its
                                    #   baseline (scripts/analyze/
                                    #   units-baseline.json) — IN THE GATE,
                                    #   once per run like lint:planes
npm run lint:load                   # B-157: parse counts of the load corpus
                                    #   at or below bench/load-baseline.json
                                    #   — IN THE GATE, once per run (~2 min)
npm run lint:docs                   # D52: anchored links resolve, no forward
                                    #   references in the reading order, bare
                                    #   identifiers — report-only until B-150
npm run lint:streams                # B-166: every stream plan's header names
                                    #   a real lane, real backlog ids and real
                                    #   oracle commands — IN THE GATE (suite)
npx tsx scripts/stream-plan.ts      # list the stream plans and their headers
npm run build:web                   # web bundle; deploy.sh is OWNER-RUN only
npm run check-deployed              # audit live site vs origin/main (needs site egress)
```

`basics.alg` output and every `tests/*.alg` demo are suite-pinned via
`// expect:` comments (`docs/book/process.md` §5) — the suite is the oracle.

## What Allegro is

A programmable language platform: **Allegretto** (minimal base — 7
representation kinds, expression DAGs, partial-evaluation evaluator) →
**Allegro Standard** (typed language as a curated extension stack) →
**Vivace** (domain-model layer, hypothesis stage). The defining bet:
provability + safety via PE-as-discharge with participant-neutral
[impl, proof] pairs — `docs/book/vision.md` §1–§2.

## Architecture at a glance

- **L0 Allegretto** — values/structures/scopes, evaluator, primitives (syntax-free specification)
- **L1 Extension substrate** — grammar2 parser + runtime grammar extension, module loading
- **L2 Allegro Standard** — type system, refinements, effects, laws, proofs, totality, contracts
- **L3 Vivace** — domain models (pilot stage) · plus capability TRACKS (build, tooling, host, backend) — `docs/book/layers.md`
- Dependencies point downward only. Partial evaluation is the
  compilation model: PE Rule 1 (unresolved arg → residual with
  propagated channels), Rule 2 (lazy primitives with unresolved
  control PE both branches). Each build phase binds more symbols.
- Where code lives: `src/` (+`src/grammar2/`), `lib/` (stdlib +
  grammar/body-form modules), `tests/` (literate demos), `bench/`,
  `pcp/`, `demos/`, `web/`+`website/`, `scripts/` — per-file roles in
  `docs/book/implementation-map.md`.

## Conventions & invariants (the gotcha list)

Recurring-lesson invariants (PROCESS §6 carries the canonical
evaluator/runtime set; this is the complete session list):

- ESM throughout: `"type": "module"`, `"module": "nodenext"`, all
  imports use `.js` extensions.
- Browser-compatible core: `TextEncoder`/`TextDecoder`, never `Buffer`.
- `src/parser.ts` is generated (`npm run generate-parser`) and keeps
  `// @ts-nocheck` — do not annotate it.
- `bench/`, `pcp/`, `scripts/` live OUTSIDE tsconfig's rootDir — run
  via tsx, validated by the suite; TS6059 from tsc is sanctioned and
  `scripts/typecheck.sh` is the only correct typecheck invocation. It calls
  `node node_modules/typescript/lib/tsc.js` explicitly, never `npx tsc`:
  npx resolves through `node_modules/.bin`, where any package shipping a
  `tsc` bin shadows the gate's compiler (B-127).
- TWO TypeScript packages, on purpose. `typescript` (7.x) is the GATE
  compiler. `ts-compiler` is TypeScript 5 alias-installed for
  `scripts/analyze/` — TS 7's package no longer exports `createProgram`,
  and the analyzer must not be able to change what gates the build.
- **Surveys use `scripts/analyze/`, not grep** (B-127). A regex cannot see
  a predicate standing in for the question, a callee's unnamed side effect,
  or an `any` receiver — and `any` PROPAGATES, so counting casts undercounts
  the unchecked surface several-fold.
- **The storage plane is policed** (`npm run lint:planes`, B-128(a)).
  `Structure.meta` and `Structure.entries` are CLOSED outside
  `src/structure.ts`, `src/slot-accessors.ts` and `src/metadata.ts` — any
  hit fails. `.bindingList` is
  ratcheted at its committed count in `scripts/analyze/plane-baseline.json`
  and may only fall. `.bindings` is NOT policed: since B-120 E3 it is the
  derived read-only view, which is the sanctioned way to read the slot plane
  by name. It runs in the gate: once in `scripts/test-shards.mjs` after the
  shards, and once in `npm test` via `src/test/tooling.ts` (skipped when
  sharded — it inspects the whole program, so one answer is enough).
- Eager primitives receive FULL values (metadata intact) — never strip
  an argument, or you drop every field it carries. `lazy` is
  evaluation-control only. The propagation table governs metadata —
  never hand-roll per-field logic (PROCESS §6).
- Metadata rides EVERY kind (B-121): a typed `42` is a `Bits` with a
  `type` field, not a wrapper. `withMeta` is the one attachment
  operation; the factories take metadata so a value never exists
  without it; `carryMeta` moves it across a new datum. The carrier,
  `primary`, `isCarrier` and `dataOf` are deleted and the boundary
  lint forbids the last two by name.
- Write metadata in place ONLY while a value is provably unshared —
  during construction, before it escapes. After that, derive
  (`src/structure.ts` states the rule and why).
- **A library's values are immutable after load; a module writes only
  into values it constructed** (the owner-module invariant of B-158 (in-place write through a library alias);
  `docs/book/extension/modules.md` "Loaded once per process"). A library
  is loaded once per process and shared by every program that uses it,
  so a program's alias of a library function or type (`f = lib_f`,
  `T = LibType`) hands a shared value to the pipeline's in-place writers:
  the precompile effects write, the divergence stamp and member
  re-keying all skip values the evaluation was handed through its
  extensions (`libraryOwnedValues` in `src/runtime.ts`; types stabilise
  once). The library-immutability test in `src/test/modules.ts` holds
  it: a new in-place writer must consult the same set or that test fails.
- Construct structures ONLY via `withMeta`/`makeStructure`; a
  stray object literal fails the W4 boundary invariant.
- Every path cloning a `ComposedFunction` preserves metadata via the
  shared helpers — never hand-clone (PROCESS §6).
- Body wrappers (`type_check`, `*_attach`) forward TailCall sentinels;
  body-form metadata is collapsed to function properties at compile
  time (`collapseBodyMetadata`) — analyzers read properties, never add
  a bespoke peeler (PROCESS §6).
- No new meta-property without registering it in the meta-protocol
  registry (`docs/book/standard/type-system.md` §4). No new `__*`
  slots ever (D39; registry is `src/slot-accessors.ts`).
- No implicit fallback in typed operators — a missing type method is
  an error. Every Standard-mode value has a type.
- Failed proof, undeclared effect (`div` included — a declaration is a
  contract, CE-R1), or a failed refinement/type ANNOTATION check HALTS
  compilation — inside `lib/` modules exactly as in user code (one
  `evalSource` pipeline). Two paths are consciously weaker (CE-R8):
  construction-path invariant failure yields an error VALUE, and
  non-exhaustive match over a finite type is an info notification —
  promoting either to a halt is a maintainer decision, not assumed.
- Boundary lint ratchet: no `"__"`-prefixed string literals outside
  the accessor layer; use `src/slot-accessors.ts` accessors / `isMetaProtocolSlot`
  (`isMetaSlotKey` was deleted at B-120 E5).
  B-104 chunk 1 widened it — a dunder now also counts as a synthesized
  template key (`` `__future_${n}` ``), a property access, or a
  primitive's diagnostic name. Those three patterns are `ratchetOnly`
  (counts committed in `src/boundary-baseline.json`, no increases)
  until B-104 drives them to zero, then they hard-fail like the rest.
- The `__*` prefix is being RETIRED (B-104). Host-plane properties are
  already plain names — do not reintroduce a dunder on a JS expando.
  The binding-plane slots still carry it by name only: since B-120 E5
  the partition between engine metadata and user fields is the
  registered set (`isMetaProtocolSlot`), not the prefix, so the names
  can change when B-104 reaches them.
- Unit order (D50): a file's unit is in `scripts/analyze/units.json`; an
  import that the DAG does not permit is a violation, and a kind
  comparison outside a kind unit, the assembly or the evaluator breaks
  the discriminator rule (`docs/book/units.md` §3.2) — both reported by
  `scripts/analyze/index.ts units` and ratcheted by `npm run lint:units`
  (B-149): no new forbidden edge, no new mixed file, no rise in the
  discriminator count, no file without a unit; lower the baseline with
  `units --update-baseline` after a split lands, never raise it.
- Commit messages with backticks: write to a file, `git commit -F` —
  inline `-m` backticks get shell-expanded.

## Session contract

- Start here, follow pointers; read the plans manifest
  (`docs/plans/README.md`) before feature work and the area's design
  doc before changing an area.
- Chunk discipline (PROCESS §3): land a tight increment, summarize,
  STOP for the gate. Maintainer decides chunk boundaries.
- Landing checklist (PROCESS §5): typecheck + full suite green,
  CHANGELOG entry, BACKLOG updated, design docs synced, plan status
  current, website loop when the public surface changes.
- Tests are append-only in spirit: never remove or weaken an existing
  test condition (incl. `// expect:` comments) without discussing
  first (PROCESS §6).
- This file changes ONLY for commands, invariants, architecture —
  never history (→ CHANGELOG), never design rationale (→ design
  docs), never status (→ BACKLOG) (PROCESS §1).
- Tier-0 docs (`VISION.md`, `PROCESS.md`) are never edited without
  explicit maintainer sign-off; surface conflicts, don't pick a side.
- Branch practice (W-006): single-use outcome-named branches off
  main, one per deliverable/move, PR for owner review, deleted after
  merge. A merged PR is the approval signal — open questions update
  the same branch and its PR, and a new branch waits for the merge
  (PROCESS §3, "The PR is the gate"). Before opening a PR, fetch
  `origin/main`: the maintainer may have merged while you worked.
  Deploys (`deploy.sh`) are owner-run only.

## Status pointers

- What's next → `docs/backlog.md` (one dependency-ordered list; stage tags
  per `docs/classification.md`)
- What landed → `docs/CHANGELOG.md` · v1 feature dispositions →
  `V1-INVENTORY.md`
- Active plans → `docs/plans/README.md` · decisions → `docs/decisions.md`
- Document types, reader-facing findings and migration order →
  `docs/documentation-census.md`
- Identifiers renamed, merged, removed or renumbered; chapters moved →
  `docs/book-changes.md` (removed identifiers are free for reuse)
