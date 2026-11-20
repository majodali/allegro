// x <- e is a binding of its block's one group and a statement at its
// place (next/ext/allegretto/forms.md §2, "Failures", the paragraph on
// <-): a binding written before the arrow or after it may use the name.
capability output
input start
before = n * 10
n <- start
after = n + 1
output.write(int.text(after))
// expect: 5
output.write(int.text(before))
// expect: 40
// input: start = 4
// end: completed
