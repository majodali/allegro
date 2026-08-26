// =============================================================================
// Allegro — Parser Helpers
// Shared value-construction functions used by both the hybrid parser
// and the Earley parser (for standalone grammars).
// =============================================================================

// --- Value constructors ---

export function makeInt(n: number) {
  return { kind: 'Bits' as const, length: 64, data: BigInt(n) };
}

export function makeBits(length: number, data: bigint | number) {
  return { kind: 'Bits' as const, length, data: typeof data === 'number' ? BigInt(data) : data };
}

const UTF8_ENCODER = new TextEncoder();

export function stringToBits(s: string) {
  const bytes = UTF8_ENCODER.encode(s);
  let data = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) {
    data = (data << 8n) | BigInt(bytes[i]);
  }
  return makeBits(bytes.length * 8, data);
}

export function makeParam(position: number, name?: string) {
  return { kind: 'Param' as const, position, owner: null as any, _name: name };
}

export function makeSymbol(name: string) {
  return { kind: 'Symbol' as const, name };
}

export function makeExpr(fn: any, args: any[]) {
  return { kind: 'Expression' as const, fn, args, memo: new Map() };
}

export function makeComposedFn(params: any[], body: any) {
  const fn = { kind: 'ComposedFunction' as const, params, body };
  for (const p of params) p.owner = fn;
  return fn;
}

export function makeContext() {
  return { kind: 'Context' as const, bindings: new Map(), bindingList: [] as any[] };
}

export function prim(name: string) {
  return { kind: 'PrimitiveFunction' as const, name, fn: null as any, lazy: name === 'eval_if' };
}

// --- Value tree manipulation ---

export function cloneVal(v: any, seen: Map<any, any>): any {
  if (!v || typeof v !== 'object') return v;
  if (seen.has(v)) return seen.get(v);
  if (v.kind === 'Symbol') {
    const c = makeSymbol(v.name);
    seen.set(v, c);
    return c;
  }
  if (v.kind === 'Param') {
    const c = makeParam(v.position, v._name);
    seen.set(v, c);
    return c;
  }
  if (v.kind === 'Expression') {
    const c = makeExpr(cloneVal(v.fn, seen), v.args.map((a: any) => cloneVal(a, seen)));
    seen.set(v, c);
    return c;
  }
  // Clone zero-param thunks (if-then-else branches) so params can be claimed
  if (v.kind === 'ComposedFunction' && v.params.length === 0) {
    const c = makeComposedFn([], cloneVal(v.body, seen));
    seen.set(v, c);
    return c;
  }
  return v;
}

export function collectParams(v: any, out: any[], seen: Set<any>): void {
  if (!v || seen.has(v)) return;
  seen.add(v);
  if (v.kind === 'Param' && v.owner === null) out.push(v);
  if (v.kind === 'Expression') {
    collectParams(v.fn, out, seen);
    for (const a of v.args) collectParams(a, out, seen);
  }
  // Descend into all composed functions to find unowned params (free variables)
  if (v.kind === 'ComposedFunction') {
    collectParams(v.body, out, seen);
  }
}

/**
 * Replace Symbols matching param names with Params in an expression tree.
 * Returns the new tree with Symbols → Params, and collects the created Params.
 */
function replaceSymbolsWithParams(v: any, paramNames: string[], created: Map<string, any>, seen: Map<any, any>): any {
  if (!v || typeof v !== 'object') return v;
  if (seen.has(v)) return seen.get(v);

  if (v.kind === 'Symbol') {
    const idx = paramNames.indexOf(v.name);
    if (idx >= 0) {
      // Replace with a Param
      if (!created.has(v.name)) {
        created.set(v.name, makeParam(idx, v.name));
      }
      const p = created.get(v.name)!;
      seen.set(v, p);
      return p;
    }
    return v; // not a param name — leave as Symbol
  }
  if (v.kind === 'Param') {
    // Legacy: unowned Params from cloneVal
    if (v.owner === null) {
      const idx = paramNames.indexOf(v._name);
      if (idx >= 0) {
        v.position = idx;
        if (!created.has(v._name)) created.set(v._name, v);
        seen.set(v, v);
        return v;
      }
    }
    return v;
  }
  if (v.kind === 'Expression') {
    const newFn = replaceSymbolsWithParams(v.fn, paramNames, created, seen);
    const newArgs = v.args.map((a: any) => replaceSymbolsWithParams(a, paramNames, created, seen));
    if (newFn === v.fn && newArgs.every((a: any, i: number) => a === v.args[i])) {
      seen.set(v, v);
      return v;
    }
    const c = makeExpr(newFn, newArgs);
    seen.set(v, c);
    return c;
  }
  if (v.kind === 'ComposedFunction' && v.params.length === 0) {
    // Thunks (if-then-else branches)
    const newBody = replaceSymbolsWithParams(v.body, paramNames, created, seen);
    if (newBody === v.body) { seen.set(v, v); return v; }
    const c = makeComposedFn([], newBody);
    seen.set(v, c);
    return c;
  }
  // Descend into inner ComposedFunctions to replace free variables
  // (but NOT symbols matching the inner function's own params)
  if (v.kind === 'ComposedFunction') {
    const innerParamNames = new Set(v.params.map((p: any) => p._name).filter(Boolean));
    // Filter out param names shadowed by the inner function
    const outerOnly = paramNames.filter(n => !innerParamNames.has(n));
    if (outerOnly.length === 0) return v; // all params shadowed
    const newBody = replaceSymbolsWithParams(v.body, outerOnly, created, seen);
    if (newBody === v.body) { seen.set(v, v); return v; }
    const c = makeComposedFn(v.params, newBody);
    seen.set(v, c);
    return c;
  }
  return v;
}

export function buildFn(paramNames: string[], body: any) {
  const cloned = cloneVal(body, new Map());
  const created = new Map<string, any>();
  const newBody = replaceSymbolsWithParams(cloned, paramNames, created, new Map());

  // Also handle any legacy Params (from parser internals)
  const paramValues: any[] = [];
  collectParams(newBody, paramValues, new Set());
  for (const p of paramValues) {
    const idx = paramNames.indexOf(p._name);
    if (idx >= 0) {
      p.position = idx;
      if (!created.has(p._name)) created.set(p._name, p);
    }
  }

  // Build sorted param list
  const matched: any[] = [];
  const seenPos = new Set<number>();
  for (const [, p] of created) {
    if (!seenPos.has(p.position)) {
      matched.push(p);
      seenPos.add(p.position);
    }
  }
  matched.sort((a: any, b: any) => a.position - b.position);
  return makeComposedFn(matched, newBody);
}

export function substName(v: any, name: string, replacement: any): any {
  if (v.kind === 'Symbol' && v.name === name) return replacement;
  if (v.kind === 'Param' && v._name === name) return replacement;
  if (v.kind === 'Expression') {
    const nf = substName(v.fn, name, replacement);
    const na = v.args.map((a: any) => substName(a, name, replacement));
    if (nf === v.fn && na.every((a: any, i: number) => a === v.args[i])) return v;
    return makeExpr(nf, na);
  }
  if (v.kind === 'ComposedFunction') {
    if (v.params.some((p: any) => p._name === name)) return v;
    const nb = substName(v.body, name, replacement);
    if (nb === v.body) return v;
    const nfn = { kind: 'ComposedFunction' as const, params: v.params, body: nb };
    for (const p of nfn.params) p.owner = nfn;
    return nfn;
  }
  return v;
}

// --- Context building ---

export function bind(ctx: any, name: string, value: any) {
  const b = { key: name, value };
  ctx.bindings.set(name, b);
  ctx.bindingList.push(b);
}

export function extractString(text: string): string {
  const inner = text.slice(1, -1);
  let result = '';
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '\\' && i + 1 < inner.length) {
      i++;
      const c = inner[i];
      result += c === 'n' ? '\n' : c === 't' ? '\t' : c === '\\' ? '\\' : c === '"' ? '"' : c;
    } else {
      result += inner[i];
    }
  }
  return result;
}

/**
 * Extract children from a Repetition parse node, filtering out empty
 * and delimiter nodes. Used by Earley parser attribute functions.
 */
export function repChildren(repNode: any): any[] {
  return repNode.children.filter(
    (c: any) => c.element !== repNode.element || c.children.length > 0
  );
}

/**
 * Build a file context from a Repetition of statements.
 * Used by the Earley parser's base grammar.
 */
export function buildFileCtx(repNode: any) {
  const ctx = makeContext();
  for (const child of repChildren(repNode)) {
    const s = child.children[0];
    if (s.binding) {
      bind(ctx, s.binding.name, s.binding.value);
    } else if (s.val !== undefined) {
      ctx.bindingList.push({ key: null, value: s.val });
    }
  }
  return ctx;
}

/**
 * Build a block expression from bindings + final expression.
 * Each binding is substituted into all subsequent bindings and the result.
 */
export function buildBlock(repNode: any, lastExpr: any) {
  const bindings: { name: string; value: any }[] = [];
  for (const child of repChildren(repNode)) {
    const b = child.children[0];
    if (b.binding) bindings.push({ name: b.binding.name, value: b.binding.value });
  }
  let result = lastExpr;
  for (let i = 0; i < bindings.length; i++) {
    const { name, value } = bindings[i];
    for (let j = i + 1; j < bindings.length; j++) {
      bindings[j].value = substName(bindings[j].value, name, value);
    }
    result = substName(result, name, value);
  }
  return result;
}
