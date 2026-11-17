// realises: test:boundary-tests:structure kind (C4.1): future cells stay the sanctioned monotonic exception (D22 carve-out)
// An input not supplied at the start is a cell. It is filled once, when a
// later phase supplies it, and z reads what it was filled with: 3.
capability output
input cfg
z = cfg
// later: cfg = 3
output.write(int.text(z))
// expect: 3
// end: completed
