// A request with headers and a body. The served answer depends on
// nothing the request carries; the test of next/corpus/allegretto.test.ts
// reads what the runner's transport was handed, and finds both headers,
// in order, and the body's bytes.
capability output
capability http
stored <- http.request({
  method: "POST",
  url: "https://example.org/notes",
  headers: [["content-type", "text/plain"], ["x-trace", "7"]],
  body: "a note"
})
output.write(int.text(stored.status) ++ " " ++ stored.body)
// serves: POST https://example.org/notes = 201 "stored"
// expect: 201 stored
// end: completed
