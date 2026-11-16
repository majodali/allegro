// A module with exports yields only the bindings marked. A binding nobody
// needs and nobody is yielded is never evaluated: its effect never happens.
capability output
export double(n) => n * 2
export answer = double(base)
base = 21
unused = output.write("never written")
output.write(int.text(answer))
// expect: 42
// yields: double, answer
// end: completed
