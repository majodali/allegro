// A binding written with = happens when it is first needed, and once. A
// line written with <- happens at its place.
capability output
later = output.write("the binding, when first needed")
output.write("first")
// expect: first
now <- output.write("the statement, at its place")
// expect: the statement, at its place
output.write("second")
// expect: second
later
// expect: the binding, when first needed
later
output.write("third")
// expect: third
// end: completed
