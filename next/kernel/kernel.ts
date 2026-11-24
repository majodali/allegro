// The reference kernel (chunks K2 and K3 of docs/plans/book-pass.md).
//
// It implements the kernel's interface (next/kernel/interface.ts) for
// what milestone 1 of the rebuild needs, and the kernel's half of
// milestone 2: values of the seven kinds, scopes and names, cells, and
// the evaluation of names, structures, calls of composed functions and
// calls of primitive functions. It is the reference: small and plain,
// with no attempt at speed.
//
// What it realises, from docs/plans/book-pass-inventory.md:
//   "The kernel is passive", "What the kernel's interface offers",
//   "No interface call writes a bare claim outcome", "Limits are step budgets",
//   "Seven representation kinds", "Expressions are values, forming a DAG",
//   "A composed function is parameters and a body",
//   "A call is evaluated by evaluating the function's body",
//   "Evaluation is total over unresolved information",
//   "A missing value is a cell that is filled once",
//   "When information arrives, what waited on it is evaluated again",
//   "A refutation marks everything computed from it",
//   "A language checks the names it cares about" (the kernel's half: an
//   unbound name is a residual, never a refutation).
//
// How evaluation goes. A value of kind bits, a function and a primitive
// evaluate to themselves. A structure evaluates its entries, in order. A
// symbol is a name: it evaluates to what its scope binds it to, and to a
// residual that waits on the name where nothing binds it yet. A cell
// evaluates to what it was filled with, and to itself until then. An
// expression applies what its function evaluates to.
//
// Arguments are evaluated when they are needed. A composed function is
// applied by putting its arguments, not yet evaluated, in place of its
// parameters in the body, and evaluating that. An argument is evaluated
// when something in the body needs its value, which in the end is a
// primitive function: a primitive function needs every argument, and
// runs when each is fully known. An argument is evaluated at most once,
// however often the body uses it, and in the scope where it was
// written. An argument nothing needs is never evaluated: an effect in it
// does not happen and a refutation in it marks nothing. No argument can
// be inspected: there is no value of an expression's kind that a
// function can look into.
//
// An effect happens when its value is needed. The statements of a body
// are a chain of `then`. A structure does not need its entries: each is
// evaluated when something reads it, at most once. A primitive function
// needs its arguments in full, left to right, so a structure handed to
// one has every entry evaluated first, in order. A caller of `evaluate`
// is given the value it asked for and no more: an entry of a structure
// in the result is evaluated when the caller evaluates it. There is no
// call for a whole value: a host that wants one evaluates the entries it
// reads. A function's free names are tied to the
// scope in which the function value is first evaluated, so a function
// means the same wherever it is later called.
//
// The kernel's own primitives, by name (chunk K4 fixed the list; fields
// and the questions about keys are not built yet):
//   "if"        if(condition, then, else). It needs its condition, which
//               must come to one of the kernel's two truth values, and
//               then only the branch taken. While the condition is
//               unknown the whole stays a residual and neither branch is
//               evaluated. A form that gives a branch more knowledge
//               makes the branch a function of the names its condition
//               tested, and applies it to values that carry the fact.
//   "claim"     claim(x). True records the outcome "decided". Anything
//               else fully known is a refutation. Unknown stays a residual.
//   "assume"    assume(x). Records the outcome "assumed" and does not
//               evaluate x. The record names the module whose code wrote
//               the call, from the mark on it, and the call itself. A
//               claim that rests on an assumption comes out assumed,
//               never decided. An assumption that `withdraw` has named
//               is evaluated as a claim.
//   "undecided" undecided(reason). The answer of what decides a claim when
//               it cannot tell. A claim on it is done, with the outcome
//               "undecided" and that reason; it refutes nothing, and what
//               follows the claim goes ahead.
//   "describe"  describe(right, function). A description of the function,
//               as plain data. `right` is a key of the module that made
//               the function, or the inspection right. Where the function
//               holds an unforgeable value the description holds its
//               public identity only. A description is a program that
//               means the same: the bindings the function reads from a
//               block, and an argument used more than once and not yet
//               evaluated, are the bindings of a block around it.
//   "build"     build(description, names). The function a description
//               describes, which is a function or a block around one.
//               `names` is a structure keyed by symbols: the
//               value for each name the description leaves free. A free
//               name with no value is a refutation, so a built function
//               reads nothing from the place it is built. A refutation
//               too where the description holds the identity of an
//               unforgeable value: nothing makes authority from data, and
//               a live value is supplied under a name.
//   "block"     block(bindings, body). The bindings are a structure keyed
//               by symbols. They are one group, in a scope of their own:
//               each may use any other, and itself, so a recursive
//               function is one value. A binding's value is evaluated
//               when needed, at most once. The block's value is its
//               body's. No value of the language is or holds a scope.
//   "then"      then(first, second). It needs its first argument to be
//               over, and then its value is the second. Over: the first's
//               value is known, and nothing evaluating it started still
//               goes on. This is the one way a text's
//               order becomes an order of effects. While the first
//               waits, the second is evaluated ahead with no effect
//               performed, so a refutation in it is found at once.
//               Where the first is refuted the second is not done; it
//               is evaluated ahead all the same, so a further refutation
//               in it is found and counted. The same holds for "also".
//   "also"      also(first, second). It starts the first, then starts the
//               second, and its value is the second's. The second does
//               not wait for the first to be over: an effect in it is
//               performed while the first still waits. What a block's
//               statements are a chain of. Where the second's value is
//               known and the first still waits, the value is given and
//               the first goes on as work of the evaluation, taken up by
//               `advance`. Two things hold the second back as `then`
//               does: a first that is refuted, and a first that is
//               itself a claim that waits, so a claim holds what is
//               written after it. A claim inside a function the first
//               calls holds nothing here.
//   "same"      same(a, b). Tells two bits values apart, or two symbols:
//               true where they are the same. Anything else is a
//               refutation; the kernel gives bits no other meaning.
//   "join"      join(a, b). The bits of a followed by the bits of b.
//   "length"    length(a). The number of bits, as 64 bits.
//   "slice"     slice(a, from, count). `count` bits of a from place
//               `from`, the first bit being place 0.
//   "get"       get(structure, key). The entry keyed by a symbol, or at a
//               place counted from 0, or keyed by a key. The entry may
//               itself still wait.
//   "put"       put(structure, key, value). A new structure: the old one with
//               the entry added at its end, or in place of the entry
//               already under that key. The key is a symbol, one of the
//               module's keys for a private entry, or the empty structure
//               for an entry with no key. The value is not evaluated.
//   "key"       key(structure, place). The key of the entry there: a
//               symbol, or the empty structure where it has none.
//   "kind"      kind(value). What a value is, as a symbol: bits, symbol,
//               structure, function or key.
//   "symbol"    symbol(text). The symbol of that name, as data.
//   "spelling"  spelling(symbol). The symbol's name, as text.
//   "refuse"    refuse(reason). A refutation with that reason, a text. It is
//               how code says why it will not go on, and what a withheld
//               capability is: a refusal that happens when it is used.
//   "count"     count(structure). The number of entries, as 64 bits.
//               A place or a count outside the value is a refutation.
//               An entry keyed by a key is private: only `get` with that
//               key reads it. It has no place, is not counted, and is
//               not handed to a primitive function.
//   "attempt"   attempt(x, budget). Evaluates its first argument under a
//               budget of steps. Its answer is the value where there is
//               one. Where what was attempted was refuted, or reached
//               the limit, the answer is a failure, in the shape every
//               failure a program handles has: {failure: refuted,
//               reason: <text>} or {failure: limit}. A refutation
//               inside marks nothing outside.
// The truth values are the bits of length one: 1 is true, 0 is false.
// There is no quotation, and no argument can be inspected. A symbol that
// is data comes from a description, from a cell or from a primitive
// function.
//
// A description is a structure whose first entry is a symbol naming its
// form, all in the names `description.*`:
//   bits <bits>            symbol <symbol>          name <symbol>
//   param <depth> <index>  apply <fn> <args>        function <count> <body>
//   structure <entries>    kernel <name>            primitive <hash>
//   capability <name> <part>   key <module> <slot>  unknown
//   opaque <params>: a part another module wrote; only the parameters of
//                    the described function that it mentions are listed
// A parameter is named by its place, as in a module's content. The last
// four hold no value: they say what was there.
//
// Left for later chunks, and not attempted here:
//   - metadata fields, their rules, and origins (`fieldsOf` is empty and
//     `originOf` answers undefined);
//   - evaluating a branch that may not be taken, without capabilities;
//   - recursion on unknown arguments: a call is always opened, so only
//     the step budget ends such a recursion (chunk K5);
//   - building a description that holds an unforgeable value, by
//     supplying the value; and the block of bindings that lets a built
//     function bind its own names (Part III's loader needs both);
//   - the gate that keeps an effect from a value whose claims are
//     undecided, and the order of effects that become ready together.
//
// The second version of the interface (chunk K3) adds, here:
//   - modules and keys. `module` hashes a function's content, and makes
//     the module's keys from that identity;
//   - what a result rests on. While a claim is evaluated the kernel
//     collects the primitive functions that ran, the capabilities whose
//     answers it read, and the builders of restored outcomes it met;
//   - restore. A restored claim is not evaluated: it is decided, resting
//     on its builder.

// On 2026-11-20 this file was split in three, with no change in what it
// does (docs/plans/book-pass.md section 9): the representation is
// next/kernel/values.ts, what a kernel does that is no evaluation is
// next/kernel/core.ts, and this file is the reference kernel's evaluator
// and the interface it is reached through. A second variant shares the
// first two.

import type {
  Declaration,
  Advance, Cell, ClaimRecord, CreateKernel, Entry, Kernel, KeyDescription, Kind, Limits, Outcome, Place, PrimitiveContext, PrimitiveDeclaration, Rest, Result,
  Value,
} from "./interface.js";
import { INTERFACE_VERSION, InterfaceError, KernelFault, Refusal } from "./interface.js";
import { sha256Text } from "./hash.js";

export { InterfaceError, KernelFault } from "./interface.js";

import { createCore } from "./core.js";
import { Bits, CellV, Decided, Expr, Fn, INSPECT, KernelPrim, Key, Lazy, LimitReached, NameRef, Param, Prim, Quoted, Refuted, ScopeV, Struct, Sym } from "./values.js";
import type { Account, Binding, Group, Root, V } from "./values.js";

/** Creates a reference kernel. It does nothing until it is called. */
export const createKernel: CreateKernel = () => {
  const core = createCore();
  const {
    symbols, kernelPrims, settled, built, moduleIds, moduleDeclares, modulesById, pureByHash, keys,
    restKey, TRUE, FALSE, out, isV, into, through, seen, bindingOf, known, hidden, knownInFull,
    asData, blockNames, freeNames, utf8, intern, kindOf, wrong, bitsOf, symbolName, entriesOf, hex,
    contentOf, enclosing, markAll, identityOf, declarationsFor, closedFor, claimKey, text, number,
    numberOf, bitList, whole, packed, count64, countOf, textOf, data, failure, list, build, closed,
    restored, thenGroups, localKey, keep, tallies, waitingAt, waitingClaims, counted, tallyOf,
    tallied, claimRecords, supply, tie, close, substitute, heldByClaim, oneStep, sameInformation,
    truthOf, describe, closedTo, boundValue, describeWhole, withdrawnModules, withdrawnSites, asBody, tell, observed, aheadIs,
    shared,
  } = core;
  const roots: Root[] = [];
  const rootOf = new WeakMap<object, Root>();
  /** The instances of each module: one for each distinct set of arguments. */
  const instancesOf = new WeakMap<Fn, { args: readonly V[]; value: Lazy }[]>();
  const VARIANT = "reference-k3";
  /**
   * What `advance` is to take up, in order: an evaluation is put here when a cell it waits
   * on is filled, so answers are acted on in the order they arrive, and an evaluation that
   * waits on none of the cells filled is left alone.
   */
  const ready: Root[] = [];
  /** How many cells have been filled: an evaluation that a fill overtook is taken up again. */
  let fills = 0;
  let spent = 0;
  let budget = Infinity;
  /** What the evaluations now under way rest on: one collector for each claim or binding being evaluated. */
  const collectors: Map<string, Rest>[] = [];
  /** The capability part now running, so a cell it makes knows where its answer comes from. */
  let running: Rest | undefined;
  /** True while evaluating what follows something not yet done: no effect is performed there. */
  let ahead = false;
  /** True where this call met a refutation and ran out of steps while looking for more. */
  let cut = false;
  /** True while a function is specialized: both branches of a conditional whose condition is unknown are evaluated. */
  let speculative = false;
  /** Under a check: how many conditions it could not decide enclose what is being evaluated. */
  let unsure = 0;
  /**
   * Set while a check is made (`check`): what the evaluation made and has not needed, each
   * to be evaluated before the check is over, the functions it met, each to have its body
   * evaluated, and the refutations found in parts that do not refute the whole.
   */
  interface Reaching { readonly lazies: Lazy[]; readonly fns: Fn[]; readonly opened: Set<Fn>; readonly found: { reason: string; at?: Place }[]; readonly noted: Set<Refuted>; draining: boolean }
  let reaching: Reaching | undefined;
  /** A part came out refuted that the whole is not refuted by. A refuted claim is in the claims' records already. */
  const found = (r: V, part: V): void => {
    if (reaching === undefined || !(r instanceof Refuted) || counted.has(r) || reaching.noted.has(r)) return;
    reaching.noted.add(r);
    const at = part instanceof Expr || part instanceof Fn || part instanceof Struct ? part.at : undefined;
    reaching.found.push({ reason: r.reason, ...(at === undefined ? {} : { at }) });
    tell(part, { kind: "refutation", reason: r.reason });
  };
  /** The functions being opened while evaluating ahead. */
  const opening: Fn[] = [];
  /** The sequences whose first part is being evaluated now, outermost first. */
  const groups: Group[] = [];
  /** Set by `waitsOn` when it passes a `then` that waits for work its first part started. */
  let sawGroup = false;
  aheadIs(() => ahead);
  const rest = (r: Rest): void => {
    for (const c of collectors) c.set(localKey(r), r);
  };
  /** Evaluates under a fresh collector and returns what the evaluation rested on. */
  const collecting = <T>(body: () => T): { value: T; rests: Rest[] } => {
    const mine = new Map<string, Rest>();
    collectors.push(mine);
    try {
      return { value: body(), rests: [...mine.values()] };
    } finally {
      collectors.pop();
    }
  };

  // ---- Evaluation ---------------------------------------------------------

  const step = (): void => {
    if (spent >= budget) throw new LimitReached();
    spent++;
  };
  /** Charges work on bits: one step for each 64 bits handled, beyond the step of the call itself. */
  const charge = (bits: number): void => {
    const steps = Math.floor(bits / 64);
    if (steps === 0) return;
    if (spent + steps > budget) {
      spent = budget;
      throw new LimitReached();
    }
    spent += steps;
  };

  const context: PrimitiveContext = {
    bits: (bytes, bitLength) => out(new Bits(bytes, bitLength ?? bytes.length * 8)),
    symbol: (fqn) => out(new Quoted(intern(fqn))),
    structure: (entries) => out(asData(new Struct(entries.map(([k, e]) => [k === null ? null : into(k, "a key"), into(e, "an entry")] as const)), "a structure a primitive builds")),
    kind: (v) => kindOf(into(v, "the value")),
    bitsOf: (v) => bitsOf(into(v, "the value")),
    symbolName: (v) => symbolName(into(v, "the value")),
    entriesOf: (v) => entriesOf(into(v, "the value"), true),
    cell: () => out(new CellV(running)) as Cell,
  };

  /** What an evaluation leaves in place of a part is that part's writer's: a residual keeps its mark. */
  const evaluate = (v: V, scope: ScopeV): V => keep(v, evaluated(v, scope));
  const evaluated = (v: V, scope: ScopeV): V => {
    if (v instanceof Sym) return evaluate(new NameRef(scope, v), scope);
    if (v instanceof NameRef) {
      const found = bindingOf(v);
      if (found === undefined) return new Refuted(`the name ${v.sym.fqn} is bound by no block around it`, undefined);
      if (found.binding.memo !== undefined) {
        found.binding.rests.forEach(rest);
        return found.binding.memo;
      }
      const { value: r, rests } = collecting(() => evaluate(found.binding.value, found.scope));
      rests.forEach(rest);
      if (known(r)) {
        found.binding.memo = r;
        found.binding.rests = rests;
      }
      return r;
    }
    if (v instanceof CellV) {
      if (!v.filled) return v;
      if (v.source !== undefined) rest(v.source);
      return v.value as V;
    }
    if (v instanceof Fn) {
      const made = close(v, scope);
      reaching?.fns.push(made);
      return made;
    }
    if (v instanceof Lazy) {
      if (v.done) {
        v.rests.forEach(rest);
        return v.value;
      }
      // A value that needs itself has no value: `n = n + 1`, read, would never end.
      if (v.busy) return new Refuted("a value that needs itself to be known", undefined);
      v.busy = true;
      let got: { value: V; rests: Rest[] };
      try {
        got = collecting(() => evaluate(v.value, v.scope));
      } finally {
        v.busy = false;
      }
      const { value: r, rests } = got;
      rests.forEach(rest);
      v.rests = [...v.rests, ...rests];
      v.value = r;
      if (r instanceof Refuted || known(r)) {
        v.done = true;
        return r;
      }
      return v; // It still waits. It stays one thing, so whatever is left in it is done once.
    }
    if (v instanceof Struct) {
      // A structure does not need its entries. Each is kept as written, tied to this scope,
      // and is evaluated when something reads it, at most once.
      if (settled.has(v) || built.has(v)) return v;
      const r = new Struct(v.entries.map(([k, e]) => [k, later(e, scope)] as const));
      built.add(r);
      return r;
    }
    if (!(v instanceof Expr)) return v; // bits, a parameter, a primitive, a quotation, an outcome, a refutation

    const stored = restored.get(v);
    if (stored !== undefined) {
      stored.forEach(rest);
      return tallied(v, new Decided(TRUE, stored), []);
    }
    step();
    const fn = evaluate(v.fn, scope);
    if (fn instanceof Refuted) return fn;

    if (fn instanceof KernelPrim) {
      if (v.args.length !== fn.arity) return new Refuted(`"${fn.name}" takes ${fn.arity} argument(s) and was given ${v.args.length}`, undefined);
      // An assumption a configuration has withdrawn is not taken on trust: it is a claim.
      const withdrawn = fn.name === "assume" && (withdrawnSites.has(v.site ?? v) || withdrawnModules.has(v.owner?.module ?? ""));
      if (fn.name === "claim" || withdrawn) {
        const { value: claimed, rests } = collecting(() => evaluate(v.args[0], scope));
        rests.forEach(rest);
        if (claimed instanceof Refuted) return tallied(v, claimed, rests);
        // What decides the claim answered that it cannot tell: the claim is done, and undecided.
        const told = through(claimed);
        if (told instanceof Decided && told.outcome === "undecided") return tallied(v, new Decided(told.inner, [{ kind: "kernel", variant: VARIANT }, ...rests], "undecided", told.reason), rests);
        if (truthOf(claimed) === true) {
          // A claim that rests on an assumption is no stronger than assumed.
          // And one that rests on a sample is no stronger than sampled.
          const assumed = rests.some((r) => r.kind === "assumption");
          const sampled = rests.some((r) => r.kind === "kernel" && r.sampled !== undefined);
          return tallied(v, new Decided(seen(claimed), [{ kind: "kernel", variant: VARIANT }, ...rests], assumed ? "assumed" : sampled ? "sampled" : "decided"), rests);
        }
        if (known(claimed)) return tallied(v, new Refuted("a claim that is not true", claimed), rests);
        return tallied(v, new Expr(fn, [claimed]), rests);
      }
      if (fn.name === "assume") {
        // The claim is not evaluated. The record says who assumed it, the module whose code
        // this is, and which assumption it is: the one written here.
        const by: Rest = { kind: "assumption", by: v.owner?.module ?? "", at: out(v.site ?? v) };
        rest(by);
        return new Decided(TRUE, [by], "assumed");
      }
      if (fn.name === "if") {
        // The condition is needed; a branch is needed only if it is the one taken.
        const condition = evaluate(v.args[0], scope);
        if (condition instanceof Refuted) return condition;
        const truth = truthOf(condition);
        if (observed() && (truth !== undefined || !known(condition))) tell(v, { kind: "branch", taken: truth === true ? "then" : truth === false ? "else" : speculative ? "both" : "neither" });
        if (truth === true) return evaluate(v.args[1], scope);
        if (truth === false) return evaluate(v.args[2], scope);
        if (known(condition)) return new Refuted("a condition that is neither true nor false", condition);
        // Specializing, both branches are evaluated though the condition is unknown. A
        // refutation inside a branch stays in that branch.
        if (speculative) {
          unsure++;
          let yes: V, no: V;
          try {
            [yes, no] = [evaluate(v.args[1], scope), evaluate(v.args[2], scope)];
          } finally {
            unsure--;
          }
          found(yes, v.args[1]);
          found(no, v.args[2]);
          return new Expr(fn, [condition, yes, no]);
        }
        return new Expr(fn, [condition, later(v.args[1], scope), later(v.args[2], scope)]);
      }
      if (fn.name === "specialize") {
        // A function's body evaluated with its parameters unknown, under a budget. Nothing is
        // performed: an effect stays in what is left. A call to the function itself, met
        // while its body is evaluated, is not opened again. The answer is a function of the
        // same parameters whose body is what is left, of the module that made the original.
        const args = v.args.map((a) => evaluate(a, scope));
        const wrong = args.find((a) => a instanceof Refuted);
        if (wrong !== undefined) return wrong;
        if (!known(args[0]) || !known(args[1])) return new Expr(fn, args);
        const [f, budgetBits] = [seen(args[0]), seen(args[1])];
        if (!(budgetBits instanceof Bits)) return new Refuted("a specialization's budget is a number of steps, as bits", args[1]);
        if (f instanceof Prim || f instanceof KernelPrim) return f;
        if (!(f instanceof Fn)) return new Refuted("only a function can be specialized", args[0]);
        const [outer, wasAhead, wasSpeculative] = [budget, ahead, speculative];
        budget = Math.min(outer, spent + numberOf(budgetBits));
        ahead = true;
        speculative = true;
    // The body is evaluated with parameters of its own. What is left may hold the original
        // function, as a call to itself that was not opened, and the two must not share theirs.
        const params = f.params.map((p) => new Param(p.name));
        const body = substitute(f.body, new Map(f.params.map((p, i) => [p, params[i]] as const)), new Map());
        opening.push(f);
        let left: V;
        try {
          left = evaluate(body, scope);
        } catch (e) {
          if ((e instanceof LimitReached && spent < outer) || e instanceof RangeError) {
            rest({ kind: "limit" });
            return failure("limit");
          }
          throw e;
        } finally {
          budget = outer;
          ahead = wasAhead;
          speculative = wasSpeculative;
          opening.pop();
        }
        // A body refuted whatever its parameters is a refutation of the whole.
        if (left instanceof Refuted) return left;
        const made = new Fn(params, asBody(left));
        made.owner = f.owner;
        return close(made, scope);
      }
      if (fn.name === "sample") {
        // A claim evaluated on the cases it is given. True of each, it is sampled. A case it
        // is not true of refutes it, and is the counterexample.
        const args = v.args.map((a) => evaluate(a, scope));
        const wrong = args.find((a) => a instanceof Refuted);
        if (wrong !== undefined) return wrong;
        if (!known(args[0]) || !known(args[1])) return new Expr(fn, args);
        const cases = seen(args[1]);
        if (!(cases instanceof Struct)) return new Refuted("the cases of a sample are a structure", args[1]);
        const open = cases.entries.filter(([k]) => !hidden(k));
        const { value: verdict, rests } = collecting((): V => {
          for (const [, one] of open) {
            const r = evaluate(new Expr(args[0], [one]), scope);
            if (r instanceof Refuted) return r;
            if (truthOf(r) === true) continue;
            if (known(r)) return new Refuted("a claim that is not true of a case it was sampled on", one);
            return new Expr(fn, args);
          }
          return TRUE;
        });
        rests.forEach(rest);
        if (verdict !== TRUE) return tallied(v, verdict, rests);
        const sample: Rest = { kind: "kernel", variant: VARIANT, sampled: open.length };
        rest(sample);
        return tallied(v, new Decided(TRUE, [sample, ...rests], "sampled"), rests);
      }
      if (fn.name === "block") {
        // The bindings are one group in a scope of their own: each may use any other, and
        // itself. A binding's value is evaluated when something needs it, at most once.
        const bindings = v.args[0];
        if (!(bindings instanceof Struct)) return new Refuted("a block's bindings are written as a structure", undefined);
        const inner = new ScopeV(scope);
        for (const [k, e] of bindings.entries) {
          const name = k === null ? undefined : seen(k);
          if (!(name instanceof Sym)) return new Refuted("each binding of a block is keyed by a symbol", undefined);
          if (inner.bindings.has(name)) return new Refuted(`the name ${name.fqn} is bound twice in one block`, undefined);
          const bound = e instanceof Fn || !(e instanceof Expr || e instanceof Sym || e instanceof Struct) ? e : new Lazy(e, inner);
          if (bound instanceof Lazy) reaching?.lazies.push(bound);
          // A function bound by a block is a function met, whether or not anything reads the name.
          else if (bound instanceof Fn && reaching !== undefined) reaching.lazies.push(new Lazy(new NameRef(inner, name), inner));
          inner.bindings.set(name, { value: bound, memo: undefined, rests: [] });
        }
        return evaluate(v.args[1], inner);
      }
      if (fn.name === "put") {
        // A new structure: the old one with this entry added at its end, or put in place of the
        // entry already under that key. The value is not evaluated: an entry is evaluated when read.
        const [target, k] = [evaluate(v.args[0], scope), evaluate(v.args[1], scope)];
        if (target instanceof Refuted) return target;
        if (k instanceof Refuted) return k;
        const s = seen(target);
        if (!(s instanceof Struct)) return known(target) ? new Refuted("only a structure can be given an entry", target) : new Expr(fn, [target, k, later(v.args[2], scope)]);
        if (!known(k)) return new Expr(fn, [target, k, later(v.args[2], scope)]);
        const key = seen(k);
        const none = key instanceof Struct && key.entries.length === 0;
        if (!none && !(key instanceof Sym) && !(key instanceof Key)) return new Refuted("an entry's key is a symbol, a key, or the empty structure for none", k);
        charge(s.entries.length);
        const value = later(v.args[2], scope);
        const at = none ? -1 : s.entries.findIndex(([x]) => x !== null && seen(x) === key);
        const entries = at < 0 ? [...s.entries, [none ? null : (key as V), value] as const] : s.entries.map((e, i) => (i === at ? ([e[0], value] as const) : e));
        const made = new Struct(entries);
        built.add(made);
        return made;
      }
      if (fn.name === "then") {
        // The first is over, and only then the second. Over means its value is known and
        // nothing that evaluating it started still goes on: a caller who writes `then` cannot
        // see what a function it calls left going. While the first is not over, the second is
        // evaluated ahead with no effect performed, so a refutation in it is found now.
        const group: Group = thenGroups.get(v) ?? { pending: new Set(), refuted: undefined };
        groups.push(group);
        let first: V;
        try {
          first = evaluate(v.args[0], scope);
        } finally {
          groups.pop();
        }
        // A refutation in what the first started is a refutation of the first.
        const wrong = first instanceof Refuted ? first : group.refuted;
        if (wrong !== undefined) {
          lookAhead(v.args[1], scope);
          return wrong;
        }
        if (known(first) && group.pending.size === 0) return evaluate(v.args[1], scope);
        const before = ahead;
        ahead = true;
        let second: V;
        try {
          second = evaluate(v.args[1], scope);
        } finally {
          ahead = before;
        }
        if (second instanceof Refuted) return second;
        const left = new Expr(fn, [first, second instanceof Lazy || !(second instanceof Expr || second instanceof NameRef) ? second : later(second, scope)]);
        thenGroups.set(left, group);
        return left;
      }
      if (fn.name === "also") {
        // The first is started, and then the second; the second does not wait for the first.
        const first = evaluate(v.args[0], scope);
        if (first instanceof Refuted) {
          lookAhead(v.args[1], scope);
          return first;
        }
        if (known(first)) return evaluate(v.args[1], scope);
        // A claim that waits holds what is written after it: no effect of it is performed.
        const held = heldByClaim(first);
        const before = ahead;
        if (held) ahead = true;
        let second: V;
        try {
          second = evaluate(v.args[1], scope);
        } finally {
          ahead = before;
        }
        if (second instanceof Refuted) return second;
        // The second is known and nothing holds it: its value is given now, and the first
        // goes on as work of this evaluation. Ahead of what is done nothing was started, so
        // nothing goes on: the whole is evaluated again when it is really reached.
        if (!held && !ahead && known(second)) {
          started(first, scope);
          return second;
        }
        return new Expr(fn, [first, second instanceof Lazy || !(second instanceof Expr || second instanceof NameRef) ? second : later(second, scope)]);
      }
      if (fn.name === "first") {
        // Both are started, and the value is that of whichever is known first; where both
        // are known at once, the first written. This kernel evaluates what is left of the
        // whole again each time an answer comes, so "at once" here is "by the same call".
        // What is left of the one that lost is not kept, so nothing goes on with it.
        const one = evaluate(v.args[0], scope);
        if (one instanceof Refuted || known(one)) return one;
        const other = evaluate(v.args[1], scope);
        if (other instanceof Refuted || known(other)) return other;
        const kept = (x: V): V => (x instanceof Lazy || !(x instanceof Expr || x instanceof NameRef) ? x : later(x, scope));
        return new Expr(fn, [kept(one), kept(other)]);
      }
      if (fn.name === "attempt") {
        // The budget is needed; what is attempted is evaluated inside the attempt.
        const steps = evaluate(v.args[1], scope);
        if (steps instanceof Refuted) return steps;
        const budgetBits = seen(steps);
        if (!known(steps)) return new Expr(fn, [later(v.args[0], scope), steps]);
        if (!(budgetBits instanceof Bits)) return new Refuted("an attempt's budget is a number of steps, as bits", steps);
        const outer = budget;
        budget = Math.min(outer, spent + numberOf(budgetBits));
        let r: V;
        try {
          r = evaluate(v.args[0], scope);
        } catch (e) {
          // The attempt's own budget ran out, or the kernel's own limit was reached inside it:
          // either way the answer is "limit", and what goes on from it rests on a limit.
          if ((e instanceof LimitReached && spent < outer) || e instanceof RangeError) {
            rest({ kind: "limit" });
            return failure("limit");
          }
          throw e;
        } finally {
          budget = outer;
        }
        if (r instanceof Refuted) return failure("refuted", text(r.reason));
        if (known(r)) return r;
        // It waits on something. What is left is attempted again, so nothing done so far is done twice.
        return new Expr(fn, [r, steps]);
      }
      const args: V[] = [];
      for (const a of v.args) {
        const r = evaluate(a, scope);
        if (r instanceof Refuted) return r;
        args.push(r);
      }
      const waits = (): V => new Expr(fn, args);
      if (fn.name === "describe") {
        const [right, f] = [seen(args[0]), args[1]];
        if (!known(right) || !known(f)) return waits();
        if (!(right instanceof Key)) return new Refuted("describing a function needs a key or the inspection right", right);
        if (!(f instanceof Fn)) return new Refuted("only a function can be described", f);
        const all = right.module === INSPECT;
        if (!all && f.owner?.module !== right.module)
          return new Refuted("describing a function needs a key of the module that made it, or the inspection right", undefined);
        return describeWhole(f, all ? undefined : right.module);
      }
      if (fn.name === "build") {
        // A description is read whole, so it is needed in full.
        const description = inFull(args[0], scope);
        if (description instanceof Refuted) return description;
        if (!knownInFull(description)) return waits();
        const built = build(description, []);
        if (built instanceof Refuted) return built;
        // A function, or a block around one: the bindings the function reads, each evaluated at most once.
        const blockOf = built instanceof Expr && built.fn === kernelPrims.get("block") && built.args.length === 2 && built.args[1] instanceof Fn;
        if (!(built instanceof Fn) && !blockOf) return new Refuted("only the description of a function can be built", args[0]);
        // A built function reads nothing from where it is built: each name the description
        // leaves free takes the value supplied for it, and one with no value is refused.
        const supplied = seen(args[1]);
        if (!(supplied instanceof Struct)) return known(args[1]) ? new Refuted("the names supplied to build are a structure keyed by symbols", args[1]) : waits();
        const values = new Map<Sym, V>();
        for (const [k, e] of supplied.entries) {
          const name = k === null ? undefined : seen(k);
          if (!(name instanceof Sym)) return new Refuted("the names supplied to build are a structure keyed by symbols", args[1]);
          values.set(name, e);
        }
        const whole = supply(built, values, new Set());
        const missing = freeNames(whole, new Set(), [], new Map());
        if (missing.length > 0) return new Refuted(`the description leaves ${missing.map((m) => m.fqn).join(", ")} free, and no value was supplied`, undefined);
        // What is built is the builder's: it takes the mark of the code that called `build`.
        if (v.owner !== undefined) markAll(whole, v.owner.module, v.owner.fn, new Set());
        return whole instanceof Fn ? close(whole, scope) : evaluate(whole, scope);
      }
      if (fn.name === "same") {
        if (!known(args[0]) || !known(args[1])) return waits();
        const [a, b] = [seen(args[0]), seen(args[1])];
        if (a instanceof Bits && b instanceof Bits) {
          if (a.bitLength !== b.bitLength) return FALSE;
          charge(a.bitLength);
          if (whole(a) && whole(b)) return a.bytes.every((x, i) => x === b.bytes[i]) ? TRUE : FALSE;
          const [x, y] = [bitList(a), bitList(b)];
          return x.every((bit, i) => bit === y[i]) ? TRUE : FALSE;
        }
        if (a instanceof Sym && b instanceof Sym) return a === b ? TRUE : FALSE;
        return new Refuted("only two bits values or two symbols can be told apart", undefined);
      }
      if (fn.name === "join") {
        if (!known(args[0]) || !known(args[1])) return waits();
        const [a, b] = [seen(args[0]), seen(args[1])];
        if (!(a instanceof Bits && b instanceof Bits)) return new Refuted("only two bits values can be joined", undefined);
        charge(a.bitLength + b.bitLength);
        if (whole(a) && whole(b)) {
          const bytes = new Uint8Array(a.bytes.length + b.bytes.length);
          bytes.set(a.bytes, 0);
          bytes.set(b.bytes, a.bytes.length);
          return new Bits(bytes, bytes.length * 8);
        }
        return packed([...bitList(a), ...bitList(b)]);
      }
      if (fn.name === "length") {
        if (!known(args[0])) return waits();
        const a = seen(args[0]);
        return a instanceof Bits ? count64(a.bitLength) : new Refuted("only a bits value has a length", args[0]);
      }
      if (fn.name === "slice") {
        if (!args.every(known)) return waits();
        const [a, from, n] = [seen(args[0]), countOf(args[1]), countOf(args[2])];
        if (!(a instanceof Bits)) return new Refuted("only a bits value can be taken apart", args[0]);
        if (from === undefined || n === undefined) return new Refuted("a place and a count are whole numbers, as bits", undefined);
        if (from + n > a.bitLength) return new Refuted(`${n} bit(s) from place ${from} is outside a value of ${a.bitLength} bit(s)`, undefined);
        if (whole(a) && from % 8 === 0 && n % 8 === 0) {
          charge(n);
          return new Bits(a.bytes.slice(from / 8, (from + n) / 8), n);
        }
        charge(a.bitLength);
        return packed(bitList(a).slice(from, from + n));
      }
      if (fn.name === "undecided") {
        if (!known(args[0])) return waits();
        const reason = seen(args[0]);
        if (!(reason instanceof Bits) || reason.bitLength % 8 !== 0) return new Refuted("the reason nothing could tell is a text", args[0]);
        return new Decided(new Bits(new Uint8Array(0), 0), [], "undecided", textOf(reason));
      }
      if (fn.name === "refuse") {
        if (!known(args[0])) return waits();
        const reason = seen(args[0]);
        return reason instanceof Bits && reason.bitLength % 8 === 0 ? new Refuted(textOf(reason), undefined) : new Refuted("a refusal's reason is a text", args[0]);
      }
      if (fn.name === "key") {
        const s = seen(args[0]);
        if (!(s instanceof Struct)) return known(args[0]) ? new Refuted("only a structure has entries with keys", args[0]) : waits();
        if (!known(args[1])) return waits();
        const place = countOf(args[1]);
        if (place === undefined) return new Refuted("a place is a whole number, as bits", args[1]);
        const open = s.entries.filter(([k]) => !hidden(k));
        if (place >= open.length) return new Refuted(`place ${place} is outside a structure of ${open.length} entr${open.length === 1 ? "y" : "ies"}`, undefined);
        const k = open[place][0];
        return k === null ? list([]) : new Quoted(seen(k) as Sym);
      }
      if (fn.name === "kind") {
        if (!known(args[0])) return waits();
        const x = seen(args[0]);
        const name = x instanceof Bits ? "bits" : x instanceof Sym ? "symbol" : x instanceof Struct ? "structure" : x instanceof Key ? "key" : x instanceof Fn || x instanceof Prim || x instanceof KernelPrim ? "function" : undefined;
        return name === undefined ? new Refuted("a value of no kind a program can hold", args[0]) : new Quoted(intern(name));
      }
      if (fn.name === "symbol") {
        if (!known(args[0])) return waits();
        const t = seen(args[0]);
        if (!(t instanceof Bits) || !whole(t) || t.bitLength === 0) return new Refuted("a symbol is made from a text that is not empty", args[0]);
        return new Quoted(intern(textOf(t)));
      }
      if (fn.name === "spelling") {
        if (!known(args[0])) return waits();
        const x = seen(args[0]);
        return x instanceof Sym ? text(x.fqn) : new Refuted("only a symbol has a spelling", args[0]);
      }
      if (fn.name === "count") {
        const s = seen(args[0]);
        // An entry keyed by a key has no place and is not counted.
        if (s instanceof Struct) return count64(s.entries.filter(([k]) => !hidden(k)).length);
        return known(args[0]) ? new Refuted("only a structure has a number of entries", args[0]) : waits();
      }
      if (fn.name === "get") {
        const s = seen(args[0]);
        if (!(s instanceof Struct)) return known(args[0]) ? new Refuted("only a structure has entries to read", args[0]) : waits();
        if (!known(args[1])) return waits();
        const key = seen(args[1]);
        if (key instanceof Sym) {
          const entry = s.entries.find(([k]) => k !== null && seen(k) === key);
          return entry !== undefined ? evaluate(entry[1], scope) : new Refuted(`the structure has no entry keyed ${key.fqn}`, undefined);
        }
        if (key instanceof Key) {
          // A private entry: only this key reads it, and without it nothing tells that it is there.
          const entry = s.entries.find(([k]) => k !== null && seen(k) === key);
          return entry !== undefined ? evaluate(entry[1], scope) : new Refuted("the structure has no entry under that key", undefined);
        }
        const place = key instanceof Bits ? countOf(key) : undefined;
        if (place === undefined) return new Refuted("an entry is read by a symbol, by a place or by a key", args[1]);
        const open = s.entries.filter(([k]) => !hidden(k));
        return place < open.length ? evaluate(open[place][1], scope) : new Refuted(`place ${place} is outside a structure of ${open.length} entr${open.length === 1 ? "y" : "ies"}`, undefined);
      }
      throw new KernelFault(`the kernel primitive "${fn.name}" has no evaluation`);
    }

    if (fn instanceof Fn) {
      // A composed function's arguments are not evaluated here. Each goes into the body as
      // it was written, and is evaluated when something in the body needs it.
      const identity = moduleIds.get(fn);
      if (identity !== undefined) {
        // Calling a module function instantiates it. It is handed its capabilities and inputs;
        // the kernel supplies each module it imports, by the identity declared, so nobody can
        // connect it to another. The module instantiates its imports itself, in its body.
        const declares = moduleDeclares.get(fn);
        const handed = fn.params.map((_, i) => i).filter((i) => declares === undefined || declares[i].role !== "module");
        if (handed.length !== v.args.length)
          return new Refuted(`a module of ${handed.length} capability and input parameter(s) was given ${v.args.length} argument(s)`, undefined);
        const args: V[] = [];
        handed.forEach((i, j) => (args[i] = later(v.args[j], scope)));
        for (let i = 0; i < fn.params.length; i++) {
          const d = declares?.[i];
          if (d === undefined || d.role !== "module") continue;
          const imported = d.identity === undefined ? undefined : modulesById.get(d.identity);
          if (imported === undefined) return new Refuted(`the module ${d.name}, which it imports, is not loaded`, undefined);
          args[i] = imported;
        }
        // One instance for each distinct set of arguments: its statements happen once.
        const all = instancesOf.get(fn) ?? [];
        let instance = all.find((x) => x.args.every((a, i) => sameInformation(a, args[i])));
        if (instance === undefined) {
          instance = { args, value: new Lazy(substitute(fn.body, new Map(fn.params.map((p, i) => [p, args[i]] as const)), new Map()), scope) };
          instancesOf.set(fn, [...all, instance]);
        }
        return evaluate(instance.value, scope);
      }
      if (fn.params.length !== v.args.length)
        return new Refuted(`a function of ${fn.params.length} parameter(s) was given ${v.args.length} argument(s)`, undefined);
      const given = v.args.map((a) => {
        const l = later(a, scope);
        // An argument that is one step of work on values already known is evaluated now: a
        // loop's counter or total then never grows into a chain of work put off. It has no
        // effect, and a refutation it comes to is held until something needs the argument.
        if (l instanceof Lazy && oneStep(l.value)) collecting(() => evaluate(l, scope));
        return l;
      });
      const env = new Map(fn.params.map((p, i) => [p, given[i]] as const));
      // Ahead of what is done, a function already being opened ahead is not opened again,
      // whatever it is given: the call stays in the residual. Evaluation ahead only finds a
      // refutation early, and a loop that carries state would otherwise never end. And where
      // a check goes over what was left untouched, a function it has opened is not opened again.
      // A check is otherwise: it has a budget, and it must find what a run would find. There a
      // call stays a call only under a condition the check could not decide, where a run might
      // not make it. A call a run would make is opened as a run would open it, a function that
      // calls itself among them, so a claim that rests on such a call is decided or refuted.
      const leftAsCall = ahead && (reaching === undefined || unsure > 0) && (opening.includes(fn) || (reaching?.draining === true && reaching.opened.has(fn)));
      if (observed() && !leftAsCall) tell(v, { kind: "call", function: out(fn) });
      if (!leftAsCall) reaching?.opened.add(fn);
      if (!ahead) return evaluate(substitute(fn.body, env, new Map()), scope);
      if (leftAsCall) return new Expr(fn, given);
      opening.push(fn);
      try {
        return evaluate(substitute(fn.body, env, new Map()), scope);
      } finally {
        opening.pop();
      }
    }
    if (!(fn instanceof Prim)) {
      if (known(fn)) return new Refuted("a call on something that is not a function", fn);
      return new Expr(fn, v.args.map((a) => later(a, scope)));
    }
    // A primitive function needs every argument, in full: its host code cannot evaluate, so
    // a structure it is handed has every entry evaluated first. The arguments are started
    // left to right, and none waits for one before it: where one waits on a late answer, an
    // effect in a later one is performed all the same. Need and `then` order effects.
    const args: V[] = [];
    for (const a of v.args) {
      const r = inFull(a, scope);
      if (r instanceof Refuted) return r;
      args.push(r);
    }
    {
      if (fn.declaration.arity !== args.length)
        return new Refuted(`a primitive of ${fn.declaration.arity} parameter(s) was given ${args.length} argument(s)`, undefined);
      if (!args.every(knownInFull)) return new Expr(fn, args);
      const d = fn.declaration;
      if (ahead && d.purity === "effectful") return new Expr(fn, args);
      const what: Rest = d.purity === "pure" ? { kind: "primitive", hash: d.hash, name: d.name } : { kind: "capability", capability: d.capability, part: d.part };
      rest(what);
      if (d.purity === "effectful" && observed()) tell(v, { kind: "effect", capability: d.capability, operation: d.part });
      const before = running;
      running = d.purity === "effectful" ? what : undefined;
      let r: V;
      try {
        r = into(d.run(args.map(out), context), "what a primitive returned");
      } catch (e) {
        if (e instanceof Refusal) return new Refuted(e.reason, undefined);
        throw e;
      } finally {
        running = before;
      }
      return r instanceof CellV ? r : asData(r, "what a primitive returned");
    }
  };

  /** A value with every entry of every structure in it evaluated, in order. A refutation inside is the whole's. */
  const inFull = (v: V, scope: ScopeV): V => {
    const r = evaluate(v, scope);
    if (r instanceof Refuted) return r;
    const s = seen(r);
    if (s instanceof Struct && !settled.has(s)) {
      // The entries are started in order, and none waits for one before it.
      for (const [k, e] of s.entries) {
        if (hidden(k)) continue;
        step(); // a structure handed over whole costs a step for each entry
        const x = inFull(e, scope);
        if (x instanceof Refuted) return x;
      }
    }
    return r;
  };

  /**
   * An argument as it is handed on without being evaluated: tied to the
   * scope it was written in, and shared, so it is evaluated at most once
   * and means there what it meant here. What needs no evaluation is
   * handed on as it is.
   */
  /**
   * After a refutation, what was written after it is still evaluated, ahead of what is done
   * and with no effect, so that a further refutation in it is found and counted now. What it
   * comes to is dropped. A refutation outranks a limit: where the steps run out while
   * looking, the looking stops and the refutation stands. The call's result says that it
   * was cut short, so whoever reads it knows a further refutation may be unreported.
   */
  const lookAhead = (rest: V, scope: ScopeV): void => {
    const before = ahead;
    ahead = true;
    try {
      evaluate(rest, scope);
    } catch (e) {
      if (!(e instanceof LimitReached || e instanceof RangeError)) throw e;
      cut = true;
    } finally {
      ahead = before;
    }
  };

  /** The evaluation whose work is being done now. */
  let account: Account = { left: Infinity, dead: false, handle: undefined };
  /** A spent budget ends an evaluation: what it had waiting is dropped, and an answer that comes for it is ignored. */
  const over = (a: Account): void => {
    a.dead = true;
    for (const root of roots) if (root.account === a) root.done = true;
  };
  /** Keeps an evaluation that waits, with the cells it waits on. */
  const started = (value: V, scope: ScopeV): Root => {
    const root: Root = { scope, value, done: false, waits: new Set(), queued: false, groups: [...groups], grouped: false, account };
    for (const g of root.groups) g.pending.add(root);
    settle(root);
    roots.push(root);
    rootOf.set(value, root);
    return root;
  };
  /** Finds again what an evaluation waits on, after it was evaluated. */
  const settle = (root: Root): void => {
    root.waits = new Set();
    sawGroup = false;
    if (!root.done) waitsOn(root.value, root.waits as Set<V>, new Set());
    root.grouped = sawGroup;
  };
  /** An evaluation is over: every sequence that waited for it is told, and may now go on. */
  const finished = (root: Root): void => {
    if (root.groups.length === 0) return;
    for (const g of root.groups) {
      g.pending.delete(root);
      if (root.value instanceof Refuted && g.refuted === undefined) g.refuted = root.value;
    }
    for (const r of roots) {
      if (r.done || r.queued || !r.grouped) continue;
      r.queued = true;
      ready.push(r);
    }
  };

  const later = (a: V, scope: ScopeV): V => {
    const tied = tie(a, scope, new Map());
    if (!(tied instanceof Expr || tied instanceof NameRef || (tied instanceof Struct && !settled.has(tied) && !built.has(tied)))) {
      // A function written as an argument or an entry is a function met, though nothing may call it or read it.
      if (tied instanceof Fn) reaching?.lazies.push(new Lazy(tied, scope));
      return tied;
    }
    const made = new Lazy(tied, scope);
    reaching?.lazies.push(made);
    return made;
  };

  /** Runs one piece of evaluation under a budget. A stack that runs out is a limit too. */
  const within = <T>(limits: Limits | undefined, body: () => T): { value: T | undefined; ended: "complete" | "limit"; steps: number } => {
    spent = 0;
    budget = limits?.steps ?? Infinity;
    try {
      return { value: body(), ended: "complete", steps: spent };
    } catch (e) {
      if (e instanceof LimitReached || e instanceof RangeError) return { value: undefined, ended: "limit", steps: spent };
      throw e;
    }
  };

  /** The unfilled cells and unbound names a value still waits on. */
  const waitsOn = (v: V, found: Set<V>, visited: Set<V>): void => {
    if (visited.has(v)) return;
    visited.add(v);
    if (v instanceof CellV) {
      if (!v.filled) found.add(v);
      else waitsOn(v.value as V, found, visited);
    } else if (v instanceof Expr) {
      waitsOn(v.fn, found, visited);
      v.args.forEach((a) => waitsOn(a, found, visited));
      // A sequence that waits for what its first part started waits on what that waits on.
      const group = thenGroups.get(v);
      if (group !== undefined && group.pending.size > 0) {
        sawGroup = true;
        for (const r of group.pending) waitsOn(r.value, found, visited);
      }
    } else if (v instanceof Struct) {
      if (!settled.has(v)) v.entries.forEach(([, e]) => waitsOn(e, found, visited));
    } else if (v instanceof Decided) waitsOn(v.inner, found, visited);
    else if (v instanceof Lazy) waitsOn(v.value, found, visited);
    else if (v instanceof NameRef) {
      const at = bindingOf(v);
      if (at !== undefined) waitsOn(at.binding.memo ?? at.binding.value, found, visited);
    }
  };

  const kernel: Kernel = {
    interfaceVersion: INTERFACE_VERSION,
    variant: VARIANT,
    ...shared,

    fill: (cell, value, how): Advance => {
      const c = into(cell, "the cell");
      if (!(c instanceof CellV)) throw new InterfaceError("fill: not a cell");
      if (c.filled) throw new InterfaceError("fill: the cell is already filled");
      c.value = asData(into(value, "the value"), "what a cell is filled with");
      c.filled = true;
      fills++;
      // What waits on this cell is taken up by the next `advance`, after what waits on cells
      // filled before it. An evaluation with no cell in sight is taken up too, to be safe.
      for (const root of roots) {
        if (root.done || root.queued || !(root.waits.has(c) || root.waits.size === 0)) continue;
        root.queued = true;
        ready.push(root);
      }
      // Held, the value is only recorded.
      return how?.hold === true ? { ended: "complete", steps: 0, refuted: [], claims: [] } : kernel.advance(how);
    },
    kept: () => [],
    waiting: () => {
      const found = new Set<V>();
      for (const root of roots) if (!root.done) waitsOn(root.value, found, new Set());
      return [...found].map((v) => out(v) as Cell);
    },

    evaluate: (expression, limits): Result => {
      const e = into(expression, "the expression");
      const s = new ScopeV(undefined);
      tallies.clear();
      cut = false;
      // The budget is the evaluation's: what `advance` later does for it counts against what is left.
      const mine: Account = (account = { left: limits?.steps ?? Infinity, dead: false, handle: undefined });
      const r = within(limits, () => evaluate(e, s));
      const value = r.value ?? e;
      mine.left -= r.steps;
      mine.handle = value;
      if (r.ended === "limit") over(mine);
      if (r.ended === "complete" && !known(value)) started(value, s);
      return { value: out(value), ended: r.ended, steps: r.steps, refuted: value instanceof Refuted, claims: claimRecords(), ...(cut ? { cutShort: true as const } : {}) };
    },
    advance: (limits): Advance => {
      if (ready.length === 0) return { ended: "complete", steps: 0, refuted: [], claims: [] };
      tallies.clear();
      cut = false;
      const refuted: Value[] = [];
      // Once one comes out refuted, no further effect is performed in this call: the rest
      // are evaluated ahead, so their refutations are reported too, and they stay in the list
      // for a later call to take up in earnest. Whether there is one is the launcher's to say.
      let halted = false;
      const held: Root[] = [];
      const limited: Value[] = [];
      const r = within(limits, () => {
        // Each is taken up once, in the order its answer arrived. One that a limit stops stays
        // first in the list, so the next call goes on with it.
        try {
          while (ready.length > 0) {
            const root = ready[0];
            const before = fills;
            const onlyAhead = halted;
            if (!root.done) {
              const was = ahead;
              if (onlyAhead) ahead = true;
              // It is evaluated under what is left of its evaluation's budget, and of this call's.
              const [mine, spentBefore, callBudget] = [(account = root.account), spent, budget];
              budget = Math.min(callBudget, spent + mine.left);
              let next: V;
              try {
                next = evaluate(root.value, root.scope);
              } catch (e) {
                // The evaluation's own budget is spent, and not the call's: the evaluation is
                // over, the call says which, and goes on with the others.
                if (!(e instanceof LimitReached) || spent - spentBefore < mine.left || spent >= callBudget) throw e;
                over(mine);
                if (mine.handle !== undefined) limited.push(out(mine.handle));
                ready.shift();
                root.queued = false;
                continue;
              } finally {
                ahead = was;
                mine.left -= spent - spentBefore;
                budget = callBudget;
              }
              root.value = next;
              rootOf.set(next, root);
              if (next instanceof Refuted) {
                if (!refuted.includes(out(next))) refuted.push(out(next));
                halted = true;
              }
              if (known(next)) root.done = true;
              settle(root);
              if (root.done) finished(root);
            }
            ready.shift();
            root.queued = false;
            if (root.done) continue;
            if (onlyAhead) held.push(root);
            // A cell filled while it was being evaluated may have been passed already.
            else if (fills !== before) {
              root.queued = true;
              ready.push(root);
            }
          }
        } finally {
          for (const root of held) {
            root.queued = true;
            ready.push(root);
          }
        }
      });
      return { ended: r.ended, steps: r.steps, refuted, claims: claimRecords(), ...(cut ? { cutShort: true as const } : {}), ...(limited.length > 0 ? { limited } : {}) };
    },
    check: (expression, limits): Result => {
      const e = into(expression, "the expression");
      tallies.clear();
      cut = false;
      const reach: Reaching = { lazies: [], fns: [], opened: new Set<Fn>(), found: [], noted: new Set<Refuted>(), draining: false };
      reaching = reach;
      unsure = 0;
      // A check performs nothing and what it evaluated is dropped when it ends, so a claim it
      // left waiting waits for nothing afterwards: the count of waiting claims is put back.
      const waitingBefore = new Map(waitingAt);
      const [wasAhead, wasSpeculative] = [ahead, speculative];
      ahead = true;
      speculative = true;
      account = { left: limits?.steps ?? Infinity, dead: false, handle: undefined };
      try {
        const r = within(limits, (): V => {
          const scope = new ScopeV(undefined);
          const value = (evaluate(e, scope));
          // What the evaluation left untouched is evaluated too, and the body of every
          // function it met, each with its parameters unknown. What that leaves untouched
          // in turn is gone over as well, until nothing is left.
          reach.draining = true;
          const reached = new Set<Fn>();
          while (reach.lazies.length > 0 || reach.fns.length > 0) {
            const l = reach.lazies.pop();
            if (l !== undefined) {
              if (!l.done && !l.busy) found((evaluate(l, l.scope)), l.value);
              continue;
            }
            const f = reach.fns.pop() as Fn;
            // Every function is specialized, one a call has opened with known values too.
            if (reached.has(f)) continue;
            reached.add(f);
            reach.opened.add(f);
            const params = f.params.map((p) => new Param(p.name));
            opening.push(f);
            try {
              found((evaluate(substitute(f.body, new Map(f.params.map((p, i) => [p, params[i]] as const)), new Map()), scope)), f);
            } finally {
              opening.pop();
            }
          }
          return value;
        });
        const value = r.value ?? e;
        return { value: out(value), ended: r.ended, steps: r.steps, refuted: value instanceof Refuted, claims: claimRecords(), refutations: reach.found, ...(cut ? { cutShort: true as const } : {}) };
      } finally {
        ahead = wasAhead;
        speculative = wasSpeculative;
        reaching = undefined;
        unsure = 0;
        waitingAt.clear();
        for (const [site, n] of waitingBefore) waitingAt.set(site, n);
      }
    },
    current: (value) => {
      const v = into(value, "the value");
      const root = rootOf.get(v);
      if (root !== undefined) return out(root.value);
      const now = through(v);
      return now === v ? value : out(now);
    },
  };
  return kernel;
};
