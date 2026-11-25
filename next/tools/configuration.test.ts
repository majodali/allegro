// Tests of a configuration from its sources (B-196 (the rebuild's
// acceptance side), chunk Q13 (check and run as configurations, and what a
// result holds), part 2, part 3 for the setting `phases`, and part 5 for
// check as a check phase and for check then run; chunk Q16
// (the capabilities the launchers ship), part 3, for the check
// capabilities; chunk Q13, part 6, for the test phase): `resolve`,
// `shapeOf` and `readProjectFile` of
// next/tools/configuration.ts, and the result's list
// of sources from the launcher (next/launch/launcher.ts). Run by
// `npm run test:next`, on the kernel `createKernel` of
// next/launch/kernel-variant.ts gives: the variant that keeps its own
// stack, and the reference where next/launch/reference.test.ts loads this
// file. The two commands end to end are
// tested in next/launch/launcher.test.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { createKernel } from "../launch/kernel-variant.js";
import { encode, type SavedProgram } from "../kernel/saved-program.js";
import { emit } from "../bootstrap/emit.js";
import { readLiteral } from "../bootstrap/literal.js";
import { launch, type Inputs, type Plain, type SourceName } from "../launch/launcher.js";
import { output } from "../launch/output.js";
import { shipped } from "../prims/index.js";
import { CHECK_CAPABILITIES, MAY_SET, PHASE_VALUES, PROJECT_FILE, SETTINGS, SOURCES, TEST_PHASE_VALUES, readProjectFile, resolve, shapeOf, type Resolved, type Settings, type Setting, type Sources } from "./configuration.js";

const here = path.dirname(new URL(import.meta.url).pathname);
const text = (t: string): Plain => ({ bits: new TextEncoder().encode(t) });

/** One value of each setting, distinct for each source, so a test can tell which source it came from. */
function valueOf(setting: Setting, source: SourceName): Settings[Setting] {
  const i = SOURCES.indexOf(source);
  switch (setting) {
    case "steps":
      return 1000 + i;
    case "inputs":
      return { n: text(source) } satisfies Inputs;
    case "later":
      return [{ m: text(source) }] satisfies Inputs[];
    case "ceiling":
      return i === SOURCES.length - 1 ? ["output", "timer"] : ["output"];
    case "restore":
      return `builder-${i}`;
    case "kernel":
      return `variant-${i}`;
    case "phases":
      // Three values are built, one for each source.
      return [["check"], ["run"], ["check", "run"]][i];
  }
}
const one = (setting: Setting, source: SourceName): Sources => ({ [source]: { [setting]: valueOf(setting, source) } });

function resolved(r: Resolved): Extract<Resolved, { ok: true }> {
  assert.ok(r.ok, r.ok ? "" : r.findings.join("; "));
  return r;
}
/** The value of a setting as the resolved configuration holds it. */
function valueIn(r: Extract<Resolved, { ok: true }>, setting: Setting): unknown {
  switch (setting) {
    case "steps":
      return r.configuration.steps;
    case "inputs":
      return r.configuration.inputs;
    case "later":
      return r.configuration.later;
    case "ceiling":
      return r.configuration.ceiling;
    case "restore":
      return r.configuration.restoreAs;
    case "kernel":
      return r.kernel;
    case "phases":
      return r.configuration.phases?.map((p) => p.name) ?? ["run"];
  }
}
const sourceOf = (r: Extract<Resolved, { ok: true }>, setting: string) => r.sources.find((s) => s.setting === setting)?.source;
const nameOf = (setting: Setting) => (setting === "inputs" ? "inputs.n" : setting);

test("the table: steps, inputs, later and phases from any source; ceiling, restore and kernel from the command line and the launcher only", () => {
  assert.deepEqual([...SETTINGS], ["steps", "inputs", "later", "ceiling", "restore", "kernel", "phases"]);
  assert.deepEqual([...SOURCES], ["command line", "file", "launcher"]);
  for (const s of ["steps", "inputs", "later", "phases"] as const) assert.deepEqual([...MAY_SET[s]], [...SOURCES]);
  for (const s of ["ceiling", "restore", "kernel"] as const) assert.deepEqual([...MAY_SET[s]], ["command line", "launcher"]);
});

test("each setting is taken from each source that may set it, alone, and the source is named", () => {
  for (const setting of SETTINGS)
    for (const source of MAY_SET[setting]) {
      const r = resolved(resolve(one(setting, source)));
      assert.deepEqual(valueIn(r, setting), valueOf(setting, source), `${setting} from ${source}`);
      assert.deepEqual(r.sources, [{ setting: nameOf(setting), source }], `${setting} from ${source}`);
    }
});

test("a higher source replaces a lower one, for every pair of sources that may both set a setting", () => {
  let pairs = 0;
  for (const setting of SETTINGS) {
    const allowed = MAY_SET[setting];
    for (const [hi, higher] of allowed.entries())
      for (const lower of allowed.slice(hi + 1)) {
        const r = resolved(resolve({ [higher]: { [setting]: valueOf(setting, higher) }, [lower]: { [setting]: valueOf(setting, lower) } }));
        assert.deepEqual(valueIn(r, setting), valueOf(setting, higher), `${setting}: ${higher} over ${lower}`);
        assert.equal(sourceOf(r, nameOf(setting)), higher);
        pairs++;
      }
  }
  assert.equal(pairs, 4 * 3 + 3 * 1);
});

test("a value missing from one source is taken from the next below it", () => {
  const r = resolved(resolve({ "command line": { steps: 5 }, file: { later: [{ m: text("file") }] }, launcher: { ceiling: ["output"] } }));
  assert.deepEqual(r.sources, [
    { setting: "steps", source: "command line" },
    { setting: "later", source: "file" },
    { setting: "ceiling", source: "launcher" },
  ]);
});

test("inputs are merged by input name: each from the highest source that supplies it", () => {
  const r = resolved(resolve({
    "command line": { inputs: { a: text("a from the command line") } },
    file: { inputs: { a: text("a from the file"), b: text("b from the file") } },
    launcher: { inputs: { b: text("b from the launcher"), d: text("d from the launcher") } },
  }));
  assert.deepEqual(r.configuration.inputs, {
    a: text("a from the command line"),
    b: text("b from the file"),
    d: text("d from the launcher"),
  });
  assert.deepEqual(r.sources, [
    { setting: "inputs.a", source: "command line" },
    { setting: "inputs.b", source: "file" },
    { setting: "inputs.d", source: "launcher" },
  ]);
});

test("a setting from a source that may not set it is refused, naming the setting and the source, for each such pair", () => {
  let pairs = 0;
  for (const setting of SETTINGS)
    for (const source of SOURCES.filter((s) => !MAY_SET[setting].includes(s))) {
      const r = resolve({ ...one(setting, source), launcher: { ceiling: ["output", "timer"] } });
      assert.equal(r.ok, false, `${setting} from ${source}`);
      assert.deepEqual(r.ok ? [] : r.findings, [`the setting ${setting} is set by the project's file ${PROJECT_FILE}, which may not set it: only the command line and the launcher may`]);
      pairs++;
    }
  assert.equal(pairs, 3);
  // Beside a source that may set it, the refusal still stands.
  const both = resolve({ "command line": { kernel: "a" }, file: { kernel: "b" } });
  assert.deepEqual(both.ok ? [] : both.findings, [`the setting kernel is set by the project's file ${PROJECT_FILE}, which may not set it: only the command line and the launcher may`]);
});

test("the command line's ceiling narrows the launcher's, and a name the launcher's ceiling does not grant is refused", () => {
  const launcher: Settings = { ceiling: ["output", "timer", "http"] };
  const narrowed = resolved(resolve({ "command line": { ceiling: ["timer"] }, launcher }));
  assert.deepEqual(narrowed.configuration.ceiling, ["timer"]);
  assert.equal(sourceOf(narrowed, "ceiling"), "command line");
  const none = resolved(resolve({ "command line": { ceiling: [] }, launcher }));
  assert.deepEqual(none.configuration.ceiling, []);
  const wider = resolve({ "command line": { ceiling: ["output", "files"] }, launcher });
  assert.deepEqual(wider.ok ? [] : wider.findings, ["the ceiling of the command line grants files, which the launcher's ceiling does not grant: a ceiling may only narrow the launcher's"]);
});

test("no budget where no source sets one", () => {
  const r = resolved(resolve({ file: { inputs: { n: text("x") } }, launcher: { ceiling: ["output"] } }));
  assert.equal(r.configuration.steps, undefined);
  assert.equal(sourceOf(r, "steps"), undefined);
});

test("the environment is no source: the resolver names none, and the module exports nothing that reads it", async () => {
  assert.ok(!(SOURCES as readonly string[]).includes("environment"));
  const exported = Object.keys(await import("./configuration.js"));
  assert.ok(!exported.includes("readEnvironment") && !exported.includes("STEPS_VARIABLE"), exported.join(", "));
});

test("the project's file is read: each setting by its name, inputs and later as literals written as JSON strings", () => {
  const r = readProjectFile("dir/allegro.json", JSON.stringify({ steps: 40, inputs: { a: '"one"', b: "-3" }, later: [{ c: "`sym" }, { d: "[1, 2]" }], ceiling: ["output"], restore: "builder-a", kernel: "machine" }));
  assert.ok(r.ok, r.ok ? "" : r.findings.join("; "));
  const literal = (t: string): Plain => {
    const read = readLiteral(t);
    assert.ok(read.ok);
    return read.value;
  };
  assert.equal(r.settings.steps, 40);
  assert.deepEqual(r.settings.inputs, { a: literal('"one"'), b: literal("-3") });
  assert.deepEqual(r.settings.later, [{ c: { symbol: "sym" } }, { d: literal("[1, 2]") }]);
  assert.deepEqual(r.settings.ceiling, ["output"]);
  assert.equal(r.settings.restore, "builder-a");
  assert.equal(r.settings.kernel, "machine");
  // The ceiling, restore and kernel are read, and refused by the resolver.
  const refused = resolve({ file: r.settings });
  assert.equal(refused.ok ? 0 : refused.findings.length, 3);
});

test("the project file's findings: JSON that does not parse, not an object, an unknown key, a value of the wrong shape, a literal that does not read", () => {
  const findings = (t: string) => {
    const r = readProjectFile("dir/allegro.json", t);
    assert.equal(r.ok, false, t);
    return r.ok ? [] : r.findings;
  };
  assert.match(findings("{ steps: 1 ")[0], /^dir\/allegro\.json: the file is not JSON: /);
  assert.deepEqual(findings("[1]"), ["dir/allegro.json: the file is not a JSON object whose keys are setting names"]);
  assert.deepEqual(findings('{"budget": 3}'), ['dir/allegro.json: "budget" is not a setting; the settings are steps, inputs, later, ceiling, restore, kernel, phases']);
  assert.deepEqual(findings('{"steps": "3"}'), ["dir/allegro.json: steps is not a whole number"]);
  assert.deepEqual(findings('{"steps": -1}'), ["dir/allegro.json: steps is not a whole number"]);
  assert.deepEqual(findings('{"inputs": ["1"]}'), ["dir/allegro.json: inputs is not an object from an input's name to a literal written as a JSON string"]);
  assert.deepEqual(findings('{"inputs": {"n": 1}}'), ["dir/allegro.json: inputs.n is not a literal written as a JSON string"]);
  assert.deepEqual(findings('{"inputs": {"no name": "1"}}'), ['dir/allegro.json: inputs: "no name" is not an input\'s name']);
  assert.deepEqual(findings('{"later": {"n": "1"}}'), ["dir/allegro.json: later is not a list of objects, one for each later phase"]);
  assert.deepEqual(findings('{"later": [{"n": "1"}, 2]}'), ["dir/allegro.json: later[1] is not an object from an input's name to a literal written as a JSON string"]);
  assert.deepEqual(findings('{"ceiling": "output"}'), ["dir/allegro.json: ceiling is not a list of capability names"]);
  assert.deepEqual(findings('{"restore": 1}'), ["dir/allegro.json: restore is not a name"]);
  assert.match(findings('{"inputs": {"n": "x + 1"}}')[0], /^dir\/allegro\.json: inputs\.n: an input's value is a literal/);
  assert.match(findings('{"later": [{"n": "f(1)"}]}')[0], /^dir\/allegro\.json: later\[0\]\.n: an input's value is a literal/);
});

/** The record the emitter writes for an Allegretto text, as JSON round-trips it. */
function emitted(source: string): SavedProgram {
  const r = emit(source);
  assert.ok(r.ok, r.ok ? "" : r.findings.map((f) => f.message).join("; "));
  return JSON.parse(encode(r.program)) as SavedProgram;
}

test("a run's result names the source of each value of its configuration: values from three sources", async () => {
  const file = readProjectFile(PROJECT_FILE, JSON.stringify({ steps: 10000000, inputs: { a: '"from the file"', b: '"replaced"' } }));
  assert.ok(file.ok, file.ok ? "" : file.findings.join("; "));
  const r = resolved(resolve({
    "command line": { inputs: { b: text("from the command line") } },
    file: file.settings,
    launcher: { ceiling: ["output"] },
  }));
  const outcome = await launch({
    createKernel,
    program: emitted("capability output\ninput a\ninput b\noutput.write(a)\noutput.write(b)\n"),
    configuration: r.configuration,
    sources: r.sources,
    target: { capabilities: [output], primitives: shipped },
  });
  assert.deepEqual(outcome.lines, ["from the file", "from the command line"]);
  assert.equal(outcome.end.kind, "completed");
  assert.deepEqual(outcome.result?.restsOn.configuration, [
    { setting: "steps", source: "file" },
    { setting: "inputs.b", source: "command line" },
    { setting: "inputs.a", source: "file" },
    { setting: "ceiling", source: "launcher" },
  ]);
  const result = outcome.result;
  assert.ok(result !== undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result, "the list is plain data");
});

// ── The setting phases (chunk Q13, part 3) ────────────────────────────

const CEILING3: Settings = { ceiling: ["output", "timer"] };

test("the setting phases: run alone is today's shape, and check alone is one check phase that names nothing the ceiling does not grant", () => {
  assert.deepEqual(PHASE_VALUES.map((v) => [...v]), [["run"], ["check"], ["check", "run"]]);
  const inputs = { n: text("n") };
  const run = resolved(resolve({ "command line": { phases: ["run"], inputs, later: [{ m: text("m") }] }, launcher: CEILING3 }));
  assert.equal(run.configuration.phases, undefined);
  assert.deepEqual(run.configuration.inputs, inputs);
  assert.deepEqual(run.configuration.later, [{ m: text("m") }]);
  const none = resolved(resolve({ "command line": { inputs }, launcher: CEILING3 }));
  assert.deepEqual(none.configuration, { ceiling: ["output", "timer"], inputs }, "with no source setting phases, run alone");
  const check = resolved(resolve({ file: { phases: ["check"] }, launcher: CEILING3 }));
  assert.deepEqual(check.configuration.phases, [{ name: "check", check: true, capabilities: [] }]);
  assert.equal(sourceOf(check, "phases"), "file");
});

test("check then run, from each source: the check phase, then run with every capability of the ceiling and the inputs, then each entry of later", () => {
  const inputs = { n: text("n") };
  const later: Inputs[] = [{ m: text("m") }, { k: text("k") }];
  for (const source of SOURCES) {
    const sources: Sources = { launcher: CEILING3, file: { inputs, later } };
    const r = resolved(resolve({ ...sources, [source]: { ...sources[source], phases: ["check", "run"] } }));
    assert.deepEqual(r.configuration.phases, [
      { name: "check", check: true, capabilities: [] },
      { name: "run", capabilities: ["output", "timer"], inputs },
      { name: "later", capabilities: [], inputs: later[0] },
      { name: "later", capabilities: [], inputs: later[1] },
    ], source);
    assert.equal(r.configuration.inputs, undefined, "with phases the inputs are the run's");
    assert.equal(r.configuration.later, undefined);
    assert.equal(sourceOf(r, "phases"), source);
    assert.equal(sourceOf(r, "inputs.n"), "file", "the list of sources names the inputs as before");
    assert.equal(sourceOf(r, "later"), "file");
  }
  const bare = resolved(resolve({ "command line": { phases: ["check", "run"] }, launcher: { ceiling: ["output", "report"] } }));
  assert.deepEqual(bare.configuration.phases, [{ name: "check", check: true, capabilities: ["report"] }, { name: "run", capabilities: ["output", "report"] }]);
});

test("a value of phases that is not built is a finding that says what is built; inputs and later with check alone are no finding, and the check does not use them", () => {
  for (const value of [["run", "check"], ["export"], [], ["check", "check"], ["check", "run", "run"]]) {
    const r = resolve({ "command line": { phases: value }, launcher: CEILING3 });
    assert.deepEqual(r.ok ? [] : r.findings, [`the setting phases is ${JSON.stringify(value.join(", "))}, which is not built: the values built are "run", "check", "check, run", "test", "check, test"`], JSON.stringify(value));
  }
  const given = resolved(resolve({ "command line": { phases: ["check"] }, file: { inputs: { n: text("n") }, later: [{ m: text("m") }] }, launcher: CEILING3 }));
  assert.deepEqual(given.configuration, { ceiling: ["output", "timer"], phases: [{ name: "check", check: true, capabilities: [] }] });
  assert.deepEqual(given.sources.map((s) => s.setting), ["inputs.n", "later", "ceiling", "phases"], "the list of sources names them as before");
  assert.deepEqual(shapeOf(["check"], undefined, []), { ok: true, shape: { phases: [{ name: "check", check: true, capabilities: [] }] } }, "an empty list of later phases is none");
});

test("the project's file reads phases as a list of names", () => {
  const r = readProjectFile("dir/allegro.json", JSON.stringify({ phases: ["check"] }));
  assert.deepEqual(r, { ok: true, settings: { phases: ["check"] } });
  const bad = readProjectFile("dir/allegro.json", JSON.stringify({ phases: "check" }));
  assert.deepEqual(bad.ok ? [] : bad.findings, ["dir/allegro.json: phases is not a list of phase names"]);
});

test("the resolver reaches no host API", () => {
  const source = fs.readFileSync(path.join(here, "configuration.ts"), "utf8").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(source, /\bprocess\b|from "fs"|from "path"|from "os"|from "child_process"|\bBuffer\b|\bglobalThis\b/);
  assert.match(source, /export function resolve\(sources: Sources\): Resolved/);
});

// ── The check capabilities (chunk Q16, part 3) ────────────────────────

test("check supplies the check capabilities the ceiling grants, report alone today, and no other", () => {
  assert.deepEqual([...CHECK_CAPABILITIES], ["report"]);
  const terminal: Settings = { ceiling: ["output", "timer", "http", "report"] };
  const check = resolved(resolve({ "command line": { phases: ["check"] }, launcher: terminal }));
  assert.deepEqual(check.configuration.phases, [{ name: "check", check: true, capabilities: ["report"] }]);
  const narrowed = resolved(resolve({ "command line": { phases: ["check"], ceiling: ["output", "timer"] }, launcher: terminal }));
  assert.deepEqual(narrowed.configuration.phases, [{ name: "check", check: true, capabilities: [] }], "a ceiling narrowed to leave report out: check names nothing");
  const run = resolved(resolve({ "command line": { phases: ["run"] }, launcher: terminal }));
  assert.equal(run.configuration.phases, undefined, "run supplies every capability of the ceiling, report among them");
  assert.deepEqual(run.configuration.ceiling, ["output", "timer", "http", "report"]);
  assert.deepEqual(shapeOf(["check"], undefined, undefined, ["report", "output"]), { ok: true, shape: { phases: [{ name: "check", check: true, capabilities: ["report"] }] } });
  assert.deepEqual(shapeOf(["check"], undefined, undefined, ["output", "http"]), { ok: true, shape: { phases: [{ name: "check", check: true, capabilities: [] }] } });
});

// ── The test phase (chunk Q13, part 6) ────────────────────────────────

test("the setting phases: test is one test phase that supplies every capability of the ceiling and the inputs, and check, test is the check and then that phase", () => {
  assert.deepEqual(TEST_PHASE_VALUES.map((v) => [...v]), [["test"], ["check", "test"]]);
  const terminal: Settings = { ceiling: ["output", "timer", "http", "report"] };
  const inputs = { n: text("n") };
  for (const source of SOURCES.filter((s) => s !== "launcher")) {
    const r = resolved(resolve({ [source]: { phases: ["test"], inputs }, launcher: terminal }));
    assert.deepEqual(r.configuration.phases, [{ name: "test", test: true, capabilities: ["output", "timer", "http", "report"], inputs }], source);
    assert.equal(r.configuration.inputs, undefined, "with phases the inputs are the test phase's, which go to the load");
    assert.equal(sourceOf(r, "phases"), source);
    assert.equal(sourceOf(r, "inputs.n"), source);
  }
  const both = resolved(resolve({ "command line": { phases: ["check", "test"] }, launcher: terminal }));
  assert.deepEqual(both.configuration.phases, [
    { name: "check", check: true, capabilities: ["report"] },
    { name: "test", test: true, capabilities: ["output", "timer", "http", "report"] },
  ]);
  const narrowed = resolved(resolve({ "command line": { phases: ["test"], ceiling: ["output"] }, launcher: terminal }));
  assert.deepEqual(narrowed.configuration.phases, [{ name: "test", test: true, capabilities: ["output"] }], "every capability of the ceiling, as narrowed");
});

test("later given with a test phase is a finding: no later phase follows the tests; an empty list of later phases is none", () => {
  for (const phases of [["test"], ["check", "test"]]) {
    const r = resolve({ "command line": { phases }, file: { later: [{ m: text("m") }] }, launcher: CEILING3 });
    assert.deepEqual(r.ok ? [] : r.findings, [`the setting later is given with the phases ${JSON.stringify(phases.join(", "))}: no later phase follows the tests`]);
  }
  assert.deepEqual(shapeOf(["test"], undefined, [], ["output"]), { ok: true, shape: { phases: [{ name: "test", test: true, capabilities: ["output"] }] } });
  for (const value of [["test", "run"], ["run", "test"], ["test", "check"], ["test", "test"], ["check", "run", "test"]]) {
    const r = resolve({ "command line": { phases: value }, launcher: CEILING3 });
    assert.deepEqual(r.ok ? [] : r.findings, [`the setting phases is ${JSON.stringify(value.join(", "))}, which is not built: the values built are "run", "check", "check, run", "test", "check, test"`], JSON.stringify(value));
  }
});

test("the project's file sets the phases test, and a flag replaces it", () => {
  const file = readProjectFile("dir/allegro.json", JSON.stringify({ phases: ["test"], inputs: { n: "1" } }));
  assert.ok(file.ok);
  const r = resolved(resolve({ file: file.settings, launcher: CEILING3 }));
  assert.deepEqual(r.configuration.phases?.map((p) => [p.name, p.test === true]), [["test", true]]);
  const over = resolved(resolve({ "command line": { phases: ["run"] }, file: file.settings, launcher: CEILING3 }));
  assert.equal(over.configuration.phases, undefined);
});
