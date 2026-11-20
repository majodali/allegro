// then(a, b) (next/ext/allegretto/forms.md §2, "Bindings and blocks"): b
// is started when a's value is known and nothing a started still goes
// on. first() gives its value at once and leaves its wait going, so then
// waits for that wait too. The statement after the arrow does not wait.
capability output
capability timer
first() =>
  slow <- output.write("first: " ++ int.text(timer.wait(30)))
  "first gives its value"
pair <- then(first(), output.write("second: " ++ int.text(timer.wait(5))))
output.write("the module goes on")
// expect: the module goes on
// expect: first: 30
// expect: second: 5
// end: completed
