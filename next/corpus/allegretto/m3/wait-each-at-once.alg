// each_at_once(s, f) over a stream whose items each wait
// (next/ext/allegretto/forms.md §2, "Streams"): f on each item, none
// waiting for another, so the lines print in the order the waits fall
// due.
capability output
capability timer
items(xs, i) => if i == count(xs) then [] else {item: xs[i], rest: items(xs, i + 1)}
show(n) => output.write("waited " ++ int.text(timer.wait(n)))
done <- each_at_once(items([30, 10, 20], 0), show)
output.write("all three are started")
// expect: all three are started
// expect: waited 10
// expect: waited 20
// expect: waited 30
// end: completed
