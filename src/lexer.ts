// =============================================================================
// Allegro — Lexer
// Tokenizer with maximal munch, keyword disambiguation, float vs integer,
// source location tracking, and indentation (offside rule) support.
// =============================================================================

// --- Token Types ---

export enum TokenType {
  // Literals
  Int,            // [0-9]+ or 0x[0-9a-fA-F]+ or 0b[01]+
  Float,          // [0-9]+.[0-9]+
  String,         // "..."

  // Identifiers and keywords
  Ident,          // [a-zA-Z_][a-zA-Z0-9_]* (not a keyword)
  If, Then, Else,
  When, Is, Of,
  Import, Export,
  True, False, None, ErrorKw,
  Instanceof, Subtypeof,

  // Operators
  Plus, Minus, Star, Slash, Percent,
  Eq, EqEq, BangEq, Tilde, Pipe,
  Lt, Gt, LtEq, GtEq,
  Arrow,          // =>
  And, Or, Not,   // &&, ||, !
  Dot,

  // Delimiters
  LParen, RParen, LBracket, RBracket, LBrace, RBrace,
  Comma, Colon,

  // Indentation (virtual tokens)
  Newline,
  Indent,
  Unindent,

  // String interpolation
  InterpStart,    // start of interpolation expression within a string
  InterpEnd,      // end of interpolation expression (closing })

  // End
  EOF,
}

// --- Token ---

export interface Token {
  type: TokenType;
  text: string;
  line: number;
  column: number;
  offset: number;
}

// --- Lexer Configuration ---

/**
 * Configures the lexer's keyword and operator tables.
 * Grammar extensions add new entries here to make the lexer
 * recognize new tokens without modifying lexer code.
 */
export interface LexerConfig {
  keywords: Map<string, TokenType>;
  /** Operators sorted longest-first for maximal munch */
  operators: [string, TokenType][];
}

/** Base keywords (always available) */
export const BASE_KEYWORDS = new Map<string, TokenType>([
  ["if", TokenType.If],
  ["then", TokenType.Then],
  ["else", TokenType.Else],
  ["when", TokenType.When],
  ["is", TokenType.Is],
  ["of", TokenType.Of],
  ["import", TokenType.Import],
  ["export", TokenType.Export],
  ["true", TokenType.True],
  ["false", TokenType.False],
  ["none", TokenType.None],
  ["error", TokenType.ErrorKw],
  ["instanceof", TokenType.Instanceof],
  ["subtypeof", TokenType.Subtypeof],
  ["and", TokenType.And],
  ["or", TokenType.Or],
]);

/** Base operators (always available), sorted longest-first */
export const BASE_OPERATORS: [string, TokenType][] = [
  ["=>", TokenType.Arrow],
  ["==", TokenType.EqEq],
  ["!=", TokenType.BangEq],
  ["<=", TokenType.LtEq],
  [">=", TokenType.GtEq],
  ["&&", TokenType.And],
  ["||", TokenType.Or],
  ["+", TokenType.Plus],
  ["-", TokenType.Minus],
  ["*", TokenType.Star],
  ["/", TokenType.Slash],
  ["%", TokenType.Percent],
  ["=", TokenType.Eq],
  ["<", TokenType.Lt],
  [">", TokenType.Gt],
  ["!", TokenType.Not],
  [".", TokenType.Dot],
  ["(", TokenType.LParen],
  [")", TokenType.RParen],
  ["[", TokenType.LBracket],
  ["]", TokenType.RBracket],
  ["{", TokenType.LBrace],
  ["}", TokenType.RBrace],
  [",", TokenType.Comma],
  [":", TokenType.Colon],
  ["~", TokenType.Tilde],
  ["|", TokenType.Pipe],
];

/** Create a default LexerConfig with base keywords and operators */
export function createBaseLexerConfig(): LexerConfig {
  return {
    keywords: new Map(BASE_KEYWORDS),
    operators: [...BASE_OPERATORS],
  };
}

/**
 * Extend a LexerConfig with additional keywords and operators.
 * Returns a new config (immutable layering).
 */
export function extendLexerConfig(
  base: LexerConfig,
  extra?: { keywords?: Map<string, TokenType>; operators?: [string, TokenType][] },
): LexerConfig {
  const keywords = new Map(base.keywords);
  const operators = [...base.operators];

  if (extra?.keywords) {
    for (const [k, v] of extra.keywords) keywords.set(k, v);
  }
  if (extra?.operators) {
    for (const op of extra.operators) {
      // Only add if not already present
      if (!operators.some(([text]) => text === op[0])) {
        operators.push(op);
      }
    }
    // Re-sort longest first for maximal munch
    operators.sort((a, b) => b[0].length - a[0].length);
  }

  return { keywords, operators };
}

// --- Lexer ---

export class Lexer {
  private input: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];
  private tokenIdx: number = 0;
  private config: LexerConfig;

  // Indentation tracking
  private indentStack: number[] = [0];
  private atLineStart: boolean = true;
  private pendingTokens: Token[] = [];

  constructor(input: string, config?: LexerConfig) {
    this.input = input;
    this.config = config ?? createBaseLexerConfig();
    this.tokenizeAll();
  }

  peek(): Token {
    if (this.tokenIdx >= this.tokens.length) {
      return { type: TokenType.EOF, text: "", line: this.line, column: this.column, offset: this.pos };
    }
    return this.tokens[this.tokenIdx];
  }

  peekAt(offset: number): Token {
    const idx = this.tokenIdx + offset;
    if (idx >= this.tokens.length) {
      return { type: TokenType.EOF, text: "", line: this.line, column: this.column, offset: this.pos };
    }
    return this.tokens[idx];
  }

  next(): Token {
    const tok = this.peek();
    if (this.tokenIdx < this.tokens.length) this.tokenIdx++;
    return tok;
  }

  save(): number {
    return this.tokenIdx;
  }

  restore(saved: number): void {
    this.tokenIdx = saved;
  }

  expect(type: TokenType, context?: string): Token {
    const tok = this.next();
    if (tok.type !== type) {
      const expected = TokenType[type];
      const found = tok.type === TokenType.EOF ? "end of input" : `'${tok.text}'`;
      const ctx = context ? ` ${context}` : "";
      throw new Error(`Parse error at line ${tok.line}, column ${tok.column}: expected ${expected}${ctx}, found ${found}`);
    }
    return tok;
  }

  match(type: TokenType): Token | null {
    if (this.peek().type === type) return this.next();
    return null;
  }

  isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  // --- Tokenization ---

  private tokenizeAll(): void {
    while (this.pos < this.input.length) {
      this.skipWhitespaceAndComments();
      if (this.pos >= this.input.length) break;

      const ch = this.input[this.pos];

      // Check for newline
      if (ch === '\n') {
        this.emitNewline();
        continue;
      }

      this.atLineStart = false;

      // String literal
      if (ch === '"') {
        this.readString();
        continue;
      }

      // Number (float or int)
      if (ch >= '0' && ch <= '9') {
        this.readNumber();
        continue;
      }

      // Identifier or keyword
      if (this.isIdentStart(ch)) {
        this.readIdentOrKeyword();
        continue;
      }

      // Operators and delimiters
      if (this.readOperator()) continue;

      // Unknown character
      throw new Error(`Unexpected character '${ch}' at line ${this.line}, column ${this.column}`);
    }

    // Emit remaining unindents at EOF
    while (this.indentStack.length > 1) {
      this.indentStack.pop();
      this.tokens.push({
        type: TokenType.Unindent, text: "", line: this.line, column: this.column, offset: this.pos,
      });
    }

    this.tokens.push({
      type: TokenType.EOF, text: "", line: this.line, column: this.column, offset: this.pos,
    });
  }

  private emitNewline(): void {
    const nlLine = this.line;
    const nlCol = this.column;
    const nlOff = this.pos;
    this.pos++;
    this.line++;
    this.column = 1;

    // Measure indentation of next line
    let indent = 0;
    while (this.pos < this.input.length && (this.input[this.pos] === ' ' || this.input[this.pos] === '\t')) {
      indent += this.input[this.pos] === '\t' ? 4 : 1;
      this.pos++;
      this.column++;
    }

    // Skip blank lines and comment-only lines
    if (this.pos >= this.input.length || this.input[this.pos] === '\n') {
      return;
    }
    if (this.pos + 1 < this.input.length && this.input[this.pos] === '/' && this.input[this.pos + 1] === '/') {
      // Line comment — skip to end, will handle next newline naturally
      return;
    }

    const currentIndent = this.indentStack[this.indentStack.length - 1];

    if (indent > currentIndent) {
      // Indent increase: emit only Indent (no Newline).
      // The parser treats Indent as continuation whitespace within expressions.
      this.indentStack.push(indent);
      this.tokens.push({ type: TokenType.Indent, text: "", line: this.line, column: 1, offset: this.pos });
    } else if (indent < currentIndent) {
      this.tokens.push({ type: TokenType.Newline, text: "\n", line: nlLine, column: nlCol, offset: nlOff });
      while (this.indentStack.length > 1 && this.indentStack[this.indentStack.length - 1] > indent) {
        this.indentStack.pop();
        this.tokens.push({ type: TokenType.Unindent, text: "", line: this.line, column: 1, offset: this.pos });
      }
    } else {
      // Same indent — just a newline (statement separator)
      this.tokens.push({ type: TokenType.Newline, text: "\n", line: nlLine, column: nlCol, offset: nlOff });
    }

    this.atLineStart = true;
  }

  private skipWhitespaceAndComments(): void {
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      // Spaces and tabs within a line
      if (ch === ' ' || ch === '\t' || ch === '\r') {
        this.pos++;
        this.column++;
        continue;
      }
      // Line comment
      if (ch === '/' && this.pos + 1 < this.input.length && this.input[this.pos + 1] === '/') {
        while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
          this.pos++;
          this.column++;
        }
        continue;
      }
      // Block comment
      if (ch === '/' && this.pos + 1 < this.input.length && this.input[this.pos + 1] === '*') {
        this.pos += 2;
        this.column += 2;
        while (this.pos + 1 < this.input.length) {
          if (this.input[this.pos] === '*' && this.input[this.pos + 1] === '/') {
            this.pos += 2;
            this.column += 2;
            break;
          }
          if (this.input[this.pos] === '\n') {
            this.line++;
            this.column = 1;
          } else {
            this.column++;
          }
          this.pos++;
        }
        continue;
      }
      break;
    }
  }

  private readString(): void {
    const startLine = this.line;
    const startCol = this.column;
    this.pos++; // skip opening "
    this.column++;

    let segStart = this.pos;
    let hasInterpolation = false;

    while (this.pos < this.input.length && this.input[this.pos] !== '"') {
      // Escape sequence
      if (this.input[this.pos] === '\\' && this.pos + 1 < this.input.length) {
        this.pos += 2;
        this.column += 2;
        continue;
      }

      // Interpolation: unescaped {
      if (this.input[this.pos] === '{') {
        hasInterpolation = true;
        // Emit the string segment before {
        const segText = this.input.slice(segStart, this.pos);
        this.tokens.push({
          type: TokenType.String,
          text: `"${segText}"`,
          line: startLine, column: startCol, offset: segStart,
        });
        this.tokens.push({
          type: TokenType.InterpStart,
          text: "{",
          line: this.line, column: this.column, offset: this.pos,
        });
        this.pos++; // skip {
        this.column++;

        // Tokenize the expression inside {} using normal tokenization
        let braceDepth = 1;
        while (this.pos < this.input.length && braceDepth > 0) {
          this.skipWhitespaceAndComments();
          if (this.pos >= this.input.length) break;

          const ch = this.input[this.pos];
          if (ch === '}') {
            braceDepth--;
            if (braceDepth === 0) {
              this.tokens.push({
                type: TokenType.InterpEnd,
                text: "}",
                line: this.line, column: this.column, offset: this.pos,
              });
              this.pos++;
              this.column++;
              break;
            }
          }
          if (ch === '{') braceDepth++;

          // Tokenize one token normally
          if (ch === '"') {
            this.readString(); // nested strings
          } else if (ch >= '0' && ch <= '9') {
            this.readNumber();
          } else if (this.isIdentStart(ch)) {
            this.readIdentOrKeyword();
          } else if (this.readOperator()) {
            // operator consumed
          } else {
            throw new Error(`Unexpected character '${ch}' in string interpolation at line ${this.line}, column ${this.column}`);
          }
        }

        segStart = this.pos;
        continue;
      }

      this.pos++;
      this.column++;
    }

    // Emit the final string segment
    const segText = this.input.slice(segStart, this.pos);
    if (hasInterpolation) {
      // Only emit if there's content after the last interpolation
      if (segText.length > 0) {
        this.tokens.push({
          type: TokenType.String,
          text: `"${segText}"`,
          line: this.line, column: this.column, offset: segStart,
        });
      }
    } else {
      // No interpolation — emit as a regular string (with quotes)
      this.tokens.push({
        type: TokenType.String,
        text: `"${segText}"`,
        line: startLine, column: startCol, offset: segStart - 1,
      });
    }

    if (this.pos < this.input.length) {
      this.pos++; // skip closing "
      this.column++;
    }
  }

  private readNumber(): void {
    const startLine = this.line;
    const startCol = this.column;
    const startOff = this.pos;

    // Check for hex/binary prefix
    if (this.input[this.pos] === '0' && this.pos + 1 < this.input.length) {
      const next = this.input[this.pos + 1];
      if (next === 'x' || next === 'X') {
        this.pos += 2;
        this.column += 2;
        while (this.pos < this.input.length && /[0-9a-fA-F]/.test(this.input[this.pos])) {
          this.pos++;
          this.column++;
        }
        this.tokens.push({
          type: TokenType.Int,
          text: this.input.slice(startOff, this.pos),
          line: startLine, column: startCol, offset: startOff,
        });
        return;
      }
      if (next === 'b' || next === 'B') {
        this.pos += 2;
        this.column += 2;
        while (this.pos < this.input.length && (this.input[this.pos] === '0' || this.input[this.pos] === '1')) {
          this.pos++;
          this.column++;
        }
        this.tokens.push({
          type: TokenType.Int,
          text: this.input.slice(startOff, this.pos),
          line: startLine, column: startCol, offset: startOff,
        });
        return;
      }
    }

    // Decimal digits
    while (this.pos < this.input.length && this.input[this.pos] >= '0' && this.input[this.pos] <= '9') {
      this.pos++;
      this.column++;
    }

    // Check for float: digits followed by . followed by digits
    // But NOT followed by . identifier (which would be dot access)
    if (this.pos < this.input.length && this.input[this.pos] === '.') {
      const afterDot = this.pos + 1;
      if (afterDot < this.input.length && this.input[afterDot] >= '0' && this.input[afterDot] <= '9') {
        // It's a float
        this.pos++; // skip .
        this.column++;
        while (this.pos < this.input.length && this.input[this.pos] >= '0' && this.input[this.pos] <= '9') {
          this.pos++;
          this.column++;
        }
        this.tokens.push({
          type: TokenType.Float,
          text: this.input.slice(startOff, this.pos),
          line: startLine, column: startCol, offset: startOff,
        });
        return;
      }
    }

    this.tokens.push({
      type: TokenType.Int,
      text: this.input.slice(startOff, this.pos),
      line: startLine, column: startCol, offset: startOff,
    });
  }

  private readIdentOrKeyword(): void {
    const startLine = this.line;
    const startCol = this.column;
    const startOff = this.pos;

    while (this.pos < this.input.length && this.isIdentCont(this.input[this.pos])) {
      this.pos++;
      this.column++;
    }

    const text = this.input.slice(startOff, this.pos);
    const kwType = this.config.keywords.get(text);

    this.tokens.push({
      type: kwType ?? TokenType.Ident,
      text,
      line: startLine, column: startCol, offset: startOff,
    });
  }

  private readOperator(): boolean {
    // Try longest match first (operators sorted by length descending)
    for (const [op, type] of this.config.operators) {
      if (this.input.startsWith(op, this.pos)) {
        // Disambiguate: '/' followed by '/' or '*' is a comment, not division
        if (op === '/' && this.pos + 1 < this.input.length) {
          const next = this.input[this.pos + 1];
          if (next === '/' || next === '*') return false; // let comment handling deal with it
        }
        this.tokens.push({
          type,
          text: op,
          line: this.line, column: this.column, offset: this.pos,
        });
        this.pos += op.length;
        this.column += op.length;
        return true;
      }
    }
    return false;
  }

  private isIdentStart(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
  }

  private isIdentCont(ch: string): boolean {
    return this.isIdentStart(ch) || (ch >= '0' && ch <= '9');
  }
}
