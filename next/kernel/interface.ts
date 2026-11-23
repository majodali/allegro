// The kernel's interface.
//
// One of the three contracts between the two streams of the rebuild
// (docs/plans/rebuild.md §8 rule 2): a change to this file is a pull
// request of its own, merged by the maintainer.
//
// What it realises, from docs/plans/book-pass-inventory.md:
//   "The kernel is passive"
//   "What the kernel's interface offers"
//   "No interface call writes a bare claim outcome"
//   "Limits are step budgets"
//   "Seven representation kinds", "A missing value is a cell that is filled once",
//   "Host code reaches a program only as primitive functions",
//   "A late answer or its failure fills a cell as plain data"
//
// Who calls it: host code only. A launcher, a test, an embedding
// application, the loader of a saved program. Allegro code never sees
// this interface; what Allegro code may do is the kernel's primitives,
// which are Part II's and are not stated here.
//
// One interface, `Kernel`, version 2. Until 2026-11-20 it was stated in
// two versions, `Kernel` and `Kernel2`. Version 2 is the two made one,
// with four older forms removed: the names `Kernel2` and
// `CreateKernel2`; `scope()` and the scope argument of `evaluate`;
// `fill` that only records unless told otherwise; and `steps` given to
// `advance`.
//
// The kernel is passive. Creating one does nothing but create it. It
// reads no file, no text, no environment and no clock. Every effect a
// program has reaches the outside through a primitive function that the
// host supplied.

/** The version of this interface. A kernel states the one it implements. */
export const INTERFACE_VERSION = 2;

// Brands. Each is a type-level marker with no run-time existence: it
// keeps the handle types apart for the compiler, so a plain value cannot
// be passed where a cell is wanted. A kernel implements the handles as
// it likes; no property of these names exists on them.
declare const valueBrand: unique symbol;
declare const cellBrand: unique symbol;

/**
 * A value in a kernel. Opaque to the host: it is read only through the
 * kernel that made it, and belongs to that kernel alone.
 */
export interface Value {
  readonly [valueBrand]: true;
}

/**
 * A cell: a place for a value that is missing and will be filled once.
 * A cell is usable wherever a value is: as an argument, as a structure's
 * entry, as what a symbol is bound to. Evaluation that meets an unfilled
 * cell leaves a residual and is evaluated again when the cell is filled.
 */
export interface Cell extends Value {
  readonly [cellBrand]: true;
}

/** The seven representation kinds. A kind says how a value is represented; it is not a type. */
export type Kind =
  | "bits"
  | "symbol"
  | "param"
  | "expression"
  | "composed-function"
  | "primitive-function"
  | "structure";

/** One entry of a structure. An array is a structure whose entries all have a null key. */
export type Entry = readonly [key: Value | null, value: Value];

/**
 * What a primitive function is given when it runs. It can construct and
 * read plain data and can make a cell for an answer that takes time.
 * It cannot evaluate, bind, reach a scope or read or write metadata: a
 * primitive function takes data and returns data.
 */
export interface PrimitiveContext {
  bits(bytes: Uint8Array, bitLength?: number): Value;
  symbol(fqn: string): Value;
  structure(entries: readonly Entry[]): Value;
  kind(value: Value): Kind;
  bitsOf(value: Value): { readonly bytes: Uint8Array; readonly bitLength: number };
  symbolName(value: Value): string;
  entriesOf(value: Value): readonly Entry[];
  /** A cell the host fills later, through `Kernel.fill`. */
  cell(): Cell;
}

/**
 * The declaration of a primitive function: a function whose body is
 * host code. It is pure or effectful; its purity is declared here and
 * assumed by the kernel.
 */
export type PrimitiveDeclaration =
  | {
      /** Performs no effect. The same arguments always give the same answer. Needs no grant. */
      readonly purity: "pure";
      /** The content hash by which saved programs name it, as `sha256:<hex>`. */
      readonly hash: string;
      /** For reports. Not an identity. */
      readonly name: string;
      readonly arity: number;
      readonly run: (args: readonly Value[], context: PrimitiveContext) => Value;
    }
  | {
      /** Performs an effect. It is one part of a capability, and is granted by being handed over. */
      readonly purity: "effectful";
      /** The capability it is a part of, and which part, by the names of the capability's definition. */
      readonly capability: string;
      readonly part: string;
      readonly arity: number;
      /** May return a cell for an answer that takes time. */
      readonly run: (args: readonly Value[], context: PrimitiveContext) => Value;
    };

/**
 * A limit on one evaluation: a budget of steps. A step is a bounded amount
 * of work: the kernel charges its primitives on bits by the bits they
 * handle, and a structure handed to a primitive function by its entries,
 * so a budget bounds memory as well as time, up to a constant. A limit by
 * the clock is the launcher's business. An evaluation that ends at its
 * limit cannot be continued by this kernel: evaluating the expression
 * again starts again, and performs again any effect already performed.
 *
 * A count of steps is given in two ways (ruled on 2026-11-20).
 *
 * A budget, `steps`, bounds the whole work of an evaluation and is never
 * filled up again. The budget given to `evaluate` is the evaluation's:
 * the work `advance` and `fill` later do for that evaluation is counted
 * against what is left of it. When it is spent the evaluation is over, at
 * its limit: what it had paused or waiting is dropped, and an answer that
 * arrives for it later is ignored.
 *
 * A launcher gives its budget once, to `evaluate`. `advance` and `fill`
 * take a slice and no budget.
 *
 * A slice, `slice`, bounds one call. When it is spent nothing is over:
 * the call returns "paused", the task that was running is the first to go
 * on, and the next call of `advance` goes on with it. A slice never
 * changes what happens, only when. The kernel pauses at the first point
 * it can after the slice is spent, so a call may count a few steps more
 * than its slice. The reference kernel has no slices and ignores this
 * field.
 */
/** What bounds one call of `advance` or `fill`: a slice, and nothing else. */
export interface Slice {
  /** The call returns after about this many steps, and what it was doing is paused. */
  readonly slice?: number;
}

export interface Limits {
  /** A budget: the evaluation ends, with everything unfinished undecided, after this many steps. */
  readonly steps?: number;
  /** A slice: the call returns after about this many steps, and what it was doing is paused. */
  readonly slice?: number;
}

/**
 * How strongly a claim holds, as the kernel recorded it. It says how the
 * claim itself was settled, and nothing lowers it but another claim:
 *   "decided"   a kernel evaluated the claim, on the values in hand, and
 *               it came out true;
 *   "sampled"   it was evaluated on some cases;
 *   "assumed"   someone stated it and no kernel evaluated it;
 *   "undecided" nothing decided it: it still waits, and its value is then of
 *               kind "expression"; or it was evaluated and what decides it
 *               answered that it cannot tell, and `reasonOf` says why;
 *   "refuted"   it was evaluated and is not true.
 * Only the kernel records an outcome. Code can ask for a weaker one, by
 * the kernel's primitives `assume` and `undecided`, and never for a
 * stronger: nothing but the kernel's own evaluation gives "decided".
 */
export type Outcome = "decided" | "refuted" | "undecided" | "sampled" | "assumed";

/**
 * One thing a result rests on: something its evaluation used that the
 * kernel did not itself evaluate. It is recorded beside the outcome and
 * never changes the outcome's word.
 */
export type Rest =
  /** The kernel variant that evaluated it. */
  | {
      readonly kind: "kernel";
      readonly variant: string;
      /**
       * Present where the kernel did not evaluate the claim in full: its
       * `sample` evaluated it on this many cases and found it true of
       * each. What rests on such a record holds for those cases, and is no
       * stronger than sampled.
       */
      readonly sampled?: number;
    }
  /** A pure primitive function, by content hash. */
  | { readonly kind: "primitive"; readonly hash: string; readonly name: string }
  /** An effectful primitive whose answer was an input: a part of a capability. */
  | { readonly kind: "capability"; readonly capability: string; readonly part: string }
  /** Whoever built the saved program a restored outcome came from. */
  | { readonly kind: "builder"; readonly builder: string }
  /**
   * An assumption: the module whose code wrote it, by identity, taken by
   * the kernel from the mark on that code. Empty where the code that
   * assumed belongs to no module. `at` is the assumption as written, the
   * application of the kernel's `assume`, so that everything resting on
   * one assumption can be listed and that assumption withdrawn. It is
   * a handle of this kernel and is no part of a stored outcome.
   */
  | { readonly kind: "assumption"; readonly by: string; readonly at?: Value }
  /**
   * A limit: an attempt inside the evaluation ran out of steps, and the
   * program went on from that answer. Where steps run out may differ
   * between kernels and with the order answers arrive, so a result that
   * rests on a limit holds for this evaluation only: it is never stored
   * or restored, and is not compared between kernels.
   */
  | { readonly kind: "limit" };

/** What one call of `evaluate` returns: how things stood when it returned. */
export interface Result {
  /**
   * The value, or the residual where information was missing. A residual
   * is a value of kind "expression". After cells are filled and the
   * kernel has advanced, `Kernel.current` gives the value as it now
   * stands.
   */
  readonly value: Value;
  /**
   * "complete": evaluation went as far as the information allows.
   * "limit": a limit was reached; what was unfinished is undecided.
   * "paused": the call's slice was spent. `value` stands for the value,
   * as it does for an evaluation that waits, and `advance` goes on.
   */
  readonly ended: "complete" | "limit" | "paused";
  /** The number of steps spent. */
  readonly steps: number;
  /** True when a refutation is recorded on `value`: the program is wrong. */
  readonly refuted: boolean;
  /** The claims this call evaluated: one record for each claim as written. */
  readonly claims: readonly ClaimRecord[];
  /**
   * Present, and true, where the call met a refutation and its steps ran
   * out while it looked for further ones. A refutation outranks a limit:
   * the refutation stands, and this says the list of them may be short.
   */
  readonly cutShort?: true;
  /**
   * From `check` only: the refutations found in parts that do not refute
   * the whole, each with the place of the part where it has one. A
   * refuted claim is not repeated here: it is among `claims`.
   */
  readonly refutations?: ReadonlyArray<{ readonly reason: string; readonly at?: Place }>;
}

/**
 * What one call of `evaluate` or `advance` did with one claim.
 *
 * There is one record for a claim as written, however often the call
 * evaluated it: a claim in a function called a thousand times is one
 * record with a count of a thousand. The four counts are of this call.
 * `waiting` is a level, not a count of this call: how many evaluations
 * of the claim wait now. A claim a call did not evaluate has no record
 * in it, and its level is what its last record said.
 *
 * An evaluation that waited and is taken up again by a later call is
 * counted there under how it came out, and leaves the level.
 */
export interface ClaimRecord {
  /**
   * The claim as written: the application of the kernel's claim
   * primitive that the host constructed or a saved program built. It is
   * the same handle, so a host finds it by `===`, and it is what
   * `claimKey` takes.
   */
  readonly claim: Value;
  /** The identity of the module whose code wrote the claim, where a module did. */
  readonly module?: string;
  /** Where the claim was written, where the kernel was told. */
  readonly at?: Place;
  /** Evaluations that came out decided, a restored outcome among them. */
  readonly decided: number;
  /** Evaluations that came out sampled: true of each case tried, or resting on such a sample. */
  readonly sampled: number;
  /** Evaluations that came out resting on an assumption. */
  readonly assumed: number;
  /** Evaluations where what decides the claim answered that it cannot tell. */
  readonly undecided: number;
  /** Evaluations that were refuted: the claim was not true, or what it claimed was a refutation. */
  readonly refuted: number;
  /** How many evaluations of the claim wait now, on a cell or on anything else not yet known. */
  readonly waiting: number;
  /** The reasons given by this call's undecided and refuted evaluations, each once. */
  readonly reasons: readonly string[];
  /** What this call's decided, assumed and undecided evaluations rest on, each once. */
  readonly restsOn: readonly Rest[];
}

/** What one call of `advance` returns. */
export interface Advance {
  /**
   * "complete": everything that was ready has been evaluated again.
   * "limit": the kernel reached a limit of its own in the middle of the
   * call. Only the reference kernel has one: its host's stack. An
   * evaluation whose budget is spent does not end the call: see `limited`.
   * "paused": the call's slice was spent; call `advance` again to go on.
   */
  readonly ended: "complete" | "limit" | "paused";
  /** The number of steps spent. */
  readonly steps: number;
  /** The values on which a refutation was recorded during this call. */
  readonly refuted: readonly Value[];
  /** The claims this call evaluated: one record for each claim as written. */
  readonly claims: readonly ClaimRecord[];
  /**
   * Present, and true, where the call met a refutation and its steps ran
   * out while it looked for further ones. A refutation outranks a limit:
   * the refutation stands, and this says the list of them may be short.
   */
  readonly cutShort?: true;
  /**
   * Present where the budget of an evaluation was spent during this
   * call: what `evaluate` gave as the value of each such evaluation. Each
   * is over, at its limit. The call went on with the others.
   */
  readonly limited?: readonly Value[];
}

/**
 * Thrown when one of the kernel's own invariants is broken. A fault in
 * the kernel, never in the program: a wrong program is refuted, it does
 * not throw.
 */
export class KernelFault extends Error {
  constructor(readonly invariant: string) {
    super(`kernel fault: ${invariant}`);
  }
}

/**
 * Thrown to a host that reads the bytes of a value which the budget of
 * the evaluation that made it does not cover. A value made by joining is
 * kept as its parts until its bytes are read; laying them out is the
 * last of the work of calculating it, and is counted against the
 * evaluation that made it. Where what is left of that budget is too
 * little, the bytes are not laid out, this is thrown, and the evaluation
 * is over, at its limit. It is a failure, not a fault of the kernel and
 * not a misuse: a host that means to avoid it reads `bitLength` first,
 * which lays nothing out. Inside an evaluation the same shortfall ends
 * the evaluation at its limit, as any spent budget does.
 */
export class LimitFailure extends Error {
  constructor(readonly bits: number, readonly left: number) {
    super(`a value of ${bits} bit(s) is not laid out: ${left} step(s) are left of the budget of the evaluation that made it`);
  }
}

/**
 * Thrown when the host misuses the interface: a value of another
 * kernel, a call on the wrong kind, a symbol bound twice in one scope,
 * a cell filled twice.
 */
export class InterfaceError extends Error {}

/**
 * What a primitive function's host code throws when it is applied outside
 * its domain: division by zero, a text that is not a number. The kernel
 * turns it into a refutation with this reason. Any other error a primitive
 * throws is a fault of the primitive and is not caught.
 */
export class Refusal extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

/**
 * What one parameter of a module is declared to be. It is part of the
 * module's content: the same code declared otherwise is another module.
 * For an import, `identity` is the identity of the module imported, so a
 * module's identity covers, through its imports, everything it depends on.
 */
export interface Declaration {
  readonly role: "capability" | "input" | "module";
  /** The capability's name, the input's name, or the name the module is imported under. */
  readonly name: string;
  /** For a module: the identity of the module imported, as `sha256:<hex>`. */
  readonly identity?: string;
}

/** One point in a text. */
export interface Location {
  /** How many characters come before it in the text, from 0. */
  readonly index: number;
  /** Its line, from 1. */
  readonly line: number;
  /** Its column in that line, from 1. */
  readonly column: number;
}

/**
 * Where a part was written: the text, and where the part starts and ends
 * in it. The source is what whoever read the text calls it, a file's path
 * or a module's name; the kernel gives it no meaning. A place is no part
 * of a module's identity or of a claim's key: the same text laid out
 * otherwise is the same module.
 */
export interface Place {
  readonly source: string;
  readonly start: Location;
  /** The point after the part's last character. */
  readonly end: Location;
}

/**
 * One thing the kernel did, as it tells a host that listens
 * (`Kernel.observe`). Each names the part of the program it is about, and
 * the part's place where it has one. `ahead` is true where the part was
 * evaluated ahead of what is done: while a function is specialized, for
 * what a `then` or a waiting claim holds back, and after a refutation.
 * Nothing is performed there.
 *   "branch"  a conditional's condition was evaluated. `taken` says which
 *             branch was then evaluated: "then", "else", "both" where the
 *             condition is unknown and a function is being specialized,
 *             or "neither" where it is unknown and nothing is.
 *   "call"    a composed function's body was opened. `function` is the
 *             function.
 *   "claim"   an evaluation of a claim came out. `part` is the claim as
 *             written. "waiting" says it is not decided yet.
 *   "effect"  a part of a capability was performed.
 *   "refuted" a check found a part refuted that the program as a whole
 *             is not refuted by: a branch under an unknown condition, a
 *             function nothing called, a value nothing read.
 */
export type Observed =
  | { readonly kind: "branch"; readonly part: Value; readonly at?: Place; readonly ahead: boolean; readonly taken: "then" | "else" | "both" | "neither" }
  | { readonly kind: "call"; readonly part: Value; readonly at?: Place; readonly ahead: boolean; readonly function: Value }
  | { readonly kind: "claim"; readonly part: Value; readonly at?: Place; readonly ahead: boolean; readonly outcome: Outcome | "waiting" }
  | { readonly kind: "effect"; readonly part: Value; readonly at?: Place; readonly ahead: false; readonly capability: string; readonly operation: string }
  | { readonly kind: "refuted"; readonly part: Value; readonly at?: Place; readonly ahead: boolean; readonly reason: string };

/** What `Kernel.keyOf` reads of a key. */
export interface KeyDescription {
  /** The identity of the module the key was made with. */
  readonly module: string;
  /** Which of that module's keys it is, from 0. */
  readonly slot: number;
}

/**
 * The kernel, as host code sees it.
 *
 * Whoever holds this object is trusted as the launcher is. It restores
 * an outcome under any builder's name, takes the inspection right and
 * reads any function's body. So it is not handed to host code a
 * launcher does not trust, such as a plug-in of an application that
 * embeds a kernel. Allegro code never holds it: what Allegro code may
 * do of this, it does through a capability the launcher makes, as
 * narrow as the launcher chooses (restore under one builder's name,
 * for one).
 */
export interface Kernel {
  readonly interfaceVersion: typeof INTERFACE_VERSION;
  /** The hash that identifies this kernel variant. */
  readonly variant: string;

  // ---- Constructing values -------------------------------------------

  /**
   * A sequence of bits. `bitLength` defaults to eight times the byte count.
   * Where it is not a multiple of eight, the bits are the last `bitLength`
   * bits of the bytes, and the bits before them are ignored: the truth
   * value true is the byte 1 with `bitLength` 1.
   */
  bits(bytes: Uint8Array, bitLength?: number): Value;
  /**
   * The symbol with this spelling. The same spelling gives the same
   * symbol; a fully-qualified name is a spelling, and the kernel reads
   * nothing into it. In an expression the symbol is a name and is looked
   * up. As the key of a structure's entry it names the entry and is not
   * evaluated. For a symbol as data, see `symbolData`.
   */
  symbol(fqn: string): Value;
  /** A new positional parameter. Its name is for reports; a function owns it by listing it. */
  param(name: string): Value;
  /**
   * A structure. Complete in shape; an entry's value may be a cell. An
   * entry's key is null, a symbol made with `symbol`, or a key.
   */
  structure(entries: readonly Entry[], at?: Place): Value;
  /** An unevaluated application of a function value to arguments. */
  expression(fn: Value, args: readonly Value[], at?: Place): Value;
  /** A composed function: parameters and a body. */
  composedFunction(params: readonly Value[], body: Value, at?: Place): Value;
  /**
   * A primitive function. An effectful one is authority: whoever is
   * handed the value can use it. A pure one is available to all code: a
   * description that names its hash is built into it. Its hash and its
   * purity are the caller's statement; the kernel verifies neither.
   */
  primitiveFunction(declaration: PrimitiveDeclaration): Value;
  /**
   * One of the kernel's own primitives, by name. The names are Part II's
   * and are listed by `kernelPrimitiveNames`; an unknown name is an
   * InterfaceError.
   */
  kernelPrimitive(name: string): Value;
  kernelPrimitiveNames(): readonly string[];

  // ---- Cells ----------------------------------------------------------

  /** A new, unfilled cell. */
  cell(): Cell;
  /**
   * Fills a cell with plain data: bits, symbols and structures of them,
   * carrying no metadata. Once only.
   *
   * It then takes up what waited on the cell, as `advance` does and with
   * the same slice, and returns what `advance` returns: a refutation the
   * answer leads to, and its claim records, come back from the call that
   * brought the answer.
   *
   * With `hold: true` it records the value and evaluates nothing: what
   * waited on the cell is taken up by the next `advance`, or by the next
   * `fill` that does not hold, after what waited on cells filled before
   * this one. That is for filling several cells before any is acted on.
   * It never changes what happens, only how much is done in one call.
   * What it returns then says that nothing was done.
   *
   * Either way the order of the calls to `fill` is the order in which
   * answers are acted on.
   *
   * Only the launcher fills. A capability's host code does not hold the
   * kernel: it returns a cell and hands the launcher the promise of its
   * answer, and the launcher fills the cell when the answer comes. So
   * every refutation and every claim record that an answer leads to
   * reaches the launcher, in one place.
   */
  fill(cell: Cell, value: Value, how?: Slice & { readonly hold?: boolean }): Advance;
  /** True when the cell has been filled. */
  filled(cell: Cell): boolean;
  /**
   * The unfilled cells that something in this kernel still waits on.
   * Empty when nothing is outstanding. The kernel knows every waiter,
   * whoever built it; the host need not.
   */
  waiting(): readonly Cell[];

  /**
   * The unfilled cells that are kept: no task waits for them now, and a
   * value with a name, or an entry of a structure, still holds their
   * answer and may be read. That happens where such a value lost in
   * `first`. A launcher does not abort the operation behind a kept cell
   * while its run goes on, and does not wait for one: a run is over when
   * nothing is waited for. A cell leaves this list when its answer comes,
   * when something comes to wait for it, or when nothing can reach the
   * value any more; when that last happens is the host's to say, and
   * nothing a program does depends on it. The reference kernel keeps
   * nothing of an argument that lost, and gives none.
   */
  kept(): readonly Cell[];

  // ---- Evaluating -----------------------------------------------------

  /**
   * Evaluates an expression, as far as the information allows and within
   * the limits. A budget given here is the evaluation's: what `advance`
   * and `fill` later do for this evaluation counts against what is left of
   * it.
   */
  evaluate(expression: Value, limits?: Limits): Result;
  /**
   * Evaluates an expression as a check does, so that every claim in it is
   * reached. Nothing is performed and nothing waits: a call on a
   * capability stays in what is left, and an unfilled cell is one more
   * unknown. Both branches of a conditional whose condition is unknown
   * are evaluated. Then everything the evaluation left untouched is
   * evaluated too, with what it needs unknown: a binding nothing read, an
   * argument nothing needed, an entry nothing read, and the body of every
   * function met, called or not. A function is opened once.
   *
   * `value` is what is left of the expression. `claims` has a record for
   * every claim reached: decided, refuted, or waiting. `refutations` has
   * what else was found refuted. `refuted` is true only where the whole
   * is refuted whatever is unknown. A check is given a budget, since a
   * recursion whose argument changes runs to it; a spent budget ends the
   * check at "limit", with the records so far.
   */
  check(expression: Value, limits?: Limits): Result;
  /**
   * Takes up every evaluation in this kernel that waited on a cell filled
   * since the last call, within the limits. The kernel knows which
   * evaluations wait on which cells; the host says when the work happens
   * and how much of it. An evaluation that waits on none of the cells
   * filled is left alone. With nothing ready it does nothing.
   *
   * Evaluations are taken up in the order their cells were filled, each
   * once. Several cells may be filled before one call: the effects are
   * then the same, in the same order, as with a call after each fill. An
   * evaluation is the one a call of `evaluate` left waiting, or work
   * that an `also` left going after its value was given.
   *
   * Where a slice pauses the call, the next call goes on with what was
   * paused, and then with the rest.
   *
   * Once an evaluation comes out refuted, the call performs no further
   * effect: the evaluations still to be taken up stay for a later call. A
   * launcher that ends its phase at a refutation does not call again; one
   * that goes on calls again, and what was held is done. The reference
   * kernel also evaluates what is held ahead, and reports a refutation
   * it finds there in the same call.
   *
   * The reference kernel takes up a whole evaluation, walked again from
   * its top, so it counts again steps already counted. The variant that
   * keeps its own stack takes a computation up at the point where it
   * stopped.
   */
  advance(limits?: Slice): Advance;
  /**
   * The value as it now stands: where a residual has since been
   * evaluated further, the result of that; otherwise the value itself.
   */
  current(value: Value): Value;

  // ---- Reading --------------------------------------------------------

  kind(value: Value): Kind;
  /**
   * The bits of a bits value. `bitLength` is known at once. Reading
   * `bytes` lays out a value made by joining, which is counted against
   * the evaluation that made it, and throws `LimitFailure` where that
   * evaluation's budget does not cover it.
   */
  bitsOf(value: Value): { readonly bytes: Uint8Array; readonly bitLength: number };
  symbolName(value: Value): string;
  paramName(value: Value): string;
  entriesOf(value: Value): readonly Entry[];
  expressionOf(value: Value): { readonly fn: Value; readonly args: readonly Value[] };
  composedFunctionOf(value: Value): { readonly params: readonly Value[]; readonly body: Value };
  /** The declaration a primitive function was made from, without its `run`. */
  primitiveFunctionOf(value: Value): Omit<PrimitiveDeclaration, "run">;
  /** The metadata fields a value carries, by the symbol each was registered under. Read-only. */
  fieldsOf(value: Value): readonly Value[];
  /** One field's value, or undefined where the value does not carry it. Read-only: no call writes a field. */
  field(value: Value, field: Value): Value | undefined;
  /** The kernel's record of a claim's outcome on this value, where there is one. */
  outcomeOf(value: Value): Outcome | undefined;
  /**
   * Has the kernel tell a host what it does: one call of `observer` for
   * each thing, as it happens. One observer at a time; `undefined` stops
   * it. It is for diagnostics that leave the program as it is: which
   * branches a run took, a trace, what a check reached. The observer is
   * host code and is trusted as the holder of this object is. It may
   * read values with the calls of this interface that only read. It may
   * not evaluate, advance or fill from inside the call. Allegro code
   * never sees this.
   */
  observe(observer: ((seen: Observed) => void) | undefined): void;
  /**
   * Where a part was written, where whoever made it said: an application,
   * a function or a structure written in a text. A copy keeps it, and so
   * does what an evaluation leaves of the part.
   */
  placeOf(value: Value): Place | undefined;
  /** The expression this value came from, where the kernel kept one. */
  originOf(value: Value): Value | undefined;
  /**
   * A symbol as data. Evaluating it gives the symbol itself, where the
   * value `symbol` makes is a name and is looked up. It is what a
   * notation's symbol literal stands for.
   */
  symbolData(fqn: string): Value;

  // ---- Modules and keys -----------------------------------------------

  /**
   * Makes a module from a composed function. The function's first `keys`
   * parameters are its key slots; the rest are what the module declares:
   * capabilities, inputs, other modules.
   *
   * The kernel derives the module's identity from the function's content
   * and makes one key for each slot from that identity. A key is a
   * structure that the kernel marks: its entries say which module and
   * which slot, and anyone can build a structure with the same entries,
   * but only the kernel can mark one, and the mark is never carried onto
   * another value. So a key is told from a lookalike by `isKey`, never
   * by its content. It returns the
   * module function: a composed function of the remaining parameters,
   * with the keys in place. The same content gives the same identity and
   * the same keys in every kernel; no other content gives them.
   *
   * The function must be closed: an InterfaceError where it holds a
   * cell, a parameter of no function in it, an effectful primitive, or
   * anything else that has no content to hash.
   *
   * `declares` says what each parameter after the key slots is, in
   * order, and is part of the content. Calling the module function
   * instantiates it, and is done with one argument for each capability
   * and input, in their order. Nobody passes an import: the kernel
   * supplies the module made under the identity declared, and a module
   * that imports one not made in this kernel is refuted when called.
   * Inside its body an import is the imported module's function, which
   * the body calls to instantiate it. Two calls of a module function
   * with the same arguments give one instance: its statements happen
   * once.
   */
  module(fn: Value, keys: number, declares?: readonly Declaration[]): Value;
  /** The identity of the module a module function was made as, or undefined for any other value. */
  moduleOf(value: Value): string | undefined;
  /**
   * The inspection right: the authority to describe any function,
   * whichever module made it. A key that no module's content gives. The
   * host hands it to the code a configuration trusts to inspect, such as
   * an analysis or an optimiser; code that is not handed it can describe
   * only the functions of a module whose key it holds.
   */
  inspectionRight(): Value;
  /**
   * Withdraws an assumption: from then on it is not taken on trust. The
   * kernel evaluates what was assumed as a claim, which comes out
   * decided, refuted or undecided like any other and is listed among a
   * result's claims. `what` is one assumption as written (the `at` of
   * what a result rests on), or the identity of a module, for every
   * assumption its code makes. A launcher calls this for what its
   * configuration does not accept. It does not reach back: a result
   * already given keeps the word it was given with.
   */
  withdraw(what: Value | string): void;
  /** True for a key: a structure carrying the kernel's mark. False for a structure with the same entries and no mark. */
  isKey(value: Value): boolean;
  /** Reads a key. An InterfaceError for a value that is not one. */
  keyOf(value: Value): KeyDescription;

  // ---- What a result rests on -------------------------------------------

  /**
   * What the kernel's record of a claim's outcome on this value rests
   * on. Empty where the value carries no outcome.
   */
  restsOn(value: Value): readonly Rest[];
  /** Why a refutation was recorded on this value, in a sentence, or undefined where none was. */
  reasonOf(value: Value): string | undefined;

  // ---- Restore ------------------------------------------------------------

  /**
   * The key of a claim's outcome: a hash the kernel computes from the
   * claim's content, the content of the function it sits in, and what
   * the outcome rests on. `within` is that function, as built and before
   * `module` is applied to it; `claim` is an application of the kernel's
   * claim primitive somewhere inside it. A builder stores the key beside
   * the outcome. The same claim in the same function, resting on the
   * same things, has the same key in every kernel; any change to one of
   * the three changes it. An InterfaceError where `claim` is not inside
   * `within`.
   */
  claimKey(claim: Value, within: Value, restsOn: readonly Rest[], declares?: readonly Declaration[]): string;
  /**
   * Records that a claim was decided by the kernel of whoever built the
   * saved program it came from. The kernel computes the claim's key
   * itself, as `claimKey` does, and refuses with an InterfaceError
   * unless it equals `key`: a stored outcome cannot be attached to
   * another claim, to the claim in another function, or to other
   * grounds. When evaluation reaches the claim it is not evaluated
   * again: its outcome is "decided", resting on the builder named here
   * and on what `restsOn` lists.
   *
   * The only call that records an outcome the kernel did not itself
   * reach, and it cannot record one without a builder's name. An
   * InterfaceError also where `claim` is not such an application, or
   * where `restsOn` names a capability: an outcome that rests on a
   * capability's answer is never stored.
   */
  restore(claim: Value, within: Value, builder: string, restsOn: readonly Rest[], key: string, declares?: readonly Declaration[]): void;

  // ---- Cells --------------------------------------------------------------

  /** True for a cell, filled or not. */
  isCell(value: Value): boolean;
}

/** How a host obtains a kernel. Creating one performs nothing else. */
export type CreateKernel = () => Kernel;


