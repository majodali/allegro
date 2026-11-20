// handle(x, name, handler) on a failure and on a value
// (next/ext/allegretto/forms.md §2, "Failures"): the handler is applied
// to a failure of that name; a value, and a failure of another name, come
// through as they are.
capability output
divide(a, b) => if b == 0 then {failure: `division_by_zero, dividend: a} else a / b
show(r) => if is_failure(r) then "failed: " ++ spelling(r.failure) else int.text(r)
output.write(show(divide(7, 2)))
// expect: 3
output.write(show(divide(7, 0)))
// expect: failed: division_by_zero
output.write(show(handle(divide(7, 0), `division_by_zero, f => 0 - f.dividend)))
// expect: -7
output.write(show(handle(divide(8, 2), `division_by_zero, f => 0)))
// expect: 4
output.write(show(handle({failure: `other}, `division_by_zero, f => 0)))
// expect: failed: other
// end: completed
