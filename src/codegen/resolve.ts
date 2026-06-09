// Phase I codegen — front-end: source → resolved pre-evaluation program.
//
// Codegen lowers the *resolved pre-evaluation* expression DAG, not the
// post-evaluation residuals. The distinction matters: `evalSource`'s
// evaluation loop fires top-level side effects (a bare `print(x)`) and
// discards them — so the post-eval `evalCtx.bindings` no longer carries the
// program's output sequence. The resolved `fileCtx.bindingList` does: it is
// the ordered list of named bindings and bare statements, with identifiers
// resolved (source-to-source references stay as `Symbol(name)`, params as
// `Param`, primitives/extensions as their values).
//
// This mirrors the front half of `evalSource` (parse → typeLiterals →
// resolveSymbols) without the evaluation loop. The folding oracle that an
// optimizing backend wants (Phase I4) is the *separate* post-eval evalCtx —
// codegen consults it later, but structure + statement order come from here.

import { typeLiterals, resolveSymbols } from "../runtime.js";
import { parse as grammar2Parse } from "../grammar2/engine.js";
import { getBaseGrammar } from "../grammar2/base-grammar.js";
import { buildProgram } from "../grammar2/tree-builder.js";
import { getGrammarWithFragments } from "../grammar2/fragments.js";
import { assertClean as assertGrammarClean } from "../grammar2/analyzer.js";
import { asGrammarValue } from "../primitives.js";
import { Extension, GrammarFragment } from "../types.js";

export interface ResolvedProgram {
  /** Ordered bindings + bare statements. `key === null` marks a bare
   *  statement (e.g. a top-level `print(...)`). `value` is the resolved
   *  pre-evaluation Value DAG. */
  bindingList: { key: string | null; value: any; isUse: boolean }[];
}

/** Parse + type-literal + symbol-resolve `source` into the program codegen
 *  lowers. `typed` selects Allegro Standard (true) vs Allegretto (false). */
export function resolveProgram(
  source: string,
  extensions?: Extension[],
  typed?: boolean,
): ResolvedProgram {
  const normalized = source.replace(/\r\n/g, "\n");

  // Harvest grammar fragments the same way evalSource does, so a file using
  // `use NAME`-provided syntax still resolves.
  const fragments: GrammarFragment[] = [];
  for (const ext of extensions ?? []) {
    if (ext.grammarFragment) fragments.push(ext.grammarFragment);
    if (ext.bindings) {
      for (const key of Object.keys(ext.bindings)) {
        const data = asGrammarValue(ext.bindings[key]);
        if (data) fragments.push(data.fragment);
      }
    }
  }

  const grammar = fragments.length > 0
    ? getGrammarWithFragments(fragments)
    : getBaseGrammar();
  assertGrammarClean(grammar);

  const result = grammar2Parse(grammar, normalized);
  if (!result.ok) {
    throw new Error(
      `Parse error at position ${result.error.position}: ${result.error.message}`,
    );
  }

  const fileCtx: any = buildProgram(result.tree);

  if (typed) {
    for (const b of fileCtx.bindingList) {
      if (b.value !== undefined) b.value = typeLiterals(b.value);
    }
  }

  resolveSymbols(fileCtx, undefined, extensions, typed);

  return { bindingList: fileCtx.bindingList };
}
