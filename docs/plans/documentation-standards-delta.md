# Documentation written for the new reader: proposed methodology additions

> Status: **draft proposal**, first cut (maintainer request, 2026-10).
> Scope: additions to the methodology's P- rules (prose and presentation)
> and one working-agreement rule; to be taken up by `majodali/methodology`,
> not adopted here.
> Evidence: the B-112 plan `docs/plans/plane-interfaces.md` before its
> 2026-10 rewrite, and the five documents that defined the project's
> architectural abstractions without distinguishing them.

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
(`docs/design/architecture-vocabulary.md`) took two pages and resolved it.

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
requires promotion. A design document under `docs/design/` is never merged
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

## 6. What this does not propose

It does not propose that reports be written as documentation. W-008's
three-part report is the right shape for review and should stay.

It does not propose restyling the existing corpus in one pass. The style
guide's migration rule (highest-traffic documents first, per-document
editorial passes) applies; Allegro's first candidates are the plan this
proposal came from, the concept spine's Part 0, and the unit DAG document.

It does not propose a glossary per document. One vocabulary document per
project for cross-cutting abstractions, and a terms table only in a
document whose terms are its own.

## 7. Open questions for the methodology

1. Whether P-011's problem statement is a P- rule (presentation) or a K-
   rule (knowledge), since it governs content as much as form.
2. Whether promotion (§4) is a Designation transition the vocabulary
   should name, so audits can ask "which documents are unpromoted?"
3. Who the second reader in §4 is for a one-person project. The
   methodology may want to say that an agent session with no access to
   the conversation history is an acceptable stranger.
4. Whether the lints in §5 belong in the methodology's skeletons so every
   governed project gets them, or stay per project.
