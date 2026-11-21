// Tests of the loader's bounded file reading (B-196 (the rebuild's
// acceptance side), chunk Q16 (the capabilities the launchers ship), part
// 2): next/launch/files.ts over a file system the test controls, and
// next/launch/node-files.ts over a temporary directory. No test reads a
// file outside the directories it makes.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import { drive } from "../bootstrap/driver.js";
import { boundedReader, inside, type FileHost } from "./files.js";
import { nodeFiles, projectReader } from "./node-files.js";

const here = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(here, "../..");

/** A file system as data: each path's text, and each link's target. It records every real path read. */
function scripted(files: Record<string, string>, links: Record<string, string> = {}, directories: readonly string[] = []): { host: FileHost; read: string[] } {
  const read: string[] = [];
  const real = (file: string): string | undefined => {
    for (const [from, to] of Object.entries(links)) if (file === from || file.startsWith(from + "/")) return real(to + file.slice(from.length));
    return Object.hasOwn(files, file) || directories.includes(file) || Object.keys(files).some((f) => f.startsWith(file + "/")) ? file : undefined;
  };
  return { read, host: { realPath: real, isFile: (f) => Object.hasOwn(files, f), read: (f) => (read.push(f), files[f]), separator: "/" } };
}

test("a file inside a directory the reader was given is read, at any depth", () => {
  const { host, read } = scripted({ "/p/lib.alg": "x = 1\n", "/p/deep/er/lib.alg": "y = 2\n", "/platform/std.alg": "z = 3\n" });
  const reader = boundedReader(["/p", "/platform"], host);
  assert.equal(reader("/p/lib.alg"), "x = 1\n");
  assert.equal(reader("/p/deep/er/lib.alg"), "y = 2\n");
  assert.equal(reader("/platform/std.alg"), "z = 3\n");
  assert.deepEqual(read, ["/p/lib.alg", "/p/deep/er/lib.alg", "/platform/std.alg"]);
});

test("a file that is not there is absent, and a directory is no file", () => {
  const { host, read } = scripted({ "/p/dir/lib.alg": "x = 1\n" });
  const reader = boundedReader(["/p"], host);
  assert.equal(reader("/p/nowhere.alg"), undefined);
  assert.equal(reader("/p/dir"), undefined);
  assert.equal(reader("/elsewhere/nowhere.alg"), undefined);
  assert.deepEqual(read, []);
});

test("a file outside the directories is refused with a reason that names it, and nothing of it is read", () => {
  const { host, read } = scripted({ "/p/lib.alg": "x = 1\n", "/secret/key": "do not read\n", "/p2/lib.alg": "y = 2\n" });
  const reader = boundedReader(["/p"], host);
  assert.deepEqual(reader("/secret/key"), { refused: "/secret/key is outside the directories the loader may read (/p)" });
  // A directory whose name starts as the project's does is another directory.
  assert.deepEqual(reader("/p2/lib.alg"), { refused: "/p2/lib.alg is outside the directories the loader may read (/p)" });
  // The directory itself is not inside itself.
  assert.equal(inside("/p", "/p", "/"), false);
  assert.equal(inside("/p/a", "/p/", "/"), true);
  assert.deepEqual(read, []);
});

test("a link inside the project that leads out of it is followed and then refused; one that leads inside is read", () => {
  const { host, read } = scripted(
    { "/p/real.alg": "x = 1\n", "/secret/key": "do not read\n", "/secret/dir/lib.alg": "do not read\n" },
    { "/p/key.alg": "/secret/key", "/p/alias.alg": "/p/real.alg", "/p/vendor": "/secret/dir" },
  );
  const reader = boundedReader(["/p"], host);
  assert.deepEqual(reader("/p/key.alg"), { refused: "/p/key.alg is outside the directories the loader may read (/p): it leads to /secret/key" });
  assert.deepEqual(reader("/p/vendor/lib.alg"), { refused: "/p/vendor/lib.alg is outside the directories the loader may read (/p): it leads to /secret/dir/lib.alg" });
  assert.equal(reader("/p/alias.alg"), "x = 1\n");
  assert.deepEqual(read, ["/p/real.alg"]);
});

test("the directories are taken by their real paths, and a directory that is not there bounds nothing", () => {
  const { host } = scripted({ "/real/p/lib.alg": "x = 1\n" }, { "/link": "/real/p" });
  assert.equal(boundedReader(["/link"], host)("/link/lib.alg"), "x = 1\n");
  assert.equal(boundedReader(["/link"], host)("/real/p/lib.alg"), "x = 1\n");
  assert.deepEqual(boundedReader(["/nowhere"], host)("/real/p/lib.alg"), { refused: "/real/p/lib.alg is outside the directories the loader may read (/nowhere)" });
});

test("the driver reports a refused text as a finding at the import, and emits nothing", () => {
  const { host } = scripted({ "/p/main.alg": "", "/secret/lib.alg": "export x = 1\n" }, { "/p/lib.alg": "/secret/lib.alg" });
  const r = drive("capability output\nimport lib\n", "/p/main.alg", boundedReader(["/p"], host));
  assert.equal(r.ok, false);
  assert.deepEqual(
    r.ok ? [] : r.findings.map((f) => [f.file, f.kind, f.at.line, f.message]),
    [["/p/main.alg", "refused", 2, "the text lib.alg, which import lib names, is not read: /p/lib.alg is outside the directories the loader may read (/p): it leads to /secret/lib.alg"]],
  );
});

test("over a terminal's file system: a text beside the main text is read, and a link out of the project's directory is refused", (t) => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "bounded-reader-")));
  try {
    const project = path.join(dir, "project");
    const outside = path.join(dir, "outside");
    fs.mkdirSync(project);
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(project, "lib.alg"), "export x = 1\n");
    fs.writeFileSync(path.join(outside, "secret.alg"), "export x = 2\n");
    const main = path.join(project, "main.alg");
    const reader = projectReader(main);
    assert.equal(reader(path.join(project, "lib.alg")), "export x = 1\n");
    assert.equal(reader(path.join(project, "nowhere.alg")), undefined);
    assert.deepEqual(reader(path.join(outside, "secret.alg")), { refused: `${path.join(outside, "secret.alg")} is outside the directories the loader may read (${project})` });
    assert.equal(nodeFiles.realPath(path.join(project, "nowhere.alg")), undefined);
    try {
      fs.symlinkSync(path.join(outside, "secret.alg"), path.join(project, "leak.alg"));
    } catch {
      t.diagnostic("this host makes no links: the link's case is held by the test over a scripted file system");
      return;
    }
    assert.deepEqual(reader(path.join(project, "leak.alg")), {
      refused: `${path.join(project, "leak.alg")} is outside the directories the loader may read (${project}): it leads to ${path.join(outside, "secret.alg")}`,
    });
    // The command, end to end: the import of the link is refused, nothing is launched, and the exit code is 1.
    fs.writeFileSync(main, 'capability output\nimport leak\noutput.write("never")\n');
    const run = spawnSync(process.execPath, ["--import", "tsx", path.join(here, "allegretto.ts"), main], { cwd: ROOT, encoding: "utf8", timeout: 30000 });
    assert.equal(run.stdout, "");
    assert.equal(
      run.stderr,
      `${main}:2:1: the text leak.alg, which import leak names, is not read: ${path.join(project, "leak.alg")} is outside the directories the loader may read (${project}): it leads to ${path.join(outside, "secret.alg")}\n`,
    );
    assert.equal(run.status, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the bounded reader reaches no host API: the file system is the host it is handed", () => {
  const source = fs.readFileSync(path.join(here, "files.ts"), "utf8").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(source, /\bprocess\b|from "fs"|from "path"|from "os"|from "child_process"|\bBuffer\b|\bglobalThis\b/);
  assert.match(source, /export function boundedReader\(directories: readonly string\[\], host: FileHost\): ReadText/);
});
