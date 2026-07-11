// Doc-reference lint (PROCESS §10): every root-anchored `docs/…`,
// `.claude/plans/…`, `.claude/memory/…` (or bare `memory/…`) *.md path
// mentioned in a tracked markdown file must resolve. Dangling references
// are how this project lost its thesis document for months.
//
// Scope: tracked *.md files, excluding `.claude/plans/archive/` (history —
// its references are frozen) and node_modules. Glob-ish mentions
// (`docs/design/*.md`), ellipses (`docs/…`), and placeholders
// (`<layer>`) never match the path pattern, so prose stays lintable.
//
// Run standalone: npx tsx scripts/doc-ref-lint.ts
// Also invoked as a test from src/test.ts.

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

export interface DocRefFinding {
  file: string;
  line: number;
  ref: string;
}

const REF_PATTERNS = [
  /\bdocs\/[A-Za-z0-9_\-./]+\.md\b/g,
  /\.claude\/(?:plans|memory)\/[A-Za-z0-9_\-./]+\.md\b/g,
  // bare `memory/…` (a recurring stale form; canonical form is
  // `.claude/memory/…`) — lookbehind excludes the `.claude/memory` hits
  /(?<![\w./])memory\/[A-Za-z0-9_\-./]+\.md\b/g,
];

export function lintDocRefs(repoRoot: string): DocRefFinding[] {
  const tracked = execSync("git ls-files '*.md'", {
    cwd: repoRoot,
    encoding: "utf-8",
  })
    .split("\n")
    .filter(Boolean)
    .filter(
      (f) =>
        !f.startsWith(".claude/plans/archive/") && !f.includes("node_modules")
    );

  const findings: DocRefFinding[] = [];
  for (const file of tracked) {
    const lines = fs
      .readFileSync(path.join(repoRoot, file), "utf-8")
      .split("\n");
    lines.forEach((text, i) => {
      for (const pattern of REF_PATTERNS) {
        for (const m of text.matchAll(pattern)) {
          const ref = m[0];
          if (!fs.existsSync(path.join(repoRoot, ref))) {
            findings.push({ file, line: i + 1, ref });
          }
        }
      }
    });
  }
  return findings;
}

// Standalone CLI entry.
const isMain = process.argv[1] && process.argv[1].endsWith("doc-ref-lint.ts");
if (isMain) {
  const findings = lintDocRefs(process.cwd());
  if (findings.length === 0) {
    console.log("doc-ref-lint: all markdown doc references resolve");
  } else {
    console.error(`doc-ref-lint: ${findings.length} dangling reference(s):`);
    for (const f of findings) {
      console.error(`  ${f.file}:${f.line} → ${f.ref}`);
    }
    process.exit(1);
  }
}
