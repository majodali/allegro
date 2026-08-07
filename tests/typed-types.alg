// Types are typed values — they carry type information

// Built-in types are instances of NominalType
print(Int instanceof NominalType) // expect: true
print(String instanceof NominalType) // expect: true
print(Bool instanceof NominalType) // expect: true

// Meta-types have their own types
print(NominalType instanceof NominalType) // expect: true

// User-defined types are typed
Point = Type.define({x: Int, y: Int}, Int)
print(Point instanceof NominalType) // expect: true

// Interfaces are structural (Type)
Printable = Interface.define({toString: Function})
print(Printable instanceof Type) // expect: true

// Regular values still work
print(42 instanceof Int) // expect: true
print("hello" instanceof String) // expect: true

// C5.2c: interface conformance is DECLARED (symbol identity) — Int never
// drew Printable's toString symbol, so the accidental match is gone.
print(42 instanceof Printable) // expect: false
