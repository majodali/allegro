// A literal of Allegretto read as plain data (B-196 (the rebuild's
// acceptance side), chunk Q7 (the minimal launcher and the output
// capability), part 3): how an input's value is written on the command
// (`npm run allegretto -- f.alg --input n=42`, next/launch/allegretto.ts)
// and in a program's `// input:` and `// later:` lines
// (next/corpus/allegretto/README.md).
//
// What it reads: one Allegretto literal of next/ext/allegretto/forms.md §2,
// a text, a whole number, a decimal fraction, `true`, `false` or a symbol
// literal; a whole number with prefix `-`; and a structure or array literal
// of these, nested. Anything else is refused with a finding that says an
// input's value is a literal.
//
// It reads the text with the Allegretto grammar and reader that the
// emitter uses (`read` of next/bootstrap/reader.ts), and writes each bits
// literal with the emitter's own encoding (`literalBits` of
// next/bootstrap/emit.ts), so a literal handed as an input and the same
// literal written in a program are the same bits. A structure's keys are
// the symbols of its field names, as the emitter writes them; an array's
// keys are null.
//
// A negative number is a literal. The reader reads a `-` written before
// a fraction as part of the literal, and `-9223372036854775808`, the least
// integer, as one literal (forms.md §2, "Values"). Any other negative
// whole number is `int.neg` of a whole number in the signed 64-bit range,
// which never wraps, and so is the whole number itself.
//
// The plain data is the launcher's `Plain` (next/launch/launcher.ts). The
// launcher does not import this file.
//
// Tested by next/bootstrap/literal.test.ts.

import type { Plain } from "../launch/launcher.js";
import { literalBits } from "./emit.js";
import { read, type Expr } from "./reader.js";

export type LiteralResult = { readonly ok: true; readonly value: Plain } | { readonly ok: false; readonly finding: string };

const WHAT = "an input's value is a literal: a text, a number, true, false, a symbol, or a structure or array of these";

/** What a form that is not a literal is, for the finding. */
function formName(e: Expr): string {
  switch (e.k) {
    case "name":
      return `the name ${e.name}`;
    case "unary":
      return e.op === "-" ? "a negation of something that is not a whole number" : "a negation with !";
    case "block":
      return "a block";
    case "lambda":
      return "a function";
    default:
      return e.k === "apply" || e.k === "pipe" ? "an application" : `an expression (${e.k})`;
  }
}

/** Reads one Allegretto literal as plain data, or refuses it with a finding. */
export function readLiteral(text: string): LiteralResult {
  const r = read(text);
  if (!r.ok) return { ok: false, finding: `${WHAT}; ${JSON.stringify(text)} is not Allegretto: ${r.findings.map((f) => f.message).join("; ")}` };
  const { headers, items } = r.module;
  if (headers.length > 0 || items.length !== 1 || items[0].k !== "statement")
    return { ok: false, finding: `${WHAT}; ${JSON.stringify(text)} is not one literal` };
  const refusals: string[] = [];
  const plain = (e: Expr): Plain => {
    switch (e.k) {
      case "text":
      case "int":
      case "float":
      case "truth": {
        const { bytes, bitLength } = literalBits(e);
        return { bits: bytes, bitLength };
      }
      case "symbol":
        return { symbol: e.name };
      case "record":
        return {
          entries: e.fields.map((f) => {
            if (f.k === "named") return [{ symbol: f.name.name }, plain(f.value)] as const;
            refusals.push("an entry with a computed key");
            return [null, { entries: [] }] as const;
          }),
        };
      case "list":
        return { entries: e.items.map((i) => [null, plain(i)] as const) };
      case "unary":
        if (e.op === "-" && e.operand.k === "int") return plain({ ...e.operand, value: -e.operand.value });
        refusals.push(formName(e));
        return { entries: [] };
      default:
        refusals.push(formName(e));
        return { entries: [] };
    }
  };
  const value = plain(items[0].expr);
  if (refusals.length > 0) return { ok: false, finding: `${WHAT}; ${JSON.stringify(text)} holds ${refusals.join(", ")}` };
  return { ok: true, value };
}
