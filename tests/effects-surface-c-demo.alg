// Phase D1 Slice 2 Stage D: Surface C `param_effects` body-form.
//
// Surface A puts the effect bound in the param-type slot:
//
//     map_pure(arr: Array[Int], f: pure) =>
//       arr.map(f)
//
// Surface C puts it in a body-form clause, useful when the param has a
// non-trivial type and you don't want to fold the effect into the type
// expression. Both lower to the same Param.predicates entry; both
// enforce at call sites and propagate effects via the inference walker.

use effects

// Surface C — pure-bound callback.
apply_pure(g, x: Int): Int =>
  param_effects g: pure
  g(x)

// Pure callback passes.
print(apply_pure((y: Int): Int => y + 1, 5))     // expect: 6

// Surface C alongside an `effects` declaration on the function itself.
process(arr: Array[Int], f) =>
  effects pure
  param_effects f: pure
  arr.map(f)

print(process([1, 2, 3], (x: Int): Int => x * 2)) // expect: [2, 4, 6]

// Surface C with opaque — universal, anything passes.
forwarder(g, x: Int): Int =>
  param_effects g: opaque
  g(x)

print(forwarder((y: Int): Int => y * 3, 7))      // expect: 21
