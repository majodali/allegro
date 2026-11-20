// The least integer, -9223372036854775808 (the hand-off of PR #260): the
// reader reads prefix - on the whole number 2^63 as that integer, which no
// other text can write. Arithmetic on it wraps.
capability output
least = -9223372036854775808
output.write(int.text(least))
// expect: -9223372036854775808
output.write(int.text(least - 1))
// expect: 9223372036854775807
output.write(int.text(-least))
// expect: -9223372036854775808
// end: completed
