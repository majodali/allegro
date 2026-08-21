# Methodology adoption

Status: active

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
pointer bootstrap (Binding block, what-it-is, build/run/test,
architecture at a glance, conventions, doc map). Every removed fact
must already live in `docs/` (CHANGELOG, design notes) or is promoted
there first in the same PR — a reader ignoring CLAUDE.md misses
nothing authoritative.

**Move 4 — backlog relocation (K-003 home)**: `BACKLOG.md` moves to
a `backlog.md` under `docs/`, root tombstone pointer, all references
updated;
remaining transition designations cleared (the section itself empties
in chunk 4).

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
