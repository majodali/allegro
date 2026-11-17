// realises: test:language:reactive: applyPhase provides binding and triggers re-eval
// A later phase supplies the input extra, and the program reads it as a
// binding: 100.
capability output
input extra
x = 42
output.write(int.text(x))
// expect: 42
// later: extra = 100
output.write(int.text(extra))
// expect: 100
// end: completed
