// The logical operators of the present tree's src/test/types-core.ts and
// src/test/types-construction.ts. Each truth value is printed as "true" or
// "false", as the present printer shows a Bool and as the present 1 or 0
// reads.
// realises: test:types-core:logical: true && false
// realises: test:types-core:logical: false && true (short-circuit)
// realises: test:types-core:logical: true || false
// realises: test:types-core:logical: false || true
// realises: test:types-core:logical: false || false
// realises: test:types-core:logical: !true
// realises: test:types-core:logical: !false
// realises: test:types-core:logical: comparison with &&
// realises: test:types-core:logical: comparison with ||
// realises: test:types-construction:refinement: logical AND still works for bools
// realises: test:types-construction:refinement: logical AND short-circuits
capability output
show(b) => output.write(if b then "true" else "false")
show(true && false)
// expect: false
show(false && true)
// expect: false
show(true || false)
// expect: true
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
show(3 > 100 || 5 < 10)
// expect: true
show(true && true)
// expect: true
// end: completed
