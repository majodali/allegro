// A module with no export is open: it yields all its bindings.
capability output
double(n) => n * 2
base = 21
answer = double(base)
output.write(int.text(answer))
// expect: 42
// yields: double, base, answer
// end: completed
