// realises: test:async-futures:B-028 F2 (CE-R6): modules evaluate with the session's FutureManager
// The first half of the case, as it becomes: a module whose top level
// waits on a timer loads, and its cell is filled when the timer answers.
// The importing module hands it its own timer. The second half is
// module-without-timer/main.alg.
capability output
capability timer
import asyncmod
output.write("answer is " ++ int.text(asyncmod.answer))
// expect: answer is 42
// expect: asyncmod: probe is filled with 1
// end: completed
