// =============================================================================
// E1-E4: the equality protocol, declared coercions, lawful interfaces, the admitted tier.
//
// Extracted from the single-file suite (suite split, lane B). Registrations
// run at import time; src/test/index.ts imports this module in suite order.
// =============================================================================

import { test, eq, throws } from "./harness.js";
import { evalStd, evalNum, typeExt } from "./fixtures.js";
import { evalSource as runtimeEval } from "../runtime.js";
import { sourceOf as _sourceOf, withSource as _withSource, metaOf as _metaViewD47 } from "../slots.js";
import { renderExprSource } from "../primitives.js";
import { BitsValue, bitsToString, Value, makePrimitive } from "../types.js";
import { getTypeName, protocolEqualsBool, KERNEL_EQUALS_CERTIFICATE, coercionObligationRecords, lawObligationRecords, typeMemberDescriptor, EquatableType, isLawDescriptor, isFieldDescriptor } from "../types-std.js";
import { metaReadRaw } from "../slots.js";
import { buildVerdict, extractObligations, formatVerdict } from "../pcp.js";
import { renderModuleSummary, summarizeModule } from "../introspect.js";
import { effectsOf } from "../effects.js";

// == E1 equality protocol battery (B-027, structures.md §7, E-R1/D37) ==

function eqNum(src: string): number {
  const result = evalStd(src);
  return Number((result! as BitsValue).data);
}

test("E1 equality: array structural equality is true, Bool-typed", () => {
  const result = evalStd("[1,2] == [1,2]");
  eq(Number((result! as BitsValue).data), 1);
  eq(getTypeName(result!), "Bool");
});

test("E1 equality: != is the derived negation", () => {
  eq(eqNum("[1,2] != [1,2]"), 0);
  eq(eqNum("[1,2] != [1,3]"), 1);
});

test("E1 equality: array element and length mismatches", () => {
  eq(eqNum("[1,2] == [1,3]"), 0);
  eq(eqNum("[1,2] == [1,2,3]"), 0);
  eq(eqNum("[1.5, 2.5] == [1.5, 2.5]"), 1);
});

test("E1 equality: nested structures recurse through the protocol", () => {
  eq(eqNum("[[1,2],[3]] == [[1,2],[3]]"), 1);
  eq(eqNum("[[1,2],[3]] == [[1,2],[4]]"), 0);
  eq(eqNum("{a: {b: [1,2]}} == {a: {b: [1,2]}}"), 1);
  eq(eqNum("{a: {b: [1,2]}} == {a: {b: [1,3]}}"), 0);
});

test("E1 equality: object field-wise equality", () => {
  eq(eqNum("{x: 1} == {x: 1}"), 1);
  eq(eqNum("{x: 1} == {x: 2}"), 0);
  eq(eqNum("{x: 1} == {y: 1}"), 0);
  eq(eqNum("{x: 1, y: 2} == {x: 1}"), 0);
});

test("E1 equality: record instances compare structurally", () => {
  const mk = (tail: string) => eqNum(`P = Type.define({x: Int, y: Int})\n${tail}`);
  eq(mk("P(1,2) == P(1,2)"), 1);
  eq(mk("P(1,2) == P(1,3)"), 0);
  eq(mk("P(1,2) != P(1,2)"), 0);
});

test("E1 equality: custom `eq` in the define spec overrides the kernel", () => {
  // eq compares x only — proves the spec-supplied equals dispatches.
  eq(eqNum(`Q = Type.define({x: Int, y: Int, eq: (self, other) => self.x == other.x})
Q(1, 2) == Q(1, 9)`), 1);
  eq(eqNum(`Q = Type.define({x: Int, y: Int, eq: (self, other) => self.x == other.x})
Q(1, 2) == Q(3, 2)`), 0);
});

test("E1 equality: refinement peel re-pinned (D37 — knowledge never separates)", () => {
  eq(eqNum("PositiveInt = Int & _ > 0\nPositiveInt(5) == 5"), 1);
});

test("E1 equality: preserve-lifted refinements peel too (equalityShape)", () => {
  const pre = `PI = Refinement.define({refines: Int, where: p => p > 0, preserve: "all"})\n`;
  eq(eqNum(pre + "PI(5) == 5"), 1);
  eq(eqNum(pre + "x = PI(5)\n(x + 3) == 8"), 1);
});

test("E1 equality: distinct types are unequal to their parent (§7 step 3)", () => {
  const pre = `UserId = Int.distinct("UserId")\n`;
  eq(eqNum(pre + "UserId(42) == 42"), 0);
  eq(eqNum(pre + "UserId(42) != 42"), 1);
  eq(eqNum(pre + "UserId(42) == UserId(42)"), 1);
});

test("E1 equality: cross-shape scalars with no coercion are simply false", () => {
  eq(eqNum('"a" == 1'), 0);
  eq(eqNum("true == 1"), 0);     // §6 delta 7: Bool and Int are distinct shapes
  eq(eqNum("true == true"), 1);  // and NO Bool→Int coercion is declared (recommended)
});

test("E1 equality: none keeps identity semantics", () => {
  eq(eqNum("none == none"), 1);
  eq(eqNum("none == 5"), 0);
});

test("E1 equality: errors stay viral through ==", () => {
  const result = evalStd('(error "boom") == 1');
  eq(metaReadRaw(result!, "error") !== undefined, true);
});

test("E1 equality: type values compare by identity", () => {
  eq(eqNum("Int == Int"), 1);
  eq(eqNum("Int == Float"), 0);
  // Memoized generic concretes: same application → same identity.
  eq(eqNum("t1 = type of [1,2]\nt2 = type of [3,4]\nt1 == t2"), 1);
  eq(eqNum('t1 = type of [1,2]\nt2 = type of ["a"]\nt1 == t2'), 0);
});

test("E1 equality: typed functions compare by identity", () => {
  eq(eqNum("f(x: Int): Int => x\nf == f"), 1);
  eq(eqNum("f(x: Int): Int => x\ng(x: Int): Int => x\nf == g"), 0);
});

test("E1 equality: print of a structural comparison no longer crashes", () => {
  // Regression: the old reference-eq stub returned an untyped int the
  // dispatch fallback mistyped as Array/Object, crashing formatValue.
  const result = evalStd("v = [1,2] == [1,2]\nv.toString()");
  eq(bitsToString(result! as BitsValue), "true");
});

test("E1 equality: no-throw sweep — == is total over every kind pair", () => {
  const bindings = `P = Type.define({x: Int})
UserId = Int.distinct("UserId")
tf(x: Int): Int => x
v0 = 1
v1 = 1.5
v2 = "a"
v3 = true
v4 = [1]
v5 = {x: 1}
v6 = P(1)
v7 = tf
v8 = none
v9 = Int
v10 = UserId(1)
`;
  const lines: string[] = [];
  for (let i = 0; i <= 10; i++) {
    for (let j = 0; j <= 10; j++) {
      lines.push(`r${i}_${j} = v${i} == v${j}`);
    }
  }
  // Every pair must produce a value (typed Bool), never a host throw.
  const result = evalStd(bindings + lines.join("\n") + "\nv0 == v0");
  eq(Number((result! as BitsValue).data), 1);
});

test("E1 equality: kernel lawfulness empirical shadow (refl/sym/trans)", () => {
  // The parametric certificate's empirical shadow (plan §5): property-check
  // the kernel equals over a fixed set of generated structures.
  const srcs = [
    "1", "2", "1.5", '"a"', '"b"', "true", "false", "none",
    "[1,2]", "[1,2]", "[2,1]", "[[1],[2]]",
    "{x: 1}", "{x: 1}", "{x: 2}", "{a: {b: [1,2]}}", "{a: {b: [1,2]}}",
  ];
  const vals = srcs.map(s => evalStd(s)!);
  const eqv = (a: Value, b: Value) => protocolEqualsBool(a, b);
  for (const a of vals) eq(eqv(a, a), true);                       // refl
  for (const a of vals) for (const b of vals) {
    eq(eqv(a, b), eqv(b, a));                                      // sym
  }
  for (const a of vals) for (const b of vals) for (const c of vals) {
    if (eqv(a, b) && eqv(b, c)) eq(eqv(a, c), true);               // trans
  }
});

test("E1 equality: E3 certificate anchor is exported", () => {
  eq(typeof KERNEL_EQUALS_CERTIFICATE, "string");
  eq(KERNEL_EQUALS_CERTIFICATE.length > 0, true);
});

// == E2 declared coercions + least common type (B-027, §7 step 2, E-R2) ==

test("E2 coercion: 1 == 1.0 flips true via the kernel Int→Float edge (§6 delta 4)", () => {
  eq(eqNum("1 == 1.0"), 1);
  eq(eqNum("1.0 == 1"), 1);      // commutative by construction (same LCT both orders)
  eq(eqNum("2 == 1.0"), 0);
  eq(eqNum("1 != 1.0"), 0);      // != stays the derived negation through coercion
  eq(eqNum("1 != 2.0"), 1);
});

test("E2 coercion: same-shape containers coerce their meta", () => {
  // Kernel structural equals recurses through the PROTOCOL, which now
  // includes the coercion step — mixed scalar fields meet at Float.
  eq(eqNum("{x: 1} == {x: 1.0}"), 1);
  eq(eqNum("{x: 2} == {x: 1.0}"), 0);
});

test("E2 coercion: differently-parameterized generic shapes do NOT coerce", () => {
  // Array[Int] and Array[Float] are distinct memoized concretes with no
  // declared edge — the container shapes themselves must meet, element
  // coercion only runs under a common container shape.
  eq(eqNum("[1, 2] == [1.0, 2.0]"), 0);
});

test("E2 coercion: distinct types opt back in via Coercion.declare (§6 delta 3)", () => {
  const pre = `UserId = Int.distinct("UserId")\nCoercion.declare(UserId, Int, (u) => Int(u))\n`;
  eq(eqNum(pre + "UserId(42) == 42"), 1);
  eq(eqNum(pre + "42 == UserId(42)"), 1);    // symmetric
  eq(eqNum(pre + "UserId(42) == 43"), 0);
  eq(eqNum(pre + "UserId(42) != 42"), 0);
  eq(eqNum(pre + "UserId(41) == UserId(41)"), 1); // own-shape equality unchanged
});

test("E2 coercion: coherence triangle — composed path UserId→Int→Float", () => {
  const pre = `UserId = Int.distinct("UserId")\nCoercion.declare(UserId, Int, (u) => Int(u))\n`;
  eq(eqNum(pre + "UserId(42) == 42.0"), 1);
  eq(eqNum(pre + "42.0 == UserId(42)"), 1);
  eq(eqNum(pre + "UserId(42) == 43.0"), 0);
});

test("E2 coercion: no unique least common type is an explicit error", () => {
  // Diamond: A and B each coerce into incomparable M and N — no least.
  const src = `A = Int.distinct("A")
B = Int.distinct("B")
M = Int.distinct("M")
N = Int.distinct("N")
Coercion.declare(A, M, (v) => M(v))
Coercion.declare(A, N, (v) => N(v))
Coercion.declare(B, M, (v) => M(v))
Coercion.declare(B, N, (v) => N(v))
A(1) == B(1)`;
  let msg = "";
  try { evalStd(src); } catch (e: any) { msg = String(e?.message ?? e); }
  eq(msg.includes("ambiguous"), true);
  eq(msg.includes("explicit coercion"), true);
});

test("E2 coercion: user declarations instantiate PENDING obligations; kernel edge is discharged", () => {
  evalStd(`ObDemo = Int.distinct("ObDemo")\nCoercion.declare(ObDemo, Int, (u) => Int(u))\n1`);
  const records = coercionObligationRecords();
  const user = records.filter(r => r.from === "ObDemo" && r.to === "Int");
  eq(user.length, 2);
  eq(user.every(r => r.status === "pending"), true);
  eq(user.map(r => r.obligation).sort().join(","), "coherence,equality-preservation");
  const kernel = records.filter(r => r.from === "Int" && r.to === "Float");
  eq(kernel.length, 2);
  eq(kernel.every(r => r.status === "discharged" && r.tier === "kernel"), true);
});

test("E2 coercion: declare rejects vacuous and malformed declarations", () => {
  // Same equality shape (refinements peel to Int) — a coercion is vacuous.
  let msg1 = "";
  try {
    evalStd("PositiveInt = Int & _ > 0\nCoercion.declare(PositiveInt, Int, (v) => v)");
  } catch (e: any) { msg1 = String(e?.message ?? e); }
  eq(msg1.includes("vacuous"), true);
  // Third argument must be a function.
  let msg2 = "";
  try {
    evalStd(`D2 = Int.distinct("D2")\nCoercion.declare(D2, Int, 42)`);
  } catch (e: any) { msg2 = String(e?.message ?? e); }
  eq(msg2.includes("must be a function"), true);
});

// == E3 lawful interfaces battery (B-027, structures.md §8, E-R3/E-R4/E-R5, D34/D38) ==

test("E3 laws: kernel scalars conform to Equatable with kernel-tier obligations", () => {
  // Retroactive conformance: built-in eq impls answer Equatable's symbols.
  const r1 = evalStd("42 instanceof Equatable");
  eq(Number((r1! as BitsValue).data), 1);
  const r2 = evalStd('"hi" instanceof Equatable');
  eq(Number((r2! as BitsValue).data), 1);
  // refl/sym/trans discharge via the parametric certificate — tier kernel.
  for (const t of ["Int", "Float", "String", "Bool"]) {
    const recs = lawObligationRecords().filter(x => x.type === t);
    eq(recs.length >= 3, true);
    eq(recs.every(x => x.status === "discharged" && x.tier === "kernel"), true);
  }
});

test("E3 laws: Equatable carries Law descriptors (ordinary members)", () => {
  const desc = typeMemberDescriptor(EquatableType, "refl");
  eq(desc !== null, true);
  eq(isLawDescriptor(desc!), true);
  // eq is an ordinary Field declaration alongside the laws.
  const eqDesc = typeMemberDescriptor(EquatableType, "eq");
  eq(isFieldDescriptor(eqDesc!), true);
});

test("E3 laws: record drawing Equatable with kernel equals discharges at tier kernel", () => {
  const r = evalStd("E3Pt = Type.define({x: Int, y: Int}, Equatable)\nE3Pt(1, 2) instanceof Equatable");
  eq(Number((r! as BitsValue).data), 1);
  const recs = lawObligationRecords().filter(x => x.type === "E3Pt");
  eq(recs.map(x => x.law).sort().join(","), "refl,sym,trans");
  eq(recs.every(x => x.status === "discharged" && x.tier === "kernel"), true);
});

test("E3 laws: a custom eq bears fresh obligations (pending, not kernel)", () => {
  evalStd("E3Cust = Type.define({x: Int, eq: (self, other) => true}, Equatable)\n1");
  const recs = lawObligationRecords().filter(x => x.type === "E3Cust");
  eq(recs.length, 3);
  eq(recs.every(x => x.status === "pending"), true);
});

test("E3 laws: `law_` spec keys demand a for_all proposition", () => {
  let msg = "";
  try { evalStd("Bad = Type.define({x: Int, law_x: 42})\n1"); }
  catch (e: any) { msg = String(e?.message ?? e); }
  eq(msg.includes("for_all"), true);
});

test("E3 laws: refinement law over an interval domain survives sampling (tier sampled)", () => {
  evalStd("E3Pos = Refinement.define({refines: Int & _ > 0, where: p => p > 0, law_gt: for_all(a => a > 0)})\n1");
  const recs = lawObligationRecords().filter(x => x.type === "E3Pos" && x.law === "gt");
  eq(recs.length, 1);
  // Survival is NOT proof (D34): status "sampled", not "discharged".
  eq(recs[0].status, "sampled");
  eq(recs[0].tier, "sampled");
});

test("E3 laws: a false law HALTS with a concrete counterexample", () => {
  let msg = "";
  try {
    evalStd("E3Neg = Refinement.define({refines: Int & _ > 0, where: p => p > 0, law_bad: for_all(a => a < 0)})\n1");
  } catch (e: any) { msg = String(e?.message ?? e); }
  eq(msg.includes("law 'bad' fails"), true);
  eq(msg.includes("counterexample at (1)"), true);
});

test("E3 laws: a Bool-domain law discharges by full enumeration (tier enumerated)", () => {
  evalStd("E3BoolRef = Refinement.define({refines: Bool, where: p => true, law_lem: for_all(a => a || !a)})\n1");
  const recs = lawObligationRecords().filter(x => x.type === "E3BoolRef" && x.law === "lem");
  eq(recs.length, 1);
  eq(recs[0].status, "discharged");
  eq(recs[0].tier, "enumerated");
});

test("E3 laws: multi-variable laws sample tuples (arity 2)", () => {
  let msg = "";
  try {
    // a + b == b + a holds; a - b == b - a fails at (0, 1) → halt names it.
    evalStd("E3Comm = Refinement.define({refines: Int & _ >= 0, where: p => p >= 0, law_sub: for_all((a, b) => a - b == b - a)})\n1");
  } catch (e: any) { msg = String(e?.message ?? e); }
  eq(msg.includes("law 'sub' fails"), true);
  eq(msg.includes("counterexample at (0, 1)"), true);
});

test("E3 E-R5: an eq implementation with effects is rejected at definition", () => {
  let msg = "";
  try { evalStd("BadEq = Type.define({x: Int, eq: (self, other) => print(1)}, Equatable)\n1"); }
  catch (e: any) { msg = String(e?.message ?? e); }
  eq(msg.includes("must be pure"), true);
  eq(msg.includes("io"), true);
});

test("E3 E-R5: an eq peeking at certificates is rejected (observe label)", () => {
  let msg = "";
  try {
    evalStd("PosPeek = Int & _ > 0\nBadEq2 = Type.define({x: Int, eq: (self, other) => certificate_peek(self, PosPeek)}, Equatable)\n1");
  } catch (e: any) { msg = String(e?.message ?? e); }
  eq(msg.includes("must be pure"), true);
  eq(msg.includes("observe"), true);
});

test("E3 E-R5: a coercion fn with effects is rejected at declaration", () => {
  let msg = "";
  try {
    evalStd(`E3D = Int.distinct("E3D")\nCoercion.declare(E3D, Int, (u) => print(u))`);
  } catch (e: any) { msg = String(e?.message ?? e); }
  eq(msg.includes("must be pure"), true);
});

test("E3 witnessed: Law.witness flips a pending obligation to discharged/witnessed", () => {
  evalStd(`
E3W = Type.define({x: Bool, eq: (self, other) => self.x == other.x}, Equatable)
Law.witness(E3W, "refl", prove_for_all_bool(b => b == b))
1`);
  const recs = lawObligationRecords().filter(x => x.type === "E3W");
  const refl = recs.find(x => x.law === "refl");
  eq(refl?.status, "discharged");
  eq(refl?.tier, "witnessed");
  // The others stay pending — witnessing is per-law.
  eq(recs.find(x => x.law === "sym")?.status, "pending");
});

test("E3 witnessed: Law.witness rejects a non-proof and unknown laws", () => {
  let msg1 = "";
  try { evalStd(`E3W2 = Type.define({x: Int, eq: (self, other) => true}, Equatable)\nLaw.witness(E3W2, "refl", 42)`); }
  catch (e: any) { msg1 = String(e?.message ?? e); }
  eq(msg1.includes("not a discharged Proof"), true);
  let msg2 = "";
  try { evalStd(`E3W3 = Type.define({x: Int, eq: (self, other) => true}, Equatable)\nLaw.witness(E3W3, "nope", prove_for_all_bool(b => b == b))`); }
  catch (e: any) { msg2 = String(e?.message ?? e); }
  eq(msg2.includes("no law obligation 'nope'"), true);
});

test("E3 witnessed: Coercion.witness discharges a pending §7 obligation", () => {
  evalStd(`
E3CW = Int.distinct("E3CW")
Coercion.declare(E3CW, Int, (u) => Int(u))
Coercion.witness(E3CW, Int, "equality-preservation", prove_for_all_bool(b => b == b))
1`);
  const recs = coercionObligationRecords().filter(r => r.from === "E3CW" && r.to === "Int");
  const pres = recs.find(r => r.obligation === "equality-preservation");
  eq(pres?.status, "discharged");
  eq(pres?.tier, "witnessed");
  eq(recs.find(r => r.obligation === "coherence")?.status, "pending");
});

test("E3 verdict: law + coercion obligations ride the Verdict with tiers", () => {
  const src = "E3V = Type.define({x: Int, eq: (self, other) => true}, Equatable)\n1";
  const result = runtimeEval(src, undefined, [typeExt], undefined, true, undefined, true);
  const verdict = buildVerdict(result.evalCtx, result.compilationReport);
  eq((verdict.lawObligations ?? []).length >= 3, true);
  const intRefl = verdict.lawObligations!.find(o => o.type === "Int" && o.law === "refl");
  eq(intRefl?.status, "discharged");
  eq(intRefl?.tier, "kernel");
  const pend = verdict.lawObligations!.filter(o => o.type === "E3V");
  eq(pend.length, 3);
  eq(pend.every(o => o.status === "pending"), true);
  const kernelEdge = (verdict.coercionObligations ?? []).filter(o => o.from === "Int" && o.to === "Float");
  eq(kernelEdge.length, 2);
  eq(kernelEdge.every(o => o.status === "discharged" && o.tier === "kernel"), true);
  // Pending laws don't flip verified (E3 records; the strict gate is E4).
  eq(verdict.verified, true);
});

test("E3 obligations export: pending laws surface through the H2 surface", () => {
  const src = "E3Ob = Type.define({x: Int, eq: (self, other) => true}, Equatable)\n1";
  const result = runtimeEval(src, undefined, [typeExt], undefined, true, undefined, true);
  const obs = extractObligations(result.evalCtx, result.compilationReport, { pendingOnly: true });
  const names = obs.map(o => o.theorem.name);
  eq(names.includes("E3Ob.law_refl"), true);
  eq(names.includes("E3Ob.law_sym"), true);
  eq(names.includes("E3Ob.law_trans"), true);
  // Discharged kernel obligations are excluded under pendingOnly.
  eq(names.includes("Int.law_refl"), false);
});

test("E3 laws: interface declaration alone instantiates nothing", () => {
  const before = lawObligationRecords().length;
  evalStd("E3Decl = Interface.define({frob: Function, law_frob_id: for_all(a => a == a)})\n1");
  const after = lawObligationRecords().filter(x => x.law === "frob_id");
  // Declared, not implemented — schema only, no obligation for the
  // interface itself.
  eq(after.length, 0);
  eq(lawObligationRecords().length, before);
});

test("E3 laws: drawing a user law-bearing interface instantiates at draw time", () => {
  evalStd(`
E3HasId = Interface.define({idem: Function, law_idem: for_all(a => a == a)})
E3Draw = Type.define({x: Int}, E3HasId)
1`);
  const recs = lawObligationRecords().filter(x => x.type === "E3Draw" && x.law === "idem");
  eq(recs.length, 1);
  // No kernel certificate on a user law; record domain isn't sampleable →
  // pending (the honest answer — the H2 export owns it now).
  eq(recs[0].status, "pending");
});

// == E4 admitted tier + proof_trans strict gate + E-R6 recording (B-027, D34/D8) ==

test("E4 gate: kernel equalities are auto-proven — proof_trans over Int stays green", () => {
  const src = "theorem t: 1 == 1 by proof_trans(proof_refl(1), proof_refl(1))\n1";
  const result = runtimeEval(src, undefined, [typeExt], undefined, true, undefined, true);
  const v = buildVerdict(result.evalCtx, result.compilationReport);
  const t = v.theorems.find(x => x.name === "t");
  eq(t?.status, "discharged");
  // E-R6: the proof records which equality + which tier backed it.
  eq(t?.lawBacking?.equality, "Int");
  eq(t?.lawBacking?.law, "trans");
  eq(t?.lawBacking?.tier, "kernel");
});

test("E4 gate: a custom equality with no trans law is REFUSED (§6 delta 6)", () => {
  const src = `
E4CE = Type.define({x: Int, eq: (self, other) => self.x == other.x}, Equatable)
v1 = E4CE(1)
theorem t: v1 == v1 by proof_trans(proof_refl(v1), proof_refl(v1))
1`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true, undefined, true);
  const v = buildVerdict(result.evalCtx, result.compilationReport);
  const t = v.theorems.find(x => x.name === "t");
  eq(t?.status, "failed");
  eq(t?.failure?.reason.includes("neither proven nor admitted"), true);
  // The refusal is actionable — it names both escape hatches.
  eq(t?.failure?.counterexample?.includes("Law.witness"), true);
  eq(t?.failure?.counterexample?.includes("Law.assume"), true);
});

test("E4 admitted: Law.assume flips a pending obligation and unblocks the gate", () => {
  const src = `
E4CA = Type.define({x: Int, eq: (self, other) => self.x == other.x}, Equatable)
Law.assume(E4CA, "trans")
v1 = E4CA(1)
theorem t: v1 == v1 by proof_trans(proof_refl(v1), proof_refl(v1))
1`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true, undefined, true);
  const v = buildVerdict(result.evalCtx, result.compilationReport);
  const t = v.theorems.find(x => x.name === "t");
  eq(t?.status, "discharged");
  eq(t?.lawBacking?.tier, "admitted");
  // Verdict-visible: the obligation shows as admitted, and the theorem
  // line renders the weakness note.
  const ob = v.lawObligations?.find(o => o.type === "E4CA" && o.law === "trans");
  eq(ob?.status, "admitted");
  const rendered = formatVerdict(v);
  eq(rendered.includes("[resting on admitted 'trans' of 'E4CA']"), true);
  eq(rendered.includes("ADMITTED"), true);
});

test("E4 admitted: Law.assume registers an obligation for a never-instantiated law", () => {
  // E4NX never drew Equatable — no obligations exist; assuming trans
  // creates a verdict-visible admitted entry and unblocks the gate.
  const src = `
E4NX = Type.define({x: Int, eq: (self, other) => true})
Law.assume(E4NX, "trans")
v1 = E4NX(1)
theorem t: v1 == v1 by proof_trans(proof_refl(v1), proof_refl(v1))
1`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true, undefined, true);
  const v = buildVerdict(result.evalCtx, result.compilationReport);
  eq(v.theorems.find(x => x.name === "t")?.status, "discharged");
  const recs = lawObligationRecords().filter(x => x.type === "E4NX");
  eq(recs.length, 1);
  eq(recs[0].status, "admitted");
});

test("E4 witnessed: a witnessed trans law passes the gate with proven backing (no weakness note)", () => {
  const src = `
E4CW2 = Type.define({x: Int, eq: (self, other) => self.x == other.x}, Equatable)
Law.witness(E4CW2, "trans", prove_for_all_bool(b => b == b))
v1 = E4CW2(1)
theorem t: v1 == v1 by proof_trans(proof_refl(v1), proof_refl(v1))
1`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true, undefined, true);
  const v = buildVerdict(result.evalCtx, result.compilationReport);
  const t = v.theorems.find(x => x.name === "t");
  eq(t?.status, "discharged");
  eq(t?.lawBacking?.tier, "witnessed");
  eq(formatVerdict(v).includes("resting on"), false);
});

test("E4 E-R6: proof fields dispatch — p.equality / p.lawName / p.lawTier", () => {
  const r = evalStd("p = proof_trans(proof_refl(7), proof_refl(7))\np.lawTier");
  eq(bitsToString(r! as BitsValue), "kernel");
  const r2 = evalStd("p = proof_trans(proof_refl(7), proof_refl(7))\np.equality");
  eq(bitsToString(r2! as BitsValue), "Int");
  const r3 = evalStd("p = proof_refl(7)\np.lawName");
  eq(bitsToString(r3! as BitsValue), "refl");
});

test("E4: proven beats admitted — Law.assume on a discharged obligation is a no-op", () => {
  evalStd(`E4Pt2 = Type.define({x: Int}, Equatable)\nLaw.assume(E4Pt2, "trans")\n1`);
  const rec = lawObligationRecords().find(x => x.type === "E4Pt2" && x.law === "trans");
  eq(rec?.status, "discharged");
  eq(rec?.tier, "kernel");
});

test("E4: Coercion.assume flips a pending §7 obligation to admitted", () => {
  evalStd(`
E4CD = Int.distinct("E4CD")
Coercion.declare(E4CD, Int, (u) => Int(u))
Coercion.assume(E4CD, Int, "coherence")
1`);
  const recs = coercionObligationRecords().filter(r => r.from === "E4CD");
  eq(recs.find(r => r.obligation === "coherence")?.status, "admitted");
  eq(recs.find(r => r.obligation === "equality-preservation")?.status, "pending");
  // Unknown edge errors.
  let msg = "";
  try { evalStd(`Coercion.assume(Int, Bool, "coherence")`); }
  catch (e: any) { msg = String(e?.message ?? e); }
  eq(msg.includes("no declared coercion"), true);
});

test("E4: admitted obligations are excluded from the pendingOnly H2 export", () => {
  const src = `
E4Ex = Type.define({x: Int, eq: (self, other) => true}, Equatable)
Law.assume(E4Ex, "trans")
1`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true, undefined, true);
  const obs = extractObligations(result.evalCtx, result.compilationReport, { pendingOnly: true });
  const names = obs.map(o => o.theorem.name);
  eq(names.includes("E4Ex.law_refl"), true);   // still pending
  eq(names.includes("E4Ex.law_trans"), false); // admitted — resolved for gating
});

// == D2 assumption-ledger roll-up (B-091) ==
//
// Proofs carry a TRANSITIVE backing set (`lawBackings`, unioned
// through combinators and preserved by proof_check's relabel), so
// nested chains no longer lose inner backings; the Verdict aggregates
// the sets into an assumption-ledger block.

test("D2 roll-up: nested chain surfaces inner admitted backing through sym", () => {
  // Under single-field E-R6 recording, the outer proof_sym would lose
  // the inner proof_trans's admitted backing. The transitive set keeps it.
  const src = `
LgCell = Type.define({x: Int, eq: (self, other) => self.x == other.x}, Equatable)
Law.assume(LgCell, "trans")
v = LgCell(1)
theorem lg_outer: v == v by proof_sym(proof_trans(proof_refl(v), proof_refl(v)))
1`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true, undefined, true);
  const v = buildVerdict(result.evalCtx, result.compilationReport);
  const t = v.theorems.find(x => x.name === "lg_outer");
  eq(t?.status, "discharged");
  eq(t?.restsOn?.some(r => r.equality === "LgCell" && r.law === "trans" && r.tier === "admitted"), true);
  eq(formatVerdict(v).includes("[resting on admitted 'trans' of 'LgCell']"), true);
});

test("D2 roll-up: kernel chain records the full backing set, ledger stays clean", () => {
  const src = `
theorem lg_k: 1 == 1 by proof_trans(proof_refl(1), proof_refl(1))
1`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true, undefined, true);
  const v = buildVerdict(result.evalCtx, result.compilationReport);
  const t = v.theorems.find(x => x.name === "lg_k");
  // Both the trans gate's backing and the refl inputs' backing survive.
  eq(t?.restsOn?.some(r => r.law === "trans" && r.tier === "kernel"), true);
  eq(t?.restsOn?.some(r => r.law === "refl" && r.tier === "kernel"), true);
  const rendered = formatVerdict(v);
  eq(rendered.includes("assumption ledger: clean"), true);
  eq(rendered.includes("resting on"), false);
});

test("D2 roll-up: ledger dedupes one assumption across proofs and lists both backers", () => {
  const src = `
LgC2 = Type.define({x: Int, eq: (self, other) => self.x == other.x}, Equatable)
Law.assume(LgC2, "trans")
v = LgC2(1)
theorem lg_a: v == v by proof_trans(proof_refl(v), proof_refl(v))
theorem lg_b: v == v by proof_trans(proof_refl(v), proof_refl(v))
1`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true, undefined, true);
  const rendered = formatVerdict(buildVerdict(result.evalCtx, result.compilationReport));
  const ledgerLines = rendered.split("\n").filter(l => l.includes("admitted 'trans' of 'LgC2'") && l.includes("backs:"));
  eq(ledgerLines.length, 1);
  eq(ledgerLines[0].includes("lg_a"), true);
  eq(ledgerLines[0].includes("lg_b"), true);
  eq(rendered.includes("assumption ledger: rests on 1 admitted"), true);
});

test("D2 roll-up: an assumption backing no proofs still appears in the ledger", () => {
  const src = `
LgNx = Type.define({x: Int, eq: (self, other) => true}, Equatable)
Law.assume(LgNx, "trans")
1`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true, undefined, true);
  const rendered = formatVerdict(buildVerdict(result.evalCtx, result.compilationReport));
  eq(rendered.includes("admitted 'trans' of 'LgNx' — backs no proofs yet"), true);
});

test("D2 roll-up: inspect renders rests-on for proof bindings (weak loud, proven quiet)", () => {
  const src = `
LgIn = Type.define({x: Int, eq: (self, other) => self.x == other.x}, Equatable)
Law.assume(LgIn, "trans")
v = LgIn(1)
theorem lg_weak: v == v by proof_trans(proof_refl(v), proof_refl(v))
theorem lg_proven: 1 == 1 by proof_refl(1)
1`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true, undefined, true);
  const rendered = renderModuleSummary(summarizeModule(result.evalCtx, result.compilationReport));
  eq(rendered.includes("rests on: admitted 'trans' of 'LgIn'"), true);
  eq(rendered.includes("rests on: proven backing only"), true);
});

// == D47 source channel — B-094 chunk 1 (substrate + battery) ==
//
// The `source` channel carries a value's originating Expression AST:
// kernel-originated (evaluator only), `drop` propagation, observe-tagged
// reads via `source of x` (source_get), rendered as text at the read
// surface. Design: structures.md §3.1.


test("D47: binding-level source — `source of x` renders the RHS AST", () => {
  const r = evalStd("x = 2 + 2\nsource of x");
  eq(bitsToString(r! as BitsValue), "2 + 2");
  const r2 = evalStd("y = 5\nsource of y");
  eq(bitsToString(r2! as BitsValue), "5");
  // Lexical fidelity: symbols render by name.
  const r3 = evalStd("x = 2 + 2\nz = x + 1\nsource of z");
  eq(bitsToString(r3! as BitsValue), "x + 1");
});

test("D47: absent source answers none, and equality ignores the channel", () => {
  const r = evalStd("source of 7");
  eq(getTypeName(r!), "None");
  const r2 = evalStd("x = 2 + 2\nx == 4");
  eq(Number((r2! as BitsValue).data), 1);
});

test("D47: drop propagation — derived values carry no source", () => {
  const { evalCtx } = runtimeEval("x = 2 + 2\nd = x + 1\n1", undefined, [typeExt], undefined, true);
  const d = evalCtx.bindings.get("d")!.value!;
  // d has its OWN binding-level source ("x + 1") but the underlying
  // arithmetic result did not inherit x's — check a non-binding result:
  const { value } = runtimeEval("x = 2 + 2\nx * 3", undefined, [typeExt], undefined, true);
  eq(_metaViewD47(value!).get("source"), undefined);
  eq(_sourceOf(d) !== undefined, true);
});

test("D47: source-aware primitive receives each arg's originating AST", () => {
  // The data-plane analogue of lazy: the arg arrives EVALUATED, with the
  // unevaluated AST riding the source channel.
  let seen: string | null = null;
  const probe = makePrimitive("probe", (args) => {
    const ast = _sourceOf(args[0]);
    seen = ast ? renderExprSource(ast) : null;
    return args[0];
  }, false, undefined, true);
  const { value } = runtimeEval("probe(1 + 2)", undefined,
    [typeExt, { name: "d47", bindings: { probe } }], undefined, true);
  eq(seen, "1 + 2");
  eq(Number((value! as BitsValue).data), 3);
});

test("D47: source reads carry the observe effect (certificate_peek precedent)", () => {
  const { evalCtx } = runtimeEval("f(v) => source_get(v)\n1", undefined, [typeExt], undefined, true);
  const eff = effectsOf(evalCtx.bindings.get("f")!.value!);
  eq(eff?.has("observe"), true);
});

test("D47 chunk 2: explain — the reference source-aware consumer", () => {
  const r = evalStd("x = 4\nexplain(x * 3)");
  eq(bitsToString(r! as BitsValue), "x * 3 = 12");
  // No redundant echo when the source IS the value.
  const r2 = evalStd("explain(7)");
  eq(bitsToString(r2! as BitsValue), "7");
  // Compound operands parenthesize for fidelity.
  const r3 = evalStd("y = 5\nexplain(y * y - 2)");
  eq(bitsToString(r3! as BitsValue), "(y * y) - 2 = 23");
});

test("D47 chunk 2: explain carries observe (it reveals how a value was written)", () => {
  const { evalCtx } = runtimeEval("f(v) => explain(v + 1)\n1", undefined, [typeExt], undefined, true);
  const eff = effectsOf(evalCtx.bindings.get("f")!.value!);
  eq(eff?.has("observe"), true);
});

test("D47 chunk 2: proof entry points remain lazy non-value interpreters", () => {
  // A theorem whose proposition cannot resolve must FAIL (halt), not
  // residualize — the guard-opt-out property that keeps proof_by_eval
  // lazy (§3.1 chunk-2 amendment).
  let msg = "";
  try { evalStd("theorem t: unresolved_name == 4\n1"); }
  catch (e: any) { msg = String(e?.message ?? e); }
  eq(msg.includes("could not be discharged"), true);
});

test("D47: `source` cannot be originated — no user-reachable write path (B-125)", () => {
  // B-125 deleted `mv_set`, the unguarded write this test used to attack.
  // The property is now asserted in its stronger form: there is NO path,
  // rather than one path that is refused. The only user-reachable metadata
  // write is a writer minted by `channel_register`, and a writer is bound to
  // its own field by construction — so originating `source` would need its
  // registration, which is refused because the owner already holds it.
  let msg = "";
  try { evalStd('w = channel_register("source", "drop")'); }
  catch (e: any) { msg = String(e?.message ?? e); }
  eq(msg.includes("already registered"), true, "source registration is refused");
  // And the generic accessor cannot read it either — the observe tag
  // cannot be laundered through component_get.
  const r = evalStd('x = 2 + 2\ncomponent_get(x, "source")');
  eq(getTypeName(r!), "None");
});

