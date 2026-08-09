// Types are typed values — they carry type information

// Built-in types are instances of Type
print(Int instanceof Type) // expect: true
print(String instanceof Type) // expect: true
print(Bool instanceof Type) // expect: true

// Meta-types have their own types
print(Type instanceof Type) // expect: true

// User-defined types are typed
Point = Type.define({x: Int, y: Int}, Int)
print(Point instanceof Type) // expect: true

// Interfaces are structural (Type)
Printable = Interface.define({toString: Function})
print(Printable instanceof Type) // expect: true

// Regular values still work
print(42 instanceof Int) // expect: true
print("hello" instanceof String) // expect: true

// C5.2c: interface conformance is DECLARED (symbol identity) — Int never
// drew Printable's toString symbol, so the accidental match is gone.
print(42 instanceof Printable) // expect: false
