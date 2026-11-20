// The example of next/ext/allegretto/forms.md §4, "Keys and private
// entries": a key header line, and a private entry written with the key's
// name in the brackets. The private entry is not counted, and only p[k]
// with the key reads it. A header name is no binding, so the module does
// not yield secret.
capability output
key secret

make(n) => { shown: n, [secret]: n * 2 }
hidden(p) => p[secret]

box = make(21)
output.write(int.text(count(box)))     // 1: the private entry is not counted
// expect: 1
output.write(int.text(hidden(box)))    // 42
// expect: 42
// yields: make, hidden, box
// end: completed
