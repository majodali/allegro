// A claim holds every statement after it in its block until it is
// decided (next/ext/allegretto/forms.md §2, "Bindings and blocks"). This
// claim waits on the timer, so the line after it waits too. A line
// started before the claim does not wait for it.
capability output
capability timer
early <- output.write("before the claim: " ++ int.text(timer.wait(5)))
claim(timer.wait(15) == 15)
output.write("after the claim")
// expect: before the claim: 5
// expect: after the claim
// end: completed
