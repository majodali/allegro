// Standard library tests

// === Math module ===
import math
print(math.PI > 3.14) // expect: true
print(math.sqrt(9.0)) // expect: 3
print(math.pow(2.0, 10.0)) // expect: 1024
print(math.abs(0 - 5)) // expect: 5
print(math.floor(3.7)) // expect: 3
print(math.ceil(3.2)) // expect: 4
print(math.round(3.5)) // expect: 4
print(math.min(3, 7)) // expect: 3
print(math.max(3, 7)) // expect: 7
print(math.clamp(15, 0, 10)) // expect: 10
print(math.sign(42)) // expect: 1
print(math.sign(0 - 5)) // expect: -1

// === Functional module ===
import functional
print(functional.identity(42)) // expect: 42
print(functional.constant(99)(0)) // expect: 99
double = x => x * 2
addOne = x => x + 1
doubleThenAdd = functional.compose(addOne, double)
print(doubleThenAdd(5)) // expect: 11
addThenDouble = functional.pipe(addOne, double)
print(addThenDouble(5)) // expect: 12
quadruple = functional.twice(double)
print(quadruple(3)) // expect: 12

// === Collections module ===
import collections
r = collections.range(1, 6)
print(r) // expect: [1, 2, 3, 4, 5]
print(collections.sum(r)) // expect: 15
print(collections.product(collections.range(1, 6))) // expect: 120
print(collections.head(r)) // expect: 1
print(collections.last(r)) // expect: 5
print(collections.reverse(collections.range(1, 4))) // expect: [3, 2, 1]
print(collections.take(r, 3)) // expect: [1, 2, 3]
print(collections.drop(r, 3)) // expect: [4, 5]
print(collections.contains(r, 3)) // expect: true
print(collections.contains(r, 9)) // expect: false
print(collections.flatten([[1, 2], [3, 4]])) // expect: [1, 2, 3, 4]
