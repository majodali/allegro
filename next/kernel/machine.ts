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
import { Bits, CellV, Decided, Expr, Fn, INSPECT, KernelPrim, Key, Lazy, LimitReached, NameRef, Param, Prim, Quoted, Refuted, ScopeV, Struct, Sym } from "./values.js";
import type { Mark, V } from "./values.js";

/** What evaluating gives: a value, or a call still to be run. */
type Step = V | Call;
/** A frame: it asks for calls to be run, is handed their values, and ends in a value or in a call that takes its place. */
type Gen = Generator<Call, Step, V>;
/** The marks a value takes from what was evaluated to give it. */
interface Marks {
  readonly owner: Mark | undefined;
  readonly site: Expr | undefined;
  readonly group: MGroup | undefined;
}
/** A call still to be run: a frame, or a function `run` calls in its place. */
/** Something a computation waits for: a late answer, a value another task is working out, or the work a sequence's first part started. */
type Waitable = CellV | Lazy | MGroup;
/** The work a sequence's first part started and that still goes on. */
interface MGroup {
  readonly pending: Set<Task>;
  refuted: Refuted | undefined;
}
/** What a frame tells `run` about itself. */
interface Ctl {
  /** True while the frame does not need the value it asked for: a wait above it becomes a task, and the frame goes on. */
  boundary?: boolean;
  /** The scope of a boundary frame. */
  scope?: ScopeV;
  /** The value evaluated when needed that this frame is working out. */
  lazy?: Lazy;
  /** True where the frame's value is the value it asked for, unchanged. */
  pass?: boolean;
  /** Called when the frame is first made to wait. A value it gives is the frame's answer at once, and nothing waits. */
  onSuspend?: () => V | undefined;
  /** Values being worked out whose refutation refutes this frame. */
  watch?: Lazy[];
  /** Cells the frame will come to wait for, beyond the one it waits for now. */
  cells?: CellV[];
}
class Call {
  marks: Marks | undefined = undefined;
  /** What the evaluation rests on is collected here while the frame lives. */
  collector: Map<string, Rest> | undefined = undefined;
  /** The sequence whose first part the frame evaluates. */
  group: MGroup | undefined = undefined;
  /** A budget of steps for the frame. */
  cap: number | undefined = undefined;
  ctl: Ctl | undefined = undefined;
  /** Set on a call that only says what the frame waits for. */
  wait: Waitable | undefined = undefined;
  constructor(readonly gen: Gen | undefined, readonly thunk: (() => Step) | undefined) {}
}
/** One frame of a stack. */
interface Frame {
  readonly gen: Gen;
  marks: Marks | undefined;
  readonly collector: Map<string, Rest> | undefined;
  readonly group: MGroup | undefined;
  readonly capped: boolean;
  /** The budget in force while the frame runs, and the one before it. */
  cap: number;
  saved: number;
  /** The steps left to the frame while its task waits. */
  remaining: number;
  readonly ctl: Ctl | undefined;
}
/** A suspended stack: the frames of a computation that waits, and what it waits for. */
class Task {
  frames: Frame[] = [];
  on: Waitable | undefined = undefined;
  /** The task whose value this one is handed when it goes on. */
  deliver: Task | undefined = undefined;
  /** A watched value came out refuted: the frame that watched it, and the refutation. */
  woken: { frame: number; value: V } | undefined = undefined;
  /** True for the top of an evaluation and for work a block left going: its refutation is reported. */
  root = false;
  done = false;
  result: V | undefined = undefined;
  queued = false;
  /** True where its answer came while nothing needed it. */
  parked = false;
  /** True where what woke it is a refutation, which it only has to hand on. */
  carries = false;
  /** Raised each time it is taken up: what it registered for before no longer counts. */
  epoch = 0;
  /** What its own work rests on. */
  readonly base = new Map<string, Rest>();
  /** The sequences around it when it was split off, outermost first. */
  inherited: MGroup[] = [];
  /** The sequences that wait for it to be over. */
  memberOf: MGroup[] = [];
  /** `slot` is where its value goes. `fills` is true where the task itself must write it there. */
  constructor(public slot: Lazy | undefined, readonly fills: boolean) {}
}
/** Thrown into a frame to hand it an answer in place of the value it asked for. */
class Signal {
  constructor(readonly value: V) {}
}
interface Registration {
  readonly task: Task;
  readonly epoch: number;
  readonly frame: number;
}
/** A stack being run. */
interface Stack {
  readonly frames: Frame[];
  task: Task | undefined;
  readonly nested: boolean;
}
const SUSPENDED = Symbol("suspended");
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
  /** The instances of each module: one for each distinct set of arguments. */
  const instancesOf = new WeakMap<Fn, { args: readonly V[]; value: Lazy }[]>();
  const VARIANT = "machine-k10";
  /**
   * The tasks `advance` is to take up, in order. A task is put here when what it waits for
   * arrives, so answers are acted on in the order they arrive.
   */
  const ready: Task[] = [];
  /** Where in `ready` a task woken by the one now running is put: straight after it. */
  let cursor = 1;
  /** The task whose value each value being worked out will be. */
  const taskOf = new WeakMap<Lazy, Task>();
  /** What waits for each cell, value and sequence, in the order it came to wait. */
  const waitersOf = new WeakMap<object, Registration[]>();
  const watchersOf = new WeakMap<Lazy, Registration[]>();
  const interestOf = new WeakMap<CellV, Registration[]>();
  /** The cells something has waited for, in the order they were first waited for. */
  const waitedCells: CellV[] = [];
  /** The roots that came out refuted in the call of `advance` now running. */
  let refutedNow: V[] = [];
  let spent = 0;
  let budget = Infinity;
  /** What the evaluations now under way rest on: one collector for each claim or binding being evaluated. */
  let collectors: Map<string, Rest>[] = [];
  /** The capability part now running, so a cell it makes knows where its answer comes from. */
  let running: Rest | undefined;
  /** True while evaluating what follows something not yet done: no effect is performed there. */
  let ahead = false;
  /** True where this call met a refutation and ran out of steps while looking for more. */
  let cut = false;
  /** The functions being opened while evaluating ahead. */
  const opening: Fn[] = [];
  /** The sequences whose first part is being evaluated now, outermost first. */
  let groups: MGroup[] = [];
  const groupOf = thenGroups as unknown as WeakMap<Expr, MGroup>;
  /** What stands in a value being worked out by a task until the task writes it. */
  const PENDING = new Expr(new Param("pending"), []);
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
      const group = groupOf.get(v);
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
      if (m.group !== undefined && !groupOf.has(r)) groupOf.set(r, m.group);
    }
    return r;
  };

  // ---- Tasks ----------------------------------------------------------------
  //
  // A computation that needs a late answer stops where it stands. Its frames, from the
  // point of the wait down to the nearest frame that does not need the value yet, become
  // a task. The frames below go on. When the answer comes, `advance` takes the task up at
  // the point where it stopped.

  const registrations = (of: WeakMap<object, Registration[]>, w: object): Registration[] => {
    let list = of.get(w);
    if (list === undefined) of.set(w, (list = []));
    return list;
  };
  const live = (r: Registration): boolean => !r.task.done && r.epoch === r.task.epoch;
  /** True where what a task waits for has come. */
  const arrived = (w: Waitable | undefined): boolean =>
    w === undefined ? true : w instanceof CellV ? w.filled : w instanceof Lazy ? !taskOf.has(w) : w.pending.size === 0 || w.refuted !== undefined;
  /** True where something still wants a task's value: a root not yet over, or a task that waits for it or watches it. */
  const inDemand = (t: Task, visited: Set<Task> = new Set()): boolean => {
    if (t.root) return !t.done;
    if (t.slot === undefined || visited.has(t)) return false;
    visited.add(t);
    return (waitersOf.get(t.slot) ?? []).some((r) => live(r) && inDemand(r.task, visited)) || (watchersOf.get(t.slot) ?? []).some((r) => live(r) && inDemand(r.task, visited));
  };
  /** Puts a task in line, if anything needs it. One nothing needs is kept, and taken up if that changes. */
  const enqueue = (t: Task, front: boolean): void => {
    if (t.queued || t.done) return;
    if (!inDemand(t)) {
      t.parked = true;
      return;
    }
    t.parked = false;
    t.queued = true;
    if (front) ready.splice(Math.min(cursor++, ready.length), 0, t);
    else ready.push(t);
  };
  /** Something now needs a value: the task working it out, if its answer came unneeded, is put in line, and so on down. */
  const want = (w: Waitable | undefined): void => {
    if (!(w instanceof Lazy)) return;
    const t = taskOf.get(w);
    if (t === undefined || !t.parked || !inDemand(t)) return;
    if (arrived(t.on) || t.woken !== undefined) enqueue(t, false);
    else t.parked = false;
    wanted(t);
  };
  const wanted = (t: Task): void => {
    want(t.on);
    for (const f of t.frames) for (const l of f.ctl?.watch ?? []) want(l);
  };
  /** Records what a suspended task waits for. */
  const register = (t: Task): void => {
    t.epoch++;
    const on = t.on as Waitable;
    registrations(waitersOf, on).push({ task: t, epoch: t.epoch, frame: 0 });
    if (on instanceof CellV && !waitedCells.includes(on)) waitedCells.push(on);
    t.frames.forEach((f, i) => {
      for (const l of f.ctl?.watch ?? []) {
        if (!taskOf.has(l)) continue;
        registrations(watchersOf as WeakMap<object, Registration[]>, l).push({ task: t, epoch: t.epoch, frame: i });
      }
      for (const c of f.ctl?.cells ?? []) {
        if (c.filled) continue;
        registrations(interestOf as WeakMap<object, Registration[]>, c).push({ task: t, epoch: t.epoch, frame: i });
        if (!waitedCells.includes(c)) waitedCells.push(c);
      }
    });
    if (t.slot !== undefined) taskOf.set(t.slot, t);
    if (arrived(on)) enqueue(t, false);
    wanted(t);
  };

  const pushBinds = (c: Call): Frame => {
    const f: Frame = { gen: c.gen as Gen, marks: undefined, collector: c.collector, group: c.group, capped: c.cap !== undefined, cap: 0, saved: 0, remaining: 0, ctl: c.ctl };
    if (f.collector !== undefined) collectors.push(f.collector);
    if (f.group !== undefined) groups.push(f.group);
    if (c.cap !== undefined) {
      f.saved = budget;
      f.cap = budget = Math.min(budget, spent + c.cap);
    }
    return f;
  };
  const popBinds = (f: Frame): void => {
    if (f.collector !== undefined) collectors.pop();
    if (f.group !== undefined) groups.pop();
    if (f.capped) budget = f.saved;
  };
  /** Drops the frames from a place up: what they were doing is given up. */
  const drop = (frames: Frame[], from: number): void => {
    while (frames.length > from) popBinds(frames.pop() as Frame);
  };
  /** Moves the frames from a place up into a task that waits. */
  const park = (t: Task, frames: Frame[], from: number, on: Waitable, deliver: Task | undefined): void => {
    const moved = frames.splice(from);
    let [nCollectors, nGroups] = [0, 0];
    for (let j = moved.length - 1; j >= 0; j--) {
      const f = moved[j];
      if (f.collector !== undefined) nCollectors++;
      if (f.group !== undefined) nGroups++;
      if (f.capped) {
        f.remaining = f.cap - spent;
        budget = f.saved;
      }
    }
    collectors.length -= nCollectors;
    groups.length -= nGroups;
    t.inherited = [...groups];
    t.frames = moved;
    t.on = on;
    t.deliver = deliver;
    register(t);
  };
  /** Calls a frame's hook as the frame stands: what the frames above it collect is not its own. */
  const atLevel = (frames: Frame[], i: number, hook: () => V | undefined): V | undefined => {
    let [nCollectors, nGroups] = [0, 0];
    for (let j = i + 1; j < frames.length; j++) {
      if (frames[j].collector !== undefined) nCollectors++;
      if (frames[j].group !== undefined) nGroups++;
    }
    const [heldCollectors, heldGroups] = [collectors.splice(collectors.length - nCollectors), groups.splice(groups.length - nGroups)];
    try {
      return hook();
    } finally {
      collectors.push(...heldCollectors);
      groups.push(...heldGroups);
    }
  };
  /**
   * The frame on top waits for something. Going down the stack: a frame working out a
   * value evaluated when needed takes the frames above it into a task of that value's, and
   * what is below then waits for the value; a frame that does not need the value yet takes
   * the frames above it into a task, is handed a value that stands for the task's, and goes
   * on. With no such frame the whole stack waits.
   */
  const suspend = (S: Stack, first: Waitable): { value: V } | { error: Signal } | undefined => {
    const frames = S.frames;
    let on: Waitable = first;
    let deliver: Task | undefined;
    for (let i = frames.length - 1; i >= 0; i--) {
      const c = frames[i].ctl;
      if (c === undefined) continue;
      if (c.onSuspend !== undefined) {
        const answer = atLevel(frames, i, c.onSuspend);
        if (answer !== undefined) {
          drop(frames, i + 1);
          return { error: new Signal(answer) };
        }
      }
      if (c.lazy !== undefined) {
        const again = i === 0 && S.task !== undefined && S.task.slot === c.lazy;
        const t = again ? (S.task as Task) : new Task(c.lazy, false);
        park(t, frames, i, on, deliver);
        if (again) return undefined;
        on = c.lazy;
        deliver = t;
        continue;
      }
      if (c.boundary === true) {
        // Nothing but the value's own task was above: the value itself stands for it.
        if (i === frames.length - 1) return { value: on as Lazy };
        const slot = new Lazy(PENDING, c.scope as ScopeV);
        slot.busy = true;
        park(new Task(slot, true), frames, i + 1, on, deliver);
        return { value: slot };
      }
    }
    if (S.nested) throw new KernelFault("an evaluation that may not wait came to wait");
    let t = S.task;
    if (t === undefined) {
      // The top of an evaluation: a root.
      t = S.task = new Task(undefined, true);
      t.root = true;
    }
    park(t, frames, 0, on, deliver);
    return undefined;
  };

  /**
   * Runs a stack until it has a value or waits. The frames are generators; a frame that
   * ends by handing on another call is replaced by it, so a call that is the value of its
   * function's body takes no room.
   */
  const runStack = (S: Stack, start: Step | undefined, thrown: Signal | undefined): V | typeof SUSPENDED => {
    const frames = S.frames;
    let item = start as Step; // what is being worked out for the frame on top
    let marks: Marks | undefined; // the marks its value will take
    let failed = thrown !== undefined;
    let error: unknown = thrown;
    for (;;) {
      while (!failed && item instanceof Call) {
        const call: Call = item;
        if (call.wait !== undefined) {
          let answer: { value: V } | { error: Signal } | undefined;
          try {
            answer = suspend(S, call.wait);
          } catch (e) {
            failed = true;
            error = e;
            continue;
          }
          if (answer === undefined) return SUSPENDED;
          marks = undefined;
          if ("error" in answer) {
            failed = true;
            error = answer.error;
          } else item = answer.value;
          break;
        }
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
        const f = pushBinds(call);
        try {
          const res = f.gen.next(undefined as never);
          item = res.value;
          if (!res.done) {
            f.marks = marks;
            frames.push(f);
            marks = undefined;
          } else popBinds(f);
        } catch (e) {
          popBinds(f);
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
      const f = frames[frames.length - 1];
      try {
        const res = failed ? f.gen.throw(error) : f.gen.next(item as V);
        failed = false;
        item = res.value;
        if (res.done) {
          frames.pop();
          popBinds(f);
          marks = f.marks;
        }
      } catch (e) {
        frames.pop();
        popBinds(f);
        failed = true;
        error = e;
      }
    }
  };
  /** Runs a call to its value, from inside the running of another. It may not wait. */
  const run = (start: Step): V => runStack({ frames: [], task: undefined, nested: true }, start, undefined) as V;

  /** A task is over: its value is written where it goes, and what waited for it is put in line. */
  const finish = (t: Task, x: V): void => {
    t.done = true;
    t.result = x;
    const slot = t.slot;
    if (slot !== undefined) {
      taskOf.delete(slot);
      if (t.fills) {
        slot.busy = false;
        slot.value = x;
        slot.done = x instanceof Refuted || known(x);
        slot.rests = [...t.base.values()];
      }
      for (const r of waitersOf.get(slot) ?? []) {
        if (!live(r)) continue;
        if (x instanceof Refuted) r.task.carries = true;
        enqueue(r.task, true);
      }
      if (x instanceof Refuted)
        for (const r of watchersOf.get(slot) ?? []) {
          if (!live(r) || r.task.queued) continue;
          r.task.woken = { frame: r.frame, value: x };
          r.task.carries = true;
          enqueue(r.task, true);
        }
    }
    if (!t.root) return;
    if (x instanceof Refuted) refutedNow.push(x);
    for (const g of t.memberOf) {
      g.pending.delete(t);
      if (x instanceof Refuted && g.refuted === undefined) g.refuted = x;
      if (!arrived(g)) continue;
      for (const r of waitersOf.get(g) ?? []) {
        if (!live(r)) continue;
        if (g.refuted !== undefined) r.task.carries = true;
        enqueue(r.task, false);
      }
    }
  };
  /** Work a block left going: it is a root from here, and every sequence around it waits for it. */
  const detach = (t: Task): void => {
    if (t.done || t.root) return;
    t.root = true;
    t.memberOf = [...groups];
    for (const g of t.memberOf) g.pending.add(t);
    if (t.parked && (arrived(t.on) || t.woken !== undefined)) enqueue(t, false);
    wanted(t);
  };
  /** Takes a task up at the point where it stopped. */
  const resume = (t: Task): void => {
    t.epoch++;
    t.parked = false;
    t.carries = false;
    if (t.slot !== undefined) taskOf.delete(t.slot);
    const woken = t.woken;
    t.woken = undefined;
    if (woken !== undefined) t.frames.length = woken.frame + 1;
    const handed = woken === undefined ? t.deliver?.result : undefined;
    t.deliver = undefined;
    t.on = undefined;
    const [outerCollectors, outerGroups, outerBudget] = [collectors, groups, budget];
    collectors = [t.base];
    groups = [...t.inherited];
    for (const f of t.frames) {
      if (f.collector !== undefined) collectors.push(f.collector);
      if (f.group !== undefined) groups.push(f.group);
      if (f.capped) {
        f.saved = budget;
        f.cap = budget = Math.min(budget, spent + f.remaining);
      }
    }
    const S: Stack = { frames: t.frames, task: t, nested: false };
    t.frames = [];
    try {
      const r = S.frames.length === 0 ? (handed as V) : runStack(S, handed, woken === undefined ? undefined : new Signal(woken.value));
      if (r !== SUSPENDED) finish(t, r);
    } catch (e) {
      // Its steps ran out, or it failed: what it was doing is dropped, and nothing it was to give comes.
      t.done = true;
      if (t.slot !== undefined) taskOf.set(t.slot, t);
      throw e;
    } finally {
      [collectors, groups, budget] = [outerCollectors, outerGroups, outerBudget];
    }
  };

  /** What is to be done with a value once it is known. With the value at hand it is done at once. */
  const after = (s: Step, k: (x: V) => Step): Step => (s instanceof Call ? new Call(afterGen(s, k), undefined) : k(s));
  const afterGen = function* (s: Call, k: (x: V) => Step): Gen {
    return k(yield s);
  };
  /** A call run from `run` itself, not from where it was made: what keeps a long chain of calls off the host's stack. */
  const bounce = (thunk: () => Step): Call => new Call(undefined, thunk);
  /** A frame whose whole life is one evaluation: what is bound to its call is in force for all of it. */
  const passGen = function* (make: () => Step): Gen {
    const s = make();
    return s instanceof Call ? yield s : s;
  };
  const framed = (gen: Gen, ctl: Ctl | undefined): Call => {
    const c = new Call(gen, undefined);
    c.ctl = ctl;
    return c;
  };
  const hooked = (make: (ctl: Ctl) => Gen): Call => {
    const ctl: Ctl = {};
    return framed(make(ctl), ctl);
  };
  const waitFor = (w: Waitable): Call => {
    const c = new Call(undefined, undefined);
    c.wait = w;
    return c;
  };
  /** Evaluates under a fresh collector, and hands on the value with what the evaluation rested on. */
  const collectingGen = function* (make: () => Step, k: (value: V, rests: Rest[]) => Step): Gen {
    const mine = new Map<string, Rest>();
    const c = framed(passGen(make), { pass: true });
    c.collector = mine;
    const value: V = yield c;
    return k(value, [...mine.values()]);
  };

  /**
   * What a value still waits for that will come: an unfilled cell, or a value a task is
   * working out. A parameter left unknown is not that: no answer comes for it, and what
   * needs it is left as an expression.
   */
  const awaited = (x: V): CellV | Lazy | undefined => {
    for (;;) {
      if (x instanceof CellV) {
        if (!x.filled) return x;
        x = x.value as V;
      } else if (x instanceof Lazy) {
        if (!x.done && x.busy) return taskOf.has(x) ? x : undefined;
        x = x.value;
      } else return undefined;
    }
  };
  /** True for a handle that waits for something that will come, or stands for more than it did when it was last evaluated. */
  const behind = (x: V): boolean => {
    if (x instanceof CellV) return true;
    if (!(x instanceof Lazy) || x.done) return false;
    if (x.busy) return taskOf.has(x);
    const inner = x.value;
    return inner instanceof CellV || (inner instanceof Lazy && (inner.done || behind(inner)));
  };
  /** Waits until a value no longer waits for anything that will come, evaluating it again each time something came. */
  const needGen = function* (x: V, scope: ScopeV, one: (a: V, scope: ScopeV) => Step): Gen {
    for (;;) {
      const w = awaited(x);
      if (w === undefined) return x;
      yield waitFor(w);
      const s = one(x, scope);
      x = s instanceof Call ? yield s : s;
    }
  };
  /** What is to be done with a value that is needed. Ahead of what is done nothing waits. */
  const needed = (s: Step, scope: ScopeV, k: (x: V) => Step): Step =>
    after(s, (x) => (ahead || awaited(x) === undefined ? k(x) : after(framed(needGen(x, scope, evaluate), { pass: true }), k)));
  /** The value of an evaluation, once it waits for nothing that will come. */
  const needStep = (s: Step, scope: ScopeV): Step =>
    s instanceof Call ? framed(needFromGen(s, scope), { pass: true }) : ahead || awaited(s) === undefined ? s : framed(needGen(s, scope, evaluate), { pass: true });
  const needFromGen = function* (s: Call, scope: ScopeV): Gen {
    let x: V = yield s;
    for (;;) {
      const w = ahead ? undefined : awaited(x);
      if (w === undefined) return x;
      yield waitFor(w);
      const again = evaluate(x, scope);
      x = again instanceof Call ? yield again : again;
    }
  };
  /** A task that waits for a value in hand, and the value that stands for the task's. */
  const spawn = (x: V, scope: ScopeV): Lazy => {
    const slot = new Lazy(PENDING, scope);
    slot.busy = true;
    const t = new Task(slot, true);
    const gen = needGen(x, scope, evaluate);
    const w = gen.next(undefined as never).value as Call;
    t.frames = [{ gen, marks: undefined, collector: undefined, group: undefined, capped: false, cap: 0, saved: 0, remaining: 0, ctl: { pass: true } }];
    t.inherited = [...groups];
    t.on = w.wait as Waitable;
    register(t);
    return slot;
  };
  /** True where a task's value will be a claim's: the claim waits. */
  const claimWaits = (t: Task | undefined): boolean => {
    while (t !== undefined) {
      for (const f of t.frames) {
        if (f.marks?.site !== undefined) return true;
        if (f.ctl?.pass !== true) return false;
      }
      t = t.on instanceof Lazy ? taskOf.get(t.on) : undefined;
    }
    return false;
  };
  /** The unfilled cells met while evaluating ahead: what is held will come to wait for them. */
  let seenAhead: Set<CellV> | undefined;
  /**
   * Evaluates ahead of what is done, at once: no effect is performed, and nothing waits.
   * The cells it meets are noted for the frame that holds what was evaluated.
   */
  const aheadOf = (e: V, scope: ScopeV, ctl: Ctl): V => {
    const [before, seenBefore] = [ahead, seenAhead];
    ahead = true;
    const met = (seenAhead = new Set<CellV>());
    try {
      return run(evaluate(e, scope));
    } finally {
      ahead = before;
      seenAhead = seenBefore;
      ctl.cells = [...met];
    }
  };

  /**
   * Each of some values in turn. They are started in order and none waits for one before
   * it: where one comes to wait, the next is started all the same. Then every one is
   * needed. A refutation ends it.
   */
  const each = (items: readonly V[], scope: ScopeV, one: (a: V, scope: ScopeV) => Step, k: (args: V[]) => Step): Step => {
    const args: V[] = [];
    for (let i = 0; i < items.length; i++) {
      const s = one(items[i], scope);
      if (s instanceof Call) {
        const ctl: Ctl = { boundary: true, scope };
        return framed(eachGen(items, i, s, args, scope, one, k, ctl), ctl);
      }
      if (s instanceof Refuted) return s;
      args.push(s);
    }
    return all(args, scope, one, k);
  };
  const eachGen = function* (items: readonly V[], i: number, s: Step, args: V[], scope: ScopeV, one: (a: V, scope: ScopeV) => Step, k: (args: V[]) => Step, ctl: Ctl): Gen {
    for (;;) {
      const r: V = s instanceof Call ? yield s : s;
      if (r instanceof Refuted) return r;
      args.push(r);
      if (++i >= items.length) break;
      s = one(items[i], scope);
    }
    ctl.boundary = false;
    return all(args, scope, one, k);
  };
  const all = (args: V[], scope: ScopeV, one: (a: V, scope: ScopeV) => Step, k: (args: V[]) => Step): Step => {
    if (ahead || !args.some(behind)) return k(args);
    const ctl: Ctl = {};
    return framed(allGen(args, scope, one, k, ctl), ctl);
  };
  /** Every one of some values is needed. One that comes out refuted while another is waited for refutes the whole at once. */
  const allGen = function* (args: V[], scope: ScopeV, one: (a: V, scope: ScopeV) => Step, k: (args: V[]) => Step, ctl: Ctl): Gen {
    ctl.watch = args.filter((a): a is Lazy => a instanceof Lazy && taskOf.has(a));
    ctl.cells = args.map(awaited).filter((w): w is CellV => w instanceof CellV);
    try {
      for (let i = 0; i < args.length; i++) {
        let a = args[i];
        if (!behind(a)) continue;
        for (;;) {
          const w = awaited(a);
          if (w !== undefined) yield waitFor(w);
          const s = one(a, scope);
          a = s instanceof Call ? yield s : s;
          if (awaited(a) === undefined) break;
        }
        if (a instanceof Refuted) return a;
        args[i] = a;
      }
    } catch (e) {
      if (e instanceof Signal) return e.value;
      throw e;
    }
    ctl.watch = undefined;
    ctl.cells = undefined;
    return k(args);
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
      if (!v.filled) {
        seenAhead?.add(v);
        return v;
      }
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
      // Unless a task that waits is working it out: then it is that task's to give, and still waits.
      if (v.busy) return taskOf.has(v) ? v : new Refuted("a value that needs itself to be known", undefined);
      return framed(lazyGen(v), { lazy: v, pass: true });
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
    return needed(evaluate(v.fn, scope), scope, (fn) => applied(v, fn, scope));
  };
  const lazyGen = function* (v: Lazy): Gen {
    v.busy = true;
    const mine = new Map<string, Rest>();
    let r: V;
    try {
      const c = framed(passGen(() => evaluate(v.value, v.scope)), { pass: true });
      c.collector = mine;
      r = yield c;
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
      if (fn.name === "claim" || withdrawn) return hooked((ctl) => claimGen(v, fn, scope, ctl));
      if (fn.name === "assume") {
        // The claim is not evaluated. The record says who assumed it, the module whose code
        // this is, and which assumption it is: the one written here.
        const by: Rest = { kind: "assumption", by: v.owner?.module ?? "", at: out(v.site ?? v) };
        rest(by);
        return new Decided(TRUE, [by], "assumed");
      }
      if (fn.name === "if") {
        // The condition is needed; a branch is needed only if it is the one taken.
        return needed(evaluate(v.args[0], scope), scope, (condition) => {
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
        return needed(evaluate(v.args[0], scope), scope, (target) =>
          needed(evaluate(v.args[1], scope), scope, (k) => {
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
      if (fn.name === "then") return hooked((ctl) => thenGen(v, fn, scope, ctl));
      if (fn.name === "also") {
        const ctl: Ctl = { boundary: true, scope };
        return framed(alsoGen(v, fn, scope, ctl), ctl);
      }
      if (fn.name === "attempt") {
        // The budget is needed; what is attempted is evaluated inside the attempt.
        return needed(evaluate(v.args[1], scope), scope, (steps) => {
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

  const claimGen = function* (v: Expr, fn: KernelPrim, scope: ScopeV, ctl: Ctl): Gen {
    const site = v.site ?? v;
    // A claim made to wait is counted as waiting, once, until it is decided.
    let waits = false;
    ctl.onSuspend = () => {
      if (!waits) {
        waits = true;
        tallyOf(site);
        waitingAt.set(site, (waitingAt.get(site) ?? 0) + 1);
      }
      return undefined;
    };
    const mine = new Map<string, Rest>();
    const c = framed(passGen(() => needStep(evaluate(v.args[0], scope), scope)), undefined);
    c.collector = mine;
    const claimed: V = yield c;
    ctl.onSuspend = undefined;
    if (waits) waitingAt.set(site, (waitingAt.get(site) ?? 1) - 1);
    const rests = [...mine.values()];
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
  };
  const thenGen = function* (v: Expr, fn: KernelPrim, scope: ScopeV, ctl: Ctl): Gen {
    // The first is over, and only then the second. Over means its value is known and
    // nothing that evaluating it started still goes on: a caller who writes `then` cannot
    // see what a function it calls left going. When the first is made to wait, the second is
    // evaluated ahead with no effect performed, once, so a refutation in it is found now.
    const group: MGroup = groupOf.get(v) ?? { pending: new Set(), refuted: undefined };
    let looked: V | undefined;
    ctl.onSuspend = () => {
      if (looked !== undefined) return undefined;
      looked = aheadOf(v.args[1], scope, ctl);
      return looked instanceof Refuted ? looked : undefined;
    };
    let first: V;
    try {
      const c = framed(passGen(() => evaluate(v.args[0], scope)), undefined);
      c.group = group;
      first = yield c;
      for (;;) {
        // A refutation in what the first started is a refutation of the first.
        const wrong = first instanceof Refuted ? first : group.refuted;
        if (wrong !== undefined) {
          ctl.onSuspend = undefined;
          return new Call(lookAheadGen(v.args[1], scope, wrong), undefined);
        }
        if (ahead) break;
        if (awaited(first) !== undefined) first = yield framed(needGen(first, scope, evaluate), { pass: true });
        else if (group.pending.size > 0) yield waitFor(group);
        else break;
      }
    } catch (e) {
      if (e instanceof Signal) return e.value;
      throw e;
    }
    ctl.onSuspend = undefined;
    if (known(first) && group.pending.size === 0) return evaluate(v.args[1], scope);
    // The first rests on something no answer will come for: what is left is an expression.
    let second: V;
    if (looked !== undefined) second = looked;
    else {
      const before = ahead;
      ahead = true;
      try {
        const s = evaluate(v.args[1], scope);
        second = s instanceof Call ? yield s : s;
      } finally {
        ahead = before;
      }
    }
    if (second instanceof Refuted) return second;
    const left = new Expr(fn, [first, second instanceof Lazy || !(second instanceof Expr || second instanceof NameRef) ? second : later(second, scope)]);
    groupOf.set(left, group);
    return left;
  };
  const alsoGen = function* (v: Expr, fn: KernelPrim, scope: ScopeV, ctl: Ctl): Gen {
    // The first is started, and then the second; the second does not wait for the first.
    const s1 = evaluate(v.args[0], scope);
    let first: V = s1 instanceof Call ? yield s1 : s1;
    ctl.boundary = false;
    if (first instanceof Refuted) return new Call(lookAheadGen(v.args[1], scope, first), undefined);
    if (known(first)) return evaluate(v.args[1], scope);
    if (!ahead) {
      // The first waits for an answer that will come: it is a task.
      const slot = first instanceof Lazy && taskOf.has(first) ? first : awaited(first) !== undefined ? spawn(first, scope) : undefined;
      if (slot !== undefined && claimWaits(taskOf.get(slot))) {
        // A claim that waits holds what is written after it: no effect of it is performed
        // until the claim is decided. It is evaluated ahead, so a refutation in it is found now.
        const looked = aheadOf(v.args[1], scope, ctl);
        if (looked instanceof Refuted) return looked;
        first = yield framed(needGen(slot, scope, evaluate), { pass: true });
        if (first instanceof Refuted) return new Call(lookAheadGen(v.args[1], scope, first), undefined);
        if (known(first)) return evaluate(v.args[1], scope);
      } else if (slot !== undefined) {
        // Nothing holds the second. Its value is the whole's, and the first goes on as work
        // of this evaluation. A refutation of the first while the second is worked out is
        // the whole's.
        ctl.watch = [slot];
        let second: V;
        try {
          const s = evaluate(v.args[1], scope);
          second = s instanceof Call ? yield s : s;
        } catch (e) {
          if (e instanceof Signal) return new Call(lookAheadGen(v.args[1], scope, e.value), undefined);
          throw e;
        }
        ctl.watch = undefined;
        if (second instanceof Refuted) return second;
        if (slot.done && slot.value instanceof Refuted) return slot.value;
        const t = taskOf.get(slot);
        if (t !== undefined) detach(t);
        return second;
      }
    }
    // The first rests on something no answer will come for. A claim that waits holds what
    // is written after it.
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
    if (!held && !ahead && known(second)) return second;
    return new Expr(fn, [first, second instanceof Lazy || !(second instanceof Expr || second instanceof NameRef) ? second : later(second, scope)]);
  };
  const attemptGen = function* (v: Expr, fn: KernelPrim, steps: V, allowed: number, scope: ScopeV): Gen {
    let r: V;
    try {
      // What is attempted is needed inside the attempt: where it waits, the attempt waits, and its budget with it.
      const c = framed(passGen(() => needStep(evaluate(v.args[0], scope), scope)), undefined);
      c.cap = allowed;
      r = yield c;
    } catch (e) {
      // The attempt's own budget ran out, or the host's own limit was reached inside it:
      // either way the answer is "limit", and what goes on from it rests on a limit.
      if ((e instanceof LimitReached && spent < budget) || e instanceof RangeError) {
        rest({ kind: "limit" });
        return failure("limit");
      }
      throw e;
    }
    if (r instanceof Refuted) return failure("refuted", text(r.reason));
    if (known(r)) return r;
    // It rests on something no answer will come for. What is left is attempted again.
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
      if (s instanceof Struct && !settled.has(s)) {
        const ctl: Ctl = { boundary: true, scope };
        return framed(entriesGen(s, r, scope, ctl), ctl);
      }
      return r;
    });
  /** The entries are started in order, and none waits for one before it. Then each is needed. */
  const entriesGen = function* (s: Struct, r: V, scope: ScopeV, ctl: Ctl): Gen {
    const waits: V[] = [];
    for (const [k, e] of s.entries) {
      if (hidden(k)) continue;
      step(); // a structure handed over whole costs a step for each entry
      const st = inFull(e, scope);
      const x: V = st instanceof Call ? yield st : st;
      if (x instanceof Refuted) return x;
      if (!ahead && behind(x)) waits.push(x);
    }
    ctl.boundary = false;
    return waits.length === 0 ? r : all(waits, scope, inFull, () => r);
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
      // What waits for this cell is taken up by the next `advance`, in the order it came to
      // wait, after what waits for cells filled before it.
      for (const r of waitersOf.get(c) ?? []) if (live(r)) enqueue(r.task, false);
    },
    waiting: () => {
      for (let i = waitedCells.length - 1; i >= 0; i--) if (waitedCells[i].filled) waitedCells.splice(i, 1);
      const wanted = (r: Registration): boolean => live(r) && inDemand(r.task);
      return waitedCells.filter((c) => (waitersOf.get(c) ?? []).some(wanted) || (interestOf.get(c) ?? []).some(wanted)).map((c) => out(c) as Cell);
    },

    evaluate: (expression, scope, limits): Result => {
      const e = into(expression, "the expression");
      const s = scopeIn(scope, "the scope");
      tallies.clear();
      cut = false;
      collectors = [];
      groups = [];
      const r = within(limits, (): V => {
        const S: Stack = { frames: [], task: undefined, nested: false };
        const x = runStack(S, needStep(evaluate(e, s), s), undefined);
        if (x !== SUSPENDED) return x;
        // It waits. What is given stands for its value, which `current` reads once it is known.
        const t = S.task as Task;
        // A claim that waits reads as a claim not yet decided.
        const slot = new Lazy(claimWaits(t) ? new Expr(CLAIM as V, [PENDING]) : PENDING, s);
        slot.busy = true;
        t.slot = slot;
        taskOf.set(slot, t);
        return slot;
      });
      const value = r.value ?? e;
      return { value: out(value), ended: r.ended, steps: r.steps, refuted: value instanceof Refuted, claims: claimRecords(), ...(cut ? { cutShort: true as const } : {}) };
    },
    advance: (limits): Advance => {
      if (ready.length === 0) return { ended: "complete", steps: 0, refuted: [], claims: [] };
      tallies.clear();
      cut = false;
      refutedNow = [];
      // Each task is taken up in the order its answer arrived, and what it wakes straight
      // after it. Once a root comes out refuted, no further effect is performed in this
      // call: only a task that the refutation woke is taken up, to hand it on, and the
      // others stay in line for a later call. Whether there is one is the launcher's to say.
      const r = within(limits, () => {
        for (;;) {
          const i = refutedNow.length === 0 ? 0 : ready.findIndex((t) => t.carries);
          if (i < 0 || i >= ready.length) break;
          const t = ready.splice(i, 1)[0];
          t.queued = false;
          cursor = 0;
          resume(t);
        }
      });
      const refuted: Value[] = [];
      for (const x of refutedNow) if (!refuted.includes(out(x))) refuted.push(out(x));
      return { ended: r.ended, steps: r.steps, refuted, claims: claimRecords(), ...(cut ? { cutShort: true as const } : {}) };
    },
    current: (value) => {
      const v = into(value, "the value");
      if (v instanceof Lazy && taskOf.has(v)) return value;
      const now = through(v);
      return now === v ? value : out(now);
    },
  };
  return kernel;
};
