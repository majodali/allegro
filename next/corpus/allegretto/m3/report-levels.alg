// report.message hands a message to whatever ran the program
// (next/launch/report.ts): a structure with a level and a text. The level
// is one of the symbols error, warning and note. Each message is handed
// over in the order written.
capability report
report.message({level: `error, text: "an error"})
report.message({level: `warning, text: "a warning"})
report.message({level: `note, text: "a note"})
// reports: error: an error
// reports: warning: a warning
// reports: note: a note
// end: completed
