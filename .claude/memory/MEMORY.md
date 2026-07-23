# Memory index

**Promotion rule (docs/PROCESS.md §8):** before writing memory, consider a
permanent home first — design decisions → docs/design/, process/feedback →
docs/PROCESS.md, status → BACKLOG.md / docs/CHANGELOG.md. Promoted files
below are thin pointers; do not expand them — update the canonical doc.

## Live session/user context
- [user_role.md](user_role.md) — User is the language designer; formal semantics focus; discuss design before implementation
- [feedback_tool_rejections.md](feedback_tool_rejections.md) — Tool rejections may be erroneous (interface bug); confirm verbally before treating one as deliberate
- [user_parser_experiments.md](user_parser_experiments.md) — External LL(k)+Pratt parser experiment deferred; codegen is scheduled as Phase I, not on hold
- [project_state.md](project_state.md) — Narrative arc pointer; defer to BACKLOG.md / CLAUDE.md for specifics

## Promoted (pointers to canonical docs)
- design_provability_thesis, design_vivace_vision, design_business_rules_define_domain, design_proof_exportability, feedback_review_and_redo → `docs/VISION.md`
- feedback_phase_delivery, feedback_test_modification, feedback_naming_conventions, feedback_claude_md, feedback_backlog_md, project_website_loop → `docs/PROCESS.md`
- design_type_system_meta_types, design_type_definitions → `docs/design/standard/type-system.md`
- design_effects_as_values → `docs/design/standard/effects.md`
- design_pattern_matching → `docs/design/standard/pattern-matching.md`
- design_brace_offside_modes → `docs/design/extension/grammar.md`
