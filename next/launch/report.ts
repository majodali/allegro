// The check-output capability, first version (B-196 (the rebuild's
// acceptance side), chunk Q16 (the capabilities the launchers ship),
// part 3, docs/plans/rebuild-acceptance.md §5).
//
// What it realises, from docs/plans/book-pass-inventory.md:
//   "A capability is a named set of effectful primitives"
//
// It is the maintainer's check output, in the words of 2026-11-21 (the
// last entry of docs/plans/rebuild-acceptance.md §7): "a capability for
// check output to allow messaging, exit status and other integrations
// with external build tools". It is a check capability: under check it is
// supplied, and the module being checked may call it, as may the code
// that presents a result. The name, the parts and their shapes are this
// stream's proposal, for the maintainer to ratify. The maintainer expects
// to add test output and utility methods to it.
//
// The capability is `report`. It has two parts, `message` and `status`.
//
// Neither part gives a program anything. The maintainer's rule: "Check
// capabilities need to have no side effects and not provide any input
// values, so that skipping those methods have no effect on checking or
// running a program." So each part answers at once, with the empty
// structure, whatever it is given. Neither answers a failure, neither
// refuses a value, and neither answers late. A program reads nothing from
// a part, and leaving a call out changes nothing the program computes.
// That is why a value outside a part's expected shape is no refutation
// here, unlike `output.write` (next/launch/output.ts): a refutation would
// be something the program could see. Such a value is handed on as a note
// instead.
//
// `report.message(m)` hands a message to whatever ran the program. `m` is
// a structure with the entries `level`, one of the symbols `` `error ``,
// `` `warning `` and `` `note ``; `text`, a text; and optionally `file`, a
// text, and `line` and `column`, whole numbers of 64 bits. A text alone is
// a note with that text. Any other value is a note that says it was no
// message and names its kind (`kindNote`). No function reachable from
// next/launch/ shows a value as the corpus's `// yields:` lines do, so the
// note shows the kind only. A message does not set the status, whatever
// its level: a program that must fail refutes a claim.
//
// `report.status(n)` hands an exit status: `n` is a whole number of 64
// bits from 0 to 255. The highest status handed over in a launch stands,
// so the order of two statements that do not wait for each other cannot
// matter. A value that is no status counts as 255, and a note says so.
//
// A text is bits of whole bytes read as UTF-8; a whole number is 64 bits
// whose most significant bit is 0 (next/ext/allegretto/forms.md §2,
// "Values").
//
// Where messages and statuses go is the target's. The capability is made
// with a sink (`ReportSink`): a function for a message as host data and a
// function for a status. `collector` gives a sink that keeps the messages
// in order and the highest status, which the terminal's entry
// (next/launch/terminal.ts), the corpus runner and the tests use.
// `messageLine` writes a message as the one line build tools read.
//
// Host-neutral: no process, no fs, no Buffer. TextDecoder besides.

import type { PrimitiveContext, PrimitiveDeclaration, Value } from "../kernel/interface.js";
import type { CapabilityDefinition, CapabilityImplementation } from "./launcher.js";

/** The check-output capability: two parts, one for a message and one for a status. */
export const REPORT: CapabilityDefinition = { name: "report", parts: ["message", "status"] };

/** The levels of a message. */
export const LEVELS = ["error", "warning", "note"] as const;
export type Level = (typeof LEVELS)[number];

/** A message, as host data. `line` and `column` are present only where the program gave them. */
export interface ReportMessage {
  readonly level: Level;
  readonly text: string;
  readonly file?: string;
  readonly line?: bigint;
  readonly column?: bigint;
}

/** Where messages and statuses go. */
export interface ReportSink {
  message(m: ReportMessage): void;
  /** A status from 0 to 255, as the program handed it, or 255 for a value that is no status. */
  status(n: number): void;
}

/** The highest status a status may be, and the one a value that is no status counts as. */
export const HIGHEST_STATUS = 255;

const decoder = new TextDecoder("utf-8", { fatal: true });

/** A text, or undefined for any other value. */
function textOf(value: Value, context: PrimitiveContext): string | undefined {
  if (context.kind(value) !== "bits") return undefined;
  const { bytes, bitLength } = context.bitsOf(value);
  if (bitLength % 8 !== 0) return undefined;
  try {
    return decoder.decode(bytes);
  } catch {
    return undefined;
  }
}

/** A whole number of 64 bits, or undefined for any other value. */
function wholeOf(value: Value, context: PrimitiveContext): bigint | undefined {
  if (context.kind(value) !== "bits") return undefined;
  const { bytes, bitLength } = context.bitsOf(value);
  if (bitLength !== 64) return undefined;
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  return n >= 2n ** 63n ? undefined : n;
}

/** The note for a value a part was handed that is no message or no status: it names the value's kind. */
export function kindNote(part: "message" | "status", kind: string): ReportMessage {
  return part === "message"
    ? { level: "note", text: `report.message was handed no message: a value of kind ${kind}` }
    : { level: "note", text: `report.status was handed no status from 0 to 255: a value of kind ${kind}, which counts as 255` };
}

/** Reads a message from a part's argument: a message structure, or a text alone; undefined for any other value. */
export function messageOf(value: Value, context: PrimitiveContext): ReportMessage | undefined {
  const alone = textOf(value, context);
  if (alone !== undefined) return { level: "note", text: alone };
  if (context.kind(value) !== "structure") return undefined;
  const found = new Map<string, Value>();
  for (const [k, v] of context.entriesOf(value)) {
    if (k === null || context.kind(k) !== "symbol") return undefined;
    const name = context.symbolName(k);
    if (!["level", "text", "file", "line", "column"].includes(name) || found.has(name)) return undefined;
    found.set(name, v);
  }
  const level = found.get("level");
  const text = found.get("text");
  if (level === undefined || text === undefined || context.kind(level) !== "symbol") return undefined;
  const levelName = context.symbolName(level);
  if (!(LEVELS as readonly string[]).includes(levelName)) return undefined;
  const t = textOf(text, context);
  if (t === undefined) return undefined;
  const m: { -readonly [K in keyof ReportMessage]: ReportMessage[K] } = { level: levelName as Level, text: t };
  const file = found.get("file");
  if (file !== undefined) {
    const f = textOf(file, context);
    if (f === undefined) return undefined;
    m.file = f;
  }
  for (const place of ["line", "column"] as const) {
    const v = found.get(place);
    if (v === undefined) continue;
    const n = wholeOf(v, context);
    if (n === undefined) return undefined;
    m[place] = n;
  }
  return m;
}

/** Reads a status from a part's argument: a whole number from 0 to 255; undefined for any other value. */
export function statusOf(value: Value, context: PrimitiveContext): number | undefined {
  const n = wholeOf(value, context);
  return n === undefined || n > BigInt(HIGHEST_STATUS) ? undefined : Number(n);
}

/** The part `message` of `report`, handing to `sink`. It answers at once with the empty structure. */
export function reportMessage(sink: ReportSink): PrimitiveDeclaration {
  return {
    purity: "effectful",
    capability: REPORT.name,
    part: "message",
    arity: 1,
    run: (args, context) => {
      sink.message(messageOf(args[0], context) ?? kindNote("message", context.kind(args[0])));
      return context.structure([]);
    },
  };
}

/** The part `status` of `report`, handing to `sink`. It answers at once with the empty structure. */
export function reportStatus(sink: ReportSink): PrimitiveDeclaration {
  return {
    purity: "effectful",
    capability: REPORT.name,
    part: "status",
    arity: 1,
    run: (args, context) => {
      const n = statusOf(args[0], context);
      if (n === undefined) {
        sink.message(kindNote("status", context.kind(args[0])));
        sink.status(HIGHEST_STATUS);
      } else sink.status(n);
      return context.structure([]);
    },
  };
}

/** The check-output capability as a target supplies it, handing to `sink`. */
export function report(sink: ReportSink): CapabilityImplementation {
  return { definition: REPORT, create: () => [reportMessage(sink), reportStatus(sink)] };
}

/**
 * A sink that keeps the messages in the order handed over and the highest
 * status, 0 where none was. `then` is called with each message as it is
 * handed over, besides keeping it.
 */
export function collector(then?: (m: ReportMessage) => void): { readonly sink: ReportSink; readonly messages: ReportMessage[]; status(): number } {
  const messages: ReportMessage[] = [];
  let highest = 0;
  return {
    sink: {
      message(m) {
        messages.push(m);
        then?.(m);
      },
      status(n) {
        highest = Math.max(highest, n);
      },
    },
    messages,
    status: () => highest,
  };
}

/**
 * A message as the one line build tools read: `file:line:column: level:
 * text`, with the parts it has. A column is written only after a line, and
 * a line only after a file. Where there is no file, `level: text` alone.
 */
export function messageLine(m: ReportMessage): string {
  if (m.file === undefined) return `${m.level}: ${m.text}`;
  const place = m.line === undefined ? m.file : m.column === undefined ? `${m.file}:${m.line}` : `${m.file}:${m.line}:${m.column}`;
  return `${place}: ${m.level}: ${m.text}`;
}
