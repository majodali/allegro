# Implementation map — where the code lives

> Tier 1, sibling of `layers.md`: the file-level projection of the
> layer spine. One row per source file — path, layer/track tag
> (vocabulary: `layers.md`), one-line role. Created at the K-002 slim
> (B-095 chunk 3), replacing the bootstrap's per-file inventory.
> Update when files are added/renamed (PROCESS §5 landing checklist —
> design docs). Missing here = missing from review.

## src/ — the interpreter

| File | Layer | Role |
|---|---|---|
| `src/types.ts` | L0 | Value types + constructors, Extension interface, string/float↔bits; `withMetadata`/`makeStructure` construction shims (the W4 boundary) |
| `src/structure.ts` | L0 | The unified Structure class behind records/carriers/scopes — one hidden class, role fixed at construction, D22 immutable bit |
| `src/scope.ts` | L0 | Scope protocol: chain layering (O(1) extend), lookup, facts plane, future cells, flatten |
| `src/slots.ts` | L0 | Slot & channel registry (D39 table as code) + typed accessors; sanctioned direct-access site |
| `src/symbols.ts` | L0 | Symbol interning (FQN identity, D20/D29), kernel scope, base-name projection |
| `src/evaluator.ts` | L0 | Recursive evaluator: PE Rules 1+2, propagation table, type-directed dispatch (`PRIM_TO_METHOD`), TCO, closures, unification at call sites |
| `src/primitives.ts` | L0/L2 | All primitives: bits/expression/structure ops, type system ops, proof constructors + `proof_check`, grammar combinators, lazy print |
| `src/runtime.ts` | L0/L1 | `evalSource` pipeline (below), symbol resolution, precompile, `CompilationReport` + notifications |
| `src/refinements.ts` | L2 | Abstract domains + predicate sets: `domainFromPredicate`, lattice ops, propagation, `knowledgeOf` |
| `src/effects.ts` | L2 | EffectSet ops, effects-as-component storage (`withEffects`/`effectsOf`) |
| `src/totality.ts` | L2 | Exhaustiveness + termination analysis (SCC/Tarjan, `decreases`, HOF edges), body-form metadata readers |
| `src/proofs.ts` | L2 | Proof value checks (`checkProofs`, discharged/failed shapes, findings) |
| `src/proven.ts` | L2 | `proven` clause verification (bounded sampling, `pickSamples`) |
| `src/pcp.ts` | L2 | Proof Collaboration Protocol schemas (Obligation/Verdict/Authorship), verify/obligations builders, hints, TODO renderer |
| `src/introspect.ts` | L2 | `ValueSummary`/`ModuleSummary`/`SafetyGrade` for `allegro inspect` + sandbox Inspect |
| `src/types-std.ts` | L2 | The standard type system: ten core types, kind tower (Type/Refinement/Interface/Effect/Proof), generics, laws, coercions |
| `src/modules.ts` | L1/L2 | ModuleLoader + `buildModuleObject` (see `extension/modules.md`) |
| `src/use-scanner.ts` | L1 | `use` header pre-scan shared by file runner + lib loader |
| `src/futures.ts` | L0 | FutureManager: Promise → pending future cell → `applyPhase` cascade |
| `src/index.ts` | T-build | CLI entry: file runner, REPL, `inspect`/`verify`/`obligations`/`propose`/`prove` subcommands |
| `src/test/` | T-tooling | The suite (1197 tests at 2026-08) — per-area modules behind a thin index; roster below |
| `src/boundary-tests.ts` | T-tooling | Boundary instruments: accessor lint ratchet, invariant walks, forgery suite A–F, perf floor |
| `src/parser.ts` | L1 (legacy) | Generated Earley parser — retained for standalone `grammar_*` DSLs only; `@ts-nocheck` stays |
| `src/parser-helpers.ts` | L1 | Shared value-construction helpers for tree builders |
| `src/grammar-ext.ts` | L1 (legacy) | GrammarBuilder + handle registry for the Earley combinator primitives |

## src/test/ — the suite (one module per area, thin index)

Split out of a single 12,281-line `src/test.ts` (2026-08) that 88% of
source commits touched — the file two work streams could not avoid
meeting in. `index.ts` registers nothing: each area module registers at
import, and the index drives the async sections and the summary.

| File | Role |
|---|---|
| `index.ts` | The index: area imports in suite order, async section chain, summary |
| `harness.ts` | `test`/`asyncTest`/`eq`/`throws`, name-hash sharding (`ALLEGRO_TEST_SHARD`), `ALLEGRO_TEST_FILTER`, `ALLEGRO_TEST_TRACE`, timing, the summary + `SHARD-RESULT` line |
| `fixtures.ts` | `evalSource`/`evalStr`/`evalNum`/`evalNumExt`/`evalStd`, `typeExt`, `mathExtension`, `makeCtxWith` |
| `alg-files.ts` | `runAlgFile`/`fileTest`, the corpus walk accumulators feeding the boundary battery, `testsDir`/`primNames`/`typeNames` |
| `base.ts` | Allegretto: arithmetic, bindings, functions, closures, blocks, extensions |
| `modules.ts` | Module loader: resolution, caching, cycles, export encapsulation |
| `grammar-legacy.ts` | Earley combinator layer + standalone JSON parser |
| `types-core.ts` | Standard core types, the `.alg` corpus registrations, export visibility |
| `types-battery.ts` | Generics, annotations, inference, the kind tower, interfaces |
| `types-construction.ts` | Unions, destructuring, matching, `define`/`where`/`distinct`, `preserveOps` |
| `equality-laws.ts` | E1–E4 equality/coercions/laws, D2 ledger, D47 source channel |
| `language.ts` | Guards, offside rule, reactive forward chaining, pipes, combinators |
| `refinements.ts` | Abstract domains, predicate sets, lifecycle invariants, contracts |
| `effects.ts` | The D1 slices: bounds, HOF inference, effect variables, components |
| `totality.ts` | Exhaustiveness, termination, `decreases`, SCC, counterexamples |
| `proofs.ts` | F1–F7, tactic library, provable stdlib, rung demos, units DSL |
| `pcp.ts` | Proof Collaboration Protocol H1–H4 + introspection |
| `grammar2-engine.ts` | Grammar 2 formalism, scannerless engine, analyzer |
| `grammar2-language.ts` | Grammar blocks, rule surgery, Allegro through grammar2 |
| `async-futures.ts` | B-028 F1–F4: the forward-chaining async surface |
| `tooling.ts` | PCP benchmark, doc-ref lint, `check-deployed` verdict logic |

Two conditions can only be judged where the whole-suite total is known,
so `scripts/test-shards.mjs` owns them at the same thresholds: the
suite-count floor (`src/boundary-baseline.json` `suiteFloor`, held AT the
suite size) and the `>= 15` corpus-coverage tripwire. It also cross-checks
that every shard registered the same suite (`registered=`) — the check
that catches a silently shrinking suite, since a uniformly smaller one
passes every other gate.

## src/grammar2/ — the Allegro parser (scannerless, per `grammar-formalism.md`)

| File | Role |
|---|---|
| `types.ts` | Rule union, Grammar/Production, deltas, constructor helpers |
| `engine.ts` | Recursive scannerless parser: memoization, left recursion, indent terminals, farthest-advance errors |
| `base-grammar.ts` | The Allegro grammar as a value (stratified precedence LEVELS) |
| `tree-builder.ts` | ParseTree → Value trees; body-form marker extraction (`buildBlockExpr`) |
| `fragments.ts` | `use`-time fragment merging, level insertion, user-op registry |
| `analyzer.ts` | Static grammar checks (reachability, nullability, left recursion, …) |
| `builder.ts` | `grammar2_*` runtime primitives for standalone grammars |
| `to-allegro.ts` | TS Grammar → Allegro value bridge (Phase 5 analyzer port) |
| `bench.ts` | Parser micro-bench |

## Out-of-rootDir trees (run via tsx, validated by the suite, NOT compiled by tsc — TS6059 sanctioned, `scripts/typecheck.sh`)

| Path | Role |
|---|---|
| `bench/` | H-arc benchmark corpus + harness (`npm run bench`) |
| `pcp/llm-worker.ts` | `allegro prove` LLM worker (Anthropic SDK; pure helpers tested SDK-free) |
| `scripts/` | `typecheck.sh` (sanctioned typecheck), `doc-ref-lint.ts`, `sync-web-libs.ts`, `check-deployed.ts` (B-096 live-site audit) |

## Everything else

| Path | Role |
|---|---|
| `lib/` | Standard library + grammar/body-form modules (roster: `extension/modules.md`) |
| `tests/*.alg` | Literate demos, suite-validated via `// expect:` comments |
| `demos/rung1`, `demos/rung2` | Release-ladder demo packages (suite-registered) |
| `grammar/` | Grammar fixture corpus |
| `web/`, `website/` | Web-bundled interpreter + allegrolang.org site (lib registry regions generated by `sync-web-libs.ts`) |
| `previews/` | Scratch previews (not suite-registered) |

## The evalSource pipeline

Stage order (in `src/runtime.ts`): `parse` (grammar2, with `use`
pre-scan + fragment merge) → `typeLiterals` (raw Bits → Int/String
wrapping) → `resolveSymbols` (lexical scoping) → `markTailCalls` →
`collapseBodyMetadata` + `precompileFunctions` (PE of function bodies:
type + effect inference; `CompilationReport`) → `buildEvalCtx` (scope
chain: primitives ← extensions ← base ← source) → evaluation loop
(forward-chaining on future cells). Post-passes:
`checkEffectsDeclarations`, `checkExhaustiveness`, `checkTermination`,
the proof-finding loop, `checkProvenClauses` — each can halt
compilation ("build safety in"); notifications carry
kind + severity.

## Async runtime surface

No `await` keyword — async is implicit through forward-chaining:
async primitives (`delay(ms)`, `fetch(url)` — HTTP GET resolving to a
String body, errors as error values, Node 18+/browser via
`globalThis.fetch`) create pending future cells (`__future_N`) the
evaluator treats as unresolved symbols, producing residuals; Promise
resolution cascades re-evaluation via `applyPhase`. `print` defers on
unresolved args; bare expressions with futures are tracked via
synthetic `__bare_N` bindings. Web sandboxes use `evalAllegroAsync`
with streaming output. (Design: `structures.md` §10, D33; a fuller
`allegretto/architecture.md` remains planned.)
