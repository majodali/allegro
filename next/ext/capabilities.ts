// The two capabilities the module loader is handed.
//
// Whose: the kernel stream (lane R). Chunk E9 of docs/plans/book-pass.md
// section 10. Decision: "The loader reaches files through a capability".
// The loader is next/ext/lib/loader.alg; it declares `files` and
// `modules`, acquires neither, and performs no other effect.
//
//   files.read(name)                      the text of a file, as bits; or
//                                         {failure: `absent} where there is
//                                         none; or {failure: `refused,
//                                         reason} where it may not be read
//   modules.make(function, keys, declares)
//                                         the module a function is, with
//                                         that many key slots; `declares`
//                                         is a text, one line for each
//                                         parameter after the keys: its
//                                         role, its name, and for an
//                                         import its identity
//   modules.identity(module)              a module's identity, as text
//
// Making a module is an effect: the kernel then has it, and an import
// of its identity finds it. So it is a capability, and a program that is
// not handed it makes no module. A module's keys come from its content,
// so whoever makes a module of other content gets other keys.
//
// These are the parts as host code. The acceptance stream's launcher has
// the bounded reader of files (next/launch/files.ts) as a host function;
// `filesRead` takes any reader of that shape.

import type { ReadText } from "../bootstrap/driver.js";
import { InterfaceError, Refusal, type Declaration, type Kernel, type PrimitiveDeclaration, type Value } from "../kernel/interface.js";

const decoder = new TextDecoder("utf-8", { fatal: true });
const encoder = new TextEncoder();

/** The part `read` of `files`, over a reader of texts. */
export function filesRead(readText: ReadText): PrimitiveDeclaration {
  return {
    purity: "effectful",
    capability: "files",
    part: "read",
    arity: 1,
    run: (args, c) => {
      if (c.kind(args[0]) !== "bits") throw new Refusal("files.read takes the name of a file, as text");
      const read = readText(decoder.decode(c.bitsOf(args[0]).bytes));
      if (read === undefined) return c.structure([[c.symbol("failure"), c.symbol("absent")]]);
      if (typeof read !== "string") return c.structure([[c.symbol("failure"), c.symbol("refused")], [c.symbol("reason"), c.bits(encoder.encode(read.refused))]]);
      return c.bits(encoder.encode(read.replace(/\r\n/g, "\n")));
    },
  };
}

/** The parts `make` and `identity` of `modules`, for one kernel. */
export function modulesParts(kernel: Kernel): readonly PrimitiveDeclaration[] {
  const text = (v: Value, what: string): string => {
    if (kernel.kind(v) !== "bits") throw new Refusal(`${what} is a text`);
    return decoder.decode(kernel.bitsOf(v).bytes);
  };
  return [
    {
      purity: "effectful",
      capability: "modules",
      part: "make",
      arity: 3,
      run: (args) => {
        if (kernel.kind(args[0]) !== "composed-function") throw new Refusal("modules.make takes a function, as `build` gives one");
        if (kernel.kind(args[1]) !== "bits") throw new Refusal("modules.make takes the number of key slots");
        const keys = kernel.bitsOf(args[1]).bytes.reduce((n, b) => n * 256 + b, 0);
        const declares = text(args[2], "what a module declares")
          .split("\n")
          .filter((l) => l !== "")
          .map((l): Declaration => {
            const [role, name, identity] = l.split(" ");
            return (identity === undefined ? { role, name } : { role, name, identity }) as Declaration;
          });
        try {
          return kernel.module(args[0], keys, declares);
        } catch (x) {
          // What the kernel refuses to make a module of: a function that is not closed, declarations that fit none.
          if (x instanceof InterfaceError) throw new Refusal(x.message);
          throw x;
        }
      },
    },
    {
      purity: "effectful",
      capability: "modules",
      part: "identity",
      arity: 1,
      run: (args) => {
        const identity = kernel.moduleOf(args[0]);
        if (identity === undefined) throw new Refusal("modules.identity takes a module");
        return kernel.bits(encoder.encode(identity));
      },
    },
  ];
}
