// Refinement type tests

// Basic construction
PositiveInt = Int && _ > 0
x = PositiveInt(5)
print(x + 0) // expect: 5

// Compound predicate
SmallPos = Int && _ > 0 && _ < 100
print(SmallPos(50) + 0) // expect: 50

// Out of range fails
bad = SmallPos(200)
print(bad) // expect: error(refinement check failed)

// Function with refined param — bare Int works if predicate passes
double(y: PositiveInt): Int => y * 2
print(double(7)) // expect: 14

// Already-refined value passes short-circuit
z = PositiveInt(3)
print(double(z)) // expect: 6

// preserveOps: lift operators
PI = (Int && _ > 0).preserveOps()
a = PI(5)
b = a + 3
print(b + 0) // expect: 8
print(b instanceof PI) // expect: true

// preserveOps: failing operation produces error
c = a - 10
print(c) // expect: error(refinement check failed)

// .where() fluent API still works
PosInt2 = Int.where(n => n > 0)
print(PosInt2(10) + 0) // expect: 10
