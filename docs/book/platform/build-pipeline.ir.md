# IR: The evaluation pipeline

Reader: RD-4
Purpose: document. The book's chapter on the `pipeline` unit (unit 33): the stage order of `evalSource`, what each stage may assume, the post-passes that halt, precompile, the phases and futures as far as `evalSource` drives them, and the three moves the unit still owes.
Status: delivered IR-only (ratified at the merge of PR #132, 2026-11-01; unratified terms 0; footprint: declared 10, changed 10, surprises 0, misses 0; edited 2026-11-01: the precompile context and cutoff re-synced after B-159's R2 and R3 (claims C160 to C175; C99, C101 and C103 removed; evidence re-pointed to the current lines), unratified terms 0)
Source: chunk A2 of docs/plans/book-chapters-now.md (stream A, B-170); src/runtime.ts as the file of unit 33
Footprint: docs/book/platform/build-pipeline.ir.md; docs/book/README.md; docs/reading-order.json; docs/book/units.md; docs/book/concepts.md; docs/book/implementation-map.md; docs/book/platform/README.md; docs/book-changes.md; docs/documentation-census.md; docs/CHANGELOG.md; docs/plans/book-chapters-now.md

## Terms

T1. Value. defined-at: ../concepts.md#def-value [decided: docs/book/concepts.md §1]

T2. Bits. defined-at: ../concepts.md#def-bits [decided: docs/book/concepts.md §3]

T3. Symbol. defined-at: ../concepts.md#def-symbol [decided: docs/book/concepts.md §4]

T4. Param. defined-at: ../concepts.md#def-param [decided: docs/book/concepts.md §5]

T5. Expression. defined-at: ../concepts.md#def-expression [decided: docs/book/concepts.md §6]

T6. Composed function. defined-at: ../concepts.md#def-composedfunction [decided: docs/book/concepts.md §7]

T7. Primitive function. defined-at: ../concepts.md#def-primitivefunction [decided: docs/book/concepts.md §8]

T8. Structure. defined-at: ../concepts.md#def-structure [decided: docs/book/concepts.md §9]

T9. Binding. defined-at: ../concepts.md#def-binding [decided: docs/book/concepts.md §13]

T10. Scope. defined-at: ../concepts.md#def-scope [decided: docs/book/concepts.md §15]

T11. Partial evaluation. defined-at: ../concepts.md#def-partial-evaluation [decided: docs/book/concepts.md §25]

T12. Residual. defined-at: ../concepts.md#def-resolved-unresolved-residual [decided: docs/book/concepts.md §26]

T13. Resolved and unresolved. defined-at: ../concepts.md#def-resolved-unresolved-residual [decided: docs/book/concepts.md §26]

T14. Future cell. defined-at: ../concepts.md#def-future-cell-and-completion [decided: docs/book/concepts.md §28]

T15. Forward chaining. defined-at: ../concepts.md#def-future-cell-and-completion [decided: docs/book/concepts.md §28]

T16. Type. defined-at: ../concepts.md#def-type [decided: docs/book/concepts.md §30]

T17. Refinement. defined-at: ../concepts.md#def-refinement [decided: docs/book/concepts.md §35]

T18. Effect. defined-at: ../concepts.md#def-effect [decided: docs/book/concepts.md §40]

T19. Declared and inferred effects. defined-at: ../concepts.md#def-declared-and-inferred-effects [decided: docs/book/concepts.md §41]

T20. Totality. defined-at: ../concepts.md#def-totality [decided: docs/book/concepts.md §42]

T21. Divergence and discharge tier, with `div` the divergence effect. defined-at: ../concepts.md#def-divergence-and-discharge-tiers [decided: docs/book/concepts.md §43]

T22. Proof and discharge. defined-at: ../concepts.md#def-proof-and-discharge [decided: docs/book/concepts.md §44]

T23. Contract, an invariant included. defined-at: ../concepts.md#def-contract [decided: docs/book/concepts.md §46]

T24. Channel. defined-at: ../allegretto/metadata-and-capability.md#def-channel [decided: docs/book/allegretto/metadata-and-capability.md §4]

T25. Metadata field. defined-at: ../allegretto/metadata-and-capability.md#def-metadata-field [decided: docs/book/allegretto/metadata-and-capability.md §3]

T26. Writer capability. defined-at: ../allegretto/metadata-and-capability.md#def-writer-capability [decided: docs/book/allegretto/metadata-and-capability.md §6]

T27. Tail call. defined-at: ../allegretto/evaluator.md#def-tail-call [decided: owner, 2026-11-01]

T28. Unit. defined-at: ../units.md#def-unit [decided: D50]

T29. Track, with T-build the multi-phase build track. defined-at: ../layers.md#def-track [decided: docs/book/layers.md §2]

T30. Layer, with Allegretto as L0 and Allegro Standard as L2. defined-at: ../layers.md#def-layer [decided: docs/book/layers.md §1]

T31. Extension, a set of named bindings the execution context injects between the primitives and the source. defined-at: ../extension/modules.md#loading-l1 [decided: docs/book/extension/modules.md, Loading]

T32. Library, a module file that `ModuleLoader` loads into an extension. defined-at: ../extension/modules.md#loading-l1 [decided: docs/book/extension/modules.md, Loading]

T33. Owner module. defined-at: ../extension/modules.md#def-owner-module [decided: B-158 ruling, 2026-10-29]

T34. The evalSource pipeline. defined-at: ../concepts.md#def-the-evalsource-pipeline [decided: docs/book/concepts.md §29]

T35. Precompile, the stage of the evalSource pipeline that partially evaluates each function definition's body before the evaluation loop. defined-at: ../layers.md#def-precompile [decided: docs/book/layers.md §2]

T36. Post-pass, a check of the evalSource pipeline that runs after precompile or after the evaluation loop. defined-at: ../concepts.md#def-the-evalsource-pipeline [decided: docs/book/concepts.md §29]

## Claims

### Reader and authority

C1. This chapter is the design truth for the `pipeline` unit, unit 33 of the unit DAG. [decided: docs/plans/book-chapters-now.md §5, 2026-10-30]

C2. This chapter is the as-implemented home of the term the evalSource pipeline, whose definition site stays in the spine's §29 under ruling R9. [decided: owner, 2026-11-01]

C3. This chapter is delivered IR-only: no prose is rendered from this IR until a later stage that the maintainer schedules. [decided: docs/plans/book-chapters-now.md §3.1 and R8, 2026-10-30]

C4. The reader of this chapter has read the Part I chapters and the Part II chapters before this chapter, the evaluator chapter included. [decided: owner, 2026-11-01]

C5. Earlier chapters define every term this chapter uses except the evalSource pipeline, each term linked from this chapter's Terms section. [decided: owner, 2026-11-01]

C6. This chapter carries the Tier 1 authority that `docs/book/process.md` §1 gives every chapter of the book. [decided: docs/book/process.md §1]

C7. Each Claims sub-heading of this chapter carries the status tag that `docs/book/README.md` defines. [decided: docs/book/README.md, Status convention]

C8. This chapter holds no examples. [decided: docs/plans/book-chapters-now.md §5, 2026-10-30]

### The unit and its file [partial]

C9. The `pipeline` unit holds four decisions: the `evalSource` stage order; `CompilationReport`; the post-passes that halt; precompile. [decided: docs/book/units.md §4.4]

C10. The `pipeline` unit is the top of the unit DAG, the one unit allowed to import any other unit, because the unit's job is assembly. evidence: E1. [decided: docs/book/units.md §4.4]

C11. A decision found inside the `pipeline` unit belongs to another unit. [decided: docs/book/units.md §4.4]

C12. `scripts/analyze/units.json` maps `src/runtime.ts` to four units: `pipeline`, `composed-function`, `futures`, `core-types`. evidence: E1. [decided: owner, 2026-11-01]

C13. The `units` report lists `src/runtime.ts` among the five mixed files, the files whose split is owed. evidence: E2. [decided: owner, 2026-11-01]

C14. `src/index.ts`, the file of the `cli` unit, calls `evalSource` for a file run, a REPL entry, an inline `use grammar` block and the `inspect`, `verify`, `obligations` and `propose` subcommands. evidence: E3. [decided: owner, 2026-11-01]

C15. `ModuleLoader` in `src/modules.ts` calls `evalSource` to load each library. evidence: E4. [decided: owner, 2026-11-01]

C16. The evalSource pipeline realises three requirements: R2 (partial evaluation is the mechanism by which layers are added); R9 (the language surface is extensible); R14 (code is organised into separately-loadable units). [decided: docs/book/concepts.md §29]

### The evalSource pipeline [implemented]

C17. The evalSource pipeline runs once per call of `evalSource` in `src/runtime.ts`, over one source text. evidence: E5. [decided: owner, 2026-11-01]

C18. `evalSource` takes a source text and seven optional inputs: a base scope for REPL persistence; the extensions; a legacy Earley grammar extension; the `typed` flag; a future manager; the `softFail` flag; the module's scope name. evidence: E5. [decided: owner, 2026-11-01]

C19. `evalSource` returns the last bare expression's value, the evaluation scope, the compilation report and the dependency registry. evidence: E5. [decided: owner, 2026-11-01]

C20. The `typed` flag selects Allegro Standard. evidence: E5. [decided: owner, 2026-11-01]

C21. Literal typing, the divergence analysis, precompile and the post-passes before the evaluation loop run only when the `typed` flag is set. evidence: E8, E14, E15, E18. [decided: owner, 2026-11-01]

C22. `evalSource` first seals the channel registrations that earlier passes minted from Allegro code, through `bumpMetaEpoch`. evidence: E6. [decided: owner, 2026-11-01]

C23. `evalSource` next installs an `effects:diverges` analysis that answers "not analysed" until the divergence analysis of the pass has run. evidence: E6. [decided: owner, 2026-11-01]

C24. `evalSource` next collects the library-owned values of the call's extensions with `libraryOwnedValues`. evidence: E6. [decided: owner, 2026-11-01]

C25. `evalSource` merges the grammar fragments that the extensions carry into the base grammar, then parses the source with grammar2. evidence: E7. [decided: owner, 2026-11-01]

C26. Before parsing, `assertGrammarClean` refuses a fragment-extended grammar in which the grammar analyzer finds an error. evidence: E7. [decided: owner, 2026-11-01]

C27. `evalSource` parses with the Earley parser instead when the caller passes a legacy grammar extension. evidence: E7. [decided: owner, 2026-11-01]

C28. `buildProgram` turns the parse tree into the file context whose binding list every later stage walks. evidence: E7. [decided: owner, 2026-11-01]

C29. `evalSource` runs no `use` pre-scan. evidence: E5, E7. [decided: owner, 2026-11-01]

C156. Each caller of `evalSource` scans the `use` header, loads the named modules as extensions, then strips the header before the call. evidence: E3, E4. [decided: owner, 2026-11-01]

C30. Under the `typed` flag, `typeLiterals` gives each untyped Bits literal a type: Int for a Bits of 64 bits, String for any other Bits. evidence: E8. [decided: owner, 2026-11-01]

C31. `typeLiterals` leaves a Bits that already carries a type unchanged. evidence: E8. [decided: owner, 2026-11-01]

C32. `resolveSymbols` first replaces each primitive stub the parser left with the registered primitive of the stub's name. evidence: E9. [decided: owner, 2026-11-01]

C33. `resolveSymbols` replaces a Symbol naming a primitive, an extension's binding, a module or a base-scope binding with the named value. evidence: E9. [decided: owner, 2026-11-01]

C34. Under the `typed` flag, `resolveSymbols` resolves a primitive's name to the primitive wrapped as an `UntypedFunction`. evidence: E9. [decided: owner, 2026-11-01]

C35. `resolveSymbols` leaves a Symbol naming a source binding in place, to resolve through the evaluation scope at run time. evidence: E9. [decided: owner, 2026-11-01]

C36. `resolveSymbols` marks the binders among the `when` patterns through `markPatternBinders`. evidence: E9. [decided: owner, 2026-11-01]

C37. `markTailCallsInContext` runs `collapseBodyMetadata` over every binding before running `markTailCalls` over every composed function body. evidence: E10. [decided: owner, 2026-11-01]

C38. `collapseBodyMetadata` peels the `*_attach` wrappers off each function body, descending through `type_check`. evidence: E11. [decided: owner, 2026-11-01]

C157. `collapseBodyMetadata` stores each peeled wrapper's metadata as a property of the function. evidence: E11. [decided: owner, 2026-11-01]

C39. `markTailCalls` marks each Expression in tail position, which is where the evaluator's tail calls come from. evidence: E10, E12. [decided: owner, 2026-11-01]

C40. After marking, `evalSource` opens an evaluation-stats frame through `beginEvalStats` when `ALLEGRO_EVAL_STATS` is set or a stats sink is installed. evidence: E13. [decided: owner, 2026-11-01]

C41. The stats frame watches each named binding whose expression is unresolved, counting every later evaluation of the expression. evidence: E13. [decided: owner, 2026-11-01]

C42. `evalSource` clears the inline cutoff before every divergence analysis, leaving no pass with an earlier pass's cutoff. evidence: E14. [decided: owner, 2026-11-01]

C43. Under the `typed` flag, `analyzeDivergence` analyses the binding list for termination before precompile. evidence: E14. [decided: owner, 2026-11-01]

C44. `precompileFunctions` then precompiles the function definitions. evidence: E15, E16. [decided: owner, 2026-11-01]

C45. After precompile, four steps run in order: the totality notices; the divergence stamp; the `total` check; the effects declaration check with its opaque-effect notices. evidence: E18. [decided: owner, 2026-11-01]

C46. `buildEvalCtx` then builds the evaluation scope. evidence: E20. [decided: owner, 2026-11-01]

C47. The evaluation loop evaluates each binding of the binding list that has a value once, in source order. evidence: E22. [decided: owner, 2026-11-01]

C48. After the evaluation loop, `propagateCompletions` re-evaluates the dependents of the bindings that completed. evidence: E23. [decided: owner, 2026-11-01]

C49. After forward chaining, two post-passes run in order: the proof check; the `proven` check. evidence: E25, E26. [decided: owner, 2026-11-01]

C50. Last, `evalSource` registers each top-level binding name of the evaluation scope as a symbol under the module's scope name, or under `<main>`. evidence: E27. [decided: owner, 2026-11-01]

C51. `evalSource` closes the stats frame through `endEvalStats` before returning. evidence: E13. [decided: owner, 2026-11-01]

### What each stage may assume [implemented]

C52. `resolveSymbols` runs before `markTailCalls` because a tail call is recognised by its callee. [decided: docs/book/concepts.md §29]

C53. `markTailCalls` recognises a branching primitive or a body wrapper by the function position's kind and primitive name. evidence: E12. [decided: owner, 2026-11-01]

C54. `collapseBodyMetadata` runs before `markTailCalls`, letting `markTailCalls` compute tail positions on the function body without the body's `*_attach` wrappers. evidence: E10. [decided: owner, 2026-11-01]

C55. `collapseBodyMetadata` runs before `precompileFunctions` because analysers read function properties rather than peeling wrappers. [decided: docs/book/concepts.md §29]

C56. `typeLiterals` runs before `resolveSymbols`, while the tree `typeLiterals` walks holds no value an extension provides. evidence: E8, E9. [decided: owner, 2026-11-01]

C57. The divergence analysis reads the binding list, a type lookup and a leaf-effect resolver, never an output of precompile. evidence: E14. [decided: owner, 2026-11-01]

C58. Precompile runs after the divergence analysis, with the inline cutoff already installed while precompile speculates. evidence: E14. [decided: owner, 2026-11-01]

C59. The divergence stamp runs after precompile, because the stamp extends the inferred effect sets that precompile writes. evidence: E18. [decided: owner, 2026-11-01]

C60. The termination analysis writes `div` into the inferred effect sets before the effects declaration check. [decided: CE-R1]

C61. The divergence stamp runs before the effects declaration check in `evalSource`, putting `div` into the inferred sets that the check compares with the declarations. evidence: E18. [decided: owner, 2026-11-01]

C62. `buildEvalCtx` takes the source bindings as `resolveSymbols` left them. evidence: E20. [decided: owner, 2026-11-01]

C63. The `proven` check reads the evaluation scope that the evaluation loop filled. evidence: E26. [decided: owner, 2026-11-01]

### The post-passes that halt [implemented]

C64. A failed proof, an undeclared effect with `div` included, or a failed refinement or type annotation halts compilation, in libraries exactly as in user code. [decided: docs/book/standard/README.md; CE-R1]

C65. Two paths are weaker than a halt: a construction-path invariant failure yields an error value; a non-exhaustive match yields an info notification. [decided: CE-R8]

C66. Promoting either weaker path to a halt is a maintainer decision. [decided: CE-R8]

C67. A halting post-pass records each failure as an error notification in the compilation report before throwing. evidence: E18, E25, E26. [decided: owner, 2026-11-01]

C68. With the `softFail` flag set, a halting post-pass records the error notifications without throwing. evidence: E5, E18, E25, E26. [decided: owner, 2026-11-01]

C69. The `verify`, `obligations` and `propose` subcommands run `evalSource` with the `softFail` flag set, for a verdict that describes the failures. evidence: E3. [decided: owner, 2026-11-01]

C70. The `total` check halts on a function declared `total` whose `div` is undischarged, whether the function's own or inherited through a call. evidence: E18. [decided: owner, 2026-11-01]

C71. `total` is the per-function strict opt-in. [decided: CE-R3]

C72. The effects declaration check halts on each function whose inferred effects exceed the function's declared effects, the `opaque` label ignored. evidence: E18. [decided: owner, 2026-11-01]

C73. The proof check halts on each binding whose value is a Proof with a false `discharged` field. evidence: E25. [decided: owner, 2026-11-01]

C74. The `proven` check halts on each `proven` clause that a sampled argument falsifies, reporting the counterexample. evidence: E26. [decided: owner, 2026-11-01]

C75. A failed type or refinement annotation check throws from the `type_check` primitive when the evaluation applies the annotated function. evidence: E24. [decided: owner, 2026-11-01]

C76. `evalSource` catches no error that the evaluation loop throws. evidence: E22. [decided: owner, 2026-11-01]

C77. A failed annotation check in an applied function halts compilation. [inferred: R1]

C78. Five notification kinds are info and never halt: `totality-exhaustiveness`; `totality-nontermination`; the needs-annotation notice; `effects-opaque-from-stdlib-hof`; `proven-skipped`. evidence: E18, E26. [decided: owner, 2026-11-01]

C79. Precompile records three error-severity notification kinds without halting: `precompile-eval`, `precompile-type-error`, `return-type-mismatch`. evidence: E16, E18. [decided: owner, 2026-11-01]

C80. A function whose declared return type differs from the function's inferred return type halts compilation only when the evaluation applies the function. evidence: E16, E24, E39. [decided: owner, 2026-11-01]

### Precompile [implemented]

C81. `precompileFunctions` returns an empty compilation report when the `typed` flag is unset. evidence: E15. [decided: owner, 2026-11-01]

C82. During precompile, `precompileFunctions` suspends law-obligation instantiation, leaving definition-time semantics to the evaluation loop. evidence: E15. [decided: owner, 2026-11-01]

C83. `precompileFunctions` marks the precompile period for the evaluation stats through `setEvalStatsPrecompile`. evidence: E15. [decided: owner, 2026-11-01]

C84. The precompile context is one Structure binding the primitives, each extension's bindings and module object, then the source bindings. evidence: E16. [decided: owner, 2026-11-01]

C85. A source binding whose value is neither resolved nor a function definition enters the precompile context as a memo entry. evidence: E16, E19. [decided: owner, 2026-11-01]

C86. A memo entry evaluates the binding's expression at the first lookup, keeping the result for every later lookup. evidence: E19. [decided: owner, 2026-11-01]

C87. A lookup made while a memo entry's own evaluation runs reads the unevaluated expression. evidence: E19. [decided: owner, 2026-11-01]

C160. A source binding whose value is a function definition enters the precompile context as a definition entry. evidence: E16, E41. [proposed: this IR]

C161. A definition entry evaluates the function definition at the first lookup, every later lookup returning the object that the definition entry binds. evidence: E41. [proposed: this IR]

C162. A lookup made while a definition entry's first evaluation runs evaluates the function definition again, re-entrantly. evidence: E41. [proposed: this IR]

C163. A definition entry binds the first object that any evaluation of the entry's function definition returns, dropping the result of an evaluation that returns later. evidence: E41. [proposed: this IR]

C164. In a recursive definition, the re-entrant lookup comes from the F3b inline-lambda precompile in `typed_function_impl`, which reaches the body's recursive call while `typed_function_impl` builds the typed function. evidence: E41, E42. [proposed: this IR]

C165. A definition entry whose evaluation throws binds nothing, leaving the next lookup to evaluate the function definition afresh. evidence: E41. [proposed: this IR]

C166. Precompile partially evaluates the object that a function definition's entry binds, the object to which every reference during precompile resolves. evidence: E16. [proposed: this IR]

C88. Precompile evaluates only the bindings whose value is a function definition: a function literal, or `typed_function` over a function literal. evidence: E16, E17. [decided: owner, 2026-11-01]

C89. A function definition whose evaluation throws yields a `precompile-eval` notification and no precompile. evidence: E16. [decided: owner, 2026-11-01]

C90. Precompile gives a typed function's placeholders the function's declared parameter types. evidence: E16. [decided: owner, 2026-11-01]

C91. Precompile gives an untyped function's placeholders, and a bare composed function's placeholders, no type. evidence: E16. [decided: owner, 2026-11-01]

C92. Precompile skips a function in the library-owned values of the call's extensions. evidence: E6, E16. [decided: owner, 2026-11-01]

C93. `precompileFunction` in `src/evaluator.ts` partially evaluates the function body over the placeholders. evidence: E28. [decided: owner, 2026-11-01]

C158. `precompileFunction` writes the inferred effect set onto the given function, as the function's `inferredEffects` property. evidence: E28. [decided: owner, 2026-11-01]

C94. Each error that `precompileFunction` returns becomes a `precompile-type-error` notification. evidence: E16. [decided: owner, 2026-11-01]

C95. Precompile records each inferred return type in the compilation report's `inferred` list. evidence: E16. [decided: owner, 2026-11-01]

C96. Precompile reports `return-type-mismatch` when a declared return type other than Any names a different type than a known inferred return type. evidence: E16. [decided: owner, 2026-11-01]

C97. Precompile lists each source binding that has no value in the compilation report's `unresolved` list. evidence: E16. [decided: owner, 2026-11-01]

C167. Precompile marks the function literal of a top-level definition through `markPrecompiledByPass` in `src/primitives.ts` once precompile of the definition returns no error. evidence: E16, E42. [proposed: this IR]

C168. `evalSource` hands precompile the function literals to mark, the literals that `analyzeDivergence` peels, only when the call compiles a program rather than loading a module. evidence: E30, E43. [proposed: this IR]

C169. In the evaluation loop, `typed_function_impl` skips the F3b inline-lambda precompile of a function literal that precompile marked. evidence: E42. [proposed: this IR]

C98. The inline cutoff is the hook, installed through `setInlineCutoff`, that tells `applyComposed` which callees to leave as residuals when an argument is unresolved. evidence: E14, E29. [decided: owner, 2026-11-01]

C170. The inline cutoff's first set holds the object that each recursive binding is bound to in the precompile context. evidence: E14, E16. [proposed: this IR]

C171. The precompile context adds a recursive binding's object to the inline cutoff's first set when the precompile context binds the object. evidence: E16, E41. [proposed: this IR]

C172. The inline cutoff's second set holds the body of each composed function in the inline cutoff's first set. evidence: E41. [proposed: this IR]

C100. `analyzeDivergence` reports a binding as recursive when the binding's function calls into its own recursion cycle, whatever the binding's discharge tier. evidence: E30. [decided: owner, 2026-11-01]

C173. The inline cutoff answers true by either of two identity tests: the callee is an object in the first set, or the callee's body is in the second set. evidence: E14. [proposed: this IR]

C174. The second identity test recognises a copy of a bound function made outside the precompile context, because the copy shares the bound function's body. evidence: E14. [proposed: this IR]

C102. `evalSource` installs no inline cutoff when no binding is recursive. evidence: E14. [decided: owner, 2026-11-01]

C175. B-159 (precompile of recursive definitions) restored the inline cutoff for typed functions at chunk R2, after B-121 (metadata on every kind) chunk C2 had left the cutoff inert for typed functions. [decided: docs/plans/recursive-precompile.md §7, the R2 record, merged 2026-11-01]

C104. With `ALLEGRO_EVAL_STATS=1`, the evaluator prints one stderr line of counts per run, at process exit. evidence: E13. [decided: owner, 2026-11-01]

C105. An installed stats sink receives one report per `evalSource` call. evidence: E13. [decided: owner, 2026-11-01]

### The phases and the futures [partial]

C106. The spine's §28 gives the cell semantics this section relies on: a cell is filled once, monotonically, and forward chaining re-evaluates what residualised on the cell. [decided: docs/book/concepts.md §28]

C107. `buildEvalCtx` builds the evaluation scope as a chain of four layers, rootmost first: the primitives; the extensions; the base scope; the source bindings. evidence: E20. [decided: owner, 2026-11-01]

C108. Under the `typed` flag, the primitives layer holds each primitive wrapped as an `UntypedFunction`. evidence: E20. [decided: owner, 2026-11-01]

C109. `buildEvalCtx` copies each binding of the base scope into a fresh layer, keeping the evaluation's writes out of the previous pass's scope. evidence: E20. [decided: owner, 2026-11-01]

C110. A declared source binding with no value and no provider below the source layer becomes a pending future cell in the source layer. evidence: E20. [decided: owner, 2026-11-01]

C111. `evalSource` creates a fresh dependency registry per call. evidence: E21. [decided: owner, 2026-11-01]

C112. The dependency registry tracks the binding objects of the evaluation scope's source layer, not copies. evidence: E21, E22. [decided: owner, 2026-11-01]

C113. When a future manager is passed, `evalSource` points the manager at the new dependency registry and evaluation scope. evidence: E21. [decided: owner, 2026-11-01]

C114. The evaluation loop evaluates each binding with a dependency collector, which records the unresolved names the evaluation met. evidence: E22. [decided: owner, 2026-11-01]

C115. The evaluation loop writes a named binding's value into the binding's cell in the evaluation scope. evidence: E22. [decided: owner, 2026-11-01]

C116. A named binding whose value stays unresolved is registered as a dependent of each name the binding's collector recorded. evidence: E22. [decided: owner, 2026-11-01]

C117. A resolved named binding's value carries the binding's source expression on the `source` channel, unless the value is a Structure. evidence: E22. [decided: owner, 2026-11-01]

C118. A bare expression whose value stays unresolved with recorded dependencies gets a synthetic cell, named `__bare_<n>`, in the dependency registry and the evaluation scope. evidence: E22. [decided: owner, 2026-11-01]

C119. `propagateCompletions` works in passes, each pass re-evaluating the dependents of the names that the previous pass completed. evidence: E23. [decided: owner, 2026-11-01]

C120. `propagateCompletions` stops at the first pass that completes no new binding. evidence: E23. [decided: owner, 2026-11-01]

C121. A completed binding that still holds a pending future in a data slot gets a refined value in the binding's cell when the future lands. evidence: E23. [decided: owner, 2026-11-01]

C122. `applyPhase` resolves each named cell in place, or adds a binding for a new name, before running `propagateCompletions`. evidence: E31. [decided: owner, 2026-11-01]

C123. `applyPhase` throws on a cell that is already complete, because a future or import cell is written once. evidence: E31. [decided: owner, 2026-11-01]

C124. The future manager settles each resolved or rejected promise through `applyPhase`, first into the pass that minted the future. evidence: E32. [decided: owner, 2026-11-01]

C125. Outside the suite, the future manager in `src/futures.ts` is the only caller of `applyPhase`. evidence: E33. [decided: owner, 2026-11-01]

C126. The multi-phase build surface is undesigned: the T-build track, not this chapter, designs the surface. [decided: docs/plans/book-chapters-now.md R3, 2026-10-30]

C127. A library is loaded once per process, every `ModuleLoader` reading one library cache. [decided: docs/book/extension/modules.md, Loaded once per process]

C128. The library cache keys a library by the resolved path plus a hash of the file's text. evidence: E4. [decided: owner, 2026-11-01]

C129. A hit in the library cache also compares the file's text itself. evidence: E4. [decided: owner, 2026-11-01]

C130. A library's load runs `evalSource` with the `typed` flag set, the `softFail` flag unset and the library's resolved path as the module's scope name. evidence: E4. [decided: owner, 2026-11-01]

C131. A library's values are immutable after load: a module writes only into values the module owns. [decided: docs/book/extension/modules.md, B-158 ruling, 2026-10-29]

C132. `libraryOwnedValues` collects each extension's binding values and each module object's field values. evidence: E6. [decided: owner, 2026-11-01]

C133. Membership in the library-owned values is by reference, which puts the library's own function in the set for an alias `f = lib_f`. evidence: E6. [decided: owner, 2026-11-01]

C134. The divergence stamp skips a function in the library-owned values. evidence: E18. [decided: owner, 2026-11-01]

C135. The member re-keying in the evaluation loop, `stabilizeTypeMemberScope`, is write-once: a library type keeps the member scope the library's load gave the type. [decided: docs/book/extension/modules.md, B-158 ruling, 2026-10-29]

### What the unit still owes [partial]

C136. The `pipeline` unit owes three moves out of `src/runtime.ts`: `typeLiterals` to `core-types` (unit 24); `DependencyRegistry` to `futures` (unit 14); the clone helpers to `composed-function` (unit 7). [decided: docs/book/units.md §4.4]

C137. M3 (`typeLiterals` is in the pipeline) puts the raw-literal typing rule in `core-types`, with the pipeline's stage calling the rule. [decided: docs/book/units.md §6.1]

C138. The `futures` unit's row names `DependencyRegistry` and `applyPhase` in `src/runtime.ts` among the unit's homes today. [decided: docs/book/units.md §4.1]

C139. `src/runtime.ts` clones a composed function at three sites: `typeLiterals`, `resolveNamedParams`, `resolveNamedParamsInner`. evidence: E8, E9. [decided: owner, 2026-11-01]

C140. Each of the three clone sites in `src/runtime.ts` carries the function's metadata with `carryMeta`. evidence: E8, E9. [decided: owner, 2026-11-01]

C159. Each of the three clone sites in `src/runtime.ts` copies the `genericParams` property by hand. evidence: E8, E9. [decided: owner, 2026-11-01]

C141. Every code path that clones a composed function must preserve the function's metadata through the shared helpers. [decided: docs/book/process.md §6]

C142. A unit moves when the unit is next touched for other reasons, with no campaign. [decided: docs/book/units.md §7]

C143. Neither a backlog item nor a row of the move table in `docs/book/units.md` §7 schedules any of the three moves the `pipeline` unit owes. evidence: E35, E36. [decided: owner, 2026-11-01]

C144. The post-passes are Allegro Standard concepts running in the pipeline, as layer stages hardcoded into the base's stage list. [decided: docs/book/concepts.md §29]

C145. A layer should register a post-pass, by the plane-interface fix shape of the spine's §24. [decided: docs/book/concepts.md §29]

C146. B-110 (the L0 evaluator implements the L2 type system) owns the registration of post-passes, as a scope note. [decided: docs/book/concepts.md §29]

### Where the code is, and what pins it [implemented]

C147. `src/runtime.ts` holds `evalSource`, `typeLiterals`, `resolveSymbols`, `precompileFunctions`, `buildEvalCtx`, `propagateCompletions`, `applyPhase` and `libraryOwnedValues`. evidence: E5, E6, E8, E9, E15, E20, E23, E31. [decided: owner, 2026-11-01]

C148. The suite runs every literate demo under `tests/` through `evalSource`, checking each demo's `// expect:` lines. evidence: E37. [decided: owner, 2026-11-01]

C149. Named tests pin the four halting post-passes: the proof check, the `proven` check, the effects declaration check, the `total` check. evidence: E38. [decided: owner, 2026-11-01]

C150. `src/test/totality.ts` pins the exhaustiveness notice as info. evidence: E38. [decided: owner, 2026-11-01]

C151. `src/test/async-futures.ts` pins the single write of a future cell through `applyPhase`. evidence: E38. [decided: owner, 2026-11-01]

C152. `src/test/language.ts` pins the re-evaluation of dependents through `applyPhase`. evidence: E38. [decided: owner, 2026-11-01]

C153. `src/test/modules.ts` pins the library cache and the owner-module invariant. evidence: E34, E38. [decided: owner, 2026-11-01]

C154. `npm run lint:units` pins the mapping of `src/runtime.ts` in `scripts/analyze/units.json`. evidence: E40. [decided: owner, 2026-11-01]

C155. `npm run lint:load` pins the parse counts of the load corpus that the pipeline parses. evidence: E40. [decided: owner, 2026-11-01]

### Clusters

G1. cluster: C1, C2, C3, C4, C5 [decided: owner, 2026-11-01]

G2. cluster: C6, C7, C8 [decided: owner, 2026-11-01]

G3. cluster: C9, C10, C11, C12, C13 [decided: owner, 2026-11-01]

G4. cluster: C14, C15, C16 [decided: owner, 2026-11-01]

G5. cluster: C17, C18, C19, C20, C21 [decided: owner, 2026-11-01]

G6. cluster: C22, C23, C24 [decided: owner, 2026-11-01]

G7. cluster: C25, C26, C27, C28, C29, C156 [decided: owner, 2026-11-01]

G8. cluster: C30, C31, C32, C33, C34, C35, C36 [decided: owner, 2026-11-01]

G9. cluster: C37, C38, C157, C39, C40, C41 [decided: owner, 2026-11-01]

G10. cluster: C42, C43, C44, C45, C46, C47, C48, C49, C50, C51 [decided: owner, 2026-11-01]

G11. cluster: C52, C53, C54, C55, C56 [decided: owner, 2026-11-01]

G12. cluster: C57, C58, C59, C60, C61, C62, C63 [decided: owner, 2026-11-01]

G13. cluster: C64, C65, C66 [decided: owner, 2026-11-01]

G14. cluster: C67, C68, C69 [decided: owner, 2026-11-01]

G15. cluster: C70, C71, C72, C73, C74 [decided: owner, 2026-11-01]

G16. cluster: C75, C76, C77, C78, C79, C80 [decided: owner, 2026-11-01]

G17. cluster: C81, C82, C83, C84, C85, C86, C87 [decided: owner, 2026-11-01]

G29. cluster: C160, C161, C162, C163, C164, C165, C166 [proposed: this IR]

G18. cluster: C88, C89, C90, C91, C92, C93, C158, C94, C95, C96, C97 [decided: owner, 2026-11-01]

G31. cluster: C167, C168, C169 [proposed: this IR]

G30. cluster: C98, C170, C171, C172, C100, C173, C174, C102, C175 [proposed: this IR]

G20. cluster: C104, C105 [decided: owner, 2026-11-01]

G21. cluster: C106, C107, C108, C109, C110 [decided: owner, 2026-11-01]

G22. cluster: C111, C112, C113, C114, C115, C116, C117, C118 [decided: owner, 2026-11-01]

G23. cluster: C119, C120, C121, C122, C123, C124, C125, C126 [decided: owner, 2026-11-01]

G24. cluster: C127, C128, C129, C130 [decided: owner, 2026-11-01]

G25. cluster: C131, C132, C133, C134, C135 [decided: owner, 2026-11-01]

G26. cluster: C136, C137, C138, C139, C140, C159, C141, C142, C143 [decided: owner, 2026-11-01]

G27. cluster: C144, C145, C146 [decided: owner, 2026-11-01]

G28. cluster: C147, C148, C149, C150, C151, C152, C153, C154, C155 [decided: owner, 2026-11-01]

## Relations

R1. C77 depends-on C75 because an annotation check throws from `type_check` during the evaluation loop, and C76 states that `evalSource` lets that throw through.

R2. C59 depends-on C158 because the divergence stamp adds `div` to the inferred effect set that `precompileFunction` writes onto each function.

R3. C58 depends-on C170 because the inline cutoff's first set holds the objects of the recursive bindings that the divergence analysis reports before precompile binds them.

R4. C80 refines C64 because the annotation check that halts is the evaluation's `type_check` (C75), while precompile's comparison of the declared and inferred return types only reports (C79).

R5. C29 refines T34 because the parse stage of the evalSource pipeline starts from a source text whose `use` header the caller has already removed.

R6. C123 refines C106 because the throw is how `applyPhase` keeps each cell to one write.

R7. C143 depends-on C136 because the three moves C136 names are the ones no item schedules.

R8. C92 refines C131 because precompile's write of the inferred effect set would otherwise reach a library's function through an alias.

R9. C134 refines C131 because the divergence stamp would otherwise reach a library's function through an alias.

R10. C125 supports C126 because no code drives a phase other than an arriving future.

R11. C61 refines C60 because the stamp in `evalSource` is where the termination analysis's `div` enters the inferred sets.

R12. C170 depends-on C161 because the first identity test sees one object per definition only when every lookup of the definition returns the bound object.

R13. C174 refines C173 because the second identity test exists for the copies of a bound function that the first identity test misses.

R14. C169 depends-on C167 because the skip in `typed_function_impl` reads the mark that precompile writes.

## Evidence

E1. `scripts/analyze/units.json` lines 39 and 54: the `pipeline` unit's dependencies are `*`, and `src/runtime.ts` is mapped to `pipeline`, `composed-function`, `futures` and `core-types`.

E2. `npx tsx scripts/analyze/index.ts units`, run on this branch on 2026-11-01: five mixed files, `src/runtime.ts` among them with the four units of E1.

E3. `src/index.ts` lines 115–227 (`runFile`: `scanUses`, the `use` modules loaded, the inline `use grammar` block evaluated at line 187, the header stripped at line 209, the imports loaded, `evalSource` at line 216, any error printed and exit code 1), lines 248–253 (the REPL), 383–414 (`inspect`), 442–470 (`pcpLoadAndEval`, `softFail` true at line 468) and 475–557 (`verify`, `obligations` and `propose` call `pcpLoadAndEval`).

E4. `src/modules.ts` lines 188–227 (the process's library cache, keyed by path and content hash, a hit comparing the text), 331–340 (the cache answers first), 357–404 (the `use` pre-scan and the header strip), 409–431 (`evalSource` with `typed` true, `softFail` undefined, the resolved path as scope name) and 493 (the cache written).

E5. `src/runtime.ts` lines 1157–1188 and 1754: the `evalSource` signature, the seven optional inputs with `softFail` documented as "push their notifications as usual but do NOT throw", and the returned value, scope, report and registry.

E6. `src/runtime.ts` lines 1189–1200 and 652–674: `bumpMetaEpoch`, the `diverges` analysis installed as `() => null` under the effects writer, `libraryOwnedValues` collecting extension binding values and module-object field values by reference.

E7. `src/runtime.ts` lines 1201–1248: line endings normalised, grammar fragments gathered from the extensions, the Earley fallback, `getGrammarWithFragments`, `assertGrammarClean`, `parseSource`, `buildProgram`.

E8. `src/runtime.ts` lines 31–80 and 1250–1257: `typeLiterals` (a typed Bits returned as is, a 64-bit Bits typed Int, any other String; the composed-function clone with `carryMeta` and `genericParams` at lines 61–71), called per binding under `typed`.

E9. `src/runtime.ts` lines 82–124, 126–243, 285–450 and 1259–1260: `resolvePrimitives`; `resolveSymbols` (primitives wrapped under `typed` at 156–163, extensions and module objects at 165–175, the base scope at 177–186, stubs at 188–199, pattern binders at 213–224, source names left as Symbols at 236–242); `resolveNamedParams` and `resolveNamedParamsInner`, each cloning a composed function with `carryMeta` and `genericParams` (329–356, 413–437); the call after `typeLiterals`.

E10. `src/runtime.ts` lines 452–483 and 1262–1263: `markTailCallsInContext` collapses body-form metadata over every binding before marking, so that tail positions are computed on the real body; `markTailCalls` per composed function body.

E11. `src/totality.ts` lines 43–115: `collapseOneFunction` peels the `*_attach` chain, descending through `type_check`, into function properties; `collapseBodyMetadata` over every reachable composed function.

E12. `src/evaluator.ts` lines 245–332: `markTailCalls` sets the tail mark and recognises `eval_if`, `eval_when` and the body wrappers by `fn.kind` and primitive name.

E13. `src/evaluator.ts` lines 44–50, 116–122 and 148–210, with `src/runtime.ts` lines 1265–1273 and 1753: the stats switch and sink, the exit line, `beginEvalStats`, `watchBindingExpr` per named unresolved binding, `endEvalStats`.

E14. `src/runtime.ts` lines 1275–1390 and `src/evaluator.ts` lines 26–42: the divergence analysis ahead of precompile and consuming none of its output, `setInlineCutoff(null)` at line 1285, `analyzeDivergence` at line 1350, the cutoff installed at lines 1383–1389 only when a binding is recursive, with two sets that precompile fills, answering `cutoffCfns.has(fnValue)` or, for a composed function, `cutoffBodies.has(fnValue.body)`; the comment at lines 1371–1382 naming the evaluation loop's `withType` copy as the case the body test covers.

E15. `src/runtime.ts` lines 676–703: `precompileFunctions` returns an empty report when untyped, suspends law instantiation and marks the stats precompile period around the pass.

E16. `src/runtime.ts` lines 705–890 (`precompileFunctionsInner`): the precompile context; at lines 739–756 a resolved source binding entered as the value, a function definition as a definition entry, any other binding as a memo entry, a recursive binding's object handed to `addCutoffBound`; the loop reading a definition's entry at line 775; `precompile-eval` on a throw; typed and untyped placeholders; the library-owned skip at line 824; `markPrecompiledByPass` at line 841 after a precompile with no error; `precompile-type-error`, `inferred`, `return-type-mismatch`, `unresolved`; no throw.

E17. `src/effects.ts` lines 173–180: `isFunctionDefinition`, the shapes `asFunction` peels, which precompile evaluates.

E18. `src/runtime.ts` lines 1405–1522: precompile called; the info notices (exhaustiveness, nontermination, needs-annotation) at 1414–1442; the stamp, skipping library-owned functions, at 1443–1460; the `total` check and its throw at 1461–1479; the `diverges` analysis installed at 1483–1493; the effects declaration check and its throw at 1495–1513; the opaque info notices at 1514–1379.

E19. `src/runtime.ts` lines 547–575: `precompileMemoEntry` evaluates on first lookup, keeps the result, reads the expression during its own evaluation, keeps nothing on a failure.

E20. `src/runtime.ts` lines 892–992 and 1524: `buildEvalCtx`, the four-layer chain, the typed primitive wrapping, the base copied into a fresh layer, source bindings "already resolved by resolveSymbols", pending cells for unprovided names.

E21. `src/runtime.ts` lines 1013–1029 and 1525–1532: `DependencyRegistry` shares the scope's binding objects; a fresh registry per call; the future manager pointed at the registry and scope.

E22. `src/runtime.ts` lines 1561–1678: the evaluation loop in binding-list order, the dependency collector, the `__bare_<n>` cells, type naming and `stabilizeTypeMemberScope`, `withSource` on resolved non-Structure values, `resolveCell` into the scope's binding, dependents registered; no try or catch around it.

E23. `src/runtime.ts` lines 1040–1109 and 1680–1683: `propagateCompletions`, iterative passes until none completes a binding, the in-place refinement of a complete binding's pending data slot.

E24. `src/primitives.ts` lines 2656–2827: `type_check_impl` throws an `AllegroError` for a refinement predicate that fails (line 2764) and for a type mismatch (line 2789, and lines 2731, 2802, 2807, 2822).

E25. `src/runtime.ts` lines 1565–1589 and 1685–1704, with `src/proofs.ts` lines 41–50: failed proofs collected during the loop, `proof-failure` notifications, the throw unless `softFail`; `isFailedProof` reads a false `discharged` field on a Proof.

E26. `src/runtime.ts` lines 1706–1739, with `src/proven.ts` lines 180–284: `checkProvenClauses` over the evaluation scope, `proven-skipped` info, `proven-failed` errors with counterexamples, the throw unless `softFail`.

E27. `src/runtime.ts` lines 1741–1751: `registerScopeSymbol` for every binding name of the scope except the bare and future cells, under the module's scope name or `<main>`.

E28. `src/evaluator.ts` lines 1009–1109: `precompileFunction` evaluates the body over placeholders and writes `inferredEffects` onto the function.

E29. `src/evaluator.ts` lines 771–796: `applyComposed` returns a residual for a call the cutoff names when any argument is unresolved.

E30. `src/totality.ts` lines 520–531 and 560–582: `recursiveBindings`, computed from strongly connected components before any tier-specific exit; `stampTargets`, the collapsed function per binding.

E31. `src/runtime.ts` lines 1111–1151: `applyPhase` resolves an existing cell in place, adds a new binding otherwise, throws on a complete cell (D33 write-once), then calls `propagateCompletions`.

E32. `src/futures.ts` lines 44–86: `createFuture` mints a pending cell and settles the resolved value, or an error value on rejection, through `applyPhase` into the minting pass first.

E33. Search of `src/` on 2026-11-01 for `applyPhase(`: outside `src/test/` and `src/boundary-tests.ts`, the calls are at `src/futures.ts` lines 82 and 84.

E34. `src/test/modules.ts` lines 278–340: the test `module: B-158` snapshots a library's values, runs two aliasing programs and asserts the snapshot unchanged.

E35. `docs/backlog.md`, searched on 2026-11-01 for `typeLiterals`, `DependencyRegistry`, `applyPhase` and "clone helper": no entry schedules a move; `applyPhase` appears only in the closed B-013 entry.

E36. `docs/book/units.md` lines 443–451: the §7 move table names moves of `slots.ts`, `evaluator.ts`, `scope.ts`, `types.ts`, `modules.ts`, `primitives.ts` and `types-std.ts`, none of `src/runtime.ts`.

E37. `src/test/alg-files.ts` lines 64–218 and `src/test/index.ts` lines 15–37: `runAlgFile` evaluates each literate demo through `evalSource` and validates its `// expect:` lines; the index imports every test area.

E38. `src/test/proofs.ts` lines 34–37 ("Phase F1: verify with a false proposition halts with counterexample") and 583–592 ("Phase F7: a non-tautology fails with a concrete counterexample"); `src/test/effects.ts` lines 92–112 ("Phase D1: declaring pure when print is used halts compilation"); `src/test/async-futures.ts` lines 108–117 (future cells are write-once) and 322–330 (`total` is the strict opt-in); `src/test/totality.ts` lines 79–82 (non-exhaustive Bool fires `totality-exhaustiveness`); `src/test/language.ts` lines 266–285 (`applyPhase` triggers re-evaluation); `src/test/modules.ts` lines 194–257 (the P2 library-cache tests).

E39. A run on this branch on 2026-11-01 of `npx tsx src/index.ts` over two scratch files: `f(x: Int): String => x + 1` followed by `print("ran")` printed "ran" and exited 0; the same definition followed by `print(f(2))` printed "Type error: expected String, got Int" and exited 1.

E40. `package.json` lines 24–25: `lint:units` runs `scripts/analyze/index.ts units --check`; `lint:load` runs `bench/load.ts --check`.

E41. `src/runtime.ts` lines 577–650: `PrecompileCutoff` with the recursive names, the bound objects and their bodies; `addCutoffBound` adding an object and, for a composed function, the object's body; `precompileDefinitionEntry` evaluating on the first lookup, a lookup during that evaluation evaluating the definition re-entrantly, the first object built bound and handed to `onBound`, a later result dropped, nothing kept on a throw.

E42. `src/primitives.ts` lines 1906–1921 and 2172–2200: `_precompiledByPass`, a WeakSet of the literals precompile covered, filled only through `markPrecompiledByPass`; the F3b inline-lambda precompile in `typed_function_impl`, skipped at line 2189 for a literal in that set, its comment stating that the precompile still runs inside the pass and writes the literal's `inferredEffects`.

E43. `src/runtime.ts` lines 1391–1406: `covered` set to `analyzeDivergence`'s `stampTargets` only when `moduleFqn` is undefined, then passed to `precompileFunctions`; the comment listing the cases not covered: a nested lambda, an untyped program, a module's load.

## Asks

A1. Ratify in bulk the proposed claims, every claim about the code as implemented and the two about the chapter's reader and terms: C4, C5, C12, C13, C14, C15, C17, C18, C19, C20, C21, C22, C23, C24, C25, C26, C27, C28, C29, C30, C31, C32, C33, C34, C35, C36, C37, C38, C39, C40, C41, C42, C43, C44, C45, C46, C47, C48, C49, C50, C51, C53, C54, C56, C57, C58, C59, C61, C62, C63, C67, C68, C69, C70, C72, C73, C74, C75, C76, C78, C79, C80, C81, C82, C83, C84, C85, C86, C87, C88, C89, C90, C91, C92, C93, C94, C95, C96, C97, C98, C100, C102, C104, C105, C107, C108, C109, C110, C111, C112, C113, C114, C115, C116, C117, C118, C119, C120, C121, C122, C123, C124, C125, C128, C129, C130, C132, C133, C134, C139, C140, C143, C147, C148, C149, C150, C151, C152, C153, C154, C155, C156, C157, C158, C159. Depends: C4, C5, C12, C13, C14, C15, C17, C18, C19, C20, C21, C22, C23, C24, C25, C26, C27, C28, C29, C30, C31, C32, C33, C34, C35, C36, C37, C38, C39, C40, C41, C42, C43, C44, C45, C46, C47, C48, C49, C50, C51, C53, C54, C56, C57, C58, C59, C61, C62, C63, C67, C68, C69, C70, C72, C73, C74, C75, C76, C78, C79, C80, C81, C82, C83, C84, C85, C86, C87, C88, C89, C90, C91, C92, C93, C94, C95, C96, C97, C98, C100, C102, C104, C105, C107, C108, C109, C110, C111, C112, C113, C114, C115, C116, C117, C118, C119, C120, C121, C122, C123, C124, C125, C128, C129, C130, C132, C133, C134, C139, C140, C143, C147, C148, C149, C150, C151, C152, C153, C154, C155, C156, C157, C158, C159.

A1 resolved: ratified by the owner at the merge of PR #132, 2026-11-01; the claims carry decided provenance from that date.

A2. Ratify or strike the proposed term the evalSource pipeline (T34); the term tail call (T27) is proposed by the evaluator chapter's IR and rides that IR's own ratification ask. Depends: C2, C17, C45, C49.

A2 resolved: ratified by the owner at the merge of PR #132, 2026-11-01. Ruling R9 was taken on 2026-11-01 as option (a): the spine's §29 stays the definition site of the evalSource pipeline, T34 links to it, and the chapter is the as-implemented home; precompile (T35) is defined in docs/book/layers.md §2, before its first use in reading order.

A3. Ratify in bulk the re-synced claims about the precompile context, the inline cutoff and the skipped F3b inline-lambda precompile, as chunks R2 and R3 of B-159 left the code, with their clusters G29, G30 and G31: C160, C161, C162, C163, C164, C165, C166, C167, C168, C169, C170, C171, C172, C173, C174. Depends: C160, C161, C162, C163, C164, C165, C166, C167, C168, C169, C170, C171, C172, C173, C174.
