// Demo: Phase B refinement propagation.
//
// `PositiveInt` is a refined Int. When we do arithmetic on a PositiveInt
// value, the compiler propagates the abstract domain to the result — so the
// introspection summary shows inferred invariants on downstream values
// without any annotation from the user.

PositiveInt = Int && _ > 0

x = PositiveInt(5)     // domain: ≥ 1 (attached on construction)
y = x + 3              // domain: ≥ 4
z = y * 2              // domain: ≥ 8

print(x)               // expect: 5
print(y)               // expect: 8
print(z)               // expect: 16
