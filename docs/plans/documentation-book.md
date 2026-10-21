# The documentation as a book in dependency order (D52)

> Status: **active** — Phase 0 approved and landed 2026-10; Phases 1 to 3
> ride their owners. Owner: **D52** (the documentation book); backlog
> **B-150** (the document lints join the gate).
> Design docs touched: `docs/book/README.md` (now the table of
> contents), every definition site that gained a `def-` anchor.
> Related: `docs/plans/documentation-standards-delta.md` §6.5 and §6.6
> (the methodology additions this plan instantiates);
> `docs/documentation-census.md` (the findings it answers).

## 1. Context

The reader of this plan is the maintainer and the agent sessions that will
write chapters. It assumes `docs/book/architecture-vocabulary.md` (the
six abstractions) and `docs/book/units.md` §2 (what a unit is).

The census found fifty documents in uncertain reading order across several
folders, most written as reports to a reader who had followed the
conversation. The maintainer's goal is didactic: the project should be
highly informative to someone outside it. The proposal (maintainer,
2026-10) is a book: ordered chapters reflecting the process (vision,
requirements, specification, implementation) and then the unit DAG, with
implementation and test code separate but following the same structure.

The argument for the unit DAG applies to prose: one home per idea, no
forward references, an order the tooling can check. The book is that
discipline applied to documentation, and it forces documentation, design
and the unit-based implementation to conform to one logical structure.

## 2. Settled decisions

Agreed in discussion, 2026-10, and recorded as D52:

1. **The book follows dependency order, never an arbitrary didactic
   order.** A chapter may define a term using only terms defined in
   earlier chapters. Didactic freedom lives in the introduction and in
   examples, which may look ahead; the manifest marks such chapters
   `lookahead`.
2. **Registers keep their authority.** The backlog is prior to the book
   (it says what the book and the code still owe) and the decision
   register is the authoritative numbered record (K-004). The book holds
   reasoning and current state. Generated indexes into the book are
   fine; derivation of a register's status from the book is not.
3. **The book carries no history, but it carries deltas.** It is `active`
   in the methodology's sense: contradictions found in it are corrected,
   not marked; records (`docs/records/concepts-analyses.md` is the first)
   and the changelog hold history. Each entry's *As implemented* and
   *Delta* rows are current state and stay in the book, so it never
   describes a target as if it were the code.
4. **Plans stay out.** A plan is intent; the book is state. Book, backlog
   and plans remain three things.
5. **Ordered, not numbered.** Chapters have stable slugs; numbers are
   assigned at render time from the manifest.
6. **Rendering comes after content.** TOC, search, term links, executable
   examples and links into source are a build over Markdown with stable
   anchors. The cost of delay is real (the maintainer's reviews are more
   efficient against book plus code) and is accepted.
7. **The thesis test is Part III**, not displaced by the book.
8. **Part I and Part II may interleave.** Requirements do not belong to
   units, but some Allegretto specification may be complete before all
   Allegro or Vivace requirements are satisfied, so later chapters may
   still carry requirements that specify functionality the next units
   define. The division is a default, not a rule.

## 3. Out of scope

- A renderer, a search index, or any website change (Phase 3).
- Moving any design document in Phase 0.
- The chapter list for L1 and L2 beyond the manifest's current rows; the
  L2 unit grain is a first cut and chapters follow the bands as they
  settle.
- Restyling existing prose; that is the census migration list.

## 4. Phases

| Phase | What | When | Done when |
|---|---|---|---|
| **0. Order and links** | `docs/reading-order.json` declares the order; `docs/book/README.md` is the table of contents in that order; every definition site carries a `def-` anchor; first uses elsewhere link to it; `scripts/doc-lint.ts` checks anchors, forward references and bare identifiers | **Landed 2026-10** | anchors resolve; order check reports zero forward references; the lints run |
| **1. Part I** | Assemble vision, process, requirements (Part 0 of the spine), vocabulary, layers and the DAG as the foundation chapters; link pass; tombstone stubs where paths move | After Phase 0, before B-112 C1. **Split 2026-10-21**: the link and readability pass landed first (1a); the folder move (1b) waits on a Tier-0 amendment, because `PROCESS.md` §1 names the paths of the Tier-0 and Tier-1 documents and relocating them contradicts a Tier-0 statement (PROCESS §2: surface, do not resolve) | Part I readable in order with no forward references |
| **2. Part II, chapter by chapter** | Each unit band's chapter is written when its code moves (`units.md` §7): `metadata` and `capability` with the `slots.ts` split (B-112 C1); `evaluator` at B-112's exit; `scope` at B-136; the kinds with the `Value` split. A chapter takes definitions from the spine, reasoning from the area design note, examples from the `.alg` demos, and links to source and tests | In step with the unit moves | the spine's entries for that band live in the chapter; the manifest row has a `doc` |
| **3. Rendering** | The book as HTML on the website: TOC, search, term links, executable examples, registers as appendices, links into source | Once Part I and the L0 chapters exist | the website loop (PROCESS §9) |

### 4.0 Phase 1a, landed 2026-10-21: the Part I readability pass

Every Part I document except the two Tier-0 ones was given a reader
statement where it lacked one and had every first-use identifier named
(P-004) or its citation reworded. `units.md` was the priority-1 case from
the census: its header now states its reader and terms, and §1 states the
problem (requirement, challenge, approach) before the mechanism. The
`ids` lint learned three things from the pass: an identifier a document
defines itself (a table row or a bold definition) is never bare there;
`ID — name` and `ID: name` count as named; table rows inside blockquotes
are data. Part I bare identifiers after the pass: zero outside the Tier-0
documents, which are reported, not edited (`VISION.md` line 220 cites
backlog IDs bare).

**Phase 1b, the folder, landed 2026-10-21** after the Tier-0 amendment
(PR #75) made the reading order the authority on where Tier-1 documents
live. `docs/book/` holds the former `docs/design/` tree and the four
top-level chapters; `docs/records/` holds the record. Tombstone stubs
stand at every old path. The two Tier-0 documents stay at `docs/`; the
reading order points at them. Open from the Tier-0 PR's questions:
whether the constitution moves into the book, the R3′ naming exception,
and `VISION.md` line 220.

### 4.1 The term-anchor convention (Phase 0)

- A term has **one definition site**. The site is a heading preceded by
  `<a id="def-<slug>"></a>` on its own line. The slug is the term in
  lowercase with hyphens (`def-plane`, `def-metadata-field`); a Part 0
  entry uses its ID (`def-r2`, `def-sc-7`, `def-ic-3a`; `def-r3-prime`).
- Every **other** use of the term links to the site on first use in a
  document: `[plane](design/concepts.md#def-plane)`. A glossary
  (`architecture-vocabulary.md`) links to the sites too; it is never the
  site.
- Explicit anchors, not heading slugs, because headings get renumbered
  and reworded. The lint accepts either so that existing heading links do
  not break, and reports a link whose fragment matches neither.
- Sixty-four anchors exist at Phase 0: every tier entry and Part 0 entry
  in `concepts.md`, and the definition sites of layer, track, unit, actor
  and activity.

### 4.2 What the lints check (Phase 0)

`npm run lint:docs` (`scripts/doc-lint.ts`), report-only until B-150:

| Check | What | Deterministic |
|---|---|---|
| `anchors` | every link with a fragment resolves to an explicit anchor or a heading in the target | yes; the only one that can gate |
| `order` | a link to a `def-` anchor from a chapter earlier in the manifest than the defining chapter is a forward reference; `lookahead` chapters are exempt as sources | yes, given the manifest |
| `ids` | a bare first-use identifier (P-004) | heuristic; counts are approximate |

Day one: anchors 0, order 0, bare identifiers about 1,100 across the
governed documents (the backlog, changelog and spine hold most).

## 5. Verification

Per phase: `npm run lint:docs` and the doc-ref lint clean on anchors and
paths; the full suite when `package.json` or a script in the gate changes.
Phase 2 chapters additionally run the demos they embed, which the suite
already pins by `// expect:` comments.

## 6. Documents to update on landing

- Phase 0: this plan; `docs/book/README.md`; D52; B-150;
  `docs/plans/documentation-standards-delta.md` §6.5 and §6.6; CHANGELOG;
  CLAUDE.md commands and pointer.
- Phase 1: `docs/reading-order.json` rows gain `doc` values; tombstones;
  the census's type column for moved documents.
- Phase 2: `units.md` §4 status rows and the manifest row per band;
  `concepts.md` loses the entries the chapter absorbs, with a pointer.
- Phase 3: the website loop; `docs/messaging.md` if public copy changes.
