# IR: The demo ladder and the rung-3 pilot

Reader: RD-4
Purpose: document. The book's Part III chapter on the demo ladder as the thesis test: the three delivered rungs under `demos/`, what each rung shows of the defining bet of `docs/book/vision.md` §1 and §2, what each inherits from the rung below, what each does not show, and what pins each scene.
Status: delivered IR-only (ratified at the merge of PR #145, 2026-11-02; unratified terms 0; footprint: declared 5, changed 5, surprises 0, misses 0)
Source: chunk A5 of docs/plans/book-chapters-now.md (stream A, B-170); demos/rung1/, demos/rung2/, demos/rung3/ and their pinning tests as the delivered state; docs/book/vision.md §1 to §2 as the thesis
Footprint: docs/book/demo-ladder.ir.md; docs/book/README.md; docs/reading-order.json; docs/documentation-census.md; docs/CHANGELOG.md; docs/plans/book-chapters-now.md

## Terms

T1. Rung. defined-at: vivace/planning-dsl.md#def-rung [decided: docs/book/vivace/planning-dsl.md, the Reader block, 2026-11-02]

T2. Demo ladder. defined-at: vivace/planning-dsl.md#def-demo-ladder [decided: docs/book/vivace/planning-dsl.md, the Reader block, 2026-11-02]

T3. Layer, with Allegretto as L0, Allegro Standard as L2 and Vivace as L3. defined-at: layers.md#def-layer [decided: docs/book/layers.md §1]

T4. Extension, a set of named bindings the execution context injects between the primitives and the source. defined-at: extension/modules.md#loading-l1 [decided: docs/book/extension/modules.md, Loading]

T5. Library, a module file under `lib/` that `ModuleLoader` loads into an extension, activated in a source by `use NAME`. defined-at: extension/modules.md#loading-l1 [decided: docs/book/extension/modules.md, Loading]

T6. Grammar block, a `grammar { … }` value that a library declares, whose rules join the parser when a source activates the library. defined-at: extension/grammar.md#4-runtime-grammar-extension-recorded-decisions-implemented [decided: docs/book/extension/grammar.md §4]

T7. Partial evaluation. defined-at: concepts.md#def-partial-evaluation [decided: docs/book/concepts.md §25]

T8. Residual. defined-at: concepts.md#def-resolved-unresolved-residual [decided: docs/book/concepts.md §26]

T9. Type. defined-at: concepts.md#def-type [decided: docs/book/concepts.md §30]

T10. Refinement, a type plus a predicate, such as `Int & _ > 0`. defined-at: concepts.md#def-refinement [decided: docs/book/concepts.md §35]

T11. Law. defined-at: concepts.md#def-law-and-coercion [decided: docs/book/concepts.md §39]

T12. Effect, a label such as `io`, `time`, `net` or `div`. defined-at: concepts.md#def-effect [decided: docs/book/concepts.md §40]

T13. Declared and inferred effects. defined-at: concepts.md#def-declared-and-inferred-effects [decided: docs/book/concepts.md §41]

T14. Discharge tier, with `admitted` the tier of a declared assumption. defined-at: concepts.md#def-divergence-and-discharge-tiers [decided: docs/book/concepts.md §43]

T15. Proof and discharge. defined-at: concepts.md#def-proof-and-discharge [decided: docs/book/concepts.md §44]

T16. Obligation. defined-at: concepts.md#def-obligation-verdict-and-the-assumption-ledger [decided: docs/book/concepts.md §45]

T17. Verdict. defined-at: concepts.md#def-obligation-verdict-and-the-assumption-ledger [decided: docs/book/concepts.md §45]

T18. Assumption ledger. defined-at: concepts.md#def-obligation-verdict-and-the-assumption-ledger [decided: docs/book/concepts.md §45]

T19. Contract, with `requires` the precondition and `ensures` the postcondition. defined-at: concepts.md#def-contract [decided: docs/book/concepts.md §46]

T20. Theorem, a named proposition that the build discharges, optionally with a proof term after `by`. defined-at: proving-in-allegro.md#stating-a-theorem [decided: docs/book/proving-in-allegro.md, Stating a theorem]

T21. Strict gate, the refusal of `proof_trans` over a custom equality whose transitivity is neither proven nor admitted. defined-at: proving-in-allegro.md#laws-discharge-tiers-and-the-strict-gate-e3e4 [decided: docs/book/proving-in-allegro.md, Laws, discharge tiers, and the strict gate]

T22. Safety grade. defined-at: platform/tooling.ir.md#def-safety-grade [decided: owner, 2026-11-02]

T23. PE-as-discharge, the first primary leg of the proof strategy. defined-at: vision.md#the-proof-strategy-three-legs [decided: docs/book/vision.md §2]

T24. [impl, proof] pair, the second primary leg of the proof strategy, with a prover the participant that produces the pair. defined-at: vision.md#the-proof-strategy-three-legs [decided: docs/book/vision.md §2]

T25. Participant-neutral protocol, the protocol through which every prover proposes. defined-at: vision.md#the-proof-strategy-three-legs [decided: docs/book/vision.md §2]

T26. Verification kernel, the single trust boundary that verifies every proposal. defined-at: vision.md#the-proof-strategy-three-legs [decided: docs/book/vision.md §2]

T27. Surface, a language built on Allegretto, with a DSL a narrow surface. defined-at: vision.md#1-what-allegro-is [decided: docs/book/vision.md §1]

T28. Vivace hypothesis. defined-at: vision.md#4-the-vivace-hypothesis [decided: docs/book/vision.md §4]

T29. Shape 1 and Shape 2: in Shape 1 a model is specified and verified in Allegro with execution external; in Shape 2 Allegro runs the model. defined-at: vision.md#4-the-vivace-hypothesis [decided: docs/book/vision.md §4]

T30. Plan. defined-at: vivace/planning-dsl.md#def-plan [decided: docs/book/vivace/planning-dsl.md §2.1]

T31. Plan node. defined-at: vivace/planning-dsl.md#def-plan-node [decided: docs/book/vivace/planning-dsl.md §2.2]

T32. Wiring. defined-at: vivace/planning-dsl.md#def-outcome-wiring [decided: docs/book/vivace/planning-dsl.md §2.3]

T33. Failure handler. defined-at: vivace/planning-dsl.md#def-failure-handler [decided: docs/book/vivace/planning-dsl.md §2.5]

T34. Choice, with template, resolution and solution finding. defined-at: vivace/planning-dsl.md#def-choice [decided: docs/book/vivace/planning-dsl.md §2.7]

T35. Catalog, with gap and completion. defined-at: vivace/planning-dsl.md#def-catalog [decided: docs/book/vivace/planning-dsl.md §2.8]

## Claims

### Reader and authority

C1. This chapter covers the three delivered rungs as the thesis test: what each rung shows, what each rung inherits, what each rung does not show. [decided: docs/plans/book-chapters-now.md §5, row A5, 2026-10-30]

C2. This chapter is delivered IR-only: no prose is rendered from this IR until a later stage that the maintainer schedules. [decided: docs/plans/book-chapters-now.md §3.1 and R8, 2026-10-30]

C3. This chapter states delivered state only, leaving out the claims register and the release-track plan's intent. [decided: docs/plans/book-chapters-now.md R2, 2026-10-30]

C4. Principle 17 of `docs/book/vision.md` keeps claims private until delivered. [decided: docs/book/vision.md §5, principle 17]

C5. This chapter is the definition site of two terms: rung; demo ladder. [decided: owner, 2026-11-02]

C145. The planning chapter `docs/book/vivace/planning-dsl.md`, chapter II.19, is the definition site of two terms that this chapter uses: rung; demo ladder. [decided: owner, 2026-11-02]

C6. Earlier chapters define every other term this chapter uses, each term linked from this chapter's Terms section. [decided: owner, 2026-11-02]

C7. The reader of this chapter has read Part I, Part II and the proving primer `docs/book/proving-in-allegro.md`, chapter III.1. [decided: owner, 2026-11-02]

C8. This chapter carries the Tier 1 authority that `docs/book/process.md` §1 gives every chapter of the book. [decided: docs/book/process.md §1]

C9. Each Claims sub-heading of this chapter after the first carries the status tag that `docs/book/README.md` defines. [decided: docs/book/README.md, Status convention]

C10. This chapter's examples are lines quoted from the nine `.alg` scenes, each quoted line present in a scene that the suite runs. evidence: E21, E22. [decided: owner, 2026-11-02]

C11. The planning chapter `docs/book/vivace/planning-dsl.md`, chapter II.19, holds the planning model that rung 3 uses, cited here without restatement. [decided: owner, 2026-11-02]

### The ladder as the thesis test [implemented]

C12. `demos/` holds three rungs: `demos/rung1/`, `demos/rung2/`, `demos/rung3/`. evidence: E1, E15, E24. [decided: owner, 2026-11-02]

C13. The README titles name each rung's subject: rung 1, verified code at AI velocity; rung 2, a provable DSL for units of measure; rung 3, a domain model the kernel checks and searches. evidence: E1, E15, E24. [decided: owner, 2026-11-02]

C14. Each rung's README tabulates the rung's scenes with what each scene shows. evidence: E1, E15, E24. [decided: owner, 2026-11-02]

C15. Each rung's README states that the test suite validates the rung's `.alg` scenes through their `// expect:` comments. evidence: E1, E15, E24. [decided: owner, 2026-11-02]

C16. Allegro's defining feature is provable correctness and safety. [decided: docs/book/vision.md §1 and §2]

C17. Correctness is the positive predicate family: code does what it should, through refinement types, predicate sets, contracts and invariants. [decided: docs/book/vision.md §2]

C18. Safety is the negative predicate family: code does not do what it should not, through effects, capabilities, information flow and behavioural budgets. [decided: docs/book/vision.md §2]

C19. Under PE-as-discharge, a predicate that partial evaluation reduces to `true` against residuals is discharged. [decided: docs/book/vision.md §2]

C20. Under the [impl, proof] pair, a prover produces an implementation with its proof, which the compiler verifies independently. [decided: docs/book/vision.md §2]

C21. The participant-neutral protocol treats humans, AI agents, hybrid workflows and tool-assisted provers as first-class participants. [decided: docs/book/vision.md §2]

C22. The verification kernel is the single trust boundary regardless of who proposes. [decided: docs/book/vision.md §2]

C23. Failed proofs and false declarations halt the build visibly, never degrading into warnings or error values. [decided: docs/book/vision.md §2, Build, don't derive]

C24. A safety or correctness feature that needs parallel infrastructure, instead of reusing predicate-set entailment and PE discharge, fails the thesis in implementation. [decided: docs/book/vision.md §2, the falsifiable design constraint]

C25. Rung 1 tests the thesis on ordinary code through five scenes: discharge; counterexamples; effects; laws with discharge tiers; the prover loop. evidence: E1. [decided: owner, 2026-11-02]

C26. Rung 2 tests the thesis on a domain language built as a library, with no host code of its own. evidence: E15, E28. [decided: owner, 2026-11-02]

C27. Rung 3 of the demo ladder tests the Vivace hypothesis on one domain model with three things: rich constraints; solution finding over the model; failures a non-programmer can read. [decided: docs/book/vivace/planning-dsl.md §1]

C28. Decision R-R4 set the ladder order, choosing units-of-measure physics as rung 2's domain for the bridge to rung 3. [decided: docs/decisions.md R-R4]

C29. This chapter counts a scene line as demonstrated only when the line sits in a scene that the suite runs. [decided: owner, 2026-11-02]

### Rung 1, verified code at AI velocity [implemented]

C30. `demos/rung1/` holds four `.alg` scenes with one Markdown scene, `05-prover-loop.md`. evidence: E1. [decided: owner, 2026-11-02]

C31. Scene 1, `01-discharge.alg`, states three kinds of claim in the program's own syntax: a refinement; a contract; a theorem. evidence: E2. [decided: owner, 2026-11-02]

C32. Line 27 of `01-discharge.alg` reads `theorem four: 2 + 2 == 4`. evidence: E2. [decided: owner, 2026-11-02]

C33. In a run on 2026-11-02, `verify` on `01-discharge.alg` reported all four theorems discharged by auto-PE, with a clean assumption ledger. evidence: E3. [decided: owner, 2026-11-02]

C34. Line 23 of `01-discharge.alg` reads `print(double_pos(PositiveInt(7)))`, pinned by `// expect: 14`. evidence: E2. [decided: owner, 2026-11-02]

C35. In a run on 2026-11-02, `inspect` on `01-discharge.alg` reported the safety grade `proven-safe`, with the precondition `x ≥ 1` and the postcondition `_ ≥ 1` on `double_pos`. evidence: E3. [decided: owner, 2026-11-02]

C36. `requires_stmt` returns without evaluating its predicate when the facts of the argument entail the predicate. evidence: E4. [decided: owner, 2026-11-02]

C37. Scene 1 shows PE-as-discharge on closed theorems and on a contract whose argument facts entail the contract's predicate. [inferred: R1]

C38. Line 9 of `02-counterexamples.alg` reads `print(error of SmallPos(0 - 5))`, pinned by `// expect: refinement check failed: expected ≥ 1 (got -5)`. evidence: E5. [decided: owner, 2026-11-02]

C39. A failed refinement construction in scene 2 yields an error value naming the violated bound with the actual value. evidence: E5. [decided: owner, 2026-11-02]

C40. The commented break-it block of scene 2 holds `theorem wrong: 2 + 2 == 5`. evidence: E5. [decided: owner, 2026-11-02]

C41. In a run on 2026-11-02 with `theorem wrong` uncommented, the file runner printed the scene's pinned output, then halted with exit code 1 on "proposition is false". evidence: E6. [decided: owner, 2026-11-02]

C42. Scene 2 shows a false theorem halting the build, with the counterexample named in the halt. [inferred: R2]

C43. Scene 3, `03-effects.alg`, checks each effect declaration against the effects inferred from what the function transitively calls. evidence: E7. [decided: owner, 2026-11-02]

C44. Lines 15 and 16 of `03-effects.alg` read `loud(msg) =>` and `effects io`, with the call at line 19 pinned by `// expect: declared and verified`. evidence: E7. [decided: owner, 2026-11-02]

C45. In a run on 2026-11-02, `inspect` on `03-effects.alg` reported `loud` with "io (declared, verified)". evidence: E8. [decided: owner, 2026-11-02]

C46. The commented break-it block of scene 3 declares `effects pure` on a function that calls `print`. evidence: E7. [decided: owner, 2026-11-02]

C47. In a run on 2026-11-02 with that break-it block uncommented, the file runner halted with exit code 1 on "effects mismatch in sneaky: declared `pure`, inferred `io` (undeclared: io)". evidence: E6. [decided: owner, 2026-11-02]

C48. Scene 3 shows the safety family of the thesis: an undeclared effect halts the build. [inferred: R3]

C49. Lines 9 and 10 of `04-laws.alg` read `p = proof_trans(proof_refl(7), proof_refl(7))` and `print(p.lawTier)`, pinned by `// expect: kernel`. evidence: E9. [decided: owner, 2026-11-02]

C50. Line 33 of `04-laws.alg` reads `Law.assume(Cell, "trans")`. evidence: E9. [decided: owner, 2026-11-02]

C51. Line 40 of `04-laws.alg` reads `print(q.lawTier)`, pinned by `// expect: admitted`. evidence: E9. [decided: owner, 2026-11-02]

C52. In a run on 2026-11-02, `verify` on `04-laws.alg` reported "1 ADMITTED (assumed, not proof)", the assumption ledger mapping the admitted `trans` law of `Cell` to the proofs `t_cell` and `q`. evidence: E10. [decided: owner, 2026-11-02]

C53. The verdict of `04-laws.alg` leaves the `refl` and `sym` laws of `Cell` pending. evidence: E10. [decided: owner, 2026-11-02]

C54. In a run on 2026-11-02 with `theorem t_bad` uncommented, the file runner halted with exit code 1 on "transitivity of 'Cell' is neither proven nor admitted". evidence: E6. [decided: owner, 2026-11-02]

C55. Every claim is a predicate with a visible discharge strength, answered by a tier, never by a bare checkmark. [decided: docs/book/vision.md §1a, move 2]

C56. Verification claims state their strength, never letting a weaker check borrow a stronger check's vocabulary. [decided: docs/book/vision.md §5, principle 9]

C57. Scene 4 shows a discharge tier carried on a proof value, with an admitted law visible in the verdict and its assumption ledger. [inferred: R4]

C58. Scene 5, `05-prover-loop.md`, walks through the prover loop: an obligation; a proposal; a verdict; recorded authorship. evidence: E11. [decided: owner, 2026-11-02]

C59. In a run on 2026-11-02 over the two source lines of scene 5, `obligations --pending` printed the obligation `double_four` with the hash `0728a8d1`, as the scene shows. evidence: E12. [decided: owner, 2026-11-02]

C60. In a run on 2026-11-02 over those two source lines, `propose` printed the failure reason "proof term establishes a different equality" with the scene's hint. evidence: E12. [decided: owner, 2026-11-02]

C61. `prove` refuses to run without the environment variable `ANTHROPIC_API_KEY`. evidence: E11, E12. [decided: owner, 2026-11-02]

C62. `src/test/pcp.ts` pins the LLM worker's loop with a mock client: the client's term is spliced into the source, discharges the obligation, and records the mock model as the prover. evidence: E13. [decided: owner, 2026-11-02]

C63. Scene 5 states that partial evaluation alone discharges all ten closed propositions of the `npm run bench` corpus. evidence: E11, E14. [decided: owner, 2026-11-02]

C64. Scene 5 shows the participant-neutral protocol as a walk-through, the suite pinning the worker loop with a mock client instead of the scene. [inferred: R5]

### Rung 2, a provable DSL [implemented]

C65. Rung 2 is a units-of-measure DSL built as the library `lib/units.alg`, with three scenes. evidence: E15, E20. [decided: owner, 2026-11-02]

C66. The rung 2 README states that the DSL is built with zero host code. evidence: E15. [decided: owner, 2026-11-02]

C67. Outside `src/test/`, the words quantity and planning occur in `src/` only in four comments. evidence: E28. [decided: owner, 2026-11-02]

C68. `lib/units.alg` defines each named dimension as a refinement over one `Quantity` record, such as `Velocity     = Quantity & _.dim == velocity_dim`. evidence: E20. [decided: owner, 2026-11-02]

C69. Line 22 of `01-dimensions.alg` reads `print(error of bad)`, pinned by `// expect: cannot add m and s: length vs time`. evidence: E16. [decided: owner, 2026-11-02]

C70. The break-it block of rung 2's scene 1 passes a length where `speed` expects an `Acceleration`. evidence: E16. [decided: owner, 2026-11-02]

C71. In a run on 2026-11-02 with that break-it block uncommented, the file runner halted with "Type error: argument 0 failed refinement predicate for Acceleration". evidence: E6. [decided: owner, 2026-11-02]

C72. `src/test/proofs.ts` pins the wrong-dimension halt as the anti-goal check that dimensional soundness flows through the standard refinement machinery. evidence: E21. [decided: owner, 2026-11-02]

C73. Rung 2 meets the falsifiable design constraint for dimensional soundness: the check is refinement discharge, with no parallel infrastructure. [inferred: R6]

C74. `lib/units.alg` declares the DSL's literal syntax in a twelve-line grammar block, `units_grammar`. evidence: E20. [decided: owner, 2026-11-02]

C75. Line 12 of `02-literals.alg` reads `print((9.8 m/s^2).toString())`, pinned by `// expect: 9.8 m/s^2`. evidence: E17. [decided: owner, 2026-11-02]

C76. Line 25 of `02-literals.alg` reads `print(a + zz)`, pinned by `// expect: 8`, ordinary code untouched by the literal syntax. evidence: E17. [decided: owner, 2026-11-02]

C77. Line 10 of `03-laws.alg` reads `theorem km_scale: 1 km == 1000 m`. evidence: E18. [decided: owner, 2026-11-02]

C78. In a run on 2026-11-02, `verify` on `03-laws.alg` reported the four physics theorems discharged by auto-PE. evidence: E19. [decided: owner, 2026-11-02]

C79. `Quantity` draws `Equatable` in `lib/units.alg`. evidence: E20. [decided: owner, 2026-11-02]

C80. `03-laws.alg` admits the `trans` law of `Quantity` at line 27, with line 32's `print(p.lawTier)` pinned by `// expect: admitted`. evidence: E18. [decided: owner, 2026-11-02]

C81. In a run on 2026-11-02, `verify` on `03-laws.alg` reported two algebraic laws of `Quantity` pending: `mul_comm`; `conv_roundtrip`. evidence: E19. [decided: owner, 2026-11-02]

C82. An Allegro surface inherits the entire kernel: types, proofs, effects, laws, counterexamples, the prover protocol. [decided: docs/book/vision.md §1, Substrate and surfaces]

C83. A narrow surface is exactly as serious as a general-purpose one. [decided: docs/book/vision.md §1, Substrate and surfaces]

C84. Rung 2 shows a narrow surface using five kernel mechanisms in its scenes: refinement discharge; theorems; the strict gate; discharge tiers; the assumption ledger. [inferred: R7]

### Rung 3, a domain model that checks itself [implemented]

C85. Rung 3 is a project-planning model built as the library `lib/planning.alg`, with two scenes. evidence: E24, E27. [decided: owner, 2026-11-02]

C86. The planning DSL is the first domain model written in Allegro Vivace, a plan being a graph of outcomes rather than a list of tasks. [decided: docs/book/vivace/planning-dsl.md, Reader]

C87. Under the Vivace hypothesis, failures are build errors with counterexamples that all stakeholders can read. [decided: docs/book/vision.md §4]

C88. Shape 1 is sufficient to test every claim of the Vivace hypothesis except execution. [decided: docs/book/vision.md §4]

C89. `lib/planning.alg` declares the `plan NAME:` statement form in its grammar block `planning_grammar`, binding NAME with the type `WellFormedPlan`. evidence: E27. [decided: owner, 2026-11-02]

C90. `WellFormedPlan` is a refinement of `Plan` by the predicate `well_formed`, which answers an error value listing every finding. evidence: E27. [decided: owner, 2026-11-02]

C91. Line 152 of `01-model.alg` reads `print(SoftwareRelease instanceof WellFormedPlan)`, pinned by `// expect: true`. evidence: E25. [decided: owner, 2026-11-02]

C92. Line 161 of `01-model.alg` pins the worst-case bound of `SoftwareRelease`: `duration 1345 min, effort 24 person-hours, money none`. evidence: E25. [decided: owner, 2026-11-02]

C93. Line 178 of `01-model.alg` reads `print(error of validate(with_budget(SoftwareRelease, effort_budget(person_hours(20)))))`. evidence: E25. [decided: owner, 2026-11-02]

C94. Line 179 of `01-model.alg` pins the refusal: `SoftwareRelease is not well-formed: budget of SoftwareRelease: effort 24 person-hours exceeds 20 person-hours`. evidence: E25. [decided: owner, 2026-11-02]

C95. The break-it block of rung 3's scene 1 changes the input of `Compile` to `Missing`, which no node produces. evidence: E25. [decided: owner, 2026-11-02]

C96. With that change, the file runner halted on "refinement predicate failed for WellFormedPlan: BuildPipeline is not well-formed: input Missing of Compile is not produced by any node of BuildPipeline or by its inputs". evidence: E6. [decided: owner, 2026-11-02]

C97. `src/test/language.ts` pins the `plan` statement's halt on a plan that does not check, with the finding in planning vocabulary. evidence: E22. [decided: owner, 2026-11-02]

C98. Solution finding is search through the space the claims constrain. [decided: docs/book/vision.md §1a]

C99. `solve` picks the resolution of a template that passes every check, the budget included, best by the bound's effort and then its duration. evidence: E26, E27. [decided: owner, 2026-11-02]

C100. Line 143 of `02-solve.alg` pins the cheapest resolution: `Test via Quick, Deploy via Direct; bound effort 20.75 person-hours, duration 1460 min`. evidence: E26. [decided: owner, 2026-11-02]

C101. Line 162 of `02-solve.alg` pins the counterexample: `no choice of Test and Deploy fits the budget of SoftwareRelease; the cheapest, Test via Quick, Deploy via Direct, is duration 1460 min against 20 h`. evidence: E26. [decided: owner, 2026-11-02]

C102. Line 186 of `02-solve.alg` pins a completion from a catalog: `Delivered from LastMile, Shipped from Ship, Labelled from Label; Label via PrintLabel; bound effort 1.75 person-hours, duration 235 min`. evidence: E26. [decided: owner, 2026-11-02]

C103. Rung 3 shows a domain model checked as a refinement, refused in planning vocabulary, solved over its choices and completed from a catalog. [inferred: R8]

### What the rungs inherit [implemented]

C104. Rung 2's scenes use five mechanisms that rung 1's scenes show: refinements; theorems discharged by partial evaluation; error values; the strict gate; `Law.assume` with the admitted tier. evidence: E2, E5, E9, E16, E18. [decided: owner, 2026-11-02]

C105. Rung 2's scenes declare no effect and run no prover loop. evidence: E16, E17, E18. [decided: owner, 2026-11-02]

C106. The rung 2 README lists the effects calculus and the prover loop among the mechanisms that rung 2 inherited. evidence: E15. [decided: owner, 2026-11-02]

C107. Rung 2 inherits the effects calculus and the prover loop by the README's statement only, no rung 2 scene exercising either mechanism. [inferred: R9]

C108. Rung 3's scenes use three mechanisms that rung 2's scenes show: the duration literals of the units DSL, through `use units`; a refinement as a domain check; a library grammar block. evidence: E16, E17, E25, E27. [decided: owner, 2026-11-02]

C109. Rung 3's `plan` statement halts on the refinement annotation path that rung 2's wrong-dimension call takes, each halt message beginning "Type error:" and naming the refinement. evidence: E6. [decided: owner, 2026-11-02]

C110. Rung 3's scenes read refusals as error values through `error of`, a form that rung 1's scene 2 shows. evidence: E5, E25, E26. [decided: owner, 2026-11-02]

C111. Rung 3's scenes state no theorem, no law and no effect declaration. evidence: E25, E26. [decided: owner, 2026-11-02]

C112. `lib/planning.alg` activates the libraries `totality` and `units` through `use`. evidence: E27. [decided: owner, 2026-11-02]

C113. The rung 3 README lists cross-file `uses` through `import` among the mechanisms that rung 3 inherited. evidence: E24. [decided: owner, 2026-11-02]

C114. Both rung 3 scenes borrow `BuildPipeline` within one file, the cross-file form being pinned by `tests/planning-split-demo.alg` instead. evidence: E25, E26, E22. [decided: owner, 2026-11-02]

### What is not shown or not delivered [partial]

C115. Rung 4 is named in this chapter as direction, not as a claim. [decided: docs/plans/book-chapters-now.md R2, 2026-10-30]

C116. The suite runs no part of `05-prover-loop.md` and no file under a rung's `transcripts/` directory. evidence: E30. [decided: owner, 2026-11-02]

C117. The halts that the transcripts record are checked by hand, not by the suite. [inferred: R10]

C118. Two halts of the scenes' kinds are pinned by tests outside the scenes: the wrong-dimension call in `src/test/proofs.ts`; the `plan` statement in `src/test/language.ts`. evidence: E21, E22. [decided: owner, 2026-11-02]

C119. In a run on 2026-11-02 following the break-it comment of `demos/rung2/03-laws.alg`, the file runner halted on "type_dispatch: 'lawTier' not found on Proof", not on the strict gate. evidence: E6. [decided: owner, 2026-11-02]

C120. `demos/rung2/transcripts/03-gate.txt` records the strict gate's refusal of `theorem bad` for that break-it comment. evidence: E38. [decided: owner, 2026-11-02]

C121. The rung 1 README states that each scene holds a commented break-it block. evidence: E1. [decided: owner, 2026-11-02]

C122. `demos/rung1/01-discharge.alg` holds no break-it block. evidence: E2. [decided: owner, 2026-11-02]

C123. `docs/book/getting-started.md` describes each rung 1 scene as carrying a break-it block with captured transcripts. evidence: E36. [decided: owner, 2026-11-02]

C124. Lines 8 and 9 of `demos/rung1/03-effects.alg` state that `inspect` shows `effects: pure (inferred)` for `square`. evidence: E7. [decided: owner, 2026-11-02]

C125. In a run on 2026-11-02, `inspect` on `demos/rung1/03-effects.alg` printed no effects line for `square`. evidence: E8. [decided: owner, 2026-11-02]

C144. `demos/rung1/transcripts/` holds transcripts for scenes 2, 3 and 4 only. evidence: E37. [decided: owner, 2026-11-02]

C126. The transcripts of rungs 1 and 2 open each halt with "Error:", where the file runner prints "Error in" followed by the file's path. evidence: E6, E38. [decided: owner, 2026-11-02]

C127. The algebraic laws of `Quantity` stay pending because record-domain quantifiers have no sample construction. evidence: E20. [decided: owner, 2026-11-02]

C128. B-089 (lawful-interface follow-ons) is the open backlog item that owns the sampled tier for record-domain quantifiers. evidence: E32. [decided: owner, 2026-11-02]

C129. The rung 3 README states that rung 3 shows one model, at pilot scale, as specification and checking only, which is Shape 1. evidence: E24. [decided: owner, 2026-11-02]

C130. The rung 3 README names three things rung 3 does not show: a plan executed; a second model composed with the first; an AI agent in the loop over the model. evidence: E24. [decided: owner, 2026-11-02]

C131. B-082 (model composition patterns) is the open backlog item that owns the composition of models. evidence: E32. [decided: owner, 2026-11-02]

C132. B-083 (the AI iteration loop) is the open backlog item that owns an AI agent's loop over a model. evidence: E32. [decided: owner, 2026-11-02]

C133. No backlog item names Shape 2, in which Allegro would run a model. evidence: E33. [decided: owner, 2026-11-02]

C134. The web pages' library registry in `scripts/sync-web-libs.ts` holds six libraries, `planning` not among them. evidence: E34. [decided: owner, 2026-11-02]

C135. Rung 3's website loop is not delivered: a landing section; a sandbox preset; `planning` in the web library registry. evidence: E31, E34. [decided: owner, 2026-11-02]

C136. B-093 (rung-3 packaging) is the open backlog item that owns rung 3's website loop, the deploy being the maintainer's. evidence: E31. [decided: owner, 2026-11-02]

### Where the demos are and what pins them [implemented]

C137. `src/test/proofs.ts` registers the four `.alg` scenes of rung 1 and the three of rung 2 through `fileTest`. evidence: E21. [decided: owner, 2026-11-02]

C138. `src/test/language.ts` registers the two scenes of rung 3 through `fileTest`. evidence: E22. [decided: owner, 2026-11-02]

C139. `fileTest` runs a scene under Allegro Standard, comparing the printed lines in order with the scene's `// expect:` lines. evidence: E23. [decided: owner, 2026-11-02]

C140. A scene that halts, prints a different line or prints a different number of lines fails its `fileTest`. evidence: E23. [decided: owner, 2026-11-02]

C141. In runs on 2026-11-02, the file runner printed exactly the `// expect:` lines of each of the nine `.alg` scenes, exiting with code 0. evidence: E29. [decided: owner, 2026-11-02]

C142. `lib/units.alg` holds 246 lines, `lib/planning.alg` 1233. evidence: E20, E27. [decided: owner, 2026-11-02]

C143. `docs/book/implementation-map.md` lists `demos/rung1` and `demos/rung2` as suite-registered demo packages, with no row for `demos/rung3`. evidence: E35. [decided: owner, 2026-11-02]

### Clusters

G1. cluster: C1, C2, C3, C4, C145, C6, C7 [decided: owner, 2026-11-02]

G2. cluster: C8, C9, C10, C11 [decided: owner, 2026-11-02]

G3. cluster: C12, C13, C14, C15 [decided: owner, 2026-11-02]

G4. cluster: C16, C17, C18, C19, C20, C21, C22, C23, C24 [decided: owner, 2026-11-02]

G5. cluster: C25, C26, C27, C28, C29 [decided: owner, 2026-11-02]

G6. cluster: C30, C31, C32, C33, C34, C35, C36, C37 [decided: owner, 2026-11-02]

G7. cluster: C38, C39, C40, C41, C42 [decided: owner, 2026-11-02]

G8. cluster: C43, C44, C45, C46, C47, C48 [decided: owner, 2026-11-02]

G9. cluster: C49, C50, C51, C52, C53, C54, C55, C56, C57 [decided: owner, 2026-11-02]

G10. cluster: C58, C59, C60, C61, C62, C63, C64 [decided: owner, 2026-11-02]

G11. cluster: C65, C66, C67, C68 [decided: owner, 2026-11-02]

G12. cluster: C69, C70, C71, C72, C73 [decided: owner, 2026-11-02]

G13. cluster: C74, C75, C76 [decided: owner, 2026-11-02]

G14. cluster: C77, C78, C79, C80, C81, C82, C83, C84 [decided: owner, 2026-11-02]

G15. cluster: C85, C86, C87, C88 [decided: owner, 2026-11-02]

G16. cluster: C89, C90, C91, C92, C93, C94, C95, C96, C97 [decided: owner, 2026-11-02]

G17. cluster: C98, C99, C100, C101, C102, C103 [decided: owner, 2026-11-02]

G18. cluster: C104, C105, C106, C107 [decided: owner, 2026-11-02]

G19. cluster: C108, C109, C110, C111, C112, C113, C114 [decided: owner, 2026-11-02]

G20. cluster: C115, C116, C117, C118 [decided: owner, 2026-11-02]

G21. cluster: C119, C120, C121, C122, C144, C123, C124, C125, C126 [decided: owner, 2026-11-02]

G22. cluster: C127, C128, C129, C130, C131, C132, C133, C134, C135, C136 [decided: owner, 2026-11-02]

G23. cluster: C137, C138, C139, C140, C141, C142, C143 [decided: owner, 2026-11-02]

## Relations

R1. C37 depends-on C33 because each "by auto-PE" in the verdict is partial evaluation reducing a closed theorem to `true` (C19), with C36 covering the contract.

R2. C42 depends-on C41 because the halt fires on a false proposition and names the evaluation that refutes it, as C23 requires.

R3. C48 depends-on C47 because an effect inferred but not declared is the negative claim of C18 refused at build time.

R4. C57 depends-on C52 because the tiers `kernel` and `admitted` ride the proof values of C49 and C51 into the verdict.

R5. C64 depends-on C62 because C59 and C60 were reproduced by hand while the suite pins only the worker's loop.

R6. C73 depends-on C72 because the pinned halt is the refinement check of C68, the machinery that `PositiveInt` uses in rung 1.

R7. C84 depends-on C78 because the scenes of rung 2 exercise those five mechanisms over quantities (C68, C77, C80, C81) with no host code (C66, C67).

R8. C103 depends-on C96 because the halt, the refusals of C94 and the solutions of C100 to C102 all come from the predicate of C90.

R9. C107 depends-on C105 because the list of C106 names two mechanisms that no rung 2 scene uses.

R10. C117 depends-on C116 because a file the suite does not read cannot fail a test when its recorded output drifts.

R11. C122 contradicts C121 because scene 1 is one of the scenes the README covers.

R12. C122 contradicts C123 because scene 1 of rung 1 holds no break-it block and no transcript.

R13. C125 contradicts C124 because the inspect output lists no effects for `square`.

R14. C119 contradicts C120 because the recorded refusal does not come from following the comment the file carries.

R15. C26 supports C83 because a domain language with no host code of its own runs on the kernel alone (C82).

R16. C27 supports C88 because rung 3 tests the hypothesis without executing a plan (C129).

R17. C145 contradicts C5 because ruling R10 of `docs/plans/book-chapters-now.md` moved the definition sites of rung and demo ladder to II.19 after the owner ratified C5.

## Evidence

E1. `demos/rung1/README.md` lines 1 (the title, "verified code at AI velocity"), 3–4 (five scenes), 7–10 (four run commands), 13–19 (the scene table, scene 5 `05-prover-loop.md`), 21–22 ("Each scene contains a commented **break it** block"), 26–27 (`inspect`, `verify`), 30–31 (suite-validated via `// expect:`).

E2. `demos/rung1/01-discharge.alg` lines 5 (`use contracts`), 10–11 (`PositiveInt`, `// expect: 5`), 18–23 (`double_pos` with `requires` and `ensures`; `print(double_pos(PositiveInt(7)))     // expect: 14`), 27 (`theorem four: 2 + 2 == 4`), 31–33 (`proof_sym`, `proof_trans`), 36 (`// expect: 4`); no commented break-it block in its 36 lines.

E3. Runs on 2026-11-02 of `npx tsx src/index.ts verify demos/rung1/01-discharge.alg` ("Verdict (verified): 4/4 discharged", each theorem "by auto-PE", "assumption ledger: clean") and of `inspect` on the same file ("safety grade: proven-safe"; `double_pos` with "requires: x ≥ 1" and "ensures: _ ≥ 1").

E4. `src/primitives.ts` lines 3375–3400 (`requires_stmt_impl`: entailment of the predicate by the argument's predicate set at 3379–3397; the predicate evaluated only when not entailed, at 3399–3400).

E5. `demos/rung1/02-counterexamples.alg` lines 7–10 (`SmallPos`; line 9 `print(error of SmallPos(0 - 5))       // expect: refinement check failed: expected ≥ 1 (got -5)`), 13–15 (`Range`), 17–26 (the commented `theorem wrong: 2 + 2 == 5`), 27.

E6. Runs on 2026-11-02 of the file runner over scratch copies with each break-it block uncommented as its comment instructs: rung 1 scene 2, pinned output then "proof check failed … proposition is false (counterexample: `2 + 2 == 5` evaluates to false)", exit 1; rung 1 scene 3, "effects mismatch in sneaky: declared `pure`, inferred `io` (undeclared: io)", exit 1; rung 1 scene 4, "transitivity of 'Cell' is neither proven nor admitted", exit 1; rung 2 scene 1, "Type error: argument 0 failed refinement predicate for Acceleration", exit 1; rung 2 scene 3 with `Law.assume` removed and `theorem bad` uncommented, "type_dispatch: 'lawTier' not found on Proof", exit 1; rung 3 scene 1, "Type error: refinement predicate failed for WellFormedPlan: BuildPipeline is not well-formed: input Missing of Compile …", exit 1; rung 3 scene 2, "Type error: refinement predicate failed for WellFormedPlan: SoftwareRelease is not well-formed: no choice of Test and Deploy fits …", exit 1. Every halt line began "Error in" and the scratch file's path.

E7. `demos/rung1/03-effects.alg` lines 1–5 (declared ⊇ inferred), 8–10 ("visible in `allegro inspect` (`effects: pure (inferred)`)"; `square(x) => x * x`), 15–19 (`loud(msg) =>`, `effects io`, `print(msg)`; `loud("declared and verified")         // expect: declared and verified`), 22–25 (`maybe_log`), 27–38 (the commented `sneaky` with `effects pure`).

E8. A run on 2026-11-02 of `npx tsx src/index.ts inspect demos/rung1/03-effects.alg`: "safety grade: proven-safe"; `loud` with "effects: io (declared, verified)"; no effects line under `square` or `maybe_log`.

E9. `demos/rung1/04-laws.alg` lines 2–4 (the tiers), 8–10 (`p = proof_trans(proof_refl(7), proof_refl(7))`; `print(p.lawTier)                      // expect: kernel`), 15–16 (`Cell` draws `Equatable`), 18–30 (the commented `theorem t_bad`), 33 (`Law.assume(Cell, "trans")`), 38–40 (`theorem t_cell`; `print(q.lawTier)                      // expect: admitted`), 43–45 (`Law.witness` on `Cell2`).

E10. A run on 2026-11-02 of `npx tsx src/index.ts verify demos/rung1/04-laws.alg`, identical to `demos/rung1/transcripts/04-gate.txt` lines 12–25: "laws: 13/18 discharged, 1 ADMITTED (assumed, not proof), 4 pending"; "? Cell.refl"; "? Cell.sym"; "! admitted 'trans' of 'Cell' — backs: t_cell, q".

E11. `demos/rung1/05-prover-loop.md` lines 3–6 (obligations, any prover, verdict, authorship), 14–27 (`double_four` and its obligation with hash `0728a8d1`), 35–55 (`allegro propose`), 59–71 (`allegro prove`, "requires `ANTHROPIC_API_KEY`", authorship), 73–75 (no privileged path), 79–84 ("partial evaluation alone discharges all 10 closed propositions").

E12. Runs on 2026-11-02 over a scratch file holding the two source lines of `05-prover-loop.md` lines 15–16: `obligations --pending` printed "Obligation: theorem `double_four`", "hash: 0728a8d1", "#1: verified=false"; `propose` printed "reason: proof term establishes a different equality" with the hint "the `by` proof term establishes a different fact than the theorem claims"; `prove` with no `ANTHROPIC_API_KEY` printed "ANTHROPIC_API_KEY is not set".

E13. `src/test/pcp.ts` lines 723–755 (`runLlmWorker` with a mock client returning `proof_refl(2)`: `allDischarged` true, `finalTerm` "proof_refl(2)", `authorship.provers[0].prover` "mock-model", the term spliced into `sourceAfter`).

E14. `bench/README.md` line 42 ("auto-PE = 10/10").

E15. `demos/rung2/README.md` lines 1 (the title, "a provable DSL: units of measure"), 3–9 ("`lib/units.alg`, ~200 lines, **zero host code**"), 11–16 (the commands), 18–22 (the scene table), 24–26 (suite-validated via `// expect:`), 28–32 (built for physics; "inherited free": the type checker, refinement discharge, theorems, the strict gate, the tiers, the ledger, "the effects calculus, and the prover loop").

E16. `demos/rung2/01-dimensions.alg` lines 7 (`use units`), 10–15 (`qty`, `instanceof Velocity`), 21–22 (`bad = d + t`; `print(error of bad)                   // expect: cannot add m and s: length vs time`), 25–27 (conversion), 29–38 (the commented wrong-dimension call to `speed`), 39–41 (`speed(a: Acceleration, t: Duration): Velocity`); no `effects` declaration.

E17. `demos/rung2/02-literals.alg` lines 3–8 (the library's grammar block at `use`), 11–14 (line 12 `print((9.8 m/s^2).toString())         // expect: 9.8 m/s^2`), 17–20 (`instanceof Energy`; `error of mismatch`), 22–26 (line 25 `print(a + zz)                         // expect: 8`); no `effects` declaration.

E18. `demos/rung2/03-laws.alg` lines 9–13 (line 10 `theorem km_scale: 1 km == 1000 m`), 16–17 (`force_of(mass: Mass, acc: Acceleration): Force`; `theorem f_ma`), 19–26 (the commented `theorem bad`, "Uncomment (and remove the Law.assume)"), 27 (`Law.assume(Quantity, "trans")`), 29–32 (`print(p.lawTier)                      // expect: admitted`), 34–39; no `effects` declaration, no prover call.

E19. A run on 2026-11-02 of `npx tsx src/index.ts verify demos/rung2/03-laws.alg`, identical to `demos/rung2/transcripts/03-gate.txt` lines 10–25: `km_scale`, `min_scale`, `newton_ident`, `f_ma` "by auto-PE"; "? Quantity.mul_comm"; "? Quantity.conv_roundtrip"; "! admitted 'trans' of 'Quantity' — backs: q_chain, p".

E20. `lib/units.alg` lines 161–166 (the comment: record-domain quantifiers have no sample construction yet, the B-089 residue), 167–182 (`Quantity` with `law_mul_comm` and `law_conv_roundtrip`, drawing `Equatable`), 192–198 (the named dimensions as refinements, `Velocity     = Quantity & _.dim == velocity_dim` at 196), 235–246 (`units_grammar`, twelve lines); 246 lines.

E21. `src/test/proofs.ts` lines 755–765 (the comment "B-091: rung-1 demo scripts (demos/rung1/)"; `fileTest(path.join(demosRung1Dir, "01-discharge.alg"))` and the three scenes after it), 777–781 (`fileTest(path.join(demosRung2Dir, "01-dimensions.alg"))` and the two scenes after it), 793–805 (the wrong-dimension halt test: "dimensional soundness must flow through the standard refinement machinery").

E22. `src/test/language.ts` lines 672–675 (`fileTest(path.join(testsDir, "planning-split-demo.alg"))`: cross-file `uses` through `import`), 686–692 (the comment naming `demos/rung3/transcripts/`; `fileTest(path.join(demosRung3Dir, "01-model.alg"))`, `fileTest(path.join(demosRung3Dir, "02-solve.alg"))`), 694–724 (the `plan` statement halt test, "Broken is not well-formed: input Missing of Work is not produced by any node of Broken or by its inputs").

E23. `src/test/alg-files.ts` lines 69–80 (`runAlgFile` reads each `// expect:` comment), 211–218 (print output captured; `runtimeEval` with the type system's extension, Allegro Standard), 236–251 (the count and then each printed line compared in order), 259–269 (`fileTest`).

E24. `demos/rung3/README.md` lines 1 (the title, "a domain model the kernel checks and searches"), 3–10 (`lib/planning.alg`, "**zero host code**", `plan NAME:`), 17–20 (the scene table), 22–26 (the halt transcripts; suite-validated via `// expect:`), 28–35 (built for planning; inherited, including "`uses` across files rides `import`"), 37–41 ("one model, at pilot scale, as specification and checking only (Shape 1)"; nothing executes a plan; no second model composed; no AI agent in the loop).

E25. `demos/rung3/01-model.alg` lines 9–10 (`use units`, `use planning`), 22–55 (`plan BuildPipeline:` with durations such as `30 min`), 59–143 (`plan SoftwareRelease:`, `Build: uses BuildPipeline` at 70), 152–153 (`print(SoftwareRelease instanceof WellFormedPlan)`; `// expect: true`), 160–161 (`rollup_bound`; `// expect: duration 1345 min, effort 24 person-hours, money none`), 178–179 (the budget refusal and its pin), 186–197 (the commented break-it change of `Compile`'s input to `Missing`); no `theorem`, `Law` or `effects`.

E26. `demos/rung3/02-solve.alg` lines 3–9 (`solve`: every check, the budget included, best by the bound's effort then duration; `solve_from`), 10–11 (`use units`, `use planning`), 69 (`Build: uses BuildPipeline`), 141–143 (`best = solve(SoftwareRelease)`; `// expect: Test via Quick, Deploy via Direct; bound effort 20.75 person-hours, duration 1460 min`), 161–162 (`print(error of solve(…))`; the counterexample pin), 185–186 (`solve_from(fulfil, parts)`; the completion pin), 196–206 (the commented budget break-it); no `theorem`, `Law` or `effects`.

E27. `lib/planning.alg` lines 24–25 (`use totality`, `use units`), 736–748 (`well_formed` answering the error value of every finding, `validate`, `WellFormedPlan = Plan & well_formed(_)`), 972–976 (`solve`), 1082 (`solve_from`), 1191–1233 (`planning_grammar`; the `plan` statement form at 1231–1232 through `binding_decl` with `WellFormedPlan`); 1233 lines.

E28. A case-insensitive search on 2026-11-02 of `src/` outside `src/test/` for planning, `WellFormedPlan` and quantity: four hits, each in a comment (`src/grammar2/fragments.ts` lines 759 and 871; `src/runtime.ts` line 50; `src/primitives.ts` line 2638); no hit for `units.alg`, `Velocity`, `Acceleration`, `plan_show` or `solve_from`.

E29. Runs on 2026-11-02 of `npx tsx src/index.ts` over each of the nine `.alg` scenes: printed lines identical to the scenes' `// expect:` lines; exit 0 for each.

E30. A search on 2026-11-02 of `src/`, `scripts/` and `bench/` for `transcripts` and `05-prover-loop`: only the comments at `src/test/proofs.ts` line 759 and `src/test/language.ts` line 689, which name the transcripts without reading them.

E31. `docs/backlog.md` lines 967–984 (B-093, open: "rung 4 remains internal direction until then"; slice 1 landed 2026-10-27; remaining, slice 2, the website loop: a landing section, a sandbox preset, `planning` in `scripts/sync-web-libs.ts`'s registry; "deploy is the maintainer's").

E32. `docs/backlog.md` lines 506–517 (B-089, open: "sampled tier for record-domain quantifiers (instance construction)"), 1404–1406 (B-082, open: model composition patterns), 1407–1409 (B-083, open: the AI iteration loop).

E33. A search of `docs/backlog.md` on 2026-11-02 for "Shape 2": no hit.

E34. `scripts/sync-web-libs.ts` line 18 (`WEB_LIBS`: `pow`, `match_expr`, `invariants`, `contracts`, `effects`, `units`).

E35. `docs/book/implementation-map.md` lines 67 (`language.ts`: guards, offside rule, forward chaining, pipes, combinators), 71 (`proofs.ts`: "rung demos"), 114 (`demos/rung1`, `demos/rung2`: "Release-ladder demo packages (suite-registered)").

E36. `docs/book/getting-started.md` lines 91–93 ("`demos/rung1/` — five runnable scenes … each with a 'break it' block and captured transcripts").

E37. `demos/rung1/transcripts/` holds `02-broken.txt`, `03-broken.txt`, `04-gate.txt`, with no transcript for scene 1 or scene 5.

E38. `demos/rung1/transcripts/02-broken.txt` line 4, `03-broken.txt` line 4, `04-gate.txt` line 5, `demos/rung2/transcripts/01-halt.txt` line 4 and `03-gate.txt` line 4 (each halt opening "Error:"; `03-gate.txt` lines 1–5, the refusal of `theorem bad` with the `Law.assume` removed); `demos/rung3/transcripts/01-halt.txt` line 4 and `02-halt.txt` line 5 (each opening "Error in" and the scene's path).

## Asks

A1. Ratify in bulk the proposed claims, every claim about the demos and the code as delivered and the six about this chapter's terms, reader, examples and scope: C5, C6, C7, C10, C11, C12, C13, C14, C15, C25, C26, C29, C30, C31, C32, C33, C34, C35, C36, C38, C39, C40, C41, C43, C44, C45, C46, C47, C49, C50, C51, C52, C53, C54, C58, C59, C60, C61, C62, C63, C65, C66, C67, C68, C69, C70, C71, C72, C74, C75, C76, C77, C78, C79, C80, C81, C85, C89, C90, C91, C92, C93, C94, C95, C96, C97, C99, C100, C101, C102, C104, C105, C106, C108, C109, C110, C111, C112, C113, C114, C116, C118, C119, C120, C121, C122, C123, C124, C125, C126, C127, C128, C129, C130, C131, C132, C133, C134, C135, C136, C137, C138, C139, C140, C141, C142, C143, C144. Depends: C5, C6, C7, C10, C11, C12, C13, C14, C15, C25, C26, C29, C30, C31, C32, C33, C34, C35, C36, C38, C39, C40, C41, C43, C44, C45, C46, C47, C49, C50, C51, C52, C53, C54, C58, C59, C60, C61, C62, C63, C65, C66, C67, C68, C69, C70, C71, C72, C74, C75, C76, C77, C78, C79, C80, C81, C85, C89, C90, C91, C92, C93, C94, C95, C96, C97, C99, C100, C101, C102, C104, C105, C106, C108, C109, C110, C111, C112, C113, C114, C116, C118, C119, C120, C121, C122, C123, C124, C125, C126, C127, C128, C129, C130, C131, C132, C133, C134, C135, C136, C137, C138, C139, C140, C141, C142, C143, C144.

A1 resolved: ratified by the owner at the merge of PR #145, 2026-11-02; the statuses are flipped.

A2. Ratify or strike the two proposed terms this chapter defines: rung (T1), anchored at `#def-rung`; demo ladder (T2), anchored at `#def-demo-ladder`. Depends: C5, C12, C14, C104, C108.

A2 resolved: both terms ratified at the merge of PR #145, 2026-11-02; their definition sites moved to vivace/planning-dsl.md (II.19), which uses them first, and T1 and T2 link there.
