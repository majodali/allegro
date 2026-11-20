// The timer capability (B-196 (the rebuild's acceptance side), chunk Q7
// (the minimal launcher and the output capability), part 5,
// docs/plans/rebuild-acceptance.md §5).
//
// What it realises, from docs/plans/book-pass-inventory.md:
//   "A capability is a named set of effectful primitives"
//   "The terminal and the browser ship output, timers and HTTP": the
//    capability for waiting
//   "A late answer or its failure fills a cell as plain data"
//
// The names are this stream's proposal, for the maintainer to ratify: no
// decision names the capability for waiting, its parts or what a part
// answers. The capability is `timer`, and its one part is `wait`.
//
// `timer.wait(n)` takes a whole number of milliseconds, 64 bits as
// Allegretto writes a number (next/ext/allegretto/forms.md §2, "Values").
// It answers late: it returns a cell, and the launcher fills the cell
// (`CapabilityHost.later` of next/launch/launcher.ts) once `n`
// milliseconds have passed. The value it fills is `n` itself, the same 64
// bits, so a program can tell which wait ended.
//
// A value outside the part's domain is a refutation, as for any primitive
// function (next/ext/allegretto/forms.md §1): the part throws the
// kernel's `Refusal` (next/kernel/interface.ts) with the reason. Outside
// the domain are a value that is not bits, bits of another length than
// 64, and a negative number.
//
// Time is the target's. The capability is made with a clock
// (next/launch/clock.ts): the terminal passes the host's real timer, and
// the launcher's tests and the corpus runner pass the virtual clock,
// which runs no real time.
//
// Host-neutral: no process, no fs, no Buffer.

import { Refusal, type PrimitiveContext, type PrimitiveDeclaration, type Value } from "../kernel/interface.js";
import type { Clock } from "./clock.js";
import type { CapabilityDefinition, CapabilityHost, CapabilityImplementation, Plain } from "./launcher.js";

/** The timer capability: one part, which waits. */
export const TIMER: CapabilityDefinition = { name: "timer", parts: ["wait"] };

/** Reads a whole number of 64 bits that is not negative, as milliseconds; refuses anything else. */
export function millisecondsOf(value: Value, context: PrimitiveContext): { readonly ms: bigint; readonly bytes: Uint8Array } {
  if (context.kind(value) !== "bits") throw new Refusal(`timer.wait takes a whole number of 64 bits, not ${context.kind(value)}`);
  const { bytes, bitLength } = context.bitsOf(value);
  if (bitLength !== 64) throw new Refusal(`timer.wait takes a whole number of 64 bits; this value has ${bitLength} bits`);
  let ms = 0n;
  for (const b of bytes) ms = (ms << 8n) | BigInt(b);
  if (ms >= 2n ** 63n) throw new Refusal(`timer.wait takes a number of milliseconds that is not negative; this one is ${ms - 2n ** 64n}`);
  return { ms, bytes: Uint8Array.from(bytes) };
}

/** The part `wait` of `timer`, on `clock`: it returns a cell, and `later` is told what fills it. */
export function timerWait(clock: Clock, later: CapabilityHost["later"]): PrimitiveDeclaration {
  return {
    purity: "effectful",
    capability: TIMER.name,
    part: "wait",
    arity: 1,
    run: (args, context) => {
      const { ms, bytes } = millisecondsOf(args[0], context);
      const cell = context.cell();
      const answer: Plain = { bits: bytes, bitLength: 64 };
      later(cell, new Promise<Plain>((resolve) => clock(ms, () => resolve(answer))));
      return cell;
    },
  };
}

/** The timer capability as a target supplies it, on `clock`. */
export function timer(clock: Clock): CapabilityImplementation {
  return { definition: TIMER, create: (host) => [timerWait(clock, (cell, answer) => host.later(cell, answer))] };
}
