// first(a, b) (next/ext/allegretto/forms.md §4, item 13): it starts both
// and gives the value of whichever is known first. The shorter wait is
// known first, whichever is written first. A value known at once wins
// over one that waits.
capability output
capability timer
a <- first(timer.wait(30), timer.wait(10))
b <- first(timer.wait(5), timer.wait(20))
c <- first(7, timer.wait(40))
output.write("at once: " ++ int.text(c))
shown <- output.write("earlier of 30 and 10: " ++ int.text(a))
also_shown <- output.write("earlier of 5 and 20: " ++ int.text(b))
// expect: at once: 7
// expect: earlier of 5 and 20: 5
// expect: earlier of 30 and 10: 10
// end: completed
