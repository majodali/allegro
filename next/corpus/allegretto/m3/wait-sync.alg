// The same two statements in a sync block (next/ext/allegretto/forms.md
// §2, "Bindings and blocks"): each is over before the next is started, so
// they print in written order. The block's caller does not wait for it.
capability output
capability timer
both() => sync
  slow <- output.write("slow: " ++ int.text(timer.wait(20)))
  fast <- output.write("fast: " ++ int.text(timer.wait(10)))
done <- both()
output.write("the module goes on")
// expect: the module goes on
// expect: slow: 20
// expect: fast: 10
// end: completed
