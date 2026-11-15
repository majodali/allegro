// A claim that does not hold refutes the program; nothing after it runs.
print("before")
// expect: before
claim(false)
print("after")
