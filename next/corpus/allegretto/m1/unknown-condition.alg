// realises: test:evaluator:B-172 C1 evaluator: Rule 2 — eval_if at run time with an unresolved condition runs neither branch's effects (gap pin, C2 flipped it, RR3)
// An if whose condition is unknown runs neither branch's effect: nothing
// is printed while c and d are unknown. The condition is an input written
// in the if, and a parameter of branches applied to an input. Both
// branches stay in the residual: each later phase supplies one condition,
// and the branch it selects then prints.
capability output
input c
input d
output.write("the first phase")
// expect: the first phase
if c then output.write("then-ran") else output.write("else-ran")
branches(b) => if b then output.write("then-ran") else output.write("else-ran")
branches(d)
// later: c = true
// expect: then-ran
// later: d = false
// expect: else-ran
// end: completed
