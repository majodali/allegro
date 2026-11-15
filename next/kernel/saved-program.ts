// The data form of a saved program, first and second versions.
//
// One of the three contracts between the two streams of the rebuild
// (docs/plans/rebuild.md §8 rule 2): a change to this file is a pull
// request of its own, merged by the maintainer.
//
// What it realises, from docs/plans/book-pass-inventory.md:
//   "A saved program is a recorded sequence of interface calls"
//   "A saved program names what it needs by content hash"
//   "A module is a function of what it declares"
//   "Only the module being run performs effects when instantiated"
//
// A saved program rebuilds a program in a kernel without parsing. Its
// data form is a record that constructs values and can do nothing else.
// It cannot evaluate, bind, fill a cell, set a limit or reach a scope:
// the record has no way to say any of those. What it yields is one
// value, a module function. The module's capabilities, its inputs and
// the modules it imports are that function's parameters, so a record
// never names a capability: one reaches the module only as an argument,
// when whoever loaded it instantiates it.
//
// The record is a JSON document, UTF-8. `encode` writes it one node to a
// line so two records can be compared line by line; any JSON layout is
// valid.
//
// The second version adds two things, after the rulings of 2026-11-15
// on identity and on strength
// (docs/records/book-pass/adversarial-review.md, issues 8 to 12):
//   - `keys`: how many of the module function's first parameters are key
//     slots. A record never holds a key. Loading has the kernel make the
//     module's keys from the content of the function, so the same record
//     gives the same keys in every kernel, and no other record gives
//     them.
//   - `outcomes`: claims the builder's kernel decided, each with what it
//     rested on. They are restored only when whoever loads the record
//     names its builder; otherwise they are ignored and every claim is
//     decided again. An outcome that rests on a capability's answer is
//     never stored.
// A record of the first version is still a saved program: it has no key
// slots and no outcomes.
//
// Still left out: origins (a loaded value's origin starts at the saved
// program), metadata fields (an extension's fields are rebuilt when the
// module's body is evaluated, by the extension's own constructors), and
// the host-code form.

import type { Kernel, Kernel2, Rest, Value } from "./interface.js";

export const SAVED_PROGRAM_FORMAT = "allegro-saved-program";
export const SAVED_PROGRAM_VERSION = 1;
/** The version of a record with key slots or outcomes. `check2` accepts this and the first. */
export const SAVED_PROGRAM_VERSION_2 = 2;

/** A reference to a node: its index in `nodes`. A node refers only to nodes before it. */
export type Ref = number;

/** One constructed value. Each kind is one constructing call of the kernel's interface. */
export type Node =
  /** A sequence of bits, as lowercase hex, with its length in bits. */
  | { readonly k: "bits"; readonly hex: string; readonly bits: number }
  /** A symbol, by its fully-qualified name. */
  | { readonly k: "symbol"; readonly fqn: string }
  /** A positional parameter. Each param node is listed by exactly one function node. */
  | { readonly k: "param"; readonly name: string }
  /** A structure: entries of [key or null, value]. */
  | { readonly k: "structure"; readonly entries: ReadonlyArray<readonly [Ref | null, Ref]> }
  /** An unevaluated application. */
  | { readonly k: "expression"; readonly fn: Ref; readonly args: readonly Ref[] }
  /** A composed function. */
  | { readonly k: "function"; readonly params: readonly Ref[]; readonly body: Ref }
  /** One of the kernel's own primitives, by name. */
  | { readonly k: "kernel"; readonly name: string }
  /** A pure primitive function, by content hash. It must be listed in `needs`. */
  | { readonly k: "primitive"; readonly hash: string };

/** A pure primitive function the record depends on. */
export interface Need {
  /** `sha256:` and 64 lowercase hex digits. */
  readonly hash: string;
  /** For reports. Not an identity. */
  readonly name: string;
}

/** What one parameter of the module function is for. */
export interface Declared {
  /** The param node. */
  readonly param: Ref;
  /** A capability, an input, or another module. */
  readonly role: "capability" | "input" | "module";
  /** The capability's name, the input's name, or the module's name. */
  readonly name: string;
}

/** A claim the builder's kernel decided. */
export interface StoredOutcome {
  /** The claim: an expression node that applies the kernel primitive "claim". */
  readonly claim: Ref;
  /** What it rested on. Never a capability. */
  readonly restsOn: readonly Rest[];
  /**
   * The outcome's key, as the builder's kernel computed it from the
   * claim, the module function and `restsOn` (`Kernel2.claimKey`). The
   * loading kernel computes it again and refuses the record where the
   * two differ.
   */
  readonly key: string;
}

export interface SavedProgram {
  readonly format: typeof SAVED_PROGRAM_FORMAT;
  readonly version: 1 | 2;
  /** The pure primitive functions this record needs, each once. */
  readonly needs: readonly Need[];
  /** The values, each referring only to earlier ones. */
  readonly nodes: readonly Node[];
  /** The module function: a function node. */
  readonly module: Ref;
  /**
   * One entry for each parameter of the module function after its key
   * slots, in the function's order.
   */
  readonly declares: readonly Declared[];
  /** Second version: how many of the module function's first parameters are key slots. Absent means none. */
  readonly keys?: number;
  /** Second version: the claims the builder's kernel decided. Absent means none. */
  readonly outcomes?: readonly StoredOutcome[];
}

const HASH = /^sha256:[0-9a-f]{64}$/;
const HEX = /^([0-9a-f]{2})*$/;
const NODE_KEYS: Record<Node["k"], readonly string[]> = {
  bits: ["k", "hex", "bits"],
  symbol: ["k", "fqn"],
  param: ["k", "name"],
  structure: ["k", "entries"],
  expression: ["k", "fn", "args"],
  function: ["k", "params", "body"],
  kernel: ["k", "name"],
  primitive: ["k", "hash"],
};
const TOP_KEYS_1 = ["format", "version", "needs", "nodes", "module", "declares"];
const TOP_KEYS_2 = [...TOP_KEYS_1, "keys", "outcomes"];

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function extraKeys(o: Record<string, unknown>, allowed: readonly string[]): string[] {
  return Object.keys(o).filter((key) => !allowed.includes(key));
}

/**
 * Checks a parsed JSON document against the first version of the data
 * form. Returns the findings, one sentence each; an empty list means the
 * document is a saved program of the first version. A record of the
 * second version is refused here, by its version: a caller that can load
 * one uses `check2`.
 */
export function check(doc: unknown): string[] {
  const findings = check2(doc).map((f) => (f === "version is not 1 or 2" ? "version is not 1" : f));
  if (isObject(doc) && doc.version === 2) findings.unshift("version is not 1");
  return findings;
}

/**
 * Checks a parsed JSON document against the data form, first or second
 * version. Returns the findings, one sentence each; an empty list means
 * the document is a saved program. It checks the record alone: whether a
 * kernel has the primitives it needs is `load`'s to find.
 */
export function check2(doc: unknown): string[] {
  const out: string[] = [];
  if (!isObject(doc)) return ["the document is not an object"];
  if (doc.format !== SAVED_PROGRAM_FORMAT) out.push(`format is not "${SAVED_PROGRAM_FORMAT}"`);
  if (doc.version !== 1 && doc.version !== 2) out.push("version is not 1 or 2");
  for (const key of extraKeys(doc, doc.version === 2 ? TOP_KEYS_2 : TOP_KEYS_1)) out.push(`unknown key "${key}"`);

  const needed = new Set<string>();
  if (!Array.isArray(doc.needs)) out.push("needs is not a list");
  else
    doc.needs.forEach((need, i) => {
      if (!isObject(need) || typeof need.hash !== "string" || typeof need.name !== "string") {
        out.push(`needs[${i}] is not {hash, name}`);
        return;
      }
      if (!HASH.test(need.hash)) out.push(`needs[${i}].hash is not sha256: and 64 hex digits`);
      if (needed.has(need.hash)) out.push(`needs[${i}] repeats ${need.hash}`);
      needed.add(need.hash);
      for (const key of extraKeys(need, ["hash", "name"])) out.push(`needs[${i}] has unknown key "${key}"`);
    });

  if (!Array.isArray(doc.nodes)) return [...out, "nodes is not a list"];
  const nodes = doc.nodes as unknown[];
  const kinds: (string | undefined)[] = [];
  const paramOwner = new Map<number, number>();
  const usedNeeds = new Set<string>();
  const ref = (x: unknown, at: number, what: string): x is number => {
    if (typeof x !== "number" || !Number.isInteger(x) || x < 0 || x >= at) {
      out.push(`nodes[${at}].${what} does not refer to an earlier node`);
      return false;
    }
    return true;
  };
  nodes.forEach((node, i) => {
    if (!isObject(node) || typeof node.k !== "string" || !(node.k in NODE_KEYS)) {
      out.push(`nodes[${i}] is not a node of a known kind`);
      kinds.push(undefined);
      return;
    }
    const k = node.k as Node["k"];
    kinds.push(k);
    for (const key of extraKeys(node, NODE_KEYS[k])) out.push(`nodes[${i}] has unknown key "${key}"`);
    switch (k) {
      case "bits": {
        const hex = node.hex;
        const bits = node.bits;
        if (typeof hex !== "string" || !HEX.test(hex)) out.push(`nodes[${i}].hex is not lowercase hex`);
        else if (typeof bits !== "number" || !Number.isInteger(bits) || bits < 0 || bits > hex.length * 4 || bits <= hex.length * 4 - 8)
          out.push(`nodes[${i}].bits does not fit its hex`);
        break;
      }
      case "symbol":
        if (typeof node.fqn !== "string" || node.fqn === "") out.push(`nodes[${i}].fqn is not a name`);
        break;
      case "param":
        if (typeof node.name !== "string") out.push(`nodes[${i}].name is not a string`);
        break;
      case "kernel":
        if (typeof node.name !== "string" || node.name === "") out.push(`nodes[${i}].name is not a name`);
        break;
      case "primitive":
        if (typeof node.hash !== "string" || !needed.has(node.hash)) out.push(`nodes[${i}].hash is not listed in needs`);
        else usedNeeds.add(node.hash);
        break;
      case "structure":
        if (!Array.isArray(node.entries)) out.push(`nodes[${i}].entries is not a list`);
        else
          node.entries.forEach((entry, j) => {
            if (!Array.isArray(entry) || entry.length !== 2) {
              out.push(`nodes[${i}].entries[${j}] is not [key, value]`);
              return;
            }
            if (entry[0] !== null) ref(entry[0], i, `entries[${j}] key`);
            ref(entry[1], i, `entries[${j}] value`);
          });
        break;
      case "expression":
        ref(node.fn, i, "fn");
        if (!Array.isArray(node.args)) out.push(`nodes[${i}].args is not a list`);
        else node.args.forEach((arg, j) => ref(arg, i, `args[${j}]`));
        break;
      case "function":
        ref(node.body, i, "body");
        if (!Array.isArray(node.params)) out.push(`nodes[${i}].params is not a list`);
        else
          node.params.forEach((p, j) => {
            if (!ref(p, i, `params[${j}]`)) return;
            if (kinds[p] !== "param") out.push(`nodes[${i}].params[${j}] is not a param node`);
            else if (paramOwner.has(p)) out.push(`nodes[${i}].params[${j}] is already a parameter of nodes[${paramOwner.get(p)}]`);
            else paramOwner.set(p, i);
          });
        break;
    }
  });
  for (const hash of needed) if (!usedNeeds.has(hash)) out.push(`needs lists ${hash}, which no node uses`);
  kinds.forEach((k, i) => {
    if (k === "param" && !paramOwner.has(i)) out.push(`nodes[${i}] is a param that no function lists`);
  });

  const m = doc.module;
  if (typeof m !== "number" || !Number.isInteger(m) || m < 0 || m >= nodes.length || kinds[m] !== "function") {
    out.push("module does not refer to a function node");
    return out;
  }
  const all = (nodes[m] as { params?: unknown }).params;
  let keyCount = 0;
  if (doc.keys !== undefined) {
    if (typeof doc.keys !== "number" || !Number.isInteger(doc.keys) || doc.keys < 0 || !Array.isArray(all) || doc.keys > all.length)
      out.push("keys is not a count of the module function's first parameters");
    else keyCount = doc.keys;
  }
  const params = Array.isArray(all) ? all.slice(keyCount) : all;
  if (!Array.isArray(doc.declares)) out.push("declares is not a list");
  else if (Array.isArray(params)) {
    if (doc.declares.length !== params.length) out.push("declares does not have one entry for each parameter of the module function");
    doc.declares.forEach((d, i) => {
      if (!isObject(d) || typeof d.name !== "string" || !["capability", "input", "module"].includes(d.role as string)) {
        out.push(`declares[${i}] is not {param, role, name}`);
        return;
      }
      if (d.param !== params[i]) out.push(`declares[${i}].param is not parameter ${i} of the module function`);
      for (const key of extraKeys(d, ["param", "role", "name"])) out.push(`declares[${i}] has unknown key "${key}"`);
    });
  }
  if (doc.outcomes !== undefined) {
    if (!Array.isArray(doc.outcomes)) out.push("outcomes is not a list");
    else
      doc.outcomes.forEach((o, i) => {
        if (!isObject(o) || !Array.isArray(o.restsOn)) {
          out.push(`outcomes[${i}] is not {claim, restsOn, key}`);
          return;
        }
        for (const key of extraKeys(o, ["claim", "restsOn", "key"])) out.push(`outcomes[${i}] has unknown key "${key}"`);
        if (typeof o.key !== "string" || !HASH.test(o.key)) out.push(`outcomes[${i}].key is not sha256: and 64 hex digits`);
        const c = typeof o.claim === "number" && Number.isInteger(o.claim) ? (nodes[o.claim] as Record<string, unknown> | undefined) : undefined;
        const fn = c !== undefined && c.k === "expression" && typeof c.fn === "number" ? (nodes[c.fn] as Record<string, unknown> | undefined) : undefined;
        if (fn === undefined || fn.k !== "kernel" || fn.name !== "claim") out.push(`outcomes[${i}].claim does not refer to an application of the kernel primitive "claim"`);
        o.restsOn.forEach((r, j) => {
          const where = `outcomes[${i}].restsOn[${j}]`;
          if (!isObject(r)) out.push(`${where} is not something a result rests on`);
          else if (r.kind === "capability") out.push(`${where} is a capability: an outcome that rests on a capability's answer is never stored`);
          else if (r.kind === "kernel" ? typeof r.variant !== "string" : r.kind === "primitive" ? typeof r.hash !== "string" || typeof r.name !== "string" : r.kind === "builder" ? typeof r.builder !== "string" : true)
            out.push(`${where} is not something a result rests on`);
        });
      });
  }
  return out;
}

/** How a saved program is loaded. */
export interface LoadOptions {
  /**
   * The builder whose word the stored outcomes are restored on. Named by
   * whoever loads the record, never by the record. Absent: the outcomes
   * are ignored and every claim is decided again.
   */
  readonly restoreAs?: string;
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  return bytes;
}

/** Makes one value for each node, by constructing calls only. */
function build(kernel: Kernel, doc: SavedProgram, primitives: ReadonlyMap<string, Value>): Value[] {
  const values: Value[] = [];
  for (const node of doc.nodes) {
    switch (node.k) {
      case "bits":
        values.push(kernel.bits(fromHex(node.hex), node.bits));
        break;
      case "symbol":
        values.push(kernel.symbol(node.fqn));
        break;
      case "param":
        values.push(kernel.param(node.name));
        break;
      case "structure":
        values.push(kernel.structure(node.entries.map(([key, value]) => [key === null ? null : values[key], values[value]] as const)));
        break;
      case "expression":
        values.push(kernel.expression(values[node.fn], node.args.map((a) => values[a])));
        break;
      case "function":
        values.push(kernel.composedFunction(node.params.map((p) => values[p]), values[node.body]));
        break;
      case "kernel":
        values.push(kernel.kernelPrimitive(node.name));
        break;
      case "primitive":
        values.push(primitives.get(node.hash) as Value);
        break;
    }
  }
  return values;
}

/**
 * The key of each stored outcome of a record, as this kernel computes
 * it, in the order of `outcomes`. For whoever writes a record: build it
 * with any `key`, ask for the keys, and write them in. It reads the
 * record's nodes and `restsOn` only, and evaluates nothing.
 */
export function outcomeKeys(kernel: Kernel2, doc: SavedProgram, primitives: ReadonlyMap<string, Value>): string[] {
  const values = build(kernel, doc, primitives);
  return (doc.outcomes ?? []).map((o) => kernel.claimKey(values[o.claim], values[doc.module], o.restsOn));
}

/**
 * Rebuilds a saved program in a kernel and returns its module function.
 * It makes constructing calls only, one for each node: nothing is
 * evaluated, bound or filled. Instantiating the module is the caller's
 * act, by building a call of the returned function and evaluating it.
 *
 * `primitives` holds the pure primitive functions the caller has made in
 * this kernel, by content hash. A need it does not hold is an error: a
 * saved program never runs against something else.
 *
 * A record with key slots or with outcomes to restore needs a kernel of
 * the second version: the kernel makes the module and its keys from the
 * function's content, and records each restored outcome under the
 * builder's name. On a kernel of the first version such a record is an
 * error; a record without them loads on either.
 */
export function load(kernel: Kernel | Kernel2, doc: SavedProgram, primitives: ReadonlyMap<string, Value>, options: LoadOptions = {}): Value {
  const findings = check2(doc);
  if (findings.length > 0) throw new Error(`not a saved program: ${findings.join("; ")}`);
  for (const need of doc.needs)
    if (!primitives.has(need.hash)) throw new Error(`the kernel lacks the primitive ${need.name} (${need.hash})`);
  const values = build(kernel, doc, primitives);
  const restoring = options.restoreAs !== undefined && (doc.outcomes?.length ?? 0) > 0;
  if (!("module" in kernel)) {
    if ((doc.keys ?? 0) > 0) throw new Error("the saved program has key slots, and this kernel is of the first version");
    if (restoring) throw new Error("the saved program has outcomes to restore, and this kernel is of the first version");
    return values[doc.module];
  }
  if (restoring) for (const o of doc.outcomes ?? []) kernel.restore(values[o.claim], values[doc.module], options.restoreAs as string, o.restsOn, o.key);
  if (doc.version === 1) return values[doc.module];
  return kernel.module(values[doc.module], doc.keys ?? 0);
}

/** Writes a saved program as JSON, one node to a line. */
export function encode(doc: SavedProgram): string {
  const lines = [
    "{",
    `"format": ${JSON.stringify(doc.format)},`,
    `"version": ${doc.version},`,
    `"needs": ${JSON.stringify(doc.needs)},`,
    `"nodes": [`,
    doc.nodes.map((n) => JSON.stringify(n)).join(",\n"),
    "],",
    `"module": ${doc.module},`,
    `"declares": ${JSON.stringify(doc.declares)}` + (doc.version === 2 ? "," : ""),
    ...(doc.version === 2 ? [`"keys": ${doc.keys ?? 0},`, `"outcomes": ${JSON.stringify(doc.outcomes ?? [])}`] : []),
    "}",
  ];
  return lines.join("\n") + "\n";
}
