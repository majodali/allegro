// The work of the argument that loses in first is dropped
// (next/ext/allegretto/forms.md §4, item 13): its effect is never
// performed. Both arguments wait and then write; only the earlier one
// writes.
capability output
capability timer
fast() => then(timer.wait(10), output.write("the fast one writes"))
slow() => then(timer.wait(20), output.write("the slow one writes"))
done <- first(slow(), fast())
after <- then(done, output.write("first is over"))
// expect: the fast one writes
// expect: first is over
// end: completed
