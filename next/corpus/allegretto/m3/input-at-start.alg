// realises: test:boundary-tests:import satisfied by an extension (C2.3b): resolves through the chain, no pending cell
// The configuration supplies the input cfg at the start. It is used
// directly: no later phase is applied, and nothing waits.
capability output
input cfg
x = cfg
// input: cfg = 9
output.write(int.text(x))
// expect: 9
// end: completed
