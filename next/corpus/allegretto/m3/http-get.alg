// http.request answers late with plain data (next/launch/http.ts): the
// structure {status, headers, body}, the body the bytes received. The
// runner's transport serves the one request this program makes.
capability output
capability http
page <- http.request({method: "GET", url: "https://example.org/hello"})
output.write(int.text(page.status))
output.write(page.body)
// serves: GET https://example.org/hello = 200 "hello, world"
// expect: 200
// expect: hello, world
// end: completed
