// realises: test:boundary-tests:fqn symbols (C5.1): same FQN is the same object — interned identity
// The same spelling is the same symbol, wherever it is written and
// however it is made: written twice, made from a text, and read back as
// the key of a structure's entry. A different spelling is another symbol.
capability output
yes(b) => if b then "true" else "false"
output.write(yes(`draw == `draw))
// expect: true
output.write(yes(symbol("dr" ++ "aw") == `draw))
// expect: true
output.write(yes(key({draw: 1}, 0) == `draw))
// expect: true
output.write(yes(`draw == `drawn))
// expect: false
output.write(spelling(`draw))
// expect: draw
// end: completed
