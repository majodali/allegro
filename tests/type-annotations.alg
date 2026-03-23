// Allegro Standard - Type Annotation Tests

// Named function with typed params
add(x: Int, y: Int) => x + y
print(add(3, 4))
// expect: 7

// Named function with return type
double(x: Int): Int => x * 2
print(double(21))
// expect: 42

// Typed params with String
greet(name: String): String => "Hello, " + name
print(greet("World"))
// expect: Hello, World

// Lambda with typed params
mul = (x: Int, y: Int) => x * y
print(mul(6, 7))
// expect: 42

// Single-param typed lambda in higher-order context
nums = [1, 2, 3, 4, 5]
doubled = nums.map(x: Int => x * 2)
print(doubled[0])
// expect: 2
print(doubled[4])
// expect: 10

// Typed factorial
factorial(n: Int): Int => if n == 0 then 1 else n * factorial(n - 1)
print(factorial(6))
// expect: 720

// Mixed: untyped function still works alongside typed ones
identity(x) => x
print(identity(99))
// expect: 99
