// Under check alone a statement bound with `<-` holds nothing ("Bindings
// and blocks" of next/ext/allegretto/forms.md). Its write waits on the
// capability, which is not yet given under check, and the false claim on
// the next line is refuted all the same. Nothing is printed.
capability output
shown <- output.write("hello")
claim(2 + 2 == 5)
// phases: check
// end: refuted: a claim that is not true
// summary: refuted
