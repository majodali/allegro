// The minimal launcher (B-196 (the rebuild's acceptance side), chunk Q7
// (the minimal launcher), parts 1 to 4, docs/plans/rebuild-acceptance.md §5;
// chunk Q5 (the first notation and the bootstrap), part 3, for the
// capability as a structure of its parts). Part 4 loads the records of
// imported modules. Chunk Q13 (check and run as configurations, and what a
// result holds), part 1, adds the result: what the run found; part 2 adds
// to it the source of each value of the configuration; part 3 makes a
// launch apply a sequence of phases, each supplying capabilities and
// inputs; part 5 makes the first phase a check where it is one, and a run
// after it; part 6 adds the test phase: the tests of a module, each called
// by its own evaluation, and their outcomes in the launch's; part 7 makes
// the check evaluations the launcher makes with `speculative`, and hands
// the choice of what it goes into, and what it found, to the checks
// (next/launch/checks.ts).
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
//    built. After a check the phases are rerun, by the note of 2026-11-18:
//    the run is a fresh evaluation of the module function in the same
//    kernel
//   "Check reaches every claim": a check evaluates the module function,
//    applied to its capabilities and inputs, with `speculative`, and then
//    what the checks choose of what it left untouched, and sums the claims
//    the kernel reports, decided, refuted or waiting, in two lists. A
//    check leaves every input unknown (the maintainer, 2026-11-21)
//   "A phase leaves a capability out as not yet given or as not needed":
//    a check hands the capabilities it names as not needed and every
//    other declared capability as not yet given
//   "A result names everything it rests on", as far as this part goes,
//   "A tool reads a phase's result and adds no analysis of its own" and
//   "A module's summary is the weakest strength among its claims": the
//    result
//   "A test is a claim, and its result is the claim's record", with the
//    note of 2026-11-23 on the phases of a check: the test phase, ordinary
//    evaluation of a test module and then of each test, each with a result
//    of its own (step 5b)
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
//      order. A declared capability the first phase of the run does not
//      supply is handed as a fresh cell in its place. Nothing shipped uses
//      that path now: run supplies every capability of the ceiling, and a
//      check is evaluated as step 5a says. The ceiling's capabilities go to the main module alone: an
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
//      and has the kernel evaluate it, under the step budget. After a
//      check this is a fresh evaluation of the module function, in the
//      same kernel, with what the first phase after the check supplies,
//      under the budget a run alone has. The budget
//      is given once, to that evaluation, and the kernel counts against
//      it the work every later call does for the evaluation. Where the
//      configuration sets none there is none: the launcher gives no
//      default, and a run goes on as a host program does (the
//      maintainer's ruling of 2026-11-20);
//   5a where the first phase is a check (`Phase.check`), before step 5:
//      builds the same application, with every input a fresh cell, each
//      capability the check names not needed, and every other declared
//      capability a fresh cell, not yet given. A capability not needed is
//      a structure with an entry for each part, each a composed function
//      of as many parameters as the part's primitive takes, whose body is
//      the empty structure: a call on it performs nothing and answers the
//      empty structure, and no part of the capability's implementation is
//      called. The check is evaluations the launcher makes, each by
//      `evaluate` with `speculative`, and nothing is filled or advanced.
//      The first is that application: the program as written. Then, for
//      each thing an evaluation left untouched (`Result.untouched`) that
//      has not been gone into before, by its handle, the launcher asks the
//      checks whether to go into it (`Checks.into` of
//      next/launch/checks.ts, handed in `Launch.checks`), giving it as
//      plain data (`UntouchedData`). What is chosen is evaluated: a
//      function by a call with an unfilled cell for each parameter,
//      anything else by its value. What that leaves untouched is asked
//      about in turn, until nothing chosen is left. The module's own
//      function is never gone into again. With no checks handed, nothing
//      is gone into after the first. Each evaluation has the
//      configuration's budget to itself, or the largest the kernel takes
//      (`Number.MAX_SAFE_INTEGER`) where none is set (the maintainer,
//      2026-11-21). The check's result holds the claims of the first
//      evaluation (`claims`, `summary`) and, apart, those of every
//      evaluation after it (`broader`); the refutations of all of them,
//      each once, among them a part gone into that came out refuted as a
//      whole with no refuted claim, at the part's place; and what was told
//      and not gone into (`untouched`), each once. Then the checks are
//      handed that result and answer the findings (`Checks.findings`),
//      which the result holds (`findings`). The check ends the launch
//      `refuted` where the whole is refuted, a claim of either list has a
//      refuted evaluation, or a refutation is listed; `limit` where an
//      evaluation's budget ran out and nothing was refuted; `findings`
//      where a finding has the level `error`. Otherwise the check is over,
//      and the launch goes on to step 5 with the phases after it, or ends
//      `completed` where there are none. Only the first phase may be a
//      check, and a check names no input. The rule that a phase after the
//      first supplies no capability counts from the first phase that is
//      no check. The launcher hands no message of its own;
//   5b where the first phase that is no check is a test phase
//      (`Phase.test`), in place of steps 6 and 7 for a run: the evaluation
//      of step 5 is the load. It is advanced as a run is, with no later
//      phase. Then each entry of the structure the module yields, keyed by
//      a symbol, is read by an evaluation of its own of the kernel's `get`,
//      as part of the load: an entry is evaluated when it is read, so a
//      binding nothing had read is evaluated then. A test is an entry whose
//      value is a composed function of no parameters (`kind` and
//      `composedFunctionOf`); its name is the entry's key. Where the load
//      did not complete, the phase ends as it ended and no test is called.
//      Otherwise each test is called in order, in the same kernel and of
//      the same module instance, by an evaluation of its own of the
//      function applied to nothing, under the launch's budget, and advanced
//      as a run is until its evaluation is over or nothing more is due. Its
//      claims are summed in fresh tallies. When an evaluation of the phase
//      is over, the answers it asked and has not had are not filled, and
//      what it waited on is not waited for by the next, unless the next's
//      own value is still a residual. The launch ends `completed` where the
//      load and every test completed, and otherwise as the first that did
//      not, the load first (`LaunchOutcome.tests`). The launcher hands no
//      message and adds no word of its own: a test that completed passed,
//      and that is the reader's word (next/launch/test-output.ts). A test
//      phase anywhere else than first or after a check, a phase after it,
//      and a phase that is both a check and a test phase are refused before
//      anything is evaluated;
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
//        matched by the handle `ClaimRecord.claim`. An entry's `key` is the
//        key the kernel gives the claim in its module's function, resting
//        on nothing (`claimKey`), so a reader can tell claims apart. Its
//        `at` is where the claim was written, copied from the kernel's
//        record (`ClaimRecord.at`) where the kernel gives one. The two
//        names are the kernel's;
//      - `summary`, the weakest strength among the claims (`summaryOf`);
//      - `restsOn`, what the run as a whole rests on: the kernel variant,
//        the pure primitives the records name, the modules loaded, the
//        capabilities the module run declares, the builder whose
//        stored outcomes the configuration accepts, and the source of
//        each value of the configuration, as the caller gives it
//        (`Launch.sources`);
//      - `refutations`, the plain data of the kernel's
//        `Result.refutations`, each with its place: only a check gives
//        any;
//      - for a check alone, `broader`, `untouched` and `findings`, as
//        step 5a says.
//      A check's result is its own. The claims of a run after it are
//      summed apart, and the outcome's `result` is the last phase's.
//      Where the check ends the launch nothing was performed, so no line
//      was printed and no request made. The launcher adds no analysis: it
//      hands the kernel one expression, sums what the kernel reports and
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
// Tested by next/launch/launcher.test.ts, on both kernel variants
// (next/launch/kernel-variant.ts).

import type { Advance, Cell, ClaimRecord, CreateKernel, Declaration, Kernel, Place, PrimitiveDeclaration, Rest, Result, Untouched, Value } from "../kernel/interface.js";
import { INTERFACE_VERSION, InterfaceError, KernelFault } from "../kernel/interface.js";
import { check2, load, type SavedProgram } from "../kernel/saved-program.js";
import type { Checks, Finding } from "./checks.js";

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
   * capability's answer is due. The first may be a check (`Phase.check`),
   * and then the run begins with the second. Only the first phase that is
   * no check may supply capabilities: the kernel fills a cell with plain
   * data only. None: one phase that
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
   * True for a check: evaluations the launcher makes with `speculative`,
   * with nothing filled and nothing advanced. The first is the module
   * function applied, the program as written; then each thing an
   * evaluation left untouched that the checks choose (`Launch.checks`).
   * Only the first phase may be a check, and a check names no input: it
   * leaves every input unknown. A capability it names is handed as not
   * needed, and every other declared capability as not yet given.
   */
  readonly check?: true;
  /**
   * True for a test phase: the module, a test module, is loaded by an
   * ordinary evaluation of its function, and then each test is called by
   * its own evaluation (`LaunchOutcome.tests`). A test phase is the first
   * phase, or the second after a check, and no phase follows it: the
   * module tested is a test module, and no run of the program stands with
   * it. It supplies capabilities, and its inputs go to the load.
   */
  readonly test?: true;
  /**
   * The capabilities this phase supplies, each of the ceiling. Only the
   * first phase that is no check may name any: a later one cannot put a
   * capability into a cell, since the kernel fills a cell with plain data
   * only. A check names the capabilities it hands as not needed.
   */
  readonly capabilities: readonly string[];
  /** The inputs this phase supplies, as `Configuration.inputs` holds them. A check supplies none. */
  readonly inputs?: Inputs;
}

/**
 * A source of configuration, highest first: the command line, the
 * project's file, what is built into the launcher. No setting comes from
 * the environment.
 */
export type SourceName = "command line" | "file" | "launcher";

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
  /**
   * What a check goes into beyond the program as written, and what it
   * found (next/launch/checks.ts). None: a check goes into nothing beyond
   * the program as written and has no findings.
   */
  readonly checks?: Checks;
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
  /**
   * A check was not refuted and did not end at its limit, and its findings
   * hold `errors` of level `error`, as many as `reason` gives.
   */
  | { readonly kind: "findings"; readonly steps: number; readonly reason: string; readonly errors: number }
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
  readonly key?: string;
  /**
   * Where the claim was written: the text's name, and the index, line and
   * column of its start and of the point after its end. It is the plain
   * data of the kernel's `ClaimRecord.at`, copied from the first record of
   * the claim that gives one, and absent where none does. The name is the
   * kernel's.
   */
  readonly at?: Place;
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
  /**
   * The refutations the kernel found in parts that do not refute the
   * whole, in the order it gives them: the plain data of the kernel's
   * `Result.refutations`, each with the place of the part where it has
   * one. A refuted claim is not repeated here: it is among `claims`. Only
   * a check gives any; it is empty for a phase that is no check.
   */
  readonly refutations: readonly RefutationData[];
  /**
   * A check's only: the claims of every evaluation after the first, the
   * broader analysis, summed apart from `claims`, and their summary. A
   * claim reached by both is in both.
   */
  readonly broader?: { readonly claims: readonly ClaimResult[]; readonly summary: Strength };
  /**
   * A check's only: what its evaluations told as not gone into, and the
   * check did not go into, each once, in the order first told. The module's
   * own function is left out.
   */
  readonly untouched?: readonly UntouchedData[];
  /** A check's only: what the checks found (`Checks.findings`), as they answered it. */
  readonly findings?: readonly Finding[];
}

/**
 * One thing an evaluation of a check told as not gone into, as plain
 * data: the kernel's `Untouched` with its handle left out. For a function,
 * the count of its parameters and whether a call opened it, in any
 * evaluation that told it. Its place where it has one.
 */
export type UntouchedData =
  | { readonly kind: "function"; readonly parameters: number; readonly called: boolean; readonly at?: Place }
  | { readonly kind: "binding" | "argument" | "entry"; readonly at?: Place };

/** One refutation found in a part that does not refute the whole, as plain data. */
export interface RefutationData {
  readonly reason: string;
  /** Where the part was written, copied from the kernel's `at` where it gives one. */
  readonly at?: Place;
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
   * `result`. A check's result is its own: the claims of the run after it
   * are summed apart and do not hold the check's counts. The phases of
   * the run, which share one evaluation, sum their claims together.
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
  /**
   * Under a test phase: the load's outcome, and each test's, in the order
   * called. Present where the load was started; `tests` is empty where the
   * load did not complete, since no test is then called. The launch's
   * `end` is `completed` where the load and every test completed, and
   * otherwise the end of the first that did not, the load first. The
   * launch's `lines` are the load's and then each test's, in order, and
   * its `result` is the load's.
   */
  readonly tests?: { readonly load: LoadOutcome; readonly tests: readonly TestOutcome[] };
}

/** How the load of a test module ended, the lines it printed, and its result. */
export interface LoadOutcome {
  readonly end: LaunchEnd;
  /** The lines printed while the module was loaded. */
  readonly lines: readonly string[];
  /** The load's result: the claims of the module function's evaluation and of reading its entries. */
  readonly result: LaunchResult;
}

/**
 * One test, called by its own evaluation: its name, how it ended, the
 * lines it printed and its own result, from tallies of its own. A test
 * that completed passed.
 */
export interface TestOutcome extends LoadOutcome {
  /** The test's name: the key of its entry in the structure the module yields, a symbol's name. */
  readonly name: string;
}

function refused(lines: string[], reason: string, findings: readonly string[] = []): LaunchOutcome {
  return { lines, linesBeforePhase: [], end: { kind: "refused", reason, findings } };
}

/**
 * The weakest strength among the claims, each claim's by `claimWord`,
 * where a claim that waits counts as undecided. A claim with any refuted
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
  let weakest = STRENGTHS.length - 1;
  for (const c of claims) {
    const word = claimWord(c);
    weakest = Math.min(weakest, STRENGTHS.indexOf(word === "waiting" ? "undecided" : word));
  }
  return STRENGTHS[weakest];
}

/** A word for one claim: a strength, or `waiting` for a claim that still waits and is neither refuted nor undecided. */
export type ClaimWord = Strength | "waiting";

/** The words of `ClaimWord`, weakest first. */
export const CLAIM_WORDS: readonly ClaimWord[] = ["refuted", "undecided", "waiting", "assumed", "sampled", "decided"];

/**
 * The rule of `summaryOf` for one claim: refuted, then undecided, then
 * waiting, then assumed, then sampled, else decided. The summary counts a
 * claim that waits as undecided; this word keeps it apart, so a reader can
 * tell a claim that waits from one that cannot be told. The one rule both
 * use.
 */
export function claimWord(c: ClaimResult): ClaimWord {
  return c.refuted > 0 ? "refuted" : c.undecided > 0 ? "undecided" : c.waiting > 0 ? "waiting" : c.assumed > 0 ? "assumed" : c.sampled > 0 ? "sampled" : "decided";
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

/** A place as plain data: a copy of the kernel's, field by field. */
function placeData(at: Place): Place {
  return {
    source: at.source,
    start: { index: at.start.index, line: at.start.line, column: at.start.column },
    end: { index: at.end.index, line: at.end.line, column: at.end.column },
  };
}

/** One claim's records, as they are summed. */
interface Tally {
  key?: string;
  at?: Place;
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
  constructor(private readonly keyOf: (record: ClaimRecord) => string | undefined) {}

  add(records: readonly ClaimRecord[]): void {
    for (const r of records) {
      let t = this.byClaim.get(r.claim);
      if (t === undefined) {
        const key = this.keyOf(r);
        t = {
          ...(key === undefined ? {} : { key }),
          ...(r.at === undefined ? {} : { at: placeData(r.at) }),
          ...(r.module === undefined ? {} : { module: r.module }),
          decided: 0, sampled: 0, assumed: 0, undecided: 0, refuted: 0, waiting: 0, reasons: [], restsOn: [], seen: new Set(),
        };
        this.byClaim.set(r.claim, t);
      }
      // The place, from the first record that gives one: the launcher copies what the kernel says and keeps it.
      if (t.at === undefined && r.at !== undefined) t.at = placeData(r.at);
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
  // Under a test phase each evaluation's answers are its own: an answer asked in an
  // evaluation that is over is not filled, and a fault of it is not counted (`forget`).
  let generation = 0;
  const host: CapabilityHost = {
    line(text) {
      lines.push(text);
      request.onLine?.(text);
    },
    later(cell, answer) {
      const asked = generation;
      answers.set(cell, answer.then(
        (plain) => { if (asked === generation) arrived.set(cell, plain); },
        (e) => { if (asked === generation) capabilityFault ??= `a capability's answer failed: ${e instanceof Error ? e.message : String(e)}`; },
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
  // A check is the first phase or none, and supplies no input.
  phases.forEach((phase, i) => {
    if (phase.check !== true) return;
    if (i > 0) problems.push(`the phase ${phase.name} is a check after the first phase: only the first phase may be a check`);
    const named = namesOf(phase.inputs);
    if (named.length > 0) problems.push(`the phase ${phase.name} is a check and supplies the input(s) ${named.join(", ")}: a check supplies no input, and leaves every input unknown`);
  });
  // The check, where the first phase is one, and the phases of the run after it.
  const checkPhase = phases[0]?.check === true ? phases[0] : undefined;
  const runPhases = checkPhase === undefined ? phases : phases.slice(1);
  // A test phase is the first phase that is no check, and the last: no run stands with it.
  phases.forEach((phase, i) => {
    if (phase.test !== true) return;
    if (phase.check === true) problems.push(`the phase ${phase.name} is both a check and a test phase`);
    else if (i !== (checkPhase === undefined ? 0 : 1))
      problems.push(`the phase ${phase.name} is a test phase after a phase that is no check: a test phase is the first phase, or follows a check`);
    if (i < phases.length - 1) problems.push(`the phase ${phases[i + 1].name} follows the test phase ${phase.name}: no phase follows the tests`);
  });
  // Each capability a phase supplies is of the ceiling, and only the first phase that is no check supplies any.
  phases.forEach((phase, i) => {
    for (const name of phase.capabilities) {
      if (!configuration.ceiling.includes(name)) problems.push(`the phase ${phase.name} supplies the capability ${name}, which the ceiling does not grant`);
      if (i > (checkPhase === undefined ? 0 : 1))
        problems.push(`the phase ${phase.name} supplies the capability ${name} after the first phase: the kernel fills a cell with plain data only, so a capability is supplied by the first phase or by none`);
    }
  });
  // The inputs, by declared name: each declared, and each supplied once. Counted in the phases of the run.
  const declaredInputs = new Set(program.declares.filter((d) => d.role === "input").map((d) => d.name));
  const suppliedIn = new Map<string, number>();
  runPhases.map((p) => p.inputs).forEach((inputs, phase) => {
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
  const keyOf = (record: ClaimRecord): string | undefined => {
    const within = record.module === undefined ? undefined : modules.get(record.module);
    if (within === undefined) return undefined;
    try {
      return kernel.claimKey(record.claim, within.fn, [], within.declares);
    } catch (e) {
      if (e instanceof InterfaceError) return undefined;
      throw e;
    }
  };
  // The claims of the phase going on, and the refutations a check found. A check's are summed apart from the run's.
  let tallies = new ClaimTallies(keyOf);
  let refutations: RefutationData[] = [];
  // A check's own fields of the result: the broader analysis, what was not gone into, the findings.
  let checkFields: Pick<LaunchResult, "broader" | "untouched" | "findings"> = {};
  const result = (of: ClaimTallies = tallies): LaunchResult => {
    const claims = of.claims();
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
      refutations: refutations.map((r) => ({ ...r })),
      ...checkFields,
    };
  };
  // Each phase applied, with the lines printed before it, and the result as it stood when it was over.
  const applied: Array<{ readonly name: string; readonly linesBefore: number }> = [];
  const over: LaunchResult[] = [];
  // Under a test phase, the load's outcome and each test's, once the load has started.
  let tested: { load: LoadOutcome; tests: TestOutcome[] } | undefined;
  const ended = (end: LaunchEnd): LaunchOutcome => {
    // Under a test phase the launch's result is the load's.
    const last = tested?.load.result ?? result();
    return {
      lines, linesBeforePhase, end, result: last, phases: applied.map((p, i) => ({ ...p, result: i < over.length ? over[i] : last })),
      ...(tested === undefined ? {} : { tests: { load: tested.load, tests: [...tested.tests] } }),
    };
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
    const arities = new Map<string, readonly number[]>();
    for (const name of configuration.ceiling) {
      const implementation = supplied.get(name)!;
      const parts = implementation.create(host);
      if (parts.length !== implementation.definition.parts.length || parts.some((p) => p.purity !== "effectful"))
        return ended({ kind: "fault", reason: `the capability ${name} did not make one effectful primitive for each of its parts` });
      const names = implementation.definition.parts;
      granted.set(name, kernel.structure(parts.map((p, i) => [kernel.symbol(names[i]), kernel.primitiveFunction(p)] as const)));
      arities.set(name, parts.map((p) => p.arity));
    }
    // A capability handed as not needed: a structure with an entry for each part, each a
    // composed function of as many parameters as the part's primitive takes, whose body is the
    // empty structure. A call on it performs nothing, and the program reads the empty structure.
    const notNeeded = (name: string): Value => {
      const names = supplied.get(name)!.definition.parts;
      const arity = arities.get(name)!;
      return kernel.structure(names.map((part, i) => {
        const params = Array.from({ length: arity[i] }, (_, j) => kernel.param(`${part}.${j + 1}`));
        return [kernel.symbol(part), kernel.composedFunction(params, kernel.structure([]))] as const;
      }));
    };
    // A kernel may end at a limit of its own with no budget set (its stack runs out).
    const budget = configuration.steps;
    const limitReason = budget === undefined ? "the kernel reached its own limit; no step budget was set" : `the step budget of ${budget} ran out`;

    // A check, where the first phase is one: evaluations with `speculative`, nothing filled and
    // nothing advanced. The first is the module function applied to its capabilities and inputs.
    if (checkPhase !== undefined) {
      applied.push({ name: checkPhase.name, linesBefore: 0 });
      // Each input is a cell, so the check leaves it unknown. Each capability the check names is
      // not needed; every other is a cell, not yet given.
      const checkArgs = program.declares.filter((d) => d.role !== "module").map((d) =>
        d.role === "capability" && checkPhase.capabilities.includes(d.name) ? notNeeded(d.name) : kernel.cell());
      // Each evaluation has the launch's budget to itself; with none set, the largest the kernel takes.
      const limits = { steps: budget ?? Number.MAX_SAFE_INTEGER, speculative: true } as const;
      const broader = new ClaimTallies(keyOf);
      const refutationsSeen = new Set<string>();
      const refutation = (r: { readonly reason: string; readonly at?: Place }): void => {
        const data: RefutationData = r.at === undefined ? { reason: r.reason } : { reason: r.reason, at: placeData(r.at) };
        const key = JSON.stringify(data);
        if (refutationsSeen.has(key)) return;
        refutationsSeen.add(key);
        refutations.push(data);
      };
      let spent = 0;
      let atLimit = false;
      const speculate = (expression: Value, into: ClaimTallies): Result => {
        const r = kernel.evaluate(expression, limits);
        spent += r.steps;
        into.add(r.claims);
        if (r.ended === "limit") atLimit = true;
        for (const x of r.refutations ?? []) refutation(x);
        return r;
      };
      // The program as written.
      const checked = speculate(kernel.expression(moduleFn, checkArgs), tallies);
      // What was told and not gone into, by handle, and what was gone into. The module's own function is never gone into again.
      const gone = new Set<Value>([moduleFn]);
      const told = new Map<Value, UntouchedData>();
      const chosen: Untouched[] = [];
      const consider = (list: readonly Untouched[]): void => {
        for (const u of list) {
          if (gone.has(u.value)) continue;
          const before = told.get(u.value);
          const data: UntouchedData = u.kind === "function"
            ? { kind: "function", parameters: u.parameters, called: u.called || (before?.kind === "function" && before.called), ...(u.at === undefined ? {} : { at: placeData(u.at) }) }
            : { kind: u.kind, ...(u.at === undefined ? {} : { at: placeData(u.at) }) };
          told.set(u.value, data);
          // The checks are asked with a copy, so nothing they do reaches the list.
          if (request.checks?.into(structuredClone(data)) === true) {
            gone.add(u.value);
            told.delete(u.value);
            chosen.push(u);
          }
        }
      };
      consider(checked.untouched ?? []);
      // The broader analysis: each thing chosen, a function by a call with an unfilled cell for
      // each parameter, anything else by its value; what that leaves untouched is asked about in turn.
      while (chosen.length > 0) {
        const u = chosen.shift()!;
        const r = speculate(u.kind === "function" ? kernel.expression(u.value, Array.from({ length: u.parameters }, () => kernel.cell())) : u.value, broader);
        // A part refuted as a whole with no refuted claim is a refutation, at the part's place.
        if (r.refuted && !r.claims.some((c) => c.refuted > 0))
          refutation({ reason: kernel.reasonOf(r.value) ?? "the kernel gives no reason for this refutation", ...(u.at === undefined ? {} : { at: u.at }) });
        consider(r.untouched ?? []);
      }
      const broaderClaims = broader.claims();
      checkFields = { broader: { claims: broaderClaims, summary: summaryOf(broaderClaims) }, untouched: [...told.values()] };
      const found = request.checks?.findings(result()) ?? [];
      checkFields = { ...checkFields, findings: [...found] };
      // Refuted where the whole is, where a claim of either list is, or where a part is: each reason once, in the order found.
      const refutedClaims = [...tallies.claims(), ...broaderClaims].filter((c) => c.refuted > 0);
      if (checked.refuted || refutedClaims.length > 0 || refutations.length > 0) {
        const reasons: string[] = [];
        const add = (reason: string): void => {
          if (!reasons.includes(reason)) reasons.push(reason);
        };
        if (checked.refuted) add(kernel.reasonOf(checked.value) ?? "the kernel gives no reason for this refutation");
        for (const c of refutedClaims) for (const reason of c.reasons) add(reason);
        for (const r of refutations) add(r.reason);
        if (reasons.length === 0) add("the kernel gives no reason for this refutation");
        return ended({ kind: "refuted", steps: spent, reason: reasons.join("; "), reasons });
      }
      if (atLimit) return ended({ kind: "limit", steps: spent, reason: limitReason });
      const errors = found.filter((f) => f.level === "error").length;
      if (errors > 0) return ended({ kind: "findings", steps: spent, reason: `the check's findings hold ${errors} error(s)`, errors });
      if (runPhases.length === 0) return ended({ kind: "completed", steps: spent });
      // The check is over. The run after it is a fresh evaluation, and its claims are summed apart.
      over.push(result());
      linesBeforePhase.push(lines.length);
      tallies = new ClaimTallies(keyOf);
      refutations = [];
      checkFields = {};
    }

    // Each capability: the one the first phase of the run supplies, or else a fresh cell that nothing fills.
    // Each input: the plain data that phase supplies, or else a fresh cell that a later phase may fill.
    const capabilityCells = new Map<string, Cell>();
    const inputCells = new Map<string, Cell>();
    const first = runPhases[0];
    const atStart = first.inputs ?? {};
    // One argument for each capability and input, in order; none for an import, which the kernel supplies.
    const args = program.declares.filter((d) => d.role !== "module").map((d) => {
      if (d.role !== "input") {
        if (first.capabilities.includes(d.name)) return granted.get(d.name)!;
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
    applied.push({ name: first.name, linesBefore: lines.length });
    const limits = budget === undefined ? {} : { steps: budget };
    // Cells something waited on when an evaluation of a test phase was over: no later evaluation waits on them.
    const stale = new Set<Value>();

    // Step 6: deliver the values that arrive later, and apply the later phases
    // where `later` is true. How one evaluation ended, its claims summed in `into`.
    const settle = async (evaluated: Result, into: ClaimTallies, later: boolean): Promise<LaunchEnd> => {
      into.add(evaluated.claims);
      let steps = evaluated.steps;
      const atLimit = (): LaunchEnd => ({ kind: "limit", steps, reason: limitReason });
      const refutedEnd = (values: readonly Value[]): LaunchEnd => {
        const reasons = values.map((v) => kernel.reasonOf(v) ?? "the kernel gives no reason for this refutation");
        return { kind: "refuted", steps, reason: reasons.join("; "), reasons };
      };
      if (evaluated.refuted) return refutedEnd([evaluated.value]);
      if (evaluated.ended === "limit") return atLimit();
      // A fill that holds evaluates nothing, and its claims are summed like any call's.
      const fill = (cell: Cell, value: Value): void => {
        const held: Advance = kernel.fill(cell, value, { hold: true });
        into.add(held.claims);
      };
      let nextPhase = 1;
      const advanceOnce = (): LaunchEnd | undefined => {
        const advanced = kernel.advance();
        into.add(advanced.claims);
        steps += advanced.steps;
        if (advanced.refuted.length > 0) return refutedEnd(advanced.refuted);
        // The launch is one evaluation: named in `limited`, its budget is spent and it is over.
        if (advanced.ended === "limit" || (advanced.limited?.length ?? 0) > 0) return atLimit();
        return undefined;
      };
      for (;;) {
        if (capabilityFault !== null) return { kind: "fault", reason: capabilityFault };
        const all = kernel.waiting();
        let waiting: readonly Cell[] = all.filter((c) => !stale.has(c));
        if (waiting.length === 0) {
          // Only cells an evaluation that is over waited on: this one waits on them too where its value is still a residual.
          if (waiting.length === all.length || kernel.kind(kernel.current(evaluated.value)) !== "expression") break;
          waiting = all;
        }
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
        if (later && nextPhase < runPhases.length) {
          over.push(result());
          linesBeforePhase.push(lines.length);
          const phase = runPhases[nextPhase++];
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
        return {
          kind: "waiting",
          steps,
          reason: `the program waits on ${parts.join(" and on ")}`,
          unanswered,
          inputs,
          ...(configuration.phases === undefined ? {} : { capabilities }),
        };
      }
      return { kind: "completed", steps };
    };

    const loadStart = lines.length;
    const evaluated = kernel.evaluate(kernel.expression(moduleFn, args), limits);
    // Step 7, for a run.
    if (first.test !== true) return ended(await settle(evaluated, tallies, true));

    // A test phase. The evaluation of the module function is the load, and reading its
    // entries is part of it: an entry is evaluated when it is read.
    // When one evaluation is over, what it still waited on is no later evaluation's: the answers it
    // asked are not filled, and a later evaluation waits on the cells it waited on only where its
    // own value is still a residual (`settle`).
    const forget = (): void => {
      generation++;
      for (const c of answers.keys()) stale.add(c);
      for (const c of kernel.waiting()) stale.add(c);
      answers.clear();
      arrived.clear();
      capabilityFault = null;
    };
    let loadEnd = await settle(evaluated, tallies, false);
    let loadSteps = loadEnd.kind === "completed" ? loadEnd.steps : 0;
    const found: Array<{ readonly name: string; readonly fn: Value }> = [];
    const yielded = kernel.current(evaluated.value);
    if (loadEnd.kind === "completed" && kernel.kind(yielded) === "structure") {
      for (const [key] of kernel.entriesOf(yielded)) {
        if (key === null || kernel.kind(key) !== "symbol") continue;
        const name = kernel.symbolName(key);
        forget();
        const read = kernel.evaluate(kernel.expression(kernel.kernelPrimitive("get"), [yielded, kernel.symbolData(name)]), limits);
        const readEnd = await settle(read, tallies, false);
        if (readEnd.kind !== "completed") {
          loadEnd = readEnd;
          break;
        }
        loadSteps += readEnd.steps;
        // A test: a composed function of no parameters.
        const value = kernel.current(read.value);
        if (kernel.kind(value) === "composed-function" && kernel.composedFunctionOf(value).params.length === 0) found.push({ name, fn: value });
      }
    }
    if (loadEnd.kind === "completed") loadEnd = { kind: "completed", steps: loadSteps };
    tested = { load: { end: loadEnd, lines: lines.slice(loadStart), result: result() }, tests: [] };
    if (loadEnd.kind !== "completed") return ended(loadEnd);
    // Each test by its own evaluation, in order, of the same module instance, with fresh tallies.
    let steps = loadSteps;
    let end: LaunchEnd | undefined;
    for (const t of found) {
      forget();
      const start = lines.length;
      const own = new ClaimTallies(keyOf);
      const testEnd = await settle(kernel.evaluate(kernel.expression(t.fn, []), limits), own, false);
      tested.tests.push({ name: t.name, end: testEnd, lines: lines.slice(start), result: result(own) });
      if (testEnd.kind === "completed") steps += testEnd.steps;
      else end ??= testEnd;
    }
    forget();
    return ended(end ?? { kind: "completed", steps });
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
