// Under check alone the check capabilities of the ceiling, report among
// them, are handed as not needed: a call on a part performs nothing and
// answers the empty structure. So no message and no status is handed
// over, and the status stays 0. The write waits on the output capability,
// which is not yet given, and nothing is printed. The check finds no
// refutation, so the launch completes.
capability output
capability report
report.message({level: `warning, text: "checked"})
report.status(2)
output.write("not printed under check")
// phases: check
// status: 0
// end: completed
