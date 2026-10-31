// =============================================================================
// Documentation lints for the book (docs/plans/documentation-book.md, Phase 0).
//
//   npx tsx scripts/doc-lint.ts [anchors|order|ids|all] [--json] [--strict]
//
//   anchors   every markdown link with a `#fragment` resolves: the target file
//             exists (doc-ref-lint's job) AND the fragment names an explicit
//             `<a id="…">` or a heading in that file. Deterministic.
//   order     a link to a `#def-…` anchor from a document EARLIER in
//             docs/reading-order.json than the document defining it is a
//             forward reference. The reading order is dependency order; a
//             chapter marked `lookahead` (an introduction or a glossary) is
//             exempt as the source of a link, never as the target.
//   ids       an identifier (D23, R6, SC-7, B-112, W-006, M9, §6) whose FIRST
//             use in a document is not followed by a name in parentheses or a
//             link is a bare citation (methodology P-004). Heuristic: bold and
//             links around the identifier defeat it, so counts are approximate
//             and this check never gates.
//
// IN THE GATE since B-150 (the document lints join the gate): `--check`
// exits 1 when anchors or order report anything, or when ids exceeds the
// committed count in scripts/doc-lint-baseline.json — a ratchet that may
// only fall (`--update-baseline` lowers it, never raises it). The suite
// runs the same check through `lintDocs` (src/test/tooling.ts) and probes
// each lint against a known-bad document in a temporary root. Report-only
// without `--check` (exit 0); `--strict` is the older anchors-only gate.
//
// Lives outside tsconfig's rootDir like the other scripts; run via tsx.
// =============================================================================

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

let ROOT = process.cwd();

export interface Finding { check: string; file: string; line: number; text: string; note: string }

export const BASELINE_FILE = "scripts/doc-lint-baseline.json";

export interface DocLintResult { counts: Record<string, number>; findings: Finding[] }

/** Run the lints as the suite does: over `files` (default: every governed
 *  markdown file under `root`), with `root` as the repository root. */
export function lintDocs(opts: { root?: string; files?: string[]; checks?: ("anchors" | "order" | "ids")[] } = {}): DocLintResult {
  const previous = ROOT;
  ROOT = opts.root ?? process.cwd();
  anchorCache.clear();
  try {
    const files = opts.files ?? markdownFiles();
    const checks = opts.checks ?? ["anchors", "order", "ids"];
    const findings: Finding[] = [];
    if (checks.includes("anchors")) findings.push(...lintAnchors(files));
    if (checks.includes("order")) findings.push(...lintOrder(files));
    if (checks.includes("ids")) findings.push(...lintIds(files));
    const counts: Record<string, number> = { anchors: 0, order: 0, ids: 0 };
    for (const f of findings) counts[f.check]++;
    return { counts, findings };
  } finally {
    ROOT = previous;
    anchorCache.clear();
  }
}

export function readBaseline(root: string): { ids: number } {
  return JSON.parse(fs.readFileSync(path.join(root, BASELINE_FILE), "utf-8")) as { ids: number };
}

/** The gate's verdict: anchors and order at zero, ids at or below the baseline. */
export function gateFindings(result: DocLintResult, baseline: { ids: number }): string[] {
  const out: string[] = [];
  if (result.counts.anchors > 0) out.push(`anchors: ${result.counts.anchors} unresolved anchor link(s)`);
  if (result.counts.order > 0) out.push(`order: ${result.counts.order} forward reference(s) in the reading order`);
  if (result.counts.ids > baseline.ids) out.push(`ids: ${result.counts.ids} bare first-use identifier(s), above the baseline of ${baseline.ids} (${BASELINE_FILE})`);
  return out;
}

function markdownFiles(): string[] {
  return execSync("git ls-files --cached --others --exclude-standard '*.md'", { cwd: ROOT, encoding: "utf-8" })
    .split("\n").filter(Boolean)
    .filter((f) => !f.startsWith("docs/plans/archive/") && !f.includes("node_modules"))
    // Agent memory and GitHub templates are not governed documentation (K-001).
    .filter((f) => !f.startsWith(".claude/") && !f.startsWith(".github/"));
}

/** GitHub's heading slug, close enough: lowercase, drop punctuation, spaces to hyphens. */
function headingSlug(text: string): string {
  return text.trim().toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-");
}

const anchorCache = new Map<string, Set<string>>();
function anchorsOf(file: string): Set<string> {
  const cached = anchorCache.get(file);
  if (cached) return cached;
  const set = new Set<string>();
  const abs = path.join(ROOT, file);
  if (fs.existsSync(abs)) {
    const text = fs.readFileSync(abs, "utf-8");
    for (const m of text.matchAll(/<a\s+id="([^"]+)"/g)) set.add(m[1]);
    for (const m of text.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)) set.add(headingSlug(m[1]));
  }
  anchorCache.set(file, set);
  return set;
}

const LINK = /\[([^\]]*)\]\(([^)\s]+)\)/g;

function lintAnchors(files: string[]): Finding[] {
  const out: Finding[] = [];
  for (const file of files) {
    const lines = fs.readFileSync(path.join(ROOT, file), "utf-8").split("\n");
    lines.forEach((text, i) => {
      for (const m of text.matchAll(LINK)) {
        const target = m[2];
        if (/^[a-z]+:/.test(target)) continue;           // http(s), mailto
        const hash = target.indexOf("#");
        if (hash < 0) continue;
        const frag = target.slice(hash + 1);
        const rel = target.slice(0, hash);
        const targetFile = rel === "" ? file : path.normalize(path.join(path.dirname(file), rel));
        if (!fs.existsSync(path.join(ROOT, targetFile))) continue;   // doc-ref-lint reports it
        if (!anchorsOf(targetFile).has(frag)) {
          out.push({ check: "anchors", file, line: i + 1, text: m[0].slice(0, 90), note: `no anchor #${frag} in ${targetFile}` });
        }
      }
    });
  }
  return out;
}

interface Chapter { doc: string | null; title: string; lookahead?: boolean; register?: boolean; record?: boolean; status?: string }
function readingOrder(): { index: Map<string, number>; lookahead: Set<string> } {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/reading-order.json"), "utf-8"));
  const index = new Map<string, number>(); const lookahead = new Set<string>();
  let n = 0;
  for (const part of manifest.parts) for (const ch of part.chapters as Chapter[]) {
    if (!ch.doc || ch.register || ch.record) continue;
    index.set(ch.doc, n++);
    if (ch.lookahead) lookahead.add(ch.doc);
  }
  return { index, lookahead };
}

function lintOrder(files: string[]): Finding[] {
  if (!fs.existsSync(path.join(ROOT, "docs/reading-order.json"))) return [];   // a probe root without an order
  const { index, lookahead } = readingOrder();
  const out: Finding[] = [];
  for (const file of files) {
    const from = index.get(file);
    if (from === undefined || lookahead.has(file)) continue;
    const lines = fs.readFileSync(path.join(ROOT, file), "utf-8").split("\n");
    lines.forEach((text, i) => {
      for (const m of text.matchAll(LINK)) {
        const target = m[2];
        const hash = target.indexOf("#");
        if (hash < 0 || !target.slice(hash + 1).startsWith("def-")) continue;
        const rel = target.slice(0, hash);
        const targetFile = rel === "" ? file : path.normalize(path.join(path.dirname(file), rel));
        const to = index.get(targetFile);
        if (to !== undefined && to > from) {
          out.push({ check: "order", file, line: i + 1, text: m[0].slice(0, 90), note: `forward reference: ${targetFile} comes later in docs/reading-order.json` });
        }
      }
    });
  }
  return out;
}

const ID = /\b((?:D|R|SC|IC|B|W|K|P|M|Q|S|CE-R|E-R|V-R|T-R|CT-R|U-R|R-R)-?\d+[a-z′]?)\b/g;

function lintIds(files: string[]): Finding[] {
  const out: Finding[] = [];
  for (const file of files) {
    // An IR or a review record (B-173) cites identifiers in provenance tags and
    // findings by convention; the IR checks (`npm run lint:ir`) govern them.
    if (file.endsWith(".ir.md") || file.endsWith(".review.md")) continue;
    const lines = fs.readFileSync(path.join(ROOT, file), "utf-8").split("\n");
    // An ID the document itself defines, as a table row's first cell or a
    // bold definition (`**M1** — …`), is never bare in that document.
    const defined = new Set<string>();
    for (const text of lines) {
      const row = text.match(/^\|\s*\*{0,2}((?:D|R|SC|IC|B|W|K|P|M|Q|S|CE-R|E-R|V-R|T-R|CT-R|U-R|R-R)-?\d+[a-z′]?)\*{0,2}\s*\|/);
      if (row) defined.add(row[1]);
      for (const d of text.matchAll(/\*\*((?:D|R|SC|IC|B|W|K|P|M|Q|S|CE-R|E-R|V-R|T-R|CT-R|U-R|R-R)-?\d+[a-z′]?)(?:\*\*)?\s*[—:]/g)) defined.add(d[1]);
      for (const d of text.matchAll(/^#{1,6}\s+((?:D|R|SC|IC|B|W|K|P|M|Q|S|CE-R|E-R|V-R|T-R|CT-R|U-R|R-R)-?\d+[a-z′]?)\s*[—:]/g)) defined.add(d[1]);
    }
    const seen = new Set<string>();
    // Front matter (a stream plan's machine-readable header, B-166) carries
    // IDs as data, like a table: skipped, so the first PROSE use still names.
    let frontMatterEnd = 0;
    if (lines[0]?.trim() === "---") {
      const close = lines.findIndex((l, k) => k > 0 && l.trim() === "---");
      frontMatterEnd = close < 0 ? 0 : close + 1;
    }
    lines.forEach((text, i) => {
      if (i < frontMatterEnd) return;
      if (/^\s*(>\s*)?(\||```)/.test(text)) return;      // table rows (also inside blockquotes) and code carry IDs as data
      for (const m of text.matchAll(ID)) {
        const id = m[1];
        if (seen.has(id) || defined.has(id) || defined.has(id.replace(/′$/, ""))) continue;
        seen.add(id);
        const after = text.slice(m.index! + id.length, m.index! + id.length + 4);
        const before = text.slice(Math.max(0, m.index! - 2), m.index!);
        // Named: `ID (name)`, `[ID (name)](link)`, or a definition site `**ID** — Name` / `ID: Name`.
        const named = /^′?\*{0,2}\s*\(/.test(after) || /^\]\(/.test(after) || before.endsWith("[") || before.endsWith("(")
          || /^′?\*{0,2}\s*[—:]/.test(after);
        if (!named) out.push({ check: "ids", file, line: i + 1, text: text.trim().slice(0, 90), note: `first use of ${id} carries no name` });
      }
    });
  }
  return out;
}

function main(): void {
  const args = process.argv.slice(2);
  const json = args.includes("--json"), strict = args.includes("--strict");
  const check = args.includes("--check"), update = args.includes("--update-baseline");
  const cmd = args.find((a) => !a.startsWith("--")) ?? "all";
  const checks = cmd === "all" ? undefined : [cmd as "anchors" | "order" | "ids"];
  const { counts, findings } = lintDocs({ checks });

  if (update) {
    const baseline = readBaseline(ROOT);
    if (counts.ids > baseline.ids) { console.log(`doc-lint: ids ${counts.ids} is above the baseline ${baseline.ids}; a baseline only falls`); process.exit(1); }
    fs.writeFileSync(path.join(ROOT, BASELINE_FILE), JSON.stringify({ _: "B-150: bare first-use identifiers (scripts/doc-lint.ts ids), a ratchet that may only fall. Lower it with `npx tsx scripts/doc-lint.ts --update-baseline` in its own commit after the branch is up to date with origin/main (CLAUDE.md, the ratchet-baseline rule).", ids: counts.ids }, null, 2) + "\n");
    console.log(`doc-lint: baseline ids ${baseline.ids} → ${counts.ids}`);
    return;
  }
  if (check) {
    const problems = gateFindings({ counts, findings }, readBaseline(ROOT));
    for (const f of findings.filter((x) => x.check !== "ids")) console.log(`  ${f.file}:${f.line}  ${f.text}\n      ${f.note}`);
    for (const p of problems) console.log(`doc-lint: ${p}`);
    console.log(`doc-lint: anchors ${counts.anchors} · order ${counts.order} · ids ${counts.ids} — ${problems.length === 0 ? "gate passed" : "GATE FAILED"}`);
    if (problems.length > 0) process.exit(1);
    return;
  }
  if (json) { console.log(JSON.stringify({ counts, findings }, null, 2)); }
  else {
    for (const check of ["anchors", "order"]) {
      const fs_ = findings.filter((f) => f.check === check);
      if (!fs_.length) continue;
      console.log(`${check}: ${fs_.length} finding(s)`);
      for (const f of fs_) console.log(`  ${f.file}:${f.line}  ${f.text}\n      ${f.note}`);
    }
    const byFile = new Map<string, number>();
    for (const f of findings.filter((x) => x.check === "ids")) byFile.set(f.file, (byFile.get(f.file) ?? 0) + 1);
    if (byFile.size) {
      console.log(`ids: ${counts.ids} bare first-use identifier(s), approximate, by file:`);
      for (const [f, n] of [...byFile].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${f}`);
    }
    console.log(`\ndoc-lint: anchors ${counts.anchors} · order ${counts.order} · ids ${counts.ids} (approximate)`);
  }
  if (strict && counts.anchors > 0) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
