# Allegro — Changelog

> Tier 2. Append an entry per landed chunk (see `docs/PROCESS.md` §5).
> Newest first. Each entry: what landed, key decisions, deviations from
> plan, test count.

*Stub — the per-phase history currently embedded in `CLAUDE.md` ("What's
Next" / completed-items section) will be migrated here verbatim during the
2026-06 documentation refactor; new entries are appended here from now on.*

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
  dedicated flagged commit.
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
