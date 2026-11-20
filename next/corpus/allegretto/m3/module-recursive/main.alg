// realises: test:modules:module: recursive function in module
// A recursive function of an imported module: factorial(5) is 120.
capability output
import math
output.write(int.text(math.factorial(5)))
// expect: 120
// end: completed
