// Lane lint (B-163, docs/plans/parallel-streams.md S4): a PR's changed
// files stay inside the lane its stream plan declares.
//
// The lane manifest `scripts/analyze/lanes.json` is docs/backlog.md
// §"Parallel lanes" as data: the files each lane may edit, and the shared
// status documents every lane edits (B-162). A PR declares its lane
// through its backlog id: the PR title's first `B-###` is looked up in the
// stream plans' headers (`backlog` and `reserves`, scripts/stream-plan.ts),
// and the plan found names the lane; the plan's `boundary`, when present,
// narrows the lane's globs. A PR whose id no stream plan reserves is
// unstreamed and is reported, not checked — the lane model binds streams.
//
//   npm run lint:lanes                         changed files vs origin/main,
//                                              lane from $PR_TITLE
//   npx tsx scripts/analyze/lane-lint.ts --title "B-163: …" --base HEAD^1
//   npx tsx scripts/analyze/lane-lint.ts --lane S --files a.ts,b.md
//   npx tsx scripts/analyze/lane-lint.ts --check   manifest vs backlog and plans
//
// In CI (pull_request events, .github/workflows/ci.yml) the checkout is the
// PR's merge commit, so `--base HEAD^1` diffs exactly the PR's files; the
// title arrives in $PR_TITLE through `env:`, never interpolated into the
// script. Also invoked as a test from src/test/tooling.ts, including
// against a known-bad file list (the B-128(a) lesson).

import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";
import { loadContext, streamPlans } from "../stream-plan.js";

export interface Lane { name: string; globs: string[]; closed?: boolean }
export interface LaneManifest { _: string; shared: string[]; lanes: Record<string, Lane> }

export function loadManifest(root: string): LaneManifest {
  return JSON.parse(fs.readFileSync(path.join(root, "scripts/analyze/lanes.json"), "utf-8")) as LaneManifest;
}

/** `**` spans directories, `*` one path segment, `?` one character; anything else is literal. */
export function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") { i++; re += "(?:.*/)?"; } else re += ".*";
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

export function matchesAny(file: string, globs: string[]): boolean {
  return globs.some((g) => globToRegExp(g).test(file));
}

export interface Declaration { lane: string; plan: string; backlog: string; boundary: string[] | null }

/** The lane a backlog id declares: the stream plan whose `backlog` or `reserves` names it. */
export function declaredLane(root: string, backlogId: string): Declaration | null {
  for (const p of streamPlans(root)) {
    if (p.header.template === "true") continue;
    const reserves = Array.isArray(p.header.reserves) ? p.header.reserves : [];
    if (p.header.backlog === backlogId || reserves.includes(backlogId)) {
      const boundary = Array.isArray(p.header.boundary) ? p.header.boundary : null;
      return { lane: String(p.header.lane), plan: p.file, backlog: backlogId, boundary };
    }
  }
  return null;
}

export function backlogIdOf(title: string | undefined): string | null {
  const m = title?.match(/\bB-\d+\b/);
  return m ? m[0] : null;
}

export interface FileFinding { file: string; reason: string }

/** The changed files that fall outside the declared lane (and its plan's boundary). */
export function checkFiles(files: string[], decl: Declaration, manifest: LaneManifest): FileFinding[] {
  const lane = manifest.lanes[decl.lane];
  if (!lane) return files.map((file) => ({ file, reason: `lane ${decl.lane} is not in scripts/analyze/lanes.json` }));
  const allowed = decl.boundary ?? lane.globs;
  const out: FileFinding[] = [];
  for (const file of files) {
    if (file === decl.plan) continue;
    if (matchesAny(file, manifest.shared)) continue;
    if (matchesAny(file, allowed)) continue;
    const where = decl.boundary ? `the boundary of ${decl.plan}` : `lane ${decl.lane} (${lane.name})`;
    out.push({ file, reason: `outside ${where}` });
  }
  return out;
}

/** Files changed on HEAD since the merge base with `base`. */
export function changedFiles(root: string, base: string): string[] {
  const out = execFileSync("git", ["diff", "--name-only", "--diff-filter=ACMRD", `${base}...HEAD`], { cwd: root, encoding: "utf-8" });
  return out.split("\n").map((s) => s.trim()).filter(Boolean);
}

/** Manifest consistency: every lane of the backlog's table has an entry and vice versa; every stream plan's lane exists. */
export function checkManifest(root: string): string[] {
  const manifest = loadManifest(root);
  const ctx = loadContext(root);
  const out: string[] = [];
  for (const l of ctx.lanes) if (!manifest.lanes[l]) out.push(`lane ${l} is a row of the lane table but not in lanes.json`);
  for (const l of Object.keys(manifest.lanes)) if (!ctx.lanes.has(l)) out.push(`lane ${l} is in lanes.json but not a row of the lane table`);
  for (const [l, lane] of Object.entries(manifest.lanes)) {
    if (!lane.closed && lane.globs.length === 0) out.push(`lane ${l} has no globs and is not closed`);
    for (const g of lane.globs) if (g.startsWith("/") || g.includes("..")) out.push(`lane ${l}: glob ${g} is not repository-relative`);
  }
  for (const p of streamPlans(root)) {
    if (p.header.template === "true") continue;
    const l = String(p.header.lane);
    if (!manifest.lanes[l]) out.push(`${p.file}: lane ${l} is not in lanes.json`);
    else if (p.header.status !== "closed" && manifest.lanes[l].closed) out.push(`${p.file}: lane ${l} is closed`);
  }
  return out;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main(): void {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
  if (process.argv.includes("--check")) {
    const findings = checkManifest(root);
    for (const f of findings) console.log(`lane-lint: ${f}`);
    console.log(`lane-lint: manifest ${findings.length === 0 ? "consistent with the lane table and the stream plans" : `${findings.length} finding(s)`}`);
    if (findings.length > 0) process.exit(1);
    return;
  }
  const manifest = loadManifest(root);
  const title = arg("--title") ?? process.env.PR_TITLE;
  const laneArg = arg("--lane");
  let decl: Declaration | null;
  if (laneArg) decl = { lane: laneArg, plan: "", backlog: "", boundary: null };
  else {
    const id = backlogIdOf(title);
    if (!id) { console.log(`lane-lint: no backlog id in the title ${JSON.stringify(title ?? "")}; unstreamed, not checked`); return; }
    decl = declaredLane(root, id);
    if (!decl) { console.log(`lane-lint: no stream plan reserves ${id}; unstreamed, not checked`); return; }
  }
  const filesArg = arg("--files");
  const files = filesArg ? filesArg.split(",").map((s) => s.trim()).filter(Boolean) : changedFiles(root, arg("--base") ?? "origin/main");
  const findings = checkFiles(files, decl, manifest);
  for (const f of findings) console.log(`lane-lint: ${f.file}: ${f.reason}`);
  const via = decl.plan ? `${decl.backlog} via ${decl.plan}` : "--lane";
  console.log(`lane-lint: lane ${decl.lane} (${via}): ${files.length} file(s), ${findings.length} outside`);
  if (findings.length > 0) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
