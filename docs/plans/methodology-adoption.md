# Methodology adoption

Status: closed → Backlog entry B-095 (chunk-4 gate, 2026-08 — owner
sign-off is the merge of the close-out PR)

Outcome under development: Allegro classified and compliant under
majodali/methodology v1.0.0, with the K-001/K-002 authority relocation
completed and all transition designations cleared.

This was the first plan in `docs/plans/` — the K-007 home; the legacy
plans relocated here from `.claude/` in chunk 3 move 1
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

### Chunk 2 — Decision register (K-004)  ✅ gate passed 2026-08

[docs/decisions.md](../decisions.md): numbered one-line entries with
status and a pointer to the design note holding the reasoning,
indexing the existing decision corpus (D1–D47, E-R1–E-R6, U-R1–U-R5,
R-R1–R-R5, per-chunk rulings) without renumbering. Existing IDs
remain citable; new decisions continue the D-series (next: D48) in
the register. Statuses use K-004's vocabulary (accepted / superseded
/ deprecated) with execution state + backlog owner in parentheses.
Drafted 2026-08 on branch `decision-register` (the first W-006
single-use branch). Sweep side-finding, fixed at draft time: two
sources carried stale ruling statuses contradicting their own
ratification logs (structures.md said C7.2 R1–R3 pending; release
track §7 said R-R3–R-R5 awaiting sign-off) — both refreshed to match
the logs. Gate passed 2026-08 (owner sampled entries for
fidelity; register merged via PR #4).

### Chunk 3 — Authority relocation (K-001/K-002/K-007)

Four sequential moves, each on its own W-006 single-use branch with
its own PR — the owner's merge is the per-move review. Order chosen
so mechanical relocations land before judgment-heavy edits, and every
intermediate state keeps the doc-ref lint green.

**Move 1 — plans relocation (K-007)  [this PR]**: the whole
`.claude/plans/` tree (4 active plans + manifest + 12-file archive)
moves to `docs/plans/`, joining this plan. Status lines normalized to
the K-007 grammar (`draft → active → superseded | closed → Backlog
entry`): structures-implementation and release-track `active`;
equality-and-laws `closed → B-027`; units-dsl `closed → B-092`;
archived plans keep the archive README as their explicit closure
record. All ~85 repo references rewritten (docs, code comments, web
pages). The doc-ref lint's scan exclusion follows the archive to
`docs/plans/archive/`; its `.claude/plans/…` pattern is retained so
any reintroduced stale path dangles loudly. Transition designation
for `.claude/plans/` cleared.

**Move 2 — memory audit (K-001)  [this PR]**: all 21 files audited.
Finding that reframed the move: the 2026-06 promotion pass had already
moved every authoritative design memo into `docs/` (verified per file
against VISION §2/§4/§5, PROCESS §3–§9, design/standard/*,
design/extension/grammar.md) — zero promotions needed. The real K-001
exposure was five live citations pointing INTO `.claude/`
(CLAUDE.md ×3, proving-in-allegro.md, bench/README.md) — all
retargeted to `docs/VISION.md` §2 or deleted. Outcome: 13
zero-reference pointer stubs deleted; 8 files remain (4 session/user/
external context, 3 marked pointer stubs, index) under a new A6
non-authoritative banner in MEMORY.md. Two staleness bugs fixed en
route: CLAUDE.md's deferred-MI bullet contradicted the D44 line above
it (deleted), and `docs/design/standard/type-system.md` §2 still
described the pre-D44 `__extends` name-walk and dissolved MI design
(D44 supersession notes added). Side-fixes: VISION.md's dangling
"§Vivace Usability Research" anchor; B-072 gains the recorded
codegen-after-safety-machinery rationale. Transition designation for
`.claude/memory/` cleared.

**Move 3 — CLAUDE.md slim (K-002, own sub-gate)**: 676 lines → ≤200
pointer bootstrap. Split into two PRs after the coverage audit found
seven fact-clusters existing ONLY in CLAUDE.md (and that the
CHANGELOG's own stub promise — v1-era history migration — was never
executed). **3a (promotions, additive)  ✅ merged (PR #8)**: the ✅ v1-era
per-phase record migrated verbatim into `docs/CHANGELOG.md`; new docs
`docs/design/standard/core-types.md`,
`docs/design/extension/modules.md`,
`docs/design/implementation-map.md` (corrected per-file map +
evalSource pipeline + async runtime surface),
`docs/language-reference.md` (syntax by example);
`docs/design/standard/type-system.md` gains §Generics, §Function
types and unification, §Member descriptor shapes;
`docs/grammar-formalism.md` gains §6.4 (shipped `grammar { … }`
surface); platform README holds the T-build fragments. **3b (the slim
itself, the sub-gate)  [this PR]**: CLAUDE.md rewritten to a 135-line
pointer bootstrap
(Binding verbatim, doc map, build/run/test, architecture at a glance,
conventions/gotchas — kept because PROCESS §6 promises them there —
session contract, status pointers); the six doc citations that
pointed at deleted sections retargeted (type-system.md header + its
seven-kinds consistency note, pattern-matching.md, grammar.md,
structures.md, proving-in-allegro.md, project_state.md) and the
basics.alg test comment made self-owning; the CLAUDE.md transition
designation cleared. A reader ignoring CLAUDE.md misses nothing
authoritative.

**Move 4 — backlog relocation (K-003 home)  [this PR]**: `BACKLOG.md`
moved to `docs/backlog.md` (git rename, history follows); root
tombstone pointer left in place; every repo reference rewritten
(bootstrap, Tier-0 docs' mechanical path mentions, design docs, plan
manifest, memory index — archive left frozen). The last transition
designation cleared; classification's transition section now records
all four resolutions and empties at the chunk-4 close-out.

### Chunk 4 — Close-out  [this PR]

Delivered: PR template (practice D2) adapted to Allegro's test ladder
at `.github/pull_request_template.md`; classification's transition
section emptied (all designations resolved; record here + CHANGELOG);
consolidated B-095 CHANGELOG entry; the form audit and coordination
drafts below. Risk register NOT seeded — K-005 forbids registers
before pressure; the two known pressure points (perf hard threshold:
warn-only at 2×, maintainer decision pending since B-001; sandbox-age
audit finding) are recorded here as the seed material if the owner
wants the register.

**Form audit (2026-08, against the v1.0.0 rule corpus):**

- K-001 sole authority — PASS (chunk 3; memory carries the A6 banner).
- K-002 pointer bootstrap — PASS (135 lines; Binding block present;
  every removed fact verified in `docs/`).
- K-003 Backlog — PASS (`docs/backlog.md`; dependency-ordered; checked
  entries rewritten to what shipped; stage convention declared).
- K-004 decision register — PASS (`docs/decisions.md`, original IDs,
  K-004 statuses, supersession-not-silent-edit stated).
- K-005 companion registers — PASS (none seeded; pressure documented
  here first).
- K-006 design note per area — PASS (structures, type system, core
  types, effects, pattern matching, grammar, modules, layers,
  implementation map; planned notes tracked in `design/README.md`).
- K-007 plans — PASS (home `docs/plans/`, outcome names, K-007
  statuses, manifest; archive preserved with triage record).
- K-008 non-developer docs — PASS at current stage (getting-started,
  language-reference, proving primer, website + sandbox).
- K-009 hosted registers — N/A (C3 rule; project is C2).
- W-001 gated delivery — PASS (chunk gates; per-move PRs).
- W-002 tests are signals — PASS (append-only-in-spirit rule in
  bootstrap + PROCESS §6; suite green at every landing).
- W-003 docs move with the work — PASS (every move PR carried its doc
  updates; landing checklist enforces).
- W-004 provisional until reviewed — PASS (review-and-redo principle,
  VISION §5 p15; owner review on every PR).
- W-005 no unowned known issues — PASS (residues carry backlog owners:
  B-089, B-081, B-028, B-018…).
- W-006 outcome-named single-use branches — PASS (practice since the
  chunk-1 gate; five moves = five branches, deleted after merge).
- W-007 README — PASS (B-091).
- S-001/S-002 — PASS (no secrets in repo; S0 declared).
- M-001..M-003 — N/A (methodology-corpus rules).

**Coordination drafts (for majodali/methodology — C1/C2):**

- C1, portfolio register row (replaces allegro's `implicit C0` row):
  `| allegro | github.com/majodali/allegro | C2 / S0 /
  language-tool-platform / static-site — pinned 1.0.0 |
  [Classification](https://github.com/majodali/allegro/blob/main/docs/classification.md);
  adoption arc B-095 complete 2026-08 |`
- C2, practices §5 census corrections (propose per Article 8): A1 →
  ✅ (135-line pointer bootstrap); A3 → ✅ (docs/decisions.md); A6 →
  ✅ (audited, non-authoritative banner); A7 → ✅ (docs/plans/, K-007
  statuses); D1–D3 → 🟡→✅ (CI runs typecheck + full suite on
  push/PR since B-005; PR template added at B-095 chunk 4); "no
  README" note obsolete (W-007 met at B-091). Test-count reference
  "970+" → 1149 at 2026-08.

Gate: owner sign-off (merge) closes the plan; the plan's Status line
above flips with this PR.

## Coordination items (outside this repo)

- **C1** — portfolio register: Allegro's row updates from `implicit
  C0` to the declared summary (methodology repo PR or the owner's
  census pass).
- **C2** — practices §5 stale rows ("no CI", CLAUDE.md line count):
  amendment fodder for the next review round; propose per Article 8.
