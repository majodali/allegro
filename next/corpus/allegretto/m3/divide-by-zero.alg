// A primitive outside its domain is a refutation with its reason. 7 / 0
// restates the present tree's 1 / 0 of src/test/base.ts.
// realises: test:base:division by zero
capability output
output.write(int.text(7 / 2))
// expect: 3
output.write(int.text(7 / 0))
output.write("never printed")
// end: refuted: division by zero
