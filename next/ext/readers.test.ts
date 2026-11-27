// The two readers of Allegretto give the same tree.
//
// Whose: the kernel stream (lane R). Chunk E7 of docs/plans/book-pass.md
// section 10. The comparison is next/ext/readers.ts.
//
// Every `.alg` under next/ is about 270,000 bytes, and the engine reads
// them in some minutes: too long for every run of the suite. So
// the suite compares a part: the first milestone's programs, and one
// text for each form of layout that differs between a block and a line
// carried on. The whole is compared by
//
//   npx tsx next/ext/readers.ts
//
// or by this file with ALLEGRO_READERS=all.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { bootstrapTree, compared, comparedAll, engineTree, firstDifference, texts } from "./readers.js";

// These tests run on the machine alone. The reference kernel evaluates on the host's stack, which the engine
// outgrows, and next/kernel/reference.test.ts, which runs the kernel's tests on it, does not load this file.

const ALL = process.env.ALLEGRO_READERS === "all";
const PART = [
  ...texts("next/corpus/allegretto/m1"),
  "next/corpus/allegretto/m3/sync-block.alg",
  "next/corpus/allegretto/m3/multiline.alg",
  "next/corpus/allegretto/m3/negative-fraction.alg",
  "next/corpus/allegretto/m3/import-with/main.alg",
  "next/corpus/allegretto/m3/structure.alg",
  "next/corpus/allegretto/m3/parse-error.alg",
  "next/ext/lib/set.alg",
];

// The engine reads all the texts in one launch, once, and each test looks at its own.
const FILES = ALL ? texts("next") : PART;
let read: ReturnType<typeof comparedAll> | undefined;
const all = (): ReturnType<typeof comparedAll> => (read ??= comparedAll(FILES.map((f) => fs.readFileSync(f, "utf8"))));

FILES.forEach((file, i) =>
  test(`${file}: the bootstrap and the engine give the same tree, or both refuse the text`, async () => {
    const c = (await all()).each[i];
    assert.ok(c.same, c.same ? "" : firstDifference(c.bootstrap, c.engine));
  }),
);

test("the part compared holds a text both readers refuse, and texts with a block, a line carried on, and an import with a list", () => {
  const read = (f: string) => bootstrapTree(fs.readFileSync(f, "utf8"));
  assert.ok("refused" in read("next/corpus/allegretto/m3/parse-error.alg"));
  const trees = PART.map(read).flatMap((r) => ("tree" in r ? [r.tree] : []));
  assert.equal(trees.length, PART.length - 1);
  assert.ok(trees.some((t) => t.includes("(block true ")), "a block with sync before it");
  assert.ok(trees.some((t) => t.includes("(block false ")), "a block");
  assert.ok(trees.some((t) => /\(import [a-z_]+@[0-9:-]+ \(\(/.test(t)), "an import with a list");
  assert.ok(trees.some((t) => t.includes("(float -")), "a fraction with a minus before it");
});

test("a difference between the readers is found: a tree with one place moved is not the same text", async () => {
  const text = "x = 1 + 2\n";
  const [b, e] = [bootstrapTree(text), await engineTree(text)];
  assert.ok("tree" in b && "tree" in e);
  assert.equal(b.tree, e.tree);
  assert.equal(b.tree, "(module () ((binding x@0-1:1:1 false (binary + (int 1 @4-5:1:5) (int 2 @8-9:1:9) @4-9:1:5) @0-9:1:1)))");
  const moved = b.tree.replace("@8-9", "@8-10");
  assert.notEqual(moved, b.tree);
  assert.equal(firstDifference(b.tree, moved).slice(0, 3), "at ");
  assert.ok(firstDifference(b.tree, moved).includes("@8-10"));
});

test("offsets are counted in bytes by both, where a text holds a character of more than one", async () => {
  const c = await compared('x = "é" ++ y\n');
  assert.ok(c.same && !c.refused, c.same ? "" : firstDifference(c.bootstrap, c.engine));
  const b = bootstrapTree('x = "é" ++ y\n');
  assert.ok("tree" in b && b.tree.includes("(text c3a9 @4-8:1:5)") && b.tree.includes("(name y @12-13:1:13)"));
});

// Where a grammar that tries every item could read a text two ways, and the bootstrap, which takes
// the first that matches, reads it one way: the engine gives that one tree and no other.
const ONE_WAY: Record<string, string> = {
  "a block before a line carried on":
    "f(x) =>\n  a\n  -b\ng(x) =>\n  a\n    -b\ns() => sync\n  a\nv = sync\nu = if a\n  then b\n  else c\nk = a\n  .b\n  (c)\n",
  "a function and a conditional take all that follows":
    "g = x => x + 1\nh = 1 + if a then b else c + d\nq = a => b => c\nr = f(x => x, 1)\ny = -x => x\nw = (x, y) => x\np = (x) + 1\n",
  "an arrow before a comparison, and a minus before a number":
    "n <- late\nm = n < -late\nz = -(1.5) - -2 - 9223372036854775807 - -9223372036854775808 - -0.5 - 0xff - 0XAb\nt = [1,\n2,\n]\nimport m with a: 1, b: x without c, d\n",
};
for (const [name, text] of Object.entries(ONE_WAY))
  test(`one reading where two could arise: ${name}`, async () => {
    const c = await compared(text);
    assert.ok(c.same && !c.refused, c.same ? "refused by both" : firstDifference(c.bootstrap, c.engine));
  });

test("what the bootstrap refuses to parse, the engine does not read: a reserved word as a name, two statements on a line, a block less deep", async () => {
  for (const text of ["if = 1\n", "x = 1 y = 2\n", "f() =>\n    a\n  b\n", 'x = "a{b}"\n']) {
    const c = await compared(text);
    assert.ok(c.same && c.refused, `${JSON.stringify(text)}: ${c.same ? "read by both" : firstDifference(c.bootstrap, c.engine)}`);
  }
});
