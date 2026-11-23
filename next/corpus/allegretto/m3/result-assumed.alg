// An assumption is taken on trust and not evaluated (next/ext/allegretto/forms.md
// §2, "Control and claims"). The claim that stands for the dropped statement
// rests on it, so it is assumed. Every other claim of the run is decided,
// and the summary, the weakest strength among the claims, is assumed.
capability output
sum(n) => if n == 0 then 0 else n + sum(n - 1)
claim(sum(3) == 6)
assume(sum(1000000) == 500000500000)
output.write("after the assumption")
// expect: after the assumption
// end: completed
// summary: assumed
// The assumed claim is the one the dropped statement on line 8 stands for.
// claim at: 7:1 decided
// claim at: 8:1 assumed
