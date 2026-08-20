# Memory index — NON-AUTHORITATIVE session cache

**K-001 (methodology, adopted 2026-08 — see `docs/classification.md`):
nothing in this directory is authoritative.** Files here cache session
and user context or point at project documentation; they never
substitute for it. A reader who ignores this directory entirely misses
nothing authoritative. Anything load-bearing found here is in the wrong
place and moves to `docs/` (practice A6; audited 2026-08,
`docs/plans/methodology-adoption.md` chunk 3 move 2).

**Before writing memory** (docs/PROCESS.md §8): consider a permanent
home first — design decisions → docs/design/ + `docs/decisions.md`,
process/feedback → docs/PROCESS.md, status → BACKLOG.md /
docs/CHANGELOG.md. Only session/user/external context belongs here.

## Session/user context (the legitimate residents)

- [user_role.md](user_role.md) — User is the language designer; formal semantics focus; discuss design before implementation
- [feedback_tool_rejections.md](feedback_tool_rejections.md) — Tool rejections may be erroneous (interface bug); confirm verbally before treating one as deliberate
- [user_parser_experiments.md](user_parser_experiments.md) — External LL(k)+Pratt parser experiment deferred; codegen is scheduled (B-072), not on hold
- [project_state.md](project_state.md) — Narrative arc snapshot; defer to BACKLOG.md / docs/CHANGELOG.md for specifics

## Retained pointer stubs (canonical text lives in docs/)

- design_provability_thesis → `docs/VISION.md` §2 (the thesis; all live
  citations retargeted 2026-08)
- design_proof_exportability → `docs/VISION.md` §2 + principle 16
  (kept: cited by two frozen archive plans)
- design_type_system_meta_types → `docs/design/standard/type-system.md`
  §2 (NOTE: the deferred-MI design it described was DISSOLVED by D44 —
  see `docs/decisions.md` D44)

The other thirteen 2026-06 pointer stubs were deleted at the 2026-08
audit after verifying their full content in the canonical docs
(VISION §4/§5, PROCESS §3–§9, design/standard/*, design/extension/
grammar.md §3) with zero inbound references.
