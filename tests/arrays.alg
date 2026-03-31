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

// =============================================================================
// Recursive array algorithms (proving the language works)
// =============================================================================

// Recursive map
myMap(arr, f) => if arr.length == 0 then [] else [f(arr[0])].concat(myMap(arr.slice(1), f))

tripled = myMap([1, 2, 3], x => x * 3)
print(tripled[0])
// expect: 3
print(tripled[2])
// expect: 9

// Recursive filter
myFilter(arr, pred) => if arr.length == 0 then [] else if pred(arr[0]) then [arr[0]].concat(myFilter(arr.slice(1), pred)) else myFilter(arr.slice(1), pred)

odds = myFilter([1, 2, 3, 4, 5], x => x % 2 != 0)
print(odds.length)
// expect: 3
print(odds[0])
// expect: 1
print(odds[2])
// expect: 5

// Recursive reduce (tail-recursive)
myReduce(arr, f, acc) => if arr.length == 0 then acc else myReduce(arr.slice(1), f, f(acc, arr[0]))

mySum = myReduce([1, 2, 3, 4, 5], (a, b) => a + b, 0)
print(mySum)
// expect: 15

myProduct = myReduce([1, 2, 3, 4, 5], (a, b) => a * b, 1)
print(myProduct)
// expect: 120

// =============================================================================
// Working with objects in arrays
// =============================================================================

people = [{name: "Alice", age: 30}, {name: "Bob", age: 25}, {name: "Carol", age: 35}]

pnames = people.map(p => p.name)
print(pnames[0])
// expect: Alice
print(pnames[1])
// expect: Bob

totalAge = people.reduce((acc, p) => acc + p.age, 0)
print(totalAge)
// expect: 90

seniors = people.filter(p => p.age >= 30)
print(seniors.length)
// expect: 2

// =============================================================================
// Pattern matching with arrays
// =============================================================================

describeLen(len) => when len
  is 0 then "empty"
  is 1 then "singleton"
  is _ then "other"

print(describeLen(0))
// expect: empty
print(describeLen(1))
// expect: singleton
print(describeLen(5))
// expect: other

// =============================================================================
// Error handling with arrays
// =============================================================================

safeGet(arr, idx) => if idx >= 0 and idx < arr.length then arr[idx] else error "index out of bounds"

print(safeGet([10, 20, 30], 1))
// expect: 20
badResult = safeGet([10, 20, 30], 10)
print(error of badResult)
// expect: index out of bounds
