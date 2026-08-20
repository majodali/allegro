// =============================================================================
// Boundary-test harness — structures-implementation Phase 0 (C0.1 / B-001)
//
// Four instruments, per `docs/plans/structures-implementation.md` §Phase 0
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
import { Value, ValueKind, ContextValue, MultiValueType, makePrimitive, makeExpr } from "./types.js";
import { isRegisteredSlotKey, isRegisteredComponentKey, asContext, getName, getMembers, getProposition, getRefines, channelReadRaw, componentsView, cloneComponents, SLOT_REGISTRY, SLOT_KEYS, viralChannels, unionChannels, registerChannel, typeShape, channelSpec, isInterfaceType as isInterfaceTypeSlots } from "./slots.js";
import { withType, getType, typeMethod, typeMemberDescriptor, makeArray, IntType, Type as TypeMeta, structuralWrap as structuralWrapTS, RefinementKind as RefinementKindTS } from "./types-std.js";
import { makeMultiValue } from "./types.js";
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
import { effectsOf, withEffects } from "./effects.js";
import { evaluate } from "./evaluator.js";
import { makeSymbol } from "./types.js";
import { Structure, isStructure } from "./structure.js";
import { registerScopeSymbol, markExported, symbolFqn, symbolToWire, symbolFromWire, isRegisteredSymbol, internCount, projectBaseName, BaseNameCandidate, MAIN_SCOPE_FQN, KERNEL_SCOPE_FQN, kernelMemberFqn, typeMemberScopeFqn } from "./symbols.js";
import { dataOf, indexGet, getSlotCount } from "./slots.js";

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
  // dataOf's strip-vs-preserve asymmetry is retired by C1.5/C4.3; its
  // definition site is exempt.
  { name: "dataOf-call", regex: /\bprimaryOf\s*\(/g, excludeFiles: ["src/types.ts"] },
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

  if ((v as { primary?: Value }).primary !== undefined) {
    // C7.1: the CARRIER configuration (D15) — primary present. Restated
    // invariants: W4 carriers are Structures; W5 a carrier's data plane
    // is EMPTY (the lazily-materialized view may exist but holds no
    // slots); W1 a carrier's primary is never a carrier and never a
    // plain Context (records flatten through makeMultiValue).
    const mv = v as MultiValueType;
    if (!isStructure(v)) {
      out.push({ invariant: "W4 structure-kind", detail: "carrier is not a Structure instance (bypassed makeMultiValue)", program });
    } else if ((v as unknown as Structure).bindings !== undefined && (v as unknown as Structure).bindings.size > 0) {
      out.push({ invariant: "W5 role-transparency", detail: "carrier carries data slots (data plane must be empty — D15)", program });
    }
    if (mv.primary && (mv.primary as Value & { primary?: Value }).primary !== undefined) {
      out.push({ invariant: "W1 carrier-non-nesting", detail: "carrier primary is itself a carrier", program });
    }
    if (mv.primary && (mv.primary as Value).kind === ValueKind.Structure) {
      out.push({ invariant: "W1 carrier-non-nesting", detail: "carrier primary is a Context (records flatten — C4.3b/C7.1)", program });
    }
    const typeComp = mv.components.get("type");
    if (typeComp && (typeComp as Value).kind !== ValueKind.Expression) {
      const tp = dataOf(typeComp as Value);
      if (!tp || tp.kind !== ValueKind.Structure) {
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
  if (v.kind === ValueKind.Structure) {
    // C4.1 (W4): every Context is an instance of the unified Structure class.
    if (!isStructure(v)) {
      out.push({ invariant: "W4 structure-kind", detail: "Context is not a Structure instance (bypassed makeContext)", program });
    } else if ((v as unknown as Structure).primary !== undefined) {
      // C4.3b (R5 reframe): the DATA planes are role-exclusive (a Context
      // never carries a primary; an MV never carries slots) — the CHANNEL
      // plane is universal (flattened Contexts carry components directly).
      out.push({ invariant: "W5 role-transparency", detail: "Context role carries a primary (data slots + primary — D17)", program });
    } else {
      // C4.2 (W6): when a dense structure's legacy view exists, it must
      // agree with the dense region — the region is authoritative.
      const s = v as unknown as Structure;
      if (s.dense !== undefined && s.viewMaterialized) {
        for (let i = 0; i < s.dense.length; i++) {
          if ((v as ContextValue).bindings.get(String(i))?.value !== s.dense[i]) {
            out.push({ invariant: "W6 dense-view-coherence", detail: `view binding ${i} disagrees with the dense region`, program });
            break;
          }
        }
      }
    }
    // C4.3b: W3 covers the Context role's channel plane too — flattened
    // records/arrays carry registry-checked components directly.
    const sComps = (v as unknown as Structure).components as Map<string, Value> | undefined;
    if (sComps !== undefined) {
      for (const key of sComps.keys()) {
        if (!isRegisteredComponentKey(key)) {
          out.push({ invariant: "W3 registry-completeness", detail: `unregistered Context component key "${key}"`, program });
        }
      }
      for (const comp of sComps.values()) checkValueInvariants(comp as Value, program, out, seen, depth + 1);
    }
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
// table must reproduce these exactly. C4.3a UPDATE (maintainer-ratified
// rulings R1/R2, 2026-08): the two recorded WARTS were fixed — the error
// channel now rides every hop of a residual chain (`err-viral-chain`,
// `err-through-method`) and an error-carrying `if` condition propagates
// the error instead of silently taking the else branch (`err-in-if-cond`).
// The three expectations below were updated to the principled behavior as
// pre-approved test-condition changes per the C4.3 briefing.
export const DIFFERENTIAL_FIXTURES: { name: string; src: string; bind: string; expect: string }[] = [
  { name: "err-viral-arith", src: 'e = error "boom"\nr = e + 5', bind: "r", expect: "fmt=error(boom) | eff=- | err=boom" },
  { name: "err-viral-chain", src: 'e = error "boom"\nr = (e + 5) * 2 - 1', bind: "r", expect: "fmt=error(boom) | eff=- | err=boom" },
  { name: "err-both-operands", src: 'a = error "one"\nb = error "two"\nr = a + b', bind: "r", expect: "fmt=error(one) | eff=- | err=one" },
  { name: "err-in-if-cond", src: 'e = error "boom"\nr = if e then 1 else 2', bind: "r", expect: "fmt=error(boom) | eff=- | err=boom" },
  { name: "err-through-method", src: 'e = error "boom"\nr = e + 1\ns = r.toString()', bind: "s", expect: "fmt=error(boom) | eff=- | err=boom" },
  { name: "eff-inferred-io", src: "f(x) => print(x)\ng(x) => f(x)", bind: "g", expect: "fmt=<function(1)> | eff=io | err=-" },
  { name: "eff-if-branches", src: "h(c, x) => if c then print(x) else x", bind: "h", expect: "fmt=<function(2)> | eff=io | err=-" },
  { name: "eff-pure", src: "sq(x) => x * x", bind: "sq", expect: "fmt=<function(1)> | eff=- | err=-" },
  { name: "typed-result-shape", src: "r = 2 + 3", bind: "r", expect: "fmt=5 | eff=- | err=-" },
  { name: "typed-cmp-bool", src: "r = 3 < 5", bind: "r", expect: "fmt=true | eff=- | err=-" },
  { name: "refined-preserve", src: "PI = Refinement.define({refines: Int, where: p => p > 0, preserve: \"all\"})\nx = PI(5)\ny = x + 3", bind: "y", expect: "fmt=8 | eff=- | err=-" },
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
  return nv ? bitsToString(dataOf(nv) as BitsValue) : null;
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
    const namePrimary = dataOf(getName(intCtx!) as Value) as BitsValue;
    eq(bitsToString(namePrimary), "Int", "getName reads __name");
    const members = asContext(getMembers(intCtx!) as Value);
    eq(members !== null && members.bindings.size > 0, true, "getMembers reads __members");
    // Channel reads: shape on a typed value, discharged on a proof.
    const x = evalCtx.bindings.get("x")?.value as Value;
    const shape = asContext(channelReadRaw(x, "shape") as Value);
    eq(shape !== null, true, "shape channel readable on a typed value");
    eq(bitsToString(dataOf(getName(shape!) as Value) as BitsValue), "Int", "shape of 42 is Int");
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
    eq((dataOf(disch) as any).data, 1n, "still discharged");
    eq(bitsToString(dataOf(getProposition(ctx)!) as BitsValue).includes("1 + 1"), true, "proposition unchanged");
  });

  test("forgery D (live): reads are free; writing the read value onto a fake is refused", () => {
    const read = attack('theorem t: 1 + 1 == 2\nd = channel_read(t, "discharged")');
    eq(read.threw, null, "free read");
    const d = read.evalCtx!.bindings.get("d")!.value as Value;
    eq((dataOf(d) as any).data, 1n, "read the real discharge mark");
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
    eq((dataOf(d) as any).data, 1n, "the source proof itself still reads discharged");
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
    eq(bitsToString(dataOf(r.evalCtx!.bindings.get("r")!.value as Value) as BitsValue), "checked");
    eq(bitsToString(dataOf(r.evalCtx!.bindings.get("g")!.value as Value) as BitsValue), "ok");
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
    eq((dataOf(scopeLookup(child, "b9999")!.value!) as any).data, 9999n, "chain lookup reaches parent");
    eq((dataOf(scopeLookup(child, "x")!.value!) as any).data, 42n, "own layer found");
    // Shadowing: nearest layer wins.
    const shadow = scopeExtend(child, [["b0", { key: "b0", value: makeInt(777) }]]);
    eq((dataOf(scopeLookup(shadow, "b0")!.value!) as any).data, 777n, "child shadows parent");
    eq((dataOf(scopeLookup(parent, "b0")!.value!) as any).data, 0n, "parent unchanged");
    // Deep chains stay correct.
    let deep = scopeNew();
    deep.bindings.set("root", { key: "root", value: makeInt(1) });
    for (let i = 0; i < 2000; i++) deep = scopeExtend(deep, []);
    eq((dataOf(scopeLookup(deep, "root")!.value!) as any).data, 1n, "2000-layer chain lookup");
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
    eq(Number((dataOf(y.value!) as BitsValue).data), 7, "dependent sees the resolved value");
  });

  test("import satisfied by an extension (C2.3b): resolves through the chain, no pending cell", () => {
    const ext: Extension = { name: "m", bindings: { cfg: makeInt(9) } };
    const { evalCtx } = evalSource("import cfg\nx = cfg", undefined, [createTypeSystem(), ext], undefined, true);
    eq(evalCtx.bindings.has("cfg"), false, "provided import gets no cell on the source layer");
    eq(Number((dataOf(evalCtx.bindings.get("x")!.value!) as BitsValue).data), 9, "reference resolved through the extension layer");
  });

  test("REPL persistence (C2.3b): base chain flattens into a fresh layer — passes are mutation-isolated", () => {
    const r1 = evalSource("a = 1", undefined, [createTypeSystem()], undefined, true);
    const r2 = evalSource("b = a + 1", r1.evalCtx, [createTypeSystem()], undefined, true);
    eq(Number((dataOf(r2.evalCtx.bindings.get("b")!.value!) as BitsValue).data), 2, "prior-pass binding resolves through the base layer");
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
    eq(bitsToString(dataOf(getName(stored)!) as BitsValue), "PositiveInt", "stored type keeps the refinement bound");
    const shape = channelReadRaw(x, "shape") as ContextValue;
    eq(bitsToString(dataOf(getName(shape)!) as BitsValue), "Int", "shape channel reads the dispatch shape");
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
      "PI = Refinement.define({refines: Int, where: p => p > 0, preserve: \"all\"})\ny = PI(5)\nz = y + 3",
      undefined, [createTypeSystem()], undefined, true);
    const y = evalCtx.bindings.get("y")!.value as Value;
    const shape = channelReadRaw(y, "shape") as ContextValue;
    eq(bitsToString(dataOf(getName(shape)!) as BitsValue), "PI", "preserveOps type has its own member set — dispatch must reach its overrides");
    // ...and the lifted operator actually ran: z carries the PI tag.
    const z = evalCtx.bindings.get("z")!.value as Value;
    eq(bitsToString(dataOf(getName(getType(z)!)!) as BitsValue), "PI", "lifted op re-tagged the result");
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
    eq(bitsToString(dataOf(r1.evalCtx.bindings.get("s")!.value!) as BitsValue), "5", "refined value runs the shape's method");
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

  const C32_TYPES = "Animal = Type.define({legs: Int})\nDog = Type.define({legs: Int, tricks: Int}, Animal)\n";

  test("knowledge bounds (C3.2): the two-sided matrix — visibility follows knowledge, dispatch follows shape", () => {
    // Visible through the bound: Animal declares `legs`.
    const ok = evalSource(C32_TYPES + "f(a: Animal): Int => a.legs\nr = f(Dog(4, 7))",
      undefined, [createTypeSystem()], undefined, true);
    eq(Number((dataOf(ok.evalCtx.bindings.get("r")!.value!) as BitsValue).data), 4, "base member visible through the bound");
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
    eq(bitsToString(dataOf(getName(bound)!) as BitsValue), "Animal", "occurrence bound rides the value");
    eq(knowledgeOf(x)?.occurrenceBound === bound, true, "knowledgeOf surfaces the occurrence carrier");
  });

  test("knowledge bounds (C3.2): `when … is T` narrows — both subject forms; else arm keeps the bound", () => {
    // Symbol subject (scope-resolved binding): return boundary stamps the
    // bound; the matched arm lifts it.
    const r1 = evalSource(C32_TYPES + "mk(): Animal => Dog(2, 3)\na = mk()\nr = when a is Dog then a.tricks else 0 - 1",
      undefined, [createTypeSystem()], undefined, true);
    eq(Number((dataOf(r1.evalCtx.bindings.get("r")!.value!) as BitsValue).data), 3, "Symbol-subject narrowing");
    eq(occurrenceBoundOf(r1.evalCtx.bindings.get("a")!.value!) !== null, true, "narrowing is arm-local — the binding keeps its bound");
    // Substituted-param subject: identity replacement inside the arm.
    const r2 = evalSource(C32_TYPES + "g(a: Animal): Int => when a is Dog then a.tricks else 0 - 1\nr = g(Dog(4, 9))",
      undefined, [createTypeSystem()], undefined, true);
    eq(Number((dataOf(r2.evalCtx.bindings.get("r")!.value!) as BitsValue).data), 9, "substituted-param narrowing");
  });

  test("knowledge bounds (C3.2): boundary crossing resets occurrence knowledge", () => {
    const r = evalSource(
      C32_TYPES +
      "tc(d: Dog): Int => d.tricks\n" +
      "via(a: Animal): Int => when a is Dog then tc(a) else 0 - 1\n" +
      "r = via(Dog(4, 5))",
      undefined, [createTypeSystem()], undefined, true);
    eq(Number((dataOf(r.evalCtx.bindings.get("r")!.value!) as BitsValue).data), 5, "own-shape boundary restores full knowledge");
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
    const num = (k: string) => Number((dataOf(r.evalCtx.bindings.get(k)!.value!) as BitsValue).data);
    const str = (k: string) => bitsToString(dataOf(r.evalCtx.bindings.get(k)!.value!) as BitsValue);
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
      "PI = Refinement.define({refines: Int, where: p => p > 0, preserve: \"all\"})\nbare = 8 instanceof PI\ntagged = PI(5) instanceof PI",
      undefined, [createTypeSystem()], undefined, true);
    const num = (k: string) => Number((dataOf(r.evalCtx.bindings.get(k)!.value!) as BitsValue).data);
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
    const num = (k: string) => Number((dataOf(r.evalCtx.bindings.get(k)!.value!) as BitsValue).data);
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

  // --- Structure kind (C4.1) --------------------------------------------------

  test("structure kind (C4.1): factories construct the unified representation; roles are transparent", () => {
    const { evalCtx } = evalSource(
      "x = 42\np = {a: 1}\nPositiveInt = Int & _ > 0\ny = PositiveInt(5)",
      undefined, [createTypeSystem()], undefined, true);
    const x = evalCtx.bindings.get("x")!.value!;
    eq(isStructure(x), true, "typed literal (a CARRIER) is a Structure");
    eq((x as unknown as Structure).immutable, true, "carriers born immutable (D22)");
    // C7.1 (D15): a carrier's data plane is EMPTY — the lazily-
    // materialized view may exist, but it holds no slots.
    eq((x as unknown as Structure).bindings.size, 0, "carrier data plane is empty (D15/D17 restated)");
    eq(x.kind, ValueKind.Structure, "the carrier answers the one structure kind (MultiValue kind retired)");
    const p = dataOf(evalCtx.bindings.get("p")!.value!);
    eq(isStructure(p), true, "object Context role is a Structure");
    eq((p as unknown as Structure).primary === undefined, true, "Context role has no primary (D17)");
    const y = evalCtx.bindings.get("y")!.value!;
    eq(isStructure(y) && isStructure(getType(y)!), true, "refined value AND its type Context share the representation");
    eq(isStructure(evalCtx), true, "evaluation scopes share the substrate (plane split stays isScope/parent)");
  });

  test("structure kind (C4.1): key-sort partition — hostile data keys never touch the channel plane", () => {
    const r = evalSource(
      "o = {type: 5, effects: 7}\nv = o.type + o.effects",
      undefined, [createTypeSystem()], undefined, true);
    eq(Number((dataOf(r.evalCtx.bindings.get("v")!.value!) as BitsValue).data), 12,
      "data keys named after channels behave as plain fields (no channel confusion)");
    const oVal = r.evalCtx.bindings.get("o")!.value!;
    eq(getTypeNameOf(oVal), "Object", "the channel plane still reads the real type channel");
    const oCtx = dataOf(oVal) as ContextValue;
    eq(Number((dataOf(oCtx.bindings.get("type")!.value!) as BitsValue).data), 5,
      "the slot plane holds the hostile key independently");
  });

  test("structure kind (C4.1): future cells stay the sanctioned monotonic exception (D22 carve-out)", () => {
    const { evalCtx, registry } = evalSource("import cfg\nz = cfg",
      undefined, [createTypeSystem()], undefined, true);
    const cell = evalCtx.bindings.get("cfg")!;
    eq(isPendingCell(cell), true, "pending cell inside the (mutable, scope-role) structure");
    applyPhase(registry, evalCtx, new Map([["cfg", makeInt(3)]]));
    eq(Number((dataOf(cell.value!) as BitsValue).data), 3, "single-assignment resolution in place — monotonic, not mutation");
  });

  // --- Dense arrays (C4.2, D18) -----------------------------------------------

  test("dense region (C4.2): arrays store elements densely; hot paths never materialize the view", () => {
    const { evalCtx } = evalSource(
      "arr = [10, 20, 30]\na = arr[0]\nb = arr[2]\nn = arr.length\ns = arr.map(x => x + 1).reduce((acc, x) => acc + x, 0)",
      undefined, [createTypeSystem()], undefined, true);
    const arrCtx = dataOf(evalCtx.bindings.get("arr")!.value!) as unknown as Structure;
    eq(arrCtx.dense !== undefined, true, "array context carries the dense region");
    eq(arrCtx.viewMaterialized, false, "bracket access, length, map/reduce ran without materializing the legacy view");
    eq(Number((dataOf(evalCtx.bindings.get("s")!.value!) as BitsValue).data), 63, "HOF pipeline result correct over dense storage");
  });

  test("dense region (C4.2): O(1) index access — scaling test", () => {
    const small = dataOf(makeArray(Array.from({ length: 200 }, (_, i) => makeInt(i)))) as ContextValue;
    const big = dataOf(makeArray(Array.from({ length: 200_000 }, (_, i) => makeInt(i)))) as ContextValue;
    const time = (ctx: ContextValue, len: number): number => {
      const t0 = performance.now();
      let acc = 0n;
      for (let k = 0; k < 50_000; k++) {
        const v = indexGet(ctx, (k * 7919) % len)!;
        acc += (dataOf(v) as BitsValue).data;
      }
      // acc consumed so the loop can't be optimized away
      if (acc < 0n) throw new Error("unreachable");
      return performance.now() - t0;
    };
    time(small, 200); // warmup
    // Min-of-rounds (standard robust perf estimator) with a threshold sized
    // to the signal: the big array can never be cache-resident, so an honest
    // O(1) access pays 2–8× in cache misses depending on heap state — while
    // a linear scan would pay ~1000× (200k/200 more work). 20× separates the
    // two regimes with margin on both sides; a single-round 5× check was
    // flaky against GC/cache noise.
    let tSmall = Infinity, tBig = Infinity;
    for (let round = 0; round < 3; round++) {
      tSmall = Math.min(tSmall, time(small, 200));
      tBig = Math.min(tBig, time(big, 200_000));
    }
    eq(tBig < Math.max(tSmall, 1) * 20, true,
      `index access is length-independent (200 elems: ${tSmall.toFixed(1)}ms, 200k elems: ${tBig.toFixed(1)}ms)`);
  });

  test("dense region (C4.2): array/object duality — the legacy view answers the string-key protocol", () => {
    // A straggler reading the string-key protocol (bindings.get("0"))
    // materializes the lazy view, which must agree with the dense region
    // (W6) — and the dense region stays authoritative afterwards.
    const r = evalSource("arr = [7, 8, 9]", undefined, [createTypeSystem()], undefined, true);
    const arrCtx = dataOf(r.evalCtx.bindings.get("arr")!.value!) as unknown as Structure;
    eq(arrCtx.viewMaterialized, false, "no view before the straggler read");
    const viaMap = (arrCtx as unknown as ContextValue).bindings.get("0")?.value;
    eq(Number((dataOf(viaMap!) as BitsValue).data), 7, "string-key protocol answers from the materialized view");
    eq(arrCtx.viewMaterialized, true, "the straggler path materialized the view");
    eq(Number((dataOf(indexGet(arrCtx as unknown as ContextValue, 1)!) as BitsValue).data), 8,
      "dense region stays authoritative after materialization");
    eq(Number(((arrCtx as unknown as ContextValue).bindings.get("__length")!.value as BitsValue).data), 3, "view carries the __length slot");
    eq((arrCtx as unknown as ContextValue).bindingList.length, 4, "bindingList view: 3 elements + __length");
  });

  // --- MV-over-Context flatten (C4.3b) -----------------------------------------

  test("flatten (C4.3b): typed records answer Context; dataOf is identity", () => {
    const r = evalSource("p = {x: 1, y: 2}\ns = p.x + p.y",
      undefined, [createTypeSystem()], undefined, true);
    const p = r.evalCtx.bindings.get("p")!.value!;
    eq(p.kind, ValueKind.Structure, "a typed record IS a Context — no MultiValue wrapper");
    eq(dataOf(p) === p, true, "dataOf is identity for flattened records");
    eq(getType(p) !== null, true, "the type channel rides the record directly");
    eq(Number((dataOf(r.evalCtx.bindings.get("s")!.value!) as BitsValue).data), 3,
      "field access dispatches through the flattened record's type");
    eq(formatValue(p), "{x: 1, y: 2}", "flattened records print as records");
  });

  test("flatten (C4.3b): typed arrays answer Context with the dense region + channels", () => {
    const r = evalSource("arr = [1, 2, 3]\nm = arr.map(x => x * 2)",
      undefined, [createTypeSystem()], undefined, true);
    const arr = r.evalCtx.bindings.get("arr")!.value!;
    eq(arr.kind, ValueKind.Structure, "a typed array IS a Context");
    eq((arr as unknown as Structure).dense !== undefined, true, "dense region rides with the channel plane");
    eq(getTypeNameOf(arr), "Array", "type channel present on the flattened array");
    eq(formatValue(arr), "[1, 2, 3]", "flattened arrays print as arrays");
    eq(formatValue(r.evalCtx.bindings.get("m")!.value!), "[2, 4, 6]", "HOFs work over flattened arrays");
  });

  test("flatten (C4.3b): user-visible type bindings ARE the internal singletons (identity)", () => {
    const r = evalSource("x = 1", undefined, [createTypeSystem()], undefined, true);
    const intBinding = scopeLookup(r.evalCtx, "Int")!.value!;
    eq(intBinding === (IntType as unknown as Value), true,
      "the Int binding is the IntType Context itself — no wrapper, one identity");
    eq(getType(intBinding as Value) === (dataOf(TypeMeta as unknown as Value) as ContextValue), true,
      "getType is total: a bare type Context answers its meta-type through __type");
  });

  test("flatten (C4.3b): `type of` and instanceof read type values uniformly", () => {
    const r = evalSource("t = type of Int\nb = 42 instanceof Int\nm = Int instanceof Type",
      undefined, [createTypeSystem()], undefined, true);
    eq(formatValue(r.evalCtx.bindings.get("b")!.value!), "true", "value instanceof");
    eq(formatValue(r.evalCtx.bindings.get("m")!.value!), "true", "type instanceof meta-type");
    const t = r.evalCtx.bindings.get("t")!.value!;
    eq(dataOf(t) === dataOf(TypeMeta as unknown as Value), true, "`type of Int` is the Type meta-type");
  });

  test("flatten (C4.3b): MV-over-Context is unconstructible — makeMultiValue flattens", () => {
    const r = evalSource("p = {a: 5}", undefined, [createTypeSystem()], undefined, true);
    const record = r.evalCtx.bindings.get("p")!.value!;
    // The standard writer idiom: clone the channel plane, extend, re-derive
    // (the given map is authoritative — deletion must stay expressible).
    const comps = cloneComponents(record);
    comps.set("exported", makeInt(1));
    const stamped = makeMultiValue(dataOf(record), comps);
    eq((stamped as Value).kind, ValueKind.Structure, "wrapping a Context derives a flattened Context");
    eq(channelReadRaw(stamped as Value, "exported") !== undefined, true, "the new channel rides");
    eq(channelReadRaw(stamped as Value, "type") !== undefined, true, "cloned channels carry forward");
    eq(dataOf(stamped as Value) === (stamped as Value), true, "the derived value is transparent to dataOf");
    eq((record as ContextValue).bindings.get("a") === (stamped as unknown as ContextValue).bindings.get("a"), true,
      "copy-on-write derive shares the data plane by reference");
  });

  test("flatten (C4.3b): channels survive scope-fact predicates on flattened records", () => {
    // withPredicates on a flattened record must not strip its type channel
    // (the hot symbol-resolution path attaches scope facts).
    const r = evalSource("p = {x: 1}", undefined, [createTypeSystem()], undefined, true);
    const record = r.evalCtx.bindings.get("p")!.value!;
    const withPreds = withPredicates(record, new PredicateSet([{ shape: { kind: "interval", lo: 0, hi: 10 }, source: "assert" }]));
    eq(getType(withPreds) !== null, true, "type channel preserved through withPredicates");
    eq(withPreds.kind, ValueKind.Structure, "still a flattened Context");
  });

  // --- FQN symbols (C5.1) ------------------------------------------------------

  test("fqn symbols (C5.1): same FQN is the same object — interned identity", () => {
    const a = registerScopeSymbol("lib/geometry.alg", "area");
    const b = registerScopeSymbol("lib/geometry.alg", "area");
    eq(a === b, true, "re-registration returns the interned symbol");
    eq(a.name, "area", "base-name projection preserved");
    eq(symbolFqn(a), "lib/geometry.alg::area", "identity is the FQN");
    eq(isRegisteredSymbol(a), true);
    // Reload simulation: a fresh loader/eval pass re-registers the same
    // scope — the intern table outlives it, so identity survives reload.
    const c = registerScopeSymbol("lib/geometry.alg", "area");
    eq(c === a, true, "identity survives re-registration across loader instances");
  });

  test("fqn symbols (C5.1): distinct scopes mint distinct symbols with equal base names", () => {
    const a = registerScopeSymbol("lib/alpha.alg", "size");
    const b = registerScopeSymbol("lib/beta.alg", "size");
    eq(a !== b, true, "same base name, different defining scope — different identity");
    eq(a.name === b.name, true, "base-name projections are equal");
    // Transient parser symbols never alias registered identity.
    const t = makeSymbol("size");
    eq(isRegisteredSymbol(t), false, "parser-minted symbols are transient references");
    eq(symbolFqn(t), null);
  });

  test("fqn symbols (C5.1): the ambiguity rule fires identically at all three surfaces", () => {
    // One resolver (projectBaseName), three surface framings — import
    // resolution (exported symbols of two modules), member binding
    // (descriptor targets), dot access (same candidates reached through
    // the access path). Each matrix row must produce the same outcome at
    // every surface (C5.2 adopts the resolver at the latter two).
    const m1 = registerScopeSymbol("lib/m1.alg", "draw");
    const m2 = registerScopeSymbol("lib/m2.alg", "draw");
    const only = registerScopeSymbol("lib/m1.alg", "unique_op");
    const sharedTarget = { impl: "one-target" };

    const surfaces: { name: string; candidates: () => BaseNameCandidate[] }[] = [
      { name: "import-resolution", candidates: () => [{ symbol: m1 }, { symbol: m2 }, { symbol: only }] },
      { name: "member-binding", candidates: () => [
        { symbol: m1, target: { desc: "m1.draw" } }, { symbol: m2, target: { desc: "m2.draw" } }, { symbol: only, target: { desc: "m1.unique" } },
      ] },
      { name: "dot-access", candidates: () => [
        { symbol: m1, target: { desc: "m1.draw" } }, { symbol: m2, target: { desc: "m2.draw" } }, { symbol: only, target: { desc: "m1.unique" } },
      ] },
    ];
    for (const s of surfaces) {
      const unique = projectBaseName(s.candidates(), "unique_op");
      eq(unique.outcome, "match", `${s.name}: single target resolves`);
      const amb = projectBaseName(s.candidates(), "draw");
      eq(amb.outcome, "ambiguous", `${s.name}: two distinct targets are ambiguous`);
      eq((amb as { message: string }).message.includes("qualification"), true,
        `${s.name}: the error demands explicit qualification`);
      const qual = projectBaseName(s.candidates(), "draw", "lib/m2.alg");
      eq(qual.outcome === "match" && (qual as { symbol: typeof m2 }).symbol === m2, true,
        `${s.name}: explicit qualification resolves`);
      const missing = projectBaseName(s.candidates(), "draw", "lib/nowhere.alg");
      eq(missing.outcome, "none", `${s.name}: qualification to an absent scope finds nothing`);
      const absent = projectBaseName(s.candidates(), "no_such_member");
      eq(absent.outcome, "none", `${s.name}: zero candidates`);
    }
    // §8 multi-bind: one member bound to two symbols is ONE target —
    // stays unambiguous at every surface.
    const d1 = registerScopeSymbol("lib/m1.alg", "render");
    const d2 = registerScopeSymbol("lib/m3.alg", "render");
    const multiBound = projectBaseName(
      [{ symbol: d1, target: sharedTarget }, { symbol: d2, target: sharedTarget }], "render");
    eq(multiBound.outcome, "match", "multi-bound single target stays unambiguous");
  });

  test("fqn symbols (C5.1, D42): the wire never mints — export partition only", () => {
    registerScopeSymbol("lib/vault.alg", "secret_helper"); // registered, NOT exported
    const pub = markExported("lib/vault.alg", "open_api");
    eq(symbolFromWire("lib/vault.alg::open_api") === pub, true,
      "an exported FQN rebinds to the identical symbol");
    const before = internCount();
    eq(symbolFromWire("lib/vault.alg::secret_helper"), null,
      "a private (registered-but-not-exported) symbol resolves to NOTHING over the wire");
    eq(symbolFromWire("lib/never-loaded.alg::anything"), null, "unknown module scope resolves to nothing");
    eq(symbolFromWire("no-separator"), null, "malformed FQN resolves to nothing");
    eq(internCount(), before, "failed rebinds mint no symbols (registry unchanged)");
    eq(symbolToWire(pub), "lib/vault.alg::open_api", "wire form is the FQN");
    let threw = false;
    try { symbolToWire(makeSymbol("transient")); } catch { threw = true; }
    eq(threw, true, "transient reference symbols have no wire identity");
  });

  test("fqn symbols (C5.1): evalSource registers top-level bindings under the scope FQN", () => {
    evalSource("alpha_val = 1\nbeta_fn(x) => x", undefined, [createTypeSystem()],
      undefined, true, undefined, undefined, "test/fqn-demo.alg");
    const a1 = registerScopeSymbol("test/fqn-demo.alg", "alpha_val");
    const b1 = registerScopeSymbol("test/fqn-demo.alg", "beta_fn");
    eq(isRegisteredSymbol(a1) && isRegisteredSymbol(b1), true, "both bindings registered");
    // Re-evaluating the same module scope yields the same identities.
    evalSource("alpha_val = 2", undefined, [createTypeSystem()],
      undefined, true, undefined, undefined, "test/fqn-demo.alg");
    eq(registerScopeSymbol("test/fqn-demo.alg", "alpha_val") === a1, true,
      "identity survives re-evaluation of the defining scope");
    // Default scope: top-level/REPL registers under <main>.
    evalSource("main_only = 7", undefined, [createTypeSystem()], undefined, true);
    eq(symbolFqn(registerScopeSymbol(MAIN_SCOPE_FQN, "main_only")), "<main>::main_only");
  });

  // --- Symbol-keyed members (C5.2a) --------------------------------------------

  test("symbol-keyed members (C5.2a/C6.1a): member sets key by per-type member FQNs", () => {
    const members = getMembers(dataOf(IntType as unknown as Value) as ContextValue) as ContextValue;
    // C6.1a: built-ins moved OFF the shared kernel scope — Int declares
    // its members in its OWN name-stable scope, so Int.add and Float.add
    // are distinct symbols and cross-built-in conformance is never
    // accidental under symbol membership.
    const intScope = typeMemberScopeFqn("Int");
    eq(members.bindings.has(intScope + "::add"), true, "storage key is the member symbol's FQN in Int's own scope");
    eq(members.bindings.has("add"), false, "bare string keys are gone from member storage");
    eq(members.bindings.has(kernelMemberFqn("add")), false, "the shared kernel scope is retired for built-ins");
    eq(typeMethod(dataOf(IntType as unknown as Value) as ContextValue, "add") !== null, true,
      "typeMethod projects by base name through the per-type scope");
    // E3 (B-027 §8): the kernel scalars DRAW Equatable retroactively —
    // `eq` is multi-bound under Equatable's member symbol and the
    // refl/sym/trans Law descriptors ride in (retroactive declared
    // conformance). Every key therefore lives in Int's own scope OR
    // Equatable's; no other scope may appear.
    const equatableScope = typeMemberScopeFqn("Equatable");
    for (const key of members.bindings.keys()) {
      eq(key.startsWith(intScope) || key.startsWith(equatableScope), true,
        `member key '${key}' lives in Int's or Equatable's scope`);
    }
    // The consequence the move exists for: near-identical built-ins do
    // NOT conform to each other (Int and Float spell many same names).
    const r = evalSource("a = 3.14 instanceof Int\nb = 42 instanceof Float",
      undefined, [createTypeSystem()], undefined, true);
    eq(formatValue(r.evalCtx.bindings.get("a")!.value!), "false", "Float value is not an Int");
    eq(formatValue(r.evalCtx.bindings.get("b")!.value!), "false", "Int value is not a Float");
  });

  test("symbol-keyed members (C5.2a): typeShape's sharing invariant survives the re-keying", () => {
    // Refinement layers still SHARE the parent's member-set object (ruling
    // R1), so member-transparency-by-identity keeps working — including the
    // now-explicit sharers (chained clause layers, structural wrap).
    const r = evalSource(
      "P = Int & _ > 0\nQ = Int & _ > 0 & _ < 100",
      undefined, [createTypeSystem()], undefined, true);
    const intMembers = getMembers(dataOf(IntType as unknown as Value) as ContextValue);
    for (const name of ["P", "Q"]) {
      const t = dataOf(r.evalCtx.bindings.get(name)!.value!) as ContextValue;
      eq(getMembers(t) === intMembers, true, `${name} shares Int's member-set object`);
    }
    const wrapped = structuralWrapTS(dataOf(IntType as unknown as Value) as ContextValue);
    eq(getMembers(wrapped) === intMembers, true, "~Int (structuralWrap) shares Int's member-set object");
    const p = dataOf(r.evalCtx.bindings.get("P")!.value!) as ContextValue;
    eq(typeShape(p) === dataOf(IntType as unknown as Value), true,
      "typeShape walks the transparent layer off (identity test intact)");
  });

  // --- Draw-from binding (C5.2b, D30) ------------------------------------------

  test("draw-from (C5.2b): declared members bind drawn symbols; new names are type-local", () => {
    const r = evalSource(
      "Animal = Type.define({name: String})\nDog = Type.define({name: String, age: Int}, Animal)",
      undefined, [createTypeSystem()], undefined, true);
    const animal = dataOf(r.evalCtx.bindings.get("Animal")!.value!) as ContextValue;
    const dog = dataOf(r.evalCtx.bindings.get("Dog")!.value!) as ContextValue;
    const keyOf = (t: ContextValue, base: string): string | null => {
      for (const key of (getMembers(t) as ContextValue).bindings.keys()) {
        if (key.endsWith("::" + base)) return key;
      }
      return null;
    };
    const animalName = keyOf(animal, "name")!;
    eq(animalName.startsWith("<type"), true, "a field matching nothing drawn is TYPE-LOCAL");
    // C6.1a: binding stabilized the local scope onto the declaration site.
    eq(animalName.startsWith("<type#<main>::Animal>"), true, "bound types get name-stable member scopes");
    eq(keyOf(dog, "name") === animalName, true,
      "Dog's re-declared `name` DRAWS Animal's symbol — override keeps member identity");
    const dogAge = keyOf(dog, "age")!;
    eq(dogAge.startsWith("<type"), true, "a new field gets a type-local symbol");
    const scopeOfKey = (k: string): string => k.slice(0, k.lastIndexOf("::"));
    eq(scopeOfKey(dogAge) !== scopeOfKey(animalName), true,
      "Dog's local scope is distinct from Animal's");
    // Dispatch and construction still work over drawn + local symbols.
    const r2 = evalSource(
      "Animal = Type.define({name: String})\nDog = Type.define({name: String, age: Int}, Animal)\nd = Dog(\"rex\", 3)\ns = d.name",
      undefined, [createTypeSystem()], undefined, true);
    eq(formatValue(r2.evalCtx.bindings.get("s")!.value!), "rex", "field access resolves through the drawn symbol");
  });

  test("draw-from (C5.2b): lifted preserveOps ops bind the parent op's symbol; meta wart fixed", () => {
    const r = evalSource(
      "PI = Refinement.define({refines: Int, where: p => p > 0, preserve: \"all\"})\nx = PI(5)\ny = x + 3",
      undefined, [createTypeSystem()], undefined, true);
    const pi = dataOf(r.evalCtx.bindings.get("PI")!.value!) as ContextValue;
    const piMembers = getMembers(pi) as ContextValue;
    const intMembers = getMembers(dataOf(IntType as unknown as Value) as ContextValue) as ContextValue;
    // The lifted `add` sits under Int's own `add` key (an override — same symbol).
    const intAddKey = [...intMembers.bindings.keys()].find((k) => k.endsWith("::add"))!;
    eq(piMembers.bindings.has(intAddKey), true, "lifted op draws (binds) the parent op's symbol");
    eq(piMembers.bindings.get(intAddKey)?.value !== intMembers.bindings.get(intAddKey)?.value, true,
      "…with the lifted implementation, not the parent's");
    // The wart fix: no meta-method names in the instance member set.
    for (const key of piMembers.bindings.keys()) {
      eq(["instanceof", "subtypeof", "define", "where", "invariant", "distinct",
          "constructor", "interface", "preserveOps", "mixin"].includes(key.split("::").pop()!), false,
        `meta-method '${key}' must not ride into an instance member set`);
    }
    eq(formatValue(r.evalCtx.bindings.get("y")!.value!), "8", "lifted dispatch works");
  });

  test("draw-from (C5.2b): multi-bind — one target under several symbols stays unambiguous; distinct targets error", () => {
    // Hand-build the diamond shapes the machinery must handle before any
    // surface can produce them: a member set with two same-base-name keys.
    const desc = typeMemberDescriptor(dataOf(IntType as unknown as Value) as ContextValue, "add")!;
    const mkType = (twoTargets: boolean): ContextValue => {
      const t = evalSource("T = Type.define({v: Int})", undefined, [createTypeSystem()], undefined, true);
      const ty = dataOf(t.evalCtx.bindings.get("T")!.value!) as ContextValue;
      const members = getMembers(ty) as ContextValue;
      const k1 = registerScopeSymbol("<type:testA>", "draw").fqn!;
      const k2 = registerScopeSymbol("<type:testB>", "draw").fqn!;
      const desc2 = twoTargets
        ? typeMemberDescriptor(dataOf(IntType as unknown as Value) as ContextValue, "sub")!
        : desc;
      members.bindings.set(k1, { key: k1, value: desc as Value });
      members.bindings.set(k2, { key: k2, value: desc2 as Value });
      return ty;
    };
    // One descriptor multi-bound to two symbols = ONE target → resolves.
    const multiBound = mkType(false);
    eq(typeMemberDescriptor(multiBound, "draw") === desc, true,
      "multi-bound member resolves — one target through two symbols");
    // Two distinct descriptors under one base name → §5 ambiguity error.
    const conflicted = mkType(true);
    let threw = "";
    try { typeMemberDescriptor(conflicted, "draw"); } catch (e: any) { threw = String(e.message); }
    eq(threw.includes("ambiguous"), true, "distinct targets under one base name error at access");
  });

  // --- Declared-conformance split (C5.2c, D30 — the ratified conscious delta) --

  test("conformance split (C5.2c): declared vs loose — one matrix, both paths", () => {
    // The plan's C5.2 boundary contract: a same-named member from an
    // UNDECLARED context does NOT satisfy an interface check, while ~T
    // still matches it by base name.
    const r = evalSource(
      "Greets = Interface.define({greet: Function})\n" +
      "Greeter = Type.define({greet: Function}, Greets)\n" +
      "Stranger = Type.define({greet: Function})\n" +
      "g = Greeter(0)\ns = Stranger(0)\n" +
      "a = g instanceof Greets\n" +
      "b = s instanceof Greets\n" +
      "loose(v: ~Greets) => 1\n" +
      "c = loose(s)",
      undefined, [createTypeSystem()], undefined, true);
    eq(formatValue(r.evalCtx.bindings.get("a")!.value!), "true",
      "a type that DREW the interface's symbols conforms");
    eq(formatValue(r.evalCtx.bindings.get("b")!.value!), "false",
      "a same-named member from an undeclared context does NOT satisfy the interface");
    eq(formatValue(r.evalCtx.bindings.get("c")!.value!), "1",
      "~T still matches the undeclared type by base name (the loose path)");
    // The wrap erases the interface marker — a wrapped interface IS the
    // loose world, not declared conformance with the name hidden.
    const greets = dataOf(r.evalCtx.bindings.get("Greets")!.value!) as ContextValue;
    const wrapped = structuralWrapTS(greets);
    eq(isInterfaceTypeSlots(wrapped), false, "structuralWrap erases the __interface marker");
  });

  // --- One construction surface (C6.1a, D45) -----------------------------------

  test("define (D45): Type.define(spec, ...bundles) — fresh, drawn, and diamond forms", () => {
    const r = evalSource(
      "Fresh = Type.define({v: Int})\n" +
      "HasX = Interface.define({x: Int})\n" +
      "HasY = Interface.define({y: Int})\n" +
      "Point = Type.define({x: Int, y: Int}, HasX, HasY)\n" +
      "p = Point(1, 2)\ns = p.x + p.y\n" +
      "a = Point subtypeof HasX\n" +
      "b = Point subtypeof HasY\n" +
      "c = Fresh subtypeof HasX",
      undefined, [createTypeSystem()], undefined, true);
    eq(formatValue(r.evalCtx.bindings.get("s")!.value!), "3",
      "diamond record constructs and reads fields from both bundles");
    eq(formatValue(r.evalCtx.bindings.get("a")!.value!), "true",
      "Point drew HasX's member symbols — declared conformance");
    eq(formatValue(r.evalCtx.bindings.get("b")!.value!), "true",
      "…and HasY's — multi-bundle draws resolve per member");
    eq(formatValue(r.evalCtx.bindings.get("c")!.value!), "false",
      "an undrawn same-kind type does not conform");
    // D44: composition mints NO is-a edge — conformance is symbol
    // membership, the refines slot stays empty on defined records.
    for (const name of ["Fresh", "Point"]) {
      const t = dataOf(r.evalCtx.bindings.get(name)!.value!) as ContextValue;
      eq(getRefines(t) === undefined, true, `${name}: define mints no refines edge`);
    }
  });

  test("define (D45): non-kind dispatch guides migration; concrete conflicts are explicit; extend is gone", () => {
    // `Int.define(...)` — dispatch finds Type's `define` through Int's
    // shape, but self is a type, not a kind. The error names the D45 form.
    let threw = "";
    try {
      evalSource("T = Int.define({x: Int})", undefined, [createTypeSystem()], undefined, true);
    } catch (e: any) { threw = String(e.message); }
    eq(threw.includes("not a kind"), true, `non-kind dispatch is rejected: ${threw}`);
    eq(threw.includes("Type.define(spec, Int)"), true, "…and the error names the migration form");
    // Two concrete record bundles both carry their own toString symbol —
    // distinct targets under one base name is the explicit-conflict error
    // (D44: no silent linearization), surfaced at define time.
    let conflict = "";
    try {
      evalSource(
        "A = Type.define({x: Int})\nB = Type.define({y: Int})\nC = Type.define({x: Int, y: Int}, A, B)",
        undefined, [createTypeSystem()], undefined, true);
    } catch (e: any) { conflict = String(e.message); }
    eq(conflict.includes("explicit resolution required"), true,
      `concrete-bundle conflict errors explicitly: ${conflict}`);
    // Decisive migration (maintainer ruling): `extend` is REMOVED, not sugar.
    let gone = false;
    try {
      evalSource("T = Int.extend({x: Int})", undefined, [createTypeSystem()], undefined, true);
    } catch { gone = true; }
    eq(gone, true, "extend is no longer a member of Type");
  });

  // --- The kind tower (C6.1b, D45) ----------------------------------------------

  test("kind tower (C6.1b, D45): the half-lotus matrix + kind construct authority", () => {
    const r = evalSource(
      "a = Type instanceof Type\n" +               // fixed point (D7)
      "b = Refinement instanceof Type\n" +
      "c = Interface instanceof Type\n" +
      "d = Interface instanceof Refinement\n" +
      "e = Refinement instanceof Interface\n" +    // ✗ — holds constructor authority
      "f = Type instanceof Refinement\n" +         // ✗ — Type is not a refinement
      "P = Int & _ > 0\n" +
      "g = P instanceof Refinement\n" +            // refined types are Refinement instances
      "h = P instanceof Type\n" +                  // …conforming to Type through the kind
      "Printable = Interface.define({toString: Function})\n" +
      "i = Printable instanceof Interface\n" +     // interfaces are Interface instances
      "j = Printable instanceof Refinement\n" +    // …but NOT Refinement instances
      "k = 42 instanceof Refinement\n" +           // data values are not types
      // Constructor authority (D45 R2): call-as-function mints at every level.
      "Anon = Type({v: Int})\n" +
      "x = Anon(5)\nl = x.v\n" +
      "Q = Refinement(Int, q => q > 0)\n" +        // the mint `&` sugars
      "m = Q(5)\n" +
      "n = Q(0 - 1)",
      undefined, [createTypeSystem()], undefined, true);
    const want: [string, string, string][] = [
      ["a", "true", "Type : Type — the fixed point"],
      ["b", "true", "Refinement : Type — drawn membership"],
      ["c", "true", "Interface : Type — refinement of Type conforms"],
      ["d", "true", "Interface : Refinement — built by the refinement mint"],
      ["e", "false", "Refinement : Interface — constructor authority rejected by the predicate"],
      ["f", "false", "Type : Refinement — Type is not a refinement"],
      ["g", "true", "a refined type is an instance of Refinement"],
      ["h", "true", "…and of Type, through kind conformance"],
      ["i", "true", "an interface is an instance of Interface"],
      ["j", "false", "…but not of Refinement"],
      ["k", "false", "a data value is no kind's instance"],
      ["l", "5", "Type({v: Int}) mints a working record type"],
      ["m", "5", "Refinement(Int, pred) mints a working refined type"],
    ];
    for (const [name, expect, why] of want) {
      eq(formatValue(r.evalCtx.bindings.get(name)!.value!), expect, `${name}: ${why}`);
    }
    eq(formatValue(r.evalCtx.bindings.get("n")!.value!).includes("refinement check failed"), true,
      "the kind-minted refinement still rejects with a counterexample");
    // `type of P` IS the Refinement kind object (identity, not name match).
    const p = dataOf(r.evalCtx.bindings.get("P")!.value!) as ContextValue;
    eq(getType(p) === RefinementKindTS, true, "a refined type's meta IS the Refinement kind");
  });

  test("kind tower (C6.1b ruling): bundle order is not significant; kind-hood is conformance", () => {
    // Order symmetry: swapping bundles yields identical behavior.
    const build = (order: string) => evalSource(
      "HasX = Interface.define({x: Int})\nHasY = Interface.define({y: Int})\n" +
      `P = Type.define({x: Int, y: Int}, ${order})\n` +
      "s = P(1, 2).x + P(1, 2).y\na = P subtypeof HasX\nb = P subtypeof HasY",
      undefined, [createTypeSystem()], undefined, true);
    for (const order of ["HasX, HasY", "HasY, HasX"]) {
      const r = build(order);
      eq(formatValue(r.evalCtx.bindings.get("s")!.value!), "3", `constructs (${order})`);
      eq(formatValue(r.evalCtx.bindings.get("a")!.value!), "true", `conforms to HasX (${order})`);
      eq(formatValue(r.evalCtx.bindings.get("b")!.value!), "true", `conforms to HasY (${order})`);
    }
    // Two bundles overriding one shared symbol DIFFERENTLY: an explicit-
    // conflict error in either order — never first-bundle-wins.
    const conflictSrc = (defC: string) =>
      "I = Interface.define({m: Function})\n" +
      "A = Type.define({m: (self) => 1}, I)\n" +
      "B = Type.define({m: (self) => 2}, I)\n" + defC;
    for (const order of ["A, B", "B, A"]) {
      let threw = "";
      try {
        evalSource(conflictSrc(`C = Type.define({v: Int}, ${order})`),
          undefined, [createTypeSystem()], undefined, true);
      } catch (e: any) { threw = String(e.message); }
      eq(threw.includes("order is not significant"), true,
        `bundle-bundle conflict errors (${order}): ${threw}`);
    }
    // Declaring the member in the spec IS the explicit resolution.
    const rr = evalSource(
      conflictSrc("C = Type.define({v: Int, m: (self) => 3}, A, B)\nz = C(0).m()"),
      undefined, [createTypeSystem()], undefined, true);
    eq(formatValue(rr.evalCtx.bindings.get("z")!.value!), "3",
      "a spec declaration resolves the conflict (overrides both)");
    // Kind-hood is not a convention: no reified Kind (D7) — a kind is a
    // type holding Type's kind-member symbols, so `subtypeof Type` IS the
    // kind test, from Allegro itself.
    const rk = evalSource(
      "k1 = Refinement subtypeof Type\nk2 = Interface subtypeof Type\nk3 = Int subtypeof Type",
      undefined, [createTypeSystem()], undefined, true);
    eq(formatValue(rk.evalCtx.bindings.get("k1")!.value!), "true", "Refinement is a kind");
    eq(formatValue(rk.evalCtx.bindings.get("k2")!.value!), "true", "Interface is a kind");
    eq(formatValue(rk.evalCtx.bindings.get("k3")!.value!), "false", "Int is a type, not a kind");
  });

  test("kind tower (C6.1b, D45): the fluent API is gone; kind specs replace it", () => {
    // Removed decisively (maintainer ruling): no sugar, no fallback.
    for (const call of ["Int.where(n => n > 0)", "Interface.define({x: Int}).mixin({m: (s) => s})",
                        "(Int & _ > 0).preserveOps()", "Int.invariant(s => s > 0)", "Type.interface({x: Int})"]) {
      let threw = false;
      try {
        evalSource(`T = ${call}`, undefined, [createTypeSystem()], undefined, true);
      } catch { threw = true; }
      eq(threw, true, `fluent call must fail: ${call}`);
    }
    // The replacements, end to end: preserve lifts ops through the spec;
    // spec methods dispatch; bundles draw.
    const r = evalSource(
      "PI = Refinement.define({refines: Int, where: p => p > 0, preserve: \"all\", double: self => self + self})\n" +
      "x = PI(5)\ny = x + 3\nz = y instanceof PI\nd = x.double()\n" +
      "M = Type.define({mag: (self) => self.v * self.v})\n" +
      "V = Type.define({v: Int}, M)\nm = V(9).mag()\nc = V subtypeof M",
      undefined, [createTypeSystem()], undefined, true);
    eq(formatValue(r.evalCtx.bindings.get("y")!.value!), "8", "preserve: lifted op keeps the refinement");
    eq(formatValue(r.evalCtx.bindings.get("z")!.value!), "true", "…and the result answers instanceof");
    eq(formatValue(r.evalCtx.bindings.get("d")!.value!), "10", "spec method dispatches with self");
    eq(formatValue(r.evalCtx.bindings.get("m")!.value!), "81", "a methods-only BUNDLE draws into a record");
    eq(formatValue(r.evalCtx.bindings.get("c")!.value!), "true", "drawing the bundle declares conformance");
  });

  test("kind tower (C6.2, D40): Effect re-derived — kind, label instances, anonymous conjunctions", () => {
    const r = evalSource(
      // Effect joins the tower by construction (no whitelist).
      "a = Effect instanceof Type\n" +
      "b = Effect subtypeof Type\n" +
      // §6 deltas 6+7: instance-of is the relation; conformance is not.
      "c = pure instanceof Effect\n" +
      "d = pure subtypeof Effect\n" +
      // Constructor authority at the kind level (D40 R2).
      "io = Effect(\"io\")\ntime = Effect(\"time\")\n" +
      "e = io instanceof Effect\n" +
      // The R3 operator mint: `io & time` IS an Effect instance carrying
      // the union label set — the deferred anonymous-conjunction debt.
      "conj = io & time\n" +
      "f = conj instanceof Effect\n" +
      "g = io.subset_of(conj)\n" +
      "h = conj.subset_of(io)\n" +
      // The order lives on the KIND; instances dispatch through shape
      // (no per-instance member copies).
      "i = io.union(time).subset_of(conj)\n" +
      "j = conj.subset_of(io.union(time))",
      undefined, [createTypeSystem()], undefined, true);
    const want: [string, string, string][] = [
      ["a", "true", "Effect is an instance of Type"],
      ["b", "true", "…and a KIND — it drew Type's kind-member symbols"],
      ["c", "true", "pure instanceof Effect — instance-of is the check (D40 R5)"],
      ["d", "false", "pure subtypeof Effect — the chain-hack true is gone (§6 delta 6)"],
      ["e", "true", "Effect(\"io\") mints an instance"],
      ["f", "true", "io & time mints an ANONYMOUS Effect instance (R3)"],
      ["g", "true", "{io} ⊆ {io, time} — the kind's declared order"],
      ["h", "false", "{io, time} ⊄ {io}"],
      ["i", "true", "union dispatches through the kind and equals the operator mint"],
      ["j", "true", "…in both directions (same label set)"],
    ];
    for (const [name, expect, why] of want) {
      eq(formatValue(r.evalCtx.bindings.get(name)!.value!), expect, `${name}: ${why}`);
    }
    // D37/D40: label-set identity is PHYSICAL identity (memoized mint) —
    // two independent conjunction mints are the same Context.
    const conj = dataOf(r.evalCtx.bindings.get("conj")!.value!) as ContextValue;
    const viaUnion = dataOf(evalSource(
      "x = Effect(\"time\") & Effect(\"io\")\nx",
      undefined, [createTypeSystem()], undefined, true)
      .evalCtx.bindings.get("x")!.value!) as ContextValue;
    eq(conj === viaUnion, true, "equal label sets are the SAME instance, either operand order");
    // No member copies on instances; no refines edge (the C6.1a guard's
    // reason is gone — this pins its principled replacement).
    eq(getMembers(conj), undefined, "instances hold no member copies — members live on the kind");
    eq(getRefines(conj), undefined, "no refines chain hack");
    eq(formatValue(r.evalCtx.bindings.get("conj")!.value!), "io & time", "conjunctions render their label set");
  });

  test("kind tower (C6.3, D40/D45): Proof re-derived — kernel-private mint, forge attempts fail", () => {
    // Proof joins the tower by construction, like Effect.
    const r = evalSource(
      "a = Proof instanceof Type\n" +
      "b = Proof subtypeof Type\n" +
      "theorem t1: 1 + 1 == 2\n" +
      "c = t1 instanceof Proof\n" +
      "d = t1.proposition",
      undefined, [createTypeSystem()], undefined, true);
    eq(formatValue(r.evalCtx.bindings.get("a")!.value!), "true", "Proof is an instance of Type");
    eq(formatValue(r.evalCtx.bindings.get("b")!.value!), "true", "…and a kind — drew Type's kind API");
    eq(formatValue(r.evalCtx.bindings.get("c")!.value!), "true", "a discharged theorem is a Proof instance");
    eq(formatValue(r.evalCtx.bindings.get("d")!.value!), "1 + 1 == 2",
      "instance fields are DECLARED members — `.proposition` dispatches (D39 executed)");
    // Constructor authority is KERNEL-PRIVATE: every public mint surface fails.
    // (1) The named factory refuses — no construct to delegate to.
    let threw = "";
    try {
      evalSource("P = Proof.define({p: Int})", undefined, [createTypeSystem()], undefined, true);
    } catch (e: any) { threw = String(e.message); }
    eq(threw.includes("no constructor authority"), true, `Proof.define refused: ${threw}`);
    // (2) Call-as-function has no construct to invoke — the call residualises
    // (ordinary PE for an unresolvable application) and the result is NOT a
    // Proof: an inert Expression with no shape stamp and no discharged channel.
    const r2 = evalSource(
      "p = Proof(\"x == x\")",
      undefined, [createTypeSystem()], undefined, true);
    const p = r2.evalCtx.bindings.get("p")!.value!;
    eq(dataOf(p).kind === ValueKind.Expression, true,
      "calling Proof mints nothing — the call stays an inert residual");
    eq(channelReadRaw(p, "discharged") === undefined, true,
      "…with no discharged channel");
    // (3) Drawing Proof as a bundle copies FIELD declarations only — the
    // lookalike holds no discharged channel, does not conform, and its
    // instances are not Proofs.
    const r3 = evalSource(
      "Fake = Type.define({v: Int}, Proof)\n" +
      "e = Fake subtypeof Proof\n" +
      "f = Fake(1) instanceof Proof",
      undefined, [createTypeSystem()], undefined, true);
    eq(formatValue(r3.evalCtx.bindings.get("e")!.value!), "false",
      "a bundle-draw lookalike does NOT conform (Proof's kind-API symbols are meta-filtered)");
    eq(formatValue(r3.evalCtx.bindings.get("f")!.value!), "false",
      "…and its instances are not Proof instances");
    const r3b = evalSource(
      "Fake = Type.define({v: Int}, Proof)\nx = Fake(1)\nx",
      undefined, [createTypeSystem()], undefined, true);
    const fakeInst = dataOf(r3b.evalCtx.bindings.get("x")!.value!);
    eq(channelReadRaw(fakeInst, "discharged") === undefined, true,
      "the lookalike constructs records — never discharged witnesses");
    // (4) The object-literal forge stays dead (C1.4 gate; scenario A) —
    // the construction gate THROWS on integrity-channel origination.
    let forged = "";
    try {
      evalSource("p = {__discharged: 1, proposition: \"forged\"}",
        undefined, [createTypeSystem()], undefined, true);
    } catch (e: any) { forged = String(e.message); }
    eq(forged.includes("origination requires the channel writer"), true,
      `an object literal cannot forge a Proof — the gate throws: ${forged}`);
  });

  test("slot sweep (C6.3, D39): retired slots are gone from registry, keys, and code", () => {
    const names = new Set(SLOT_REGISTRY.map((r) => r.name));
    for (const retired of ["__effect_kind", "__invariantsList", "__proposition",
                           "__reason", "__counterexample", "__eq_lhs", "__eq_rhs"]) {
      eq(names.has(retired), false, `registry row executed: ${retired}`);
    }
    // The proof fields are plain instance data now — SLOT_KEYS agrees.
    eq((SLOT_KEYS as any).proposition, "proposition", "SLOT_KEYS.proposition is a plain key");
    eq((SLOT_KEYS as any).invariantsList, undefined, "SLOT_KEYS.invariantsList is swept");
    // W3 (registry completeness over the value corpus) runs as its own
    // standing invariant; this test pins the DISPOSITIONS this phase executed.
  });

  // --- The carrier (C7.1, D15/D46): MultiValue-kind retirement ----------------

  test("carrier (C7.1, D15): typed scalars are transparent structures — one kind, data + channels", () => {
    const r = evalSource(
      "x = 42\ns = \"hi\"\nf(a: Int): Int => a + 1\ny = f(x)\nP = Int & _ > 0\np = P(5)",
      undefined, [createTypeSystem()], undefined, true);
    const x = r.evalCtx.bindings.get("x")!.value!;
    // The one kind: a typed scalar answers Structure (the MultiValue kind
    // is deleted from the enum — this line not compiling would be the
    // regression).
    eq(x.kind, ValueKind.Structure, "a typed scalar answers the one structure kind");
    // Duality: data through dataOf; channels through the channel plane.
    eq(Number((dataOf(x) as BitsValue).data), 42, "dataOf reads the primary");
    eq(getType(x) !== null, true, "the type channel rides");
    eq(formatValue(x), "42", "display unchanged");
    // D15: the carrier's data plane is EMPTY — record-shaped consumers
    // see no slots, so a carrier can never be mistaken for a record.
    eq((dataOf(r.evalCtx.bindings.get("s")!.value!) as BitsValue).kind, ValueKind.Bits,
      "string carriers peel to Bits");
    eq(formatValue(r.evalCtx.bindings.get("y")!.value!), "43", "typed calls flow through carriers");
    eq(formatValue(r.evalCtx.bindings.get("p")!.value!), "5", "refined construction still certifies");
    // W1 restated: carriers never nest — re-typing a carrier re-wraps its
    // inner data, never the carrier.
    const rewrapped = makeMultiValue(x, new Map([["type", dataOf(IntType as unknown as Value)]]));
    eq((rewrapped as { primary?: Value }).primary !== undefined
       && ((rewrapped as { primary: Value }).primary as { primary?: Value }).primary === undefined, true,
      "makeMultiValue on a carrier re-wraps the inner data (no nesting)");
  });

  // --- Scalar transparency at the eager boundary (C4.3c, R4) -------------------

  test("transparency (C4.3c): eager impls receive full values — channels visible", () => {
    // An eager primitive's impl can read its args' channel plane directly:
    // the boundary no longer strips (R4 — the propagation table alone
    // governs channels; impls read data through dataOf/asBits).
    let seenTypeName: string | null = null;
    let seenDataKind: ValueKind | null = null;
    const probe = makePrimitive("__c43c_probe", (args) => {
      const t = getType(args[0]);
      seenTypeName = t ? bitsToString(getName(t) as BitsValue) : null;
      seenDataKind = dataOf(args[0]).kind;
      return makeInt(1);
    });
    const scope = scopeNew();
    const typedFive = withType(makeInt(5), IntType as unknown as ContextValue);
    evaluate(makeExpr(probe, [typedFive]), scope);
    eq(seenTypeName, "Int", "the impl sees the arg's type channel");
    eq(seenDataKind, ValueKind.Bits, "dataOf unwraps the transparent scalar to its data");
  });

  test("transparency (C4.3c): proof combinators are plain eager and still see Proof channels", () => {
    // The former channelAware registration mode is retired — proof_refl is
    // an ordinary eager primitive now, and the Proof structure (a flattened
    // Context since C4.3b) arrives whole.
    const r = evalSource("theorem t: 2 + 2 == 4 by proof_refl(4)\np = proof_refl(7)",
      undefined, [createTypeSystem()], undefined, true);
    const p = r.evalCtx.bindings.get("p")!.value!;
    eq(channelReadRaw(p, "discharged") !== undefined, true, "proof discharged marker rides");
    eq(primitives["proof_refl"].lazy ?? false, false, "proof_refl is plain eager");
  });

  // --- Merge-policy activation (C4.3a, rulings R1–R3) --------------------------

  test("merge policies (C4.3a, R1): error channel rides a deep residual chain", () => {
    // Four hops past the originating operation — the legacy behavior lost
    // the channel after the first (the updated err-viral-chain fixture pins
    // three hops; this covers depth beyond it).
    const r = evalSource('e = error "boom"\nr = ((e + 1) * 2 - 3) / 4 + 5',
      undefined, [createTypeSystem()], undefined, true);
    const v = r.evalCtx.bindings.get("r")!.value!;
    const err = channelReadRaw(v, "error");
    eq(err !== undefined, true, "error channel survives every residual hop");
    eq(formatValue(err as Value), "boom", "the original error payload rides unchanged");
  });

  test("merge policies (C4.3a, R3): effects union on MultiValue re-evaluation", () => {
    // An outer MultiValue carrying {io} whose primary re-evaluates to a value
    // carrying {net}: union-rule channels merge by union via the installed
    // channel merge — the legacy inner-shadows-outer would have kept {net} only.
    const scope = scopeExtend(scopeNew(), [
      ["s", { key: "s", value: withEffects(makeInt(1), new Set(["net"])) }],
    ]);
    const outer = withEffects(makeSymbol("s"), new Set(["io"]));
    const result = evaluate(outer, scope);
    const eff = effectsOf(result);
    eq(eff !== null && eff.has("io") && eff.has("net") && eff.size === 2, true,
      `effects merged by union, got {${eff ? [...eff].sort().join(",") : ""}}`);
    eq(Number((dataOf(result) as BitsValue).data), 1, "primary resolved through the flatten");
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
