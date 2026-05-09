// Phase D1 Slice 2 Stage E: function-type-expression syntax.
//
// `(A) => B` in type-expression position. Lowers to a concrete
// `Function[ParamTypes, ReturnType]`. Curried `(A) => (B) => C` parses
// right-recursively. Useful for HOFs whose param signatures are
// non-trivial — the annotation describes both arity and types in one
// reading-order-preserving form.

// Single-param function type
inc(x: Int): Int => x + 1
apply1(f: (Int) => Int, x: Int): Int => f(x)
print(apply1(inc, 41))                   // expect: 42

// Multi-param
add(x: Int, y: Int): Int => x + y
apply2(f: (Int, Int) => Int, a: Int, b: Int): Int => f(a, b)
print(apply2(add, 3, 4))                  // expect: 7

// Zero-param
get_99(): Int => 99
run(f: () => Int): Int => f()
print(run(get_99))                        // expect: 99

// Mixed parameter types
fmt(n: Int, s: String): String => s + n.toString()
apply_fs(f: (Int, String) => String, n: Int, s: String): String => f(n, s)
print(apply_fs(fmt, 42, "x="))            // expect: x=42

// Function type as Array element type
dbl(x: Int): Int => x * 2
fns: Array[(Int) => Int] = [inc, dbl]
print(fns[0](5) + fns[1](5))              // expect: 16

// Curried: function returning a function
make_adder(n: Int): (Int) => Int =>
  (x: Int): Int => x + n
add5 = make_adder(5)
print(add5(10))                           // expect: 15

// Higher-order with curried fn-type param
apply_curried(f: (Int) => (Int) => Int, a: Int, b: Int): Int =>
  (f(a))(b)
print(apply_curried(make_adder, 3, 4))    // expect: 7

// Generic + fn type
sum_via(arr: Array[Int], f: (Int) => Int): Int =>
  arr.reduce((a: Int, x: Int): Int => a + f(x), 0)
print(sum_via([1, 2, 3], (x: Int): Int => x * 10))  // expect: 60
