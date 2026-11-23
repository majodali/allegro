// A map from whole numbers to values, written in Allegretto.
//
// Whose: the kernel stream (lane R). What the parser engine stands on:
// it keeps what it has tried in one of these (docs/plans/book-pass.md
// section 10.4).
//
// Allegretto has structures and nothing that is changed in place. So a
// map is a tree, and storing a value makes a new map that shares all of
// the old one but the nodes on the way to the key: about as many small
// structures as the key has binary digits.
//
// A node is {v, l, r}. `v` is [] where the node's own key holds nothing
// and [x] where it holds x. The key 0 is the node itself. Any other key
// k is in the left tree where k - 1 is even and in the right where it is
// odd, under the key (k - 1) / 2 there. The empty map is [].
//
// A key is a whole number from 0. A negative key is refused.

export empty = []

// The map m with x stored under k. What was stored under k before is gone.
export store(m, k, x) => then(claim(k >= 0), stored(m, k, x))

stored(m, k, x) => if count(m) == 0 then stored({v: [], l: [], r: []}, k, x) else stored_in(m, k, x)
stored_in(m, k, x) => if k == 0 then {v: [x], l: m.l, r: m.r} else below(m, k - 1, x)
below(m, j, x) => if j % 2 == 0 then left(m, stored(m.l, j / 2, x)) else right(m, stored(m.r, j / 2, x))
// The new subtree is made before the node that holds it, so no chain of
// work put off grows with the number of values stored.
left(m, l) => then(l, {v: m.v, l: l, r: m.r})
right(m, r) => then(r, {v: m.v, l: m.l, r: r})

// What is stored under k: [x], or [] where nothing is.
export find(m, k) => if count(m) == 0 then [] else found(m, k)
found(m, k) => if k == 0 then m.v else found_below(m, k - 1)
found_below(m, j) => if j % 2 == 0 then find(m.l, j / 2) else find(m.r, j / 2)

// True where something is stored under k.
export holds(m, k) => count(find(m, k)) == 1

// What is stored under k, or `otherwise` where nothing is.
export find_or(m, k, otherwise) => chosen(find(m, k), otherwise)
chosen(f, otherwise) => if count(f) == 1 then f[0] else otherwise

// How many keys hold a value.
export size(m) => if count(m) == 0 then 0 else count(m.v) + size(m.l) + size(m.r)
