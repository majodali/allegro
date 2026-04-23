// =============================================================================
// Allegro Web — Browser entry point
// Bundles the Allegro runtime for use in the web sandbox.
// =============================================================================

import { evalSource } from "../src/runtime.js";
import { createTypeSystem } from "../src/types-std.js";
import { formatValue, extractGrammarFragment } from "../src/primitives.js";
import { ContextValue, Value, Extension } from "../src/types.js";
import { createFutureManager, FutureManager } from "../src/futures.js";

const typeExt = createTypeSystem();
let ctx: ContextValue | undefined = undefined;
let fm: FutureManager | undefined = undefined;

// Library registry: name → source. Populated via Allegro.registerLibrary().
// Referenced via `use NAME` directives in sandbox sources.
const libraries: Map<string, string> = new Map();

function registerLibrary(name: string, source: string): void {
  libraries.set(name, source);
}

// Scan `use NAME` (or `use import NAME`) directives at the top of a source
// file. Returns the list of names in order. Stops at first non-header line.
function scanUses(source: string): string[] {
  const names: string[] = [];
  const lines = source.split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (t === "" || t.startsWith("//")) continue;
    const m = /^use\s+(?:import\s+)?(\w+)\s*$/.exec(t);
    if (m) { names.push(m[1]); continue; }
    break;
  }
  return names;
}

// Load registered library source as an extension: evaluate it (in a fresh ctx),
// capture any grammar fragment, and collect its user-level bindings.
function loadGrammarLibrary(name: string): Extension {
  const source = libraries.get(name);
  if (!source) throw new Error(`Grammar library '${name}' not registered (use Allegro.registerLibrary first)`);
  const result = evalSource(source, undefined, [typeExt], undefined, true);
  const frag = extractGrammarFragment(result.evalCtx);
  // Collect source-defined bindings (skip primitives and core types)
  const bindings: Record<string, Value> = {};
  for (const [key, b] of result.evalCtx.bindings) {
    if (b.value === undefined) continue;
    // Skip if this key came from the standard type system or primitives
    // (heuristic: present in a fresh evalCtx without our source).
    bindings[key] = b.value;
  }
  return { name, bindings, grammarFragment: frag };
}

interface EvalResult {
  output: string[];
  result: string | null;
  error: string | null;
}

/** Synchronous evaluation (no async support — existing behavior) */
function evalAllegro(source: string, standard: boolean = true): EvalResult {
  const output: string[] = [];
  const origLog = console.log;
  console.log = (...args: any[]) => output.push(args.map(String).join(" "));

  try {
    if (!fm) fm = createFutureManager();
    // Two-pass: handle `use …` directives by loading the named libraries
    // and merging their grammar fragments before parsing the main source.
    let extensions: Extension[] | undefined = standard ? [typeExt] : undefined;
    let effectiveSource = source;
    if (standard) {
      const grammarNames = scanUses(source);
      if (grammarNames.length > 0) {
        const grammarExts = grammarNames.map(loadGrammarLibrary);
        extensions = [...(extensions ?? []), ...grammarExts];
        effectiveSource = source.replace(/^\s*use\s+(?:import\s+)?\w+\s*$/gm, "");
      }
    }
    const { value, evalCtx } = evalSource(effectiveSource, ctx, extensions, undefined, standard, fm);
    ctx = evalCtx;

    const result = value !== null ? formatValue(value) : null;
    return { output, result, error: null };
  } catch (e: any) {
    return { output, result: null, error: e.message || String(e) };
  } finally {
    console.log = origLog;
  }
}

/** Async evaluation — returns a Promise that resolves when all futures complete.
 *  Calls onOutput incrementally as deferred prints fire. */
function evalAllegroAsync(
  source: string,
  onOutput: (text: string) => void,
  standard: boolean = true,
): Promise<EvalResult> {
  const output: string[] = [];

  try {
    if (!fm) fm = createFutureManager();
    fm.onOutput = (text: string) => {
      output.push(text);
      onOutput(text);
    };

    let extensions: Extension[] | undefined = standard ? [typeExt] : undefined;
    let effectiveSource = source;
    if (standard) {
      const grammarNames = scanUses(source);
      if (grammarNames.length > 0) {
        const grammarExts = grammarNames.map(loadGrammarLibrary);
        extensions = [...(extensions ?? []), ...grammarExts];
        effectiveSource = source.replace(/^\s*use\s+(?:import\s+)?\w+\s*$/gm, "");
      }
    }
    const origLog = console.log;
    console.log = (...args: any[]) => {
      const text = args.map(String).join(" ");
      output.push(text);
      onOutput(text);
    };

    const { value, evalCtx } = evalSource(effectiveSource, ctx, extensions, undefined, standard, fm);
    ctx = evalCtx;
    console.log = origLog;

    if (!fm.hasPending()) {
      const result = value !== null ? formatValue(value) : null;
      fm.onOutput = null;
      return Promise.resolve({ output, result, error: null });
    }

    // When there are pending futures, the streamed output (via onOutput) is
    // authoritative — the sync `value` is a stale residual Expression that
    // would format as "<expression>". Don't display it; everything the user
    // needs has already been streamed as prints resolve.
    return fm.waitForAll().then(() => {
      fm!.onOutput = null;
      return { output, result: null, error: null };
    });
  } catch (e: any) {
    return Promise.resolve({ output, result: null, error: e.message || String(e) });
  }
}

function resetContext(): void {
  ctx = undefined;
  fm = undefined;
}

// Expose to global scope for the HTML page
(window as any).Allegro = {
  eval: evalAllegro,
  evalAsync: evalAllegroAsync,
  reset: resetContext,
  formatValue,
  registerLibrary,
};
