// The minimal launcher (B-196 (the rebuild's acceptance side), chunk Q7
// (the minimal launcher), part 1, docs/plans/rebuild-acceptance.md §5).
//
// What it realises, from docs/plans/book-pass-inventory.md:
//   "Startup, step by step", as far as milestone 2 needs it
//   "The launcher does only what cannot be done in Allegro"
//   "Only the launcher sets the ceiling"
//   "A module is a function of the capabilities it declares"
//   "A value that arrives later fills a cell, and a failure fills it with
//    an exception", as reworded: the launcher fills a cell with plain data
//
// It is a library and host-neutral: no process, no fs, no Buffer. It is
// built against the kernel's interface (next/kernel/interface.ts) and the
// data form of a saved program (next/kernel/saved-program.ts), and runs on
// whatever kernel factory it is given. The terminal's entry is
// next/launch/terminal.ts.
//
// The steps it performs, numbered as the decision numbers them:
//   2  creates a kernel, once;
//   3  checks the saved program and loads it, refusing with the findings
//      when it does not check or a pure primitive it needs is missing;
//   4  creates the capabilities of the ceiling as effectful primitive
//      functions, and hands the module function exactly those its
//      `declares` names with role `capability`, in the function's order;
//      a declared capability the ceiling does not grant is refused before
//      anything is evaluated;
//   5  builds the application of the module function to those arguments
//      and has the kernel evaluate it in a fresh scope, under the step
//      budget;
//   6  while the kernel waits on cells, fills those whose answers have
//      arrived and calls `advance`;
//   7  returns how the run ended, and the lines the output capability
//      wrote.
// Step 1 is the caller's: it passes the configuration. Step 3 loads one
// saved program; the first extensions are a later part.
//
// Left out of this part, each refused with a plain reason:
//   - a module parameter with role `input` or `module`;
//   - a declared capability with more than one part: handing one needs a
//     way to select a part inside the module, which is a kernel
//     primitive's job.
// A capability with one part is handed as that part's primitive function.
//
// Tested by next/launch/launcher.test.ts, on the stand-in kernel in
// next/launch/stand-in-kernel.for-tests.ts.

import type { Cell, CreateKernel, Kernel, PrimitiveDeclaration, Value } from "../kernel/interface.js";
import { INTERFACE_VERSION } from "../kernel/interface.js";
import { check, load, type SavedProgram } from "../kernel/saved-program.js";

/** A capability's definition: its name and the names of its parts. */
export interface CapabilityDefinition {
  readonly name: string;
  readonly parts: readonly string[];
}

/**
 * Plain data, as the host writes it: bits, a symbol, or a structure of
 * them. A cell is filled with plain data only.
 */
export type Plain =
  | { readonly bits: Uint8Array; readonly bitLength?: number }
  | { readonly symbol: string }
  | { readonly entries: ReadonlyArray<readonly [Plain | null, Plain]> };

/** What the launcher offers a capability's implementation for one run. */
export interface CapabilityHost {
  /** Appends a line to what the run printed. */
  line(text: string): void;
  /**
   * Says that `cell` will be answered with what `answer` resolves to. The
   * launcher fills the cell when it arrives. A failure is an answer too,
   * as plain data in the form the capability's definition states; a
   * rejected promise is a fault of the capability.
   */
  later(cell: Cell, answer: Promise<Plain>): void;
}

/** A capability as a target supplies it: its definition, and how to make its parts. */
export interface CapabilityImplementation {
  readonly definition: CapabilityDefinition;
  /** The effectful primitive declarations of the parts, one for each part, in the definition's order. */
  create(host: CapabilityHost): readonly PrimitiveDeclaration[];
}

/** What a target offers: the capabilities it can supply, and the pure primitives it has. */
export interface Target {
  readonly capabilities: readonly CapabilityImplementation[];
  /** Pure primitive declarations, found by their hash when a saved program needs them. */
  readonly primitives?: readonly PrimitiveDeclaration[];
}

/** The configuration, as far as milestone 2 needs it. */
export interface Configuration {
  /** The names of the capabilities the ceiling grants. */
  readonly ceiling: readonly string[];
  /** The step budget for the whole run: the evaluation and every advance after it. None: no budget. */
  readonly steps?: number;
}

export interface Launch {
  readonly createKernel: CreateKernel;
  /** A saved program, as parsed JSON. It is checked before it is used. */
  readonly program: unknown;
  readonly configuration: Configuration;
  readonly target: Target;
  /** Called with each line as it is printed, besides collecting it. */
  readonly onLine?: (line: string) => void;
}

/** How a run ended. */
export type LaunchEnd =
  /** Evaluation went as far as the information allows, and nothing waited for is outstanding. */
  | { readonly kind: "completed"; readonly steps: number }
  /** The kernel recorded a refutation. */
  | { readonly kind: "refuted"; readonly steps: number; readonly reason: string }
  /** The step budget ran out; what was unfinished is undecided. */
  | { readonly kind: "limit"; readonly steps: number; readonly reason: string }
  /** The kernel waits on a cell that no capability will answer. */
  | { readonly kind: "waiting"; readonly steps: number; readonly reason: string }
  /** Refused before anything was evaluated. */
  | { readonly kind: "refused"; readonly reason: string; readonly findings: readonly string[] }
  /** The kernel or a capability threw. */
  | { readonly kind: "fault"; readonly reason: string };

export interface LaunchOutcome {
  /** The lines printed, in order. */
  readonly lines: string[];
  readonly end: LaunchEnd;
}

function refused(lines: string[], reason: string, findings: readonly string[] = []): LaunchOutcome {
  return { lines, end: { kind: "refused", reason, findings } };
}

function plainValue(kernel: Kernel, plain: Plain): Value {
  if ("bits" in plain) return kernel.bits(plain.bits, plain.bitLength);
  if ("symbol" in plain) return kernel.symbol(plain.symbol);
  return kernel.structure(plain.entries.map(([k, v]) => [k === null ? null : plainValue(kernel, k), plainValue(kernel, v)] as const));
}

/** Runs one saved program as "Startup, step by step" has it, as far as milestone 2 needs. */
export async function launch(request: Launch): Promise<LaunchOutcome> {
  const { configuration, target } = request;
  const lines: string[] = [];
  const answers = new Map<Cell, Promise<void>>();
  const arrived = new Map<Cell, Plain>();
  let capabilityFault: string | null = null;
  const host: CapabilityHost = {
    line(text) {
      lines.push(text);
      request.onLine?.(text);
    },
    later(cell, answer) {
      answers.set(cell, answer.then(
        (plain) => { arrived.set(cell, plain); },
        (e) => { capabilityFault ??= `a capability's answer failed: ${e instanceof Error ? e.message : String(e)}`; },
      ));
    },
  };

  // Step 2: the kernel.
  const kernel = request.createKernel();
  if (kernel.interfaceVersion !== INTERFACE_VERSION)
    return refused(lines, `the kernel implements interface version ${kernel.interfaceVersion}; this launcher needs ${INTERFACE_VERSION}`);

  // Step 3, the record alone: nothing reaches the kernel until it checks.
  const findings = check(request.program);
  if (findings.length > 0) return refused(lines, "the saved program does not check", findings);
  const program = request.program as SavedProgram;
  const pure = new Map<string, PrimitiveDeclaration>();
  for (const p of target.primitives ?? []) if (p.purity === "pure") pure.set(p.hash, p);
  const missing = program.needs.filter((n) => !pure.has(n.hash));
  if (missing.length > 0)
    return refused(lines, "the target lacks a primitive the saved program needs", missing.map((n) => `the target lacks the primitive ${n.name} (${n.hash})`));

  // Step 4, the ceiling against the module's parameters, before any value is made.
  const supplied = new Map(target.capabilities.map((c) => [c.definition.name, c] as const));
  const problems: string[] = [];
  for (const name of configuration.ceiling)
    if (!supplied.has(name)) problems.push(`the ceiling grants ${name}, which this target does not supply`);
  for (const d of program.declares) {
    if (d.role === "input") problems.push(`the module declares the input ${d.name}; this launcher supplies no inputs yet`);
    else if (d.role === "module") problems.push(`the module imports the module ${d.name}; this launcher supplies no modules yet`);
    else if (!configuration.ceiling.includes(d.name)) problems.push(`the module declares the capability ${d.name}, which the ceiling does not grant`);
    else if ((supplied.get(d.name)?.definition.parts.length ?? 0) !== 1)
      problems.push(`the module declares the capability ${d.name}, which has more than one part; this launcher hands only a capability of one part`);
  }
  if (problems.length > 0) return refused(lines, problems[0], problems);

  try {
    // Step 3, loading: the pure primitives it needs, then the record.
    const primitives = new Map<string, Value>();
    for (const need of program.needs) primitives.set(need.hash, kernel.primitiveFunction(pure.get(need.hash)!));
    const moduleFn = load(kernel, program, primitives);

    // Step 4: the capabilities of the ceiling, as effectful primitive functions.
    const granted = new Map<string, Value[]>();
    for (const name of configuration.ceiling) {
      const implementation = supplied.get(name)!;
      const parts = implementation.create(host);
      if (parts.length !== implementation.definition.parts.length || parts.some((p) => p.purity !== "effectful"))
        return { lines, end: { kind: "fault", reason: `the capability ${name} did not make one effectful primitive for each of its parts` } };
      granted.set(name, parts.map((p) => kernel.primitiveFunction(p)));
    }
    const args = program.declares.map((d) => granted.get(d.name)![0]);

    // Step 5: instantiate the module, in a fresh scope, under the budget.
    const budget = configuration.steps;
    const left = (spent: number): { steps?: number } => (budget === undefined ? {} : { steps: Math.max(0, budget - spent) });
    const result = kernel.evaluate(kernel.expression(moduleFn, args), kernel.scope(), left(0));
    let steps = result.steps;
    const atLimit = (): LaunchOutcome => ({ lines, end: { kind: "limit", steps, reason: `the step budget of ${budget} ran out` } });
    const refutedEnd = (): LaunchOutcome => ({
      lines,
      end: { kind: "refuted", steps, reason: "a refutation is recorded on the program's value; this version of the interface gives no explanation of it" },
    });
    if (result.refuted) return refutedEnd();
    if (result.ended === "limit") return atLimit();

    // Step 6: deliver the values that arrive later.
    for (;;) {
      if (capabilityFault !== null) return { lines, end: { kind: "fault", reason: capabilityFault } };
      const waiting = kernel.waiting();
      if (waiting.length === 0) break;
      let filled = 0;
      for (const [cell, plain] of arrived) {
        if (!kernel.filled(cell)) {
          kernel.fill(cell, plainValue(kernel, plain));
          filled++;
        }
        arrived.delete(cell);
        answers.delete(cell);
      }
      if (filled > 0) {
        const advanced = kernel.advance(left(steps));
        steps += advanced.steps;
        if (advanced.refuted.length > 0) return refutedEnd();
        if (advanced.ended === "limit") return atLimit();
        continue;
      }
      const due = waiting.filter((c) => answers.has(c)).map((c) => answers.get(c)!);
      if (due.length === 0)
        return { lines, end: { kind: "waiting", steps, reason: `the program waits on ${waiting.length} cell(s) that no capability will answer` } };
      await Promise.race(due);
    }

    // Step 7.
    return { lines, end: { kind: "completed", steps } };
  } catch (e) {
    return { lines, end: { kind: "fault", reason: e instanceof Error ? e.message : String(e) } };
  }
}

/** One line for a run's end, for a person. */
export function describe(end: LaunchEnd): string {
  switch (end.kind) {
    case "completed":
      return `completed in ${end.steps} step(s)`;
    case "refused":
      {
      const more = end.findings.filter((f) => f !== end.reason);
      return `refused: ${end.reason}${more.map((f) => `\n  ${f}`).join("")}`;
    }
    case "fault":
      return `fault: ${end.reason}`;
    default:
      return `${end.kind}: ${end.reason}`;
  }
}
