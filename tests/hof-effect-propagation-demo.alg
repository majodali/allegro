// Phase D1 Slice 2 Stage F3b: stdlib HOF effect propagation.
//
// Pre-F3b, `arr.map(cb)` was conservatively tagged `opaque` because the
// walker couldn't see through the HOF's runtime dispatch. With F1 PE-driven
// effects + F2 polymorphic Param-call propagation + F3a compile-time
// deferral, the cb's effects flow through the Allegro-built mapAllegro
// body's `fn(arr[i])` Param-call, and callers see the precise inferred
// set instead of the opaque placeholder.
//
// This demo just exercises the end-to-end behaviour. The interesting
// verification — that compile-time inference now sees `io` instead of
// `opaque` — lives in `src/test.ts`'s Stage F3b suite. At runtime, the
// effects fire normally as if no inference had occurred.

// Pure callbacks: caller's inferred effects are pure.
dbl(arr: Array[Int]): Array[Int] =>
  arr.map((x: Int): Int => x * 2)

// IO callbacks: caller's inferred effects include io.
print_each(arr: Array[Int]): Array[Int] =>
  arr.map((x: Int): Int => print(x))

// Filter and reduce work the same way.
positives(arr: Array[Int]): Array[Int] =>
  arr.filter((x: Int): Int => x)

sum_of(arr: Array[Int]): Int =>
  arr.reduce((a: Int, x: Int): Int => a + x, 0)

// End-to-end runtime usage — no inference, just normal evaluation.
print(dbl([1, 2, 3]))                  // expect: [2, 4, 6]
print(positives([0, 5, 0, 7]))         // expect: [5, 7]
print(sum_of([10, 20, 30]))            // expect: 60

// Using the io callback fires io as you'd expect — print_each invokes the
// io callback once per element, producing one print line per element.
print_each([100, 200, 300])
// expect: 100
// expect: 200
// expect: 300
