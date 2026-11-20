// refuse(reason) (next/ext/allegretto/forms.md §2, "Control and claims"):
// how code says why it will not go on. The run is refuted with that reason.
capability output
checked(n) => if n < 0 then refuse("a count below zero") else n
output.write(int.text(checked(3)))
// expect: 3
output.write(int.text(checked(0 - 1)))
output.write("never printed")
// end: refuted: a count below zero
