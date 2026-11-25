// The two emitters of Allegretto give the same module.
//
// Whose: the kernel stream (lane R). Chunk E7 of docs/plans/book-pass.md
// section 10, second part. The comparison is next/ext/modules.ts.
//
// Every `.alg` under next/ takes the engine and the meaning rules some
// minutes, as the comparison of the readers does (readers.test.ts). So
// the suite compares a part: the first milestone's programs, and a text
// for each thing an emitter does beyond one expression after another.
// The whole is compared by
//
//   npx tsx next/ext/modules.ts
//
// or by this file with ALLEGRO_MODULES=all.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { chosenVariant } from "../kernel/create.js";
import { comparedModules, shownEmitted, type ComparedModule } from "./modules.js";
import { texts } from "./readers.js";

// The reference kernel evaluates on the host's stack, which the engine outgrows (ext.test.ts).
const DEPTH = chosenVariant() === "reference" ? { skip: "the reference kernel evaluates on the host's stack, which the engine outgrows" } : {};

const ALL = process.env.ALLEGRO_MODULES === "all";
const M3 = "next/corpus/allegretto/m3/";
const PART = [
  ...texts("next/corpus/allegretto/m1"),
  // A module's key and an entry under it; a key another module's text imports.
  `${M3}keys.alg`,
  `${M3}import-key/box.alg`,
  `${M3}import-key/main.alg`,
  // An import that hands a value with `with`, one that withholds a capability, one nothing reads.
  `${M3}import-with/greeter.alg`,
  `${M3}import-with/main.alg`,
  `${M3}import-without/main.alg`,
  `${M3}import-unused/main.alg`,
  // A block, a block with sync before it, an arrow binding, a statement whose failure is dropped.
  `${M3}block-body.alg`,
  `${M3}sync-block.alg`,
  `${M3}arrow-binding.alg`,
  `${M3}dropped-failure.alg`,
  // The functions Allegretto writes for itself: those of failures and those of streams.
  `${M3}handle.alg`,
  `${M3}streams.alg`,
  // `!=`, a pipe, a claim that is not the last statement, and a module that exports some of its bindings and not others.
  `${M3}comparisons.alg`,
  `${M3}pipe.alg`,
  `${M3}claim-holds.alg`,
  `${M3}module-export.alg`,
  // Texts the bootstrap refuses, beside the first milestone's name bound nowhere: one no reader reads, one whose import is not found.
  `${M3}parse-error.alg`,
  `${M3}module-unknown.alg`,
];

// One kernel emits all the texts, once, and each test looks at its own.
const FILES = ALL ? texts("next") : PART;
let emitted: ComparedModule[] | undefined;
const all = (): ComparedModule[] => (emitted ??= comparedModules(FILES.map((file) => ({ file, text: fs.readFileSync(file, "utf8") }))).each);
const told = (c: ComparedModule): string => `bootstrap: ${shownEmitted(c.bootstrap)}\nengine:    ${shownEmitted(c.engine)}${c.places === undefined ? "" : `\nplaces:    ${c.places}`}`;

FILES.forEach((file, i) =>
  test(`${file}: the bootstrap and the meaning rules give the same module by identity, or both refuse the text`, DEPTH, () => {
    const c = all()[i];
    assert.ok(c.same, told(c));
  }),
);

test("the part compared holds texts both emitters give a module for, and the three the bootstrap refuses", DEPTH, () => {
  const each = all().slice(0, PART.length);
  if (ALL) return;
  const refused = each.filter((c) => "refused" in c.bootstrap).map((c) => c.file);
  assert.deepEqual(refused, ["next/corpus/allegretto/m1/absent-name.alg", `${M3}parse-error.alg`, `${M3}module-unknown.alg`]);
  // The first is the emitter's own refusal, of a name bound nowhere: the meaning rules give the same words.
  assert.ok(each.find((c) => c.file.endsWith("absent-name.alg"))!.worded);
  // A comparison of nothing with nothing would pass: every other text has an identity, and no two the same.
  const identities = each.flatMap((c) => ("identity" in c.engine ? [c.engine.identity] : []));
  assert.equal(identities.length, PART.length - 3);
  assert.equal(new Set(identities).size, identities.length);
  assert.ok(identities.every((i) => /^sha256:[0-9a-f]{64}$/.test(i)));
  // A place is no part of an identity: the places of each module's parts were compared too, and there were some.
  assert.ok(each.filter((c) => "identity" in c.engine).every((c) => c.placed > 0 && c.places === undefined));
});

// Texts the corpus does not hold: each is refused by the bootstrap's emitter, and the meaning rules refuse it in the same words.
const LIBRARY = "capability output\ninput name\nexport greet() => output.write(name)\n";
const FAULTY: readonly (readonly [string, string, RegExp])[] = [
  ["a name bound nowhere", "x = y\nx\n", /the name y is bound nowhere in the text/],
  ["a name bound twice in the module", "x = 1\nx = 2\nx\n", /the name x is bound twice in one block/],
  ["a name bound twice in a block", "f(a) =>\n  b = a\n  b = 2\n  b\nf(1)\n", /the name b is bound twice in one block/],
  ["a parameter named twice is two findings of one name", "f(a) => a + q + r\nf(1)\n", /the name q is bound nowhere[^]*the name r is bound nowhere/],
  ["an import that hands what the module does not declare", "capability output\nimport library with name: \"a\", other: 1\nlibrary.greet()\n", /hands other with with, and library declares no capability or input other/],
  ["an import that hands a name twice", "capability output\nimport library with name: \"a\", name: \"b\"\nlibrary.greet()\n", /the import of library hands name twice/],
  ["an import that withholds what the module does not declare", "capability output\nimport library with name: \"a\" without timer\nlibrary.greet()\n", /withholds timer, and library declares no capability or input timer/],
  ["an import that both hands and withholds", "capability output\nimport library with name: \"a\" without name\nlibrary.greet()\n", /both hands and withholds name/],
  ["an import that withholds a name twice", "import library with name: \"a\" without output, output\nlibrary.greet()\n", /withholds output twice/],
  ["a declaration of the imported module that nothing meets", "import library\nlibrary.greet()\n", /library declares the capability output, which this module neither holds[^]*library declares the input name, which this module neither holds/],
  ["a block with no statement", "f(a) =>\n  b = a\nf(1)\n", /a block with no statement has no value/],
  // What the bootstrap's reader refuses after it has parsed: the meaning rules refuse it, since their tree holds it.
  ["a header line in a block", "f(a) =>\n  capability output\n  a\nf(1)\n", /the header line capability belongs at the top level of the module, not in a block/],
  ["export in a block", "f(a) =>\n  export b = a\n  b\nf(1)\n", /export marks a binding of the module, and this one is in a block inside it/],
  ["export of a function in a block", "f(a) =>\n  export g() => a\n  g()\nf(1)\n", /export marks a binding of the module, and this one is in a block inside it/],
  ["a statement above `x <- e` that uses x", "capability output\ncapability timer\noutput.write(int.text(x))\nx <- timer.after(1)\nx\n", /the statement at 3:1 needs x, which x <- … binds below it at 4:1/],
  ["a statement above `x <- e` that needs x through a function of the block", "capability output\ncapability timer\ng() => x\noutput.write(int.text(g()))\nx <- timer.after(1)\nx\n", /the statement at 4:1 needs x, which x <- … binds below it at 5:1/],
  ["a statement above `x <- e` that needs x through an import's with", "capability output\ncapability timer\nimport library with name: x\nlibrary.greet()\nx <- timer.after(1)\nx\n", /the statement at 4:1 needs x, which x <- … binds below it at 5:1/],
];
const reader = (file: string): string | undefined => (file.endsWith("library.alg") ? LIBRARY : undefined);
let faulty: ComparedModule[] | undefined;
const faults = (): ComparedModule[] => (faulty ??= comparedModules(FAULTY.map(([, text], i) => ({ file: `faulty/${i}.alg`, text })), reader).each);

FAULTY.forEach(([what, , message], i) =>
  test(`${what}: both emitters refuse the text, in the same words`, DEPTH, () => {
    const c = faults()[i];
    assert.ok("refused" in c.bootstrap && "refused" in c.engine, told(c));
    assert.match(c.bootstrap.refused.join("\n"), message);
    assert.deepEqual(c.engine.refused, c.bootstrap.refused);
  }),
);

test("a binding above `x <- e` that uses x is no finding: both emitters give the module", DEPTH, () => {
  const [c, own] = comparedModules(
    [
      { file: "above.alg", text: "capability timer\nf() =>\n  y = x\n  x <- timer.after(1)\n  y\nf()\n" },
      // The line `x <- e` may use x itself: only the lines above it are looked at.
      { file: "own.alg", text: "capability timer\nf() =>\n  x <- first(timer.after(1), x)\n  x\nf()\n" },
    ],
    reader,
  ).each;
  assert.ok(c.same && "identity" in c.engine, told(c));
  assert.ok(own.same && "identity" in own.engine, told(own));
});

// Texts the bootstrap's reader refuses in words of its own, for a form that is not Allegretto's. The engine reads no
// such form, and says where its reading stopped; `use` it reads, and the meaning rules refuse it until a module's notation is read.
const UNREAD: readonly (readonly [string, string, RegExp, RegExp])[] = [
  ["`and` for `&&`", "x = true and false\nx\n", /the keyword and is not a form of Allegretto/, /^no reading at 9$/],
  ["`or` for `||`", "x = true or false\nx\n", /the keyword or is not a form of Allegretto/, /^no reading at 9$/],
  ["a number in binary", "x = 0b101\nx\n", /the binary number 0b101 is not a form of Allegretto/, /^no reading at 5$/],
  ["`use`", "use thing\n1\n", /use thing brings a module's notation/, /^use thing brings a module's notation, which is not read yet$/],
];
let unread: ComparedModule[] | undefined;
UNREAD.forEach(([what, , theirs, mine], i) =>
  test(`${what}: both refuse the text, each in its own words`, DEPTH, () => {
    const c = (unread ??= comparedModules(UNREAD.map(([, text], n) => ({ file: `unread/${n}.alg`, text })), reader).each)[i];
    assert.ok("refused" in c.bootstrap && "refused" in c.engine, told(c));
    assert.match(c.bootstrap.refused.join("\n"), theirs);
    assert.match(c.engine.refused.join("\n"), mine);
  }),
);

test("a difference between the emitters is found: one byte of a text changed gives another identity", DEPTH, () => {
  const [a, b] = comparedModules([
    { file: "a.alg", text: "x = 1\nx + 1\n" },
    { file: "b.alg", text: "x = 1\nx + 2\n" },
  ]).each;
  assert.ok(a.same && b.same && "identity" in a.engine && "identity" in b.engine);
  assert.notEqual(a.engine.identity, b.engine.identity);
});
