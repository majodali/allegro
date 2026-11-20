// realises: test:modules:module: empty module produces empty extension
// A module whose text is a comment alone yields an empty structure.
capability output
import empty
output.write(int.text(count(empty)))
// expect: 0
// end: completed
