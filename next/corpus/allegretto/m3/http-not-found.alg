// Any status the server gives is an answer (next/launch/http.ts): a 404
// is no failure, and the program decides what it means.
capability output
capability http
page <- http.request({method: "GET", url: "https://example.org/missing"})
output.write(int.text(page.status))
output.write(if is_failure(page) then "a failure" else "an answer")
output.write(if page.status == 404 then "not found: " ++ page.body else "found")
// serves: GET https://example.org/missing = 404 "no such page"
// expect: 404
// expect: an answer
// expect: not found: no such page
// end: completed
