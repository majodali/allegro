// IR lint (B-173, the book writes IR first): every intermediate
// representation under the repository passes the methodology's IR checks.
//
// The checks are the methodology specification's CK-01 to CK-16
// (majodali/methodology docs/intermediate-representation.md); the tool is
// `mtool ir check` from majodali/methodology-tools, which is not published
// as a package and runs from a checkout. The checkout is found through
// $MTOOL_HOME, else at ../majodali/methodology-tools or ../methodology-tools
// beside this repository. With no `.ir.md` file in the repository the lint
// passes without the tool; with IR files and no tool it fails and says how
// to get one, so a missing checkout never passes an unchecked IR.
//
//   npm run lint:ir              every tracked or untracked *.ir.md
//   npx tsx scripts/ir-lint.ts docs/book/x.ir.md   named files only
//
// Also invoked as a test from src/test/tooling.ts, where the tool is
// probed against a known-bad IR before being trusted (the B-128(a) lesson).

import { execFileSync, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

/** Every IR file the lint governs: tracked or untracked-but-not-ignored, outside the plan archive. */
export function irFiles(root: string): string[] {
  const out = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "*.ir.md"], { cwd: root, encoding: "utf-8" });
  return out.split("\n").map((s) => s.trim()).filter(Boolean).filter((f) => !f.startsWith("docs/plans/archive/") && !f.includes("node_modules"));
}

/** The methodology-tools checkout, or null. */
export function resolveMtool(root: string): string | null {
  const candidates = [process.env.MTOOL_HOME, path.join(root, "..", "majodali", "methodology-tools"), path.join(root, "..", "methodology-tools")];
  for (const c of candidates) {
    if (!c) continue;
    if (fs.existsSync(path.join(c, "src", "cli.ts")) && fs.existsSync(path.join(c, "node_modules", ".bin", "tsx"))) return path.resolve(c);
  }
  return null;
}

export interface IrCheckResult { exitCode: number; output: string }

/** Run `mtool ir check` on absolute or root-relative files; the tool's own output is returned. */
export function runIrCheck(mtoolHome: string, root: string, files: string[]): IrCheckResult {
  const abs = files.map((f) => (path.isAbsolute(f) ? f : path.join(root, f)));
  const r = spawnSync(path.join(mtoolHome, "node_modules", ".bin", "tsx"), ["src/cli.ts", "ir", "check", ...abs], { cwd: mtoolHome, encoding: "utf-8" });
  return { exitCode: r.status ?? 1, output: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

function main(): void {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const named = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const files = named.length > 0 ? named : irFiles(root);
  if (files.length === 0) { console.log("ir-lint: no IR files in the repository; nothing to check"); return; }
  const home = resolveMtool(root);
  if (!home) {
    console.log(`ir-lint: ${files.length} IR file(s) but no methodology-tools checkout. Set MTOOL_HOME to a checkout of https://github.com/majodali/methodology-tools (git clone --depth 1; its node_modules are committed) or place one at ../majodali/methodology-tools.`);
    process.exit(1);
  }
  const r = runIrCheck(home, root, files);
  process.stdout.write(r.output.endsWith("\n") ? r.output : r.output + "\n");
  console.log(`ir-lint: ${files.length} file(s) via ${home}: ${r.exitCode === 0 ? "clean" : "VIOLATIONS"}`);
  if (r.exitCode !== 0) process.exit(r.exitCode);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
