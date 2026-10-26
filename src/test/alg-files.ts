// =============================================================================
// The .alg corpus runner.
//
// `runAlgFile` evaluates a literate demo and validates its `// expect:`
// comments; `fileTest` registers one as an ordinary named test, so corpus
// files distribute across shards by name hash like everything else.
//
// The registry-completeness walk piggybacks on that evaluation (see below).
// `corpusWalkFiles`/`corpusWalkViolations` accumulate here and are read by
// the index when it hands them to the boundary battery: each shard reports
// the corpus IT walked, and scripts/test-shards.mjs asserts the union.
// =============================================================================

import { evalSource as runtimeEval, Extension } from "../runtime.js";
import { buildModuleObject } from "../modules.js";
import { scanUses } from "../use-scanner.js";
import { extractGrammarFragment, asGrammarValue } from "../primitives.js";
import { primitives as primRegistry } from "../primitives.js";
import { Value } from "../types.js";
import { checkValueInvariants, InvariantViolation } from "../boundary-tests.js";
import { test, eq } from "./harness.js";
import { typeExt } from "./fixtures.js";

import * as fs from "fs";
import * as path from "path";

/** Names that come from the interpreter itself, not from a module source —
 *  the filter every "collect this module's own bindings" loop applies. */
export const primNames = new Set(Object.keys(primRegistry));
export const testsDir = path.resolve("tests");
export const typeNames = new Set(["Int", "Float", "String", "Bool", "Array", "Object", "true", "false"]);

/**
 * A loader for `lib/NAME.alg` as an Extension, with one cache per loader.
 * A library may itself open with `use X` (lib/planning.alg uses the
 * totality forms and the units DSL; B-151 A2, A3). The runtime ModuleLoader
 * resolves such chains; this harness evaluates libraries directly, so it
 * resolves them the same way: scan the library's header, load what it uses
 * first (once per name), and evaluate its body with those extensions.
 */
export function libLoader(): (id: string, chain: string[]) => Extension {
  const libDir = path.resolve("lib");
  const loaded = new Map<string, Extension>();
  const loadLib = (id: string, chain: string[]): Extension => {
    const have = loaded.get(id);
    if (have) return have;
    if (chain.includes(id)) throw new Error(`use cycle: ${[...chain, id].join(" -> ")}`);
    const modSource = fs.readFileSync(path.join(libDir, `${id}.alg`), "utf-8");
    const scan = scanUses(modSource);
    const depNames = [...new Set(scan.directives
      .map(d => d.kind === "module" ? d.name! : d.kind === "member" ? d.moduleName! : null)
      .filter((x): x is string => x !== null))];
    const deps = depNames.map(dep => loadLib(dep, [...chain, id]));
    const modResult = runtimeEval(modSource.slice(scan.headerEnd), undefined, [typeExt, ...deps], undefined, true);
    const frag = extractGrammarFragment(modResult.evalCtx);
    const bindings: Record<string, Value> = {};
    for (const [key, b] of modResult.evalCtx.bindings) {
      if (b.value !== undefined && !primNames.has(key) && !typeNames.has(key)) {
        bindings[key] = b.value;
      }
    }
    const ext: Extension = { name: id, bindings, grammarFragment: frag };
    loaded.set(id, ext);
    return ext;
  };
  return loadLib;
}

/** The extensions a source needs for `use NAME` headers, in order: what a
 *  test passes to `runtimeEval` to run inline Allegro under libraries. */
export function libExtensions(names: string[]): Extension[] {
  const loadLib = libLoader();
  return names.map(n => loadLib(n, []));
}

/**
 * Run an .alg file in Allegro Standard mode.
 * Captures print output and validates against "// expect: ..." comments.
 * Handles `use NAME` (and the back-compat-free pre-scanner) by loading
 * lib/NAME.alg and merging its grammar fragment, mirroring the file runner.
 */
export function runAlgFile(filePath: string, extensions?: Extension[]): void {
  const source = fs.readFileSync(filePath, "utf-8");
  const lines = source.split(/\r?\n/);

  // Extract expected outputs from "// expect: ..." comments
  const expectations: { lineNum: number; expected: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/\/\/\s*expect:\s*(.*)/);
    if (match) {
      expectations.push({ lineNum: i + 1, expected: match[1].trim() });
    }
  }

  // Pre-scan the header for `use NAME`, `use import NAME`, and `use grammar
  // { … }` directives. Module names are collected for lib/ loading; literal
  // grammar blocks are evaluated in a bootstrap context now.
  const grammarNames: string[] = [];
  const memberRefs: Array<{ module: string; member: string }> = [];
  const literalGrammarSources: string[] = [];
  let headerEnd = 0;
  {
    let i = 0;
    const n = source.length;
    const skipWs = (p: number): number => {
      while (p < n) {
        const c = source[p];
        if (c === " " || c === "\t" || c === "\n" || c === "\r") { p++; continue; }
        if (source.slice(p, p + 2) === "//") {
          while (p < n && source[p] !== "\n") p++; continue;
        }
        break;
      }
      return p;
    };
    const findCloseBrace = (p: number): number => {
      let depth = 0;
      while (p < n) {
        const ch = source[p];
        if (ch === '"' || ch === "'") {
          const q = ch; p++;
          while (p < n && source[p] !== q) { if (source[p] === "\\") p++; p++; }
          p++; continue;
        }
        if (source.slice(p, p + 2) === "//") { while (p < n && source[p] !== "\n") p++; continue; }
        if (ch === "{") depth++;
        else if (ch === "}") { depth--; if (depth === 0) return p; }
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
        // `use grammar {`
        if (source.slice(j, j + 7) === "grammar" && (source[j + 7] === " " || source[j + 7] === "\t" || source[j + 7] === "{")) {
          const brace = source.indexOf("{", j);
          const end = findCloseBrace(brace);
          if (end < 0) break;
          literalGrammarSources.push(source.slice(j, end + 1));
          i = end + 1;
          while (i < n && (source[i] === " " || source[i] === "\t")) i++;
          if (i < n && source[i] === "\n") i++;
          continue;
        }
        // `use NAME.MEMBER` — Phase 7d dotted form; narrow to that Grammar.
        const dotMatch = /^(?:import\s+)?(\w+)\.(\w+)\s*(\r?\n|$)/.exec(source.slice(j));
        if (dotMatch) {
          grammarNames.push(dotMatch[1]);
          memberRefs.push({ module: dotMatch[1], member: dotMatch[2] });
          i = j + dotMatch[0].length; continue;
        }
        // `use NAME` or `use import NAME`
        const m = /^(?:import\s+)?(\w+)\s*(\r?\n|$)/.exec(source.slice(j));
        if (m) { grammarNames.push(m[1]); i = j + m[0].length; continue; }
      }
      break;
    }
    headerEnd = i;
  }

  let grammarExts: Extension[] = [];
  const uniqModuleNames = [...new Set(grammarNames)];
  if (uniqModuleNames.length > 0) {
    const loadLib = libLoader();
    for (const id of uniqModuleNames) {
      const ext = loadLib(id, []);
      const bindings = { ...ext.bindings };
      // `use NAME.MEMBER` — narrow to the named Grammar binding(s).
      const mems = memberRefs.filter(m => m.module === id);
      if (mems.length > 0) {
        const allowed = new Set(mems.map(m => m.member));
        for (const key of Object.keys(bindings)) {
          const v = bindings[key];
          if (asGrammarValue(v) && !allowed.has(key)) {
            delete bindings[key];
          }
        }
      }
      grammarExts.push({ name: id, bindings, grammarFragment: ext.grammarFragment });
    }
  }
  // Evaluate inline literal `grammar { … }` blocks in a bootstrap context.
  for (let idx = 0; idx < literalGrammarSources.length; idx++) {
    const bootstrapResult = runtimeEval(literalGrammarSources[idx], undefined, [typeExt], undefined, true);
    const gv = bootstrapResult.value;
    if (!gv) throw new Error("use grammar { … }: no grammar value produced");
    grammarExts.push({
      name: `__inline_grammar_${idx}`,
      bindings: { __inline_grammar: gv },
    });
  }
  // Strip the header from the source before evaluation.
  const cleanSource = source.slice(headerEnd);

  // `import NAME` statements: the CLI resolves `lib/NAME.alg` beside the
  // file first, then the system lib/, and hands the module in as an
  // extension carrying a typed module object. The harness does the same
  // for a demo (B-151 B2: tests/planning-split-demo.alg borrows a plan
  // from tests/lib/build_pipeline.alg). A module runs through the same
  // evaluation as a library, with its own `use` headers resolved.
  const importNames = [...cleanSource.matchAll(/^import\s+([A-Za-z_][A-Za-z_0-9]*)\s*$/gm)].map(m => m[1]);
  const providedNames = new Set<string>();
  for (const ext of [...grammarExts, ...(extensions ?? [])]) {
    for (const name of Object.keys(ext.bindings)) providedNames.add(name);
    if (ext.moduleObject) providedNames.add(ext.name);
  }
  const importExts: Extension[] = [];
  if (importNames.some(n => !providedNames.has(n))) {
    const loadLib = libLoader();
    for (const name of importNames) {
      if (providedNames.has(name)) continue;
      const local = path.join(path.dirname(filePath), "lib", `${name}.alg`);
      const modPath = fs.existsSync(local) ? local : path.join(path.resolve("lib"), `${name}.alg`);
      const modSource = fs.readFileSync(modPath, "utf-8");
      const scan = scanUses(modSource);
      const depNames = [...new Set(scan.directives
        .map(d => d.kind === "module" ? d.name! : d.kind === "member" ? d.moduleName! : null)
        .filter((x): x is string => x !== null))];
      const deps = depNames.map(dep => loadLib(dep, []));
      const depBound = new Set<string>();
      for (const d of deps) for (const k of Object.keys(d.bindings)) depBound.add(k);
      const modResult = runtimeEval(modSource.slice(scan.headerEnd), undefined, [typeExt, ...deps], undefined, true);
      const bindings: Record<string, Value> = {};
      const exported = new Set<string>();
      for (const [key, b] of modResult.evalCtx.bindings) {
        if (b.value === undefined || primNames.has(key) || typeNames.has(key) || depBound.has(key)) continue;
        bindings[key] = b.value;
        if ((b as any).visibility === "exported") exported.add(key);
      }
      // Open-module policy (modules.md): no `export` means every binding.
      const visible = exported.size > 0 ? exported : new Set(Object.keys(bindings));
      importExts.push({ name, bindings: {}, moduleObject: buildModuleObject(name, bindings, visible) });
    }
  }

  // Capture print output
  const printed: string[] = [];
  const origLog = console.log;
  console.log = (msg: any) => printed.push(String(msg));

  try {
    const exts = [typeExt, ...grammarExts, ...importExts, ...(extensions ?? [])];
    const { value: fileValue, evalCtx: fileCtx } = runtimeEval(cleanSource, undefined, exts, undefined, true);
    // Registry-completeness piggyback: walk this file's values for the
    // boundary harness HERE (memory traversal, ~ms) instead of re-evaluating
    // the whole corpus in the boundary section (which cost 156s of the
    // suite before the 2026-07 suite-cost pass).
    corpusWalkFiles++;
    const seen = new WeakSet<object>();
    checkValueInvariants(fileValue, path.basename(filePath), corpusWalkViolations, seen);
    for (const b of fileCtx.bindings.values()) {
      checkValueInvariants(b.value as any, path.basename(filePath), corpusWalkViolations, seen);
    }
  } catch (e: any) {
    console.log = origLog;
    throw e;
  } finally {
    console.log = origLog;
  }

  // Validate
  const basename = path.basename(filePath);
  if (expectations.length !== printed.length) {
    throw new Error(
      `${basename}: expected ${expectations.length} outputs but got ${printed.length}` +
      `\n  Expected: ${expectations.map(e => e.expected).join(", ")}` +
      `\n  Got: ${printed.join(", ")}`
    );
  }
  for (let i = 0; i < expectations.length; i++) {
    if (printed[i] !== expectations[i].expected) {
      throw new Error(
        `${basename} line ${expectations[i].lineNum}: expected "${expectations[i].expected}" but got "${printed[i]}"`
      );
    }
  }
}

// Collected by runAlgFile's registry-completeness piggyback; consumed by the
// boundary section at the end of the suite.
const corpusWalkViolations: InvariantViolation[] = [];
let corpusWalkFiles = 0;

export function fileTest(filePath: string, extensions?: Extension[]): void {
  const basename = path.basename(filePath);
  // Distributed by hash like every other test. Each shard walks the
  // corpus files it owns and checks THOSE files for registry violations
  // (see the every-shard registry-completeness test); the union across
  // shards covers the whole corpus, and the aggregator asserts the total
  // coverage the single-process run asserts locally.
  test(`file: ${basename}`, () => {
    runAlgFile(filePath, extensions);
    eq(true, true); // if we get here, all expectations matched
  });
}

/** The corpus this process actually walked — read by the index when it
 *  wires the boundary battery. Sharded, each process reports its own
 *  subset and the aggregator asserts the union. */
export function corpusWalk(): { files: number; violations: InvariantViolation[] } {
  return { files: corpusWalkFiles, violations: corpusWalkViolations };
}
