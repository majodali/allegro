// A test that makes a request and handles the failure. Nothing serves the
// request, so the answer is the failure unreachable. The test handles it,
// prints that it did, and passes.
capability output
capability http
export unreachable() =>
  r <- http.request({method: "GET", url: "https://nowhere.example/"})
  shown <- handle(r, `unreachable, f => "handled: unreachable")
  output.write(shown)
  claim(is_failure(r))
// phases: test
// expect: handled: unreachable
// test: unreachable: passed
// end: completed
