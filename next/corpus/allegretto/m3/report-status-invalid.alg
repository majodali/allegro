// A value that is no status, a whole number from 0 to 255, counts as 255,
// and a note says so.
capability report
report.status(300)
report.status(`high)
// reports: note: report.status was handed no status from 0 to 255: a value of kind bits, which counts as 255
// reports: note: report.status was handed no status from 0 to 255: a value of kind symbol, which counts as 255
// status: 255
// end: completed
