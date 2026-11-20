// realises: test:modules:module: transitive dependencies
// main imports derived, and derived imports base: the driver emits base
// first, then derived, and the launcher loads them in that order.
// quadruple(5) is double(double(5)), 20.
capability output
import derived
output.write(int.text(derived.quadruple(5)))
// expect: 20
// end: completed
