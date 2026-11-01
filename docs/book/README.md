# Design documents (Tier 1): the table of contents

Durable design truth, one document per area, read **in the order below**.
The order is dependency order, declared as data in
`../reading-order.json` (D52, the documentation book;
`../plans/documentation-book.md`): a document may define a term using only
terms defined earlier, and `npm run lint:docs` checks links to definition
anchors against it. Documents marked *lookahead* are introductions or
glossaries and may point forward by design. Updated in the same PR as the
change that alters the design (`docs/book/process.md` §3, deviation rule).
Each layer folder's README is that layer's **boundary contract**: what it
provides, what it may depend on, and the invariants the boundary tests
enforce.

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

## Term links

A term has one definition site, a heading preceded by
`<a id="def-<slug>"></a>`. Every other document links to it on first use:
`[plane](concepts.md#def-plane)`. The convention and the lints are in
`../plans/documentation-book.md` §4.1 and §4.2.

## Part I: foundations

| Order | Document | What it holds |
|---|---|---|
| I.1 | `../../README.md` (*lookahead*) | Introduction |
| I.2 | `getting-started.md` (*lookahead*) | First program to first verified program |
| I.3 | `language-reference.md` (*lookahead*) | Surface syntax by example |
| I.4 | `vision.md` (Tier 0) | Thesis, design principles |
| I.5 | `process.md` (Tier 0) | Lifecycle, quality guidelines, agent rules |
| I.6 | `architecture-vocabulary.md` (*lookahead*) | The six abstractions (layer, track, plane with field and channel, plane interface, actor and activity, unit), which question each answers, how they relate, the three senses of "capability" |
| I.7 | `layers.md` | Layer model, capability tracks, milestone register |
| I.8 | `units.md` | The implementation as the smallest independent units in a narrow DAG (D50/D51): decisions per unit, today's files mapped, the `Value` contract/kinds/assembly split, actors↔units misalignments, the move ledger. Measured by `scripts/analyze/index.ts units` |
| I.9 | `implementation-map.md` | Per-file map of `src/` and the other trees; the evalSource pipeline; the async runtime surface |
| I.10 | `actors-and-activities.md` | **Study, not settled design**: actors, the activity inventory, four worked crossings. Adoption is an open ruling |
| I.11 | `concepts.md` | **The definitional spine.** Part 0: requirements, specification choices, implementation choices, in the four-part entry shape. T0 to T5: every salient concept in dependency order (definition, rationale, as implemented, delta). Its analyses are the record `../records/concepts-analyses.md` |

## Part II: the units, in dependency order

| Order | Document | What it holds |
|---|---|---|
| II.1 | `allegretto/README.md` | L0 boundary contract |
| II.2 | `allegretto/structures.md` | Structures, scopes, channels, symbols, kinds: the v2 design |
| II.3 | *planned* | The kinds and the assembly (units 1 to 9); written when the `Value` union splits (`units.md` §7); until then the spine's T0 and T1 entries are the text |
| II.4 | `allegretto/metadata-and-capability.md` | The `metadata` and `capability` units: the metadata plane on every value, fields, channels, propagation, writer capabilities, installed meaning, the base's own fields. Definition site of *metadata field*, *channel*, *propagation* and *writer capability* |
| II.5 | *planned* | Scope (unit 12), at B-136 (scope leaves `Value`). Futures and the base primitives (units 14 and 15), which follow II.6 in the reading order, are planned too. Until then the spine's T2 entries and its §28 (future cell and completion) are the text |
| II.6 | `allegretto/evaluator.md` | The `evaluator` unit (13): evaluation, partial evaluation as implemented, application and substitution, tail calls, the scope carve-out, the install surface, the edges the unit still owes. Definition site of *tail call* |
| II.7 | `extension/README.md` | L1 boundary contract |
| II.8 | `grammar-formalism.md` | The grammar formalism (specification; implemented by `src/grammar2/`) |
| II.9 | `extension/grammar.md` | Grammar and parser: design decisions and goals |
| II.10 | `extension/modules.md` | Module loading and module objects |
| II.11 | `standard/README.md` | L2 boundary contract |
| II.12 | `standard/type-system.md` | The type system |
| II.13 | `standard/core-types.md` | The ten core types |
| II.14 | `standard/effects.md` | Effects |
| II.15 | `standard/pattern-matching.md` | Pattern matching |
| II.16 | `standard/totality.md` | Totality and termination |
| II.17 | `standard/contracts.md` | Contracts and invariants |
| II.18 | `vivace/README.md` | L3 boundary contract |
| II.19 | `vivace/planning-dsl.md` | The planning DSL, the first Vivace pilot (rung 3): the outcome-graph model, the twelve conventions, the rejections, the `SoftwareRelease` example, what Allegro provides today, the well-formedness checks. Definition site of *plan*, *plan node*, *wiring*, *failure handler* |
| II.20 | `platform/README.md` | Capability tracks; planned as designed: `build-pipeline.md`, `tooling.md`, `host.md`, `codegen.md` |
| II.21 | `platform/build-pipeline.ir.md` | The `pipeline` unit (33): the stage order of `evalSource`, what each stage may assume, the post-passes that halt, precompile, the phases and futures, the three moves the unit still owes; the multi-phase build surface tagged undesigned. Definition site of *the evalSource pipeline* (IR-only; rendered and reviewed at a later stage) |
| II.22 | `platform/tooling.ir.md` | The `introspect` and `cli` units (34 and 35): the file runner and the REPL, the subcommands `inspect`, `verify`, `obligations`, `propose` and `prove`, the safety grades, the four diagnostic variables; tracing and the IDE integration tagged not built. Definition site of *safety grade* (IR-only; rendered and reviewed at a later stage) |

Planned under L2, revalidation-gated (backlog register): `standard/proofs.md`,
`standard/pcp.md`.

## Part III: the thesis test

| Order | Document | What it holds |
|---|---|---|
| III.1 | `proving-in-allegro.md` | The participant-neutral proving primer; loaded at runtime by the PCP LLM worker |
| III.2 | *planned* | The demo ladder and the rung-3 pilot; today's content is the release-track plan, which is intent, not state |

## Appendices: registers and records

Outside the order check. `../decisions.md` · `../backlog.md` ·
`../CHANGELOG.md` · `../documentation-census.md` · `../audits.md` ·
`../../V1-INVENTORY.md` · `../records/concepts-analyses.md` (record: the analysis
passes and measured rulings behind Part 0 of the spine, moved out
verbatim 2026-10-20; read for the argument, the outcomes are in
`concepts.md` Part 0).
