// Method-member tests (C6.1b: the mixin surface is `define` — method-valued
// spec entries add implementations; reusable mixins are BUNDLE types drawn
// alongside other bundles)

// Basic: a method-valued spec entry on a record type
Point = Type.define({x: Int, y: Int, magnitude: (self) => self.x * self.x + self.y * self.y}, Int)
p = Point(3, 4)
print(p.magnitude()) // expect: 25
print(p.x) // expect: 3

// Multiple methods
Vec = Type.define({x: Int, y: Int, sum: (self) => self.x + self.y, diff: (self) => self.x - self.y}, Int)
v = Vec(10, 3)
print(v.sum()) // expect: 13
print(v.diff()) // expect: 7

// Method with extra args
Shape = Type.define({x: Int, y: Int, translate: (self, dx, dy) => Shape(self.x + dx, self.y + dy)}, Int)
s = Shape(1, 2)
s2 = s.translate(10, 20)
print(s2.x) // expect: 11
print(s2.y) // expect: 22

// Reusable mixin: a methods-only define mints a BUNDLE, drawn like any other
MagMixin = Type.define({mag: (self) => self.x * self.x + self.y * self.y})
A = Type.define({x: Int, y: Int}, Int, MagMixin)
B = Type.define({x: Int, y: Int}, Int, MagMixin)
print(A(5, 12).mag()) // expect: 169
print(B(8, 15).mag()) // expect: 289
