// A message may give a file, a line and a column. It is written as build
// tools read it, file:line:column: level: text, with the parts it has. A
// line is written only after a file, and a column only after a line.
capability report
report.message({level: `warning, text: "unused binding", file: "main.alg", line: 3, column: 7})
report.message({level: `note, text: "here", file: "main.alg", line: 4})
report.message({text: "in this file", file: "main.alg", level: `note})
report.message({level: `note, text: "no file", line: 9, column: 2})
// reports: main.alg:3:7: warning: unused binding
// reports: main.alg:4: note: here
// reports: main.alg: note: in this file
// reports: note: no file
// end: completed
