// The present tree's tests/logical.alg, run end to end by
// src/test/grammar2-language.ts. Each print of a truth value is a show,
// which prints "true" or "false"; a text is printed as it is.
// realises: test:grammar2-language:grammar2/std: logical.alg runs end-to-end
capability output
show(b) => output.write(if b then "true" else "false")
show(true && true)
// expect: true
show(true && false)
// expect: false
show(false && true)
// expect: false
show(false || true)
// expect: true
show(false || false)
// expect: false
show(!true)
// expect: false
show(!false)
// expect: true
show(3 > 1 && 5 < 10)
// expect: true
show(3 > 100 && 5 < 10)
// expect: false
show(3 > 100 || 5 < 10)
// expect: true
show(true && true && true)
// expect: true
show(true && false && true)
// expect: false
show(!(3 > 5))
// expect: true
in_range(x) => x > 0 && x < 10
check(x) => if in_range(x) then "yes" else "no"
output.write(check(5))
// expect: yes
output.write(check(15))
// expect: no
is_b(x) => x == "b"
show(("a" != "b") && is_b("a"))
// expect: false
show(true && is_b("b"))
// expect: true
show(false || is_b("b"))
// expect: true
show(false || is_b("a"))
// expect: false
// end: completed
