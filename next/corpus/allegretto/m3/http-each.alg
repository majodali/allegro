// each(s, f) over a stream of URLs (next/ext/allegretto/forms.md §2,
// "Streams"): one request at a time. Each call of fetch_one writes that it
// asks, then the answer; the next item is read only once both are over,
// so the asking and the answers alternate.
capability output
capability http
items(xs, i) => if i == count(xs) then [] else {item: xs[i], rest: items(xs, i + 1)}
fetch_one(u) => sync
  output.write("asking " ++ u)
  output.write(u ++ " is " ++ http.request({method: "GET", url: u}).body)
urls = ["https://example.org/1", "https://example.org/2", "https://example.org/3"]
done <- each(items(urls, 0), fetch_one)
output.write(if count(done) == 0 then "each answers []" else "each answers something else")
// serves: GET https://example.org/1 = 200 "one"
// serves: GET https://example.org/2 = 200 "two"
// serves: GET https://example.org/3 = 200 "three"
// expect: asking https://example.org/1
// expect: https://example.org/1 is one
// expect: asking https://example.org/2
// expect: https://example.org/2 is two
// expect: asking https://example.org/3
// expect: https://example.org/3 is three
// expect: each answers []
// end: completed
