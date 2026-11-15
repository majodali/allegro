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
//   "A value that arrives later fills a cell"
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

/** A limit on one evaluation. A budget of steps is deterministic; a limit by the clock is the launcher's business. */
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
 *   "undecided" it still waits;
 *   "refuted"   it was evaluated and is not true.
 * The first version of a kernel records "decided", "refuted" and
 * "undecided" only.
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
  | { readonly kind: "builder"; readonly builder: string };

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

/** The kernel, as host code sees it. */
export interface Kernel {
  readonly interfaceVersion: typeof INTERFACE_VERSION;
  /** The hash that identifies this kernel variant. */
  readonly variant: string;

  // ---- Constructing values -------------------------------------------

  /** A sequence of bits. `bitLength` defaults to eight times the byte count. */
  bits(bytes: Uint8Array, bitLength?: number): Value;
  /** The symbol with this fully-qualified name. The same name gives the same symbol. */
  symbol(fqn: string): Value;
  /** A new positional parameter. Its name is for reports; a function owns it by listing it. */
  param(name: string): Value;
  /** A structure. Complete in shape; an entry's value may be a cell. */
  structure(entries: readonly Entry[]): Value;
  /** An unevaluated application of a function value to arguments. */
  expression(fn: Value, args: readonly Value[]): Value;
  /** A composed function: parameters and a body. */
  composedFunction(params: readonly Value[], body: Value): Value;
  /** A primitive function. An effectful one is authority: whoever is handed the value can use it. */
  primitiveFunction(declaration: PrimitiveDeclaration): Value;
  /**
   * One of the kernel's own primitives, by name. The names are Part II's
   * and are listed by `kernelPrimitiveNames`; an unknown name is an
   * InterfaceError.
   */
  kernelPrimitive(name: string): Value;
  kernelPrimitiveNames(): readonly string[];

  // ---- Scopes ---------------------------------------------------------

  /** A new scope: a child of `parent`, or, with no parent, one that shares nothing with any other. */
  scope(parent?: Scope): Scope;
  /** Binds a symbol in a scope. Binding a symbol twice in one scope is an InterfaceError. */
  bind(scope: Scope, symbol: Value, value: Value): void;

  // ---- Cells ----------------------------------------------------------

  /** A new, unfilled cell. */
  cell(): Cell;
  /**
   * Fills a cell with plain data: bits, symbols and structures of them,
   * carrying no metadata. Once only. Filling records the value and
   * evaluates nothing: what waited on the cell is evaluated again by the
   * next `advance`.
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
   * Evaluates again everything in this kernel that waited on a cell
   * filled since the last call, and whatever waited on that in turn,
   * within the limits. The kernel tracks what waits on what; the host
   * says when the work happens and how much of it. Several cells may be
   * filled before one call: each waiter is then evaluated once, after
   * all it depends on. With nothing ready it does nothing.
   *
   * The order in which effects that became ready are performed is not
   * stated in this version; it waits on a ruling (issue 17 of
   * docs/records/book-pass/adversarial-review.md).
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
   */
  module(fn: Value, keys: number): Value;
  /** The identity of the module a module function was made as, or undefined for any other value. */
  moduleOf(value: Value): string | undefined;
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
   * Records that a claim was decided by the kernel of whoever built the
   * saved program it came from. `claim` is the application of the
   * kernel's claim primitive, as loaded and before anything was
   * evaluated. When evaluation reaches it, it is not evaluated again:
   * its outcome is "decided", resting on the builder named here and on
   * what `restsOn` lists.
   *
   * The only call that records an outcome the kernel did not itself
   * reach, and it cannot record one without a builder's name. An
   * InterfaceError where `claim` is not such an application, or where
   * `restsOn` names a capability: an outcome that rests on a
   * capability's answer is never stored.
   */
  restore(claim: Value, builder: string, restsOn: readonly Rest[]): void;

  // ---- Cells --------------------------------------------------------------

  /** True for a cell, filled or not, and for a name that waits to be bound. */
  isCell(value: Value): boolean;
}

/** How a host obtains a kernel. Creating one performs nothing else. */
export type CreateKernel = () => Kernel;
/** How a host obtains a kernel of the second version. */
export type CreateKernel2 = () => Kernel2;
