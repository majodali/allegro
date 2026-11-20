// realises: test:async-futures:B-028 F1: a future resolving in a LATER pass still completes its dependents (cross-pass fix)
// A session at a prompt is a module, and each entry is a line of it. The
// first entry leaves y waiting on x. The second entry, z = 5, is
// evaluated and printed while x still waits. The answer arrives after
// it, and still completes y: y = 0 + 1.
capability output
capability timer
delay(n) => then(timer.wait(n), 0)
x <- delay(10)
y = x + 1
shown <- output.write("y is " ++ int.text(y))
z = 5
output.write("z is " ++ int.text(z))
// expect: z is 5
// expect: y is 1
// end: completed
