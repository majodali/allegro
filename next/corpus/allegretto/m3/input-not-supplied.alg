// realises: test:language:reactive: import binding starts incomplete
// The input foo is not supplied, so it is a cell. A binding that does not
// use it is evaluated: x is 42. What uses foo waits on it, and the run
// ends waiting on the input.
capability output
input foo
x = 42
output.write(int.text(x))
// expect: 42
output.write(foo)
// end: waiting: the program waits on the input(s) foo, which the configuration does not supply
