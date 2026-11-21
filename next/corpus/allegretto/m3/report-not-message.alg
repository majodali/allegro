// A value that is no message is a note that says so and names the value's
// kind. It is no refutation: the part gives the program nothing, so the
// lines after it go on. true is one bit, so it is no text. A
// number written out is 64 bits, whole bytes, and is read as a text where
// its bytes are UTF-8, as for any bits.
capability output
capability report
report.message(true)
report.message({level: `fatal, text: "no such level"})
report.message({text: "no level"})
report.message({failure: `missing, reason: "a failure"})
report.message(`note)
output.write("after")
// expect: after
// reports: note: report.message was handed no message: a value of kind bits
// reports: note: report.message was handed no message: a value of kind structure
// reports: note: report.message was handed no message: a value of kind structure
// reports: note: report.message was handed no message: a value of kind structure
// reports: note: report.message was handed no message: a value of kind symbol
// end: completed
