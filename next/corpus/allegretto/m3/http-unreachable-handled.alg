// A request that gets no answer fills its cell with a failure of the one
// shape, {failure: `unreachable, reason: <a text>} (next/launch/http.ts),
// and handle answers it (next/ext/allegretto/forms.md §2, "Failures").
// No line serves the request, so it is unreachable.
capability output
capability http
page <- http.request({method: "GET", url: "https://nowhere.example/"})
shown <- handle(page, `unreachable, f => {body: "no answer: " ++ f.reason})
output.write(shown.body)
output.write("after")
// expect: no answer: nothing serves GET https://nowhere.example/
// expect: after
// end: completed
