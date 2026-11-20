// Two requests whose values are bound do not wait for each other
// (next/ext/allegretto/forms.md §2, "Bindings and blocks"), and a line
// written after them prints first. The runner's transport answers in the
// order the requests were asked.
capability output
capability http
get(u) => http.request({method: "GET", url: u}).body
a <- output.write("a: " ++ get("https://example.org/a"))
b <- output.write("b: " ++ get("https://example.org/b"))
output.write("asked both")
// serves: GET https://example.org/a = 200 "first"
// serves: GET https://example.org/b = 200 "second"
// expect: asked both
// expect: a: first
// expect: b: second
// end: completed
