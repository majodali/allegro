// realises: test:modules:module: circular dependency detected
// a imports b and b imports a: the imports have no order, and the driver
// refuses the text, naming the cycle. Nothing is launched.
capability output
import a
output.write("never")
// end: refused: the imports form a cycle, which has no order: a imports b, which imports a
