# Allegro — session bootstrap

## Methodology — binding

This project follows majodali/methodology v1.1.0 as declared in
`docs/classification.md`. That file strictly defines this project's
document lifecycles and workflows. Read it before any work; nothing
in this file or under `.claude/` overrides it.

Classification: C2 / S0 / language-tool-platform / static-site
Deviations: none

Everything authoritative lives under `docs/` (K-001). This file only
bootstraps a session: commands, invariants, pointers. A reader who
ignores it entirely misses nothing authoritative.

## Documentation map (read first)

- **Vision, thesis, design principles:** `docs/VISION.md` (Tier 0 — never edit without maintainer sign-off)
- **Process, lifecycle, quality guidelines, agent rules:** `docs/PROCESS.md` (Tier 0)
- **Classification & binding:** `docs/classification.md` · **Decisions:** `docs/decisions.md` (D1–D47, E-R, U-R, R-R, chunk rulings)
- **Architecture spine:** `docs/design/layers.md` (L0–L3 + tracks + milestones) · layer index `docs/design/README.md`
- **File-level map + evalSource pipeline:** `docs/design/implementation-map.md`
- **Durable design truth per area:** `docs/design/` (structures, type system, core types, effects, pattern matching, grammar, modules)
- **Plans:** `docs/plans/` — read `README.md` (manifest) first
- **What's next:** `docs/backlog.md` · **What landed:** `docs/CHANGELOG.md` (incl. the migrated v1-era record) · **v1 dispositions:** `V1-INVENTORY.md`
- **Consumables:** `docs/getting-started.md`, `docs/language-reference.md` (syntax by example), `docs/grammar-formalism.md`, `docs/proving-in-allegro.md`

## Build, run, test

```bash
npm test                            # full suite (src/test.ts; 1149 at 2026-08)
ALLEGRO_TEST_FILTER=pat npm test    # dev tier — targeted ~8s runs
bash scripts/typecheck.sh           # sanctioned typecheck (TS6059 rootDir convention ignored)
npx tsx src/index.ts                # REPL (Allegro Standard — default)
npx tsx src/index.ts file.alg       # run a file  (--base for Allegretto)
npx tsx src/index.ts inspect|verify|obligations|propose|prove <file>  # → docs/getting-started.md
npm run bench                       # H-arc benchmark corpus
npm run build:web                   # web bundle; deploy.sh is OWNER-RUN only
npm run check-deployed              # audit live site vs origin/main (needs site egress)
```

`basics.alg` output and every `tests/*.alg` demo are suite-pinned via
`// expect:` comments (`docs/PROCESS.md` §5) — the suite is the oracle.

## What Allegro is

A programmable language platform: **Allegretto** (minimal base — 7
representation kinds, expression DAGs, partial-evaluation evaluator) →
**Allegro Standard** (typed language as a curated extension stack) →
**Vivace** (domain-model layer, hypothesis stage). The defining bet:
provability + safety via PE-as-discharge with participant-neutral
[impl, proof] pairs — `docs/VISION.md` §1–§2.

## Architecture at a glance

- **L0 Allegretto** — values/structures/scopes, evaluator, primitives (syntax-free specification)
- **L1 Extension substrate** — grammar2 parser + runtime grammar extension, module loading
- **L2 Allegro Standard** — type system, refinements, effects, laws, proofs, totality, contracts
- **L3 Vivace** — domain models (pilot stage) · plus capability TRACKS (build, tooling, host, backend) — `docs/design/layers.md`
- Dependencies point downward only. Partial evaluation is the
  compilation model: PE Rule 1 (unresolved arg → residual with
  propagated channels), Rule 2 (lazy primitives with unresolved
  control PE both branches). Each build phase binds more symbols.
- Where code lives: `src/` (+`src/grammar2/`), `lib/` (stdlib +
  grammar/body-form modules), `tests/` (literate demos), `bench/`,
  `pcp/`, `demos/`, `web/`+`website/`, `scripts/` — per-file roles in
  `docs/design/implementation-map.md`.

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
  `scripts/typecheck.sh` is the only correct typecheck invocation.
- Eager primitives receive FULL values (channels intact); read data
  via `dataOf`/`asBits`. `lazy` is evaluation-control only. The
  propagation table governs channels — never hand-roll per-channel
  logic (PROCESS §6).
- Construct structures ONLY via `makeMultiValue`/`makeContext`; a
  stray object literal fails the W4 boundary invariant.
- Every path cloning a `ComposedFunction` preserves metadata via the
  shared helpers — never hand-clone (PROCESS §6).
- Body wrappers (`type_check`, `*_attach`) forward TailCall sentinels;
  body-form metadata is collapsed to function properties at compile
  time (`collapseBodyMetadata`) — analyzers read properties, never add
  a bespoke peeler (PROCESS §6).
- No new meta-property without registering it in the meta-protocol
  registry (`docs/design/standard/type-system.md` §4). No new `__*`
  slots ever (D39; registry is `src/slots.ts`).
- No implicit fallback in typed operators — a missing type method is
  an error. Every Standard-mode value has a type.
- Failed proof, undeclared effect, failing invariant, or non-exhaustive
  match over a finite type HALTS compilation — inside `lib/` modules
  exactly as in user code (one `evalSource` pipeline).
- Boundary lint ratchet: no `"__"`-prefixed string literals outside
  the accessor layer; use `src/slots.ts` accessors / `isMetaSlotKey`.
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
  merge. Deploys (`deploy.sh`) are owner-run only.

## Status pointers

- What's next → `docs/backlog.md` (one dependency-ordered list; stage tags
  per `docs/classification.md`)
- What landed → `docs/CHANGELOG.md` · v1 feature dispositions →
  `V1-INVENTORY.md`
- Active plans → `docs/plans/README.md` · decisions → `docs/decisions.md`
