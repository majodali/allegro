// Recursion, on today's kernel: each function of a recursive group takes
// the group's functions first (next/bootstrap/first-notation.md §4).

// A function that calls itself, with an effect before the call.
tick(again) =>
  print("tick")
  if again then tick(false) else print("done")
tick(true)
// expect: tick
// expect: tick
// expect: done

// Two functions that call each other.
ping(again) => if again then pong(false) else "ping ends"
pong(again) => if again then ping(false) else "pong ends"
print(ping(true))
// expect: pong ends
print(pong(true))
// expect: ping ends
