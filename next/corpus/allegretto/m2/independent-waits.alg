// realises: test:async-futures:async: multiple independent futures
// a and b wait at once, on two waits of the timer, and both are filled.
// The line after them runs while both wait. delay is the present tree's,
// written over the timer.
capability output
capability timer
delay(n) => then(timer.wait(n), 0)
a <- delay(10)
b <- delay(20)
shown <- output.write("a is " ++ int.text(a) ++ ", b is " ++ int.text(b))
output.write("a and b both wait")
// expect: a and b both wait
// expect: a is 0, b is 0
// end: completed
