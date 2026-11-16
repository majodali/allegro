// A remainder by zero is a refutation, from the present tree's
// src/test/base.ts. The present reason is "division by zero", and so is
// the shipped primitive int.mod's.
// realises: test:base:modulo by zero
capability output
output.write(int.text(1 % 0))
// end: refuted: division by zero
