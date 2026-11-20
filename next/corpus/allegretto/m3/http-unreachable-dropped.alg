// The same failure with nothing handling it. A statement whose value is
// dropped stands for a claim that the value is no failure
// (next/ext/allegretto/forms.md §2, "Failures"), so the request holds the
// line after it, and the claim is refuted when the failure arrives.
capability output
capability http
output.write("before")
http.request({method: "GET", url: "https://nowhere.example/"})
output.write("never printed")
// expect: before
// end: refuted: a claim that is not true
