// A test that calls report. Both parts act under a test phase as in a
// run: the message is handed over, and the highest status stands across
// the load and every test. The test passes, and the status is what the
// launch exits with.
capability output
capability report
report.status(1)
export reports() =>
  report.message({level: `warning, text: "from a test"})
  report.status(3)
  claim(1 == 1)
export after() => report.status(2)
// phases: test
// test: reports: passed
// test: after: passed
// reports: warning: from a test
// status: 3
// end: completed
