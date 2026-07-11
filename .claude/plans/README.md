# Plans manifest

Per `docs/PROCESS.md` §4: agents read this manifest before starting feature
work. New plans use **descriptive names** with sequence identifiers.

| Plan | Topic | Status | Notes |
|---|---|---|---|
| `structured-values-unification.md` | Structures design discussion — decision log D1–D40 | **landed (design)** | Promoted to `docs/design/allegretto/structures.md` (draft pending sign-off). Archives after the D39/B8/B10 tables are inlined into the design doc (see BACKLOG revalidation register). |
| `structures-implementation.md` | Structures unification implementation — phases 0–6, boundary-test-first | **draft** | Chunk boundaries pending maintainer approval; BACKLOG rebuild follows this plan |

## Archive

All v1-era plans (the pre-review push through provability Phase H) were
moved to `archive/` in the 2026-07 triage — see `archive/README.md` for
the per-plan triage record. Their unpromoted design content is indexed in
`BACKLOG.md` §"V1 revalidation register"; **do not** treat archived plans
as current design.

Lifecycle: draft → active → landed/superseded → `archive/` (after durable
content is promoted and pending items extracted to `BACKLOG.md`).
