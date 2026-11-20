// realises: test:async-futures:async: print defers until value resolves
// Nothing is written until the value arrives, then 0. print is the
// output capability's write, and delay is the present tree's, written
// over the timer. The second line runs while the first waits, so the
// first has written nothing by then.
capability output
capability timer
delay(n) => then(timer.wait(n), 0)
printed <- output.write(int.text(delay(10)))
output.write("the first line has written nothing yet")
// expect: the first line has written nothing yet
// expect: 0
// end: completed
