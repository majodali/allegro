// realises: test:boundary-tests:applyPhase (C2.3b): resolves the pending cell in place and forward-chains dependents
// The input cfg is not supplied at the start, so it is a cell. The first
// phase evaluates the module with cfg unknown: y waits on it. A later phase
// supplies cfg; the cell is filled once, and y, which waited on it, is
// evaluated again.
capability output
input cfg
y = cfg
output.write("the first phase")
// expect: the first phase
// later: cfg = 7
output.write(int.text(y))
// expect: 7
// end: completed
