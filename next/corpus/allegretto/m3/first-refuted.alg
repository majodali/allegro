// A refutation of either argument refutes first at once
// (next/ext/allegretto/forms.md §4, item 13). The division by zero is
// refuted while the other argument still waits.
capability output
capability timer
r <- first(timer.wait(10), 1 / 0)
output.write(int.text(r))
// end: refuted: division by zero
