// The checks: what the launcher is handed to choose what a check goes into
// beyond the program as written, and to say what the check found (B-196
// (the rebuild's acceptance side), chunk Q13 (check and run as
// configurations, and what a result holds), part 7,
// docs/plans/rebuild-acceptance.md §7).
//
// What it realises, from docs/plans/book-pass-inventory.md:
//   "Check reaches every claim": "The phase chooses which of those are
//    evaluated too, by the project's configuration; the kernel has no
//    default for it", and "A configuration may require more, such as that
//    no claim is left waiting"
//   "A tool reads a phase's result and adds no analysis of its own": the
//    checks read the check's result as plain data
//
// The maintainer, 2026-11-23: "the actual checks are performed by a
// host-side module configured for a project's specific requirements. In
// the long term this host-side module will be implemented in Allegro, but
// for now you can implement it in host code to test the process." This
// file is that module's first version.
//
// A check is evaluations the launcher makes (`Phase.check` of
// next/launch/launcher.ts). The first is the program as written. Each
// thing an evaluation left untouched, the launcher hands to `into` as
// plain data (`UntouchedData`), and goes into it where `into` answers
// true. When nothing chosen is left, it hands the check's result, as plain
// data, to `findings`, and puts what that answers in the result. A finding
// (`Finding`) is plain data: a level, a text, and a file, line and column
// where there is a place, the line and column numbers, so a result that
// holds findings survives JSON. Whoever hands a finding to `report`'s sink
// makes a message of it (`findingMessage`). A finding of level `error`
// ends the launch (the end `findings`), where nothing
// else did. The launcher has no rule of its own for either: with no checks
// handed, a check goes into nothing beyond the program as written and has
// no findings.
//
// The shipped checks (`shippedChecks`) are configured by four settings
// (`CHECK_SETTINGS`), each with a default (`CHECK_DEFAULTS`):
//   arguments  on, off: a function a call opened is evaluated again for
//              every argument. Default on;
//   uncalled   on, off: a function nothing calls is evaluated for every
//              argument. Default on;
//   unread     on, off: a binding nothing reads, an argument nothing
//              needed and an entry nothing read are evaluated. Default off;
//   waiting    pass, note, warning, error: how a claim that waits is
//              reported. Default pass.
// The four defaults are the maintainer's, in session on 2026-11-25. The
// setting `check` of next/tools/configuration.ts reads them from their
// sources.
//
// The shipped checks' findings, in this order: one of level `error` for
// each refuted claim of either list, with the claim's place, and one for
// each refutation listed, with its place; then, unless `waiting` is
// `pass`, one of that level for each claim of either list whose word is
// `waiting` (`claimWord` of next/launch/launcher.ts), with its place. A
// claim in both lists is reported once: by its key and its place.
//
// Not built: a project's own checks. A setting that named a file of host
// code would run that code with the full rights of whoever runs the
// command, so no setting names one; the project's own checks wait for the
// form in Allegro. A choice by module or by function: `into` is given the
// place, so the interface allows it.
//
// Host-neutral: no process, no fs, no Buffer.
//
// Tested by next/launch/checks.test.ts.

import { claimWord, type ClaimResult, type LaunchResult, type UntouchedData } from "./launcher.js";
import type { Level, ReportMessage } from "./report.js";

/**
 * A finding: what a check found, as plain data. Its level and text are
 * those of a message of `report`; its file, line and column, where there
 * is a place, are a string and two numbers, so a result that holds it
 * survives JSON. `findingMessage` makes the message of `report` of it.
 */
export interface Finding {
  readonly level: Level;
  readonly text: string;
  readonly file?: string;
  readonly line?: number;
  readonly column?: number;
}

/** The message of `report` a finding is handed to a sink as: the same fields, its line and column as whole numbers of 64 bits. */
export function findingMessage(f: Finding): ReportMessage {
  return {
    level: f.level,
    text: f.text,
    ...(f.file === undefined ? {} : { file: f.file }),
    ...(f.line === undefined ? {} : { line: BigInt(f.line) }),
    ...(f.column === undefined ? {} : { column: BigInt(f.column) }),
  };
}

/** What the launcher is handed to choose what a check goes into, and to say what it found. */
export interface Checks {
  /** Whether to go into one thing an evaluation of the check left untouched, given as plain data. */
  into(item: UntouchedData): boolean;
  /** The findings of a check, given its result as plain data. */
  findings(result: LaunchResult): readonly Finding[];
}

/** The four settings of the shipped checks, and the values each takes, in order. */
export const CHECK_SETTINGS = {
  arguments: ["on", "off"],
  uncalled: ["on", "off"],
  unread: ["on", "off"],
  waiting: ["pass", "note", "warning", "error"],
} as const;

export type CheckName = keyof typeof CHECK_SETTINGS;

/** The names of the four settings, in order. */
export const CHECK_NAMES = Object.keys(CHECK_SETTINGS) as readonly CheckName[];

/** A value of each setting, where a source sets it. */
export type CheckSettings = { readonly [N in CheckName]?: (typeof CHECK_SETTINGS)[N][number] };

/** The default of each setting (the maintainer, 2026-11-25). */
export const CHECK_DEFAULTS: { readonly [N in CheckName]: (typeof CHECK_SETTINGS)[N][number] } = { arguments: "on", uncalled: "on", unread: "off", waiting: "pass" };

const and = (names: readonly string[]): string => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/**
 * Why a name and a value are no setting of the shipped checks, where they
 * are not: the name is none of the four, or the value none of its values.
 * `where` says who set it, as a finding names it.
 */
export function checkFinding(name: string, value: string, where: string): string | undefined {
  if (!(CHECK_NAMES as readonly string[]).includes(name))
    return `${where} sets check ${name}, which names no check setting: the names are ${and(CHECK_NAMES)}`;
  const values: readonly string[] = CHECK_SETTINGS[name as CheckName];
  if (!values.includes(value)) return `${where} sets check ${name} to ${JSON.stringify(value)}, which is none of its values: ${and(values)}`;
  return undefined;
}

/** A claim's identity across the two lists: its key and its place. */
const identity = (c: ClaimResult): string => JSON.stringify([c.key ?? null, c.at ?? null]);

/** A finding of this level and text, with the place where there is one. */
function finding(level: Level, text: string, at: ClaimResult["at"]): Finding {
  return at === undefined ? { level, text } : { level, text, file: at.source, line: at.start.line, column: at.start.column };
}

/** The reasons of a claim or a refutation, as the text of a finding ends with them. */
const because = (reasons: readonly string[]): string => (reasons.length === 0 ? "" : `: ${reasons.join("; ")}`);

/** The shipped checks, configured by the four settings; a setting no source sets has its default. */
export function shippedChecks(settings: CheckSettings = {}): Checks {
  const s = { ...CHECK_DEFAULTS, ...settings };
  return {
    into(item) {
      if (item.kind === "function") return item.called ? s.arguments === "on" : s.uncalled === "on";
      return s.unread === "on";
    },
    findings(result) {
      const out: Finding[] = [];
      const written = result.claims.map((c) => ["program as written", c] as const);
      const broader = (result.broader?.claims ?? []).map((c) => ["broader analysis", c] as const);
      const reported = new Set<string>();
      for (const [list, c] of [...written, ...broader]) {
        if (claimWord(c) !== "refuted" || reported.has(identity(c))) continue;
        reported.add(identity(c));
        out.push(finding("error", `a claim of the ${list} is refuted${because(c.reasons)}`, c.at));
      }
      for (const r of result.refutations) out.push(finding("error", `a part is refuted${because([r.reason])}`, r.at));
      if (s.waiting !== "pass")
        for (const [list, c] of [...written, ...broader]) {
          if (claimWord(c) !== "waiting" || reported.has(identity(c))) continue;
          reported.add(identity(c));
          out.push(finding(s.waiting, `a claim of the ${list} waits: the check could not decide it`, c.at));
        }
      return out;
    },
  };
}
