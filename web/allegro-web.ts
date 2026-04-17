// =============================================================================
// Allegro Web — Browser entry point
// Bundles the Allegro runtime for use in the web sandbox.
// =============================================================================

import { evalSource } from "../src/runtime.js";
import { createTypeSystem } from "../src/types-std.js";
import { formatValue } from "../src/primitives.js";
import { ContextValue, Value } from "../src/types.js";
import { createFutureManager, FutureManager } from "../src/futures.js";

const typeExt = createTypeSystem();
let ctx: ContextValue | undefined = undefined;
let fm: FutureManager | undefined = undefined;

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
    const extensions = standard ? [typeExt] : undefined;
    const { value, evalCtx } = evalSource(source, ctx, extensions, undefined, standard, fm);
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

    const extensions = standard ? [typeExt] : undefined;
    const origLog = console.log;
    console.log = (...args: any[]) => {
      const text = args.map(String).join(" ");
      output.push(text);
      onOutput(text);
    };

    const { value, evalCtx } = evalSource(source, ctx, extensions, undefined, standard, fm);
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
};
