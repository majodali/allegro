// =============================================================================
// B-120 E2 — the scan/index crossover for a Structure's slot plane.
//
// The plan (docs/plans/entry-sequence-composite.md §5.1) requires this measured
// before the index policy is set, because the whole arc rests on "a linear scan
// over the entries beats a Map at the sizes structures actually are".
//
// It measures three things, because only the third settles the policy:
//   1. lookup on a HIT, worst case for the scan (the last key)
//   2. lookup on a MISS, where the scan must read every entry
//   3. the cost of BUILDING the index at all — which a structure that is
//      looked up once or twice never earns back
//
// Run: npx tsx scripts/bench-slot-lookup.ts
// Lives outside tsconfig's rootDir by the same convention as bench/ and pcp/.
// =============================================================================

type Entry = { key: string | null; value: number };

/** Keys shaped like the real ones: engine slots first, then member FQNs. */
function keysFor(n: number): string[] {
  const slots = ["__name", "__members", "__construct", "__refines",
                 "__predicate", "__generic", "__args", "params"];
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(i < slots.length ? slots[i] : `<type#T>::m${i}`);
  return out;
}

function entriesFor(n: number): Entry[] {
  return keysFor(n).map((key, i) => ({ key, value: i }));
}

function scanGet(es: Entry[], k: string): Entry | undefined {
  for (let i = 0; i < es.length; i++) if (es[i].key === k) return es[i];
  return undefined;
}

const REPS = 2_000_000;
const SIZES = [1, 2, 3, 4, 5, 6, 8, 12, 16, 24, 32, 64];

function ms(f: () => void): number {
  const t = process.hrtime.bigint();
  f();
  return Number(process.hrtime.bigint() - t) / 1e6;
}

function main(): void {
  console.log(`slot lookup — ${REPS.toLocaleString()} reps per cell, milliseconds, lower is better`);
  console.log("hit = the LAST key, the scan's worst case\n");
  console.log("    N   scan-hit   map-hit  scan-miss  map-miss  build-index  break-even");
  console.log("  " + "-".repeat(72));

  for (const n of SIZES) {
    const es = entriesFor(n);
    const index = new Map<string, Entry>();
    for (const e of es) index.set(e.key as string, e);
    const hit = es[n - 1].key as string;
    const miss = "__not_a_key";
    let sink = 0;

    const scanHit = ms(() => { for (let i = 0; i < REPS; i++) sink += scanGet(es, hit) ? 1 : 0; });
    const mapHit  = ms(() => { for (let i = 0; i < REPS; i++) sink += index.get(hit) ? 1 : 0; });
    const scanMiss = ms(() => { for (let i = 0; i < REPS; i++) sink += scanGet(es, miss) ? 1 : 0; });
    const mapMiss  = ms(() => { for (let i = 0; i < REPS; i++) sink += index.get(miss) ? 1 : 0; });
    // Build is 20x cheaper to sample; scale back up to REPS for comparability.
    const build = ms(() => {
      for (let i = 0; i < REPS / 20; i++) {
        const q = new Map<string, Entry>();
        for (const e of es) q.set(e.key as string, e);
        sink += q.size;
      }
    }) * 20;

    // How many lookups it takes for the index to repay its construction.
    const perLookupGain = (scanHit - mapHit) / REPS;
    const breakEven = perLookupGain > 0 ? Math.round((build / REPS) / perLookupGain) : Infinity;

    if (sink < 0) console.log("");   // keep the optimiser honest
    console.log(
      `  ${String(n).padStart(3)}` +
      `${scanHit.toFixed(0).padStart(11)}${mapHit.toFixed(0).padStart(10)}` +
      `${scanMiss.toFixed(0).padStart(11)}${mapMiss.toFixed(0).padStart(10)}` +
      `${build.toFixed(0).padStart(13)}` +
      `${(breakEven === Infinity ? "never" : String(breakEven)).padStart(12)}`,
    );
  }

  console.log("\n`break-even` is the number of lookups a structure of that size must");
  console.log("receive before building an index repays what it cost to build.");
}

main();
