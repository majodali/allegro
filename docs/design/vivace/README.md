# L3 — Allegro Vivace (boundary contract)

> Layer model: `docs/design/layers.md`. Milestone: **M5 First Vivace pilot
> shipped** (aspirational; v1 design revalidation-gated).

## Provides

The model-driven layer: domain DSLs negotiated between humans and AI
agents and codified as grammar + type extensions; domain libraries with
provable semantics; eventually a parser generator capable of re-hosting
the L1 standard parser (maintainer ruling 2026-07).

## May depend on

L0–L2 public surfaces. A Vivace domain is "just" an L1 grammar extension
plus L2 types/contracts — the layer exists because the *methodology*
(model first, DSL as the contract, provability transitive from L2) is a
design discipline worth its own boundary, not because new machinery
appears.

## Invariants

- Domain DSLs introduce no new trust roots: their guarantees reduce to L2
  provability (transitive assurance, VISION §4).
- Vivace pilots are the validation instrument for the whole stack — a
  pilot that can't express its domain cleanly is a finding against the
  lower layers, to be surfaced, not worked around.

## Documents

- `planning-dsl.md` (planned, revalidation-gated — BACKLOG register;
  source: `.claude/plans/archive/project-1-planning-dsl-design.md`)
- Vision-level framing: `docs/VISION.md` §4 (Tier 0)
