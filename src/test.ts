// =============================================================================
// Allegro Base Language - Test Suite
// Run: npx tsx src/test.ts
// =============================================================================

import { formatValue } from "./primitives.js";
import { evalSource as runtimeEval } from "./runtime.js";
import { Value, ValueKind } from "./types.js";

// --- Test infrastructure ---

let passed = 0;
let failed = 0;
const failures: string[] = [];

function evalSource(source: string): Value | null {
  return runtimeEval(source + "\n").value;
}

/** Evaluate and return the formatted string result. */
function evalStr(source: string): string {
  const val = evalSource(source);
  if (val === null) throw new Error("No value produced");
  return formatValue(val);
}

/** Evaluate and return the numeric result (for Bits values). */
function evalNum(source: string): number {
  const val = evalSource(source);
  if (val === null) throw new Error("No value produced");
  const p = val.kind === ValueKind.MultiValue ? val.primary : val;
  if (p.kind !== ValueKind.Bits) throw new Error(`Expected Bits, got ${p.kind}`);
  // Handle signed 64-bit
  if (p.length === 64 && p.data >= 2n ** 63n) return Number(p.data - 2n ** 64n);
  return Number(p.data);
}

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
  } catch (e: any) {
    failed++;
    const msg = `FAIL: ${name} — ${e.message}`;
    failures.push(msg);
    console.log(msg);
  }
}

function eq(actual: any, expected: any, label?: string): void {
  if (actual !== expected) {
    throw new Error(`${label ? label + ": " : ""}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function throws(fn: () => void, pattern?: string): void {
  try {
    fn();
    throw new Error("Expected an error but none was thrown");
  } catch (e: any) {
    if (e.message === "Expected an error but none was thrown") throw e;
    if (pattern && !e.message.includes(pattern)) {
      throw new Error(`Expected error containing "${pattern}", got: ${e.message}`);
    }
  }
}

// --- Tests ---

// == Arithmetic ==

test("integer literal", () => {
  eq(evalNum("42"), 42);
});

test("addition", () => {
  eq(evalNum("3 + 4"), 7);
});

test("subtraction", () => {
  eq(evalNum("10 - 3"), 7);
});

test("multiplication", () => {
  eq(evalNum("6 * 7"), 42);
});

test("division", () => {
  eq(evalNum("15 / 3"), 5);
});

test("modulo", () => {
  eq(evalNum("17 % 5"), 2);
});

test("precedence: * before +", () => {
  eq(evalNum("3 + 4 * 2"), 11);
});

test("precedence: parentheses override", () => {
  eq(evalNum("(3 + 4) * 2"), 14);
});

test("unary minus", () => {
  eq(evalNum("-5"), -5);
});

test("negative arithmetic", () => {
  eq(evalNum("0 - 42"), -42);
});

test("hex literal", () => {
  eq(evalNum("0xFF"), 255);
});

test("binary literal", () => {
  eq(evalNum("0b1010"), 10);
});

// == Comparisons ==

test("equality true", () => {
  eq(evalNum("1 == 1"), 1);
});

test("equality false", () => {
  eq(evalNum("1 == 2"), 0);
});

test("inequality", () => {
  eq(evalNum("1 != 2"), 1);
});

test("less than", () => {
  eq(evalNum("3 < 5"), 1);
  eq(evalNum("5 < 3"), 0);
});

test("greater than", () => {
  eq(evalNum("5 > 3"), 1);
  eq(evalNum("3 > 5"), 0);
});

test("less than or equal", () => {
  eq(evalNum("3 <= 3"), 1);
  eq(evalNum("4 <= 3"), 0);
});

test("greater than or equal", () => {
  eq(evalNum("3 >= 3"), 1);
  eq(evalNum("2 >= 3"), 0);
});

// == Bindings ==

test("simple binding", () => {
  eq(evalNum("x = 42\nx"), 42);
});

test("binding with expression", () => {
  eq(evalNum("x = 3 + 4 * 2\nx"), 11);
});

test("multiple bindings", () => {
  eq(evalNum("x = 10\ny = 20\nx + y"), 30);
});

test("binding chain", () => {
  eq(evalNum("x = 5\ny = x + 1\nz = y * 2\nz"), 12);
});

// == Functions ==

test("simple function", () => {
  eq(evalNum("double(n) => n * 2\ndouble(21)"), 42);
});

test("two-param function", () => {
  eq(evalNum("add(x, y) => x + y\nadd(3, 4)"), 7);
});

test("function call as argument", () => {
  eq(evalNum("double(n) => n * 2\ndouble(double(5))"), 20);
});

// == Lambdas ==

test("lambda: single param", () => {
  eq(evalNum("apply(f, x) => f(x)\napply(x => x + 1, 5)"), 6);
});

test("lambda: multi param", () => {
  eq(evalNum("apply(f, x, y) => f(x, y)\napply((a, b) => a * b, 6, 7)"), 42);
});

test("lambda: zero param (thunk)", () => {
  eq(evalNum("run(f) => f()\nrun(() => 42)"), 42);
});

// == If-then-else ==

test("if true branch", () => {
  eq(evalNum("if 1 == 1 then 42 else 0"), 42);
});

test("if false branch", () => {
  eq(evalNum("if 1 == 2 then 42 else 0"), 0);
});

test("if with expressions", () => {
  eq(evalNum("x = 5\nif x > 0 then x else 0 - x"), 5);
});

test("if with negative (else branch)", () => {
  eq(evalNum("x = -3\nif x > 0 then x else 0 - x"), 3);
});

test("if-then-else low precedence (else captures full expr)", () => {
  eq(evalNum("if 0 == 1 then 0 else 6 * 7"), 42);
});

// == Recursion ==

test("factorial", () => {
  eq(evalNum("factorial(n) => if n == 0 then 1 else n * factorial(n - 1)\nfactorial(5)"), 120);
});

test("factorial base case", () => {
  eq(evalNum("factorial(n) => if n == 0 then 1 else n * factorial(n - 1)\nfactorial(0)"), 1);
});

test("fibonacci", () => {
  eq(evalNum("fib(n) => if n <= 1 then n else fib(n - 1) + fib(n - 2)\nfib(10)"), 55);
});

// == Closures ==

test("higher-order function", () => {
  eq(evalNum("apply(f, x) => f(x)\napply(x => x + 10, 32)"), 42);
});

test("function returning value used in expression", () => {
  eq(evalNum("double(n) => n * 2\n1 + double(20)"), 41);
});

// == Indentation blocks ==

test("indentation block in function body", () => {
  eq(evalNum("f() =>\n    x = 3\n    y = x + 1\n    y * 2\nf()"), 8);
});

// == Error cases ==

test("division by zero", () => {
  throws(() => evalNum("1 / 0"), "division by zero");
});

test("modulo by zero", () => {
  throws(() => evalNum("1 % 0"), "division by zero");
});

test("parse error on invalid syntax", () => {
  throws(() => evalSource("+ +"), "");
});

// == Edge cases ==

test("zero", () => {
  eq(evalNum("0"), 0);
});

test("large number", () => {
  eq(evalNum("1000000 * 1000"), 1000000000);
});

test("deeply nested arithmetic", () => {
  eq(evalNum("((1 + 2) * (3 + 4)) + ((5 - 1) * 2)"), 29);
});

test("function shadowing binding", () => {
  eq(evalNum("x = 100\nf(x) => x + 1\nf(5)"), 6);
});

// == Print (captures output) ==

test("print returns its argument", () => {
  // print returns the value it prints
  eq(evalNum("print(42)"), 42);
});

// == REPL-style persistent context ==

test("persistent context across evaluations", () => {
  // Simulate REPL: first input defines x, second uses it
  const r1 = runtimeEval("x = 10\n");
  const r2 = runtimeEval("x + 5\n", r1.evalCtx);
  const p = r2.value!;
  const v = p.kind === ValueKind.MultiValue ? p.primary : p;
  if (v.kind !== ValueKind.Bits) throw new Error(`Expected Bits, got ${v.kind}`);
  eq(Number(v.data), 15);
});

test("persistent context: function then call", () => {
  const r1 = runtimeEval("double(n) => n * 2\n");
  const r2 = runtimeEval("double(21)\n", r1.evalCtx);
  const p = r2.value!;
  const v = p.kind === ValueKind.MultiValue ? p.primary : p;
  if (v.kind !== ValueKind.Bits) throw new Error(`Expected Bits, got ${v.kind}`);
  eq(Number(v.data), 42);
});

test("persistent context: redefine binding", () => {
  const r1 = runtimeEval("x = 10\n");
  const r2 = runtimeEval("x = 20\n", r1.evalCtx);
  const r3 = runtimeEval("x\n", r2.evalCtx);
  const p = r3.value!;
  const v = p.kind === ValueKind.MultiValue ? p.primary : p;
  if (v.kind !== ValueKind.Bits) throw new Error(`Expected Bits, got ${v.kind}`);
  eq(Number(v.data), 20);
});

// --- Results ---

console.log(`\n${"=".repeat(50)}`);
console.log(`Tests: ${passed + failed} total, ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
