---
name: allegro-project-state
description: Narrative arc pointer — current status lives in BACKLOG.md (and docs/CHANGELOG.md once created); inventory in CLAUDE.md
type: project
---
Allegro is a programmable language platform: Allegretto (base) + Allegro
Standard + Allegro Vivace (future). Vision: `docs/VISION.md`. Process:
`docs/PROCESS.md`.

**Narrative arc (high level):** foundation (parser, type system, modules,
runtime grammar extension) done; provability arc phases A–H substantially
landed (A introspection, B abstract domains, C contracts/invariants, D1
effects, E totality, F proof terms except F6 Lean export, G pilot, H1–H4b
PCP + benchmark); next: Vivace pilots working backwards from use cases
(planning DSL first), then D2–D5, I codegen, J review UX.

Don't cite test counts or file lists from memory — read CLAUDE.md /
BACKLOG.md. When asked "where are we?", answer in arc terms.
