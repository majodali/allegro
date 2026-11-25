// The kernel's sample, by its name: a claim evaluated on the cases it is
// given. True of each, it comes out sampled, the summary's word between
// assumed and decided (next/kernel/kernel.ts). The emitter writes it as
// it writes the other kernel names, by the maintainer's ruling of
// 2026-11-25.
capability output
double(n) => n + n
claim(double(2) == 4)
claim(sample(n => double(n) == n * 2, [0, 1, 7, -3]))
output.write("sampled on four cases")
// expect: sampled on four cases
// end: completed
// summary: sampled
// claim at: 8:1 decided
// claim at: 9:1 sampled
