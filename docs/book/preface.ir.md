# IR: How this book is organized

Reader: RD-4
Purpose: document. The book's preface: how the book is organized and why, the invitation to follow each decision and try an alternative in code organized to match, and the principles that bind every author of the book.
Status: draft
Source: chunk P0 of docs/plans/book-pass.md (the book pass, B-174); the organizing principles of its §2.6 and the rulings R10 to R16 of its §6, taken 2026-11-03; docs/book/units.md for the code as organized
Normative: yes
Footprint: docs/book/preface.md; docs/reading-order.json; docs/book/README.md; docs/book-changes.md; docs/documentation-census.md

## Terms

T1. Decision section. A section of the book that presents one decision, or a few tightly related decisions. anchor: #def-decision-section [proposed: this IR]

T2. Swappable decision. A decision for which trying another option replaces one unit of code behind the unit's interface. anchor: #def-swappable-decision [proposed: this IR]

T3. Foundational decision. A decision for which trying another option cascades through the decisions that depend on the foundational decision. anchor: #def-foundational-decision [proposed: this IR]

T4. Open decision. A decision the project has not yet taken. anchor: #def-open-decision [proposed: this IR]

T5. Unit. defined-at: units.md#def-unit [decided: D50]

T6. Intermediate representation. defined-at: https://github.com/majodali/methodology/blob/v1.6.0/docs/vocabulary.md#def-intermediate-representation [decided: the methodology vocabulary at v1.6.0]

## Claims

### Reader and authority

C1. The reader of this preface is a working programmer who is curious about language design and has never seen Allegro's repository. [decided: owner, 2026-11-03]

C2. The principles of this preface bind every author of the book, human or agent. [decided: owner, 2026-11-03]

### What the book is for

C3. This book explains the design of Allegro, a programmable language platform whose defining feature is provable correctness and safety. [decided: docs/book/vision.md §1]

C4. The book presents every design and implementation decision of Allegro with the options the decision weighed and the rationale for the option taken. [decided: owner, 2026-11-03]

C5. Designing Allegro is an open journey that the book invites you to join. [decided: owner, 2026-11-03]

C6. The code is organized so that you can branch the code to try another option for a decision. [decided: owner, 2026-11-03]

C7. Most chapters of the book do not yet follow the organization this preface describes. evidence: E1 [proposed: this IR]

C8. The book is being rewritten to the organization of this preface one chapter at a time. evidence: E1 [proposed: this IR]

C9. The tour that is to open the book is not yet written. evidence: E2 [proposed: this IR]

### Decisions in dependency order

C10. A decision comes after the decisions it builds on. [decided: owner, 2026-11-03]

C11. You therefore meet each decision with everything the decision rests on already explained. [proposed: this IR]

C12. Among decisions that do not depend on each other, the more significant decision comes first. [decided: owner, 2026-11-03]

C62. You meet the decisions that shape the most of Allegro as early as their dependencies allow. [proposed: this IR]

C13. A tour opens the book by telling the big bets of Allegro as a story. [decided: owner, 2026-11-03]

C14. The tour points forward to the full treatment of each bet. [decided: owner, 2026-11-03]

C15. After the tour, the book descends through the decisions in dependency order. [decided: owner, 2026-11-03]

C63. The tour lets you see where the descent is going before the descent begins. [proposed: this IR]

C16. A concept is defined where the book first uses the concept or where the book decides the concept. [decided: owner, 2026-11-03]

C17. The book marks each concept at the concept's definition. [decided: docs/book/README.md, Term links]

C18. Every other chapter links its first use of a concept back to the concept's definition. [decided: docs/book/README.md, Term links]

C64. You therefore meet the meaning of each concept no later than the concept's first use. [proposed: this IR]

### The seven blocks of a decision section

C19. A decision section presents one decision, or a few tightly related decisions. [proposed: this IR]

C20. Most decisions have a decision section of their own. [decided: owner, 2026-11-03]

C21. By default, a decision section has seven blocks, in this order. [decided: owner, 2026-11-03]

C22. The problem says what has to be decided. [proposed: this IR]

C23. The forces are the pressures that any answer must balance. [proposed: this IR]

C24. The options are the answers worth considering, each with its strengths and its costs. [proposed: this IR]

C25. The decision and rationale name the option taken, with the reasons for taking the option. [proposed: this IR]

C26. The consequences say what the decision makes possible and what the decision rules out. [proposed: this IR]

C27. The as-implemented block points to the unit of code that holds the decision. [proposed: this IR]

C28. The explore block says how to try another option in the code. [proposed: this IR]

C29. The seven-block shape of a decision section is a default. [decided: owner, 2026-11-03]

C30. A decision about the language's vision or aesthetics may need fewer blocks. [decided: owner, 2026-11-03]

C31. An option's rationale may show how the option fails. [decided: owner, 2026-11-03]

C32. The evidence of a failure is an experiment written for the book and included in the book. [decided: owner, 2026-11-03]

C65. Any reader can run an experiment in the book again. [proposed: this IR]

C33. Nothing in the book is drawn from the project's history. [decided: owner, 2026-11-03]

### Swappable and foundational decisions

C34. A swappable decision is one for which trying another option replaces one unit of code behind the unit's interface. [proposed: this IR]

C35. A foundational decision is one for which trying another option cascades through the decisions that depend on the foundational decision. [proposed: this IR]

C36. Each decision section labels its decision swappable or foundational. [decided: owner, 2026-11-03]

C37. The label tells you what an alternative costs before you branch the code. [decided: owner, 2026-11-03]

### Open decisions as invitations

C38. An open decision is a decision the project has not yet taken. [proposed: this IR]

C39. Every open decision in the book takes one shared form. [decided: owner, 2026-11-03]

C40. Each open decision invites you to contribute an alternative. [decided: owner, 2026-11-03]

C41. The section of an open decision says how to make the contribution. [decided: owner, 2026-11-03]

### The code organized to match the book

C42. The code is organized to match the book. [decided: owner, 2026-11-03]

C43. Where the code can manage it, a decision lives in one unit. [decided: owner, 2026-11-03]

C44. A unit is the smallest body of code that holds one decision, or a group of decisions that cannot be taken separately. evidence: E3 [decided: docs/book/units.md §2]

C45. A unit can be replaced by another unit that offers the replaced unit's interface, without editing the units below the replaced unit. evidence: E3 [decided: docs/book/units.md §2]

C46. The code is divided into units today, each with the units it may depend on. evidence: E4 [proposed: this IR]

C47. A check in the project's test gate fails when a change adds an import that the order of the units forbids. evidence: E5 [proposed: this IR]

C48. Some source files still hold the decisions of several units. evidence: E6 [proposed: this IR]

C49. Such a file is split when its code is next changed for another reason. evidence: E7 [proposed: this IR]

### Two forms of each chapter

C50. Each chapter of the book has two forms, one for software agents and one for people. [decided: owner, 2026-11-03]

C51. The form for agents is an intermediate representation: numbered claims, each with its evidence and pointers into the code. [decided: owner, 2026-11-03]

C52. A chapter's intermediate representation sits beside the chapter's prose, in a file whose name ends in `.ir.md`. evidence: E8 [proposed: this IR]

C53. The form for people is prose, like this preface. [decided: owner, 2026-11-03]

C54. The prose keeps every claim of the intermediate representation. [decided: owner, 2026-11-03]

C55. The prose aims to be engaging, clear and succinct. [decided: owner, 2026-11-03]

C56. Writing the prose from the claims helps break the phrasing habits that agents fall into. [decided: owner, 2026-11-03]

C57. Many of those phrasing habits make text less clear. [decided: owner, 2026-11-03]

### Process detail and tracking numbers stay outside the book

C58. How the project is worked on lives outside the book's narrative: the project's process, its measurements, its file maps and its studies. [decided: owner, 2026-11-03]

C66. The book's narrative therefore stays on the design and the reasons for the design. [proposed: this IR]

C59. The text of the book carries no tracking numbers. [decided: owner, 2026-11-03]

C60. Each decision and each chapter has a short, clear name instead of a number. [decided: owner, 2026-11-03]

C67. A name tells you what a decision is about without a lookup. [proposed: this IR]

C61. The numbers live in the intermediate representations and in the project's registers. [decided: owner, 2026-11-03]

### Clusters

G1. cluster: C1, C2 [decided: owner, 2026-11-03]

G2. cluster: C3, C4, C5, C6 [decided: owner, 2026-11-03]

G3. cluster: C7, C8, C9 [proposed: this IR]

G4. cluster: C10, C11, C12, C62 [proposed: this IR]

G5. cluster: C13, C14, C15, C63 [proposed: this IR]

G6. cluster: C16, C17, C18, C64 [proposed: this IR]

G7. cluster: C19, C20, C21 [proposed: this IR]

G8. cluster: C22, C23, C24, C25, C26, C27, C28 [proposed: this IR]

G9. cluster: C29, C30 [decided: owner, 2026-11-03]

G10. cluster: C31, C32, C65, C33 [proposed: this IR]

G11. cluster: C34, C35, C36, C37 [proposed: this IR]

G12. cluster: C38, C39, C40, C41 [proposed: this IR]

G13. cluster: C42, C43 [decided: owner, 2026-11-03]

G14. cluster: C44, C45, C46, C47 [proposed: this IR]

G15. cluster: C48, C49 [proposed: this IR]

G16. cluster: C50, C51, C52, C53, C54 [proposed: this IR]

G17. cluster: C55, C56, C57 [decided: owner, 2026-11-03]

G18. cluster: C58, C66 [proposed: this IR]

G19. cluster: C59, C60, C67, C61 [proposed: this IR]

## Relations

R1. C9 refines C13 because C13 states that a tour opens the book, where C9 states that the tour is not yet written.

R2. C7 refines C4 because C4 states what the book presents, where C7 states how few chapters present the decisions in that organization today.

R3. C37 depends-on C34 because the cost of an alternative follows from whether trying the alternative replaces one unit, which C34 and C35 distinguish.

R4. C43 depends-on C44 because a decision can live in one unit only where the code is divided into units, as C44 and C46 state.

R5. C27 depends-on C43 because the as-implemented block can point to one unit only where the decision lives in one unit.

R6. C11 depends-on C10 because each decision is explained with its foundations only when every decision follows the decisions it builds on.

R7. C64 depends-on C16 because a concept defined at its first use is never met before its meaning.

R8. C66 depends-on C58 because the narrative holds only the design once the project's working detail lives outside the book.

## Evidence

E1. `docs/plans/book-pass.md` lines 59–60 and 409–411: the present chapters of the reading order are all still to be reviewed and rewritten, and chunk P2 rewrites the first pilot chapter to the principles.

E2. `docs/reading-order.json` lines 15–17: the first chapters after the preface are the introduction, a getting-started guide and a language reference, none of them the tour.

E3. `docs/book/units.md` lines 83–94: a unit holds one decision or one cohesive group of decisions, and can be replaced by another unit with the same interface.

E4. `scripts/analyze/units.json` lines 3–19: the manifest of units, each with its layer and its permitted dependencies, opening with the L0 units.

E5. `package.json` line 24 and `docs/book/units.md` lines 477–481: `npm run lint:units` runs `units --check`, which fails the gate on a new forbidden import edge.

E6. `scripts/analyze/units-baseline.json` lines 7–13: five source files recorded as mixed, each holding the decisions of several units.

E7. `docs/book/units.md` lines 73–75: the physical moves are not scheduled as a campaign, and each happens when its unit is next touched for another reason.

E8. `docs/book/allegretto/evaluator.ir.md` beside `docs/book/allegretto/evaluator.md`, and `docs/book/preface.ir.md` beside `docs/book/preface.md`: a chapter's intermediate representation sits beside its prose.

## Asks

A1. Ratify in bulk the proposed claims: the claims about the book and the code as they stand (C7, C8, C9, C46, C47, C48, C49, C52), the reasons given for the principles (C11, C62, C63, C64, C65, C66, C67), the definitions (C19, C34, C35, C38) and the descriptions of the seven blocks (C22, C23, C24, C25, C26, C27, C28). Depends: C7, C8, C9, C11, C62, C63, C64, C65, C66, C67, C19, C22, C23, C24, C25, C26, C27, C28, C34, C35, C38, C46, C47, C48, C49, C52.

A2. Ratify or strike the proposed terms decision section (T1), swappable decision (T2), foundational decision (T3) and open decision (T4). The plan ratified the first three concepts on 2026-11-03, as one term "swappable or foundational" for the second and third. The preface is their definition site in the book. Depends: C19, C34, C35, C38.

A3. Decide how a reader tells a chapter rewritten to this organization from one not yet rewritten. Proposed: each rewritten chapter's entry in `docs/reading-order.json` carries `"organized": true`, and the table of contents in `docs/book/README.md` marks the chapter. The preface then gains one claim saying that the table of contents marks each rewritten chapter. Depends: C7, C8.

A4. Decide the form every open decision takes. Proposed: the seven blocks of a decision section, with "decision and rationale" replaced by "the question still open", and with the explore block saying how to contribute an alternative and where to propose it. The preface then gains one claim stating the form. Depends: C39, C40, C41.
