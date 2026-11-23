// Tests of next/ext/lib/class.alg.
capability output
import class

word = class.made(class.pairs("azAZ__09"))
digit = class.made(class.pairs("09"))

claim(bits.length(word) == 256)
claim(class.size(class.nothing) == 0)
claim(class.size(class.every) == 256)
claim(class.size(digit) == 10)
claim(class.size(word) == 63)

// 97 is a, 122 is z, 123 is the byte after z, 95 is the underscore.
claim(class.has(word, 97) && class.has(word, 122) && class.has(word, 95))
claim(!class.has(word, 123) && !class.has(word, 96) && !class.has(word, 32))
claim(class.has(digit, 48) && class.has(digit, 57) && !class.has(digit, 58) && !class.has(digit, 47))
// The first byte and the last.
claim(class.has(class.made(class.pairs("\t\t")), 9))
ends = class.made(class.with_range(class.with_range(class.no_ranges, 255, 255), 0, 0))
claim(class.has(ends, 0) && class.has(ends, 255) && class.size(ends) == 2)
// The end of a text, read as -1, belongs to no class.
claim(!class.has(class.every, -1))

// Ranges in any order, overlapping and touching, give the same class as
// the same bytes written once.
mixed = class.made(class.pairs("mzaf09dp55"))
plain = class.made(class.pairs("az09"))
claim(mixed == plain)
// Touching ranges are one: a to m and n to z.
claim(class.made(class.pairs("nzam")) == class.made(class.pairs("az")))
// Both lists of ranges.
claim(class.made(class.both(class.pairs("az"), class.pairs("09__AZ"))) == word)
claim(class.made(class.no_ranges) == class.nothing)
claim(class.made(class.with_range(class.no_ranges, 0, 255)) == class.every)

output.write("class: ok")
// expect: class: ok
// end: completed
// summary: decided
