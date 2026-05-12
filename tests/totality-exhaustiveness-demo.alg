// Phase E Stage 1: exhaustiveness check for `when/is/then`.
//
// The analyzer walks function bodies looking for `when` chains. Bool is the
// highest-signal finite type — missing `true` or `false` cases get a
// `totality-exhaustiveness` notification (severity `info`; per-project config
// can promote to error). Uncountable types (Int, String) without an `is _`
// or `else` get a generic missing-fallback note. Functions marked `partial`
// skip the check entirely.

use totality

// Non-exhaustive Bool — fires `totality-exhaustiveness`.
yes_only(b: Bool): String =>
  when b is true then "yes"

// Total: both `true` and `false` covered.
both_bool(b: Bool): String =>
  when b
    is true then "yes"
    is false then "no"

// Total: explicit else.
with_else(b: Bool): String =>
  when b is true then "yes" else "no"

// Total: wildcard pattern.
with_wildcard(b: Bool): String =>
  when b
    is true then "yes"
    is _ then "other"

// Non-exhaustive over uncountable Int — fires generic note.
int_partial(n: Int): String =>
  when n is 0 then "zero"

// Opt-out: even though non-exhaustive, no notification fires.
explicitly_partial(b: Bool): String =>
  partial
  when b is true then "yes"

// Runtime behaviour unchanged — these all evaluate normally.
print(both_bool(true))             // expect: yes
print(both_bool(false))            // expect: no
print(with_else(true))             // expect: yes
print(with_else(false))            // expect: no
print(with_wildcard(true))         // expect: yes
print(with_wildcard(false))        // expect: other
