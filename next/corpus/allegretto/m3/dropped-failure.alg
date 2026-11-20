// A statement whose value is dropped stands for a claim that the value is
// no failure (next/ext/allegretto/forms.md §2, "Failures"). The line
// lookup(xs, 5) answers a failure, so its claim is refuted and nothing
// written after it happens. A failure looked at, as the first lookup's,
// is the program's own.
capability output
lookup(xs, i) => if i < count(xs) then xs[i] else {failure: `missing, place: i}
xs = ["a", "b"]
output.write(lookup(xs, 1))
// expect: b
seen <- lookup(xs, 7)
output.write(if is_failure(seen) then "a failure, looked at" else "a value")
// expect: a failure, looked at
lookup(xs, 5)
output.write("never printed")
// end: refuted: a claim that is not true
