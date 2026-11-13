// The kernel's interface, first version.
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
// What the first version leaves out, on purpose (the rulings of
// 2026-11-13, docs/records/book-pass/adversarial-review.md):
//   - restore: no call records a stored claim outcome. It returns with
//     the ruling on strength (issues 8 to 10 of that record).
//   - keys: no call makes an unforgeable value other than a primitive
//     function. It returns with the ruling on identity (issues 11, 12).
//   - the strength of an outcome and what it rests on: `Outcome` below
//     has the three states the kernel records today and nothing more.
// Each will be an addition; no call below is expected to change.
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
 * What the kernel recorded when an expression was evaluated as a claim.
 * First version: the three states only.
 */
export type Outcome = "decided" | "refuted" | "undecided";

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
export declare class KernelFault extends Error {
  readonly invariant: string;
}

/**
 * Thrown when the host misuses the interface: a value of another
 * kernel, a call on the wrong kind, a symbol bound twice in one scope,
 * a cell filled twice.
 */
export declare class InterfaceError extends Error {}

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

/** How a host obtains a kernel. Creating one performs nothing else. */
export type CreateKernel = () => Kernel;
