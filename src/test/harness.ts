// =============================================================================
// Suite harness — registration, sharding, the dev filter, timing, the summary.
//
// Extracted from the single-file suite (C1 of the suite split). Every area
// module under src/test/ imports `test`/`asyncTest`/`eq`/`throws` from here,
// so the counters, the shard assignment and the registration count are ONE
// module's state no matter how many modules register into them — which is
// what lets `scripts/test-shards.mjs` keep cross-checking that every shard
// saw the same suite.
// =============================================================================

import { getSuiteFloor } from "../boundary-tests.js";

let passed = 0;
let failed = 0;
const failures: string[] = [];

// Per-test timing — the summary prints the slowest tests so suite-cost
// optimization stays evidence-based (see the "suite verification cost"
// discussion, 2026-07).
const testTimes: { name: string; ms: number }[] = [];
const sectionTimes: { name: string; ms: number }[] = [];
const suiteT0 = performance.now();

// Dev-tier filter (two-tier verification discipline, 2026-07): set
// ALLEGRO_TEST_FILTER to a regex to run only matching tests during
// iteration. Filtered runs are DEV runs — the suite floor and full-gate
// semantics are suspended, and the summary says so. Landings always use
// the full unfiltered suite.
export const TEST_FILTER = process.env.ALLEGRO_TEST_FILTER
  ? new RegExp(process.env.ALLEGRO_TEST_FILTER)
  : null;
let filteredOut = 0;

// Sharding (suite-performance pass): ALLEGRO_TEST_SHARD="i/n" runs only
// the tests this shard owns, so N processes cover the suite between them.
//
// Assignment is by a hash of the test NAME, deliberately not by
// registration index. An index-based scheme requires every shard to
// register exactly the same tests in the same order, which a single
// conditional registration silently breaks: the counters drift, the
// shards disagree about who owns what, and tests vanish from the union
// with nothing failing. (That is not hypothetical — it is what the first
// version of this did, losing 93 tests.) A name hash is order-free, so
// conditional registration cannot desynchronize anything, and it
// scatters the clustered slow tests across shards.
//
// The name hash is also what makes the suite SPLITTABLE: because
// assignment never depends on registration order, moving a test between
// modules — or changing the order modules are imported in — cannot move it
// between shards.
//
// A shard is NOT a landing gate on its own; `scripts/test-shards.mjs`
// aggregates the shards and applies the gate to the total.
export const SHARD = (() => {
  const raw = process.env.ALLEGRO_TEST_SHARD;
  if (!raw) return null;
  const m = /^(\d+)\/(\d+)$/.exec(raw.trim());
  if (!m) throw new Error(`ALLEGRO_TEST_SHARD must look like "0/4", got "${raw}"`);
  const index = Number(m[1]), count = Number(m[2]);
  if (count < 1 || index < 0 || index >= count) {
    throw new Error(`ALLEGRO_TEST_SHARD out of range: "${raw}"`);
  }
  return { index, count };
})();
let registeredCount = 0;
let shardedOut = 0;
let everyShardCount = 0;

/** FNV-1a over the test name — a stable, order-free shard assignment. */
function hashName(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Per-test shard options.
 *  - default: the name hash picks one owning shard.
 *  - `everyShard`: run in ALL shards. For whole-shard self-checks whose
 *    subject is that shard's own work (the corpus walk), where running in
 *    a single shard would leave the other shards' work unchecked. */
export interface ShardOpts { everyShard?: boolean }

/** Does this test belong to the running shard? Every shard calls this for
 *  every registered test, so `registeredCount` is suite-wide and the
 *  aggregator can verify the shards saw the same suite. */
function inShard(name: string, opts?: ShardOpts): boolean {
  registeredCount++;
  if (opts?.everyShard) { everyShardCount++; return true; }
  if (SHARD === null) return true;
  const mine = (hashName(name) % SHARD.count) === SHARD.index;
  if (!mine) shardedOut++;
  return mine;
}

export function test(name: string, fn: () => void, opts?: ShardOpts): void {
  const mine = inShard(name, opts);
  if (TEST_FILTER && !TEST_FILTER.test(name)) { filteredOut++; return; }
  if (!mine) return;
  if (process.env.ALLEGRO_TEST_TRACE) console.error("TEST:", name);
  const t0 = performance.now();
  try {
    fn();
    passed++;
  } catch (e: any) {
    failed++;
    const msg = `FAIL: ${name} — ${e.message}`;
    failures.push(msg);
    console.log(msg);
  }
  if (process.env.ALLEGRO_TEST_TRACE) console.error("DONE:", name);
  testTimes.push({ name, ms: performance.now() - t0 });
}

export async function asyncTest(name: string, fn: () => Promise<void>): Promise<void> {
  // Async tests honor the name filter and the shard exactly like sync
  // ones. Before the suite-performance pass they honored NEITHER, so a
  // "filtered" dev run still paid for the entire async block — which is
  // what made short timeouts look like hangs.
  const mine = inShard(name);
  if (TEST_FILTER && !TEST_FILTER.test(name)) { filteredOut++; return; }
  if (!mine) return;
  if (process.env.ALLEGRO_TEST_TRACE) console.error("ATEST:", name);
  try {
    await fn();
    passed++;
  } catch (e: any) {
    failed++;
    const msg = `FAIL: ${name} — ${e.message}`;
    failures.push(msg);
    console.log(msg);
  }
}

export async function timedSection<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  const r = await fn();
  sectionTimes.push({ name, ms: performance.now() - t0 });
  return r;
}

/** Close out the sync registration phase. The area modules register at
 *  import time, so this is called once the index has imported them all. */
export function noteSyncBodyDone(name: string): void {
  sectionTimes.push({ name, ms: performance.now() - suiteT0 });
}

export function eq(actual: any, expected: any, label?: string): void {
  if (actual !== expected) {
    throw new Error(`${label ? label + ": " : ""}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function throws(fn: () => void, pattern?: string): void {
  try {
    fn();
    throw new Error("Expected an error but none was thrown");
  } catch (e: any) {
    if (e.message === "Expected an error but none was thrown") throw e;
    if (pattern && !e.message.includes(pattern)) {
      throw new Error(`Expected error containing "${pattern}", got: ${e.message}`);
    }
  }
}

export async function asyncThrows(fn: () => Promise<any>, pattern?: string): Promise<void> {
  try {
    await fn();
    throw new Error("Expected an error but none was thrown");
  } catch (e: any) {
    if (e.message === "Expected an error but none was thrown") throw e;
    if (pattern && !e.message.includes(pattern)) {
      throw new Error(`Expected error containing "${pattern}", got: ${e.message}`);
    }
  }
}

/** The suite tail: floor tripwire, counts, the shard aggregator's line,
 *  timings, slowest tests. Exits non-zero on any failure. */
export function reportSummary(): void {
  // Suite-count floor (boundary baseline): a mass-disablement tripwire.
  // Suspended under ALLEGRO_TEST_FILTER — filtered runs are dev runs —
  // and under sharding, where no single shard sees the whole suite;
  // `scripts/test-shards.mjs` applies the floor to the aggregate.
  if (!TEST_FILTER && SHARD === null) {
    const floor = getSuiteFloor();
    if (passed + failed < floor) {
      failed++;
      failures.push(`suite shrank: ${passed + failed - 1} tests < committed floor ${floor} (src/boundary-baseline.json)`);
    }
  }
  console.log(`\n${"=".repeat(50)}`);
  if (TEST_FILTER) {
    console.log(`DEV RUN (ALLEGRO_TEST_FILTER=${process.env.ALLEGRO_TEST_FILTER}) — ${filteredOut} tests filtered out; NOT a landing gate`);
  }
  console.log(`Tests: ${passed + failed} total, ${passed} passed, ${failed} failed`);
  if (SHARD) {
    // Machine-readable line for the shard aggregator. `registered` is the
    // suite-wide registration count every shard sees, so the aggregator
    // can confirm the shards agree on what the suite contains.
    console.log(`SHARD-RESULT ${SHARD.index}/${SHARD.count} ran=${passed + failed} passed=${passed} failed=${failed} registered=${registeredCount} skipped=${shardedOut} everyShard=${everyShardCount}`);
  }
  console.log(`Wall clock: ${((performance.now() - suiteT0) / 1000).toFixed(1)}s`);
  console.log(`Sections: ${sectionTimes.map((s) => `${s.name} ${(s.ms / 1000).toFixed(1)}s`).join(" | ")}`);
  const slowest = [...testTimes].sort((a, b) => b.ms - a.ms).slice(0, 15);
  console.log(`Slowest tests:`);
  for (const t of slowest) console.log(`  ${(t.ms / 1000).toFixed(2).padStart(7)}s  ${t.name}`);
  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  ${f}`);
    process.exit(1);
  }
}
