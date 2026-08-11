# Plans manifest

Per `docs/PROCESS.md` §4: agents read this manifest before starting feature
work. New plans use **descriptive names** with sequence identifiers.

| Plan | Topic | Status | Notes |
|---|---|---|---|
| `archive/structured-values-unification.md` | Structures design discussion — decision log D1–D46 | **archived (complete)** | Every decision executed or pinned to a named backlog owner; D39/B8/B10 tables inlined as `docs/design/allegretto/structures.md` Appendices A–C (B-002, 2026-08). Decision numbers remain citable. |
| `structures-implementation.md` | Structures unification implementation — phases 0–7, boundary-test-first | **landed** | Phases 0–7 + chunk C7.2 landed; M1 exited 2026-08; D39 residue zero; C7.2 rulings maintainer-ratified (R1 amended). Kept for §4 chunk records + §6 delta log until content promotion |
| `equality-and-laws.md` | B-027: equality protocol + lawful interfaces (structures.md §7–8) — kernel structural equals, declared coercions, law members, discharge tiers | **active** | E-R1–E-R6 maintainer-ratified 2026-08; §6 deltas pre-approved; chunks E1–E4 sequenced. Recon found `[1,2]==[1,2]` and `{x:1}=={x:1}` host-CRASH today (§2 table) |

## Archive

All v1-era plans (the pre-review push through provability Phase H) were
moved to `archive/` in the 2026-07 triage — see `archive/README.md` for
the per-plan triage record. Their unpromoted design content is indexed in
`BACKLOG.md` §"V1 revalidation register"; **do not** treat archived plans
as current design.

Lifecycle: draft → active → landed/superseded → `archive/` (after durable
content is promoted and pending items extracted to `BACKLOG.md`).
