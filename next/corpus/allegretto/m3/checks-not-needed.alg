// A capability the check names as not needed: report. Under check a call
// on it performs nothing and answers the empty structure, and the claim
// that the dropped call stands for is decided in the program as written.
// The module's function is not gone into a second time, so what was
// handed for report stays as handed.
capability report
report.message("checked")
claim(2 + 2 == 4)
// phases: check
// end: completed
// claim at: 7:1 decided
// claim at: 8:1 decided
// summary: decided
// status: 0
