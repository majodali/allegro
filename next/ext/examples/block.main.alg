// `use` in a block: the notation ends with the block.
capability output
halved(n) =>
  use ratio.fractions
  n :/ 2
output.write(int.text(halved(7).top))
// expect: 7
