// The output capability (B-196 (the rebuild's acceptance side), chunk Q7
// (the minimal launcher), docs/plans/rebuild-acceptance.md §5).
//
// What it realises, from docs/plans/book-pass-inventory.md:
//   "A capability is a named set of effectful primitives"
//   "The terminal and the browser ship output, timers and HTTP"
//
// The definition is data: the capability's name and its parts, by the
// names a saved program's `declares` uses. The decision defines a
// capability in Allegro; no Allegro code runs yet, so the definition is
// held here as host data until it can be written in Allegro.
//
// The names. The capability is `output`, from "supply capabilities for
// writing output" and the use case "a logging module declares output".
// Its one part is `write`, from the same "writing output". The test of
// the data form, next/kernel/saved-program.test.ts, already declares a
// capability by the name `output`.
//
// The implementation is one effectful primitive function. It takes one
// argument, bits read as UTF-8 text, and appends that text as one line to
// a sink. The sink is a function: a test or a runner collects the lines,
// and the terminal entry writes them. It answers with an empty structure.
//
// Host-neutral: TextDecoder, never Buffer.

import type { PrimitiveDeclaration, PrimitiveContext, Value } from "../kernel/interface.js";
import type { CapabilityDefinition, CapabilityImplementation } from "./launcher.js";

/** The output capability: one part, which writes one line. */
export const OUTPUT: CapabilityDefinition = { name: "output", parts: ["write"] };

/** Where the lines go. */
export type Sink = (line: string) => void;

const decoder = new TextDecoder("utf-8", { fatal: true });

/** Reads a bits value as UTF-8 text; throws on anything else. */
export function textOf(value: Value, context: PrimitiveContext): string {
  if (context.kind(value) !== "bits") throw new Error(`output.write takes bits read as UTF-8 text, not ${context.kind(value)}`);
  const { bytes, bitLength } = context.bitsOf(value);
  if (bitLength % 8 !== 0) throw new Error(`output.write takes whole bytes; this value has ${bitLength} bits`);
  return decoder.decode(bytes);
}

/** The part `write` of `output`, writing to `sink`. */
export function outputWrite(sink: Sink): PrimitiveDeclaration {
  return {
    purity: "effectful",
    capability: OUTPUT.name,
    part: "write",
    arity: 1,
    run: (args, context) => {
      sink(textOf(args[0], context));
      return context.structure([]);
    },
  };
}

/** The output capability as a target supplies it: its part writes to the run's lines. */
export const output: CapabilityImplementation = {
  definition: OUTPUT,
  create: (host) => [outputWrite((line) => host.line(line))],
};
