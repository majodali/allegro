# Design documents (Tier 1)

Durable design truth, one document per area. Updated in the same PR as the
change that alters the design (see `docs/PROCESS.md` §3, deviation rule).

## Status convention

Every section is tagged with its implementation status:

- **[implemented]** — shipped and tested; the doc describes current behavior
- **[partial]** — partly shipped; the doc says which parts
- **[designed]** — settled design, not yet built
- **[under revision]** — previously settled, now being redesigned (says why
  and what supersedes it)

## Documents

| Doc | Area |
|---|---|
| `type-system.md` | Meta-types, type definition mechanisms, the meta-property protocol |
| `effects.md` | Effect system: schema, lattice, inference, subversion analysis |
| `pattern-matching.md` | `when/is/then`, destructuring, guards, deferred extensions |
| `grammar.md` | Parser & grammar-extension design decisions and goals (the formalism itself: `../grammar-formalism.md`) |
| `../grammar-formalism.md` | Grammar 2 formalism specification |
| `../proving-in-allegro.md` | Proving surface primer (participant-neutral; also the PCP LLM worker's system primer) |

Planned (created when their design discussions happen or content is
promoted): `architecture.md` (value kinds, evaluator, PE model),
`proofs.md` (discharge-strength taxonomy, proof-term design), `modules.md`,
`pcp.md`.
