// What the terminal's commands present of a test phase (B-196 (the
// rebuild's acceptance side), chunk Q13 (check and run as configurations,
// and what a result holds), part 6). The launcher hands the outcome of a
// test phase as plain data (`LaunchOutcome.tests` of
// next/launch/launcher.ts); this file makes of it the lines the commands
// print and the messages they hand to `report`'s sink. It adds no analysis:
// it reads each test's end and result as the launcher gives them.
//
// The lines (`testLines`), one for each test in order: `test <name>:
// passed` where the test completed, and `test <name>: <the end>` otherwise,
// the end as the commands print one (`describe` of
// next/launch/launcher.ts). Under each test that did not complete, the
// lines it printed, each indented by two spaces. Then a last line:
// `tests: <n> passed, <m> failed`.
//
// The messages (`testMessages`), one for each test that ended refuted:
// level `error`, the text `test <name>: <the first reason>`, and the file,
// line and column of the first claim of that test's result whose word is
// `refuted` and which has a place, where there is one (`claimWord` of
// next/launch/launcher.ts). The terminal hands them through the same sink
// as a program's own messages, so a build tool reads a failing test as it
// reads any message. The launcher hands no message itself.
//
// Host-neutral: no process, no fs, no Buffer.

import { claimWord, describe, type LaunchOutcome } from "./launcher.js";
import type { ReportMessage } from "./report.js";

/** The outcome of a test phase, as the launcher gives it. */
export type TestsOutcome = NonNullable<LaunchOutcome["tests"]>;

/** The lines the commands print for a test phase whose load completed. */
export function testLines(tested: TestsOutcome): string[] {
  const out: string[] = [];
  let passed = 0;
  for (const t of tested.tests) {
    if (t.end.kind === "completed") {
      passed++;
      out.push(`test ${t.name}: passed`);
    } else {
      out.push(`test ${t.name}: ${describe(t.end)}`);
      for (const line of t.lines) out.push(`  ${line}`);
    }
  }
  out.push(`tests: ${passed} passed, ${tested.tests.length - passed} failed`);
  return out;
}

/** One message for each test that ended refuted, in order, with the place of its first refuted claim where it has one. */
export function testMessages(tested: TestsOutcome): ReportMessage[] {
  const out: ReportMessage[] = [];
  for (const t of tested.tests) {
    if (t.end.kind !== "refuted") continue;
    const text = `test ${t.name}: ${t.end.reasons[0] ?? t.end.reason}`;
    const at = t.result.claims.find((c) => claimWord(c) === "refuted" && c.at !== undefined)?.at;
    out.push(at === undefined ? { level: "error", text } : { level: "error", text, file: at.source, line: BigInt(at.start.line), column: BigInt(at.start.column) });
  }
  return out;
}
