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
  Repetition,
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
  parserRepChildren,
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
  repChildren: parserRepChildren,
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

  /** Create a Repetition element (0+ by default, with optional delimiter) */
  repeat(element: GrammarElement, options?: { delimiter?: GrammarElement; min?: number; max?: number }): Repetition {
    return new (Repetition as any)(
      element,
      options?.min ?? 0,
      options?.max ?? Infinity,
      options?.delimiter ?? null,
      false,
    );
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

// Bool literals "true" and "false" are handled as context bindings
// (not grammar extensions) because the base grammar's Ident terminal
// matches them and wins disambiguation. See createTypeSystem() in types-std.ts.

/**
 * Add float literals: CallExpr → CallExpr "." DecDigits
 * Parses "3.14" as integer(3) "." digits("14"), then combines into a float.
 * Uses a decimal digits terminal that matches only digits (not an identifier).
 */
export function addFloatLiterals(builder: GrammarBuilder): void {
  const dot = builder.terminal(".");
  const callExpr = builder.getBase("CallExpr");
  const digits = builder.terminal(/[0-9]+/);

  const floatPhrase = builder.phrase([callExpr, dot, digits]);
  (floatPhrase as any).attribute("val", Object, function (node: any) {
    // The left side is a parsed int value. Extract its numeric value.
    const leftVal = node.children[0].val;
    // Convert from signed bigint representation
    let intPart = leftVal?.data ?? 0n;
    if (typeof intPart === "bigint" && intPart >= 2n ** 63n) intPart = intPart - 2n ** 64n;
    const rightText = node.children[2].text;
    const floatStr = String(intPart) + "." + rightText;
    return helpers.makeExpr(helpers.prim("typed_float"), [helpers.stringToBits(floatStr)]);
  });

  builder.addAlternative("CallExpr", floatPhrase);
}

/**
 * Add array literal: Primary → "[" Repeat(Expr, ",") "]"
 * Produces: typed_array(elem1, elem2, ...)
 * Handles any number of elements including zero.
 */
export function addArrayLiteral(builder: GrammarBuilder): void {
  const lbracket = builder.terminal("[");
  const rbracket = builder.terminal("]");
  const comma = builder.terminal(",");
  const expr = builder.getBase("Expr");

  const elements = builder.repeat(expr, { delimiter: comma });
  const arrayPhrase = builder.phrase([lbracket, elements, rbracket]);
  (arrayPhrase as any).attribute("val", Object, function (node: any) {
    const children = helpers.repChildren(node.children[1]);
    const vals = children.map((c: any) => c.val);
    return helpers.makeExpr(helpers.prim("typed_array"), vals);
  });
  builder.addAlternative("Primary", arrayPhrase);
}

/**
 * Add object literal: Primary → "{" Repeat(Ident ":" Expr, ",") "}"
 * Produces: typed_object(key1_bits, val1, key2_bits, val2, ...)
 * Handles any number of fields including zero.
 */
export function addObjectLiteral(builder: GrammarBuilder): void {
  const lbrace = builder.terminal("{");
  const rbrace = builder.terminal("}");
  const colon = builder.terminal(":");
  const comma = builder.terminal(",");
  const ident = builder.getBase("Ident");
  const expr = builder.getBase("Expr");

  // Field definition: Ident ":" Expr
  const fieldDef = builder.phrase([ident, colon, expr]);
  (fieldDef as any).attribute("key", Object, function (node: any) {
    return node.children[0].text;
  });
  (fieldDef as any).attribute("val", Object, function (node: any) {
    return node.children[2].val;
  });

  const fields = builder.repeat(fieldDef, { delimiter: comma });
  const objPhrase = builder.phrase([lbrace, fields, rbrace]);
  (objPhrase as any).attribute("val", Object, function (node: any) {
    const children = helpers.repChildren(node.children[1]);
    const args: any[] = [];
    for (const child of children) {
      args.push(helpers.stringToBits(child.key));
      args.push(child.val);
    }
    return helpers.makeExpr(helpers.prim("typed_object"), args);
  });
  builder.addAlternative("Primary", objPhrase);
}

/**
 * Add bracket access: CallExpr → CallExpr "[" Expr "]"
 * Produces: type_dispatch(value, "get")(index)
 */
export function addBracketAccess(builder: GrammarBuilder): void {
  const lbracket = builder.terminal("[");
  const rbracket = builder.terminal("]");
  const callExpr = builder.getBase("CallExpr");
  const expr = builder.getBase("Expr");

  const bracketPhrase = builder.phrase([callExpr, lbracket, expr, rbracket]);
  (bracketPhrase as any).attribute("val", Object, function (node: any) {
    // type_dispatch(obj, "get") returns a bound method, then apply it with the index
    const dispatch = helpers.makeExpr(
      helpers.prim("type_dispatch"),
      [node.children[0].val, helpers.stringToBits("get")],
    );
    return helpers.makeExpr(dispatch, [node.children[2].val]);
  });

  builder.addAlternative("CallExpr", bracketPhrase);
}

/**
 * Build Allegro Standard grammar extensions.
 * Uses type_dispatch for dot access (type-directed dispatch).
 * Includes bool/float literals, array/object literals, bracket access.
 */
export function buildAllegroStandardExtensions(): GrammarExtension {
  const builder = new GrammarBuilder();
  addDotAccess(builder, true); // type-directed dispatch
  addImport(builder);
  addFloatLiterals(builder);
  addArrayLiteral(builder);
  addObjectLiteral(builder);
  addBracketAccess(builder);
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
