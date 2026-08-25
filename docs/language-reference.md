# Allegro language reference — syntax by example

> Tier 2 consumable (like `getting-started.md`). The complete surface
> syntax of the base language and Allegro Standard, by example. Lifted
> from the session bootstrap during the K-002 slim (B-095 chunk 3);
> semantics and design rationale live in `docs/design/` — this file is
> the syntax quick-reference. Every construct here is exercised by the
> literate demos in `tests/*.alg` (validated via `// expect:` comments)
> and most are runnable in the sandbox at allegrolang.org.

## Base Parser Syntax

```
// Bindings
x = 42
name = "hello"

// Function declarations
f(x, y) => x + y
factorial(n) => if n == 0 then 1 else n * factorial(n - 1)

// Anonymous functions (lambdas) and closures
x => x * 2
(x, y) => x + y
make_adder(n) => x => x + n

// If-then-else (branches auto-wrapped in thunks)
result = if x > 0 then x else 0 - x

// Operators: + - * / % == != < > <= >=
// Standard precedence, left-associative

// Function calls
print(42)
f(3, 4)

// Indentation blocks (offside rule)
result =
    x = 3
    y = x + 1
    y

// Pattern matching (when/is/then)
result = when x is 42 then "found" else "other"
result = when x
    is 1 then "one"
    is 2 then "two"
    is y then "other: " + y.toString()

// Type destructuring
when shape
    is Object(x, y) then x + y          // nominal: check type, extract fields
    is Object(x: a, y: b) then a + b    // with rename

// Structural destructuring
when point
    is {x, y} then x + y                // match any value with fields x, y
    is {x: a, y: b} then a + b          // with rename

// Nested destructuring (colon introduces sub-pattern)
when shape
    is {center: {x, y}, radius} then x + y + radius

// Guard clauses (and)
when x
    is n and n > 0 then "positive"
    is n and n < 0 then "negative"
    is _ then "zero"

// MultiValue component access (Y of x)
t = type of someValue        // access "type" component
e = error of someValue       // access "error" component (returns none if absent)

// Error values (propagate automatically through operations)
result = error "something went wrong"
result = error "bad" + 5     // error propagates — result is still an error

// Type operators
42 instanceof Int              // → true
"hello" instanceof String      // → true
Refinement subtypeof Type        // → true (kind-hood is conformance to Type)
// C3.3 (D36): instanceof on a refinement is a PURE PREDICATE RE-CHECK from
// data (congruent — `5 instanceof PositiveInt` → true, tagged or not);
// preserveOps types are shapes and stay nominal. The provenance question
// ("was it CONSTRUCTED as T?") is `certificate_peek(v, T)` — channel-aware,
// tagged with the "observe" effect label; `effects pure` + peek fails.

// Type constructors (calls __construct)
Int(42)                        // wraps value with Int type
String("hello")                // wraps value with String type

// C-style comments
// line comment
/* block comment */
```

## Allegro Standard Syntax (extensions)

```
// Dot access (type-directed dispatch)
"hello".length          // getter → 5
"hello".slice(0, 3)     // bound method → "hel"
42.toString()            // → "42"

// Float literals
pi = 3.14

// Bool literals
flag = true

// Array literals and methods
nums = [1, 2, 3, 4, 5]
nums[0]                  // bracket access → 1
nums.map(x => x * 2)    // → [2, 4, 6, 8, 10]
nums.filter(x => x > 3) // → [4, 5]
nums.reduce((a, x) => a + x, 0) // → 15

// Object literals
point = {x: 10, y: 20}
point.x                  // → 10
nested = {a: {b: 42}}
nested.a.b               // → 42

// Logical operators (short-circuiting)
true && false            // → false
false || true            // → true
!true                    // → false
x > 0 && x < 10         // comparisons with logical

// Import
import math
math.pi

// Export (module public interface)
export square = x => x * x
export pi = 3.14159

// String concatenation
"hello" + " " + "world" // → "hello world"

// String interpolation
name = "world"
"hello {name}"           // → "hello world"
"2 + 2 = {2 + 2}"       // → "2 + 2 = 4"
"\{escaped\}"            // → "{escaped}"

// Type annotations on functions
add(x: Int, y: Int): Int => x + y
greet(name: String): String => "Hello, " + name

// Generic type annotations
head(arr: Array[Int]): Int => arr[0]

// Lambdas with type annotations
nums.map(x: Int => x * 2)
(x: Int, y: Int): Int => x + y

// Interfaces (DECLARED conformance — C5.2c/D30)
Printable = Interface.define({toString: Function})
42 instanceof Printable           // false — Int never DREW Printable's symbols
HasXY = Interface.define({x: Int, y: Int})
Point = Type.define({x: Int, y: Int}, HasXY)  // drawing the interface binds its symbols
Point(1, 2) instanceof HasXY      // true — declared conformance
is_printable(v: ~Printable) => true      // ~T is the loose duck-typing path
is_printable(42)                  // true — matches by base name

// Private members (B-097, D41–D43) — the combinator surface
Vault = Type.define({
  owner:  String,
  secret: private(Int),                   // private field
  reveal: (self) => self.secret,          // public method — the type's
})                                        //   own code reads its privates
v = Vault("alice", 42)
v.reveal()                // → 42
v.owner                   // → "alice"
v.secret                  // → error: 'secret' is private to 'Vault'
print(v)                  // → Vault(owner: alice, …) — private omitted
when v is Vault(secret) then secret else 0
                          // → error naming privacy (not a silent no-match)
// readonly(...) is reserved vocabulary — recorded, inert for now
// keyword syntax (`private x: Int`) arrives with the type-declaration
// syntax track and lowers to the same declaration attributes

// Refinement types (Int & predicate, _ is the value)
PositiveInt = Int & _ > 0
PositiveInt(5)                    // → 5
PositiveInt(0 - 1)                // → error(refinement check failed)

// Compound predicates
SmallPos = Int & _ > 0 && _ < 100
SmallPos(50)                      // → 50
SmallPos(150)                     // → error

// Refinement in function annotation
double(x: PositiveInt): Int => x * 2
double(5)                         // → 10 (bare Int passes predicate check)

// preserveOps — lift operators to preserve the refinement
PI = Refinement.define({refines: Int, where: p => p > 0, preserve: "all"})
x = PI(5)
y = x + 3                         // y: PositiveInt, re-checked after +
y instanceof PI                   // → true
x - 10                            // → error (predicate fails after subtraction)

// Grammar extension — add new operators from a module (Phase 6)
// lib/pow.alg:
pow_grammar = grammar {
  infix "**" prec(pow) above(mul) below(unary) right => (l, r) => pow_int(l, r)
  expr_prefix "neg" => x => 0 - x
}

// Consumer file activates the grammar via `use`:
use pow
print(2 ** 10)        // → 1024
print(2 * 3 ** 2)     // → 18 (** binds tighter than *)
print(neg (2 ** 3))   // → -8

// Multi-token forms (Phase 6b)
// lib/match_expr.alg:
match_grammar = grammar {
  rule match_case = p:expr "=>" e:expr       => (p, e) => {p: p, e: e}
  rule match_list = c:match_case ** "|"      => c => c

  expr_form "match" s:expr "with" cs:match_list
    => (s, cs) => match_dispatch(s, cs)
}

// Consumer:
use match_expr
describe(n) =>
  match n with
    1 => "one"
  | 2 => "two"
  | 3 => "three"
```
