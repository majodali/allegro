// realises: test:async-futures:async: chain of dependent futures
// The case's text: x = delay(10), y = x + 1, print(y). Nothing is printed
// while x waits; then y is 1. delay is the present tree's, written over
// the timer, and print is the output capability's write.
capability output
capability timer
delay(n) => then(timer.wait(n), 0)
x = delay(10)
y = x + 1
printed <- output.write(int.text(y))
output.write("nothing printed while x waits")
// expect: nothing printed while x waits
// expect: 1
// end: completed
