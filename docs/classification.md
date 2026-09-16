# Classification

The binding declaration for `majodali/allegro` under
[majodali/methodology](https://github.com/majodali/methodology) —
field definitions and omission defaults per the methodology
[vocabulary](https://github.com/majodali/methodology/blob/main/docs/vocabulary.md).

- **C-tier**: C2 — serious project, pre-users
- **Pinned methodology version**: 1.5.0 (compliance target;
  migrated from 1.4.0 on 2026-09-02 — v1.5.0 carries one migration
  note: a project with an Agent bootstrap copies W-008's prescribed
  block into it verbatim, done in `CLAUDE.md` in the same commit. The
  other five amendments ship migration-note `none`.)
- **S-level**: S0 — public code only
- **Type**: `language/tool platform`
- **Target**: `static site` (allegrolang.org — landing page, sandbox,
  and the web-bundled interpreter, deployed via `deploy.sh`)
- **Workflow**:

  `stages: in-dev → merged → live; live = live; backlog default: checked ⇒ merged, unchecked ⇒ in-dev`

  The live stage is published at allegrolang.org; deploys are
  owner-run, never agent-run. A Backlog entry departing from the
  default carries an explicit `stage:` marker — `[stage: live]` for an
  entry whose public surface is deployed, `[stage: in-dev]` for one
  under active work. Reworded to the canonical form at the v1.4.0
  migration (methodology vocabulary, *Workflow*); the three parts were
  already present in substance.

## Deviation register

No deviations recorded. **D-1** (W-001, the per-chunk gate) was recorded
2026-09-01 and **retired 2026-09-05**: methodology v1.5.0 released the
pre-ratified sequence mode with allegro as its evidencing instance, and
`docs/PROCESS.md` §3 now states all four of the released rule's stop
conditions — the two it already carried, plus a failed check and a chunk
whose landing summary carries asks. The practice and the rule agree, so
there is nothing left to deviate from. Owner: B-131, closed.

*(W-006 is adopted in full — owner ruling at the chunk-1 gate, 2026-08:
agent work uses single-use, outcome-named branches, deleted after merge.
Extended 2026-09-01: a merged PR is the approval signal, open questions
update the same branch and its PR, and a new branch waits for the merge.)*

## Custom definitions

No custom definitions. (Candidate for a future entry: the `// expect:`
literate-demo convention in `tests/` and `demos/`, if audits want it
named; deferred until needed per Article 6.)

## Adoption transition (Article 7 sandbox designations)

No active designations. The four designations opened at adoption
(CLAUDE.md, plans home, memory, Backlog location) were all resolved
2026-08 by the authority-relocation arc; the resolution record lives
in [docs/plans/methodology-adoption.md](plans/methodology-adoption.md)
and `docs/CHANGELOG.md` (B-095).
