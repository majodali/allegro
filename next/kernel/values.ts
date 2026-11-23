// The representation both kernel variants share: the classes a value of
// the kernel is an instance of, and the records an evaluation keeps.
//
// Whose: the kernel stream (lane R). Taken out of next/kernel/kernel.ts on
// 2026-11-20 with no change (docs/plans/book-pass.md section 9).

import type { Declaration, Place, PrimitiveDeclaration, Rest } from "./interface.js";

// ---- The representation --------------------------------------------------

/**
 * A bits value. It never changes, so two may share their bytes: a part
 * taken from one is a view of it, and two joined are kept as the two
 * until something reads the bytes, when they are laid out once.
 */
export class Bits {
  private flat: Uint8Array | undefined;
  /** For two values joined and not yet laid out: the two. Both are whole bytes. */
  private parts: readonly [Bits, Bits] | undefined = undefined;
  /** Called before a joined value is laid out, with its length: the work is charged where it is done. */
  private charge: ((bits: number) => void) | undefined = undefined;
  constructor(bytes: Uint8Array, readonly bitLength: number) {
    this.flat = bytes;
  }
  /** Two values of whole bytes, joined. Nothing is copied until the bytes are read. */
  static joined(a: Bits, b: Bits, charge: (bits: number) => void): Bits {
    const r = new Bits(NO_BYTES, a.bitLength + b.bitLength);
    r.flat = undefined;
    r.parts = [a, b];
    r.charge = charge;
    return r;
  }
  /** True where the bytes are laid out, so reading them does no work. */
  get laidOut(): boolean {
    return this.flat !== undefined;
  }
  /** True where the value is whole bytes, so it can be handled a byte at a time. */
  get whole(): boolean {
    return this.flat === undefined || this.bitLength === this.flat.length * 8;
  }
  get bytes(): Uint8Array {
    if (this.flat !== undefined) return this.flat;
    this.charge?.(this.bitLength);
    const out = new Uint8Array(this.bitLength / 8);
    // Left to right, with a list of what is still to lay out: a long chain of joins is no deep recursion.
    const todo: Bits[] = [this];
    let at = 0;
    while (todo.length > 0) {
      const b = todo.pop() as Bits;
      if (b.flat !== undefined) {
        out.set(b.flat, at);
        at += b.flat.length;
      } else {
        const [left, right] = b.parts as readonly [Bits, Bits];
        todo.push(right, left);
      }
    }
    this.flat = out;
    this.parts = undefined;
    this.charge = undefined;
    return out;
  }
}
const NO_BYTES = new Uint8Array(0);
export class Sym {
  constructor(readonly fqn: string) {}
}
export class Param {
  constructor(readonly name: string) {}
}
/** Where a part of an expression was written: the module, and the function of it the part sits in. */
export interface Mark {
  readonly module: string;
  readonly fn: Fn | undefined;
}
/**
 * A structure. It never changes, so two may share their entries: one
 * made by putting an entry at the end of another holds the same list,
 * and says how many of its entries are its own.
 */
export class Struct {
  /** Written by the kernel when a module is made or a function is built, and kept by every copy. */
  owner: Mark | undefined = undefined;
  /** Where it was written, where whoever made it said. Kept by every copy. */
  at: Place | undefined = undefined;
  private own: ReadonlyArray<readonly [V | null, V]> | undefined;
  /** For a structure that shares its entries: the list, which may go on past its own, and how many are its own. */
  shared: { readonly items: (readonly [V | null, V])[]; readonly length: number } | undefined = undefined;
  constructor(entries: ReadonlyArray<readonly [V | null, V]>) {
    this.own = entries;
  }
  /** The first `length` entries of a list that other structures may share. */
  static sharing(items: (readonly [V | null, V])[], length: number): Struct {
    const s = new Struct(NO_ENTRIES);
    s.own = undefined;
    s.shared = { items, length };
    return s;
  }
  /** The entries, as a list of their own. For a structure that shares, this copies them, once. */
  get entries(): ReadonlyArray<readonly [V | null, V]> {
    return (this.own ??= (this.shared as NonNullable<Struct["shared"]>).items.slice(0, (this.shared as NonNullable<Struct["shared"]>).length));
  }
}
const NO_ENTRIES: ReadonlyArray<readonly [V | null, V]> = [];
export class Expr {
  owner: Mark | undefined = undefined;
  /** For what is left of a claim: the claim as it was written. */
  site: Expr | undefined = undefined;
  /** Where it was written, where whoever made it said. Kept by every copy and by what an evaluation leaves of it. */
  at: Place | undefined = undefined;
  constructor(readonly fn: V, readonly args: readonly V[]) {}
}
export class Fn {
  owner: Mark | undefined = undefined;
  /** Where it was written, where whoever made it said. Kept by every copy. */
  at: Place | undefined = undefined;
  constructor(readonly params: readonly Param[], readonly body: V) {}
}
export class Prim {
  constructor(readonly declaration: PrimitiveDeclaration) {}
}
export class KernelPrim {
  constructor(readonly name: string, readonly arity: number) {}
}
/** A missing value, filled once. `source` is the capability whose answer it will hold, where one made it. */
export class CellV {
  filled = false;
  value: V | undefined;
  constructor(readonly source: Rest | undefined) {}
}
/**
 * A key: made with its module, from the module's identity. It reads as
 * a structure of two entries, the module's identity and the slot. The
 * kernel's mark is that it is of this class: until metadata fields are
 * built, that is how the reference kernel tells a key from a structure
 * with the same entries.
 */
export class Key {
  constructor(readonly module: string, readonly slot: number) {}
}
/** A name tied to the scope it is looked up from. Unbound, it is a residual that waits on the name. */
export class NameRef {
  constructor(readonly scope: ScopeV, readonly sym: Sym) {}
}
/** A value that is data and is not to be evaluated: a symbol in a description, from a cell or from a primitive function. */
export class Quoted {
  constructor(readonly inner: V) {}
}
/** A value with the kernel's record of a claim's outcome on it. */
/** A value with the outcome of a claim on it: decided, assumed, or undecided with the reason nothing could tell. */
export class Decided {
  constructor(readonly inner: V, readonly rests: readonly Rest[], readonly outcome: "decided" | "sampled" | "assumed" | "undecided" = "decided", readonly reason?: string) {}
}
/**
 * An argument that has not been needed yet: an expression, the scope it
 * was written in, and, once it has been needed, its value. It is shared
 * by every use of the parameter, so it is evaluated at most once.
 */
export class Lazy {
  done = false;
  /** True while it is being evaluated: needing it again then means it needs itself. */
  busy = false;
  rests: readonly Rest[] = [];
  constructor(public value: V, readonly scope: ScopeV) {}
}
/** A refutation. Whatever is computed from it is it. */
export class Refuted {
  constructor(readonly reason: string, readonly about: V | undefined) {}
}

export type V = Bits | Sym | Param | Struct | Expr | Fn | Prim | KernelPrim | CellV | NameRef | Quoted | Decided | Refuted | Key | Lazy;

export interface Binding {
  readonly value: V;
  memo: V | undefined;
  /** What evaluating the binding rested on, kept with its value. */
  rests: readonly Rest[];
}
export class ScopeV {
  readonly bindings = new Map<Sym, Binding>();
  constructor(readonly parent: ScopeV | undefined) {}
}

/** Thrown inside one evaluation when its budget runs out. Never leaves the kernel. */
export class LimitReached extends Error {}

export interface Root {
  readonly scope: ScopeV;
  value: V;
  done: boolean;
  /** The unfilled cells it waits on, as they stood when it was last evaluated. */
  waits: Set<unknown>;
  /** True while it stands in the list of what `advance` is to take up. */
  queued: boolean;
  /** The sequences whose first part started it: each waits for it to be over. */
  groups: readonly Group[];
  /** True where what it holds includes a sequence that waits for work its first part started. */
  grouped: boolean;
  /** The budget of the evaluation it belongs to. */
  readonly account: Account;
}

/** The budget of one evaluation: all its work counts against it, in whichever call it is done. */
export interface Account {
  left: number;
  /** True once the budget is spent: the evaluation is over, and what it had waiting is dropped. */
  dead: boolean;
  /** What `evaluate` gave as the evaluation's value. */
  handle: V | undefined;
}

/** What the first part of one `then` started and left going. The `then` waits until none is left. */
export interface Group {
  readonly pending: Set<Root>;
  /** The first refutation any of that work came to. */
  refuted: Refuted | undefined;
}

export const KERNEL_PRIMITIVES: ReadonlyArray<readonly [string, number]> = [
  ["also", 2], ["assume", 1], ["attempt", 2], ["block", 2], ["build", 2], ["claim", 1], ["count", 1], ["describe", 2], ["first", 2], ["get", 2], ["if", 3],
  ["join", 2], ["key", 2], ["kind", 1], ["length", 1], ["put", 3], ["refuse", 1], ["same", 2], ["sample", 2], ["slice", 3], ["specialize", 2], ["spelling", 1],
  ["symbol", 1], ["then", 2], ["undecided", 1],
];
/** The module name under which the kernel makes the inspection right. No content hashes to it. */
export const INSPECT = "kernel:inspect";

