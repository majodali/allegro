// =============================================================================
// Allegro Web — Browser entry point
// Bundles the Allegro runtime for use in the web sandbox.
// =============================================================================

import { evalSource } from "../src/runtime.js";
import { createTypeSystem } from "../src/types-std.js";
import { formatValue } from "../src/primitives.js";
import { ContextValue, Value } from "../src/types.js";

const typeExt = createTypeSystem();
let ctx: ContextValue | undefined = undefined;

interface EvalResult {
  output: string[];
  result: string | null;
  error: string | null;
}

function evalAllegro(source: string, standard: boolean = true): EvalResult {
  const output: string[] = [];
  const origLog = console.log;
  console.log = (...args: any[]) => output.push(args.map(String).join(" "));

  try {
    const extensions = standard ? [typeExt] : undefined;
    const { value, evalCtx } = evalSource(source, ctx, extensions, undefined, standard);
    ctx = evalCtx;

    const result = value !== null ? formatValue(value) : null;
    return { output, result, error: null };
  } catch (e: any) {
    return { output, result: null, error: e.message || String(e) };
  } finally {
    console.log = origLog;
  }
}

function resetContext(): void {
  ctx = undefined;
}

// Expose to global scope for the HTML page
(window as any).Allegro = {
  eval: evalAllegro,
  reset: resetContext,
  formatValue,
};
