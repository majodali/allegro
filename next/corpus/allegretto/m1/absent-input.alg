// realises: test:boundary-tests:absent vs unresolved (C2.3b): declared import is a pending cell; undeclared name is absent
// The first half of the case, as it becomes: a declared input the
// configuration does not supply is a cell, and the run that needs it ends
// waiting on the input. The second half is absent-name.alg.
capability output
input db
output.write("before")
// expect: before
output.write(db)
// end: waiting: the program waits on the input(s) db, which the configuration does not supply
