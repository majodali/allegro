// A plain block against a sync block (next/ext/allegretto/forms.md §2,
// "Bindings and blocks"). Both wait on the input late, which a later phase
// supplies. The plain block's statements are a chain of also: the line
// after its arrow does not wait for the arrow's value. The sync block's are
// a chain of then: each is over before the next is started, so its line
// after the arrow waits for late.
capability output
input late
plain() =>
  n <- late
  output.write("plain: not held by the arrow")
  n
synced() => sync
  n <- late
  output.write("sync: held until the arrow's value is known")
  n
a <- plain()
output.write("the module goes on")
// expect: plain: not held by the arrow
// expect: the module goes on
b <- synced()
output.write("both: " ++ a ++ ", " ++ b)
// later: late = "late"
// expect: sync: held until the arrow's value is known
// expect: both: late, late
// end: completed
