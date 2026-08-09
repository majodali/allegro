# Plans manifest

Per `docs/PROCESS.md` §4: agents read this manifest before starting feature
work. New plans use **descriptive names** with sequence identifiers.

| Plan | Topic | Status | Notes |
|---|---|---|---|
| `archive/structured-values-unification.md` | Structures design discussion — decision log D1–D46 | **archived (complete)** | Every decision executed or pinned to a named backlog owner; D39/B8/B10 tables inlined as `docs/design/allegretto/structures.md` Appendices A–C (B-002, 2026-08). Decision numbers remain citable. |
| `structures-implementation.md` | Structures unification implementation — phases 0–7, boundary-test-first | **active** | Phases 0–7 landed; M1 exited 2026-08. Remaining: chunk C7.2 (kind residue — GenericType recipe, distinct/constructor specs, effect-var structure) per the BACKLOG tranche plan |

## Archive

All v1-era plans (the pre-review push through provability Phase H) were
moved to `archive/` in the 2026-07 triage — see `archive/README.md` for
the per-plan triage record. Their unpromoted design content is indexed in
`BACKLOG.md` §"V1 revalidation register"; **do not** treat archived plans
as current design.

Lifecycle: draft → active → landed/superseded → `archive/` (after durable
content is promoted and pending items extracted to `BACKLOG.md`).
