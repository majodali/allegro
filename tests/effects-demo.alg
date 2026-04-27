// Phase D1: function-body effect declarations.
//
// Each function may state the categories of side effects it can produce.
// The analyzer infers the actual set from the primitives transitively
// called and verifies the declaration is a superset (under-promising
// is an error).
//
// Effect labels are extension-provided strings, not a fixed enum. Core
// ships only the implicit `pure` (the empty set). The standard library
// registers `io` (alongside `print`), `net` (`fetch`), `time` (`delay`).
// Domain-specific extensions can register their own labels.

use effects

// Inferred-only — no declaration. The Inspect summary shows
// `effects: pure (inferred)`.
greet(name) => "Hello, " + name
print(greet("world"))             // expect: Hello, world

// Inferred-only with `io` (from `print`).
shout(msg) =>
  print(msg)
  msg
shout("loud")                     // expect: loud

// Declared, matches inferred. Summary: `effects: pure (declared, verified)`.
square(x) =>
  effects pure
  x * x
print(square(7))                  // expect: 49

// Declared as a SUPERSET of inferred. The function over-promises about
// what it might do — that's safe (caller plans for io, gets pure).
maybe_log(msg) =>
  effects io
  msg.length
print(maybe_log("hi"))            // expect: 2

// Multiple labels.
flexible(x, y) =>
  effects io, time
  x + y
print(flexible(3, 4))             // expect: 7
