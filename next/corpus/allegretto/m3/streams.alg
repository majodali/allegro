// A stream is a structure of an item and a rest, [] where it ends, or a
// failure in place of either (next/ext/allegretto/forms.md §2, "Streams").
// Its rest is evaluated when read. each, each_at_once, each_within and
// all are Allegretto's four functions for iteration.
capability output
from(n, last) => if n > last then [] else {item: n, rest: from(n + 1, last)}
show(n) => output.write(int.text(n))
done <- each(from(1, 3), show)
// expect: 1
// expect: 2
// expect: 3
output.write(if count(done) == 0 then "each answers []" else "each answers something else")
// expect: each answers []
broken = {item: 7, rest: {failure: `source_closed}}
ended <- each(broken, show)
// expect: 7
output.write(if is_failure(ended) then "ended in " ++ spelling(ended.failure) else "ended normally")
// expect: ended in source_closed
each_at_once(from(4, 5), show)
// expect: 4
// expect: 5
each_within(from(6, 9), 2, show)
// expect: 6
// expect: 7
// expect: 8
// expect: 9
both = all([from(1, 2).item + 10, 20])
output.write(int.text(both[0] + both[1]))
// expect: 31
// end: completed
