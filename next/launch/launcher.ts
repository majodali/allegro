// The minimal launcher (B-196 (the rebuild's acceptance side), chunk Q7
// (the minimal launcher), parts 1 and 2, docs/plans/rebuild-acceptance.md §5).
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
// built against the second version of the kernel's interface (`Kernel2`
// of next/kernel/interface.ts) and of the data form of a saved program
// (`check2` of next/kernel/saved-program.ts), and runs on whatever kernel
// factory it is given. The terminal's entry is next/launch/terminal.ts.
//
// The steps it performs, numbered as the decision numbers them:
//   2  creates a kernel, once;
//   3  checks the saved program, of the first or second version, and
//      loads it, refusing with the findings when it does not check, a
//      pure primitive it needs is missing, or the kernel refuses to load
//      it; the stored outcomes of a record of the second version are
//      restored only when the configuration names the builder it accepts
//      them from (`restoreAs`), and are not looked at otherwise;
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
//      wrote. A refuted run carries the reason the kernel gives for each
//      refutation it reported (`reasonOf`). A run left waiting names the
//      names nothing binds, apart from the cells no capability will answer.
// Step 1 is the caller's: it passes the configuration. Step 3 loads one
// saved program; the first extensions are a later part.
//
// Left out, each refused with a plain reason:
//   - a module parameter with role `input` or `module`;
//   - a declared capability with more than one part: handing one needs a
//     way to select a part inside the module, which is a kernel
//     primitive's job, and the kernel has none yet.
// A capability with one part is handed as that part's primitive function.
//
// A key slot of a record of the second version is not the launcher's:
// `load` has the kernel make the keys, and `declares` lists only the
// parameters after them.
//
// Tested by next/launch/launcher.test.ts, on the reference kernel of
// next/kernel/create.ts.

import type { Cell, CreateKernel2, Kernel2, PrimitiveDeclaration, Value } from "../kernel/interface.js";
import { INTERFACE_VERSION, KernelFault } from "../kernel/interface.js";
import { check2, load, type SavedProgram } from "../kernel/saved-program.js";

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
  /**
   * The builder whose stored outcomes this configuration accepts for the
   * saved program. Passed to `load` as `restoreAs`. None: the stored
   * outcomes are not looked at, and every claim is decided again.
   */
  readonly restoreAs?: string;
}

export interface Launch {
  readonly createKernel: CreateKernel2;
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
  /**
   * The kernel recorded a refutation. `reasons` holds the reason the
   * kernel gives for each refuted value the run reported, in the order
   * reported; `reason` joins them.
   */
  | { readonly kind: "refuted"; readonly steps: number; readonly reason: string; readonly reasons: readonly string[] }
  /** The step budget ran out; what was unfinished is undecided. */
  | { readonly kind: "limit"; readonly steps: number; readonly reason: string }
  /**
   * The kernel waits on what nothing will supply: `unanswered` counts the
   * cells no capability will answer, and `unbound` names the names that
   * nothing binds.
   */
  | { readonly kind: "waiting"; readonly steps: number; readonly reason: string; readonly unanswered: number; readonly unbound: readonly string[] }
  /** Refused before anything was evaluated. */
  | { readonly kind: "refused"; readonly reason: string; readonly findings: readonly string[] }
  /** The kernel or a capability threw. */
  | { readonly kind: "fault"; readonly reason: string };

export interface LaunchOutcome {
  /** The lines printed, in order. */
  readonly lines: string[];
  readonly end: LaunchEnd;
}

/** The calls of the second version the launcher uses. */
const SECOND_VERSION_CALLS = ["module", "restore", "reasonOf"] as const;

function refused(lines: string[], reason: string, findings: readonly string[] = []): LaunchOutcome {
  return { lines, end: { kind: "refused", reason, findings } };
}

function plainValue(kernel: Kernel2, plain: Plain): Value {
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
  const lacking = SECOND_VERSION_CALLS.filter((name) => typeof (kernel as unknown as Record<string, unknown>)[name] !== "function");
  if (lacking.length > 0)
    return refused(lines, "the kernel is not of the second version of the interface", lacking.map((name) => `the kernel lacks ${name}`));

  // Step 3, the record alone: nothing reaches the kernel until it checks.
  const findings = check2(request.program);
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
    let moduleFn: Value;
    try {
      moduleFn = load(kernel, program, primitives, configuration.restoreAs === undefined ? {} : { restoreAs: configuration.restoreAs });
    } catch (e) {
      if (e instanceof KernelFault) throw e;
      const message = e instanceof Error ? e.message : String(e);
      return refused(lines, "the kernel refused to load the saved program", [message]);
    }

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
    // A kernel may end at a limit of its own with no budget set (its stack runs out).
    const atLimit = (): LaunchOutcome => ({
      lines,
      end: { kind: "limit", steps, reason: budget === undefined ? "the kernel reached its own limit; no step budget was set" : `the step budget of ${budget} ran out` },
    });
    const refutedEnd = (values: readonly Value[]): LaunchOutcome => {
      const reasons = values.map((v) => kernel.reasonOf(v) ?? "the kernel gives no reason for this refutation");
      return { lines, end: { kind: "refuted", steps, reason: reasons.join("; "), reasons } };
    };
    if (result.refuted) return refutedEnd([result.value]);
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
        if (advanced.refuted.length > 0) return refutedEnd(advanced.refuted);
        if (advanced.ended === "limit") return atLimit();
        continue;
      }
      const due = waiting.filter((c) => answers.has(c)).map((c) => answers.get(c)!);
      if (due.length === 0) {
        // A name nothing binds is listed as a cell handle of kind symbol.
        const unbound = waiting.filter((c) => kernel.kind(c) === "symbol").map((c) => kernel.symbolName(c));
        const unanswered = waiting.length - unbound.length;
        const parts = [
          ...(unanswered > 0 ? [`${unanswered} cell(s) that no capability will answer`] : []),
          ...(unbound.length > 0 ? [`the name(s) ${unbound.join(", ")}, which nothing binds`] : []),
        ];
        return { lines, end: { kind: "waiting", steps, reason: `the program waits on ${parts.join(" and on ")}`, unanswered, unbound } };
      }
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
