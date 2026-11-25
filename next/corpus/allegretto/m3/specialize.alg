// The kernel's specialize, by its name: a function's body evaluated with
// its parameters unknown, under a budget of steps, gives a function of the
// same parameters that answers as the original (next/kernel/kernel.ts).
// The emitter writes it as it writes the other kernel names, by the
// maintainer's ruling of 2026-11-25.
capability output
power(base, n) => if n == 0 then 1 else base * power(base, n - 1)
cube(x) => power(x, 3)
fast = specialize(cube, 1000)
output.write(int.text(fast(4)) ++ " " ++ int.text(cube(4)))
// expect: 64 64
// A primitive is given back as it is.
same_add = specialize(int.add, 10)
output.write(int.text(same_add(2, 3)))
// expect: 5
// end: completed
