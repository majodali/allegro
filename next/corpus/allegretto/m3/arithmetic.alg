// The integer arithmetic of the present tree's src/test/base.ts, each
// present text printed through int.text. The texts 42, 3 + 4, 3 + 4 * 2,
// (3 + 4) * 2 and 0xFF are also the cases of src/test/grammar2-language.ts
// and src/test/grammar-legacy.ts named below, with the same values.
// realises: test:base:integer literal
// realises: test:base:addition
// realises: test:base:subtraction
// realises: test:base:multiplication
// realises: test:base:division
// realises: test:base:modulo
// realises: test:base:precedence: * before +
// realises: test:base:precedence: parentheses override
// realises: test:base:unary minus
// realises: test:base:negative arithmetic
// realises: test:base:hex literal
// realises: test:base:zero
// realises: test:base:large number
// realises: test:base:deeply nested arithmetic
// realises: test:grammar2-language:grammar2/base: integer literal
// realises: test:grammar2-language:grammar2/base: arithmetic evaluates
// realises: test:grammar2-language:grammar2/base: precedence — mul tighter than add
// realises: test:grammar2-language:grammar2/base: parentheses override precedence
// realises: test:grammar2-language:grammar2/std: hex literal
// realises: test:grammar-legacy:hybrid parser: base syntax
capability output
show(n) => output.write(int.text(n))
show(42)
// expect: 42
show(3 + 4)
// expect: 7
show(10 - 3)
// expect: 7
show(6 * 7)
// expect: 42
show(15 / 3)
// expect: 5
show(17 % 5)
// expect: 2
show(3 + 4 * 2)
// expect: 11
show((3 + 4) * 2)
// expect: 14
show(-5)
// expect: -5
show(0 - 42)
// expect: -42
show(0xFF)
// expect: 255
show(0)
// expect: 0
show(1000000 * 1000)
// expect: 1000000000
show(((1 + 2) * (3 + 4)) + ((5 - 1) * 2))
// expect: 29
// end: completed
