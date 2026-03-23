// Allegro Standard - Array Tests
// Tests array literals, bracket access, and higher-order methods.

// Empty array
empty = []
print(empty.length)
// expect: 0

// Array literal
nums = [10, 20, 30, 40, 50]
print(nums.length)
// expect: 5

// Bracket access
print(nums[0])
// expect: 10

print(nums[4])
// expect: 50

// Array slice
print([1, 2, 3, 4, 5].slice(1, 3).length)
// expect: 2

// Map - double each element
doubled = [1, 2, 3].map(x => x * 2)
print(doubled[0])
// expect: 2
print(doubled[1])
// expect: 4
print(doubled[2])
// expect: 6

// Filter - keep elements > 3
big = [1, 2, 3, 4, 5].filter(x => x > 3)
print(big.length)
// expect: 2
print(big[0])
// expect: 4

// Reduce - sum
total = [1, 2, 3, 4, 5].reduce((acc, x) => acc + x, 0)
print(total)
// expect: 15

// Chained operations
result = [1, 2, 3, 4, 5, 6].filter(x => x > 2).map(x => x * 10)
print(result[0])
// expect: 30
print(result.length)
// expect: 4

// Array of strings
names = ["alice", "bob", "charlie"]
print(names[1])
// expect: bob

// Nested function with array
square(x) => x * x
squares = [1, 2, 3, 4].map(square)
print(squares[3])
// expect: 16
