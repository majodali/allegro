// realises: test:language:reactive: applyPhase triggers dependent re-evaluation
// A binding that waits on the input config is evaluated again when config
// arrives in a later phase, and gives 99.
capability output
input config
result = config
output.write(int.text(result))
// later: config = 99
// expect: 99
// end: completed
