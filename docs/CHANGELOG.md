# Allegro — Changelog

> Tier 2. Append an entry per landed chunk (see `docs/PROCESS.md` §5).
> Newest first. Each entry: what landed, key decisions, deviations from
> plan, test count.

*Stub — the per-phase history currently embedded in `CLAUDE.md` ("What's
Next" / completed-items section) will be migrated here verbatim during the
2026-06 documentation refactor; new entries are appended here from now on.*

## 2026-07 — C0.1: Boundary-test harness + baseline (structures Phase 0, B-001)

First chunk of the structures-unification implementation plan. New
`src/boundary-tests.ts` wired into the suite, four instruments:

- **Boundary lint** — counts forbidden direct-access patterns
  (`.components`, `__*` string literals, `bindings.get("__…")`,
  `primaryOf` outside its definition site) across production sources
  (excludes generated `parser.ts`, `test.ts`, and the harness itself)
  against a committed baseline (`src/boundary-baseline.json`: 14 files,
  661 occurrences). Ratchet semantics: an increase fails the suite
  (negative-tested); a decrease prints a tighten note; regenerate with
  `npx tsx src/boundary-tests.ts --write-baseline`. A `hardFail` flag +
  `allowedFiles` allowlist are in place for C1.3's flip to zero-tolerance.
- **Invariant property checks** — deterministic (mulberry32, fixed seed)
  generator builds 40 small well-typed-by-construction programs, evaluates
  them through the public `evalSource` surface, and walks every result +
  binding asserting W1 (a MultiValue's primary is never a MultiValue) and
  W2 (a resolved `type` component's primary is a Context). Invariant set
  grows per phase (transparency, key-sort partition, immutability).
- **Forgery-suite skeleton** — D21's scenarios A–F as named, visible,
  skipped entries with their blocking mechanism and unlock chunk recorded
  (A/B/D/F → C1.4, C → C1.5, E → S3 enforcement).
- **Baseline snapshot** — basics.alg print-output equivalence under the
  standard type system; a suite-count floor (979, enforced in test.ts's
  summary as a mass-disablement tripwire); a coarse perf floor over three
  fixed workloads (basics, 50k TCO recursion, map/filter/reduce chain),
  **warn-only at 2×** — the hard regression threshold is flagged as a
  pending maintainer decision per plan §5.

Plan status flipped to **active** (maintainer approved Phase 0). No
production-code changes; zero behavior change. 984/984 green (979 + 5
harness tests).

## 2026-07 — Layer model, docs reorg, backlog rebuild

- `docs/design/layers.md`: the architectural spine — L0 Allegretto / L1
  extension substrate / L2 Standard / L3 Vivace with strict one-way
  dependencies; capability tracks (build, tooling, host, backend, perf,
  bootstrap, ecosystem); milestone register M1–M10 with
  validated/aspirational tags. Maintainer rulings: parser is L1 (concrete
  syntax is an extension), module system split (loading L1 / typed objects
  L2), provability is an independent L2 capability, build pipeline is a
  track.
- `docs/design/` reorganized into layer subfolders (allegretto/,
  extension/, standard/, vivace/, platform/), each README a **boundary
  contract**. `grammar-formalism.md` and `proving-in-allegro.md` stay at
  `docs/` (Tier-0 + runtime references). Reference sweep across Tiers 1–3;
  one Tier-0 path touch-up (PROCESS §6 registry pointer) landed as a
  dedicated flagged commit (36197b8) and was maintainer-ratified 2026-07.
- Doc-reference lint (`scripts/doc-ref-lint.ts`) added and wired into the
  test suite — PROCESS §10 debt; caught and fixed 20+ dangling references
  (stale `memory/…` paths, archived-plan paths in CLAUDE.md/bench/primer).
- `BACKLOG.md` rebuilt: single list, stable IDs (B-001…B-086), sequenced
  head mirroring the structures implementation plan with revalidation
  items interleaved, banded tail by layer/track. V1 completed-items ledger
  converted to `V1-INVENTORY.md` (migration matrix: keep / revalidate /
  rework / drop / TBD per feature). Full v1 landing narratives remain in
  git history (pre-rebuild `BACKLOG.md`).
- Earlier in 2026-07 (same arc): v1-era plans archived with triage record
  (`.claude/plans/archive/README.md`); revalidation register established
  (now folded into the backlog as `[reval]` items); shipped
  grammar-extension decisions recovered into
  `docs/design/extension/grammar.md` §4; `structures.md` drafted from the
  D1–D40 design log; `structures-implementation.md` plan drafted
  (boundary-test-first).

## 2026-06 — Documentation governance (Tier-0 docs)

- Created `docs/VISION.md` and `docs/PROCESS.md` (Tier 0); `docs/design/`
  (type-system, effects, pattern-matching, grammar) promoted from
  `.claude/memory/` files and plan docs; promoted memory files shrunk to
  pointers; `.claude/plans/README.md` manifest added.
- Maintainer rulings recorded: descriptive plan-doc names supersede
  evocative codenames; `__` meta-property prefixes are accreted artifacts
  (redesign pending — `docs/design/standard/type-system.md` §4); parser alt-order
  significance is accreted, not intended (`docs/design/extension/grammar.md` §2);
  [impl, proof] pairs are participant-neutral, not AI-specific
  (`docs/VISION.md` §2).
- Recovered untracked deferred items: when-branch predicate refinement,
  brace/offside dual modes (to be filed in BACKLOG during the refactor).
