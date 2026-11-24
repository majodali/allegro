// A test that waits on the timer. Under a test phase the timer runs on a
// clock that moves itself, so the wait of a day ends at once. The test is
// advanced as a run is, until its evaluation is over, and passes.
capability output
capability timer
export waits() =>
  t <- timer.wait(86400000)
  output.write("a day later")
  claim(t == 86400000)
// phases: test
// expect: a day later
// test: waits: passed
// end: completed
