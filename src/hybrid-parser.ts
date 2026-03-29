// =============================================================================
// Allegro — Hybrid Parser (Pratt + Recursive Descent)
// Fast path for Allegro Standard. Earley fallback for standalone grammars.
// =============================================================================

import { Lexer, TokenType, Token, LexerConfig, createBaseLexerConfig } from "./lexer.js";
import {
  makeInt, makeExpr, makeParam, makeSymbol, makeComposedFn, makeContext,
  prim, buildFn, substName, bind, extractString, stringToBits,
} from "./parser-helpers.js";

// --- Parse result (same interface as Earley parser) ---

export interface ParseError {
  message: string;
  start: { index: number; line: number; column: number };
  end: { index: number; line: number; column: number };
}

export interface ParseResult {
  tree: any;
  errors: ParseError[];
}

// --- Pratt parser types ---

type PrefixParseFn = (parser: HybridParser, token: Token) => any;
type InfixParseFn = (parser: HybridParser, left: any, token: Token) => any;

interface InfixParselet {
  bp: number;
  parse: InfixParseFn;
}

// --- Grammar configuration ---

export interface HybridGrammarConfig {
  prefixParselets: Map<TokenType, PrefixParseFn>;
  infixParselets: Map<TokenType, InfixParselet>;
  lexerConfig: LexerConfig;
  /** If true, dot access uses type_dispatch; otherwise ctx_resolve */
  typed: boolean;
}

// --- The Parser ---

export class HybridParser {
  lexer: Lexer;
  errors: ParseError[] = [];
  private config: HybridGrammarConfig;

  constructor(input: string, config: HybridGrammarConfig) {
    this.config = config;
    this.lexer = new Lexer(input, config.lexerConfig);
  }

  // --- Public API ---

  parseFile(): ParseResult {
    const ctx = makeContext();

    while (!this.lexer.isAtEnd()) {
      // Skip newlines between statements
      while (this.lexer.match(TokenType.Newline)) {}
      if (this.lexer.isAtEnd()) break;

      try {
        this.parseStatement(ctx);
      } catch (e: any) {
        this.errors.push({
          message: e.message,
          start: { index: 0, line: this.lexer.peek().line, column: this.lexer.peek().column },
          end: { index: 0, line: this.lexer.peek().line, column: this.lexer.peek().column },
        });
        // Error recovery: skip to next newline
        this.skipToNewline();
      }
    }

    return { tree: { ctx }, errors: this.errors };
  }

  // --- Statement parsing (recursive descent) ---

  private parseStatement(ctx: any): void {
    const tok = this.lexer.peek();

    // Import declaration
    if (tok.type === TokenType.Import) {
      this.lexer.next();
      const name = this.lexer.expect(TokenType.Ident, "after 'import'");
      bind(ctx, name.text, undefined);
      return;
    }

    // Export declaration: export binding = value
    if (tok.type === TokenType.Export) {
      this.lexer.next();
      const name = this.lexer.expect(TokenType.Ident, "after 'export'");
      // Named function: export f(x) => ...
      if (this.lexer.peek().type === TokenType.LParen) {
        const value = this.parseNamedFnBody(name.text);
        // Wrap with export marker
        const exported = makeExpr(prim("export"), [value]);
        bind(ctx, name.text, exported);
        return;
      }
      // Assignment: export x = ...
      this.lexer.expect(TokenType.Eq, "after export name");
      const value = this.parseExpression(0);
      const exported = makeExpr(prim("export"), [value]);
      bind(ctx, name.text, exported);
      return;
    }

    // Identifier: could be assignment, named function declaration, or bare expression
    if (tok.type === TokenType.Ident) {
      // Look ahead to disambiguate
      const next = this.lexer.peekAt(1);

      // Named function: ident ( ...
      if (next.type === TokenType.LParen) {
        // Could be fn declaration or function call. Check if it's fn decl by looking for =>
        if (this.isNamedFnDecl()) {
          this.lexer.next(); // consume ident
          const value = this.parseNamedFnBody(tok.text);
          bind(ctx, tok.text, value);
          return;
        }
      }

      // Typed binding: ident : Type = ... (but not ident : Type => which is typed lambda)
      if (next.type === TokenType.Colon) {
        // Peek further: if there's an = after the type expression, it's a typed binding
        // Save state and try to parse as typed binding
        const saved = this.lexer.save();
        this.lexer.next(); // consume ident
        this.lexer.next(); // consume :
        try {
          const typeExpr = this.parseTypeExpr();
          if (this.lexer.peek().type === TokenType.Eq) {
            this.lexer.next(); // consume =
            const value = this.parseFnBody();
            // Wrap value with type_check_binding
            const checked = makeExpr(prim("type_check_binding"), [value, typeExpr]);
            bind(ctx, tok.text, checked);
            return;
          }
        } catch {}
        // Not a typed binding — restore and fall through
        this.lexer.restore(saved);
      }

      // Assignment: ident = ... (but not ==)
      if (next.type === TokenType.Eq) {
        this.lexer.next(); // consume ident
        this.lexer.next(); // consume =
        const value = this.parseFnBody();
        bind(ctx, tok.text, value);
        return;
      }
    }

    // Bare expression
    const value = this.parseExpression(0);
    ctx.bindingList.push({ key: null, value, isUse: false });
  }

  /** Check if current position is a named function declaration (ident(...) [: Type] =>) */
  private isNamedFnDecl(): boolean {
    // Save position
    const savedIdx = (this.lexer as any).tokenIdx;
    try {
      this.lexer.next(); // skip ident
      this.lexer.next(); // skip (
      let depth = 1;
      while (depth > 0 && !this.lexer.isAtEnd()) {
        const t = this.lexer.next();
        if (t.type === TokenType.LParen) depth++;
        else if (t.type === TokenType.RParen) depth--;
      }
      // After ), check for optional : Type then =>
      if (this.lexer.peek().type === TokenType.Colon) {
        this.lexer.next(); // skip :
        this.skipTypeExpr(); // skip type expression
      }
      return this.lexer.peek().type === TokenType.Arrow;
    } finally {
      (this.lexer as any).tokenIdx = savedIdx;
    }
  }

  private skipTypeExpr(): void {
    this.lexer.next(); // skip type name
    if (this.lexer.peek().type === TokenType.LBracket) {
      this.lexer.next(); // [
      let depth = 1;
      while (depth > 0 && !this.lexer.isAtEnd()) {
        const t = this.lexer.next();
        if (t.type === TokenType.LBracket) depth++;
        else if (t.type === TokenType.RBracket) depth--;
      }
    }
  }

  // --- Named function body parsing ---

  private parseNamedFnBody(name: string): any {
    this.lexer.expect(TokenType.LParen);
    const { params, typedParams, hasTypes } = this.parseParamList();
    this.lexer.expect(TokenType.RParen);

    let returnTypeExpr: any = null;
    if (this.lexer.peek().type === TokenType.Colon) {
      this.lexer.next();
      returnTypeExpr = this.parseTypeExpr();
    }

    this.lexer.expect(TokenType.Arrow);
    const body = this.parseFnBody();

    if (hasTypes) {
      return this.buildTypedFn(typedParams, body, returnTypeExpr);
    }
    return buildFn(params, body);
  }

  // --- Parameter list parsing ---

  private parseParamList(): {
    params: string[];
    typedParams: { name: string; typeExpr: any }[];
    hasTypes: boolean;
  } {
    const params: string[] = [];
    const typedParams: { name: string; typeExpr: any }[] = [];
    let hasTypes = false;

    if (this.lexer.peek().type === TokenType.RParen) {
      return { params, typedParams, hasTypes };
    }

    do {
      const ident = this.lexer.expect(TokenType.Ident, "in parameter list");
      params.push(ident.text);
      if (this.lexer.peek().type === TokenType.Colon) {
        this.lexer.next();
        hasTypes = true;
        typedParams.push({ name: ident.text, typeExpr: this.parseTypeExpr() });
      } else {
        typedParams.push({ name: ident.text, typeExpr: null });
      }
    } while (this.lexer.match(TokenType.Comma));

    return { params, typedParams, hasTypes };
  }

  // --- Type expression parsing ---

  parseTypeExpr(): any {
    let typeExpr = this.parseTypeExprAtom();

    // Union: Type | Type | ...
    while (this.lexer.peek().type === TokenType.Pipe) {
      this.lexer.next(); // consume |
      const right = this.parseTypeExprAtom();
      typeExpr = makeExpr(prim("type_union"), [typeExpr, right]);
    }

    return typeExpr;
  }

  private parseTypeExprAtom(): any {
    // Structural prefix: ~Type
    if (this.lexer.peek().type === TokenType.Tilde) {
      this.lexer.next(); // consume ~
      const inner = this.parseTypeExprAtom();
      return makeExpr(prim("structural_wrap"), [inner]);
    }

    const name = this.lexer.expect(TokenType.Ident, "in type expression");
    let base: any = makeSymbol(name.text);

    // Generic: Type[Arg1, Arg2, ...]
    if (this.lexer.peek().type === TokenType.LBracket) {
      this.lexer.next();
      const args: any[] = [];
      if (this.lexer.peek().type !== TokenType.RBracket) {
        do {
          args.push(this.parseTypeExpr());
        } while (this.lexer.match(TokenType.Comma));
      }
      this.lexer.expect(TokenType.RBracket, "after generic type arguments");
      base = makeExpr(prim("type_apply"), [base, ...args]);
    }

    return base;
  }

  // --- Typed function construction ---

  private buildTypedFn(
    typedParams: { name: string; typeExpr: any }[],
    body: any,
    returnTypeExpr: any | null,
  ): any {
    const paramNames = typedParams.map(p => p.name);
    const fn = buildFn(paramNames, body);

    // Type checking moved to call site (applyComposed checks arg types
    // against FunctionType param types). No body-level wrapping needed.

    // Return type check stays in body — validates output
    if (returnTypeExpr) {
      fn.body = makeExpr(prim("type_check"), [fn.body, returnTypeExpr]);
    }

    // Wrap with typed_function
    const typeExprs = typedParams.map(p => p.typeExpr ?? makeSymbol("Any"));
    const retExpr = returnTypeExpr ?? makeSymbol("Any");
    return makeExpr(prim("typed_function"), [fn, makeInt(typedParams.length), ...typeExprs, retExpr]);
  }

  private wrapParamsWithChecks(body: any, owner: any, typedMap: Map<number, any>, seen: Set<any>): any {
    if (!body || typeof body !== "object" || seen.has(body)) return body;
    seen.add(body);

    if (body.kind === "Param" && body.owner === owner && typedMap.has(body.position)) {
      return makeExpr(prim("type_check"), [body, typedMap.get(body.position)!]);
    }
    if (body.kind === "Expression") {
      const newFn = this.wrapParamsWithChecks(body.fn, owner, typedMap, seen);
      const newArgs = body.args.map((a: any) => this.wrapParamsWithChecks(a, owner, typedMap, seen));
      if (newFn === body.fn && newArgs.every((a: any, i: number) => a === body.args[i])) return body;
      return makeExpr(newFn, newArgs);
    }
    if (body.kind === "ComposedFunction") {
      const newBody = this.wrapParamsWithChecks(body.body, owner, typedMap, seen);
      if (newBody === body.body) return body;
      return makeComposedFn(body.params, newBody);
    }
    return body;
  }

  // --- Function body (expression or indented block) ---

  parseFnBody(): any {
    // Check for indented block
    if (this.lexer.peek().type === TokenType.Newline && this.lexer.peekAt(1).type === TokenType.Indent) {
      this.lexer.next(); // newline
      this.lexer.next(); // indent
      return this.parseBlock();
    }
    return this.parseExpression(0);
  }

  private parseBlock(): any {
    const bindings: { name: string; value: any }[] = [];

    while (this.lexer.peek().type !== TokenType.Unindent && !this.lexer.isAtEnd()) {
      while (this.lexer.match(TokenType.Newline)) {}
      if (this.lexer.peek().type === TokenType.Unindent || this.lexer.isAtEnd()) break;

      const tok = this.lexer.peek();

      // Check if this is a binding (ident = ...) or named function
      if (tok.type === TokenType.Ident) {
        const next = this.lexer.peekAt(1);
        // Named function in block
        if (next.type === TokenType.LParen && this.isNamedFnDecl()) {
          const name = this.lexer.next().text;
          const value = this.parseNamedFnBody(name);
          bindings.push({ name, value });
          continue;
        }
        // Assignment
        if (next.type === TokenType.Eq) {
          const name = this.lexer.next().text;
          this.lexer.next(); // =
          const value = this.parseFnBody();
          bindings.push({ name, value });
          continue;
        }
      }

      // Last expression in block
      const expr = this.parseExpression(0);
      this.lexer.match(TokenType.Newline);
      this.lexer.expect(TokenType.Unindent, "at end of block");

      // Substitute bindings into the result
      let result = expr;
      for (let i = bindings.length - 1; i >= 0; i--) {
        result = substName(result, bindings[i].name, bindings[i].value);
        // Also substitute into subsequent bindings
        for (let j = i + 1; j < bindings.length; j++) {
          bindings[j].value = substName(bindings[j].value, bindings[i].name, bindings[i].value);
        }
      }
      return result;
    }

    this.lexer.match(TokenType.Unindent);
    // If we got here without a final expression, use the last binding's value
    if (bindings.length > 0) {
      return bindings[bindings.length - 1].value;
    }
    throw new Error("Empty block");
  }

  // --- Pratt expression parser ---

  parseExpression(minBP: number): any {
    // Prefix
    const token = this.lexer.next();
    const prefix = this.config.prefixParselets.get(token.type);
    if (!prefix) {
      throw new Error(
        `Parse error at line ${token.line}, column ${token.column}: unexpected ${token.type === TokenType.EOF ? "end of input" : `'${token.text}'`}`
      );
    }
    let left = prefix(this, token);

    // Infix loop
    while (true) {
      const next = this.lexer.peek();
      const infix = this.config.infixParselets.get(next.type);
      if (!infix || infix.bp < minBP) break;
      this.lexer.next();
      left = infix.parse(this, left, next);
    }

    return left;
  }

  // --- Error recovery ---

  private skipToNewline(): void {
    while (!this.lexer.isAtEnd()) {
      const tok = this.lexer.next();
      if (tok.type === TokenType.Newline || tok.type === TokenType.EOF) break;
    }
  }
}

// =============================================================================
// Pattern parsing for when/is/then
// =============================================================================

interface PatternResult {
  pattern: any;
  bindingNames: string[];
}

/**
 * Parse a field spec in a destructuring pattern: `name` or `name: binding`.
 * Returns [fieldName, bindingName].
 */
function parseFieldSpec(parser: HybridParser): [string, string] {
  const name = parser.lexer.expect(TokenType.Ident, "in destructuring pattern");
  if (parser.lexer.peek().type === TokenType.Colon) {
    parser.lexer.next(); // consume :
    const binding = parser.lexer.expect(TokenType.Ident, "after ':' in pattern field");
    return [name.text, binding.text];
  }
  return [name.text, name.text]; // same-name binding
}

/**
 * Parse a pattern in a when/is/then expression.
 * Returns the pattern value and binding names for the then-branch.
 *
 * Patterns:
 * - `_` → wildcard (always matches)
 * - Integer/String/true/false → literal match
 * - Identifier → Symbol (resolve-first: in scope → literal match; unknown → binding)
 * - `Ident(field, ...)` → type destructuring (nominal)
 * - `{field, ...}` → structural destructuring
 */
function parsePattern(parser: HybridParser): PatternResult {
  const tok = parser.lexer.peek();

  if (tok.type === TokenType.Ident && tok.text === "_") {
    parser.lexer.next();
    return { pattern: makeExpr(prim("when_wildcard"), []), bindingNames: [] };
  }

  if (tok.type === TokenType.Int) {
    parser.lexer.next();
    if (tok.text.startsWith("0x") || tok.text.startsWith("0X")) {
      return { pattern: makeInt(parseInt(tok.text, 16)), bindingNames: [] };
    }
    if (tok.text.startsWith("0b") || tok.text.startsWith("0B")) {
      return { pattern: makeInt(parseInt(tok.text.slice(2), 2)), bindingNames: [] };
    }
    return { pattern: makeInt(parseInt(tok.text, 10)), bindingNames: [] };
  }

  if (tok.type === TokenType.String) {
    parser.lexer.next();
    return { pattern: stringToBits(extractString(tok.text)), bindingNames: [] };
  }

  if (tok.type === TokenType.True) {
    parser.lexer.next();
    return { pattern: makeSymbol("true"), bindingNames: [] };
  }

  if (tok.type === TokenType.False) {
    parser.lexer.next();
    return { pattern: makeSymbol("false"), bindingNames: [] };
  }

  if (tok.type === TokenType.None) {
    parser.lexer.next();
    return { pattern: makeSymbol("none"), bindingNames: [] };
  }

  if (tok.type === TokenType.Minus) {
    parser.lexer.next();
    const numTok = parser.lexer.expect(TokenType.Int, "after '-' in pattern");
    return { pattern: makeExpr(prim("bits_sub"), [makeInt(0), makeInt(parseInt(numTok.text, 10))]), bindingNames: [] };
  }

  // Structural destructuring: {field, field: binding, ...}
  if (tok.type === TokenType.LBrace) {
    parser.lexer.next(); // consume {
    const fieldArgs: any[] = [];
    const bindingNames: string[] = [];
    if (parser.lexer.peek().type !== TokenType.RBrace) {
      do {
        const [fieldName, bindingName] = parseFieldSpec(parser);
        fieldArgs.push(stringToBits(fieldName), stringToBits(bindingName));
        bindingNames.push(bindingName);
      } while (parser.lexer.match(TokenType.Comma));
    }
    parser.lexer.expect(TokenType.RBrace, "after destructuring fields");
    return {
      pattern: makeExpr(prim("when_struct_destruct"), fieldArgs),
      bindingNames,
    };
  }

  if (tok.type === TokenType.Ident) {
    parser.lexer.next();

    // Type destructuring: Ident(field, field: binding, ...)
    if (parser.lexer.peek().type === TokenType.LParen) {
      parser.lexer.next(); // consume (
      const fieldArgs: any[] = [];
      const bindingNames: string[] = [];
      if (parser.lexer.peek().type !== TokenType.RParen) {
        do {
          const [fieldName, bindingName] = parseFieldSpec(parser);
          fieldArgs.push(stringToBits(fieldName), stringToBits(bindingName));
          bindingNames.push(bindingName);
        } while (parser.lexer.match(TokenType.Comma));
      }
      parser.lexer.expect(TokenType.RParen, "after type destructuring fields");
      return {
        pattern: makeExpr(prim("when_type_destruct"), [makeSymbol(tok.text), ...fieldArgs]),
        bindingNames,
      };
    }

    // Plain identifier — resolve-first binding
    return { pattern: makeSymbol(tok.text), bindingNames: [tok.text] };
  }

  throw new Error(`Parse error at line ${tok.line}: unexpected '${tok.text}' in pattern`);
}

// =============================================================================
// Base Allegro Grammar Configuration
// =============================================================================

function buildBaseGrammar(): HybridGrammarConfig {
  const prefix = new Map<TokenType, PrefixParseFn>();
  const infix = new Map<TokenType, InfixParselet>();

  // --- Prefix parselets ---

  // Integer literal
  prefix.set(TokenType.Int, (_parser, token) => {
    if (token.text.startsWith("0x") || token.text.startsWith("0X")) {
      return makeInt(parseInt(token.text, 16));
    }
    if (token.text.startsWith("0b") || token.text.startsWith("0B")) {
      return makeInt(parseInt(token.text.slice(2), 2));
    }
    return makeInt(parseInt(token.text, 10));
  });

  // Float literal
  prefix.set(TokenType.Float, (_parser, token) => {
    return makeExpr(prim("typed_float"), [stringToBits(token.text)]);
  });

  // String literal
  prefix.set(TokenType.String, (parser, token) => {
    let result: any = stringToBits(extractString(token.text));

    // Check for string interpolation: String InterpStart expr InterpEnd [String ...]
    if (parser.lexer.peek().type === TokenType.InterpStart) {
      // Wrap initial segment with typed_string for proper type dispatch
      result = makeExpr(prim("typed_string"), [result]);

      while (parser.lexer.peek().type === TokenType.InterpStart) {
        parser.lexer.next(); // consume InterpStart
        const expr = parser.parseExpression(0);
        parser.lexer.expect(TokenType.InterpEnd, "after interpolation expression");
        // Convert expression to string via toString, then concatenate
        const exprStr = makeExpr(prim("type_dispatch"), [expr, stringToBits("toString")]);
        const exprStrCalled = makeExpr(exprStr, []);
        result = makeExpr(prim("bits_add"), [result, exprStrCalled]);
        // Check for more string content after the interpolation
        if (parser.lexer.peek().type === TokenType.String) {
          const nextStr = parser.lexer.next();
          const nextBits = makeExpr(prim("typed_string"), [stringToBits(extractString(nextStr.text))]);
          result = makeExpr(prim("bits_add"), [result, nextBits]);
        }
      }
    }

    return result;
  });

  // Identifier
  prefix.set(TokenType.Ident, (parser, token) => {
    // Single-param lambda: ident => body OR ident : Type => body
    if (parser.lexer.peek().type === TokenType.Arrow) {
      parser.lexer.next(); // skip =>
      const body = parser.parseFnBody();
      return buildFn([token.text], body);
    }
    if (parser.lexer.peek().type === TokenType.Colon) {
      // Could be typed lambda: ident : Type => body
      const savedIdx = (parser.lexer as any).tokenIdx;
      parser.lexer.next(); // skip :
      // Check if this is followed by a type expression then =>
      const typeStart = parser.lexer.peek();
      if (typeStart.type === TokenType.Ident) {
        const typeExpr = parser.parseTypeExpr();
        if (parser.lexer.peek().type === TokenType.Arrow) {
          parser.lexer.next(); // skip =>
          const body = parser.parseFnBody();
          return parser['buildTypedFn'](
            [{ name: token.text, typeExpr }],
            body,
            null,
          );
        }
      }
      // Not a lambda — restore and return as identifier
      (parser.lexer as any).tokenIdx = savedIdx;
    }
    return makeSymbol(token.text);
  });

  // true / false / none → named params (resolved from context)
  prefix.set(TokenType.True, () => makeSymbol("true"));
  prefix.set(TokenType.False, () => makeSymbol("false"));
  prefix.set(TokenType.None, () => makeSymbol("none"));

  // error prefix — creates error MultiValue, or acts as identifier for "error of x"
  prefix.set(TokenType.ErrorKw, (parser) => {
    // "error of x" → component access, not error creation
    if (parser.lexer.peek().type === TokenType.Of) {
      return makeSymbol("error");
    }
    const value = parser.parseExpression(40); // binds tightly
    return makeExpr(prim("make_error"), [value]);
  });

  // Unary minus
  prefix.set(TokenType.Minus, (parser) => {
    const operand = parser.parseExpression(40);
    return makeExpr(prim("bits_sub"), [makeInt(0), operand]);
  });

  // Unary not
  prefix.set(TokenType.Not, (parser) => {
    const operand = parser.parseExpression(40);
    return makeExpr(prim("typed_not"), [operand]);
  });

  // Parenthesized expression or lambda
  prefix.set(TokenType.LParen, (parser) => {
    // Try to parse as lambda: () => body, (params) => body, (typed params) [: retType] => body
    if (parser.lexer.peek().type === TokenType.RParen) {
      parser.lexer.next(); // skip )
      // Zero-param lambda: () => body OR () : Type => body
      if (parser.lexer.peek().type === TokenType.Colon || parser.lexer.peek().type === TokenType.Arrow) {
        let returnTypeExpr: any = null;
        if (parser.lexer.peek().type === TokenType.Colon) {
          parser.lexer.next();
          returnTypeExpr = parser.parseTypeExpr();
        }
        parser.lexer.expect(TokenType.Arrow, "after ()");
        const body = parser.parseFnBody();
        if (returnTypeExpr) {
          return parser['buildTypedFn']([], body, returnTypeExpr);
        }
        return buildFn([], body);
      }
      // Empty parens followed by something else — error
      throw new Error(`Parse error at line ${parser.lexer.peek().line}: unexpected token after ()`);
    }

    // Try as lambda parameter list (speculatively)
    const savedIdx = (parser.lexer as any).tokenIdx;
    try {
      const { params, typedParams, hasTypes } = parser['parseParamList']();
      parser.lexer.expect(TokenType.RParen);
      // Check for optional return type then =>
      let returnTypeExpr: any = null;
      if (parser.lexer.peek().type === TokenType.Colon) {
        parser.lexer.next();
        returnTypeExpr = parser.parseTypeExpr();
      }
      if (parser.lexer.peek().type === TokenType.Arrow) {
        parser.lexer.next();
        const body = parser.parseFnBody();
        if (hasTypes || returnTypeExpr) {
          return parser['buildTypedFn'](typedParams, body, returnTypeExpr);
        }
        return buildFn(params, body);
      }
      // Not a lambda — fall through to paren expression
    } catch {
      // Not a valid param list — fall through
    }

    // Restore and parse as parenthesized expression
    (parser.lexer as any).tokenIdx = savedIdx;
    const expr = parser.parseExpression(0);
    parser.lexer.expect(TokenType.RParen, "after parenthesized expression");
    return expr;
  });

  // If-then-else
  prefix.set(TokenType.If, (parser) => {
    const cond = parser.parseExpression(0);
    parser.lexer.expect(TokenType.Then, "after if condition");
    const thenBranch = parser.parseExpression(0);
    parser.lexer.expect(TokenType.Else, "after then branch");
    const elseBranch = parser.parseExpression(0);
    // Wrap branches in thunks (zero-param ComposedFunction)
    return makeExpr(prim("eval_if"), [
      cond,
      makeComposedFn([], thenBranch),
      makeComposedFn([], elseBranch),
    ]);
  });

  // When-is-then (pattern matching)
  prefix.set(TokenType.When, (parser) => {
    const subject = parser.parseExpression(0);

    // Helper: build then-branch function from binding names
    const makeThenFn = (names: string[], body: any) =>
      names.length > 0 ? buildFn(names, body) : makeComposedFn([], body);

    // Multi-case: when expr NEWLINE INDENT (is pattern then branch)+ UNINDENT
    if (parser.lexer.peek().type === TokenType.Newline && parser.lexer.peekAt(1).type === TokenType.Indent) {
      parser.lexer.next(); // newline
      parser.lexer.next(); // indent

      const cases: { pattern: any; body: any; bindingNames: string[] }[] = [];

      while (parser.lexer.peek().type !== TokenType.Unindent && !parser.lexer.isAtEnd()) {
        while (parser.lexer.match(TokenType.Newline)) {}
        if (parser.lexer.peek().type === TokenType.Unindent || parser.lexer.isAtEnd()) break;

        parser.lexer.expect(TokenType.Is, "in when case");
        const { pattern, bindingNames } = parsePattern(parser);
        parser.lexer.expect(TokenType.Then, "after pattern");
        const body = parser.parseFnBody();
        cases.push({ pattern, body, bindingNames });
      }
      parser.lexer.match(TokenType.Unindent);

      if (cases.length === 0) throw new Error("Parse error: empty when expression");

      // Desugar from last to first into nested eval_when
      let result: any = makeExpr(prim("when_no_match"), [subject]);
      for (let i = cases.length - 1; i >= 0; i--) {
        const c = cases[i];
        result = makeExpr(prim("eval_when"), [
          subject,
          c.pattern,
          makeThenFn(c.bindingNames, c.body),
          makeComposedFn([], result),
        ]);
      }
      return result;
    }

    // Inline: when expr is pattern then branch [else branch]
    parser.lexer.expect(TokenType.Is, "after when expression");
    const { pattern, bindingNames } = parsePattern(parser);
    parser.lexer.expect(TokenType.Then, "after pattern");
    const thenBranch = parser.parseExpression(0);
    let elseBranch: any;
    if (parser.lexer.peek().type === TokenType.Else) {
      parser.lexer.next();
      elseBranch = parser.parseExpression(0);
    } else {
      elseBranch = makeExpr(prim("when_no_match"), [subject]);
    }

    return makeExpr(prim("eval_when"), [
      subject,
      pattern,
      makeThenFn(bindingNames, thenBranch),
      makeComposedFn([], elseBranch),
    ]);
  });

  // Array literal
  prefix.set(TokenType.LBracket, (parser) => {
    const elements: any[] = [];
    if (parser.lexer.peek().type !== TokenType.RBracket) {
      do {
        elements.push(parser.parseExpression(0));
      } while (parser.lexer.match(TokenType.Comma));
    }
    parser.lexer.expect(TokenType.RBracket, "after array elements");
    return makeExpr(prim("typed_array"), elements);
  });

  // Object literal
  prefix.set(TokenType.LBrace, (parser) => {
    const args: any[] = [];
    if (parser.lexer.peek().type !== TokenType.RBrace) {
      do {
        const key = parser.lexer.expect(TokenType.Ident, "in object literal");
        parser.lexer.expect(TokenType.Colon, "after object key");
        const value = parser.parseExpression(0);
        args.push(stringToBits(key.text));
        args.push(value);
      } while (parser.lexer.match(TokenType.Comma));
    }
    parser.lexer.expect(TokenType.RBrace, "after object fields");
    return makeExpr(prim("typed_object"), args);
  });

  // --- Infix parselets ---

  // Binary operators
  const binaryOp = (name: string, bp: number): InfixParselet => ({
    bp,
    parse: (parser, left) => {
      const right = parser.parseExpression(bp + 1); // left-assoc
      return makeExpr(prim(name), [left, right]);
    },
  });

  // Non-associative comparison (no chaining)
  const compareOp = (name: string): InfixParselet => ({
    bp: 10,
    parse: (parser, left) => {
      const right = parser.parseExpression(11); // no chaining
      return makeExpr(prim(name), [left, right]);
    },
  });

  infix.set(TokenType.Plus, binaryOp("bits_add", 20));
  infix.set(TokenType.Minus, binaryOp("bits_sub", 20));
  infix.set(TokenType.Star, binaryOp("bits_mul", 30));
  infix.set(TokenType.Slash, binaryOp("bits_div", 30));
  infix.set(TokenType.Percent, binaryOp("bits_mod", 30));

  infix.set(TokenType.EqEq, compareOp("bits_eq"));
  infix.set(TokenType.BangEq, {
    bp: 10,
    parse: (parser, left) => {
      const right = parser.parseExpression(11);
      return makeExpr(prim("bits_neq"), [left, right]);
    },
  });
  infix.set(TokenType.Lt, compareOp("bits_lt"));
  infix.set(TokenType.Gt, compareOp("bits_gt"));
  infix.set(TokenType.LtEq, compareOp("bits_lte"));
  infix.set(TokenType.GtEq, compareOp("bits_gte"));

  // Logical operators (short-circuit — right operand thunked)
  infix.set(TokenType.And, {
    bp: 5,
    parse: (parser, left) => {
      const right = parser.parseExpression(5);
      return makeExpr(prim("typed_and"), [left, makeComposedFn([], right)]);
    },
  });
  infix.set(TokenType.Or, {
    bp: 5,
    parse: (parser, left) => {
      const right = parser.parseExpression(5);
      return makeExpr(prim("typed_or"), [left, makeComposedFn([], right)]);
    },
  });

  // Function call
  infix.set(TokenType.LParen, {
    bp: 50,
    parse: (parser, left) => {
      const args: any[] = [];
      if (parser.lexer.peek().type !== TokenType.RParen) {
        do {
          args.push(parser.parseExpression(0));
        } while (parser.lexer.match(TokenType.Comma));
      }
      parser.lexer.expect(TokenType.RParen, "after function arguments");
      return makeExpr(left, args);
    },
  });

  // Dot access
  infix.set(TokenType.Dot, {
    bp: 50,
    parse: (parser, left, _token) => {
      // Check if next is a digit (float continuation like 3.14 already handled by lexer)
      const field = parser.lexer.expect(TokenType.Ident, "after '.'");
      const dispatchPrim = parser['config'].typed ? "type_dispatch" : "ctx_resolve";
      return makeExpr(prim(dispatchPrim), [left, stringToBits(field.text)]);
    },
  });

  // MultiValue component access: "type of x" → mv_get(x, "type")
  infix.set(TokenType.Of, {
    bp: 45,
    parse: (parser, left) => {
      // Left must be an identifier (Symbol) — the component name
      if (left.kind !== "Symbol") {
        throw new Error(`Parse error: expected identifier before 'of', got ${left.kind}`);
      }
      const right = parser.parseExpression(46); // right-associative
      return makeExpr(prim("component_get"), [right, stringToBits(left.name)]);
    },
  });

  // Bracket access
  infix.set(TokenType.LBracket, {
    bp: 50,
    parse: (parser, left) => {
      const index = parser.parseExpression(0);
      parser.lexer.expect(TokenType.RBracket, "after bracket index");
      const dispatch = makeExpr(prim("type_dispatch"), [left, stringToBits("get")]);
      return makeExpr(dispatch, [index]);
    },
  });

  return {
    prefixParselets: prefix,
    infixParselets: infix,
    lexerConfig: createBaseLexerConfig(),
    typed: false,
  };
}

// =============================================================================
// Standard Grammar (extends base with typed dispatch)
// =============================================================================

function buildStandardGrammar(): HybridGrammarConfig {
  const base = buildBaseGrammar();
  return { ...base, typed: true };
}

// --- Cached configs ---

let _baseConfig: HybridGrammarConfig | null = null;
let _stdConfig: HybridGrammarConfig | null = null;

export function getBaseGrammarConfig(): HybridGrammarConfig {
  if (!_baseConfig) _baseConfig = buildBaseGrammar();
  return _baseConfig;
}

export function getStandardGrammarConfig(): HybridGrammarConfig {
  if (!_stdConfig) _stdConfig = buildStandardGrammar();
  return _stdConfig;
}

// =============================================================================
// Public parse functions (match Earley parser interface)
// =============================================================================

/** Parse source in base mode */
export function parseBase(input: string): ParseResult {
  const parser = new HybridParser(input, getBaseGrammarConfig());
  return parser.parseFile();
}

/** Parse source in standard mode (type-directed dispatch) */
export function parseStandard(input: string): ParseResult {
  const parser = new HybridParser(input, getStandardGrammarConfig());
  return parser.parseFile();
}

/** Parse source with a custom grammar configuration */
export function parseWithConfig(input: string, config: HybridGrammarConfig): ParseResult {
  const parser = new HybridParser(input, config);
  return parser.parseFile();
}
