// Imported by main.alg: a module whose top level waits on the timer. Its
// line that uses probe waits until the timer answers.
capability output
capability timer
probe <- timer.wait(1)
filled <- output.write("asyncmod: probe is filled with " ++ int.text(probe))
export answer = 42
