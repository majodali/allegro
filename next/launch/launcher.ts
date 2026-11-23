// The minimal launcher (B-196 (the rebuild's acceptance side), chunk Q7
// (the minimal launcher), parts 1 to 4, docs/plans/rebuild-acceptance.md §5;
// chunk Q5 (the first notation and the bootstrap), part 3, for the
// capability as a structure of its parts). Part 4 loads the records of
// imported modules. Chunk Q13 (check and run as configurations, and what a
// result holds), part 1, adds the result: what the run found; part 2 adds
// to it the source of each value of the configuration; part 3 makes a
// launch apply a sequence of phases, each supplying capabilities and
// inputs.
//
// What it realises, from docs/plans/book-pass-inventory.md:
//   "Startup, step by step", as far as milestone 2 needs it
//   "The launcher does only what cannot be done in Allegro"
//   "Only the launcher sets the ceiling"
//   "A module is a function of its capabilities, inputs and imports"
//   "A late answer or its failure fills a cell as plain data": the
//    launcher fills a cell with plain data
//   "Phases are configuration", "When information arrives, what waited on
//    it is evaluated again": a later phase of the configuration supplies
//    an input, and what waited on it is evaluated again in the same
//    launch
//   "A phase hands its residual to the next", as far as one execution: the
//    phases are applied in order on one kernel, and the next phase takes
//    up what the one before left waiting on an input. A later phase
//    supplies no capability, and what a phase must leave decided is not
//    built
//   "A result names everything it rests on", as far as this part goes,
//   "A tool reads a phase's result and adds no analysis of its own" and
//   "A module's summary is the weakest strength among its claims": the
//    result
//
// It is a library and host-neutral: no process, no fs, no Buffer. It is
// built against the kernel's interface (`Kernel` of
// next/kernel/interface.ts, one interface since chunk K12 (the interface
// made one) of the kernel stream) and the second version of the data form
// of a saved program (`check2` of next/kernel/saved-program.ts), and runs
// on whatever kernel factory it is given. The terminal's entry is next/launch/terminal.ts.
//
// The steps it performs, numbered as the decision numbers them:
//   2  creates a kernel, once;
//   3  checks the saved program, of the first or second version, and the
//      records of the modules it imports (`imports`, in the order they
//      are loaded), and loads each imported record and then the saved
//      program into that one kernel, refusing with the findings when one
//      does not check, a pure primitive one needs is missing, or the
//      kernel refuses to load one. Every module a record declares must be
//      the module of a supplied imported record, by identity, or the run
//      is refused. No imported module is called by the launcher: the
//      kernel supplies it to the module that imports it, which
//      instantiates it. The stored outcomes of a record of the second
//      version are restored only when the configuration names the builder
//      it accepts them from (`restoreAs`), and are not looked at
//      otherwise;
//   4  creates the capabilities of the ceiling, each part an effectful
//      primitive function, and hands the module function exactly those
//      its `declares` names with role `capability`, in the function's
//      order. A declared capability the first phase does not supply is
//      handed as a fresh cell in its place. The ceiling's capabilities go to the main module alone: an
//      imported module gets a capability only as the module that imports
//      it hands it on. A capability is handed as a structure of its parts, keyed by
//      the symbols of the part names, so a program reads a part as an
//      entry (next/ext/allegretto/forms.md §2: `output.write("hello")`).
//      A declared capability the ceiling does not grant is refused before
//      anything is evaluated. Each parameter with role `input` is handed the
//      plain data the configuration supplies for it at the start (`inputs`),
//      found by its declared name, or else a fresh cell. An input the module
//      does not declare, or one supplied more than once, is refused before
//      anything is evaluated;
//   5  builds the application of the module function to those arguments,
//      its capabilities and inputs only, never an argument for an import,
//      and has the kernel evaluate it, under the step budget. The budget
//      is given once, to that evaluation, and the kernel counts against
//      it the work every later call does for the evaluation. Where the
//      configuration sets none there is none: the launcher gives no
//      default, and a run goes on as a host program does (the
//      maintainer's ruling of 2026-11-20);
//   6  while the kernel waits on cells, fills those whose answers have
//      arrived and calls `advance`. When it waits and no capability's
//      answer is due, it applies the next phase: it fills the cells of the
//      inputs that phase supplies and calls `advance`. Phases are applied
//      in order, one at a time; when nothing waits, the phases left are not
//      applied, and a refutation ends the launch in whatever phase it is
//      found. A phase is what it supplies (`Phase`): the configuration
//      gives the list (`phases`), or else today's shape, a first phase
//      named `run` that supplies every capability of the ceiling and
//      `inputs`, and one named `later` for each entry of `later`, which
//      supplies inputs only. A configuration that gives `phases` and also
//      `inputs` or `later`, an empty list of phases, a phase that supplies
//      a capability the ceiling does not grant, and a phase after the
//      first that supplies a capability are refused before anything is
//      evaluated. A phase is no formal element of the
//      system (the maintainer, 2026-11-17 and 2026-11-18): a phase is one
//      call of the module function with some capabilities and inputs
//      given, and the step to the next is the same event as a value that
//      arrives later. So every phase runs on the same kernel, under one
//      step budget. A capability is supplied by the first phase or by
//      none: the kernel fills a cell with plain data only, and a
//      capability is a structure of primitive functions, so no later
//      phase can put one into the cell a declared capability is handed
//      as;
//   7  returns how the run ended, and the lines the output capability
//      wrote, with the number of lines printed before each later phase was
//      applied. A refuted run carries the reason the kernel gives for each
//      refutation it reported (`reasonOf`). A run left waiting names the
//      inputs no phase supplied, and, where the configuration gives
//      `phases`, the capabilities, apart from the cells no capability will
//      answer. Every end but a refusal also gives one entry for each phase
//      applied (`phases`): its name, the lines printed before it, and the
//      result as it stood when it was over. A record whose module uses a name nothing binds is refused
//      at loading, with the kernel's message: "A free name never gets a
//      value".
//      With every end but a refusal it also returns the result
//      (`LaunchResult`), plain data with no handle of the kernel in it:
//      - `claims`, one entry for each claim as written, in the order the
//        run first reported it. Its five counts are the sums of what the
//        evaluation and every later call reported for that claim, its
//        level of waiting is the last one reported, and its reasons and
//        what it rests on are each listed once. Records of one claim are
//        matched by the handle `ClaimRecord.claim`. An entry's `at` is the
//        key the kernel gives the claim in its module's function, resting
//        on nothing (`claimKey`), so a reader can tell claims apart;
//      - `summary`, the weakest strength among the claims (`summaryOf`);
//      - `restsOn`, what the run as a whole rests on: the kernel variant,
//        the pure primitives the records name, the modules loaded, the
//        capabilities the module run declares, the builder whose
//        stored outcomes the configuration accepts, and the source of
//        each value of the configuration, as the caller gives it
//        (`Launch.sources`).
//      The launcher adds no analysis: it sums what the kernel reports and
//      names what it was given. It decides no claim and drops none. Under
//      a phase that supplies no capability it does the same: what is
//      decided there is what the kernel decided.
// Step 1 is the caller's: it passes the configuration and the records.
// The launcher does not resolve a configuration from its sources: the
// terminal's entries do, with `resolve` of next/tools/configuration.ts,
// and hand the launcher the configuration and the list of its sources.
// Who finds and emits the imported records is the caller's too: the
// bootstrap's driver (next/bootstrap/driver.ts) for an Allegretto text.
//
// The pure primitives a record needs come from the target, found by hash
// (`Target.primitives`); the terminal's entry supplies the shipped ones of
// next/prims/index.ts. A record that needs a hash the target lacks is
// refused, naming it.
//
// A key slot of a record of the second version is not the launcher's:
// `load` has the kernel make the keys, and `declares` lists only the
// parameters after them.
//
// Tested by next/launch/launcher.test.ts, on the kernel that
// next/kernel/create.ts gives.

import type { Advance, Cell, ClaimRecord, CreateKernel, Declaration, Kernel, PrimitiveDeclaration, Rest, Value } from "../kernel/interface.js";
import { INTERFACE_VERSION, InterfaceError, KernelFault } from "../kernel/interface.js";
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

/** The inputs a configuration supplies in one phase: plain data, by the input's declared name. */
export type Inputs = Readonly<Record<string, Plain>>;

/** The configuration, as far as milestone 2 needs it, and the inputs of the module being run. */
export interface Configuration {
  /** The names of the capabilities the ceiling grants. */
  readonly ceiling: readonly string[];
  /** The step budget for the whole run: the evaluation and every advance after it. None: no budget, and the launcher gives no default. */
  readonly steps?: number;
  /**
   * The builder whose stored outcomes this configuration accepts for the
   * saved program. Passed to `load` as `restoreAs`. None: the stored
   * outcomes are not looked at, and every claim is decided again.
   */
  readonly restoreAs?: string;
  /** The inputs supplied at the start. An input not supplied is a cell. */
  readonly inputs?: Inputs;
  /**
   * Each later phase, in order: the inputs it supplies, each filling the
   * cell of that input. Inputs only: a later phase has the kernel, the
   * capabilities and the step budget of the launch.
   */
  readonly later?: readonly Inputs[];
  /**
   * The phases, in order, each by what it supplies. The first is applied
   * at the start, and each later one when the kernel waits and no
   * capability's answer is due. Only the first may supply capabilities:
   * the kernel fills a cell with plain data only. None: one phase that
   * supplies every capability of the ceiling and `inputs`, and then one
   * for each entry of `later`, each named `later`. A configuration that
   * gives `phases` gives neither `inputs` nor `later`.
   */
  readonly phases?: readonly Phase[];
}

/**
 * One phase of a launch: what it supplies. A phase is one call of the
 * module function with some capabilities and inputs given (the note of
 * 2026-11-18 on "A phase hands its residual to the next"): the launcher
 * applies the phases in one execution, on one kernel, under one step
 * budget, and a phase is no element of the system beyond that.
 */
export interface Phase {
  /** A word for reports, such as `check` or `run`. */
  readonly name: string;
  /**
   * The capabilities this phase supplies, each of the ceiling. Only the
   * first phase may name any: a later one cannot put a capability into a
   * cell, since the kernel fills a cell with plain data only.
   */
  readonly capabilities: readonly string[];
  /** The inputs this phase supplies, as `Configuration.inputs` holds them. */
  readonly inputs?: Inputs;
}

/**
 * A source of configuration, highest first: the command line, the
 * project's file, the environment, what is built into the launcher.
 */
export type SourceName = "command line" | "file" | "environment" | "launcher";

/** Which source supplied one value of the configuration. `setting` is the setting's name, or `inputs.<name>` for one input. */
export interface ConfigurationSource {
  readonly setting: string;
  readonly source: SourceName;
}

export interface Launch {
  readonly createKernel: CreateKernel;
  /** A saved program, as parsed JSON. It is checked before it is used. */
  readonly program: unknown;
  /**
   * The saved programs of the modules it imports, directly or through
   * another, as parsed JSON, in the order they are loaded. Each is checked
   * and loaded into the same kernel before the saved program; none is
   * called by the launcher.
   */
  readonly imports?: readonly unknown[];
  readonly configuration: Configuration;
  /**
   * For each value of the configuration, the source that supplied it, as
   * the caller resolved it. The launcher puts the list in the result as
   * given. None: the result names no sources.
   */
  readonly sources?: readonly ConfigurationSource[];
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
   * cells no capability will answer, and `inputs` names the declared
   * inputs that no phase of the configuration supplied. Where the
   * configuration gives `phases`, `capabilities` names the declared
   * capabilities that no phase supplied and that the program waits on;
   * without `phases` every capability is supplied at the start, and it is
   * left out. A name nothing binds is not waited on: "A free name never
   * gets a value", so the kernel refuses a module that has one.
   */
  | {
      readonly kind: "waiting";
      readonly steps: number;
      readonly reason: string;
      readonly unanswered: number;
      readonly inputs: readonly string[];
      readonly capabilities?: readonly string[];
    }
  /** Refused before anything was evaluated. */
  | { readonly kind: "refused"; readonly reason: string; readonly findings: readonly string[] }
  /** The kernel or a capability threw. */
  | { readonly kind: "fault"; readonly reason: string };

/**
 * One thing a claim's outcomes rest on, as plain data: a `Rest` of the
 * kernel's interface with the kernel's handle left out. An assumption
 * keeps the module that made it (`by`) and loses the assumption as
 * written (`at`), which is a value of the kernel and means nothing
 * outside it.
 */
export type RestData =
  /** `sampled` is present where the kernel evaluated the claim on that many cases and not in full. */
  | { readonly kind: "kernel"; readonly variant: string; readonly sampled?: number }
  | { readonly kind: "primitive"; readonly hash: string; readonly name: string }
  | { readonly kind: "capability"; readonly capability: string; readonly part: string }
  | { readonly kind: "builder"; readonly builder: string }
  | { readonly kind: "assumption"; readonly by: string }
  | { readonly kind: "limit" };

/**
 * What the run found of one claim as written, summed over the evaluation
 * and every later call of the run that reported it.
 */
export interface ClaimResult {
  /**
   * Which claim it is, for a reader: the key the kernel gives the claim in
   * the function of its module, resting on nothing (`claimKey`, with an
   * empty list of what it rests on). It is computed from the claim's
   * content and its module's, so it is the same on every kernel variant
   * and in every run of the same records. Two claims of the same content
   * in the same function have the same key. Absent where the kernel names
   * no module for the claim, or does not give a key for it.
   */
  readonly at?: string;
  /** The identity of the module whose code wrote the claim, where the kernel gives one. */
  readonly module?: string;
  /** Evaluations that came out decided, over the whole run. */
  readonly decided: number;
  /** Evaluations that came out sampled: true of each case tried, or resting on such a sample. */
  readonly sampled: number;
  /** Evaluations that came out resting on an assumption. */
  readonly assumed: number;
  /** Evaluations where what decides the claim answered that it cannot tell. */
  readonly undecided: number;
  /** Evaluations that were refuted. */
  readonly refuted: number;
  /** How many evaluations of the claim wait: the level its last record gave. */
  readonly waiting: number;
  /** Each reason given, once, in the order first given. */
  readonly reasons: readonly string[];
  /** Each thing the outcomes rest on, once, in the order first named. */
  readonly restsOn: readonly RestData[];
}

/**
 * A strength, in the order from weakest: the word of "A module's summary
 * is the weakest strength among its claims". Refuted is an outcome and
 * no strength; it is the weakest word a summary can give.
 */
export type Strength = "refuted" | "undecided" | "assumed" | "sampled" | "decided";

/** The words of `Strength`, weakest first. */
export const STRENGTHS: readonly Strength[] = ["refuted", "undecided", "assumed", "sampled", "decided"];

/**
 * What the run as a whole rests on, as far as the launcher was given it.
 * The decision "A result names everything it rests on" also names the
 * loader, the parser and the target. Those are not named here yet.
 */
export interface RunRestsOn {
  /** The kernel's `variant`. */
  readonly kernel: string;
  /** The pure primitives the loaded records name, each once, by hash and name, in the order the records name them. */
  readonly primitives: ReadonlyArray<{ readonly hash: string; readonly name: string }>;
  /** The identity of each imported module and then of the module run, in the order loaded. A record of the first version makes no module and is not listed. */
  readonly modules: readonly string[];
  /** The capabilities the module run declares, which the ceiling grants, by name, in the order declared. */
  readonly capabilities: readonly string[];
  /** The builder the configuration accepts stored outcomes from (`restoreAs`), where it names one. */
  readonly builder?: string;
  /**
   * For each setting of the configuration that has a value, the source
   * that supplied it, in the order of the settings: `steps`, one entry
   * `inputs.<name>` for each input, `later`, `ceiling`, `restore`,
   * `kernel`. It is the caller's list (`Launch.sources`), as given, and
   * is absent where the caller gives none.
   */
  readonly configuration?: readonly ConfigurationSource[];
}

/**
 * What a run found: its claims, its summary and what it rests on. It is
 * plain data a tool reads: every field is a string, a number, or a list
 * or record of those, and no handle of the kernel is in it.
 */
export interface LaunchResult {
  /** One entry for each claim as written, in the order the run first reported it. */
  readonly claims: readonly ClaimResult[];
  /** The weakest strength among the claims (`summaryOf`). */
  readonly summary: Strength;
  readonly restsOn: RunRestsOn;
}

/** One phase applied, and the result as it stood when the phase was over. */
export interface PhaseOutcome {
  /** The phase's name (`Phase.name`). */
  readonly name: string;
  /** The number of lines printed before the phase was applied. */
  readonly linesBefore: number;
  /**
   * The result as it stood when the phase was over: just before the next
   * phase was applied, or at the end. The last phase's is the outcome's
   * `result`.
   */
  readonly result: LaunchResult;
}

export interface LaunchOutcome {
  /** The lines printed, in order. */
  readonly lines: string[];
  /**
   * For each later phase applied, in order, the number of lines printed
   * before it was applied. Empty when none was.
   */
  readonly linesBeforePhase: number[];
  readonly end: LaunchEnd;
  /** What the run found. Present for every end but `refused`, where nothing was evaluated. */
  readonly result?: LaunchResult;
  /**
   * One entry for each phase applied, in order. Present for every end but
   * `refused`; empty where the launch ended before the first phase was
   * applied.
   */
  readonly phases?: readonly PhaseOutcome[];
}

function refused(lines: string[], reason: string, findings: readonly string[] = []): LaunchOutcome {
  return { lines, linesBeforePhase: [], end: { kind: "refused", reason, findings } };
}

/**
 * The weakest strength among the claims. A claim with any refuted
 * evaluation is refuted. Else one with any undecided evaluation, or one
 * that still waits, is undecided. Else one with any assumed evaluation is
 * assumed. Else one with any sampled evaluation is sampled. Else it is
 * decided. The count of sampled evaluations is the kernel's
 * (`ClaimRecord.sampled`, since chunk K15 (specialization, and the
 * switch) of the kernel stream).
 *
 * A run with no claim at all is `decided`: nothing in it is weaker. That
 * is a choice the maintainer may change.
 */
export function summaryOf(claims: readonly ClaimResult[]): Strength {
  const strengthOf = (c: ClaimResult): Strength =>
    c.refuted > 0 ? "refuted" : c.undecided > 0 || c.waiting > 0 ? "undecided" : c.assumed > 0 ? "assumed" : c.sampled > 0 ? "sampled" : "decided";
  let weakest = STRENGTHS.length - 1;
  for (const c of claims) weakest = Math.min(weakest, STRENGTHS.indexOf(strengthOf(c)));
  return STRENGTHS[weakest];
}

/** A `Rest` as plain data: the kernel's handle left out. */
function restData(rest: Rest): RestData {
  switch (rest.kind) {
    case "kernel":
      return rest.sampled === undefined ? { kind: "kernel", variant: rest.variant } : { kind: "kernel", variant: rest.variant, sampled: rest.sampled };
    case "primitive":
      return { kind: "primitive", hash: rest.hash, name: rest.name };
    case "capability":
      return { kind: "capability", capability: rest.capability, part: rest.part };
    case "builder":
      return { kind: "builder", builder: rest.builder };
    case "assumption":
      return { kind: "assumption", by: rest.by };
    case "limit":
      return { kind: "limit" };
  }
}

/** One claim's records, as they are summed. */
interface Tally {
  at?: string;
  module?: string;
  decided: number;
  sampled: number;
  assumed: number;
  undecided: number;
  refuted: number;
  waiting: number;
  reasons: string[];
  restsOn: RestData[];
  /** The plain data of each thing in `restsOn`, as JSON, so each is listed once. */
  seen: Set<string>;
}

/**
 * Sums the kernel's claim records over a run. Records of one claim are
 * matched by the handle `ClaimRecord.claim`, as the kernel's interface
 * says a host finds a claim. It adds nothing of its own: each count is
 * the sum of the counts the kernel reported, the level the last one.
 */
class ClaimTallies {
  private readonly byClaim = new Map<Value, Tally>();
  constructor(private readonly atOf: (record: ClaimRecord) => string | undefined) {}

  add(records: readonly ClaimRecord[]): void {
    for (const r of records) {
      let t = this.byClaim.get(r.claim);
      if (t === undefined) {
        const at = this.atOf(r);
        t = {
          ...(at === undefined ? {} : { at }),
          ...(r.module === undefined ? {} : { module: r.module }),
          decided: 0, sampled: 0, assumed: 0, undecided: 0, refuted: 0, waiting: 0, reasons: [], restsOn: [], seen: new Set(),
        };
        this.byClaim.set(r.claim, t);
      }
      t.decided += r.decided;
      t.sampled += r.sampled;
      t.assumed += r.assumed;
      t.undecided += r.undecided;
      t.refuted += r.refuted;
      t.waiting = r.waiting;
      for (const reason of r.reasons) if (!t.reasons.includes(reason)) t.reasons.push(reason);
      for (const rest of r.restsOn) {
        const data = restData(rest);
        const key = JSON.stringify(data);
        if (!t.seen.has(key)) {
          t.seen.add(key);
          t.restsOn.push(data);
        }
      }
    }
  }

  claims(): ClaimResult[] {
    return [...this.byClaim.values()].map(({ seen: _, ...t }) => ({ ...t, reasons: [...t.reasons], restsOn: [...t.restsOn] }));
  }
}

/** What a record declares of each parameter, as the kernel takes it. */
function declarationsOf(doc: SavedProgram): Declaration[] {
  return doc.declares.map((d) => (d.identity === undefined ? { role: d.role, name: d.name } : { role: d.role, name: d.name, identity: d.identity }));
}

/**
 * Plain data as a value of the kernel. A symbol is a symbol as data
 * (`symbolData`), never a name to look up, since an input handed as an
 * argument is not filled and so is not made data by `fill`. A key stays
 * the symbol itself, as a structure's keys are.
 */
export function plainValue(kernel: Kernel, plain: Plain): Value {
  if ("bits" in plain) return kernel.bits(plain.bits, plain.bitLength);
  if ("symbol" in plain) return kernel.symbolData(plain.symbol);
  return kernel.structure(plain.entries.map(([k, v]) => [k === null ? null : plainKey(kernel, k), plainValue(kernel, v)] as const));
}
function plainKey(kernel: Kernel, plain: Plain): Value {
  return "symbol" in plain ? kernel.symbol(plain.symbol) : plainValue(kernel, plain);
}

/** The names a phase's inputs give, own keys only. */
const namesOf = (inputs: Inputs | undefined): string[] => (inputs === undefined ? [] : Object.keys(inputs));

/** Runs one saved program as "Startup, step by step" has it, as far as milestone 2 needs, with the inputs of the module being run. */
export async function launch(request: Launch): Promise<LaunchOutcome> {
  const { configuration, target } = request;
  const lines: string[] = [];
  const linesBeforePhase: number[] = [];
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

  // Step 3, the records alone: nothing reaches the kernel until each checks.
  const findings = check2(request.program);
  if (findings.length > 0) return refused(lines, "the saved program does not check", findings);
  const program = request.program as SavedProgram;
  const importedDocs = request.imports ?? [];
  const importFindings = importedDocs.flatMap((doc, i) => check2(doc).map((f) => `imported record ${i + 1}: ${f}`));
  if (importFindings.length > 0) return refused(lines, "an imported record does not check", importFindings);
  const imported = importedDocs as readonly SavedProgram[];
  const pure = new Map<string, PrimitiveDeclaration>();
  for (const p of target.primitives ?? []) if (p.purity === "pure") pure.set(p.hash, p);
  const needed = new Map<string, string>();
  for (const doc of [...imported, program]) for (const n of doc.needs) needed.set(n.hash, n.name);
  const missing = [...needed].filter(([hash]) => !pure.has(hash));
  if (missing.length > 0)
    return refused(lines, "the target lacks a primitive the saved program needs", missing.map(([hash, name]) => `the target lacks the primitive ${name} (${hash})`));

  // Step 4, the ceiling against the module's parameters, before any value is made.
  const supplied = new Map(target.capabilities.map((c) => [c.definition.name, c] as const));
  const problems: string[] = [];
  for (const name of configuration.ceiling)
    if (!supplied.has(name)) problems.push(`the ceiling grants ${name}, which this target does not supply`);
  for (const d of program.declares)
    if (d.role === "capability" && !configuration.ceiling.includes(d.name)) problems.push(`the module declares the capability ${d.name}, which the ceiling does not grant`);
  // The phases: those the configuration gives, or else today's shape.
  if (configuration.phases !== undefined && (configuration.inputs !== undefined || configuration.later !== undefined))
    problems.push("the configuration gives phases and also inputs or later: with phases, each phase supplies its own inputs");
  if (configuration.phases !== undefined && configuration.phases.length === 0) problems.push("the configuration gives no phase");
  const phases: readonly Phase[] = configuration.phases ?? [
    { name: "run", capabilities: configuration.ceiling, ...(configuration.inputs === undefined ? {} : { inputs: configuration.inputs }) },
    ...(configuration.later ?? []).map((inputs) => ({ name: "later", capabilities: [], inputs })),
  ];
  // Each capability a phase supplies is of the ceiling, and only the first phase supplies any.
  phases.forEach((phase, i) => {
    for (const name of phase.capabilities) {
      if (!configuration.ceiling.includes(name)) problems.push(`the phase ${phase.name} supplies the capability ${name}, which the ceiling does not grant`);
      if (i > 0)
        problems.push(`the phase ${phase.name} supplies the capability ${name} after the first phase: the kernel fills a cell with plain data only, so a capability is supplied by the first phase or by none`);
    }
  });
  // The inputs, by declared name: each declared, and each supplied once.
  const declaredInputs = new Set(program.declares.filter((d) => d.role === "input").map((d) => d.name));
  const suppliedIn = new Map<string, number>();
  phases.map((p) => p.inputs).forEach((inputs, phase) => {
    for (const name of namesOf(inputs)) {
      const where = phase === 0 ? "at the start" : `in later phase ${phase}`;
      if (!declaredInputs.has(name)) problems.push(`the configuration supplies the input ${name} ${where}, which the module does not declare`);
      const first = suppliedIn.get(name);
      if (first !== undefined) problems.push(`the configuration supplies the input ${name} ${first === 0 ? "at the start" : `in later phase ${first}`} and again ${where}`);
      else suppliedIn.set(name, phase);
    }
  });
  if (problems.length > 0) return refused(lines, problems[0], problems);

  // Step 7's result: the claims the kernel reports, summed, and what the run rests on.
  const modules = new Map<string, { readonly fn: Value; readonly declares: readonly Declaration[] }>();
  const tallies = new ClaimTallies((record) => {
    const within = record.module === undefined ? undefined : modules.get(record.module);
    if (within === undefined) return undefined;
    try {
      return kernel.claimKey(record.claim, within.fn, [], within.declares);
    } catch (e) {
      if (e instanceof InterfaceError) return undefined;
      throw e;
    }
  });
  const result = (): LaunchResult => {
    const claims = tallies.claims();
    const builder = configuration.restoreAs === undefined ? {} : { builder: configuration.restoreAs };
    const sources = request.sources === undefined ? {} : { configuration: request.sources.map((s) => ({ setting: s.setting, source: s.source })) };
    return {
      claims,
      summary: summaryOf(claims),
      restsOn: {
        kernel: kernel.variant,
        primitives: [...needed].map(([hash, name]) => ({ hash, name })),
        modules: [...modules.keys()],
        capabilities: program.declares.filter((d) => d.role === "capability").map((d) => d.name),
        ...builder,
        ...sources,
      },
    };
  };
  // Each phase applied, with the lines printed before it, and the result as it stood when it was over.
  const applied: Array<{ readonly name: string; readonly linesBefore: number }> = [];
  const over: LaunchResult[] = [];
  const ended = (end: LaunchEnd): LaunchOutcome => {
    const last = result();
    return { lines, linesBeforePhase, end, result: last, phases: applied.map((p, i) => ({ ...p, result: i < over.length ? over[i] : last })) };
  };

  try {
    // Step 3, loading: the pure primitives every record needs, then each imported record, in order, then the saved program.
    const primitives = new Map<string, Value>();
    for (const hash of needed.keys()) primitives.set(hash, kernel.primitiveFunction(pure.get(hash)!));
    const options = configuration.restoreAs === undefined ? {} : { restoreAs: configuration.restoreAs };
    const loaded = new Set<string>();
    for (const [i, doc] of imported.entries()) {
      let fn: Value;
      try {
        fn = load(kernel, doc, primitives, options);
      } catch (e) {
        if (e instanceof KernelFault) throw e;
        return refused(lines, "the kernel refused to load an imported record", [`imported record ${i + 1}: ${e instanceof Error ? e.message : String(e)}`]);
      }
      const identity = kernel.moduleOf(fn);
      if (identity === undefined) return refused(lines, "the kernel refused to load an imported record", [`imported record ${i + 1} is of the first version, which makes no module`]);
      loaded.add(identity);
      modules.set(identity, { fn, declares: declarationsOf(doc) });
    }
    let moduleFn: Value;
    try {
      moduleFn = load(kernel, program, primitives, options);
    } catch (e) {
      if (e instanceof KernelFault) throw e;
      const message = e instanceof Error ? e.message : String(e);
      return refused(lines, "the kernel refused to load the saved program", [message]);
    }
    const identity = kernel.moduleOf(moduleFn);
    if (identity !== undefined) modules.set(identity, { fn: moduleFn, declares: declarationsOf(program) });
    // Every module a record declares is the module of a supplied record, by identity: nothing is evaluated until then.
    const unsupplied: string[] = [];
    [...imported, program].forEach((doc, i) => {
      const which = i < imported.length ? `imported record ${i + 1}` : "the saved program";
      for (const d of doc.declares)
        if (d.role === "module" && (d.identity === undefined || !loaded.has(d.identity)))
          unsupplied.push(
            d.identity === undefined
              ? `${which} imports the module ${d.name} with no identity declared`
              : `${which} imports the module ${d.name} with the identity ${d.identity}, which no supplied record has`,
          );
    });
    if (unsupplied.length > 0) return refused(lines, unsupplied[0], unsupplied);

    // Step 4: the capabilities of the ceiling, each a structure of its parts keyed by the symbols of their names.
    const granted = new Map<string, Value>();
    for (const name of configuration.ceiling) {
      const implementation = supplied.get(name)!;
      const parts = implementation.create(host);
      if (parts.length !== implementation.definition.parts.length || parts.some((p) => p.purity !== "effectful"))
        return ended({ kind: "fault", reason: `the capability ${name} did not make one effectful primitive for each of its parts` });
      const names = implementation.definition.parts;
      granted.set(name, kernel.structure(parts.map((p, i) => [kernel.symbol(names[i]), kernel.primitiveFunction(p)] as const)));
    }
    // Each capability: the one the first phase supplies, or else a fresh cell that nothing fills.
    // Each input: the plain data the first phase supplies, or else a fresh cell that a later phase may fill.
    const capabilityCells = new Map<string, Cell>();
    const inputCells = new Map<string, Cell>();
    const atStart = phases[0].inputs ?? {};
    // One argument for each capability and input, in order; none for an import, which the kernel supplies.
    const args = program.declares.filter((d) => d.role !== "module").map((d) => {
      if (d.role !== "input") {
        if (phases[0].capabilities.includes(d.name)) return granted.get(d.name)!;
        const cell = kernel.cell();
        capabilityCells.set(d.name, cell);
        return cell;
      }
      if (Object.hasOwn(atStart, d.name)) return plainValue(kernel, atStart[d.name]);
      const cell = kernel.cell();
      inputCells.set(d.name, cell);
      return cell;
    });

    // Step 5: instantiate the module, under the budget. The budget is the
    // evaluation's: the kernel counts the work every later call does for it.
    const budget = configuration.steps;
    applied.push({ name: phases[0].name, linesBefore: 0 });
    const evaluated = kernel.evaluate(kernel.expression(moduleFn, args), budget === undefined ? {} : { steps: budget });
    tallies.add(evaluated.claims);
    let steps = evaluated.steps;
    // A kernel may end at a limit of its own with no budget set (its stack runs out).
    const atLimit = (): LaunchOutcome =>
      ended({ kind: "limit", steps, reason: budget === undefined ? "the kernel reached its own limit; no step budget was set" : `the step budget of ${budget} ran out` });
    const refutedEnd = (values: readonly Value[]): LaunchOutcome => {
      const reasons = values.map((v) => kernel.reasonOf(v) ?? "the kernel gives no reason for this refutation");
      return ended({ kind: "refuted", steps, reason: reasons.join("; "), reasons });
    };
    if (evaluated.refuted) return refutedEnd([evaluated.value]);
    if (evaluated.ended === "limit") return atLimit();
    // A fill that holds evaluates nothing, and its claims are summed like any call's.
    const fill = (cell: Cell, value: Value): void => {
      const held: Advance = kernel.fill(cell, value, { hold: true });
      tallies.add(held.claims);
    };

    // Step 6: deliver the values that arrive later, and apply the later phases.
    let nextPhase = 1;
    const advanceOnce = (): LaunchOutcome | undefined => {
      const advanced = kernel.advance();
      tallies.add(advanced.claims);
      steps += advanced.steps;
      if (advanced.refuted.length > 0) return refutedEnd(advanced.refuted);
      // The launch is one evaluation: named in `limited`, its budget is spent and it is over.
      if (advanced.ended === "limit" || (advanced.limited?.length ?? 0) > 0) return atLimit();
      return undefined;
    };
    for (;;) {
      if (capabilityFault !== null) return ended({ kind: "fault", reason: capabilityFault });
      const waiting = kernel.waiting();
      if (waiting.length === 0) break;
      let filled = 0;
      for (const [cell, plain] of arrived) {
        if (!kernel.filled(cell)) {
          fill(cell, plainValue(kernel, plain));
          filled++;
        }
        arrived.delete(cell);
        answers.delete(cell);
      }
      if (filled > 0) {
        const stop = advanceOnce();
        if (stop !== undefined) return stop;
        continue;
      }
      const due = waiting.filter((c) => answers.has(c)).map((c) => answers.get(c)!);
      if (due.length > 0) {
        await Promise.race(due);
        continue;
      }
      // The kernel waits and no capability's answer is due: the next later phase, if there is one.
      if (nextPhase < phases.length) {
        over.push(result());
        linesBeforePhase.push(lines.length);
        const phase = phases[nextPhase++];
        applied.push({ name: phase.name, linesBefore: lines.length });
        const inputs = phase.inputs ?? {};
        for (const name of namesOf(inputs)) {
          const cell = inputCells.get(name)!;
          fill(cell, plainValue(kernel, inputs[name]));
          inputCells.delete(name);
        }
        const stop = advanceOnce();
        if (stop !== undefined) return stop;
        continue;
      }
      // The cells of inputs and of capabilities no phase supplied are named by the declared name.
      const supplier = new Set<Value>([...inputCells.values(), ...capabilityCells.values()]);
      const inputs = [...inputCells.keys()].filter((name) => waiting.includes(inputCells.get(name)!));
      const capabilities = [...capabilityCells.keys()].filter((name) => waiting.includes(capabilityCells.get(name)!));
      const unanswered = waiting.filter((c) => !supplier.has(c)).length;
      const parts = [
        ...(unanswered > 0 ? [`${unanswered} cell(s) that no capability will answer`] : []),
        ...(inputs.length > 0 ? [`the input(s) ${inputs.join(", ")}, which the configuration does not supply`] : []),
        ...(capabilities.length > 0 ? [`the capability(ies) ${capabilities.join(", ")}, which no phase supplies`] : []),
      ];
      return ended({
        kind: "waiting",
        steps,
        reason: `the program waits on ${parts.join(" and on ")}`,
        unanswered,
        inputs,
        ...(configuration.phases === undefined ? {} : { capabilities }),
      });
    }

    // Step 7.
    return ended({ kind: "completed", steps });
  } catch (e) {
    return ended({ kind: "fault", reason: e instanceof Error ? e.message : String(e) });
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
