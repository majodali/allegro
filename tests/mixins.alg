// Mixin tests

// Basic mixin: add a method to a record type
Point = Int.extend({x: Int, y: Int}).mixin({magnitude: (self) => self.x * self.x + self.y * self.y})
p = Point(3, 4)
print(p.magnitude()) // expect: 25
print(p.x) // expect: 3

// Mixin with multiple methods
Vec = Int.extend({x: Int, y: Int}).mixin({sum: (self) => self.x + self.y, diff: (self) => self.x - self.y})
v = Vec(10, 3)
print(v.sum()) // expect: 13
print(v.diff()) // expect: 7

// Mixin method with extra args
Shape = Int.extend({x: Int, y: Int}).mixin({translate: (self, dx, dy) => Shape(self.x + dx, self.y + dy)})
s = Shape(1, 2)
s2 = s.translate(10, 20)
print(s2.x) // expect: 11
print(s2.y) // expect: 22

// Reusable mixin spec
magMixin = {mag: (self) => self.x * self.x + self.y * self.y}
A = Int.extend({x: Int, y: Int}).mixin(magMixin)
B = Int.extend({x: Int, y: Int}).mixin(magMixin)
print(A(5, 12).mag()) // expect: 169
print(B(8, 15).mag()) // expect: 289
