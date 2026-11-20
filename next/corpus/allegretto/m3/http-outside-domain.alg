// A value outside http.request's domain is a refutation with the part's
// reason (next/launch/http.ts; next/ext/allegretto/forms.md §1): here a
// request with no url. Nothing is asked.
capability output
capability http
output.write("before")
http.request({method: "GET"})
output.write("never printed")
// expect: before
// end: refuted: http.request takes a structure with an entry url; this one has none
