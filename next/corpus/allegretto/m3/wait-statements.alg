// Two statements that do not wait for each other
// (next/ext/allegretto/forms.md §2, "Bindings and blocks"). Each binds
// its value, so neither holds the other. Both waits are started at once,
// and the shorter wait prints first. The timer's wait answers the number
// it was given.
capability output
capability timer
slow <- output.write("slow: " ++ int.text(timer.wait(20)))
fast <- output.write("fast: " ++ int.text(timer.wait(10)))
output.write("both are started")
// expect: both are started
// expect: fast: 10
// expect: slow: 20
// end: completed
