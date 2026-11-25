// A module that imports another whose claim is refuted. The check
// instantiates lib in the program as written, where the claim over
// lib.half reads it, and lib's false claim is refuted there. The finding
// carries the file, the line and the column of the claim in lib.alg.
capability output
import lib
claim(lib.half(4) == 2)
// phases: check
// end: refuted: a claim that is not true
// reports: next/corpus/allegretto/m3/checks-import/lib.alg:4:1: error: a claim of the program as written is refuted: a claim that is not true
