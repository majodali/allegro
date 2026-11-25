// Tests of the HTTP capability and its scripted transport (B-196 (the
// rebuild's acceptance side), chunk Q16 (the capabilities the launchers
// ship), part 1): next/launch/http.ts and next/launch/scripted-transport.ts,
// through the launcher of next/launch/launcher.ts on the kernel
// `createKernel` of next/launch/kernel-variant.ts gives: the machine, and
// the reference where next/launch/reference-run.ts loads this file. Run
// by `npm run test:next`.
//
// No test here reaches a network. Every request goes to a transport the
// test makes: the scripted one, or one that answers only when the test
// says (`heldTransport`). The terminal's transport over the host's `fetch`
// is called by no test. No test pins a step count or a wall-clock
// duration.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { createKernel, usedVariant } from "./kernel-variant.js";
import { encode, type SavedProgram } from "../kernel/saved-program.js";
import { emit } from "../bootstrap/emit.js";
import { shipped } from "../prims/index.js";
import { describe, launch, type Configuration, type LaunchOutcome, type Target } from "./launcher.js";
import { output } from "./output.js";
import { HTTP, http, unreachable, type HttpAnswer, type HttpRequest, type Transport } from "./http.js";
import { scriptedTransport, type Served } from "./scripted-transport.js";
import { TERMINAL_CEILING } from "./terminal.js";

const here = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(here, "../..");
const bytes = (t: string) => new TextEncoder().encode(t);

/** The record the emitter writes for an Allegretto text, as JSON round-trips it. */
function emitted(text: string): SavedProgram {
  const r = emit(text);
  assert.ok(r.ok, r.ok ? "" : r.findings.map((f) => f.message).join("; "));
  return JSON.parse(encode(r.program)) as SavedProgram;
}

const BOTH: Configuration = { ceiling: ["output", "http"], steps: 1_000_000 };
const target = (transport: Transport): Target => ({ capabilities: [output, http(transport)], primitives: shipped });
const run = (program: SavedProgram, transport: Transport, configuration: Configuration = BOTH): Promise<LaunchOutcome> =>
  launch({ createKernel, program, configuration, target: target(transport) });
/** A program that declares output and http, with these lines. */
const program = (...lines: string[]): SavedProgram => emitted(["capability output", "capability http", ...lines, ""].join("\n"));
const answer = (status: number, body: string, headers: Array<readonly [string, string]> = []): HttpAnswer => ({ status, headers, body: bytes(body) });
const serves = (...served: Served[]) => scriptedTransport(served);

/** A transport that answers a request only when the test says: `asked` lists the requests in the order asked. */
function heldTransport(): { transport: Transport; asked: HttpRequest[]; answer: (i: number, a: HttpAnswer) => void; fail: (i: number, e: Error) => void } {
  const asked: HttpRequest[] = [];
  const settle: Array<{ resolve: (a: HttpAnswer) => void; reject: (e: Error) => void }> = [];
  return {
    transport: (request) =>
      new Promise((resolve, reject) => {
        asked.push(request);
        settle.push({ resolve, reject });
      }),
    asked,
    answer: (i, a) => settle[i].resolve(a),
    fail: (i, e) => settle[i].reject(e),
  };
}
/** Lets the launcher go on until it waits again. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

const GET = 'r <- http.request({method: "GET", url: "https://example.org/page"})';

test("the HTTP capability has one part, request", () => {
  assert.deepEqual(HTTP, { name: "http", parts: ["request"] });
});

test("http.request answers late with plain data: status, headers and body, and nothing that uses it is printed until the answer comes", async () => {
  const held = heldTransport();
  let settled = false;
  const outcome = run(
    program(
      GET,
      "shown <- output.write(int.text(r.status) ++ \" \" ++ r.body ++ \" \" ++ r.headers[0][0] ++ \"=\" ++ r.headers[0][1] ++ \" \" ++ int.text(count(r.headers)))",
      'output.write("asked")',
    ),
    held.transport,
  );
  void outcome.then(() => (settled = true));
  await settle();
  assert.equal(held.asked.length, 1);
  assert.equal(settled, false);
  held.answer(0, answer(200, "hello", [["content-type", "text/plain"], ["x-n", "1"]]));
  const done = await outcome;
  assert.deepEqual(done.lines, ["asked", "200 hello content-type=text/plain 2"]);
  assert.equal(done.end.kind, "completed");
});

test("the answer's keys are status, headers and body, in that order, and the status is 64 bits", async () => {
  const s = serves({ method: "GET", url: "https://example.org/page", answer: answer(200, "") });
  const done = await run(
    program(GET, 'output.write(spelling(key(r, 0)) ++ " " ++ spelling(key(r, 1)) ++ " " ++ spelling(key(r, 2)) ++ " " ++ int.text(count(r)) ++ " " ++ int.text(bits.length(r.status)) ++ " " ++ int.text(bits.length(r.body)))'),
    s.transport,
  );
  assert.deepEqual(done.lines, ["status headers body 3 64 0"]);
});

test("any status is an answer: a 404 and a 500 fill the cell with no failure", async () => {
  const s = serves(
    { method: "GET", url: "https://example.org/missing", answer: answer(404, "not found") },
    { method: "GET", url: "https://example.org/broken", answer: answer(500, "broken") },
  );
  const done = await run(
    program(
      'a <- http.request({method: "GET", url: "https://example.org/missing"})',
      'b <- http.request({method: "GET", url: "https://example.org/broken"})',
      'output.write(int.text(a.status) ++ " " ++ (if is_failure(a) then "failure" else "answer"))',
      'output.write(int.text(b.status) ++ " " ++ (if is_failure(b) then "failure" else "answer"))',
    ),
    s.transport,
  );
  assert.deepEqual(done.lines, ["404 answer", "500 answer"]);
  assert.equal(done.end.kind, "completed");
});

test("a request with no answer fills the cell with a failure of the one shape: failure first, keyed `unreachable, and a reason", async () => {
  const show = [
    'output.write(if is_failure(r) then "failure" else "answer")',
    "output.write(spelling(key(r, 0)) ++ \" \" ++ spelling(r.failure) ++ \" \" ++ spelling(key(r, 1)) ++ \": \" ++ r.reason)",
  ];
  for (const [transport, reason] of [
    [serves().transport, "nothing serves GET https://example.org/page"],
    [(() => Promise.reject(new Error("getaddrinfo ENOTFOUND example.org"))) as Transport, "getaddrinfo ENOTFOUND example.org"],
    [(() => { throw new Error("connect ECONNREFUSED"); }) as Transport, "connect ECONNREFUSED"],
    [(() => Promise.reject(Object.assign(new Error("fetch failed"), { cause: new Error("other side closed") }))) as Transport, "fetch failed: other side closed"],
  ] as const) {
    const done = await run(program(GET, ...show), transport);
    assert.deepEqual(done.lines, ["failure", `failure unreachable reason: ${reason}`], reason);
    assert.equal(done.end.kind, "completed", reason);
  }
  assert.deepEqual(unreachable("why"), { entries: [[{ symbol: "failure" }, { symbol: "unreachable" }], [{ symbol: "reason" }, { bits: bytes("why"), bitLength: 24 }]] });
});

test("a failure nothing handles is a refutation: the dropped request holds the lines after it, and none of them happens", async () => {
  const done = await run(program('output.write("before")', 'http.request({method: "GET", url: "https://example.org/page"})', 'output.write("after")'), serves().transport);
  assert.deepEqual(done.lines, ["before"]);
  assert.equal(done.end.kind, "refuted");
});

test("several requests in flight: all are asked before any is answered, and on the scripted transport they are answered in the order asked", async () => {
  const text = [
    'a <- output.write("a: " ++ http.request({method: "GET", url: "https://example.org/a"}).body)',
    'b <- output.write("b: " ++ http.request({method: "GET", url: "https://example.org/b"}).body)',
    'c <- output.write("c: " ++ http.request({method: "GET", url: "https://example.org/c"}).body)',
    'output.write("asked")',
  ];
  const held = heldTransport();
  const seen: string[] = [];
  const outcome = launch({ createKernel, program: program(...text), configuration: BOTH, target: target(held.transport), onLine: (l) => seen.push(l) });
  await settle();
  assert.deepEqual(held.asked.map((r) => r.url), ["https://example.org/a", "https://example.org/b", "https://example.org/c"]);
  assert.deepEqual(seen, ["asked"]);
  held.answer(2, answer(200, "third"));
  await settle();
  assert.deepEqual(seen, ["asked", "c: third"], "an answer is filled when it arrives, whatever the order asked");
  held.answer(0, answer(200, "first"));
  held.answer(1, answer(200, "second"));
  assert.equal((await outcome).end.kind, "completed");

  const s = serves(
    { method: "GET", url: "https://example.org/c", answer: answer(200, "3") },
    { method: "GET", url: "https://example.org/b", answer: answer(200, "2") },
    { method: "GET", url: "https://example.org/a", answer: answer(200, "1") },
  );
  for (let i = 0; i < 3; i++) {
    const done = await run(program(...text), s.transport);
    assert.deepEqual(done.lines, ["asked", "a: 1", "b: 2", "c: 3"]);
  }
});

test("the scripted transport: answers in the order asked, one turn between two, a request asked during an answer after those before it, and every other request rejected", async () => {
  const s = serves({ method: "GET", url: "u1", answer: answer(200, "one") }, { method: "POST", url: "u1", answer: answer(201, "posted") });
  const order: string[] = [];
  const ask = (method: string, url: string, then?: () => void) =>
    s.transport({ method, url, headers: [] }).then(
      (a) => {
        order.push(`${method} ${url} ${a.status}`);
        then?.();
      },
      (e: Error) => order.push(e.message),
    );
  const all: Array<Promise<unknown>> = [];
  all.push(ask("GET", "u1", () => all.push(ask("POST", "u1"))));
  all.push(ask("GET", "u2"));
  all.push(ask("PUT", "u1"));
  assert.equal(s.pending(), 3);
  assert.deepEqual(order, [], "nothing is answered while the asking goes on");
  await settle();
  assert.deepEqual(order, ["GET u1 200"], "one answer in one turn");
  while (s.pending() > 0) await settle();
  await Promise.all(all);
  assert.deepEqual(order, ["GET u1 200", "nothing serves GET u2", "nothing serves PUT u1", "POST u1 201"]);
  assert.deepEqual(s.asked.map((r) => `${r.method} ${r.url}`), ["GET u1", "GET u2", "PUT u1", "POST u1"]);
});

test("what the transport is handed: the method, the url, the headers in the order written and the body's bytes; none and no body where left out", async () => {
  const s = serves({ method: "POST", url: "https://example.org/echo", answer: answer(201, "stored") });
  const done = await run(
    program(
      'r <- http.request({method: "POST", url: "https://example.org/echo", headers: [["content-type", "text/plain"], ["x-trace", "7"]], body: "ping"})',
      'q <- http.request({url: "https://example.org/bare", method: "GET"})',
      'output.write(int.text(r.status) ++ " " ++ r.body)',
    ),
    s.transport,
  );
  assert.deepEqual(done.lines, ["201 stored"]);
  assert.deepEqual(s.asked, [
    { method: "POST", url: "https://example.org/echo", headers: [["content-type", "text/plain"], ["x-trace", "7"]], body: bytes("ping") },
    { method: "GET", url: "https://example.org/bare", headers: [] },
  ]);
  const empty = serves({ method: "PUT", url: "u", answer: answer(204, "") });
  await run(program('r <- http.request({method: "PUT", url: "u", headers: [], body: ""})', "output.write(int.text(r.status))"), empty.transport);
  assert.deepEqual(empty.asked, [{ method: "PUT", url: "u", headers: [], body: new Uint8Array(0) }], "an empty body is a body of no bytes");
});

test("every kind of value outside http.request's domain is a refutation with a reason that names the part, and nothing is asked", async () => {
  for (const [lines, says] of [
    [['r <- http.request("https://example.org")'], /^http\.request takes a structure, not bits$/],
    [['r <- http.request({url: "u"})'], /^http\.request takes a structure with an entry method; this one has none$/],
    [['r <- http.request({method: "GET"})'], /^http\.request takes a structure with an entry url; this one has none$/],
    [['r <- http.request({method: true, url: "u"})'], /^http\.request takes the method as a text of whole bytes; this value has 1 bits$/],
    [['r <- http.request({method: "GET", url: {}})'], /^http\.request takes the url as a text, not structure$/],
    [['r <- http.request({method: "GET", url: bits.slice(255, 56, 8)})'], /^http\.request takes the url as a text; these bytes are not UTF-8$/],
    [['r <- http.request({method: "GET", url: "u", headers: "x"})'], /^http\.request takes headers as an array of pairs of texts; this value is no array$/],
    [['r <- http.request({method: "GET", url: "u", headers: {a: ["x", "y"]}})'], /^http\.request takes headers as an array of pairs of texts; this value is no array$/],
    [['r <- http.request({method: "GET", url: "u", headers: [["a"]]})'], /^http\.request takes headers as an array of pairs of texts; an entry is no pair$/],
    [['r <- http.request({method: "GET", url: "u", headers: [{n: "a", v: "b"}]})'], /^http\.request takes headers as an array of pairs of texts; an entry is no pair$/],
    [['r <- http.request({method: "GET", url: "u", headers: [["a", true]]})'], /^http\.request takes a header's value as a text of whole bytes; this value has 1 bits$/],
    [['r <- http.request({method: "GET", url: "u", headers: [[[], "b"]]})'], /^http\.request takes a header's name as a text, not structure$/],
    [['r <- http.request({method: "GET", url: "u", body: true})'], /^http\.request takes the body as bits of whole bytes; this value has 1 bits$/],
    [['r <- http.request({method: "GET", url: "u", body: ["x"]})'], /^http\.request takes the body as bits of whole bytes, not structure$/],
    [['r <- http.request({method: "GET", url: "u", timeout: 5})'], /^http\.request takes the entries method, url, headers and body; this structure has an entry timeout$/],
    [['r <- http.request(put({method: "GET", url: "u"}, [], 1))'], /^http\.request takes a structure whose entries are keyed; this one has an entry with no key$/],
  ] as const) {
    const s = serves();
    const done = await run(program('output.write("before")', ...lines), s.transport);
    assert.equal(done.end.kind, "refuted", lines.join("; "));
    assert.ok(done.end.kind === "refuted" && done.end.reasons.some((r) => says.test(r)), `${lines.join("; ")}: ${describe(done.end)}`);
    assert.deepEqual(s.asked, [], lines.join("; "));
  }
});

test("a private entry is passed over by a primitive function (forms.md §4, \"Keys and private entries\"), so it is outside no domain of http.request", async () => {
  const s = serves({ method: "GET", url: "u", answer: answer(200, "seen") });
  const done = await run(program("key k", 'r <- http.request({method: "GET", url: "u", [k]: 1})', "output.write(r.body)"), s.transport);
  assert.deepEqual(done.lines, ["seen"]);
  assert.deepEqual(s.asked, [{ method: "GET", url: "u", headers: [] }]);
});

test("a program that declares http where the ceiling does not grant it is refused, as for any capability", async () => {
  const s = serves();
  const done = await run(program(GET), s.transport, { ceiling: ["output"] });
  assert.equal(describe(done.end), "refused: the module declares the capability http, which the ceiling does not grant");
  assert.deepEqual(done.lines, []);
  assert.deepEqual(s.asked, []);
});

test("a program that does not declare http is unaffected by a ceiling that grants it", async () => {
  const done = await run(emitted('capability output\noutput.write("hello, world")\n'), serves().transport);
  assert.deepEqual(done.lines, ["hello, world"]);
  assert.equal(done.end.kind, "completed");
});

test("the terminal's ceiling grants http with output and timer", () => {
  for (const name of ["output", "timer", "http"]) assert.ok(TERMINAL_CEILING.includes(name), name);
});

test("the HTTP capability reaches no host API but globalThis.fetch, and the scripted transport none but the host's turn", () => {
  // The code alone: comments and the texts of string literals left out.
  const source = (file: string) =>
    fs.readFileSync(path.join(here, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, '""');
  /** The modules a file imports. */
  const imports = (file: string) => [...fs.readFileSync(path.join(here, file), "utf8").matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
  assert.deepEqual(imports("http.ts"), ["../kernel/interface.js", "./launcher.js"]);
  assert.deepEqual(imports("scripted-transport.ts"), ["./clock.js", "./http.js"]);
  const capability = source("http.ts");
  assert.doesNotMatch(capability, /\bprocess\b|\bimport\(|\brequire\(|\bBuffer\b|\bsetTimeout\b|\bsetImmediate\b/);
  assert.match(capability, /\(globalThis as \{ fetch\?: unknown \}\)\.fetch/);
  assert.doesNotMatch(capability.replace(/\(globalThis as \{ fetch\?: unknown \}\)\.fetch/g, ""), /\bfetch\b|\bglobalThis\b/);
  const scripted = source("scripted-transport.ts");
  assert.doesNotMatch(scripted, /\bprocess\b|\bimport\(|\brequire\(|\bBuffer\b|\bfetch\b|\bglobalThis\b/);
});

test("npm run allegretto grants http: a program that declares it and asks nothing runs, and reaches no network", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "allegretto-http-"));
  try {
    const file = path.join(dir, "declares.alg");
    fs.writeFileSync(file, 'capability output\ncapability http\nask(u) => http.request({method: "GET", url: u})\noutput.write("granted")\n');
    const r = spawnSync(process.execPath, ["--import", "tsx", path.join(here, "allegretto.ts"), "--kernel", usedVariant(), file], { cwd: ROOT, encoding: "utf8", timeout: 30000 });
    assert.equal(r.stderr, "");
    assert.equal(r.stdout, "granted\n");
    assert.equal(r.status, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
