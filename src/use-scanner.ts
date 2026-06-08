// =============================================================================
// Allegro — `use` directive pre-scanner
//
// Pure-string scan for `use …` directives at the head of a source file.
// Shared by the top-level file runner (src/index.ts) and the library loader
// (src/modules.ts) so lib files and user files treat `use` identically.
//
// The scan is intentionally lightweight: it walks past leading whitespace and
// comments, recognises the four accepted directive shapes, and stops as soon
// as it sees the first non-`use`, non-comment, non-blank line. The grammar
// itself is not consulted — `use` precedes parsing.
// =============================================================================

export interface UseDirective {
  kind: "module" | "literal" | "member";
  /** For kind "module": the module name. */
  name?:    string;
  /** For kind "member": the module name. */
  moduleName?: string;
  /** For kind "member": the binding name inside the module. */
  memberName?: string;
  /** For kind "literal": the source of the `grammar { … }` expression. */
  source?:  string;
}

export interface UseScanResult {
  /** Directives in source order. */
  directives: UseDirective[];
  /** Byte offset in `source` where the header ends — slice from here to get
   *  the source body for parsing. */
  headerEnd:  number;
}

/**
 * Scan source for `use X` directives at the top of the file.
 *
 * Accepted forms:
 *   use NAME              — module reference; loads NAME.alg
 *   use import NAME       — same; `import` accepted for symmetry
 *   use NAME.MEMBER       — specific Grammar binding inside module NAME
 *   use import NAME.MEMBER — same; `import` accepted for symmetry
 *   use grammar { … }     — inline literal grammar block
 *
 * Each directive must appear before any non-`use`, non-comment, non-blank
 * line. Comments and blank lines between directives are allowed.
 */
export function scanUses(source: string): UseScanResult {
  const directives: UseDirective[] = [];
  let i = 0;
  const n = source.length;

  while (i < n) {
    const wsEnd = skipWsComments(source, i);
    if (wsEnd >= n) { i = wsEnd; break; }

    if (source.slice(wsEnd, wsEnd + 4) === "use " || source.slice(wsEnd, wsEnd + 4) === "use\t") {
      const afterUse = skipHSpaces(source, wsEnd + 4);

      // `use grammar { … }` — inline literal; brace-count to find end.
      if (source.slice(afterUse, afterUse + 8) === "grammar " ||
          source.slice(afterUse, afterUse + 8) === "grammar\t" ||
          source.slice(afterUse, afterUse + 8) === "grammar{") {
        const braceStart = source.indexOf("{", afterUse);
        if (braceStart < 0) break;
        const braceEnd = findMatchingBrace(source, braceStart);
        if (braceEnd < 0) break;
        const body = source.slice(afterUse, braceEnd + 1);
        directives.push({ kind: "literal", source: body });
        i = braceEnd + 1;
        while (i < n && (source[i] === " " || source[i] === "\t")) i++;
        if (i < n && source[i] === "\n") i++;
        continue;
      }

      // `use NAME.MEMBER` / `use import NAME.MEMBER`
      const memberMatch = /^(?:import\s+)?(\w+)\.(\w+)\s*(\r?\n|$)/.exec(source.slice(afterUse));
      if (memberMatch) {
        directives.push({
          kind: "member",
          moduleName: memberMatch[1],
          memberName: memberMatch[2],
        });
        i = afterUse + memberMatch[0].length;
        continue;
      }
      // `use NAME` / `use import NAME`
      const identMatch = /^(?:import\s+)?(\w+)\s*(\r?\n|$)/.exec(source.slice(afterUse));
      if (identMatch) {
        directives.push({ kind: "module", name: identMatch[1] });
        i = afterUse + identMatch[0].length;
        continue;
      }
      // Unrecognised `use …` form — stop header scan.
      break;
    }
    break;
  }
  return { directives, headerEnd: i };
}

/** Advance past whitespace, line comments, and block comments. */
export function skipWsComments(src: string, from: number): number {
  let i = from;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") { i++; continue; }
    if (src.slice(i, i + 2) === "//") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (src.slice(i, i + 2) === "/*") {
      const end = src.indexOf("*/", i + 2);
      i = end < 0 ? src.length : end + 2;
      continue;
    }
    break;
  }
  return i;
}

/** Advance past spaces and tabs (no newlines). */
export function skipHSpaces(src: string, from: number): number {
  let i = from;
  while (i < src.length && (src[i] === " " || src[i] === "\t")) i++;
  return i;
}

/**
 * Find the matching close-brace for the open-brace at `start`, accounting for
 * nested braces but NOT for braces inside strings or comments (best-effort,
 * good enough for typical grammar-block contents).
 */
export function findMatchingBrace(src: string, start: number): number {
  let depth = 0;
  let i = start;
  let inString = false;
  let stringQuote = "";
  while (i < src.length) {
    const c = src[i];
    if (inString) {
      if (c === "\\") { i += 2; continue; }
      if (c === stringQuote) { inString = false; i++; continue; }
      i++;
      continue;
    }
    if (c === '"' || c === "'") { inString = true; stringQuote = c; i++; continue; }
    if (src.slice(i, i + 2) === "//") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (src.slice(i, i + 2) === "/*") {
      const end = src.indexOf("*/", i + 2);
      i = end < 0 ? src.length : end + 2;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}
