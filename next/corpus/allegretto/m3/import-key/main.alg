// A module hands out a key by binding it and exporting the binding
// (forms.md §4, "Keys and private entries"). With it, the importing
// module reads the private entry of a structure the imported module
// made. The private entry is not counted.
capability output
import box
b = box.make(21)
output.write(int.text(count(b)))
// expect: 1
output.write(int.text(b[box.opener]))
// expect: 42
// end: completed
