// The four shipped primitives a parser's terminals stand on, by their
// names: text.byte, text.span, text.starts and text.until. Each reads a
// text from a byte position (next/prims/index.ts). The emitter writes them
// as it writes text.int, by the maintainer's ruling of 2026-11-25.
capability output
line = "width = 42;"
digits = "09"
letters = "az"
// The name: the bytes from 0 that are letters.
name_end = text.span(line, 0, letters)
output.write(int.text(name_end))
// expect: 5
// The byte after the name, and minus one at the end of the text.
output.write(int.text(text.byte(line, name_end)) ++ " " ++ int.text(text.byte(line, 11)))
// expect: 32 -1
// Whether " = " follows the name.
output.write(if text.starts(line, name_end, " = ") then "an assignment" else "no assignment")
// expect: an assignment
// The value: the bytes up to the semicolon, and how many of them are digits.
value_at = name_end + 3
output.write(int.text(text.until(line, value_at, ";")) ++ " " ++ int.text(text.span(line, value_at, digits)))
// expect: 2 2
// end: completed
