// The recursion of the present tree's src/test/base.ts, with the present
// definitions. test:base:factorial is realised by factorial.alg. The
// definition of fib is also the text of the case grammar2/base: fib of
// src/test/grammar2-language.ts.
// realises: test:base:factorial base case
// realises: test:base:fibonacci
// realises: test:grammar2-language:grammar2/base: fib
capability output
factorial(n) => if n == 0 then 1 else n * factorial(n - 1)
fib(n) => if n <= 1 then n else fib(n - 1) + fib(n - 2)
output.write(int.text(factorial(0)))
// expect: 1
output.write(int.text(fib(10)))
// expect: 55
// end: completed
