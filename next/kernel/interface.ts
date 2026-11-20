// The kernel's interface, first and second versions.
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
// Two versions are stated here. `Kernel` is the first: what a launcher
// needs to run a program. `Kernel2` adds what the rulings of 2026-11-15
// on identity and on strength made possible
// (docs/records/book-pass/adversarial-review.md, issues 8 to 12):
//   - modules and their keys: `module`, `keyOf`, `moduleOf`;
//   - what a result rests on, beside how strongly it holds: `restsOn`;
//   - restore: a stored outcome recorded under its builder's name;
//   - three calls the first version lacked: `isCell`, `reasonOf`, and
//     real classes for the two errors.
// The two are kept apart so that code written against the first keeps
// compiling. They become one interface when nothing implements only the
// first.
//
// The kernel is passive. Creating one does nothing but create it. It
// reads no file, no text, no environment and no clock. Every effect a
// program has reaches the outside through a primitive function that the
// host supplied.

/** The version of this interface. A kernel states the one it implements. */
export const INTERFACE_VERSION = 1;

// Brands. Each is a type-level marker with no run-time existence: it
// keeps the three handle types apart for the compiler, so a scope cannot
// be passed where a value is wanted. A kernel implements the handles as
// it likes; no property of these names exists on them.
declare const valueBrand: unique symbol;
declare const scopeBrand: unique symbol;
declare const cellBrand: unique symbol;

/**
 * A value in a kernel. Opaque to the host: it is read only through the
 * kernel that made it, and belongs to that kernel alone.
 */
export interface Value {
  readonly [valueBrand]: true;
}

/** A scope in a kernel. Opaque. Inside Allegro the environment is not a value; this handle is the host's only. */
export interface Scope {
  readonly [scopeBrand]: true;
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
 */
export interface Limits {
  /** The evaluation ends, with everything unfinished undecided, after this many steps. */
  readonly steps?: number;
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
  | { readonly kind: "kernel"; readonly variant: string }
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
   */
  readonly ended: "complete" | "limit";
  /** The number of steps spent. */
  readonly steps: number;
  /** True when a refutation is recorded on `value`: the program is wrong. */
  readonly refuted: boolean;
  /** The claims this call evaluated: one record for each claim as written. */
  readonly claims: readonly ClaimRecord[];
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
  /** Evaluations that came out decided, a restored outcome among them. */
  readonly decided: number;
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
   * "limit": the budget ran out first; call `advance` again to go on.
   */
  readonly ended: "complete" | "limit";
  /** The number of steps spent. */
  readonly steps: number;
  /** The values on which a refutation was recorded during this call. */
  readonly refuted: readonly Value[];
  /** The claims this call evaluated: one record for each claim as written. */
  readonly claims: readonly ClaimRecord[];
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
   * evaluated. For a symbol as data, see `Kernel2.symbolData`.
   */
  symbol(fqn: string): Value;
  /** A new positional parameter. Its name is for reports; a function owns it by listing it. */
  param(name: string): Value;
  /**
   * A structure. Complete in shape; an entry's value may be a cell. An
   * entry's key is null, a symbol made with `symbol`, or a key.
   */
  structure(entries: readonly Entry[]): Value;
  /** An unevaluated application of a function value to arguments. */
  expression(fn: Value, args: readonly Value[]): Value;
  /** A composed function: parameters and a body. */
  composedFunction(params: readonly Value[], body: Value): Value;
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

  // ---- Scopes ---------------------------------------------------------

  /**
   * A token `evaluate` takes and ignores. It holds nothing and nothing can
   * be put in it: a name means the binding of the innermost block that
   * binds it, and a host gives a program a value by passing it as an
   * argument, or by building a block that binds a name to it. This call and
   * `evaluate`'s scope argument go when the interface's two versions are
   * made one.
   */
  scope(parent?: Scope): Scope;

  // ---- Cells ----------------------------------------------------------

  /** A new, unfilled cell. */
  cell(): Cell;
  /**
   * Fills a cell with plain data: bits, symbols and structures of them,
   * carrying no metadata. Once only. Filling records the value and
   * evaluates nothing: what waited on the cell is taken up by the next
   * `advance`, after what waited on cells filled before this one. So the
   * order of the calls to `fill` is the order in which answers are acted
   * on.
   *
   * Only the launcher fills. A capability's host code does not hold the
   * kernel: it returns a cell and hands the launcher the promise of its
   * answer, and the launcher fills the cell when the answer comes. So
   * every refutation and every claim record that an answer leads to
   * reaches the launcher, in one place.
   */
  fill(cell: Cell, value: Value): void;
  /** True when the cell has been filled. */
  filled(cell: Cell): boolean;
  /**
   * The unfilled cells that something in this kernel still waits on.
   * Empty when nothing is outstanding. The kernel knows every waiter,
   * whoever built it; the host need not.
   */
  waiting(): readonly Cell[];

  // ---- Evaluating -----------------------------------------------------

  /** Evaluates an expression in a scope, as far as the information allows and within the limits. */
  evaluate(expression: Value, scope: Scope, limits?: Limits): Result;
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
   * Where a limit stops the call, the next call goes on with what was
   * being taken up, and then with the rest.
   *
   * Once an evaluation comes out refuted, the call performs no further
   * effect: the evaluations still to be taken up are evaluated ahead, so
   * their refutations are reported in `refuted` too, and they stay for a
   * later call. A launcher that ends its phase at a refutation does not
   * call again; one that goes on calls again, and what was held is done.
   *
   * In this version what is taken up is a whole evaluation, walked again
   * from its top, so steps already spent on it are spent again. Taking
   * up the computation at the point where it stopped comes with the
   * evaluator that keeps its own stack.
   */
  advance(limits?: Limits): Advance;
  /**
   * The value as it now stands: where a residual has since been
   * evaluated further, the result of that; otherwise the value itself.
   */
  current(value: Value): Value;

  // ---- Reading --------------------------------------------------------

  kind(value: Value): Kind;
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
  /** The expression this value came from, where the kernel kept one. */
  originOf(value: Value): Value | undefined;
}

/** What `Kernel2.keyOf` reads of a key. */
export interface KeyDescription {
  /** The identity of the module the key was made with: `sha256:` and 64 hex digits. */
  readonly module: string;
  /** Which of that module's keys it is, from 0. */
  readonly slot: number;
}

/**
 * The second version: everything of `Kernel`, and modules, keys, what a
 * result rests on, and restore.
 */
export interface Kernel2 extends Kernel {
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
/** How a host obtains a kernel of the second version. */
export type CreateKernel2 = () => Kernel2;
