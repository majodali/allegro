# L0 — Allegretto (boundary contract)

> Layer model: `docs/design/layers.md`. Milestone: **M1 Allegretto v2
> complete** (validated).

## Provides

Value kinds; expression DAGs; the recursive evaluator with partial
evaluation (Rule 1, Rule 2) and tail calls; forward-chaining /
future-cell completion; and — post-rewrite — **Structure** (slot plane +
channel plane), **Scope** (bindings, parent chain, facts plane),
**Symbols** (FQN identity), the channel-writer capability mechanism, and
the ~40 base primitives (`docs/design/allegretto/structures.md` §11).

## May depend on

The host runtime only (TypeScript/JS engine, web-standard APIs). Nothing
in L1–L3 or any track.

## Explicitly NOT in this layer

- **Types, proofs, effects, contracts** — all L2 extensions; the layering
  proof is that they are expressible entirely on this layer's public ops.
- **Concrete syntax** (maintainer ruling 2026-07): L0 is a specification;
  the parser that bootstraps it is external to L0 and belongs to L1 (it
  may exist informally before the substrate is formalized).
- **Environment capabilities** (`print`/`fetch`/`delay`) — host-provided
  (T-host), which is why they carry effect labels.

## Invariants (boundary-tested)

- No upward dependencies; no `__*` meta-slot escapes the registered set.
- Incompleteness never throws — unresolved means residual (structures.md
  §10).
- Channel origination requires the writer capability; propagation is
  evaluator-performed and authority-free (structures.md §3).
- Fact payloads and channel payloads are opaque to base ops.

Enforced by `src/boundary-tests.ts` (structures-implementation Phase 0).

## Documents

- `structures.md` — the v2 design (Structure/Scope/channels/symbols/kinds)
- `architecture.md` (planned) — evaluator, PE model, value-kind reference
