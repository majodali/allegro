# IR: The evaluator

Reader: RD-4
Purpose: document. The book's chapter on the `evaluator` unit (unit 13): evaluation and partial evaluation as implemented, application and substitution, tail calls, the scope carve-out, the install surface, and the edges the unit still owes.
Status: delivered (count 1 stopped at round 7, 2026-10-31, ruled not readable by the meta-review of 2026-11-02, count 2 at the next edit; ratified at the merge of PR #129, 2026-11-01; unratified terms 0; footprint: declared 9, changed 10, surprises 1, misses 0; edited 2026-11-03: evidence re-pointed to the current lines of `src/evaluator.ts`, `src/primitives.ts`, `src/runtime.ts` and the suite after stream P and B-172's chunk C1, no claim changed; edited 2026-11-03: the switch in `evaluate` given its default arm by B-172's chunk C5 (claims C173 to C177 and cluster G35; C151, C158, C164, C165, cluster G7 and evidence E48 removed; relation R1 re-pointed), unratified terms 0; edited 2026-11-03: speculative evaluation and the branch tail call by B-172's chunk C2 (claims C178 to C188, clusters G36 and G37; C52, C56, C57, C98, clusters G13 and G23 removed; relation R2 re-pointed; evidence E49 and E50 added; the `src/evaluator.ts` and `src/primitives.ts` pointers re-synced after C2 and C5), unratified terms 0; edited 2026-11-03: claims C178 to C180 and C182 to C188, clusters G36 and G37 and the term speculation mark (T31) ratified at the merge of PR #150, unratified terms 0; edited 2026-11-03: `eval_when` under PE Rule 2 by B-172's chunk C3 (claims C189 to C196 and cluster G38; C55, C181 and cluster G36 removed; C55 also dropped from ask A1; relation R2 re-pointed; evidence E51 added; E13, E14, E23, E50 and every `src/evaluator.ts` pointer moved by C3 re-synced), unratified terms 0)
Source: chunk A1 of docs/plans/book-chapters-now.md (stream A, B-170); src/evaluator.ts as assigned to unit 13 since B-112's exit
Normative: yes
Footprint: docs/book/allegretto/evaluator.md; docs/book/allegretto/evaluator.ir.md; docs/book/allegretto/evaluator.review.md; docs/book/README.md; docs/reading-order.json; docs/book/units.md; docs/book/concepts.md; docs/book-changes.md; docs/documentation-census.md; docs/CHANGELOG.md; docs/plans/book-chapters-now.md

## Terms

T1. Value. defined-at: ../concepts.md#def-value [decided: docs/book/concepts.md §1]

T2. Representation kind. defined-at: ../concepts.md#def-representation-kind [decided: docs/book/concepts.md §2]

T3. Bits. defined-at: ../concepts.md#def-bits [decided: docs/book/concepts.md §3]

T4. Symbol. defined-at: ../concepts.md#def-symbol [decided: docs/book/concepts.md §4]

T5. Param. defined-at: ../concepts.md#def-param [decided: docs/book/concepts.md §5]

T6. Expression. defined-at: ../concepts.md#def-expression [decided: docs/book/concepts.md §6]

T7. Composed function. defined-at: ../concepts.md#def-composedfunction [decided: docs/book/concepts.md §7]

T8. Primitive function. defined-at: ../concepts.md#def-primitivefunction [decided: docs/book/concepts.md §8]

T9. Structure. defined-at: ../concepts.md#def-structure [decided: docs/book/concepts.md §9]

T10. Binding. defined-at: ../concepts.md#def-binding [decided: docs/book/concepts.md §13]

T11. Scope. defined-at: ../concepts.md#def-scope [decided: docs/book/concepts.md §15]

T12. Plane. defined-at: ../concepts.md#def-plane [decided: docs/book/concepts.md §18]

T13. Plane interface. defined-at: ../concepts.md#def-plane-interfaces [decided: docs/book/concepts.md §24]

T14. Partial evaluation. defined-at: ../concepts.md#def-partial-evaluation [decided: docs/book/concepts.md §25]

T15. PE Rule 1. defined-at: ../concepts.md#def-partial-evaluation [decided: docs/book/concepts.md §25]

T16. PE Rule 2. defined-at: ../concepts.md#def-partial-evaluation [decided: docs/book/concepts.md §25]

T17. Residual. defined-at: ../concepts.md#def-resolved-unresolved-residual [decided: docs/book/concepts.md §26]

T18. Resolved and unresolved. defined-at: ../concepts.md#def-resolved-unresolved-residual [decided: docs/book/concepts.md §26]

T19. Future cell. defined-at: ../concepts.md#def-future-cell-and-completion [decided: docs/book/concepts.md §28]

T20. Precompile. defined-at: ../layers.md#def-precompile [decided: docs/book/layers.md §2]

T21. Knowledge. defined-at: ../concepts.md#def-knowledge [decided: docs/book/concepts.md §34]

T22. Effect. defined-at: ../concepts.md#def-effect [decided: docs/book/concepts.md §40]

T23. Metadata field. defined-at: metadata-and-capability.md#def-metadata-field [decided: docs/book/allegretto/metadata-and-capability.md §3]

T24. Channel. defined-at: metadata-and-capability.md#def-channel [decided: docs/book/allegretto/metadata-and-capability.md §4]

T25. Propagation. defined-at: metadata-and-capability.md#def-propagation [decided: docs/book/allegretto/metadata-and-capability.md §5]

T26. Writer capability. defined-at: metadata-and-capability.md#def-writer-capability [decided: docs/book/allegretto/metadata-and-capability.md §6]

T27. Unit. defined-at: ../units.md#def-unit [decided: D50]

T28. Layer, with Allegretto as L0 and Allegro Standard as L2. defined-at: ../layers.md#def-layer [decided: docs/book/layers.md §1]

T29. Discriminator rule. defined-at: ../units.md#32-the-discriminator-rule [decided: docs/book/units.md §3.2]

T30. Tail call. An application of a composed function whose result is the enclosing function body's result. anchor: #def-tail-call [decided: owner, 2026-11-01]

T31. Speculation mark. The `compileMode` host property that `speculate` sets on the fresh child scope it makes for one speculative evaluation. anchor: #3-partial-evaluation-as-implemented [decided: owner, 2026-11-03]

## Claims

### Reader and authority

C1. This chapter is the design truth for the `evaluator` unit, unit 13 of the unit DAG. [decided: docs/plans/book-chapters-now.md §5, 2026-10-30]

C2. This chapter is the definition site of the term tail call. [decided: docs/plans/book-chapters-now.md §5, 2026-10-30]

C4. This chapter describes partial evaluation as implemented. [decided: docs/plans/book-chapters-now.md R4, 2026-10-30]

C5. The reader of this chapter has read the Part I chapters and the chapter on metadata and capability. [decided: owner, 2026-11-01]

C6. This chapter carries the Tier 1 authority that `docs/book/process.md` §1 gives every chapter of the book. [decided: docs/book/process.md §1]

C150. Each section of this chapter carries the status tag that `docs/book/README.md` defines. [decided: docs/book/README.md, Status convention]

C7. This chapter executes the following decisions: R2 (partial evaluation is the mechanism); R4 (evaluation is total over unresolved information); D22 (structures are immutable by default); the rulings of B-112 (the four owed plane interfaces). [decided: docs/book/units.md §4.1]

C131. This chapter executes three B-112 rulings. [decided: docs/plans/plane-interfaces.md §8 and §9.5]

C136. One B-112 ruling has the base call one check hook per registered field. [decided: docs/plans/plane-interfaces.md §8, 2026-09]

C137. A second B-112 ruling folds member dispatch into the dispatch hook. [decided: docs/plans/plane-interfaces.md §8, 2026-09]

C138. A third B-112 ruling, of 2026-10-22, puts call-site unification into the dispatch hook. [decided: docs/plans/plane-interfaces.md §9.5, 2026-10-22]

C132. Earlier chapters define every term this chapter uses except tail call, each term linked at its first use. [decided: owner, 2026-11-01]

C8. The examples are verbatim excerpts of `tests/functions.alg` and `tests/logical.alg`. evidence: E25, E26, E37. [decided: owner, 2026-11-01]

C160. The suite runs both example files, `tests/functions.alg` and `tests/logical.alg`, against their `// expect:` lines. evidence: E38. [decided: owner, 2026-11-01]

### 1. The unit and its file

C9. The `evaluator` unit holds six decisions: PE Rule 1; PE Rule 2; application and substitution; tail calls; the scope carve-out from D22; the four B-112 hooks as its install surface. [decided: docs/book/units.md §4.1]

C10. `src/evaluator.ts` is the one file of the `evaluator` unit in `scripts/analyze/units.json`. evidence: E1. [decided: owner, 2026-11-01]

C11. The unit DAG lets the `evaluator` unit import eight units: `scope`, `expression`, `composed-function`, `primitive-function`, `param`, `symbol`, `metadata`, `capability`. evidence: E1. [decided: D50]

### 2. Evaluation, one switch over the kinds

C12. `evaluate` in `src/evaluator.ts` takes a value, a scope, a depth and an optional dependency collector. evidence: E3. [decided: owner, 2026-11-01]

C169. `evaluate` returns a value, or a `TailCall` sentinel for an Expression that `markTailCalls` marked (§5 (tail call)). evidence: E3, E5. [decided: owner, 2026-11-01]

C13. `evaluate` returns a Bits, a primitive function, a composed function, a Structure or a Param unchanged. evidence: E3. [decided: owner, 2026-11-01]

C14. `evaluate` resolves a Symbol by looking its name up along the scope's parent chain and evaluating the bound value. evidence: E4. [decided: owner, 2026-11-01]

C15. A resolved Symbol's own metadata fields are laid under the fields of its value by `mergeOverMeta`. evidence: E4, E33. [decided: owner, 2026-11-01]

C170. In `mergeOverMeta`, a `union` field merges rather than giving way to the value's field. evidence: E33. [decided: owner, 2026-11-01]

C16. The facts the scope holds for a Symbol's name are attached to the Symbol's value as predicates. evidence: E4. [decided: owner, 2026-11-01]

C17. A Symbol with no binding, or whose binding is a pending future cell, evaluates to itself. evidence: E4. [decided: owner, 2026-11-01]

C18. The dependency collector records the name of each Symbol that evaluates to itself. evidence: E4. [decided: owner, 2026-11-01]

C19. `evaluate` applies an Expression through `evaluateExpr`. evidence: E5. [decided: owner, 2026-11-01]

C20. An Expression's own metadata fields are laid under the fields of the application's result, except when the result is a `TailCall` sentinel. evidence: E5. [decided: owner, 2026-11-01]

C21. `evaluate` throws "Maximum evaluation depth exceeded" when the depth passes 10,000. evidence: E3. [decided: owner, 2026-11-01]

C22. The discriminator rule lets only the evaluator switch on kind for behaviour. [decided: docs/book/units.md §3.2, ratified 2026-10]

C153. Under the discriminator rule, the evaluator's switch must name only the participating kinds: Symbol, Expression, the two function kinds and Param. [decided: docs/book/units.md §3.2, ratified 2026-10]

C172. Under the discriminator rule, the two function kinds and Param participate because each takes part in application. [decided: docs/book/units.md §3.2, ratified 2026-10]

C157. One default arm of the evaluator's switch must take the inert rest of the kinds. [decided: docs/book/units.md §3.2, ratified 2026-10]

C173. The switch in `evaluate` names five kinds: Symbol, Expression, the two function kinds and Param. evidence: E3. [proposed: this IR]

C177. The switch in `evaluate` has one default arm, which returns the value unchanged for every kind the switch does not name, Bits and Structure among them. evidence: E3. [proposed: this IR]

C174. The switch in `evaluate` meets the discriminator rule. [inferred: R1]

C175. B-172 (the partial-evaluation rules as implemented against the spine) owns the default arm of the switch in `evaluate`: the stream's ruling RR5 took option (a), an inert default arm. [decided: docs/plans/pe-rules.md §6, RR5, taken at the merge of PR #147, 2026-11-03]

C176. The `units` report's discriminator count skips the `evaluator` unit, so no lint counts the kinds that the switch in `evaluate` names. evidence: E45. [proposed: this IR]

C24. Two walkers in `src/evaluator.ts`, `subst` and `remapParams`, switch on kind themselves. evidence: E10. [decided: owner, 2026-11-01]

C25. The discriminator rule assigns every walker to a traversal protocol of the `kinds` unit. [decided: docs/book/units.md §3.2]

C26. The `kinds` unit, which would hold the traversal protocol, is owed. [decided: docs/book/units.md §4.1]

C27. `evaluateExpr` evaluates an Expression's function position before anything else. evidence: E5. [decided: owner, 2026-11-01]

C28. A primitive function in function position is applied by `applyPrimitive`. evidence: E5. [decided: owner, 2026-11-01]

C29. A composed function in function position is applied by `applyComposed`, except in an Expression that `markTailCalls` marked (§5). evidence: E5. [decided: owner, 2026-11-01]

C30. A Structure in function position with a constructor slot applies its constructor. evidence: E5. [decided: owner, 2026-11-01]

### 3. Partial evaluation as implemented

C31. R4 (evaluation is total over unresolved information) requires that an unresolved input produce a residual, never a failure to proceed. [decided: docs/book/concepts.md R4]

C32. `isResolved` in `src/types.ts` answers false for a Symbol, a Param and an Expression. evidence: E7. [decided: owner, 2026-11-01]

C33. `isResolved` answers true for every other kind, including a Structure whatever its slots hold. evidence: E7. [decided: owner, 2026-11-01]

C163. No abort that `src/evaluator.ts` raises is caused by an unresolved input. evidence: E3, E8, E18, E34. [decided: owner, 2026-11-01]

C34. `src/evaluator.ts` raises three aborts during evaluation: a depth past 10,000; a declared parameter type with no field check installed; a primitive with no implementation. evidence: E3, E8, E18. [decided: owner, 2026-11-01]

C35. PE Rule 1 says that an application with an unresolved argument produces a residual. [decided: docs/book/concepts.md §25]

C168. Under PE Rule 1, metadata fields propagate onto the residual per their rules. [decided: docs/book/concepts.md §25]

C161. As implemented, PE Rule 1 governs an eager primitive application and an application whose function position is unresolved. evidence: E6, E8. [decided: owner, 2026-11-01]

C44. The exception to PE Rule 1 is a composed function applied to an unresolved argument, which `applyComposed` unfolds into its substituted body unless the call enters a recursion cycle during a typed compilation. evidence: E9, E15. [decided: owner, 2026-11-01]

C154. In an unfolded body, PE Rule 1 governs each application the body contains. evidence: E8, E15. [decided: owner, 2026-11-01]

C45. For a call that the inline cutoff stops, `applyComposed` returns a residual carrying the callee's effects. evidence: E9. [decided: owner, 2026-11-01]

C46. `src/runtime.ts` decides cycle membership once per typed compilation. evidence: E35. [decided: owner, 2026-11-01]

C139. `src/runtime.ts` installs the cycle-membership answer as the inline cutoff through `setInlineCutoff`. evidence: E35. [decided: owner, 2026-11-01]

C36. An eager primitive receives its arguments evaluated, with their metadata intact. evidence: E8. [decided: owner, 2026-11-01]

C37. An eager primitive with an unresolved argument returns a residual Expression of the primitive over the evaluated arguments. evidence: E8. [decided: owner, 2026-11-01]

C38. An eager primitive application whose arguments carry a viral field returns a residual carrying the first such field, whether or not the arguments are resolved. evidence: E8, E33. [decided: owner, 2026-11-01]

C39. The first installed dispatcher that answers gives an eager primitive's residual its type. evidence: E8. [decided: owner, 2026-11-01]

C40. An eager primitive's result carries the union of the primitive's static effect tags and the effects of its evaluated arguments. evidence: E8. [decided: owner, 2026-11-01]

C41. A function position that evaluates to no applicable kind yields a residual Expression of the evaluated function over the evaluated arguments. evidence: E6. [decided: owner, 2026-11-01]

C42. The residual of an unresolved function position carries the first viral field found on the function or on an argument. evidence: E6. [decided: owner, 2026-11-01]

C43. When the unresolved function is a Param, the residual carries the Param's effect variable, the Param's effect bound, or the label `opaque` for a Param with no bound. evidence: E6. [decided: owner, 2026-11-01]

C47. During precompile, an effectful primitive returns a residual even over resolved arguments, which defers its side effect to the run. evidence: E8, E11. [decided: owner, 2026-11-01]

C48. PE Rule 2 says that a lazy primitive whose control input is unresolved returns a residual over both of its evaluated branches. [decided: docs/book/concepts.md §25]

C49. A lazy primitive receives its arguments unevaluated, with an evaluation function the primitive calls on a value and a scope. evidence: E11. [decided: owner, 2026-11-01]

C50. `src/evaluator.ts` leaves PE Rule 2 to each lazy primitive's implementation. evidence: E11. [decided: owner, 2026-11-01]

C51. A lazy primitive's result carries the union of the primitive's own effect tags and the effects of every evaluation made through the primitive's evaluation function. evidence: E11, E39. [decided: owner, 2026-11-01]

C178. `eval_if` in `src/primitives.ts` evaluates both branches speculatively when its condition is unresolved, at run time as in the precompile pass. evidence: E12, E50. [decided: owner, 2026-11-03]

C53. `eval_if` then returns a residual `eval_if` over the condition and the two evaluated branches. evidence: E12. [decided: owner, 2026-11-01]

C54. The residual `eval_if` carries a type when the two evaluated branches have matching type names. evidence: E12. [decided: owner, 2026-11-01]

C189. `eval_when` evaluates the guard and the body of every arm speculatively when its subject is unresolved, at run time as in the precompile pass. evidence: E13, E51. [proposed: this IR]

C190. In the speculation of an arm whose pattern is a binder, the pattern's name is bound to the evaluated subject. evidence: E13, E51. [proposed: this IR]

C191. In the speculation of an arm whose type pattern or destructuring pattern binds names, each name stays the arm function's own Param, unbound and untyped. evidence: E13, E51. [proposed: this IR]

C192. Under an unresolved subject, `eval_when` speculates a written `else` but never evaluates the default `when_no_match` arm. evidence: E13, E51. [proposed: this IR]

C193. The residual `eval_when` under an unresolved subject holds the evaluated subject with the pattern, the guard, the arm and the rest of the chain as written. evidence: E13, E51. [proposed: this IR]

C194. The residual `eval_when` carries the effects of every speculated arm and carries no type. evidence: E11, E13, E51. [proposed: this IR]

C195. A residual `eval_when` evaluated in a scope that resolves its subject runs only the matching arm. evidence: E13, E51. [proposed: this IR]

C179. `&&` and `||` evaluate the right operand speculatively when the left operand is unresolved. evidence: E14, E50. [decided: owner, 2026-11-03]

C185. The residual of `&&` or `||` under an unresolved left operand holds the left operand and the evaluated right operand in a thunk. evidence: E14, E50. [decided: owner, 2026-11-03]

C180. A speculative evaluation runs in a fresh child scope of the caller's scope that carries the `compileMode` flag. evidence: E49. [decided: owner, 2026-11-03]

C186. An effectful primitive that a speculative evaluation reaches returns a residual carrying its effects, at run time as in the precompile pass. evidence: E8, E11, E49, E50. [decided: owner, 2026-11-03]

C187. A speculative evaluation leaves the caller's own scope without the `compileMode` flag. evidence: E49, E50. [decided: owner, 2026-11-03]

C182. A `TailCall` sentinel that a speculative evaluation produces is applied there: with an inline cutoff installed, `applyComposed` applies the call; with none installed, the call becomes a residual Expression carrying the callee's effects. evidence: E49, E50. [decided: owner, 2026-11-03]

C183. No residual of `eval_if`, `&&` or `||` holds a `TailCall` sentinel. evidence: E49, E50. [decided: owner, 2026-11-03]

C188. `evaluate` is handed no `TailCall` sentinel in the programs of `tests/` and `demos/`. evidence: E50. [decided: owner, 2026-11-03]

C196. `eval_when` meets PE Rule 2 for effects, though its residual holds the arms as written rather than the evaluated arms. [inferred: R2]

### 4. Application and substitution

C58. `applyComposed` evaluates the arguments before anything else. evidence: E15. [decided: owner, 2026-11-01]

C59. An argument carrying a viral field ends a composed application with a residual carrying the viral field. evidence: E15, E33. [decided: owner, 2026-11-01]

C60. Each installed dispatcher may bind the callee's declared constraints to the arguments through the dispatcher's `call` entry point. evidence: E15, E31. [decided: owner, 2026-11-01]

C61. A call binding hands back the scope the body evaluates in, the substituted arguments and a finisher for the body's result. evidence: E15, E31. [decided: owner, 2026-11-01]

C62. The evaluator hands each dispatcher a check loop, `checkArg`, for the per-argument checks. evidence: E15, E18. [decided: owner, 2026-11-01]

C63. `substituteParams` replaces each Param of the body by the argument at the Param's position. evidence: E16. [decided: owner, 2026-11-01]

C64. A Param is replaced only when the applied function owns the Param by membership in its parameter list, or when no function has claimed the Param. evidence: E16. [decided: owner, 2026-11-01]

C65. Substitution leaves a Symbol in place, because a Symbol resolves by name through the scope. evidence: E16. [decided: owner, 2026-11-01]

C66. Substitution returns an unchanged subtree, not a copy. evidence: E16. [decided: owner, 2026-11-01]

C67. Substitution copies an inner composed function whose body changed, with fresh Params rebound to the copy. evidence: E17. [decided: owner, 2026-11-01]

C68. A copied composed function keeps its metadata through `carryMeta`. evidence: E17. [decided: owner, 2026-11-01]

C156. `PRESERVED_FN_META_KEYS` names the function properties that a copied composed function keeps. evidence: E17. [decided: owner, 2026-11-01]

C69. `applyComposed` evaluates the substituted body in the scope a call binding handed back, or in the caller's scope when no dispatcher bound the call. evidence: E15. [decided: owner, 2026-11-01]

C70. `precompileFunction` runs `evaluate` over a function body at compile time, with typed Param placeholders in place of the arguments. evidence: E19. [decided: owner, 2026-11-01]

C71. A typed placeholder is a Param carrying the declared `type` field, plus a `domain` field when the type carries an abstract domain. evidence: E19. [decided: owner, 2026-11-01]

C72. `precompileFunction` reads the inferred return type from the `type` field of the body's result. evidence: E19. [decided: owner, 2026-11-01]

C73. `precompileFunction` reports an error thrown during the body's evaluation as a returned error string, not as an abort. evidence: E19. [decided: owner, 2026-11-01]

### 5. Tail calls

C140. The evaluator runs a tail call as another round of the enclosing application's loop, not as a nested evaluation. evidence: E5, E15. [decided: owner, 2026-11-01]

C134. Without tail calls, the finite host stack would bound the depth of recursion a program can use. [decided: docs/book/concepts.md §27]

C74. `markTailCalls` marks the outermost Expression of a function body. evidence: E21. [decided: owner, 2026-11-01]

C75. `markTailCalls` carries the mark into the branch bodies of `eval_if` and `eval_when`. evidence: E21. [decided: owner, 2026-11-01]

C76. `markTailCalls` carries the mark through a wrapper (`type_check`, `ensures_check`, an `*_attach` wrapper, `seq`) only to an `eval_if`, an `eval_when` or a further wrapper, never to a bare call. evidence: E21. [decided: owner, 2026-11-01]

C77. `src/runtime.ts` marks every composed function body among a file's bindings after symbol resolution and before precompile. evidence: E22. [decided: owner, 2026-11-01]

C78. Before marking, `src/runtime.ts` collapses the `*_attach` wrappers of each function body onto function properties with `collapseBodyMetadata`. evidence: E22. [decided: owner, 2026-11-01]

C79. In a marked Expression, `evaluateExpr` returns a `TailCall` sentinel holding the composed function in function position and the evaluated arguments. evidence: E5. [decided: owner, 2026-11-01]

C80. A `TailCall` sentinel is a host object, not a value. evidence: E20. [decided: owner, 2026-11-01]

C81. When the body that `applyComposed` evaluates returns a `TailCall` sentinel, `applyComposed` loops with the sentinel's function and arguments. evidence: E15. [decided: owner, 2026-11-01]

C82. The loop in `applyComposed` accepts any composed function, not only the function that made the call. evidence: E15. [decided: owner, 2026-11-01]

C83. Each round of the loop in `applyComposed` evaluates the next body at the depth of the first round. evidence: E15. [decided: owner, 2026-11-01]

C84. A chain of 100,000 tail calls through a typed function's return check completes without reaching the depth bound. evidence: E24. [decided: owner, 2026-11-01]

C85. A sentinel that a primitive application returns inside an unmarked Expression is applied immediately by `evaluateExpr`. evidence: E5. [decided: owner, 2026-11-01]

C171. The `if` or `when` Expression of a local binding is unmarked. evidence: E21, E22. [decided: owner, 2026-11-01]

C86. A local binding of an `if` or a `when` whose chosen branch is a call holds the call's value. evidence: E5, E25. [decided: owner, 2026-11-01]

C87. Substitution and parameter remapping copy the mark onto each Expression they rebuild. evidence: E16, E17. [decided: owner, 2026-11-01]

C88. `type_check` and `ensures_check` in `src/primitives.ts` return a sentinel from their wrapped body untouched. evidence: E23. [decided: owner, 2026-11-01]

C89. `&&` and `||` apply their right-operand thunk as a call, which answers with a value rather than a sentinel. evidence: E14, E26. [decided: owner, 2026-11-01]

C90. `precompileFunction` drives the sentinels of a body's top Expression itself, with a bound of 10,000 rounds. evidence: E19. [decided: owner, 2026-11-01]

C91. Nothing checks that a wrapper around a function body forwards the sentinel. evidence: E27. [decided: owner, 2026-11-01]

C92. B-113 (TailCall forwarding is convention-only) owns the missing check. evidence: E27. [decided: owner, 2026-11-01]

### 6. Writing in place: the scope carve-out

C93. D22 (structures are immutable by default) makes a Structure immutable from birth. [decided: D22]

C94. A value is written in place only while the value is provably unshared, during construction and before it escapes. [decided: docs/book/allegretto/metadata-and-capability.md §2]

C95. A scope is exempt from D22, because a scope is mutable evaluator state, not data. [decided: docs/book/concepts.md §15]

C96. D49 (scope leaves `Value`) rules that the scope becomes a host construct outside `Value`. [decided: D49]

C133. B-136 (scope leaves `Value`) owns the execution of D49. [decided: D49]

C97. A scope today is a Structure with `isScope` set. evidence: E28. [decided: owner, 2026-11-01]

C184. `src/evaluator.ts` writes one scope property, the `compileMode` flag: `precompileFunction` sets it on its compile scope, and a speculative evaluation sets it on the fresh child scope it makes before that scope escapes. evidence: E2, E19, E49. [decided: owner, 2026-11-03]

C99. `precompileFunction` restores the `compileMode` flag's previous value after the body's evaluation, even when the evaluation throws. evidence: E19. [decided: owner, 2026-11-01]

C100. `scopeCompileMode` in `src/scope.ts` reports compile mode when any scope along the parent chain carries the flag. evidence: E28. [decided: owner, 2026-11-01]

C101. `src/evaluator.ts` reads scopes through three functions of the `scope` unit: `scopeLookup`, `scopeFactsFor`, `scopeCompileMode`. evidence: E2. [decided: owner, 2026-11-01]

C102. `markTailCalls` and `markPatternBinders` write in place into a file's own values before `src/runtime.ts` evaluates the file. evidence: E21, E22, E29. [decided: owner, 2026-11-01]

C103. `precompileFunction` writes the inferred effect set onto the function it is given, as the function's `inferredEffects` property. evidence: E19. [decided: owner, 2026-11-01]

C104. The precompile stage in `src/runtime.ts` skips a function that a library owns. evidence: E30. [decided: owner, 2026-11-01]

### 7. The install surface

C105. B-112 names four hooks: dispatch, check, projection, channel registration. [decided: docs/book/concepts.md §24]

C106. A layer installs a hook under the gate of the field's writer capability. [decided: docs/plans/plane-interfaces.md §5.4, ratified 2026-10-21]

C107. The base calls an installed hook with opaque values. [decided: docs/plans/plane-interfaces.md §6, ratified 2026-10-21]

C108. With resolved arguments, an installed dispatcher may answer an eager primitive application in place of the primitive. evidence: E8. [decided: owner, 2026-11-01]

C109. A dispatcher that declines returns null, leaving the primitive to run as Allegretto runs it. evidence: E8, E31. [decided: owner, 2026-11-01]

C110. `checkArg` runs every installed field check with a free reader and the argument's site. evidence: E18. [decided: owner, 2026-11-01]

C111. `checkArg` throws when a parameter type is declared and no field check is installed. evidence: E18. [decided: owner, 2026-11-01]

C112. The evaluator reaches the projection hook only through `metaReadRaw`, which serves an installed projection without naming the field. evidence: E32. [decided: owner, 2026-11-01]

C113. The channel-registration hook is not built. evidence: E40. [decided: owner, 2026-11-01]

C114. B-111 (field versus channel registration) owns the channel-registration hook. [decided: docs/plans/plane-interfaces.md §6, ratified 2026-10-21]

C115. The evaluator applies the two generic propagation rules through `viralOnto` and `mergeOverMeta` of the `metadata` unit. evidence: E33. [decided: owner, 2026-11-01]

C116. `assertPropagationTableLinkage` checks at module load that six fields keep the rules the evaluator implements for them. evidence: E34. [decided: owner, 2026-11-01]

C117. `setInlineCutoff` accepts the inline cutoff without any writer capability. evidence: E35. [decided: owner, 2026-11-01]

C118. The B-112 plan records the inline cutoff as an injection that should become a gated analysis. evidence: E41. [decided: owner, 2026-11-01]

### 8. The edges the unit still owes

C119. `src/evaluator.ts` imports seven symbols from two files that `scripts/analyze/units.json` assigns wholly to Allegro Standard units: three from `src/refinements.ts`, four from `src/effects.ts`. evidence: E2, E42. [decided: owner, 2026-11-01]

C120. The `units` report shows both imports as violations of the unit DAG. evidence: E36. [decided: owner, 2026-11-01]

C121. B-146 (knowledge propagation) owns both edges. [decided: docs/plans/plane-interfaces.md §9.8, 2026-10-24]

C122. The `refinements` edge is knowledge propagation: predicate sets computed at primitive application, plus the scope facts of §2. evidence: E4, E8. [decided: owner, 2026-11-01]

C123. The `effects` edge is effect inference: a primitive's static tags, a Param's bound or effect variable, the `opaque` label, the precompile stash. evidence: E6, E8, E19. [decided: owner, 2026-11-01]

C124. The generic `union` rule cannot replace the effect path, because the base cannot encode an effect set. [decided: docs/plans/plane-interfaces.md §9.8, 2026-10-24]

C125. B-112's done-condition, that the `evaluator` unit imports nothing from Allegro Standard, is not met. [decided: docs/plans/plane-interfaces.md §9.8, 2026-10-24]

C126. Two paths carry a field by name: precompile's placeholder seeding of `type` and `domain`; the post-call `type` stamp on an untyped Bits result. evidence: E8, E19. [decided: owner, 2026-11-01]

C127. B-145 (type vocabulary) owns the carrying by name. [decided: docs/book/units.md §4.1]

C128. `src/evaluator.ts` imports `primitives` and `renderExprSource` from `src/primitives.ts`, which holds units of three layers, Allegro Standard among them. evidence: E2, E42. [decided: owner, 2026-11-01]

C166. The `units` report counts an edge as unresolved when `scripts/analyze/units.json` maps the file at either end to several units. evidence: E42, E47. [decided: owner, 2026-11-01]

C129. Until `src/primitives.ts` is split, the `units` report counts the `renderExprSource` edge as unresolved, not as a violation. evidence: E36. [decided: owner, 2026-11-01]

C130. The unit DAG places `base-primitives`, one of the units `src/primitives.ts` holds, above the `evaluator` unit. [decided: docs/book/units.md §4.1]

C162. `renderExprSource` belongs to the `base-primitives` unit. evidence: E46. [decided: owner, 2026-11-01]

C159. The unit DAG forbids the `evaluator` unit's import of `renderExprSource`. [inferred: R10]

### 9. Where the code is, and what pins it

C141. The whole suite pins `evaluate`, `evaluateExpr`, `applyPrimitive`, `applyComposed`, substitution, `checkArg`, `precompileFunction`, `markTailCalls`, `setInlineCutoff` and `assertPropagationTableLinkage` in `src/evaluator.ts`. evidence: E43. [decided: owner, 2026-11-01]

C167. `tests/functions.alg` and `tests/logical.alg`, run through `src/test/types-core.ts` and `src/test/grammar2-language.ts`, pin the application and tail-call paths of `src/evaluator.ts` that §4 (application and substitution) and §5 quote. evidence: E25, E26, E37, E38. [decided: owner, 2026-11-01]

C142. The whole suite pins `isResolved`, `makeExpr` and `withMeta` in `src/types.ts`. evidence: E43. [decided: owner, 2026-11-01]

C143. The boundary gates of `src/boundary-tests.ts` pin `viralOnto`, `mergeOverMeta`, `metaReadRaw` and the check and dispatch tables in `src/metadata.ts`. evidence: E43. [decided: owner, 2026-11-01]

C144. `src/test/effects.ts` pins `eval_if` in `src/primitives.ts` with both branches evaluated under an unresolved condition. evidence: E39. [decided: owner, 2026-11-01]

C145. `src/test/totality.ts` pins `type_check` in `src/primitives.ts` with a tail call 100,000 deep. evidence: E24. [decided: owner, 2026-11-01]

C146. `tests/functions.alg` and `tests/logical.alg` pin `eval_when`, `&&` and `||` in `src/primitives.ts`. evidence: E25, E26. [decided: owner, 2026-11-01]

C147. The whole suite pins `scopeLookup`, `scopeFactsFor` and `scopeCompileMode` in `src/scope.ts`. evidence: E43. [decided: owner, 2026-11-01]

C148. The whole suite pins the marking of every function body, the install of the inline cutoff and the precompile stage in `src/runtime.ts`. evidence: E43. [decided: owner, 2026-11-01]

C149. `npm run lint:units` pins the unit's file and permitted imports in `scripts/analyze/units.json`. evidence: E44. [decided: owner, 2026-11-01]

### Clusters

G1. cluster: C1, C2, C4, C5, C132 [decided: owner, 2026-11-01]

G2. cluster: C6, C150, C7, C131, C136, C137, C138, C8, C160 [decided: owner, 2026-11-01]

G3. cluster: C10, C11, C9 [decided: owner, 2026-11-01]

G4. cluster: C12, C169, C13, C21 [decided: owner, 2026-11-01]

G5. cluster: C14, C15, C170, C16, C17, C18 [decided: owner, 2026-11-01]

G6. cluster: C19, C20, C27, C28, C29, C30 [decided: owner, 2026-11-01]

G35. cluster: C22, C153, C172, C157, C173, C177, C174, C175, C176, C24, C25, C26 [proposed: this IR]

G8. cluster: C31, C32, C33, C163, C34 [decided: owner, 2026-11-01]

G9. cluster: C35, C161, C44, C154, C168 [decided: owner, 2026-11-01]

G10. cluster: C41, C42, C43 [decided: owner, 2026-11-01]

G11. cluster: C46, C139, C45 [decided: owner, 2026-11-01]

G12. cluster: C48, C49, C50, C51 [decided: owner, 2026-11-01]

G38. cluster: C178, C53, C54, C189, C190, C191, C192, C193, C194, C195, C179, C185, C180, C186, C187, C182, C183, C188, C196 [proposed: this IR]

G14. cluster: C58, C59, C60, C61, C62, C69 [decided: owner, 2026-11-01]

G15. cluster: C63, C64, C65, C66, C67, C68, C156 [decided: owner, 2026-11-01]

G16. cluster: C70, C71, C72, C73 [decided: owner, 2026-11-01]

G17. cluster: C140, C134, C74, C75, C76, C77, C78 [decided: owner, 2026-11-01]

G18. cluster: C79, C80, C81, C82, C83, C84 [decided: owner, 2026-11-01]

G19. cluster: C85, C171, C86, C87 [decided: owner, 2026-11-01]

G20. cluster: C88, C89, C90 [decided: owner, 2026-11-01]

G21. cluster: C91, C92 [decided: owner, 2026-11-01]

G22. cluster: C93, C94, C95, C96, C133, C97 [decided: owner, 2026-11-01]

G37. cluster: C184, C99, C100, C101 [decided: owner, 2026-11-03]

G24. cluster: C102, C103, C104 [decided: owner, 2026-11-01]

G25. cluster: C105, C106, C107 [decided: owner, 2026-11-01]

G26. cluster: C108, C109, C110, C111 [decided: owner, 2026-11-01]

G27. cluster: C112, C113, C114 [decided: owner, 2026-11-01]

G28. cluster: C115, C116, C117, C118 [decided: owner, 2026-11-01]

G29. cluster: C119, C120, C121 [decided: owner, 2026-11-01]

G30. cluster: C122, C123, C124, C125 [decided: owner, 2026-11-01]

G31. cluster: C126, C127 [decided: owner, 2026-11-01]

G32. cluster: C128, C130, C162, C159, C166, C129 [decided: owner, 2026-11-01]

G33. cluster: C141, C167, C142, C143, C144, C145, C146, C147, C148, C149 [decided: owner, 2026-11-01]

G34. cluster: C36, C37, C38, C39, C40, C47 [decided: owner, 2026-11-01]

## Relations

R1. C174 depends-on C153 because C173 and C177 state that the switch in `evaluate` names the participating kinds and has one default arm, which the ratified C153 and C157 require.

R2. C196 depends-on C189 because every arm of `eval_when` is evaluated under an unresolved subject, as C178 and C179 show for `eval_if`, `&&` and `||`, while C193 keeps the arms as written in the residual.

R3. C154 refines C35 because `applyComposed` unfolds the composed application (C44), so the applications PE Rule 1 governs are the ones inside the body.

R4. C45 refines C44 because the inline cutoff stops exactly the calls C44 excepts: a call into a recursion cycle with an unresolved argument during a typed compilation.

R5. C84 depends-on C83 because a loop round that keeps the depth lets a chain of any length stay under the bound.

R6. C86 depends-on C171 because `eval_if` and `eval_when` hand back the sentinel of the marked branch body, which `evaluateExpr` applies immediately inside the unmarked binding Expression (C85).

R7. C91 depends-on C88 because each wrapper forwards the sentinel by its own code.

R8. C125 depends-on C119 because the done-condition counts the Allegro Standard imports.

R9. C129 refines C120 because C166 makes the report judge only edges between files assigned to one unit each.

R10. C159 depends-on C162 because C162 puts `renderExprSource` in the `base-primitives` unit, which C130 places above the `evaluator` unit.

## Evidence

E1. `scripts/analyze/units.json` lines 16 and 51: the `evaluator` unit's permitted dependencies, and `src/evaluator.ts` mapped to the unit alone.

E2. `src/evaluator.ts` lines 3–13: the imports, including seven symbols from `src/refinements.ts` and `src/effects.ts`, `primitives` and `renderExprSource` from `src/primitives.ts`, and three reads and the constructor `scopeNew` from `src/scope.ts`.

E3. `src/evaluator.ts` lines 473–541: `evaluate`, with the depth bound at line 476 and the switch from line 490, which names Symbol, Expression, the two function kinds and Param, and whose default arm at lines 532–539 returns the value.

E4. `src/evaluator.ts` lines 498–519: the Symbol arm: `scopeLookup`, `mergeOverMeta` over the Symbol's own fields, `scopeFactsFor` with `withPredicates`, and the dependency collector for an unresolved name.

E5. `src/evaluator.ts` lines 521–529 and 543–587: the Expression arm and `evaluateExpr`'s dispatch on the callee's kind; the sentinel at lines 566–570; the immediate application at lines 560–562; the constructor slot at lines 574–587.

E6. `src/evaluator.ts` lines 589–639: the residual for an unresolved function position, with the Param's effects and `viralOnto`.

E7. `src/types.ts` lines 455–472: `isResolved`, false for Param, Symbol and Expression, true otherwise.

E8. `src/evaluator.ts` lines 699–804: the eager path of `applyPrimitive`: evaluated arguments, the compile-mode deferral, the viral check, the unresolved residual and the dispatchers, the predicate-set propagation, the post-call `type` stamp, the effect union; the unresolved-stub throw at line 774.

E9. `src/evaluator.ts` lines 876–901: the inline cutoff in `applyComposed`, a residual for a speculative call into a recursion cycle.

E10. `src/evaluator.ts` lines 933–967 and 980–1054: `remapParams` and `subst`, each a switch on kind.

E11. `src/evaluator.ts` lines 652–697: the lazy path of `applyPrimitive`: unevaluated arguments, the tracking evaluation function with the speculative switch at line 659, the compile-mode deferral of an effectful lazy primitive.

E12. `src/primitives.ts` lines 567–627: `eval_if_impl`, both branches evaluated speculatively under an unresolved condition at lines 603–604, the residual, the shared type.

E13. `src/primitives.ts` lines 821–907 and `src/evaluator.ts` lines 272–298: `speculateWhenArms` (`src/primitives.ts` line 860) with the binder test (line 864), each arm's guard and body speculated (lines 866–867), the chain walk and the `when_no_match` skip (lines 868–877); `eval_when_impl` (line 881) speculates every arm for an unresolved subject (line 897) and returns the residual over the arms as written (line 906); in `src/evaluator.ts`, `whenArmThunk` binds a binder's name to the subject or leaves the arm's own Params unbound, and `isUnboundPatternName` and `thunkBodyOf` answer the kind questions.

E14. `src/primitives.ts` lines 2290–2327 and 2395–2422: `typed_and_impl` and `typed_or_impl`: under an unresolved left operand the right operand is evaluated speculatively (lines 2302 and 2399) and the residual holds it in a thunk; with a resolved left operand the right thunk is applied as a call.

E15. `src/evaluator.ts` lines 833–924: `applyComposed`: argument evaluation, the viral check, the dispatchers' call binding with `checkArg`, substitution; the loop from line 847, with the body evaluated at `depth + 1` at line 911 and the tail-call check at lines 914–920. `depth` is not reassigned inside the loop, so every round evaluates its body at the depth of the first round.

E16. `src/evaluator.ts` lines 969–1002 and 1043–1051: positional substitution, ownership by membership through `ownsParam`, Symbols left in place, unchanged subtrees returned, the tail mark copied.

E17. `src/evaluator.ts` lines 948–965 and 1004–1040: an inner composed function copied with fresh Params, `carryMeta` and `PRESERVED_FN_META_KEYS`; `remapParams` copying the tail mark.

E18. `src/evaluator.ts` lines 1072–1096: `checkArg`, every installed field check, and the throw when none is installed.

E19. `src/evaluator.ts` lines 1114–1214: `precompileFunction`: placeholders with `type` and `domain`, the `compileMode` flag set and restored in `finally`, the sentinel loop bounded at 10,000, the inferred type read, the `inferredEffects` write, errors returned.

E20. `src/evaluator.ts` lines 225–243: the `TailCall` interface, `isTailCall`, `makeTailCall`.

E21. `src/evaluator.ts` lines 343–430: `markTailCalls`, `forwardedArgIndex`, `isBranchingPrimitive`; the in-place `_tailPosition` write at line 355.

E22. `src/runtime.ts` lines 452–482 and 1259–1263: `markTailCallsInContext` collapses body-form metadata first, then marks each composed function body; called after `resolveSymbols`.

E23. `src/primitives.ts` lines 2738–2747 and 3566–3572: `type_check_impl` and `ensures_check_impl` return a sentinel untouched.

E24. `src/test/totality.ts` lines 739–769: a typed tail-recursive countdown returns 0, from 5 and from 100,000.

E25. `tests/functions.alg` lines 52–69: an `if` or `when` binding whose branch is a call (`// expect: 6`, `// expect: 6`, `// expect: 42`).

E26. `tests/logical.alg` lines 59–70: `&&` and `||` with a call on the right (`// expect: false`, `// expect: true`, `// expect: true`, `// expect: false`).

E27. `docs/backlog.md`, the B-113 entry: tail-call forwarding is enforced by a recurring-lesson note and nothing else.

E28. `src/scope.ts` lines 32–38 and 84–91: `scopeNew` makes a Structure and sets `isScope`; `scopeCompileMode` walks the parent chain.

E29. `src/evaluator.ts` lines 447–469 and `src/runtime.ts` lines 215–223: `markPatternBinders` rewrites a `when` pattern argument in place during symbol resolution.

E30. `src/runtime.ts` lines 814–830: the pipeline skips a library-owned function before calling `precompileFunction`.

E31. `src/metadata.ts` lines 383–455: `CheckSite`, `fieldChecks`, `CallSite`, `CallBinding`, `DispatchInstall` and `dispatchers`; a declining dispatcher returns null.

E32. `src/metadata.ts` lines 142–166: `metaReadRaw` reads the value's own `meta`, then a registered binding-plane slot, then an installed projection, naming no field.

E33. `src/metadata.ts` lines 325–375: `viralOnto` (the first viral field, with its candidate's `type`) and `mergeOverMeta` (inner fields win, `union` fields merge).

E34. `src/evaluator.ts` lines 807–829: `assertPropagationTableLinkage` over `error`, `effects`, `shape`, `predicates`, `domain` and `discharged`.

E35. `src/evaluator.ts` lines 26–42 and `src/runtime.ts` lines 1285 and 1387: `setInlineCutoff` takes a bare callback; the pipeline clears it and installs the cycle set.

E36. `npx tsx scripts/analyze/index.ts units`, run on this branch on 2026-10-31: two violations, evaluator → refinements and evaluator → effects; `src/types.ts` and `src/primitives.ts` among the five mixed files.

E37. `tests/functions.alg` lines 4–20: an application, a higher-order call and a closure (`// expect: 7`, `// expect: 42`, `// expect: 15`, `// expect: 105`).

E38. `src/test/types-core.ts` lines 432–433 and `src/test/grammar2-language.ts` lines 1071–1076: the suite runs both demo files.

E39. `src/test/effects.ts` lines 1115–1126: `eval_if` under an unresolved condition gives the function the effects of both branches.

E40. `docs/book/allegretto/metadata-and-capability.md` §4, the Delta: the code has field registration and no channel registration.

E41. `docs/plans/plane-interfaces.md` §9.7, finding 4: `setInlineCutoff` is an ungated injection that should become an installed analysis.

E42. `scripts/analyze/units.json` lines 4–41 and 44–70: the layer of each unit; `src/refinements.ts` and `src/effects.ts` mapped to one L2 unit each; `src/primitives.ts` mapped to seven units of L0, L1 and L2; `src/types.ts` mapped to ten units.

E43. `src/test/index.ts` lines 14–39 and 62: the suite's index imports every test area and runs the boundary gates of `src/boundary-tests.ts`, which import their reads from `src/metadata.ts` (line 36).

E44. `package.json` line 24: `lint:units` runs `scripts/analyze/index.ts units --check` against `scripts/analyze/units.json`.

E45. `scripts/analyze/units.json` line 79 and `scripts/analyze/index.ts` lines 273–289: the discriminator count tallies direct `.kind ===` comparisons outside the allowed units, `evaluator` among the allowed; a switch arm is not counted.

E46. `src/primitives.ts` line 42, `docs/book/units.md` line 241 and `scripts/analyze/units.json` line 18: `renderExprSource` sits inside lines 23–1197, which unit 15, `base-primitives`, holds; `base-primitives` lists `evaluator` among its dependencies.

E47. `scripts/analyze/index.ts` lines 259–268: an edge starts with the verdict `unresolved` and is judged `ok` or `violation` only when neither end's file maps to several units.

E49. `src/evaluator.ts` lines 244–341: speculative evaluation: `evaluateSpeculatively` (line 266) hands the value to the lazy primitive's evaluation function with the speculative switch; `speculate` (line 317) makes a child scope with `scopeNew` and sets `compileMode` on it (lines 318–319), unwraps a thunk, and applies a `TailCall` sentinel: a residual carrying the callee's effects when `inlineCutoff` is null (lines 335–339), `applyComposed` otherwise (line 340).

E50. `src/test/evaluator.ts` lines 399–439, 449–460 and 470–601: the `&&` and `||` residuals hold the deferred `print` and carry `io`, and their `pure`-declared rows halt; a branch tail call is residualised with the callee's `io` where no cutoff is installed and unfolded where one is, and no residual holds a sentinel; `via_if` precompiles without a fault; `eval_if` at run time prints nothing for an unresolved Symbol or Param condition. The 68 programs of `tests/` and `demos/` hand `evaluate` no sentinel, measured with a probe on `evaluate` on 2026-11-03.

E51. `src/test/evaluator.ts` lines 302–397, 462–467 and 603–615: under an unresolved subject `whenop`, binder, type-pattern, destructuring, `else` and guard arms infer `io`; the binder's name is the typed placeholder and a destructured name an untyped Param; the residual keeps its arms as written and carries `io`; `when_no_match` is not evaluated; the `pure`-declared `when` row halts; a residual re-evaluated with its subject bound runs the matching arm once.

## Asks

A1. Ratify in bulk the proposed claims, every claim about the code as implemented and the two about the chapter's reader and terms: C5, C8, C160, C10, C12, C13, C14, C15, C16, C17, C18, C19, C20, C21, C24, C27, C28, C29, C30, C32, C33, C163, C34, C36, C37, C38, C39, C40, C41, C42, C43, C44, C45, C46, C47, C49, C50, C51, C53, C54, C58, C59, C60, C61, C62, C63, C64, C65, C66, C67, C68, C69, C70, C71, C72, C73, C74, C75, C76, C77, C78, C79, C80, C81, C82, C83, C84, C85, C86, C87, C88, C89, C90, C91, C92, C97, C99, C100, C101, C102, C103, C104, C108, C109, C110, C111, C112, C113, C115, C116, C117, C118, C119, C120, C122, C123, C126, C128, C129, C132, C139, C140, C141, C142, C143, C144, C145, C146, C147, C148, C149, C154, C156, C161, C162, C166, C167, C169, C170, C171. Depends: C5, C8, C160, C10, C12, C13, C14, C15, C16, C17, C18, C19, C20, C21, C24, C27, C28, C29, C30, C32, C33, C163, C34, C36, C37, C38, C39, C40, C41, C42, C43, C44, C45, C46, C47, C49, C50, C51, C53, C54, C58, C59, C60, C61, C62, C63, C64, C65, C66, C67, C68, C69, C70, C71, C72, C73, C74, C75, C76, C77, C78, C79, C80, C81, C82, C83, C84, C85, C86, C87, C88, C89, C90, C91, C92, C97, C99, C100, C101, C102, C103, C104, C108, C109, C110, C111, C112, C113, C115, C116, C117, C118, C119, C120, C122, C123, C126, C128, C129, C132, C139, C140, C141, C142, C143, C144, C145, C146, C147, C148, C149, C154, C156, C161, C162, C166, C167, C169, C170, C171.

A1 resolved: ratified by the owner at the merge of PR #129, 2026-11-01; the claims carry decided provenance from that date.

A2. Ratify or strike the proposed term tail call (T30). Depends: C2, C29, C79, C140.

A2 resolved: ratified by the owner at the merge of PR #129, 2026-11-01; the term's definition site is the chapter's anchor.

A3. Ratify in bulk the re-proposed claims about the switch in `evaluate`, as chunk C5 of B-172 (the partial-evaluation rules as implemented against the spine) left the code, with their cluster G35: C173, C177, C176. C174 is inferred through R1, and C175 is decided by ruling RR5. Depends: C173, C177, C176.

A4. Ratify in bulk the re-proposed claims about speculative evaluation and the branch tail call, as chunk C2 of B-172 (the partial-evaluation rules as implemented against the spine) left the code, with their clusters G36 and G37: C178, C179, C185, C180, C186, C187, C182, C183, C188, C184. C181 is inferred through R2. Depends: C178, C179, C185, C180, C186, C187, C182, C183, C188, C184.

A4 resolved: ratified by the owner at the merge of PR #150, 2026-11-03; the statuses are flipped.

A5. Ratify in bulk the re-proposed claims about `eval_when` under PE Rule 2, as chunk C3 of B-172 (the partial-evaluation rules as implemented against the spine) left the code, with their cluster G38: C189, C190, C191, C192, C193, C194, C195. C196 is inferred through R2. Depends: C189, C190, C191, C192, C193, C194, C195.
