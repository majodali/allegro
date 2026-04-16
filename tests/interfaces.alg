// Interface tests

// Basic interface declaration
Printable = Type.interface({toString: Function})

// Int satisfies Printable (has toString)
print(42 instanceof Printable) // expect: true

// String satisfies Printable (has toString)
print("hello" instanceof Printable) // expect: true

// Interface with length member
Sized = Type.interface({length: Int})
print("hello" instanceof Sized) // expect: true

// Int does NOT have length
print(42 instanceof Sized) // expect: false

// Interface with multiple members
Showable = Type.interface({toString: Function, length: Int})
print("hello" instanceof Showable) // expect: true
print(42 instanceof Showable) // expect: false

// Interface with nonexistent member
HasFoo = Type.interface({foo: Int})
print(42 instanceof HasFoo) // expect: false

// Record type satisfying an interface
HasXY = Type.interface({x: Int, y: Int})
Point = Int.extend({x: Int, y: Int})
p = Point(3, 4)
print(p instanceof HasXY) // expect: true

// Record missing required field doesn't satisfy
HasXYZ = Type.interface({x: Int, y: Int, z: Int})
print(p instanceof HasXYZ) // expect: false
