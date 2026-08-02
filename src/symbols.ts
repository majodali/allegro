// =============================================================================
// FQN symbols — the identity substrate (structures Phase 5, C5.1 / B-022)
//
// Design (docs/design/allegretto/structures.md §5, D20/D29/D42):
//   - IDENTITY = FQN (defining scope's fully-qualified name + base name;
//     default scope FQN is the module file path). Same FQN = same symbol —
//     enforced here by interning. Symbols are REGISTERED in a scope, never
//     constructed into foreign namespaces.
//   - The base name is a convenience PROJECTION (printing, unambiguous
//     serialization, loose structural matching); the symbol is identity.
//   - ONE governing rule: wherever a base name is ambiguous — multiple
//     distinct TARGETS — explicit qualification is required, else error.
//     The rule recurs identically at import resolution, member binding,
//     and dot access; `projectBaseName` below is the single resolver all
//     three surfaces call.
//   - D42 (wire rule): deserialization NEVER mints reachability. A foreign
//     FQN rebinds only against the EXPORTED symbol registry — a private
//     symbol arriving over the wire resolves to nothing. The export
//     partition is designed in from day one: registration and exporting
//     are separate acts on separate maps.
//
// C5.1 is the substrate only. Parser-minted Symbols (`makeSymbol`) remain
// TRANSIENT references (no fqn) resolved by base name against lexical
// scope — §5 explicitly allows scope binding keys to stay strings. C5.2
// migrates type members onto symbol keys and adopts the resolver at the
// member-binding and dot-access surfaces.
// =============================================================================

import { ValueKind, SymbolValue } from "./types.js";

/** Separator between the scope FQN and the base name. Chosen so it cannot
 *  appear in an Allegro identifier; module-path scope FQNs may contain
 *  `/` and `.` freely since only the LAST separator splits scope | base. */
export const FQN_SEP = "::";

/** Default scope FQN for top-level / REPL evaluation (no module file). */
export const MAIN_SCOPE_FQN = "<main>";

// --- Interning (identity = FQN) ------------------------------------------------

const INTERN = new Map<string, SymbolValue>();

/** Intern (register) a symbol under its defining scope. Same (scope, base)
 *  always returns the SAME object — across re-evaluation, module reload,
 *  and loader instances (the intern table outlives them all). */
export function registerScopeSymbol(scopeFqn: string, baseName: string): SymbolValue {
  const fqn = scopeFqn + FQN_SEP + baseName;
  let s = INTERN.get(fqn);
  if (s === undefined) {
    s = { kind: ValueKind.Symbol, name: baseName, fqn };
    INTERN.set(fqn, s);
  }
  return s;
}

/** The FQN of a registered symbol; null for transient (parser-minted)
 *  reference symbols, which have no identity beyond their occurrence. */
export function symbolFqn(s: SymbolValue): string | null {
  return s.fqn ?? null;
}

/** True iff this object IS the interned symbol for its FQN. */
export function isRegisteredSymbol(s: SymbolValue): boolean {
  return s.fqn !== undefined && INTERN.get(s.fqn) === s;
}

/** Intern-table size — for the D42 no-minting assertions in the battery. */
export function internCount(): number {
  return INTERN.size;
}

// --- Export partition (D42) ----------------------------------------------------

/** moduleFqn → (baseName → symbol). ONLY this map answers foreign FQNs. */
const EXPORT_REGISTRY = new Map<string, Map<string, SymbolValue>>();

/** Mark a registered symbol as exported from its scope. Registration and
 *  export are separate acts: everything a module binds is registered;
 *  only its public interface enters the export partition. */
export function markExported(scopeFqn: string, baseName: string): SymbolValue {
  const sym = registerScopeSymbol(scopeFqn, baseName);
  let m = EXPORT_REGISTRY.get(scopeFqn);
  if (!m) {
    m = new Map();
    EXPORT_REGISTRY.set(scopeFqn, m);
  }
  m.set(baseName, sym);
  return sym;
}

/** The exported symbols of a scope (empty map when none / unknown). */
export function exportedSymbols(scopeFqn: string): ReadonlyMap<string, SymbolValue> {
  return EXPORT_REGISTRY.get(scopeFqn) ?? EMPTY_EXPORTS;
}
const EMPTY_EXPORTS: ReadonlyMap<string, SymbolValue> = new Map();

// --- Serialization (FQN on the wire; D42 rebind) -------------------------------

/** Wire form of a symbol: its FQN. Transient reference symbols have no
 *  wire identity — serializing one is a caller error. */
export function symbolToWire(s: SymbolValue): string {
  if (s.fqn === undefined) {
    throw new Error(`symbolToWire: transient symbol '${s.name}' has no FQN — only registered symbols serialize`);
  }
  return s.fqn;
}

/** D42: rebind a foreign FQN against the EXPORTED registry only. A private
 *  (registered-but-not-exported) or unknown FQN resolves to null — never
 *  minted, never looked up in the full intern table. Reachability is
 *  possession; the wire cannot grant it. */
export function symbolFromWire(fqn: string): SymbolValue | null {
  const idx = fqn.lastIndexOf(FQN_SEP);
  if (idx <= 0) return null;
  const scopeFqn = fqn.slice(0, idx);
  const baseName = fqn.slice(idx + FQN_SEP.length);
  if (baseName.length === 0) return null;
  return EXPORT_REGISTRY.get(scopeFqn)?.get(baseName) ?? null;
}

// --- The ambiguity rule (§5) — one resolver, three surfaces --------------------

/** A candidate entry for base-name projection. `target` (optional, compared
 *  by identity) models §8 multi-bind: a single member bound to several
 *  symbols is ONE target and stays unambiguous. When absent, the symbol
 *  itself is the target. */
export interface BaseNameCandidate {
  symbol: SymbolValue;
  target?: unknown;
}

export type BaseNameResolution =
  | { outcome: "match"; symbol: SymbolValue }
  | { outcome: "none" }
  | { outcome: "ambiguous"; candidates: SymbolValue[]; message: string };

/** Resolve a base name against a candidate set — THE §5 governing rule,
 *  shared verbatim by import resolution, member binding, and dot access
 *  (C5.1 provides the function; the surfaces adopt it as they migrate).
 *
 *  - Zero matching targets → none.
 *  - Exactly one distinct target → match (multi-bound targets dedupe).
 *  - Multiple distinct targets → explicit qualification required:
 *    `qualifier` (a scope FQN) narrows to that scope's candidate; without
 *    one, `ambiguous` with a message naming every candidate FQN. */
export function projectBaseName(
  candidates: Iterable<BaseNameCandidate>,
  baseName: string,
  qualifier?: string,
): BaseNameResolution {
  const hits: BaseNameCandidate[] = [];
  for (const c of candidates) {
    if (c.symbol.name === baseName) hits.push(c);
  }
  if (qualifier !== undefined) {
    const qualified = hits.filter((c) => scopeOf(c.symbol) === qualifier);
    if (qualified.length === 0) return { outcome: "none" };
    return dedupeToResolution(qualified, baseName);
  }
  if (hits.length === 0) return { outcome: "none" };
  return dedupeToResolution(hits, baseName);
}

function scopeOf(s: SymbolValue): string | null {
  if (s.fqn === undefined) return null;
  const idx = s.fqn.lastIndexOf(FQN_SEP);
  return idx > 0 ? s.fqn.slice(0, idx) : null;
}

function dedupeToResolution(hits: BaseNameCandidate[], baseName: string): BaseNameResolution {
  // Distinct TARGETS decide ambiguity (multi-bind = one target). Distinct
  // symbols with no target are their own targets.
  const targets = new Map<unknown, BaseNameCandidate>();
  for (const c of hits) {
    targets.set(c.target ?? c.symbol, c);
  }
  if (targets.size === 1) {
    return { outcome: "match", symbol: [...targets.values()][0].symbol };
  }
  const syms = [...targets.values()].map((c) => c.symbol);
  const fqns = syms.map((s) => s.fqn ?? `<transient ${s.name}>`).join(", ");
  return {
    outcome: "ambiguous",
    candidates: syms,
    message: `'${baseName}' is ambiguous — multiple distinct targets (${fqns}); qualify explicitly (x[ns.${baseName}])`,
  };
}
