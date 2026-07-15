// =============================================================================
// Allegro Grammar 2 — Allegro-level Primitive Wrappers
//
// Exposes the grammar formalism to Allegro code as primitives. Users build
// grammars by calling `grammar2_*` constructor primitives; each returns an
// opaque integer handle to a TS-side Rule, Guard, or Grammar object.
// `grammar2_parse` converts the engine's ParseTree into Allegro values.
//
// Tree output convention (from §8.1 of the spec, adapted for Allegro values):
//   - leaf      → String (the matched text)
//   - branch    → Array of children if untagged; Object { tag, children } if tagged
//   - none      → the none singleton
//   - error     → an error MultiValue with message + inner tree
// =============================================================================

import { dataOf, getSlotCount } from "../slots.js";
import {
  Rule, Grammar, Guard, Production,
  lit, cls, regex, eof, empty, fail, indent as indentTerm,
  nonterm, seq, alt, rep, opt, guarded,
  notFollowedBy, followedBy, reserved,
  makeGrammar, addProduction,
  ParseTree,
  IndentDirective,
} from "./types.js";
import { parse as engineParse } from "./engine.js";

import {
  Value, ValueKind, ContextValue, BitsValue, PrimitiveFnImpl,
  makePrimitive, makeContext, makeInt, makeMultiValue, stringToBits, bitsToString,
  AllegroError,
} from "../types.js";
import { makeArray, makeObject, withType, StringType, ErrorType, noneSingleton, IntType } from "../types-std.js";

// --- Handle registry (shared with legacy grammar-ext for now, but we namespace
//     the handles with a separate counter). ---

const registry = new Map<number, any>();
let nextHandle = 1;

function store(obj: any): number {
  const id = nextHandle++;
  registry.set(id, obj);
  return id;
}

function fetch(id: number, expectedKind: string): any {
  const o = registry.get(id);
  if (o === undefined) throw new AllegroError(`grammar2: invalid handle ${id}`);
  return o;
}

function handleArg(v: Value, primName: string): number {
  const p = dataOf(v);
  if (p.kind !== ValueKind.Bits) {
    throw new AllegroError(`${primName}: expected grammar handle (integer), got ${p.kind}`);
  }
  return Number((p as BitsValue).data);
}

function stringArg(v: Value, primName: string): string {
  const p = dataOf(v);
  if (p.kind !== ValueKind.Bits) {
    throw new AllegroError(`${primName}: expected String, got ${p.kind}`);
  }
  return bitsToString(p as BitsValue);
}

function intArg(v: Value, primName: string): number {
  const p = dataOf(v);
  if (p.kind !== ValueKind.Bits) {
    throw new AllegroError(`${primName}: expected Int, got ${p.kind}`);
  }
  return Number((p as BitsValue).data);
}

function arrayArg(v: Value, primName: string): Value[] {
  const p = dataOf(v);
  if (p.kind !== ValueKind.Context) {
    throw new AllegroError(`${primName}: expected Array, got ${p.kind}`);
  }
  const ctx = p as ContextValue;
  const lengthV = getSlotCount(ctx);
  if (!lengthV) {
    throw new AllegroError(`${primName}: value is not an Array (no length slot)`);
  }
  const length = Number(((lengthV as any).data ?? 0n) as bigint);
  const out: Value[] = [];
  for (let i = 0; i < length; i++) {
    const b = ctx.bindings.get(String(i));
    if (!b?.value) throw new AllegroError(`${primName}: array missing element ${i}`);
    out.push(b.value);
  }
  return out;
}

function handleToValue(id: number): Value {
  return withType(makeInt(id), IntType);
}

// --- Helper: extract an optional attrs object from a keyword-style object arg ---

function readAttrs(v: Value | undefined, primName: string): import("./types.js").RuleAttrs | undefined {
  if (!v) return undefined;
  const p = dataOf(v);
  if (p.kind !== ValueKind.Context) {
    throw new AllegroError(`${primName}: attrs must be an Object`);
  }
  const ctx = p as ContextValue;
  const attrs: import("./types.js").RuleAttrs = {};
  const nameVal = ctx.bindings.get("name")?.value;
  if (nameVal) attrs.name = stringArg(nameVal, primName);
  const unwrapVal = ctx.bindings.get("unwrap")?.value;
  if (unwrapVal) attrs.unwrap = true;
  const flattenVal = ctx.bindings.get("flatten")?.value;
  if (flattenVal) attrs.flatten = true;
  const precVal = ctx.bindings.get("prec")?.value;
  if (precVal) attrs.prec = stringArg(precVal, primName);
  const assocVal = ctx.bindings.get("assoc")?.value;
  if (assocVal) {
    const s = stringArg(assocVal, primName);
    if (s !== "left" && s !== "right" && s !== "none") {
      throw new AllegroError(`${primName}: assoc must be 'left', 'right', or 'none'`);
    }
    attrs.assoc = s;
  }
  const longestVal = ctx.bindings.get("longest")?.value;
  if (longestVal) attrs.longest = true;
  return Object.keys(attrs).length > 0 ? attrs : undefined;
}

// --- Constructor primitives ---

const grammar2_new_impl: PrimitiveFnImpl = () => {
  return handleToValue(store(makeGrammar()));
};

const grammar2_lit_impl: PrimitiveFnImpl = (args) => {
  return handleToValue(store(lit(stringArg(args[0], "grammar2_lit"))));
};

const grammar2_cls_impl: PrimitiveFnImpl = (args) => {
  return handleToValue(store(cls(stringArg(args[0], "grammar2_cls"))));
};

const grammar2_regex_impl: PrimitiveFnImpl = (args) => {
  return handleToValue(store(regex(stringArg(args[0], "grammar2_regex"))));
};

const grammar2_eof_impl: PrimitiveFnImpl = () => handleToValue(store(eof));
const grammar2_empty_impl: PrimitiveFnImpl = () => handleToValue(store(empty));
const grammar2_fail_impl: PrimitiveFnImpl = () => handleToValue(store(fail));

const grammar2_indent_impl: PrimitiveFnImpl = (args) => {
  const d = stringArg(args[0], "grammar2_indent");
  if (d !== "NEWLINE" && d !== "INDENT" && d !== "DEDENT" && d !== "SAMELINE") {
    throw new AllegroError(`grammar2_indent: directive must be NEWLINE/INDENT/DEDENT/SAMELINE, got '${d}'`);
  }
  return handleToValue(store(indentTerm(d as IndentDirective)));
};

const grammar2_nonterm_impl: PrimitiveFnImpl = (args) => {
  return handleToValue(store(nonterm(stringArg(args[0], "grammar2_nonterm"))));
};

const grammar2_seq_impl: PrimitiveFnImpl = (args) => {
  const items = arrayArg(args[0], "grammar2_seq").map(v =>
    fetch(handleArg(v, "grammar2_seq item"), "Rule") as Rule,
  );
  return handleToValue(store(seq(items)));
};

const grammar2_alt_impl: PrimitiveFnImpl = (args) => {
  const options = arrayArg(args[0], "grammar2_alt").map(v =>
    fetch(handleArg(v, "grammar2_alt option"), "Rule") as Rule,
  );
  const attrs = readAttrs(args[1], "grammar2_alt");
  return handleToValue(store(alt(options, attrs)));
};

const grammar2_rep_impl: PrimitiveFnImpl = (args) => {
  const item = fetch(handleArg(args[0], "grammar2_rep"), "Rule") as Rule;
  const opts: { min?: number; max?: number | null; sep?: Rule } = {};
  if (args[1]) {
    const p = dataOf(args[1]);
    if (p.kind !== ValueKind.Context) {
      throw new AllegroError("grammar2_rep: opts must be an Object");
    }
    const ctx = p as ContextValue;
    const minV = ctx.bindings.get("min")?.value;
    if (minV) opts.min = intArg(minV, "grammar2_rep.min");
    const maxV = ctx.bindings.get("max")?.value;
    if (maxV) opts.max = intArg(maxV, "grammar2_rep.max");
    const sepV = ctx.bindings.get("sep")?.value;
    if (sepV) opts.sep = fetch(handleArg(sepV, "grammar2_rep.sep"), "Rule") as Rule;
  }
  return handleToValue(store(rep(item, opts)));
};

const grammar2_opt_impl: PrimitiveFnImpl = (args) => {
  const item = fetch(handleArg(args[0], "grammar2_opt"), "Rule") as Rule;
  return handleToValue(store(opt(item)));
};

const grammar2_guarded_impl: PrimitiveFnImpl = (args) => {
  const item  = fetch(handleArg(args[0], "grammar2_guarded"), "Rule") as Rule;
  const guard = fetch(handleArg(args[1], "grammar2_guarded"), "Guard") as Guard;
  return handleToValue(store(guarded(item, guard)));
};

const grammar2_not_followed_by_impl: PrimitiveFnImpl = (args) => {
  const r = fetch(handleArg(args[0], "grammar2_not_followed_by"), "Rule") as Rule;
  return handleToValue(store(notFollowedBy(r)));
};

const grammar2_followed_by_impl: PrimitiveFnImpl = (args) => {
  const r = fetch(handleArg(args[0], "grammar2_followed_by"), "Rule") as Rule;
  return handleToValue(store(followedBy(r)));
};

const grammar2_reserved_impl: PrimitiveFnImpl = (args) => {
  const name = stringArg(args[0], "grammar2_reserved");
  return handleToValue(store(reserved(name)));
};

const grammar2_add_production_impl: PrimitiveFnImpl = (args) => {
  const g    = fetch(handleArg(args[0], "grammar2_add_production"), "Grammar") as Grammar;
  const name = stringArg(args[1], "grammar2_add_production");
  const rule = fetch(handleArg(args[2], "grammar2_add_production"), "Rule") as Rule;
  const attrs = readAttrs(args[3], "grammar2_add_production");
  addProduction(g, { name, rule, attrs });
  return args[0]; // return the grammar handle for chaining
};

const grammar2_set_start_impl: PrimitiveFnImpl = (args) => {
  const g = fetch(handleArg(args[0], "grammar2_set_start"), "Grammar") as Grammar;
  g.start = stringArg(args[1], "grammar2_set_start");
  return args[0];
};

const grammar2_reserved_set_impl: PrimitiveFnImpl = (args) => {
  const g       = fetch(handleArg(args[0], "grammar2_reserved_set"), "Grammar") as Grammar;
  const setName = stringArg(args[1], "grammar2_reserved_set");
  const entries = arrayArg(args[2], "grammar2_reserved_set").map(v => stringArg(v, "grammar2_reserved_set"));
  g.reserved.set(setName, new Set(entries));
  return args[0];
};

// --- Parse ---

const grammar2_parse_impl: PrimitiveFnImpl = (args) => {
  const g     = fetch(handleArg(args[0], "grammar2_parse"), "Grammar") as Grammar;
  const input = stringArg(args[1], "grammar2_parse");
  const result = engineParse(g, input);
  if (!result.ok) {
    const components = new Map<string, Value>([
      ["error", withType(stringToBits(result.error.message), StringType)],
      ["type",  ErrorType],
    ]);
    return makeMultiValue(makeInt(0), components);
  }
  return treeToValue(result.tree);
};

function treeToValue(tree: ParseTree): Value {
  switch (tree.kind) {
    case "leaf":
      return withType(stringToBits(tree.text), StringType);
    case "branch": {
      const childValues = tree.children.map(treeToValue);
      const arr = makeArray(childValues);
      if (tree.tag) {
        // Tagged branch: Object { tag: String, children: Array }
        return makeObject([
          ["tag", withType(stringToBits(tree.tag), StringType)],
          ["children", arr],
        ]);
      }
      return arr;
    }
    case "none":
      return noneSingleton;
    case "error": {
      const components = new Map<string, Value>([
        ["error", withType(stringToBits(tree.message), StringType)],
        ["type",  ErrorType],
      ]);
      const inner = tree.inner ? treeToValue(tree.inner) : makeInt(0);
      return makeMultiValue(dataOf(inner), components);
    }
  }
}

// --- Exports ---

export const grammar2Primitives: Record<string, Value> = {
  grammar2_new:             makePrimitive("grammar2_new", grammar2_new_impl),
  grammar2_lit:             makePrimitive("grammar2_lit", grammar2_lit_impl),
  grammar2_cls:             makePrimitive("grammar2_cls", grammar2_cls_impl),
  grammar2_regex:           makePrimitive("grammar2_regex", grammar2_regex_impl),
  grammar2_eof:             makePrimitive("grammar2_eof", grammar2_eof_impl),
  grammar2_empty:           makePrimitive("grammar2_empty", grammar2_empty_impl),
  grammar2_fail:            makePrimitive("grammar2_fail", grammar2_fail_impl),
  grammar2_indent:          makePrimitive("grammar2_indent", grammar2_indent_impl),
  grammar2_nonterm:         makePrimitive("grammar2_nonterm", grammar2_nonterm_impl),
  grammar2_seq:             makePrimitive("grammar2_seq", grammar2_seq_impl),
  grammar2_alt:             makePrimitive("grammar2_alt", grammar2_alt_impl),
  grammar2_rep:             makePrimitive("grammar2_rep", grammar2_rep_impl),
  grammar2_opt:             makePrimitive("grammar2_opt", grammar2_opt_impl),
  grammar2_guarded:         makePrimitive("grammar2_guarded", grammar2_guarded_impl),
  grammar2_not_followed_by: makePrimitive("grammar2_not_followed_by", grammar2_not_followed_by_impl),
  grammar2_followed_by:     makePrimitive("grammar2_followed_by", grammar2_followed_by_impl),
  grammar2_reserved:        makePrimitive("grammar2_reserved", grammar2_reserved_impl),
  grammar2_add_production:  makePrimitive("grammar2_add_production", grammar2_add_production_impl),
  grammar2_set_start:       makePrimitive("grammar2_set_start", grammar2_set_start_impl),
  grammar2_reserved_set:    makePrimitive("grammar2_reserved_set", grammar2_reserved_set_impl),
  grammar2_parse:           makePrimitive("grammar2_parse", grammar2_parse_impl),
};
