// A module hands report on to the module it imports, by default, and the
// imported module reports through it.
capability report
import lint
lint.warn("from the imported module")
report.status(lint.code)
// reports: lint.alg:4: warning: from the imported module
// status: 1
// end: completed
