// realises: test:async-futures:async: delay resolves and propagates to dependents
// y = x waits while x does. When the timer answers, x is filled and y,
// which waited on it, is evaluated again. delay is the present tree's,
// written over the timer: 0 after n milliseconds.
capability output
capability timer
delay(n) => then(timer.wait(n), 0)
x <- delay(10)
y = x
shown <- output.write("y is " ++ int.text(y))
output.write("y waits on x")
// expect: y waits on x
// expect: y is 0
// end: completed
