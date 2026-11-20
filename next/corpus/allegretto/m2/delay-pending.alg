// realises: test:async-futures:async: delay creates pending future
// x is left waiting until the timer answers, and then it is filled. The
// present tree's delay(n) answers 0 after n milliseconds: here it is
// then(timer.wait(n), 0). The line that uses x is started first and
// printed last: x was not yet known when the line after it ran.
capability output
capability timer
delay(n) => then(timer.wait(n), 0)
x <- delay(10)
shown <- output.write("x is " ++ int.text(x))
output.write("x waits on the timer")
// expect: x waits on the timer
// expect: x is 0
// end: completed
