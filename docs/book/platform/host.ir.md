# IR: Host environments

Reader: RD-4
Purpose: document. The book's chapter on the T-host track: the Node CLI and the browser sandbox as host environments, the environment capabilities they supply, the browser-compatible core, and the environment-capability contract of `docs/book/allegretto/structures.md` §11, with asynchronous I/O capabilities and browser packaging stated as not built.
Status: delivered IR-only (ratified at the merge of PR #142, 2026-11-02; unratified terms 0; footprint: declared 6, changed 6, surprises 0, misses 0; claims C86–C87 and C110–C119 re-stated 2026-11-07 after PR #166 (ruling R33 of `docs/plans/book-pass.md`), with C83, C101 and C140, which PR #166 and its deploy also left stale, and C81; C87, C111 and C117 cut, clusters G16, G20, G21 re-formed; proposed until ratified, ask A3)
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

C3. This chapter defines no term: each term it uses links from this chapter's Terms section to a definition site in an earlier chapter. [decided: owner, 2026-11-02]

C4. The reader of this chapter has read the Part I chapters and the Part II chapters before this chapter, the tooling chapter included. [decided: owner, 2026-11-02]

C5. This chapter carries the Tier 1 authority that `docs/book/process.md` §1 gives every chapter of the book. [decided: docs/book/process.md §1]

C6. Each Claims sub-heading of this chapter carries the status tag that `docs/book/README.md` defines. [decided: docs/book/README.md, Status convention]

C7. This chapter holds no examples. [decided: owner, 2026-11-02]

C8. The tooling chapter, `docs/book/platform/tooling.ir.md`, describes the file runner, the REPL and the subcommands of `src/index.ts`, which this chapter treats only as host code. [decided: owner, 2026-11-02]

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

C22. B-141 (there is no Environment interface) is the open backlog item that owns the provider side of the environment-capability contract. evidence: E1. [decided: owner, 2026-11-02]

C23. B-141 records that the Node CLI and the browser sandbox differ by capturing `print` output and by substituting extensions, not by implementing a stated interface. evidence: E1. [decided: owner, 2026-11-02]

C24. B-141 waits for B-136 (scope leaves `Value`), because the future manager is planted on the scope. evidence: E1. [decided: owner, 2026-11-02]

### The environment capabilities as implemented [implemented]

C25. `src/primitives.ts` registers `print` with the effect label `io`, `delay` with `time` and `fetch` with `net`. evidence: E2. [decided: owner, 2026-11-02]

C26. `evalSource` plants the run's future manager as a host-plane property of the evaluation scope. evidence: E3. [decided: owner, 2026-11-02]

C27. `print`, `delay` and `fetch` find the future manager through `scopeHostRead`, which walks the scope's parent chain. evidence: E3, E4, E5. [decided: owner, 2026-11-02]

C28. `print` returns a residual while the printed value or a slot of the printed value is pending. evidence: E4. [decided: owner, 2026-11-02]

C29. `print` hands the formatted value to the future manager's `onOutput` callback when one is set, else to `console.log`. evidence: E4. [decided: owner, 2026-11-02]

C30. `delay` and `fetch` each throw "requires async runtime" when the scope chain holds no future manager. evidence: E5. [decided: owner, 2026-11-02]

C31. `delay(ms)` returns a future cell that a JavaScript `setTimeout` timer fills with the Int 0 after `ms` milliseconds. evidence: E5. [decided: owner, 2026-11-02]

C32. `fetch(url)` returns a future cell that `globalThis.fetch` fills with the response body as a String. evidence: E5. [decided: owner, 2026-11-02]

C33. A failed request or a response status outside 200 to 299 fills the `fetch` cell with an error value instead of throwing. evidence: E5. [decided: owner, 2026-11-02]

C34. `fetch` passes only the URL to `globalThis.fetch`, which therefore sends a GET request with no body. evidence: E5. [decided: owner, 2026-11-02]

C35. `src/primitives.ts` declares the liveness of `delay` as live, a timer always firing. evidence: E6. [decided: owner, 2026-11-02]

C36. `src/primitives.ts` declares the liveness of `fetch` at the `admitted` discharge tier, with the assumption that the fetched endpoint eventually responds. evidence: E6. [decided: owner, 2026-11-02]

C37. `createFuture` in `src/futures.ts` adds one pending future cell to the evaluation scope for each JavaScript Promise it receives. evidence: E7. [decided: owner, 2026-11-02]

C38. A settled Promise fills its future cell through `applyPhase`, which re-evaluates what residualised on the cell. evidence: E7. [decided: owner, 2026-11-02]

C39. A rejected Promise fills its future cell with an error value, never a throw. evidence: E7. [decided: owner, 2026-11-02]

C40. `waitForAll` returns a Promise that resolves once the future manager has no pending future. evidence: E7. [decided: owner, 2026-11-02]

C41. Outside the suite, `delay` and `fetch` are the only callers of `createFuture`. evidence: E8. [decided: owner, 2026-11-02]

C42. Neither host environment replaces `print`, `delay` or `fetch`: both run the implementations in `src/primitives.ts`. evidence: E9, E15. [decided: owner, 2026-11-02]

### The Node CLI [implemented]

C43. `src/index.ts` is the Node CLI, run through `tsx` as `npx tsx src/index.ts` or as `npm start`. evidence: E10. [decided: owner, 2026-11-02]

C44. `package.json` names no Node version: the file has no `engines` field. evidence: E10. [decided: owner, 2026-11-02]

C45. CI runs the gate on Node 22. evidence: E29. [decided: owner, 2026-11-02]

C46. `src/index.ts` imports three Node modules: `fs`, `path`, `readline`. evidence: E9. [decided: owner, 2026-11-02]

C47. Outside `src/test/`, two more files of `src/` import a Node module: `src/boundary-tests.ts` and `src/grammar2/bench.ts`. evidence: E8. [decided: owner, 2026-11-02]

C48. The Node CLI reads each source file with `fs.readFileSync` as UTF-8. evidence: E9. [decided: owner, 2026-11-02]

C49. The Node CLI finds the `lib/` directory beside `src/` from `import.meta.url`. evidence: E9. [decided: owner, 2026-11-02]

C50. The Node CLI resolves a module name with `fs.existsSync`, trying the `lib/` directory beside the source file before the `lib/` directory beside `src/`. evidence: E9. [decided: owner, 2026-11-02]

C51. `ModuleLoader` in `src/modules.ts` reads no file itself: its caller supplies a `readFile` or `readFileSync` function. evidence: E11. [decided: owner, 2026-11-02]

C52. The Node CLI supplies `ModuleLoader` with a `readFile` function over `fs.readFileSync`. evidence: E9. [decided: owner, 2026-11-02]

C53. The REPL reads lines from `process.stdin` through `readline`, prompting on `process.stdout`. evidence: E9. [decided: owner, 2026-11-02]

C54. The Node CLI takes its arguments from `process.argv`. evidence: E9. [decided: owner, 2026-11-02]

C55. The Node CLI ends a failed run through `process.exit` with code 1. evidence: E9. [decided: owner, 2026-11-02]

C56. The Node CLI sets no `onOutput` callback, leaving `print` to write through `console.log` to stdout. evidence: E4, E9. [decided: owner, 2026-11-02]

C57. Under Allegro Standard, the file runner and the REPL each create one future manager. evidence: E9. [decided: owner, 2026-11-02]

C58. Under Allegretto, the file runner and the REPL create no future manager. evidence: E9. [decided: owner, 2026-11-02]

C59. In a run on 2026-11-02, the file runner under Allegretto stopped on a file calling `delay(5)` with exit code 1 and the message "delay: requires async runtime (no FutureManager available)". evidence: E12. [decided: owner, 2026-11-02]

C60. In a run on 2026-11-02, the file runner under Allegro Standard printed 0 for that file, exiting with code 0. evidence: E12. [decided: owner, 2026-11-02]

C61. The file runner waits for every pending future of its future manager before the run ends. evidence: E9. [decided: owner, 2026-11-02]

### The browser sandbox [implemented]

C62. `web/allegro-web.ts` is the entry of the web bundle. evidence: E13. [decided: owner, 2026-11-02]

C63. `npm run build:web` bundles `web/allegro-web.ts` with esbuild into `web/dist/allegro.js`, an IIFE for the browser platform. evidence: E10. [decided: owner, 2026-11-02]

C64. The web bundle is a build output: `.gitignore` excludes every `dist/` directory. evidence: E14. [decided: owner, 2026-11-02]

C65. In a build on 2026-11-02, the web bundle held 28 files of `src/` with `web/allegro-web.ts`. evidence: E15. [decided: owner, 2026-11-02]

C66. The web bundle leaves out seven files of `src/` outside `src/test/`: `src/index.ts`, `src/modules.ts`, `src/pcp.ts`, `src/use-scanner.ts`, `src/grammar2/to-allegro.ts`, `src/boundary-tests.ts`, `src/grammar2/bench.ts`. evidence: E15. [decided: owner, 2026-11-02]

C67. `web/allegro-web.ts` imports no Node module. evidence: E13. [decided: owner, 2026-11-02]

C68. The web bundle sets `window.Allegro` to an object of six functions: `eval`, `evalAsync`, `reset`, `formatValue`, `registerLibrary`, `inspect`. evidence: E13. [decided: owner, 2026-11-02]

C69. `Allegro.eval` and `Allegro.evalAsync` evaluate under Allegro Standard by default, with the type system as the base extension. evidence: E13. [decided: owner, 2026-11-02]

C70. `Allegro.eval` and `Allegro.evalAsync` keep the evaluation scope from one call to the next. evidence: E13, E16. [decided: owner, 2026-11-02]

C71. `Allegro.reset` drops the kept evaluation scope with the future manager. evidence: E13, E16. [decided: owner, 2026-11-02]

C72. The browser sandbox creates a future manager under Allegretto as under Allegro Standard. evidence: E13. [decided: owner, 2026-11-02]

C73. `Allegro.eval` collects `console.log` output into the result's `output` list during the evaluation. evidence: E13. [decided: owner, 2026-11-02]

C74. `Allegro.eval` returns without waiting for pending futures. evidence: E13. [decided: owner, 2026-11-02]

C75. `Allegro.evalAsync` streams each `print` to the page's callback through the future manager's `onOutput` callback. evidence: E13, E16. [decided: owner, 2026-11-02]

C76. When futures are pending, `Allegro.evalAsync` resolves after `waitForAll`, with no result value. evidence: E13. [decided: owner, 2026-11-02]

C77. The browser sandbox resolves a `use NAME` directive only against a library that the page registered through `Allegro.registerLibrary`. evidence: E13. [decided: owner, 2026-11-02]

C78. A `use` directive naming an unregistered library fails with "Grammar library 'NAME' not registered". evidence: E13, E16. [decided: owner, 2026-11-02]

C79. `web/allegro-web.ts` holds its own `scanUses`, a second implementation beside the one in `src/use-scanner.ts`. evidence: E13. [decided: owner, 2026-11-02]

C80. The browser sandbox loads no module for an `import` statement, the web bundle holding no module loader. evidence: E13, E15. [decided: owner, 2026-11-02]

C81. The source `import math` followed by `math` returns `<symbol:math>` in the browser sandbox with no error. evidence: E16. [proposed: this IR]

C82. `Allegro.inspect` evaluates a source under Allegro Standard with its `print` output discarded, returning the summary that `summarizeModule` and `renderModuleSummary` build. evidence: E13, E16. [decided: owner, 2026-11-02]

### The pages and the deployed site [implemented]

C83. The pages register eight of the sixteen libraries under `lib/`: `pow`, `match_expr`, `invariants`, `contracts`, `effects`, `units`, `totality`, `planning`. evidence: E17. [proposed: this IR]

C84. `scripts/sync-web-libs.ts` copies each registered library's source from `lib/` into a marked region of `website/index.html`, `website/sandbox.html` and `web/sandbox.html`. evidence: E17. [decided: owner, 2026-11-02]

C85. `npx tsx scripts/sync-web-libs.ts --check` compares the three regions with `lib/` without writing. evidence: E17. [decided: owner, 2026-11-02]

C86. `npx tsx scripts/sync-web-libs.ts --check` passes: in each of the three pages, the copy of each registered library matches its file under `lib/`. evidence: E18. [proposed: this IR]

C88. `web/sandbox.html` is the local sandbox page, loading the bundle from `dist/allegro.js` beside the page. evidence: E19. [decided: owner, 2026-11-02]

C89. `web/sandbox.html` runs the editor's source through `Allegro.evalAsync`. evidence: E19. [decided: owner, 2026-11-02]

C90. `web/sandbox.html` keeps named snippets in the browser's `localStorage`. evidence: E19. [decided: owner, 2026-11-02]

C91. `website/sandbox.html` differs from `web/sandbox.html` in two lines: a link to the documentation page; the bundle's path, `/allegro.js`. evidence: E19. [decided: owner, 2026-11-02]

C92. `website/index.html` runs each example through `Allegro.evalAsync`, resetting the session after each run. evidence: E20. [decided: owner, 2026-11-02]

C93. `website/index.html` offers an inspect action per example through `Allegro.inspect`. evidence: E20. [decided: owner, 2026-11-02]

C94. Deploys through `deploy.sh` are run by the owner only. [decided: CLAUDE.md, Session contract]

C95. `deploy.sh` builds the web bundle before stamping `website/version.json` with the commit, the branch, the deploy time and a dirty flag. evidence: E21. [decided: owner, 2026-11-02]

C96. `deploy.sh` syncs `website/` to the S3 bucket `allegrolang.org` with deletion, then copies `web/dist/allegro.js` to the bucket's `allegro.js`. evidence: E21. [decided: owner, 2026-11-02]

C97. `deploy.sh` ends with a CloudFront invalidation of every path. evidence: E21. [decided: owner, 2026-11-02]

C98. `deploy.sh` warns without stopping when the branch is not `main` or the working tree is dirty. evidence: E21. [decided: owner, 2026-11-02]

C99. `npm run check-deployed` compares the live `version.json` with `origin/main`, exiting with one of three codes: 0 when current; 1 when stale or mismatched; 2 when unverifiable. evidence: E22. [decided: owner, 2026-11-02]

C100. `npm run check-deployed` runs `git fetch origin main` before comparing. evidence: E22. [decided: owner, 2026-11-02]

C101. `npm run check-deployed` reports the live site at commit 52a34d2 of `main`, deployed from a clean tree on 2026-11-06, and stale against `origin/main`. evidence: E23. [proposed: this IR]

### The browser-compatible core [partial]

C102. The project's session invariants require a browser-compatible core: `TextEncoder` and `TextDecoder`, never `Buffer`. [decided: CLAUDE.md, Conventions & invariants]

C103. `docs/book/process.md` §6 places the complete gotcha list in `CLAUDE.md`, a Tier 3 document. [decided: docs/book/process.md §1 and §6]

C104. No chapter of the book states the browser-compatible-core rule. evidence: E24. [decided: owner, 2026-11-02]

C105. The title of B-070 (browser runtime packaging) states that the core is browser-compatible. evidence: E25. [decided: owner, 2026-11-02]

C106. No file of `src/` or `web/` names `Buffer` outside one comment in `src/types.ts`. evidence: E8. [decided: owner, 2026-11-02]

C107. `src/types.ts` converts between strings and UTF-8 bytes through one `TextEncoder` and one `TextDecoder` for the process. evidence: E26. [decided: owner, 2026-11-02]

C108. `src/parser-helpers.ts` and the generated `src/parser.ts` each encode through a `TextEncoder`. evidence: E26. [decided: owner, 2026-11-02]

C109. `src/grammar2/engine.ts` and `src/evaluator.ts` test `typeof process` before reading `ALLEGRO_PARSE_STATS` or `ALLEGRO_EVAL_STATS`. evidence: E27. [decided: owner, 2026-11-02]

C110. Line 23 of `src/evaluator.ts` reads `ALLEGRO_TRACE_DEPTH` only when `typeof process` is not `"undefined"`, as line 22 does. evidence: E27. [proposed: this IR]

C112. The web bundle built from this branch loads in a Node `vm` context whose global holds no `process` and no `Buffer`. evidence: E16. [proposed: this IR]

C113. Loaded in that `vm` context, the web bundle evaluates sources, streams `print` output, resolves `delay` and resolves a stubbed `fetch`. evidence: E16. [proposed: this IR]

C114. A browser, which defines no `process` global, loads the web bundle built from this branch. [inferred: R1]

C115. Commit 52a34d2, the live site's stamp, holds line 23 of `src/evaluator.ts` as C110 states it. evidence: E23, E27. [proposed: this IR]

C116. The live site's `allegro.js` tests `typeof process` before reading `ALLEGRO_TRACE_DEPTH`, and loads in a Node `vm` context with no `process` global. evidence: E23. [proposed: this IR]

C118. The suite builds the web bundle with the options of `build:web` and loads it in a Node `vm` context with no `process` or `Buffer` global. evidence: E28, E29. [proposed: this IR]

C119. The suite runs `npx tsx scripts/sync-web-libs.ts --check` as a test that fails when the check exits non-zero. evidence: E28, E29. [proposed: this IR]

C120. `tsconfig.json` compiles `src/` against Node's type declarations, with no DOM library. evidence: E30. [decided: owner, 2026-11-02]

C121. The gate's typecheck accepts a read of the Node global `process` or `Buffer` anywhere in `src/`. [inferred: R4]

C122. `tsconfig.json` includes `src/` alone, leaving `web/allegro-web.ts` outside the gate's typecheck. evidence: E30. [decided: owner, 2026-11-02]

### What the T-host track has not built [partial]

C123. No primitive of `src/primitives.ts` reads a file, opens a socket, starts a process or reads an environment variable. evidence: E31. [decided: owner, 2026-11-02]

C124. Asynchronous I/O capabilities for files, processes and WebSockets are not built. [inferred: R5]

C125. B-071 (async I/O capabilities: filesystem, networking, process, WebSocket, timers) is the open backlog item that owns asynchronous I/O capabilities. evidence: E25. [decided: owner, 2026-11-02]

C126. The one browser artifact is `web/dist/allegro.js`, an IIFE bundle that sets a `window.Allegro` global. evidence: E10, E13. [decided: owner, 2026-11-02]

C127. `package.json` marks the package private, declaring `build:web` as its one build for the browser. evidence: E10. [decided: owner, 2026-11-02]

C128. Browser packaging is not built. [inferred: R6]

C129. B-070 (browser runtime packaging) is the open backlog item that owns browser packaging. evidence: E25. [decided: owner, 2026-11-02]

C130. Lane C of the backlog's lane table holds B-070 and B-071. evidence: E25. [decided: owner, 2026-11-02]

C131. No test of the suite performs a `fetch` request. evidence: E28. [decided: owner, 2026-11-02]

### Where the code is, and what pins it [implemented]

C132. `src/index.ts` holds the Node CLI's host code: the Node imports, the argument reads, the file reads, the exits. evidence: E9. [decided: owner, 2026-11-02]

C133. `web/allegro-web.ts` holds the browser sandbox's host code: the library registry, the output capture, the `window.Allegro` object. evidence: E13. [decided: owner, 2026-11-02]

C134. `src/futures.ts` holds the future manager. evidence: E7. [decided: owner, 2026-11-02]

C135. `src/primitives.ts` holds `print`, `delay` and `fetch`. evidence: E2. [decided: owner, 2026-11-02]

C136. `scripts/analyze/units.json` maps `src/futures.ts` to the `futures` unit, `src/primitives.ts` to seven units and `src/index.ts` to the `cli` unit. evidence: E32. [decided: owner, 2026-11-02]

C137. `scripts/analyze/units.json` maps no file of `web/`. evidence: E32. [decided: owner, 2026-11-02]

C138. `src/test/async-futures.ts` pins `delay`, the deferred `print`, the rejected Promise, the missing future manager and the liveness of `delay` and `fetch`. evidence: E33. [decided: owner, 2026-11-02]

C139. `src/test/tooling.ts` pins the verdict logic of `scripts/check-deployed.ts`, not the network fetch. evidence: E22. [decided: owner, 2026-11-02]

C140. Two tests of `src/test/tooling.ts` load the web bundle and call `registerLibrary` and `evalAllegro` of `web/allegro-web.ts` through its `AllegroBundle` global. evidence: E28. [proposed: this IR]

### Clusters

G1. cluster: C1, C2, C3, C4 [decided: owner, 2026-11-02]

G2. cluster: C5, C6, C7, C8 [decided: owner, 2026-11-02]

G3. cluster: C9, C10, C11, C12, C13 [decided: owner, 2026-11-02]

G4. cluster: C14, C15, C16, C17 [decided: owner, 2026-11-02]

G5. cluster: C18, C19, C20, C21 [decided: owner, 2026-11-02]

G6. cluster: C22, C23, C24 [decided: owner, 2026-11-02]

G7. cluster: C25, C26, C27, C28, C29, C30 [decided: owner, 2026-11-02]

G8. cluster: C31, C32, C33, C34, C35, C36 [decided: owner, 2026-11-02]

G9. cluster: C37, C38, C39, C40, C41, C42 [decided: owner, 2026-11-02]

G10. cluster: C43, C44, C45, C46, C47 [decided: owner, 2026-11-02]

G11. cluster: C48, C49, C50, C51, C52, C53, C54, C55, C56 [decided: owner, 2026-11-02]

G12. cluster: C57, C58, C59, C60, C61 [decided: owner, 2026-11-02]

G13. cluster: C62, C63, C64, C65, C66, C67, C68 [decided: owner, 2026-11-02]

G14. cluster: C69, C70, C71, C72, C73, C74, C75, C76 [decided: owner, 2026-11-02]

G15. cluster: C77, C78, C79, C80, C81, C82 [decided: owner, 2026-11-02]

G16. cluster: C83, C84, C85, C86 [proposed: this IR]

G17. cluster: C88, C89, C90, C91, C92, C93 [decided: owner, 2026-11-02]

G18. cluster: C94, C95, C96, C97, C98, C99, C100, C101 [decided: owner, 2026-11-02]

G19. cluster: C102, C103, C104, C105 [decided: owner, 2026-11-02]

G20. cluster: C106, C107, C108, C109, C110 [proposed: this IR]

G21. cluster: C112, C113, C114, C115, C116 [proposed: this IR]

G22. cluster: C118, C119, C120, C121, C122 [decided: owner, 2026-11-02]

G23. cluster: C123, C124, C125, C126, C127, C128, C129, C130, C131 [decided: owner, 2026-11-02]

G24. cluster: C132, C133, C134, C135, C136, C137, C138, C139, C140 [decided: owner, 2026-11-02]

## Relations

R1. C114 depends-on C112 because a browser page, like the `vm` context of C112, defines no `process` or `Buffer` global.

R2. C116 supports C115 because the live bundle's text carries the guarded read of line 23 that the stamped commit holds.

R4. C121 depends-on C120 because Node's type declarations declare `process` and `Buffer` as globals.

R5. C124 depends-on C123 because `delay` and `fetch`, the only primitives that create a future cell from host I/O (C41), cover timers and HTTP GET alone.

R6. C128 depends-on C127 because, with no ES module build, npm package or versioned release, one IIFE bundle for the project's own pages is the only browser artifact (C126).

R7. C118 supports C114 because the gate builds and loads the bundle on every run, so a bundle that fails to load without a `process` global fails the gate.

R8. C119 supports C86 because the gate reruns the registry check on every run, so a change under `lib/` that leaves a page's copy behind fails the gate.

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

E13. `web/allegro-web.ts` lines 1–4 (the header: the browser entry point), 6–11 (imports from `src/` only), 13–23 (the type system, the kept scope and future manager, the library registry), 25–103 (its own `scanUses`), 105–155 (`loadGrammarLibrary`: an unregistered name throws at 120; a library's own `use` header resolved through the same registry at 125–136), 164–220 (`evalAllegro`: `console.log` captured at 166–167, a future manager under either mode at 170, Allegro Standard by default at 164 and 173, the scope kept at 210–211, no wait), 224–303 (`evalAllegroAsync`: a future manager at 232, `onOutput` at 233–236, `waitForAll` with no result at 296–299), 305–308 (`resetContext`), 315–371 (`inspectAllegro`: output suppressed, `summarizeModule`, `renderModuleSummary`), 376 (the `AllegroBundle` exports), 379–386 (`window.Allegro`); read 2026-11-07.

E14. `.gitignore` line 2 (`dist/`).

E15. A build on 2026-11-02 of `web/allegro-web.ts` with the `build:web` flags plus `--metafile`, output to a scratch directory: 29 inputs, 28 under `src/` with `web/allegro-web.ts`; absent, outside `src/test/`: `src/index.ts`, `src/modules.ts`, `src/pcp.ts`, `src/use-scanner.ts`, `src/grammar2/to-allegro.ts`, `src/boundary-tests.ts`, `src/grammar2/bench.ts`.

E16. A scratch script run on 2026-11-07 that built `web/allegro-web.ts` with the `build:web` flags and loaded it in a Node `vm` context whose global held `window`, `console`, `TextEncoder`, `TextDecoder`, the timers and a stubbed `fetch`, with no `process` or `Buffer`: the bundle loaded; `Allegro.eval` printed 41, then 42 from the kept `x`; after `Allegro.reset`, `x` was unbound; `use contracts` before registration failed with "Grammar library 'contracts' not registered (use Allegro.registerLibrary first)"; `import math` then `math` returned `<symbol:math>`; `Allegro.evalAsync` streamed the stubbed `fetch` body and the `delay` result 0, resolving with no result value; `Allegro.inspect` returned a summary.

E17. `scripts/sync-web-libs.ts` lines 18–21 (the eight libraries, the three target pages, the region markers), 31–39 (the region generated from `lib/`), 41–58 (`verifyRegion`: each library's literal decoded and compared with its file), 60–74 (`--check` verifying without writing); `lib/` holds 16 `.alg` files; read 2026-11-07.

E18. A run on 2026-11-07 of `npx tsx scripts/sync-web-libs.ts --check`: "verified: website/index.html", "verified: website/sandbox.html", "verified: web/sandbox.html", exit 0.

E19. `web/sandbox.html` lines 194 (`dist/allegro.js`), 201–643 (the library registry region), 925–936 (snippets in `localStorage`), 986–1014 (`runCode` through `Allegro.evalAsync`), 1016–1020 (`Allegro.reset`); `diff` with `website/sandbox.html`: an added link at line 155, `/allegro.js` at line 195.

E20. `website/index.html` lines 993 (`/allegro.js`), 995–1437 (the library registry region), 1439–1460 (`inspectSandbox` through `Allegro.inspect`), 1462–1505 (`runSandbox` through `Allegro.evalAsync`, `Allegro.reset` after each run).

E21. `deploy.sh` lines 10–11 (`npm run build:web`), 15–27 (the stamp: commit, branch, `deployedAt`, `dirty`), 28–30 (the warning), 33–34 (`aws s3 sync website/ … --delete`; `web/dist/allegro.js` copied to `allegro.js`), 37 (the CloudFront invalidation of `/*`).

E22. `scripts/check-deployed.ts` lines 1–12 (purpose, exit codes 0, 1 and 2), 113–142 (`main`: the fetch of `version.json`, `git fetch origin main --quiet` at 132); `src/test/tooling.ts` lines 507–565 (seven tests of `assessDeployment` and `parseStamp`, no network).

E23. A run on 2026-11-07 of `npm run check-deployed`: "live: 52a34d2 (main) deployed 2026-11-06T22:56:53Z", "STALE: live is 11 commit(s) behind origin/main", no dirty-tree warning; the live `version.json` read the same day: `"dirty": false`; the live `allegro.js` fetched the same day: `TRACE_STEP` computed under `typeof process !== "undefined"`, and the E16 script loaded it with no `process` global and evaluated; `git show 52a34d2:src/evaluator.ts`: line 23 guarded.

E24. Search of `docs/book/` on 2026-11-02, before this chapter, for `Buffer`, `TextEncoder` and "browser-compatible", ignoring case: no statement of the rule; the only hits are the REPL's input buffer in `docs/book/platform/tooling.ir.md`.

E25. `docs/backlog.md` lines 79 (lane C: T-host, B-070 and B-071), 759–763 (the T-host list: B-070, "Browser runtime packaging (core is browser-compatible)"; B-071, "Async I/O capabilities: filesystem, networking, process, WebSocket, timers (env-provided, effect-labeled)"; both open).

E26. `src/types.ts` lines 476–482 (one `TextEncoder` and one `TextDecoder` for the process, "never `Buffer`"); `src/parser-helpers.ts` line 17; `src/parser.ts` line 1058.

E27. `src/grammar2/engine.ts` lines 168–175 (`parseStatsSwitchOn` testing `typeof process`); `src/evaluator.ts` lines 22 (`TRACE_DEPTH` testing `typeof process`), 23 (`TRACE_STEP` reading `process.env?.ALLEGRO_TRACE_DEPTH` only under the same test), 116–122 (`evalStatsSwitchOn` testing `typeof process`), 164–166 (the exit hook testing `typeof process`); read 2026-11-07.

E28. `src/test/tooling.ts` lines 344–395 (the bundle built in memory with the `build:web` options at 356–370, loaded at 379–395 in a `node:vm` context with no `process` or `Buffer`), 399–413 (the bundle loaded and `use contracts` run through `registerLibrary` and `evalAllegro`), 416–427 (the test running `npx tsx scripts/sync-web-libs.ts --check`, failing on a non-zero exit), 433–456 (the pages' registry loading `planning` in the bundle), 458–470 (the pinned planning example); `src/test/index.ts` line 62 (the `web-bundle` section); a run on 2026-11-07 of `ALLEGRO_TEST_FILTER="web " npm test`: 4 tests, 4 passed; a search the same day of `src/test/`, `tests/`, `lib/`, `scripts/` and `bench/` for a `fetch(` call in an Allegro source: no hit.

E29. `.github/workflows/ci.yml` lines 33–61 (Node 22; `npm ci`, the lane check, the IR lint, the typecheck, `npm run test:shards`, which runs the suite's web-bundle tests; no step of its own for the bundle); read 2026-11-07.

E30. `tsconfig.json` lines 5–6 (`lib: ["ES2022"]`, `types: ["node"]`) and 15 (`include: ["src/**/*"]`); `scripts/typecheck.sh` (the gate's typecheck over that configuration).

E31. Search of `src/primitives.ts` on 2026-11-02 for file, socket, process, environment-variable and clock access: `setTimeout` at line 1154 and `globalThis.fetch` at line 1174 the only host calls.

E32. `scripts/analyze/units.json` lines 17–18 (the `futures` and `base-primitives` units), 41 (the `cli` unit), 52–54 (`src/futures.ts`; `src/primitives.ts` mapped to seven units), 77 (`src/index.ts`); no key under `web/`.

E33. `src/test/async-futures.ts` lines 26, 36, 45 (`delay` pending, resolving, the deferred `print` with `onOutput`), 95 (a rejected Promise as an error value), 223–247 (modules with the session's manager; no manager, "requires async runtime"), 249–256 (the liveness of `delay` and `fetch`).

## Asks

A1. Ratify in bulk the proposed claims, every claim about the code as implemented and the four about the chapter's own terms, reader, examples and scope: C3, C4, C7, C8, C22, C23, C24, C25, C26, C27, C28, C29, C30, C31, C32, C33, C34, C35, C36, C37, C38, C39, C40, C41, C42, C43, C44, C45, C46, C47, C48, C49, C50, C51, C52, C53, C54, C55, C56, C57, C58, C59, C60, C61, C62, C63, C64, C65, C66, C67, C68, C69, C70, C71, C72, C73, C74, C75, C76, C77, C78, C79, C80, C81, C82, C83, C84, C85, C86, C88, C89, C90, C91, C92, C93, C95, C96, C97, C98, C99, C100, C101, C104, C105, C106, C107, C108, C109, C110, C112, C113, C115, C118, C119, C120, C122, C123, C125, C126, C127, C129, C130, C131, C132, C133, C134, C135, C136, C137, C138, C139, C140. Depends: C3, C4, C7, C8, C22, C23, C24, C25, C26, C27, C28, C29, C30, C31, C32, C33, C34, C35, C36, C37, C38, C39, C40, C41, C42, C43, C44, C45, C46, C47, C48, C49, C50, C51, C52, C53, C54, C55, C56, C57, C58, C59, C60, C61, C62, C63, C64, C65, C66, C67, C68, C69, C70, C71, C72, C73, C74, C75, C76, C77, C78, C79, C80, C81, C82, C83, C84, C85, C86, C88, C89, C90, C91, C92, C93, C95, C96, C97, C98, C99, C100, C101, C104, C105, C106, C107, C108, C109, C110, C112, C113, C115, C118, C119, C120, C122, C123, C125, C126, C127, C129, C130, C131, C132, C133, C134, C135, C136, C137, C138, C139, C140.

A1 resolved: ratified by the owner at the merge of PR #142, 2026-11-02; the statuses are flipped.

A2. No term is proposed: every term this chapter uses, environment capability and ENV included, links to a definition site in an earlier chapter. Depends: C3.

A2 resolved: confirmed at the merge of PR #142, 2026-11-02; no term is proposed.

A3. Ratify in bulk the claims re-stated as current state after PR #166 (ruling R33 of `docs/plans/book-pass.md`), with their re-formed clusters G16, G20 and G21: C81, C83, C86, C101, C110, C112, C113, C115, C116, C118, C119, C140. C114 is inferred through R1. C87, C111 and C117 are cut. Depends: C81, C83, C86, C101, C110, C112, C113, C115, C116, C118, C119, C140.
