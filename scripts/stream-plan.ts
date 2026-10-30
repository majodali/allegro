// Stream plans (B-166, docs/plans/parallel-streams.md S2): a stream runs
// from a stream plan, and the plan opens with a machine-readable header —
// YAML front matter in a small fixed subset — that names the lane, the
// oracle commands, the merge policy, the chunk list and the backlog ids
// the stream reserves. A coordinating service reads the header as the
// brief; this script is the reference reader and the check that every
// header in `docs/plans/` is well-formed against the repository it
// describes (the lane exists in the backlog's lane table, each reserved
// id is a backlog item, each oracle command exists).
//
//   npx tsx scripts/stream-plan.ts            list every stream plan
//   npx tsx scripts/stream-plan.ts --check    validate; exit 1 on a finding
//   npm run lint:streams                      the same check
//
// The template `docs/plans/stream-plan-template.md` documents the fields.
// Also invoked as a test from src/test/tooling.ts, including against a
// known-bad header (the B-128(a) lesson: probe a check before trusting it).
//
// The subset: `key: scalar`, `key: [a, b]`, and `key:` followed by
// `  - item` lines. No nesting, no quoting rules beyond stripping one pair
// of matching quotes. Anything else is a finding, not a guess.

import * as fs from "fs";
import * as path from "path";

export type HeaderValue = string | string[];
export type Header = Record<string, HeaderValue>;

export interface ParsedFrontMatter {
  header: Header | null;      // null: the file has no front matter
  errors: string[];           // syntax findings
  endLine: number;            // 0-based index of the line AFTER the closing ---
}

/** Parse the front matter at the top of a markdown text. */
export function parseFrontMatter(text: string): ParsedFrontMatter {
  const lines = text.split("\n");
  if (lines[0]?.trim() !== "---") return { header: null, errors: [], endLine: 0 };
  const header: Header = {};
  const errors: string[] = [];
  let i = 1;
  let listKey: string | null = null;
  for (; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.trim() === "---") return { header, errors, endLine: i + 1 };
    if (raw.trim() === "" || raw.trim().startsWith("#")) continue;
    const item = raw.match(/^\s+-\s+(.*)$/);
    if (item) {
      if (listKey === null) { errors.push(`line ${i + 1}: list item outside a list`); continue; }
      (header[listKey] as string[]).push(unquote(item[1]));
      continue;
    }
    const kv = raw.match(/^([A-Za-z][A-Za-z0-9_-]*):(?:\s+(.*))?$/);
    if (!kv) { errors.push(`line ${i + 1}: not \`key: value\`: ${raw.trim()}`); listKey = null; continue; }
    const [, key, value] = kv;
    if (key in header) errors.push(`line ${i + 1}: duplicate key ${key}`);
    if (value === undefined || value.trim() === "") { header[key] = []; listKey = key; continue; }
    listKey = null;
    const v = value.trim();
    const inline = v.match(/^\[(.*)\]$/);
    header[key] = inline ? inline[1].split(",").map((s) => unquote(s)).filter((s) => s !== "") : unquote(v);
  }
  errors.push("front matter never closed (no closing ---)");
  return { header, errors, endLine: lines.length };
}

function unquote(s: string): string {
  const t = s.trim();
  const m = t.match(/^(["'])(.*)\1$/);
  return m ? m[2] : t;
}

/** What a header is checked against. */
export interface Context {
  lanes: Set<string>;         // lane letters from the backlog's lane table
  backlogIds: Set<string>;    // every B-### with an entry in docs/backlog.md
  scripts: Set<string>;       // package.json scripts
  fileExists: (rel: string) => boolean;
}

export const STATUSES = ["draft", "active", "closed", "superseded"] as const;
export const MERGE_POLICIES = ["merge-on-green", "human-gated"] as const;
const REQUIRED = ["type", "status", "backlog", "lane", "merge", "oracle", "chunks", "reserves"] as const;
const KNOWN = new Set<string>([...REQUIRED, "boundary", "template"]);

/** Validate a stream-plan header. Returns findings; empty means well-formed. */
export function checkStreamPlan(header: Header, ctx: Context): string[] {
  const out: string[] = [];
  const str = (k: string): string | undefined => (typeof header[k] === "string" ? (header[k] as string) : undefined);
  const list = (k: string): string[] | undefined => (Array.isArray(header[k]) ? (header[k] as string[]) : undefined);

  for (const k of REQUIRED) if (!(k in header)) out.push(`missing field: ${k}`);
  for (const k of Object.keys(header)) if (!KNOWN.has(k)) out.push(`unknown field: ${k}`);
  if (str("type") !== "stream-plan") out.push(`type must be stream-plan, is ${JSON.stringify(header.type)}`);
  const status = str("status");
  if (status !== undefined && !(STATUSES as readonly string[]).includes(status)) out.push(`status ${status} is not one of ${STATUSES.join(", ")} (K-007)`);
  const backlog = str("backlog");
  if (backlog !== undefined) {
    if (!/^B-\d+$/.test(backlog)) out.push(`backlog ${backlog} is not a B-### id`);
    else if (!ctx.backlogIds.has(backlog)) out.push(`backlog ${backlog} has no entry in docs/backlog.md`);
  }
  const lane = str("lane");
  if (lane !== undefined && !ctx.lanes.has(lane)) out.push(`lane ${lane} is not a row of the lane table in docs/backlog.md (${[...ctx.lanes].sort().join(", ")})`);
  const merge = str("merge");
  if (merge !== undefined && !(MERGE_POLICIES as readonly string[]).includes(merge)) out.push(`merge ${merge} is not one of ${MERGE_POLICIES.join(", ")}`);

  const oracle = list("oracle");
  if ("oracle" in header && oracle === undefined) out.push("oracle must be a list of commands");
  if (oracle !== undefined) {
    if (oracle.length === 0) out.push("oracle is empty: a stream needs a mechanical oracle");
    for (const cmd of oracle) {
      const run = cmd.match(/^npm run (\S+)/);
      const tsx = cmd.match(/^npx tsx (\S+)/);
      if (cmd === "npm test" || cmd.startsWith("npm test ")) continue;
      if (run) { if (!ctx.scripts.has(run[1])) out.push(`oracle: no npm script ${run[1]}`); continue; }
      if (tsx) { if (!ctx.fileExists(tsx[1])) out.push(`oracle: no file ${tsx[1]}`); continue; }
      out.push(`oracle: unrecognised command ${JSON.stringify(cmd)} (npm test, npm run <script>, npx tsx <file>)`);
    }
  }
  const chunks = list("chunks");
  if ("chunks" in header && chunks === undefined) out.push("chunks must be a list");
  if (chunks !== undefined) {
    if (chunks.length === 0) out.push("chunks is empty");
    const seen = new Set<string>();
    for (const c of chunks) {
      if (!/^[A-Z]+\d+[a-z]?$/.test(c)) out.push(`chunk id ${c} is not letters then a number (S1, P10, C7a)`);
      if (seen.has(c)) out.push(`duplicate chunk ${c}`);
      seen.add(c);
    }
  }
  const reserves = list("reserves");
  if ("reserves" in header && reserves === undefined) out.push("reserves must be a list (possibly empty)");
  if (reserves !== undefined) {
    const seen = new Set<string>();
    for (const id of reserves) {
      if (!/^B-\d+$/.test(id)) out.push(`reserved id ${id} is not a B-### id`);
      else if (!ctx.backlogIds.has(id)) out.push(`reserved id ${id} has no entry in docs/backlog.md`);
      if (seen.has(id)) out.push(`duplicate reserved id ${id}`);
      seen.add(id);
    }
  }
  const boundary = list("boundary");
  if ("boundary" in header && boundary === undefined) out.push("boundary must be a list of globs");
  if (boundary !== undefined && boundary.length === 0) out.push("boundary is present but empty: omit it to inherit the lane's");
  if ("template" in header && header.template !== "true") out.push("template, when present, is true");
  return out;
}

/** Read the context from the repository: lanes, backlog ids, npm scripts. */
export function loadContext(root: string): Context {
  const backlog = fs.readFileSync(path.join(root, "docs/backlog.md"), "utf-8");
  const lanes = new Set<string>();
  for (const m of backlog.matchAll(/^\|\s*\*\*([A-Z])\s+—/gm)) lanes.add(m[1]);
  const backlogIds = new Set<string>();
  for (const m of backlog.matchAll(/^- \[[ x]\] \*\*(B-\d+)\*\*/gm)) backlogIds.add(m[1]);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8")) as { scripts?: Record<string, string> };
  return {
    lanes,
    backlogIds,
    scripts: new Set(Object.keys(pkg.scripts ?? {})),
    fileExists: (rel) => fs.existsSync(path.join(root, rel)),
  };
}

export interface StreamPlanFile { file: string; header: Header; errors: string[] }

/** Every markdown file under docs/plans/ (not the archive) whose front matter says `type: stream-plan`. */
export function streamPlans(root: string): StreamPlanFile[] {
  const dir = path.join(root, "docs/plans");
  const out: StreamPlanFile[] = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith(".md")) continue;
    const file = `docs/plans/${name}`;
    const { header, errors } = parseFrontMatter(fs.readFileSync(path.join(root, file), "utf-8"));
    if (header === null) continue;
    if (header.type !== "stream-plan") continue;
    out.push({ file, header, errors });
  }
  return out;
}

/** Check every stream plan in the repository; the template is listed but not checked. */
export function checkAll(root: string): { file: string; findings: string[] }[] {
  const ctx = loadContext(root);
  return streamPlans(root)
    .filter((p) => p.header.template !== "true")
    .map((p) => ({ file: p.file, findings: [...p.errors, ...checkStreamPlan(p.header, ctx)] }));
}

function main(): void {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const check = process.argv.includes("--check");
  if (!check) {
    for (const p of streamPlans(root)) {
      const h = p.header;
      const show = (k: string) => (Array.isArray(h[k]) ? (h[k] as string[]).join(", ") : String(h[k] ?? "—"));
      console.log(`${p.file}: lane ${show("lane")} · ${show("status")} · ${show("merge")} · ${show("backlog")} · chunks ${show("chunks")} · reserves ${show("reserves")}${h.template === "true" ? " · template" : ""}`);
    }
    return;
  }
  const results = checkAll(root);
  let bad = 0;
  for (const r of results) {
    if (r.findings.length === 0) continue;
    bad++;
    for (const f of r.findings) console.log(`${r.file}: ${f}`);
  }
  console.log(`stream-plan: ${results.length} plan(s) checked, ${bad} with findings`);
  if (bad > 0) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
