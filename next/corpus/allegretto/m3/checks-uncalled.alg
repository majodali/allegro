// A false claim in a function nothing calls. The shipped checks go into
// a function nothing calls for every argument, by default (uncalled on),
// so the claim is refuted in the broader analysis, and the check ends the
// launch. The finding carries the claim's place.
capability output
unused(n) => claim(1 == 2)
output.write("hello")
// phases: check
// end: refuted: a claim that is not true
// broader claim at: 6:14 refuted
// reports: next/corpus/allegretto/m3/checks-uncalled.alg:6:14: error: a claim of the broader analysis is refuted: a claim that is not true
