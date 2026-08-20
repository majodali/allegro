# Plans manifest

Per `docs/PROCESS.md` §4: agents read this manifest before starting feature
work. Plans are outcome-named (K-007) and carry a Status line with the
K-007 transitions: `draft → active → (superseded by X, because Y |
closed → Backlog entry)`. "Closed" plans kept below retain record value
(chunk logs, delta logs) — their content is history, not current intent.

| Plan | Topic | Status | Notes |
|---|---|---|---|
| `archive/structured-values-unification.md` | Structures design discussion — decision log D1–D46 | **archived (complete)** | Every decision executed or pinned to a named backlog owner; D39/B8/B10 tables inlined as `docs/design/allegretto/structures.md` Appendices A–C (B-002, 2026-08). Decision numbers remain citable. |
| `structures-implementation.md` | Structures unification implementation — phases 0–7, boundary-test-first | **closed → B-001…B-031** | Phases 0–7 + chunk C7.2 landed; M1 exited 2026-08; D39 residue zero; C7.2 rulings maintainer-ratified (R1 amended). Kept for §4 chunk records + §6 delta log until content promotion |
| `equality-and-laws.md` | B-027: equality protocol + lawful interfaces (structures.md §7–8) — kernel structural equals, declared coercions, law members, discharge tiers | **closed → B-027** | E-R1–E-R6 maintainer-ratified; chunks E1–E4 ALL landed 2026-08; residue → B-089. Kept for §6b chunk records |
| `units-dsl.md` | B-092: rung-2 units-of-measure physics DSL — dimensions as data + refinement-typed quantities, grammar sugar, domain-term errors, laws with honest tiers | **closed → B-092** | U-R1–U-R5 ratified; chunks U1–U4 ALL landed 2026-08. Kept for chunk records |
| `release-track.md` | B-090: public-release positioning — three-move cohesion frame, differentiator map D1–D7 + claims register, demo ladder rungs 1–4, website/docs derivation | **active** | INTERNAL — public copy derives only from `delivered`/`demoable` register tiers (VISION principle 17). R-R1–R-R5 ratified 2026-08 (R-R3–R-R5 at the B-090 sign-off). Companion Tier-0 amendment: VISION §1a + substrate/surfaces + principle 17 (ratified at B-090) |
| `methodology-adoption.md` | B-095: classification + decision register + authority relocation under majodali/methodology v1.0.0 | **active** | Chunks 1–2 gate-passed 2026-08; chunk 3 (authority relocation) in progress — this manifest's own location is a chunk-3 move-1 outcome |

## Archive

All v1-era plans (the pre-review push through provability Phase H) were
moved to `archive/` in the 2026-07 triage — see `archive/README.md` for
the per-plan triage record. Their unpromoted design content is indexed in
`BACKLOG.md` §"V1 revalidation register"; **do not** treat archived plans
as current design.

Lifecycle (K-007): draft → active → (superseded by X, because Y |
closed → Backlog entry); closed plans move to `archive/` after durable
content is promoted and pending items are extracted to the Backlog.
