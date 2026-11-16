// An indented block as a function's body, from the present tree's
// src/test/base.ts.
// realises: test:base:indentation block in function body
capability output
f() =>
    x = 3
    y = x + 1
    y * 2
output.write(int.text(f()))
// expect: 8
// end: completed
