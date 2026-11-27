// "A grammar change reaches to the end of its block": `use` brings a
// notation, by its path from a module, and no bindings. The lines after
// it are read in the grammar the notation changed.
//
// The text imports nothing. It binds the name `ratio` itself, and the
// notation's sign still reads the module's function.
capability output
use ratio.fractions
half = 1 :/ 2
output.write(int.text(half.top) ++ " over " ++ int.text(half.bottom))
ratio = 5
fifth = 1 :/ ratio
output.write(int.text(fifth.bottom))
// expect: 1 over 2
// expect: 5
