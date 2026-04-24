// Demo: `use grammar { … }` — inline grammar declared in the hosting file,
// no separate module required.

use grammar {
  infix "@@" at(add) left => (l, r) => l * 10 + r
}

// @@ binds at the `+` level, so `1 @@ 2 @@ 3` = ((1 @@ 2) @@ 3) = 123
print(1 @@ 2 @@ 3)      // expect: 123
print(4 @@ 5)            // expect: 45
// 1 + 2 binds at the add level, so `1 + 2 @@ 3` evaluates both @@s first
// (@@ also at add with left assoc): (1 + 2) @@ 3 = 3 @@ 3 = 33.
print(1 + 2 @@ 3)        // expect: 33
