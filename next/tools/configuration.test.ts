// Tests of a configuration from its sources (B-196 (the rebuild's
// acceptance side), chunk Q13 (check and run as configurations, and what a
// result holds), part 2): `resolve`, `readProjectFile` and
// `readEnvironment` of next/tools/configuration.ts, and the result's list
// of sources from the launcher (next/launch/launcher.ts). Run by
// `npm run test:next`, on the kernel `createKernel` of
// next/kernel/create.ts gives: the reference, or the variant that keeps its
// own stack with `ALLEGRO_KERNEL=machine`. The two commands end to end are
// tested in next/launch/launcher.test.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { createKernel } from "../kernel/create.js";
import { encode, type SavedProgram } from "../kernel/saved-program.js";
import { emit } from "../bootstrap/emit.js";
import { readLiteral } from "../bootstrap/literal.js";
import { launch, type Inputs, type Plain, type SourceName } from "../launch/launcher.js";
import { output } from "../launch/output.js";
import { shipped } from "../prims/index.js";
import { MAY_SET, PROJECT_FILE, SETTINGS, SOURCES, readEnvironment, readProjectFile, resolve, type Resolved, type Settings, type Setting, type Sources } from "./configuration.js";

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
  }
}
const sourceOf = (r: Extract<Resolved, { ok: true }>, setting: string) => r.sources.find((s) => s.setting === setting)?.source;
const nameOf = (setting: Setting) => (setting === "inputs" ? "inputs.n" : setting);

test("the table: steps, inputs and later from any source; ceiling, restore and kernel from the command line and the launcher only", () => {
  assert.deepEqual([...SETTINGS], ["steps", "inputs", "later", "ceiling", "restore", "kernel"]);
  assert.deepEqual([...SOURCES], ["command line", "file", "environment", "launcher"]);
  for (const s of ["steps", "inputs", "later"] as const) assert.deepEqual([...MAY_SET[s]], [...SOURCES]);
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
  assert.equal(pairs, 3 * 6 + 3 * 1);
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
    environment: { inputs: { c: text("c from the environment") } },
    launcher: { inputs: { b: text("b from the launcher"), d: text("d from the launcher") } },
  }));
  assert.deepEqual(r.configuration.inputs, {
    a: text("a from the command line"),
    b: text("b from the file"),
    c: text("c from the environment"),
    d: text("d from the launcher"),
  });
  assert.deepEqual(r.sources, [
    { setting: "inputs.a", source: "command line" },
    { setting: "inputs.b", source: "file" },
    { setting: "inputs.c", source: "environment" },
    { setting: "inputs.d", source: "launcher" },
  ]);
});

test("a setting from a source that may not set it is refused, naming the setting and the source, for each such pair", () => {
  let pairs = 0;
  for (const setting of SETTINGS)
    for (const source of SOURCES.filter((s) => !MAY_SET[setting].includes(s))) {
      const r = resolve({ ...one(setting, source), launcher: { ceiling: ["output", "timer"] } });
      assert.equal(r.ok, false, `${setting} from ${source}`);
      const phrase = source === "file" ? `the project's file ${PROJECT_FILE}` : `the ${source}`;
      assert.deepEqual(r.ok ? [] : r.findings, [`the setting ${setting} is set by ${phrase}, which may not set it: only the command line and the launcher may`]);
      pairs++;
    }
  assert.equal(pairs, 6);
  // Beside a source that may set it, the refusal still stands.
  const both = resolve({ "command line": { kernel: "a" }, environment: { kernel: "b" } });
  assert.deepEqual(both.ok ? [] : both.findings, ["the setting kernel is set by the environment, which may not set it: only the command line and the launcher may"]);
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
  const env = readEnvironment({});
  assert.deepEqual(env, { ok: true, settings: {} });
});

test("the environment gives the step budget from ALLEGRO_STEPS, a whole number, and a value that is not one is a finding", () => {
  assert.deepEqual(readEnvironment({ ALLEGRO_STEPS: "250", ALLEGRO_KERNEL: "machine" }), { ok: true, settings: { steps: 250 } });
  assert.deepEqual(readEnvironment({ ALLEGRO_STEPS: "" }), { ok: true, settings: {} });
  for (const bad of ["-1", "2.5", "many", "1e3"])
    assert.deepEqual(readEnvironment({ ALLEGRO_STEPS: bad }), { ok: false, findings: [`the environment's ALLEGRO_STEPS is not a whole number: ${JSON.stringify(bad)}`] });
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
  assert.deepEqual(findings('{"budget": 3}'), ['dir/allegro.json: "budget" is not a setting; the settings are steps, inputs, later, ceiling, restore, kernel']);
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
  const env = readEnvironment({ ALLEGRO_STEPS: "10000000" });
  assert.ok(env.ok);
  const file = readProjectFile(PROJECT_FILE, JSON.stringify({ inputs: { a: '"from the file"', b: '"replaced"' } }));
  assert.ok(file.ok, file.ok ? "" : file.findings.join("; "));
  const r = resolved(resolve({
    "command line": { inputs: { b: text("from the command line") } },
    file: file.settings,
    environment: env.settings,
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
    { setting: "steps", source: "environment" },
    { setting: "inputs.b", source: "command line" },
    { setting: "inputs.a", source: "file" },
    { setting: "ceiling", source: "launcher" },
  ]);
  const result = outcome.result;
  assert.ok(result !== undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result, "the list is plain data");
});

test("the resolver reaches no host API", () => {
  const source = fs.readFileSync(path.join(here, "configuration.ts"), "utf8").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(source, /\bprocess\b|from "fs"|from "path"|from "os"|from "child_process"|\bBuffer\b|\bglobalThis\b/);
  assert.match(source, /export function resolve\(sources: Sources\): Resolved/);
});
