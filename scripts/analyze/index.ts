// =============================================================================
// B-127 — binder-aware code analysis.
//
// The project's surveys have been regexes over source text, and B-121 C2
// measured what that costs: a survey that classified 182 sites correctly and
// missed two whole CLASSES, because neither is expressible as a pattern over
// characters. A named predicate standing in for the question (`isCarrier(v)`
// for *does this carry metadata?*) contains none of the searched token. A
// function with an unnamed side effect (`dataOf` stripping metadata as well
// as peeling) is a property of what the callee returns, not of the call site.
//
// This is not a linter framework. The suite is the gate; these are analyses
// you run when a change needs a survey, and each answers a question the
// binder can answer and a regex cannot.
//
//   npx tsx scripts/analyze/index.ts <command> [args]
//
//   props <name>        every access to `.<name>`, with the receiver's STATIC
//                       type — so an access through an `any` cast is visible
//   any-props           every property access whose receiver is `any`,
//                       grouped by property. The B-137 census, exactly
//   kind-tests [Kind]   every `x.kind === ValueKind.K` comparison, with the
//                       static type of `x` — so "is this subject
//                       definitionally a Structure?" stops being a judgement
//   refs <name>         references to a declaration, resolved by SYMBOL
//                       identity rather than by spelling
//   units               docs/design/units.md measured: every import edge
//                       between assigned files checked against the unit
//                       DAG in units.json; mixed files listed as the owed
//                       splits; direct `.kind ===` comparisons counted
//                       outside the units the discriminator rule allows
//
// Flags: --json, --include=<substr>, --exclude=<substr> (repeatable).
//
// Runs on TypeScript 5's compiler API, alias-installed as `ts-compiler`. The
// project's own gate compiles with `typescript` (7.x), whose package no
// longer exports `createProgram`; the two are deliberately separate so this
// tool cannot change what gates the build. Lives outside tsconfig's rootDir
// by the same convention as bench/ and pcp/.
// =============================================================================

import ts from "ts-compiler";
import * as fs from "node:fs";
import * as path from "node:path";

// --- program ------------------------------------------------------------------

const ROOT = path.resolve(new URL("../..", import.meta.url).pathname);

function loadProgram(): ts.Program {
  const cfgPath = ts.findConfigFile(ROOT, ts.sys.fileExists, "tsconfig.json");
  if (!cfgPath) throw new Error("tsconfig.json not found");
  const cfg = ts.readConfigFile(cfgPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, path.dirname(cfgPath));
  return ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
}

/** Source files we analyse: the project's own, never `node_modules` or `.d.ts`. */
function ownFiles(program: ts.Program, opts: Options): ts.SourceFile[] {
  return program.getSourceFiles().filter((f) => {
    if (f.isDeclarationFile) return false;
    const rel = path.relative(ROOT, f.fileName);
    if (rel.startsWith("..") || rel.includes("node_modules")) return false;
    if (opts.include.length && !opts.include.some((s) => rel.includes(s))) return false;
    if (opts.exclude.some((s) => rel.includes(s))) return false;
    return true;
  });
}

function where(node: ts.Node): string {
  const sf = node.getSourceFile();
  const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart());
  return `${path.relative(ROOT, sf.fileName)}:${line + 1}:${character + 1}`;
}

function walk(node: ts.Node, visit: (n: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (c) => walk(c, visit));
}

// --- the checks ---------------------------------------------------------------

interface Hit { at: string; text: string; note: string }

/** `props` / `any-props`: a property access names a FIELD, and the question
 *  a regex cannot answer is *what is the receiver*. A receiver typed `any`
 *  means the compiler checked nothing — which is how `.primary` survived a
 *  deletion that removed it from every interface. */
function propertyAccesses(
  program: ts.Program, opts: Options, want: string | null,
): Hit[] {
  const checker = program.getTypeChecker();
  const out: Hit[] = [];
  for (const sf of ownFiles(program, opts)) {
    walk(sf, (n) => {
      if (!ts.isPropertyAccessExpression(n)) return;
      const name = n.name.text;
      if (want !== null && name !== want) return;
      const recv = checker.getTypeAtLocation(n.expression);
      const isAny = (recv.flags & ts.TypeFlags.Any) !== 0;
      if (want === null && !isAny) return;   // any-props: only the blind ones
      const recvText = checker.typeToString(recv);
      out.push({
        at: where(n),
        text: n.getText().split("\n")[0].slice(0, 90),
        note: isAny ? `receiver: ANY` : `receiver: ${recvText}`,
      });
    });
  }
  return out;
}

/** `kind-tests`: `x.kind === ValueKind.K`. The binder knows the static type
 *  of `x`, so it can say whether the test narrows anything or restates what
 *  the type already guarantees — the judgement call 23 of B-121 C2's 38 risk
 *  sites turned on. */
function kindTests(program: ts.Program, opts: Options, kind: string | null): Hit[] {
  const checker = program.getTypeChecker();
  const out: Hit[] = [];
  for (const sf of ownFiles(program, opts)) {
    walk(sf, (n) => {
      if (!ts.isBinaryExpression(n)) return;
      const op = n.operatorToken.kind;
      if (op !== ts.SyntaxKind.EqualsEqualsEqualsToken &&
          op !== ts.SyntaxKind.ExclamationEqualsEqualsToken) return;

      // Which side is `<expr>.kind`?
      const left = n.left, right = n.right;
      const isKind = (e: ts.Expression) =>
        ts.isPropertyAccessExpression(e) && e.name.text === "kind";
      let subject: ts.Expression | null = null;
      let other: ts.Expression | null = null;
      if (isKind(left)) { subject = (left as ts.PropertyAccessExpression).expression; other = right; }
      else if (isKind(right)) { subject = (right as ts.PropertyAccessExpression).expression; other = left; }
      if (!subject || !other) return;

      const kindName = other.getText().replace(/^ValueKind\./, "");
      if (kind !== null && kindName !== kind) return;

      const t = checker.getTypeAtLocation(subject);
      const tStr = checker.typeToString(t);
      // A union means the test narrows; a single kind means it does not.
      const narrows = t.isUnion() && t.types.length > 1;
      out.push({
        at: where(n),
        text: n.getText().split("\n")[0].slice(0, 90),
        note: `${narrows ? "narrows" : "NO-OP?"} · subject: ${tStr.slice(0, 70)}`,
      });
    });
  }
  return out;
}

/** `refs`: every reference to a DECLARATION, found through the symbol table.
 *  A predicate's callers are found by binding, so a rename or a re-export
 *  cannot hide one and an unrelated same-spelled local cannot pad the count. */
function references(program: ts.Program, opts: Options, name: string): Hit[] {
  const checker = program.getTypeChecker();
  const targets = new Set<ts.Symbol>();
  const files = ownFiles(program, opts);

  for (const sf of files) {
    walk(sf, (n) => {
      if (!ts.isIdentifier(n) || n.text !== name) return;
      const s = checker.getSymbolAtLocation(n);
      if (!s) return;
      const decls = s.declarations ?? [];
      if (decls.some((d) => ts.isFunctionDeclaration(d) || ts.isVariableDeclaration(d) ||
                            ts.isClassDeclaration(d) || ts.isMethodDeclaration(d) ||
                            ts.isInterfaceDeclaration(d) || ts.isTypeAliasDeclaration(d))) {
        targets.add(s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s);
      }
    });
  }

  const out: Hit[] = [];
  for (const sf of files) {
    walk(sf, (n) => {
      if (!ts.isIdentifier(n) || n.text !== name) return;
      let s = checker.getSymbolAtLocation(n);
      if (!s) return;
      if (s.flags & ts.SymbolFlags.Alias) s = checker.getAliasedSymbol(s);
      if (!targets.has(s)) return;
      const parent = n.parent;
      const role = ts.isCallExpression(parent) && parent.expression === n ? "call"
        : ts.isImportSpecifier(parent) || ts.isImportClause(parent) ? "import"
        : ts.isExportSpecifier(parent) ? "export"
        : parent && (ts.isFunctionDeclaration(parent) || ts.isVariableDeclaration(parent)) ? "declaration"
        : "reference";
      out.push({ at: where(n), text: parent.getText().split("\n")[0].slice(0, 90), note: role });
    });
  }
  return out;
}

// --- units: the DAG in docs/design/units.md, measured ---------------------------

interface UnitManifest {
  units: Record<string, { layer: string; deps: string[] }>;
  files: Record<string, string | string[]>;
  discriminatorAllowed: string[];
}

interface Edge { from: string; to: string; fromUnit: string; toUnit: string; verdict: "ok" | "violation" | "unresolved" }

interface UnitsReport {
  edges: Edge[];
  violations: Edge[];
  unresolved: number;
  mixed: Record<string, string[]>;
  unassigned: string[];
  discriminators: Record<string, number>;
  discriminatorTotal: number;
}

/** Transitive closure of a unit's permitted dependencies. `*` means any. */
function reachable(m: UnitManifest, unit: string): Set<string> | "any" {
  const out = new Set<string>();
  const stack = [unit];
  while (stack.length) {
    const u = stack.pop()!;
    const deps = m.units[u]?.deps ?? [];
    if (deps.includes("*")) return "any";
    for (const d of deps) if (!out.has(d)) { out.add(d); stack.push(d); }
  }
  return out;
}

function unitsReport(program: ts.Program, opts: Options): UnitsReport {
  const m: UnitManifest = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/analyze/units.json"), "utf8"));
  const unitOf = (rel: string): string | string[] | undefined => m.files[rel];

  const edges: Edge[] = [];
  const unassigned = new Set<string>();
  const mixed: Record<string, string[]> = {};
  for (const [f, u] of Object.entries(m.files)) if (Array.isArray(u)) mixed[f] = u;

  // Resolve a relative specifier to a repo-relative path through the program,
  // so re-exports and `.js` → `.ts` are the binder's problem rather than ours.
  const resolve = (from: ts.SourceFile, spec: string): string | null => {
    const r = ts.resolveModuleName(spec, from.fileName, program.getCompilerOptions(), ts.sys);
    const f = r.resolvedModule?.resolvedFileName;
    return f ? path.relative(ROOT, f) : null;
  };

  for (const sf of ownFiles(program, opts)) {
    const rel = path.relative(ROOT, sf.fileName);
    if (!rel.startsWith("src/") || rel.startsWith("src/test/") || rel === "src/boundary-tests.ts") continue;
    const fromUnit = unitOf(rel);
    if (fromUnit === undefined) { unassigned.add(rel); continue; }
    for (const st of sf.statements) {
      if (!ts.isImportDeclaration(st) && !ts.isExportDeclaration(st)) continue;
      const spec = st.moduleSpecifier;
      if (!spec || !ts.isStringLiteral(spec) || !spec.text.startsWith(".")) continue;
      const to = resolve(sf, spec.text);
      if (!to) continue;
      const toUnit = unitOf(to);
      if (toUnit === undefined) { unassigned.add(to); continue; }
      const edge: Edge = {
        from: rel, to,
        fromUnit: Array.isArray(fromUnit) ? `mixed(${fromUnit.join("|")})` : fromUnit,
        toUnit: Array.isArray(toUnit) ? `mixed(${toUnit.join("|")})` : toUnit,
        verdict: "unresolved",
      };
      if (!Array.isArray(fromUnit) && !Array.isArray(toUnit)) {
        const r = reachable(m, fromUnit);
        edge.verdict = fromUnit === toUnit || r === "any" || r.has(toUnit) ? "ok" : "violation";
      }
      edges.push(edge);
    }
  }
  // Discriminator rule (§3.2): direct `.kind ===` comparisons against a
  // ValueKind member, outside the units allowed to dispatch on kind. A
  // mixed file that holds an allowed unit is counted as allowed — the
  // ratchet tightens as the splits land.
  const allowed = new Set(m.discriminatorAllowed);
  const discriminators: Record<string, number> = {};
  let discriminatorTotal = 0;
  for (const h of kindTests(program, opts, null)) {
    if (!/ValueKind\./.test(h.text)) continue;
    const f = h.at.split(":")[0];
    if (!f.startsWith("src/") || f.startsWith("src/test/") || f === "src/boundary-tests.ts") continue;
    const u = unitOf(f);
    const units = u === undefined ? [] : Array.isArray(u) ? u : [u];
    if (units.some((x) => allowed.has(x))) continue;
    discriminators[f] = (discriminators[f] ?? 0) + 1;
    discriminatorTotal++;
  }

  return {
    edges,
    violations: edges.filter((e) => e.verdict === "violation"),
    unresolved: edges.filter((e) => e.verdict === "unresolved").length,
    mixed,
    unassigned: [...unassigned].sort(),
    discriminators,
    discriminatorTotal,
  };
}

function reportUnits(r: UnitsReport, opts: Options): void {
  if (opts.json) { console.log(JSON.stringify(r, null, 2)); return; }
  const ok = r.edges.filter((e) => e.verdict === "ok").length;
  console.log(`units — docs/design/units.md measured\n`);
  console.log(`  import edges between assigned files: ${r.edges.length}`);
  console.log(`    ok          ${ok}`);
  console.log(`    violation   ${r.violations.length}`);
  console.log(`    unresolved  ${r.unresolved}   (one end is a mixed file — an owed split, not a verdict)\n`);
  if (r.violations.length) {
    console.log("  violations (an edge the DAG does not permit):");
    for (const e of r.violations) console.log(`    ${e.fromUnit} → ${e.toUnit}   ${e.from} → ${e.to}`);
    console.log("");
  }
  const mixedFiles = Object.keys(r.mixed);
  console.log(`  mixed files (owed splits): ${mixedFiles.length}`);
  for (const f of mixedFiles) console.log(`    ${f.padEnd(28)} ${r.mixed[f].join(", ")}`);
  if (r.unassigned.length) {
    console.log(`\n  unassigned files (not in units.json): ${r.unassigned.length}`);
    for (const f of r.unassigned) console.log(`    ${f}`);
  }
  console.log(`\n  discriminator rule: ${r.discriminatorTotal} direct kind comparisons outside allowed units`);
  for (const [f, n] of Object.entries(r.discriminators).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(n).padStart(4)}  ${f}`);
  }
}

// --- cli ----------------------------------------------------------------------

interface Options { include: string[]; exclude: string[]; json: boolean }

function parseArgs(argv: string[]): { cmd: string; rest: string[]; opts: Options } {
  const opts: Options = { include: [], exclude: [], json: false };
  const rest: string[] = [];
  let cmd = "";
  for (const a of argv) {
    if (a === "--json") opts.json = true;
    else if (a.startsWith("--include=")) opts.include.push(a.slice(10));
    else if (a.startsWith("--exclude=")) opts.exclude.push(a.slice(10));
    else if (!cmd) cmd = a;
    else rest.push(a);
  }
  return { cmd, rest, opts };
}

function report(title: string, hits: Hit[], opts: Options): void {
  if (opts.json) { console.log(JSON.stringify({ title, count: hits.length, hits }, null, 2)); return; }
  console.log(`${title} — ${hits.length} site(s)\n`);
  for (const h of hits) console.log(`  ${h.at}\n      ${h.text}\n      ${h.note}`);
  if (hits.length) console.log("");
  // A per-file roll-up is what a survey actually reads.
  const byFile = new Map<string, number>();
  for (const h of hits) {
    const f = h.at.split(":")[0];
    byFile.set(f, (byFile.get(f) ?? 0) + 1);
  }
  if (byFile.size > 1) {
    console.log("  by file:");
    for (const [f, n] of [...byFile].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${String(n).padStart(4)}  ${f}`);
    }
  }
}

function main(): void {
  const { cmd, rest, opts } = parseArgs(process.argv.slice(2));
  if (!cmd || cmd === "help") {
    console.log("commands: props <name> | any-props | kind-tests [Kind] | refs <name> | units");
    console.log("flags:    --json --include=<substr> --exclude=<substr>");
    return;
  }
  const program = loadProgram();
  switch (cmd) {
    case "props": {
      if (!rest[0]) throw new Error("props needs a property name");
      report(`property accesses to .${rest[0]}`, propertyAccesses(program, opts, rest[0]), opts);
      break;
    }
    case "any-props":
      report("property accesses on an `any` receiver", propertyAccesses(program, opts, null), opts);
      break;
    case "kind-tests":
      report(`kind comparisons${rest[0] ? ` against ${rest[0]}` : ""}`, kindTests(program, opts, rest[0] ?? null), opts);
      break;
    case "refs": {
      if (!rest[0]) throw new Error("refs needs a symbol name");
      report(`references to ${rest[0]}`, references(program, opts, rest[0]), opts);
      break;
    }
    case "units":
      reportUnits(unitsReport(program, opts), opts);
      break;
    default:
      throw new Error(`unknown command: ${cmd}`);
  }
}

main();
