# Methodology adoption

Status: active

Outcome under development: Allegro classified and compliant under
majodali/methodology v1.0.0, with the K-001/K-002 authority relocation
completed and all transition designations cleared.

This is the first plan in `docs/plans/` — the K-007 home; the legacy
plans under `.claude/plans/` relocate here in chunk 3 and are
designated `in-progress` until then
([classification §Adoption transition](../classification.md#adoption-transition-article-7-sandbox-designations)).

## Context

Gap analysis performed 2026-08 against the seeded rule corpus
(K-/W-/M-/S-): the behavioral rules (W-001…W-005, K-003, K-006,
S-001/S-002) are already Allegro practice — several were extracted from
it. The gaps are structural: authority location (K-001/K-002), the
decision register (K-004), plan home and status grammar (K-007), and
the branch-naming half of W-006 (adopted in full at the chunk-1
gate — the drafted deviation was removed by owner ruling). The methodology repo's
own data on Allegro (practices §5, portfolio register) is stale on two
points — "no CI" and "no README" — both fixed pre-adoption; census
refresh is coordination item C below.

## Chunks

Chunk boundaries approved by the owner 2026-08. Each chunk ends at a
gate: summarize, wait for explicit go-ahead (W-001).

### Chunk 1 — Classification + Binding  ✅ landed (gate passed 2026-08)

`docs/classification.md` (C2 / S0 / language-tool-platform /
static-site, pinned 1.0.0, Workflow `in-dev → merged → live` with the
stage-reference convention, transition designations), the Binding
block in `CLAUDE.md`, this plan, and the Backlog entry.
Gate outcomes (owner, 2026-08): C2 confirmed; the stage-reference
convention confirmed; B-091 `[stage: live]` confirmed (rung-1 deploy
ran); the drafted DEV-1 was REMOVED in favor of adopting W-006 in
full — single-use outcome-named branches from the next deliverable.
Owner also flagged a tooling need: verifying WHICH version is deployed
(registered as B-096; feeds the Article 11 transitional-tooling
picture).

### Chunk 2 — Decision register (K-004)

A `decisions.md` register under `docs/` (path named in exact form once
the file exists — the doc-ref lint tracks only resolvable paths):
numbered one-line entries with status and a
pointer to the design note holding the reasoning, indexing the
existing decision corpus (D1–D47, E-R1–E-R6, U-R1–U-R5, R-R1–R-R5,
per-chunk rulings) without renumbering. Existing IDs remain citable.
Gate: owner samples entries for fidelity.

### Chunk 3 — Authority relocation (K-001/K-002/K-007)

The substantive arc, planned in detail at its own start: plans
`.claude/plans/` → `docs/plans/` (statuses normalized to the K-007
grammar; archive preserved); `.claude/memory/` design memos audited,
authoritative content promoted to `docs/design/`, remainder marked
session cache; `CLAUDE.md` slimmed to a ≤200-line pointer bootstrap
(history → `docs/CHANGELOG.md`, architecture detail → design notes);
`BACKLOG.md` relocates to a `backlog.md` under `docs/` with link
updates and a root tombstone note. Clears the transition designations.
Gate: per-move review; the CLAUDE.md slim-down is its own sub-gate.

### Chunk 4 — Close-out

PR template from the methodology skeleton; Risk register seeded from
real pressure only (perf hard threshold, sandbox age) if the owner
wants it; transition section emptied; coordination items delivered.
Gate: form-audit-style self-check against the rule corpus; owner
sign-off closes the plan to a Backlog entry.

## Coordination items (outside this repo)

- **C1** — portfolio register: Allegro's row updates from `implicit
  C0` to the declared summary (methodology repo PR or the owner's
  census pass).
- **C2** — practices §5 stale rows ("no CI", CLAUDE.md line count):
  amendment fodder for the next review round; propose per Article 8.
