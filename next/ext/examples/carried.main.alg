// "A notation a text uses can only add": what a text meant before a
// `use`, it means after it.
//
// Without the notation the three lines below are one sum, 1 + 2,
// carried over. With a sign `+` before an operand they would be a block
// of two lines, and `total` would be 2 with nothing said: the grammar
// reads a body as a carried expression only where no block can be read,
// so the old reading is not beside the new one, it is gone. Each line
// after a `use` is read in the grammar before it as well, and this one
// is refused, with both readings.
capability output
use plus.signs
total =
  1
  + 2
output.write(int.text(total))
// refused: the line that ends at 15:6 reads one way before the change of the grammar and another after it.
