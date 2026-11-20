// realises: test:async-futures:B-028 F2 (CE-R6): modules evaluate with the session's FutureManager
// The second half of the case, as it becomes: the same module loaded
// where the phase has no timer capability. The importing module hands it
// the input clock, which no phase supplies, in place of a timer. The
// call of the timer stays residual: the module loads, answer is read,
// and the run ends waiting. Nothing fails. The first half is
// module-waits/main.alg.
capability output
input clock
import asyncmod with timer: clock
output.write("answer is " ++ int.text(asyncmod.answer))
// expect: answer is 42
// end: waiting: the program waits on the input(s) clock, which the configuration does not supply
