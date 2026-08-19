# Classification

The binding declaration for `majodali/allegro` under
[majodali/methodology](https://github.com/majodali/methodology) —
field definitions and omission defaults per the methodology
[vocabulary](https://github.com/majodali/methodology/blob/main/docs/vocabulary.md).

- **C-tier**: C2 — serious project, pre-users
- **Pinned methodology version**: 1.0.0 (compliance target)
- **S-level**: S0 — public code only
- **Type**: `language/tool platform`
- **Target**: `static site` (allegrolang.org — landing page, sandbox,
  and the web-bundled interpreter, deployed via `deploy.sh`)
- **Workflow**: stages `in-dev → merged → live`; **`live` is the
  designated live-operation stage** (published at allegrolang.org;
  deploys are owner-run, never agent-run).
  Stage references in the Backlog: a checked entry is at `merged`
  unless it carries an explicit `[stage: live]` tag (used for entries
  whose public surface is deployed); an unchecked entry under active
  work may carry `[stage: in-dev]`. This convention is the project's
  declared manner of referencing stages, so designations stay current
  without restating the default on every entry.

## Deviation register

- **DEV-1** — deviates-from
  [W-006](https://github.com/majodali/methodology/blob/main/docs/rules/working-agreement.md#w-006--names-follow-outcomes-branches-are-single-use)
  (branches single-use, outcome-named), branch-naming half only.
  Remote agent sessions work on a harness-designated persistent branch
  (currently `claude/c2-3b-continuation-kdfq85`) that is restarted
  from `main` per deliverable arc rather than created fresh per
  deliverable. Plan and document naming follows W-006 in full.
  Rationale: the branch name is assigned by the session harness, not
  chosen by the agent; work lands on `main` by owner-merged PR either
  way. Revisit at the next review round — recorded 2026-08.

## Custom definitions

No custom definitions. (Candidate for a future entry: the `// expect:`
literate-demo convention in `tests/` and `demos/`, if audits want it
named; deferred until needed per Article 6.)

## Adoption transition (Article 7 sandbox designations)

The following materials are designated **`in-progress`** pending the
methodology-adoption arc
([docs/plans/methodology-adoption.md](plans/methodology-adoption.md));
designated 2026-08 — audits treat age as a finding:

- `CLAUDE.md` — monolithic (~600 lines) and holds authoritative
  architecture/invariant content, contra K-001/K-002; slims to a
  pointer bootstrap in chunk 3. Its Binding block is compliant now.
- `.claude/plans/` — active plan documents live here, contra K-007's
  `docs/plans/` home; relocation in chunk 3. New plans start in
  `docs/plans/` immediately.
- `.claude/memory/` — several design memos hold authoritative design
  content, contra K-001; audit-and-promote to `docs/design/` in
  chunk 3, after which the directory is strictly non-authoritative
  session cache (practice A6).
- `BACKLOG.md` — at repo root; Registers live under `docs/`;
  relocation in chunk 3 (it is otherwise K-003-compliant).
- Decision register — absent (decisions D1–D47, E-R, U-R, R-R live
  inside design docs and plan logs), contra K-004; `docs/decisions.md`
  is chunk 2.
