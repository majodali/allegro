// Interface tests — C5.2c (D30): conformance is DECLARED, not accidental.
// An interface check is symbol-identity membership: a type conforms by
// DRAWING the interface's member symbols (extending it binds them), not
// by happening to spell the same member names. The loose duck-typing
// path is `~T` (base-name projection), shown at the bottom.

// Basic interface declaration
Printable = Interface.define({toString: Function})

// Accidental conformance is GONE: Int spells a `toString`, but it never
// declared Printable's symbol.
print(42 instanceof Printable) // expect: false
print("hello" instanceof Printable) // expect: false

// Declared conformance: extending the interface draws its symbols.
HasXY = Interface.define({x: Int, y: Int})
Point = Type.define({x: Int, y: Int}, HasXY)
p = Point(3, 4)
print(p instanceof HasXY) // expect: true
print(p.x + p.y) // expect: 7

// An interface the type never drew stays unsatisfied — even with
// same-named members present.
HasXYZ = Interface.define({x: Int, y: Int, z: Int})
print(p instanceof HasXYZ) // expect: false

// Nonexistent member: still false, declared or loose.
HasFoo = Interface.define({foo: Int})
print(42 instanceof HasFoo) // expect: false

// The LOOSE path: `~T` projects an interface into the base-name world —
// duck-typing for data values (the pre-C5.2c accidental behavior, now
// opt-in and explicit).
is_printable(v: ~Printable) => true
print(is_printable(42)) // expect: true
print(is_printable("hello")) // expect: true
