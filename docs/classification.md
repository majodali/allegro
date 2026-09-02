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

**D-1 — W-001, the per-chunk gate: pre-ratified lanes land a chunk
sequence without stopping between chunks.**

- **Rule**: [W-001 (two delivery modes, human-gated)](https://github.com/majodali/methodology/blob/main/docs/rules/working-agreement.md#w-001--two-delivery-modes-human-gated),
  fourth conjunct — agents MUST "gate every chunk on summary and human
  review".
- **Deviating practice**: `docs/PROCESS.md` §3 (feature lifecycle), the
  per-lane exception, and `docs/backlog.md` §"Parallel lanes" (gate policy
  per lane). A lane the maintainer declares pre-ratified runs an approved
  chunk **sequence**: the chunk list is agreed once at the start of the
  arc, and the lane lands the chunks in order without a per-chunk stop.
- **Rationale**: approval moves from per-chunk to per-sequence rather than
  being removed. The maintainer still sets the boundaries and still gives
  an explicit go-ahead, once, before the first chunk. The sequence stops on
  a failed check, on a scope change, and on a chunk that turns out to need
  a decision.
- **Recorded**: 2026-09-01, on the owner's instruction, after the practice
  was found to contradict W-001 with nothing recorded. It has been the
  declared practice since 2026-08 and was missed at the v1.4.0 migration
  assessment; W-001 did not change in v1.3.0 or v1.4.0, so the gap predates
  that migration.
- **Disposition**: temporary. W-001 (two delivery modes, human-gated)
  gained the pre-ratified sequence mode in methodology v1.5.0, with
  allegro as its evidencing instance, so this entry is no longer blocked
  on the amendment. The released W-001 text is stricter than the
  practice recorded above in two ways, so the entry does not retire at the
  1.5.0 migration: a chunk's landing summary carrying **asks** — anything
  requested of the human — is a stop condition, and asks are never rolled
  up across chunks (owner ruling, 2026-09-01); and only the human owner
  pre-ratifies, so a delegating agent may not pre-ratify a sequence it
  dispatches. This project's gate policy states three stop conditions and
  not the asks stop. It retires once the practice states all four, which
  needs a Tier-0 change to `docs/PROCESS.md` §3 and so the maintainer's
  sign-off — tracked as **B-131**.

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
