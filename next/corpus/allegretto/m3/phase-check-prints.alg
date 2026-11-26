// Under check alone the check evaluates the program, and nothing
// is performed. The output capability is not yet given: the check names
// report alone, so output is a cell. The write waits on it and nothing is
// printed. The claim written before it is reached. A write that waits
// refutes nothing, so the check finds no refutation and the launch
// completes.
capability output
square(n) => n * n
claim(square(7) == 49)
output.write("hello")
// phases: check
// end: completed
// The write's claim still waits when the check ends, so the summary is
// undecided.
// summary: undecided
