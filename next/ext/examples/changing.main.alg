// The same text with `changing`: the author says the notation is meant
// to change what the rule `prefixed` reads. The lines are not compared,
// and the new reading wins.
capability output
use plus.signs changing prefixed
total =
  1
  + 2
output.write(int.text(total))
// expect: 2
