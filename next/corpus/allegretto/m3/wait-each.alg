// each(s, f) over a stream whose items each wait
// (next/ext/allegretto/forms.md §2, "Streams"): f on each item, one at a
// time, so the lines print in the stream's order whatever the waits.
capability output
capability timer
items(xs, i) => if i == count(xs) then [] else {item: xs[i], rest: items(xs, i + 1)}
show(n) => output.write("waited " ++ int.text(timer.wait(n)))
done <- each(items([30, 10, 20], 0), show)
output.write(if count(done) == 0 then "each answers []" else "each answers something else")
// expect: waited 30
// expect: waited 10
// expect: waited 20
// expect: each answers []
// end: completed
