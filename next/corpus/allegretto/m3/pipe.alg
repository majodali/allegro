// The pipe of the present tree's src/test/language.ts: a |> f is f(a).
// Each present text is an inner block; its value is printed through
// int.text.
// realises: test:language:pipe: simple function application
// realises: test:language:pipe: chained
// realises: test:language:pipe: with lambda
capability output
show(n) => output.write(int.text(n))
simple <-
  double(x) => x * 2
  5 |> double
show(simple)
// expect: 10
chained <-
  double(x) => x * 2
  add1(x) => x + 1
  5 |> double |> add1
show(chained)
// expect: 11
show(5 |> (x => x * 3))
// expect: 15
// end: completed
