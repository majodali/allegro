// Tests of the census (next/bootstrap/census.ts), run by `npm run test:next`.
// They hold its shape, not its numbers, which change as the kernel stream
// supplies forms.md §4 and as the corpus's cases move.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { census, report } from "./census.js";
import { CASES_PATH, type Corpus } from "../tools/corpus.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const corpus = JSON.parse(fs.readFileSync(path.join(ROOT, CASES_PATH), "utf-8")) as Corpus;
const cases = census(corpus);

test("the census has one row for each case of milestone 3, and the pins of a program share its reading", () => {
  const due = corpus.cases.filter((c) => c.milestone === 3);
  assert.deepEqual(cases.map((c) => c.id).sort(), due.map((c) => c.id).sort());
  const byProgram = new Map<string, string>();
  for (const c of cases.filter((x) => x.kind === "pin")) {
    const key = JSON.stringify([c.status, c.forms, c.items, c.unbound]);
    assert.equal(byProgram.get(c.where) ?? key, key, c.id);
    byProgram.set(c.where, key);
  }
});

test("a case that reads lists its forms; one that does not lists why; a host case has no text", () => {
  for (const c of cases) {
    if (c.status === "reads") assert.equal(c.reasons.length, 0, c.id);
    if (c.status === "does not read") assert.ok(c.reasons.length > 0 && c.forms.length === 0, c.id);
    if (c.status === "host") assert.equal(c.texts, 0, c.id);
    if (c.emits) assert.ok(c.status === "reads" && c.items.length === 0 && c.unbound.length === 0, c.id);
  }
});

test("the report's first line counts every case once", () => {
  const [first] = report(cases);
  const m = /^census: milestone 3 · (\d+) \(\d+ pins, \d+ tests\) · host (\d+) .* · does not read (\d+) .* · reads (\d+) /.exec(first);
  assert.ok(m !== null, first);
  const [, all, host, not, reads] = (m as RegExpExecArray).map(Number);
  assert.equal(host + not + reads, all);
  assert.equal(all, cases.length);
});
