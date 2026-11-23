// Neither part gives a program anything: each answers at once with the
// empty structure, whatever it is given.
capability output
capability report
m <- report.message("bound")
s <- report.status(1)
n <- report.message(true)
output.write(int.text(count(m)) ++ " " ++ int.text(count(s)) ++ " " ++ int.text(count(n)))
output.write(if is_failure(m) || is_failure(n) then "failure" else "no failure")
// expect: 0 0 0
// expect: no failure
// reports: note: bound
// reports: note: report.message was handed no message: a value of kind bits
// status: 1
// end: completed
