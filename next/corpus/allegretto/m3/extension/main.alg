// realises: test:base:extension: abs positive
// realises: test:base:extension: abs negative
// realises: test:base:extension: max
// realises: test:base:extension: min
// realises: test:base:extension: used in expressions
// realises: test:base:extension: used with user functions
// The present tests hand abs, max and min to the program by an extension.
// Here a module that defines them is imported, and each is read as an
// entry of it: math.abs.
capability output
import math
output.write(int.text(math.abs(42)))
// expect: 42
output.write(int.text(math.abs(0 - 7)))
// expect: 7
output.write(int.text(math.max(3, 9)))
// expect: 9
output.write(int.text(math.min(3, 9)))
// expect: 3
output.write(int.text(math.abs(0 - 5) + math.max(10, 20)))
// expect: 25
clamp(x, lo, hi) => math.min(math.max(x, lo), hi)
output.write(int.text(clamp(100, 0, 50)))
// expect: 50
// end: completed
