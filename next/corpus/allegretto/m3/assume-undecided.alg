// assume(x) and undecided(reason) (next/ext/allegretto/forms.md §2,
// "Control and claims"): an assumption is stated and not evaluated, and a
// claim on undecided is done with nothing refuted. What follows each goes
// ahead.
capability output
sum(n) => if n == 0 then 0 else n + sum(n - 1)
assume(sum(1000000) == 500000500000)
output.write("after the assumption")
// expect: after the assumption
claim(undecided("no rule decides this yet"))
output.write("after the undecided claim")
// expect: after the undecided claim
// end: completed
// The undecided claim is the weakest of the two, so the summary is
// undecided.
// summary: undecided
// The undecided claim is the one on line 10; the assumption is on line 7.
// claim at: 7:1 assumed
// claim at: 10:1 undecided
