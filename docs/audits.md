# Audit log

The Register recording each audit execution (methodology Article 9;
register type minted at v1.1.0 — optional for adopting projects, kept
here because entries exist). Machine-readable source for *time of last
semantic audit*, read by the Article 9 delta-ratio trigger and `mtool
status` when present.

Entry format: `date — kind (form | semantic) — scope — outcome —
findings pointer (or —)`.

- 2026-08 — form — full rule corpus at adoption close-out (B-095
  chunk 4): K-001–K-008, W-001–W-007, S-001/S-002 walked manually;
  K-009 and M-* n/a — pass (no findings, no deviations) — record in
  `docs/plans/methodology-adoption.md` §Chunk 4
- 2026-08-21 — form — full tree — audited a2dadd9 against methodology
  1.2.0 — 0 violations / 1 warning / 1 info — Article 8:
  `docs/classification.md` (version lag: pinned 1.1.0, latest 1.2.0 —
  migration pending); info: Workflow declared, format pending the
  methodology's open item. First
  [Audit delivery](https://github.com/majodali/methodology/blob/main/docs/audit-process.md)
  (`mtool audit form`; transition from the adoption-close-out pass —
  the lag warning appeared with the v1.2.0 release)
- 2026-08-24 — form — full tree — post-migration audit at the 1.2.0
  pin bump (PR #19, `migrate-1.2.0`) — 0 violations / 0 warnings —
  record in the migration commit (f021d83); clears the 2026-08-21
  Article 8 lag warning (register backfill: the migration PR recorded
  the audit in its commit message only)
