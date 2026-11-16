// Reading a structure's fields with ".", from the present tree's
// src/test/grammar-legacy.ts. The present test hands each structure to the
// program through a host extension; here the program binds it.
// realises: test:grammar-legacy:hybrid parser: dot access resolves from context
// realises: test:grammar-legacy:hybrid parser: dot access chained
// realises: test:grammar-legacy:hybrid parser: dot access in arithmetic
capability output
show(n) => output.write(int.text(n))
math = {pi: 3, e: 2}
outer = {inner: {x: 42}}
show(math.pi)
// expect: 3
show(outer.inner.x)
// expect: 42
show(math.pi + math.e)
// expect: 5
// end: completed
