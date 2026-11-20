// realises: test:modules:module: P2 — the same name in two directories is two keys
// The case as it becomes: a module's identity is its content, wherever
// its file lies and whatever it is named. one.alg and two.alg hold the
// same text, so they are one module. Both imports hand it the same
// output, so they are one instance: its top-level statement happens once.
capability output
import one
import two
output.write(int.text(one.x + two.x))
// expect: instantiated
// expect: 14
// end: completed
