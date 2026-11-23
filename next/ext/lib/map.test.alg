// Tests of next/ext/lib/map.alg. Each claim is an assertion; the test
// passes where every claim is decided.
capability output
import map

m0 = map.empty
m1 = map.store(m0, 0, "zero")
m2 = map.store(m1, 5, "five")
m3 = map.store(m2, 1000000, "million")
m4 = map.store(m3, 5, "FIVE")

// The empty map holds nothing.
claim(count(map.find(m0, 0)) == 0)
claim(map.size(m0) == 0)
claim(!map.holds(m0, 7))

// A value stored is found, under its key and no other.
claim(map.find(m1, 0)[0] == "zero")
claim(count(map.find(m1, 1)) == 0)
claim(map.find(m3, 5)[0] == "five")
claim(map.find(m3, 1000000)[0] == "million")
claim(count(map.find(m3, 999999)) == 0)
claim(map.size(m3) == 3)

// Storing makes a new map: the old one is as it was.
claim(map.size(m1) == 1)
claim(!map.holds(m1, 5))
claim(map.find(m2, 5)[0] == "five")

// A value stored under a key that holds one takes its place.
claim(map.find(m4, 5)[0] == "FIVE")
claim(map.size(m4) == 3)

// find_or gives the other value where nothing is stored.
claim(map.find_or(m3, 5, "none") == "five")
claim(map.find_or(m3, 6, "none") == "none")

// Many keys: the squares of 0 to 199, stored and read back.
fill(m, n) => if n == 0 then m else fill(map.store(m, n - 1, (n - 1) * (n - 1)), n - 1)
check(m, n) => if n == 0 then true else (map.find(m, n - 1)[0] == (n - 1) * (n - 1)) && check(m, n - 1)
squares = fill(map.empty, 200)
claim(map.size(squares) == 200)
claim(check(squares, 200))

output.write("map: ok")
// expect: map: ok
// end: completed
// summary: decided
