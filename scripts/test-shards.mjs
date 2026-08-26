#!/usr/bin/env node
// Parallel landing gate: run the suite as N sharded processes and apply
// the gate to the AGGREGATE (suite-performance pass).
//
// Why processes rather than workers: the suite leans on module-level
// state (channel registry, the divergence probe/cutoff, type-system
// singletons), so isolation per shard is the property we want, and it is
// free — each shard is an ordinary `tsx src/test.ts` run.
//
// Shard assignment is round-robin over registration index (see
// ALLEGRO_TEST_SHARD in src/test.ts). The `.alg` corpus file tests and
// the boundary section are pinned to shard 0, which keeps the boundary
// suite's corpus-coverage assertion intact rather than weakening it.
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

let ran = 0, passed = 0, failed = 0;
const registeredSeen = new Set();
const failureLines = [];
let missingResult = false;

for (const r of results) {
  const m = /^SHARD-RESULT (\d+)\/(\d+) ran=(\d+) passed=(\d+) failed=(\d+) registered=(\d+) skipped=(\d+)$/m.exec(r.out);
  if (!m) {
    missingResult = true;
    console.error(`\n=== shard ${r.index} produced no SHARD-RESULT line (exit ${r.code}) ===`);
    console.error(r.out.split("\n").slice(-25).join("\n"));
    continue;
  }
  ran += Number(m[3]); passed += Number(m[4]); failed += Number(m[5]);
  registeredSeen.add(Number(m[6]));
  for (const line of r.out.split("\n")) {
    if (line.startsWith("FAIL:")) failureLines.push(`  [shard ${r.index}] ${line}`);
  }
  console.log(`shard ${r.index}/${SHARDS}: ${m[3]} tests, ${m[5]} failed, ${r.seconds.toFixed(1)}s (exit ${r.code})`);
}

const wall = Math.max(...results.map((r) => r.seconds));
const serial = results.reduce((a, r) => a + r.seconds, 0);
console.log(`\n${"=".repeat(50)}`);
console.log(`Aggregate: ${ran} tests, ${passed} passed, ${failed} failed`);
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
if (floor && ran < floor) {
  console.error(`suite shrank: ${ran} tests < committed floor ${floor} (src/boundary-baseline.json)`);
  gateFailed = true;
}

console.log(gateFailed ? "GATE: FAILED" : "GATE: PASSED");
process.exit(gateFailed ? 1 : 0);
