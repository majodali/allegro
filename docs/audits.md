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
