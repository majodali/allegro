// Recursion on a known argument, printed through int.text.
capability output
fact(n) => if n == 0 then 1 else n * fact(n - 1)
sum(n) => if n == 0 then 0 else n + sum(n - 1)
output.write(int.text(fact(5)))
// expect: 120
output.write(int.text(fact(20)))
// expect: 2432902008176640000
output.write(int.text(sum(100)))
// expect: 5050
// end: completed
