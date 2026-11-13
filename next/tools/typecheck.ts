// The new tree's typecheck (B-196 (the rebuild's acceptance side)): runs the
// gate's compiler once for every `next/<dir>/tsconfig.json`, so a directory
// a stream adds with its own tsconfig is checked without a change here.
//
//   npm run typecheck:next
//   npx tsx next/tools/typecheck.ts
//
// It calls `node node_modules/typescript/lib/tsc.js` by path, never
// `npx tsc`, for the reason CLAUDE.md gives for scripts/typecheck.sh. It
// exits 1 when any project fails, after running them all, and when it
// finds no project at all.

import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";

/** The tsconfig files of the new tree, one per directory directly under next/, in name order. */
export function projects(root: string): string[] {
  const next = path.join(root, "next");
  return fs.readdirSync(next, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(next, d.name, "tsconfig.json")))
    .map((d) => `next/${d.name}/tsconfig.json`)
    .sort();
}

function main(): void {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
  const found = projects(root);
  if (found.length === 0) { console.error("typecheck:next: no next/<dir>/tsconfig.json found"); process.exit(1); }
  let failed = 0;
  for (const p of found) {
    const r = spawnSync(process.execPath, ["node_modules/typescript/lib/tsc.js", "-p", p], { cwd: root, stdio: "inherit" });
    if (r.status !== 0) { failed++; console.error(`typecheck:next: ${p} failed`); }
  }
  console.log(`typecheck:next: ${found.length} project(s) (${found.join(", ")}) · ${failed === 0 ? "clean" : `${failed} failed`}`);
  if (failed > 0) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
