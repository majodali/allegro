// =============================================================================
// Allegro Grammar 2 — Parser performance benchmark runner
//
// Usage: npx tsx src/grammar2/bench.ts
//
// Runs the parser on a range of inputs, collects ParseStats, and prints
// a report. Intended for finding performance bottlenecks, not for CI —
// results depend on machine and don't need to be deterministic.
// =============================================================================

import * as fs from "fs";
import { parse, ParseStats } from "./engine.js";
import { getBaseGrammar } from "./base-grammar.js";

interface BenchmarkCase {
  name:     string;
  source:   string;
  /** Optional: expected approximate parse time order-of-magnitude in ms. */
  expect?:  string;
}

const cases: BenchmarkCase[] = [
  { name: "trivial literal",          source: "42" },
  { name: "simple expression",        source: "1 + 2 * 3" },
  { name: "deeper expression",        source: "((a + b) * (c + d)) / (e * f)" },
  { name: "function call",            source: "f(1, 2, 3)" },
  { name: "typed binding",            source: "x: Int = 42" },
  { name: "lambda",                   source: "f = x => x + 1" },
  { name: "when/is/then inline",      source: 'when x is 1 then "one" else "other"' },
  { name: "if/then/else",             source: "if cond then a else b" },
];

const files: string[] = [
  "basics.alg",
  "tests/dot-access.alg",
  "tests/logical.alg",
  "tests/objects.alg",
  "tests/arrays.alg",
  "tests/pattern-match.alg",
  "tests/interfaces.alg",
  "tests/refinements.alg",
  "tests/mixins.alg",
  "lib/grammar-analyzer.alg",
];

function runOne(name: string, src: string): void {
  const result = parse(getBaseGrammar(), src.replace(/\r\n/g, "\n"), { stats: true });
  const s = result.stats!;
  const size = src.length;
  const charsPerMs = size / Math.max(s.durationMs, 0.001);
  console.log(`\n=== ${name} (${size} chars) ===`);
  console.log(`  status:                ${result.ok ? "ok" : "FAIL: " + (result as any).error?.message?.slice(0, 80)}`);
  console.log(`  duration:              ${s.durationMs}ms  (${charsPerMs.toFixed(1)} chars/ms)`);
  console.log(`  matchRule calls:       ${s.matchRuleCalls}`);
  console.log(`  memo hits / misses:    ${s.memoHits} / ${s.memoMisses}  (${(s.memoHits / (s.memoHits + s.memoMisses) * 100).toFixed(1)}% hit rate)`);
  console.log(`  LR seed returns:       ${s.lrSeedReturns}`);
  console.log(`  LR iterations:         ${s.lrIterations}`);
  console.log(`  invalidation rounds:   ${s.invalidationRounds}`);
  console.log(`  invalidations total:   ${s.invalidationCount}  (avg ${s.invalidationRounds ? (s.invalidationCount / s.invalidationRounds).toFixed(1) : 0} per round)`);
  console.log(`  peak memo size:        ${s.peakMemoSize}`);
  console.log(`  final memo size:       ${s.finalMemoSize}`);
  // Top 5 most-called nonterminals
  const byName = [...s.callsByNonTerm.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (byName.length > 0) {
    console.log(`  top nonterm calls:`);
    for (const [name, n] of byName) console.log(`    ${name}: ${n}`);
  }
  // Top 3 LR-iterating nonterminals
  const lrTop = [...s.lrIterationsByName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (lrTop.length > 0) {
    console.log(`  top LR iterators:`);
    for (const [name, n] of lrTop) console.log(`    ${name}: ${n}`);
  }
}

function runAll(): void {
  console.log("=".repeat(60));
  console.log("Grammar 2 parser benchmark");
  console.log("=".repeat(60));

  console.log("\n--- Single-line inputs ---");
  for (const c of cases) {
    runOne(c.name, c.source);
  }

  console.log("\n\n--- File-sized inputs ---");
  for (const f of files) {
    try {
      const src = fs.readFileSync(f, "utf-8");
      runOne(f, src);
    } catch (e: any) {
      console.log(`\n=== ${f} === (skipped: ${e.message})`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Scaling test: repeated 'a + ' chains");
  console.log("=".repeat(60));
  for (const n of [10, 40, 160, 640, 2560]) {
    const src = Array.from({ length: n }, (_, i) => `a${i}`).join(" + ");
    runOne(`${n}-op add chain`, src);
  }
}

runAll();
