// A text with no interpolation is unchanged, from the present tree's
// src/test/types-battery.ts. Allegretto has no interpolation, so the text
// is the text written.
// realises: test:types-battery:interpolation: no interpolation is unchanged
capability output
output.write("plain string")
// expect: plain string
// end: completed
