// Imported by main.alg: it declares an input, which main hands with with,
// and the capability output, which main hands by default.
capability output
input name
export greet() => output.write("hello, " ++ name)
