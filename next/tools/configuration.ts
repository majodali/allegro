// A configuration from its sources (B-196 (the rebuild's acceptance side),
// chunk Q13 (check and run as configurations, and what a result holds),
// part 2, docs/plans/rebuild-acceptance.md §5; part 3, for the setting
// `phases`; chunk Q16 (the capabilities the launchers ship), part 3, for
// the check capabilities). It closes B-059 (the project root file) as far
// as this part goes.
//
// What it realises, from docs/plans/book-pass-inventory.md:
//   "Configuration is all the information that determines an execution",
//    as far as the settings below go
//   "Configuration sources have a priority, and a result says which
//    supplied each value": the four sources in their order, the rules of
//    which source may set what, and the source of each value
//   "A result names everything it rests on": the configuration and its
//    sources, which the launcher puts in the result
//   "The platform ships three phases: check, run and export", as far as
//    check alone and run alone: the setting `phases` (`shapeOf`). Check
//    then run is not built yet: a later phase cannot supply a capability,
//    since the kernel fills a cell with plain data only. Export is not
//    built. The decision has check evaluate "with no capability but the
//    loader's"; the maintainer's words of 2026-11-21 give it the check
//    capabilities too (`CHECK_CAPABILITIES`). The decision's wording is
//    the kernel stream's to amend
// "A full configuration is a model, evaluated in a first phase" is a design
// to prove and is not built: the configuration here is in host form.
//
// The settings, by the name a source uses for each (`SETTINGS`):
//   steps    the step budget, a whole number. No source sets it by
//            default: where none does, there is no budget;
//   inputs   a record from an input's name to its value, plain data;
//   later    a list of such records, one for each later phase;
//   ceiling  the names of the capabilities granted;
//   restore  the builder whose stored outcomes are accepted;
//   kernel   the kernel variant's name;
//   phases   the shipped phases to apply, in order (`PHASE_VALUES`):
//            `run` alone or `check` alone. Check supplies the check
//            capabilities of the ceiling (`CHECK_CAPABILITIES`), no other
//            capability and no input. Run supplies every capability of
//            the ceiling and the inputs, and each entry of `later` is a
//            further phase after it. Where no source sets it, it is `run` alone, which
//            is what happens without it. `check, run` is a finding of its
//            own, since it is not built yet.
//
// The sources, highest first (`SOURCES`): the command line, the project's
// file, the environment, what is built into the launcher. A setting is
// taken whole from the highest source that sets it. `inputs` is merged by
// input name: each input comes from the highest source that supplies it.
// Which source may set what is one table (`MAY_SET`). A setting found in a
// source that may not set it is a finding that names the setting and the
// source, and the configuration is refused; it is never dropped. A ceiling
// from a source other than the launcher may only narrow the launcher's
// ceiling, where the launcher gives one.
//
// The project's file is `allegro.json` (`PROJECT_FILE`), in the directory
// of the text being run: a JSON object whose keys are setting names.
// `inputs` and `later` hold each value as an Allegretto literal written as
// a JSON string, read by `readLiteral` of next/bootstrap/literal.ts
// (`readProjectFile`). The environment gives one setting:
// `ALLEGRO_STEPS`, a whole number (`readEnvironment`). The variable
// `ALLEGRO_KERNEL` is read by next/kernel/create.ts and not here.
//
// It is host-neutral: it reads no file, no environment and no argument
// list. The terminal's entries (next/launch/terminal.ts and
// next/launch/allegretto.ts) read those and hand them in as data. The
// launcher (next/launch/launcher.ts) does not resolve: it takes the
// resolved configuration and the list of sources as given.
//
// Tested by next/tools/configuration.test.ts.

import { readLiteral } from "../bootstrap/literal.js";
import type { Configuration, ConfigurationSource, Inputs, Plain, SourceName } from "../launch/launcher.js";

/** The settings, in the order a result lists them. */
export const SETTINGS = ["steps", "inputs", "later", "ceiling", "restore", "kernel", "phases"] as const;
export type Setting = (typeof SETTINGS)[number];

/** The sources, highest first. */
export const SOURCES: readonly SourceName[] = ["command line", "file", "environment", "launcher"];

/** Which sources may set each setting: the one table the resolver holds. */
export const MAY_SET: Readonly<Record<Setting, readonly SourceName[]>> = {
  steps: SOURCES,
  inputs: SOURCES,
  later: SOURCES,
  ceiling: ["command line", "launcher"],
  restore: ["command line", "launcher"],
  kernel: ["command line", "launcher"],
  phases: SOURCES,
};

/** The shipped phases, by the name the setting `phases` uses. */
export type ShippedPhase = "check" | "run";

/** The values of the setting `phases` that are built, each a list of shipped phases in order. */
export const PHASE_VALUES: ReadonlyArray<readonly ShippedPhase[]> = [["run"], ["check"]];

/**
 * The check capabilities: those check supplies where the ceiling grants
 * them. A check capability gives a program nothing and performs no effect
 * the program can see, so leaving its calls out changes nothing checking
 * or running computes (the maintainer, 2026-11-21). Today it is the
 * check-output capability alone, `report` (next/launch/report.ts).
 */
export const CHECK_CAPABILITIES: readonly string[] = ["report"];

/** The name of the project's file, in the directory of the text being run. */
export const PROJECT_FILE = "allegro.json";

/** What one source sets, as data. A setting it does not set is absent. */
export interface Settings {
  readonly steps?: number;
  readonly inputs?: Inputs;
  readonly later?: readonly Inputs[];
  readonly ceiling?: readonly string[];
  readonly restore?: string;
  readonly kernel?: string;
  /** The phases to apply, by name, in order. */
  readonly phases?: readonly string[];
}

/** The four sources, as data, by name. A source that sets nothing may be left out. */
export type Sources = Partial<Readonly<Record<SourceName, Settings>>>;

export type Resolved =
  | {
      readonly ok: true;
      /** The launcher's configuration. A ceiling no source sets grants nothing. */
      readonly configuration: Configuration;
      /** The kernel variant's name, where a source sets it. The launcher's `Configuration` has no place for it. */
      readonly kernel?: string;
      /** For each setting that has a value, the source that supplied it, in the order of `SETTINGS`; `inputs` gives one entry for each input, `inputs.<name>`. */
      readonly sources: readonly ConfigurationSource[];
    }
  | { readonly ok: false; readonly findings: readonly string[] };

/** A source, as a finding names it. */
const PHRASE: Readonly<Record<SourceName, string>> = {
  "command line": "the command line",
  file: `the project's file ${PROJECT_FILE}`,
  environment: "the environment",
  launcher: "the launcher",
};

/** A value of the setting `phases`, as a finding names it. */
const phaseList = (names: readonly string[]): string => names.join(", ");

/**
 * What the setting `phases` makes of the configuration: the inputs and
 * later phases of today's shape for `run` alone, and the launcher's
 * `phases` for `check` alone, one phase that supplies the check
 * capabilities `ceiling` grants, in the order of `CHECK_CAPABILITIES`, no
 * other capability and no input. `ceiling` is the configuration's; none
 * grants nothing. `check, run` is a finding of its own: a later phase
 * cannot supply a capability, since the kernel fills a cell with plain
 * data only. Any other value that is not built, and `later` with `check`
 * alone, are findings. Gives findings only, never a partial shape.
 */
export function shapeOf(
  phases: readonly string[] | undefined,
  inputs?: Inputs,
  later?: readonly Inputs[],
  ceiling: readonly string[] = [],
): { readonly ok: true; readonly shape: Pick<Configuration, "inputs" | "later" | "phases"> } | { readonly ok: false; readonly findings: readonly string[] } {
  const names = phases ?? ["run"];
  if (names.length === 2 && names[0] === "check" && names[1] === "run")
    return { ok: false, findings: ['the setting phases is "check, run", which is not built yet: a later phase cannot supply a capability, since the kernel fills a cell with plain data only'] };
  if (!PHASE_VALUES.some((v) => v.length === names.length && v.every((n, i) => n === names[i])))
    return { ok: false, findings: [`the setting phases is ${JSON.stringify(phaseList(names))}, which is not built: the values built are ${PHASE_VALUES.map((v) => JSON.stringify(phaseList(v))).join(", ")}`] };
  if (!names.includes("run")) {
    if (later !== undefined && later.length > 0) return { ok: false, findings: [`the setting later is given with the phases "check" alone: each later phase follows run, and check supplies no input`] };
    return { ok: true, shape: { phases: [{ name: "check", capabilities: CHECK_CAPABILITIES.filter((c) => ceiling.includes(c)) }] } };
  }
  return { ok: true, shape: { ...(inputs === undefined ? {} : { inputs }), ...(later === undefined ? {} : { later }) } };
}

const or = (names: readonly string[]): string => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/**
 * Resolves the configuration from its four sources, or gives the findings.
 * It reads nothing itself: each source is handed in as data.
 */
export function resolve(sources: Sources): Resolved {
  const findings: string[] = [];
  for (const source of SOURCES) {
    const settings = sources[source];
    if (settings === undefined) continue;
    for (const setting of SETTINGS)
      if (settings[setting] !== undefined && !MAY_SET[setting].includes(source))
        findings.push(`the setting ${setting} is set by ${PHRASE[source]}, which may not set it: only ${or(MAY_SET[setting].map((s) => PHRASE[s]))} may`);
  }
  const launcherCeiling = sources.launcher?.ceiling;
  if (launcherCeiling !== undefined)
    for (const source of SOURCES) {
      if (source === "launcher" || !MAY_SET.ceiling.includes(source)) continue;
      for (const name of sources[source]?.ceiling ?? [])
        if (!launcherCeiling.includes(name))
          findings.push(`the ceiling of ${PHRASE[source]} grants ${name}, which the launcher's ceiling does not grant: a ceiling may only narrow the launcher's`);
    }
  if (findings.length > 0) return { ok: false, findings };

  // Each setting from the highest source that sets it; `inputs` by input name.
  const from = <K extends Setting>(setting: K): { value: NonNullable<Settings[K]>; source: SourceName } | undefined => {
    for (const source of SOURCES) {
      const value = sources[source]?.[setting];
      if (value !== undefined) return { value: value as NonNullable<Settings[K]>, source };
    }
    return undefined;
  };
  const inputs: Record<string, Plain> = {};
  const inputSources: ConfigurationSource[] = [];
  for (const source of SOURCES)
    for (const [name, value] of Object.entries(sources[source]?.inputs ?? {}))
      if (!Object.hasOwn(inputs, name)) {
        inputs[name] = value;
        inputSources.push({ setting: `inputs.${name}`, source });
      }
  const steps = from("steps");
  const later = from("later");
  const ceiling = from("ceiling");
  const restore = from("restore");
  const kernel = from("kernel");
  const phases = from("phases");
  const shape = shapeOf(phases?.value, inputSources.length === 0 ? undefined : inputs, later?.value, ceiling?.value ?? []);
  if (!shape.ok) return { ok: false, findings: shape.findings };
  const configuration: Configuration = {
    ceiling: ceiling?.value ?? [],
    ...(steps === undefined ? {} : { steps: steps.value }),
    ...(restore === undefined ? {} : { restoreAs: restore.value }),
    ...shape.shape,
  };
  const entry = (setting: Setting, found: { source: SourceName } | undefined): ConfigurationSource[] => (found === undefined ? [] : [{ setting, source: found.source }]);
  return {
    ok: true,
    configuration,
    ...(kernel === undefined ? {} : { kernel: kernel.value }),
    sources: [
      ...entry("steps", steps),
      ...inputSources,
      ...entry("later", later),
      ...entry("ceiling", ceiling),
      ...entry("restore", restore),
      ...entry("kernel", kernel),
      ...entry("phases", phases),
    ],
  };
}

export type SourceRead = { readonly ok: true; readonly settings: Settings } | { readonly ok: false; readonly findings: readonly string[] };

const INPUT_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const isRecord = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null && !Array.isArray(v);
const isWhole = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;

/**
 * Reads the text of the project's file as settings, or gives the findings,
 * each starting with `file`, the name the caller gives it. An unknown key,
 * a value of the wrong shape, JSON that does not parse and a literal that
 * does not read are each a finding. A setting the file may not set is read
 * here and refused by `resolve`.
 */
export function readProjectFile(file: string, text: string): SourceRead {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, findings: [`${file}: the file is not JSON: ${e instanceof Error ? e.message : String(e)}`] };
  }
  if (!isRecord(parsed)) return { ok: false, findings: [`${file}: the file is not a JSON object whose keys are setting names`] };
  const findings: string[] = [];
  const settings: { -readonly [K in keyof Settings]: Settings[K] } = {};
  const inputsOf = (where: string, v: unknown): Inputs | undefined => {
    if (!isRecord(v)) {
      findings.push(`${file}: ${where} is not an object from an input's name to a literal written as a JSON string`);
      return undefined;
    }
    const inputs: Record<string, Plain> = {};
    for (const [name, literal] of Object.entries(v)) {
      if (!INPUT_NAME.test(name)) findings.push(`${file}: ${where}: ${JSON.stringify(name)} is not an input's name`);
      else if (typeof literal !== "string") findings.push(`${file}: ${where}.${name} is not a literal written as a JSON string`);
      else {
        const r = readLiteral(literal);
        if (r.ok) inputs[name] = r.value;
        else findings.push(`${file}: ${where}.${name}: ${r.finding}`);
      }
    }
    return inputs;
  };
  for (const [key, v] of Object.entries(parsed)) {
    switch (key) {
      case "steps":
        if (isWhole(v)) settings.steps = v;
        else findings.push(`${file}: steps is not a whole number`);
        break;
      case "inputs": {
        const inputs = inputsOf("inputs", v);
        if (inputs !== undefined) settings.inputs = inputs;
        break;
      }
      case "later":
        if (!Array.isArray(v)) findings.push(`${file}: later is not a list of objects, one for each later phase`);
        else settings.later = v.map((phase, i) => inputsOf(`later[${i}]`, phase) ?? {});
        break;
      case "ceiling":
        if (Array.isArray(v) && v.every((n) => typeof n === "string")) settings.ceiling = v as string[];
        else findings.push(`${file}: ceiling is not a list of capability names`);
        break;
      case "phases":
        if (Array.isArray(v) && v.every((n) => typeof n === "string")) settings.phases = v as string[];
        else findings.push(`${file}: phases is not a list of phase names`);
        break;
      case "restore":
      case "kernel":
        if (typeof v === "string") settings[key] = v;
        else findings.push(`${file}: ${key} is not a name`);
        break;
      default:
        findings.push(`${file}: ${JSON.stringify(key)} is not a setting; the settings are ${SETTINGS.join(", ")}`);
    }
  }
  return findings.length > 0 ? { ok: false, findings } : { ok: true, settings };
}

/** The variable of the environment that sets the step budget. */
export const STEPS_VARIABLE = "ALLEGRO_STEPS";

/**
 * Reads the environment's settings from its variables, handed in as data.
 * It reads one: `ALLEGRO_STEPS`, a whole number. An empty variable is
 * unset. A value that is not a whole number is a finding.
 */
export function readEnvironment(variables: Readonly<Record<string, string | undefined>>): SourceRead {
  const steps = variables[STEPS_VARIABLE];
  if (steps === undefined || steps === "") return { ok: true, settings: {} };
  if (!/^[0-9]+$/.test(steps) || !Number.isSafeInteger(Number(steps))) return { ok: false, findings: [`the environment's ${STEPS_VARIABLE} is not a whole number: ${JSON.stringify(steps)}`] };
  return { ok: true, settings: { steps: Number(steps) } };
}
