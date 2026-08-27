# Plans manifest

Per `docs/PROCESS.md` §4: agents read this manifest before starting feature
work. Plans are outcome-named (K-007) and carry a Status line with the
K-007 transitions: `draft → active → (superseded by X, because Y |
closed → Backlog entry)`. "Closed" plans kept below retain record value
(chunk logs, delta logs) — their content is history, not current intent.

| Plan | Topic | Status | Notes |
|---|---|---|---|
| `concept-spine.md` | Define every salient Allegro concept in dependency order (definition / rationale / as-implemented / delta), then bring the code to the definitions | **draft** | Awaiting ratification. Motivated by measured documentation debt: 93 of 136 exported concepts undefined anywhere in `docs/design/`, and decisions recorded "executed" whose naming was done by alias only (`ContextValue` 701 uses vs `StructureValue` 2). The delta rows become the code campaign's work-list |
| `archive/structured-values-unification.md` | Structures design discussion — decision log D1–D46 | **archived (complete)** | Every decision executed or pinned to a named backlog owner; D39/B8/B10 tables inlined as `docs/design/allegretto/structures.md` Appendices A–C (B-002, 2026-08). Decision numbers remain citable. |
| `structures-implementation.md` | Structures unification implementation — phases 0–7, boundary-test-first | **closed → B-001…B-031** | Phases 0–7 + chunk C7.2 landed; M1 exited 2026-08; D39 residue zero; C7.2 rulings maintainer-ratified (R1 amended). Kept for §4 chunk records + §6 delta log until content promotion |
| `equality-and-laws.md` | B-027: equality protocol + lawful interfaces (structures.md §7–8) — kernel structural equals, declared coercions, law members, discharge tiers | **closed → B-027** | E-R1–E-R6 maintainer-ratified; chunks E1–E4 ALL landed 2026-08; residue → B-089. Kept for §6b chunk records |
| `units-dsl.md` | B-092: rung-2 units-of-measure physics DSL — dimensions as data + refinement-typed quantities, grammar sugar, domain-term errors, laws with honest tiers | **closed → B-092** | U-R1–U-R5 ratified; chunks U1–U4 ALL landed 2026-08. Kept for chunk records |
| `release-track.md` | B-090: public-release positioning — three-move cohesion frame, differentiator map D1–D7 + claims register, demo ladder rungs 1–4, website/docs derivation | **active** | INTERNAL — public copy derives only from `delivered`/`demoable` register tiers (VISION principle 17). R-R1–R-R5 ratified 2026-08 (R-R3–R-R5 at the B-090 sign-off). Companion Tier-0 amendment: VISION §1a + substrate/surfaces + principle 17 (ratified at B-090) |
| `visibility.md` | B-097: S3 mediated-member arc — D41/D42/D43 execution (pipeline, evidence capsule, private members, forgery E) | **closed** | all four chunks landed 2026-08 (V1 substrate, V2 pipeline, V3 flip, V4 hardening — forgery E live); riders with named owners (B-043/B-046/B-047, V-R3 reserved tiers) |
| `completion-effects.md` | B-028: completion effects & futures — D16/D31–D34 execution (`div` computed effect + D34 tiers, typed `Future[T]`, `is_resolved` as effect, D32 triggered guard, substrate hardening) | closed | CE-R1–CE-R8 ratified 2026-08; F1–F4 landed (PRs #24–#26 + F4 release PR); D16/D31–D34 EXECUTED; riders routed (B-047, B-048, D35, B-018, select/timers, precompile-inlining cutoff) |
| `parallel-lanes-process-delta.md` | Parallel-lane working model — the two Tier-0 PROCESS sentences the lane model depends on (§3 pre-ratified chunk sequences, §7 lanes) | **closed** | Tier-0 delta APPROVED and applied 2026-08 (PROCESS §3 per-lane exception, §7 lanes). Lane model itself lives in `docs/backlog.md` §"Parallel lanes" (Tier 2). Kept as the record of the proposal; maintainer intends to evaluate the lane model as a methodology amendment once the experiment yields evidence |
| `methodology-adoption.md` | B-095: classification + decision register + authority relocation under majodali/methodology v1.0.0 | **closed → B-095** | all four chunks landed 2026-08 (arc CLOSED at chunk 4: PR template, transition emptied, form audit); row was stale "active" until the 2026-08 B-028 plan pass — see the backlog B-095 entry for the full record |

## Archive

All v1-era plans (the pre-review push through provability Phase H) were
moved to `archive/` in the 2026-07 triage — see `archive/README.md` for
the per-plan triage record. Their unpromoted design content is indexed in
`docs/backlog.md` as the **`[reval]`-tagged entries** (the register was
dissolved into the one implementation-ordered list at the 2026-08 groom;
the backlog header states what working a `[reval]` item means); **do
not** treat archived plans as current design. Consumed so far: effects
nits (B-004), grammar formalism (B-003), totality (B-018,
`standard/totality.md`), contracts (B-014, `standard/contracts.md`).
Still open: PCP (B-029), roadmap remainder (B-051), planning DSL
(B-079).

Lifecycle (K-007): draft → active → (superseded by X, because Y |
closed → Backlog entry); closed plans move to `archive/` after durable
content is promoted and pending items are extracted to the Backlog.
