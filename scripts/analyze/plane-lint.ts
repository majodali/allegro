// =============================================================================
// B-128(a) — the storage plane is policed by the binder, not by a regex.
//
// B-121 C2 broke eleven sites that reached past an interface at a
// representation detail, and every failure was SILENT — a check stopped
// firing rather than throwing. The existing boundary lint (`src/
// boundary-tests.ts`) forbids `"__"` string literals outside the accessor
// layer, which is the same idea over the one thing a regex can see.
//
// This check reads the receiver's STATIC TYPE, so it can tell
// `structure.entries` from `Object.entries` — which matters: of the 21
// `.entries` accesses outside the accessor layer, **zero** are on a
// Structure. A regex would report all 21.
//
//   npx tsx scripts/analyze/plane-lint.ts [--update-baseline] [--json]
//
// Fields are policed at one of two levels:
//   closed   — must be ZERO outside the accessor layer; any hit fails
//   ratchet  — a committed count that may fall and must never rise
//
// The accessor layer is `src/structure.ts` (the representation) and
// `src/slots.ts` (the read/write surface over it). Tests are exempt: the
// boundary battery's job is to reach past interfaces and check what it finds.
// =============================================================================

import ts from "ts-compiler";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(new URL("../..", import.meta.url).pathname);
const BASELINE = path.join(ROOT, "scripts/analyze/plane-baseline.json");

/** The accessor layer — the only modules that may name the storage. */
const ACCESSOR_LAYER = ["src/structure.ts", "src/slots.ts"];

/** Receivers we police. A field is storage only when it sits on one of these. */
const STORAGE_TYPES = new Set(["Structure", "StructureValue"]);

interface Rule { field: string; level: "closed" | "ratchet"; why: string }

const RULES: Rule[] = [
  {
    field: "meta",
    level: "closed",
    why: "the metadata plane's storage. B-121 drove it to zero outside the " +
         "accessor layer; `metaOf` / `metaReadRaw` / `withMeta` are the surface",
  },
  {
    field: "entries",
    level: "closed",
    why: "THE slot store (B-120 E3). Already zero on a Structure outside the " +
         "accessor layer — this keeps it there",
  },
  {
    field: "bindingList",
    level: "ratchet",
    why: "the store under its older name. Still reached directly, mostly by " +
         "runtime.ts; the ratchet stops it growing while B-112 supplies the " +
         "interface that would replace it",
  },
];

// `bindings` is deliberately NOT policed. Since B-120 E3 it is a DERIVED,
// read-only view declared on StructureValue — the sanctioned way to read the
// slot plane by name, not the storage. B-128's row listed it as storage; that
// was true before E3 and is not now.

interface Violation { at: string; field: string; text: string }

function loadProgram(): ts.Program {
  const cfgPath = ts.findConfigFile(ROOT, ts.sys.fileExists, "tsconfig.json");
  if (!cfgPath) throw new Error("tsconfig.json not found");
  const cfg = ts.readConfigFile(cfgPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, path.dirname(cfgPath));
  return ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
}

function policed(rel: string): boolean {
  if (rel.startsWith("..") || rel.includes("node_modules")) return false;
  if (rel === "src/parser.ts") return false;                 // generated, @ts-nocheck
  if (rel.startsWith("src/test/")) return false;             // tests may reach
  if (rel === "src/boundary-tests.ts") return false;         // ditto, by design
  if (ACCESSOR_LAYER.includes(rel)) return false;
  return rel.startsWith("src/");
}

function scan(program: ts.Program): Violation[] {
  const checker = program.getTypeChecker();
  const byField = new Map(RULES.map((r) => [r.field, r]));
  const out: Violation[] = [];

  for (const sf of program.getSourceFiles()) {
    if (sf.isDeclarationFile) continue;
    const rel = path.relative(ROOT, sf.fileName);
    if (!policed(rel)) continue;

    const walk = (n: ts.Node): void => {
      if (ts.isPropertyAccessExpression(n) && byField.has(n.name.text)) {
        const t = checker.getTypeAtLocation(n.expression);
        // The point of the binder: `Object.entries` is not the slot store.
        const name = t.getSymbol()?.getName() ?? checker.typeToString(t);
        const isAny = (t.flags & ts.TypeFlags.Any) !== 0;
        if (STORAGE_TYPES.has(name) || (isAny && looksStructural(n))) {
          const { line } = sf.getLineAndCharacterOfPosition(n.getStart());
          out.push({ at: `${rel}:${line + 1}`, field: n.name.text, text: n.getText().slice(0, 70) });
        }
      }
      ts.forEachChild(n, walk);
    };
    walk(sf);
  }
  return out;
}

/** An `any` receiver hides the type, so the field name is all we have. These
 *  three are not names anything else in this codebase carries — counting them
 *  is deliberately conservative, because an `any` is exactly how a violation
 *  escaped notice before (B-127). */
function looksStructural(n: ts.PropertyAccessExpression): boolean {
  return n.name.text !== "entries";   // `Object.entries` on an `any` is common
}

function main(): void {
  const args = process.argv.slice(2);
  const violations = scan(loadProgram());

  const counts: Record<string, number> = {};
  for (const r of RULES) counts[r.field] = 0;
  for (const v of violations) counts[v.field]++;

  if (args.includes("--update-baseline")) {
    fs.writeFileSync(BASELINE, JSON.stringify({ counts }, null, 2) + "\n");
    console.log("plane-lint: baseline written", JSON.stringify(counts));
    return;
  }

  const baseline: Record<string, number> =
    fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, "utf8")).counts : {};

  if (args.includes("--json")) {
    console.log(JSON.stringify({ counts, baseline, violations }, null, 2));
    return;
  }

  let failed = false;
  for (const r of RULES) {
    const n = counts[r.field];
    const base = baseline[r.field] ?? 0;
    if (r.level === "closed" && n > 0) {
      failed = true;
      console.log(`FAIL  .${r.field} is CLOSED outside the accessor layer — ${n} site(s)`);
      console.log(`      ${r.why}`);
      for (const v of violations.filter((x) => x.field === r.field)) {
        console.log(`        ${v.at}  ${v.text}`);
      }
    } else if (r.level === "ratchet" && n > base) {
      failed = true;
      console.log(`FAIL  .${r.field} rose from ${base} to ${n} — the ratchet only falls`);
      console.log(`      ${r.why}`);
      for (const v of violations.filter((x) => x.field === r.field)) {
        console.log(`        ${v.at}  ${v.text}`);
      }
    } else if (r.level === "ratchet" && n < base) {
      console.log(`ok    .${r.field} ${n} (baseline ${base}) — fell; run --update-baseline to lock it in`);
    } else {
      console.log(`ok    .${r.field} ${n}${r.level === "ratchet" ? ` (baseline ${base})` : " — closed"}`);
    }
  }
  if (failed) { console.log("\nplane-lint FAILED"); process.exit(1); }
  console.log("\nplane-lint: the storage plane is reached only through the accessor layer");
}

main();
