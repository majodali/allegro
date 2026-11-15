// The one file of the new tree that reaches the present tree's parser
// (B-196 (the rebuild's acceptance side), chunk Q5 (the first notation and
// the bootstrap), part 1).
//
// "The first notation" (docs/plans/rebuild.md §1) is read by the present
// tree's parser. This file has that parser read a text and hands back what
// it built, before anything evaluates it, as plain data of this file's own
// type `PNode`. Nothing else under next/ imports from src/.
//
// The present tree's exports it uses, and nothing else:
//   - `scanUses`       src/use-scanner.ts        the `use` header scan the file
//                                                runner makes before it parses
//   - `getBaseGrammar` src/grammar2/base-grammar.ts  the grammar the file runner
//                                                parses with when no `use` adds
//                                                a fragment
//   - `parseSource`    src/grammar2/engine.ts    the runtime's parse
//   - `buildProgram`   src/grammar2/tree-builder.ts  the parse tree turned into
//                                                the expression values
// These are the first two steps of `evalSource` (src/runtime.ts) for a text
// with no `use` header: parse, then build. The steps after them
// (`typeLiterals`, `resolveSymbols`, the precompile) are not taken, so a
// name is still a symbol and a literal still carries no type.
//
// The import is dynamic, by a computed path, so the new tree's typecheck
// does not compile the present tree: `src/` is checked by its own gate.
// The boundary is typed by the shapes below, which are what this file
// reads of a present value (src/types.ts), and nothing more. The present
// tree is not changed.

/** A present value, as this file reads it. */
interface PresentValue {
  readonly kind: string;
  readonly meta?: ReadonlyMap<string, unknown>;
  readonly length?: number;
  readonly data?: bigint;
  readonly name?: string;
  readonly fqn?: string;
  readonly position?: number;
  readonly _name?: string;
  readonly lazy?: boolean;
  readonly fn?: PresentValue;
  readonly args?: readonly PresentValue[];
  readonly params?: readonly PresentValue[];
  readonly body?: PresentValue;
  readonly bindingList?: ReadonlyArray<{ readonly key: string | null; readonly value: PresentValue | undefined; readonly visibility?: string }>;
}

/** The parse tree, as this file reads it (src/grammar2/types.ts `ParseTree`). */
type ParseTree =
  | { readonly kind: "branch"; readonly tag?: string; readonly children: readonly ParseTree[]; readonly range: { readonly start: number; readonly end: number } }
  | { readonly kind: "leaf" | "none" | "error"; readonly range: { readonly start: number; readonly end: number } };

interface PresentParser {
  scanUses(source: string): { directives: ReadonlyArray<{ kind: string; name?: string; moduleName?: string; memberName?: string }>; headerEnd: number };
  getBaseGrammar(): unknown;
  parseSource(grammar: unknown, input: string, source: string): { ok: true; tree: ParseTree } | { ok: false; error: { position: number; message: string } };
  buildProgram(tree: unknown): PresentValue | null | undefined;
}

const SRC = new URL("../../src/", import.meta.url);
const load = async (file: string): Promise<Record<string, unknown>> => (await import(new URL(file, SRC).href)) as Record<string, unknown>;
const [useScanner, baseGrammar, engine, treeBuilder] = await Promise.all([
  load("use-scanner.js"), load("grammar2/base-grammar.js"), load("grammar2/engine.js"), load("grammar2/tree-builder.js"),
]);
const present = {
  scanUses: useScanner.scanUses,
  getBaseGrammar: baseGrammar.getBaseGrammar,
  parseSource: engine.parseSource,
  buildProgram: treeBuilder.buildProgram,
} as PresentParser;
for (const [name, f] of Object.entries(present))
  if (typeof f !== "function") throw new Error(`the present tree no longer exports ${name}`);

// ── What the reader hands back ────────────────────────────────────────

/** A node of what the present parser built, as plain data. A node may be shared: the parse is a DAG. */
export type PNode =
  /** Bits: a number, or the bytes of a text under `typed_string`. `hex` is the value, `length` its width in bits. */
  | { readonly k: "bits"; readonly length: number; readonly hex: string; readonly meta: readonly string[] }
  /** A name, as the parser wrote it. */
  | { readonly k: "symbol"; readonly name: string; readonly meta: readonly string[] }
  /** A parameter of the function `owner` (a function node's `id`), by its position and name. */
  | { readonly k: "param"; readonly owner: number | null; readonly position: number; readonly name: string; readonly meta: readonly string[] }
  /** A present primitive the parser put in place of an operator or a form, by its name. */
  | { readonly k: "prim"; readonly name: string; readonly meta: readonly string[] }
  /** An application. */
  | { readonly k: "apply"; readonly fn: PNode; readonly args: readonly PNode[]; readonly meta: readonly string[] }
  /** A function. `id` names it for its params' `owner`. */
  | { readonly k: "function"; readonly id: number; readonly params: readonly PNode[]; readonly body: PNode; readonly meta: readonly string[] }
  /** A structure: the program itself, or a structure the parser built. */
  | { readonly k: "structure"; readonly entries: ReadonlyArray<{ readonly key: string | null; readonly value: PNode | null; readonly exported: boolean }>; readonly meta: readonly string[] }
  /** Anything else, by its kind. */
  | { readonly k: "other"; readonly kind: string; readonly meta: readonly string[] };

/** A `use` directive the header scan found. */
export interface UseLine { readonly text: string }

/**
 * A binding written inside a block (an indented body). The present tree
 * builder does not keep it: it puts the bound expression in place of each
 * use of the name (src/grammar2/tree-builder.ts, `buildBlockExpr`), so the
 * built expression no longer shows where it was written or that it was
 * one value. It is found here in the parse tree, by its tag.
 */
export interface BlockBinding { readonly position: number; readonly text: string }

export type PresentRead =
  | { readonly ok: true; readonly program: PNode; readonly uses: readonly UseLine[]; readonly blockBindings: readonly BlockBinding[] }
  | { readonly ok: false; readonly position: number; readonly message: string; readonly uses: readonly UseLine[] };

/** Converts a present value to plain data, keeping sharing and refusing a cycle. */
function convert(root: PresentValue): PNode {
  const done = new Map<PresentValue, PNode>();
  const fnIds = new Map<PresentValue, number>();
  const open = new Set<PresentValue>();
  const metaOf = (v: PresentValue): string[] => (v.meta instanceof Map ? [...v.meta.keys()].map(String).sort() : []);
  const go = (v: PresentValue): PNode => {
    const seen = done.get(v);
    if (seen !== undefined) return seen;
    if (open.has(v)) throw new Error("the present parse holds a cycle");
    open.add(v);
    const meta = metaOf(v);
    let n: PNode;
    switch (v.kind) {
      case "Bits":
        n = { k: "bits", length: v.length ?? 0, hex: (v.data ?? 0n).toString(16), meta };
        break;
      case "Symbol":
        n = { k: "symbol", name: v.name ?? "", meta };
        break;
      case "Param": {
        const owner = (v as { owner?: PresentValue | null }).owner;
        n = { k: "param", owner: owner ? (fnIds.get(owner) ?? null) : null, position: v.position ?? -1, name: v._name ?? `p${v.position}`, meta };
        break;
      }
      case "PrimitiveFunction":
        n = { k: "prim", name: v.name ?? "", meta };
        break;
      case "Expression":
        n = { k: "apply", fn: go(v.fn as PresentValue), args: (v.args ?? []).map(go), meta };
        break;
      case "ComposedFunction": {
        const id = fnIds.size;
        fnIds.set(v, id);
        n = { k: "function", id, params: (v.params ?? []).map(go), body: go(v.body as PresentValue), meta };
        break;
      }
      case "Structure":
      case "Context":
        n = { k: "structure", entries: (v.bindingList ?? []).map((b) => ({ key: b.key, value: b.value === undefined ? null : go(b.value), exported: b.visibility === "exported" })), meta };
        break;
      default:
        n = { k: "other", kind: String(v.kind), meta };
    }
    open.delete(v);
    done.set(v, n);
    return n;
  };
  return go(root);
}

const BINDING_TAGS = new Set(["binding", "fn_decl", "import_stmt", "export_binding", "export_fn_decl"]);

/** The bindings written inside a block, in the order written. */
function blockBindings(tree: ParseTree, body: string, offset: number): BlockBinding[] {
  const out: BlockBinding[] = [];
  const walk = (t: ParseTree, inBlock: boolean): void => {
    if (t.kind !== "branch") return;
    if (inBlock && t.tag !== undefined && BINDING_TAGS.has(t.tag)) {
      out.push({ position: t.range.start + offset, text: body.slice(t.range.start, t.range.end).split("\n")[0].trim() });
    }
    const nowIn = inBlock || t.tag === "block_expr";
    for (const c of t.children) walk(c, nowIn);
  };
  walk(tree, false);
  return out;
}

/**
 * Has the present parser read a text, as the file runner reads a program
 * with no `use` header, and returns what it built. A `use` directive is
 * reported, and the text after the header is read.
 */
export function readPresent(text: string): PresentRead {
  const normalized = text.replace(/\r\n/g, "\n");
  const { directives, headerEnd } = present.scanUses(normalized);
  const uses = directives.map((d) => ({ text: d.kind === "member" ? `use ${d.moduleName}.${d.memberName}` : d.kind === "literal" ? "use grammar { … }" : `use ${d.name}` }));
  const body = normalized.slice(headerEnd);
  const r = present.parseSource(present.getBaseGrammar(), body, "<first notation>");
  if (!r.ok) return { ok: false, position: r.error.position + headerEnd, message: r.error.message, uses };
  const program = present.buildProgram(r.tree);
  return { ok: true, program: program ? convert(program) : { k: "structure", entries: [], meta: [] }, uses, blockBindings: blockBindings(r.tree, body, headerEnd) };
}
