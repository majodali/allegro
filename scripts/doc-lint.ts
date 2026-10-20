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
// Report-only by default (exit 0). `--strict` exits 1 on any anchor finding,
// which is the only check deterministic enough to gate; B-150 files the
// baselines for the other two.
//
// Lives outside tsconfig's rootDir like the other scripts; run via tsx.
// =============================================================================

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = process.cwd();

interface Finding { check: string; file: string; line: number; text: string; note: string }

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
    const lines = fs.readFileSync(path.join(ROOT, file), "utf-8").split("\n");
    const seen = new Set<string>();
    lines.forEach((text, i) => {
      if (/^\s*(\||```)/.test(text)) return;             // table rows and code carry IDs as data
      for (const m of text.matchAll(ID)) {
        const id = m[1];
        if (seen.has(id)) continue;
        seen.add(id);
        const after = text.slice(m.index! + id.length, m.index! + id.length + 4);
        const before = text.slice(Math.max(0, m.index! - 2), m.index!);
        const named = /^\*{0,2}\s*\(/.test(after) || /^\]\(/.test(after) || before.endsWith("[") || before.endsWith("(");
        if (!named) out.push({ check: "ids", file, line: i + 1, text: text.trim().slice(0, 90), note: `first use of ${id} carries no name` });
      }
    });
  }
  return out;
}

function main(): void {
  const args = process.argv.slice(2);
  const json = args.includes("--json"), strict = args.includes("--strict");
  const cmd = args.find((a) => !a.startsWith("--")) ?? "all";
  const files = markdownFiles();
  const findings: Finding[] = [];
  if (cmd === "anchors" || cmd === "all") findings.push(...lintAnchors(files));
  if (cmd === "order" || cmd === "all") findings.push(...lintOrder(files));
  if (cmd === "ids" || cmd === "all") findings.push(...lintIds(files));

  const counts: Record<string, number> = { anchors: 0, order: 0, ids: 0 };
  for (const f of findings) counts[f.check]++;
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

main();
