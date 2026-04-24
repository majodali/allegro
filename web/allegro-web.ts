// =============================================================================
// Allegro Web — Browser entry point
// Bundles the Allegro runtime for use in the web sandbox.
// =============================================================================

import { evalSource } from "../src/runtime.js";
import { createTypeSystem } from "../src/types-std.js";
import { formatValue, extractGrammarFragment, asGrammarValue, primitives as primRegistry } from "../src/primitives.js";
import { ContextValue, Value, Extension } from "../src/types.js";
import { createFutureManager, FutureManager } from "../src/futures.js";
import { summarizeModule, renderModuleSummary } from "../src/introspect.js";

const typeExt = createTypeSystem();
let ctx: ContextValue | undefined = undefined;
let fm: FutureManager | undefined = undefined;

// Library registry: name → source. Populated via Allegro.registerLibrary().
// Referenced via `use NAME` directives in sandbox sources.
const libraries: Map<string, string> = new Map();

function registerLibrary(name: string, source: string): void {
  libraries.set(name, source);
}

// Scan the top-of-file header for `use …` directives. Supports:
//   use NAME
//   use import NAME
//   use NAME.MEMBER            (Phase 7d)
//   use grammar { … }          (Phase 7a hosting-file literal)
// Returns directives + end offset so the caller can strip the header.
interface UseDirective {
  kind:        "module" | "member" | "literal";
  name?:       string;
  moduleName?: string;
  memberName?: string;
  source?:     string;
}
function scanUses(source: string): { directives: UseDirective[]; headerEnd: number } {
  const directives: UseDirective[] = [];
  let i = 0;
  const n = source.length;
  const skipWs = (p: number): number => {
    while (p < n) {
      const c = source[p];
      if (c === " " || c === "\t" || c === "\n" || c === "\r") { p++; continue; }
      if (source.slice(p, p + 2) === "//") { while (p < n && source[p] !== "\n") p++; continue; }
      break;
    }
    return p;
  };
  const findCloseBrace = (p: number): number => {
    let depth = 0;
    while (p < n) {
      const c = source[p];
      if (c === '"' || c === "'") {
        const q = c; p++;
        while (p < n && source[p] !== q) { if (source[p] === "\\") p++; p++; }
        p++; continue;
      }
      if (source.slice(p, p + 2) === "//") { while (p < n && source[p] !== "\n") p++; continue; }
      if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) return p; }
      p++;
    }
    return -1;
  };
  while (i < n) {
    i = skipWs(i);
    if (i >= n) break;
    if (source.slice(i, i + 4) === "use " || source.slice(i, i + 4) === "use\t") {
      let j = i + 4;
      while (j < n && (source[j] === " " || source[j] === "\t")) j++;
      // use grammar { … }
      if (source.slice(j, j + 7) === "grammar" &&
          (source[j + 7] === " " || source[j + 7] === "\t" || source[j + 7] === "{")) {
        const brace = source.indexOf("{", j);
        const end = findCloseBrace(brace);
        if (end < 0) break;
        directives.push({ kind: "literal", source: source.slice(j, end + 1) });
        i = end + 1;
        while (i < n && (source[i] === " " || source[i] === "\t")) i++;
        if (i < n && source[i] === "\n") i++;
        continue;
      }
      // use NAME.MEMBER
      const dotMatch = /^(?:import\s+)?(\w+)\.(\w+)\s*(\r?\n|$)/.exec(source.slice(j));
      if (dotMatch) {
        directives.push({ kind: "member", moduleName: dotMatch[1], memberName: dotMatch[2] });
        i = j + dotMatch[0].length;
        continue;
      }
      // use NAME / use import NAME
      const m = /^(?:import\s+)?(\w+)\s*(\r?\n|$)/.exec(source.slice(j));
      if (m) {
        directives.push({ kind: "module", name: m[1] });
        i = j + m[0].length;
        continue;
      }
    }
    break;
  }
  return { directives, headerEnd: i };
}

// Load registered library source as an extension: evaluate it (in a fresh ctx),
// capture any grammar fragment, and collect its user-level bindings.
function loadGrammarLibrary(name: string, memberFilter?: Set<string>): Extension {
  const source = libraries.get(name);
  if (!source) throw new Error(`Grammar library '${name}' not registered (use Allegro.registerLibrary first)`);
  const result = evalSource(source, undefined, [typeExt], undefined, true);
  const frag = extractGrammarFragment(result.evalCtx);
  const bindings: Record<string, Value> = {};
  for (const [key, b] of result.evalCtx.bindings) {
    if (b.value === undefined) continue;
    bindings[key] = b.value;
  }
  // Narrow Grammar-valued bindings to `memberFilter` if a `use NAME.MEMBER`
  // directive asked for a specific one.
  if (memberFilter) {
    for (const k of Object.keys(bindings)) {
      if (asGrammarValue(bindings[k]) && !memberFilter.has(k)) delete bindings[k];
    }
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
      const { directives, headerEnd } = scanUses(source);
      const moduleExts: Extension[] = [];
      // Group member refs by module so we load each module once.
      const memberByModule = new Map<string, Set<string>>();
      for (const d of directives) {
        if (d.kind === "member") {
          if (!memberByModule.has(d.moduleName!)) memberByModule.set(d.moduleName!, new Set());
          memberByModule.get(d.moduleName!)!.add(d.memberName!);
        }
      }
      for (const d of directives) {
        if (d.kind === "module")  moduleExts.push(loadGrammarLibrary(d.name!));
        if (d.kind === "member" && memberByModule.has(d.moduleName!)) {
          const members = memberByModule.get(d.moduleName!)!;
          moduleExts.push(loadGrammarLibrary(d.moduleName!, members));
          memberByModule.delete(d.moduleName!);     // load once per module
        }
        if (d.kind === "literal") {
          // Evaluate the `grammar { … }` source at bootstrap time.
          const boot = evalSource(d.source!, undefined, [typeExt], undefined, true);
          if (boot.value) {
            moduleExts.push({
              name: `__inline_${moduleExts.length}`,
              bindings: { __inline_grammar: boot.value },
            });
          }
        }
      }
      if (moduleExts.length > 0) {
        extensions = [...(extensions ?? []), ...moduleExts];
      }
      effectiveSource = source.slice(headerEnd);
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
      const { directives, headerEnd } = scanUses(source);
      const moduleExts: Extension[] = [];
      // Group member refs by module so we load each module once.
      const memberByModule = new Map<string, Set<string>>();
      for (const d of directives) {
        if (d.kind === "member") {
          if (!memberByModule.has(d.moduleName!)) memberByModule.set(d.moduleName!, new Set());
          memberByModule.get(d.moduleName!)!.add(d.memberName!);
        }
      }
      for (const d of directives) {
        if (d.kind === "module")  moduleExts.push(loadGrammarLibrary(d.name!));
        if (d.kind === "member" && memberByModule.has(d.moduleName!)) {
          const members = memberByModule.get(d.moduleName!)!;
          moduleExts.push(loadGrammarLibrary(d.moduleName!, members));
          memberByModule.delete(d.moduleName!);     // load once per module
        }
        if (d.kind === "literal") {
          // Evaluate the `grammar { … }` source at bootstrap time.
          const boot = evalSource(d.source!, undefined, [typeExt], undefined, true);
          if (boot.value) {
            moduleExts.push({
              name: `__inline_${moduleExts.length}`,
              bindings: { __inline_grammar: boot.value },
            });
          }
        }
      }
      if (moduleExts.length > 0) {
        extensions = [...(extensions ?? []), ...moduleExts];
      }
      effectiveSource = source.slice(headerEnd);
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

/**
 * Inspect a source file: evaluate it (suppressing any print output) and
 * return the rendered semantic summary — safety grade, per-binding types,
 * primitives used, unresolved references. Phase A of the provability arc.
 */
function inspectAllegro(source: string): { summary: string; grade: string; error: string | null } {
  const primNames = new Set(Object.keys(primRegistry));
  const suppress: string[] = [];
  const origLog = console.log;
  console.log = (...args: any[]) => suppress.push(args.map(String).join(" "));

  try {
    // Mirror evalAllegro's grammar-directive handling.
    let extensions: Extension[] = [typeExt];
    let effectiveSource = source;
    const { directives, headerEnd } = scanUses(source);
    const memberByModule = new Map<string, Set<string>>();
    for (const d of directives) {
      if (d.kind === "member") {
        if (!memberByModule.has(d.moduleName!)) memberByModule.set(d.moduleName!, new Set());
        memberByModule.get(d.moduleName!)!.add(d.memberName!);
      }
    }
    for (const d of directives) {
      if (d.kind === "module") extensions.push(loadGrammarLibrary(d.name!));
      if (d.kind === "member" && memberByModule.has(d.moduleName!)) {
        extensions.push(loadGrammarLibrary(d.moduleName!, memberByModule.get(d.moduleName!)!));
        memberByModule.delete(d.moduleName!);
      }
      if (d.kind === "literal") {
        const boot = evalSource(d.source!, undefined, [typeExt], undefined, true);
        if (boot.value) {
          extensions.push({
            name: `__inline_${extensions.length}`,
            bindings: { __inline_grammar: boot.value },
          });
        }
      }
    }
    effectiveSource = source.slice(headerEnd);

    const result = evalSource(effectiveSource, undefined, extensions, undefined, true);
    const excluded = new Set<string>(primNames);
    for (const ext of extensions) {
      for (const k of Object.keys(ext.bindings)) excluded.add(k);
    }
    const summary = summarizeModule(result.evalCtx, result.compilationReport, {
      excludeBindings: excluded,
    });
    return {
      summary: renderModuleSummary(summary),
      grade:   summary.grade,
      error:   null,
    };
  } catch (e: any) {
    return { summary: "", grade: "has-errors", error: e.message || String(e) };
  } finally {
    console.log = origLog;
    void suppress; // deliberately discarded
  }
}

// Expose to global scope for the HTML page
(window as any).Allegro = {
  eval: evalAllegro,
  evalAsync: evalAllegroAsync,
  reset: resetContext,
  formatValue,
  registerLibrary,
  inspect: inspectAllegro,
};
