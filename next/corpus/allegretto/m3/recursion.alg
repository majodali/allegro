// The recursion of the present tree's src/test/base.ts, with the present
// definitions. test:base:factorial is realised by factorial.alg.
// realises: test:base:factorial base case
// realises: test:base:fibonacci
capability output
factorial(n) => if n == 0 then 1 else n * factorial(n - 1)
fib(n) => if n <= 1 then n else fib(n - 1) + fib(n - 2)
output.write(int.text(factorial(0)))
// expect: 1
output.write(int.text(fib(10)))
// expect: 55
// end: completed
