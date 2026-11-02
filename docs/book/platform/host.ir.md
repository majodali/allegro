# IR: Host environments

Reader: RD-4
Purpose: document. The book's chapter on the T-host track: the Node CLI and the browser sandbox as host environments, the environment capabilities they supply, the browser-compatible core, and the environment-capability contract of `docs/book/allegretto/structures.md` §11, with asynchronous I/O capabilities and browser packaging stated as not built.
Status: delivered IR-only (unratified terms 0; footprint: declared 6, changed 6, surprises 0, misses 0)
Source: chunk A4 of docs/plans/book-chapters-now.md (stream A, B-170); src/index.ts, web/allegro-web.ts and website/ as the host surfaces; docs/book/allegretto/structures.md §11 as the contract
Footprint: docs/book/platform/host.ir.md; docs/book/README.md; docs/reading-order.json; docs/book/platform/README.md; docs/documentation-census.md; docs/CHANGELOG.md; docs/plans/book-chapters-now.md

## Terms

T1. Track, with T-host the track of execution environments. defined-at: ../layers.md#def-track [decided: docs/book/layers.md §2]

T2. Node CLI and browser sandbox, the two execution environments that the T-host track names. defined-at: ../layers.md#def-track [decided: docs/book/layers.md §2]

T3. Layer, with Allegretto as L0 and Allegro Standard as L2. defined-at: ../layers.md#def-layer [decided: docs/book/layers.md §1]

T4. Unit, with the unit DAG the order of units in `docs/book/units.md` §4. defined-at: ../units.md#def-unit [decided: D50]

T5. Plane, with the host plane the plane of interpreter bookkeeping. defined-at: ../concepts.md#def-plane [decided: docs/book/concepts.md §18]

T6. Primitive function. defined-at: ../concepts.md#def-primitivefunction [decided: docs/book/concepts.md §8]

T7. Scope. defined-at: ../concepts.md#def-scope [decided: docs/book/concepts.md §15]

T8. Residual. defined-at: ../concepts.md#def-resolved-unresolved-residual [decided: docs/book/concepts.md §26]

T9. Future cell. defined-at: ../concepts.md#def-future-cell-and-completion [decided: docs/book/concepts.md §28]

T10. The evalSource pipeline. defined-at: ../concepts.md#def-the-evalsource-pipeline [decided: docs/book/concepts.md §29]

T11. Effect, a label such as `io`, `time` or `net`. defined-at: ../concepts.md#def-effect [decided: docs/book/concepts.md §40]

T12. Discharge tier, with `admitted` the tier of a declared axiom. defined-at: ../concepts.md#def-divergence-and-discharge-tiers [decided: docs/book/concepts.md §43]

T13. Extension, a set of named bindings the execution context injects between the primitives and the source. defined-at: ../extension/modules.md#loading-l1 [decided: docs/book/extension/modules.md, Loading]

T14. Library, a module file that `ModuleLoader` loads into an extension. defined-at: ../extension/modules.md#loading-l1 [decided: docs/book/extension/modules.md, Loading]

T15. Environment capability, a capability that the host environment provides, such as `print`, `fetch` or `delay`. defined-at: ../allegretto/structures.md#11-the-minimal-base-surface-designed [decided: D27]

T16. ENV, the disposition of the minimal-base audit for a primitive that is an environment capability. defined-at: ../allegretto/structures.md#11-the-minimal-base-surface-designed [decided: D27]

## Claims

### Reader and authority

C1. This chapter covers four subjects: the Node CLI; the browser sandbox; the browser-compatible core; the environment-capability contract of `docs/book/allegretto/structures.md` §11, cited there. [decided: docs/plans/book-chapters-now.md §5, row A4, 2026-10-30]

C2. This chapter is delivered IR-only: no prose is rendered from this IR until a later stage that the maintainer schedules. [decided: docs/plans/book-chapters-now.md §3.1 and R8, 2026-10-30]

C3. This chapter defines no term: each term it uses links from this chapter's Terms section to a definition site in an earlier chapter. [proposed: this IR]

C4. The reader of this chapter has read the Part I chapters and the Part II chapters before this chapter, the tooling chapter included. [proposed: this IR]

C5. This chapter carries the Tier 1 authority that `docs/book/process.md` §1 gives every chapter of the book. [decided: docs/book/process.md §1]

C6. Each Claims sub-heading of this chapter carries the status tag that `docs/book/README.md` defines. [decided: docs/book/README.md, Status convention]

C7. This chapter holds no examples. [proposed: this IR]

C8. The tooling chapter, `docs/book/platform/tooling.ir.md`, describes the file runner, the REPL and the subcommands of `src/index.ts`, which this chapter treats only as host code. [proposed: this IR]

### The T-host track and the environment-capability contract [designed]

C9. The T-host track touches L0 and L2. [decided: docs/book/layers.md §2]

C10. The T-host track covers four things: the Node CLI; the browser sandbox; the environment-provided capabilities `print`, `fetch` and `delay`; asynchronous I/O. [decided: docs/book/layers.md §2]

C11. The T-host track has no milestone, the in-browser sandbox being continuous work. [decided: docs/book/layers.md §3]

C12. The site allegrolang.org is the maintainer's primary sandbox, not just marketing. [decided: docs/book/process.md §9]

C13. Each new grammar library must be registered through `Allegro.registerLibrary` for the web sandbox. [decided: docs/book/process.md §9]

C14. D27 makes Allegretto's irreducible base about 40 primitives in five groups, with IO outside the base, as a design target. [decided: D27]

C15. `docs/book/allegretto/structures.md` §11 classes `print`, `fetch` and `delay` as environment-provided capabilities, the reason each carries an effect label. [decided: docs/book/allegretto/structures.md §11]

C16. The minimal-base audit gives `print`, `fetch` and `delay` the disposition ENV, with the labels `io`, `net` and `time` respectively. [decided: docs/book/allegretto/structures.md Appendix B]

C17. The relocation of every non-base primitive out of the base registry is future work under D27. [decided: docs/book/allegretto/structures.md Appendix B]

C18. Misalignment M10 of `docs/book/units.md` states that the environment has no unit. [decided: docs/book/units.md §6.1, M10]

C19. Misalignment M10 places a future `host` unit between the `futures` unit and the `base-primitives` unit, imported by the primitives, supplied by the CLI and by the web bundle. [decided: docs/book/units.md §6.1, M10]

C20. `docs/book/units.md` §4.1 states that the host plane is not a unit, each unit declaring the host state it owns. [decided: docs/book/units.md §4.1]

C21. The host plane holds interpreter bookkeeping that is no part of the value it rides. [decided: docs/book/concepts.md §18]

C22. B-141 (there is no Environment interface) is the open backlog item that owns the provider side of the environment-capability contract. evidence: E1. [proposed: this IR]

C23. B-141 records that the Node CLI and the browser sandbox differ by capturing `print` output and by substituting extensions, not by implementing a stated interface. evidence: E1. [proposed: this IR]

C24. B-141 waits for B-136 (scope leaves `Value`), because the future manager is planted on the scope. evidence: E1. [proposed: this IR]

### The environment capabilities as implemented [implemented]

C25. `src/primitives.ts` registers `print` with the effect label `io`, `delay` with `time` and `fetch` with `net`. evidence: E2. [proposed: this IR]

C26. `evalSource` plants the run's future manager as a host-plane property of the evaluation scope. evidence: E3. [proposed: this IR]

C27. `print`, `delay` and `fetch` find the future manager through `scopeHostRead`, which walks the scope's parent chain. evidence: E3, E4, E5. [proposed: this IR]

C28. `print` returns a residual while the printed value or a slot of the printed value is pending. evidence: E4. [proposed: this IR]

C29. `print` hands the formatted value to the future manager's `onOutput` callback when one is set, else to `console.log`. evidence: E4. [proposed: this IR]

C30. `delay` and `fetch` each throw "requires async runtime" when the scope chain holds no future manager. evidence: E5. [proposed: this IR]

C31. `delay(ms)` returns a future cell that a JavaScript `setTimeout` timer fills with the Int 0 after `ms` milliseconds. evidence: E5. [proposed: this IR]

C32. `fetch(url)` returns a future cell that `globalThis.fetch` fills with the response body as a String. evidence: E5. [proposed: this IR]

C33. A failed request or a response status outside 200 to 299 fills the `fetch` cell with an error value instead of throwing. evidence: E5. [proposed: this IR]

C34. `fetch` passes only the URL to `globalThis.fetch`, which therefore sends a GET request with no body. evidence: E5. [proposed: this IR]

C35. `src/primitives.ts` declares the liveness of `delay` as live, a timer always firing. evidence: E6. [proposed: this IR]

C36. `src/primitives.ts` declares the liveness of `fetch` at the `admitted` discharge tier, with the assumption that the fetched endpoint eventually responds. evidence: E6. [proposed: this IR]

C37. `createFuture` in `src/futures.ts` adds one pending future cell to the evaluation scope for each JavaScript Promise it receives. evidence: E7. [proposed: this IR]

C38. A settled Promise fills its future cell through `applyPhase`, which re-evaluates what residualised on the cell. evidence: E7. [proposed: this IR]

C39. A rejected Promise fills its future cell with an error value, never a throw. evidence: E7. [proposed: this IR]

C40. `waitForAll` returns a Promise that resolves once the future manager has no pending future. evidence: E7. [proposed: this IR]

C41. Outside the suite, `delay` and `fetch` are the only callers of `createFuture`. evidence: E8. [proposed: this IR]

C42. Neither host environment replaces `print`, `delay` or `fetch`: both run the implementations in `src/primitives.ts`. evidence: E9, E15. [proposed: this IR]

### The Node CLI [implemented]

C43. `src/index.ts` is the Node CLI, run through `tsx` as `npx tsx src/index.ts` or as `npm start`. evidence: E10. [proposed: this IR]

C44. `package.json` names no Node version: the file has no `engines` field. evidence: E10. [proposed: this IR]

C45. CI runs the gate on Node 22. evidence: E29. [proposed: this IR]

C46. `src/index.ts` imports three Node modules: `fs`, `path`, `readline`. evidence: E9. [proposed: this IR]

C47. Outside `src/test/`, two more files of `src/` import a Node module: `src/boundary-tests.ts` and `src/grammar2/bench.ts`. evidence: E8. [proposed: this IR]

C48. The Node CLI reads each source file with `fs.readFileSync` as UTF-8. evidence: E9. [proposed: this IR]

C49. The Node CLI finds the `lib/` directory beside `src/` from `import.meta.url`. evidence: E9. [proposed: this IR]

C50. The Node CLI resolves a module name with `fs.existsSync`, trying the `lib/` directory beside the source file before the `lib/` directory beside `src/`. evidence: E9. [proposed: this IR]

C51. `ModuleLoader` in `src/modules.ts` reads no file itself: its caller supplies a `readFile` or `readFileSync` function. evidence: E11. [proposed: this IR]

C52. The Node CLI supplies `ModuleLoader` with a `readFile` function over `fs.readFileSync`. evidence: E9. [proposed: this IR]

C53. The REPL reads lines from `process.stdin` through `readline`, prompting on `process.stdout`. evidence: E9. [proposed: this IR]

C54. The Node CLI takes its arguments from `process.argv`. evidence: E9. [proposed: this IR]

C55. The Node CLI ends a failed run through `process.exit` with code 1. evidence: E9. [proposed: this IR]

C56. The Node CLI sets no `onOutput` callback, leaving `print` to write through `console.log` to stdout. evidence: E4, E9. [proposed: this IR]

C57. Under Allegro Standard, the file runner and the REPL each create one future manager. evidence: E9. [proposed: this IR]

C58. Under Allegretto, the file runner and the REPL create no future manager. evidence: E9. [proposed: this IR]

C59. In a run on 2026-11-02, the file runner under Allegretto stopped on a file calling `delay(5)` with exit code 1 and the message "delay: requires async runtime (no FutureManager available)". evidence: E12. [proposed: this IR]

C60. In a run on 2026-11-02, the file runner under Allegro Standard printed 0 for that file, exiting with code 0. evidence: E12. [proposed: this IR]

C61. The file runner waits for every pending future of its future manager before the run ends. evidence: E9. [proposed: this IR]

### The browser sandbox [implemented]

C62. `web/allegro-web.ts` is the entry of the web bundle. evidence: E13. [proposed: this IR]

C63. `npm run build:web` bundles `web/allegro-web.ts` with esbuild into `web/dist/allegro.js`, an IIFE for the browser platform. evidence: E10. [proposed: this IR]

C64. The web bundle is a build output: `.gitignore` excludes every `dist/` directory. evidence: E14. [proposed: this IR]

C65. In a build on 2026-11-02, the web bundle held 28 files of `src/` with `web/allegro-web.ts`. evidence: E15. [proposed: this IR]

C66. The web bundle leaves out seven files of `src/` outside `src/test/`: `src/index.ts`, `src/modules.ts`, `src/pcp.ts`, `src/use-scanner.ts`, `src/grammar2/to-allegro.ts`, `src/boundary-tests.ts`, `src/grammar2/bench.ts`. evidence: E15. [proposed: this IR]

C67. `web/allegro-web.ts` imports no Node module. evidence: E13. [proposed: this IR]

C68. The web bundle sets `window.Allegro` to an object of six functions: `eval`, `evalAsync`, `reset`, `formatValue`, `registerLibrary`, `inspect`. evidence: E13. [proposed: this IR]

C69. `Allegro.eval` and `Allegro.evalAsync` evaluate under Allegro Standard by default, with the type system as the base extension. evidence: E13. [proposed: this IR]

C70. `Allegro.eval` and `Allegro.evalAsync` keep the evaluation scope from one call to the next. evidence: E13, E16. [proposed: this IR]

C71. `Allegro.reset` drops the kept evaluation scope with the future manager. evidence: E13, E16. [proposed: this IR]

C72. The browser sandbox creates a future manager under Allegretto as under Allegro Standard. evidence: E13. [proposed: this IR]

C73. `Allegro.eval` collects `console.log` output into the result's `output` list during the evaluation. evidence: E13. [proposed: this IR]

C74. `Allegro.eval` returns without waiting for pending futures. evidence: E13. [proposed: this IR]

C75. `Allegro.evalAsync` streams each `print` to the page's callback through the future manager's `onOutput` callback. evidence: E13, E16. [proposed: this IR]

C76. When futures are pending, `Allegro.evalAsync` resolves after `waitForAll`, with no result value. evidence: E13. [proposed: this IR]

C77. The browser sandbox resolves a `use NAME` directive only against a library that the page registered through `Allegro.registerLibrary`. evidence: E13. [proposed: this IR]

C78. A `use` directive naming an unregistered library fails with "Grammar library 'NAME' not registered". evidence: E13, E16. [proposed: this IR]

C79. `web/allegro-web.ts` holds its own `scanUses`, a second implementation beside the one in `src/use-scanner.ts`. evidence: E13. [proposed: this IR]

C80. The browser sandbox loads no module for an `import` statement, the web bundle holding no module loader. evidence: E13, E15. [proposed: this IR]

C81. In a run on 2026-11-02, the source `import math` followed by `math` returned `<symbol:math>` in the browser sandbox with no error. evidence: E16. [proposed: this IR]

C82. `Allegro.inspect` evaluates a source under Allegro Standard with its `print` output discarded, returning the summary that `summarizeModule` and `renderModuleSummary` build. evidence: E13, E16. [proposed: this IR]

### The pages and the deployed site [implemented]

C83. The pages register six of the sixteen libraries under `lib/`: `pow`, `match_expr`, `invariants`, `contracts`, `effects`, `units`. evidence: E17. [proposed: this IR]

C84. `scripts/sync-web-libs.ts` copies each registered library's source from `lib/` into a marked region of `website/index.html`, `website/sandbox.html` and `web/sandbox.html`. evidence: E17. [proposed: this IR]

C85. `npx tsx scripts/sync-web-libs.ts --check` compares the three regions with `lib/` without writing. evidence: E17. [proposed: this IR]

C86. In a run on 2026-11-02, the check failed: in all three pages, the copy of `lib/units.alg` differs from the file. evidence: E18. [proposed: this IR]

C87. `lib/units.alg` last changed in commit d73922c of 2026-10-26, after the three pages last changed in commit 2249aea of 2026-08-25. evidence: E18. [proposed: this IR]

C88. `web/sandbox.html` is the local sandbox page, loading the bundle from `dist/allegro.js` beside the page. evidence: E19. [proposed: this IR]

C89. `web/sandbox.html` runs the editor's source through `Allegro.evalAsync`. evidence: E19. [proposed: this IR]

C90. `web/sandbox.html` keeps named snippets in the browser's `localStorage`. evidence: E19. [proposed: this IR]

C91. `website/sandbox.html` differs from `web/sandbox.html` in two lines: a link to the documentation page; the bundle's path, `/allegro.js`. evidence: E19. [proposed: this IR]

C92. `website/index.html` runs each example through `Allegro.evalAsync`, resetting the session after each run. evidence: E20. [proposed: this IR]

C93. `website/index.html` offers an inspect action per example through `Allegro.inspect`. evidence: E20. [proposed: this IR]

C94. Deploys through `deploy.sh` are run by the owner only. [decided: CLAUDE.md, Session contract]

C95. `deploy.sh` builds the web bundle before stamping `website/version.json` with the commit, the branch, the deploy time and a dirty flag. evidence: E21. [proposed: this IR]

C96. `deploy.sh` syncs `website/` to the S3 bucket `allegrolang.org` with deletion, then copies `web/dist/allegro.js` to the bucket's `allegro.js`. evidence: E21. [proposed: this IR]

C97. `deploy.sh` ends with a CloudFront invalidation of every path. evidence: E21. [proposed: this IR]

C98. `deploy.sh` warns without stopping when the branch is not `main` or the working tree is dirty. evidence: E21. [proposed: this IR]

C99. `npm run check-deployed` compares the live `version.json` with `origin/main`, exiting with one of three codes: 0 when current; 1 when stale or mismatched; 2 when unverifiable. evidence: E22. [proposed: this IR]

C100. `npm run check-deployed` runs `git fetch origin main` before comparing. evidence: E22. [proposed: this IR]

C101. In a run on 2026-11-02, `npm run check-deployed` reported the live site at commit 95ae3a1 of `main`, deployed from a dirty tree on 2026-08-24, 372 commits behind `origin/main`. evidence: E23. [proposed: this IR]

### The browser-compatible core [partial]

C102. The project's session invariants require a browser-compatible core: `TextEncoder` and `TextDecoder`, never `Buffer`. [decided: CLAUDE.md, Conventions & invariants]

C103. `docs/book/process.md` §6 places the complete gotcha list in `CLAUDE.md`, a Tier 3 document. [decided: docs/book/process.md §1 and §6]

C104. No chapter of the book states the browser-compatible-core rule. evidence: E24. [proposed: this IR]

C105. The title of B-070 (browser runtime packaging) states that the core is browser-compatible. evidence: E25. [proposed: this IR]

C106. No file of `src/` or `web/` names `Buffer` outside one comment in `src/types.ts`. evidence: E8. [proposed: this IR]

C107. `src/types.ts` converts between strings and UTF-8 bytes through one `TextEncoder` and one `TextDecoder` for the process. evidence: E26. [proposed: this IR]

C108. `src/parser-helpers.ts` and the generated `src/parser.ts` each encode through a `TextEncoder`. evidence: E26. [proposed: this IR]

C109. `src/grammar2/engine.ts` and `src/evaluator.ts` test `typeof process` before reading `ALLEGRO_PARSE_STATS` or `ALLEGRO_EVAL_STATS`. evidence: E27. [proposed: this IR]

C110. Line 23 of `src/evaluator.ts` reads `process.env.ALLEGRO_TRACE_DEPTH` at module load without testing `typeof process`. evidence: E27. [proposed: this IR]

C111. Line 23 of `src/evaluator.ts` came in commit b25eac6 of 2026-10-27. evidence: E27. [proposed: this IR]

C112. In a run on 2026-11-02, the web bundle built from this branch threw `ReferenceError: process is not defined` at load, in a Node `vm` context with no `process` global. evidence: E16. [proposed: this IR]

C113. With a stub `process` global holding an empty `env`, the bundle built from this branch evaluated sources, streamed `print` output, resolved `delay` and resolved a stubbed `fetch`. evidence: E16. [proposed: this IR]

C114. A browser, which defines no `process` global, fails to load the web bundle built from this branch. [inferred: R1]

C115. Commit 95ae3a1, the live site's stamp, is an ancestor of commit b25eac6. evidence: E23, E27. [proposed: this IR]

C116. The live site's bundle predates the unguarded read in line 23 of `src/evaluator.ts`. [inferred: R2]

C117. A deploy from this branch would publish a web bundle that fails to load in a browser. [inferred: R3]

C118. No CI step, suite test or lint builds or loads the web bundle. evidence: E28, E29. [proposed: this IR]

C119. No CI step, suite test or lint runs `scripts/sync-web-libs.ts --check`. evidence: E28, E29. [proposed: this IR]

C120. `tsconfig.json` compiles `src/` against Node's type declarations, with no DOM library. evidence: E30. [proposed: this IR]

C121. The gate's typecheck accepts a read of the Node global `process` or `Buffer` anywhere in `src/`. [inferred: R4]

C122. `tsconfig.json` includes `src/` alone, leaving `web/allegro-web.ts` outside the gate's typecheck. evidence: E30. [proposed: this IR]

### What the T-host track has not built [partial]

C123. No primitive of `src/primitives.ts` reads a file, opens a socket, starts a process or reads an environment variable. evidence: E31. [proposed: this IR]

C124. Asynchronous I/O capabilities for files, processes and WebSockets are not built. [inferred: R5]

C125. B-071 (async I/O capabilities: filesystem, networking, process, WebSocket, timers) is the open backlog item that owns asynchronous I/O capabilities. evidence: E25. [proposed: this IR]

C126. The one browser artifact is `web/dist/allegro.js`, an IIFE bundle that sets a `window.Allegro` global. evidence: E10, E13. [proposed: this IR]

C127. `package.json` marks the package private, declaring `build:web` as its one build for the browser. evidence: E10. [proposed: this IR]

C128. Browser packaging is not built. [inferred: R6]

C129. B-070 (browser runtime packaging) is the open backlog item that owns browser packaging. evidence: E25. [proposed: this IR]

C130. Lane C of the backlog's lane table holds B-070 and B-071. evidence: E25. [proposed: this IR]

C131. No test of the suite performs a `fetch` request. evidence: E28. [proposed: this IR]

### Where the code is, and what pins it [implemented]

C132. `src/index.ts` holds the Node CLI's host code: the Node imports, the argument reads, the file reads, the exits. evidence: E9. [proposed: this IR]

C133. `web/allegro-web.ts` holds the browser sandbox's host code: the library registry, the output capture, the `window.Allegro` object. evidence: E13. [proposed: this IR]

C134. `src/futures.ts` holds the future manager. evidence: E7. [proposed: this IR]

C135. `src/primitives.ts` holds `print`, `delay` and `fetch`. evidence: E2. [proposed: this IR]

C136. `scripts/analyze/units.json` maps `src/futures.ts` to the `futures` unit, `src/primitives.ts` to seven units and `src/index.ts` to the `cli` unit. evidence: E32. [proposed: this IR]

C137. `scripts/analyze/units.json` maps no file of `web/`. evidence: E32. [proposed: this IR]

C138. `src/test/async-futures.ts` pins `delay`, the deferred `print`, the rejected Promise, the missing future manager and the liveness of `delay` and `fetch`. evidence: E33. [proposed: this IR]

C139. `src/test/tooling.ts` pins the verdict logic of `scripts/check-deployed.ts`, not the network fetch. evidence: E22. [proposed: this IR]

C140. No test of the suite loads the web bundle or calls a function of `web/allegro-web.ts`. evidence: E28. [proposed: this IR]

### Clusters

G1. cluster: C1, C2, C3, C4 [proposed: this IR]

G2. cluster: C5, C6, C7, C8 [proposed: this IR]

G3. cluster: C9, C10, C11, C12, C13 [proposed: this IR]

G4. cluster: C14, C15, C16, C17 [proposed: this IR]

G5. cluster: C18, C19, C20, C21 [proposed: this IR]

G6. cluster: C22, C23, C24 [proposed: this IR]

G7. cluster: C25, C26, C27, C28, C29, C30 [proposed: this IR]

G8. cluster: C31, C32, C33, C34, C35, C36 [proposed: this IR]

G9. cluster: C37, C38, C39, C40, C41, C42 [proposed: this IR]

G10. cluster: C43, C44, C45, C46, C47 [proposed: this IR]

G11. cluster: C48, C49, C50, C51, C52, C53, C54, C55, C56 [proposed: this IR]

G12. cluster: C57, C58, C59, C60, C61 [proposed: this IR]

G13. cluster: C62, C63, C64, C65, C66, C67, C68 [proposed: this IR]

G14. cluster: C69, C70, C71, C72, C73, C74, C75, C76 [proposed: this IR]

G15. cluster: C77, C78, C79, C80, C81, C82 [proposed: this IR]

G16. cluster: C83, C84, C85, C86, C87 [proposed: this IR]

G17. cluster: C88, C89, C90, C91, C92, C93 [proposed: this IR]

G18. cluster: C94, C95, C96, C97, C98, C99, C100, C101 [proposed: this IR]

G19. cluster: C102, C103, C104, C105 [proposed: this IR]

G20. cluster: C106, C107, C108, C109, C110, C111 [proposed: this IR]

G21. cluster: C112, C113, C114, C115, C116, C117 [proposed: this IR]

G22. cluster: C118, C119, C120, C121, C122 [proposed: this IR]

G23. cluster: C123, C124, C125, C126, C127, C128, C129, C130, C131 [proposed: this IR]

G24. cluster: C132, C133, C134, C135, C136, C137, C138, C139, C140 [proposed: this IR]

## Relations

R1. C114 depends-on C112 because a browser page, like the `vm` context of the run, defines no `process` global.

R2. C116 depends-on C115 because the live stamp's commit is older than commit b25eac6, which introduced line 23 (C111).

R3. C117 depends-on C114 because `deploy.sh` publishes the bundle that `npm run build:web` builds from the working tree (C95, C96).

R4. C121 depends-on C120 because Node's type declarations declare `process` and `Buffer` as globals.

R5. C124 depends-on C123 because `delay` and `fetch`, the only primitives that create a future cell from host I/O (C41), cover timers and HTTP GET alone.

R6. C128 depends-on C127 because, with no ES module build, npm package or versioned release, one IIFE bundle for the project's own pages is the only browser artifact (C126).

R7. C118 supports C117 because no gate check would stop a failing bundle before a deploy.

R8. C119 supports C86 because nothing in the gate reruns the registry check after `lib/units.alg` changes.

R9. C18 refines C20 because the T-host track's code is the environment of M10, not the host-plane state of §4.1 (C21).

R10. C104 depends-on C103 because the book leaves the gotcha list, the rule included (C102), to `CLAUDE.md`.

R11. C42 supports C23 because the two host environments share one implementation of each environment capability, differing only in the future manager and the output capture.

R12. C26 supports C24 because the future manager rides the host plane of the scope that B-136 reshapes.

R13. C59 depends-on C58 because, with no future manager, `delay` throws (C30).

## Evidence

E1. `docs/backlog.md` lines 3400–3417 (B-141: the hosts differ by capturing `print` output through `onOutput` and by substituting `Extension[]`, not by implementing a stated Environment interface; the effect label names the capability, nothing names the provider; `futureManager` planted on the root scope; When: with the T-host track, not before B-136).

E2. `src/primitives.ts` lines 4405–4408 (`print` registered with `["io"]`) and 4531–4533 (`delay` with `["time"]`, `fetch` with `["net"]`).

E3. `src/runtime.ts` lines 1175 (the `futureManager` parameter of `evalSource`) and 1528–1531 (the manager linked to the run's registry and evaluation scope, then set as the scope's `futureManager` property); `src/scope.ts` lines 263–270 (`scopeHostRead` walking the `parent` chain).

E4. `src/primitives.ts` lines 1102–1131 (`print_impl`: the residual on an unresolved value at 1105–1108, the deferral on a pending slot at 1114–1119, `scopeHostRead` at 1124, `onOutput` or else `console.log` at 1125–1129).

E5. `src/primitives.ts` lines 1143–1160 (`delay_wrapper`: `scopeHostRead` at 1149, the "requires async runtime" throw at 1150–1152, `setTimeout` resolving to Int 0 at 1153–1155, `createFuture` at 1159) and 1164–1189 (`fetch_impl`: `scopeHostRead` at 1170, the throw at 1171–1173, `globalThis.fetch(url)` at 1174, the `ok` test at 1176, the text body as a String at 1177–1179, the error value at 1180–1186, `createFuture` at 1188).

E6. `src/primitives.ts` lines 1891–1896 (`declareLiveness("delay", "live")`; `declareLiveness("fetch", "admitted", "the fetched endpoint eventually responds")`).

E7. `src/futures.ts` lines 14–32 (`FutureManager`: `onOutput`, `createFuture`, `hasPending`, `waitForAll`), 44–102 (`createFuture`: one pending cell put into the evaluation scope at 51–53, settled through `applyPhase` at 81–87, a rejection settled as an error value at 90–99) and 108–113 (`waitForAll`).

E8. Searches of this branch on 2026-11-02: `createFuture(` outside `src/test/` called only at `src/primitives.ts` lines 1159 and 1188; Node module imports in `src/`, `web/` and `pcp/` outside `src/test/` only in `src/index.ts`, `src/boundary-tests.ts` (`child_process`, `fs`, `path`), `src/grammar2/bench.ts` (`fs`) and `pcp/llm-worker.ts` (`fs`, `path`); the word `Buffer` in `src/` and `web/` only in the comment at `src/types.ts` line 480.

E9. `src/index.ts` lines 11–13 (`fs`, `path`, `readline`), 59 and 92–96 (`import.meta.url` to the system `lib/`), 63–72 and 99–106 (`fs.existsSync` over the local `lib/`, then the system `lib/`; `readFile` over `fs.readFileSync`), 117–119 (Allegretto: `evalSource` with no future manager), 127 (one future manager), 217–219 (the wait), 222–223 (`process.exit(1)`), 230–234 (`readline` over `process.stdin` and `process.stdout`), 242 (a future manager under Allegro Standard only), 283 (`process.argv`), 368, 384, 443 and 488 (`fs.readFileSync` with `utf-8`); no `onOutput` in the file.

E10. `package.json` lines 5 (`private`), 13 (`main`), 21 (`build:web`: esbuild, `--format=iife`, `--global-name=AllegroBundle`, `--platform=browser`, output `web/dist/allegro.js`), 22 (`start`); no `engines`, `bin`, `exports` or `files` key, no other script that builds for the browser.

E11. `src/modules.ts` lines 35–43 (`ModuleLoaderOptions`: `readFile`, `readFileSync`) and 251–258 (the constructor refusing a loader with neither).

E12. Runs on this branch on 2026-11-02 of `npx tsx src/index.ts` over a scratch file holding `d = delay(5)` and `print(d)`: with `--base`, "Error in …: delay: requires async runtime (no FutureManager available)" and exit 1; without, `0` and exit 0.

E13. `web/allegro-web.ts` lines 1–4 (the header: the browser entry point), 6–11 (imports from `src/` only), 13–23 (the type system, the kept scope and future manager, the library registry), 25–103 (its own `scanUses`), 107–125 (`loadGrammarLibrary`: an unregistered name throws at 109), 133–189 (`evalAllegro`: `console.log` captured at 135–137, a future manager under either mode at 140, Allegro Standard by default at 134 and 143, the scope kept at 179–180, no wait), 193–271 (`evalAllegroAsync`: a future manager at 201, `onOutput` at 202–205, `waitForAll` with no result at 254–267), 273–276 (`resetContext`), 283–338 (`inspectAllegro`: output suppressed, `summarizeModule`, `renderModuleSummary`), 341–348 (`window.Allegro`).

E14. `.gitignore` line 2 (`dist/`).

E15. A build on 2026-11-02 of `web/allegro-web.ts` with the `build:web` flags plus `--metafile`, output to a scratch directory: 29 inputs, 28 under `src/` with `web/allegro-web.ts`; absent, outside `src/test/`: `src/index.ts`, `src/modules.ts`, `src/pcp.ts`, `src/use-scanner.ts`, `src/grammar2/to-allegro.ts`, `src/boundary-tests.ts`, `src/grammar2/bench.ts`.

E16. Scratch scripts run on 2026-11-02 that loaded the E15 bundle in a Node `vm` context with a `window` object: with no `process` global, "ReferenceError: process is not defined" at load; with `process = { env: {} }`, `Allegro.eval` printed and kept `x` across calls, `Allegro.reset` dropped it, `use contracts` before registration failed with "Grammar library 'contracts' not registered", `import math` then `math` returned `<symbol:math>`, `Allegro.evalAsync` streamed the `delay` and stubbed `fetch` results, `Allegro.inspect` returned a summary.

E17. `scripts/sync-web-libs.ts` lines 18–21 (the six libraries, the three target pages, the region markers), 31–39 (the region generated from `lib/`), 57–71 (`--check` verifying without writing); `lib/` holds 16 `.alg` files.

E18. A run on 2026-11-02 of `npx tsx scripts/sync-web-libs.ts --check`: "website/index.html: lib 'units' drifted from lib/units.alg"; a scratch comparison of each region with `lib/`: `units` differs in all three pages, the other five match; `git log -1` of `lib/units.alg`: d73922c, 2026-10-26; of the three pages: 2249aea, 2026-08-25.

E19. `web/sandbox.html` lines 194 (`dist/allegro.js`), 201–643 (the library registry region), 925–936 (snippets in `localStorage`), 986–1014 (`runCode` through `Allegro.evalAsync`), 1016–1020 (`Allegro.reset`); `diff` with `website/sandbox.html`: an added link at line 155, `/allegro.js` at line 195.

E20. `website/index.html` lines 993 (`/allegro.js`), 995–1437 (the library registry region), 1439–1460 (`inspectSandbox` through `Allegro.inspect`), 1462–1505 (`runSandbox` through `Allegro.evalAsync`, `Allegro.reset` after each run).

E21. `deploy.sh` lines 10–11 (`npm run build:web`), 15–27 (the stamp: commit, branch, `deployedAt`, `dirty`), 28–30 (the warning), 33–34 (`aws s3 sync website/ … --delete`; `web/dist/allegro.js` copied to `allegro.js`), 37 (the CloudFront invalidation of `/*`).

E22. `scripts/check-deployed.ts` lines 1–12 (purpose, exit codes 0, 1 and 2), 113–142 (`main`: the fetch of `version.json`, `git fetch origin main --quiet` at 132); `src/test/tooling.ts` lines 345–400 (seven tests of `assessDeployment` and `parseStamp`, no network).

E23. A run on 2026-11-02 of `npm run check-deployed`: "live: 95ae3a1 (main, DIRTY) deployed 2026-08-24T19:33:13Z", "STALE: live is 372 commit(s) behind origin/main", the dirty-tree warning; `git merge-base --is-ancestor 95ae3a1 b25eac6` true.

E24. Search of `docs/book/` on 2026-11-02, before this chapter, for `Buffer`, `TextEncoder` and "browser-compatible", ignoring case: no statement of the rule; the only hits are the REPL's input buffer in `docs/book/platform/tooling.ir.md`.

E25. `docs/backlog.md` lines 79 (lane C: T-host, B-070 and B-071), 759–763 (the T-host list: B-070, "Browser runtime packaging (core is browser-compatible)"; B-071, "Async I/O capabilities: filesystem, networking, process, WebSocket, timers (env-provided, effect-labeled)"; both open).

E26. `src/types.ts` lines 476–482 (one `TextEncoder` and one `TextDecoder` for the process, "never `Buffer`"); `src/parser-helpers.ts` line 17; `src/parser.ts` line 1058.

E27. `src/grammar2/engine.ts` lines 168–175 (`parseStatsSwitchOn` testing `typeof process`); `src/evaluator.ts` lines 22 (`TRACE_DEPTH` testing `typeof process`), 23 (`TRACE_STEP` reading `process.env?.ALLEGRO_TRACE_DEPTH` untested), 116–122 (`evalStatsSwitchOn` testing `typeof process`), 164–166 (the exit hook testing `typeof process`); `git blame` of line 23: b25eac6, 2026-10-27, "B-151 D1".

E28. Search of `src/test/`, `scripts/` and `bench/` on 2026-11-02 for `build:web`, `esbuild`, `allegro-web`, `sync-web-libs` and a `fetch(` call in an Allegro source: no hit outside `scripts/sync-web-libs.ts` itself; the one `web/` path in `src/test/tooling.ts` (line 266) is a lane-lint fixture.

E29. `.github/workflows/ci.yml` lines 33–61 (Node 22; `npm ci`, the lane check, the IR lint, the typecheck, `npm run test:shards`; no bundle build, no `sync-web-libs`).

E30. `tsconfig.json` lines 5–6 (`lib: ["ES2022"]`, `types: ["node"]`) and 15 (`include: ["src/**/*"]`); `scripts/typecheck.sh` (the gate's typecheck over that configuration).

E31. Search of `src/primitives.ts` on 2026-11-02 for file, socket, process, environment-variable and clock access: `setTimeout` at line 1154 and `globalThis.fetch` at line 1174 the only host calls.

E32. `scripts/analyze/units.json` lines 17–18 (the `futures` and `base-primitives` units), 41 (the `cli` unit), 52–54 (`src/futures.ts`; `src/primitives.ts` mapped to seven units), 77 (`src/index.ts`); no key under `web/`.

E33. `src/test/async-futures.ts` lines 26, 36, 45 (`delay` pending, resolving, the deferred `print` with `onOutput`), 95 (a rejected Promise as an error value), 223–247 (modules with the session's manager; no manager, "requires async runtime"), 249–256 (the liveness of `delay` and `fetch`).

## Asks

A1. Ratify in bulk the proposed claims, every claim about the code as implemented and the four about the chapter's own terms, reader, examples and scope: C3, C4, C7, C8, C22, C23, C24, C25, C26, C27, C28, C29, C30, C31, C32, C33, C34, C35, C36, C37, C38, C39, C40, C41, C42, C43, C44, C45, C46, C47, C48, C49, C50, C51, C52, C53, C54, C55, C56, C57, C58, C59, C60, C61, C62, C63, C64, C65, C66, C67, C68, C69, C70, C71, C72, C73, C74, C75, C76, C77, C78, C79, C80, C81, C82, C83, C84, C85, C86, C87, C88, C89, C90, C91, C92, C93, C95, C96, C97, C98, C99, C100, C101, C104, C105, C106, C107, C108, C109, C110, C111, C112, C113, C115, C118, C119, C120, C122, C123, C125, C126, C127, C129, C130, C131, C132, C133, C134, C135, C136, C137, C138, C139, C140. Depends: C3, C4, C7, C8, C22, C23, C24, C25, C26, C27, C28, C29, C30, C31, C32, C33, C34, C35, C36, C37, C38, C39, C40, C41, C42, C43, C44, C45, C46, C47, C48, C49, C50, C51, C52, C53, C54, C55, C56, C57, C58, C59, C60, C61, C62, C63, C64, C65, C66, C67, C68, C69, C70, C71, C72, C73, C74, C75, C76, C77, C78, C79, C80, C81, C82, C83, C84, C85, C86, C87, C88, C89, C90, C91, C92, C93, C95, C96, C97, C98, C99, C100, C101, C104, C105, C106, C107, C108, C109, C110, C111, C112, C113, C115, C118, C119, C120, C122, C123, C125, C126, C127, C129, C130, C131, C132, C133, C134, C135, C136, C137, C138, C139, C140.

A2. No term is proposed: every term this chapter uses, environment capability and ENV included, links to a definition site in an earlier chapter. Depends: C3.
