# IR: Tooling

Reader: RD-4
Purpose: document. The book's chapter on the `introspect` unit (unit 34) and the `cli` unit (unit 35): the file runner, the REPL, the subcommands `inspect`, `verify`, `obligations`, `propose` and `prove`, the safety grades, and the four diagnostic variables, with tracing and the IDE integration stated as not built.
Status: delivered IR-only (unratified terms 2; footprint: declared 7, changed 7, surprises 0, misses 0)
Source: chunk A3 of docs/plans/book-chapters-now.md (stream A, B-170); src/index.ts and src/introspect.ts as the files of units 35 and 34
Footprint: docs/book/platform/tooling.ir.md; docs/book/README.md; docs/reading-order.json; docs/book/units.md; docs/book/platform/README.md; docs/documentation-census.md; docs/CHANGELOG.md; docs/plans/book-chapters-now.md

## Terms

T1. Unit. defined-at: ../units.md#def-unit [decided: D50]

T2. Track, with T-tooling the track of tracing, debugging and introspection. defined-at: ../layers.md#def-track [decided: docs/book/layers.md §2]

T3. Layer, with Allegretto as L0 and Allegro Standard as L2. defined-at: ../layers.md#def-layer [decided: docs/book/layers.md §1]

T4. Symbol. defined-at: ../concepts.md#def-symbol [decided: docs/book/concepts.md §4]

T5. Composed function. defined-at: ../concepts.md#def-composedfunction [decided: docs/book/concepts.md §7]

T6. Primitive function. defined-at: ../concepts.md#def-primitivefunction [decided: docs/book/concepts.md §8]

T7. Binding. defined-at: ../concepts.md#def-binding [decided: docs/book/concepts.md §13]

T8. Scope. defined-at: ../concepts.md#def-scope [decided: docs/book/concepts.md §15]

T9. Residual. defined-at: ../concepts.md#def-resolved-unresolved-residual [decided: docs/book/concepts.md §26]

T10. Resolved and unresolved. defined-at: ../concepts.md#def-resolved-unresolved-residual [decided: docs/book/concepts.md §26]

T11. Future cell. defined-at: ../concepts.md#def-future-cell-and-completion [decided: docs/book/concepts.md §28]

T12. Type. defined-at: ../concepts.md#def-type [decided: docs/book/concepts.md §30]

T13. Refinement. defined-at: ../concepts.md#def-refinement [decided: docs/book/concepts.md §35]

T14. Law. defined-at: ../concepts.md#def-law-and-coercion [decided: docs/book/concepts.md §39]

T15. Coercion. defined-at: ../concepts.md#def-law-and-coercion [decided: docs/book/concepts.md §39]

T16. Effect. defined-at: ../concepts.md#def-effect [decided: docs/book/concepts.md §40]

T17. Declared and inferred effects. defined-at: ../concepts.md#def-declared-and-inferred-effects [decided: docs/book/concepts.md §41]

T18. Totality. defined-at: ../concepts.md#def-totality [decided: docs/book/concepts.md §42]

T19. Divergence and discharge tier, with `div` the divergence effect. defined-at: ../concepts.md#def-divergence-and-discharge-tiers [decided: docs/book/concepts.md §43]

T20. Proof and discharge. defined-at: ../concepts.md#def-proof-and-discharge [decided: docs/book/concepts.md §44]

T21. Obligation. defined-at: ../concepts.md#def-obligation-verdict-and-the-assumption-ledger [decided: docs/book/concepts.md §45]

T22. Verdict. defined-at: ../concepts.md#def-obligation-verdict-and-the-assumption-ledger [decided: docs/book/concepts.md §45]

T23. Assumption ledger. defined-at: ../concepts.md#def-obligation-verdict-and-the-assumption-ledger [decided: docs/book/concepts.md §45]

T24. Contract. defined-at: ../concepts.md#def-contract [decided: docs/book/concepts.md §46]

T25. Extension, a set of named bindings the execution context injects between the primitives and the source. defined-at: ../extension/modules.md#loading-l1 [decided: docs/book/extension/modules.md, Loading]

T26. Library, a module file that `ModuleLoader` loads into an extension. defined-at: ../extension/modules.md#loading-l1 [decided: docs/book/extension/modules.md, Loading]

T27. The evalSource pipeline. defined-at: build-pipeline.ir.md#def-the-evalsource-pipeline [proposed: docs/book/platform/build-pipeline.ir.md T34]

T28. Precompile, the stage of the evalSource pipeline that partially evaluates each function definition's body before the evaluation loop. defined-at: build-pipeline.ir.md#def-the-evalsource-pipeline [decided: docs/book/platform/build-pipeline.ir.md T35]

T29. Post-pass, a check of the evalSource pipeline that runs after precompile or after the evaluation loop. defined-at: build-pipeline.ir.md#def-the-evalsource-pipeline [decided: docs/book/platform/build-pipeline.ir.md T36]

T30. Safety grade. The one-word grade that `inspect` prints for a whole module from the module's compilation report and binding summaries: `proven-safe`, `partial`, `has-warnings` or `has-errors`. anchor: #def-safety-grade [proposed: this IR]

## Claims

### Reader and authority

C1. This chapter is the design truth for two units of the unit DAG: the `introspect` unit, unit 34; the `cli` unit, unit 35. [decided: docs/plans/book-chapters-now.md §5, 2026-10-30]

C2. This chapter is the definition site of the term safety grade. [proposed: this IR]

C3. This chapter is delivered IR-only: no prose is rendered from this IR until a later stage that the maintainer schedules. [decided: docs/plans/book-chapters-now.md §3.1 and R8, 2026-10-30]

C4. The reader of this chapter has read the Part I chapters and the Part II chapters before this chapter, the evaluation pipeline chapter included. [proposed: this IR]

C5. Earlier chapters define every term this chapter uses except safety grade, each term linked from this chapter's Terms section. [proposed: this IR]

C6. This chapter carries the Tier 1 authority that `docs/book/process.md` §1 gives every chapter of the book. [decided: docs/book/process.md §1]

C7. Each Claims sub-heading of this chapter carries the status tag that `docs/book/README.md` defines. [decided: docs/book/README.md, Status convention]

C8. This chapter holds no examples. [proposed: this IR]

C9. The T-tooling track covers tracing, debugging, introspection through `inspect`, and the review experience, enriched by Allegro Standard's knowledge. [decided: docs/book/layers.md §2]

C10. The T-tooling track's milestone M7, tracing and debugging usable, is aspirational. [decided: docs/book/layers.md §3]

### The two units and their files [implemented]

C11. The `introspect` unit holds the summaries and the safety grades for `inspect`, depending on the `pipeline` unit alone. [decided: docs/book/units.md §4.4]

C12. The `cli` unit holds the file runner, the REPL and the subcommands, depending on the `pipeline`, `introspect` and `module-loading` units. [decided: docs/book/units.md §4.4]

C13. `scripts/analyze/units.json` maps `src/introspect.ts` to the `introspect` unit and `src/index.ts` to the `cli` unit, each unit on the track layer. evidence: E1. [proposed: this IR]

C14. The `units` report lists neither `src/introspect.ts` nor `src/index.ts` among the mixed files. evidence: E2. [proposed: this IR]

C15. The `units` report counts 19 direct kind comparisons in `src/introspect.ts` outside the units that the discriminator rule allows. evidence: E2. [proposed: this IR]

C16. The `units` report lists seven import edges from `src/index.ts`: two permitted, five unresolved at a mixed file. evidence: E2. [proposed: this IR]

C17. `src/index.ts` imports `src/introspect.ts`, `src/pcp.ts` and `pcp/llm-worker.ts` dynamically, inside the subcommand that uses each file. evidence: E3. [proposed: this IR]

C18. The `units` report lists no edge from `src/index.ts` to `src/introspect.ts` or `src/pcp.ts`. evidence: E2. [proposed: this IR]

C19. `scripts/analyze/units.json` maps files under `src/` only, leaving `pcp/llm-worker.ts`, the file of the `prove` loop, without a unit. evidence: E1. [proposed: this IR]

C20. `src/pcp.ts`, the file of the `pcp` unit (unit 30), builds the verdicts and obligations that `verify`, `obligations` and `propose` print. evidence: E12, E14. [proposed: this IR]

C21. The web sandbox's inspect function in `web/allegro-web.ts` also builds the module summary through `summarizeModule` and `renderModuleSummary`. evidence: E34. [proposed: this IR]

C22. `docs/book/implementation-map.md` assigns `src/introspect.ts` to L2 and `src/index.ts` to the T-build track. evidence: E36. [proposed: this IR]

### The entry point [implemented]

C23. `src/index.ts` is the command-line entry, run as `npx tsx src/index.ts` or as `npm start`. evidence: E35. [proposed: this IR]

C24. `package.json` declares no `bin` entry. evidence: E35. [proposed: this IR]

C25. The usage messages of `src/index.ts` name the command `allegro`, as in `allegro inspect <file>`. evidence: E3. [proposed: this IR]

C26. The first positional argument selects one of five subcommands: `inspect`, `verify`, `obligations`, `propose`, `prove`. evidence: E3. [proposed: this IR]

C27. A first positional argument that names no subcommand is the path of a file to run. evidence: E3. [proposed: this IR]

C28. With no positional argument, `src/index.ts` starts the REPL. evidence: E3. [proposed: this IR]

C29. The `--base` flag selects Allegretto for the file runner, the REPL, `inspect`, `verify`, `obligations` and `propose`. evidence: E3. [proposed: this IR]

C30. Without the `--base` flag, the file runner, the REPL, `inspect`, `verify`, `obligations` and `propose` start from one extension, the type system that `createTypeSystem` builds. evidence: E3, E4, E5, E6, E10. [proposed: this IR]

C31. `prove` ignores the `--base` flag. evidence: E3, E17. [proposed: this IR]

C32. A subcommand given no file prints the subcommand's usage line and exits with code 1. evidence: E3. [proposed: this IR]

C33. Every subcommand evaluates the file through `evalSource`, the entry of the evalSource pipeline. evidence: E6, E10, E17. [proposed: this IR]

### The file runner [implemented]

C34. The file runner reads the file, then hands the file's text to `runFile`. evidence: E3. [proposed: this IR]

C35. Under Allegretto, `runFile` passes the whole text to `evalSource` with no extension, no module loading and no future manager. evidence: E4. [proposed: this IR]

C36. Under Allegro Standard, `runFile` creates one future manager for the whole run before any module loads. evidence: E4. [proposed: this IR]

C37. `runFile` scans the `use` header with `scanUses`, then loads each module the header names as an extension before the parse. evidence: E4. [proposed: this IR]

C38. For a `use NAME.MEMBER` directive, `runFile` keeps the module's bindings while dropping every Grammar binding other than the named members. evidence: E4. [proposed: this IR]

C39. `runFile` throws when a `use NAME.MEMBER` directive names a missing binding or a binding that holds no Grammar value. evidence: E4. [proposed: this IR]

C40. `runFile` evaluates each inline `use grammar { … }` block over the type system alone, adding the resulting Grammar value as an extension. evidence: E4. [proposed: this IR]

C41. `runFile` strips the `use` header before the main parse. evidence: E4. [proposed: this IR]

C42. `runFile` then loads the modules that the body's `import` statements name, found by `scanImports` without a parse. evidence: E4. [proposed: this IR]

C43. `loadImportedModules` resolves a module name first in the `lib/` directory beside the source file, then in the `lib/` directory beside `src/`. evidence: E4. [proposed: this IR]

C44. `loadImportedModules` skips a module name that an existing extension already provides. evidence: E4. [proposed: this IR]

C45. `runFile` evaluates the stripped body once through `evalSource`, with the `typed` flag set and the `softFail` flag unset. evidence: E4. [proposed: this IR]

C46. After the evaluation, `runFile` waits for every pending future of the run's future manager. evidence: E4. [proposed: this IR]

C47. On any error, `runFile` prints `Error in <file>: <message>` to stderr, then exits with code 1. evidence: E4. [proposed: this IR]

C48. A halting post-pass ends a file run with exit code 1. evidence: E24. [proposed: this IR]

C49. The suite runs the literate demos through `evalSource` with extensions the suite chooses, not through the file runner. evidence: E31. [proposed: this IR]

C50. In a run on 2026-11-01, the file runner stopped on the demo `tests/proofs-proven-demo.alg` with a parse error, the demo's `proven` extension being one the suite supplies. evidence: E26, E31. [proposed: this IR]

### The REPL [implemented]

C51. The REPL prompt reads `allegro> ` under Allegro Standard and `allegretto> ` under Allegretto. evidence: E5. [proposed: this IR]

C52. The REPL appends each input line to a buffer. evidence: E5. [proposed: this IR]

C53. The REPL evaluates the buffer at a blank line or at a line whose last non-blank character is none of `+ - * / % = < > , ( & |`. evidence: E5. [proposed: this IR]

C54. The REPL evaluates each entry through `evalSource`, passing the evaluation scope of the previous entry as the base scope. evidence: E5. [proposed: this IR]

C55. Under Allegro Standard, the REPL passes one future manager, created at start, to every entry. evidence: E5. [proposed: this IR]

C56. The REPL prints the value of an entry's last bare expression through `formatValue`, unless the value is null. evidence: E5. [proposed: this IR]

C57. The REPL prints an entry's error as `Error: <message>`, keeping the previous entry's scope as the base for the next entry. evidence: E5. [proposed: this IR]

C58. While futures are pending, the REPL defers the next prompt until the future manager drains. evidence: E5. [proposed: this IR]

C59. At the end of input, the REPL prints `Bye!` before exiting with code 0. evidence: E5. [proposed: this IR]

C60. The REPL loads no module named by a `use` line or an `import` line. evidence: E5. [proposed: this IR]

C61. In a run on 2026-11-01, the REPL answered a `use contracts` line with a parse error. evidence: E25. [proposed: this IR]

C62. In a run on 2026-11-01, each REPL entry continued after a trailing `+`, `,` or `=` failed with a parse error at the line break. evidence: E25. [proposed: this IR]

C63. B-065 (REPL improvements: multi-line, error display, completion) is the open backlog item that owns multi-line REPL entry. evidence: E33. [proposed: this IR]

C64. No test of the suite drives the REPL. evidence: E32. [proposed: this IR]

C65. `src/test/base.ts` pins the persistent scope across two `evalSource` calls, the mechanism the REPL uses. evidence: E31. [proposed: this IR]

### The `inspect` subcommand [implemented]

C66. `inspect` loads the modules of the file's `use NAME` directives and `import` statements, as the file runner does. evidence: E6. [proposed: this IR]

C67. `inspect` loads no module for a `use NAME.MEMBER` directive or an inline `use grammar { … }` block. evidence: E6. [proposed: this IR]

C68. In a run on 2026-11-01, the file runner ran `tests/dotted-use-demo.alg` and `tests/inline-grammar-demo.alg` to exit code 0. evidence: E26. [proposed: this IR]

C69. In a run on 2026-11-01, `inspect` and `verify` stopped on each of `tests/dotted-use-demo.alg` and `tests/inline-grammar-demo.alg` with a parse error. evidence: E26. [proposed: this IR]

C70. `inspect` passes no future manager to `evalSource`. evidence: E6. [proposed: this IR]

C71. `inspect` silences `console.log` during the evaluation, discarding the program's printed output. evidence: E6. [proposed: this IR]

C72. `inspect` runs `evalSource` with the `softFail` flag unset. evidence: E6. [proposed: this IR]

C73. A halting post-pass ends `inspect` with the post-pass's error message and exit code 1, before any summary prints. evidence: E6, E24. [proposed: this IR]

C74. `inspect` leaves out of the summary every binding name that a primitive or an extension provides. evidence: E6. [proposed: this IR]

C75. `summarizeModule` summarises each remaining binding of the evaluation scope that has a value. evidence: E7. [proposed: this IR]

C76. A binding summary holds the binding's type name, a resolved mark and a short description of the binding's value. evidence: E7. [proposed: this IR]

C77. A binding summary takes the type name from the compilation report's binding types first, then from the value's own type. evidence: E7. [proposed: this IR]

C78. A binding summary lists the value's refinement predicates, the primitive functions the value calls and the unresolved Symbols the value refers to. evidence: E7. [proposed: this IR]

C79. For a composed function, a binding summary holds the `requires` and `ensures` entries of the function's contract with the function's declared and inferred effects. evidence: E7. [proposed: this IR]

C80. A binding summary suggests promoting an in-body `assert` to `requires` when the asserted predicate names only the function's parameters. evidence: E7. [proposed: this IR]

C81. The rendered summary of a proof binding names each admitted or sampled law that the proof rests on, with the law's tier. evidence: E7. [proposed: this IR]

C82. A binding summary shows the totality notifications anchored to the binding, each with any counterexample. evidence: E7. [proposed: this IR]

C83. `renderModuleSummary` prints the safety grade, the binding counts, the error count, the unresolved bindings and the error messages before one block per binding. evidence: E7. [proposed: this IR]

C84. The header comment of `src/introspect.ts` states that the file adds no analysis: every summary field comes from what parsing, symbol resolution, precompile and evaluation already computed. evidence: E7. [proposed: this IR]

### <a id="def-safety-grade"></a>The safety grades [partial]

C85. Principle 7 of `docs/book/vision.md` makes a safety grade, not a proof transcript, the default surface of verification, with theorem-level detail as an opt-in drill-down. [decided: docs/book/vision.md §5, principle 7]

C86. `SafetyGrade` in `src/introspect.ts` has four values: `proven-safe`, `partial`, `has-warnings`, `has-errors`. evidence: E8. [proposed: this IR]

C87. `safetyGradeFor` grades a missing compilation report `partial`. evidence: E8. [proposed: this IR]

C88. `safetyGradeFor` grades a compilation report that holds an error-severity notification `has-errors`. evidence: E8. [proposed: this IR]

C89. `safetyGradeFor` grades a compilation report with an unresolved binding and no error `partial`. evidence: E8. [proposed: this IR]

C90. `safetyGradeFor` grades every other compilation report `proven-safe`. evidence: E8. [proposed: this IR]

C91. `safetyGradeForSummary` lowers the grade to `has-errors` when any summarised binding's type name is `Error`. evidence: E8. [proposed: this IR]

C92. No code path in `src/`, `pcp/`, `web/` or `scripts/` produces the grade `has-warnings`. evidence: E9. [proposed: this IR]

C93. The grade `proven-safe` states only the absence of three things: an error notification in the compilation report; an unresolved binding; a binding typed `Error`. evidence: E8. [proposed: this IR]

C94. The comment above `safetyGradeFor` calls the grade a coarse placeholder, naming effects, refinements, totality and proof counts as later refinements of the grade. evidence: E8. [proposed: this IR]

C95. Under `inspect`, a failed proof, an undeclared effect or a failed `proven` clause never reaches a safety grade. [inferred: R2]

C96. Under `inspect`, the grade `has-errors` comes from an error notification on which no post-pass halts, such as precompile's, or from a binding typed `Error`. [inferred: R3]

C97. The web sandbox's inspect function returns the grade `has-errors` for a source whose evaluation throws. evidence: E34. [proposed: this IR]

C98. `src/test/pcp.ts` pins the four rules of `safetyGradeFor` and the grade `proven-safe` of a clean module. evidence: E30. [proposed: this IR]

### The `verify`, `obligations` and `propose` subcommands [implemented]

C99. `verify`, `obligations` and `propose` load a file through `pcpLoadAndEval`, which loads modules as `inspect` does. evidence: E10. [proposed: this IR]

C100. `pcpLoadAndEval` runs `evalSource` with the `softFail` flag set, silencing `console.log` during the evaluation. evidence: E10. [proposed: this IR]

C101. `verify` prints the verdict that `buildVerdict` in `src/pcp.ts` builds from the evaluation scope and the compilation report. evidence: E11, E12. [proposed: this IR]

C102. A verdict lists each theorem as discharged, failed or skipped, with a failed theorem's reason and counterexample. evidence: E12. [proposed: this IR]

C103. A verdict also records the totality findings, the effect mismatches, the law and coercion obligations with their discharge tiers, the `div` obligations above the `auto` tier and the admitted liveness of the asynchronous sources in use. evidence: E12. [proposed: this IR]

C104. A verdict is verified when no theorem failed and the compilation report holds no error-severity notification. evidence: E12. [proposed: this IR]

C105. A pending law obligation leaves a verdict verified. evidence: E12. [proposed: this IR]

C106. The text form of a verdict prints the assumption ledger after the theorems and obligations, before the hints. evidence: E13. [proposed: this IR]

C107. The assumption ledger lists the admitted and sampled backings, each with the proofs resting on the backing, and counts the pending obligations. evidence: E13. [proposed: this IR]

C108. `verify --json` prints the verdict as one JSON object. evidence: E11. [proposed: this IR]

C109. `verify --obligation O.json` fails the verdict unless the obligation's theorem is discharged with a matching proposition hash. evidence: E11, E12. [proposed: this IR]

C110. `verify` exits with code 0 for a verified verdict and code 1 otherwise. evidence: E11, E24. [proposed: this IR]

C111. `obligations` lists one obligation per proof binding, per undischarged `div` entry and per law or coercion obligation of the types the evaluation scope binds. evidence: E14. [proposed: this IR]

C112. In a run on 2026-11-01, `obligations` over a two-line file with one theorem listed 15 obligations: the theorem, 12 laws of the core types, 2 coercion obligations. evidence: E24. [proposed: this IR]

C113. With `--pending`, `obligations` leaves out the discharged proofs and the settled law and coercion obligations. evidence: E14. [proposed: this IR]

C114. With `--pending`, `obligations` also lists each failed or skipped `proven` clause. evidence: E14, E29. [proposed: this IR]

C115. Without `--pending`, `obligations` lists no `proven` clause. evidence: E14, E29. [proposed: this IR]

C168. The comment beside the `pendingOnly === false` test in `extractObligations` says that the `proven` clauses are already covered via bindings. evidence: E14. [proposed: this IR]

C116. `obligations --json` prints one JSON object per line. evidence: E14. [proposed: this IR]

C117. `obligations` exits with code 0 whatever the obligations' state. evidence: E14, E24. [proposed: this IR]

C118. `propose` prints a Markdown TODO with one section per pending obligation, holding the proposition, the last failure, the verdict's hints, the lemmas in scope and the count of prior attempts. evidence: E15. [proposed: this IR]

C119. `propose --all` gives every obligation a section. evidence: E15. [proposed: this IR]

C120. `propose --output FILE.md` writes the TODO to the named file instead of stdout. evidence: E15. [proposed: this IR]

C121. The TODO's last line tells the reader to run `allegro verify` on the edited source. evidence: E15. [proposed: this IR]

C122. `propose` exits with code 0 whatever the obligations' state. evidence: E15, E30. [proposed: this IR]

### The `prove` subcommand [implemented]

C123. `prove` creates a language-model client before reading the file, exiting with code 1 when `ANTHROPIC_API_KEY` is unset. evidence: E16, E24. [proposed: this IR]

C124. The missing-key message offers a `--api-key` flag that `src/index.ts` does not parse. evidence: E3, E16. [proposed: this IR]

C125. `prove` runs `runLlmWorker` in `pcp/llm-worker.ts` with at most `--max-attempts` attempts per pending obligation, five by default. evidence: E3, E17. [proposed: this IR]

C126. `runLlmWorker` takes the pending obligations from one run of `evalSource` with the `softFail` flag set. evidence: E17. [proposed: this IR]

C127. Per attempt, `runLlmWorker` sends the primer and an iteration message to the client, then splices the answer's first `allegro` code block, or else its first fenced block, into the theorem's `by` slot. evidence: E17. [proposed: this IR]

C128. `runLlmWorker` re-evaluates the spliced source through `evalSource`, keeping the proof term when the new verdict lists the theorem as discharged. evidence: E17. [proposed: this IR]

C129. The primer is `docs/book/proving-in-allegro.md`, read relative to the current working directory. evidence: E18. [proposed: this IR]

C130. A discharged obligation's authorship names the client's model as the prover, with the attempts used. evidence: E17. [proposed: this IR]

C131. `prove --output FILE.alg` writes the source with every kept proof term spliced in. evidence: E3. [proposed: this IR]

C132. `prove` exits with code 0 when every pending obligation discharged, code 1 otherwise. evidence: E3. [proposed: this IR]

C133. `runLlmWorker` passes the file's text to `evalSource` with the type system as the one extension, the `use` header unstripped. evidence: E17. [proposed: this IR]

C134. In a run on 2026-11-01, `evalSource` over a source opening with `use contracts`, the type system the one extension, threw a parse error. evidence: E28. [proposed: this IR]

C135. With an API key set, `prove` fails on a file whose header holds a `use` directive. [inferred: R4]

C136. `src/test/pcp.ts` pins the worker's helpers, one loop of `runLlmWorker` with a mock client, and the missing-key failure of `prove`. evidence: E30. [proposed: this IR]

### The diagnostic variables [implemented]

C137. Four environment variables switch on diagnostics: `ALLEGRO_STACK`, `ALLEGRO_TRACE_DEPTH`, `ALLEGRO_PARSE_STATS`, `ALLEGRO_EVAL_STATS`. evidence: E19, E20, E21, E22. [proposed: this IR]

C138. With `ALLEGRO_STACK` set, the file runner prints the JavaScript stack of an error after the error's message. evidence: E19, E27. [proposed: this IR]

C139. `runFile` holds the one read of `ALLEGRO_STACK` in `src/`, leaving the REPL and the subcommands to print the message alone. evidence: E19, E27. [proposed: this IR]

C140. With `ALLEGRO_TRACE_DEPTH` set to a number N, `applyComposed` prints the evaluation depth and the first 120 characters of the applied body's source to stderr at each depth waterline. evidence: E20. [proposed: this IR]

C141. The first depth waterline is N, each later waterline lying N levels beyond the depth of the last printed line. evidence: E20. [proposed: this IR]

C142. A value of `ALLEGRO_TRACE_DEPTH` that is zero or no number sets the step N to 500. evidence: E20. [proposed: this IR]

C143. The comment above `TRACE_DEPTH` in `src/evaluator.ts` says that `ALLEGRO_TRACE_DEPTH=1` prints a line every 500 levels. evidence: E20. [proposed: this IR]

C144. In a run on 2026-11-01, `ALLEGRO_TRACE_DEPTH=1` printed 383 lines, one at every second depth level, before the stack overflowed. evidence: E27. [proposed: this IR]

C145. `ALLEGRO_TRACE_DEPTH` is a diagnostic for runaway recursion, not a tracer of evaluation. evidence: E20. [proposed: this IR]

C146. With `ALLEGRO_PARSE_STATS` set to any value but empty or `0`, `parseSource` prints one `parse-stats` line to stderr per program or library parse. evidence: E21. [proposed: this IR]

C147. A `parse-stats` line gives the source, the character count, the outcome, the duration and six engine counts as `key=value` fields. evidence: E21, E27. [proposed: this IR]

C148. With `ALLEGRO_EVAL_STATS` set to any value but empty or `0`, the evaluator prints one `eval-stats` line to stderr at process exit. evidence: E22. [proposed: this IR]

C149. An `eval-stats` line gives eleven `key=value` counts for the whole run, every program and library included. evidence: E22, E27. [proposed: this IR]

C150. `ALLEGRO_PARSE_STATS` and `ALLEGRO_EVAL_STATS` reach every caller of `evalSource`, because `parseSource` and `beginEvalStats` read the variables inside the evalSource pipeline. evidence: E21, E22. [proposed: this IR]

C151. `npm run bench:load` runs the load corpus through the file runner with both stats variables set, reading the stderr lines back. evidence: E23. [proposed: this IR]

C152. `npm run lint:load` counts parses through the stats sink of `setParseStatsSink`, not through `ALLEGRO_PARSE_STATS`. evidence: E23. [proposed: this IR]

C169. Since B-159 chunk R2, `npm run lint:load` runs each source of the precompile corpus through the file runner with `ALLEGRO_EVAL_STATS=1`, gating counts of the `eval-stats` line. evidence: E23. [proposed: this IR]

C153. No test of the suite sets any of the four diagnostic variables. evidence: E32. [proposed: this IR]

C154. `src/test/language.ts` pins the evaluation counts through the stats sink of `setEvalStatsSink`. evidence: E31. [proposed: this IR]

### What the T-tooling track has not built [partial]

C155. Tracing and step-through debugging are undesigned. [decided: docs/book/platform/README.md, track table]

C156. No file of `src/`, `pcp/` or `web/` holds an execution tracer, a stepper or a breakpoint. evidence: E37. [proposed: this IR]

C157. B-064 (execution tracing and step-through debugging) is the open backlog item that owns tracing. evidence: E33. [proposed: this IR]

C158. No file of `src/`, `pcp/` or `web/` holds a language server or an editor integration. evidence: E37. [proposed: this IR]

C159. B-067 (LSP and IDE integration) is the open backlog item that owns the IDE integration. evidence: E33. [proposed: this IR]

C160. B-068 (the review experience) is the open backlog item that owns the semantic summary as the primary reviewable artifact. evidence: E33. [proposed: this IR]

C161. B-161 (CLI startup) is the open backlog item that owns the startup cost of the CLI's module loading. evidence: E33. [proposed: this IR]

### Where the code is, and what pins it [implemented]

C162. `src/index.ts` holds `runFile`, `repl`, `runInspect`, `pcpLoadAndEval`, `runPcpVerify`, `runPcpObligations`, `runPcpPropose` and `runPcpProve`. evidence: E3, E4, E5, E6, E10, E11, E14, E15. [proposed: this IR]

C163. `src/introspect.ts` holds `summarizeValue`, `safetyGradeFor`, `safetyGradeForSummary`, `summarizeModule` and `renderModuleSummary`. evidence: E7, E8. [proposed: this IR]

C164. `src/test/pcp.ts` pins four subcommands by child-process runs of `src/index.ts`: `verify`; `obligations --json`; `propose`, with and without `--output`; the missing-key failure of `prove`. evidence: E30, E32. [proposed: this IR]

C165. Tests in `src/test/pcp.ts`, `src/test/effects.ts`, `src/test/refinements.ts`, `src/test/totality.ts` and `src/test/equality-laws.ts` pin the summaries of `src/introspect.ts`. evidence: E30. [proposed: this IR]

C166. No test of the suite runs the file runner, the REPL or the `inspect` subcommand as a command. evidence: E32. [proposed: this IR]

C170. `npm run lint:load` is the one gate check that runs the file runner, over the precompile corpus. evidence: E23, E32. [proposed: this IR]

C167. `npm run lint:units` pins the unit mapping of `src/index.ts` and `src/introspect.ts`. evidence: E35. [proposed: this IR]

### Clusters

G1. cluster: C1, C2, C3, C4, C5 [proposed: this IR]

G2. cluster: C6, C7, C8, C9, C10 [proposed: this IR]

G3. cluster: C11, C12, C13, C14, C15 [proposed: this IR]

G4. cluster: C16, C17, C18, C19 [proposed: this IR]

G5. cluster: C20, C21, C22 [proposed: this IR]

G6. cluster: C23, C24, C25, C26, C27, C28 [proposed: this IR]

G7. cluster: C29, C30, C31, C32, C33 [proposed: this IR]

G8. cluster: C34, C35, C36, C37, C38, C39, C40, C41 [proposed: this IR]

G9. cluster: C42, C43, C44, C45, C46, C47, C48 [proposed: this IR]

G10. cluster: C49, C50 [proposed: this IR]

G11. cluster: C51, C52, C53, C54, C55, C56, C57, C58, C59 [proposed: this IR]

G12. cluster: C60, C61, C62, C63, C64, C65 [proposed: this IR]

G13. cluster: C66, C67, C68, C69, C70, C71, C72, C73 [proposed: this IR]

G14. cluster: C74, C75, C76, C77, C78, C79, C80, C81, C82, C83, C84 [proposed: this IR]

G15. cluster: C85, C86, C87, C88, C89, C90, C91, C92, C93, C94 [proposed: this IR]

G16. cluster: C95, C96, C97, C98 [proposed: this IR]

G17. cluster: C99, C100, C101, C102, C103, C104, C105, C106, C107, C108, C109, C110 [proposed: this IR]

G18. cluster: C111, C112, C113, C114, C115, C168, C116, C117 [proposed: this IR]

G19. cluster: C118, C119, C120, C121, C122 [proposed: this IR]

G20. cluster: C123, C124, C125, C126, C127, C128, C129, C130, C131, C132 [proposed: this IR]

G21. cluster: C133, C134, C135, C136 [proposed: this IR]

G22. cluster: C137, C138, C139 [proposed: this IR]

G23. cluster: C140, C141, C142, C143, C144, C145 [proposed: this IR]

G24. cluster: C146, C147, C148, C149, C150, C151, C152, C169, C153, C154 [proposed: this IR]

G25. cluster: C155, C156, C157, C158, C159, C160, C161 [proposed: this IR]

G26. cluster: C162, C163, C164, C165, C166, C170, C167 [proposed: this IR]

## Relations

R1. C48 depends-on C47 because a halting post-pass throws out of `evalSource`, and `runFile` turns every throw into exit code 1.

R2. C95 depends-on C72 because, with the `softFail` flag unset, each of the three failures halts the evaluation before `summarizeModule` runs (C73).

R3. C96 depends-on C95 because the halting failures never reach a grade, which leaves the non-halting error notifications (C88) and the `Error`-typed bindings (C91).

R4. C135 depends-on C133 because the `use` header that `runLlmWorker` leaves in place fails to parse (C134).

R5. C143 contradicts C141 because the variable's value is the step itself, which makes a value of 1 print at nearly every application (C144).

R6. C93 refines C85 because the implemented grade counts no unproven sub-expression, while principle 7 names a count of warnings about unproven sub-expressions as the surface.

R7. C22 contradicts C13 because `scripts/analyze/units.json` places the `introspect` unit on the track layer, not on L2.

R8. C69 depends-on C67 because both demo files open with a `use` directive that neither `inspect` nor `pcpLoadAndEval` loads.

R9. C115 contradicts C168 because a `proven` clause rides a function binding, which `extractObligations` skips as no proof binding.

R10. C50 supports C49 because a demo that the suite passes runs only with the suite's extensions.

R11. C145 supports C155 because the only depth diagnostic prints waterlines, not a trace of the evaluation's steps.

## Evidence

E1. `scripts/analyze/units.json` line 2 (each unit lists its direct dependencies; the transitive closure is permitted), lines 39–41 (the `pipeline`, `introspect` and `cli` units, each with layer `track`), lines 43–78 (the `files` map, 34 entries, every key under `src/`; `src/introspect.ts` at line 76, `src/index.ts` at line 77).

E2. `npx tsx scripts/analyze/index.ts units` and `units --json`, run on this branch on 2026-11-01: five mixed files (`src/types.ts`, `src/primitives.ts`, `src/runtime.ts`, `src/modules.ts`, `src/types-std.ts`); discriminator count 458, of which 19 in `src/introspect.ts`; from `src/index.ts`, edges to `src/futures.ts` and `src/use-scanner.ts` ok and to `src/primitives.ts`, `src/runtime.ts`, `src/types.ts`, `src/types-std.ts`, `src/modules.ts` unresolved; no edge from `src/index.ts` to `src/introspect.ts` or `src/pcp.ts`.

E3. `src/index.ts` lines 283–375: `--base` read anywhere in the arguments, the subcommand chosen by the first positional argument, each usage line followed by exit code 1, a file run otherwise, the REPL with no positional argument; dynamic imports at lines 419, 427, 481–482, 520–521, 556 and 615; `prove`'s flags parsed at lines 355–361 (`--max-attempts` defaulting to 5, `--model`, `--output`, `--json`, no `--api-key`), `runPcpProve` called without the `standard` flag at line 362; `runPcpProve` at lines 608–653 writing `--output` and exiting 0 only when every obligation discharged.

E4. `src/index.ts` lines 39–78 (`loadImportedModules`: `scanImports`, names an extension provides skipped, the local `lib/` then the system `lib/` beside `src/`), lines 84–111 (`loadGrammarModules`), lines 115–225 (`runFile`: Allegretto at 117–120; the future manager at 127; `scanUses` at 131; the member filter and its two throws at 146–175; inline grammar literals evaluated over `getStdExtensions()` at 183–204; the header stripped at 208; imports loaded at 213; `evalSource` with `typed` true at 216; the wait at 217–219; `Error in`, `ALLEGRO_STACK` and exit 1 at 220–224).

E5. `src/index.ts` lines 229–280 (`repl`): the prompts at 233, one future manager at 242, the continuation test at 248, `evalSource` with the previous `evalCtx` at 251–254, `formatValue` at 256, `Error:` at 259, the deferred prompt at 266–273, `Bye!` and exit 0 at 276–279; no `scanUses` or module loader call.

E6. `src/index.ts` lines 383–434 (`runInspect`): only `module` directives loaded at 390–395, the header stripped at 396, imports loaded under Allegro Standard at 401–404, `console.log` silenced at 407–409, `evalSource` without a future manager or `softFail` at 412, primitive and extension names excluded at 419–425, the summary rendered at 427–433.

E7. `src/introspect.ts` lines 1–12 (no new analyses; every field from information already computed), 40–132 (`ValueSummary`, `ModuleSummary`, `BindingSummary`), 143–298 (`summarizeValue`: contracts at 175–198, promotion suggestions at 220–232, predicates at 239–252, effects at 258–265, `restsOn` at 270–277), 534–589 (`summarizeModule`: totality notices grouped at 549–562, bindings with values at 564–574, the type name at 570), 595–722 (`renderModuleSummary`; weak backings at 672–683).

E8. `src/introspect.ts` lines 102–109 (`SafetyGrade`), 487–504 (`safetyGradeFor` and the comment calling the grade intentionally coarse, a placeholder, with Phases B, D, E and F to refine it; "a loose promise", "only checking that the compiler didn't complain"), 506–523 (`safetyGradeForSummary`, `Error`-typed bindings).

E9. Search of `src/`, `pcp/`, `web/` and `scripts/` on 2026-11-01 for `has-warnings`: one hit, the type declaration at `src/introspect.ts` line 108.

E10. `src/index.ts` lines 442–473 (`pcpLoadAndEval`): module directives and imports as in `runInspect`, `console.log` silenced at 462–463, `evalSource` with `softFail` true at 468.

E11. `src/index.ts` lines 475–512 (`runPcpVerify`): `--obligation` parsed and checked with `checkObligationSatisfied`, `serializeVerdict` for `--json`, `formatVerdict` otherwise, exit 0 when verified and 1 otherwise.

E12. `src/pcp.ts` lines 115–145 (the `Verdict` fields; pending law entries do not flip `verified`, lines 133–136), 704–851 (`buildVerdict`: theorems from proof bindings and from `proof-failure`, `proven-failed` and `proven-skipped` notifications; `div` obligations other than `auto`; admitted liveness; `verified` at line 838), 1102–1118 (`checkObligationSatisfied`: theorem present, discharged, proposition hash equal).

E13. `src/pcp.ts` lines 500–546 (`buildAssumptionLedger`: admitted and sampled backings with the proofs they back, the pending count) and 548–676 (`formatVerdict`: the ledger at 640–663, the hints after it at 664–675).

E14. `src/index.ts` lines 514–541 (`runPcpObligations`: `--pending` passed as `pendingOnly`, one serialised obligation per line for `--json`, no exit call) and `src/pcp.ts` lines 968–1100 (`extractObligations`: proof bindings; the `proven` notifications skipped when `pendingOnly === false` at line 1029, with the comment "already covered via bindings"; undischarged `div` entries; law and coercion obligations of the bound types).

E15. `src/index.ts` lines 543–600 (`runPcpPropose`: `--all`, `--output`, no exit call) and `src/pcp.ts` lines 1153–1232 (`formatTodo`: the sections, the closing line naming `allegro verify`).

E16. `pcp/llm-worker.ts` lines 182–209 (`createAnthropicClient`: the key check and the message "Set the environment variable or pass --api-key, or use `allegro propose`"); `src/index.ts` lines 615–616 (the client created before `runLlmWorker`).

E17. `pcp/llm-worker.ts` lines 226–392 (`runLlmWorker` from line 264: the file read and evaluated with `createTypeSystem()` alone and `softFail` true at 266–271, pending obligations at 272–273, the attempt loop from line 290, `extractCodeBlocks` and `spliceProof`, the re-evaluation and `buildVerdict` at 340–342, the authorship with `client.modelId()` at 349–354).

E18. `pcp/llm-worker.ts` lines 397–406 (`loadPrimer`: an explicit root or the current working directory) and `src/index.ts` lines 617–622 (no root passed).

E19. `src/index.ts` line 222; search of `src/` on 2026-11-01 for `ALLEGRO_STACK`: that line only.

E20. `src/evaluator.ts` lines 15–24 (`MAX_DEPTH`; the comment on `ALLEGRO_TRACE_DEPTH=1`; `TRACE_STEP = Math.max(1, Number(value) || 500)`) and 798–803 (the waterline moved to the depth plus the step, the body rendered and cut to 120 characters, `[evaluation depth D]` to stderr).

E21. `src/grammar2/engine.ts` lines 140–198 (`parseStatsSwitchOn`, `formatParseReport`, `parseSource` printing per parse) and `src/runtime.ts` line 1227 (`evalSource` parses through `parseSource`).

E22. `src/evaluator.ts` lines 44–50, 116–141 and 154–181 (the switch, `formatRunStats` with eleven fields, `beginEvalStats` registering the exit line) and `src/runtime.ts` lines 1256 and 1723 (`beginEvalStats` and `endEvalStats` inside `evalSource`).

E23. `bench/load.ts` lines 1–35 (report mode with both variables; check mode parsing in-process; since B-159 R2, check mode also running the precompile corpus through the CLI with `ALLEGRO_EVAL_STATS=1`), 162–186 (`measurePrecompile`: one `src/index.ts` process per source, the `eval-stats` line read back), 188–203 (report mode's child runs with both variables set), 305 (the parse sink) and 355–358 (check mode calling `measurePrecompile`); `package.json` lines 18 and 25.

E24. Runs on this branch on 2026-11-01 of `npx tsx src/index.ts` over two scratch files, one with a true theorem `t1` and one with a false theorem `t2`: the file runner exited 0 and 1; `inspect` printed `safety grade: proven-safe` and exited 0, then printed "proof check failed" and exited 1; `verify` exited 0 and 1; `obligations` over the false-theorem file listed 15 obligations and exited 0; `propose` printed a one-section TODO and exited 0; `prove` with no key printed the missing-key message and exited 1.

E25. Runs on this branch on 2026-11-01 of the REPL with piped input: `use contracts` gave "Parse error at position 4"; `f(1,` then `2)`, `1 +` then `2`, and `z =` then `5` each gave a parse error at the line break.

E26. Runs on this branch on 2026-11-01: `npx tsx src/index.ts tests/dotted-use-demo.alg` and `tests/inline-grammar-demo.alg` exited 0; `inspect` and `verify` over each printed a parse error (positions 141 and 80); `npx tsx src/index.ts tests/proofs-proven-demo.alg` printed a parse error at position 579.

E27. Runs on this branch on 2026-11-01 of a scratch file defining an unbounded recursion: `ALLEGRO_TRACE_DEPTH=500` printed one `[evaluation depth 501]` line, `=200` three lines, `=1` 383 lines at depths 1, 3, 5 and onwards, each run ending in "Maximum call stack size exceeded"; `ALLEGRO_STACK=1` printed the stack under the file runner and not under `inspect`; `ALLEGRO_PARSE_STATS=1 ALLEGRO_EVAL_STATS=1` printed one `parse-stats` line and one `eval-stats` line.

E28. A scratch script run on this branch on 2026-11-01: `evalSource("use contracts\nx = 1\n", undefined, [createTypeSystem()], undefined, true, undefined, true)` threw "Parse error at position 4".

E29. Runs on this branch on 2026-11-01 of a scratch file with `use proven` and a function whose `proven` clause fails: `obligations` listed no obligation for the function; `obligations --pending` listed one; `verify` reported the clause as failed with a counterexample.

E30. `src/test/pcp.ts` lines 360–377 (`verify` exit codes and JSON), 379–392 (`obligations --json`), 592–607 and 609–626 (`propose`, with and without `--output`), 636–730 and 732 (the worker's helpers and the mock-client loop), 800–815 (`prove` without a key), 817–878 (the summaries and the four `safetyGradeFor` rules); summaries also in `src/test/effects.ts` lines 125 and 1252, `src/test/refinements.ts` lines 417 and 433, `src/test/totality.ts` lines 703–704, `src/test/equality-laws.ts` line 660.

E31. `src/test/base.ts` lines 234–250 (persistent context across two evaluations); `src/test/language.ts` lines 179–215 (binding evaluation counts through `setEvalStatsSink`); `src/test/alg-files.ts` lines 64–218 (`runAlgFile` over `evalSource`) and `src/test/proofs.ts` lines 547–551 and 657 (the demo run with the suite's `provenExt`).

E32. Search of `src/test/`, `scripts/` and `bench/` on 2026-11-01: outside `bench/load.ts`, no script runs the file runner; in `src/test/`, no read or write of `ALLEGRO_STACK`, `ALLEGRO_TRACE_DEPTH`, `ALLEGRO_PARSE_STATS` or `ALLEGRO_EVAL_STATS`; the only runs of `src/index.ts` are in `src/test/pcp.ts` at lines 365, 368, 380, 596, 614 and 804, with `verify`, `obligations`, `propose` and `prove`; no test drives `repl`.

E33. `docs/backlog.md` lines 718–725 (the T-tooling list: B-064 execution tracing and step-through debugging, B-065 REPL improvements, B-066, B-067 LSP and IDE integration, B-068 the review experience, all open) and 1339–1349 (B-161, CLI startup, open).

E34. `web/allegro-web.ts` lines 278–335 (`inspectAllegro`: `use` module, member and literal directives handled, `summarizeModule` and `renderModuleSummary`, `has-errors` returned on a throw).

E35. `package.json` lines 13–30: `main` is `src/index.ts`, `start` runs `tsx src/index.ts`, `lint:units` runs the units check; no `bin` key.

E36. `docs/book/implementation-map.md` lines 35 and 40: `src/introspect.ts` in layer L2, `src/index.ts` in T-build.

E37. Search of `src/`, `pcp/` and `web/` on 2026-11-01, outside `src/test/`, for `tracer`, `step-through`, `stepper`, `breakpoint`, `language server`, `vscode` and `lsp`: no hit.

## Asks

A1. Ratify in bulk the proposed claims, every claim about the code as implemented and the four about the chapter's own reader, terms and examples: C2, C4, C5, C8, C13, C14, C15, C16, C17, C18, C19, C20, C21, C22, C23, C24, C25, C26, C27, C28, C29, C30, C31, C32, C33, C34, C35, C36, C37, C38, C39, C40, C41, C42, C43, C44, C45, C46, C47, C48, C49, C50, C51, C52, C53, C54, C55, C56, C57, C58, C59, C60, C61, C62, C63, C64, C65, C66, C67, C68, C69, C70, C71, C72, C73, C74, C75, C76, C77, C78, C79, C80, C81, C82, C83, C84, C86, C87, C88, C89, C90, C91, C92, C93, C94, C97, C98, C99, C100, C101, C102, C103, C104, C105, C106, C107, C108, C109, C110, C111, C112, C113, C114, C115, C116, C117, C118, C119, C120, C121, C122, C123, C124, C125, C126, C127, C128, C129, C130, C131, C132, C133, C134, C136, C137, C138, C139, C140, C141, C142, C143, C144, C145, C146, C147, C148, C149, C150, C151, C152, C153, C154, C156, C157, C158, C159, C160, C161, C162, C163, C164, C165, C166, C167, C168, C169, C170. Depends: C2, C4, C5, C8, C13, C14, C15, C16, C17, C18, C19, C20, C21, C22, C23, C24, C25, C26, C27, C28, C29, C30, C31, C32, C33, C34, C35, C36, C37, C38, C39, C40, C41, C42, C43, C44, C45, C46, C47, C48, C49, C50, C51, C52, C53, C54, C55, C56, C57, C58, C59, C60, C61, C62, C63, C64, C65, C66, C67, C68, C69, C70, C71, C72, C73, C74, C75, C76, C77, C78, C79, C80, C81, C82, C83, C84, C86, C87, C88, C89, C90, C91, C92, C93, C94, C97, C98, C99, C100, C101, C102, C103, C104, C105, C106, C107, C108, C109, C110, C111, C112, C113, C114, C115, C116, C117, C118, C119, C120, C121, C122, C123, C124, C125, C126, C127, C128, C129, C130, C131, C132, C133, C134, C136, C137, C138, C139, C140, C141, C142, C143, C144, C145, C146, C147, C148, C149, C150, C151, C152, C153, C154, C156, C157, C158, C159, C160, C161, C162, C163, C164, C165, C166, C167, C168, C169, C170.

A2. Ratify or strike the proposed term safety grade (T30); the term the evalSource pipeline (T27) is proposed by the evaluation pipeline chapter's IR and rides that IR's own ratification ask. Depends: C2, C86, C90, C93.
