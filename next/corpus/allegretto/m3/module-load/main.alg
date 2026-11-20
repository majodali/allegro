// realises: test:modules:module: load simple module
// realises: test:modules:module: loaded functions work in evaluation
// The module helpers is read from helpers.alg beside this text. It
// yields a structure of its two bindings, double and triple, and its
// functions work in this program's evaluation: double(21) is 42.
capability output
import helpers
output.write(int.text(count(helpers)))
// expect: 2
output.write(spelling(key(helpers, 0)))
// expect: double
output.write(spelling(key(helpers, 1)))
// expect: triple
output.write(int.text(helpers.double(21)))
// expect: 42
output.write(int.text(helpers.triple(3)))
// expect: 9
// end: completed
