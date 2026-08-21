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

No deviations recorded. (W-006 is adopted in full — owner ruling at
the chunk-1 gate, 2026-08: agent work uses single-use, outcome-named
branches, deleted after merge, from the next deliverable onward. The
harness-designated branch that carried the pre-adoption arcs merges at
that gate and retires the old practice.)

## Custom definitions

No custom definitions. (Candidate for a future entry: the `// expect:`
literate-demo convention in `tests/` and `demos/`, if audits want it
named; deferred until needed per Article 6.)

## Adoption transition (Article 7 sandbox designations)

**All designations resolved 2026-08** — no material remains
`in-progress` under the methodology-adoption arc
([docs/plans/methodology-adoption.md](plans/methodology-adoption.md)).
The resolution record below stands until the chunk-4 close-out
empties this section:

- `CLAUDE.md` — resolved 2026-08 (chunk 3 moves 3a+3b): every
  bootstrap-only fact promoted into `docs/` (v1-era history →
  CHANGELOG; core types, unification, modules, grammar surface,
  implementation map, language reference → new/extended docs), then
  slimmed to a ~135-line K-002 pointer bootstrap.
- ~~`.claude/plans/`~~ — resolved 2026-08 (chunk 3 move 1): the whole
  plans tree relocated to `docs/plans/`, statuses normalized to the
  K-007 grammar.
- `.claude/memory/` — resolved 2026-08 (chunk 3 move 2): audit found
  the 2026-06 promotion pass already moved all authoritative content
  to `docs/` — the residual exposure was five live citations pointing
  INTO `.claude/`, all retargeted; 13 zero-reference pointer stubs
  deleted; the directory now carries the A6 non-authoritative banner
  and holds only session/user/external context.
- Backlog — resolved 2026-08 (chunk 3 move 4): relocated from repo
  root to [docs/backlog.md](backlog.md) with all references updated
  and a root tombstone pointer; K-003-compliant throughout.

Resolved: the missing decision register (contra K-004) cleared at the
chunk-2 gate, 2026-08 — [docs/decisions.md](decisions.md) indexes the
existing corpus under original IDs.
