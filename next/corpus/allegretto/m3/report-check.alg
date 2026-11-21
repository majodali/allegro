// Under check alone the check capabilities of the ceiling are supplied,
// report among them, and no other. So the program's messages and its
// status are handed over, while its write waits on the output capability
// and nothing is printed.
capability output
capability report
report.message({level: `warning, text: "checked"})
report.status(2)
output.write("not printed under check")
report.message("held by the write")
// phases: check
// reports: warning: checked
// status: 2
// end: waiting: the program waits on the capability(ies) output, which no phase supplies
