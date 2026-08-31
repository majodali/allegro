// =============================================================================
// Async futures: the forward-chaining runtime surface (B-028 F1-F4).
//
// Extracted from the single-file suite (suite split, lane B). Registrations
// run at import time; src/test/index.ts imports this module in suite order.
// =============================================================================

import { asyncTest, eq } from "./harness.js";
import { typeExt } from "./fixtures.js";
import { getTypeName } from "../types-std.js";
import { evalSource as runtimeEval, Extension, applyPhase } from "../runtime.js";
import { createFutureManager } from "../futures.js";
import { metaReadRaw } from "../slots.js";
import { formatValue, extractGrammarFragment } from "../primitives.js";
import { primNames, typeNames } from "./alg-files.js";
import { Value, ValueKind, BitsValue, StructureValue, makeInt, bitsToString, isResolved } from "../types.js";
import { futureElementType, getType, typeContextName as tsTypeContextName, futureOf, IntType } from "../types-std.js";
import { ModuleLoader } from "../modules.js";
import { livenessDispositions } from "../effects.js";
import * as fs from "fs";
import * as path from "path";

// == Async Futures ==

export async function runAsyncTests(): Promise<void> {
  await asyncTest("async: delay creates pending future", async () => {
    const fm = createFutureManager();
    const { registry } = runtimeEval("x = delay(10)\n", undefined, [typeExt], undefined, true, fm);
    eq(fm.hasPending(), true, "should have pending future");
    const xb = registry.bindings.get("x");
    eq(xb?.isComplete, false, "x should be incomplete");
    await fm.waitForAll();
    eq(fm.hasPending(), false, "should have no pending futures");
  });

  await asyncTest("async: delay resolves and propagates to dependents", async () => {
    const fm = createFutureManager();
    const { registry } = runtimeEval("x = delay(10)\ny = x\n", undefined, [typeExt], undefined, true, fm);
    eq(registry.bindings.get("y")?.isComplete, false, "y should start incomplete");
    await fm.waitForAll();
    eq(registry.bindings.get("x")?.isComplete, true, "x should be complete");
    eq(registry.bindings.get("y")?.isComplete, true, "y should be complete after propagation");
  });

  await asyncTest("async: print defers until value resolves", async () => {
    const output: string[] = [];
    const fm = createFutureManager();
    fm.onOutput = (text: string) => output.push(text);
    runtimeEval("print(delay(10))\n", undefined, [typeExt], undefined, true, fm);
    eq(output.length, 0, "no output while pending");
    await fm.waitForAll();
    eq(output.length, 1, "print fired after resolve");
    eq(output[0], "0", "delay resolves to 0");
  });

  await asyncTest("async: multiple independent futures", async () => {
    const fm = createFutureManager();
    const { registry } = runtimeEval("a = delay(10)\nb = delay(20)\n", undefined, [typeExt], undefined, true, fm);
    eq(fm.pendingCount, 2, "two pending futures");
    await fm.waitForAll();
    eq(registry.bindings.get("a")?.isComplete, true);
    eq(registry.bindings.get("b")?.isComplete, true);
  });

  await asyncTest("async: chain of dependent futures", async () => {
    const fm = createFutureManager();
    const output: string[] = [];
    fm.onOutput = (text: string) => output.push(text);
    runtimeEval("x = delay(10)\ny = x + 1\nprint(y)\n", undefined, [typeExt], undefined, true, fm);
    eq(output.length, 0, "no output while pending");
    await fm.waitForAll();
    // delay resolves to 0 (typed Int), so y = 0 + 1 = 1
    eq(output.length, 1, "print fired");
    eq(output[0], "1", "y should be 1");
  });

  // == B-028 F1: substrate hardening ==

  await asyncTest("B-028 F1: a future resolving in a LATER pass still completes its dependents (cross-pass fix)", async () => {
    const fm = createFutureManager();
    // Pass 1 mints the future; pass 2 (REPL-style: base = pass 1's ctx,
    // SAME manager) re-points fm.registry/fm.evalCtx. Pre-F1 the
    // resolving closure read the manager's pointers at resolution time,
    // so the phase applied into pass 2's registry — which never tracked
    // the cell — and pass 1's dependent chain silently never fired.
    const r1 = runtimeEval("x = delay(10)\ny = x + 1\n", undefined, [typeExt], undefined, true, fm);
    const r2 = runtimeEval("z = 5\n", r1.evalCtx, [typeExt], undefined, true, fm);
    eq(r2.evalCtx !== r1.evalCtx, true, "second pass has its own ctx (re-pointed manager)");
    await fm.waitForAll();
    const y = r1.registry.bindings.get("y");
    eq(y?.isComplete, true, "pass-1 dependent completed after the cross-pass resolution");
    eq(Number((y!.value! as BitsValue).data), 1, "y = 0 + 1 through the minting pass's registry");
  });

  await asyncTest("B-028 F1: a rejected promise settles as an ERROR VALUE — never a throw (D11)", async () => {
    const fm = createFutureManager();
    const r = runtimeEval("x = 1\n", undefined, [typeExt], undefined, true, fm);
    void r;
    const sym = fm.createFuture(Promise.reject(new Error("boom")));
    await fm.waitForAll();
    const cell = fm.registry.bindings.get(sym.name);
    eq(cell?.isComplete, true, "rejection completed the cell");
    const err = metaReadRaw(cell!.value!, "error");
    eq(err !== undefined, true, "cell holds an error-channel value");
    eq(bitsToString(err! as BitsValue).includes("boom"), true, "rejection reason preserved");
  });

  await asyncTest("B-028 F1 (D33): future cells are WRITE-ONCE — a second phase resolution throws", async () => {
    const fm = createFutureManager();
    const { registry, evalCtx } = runtimeEval("import cfg\nw = cfg\n", undefined, [typeExt], undefined, true, fm);
    applyPhase(registry, evalCtx, new Map([["cfg", makeInt(7)]]));
    let threw = "";
    try { applyPhase(registry, evalCtx, new Map([["cfg", makeInt(8)]])); }
    catch (e: any) { threw = e.message; }
    eq(threw.includes("write-once"), true, `second resolution refused: ${threw}`);
    eq(Number((evalCtx.bindings.get("cfg")!.value! as BitsValue).data), 7, "first resolution stands");
  });

  await asyncTest("B-028 F1 (CE-R8/D32): a FAILING invariant over a pending field errors — never a mis-tagged value", async () => {
    const fm = createFutureManager();
    const r = runtimeEval(
      "Range = Type.define({lo: Int, hi: Int}) & _.lo <= _.hi\n" +
      "r = Range(1, delay(10))\n", undefined, [typeExt], undefined, true, fm);
    const rb = r.registry.bindings.get("r");
    eq(rb?.isComplete, false, "construction is HELD while the inspected field is pending (D32 guard)");
    await fm.waitForAll();
    eq(rb?.isComplete, true, "construction completed after the field resolved");
    const err = metaReadRaw(rb!.value!, "error");
    eq(err !== undefined, true, "invariant checked BEFORE the value exists — 1 <= 0 fails as an error value");
  });

  await asyncTest("B-028 F1 (CE-R8/D32): a PASSING invariant over a pending field constructs with resolved slots", async () => {
    const fm = createFutureManager();
    const r = runtimeEval(
      "Range = Type.define({lo: Int, hi: Int}) & _.lo <= _.hi\n" +
      "g = Range(0 - 5, delay(10))\n", undefined, [typeExt], undefined, true, fm);
    await fm.waitForAll();
    const gb = r.registry.bindings.get("g");
    eq(gb?.isComplete, true, "guarded construction completed");
    eq(formatValue(gb!.value!).includes("hi: 0"), true, "the resolved slot value (not a stale symbol) is in the instance");
    // Scalar refinements guard the same way.
    const fm2 = createFutureManager();
    const r2 = runtimeEval("NonNeg = Int & _ >= 0\nv = NonNeg(delay(10))\n", undefined, [typeExt], undefined, true, fm2);
    await fm2.waitForAll();
    const vb = r2.registry.bindings.get("v");
    eq(vb?.isComplete, true, "scalar refined construction completed");
    eq(Number((vb!.value! as BitsValue).data), 0, "delay resolved to 0, predicate 0 >= 0 held");
  });

  // == B-028 F2: typed futures + detection ==

  await asyncTest("B-028 F2 (CE-R5): async results are Future[T]-typed while pending; the annotation vanishes on resolution", async () => {
    const fm = createFutureManager();
    const r = runtimeEval("x = delay(10)\n", undefined, [typeExt], undefined, true, fm);
    const pending = r.registry.bindings.get("x")!.value!;
    eq(getTypeName(pending), "Future", "pending value carries Future");
    const elT = futureElementType(getType(pending)! as StructureValue);
    eq(elT !== null && tsTypeContextName(elT!) === "Int", true, "element type is Int");
    await fm.waitForAll();
    eq(getTypeName(r.registry.bindings.get("x")!.value!), "Int", "resolved value's own type shadows Future");
  });

  await asyncTest("B-028 F2 (D33): Future[Future[T]] flattens; parameterizations are identity-stable", async () => {
    const fi = futureOf(IntType);
    eq(futureOf(fi) === fi, true, "Future[Future[Int]] IS Future[Int]");
    eq(futureOf(IntType) === fi, true, "memoized — same parameterization, same object");
  });

  await asyncTest("B-028 F2 (CE-R5/D11): the call boundary checks landed knowledge, defers the rest", async () => {
    // Future[Int] into an Int param: defers, flows as a residual, completes.
    const fm = createFutureManager();
    const output: string[] = [];
    fm.onOutput = (t: string) => output.push(t);
    runtimeEval("f(n: Int): Int => n * 2\nprint(f(delay(10)))\n", undefined, [typeExt], undefined, true, fm);
    await fm.waitForAll();
    eq(output[0], "0", "matching element type deferred and resolved through the body");
    // Future[Int] into a String param: a REAL type error, now.
    let msg = "";
    try {
      runtimeEval("g(s: String): String => s\nx = g(delay(10))\n", undefined, [typeExt], undefined, true, createFutureManager());
    } catch (e: any) { msg = e.message; }
    eq(msg.includes("expected String, got Future[Int]"), true, `element mismatch is static: ${msg}`);
    // Annotation path: a refinement annotation over a pending value
    // residual-defers and re-fires with the real value (predicate runs then).
    const fm3 = createFutureManager();
    const r3 = runtimeEval("NonNeg = Int & _ >= 0\nw: NonNeg = delay(5)\n", undefined, [typeExt], undefined, true, fm3);
    await fm3.waitForAll();
    eq(Number((r3.registry.bindings.get("w")!.value! as BitsValue).data), 0, "type_check re-fired on resolution");
  });

  await asyncTest("B-028 F2 (CE-R4): is_resolved answers the scheduling question and pays for it (`sched`)", async () => {
    const fm = createFutureManager();
    const output: string[] = [];
    fm.onOutput = (t: string) => output.push(t);
    runtimeEval("x = delay(10)\nprint(is_resolved(x))\nprint(is_resolved(5))\n", undefined, [typeExt], undefined, true, fm);
    eq(output[0], "false", "pending future answers false — a snapshot, not a wait");
    eq(output[1], "true", "resolved value answers true");
    await fm.waitForAll();
    // The effect contract, through the real `use effects` body form
    // (the nested-use loader precedent): declared `pure` + is_resolved
    // HALTS naming the label; declared `sched` passes.
    const libDir = path.resolve("lib");
    const mkLoader = (body: string, id: string) => new ModuleLoader({
      modules: [{ id }],
      resolve: (mid) => {
        if (mid === id) return `/mock/${id}.alg`;
        const p = path.join(libDir, `${mid}.alg`);
        return fs.existsSync(p) ? p : null;
      },
      readFile: async (p) => p === `/mock/${id}.alg` ? body : fs.readFileSync(p, "utf-8"),
      extensions: [typeExt],
    });
    let msg = "";
    try {
      await mkLoader("use effects\ncheck(x) =>\n  effects pure\n  is_resolved(x)\nexport probe = check(5)\n", "schedbad").loadAll();
    } catch (e: any) { msg = e.message; }
    eq(msg.includes("undeclared: sched"), true, `pure contract refuses sched: ${msg}`);
    const exts = await mkLoader("use effects\ncheck(x) =>\n  effects sched\n  is_resolved(x)\nexport probe = check(5)\n", "schedok").loadAll();
    const probe = exts.find((e) => e.name === "schedok")!.bindings["probe"];
    eq(formatValue(probe), "true", "declared sched passes the contract");
  });

  await asyncTest("B-028 F2 (CE-R6): modules evaluate with the session's FutureManager", async () => {
    const fm = createFutureManager();
    const loader = new ModuleLoader({
      modules: [{ id: "asyncmod" }],
      resolve: (id) => id === "asyncmod" ? "/mock/asyncmod.alg" : null,
      readFile: async () => "probe = delay(1)\nexport answer = 42\n",
      extensions: [typeExt],
      futureManager: fm,
    });
    const exts = await loader.loadAll();
    eq(exts.length, 1, "module with top-level async loads");
    eq(fm.hasPending(), true, "the module's future is tracked by the session manager");
    await fm.waitForAll();
    // Without a manager, the pre-F2 behavior stands: host capability absent.
    let msg = "";
    try {
      await new ModuleLoader({
        modules: [{ id: "asyncmod2" }],
        resolve: (id) => id === "asyncmod2" ? "/mock/asyncmod2.alg" : null,
        readFile: async () => "probe = delay(1)\n",
        extensions: [typeExt],
      }).loadAll();
    } catch (e: any) { msg = e.message; }
    eq(msg.includes("requires async runtime"), true, "no manager = explicit host-capability error (CE-R6)");
  });

  await asyncTest("B-028 F2 (CE-R4/D34): the async sources carry declared liveness dispositions", async () => {
    const dispositions = livenessDispositions();
    const delayD = dispositions.find((d) => d.source === "delay");
    const fetchD = dispositions.find((d) => d.source === "fetch");
    eq(delayD?.tier, "live", "delay resolves by construction (a timer fires)");
    eq(fetchD?.tier, "admitted", "fetch rests on an external assumption");
    eq((fetchD?.axiom ?? "").includes("responds"), true, "the admitted axiom is named, ledger-ready for F3");
  });

  // == B-028 F3: the div flip ==

  const loadLibExts = async (names: string[]): Promise<Extension[]> => {
    const libDir = path.resolve("lib");
    const loader = new ModuleLoader({
      modules: names.map((id) => ({ id })),
      resolve: (id) => {
        const p = path.join(libDir, `${id}.alg`);
        return fs.existsSync(p) ? p : null;
      },
      readFile: async (p) => fs.readFileSync(p, "utf-8"),
      extensions: [typeExt],
    });
    return loader.loadAll();
  };
  const totalityExts = await loadLibExts(["totality"]);
  const effectsExts = await loadLibExts(["effects"]);

  await asyncTest("B-028 F3 (CE-R1/CE-R2): the termination analysis assigns D34 tiers and infers div", async () => {
    const r = runtimeEval(
      "NonNeg = Int & _ >= 0\n" +
      "count(n: NonNeg): Int => if n == 0 then 0 else count(n - 1)\n" +
      "loop(n: Int): Int => loop(n + 1)\n" +
      "plain(x: Int): Int => x + 1\n", undefined, [typeExt], undefined, true, undefined, true);
    const obl = r.compilationReport!.divObligations!;
    const by = (name: string) => obl.find((o) => o.binding === name);
    eq(by("count")?.tier, "auto", "provable recursion is auto-discharged");
    eq(by("plain")?.tier, "auto", "non-recursive is total by construction");
    eq(by("loop")?.tier, "undischarged", "unproven recursion is undischarged");
    // No declaration = no halt; div is carried, inspectable, info-only.
    const notes = r.compilationReport!.notifications.filter((n) => n.kind === "totality-nontermination");
    eq(notes.some((n) => n.binding === "loop"), true, "the Stage-2 finding still fires (info)");
  });

  await asyncTest("B-028 F3 (CE-R1): a declaration is a contract — `effects pure` on a diverging function halts", async () => {
    let msg = "";
    try {
      runtimeEval(
        "looper(n: Int): Int =>\n  effects pure\n  looper(n + 1)\n",
        undefined, [typeExt, ...effectsExts], undefined, true);
    } catch (e: any) { msg = e.message; }
    eq(msg.includes("undeclared: div"), true, `div rides the effect calculus: ${msg}`);
  });

  await asyncTest("B-028 F3 (CE-R1): div propagates up the call graph; the needs-annotation notice finally fires", async () => {
    const r = runtimeEval(
      "spin(n: Int): Int =>\n  partial\n  spin(n)\n" +
      "wrapper(x: Int): Int => spin(x) + 1\n",
      undefined, [typeExt, ...totalityExts], undefined, true, undefined, true);
    const notice = r.compilationReport!.notifications.find(
      (n) => n.kind === "totality-needs-annotation" && n.binding === "wrapper");
    eq(notice !== undefined, true, "wrapper inherits div through the call");
    eq((notice?.message ?? "").includes("spin"), true, "the notice names the diverging callee");
    // And the contract halts on the same inherited div:
    let msg = "";
    try {
      runtimeEval(
        "spin(n: Int): Int =>\n  partial\n  spin(n)\n" +
        "wrapper(x: Int): Int =>\n  effects pure\n  spin(x) + 1\n",
        undefined, [typeExt, ...totalityExts, ...effectsExts], undefined, true);
    } catch (e: any) { msg = e.message; }
    eq(msg.includes("undeclared: div"), true, `inherited div meets the declared contract: ${msg}`);
  });

  await asyncTest("B-028 F3 (CE-R3): `total` is the strict opt-in; `assume terminates` is the admitted axiom", async () => {
    let msg = "";
    try {
      runtimeEval(
        "loop(n: Int): Int =>\n  total\n  loop(n + 1)\n",
        undefined, [typeExt, ...totalityExts], undefined, true);
    } catch (e: any) { msg = e.message; }
    eq(msg.includes("declared `total` but div is undischarged"), true, `total halts: ${msg}`);
    const ok = runtimeEval(
      "loop(n: Int): Int =>\n  assume terminates\n  loop(n - 1)\n",
      undefined, [typeExt, ...totalityExts], undefined, true, undefined, true);
    const o = ok.compilationReport!.divObligations!.find((x) => x.binding === "loop");
    eq(o?.tier, "admitted", "assume terminates = the D34 admitted tier");
    eq((o?.detail ?? "").includes("liveness axiom"), true, "recorded as a declared axiom");
  });

  await asyncTest("B-028 F3 (CE-R2): `decreases` splits verified (witnessed) from trusted (admitted)", async () => {
    const r = runtimeEval(
      "down(n: Int): Int =>\n  decreases n\n  if n == 0 then 0 else down(n - 1)\n" +
      "trusty(n: Int): Int =>\n  decreases n * 2\n  if n == 0 then 0 else trusty(n - 1)\n",
      undefined, [typeExt, ...totalityExts], undefined, true, undefined, true);
    const obl = r.compilationReport!.divObligations!;
    eq(obl.find((o) => o.binding === "down")?.tier, "witnessed", "kernel-checked metric = witnessed");
    const t = obl.find((o) => o.binding === "trusty");
    eq(t?.tier, "admitted", "unrecognised metric shape = RECORDED admission (was silent trust)");
    eq((t?.detail ?? "").includes("unverified"), true, "the admission says why");
  });

  await asyncTest("B-028 F3 (CE-R7): the E-R5 purity gate refuses a possibly-diverging eq", async () => {
    let msg = "";
    try {
      runtimeEval(
        "bad_eq(a: Int, b: Int): Bool => bad_eq(b, a)\n" +
        "T = Type.define({x: Int, eq: bad_eq})\n",
        undefined, [typeExt], undefined, true);
    } catch (e: any) { msg = e.message; }
    eq(msg.includes("div"), true, `the gate names div: ${msg}`);
  });

  // == B-028 F4: D32 guarded projection + release ==

  await asyncTest("B-028 F4 (D32): projections ride the guard — untouched field, touched field, method", async () => {
    const fm = createFutureManager();
    const out: string[] = [];
    fm.onOutput = (t: string) => out.push(t);
    runtimeEval(
      "Acct = Type.define({id: Int, bal: Int, tag: (self) => self.id * 2}) & _.bal >= 0\n" +
      "a = Acct(7, delay(10))\n" +
      "print(a.id)\nprint(a.bal)\nprint(a.tag())\n",
      undefined, [typeExt], undefined, true, fm);
    eq(out.length, 0, "all three projections held while construction is guarded");
    await fm.waitForAll();
    eq(out.join("|"), "7|0|14", "untouched field, touched field, and method all resolved through the guard");
  });

  await asyncTest("B-028 F4 (D32): the failure arm — projections complete as the construction ERROR, never a cascade throw", async () => {
    const fm = createFutureManager();
    const r = runtimeEval(
      "Acct = Type.define({id: Int, bal: Int}) & _.bal > 0\n" +
      "a = Acct(7, delay(10))\n" +
      "x = a.id\n",
      undefined, [typeExt], undefined, true, fm);
    await fm.waitForAll(); // delay resolves to 0; 0 > 0 fails the invariant
    const xb = r.registry.bindings.get("x");
    eq(xb?.isComplete, true, "the dependent completed (the pre-F4 cascade THREW here and killed the host)");
    const err = metaReadRaw(xb!.value!, "error");
    eq(err !== undefined, true, "the projection completed as the construction error (viral discipline)");
    eq(bitsToString(err! as BitsValue).includes("refinement check failed"), true,
      "the error is the CONSTRUCTION's, propagated — not a fresh dispatch error");
  });

  await asyncTest("B-028 F4 (D33): stages of arrival are CONFLUENT — folded and both arrival orders agree", async () => {
    const run = async (src: string): Promise<{ printed: string[]; instance: string }> => {
      const fm = createFutureManager();
      const printed: string[] = [];
      fm.onOutput = (t: string) => printed.push(t);
      const r = runtimeEval(src, undefined, [typeExt], undefined, true, fm);
      await fm.waitForAll();
      return { printed, instance: formatValue(r.registry.bindings.get("a")!.value!) };
    };
    const prog = (ctorArgs: string) =>
      "Acct = Type.define({id: Int, bal: Int}) & _.bal >= 0\n" +
      `a = Acct(${ctorArgs})\n` +
      "x = a.id + 1\nprint(a)\nprint(x)\n";
    const folded = await run(prog("0, 0"));
    // The invariant reads only `bal`; delay(N) resolves to 0 after N ms,
    // so the two orders differ in whether the INSPECTED field lands
    // first (construction completes with `id` still pending) or last.
    const invariantFieldFirst = await run(prog("delay(30), delay(10)"));
    const invariantFieldLast = await run(prog("delay(10), delay(30)"));
    eq(folded.printed.join("|"), "Acct(id: 0, bal: 0)|1", "the folded reference");
    eq(invariantFieldFirst.printed.join("|"), folded.printed.join("|"),
      "io is arrival-order independent (print deferred past the pending untouched slot)");
    eq(invariantFieldLast.printed.join("|"), folded.printed.join("|"), "…in both orders");
    eq(invariantFieldFirst.instance, folded.instance,
      "the stored instance converged too (completion replacement — no stale symbol survives)");
    eq(invariantFieldLast.instance, folded.instance, "…in both orders");
  });

  await asyncTest("B-028 F4 (D32/CE-R7): a value-inspecting invariant predicate must be div-free", async () => {
    // Undischarged-divergent callee inside the predicate: refused at
    // refinement creation (the guard could hang at every construction).
    let msg = "";
    try {
      runtimeEval(
        "spin(n: Int): Int => spin(n)\n" +
        "T = Type.define({x: Int}) & spin(_.x) == 0\n",
        undefined, [typeExt], undefined, true);
    } catch (e: any) { msg = e.message; }
    eq(msg.includes("invariant predicate must be total"), true, `the gate refuses: ${msg}`);
    eq(msg.includes("spin"), true, "…and names the diverging callee");
    // Recognised scalar domains discharge WITHOUT running the predicate
    // (the opaque-domain discriminator), and total predicates pass.
    const ok = runtimeEval(
      "NonNeg = Int & _ >= 0\n" +
      "Range = Type.define({lo: Int, hi: Int}) & _.lo <= _.hi\n" +
      "v = NonNeg(5)\nr = Range(1, 2)\n",
      undefined, [typeExt], undefined, true);
    eq(formatValue(ok.registry.bindings.get("v")!.value!), "5", "recognised domain untouched by the gate");
    // The D34 spectrum discharges the gate: `assume terminates` lifts it.
    const lifted = runtimeEval(
      "spin(n: Int): Int =>\n  assume terminates\n  spin(n)\n" +
      "T = Type.define({x: Int}) & spin(_.x) == 0\n",
      undefined, [typeExt, ...totalityExts], undefined, true);
    eq(lifted.registry.bindings.get("T") !== undefined, true, "admitted tier lifts the invariant gate");
  });
}

