// A - written before a fraction is part of the literal
// (next/ext/allegretto/forms.md §2, "Values"): -1.5 is the fraction, and
// -0.0 is negative zero, whose bits differ from those of 0.0. Before
// anything but a number written out, prefix - is int.neg, so a fraction
// held by a name is negated with float.neg.
capability output
yes(b) => if b then "true" else "false"
output.write(float.text(-1.5))
// expect: -1.5
output.write(float.text(float.add(-1.5, 2.0)))
// expect: 0.5
x = 1.5
output.write(float.text(float.neg(x)))
// expect: -1.5
output.write(yes(-0.0 == 0.0) ++ " " ++ yes(float.eq(-0.0, 0.0)) ++ " " ++ yes(-0.0 == float.neg(0.0)))
// expect: false true true
// end: completed
