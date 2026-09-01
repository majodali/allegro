# Plans manifest

Per `docs/PROCESS.md` §4: agents read this manifest before starting feature
work. Plans are outcome-named (K-007) and carry a Status line with the
K-007 transitions: `draft → active → (superseded by X, because Y |
closed → Backlog entry)`. "Closed" plans kept below retain record value
(chunk logs, delta logs) — their content is history, not current intent.

| Plan | Topic | Status | Notes |
|---|---|---|---|
| `conceptual-model-methodology-delta.md` | Conceptual model (requirement / specification / implementation, with traceability and deltas) as a permanent methodology practice | **draft proposal** | Awaiting sign-off, then submission upstream to `majodali/methodology`. Evidence is the concept-spine pilot: 93 of 136 concepts undefined, a decision recorded "executed" whose rename never happened (701 vs 2), 4 of 17 entries mis-levelled. §8 carries three process improvements adoptable independently |
| `concept-spine.md` | Define every salient Allegro concept in dependency order (definition / rationale / as-implemented / delta), then bring the code to the definitions | **active** | Ratified 2026-08 (rulings 1–3; ruling 4 held as an S3 delta). Motivated by measured documentation debt: 93 of 136 exported concepts undefined anywhere in `docs/design/`, and decisions recorded "executed" whose naming was done by alias only (`ContextValue` 701 uses vs `StructureValue` 2). **S1 landed** — `docs/design/concepts.md` T0–T1, 9 deltas → B-107. The delta rows are the code campaign's work-list |
| `metadata-on-values.md` | B-121: delete the carrier — metadata becomes a field on every representation kind, and values that will carry it are built with it (D48(b)(c)) | **COMPLETE 2026-08** | C1–C7 landed, suite 1202/1202; `primary`, `isCarrier`, `CarrierStructure`, `withMetadata` and `dataOf` all at zero. Two corrections to the plan as ruled: `withMetadata` was **one** operation rather than four, and §11's delta is left OPEN on purpose — the data plane now has no reader, which B-128 should re-open rather than inherit. The migration cost raised **B-127** and **B-128**; §5.1a–h is the record |
| `entry-sequence-composite.md` | B-120: a Structure becomes an ordered sequence of optionally-keyed entries; the map becomes an index below the specification (D48(a)) | **draft** | Awaiting ratification of §6 (five questions: which store is authoritative, duplicate keys, index policy, whether chunk E1 lands alone, sequencing against B-127). Five probes run before writing — notably **2254 of 2540** record structures have a `bindings` map and a `bindingList` that hold *different objects* for the same slot, and **0** of 166 dense structures ever materialize the legacy view the W6 invariant guards |
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
