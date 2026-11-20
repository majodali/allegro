// realises: test:boundary-tests:absent vs unresolved (C2.3b): declared import is a pending cell; undeclared name is absent
// The second half of the case, as it becomes: a name bound nowhere is
// refused by the notation before anything is evaluated, naming the name.
// The first half is absent-input.alg.
capability output
output.write("never")
output.write(db)
// end: refused: the name db is bound nowhere in the text
