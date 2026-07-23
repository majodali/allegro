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
import { isRegisteredSlotKey, isRegisteredComponentKey, asContext, getName, getMembers, getProposition, channelReadRaw, componentsView, SLOT_REGISTRY, viralChannels, unionChannels, registerChannel, typeShape, channelSpec } from "./slots.js";
import { withType, getType, typeMethod } from "./types-std.js";
import { knowledgeOf, knowledgeDomain, meetKnowledge, withPredicates, occurrenceBoundOf, Knowledge, IntervalDomain } from "./refinements.js";
import { bitsToString, BitsValue } from "./types.js";
import { formatValue } from "./primitives.js";
import { scopeNew, scopeExtend, scopeLookup, assertNotScope, scopeAssume, scopeFactsFor, scopeOwnFacts, scopeAllBindings, makeCell, isPendingCell } from "./scope.js";
import { applyPhase } from "./runtime.js";
import { createFutureManager } from "./futures.js";
import { primitives } from "./primitives.js";
import { stringToBits } from "./types.js";
import { PredicateSet, makePredicate, effectsDomain } from "./refinements.js";
import { makeInt } from "./types.js";
import { effectsOf } from "./effects.js";

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
  // C1.4: TS-kernel writer acquisition is restricted to the two proof-kernel
  // modules — anywhere else, acquiring the discharged writer fails the suite.
  { name: "kernel-writer-acquisition", regex: /\bkernelChannelWriter\s*\(/g, excludeFiles: ["src/types-std.ts", "src/primitives.ts"] },
  // C2.2: fact payloads are opaque outside the scope module — reads via
  // scopeFactsFor, layer pushes via scopeAssume, own-layer writes via
  // scopeOwnFacts. Direct .scopePredicates access anywhere else fails.
  { name: "scope-facts-direct", regex: /\.scopePredicates\b/g, excludeFiles: ["src/scope.ts"] },
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

// --- 2b. Differential fixtures (C1.5 safety net) -----------------------------------
//
// Byte-for-byte recordings of channel-propagation behavior taken BEFORE the
// C1.5 propagation table replaced the hand-rolled per-channel code. The
// table must reproduce these exactly (maintainer ruling: observable-zero;
// principled-rule divergences activate at C4.3). Two recorded WARTS are
// intentional: `err-viral-chain` loses the error channel into a residual,
// and `err-in-if-cond` silently takes the else branch — both are today's
// behavior, preserved here, revisited at C4.3.
export const DIFFERENTIAL_FIXTURES: { name: string; src: string; bind: string; expect: string }[] = [
  { name: "err-viral-arith", src: 'e = error "boom"\nr = e + 5', bind: "r", expect: "fmt=error(boom) | eff=- | err=boom" },
  { name: "err-viral-chain", src: 'e = error "boom"\nr = (e + 5) * 2 - 1', bind: "r", expect: "fmt=<expression> | eff=- | err=-" },
  { name: "err-both-operands", src: 'a = error "one"\nb = error "two"\nr = a + b', bind: "r", expect: "fmt=error(one) | eff=- | err=one" },
  { name: "err-in-if-cond", src: 'e = error "boom"\nr = if e then 1 else 2', bind: "r", expect: "fmt=2 | eff=- | err=-" },
  { name: "err-through-method", src: 'e = error "boom"\nr = e + 1\ns = r.toString()', bind: "s", expect: "fmt=<expression> | eff=- | err=-" },
  { name: "eff-inferred-io", src: "f(x) => print(x)\ng(x) => f(x)", bind: "g", expect: "fmt=<function(1)> | eff=io | err=-" },
  { name: "eff-if-branches", src: "h(c, x) => if c then print(x) else x", bind: "h", expect: "fmt=<function(2)> | eff=io | err=-" },
  { name: "eff-pure", src: "sq(x) => x * x", bind: "sq", expect: "fmt=<function(1)> | eff=- | err=-" },
  { name: "typed-result-shape", src: "r = 2 + 3", bind: "r", expect: "fmt=5 | eff=- | err=-" },
  { name: "typed-cmp-bool", src: "r = 3 < 5", bind: "r", expect: "fmt=true | eff=- | err=-" },
  { name: "refined-preserve", src: "PI = (Int & _ > 0).preserveOps()\nx = PI(5)\ny = x + 3", bind: "y", expect: "fmt=8 | eff=- | err=-" },
];

export function runDifferentialFixture(f: { src: string; bind: string }): string {
  const origLog = console.log;
  console.log = () => {};
  try {
    const { evalCtx } = evalSource(f.src, undefined, [createTypeSystem()], undefined, true);
    const v = evalCtx.bindings.get(f.bind)?.value as Value;
    const eff = v ? effectsOf(v) : null;
    const err = v ? channelReadRaw(v, "error") : undefined;
    return `fmt=${formatValue(v)} | eff=${eff ? [...eff].sort().join(",") : "-"} | err=${err !== undefined ? formatValue(err as Value) : "-"}`;
  } catch (e: any) {
    return `THREW: ${String(e?.message ?? e).slice(0, 60)}`;
  } finally {
    console.log = origLog;
  }
}

// --- 3. Forgery-scenario skeleton ---------------------------------------------

export interface ForgeryScenario {
  id: string;
  name: string;
  blockedBy: string;
  unlocksAt: string;
  /** live = implemented as a real attack test; skeleton = visible, pending. */
  status: "live" | "skeleton";
}

/** D21's verification log (design log B10). A/B/D/F went live at C1.4;
 *  C unlocks with the propagation table (C1.5), E with S3 enforcement. */
export const FORGERY_SCENARIOS: ForgeryScenario[] = [
  { id: "A", name: "forge `discharged` from nothing", blockedBy: "origination requires the kernel-held writer", unlocksAt: "C1.4", status: "live" },
  { id: "B", name: "swap a real proof's proposition, keep `discharged`", blockedBy: "data-immutability (D22)", unlocksAt: "C1.4", status: "live" },
  { id: "C", name: "combine a real proof with a fake operand hoping `discharged` propagates", blockedBy: "non-fabricating propagation rules on authority channels", unlocksAt: "C1.5", status: "live" },
  { id: "D", name: "read a real `discharged`, write it onto a fake value", blockedBy: "reads are free; the write still needs the capability", unlocksAt: "C1.4", status: "live" },
  { id: "E", name: "capability leak through an export surface", blockedBy: "holder keeps the writer module-private (ocap discipline)", unlocksAt: "S3 visibility enforcement", status: "skeleton" },
  { id: "F", name: "forge the writer capability itself", blockedBy: "writer is a PrimitiveFunction closure, unconstructible from Allegretto", unlocksAt: "C1.4", status: "live" },
];

function getTypeNameOf(v: Value): string | null {
  const t = channelReadRaw(v, "type");
  const tc = t ? asContext(t as Value) : null;
  const nv = tc ? getName(tc) : undefined;
  return nv ? bitsToString(primaryOf(nv) as BitsValue) : null;
}

/** Evaluate an attack program; report whether (and how) it was refused. */
function attack(src: string): { threw: string | null; evalCtx: ContextValue | null } {
  try {
    const { evalCtx } = evalSource(src, undefined, [createTypeSystem()], undefined, true);
    return { threw: null, evalCtx };
  } catch (e: any) {
    return { threw: String(e?.message ?? e), evalCtx: null };
  }
}

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
  /** Registry-walk results piggybacked on the suite's own .alg file tests
   *  (walked at evaluation time in runAlgFile — no re-evaluation). When
   *  absent (standalone invocation), the harness evaluates the corpus
   *  itself via runRegistryCompletenessCorpus. */
  corpus?: { files: number; violations: InvariantViolation[] };
}

export function runBoundaryTests({ test, eq, corpus }: Hooks): void {
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
    // C2.3b: Int lives on the extensions layer of the root scope chain.
    const intCtx = asContext(scopeLookup(evalCtx, "Int")?.value as Value);
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
    if (corpus && corpus.files === 0) {
      // Dev-filtered run: the file tests (whose evaluation the walk
      // piggybacks on) were filtered out. Coverage is asserted by the full
      // landing gate, not the dev tier.
      console.log("    ⊘ corpus walk skipped (no file tests ran — dev-filtered run)");
      return;
    }
    const result = corpus
      ? { walked: corpus.files, violations: corpus.violations }
      : (() => { const r = runRegistryCompletenessCorpus(); return { walked: r.walked, violations: r.violations }; })();
    const unique = [...new Set(result.violations.map((v) => v.detail))];
    eq(unique.slice(0, 5).join("; "), "", `unregistered keys (${unique.length} unique, across ${result.walked} corpus files)`);
    eq(result.walked >= 15, true, `corpus coverage: ${result.walked} .alg files walked`);
  });

  test("forgery suite: D21 scenarios A–F all present; C/E skeletons tracked", () => {
    eq(FORGERY_SCENARIOS.map((s) => s.id).join(""), "ABCDEF");
    for (const s of FORGERY_SCENARIOS.filter((x) => x.status === "skeleton")) {
      console.log(`    ⊘ forgery ${s.id} — SKELETON (${s.name}; unlocks at ${s.unlocksAt})`);
    }
  });

  test("forgery A (live): originating `discharged` without the writer is refused", () => {
    const lit = attack('p = {__discharged: 1, __proposition: "forged"}');
    eq(lit.threw?.includes("integrity channel") ?? false, true, `object literal: ${lit.threw}`);
    const reg = attack('w = channel_register("discharged", "drop")');
    eq(reg.threw?.includes("already registered") ?? false, true, `re-registration: ${reg.threw}`);
  });

  test("forgery B (live): a real proof's proposition cannot be swapped under `discharged`", () => {
    const r = attack('theorem t: 1 + 1 == 2\ncopy = mv_set(t, "note", 42)');
    eq(r.threw, null, "benign component copy should evaluate");
    const t = r.evalCtx!.bindings.get("t")!.value as Value;
    // mv_set produced a NEW value; the proof itself is untouched...
    eq(componentsView(t).has("note"), false, "original proof gained no component");
    // ...and still carries its original proposition + discharge.
    const ctx = asContext(t)!;
    const disch = channelReadRaw(t, "discharged") as Value;
    eq((primaryOf(disch) as any).data, 1n, "still discharged");
    eq(bitsToString(primaryOf(getProposition(ctx)!) as BitsValue).includes("1 + 1"), true, "proposition unchanged");
  });

  test("forgery D (live): reads are free; writing the read value onto a fake is refused", () => {
    const read = attack('theorem t: 1 + 1 == 2\nd = channel_read(t, "discharged")');
    eq(read.threw, null, "free read");
    const d = read.evalCtx!.bindings.get("d")!.value as Value;
    eq((primaryOf(d) as any).data, 1n, "read the real discharge mark");
    const write = attack('f = mv_set({x: 1}, "discharged", 1)');
    eq(write.threw?.includes("integrity channel") ?? false, true, `write-onto-fake: ${write.threw}`);
  });

  test("forgery F (live): the writer capability cannot be forged or counterfeited", () => {
    const fake = attack("w2 = channel_attenuate(x => x, y => y)");
    eq(fake.threw?.includes("not a channel writer") ?? false, true, `fake writer: ${fake.threw}`);
    // A later program cannot re-mint a channel registered by an earlier one
    // (the epoch seal — same-pass re-evaluation is the only re-issue).
    const first = attack('w = channel_register("forgery_f_probe", "union")');
    eq(first.threw, null, "first registration succeeds");
    const second = attack('w = channel_register("forgery_f_probe", "union")');
    eq(second.threw?.includes("already registered") ?? false, true, `cross-program re-mint: ${second.threw}`);
  });

  test("forgery C (live): `discharged` never propagates — drop rule enforced", () => {
    // 1. The propagation executors exclude the authority channel entirely.
    eq(viralChannels().includes("discharged"), false, "not viral");
    eq(unionChannels().includes("discharged"), false, "not union");
    // 2. Registration-side: an integrity channel cannot take a fabricating rule.
    let threw = "";
    try { registerChannel({ name: "forgeC_probe", rule: "viral", integrity: true }); }
    catch (e: any) { threw = String(e.message); }
    eq(threw.includes("may not register fabricating"), true, `registration gate: ${threw}`);
    // 3. Propagation-side: combining a real proof with other values through
    // operations never yields a discharged result.
    const r = attack('theorem t: 1 + 1 == 2\narr = [t, t]\nc = channel_read(arr, "discharged")\nd = channel_read(t, "discharged")');
    eq(r.threw, null, `combine: ${r.threw}`);
    const c = r.evalCtx!.bindings.get("c")!.value as Value;
    eq(getTypeNameOf(c), "None", "no discharge on the combination");
    const d = r.evalCtx!.bindings.get("d")!.value as Value;
    eq((primaryOf(d) as any).data, 1n, "the source proof itself still reads discharged");
  });

  test("channel plane (C1.4): user channel end-to-end — write, free read, attenuation", () => {
    const r = attack([
      'w = channel_register("audit_e2e", "union")',
      'v = w(42, "checked")',
      'r = channel_read(v, "audit_e2e")',
      'wa = channel_attenuate(w, x => x == "ok")',
      'good = wa(5, "ok")',
      'g = channel_read(good, "audit_e2e")',
    ].join("\n"));
    eq(r.threw, null, `e2e: ${r.threw}`);
    eq(bitsToString(primaryOf(r.evalCtx!.bindings.get("r")!.value as Value) as BitsValue), "checked");
    eq(bitsToString(primaryOf(r.evalCtx!.bindings.get("g")!.value as Value) as BitsValue), "ok");
    const rejected = attack([
      'w = channel_register("audit_e2e_2", "union")',
      'wa = channel_attenuate(w, x => x == "ok")',
      'bad = wa(5, "nope")',
    ].join("\n"));
    eq(rejected.threw?.includes("attenuation predicate rejected") ?? false, true, `attenuation: ${rejected.threw}`);
    // Integrity channels reject fabricating rules at registration (D23).
    const fab = attack('w = channel_register("discharged2", "viral")');
    eq(fab.threw, null, "non-integrity user channel may be viral");
  });

  test("differential fixtures (C1.5): channel propagation matches the pre-table recording", () => {
    const diffs = DIFFERENTIAL_FIXTURES
      .map((f) => ({ f, got: runDifferentialFixture(f) }))
      .filter((r) => r.got !== r.f.expect)
      .map((r) => `${r.f.name}: expected [${r.f.expect}] got [${r.got}]`);
    eq(diffs.join("; "), "", "differential divergence");
  });

  test("scope protocol (C2.1): O(1) extend, chain lookup, shadowing", () => {
    // Structural O(1) proof: a child layered over a 10k-binding parent
    // holds exactly its own entries — no flatten-copy.
    const parent = scopeNew();
    for (let i = 0; i < 10000; i++) {
      parent.bindings.set(`b${i}`, { key: `b${i}`, value: makeInt(i) });
    }
    const child = scopeExtend(parent, [["x", { key: "x", value: makeInt(42) }]]);
    eq(child.bindings.size, 1, "child owns only its layer");
    eq((primaryOf(scopeLookup(child, "b9999")!.value!) as any).data, 9999n, "chain lookup reaches parent");
    eq((primaryOf(scopeLookup(child, "x")!.value!) as any).data, 42n, "own layer found");
    // Shadowing: nearest layer wins.
    const shadow = scopeExtend(child, [["b0", { key: "b0", value: makeInt(777) }]]);
    eq((primaryOf(scopeLookup(shadow, "b0")!.value!) as any).data, 777n, "child shadows parent");
    eq((primaryOf(scopeLookup(parent, "b0")!.value!) as any).data, 0n, "parent unchanged");
    // Deep chains stay correct.
    let deep = scopeNew();
    deep.bindings.set("root", { key: "root", value: makeInt(1) });
    for (let i = 0; i < 2000; i++) deep = scopeExtend(deep, []);
    eq((primaryOf(scopeLookup(deep, "root")!.value!) as any).data, 1n, "2000-layer chain lookup");
  });

  test("scope/structure plane rejection (C2.1): each plane refuses the other", () => {
    // A shape-carrying data Context cannot be extended as a scope.
    const { evalCtx } = evalSource("p = {a: 1}", undefined, [createTypeSystem()], undefined, true);
    const dataCtx = asContext(evalCtx.bindings.get("p")!.value as Value)!;
    // give it its shape slot form: typed objects carry shape via the MV
    // component; scope rejection keys on binding-plane shape — verify via a
    // type Context (which carries __type):
    // C2.3b: Int lives on the extensions layer of the root scope chain.
    const intCtx = asContext(scopeLookup(evalCtx, "Int")!.value as Value)!;
    let threw = "";
    try { scopeExtend(intCtx, []); } catch (e: any) { threw = String(e.message); }
    eq(threw.includes("cannot extend a data structure"), true, `scope-over-data: ${threw}`);
    // Struct ops reject scopes.
    const sc = scopeNew();
    let threw2 = "";
    try { assertNotScope(sc as Value, "type_dispatch"); } catch (e: any) { threw2 = String(e.message); }
    eq(threw2.includes("plane violation"), true, `struct-on-scope: ${threw2}`);
    // ...and pass data through untouched.
    assertNotScope(dataCtx as Value, "type_dispatch");
  });

  test("facts plane (C2.2): immutable layering, branch isolation, chain merge", () => {
    const parent = scopeNew();
    parent.bindings.set("x", { key: "x", value: makeInt(1) });
    const factA = new PredicateSet([makePredicate(effectsDomain(new Set(["a"])))]);
    const factB = new PredicateSet([makePredicate(effectsDomain(new Set(["b"])))]);
    const branchA = scopeAssume(parent, new Map([["x", factA]]));
    const branchB = scopeAssume(parent, new Map([["x", factB]]));
    // Sibling branches are isolated; the parent never gains facts.
    eq([...scopeFactsFor(branchA, "x")!.effectiveEffects()!.labels].join(","), "a");
    eq([...scopeFactsFor(branchB, "x")!.effectiveEffects()!.labels].join(","), "b");
    eq(scopeFactsFor(parent, "x"), undefined, "branch exit discards — parent untouched");
    // Chain merge: a nested layer refines, outer facts still visible.
    const factC = new PredicateSet([makePredicate(effectsDomain(new Set(["c"])))]);
    const nested = scopeAssume(branchA, new Map([["x", factC]]));
    const merged = [...scopeFactsFor(nested, "x")!.effectiveEffects()!.labels].sort().join(",");
    eq(merged, "a,c", "nested layer merges with outer facts");
    // Own-layer accumulation (assert semantics) never touches the parent.
    scopeOwnFacts(branchA).set("y", factB);
    eq(scopeFactsFor(parent, "y"), undefined);
    eq([...scopeFactsFor(branchA, "y")!.effectiveEffects()!.labels].join(","), "b");
  });

  // --- Resolution unification (C2.3b) ----------------------------------------

  test("root layering (C2.3b): source bindings own the top layer; chain reaches extensions and primitives", () => {
    const { evalCtx } = evalSource("x = 42", undefined, [createTypeSystem()], undefined, true);
    eq(evalCtx.parent !== undefined, true, "root eval ctx is a layered chain");
    eq(evalCtx.bindings.has("x"), true, "source binding on the own layer");
    eq(evalCtx.bindings.has("Int"), false, "extension binding NOT on the own layer");
    eq(scopeLookup(evalCtx, "Int") !== undefined, true, "chain lookup reaches the extensions layer");
    eq(scopeLookup(evalCtx, "bits_add") !== undefined, true, "chain lookup reaches the primitives layer");
    const flat = scopeAllBindings(evalCtx);
    eq(flat.has("x") && flat.has("Int") && flat.has("bits_add"), true, "scopeAllBindings flattens every layer");
  });

  test("one representation (C2.3b): registry and eval scope share the SAME binding object", () => {
    const { evalCtx, registry } = evalSource("x = 42", undefined, [createTypeSystem()], undefined, true);
    eq(registry.bindings.get("x") === evalCtx.bindings.get("x"), true, "a named binding IS its registry cell");
    // Async future: one pending cell in both views, pending until the
    // Promise resolves (resolution behavior covered by the async suite).
    const fm = createFutureManager();
    const r2 = evalSource("y = delay(1)", undefined, [createTypeSystem()], undefined, true, fm);
    const cell = r2.evalCtx.bindings.get("__future_0");
    eq(cell !== undefined && cell === r2.registry.bindings.get("__future_0"), true, "future cell shared by ctx and registry");
    eq(isPendingCell(cell), true, "future cell pending until its Promise resolves");
  });

  test("absent vs unresolved (C2.3b): declared import is a pending cell; undeclared name is absent", () => {
    const { evalCtx, registry } = evalSource("import cfg\nx = 42", undefined, [createTypeSystem()], undefined, true);
    const cell = evalCtx.bindings.get("cfg");
    eq(isPendingCell(cell), true, "unprovided import is a pending cell on the source layer");
    eq(registry.bindings.get("cfg") === cell, true, "pending cell tracked by the registry");
    eq(scopeLookup(evalCtx, "no_such_name"), undefined, "undeclared name is absent — no cell on any layer");
    // The reflective op mirrors the distinction: pending → residual Symbol,
    // absent → Error-typed value. Never a throw (D11).
    const sc = scopeNew();
    sc.bindings.set("cfg", makeCell("cfg"));
    const pending = (primitives.ctx_resolve as any).fn([sc, stringToBits("cfg")]);
    eq(pending.kind === ValueKind.Symbol && pending.name === "cfg", true, "ctx_resolve residualises a pending cell");
    const missing = (primitives.ctx_resolve as any).fn([sc, stringToBits("nope")]);
    eq(getTypeNameOf(missing), "Error", "ctx_resolve returns an error value for an absent name");
  });

  test("applyPhase (C2.3b): resolves the pending cell in place and forward-chains dependents", () => {
    const { evalCtx, registry } = evalSource("import cfg\ny = cfg", undefined, [createTypeSystem()], undefined, true);
    const cell = evalCtx.bindings.get("cfg")!;
    applyPhase(registry, evalCtx, new Map([["cfg", makeInt(7)]]));
    eq(evalCtx.bindings.get("cfg") === cell, true, "same cell object resolved in place");
    eq(cell.isComplete === true && cell.value !== undefined, true, "cell completed by the phase");
    const listEntry = evalCtx.bindingList.find((b) => b.key === "cfg");
    eq(listEntry === cell, true, "bindingList holds the same resolved cell — no stale duplicate");
    const y = registry.bindings.get("y")!;
    eq(y === evalCtx.bindings.get("y"), true, "dependent lives on the one representation too");
    eq(y.isComplete, true, "dependent re-evaluated to completion");
    eq(Number((primaryOf(y.value!) as BitsValue).data), 7, "dependent sees the resolved value");
  });

  test("import satisfied by an extension (C2.3b): resolves through the chain, no pending cell", () => {
    const ext: Extension = { name: "m", bindings: { cfg: makeInt(9) } };
    const { evalCtx } = evalSource("import cfg\nx = cfg", undefined, [createTypeSystem(), ext], undefined, true);
    eq(evalCtx.bindings.has("cfg"), false, "provided import gets no cell on the source layer");
    eq(Number((primaryOf(evalCtx.bindings.get("x")!.value!) as BitsValue).data), 9, "reference resolved through the extension layer");
  });

  test("REPL persistence (C2.3b): base chain flattens into a fresh layer — passes are mutation-isolated", () => {
    const r1 = evalSource("a = 1", undefined, [createTypeSystem()], undefined, true);
    const r2 = evalSource("b = a + 1", r1.evalCtx, [createTypeSystem()], undefined, true);
    eq(Number((primaryOf(r2.evalCtx.bindings.get("b")!.value!) as BitsValue).data), 2, "prior-pass binding resolves through the base layer");
    const a1 = r1.evalCtx.bindings.get("a")!;
    const a2 = scopeLookup(r2.evalCtx, "a")!;
    eq(a1 !== a2, true, "base flatten copies binding objects — later passes never alias earlier ctxs");
  });

  // --- Shape/knowledge split (C3.1, D36) --------------------------------------

  test("shape/knowledge split (C3.1): refined value — stored type is knowledge, shape is the base", () => {
    const { evalCtx } = evalSource(
      "PositiveInt = Int & _ > 0\nx = PositiveInt(5)",
      undefined, [createTypeSystem()], undefined, true);
    const x = evalCtx.bindings.get("x")!.value as Value;
    const stored = getType(x)!;
    eq(bitsToString(primaryOf(getName(stored)!) as BitsValue), "PositiveInt", "stored type keeps the refinement bound");
    const shape = channelReadRaw(x, "shape") as ContextValue;
    eq(bitsToString(primaryOf(getName(shape)!) as BitsValue), "Int", "shape channel reads the dispatch shape");
    const intCtx = asContext(scopeLookup(evalCtx, "Int")!.value as Value)!;
    eq(shape === intCtx, true, "shape IS the Int type object (identity)");
    const k = knowledgeOf(x)!;
    eq(k !== null && k.bound === stored, true, "knowledge bound is the refinement certificate");
    const dom = knowledgeDomain(k) as IntervalDomain | null;
    eq(dom?.kind === "interval" && dom.lo === 1, true, "knowledge domain is ≥ 1");
    eq(channelSpec("knowledge")?.rule, "computed", "knowledge channel registered");
  });

  test("shape/knowledge split (C3.1): a type that mints members IS a shape (preserveOps)", () => {
    const { evalCtx } = evalSource(
      "PI = (Int & _ > 0).preserveOps()\ny = PI(5)\nz = y + 3",
      undefined, [createTypeSystem()], undefined, true);
    const y = evalCtx.bindings.get("y")!.value as Value;
    const shape = channelReadRaw(y, "shape") as ContextValue;
    eq(bitsToString(primaryOf(getName(shape)!) as BitsValue), "PI", "preserveOps type has its own member set — dispatch must reach its overrides");
    // ...and the lifted operator actually ran: z carries the PI tag.
    const z = evalCtx.bindings.get("z")!.value as Value;
    eq(bitsToString(primaryOf(getName(getType(z)!)!) as BitsValue), "PI", "lifted op re-tagged the result");
  });

  test("shape immutability (C3.1): the writer refuses cross-shape re-stamps; knowledge re-bounds pass", () => {
    const { evalCtx } = evalSource(
      "PositiveInt = Int & _ > 0\nx = 42\ns = \"hi\"",
      undefined, [createTypeSystem()], undefined, true);
    const x = evalCtx.bindings.get("x")!.value as Value;
    const stringType = asContext(scopeLookup(evalCtx, "String")!.value as Value)!;
    const intType = asContext(scopeLookup(evalCtx, "Int")!.value as Value)!;
    const refined = asContext(evalCtx.bindings.get("PositiveInt")!.value as Value)!;
    let threw = "";
    try { withType(x, stringType); } catch (e: any) { threw = String(e.message); }
    eq(threw.includes("shape is fixed at construction"), true, `cross-shape re-stamp refused: ${threw}`);
    withType(x, intType);   // same shape — legal
    withType(x, refined);   // knowledge re-bound (refinement certificate) — legal
  });

  test("dispatch ignores knowledge (C3.1): narrowed knowledge never changes which member runs", () => {
    // A refined value dispatches through its shape: Int's toString runs.
    const r1 = evalSource(
      "PositiveInt = Int & _ > 0\ns = PositiveInt(5).toString()",
      undefined, [createTypeSystem()], undefined, true);
    eq(bitsToString(primaryOf(r1.evalCtx.bindings.get("s")!.value!) as BitsValue), "5", "refined value runs the shape's method");
    // Attaching extra knowledge to a value must not affect dispatch.
    const r2 = evalSource("h = \"hello\"", undefined, [createTypeSystem()], undefined, true);
    const h = r2.evalCtx.bindings.get("h")!.value as Value;
    const narrowed = withPredicates(h, new PredicateSet([makePredicate(effectsDomain(new Set(["irrelevant"])))]));
    const shapeBefore = channelReadRaw(h, "shape");
    const shapeAfter = channelReadRaw(narrowed, "shape");
    eq(shapeBefore === shapeAfter, true, "attached knowledge leaves the shape untouched");
    const lenGetter = typeMethod(typeShape(getType(narrowed)!), "length");
    eq(lenGetter !== null, true, "member lookup through the shape is knowledge-independent");
  });

  test("certificates ride (C3.1): refinement knowledge survives a function boundary", () => {
    const { evalCtx } = evalSource(
      "PositiveInt = Int & _ > 0\nf(x: PositiveInt): PositiveInt => x\ny = f(PositiveInt(5))",
      undefined, [createTypeSystem()], undefined, true);
    const y = evalCtx.bindings.get("y")!.value as Value;
    const k = knowledgeOf(y);
    eq(k !== null, true, "knowledge present after passage");
    const dom = knowledgeDomain(k!) as IntervalDomain | null;
    eq(dom?.kind === "interval" && dom.lo >= 1, true, "certificate domain intact across the boundary");
  });

  // --- Annotations as knowledge bounds (C3.2, D36) ----------------------------

  const C32_TYPES = "Animal = Type.extend({legs: Int})\nDog = Animal.extend({legs: Int, tricks: Int})\n";

  test("knowledge bounds (C3.2): the two-sided matrix — visibility follows knowledge, dispatch follows shape", () => {
    // Visible through the bound: Animal declares `legs`.
    const ok = evalSource(C32_TYPES + "f(a: Animal): Int => a.legs\nr = f(Dog(4, 7))",
      undefined, [createTypeSystem()], undefined, true);
    eq(Number((primaryOf(ok.evalCtx.bindings.get("r")!.value!) as BitsValue).data), 4, "base member visible through the bound");
    // Hidden: `tricks` is Dog-only — the annotation gates it.
    let threw = "";
    try {
      evalSource(C32_TYPES + "g(a: Animal): Int => a.tricks\nr = g(Dog(4, 7))",
        undefined, [createTypeSystem()], undefined, true);
    } catch (e: any) { threw = String(e.message); }
    eq(threw.includes("not available through annotation 'Animal'"), true, `subtype member hidden: ${threw}`);
    // Dispatch source intact: the bounded value's stored type stays Dog.
    const b = evalSource(C32_TYPES + "id2(a: Animal): Animal => a\nx = id2(Dog(4, 7))",
      undefined, [createTypeSystem()], undefined, true);
    const x = b.evalCtx.bindings.get("x")!.value as Value;
    eq(getTypeNameOf(x), "Dog", "shape (dispatch source) untouched by the bound");
    const bound = occurrenceBoundOf(x)!;
    eq(bitsToString(primaryOf(getName(bound)!) as BitsValue), "Animal", "occurrence bound rides the value");
    eq(knowledgeOf(x)?.occurrenceBound === bound, true, "knowledgeOf surfaces the occurrence carrier");
  });

  test("knowledge bounds (C3.2): `when … is T` narrows — both subject forms; else arm keeps the bound", () => {
    // Symbol subject (scope-resolved binding): return boundary stamps the
    // bound; the matched arm lifts it.
    const r1 = evalSource(C32_TYPES + "mk(): Animal => Dog(2, 3)\na = mk()\nr = when a is Dog then a.tricks else 0 - 1",
      undefined, [createTypeSystem()], undefined, true);
    eq(Number((primaryOf(r1.evalCtx.bindings.get("r")!.value!) as BitsValue).data), 3, "Symbol-subject narrowing");
    eq(occurrenceBoundOf(r1.evalCtx.bindings.get("a")!.value!) !== null, true, "narrowing is arm-local — the binding keeps its bound");
    // Substituted-param subject: identity replacement inside the arm.
    const r2 = evalSource(C32_TYPES + "g(a: Animal): Int => when a is Dog then a.tricks else 0 - 1\nr = g(Dog(4, 9))",
      undefined, [createTypeSystem()], undefined, true);
    eq(Number((primaryOf(r2.evalCtx.bindings.get("r")!.value!) as BitsValue).data), 9, "substituted-param narrowing");
  });

  test("knowledge bounds (C3.2): boundary crossing resets occurrence knowledge", () => {
    const r = evalSource(
      C32_TYPES +
      "tc(d: Dog): Int => d.tricks\n" +
      "via(a: Animal): Int => when a is Dog then tc(a) else 0 - 1\n" +
      "r = via(Dog(4, 5))",
      undefined, [createTypeSystem()], undefined, true);
    eq(Number((primaryOf(r.evalCtx.bindings.get("r")!.value!) as BitsValue).data), 5, "own-shape boundary restores full knowledge");
  });

  test("knowledge bounds (C3.2): meet computed, not overwritten — intrinsic facts survive a looser annotation", () => {
    const r = evalSource(
      "PositiveInt = Int & _ > 0\nident(x: Int): Int => x\ny = ident(PositiveInt(5))",
      undefined, [createTypeSystem()], undefined, true);
    const y = r.evalCtx.bindings.get("y")!.value as Value;
    const k = knowledgeOf(y)!;
    eq(k !== null && k.bound !== null, true, "certificate survives passage through the wider annotation");
    eq(k.occurrenceBound, null, "same-shape crossing sets no bound");
    const dom = knowledgeDomain(k) as IntervalDomain | null;
    eq(dom?.kind === "interval" && dom.lo >= 1, true, "domain intact — the meet never widens");
  });

  // --- Observation effect (C3.3, D36) -----------------------------------------

  test("observation effect (C3.3): instanceof is a pure re-check — congruent over equal data", () => {
    const r = evalSource(
      "PositiveInt = Int & _ > 0\na = PositiveInt(5)\nb = 5\n" +
      "ia = a instanceof PositiveInt\nib = b instanceof PositiveInt\nneg = (0 - 3) instanceof PositiveInt\n" +
      "sa = a + 1\nsb = b + 1\nta = a.toString()\ntb = b.toString()\neqv = a == b",
      undefined, [createTypeSystem()], undefined, true);
    const num = (k: string) => Number((primaryOf(r.evalCtx.bindings.get(k)!.value!) as BitsValue).data);
    const str = (k: string) => bitsToString(primaryOf(r.evalCtx.bindings.get(k)!.value!) as BitsValue);
    eq(num("ia"), 1, "tagged value passes");
    eq(num("ib"), 1, "equal bare data answers IDENTICALLY — re-check, not certificate peek");
    eq(num("neg"), 0, "violating data fails");
    eq(num("sa") === num("sb"), true, "pure arithmetic agrees on §7-equal values");
    eq(str("ta") === str("tb"), true, "toString agrees on §7-equal values");
    eq(num("eqv"), 1, "equality ignores knowledge (D37 groundwork)");
  });

  test("observation effect (C3.3): nested refinements re-check the whole chain; shapes stay nominal", () => {
    const r = evalSource(
      "SmallPos = Int & _ > 0 && _ < 100\nok = 50 instanceof SmallPos\nhigh = 150 instanceof SmallPos\n" +
      "PI = (Int & _ > 0).preserveOps()\nbare = 8 instanceof PI\ntagged = PI(5) instanceof PI",
      undefined, [createTypeSystem()], undefined, true);
    const num = (k: string) => Number((primaryOf(r.evalCtx.bindings.get(k)!.value!) as BitsValue).data);
    eq(num("ok"), 1, "nested predicate chain re-checked (50 ∈ [1,99])");
    eq(num("high"), 0, "chain refusal (150 ∉ [1,99])");
    eq(num("bare"), 0, "preserveOps type is a SHAPE (own members) — instanceof stays nominal");
    eq(num("tagged"), 1, "shape-constructed value passes nominally");
  });

  test("observation effect (C3.3): certificate_peek observes knowledge — effectful; instanceof stays pure", () => {
    const r = evalSource(
      "PositiveInt = Int & _ > 0\na = PositiveInt(5)\n" +
      "pa = certificate_peek(a, PositiveInt)\npb = certificate_peek(5, PositiveInt)\n" +
      "peeker(x: Int) => certificate_peek(x, PositiveInt)\n" +
      "checker(x: Int) => x instanceof PositiveInt",
      undefined, [createTypeSystem()], undefined, true);
    const num = (k: string) => Number((primaryOf(r.evalCtx.bindings.get(k)!.value!) as BitsValue).data);
    eq(num("pa"), 1, "constructed-as-PositiveInt observed");
    eq(num("pb"), 0, "the peek distinguishes §7-equal values — the very thing instanceof must not do");
    const peekEff = effectsOf(r.evalCtx.bindings.get("peeker")!.value!);
    eq(peekEff !== null && peekEff.has("observe"), true, "knowledge observation is inferred as an effect");
    const checkEff = effectsOf(r.evalCtx.bindings.get("checker")!.value!);
    eq(checkEff === null || checkEff.size === 0, true, "the pure re-check infers no effect");
  });

  test("knowledge lattice (C3.1): meet accumulates facts — domains intersect", () => {
    const a: Knowledge = {
      bound: null,
      predicates: new PredicateSet([makePredicate({ kind: "interval", lo: 1, hi: Infinity })]),
      occurrenceBound: null,
    };
    const b: Knowledge = {
      bound: null,
      predicates: new PredicateSet([makePredicate({ kind: "interval", lo: -Infinity, hi: 99 })]),
      occurrenceBound: null,
    };
    const met = meetKnowledge(a, b);
    const dom = knowledgeDomain(met) as IntervalDomain | null;
    eq(dom?.kind === "interval" && dom.lo === 1 && dom.hi === 99, true, "meet of ≥1 and ≤99 is [1, 99]");
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
