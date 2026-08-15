// Rung 1, scene 3 — the negative claims: what code DOESN'T do.
// A function declares the categories of side effects it may produce;
// the analyzer infers the actual set from the primitives transitively
// called and verifies declared ⊇ inferred. Under-promising halts the
// build — you cannot ship an effect you didn't declare.
use effects

// No declaration: the set is inferred and visible in `allegro inspect`
// (`effects: pure (inferred)`).
square(x) => x * x
print(square(7))                      // expect: 49

// `print` is tagged `io` by the standard library; the inference is
// transitive, so callers of loud() inherit io too.
loud(msg) =>
  effects io
  print(msg)
  msg
loud("declared and verified")         // expect: declared and verified

// Over-promising is safe (declared ⊇ inferred holds).
maybe_log(msg) =>
  effects io
  msg.length
print(maybe_log("hi"))                // expect: 2

// Under-promising is refused. Uncomment to halt the build:
//
//   sneaky(x) =>
//     effects pure
//     print(x)
//     x
//
//   → effects declaration check failed:
//     effects mismatch in sneaky: declared `pure`, inferred `io`
//     (undeclared: io)
//
// See transcripts/03-broken.txt for the captured output.
print("no undeclared effects")        // expect: no undeclared effects
