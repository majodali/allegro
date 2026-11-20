// all(xs) (next/ext/allegretto/forms.md §2, "Streams"): it starts every
// entry of the list and waits for all of them; its value is xs. The
// entries print in the order their waits fall due, and the line that
// uses the value of all prints after the last.
capability output
capability timer
show(n) => output.write("waited " ++ int.text(timer.wait(n)))
done <- all([show(30), show(10), show(20)])
after <- output.write("all is over: " ++ int.text(count(done)) ++ " entries")
output.write("all three are started")
// expect: all three are started
// expect: waited 10
// expect: waited 20
// expect: waited 30
// expect: all is over: 3 entries
// end: completed
