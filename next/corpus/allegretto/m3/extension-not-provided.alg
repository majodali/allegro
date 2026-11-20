// realises: test:base:extension: not available without being provided
// Without the module that defines it, abs is a name bound nowhere: the
// emitter refuses the text, naming it, before anything is evaluated.
capability output
output.write(int.text(abs(5)))
// end: refused: the name abs is bound nowhere in the text
