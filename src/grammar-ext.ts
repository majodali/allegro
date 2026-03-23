// =============================================================================
// Allegro Base Language - Grammar Extension
// Provides a builder API for extending the grammar without mutating the base.
// =============================================================================

import type { ParseResult } from "./parser.js";
import {
  baseGrammar,
  Grammar,
  GrammarElement,
  Terminal,
  Phrase,
  Disjunction,
  parseWithExtensions,
  parserMakeExpr,
  parserMakeParam,
  parserMakeInt,
  parserMakeComposedFn,
  parserPrim,
  parserBuildFn,
  parserSubstName,
  parserStringToBits,
  parserMakeContext,
  parserBind,
} from "./parser.js";

// --- Types ---

export interface GrammarExtension {
  additionalAlternatives: Map<GrammarElement, GrammarElement[]>;
}

// --- Parser helpers re-exported for extension authors ---

export const helpers = {
  makeExpr: parserMakeExpr,
  makeParam: parserMakeParam,
  makeInt: parserMakeInt,
  makeComposedFn: parserMakeComposedFn,
  prim: parserPrim,
  buildFn: parserBuildFn,
  substName: parserSubstName,
  stringToBits: parserStringToBits,
  makeContext: parserMakeContext,
  bind: parserBind,
};

// --- GrammarBuilder ---

export class GrammarBuilder {
  private grammar: Grammar;
  private additions: Map<GrammarElement, GrammarElement[]> = new Map();

  constructor(grammar?: Grammar) {
    this.grammar = (grammar ?? baseGrammar) as Grammar;
  }

  /** Get a named element from the base grammar (e.g., "CallExpr", "Statement") */
  getBase(name: string): GrammarElement {
    return (this.grammar as any).get(name);
  }

  /** Create a new Terminal (not registered in the base grammar) */
  terminal(pattern: RegExp | string): Terminal {
    return new (Terminal as any)(pattern);
  }

  /** Create a new Phrase from grammar elements */
  phrase(elements: GrammarElement[]): Phrase {
    return new (Phrase as any)(elements);
  }

  /** Add a new alternative to a named Disjunction in the base grammar */
  addAlternative(disjunctionName: string, alternative: GrammarElement): this {
    const disjunction = this.getBase(disjunctionName);
    let list = this.additions.get(disjunction);
    if (!list) {
      list = [];
      this.additions.set(disjunction, list);
    }
    list.push(alternative);
    return this;
  }

  /** Build the immutable extensions map */
  build(): GrammarExtension {
    return {
      additionalAlternatives: new Map(this.additions),
    };
  }
}

// --- Parse with extensions ---

export function parseExtended(input: string, extension: GrammarExtension): ParseResult {
  return parseWithExtensions(input, extension.additionalAlternatives as any);
}

// --- Built-in extension builders ---

/**
 * Add dot access syntax: CallExpr → CallExpr "." Ident
 * Produces: ctx_resolve(left, "fieldName") in base mode,
 * or type_dispatch(left, "fieldName") in typed mode.
 */
export function addDotAccess(builder: GrammarBuilder, typed: boolean = false): void {
  const dot = builder.terminal(".");
  const callExpr = builder.getBase("CallExpr");
  const ident = builder.getBase("Ident");

  const dotPhrase = builder.phrase([callExpr, dot, ident]);
  const primName = typed ? "type_dispatch" : "ctx_resolve";
  (dotPhrase as any).attribute("val", Object, function (node: any) {
    return helpers.makeExpr(
      helpers.prim(primName),
      [node.children[0].val, helpers.stringToBits(node.children[2].text)],
    );
  });

  builder.addAlternative("CallExpr", dotPhrase);
}

/**
 * Add import syntax: Statement → "import" Ident
 * Produces a binding with value: undefined (declarative — the module system
 * provides the actual value via extensions, which aren't shadowed by
 * undefined source bindings).
 */
export function addImport(builder: GrammarBuilder): void {
  const importKw = builder.terminal("import");
  const ident = builder.getBase("Ident");

  const importPhrase = builder.phrase([importKw, ident]);
  (importPhrase as any).attribute("binding", Object, function (node: any) {
    return { name: node.children[1].text, value: undefined };
  });
  (importPhrase as any).attribute("val", Object, function () {
    return undefined;
  });

  // Wrap in a single-element phrase to match Statement's interface
  // (Statement alternatives produce binding + val attributes)
  const importWrapper = builder.phrase([importPhrase]);
  (importWrapper as any).attribute("binding", Object, function (node: any) {
    return node.children[0].binding;
  });
  (importWrapper as any).attribute("val", Object, function () {
    return undefined;
  });

  builder.addAlternative("Statement", importWrapper);
}

/**
 * Build the standard grammar extensions (dot access + import).
 * Uses ctx_resolve for dot access (base mode).
 */
export function buildStandardExtensions(): GrammarExtension {
  const builder = new GrammarBuilder();
  addDotAccess(builder);
  addImport(builder);
  return builder.build();
}

/**
 * Build Allegro Standard grammar extensions.
 * Uses type_dispatch for dot access (type-directed dispatch).
 */
export function buildAllegroStandardExtensions(): GrammarExtension {
  const builder = new GrammarBuilder();
  addDotAccess(builder, true); // type-directed dispatch
  addImport(builder);
  return builder.build();
}

// --- Handle Registry ---
// Grammar objects (GrammarBuilder, GrammarExtension) are opaque to Allegro.
// They are stored here and referenced by integer handles (Bits values).

let nextHandle = 1;
const handleRegistry = new Map<number, any>();

export function registryStore(obj: any): number {
  const id = nextHandle++;
  handleRegistry.set(id, obj);
  return id;
}

export function registryGet(id: number): any {
  const obj = handleRegistry.get(id);
  if (obj === undefined) throw new Error(`Invalid grammar handle: ${id}`);
  return obj;
}
