// =============================================================================
// Boundary-test harness — structures-implementation Phase 0 (C0.1 / B-001)
//
// Four instruments, per `.claude/plans/structures-implementation.md` §Phase 0
// and the boundary contracts in `docs/design/*/README.md`:
//
//   1. Boundary lint — counts forbidden direct-access patterns in production
//      sources against a committed baseline (`src/boundary-baseline.json`).
//      Ratchet semantics: a count INCREASE fails; a decrease prints a
//      tighten-the-baseline note. When the baseline's `hardFail` flag flips
//      (chunk C1.3), any violation outside `allowedFiles` fails outright.
//   2. Invariant property checks — a deterministic generator builds small
//      typed programs via the public `evalSource` surface and walks every
//      resulting value asserting the standing well-formedness invariants
//      (W1 MultiValue non-nesting, W2 type-component shape). New invariants
//      (transparency, key-sort partition, immutability) join per phase.
//   3. Forgery-scenario skeleton — the D21 scenarios A–F as named, visible,
//      skipped entries; each chunk that makes one testable un-skips it.
//   4. Baseline snapshot — basics.alg output equivalence, a suite-count
//      floor (mass-disablement tripwire, enforced in test.ts's summary),
//      and a coarse perf floor (warn-only in Phase 0; hard threshold is a
//      maintainer decision — see plan §5).
//
// Regenerate lint counts + perf after a migration chunk:
//   npx tsx src/boundary-tests.ts --write-baseline
// =============================================================================

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { evalSource, Extension } from "./runtime.js";
import { createTypeSystem } from "./types-std.js";
import { Value, ValueKind, ContextValue, MultiValueType, primaryOf } from "./types.js";
import { isRegisteredSlotKey, isRegisteredComponentKey, asContext, getName, getMembers, channelReadRaw, SLOT_REGISTRY } from "./slots.js";
import { bitsToString, BitsValue } from "./types.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const BASELINE_PATH = path.join(REPO_ROOT, "src", "boundary-baseline.json");

// --- Baseline shape ---------------------------------------------------------

interface BoundaryBaseline {
  note: string;
  /** C1.3 flips this: violations outside allowedFiles fail regardless of counts. */
  hardFail: boolean;
  /** Accessor-layer module(s) where direct slot access is sanctioned (C1.1+). */
  allowedFiles: string[];
  /** file → pattern name → occurrence count. Ratchet: may only go down. */
  lint: Record<string, Record<string, number>>;
  /** Mass-disablement tripwire: total suite tests must not drop below this. */
  suiteFloor: number;
  /** Expected print output of basics.alg under the standard type system. */
  basicsOutput: string[];
  perf: {
    machineNote: string;
    warnFactor: number;
    /** workload name → milliseconds recorded at baseline time. */
    workloadsMs: Record<string, number>;
  };
}

export function loadBaseline(): BoundaryBaseline {
  return JSON.parse(fs.readFileSync(BASELINE_PATH, "utf-8"));
}

export function getSuiteFloor(): number {
  return loadBaseline().suiteFloor;
}

// --- 1. Boundary lint --------------------------------------------------------

interface LintPattern {
  name: string;
  regex: RegExp;
  /** Files where the pattern is inherently legitimate (e.g. definition site). */
  excludeFiles?: string[];
}

// The forbidden-access patterns the accessor layer (C1.1–C1.3) will absorb.
const LINT_PATTERNS: LintPattern[] = [
  { name: "components-direct", regex: /\.components\b/g },
  { name: "dunder-string-literal", regex: /["']__[A-Za-z0-9_]*["']/g },
  { name: "bindings-get-dunder", regex: /bindings\.get\(\s*["']__/g },
  // primaryOf's strip-vs-preserve asymmetry is retired by C1.5/C4.3; its
  // definition site is exempt.
  { name: "primaryOf-call", regex: /\bprimaryOf\s*\(/g, excludeFiles: ["src/types.ts"] },
];

// Production sources only. test.ts pokes internals as test setup by design;
// parser.ts is generated; this file contains the patterns as regexes.
const SCAN_EXCLUDE = new Set([
  "src/parser.ts",
  "src/test.ts",
  "src/boundary-tests.ts",
]);

function productionSources(): string[] {
  // --others --exclude-standard includes untracked files: a brand-new module
  // full of violations must be visible to the ratchet before its first commit.
  return execSync("git ls-files --cached --others --exclude-standard 'src/*.ts' 'src/**/*.ts'", {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  })
    .split("\n")
    .filter(Boolean)
    .filter((f) => !SCAN_EXCLUDE.has(f));
}

export function countLintViolations(): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  for (const file of productionSources()) {
    const text = fs.readFileSync(path.join(REPO_ROOT, file), "utf-8");
    for (const p of LINT_PATTERNS) {
      if (p.excludeFiles?.includes(file)) continue;
      const count = [...text.matchAll(p.regex)].length;
      if (count > 0) {
        (result[file] ??= {})[p.name] = count;
      }
    }
  }
  return result;
}

interface LintReport {
  /** file:pattern entries whose count exceeds baseline (or exists under hardFail). */
  breaches: string[];
  /** file:pattern entries now below baseline — tighten the committed counts. */
  tightenable: string[];
  totalViolations: number;
}

export function runBoundaryLint(baseline: BoundaryBaseline): LintReport {
  const current = countLintViolations();
  const breaches: string[] = [];
  const tightenable: string[] = [];
  let total = 0;

  for (const [file, patterns] of Object.entries(current)) {
    for (const [pattern, count] of Object.entries(patterns)) {
      total += count;
      // The accessor module is the sanctioned home for slot access — exempt
      // from the ratchet in both modes.
      if (baseline.allowedFiles.includes(file)) continue;
      const base = baseline.lint[file]?.[pattern] ?? 0;
      if (baseline.hardFail && count > 0) {
        breaches.push(`${file} [${pattern}]: ${count} (hard-fail mode)`);
      } else if (count > base) {
        breaches.push(`${file} [${pattern}]: ${count} > baseline ${base}`);
      } else if (count < base) {
        tightenable.push(`${file} [${pattern}]: ${count} < baseline ${base}`);
      }
    }
  }
  // Entries that vanished entirely are tightenable too.
  for (const [file, patterns] of Object.entries(baseline.lint)) {
    for (const [pattern, base] of Object.entries(patterns)) {
      if (base > 0 && (current[file]?.[pattern] ?? 0) === 0 && !(current[file]?.[pattern] === undefined && !fs.existsSync(path.join(REPO_ROOT, file)))) {
        if ((current[file]?.[pattern] ?? 0) === 0) {
          tightenable.push(`${file} [${pattern}]: 0 < baseline ${base}`);
        }
      }
    }
  }
  return { breaches, tightenable: [...new Set(tightenable)], totalViolations: total };
}

// --- 2. Invariant property checks ---------------------------------------------

/** Deterministic PRNG (mulberry32) — same programs every run, no Math.random. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const pick = <T,>(rng: Rng, xs: T[]): T => xs[Math.floor(rng() * xs.length)];
const rint = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

/** Generate a well-typed-by-construction expression of the given sort. */
function genExpr(rng: Rng, sort: "int" | "bool" | "str", depth: number, intVars: string[], strVars: string[]): string {
  if (sort === "int") {
    if (depth <= 0 || rng() < 0.35) {
      if (intVars.length > 0 && rng() < 0.4) return pick(rng, intVars);
      return String(rint(rng, 0, 99));
    }
    const r = rng();
    if (r < 0.6) {
      const op = pick(rng, ["+", "-", "*"]);
      return `(${genExpr(rng, "int", depth - 1, intVars, strVars)} ${op} ${genExpr(rng, "int", depth - 1, intVars, strVars)})`;
    }
    return `(if ${genExpr(rng, "bool", depth - 1, intVars, strVars)} then ${genExpr(rng, "int", depth - 1, intVars, strVars)} else ${genExpr(rng, "int", depth - 1, intVars, strVars)})`;
  }
  if (sort === "bool") {
    if (depth <= 0 || rng() < 0.3) return pick(rng, ["true", "false"]);
    const r = rng();
    if (r < 0.5) {
      const op = pick(rng, ["==", "!=", "<", ">", "<=", ">="]);
      return `(${genExpr(rng, "int", depth - 1, intVars, strVars)} ${op} ${genExpr(rng, "int", depth - 1, intVars, strVars)})`;
    }
    if (r < 0.8) {
      const op = pick(rng, ["&&", "||"]);
      return `(${genExpr(rng, "bool", depth - 1, intVars, strVars)} ${op} ${genExpr(rng, "bool", depth - 1, intVars, strVars)})`;
    }
    return `(!${genExpr(rng, "bool", depth - 1, intVars, strVars)})`;
  }
  // str
  if (depth <= 0 || rng() < 0.45) {
    if (strVars.length > 0 && rng() < 0.4) return pick(rng, strVars);
    return `"${pick(rng, ["ab", "xyz", "hello", "q"])}"`;
  }
  return `(${genExpr(rng, "str", depth - 1, intVars, strVars)} + ${genExpr(rng, "str", depth - 1, intVars, strVars)})`;
}

/** A small program: typed bindings (ints, strings, bools, an array, an
 *  object with field access) ending in a bare expression. */
export function genProgram(rng: Rng): string {
  const lines: string[] = [];
  const intVars: string[] = [];
  const strVars: string[] = [];
  const n = rint(rng, 3, 6);
  for (let i = 0; i < n; i++) {
    const v = `v${i}`;
    const kind = rng();
    if (kind < 0.45) {
      lines.push(`${v} = ${genExpr(rng, "int", 3, intVars, strVars)}`);
      intVars.push(v);
    } else if (kind < 0.65) {
      lines.push(`${v} = ${genExpr(rng, "str", 2, intVars, strVars)}`);
      strVars.push(v);
    } else if (kind < 0.8) {
      lines.push(`${v} = ${genExpr(rng, "bool", 2, intVars, strVars)}`);
    } else if (kind < 0.9) {
      const items = Array.from({ length: rint(rng, 2, 4) }, () =>
        genExpr(rng, "int", 1, intVars, strVars)
      );
      lines.push(`${v} = [${items.join(", ")}]`);
      lines.push(`${v}x = ${v}[${rint(rng, 0, items.length - 1)}]`);
      intVars.push(`${v}x`);
    } else {
      lines.push(`${v} = {a: ${genExpr(rng, "int", 1, intVars, strVars)}, b: ${genExpr(rng, "str", 1, intVars, strVars)}}`);
      lines.push(`${v}a = ${v}.a`);
      intVars.push(`${v}a`);
    }
  }
  lines.push(genExpr(rng, "int", 2, intVars, strVars));
  return lines.join("\n");
}

export interface InvariantViolation {
  invariant: string;
  detail: string;
  program: string;
}

/** Walk a value tree checking well-formedness invariants.
 *  W1: a MultiValue's primary is never itself a MultiValue.
 *  W2: a resolved `type` component's primary is a Context.
 *  W3 (C1.1): every `__*` Context-binding key and every MultiValue
 *  component key is covered by the slot registry (`src/slots.ts`) —
 *  the D39 "no new `__*` slot" rule enforced mechanically.
 *  (Grows per phase: transparency, key-sort partition, immutability.) */
export function checkValueInvariants(v: Value | null | undefined, program: string, out: InvariantViolation[], seen: WeakSet<object> = new WeakSet(), depth = 0): void {
  if (!v || typeof v !== "object" || depth > 24) return;
  if (seen.has(v)) return;
  seen.add(v);

  if (v.kind === ValueKind.MultiValue) {
    const mv = v as MultiValueType;
    if (mv.primary && (mv.primary as Value).kind === ValueKind.MultiValue) {
      out.push({ invariant: "W1 multivalue-non-nesting", detail: "MultiValue primary is itself a MultiValue", program });
    }
    const typeComp = mv.components.get("type");
    if (typeComp && (typeComp as Value).kind !== ValueKind.Expression) {
      const tp = primaryOf(typeComp as Value);
      if (!tp || tp.kind !== ValueKind.Context) {
        out.push({ invariant: "W2 type-component-shape", detail: `type component primary has kind ${tp?.kind}`, program });
      }
    }
    for (const key of mv.components.keys()) {
      if (!isRegisteredComponentKey(key)) {
        out.push({ invariant: "W3 registry-completeness", detail: `unregistered MultiValue component key "${key}"`, program });
      }
    }
    checkValueInvariants(mv.primary as Value, program, out, seen, depth + 1);
    for (const comp of mv.components.values()) checkValueInvariants(comp as Value, program, out, seen, depth + 1);
    return;
  }
  if (v.kind === ValueKind.Context) {
    for (const [key, b] of (v as ContextValue).bindings) {
      if (key.startsWith("__") && !isRegisteredSlotKey(key)) {
        out.push({ invariant: "W3 registry-completeness", detail: `unregistered slot key "${key}"`, program });
      }
      checkValueInvariants(b.value as Value, program, out, seen, depth + 1);
    }
    return;
  }
  if (v.kind === ValueKind.Expression) {
    const e = v as any;
    checkValueInvariants(e.fn, program, out, seen, depth + 1);
    for (const a of e.args ?? []) checkValueInvariants(a, program, out, seen, depth + 1);
    return;
  }
  if (v.kind === ValueKind.ComposedFunction) {
    checkValueInvariants((v as any).body, program, out, seen, depth + 1);
  }
}

/** C1.1 registry-completeness corpus: every self-contained tests/*.alg file
 *  (no `use`/`import` header — those need the module loader) is evaluated
 *  and its full binding environment walked. Types, refinements, interfaces,
 *  mixins, proofs, generics — the richest meta-slot surface we have. */
export function runRegistryCompletenessCorpus(): { files: number; walked: number; violations: InvariantViolation[] } {
  const violations: InvariantViolation[] = [];
  const testDir = path.join(REPO_ROOT, "tests");
  const files = fs.readdirSync(testDir).filter((f) => f.endsWith(".alg"));
  let walked = 0;
  for (const f of files) {
    const source = fs.readFileSync(path.join(testDir, f), "utf-8");
    if (/^\s*(use|import)\s/m.test(source)) continue;
    const origLog = console.log;
    console.log = () => {};
    try {
      const { value, evalCtx } = evalSource(source, undefined, [createTypeSystem()], undefined, true);
      walked++;
      const seen = new WeakSet<object>();
      checkValueInvariants(value, f, violations, seen);
      for (const b of evalCtx.bindings.values()) {
        checkValueInvariants(b.value as Value, f, violations, seen);
      }
    } catch {
      // Files needing loader context (or expecting halts) are exercised by
      // the main suite; the corpus walk only inspects what evaluates here.
    } finally {
      console.log = origLog;
    }
  }
  return { files: files.length, walked, violations };
}

export interface PropertyRunResult {
  programs: number;
  succeeded: number;
  violations: InvariantViolation[];
}

export function runInvariantPropertyChecks(programCount = 40, seed = 0xa11e6120): PropertyRunResult {
  const rng = mulberry32(seed);
  const violations: InvariantViolation[] = [];
  let succeeded = 0;
  for (let i = 0; i < programCount; i++) {
    const program = genProgram(rng);
    const exts: Extension[] = [createTypeSystem()];
    try {
      const { value, evalCtx } = evalSource(program, undefined, exts, undefined, true);
      succeeded++;
      const seen = new WeakSet<object>();
      checkValueInvariants(value, program, violations, seen);
      for (const b of evalCtx.bindings.values()) {
        checkValueInvariants(b.value as Value, program, violations, seen);
      }
    } catch {
      // A throw on a generated program is a generator defect, tracked via
      // the success-rate assertion, not an invariant violation.
    }
  }
  return { programs: programCount, succeeded, violations };
}

// --- 3. Forgery-scenario skeleton ---------------------------------------------

export interface ForgeryScenario {
  id: string;
  name: string;
  blockedBy: string;
  unlocksAt: string;
}

/** D21's verification log (design log B10). Skipped until the mechanism each
 *  scenario attacks exists; the owning chunk un-skips it. */
export const FORGERY_SCENARIOS: ForgeryScenario[] = [
  { id: "A", name: "forge `discharged` from nothing", blockedBy: "origination requires the kernel-held writer", unlocksAt: "C1.4" },
  { id: "B", name: "swap a real proof's proposition, keep `discharged`", blockedBy: "data-immutability (D22)", unlocksAt: "C1.4" },
  { id: "C", name: "combine a real proof with a fake operand hoping `discharged` propagates", blockedBy: "non-fabricating propagation rules on authority channels", unlocksAt: "C1.5" },
  { id: "D", name: "read a real `discharged`, write it onto a fake value", blockedBy: "reads are free; the write still needs the capability", unlocksAt: "C1.4" },
  { id: "E", name: "capability leak through an export surface", blockedBy: "holder keeps the writer module-private (ocap discipline)", unlocksAt: "S3 visibility enforcement" },
  { id: "F", name: "forge the writer capability itself", blockedBy: "writer is a PrimitiveFunction closure, unconstructible from Allegretto", unlocksAt: "C1.4" },
];

// --- 4. Baseline snapshot ------------------------------------------------------

/** Run basics.alg through the standard type system, capturing print output. */
export function runBasicsCapture(): string[] {
  const source = fs.readFileSync(path.join(REPO_ROOT, "basics.alg"), "utf-8");
  const captured: string[] = [];
  const origLog = console.log;
  console.log = (...args: unknown[]) => { captured.push(args.map(String).join(" ")); };
  try {
    evalSource(source, undefined, [createTypeSystem()], undefined, true);
  } finally {
    console.log = origLog;
  }
  return captured;
}

/** Fixed representative workloads for the coarse perf floor. */
export function runPerfWorkloads(): Record<string, number> {
  const time = (fn: () => void): number => {
    const t0 = performance.now();
    fn();
    return Math.round(performance.now() - t0);
  };
  const std = () => [createTypeSystem()];
  const out: Record<string, number> = {};
  out["basics"] = time(() => {
    const source = fs.readFileSync(path.join(REPO_ROOT, "basics.alg"), "utf-8");
    const origLog = console.log;
    console.log = () => {};
    try { evalSource(source, undefined, std(), undefined, true); } finally { console.log = origLog; }
  });
  out["recursion-tco"] = time(() => {
    evalSource(
      "countdown(n: Int): Int => if n == 0 then 0 else countdown(n - 1)\ncountdown(50000)",
      undefined, std(), undefined, true
    );
  });
  out["collections"] = time(() => {
    const items = Array.from({ length: 40 }, (_, i) => String(i)).join(", ");
    evalSource(
      `nums = [${items}]\nnums.map(x => x * 2).filter(x => x > 10).reduce((a, x) => a + x, 0)`,
      undefined, std(), undefined, true
    );
  });
  return out;
}

// --- Harness entry (wired from src/test.ts) -----------------------------------

interface Hooks {
  test: (name: string, fn: () => void) => void;
  eq: (actual: unknown, expected: unknown, label?: string) => void;
}

export function runBoundaryTests({ test, eq }: Hooks): void {
  const baseline = loadBaseline();

  test("boundary lint: no forbidden-access pattern exceeds the committed baseline", () => {
    const report = runBoundaryLint(baseline);
    eq(report.breaches.join("; "), "", "ratchet breaches (count may only go down)");
    if (report.tightenable.length > 0) {
      console.log(
        `    ↓ boundary lint: ${report.tightenable.length} entr${report.tightenable.length === 1 ? "y is" : "ies are"} below baseline — run \`npx tsx src/boundary-tests.ts --write-baseline\` to ratchet`
      );
    }
  });

  test("boundary invariants: generated-program value walk (W1 non-nesting, W2 type shape)", () => {
    const result = runInvariantPropertyChecks();
    const rendered = result.violations
      .slice(0, 3)
      .map((v) => `${v.invariant}: ${v.detail}`)
      .join("; ");
    eq(rendered, "", `invariant violations (${result.violations.length} total)`);
    eq(result.succeeded >= result.programs * 0.8, true, `generator success rate ${result.succeeded}/${result.programs}`);
  });

  test("slot accessors (C1.1): read the current representation correctly", () => {
    const { evalCtx } = evalSource(
      "theorem t: 1 + 1 == 2\nx = 42",
      undefined, [createTypeSystem()], undefined, true
    );
    // Type binding: MultiValue(IntType, {type: Type}) — asContext peels it.
    const intCtx = asContext(evalCtx.bindings.get("Int")?.value as Value);
    eq(intCtx !== null, true, "Int peels to a Context");
    const namePrimary = primaryOf(getName(intCtx!) as Value) as BitsValue;
    eq(bitsToString(namePrimary), "Int", "getName reads __name");
    const members = asContext(getMembers(intCtx!) as Value);
    eq(members !== null && members.bindings.size > 0, true, "getMembers reads __members");
    // Channel reads: shape on a typed value, discharged on a proof.
    const x = evalCtx.bindings.get("x")?.value as Value;
    const shape = asContext(channelReadRaw(x, "shape") as Value);
    eq(shape !== null, true, "shape channel readable on a typed value");
    eq(bitsToString(primaryOf(getName(shape!) as Value) as BitsValue), "Int", "shape of 42 is Int");
    const proofCtx = asContext(evalCtx.bindings.get("t")?.value as Value);
    eq(proofCtx !== null, true, "theorem binding peels to a proof Context");
    const discharged = channelReadRaw(proofCtx! as Value, "discharged");
    eq(discharged !== undefined, true, "discharged channel readable on a proof");
    // Registry self-checks: every registration has an owner + target.
    eq(SLOT_REGISTRY.every((r) => r.owner.length > 0 && r.target.length > 0), true, "registry entries complete");
  });

  test("registry completeness (C1.1): no unregistered __* slot or component key in the corpus", () => {
    const result = runRegistryCompletenessCorpus();
    const unique = [...new Set(result.violations.map((v) => v.detail))];
    eq(unique.slice(0, 5).join("; "), "", `unregistered keys (${unique.length} unique, across ${result.walked} corpus files)`);
    eq(result.walked >= 15, true, `corpus coverage: ${result.walked} self-contained .alg files walked`);
  });

  test("forgery suite skeleton: D21 scenarios A–F are all present and tracked", () => {
    eq(FORGERY_SCENARIOS.map((s) => s.id).join(""), "ABCDEF");
    for (const s of FORGERY_SCENARIOS) {
      console.log(`    ⊘ forgery ${s.id} — SKELETON (${s.name}; unlocks at ${s.unlocksAt})`);
    }
  });

  test("baseline: basics.alg output matches the recorded snapshot", () => {
    eq(runBasicsCapture().join("|"), baseline.basicsOutput.join("|"));
  });

  test("baseline: perf floor (warn-only in Phase 0)", () => {
    const current = runPerfWorkloads();
    const warnings: string[] = [];
    for (const [name, ms] of Object.entries(current)) {
      const base = baseline.perf.workloadsMs[name];
      if (base !== undefined && ms > base * baseline.perf.warnFactor) {
        warnings.push(`${name}: ${ms}ms > ${baseline.perf.warnFactor}× baseline ${base}ms`);
      }
    }
    if (warnings.length > 0) {
      console.log(`    ⚠ perf floor exceeded (warn-only): ${warnings.join("; ")}`);
    }
    eq(Object.keys(current).length, Object.keys(baseline.perf.workloadsMs).length, "workload set matches baseline");
  });
}

// --- Baseline writer (CLI) ------------------------------------------------------

const isMain = process.argv[1] && process.argv[1].endsWith("boundary-tests.ts");
if (isMain && process.argv.includes("--write-baseline")) {
  const existing: Partial<BoundaryBaseline> = fs.existsSync(BASELINE_PATH) ? loadBaseline() : {};
  const baseline: BoundaryBaseline = {
    note:
      "Boundary-test baseline (structures-implementation Phase 0). `lint` counts are a one-way ratchet — regenerate with `npx tsx src/boundary-tests.ts --write-baseline` after a migration chunk reduces them; increases fail the suite. `hardFail` flips at C1.3.",
    hardFail: existing.hardFail ?? false,
    allowedFiles: existing.allowedFiles ?? [],
    lint: countLintViolations(),
    suiteFloor: existing.suiteFloor ?? 979,
    basicsOutput: runBasicsCapture(),
    perf: {
      machineNote: "Recorded on the dev container; coarse floor only. Hard threshold pending maintainer decision (plan §5).",
      warnFactor: existing.perf?.warnFactor ?? 2,
      workloadsMs: runPerfWorkloads(),
    },
  };
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + "\n");
  const total = Object.values(baseline.lint).reduce(
    (n, f) => n + Object.values(f).reduce((m, c) => m + c, 0), 0
  );
  console.log(`boundary baseline written: ${Object.keys(baseline.lint).length} files, ${total} lint occurrences, perf ${JSON.stringify(baseline.perf.workloadsMs)}`);
}
