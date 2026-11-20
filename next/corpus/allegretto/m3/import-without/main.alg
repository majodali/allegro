// without withholds a capability. The imported module may still be used:
// quiet() does not use output and gives 7. loud() uses it, and that use is
// a refusal with the reason the forms give. Nothing written after it
// happens.
capability output
import lib without output
output.write(int.text(lib.quiet()))
// expect: 7
lib.loud()
output.write("never")
// end: refuted: the capability output was withheld by the importing module
