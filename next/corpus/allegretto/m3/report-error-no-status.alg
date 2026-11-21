// A message does not set the status, whatever its level. A program that
// hands an error and no status completes with the status 0. A program
// that must fail refutes a claim.
capability output
capability report
report.message({level: symbol("error"), text: "an error, and no status"})
output.write("after the error")
// expect: after the error
// reports: error: an error, and no status
// status: 0
// end: completed
