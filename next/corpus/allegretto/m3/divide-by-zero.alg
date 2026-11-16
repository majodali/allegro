// A primitive outside its domain is a refutation with its reason.
capability output
output.write(int.text(7 / 2))
// expect: 3
output.write(int.text(7 / 0))
output.write("never printed")
// end: refuted: division by zero
