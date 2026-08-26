#!/usr/bin/env node
// Parallel landing gate: run the suite as N sharded processes and apply
// the gate to the AGGREGATE (suite-performance pass).
//
// Why processes rather than workers: the suite leans on module-level
// state (channel registry, the divergence probe/cutoff, type-system
// singletons), so isolation per shard is the property we want, and it is
// free — each shard is an ordinary `tsx src/test.ts` run.
//
// Shard assignment is by test-name hash (see ALLEGRO_TEST_SHARD in
// src/test.ts). Everything distributes, including the `.alg` corpus
// files; whole-shard self-checks whose subject is that shard's own work
// run in every shard instead (`everyShard`), so the union of the shards
// covers what the single-process run covers.
//
// Two gate conditions can only be evaluated where the TOTAL is known,
// so this script owns them: the suite-count floor, and the `.alg`
// corpus-coverage tripwire (>= 15 files walked). Both are asserted here
// over the aggregate, not softened per shard.
//
// Usage:  node scripts/test-shards.mjs [shardCount]
//         ALLEGRO_TEST_SHARDS=6 node scripts/test-shards.mjs
// Default shard count: min(4, cpus - 1), at least 2.

import { spawn } from "node:child_process";
import { cpus } from "node:os";
import { readFileSync } from "node:fs";

const requested = Number(process.argv[2] ?? process.env.ALLEGRO_TEST_SHARDS ?? 0);
const SHARDS = requested > 0 ? requested : Math.max(2, Math.min(4, cpus().length - 1));

function runShard(index) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn("npx", ["tsx", "src/test.ts"], {
      env: { ...process.env, ALLEGRO_TEST_SHARD: `${index}/${SHARDS}` },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { out += d; });   // TRACE goes to stderr
    child.on("close", (code) => {
      resolve({ index, code, out, seconds: (Date.now() - started) / 1000 });
    });
  });
}

const results = await Promise.all(
  Array.from({ length: SHARDS }, (_, i) => runShard(i)),
);

let ran = 0, passed = 0, failed = 0, everyShardRuns = 0, corpusWalked = 0;
const registeredSeen = new Set();
const failureLines = [];
let missingResult = false;
let corpusReports = 0;

for (const r of results) {
  const m = /^SHARD-RESULT (\d+)\/(\d+) ran=(\d+) passed=(\d+) failed=(\d+) registered=(\d+) skipped=(\d+) everyShard=(\d+)$/m.exec(r.out);
  if (!m) {
    missingResult = true;
    console.error(`\n=== shard ${r.index} produced no SHARD-RESULT line (exit ${r.code}) ===`);
    console.error(r.out.split("\n").slice(-25).join("\n"));
    continue;
  }
  ran += Number(m[3]); passed += Number(m[4]); failed += Number(m[5]);
  registeredSeen.add(Number(m[6]));
  everyShardRuns += Number(m[8]);
  for (const line of r.out.split("\n")) {
    const c = /^SHARD-CORPUS walked=(\d+)$/.exec(line);
    if (c) { corpusWalked += Number(c[1]); corpusReports++; }
  }
  for (const line of r.out.split("\n")) {
    if (line.startsWith("FAIL:")) failureLines.push(`  [shard ${r.index}] ${line}`);
  }
  console.log(`shard ${r.index}/${SHARDS}: ${m[3]} tests, ${m[5]} failed, ${r.seconds.toFixed(1)}s (exit ${r.code})`);
}

const wall = Math.max(...results.map((r) => r.seconds));
const serial = results.reduce((a, r) => a + r.seconds, 0);
// every-shard tests run once PER shard by design; the suite's own test
// count is the aggregate minus those repeats.
const uniqueRan = ran - Math.max(0, everyShardRuns - everyShardRuns / SHARDS);
console.log(`\n${"=".repeat(50)}`);
console.log(`Aggregate: ${ran} test runs, ${passed} passed, ${failed} failed`);
console.log(`Suite coverage: ${Math.round(uniqueRan)} distinct tests (${everyShardRuns} runs of whole-shard checks repeated across ${SHARDS} shards)`);
console.log(`Wall clock: ${wall.toFixed(1)}s across ${SHARDS} shards (${serial.toFixed(1)}s of work)`);
if (failureLines.length) console.log(failureLines.join("\n"));

let gateFailed = failed > 0 || missingResult || results.some((r) => r.code !== 0);

// The shards must agree on how many tests the suite REGISTERS; a
// mismatch means they did not run the same suite, so the aggregate count
// would be meaningless.
if (registeredSeen.size > 1) {
  console.error(`shards disagree on registered test count: ${[...registeredSeen].join(", ")}`);
  gateFailed = true;
}

// The suite-count floor is suspended inside a shard (no shard sees the
// whole suite), so it is applied here, to the total — the same
// mass-disablement tripwire the sequential gate has.
const floor = JSON.parse(
  readFileSync(new URL("../src/boundary-baseline.json", import.meta.url), "utf-8"),
).suiteFloor ?? 0;
if (floor && uniqueRan < floor) {
  console.error(`suite shrank: ${Math.round(uniqueRan)} tests < committed floor ${floor} (src/boundary-baseline.json)`);
  gateFailed = true;
}

// The `.alg` corpus-coverage tripwire. In a single-process run the
// boundary suite asserts this itself; sharded, no one process sees the
// total, so it is asserted here over the union. Same threshold.
const CORPUS_MIN = 15;
if (corpusReports === 0) {
  console.error(`no shard reported a corpus walk — the .alg file tests did not run`);
  gateFailed = true;
} else if (corpusWalked < CORPUS_MIN) {
  console.error(`corpus coverage: ${corpusWalked} .alg files walked across ${corpusReports} shards, need >= ${CORPUS_MIN}`);
  gateFailed = true;
} else {
  console.log(`Corpus coverage: ${corpusWalked} .alg files walked across ${corpusReports} shards (>= ${CORPUS_MIN})`);
}

console.log(gateFailed ? "GATE: FAILED" : "GATE: PASSED");
process.exit(gateFailed ? 1 : 0);
