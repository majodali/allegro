// =============================================================================
// Allegro — the test suite.
// Run: npx tsx src/test/index.ts   (npm test, or npm run test:shards for CI)
//
// This file is the INDEX. It holds no tests: each area registers its own when
// its module is imported, the async sections run in order after that, and the
// summary closes the run. The suite's shape is the import list below.
//
// Shard assignment is by test NAME (see harness.ts), so it does not depend on
// this order, on which module a test lives in, or on when that module loads.
// The order here is suite order — the sequence the single-file suite ran in —
// kept so a run reads the same way it always did.
// =============================================================================

import { test, eq, timedSection, noteSyncBodyDone, reportSummary, SHARD } from "./harness.js";
import { corpusWalk } from "./alg-files.js";
import { runBoundaryTests } from "../boundary-tests.js";

// --- Areas (register at import) ----------------------------------------------

import "./base.js";                // Allegretto: arithmetic … extensions
import "./modules.js";             // the module loader
import "./grammar-legacy.js";      // Earley combinators, JSON parser
import "./types-core.js";          // Standard core types + the .alg corpus
import "./types-battery.js";       // generics, annotations, the kind tower
import "./types-construction.js";  // unions, matching, define/where/distinct
import "./equality-laws.js";       // E1–E4 + D2 ledger + D47 source channel
import "./language.js";            // guards, offside, reactivity, pipes
import "./refinements.js";         // domains, predicate sets, contracts
import "./effects.js";             // the D1 slices
import "./totality.js";            // exhaustiveness + termination
import "./proofs.js";              // F1–F7, tactics, provable, units
import "./pcp.js";                 // H1–H4 + introspection
import "./grammar2-engine.js";     // formalism, engine, analyzer
import "./grammar2-language.js";   // grammar blocks, Allegro through grammar2
import "./async-futures.js";       // B-028 F1–F4
import "./tooling.js";             // benchmark, doc-ref lint, check-deployed

// --- Async sections ----------------------------------------------------------
//
// These register inside an async function rather than at import, so the index
// drives them explicitly and `timedSection` can attribute their cost.

import { runModuleTests } from "./modules.js";
import { runAsyncTests } from "./async-futures.js";
import { runH4aAsyncTests } from "./pcp.js";
import { runBenchmarkTests, runDocLintTests, runCheckDeployedTests } from "./tooling.js";

// --- Run and report ----------------------------------------------------------

noteSyncBodyDone("sync body (evaluator/types/grammar/.alg files)");
timedSection("modules", runModuleTests)
  .then(() => timedSection("async/futures", runAsyncTests))
  .then(() => timedSection("h4a-llm-worker", runH4aAsyncTests))
  .then(() => timedSection("benchmark", runBenchmarkTests))
  .then(() => timedSection("doc-lint", async () => runDocLintTests()))
  .then(() => timedSection("check-deployed", async () => runCheckDeployedTests()))
  .then(() => timedSection("boundary", async () => runBoundaryTests({
    test,
    eq,
    // Each shard reports the corpus IT walked; the registry-completeness
    // check runs in every shard over its own files, and the aggregate
    // coverage tripwire is applied by scripts/test-shards.mjs.
    corpus: { ...corpusWalk(), sharded: SHARD !== null },
  })))
  .then(() => reportSummary());
