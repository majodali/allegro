# Documentation written for the new reader: proposed methodology additions

> Status: **draft proposal**, first cut (maintainer request, 2026-10).
> Scope: additions to the methodology's P- rules (prose and presentation)
> and one working-agreement rule; to be taken up by `majodali/methodology`,
> not adopted here.
> Evidence: the B-112 plan `docs/plans/plane-interfaces.md` before its
> 2026-10 rewrite; the five documents that defined the project's
> architectural abstractions without distinguishing them; and the census
> of all fifty project documents in `docs/documentation-census.md`
> (2026-10-16), which §6 draws on.

## 1. What is being proposed

That the methodology distinguish two kinds of prose with different duties:

- **A report**: written for a reader who was in the conversation,
  reviewed once, and then superseded by what it reports on. W-008
  (reports map their deliverables) governs it.
- **Documentation**: written for a reader who was not in the conversation
  and may arrive years later. It must define its terms, state its problem
  before its solution, and name what it cites.

Today the methodology's P- rules apply to both, and that is right. What is
missing is that documents produced *as* reports become documentation by
being merged, without passing through the duties documentation carries.
The proposal adds those duties (§3) and a two-pass authoring process that
discharges them (§4).

## 2. The evidence

One plan, reviewed by the project's own maintainer, who is the most
informed reader it could have.

| Defect | Instance | Rule it violates today | Caught by a rule? |
|---|---|---|---|
| Section titles written for effect | "Why, stated precisely"; "The base holds the symbol, the layer installs the meaning" as a title | P-005 (headers state their contents) | rule exists; not applied |
| Principles stated as slogans | "The layer installs; the base never imports" with no standard name, no test | none | **no** |
| Terms undefined | "the base", "the layer", "the symbol", "the meaning" used from the first line | none | **no** |
| Identifiers cited bare | "SC-7", "R6", "D23/D24" with no name | P-004 (citations carry names) | rule exists; not applied |
| A measurement without its question | "The measurement: 131 imported symbols" with no statement of what it would demonstrate | none | **no** |
| Solution before problem | the hooks stated in §4; the requirement and challenge never stated | none | **no** |
| Five abstractions, no map | layers, tracks, planes, actors, units defined in five documents and distinguished in none | none | **no** |

Two conclusions. First, two of the seven defects already have rules, and
the rules were not applied, so a rule without a check does not hold under
session pressure. Second, five defects have no rule at all, and all five
are about the gap between a reader in the conversation and a reader
outside it.

The maintainer's framing: the documents had been working as reporting for
review, and were about to become permanent documentation that no one new
to the project could understand.

**The census generalises the finding.** `docs/documentation-census.md`
types all fifty documents and logs findings per document. Six design
documents and active plans are written as reports and unpromoted; two
documents mix kinds under one type; three active documents carry false
status or commands (K-010); four registers hold narrative rows (P-006);
eight closed plans are not archived (K-007); about forty of fifty cite
identifiers bare (P-004); forty-two have no reader statement. The
existing rules hold in about ten of fifty documents.

## 3. Proposed rules

Numbered provisionally after P-006; the methodology assigns final IDs.

### P-007: a document states its reader and prerequisites

*Statement.* A governed document MUST open with who it is for and what the
reader is assumed to know, with a link to where that knowledge is defined.
A document that assumes the conversation that produced it is a report, not
documentation.

*Rationale.* Every other duty in this proposal is relative to a reader.
Without naming one, "clear" has no test.

### P-008: terms are defined once and cited everywhere

*Statement.* A term that carries a project-specific meaning MUST have one
definition site. A document using the term MUST either be that site or
cite it on first use. A project with more than one cross-cutting
abstraction (layers, planes, actors) MUST keep a vocabulary document that
distinguishes them and says which question each answers.

*Rationale.* Allegro had six abstractions defined in five documents. Each
definition was sound; the relations between them existed only in the
maintainer's head. The vocabulary document
(`docs/book/architecture-vocabulary.md`) took two pages and resolved it.

*Overloads are findings.* A word used in more than one sense across the
corpus (Allegro's "capability" has three) MUST be listed in the vocabulary
document with the sense to prefer in each case.

### P-009: patterns and principles carry their standard names and a test

*Statement.* A principle MUST be stated as a norm, given the standard
software-engineering name for the pattern it applies where one exists
(dependency inversion, registry, capability-based security, strategy),
and given a test that would show it violated. A principle stated only as a
slogan is not a principle.

*Rationale.* A standard name imports a reader's existing understanding
and its known trade-offs. A test makes the principle falsifiable. "The
layer installs; the base never imports" became usable when restated as
dependency inversion by registration with the unit DAG as its check.

### P-010: a measurement states its question

*Statement.* A section that reports a measurement MUST state, before the
numbers, the question the measurement answers and what each outcome would
mean for the decision at hand. Method follows the question; numbers
follow the method.

*Rationale.* "131 imported symbols, 98 distinct" is a fact. "Of the base's
dependency on the typed layer, how much requires the base to decide and
how much to carry?" is the question, and the table only reads as evidence
once it is asked.

### P-011: design documents state the problem before the solution

*Statement.* A design document or plan MUST carry, before its mechanism, a
problem statement in three parts: the requirement it serves, the
challenge that makes the requirement hard, and the approach or pattern
chosen, with the alternatives it displaces. A hook, a schema or an API
introduced without the problem it solves is a report of a decision, not
the design.

*Rationale.* The conceptual-model proposal
(`docs/plans/conceptual-model-methodology-delta.md`) already asks for
requirement-to-implementation traceability per concept. This rule asks
the same of each document's own structure.

## 4. Proposed process: two passes, then promotion

A working-agreement rule, provisionally W-0xx.

*Statement.* Prose that will outlive the conversation that produced it is
written in two passes with a check between them:

1. **Semantic pass.** Get the content right: decisions, measurements,
   rulings, traceability. The style this pass produces is a report. It
   may cite bare identifiers and assume the conversation. It is reviewed
   for correctness.
2. **Validation.** Check the content against the definitions it depends on
   (P-008) and the problem it claims to solve (P-011). Unresolved
   references and undefined terms are findings, not style.
3. **Comprehension pass.** Restructure for the stated reader (P-007):
   headers that predict content, terms defined or cited, principles named
   and tested, measurements led by their questions, identifiers named.
   This pass changes presentation only; a change of substance sends the
   document back to pass 1.

A document is **promoted** from report to documentation when the
comprehension pass has run. A plan's `draft` status means pass 1; `active`
requires promotion. A design document under `docs/book/` is never merged
unpromoted.

*Rationale.* Trying to write for the new reader during the semantic pass
slows the work that needs the maintainer's attention. Skipping the
comprehension pass is how reports become permanent. Separating them lets
each be done well and makes "has this been promoted?" a question with a
yes or no answer.

*The reviewer's role.* The maintainer reviews pass 1 for substance. A
second reader, or the same reader after a gap, reviews pass 3 as a
stranger: can they state the document's problem, its terms and its
decision without having been in the conversation?

## 5. Checks that tooling can run

Two of the seven defects had rules and still landed. The methodology's
style guide already has an editing pass ("The editing pass", author's
duty, same session). Make the mechanical part of it a lint, so it fails
rather than relies on memory:

- **Bare identifiers.** A pattern like `D23`, `R6`, `SC-7`, `§6`, `W-006`
  or `B-112` whose first occurrence in a document is not followed by a
  parenthesised name or a link is a finding. Allegro's `doc-ref-lint`
  already walks every markdown file for path references; this is the same
  walk with a second pattern.
- **Headers.** A header containing an em-dash, a colon-plus-clause, or
  only an identifier is a finding against P-005.
- **Undefined bold terms.** A bolded term that is not a field label and
  has no definition sentence following it is a finding against P-003 and
  P-008.
- **Missing reader statement.** A governed document whose first section
  does not name its reader is a finding against P-007.

The checks are cheap and the false-positive rate is low because the
patterns are narrow. They do not replace the comprehension pass; they
make its mechanical part unskippable.

## 6. Documentation architecture: document types with content rules

Added 2026-10-16 after the census in `docs/documentation-census.md`. The
methodology's vocabulary already defines artifact types (Classification,
Register, Plan, Design note, Specification, Runbook), content types
(Entry, Requirement, Rationale, Status line) and relationship types
(`traces-to`, `implements`, `supersedes`, `defines / instance-of` and
five more). What it lacks is the link between them: nothing says what a
Design note must contain, what a Plan may not, or which relationships each
must carry. The census shows the cost. Fifty documents fall into fifteen
types by purpose and reader; the methodology names eight of them; and the
project's own Tier scheme, an authority attribute, has been standing in
for type.

### 6.1 Proposed rule: a document declares its type, and the type's content rules bind

*Statement.* Every governed document MUST declare its document type in
its header. Each type MUST be defined once, in the methodology's
vocabulary or in the project's custom definitions, with: purpose, reader,
required content types, forbidden content, the designations it may hold,
and the relationships it must carry. Authority (who may change the
document) is a separate designation and never a type.

*Rationale.* The B-112 plan's defects and the census's findings have one
cause: a document written as one kind and read as another. A declared
type gives the reader the contract and gives the form audit something to
check.

### 6.2 The document types, drawn from instances

Types the methodology has, with content rules proposed:

| Type | Required content | Forbidden content | Relationships |
|---|---|---|---|
| **Register** | header declaring row shape; uniform rows: what, when, status, pointer | reasoning; narrative | each row `traces-to` or points to a design note or plan |
| **Plan** | status line (K-007 transitions only); reader; terms used; problem statement; settled decisions; out of scope; chunks; verification; documents to update | design truth that outlives the plan (promote it) | `implements` a backlog item; `traces-to` design notes |
| **Design note** | status tags per section; reader; terms used or cited; problem statement per designed mechanism; as-implemented pointer | plan content (chunks, sequencing); landing history | `defines` concepts; `traces-to` decisions; `verifies` by named tests |
| **Specification** | the behaviour, stated to be implemented against; implementation status that is true | stale status | `implements` by named code; `verifies` by named tests |

Types the census found that the methodology lacks:

| Type | Purpose | Required content | Instances |
|---|---|---|---|
| **Vocabulary** | the abstractions a project's documents are written in, distinguished and related | one definition site per term by citation; which question each answers; relations; overloaded words with the term to prefer | `docs/book/architecture-vocabulary.md` |
| **Conceptual model** | every salient concept in dependency order, levelled, with as-implemented and delta (the companion proposal `conceptual-model-methodology-delta.md` defines the entry shape) | the entry shape for every entry, including the foundations | `docs/book/concepts.md`, whose Part 0 breaks its own shape |
| **Study** | an exercise testing whether a model earns its keep before adoption | a statement that it is not settled design; the question; the evidence; the open rulings | `docs/book/actors-and-activities.md` |
| **Record** | a closed plan's chunk log, a landing report, an analysis pass: history kept for its evidence | a header saying it is history (which exempts it from supersession marking entry by entry) | eight closed plans in `docs/plans/`; `docs/records/concepts-analyses.md`; every CHANGELOG entry |
| **Structural change log** | a register logging every non-monotonic structural change to a book's content: identifiers renamed, merged, removed, renumbered or reclassified; chapters moved, split or merged | date, kind, subject, from → to, pointer; newest first. Removed identifiers are free for reuse, so numbering stays dense (maintainer ruling 2026-10-21: a retired-identifier list leaves gaps and an inconsistent book; a dated log does not) | `docs/book-changes.md` |
| **Boundary contract** | what a layer or component provides, may depend on, and forbids | provides; may depend on; not in this layer; invariants with their enforcement | five layer READMEs |

The **record** type is the one that unblocks the most. K-007 says closed
plans move to the archive once promoted, and eight have not because
"kept for chunk records" has no type to move to. With a record type, the
rule becomes: a closed plan's durable content is promoted to design notes,
its chunk log is re-typed as a record, and records live in the archive.

### 6.3 Content types to add

Each is a section shape the comprehension pass (§4) produces, so the
rules in §3 have a named target:

| Content type | Fields | Rule it serves |
|---|---|---|
| **Reader statement** | who; what they are assumed to know; where that is defined | P-007 |
| **Terms table** | term; meaning here; definition site | P-008 |
| **Problem statement** | requirement; challenge; approach and displaced alternatives | P-011 |
| **Measurement** | question; what each outcome would mean; method; result | P-010 |
| **Principle** | statement; standard name; test; example | P-009 |
| **Change record** | per pass: date, what changed, what did not | the two-pass process, so a reader can tell which parts predate which review |

### 6.4 The project model is the horizon, with one constraint

The style guide names the owner's formal project-model horizon. The
census shows what the model would hold: the concept types the project's
content is made of (requirement, specification choice, implementation
choice, decision, component with layer, unit, actor and plane as its
kinds, interface, plan, chunk, measurement, finding) and the typed
relationships among them. This proposal does not define it. It asks for
one constraint when the methodology does: **a type is minted only when it
has at least one existing instance**, so Article 6 (every rule earns its
keep) holds for the model as it does for the rules. The census is the
instance list.

### 6.5 A project may declare a reading order, and it is checkable

Added 2026-10 after the maintainer's book proposal (D52).

*Statement.* A project MAY declare a reading order over its design
documents and conceptual model, as data. Where one is declared, the order
MUST be dependency order: a document may define a term using only terms
defined in documents earlier in the order. A document that is an
introduction or a glossary MAY be marked as looking ahead and is then
exempt as the source of a forward reference, never as the target.
Registers, records and plans are outside the order.

*Mechanics.* Each term has one definition site carrying a stable explicit
anchor (`<a id="def-…"></a>`); every other use links to it on first use in
a document (this is P-008's "cited everywhere" made concrete). A lint
resolves every anchored link and reports a link from an earlier document
to a `def-` anchor in a later one. Allegro's instance:
`docs/reading-order.json` and `scripts/doc-lint.ts`.

*Rationale.* The conceptual-model proposal already requires dependency
order inside one document. A reading order extends the same constraint
across documents, which is what turns a folder of interconnected
documents into something that can be read in sequence, and it is checkable
for the same reason the unit DAG is: the relation is data.

### 6.6 The book is a collection type, not a document type

*Statement.* A **book** is an ordered collection of a project's design
notes, specification and conceptual model, declared by a reading order
(§6.5). It is not a new document type: each chapter keeps its own type and
that type's content rules, and the authority designation applies per
chapter. The book carries reasoning and current state, including each
entry's delta against the code; it carries no history. A structural
change log (§6.2) accompanies it as an appendix, so an older citation can
be followed and a removed identifier reused. Registers remain
authoritative and are rendered as appendices; records and plans are
outside it.

*Rationale.* Allegro's instance (D52, `docs/plans/documentation-book.md`)
showed that the alternative, a book as a single document type, would
either duplicate the content rules of the types it contains or exempt
chapters from them. A collection type adds one thing, the order, and
leaves everything else as it is.

*Amendment to the companion proposal.* The conceptual-model proposal's
"a single dependency-ordered document" becomes "a single
dependency-ordered sequence, which may be a book's chapters".

### 6.7 What the census found about the rules that already exist

Four rules the methodology already has (P-004 citations carry names,
P-006 registers hold uniform rows, K-007 plans are current, K-010
superseded content is marked) hold in about ten of fifty documents. Two
of those four have been in force since v1.4.0. A rule without a check
does not survive the session that writes the document; the lints in §5
are therefore part of this proposal, not an optional appendix.

## 7. What this does not propose

It does not propose that reports be written as documentation. W-008's
three-part report is the right shape for review and should stay.

It does not propose restyling the existing corpus in one pass. The style
guide's migration rule (highest-traffic documents first, per-document
editorial passes) applies; Allegro's first candidates are the plan this
proposal came from, the concept spine's Part 0, and the unit DAG document.

It does not propose a glossary per document. One vocabulary document per
project for cross-cutting abstractions, and a terms table only in a
document whose terms are its own.

## 8. Open questions for the methodology

1. Whether P-011's problem statement is a P- rule (presentation) or a K-
   rule (knowledge), since it governs content as much as form.
2. Whether promotion (§4) is a Designation transition the vocabulary
   should name, so audits can ask "which documents are unpromoted?"
3. Who the second reader in §4 is for a one-person project. The
   methodology may want to say that an agent session with no access to
   the conversation history is an acceptable stranger.
4. Whether the lints in §5 belong in the methodology's skeletons so every
   governed project gets them, or stay per project.
5. Whether the document types in §6.2 are standard types or custom
   definitions under Article 7, and whether a project's authority tiers
   become a standard designation.
6. Where a record lives: the archive, as §6.2 proposes, or a
   `docs/records/` home so the archive stays for superseded content only.
