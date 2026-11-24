// A module that calls report, under check alone. Report is a check
// capability, so the check hands it as not needed: each call performs
// nothing and answers the empty structure, and no message or status is
// handed over. The claims come out, and the statement after the calls is
// reached: its claim is decided.
capability report
report.message({level: `warning, text: "noted"})
report.status(3)
claim(2 + 2 == 4)
// phases: check
// status: 0
// end: completed
// claim at: 9:1 decided
