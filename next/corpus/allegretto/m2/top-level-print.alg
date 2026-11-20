// realises: test:effects:Stage F3a: top-level print fires immediately (not in compile-mode)
// A top-level call on the output capability writes when the module is
// run, once: 99. print is the output capability's write.
capability output
output.write(int.text(99))
// expect: 99
// end: completed
