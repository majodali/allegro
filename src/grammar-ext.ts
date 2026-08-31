// =============================================================================
// Allegretto - Grammar Extension
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
  Optional,
  SyntaxTreeNode,
  parseGrammar,
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
  parserMakeSymbol,
} from "./parser.js";
import {
  Value, ValueKind, StructureValue, BitsValue,
  makeStructure, makeInt, withMeta, stringToBits, } from "./types.js";
import { withType, StringType, ErrorType, IntType, makeArray, noneSingleton } from "./types-std.js";

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
  makeStructure: parserMakeContext,
  bind: parserBind,
  repChildren: parserRepChildren,
  makeSymbol: parserMakeSymbol,
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

  /** Create a new Disjunction from alternatives */
  disjunction(alternatives: GrammarElement[]): Disjunction {
    return new (Disjunction as any)(alternatives);
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
 * Produces: ctx_resolve(left, "fieldName") in Allegretto mode,
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
 * Uses ctx_resolve for dot access (Allegretto mode).
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
 * Add logical operators: && || at LambdaExpr level, ! at UnaryExpr level.
 * && and || use short-circuit semantics (right operand wrapped in thunk).
 */
export function addLogicalOps(builder: GrammarBuilder): void {
  const andOp = builder.terminal("&&");
  const orOp = builder.terminal("||");
  const notOp = builder.terminal("!");
  const expr = builder.getBase("Expr");
  const unaryExpr = builder.getBase("UnaryExpr");

  // Expr → Expr "&&" Expr (short-circuit, lower precedence than comparison)
  const andPhrase = builder.phrase([expr, andOp, expr]);
  (andPhrase as any).attribute("val", Object, function (node: any) {
    return helpers.makeExpr(helpers.prim("typed_and"), [
      node.children[0].val,
      helpers.makeComposedFn([], node.children[2].val), // thunk for short-circuit
    ]);
  });
  builder.addAlternative("Expr", andPhrase);

  // Expr → Expr "||" Expr (short-circuit, lower precedence than comparison)
  const orPhrase = builder.phrase([expr, orOp, expr]);
  (orPhrase as any).attribute("val", Object, function (node: any) {
    return helpers.makeExpr(helpers.prim("typed_or"), [
      node.children[0].val,
      helpers.makeComposedFn([], node.children[2].val), // thunk for short-circuit
    ]);
  });
  builder.addAlternative("Expr", orPhrase);

  // UnaryExpr → "!" UnaryExpr
  const notPhrase = builder.phrase([notOp, unaryExpr]);
  (notPhrase as any).attribute("val", Object, function (node: any) {
    return helpers.makeExpr(helpers.prim("typed_not"), [node.children[1].val]);
  });
  builder.addAlternative("UnaryExpr", notPhrase);
}

// --- Type Annotations ---

interface ParamInfo {
  name: string;
  typeName: string;   // display name (e.g., "Array[Int]")
  typeExpr: any;       // expression that resolves to the type value
}

/**
 * Walk an expression body and wrap param references that have type annotations
 * with type_check(param, TypeExpression) calls.
 */
function wrapParamsWithChecks(
  body: any,
  owner: any,
  typedParams: Map<number, any>,  // position → type expression (Param or Expression)
  seen?: Set<any>,
): any {
  if (!body || typeof body !== "object") return body;
  if (!seen) seen = new Set();
  if (seen.has(body)) return body;
  seen.add(body);

  // Membership rather than the `owner` back-pointer — see `ownsParam` in
  // types.ts. `owner` is untyped here (grammar helpers), so the test is
  // written out rather than imported.
  if (body.kind === "Param" && owner?.params?.includes(body) && typedParams.has(body.position)) {
    const typeExpr = typedParams.get(body.position)!;
    return helpers.makeExpr(
      helpers.prim("type_check"),
      [body, typeExpr],
    );
  }

  if (body.kind === "Expression") {
    const newFn = wrapParamsWithChecks(body.fn, owner, typedParams, seen);
    const newArgs = body.args.map((a: any) => wrapParamsWithChecks(a, owner, typedParams, seen));
    if (newFn === body.fn && newArgs.every((a: any, i: number) => a === body.args[i])) return body;
    return helpers.makeExpr(newFn, newArgs);
  }

  if (body.kind === "ComposedFunction") {
    const newBody = wrapParamsWithChecks(body.body, owner, typedParams, seen);
    if (newBody === body.body) return body;
    return helpers.makeComposedFn(body.params, newBody);
  }

  return body;
}

/**
 * Build a typed function: wraps param references with type_check calls,
 * optionally wraps the return value with a type check, and wraps the
 * entire function with typed_function to attach a FunctionType.
 */
function buildTypedFn(
  params: ParamInfo[],
  body: any,
  returnTypeExpr: any | null,
): any {
  // 1. Build the base function with just param names
  const paramNames = params.map(p => p.name);
  const fn = helpers.buildFn(paramNames, body);

  // Type checking of params moved to call site (applyComposed).
  // No body-level wrapping needed.

  // 2. Wrap return with type_check if return type specified
  if (returnTypeExpr) {
    fn.body = helpers.makeExpr(
      helpers.prim("type_check"),
      [fn.body, returnTypeExpr],
    );
  }

  // 5. Wrap with typed_function to attach FunctionType
  // Args: [fn, paramCount, paramType1, ..., paramTypeN, returnType]
  const typeExprs = params.map(p => p.typeExpr ?? helpers.makeSymbol("Any"));
  const retExpr = returnTypeExpr ?? helpers.makeSymbol("Any");
  return helpers.makeExpr(
    helpers.prim("typed_function"),
    [fn, helpers.makeInt(params.length), ...typeExprs, retExpr],
  );
}

/**
 * Add type annotation syntax for function parameters and return types.
 * f(x: Int, y: String): Bool => body
 * (x: Int) => body
 * x: Int => body
 */
export function addTypeAnnotations(builder: GrammarBuilder): void {
  const colon = builder.terminal(":");
  const comma = builder.terminal(",");
  const lparen = builder.terminal("(");
  const rparen = builder.terminal(")");
  const arrow = builder.terminal(/=>/);
  const ident = builder.getBase("Ident");
  const fnBody = builder.getBase("FnBody");

  // TypeExpression: Ident or Ident "[" TypeExprList "]" for generics
  const lbracket = builder.terminal("[");
  const rbracket = builder.terminal("]");

  // Simple type: Ident (e.g., "Int", "String")
  const simpleTypeExpr = builder.phrase([ident]);
  (simpleTypeExpr as any).attribute("typeName", Object, function (node: any) {
    return node.children[0].text;
  });
  (simpleTypeExpr as any).attribute("typeExpr", Object, function (node: any) {
    // For type_apply: return a named param that resolves to the type
    return helpers.makeSymbol(node.children[0].text);
  });

  // Placeholder disjunction — we need to reference it before adding the generic alternative
  const typeExpression = builder.disjunction([simpleTypeExpr]);

  // Generic type: Ident "[" Repeat(TypeExpression, ",") "]" (e.g., "Array[Int]")
  const typeArgList = builder.repeat(typeExpression, { delimiter: comma });
  const genericTypeExpr = builder.phrase([ident, lbracket, typeArgList, rbracket]);
  (genericTypeExpr as any).attribute("typeName", Object, function (node: any) {
    // Compound name for display: "Array[Int]"
    const baseName = node.children[0].text;
    const argInfos = helpers.repChildren(node.children[2]);
    const argNames = argInfos.map((c: any) => c.typeName);
    return baseName + "[" + argNames.join(", ") + "]";
  });
  (genericTypeExpr as any).attribute("typeExpr", Object, function (node: any) {
    // Produce: type_apply(GenericType, arg1, arg2, ...)
    const base = helpers.makeSymbol(node.children[0].text);
    const argInfos = helpers.repChildren(node.children[2]);
    const args = argInfos.map((c: any) => c.typeExpr);
    return helpers.makeExpr(helpers.prim("type_apply"), [base, ...args]);
  });

  // Add generic alternative to the TypeExpression disjunction
  (typeExpression as any).add(genericTypeExpr);

  // Structural type: "~" TypeExpression (e.g., ~Animal)
  const tilde = builder.terminal("~");
  const structuralTypeExpr = builder.phrase([tilde, typeExpression]);
  (structuralTypeExpr as any).attribute("typeName", Object, function (node: any) {
    return "~" + node.children[1].typeName;
  });
  (structuralTypeExpr as any).attribute("typeExpr", Object, function (node: any) {
    return helpers.makeExpr(helpers.prim("structural_wrap"), [node.children[1].typeExpr]);
  });
  (typeExpression as any).add(structuralTypeExpr);

  // B-104 chunk 2: the union type production (`TypeExpression "|"
  // TypeExpression`) is removed here as it is in the grammar2 base, so the
  // legacy Earley path and the live parser agree on what a type expression
  // is. Redesign is B-105.

  // TypedParam: Ident ":" TypeExpression
  const typedParam = builder.phrase([ident, colon, typeExpression]);
  (typedParam as any).attribute("paramInfo", Object, function (node: any) {
    return {
      name: node.children[0].text,
      typeName: node.children[2].typeName,
      typeExpr: node.children[2].typeExpr,
    };
  });

  // TypedParamList: repeat(TypedParam, ",")
  const typedParamList = builder.repeat(typedParam, { delimiter: comma });

  // --- Named function: Ident "(" TypedParamList ")" "=>" FnBody ---
  const namedTypedFn = builder.phrase([ident, lparen, typedParamList, rparen, arrow, fnBody]);
  (namedTypedFn as any).attribute("binding", Object, function (node: any) {
    const name = node.children[0].text;
    const paramInfos = helpers.repChildren(node.children[2]).map((c: any) => c.paramInfo);
    const body = node.children[5].val;
    return { name, value: buildTypedFn(paramInfos, body, null) };
  });
  (namedTypedFn as any).attribute("val", Object, function () { return undefined; });
  builder.addAlternative("NamedFnDecl", namedTypedFn);

  // --- Named function with return type: Ident "(" TypedParamList ")" ":" TypeExpression "=>" FnBody ---
  const namedTypedFnRet = builder.phrase([ident, lparen, typedParamList, rparen, colon, typeExpression, arrow, fnBody]);
  (namedTypedFnRet as any).attribute("binding", Object, function (node: any) {
    const name = node.children[0].text;
    const paramInfos = helpers.repChildren(node.children[2]).map((c: any) => c.paramInfo);
    const returnTypeExpr = node.children[5].typeExpr;
    const body = node.children[7].val;
    return { name, value: buildTypedFn(paramInfos, body, returnTypeExpr) };
  });
  (namedTypedFnRet as any).attribute("val", Object, function () { return undefined; });
  builder.addAlternative("NamedFnDecl", namedTypedFnRet);

  // --- Multi-param lambda: "(" TypedParamList ")" "=>" FnBody ---
  const lambdaTyped = builder.phrase([lparen, typedParamList, rparen, arrow, fnBody]);
  (lambdaTyped as any).attribute("val", Object, function (node: any) {
    const paramInfos = helpers.repChildren(node.children[1]).map((c: any) => c.paramInfo);
    const body = node.children[4].val;
    return buildTypedFn(paramInfos, body, null);
  });
  builder.addAlternative("LambdaExpr", lambdaTyped);

  // --- Multi-param lambda with return type: "(" TypedParamList ")" ":" TypeExpression "=>" FnBody ---
  const lambdaTypedRet = builder.phrase([lparen, typedParamList, rparen, colon, typeExpression, arrow, fnBody]);
  (lambdaTypedRet as any).attribute("val", Object, function (node: any) {
    const paramInfos = helpers.repChildren(node.children[1]).map((c: any) => c.paramInfo);
    const returnTypeExpr = node.children[4].typeExpr;
    const body = node.children[6].val;
    return buildTypedFn(paramInfos, body, returnTypeExpr);
  });
  builder.addAlternative("LambdaExpr", lambdaTypedRet);

  // --- Single-param typed lambda: Ident ":" TypeExpression "=>" FnBody ---
  const singleTypedLambda = builder.phrase([ident, colon, typeExpression, arrow, fnBody]);
  (singleTypedLambda as any).attribute("val", Object, function (node: any) {
    const paramInfos = [{ name: node.children[0].text, typeName: node.children[2].typeName, typeExpr: node.children[2].typeExpr }];
    const body = node.children[4].val;
    return buildTypedFn(paramInfos, body, null);
  });
  builder.addAlternative("LambdaExpr", singleTypedLambda);
}

/**
 * Build Allegro Standard grammar extensions.
 * Uses type_dispatch for dot access (type-directed dispatch).
 * Includes bool/float literals, array/object literals, bracket access, logical ops, type annotations.
 */
export function buildAllegroStandardExtensions(): GrammarExtension {
  const builder = new GrammarBuilder();
  addDotAccess(builder, true); // type-directed dispatch
  addImport(builder);
  addFloatLiterals(builder);
  addArrayLiteral(builder);
  addObjectLiteral(builder);
  addBracketAccess(builder);
  addLogicalOps(builder);
  addTypeAnnotations(builder);
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

// =============================================================================
// Parser Combinator Factories (Phase 1 grammar extensions)
// Thin wrappers around Grammar class methods that return integer handles.
// Used by primitives.ts to expose parser combinators to Allegro code.
// =============================================================================

export interface GrammarFactoryOptions {
  whitespace?: string;
}

/** Build a fresh Grammar and return its handle. */
export function makeGrammarHandle(options?: GrammarFactoryOptions): number {
  const ws = options?.whitespace !== undefined ? new RegExp(options.whitespace) : undefined;
  const g = new Grammar(ws !== undefined ? { whitespace: ws } : {});
  return registryStore(g);
}

/** Create a Terminal. Pattern starting with "/" treated as regex source (strip slashes). */
export function makeTerminalHandle(gHandle: number, pattern: string): number {
  const g = registryGet(gHandle) as Grammar;
  // If pattern starts with "/" and ends with "/" treat middle as regex source
  let p: string | RegExp = pattern;
  if (pattern.length >= 2 && pattern.startsWith("/") && pattern.endsWith("/")) {
    p = new RegExp(pattern.slice(1, -1));
  }
  const t = g.terminal(p);
  return registryStore(t);
}

/** Create a Phrase from element handles. */
export function makePhraseHandle(gHandle: number, elementHandles: number[]): number {
  const g = registryGet(gHandle) as Grammar;
  const elements = elementHandles.map(h => registryGet(h) as GrammarElement);
  const p = g.phrase(elements);
  return registryStore(p);
}

/** Create a Disjunction (possibly empty for forward reference). */
export function makeChoiceHandle(gHandle: number, altHandles: number[]): number {
  const g = registryGet(gHandle) as Grammar;
  const alts = altHandles.map(h => registryGet(h) as GrammarElement);
  const d = g.disjunction(alts);
  return registryStore(d);
}

/** Append an alternative to an existing Disjunction (the recursion hook). */
export function addChoiceAlternative(disjunctionHandle: number, altHandle: number): number {
  const d = registryGet(disjunctionHandle) as Disjunction;
  const alt = registryGet(altHandle) as GrammarElement;
  d.add(alt);
  return disjunctionHandle;
}

/** Create a Repetition. */
export interface RepeatFactoryOptions {
  min?: number;
  max?: number;
  delimiter?: number;
}
export function makeRepeatHandle(gHandle: number, elementHandle: number, opts?: RepeatFactoryOptions): number {
  const g = registryGet(gHandle) as Grammar;
  const element = registryGet(elementHandle) as GrammarElement;
  const repeatOpts: any = {};
  if (opts?.min !== undefined) repeatOpts.min = opts.min;
  if (opts?.max !== undefined) repeatOpts.max = opts.max;
  if (opts?.delimiter !== undefined) repeatOpts.delimiter = registryGet(opts.delimiter) as GrammarElement;
  const r = g.repeat(element, repeatOpts);
  return registryStore(r);
}

/** Create an Optional. */
export function makeOptionalHandle(gHandle: number, elementHandle: number): number {
  const g = registryGet(gHandle) as Grammar;
  const element = registryGet(elementHandle) as GrammarElement;
  const o = g.optional(element);
  return registryStore(o);
}

/** Set the target (start element) of a grammar. */
export function setGrammarTarget(gHandle: number, elementHandle: number): number {
  const g = registryGet(gHandle) as Grammar;
  const element = registryGet(elementHandle) as GrammarElement;
  g.target = element;
  return gHandle;
}

/**
 * Parse an input string with a grammar, returning a tree of Allegro values.
 * On parse failure, returns an Allegro error value.
 */
export function parseGrammarToAllegro(gHandle: number, input: string): Value {
  const g = registryGet(gHandle) as Grammar;
  const result = parseGrammar(g, input);
  if (result.errors.length > 0) {
    const err = result.errors[0];
    const msg = `parse error at ${err.start.line}:${err.start.column}: ${err.message}`;
    const meta = new Map<string, Value>();
    meta.set("error", withType(stringToBits(msg), StringType));
    meta.set("type", ErrorType);
    return makeInt(0, meta);
  }
  return syntaxTreeToAllegroValue(result.tree);
}

/**
 * Convert a SyntaxTreeNode to an Allegro value, guided by the node's element type.
 *
 * Terminal    → String (matched text)
 * Phrase      → Array of children's values (positional)
 * Disjunction → Transparent: unwrap to the single matched alternative's value
 * Repetition  → Array of body values, delimiters stripped
 * Optional    → child value or `none`
 */
export function syntaxTreeToAllegroValue(node: SyntaxTreeNode): Value {
  const element = node.element;

  if (element instanceof Terminal) {
    return withType(stringToBits(node.text), StringType);
  }

  if (element instanceof Phrase) {
    const childVals: Value[] = node.children.map(c => syntaxTreeToAllegroValue(c));
    return makeArray(childVals);
  }

  if (element instanceof Disjunction) {
    // Transparent — unwrap to the single matched alternative's value.
    // A matched disjunction has exactly one child (the chosen alternative's node).
    if (node.children.length === 0) return noneSingleton as Value;
    return syntaxTreeToAllegroValue(node.children[0]);
  }

  if (element instanceof Repetition) {
    // Use parser's repetition flattening: includes body elements, excludes delimiters.
    const bodies = parserRepChildren(node) as SyntaxTreeNode[];
    const childVals = bodies.map(c => syntaxTreeToAllegroValue(c));
    return makeArray(childVals);
  }

  if (element instanceof Optional) {
    if (node.children.length === 0) return noneSingleton as Value;
    return syntaxTreeToAllegroValue(node.children[0]);
  }

  // Fallback: treat as phrase-like
  const childVals: Value[] = node.children.map(c => syntaxTreeToAllegroValue(c));
  return makeArray(childVals);
}
