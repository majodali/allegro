// A recursion over a structure, with get and count.
capability output
numbers = [3, 1, 4, 1, 5, 9, 2, 6]
total(xs, i) => if i == count(xs) then 0 else get(xs, i) + total(xs, i + 1)
largest(xs, i, best) =>
  if i == count(xs) then best
  else if get(xs, i) > best then largest(xs, i + 1, get(xs, i))
  else largest(xs, i + 1, best)
output.write(int.text(count(numbers)))
// expect: 8
output.write(int.text(total(numbers, 0)))
// expect: 31
output.write(int.text(largest(numbers, 0, 0)))
// expect: 9
words = ["one", "two", "three"]
joined(xs, i) => if i == count(xs) then "" else get(xs, i) ++ joined(xs, i + 1)
output.write(joined(words, 0))
// expect: onetwothree
// end: completed
