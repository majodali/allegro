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

In the tables below, *organized* marks a chapter rewritten to the
organization that the preface (`preface.md`) describes.

## Term links

A term has one definition site, a heading preceded by
`<a id="def-<slug>"></a>`. Every other document links to it on first use:
`[plane](concepts.md#def-plane)`. The convention and the lints are in
`../plans/documentation-book.md` §4.1 and §4.2.

## Preface

| Order | Document | What it holds |
|---|---|---|
| Preface | `preface.md` (*lookahead*, *organized*) | How this book is organized: decisions in dependency order after a tour, the seven blocks of a decision section, swappable and foundational decisions, open decisions as invitations, the code organized to match, the two forms of each chapter, what stays outside the book. Normative for every author of the book. Definition site of *decision section*, *swappable decision*, *foundational decision* and *open decision*. Beside it, `preface.ir.md` |

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
| II.4 | `allegretto/metadata-and-capability.md` | Metadata and the capability to write it, the `metadata` and `capability` units, as eleven decision sections (a dry run, not yet approved): fields are independent; metadata on every value; a field is a name and one propagation rule; origination needs the writer while reads and propagation are free; the fixed propagation vocabulary; writers are closures; trust without a seal; metadata at construction and the slot's owner; one-shot registration; refusal aborts. A final section holds propagation, the base's fields and the installs until their chapters are written. Definition site of *metadata field*, *writer capability*, *integrity field*, *propagation*, *fabricating rule*, *attenuation*, *abort* and, for now, *channel*. Beside it, `metadata-and-capability.ir.md` |
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
| II.19 | `vivace/planning-dsl.md` | The planning DSL, the first Vivace pilot (rung 3): the outcome-graph model, the twelve conventions, the rejections, the `SoftwareRelease` example, what Allegro provides today, the well-formedness checks. Definition site of *plan*, *plan node*, *wiring*, *failure handler*, *rung* and *demo ladder* |
| II.20 | `platform/README.md` | Capability tracks; planned as designed: `build-pipeline.md`, `tooling.md`, `host.md`, `codegen.md` |
| II.21 | `platform/build-pipeline.ir.md` | The `pipeline` unit (33): the stage order of `evalSource`, what each stage may assume, the post-passes that halt, precompile, the phases and futures, the three moves the unit still owes; the multi-phase build surface tagged undesigned. As-implemented home of *the evalSource pipeline* (definition site: the spine's §29) (IR-only; rendered and reviewed at a later stage) |
| II.22 | `platform/tooling.ir.md` | The `introspect` and `cli` units (34 and 35): the file runner and the REPL, the subcommands `inspect`, `verify`, `obligations`, `propose` and `prove`, the safety grades, the four diagnostic variables; tracing and the IDE integration tagged not built. Definition site of *safety grade* (IR-only; rendered and reviewed at a later stage) |
| II.23 | `platform/host.ir.md` | The T-host track, which has no unit: the Node CLI and the browser sandbox as host environments, the environment capabilities `print`, `delay` and `fetch` with the future manager, the browser-compatible core, the deployed site; the environment-capability contract cited from `allegretto/structures.md` §11; asynchronous I/O capabilities and browser packaging tagged not built (IR-only; rendered and reviewed at a later stage) |

Planned under L2, revalidation-gated (backlog register): `standard/proofs.md`,
`standard/pcp.md`.

## Part III: the thesis test

| Order | Document | What it holds |
|---|---|---|
| III.1 | `proving-in-allegro.md` | The participant-neutral proving primer; loaded at runtime by the PCP LLM worker |
| III.2 | `demo-ladder.ir.md` | The demo ladder and the rung-3 pilot: the three delivered rungs under `demos/` as the thesis test, what each rung shows, inherits and does not show, the scenes' pins in the suite; rung 4 named as direction only (IR-only; rendered and reviewed at a later stage) |

## Appendices: registers and records

Outside the order check. `../decisions.md` · `../backlog.md` ·
`../CHANGELOG.md` · `../documentation-census.md` · `../audits.md` ·
`../../V1-INVENTORY.md` · `../records/concepts-analyses.md` (record: the analysis
passes and measured rulings behind Part 0 of the spine, moved out
verbatim 2026-10-20; read for the argument, the outcomes are in
`concepts.md` Part 0) · `../records/book-pass/f1-readme.md` (record: the
book pass's review of the root `README.md`, chunk F1 of
`../plans/book-pass.md`) · `../records/book-pass/p2-allegretto-metadata-and-capability.md`
(record: the review of the pilot chapter, metadata and the capability to write it) ·
`../records/book-pass/dr1-part-1-the-bet.md` (record: the decision review of
Part I, the bet) · `../records/book-pass/dr2-part-2-the-kernel.md` (record: the
decision review of Part II, the kernel) ·
`../records/book-pass/dr3-part-3-syntax-and-modules.md` (record: the decision
review of Part III, syntax and modules) ·
`../records/book-pass/dr4-part-4-the-standard-language.md` (record: the decision
review of Part IV, the standard language) ·
`../records/book-pass/dr5-part-5-vivace.md` (record: the decision review of
Part V, Vivace) ·
`../records/book-pass/dr6-part-6-building-and-running.md` (record: the
decision review of Part VI, building and running programs) ·
`../records/book-pass/phase-1-close.md` (record: what phase 1 of the book pass
leaves) ·
`../records/book-pass/adversarial-review.md` (record: an adversarial review of
phase 1's decisions).
