// A set of whole numbers, written in Allegretto: a map that stores `true`
// under each member (next/ext/lib/map.alg).
//
// Whose: the kernel stream (lane R).

import map

export empty = map.empty

// The set s with k in it.
export with_member(s, k) => map.store(s, k, true)

// True where k is in s.
export has(s, k) => map.holds(s, k)

// How many members s has.
export size(s) => map.size(s)
