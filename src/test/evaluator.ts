// =============================================================================
// Evaluator: the two partial-evaluation rules, pinned as they are today.
//
// B-172 (the partial-evaluation rules as implemented against the spine),
// chunk C1; plan docs/plans/pe-rules.md §5. Each test compiles a small
// program through `evalSource` and the stats sink and pins what the evaluator
// produces for an application with an unresolved input: PE Rule 1 (an
// application with an unresolved argument) and PE Rule 2 (a lazy primitive
// whose control input is unresolved), `docs/book/concepts.md` §25.
//
// A test whose name says "gap pin" pins today's behaviour where it falls
// short of a rule (the plan's §1 term). Its comment names the chunk that
// flips it and the ruling it flips under. The plan's ratification at the
// merge of PR #147 is the discussion `docs/book/process.md` §6 asks for
// before such a test condition changes; no other assertion here changes.
// =============================================================================

import { test, eq } from "./harness.js";
import { typeExt } from "./fixtures.js";
import { libLoader } from "./alg-files.js";
import { evalSource as runtimeEval, type Extension, type CompilationReport } from "../runtime.js";
import { setEvalStatsSink, isTailCall, evaluate, type EvalReport, type EvalStats } from "../evaluator.js";
import { effectsOf } from "../effects.js";
import { metaReadRaw } from "../metadata.js";
import { scopeCompileMode } from "../scope.js";
import { getName } from "../slot-accessors.js";
import { makePrimitive, makeStructure, bitsToString, ValueKind, type Value, type BitsValue, type StructureValue } from "../types.js";

// --- Helpers ----------------------------------------------------------------

/** A lazy probe, `c1_probe(e)`: evaluates `e` in its own context, records
 *  the result when that context is in compile mode (the precompile pass),
 *  and returns it, so it changes nothing else. Its argument is not in tail
 *  position, so a call in it is an ordinary application. */
function probe(): { ext: Extension; seen: Value[] } {
  const seen: Value[] = [];
  const impl = (args: Value[], ctx: any, evalFn: any) => {
    const r = evalFn(args[0], ctx);
    if (scopeCompileMode(ctx)) seen.push(r);
    return r;
  };
  return { ext: { name: "c1_probe", bindings: { c1_probe: makePrimitive("c1_probe", impl as any, true) } }, seen };
}

interface Compiled {
  values: Map<string, Value>;
  report: CompilationReport;
  stats: EvalStats;
  printed: string[];
  seen: Value[];
  ctx: StructureValue;
}

/** The counts a pin asserts, as one comparable string. */
function counts(s: EvalStats): string {
  return `evaluate=${s.evaluateCalls} applyComposed=${s.applyComposedCalls} applyPrimitive=${s.applyPrimitiveCalls}` +
    ` inlineExpansions=${s.inlineExpansions} cutoffResiduals=${s.cutoffResiduals} precompiles=${s.precompiles}`;
}

/** Compile and run `src` through `evalSource` with the stats sink, printing
 *  nothing: Standard mode (`typed`) with the type system and the probe, or
 *  Allegretto alone. Returns the top-level values, the compilation report,
 *  the program's own stats report, what `print` printed, and what the probe
 *  saw in compile mode. */
function compileOnce(src: string, typed: boolean, extra: Extension[] = []): Compiled {
  const p = probe();
  const reports: EvalReport[] = [];
  const previousSink = setEvalStatsSink(r => { reports.push(r); });
  const printed: string[] = [];
  const origLog = console.log;
  console.log = (...a: any[]) => { printed.push(a.join(" ")); };
  let result;
  try {
    result = runtimeEval(src, undefined, typed ? [typeExt, ...extra, p.ext] : [...extra, p.ext], undefined, typed);
  } finally {
    console.log = origLog;
    setEvalStatsSink(previousSink);
  }
  const own = reports.filter(r => r.source === "<main>");
  eq(own.length, 1, "one stats report for the program");
  const values = new Map<string, Value>();
  for (const [name, b] of (result.evalCtx as any).bindings as Map<string, { value?: Value }>) {
    if (b.value !== undefined) values.set(name, b.value);
  }
  return { values, report: result.compilationReport!, stats: own[0].stats, printed, seen: p.seen, ctx: result.evalCtx as StructureValue };
}

/** `compileOnce` three times: the counts must not differ between runs in one
 *  process. Returns the first run. */
function compile(src: string, typed = true, extra: Extension[] = []): Compiled {
  const first = compileOnce(src, typed, extra);
  for (let i = 2; i <= 3; i++) {
    const again = compileOnce(src, typed, extra);
    eq(counts(again.stats), counts(first.stats), `run ${i}'s counts equal run 1's`);
  }
  return first;
}

/** Read a top-level value; fail when it is missing. */
function valueOf(c: Compiled, name: string): Value {
  const v = c.values.get(name);
  if (v === undefined) throw new Error(`no value bound to ${name}`);
  return v;
}

/** An effect set as a sorted, comma-separated string; "none" when empty. */
function effectsText(v: Value): string {
  const e = effectsOf(v);
  return e && e.size > 0 ? [...e].sort().join(",") : "none";
}

/** The name of the type a value carries on its `type` field, or "untyped". */
function typeName(v: Value): string {
  const t = metaReadRaw(v, "type");
  if (t === undefined || t.kind !== ValueKind.Structure) return "untyped";
  const n = getName(t as StructureValue);
  return n !== undefined && n.kind === ValueKind.Bits ? bitsToString(n as BitsValue) : "unnamed";
}

/** The shape of a value: its kind; for an Expression, its function position
 *  (a primitive's name, or the kind) and its argument count. */
function shape(v: Value): string {
  if (v.kind !== ValueKind.Expression) return v.kind;
  const f = v.fn;
  const head = f.kind === ValueKind.PrimitiveFunction ? `primitive ${f.name}` : f.kind;
  return `Expression(${head}; ${v.args.length} args)`;
}

/** The body of a zero-parameter thunk; fail on anything else. */
function thunkBody(v: Value): Value {
  if (v.kind !== ValueKind.ComposedFunction || v.params.length !== 0) throw new Error(`not a thunk: ${v.kind}`);
  return v.body;
}

/** The `use effects` library, as the file runner loads it. */
function effectsLibrary(): Extension {
  const ext = libLoader().loadModuleSync("effects");
  return { name: "effects", bindings: { ...ext.bindings }, grammarFragment: ext.grammarFragment };
}

/** Compile `src` with the effects library; the halt message, or null when
 *  it compiles. Twice, to show the answer does not depend on the first. */
function haltOf(src: string): string | null {
  const lib = effectsLibrary();
  let answer: string | null | undefined;
  for (let i = 0; i < 2; i++) {
    let got: string | null = null;
    try { compileOnce(src, true, [lib]); }
    catch (e: any) { got = String(e.message ?? e); }
    if (answer !== undefined) eq(got, answer, "the second compilation answers as the first");
    answer = got;
  }
  return answer!;
}

/** `g(b)` with `effects pure` over `body`, and `h(m) => print(m)` beside it:
 *  the probes of the plan's §2.4. */
function pureDeclared(body: string): string {
  return `h(m) => print(m)\ng(b) =>\n  effects pure\n  ${body}\n`;
}

const MISMATCH = "effects mismatch in g: declared `pure`, inferred `io`";

// --- PE Rule 1: an application with an unresolved argument -------------------

test("B-172 C1 evaluator: Rule 1 — a composed call with an unresolved argument unfolds; inlineExpansions counts it", () => {
  // `applyComposed` substitutes the arguments into the callee's body and
  // evaluates it (the plan's §1, unfold). The probe sees the partially
  // evaluated body of `inc`, not an application of `inc`. The precompile
  // pass precompiles `once` twice (F3b on the literal, then the pass's own),
  // so the probe sees it twice and there are two inline expansions.
  const c = compile("inc(x: Int) => x + 1\nonce(x: Int) => c1_probe(inc(x))\n");
  eq(c.seen.length, 2, "the probe ran in both precompiles of once");
  for (const r of c.seen) {
    eq(shape(r), "Expression(primitive bits_add; 2 args)", "the unfolded body of inc");
    if (r.kind !== ValueKind.Expression) continue;
    eq(r.args[0].kind, ValueKind.Param, "inc's parameter is once's unresolved x");
    eq(typeName(r), "Int", "typed by the dispatcher");
  }
  eq(c.stats.inlineExpansions, 2, "inline expansions");
  eq(c.stats.cutoffResiduals, 0, "cutoff residuals");
  eq(c.stats.precompiles, 4, "precompiles");
});

test("B-172 C1 evaluator: Rule 1 — unfolding infers a return type through an untyped helper", () => {
  // The plan's §2.3, result 3: `twice` declares no return type, and the
  // report infers `Int` through two unfolded calls of `inc`.
  const c = compile("inc(x: Int) => x + 1\ntwice(x: Int) => inc(inc(x))\n");
  eq(c.report.inferred.find(i => i.name === "twice")?.returnType, "Int", "twice's inferred return type");
  eq(c.stats.inlineExpansions, 2, "inline expansions");
  eq(c.stats.cutoffResiduals, 0, "cutoff residuals");
});

test("B-172 C1 evaluator: Rule 1 — at run time a composed call with an unresolved argument unfolds; inlineExpansions counts only the precompile pass", () => {
  // Allegretto alone: `r` is the body of `inc` with `zzz` substituted, not
  // an application of `inc`. One `applyComposed` call; no inline expansion
  // is counted, since the counter counts only inside the precompile pass.
  const c = compile("inc(x) => x + 1\nr = inc(zzz)\n", false);
  const r = valueOf(c, "r");
  eq(shape(r), "Expression(primitive bits_add; 2 args)", "r is inc's body");
  if (r.kind === ValueKind.Expression) eq(r.args[0].kind, ValueKind.Symbol, "zzz stays a Symbol");
  eq(c.stats.applyComposedCalls, 1, "applyComposed calls");
  eq(c.stats.inlineExpansions, 0, "inline expansions");
  eq(c.stats.precompiles, 0, "precompiles (no pass in Allegretto)");
});

test("B-172 C1 evaluator: Rule 1 — a call into a recursion cycle in a typed compilation residualises; cutoffResiduals counts it", () => {
  // The inline cutoff (T-R6, the recursion inlining cutoff) answers true for
  // `loud`, so `applyComposed` returns the call as an Expression over the
  // callee and its evaluated argument (the plan's §1, residualise). A call
  // from outside the cycle carries the callee's effects, which `loud`'s own
  // precompile stashed before `caller` is precompiled.
  const c = compile(
    "loud(n: Int): Int => if n == 0 then print(0) else 1 + loud(n - 1)\n" +
    "caller(n: Int): Int => 1 + c1_probe(loud(n))\n");
  eq(c.seen.length, 2, "the probe ran in both precompiles of caller");
  for (const r of c.seen) {
    eq(shape(r), "Expression(ComposedFunction; 1 args)", "the residual call of loud");
    if (r.kind === ValueKind.Expression) eq(r.args[0].kind, ValueKind.Param, "the argument is caller's unresolved n");
    eq(effectsText(r), "io", "the residual carries loud's effects");
  }
  eq(c.stats.cutoffResiduals, 4, "cutoff residuals");
  eq(c.stats.inlineExpansions, 0, "inline expansions: no recursive unfolding");
  eq(effectsText(valueOf(c, "caller")), "div,io", "caller's effects");
});

test("B-172 C1 evaluator: Rule 1 — a self-recursive call residualises with no effect while its callee is being precompiled", () => {
  // The cutoff's residual carries the callee's effect set as it is at the
  // call: while `loud` is itself being precompiled no set is stashed yet, so
  // the residual carries none. `loud`'s own set comes from its `print`.
  const c = compile("loud(n: Int): Int => if n == 0 then print(0) else 1 + c1_probe(loud(n - 1))\n");
  eq(c.seen.length, 2, "the probe ran in both precompiles of loud");
  for (const r of c.seen) {
    eq(shape(r), "Expression(ComposedFunction; 1 args)", "the residual call of loud");
    eq(effectsText(r), "none", "no effect set on the callee yet");
  }
  eq(c.stats.cutoffResiduals, 2, "cutoff residuals");
  eq(c.stats.inlineExpansions, 0, "inline expansions");
  eq(effectsText(valueOf(c, "loud")), "div,io", "loud's effects");
});

test("B-172 C1 evaluator: Rule 1 — an eager primitive with an unresolved argument residualises, typed by the dispatcher", () => {
  const c = compile("addone(x: Int): Int => c1_probe(x + 1)\n");
  eq(c.seen.length, 2, "the probe ran in both precompiles of addone");
  for (const r of c.seen) {
    eq(shape(r), "Expression(primitive bits_add; 2 args)", "the residual of +");
    if (r.kind === ValueKind.Expression) eq(r.args[0].kind, ValueKind.Param, "the unresolved argument");
    eq(typeName(r), "Int", "typed by the first dispatcher that answers");
  }
  eq(c.stats.applyComposedCalls, 0, "applyComposed calls");
  // Allegretto alone: no dispatcher installed, so the residual is untyped.
  const b = compile("t = bits_add(zzz, 1)\n", false);
  const t = valueOf(b, "t");
  eq(shape(t), "Expression(primitive bits_add; 2 args)", "the residual of bits_add");
  eq(typeName(t), "untyped", "no dispatcher in Allegretto");
});

test("B-172 C1 evaluator: Rule 1 — an unresolved function position residualises, carrying the Param's effect", () => {
  // The plan's §2.2: a Param in function position carries its effect
  // variable, else its bound, else `opaque`; `f: pure` is an empty bound.
  const c = compile(
    "apply[e: Effect](g: e, x: Int): Int => c1_probe(g(x))\n" +
    "fwd(f, x: Int): Int => c1_probe(f(x))\n" +
    "bounded(f: pure, x: Int): Int => c1_probe(f(x))\n");
  eq(c.seen.length, 6, "two precompiles each of apply, fwd and bounded");
  const order = ["e", "e", "opaque", "opaque", "none", "none"];
  c.seen.forEach((r, i) => {
    eq(shape(r), "Expression(Param; 1 args)", `probe ${i}: the residual call of the Param`);
    eq(effectsText(r), order[i], `probe ${i}: the Param's effect`);
  });
  eq(effectsText(valueOf(c, "apply")), "e", "apply's effects");
  eq(effectsText(valueOf(c, "fwd")), "opaque", "fwd's effects");
  eq(effectsText(valueOf(c, "bounded")), "none", "bounded's effects");
  // An unbound name in function position, at run time, in Allegretto.
  const b = compile("s = zzz(1)\n", false);
  const s = valueOf(b, "s");
  eq(shape(s), "Expression(Symbol; 1 args)", "the residual call of zzz");
  eq(effectsText(s), "none", "an unbound Symbol carries no effect");
});

// --- PE Rule 2: a lazy primitive whose control input is unresolved ----------

test("B-172 C1 evaluator: Rule 2 — eval_if with an unresolved condition evaluates both branches and residualises", () => {
  // Compile mode defers the `print` in the then-branch to a residual that
  // carries `io`, and the residual `eval_if` carries it up.
  const c = compile("primbranch(b: Int): Int => c1_probe(if b == 0 then print(b) else 0)\n");
  eq(c.seen.length, 2, "the probe ran in both precompiles of primbranch");
  for (const r of c.seen) {
    eq(shape(r), "Expression(primitive eval_if; 3 args)", "the residual eval_if");
    if (r.kind !== ValueKind.Expression) continue;
    eq(shape(r.args[0]), "Expression(primitive bits_eq; 2 args)", "the evaluated condition");
    const then = thunkBody(r.args[1]);
    eq(shape(then), "Expression(primitive print; 1 args)", "the then-branch, evaluated: a deferred print");
    eq(effectsText(then), "io", "the deferred print carries io");
    eq(thunkBody(r.args[2]).kind, ValueKind.Bits, "the else-branch, evaluated");
    eq(effectsText(r), "io", "the residual carries the branches' effects");
  }
  eq(effectsText(valueOf(c, "primbranch")), "io", "primbranch's effects");
  eq(c.printed.length, 0, "nothing printed at compile time");
});

test("B-172 C1 evaluator: gap pin (C3 flips, RR2) — eval_when with an unresolved subject residualises with no arm evaluated", () => {
  // GAP PIN. C3 flips it under RR2 (a): each arm's guard and body will be
  // evaluated speculatively and the residual will hold the evaluated arms,
  // so `whenop` and `whenbind` will infer `io`. Today the residual holds the
  // arms as written and no arm's effect reaches the function.
  const c = compile("whenop(b: Int): Int => c1_probe(when b is 0 then print(b) is _ then 0)\n");
  eq(c.seen.length, 2, "the probe ran in both precompiles of whenop");
  for (const r of c.seen) {
    eq(shape(r), "Expression(primitive eval_when; 5 args)", "the residual eval_when");
    if (r.kind !== ValueKind.Expression) continue;
    eq(r.args[0].kind, ValueKind.Param, "the unresolved subject");
    const arm = thunkBody(r.args[3]);
    eq(shape(arm), "Expression(primitive print; 1 args)", "the first arm's body, as written");
    eq(effectsText(arm), "none", "the arm was not evaluated: no deferred print, no io");
    eq(shape(thunkBody(r.args[4])), "Expression(primitive eval_when; 5 args)", "the rest of the chain, as written");
    eq(effectsText(r), "none", "the residual carries no effect");
  }
  eq(effectsText(valueOf(c, "whenop")), "none", "whenop's effects (C3: io)");
  const bind = compile("whenbind(b: Int): Int => when b is n then print(n) is _ then 0\n");
  eq(effectsText(valueOf(bind, "whenbind")), "none", "whenbind's effects (C3: io)");
});

test("B-172 C1 evaluator: Rule 2 — && with an unresolved left operand evaluates the right operand speculatively (gap pin, C2 flipped it, RR3)", () => {
  // Was a GAP PIN; C2 flipped it under RR3 (a). The right operand is
  // evaluated speculatively by applying its thunk in a scope compile mode
  // marks, so the `print` defers to a residual carrying `io`; the residual
  // holds that evaluated operand in a thunk and carries its effects, so
  // `andop` infers `io`. Until C2 the residual held the thunk as written and
  // `andop` inferred nothing.
  const c = compile("andop(b: Bool): Bool => c1_probe(b && print(b))\n");
  eq(c.seen.length, 2, "the probe ran in both precompiles of andop");
  for (const r of c.seen) {
    eq(shape(r), "Expression(primitive typed_and; 2 args)", "the residual typed_and");
    if (r.kind !== ValueKind.Expression) continue;
    eq(r.args[0].kind, ValueKind.Param, "the unresolved left operand");
    const right = thunkBody(r.args[1]);
    eq(shape(right), "Expression(primitive print; 1 args)", "the right operand, evaluated: a deferred print");
    eq(effectsText(right), "io", "the deferred print carries io");
    eq(effectsText(r), "io", "the residual carries the right operand's effects");
  }
  eq(effectsText(valueOf(c, "andop")), "io", "andop's effects");
  eq(c.printed.length, 0, "nothing printed at compile time");
});

test("B-172 C1 evaluator: Rule 2 — || with an unresolved left operand evaluates the right operand speculatively (gap pin, C2 flipped it, RR3)", () => {
  // Was a GAP PIN; C2 flipped it under RR3 (a), as for `&&`: `orop` infers
  // `io`. Until C2 it inferred nothing.
  const c = compile("orop(b: Bool): Bool => c1_probe(b || print(b))\n");
  eq(c.seen.length, 2, "the probe ran in both precompiles of orop");
  for (const r of c.seen) {
    eq(shape(r), "Expression(primitive typed_or; 2 args)", "the residual typed_or");
    if (r.kind !== ValueKind.Expression) continue;
    eq(r.args[0].kind, ValueKind.Param, "the unresolved left operand");
    const right = thunkBody(r.args[1]);
    eq(shape(right), "Expression(primitive print; 1 args)", "the right operand, evaluated: a deferred print");
    eq(effectsText(right), "io", "the deferred print carries io");
    eq(effectsText(r), "io", "the residual carries the right operand's effects");
  }
  eq(effectsText(valueOf(c, "orop")), "io", "orop's effects");
  eq(c.printed.length, 0, "nothing printed at compile time");
});

// --- The effect gap of the plan's §2.4: `effects pure` over a hidden print ---

test("B-172 C1 evaluator: Rule 2 — a pure-declared function whose if hides a print halts with the mismatch", () => {
  eq(haltOf(pureDeclared(`if b then print("x") else 0`))?.includes(MISMATCH), true, "the if row halts");
});

test("B-172 C1 evaluator: Rule 1 — a pure-declared function whose unfolded call hides a print halts with the mismatch", () => {
  eq(haltOf(pureDeclared("h(b)"))?.includes(MISMATCH), true, "the call row halts");
});

test("B-172 C1 evaluator: Rule 2 — a pure-declared function whose && hides a print halts with the mismatch (gap pin, C2 flipped it, RR3)", () => {
  // Was a GAP PIN; C2 flipped it under RR3 (a): the `print` is inferred and
  // the declaration check halts with the mismatch, as the `if` row does.
  // Until C2 the row compiled.
  eq(haltOf(pureDeclared(`b && print("x")`))?.includes(MISMATCH), true, "the && row halts");
});

test("B-172 C1 evaluator: Rule 2 — a pure-declared function whose || hides a print halts with the mismatch (gap pin, C2 flipped it, RR3)", () => {
  // Was a GAP PIN; C2 flipped it under RR3 (a), as for `&&`. Until C2 the
  // row compiled.
  eq(haltOf(pureDeclared(`b || print("x")`))?.includes(MISMATCH), true, "the || row halts");
});

test("B-172 C1 evaluator: gap pin (C3 flips, RR2) — a pure-declared function whose when hides a print compiles", () => {
  // GAP PIN. C3 flips it under RR2 (a): the arm will be evaluated and the
  // declaration check will halt with the mismatch.
  eq(haltOf(pureDeclared(`when b is 1 then print("x") is _ then 0`)), null, "the when row compiles (C3: halts)");
});

// --- The two findings of the plan's §2.5 ---------------------------------------

/** True when `v`, or any value reachable from it through an Expression's
 *  function position and arguments or a function's body, is a TailCall
 *  sentinel. */
function holdsSentinel(v: Value, seen: Set<unknown> = new Set()): boolean {
  if (isTailCall(v)) return true;
  if (v === null || typeof v !== "object" || seen.has(v)) return false;
  seen.add(v);
  if (v.kind === ValueKind.Expression) return holdsSentinel(v.fn, seen) || v.args.some(a => holdsSentinel(a, seen));
  if (v.kind === ValueKind.ComposedFunction) return holdsSentinel(v.body, seen);
  return false;
}

test("B-172 C1 evaluator: Rule 2 — a tail call in a branch under an unresolved condition is applied; no residual holds a sentinel (gap pin, C2 flipped it, RR7)", () => {
  // Was a GAP PIN, the plan's §2.5 finding 1; C2 flipped it under RR7 (a).
  // `h(b)` sits in tail position of the then-branch, so `evaluateExpr`
  // returns a TailCall sentinel for it; the speculation of the branch
  // (`evaluateSpeculatively`) applies it there. This program has no
  // recursion cycle, so no inline cutoff is installed and the call is
  // residualised as an Expression carrying `h`'s effects: `inbranch`,
  // `local` and the pure-declared `g` see `h`'s `io`. Until C2 the residual
  // `eval_if` held the sentinel and none of them inferred an effect.
  const c = compile(
    "h(m) => print(m)\n" +
    "direct(b: Int): Int => h(b)\n" +
    "inbranch(b: Int): Int => if b == 0 then h(b) else 0\n" +
    "local(b: Int): Int =>\n  y = if b == 0 then h(b) else 0\n  y\n" +
    "r = inbranch(zzz)\n");
  eq(effectsText(valueOf(c, "direct")), "io", "direct's effects: the unfolded call carries io");
  eq(effectsText(valueOf(c, "inbranch")), "io", "inbranch's effects");
  eq(effectsText(valueOf(c, "local")), "io", "local's effects");
  // At run time, `inbranch(zzz)` unfolds to its body's residual: the
  // `type_check` wrapper over the residual `eval_if`, whose then-branch
  // holds the residual call of `h`, a value.
  const r = valueOf(c, "r");
  eq(shape(r), "Expression(primitive type_check; 2 args)", "r is inbranch's wrapped body");
  if (r.kind === ValueKind.Expression) {
    const iff = r.args[0];
    eq(shape(iff), "Expression(primitive eval_if; 3 args)", "the residual eval_if");
    if (iff.kind === ValueKind.Expression) {
      const then = thunkBody(iff.args[1]);
      eq(isTailCall(then), false, "the then-branch holds no TailCall sentinel");
      eq(shape(then), "Expression(ComposedFunction; 1 args)", "the then-branch holds the residual call of h");
      eq(effectsText(then), "io", "the residual call carries h's io");
      eq(thunkBody(iff.args[2]).kind, ValueKind.Bits, "the else-branch holds a value");
    }
  }
  eq(holdsSentinel(r), false, "no residual reachable from r holds a sentinel");
  eq(c.printed.length, 0, "h was not run");
  eq(haltOf(pureDeclared("if b then h(b) else 0"))?.includes(MISMATCH), true, "the pure-declared branch call halts");
});

test("B-172 C1 evaluator: Rule 2 — a tail call in a branch, with a cutoff installed, is unfolded; a recursive one is cut (C2, RR7)", () => {
  // RR7 (a) where an inline cutoff is installed: a typed compilation with a
  // recursion cycle (`loop`). The branch's call of `h` is unfolded, as a
  // call outside a branch is, and `inbranch` infers `h`'s `io`; the branch's
  // recursive call of `loop` is cut by the cutoff and residualised.
  const c = compile(
    "h(m) => print(m)\n" +
    "loop(n: Int): Int => if n == 0 then 0 else loop(n - 1)\n" +
    "inbranch(b: Int): Int => c1_probe(if b == 0 then h(b) else 0)\n");
  eq(effectsText(valueOf(c, "inbranch")), "io", "inbranch's effects");
  for (const r of c.seen) {
    eq(shape(r), "Expression(primitive eval_if; 3 args)", "the residual eval_if");
    if (r.kind !== ValueKind.Expression) continue;
    eq(shape(thunkBody(r.args[1])), "Expression(primitive print; 1 args)", "the then-branch holds h's unfolded body");
    eq(holdsSentinel(r), false, "the residual holds no sentinel");
  }
  eq(c.stats.cutoffResiduals > 0, true, "the recursive branch call of loop was cut");
});

test("B-172 C1 evaluator: Rule 2 — evaluate is no longer reached with a TailCall sentinel; via_if precompiles cleanly (gap pin, C2 flipped it, RR7)", () => {
  // Was a GAP PIN, a consequence of the plan's §2.5 finding 1; C2 flipped it
  // under RR7 (a). The residual `eval_if` bound to `y` holds the residual
  // call of `pick`, a value, so when `bump(y)` unfolds and evaluates that
  // residual again, `evaluate` meets values only and the precompile pass
  // reports no fault for `via_if` (`tests/functions.alg`). Until C2 the
  // residual held the then-branch's sentinel, `evaluate` fell through its
  // switch to `undefined`, and the pass reported the `precompile-type-error`
  // "Cannot read properties of undefined (reading 'meta')".
  const c = compile(
    "pick(q) => q\nbump(v) => v + 1\n" +
    "via_if(q) =>\n  y = if q > 1 then pick(q) else 0\n  bump(y)\n" +
    "print(via_if(5))\nt = via_if(zzz)\n");
  eq(JSON.stringify(c.printed), JSON.stringify(["6"]), "the run itself is unaffected");
  const faults = c.report.notifications.filter(n => n.kind === "precompile-type-error");
  eq(JSON.stringify(faults.map(n => `${n.binding}: ${n.message}`)), "[]", "no host fault reported for via_if");
  // At run time with an unresolved argument (C1 saw a host TypeError out of
  // `evalSource` here): a residual, holding no sentinel.
  eq(holdsSentinel(valueOf(c, "t")), false, "via_if(zzz)'s residual holds no sentinel");
  const t = compile("h(m) => print(m)\ninbranch(b: Int): Int => if b == 0 then h(b) else 0\nr = inbranch(zzz)\n");
  eq(holdsSentinel(valueOf(t, "r")), false, "inbranch(zzz)'s residual holds no sentinel");
});

test("B-172 C1 evaluator: Rule 2 — eval_if at run time with an unresolved condition runs neither branch's effects (gap pin, C2 flipped it, RR3)", () => {
  // Was a GAP PIN, the plan's §2.5 finding 2; C2 flipped it under RR3 (a):
  // speculative evaluation runs in a compile-mode scope at run time too, so
  // each `print` defers to a residual carrying `io` and nothing is printed,
  // in Standard mode and in Allegretto alone. Until C2 both branches
  // printed. `zzz` is bound nowhere, so it evaluates to itself, an
  // unresolved Symbol, and `branches(zzz)` substitutes that Symbol for `c`.
  // An unresolved Param behaves the same: below, the body of `branches`,
  // with its own Param `c` unresolved, is evaluated at run time.
  const src = `r = if zzz then print("then-ran") else print("else-ran")\n` +
    `branches(c) => if c then print("then-ran") else print("else-ran")\ns = branches(zzz)\n`;
  for (const typed of [true, false]) {
    const c = compile(src, typed);
    const mode = typed ? "Standard" : "Allegretto";
    eq(JSON.stringify(c.printed), "[]", `${mode}: nothing printed`);
    for (const name of ["r", "s"]) {
      const v = valueOf(c, name);
      eq(shape(v), "Expression(primitive eval_if; 3 args)", `${mode}: ${name} is the residual eval_if`);
      eq(effectsText(v), "io", `${mode}: ${name} carries io`);
      if (v.kind !== ValueKind.Expression) continue;
      eq(shape(thunkBody(v.args[1])), "Expression(primitive print; 1 args)", `${mode}: ${name}'s then-branch, a deferred print`);
      eq(shape(thunkBody(v.args[2])), "Expression(primitive print; 1 args)", `${mode}: ${name}'s else-branch, a deferred print`);
    }
    const fn = valueOf(c, "branches");
    if (fn.kind !== ValueKind.ComposedFunction) throw new Error(`branches is not a function: ${fn.kind}`);
    const origLog = console.log;
    const printedNow: string[] = [];
    console.log = (...a: any[]) => { printedNow.push(a.join(" ")); };
    let p: Value;
    try { p = evaluate(fn.body, c.ctx, 0); } finally { console.log = origLog; }
    eq(scopeCompileMode(c.ctx), false, `${mode}: the program's scope is not in compile mode`);
    eq(JSON.stringify(printedNow), "[]", `${mode}: an unresolved Param condition prints nothing`);
    eq(effectsText(p), "io", `${mode}: the Param condition's residual carries io`);
    if (p.kind === ValueKind.Expression) {
      eq(p.args[0].kind, ValueKind.Param, `${mode}: the condition is branches' unresolved Param`);
    }
  }
});

test("B-172 C1 evaluator: at run time &&, || and when with an unresolved input print nothing", () => {
  // The other side of finding 2: these run no speculative evaluation today.
  // Under RR3 (a) their speculation will defer every effect, so this stays.
  const src = `s = zzz && print("and-ran")\nt = zzz || print("or-ran")\n` +
    `w = when zzz is 1 then print("when-ran") is _ then print("when-else-ran")\n`;
  for (const typed of [true, false]) {
    const c = compile(src, typed);
    eq(c.printed.length, 0, `${typed ? "Standard" : "Allegretto"}: nothing printed`);
  }
});
