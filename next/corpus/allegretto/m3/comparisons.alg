// The comparisons of the present tree's src/test/base.ts,
// src/test/grammar2-language.ts and src/test/types-core.ts. The present
// tree gives 1 or 0; each truth value is printed as "true" or "false".
// realises: test:base:equality true
// realises: test:base:equality false
// realises: test:base:inequality
// realises: test:base:less than
// realises: test:base:greater than
// realises: test:base:less than or equal
// realises: test:base:greater than or equal
// realises: test:grammar2-language:grammar2/base: comparison returns bits
// realises: test:types-core:logical: != operator works
capability output
show(b) => output.write(if b then "true" else "false")
show(1 == 1)
// expect: true
show(1 == 2)
// expect: false
show(1 != 2)
// expect: true
show(3 < 5)
// expect: true
show(5 < 3)
// expect: false
show(5 > 3)
// expect: true
show(3 > 5)
// expect: false
show(3 <= 3)
// expect: true
show(4 <= 3)
// expect: false
show(3 >= 3)
// expect: true
show(2 >= 3)
// expect: false
show(3 == 3)
// expect: true
show(3 != 4)
// expect: true
show(3 != 3)
// expect: false
// end: completed
