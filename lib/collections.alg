// Allegro Standard Library — Collections
// Array utilities built on top of the standard Array methods.
// Pure Allegro — no primitives needed.

export range(start, end) => if start >= end then [] else [start].concat(range(start + 1, end))

export zip(a, b) => if a.length == 0 then [] else if b.length == 0 then [] else [{first: a[0], second: b[0]}].concat(zip(a.slice(1), b.slice(1)))

export flatten(arr) => arr.reduce((acc, x) => acc.concat(x), [])

export take(arr, n) => arr.slice(0, n)
export drop(arr, n) => arr.slice(n)
export head(arr) => arr[0]
export tail(arr) => arr.slice(1)
export last(arr) => arr[arr.length - 1]

export reverse(arr) => if arr.length == 0 then [] else reverse(arr.slice(1)).concat([arr[0]])

export sum(arr) => arr.reduce((a, x) => a + x, 0)
export product(arr) => arr.reduce((a, x) => a * x, 1)

export contains(arr, val) => if arr.length == 0 then false else if arr[0] == val then true else contains(arr.slice(1), val)

export indexOf(arr, val) => indexOfHelper(arr, val, 0)

indexOfHelper(arr, val, i) => if i >= arr.length then 0 - 1 else if arr[i] == val then i else indexOfHelper(arr, val, i + 1)
