// each_within(s, n, f) over a stream whose items each wait
// (next/ext/allegretto/forms.md §2, "Streams"): f on each item, at most
// two at once, and the oldest is waited for before another is started.
// 30 and 10 start at once. 10 ends first, and 5 still waits for 30, the
// oldest. Then 20 starts once 10, now the oldest, is over.
capability output
capability timer
items(xs, i) => if i == count(xs) then [] else {item: xs[i], rest: items(xs, i + 1)}
show(n) => output.write("waited " ++ int.text(timer.wait(n)))
done <- each_within(items([30, 10, 5, 20], 0), 2, show)
// expect: waited 10
// expect: waited 30
// expect: waited 5
// expect: waited 20
// end: completed
