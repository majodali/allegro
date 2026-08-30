# Design documents (Tier 1)

Durable design truth, one document per area, organized by **language layer**
(see `layers.md` — the architectural spine: layers, tracks, milestones).
Updated in the same PR as the change that alters the design (see
`docs/PROCESS.md` §3, deviation rule). Each layer folder's README is that
layer's **boundary contract** — what it provides, what it may depend on,
and the invariants the boundary tests enforce.

## Status convention

`concepts.md` uses its own per-entry **Delta** row instead of a status tag:
an entry states what the concept is and what the code does, and the delta
between them is either empty or owned by a backlog item. Everywhere else,
every section is tagged with its implementation status:

- **[implemented]** — shipped and tested; the doc describes current behavior
- **[partial]** — partly shipped; the doc says which parts
- **[designed]** — settled design, not yet built
- **[under revision]** — previously settled, now being redesigned (says why
  and what supersedes it)

## Structure

| Location | Layer / scope | Documents |
|---|---|---|
| `concepts.md` | **Definitional spine** | Every salient concept in dependency order (definition / rationale / as-implemented / delta). **Read this first.** T0–T1 written; T2–T5 pending (`docs/plans/concept-spine.md`) |
| `layers.md` | The spine | Layer model, capability tracks, milestone register |
| `implementation-map.md` | File-level spine | Per-file map of src/ + trees, the evalSource pipeline, async runtime surface |
| `allegretto/` | **L0** base language | `structures.md` (v2 design — draft pending sign-off); planned: `architecture.md` |
| `extension/` | **L1** extension substrate | `grammar.md`, `modules.md` (loading + module objects). Formalism spec stays at `../grammar-formalism.md` (referenced by Tier-0 PROCESS and by source code) |
| `standard/` | **L2** Allegro Standard | `type-system.md`, `core-types.md`, `effects.md`, `pattern-matching.md`, `totality.md`, `contracts.md`; planned, revalidation-gated (BACKLOG register): `proofs.md`, `pcp.md` |
| `vivace/` | **L3** Vivace | planned, revalidation-gated: `planning-dsl.md` |
| `platform/` | Capability tracks | planned as designed: `build-pipeline.md`, `tooling.md`, `host.md`, `codegen.md` |

Top-level consumables (not design truth, kept at `docs/`):
`../grammar-formalism.md` (Grammar 2 spec), `../proving-in-allegro.md`
(participant-neutral proving primer; loaded at runtime by the PCP LLM
worker), `../language-reference.md` (syntax by example),
`../getting-started.md`.
