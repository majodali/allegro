// realises: test:base:print returns its argument
// As the case becomes: print is a call on the output capability that the
// launcher supplies. With that capability given, the call writes 42.
// Without it, the call stays in the residual: printer is an input in
// place of a capability, no phase supplies it, and the run ends waiting
// on it.
capability output
input printer
output.write(int.text(42))
// expect: 42
residual <- printer.write(int.text(42))
// end: waiting: the program waits on the input(s) printer, which the configuration does not supply
