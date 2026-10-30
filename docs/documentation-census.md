# Documentation census

> Tier 2 register. One row per document under `docs/` plus the three
> root documents, typed and checked against the reader-facing duties
> proposed in `docs/plans/documentation-standards-delta.md`. Taken
> 2026-10-16 at the maintainer's request as the evidence for that
> proposal and as the migration list the methodology style guide calls
> for. Archived plans (`docs/plans/archive/`) are history and are not
> censused.
>
> **Row shape**: document · assigned type (§1) · reader · authority ·
> promoted · findings · priority. *Promoted* means the document has
> passed the comprehension pass in the proposal's §4 (reader stated,
> terms defined or cited, identifiers named, problem before solution):
> yes, no, or n/a for registers and consumables. *Priority* is the
> migration order: 1 first.
>
> **Method**: a script read every document for size, header form, bare
> identifiers (an ID such as `D23` or `R6` whose first use is not
> followed by a name), a reader statement in the first twenty lines, and
> sentences over 35 words. The bare-identifier count is a heuristic;
> bold and links defeat it, so it is reported as approximate. Type,
> reader and structural findings are judgements from reading the
> headers and section structure. The script is not kept; the proposal's
> §5 says what a permanent lint would check.

## 1. Document types observed

Types are named from instances, not from a scheme. A type with one
instance is still listed, because the instance exists. The methodology's
own artifact types are given where one applies.

| Type | Purpose | Reader | Methodology type | Instances |
|---|---|---|---|---|
| **Constitution** | the thesis and the process; changes only with maintainer sign-off | everyone | Design note (Tier 0 is an authority, not a type) | 2 |
| **Binding** | the project's classification under the methodology | auditors, agents | Classification | 1 |
| **Register** | uniform rows, scanned not read | maintainer, agents | Register | 7 (backlog, decisions, changelog, audit log, plans manifest, design index, v1 inventory) |
| **Conceptual model** | every concept defined in dependency order, levelled, with as-implemented and delta | a reader learning the system | Specification (closest) | 1 |
| **Vocabulary** | the abstractions the other documents are written in, distinguished | a reader of any design doc | none | 1 |
| **Spine or map** | a structural projection of the system: layers, files, units | a reader locating code or a dependency | Design note | 3 |
| **Boundary contract** | what a layer provides, may depend on, and forbids | a reader changing a layer | Design note | 5 |
| **Area design note** | durable design truth for one area, with status tags | a reader changing that area | Design note | 9 |
| **Specification** | behaviour stated to be implemented against | an implementer | Specification | 1 |
| **Study** | an exercise testing whether a model earns its keep; not settled design | the maintainer deciding adoption | none | 1 |
| **Feature plan** | context, settled decisions, chunks, verification for one outcome | the maintainer gating chunks; the agent landing them | Plan | 12 |
| **Stream plan** | a feature plan a stream runs from: outcome, oracle, file boundary, stop conditions, merge policy, chunk list and reserved backlog ids, opening with a machine-readable header a coordinating service reads (B-166 (the stream-plan document type); defined in `docs/plans/parallel-streams.md` §1, template `docs/plans/stream-plan-template.md`, checked by `npm run lint:streams`) | the session running the stream; a coordinating service; the maintainer gating it | Plan (a specialization) | 2 (added 2026-10-30) |
| **Methodology proposal** | an amendment drafted for `majodali/methodology` | the methodology's owner | Plan (closest) | 3 |
| **Consumable** | tutorial, reference or explanation for a user of the language | a language user | Specification (literate) or none | 4 |
| **Orientation** | the root README | a visitor | Readme | 1 |
| **Agent bootstrap** | commands, invariants, pointers | an agent session | Agent bootstrap | 1 |

Two types the methodology lacks and this project has: **vocabulary** and
**study**. One methodology type this project uses under a different name:
the **conceptual model** is a specification in the methodology's sense,
with a required entry shape the methodology does not define.

## 2. The census

Approximate bare-identifier counts are in the findings as "~N bare IDs".

### 2.1 Root and constitution

| Document | Type | Reader | Authority | Promoted | Findings | Priority |
|---|---|---|---|---|---|---|
| `README.md` | Orientation | visitor | Tier 2 | n/a | None. | 4 |
| `CLAUDE.md` | Agent bootstrap | agent | bootstrap | n/a | 224 lines against K-002's guideline of about 200. ~15 bare IDs, acceptable for a pointer document whose reader has the registers open. | 3 |
| `V1-INVENTORY.md` | Register | maintainer | Tier 2 | n/a | 44% of sentences over 35 words; rows are narrative (P-006). Six headers with em-dashes. | 3 |
| `docs/book/vision.md` | Constitution | everyone | Tier 0 | no | No reader statement. Line 220 cites backlog IDs bare (B-081 to B-086). Any change needs maintainer sign-off. | 4 |
| `docs/book/process.md` | Constitution | everyone | Tier 0 | no | Stale commands in §5 (landing checklist), `npx tsc --noEmit` and `npx tsx src/test.ts`: **fixed 2026-10-19** with maintainer sign-off. §10 (enforcement and tooling) said CI was still to be added and listed `tsc --noEmit`; CI exists (`.github/workflows/ci.yml`) and runs the typecheck script and the sharded suite: fixed in the same PR, flagged as beyond the §5 sign-off. Open: no reader statement; §1 names the paths of Tier-0 and Tier-1 documents, which blocks the book folder (D52 Phase 1b) until amended; §6's naming rule "never primes" is contradicted by the spine's R3. | 2 |
| `docs/classification.md` | Binding | auditors | binding | n/a | None. | 4 |

### 2.2 Registers

| Document | Type | Reader | Authority | Promoted | Findings | Priority |
|---|---|---|---|---|---|---|
| `docs/backlog.md` | Register | maintainer, agents | Tier 2 | n/a | 2,728 lines; entries of 100 to 400 words; 31% long sentences; ~250 bare IDs. Owned by **B-129** (P-006 row shape). No machine-readable blockers (**B-144**). | 2 (B-129) |
| `docs/decisions.md` | Register | everyone | Tier 2 | n/a | K-004 says one line per entry; D41 to D51 run 60 to 160 words with reasoning inline. 51% long sentences. ~67 bare of 144 IDs. | 2 |
| `docs/CHANGELOG.md` | Register | maintainer, agents | Tier 2 | n/a | 5,698 lines of landing reports kept as entries; 121 em-dash headers; ~208 bare IDs. Entries are reports (W-008 shape), not rows. The style guide exempts a register kept as history entry-by-entry when its header says so; the header does not. | 3 |
| `docs/audits.md` | Register | auditors | Tier 2 | n/a | None. | 4 |
| `docs/book-changes.md` | Register (book change log) | a reader with an older citation | Tier 2 | n/a | New 2026-10-21: every non-monotonic structural change to the book, dated; removed identifiers free for reuse. | 4 |
| `docs/plans/README.md` | Register (manifest) | agents | Tier 2 | n/a | Rows of 60 to 150 words; 51% long sentences; ~61 bare IDs. Status vocabulary inconsistent across rows: `closed`, `closed → B-120`, `COMPLETE`, `draft proposal`, `approved and applied`, against K-007's four transitions. | 2 |
| `docs/book/README.md` | Register (index) | agents | Tier 1 | n/a | Status convention defined here is used by 9 of 20 design documents. | 3 |

### 2.3 Design documents

| Document | Type | Reader | Authority | Promoted | Findings | Priority |
|---|---|---|---|---|---|---|
| `docs/book/concepts.md` | Conceptual model | learner | Tier 1 | partly | Part 0 **revised 2026-10-20**: the analysis passes moved verbatim to `concepts-analyses.md`; every R, SC and IC entry now has the four-part shape; §1.0 states the status of all twenty requirement IDs in one table; SC-6 marked superseded by D49; SC-7 and SC-8 entered as proposed specification items; R3′ renamed R3 and the retired identifiers moved to the record's §0 (2026-10-21). Remaining: the requirement set is still unratified as a set (an ask, not a defect); T0 to T5 entries keep their ~80 bare IDs and em-dash headers; 2,694 lines. | 2 |
| `docs/records/concepts-analyses.md` | Record | reader wanting the argument | Tier 1 (history) | n/a | New 2026-10-20; the first instance of the record type the standards proposal §6.2 asks for. Header declares it history, which exempts it from supersession marking entry by entry. | 4 |
| `docs/book/architecture-vocabulary.md` | Vocabulary | design-doc reader | Tier 1 | yes | None found. Reviewed by the maintainer 2026-10. | 4 |
| `docs/book/layers.md` | Spine | code locator | Tier 1 | partly (2026-10-21) | Reader statement added; identifiers named. Remaining: milestone table mixes status prose into cells. | 3 |
| `docs/book/implementation-map.md` | Spine (map) | code locator | Tier 1 | n/a | Register-shaped; reader statement added 2026-10-21. | 4 |
| `docs/book/units.md` | Spine | code locator | Tier 1 | **yes (2026-10-21)** | Reader statement and terms added; §1 restated as requirement, challenge, approach; every first-use identifier named. Remaining: six em-dash headers. | 4 |
| `docs/book/actors-and-activities.md` | Study | maintainer | Tier 1 (draft) | no | Correctly labelled a draft exercise. Mixes a model proposal (§3), an inventory (§4, §5a), worked crossings (§5) and findings (§6). Identifiers named 2026-10-21. Fine for a study; if adopted, the model part becomes a design note and the rest a record. | 3 |
| `docs/book/allegretto/README.md` | Boundary contract | layer changer | Tier 1 | n/a | Clean. Its invariant "fact payloads opaque to base ops" is false today (`units.md` M12); fixed by B-112 C1. | 3 |
| `docs/book/allegretto/metadata-and-capability.md` | Area design note (book chapter, Part II) | unit changer | Tier 1 | yes (written to the standard, 2026-10-21) | New: the first Part II chapter written to D52's shape; definition site of four terms moved out of `concepts.md`. | 4 |
| `docs/book/allegretto/structures.md` | Area design note | area changer | Tier 1 | no | 1,367 lines; ~82 bare IDs; 27% long sentences; title says "design decisions" but the body is the v2 design plus three appendices of executed tables. Status tags present. | 2 |
| `docs/book/extension/README.md` | Boundary contract | layer changer | Tier 1 | n/a | Clean. | 4 |
| `docs/book/extension/grammar.md` | Area design note | area changer | Tier 1 | no | Short; defers to `grammar-formalism.md`. | 4 |
| `docs/book/extension/modules.md` | Area design note | area changer | Tier 1 | no | ~6 bare IDs; otherwise clean. | 4 |
| `docs/book/standard/README.md` | Boundary contract | layer changer | Tier 1 | n/a | ~9 bare IDs in a 54-line contract. | 3 |
| `docs/book/standard/contracts.md` | Area design note | area changer | Tier 1 | no | ~22 bare IDs; CT-R rulings cited by ID. | 3 |
| `docs/book/standard/core-types.md` | Area design note | area changer | Tier 1 | n/a | Roster; clean. | 4 |
| `docs/book/standard/effects.md` | Area design note | area changer | Tier 1 | no | ~7 bare IDs. | 3 |
| `docs/book/standard/pattern-matching.md` | Area design note | area changer | Tier 1 | no | Clean; short. | 4 |
| `docs/book/standard/totality.md` | Area design note | area changer | Tier 1 | no | ~19 bare IDs; T-R rulings by ID. | 3 |
| `docs/book/standard/type-system.md` | Area design note | area changer | Tier 1 | no | ~20 bare IDs. Holds the meta-property registry (§4) that CLAUDE.md cites as an invariant. | 2 |
| `docs/book/platform/README.md` | Boundary contract | track reader | Tier 1 | n/a | Placeholder listing planned documents; ~5 bare IDs. | 4 |
| `docs/book/vivace/README.md` | Boundary contract | layer changer | Tier 1 | n/a | Placeholder; clean. | 4 |
| `docs/book/vivace/planning-dsl.md` | Area design note (book chapter, Part II) | pilot builder, reviewer | Tier 1 | yes (written to the standard, 2026-10-25) | New: the B-079 revalidation of the archived v1 planning-DSL design; definition site of four terms; status tags per section. | 4 |

### 2.4 Plans

| Document | Type | Reader | Authority | Promoted | Findings | Priority |
|---|---|---|---|---|---|---|
| `docs/plans/plane-interfaces.md` | Feature plan | maintainer, agent | plan | yes | Rewritten 2026-10; prerequisite `architecture-vocabulary.md`. | 4 |
| `docs/plans/host-plane-declaration.md` | Feature plan | maintainer, agent | plan | no | Draft; ~11 bare IDs; no terms section; §6 rulings pending. | 3 |
| `docs/plans/concept-spine.md` | Feature plan | maintainer, agent | plan | no | Active; ~63 bare IDs; 477 lines of which most is landed-chunk record. | 3 |
| `docs/plans/release-track.md` | Feature plan | maintainer, agent | plan | no | Active; 9 em-dash headers, 7 identifier-only headers; the differentiator map numbers its claims D1 to D7, colliding with the decision register (noted there). | 2 |
| `docs/plans/metadata-on-values.md` | Feature plan | record | plan | n/a | Status `COMPLETE`, not a K-007 transition. Closed plan not archived. | 3 |
| `docs/plans/entry-sequence-composite.md` | Feature plan | record | plan | n/a | Closed (→ B-120); not archived. | 3 |
| `docs/plans/structures-implementation.md` | Feature plan | record | plan | n/a | Closed; 796 lines kept for chunk records; not archived. | 3 |
| `docs/plans/equality-and-laws.md` | Feature plan | record | plan | n/a | Closed; not archived. | 3 |
| `docs/plans/completion-effects.md` | Feature plan | record | plan | n/a | Closed; not archived; 30% long sentences. | 3 |
| `docs/plans/visibility.md` | Feature plan | record | plan | n/a | Closed; not archived. | 3 |
| `docs/plans/units-dsl.md` | Feature plan | record | plan | n/a | Closed; not archived. | 3 |
| `docs/plans/methodology-adoption.md` | Feature plan | record | plan | n/a | Closed; not archived; ~43 bare IDs. | 3 |
| `docs/plans/parallel-lanes-process-delta.md` | Methodology proposal | record | plan | n/a | Applied 2026-08; kept as record. Status outside K-007's vocabulary. | 4 |
| `docs/plans/conceptual-model-methodology-delta.md` | Methodology proposal | methodology owner | plan | partly | Draft proposal; states its proposal and evidence first; no terms section. | 3 |
| `docs/plans/documentation-standards-delta.md` | Methodology proposal | methodology owner | plan | yes | This census is its evidence. | 4 |

**Eight closed plans remain in `docs/plans/`.** K-007 (plans are
outcome-named, statused, and ruthlessly current) says landed plans move to
the archive once their durable content is promoted and pending items
extracted. Each row above says "kept for chunk records"; the methodology
has no type for a chunk record, which is why they stay. Finding for the
proposal (§8 of the standards delta): a record type, or a rule that the
archive is where records live.

### 2.5 Consumables

| Document | Type | Reader | Authority | Promoted | Findings | Priority |
|---|---|---|---|---|---|---|
| `docs/book/getting-started.md` | Consumable (tutorial) | language user | Tier 2 | n/a | Clean. | 4 |
| `docs/book/language-reference.md` | Consumable (reference) | language user | Tier 2 | n/a | Decision and backlog IDs removed from the user-facing comments 2026-10-21. | 4 |
| `docs/book/proving-in-allegro.md` | Consumable (explanation) | language user, LLM worker | Tier 2 | n/a | Clean; loaded at runtime by the PCP worker. | 4 |
| `docs/book/grammar-formalism.md` | Specification | implementer | Tier 2 | no | Stale status "Draft for review. Not implemented" and a §6.4 bullet saying "Phase 1 in progress": **fixed 2026-10-19**; the header now names the implementation, what replaced what, and the four open gaps per `docs/book/extension/grammar.md` §3. Remaining: no reader statement; 1,014 lines; the shipped error and warning codes are not yet synced into §6 and §7 (tracked in the backlog's revalidation register). | 3 |
| `docs/messaging.md` | Consumable (copy source) | website author | Tier 2 | n/a | Clean; has a reader statement. | 4 |

## 3. Findings by class

| Class | Count | Examples | Owner |
|---|---|---|---|
| Written as a report, not promoted | 3 design docs, 3 active plans | `units.md`, `concepts.md` Part 0, `host-plane-declaration.md` | this census; rewrite rides the next chunk that touches each |
| Mixed document kinds under one type | 2 | `concepts.md` (model + analyses + proposals; **separated 2026-10-20**); `actors-and-activities.md` (study, acceptable) | done |
| Stale or false content in an active document (K-010) | 3 | `PROCESS.md` §5 commands (fixed 2026-10-19); `grammar-formalism.md` status (fixed 2026-10-19); `allegretto/README.md` facts invariant | done; done; B-112 C1 |
| Register rows that are narrative (P-006) | 4 | backlog, decisions, plans manifest, v1 inventory | B-129 for the backlog; the rest editorial |
| Closed plans not archived (K-007) | 8 | §2.4 | needs a record type or an archive rule |
| Status vocabulary outside K-007 | 4 | `COMPLETE`, `approved and applied`, `closed → B-120`, `draft proposal` | editorial once the vocabulary is ruled |
| Bare identifiers (P-004), approximate | 40 of 50 documents | highest: backlog ~250, changelog ~208, concepts ~89, structures ~82, units ~69 | lint (proposal §5), then per-document passes |
| No reader statement (P-007 proposed), heuristic | 42 of 50 | all design docs except `concepts.md`; the vocabulary's is implicit in its header | one line each, cheap |

## 4. What the census changes in the proposal

Recorded here so the proposal can cite it:

1. Two document types with instances and no methodology definition:
   **vocabulary** and **study**.
2. A **record** type is missing: eight closed plans stay in `docs/plans/`
   because their chunk records have nowhere to go.
3. The conceptual model needs an entry shape the methodology does not
   define, and the project's own instance violates its own shape in
   Part 0.
4. Tier 0, 1, 2 is an **authority** designation, orthogonal to type. The
   methodology's designations do not include it.
5. Rules that exist (P-004, P-006, K-007, K-010) hold in 10 of 50
   documents without a check. The lints in the proposal's §5 are not
   optional.
