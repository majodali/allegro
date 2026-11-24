// A test module whose tests print. The runner collects every line, the
// load's and each test's, in order. The commands print none of them for
// a test that passes, and print each line of a test that did not
// complete under its line, indented by two spaces.
capability output
output.write("loading")
export quiet() =>
  output.write("from a passing test")
  claim(1 == 1)
export loud() =>
  output.write("from a failing test")
  output.write("its second line")
  claim(1 == 2)
// phases: test
// expect: loading
// expect: from a passing test
// expect: from a failing test
// expect: its second line
// test: quiet: passed
// test: loud: refuted: a claim that is not true
// end: refuted: a claim that is not true
