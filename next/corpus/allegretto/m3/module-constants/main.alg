// realises: test:modules:module: module with bindings and functions
// A module of bindings: pi is 3 and tau, computed from it, is 6. Their
// sum, read through the import, is 9.
capability output
import constants
output.write(int.text(constants.pi + constants.tau))
// expect: 9
// end: completed
