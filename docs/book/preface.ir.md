# IR: How this book is organized

Reader: RD-4
Purpose: document. The book's preface: how the book is organized and why, the invitation to follow each decision and try an alternative in code organized to match, and the principles that bind every author of the book.
Status: draft (count 1 closed at round 5: not readable; meta-review in docs/book/preface.review.md; asks A8 and A9 open; ask A7 ruled 2026-11-03; rulings of PR #157 applied 2026-11-03; unratified terms 0)
Source: chunk P0 of docs/plans/book-pass.md (the book pass, B-174); the organizing principles of its §2.6 and the rulings R10 to R16 of its §6, taken 2026-11-03; docs/book/units.md for the code as organized
Normative: yes
Footprint: docs/book/preface.md; docs/reading-order.json; docs/book/README.md; docs/book-changes.md; docs/documentation-census.md

## Terms

T1. Decision section. A section of the book that presents one decision, or a few tightly related decisions. anchor: #def-decision-section [decided: owner, 2026-11-03]

T2. Swappable decision. A decision for which trying another option replaces one unit of code behind the unit's interface. anchor: #def-swappable-decision [decided: owner, 2026-11-03]

T3. Foundational decision. A decision for which trying another option cascades through the decisions that depend on the foundational decision. anchor: #def-foundational-decision [decided: owner, 2026-11-03]

T4. Open decision. A decision the project has not yet taken. anchor: #def-open-decision [decided: owner, 2026-11-03]

T5. Unit. defined-at: units.md#def-unit [decided: D50]

T6. Intermediate representation. defined-at: https://github.com/majodali/methodology/blob/v1.6.0/docs/vocabulary.md#def-intermediate-representation [decided: the methodology vocabulary at v1.6.0]

## Claims

### Reader and authority

C1. The book is written for you: a working programmer who is curious about language design and new to Allegro's repository. reworded in count 1, round 1. [decided: owner, 2026-11-03]

C71. The table of contents marks each rewritten chapter. evidence: E9 reworded in count 1, round 3. [decided: owner, 2026-11-03]

C2. The principles of this preface also bind every author of the book, human or agent. [decided: owner, 2026-11-03]

### What the book is for

C3. This book explains the design of Allegro, a programmable language platform whose defining feature is provable correctness and safety. [decided: docs/book/vision.md §1]

C4. The book aims to present every design and implementation decision of Allegro with the options the decision weighed and the rationale for the option taken. reworded in count 1, round 2. [decided: owner, 2026-11-03]

C5. You are invited into the design of Allegro, which is still under way. reworded in count 1, rounds 1 and 2. [decided: owner, 2026-11-03]

C6. The code is organized so that you can branch the code to try another option for a decision, as the explore block of each decision section shows. reworded in count 1, round 5. [decided: owner, 2026-11-03]

C7. The tour that opens the book is not yet written. evidence: E2 split in count 1, round 5. [decided: owner, 2026-11-03]

C78. Most chapters do not yet follow the organization this preface describes. evidence: E1 split from C7 in count 1, round 5. [decided: owner, 2026-11-03]

C8. The chapters of the book are being rewritten to this organization one at a time. evidence: E1 reworded in count 1, round 3 and its confirmation. [decided: owner, 2026-11-03]

### Decisions in dependency order

C10. Decisions come in dependency order: a decision comes after the decisions it builds on. reworded in count 1, round 4. [decided: owner, 2026-11-03]

C11. Everything a decision rests on is therefore explained before the decision itself. [decided: owner, 2026-11-03]

C12. Among decisions that do not depend on each other, the more significant decision comes first. [decided: owner, 2026-11-03]

C62. The decisions that shape most of Allegro arrive as early as their dependencies allow. [decided: owner, 2026-11-03]

C13. The book opens with a tour of the few large choices that define Allegro, each choice pointing forward to its full treatment. restructured at round 4's confirmation, C9, C14 and C70 merged in. [decided: owner, 2026-11-03]

C77. After the tour, the book descends through the decisions in dependency order. the cut C15 reinstated at round 4's confirmation. [decided: owner, 2026-11-03]

C16. A concept is defined where the book first uses the concept or where the book settles the concept's meaning. reworded in count 1, round 1. [decided: owner, 2026-11-03]

C17. The book marks each concept at the concept's definition. [decided: docs/book/README.md, Term links]

C18. Every other chapter links its first use of a concept back to the concept's definition. [decided: docs/book/README.md, Term links]

C64. A concept never appears before the concept's meaning. [decided: owner, 2026-11-03]

### The seven blocks of a decision section

C19. A decision section presents one decision, or a few tightly related decisions. [decided: owner, 2026-11-03]

C20. Most decisions have a decision section of their own. [decided: owner, 2026-11-03]

C21. By default, a decision section has seven blocks, in this order. [decided: owner, 2026-11-03]

C22. The problem says what has to be decided. [decided: owner, 2026-11-03]

C23. The forces are the pressures that any answer must balance. [decided: owner, 2026-11-03]

C24. The options are the answers worth considering, each with its strengths and its costs. [decided: owner, 2026-11-03]

C25. The decision and rationale name the option taken, with the reasons for taking the option. [decided: owner, 2026-11-03]

C26. The consequences say what the decision makes possible and what the decision rules out. [decided: owner, 2026-11-03]

C27. The as-implemented block points to the unit of code that holds the decision. [decided: owner, 2026-11-03]

C28. The explore block says how to try another option in the code. [decided: owner, 2026-11-03]

C30. Not every decision needs all seven blocks: a decision taken for reasons of vision or aesthetics may need fewer. reworded in count 1, round 3, and at the ruling on A7. [decided: owner, 2026-11-03]

C31. The decision and rationale block may show how a rejected option fails. reworded in count 1, round 1. [decided: owner, 2026-11-03]

C32. The evidence of such a failure is an experiment written into the book, one experiment you can run again yourself. reworded in count 1, round 1, C68 and C65 merged in. [decided: owner, 2026-11-03]

C33. Nothing in the book, evidence included, is drawn from the project's history. reworded in count 1, round 3. [decided: owner, 2026-11-03]

### Swappable and foundational decisions

C34. A swappable decision is one for which trying another option replaces one unit of code behind the unit's interface. [decided: owner, 2026-11-03]

C35. A foundational decision is one for which trying another option cascades through the decisions that depend on the foundational decision. [decided: owner, 2026-11-03]

C36. Each decision section labels its decision swappable or foundational. [decided: owner, 2026-11-03, ruling on A7]

C74. The label depends only on what other decisions rest on the decision, whatever the decision's rationale. added at the ruling on A7. [decided: owner, 2026-11-03]

C75. Choosing an offside-rule grammar, where indentation marks block ends, for aesthetic reasons would likely be a swappable decision. split in count 1, round 4. [decided: owner, 2026-11-03]

C76. Choosing purely functional semantics for aesthetic reasons would be a foundational decision. split from C75 in count 1, round 4. [decided: owner, 2026-11-03]

C37. The label tells you what an alternative costs before you branch the code. [decided: owner, 2026-11-03]

### Open decisions

C38. An open decision is a decision the project has not yet taken. [decided: owner, 2026-11-03]

C39. Every open decision in the book takes one shared form. [decided: owner, 2026-11-03]

C72. The section of an open decision takes the seven blocks of a decision section, with the question still open in place of the decision and rationale. [decided: owner, 2026-11-03]

C40. Each open decision invites you to contribute an alternative. [decided: owner, 2026-11-03]

C41. The explore block of an open decision says how and where to contribute an alternative. reworded at the ruling on A4, 2026-11-03. [decided: owner, 2026-11-03]

### The code organized to match the book

C43. Where the code can manage it, a decision lives in one unit. [decided: owner, 2026-11-03]

C44. A unit is the smallest body of code that holds one decision, or a group of decisions that cannot be taken separately. evidence: E3 [decided: docs/book/units.md §2]

C45. A unit can be replaced by another unit that offers the replaced unit's interface. evidence: E3 [decided: docs/book/units.md §2]

C69. The replacement needs no edit to the units below the replaced unit. evidence: E3 [decided: docs/book/units.md §2]

C46. The code is divided into units today, each with the units it may depend on. evidence: E4 [decided: owner, 2026-11-03]

C47. A check in the project's test suite fails when a change adds an import that the order of the units forbids. evidence: E5 [decided: owner, 2026-11-03]

C48. Some source files still hold the decisions of several units. evidence: E6 [decided: owner, 2026-11-03]

### Two forms of each chapter

C50. Each chapter of the book has two forms, one for software agents and one for people. [decided: owner, 2026-11-03]

C51. The form for agents is an intermediate representation, a numbered list of claims. split in count 1, round 5. [decided: owner, 2026-11-03]

C79. Each claim is a single statement with the claim's evidence and pointers into the code. split from C51 in count 1, round 5. [decided: owner, 2026-11-03]

C52. A chapter's intermediate representation sits beside the chapter's prose, in a file whose name ends in `.ir.md`. evidence: E8 [decided: owner, 2026-11-03]

C53. The form for people is prose, like this preface. [decided: owner, 2026-11-03]

C54. The prose keeps every claim of the intermediate representation. [decided: owner, 2026-11-03]

C55. The prose aims to be clear and brief enough to hold your interest. reworded in count 1, round 1. [decided: owner, 2026-11-03]

### Tracking numbers and process detail stay outside the book

C59. The text of the book carries no tracking numbers. [decided: owner, 2026-11-03]

C60. Each decision and each chapter has a short, clear name instead of a number. [decided: owner, 2026-11-03]

C67. A name tells you what a decision is about without a lookup. [decided: owner, 2026-11-03]

C61. The numbers live in the intermediate representations and in the project's records, such as the project's decision register. reworded in count 1, round 1. [decided: owner, 2026-11-03]

C58. The project's process, measurements, file maps and studies live outside the book's narrative. split at round 3's confirmation, count 1. [decided: owner, 2026-11-03]

C73. That separation keeps the narrative on the design and its reasons. split from C58 at round 3's confirmation, count 1. [decided: owner, 2026-11-03]

### Clusters

G2. cluster: C3, C1, C4, C5, C6 [decided: owner, 2026-11-03]

G3. cluster: C7, C78, C8, C71, C2 [decided: owner, 2026-11-03]

G4. cluster: C10, C11, C12, C62 [decided: owner, 2026-11-03]

G5. cluster: C13, C77 [decided: owner, 2026-11-03]

G6. cluster: C16, C17, C18, C64 [decided: owner, 2026-11-03]

G7. cluster: C19, C20, C21 [decided: owner, 2026-11-03]

G8. cluster: C22, C23, C24, C25, C26, C27, C28 [decided: owner, 2026-11-03]

G9. cluster: C30 [decided: owner, 2026-11-03]

G10. cluster: C31, C32, C33 [decided: owner, 2026-11-03]

G11. cluster: C34, C35, C36, C74, C75, C76, C37 [decided: owner, 2026-11-03]

G12. cluster: C38, C39, C72, C40, C41 [decided: owner, 2026-11-03]

G13. cluster: C43 [decided: owner, 2026-11-03]

G14. cluster: C44, C45, C69, C46, C47 [decided: owner, 2026-11-03]

G15. cluster: C48 [decided: owner, 2026-11-03]

G16. cluster: C50, C51, C79, C52, C53, C54 [decided: owner, 2026-11-03]

G17. cluster: C55 [decided: owner, 2026-11-03]

G19. cluster: C59, C60, C67, C61 [decided: owner, 2026-11-03]

G18. cluster: C58, C73 [decided: owner, 2026-11-03]

## Relations

R2. C7 refines C4 because C4 states what the book presents, where C7 states how few chapters present the decisions in that organization today.

R3. C37 depends-on C34 because the cost of an alternative follows from whether trying the alternative replaces one unit, which C34 and C35 distinguish.

R4. C43 depends-on C44 because a decision can live in one unit only where the code is divided into units, as C44 and C46 state.

R5. C27 depends-on C43 because the as-implemented block can point to one unit only where the decision lives in one unit.

R6. C11 depends-on C10 because each decision is explained with its foundations only when every decision follows the decisions it builds on.

R7. C64 depends-on C16 because a concept defined at its first use is never met before its meaning.

## Evidence

E1. `docs/plans/book-pass.md` lines 59–60 and 409–411: the present chapters of the reading order are all still to be reviewed and rewritten, and chunk P2 rewrites the first pilot chapter to the principles.

E2. `docs/reading-order.json` lines 15–17: the first chapters after the preface are the introduction, a getting-started guide and a language reference, none of them the tour.

E3. `docs/book/units.md` lines 83–94: a unit holds one decision or one cohesive group of decisions, and can be replaced by another unit with the same interface.

E4. `scripts/analyze/units.json` lines 3–19: the manifest of units, each with its layer and its permitted dependencies, opening with the L0 units.

E5. `package.json` line 24 and `docs/book/units.md` lines 477–481: `npm run lint:units` runs `units --check`, which fails the gate on a new forbidden import edge.

E6. `scripts/analyze/units-baseline.json` lines 7–13: five source files recorded as mixed, each holding the decisions of several units.

E8. `docs/book/allegretto/evaluator.ir.md` beside `docs/book/allegretto/evaluator.md`, and `docs/book/preface.ir.md` beside `docs/book/preface.md`: a chapter's intermediate representation sits beside its prose.

E9. `docs/reading-order.json` line 8 and the Preface row of `docs/book/README.md`: the preface's entry carries `"organized": true`, and its table-of-contents row carries the marker *organized*.

## Asks

A1. Ratify in bulk the proposed claims: the claims about the book and the code as they stand (C7, C8, C46, C47, C48, C52), the reasons given for the principles (C11, C62, C64, C67), the claim on process detail with its reason (C58), the definitions (C19, C34, C35, C38) and the merged claim on experiments (C32) and the descriptions of the seven blocks (C22, C23, C24, C25, C26, C27, C28). Depends: C7, C8, C11, C62, C64, C32, C58, C67, C19, C22, C23, C24, C25, C26, C27, C28, C34, C35, C38, C46, C47, C48, C52.

A1 resolved: ratified by the owner at the merge of PR #157, 2026-11-03 (defaults); the listed claims carry decided provenance from that date.

A2. Ratify or strike the proposed terms decision section (T1), swappable decision (T2), foundational decision (T3) and open decision (T4). The plan ratified the first three concepts on 2026-11-03, as one term "swappable or foundational" for the second and third. The preface is their definition site in the book. Depends: C19, C34, C35, C38.

A2 resolved: ratified by the owner at the merge of PR #157, 2026-11-03 (defaults); the four terms carry decided provenance, and the preface is their definition site.

A3. Decide how a reader tells a chapter rewritten to this organization from one not yet rewritten. Proposed: each rewritten chapter's entry in `docs/reading-order.json` carries `"organized": true`, and the table of contents in `docs/book/README.md` marks the chapter. The preface then gains one claim saying that the table of contents marks each rewritten chapter. Depends: C7, C8.

A3 resolved: taken as proposed at the merge of PR #157, 2026-11-03; claim C71 added, the preface's reading-order entry and table-of-contents row marked.

A4. Decide the form every open decision takes. Proposed: the seven blocks of a decision section, with "decision and rationale" replaced by "the question still open", and with the explore block saying how to contribute an alternative and where to propose it. The preface then gains one claim stating the form. Depends: C39, C40, C41.

A4 resolved: taken as proposed at the merge of PR #157, 2026-11-03; claim C72 added and C41 reworded.

A5. Decide whether the preface shows one worked decision section, or points to one, once the pilot chapter exists. Round 1 of count 1 asked for it. Depends: C19, C21.

A5 resolved: taken as proposed at the merge of PR #157, 2026-11-03; the preface will point to the pilot chapter once that chapter exists; no text change now.

A6. Decide whether the preface keeps the sentence on how the prose is written (C56), given that process detail stays outside the book (C58). Strangers flagged C56 in count 1 at round 1's confirmation, as a contradiction, and at round 2, as a lost thread. The round 2 stranger disputes holding the passage: the sentence gives no reason why a reader needs it, so the thread stays lost whatever the ruling. The options are therefore to keep C56 and add the reader's gain, or to cut C56. The passage stays unchanged until the ruling. Depends: C55, C58.

A6 resolved: option (a) at the merge of PR #157, 2026-11-03; C56 cut from the IR and the prose, C55 kept.

A7. Decide whether a decision about vision or aesthetics carries the swappable-or-foundational label. Options: (a) every decision section carries the label (C36 as it stands); (b) the label applies only to decisions with an implementation, and a vision or aesthetics decision carries none. Recommended: (b). Round 3 of count 1 found C36 in possible contradiction with C30, C34 and C35. The passage stays unchanged until the ruling. Depends: C30, C34, C35, C36.

A7 resolved: option (a) with a correction, ruled by the owner on PR #161, 2026-11-03. Aesthetics describes a decision's rationale, never its outcome. Every decision section carries the label (C36), and the label follows from what other decisions rest on the decision (C74). C30 reworded; C74 and C75 added.

A8. Decide whether the aim sentence C55 keeps "enough to hold your interest" (the owner asked for an engaging book) or cuts it to "The prose aims to be clear and brief." Strangers flagged the phrase as excess in rounds 2, 3 and 4 of count 1, and round 4's stranger disputed the decline at confirmation. The passage stays unchanged until the ruling. Depends: C55.

A9. Decide the tour's place in the preface. The tour passage (C7, C13, C77) drew findings in all five rounds of count 1, under every structure tried. Options: (a) cut the tour from the preface until the tour is written; principle 4 stays in the plan, and the preface gains the tour's description when the tour exists; (b) keep the passage as it stands, with "will open" in C13; (c) the owner words the passage. Recommended: (a). The passage stays unchanged until the ruling. Depends: C7, C13, C77.
