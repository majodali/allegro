// Tests of next/ext/lib/set.alg.
capability output
import set

s0 = set.empty
s1 = set.with_member(s0, 3)
s2 = set.with_member(s1, 40)
s3 = set.with_member(s2, 3)

claim(!set.has(s0, 3))
claim(set.has(s1, 3))
claim(!set.has(s1, 40))
claim(set.has(s2, 40) && set.has(s2, 3))
claim(set.size(s2) == 2)
// A member put in twice is in once.
claim(set.size(s3) == 2)

output.write("set: ok")
// expect: set: ok
// end: completed
// summary: decided
