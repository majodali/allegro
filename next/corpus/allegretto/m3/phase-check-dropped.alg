// Under check alone a false claim written after a dropped statement that
// calls the capability is not refuted: it waits. The write's value is
// dropped, so the write stands for a claim that its answer is no failure
// ("Failures" of next/ext/allegretto/forms.md). A claim holds every
// statement after it until it is decided ("Bindings and blocks"). The
// write's answer never comes, since no phase supplies the capability, so
// the false claim stays held, and the run ends waiting.
// This is how much check decides today: a claim written after such a
// statement is not decided under check. It is a finding for the
// maintainer.
// The claim calls a recursive function. A claim with no such call, as
// `claim(2 + 2 == 5)`, is refuted here on both kernel variants: the
// kernel evaluates it ahead of the hold. The forms do not say that.
capability output
sum(n) => if n == 0 then 0 else n + sum(n - 1)
output.write("hello")
claim(sum(2) == 4)
// phases: check
// end: waiting: the program waits on the capability(ies) output, which no phase supplies
// summary: undecided
