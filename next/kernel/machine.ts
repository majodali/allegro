// The machine: the kernel variant that evaluates with a stack of its own
// (chunk K9 of docs/plans/book-pass.md, and its section 9).
//
// It implements the same interface as the reference kernel
// (next/kernel/kernel.ts) and follows the same rules, case for case. "One
// reference kernel is the root of trust": this variant is right where it
// answers as the reference does. The tests of the kernel run against both.
//
// What differs is how one evaluation asks for another. The reference
// calls itself, on the host's stack, so a deep recursion ends at the
// host's limit. Here evaluating gives a value at once or a call, and `run`
// keeps the calls that wait in a list of frames:
//   - a frame is a generator: what is to be done with a value once it is
//     known;
//   - a frame that ends by handing on another call is replaced by it, so a
//     call that is the value of its function's body takes no room, and a
//     loop written as a recursion runs in constant space;
//   - the body of a composed function is always evaluated from `run`, so
//     no chain of calls grows the host's stack.
//
// Values, what is known, marks, claims, descriptions and the part of the
// interface that evaluates nothing are shared with the reference
// (next/kernel/values.ts, next/kernel/core.ts).
//
// Not here yet, and in later chunks of the plan: a task that waits where
// it stands, slices, the first of two answers, sharing, specialization.
// A computation that waits is, as in the reference, what is left of it as
// an expression, evaluated again when the answer comes.

import type { Advance, Cell, CreateKernel2, Kernel2, Limits, PrimitiveContext, Rest, Result, Scope, Value } from "./interface.js";
import { INTERFACE_VERSION, InterfaceError, KernelFault, Refusal } from "./interface.js";
import { createCore } from "./core.js";
import { Bits, CellV, Decided, Expr, Fn, INSPECT, KernelPrim, Key, Lazy, LimitReached, NameRef, Prim, Quoted, Refuted, ScopeV, Struct, Sym } from "./values.js";
import type { Group, Mark, Root, V } from "./values.js";

/** What evaluating gives: a value, or a call still to be run. */
type Step = V | Call;
/** A frame: it asks for calls to be run, is handed their values, and ends in a value or in a call that takes its place. */
type Gen = Generator<Call, Step, V>;
/** The marks a value takes from what was evaluated to give it. */
interface Marks {
  readonly owner: Mark | undefined;
  readonly site: Expr | undefined;
  readonly group: Group | undefined;
}
/** A call still to be run: a frame, or a function `run` calls in its place. */
class Call {
  marks: Marks | undefined = undefined;
  constructor(readonly gen: Gen | undefined, readonly thunk: (() => Step) | undefined) {}
}
/** The marks of an inner evaluation come first; an outer one fills what is still missing. */
const merge = (inner: Marks | undefined, outer: Marks | undefined): Marks | undefined =>
  inner === undefined ? outer : outer === undefined ? inner : { owner: inner.owner ?? outer.owner, site: inner.site ?? outer.site, group: inner.group ?? outer.group };

/** Creates a machine. It does nothing until it is called. */
export const createMachine: CreateKernel2 = () => {
  const core = createCore();
  const {
    symbols, kernelPrims, settled, built, moduleIds, moduleDeclares, modulesById, pureByHash, keys,
    restKey, TRUE, FALSE, out, isV, into, through, seen, bindingOf, known, hidden, knownInFull,
    asData, blockNames, freeNames, utf8, intern, kindOf, wrong, bitsOf, symbolName, entriesOf, hex,
    contentOf, enclosing, markAll, identityOf, declarationsFor, closedFor, claimKey, text, number,
    numberOf, bitList, whole, packed, count64, countOf, textOf, data, failure, list, build, closed,
    restored, thenGroups, localKey, keep, tallies, waitingAt, waitingClaims, counted, tallyOf,
    tallied, claimRecords, supply, tie, close, substitute, heldByClaim, oneStep, sameInformation,
    truthOf, describe, closedTo, boundValue, describeWhole, withdrawnModules, withdrawnSites,
    shared,
  } = core;
  const roots: Root[] = [];
  const rootOf = new WeakMap<object, Root>();
  /** The instances of each module: one for each distinct set of arguments. */
  const instancesOf = new WeakMap<Fn, { args: readonly V[]; value: Lazy }[]>();
  const VARIANT = "machine-k9";
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
  /** The functions being opened while evaluating ahead. */
  const opening: Fn[] = [];
  /** The sequences whose first part is being evaluated now, outermost first. */
  const groups: Group[] = [];
  /** Set by `waitsOn` when it passes a `then` that waits for work its first part started. */
  let sawGroup = false;
  const rest = (r: Rest): void => {
    for (const c of collectors) c.set(localKey(r), r);
  };
  const scopeIn = (x: Scope | undefined, what: string): ScopeV => {
    if (!(x instanceof ScopeV)) throw new InterfaceError(`${what} is not a scope of this kernel`);
    return x;
  };

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

  // ---- Frames ---------------------------------------------------------------
  //
  // Evaluating gives a value at once, or a call: something still to be run. `run` keeps
  // the calls that wait for one another in a stack of its own, so nothing here uses the
  // host's stack in proportion to the program.

  const CLAIM = kernelPrims.get("claim");
  const ASSUME = kernelPrims.get("assume");
  /** The marks a result takes from what was evaluated: what `keep` would give it. */
  const marksOf = (v: V): Marks | undefined => {
    if (v instanceof Expr) {
      const site = v.site ?? (v.fn === CLAIM || v.fn === ASSUME ? v : undefined);
      const group = thenGroups.get(v);
      return v.owner === undefined && site === undefined && group === undefined ? undefined : { owner: v.owner, site, group };
    }
    if (v instanceof Struct || v instanceof Fn) return v.owner === undefined ? undefined : { owner: v.owner, site: undefined, group: undefined };
    return undefined;
  };
  /** Gives a value the marks kept for it, where it has none of its own. */
  const marked = (m: Marks | undefined, r: V): V => {
    if (m === undefined) return r;
    if ((r instanceof Expr || r instanceof Struct || r instanceof Fn) && r.owner === undefined) r.owner = m.owner;
    if (r instanceof Expr) {
      if (r.site === undefined && m.site !== undefined && m.site !== r) r.site = m.site;
      if (m.group !== undefined && !thenGroups.has(r)) thenGroups.set(r, m.group);
    }
    return r;
  };

  /**
   * Runs a call to its value. The frames that wait are generators, kept here in a list; a
   * frame that ends by handing on another call is replaced by it, so a call that is the
   * value of its function's body takes no room.
   */
  const run = (start: Step): V => {
    const frames: Gen[] = [];
    const held: (Marks | undefined)[] = [];
    let item: Step = start; // what is being worked out for the frame on top
    let marks: Marks | undefined; // the marks its value will take
    let failed = false;
    let error: unknown;
    for (;;) {
      while (!failed && item instanceof Call) {
        const call: Call = item;
        marks = merge(call.marks, marks);
        if (call.thunk !== undefined) {
          try {
            item = call.thunk();
          } catch (e) {
            failed = true;
            error = e;
          }
          continue;
        }
        const gen = call.gen as Gen;
        try {
          const res = gen.next(undefined as never);
          item = res.value;
          if (!res.done) {
            frames.push(gen);
            held.push(marks);
            marks = undefined;
          }
        } catch (e) {
          failed = true;
          error = e;
        }
      }
      if (!failed) item = marked(marks, item as V);
      marks = undefined;
      if (frames.length === 0) {
        if (failed) throw error;
        return item as V;
      }
      const gen = frames[frames.length - 1];
      try {
        const res = failed ? gen.throw(error) : gen.next(item as V);
        failed = false;
        item = res.value;
        if (res.done) {
          frames.pop();
          marks = held.pop();
        }
      } catch (e) {
        frames.pop();
        held.pop();
        failed = true;
        error = e;
      }
    }
  };

  /** What is to be done with a value once it is known. With the value at hand it is done at once. */
  const after = (s: Step, k: (x: V) => Step): Step => (s instanceof Call ? new Call(afterGen(s, k), undefined) : k(s));
  const afterGen = function* (s: Call, k: (x: V) => Step): Gen {
    return k(yield s);
  };
  /** A call run from `run` itself, not from where it was made: what keeps a long chain of calls off the host's stack. */
  const bounce = (thunk: () => Step): Call => new Call(undefined, thunk);
  /** Evaluates under a fresh collector, and hands on the value with what the evaluation rested on. */
  const collectingGen = function* (make: () => Step, k: (value: V, rests: Rest[]) => Step): Gen {
    const mine = new Map<string, Rest>();
    collectors.push(mine);
    let value: V;
    try {
      const s = make();
      value = s instanceof Call ? yield s : s;
    } finally {
      collectors.pop();
    }
    return k(value, [...mine.values()]);
  };
  /** Each of some values in turn, each needing the one before it to be done; a refutation ends it. */
  const each = (items: readonly V[], scope: ScopeV, one: (a: V, scope: ScopeV) => Step, k: (args: V[]) => Step): Step => {
    const args: V[] = [];
    const from = (start: number): Step => {
      for (let i = start; i < items.length; i++) {
        const s = one(items[i], scope);
        if (s instanceof Call) {
          return new Call(
            afterGen(s, (r) => {
              if (r instanceof Refuted) return r;
              args.push(r);
              return from(i + 1);
            }),
            undefined,
          );
        }
        if (s instanceof Refuted) return s;
        args.push(s);
      }
      return k(args);
    };
    return from(0);
  };

  // ---- Evaluation ---------------------------------------------------------
  //
  // The rules are the reference kernel's (next/kernel/kernel.ts), case for case. What
  // differs is how a nested evaluation is asked for.

  /** What an evaluation leaves in place of a part is that part's writer's: a residual keeps its mark. */
  const evaluate = (v: V, scope: ScopeV): Step => {
    const r = evaluated(v, scope);
    if (r instanceof Call) {
      r.marks = merge(r.marks, marksOf(v));
      return r;
    }
    return keep(v, r);
  };
  const evaluated = (v: V, scope: ScopeV): Step => {
    if (v instanceof Sym) return evaluate(new NameRef(scope, v), scope);
    if (v instanceof NameRef) {
      const found = bindingOf(v);
      if (found === undefined) return new Refuted(`the name ${v.sym.fqn} is bound by no block around it`, undefined);
      if (found.binding.memo !== undefined) {
        found.binding.rests.forEach(rest);
        return found.binding.memo;
      }
      return new Call(
        collectingGen(
          () => evaluate(found.binding.value, found.scope),
          (r, rests) => {
            rests.forEach(rest);
            if (known(r)) {
              found.binding.memo = r;
              found.binding.rests = rests;
            }
            return r;
          },
        ),
        undefined,
      );
    }
    if (v instanceof CellV) {
      if (!v.filled) return v;
      if (v.source !== undefined) rest(v.source);
      return v.value as V;
    }
    if (v instanceof Fn) return close(v, scope);
    if (v instanceof Lazy) {
      if (v.done) {
        v.rests.forEach(rest);
        return v.value;
      }
      // A value that needs itself has no value: `n = n + 1`, read, would never end.
      if (v.busy) return new Refuted("a value that needs itself to be known", undefined);
      return new Call(lazyGen(v), undefined);
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
    return after(evaluate(v.fn, scope), (fn) => applied(v, fn, scope));
  };
  const lazyGen = function* (v: Lazy): Gen {
    v.busy = true;
    const mine = new Map<string, Rest>();
    let r: V;
    try {
      collectors.push(mine);
      try {
        const s = evaluate(v.value, v.scope);
        r = s instanceof Call ? yield s : s;
      } finally {
        collectors.pop();
      }
    } finally {
      v.busy = false;
    }
    const rests = [...mine.values()];
    rests.forEach(rest);
    v.rests = [...v.rests, ...rests];
    v.value = r;
    if (r instanceof Refuted || known(r)) {
      v.done = true;
      return r;
    }
    return v; // It still waits. It stays one thing, so whatever is left in it is done once.
  };

  /** An application, once what is applied is known. */
  const applied = (v: Expr, fn: V, scope: ScopeV): Step => {
    if (fn instanceof Refuted) return fn;

    if (fn instanceof KernelPrim) {
      if (v.args.length !== fn.arity) return new Refuted(`"${fn.name}" takes ${fn.arity} argument(s) and was given ${v.args.length}`, undefined);
      // An assumption a configuration has withdrawn is not taken on trust: it is a claim.
      const withdrawn = fn.name === "assume" && (withdrawnSites.has(v.site ?? v) || withdrawnModules.has(v.owner?.module ?? ""));
      if (fn.name === "claim" || withdrawn) {
        return new Call(
          collectingGen(
            () => evaluate(v.args[0], scope),
            (claimed, rests) => {
              rests.forEach(rest);
              if (claimed instanceof Refuted) return tallied(v, claimed, rests);
              // What decides the claim answered that it cannot tell: the claim is done, and undecided.
              const told = through(claimed);
              if (told instanceof Decided && told.outcome === "undecided") return tallied(v, new Decided(told.inner, [{ kind: "kernel", variant: VARIANT }, ...rests], "undecided", told.reason), rests);
              if (truthOf(claimed) === true) {
                // A claim that rests on an assumption is no stronger than assumed.
                const assumed = rests.some((r) => r.kind === "assumption");
                return tallied(v, new Decided(seen(claimed), [{ kind: "kernel", variant: VARIANT }, ...rests], assumed ? "assumed" : "decided"), rests);
              }
              if (known(claimed)) return tallied(v, new Refuted("a claim that is not true", claimed), rests);
              return tallied(v, new Expr(fn, [claimed]), rests);
            },
          ),
          undefined,
        );
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
        return after(evaluate(v.args[0], scope), (condition) => {
          if (condition instanceof Refuted) return condition;
          const truth = truthOf(condition);
          if (truth === true) return evaluate(v.args[1], scope);
          if (truth === false) return evaluate(v.args[2], scope);
          if (known(condition)) return new Refuted("a condition that is neither true nor false", condition);
          return new Expr(fn, [condition, later(v.args[1], scope), later(v.args[2], scope)]);
        });
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
          inner.bindings.set(name, { value: e instanceof Fn || !(e instanceof Expr || e instanceof Sym || e instanceof Struct) ? e : new Lazy(e, inner), memo: undefined, rests: [] });
        }
        return evaluate(v.args[1], inner);
      }
      if (fn.name === "put") {
        // A new structure: the old one with this entry added at its end, or put in place of the
        // entry already under that key. The value is not evaluated: an entry is evaluated when read.
        return after(evaluate(v.args[0], scope), (target) =>
          after(evaluate(v.args[1], scope), (k) => {
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
          }),
        );
      }
      if (fn.name === "then") return new Call(thenGen(v, fn, scope), undefined);
      if (fn.name === "also") return new Call(alsoGen(v, fn, scope), undefined);
      if (fn.name === "attempt") {
        // The budget is needed; what is attempted is evaluated inside the attempt.
        return after(evaluate(v.args[1], scope), (steps) => {
          if (steps instanceof Refuted) return steps;
          const budgetBits = seen(steps);
          if (!known(steps)) return new Expr(fn, [later(v.args[0], scope), steps]);
          if (!(budgetBits instanceof Bits)) return new Refuted("an attempt's budget is a number of steps, as bits", steps);
          return new Call(attemptGen(v, fn, steps, numberOf(budgetBits), scope), undefined);
        });
      }
      if (fn.name === "build") {
        return each(v.args, scope, evaluate, (args) =>
          // A description is read whole, so it is needed in full.
          after(inFull(args[0], scope), (description) => {
            const waits = (): V => new Expr(fn, args);
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
          }),
        );
      }
      return each(v.args, scope, evaluate, (args) => computed(v, fn, args, scope));
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
        if (l instanceof Lazy && oneStep(l.value)) {
          collectors.push(new Map());
          try {
            run(evaluate(l, scope));
          } finally {
            collectors.pop();
          }
        }
        return l;
      });
      const env = new Map(fn.params.map((p, i) => [p, given[i]] as const));
      // The body is evaluated from `run`, in place of this call: a function that calls itself
      // as the value of its body goes round with no frame kept for each turn.
      if (!ahead) return bounce(() => evaluate(substitute(fn.body, env, new Map()), scope));
      // Ahead of what is done, a function already being opened ahead is not opened again,
      // whatever it is given: the call stays in the residual. Evaluation ahead only finds a
      // refutation early, and a loop that carries state would otherwise never end.
      if (opening.includes(fn)) return new Expr(fn, given);
      return new Call(openingGen(fn, () => evaluate(substitute(fn.body, env, new Map()), scope)), undefined);
    }
    if (!(fn instanceof Prim)) {
      if (known(fn)) return new Refuted("a call on something that is not a function", fn);
      return new Expr(fn, v.args.map((a) => later(a, scope)));
    }
    // A primitive function needs every argument, in full: its host code cannot evaluate, so
    // a structure it is handed has every entry evaluated first. The arguments are started
    // left to right, and none waits for one before it: where one waits on a late answer, an
    // effect in a later one is performed all the same. Need and `then` order effects.
    return each(v.args, scope, inFull, (args) => {
      if (fn.declaration.arity !== args.length)
        return new Refuted(`a primitive of ${fn.declaration.arity} parameter(s) was given ${args.length} argument(s)`, undefined);
      if (!args.every(knownInFull)) return new Expr(fn, args);
      const d = fn.declaration;
      if (ahead && d.purity === "effectful") return new Expr(fn, args);
      const what: Rest = d.purity === "pure" ? { kind: "primitive", hash: d.hash, name: d.name } : { kind: "capability", capability: d.capability, part: d.part };
      rest(what);
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
    });
  };

  const thenGen = function* (v: Expr, fn: KernelPrim, scope: ScopeV): Gen {
    // The first is over, and only then the second. Over means its value is known and
    // nothing that evaluating it started still goes on: a caller who writes `then` cannot
    // see what a function it calls left going. While the first is not over, the second is
    // evaluated ahead with no effect performed, so a refutation in it is found now.
    const group: Group = thenGroups.get(v) ?? { pending: new Set(), refuted: undefined };
    groups.push(group);
    let first: V;
    try {
      const s = evaluate(v.args[0], scope);
      first = s instanceof Call ? yield s : s;
    } finally {
      groups.pop();
    }
    // A refutation in what the first started is a refutation of the first.
    const wrong = first instanceof Refuted ? first : group.refuted;
    if (wrong !== undefined) return new Call(lookAheadGen(v.args[1], scope, wrong), undefined);
    if (known(first) && group.pending.size === 0) return evaluate(v.args[1], scope);
    const before = ahead;
    ahead = true;
    let second: V;
    try {
      const s = evaluate(v.args[1], scope);
      second = s instanceof Call ? yield s : s;
    } finally {
      ahead = before;
    }
    if (second instanceof Refuted) return second;
    const left = new Expr(fn, [first, second instanceof Lazy || !(second instanceof Expr || second instanceof NameRef) ? second : later(second, scope)]);
    thenGroups.set(left, group);
    return left;
  };
  const alsoGen = function* (v: Expr, fn: KernelPrim, scope: ScopeV): Gen {
    // The first is started, and then the second; the second does not wait for the first.
    const s1 = evaluate(v.args[0], scope);
    const first: V = s1 instanceof Call ? yield s1 : s1;
    if (first instanceof Refuted) return new Call(lookAheadGen(v.args[1], scope, first), undefined);
    if (known(first)) return evaluate(v.args[1], scope);
    // A claim that waits holds what is written after it: no effect of it is performed.
    const held = heldByClaim(first);
    const before = ahead;
    if (held) ahead = true;
    let second: V;
    try {
      const s = evaluate(v.args[1], scope);
      second = s instanceof Call ? yield s : s;
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
  };
  const attemptGen = function* (v: Expr, fn: KernelPrim, steps: V, allowed: number, scope: ScopeV): Gen {
    const outer = budget;
    budget = Math.min(outer, spent + allowed);
    let r: V;
    try {
      const s = evaluate(v.args[0], scope);
      r = s instanceof Call ? yield s : s;
    } catch (e) {
      // The attempt's own budget ran out, or the host's own limit was reached inside it:
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
  };
  const openingGen = function* (fn: Fn, body: () => Step): Gen {
    opening.push(fn);
    try {
      const s = body();
      return s instanceof Call ? yield s : s;
    } finally {
      opening.pop();
    }
  };

  /** One of the kernel's primitives that only computes, once its arguments are evaluated. */
  const computed = (v: Expr, fn: KernelPrim, args: V[], scope: ScopeV): Step => {
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
  };

  /** A value with every entry of every structure in it evaluated, in order. A refutation inside is the whole's. */
  const inFull = (v: V, scope: ScopeV): Step =>
    after(evaluate(v, scope), (r) => {
      if (r instanceof Refuted) return r;
      const s = seen(r);
      if (s instanceof Struct && !settled.has(s)) return new Call(entriesGen(s, r, scope), undefined);
      return r;
    });
  const entriesGen = function* (s: Struct, r: V, scope: ScopeV): Gen {
    for (const [k, e] of s.entries) {
      if (hidden(k)) continue;
      step(); // a structure handed over whole costs a step for each entry
      const st = inFull(e, scope);
      const x: V = st instanceof Call ? yield st : st;
      if (x instanceof Refuted) return x;
    }
    return r;
  };

  /**
   * After a refutation, what was written after it is still evaluated, ahead of what is done
   * and with no effect, so that a further refutation in it is found and counted now. What it
   * comes to is dropped, and the refutation is the value. A refutation outranks a limit:
   * where the steps run out while looking, the looking stops and the refutation stands.
   */
  const lookAheadGen = function* (rest: V, scope: ScopeV, refutation: V): Gen {
    const before = ahead;
    ahead = true;
    try {
      const s = evaluate(rest, scope);
      if (s instanceof Call) yield s;
    } catch (e) {
      if (!(e instanceof LimitReached || e instanceof RangeError)) throw e;
      cut = true;
    } finally {
      ahead = before;
    }
    return refutation;
  };

  /** Keeps an evaluation that waits, with the cells it waits on. */
  const started = (value: V, scope: ScopeV): Root => {
    const root: Root = { scope, value, done: false, waits: new Set(), queued: false, groups: [...groups], grouped: false };
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
    return tied instanceof Expr || tied instanceof NameRef || (tied instanceof Struct && !settled.has(tied) && !built.has(tied)) ? new Lazy(tied, scope) : tied;
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

  const kernel: Kernel2 = {
    interfaceVersion: INTERFACE_VERSION,
    variant: VARIANT,
    ...shared,

    scope: (parent) => new ScopeV(parent === undefined ? undefined : scopeIn(parent, "the parent")) as unknown as Scope,
    fill: (cell, value) => {
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
    },
    waiting: () => {
      const found = new Set<V>();
      for (const root of roots) if (!root.done) waitsOn(root.value, found, new Set());
      return [...found].map((v) => out(v) as Cell);
    },

    evaluate: (expression, scope, limits): Result => {
      const e = into(expression, "the expression");
      const s = scopeIn(scope, "the scope");
      tallies.clear();
      cut = false;
      const r = within(limits, () => run(evaluate(e, s)));
      const value = r.value ?? e;
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
              let next: V;
              try {
                next = run(evaluate(root.value, root.scope));
              } finally {
                ahead = was;
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
      return { ended: r.ended, steps: r.steps, refuted, claims: claimRecords(), ...(cut ? { cutShort: true as const } : {}) };
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
