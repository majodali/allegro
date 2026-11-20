// An import is a binding, evaluated when something first needs it. Nothing
// here needs noisy, so it is never instantiated and its statement never
// happens. It is loaded all the same.
capability output
import noisy
output.write("main ran")
// expect: main ran
// end: completed
