// A text that changes the grammar it is read in.
//
// Whose: the kernel stream (lane R). Chunk E8 of docs/plans/book-pass.md
// section 10. Each text here is read by the engine in turns with its
// grammar (next/ext/lib/reader.alg), written as a module by the meaning
// rules, and run by the kernel (next/ext/run.ts). The bootstrap reads
// none of them: it refuses `use`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { chosenVariant } from "../kernel/create.js";
import { runTexts, type Ran } from "./run.js";

// The reference kernel evaluates on the host's stack, which the engine outgrows (ext.test.ts).
const DEPTH = chosenVariant() === "reference" ? { skip: "the reference kernel evaluates on the host's stack, which the engine outgrows" } : {};

/** A module with two notations and the functions their parts read. */
const RATIO = [
  "import change",
  "import grammar",
  "import levels",
  "export ratio(a, b) => {top: a, bottom: b}",
  "export doubled(a) => a + a",
  "from(name, at) => {k: `from, module: \"ratio\", name: name, at: at}",
  "made(sign, left, right, at) => {k: `apply, fn: from(\"ratio\", at), args: [left, right], at: at}",
  // `a :/ b`, binding tighter than a product.
  "export fractions = [change.level(`operators, levels.making(levels.after(levels.level(`ratio, [\":/\"], `left), [`product]), made))]",
  // `twice x`, a form of its own beside the others an operand may be.
  "twice = grammar.giving(grammar.seq([grammar.spaced(grammar.lit(\"twice\")), grammar.ref(`primary)]), (v, at) => {k: `apply, fn: from(\"doubled\", at), args: [v[1]], at: at})",
  "export doubling = [change.append(`primary, twice)]",
  // A notation that replaces a rule it did not add.
  "export greedy = [change.replace(`primary, grammar.lit(\"all\"))]",
  // A notation held inside a structure the module exports, and one that leaves the rule of a text's lines no lines.
  "export sets = {signs: fractions}",
  "export flat = [change.replace(`lines, grammar.ref(`line))]",
  // A notation that brings lines of its own that could change the grammar again.
  "export again = [change.append(`primary, grammar.turns(`primary, grammar.lit(\"x\"), grammar.lit(\";\"), v => []))]",
  "",
].join("\n");
const SHOW = 'show(r) => output.write(int.text(r.top) ++ "/" ++ int.text(r.bottom))\n';
const run = (main: string, more: Record<string, string> = {}): Ran => runTexts("main", { main, ratio: RATIO, ...more });
const told = (r: Ran): string => JSON.stringify({ lines: r.lines, findings: r.findings, refuted: r.refuted });

test("a text uses a notation: the lines after `use` are read in the grammar the notation changed", DEPTH, () => {
  const r = run(`capability output\n${SHOW}use ratio.fractions changing operators\nshow(1 :/ 2)\n`);
  assert.deepEqual(r.findings, [], told(r));
  assert.deepEqual(r.lines, ["1/2"]);
});

test("the notation's sign binds where its level says: tighter than a product", DEPTH, () => {
  // 2 * 3 :/ 4 is 2 * (3 :/ 4): a number times a structure, which the primitive refuses when it is evaluated.
  const r = run("capability output\nuse ratio.fractions changing operators\nr = 2 * 3 :/ 4\noutput.write(int.text(r))\n");
  assert.deepEqual(r.findings, [], told(r));
  assert.ok(r.refuted !== undefined, told(r));
  const s = run("capability output\nuse ratio.fractions changing operators\nq = (2 * 3) :/ 4\noutput.write(int.text(q.top))\n");
  assert.deepEqual(s.lines, ["6"], told(s));
});

test("the text needs no import of the notation's module, and may bind the module's name itself", DEPTH, () => {
  const r = run(`capability output\n${SHOW}use ratio.fractions changing operators\nf(ratio) => 6 :/ ratio\nshow(f(3))\nratio = 5\nshow(ratio :/ ratio)\n`);
  assert.deepEqual(r.findings, [], told(r));
  assert.deepEqual(r.lines, ["6/3", "5/5"]);
});

test("a text that also imports the module reads its bindings as ever", DEPTH, () => {
  const r = run(`capability output\nimport ratio\n${SHOW}use ratio.fractions changing operators\nshow(1 :/ 2)\nshow(ratio.ratio(3, 4))\n`);
  assert.deepEqual(r.lines, ["1/2", "3/4"], told(r));
});

test("a notation's part inside a function reads its module too", DEPTH, () => {
  const r = run(`capability output\n${SHOW}use ratio.fractions changing operators\ng = (a) => a :/ 2\nshow(g(9))\n`);
  assert.deepEqual(r.findings, [], told(r));
  assert.deepEqual(r.lines, ["9/2"]);
});

test("the path after `use` is followed to its end", DEPTH, () => {
  const r = run(`capability output\n${SHOW}use ratio.sets.signs changing operators\nshow(1 :/ 2)\n`);
  assert.deepEqual(r.lines, ["1/2"], told(r));
});

test("a `use` on the last line of a text is still made: one that is refused refuses the text", DEPTH, () => {
  const r = run("capability output\noutput.write(\"never\")\nuse nowhere.signs\n");
  assert.deepEqual(r.lines, []);
  assert.deepEqual(r.findings, ["main: 3:1: use nowhere: the text of the module nowhere was not handed to the reader"]);
});

test("a notation the text lets replace the rule of its lines leaves no lines to go on with, and is refused", DEPTH, () => {
  const r = run("capability output\nuse ratio.flat changing lines\noutput.write(\"never\")\n");
  assert.deepEqual(r.lines, []);
  assert.deepEqual(r.findings, ["main: a change of the grammar left the rule of the lines being read no lines"]);
});

test("a notation does not reach back: its sign above the `use` line is no reading", DEPTH, () => {
  const r = run("capability output\nx = 1 :/ 2\nuse ratio.fractions changing operators\noutput.write(\"never\")\n");
  assert.deepEqual(r.lines, []);
  assert.match(r.findings.join("\n"), /^main: no reading at \d+$/);
});

test("a `use` in a block ends with the block", DEPTH, () => {
  const inBlock = `capability output\n${SHOW}f() =>\n  use ratio.fractions changing operators\n  1 :/ 2\nshow(f())\n`;
  const r = run(inBlock);
  assert.deepEqual(r.lines, ["1/2"], told(r));
  const after = run(`${inBlock}show(3 :/ 4)\n`);
  assert.deepEqual(after.lines, []);
  assert.match(after.findings.join("\n"), /^main: no reading at \d+$/);
});

test("a `use` at the top holds inside the blocks after it", DEPTH, () => {
  const r = run(`capability output\n${SHOW}use ratio.fractions changing operators\nf(a) =>\n  b = a :/ 2\n  b\nshow(f(7))\n`);
  assert.deepEqual(r.lines, ["7/2"], told(r));
});

test("a module holds several notations, and a text uses the ones it names", DEPTH, () => {
  const both = run("capability output\nuse ratio.fractions changing operators\nuse ratio.doubling changing primary\noutput.write(int.text((twice 4 :/ 1).top))\n");
  assert.deepEqual(both.lines, ["8"], told(both));
  const one = run("capability output\nuse ratio.doubling changing primary\noutput.write(int.text(twice 21))\nx = 1 :/ 2\n");
  assert.deepEqual(one.lines, []);
  assert.match(one.findings.join("\n"), /^main: no reading at \d+$/);
});

test("a notation only adds: adding to a rule a rule in force tests cannot be read is refused unless the text names it", DEPTH, () => {
  const r = run("capability output\nuse ratio.fractions\noutput.write(\"never\")\n");
  assert.deepEqual(r.lines, []);
  assert.deepEqual(r.findings, ["main: 2:1: use ratio: the notation adds to the rule operators, which a rule in force tests cannot be read"]);
});

test("a notation that replaces a rule it did not add is refused, and allowed where the text names the rule", DEPTH, () => {
  const r = run("capability output\nuse ratio.greedy\noutput.write(\"never\")\n");
  assert.deepEqual(r.findings, ["main: 2:1: use ratio: the notation changes the rule primary, which it did not add and the text does not name"]);
  // Named, the rule is replaced: an operand is the word `all` and nothing else, so a text literal is no reading.
  const named = run("capability output\nuse ratio.greedy changing primary\noutput.write(\"never\")\n");
  assert.match(named.findings.join("\n"), /^main: no reading at \d+$/);
});

test("a notation cannot change the grammar again: lines that ask for a change are refused in what it brings, also where the text names the rule", DEPTH, () => {
  const r = run("capability output\nuse ratio.again changing primary\noutput.write(\"never\")\n");
  assert.deepEqual(r.findings, ["main: 2:1: use ratio: the notation brings lines that change the grammar, in the rule primary: that right is the grammar's a reading began with"]);
});

test("the same notation used twice in one block conflicts with itself", DEPTH, () => {
  const r = run("capability output\nuse ratio.fractions changing operators\nuse ratio.fractions changing operators\noutput.write(\"never\")\n");
  assert.deepEqual(r.findings, ["main: 3:1: use ratio: a change adds the level ratio, which the rule operators has"]);
});

test("what `use` names is a notation of a module whose text was handed", DEPTH, () => {
  const unknown = run("capability output\nuse nowhere.signs\noutput.write(\"never\")\n");
  assert.deepEqual(unknown.findings, ["main: 2:1: use nowhere: the text of the module nowhere was not handed to the reader"]);
  const module = run("capability output\nuse ratio\noutput.write(\"never\")\n");
  assert.deepEqual(module.findings, ["main: 2:1: use ratio: ratio is no notation: a notation is a list of changes to a grammar"]);
  const absent = run("capability output\nuse ratio.absent\noutput.write(\"never\")\n");
  assert.match(absent.findings.join("\n"), /^main: 2:1: use ratio: the structure has no entry keyed absent$/);
});

test("a module that is used is read while the text is read, with its own `use` lines", DEPTH, () => {
  // `half` is written in the notation of `ratio`, and brings a notation of its own that reads its binding.
  const half = [
    "import change",
    "import grammar",
    "use ratio.fractions changing operators",
    "export half = 1 :/ 2",
    "export halves = [change.append(`primary, grammar.giving(grammar.spaced(grammar.lit(\"~half\")), (v, at) => {k: `from, module: \"half\", name: \"half\", at: at}))]",
    "",
  ].join("\n");
  const r = run(`capability output\n${SHOW}use half.halves changing primary\nshow(~half)\n`, { half });
  assert.deepEqual(r.findings, [], told(r));
  assert.deepEqual(r.lines, ["1/2"]);
  // A module does not pass a notation on: the text that uses `half` has no `:/`.
  const passed = run("capability output\nuse half.halves changing primary\nx = 1 :/ 2\n", { half });
  assert.match(passed.findings.join("\n"), /^main: no reading at \d+$/);
  // Nor does importing a module bring its notation.
  const imported = run("capability output\nimport half\noutput.write(int.text(half.half.bottom))\n", { half });
  assert.deepEqual(imported.lines, ["2"], told(imported));
});

test("a notation whose form reads what a form in force reads gives two readings, which is refused", DEPTH, () => {
  // The word `six` is a name already: a notation that makes it an operand of its own leaves the text two ways to be read.
  const words = "import change\nimport grammar\nexport n = [change.append(`primary, grammar.giving(grammar.spaced(grammar.lit(\"six\")), (v, at) => {k: `int, value: 6, at: at}))]\n";
  const r = run("capability output\nuse words.n changing primary\nsix = 7\noutput.write(int.text(six))\n", { words });
  assert.deepEqual(r.lines, []);
  assert.deepEqual(r.findings, ["main: the text reads two ways"]);
});

test("a notation that adds a line of a name and an expression leaves a later `use` one reading: `use` is no name", DEPTH, () => {
  const commands = [
    "capability output",
    "import change",
    "import grammar",
    "export said(what, v) => output.write(what ++ \" \" ++ int.text(v))",
    "line = grammar.giving(grammar.seq([grammar.guard(grammar.lit(\"output\"), false), grammar.ref(`name), grammar.ref(`expression)]), (v, at) => {header: false, k: `statement, expr: {k: `apply, fn: {k: `from, module: \"commands\", name: \"said\", at: at}, args: [{k: `text, bytes: v[1].name, at: at}, v[2]], at: at}, at: at})",
    "export empty = []",
    "export lines = [change.add(`name, grammar.giving(grammar.unless(grammar.spaced(grammar.run(\"a word\", \"az\")), `keywords), (v, at) => {name: v})), change.append(`line, line)]",
    "",
  ].join("\n");
  // `use commands.empty` would read as the word `use` and the expression `commands.empty` too, were `use` a name.
  const r = run(`capability output\nuse commands.lines changing line\nshow 7\nuse commands.empty\ntell 2\n`, { commands });
  assert.deepEqual(r.findings, [], told(r));
  assert.deepEqual(r.lines, ["show 7", "tell 2"]);
});

test("a module that uses itself, through another, is refused", DEPTH, () => {
  const a = "use b.n\nexport n = []\n";
  const b = "use a.n\nexport n = []\n";
  const r = run("capability output\nuse a.n\noutput.write(\"never\")\n", { a, b });
  assert.deepEqual(r.lines, []);
  assert.match(r.findings.join("\n"), /the module a is used while it is being read for its notation/);
});

test("a notation is taken from an instance with no capability and no input", DEPTH, () => {
  // The notation needs nothing the module declares: it is read, and at the run the part it made is handed the text's own `output`.
  const loud = [
    "capability output",
    "import change",
    "import grammar",
    "export shout(t) => output.write(t ++ \"!\")",
    "export shouting = [change.append(`primary, grammar.giving(grammar.seq([grammar.spaced(grammar.lit(\"shout\")), grammar.ref(`primary)]), (v, at) => {k: `apply, fn: {k: `from, module: \"loud\", name: \"shout\", at: at}, args: [v[1]], at: at}))]",
    "",
  ].join("\n");
  const r = run("capability output\nuse loud.shouting changing primary\nshout \"hey\"\n", { loud });
  assert.deepEqual(r.lines, ["hey!"], told(r));
  // A text with no `output` cannot hand it on.
  const none = run("use loud.shouting changing primary\nshout \"hey\"\n", { loud });
  assert.match(none.findings.join("\n"), /loud declares the capability output, which this module neither holds under that name/);
  // A notation that reads an input of its module is no notation of a bare instance.
  const needy = "input signs\nimport change\nimport grammar\nexport n = [change.append(`primary, grammar.lit(signs))]\n";
  const refused = run("capability output\nuse needy.n changing primary\noutput.write(\"never\")\n", { needy });
  assert.match(refused.findings.join("\n"), /the input signs is not handed to a module read for its notation/);
});

test("a module with a key cannot be used yet: only the kernel makes a key, and the loader is not written", DEPTH, () => {
  const keyed = "key k\nexport n = []\n";
  const r = run("capability output\nuse keyed.n\noutput.write(\"never\")\n", { keyed });
  assert.match(r.findings.join("\n"), /the module keyed has a key/);
});

test("a text with no `use` is read as before, and a notation costs its module's reading once", DEPTH, () => {
  const plain = run("capability output\nx = 1\noutput.write(int.text(x))\n");
  assert.deepEqual(plain.lines, ["1"], told(plain));
  const used = run("capability output\nuse ratio.fractions changing operators\nx = 1\noutput.write(int.text(x))\n");
  assert.deepEqual(used.lines, ["1"], told(used));
  console.log(`# use: a text of three lines ${plain.steps} steps; the same with a use of a notation ${used.steps} steps`);
});
