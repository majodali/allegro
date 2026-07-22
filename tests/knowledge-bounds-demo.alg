// Demo: C3.2 (D36) — annotations are knowledge upper-bounds.
//
// A type annotation is an abstraction boundary: `a: Animal` receiving a
// Dog hides Dog's members until narrowed. Member AVAILABILITY follows
// knowledge (an epistemic gate — not S3 access control); DISPATCH
// follows the value's shape. A `when … is T` type
// pattern narrows the occurrence within the matched arm; crossing a
// boundary of the value's own shape restores full knowledge.

Animal = Type.extend({legs: Int})
Dog = Animal.extend({legs: Int, tricks: Int})

// Widening: through `a: Animal`, Animal's members are visible…
count_legs(a: Animal): Int => a.legs
print(count_legs(Dog(4, 7)))
// expect: 4

// …and Dog-only members are hidden until narrowed. A matched type
// pattern lifts the bound within the arm — even for substituted params.
describe(a: Animal): Int => when a is Dog then a.tricks else 0 - 1
print(describe(Dog(4, 9)))
// expect: 9

// Boundary reset: passing the narrowed value across a `d: Dog` boundary
// starts the new occurrence with full knowledge of Dog.
trick_count(d: Dog): Int => d.tricks
via_narrow(a: Animal): Int => when a is Dog then trick_count(a) else 0 - 1
print(via_narrow(Dog(4, 5)))
// expect: 5

// Return annotations are boundaries too: mk's result is Animal-bounded;
// narrowing at the use site restores Dog's members.
mk(): Animal => Dog(2, 3)
a = mk()
print(when a is Dog then a.tricks else 0 - 1)
// expect: 3

// Intrinsic knowledge survives a looser annotation: a PositiveInt passed
// through `x: Int` keeps its certificate (the meet never widens).
PositiveInt = Int & _ > 0
ident(x: Int): Int => x
y = ident(PositiveInt(5))
print(y instanceof PositiveInt)
// expect: true
