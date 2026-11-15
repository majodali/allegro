// Tests of the census (next/bootstrap/census.ts), run by `npm run test:next`.
// The census reads the corpus's milestone 3 cases and the present parse of
// their texts; these tests hold its shape, not its numbers, which change as
// needs are supplied.

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { census, needRows } from "./census.js";
import { CASES_PATH, type Corpus } from "../tools/corpus.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const corpus = JSON.parse(fs.readFileSync(path.join(ROOT, CASES_PATH), "utf-8")) as Corpus;

test("the census has one row for each case due at milestone 3, and the pins of a program share its needs", () => {
  const due = corpus.cases.filter((c) => c.milestone === 3 && (c.class === "survives" || c.class === "changes"));
  const cases = census(corpus);
  assert.deepEqual(cases.map((c) => c.id).sort(), due.map((c) => c.id).sort());
  const logical = cases.filter((c) => c.where === "tests/logical.alg");
  assert.ok(logical.length > 0 && logical.every((c) => JSON.stringify(c.needs) === JSON.stringify(logical[0].needs)));
  assert.ok(logical[0].needs.includes("int-compare") && logical[0].needs.includes("bits-equal"), "logical.alg compares numbers and texts");
});

test("a need's row counts the cases that wait on it, pins and tests apart", () => {
  const rows = needRows([
    { id: "a", kind: "pin", where: "p", texts: 1, needs: ["int-arith", "bits-equal"] },
    { id: "b", kind: "test", where: "m", texts: 1, needs: ["int-arith"] },
    { id: "c", kind: "test", where: "m", texts: 1, needs: [] },
  ]);
  assert.deepEqual(rows, [{ need: "int-arith", pins: 1, tests: 1 }, { need: "bits-equal", pins: 1, tests: 0 }]);
});
