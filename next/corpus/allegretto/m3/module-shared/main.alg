// realises: test:modules:module: caching prevents re-reads
// realises: test:modules:module: P2 — a second loader returns the same Extension
// Two modules import shared, each handing it the same output capability.
// The driver emits shared once and the launcher loads it once. The two
// imports are one instance, so its top-level statement happens once, and
// a and b get the same values from it: x is 42 in both. All of it is one
// configuration, one kernel.
capability output
import a
import b
output.write(int.text(a.y))
// expect: shared instantiated
// expect: 43
output.write(int.text(b.z))
// expect: 44
// end: completed
