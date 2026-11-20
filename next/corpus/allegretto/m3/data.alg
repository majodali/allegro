// The five names for data whose shape the text does not fix
// (next/ext/allegretto/forms.md §2, "Control and claims"): put, key,
// kind, symbol and spelling, with the forms' range, and a structure
// literal with a computed key.
capability output
range(n) => if n == 0 then [] else put(range(n - 1), [], n)
total(xs, i) => if i == count(xs) then 0 else xs[i] + total(xs, i + 1)
output.write(int.text(count(range(5))) ++ " " ++ int.text(total(range(4), 0)))
// expect: 5 10
s = put({a: 1}, `b, 2)
output.write(spelling(key(s, 1)) ++ " " ++ int.text(s.b))
// expect: b 2
replaced = put(s, `a, 9)
output.write(int.text(replaced.a) ++ " " ++ int.text(count(replaced)))
// expect: 9 2
output.write(spelling(kind(s)) ++ " " ++ spelling(kind(1)) ++ " " ++ spelling(kind(`a)) ++ " " ++ spelling(kind(range)))
// expect: structure bits symbol function
output.write(if kind(key(range(1), 0)) == `structure then "an entry with no key" else "a key")
// expect: an entry with no key
computed = {a: 1, [symbol("z" ++ "z")]: 26}
output.write(int.text(computed.zz) ++ " " ++ spelling(key(computed, 1)))
// expect: 26 zz
// end: completed
