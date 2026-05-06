// Phase B pilot: a function with a refined return type whose check is
// discharged statically via abstract-domain propagation. No runtime
// predicate evaluation — the compiler proves `≥ 2` implies `≥ 1`.

PositiveInt = Int & _ > 0
double_pos(x: PositiveInt): PositiveInt => x + x

x = PositiveInt(5)
y = double_pos(x)         // domain ≥ 2; PositiveInt return type discharged
z = double_pos(y)         // domain ≥ 4
w = z + 1                 // domain ≥ 5

print(x)            // expect: 5
print(y)            // expect: 10
print(z)            // expect: 20
print(w)            // expect: 21
