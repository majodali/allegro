// Under check alone the program has no capability. The output capability
// is a cell that no phase fills, so the write waits and nothing is
// printed. The claim written before it needs no capability and is
// decided. The run ends waiting on the capability, by name.
capability output
square(n) => n * n
claim(square(7) == 49)
output.write("hello")
// phases: check
// end: waiting: the program waits on the capability(ies) output, which no phase supplies
// The write's claim still waits when the run ends, so the summary is
// undecided.
// summary: undecided
