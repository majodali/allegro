// Allegro Standard - logical operators over an error value (B-156).
// `&&`, `||` and `!` join the viral rule (ruling R3 (a) of
// docs/plans/pilot-findings.md): an operand carrying an error is the
// result, the left operand first, then the right one when it is
// evaluated. `if` and every eager operator already propagate it.

e = error "why"

// The five rows: each yields the error, and `error of` reads its reason.
print(false || e)
// expect: error(why)
print(error of (false || e))
// expect: why

print(true && e)
// expect: error(why)
print(error of (true && e))
// expect: why

print(e || true)
// expect: error(why)
print(error of (e || true))
// expect: why

print(e && false)
// expect: error(why)
print(error of (e && false))
// expect: why

print(!e)
// expect: error(why)
print(error of (!e))
// expect: why

// For comparison: `if` over an error condition, and an eager operator.
print(if e then 1 else 2)
// expect: error(why)
print(error of (if e then 1 else 2))
// expect: why
print(error of (1 + e))
// expect: why

// The left operand is read first: an error on the left wins over a
// short-circuit that the right operand would never reach.
print(error of (error "left" || error "right"))
// expect: left
print(error of (false || error "right"))
// expect: right

// A refinement predicate written with `||` explains its refusal. The
// predicate's own value is the error; a guarded construction yields it.
// (The annotation path halts with ": -1 is not positive"; the suite pins
// that halt in src/test/types-core.ts.)
pos_ok(x) => x > 0 || error "{x} is not positive"
Pos = Int & pos_ok(_)
print(pos_ok(3))
// expect: true
print(error of pos_ok(0 - 1))
// expect: -1 is not positive
print(error of Pos(0 - 1))
// expect: -1 is not positive
print(Pos(3))
// expect: 3

// The boolean cases still work.
print(true && false)
// expect: false
print(false || true)
// expect: true
print(!false)
// expect: true
