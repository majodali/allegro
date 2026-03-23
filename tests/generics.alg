// Allegro Standard - Generics Tests

// Array[Int] type annotation
sum(arr: Array[Int]): Int => arr.reduce((a: Int, x: Int) => a + x, 0)
print(sum([1, 2, 3, 4, 5]))
// expect: 15

// Bare Array annotation
len(arr: Array) => arr.length
print(len([10, 20, 30]))
// expect: 3

// Array[Int] with map
doubled = [1, 2, 3].map(x => x * 2)
print(doubled[0])
// expect: 2
print(doubled[2])
// expect: 6

// Array[String] with filter
names = ["alice", "bob", "charlie", "dave"]
long_names = names.filter(n => n.length > 3)
print(long_names.length)
// expect: 3

// Nested: array of arrays
matrix = [[1, 2], [3, 4]]
print(matrix[0][1])
// expect: 2

print(matrix[1][0])
// expect: 3
