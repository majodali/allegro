// Check, then run, on a program that prints. The check finds nothing
// refuted, and the run after it is an ordinary run: it prints what run
// alone prints, in the same order, and ends as run alone ends. The check
// performed nothing, so each line is printed once.
capability output
double(n) => n + n
output.write("first")
output.write(int.text(double(21)))
claim(2 + 2 == 4)
// phases: check, run
// expect: first
// expect: 42
// end: completed
// check claim at: 9:1 decided
// claim at: 9:1 decided
